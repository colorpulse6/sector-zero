import type { GalaxyCoordinate, ThreatBand } from "../../engine/galaxy/galaxyTypes";
import { selectedTargetIdFor } from "../atlasViewport";
import type { SectorModel, SectorRouteLeg } from "./sectorModel";
import { cameraRadiusForZoom, cellSceneSize, SECTOR_SCENE_SIZE, toScene } from "./sectorSpace";

export interface ProjectedLandmark {
  id: string;
  x: number;
  y: number;
  visible: boolean;
}

export interface SectorSceneHandle {
  setModel(model: SectorModel): void;
  setViewport(center: GalaxyCoordinate, zoom: number): void;
  setLevel(level: "galaxy" | "sector"): Promise<void>;
  focusTarget(targetId: string | null): void;
  pick(clientX: number, clientY: number): { x: number; z: number } | null;
  onFrame(cb: (projected: ProjectedLandmark[]) => void): () => void;
  setReducedMotion(reduced: boolean): void;
  setSpinPaused(paused: boolean): void;
  resize(): void;
  dispose(): void;
}

const BAND_HEX: Readonly<Record<ThreatBand, string>> = Object.freeze({
  unknown: "#8d86ad",
  low: "#66d39e",
  moderate: "#e8c65c",
  high: "#ff8a56",
  severe: "#ff496f",
});

const BAND_RANK: Readonly<Record<ThreatBand, number>> = Object.freeze({
  unknown: 0,
  low: 1,
  moderate: 2,
  high: 3,
  severe: 4,
});

const GLIDE_MS = 250;

interface ScenePoint {
  x: number;
  y: number;
  z: number;
}

/**
 * Babylon sector field. Every `@babylonjs` import stays inside this function so the
 * module can load during server rendering without touching WebGL.
 * Wheel and pinch are removed: zoom belongs to the atlas reducer, not the camera.
 * Tori stay unrotated — Babylon builds them already flat on the XZ plane.
 */
export async function createSectorScene(canvas: HTMLCanvasElement): Promise<SectorSceneHandle> {
  const attributes: WebGLContextAttributes = {
    alpha: false,
    antialias: true,
    depth: true,
    stencil: true,
    preserveDrawingBuffer: false,
    failIfMajorPerformanceCaveat: false,
  };
  let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  try {
    gl = canvas.getContext("webgl2", attributes) ?? canvas.getContext("webgl", attributes);
  } catch {
    gl = null;
  }
  if (!gl) throw new Error("WebGL unavailable");

  const [
    { Engine },
    { Scene },
    { ArcRotateCamera },
    { HemisphericLight },
    { PointLight },
    { MeshBuilder },
    { StandardMaterial },
    { GlowLayer },
    { Color3, Color4 },
    { Vector3, Matrix },
  ] = await Promise.all([
    import("@babylonjs/core/Engines/engine"),
    import("@babylonjs/core/scene"),
    import("@babylonjs/core/Cameras/arcRotateCamera"),
    import("@babylonjs/core/Lights/hemisphericLight"),
    import("@babylonjs/core/Lights/pointLight"),
    import("@babylonjs/core/Meshes/meshBuilder"),
    import("@babylonjs/core/Materials/standardMaterial"),
    import("@babylonjs/core/Layers/glowLayer"),
    import("@babylonjs/core/Maths/math.color"),
    import("@babylonjs/core/Maths/math.vector"),
  ]);
  await Promise.all([
    import("@babylonjs/core/Meshes/Builders/sphereBuilder"),
    import("@babylonjs/core/Meshes/Builders/discBuilder"),
    import("@babylonjs/core/Meshes/Builders/linesBuilder"),
    import("@babylonjs/core/Meshes/Builders/torusBuilder"),
    import("@babylonjs/core/Meshes/Builders/polyhedronBuilder"),
    import("@babylonjs/core/Behaviors/Cameras/autoRotationBehavior"),
    import("@babylonjs/core/Culling/ray"),
  ]);

  const engine = new Engine(gl, true, { stencil: true, antialias: true, adaptToDeviceRatio: false }, false);
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0x06 / 255, 0x0d / 255, 0x13 / 255, 1);

  const camera = new ArcRotateCamera("sector-atlas", -Math.PI / 2.4, 1.05, 60, Vector3.Zero(), scene);
  camera.lowerRadiusLimit = 8;
  camera.upperRadiusLimit = 60;
  camera.lowerBetaLimit = 0.8;
  camera.upperBetaLimit = 1.3;
  camera.minZ = 0.05;
  camera.maxZ = 220;
  camera.panningSensibility = 0;
  camera.inertia = 0.82;
  camera.inputs.removeByType("ArcRotateCameraKeyboardMoveInput");
  camera.inputs.removeByType("ArcRotateCameraMouseWheelInput");
  const pointers = (camera.inputs.attached as {
    pointers?: { panningSensibility: number; _computePinchZoom: (...args: unknown[]) => void };
  }).pointers;
  if (pointers) {
    pointers.panningSensibility = 0;
    pointers._computePinchZoom = () => {};
  }
  camera.attachControl(canvas, false);

  const fill = new HemisphericLight("fill", new Vector3(0, 1, 0), scene);
  fill.intensity = 0.28;
  fill.groundColor = new Color3(0.02, 0.03, 0.04);
  const vesselLight = new PointLight("vessel-light", new Vector3(0, 0.4, 0), scene);
  vesselLight.intensity = 8;
  vesselLight.range = 14;

  const glow = new GlowLayer("sector-glow", scene, { blurKernelSize: 24 });
  glow.intensity = 0.45;

  const groundMaterial = new StandardMaterial("ground", scene);
  groundMaterial.diffuseColor = new Color3(0.03, 0.07, 0.09);
  groundMaterial.emissiveColor = new Color3(0.04, 0.1, 0.12);
  groundMaterial.specularColor = Color3.Black();
  groundMaterial.alpha = 0.55;
  groundMaterial.backFaceCulling = false;
  const ground = MeshBuilder.CreateDisc("ground", { radius: SECTOR_SCENE_SIZE * 0.75, tessellation: 80 }, scene);
  ground.rotation.x = Math.PI / 2;
  ground.position.y = -0.06;
  ground.material = groundMaterial;
  ground.isPickable = false;

  const gridColor = new Color3(0.55, 0.75, 0.78);
  const half = SECTOR_SCENE_SIZE / 2;
  const cell = cellSceneSize();
  const steps = Math.max(1, Math.round(SECTOR_SCENE_SIZE / cell));
  for (let index = 0; index <= steps; index += 1) {
    const offset = -half + index * cell;
    const across = MeshBuilder.CreateLines(`grid-x-${index}`, {
      points: [new Vector3(-half, 0, offset), new Vector3(half, 0, offset)],
    }, scene);
    across.color = gridColor;
    across.alpha = 0.12;
    across.position.y = -0.02;
    across.isPickable = false;
    const along = MeshBuilder.CreateLines(`grid-z-${index}`, {
      points: [new Vector3(offset, 0, -half), new Vector3(offset, 0, half)],
    }, scene);
    along.color = gridColor;
    along.alpha = 0.12;
    along.position.y = -0.02;
    along.isPickable = false;
  }

  const borderColor = new Color3(0.74, 0.92, 0.94);
  const borderY = 0.02;
  const corners = [
    [new Vector3(-half, borderY, -half), new Vector3(half, borderY, -half)],
    [new Vector3(half, borderY, -half), new Vector3(half, borderY, half)],
    [new Vector3(half, borderY, half), new Vector3(-half, borderY, half)],
    [new Vector3(-half, borderY, half), new Vector3(-half, borderY, -half)],
  ];
  corners.forEach((pair, index) => {
    const edge = MeshBuilder.CreateLines(`border-${index}`, { points: pair }, scene);
    edge.color = borderColor;
    edge.alpha = 0.62;
    edge.isPickable = false;
  });

  const selectionMaterial = new StandardMaterial("selection", scene);
  selectionMaterial.disableLighting = true;
  selectionMaterial.emissiveColor = new Color3(0.82, 0.97, 0.93);
  selectionMaterial.alpha = 0.92;
  const selectionRing = MeshBuilder.CreateTorus("selection", { diameter: 0.55, thickness: 0.02, tessellation: 40 }, scene);
  selectionRing.material = selectionMaterial;
  selectionRing.isPickable = false;
  selectionRing.setEnabled(false);

  type Anchor = {
    id: string;
    mesh: { position: { x: number; y: number; z: number }; metadata: unknown; scaling: { set: (x: number, y: number, z: number) => void } };
    material: { emissiveColor: { copyFrom: (color: { r: number; g: number; b: number }) => void } };
    baseEmissive: { r: number; g: number; b: number };
    diameter: number;
  };

  let disposed = false;
  let reduced = false;
  let spinPaused = false;
  let level: "galaxy" | "sector" = "sector";
  let pickingEnabled = true;
  let builtKey = "";
  let focusedId: string | null = null;
  let pulse = 0;
  let storedTarget: ScenePoint = { x: 0, y: 0, z: 0 };
  let storedRadius = 60;
  const listeners = new Set<(projected: ProjectedLandmark[]) => void>();
  const anchors = new Map<string, Anchor>();
  let markers: { id: string; mesh: { position: { x: number; z: number } } }[] = [];
  let dynamicMeshes: { dispose: () => void }[] = [];
  let dynamicMaterials: { dispose: () => void }[] = [];
  let signalMaterials: { alpha: number }[] = [];
  let activeLines: { alpha: number }[] = [];
  let glideObserver: { remove?: () => void } | null = null;
  let glideTimer: ReturnType<typeof setTimeout> | null = null;
  let glideResolve: (() => void) | null = null;

  const applySpin = () => {
    camera.useAutoRotationBehavior = level === "sector" && !reduced && !spinPaused;
    const behavior = camera.autoRotationBehavior;
    if (behavior) {
      behavior.idleRotationSpeed = 0.04;
      behavior.idleRotationWaitTime = 800;
      behavior.idleRotationSpinupTime = 700;
    }
  };
  applySpin();

  const applyControl = () => {
    if (disposed) return;
    if (level === "sector") camera.attachControl(canvas, false);
    else camera.detachControl();
  };

  const applyScaling = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    engine.setHardwareScalingLevel(1 / ratio);
    engine.resize();
  };
  applyScaling();

  const trackMesh = <T extends { dispose: () => void; isPickable: boolean }>(mesh: T): T => {
    mesh.isPickable = false;
    dynamicMeshes.push(mesh);
    return mesh;
  };
  const trackMaterial = <T extends { dispose: () => void }>(material: T): T => {
    dynamicMaterials.push(material);
    return material;
  };

  const clearDynamic = () => {
    selectionRing.parent = null;
    selectionRing.setEnabled(false);
    for (const mesh of dynamicMeshes) mesh.dispose();
    for (const material of dynamicMaterials) material.dispose();
    dynamicMeshes = [];
    dynamicMaterials = [];
    anchors.clear();
    markers = [];
    signalMaterials = [];
    activeLines = [];
  };

  const paintFocus = () => {
    for (const anchor of anchors.values()) anchor.material.emissiveColor.copyFrom(anchor.baseEmissive);
    const anchor = focusedId ? anchors.get(focusedId) ?? null : null;
    if (!anchor) {
      selectionRing.parent = null;
      selectionRing.setEnabled(false);
      return;
    }
    const boosted = Color3.Lerp(anchor.material.emissiveColor as never, Color3.White(), 0.45);
    anchor.material.emissiveColor.copyFrom(boosted);
    selectionRing.parent = anchor.mesh as never;
    selectionRing.position.set(0, 0, 0);
    const scale = Math.max(0.7, (anchor.diameter + 0.18) / 0.55);
    selectionRing.scaling.set(scale, scale, scale);
    selectionRing.setEnabled(true);
  };

  const bandColor = (band: ThreatBand) => Color3.FromHexString(BAND_HEX[band]);

  const knowledgeTint = (knowledge: SectorModel["stars"][number]["knowledge"]) => {
    if (knowledge === "visited") return new Color3(0.93, 0.98, 0.96);
    if (knowledge === "charted") return new Color3(0.62, 0.86, 0.9);
    return new Color3(0.62, 0.66, 0.68);
  };

  const starDiameter = (knowledge: SectorModel["stars"][number]["knowledge"]) => {
    if (knowledge === "visited") return 0.28;
    if (knowledge === "charted") return 0.22;
    return 0.14;
  };

  const rememberAnchor = (id: string, anchor: Anchor) => {
    if (!anchors.has(id)) anchors.set(id, anchor);
  };

  const placeMarker = (
    id: string,
    point: { x: number; z: number },
    diameter: number,
    color: ReturnType<typeof Color3.FromHexString>,
    alpha: number,
    flicker: boolean,
  ) => {
    const material = trackMaterial(new StandardMaterial(`body-${id}`, scene));
    material.disableLighting = true;
    material.emissiveColor = color;
    material.diffuseColor = color;
    material.specularColor = Color3.Black();
    material.alpha = alpha;
    if (flicker) signalMaterials.push(material);
    const mesh = trackMesh(MeshBuilder.CreateSphere(`body-${id}`, { diameter, segments: 14 }, scene));
    mesh.material = material;
    mesh.position.set(point.x, 0, point.z);
    mesh.metadata = { diameter };
    const anchor: Anchor = {
      id,
      mesh,
      material,
      baseEmissive: material.emissiveColor.clone(),
      diameter,
    };
    rememberAnchor(id, anchor);
    markers.push({ id, mesh });
    return mesh;
  };

  const addColonyRing = (parent: { id: string }, diameter: number) => {
    const material = trackMaterial(new StandardMaterial(`colony-${parent.id}`, scene));
    material.disableLighting = true;
    material.emissiveColor = new Color3(0.84, 0.77, 0.55);
    material.alpha = 0.9;
    const ring = trackMesh(MeshBuilder.CreateTorus(`colony-${parent.id}`, {
      diameter: diameter + 0.16,
      thickness: 0.012,
      tessellation: 36,
    }, scene));
    ring.material = material;
    ring.parent = parent as never;
  };

  const addLeg = (leg: SectorRouteLeg, name: string) => {
    const from = toScene(leg.from);
    const to = toScene(leg.to);
    if (Math.hypot(to.x - from.x, to.z - from.z) < 1e-4) return;
    const y = leg.state === "active" ? 0.08 : 0.05;
    const points = [new Vector3(from.x, y, from.z), new Vector3(to.x, y, to.z)];
    const line = leg.state === "pending"
      ? trackMesh(MeshBuilder.CreateDashedLines(name, { points, dashNb: 18, dashSize: 2, gapSize: 1.5 }, scene))
      : trackMesh(MeshBuilder.CreateLines(name, { points }, scene));
    line.color = bandColor(leg.band);
    line.alpha = leg.state === "pending" ? 0.4 : leg.state === "done" ? 0.95 : 0.85;
    if (leg.state === "active") activeLines.push(line);
  };

  const addDisc = (coordinate: GalaxyCoordinate, band: ThreatBand, name: string) => {
    const point = toScene(coordinate);
    const material = trackMaterial(new StandardMaterial(name, scene));
    material.disableLighting = true;
    material.emissiveColor = bandColor(band);
    material.diffuseColor = bandColor(band);
    material.specularColor = Color3.Black();
    material.alpha = 0.28;
    const disc = trackMesh(MeshBuilder.CreateDisc(name, {
      radius: 0.6 + BAND_RANK[band] * 0.25,
      tessellation: 40,
    }, scene));
    disc.material = material;
    disc.rotation.x = Math.PI / 2;
    disc.position.set(point.x, 0.015, point.z);
  };

  const addCrosshair = (coordinate: GalaxyCoordinate) => {
    const point = toScene(coordinate);
    const y = 0.09;
    const arm = 0.42;
    const color = new Color3(0.78, 0.65, 0.91);
    const across = trackMesh(MeshBuilder.CreateLines("blind-x", {
      points: [new Vector3(point.x - arm, y, point.z), new Vector3(point.x + arm, y, point.z)],
    }, scene));
    const along = trackMesh(MeshBuilder.CreateLines("blind-z", {
      points: [new Vector3(point.x, y, point.z - arm), new Vector3(point.x, y, point.z + arm)],
    }, scene));
    across.color = color;
    along.color = color;
    across.alpha = 0.9;
    along.alpha = 0.9;
    const material = trackMaterial(new StandardMaterial("blind-core", scene));
    material.disableLighting = true;
    material.emissiveColor = color;
    material.alpha = 0.95;
    const mesh = trackMesh(MeshBuilder.CreateSphere("blind-core", { diameter: 0.08, segments: 8 }, scene));
    mesh.material = material;
    mesh.position.set(point.x, y, point.z);
    const anchor: Anchor = {
      id: "blind",
      mesh,
      material,
      baseEmissive: material.emissiveColor.clone(),
      diameter: 0.2,
    };
    anchors.set("blind", anchor);
    markers.push({ id: "blind", mesh });
    const targetId = selectedTargetIdFor({ kind: "coordinate", coordinate });
    rememberAnchor(targetId, anchor);
  };

  const setModel = (model: SectorModel) => {
    if (disposed || model.key === builtKey) return;
    builtKey = model.key;
    clearDynamic();

    for (const star of model.stars) {
      const point = toScene(star.coordinate);
      const diameter = starDiameter(star.knowledge);
      const tint = star.threat === "unknown" ? knowledgeTint(star.knowledge) : bandColor(star.threat);
      const alpha = star.knowledge === "signal" ? 0.38 : 1;
      const mesh = placeMarker(star.targetId, point, diameter, tint, alpha, star.knowledge === "signal");
      if (star.colonies > 0) addColonyRing(mesh, diameter);
    }

    const vesselPoint = toScene(model.vessel.coordinate);
    const vesselWarning = model.vessel.status === "stranded";
    const vesselColor = vesselWarning ? new Color3(1, 0.42, 0.48) : new Color3(0.9, 0.97, 1);
    const vesselMaterial = trackMaterial(new StandardMaterial("vessel", scene));
    vesselMaterial.disableLighting = true;
    vesselMaterial.emissiveColor = vesselColor;
    vesselMaterial.diffuseColor = vesselColor;
    const vessel = trackMesh(MeshBuilder.CreatePolyhedron("vessel", { type: 1, size: 0.16 }, scene));
    vessel.material = vesselMaterial;
    vessel.position.set(vesselPoint.x, 0.16, vesselPoint.z);
    vesselLight.position.set(vesselPoint.x, 0.4, vesselPoint.z);
    vesselLight.diffuse = vesselColor;
    vesselLight.specular = vesselColor;
    vesselLight.intensity = vesselWarning ? 14 : 8;
    anchors.set("vessel", {
      id: "vessel",
      mesh: vessel,
      material: vesselMaterial,
      baseEmissive: vesselMaterial.emissiveColor.clone(),
      diameter: 0.34,
    });
    markers.push({ id: "vessel", mesh: vessel });

    if (model.route) {
      model.route.legs.forEach((leg, index) => addLeg(leg, `route-${index}`));
      addDisc(model.route.destination, model.route.band, "route-disc");
    }
    if (model.travel) {
      model.travel.legs.forEach((leg, index) => addLeg(leg, `travel-${index}`));
      const last = model.travel.legs[model.travel.legs.length - 1];
      if (last) {
        const band = model.travel.legs.reduce<ThreatBand>(
          (best, leg) => (BAND_RANK[leg.band] > BAND_RANK[best] ? leg.band : best),
          "unknown",
        );
        addDisc(last.to, band, "travel-disc");
      }
    }
    if (model.blindTarget) addCrosshair(model.blindTarget);
    paintFocus();
  };

  const project = (): ProjectedLandmark[] => {
    const scaling = engine.getHardwareScalingLevel();
    const width = engine.getRenderWidth();
    const height = engine.getRenderHeight();
    const viewport = camera.viewport.toGlobal(width, height);
    const transform = scene.getTransformMatrix();
    const identity = Matrix.Identity();
    return markers.map(marker => {
      const point = Vector3.Project(
        new Vector3(marker.mesh.position.x, 0, marker.mesh.position.z),
        identity,
        transform,
        viewport,
      );
      const inDepth = point.z >= 0 && point.z <= 1;
      const inside = inDepth && point.x >= 0 && point.y >= 0 && point.x <= width && point.y <= height;
      return {
        id: marker.id,
        x: point.x * scaling,
        y: point.y * scaling,
        visible: inside,
      };
    });
  };

  const publish = () => {
    if (listeners.size === 0) return;
    const frame = project();
    for (const listener of listeners) listener(frame);
  };

  engine.runRenderLoop(() => {
    if (disposed) return;
    const dt = Math.min(0.05, engine.getDeltaTime() / 1000);
    if (!reduced) pulse += dt;
    const flicker = reduced ? 0.38 : 0.22 + 0.2 * (0.5 + 0.5 * Math.sin(pulse * 6));
    for (const material of signalMaterials) material.alpha = flicker;
    const activeAlpha = reduced ? 0.9 : 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(pulse * 5));
    for (const line of activeLines) line.alpha = activeAlpha;
    scene.render();
    publish();
  });

  const finishGlide = () => {
    const resolve = glideResolve;
    glideResolve = null;
    if (glideObserver) {
      const observer = glideObserver;
      glideObserver = null;
      scene.onBeforeRenderObservable.remove(observer as never);
    }
    if (glideTimer !== null) {
      clearTimeout(glideTimer);
      glideTimer = null;
    }
    resolve?.();
  };

  const closeEnough = (target: ScenePoint, radius: number) =>
    Math.abs(camera.radius - radius) < 0.04
    && Math.abs(camera.target.x - target.x) < 0.01
    && Math.abs(camera.target.z - target.z) < 0.01;

  const glide = (target: ScenePoint, radius: number, ms: number) => {
    finishGlide();
    if (disposed || reduced || ms <= 0 || closeEnough(target, radius)) {
      camera.setTarget(new Vector3(target.x, target.y, target.z), false, true, true);
      camera.radius = radius;
      return Promise.resolve();
    }
    const fromTarget = camera.target.clone();
    const fromRadius = camera.radius;
    return new Promise<void>(resolve => {
      glideResolve = resolve;
      const start = performance.now();
      glideObserver = scene.onBeforeRenderObservable.add(() => {
        if (disposed) {
          finishGlide();
          return;
        }
        const t = Math.min(1, (performance.now() - start) / ms);
        const eased = t * t * (3 - 2 * t);
        camera.setTarget(new Vector3(
          fromTarget.x + (target.x - fromTarget.x) * eased,
          fromTarget.y + (target.y - fromTarget.y) * eased,
          fromTarget.z + (target.z - fromTarget.z) * eased,
        ), false, true, true);
        camera.radius = fromRadius + (radius - fromRadius) * eased;
        if (t >= 1) finishGlide();
      });
      glideTimer = setTimeout(finishGlide, ms + 250);
    });
  };

  const handle: SectorSceneHandle = {
    setModel,
    setViewport(center, zoom) {
      const point = toScene(center);
      storedTarget = { x: point.x, y: 0, z: point.z };
      storedRadius = cameraRadiusForZoom(zoom);
      if (disposed || level === "galaxy") return;
      void glide(storedTarget, storedRadius, reduced ? 0 : GLIDE_MS);
    },
    setLevel(next) {
      level = next;
      pickingEnabled = next === "sector";
      applyControl();
      applySpin();
      if (next === "galaxy") return glide({ x: 0, y: 0, z: 0 }, 60, reduced ? 0 : GLIDE_MS);
      return glide(storedTarget, storedRadius, reduced ? 0 : GLIDE_MS);
    },
    focusTarget(targetId) {
      focusedId = targetId;
      paintFocus();
    },
    pick(clientX, clientY) {
      if (disposed || !pickingEnabled || level === "galaxy") return null;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
      const ray = scene.createPickingRay(x, y, Matrix.Identity(), camera);
      const directionY = ray.direction.y;
      if (!Number.isFinite(directionY) || Math.abs(directionY) < 1e-6) return null;
      const distance = -ray.origin.y / directionY;
      if (!Number.isFinite(distance) || distance < 0) return null;
      return {
        x: ray.origin.x + ray.direction.x * distance,
        z: ray.origin.z + ray.direction.z * distance,
      };
    },
    onFrame(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    setReducedMotion(next) {
      reduced = next;
      if (!disposed) applySpin();
    },
    setSpinPaused(next) {
      spinPaused = next;
      if (!disposed) applySpin();
    },
    resize() {
      if (!disposed) applyScaling();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      finishGlide();
      listeners.clear();
      engine.stopRenderLoop();
      scene.dispose();
      engine.dispose();
    },
  };

  return handle;
}

import type { PlanetId } from "../../engine/types";
import type { PlanetBiome } from "../../colony/shared/colonyTypes";
import { BIOME_PALETTES } from "../../colony/meta/regionMapTerrain";
import {
  findSystem,
  neighboursOf,
  planetScenePosition,
  type StarSystem,
  type SystemNeighbour,
  type SystemPlanet,
} from "./starSystems";
import { clampToEdgeRing, NEIGHBOUR_RING_PERCENT, PLAN_TILT } from "./systemLayout";

/**
 * Biome per catalogue planet. `PLANET_BIOMES` in regionMap.ts is private, so the
 * same ten-entry mapping lives here for the planet tint (`BIOME_PALETTES[biome].ridge`).
 */
const PLANET_BIOMES: Record<PlanetId, PlanetBiome> = {
  verdania: "jungle",
  glaciem: "ice",
  pyraxis: "volcanic",
  ossuary: "barren",
  abyssia: "ocean",
  ashfall: "desert",
  prismara: "barren",
  genesis: "toxic",
  luminos: "urban",
  bastion: "urban",
};

export function systemPlanetBiome(planetId: PlanetId): PlanetBiome {
  return PLANET_BIOMES[planetId] ?? "barren";
}

export interface ProjectedLandmark {
  id: string;
  x: number;
  y: number;
  visible: boolean;
}

export interface SystemSceneHandle {
  setSystem(system: StarSystem, neighbours: readonly SystemNeighbour[], cycle: number, colonyPlanetIds?: readonly string[]): void;
  focusLandmark(id: string | null): void;
  glideToSystem(systemId: string): Promise<void>;
  onFrame(cb: (projected: ProjectedLandmark[]) => void): () => void;
  setReducedMotion(reduced: boolean): void;
  /** Hold the idle spin while the pointer rests on the chart so labels stay put. */
  setSpinPaused(paused: boolean): void;
  resize(): void;
  dispose(): void;
}

/** CSS-pixel insets that keep a pinned landmark and its label inside the chart. */
const EDGE_INSET_X = 84;
const EDGE_INSET_Y = 78;

/**
 * Clamp a projected point (render pixels) onto an ellipse inset from the chart edge.
 * Points already inside the ellipse stay where they are so the landmark sits on its dot.
 */
export function pinToEdgeRing(
  px: number,
  py: number,
  width: number,
  height: number,
  inFront: boolean,
  scaling: number,
): { x: number; y: number; pinned: boolean; angle: number } {
  const cx = width / 2;
  const cy = height / 2;
  const rx = Math.max(24, cx - EDGE_INSET_X / scaling);
  const ry = Math.max(24, cy - EDGE_INSET_Y / scaling);
  let dx = px - cx;
  let dy = py - cy;
  if (!inFront) {
    dx = -dx;
    dy = -dy;
  }
  const norm = Math.hypot(dx / rx, dy / ry);
  if (norm <= 1) return { x: cx + dx, y: cy + dy, pinned: false, angle: 0 };
  const angle = Math.atan2(dy / ry, dx / rx);
  return { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry, pinned: true, angle };
}

/** Minimum CSS-pixel gap between two pinned landmarks so their labels never collide. */
const PIN_MIN_GAP = 120;

/**
 * Push pinned landmarks apart along the edge ring when two neighbours share a bearing.
 * Works on the ellipse parameter angle; a few passes settle any cluster of five systems.
 */
export function spreadAlongRing(entries: { angle: number }[], rx: number, ry: number, minGap: number): void {
  if (entries.length < 2) return;
  entries.sort((left, right) => left.angle - right.angle);
  const minAngle = Math.min(Math.PI * 2 / entries.length, minGap / ((rx + ry) / 2));
  for (let pass = 0; pass < 8; pass += 1) {
    let moved = false;
    for (let index = 0; index < entries.length; index += 1) {
      const current = entries[index];
      const next = entries[(index + 1) % entries.length];
      let gap = next.angle - current.angle;
      if (index === entries.length - 1) gap += Math.PI * 2;
      if (gap < minAngle - 1e-6) {
        const push = (minAngle - gap) / 2;
        current.angle -= push;
        next.angle += push;
        moved = true;
      }
    }
    if (!moved) break;
  }
}

const NEIGHBOUR_DISTANCE = 7.5;
const GLIDE_MS = 600;

/** Map a flat-plan bearing onto the scene XZ plane, 7.5 units from the star. */
function neighbourScenePosition(bearing: number): { x: number; y: number; z: number } {
  const edge = clampToEdgeRing(bearing);
  const x = (edge.x - 50) / NEIGHBOUR_RING_PERCENT;
  const z = (edge.y - 50) / (NEIGHBOUR_RING_PERCENT * PLAN_TILT);
  const length = Math.hypot(x, z) || 1;
  return { x: (x / length) * NEIGHBOUR_DISTANCE, y: 0, z: (z / length) * NEIGHBOUR_DISTANCE };
}

/**
 * Babylon system view. Every `@babylonjs` import is inside this function so the
 * module can load during server rendering without touching WebGL.
 */
export async function createSystemScene(canvas: HTMLCanvasElement): Promise<SystemSceneHandle> {
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
    import("@babylonjs/core/Behaviors/Cameras/autoRotationBehavior"),
  ]);

  const engine = new Engine(gl, true, { stencil: true, antialias: true, adaptToDeviceRatio: false }, false);
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0x06 / 255, 0x0d / 255, 0x13 / 255, 1);

  const camera = new ArcRotateCamera("system-atlas", -Math.PI / 2, 1.1, 9, Vector3.Zero(), scene);
  camera.lowerRadiusLimit = 6;
  camera.upperRadiusLimit = 16;
  camera.lowerBetaLimit = 0.9;
  camera.upperBetaLimit = 1.35;
  camera.minZ = 0.1;
  camera.maxZ = 80;
  camera.wheelPrecision = 50;
  camera.pinchPrecision = 180;
  camera.panningSensibility = 0;
  camera.attachControl(canvas, false);
  camera.inputs.removeByType("ArcRotateCameraKeyboardMoveInput");

  const fill = new HemisphericLight("fill", new Vector3(0, 1, 0), scene);
  fill.intensity = 0.45;
  fill.groundColor = new Color3(0.02, 0.03, 0.04);
  const starLight = new PointLight("star-light", new Vector3(0, 0.2, 0), scene);
  starLight.intensity = 18;
  starLight.range = 30;

  const glow = new GlowLayer("system-glow", scene, { blurKernelSize: 32 });
  glow.intensity = 0.6;

  const starMaterial = new StandardMaterial("star", scene);
  starMaterial.disableLighting = true;
  const star = MeshBuilder.CreateSphere("star", { diameter: 0.8, segments: 24 }, scene);
  star.material = starMaterial;
  star.isPickable = false;

  const groundMaterial = new StandardMaterial("ground", scene);
  groundMaterial.diffuseColor = new Color3(0.04, 0.1, 0.12);
  groundMaterial.emissiveColor = new Color3(0.05, 0.16, 0.18);
  groundMaterial.specularColor = Color3.Black();
  groundMaterial.alpha = 0.08;
  groundMaterial.backFaceCulling = false;
  const ground = MeshBuilder.CreateDisc("ground", { radius: 10, tessellation: 72 }, scene);
  ground.rotation.x = Math.PI / 2;
  ground.position.y = -0.06;
  ground.material = groundMaterial;
  ground.isPickable = false;

  const gridColor = new Color3(0.55, 0.75, 0.78);
  for (let step = -8; step <= 8; step += 2) {
    const across = MeshBuilder.CreateLines("grid-x", {
      points: [new Vector3(-9, 0, step), new Vector3(9, 0, step)],
    }, scene);
    across.color = gridColor;
    across.alpha = 0.14;
    across.position.y = -0.04;
    across.isPickable = false;
    const along = MeshBuilder.CreateLines("grid-z", {
      points: [new Vector3(step, 0, -9), new Vector3(step, 0, 9)],
    }, scene);
    along.color = gridColor;
    along.alpha = 0.14;
    along.position.y = -0.04;
    along.isPickable = false;
  }

  const selectionMaterial = new StandardMaterial("selection", scene);
  selectionMaterial.disableLighting = true;
  selectionMaterial.emissiveColor = new Color3(0.82, 0.97, 0.93);
  selectionMaterial.alpha = 0.9;
  const selectionRing = MeshBuilder.CreateTorus("selection", { diameter: 0.55, thickness: 0.018, tessellation: 40 }, scene);
  selectionRing.material = selectionMaterial;
  selectionRing.isPickable = false;
  selectionRing.setEnabled(false);

  type Body = {
    id: string;
    kind: "planet" | "system";
    mesh: { position: { x: number; y: number; z: number } };
    material: { emissiveColor: { r: number; g: number; b: number; copyFrom: (c: { r: number; g: number; b: number }) => void } };
    baseEmissive: { r: number; g: number; b: number };
    planet?: SystemPlanet;
    fixed?: { x: number; y: number; z: number };
  };

  let disposed = false;
  let reduced = false;
  let spinPaused = false;
  let driftSeconds = 0;
  let cycle = 0;
  let colonyIds: readonly string[] = [];
  let currentSystem: StarSystem | null = null;
  let builtKey = "";
  let currentNeighbours: readonly SystemNeighbour[] = [];
  let focusedId: string | null = null;
  let bodies: Body[] = [];
  let dynamicMeshes: { dispose: () => void }[] = [];
  let dynamicMaterials: { dispose: () => void }[] = [];
  let gliding: Promise<void> | null = null;
  const listeners = new Set<(projected: ProjectedLandmark[]) => void>();

  const applySpin = () => {
    camera.useAutoRotationBehavior = !reduced && !spinPaused;
    const behavior = camera.autoRotationBehavior;
    if (behavior) {
      behavior.idleRotationSpeed = 0.08;
      behavior.idleRotationWaitTime = 700;
      behavior.idleRotationSpinupTime = 900;
    }
  };
  applySpin();

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
  const trackMaterial = <T extends { dispose: () => void }>(material: T) => {
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
    bodies = [];
  };

  const paintFocus = () => {
    for (const body of bodies) body.material.emissiveColor.copyFrom(body.baseEmissive);
    const body = bodies.find(entry => entry.id === focusedId);
    if (!body) {
      selectionRing.parent = null;
      selectionRing.setEnabled(false);
      return;
    }
    const boosted = Color3.Lerp(body.material.emissiveColor as never, Color3.White(), body.kind === "system" ? 0.55 : 0.4);
    body.material.emissiveColor.copyFrom(boosted);
    selectionRing.parent = body.mesh as never;
    selectionRing.position.set(0, 0, 0);
    const scale = body.planet ? (body.planet.radius * 2 + 0.2) / 0.55 : 1.35;
    selectionRing.scaling.set(scale, scale, scale);
    selectionRing.setEnabled(true);
  };

  const placePlanets = () => {
    for (const body of bodies) {
      if (!body.planet) continue;
      const position = planetScenePosition(body.planet, cycle, driftSeconds);
      body.mesh.position.x = position.x;
      body.mesh.position.y = 0;
      body.mesh.position.z = position.z;
    }
  };

  const setSystem = (system: StarSystem, neighbours: readonly SystemNeighbour[], nextCycle: number, colonyPlanetIds?: readonly string[]) => {
    if (colonyPlanetIds) colonyIds = colonyPlanetIds;
    const key = `${system.id}|${nextCycle}|${colonyIds.join(",")}`;
    if (key === builtKey && currentSystem) return;
    builtKey = key;
    currentSystem = system;
    currentNeighbours = neighbours;
    cycle = nextCycle;
    const colonies = new Set(colonyIds);
    clearDynamic();

    const starColor = Color3.FromHexString(system.starColor);
    starMaterial.emissiveColor = starColor;
    starMaterial.diffuseColor = starColor;
    starLight.diffuse = starColor;
    starLight.specular = starColor;

    for (const planet of system.planets) {
      const biome = systemPlanetBiome(planet.planetId);
      const tint = Color3.FromHexString(BIOME_PALETTES[biome].ridge);
      const material = trackMaterial(new StandardMaterial(`planet-${planet.planetId}`, scene));
      material.diffuseColor = tint;
      material.emissiveColor = tint.scale(0.38);
      material.specularColor = new Color3(0.15, 0.15, 0.16);
      const mesh = trackMesh(MeshBuilder.CreateSphere(`planet-${planet.planetId}`, {
        diameter: planet.radius * 2,
        segments: 18,
      }, scene));
      mesh.material = material;
      const position = planetScenePosition(planet, cycle, driftSeconds);
      mesh.position.set(position.x, 0, position.z);
      if (colonies.has(planet.planetId)) {
        const ringMaterial = trackMaterial(new StandardMaterial(`colony-${planet.planetId}`, scene));
        ringMaterial.disableLighting = true;
        ringMaterial.emissiveColor = new Color3(0.72, 0.9, 0.88);
        ringMaterial.alpha = 0.85;
        const ring = trackMesh(MeshBuilder.CreateTorus(`colony-${planet.planetId}`, {
          diameter: planet.radius * 2 + 0.14,
          thickness: 0.012,
          tessellation: 36,
        }, scene));
        ring.material = ringMaterial;
        ring.parent = mesh;
      }
      const orbitMaterial = trackMaterial(new StandardMaterial(`orbit-${planet.planetId}`, scene));
      orbitMaterial.disableLighting = true;
      orbitMaterial.emissiveColor = new Color3(0.45, 0.66, 0.7);
      orbitMaterial.alpha = 0.28;
      const orbit = trackMesh(MeshBuilder.CreateTorus(`orbit-${planet.planetId}`, {
        diameter: planet.orbitRadius * 2,
        thickness: 0.012,
        tessellation: 64,
      }, scene));
      orbit.material = orbitMaterial;
      bodies.push({
        id: `planet:${planet.planetId}`,
        kind: "planet",
        mesh,
        material,
        baseEmissive: material.emissiveColor.clone(),
        planet,
      });
    }

    for (const neighbour of neighbours) {
      const fixed = neighbourScenePosition(neighbour.bearing);
      const signal = neighbour.system.knowledge === "signal";
      const tint = signal ? new Color3(0.45, 0.5, 0.54) : Color3.FromHexString(neighbour.system.starColor);
      const material = trackMaterial(new StandardMaterial(`neighbour-${bodies.length}`, scene));
      material.disableLighting = true;
      material.emissiveColor = signal ? tint.scale(0.45) : tint;
      const mesh = trackMesh(MeshBuilder.CreateSphere(`neighbour-${bodies.length}`, {
        diameter: signal ? 0.16 : 0.26,
        segments: 12,
      }, scene));
      mesh.material = material;
      mesh.position.set(fixed.x, fixed.y, fixed.z);
      const lanePoints = [Vector3.Zero(), new Vector3(fixed.x, 0, fixed.z)];
      const lane = signal
        ? trackMesh(MeshBuilder.CreateDashedLines(`lane-${bodies.length}`, { points: lanePoints, dashNb: 18, dashSize: 2, gapSize: 1.4 }, scene))
        : trackMesh(MeshBuilder.CreateLines(`lane-${bodies.length}`, { points: lanePoints }, scene));
      lane.color = new Color3(0.55, 0.68, 0.7);
      lane.alpha = signal ? 0.28 : 0.4;
      bodies.push({
        id: neighbour.system.id,
        kind: "system",
        mesh,
        material,
        baseEmissive: material.emissiveColor.clone(),
        fixed,
      });
    }
    paintFocus();
  };

  const project = (): ProjectedLandmark[] => {
    const scaling = engine.getHardwareScalingLevel();
    const width = engine.getRenderWidth();
    const height = engine.getRenderHeight();
    const viewport = camera.viewport.toGlobal(width, height);
    const transform = scene.getTransformMatrix();
    const identity = Matrix.Identity();
    const projected: ProjectedLandmark[] = [];
    const pinned: { index: number; angle: number }[] = [];
    for (const body of bodies) {
      const source = body.planet
        ? planetScenePosition(body.planet, cycle, driftSeconds)
        : { x: body.fixed?.x ?? body.mesh.position.x, z: body.fixed?.z ?? body.mesh.position.z };
      const point = Vector3.Project(new Vector3(source.x, 0, source.z), identity, transform, viewport);
      const inDepth = point.z >= 0 && point.z <= 1;
      if (body.kind === "system") {
        // Neighbours live past the frustum edge; pin their landmark to the chart's edge ring
        // in the direction they lie (mirrored when the point falls behind the camera).
        const edge = pinToEdgeRing(point.x, point.y, width, height, inDepth, scaling);
        if (edge.pinned) pinned.push({ index: projected.length, angle: edge.angle });
        projected.push({ id: body.id, x: edge.x * scaling, y: edge.y * scaling, visible: true });
        continue;
      }
      projected.push({
        id: body.id,
        x: point.x * scaling,
        y: point.y * scaling,
        visible: inDepth,
      });
    }
    if (pinned.length > 1) {
      const cx = width / 2;
      const cy = height / 2;
      const rx = Math.max(24, cx - EDGE_INSET_X / scaling);
      const ry = Math.max(24, cy - EDGE_INSET_Y / scaling);
      spreadAlongRing(pinned, rx, ry, PIN_MIN_GAP / scaling);
      for (const entry of pinned) {
        projected[entry.index].x = (cx + Math.cos(entry.angle) * rx) * scaling;
        projected[entry.index].y = (cy + Math.sin(entry.angle) * ry) * scaling;
      }
    }
    return projected;
  };

  const publish = () => {
    if (listeners.size === 0) return;
    const frame = project();
    for (const listener of listeners) listener(frame);
  };

  engine.runRenderLoop(() => {
    if (disposed) return;
    const dt = Math.min(0.05, engine.getDeltaTime() / 1000);
    if (!reduced) driftSeconds += dt;
    placePlanets();
    scene.render();
    publish();
  });

  const tweenTarget = (from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }, ms: number) => {
    if (reduced || ms <= 0) {
      camera.setTarget(new Vector3(to.x, to.y, to.z), false, true, true);
      return Promise.resolve();
    }
    return new Promise<void>(resolve => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        scene.onBeforeRenderObservable.remove(observer);
        resolve();
      };
      const start = performance.now();
      const observer = scene.onBeforeRenderObservable.add(() => {
        if (disposed) {
          finish();
          return;
        }
        const t = Math.min(1, (performance.now() - start) / ms);
        const eased = t * t * (3 - 2 * t);
        camera.setTarget(new Vector3(
          from.x + (to.x - from.x) * eased,
          from.y + (to.y - from.y) * eased,
          from.z + (to.z - from.z) * eased,
        ), false, true, true);
        if (t >= 1) finish();
      });
      setTimeout(finish, ms + 250);
    });
  };

  const animateRadius = (to: number, ms: number) => {
    if (reduced || ms <= 0 || disposed) {
      camera.radius = to;
      return Promise.resolve();
    }
    const from = camera.radius;
    return new Promise<void>(resolve => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        scene.onBeforeRenderObservable.remove(observer);
        if (!disposed) camera.radius = to;
        resolve();
      };
      const start = performance.now();
      const observer = scene.onBeforeRenderObservable.add(() => {
        if (disposed) {
          finish();
          return;
        }
        const t = Math.min(1, (performance.now() - start) / ms);
        const eased = t * t * (3 - 2 * t);
        camera.radius = from + (to - from) * eased;
        if (t >= 1) finish();
      });
      setTimeout(finish, ms + 250);
    });
  };

  const handle: SystemSceneHandle = {
    setSystem,
    focusLandmark(id) {
      focusedId = id;
      paintFocus();
    },
    async glideToSystem(systemId: string) {
      if (gliding) return gliding;
      const next = findSystem(systemId);
      const neighbour = currentNeighbours.find(entry => entry.system.id === systemId);
      if (!next || !neighbour || !currentSystem || next.id === currentSystem.id) return;
      const run = (async () => {
        const destination = neighbourScenePosition(neighbour.bearing);
        const origin = camera.target.clone();
        const spinning = camera.useAutoRotationBehavior;
        camera.useAutoRotationBehavior = false;
        try {
          if (reduced) {
            camera.radius = 16;
            camera.setTarget(new Vector3(destination.x, destination.y, destination.z), false, true, true);
          } else {
            await Promise.all([
              animateRadius(16, GLIDE_MS),
              tweenTarget(origin, destination, GLIDE_MS),
            ]);
          }
          if (disposed) return;
          setSystem(next, neighboursOf(next.id), cycle, colonyIds);
          camera.setTarget(Vector3.Zero(), false, true, true);
          if (reduced) camera.radius = 9;
          else await animateRadius(9, GLIDE_MS);
        } finally {
          if (!disposed && spinning) applySpin();
        }
      })();
      gliding = run.finally(() => {
        gliding = null;
      });
      return gliding;
    },
    onFrame(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    setReducedMotion(next) {
      reduced = next;
      if (!gliding) applySpin();
    },
    setSpinPaused(next) {
      spinPaused = next;
      if (!gliding && !disposed) applySpin();
    },
    resize() {
      if (!disposed) applyScaling();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      listeners.clear();
      engine.stopRenderLoop();
      scene.dispose();
      engine.dispose();
    },
  };

  return handle;
}

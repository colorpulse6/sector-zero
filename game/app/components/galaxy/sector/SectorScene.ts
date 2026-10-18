import type { Color3 as BabylonColor3 } from "@babylonjs/core/Maths/math.color";
import type { Vector3 as BabylonVector3 } from "@babylonjs/core/Maths/math.vector";
import type { Sprite as BabylonSprite } from "@babylonjs/core/Sprites/sprite";
import type { GalaxyCoordinate, ThreatBand } from "../../engine/galaxy/galaxyTypes";
import { selectedTargetIdFor } from "../atlasViewport";
import { STAR_COLORS, type StarClass } from "../system/starSystems";
import {
  ATLAS_SKY_SEED,
  COLONY_GOLD_HEX,
  createRandom,
  NEBULA_PALETTES,
  paintDustField,
  paintFlare,
  paintGlow,
  paintNebula,
  paintSky,
  SIGNAL_GLOW_HEX,
  STAR_GLOW_HEX,
} from "./sectorArt";
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
  /** CSS pixels an overlay covers on the right edge; the view centres in the space left over. */
  setViewInset(rightPx: number): void;
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

/** Saturated halo colours per spectral class; STAR_COLORS stay the pale core palette. */
const GLOW_HEX = STAR_GLOW_HEX;
const SIGNAL_HEX = SIGNAL_GLOW_HEX;
const COLONY_HEX = COLONY_GOLD_HEX;
const BLIND_HEX = "#c6a6ef";

/** Scene units a star rises or sinks at elevation ±1. Decorative; the plane holds the coordinate. */
const ELEVATION_SCALE = 3.4;
const GLIDE_MS = 250;
const SKY_SEED = ATLAS_SKY_SEED;
const DUST_SEED = 0x0d0570;
const NEBULA_SEED = 0x6e6b1a;
const ALPHA_ADD = 1;

/** Fixed nebula layout: horizontal layers at different heights so the tilted camera sees depth. */
const NEBULA_LAYERS = Object.freeze([
  { palette: 0, size: 34, x: -7, z: 6, y: -2.6, rotation: 0.4, alpha: 0.9 },
  { palette: 1, size: 27, x: 10, z: -8, y: -1.1, rotation: 1.7, alpha: 0.75 },
  { palette: 2, size: 21, x: -11, z: -12, y: 1.5, rotation: 2.6, alpha: 0.6 },
  { palette: 3, size: 30, x: 9, z: 11, y: 3.1, rotation: 4.1, alpha: 0.6 },
]);

interface ScenePoint {
  x: number;
  y: number;
  z: number;
}

function coordinateKey(coordinate: GalaxyCoordinate): string {
  return `${coordinate.sectorX}:${coordinate.sectorY}:${coordinate.localX}:${coordinate.localY}`;
}

function samplePath(path: readonly ScenePoint[], t: number): ScenePoint {
  if (path.length === 0) return { x: 0, y: 0, z: 0 };
  const clamped = Math.min(1, Math.max(0, t));
  const position = clamped * (path.length - 1);
  const index = Math.min(path.length - 2, Math.floor(position));
  if (index < 0) return path[0];
  const fraction = position - index;
  const from = path[index];
  const to = path[index + 1];
  return {
    x: from.x + (to.x - from.x) * fraction,
    y: from.y + (to.y - from.y) * fraction,
    z: from.z + (to.z - from.z) * fraction,
  };
}

/** Quadratic arc between two 3D points, lifted by distance so routes read as flight paths. */
function arcPath(from: ScenePoint, to: ScenePoint, segments = 28): ScenePoint[] {
  const distance = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  const control = {
    x: (from.x + to.x) / 2,
    y: Math.max(from.y, to.y) + 0.35 + distance * 0.08,
    z: (from.z + to.z) / 2,
  };
  const points: ScenePoint[] = [];
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const c = t * t;
    points.push({
      x: a * from.x + b * control.x + c * to.x,
      y: a * from.y + b * control.y + c * to.y,
      z: a * from.z + b * control.z + c * to.z,
    });
  }
  return points;
}

/** Where along the 2D leg the vessel sits, 0 … 1. */
function legProgress(leg: SectorRouteLeg, at: GalaxyCoordinate): number {
  const dx = leg.to.localX - leg.from.localX;
  const dy = leg.to.localY - leg.from.localY;
  const length = dx * dx + dy * dy;
  if (length === 0) return 1;
  return Math.min(1, Math.max(0, ((at.localX - leg.from.localX) * dx + (at.localY - leg.from.localY) * dy) / length));
}

/**
 * Babylon sector field in a cinematic deep-space style: seeded sky, dust plane, layered
 * nebulae, class-coloured stars floating at decorative heights with drop lines to the plane,
 * threat haze, and glowing route arcs. Every `@babylonjs` import stays inside this function
 * so the module loads during server rendering without touching WebGL. Wheel and pinch are
 * removed: zoom belongs to the atlas reducer, not the camera.
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
    { MeshBuilder },
    { StandardMaterial },
    { GlowLayer },
    { Color3, Color4 },
    { Vector3, Matrix },
    { DynamicTexture },
    { SpriteManager },
    { Sprite },
    { Mesh },
    { VertexData },
  ] = await Promise.all([
    import("@babylonjs/core/Engines/engine"),
    import("@babylonjs/core/scene"),
    import("@babylonjs/core/Cameras/arcRotateCamera"),
    import("@babylonjs/core/Meshes/meshBuilder"),
    import("@babylonjs/core/Materials/standardMaterial"),
    import("@babylonjs/core/Layers/glowLayer"),
    import("@babylonjs/core/Maths/math.color"),
    import("@babylonjs/core/Maths/math.vector"),
    import("@babylonjs/core/Materials/Textures/dynamicTexture"),
    import("@babylonjs/core/Sprites/spriteManager"),
    import("@babylonjs/core/Sprites/sprite"),
    import("@babylonjs/core/Meshes/mesh"),
    import("@babylonjs/core/Meshes/mesh.vertexData"),
  ]);
  await Promise.all([
    import("@babylonjs/core/Meshes/Builders/sphereBuilder"),
    import("@babylonjs/core/Meshes/Builders/groundBuilder"),
    import("@babylonjs/core/Meshes/Builders/linesBuilder"),
    import("@babylonjs/core/Meshes/Builders/torusBuilder"),
    import("@babylonjs/core/Meshes/Builders/polyhedronBuilder"),
    import("@babylonjs/core/Meshes/Builders/tubeBuilder"),
    import("@babylonjs/core/Behaviors/Cameras/autoRotationBehavior"),
    import("@babylonjs/core/Culling/ray"),
  ]);

  type Material = InstanceType<typeof StandardMaterial>;
  type Texture = InstanceType<typeof DynamicTexture>;
  type AnyMesh = { dispose: () => void; isPickable: boolean };

  const engine = new Engine(gl, true, { stencil: true, antialias: true, adaptToDeviceRatio: false }, false);
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.004, 0.008, 0.02, 1);

  const camera = new ArcRotateCamera("sector-atlas", -Math.PI / 2.4, 1.02, 60, Vector3.Zero(), scene);
  camera.lowerRadiusLimit = 8;
  camera.upperRadiusLimit = 60;
  camera.lowerBetaLimit = 0.55;
  camera.upperBetaLimit = 1.32;
  camera.minZ = 0.05;
  camera.maxZ = 400;
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

  // Filmic grade applied in every material: ACES tone mapping, a little contrast, a soft vignette.
  const grade = scene.imageProcessingConfiguration;
  grade.toneMappingEnabled = true;
  grade.toneMappingType = 1;
  grade.exposure = 1.25;
  grade.contrast = 1.12;
  grade.vignetteEnabled = true;
  grade.vignetteWeight = 1.6;
  grade.vignetteStretch = 0.5;
  grade.vignetteColor = new Color4(0, 0, 0.02, 0);
  grade.vignetteCameraFov = camera.fov;

  const glow = new GlowLayer("sector-glow", scene, { blurKernelSize: 32 });
  glow.intensity = 0.8;

  const paintTexture = (
    name: string,
    width: number,
    height: number,
    paint: (context: CanvasRenderingContext2D) => void,
    hasAlpha: boolean,
  ): Texture => {
    const texture = new DynamicTexture(name, { width, height }, scene, true);
    paint(texture.getContext() as unknown as CanvasRenderingContext2D);
    texture.hasAlpha = hasAlpha;
    texture.update();
    return texture;
  };

  const spriteSheet = (size: number, paint: (context: CanvasRenderingContext2D, size: number) => void): string => {
    const surface = document.createElement("canvas");
    surface.width = size;
    surface.height = size;
    const context = surface.getContext("2d");
    if (!context) return "";
    paint(context, size);
    return surface.toDataURL("image/png");
  };

  const additiveMaterial = (name: string, texture: Texture, alpha: number): Material => {
    const material = new StandardMaterial(name, scene);
    material.disableLighting = true;
    material.diffuseColor = Color3.Black();
    material.specularColor = Color3.Black();
    material.emissiveTexture = texture;
    material.opacityTexture = texture;
    material.alpha = alpha;
    material.alphaMode = ALPHA_ADD;
    material.disableDepthWrite = true;
    material.backFaceCulling = false;
    return material;
  };

  // --- Static backdrop -----------------------------------------------------------------------

  const skyTexture = paintTexture("sky", 2048, 1024, context => paintSky(context, 2048, 1024, createRandom(SKY_SEED)), false);
  const skyMaterial = new StandardMaterial("sky", scene);
  skyMaterial.disableLighting = true;
  skyMaterial.diffuseColor = Color3.Black();
  skyMaterial.specularColor = Color3.Black();
  skyMaterial.emissiveTexture = skyTexture;
  skyMaterial.backFaceCulling = false;
  skyMaterial.disableDepthWrite = true;
  const sky = MeshBuilder.CreateSphere("sky", { diameter: 360, segments: 32, sideOrientation: Mesh.BACKSIDE }, scene);
  sky.material = skyMaterial;
  sky.infiniteDistance = true;
  sky.isPickable = false;

  // Near dust stars scattered through the sector volume give parallax when the camera orbits.
  const dustRandom = createRandom(DUST_SEED ^ 0x77);
  const dustCount = 900;
  const dustPositions: number[] = [];
  const dustColors: number[] = [];
  const dustIndices: number[] = [];
  const dustTints = [[1, 1, 1], [0.8, 0.86, 1], [1, 0.93, 0.82], [0.72, 0.8, 1]];
  for (let index = 0; index < dustCount; index += 1) {
    const spread = SECTOR_SCENE_SIZE * 0.85;
    dustPositions.push(
      (dustRandom() * 2 - 1) * spread,
      (dustRandom() + dustRandom() + dustRandom() - 1.5) * 3.6,
      (dustRandom() * 2 - 1) * spread,
    );
    const tint = dustTints[Math.floor(dustRandom() * dustTints.length)];
    const brightness = 0.12 + dustRandom() * dustRandom() * 0.55;
    dustColors.push(tint[0], tint[1], tint[2], brightness);
    dustIndices.push(index);
  }
  const dustStars = new Mesh("dust-stars", scene);
  const dustData = new VertexData();
  dustData.positions = dustPositions;
  dustData.colors = dustColors;
  dustData.indices = dustIndices;
  dustData.applyToMesh(dustStars);
  dustStars.hasVertexAlpha = true;
  dustStars.isPickable = false;
  const dustStarMaterial = new StandardMaterial("dust-stars", scene);
  dustStarMaterial.disableLighting = true;
  dustStarMaterial.diffuseColor = Color3.Black();
  dustStarMaterial.specularColor = Color3.Black();
  dustStarMaterial.emissiveColor = Color3.White();
  dustStarMaterial.pointsCloud = true;
  dustStarMaterial.pointSize = 1.6;
  dustStarMaterial.alphaMode = ALPHA_ADD;
  dustStarMaterial.disableDepthWrite = true;
  dustStars.material = dustStarMaterial;

  // The galactic plane: patchy dust instead of a solid disc and wireframe.
  const dustTexture = paintTexture("dust-plane", 1024, 1024, context => paintDustField(context, 1024, createRandom(DUST_SEED)), true);
  const dustPlane = MeshBuilder.CreateGround("dust-plane", {
    width: SECTOR_SCENE_SIZE * 1.6,
    height: SECTOR_SCENE_SIZE * 1.6,
  }, scene);
  dustPlane.position.y = -0.04;
  dustPlane.material = additiveMaterial("dust-plane", dustTexture, 1);
  dustPlane.isPickable = false;

  NEBULA_LAYERS.forEach((layer, index) => {
    const texture = paintTexture(
      `nebula-${index}`,
      512,
      512,
      context => paintNebula(context, 512, createRandom(NEBULA_SEED + index * 977), NEBULA_PALETTES[layer.palette]),
      true,
    );
    const plane = MeshBuilder.CreateGround(`nebula-${index}`, { width: layer.size, height: layer.size }, scene);
    plane.position.set(layer.x, layer.y, layer.z);
    plane.rotation.y = layer.rotation;
    plane.material = additiveMaterial(`nebula-${index}`, texture, layer.alpha);
    plane.isPickable = false;
  });

  // A whisper of a reference grid, the sector frame and corner ticks, all in one line system.
  const half = SECTOR_SCENE_SIZE / 2;
  const cell = cellSceneSize();
  const steps = Math.max(1, Math.round(SECTOR_SCENE_SIZE / cell));
  const gridLines: BabylonVector3[][] = [];
  const gridColors: InstanceType<typeof Color4>[][] = [];
  const pushLine = (points: BabylonVector3[], color: InstanceType<typeof Color4>) => {
    gridLines.push(points);
    gridColors.push(points.map(() => color));
  };
  const gridColor = new Color4(0.55, 0.72, 0.85, 0.045);
  for (let index = 1; index < steps; index += 1) {
    const offset = -half + index * cell;
    pushLine([new Vector3(-half, 0, offset), new Vector3(half, 0, offset)], gridColor);
    pushLine([new Vector3(offset, 0, -half), new Vector3(offset, 0, half)], gridColor);
  }
  const frameColor = new Color4(0.62, 0.8, 0.9, 0.2);
  pushLine([
    new Vector3(-half, 0, -half), new Vector3(half, 0, -half), new Vector3(half, 0, half),
    new Vector3(-half, 0, half), new Vector3(-half, 0, -half),
  ], frameColor);
  const tickColor = new Color4(0.75, 0.92, 0.98, 0.6);
  const tick = cell * 0.7;
  for (const [cx, cz] of [[-half, -half], [half, -half], [half, half], [-half, half]]) {
    const sx = cx < 0 ? 1 : -1;
    const sz = cz < 0 ? 1 : -1;
    pushLine([new Vector3(cx + sx * tick, 0, cz), new Vector3(cx, 0, cz), new Vector3(cx, 0, cz + sz * tick)], tickColor);
  }
  const grid = MeshBuilder.CreateLineSystem("grid", { lines: gridLines, colors: gridColors, useVertexAlpha: true }, scene);
  grid.isPickable = false;

  // Capacities cover the worst case with headroom: one halo per star, haze per threatened star,
  // a beacon per colony, three packets per planned or active leg, plus vessel and blind halos.
  // The dense-sector fixture (~94 stars) uses about 200-300 glow and under 100 flare slots.
  // Babylon silently drops sprites past capacity, so raise these if sectors grow denser.
  const glowSprites = new SpriteManager("sector-glow-sprites", spriteSheet(128, paintGlow), 720, { width: 128, height: 128 }, scene);
  glowSprites.blendMode = ALPHA_ADD;
  glowSprites.disableDepthWrite = true;
  glowSprites.isPickable = false;
  const flareSprites = new SpriteManager("sector-flare-sprites", spriteSheet(256, paintFlare), 260, { width: 256, height: 256 }, scene);
  flareSprites.blendMode = ALPHA_ADD;
  flareSprites.disableDepthWrite = true;
  flareSprites.isPickable = false;

  const selectionMaterial = new StandardMaterial("selection", scene);
  selectionMaterial.disableLighting = true;
  selectionMaterial.emissiveColor = new Color3(0.86, 0.98, 0.95);
  selectionMaterial.alpha = 0.95;
  const selectionRing = MeshBuilder.CreateTorus("selection", { diameter: 0.72, thickness: 0.016, tessellation: 48 }, scene);
  selectionRing.material = selectionMaterial;
  selectionRing.isPickable = false;
  selectionRing.setEnabled(false);
  glow.addIncludedOnlyMesh(selectionRing);

  // --- Dynamic state ---------------------------------------------------------------------------

  type Anchor = {
    id: string;
    mesh: { position: BabylonVector3 };
    material: Material;
    baseEmissive: BabylonColor3;
    diameter: number;
  };
  type Sprite = BabylonSprite;

  let disposed = false;
  let reduced = false;
  let spinPaused = false;
  let level: "galaxy" | "sector" = "sector";
  let pickingEnabled = true;
  let builtKey = "";
  let focusedId: string | null = null;
  let pulse = 0;
  let storedTarget: ScenePoint = { x: 0, y: 0, z: 0 };
  let storedCenter: GalaxyCoordinate | null = null;
  let insetTarget = 0;
  let insetCurrent = 0;
  let insetPrimed = false;
  let storedRadius = 60;
  const listeners = new Set<(projected: ProjectedLandmark[]) => void>();
  const anchors = new Map<string, Anchor>();
  const heights = new Map<string, number>();
  let markers: { id: string; mesh: { position: BabylonVector3 } }[] = [];
  let dynamicMeshes: AnyMesh[] = [];
  let dynamicMaterials: { dispose: () => void }[] = [];
  let dynamicSprites: Sprite[] = [];
  let glowMeshes: InstanceType<typeof Mesh>[] = [];
  let twinkles: { sprite: Sprite; base: number; phase: number }[] = [];
  let hazes: { sprite: Sprite; base: number; phase: number }[] = [];
  let flickers: { material: Material; sprite: Sprite; phase: number }[] = [];
  let packets: { sprite: Sprite; path: ScenePoint[]; offset: number; speed: number }[] = [];
  let beacons: { sprite: Sprite; center: ScenePoint; radius: number; phase: number }[] = [];
  let activeTubes: Material[] = [];
  let flares: { sprite: Sprite; base: number }[] = [];
  let scaledMeshes: { scaling: BabylonVector3 }[] = [];
  let fixedSprites: { sprite: Sprite; base: number }[] = [];
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

  const trackMesh = <T extends AnyMesh>(mesh: T): T => {
    mesh.isPickable = false;
    dynamicMeshes.push(mesh);
    return mesh;
  };
  const trackMaterial = <T extends { dispose: () => void }>(material: T): T => {
    dynamicMaterials.push(material);
    return material;
  };
  const glowMesh = <T extends InstanceType<typeof Mesh>>(mesh: T): T => {
    glow.addIncludedOnlyMesh(mesh);
    glowMeshes.push(mesh);
    return mesh;
  };
  const addSprite = (
    manager: InstanceType<typeof SpriteManager>,
    name: string,
    position: ScenePoint,
    size: number,
    color: BabylonColor3,
    alpha: number,
  ): Sprite => {
    const sprite = new Sprite(name, manager);
    sprite.position = new Vector3(position.x, position.y, position.z);
    sprite.size = size;
    sprite.color = new Color4(color.r, color.g, color.b, alpha);
    sprite.isPickable = false;
    dynamicSprites.push(sprite);
    return sprite;
  };

  const clearDynamic = () => {
    selectionRing.parent = null;
    selectionRing.setEnabled(false);
    for (const mesh of glowMeshes) glow.removeIncludedOnlyMesh(mesh);
    for (const sprite of dynamicSprites) sprite.dispose();
    for (const mesh of dynamicMeshes) mesh.dispose();
    for (const material of dynamicMaterials) material.dispose();
    dynamicMeshes = [];
    dynamicMaterials = [];
    dynamicSprites = [];
    glowMeshes = [];
    twinkles = [];
    hazes = [];
    flickers = [];
    packets = [];
    beacons = [];
    activeTubes = [];
    flares = [];
    scaledMeshes = [];
    fixedSprites = [];
    anchors.clear();
    heights.clear();
    markers = [];
  };

  const paintFocus = () => {
    for (const anchor of anchors.values()) anchor.material.emissiveColor.copyFrom(anchor.baseEmissive);
    const anchor = focusedId ? anchors.get(focusedId) ?? null : null;
    if (!anchor) {
      selectionRing.parent = null;
      selectionRing.setEnabled(false);
      return;
    }
    anchor.material.emissiveColor.copyFrom(Color3.Lerp(anchor.baseEmissive, Color3.White(), 0.5));
    selectionRing.parent = anchor.mesh as never;
    selectionRing.position.set(0, 0, 0);
    const scale = Math.max(1, (anchor.diameter + 0.5) / 0.72);
    selectionRing.scaling.set(scale, scale, scale);
    selectionRing.setEnabled(true);
  };

  const bandColor = (band: ThreatBand) => Color3.FromHexString(BAND_HEX[band]);
  const pointFor = (coordinate: GalaxyCoordinate): ScenePoint => {
    const flat = toScene(coordinate);
    return { x: flat.x, y: heights.get(coordinateKey(coordinate)) ?? 0, z: flat.z };
  };
  const toVector = (point: ScenePoint) => new Vector3(point.x, point.y, point.z);

  const emissiveMaterial = (name: string, color: BabylonColor3, alpha = 1): Material => {
    const material = trackMaterial(new StandardMaterial(name, scene));
    material.disableLighting = true;
    material.diffuseColor = Color3.Black();
    material.specularColor = Color3.Black();
    material.emissiveColor = color.clone();
    material.alpha = alpha;
    return material;
  };

  const addFlatRing = (name: string, center: ScenePoint, diameter: number, color: BabylonColor3, alpha: number) => {
    const ring = trackMesh(MeshBuilder.CreateTorus(name, { diameter, thickness: 0.014, tessellation: 48 }, scene));
    ring.material = emissiveMaterial(name, color, alpha);
    ring.position.set(center.x, center.y, center.z);
    glowMesh(ring);
    scaledMeshes.push(ring);
    return ring;
  };

  const addLeg = (leg: SectorRouteLeg, name: string) => {
    const from = pointFor(leg.from);
    const to = pointFor(leg.to);
    if (Math.hypot(to.x - from.x, to.z - from.z) < 1e-4) return;
    const path = arcPath(from, to);
    const color = bandColor(leg.band);
    if (leg.state === "pending") {
      const dashed = trackMesh(MeshBuilder.CreateDashedLines(name, {
        points: path.map(toVector),
        dashNb: 40,
        dashSize: 2,
        gapSize: 1.6,
      }, scene));
      dashed.color = color;
      dashed.alpha = 0.5;
      return;
    }
    const radius = leg.state === "active" ? 0.028 : leg.state === "planned" ? 0.022 : 0.014;
    const alpha = leg.state === "done" ? 0.35 : leg.state === "active" ? 0.9 : 0.75;
    const tube = trackMesh(MeshBuilder.CreateTube(name, { path: path.map(toVector), radius, tessellation: 10 }, scene));
    const material = emissiveMaterial(name, Color3.Lerp(color, Color3.White(), 0.18), alpha);
    tube.material = material;
    glowMesh(tube);
    if (leg.state === "active") activeTubes.push(material);
    if (leg.state === "planned" || leg.state === "active") {
      const packetColor = Color3.Lerp(color, Color3.White(), 0.55);
      for (let index = 0; index < 3; index += 1) {
        const offset = index / 3;
        const sprite = addSprite(glowSprites, `${name}-packet-${index}`, samplePath(path, offset), 0.5, packetColor, 0.95);
        packets.push({ sprite, path, offset, speed: leg.state === "active" ? 0.24 : 0.14 });
        fixedSprites.push({ sprite, base: 0.5 });
      }
    }
  };

  const setModel = (model: SectorModel) => {
    if (disposed || model.key === builtKey) return;
    builtKey = model.key;
    clearDynamic();

    for (const star of model.stars) heights.set(coordinateKey(star.coordinate), star.elevation * ELEVATION_SCALE);

    const dropLines: BabylonVector3[][] = [];
    const dropColors: InstanceType<typeof Color4>[][] = [];
    const pushDrop = (points: BabylonVector3[], color: BabylonColor3, alpha: number) => {
      dropLines.push(points);
      dropColors.push(points.map(() => new Color4(color.r, color.g, color.b, alpha)));
    };
    const footCircle = (center: ScenePoint, radius: number) => {
      const points: BabylonVector3[] = [];
      for (let index = 0; index <= 20; index += 1) {
        const angle = (index / 20) * Math.PI * 2;
        points.push(new Vector3(center.x + Math.cos(angle) * radius, 0.004, center.z + Math.sin(angle) * radius));
      }
      return points;
    };

    for (const star of model.stars) {
      const position = pointFor(star.coordinate);
      const signal = star.knowledge === "signal";
      const visited = star.knowledge === "visited";
      const glowColor = Color3.FromHexString(star.starClass ? GLOW_HEX[star.starClass] : SIGNAL_HEX);
      const coreColor = star.starClass
        ? Color3.Lerp(Color3.FromHexString(STAR_COLORS[star.starClass]), Color3.White(), 0.3)
        : glowColor;
      const diameter = visited ? 0.2 : signal ? 0.09 : 0.15;
      const phase = (star.elevation + 1) * 7.31;

      const material = emissiveMaterial(`core-${star.targetId}`, coreColor, signal ? 0.55 : 1);
      const core = trackMesh(MeshBuilder.CreateSphere(`core-${star.targetId}`, { diameter, segments: 12 }, scene));
      core.material = material;
      core.position.set(position.x, position.y, position.z);
      glowMesh(core);
      scaledMeshes.push(core);

      const haloSize = visited ? 2.7 : signal ? 1.05 : 1.85;
      const halo = addSprite(glowSprites, `halo-${star.targetId}`, position, haloSize, glowColor, visited ? 0.95 : signal ? 0.4 : 0.78);
      twinkles.push({ sprite: halo, base: haloSize, phase });
      if (signal) flickers.push({ material, sprite: halo, phase });
      else {
        const flareSize = visited ? 4.4 : 2.4;
        flares.push({ sprite: addSprite(flareSprites, `flare-${star.targetId}`, position, flareSize, glowColor, visited ? 0.5 : 0.18), base: flareSize });
      }

      const threatRank = BAND_RANK[star.threat];
      if (threatRank >= 2) {
        const hazeSize = 3.4 + threatRank * 0.9;
        const haze = addSprite(glowSprites, `haze-${star.targetId}`, position, hazeSize, bandColor(star.threat), 0.12 + threatRank * 0.045);
        hazes.push({ sprite: haze, base: hazeSize, phase });
      }

      pushDrop([new Vector3(position.x, position.y, position.z), new Vector3(position.x, 0, position.z)], glowColor, signal ? 0.12 : 0.3);
      pushDrop(footCircle(position, signal ? 0.08 : 0.13), glowColor, signal ? 0.18 : 0.5);

      if (star.colonies > 0) {
        const gold = Color3.FromHexString(COLONY_HEX);
        addFlatRing(`colony-${star.targetId}`, position, 0.64, gold, 0.9);
        const beacon = addSprite(glowSprites, `beacon-${star.targetId}`, position, 0.34, gold, 1);
        beacons.push({ sprite: beacon, center: position, radius: 0.32, phase });
        fixedSprites.push({ sprite: beacon, base: 0.34 });
      }

      const anchor: Anchor = { id: star.targetId, mesh: core, material, baseEmissive: material.emissiveColor.clone(), diameter };
      if (!anchors.has(star.targetId)) anchors.set(star.targetId, anchor);
      markers.push({ id: star.targetId, mesh: core });
    }

    if (model.route) {
      model.route.legs.forEach((leg, index) => addLeg(leg, `route-${index}`));
      const destination = pointFor(model.route.destination);
      addFlatRing("route-destination", destination, 1 + BAND_RANK[model.route.band] * 0.16, bandColor(model.route.band), 0.75);
    }
    if (model.travel) {
      model.travel.legs.forEach((leg, index) => addLeg(leg, `travel-${index}`));
      const last = model.travel.legs[model.travel.legs.length - 1];
      if (last) {
        const band = model.travel.legs.reduce<ThreatBand>(
          (best, leg) => (BAND_RANK[leg.band] > BAND_RANK[best] ? leg.band : best),
          "unknown",
        );
        addFlatRing("travel-destination", pointFor(last.to), 1 + BAND_RANK[band] * 0.16, bandColor(band), 0.75);
      }
    }

    // The vessel parks just above its star, or rides the active arc while in transit.
    const activeLeg = model.travel?.legs.find(leg => leg.state === "active") ?? null;
    let vesselPoint: ScenePoint;
    if (model.vessel.status === "in_transit" && activeLeg) {
      const along = samplePath(arcPath(pointFor(activeLeg.from), pointFor(activeLeg.to)), legProgress(activeLeg, model.vessel.coordinate));
      vesselPoint = { x: along.x, y: along.y + 0.12, z: along.z };
    } else {
      const base = pointFor(model.vessel.coordinate);
      vesselPoint = { x: base.x, y: base.y + 0.42, z: base.z };
    }
    const vesselWarning = model.vessel.status === "stranded";
    const vesselColor = vesselWarning ? new Color3(1, 0.42, 0.48) : new Color3(0.9, 0.97, 1);
    const vesselMaterial = emissiveMaterial("vessel", vesselColor);
    const vessel = trackMesh(MeshBuilder.CreatePolyhedron("vessel", { type: 1, size: 0.1 }, scene));
    vessel.material = vesselMaterial;
    vessel.position.set(vesselPoint.x, vesselPoint.y, vesselPoint.z);
    glowMesh(vessel);
    scaledMeshes.push(vessel);
    fixedSprites.push({ sprite: addSprite(glowSprites, "vessel-halo", vesselPoint, 0.95, vesselWarning ? vesselColor : new Color3(0.6, 0.92, 1), 0.9), base: 0.95 });
    anchors.set("vessel", { id: "vessel", mesh: vessel, material: vesselMaterial, baseEmissive: vesselMaterial.emissiveColor.clone(), diameter: 0.3 });
    markers.push({ id: "vessel", mesh: vessel });

    if (model.blindTarget) {
      const point = toScene(model.blindTarget);
      const color = Color3.FromHexString(BLIND_HEX);
      const arm = 0.42;
      pushDrop([new Vector3(point.x - arm, 0.01, point.z), new Vector3(point.x + arm, 0.01, point.z)], color, 0.9);
      pushDrop([new Vector3(point.x, 0.01, point.z - arm), new Vector3(point.x, 0.01, point.z + arm)], color, 0.9);
      pushDrop([new Vector3(point.x, 0, point.z), new Vector3(point.x, 1.8, point.z)], color, 0.35);
      const material = emissiveMaterial("blind-core", color, 0.95);
      const mesh = trackMesh(MeshBuilder.CreateSphere("blind-core", { diameter: 0.08, segments: 8 }, scene));
      mesh.material = material;
      mesh.position.set(point.x, 0.02, point.z);
      glowMesh(mesh);
      scaledMeshes.push(mesh);
      fixedSprites.push({ sprite: addSprite(glowSprites, "blind-halo", { x: point.x, y: 0.02, z: point.z }, 0.9, color, 0.6), base: 0.9 });
      const anchor: Anchor = { id: "blind", mesh, material, baseEmissive: material.emissiveColor.clone(), diameter: 0.2 };
      anchors.set("blind", anchor);
      markers.push({ id: "blind", mesh });
      const targetId = selectedTargetIdFor({ kind: "coordinate", coordinate: model.blindTarget });
      if (!anchors.has(targetId)) anchors.set(targetId, anchor);
    }

    if (dropLines.length > 0) {
      trackMesh(MeshBuilder.CreateLineSystem("drops", { lines: dropLines, colors: dropColors, useVertexAlpha: true }, scene));
    }
    paintFocus();

    // Heights may have changed under the current centre (a star became known there).
    if (storedCenter) {
      const aim = pointFor(storedCenter);
      if (Math.abs(aim.y - storedTarget.y) > 1e-3) {
        storedTarget = aim;
        if (level === "sector") void glide(storedTarget, storedRadius, reduced ? 0 : GLIDE_MS);
      }
    }
  };

  const project = (): ProjectedLandmark[] => {
    const scaling = engine.getHardwareScalingLevel();
    const width = engine.getRenderWidth();
    const height = engine.getRenderHeight();
    const viewport = camera.viewport.toGlobal(width, height);
    const transform = scene.getTransformMatrix();
    const identity = Matrix.Identity();
    return markers.map(marker => {
      const point = Vector3.Project(marker.mesh.position, identity, transform, viewport);
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

  /**
   * Stars keep a readable size on screen: sprites and markers grow with camera distance so the
   * far sector view is not a scatter of pinpricks, and shrink back when the camera closes in.
   */
  const distanceScale = () => Math.min(2.6, Math.max(0.8, camera.radius / 20));

  const animate = () => {
    const scale = distanceScale();
    for (const twinkle of twinkles) {
      const shimmer = reduced ? 1 : 1 + 0.05 * Math.sin(pulse * 1.9 + twinkle.phase);
      twinkle.sprite.size = twinkle.base * scale * shimmer;
    }
    for (const flare of flares) flare.sprite.size = flare.base * scale;
    for (const fixed of fixedSprites) fixed.sprite.size = fixed.base * scale;
    for (const mesh of scaledMeshes) mesh.scaling.setAll(scale);
    const hazeScale = 0.6 + 0.4 * scale;
    for (const haze of hazes) {
      const breathe = reduced ? 1 : 1 + 0.08 * Math.sin(pulse * 1.15 + haze.phase);
      haze.sprite.size = haze.base * hazeScale * breathe;
    }
    for (const flicker of flickers) {
      const alpha = reduced ? 0.5 : 0.3 + 0.28 * (0.5 + 0.5 * Math.sin(pulse * 6 + flicker.phase));
      flicker.material.alpha = alpha;
      flicker.sprite.color.a = alpha * 0.8;
    }
    for (const packet of packets) {
      const t = reduced ? packet.offset + 1 / 6 : (packet.offset + pulse * packet.speed) % 1;
      const point = samplePath(packet.path, t);
      packet.sprite.position.set(point.x, point.y, point.z);
    }
    for (const beacon of beacons) {
      const angle = reduced ? beacon.phase : beacon.phase + pulse * 0.7;
      beacon.sprite.position.set(
        beacon.center.x + Math.cos(angle) * beacon.radius * scale,
        beacon.center.y,
        beacon.center.z + Math.sin(angle) * beacon.radius * scale,
      );
    }
    const activeAlpha = reduced ? 0.9 : 0.5 + 0.4 * (0.5 + 0.5 * Math.sin(pulse * 4));
    for (const material of activeTubes) material.alpha = activeAlpha;
  };

  /**
   * Shift the camera target on screen so the view centres in the area an overlay panel leaves
   * free. The offset lives in the view matrix, so picking and landmark projection follow it.
   * World units per CSS pixel at the target depth come from the vertical field of view.
   */
  const applyViewInset = (dt: number) => {
    insetCurrent = reduced || Math.abs(insetTarget - insetCurrent) < 0.5
      ? insetTarget
      : insetCurrent + (insetTarget - insetCurrent) * Math.min(1, dt * 8);
    const cssHeight = engine.getRenderHeight() * engine.getHardwareScalingLevel();
    const unitsPerPixel = (2 * camera.radius * Math.tan(camera.fov / 2)) / Math.max(1, cssHeight);
    camera.targetScreenOffset.x = -(insetCurrent / 2) * unitsPerPixel;
  };

  engine.runRenderLoop(() => {
    if (disposed) return;
    const dt = Math.min(0.05, engine.getDeltaTime() / 1000);
    if (!reduced) pulse += dt;
    applyViewInset(dt);
    animate();
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
    && Math.abs(camera.target.y - target.y) < 0.01
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
      // Aim at the star's own height when the view is centred on one, so close zooms frame it.
      storedCenter = { ...center };
      storedTarget = pointFor(center);
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
    setViewInset(rightPx) {
      insetTarget = Number.isFinite(rightPx) ? Math.max(0, rightPx) : 0;
      // The first measurement lands at once so the map does not slide in on open; later
      // changes (panel toggle, resize) ease.
      if (!insetPrimed) {
        insetCurrent = insetTarget;
        insetPrimed = true;
      }
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

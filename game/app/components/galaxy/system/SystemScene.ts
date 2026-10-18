import type { PlanetId } from "../../engine/types";
import type { PlanetBiome } from "../../colony/shared/colonyTypes";
import { BIOME_PALETTES } from "../../colony/meta/regionMapTerrain";
import {
  ATLAS_SKY_SEED,
  COLONY_GOLD_HEX,
  createRandom,
  paintFlare,
  paintGlow,
  paintSky,
  SIGNAL_GLOW_HEX,
  STAR_GLOW_HEX,
} from "../sector/sectorArt";
import {
  planetScenePosition,
  STAR_COLORS,
  type StarSystem,
  type SystemNeighbour,
  type SystemPlanet,
} from "./starSystems";
import { paintEclipticDust, paintPlanetSurface } from "./systemArt";
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
  /**
   * Fly towards a neighbour, then rebuild around it. The caller supplies the system and its
   * neighbours, waits for the promise, and holds `setSystem` and further glides until it settles
   * (a second call while gliding returns the running glide).
   */
  glideToSystem(next: StarSystem, neighbours: readonly SystemNeighbour[]): Promise<void>;
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
 * Points already inside the ellipse stay where they are so the landmark sits on its dot,
 * unless `force` is set: then every point moves onto the ring in its own direction.
 */
export function pinToEdgeRing(
  px: number,
  py: number,
  width: number,
  height: number,
  inFront: boolean,
  scaling: number,
  force = false,
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
  if (norm <= 1 && !force) return { x: cx + dx, y: cy + dy, pinned: false, angle: 0 };
  const angle = Math.atan2(dy / ry, dx / rx);
  return { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry, pinned: true, angle };
}

/** Minimum CSS-pixel gap between two pinned landmarks so their labels never collide. */
const PIN_MIN_GAP = 120;

/** Relaxation passes: enough to settle six neighbours bunched on one bearing (the cap). */
const SPREAD_PASSES = 48;

/**
 * Push pinned landmarks apart along the edge ring when two neighbours share a bearing.
 * Works on the ellipse parameter angle.
 */
export function spreadAlongRing(entries: { angle: number }[], rx: number, ry: number, minGap: number): void {
  if (entries.length < 2) return;
  entries.sort((left, right) => left.angle - right.angle);
  const minAngle = Math.min(Math.PI * 2 / entries.length, minGap / ((rx + ry) / 2));
  for (let pass = 0; pass < SPREAD_PASSES; pass += 1) {
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
/** Babylon `Constants.ALPHA_ADD`; a literal so the module stays free of static Babylon imports. */
const ALPHA_ADD = 1;
const DUST_SEED = 0x51a7e5;
/** Lanes start past the outermost orbit (4.5) so they point outward without crossing the planets. */
const LANE_START = 5;
/** Vertical field of view on wide charts, and the aspect below which the width is held instead. */
const CAMERA_FOV = 0.8;
const WIDE_ASPECT = 1.8;
/** Planets draw larger than their catalogue radius so their surfaces read at the default zoom. */
const PLANET_SCALE = 1.3;

/** Map a flat-plan bearing onto the scene XZ plane, 7.5 units from the star. */
function neighbourScenePosition(bearing: number): { x: number; y: number; z: number } {
  const edge = clampToEdgeRing(bearing);
  const x = (edge.x - 50) / NEIGHBOUR_RING_PERCENT;
  const z = (edge.y - 50) / (NEIGHBOUR_RING_PERCENT * PLAN_TILT);
  const length = Math.hypot(x, z) || 1;
  return { x: (x / length) * NEIGHBOUR_DISTANCE, y: 0, z: (z / length) * NEIGHBOUR_DISTANCE };
}

function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Babylon system view in the same cinematic style as the sector field: seeded sky, dust-star
 * shell, ecliptic dust, a class-coloured star with glow and flare, textured planets with an
 * atmosphere rim, faint orbits, and neighbour glows with lanes. Every `@babylonjs` import is
 * inside this function so the module can load during server rendering without touching WebGL.
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
    { DynamicTexture },
    { SpriteManager },
    { Sprite },
    { Mesh },
    { VertexData },
    { TransformNode },
    { FresnelParameters },
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
    import("@babylonjs/core/Materials/Textures/dynamicTexture"),
    import("@babylonjs/core/Sprites/spriteManager"),
    import("@babylonjs/core/Sprites/sprite"),
    import("@babylonjs/core/Meshes/mesh"),
    import("@babylonjs/core/Meshes/mesh.vertexData"),
    import("@babylonjs/core/Meshes/transformNode"),
    import("@babylonjs/core/Materials/fresnelParameters"),
  ]);
  await Promise.all([
    import("@babylonjs/core/Meshes/Builders/sphereBuilder"),
    import("@babylonjs/core/Meshes/Builders/groundBuilder"),
    import("@babylonjs/core/Meshes/Builders/linesBuilder"),
    import("@babylonjs/core/Meshes/Builders/torusBuilder"),
    import("@babylonjs/core/Behaviors/Cameras/autoRotationBehavior"),
  ]);

  type Material = InstanceType<typeof StandardMaterial>;
  type Texture = InstanceType<typeof DynamicTexture>;
  type BabylonColor3 = InstanceType<typeof Color3>;
  type BabylonSprite = InstanceType<typeof Sprite>;
  type Node = InstanceType<typeof TransformNode>;
  type AnyMesh = { dispose: () => void; isPickable: boolean };
  type ScenePoint = { x: number; y: number; z: number };

  const engine = new Engine(gl, true, { stencil: true, antialias: true, adaptToDeviceRatio: false }, false);
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.004, 0.008, 0.02, 1);

  const camera = new ArcRotateCamera("system-atlas", -Math.PI / 2, 1.1, 9, Vector3.Zero(), scene);
  camera.fov = CAMERA_FOV;
  camera.lowerRadiusLimit = 6;
  camera.upperRadiusLimit = 16;
  camera.lowerBetaLimit = 0.9;
  camera.upperBetaLimit = 1.35;
  camera.minZ = 0.05;
  camera.maxZ = 160;
  camera.wheelPrecision = 50;
  camera.pinchPrecision = 180;
  camera.panningSensibility = 0;
  camera.attachControl(canvas, false);
  camera.inputs.removeByType("ArcRotateCameraKeyboardMoveInput");

  // Filmic grade shared with the sector field: ACES tone mapping, a little contrast, a vignette.
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

  // A whisper of fill so the night side of each planet is dark but not black.
  const fill = new HemisphericLight("fill", new Vector3(0, 1, 0), scene);
  fill.intensity = 0.07;
  fill.diffuse = new Color3(0.55, 0.62, 0.8);
  fill.groundColor = new Color3(0.2, 0.22, 0.3);
  fill.specular = Color3.Black();
  const starLight = new PointLight("star-light", Vector3.Zero(), scene);
  starLight.intensity = 1.2;
  starLight.range = 16;

  const glow = new GlowLayer("system-glow", scene, { blurKernelSize: 32 });
  glow.intensity = 0.75;

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

  // --- Static backdrop -----------------------------------------------------------------------

  const skyTexture = paintTexture("sky", 2048, 1024, context => paintSky(context, 2048, 1024, createRandom(ATLAS_SKY_SEED)), false);
  const skyMaterial = new StandardMaterial("sky", scene);
  skyMaterial.disableLighting = true;
  skyMaterial.diffuseColor = Color3.Black();
  skyMaterial.specularColor = Color3.Black();
  skyMaterial.emissiveTexture = skyTexture;
  skyMaterial.backFaceCulling = false;
  skyMaterial.disableDepthWrite = true;
  const sky = MeshBuilder.CreateSphere("sky", { diameter: 200, segments: 32, sideOrientation: Mesh.BACKSIDE }, scene);
  sky.material = skyMaterial;
  sky.infiniteDistance = true;
  sky.isPickable = false;

  // A shell of near dust stars gives parallax while the camera orbits.
  const dustRandom = createRandom(DUST_SEED);
  const dustPositions: number[] = [];
  const dustColors: number[] = [];
  const dustIndices: number[] = [];
  const dustTints = [[1, 1, 1], [0.8, 0.86, 1], [1, 0.93, 0.82], [0.72, 0.8, 1]];
  for (let index = 0; index < 700; index += 1) {
    const theta = dustRandom() * Math.PI * 2;
    const height = dustRandom() * 2 - 1;
    const ring = Math.sqrt(1 - height * height);
    const radius = 11 + dustRandom() * 30;
    dustPositions.push(Math.cos(theta) * ring * radius, height * radius * 0.6, Math.sin(theta) * ring * radius);
    const tint = dustTints[Math.floor(dustRandom() * dustTints.length)];
    dustColors.push(tint[0], tint[1], tint[2], 0.12 + dustRandom() * dustRandom() * 0.6);
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

  // The ecliptic: a faint dust disc instead of a solid plate and wireframe grid.
  const eclipticTexture = paintTexture("ecliptic", 1024, 1024, context => paintEclipticDust(context, 1024, createRandom(DUST_SEED ^ 0x3c)), true);
  eclipticTexture.level = 1.25;
  const eclipticMaterial = new StandardMaterial("ecliptic", scene);
  eclipticMaterial.disableLighting = true;
  eclipticMaterial.diffuseColor = Color3.Black();
  eclipticMaterial.specularColor = Color3.Black();
  eclipticMaterial.emissiveTexture = eclipticTexture;
  eclipticMaterial.opacityTexture = eclipticTexture;
  eclipticMaterial.alphaMode = ALPHA_ADD;
  eclipticMaterial.disableDepthWrite = true;
  eclipticMaterial.backFaceCulling = false;
  const ecliptic = MeshBuilder.CreateGround("ecliptic", { width: 22, height: 22 }, scene);
  ecliptic.position.y = -0.02;
  ecliptic.material = eclipticMaterial;
  ecliptic.isPickable = false;

  // Glow and flare sprites: star glow and halo, one glow and one flare per neighbour, one beacon
  // per colony. Babylon drops sprites past capacity silently; callers pass `nearestNeighbours`
  // (six at most), so 96 and 24 leave wide headroom.
  const glowSprites = new SpriteManager("system-glow-sprites", spriteSheet(128, paintGlow), 96, { width: 128, height: 128 }, scene);
  glowSprites.blendMode = ALPHA_ADD;
  glowSprites.disableDepthWrite = true;
  glowSprites.isPickable = false;
  const flareSprites = new SpriteManager("system-flare-sprites", spriteSheet(256, paintFlare), 24, { width: 256, height: 256 }, scene);
  flareSprites.blendMode = ALPHA_ADD;
  flareSprites.disableDepthWrite = true;
  flareSprites.isPickable = false;

  // The star: a hot core in the glow layer plus additive glow, halo and flare sprites.
  const starMaterial = new StandardMaterial("star", scene);
  starMaterial.disableLighting = true;
  starMaterial.diffuseColor = Color3.Black();
  starMaterial.specularColor = Color3.Black();
  const star = MeshBuilder.CreateSphere("star", { diameter: 0.6, segments: 24 }, scene);
  star.material = starMaterial;
  star.isPickable = false;
  glow.addIncludedOnlyMesh(star);
  const makeSprite = (manager: InstanceType<typeof SpriteManager>, name: string, size: number): BabylonSprite => {
    const sprite = new Sprite(name, manager);
    sprite.position = Vector3.Zero();
    sprite.size = size;
    sprite.isPickable = false;
    return sprite;
  };
  const starGlow = makeSprite(glowSprites, "star-glow", 3.4);
  const starHalo = makeSprite(glowSprites, "star-halo", 9);
  const starFlare = makeSprite(flareSprites, "star-flare", 4.4);

  const selectionMaterial = new StandardMaterial("selection", scene);
  selectionMaterial.disableLighting = true;
  selectionMaterial.emissiveColor = new Color3(0.86, 0.98, 0.95);
  selectionMaterial.alpha = 0.95;
  const selectionRing = MeshBuilder.CreateTorus("selection", { diameter: 0.55, thickness: 0.016, tessellation: 48 }, scene);
  selectionRing.material = selectionMaterial;
  selectionRing.isPickable = false;
  selectionRing.setEnabled(false);
  glow.addIncludedOnlyMesh(selectionRing);

  // --- Dynamic state ---------------------------------------------------------------------------

  type Body = {
    id: string;
    kind: "planet" | "system";
    /** Unrotated holder: rings parent here so they stay flat while the surface spins. */
    holder: { position: InstanceType<typeof Vector3> };
    material: Material;
    baseEmissive: BabylonColor3;
    planet?: SystemPlanet;
    surface?: { rotation: InstanceType<typeof Vector3> };
    spin?: number;
    yaw?: number;
    fixed?: ScenePoint;
  };

  let disposed = false;
  let reduced = false;
  let spinPaused = false;
  let driftSeconds = 0;
  let elapsed = 0;
  let cycle = 0;
  let colonyIds: readonly string[] = [];
  let currentSystem: StarSystem | null = null;
  let builtKey = "";
  let currentNeighbours: readonly SystemNeighbour[] = [];
  let focusedId: string | null = null;
  let bodies: Body[] = [];
  let beacons: { sprite: BabylonSprite; holder: Node; radius: number; phase: number }[] = [];
  let dynamicMeshes: AnyMesh[] = [];
  let dynamicMaterials: { dispose: () => void }[] = [];
  let dynamicTextures: Texture[] = [];
  let dynamicSprites: BabylonSprite[] = [];
  let dynamicNodes: Node[] = [];
  let glowMeshes: InstanceType<typeof Mesh>[] = [];
  let gliding: Promise<void> | null = null;
  /** Finishers of running tweens; `dispose` settles them so no timer outlives the scene. */
  const pendingTweens = new Set<() => void>();
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

  // A narrow chart (phone, or a squeezed column) keeps the horizontal coverage of a wide one,
  // so the outer orbits stay inside the frame and clear of the pinned neighbour ring.
  const applyScaling = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    engine.setHardwareScalingLevel(1 / ratio);
    engine.resize();
    const aspect = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight());
    if (aspect < WIDE_ASPECT) {
      camera.fovMode = ArcRotateCamera.FOVMODE_HORIZONTAL_FIXED;
      camera.fov = 2 * Math.atan(Math.tan(CAMERA_FOV / 2) * WIDE_ASPECT);
    } else {
      camera.fovMode = ArcRotateCamera.FOVMODE_VERTICAL_FIXED;
      camera.fov = CAMERA_FOV;
    }
    grade.vignetteCameraFov = camera.fov;
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
  ): BabylonSprite => {
    const sprite = new Sprite(name, manager);
    sprite.position = new Vector3(position.x, position.y, position.z);
    sprite.size = size;
    sprite.color = new Color4(color.r, color.g, color.b, alpha);
    sprite.isPickable = false;
    dynamicSprites.push(sprite);
    return sprite;
  };
  const emissiveMaterial = (name: string, color: BabylonColor3, alpha = 1): Material => {
    const material = trackMaterial(new StandardMaterial(name, scene));
    material.disableLighting = true;
    material.diffuseColor = Color3.Black();
    material.specularColor = Color3.Black();
    material.emissiveColor = color.clone();
    material.alpha = alpha;
    return material;
  };

  const clearDynamic = () => {
    selectionRing.parent = null;
    selectionRing.setEnabled(false);
    for (const mesh of glowMeshes) glow.removeIncludedOnlyMesh(mesh);
    for (const sprite of dynamicSprites) sprite.dispose();
    for (const mesh of dynamicMeshes) mesh.dispose();
    for (const node of dynamicNodes) node.dispose();
    for (const material of dynamicMaterials) material.dispose();
    for (const texture of dynamicTextures) texture.dispose();
    dynamicMeshes = [];
    dynamicMaterials = [];
    dynamicTextures = [];
    dynamicSprites = [];
    dynamicNodes = [];
    glowMeshes = [];
    beacons = [];
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
    body.material.emissiveColor.copyFrom(Color3.Lerp(body.baseEmissive, Color3.White(), body.kind === "system" ? 0.55 : 0.22));
    selectionRing.parent = body.holder as never;
    selectionRing.position.set(0, 0, 0);
    const scale = body.planet ? (body.planet.radius * PLANET_SCALE * 2 + 0.3) / 0.55 : 1.35;
    selectionRing.scaling.set(scale, scale, scale);
    selectionRing.setEnabled(true);
  };

  const placePlanets = () => {
    for (const body of bodies) {
      if (!body.planet) continue;
      const position = planetScenePosition(body.planet, cycle, driftSeconds);
      body.holder.position.set(position.x, 0, position.z);
      if (body.surface && body.spin) body.surface.rotation.y = (body.yaw ?? 0) + elapsed * body.spin;
    }
    for (const beacon of beacons) {
      const angle = beacon.phase + (reduced ? 0 : elapsed * 1.1);
      const center = beacon.holder.position;
      beacon.sprite.position.set(center.x + Math.cos(angle) * beacon.radius, 0, center.z + Math.sin(angle) * beacon.radius);
    }
    if (!reduced) {
      const breathe = 1 + Math.sin(elapsed * 0.9) * 0.035;
      starHalo.size = 9 * breathe;
      starGlow.size = 3.4 * (1 + Math.sin(elapsed * 1.7 + 1) * 0.02);
    }
  };

  const paintStar = (system: StarSystem) => {
    const signal = system.knowledge === "signal";
    // A signal-only system keeps its class hidden: grey-violet, like signals in the sector field.
    const glowColor = Color3.FromHexString(signal ? SIGNAL_GLOW_HEX : STAR_GLOW_HEX[system.starClass]);
    const coreColor = signal ? glowColor : Color3.Lerp(Color3.FromHexString(STAR_COLORS[system.starClass]), Color3.White(), 0.35);
    starMaterial.emissiveColor = coreColor;
    starLight.diffuse = Color3.Lerp(glowColor, Color3.White(), 0.55);
    starLight.specular = starLight.diffuse.scale(0.25);
    starGlow.color = new Color4(glowColor.r, glowColor.g, glowColor.b, signal ? 0.6 : 0.95);
    starHalo.color = new Color4(glowColor.r, glowColor.g, glowColor.b, signal ? 0.1 : 0.2);
    starFlare.color = new Color4(glowColor.r, glowColor.g, glowColor.b, signal ? 0.12 : 0.42);
  };

  const buildPlanet = (planet: SystemPlanet, colony: boolean, orbitLines: InstanceType<typeof Vector3>[][], orbitColors: InstanceType<typeof Color4>[][]) => {
    const biome = systemPlanetBiome(planet.planetId);
    const palette = BIOME_PALETTES[biome];
    const seed = hashText(planet.planetId);
    const random = createRandom(seed);

    const holder = new TransformNode(`holder-${planet.planetId}`, scene);
    dynamicNodes.push(holder);
    const position = planetScenePosition(planet, cycle, driftSeconds);
    holder.position.set(position.x, 0, position.z);

    const texture = paintTexture(`surface-${planet.planetId}`, 256, 128, context => paintPlanetSurface(context, 256, 128, random, biome, palette), false);
    dynamicTextures.push(texture);
    const material = trackMaterial(new StandardMaterial(`planet-${planet.planetId}`, scene));
    material.diffuseTexture = texture;
    material.specularColor = new Color3(0.08, 0.08, 0.09);
    material.specularPower = 24;
    material.emissiveColor = Color3.FromHexString(palette.ridge).scale(0.035);
    const radius = planet.radius * PLANET_SCALE;
    const surface = trackMesh(MeshBuilder.CreateSphere(`planet-${planet.planetId}`, { diameter: radius * 2, segments: 32 }, scene));
    surface.material = material;
    surface.parent = holder;
    surface.rotation.z = 0.08 + ((seed >>> 8) % 100) / 100 * 0.3;
    const yaw = ((seed >>> 4) % 628) / 100;
    surface.rotation.y = yaw + elapsed * (0.05 + ((seed >>> 12) % 100) / 1000);

    // Atmosphere: a slightly larger additive shell, opaque only at the limb and lit by the star,
    // so it shows as a thin crescent on the day side.
    const rim = Color3.Lerp(Color3.FromHexString(palette.ridge), Color3.White(), 0.3);
    const atmosphere = trackMaterial(new StandardMaterial(`atmosphere-${planet.planetId}`, scene));
    atmosphere.diffuseColor = rim;
    atmosphere.specularColor = Color3.Black();
    atmosphere.emissiveColor = rim.scale(0.06);
    atmosphere.alpha = biome === "barren" ? 0.25 : 0.85;
    atmosphere.alphaMode = ALPHA_ADD;
    atmosphere.disableDepthWrite = true;
    atmosphere.opacityFresnelParameters = new FresnelParameters({ leftColor: Color3.White(), rightColor: Color3.Black(), bias: 0.05, power: 2.4 });
    const shell = trackMesh(MeshBuilder.CreateSphere(`atmosphere-${planet.planetId}`, { diameter: radius * 2 * 1.12, segments: 24 }, scene));
    shell.material = atmosphere;
    shell.parent = holder;

    const orbit: InstanceType<typeof Vector3>[] = [];
    for (let step = 0; step <= 128; step += 1) {
      const angle = (step / 128) * Math.PI * 2;
      orbit.push(new Vector3(Math.cos(angle) * planet.orbitRadius, 0, Math.sin(angle) * planet.orbitRadius));
    }
    const gold = Color3.FromHexString(COLONY_GOLD_HEX);
    const orbitColor = colony ? new Color4(gold.r, gold.g, gold.b, 0.5) : new Color4(0.62, 0.74, 0.92, 0.16);
    orbitLines.push(orbit);
    orbitColors.push(orbit.map(() => orbitColor));

    if (colony) {
      const ring = trackMesh(MeshBuilder.CreateTorus(`colony-${planet.planetId}`, { diameter: radius * 2 + 0.16, thickness: 0.012, tessellation: 48 }, scene));
      ring.material = emissiveMaterial(`colony-${planet.planetId}`, gold, 0.9);
      ring.parent = holder;
      glowMesh(ring);
      const sprite = addSprite(glowSprites, `beacon-${planet.planetId}`, { x: position.x, y: 0, z: position.z }, 0.24, gold, 1);
      beacons.push({ sprite, holder, radius: radius + 0.16, phase: (seed % 628) / 100 });
    }

    bodies.push({
      id: `planet:${planet.planetId}`,
      kind: "planet",
      holder,
      material,
      baseEmissive: material.emissiveColor.clone(),
      planet,
      surface,
      spin: 0.05 + ((seed >>> 12) % 100) / 1000,
      yaw,
    });
  };

  const buildNeighbours = (neighbours: readonly SystemNeighbour[]) => {
    const laneLines: InstanceType<typeof Vector3>[][] = [];
    const laneColors: InstanceType<typeof Color4>[][] = [];
    for (const neighbour of neighbours) {
      const fixed = neighbourScenePosition(neighbour.bearing);
      const signal = neighbour.system.knowledge === "signal";
      const glowColor = Color3.FromHexString(signal ? SIGNAL_GLOW_HEX : STAR_GLOW_HEX[neighbour.system.starClass]);
      const name = `neighbour-${bodies.length}`;
      const material = emissiveMaterial(name, signal ? glowColor.scale(0.7) : Color3.Lerp(glowColor, Color3.White(), 0.3), signal ? 0.7 : 1);
      const core = trackMesh(MeshBuilder.CreateSphere(name, { diameter: signal ? 0.14 : 0.22, segments: 12 }, scene));
      core.material = material;
      core.position.set(fixed.x, fixed.y, fixed.z);
      glowMesh(core);
      addSprite(glowSprites, `${name}-glow`, fixed, signal ? 1.2 : 2.2, glowColor, signal ? 0.45 : 0.85);
      if (!signal) addSprite(flareSprites, `${name}-flare`, fixed, 3.2, glowColor, 0.28);

      const length = Math.hypot(fixed.x, fixed.z) || 1;
      const start = new Vector3((fixed.x / length) * LANE_START, 0, (fixed.z / length) * LANE_START);
      const end = new Vector3(fixed.x * 0.96, 0, fixed.z * 0.96);
      if (signal) {
        const lane = trackMesh(MeshBuilder.CreateDashedLines(`${name}-lane`, { points: [start, end], dashNb: 12, dashSize: 2, gapSize: 1.6 }, scene));
        lane.color = glowColor;
        lane.alpha = 0.3;
      } else {
        laneLines.push([start, end]);
        laneColors.push([new Color4(glowColor.r, glowColor.g, glowColor.b, 0.04), new Color4(glowColor.r, glowColor.g, glowColor.b, 0.42)]);
      }
      bodies.push({
        id: neighbour.system.id,
        kind: "system",
        holder: core,
        material,
        baseEmissive: material.emissiveColor.clone(),
        fixed,
      });
    }
    if (laneLines.length > 0) {
      trackMesh(MeshBuilder.CreateLineSystem("lanes", { lines: laneLines, colors: laneColors, useVertexAlpha: true }, scene));
    }
  };

  const setSystem = (system: StarSystem, neighbours: readonly SystemNeighbour[], nextCycle: number, colonyPlanetIds?: readonly string[]) => {
    if (disposed) return;
    if (colonyPlanetIds) colonyIds = colonyPlanetIds;
    cycle = nextCycle;
    currentSystem = system;
    currentNeighbours = neighbours;
    // Planet positions follow `cycle` every frame, so only the structure decides a rebuild.
    const key = [
      system.id,
      system.knowledge,
      system.starClass,
      system.planets.map(planet => planet.planetId).join(","),
      colonyIds.join(","),
      neighbours.map(entry => `${entry.system.id}:${entry.system.knowledge}`).join(","),
    ].join("|");
    if (key === builtKey) return;
    builtKey = key;
    const colonies = new Set(colonyIds);
    clearDynamic();
    paintStar(system);

    const orbitLines: InstanceType<typeof Vector3>[][] = [];
    const orbitColors: InstanceType<typeof Color4>[][] = [];
    for (const planet of system.planets) buildPlanet(planet, colonies.has(planet.planetId), orbitLines, orbitColors);
    if (orbitLines.length > 0) {
      trackMesh(MeshBuilder.CreateLineSystem("orbits", { lines: orbitLines, colors: orbitColors, useVertexAlpha: true }, scene));
    }
    buildNeighbours(neighbours);
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
        : { x: body.fixed?.x ?? body.holder.position.x, z: body.fixed?.z ?? body.holder.position.z };
      const point = Vector3.Project(new Vector3(source.x, 0, source.z), identity, transform, viewport);
      const inDepth = point.z >= 0 && point.z <= 1;
      if (body.kind === "system") {
        // Neighbours always sit on the chart's edge ring in the direction they lie (mirrored
        // when the point falls behind the camera), so a far-side system never lands among
        // the planets. The plan fallback puts them on the same ring.
        const edge = pinToEdgeRing(point.x, point.y, width, height, inDepth, scaling, true);
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
    if (!reduced) {
      driftSeconds += dt;
      elapsed += dt;
    }
    placePlanets();
    scene.render();
    publish();
  });

  const tweenTarget = (from: ScenePoint, to: ScenePoint, ms: number) => {
    if (reduced || ms <= 0) {
      camera.setTarget(new Vector3(to.x, to.y, to.z), false, true, true);
      return Promise.resolve();
    }
    return new Promise<void>(resolve => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const finish = () => {
        if (settled) return;
        settled = true;
        pendingTweens.delete(finish);
        if (timer) clearTimeout(timer);
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
      pendingTweens.add(finish);
      timer = setTimeout(finish, ms + 250);
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
      let timer: ReturnType<typeof setTimeout> | null = null;
      const finish = () => {
        if (settled) return;
        settled = true;
        pendingTweens.delete(finish);
        if (timer) clearTimeout(timer);
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
      pendingTweens.add(finish);
      timer = setTimeout(finish, ms + 250);
    });
  };

  const handle: SystemSceneHandle = {
    setSystem,
    focusLandmark(id) {
      focusedId = id;
      paintFocus();
    },
    async glideToSystem(next, neighbours) {
      if (gliding) return gliding;
      const origin = currentSystem;
      if (!origin || next.id === origin.id) return;
      // Fly towards where the destination lies from here: its listed bearing, or the bearing
      // from the two positions when the caller passed a system outside the shown neighbours.
      const listed = currentNeighbours.find(entry => entry.system.id === next.id);
      const bearing = listed?.bearing ?? Math.atan2(next.position.y - origin.position.y, next.position.x - origin.position.x);
      const run = (async () => {
        const destination = neighbourScenePosition(bearing);
        const from = camera.target.clone();
        camera.useAutoRotationBehavior = false;
        try {
          if (reduced) {
            camera.radius = 16;
            camera.setTarget(new Vector3(destination.x, destination.y, destination.z), false, true, true);
          } else {
            await Promise.all([
              animateRadius(16, GLIDE_MS),
              tweenTarget(from, destination, GLIDE_MS),
            ]);
          }
          if (disposed) return;
          setSystem(next, neighbours, cycle, colonyIds);
          camera.setTarget(Vector3.Zero(), false, true, true);
          if (reduced) camera.radius = 9;
          else await animateRadius(9, GLIDE_MS);
        } finally {
          // Recompute from the current state: hover or reduced motion may have changed mid-glide.
          if (!disposed) applySpin();
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
      if (reduced) {
        starHalo.size = 9;
        starGlow.size = 3.4;
      }
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
      for (const finish of [...pendingTweens]) finish();
      engine.stopRenderLoop();
      scene.dispose();
      engine.dispose();
    },
  };

  return handle;
}

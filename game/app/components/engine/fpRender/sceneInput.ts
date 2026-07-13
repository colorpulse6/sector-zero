import type { FirstPersonState, BoardingMap, FPEnvironmentArt } from "../types";
import { SPRITES } from "../sprites";
import { TextureRegistry } from "./textures";
import { hslShiftToRgbMul, IDENTITY_TINT, type RgbMul, type LightGrid, type LightGridPointLight } from "./lighting";

export interface BillboardInput {
  x: number; y: number;
  texId: number;
  scale: number;        // world-height scale (classic ×0.6 applied in core)
  alpha256: number;     // 256 = opaque; dying enemies fade
  widthFactor: number;  // width = height × this. NPCs are portraits: 0.4 (classic
                        //   firstPersonRenderer.ts:493). Enemies/props: 1.
  vAnchor: "center" | "npc" | "prop";
                        // vertical anchor, ported from classic draw math:
                        //   center → sy0 = half − size/2 (enemies)
                        //   npc    → sy0 = half − size/3 (feet on ground, :496)
                        //   prop   → sy0 = half − 0.55·size (:343-346)
  minSizeFrac?: number; // props: 20/714 of fb height (classic 20px floor, :344)
}

export interface RenderScene {
  camX: number; camY: number;
  dirX: number; dirY: number; planeX: number; planeY: number;
  map: {
    width: number; height: number;
    solid: Uint8Array;          // 1 = wall|empty (classic isWall semantics)
    wallTexture: Int16Array;    // texture id per tile, -1 = art.wallTexId
    floorTexture: Int16Array;   // Task 2; -1 = art.floorTexId
  };
  art: { skyTexId: number; wallTexId: number; floorTexId: number; ceilingTexId: number };
  billboards: BillboardInput[];
  noDepthBillboards: BillboardInput[];
  baseLight: Uint8Array | null;             // per-tile 0–255, from map.lightMap
  pointLights: LightGridPointLight[];
  lightGrid: LightGrid;                     // reused per-tile RGB multiplier grid
  tint: RgbMul;
  doorTiles: Uint8Array | null;             // 1 = door tile (facing-door emissive light)
}

// Moved verbatim from firstPersonRenderer.ts (deleted there).
export const NPC_SPRITE_MAP: Record<string, string> = {
  "Commander Voss": SPRITES.NPC_VOSS,
  "Doc Kael": SPRITES.NPC_KAEL,
  "Lt. Reyes": SPRITES.NPC_REYES,
  "Survivor": SPRITES.NPC_SURVIVOR,
  "Scavenger": SPRITES.NPC_SCAVENGER,
};

/** ms per NPC animation frame (~5.5fps walk cycle). Exported for tests. */
export const NPC_ANIM_FRAME_MS = 180;

/** NPC billboard sprite resolution (Phase 5a §H2 + DOOM-overhaul animation).
 *  Animated NPCs (optional walkSprites/idleSprites) cycle frames off the
 *  stepper-accumulated animClockMs — walkSprites while isMoving, idleSprites
 *  while standing, fallback chain walk → idle → static. Walk frames are never
 *  shown while standing. NPCs without animation fields resolve EXACTLY as
 *  before (strictly opt-in, golden-safe): an explicit `sprite` wins (colony
 *  NPCs set distinct SPRITES.NPC_* assets), otherwise the name map (Ashfall's
 *  named NPCs), otherwise the survivor fallback. Exported for a focused unit
 *  test of the resolution order. */
export function resolveNpcSprite(n: {
  sprite?: string; name: string;
  walkSprites?: string[]; idleSprites?: string[];
  isMoving?: boolean; animClockMs?: number;
}): string {
  const frames = (n.isMoving && n.walkSprites?.length ? n.walkSprites : undefined)
    ?? (n.idleSprites?.length ? n.idleSprites : undefined);
  if (frames) return frames[Math.floor((n.animClockMs ?? 0) / NPC_ANIM_FRAME_MS) % frames.length];
  return n.sprite ?? NPC_SPRITE_MAP[n.name] ?? SPRITES.NPC_SURVIVOR;
}

export class SceneBuilder {
  private scene: RenderScene | null = null;
  private lastMap: BoardingMap | null = null;
  // Point-light reuse: reparse hex colors only when the source array's
  // identity changes (mirrors the map-identity invalidation key above).
  // `s.pointLights` holds the parsed static lights in [0, staticLightCount),
  // followed each frame by the reused door-emissive-light object when facing
  // a door — trimmed back to staticLightCount first so the array never grows.
  private lastPointLightsInput: FPEnvironmentArt["pointLights"] | undefined = undefined;
  private staticLightCount = 0;
  private readonly doorLight: LightGridPointLight = { x: 0, y: 0, r: 255, g: 255, b: 255, power: 0.8 };
  private readonly faceScratch = { x: 0, y: 0 };   // reused out-param for facingTile()
  // Tint reuse: recompute the RGB multiplier only when the source tint
  // object's identity changes (mirrors the map/point-light invalidation keys
  // above) — colonyLayout hands the same environmentTint object across every
  // frame of a scene layer (rebuilt only on scene transitions, not per
  // frame), so this keeps the common case allocation-free.
  private lastTintInput: FPEnvironmentArt["environmentTint"] | undefined = undefined;
  private cachedTint: RgbMul = IDENTITY_TINT;

  /** Last built scene — overlays (HP bars, tags, labels) project through it. */
  get lastBuilt(): RenderScene | null { return this.scene; }

  build(fp: FirstPersonState, reg: TextureRegistry): RenderScene {
    if (!this.scene) this.scene = emptyScene();
    const s = this.scene;

    if (fp.map !== this.lastMap) {           // map identity = invalidation key
      this.lastMap = fp.map;
      rebuildMapArrays(s, fp.map, reg);
    }

    s.camX = fp.posX; s.camY = fp.posY;
    s.dirX = fp.dirX; s.dirY = fp.dirY; s.planeX = fp.planeX; s.planeY = fp.planeY;

    const art = fp.environmentArt;
    s.art.skyTexId = reg.idFor(art?.skySprite, "sky");
    s.art.wallTexId = reg.idFor(art?.wallSprite ?? SPRITES.BOARDING_TILES, "tile");
    s.art.floorTexId = reg.idFor(art?.floorSprite, "tile");
    s.art.ceilingTexId = reg.idFor(art?.ceilingSprite, "tile");
    const inputTint = art?.environmentTint;
    if (inputTint !== this.lastTintInput) {
      this.lastTintInput = inputTint;
      this.cachedTint = inputTint ? hslShiftToRgbMul(inputTint) : IDENTITY_TINT;
    }
    s.tint = this.cachedTint;

    const inputLights = art?.pointLights;
    if (inputLights !== this.lastPointLightsInput) {
      this.lastPointLightsInput = inputLights;
      s.pointLights.length = 0;
      for (const L of inputLights ?? []) {
        const [r, g, b] = hexToRgb(L.color);
        s.pointLights.push({ x: L.x, y: L.y, r, g, b, power: L.power });
      }
      this.staticLightCount = s.pointLights.length;
    } else {
      s.pointLights.length = this.staticLightCount;   // drop last frame's door light, if any
    }
    // Door emissive glow: small white light at the facing tile's center when
    // that tile is a door — ported trigger from the deleted classic overlay
    // (drawDoorGlowOverlay), now expressed as a light instead of a screen wash.
    // Facing uses the same dominant-axis rule as the engine's colony-interact
    // block (firstPersonEngine.ts) — duplicated here on purpose: this module
    // must not import the engine (render core stays engine-free).
    if (s.doorTiles) {
      facingTile(s.camX, s.camY, s.dirX, s.dirY, this.faceScratch);   // writes into faceScratch — no per-frame allocation
      const fx = this.faceScratch.x, fy = this.faceScratch.y;
      if (fx >= 0 && fx < s.map.width && fy >= 0 && fy < s.map.height
        && s.doorTiles[fy * s.map.width + fx]) {
        this.doorLight.x = fx + 0.5;
        this.doorLight.y = fy + 0.5;
        s.pointLights.push(this.doorLight);
      }
    }

    s.billboards.length = 0;
    s.noDepthBillboards.length = 0;
    for (const p of fp.props ?? []) {
      s.billboards.push({ x: p.x, y: p.y, texId: reg.idFor(p.sprite, "billboard"), scale: p.scale ?? 1, alpha256: 256, widthFactor: 1, vAnchor: "prop", minSizeFrac: 20 / 714 });
    }
    for (const e of fp.enemies) {
      if (e.deathTimer === -1) continue;
      // PORTED VERBATIM: frame selection + fade from the classic
      // drawEnemyBillboards (firstPersonRenderer.ts:239-267): death frame while
      // deathTimer > 0 with alpha = deathTimer/30; flinch frame while damaged
      // (hp < maxHp); front frame otherwise.
      const sprite = e.deathTimer > 0 ? SPRITES.FP_ENEMY_DEATH
        : e.hp < e.maxHp ? SPRITES.FP_ENEMY_FLINCH
        : SPRITES.FP_ENEMY_FRONT;
      const alpha = e.deathTimer > 0 ? Math.round((e.deathTimer / 30) * 256) : 256;
      s.billboards.push({ x: e.x, y: e.y, texId: reg.idFor(sprite, "billboard"), scale: 1, alpha256: alpha, widthFactor: 1, vAnchor: "center" });
    }
    for (const n of fp.npcs) {
      s.billboards.push({ x: n.x, y: n.y, texId: reg.idFor(resolveNpcSprite(n), "billboard"), scale: 1, alpha256: 256, widthFactor: 0.4, vAnchor: "npc" });
    }
    // Objective marker: NOT pushed here. It stays the classic overlay
    // (drawObjectiveBillboard — glow + label are vector draws that already
    // render over everything, satisfying the spec's through-wall exception).
    // noDepthBillboards stays as the generic no-z-test mechanism (golden 8b
    // exercises it via fixtures); nothing populates it yet.
    return s;
  }
}

/** Mirrors the dominant-axis facing rule in firstPersonEngine.ts's colony
 *  interact block (`Math.abs(fp.dirX) >= Math.abs(fp.dirY) ? ...`). Duplicated
 *  intentionally — sceneInput must stay engine-import-free. Writes into `out`
 *  (caller-owned scratch) rather than returning a fresh object, since this
 *  runs unconditionally every frame from build() and must stay allocation-free
 *  at steady state (unlike the engine's copy, gated behind an interact press). */
function facingTile(camX: number, camY: number, dirX: number, dirY: number, out: { x: number; y: number }): void {
  const dominant = Math.abs(dirX) >= Math.abs(dirY);
  out.x = Math.floor(camX) + (dominant ? Math.sign(dirX) : 0);
  out.y = Math.floor(camY) + (dominant ? 0 : Math.sign(dirY));
}

/** "#RRGGBB" → [r,g,b] 0–255. Point-light colors only; no shorthand/alpha. */
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function rebuildMapArrays(s: RenderScene, map: BoardingMap, reg: TextureRegistry): void {
  const { width, height } = map;
  s.map.width = width; s.map.height = height;
  s.map.solid = new Uint8Array(width * height);
  s.map.wallTexture = new Int16Array(width * height).fill(-1);
  s.map.floorTexture = new Int16Array(width * height).fill(-1);
  s.doorTiles = new Uint8Array(width * height);
  s.baseLight = map.lightMap ? new Uint8Array(width * height) : null;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = map.tiles[y][x];
      const i = y * width + x;
      if (t === "wall" || t === "empty") s.map.solid[i] = 1;
      if (t === "door") s.doorTiles[i] = 1;
      const override = map.wallTextureMap?.[y]?.[x];
      if (override) s.map.wallTexture[i] = reg.idFor(override, "tile");
      const floorOverride = map.floorTextureMap?.[y]?.[x];
      if (floorOverride) s.map.floorTexture[i] = reg.idFor(floorOverride, "tile");
      // Clamp into [0,255]: an out-of-range authored value (e.g. 256) would
      // otherwise wrap via Uint8Array's ToUint8 truncation (256 -> 0, i.e.
      // full dark instead of full bright) — clamp before the typed-array
      // write so bad data degrades to "clipped bright/dark", not inverted.
      if (s.baseLight) {
        const raw = map.lightMap?.[y]?.[x] ?? 255;
        s.baseLight[i] = raw < 0 ? 0 : raw > 255 ? 255 : raw;
      }
    }
  }
}

function emptyScene(): RenderScene {
  return {
    camX: 0, camY: 0, dirX: 1, dirY: 0, planeX: 0, planeY: 0.66,
    map: {
      width: 0, height: 0,
      solid: new Uint8Array(0),
      wallTexture: new Int16Array(0),
      floorTexture: new Int16Array(0),
    },
    art: { skyTexId: -1, wallTexId: -1, floorTexId: -1, ceilingTexId: -1 },
    billboards: [], noDepthBillboards: [],
    baseLight: null, pointLights: [],
    lightGrid: { r: new Int16Array(0), g: new Int16Array(0), b: new Int16Array(0), w: 0, h: 0 },
    tint: IDENTITY_TINT,
    doorTiles: null,
  };
}

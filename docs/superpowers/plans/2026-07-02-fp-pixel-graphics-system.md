# FP Pixel Graphics System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the first-person scene renderer with a per-pixel software framebuffer pipeline (textured floor/ceiling casting, tile-grid lighting, adaptive resolution, delta-time movement) serving all four FP surfaces.

**Architecture:** New pure-function render core under `game/app/components/engine/fpRender/` writes pixels into a reused `Uint32Array`, presented once per frame via offscreen canvas. `firstPersonRenderer.ts` keeps every overlay (HUD, minimap, dialog, gun, HP bars, tags, objective marker) and delegates only the 3D scene. Engine simulation untouched except delta-time scaling. **No feature flags — classic scene code is deleted in the same commit that replaces it.**

**Tech Stack:** TypeScript, Canvas 2D (`putImageData` + blit), `tsx --test` (node:test) for golden-frame tests. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-02-fp-pixel-graphics-system-design.md` — read it first; it records the decisions (budgets, no-flags rule, parity exceptions like the objective marker drawing through walls).

**Branch:** `engine/fp-pixel-renderer` (already created; spec committed). Work in place — this repo's convention is one feature branch per milestone, no worktrees.

**Verification commands (every task):**
```bash
cd /Users/nichalasbarnes/Desktop/projects/sector-zero/game
yarn engine:test        # after Task 1 exists
yarn colony:test        # must stay 100/100
npx tsc --noEmit
yarn build
```

---

## File map (who owns what)

| File | Responsibility |
|---|---|
| `engine/fpRender/framebuffer.ts` | Pixel buffer + z-buffer + per-column door/extent metadata; DOM-free except `presentFramebuffer` |
| `engine/fpRender/textures.ts` | Sprite path → integer id → normalized `Uint32Array` texels; fallback tints; BOARDING_TILES atlas slice |
| `engine/fpRender/sceneInput.ts` | `RenderScene` type + `SceneBuilder` (FirstPersonState → plain data, reused instance); billboard flattening incl. enemy frame selection |
| `engine/fpRender/lighting.ts` | HSL-shift → RGB multipliers; (Task 3) per-tile LightGrid + point lights |
| `engine/fpRender/renderCore.ts` | `renderScene()` — pure; walls/floor/ceiling/sky/billboards; `projectBillboard()` helper for overlays |
| `engine/fpRender/index.ts` | `drawFirstPersonPixel(ctx, fp)` orchestration; module-level singletons (builder, framebuffer, registry) |
| `firstPersonRenderer.ts` | Overlays only; scene body replaced by one call |
| `tests/engine/*` | Golden-frame + property tests; `fixtures.ts` has hash + synthetic textures |

Pixel format everywhere: **little-endian RGBA as `0xAABBGGRR`** in `Uint32Array` (byte order matches `ImageData`). Alpha always `0xFF` for opaque writes.

---

### Task 1: Texture registry, framebuffer, full parity pipeline (commit 1)

The biggest task: after it, the game renders every FP surface through the new pipeline at visual parity, and the classic scene code is gone.

**Files:**
- Create: `game/app/components/engine/fpRender/framebuffer.ts`
- Create: `game/app/components/engine/fpRender/textures.ts`
- Create: `game/app/components/engine/fpRender/sceneInput.ts`
- Create: `game/app/components/engine/fpRender/lighting.ts` (tint conversion only in this task)
- Create: `game/app/components/engine/fpRender/renderCore.ts`
- Create: `game/app/components/engine/fpRender/index.ts`
- Create: `game/tests/engine/fixtures.ts`, `game/tests/engine/renderCore.test.ts`, `game/tests/engine/lighting.test.ts`
- Modify: `game/app/components/engine/firstPersonRenderer.ts` (delete scene passes, keep overlays)
- Modify: `game/package.json` (add `engine:test` script)
- Modify: `.github/workflows/pr-checks.yml` (run `engine:test` beside `colony:test`)

- [ ] **Step 1.1: Add the test script + fixtures**

`game/package.json` scripts block, after `colony:test`:
```json
"engine:test": "tsx --test tests/engine/*.test.ts"
```

`game/tests/engine/fixtures.ts`:
```typescript
import type { RenderScene } from "../../app/components/engine/fpRender/sceneInput";

/** FNV-1a over the framebuffer for golden-frame comparison. */
export function hashFrame(px: Uint32Array): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < px.length; i++) {
    h ^= px[i] & 0xff;          h = Math.imul(h, 0x01000193);
    h ^= (px[i] >>> 8) & 0xff;  h = Math.imul(h, 0x01000193);
    h ^= (px[i] >>> 16) & 0xff; h = Math.imul(h, 0x01000193);
    h ^= px[i] >>> 24;          h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** 4x4 test texture: quadrant colors so orientation mistakes change the hash. */
export function quadTexture(a: number, b: number, c: number, d: number): Uint32Array {
  const t = new Uint32Array(16);
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++)
      t[y * 4 + x] = [a, b, c, d][(y >> 1) * 2 + (x >> 1)] | 0xff000000;
  return t;
}

export const RED = 0xff0000e0, GREEN = 0xff00e000, BLUE = 0xffe00000, GREY = 0xff808080;

/** 8x8 map: perimeter walls, one pillar at (5,3) using texture id 1. */
export function tinyScene(overrides: Partial<RenderScene> = {}): RenderScene {
  const w = 8, h = 8;
  const solid = new Uint8Array(w * h);
  const wallTexture = new Int16Array(w * h).fill(-1);
  const floorTexture = new Int16Array(w * h).fill(-1);
  for (let x = 0; x < w; x++) { solid[x] = 1; solid[(h - 1) * w + x] = 1; }
  for (let y = 0; y < h; y++) { solid[y * w] = 1; solid[y * w + w - 1] = 1; }
  solid[3 * w + 5] = 1; wallTexture[3 * w + 5] = 1;
  return {
    camX: 2.5, camY: 4.5, dirX: 1, dirY: 0, planeX: 0, planeY: 0.66,
    map: { width: w, height: h, solid, wallTexture, floorTexture },
    // floorTexId: -1 → GRADIENT floor. Deliberate: Task 2 replaces textured
    // floors (screen-space fill → perspective cast) which would change any
    // Task-1 golden that contains one. Gradient floors render identically
    // across Tasks 1→2 (paint-gradient-first rule), so Task-1 goldens survive.
    // Textured floors appear only in Task-2+ floor-specific goldens.
    art: { skyTexId: -1, wallTexId: 0, floorTexId: -1, ceilingTexId: -1 },
    billboards: [], noDepthBillboards: [],
    baseLight: null, pointLights: [],
    tint: { rMul: 256, gMul: 256, bMul: 256 },
    doorTiles: null,
    ...overrides,
  };
}
```

- [ ] **Step 1.2: Write the first failing golden test (walls + determinism)**

`game/tests/engine/renderCore.test.ts` (initial content):
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { Framebuffer } from "../../app/components/engine/fpRender/framebuffer";
import { TextureRegistry } from "../../app/components/engine/fpRender/textures";
import { renderScene } from "../../app/components/engine/fpRender/renderCore";
import { hashFrame, quadTexture, tinyScene, RED, GREEN, BLUE, GREY } from "./fixtures";

const W = 96, H = 142; // small odd-ish frame; exercises rounding

function registry(): TextureRegistry {
  const r = new TextureRegistry();
  r.registerRaw("wall-default", quadTexture(RED, GREEN, BLUE, GREY), 4, 4);   // id 0
  r.registerRaw("wall-pillar", quadTexture(GREEN, RED, GREY, BLUE), 4, 4);    // id 1
  r.registerRaw("floor", quadTexture(GREY, GREY, BLUE, BLUE), 4, 4);          // id 2
  return r;
}

test("golden: textured walls with side shading and fog (determinism)", () => {
  const fb = new Framebuffer(W, H);
  const reg = registry();
  const scene = tinyScene();
  renderScene(fb, scene, reg);
  const h1 = hashFrame(fb.px);
  renderScene(fb, scene, reg);
  assert.equal(hashFrame(fb.px), h1, "same scene twice must be identical");
  if (process.env.UPDATE_GOLDENS) console.log("GOLDEN walls:", h1);
  assert.equal(h1, "REPLACE_ME_WALLS");
});

test("every pixel written and opaque", () => {
  const fb = new Framebuffer(W, H);
  renderScene(fb, tinyScene(), registry());
  for (let i = 0; i < fb.px.length; i++) {
    assert.equal(fb.px[i] >>> 24, 0xff, `pixel ${i} not opaque`);
  }
});
```

- [ ] **Step 1.3: Run to verify failure**

Run: `cd game && yarn engine:test`
Expected: FAIL — modules don't exist yet.

- [ ] **Step 1.4: Implement `framebuffer.ts`**

```typescript
/** Pixel + depth target for the FP scene. DOM-free except presentFramebuffer. */
export class Framebuffer {
  readonly w: number;
  readonly h: number;
  readonly px: Uint32Array;
  readonly zbuf: Float32Array;          // per-column perpendicular wall distance
  readonly colDoor: Uint8Array;         // 1 if the column's wall hit is a door tile
  readonly colTop: Int16Array;          // wall strip drawStart per column (overlay glow)
  readonly colBot: Int16Array;          // wall strip drawEnd per column

  constructor(w: number, h: number) {
    this.w = w; this.h = h;
    this.px = new Uint32Array(w * h);
    this.zbuf = new Float32Array(w);
    this.colDoor = new Uint8Array(w);
    this.colTop = new Int16Array(w);
    this.colBot = new Int16Array(w);
  }
}

// Present path (browser only). Lazily create ImageData wrapping the SAME
// buffer (zero copy) + an offscreen canvas; blit with integer upscale.
const presentCache = new WeakMap<Framebuffer, {
  imageData: ImageData; off: HTMLCanvasElement; offCtx: CanvasRenderingContext2D;
}>();

export function presentFramebuffer(
  fb: Framebuffer, ctx: CanvasRenderingContext2D,
  targetW: number, targetH: number,
): void {
  let entry = presentCache.get(fb);
  if (!entry) {
    const imageData = new ImageData(new Uint8ClampedArray(fb.px.buffer), fb.w, fb.h);
    const off = document.createElement("canvas");
    off.width = fb.w; off.height = fb.h;
    const offCtx = off.getContext("2d");
    if (!offCtx) return;
    entry = { imageData, off, offCtx };
    presentCache.set(fb, entry);
  }
  entry.offCtx.putImageData(entry.imageData, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(entry.off, 0, 0, fb.w, fb.h, 0, 0, targetW, targetH);
}
```

- [ ] **Step 1.5: Implement `textures.ts`**

Responsibilities: stable integer ids per sprite path; normalized decode from the already-cached `HTMLImageElement`s in `sprites.ts`; fallback texels until an image loads; re-decode once when it does; the `BOARDING_TILES` 3-frame atlas slices its middle third at decode time; `registerRaw` for node tests.

**Deliberate deviation from spec Section A:** the spec says `preloadAll()` feeds the registry; this design pulls lazily via `refresh()` + `getSprite` instead — equivalent behavior (registry is populated as images land), fewer touchpoints, and `sprites.ts` needs no modification in this task. Don't "fix" it back.

```typescript
import { getSprite, SPRITES } from "../sprites";

export type TexKind = "tile" | "sky" | "billboard";

export interface Texture {
  texels: Uint32Array;
  w: number; h: number;
  wMask: number; hMask: number;   // pow2 masks (w-1 / h-1); tile+sky are always pow2
  ready: boolean;                 // false while serving fallback texels
}

const TILE_SIZE = 128;
const SKY_W = 512, SKY_H = 256;
const BILLBOARD_MAX = 256;

/** Class fallback colors — keep visual continuity with the classic
 *  WALL_COLORS record while an image loads / if it 404s. */
// 0xAABBGGRR packing! tile fallback = classic cool blue-grey #3a4a5a
// → packed 0xff5a4a3a (B=0x5a, G=0x4a, R=0x3a).
const FALLBACK: Record<TexKind, number> = {
  tile: 0xff5a4a3a, sky: 0xff2e1c14, billboard: 0x00000000,
};

export class TextureRegistry {
  private byPath = new Map<string, number>();
  private textures: Texture[] = [];
  private pending: { id: number; path: string; kind: TexKind }[] = [];

  /** Node tests: register texels directly. Dimensions must be powers of two. */
  registerRaw(path: string, texels: Uint32Array, w: number, h: number): number {
    const id = this.textures.length;
    this.byPath.set(path, id);
    this.textures.push({ texels, w, h, wMask: w - 1, hMask: h - 1, ready: true });
    return id;
  }

  /** Browser: resolve a sprite path to an id, decoding lazily. */
  idFor(path: string | null | undefined, kind: TexKind): number {
    if (!path) return -1;
    const existing = this.byPath.get(path);
    if (existing !== undefined) return existing;
    const id = this.textures.length;
    this.byPath.set(path, id);
    this.textures.push(this.fallbackTexture(kind));
    this.pending.push({ id, path, kind });
    return id;
  }

  get(id: number): Texture { return this.textures[id]; }

  /** Called once per frame (cheap): decode any images that finished loading. */
  refresh(): void {
    if (this.pending.length === 0) return;
    this.pending = this.pending.filter(({ id, path, kind }) => {
      const img = getSprite(path);
      if (!img) return true;                       // still loading — keep pending
      this.textures[id] = decode(img, path, kind);
      return false;
    });
  }

  private fallbackTexture(kind: TexKind): Texture {
    const texels = new Uint32Array(4).fill(FALLBACK[kind]);
    return { texels, w: 2, h: 2, wMask: 1, hMask: 1, ready: false };
  }
}

function decode(img: HTMLImageElement, path: string, kind: TexKind): Texture {
  let w: number, h: number, srcX = 0, srcW = img.width;
  if (kind === "tile") { w = TILE_SIZE; h = TILE_SIZE; }
  else if (kind === "sky") { w = SKY_W; h = SKY_H; }
  else {
    // billboards keep native size capped, rounded up to pow2 for masking
    w = Math.min(BILLBOARD_MAX, pow2Ceil(img.width));
    h = Math.min(BILLBOARD_MAX, pow2Ceil(img.height));
  }
  // Classic renderer treats BOARDING_TILES as a 3-frame atlas and samples
  // the middle third for generic FP walls — slice it here, once, forever.
  if (path === SPRITES.BOARDING_TILES) { srcX = img.width / 3; srcW = img.width / 3; }
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const c = cv.getContext("2d");
  if (!c) return { texels: new Uint32Array(w * h), w, h, wMask: w - 1, hMask: h - 1, ready: false };
  c.imageSmoothingEnabled = true;   // downscale smoothing is desirable here
  c.drawImage(img, srcX, 0, srcW, img.height, 0, 0, w, h);
  const data = c.getImageData(0, 0, w, h);
  return { texels: new Uint32Array(data.data.buffer), w, h, wMask: w - 1, hMask: h - 1, ready: true };
}

function pow2Ceil(n: number): number { let p = 1; while (p < n) p <<= 1; return p; }
```

- [ ] **Step 1.6: Implement `lighting.ts` (tint conversion only, Task 3 adds the grid)**

```typescript
export interface RgbMul { rMul: number; gMul: number; bMul: number } // 0–256 fixed point

/** Convert the existing dayNightTint HSL shift into RGB multipliers.
 *  hueShift > 0 warms (R up, B down); saturationMul pulls channels toward
 *  their mean; lightnessMul scales. tintForHour(12) = {0,1,1} → identity. */
export function hslShiftToRgbMul(t: { hueShift: number; saturationMul: number; lightnessMul: number }): RgbMul {
  const L = t.lightnessMul;
  const warm = t.hueShift * 0.006;
  let r = L * (1 + warm), g = L * (1 + warm * 0.25), b = L * (1 - warm);
  r = L + (r - L) * t.saturationMul;
  g = L + (g - L) * t.saturationMul;
  b = L + (b - L) * t.saturationMul;
  const fx = (v: number) => Math.max(0, Math.min(320, Math.round(v * 256)));
  return { rMul: fx(r), gMul: fx(g), bMul: fx(b) };
}

export const IDENTITY_TINT: RgbMul = { rMul: 256, gMul: 256, bMul: 256 };
```

`game/tests/engine/lighting.test.ts`:
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { hslShiftToRgbMul } from "../../app/components/engine/fpRender/lighting";

test("hour-12 day tint is identity", () => {
  assert.deepEqual(hslShiftToRgbMul({ hueShift: 0, saturationMul: 1, lightnessMul: 1 }),
    { rMul: 256, gMul: 256, bMul: 256 });
});

test("night tint is dim and cool (B > R)", () => {
  const m = hslShiftToRgbMul({ hueShift: -20, saturationMul: 0.7, lightnessMul: 0.55 });
  assert.ok(m.bMul > m.rMul, "night should lean blue");
  assert.ok(m.rMul < 160 && m.bMul < 200, "night should be dim");
});

test("dusk tint is warm (R > B)", () => {
  const m = hslShiftToRgbMul({ hueShift: 20, saturationMul: 1.05, lightnessMul: 0.85 });
  assert.ok(m.rMul > m.bMul);
});
```

- [ ] **Step 1.7: Implement `sceneInput.ts`**

Key points: `RenderScene` is the render core's entire world; `SceneBuilder` reuses one instance and rebuilds map-derived typed arrays **only when `fp.map` object identity changes** (scene-stack transitions swap the map object — that is the invalidation key). Billboard flattening ports the classic frame-selection and death-fade rules. The objective marker goes to `noDepthBillboards` (draws through walls — spec exception). NPC sprite lookup table moves here from `firstPersonRenderer.ts`.

```typescript
import type { FirstPersonState, BoardingMap } from "../types";
import { SPRITES } from "../sprites";
import { TextureRegistry } from "./textures";
import { hslShiftToRgbMul, IDENTITY_TINT, type RgbMul } from "./lighting";

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
    solid: Uint8Array;          // 1 = wall|empty (raycaster.isWall semantics)
    wallTexture: Int16Array;    // texture id per tile, -1 = art.wallTexId
    floorTexture: Int16Array;   // Task 2; -1 = art.floorTexId
  };
  art: { skyTexId: number; wallTexId: number; floorTexId: number; ceilingTexId: number };
  billboards: BillboardInput[];
  noDepthBillboards: BillboardInput[];
  baseLight: Uint8Array | null;             // Task 3
  pointLights: { x: number; y: number; r: number; g: number; b: number; power: number }[];
  tint: RgbMul;
  doorTiles: Uint8Array | null;             // 1 = door tile (column glow metadata)
}

// Moved verbatim from firstPersonRenderer.ts (delete it there).
export const NPC_SPRITE_MAP: Record<string, string> = {
  /* PORT VERBATIM from firstPersonRenderer.ts:455-461 */
};

export class SceneBuilder {
  private scene: RenderScene | null = null;
  private lastMap: BoardingMap | null = null;

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
    s.tint = art?.environmentTint ? hslShiftToRgbMul(art.environmentTint) : IDENTITY_TINT;

    s.billboards.length = 0;
    s.noDepthBillboards.length = 0;
    for (const p of fp.props ?? []) {
      s.billboards.push({ x: p.x, y: p.y, texId: reg.idFor(p.sprite, "billboard"), scale: p.scale ?? 1, alpha256: 256, widthFactor: 1, vAnchor: "prop", minSizeFrac: 20 / 714 });
    }
    for (const e of fp.enemies) {
      if (e.deathTimer === -1) continue;
      // PORT VERBATIM: frame selection + fade from drawEnemyBillboards
      // (firstPersonRenderer.ts:239-267): death frame while deathTimer>0 with
      // alpha = deathTimer/30; flinch frame under the classic flinch condition;
      // front frame otherwise.
      const sprite = /* ported conditional → */ SPRITES.FP_ENEMY_FRONT;
      const alpha = e.deathTimer > 0 ? Math.round((e.deathTimer / 30) * 256) : 256;
      s.billboards.push({ x: e.x, y: e.y, texId: reg.idFor(sprite, "billboard"), scale: 1, alpha256: alpha, widthFactor: 1, vAnchor: "center" });
    }
    for (const n of fp.npcs) {
      s.billboards.push({ x: n.x, y: n.y, texId: reg.idFor(NPC_SPRITE_MAP[n.name] ?? SPRITES.NPC_SURVIVOR, "billboard"), scale: 1, alpha256: 256, widthFactor: 0.4, vAnchor: "npc" });
    }
    // Objective marker: NOT pushed here. It stays the classic overlay
    // (drawObjectiveBillboard — glow + label are vector draws that already
    // render over everything, satisfying the spec's through-wall exception).
    // noDepthBillboards stays as the generic no-z-test mechanism (golden 8b
    // exercises it via fixtures); nothing populates it yet.
    // Task 3 fills these; identity until then:
    s.baseLight = null; s.pointLights.length = 0;
    return s;
  }
}

function rebuildMapArrays(s: RenderScene, map: BoardingMap, reg: TextureRegistry): void {
  const { width, height } = map;
  s.map.width = width; s.map.height = height;
  s.map.solid = new Uint8Array(width * height);
  s.map.wallTexture = new Int16Array(width * height).fill(-1);
  s.map.floorTexture = new Int16Array(width * height).fill(-1);
  s.doorTiles = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = map.tiles[y][x];
      const i = y * width + x;
      if (t === "wall" || t === "empty") s.map.solid[i] = 1;
      if (t === "door") s.doorTiles[i] = 1;
      const override = map.wallTextureMap?.[y]?.[x];
      if (override) s.map.wallTexture[i] = reg.idFor(override, "tile");
    }
  }
}

function emptyScene(): RenderScene { /* zeroed instance matching the interface */ }
```

(The two `PORT VERBATIM` markers are instructions to the implementer: copy the exact conditional out of the classic code before deleting it, so behavior is identical. `emptyScene()` is boilerplate — write it out fully.)

- [ ] **Step 1.8: Implement `renderCore.ts`**

The heart. Complete code:

```typescript
import { Framebuffer } from "./framebuffer";
import { TextureRegistry } from "./textures";
import type { RenderScene, BillboardInput } from "./sceneInput";

const FOG_R = 5, FOG_G = 5, FOG_B = 16;          // classic rgba(5,5,16,…)
const FOG_SCALE = 0.08, FOG_MAX = 179;           // min(0.7, d*0.08) → 0.7*256≈179
const SIDE_MUL = 179;                            // classic 30% darken ≈ ×0.7
const BILLBOARD_SCALE = 0.6;                     // classic size factor

// Ceiling/floor gradient fallback colors — copy the exact hex constants from
// firstPersonRenderer.ts:14-17 (CEILING_COLOR_TOP/BOT, FLOOR_COLOR_TOP/BOT)
// as packed 0xAABBGGRR literals here.

export function renderScene(fb: Framebuffer, s: RenderScene, reg: TextureRegistry): void {
  drawEnvironment(fb, s, reg);   // Task 1: screen-space fills; Task 2: true casting
  drawWalls(fb, s, reg);
  drawBillboards(fb, s, reg, s.billboards, true);
  drawBillboards(fb, s, reg, s.noDepthBillboards, false);
}

function drawEnvironment(fb: Framebuffer, s: RenderScene, reg: TextureRegistry): void {
  const { w, h, px } = fb;
  const half = h >> 1;
  // Ceiling / sky (top half)
  if (s.art.skyTexId >= 0) {
    const sky = reg.get(s.art.skyTexId);
    // Angle-offset horizontal sample, screen-space vertical — parity with the
    // classic repeat-x pattern translated by view angle.
    const angle = Math.atan2(s.dirY, s.dirX);
    const uOff = ((angle + Math.PI) / (2 * Math.PI)) * sky.w;
    for (let y = 0; y < half; y++) {
      const v = ((y * sky.h / half) | 0) & sky.hMask;
      const row = y * w, trow = v * sky.w;
      for (let x = 0; x < w; x++) {
        const u = ((x + uOff) | 0) & sky.wMask;
        px[row + x] = shade(sky.texels[trow + u], s.tint.rMul, s.tint.gMul, s.tint.bMul, 0);
      }
    }
    // classic warm haze overlay rgba(28,12,10,0.18) — fold into a constant
    // multiply here ONLY if playtest shows it's missed; start without it.
  } else if (s.art.ceilingTexId >= 0) {
    tileFill(fb, reg, s.art.ceilingTexId, 0, half, s.tint);      // pattern parity
  } else {
    gradientFill(fb, 0, half, CEIL_TOP, CEIL_BOT);
  }
  // Floor (bottom half)
  if (s.art.floorTexId >= 0) {
    tileFill(fb, reg, s.art.floorTexId, half, h, s.tint);
  } else {
    gradientFill(fb, half, h, FLOOR_TOP, FLOOR_BOT);
  }
}

function drawWalls(fb: Framebuffer, s: RenderScene, reg: TextureRegistry): void {
  const { w, h, px, zbuf, colDoor, colTop, colBot } = fb;
  const { width: mw, solid, wallTexture } = s.map;
  const defaultTex = reg.get(s.art.wallTexId);
  const half = h >> 1;

  for (let x = 0; x < w; x++) {
    const cameraX = 2 * x / w - 1;
    const rayX = s.dirX + s.planeX * cameraX;
    const rayY = s.dirY + s.planeY * cameraX;
    let mapX = s.camX | 0, mapY = s.camY | 0;
    const dDX = rayX === 0 ? 1e30 : Math.abs(1 / rayX);
    const dDY = rayY === 0 ? 1e30 : Math.abs(1 / rayY);
    let stepX: number, stepY: number, sideDistX: number, sideDistY: number;
    if (rayX < 0) { stepX = -1; sideDistX = (s.camX - mapX) * dDX; }
    else { stepX = 1; sideDistX = (mapX + 1 - s.camX) * dDX; }
    if (rayY < 0) { stepY = -1; sideDistY = (s.camY - mapY) * dDY; }
    else { stepY = 1; sideDistY = (mapY + 1 - s.camY) * dDY; }

    let side = 0, hit = 0, guard = 0;
    while (guard++ < 64) {
      if (sideDistX < sideDistY) { sideDistX += dDX; mapX += stepX; side = 0; }
      else { sideDistY += dDY; mapY += stepY; side = 1; }
      if (mapX < 0 || mapX >= mw || mapY < 0 || mapY >= s.map.height) break;
      if (solid[mapY * mw + mapX]) { hit = 1; break; }
    }
    let dist = side === 0 ? sideDistX - dDX : sideDistY - dDY;
    if (dist < 0.01) dist = 0.01;
    zbuf[x] = hit ? dist : 1e30;
    // Door glow metadata: doors are WALKABLE (never DDA hits), so the classic
    // glow (firstPersonRenderer.ts:813-826) checks the tile the ray stepped
    // THROUGH in front of the hit wall — record that stepped-back tile:
    if (s.doorTiles && hit) {
      const backX = side === 0 ? mapX - stepX : mapX;
      const backY = side === 1 ? mapY - stepY : mapY;
      colDoor[x] = s.doorTiles[backY * mw + backX] ?? 0;
    } else colDoor[x] = 0;
    if (!hit) { colTop[x] = half; colBot[x] = half; continue; }

    const lineH = (h / dist) | 0;
    let dStart = half - (lineH >> 1); if (dStart < 0) dStart = 0;
    let dEnd = half + (lineH >> 1); if (dEnd > h - 1) dEnd = h - 1;
    colTop[x] = dStart; colBot[x] = dEnd;

    let wallX = side === 0 ? s.camY + dist * rayY : s.camX + dist * rayX;
    wallX -= wallX | 0;
    const texOverride = wallTexture[mapY * mw + mapX];
    const tex = texOverride >= 0 ? reg.get(texOverride) : defaultTex;
    let texX = (wallX * tex.w) | 0;
    // Standard mirror-fix (lodev): classic renderer OMITS this, so two wall
    // faces render mirrored today. Keeping the fix is an intended deviation —
    // expect those faces to un-mirror in the playtest; don't chase it as a bug.
    if ((side === 0 && rayX > 0) || (side === 1 && rayY < 0)) texX = tex.w - texX - 1;

    const texStep = tex.h / lineH;
    let texPos = (dStart - half + (lineH >> 1)) * texStep;
    let fogF = (dist * FOG_SCALE * 256) | 0; if (fogF > FOG_MAX) fogF = FOG_MAX;
    const sideMul = side === 1 ? SIDE_MUL : 256;
    const lr = (s.tint.rMul * sideMul) >> 8, lg = (s.tint.gMul * sideMul) >> 8, lb = (s.tint.bMul * sideMul) >> 8;

    for (let y = dStart; y <= dEnd; y++) {
      const c = tex.texels[(((texPos | 0) & tex.hMask) * tex.w) + texX];
      texPos += texStep;
      px[y * w + x] = shade(c, lr, lg, lb, fogF);
    }
  }
}

function drawBillboards(fb: Framebuffer, s: RenderScene, reg: TextureRegistry,
                        list: BillboardInput[], depthTest: boolean): void {
  // sort far→near into a reused module scratch (no per-frame array allocation):
  // insertion-sort indices by squared distance (lists are small, ≤ ~20).
  /* ... complete in implementation: reused Int16Array index scratch ... */
  const { w, h, px, zbuf } = fb;
  const invDet = 1 / (s.planeX * s.dirY - s.dirX * s.planeY);
  const half = h >> 1;
  for (/* each billboard b, far→near */) {
    const rx = b.x - s.camX, ry = b.y - s.camY;
    const trX = invDet * (s.dirY * rx - s.dirX * ry);
    const trY = invDet * (-s.planeY * rx + s.planeX * ry);
    if (trY <= 0.1) continue;                  // classic near-plane cull (parity)
    if (b.texId < 0) continue;                 // guard: unresolved sprite
    const screenX = ((w / 2) * (1 + trX / trY)) | 0;
    let size = ((Math.abs(h / trY) * BILLBOARD_SCALE * b.scale) | 0);
    if (b.minSizeFrac) size = Math.max(size, (b.minSizeFrac * h) | 0);
    if (size < 2) continue;
    const tex = reg.get(b.texId);
    const bw = (size * b.widthFactor) | 0;     // NPC portraits are 0.4×
    let sx0 = screenX - (bw >> 1), sx1 = sx0 + bw - 1;
    let sy0 = b.vAnchor === "npc" ? half - ((size / 3) | 0)
            : b.vAnchor === "prop" ? half - ((size * 0.55) | 0)
            : half - (size >> 1);
    let sy1 = sy0 + size - 1;
    const cx0 = Math.max(0, sx0), cx1 = Math.min(w - 1, sx1);
    const cy0 = Math.max(0, sy0), cy1 = Math.min(h - 1, sy1);
    let fogF = (trY * FOG_SCALE * 256) | 0; if (fogF > FOG_MAX) fogF = FOG_MAX;
    const a = b.alpha256;
    for (let x = cx0; x <= cx1; x++) {
      if (depthTest && trY >= zbuf[x]) continue;
      const texX = (((x - sx0) * tex.w / bw) | 0) & tex.wMask;
      for (let y = cy0; y <= cy1; y++) {
        const texY = (((y - sy0) * tex.h / size) | 0) & tex.hMask;
        const c = tex.texels[texY * tex.w + texX];
        if (c >>> 24 === 0) continue;                       // alpha test
        const shaded = shade(c, s.tint.rMul, s.tint.gMul, s.tint.bMul, fogF);
        px[y * w + x] = a >= 256 ? shaded : blend(px[y * w + x], shaded, a);
      }
    }
  }
}
// NOTE Task 1 parity: billboards draw with IDENTITY tint (classic applyTint never
// wrapped sprites). Pass IDENTITY instead of s.tint here until Task 3, where
// billboards intentionally join the lighting model (spec-recorded change).

/** Multiply channels by (r,g,b)Mul (0–320) then lerp toward fog by fogF (0–256). */
function shade(c: number, rMul: number, gMul: number, bMul: number, fogF: number): number {
  let r = ((c & 0xff) * rMul) >> 8, g = (((c >>> 8) & 0xff) * gMul) >> 8, b = (((c >>> 16) & 0xff) * bMul) >> 8;
  if (r > 255) r = 255; if (g > 255) g = 255; if (b > 255) b = 255;
  if (fogF > 0) {
    r += ((FOG_R - r) * fogF) >> 8; g += ((FOG_G - g) * fogF) >> 8; b += ((FOG_B - b) * fogF) >> 8;
  }
  return 0xff000000 | (b << 16) | (g << 8) | r;
}

function blend(dst: number, src: number, a256: number): number { /* per-channel lerp */ }
function tileFill(/* screen-space repeat fill with tint — parity with createPattern.
  PARITY NOTE: the classic floor-texture path also draws a darken overlay
  rgba(10,8,12,0.28) over the pattern (firstPersonRenderer.ts:732-733) — fold it
  in as a constant lerp toward packed (10,8,12) with factor 72/256 for FLOOR
  fills only (not ceiling). Task 2's perspective floor cast inherits the same
  constant so the look doesn't shift between commits. */): void {}
function gradientFill(/* per-row two-stop gradient between packed colors */): void {}

/** Camera-space projection for overlay drawing (HP bars, name tags). */
export function projectBillboard(s: RenderScene, wx: number, wy: number, fbW: number, fbH: number):
  { screenX: number; size: number; dist: number } | null {
  const invDet = 1 / (s.planeX * s.dirY - s.dirX * s.planeY);
  const rx = wx - s.camX, ry = wy - s.camY;
  const trY = invDet * (-s.planeY * rx + s.planeX * ry);
  if (trY <= 0.1) return null;                 // match the billboard cull plane
  const trX = invDet * (s.dirY * rx - s.dirX * ry);
  return { screenX: (fbW / 2) * (1 + trX / trY), size: Math.abs(fbH / trY) * BILLBOARD_SCALE, dist: trY };
}
```

(Blocks marked `/* ... */` are completed by the implementer following the stated constraint — e.g. the reused sort scratch. Everything numeric is specified.)

- [ ] **Step 1.9: Implement `index.ts`**

```typescript
import { Framebuffer, presentFramebuffer } from "./framebuffer";
import { TextureRegistry } from "./textures";
import { SceneBuilder } from "./sceneInput";
import { renderScene, projectBillboard } from "./renderCore";
import type { FirstPersonState } from "../types";
import { CANVAS_WIDTH, GAME_AREA_HEIGHT } from "../types";

const registry = new TextureRegistry();
const builder = new SceneBuilder();
let fb = new Framebuffer(CANVAS_WIDTH, GAME_AREA_HEIGHT);   // Task 5 makes this switchable

export function drawFirstPersonPixel(ctx: CanvasRenderingContext2D, fp: FirstPersonState): void {
  registry.refresh();
  const scene = builder.build(fp, registry);
  renderScene(fb, scene, registry);
  presentFramebuffer(fb, ctx, CANVAS_WIDTH, GAME_AREA_HEIGHT);
}

export function currentFrame(): Framebuffer { return fb; }        // overlays read zbuf/colDoor
export function currentScene() { return builder.lastBuilt; }      // overlays project via
export { projectBillboard };
```

- [ ] **Step 1.10: Rewire `firstPersonRenderer.ts` and delete the classic scene code**

In `drawFirstPerson` (line ~679): replace the ceiling/sky fill, floor fill, `castAllRays` call, wall-column loop, and door-glow block with:

```typescript
drawFirstPersonPixel(ctx, fp);
drawDoorGlowOverlay(ctx);   // reads currentFrame().colDoor/colTop/colBot — port the
                            // classic glow colors/alpha verbatim from lines 813-826
```

Then: **delete** `drawEnemyBillboards`, `drawPropBillboards`, `drawNPCBillboards` (sprite drawing now in core) — but first extract from them: (a) the enemy HP-bar drawing, NPC name/type tag drawing, **and prop `label` text drawing** (`firstPersonRenderer.ts:381-387` — Ashfall props like "CAMP RIG" depend on it) into new overlay functions `drawEnemyHpBars(ctx)` / `drawNPCTags(ctx)` / `drawPropLabels(ctx)` that iterate entities, call `projectBillboard(...)`, and draw the same rects/text at the projected screen position. **Overlay projection convention (matters once Task 5 adds half-res):** always project at canvas dimensions — `projectBillboard(scene, x, y, CANVAS_WIDTH, GAME_AREA_HEIGHT)` — and scale the z-buffer index by the framebuffer ratio: `occluded = dist >= currentFrame().zbuf[(screenX * currentFrame().w / CANVAS_WIDTH) | 0]`. Projecting at fb dims would draw tags in the top-left quadrant at half-res; indexing zbuf at canvas coords would read past 240 → `undefined` → tags draw through walls; (b) the enemy frame-selection conditional and `NPC_SPRITE_MAP` (moved to `sceneInput.ts` in Step 1.7). Also delete `createDepthBuffer`, `WALL_COLORS` (fallbacks now live in the registry), the module color constants that moved into `renderCore.ts`, and the `applyTint`/`ctx.filter` calls around scene passes (billboards keep identity tint in this commit anyway; full lighting comes in Task 3 — **note:** classic applied the HSL filter to walls/floor/ceiling, and the new pipeline applies the converted RGB tint there, so colony day/night keeps working through this commit).
`drawObjectiveBillboard`, `drawGunHUD`, `drawMiniMap`, `drawCrosshair`, `drawCompass`, `drawDialogBox`, dashboard call: **unchanged**.

- [ ] **Step 1.11: Record goldens, add remaining Task-1 tests**

Run `UPDATE_GOLDENS=1 yarn engine:test`, paste printed hashes over the `REPLACE_ME_*` placeholders. Add to `renderCore.test.ts`: per-tile wall override changes the hash (golden 2); **fog monotonicity** — probe one wall column near vs one far, assert the far column's mid-strip pixel is closer to packed fog `(5,5,16)` per channel (golden 5, spec-required); billboard occluded by nearer wall leaves wall pixels intact vs no-depth billboard overwrites them (golden 8, two hashes); **alpha-hole transparency** — a billboard texture with zero-alpha corners (like the registry billboard fallback shape) leaves the environment visible through the holes (golden 8c; the opaque fixtures never exercise the alpha test otherwise); tint identity vs non-identity hashes differ (golden 7); randomized-camera property test (100 random open-cell cameras → no exception, all pixels opaque); **SceneBuilder reuse** — `build()` twice with the same map returns the same `RenderScene` instance and the same typed-array instances (`assert.equal` on references), and a new map object triggers rebuilt arrays.

- [ ] **Step 1.12: Verify everything**

Run: `yarn engine:test && yarn colony:test && npx tsc --noEmit && yarn build`
Expected: all green. Then manual smoke: `yarn build && npx serve@latest out` → DevPanel → FIRST PERSON, EXPLORE (Ashfall: NPCs visible, dialog works, props draw), COLONY SEEDS DAY (walls per-building, minimap fine).

- [ ] **Step 1.13: Add CI step**

In `.github/workflows/pr-checks.yml`, beside the colony-test step: `run: yarn engine:test` (working dir `game`, mirroring the existing step exactly).

- [ ] **Step 1.14: Commit**

```bash
git add -A && git commit -m "feat(engine): per-pixel FP renderer replaces classic scene path

Framebuffer pipeline at visual parity: textured walls (per-tile overrides,
BOARDING_TILES atlas slice), fog/side-shade constants preserved, billboards
depth-tested with death-fade, objective marker kept as through-wall overlay,
HP bars/tags/door glow as projected overlays. Classic scene code deleted.
Golden-frame + property tests under yarn engine:test; CI step added."
```

---

### Task 2: True floor/ceiling perspective casting + colony floor data (commit 2)

**Files:**
- Modify: `game/app/components/engine/fpRender/renderCore.ts` (`drawEnvironment` → perspective casting)
- Modify: `game/app/components/engine/fpRender/sceneInput.ts` (populate `floorTexture` from `map.floorTextureMap`)
- Modify: `game/app/components/engine/types.ts` (add `floorTextureMap?: (string | null)[][]` to `BoardingMap`, next to `wallTextureMap`)
- Modify: `game/app/components/colony/exploration/colonyLayout.ts` (write floor data)
- Test: `game/tests/engine/renderCore.test.ts` (goldens 3–4), `game/tests/colony/colonyLayout.test.ts` (one new assertion)

- [ ] **Step 2.1: Write failing golden — floor tile boundaries**

Scene: `tinyScene({ art: { ...defaults, floorTexId: 2 } })` plus `floorTexture[4*8+3] = 1` (one overridden tile in front of the camera). Assert: hash changes when the override is present vs absent, and the boundary column where tile 3→4 crosses mid-screen matches the map (probe: sample two pixels straddling the boundary row/col and assert they differ). Also golden 4: `ceilingTexId >= 0` with `skyTexId = -1` produces a perspective-cast ceiling hash (record new hash). **Task-1 goldens are untouched by this task** — they all use gradient floors (`floorTexId: -1`, identical pixels before/after casting); if any Task-1 hash changes here, that's a real regression, not an expected re-record.

Run: `yarn engine:test` → new tests FAIL (env fills are still screen-space).

- [ ] **Step 2.2: Implement perspective casting in `drawEnvironment`**

Replace `tileFill` usage for floor (and interior ceiling) with the standard per-row cast; sky keeps the Task-1 angle sample (already correct for a panorama):

```typescript
const rd0x = s.dirX - s.planeX, rd0y = s.dirY - s.planeY;
const rd1x = s.dirX + s.planeX, rd1y = s.dirY + s.planeY;
const floorDefault = s.art.floorTexId >= 0 ? reg.get(s.art.floorTexId) : null;
const ceilTex = s.art.ceilingTexId >= 0 ? reg.get(s.art.ceilingTexId) : null;
const { width: mw, height: mh, floorTexture } = s.map;
for (let y = half + 1; y < h; y++) {
  const rowDist = (h * 0.5) / (y - h * 0.5);
  const stepX = rowDist * (rd1x - rd0x) / w;
  const stepY = rowDist * (rd1y - rd0y) / w;
  let fx = s.camX + rowDist * rd0x;
  let fy = s.camY + rowDist * rd0y;
  let fogF = (rowDist * FOG_SCALE * 256) | 0; if (fogF > FOG_MAX) fogF = FOG_MAX;
  const rowF = y * w, rowC = (h - 1 - y) * w;
  for (let x = 0; x < w; x++) {
    const cellX = fx | 0, cellY = fy | 0;
    let ftex = floorDefault;
    if (cellX >= 0 && cellX < mw && cellY >= 0 && cellY < mh) {
      const ov = floorTexture[cellY * mw + cellX];
      if (ov >= 0) ftex = reg.get(ov);
    }
    if (ftex) {
      const tx = ((fx - cellX) * ftex.w) | 0, ty = ((fy - cellY) * ftex.h) | 0;
      // REMEMBER: fold the classic floor-darken here too — lerp toward packed
      // (10,8,12) by 72/256 AFTER shade(), exactly as Step 1.8's tileFill does.
      // Dropping it brightens floors between commits 1→2 (no golden pins it).
      px[rowF + x] = shade(ftex.texels[ty * ftex.w + tx], s.tint.rMul, s.tint.gMul, s.tint.bMul, fogF);
    } // else keep the gradient already painted for this row (paint gradient first)
    if (ceilTex && s.art.skyTexId < 0) {   // sky takes precedence (Task-1 semantics)
      const tx = ((fx - cellX) * ceilTex.w) | 0, ty = ((fy - cellY) * ceilTex.h) | 0;
      px[rowC + x] = shade(ceilTex.texels[ty * ceilTex.w + tx], s.tint.rMul, s.tint.gMul, s.tint.bMul, fogF);
    }
    fx += stepX; fy += stepY;
  }
}
```

Ordering rule: paint gradients (or sky) for both halves FIRST, then the cast overwrites — keeps the no-texture fallback correct without branching per pixel. Walls still draw after and overwrite the horizon band.

- [ ] **Step 2.3: Record goldens, run suite** — `UPDATE_GOLDENS=1 yarn engine:test`, paste, then full green run.

- [ ] **Step 2.4: Type + colony data**

`types.ts` — add to `BoardingMap` (after `wallTextureMap`): `floorTextureMap?: (string | null)[][];`
`sceneInput.ts::rebuildMapArrays` — populate `s.map.floorTexture` from it (same pattern as walls).
`colonyLayout.ts` — in `generateExteriorState`: build `floorTextureMap` writing `SPRITES.COLONY_LANDING_PAD` on the 4×4 pad region and `SPRITES.COLONY_FOUNDATION` on `foundationCells`; in `generateInteriorState`: fill all floor tiles with the interior floor sprite already used for `environmentArt.floorSprite` (per-template variety is future data, not new code). **Plaza tiles: deliberately not written** — they fall through to the default ground texture until a paving asset exists (spec records this; the format supports it the day the asset lands, zero code).

- [ ] **Step 2.5: Colony test + verify**

Add to `colonyLayout.test.ts`: pad tile `(11,20)` has `floorTextureMap` = landing-pad sprite; a constructing fixture writes foundation cells. Run all four verification commands. Manual: COLONY SEEDS DAY — **landing pad visibly textured on the ground**; DAWN — foundation outlines visible.

- [ ] **Step 2.6: Commit** — `feat(engine): perspective floor/ceiling casting + colony pad/foundation floors`

---

### Task 3: Lighting system (commit 3)

**Files:**
- Modify: `game/app/components/engine/fpRender/lighting.ts` (LightGrid)
- Modify: `game/app/components/engine/fpRender/renderCore.ts` (sample grid; billboards join lighting)
- Modify: `game/app/components/engine/fpRender/sceneInput.ts` (baseLight/pointLights from state)
- Modify: `game/app/components/engine/types.ts` (`FPEnvironmentArt.pointLights?`, `BoardingMap.lightMap?`)
- Modify: `game/app/components/colony/exploration/colonyLayout.ts` (night door/scaffold lights)
- Modify: `game/app/components/engine/firstPersonRenderer.ts` (door glow becomes emissive light; delete overlay)
- Test: `game/tests/engine/lighting.test.ts` (grid math), `renderCore.test.ts` (goldens 6–7)

- [ ] **Step 3.1: Failing tests — grid math**

```typescript
test("point light falls off with squared distance and caps at 320", () => {
  // NOTE: neutral base is 256 with cap 320 — only 64 of headroom. Probe cells
  // must be far enough that the contribution is UNclamped, or the assertion is
  // unsatisfiable. With dim base 100 and power 1:
  //   at(4,4): 100 + 255·1/1        → clamped 320
  //   at(6,4): 100 + 255·1/(1+4)    = 151   (unclamped)
  //   at(7,4): 100 + 255·1/(1+9)    ≈ 125   (unclamped)
  const base = new Uint8Array(64).fill(100);
  const grid = buildLightGrid(8, 8, base, [{ x: 4.5, y: 4.5, r: 255, g: 200, b: 150, power: 1 }],
    { rMul: 256, gMul: 256, bMul: 256 });
  const at = (x: number, y: number) => grid.r[y * 8 + x];
  assert.equal(at(4, 4), 320, "center clamps at 320");
  assert.ok(at(6, 4) > at(7, 4), "unclamped falloff is monotonic");
  assert.ok(at(6, 4) < 320 && at(7, 4) < 320);
});
test("neutral grid is 256 (hour-12 identity)", () => {
  const g = buildLightGrid(2, 2, null, [], { rMul: 256, gMul: 256, bMul: 256 });
  assert.equal(g.r[0], 256); assert.equal(g.g[0], 256); assert.equal(g.b[0], 256);
});
test("baseLight scales and tint multiplies", () => { /* baseLight 128 → Math.round((128/255)*256) = 129 (NOT 128 — don't "fix" the impl to match a wrong literal); night tint composes */ });
```

- [ ] **Step 3.2: Implement `LightGrid`**

```typescript
export interface LightGrid { r: Int16Array; g: Int16Array; b: Int16Array; w: number; h: number }

export function buildLightGrid(
  w: number, h: number,
  baseLight: Uint8Array | null,
  lights: RenderScene["pointLights"],
  tint: RgbMul,
  out?: LightGrid,                       // reuse — SceneBuilder owns one instance
): LightGrid {
  const g = out && out.w === w && out.h === h ? out
    : { r: new Int16Array(w * h), g: new Int16Array(w * h), b: new Int16Array(w * h), w, h };
  for (let i = 0; i < w * h; i++) {
    const base = baseLight ? baseLight[i] : 255;                 // 0–255
    // Math.round((base/255) * tintMul) — NOT (base*tintMul)>>8, which yields 255
    // for the neutral case and fails the identity test / dims every golden.
    let r = Math.round((base / 255) * tint.rMul);
    let gg = Math.round((base / 255) * tint.gMul);
    let b = Math.round((base / 255) * tint.bMul);
    const cx = (i % w) + 0.5, cy = ((i / w) | 0) + 0.5;
    for (const L of lights) {
      const dx = cx - L.x, dy = cy - L.y;
      const f = L.power / (1 + dx * dx + dy * dy);               // no sqrt
      r += L.r * f; gg += L.g * f; b += L.b * f;
    }
    g.r[i] = r > 320 ? 320 : r; g.g[i] = gg > 320 ? 320 : gg; g.b[i] = b > 320 ? 320 : b;
  }
  return g;
}
```

Fixed-point convention: grid values are **light multipliers**, 0–320 with 256 = neutral. Store the base+tint term as `Math.round((base / 255) * tintMul)` so `base=255, tint=256` → exactly 256 (hour-12 identity; unit-tested above), then add point-light contributions `L.channel * power / (1 + d²)` and clamp to 320.

- [ ] **Step 3.3: Wire into the pipeline**

- `sceneInput.ts`: `s.baseLight` from `fp.map.lightMap` (flatten rows once per map identity, `Uint8Array`); `s.pointLights` from `fp.environmentArt.pointLights` (parse `color` hex → r/g/b once per frame into reused array objects); door tiles get an emissive boost — when building lights, push a small white light (power 0.8) at each door tile center *when the facing tile is a door* (port the classic look-at glow trigger from the deleted overlay; `SceneBuilder` computes facing tile with the same dominant-axis rule the engine uses).
- `renderCore.ts`: `renderScene` builds the grid first (via builder-owned instance), then floor/ceiling pixels shade by their cell's grid entry instead of raw tint; wall columns by hit-tile entry (fold with `sideMul`); **billboards now shade by their anchor tile's grid entry — the spec-recorded intentional change** (delete the Task-1 identity-tint note).
- `firstPersonRenderer.ts`: delete `drawDoorGlowOverlay` (superseded by emissive door light).
- `types.ts`: `FPEnvironmentArt.pointLights?: { x: number; y: number; color: string; power: number }[]`; `BoardingMap.lightMap?: number[][]`.
- `colonyLayout.ts`: when `gameClock.hour >= 20 || hour < 6`, emit warm `#ffb066` power-2 lights at each operational building's exterior door tile and cool `#9fd0ff` power-1.5 at scaffolding centers.

- [ ] **Step 3.4: Goldens 6–7 + verify + commit**

Golden 6: one point light in the tiny scene — hash + monotonic probe (pixel near light brighter than far). Golden 7: night tint scene hash ≠ identity hash; hour-12 grid neutral test. Full verification commands. Manual: NIGHT fixture — dark colony, lit doors; DAY unchanged vs Task-2 screenshots. `grep -rn "ctx.filter" app/` → no scene-path hits.
Commit: `feat(engine): tile-grid lighting — point lights, day/night-as-lighting, emissive doors`

---

### Task 4: Billboard/overlay hardening pass (commit 4)

Cross-surface verification with fixes; the heavy lifting happened in Task 1. Scope: (a) playtest all four surfaces specifically for sprite regressions (enemy flinch/death across W5-L3 + Kepler combat, NPC tags in Ashfall, interior props in colony); (b) audit that `fpRender/` has zero steady-state allocations — take a 10s Chrome DevTools allocation timeline while walking a colony; fix any found (usual suspects: the billboard sort scratch, pointLights parsing, `refresh()` filter); (c) add golden: two overlapping billboards at different depths blend correctly (near-over-far).

**Files:** whatever (a)/(b) surface — expected: `renderCore.ts`, `sceneInput.ts` only.

- [ ] Step 4.1: Playtest checklist run (all four surfaces) — record findings in commit message
- [ ] Step 4.2: Allocation-timeline audit; eliminate steady-state allocations found
- [ ] Step 4.3: Overlap golden + full verification commands
- [ ] Step 4.4: Commit — `fix(engine): billboard parity fixes + zero-alloc audit from cross-surface playtest`

---

### Task 5: Adaptive internal resolution + DevPanel perf readout (commit 5)

**Files:**
- Modify: `game/app/components/engine/fpRender/index.ts` (resolution manager + frame timing)
- Modify: `game/app/components/DevPanel.tsx` (readout + FULL/HALF/AUTO)
- Test: `game/tests/engine/renderCore.test.ts` (golden 10: half-res validity)

- [ ] **Step 5.1: Failing test** — render the tiny scene into a 240×357 `Framebuffer`; assert opaque pixels + stable hash (golden 10).

- [ ] **Step 5.2: Resolution manager in `index.ts`**

```typescript
type ResMode = "auto" | "full" | "half";
const RES_KEY = "szFpResolution";
let resMode: ResMode = "auto";
let locked: "full" | "half" = "full";      // AUTO never switches back up mid-session
const fbFull = new Framebuffer(CANVAS_WIDTH, GAME_AREA_HEIGHT);
const fbHalf = new Framebuffer(CANVAS_WIDTH / 2, GAME_AREA_HEIGHT / 2);
const frameMs = new Float32Array(120); let frameIdx = 0, frameCount = 0;

export function setResolutionMode(m: ResMode): void { /* set + persist to localStorage */ }
export function getPerfStats(): { p50: number; p95: number; res: string } { /* sort copy of filled window */ }

export function drawFirstPersonPixel(ctx: CanvasRenderingContext2D, fp: FirstPersonState): void {
  const t0 = performance.now();
  registry.refresh();
  const fb = pickFramebuffer();
  const scene = builder.build(fp, registry);
  renderScene(fb, scene, registry);
  presentFramebuffer(fb, ctx, CANVAS_WIDTH, GAME_AREA_HEIGHT);
  frameMs[frameIdx] = performance.now() - t0;
  frameIdx = (frameIdx + 1) % 120; frameCount++;
  maybeDowngrade();   // AUTO && frameCount ≥ 120 && p95 > 12 → locked = "half", persist
}
```

Overlays keep working at half-res because Step 1.10's projection convention projects at canvas dims and scales the zbuf index by `fb.w / CANVAS_WIDTH` — verify that convention survived when touching this file. Init: read `localStorage.getItem(RES_KEY)` (`"half"` → start locked half) — **lazily on the first `drawFirstPersonPixel` call, NOT at module scope**: this module is in Next's prerender graph and `localStorage`/`document` at import time breaks `yarn build`. (Same reason `presentFramebuffer` creates its canvas lazily.) Half-res framebuffer note: 357 is odd — the framebuffer is 240×357 and presents to 480×714 (2× exact). All `h >> 1` horizon math already handles odd heights.

- [ ] **Step 5.3: DevPanel** — new section `FP RENDER`: live text `p50/p95 ms + FULL|HALF`, refreshed on the panel's existing tick; three buttons calling `setResolutionMode`. Match the COLONY SEEDS section's styling/markup exactly.

- [ ] **Step 5.4: Verify + commit** — suite green; manual: force HALF (chunky but correct), force FULL, AUTO with DevTools CPU throttle 6× → downgrades once and sticks; localStorage persists across reload. Commit: `feat(engine): adaptive internal resolution + DevPanel perf readout`

---

### Task 6: Frame-rate-independent movement (commit 6)

**Files:**
- Modify: `game/app/components/Game.tsx` (rAF loop computes `dtMs`, passes to `updateGame`)
- Modify: `game/app/components/engine/gameEngine.ts` (real signature is `updateGame(state, keys, touchX, touchY)` — append `dtMs = 16.67` as the fifth param; forwards to the three engines)
- Modify: `game/app/components/engine/firstPersonEngine.ts`, `groundEngine.ts`, `boardingEngine.ts`
- Tests: extend each engine's existing self-test pattern (`__runFirstPersonSelfTests`)

- [ ] **Step 6.1: Plumb dt**

`Game.tsx` rAF callback (the `updateGame` call site ~line 1291): keep `lastFrameTs` in a ref; `const dtMs = Math.min(now - lastFrameTs, 50); lastFrameTs = now;` pass `dtMs`. `updateGame` signature gains `dtMs = 16.67` default; forwards only to `updateFirstPerson`, `updateGroundEngine`, `updateBoardingEngine` (shooter/turret unchanged — out of scope per spec).

- [ ] **Step 6.2: Scale the three engines**

Pattern per engine: `const dtF = Math.min(dtMs / 16.67, 3);` — multiply **positional deltas and rotations** by `dtF` (`MOVE_SPEED`, `ROT_SPEED`, enemy `speed` steps); **decrement frame-counter timers by `dtF`** instead of 1 (`gunFireTimer`, `gunCooldown`, `fireTimer`, `colonyInteractCooldownFrames`), changing `=== 0` checks to `<= 0` **with a floor at 0** for cooldown-style timers.

**Exception — `deathTimer` (do NOT clamp at 0):** it uses −1 as the "remove me" sentinel — the engine sets exactly −1 when the countdown ends (`firstPersonEngine.ts:288`), removal filters `!== -1` (`:381`), and alive checks are `!== 0` (`:225`). Decrement by `dtF` only; the existing `if (deathTimer <= 0) deathTimer = -1` transition already handles fractional values. Clamping it at 0 makes dying enemies immortal.

Also scale `groundEngine.ts:287`'s `fireTimer += 1` (flyer bob accumulator) by `dtF`, or bob frequency becomes framerate-dependent. Collision: unchanged (`moveWithCollision` already takes the delta as argument). Keep constants' names/values — semantics stay "per 16.67ms".

- [ ] **Step 6.3: Self-tests + verify**

Extend `__runFirstPersonSelfTests`: two updates at `dtMs=8.33` move the same distance as one at `16.67` (±1e-9); `dtMs=200` clamps to 3 frames' worth; cooldown at `dtF=3` never skips the `<= 0` firing window; a dying enemy at `dtF=3` still transitions to `deathTimer === -1` and gets removed. **Ground/boarding engines have no existing self-test functions** — do not invent test harnesses for them; their dt scaling is verified by the same code-pattern review plus the manual throttle playtest below (they share the identical `dtF` mechanism). Full verification commands + manual: normal feel at 60fps; DevTools 6× CPU throttle → game slower in fps but movement speed unchanged in wall-clock terms, in all three modes (FP, ground-run, boarding).

- [ ] **Step 6.4: Commit** — `feat(engine): frame-rate-independent movement (FP, ground, boarding)`

---

## Final verification (before PR)

- [ ] All four commands green: `yarn engine:test` (≥12 tests), `yarn colony:test` (100/100), `npx tsc --noEmit`, `yarn build`
- [ ] `grep -rn "ctx.filter\|createPattern" game/app/components/engine/firstPersonRenderer.ts game/app/components/engine/fpRender/` → zero hits
- [ ] `grep -n "WALL_COLORS\|createDepthBuffer\|castAllRays" game/app/components/engine/firstPersonRenderer.ts` → zero hits (classic scene path fully gone)
- [ ] DevPanel readout during colony walk: p50 ≤ 4ms full-res
- [ ] Manual playtest checklist (spec Section E): W5-L3, Kepler, Ashfall (NPC dialog + shop), colony DAY/NIGHT/DAWN + interiors, forced-HALF session
- [ ] Push branch, open PR titled `feat(engine): FP pixel graphics system` targeting `main` **after PR #5 merges** (user decision pending — if #5 is still open at PR time, ask the user, don't merge #5 unilaterally)

## Execution notes

- Tasks are strictly sequential; each ends with a green, playable commit.
- When porting "verbatim" blocks (enemy frame selection, NPC_SPRITE_MAP, door-glow colors, gradient constants), copy from the classic code **before** deleting it — same commit, but read first.
- If a golden hash changes unexpectedly in a later task, that's a behavior regression in a supposedly-unrelated pass — stop and diagnose (superpowers:systematic-debugging), don't re-record.
- Perf sanity mid-build: `docs/superpowers/specs/2026-07-02-fp-graphics-bench.html` shows the methodology; the DevPanel readout (Task 5) is the live source of truth. Numbers meaningfully above 2–3× the bench's 2.4ms at full res on the dev machine indicate an inner-loop mistake (allocation, non-integer math, per-pixel division).


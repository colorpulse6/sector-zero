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

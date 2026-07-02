import { Framebuffer } from "./framebuffer";
import { TextureRegistry } from "./textures";
import type { RenderScene, BillboardInput } from "./sceneInput";

const FOG_R = 5, FOG_G = 5, FOG_B = 16;          // classic rgba(5,5,16,…)
const FOG_SCALE = 0.08, FOG_MAX = 179;           // min(0.7, d*0.08) → 0.7*256≈179
const SIDE_MUL = 179;                            // classic 30% darken ≈ ×0.7
const BILLBOARD_SCALE = 0.6;                     // classic size factor

// Ceiling/floor gradient fallback colors — ported from the classic renderer's
// CEILING_COLOR_TOP/BOT ("#050510"/"#0a0a20") and FLOOR_COLOR_TOP/BOT
// ("#1a1a2a"/"#0a0a15") as packed 0xAABBGGRR literals.
const CEIL_TOP = 0xff100505, CEIL_BOT = 0xff200a0a;
const FLOOR_TOP = 0xff2a1a1a, FLOOR_BOT = 0xff150a0a;

// Classic floor-texture darken overlay rgba(10,8,12,0.28) → lerp toward
// packed (10,8,12) with factor 72/256, folded into the floor fill only.
const DARKEN_R = 10, DARKEN_G = 8, DARKEN_B = 12, DARKEN_F = 72;

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
    tileFill(fb, reg, s.art.ceilingTexId, 0, half, s.tint, false);   // pattern parity
  } else {
    gradientFill(fb, 0, half, CEIL_TOP, CEIL_BOT);
  }
  // Floor (bottom half)
  if (s.art.floorTexId >= 0) {
    tileFill(fb, reg, s.art.floorTexId, half, h, s.tint, true);
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

// Reused far→near sort scratch — no per-frame array allocation (lists ≤ ~20).
let sortIdx = new Int16Array(64);
let sortDist = new Float32Array(64);

function ensureSortScratch(n: number): void {
  if (sortIdx.length >= n) return;
  let cap = sortIdx.length;
  while (cap < n) cap <<= 1;
  sortIdx = new Int16Array(cap);
  sortDist = new Float32Array(cap);
}

function drawBillboards(fb: Framebuffer, s: RenderScene, reg: TextureRegistry,
                        list: BillboardInput[], depthTest: boolean): void {
  const n = list.length;
  if (n === 0) return;
  // sort far→near into the reused module scratch: insertion-sort indices by
  // squared distance (descending).
  ensureSortScratch(n);
  for (let i = 0; i < n; i++) {
    const dx = list[i].x - s.camX, dy = list[i].y - s.camY;
    sortDist[i] = dx * dx + dy * dy;
    sortIdx[i] = i;
  }
  for (let i = 1; i < n; i++) {
    const idx = sortIdx[i], d = sortDist[idx];
    let j = i - 1;
    while (j >= 0 && sortDist[sortIdx[j]] < d) { sortIdx[j + 1] = sortIdx[j]; j--; }
    sortIdx[j + 1] = idx;
  }

  const { w, h, px, zbuf } = fb;
  const invDet = 1 / (s.planeX * s.dirY - s.dirX * s.planeY);
  const half = h >> 1;
  for (let bi = 0; bi < n; bi++) {
    const b = list[sortIdx[bi]];
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
    const sx0 = screenX - (bw >> 1), sx1 = sx0 + bw - 1;
    const sy0 = b.vAnchor === "npc" ? half - ((size / 3) | 0)
              : b.vAnchor === "prop" ? half - ((size * 0.55) | 0)
              : half - (size >> 1);
    const sy1 = sy0 + size - 1;
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
        // Task 1 parity: billboards draw with IDENTITY tint (classic applyTint
        // never wrapped sprites). Billboards join the lighting model in Task 3
        // (spec-recorded change) — until then, only fog applies here.
        const shaded = shade(c, 256, 256, 256, fogF);
        px[y * w + x] = a >= 256 ? shaded : blend(px[y * w + x], shaded, a);
      }
    }
  }
}

/** Multiply channels by (r,g,b)Mul (0–320) then lerp toward fog by fogF (0–256). */
function shade(c: number, rMul: number, gMul: number, bMul: number, fogF: number): number {
  let r = ((c & 0xff) * rMul) >> 8, g = (((c >>> 8) & 0xff) * gMul) >> 8, b = (((c >>> 16) & 0xff) * bMul) >> 8;
  if (r > 255) r = 255; if (g > 255) g = 255; if (b > 255) b = 255;
  if (fogF > 0) {
    r += ((FOG_R - r) * fogF) >> 8; g += ((FOG_G - g) * fogF) >> 8; b += ((FOG_B - b) * fogF) >> 8;
  }
  return 0xff000000 | (b << 16) | (g << 8) | r;
}

/** Per-channel lerp of src over dst by a256 (0–256). */
function blend(dst: number, src: number, a256: number): number {
  const inv = 256 - a256;
  const r = ((dst & 0xff) * inv + (src & 0xff) * a256) >> 8;
  const g = (((dst >>> 8) & 0xff) * inv + ((src >>> 8) & 0xff) * a256) >> 8;
  const b = (((dst >>> 16) & 0xff) * inv + ((src >>> 16) & 0xff) * a256) >> 8;
  return 0xff000000 | (b << 16) | (g << 8) | r;
}

/** Screen-space repeat fill with tint — parity with the classic canvas
 *  pattern fills. `floorDarken` folds the classic floor darken overlay rgba(10,8,12,0.28)
 *  (firstPersonRenderer.ts:732-733) in as a constant lerp — FLOOR fills only,
 *  not ceiling. Task 2's perspective floor cast inherits the same constant so
 *  the look doesn't shift between commits. */
function tileFill(fb: Framebuffer, reg: TextureRegistry, texId: number,
                  y0: number, y1: number, tint: RenderScene["tint"], floorDarken: boolean): void {
  const { w, px } = fb;
  const tex = reg.get(texId);
  for (let y = y0; y < y1; y++) {
    const trow = (y & tex.hMask) * tex.w;
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let c = shade(tex.texels[trow + (x & tex.wMask)], tint.rMul, tint.gMul, tint.bMul, 0);
      if (floorDarken) {
        let r = c & 0xff, g = (c >>> 8) & 0xff, b = (c >>> 16) & 0xff;
        r += ((DARKEN_R - r) * DARKEN_F) >> 8;
        g += ((DARKEN_G - g) * DARKEN_F) >> 8;
        b += ((DARKEN_B - b) * DARKEN_F) >> 8;
        c = 0xff000000 | (b << 16) | (g << 8) | r;
      }
      px[row + x] = c;
    }
  }
}

/** Per-row two-stop gradient between packed colors over rows [y0, y1). */
function gradientFill(fb: Framebuffer, y0: number, y1: number, top: number, bot: number): void {
  const { w, px } = fb;
  const tr = top & 0xff, tg = (top >>> 8) & 0xff, tb = (top >>> 16) & 0xff;
  const br = bot & 0xff, bg = (bot >>> 8) & 0xff, bb = (bot >>> 16) & 0xff;
  const span = y1 - y0;
  for (let y = y0; y < y1; y++) {
    const f = (((y - y0) << 8) / span) | 0;
    const r = tr + (((br - tr) * f) >> 8);
    const g = tg + (((bg - tg) * f) >> 8);
    const b = tb + (((bb - tb) * f) >> 8);
    const c = 0xff000000 | (b << 16) | (g << 8) | r;
    const row = y * w;
    for (let x = 0; x < w; x++) px[row + x] = c;
  }
}

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

import { Framebuffer } from "./framebuffer";
import { TextureRegistry } from "./textures";
import { buildLightGrid } from "./lighting";
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
  // Light grid first (Section B/C pipeline order): reused instance lives on
  // the RenderScene itself, which SceneBuilder persists across frames — this
  // keeps renderScene free of hidden module state (it writes its arguments
  // directly — fb's pixels/zbuf and s.lightGrid — rather than stashing
  // lighting state at module scope; the billboard sort scratch below is the
  // one existing module-level exception, kept as-is from Task 1).
  s.lightGrid = buildLightGrid(s.map.width, s.map.height, s.baseLight, s.pointLights, s.tint, s.lightGrid);
  drawEnvironment(fb, s, reg);   // gradient/sky base + perspective floor/ceiling cast
  drawWalls(fb, s, reg);
  drawBillboards(fb, s, reg, s.billboards, true);
  drawBillboards(fb, s, reg, s.noDepthBillboards, false);
}

function drawEnvironment(fb: Framebuffer, s: RenderScene, reg: TextureRegistry): void {
  const { w, h, px } = fb;
  const half = h >> 1;
  // Ceiling / sky (top half) — painted FIRST as a base layer. Sky is a
  // panorama sample (already correct, no perspective cast needed) and owns
  // the whole top half when present. Otherwise the gradient is the base that
  // the perspective ceiling cast below overwrites where a ceiling texture is
  // set — painting it unconditionally (even when a ceiling texture exists)
  // keeps the no-texture fallback correct without a per-pixel branch.
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
  } else {
    gradientFill(fb, 0, half, CEIL_TOP, CEIL_BOT);
  }
  // Floor (bottom half) — same base-layer-first rule as the ceiling above.
  gradientFill(fb, half, h, FLOOR_TOP, FLOOR_BOT);

  // Perspective floor/ceiling cast (standard per-row technique): world-space
  // step per screen row, incremented per pixel across the row. Ceiling reuses
  // the same (fx,fy) walk mirrored across the horizon (rowC = h-1-y) since a
  // camera at the floor/ceiling midpoint sees symmetric distances both ways.
  const rd0x = s.dirX - s.planeX, rd0y = s.dirY - s.planeY;
  const rd1x = s.dirX + s.planeX, rd1y = s.dirY + s.planeY;
  const floorDefault = s.art.floorTexId >= 0 ? reg.get(s.art.floorTexId) : null;
  // Sky takes precedence over a ceiling texture (Task-1 semantics) — resolved
  // once here so the pixel loop tests a single reference.
  const castCeil = s.art.skyTexId < 0 && s.art.ceilingTexId >= 0 ? reg.get(s.art.ceilingTexId) : null;
  // Loop invariants hoisted out of the pixel loop (matches drawWalls' style).
  // rMul/gMul/bMul double as the out-of-map-bounds lighting fallback below:
  // with no baseLight and no point lights the grid equals the plain tint at
  // every in-bounds cell too (see lighting.ts), so this fallback is exact.
  const { rMul, gMul, bMul } = s.tint;
  const { width: mw, height: mh, floorTexture } = s.map;
  const grid = s.lightGrid;
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
      let lr = rMul, lg = gMul, lb = bMul;
      if (cellX >= 0 && cellX < mw && cellY >= 0 && cellY < mh) {
        const gi = cellY * mw + cellX;
        const ov = floorTexture[gi];
        if (ov >= 0) ftex = reg.get(ov);
        lr = grid.r[gi]; lg = grid.g[gi]; lb = grid.b[gi];
      }
      if (ftex) {
        // Texel reads masked like walls/billboards: `|0` truncates toward
        // zero, so fx in (-1,0) yields a NEGATIVE fraction -> negative index
        // -> undefined texel (silent black). These reads DO occur every frame
        // — measured: walls draw over the resulting black pixels at typical
        // camera positions, but the OOB slow path (negative-index property
        // lookup + V8 deopt) still runs and costs ~20%/frame before masking,
        // plus transient GC garbage from the deopt. Masking is free and kills
        // both the visible smear and the cost.
        const tx = (((fx - cellX) * ftex.w) | 0) & ftex.wMask;
        const ty = (((fy - cellY) * ftex.h) | 0) & ftex.hMask;
        const c = shade(ftex.texels[ty * ftex.w + tx], lr, lg, lb, fogF);
        // Classic floor-darken overlay rgba(10,8,12,0.28), applied AFTER
        // shade() — same fold Task 1's tileFill used for textured floors.
        // Ceiling never darkens (FLOOR only, matches the classic renderer).
        px[rowF + x] = darkenFloor(c);
      } // else keep the gradient already painted for this row (paint gradient first)
      if (castCeil) {
        const tx = (((fx - cellX) * castCeil.w) | 0) & castCeil.wMask;
        const ty = (((fy - cellY) * castCeil.h) | 0) & castCeil.hMask;
        px[rowC + x] = shade(castCeil.texels[ty * castCeil.w + tx], lr, lg, lb, fogF);
      }
      fx += stepX; fy += stepY;
    }
  }
}

/** Lerp packed color c toward packed (DARKEN_R,G,B) by DARKEN_F/256 — the
 *  classic floor-texture darken overlay (rgba(10,8,12,0.28)), folded in as a
 *  constant multiply. FLOOR fills only, never ceiling (see callers). */
function darkenFloor(c: number): number {
  let r = c & 0xff, g = (c >>> 8) & 0xff, b = (c >>> 16) & 0xff;
  r += ((DARKEN_R - r) * DARKEN_F) >> 8;
  g += ((DARKEN_G - g) * DARKEN_F) >> 8;
  b += ((DARKEN_B - b) * DARKEN_F) >> 8;
  return 0xff000000 | (b << 16) | (g << 8) | r;
}

// Inline DDA raycast per column — based on the classic Wolfenstein 3D / lodev
// raycasting tutorial (attribution carried over from the deleted raycaster.ts).
function drawWalls(fb: Framebuffer, s: RenderScene, reg: TextureRegistry): void {
  const { w, h, px, zbuf } = fb;
  const { width: mw, solid, wallTexture } = s.map;
  const defaultTex = reg.get(s.art.wallTexId);
  const grid = s.lightGrid;
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
    if (!hit) continue;

    const lineH = (h / dist) | 0;
    let dStart = half - (lineH >> 1); if (dStart < 0) dStart = 0;
    let dEnd = half + (lineH >> 1); if (dEnd > h - 1) dEnd = h - 1;

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
    // Grid sampled at the hit tile, folded with the existing side-shade —
    // when the grid is neutral (no baseLight/lights) this is byte-identical
    // to the old `s.tint.*Mul * sideMul` math (grid[i] === tint.*Mul then).
    const gi = mapY * mw + mapX;
    const lr = (grid.r[gi] * sideMul) >> 8, lg = (grid.g[gi] * sideMul) >> 8, lb = (grid.b[gi] * sideMul) >> 8;

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
  const { width: mw, height: mh } = s.map;
  const grid = s.lightGrid;
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
    // Billboards join the lighting model (Task 3, spec-recorded intentional
    // change — today's classic renderer draws sprites full-bright regardless
    // of day/night or point lights; this pipeline lights them like the
    // environment). Sampled once per billboard at its anchor tile, clamped
    // into map bounds as a defensive fallback for off-map billboard data.
    let btx = b.x | 0, bty = b.y | 0;
    if (btx < 0) btx = 0; else if (btx >= mw) btx = mw - 1;
    if (bty < 0) bty = 0; else if (bty >= mh) bty = mh - 1;
    const bgi = bty * mw + btx;
    const br = grid.r[bgi], bg = grid.g[bgi], bb = grid.b[bgi];
    for (let x = cx0; x <= cx1; x++) {
      if (depthTest && trY >= zbuf[x]) continue;
      const texX = (((x - sx0) * tex.w / bw) | 0) & tex.wMask;
      for (let y = cy0; y <= cy1; y++) {
        const texY = (((y - sy0) * tex.h / size) | 0) & tex.hMask;
        const c = tex.texels[texY * tex.w + texX];
        if (c >>> 24 === 0) continue;                       // alpha test
        const shaded = shade(c, br, bg, bb, fogF);
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

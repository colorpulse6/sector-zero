/** Fighter (vertical shooter) sprite preparation helpers.
 *
 *  The shooter's raster art ships as large generated frames (1536×1024 enemy
 *  cards, 4-up bullet sheets whose items are NOT on an equal-column grid, a
 *  7-up explosion strip). Drawing those frames straight into a 32–56px enemy
 *  box squashed the ship to ~16px and, with an unclipped `multiply` tint,
 *  painted a visible rectangle around it. This module prepares each sprite
 *  ONCE on an offscreen canvas:
 *
 *   • alpha-trimmed content bounds (per sheet cell, cells found by alpha
 *     column gaps, falling back to equal division when the gap count does not
 *     match the declared frame count);
 *   • soft-halo cleanup (alpha < HALO_CUTOFF → 0, rest re-stretched);
 *   • optional clipped class tint (`source-atop`, so the tint only ever lands
 *     on the silhouette);
 *   • cached radial glow discs for additive highlights (replaces per-draw
 *     `shadowBlur`, which is the slowest path in Canvas 2D).
 *
 *  Everything is lazy and guarded: with no `document` (Node tests, SSR) or a
 *  not-yet-decoded image every getter returns null and callers fall back to
 *  the plain draw. Caches hold small canvases (≤ MAX_CELL_SIZE on the long
 *  side), so memory stays bounded regardless of the source PNG size. */

import { getSprite } from "./sprites";

export interface SpriteCell {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export interface PreparedSprite {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export interface DrawnRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Analysis resolution for content bounds (source pixels map to ≤ 1 analysis pixel of error, padded). */
const ANALYSIS_WIDTH = 384;
/** Alpha at/below this is treated as generated-art halo and cleared. */
const HALO_CUTOFF = 28;
/** Alpha that counts as "content" when measuring bounds. */
const CONTENT_ALPHA = 24;
/** Default long-side cap for prepared cells (enemies draw at ≤ 64px, bosses at 256px). */
export const MAX_CELL_SIZE = 192;

interface Occupancy {
  scale: number;
  w: number;
  h: number;
  mask: Uint8Array;
  cols: Uint8Array;
}

const occupancyCache = new Map<string, Occupancy>();
const cellCache = new Map<string, SpriteCell[]>();
const preparedCache = new Map<string, PreparedSprite>();
const glowCache = new Map<string, HTMLCanvasElement>();

function hasDom(): boolean {
  return typeof document !== "undefined";
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function occupancyOf(path: string, img: HTMLImageElement): Occupancy | null {
  const cached = occupancyCache.get(path);
  if (cached) return cached;
  if (!hasDom() || img.width === 0 || img.height === 0) return null;
  const scale = Math.min(1, ANALYSIS_WIDTH / img.width);
  const w = Math.max(1, Math.ceil(img.width * scale));
  const h = Math.max(1, Math.ceil(img.height * scale));
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return null; // tainted canvas (cross-origin art) — callers fall back to raw draws
  }
  const mask = new Uint8Array(w * h);
  const cols = new Uint8Array(w);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > CONTENT_ALPHA) {
        mask[y * w + x] = 1;
        cols[x] = 1;
      }
    }
  }
  const occ = { scale, w, h, mask, cols };
  occupancyCache.set(path, occ);
  return occ;
}

/** Split a sheet into `frames` column ranges from its alpha column occupancy.
 *  Runs of occupied columns are merged (closest pair first) until the run
 *  count equals `frames`; if there are fewer runs than frames the sheet is
 *  divided into equal columns instead. Pure, so it is unit-testable. */
export function sliceColumns(
  cols: ArrayLike<number>,
  width: number,
  frames: number,
): Array<[number, number]> {
  const runs: Array<[number, number]> = [];
  let start = -1;
  for (let x = 0; x <= width; x++) {
    const on = x < width && cols[x] > 0;
    if (on && start < 0) start = x;
    if (!on && start >= 0) {
      runs.push([start, x - 1]);
      start = -1;
    }
  }
  while (runs.length > frames) {
    let best = 0;
    let bestGap = Infinity;
    for (let i = 0; i + 1 < runs.length; i++) {
      const gap = runs[i + 1][0] - runs[i][1];
      if (gap < bestGap) {
        bestGap = gap;
        best = i;
      }
    }
    runs.splice(best, 2, [runs[best][0], runs[best + 1][1]]);
  }
  if (runs.length === frames && frames > 0) return runs;
  const out: Array<[number, number]> = [];
  for (let i = 0; i < frames; i++) {
    out.push([Math.floor((i * width) / frames), Math.max(0, Math.floor(((i + 1) * width) / frames) - 1)]);
  }
  return out;
}

/** Content cells of a horizontal sheet, in source pixels. Null until the image is decoded. */
export function getSheetCells(path: string, frames: number): SpriteCell[] | null {
  const key = `${path}|${frames}`;
  const cached = cellCache.get(key);
  if (cached) return cached;
  const img = getSprite(path);
  if (!img) return null;
  const occ = occupancyOf(path, img);
  if (!occ) return null;
  const { scale, w, h, mask } = occ;
  const cells = sliceColumns(occ.cols, w, frames).map(([x0, x1]): SpriteCell => {
    let top = h, bottom = -1;
    for (let y = 0; y < h; y++) {
      for (let x = x0; x <= x1; x++) {
        if (mask[y * w + x]) {
          if (y < top) top = y;
          if (y > bottom) bottom = y;
          break;
        }
      }
    }
    if (bottom < 0) { top = 0; bottom = h - 1; }
    const sx = Math.max(0, Math.floor((x0 - 1) / scale));
    const sy = Math.max(0, Math.floor((top - 1) / scale));
    const ex = Math.min(img.width, Math.ceil((x1 + 2) / scale));
    const ey = Math.min(img.height, Math.ceil((bottom + 2) / scale));
    return { sx, sy, sw: Math.max(1, ex - sx), sh: Math.max(1, ey - sy) };
  });
  cellCache.set(key, cells);
  return cells;
}

/** A trimmed, halo-cleaned, optionally tinted cell on its own canvas. */
export function preparedSprite(
  path: string,
  frame: number,
  frames: number,
  tint?: string,
  tintStrength = 0,
  maxSize = MAX_CELL_SIZE,
): PreparedSprite | null {
  const key = `${path}|${frame}/${frames}|${tint ?? ""}|${tintStrength}|${maxSize}`;
  const cached = preparedCache.get(key);
  if (cached) return cached;
  if (!hasDom()) return null;
  const img = getSprite(path);
  const cells = getSheetCells(path, frames);
  if (!img || !cells) return null;
  const cell = cells[Math.max(0, Math.min(frames - 1, frame))];
  const scale = Math.min(1, maxSize / Math.max(cell.sw, cell.sh));
  const width = Math.max(1, Math.round(cell.sw * scale));
  const height = Math.max(1, Math.round(cell.sh * scale));
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, cell.sx, cell.sy, cell.sw, cell.sh, 0, 0, width, height);
  try {
    const image = ctx.getImageData(0, 0, width, height);
    const data = image.data;
    const stretch = 255 / (255 - HALO_CUTOFF);
    for (let i = 3; i < data.length; i += 4) {
      const a = data[i];
      data[i] = a <= HALO_CUTOFF ? 0 : Math.min(255, Math.round((a - HALO_CUTOFF) * stretch));
    }
    ctx.putImageData(image, 0, 0);
  } catch {
    // Tainted canvas: keep the untouched draw.
  }
  if (tint && tintStrength > 0) {
    ctx.globalCompositeOperation = "source-atop";
    ctx.globalAlpha = tintStrength;
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }
  const prepared = { canvas, width, height };
  preparedCache.set(key, prepared);
  return prepared;
}

/** Largest size with the source aspect that fits in the box. */
export function fitContain(
  sourceW: number,
  sourceH: number,
  boxW: number,
  boxH: number,
): { w: number; h: number } {
  if (sourceW <= 0 || sourceH <= 0) return { w: boxW, h: boxH };
  const scale = Math.min(boxW / sourceW, boxH / sourceH);
  return { w: sourceW * scale, h: sourceH * scale };
}

/** Draw a prepared cell centred on (cx, cy), aspect-fitted into boxW×boxH×scale. */
export function drawPreparedFitted(
  ctx: CanvasRenderingContext2D,
  sprite: PreparedSprite,
  cx: number,
  cy: number,
  boxW: number,
  boxH: number,
  scale = 1,
): DrawnRect {
  const { w, h } = fitContain(sprite.width, sprite.height, boxW * scale, boxH * scale);
  const x = cx - w / 2;
  const y = cy - h / 2;
  ctx.drawImage(sprite.canvas, x, y, w, h);
  return { x, y, w, h };
}

/** Draw a prepared cell centred on (cx, cy), rotated by `angle`, aspect-fitted. */
export function drawPreparedRotated(
  ctx: CanvasRenderingContext2D,
  sprite: PreparedSprite,
  cx: number,
  cy: number,
  boxW: number,
  boxH: number,
  angle: number,
): void {
  const { w, h } = fitContain(sprite.width, sprite.height, boxW, boxH);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.drawImage(sprite.canvas, -w / 2, -h / 2, w, h);
  ctx.restore();
}

const GLOW_RADIUS = 32;

/** Cached soft radial disc in `color` (opaque centre → transparent edge). */
export function glowSprite(color: string): HTMLCanvasElement | null {
  const cached = glowCache.get(color);
  if (cached) return cached;
  if (!hasDom()) return null;
  const size = GLOW_RADIUS * 2;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const gradient = ctx.createRadialGradient(GLOW_RADIUS, GLOW_RADIUS, 0, GLOW_RADIUS, GLOW_RADIUS, GLOW_RADIUS);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.3, color);
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  // The gradient's own alpha ramp carries the falloff: colour stops at 0.3 keep a
  // solid core, then destination-out trims the ramp to a smooth quadratic edge.
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = "destination-out";
  const fade = ctx.createRadialGradient(GLOW_RADIUS, GLOW_RADIUS, GLOW_RADIUS * 0.3, GLOW_RADIUS, GLOW_RADIUS, GLOW_RADIUS);
  fade.addColorStop(0, "rgba(0, 0, 0, 0)");
  fade.addColorStop(1, "rgba(0, 0, 0, 1)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = "source-over";
  glowCache.set(color, canvas);
  return canvas;
}

/** Draw a soft glow disc. Uses the caller's composite mode (set `lighter` for additive light). */
export function drawGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number,
): void {
  if (radius <= 0 || alpha <= 0) return;
  const sprite = glowSprite(color);
  if (!sprite) return;
  const previous = ctx.globalAlpha;
  ctx.globalAlpha = previous * Math.min(1, alpha);
  ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = previous;
}

/** Draw a tapered streak from (x, y) back along (-dx, -dy) — bullet/spark trails. */
export function drawStreak(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dx: number,
  dy: number,
  length: number,
  width: number,
  color: string,
  alpha: number,
): void {
  const mag = Math.hypot(dx, dy);
  if (mag === 0 || length <= 0 || alpha <= 0) return;
  const tx = x - (dx / mag) * length;
  const ty = y - (dy / mag) * length;
  const gradient = ctx.createLinearGradient(x, y, tx, ty);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  const previous = ctx.globalAlpha;
  ctx.globalAlpha = previous * Math.min(1, alpha);
  ctx.strokeStyle = gradient;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.globalAlpha = previous;
}

/** Test/diagnostic hook: drop every prepared canvas (e.g. after art reloads). */
export function resetFighterSpriteCaches(): void {
  occupancyCache.clear();
  cellCache.clear();
  preparedCache.clear();
  glowCache.clear();
}

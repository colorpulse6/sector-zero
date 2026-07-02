import { Framebuffer, presentFramebuffer } from "./framebuffer";
import { TextureRegistry } from "./textures";
import { SceneBuilder } from "./sceneInput";
import { renderScene, projectBillboard } from "./renderCore";
import type { FirstPersonState } from "../types";
import { CANVAS_WIDTH, GAME_AREA_HEIGHT } from "../types";

const registry = new TextureRegistry();
const builder = new SceneBuilder();

// ─── Adaptive internal resolution (Task 5) ───────────────────────────────
// Two preallocated framebuffers so AUTO can drop internal resolution on slow
// machines with zero per-frame allocation. fbHalf is 240x357 — exact halves
// of CANVAS_WIDTH (480) and GAME_AREA_HEIGHT (714). 357 is odd, but nothing
// in the pixel pipeline assumes an even height: gradientFill paints the full
// [0,h) range regardless of parity, and drawWalls/drawBillboards derive their
// row bounds from clamped `h >> 1` arithmetic that tolerates the floor split
// the same way at any height. presentFramebuffer's WeakMap cache
// (framebuffer.ts) is keyed by Framebuffer object identity, so these two
// stable singletons each get their own lazily-created ImageData/offscreen
// canvas entry with zero extra plumbing here.
type ResMode = "auto" | "full" | "half";

const RES_KEY = "szFpResolution";

const fbFull = new Framebuffer(CANVAS_WIDTH, GAME_AREA_HEIGHT);
const fbHalf = new Framebuffer(CANVAS_WIDTH / 2, GAME_AREA_HEIGHT / 2);
let activeFb: Framebuffer = fbFull;

let resMode: ResMode = "auto";
let locked: "full" | "half" = "full";      // AUTO never switches back up mid-session
let initialized = false;                   // gates the lazy localStorage read below

// 120-entry rolling frame-time window (ms), preallocated and reused forever —
// the per-frame path (drawFirstPersonPixel) never allocates for perf tracking.
const FRAME_WINDOW = 120;
const frameMs = new Float32Array(FRAME_WINDOW);
let frameIdx = 0;
let frameCount = 0;

const AUTO_DOWNGRADE_P95_MS = 12;

/** First-touch init: reads the persisted resolution mode from localStorage.
 *  MUST run lazily — called from the draw path and from setResolutionMode,
 *  never at module scope. This module sits in Next's prerender graph (it's
 *  imported transitively from Game.tsx via firstPersonRenderer.ts), and
 *  touching localStorage/document at import time breaks `yarn build`. Same
 *  reason presentFramebuffer (framebuffer.ts) creates its canvas lazily. */
function ensureInit(): void {
  if (initialized) return;
  initialized = true;
  if (typeof localStorage === "undefined") return;
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(RES_KEY);
  } catch {
    return;   // private-browsing / disabled storage — fall back to defaults
  }
  if (saved === "half") { resMode = "half"; locked = "half"; }
  else if (saved === "full") { resMode = "full"; locked = "full"; }
  else if (saved === "auto") { resMode = "auto"; }   // locked stays "full" — fresh window this session
}

function persist(mode: ResMode): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(RES_KEY, mode);
  } catch {
    // quota / private-browsing — resolution mode is a nice-to-have, not critical
  }
}

/** Force or resume adaptive resolution. Called by the DevPanel FP RENDER
 *  buttons. Persists the choice so it survives a reload. */
export function setResolutionMode(mode: ResMode): void {
  ensureInit();
  resMode = mode;
  if (mode === "full") locked = "full";
  else if (mode === "half") locked = "half";
  // "auto": leave `locked` as-is. Re-enabling AUTO resumes monitoring from
  // wherever it currently sits rather than snapping back up to full — the
  // same hysteresis rule the automatic downgrade below follows.
  persist(mode);
}

/** p95 > budget, computed without allocating: for a fixed 120-sample window,
 *  counting how many samples exceed the budget is equivalent to sorting for
 *  the exact 95th-percentile value (p95 > T  <=>  more than 5% of samples
 *  are > T) — a single linear scan over the already-preallocated ring
 *  buffer. The exact p50/p95 values (for humans) are computed separately in
 *  getPerfStats, which only runs at DevPanel-refresh cadence and is allowed
 *  to allocate; this function runs every frame and must not. */
function windowP95ExceedsBudget(): boolean {
  let over = 0;
  for (let i = 0; i < FRAME_WINDOW; i++) {
    if (frameMs[i] > AUTO_DOWNGRADE_P95_MS) over++;
  }
  return over > FRAME_WINDOW * 0.05;
}

function maybeDowngrade(): void {
  if (resMode !== "auto" || locked === "half") return;
  if (frameCount < FRAME_WINDOW) return;
  if (windowP95ExceedsBudget()) {
    locked = "half";
    persist("half");
  }
}

function pickFramebuffer(): Framebuffer {
  activeFb = locked === "half" ? fbHalf : fbFull;
  return activeFb;
}

/** DevPanel-facing perf readout. Allocates (Array.from + sort) — fine here,
 *  this only runs on the panel's own refresh interval, not per frame. */
export function getPerfStats(): { p50: number; p95: number; res: string } {
  ensureInit();   // panel may poll before the first FP frame ever draws
  const n = Math.min(frameCount, FRAME_WINDOW);
  if (n === 0) return { p50: 0, p95: 0, res: locked };
  const sorted = Array.from(frameMs.subarray(0, n)).sort((a, b) => a - b);
  return {
    p50: sorted[Math.floor(0.5 * (n - 1))],
    p95: sorted[Math.floor(0.95 * (n - 1))],
    res: locked,
  };
}

export function drawFirstPersonPixel(ctx: CanvasRenderingContext2D, fp: FirstPersonState): void {
  ensureInit();
  const t0 = performance.now();
  registry.refresh();
  const fb = pickFramebuffer();
  const scene = builder.build(fp, registry);
  renderScene(fb, scene, registry);
  presentFramebuffer(fb, ctx, CANVAS_WIDTH, GAME_AREA_HEIGHT);
  frameMs[frameIdx] = performance.now() - t0;
  frameIdx = (frameIdx + 1) % FRAME_WINDOW;
  frameCount++;
  maybeDowngrade();
}

export function currentFrame(): Framebuffer { return activeFb; }     // overlays read zbuf (occlusion)
export function currentScene() { return builder.lastBuilt; }         // overlays project via
export { projectBillboard };

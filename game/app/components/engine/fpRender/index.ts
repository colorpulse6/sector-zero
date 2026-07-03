import { Framebuffer, presentFramebuffer } from "./framebuffer";
import { TextureRegistry } from "./textures";
import { SceneBuilder } from "./sceneInput";
import { renderScene, projectBillboard } from "./renderCore";
import { windowPercentiles, windowExceedsBudget } from "./perfWindow";
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
export type ResMode = "auto" | "full" | "half";
export type FpResolution = "full" | "half";

/** DevPanel-facing readout shape. `res` is what is actually rendering right
 *  now; `mode` is what was selected — the two differ under AUTO, which can
 *  read FULL before a downgrade and HALF after (that distinction is exactly
 *  why both fields exist). */
export interface FpPerfStats {
  p50: number;
  p95: number;
  res: FpResolution;
  mode: ResMode;
}

const RES_KEY = "szFpResolution";

const fbFull = new Framebuffer(CANVAS_WIDTH, GAME_AREA_HEIGHT);
const fbHalf = new Framebuffer(CANVAS_WIDTH / 2, GAME_AREA_HEIGHT / 2);
let activeFb: Framebuffer = fbFull;

let resMode: ResMode = "auto";
let locked: FpResolution = "full";         // AUTO never switches back up mid-session
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

function maybeDowngrade(): void {
  if (resMode !== "auto" || locked === "half") return;
  if (frameCount < FRAME_WINDOW) return;
  // windowExceedsBudget scans without allocating (per-frame path). It clamps
  // count to the ring size internally, so passing frameCount (which climbs
  // past FRAME_WINDOW once the ring wraps) reads exactly the full window.
  if (windowExceedsBudget(frameMs, frameCount, AUTO_DOWNGRADE_P95_MS)) {
    locked = "half";
    persist("half");   // deliberate: downgrade persists as forced-half so the next session skips re-probing
  }
}

function pickFramebuffer(): Framebuffer {
  activeFb = locked === "half" ? fbHalf : fbFull;
  return activeFb;
}

/** DevPanel-facing perf readout. windowPercentiles allocates (Array.from +
 *  sort) — fine here, this only runs on the panel's own refresh interval, not
 *  per frame. */
export function getPerfStats(): FpPerfStats {
  ensureInit();   // panel may poll before the first FP frame ever draws
  const { p50, p95 } = windowPercentiles(frameMs, frameCount);
  return { p50, p95, res: locked, mode: resMode };
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

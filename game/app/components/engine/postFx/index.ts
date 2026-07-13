/** Public API for the post-FX color-grade pass (Layer A of the visual overhaul).
 *
 *  Two things live here:
 *   1. createGradePass(glCanvas) — a per-canvas instance wrapping the WebGL
 *      backend, with a fail-soft null-GL path (all methods no-op if WebGL is
 *      unavailable), preset lerping, per-frame timing, an auto-disable perf
 *      fallback, and WebGL context-loss recovery.
 *   2. A MODULE-LEVEL SINGLETON MIRROR — plain module-scoped state kept in sync
 *      by the active instance and read/written through exported functions. This
 *      mirrors ../fpRender (getPerfStats / setResolutionMode) so the DevPanel
 *      can read stats and toggle grading WITHOUT holding the instance reference.
 *
 *  Disabled = hidden: whenever grading is off (manual A/B toggle, perf
 *  auto-disable, or a lost GL context) the overlay canvas is hidden via CSS so
 *  the raw 2D canvas beneath shows deterministically — never rely on the GL
 *  drawing buffer's contents while the pass isn't presenting.
 *
 *  Build safety: nothing here touches WebGL/DOM at module scope — the mirror is
 *  plain numbers/booleans, and all GL work is deferred into createGradeGL, which
 *  only runs client-side at runtime. See the build note in ./gradeGL.ts. */

import { createGradeGL, type GradeGL, type GradeParams } from "./gradeGL";
import { windowPercentiles, windowExceedsBudget } from "../fpRender/perfWindow";

// Re-export the params type so callers get the whole surface from the index.
export type { GradeParams };

/** Rolling window size (frames) for the p50/p95 readout + budget check. */
const PERF_WINDOW = 120;
/** CPU-side per-frame budget (ms) for upload+draw; sustained p95 above this
 *  trips the auto-disable fallback. Measured reality: the 480×854 canvas
 *  upload dominates and costs ~2.2ms p50 on a healthy desktop GPU (verified
 *  in the 2026-07-12 playtest, where a 3ms budget false-tripped), so the
 *  budget sits at 6ms — roughly "the pass costs more than a third of the
 *  frame", which only genuinely struggling devices hit. */
const BUDGET_MS = 6;
/** How long an auto-disabled pass stays off before re-probing (ms). */
const REPROBE_MS = 30_000;
/** Per-frame preset lerp factor — ~0.5s to converge on a scene switch. */
const LERP_RATE = 0.08;

/** DevPanel-facing readout. */
export interface GradeStats {
  p50: number;
  p95: number;
  enabled: boolean;
}

/** A grade pass bound to one GL canvas. Returned by createGradePass. */
export interface GradePass {
  /** Grade + present `source` onto the pass's GL canvas, easing the live
   *  params toward `target`. No-ops when disabled, context-lost, or when
   *  WebGL was unavailable at creation. */
  present(source: HTMLCanvasElement, target: GradeParams): void;
  /** Enable/disable grading (also shows/hides the overlay canvas). Manual
   *  disable sticks — it cancels any pending auto-disable re-probe. */
  setEnabled(b: boolean): void;
  /** Snapshot of the current stats (same shape as the module mirror). */
  getStats(): GradeStats;
  /** Release GL resources + listeners and detach from the module mirror. */
  dispose(): void;
}

// ─── Module-level singleton mirror ───────────────────────────────────────────
let statEnabled = false;
let statP50 = 0;
let statP95 = 0;
let activePass: GradePass | null = null;

/** DevPanel readout — current grade stats. Safe to poll before any pass exists. */
export function getGradeStats(): GradeStats {
  return { p50: statP50, p95: statP95, enabled: statEnabled };
}

/** Whether grading is currently on. */
export function isGradeEnabled(): boolean {
  return statEnabled;
}

/** Toggle grading from the DevPanel without holding the instance. */
export function setGradeEnabled(b: boolean): void {
  if (activePass) {
    activePass.setEnabled(b);
  } else {
    statEnabled = b;
  }
}

/** Mutable working copy of GradeParams used for lerping (reused every frame —
 *  no per-frame allocation). */
interface BlendedParams {
  blackPoint: number;
  contrast: number;
  shadowTint: [number, number, number];
  highlightTint: [number, number, number];
  tintStrength: number;
  bloomThreshold: number;
  bloomStrength: number;
  vignetteStrength: number;
  grainStrength: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Create a grade pass over `glCanvas`. If WebGL is unavailable the backend is
 *  null and every method no-ops safely (overlay stays hidden → raw 2D canvas).
 *  The new pass becomes the active instance backing the module mirror. */
export function createGradePass(glCanvas: HTMLCanvasElement): GradePass {
  let backend: GradeGL | null = createGradeGL(glCanvas);
  let contextLost = false;
  let autoDisabledAt = 0; // 0 = not auto-disabled
  let blended: BlendedParams | null = null; // seeded from the first target
  const ring = new Float32Array(PERF_WINDOW);
  let frameCount = 0;

  const showCanvas = (show: boolean) => {
    glCanvas.style.display = show ? "" : "none";
  };

  // ── WebGL context loss/restore ──
  // Without preventDefault the browser never offers a restore; without hiding
  // the canvas the player is left staring at a stale/blank opaque overlay
  // while the (still-running) game is invisible beneath it.
  const onContextLost = (e: Event) => {
    e.preventDefault();
    contextLost = true;
    showCanvas(false);
  };
  const onContextRestored = () => {
    backend?.dispose();
    backend = createGradeGL(glCanvas);
    contextLost = false;
    frameCount = 0;
    if (statEnabled && backend) showCanvas(true);
  };
  glCanvas.addEventListener("webglcontextlost", onContextLost);
  glCanvas.addEventListener("webglcontextrestored", onContextRestored);

  const pass: GradePass = {
    present(source: HTMLCanvasElement, target: GradeParams): void {
      if (!backend || contextLost) return;

      // Auto-disable re-probe: after REPROBE_MS, try grading again with a
      // fresh perf window (maybe the perf dip was transient).
      if (autoDisabledAt !== 0 && performance.now() - autoDisabledAt >= REPROBE_MS) {
        autoDisabledAt = 0;
        frameCount = 0;
        statEnabled = true;
        showCanvas(true);
      }
      if (!statEnabled) return;

      // Ease the live params toward the target preset (scene switches fade
      // instead of popping). Seeded directly from the first target.
      if (!blended) {
        blended = {
          blackPoint: target.blackPoint,
          contrast: target.contrast,
          shadowTint: [target.shadowTint[0], target.shadowTint[1], target.shadowTint[2]],
          highlightTint: [target.highlightTint[0], target.highlightTint[1], target.highlightTint[2]],
          tintStrength: target.tintStrength,
          bloomThreshold: target.bloomThreshold,
          bloomStrength: target.bloomStrength,
          vignetteStrength: target.vignetteStrength,
          grainStrength: target.grainStrength,
        };
      } else {
        blended.blackPoint = lerp(blended.blackPoint, target.blackPoint, LERP_RATE);
        blended.contrast = lerp(blended.contrast, target.contrast, LERP_RATE);
        for (let i = 0; i < 3; i++) {
          blended.shadowTint[i] = lerp(blended.shadowTint[i], target.shadowTint[i], LERP_RATE);
          blended.highlightTint[i] = lerp(blended.highlightTint[i], target.highlightTint[i], LERP_RATE);
        }
        blended.tintStrength = lerp(blended.tintStrength, target.tintStrength, LERP_RATE);
        blended.bloomThreshold = lerp(blended.bloomThreshold, target.bloomThreshold, LERP_RATE);
        blended.bloomStrength = lerp(blended.bloomStrength, target.bloomStrength, LERP_RATE);
        blended.vignetteStrength = lerp(blended.vignetteStrength, target.vignetteStrength, LERP_RATE);
        blended.grainStrength = lerp(blended.grainStrength, target.grainStrength, LERP_RATE);
      }

      // Timed upload+draw (CPU submit cost — the budget the fallback guards).
      const t0 = performance.now();
      backend.uploadAndDraw(source, blended);
      const dt = performance.now() - t0;

      ring[frameCount % PERF_WINDOW] = dt;
      frameCount++;

      // Refresh the mirror's percentiles at readout cadence, not per frame
      // (windowPercentiles sorts a copy — fine at 0.5s intervals, not at 60fps).
      if (frameCount % 30 === 0) {
        const { p50, p95 } = windowPercentiles(ring, frameCount);
        statP50 = p50;
        statP95 = p95;
      }

      // Auto-disable: only judge full windows so one slow startup frame can't
      // trip it. windowExceedsBudget is allocation-free (per-frame safe).
      if (frameCount >= PERF_WINDOW && windowExceedsBudget(ring, frameCount, BUDGET_MS)) {
        statEnabled = false;
        autoDisabledAt = performance.now();
        showCanvas(false);
      }
    },
    setEnabled(b: boolean): void {
      statEnabled = b;
      autoDisabledAt = 0; // manual choice always cancels a pending re-probe
      if (b) frameCount = 0; // fresh perf window on re-enable
      showCanvas(b && !!backend && !contextLost);
    },
    getStats(): GradeStats {
      return { p50: statP50, p95: statP95, enabled: statEnabled };
    },
    dispose(): void {
      glCanvas.removeEventListener("webglcontextlost", onContextLost);
      glCanvas.removeEventListener("webglcontextrestored", onContextRestored);
      backend?.dispose();
      backend = null;
      if (activePass === pass) activePass = null;
    },
  };

  activePass = pass;
  return pass;
}

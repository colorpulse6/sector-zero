/** Public API for the post-FX color-grade pass (Layer A of the visual overhaul).
 *
 *  Two things live here:
 *   1. createGradePass(glCanvas) — a per-canvas instance wrapping the WebGL
 *      backend, with a fail-soft null-GL path (all methods no-op if WebGL is
 *      unavailable) and a present() that no-ops while disabled.
 *   2. A MODULE-LEVEL SINGLETON MIRROR — plain module-scoped state kept in sync
 *      by the active instance and read/written through exported functions. This
 *      mirrors ../fpRender (getPerfStats / setResolutionMode) so the DevPanel
 *      can read stats and toggle grading WITHOUT holding the instance reference.
 *
 *  Build safety: nothing here touches WebGL/DOM at module scope — the mirror is
 *  plain numbers/booleans, and all GL work is deferred into createGradeGL, which
 *  only runs client-side at runtime. See the build note in ./gradeGL.ts. Nothing
 *  imports this module yet; wiring it into the game loop is a later task. */

import { createGradeGL, type GradeGL, type GradeParams } from "./gradeGL";

// Re-export the params type so callers get the whole surface from the index.
export type { GradeParams };

/** DevPanel-facing readout. Perf timing (p50/p95) is wired in a later task;
 *  for now they stay 0 and only `enabled` moves. */
export interface GradeStats {
  p50: number;
  p95: number;
  enabled: boolean;
}

/** A grade pass bound to one GL canvas. Returned by createGradePass. */
export interface GradePass {
  /** Grade + present `source` onto the pass's GL canvas. No-ops when disabled
   *  or when WebGL was unavailable at creation. */
  present(source: HTMLCanvasElement, params: GradeParams): void;
  /** Enable/disable grading. Toggling also updates the module mirror. */
  setEnabled(b: boolean): void;
  /** Snapshot of the current stats (same shape as the module mirror). */
  getStats(): GradeStats;
  /** Release GL resources and detach from the module mirror. Idempotent. */
  dispose(): void;
}

// ─── Module-level singleton mirror ───────────────────────────────────────────
// Authoritative plain-data state. The active instance reads/writes it, and the
// exported accessors below expose it to the DevPanel. All 0/false initially.
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

/** Toggle grading from the DevPanel without holding the instance. Updates the
 *  mirror and notifies the active pass (whose own setEnabled is where any future
 *  per-instance enable/disable side effects will hang). */
export function setGradeEnabled(b: boolean): void {
  statEnabled = b;
  activePass?.setEnabled(b);
}

/** Create a grade pass over `glCanvas`. If WebGL is unavailable the backend is
 *  null and every method no-ops safely. The new pass becomes the active
 *  instance backing the module mirror (last-created wins). */
export function createGradePass(glCanvas: HTMLCanvasElement): GradePass {
  const backend: GradeGL | null = createGradeGL(glCanvas);

  const pass: GradePass = {
    present(source: HTMLCanvasElement, params: GradeParams): void {
      // No-op when disabled or when GL failed to initialize. Perf timing that
      // updates statP50/statP95 around the draw is added in a later task.
      if (!statEnabled || !backend) return;
      backend.uploadAndDraw(source, params);
    },
    setEnabled(b: boolean): void {
      statEnabled = b;
    },
    getStats(): GradeStats {
      return { p50: statP50, p95: statP95, enabled: statEnabled };
    },
    dispose(): void {
      backend?.dispose();
      if (activePass === pass) activePass = null;
    },
  };

  activePass = pass;
  return pass;
}

/** Pure frame-time-window math for the adaptive-resolution manager
 *  (fpRender/index.ts). Split out here so it is unit-testable in node without
 *  importing the framebuffer / registry / DOM state index.ts carries — these
 *  functions close over NOTHING: the ring buffer and its live sample count are
 *  passed in by the module-scope callers. This is the off-by-one-prone core
 *  (percentile indexing, ring wraparound, the count⇔p95 approximation), so it
 *  gets pinned tests in tests/engine/perfWindow.test.ts. */

/** Exact p50/p95 (nearest-rank, zero-indexed) over the first `count` valid
 *  samples of `ring`.
 *
 *  `count` is how many samples have actually been written (the caller's
 *  frameCount). Two clamps matter and are both load-bearing:
 *   - Lower: a not-yet-full ring leaves a ZEROED tail past `count`, so the
 *     percentile must index only [0, count) — indexing the whole allocation
 *     would average in those zeros and report p50≈0 on a partially-filled
 *     window.
 *   - Upper: once the ring wraps, frameCount keeps climbing past the ring
 *     size; `Math.min(count, ring.length)` reads exactly the resident window
 *     instead of running the percentile index out of bounds. (Percentiles are
 *     order-independent — we sort a copy — so reading the wrapped slots in
 *     physical order is correct without tracking the write head.)
 *
 *  Allocates (Array.from + sort); called at DevPanel refresh cadence, never
 *  per frame. */
export function windowPercentiles(
  ring: Float32Array,
  count: number,
): { p50: number; p95: number } {
  const n = Math.min(count, ring.length);
  if (n <= 0) return { p50: 0, p95: 0 };
  const sorted = Array.from(ring.subarray(0, n)).sort((a, b) => a - b);
  return {
    p50: sorted[Math.floor(0.5 * (n - 1))],
    p95: sorted[Math.floor(0.95 * (n - 1))],
  };
}

/** True when the window's p95 exceeds `threshold`, computed WITHOUT sorting or
 *  allocating — the per-frame AUTO-downgrade path must not allocate.
 *
 *  For n samples, "p95 > T" is exactly equivalent to "more than 5% of the
 *  samples are strictly > T": the 95th-percentile sample sits above T iff the
 *  count of strictly-above-T samples spills past the top 5% band. At the
 *  production window size (n = 120) this is exact — the nearest-rank p95 index
 *  is floor(0.95·119) = 113, and `over > 120·0.05 = 6` (i.e. ≥7 over-budget
 *  samples) is precisely the condition that puts sorted[113] above T. A single
 *  linear scan of [0, count) with a running over-threshold count.
 *
 *  Both comparisons are deliberately strict: a sample exactly AT budget is not
 *  "over" (`> threshold`), and the band test is `over > n·0.05` (not `>=`), so
 *  6-of-120 is under and 7-of-120 trips. */
export function windowExceedsBudget(
  ring: Float32Array,
  count: number,
  threshold: number,
): boolean {
  const n = Math.min(count, ring.length);
  if (n <= 0) return false;
  let over = 0;
  for (let i = 0; i < n; i++) {
    if (ring[i] > threshold) over++;
  }
  return over > n * 0.05;
}

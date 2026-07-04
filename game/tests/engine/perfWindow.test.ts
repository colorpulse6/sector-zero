import { test } from "node:test";
import assert from "node:assert/strict";
import {
  windowPercentiles,
  windowExceedsBudget,
} from "../../app/components/engine/fpRender/perfWindow";

// Production constants from the adaptive-resolution manager (fpRender/index.ts):
// FRAME_WINDOW ring size and the AUTO_DOWNGRADE_P95_MS budget. These tests pin
// the pure math the manager relies on but never exercised in an automated test
// before — percentile indexing, the count⇔p95 downgrade approximation, ring
// wraparound, and partial-fill gating.
const WINDOW = 120;
const BUDGET = 12;

/** Fresh 120-slot ring with exactly `over` samples strictly above BUDGET and
 *  the rest below. Distinct per-band constants keep the sort order unambiguous;
 *  physical placement is irrelevant since both helpers are order-independent
 *  (percentiles sort; the predicate counts). */
function ringWithOverCount(over: number, overVal = 20, underVal = 5): Float32Array {
  const ring = new Float32Array(WINDOW);
  for (let i = 0; i < WINDOW; i++) ring[i] = i < over ? overVal : underVal;
  return ring;
}

test("empty window: zero percentiles, predicate false (no samples collected yet)", () => {
  const ring = new Float32Array(WINDOW);
  assert.deepEqual(windowPercentiles(ring, 0), { p50: 0, p95: 0 });
  assert.equal(windowExceedsBudget(ring, 0, BUDGET), false);
});

test("every sample over budget → predicate true, p95 above budget", () => {
  const ring = new Float32Array(WINDOW).fill(50);
  assert.equal(windowExceedsBudget(ring, WINDOW, BUDGET), true);
  assert.equal(windowPercentiles(ring, WINDOW).p95, 50);
});

test("downgrade boundary at n=120: 6 over-budget stays, 7 trips (strict > n·0.05; count⇔p95 exact)", () => {
  // over > 120·0.05 = over > 6. The nearest-rank p95 index is floor(0.95·119)
  // = 113, so 7 over-budget samples are exactly what pushes sorted[113] above
  // the budget — the two formulations agree at the boundary, which is the
  // whole point of the allocation-free approximation.
  const six = ringWithOverCount(6);
  assert.equal(windowExceedsBudget(six, WINDOW, BUDGET), false, "6 over → 6 > 6 is false (a >= slip would wrongly trip)");
  assert.equal(windowPercentiles(six, WINDOW).p95, 5, "p95 (index 113) sits in the under-budget band with only 6 over");

  const seven = ringWithOverCount(7);
  assert.equal(windowExceedsBudget(seven, WINDOW, BUDGET), true, "7 over → 7 > 6 is true");
  assert.equal(windowPercentiles(seven, WINDOW).p95, 20, "p95 (index 113) sits in the over-budget band with 7 over");
});

test("sample exactly at budget is NOT over (strict > threshold)", () => {
  const ring = new Float32Array(WINDOW).fill(BUDGET);   // every sample == 12
  assert.equal(windowExceedsBudget(ring, WINDOW, BUDGET), false);
  assert.equal(windowPercentiles(ring, WINDOW).p95, BUDGET,
    "the percentile still reports the value; only the predicate's comparison is strict");
});

test("percentile indices are nearest-rank floor(0.5·(n-1)) / floor(0.95·(n-1)) at n=120", () => {
  const ring = new Float32Array(WINDOW);
  for (let i = 0; i < WINDOW; i++) ring[i] = i + 1;      // values 1..120, already ascending
  // p50 = sorted[floor(0.5·119)=59] = 60; p95 = sorted[floor(0.95·119)=113] = 114.
  assert.deepEqual(windowPercentiles(ring, WINDOW), { p50: 60, p95: 114 });
});

test("wrapped ring: count past ring size clamps and reads the 120 resident samples", () => {
  const ring = new Float32Array(WINDOW);
  for (let i = 0; i < WINDOW; i++) ring[i] = i + 1;      // slots 0..119 = 1..120
  for (let i = 0; i < 30; i++) ring[i] = 121 + i;        // 30 more writes wrap over slots 0..29 → 121..150
  // Resident window is now {31..150}: sorted[k] = 31+k, so p50 = 31+59 = 90,
  // p95 = 31+113 = 144. Passing frameCount=150 (climbed past the ring size)
  // must clamp to 120, not run the percentile index out of bounds.
  const past = windowPercentiles(ring, 150);
  assert.deepEqual(past, { p50: 90, p95: 144 });
  assert.deepEqual(windowPercentiles(ring, WINDOW), past,
    "count 120 vs 150 read the identical resident slots (clamp, order-independent)");
});

test("partial fill: percentiles index only [0,count), never the zeroed tail", () => {
  const ring = new Float32Array(WINDOW);                 // 90 of 120 slots stay zero
  for (let i = 0; i < 30; i++) ring[i] = i + 1;          // slots 0..29 = 1..30
  // n=30: sorted = [1..30], p50 = sorted[14] = 15, p95 = sorted[27] = 28.
  assert.deepEqual(windowPercentiles(ring, 30), { p50: 15, p95: 28 });
  // The bug this guards: indexing the whole 120-slot allocation averages in the
  // 90-zero tail and collapses p50 to 0. Pin that reading the wrong count does
  // exactly that, so the [0,count) gate is provably load-bearing.
  assert.equal(windowPercentiles(ring, WINDOW).p50, 0,
    "reading all 120 slots (ignoring count) drops p50 into the zero tail");
});

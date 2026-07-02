import { test } from "node:test";
import assert from "node:assert/strict";
import { hslShiftToRgbMul, buildLightGrid } from "../../app/components/engine/fpRender/lighting";

test("hour-12 day tint is identity", () => {
  assert.deepEqual(hslShiftToRgbMul({ hueShift: 0, saturationMul: 1, lightnessMul: 1 }),
    { rMul: 256, gMul: 256, bMul: 256 });
});

test("night tint is dim and cool (B > R)", () => {
  const m = hslShiftToRgbMul({ hueShift: -20, saturationMul: 0.7, lightnessMul: 0.55 });
  assert.ok(m.bMul > m.rMul, "night should lean blue");
  assert.ok(m.rMul < 160 && m.bMul < 200, "night should be dim");
});

test("dusk tint is warm (R > B)", () => {
  const m = hslShiftToRgbMul({ hueShift: 20, saturationMul: 1.05, lightnessMul: 0.85 });
  assert.ok(m.rMul > m.bMul);
});

// ─── LightGrid (Task 3) ──────────────────────────────────────────────

test("point light falls off with squared distance and caps at 320", () => {
  // NOTE: neutral base is 256 with cap 320 — only 64 of headroom. Probe cells
  // must be far enough that the contribution is UNclamped, or the assertion is
  // unsatisfiable. With dim base 100 and power 1:
  //   at(4,4): 100 + 255·1/1        → clamped 320
  //   at(6,4): 100 + 255·1/(1+4)    = 151   (unclamped)
  //   at(7,4): 100 + 255·1/(1+9)    ≈ 125   (unclamped)
  const base = new Uint8Array(64).fill(100);
  const grid = buildLightGrid(8, 8, base, [{ x: 4.5, y: 4.5, r: 255, g: 200, b: 150, power: 1 }],
    { rMul: 256, gMul: 256, bMul: 256 });
  const at = (x: number, y: number) => grid.r[y * 8 + x];
  assert.equal(at(4, 4), 320, "center clamps at 320");
  assert.ok(at(6, 4) > at(7, 4), "unclamped falloff is monotonic");
  assert.ok(at(6, 4) < 320 && at(7, 4) < 320);
});

test("neutral grid is 256 (hour-12 identity)", () => {
  const g = buildLightGrid(2, 2, null, [], { rMul: 256, gMul: 256, bMul: 256 });
  assert.equal(g.r[0], 256); assert.equal(g.g[0], 256); assert.equal(g.b[0], 256);
});

test("baseLight scales and tint multiplies", () => {
  const base = new Uint8Array(4).fill(128);
  const neutralTint = buildLightGrid(2, 2, base, [], { rMul: 256, gMul: 256, bMul: 256 });
  // Math.round((128/255)*256) = 129 — NOT 128. The impl must not be "fixed" to
  // match the naive (wrong) literal; 129 is the documented correct rounding.
  assert.equal(neutralTint.r[0], 129);
  assert.equal(neutralTint.g[0], 129);
  assert.equal(neutralTint.b[0], 129);

  // Night tint composes multiplicatively with baseLight (cool + dim), same
  // formula, non-identity tint multipliers.
  const night = buildLightGrid(2, 2, base, [], { rMul: 140, gMul: 150, bMul: 190 });
  assert.equal(night.r[0], Math.round((128 / 255) * 140));
  assert.equal(night.g[0], Math.round((128 / 255) * 150));
  assert.equal(night.b[0], Math.round((128 / 255) * 190));
  assert.ok(night.b[0] > night.r[0], "night tint stays cool (B>R) after composing with baseLight");
});

test("buildLightGrid reuses the out instance when dimensions match", () => {
  const g1 = buildLightGrid(2, 2, null, [], { rMul: 256, gMul: 256, bMul: 256 });
  const g2 = buildLightGrid(2, 2, null, [], { rMul: 256, gMul: 256, bMul: 256 }, g1);
  assert.equal(g2, g1, "same dims → same instance reused (zero-alloc steady state)");
  const g3 = buildLightGrid(3, 3, null, [], { rMul: 256, gMul: 256, bMul: 256 }, g1);
  assert.notEqual(g3, g1, "different dims → a freshly-sized instance is allocated");
});

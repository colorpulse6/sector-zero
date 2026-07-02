import { test } from "node:test";
import assert from "node:assert/strict";
import { hslShiftToRgbMul } from "../../app/components/engine/fpRender/lighting";

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

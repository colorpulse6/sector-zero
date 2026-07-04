import { test } from "node:test";
import assert from "node:assert/strict";
import { tintForHour } from "../../app/components/colony/exploration/dayNightTint";

test("tintForHour: noon is neutral", () => {
  const t = tintForHour(12);
  assert.equal(t.hueShift, 0);
  assert.equal(t.saturationMul, 1);
  assert.equal(t.lightnessMul, 1);
});

test("tintForHour: midnight is darker", () => {
  const t = tintForHour(0);
  assert.ok(t.lightnessMul < 0.7);
  assert.ok(t.saturationMul < 1);
});

test("tintForHour: dawn is warmer", () => {
  const t = tintForHour(6);
  assert.ok(t.hueShift > 0);
});

test("tintForHour: dusk is warmer than day but less dark than night", () => {
  const dusk = tintForHour(18);
  const night = tintForHour(0);
  assert.ok(dusk.lightnessMul > night.lightnessMul);
});

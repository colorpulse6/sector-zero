import { test } from "node:test";
import assert from "node:assert/strict";
import { OUTPOST_TEMPLATE } from "../../app/components/colony/exploration/outpostTemplate";

test("outpostTemplate: 24×24 dimensions", () => {
  assert.equal(OUTPOST_TEMPLATE.width, 24);
  assert.equal(OUTPOST_TEMPLATE.height, 24);
});

test("outpostTemplate: 6 slots exactly", () => {
  assert.equal(OUTPOST_TEMPLATE.slots.length, 6);
});

test("outpostTemplate: all slots fit within map bounds with max footprint", () => {
  for (const slot of OUTPOST_TEMPLATE.slots) {
    const maxX = slot.anchorX + slot.maxFootprint.w;
    const maxY = slot.anchorY + slot.maxFootprint.h;
    assert.ok(maxX <= OUTPOST_TEMPLATE.width,  `slot ${slot.id} extends beyond x-bound: ${maxX}`);
    assert.ok(maxY <= OUTPOST_TEMPLATE.height, `slot ${slot.id} extends beyond y-bound: ${maxY}`);
    assert.ok(slot.anchorX >= 0 && slot.anchorY >= 0, `slot ${slot.id} has negative anchor`);
  }
});

test("outpostTemplate: no slot overlaps the plaza region", () => {
  const plaza = OUTPOST_TEMPLATE.plaza;
  for (const slot of OUTPOST_TEMPLATE.slots) {
    const slotRight = slot.anchorX + slot.maxFootprint.w;
    const slotBottom = slot.anchorY + slot.maxFootprint.h;
    const plazaRight = plaza.x + plaza.w;
    const plazaBottom = plaza.y + plaza.h;
    const overlaps =
      slot.anchorX < plazaRight &&
      slotRight > plaza.x &&
      slot.anchorY < plazaBottom &&
      slotBottom > plaza.y;
    assert.ok(!overlaps, `slot ${slot.id} overlaps plaza`);
  }
});

test("outpostTemplate: no slot overlaps the landing pad", () => {
  const pad = OUTPOST_TEMPLATE.landingPad;
  for (const slot of OUTPOST_TEMPLATE.slots) {
    const slotRight = slot.anchorX + slot.maxFootprint.w;
    const slotBottom = slot.anchorY + slot.maxFootprint.h;
    const padRight = pad.x + pad.w;
    const padBottom = pad.y + pad.h;
    const overlaps =
      slot.anchorX < padRight &&
      slotRight > pad.x &&
      slot.anchorY < padBottom &&
      slotBottom > pad.y;
    assert.ok(!overlaps, `slot ${slot.id} overlaps landing pad`);
  }
});

test("outpostTemplate: spawn is inside the landing pad", () => {
  const { spawn, landingPad } = OUTPOST_TEMPLATE;
  assert.ok(spawn.x >= landingPad.x && spawn.x < landingPad.x + landingPad.w);
  assert.ok(spawn.y >= landingPad.y && spawn.y < landingPad.y + landingPad.h);
  assert.equal(spawn.facing, "north");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { derivePowerGrid } from "../../app/components/colony/shared/powerGrid";
import { makeTestColony } from "./fixtures";

test("empty colony has zero capacity, zero demand, zero surplus", () => {
  const colony = makeTestColony();
  const grid = derivePowerGrid(colony);
  assert.equal(grid.capacity, 0);
  assert.equal(grid.demand, 0);
  assert.equal(grid.surplus, 0);
});

test("solar array operational adds capacity", () => {
  const colony = makeTestColony({
    buildings: [
      { id: "b1", type: "solar_array", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const grid = derivePowerGrid(colony);
  assert.equal(grid.capacity, 10);
  assert.equal(grid.demand, 0);
  assert.equal(grid.surplus, 10);
});

test("solar array under construction contributes zero capacity", () => {
  const colony = makeTestColony({
    buildings: [
      { id: "b1", type: "solar_array", tier: 1, status: "constructing", buildProgressCycles: 1, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const grid = derivePowerGrid(colony);
  assert.equal(grid.capacity, 0);
  assert.equal(grid.surplus, 0);
});

test("farm operational demands power", () => {
  const colony = makeTestColony({
    buildings: [
      { id: "b1", type: "solar_array", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
      { id: "b2", type: "farm", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const grid = derivePowerGrid(colony);
  assert.equal(grid.capacity, 10);
  assert.equal(grid.demand, 2);
  assert.equal(grid.surplus, 8);
});

test("negative surplus indicates brownout", () => {
  const colony = makeTestColony({
    buildings: [
      { id: "b1", type: "farm", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const grid = derivePowerGrid(colony);
  assert.equal(grid.capacity, 0);
  assert.equal(grid.demand, 2);
  assert.equal(grid.surplus, -2);
});

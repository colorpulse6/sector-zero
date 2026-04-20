import { test } from "node:test";
import assert from "node:assert/strict";
import { predictedDeltas } from "../../app/components/colony/meta/predictedDeltas";
import { makeTestColony } from "./fixtures";

test("predictedDeltas: empty colony produces zero deltas", () => {
  const colony = makeTestColony();
  const d = predictedDeltas(colony);
  assert.equal(d.food, 0);
  assert.equal(d.water, 0);
  assert.equal(d.metal, 0);
});

test("predictedDeltas: operational farm + water purifier minus farm upkeep", () => {
  const colony = makeTestColony({
    buildings: [
      { id: "f", type: "farm", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
      { id: "w", type: "water_purifier", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
    population: { total: 0, capacity: 0, namedCount: 0, growthRate: 0, recentDeaths: [] },
  });
  const d = predictedDeltas(colony);
  // farm +15 food, water_purifier +12 water, farm upkeep -5 water, pop=0
  assert.equal(d.food, 15);
  assert.equal(d.water, 7);
  assert.equal(d.metal, 0);
});

test("predictedDeltas: population subtracts consumption", () => {
  const colony = makeTestColony({
    buildings: [
      { id: "f", type: "farm", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
    population: { total: 10, capacity: 10, namedCount: 0, growthRate: 0, recentDeaths: [] },
  });
  const d = predictedDeltas(colony);
  // farm +15 food, farm upkeep -5 water, pop 10 eats 10 food + floor(5) water
  assert.equal(d.food, 5);
  assert.equal(d.water, -10);
});

test("predictedDeltas: constructing buildings do not contribute", () => {
  const colony = makeTestColony({
    buildings: [
      { id: "f", type: "farm", tier: 1, status: "constructing", buildProgressCycles: 2, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const d = predictedDeltas(colony);
  assert.equal(d.food, 0);
});

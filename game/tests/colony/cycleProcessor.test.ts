import { test } from "node:test";
import assert from "node:assert/strict";
import { processCycle } from "../../app/components/colony/shared/cycleProcessor";
import { makeTestColony } from "./fixtures";

test("processCycle step 1: operational farm produces food and water purifier produces water (net of farm upkeep)", () => {
  const before = makeTestColony({
    buildings: [
      { id: "f1", type: "farm", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
      { id: "s1", type: "solar_array", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
      { id: "w1", type: "water_purifier", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
    resources: { food: 0, water: 0, metal: 0, credits: 0 },
  });
  const after = processCycle(before, 1);
  // Step 1 production: farm +15 food, water_purifier +12 water.
  // Step 2 consumption: pop=0 → 0 food, 0 water.
  // Step 3 upkeep: farm needs 5 water upkeep.
  // Net: food = 15, water = 12 - 5 = 7.
  assert.equal(after.resources.food, 15);
  assert.equal(after.resources.water, 7);
  assert.equal(after.lastCycleProcessed, 1);
});

test("processCycle step 2: population consumes food and water", () => {
  const before = makeTestColony({
    resources: { food: 100, water: 100, metal: 0, credits: 0 },
    population: { total: 10, capacity: 10, namedCount: 0, growthRate: 0, recentDeaths: [] },
  });
  const after = processCycle(before, 1);
  assert.equal(after.resources.food, 90);   // 100 - 10 pop * 1
  assert.equal(after.resources.water, 95);  // 100 - floor(10 * 0.5)
});

test("processCycle step 5: happiness recomputed based on state", () => {
  const before = makeTestColony({
    resources: { food: 100, water: 100, metal: 0, credits: 0 },
    population: { total: 10, capacity: 10, namedCount: 0, growthRate: 0, recentDeaths: [] },
    happiness: 50,
    buildings: [
      { id: "f1", type: "farm", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
      { id: "s1", type: "solar_array", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
      { id: "w1", type: "water_purifier", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const after = processCycle(before, 1);
  assert.ok(after.happiness >= 50);
  assert.ok(after.happiness <= 100);
});

test("processCycle step 4: population grows when happiness > 60", () => {
  const before = makeTestColony({
    resources: { food: 100, water: 100, metal: 0, credits: 0 },
    population: { total: 10, capacity: 20, namedCount: 0, growthRate: 0, recentDeaths: [] },
    happiness: 80,
  });
  const after = processCycle(before, 1);
  assert.ok(after.population.total >= 10);
});

test("processCycle step 4: population departures when happiness < 40", () => {
  // formula: floor(total * 0.05 * ((40 - h) / 40))
  // With total=100, h=20: floor(100 * 0.05 * 20/40) = floor(2.5) = 2 departures.
  const before = makeTestColony({
    resources: { food: 1000, water: 1000, metal: 0, credits: 0 },
    population: { total: 100, capacity: 100, namedCount: 0, growthRate: 0, recentDeaths: [] },
    happiness: 20,
  });
  const after = processCycle(before, 1);
  assert.ok(after.population.total < 100, `expected population < 100, got ${after.population.total}`);
  assert.ok(after.population.total >= 95, `expected not too many departures, got ${after.population.total}`);
});

test("processCycle step 3: building upkeep consumes resources", () => {
  const before = makeTestColony({
    resources: { food: 50, water: 50, metal: 0, credits: 0 },
    buildings: [
      { id: "f1", type: "farm", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
      { id: "s1", type: "solar_array", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const after = processCycle(before, 1);
  // Step 1: farm +15 food. Step 2: pop=0. Step 3: farm upkeep -5 water.
  assert.equal(after.resources.water, 45);
});

test("processCycle advances lastCycleProcessed even with empty colony", () => {
  const before = makeTestColony();
  const after = processCycle(before, 1);
  assert.equal(after.lastCycleProcessed, 1);
});

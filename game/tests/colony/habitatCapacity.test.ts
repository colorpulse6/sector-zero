// OW-0: population capacity is derived from operational habitat modules,
// and population growth actually happens for a healthy colony.

import { test } from "node:test";
import assert from "node:assert/strict";
import { processCycle } from "../../app/components/colony/shared/cycleProcessor";
import { colonyReducer } from "../../app/components/colony/shared/colonyReducer";
import { Events } from "../../app/components/colony/shared/colonyEvents";
import { habitatCapacity, HABITAT_CAPACITY_PER_MODULE } from "../../app/components/colony/shared/colonyCatalog";
import { makeTestColony, makeBuilding, makeTestSave } from "./fixtures";

test("habitatCapacity: 0 / 1 / 2 operational habitats → 0 / 10 / 20", () => {
  assert.equal(HABITAT_CAPACITY_PER_MODULE, 10);
  assert.equal(habitatCapacity([]), 0);
  assert.equal(habitatCapacity([makeBuilding("habitat_module")]), 10);
  assert.equal(habitatCapacity([makeBuilding("habitat_module"), makeBuilding("habitat_module")]), 20);
  // Non-habitat buildings contribute nothing
  assert.equal(habitatCapacity([makeBuilding("farm"), makeBuilding("solar_array")]), 0);
});

// Note: capacity tests include a solar_array — an unpowered habitat gets shed
// by the step-3 brownout pass (offline → houses nobody), which is itself
// covered by the offline/unpowered tests below.

test("processCycle recomputes capacity from operational habitats (0/1/2)", () => {
  for (const count of [0, 1, 2]) {
    const before = makeTestColony({
      buildings: [
        makeBuilding("solar_array"),
        ...Array.from({ length: count }, () => makeBuilding("habitat_module")),
      ],
      population: { total: 0, capacity: 999, namedCount: 0, growthRate: 0, recentDeaths: [] },
    });
    const after = processCycle(before, 1);
    assert.equal(after.population.capacity, count * 10, `expected ${count * 10} for ${count} habitats`);
  }
});

test("mid-construction habitat does not count toward capacity", () => {
  const before = makeTestColony({
    buildings: [
      makeBuilding("solar_array"),
      makeBuilding("habitat_module"),
      makeBuilding("habitat_module", { status: "constructing", buildProgressCycles: 3 }),
    ],
  });
  const after = processCycle(before, 1);
  // Second habitat still constructing after this cycle (3 → 2)
  assert.equal(after.buildings.filter(b => b.status === "constructing").length, 1);
  assert.equal(after.population.capacity, 10);
});

test("offline habitat does not count toward capacity", () => {
  const before = makeTestColony({
    buildings: [
      makeBuilding("solar_array"),
      makeBuilding("habitat_module"),
      makeBuilding("habitat_module", { status: "offline" }),
    ],
  });
  const after = processCycle(before, 1);
  assert.equal(after.population.capacity, 10);
});

test("unpowered habitat is shed by brownout and stops counting toward capacity", () => {
  // No solar at all: the grid deficit sheds the habitat mid-cycle, and the
  // post-progress recompute prices the lost housing in the same cycle.
  const before = makeTestColony({ buildings: [makeBuilding("habitat_module")] });
  const after = processCycle(before, 1);
  assert.equal(after.buildings[0].status, "offline");
  assert.equal(after.population.capacity, 0);
});

test("habitat completing construction mid-cycle raises capacity the same cycle", () => {
  const before = makeTestColony({
    buildings: [makeBuilding("habitat_module", { status: "constructing", buildProgressCycles: 1 })],
  });
  const after = processCycle(before, 1);
  assert.equal(after.buildings[0].status, "operational");
  assert.equal(after.population.capacity, 10);
});

test("reducer buildingCompleted recomputes capacity immediately", () => {
  let save = makeTestSave();
  save = colonyReducer(save, Events.founded({
    colonyId: "c1", name: "T", planetId: "ashfall", foundingType: "outpost",
    regionNodeId: "rn1", missionCount: 0, layoutSeed: 42,
  }));
  save = colonyReducer(save, Events.buildingCommissioned({
    colonyId: "c1", buildingId: "h1", buildingType: "habitat_module",
    costDeducted: {}, cyclesToBuild: 1,
  }));
  assert.equal(save.colonies[0].population.capacity, 0, "constructing habitat houses nobody");
  save = colonyReducer(save, Events.buildingCompleted({ colonyId: "c1", buildingId: "h1" }));
  assert.equal(save.colonies[0].population.capacity, 10, "capacity raised the moment the habitat completes");
});

test("healthy colony reaches happiness > 60 and grows; growth clamps at capacity", () => {
  // The standard Phase 1 loadout: solar + farm + purifier + habitat, stocked larder.
  let colony = makeTestColony({
    resources: { food: 50, water: 50, metal: 0, credits: 0 },
    buildings: [
      makeBuilding("solar_array"),
      makeBuilding("farm"),
      makeBuilding("water_purifier"),
      makeBuilding("habitat_module"),
    ],
  });

  colony = processCycle(colony, 1);
  assert.ok(colony.happiness > 60, `healthy colony should be happy after one cycle, got ${colony.happiness}`);

  colony = processCycle(colony, 2);
  assert.ok(colony.population.total >= 1, `settlers should arrive once happiness > 60, got ${colony.population.total}`);
  assert.ok(colony.population.growthRate > 0, "growthRate should be positive");

  // Run long enough to hit the habitat cap, then keep going: never exceeds it.
  for (let cycle = 3; cycle <= 20; cycle++) {
    colony = processCycle(colony, cycle);
    assert.ok(
      colony.population.total <= colony.population.capacity,
      `cycle ${cycle}: population ${colony.population.total} exceeded capacity ${colony.population.capacity}`,
    );
  }
  assert.equal(colony.population.total, 10, "population should have grown to exactly the 1-habitat cap");
});

test("colony with no habitats never grows (capacity clamp)", () => {
  let colony = makeTestColony({
    resources: { food: 100, water: 100, metal: 0, credits: 0 },
    buildings: [makeBuilding("solar_array"), makeBuilding("farm"), makeBuilding("water_purifier")],
  });
  for (let cycle = 1; cycle <= 5; cycle++) colony = processCycle(colony, cycle);
  assert.equal(colony.population.total, 0);
  assert.equal(colony.population.capacity, 0);
});

test("mine production ticks once operational, not while constructing", () => {
  const constructing = makeTestColony({
    buildings: [makeBuilding("mine", { status: "constructing", buildProgressCycles: 2 })],
  });
  const afterConstructing = processCycle(constructing, 1);
  assert.equal(afterConstructing.resources.metal, 0, "constructing mine produces nothing");

  // Solar keeps the grid in surplus so the brownout pass can't shed the mine.
  let operational = makeTestColony({
    buildings: [makeBuilding("solar_array"), makeBuilding("mine")],
  });
  operational = processCycle(operational, 1);
  assert.equal(operational.resources.metal, 10, "operational mine produces +10 metal/cycle");
  operational = processCycle(operational, 2);
  assert.equal(operational.resources.metal, 20, "mine keeps producing every cycle");
});

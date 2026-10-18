import { test } from "node:test";
import assert from "node:assert/strict";
import {
  plannedPower,
  settlementCommissionBlock,
  settlementOutlook,
} from "../../app/components/engine/galaxy/galaxySettlement";
import { happinessFactors, processCycle } from "../../app/components/colony/shared/cycleProcessor";
import type { BuildingType, ColonyBuilding, ColonyState } from "../../app/components/colony/shared/colonyTypes";
import { makeBuilding, makeTestColony } from "./fixtures";

function built(type: BuildingType, status: ColonyBuilding["status"] = "operational", cycles = 1): ColonyBuilding {
  return makeBuilding(type, { status, buildProgressCycles: status === "constructing" ? cycles : 0 });
}

function colonyWith(metal: number, buildings: ColonyBuilding[], overrides: Partial<ColonyState> = {}): ColonyState {
  return makeTestColony({ resources: { food: 0, water: 0, metal, credits: 0 }, buildings, ...overrides });
}

const FULL_SET = (): ColonyBuilding[] =>
  (["solar_array", "mine", "habitat_module", "farm", "water_purifier"] as const).map(type => built(type));

test("planned power counts operational and constructing buildings only", () => {
  const colony = colonyWith(0, [
    built("solar_array", "constructing"), built("farm"), built("mine", "constructing"), built("habitat_module", "offline"),
  ]);
  assert.deepEqual(plannedPower(colony), { capacity: 10, demand: 5, spare: 5 });
});

test("a consumer needs planned spare power; a solar under construction counts", () => {
  assert.deepEqual(settlementCommissionBlock(colonyWith(500, []), "mine"),
    { reason: "insufficient_power", message: "NEEDS 3 POWER · 0 SPARE · BUILD A SOLAR ARRAY" });
  assert.deepEqual(settlementCommissionBlock(colonyWith(500, []), "habitat_module"),
    { reason: "insufficient_power", message: "NEEDS 2 POWER · 0 SPARE · BUILD A SOLAR ARRAY" });
  assert.equal(settlementCommissionBlock(colonyWith(500, [built("solar_array", "constructing")]), "mine"), null);
  const full = colonyWith(500, FULL_SET());
  assert.deepEqual(settlementCommissionBlock(full, "habitat_module"),
    { reason: "insufficient_power", message: "NEEDS 2 POWER · 0 SPARE · BUILD A SOLAR ARRAY" });
  assert.equal(settlementCommissionBlock(full, "solar_array"), null, "power itself is never blocked by power");
});

test("mine first: scarce metal goes to power and the mine before anything else", () => {
  assert.equal(settlementCommissionBlock(colonyWith(80, []), "solar_array"), null, "the mine's own solar is exempt");
  const powered = [built("solar_array", "constructing")];
  const mineFirst = { reason: "mine_first", message: "MINE FIRST · KEEP 150 METAL AND 1 SLOT FOR IT" };
  assert.deepEqual(settlementCommissionBlock(colonyWith(160, powered), "habitat_module"), mineFirst);
  assert.deepEqual(settlementCommissionBlock(colonyWith(160, powered), "farm"), mineFirst);
  assert.deepEqual(settlementCommissionBlock(colonyWith(160, powered), "water_purifier"), mineFirst);
  assert.deepEqual(settlementCommissionBlock(colonyWith(160, powered), "solar_array"), mineFirst,
    "a second solar before the mine is not on the mine's path");
  assert.equal(settlementCommissionBlock(colonyWith(160, powered), "mine"), null);
  assert.equal(settlementCommissionBlock(colonyWith(400, powered), "habitat_module"), null, "enough metal: any order");
  assert.equal(settlementCommissionBlock(colonyWith(100, [...powered, built("mine", "constructing", 2)]), "habitat_module"), null);
});

test("mine first also keeps power and slots for the mine", () => {
  const crowded = colonyWith(1000, [built("solar_array"), built("habitat_module"), built("farm"), built("water_purifier")]);
  assert.deepEqual(settlementCommissionBlock(crowded, "habitat_module"),
    { reason: "mine_first", message: "MINE FIRST · KEEP 230 METAL AND 2 SLOTS FOR IT" });
  assert.equal(settlementCommissionBlock(crowded, "mine"), null);
  assert.equal(settlementCommissionBlock(crowded, "solar_array"), null, "a solar that leaves a slot for the mine is fine");
});

test("checks run in order: slot, power, metal, mine first", () => {
  const noSlot = colonyWith(500, [built("solar_array")], {
    siteStats: { oreDensity: 50, waterTable: 50, buildableSlots: 1, threat: 50 },
  });
  assert.deepEqual(settlementCommissionBlock(noSlot, "mine"), { reason: "no_buildable_slot", message: "NO BUILDABLE SLOT" });
  assert.equal(settlementCommissionBlock(colonyWith(0, []), "farm")?.reason, "insufficient_power");
  assert.deepEqual(settlementCommissionBlock(colonyWith(60, [built("solar_array")]), "habitat_module"),
    { reason: "insufficient_resources", message: "NOT ENOUGH RESOURCES" });
  assert.equal(settlementCommissionBlock(colonyWith(79, []), "solar_array")?.reason, "insufficient_resources");
  assert.equal(settlementCommissionBlock(colonyWith(500, []), "cantina")?.reason, "insufficient_power",
    "the rule is colony-level; the command decides which types exist");
});

test("happiness factors are the processCycle happiness, term by term", () => {
  const states: ColonyState[] = [
    colonyWith(0, []),
    colonyWith(0, [built("solar_array"), built("habitat_module")]),
    colonyWith(0, FULL_SET()),
    colonyWith(0, FULL_SET(), {
      population: { total: 6, capacity: 10, namedCount: 0, growthRate: 0, recentDeaths: [] },
      resources: { food: 3, water: 1, metal: 0, credits: 0 },
    }),
    colonyWith(0, [built("habitat_module"), built("farm")], {
      population: { total: 12, capacity: 10, namedCount: 0, growthRate: 0, recentDeaths: [] },
    }),
  ];
  for (const colony of states) {
    const next = processCycle(colony, 1);
    const sum = happinessFactors(next).reduce((total, factor) => total + (factor.met ? factor.delta : 0), 50);
    assert.equal(Math.max(0, Math.min(100, sum)), next.happiness);
  }
});

test("outlook: no housing names the habitat", () => {
  const outlook = settlementOutlook(colonyWith(0, [built("solar_array")], { happiness: 80 }), 3);
  assert.equal(outlook.settlerChange, 0);
  assert.deepEqual(outlook.housing, { settlers: 0, capacity: 0, free: 0 });
  assert.equal(outlook.waiting, "NO HOUSING · BUILD A HABITAT MODULE");
});

test("outlook: a habitat under construction gives its time", () => {
  const outlook = settlementOutlook(colonyWith(0, [built("solar_array"), built("habitat_module", "constructing")], { happiness: 80 }), 3);
  assert.equal(outlook.waiting, "HOUSING READY IN 1 CYCLE");
});

test("outlook: free housing but low happiness names the threshold and the missing factors", () => {
  const colony = colonyWith(0, [built("solar_array"), built("habitat_module")], {
    happiness: 55, population: { total: 0, capacity: 10, namedCount: 0, growthRate: 0, recentDeaths: [] },
  });
  const outlook = settlementOutlook(colony, 3);
  assert.equal(outlook.settlerChange, 0);
  assert.equal(outlook.waiting, "HAPPINESS 55 · SETTLERS NEED OVER 60");
  assert.equal(outlook.nextHappiness, 55);
  const byId = new Map(outlook.factors.map(factor => [factor.id, factor]));
  assert.equal(byId.get("food_stock")?.met, false);
  assert.equal(byId.get("water_stock")?.met, false);
  assert.equal(byId.get("power_ok")?.met, true);
  assert.equal(byId.get("food_stock")?.label, "FOOD STOCK OVER 2× SETTLERS");
});

test("outlook: a happy colony with free housing gains the settler processCycle gives it", () => {
  const colony = colonyWith(0, FULL_SET(), {
    happiness: 80,
    population: { total: 3, capacity: 10, namedCount: 0, growthRate: 0, recentDeaths: [] },
    resources: { food: 30, water: 20, metal: 40, credits: 0 },
  });
  const outlook = settlementOutlook(colony, 7);
  const next = processCycle(colony, 8);
  assert.equal(outlook.settlerChange, next.population.total - 3);
  assert.equal(outlook.settlerChange, 1);
  assert.equal(outlook.nextHappiness, next.happiness);
  assert.deepEqual(outlook.housing, { settlers: 3, capacity: 10, free: 7 });
  assert.equal(outlook.waiting, null);
});

test("outlook: full housing says so", () => {
  const colony = colonyWith(0, FULL_SET(), {
    happiness: 80,
    population: { total: 10, capacity: 10, namedCount: 0, growthRate: 0, recentDeaths: [] },
    resources: { food: 30, water: 20, metal: 40, credits: 0 },
  });
  assert.equal(settlementOutlook(colony, 7).waiting, "HOUSING FULL");
});

test("outlook: an expiring threat still explains the next cycle's happiness penalty", () => {
  const colony = colonyWith(0, FULL_SET(), {
    resources: { food: 30, water: 20, metal: 0, credits: 0 },
    activeThreats: [{ id: "last-raid-cycle", kind: "raid_incoming", cyclesUntilResolve: 1,
      severity: "minor", targetBuildingId: null, payload: null }],
  });
  const outlook = settlementOutlook(colony, 7);
  assert.equal(processCycle(colony, 8).activeThreats.length, 0);
  assert.equal(outlook.factors.find(factor => factor.id === "recent_attack")?.met, true);
  assert.equal(50 + outlook.factors.reduce((sum, factor) => sum + (factor.met ? factor.delta : 0), 0), outlook.nextHappiness);
});

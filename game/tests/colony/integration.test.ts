import { test } from "node:test";
import assert from "node:assert/strict";
import { colonyReducer, advanceWorldCycle, Events } from "../../app/components/colony";
import type { SaveData } from "../../app/components/engine/types";

function makeEmpty(): SaveData {
  return {
    currentWorld: 1, levels: {}, credits: 0, totalStars: 0, totalScore: 0, xp: 0,
    upgrades: {} as SaveData["upgrades"], unlockedCodex: [], viewedCodex: [],
    viewedConversations: [], completedQuests: [], activeQuests: [],
    completedPlanets: [], unlockedSpecialMissions: [], completedSpecialMissions: [],
    storyItems: [], materials: [], consumableInventory: {}, equippedConsumables: [],
    unlockedEnhancements: [], bestiary: {}, equippedWeaponType: "kinetic",
    pilotLevel: 1, skillPoints: 0, allocatedSkills: [],
    colonies: [], planets: [], earthShipments: [], factionStandings: [], bounties: [],
    missionsSinceStart: 0,
    gameClock: { day: 0, hour: 7, minute: 0, realtimeMsPerGameMinute: 1000, season: "standard" },
  };
}

test("5-cycle simulation: found colony, commission 2 buildings, run 5 cycles", () => {
  let save = makeEmpty();

  // 1. Found a colony
  save = colonyReducer(save, Events.founded({
    colonyId: "ashfall_primary",
    name: "Ashfall Primary",
    planetId: "ashfall",
    foundingType: "outpost",
    regionNodeId: "rn_ashfall_1",
    missionCount: 0,
    layoutSeed: 42,
  }));

  // 2. Seed with starting resources so we can commission
  const colony = save.colonies[0];
  save = {
    ...save,
    colonies: [{
      ...colony,
      resources: { food: 0, water: 50, metal: 500, credits: 0 },
      population: { ...colony.population, total: 5, capacity: 10 },
    }],
  };

  // 3. Commission Solar + Farm + Water Purifier
  save = colonyReducer(save, Events.buildingCommissioned({
    colonyId: "ashfall_primary", buildingId: "b_solar", buildingType: "solar_array",
    costDeducted: { metal: 80 }, cyclesToBuild: 1,
  }));
  save = colonyReducer(save, Events.buildingCommissioned({
    colonyId: "ashfall_primary", buildingId: "b_farm", buildingType: "farm",
    costDeducted: { metal: 100 }, cyclesToBuild: 2,
  }));
  save = colonyReducer(save, Events.buildingCommissioned({
    colonyId: "ashfall_primary", buildingId: "b_water", buildingType: "water_purifier",
    costDeducted: { metal: 120 }, cyclesToBuild: 2,
  }));

  // Sanity: 500 - 80 - 100 - 120 = 200 metal left
  assert.equal(save.colonies[0].resources.metal, 200);

  // 4. Run cycles, completing buildings when they're ready.
  // Cycle 1: solar completes (cyclesToBuild=1)
  save = advanceWorldCycle(save);
  save = colonyReducer(save, Events.buildingCompleted({ colonyId: "ashfall_primary", buildingId: "b_solar" }));
  assert.equal(save.missionsSinceStart, 1);

  // Cycle 2: farm + water purifier complete (cyclesToBuild=2)
  save = advanceWorldCycle(save);
  save = colonyReducer(save, Events.buildingCompleted({ colonyId: "ashfall_primary", buildingId: "b_farm" }));
  save = colonyReducer(save, Events.buildingCompleted({ colonyId: "ashfall_primary", buildingId: "b_water" }));

  // Cycles 3-5: colony now has operational farm+purifier+solar, should produce net-positive resources
  save = advanceWorldCycle(save);
  save = advanceWorldCycle(save);
  save = advanceWorldCycle(save);

  const final = save.colonies[0];
  assert.equal(final.lastCycleProcessed, 5);
  assert.equal(save.missionsSinceStart, 5);
  assert.ok(final.resources.food > 0, `food should be positive after 3 productive cycles, got ${final.resources.food}`);
  assert.ok(final.resources.water > 0, `water should be positive after 3 productive cycles, got ${final.resources.water}`);
  assert.equal(final.buildings.filter(b => b.status === "operational").length, 3);
});

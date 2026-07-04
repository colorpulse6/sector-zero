import { test } from "node:test";
import assert from "node:assert/strict";
import { colonyReducer, Events } from "../../app/components/colony";
import type { SaveData } from "../../app/components/engine/types";

function makeSave(): SaveData {
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

test("colonyReducer preserves colony.buildings insertion order across events", () => {
  let save = makeSave();

  save = colonyReducer(save, Events.founded({
    colonyId: "c1", name: "Test", planetId: "ashfall", foundingType: "outpost",
    regionNodeId: "rn1", missionCount: 0, layoutSeed: 42,
  }));
  save.colonies[0] = { ...save.colonies[0], resources: { food: 0, water: 0, metal: 5000, credits: 0 } };

  // Commission buildings with out-of-order IDs (lexicographic sort would shuffle them)
  save = colonyReducer(save, Events.buildingCommissioned({
    colonyId: "c1", buildingId: "z-first", buildingType: "solar_array",
    costDeducted: { metal: 80 }, cyclesToBuild: 1,
  }));
  save = colonyReducer(save, Events.buildingCommissioned({
    colonyId: "c1", buildingId: "a-second", buildingType: "farm",
    costDeducted: { metal: 100 }, cyclesToBuild: 2,
  }));
  save = colonyReducer(save, Events.buildingCommissioned({
    colonyId: "c1", buildingId: "m-third", buildingType: "habitat_module",
    costDeducted: { metal: 100 }, cyclesToBuild: 1,
  }));

  const ids = save.colonies[0].buildings.map(b => b.id);
  assert.deepEqual(ids, ["z-first", "a-second", "m-third"], "insertion order must be preserved");
});

test("colonyReducer preserves order after buildingCompleted", () => {
  let save = makeSave();
  save = colonyReducer(save, Events.founded({
    colonyId: "c1", name: "Test", planetId: "ashfall", foundingType: "outpost",
    regionNodeId: "rn1", missionCount: 0, layoutSeed: 42,
  }));
  save.colonies[0] = { ...save.colonies[0], resources: { food: 0, water: 0, metal: 5000, credits: 0 } };

  save = colonyReducer(save, Events.buildingCommissioned({
    colonyId: "c1", buildingId: "z", buildingType: "solar_array",
    costDeducted: { metal: 80 }, cyclesToBuild: 1,
  }));
  save = colonyReducer(save, Events.buildingCommissioned({
    colonyId: "c1", buildingId: "a", buildingType: "farm",
    costDeducted: { metal: 100 }, cyclesToBuild: 2,
  }));
  // Complete the second one — order must not shift
  save = colonyReducer(save, Events.buildingCompleted({ colonyId: "c1", buildingId: "a" }));

  const ids = save.colonies[0].buildings.map(b => b.id);
  assert.deepEqual(ids, ["z", "a"], "order preserved after completion");
  assert.equal(save.colonies[0].buildings[1].status, "operational");
});

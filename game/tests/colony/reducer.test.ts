import { test } from "node:test";
import assert from "node:assert/strict";
import { colonyReducer } from "../../app/components/colony/shared/colonyReducer";
import { Events } from "../../app/components/colony/shared/colonyEvents";
import type { SaveData } from "../../app/components/engine/types";

function makeEmptySave(): SaveData {
  return {
    currentWorld: 1,
    levels: {},
    credits: 0,
    totalStars: 0,
    totalScore: 0,
    xp: 0,
    upgrades: {} as SaveData["upgrades"],
    unlockedCodex: [],
    viewedCodex: [],
    viewedConversations: [],
    completedQuests: [],
    activeQuests: [],
    completedPlanets: [],
    unlockedSpecialMissions: [],
    completedSpecialMissions: [],
    storyItems: [],
    materials: [],
    consumableInventory: {},
    equippedConsumables: [],
    unlockedEnhancements: [],
    bestiary: {},
    equippedWeaponType: "kinetic",
    pilotLevel: 1,
    skillPoints: 0,
    allocatedSkills: [],
    colonies: [],
    planets: [],
    earthShipments: [],
    factionStandings: [],
    bounties: [],
    missionsSinceStart: 0,
    gameClock: { day: 0, hour: 7, minute: 0, realtimeMsPerGameMinute: 1000, season: "standard" },
  };
}

test("colony/founded adds a new colony to save data", () => {
  const save = makeEmptySave();
  const next = colonyReducer(save, Events.founded({
    colonyId: "c1",
    name: "Test Colony",
    planetId: "ashfall",
    foundingType: "outpost",
    regionNodeId: "rn1",
    missionCount: 0,
    layoutSeed: 42,
  }));
  assert.equal(next.colonies.length, 1);
  assert.equal(next.colonies[0].id, "c1");
  assert.equal(next.colonies[0].name, "Test Colony");
  assert.equal(next.colonies[0].foundingType, "outpost");
  assert.equal(next.colonies[0].tier, 1);
  assert.equal(next.colonies[0].happiness, 50);
  assert.equal(next.colonies[0].lastCycleProcessed, 0);
});

test("colony/founded does not mutate input save", () => {
  const save = makeEmptySave();
  const before = save.colonies;
  colonyReducer(save, Events.founded({
    colonyId: "c1",
    name: "Test",
    planetId: "ashfall",
    foundingType: "outpost",
    regionNodeId: "rn1",
    missionCount: 0,
    layoutSeed: 42,
  }));
  assert.equal(save.colonies, before);
  assert.equal(save.colonies.length, 0);
});

test("colony/founded with duplicate colonyId throws", () => {
  let save = makeEmptySave();
  save = colonyReducer(save, Events.founded({
    colonyId: "c1", name: "First", planetId: "ashfall", foundingType: "outpost",
    regionNodeId: "rn1", missionCount: 0, layoutSeed: 42,
  }));
  assert.throws(
    () => colonyReducer(save, Events.founded({
      colonyId: "c1", name: "Dup", planetId: "ashfall", foundingType: "outpost",
      regionNodeId: "rn2", missionCount: 0, layoutSeed: 99,
    })),
    /already exists/,
  );
});

test("colony/buildingCommissioned adds building with constructing status", () => {
  let save = makeEmptySave();
  save = colonyReducer(save, Events.founded({
    colonyId: "c1", name: "Test", planetId: "ashfall", foundingType: "outpost",
    regionNodeId: "rn1", missionCount: 0, layoutSeed: 42,
  }));
  save.colonies[0] = { ...save.colonies[0], resources: { food: 0, water: 0, metal: 500, credits: 0 } };
  save = colonyReducer(save, Events.buildingCommissioned({
    colonyId: "c1",
    buildingId: "b1",
    buildingType: "solar_array",
    costDeducted: { metal: 80 },
    cyclesToBuild: 1,
  }));
  const colony = save.colonies[0];
  assert.equal(colony.buildings.length, 1);
  assert.equal(colony.buildings[0].id, "b1");
  assert.equal(colony.buildings[0].status, "constructing");
  assert.equal(colony.buildings[0].buildProgressCycles, 1);
  assert.equal(colony.resources.metal, 420); // 500 - 80
});

test("colony/buildingCompleted flips status to operational", () => {
  let save = makeEmptySave();
  save = colonyReducer(save, Events.founded({
    colonyId: "c1", name: "Test", planetId: "ashfall", foundingType: "outpost",
    regionNodeId: "rn1", missionCount: 0, layoutSeed: 42,
  }));
  save.colonies[0] = { ...save.colonies[0], resources: { food: 0, water: 0, metal: 500, credits: 0 } };
  save = colonyReducer(save, Events.buildingCommissioned({
    colonyId: "c1",
    buildingId: "b1",
    buildingType: "solar_array",
    costDeducted: { metal: 80 },
    cyclesToBuild: 1,
  }));
  save = colonyReducer(save, Events.buildingCompleted({ colonyId: "c1", buildingId: "b1" }));
  const b = save.colonies[0].buildings[0];
  assert.equal(b.status, "operational");
  assert.equal(b.buildProgressCycles, 0);
});

test("colony/buildingCommissioned throws on unknown colonyId", () => {
  const save = makeEmptySave();
  assert.throws(
    () => colonyReducer(save, Events.buildingCommissioned({
      colonyId: "nonexistent", buildingId: "b1", buildingType: "solar_array",
      costDeducted: { metal: 80 }, cyclesToBuild: 1,
    })),
    /not found/,
  );
});

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
    activeExperience: "legacy",
    galaxyRun: null,
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
  assert.deepEqual(next.colonies[0].siteStats, {
    oreDensity: 50, waterTable: 50, buildableSlots: 6, threat: 50,
  });
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

test("colony/cycleAdvanced updates lastCycleProcessed and applies deltas", () => {
  let save = makeEmptySave();
  save = colonyReducer(save, Events.founded({
    colonyId: "c1", name: "Test", planetId: "ashfall", foundingType: "outpost",
    regionNodeId: "rn1", missionCount: 0, layoutSeed: 42,
  }));
  save.colonies[0] = {
    ...save.colonies[0],
    resources: { food: 100, water: 100, metal: 100, credits: 0 },
    population: { total: 10, capacity: 10, namedCount: 0, growthRate: 0, recentDeaths: [] },
  };
  save = colonyReducer(save, Events.cycleAdvanced({
    colonyId: "c1",
    toCycle: 1,
    resourceDelta: { food: -10, metal: 10 },
    populationDelta: 2,
    happinessAfter: 65,
  }));
  const c = save.colonies[0];
  assert.equal(c.lastCycleProcessed, 1);
  assert.equal(c.resources.food, 90);
  assert.equal(c.resources.metal, 110);
  assert.equal(c.population.total, 12);
  assert.equal(c.happiness, 65);
});

test("colony/resourceChanged applies delta without touching cycle", () => {
  let save = makeEmptySave();
  save = colonyReducer(save, Events.founded({
    colonyId: "c1", name: "T", planetId: "ashfall", foundingType: "outpost",
    regionNodeId: "rn1", missionCount: 0, layoutSeed: 42,
  }));
  save.colonies[0] = { ...save.colonies[0], resources: { food: 50, water: 0, metal: 0, credits: 0 } };
  save = colonyReducer(save, Events.resourceChanged({ colonyId: "c1", delta: { food: 20 }, reason: "mission_reward" }));
  assert.equal(save.colonies[0].resources.food, 70);
  assert.equal(save.colonies[0].lastCycleProcessed, 0);
});

test("colony/standingChanged updates factionStandings", () => {
  let save = makeEmptySave();
  save.factionStandings = [{ factionId: "ashfall_camp", standing: 10, rank: "neutral", permissions: [] }];
  save = colonyReducer(save, Events.standingChanged({
    factionId: "ashfall_camp", delta: 35, newStanding: 45,
  }));
  const fs = save.factionStandings.find(f => f.factionId === "ashfall_camp")!;
  assert.equal(fs.standing, 45);
  assert.equal(fs.rank, "liked");
});

test("colony/standingChanged creates faction entry if absent", () => {
  let save = makeEmptySave();
  save = colonyReducer(save, Events.standingChanged({
    factionId: "new_faction", delta: 50, newStanding: 50,
  }));
  const fs = save.factionStandings.find(f => f.factionId === "new_faction")!;
  assert.ok(fs);
  assert.equal(fs.standing, 50);
  assert.equal(fs.rank, "liked");
});

test("colony/poiCleared marks node cleared on matching planet", () => {
  let save = makeEmptySave();
  save = colonyReducer(save, Events.founded({
    colonyId: "c1", name: "T", planetId: "ashfall", foundingType: "outpost",
    regionNodeId: "rn1", missionCount: 0, layoutSeed: 42,
  }));
  save.planets = [{
    id: "ashfall",
    regionMap: {
      seed: 1,
      nodes: [{
        id: "rn_ruins", name: "Ruins", type: "ruins", intel: "rumored", siteStats: null, discovered: true, authored: false,
        templateId: "t1", seed: 1, cleared: false, respawnMissions: null,
        coords: { x: 0, y: 0 }, elevationMetadata: null,
      }],
      edges: [],
    },
    biome: "desert",
    campaignUnlocked: true,
  }];
  save = colonyReducer(save, Events.poiCleared({ colonyId: "c1", regionNodeId: "rn_ruins" }));
  assert.equal(save.planets[0].regionMap.nodes[0].cleared, true);
});

test("colony/attackIncoming appends a threat to the colony", () => {
  let save = makeEmptySave();
  save = colonyReducer(save, Events.founded({
    colonyId: "c1", name: "T", planetId: "ashfall", foundingType: "outpost",
    regionNodeId: "rn1", missionCount: 0, layoutSeed: 42,
  }));
  save = colonyReducer(save, Events.attackIncoming({
    colonyId: "c1",
    threatKind: "raid_incoming",
    cyclesUntilResolve: 3,
  }));
  assert.equal(save.colonies[0].activeThreats.length, 1);
  assert.equal(save.colonies[0].activeThreats[0].kind, "raid_incoming");
  assert.equal(save.colonies[0].activeThreats[0].cyclesUntilResolve, 3);
});

test("colony/shipmentOrdered adds shipment to earthShipments queue", () => {
  let save = makeEmptySave();
  save = colonyReducer(save, Events.founded({
    colonyId: "c1", name: "T", planetId: "ashfall", foundingType: "outpost",
    regionNodeId: "rn1", missionCount: 0, layoutSeed: 42,
  }));
  save = colonyReducer(save, Events.shipmentOrdered({
    colonyId: "c1",
    shipmentId: "ship-1",
    contents: { food: 100, metal: 50 },
    etaCycles: 2,
    costPaid: 300,
  }));
  assert.equal(save.earthShipments.length, 1);
  assert.equal(save.earthShipments[0].id, "ship-1");
  assert.equal(save.earthShipments[0].eta.missionCount, 2);
  assert.equal(save.earthShipments[0].contents.food, 100);
  assert.equal(save.earthShipments[0].destinationColonyId, "c1");
});

test("colony/shipmentArrived deposits contents and removes shipment from queue", () => {
  let save = makeEmptySave();
  save = colonyReducer(save, Events.founded({
    colonyId: "c1", name: "T", planetId: "ashfall", foundingType: "outpost",
    regionNodeId: "rn1", missionCount: 0, layoutSeed: 42,
  }));
  save.colonies[0] = { ...save.colonies[0], resources: { food: 10, water: 0, metal: 5, credits: 0 } };
  save = colonyReducer(save, Events.shipmentOrdered({
    colonyId: "c1",
    shipmentId: "ship-1",
    contents: { food: 100, metal: 50 },
    etaCycles: 0,
    costPaid: 300,
  }));
  save = colonyReducer(save, Events.shipmentArrived({
    colonyId: "c1",
    shipmentId: "ship-1",
    delivered: { food: 100, metal: 50 },
  }));
  assert.equal(save.colonies[0].resources.food, 110);
  assert.equal(save.colonies[0].resources.metal, 55);
  assert.equal(save.earthShipments.length, 0);
});

test("colony/shipmentArrived with unknown shipmentId is a no-op", () => {
  let save = makeEmptySave();
  save = colonyReducer(save, Events.founded({
    colonyId: "c1", name: "T", planetId: "ashfall", foundingType: "outpost",
    regionNodeId: "rn1", missionCount: 0, layoutSeed: 42,
  }));
  const before = save.colonies[0].resources.food;
  save = colonyReducer(save, Events.shipmentArrived({
    colonyId: "c1",
    shipmentId: "nonexistent",
    delivered: { food: 999 },
  }));
  assert.equal(save.colonies[0].resources.food, before);
});

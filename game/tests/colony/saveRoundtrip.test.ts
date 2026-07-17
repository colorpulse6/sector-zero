import { test } from "node:test";
import assert from "node:assert/strict";
import { createHydrationSafeSave, loadSave, migrateSave } from "../../app/components/engine/save";
import { defaultFactionStandings } from "../../app/components/colony/shared/factionLedger";
import { colonyReducer } from "../../app/components/colony/shared/colonyReducer";
import { Events } from "../../app/components/colony/shared/colonyEvents";

test("migrateSave on empty object produces default colony fields", () => {
  const migrated = migrateSave({});
  assert.deepEqual(migrated.colonies, []);
  assert.equal(migrated.planets.length, 1);
  assert.equal(migrated.planets[0].id, "ashfall");
  assert.equal(migrated.planets[0].regionMap.nodes.length, 6);
  assert.deepEqual(migrated.earthShipments, []);
  assert.deepEqual(migrated.factionStandings, defaultFactionStandings());
  assert.deepEqual(migrated.bounties, []);
  assert.equal(migrated.missionsSinceStart, 0);
  assert.equal(migrated.gameClock.hour, 7);
});

test("migrateSave preserves pre-existing non-colony fields", () => {
  const oldSave = {
    currentWorld: 3,
    credits: 500,
    xp: 1200,
  };
  const migrated = migrateSave(oldSave);
  assert.equal(migrated.currentWorld, 3);
  assert.equal(migrated.credits, 500);
  assert.equal(migrated.xp, 1200);
});

test("migrateSave preserves colony fields if present", () => {
  const oldSave = {
    missionsSinceStart: 12,
    colonies: [],
    gameClock: { day: 5, hour: 14, minute: 30, realtimeMsPerGameMinute: 1000, season: "storm" },
  };
  const migrated = migrateSave(oldSave);
  assert.equal(migrated.missionsSinceStart, 12);
  assert.equal(migrated.gameClock.day, 5);
  assert.equal(migrated.gameClock.season, "storm");
});

test("migrateSave gives legacy colonies neutral site stats and remaps the starter node", () => {
  const legacyColony = {
    id: "ashfall_primary",
    name: "Ashfall Primary",
    planetId: "ashfall",
    foundingType: "outpost",
    tier: 1,
    regionNodeId: "ashfall_starter_region",
    population: { total: 0, capacity: 0, namedCount: 0, growthRate: 0, recentDeaths: [] },
    resources: { food: 0, water: 0, metal: 10, credits: 0 },
    buildings: [], districts: [], namedNpcs: [], backgroundColonistDensity: 0,
    happiness: 50, selfSufficient: false, lastCycleProcessed: 0,
    lastGameClock: { day: 0, hour: 7, minute: 0, realtimeMsPerGameMinute: 1000, season: "standard" },
    activeThreats: [], activeQuestlines: [], discoveredPoiIds: [], layoutSeed: 42,
    founded: { missionCount: 0, gameClockTick: 0 },
  };
  const migrated = migrateSave({ colonies: [legacyColony] });
  assert.deepEqual(migrated.colonies[0].siteStats, {
    oreDensity: 50, waterTable: 50, buildableSlots: 6, threat: 50,
  });
  assert.equal(migrated.colonies[0].regionNodeId, "ashfall-forward-camp");
  const anchor = migrated.planets[0].regionMap.nodes.find(node => node.id === "ashfall-forward-camp");
  assert.equal(anchor?.intel, "claimed");
  assert.deepEqual(anchor?.siteStats, migrated.colonies[0].siteStats);
});

test("migrateSave maps legacy discovered and cleared flags to intel without dropping nodes", () => {
  const migrated = migrateSave({
    planets: [{
      id: "ashfall",
      biome: "desert",
      campaignUnlocked: true,
      regionMap: {
        nodes: [{
          id: "legacy-ruin",
          type: "ruins",
          discovered: true,
          cleared: true,
          authored: false,
          templateId: "legacy-template",
          seed: 7,
          respawnMissions: null,
          coords: { x: 12, y: 34 },
          elevationMetadata: null,
        }],
        edges: [],
      },
    }],
  });
  const node = migrated.planets[0].regionMap.nodes[0];
  assert.equal(node.id, "legacy-ruin");
  assert.equal(node.name, "Legacy Ruin");
  assert.equal(node.intel, "cleared");
  assert.equal(node.siteStats, null);
  assert.equal(migrated.planets[0].regionMap.seed, 4107);
  assert.ok(migrated.planets[0].regionMap.nodes.some(entry => entry.id === "ashfall-forward-camp"));
  assert.ok(migrated.planets[0].regionMap.nodes.some(entry => entry.id === "ashfall-oathbreaker-wreck"));
  assert.equal(migrated.planets[0].regionMap.edges.length, 6);
});

test("migrateSave preserves current M1 intel and site stats", () => {
  const first = migrateSave({});
  first.planets[0].regionMap.nodes[1].intel = "cleared";
  first.planets[0].regionMap.nodes[4].siteStats = {
    oreDensity: 99, waterTable: 2, buildableSlots: 3, threat: 88,
  };
  const migrated = migrateSave(first as unknown as Record<string, unknown>);
  assert.equal(migrated.planets[0].regionMap.nodes[1].intel, "cleared");
  assert.deepEqual(migrated.planets[0].regionMap.nodes[4].siteStats, {
    oreDensity: 99, waterTable: 2, buildableSlots: 3, threat: 88,
  });
});

test("poi clear reducer state survives a save migration roundtrip", () => {
  let save = migrateSave({});
  save = colonyReducer(save, Events.founded({
    colonyId: "c1",
    name: "Ashfall Primary",
    planetId: "ashfall",
    foundingType: "outpost",
    regionNodeId: "ashfall-forward-camp",
    missionCount: 0,
    layoutSeed: 42,
  }));
  save = colonyReducer(save, Events.poiCleared({
    colonyId: "c1",
    regionNodeId: "ashfall-cinder-relay",
  }));
  const before = save.planets[0].regionMap.nodes.find(node => node.id === "ashfall-cinder-relay");
  assert.equal(before?.intel, "cleared");

  const migrated = migrateSave(save as unknown as Record<string, unknown>);
  const after = migrated.planets[0].regionMap.nodes.find(node => node.id === "ashfall-cinder-relay");
  assert.equal(after?.intel, "cleared");
});

test("loadSave fallback creates isolated nested region state", () => {
  const first = loadSave();
  const second = loadSave();
  assert.notStrictEqual(first.planets, second.planets);
  assert.notStrictEqual(first.planets[0], second.planets[0]);
  assert.notStrictEqual(first.planets[0].regionMap, second.planets[0].regionMap);
  assert.notStrictEqual(first.planets[0].regionMap.nodes[0], second.planets[0].regionMap.nodes[0]);

  first.planets[0].regionMap.nodes[0].intel = "claimed";
  assert.equal(second.planets[0].regionMap.nodes[0].intel, "surveyed");
});

test("the hydration seed is deterministic and defers browser storage until mount", () => {
  const root = globalThis as unknown as Record<string, unknown>;
  const priorWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const priorStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  let reads = 0;
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem() {
        reads += 1;
        return JSON.stringify({ currentWorld: 7 });
      },
    },
  });
  try {
    const hydration = createHydrationSafeSave();
    assert.equal(reads, 0);
    assert.equal(hydration.currentWorld, 1);
    assert.equal(hydration.activeExperience, "legacy");
    assert.equal(hydration.galaxyRun, null);

    assert.equal(loadSave().currentWorld, 7);
    assert.equal(reads, 1);
  } finally {
    if (priorWindow) Object.defineProperty(globalThis, "window", priorWindow);
    else delete root.window;
    if (priorStorage) Object.defineProperty(globalThis, "localStorage", priorStorage);
    else delete root.localStorage;
  }
});

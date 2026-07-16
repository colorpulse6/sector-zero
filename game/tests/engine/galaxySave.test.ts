import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultFactionStandings } from "../../app/components/colony/shared/factionLedger";
import { G0_GENERATION_IDENTITY } from "../../app/components/engine/galaxy/atlas";
import {
  G0_STARTING_SUPPLY,
  createFreshGalaxyRun,
  getGalaxyRunAvailability,
  migrateGalaxyRun,
  startFreshGalaxy,
} from "../../app/components/engine/galaxy/galaxyRun";
import { DEFAULT_UPGRADES, EnemyType } from "../../app/components/engine/types";
import { migrateSave } from "../../app/components/engine/save";

const COMPLETE_IDENTITY = {
  galaxySeed: "fixture-complete-identity",
  generationVersion: 1,
  authoredAnchorRegistryVersion: 1,
};

function jsonClone<T>(value: T): T {
  return structuredClone(value);
}

function withoutGalaxyNamespace<T extends {
  activeExperience: unknown;
  galaxyRun: unknown;
}>(save: T): Omit<T, "activeExperience" | "galaxyRun"> {
  const { activeExperience: _activeExperience, galaxyRun: _galaxyRun, ...legacy } = save;
  return legacy;
}

function validOperation(state = "available") {
  return {
    state,
    acceptedCycle: null,
    resolvedCycle: null,
    completionIds: [],
  };
}

test("legacy saves default to an isolated legacy experience", () => {
  const migrated = migrateSave({ credits: 999, colonies: [{ id: "legacy" }] });
  assert.equal(migrated.activeExperience, "legacy");
  assert.equal(migrated.galaxyRun, null);
});

test("invalid save namespace selectors fall back closed without auto-starting", () => {
  const migrated = migrateSave({
    activeExperience: "future-mode",
    galaxyRun: [],
  });

  assert.equal(migrated.activeExperience, "legacy");
  assert.equal(migrated.galaxyRun, null);
});

test("migrateSave field-migrates an existing run instead of replacing it", () => {
  const rawRun = jsonClone(createFreshGalaxyRun(COMPLETE_IDENTITY)) as Record<string, any>;
  rawRun.worldCycle = 9;
  rawRun.resources.supply = 6;
  rawRun.vessel.coordinate.localX = 0.5;

  const migrated = migrateSave({
    activeExperience: "galaxy",
    galaxyRun: rawRun,
  });

  assert.equal(migrated.activeExperience, "galaxy");
  assert.equal(migrated.galaxyRun?.worldCycle, 9);
  assert.equal(migrated.galaxyRun?.resources.supply, 6);
  assert.deepEqual(migrated.galaxyRun?.vessel.coordinate, {
    sectorX: 0,
    sectorY: 0,
    localX: 512,
    localY: 512,
  });
  assert.notEqual(migrated.galaxyRun, rawRun);
});

test("fresh galaxy starts are isolated from every legacy progression field", () => {
  const left = migrateSave({
    currentWorld: 8,
    levels: { "8-3": { completed: true, stars: 3, highScore: 9001 } },
    credits: 999,
    xp: 8000,
    upgrades: {
      hullPlating: 3,
      engineBoost: 3,
      weaponCore: 2,
      munitionsBay: 3,
      fireControl: 2,
      shieldGenerator: 2,
    },
    unlockedCodex: ["legacy-codex"],
    viewedCodex: ["legacy-viewed"],
    completedQuests: ["legacy-quest"],
    completedPlanets: ["verdania"],
    completedSpecialMissions: ["kepler-black-box"],
    storyItems: ["kepler-black-box"],
    materials: ["phase-crystal"],
    consumableInventory: { "hull-repair": 4 },
    equippedConsumables: ["hull-repair"],
    unlockedEnhancements: ["reinforced-shield"],
    bestiary: {
      SCOUT: { enemyType: "SCOUT", classId: "swarm", killCount: 99 },
    },
    equippedWeaponType: "energy",
    pilotLevel: 12,
    skillPoints: 7,
    allocatedSkills: ["sharpshooter"],
    colonies: [{ id: "legacy-left-colony" }],
    factionStandings: [{
      factionId: "earth_command",
      standing: 100,
      rank: "allied",
      permissions: ["legacy"],
    }],
  });
  const right = migrateSave({
    currentWorld: 2,
    levels: { "1-1": { completed: false, stars: 0, highScore: 1 } },
    credits: 1,
    xp: 2,
    upgrades: {
      hullPlating: 1,
      engineBoost: 0,
      weaponCore: 0,
      munitionsBay: 0,
      fireControl: 0,
      shieldGenerator: 0,
    },
    unlockedCodex: ["different-codex"],
    viewedCodex: [],
    completedQuests: [],
    completedPlanets: ["pyraxis"],
    completedSpecialMissions: [],
    storyItems: [],
    materials: ["bio-fiber"],
    consumableInventory: { "scanner-pulse": 1 },
    equippedConsumables: ["scanner-pulse"],
    unlockedEnhancements: ["extended-magnet"],
    bestiary: {
      DRONE: { enemyType: "DRONE", classId: "tech-drone", killCount: 1 },
    },
    equippedWeaponType: "cryogenic",
    pilotLevel: 2,
    skillPoints: 0,
    allocatedSkills: [],
    colonies: [{ id: "legacy-right-colony" }],
    factionStandings: [{
      factionId: "ashfall_camp",
      standing: -100,
      rank: "hostile",
      permissions: [],
    }],
  });
  const leftBefore = jsonClone(left);
  const rightBefore = jsonClone(right);

  const startedLeft = startFreshGalaxy(left, COMPLETE_IDENTITY);
  const startedRight = startFreshGalaxy(right, COMPLETE_IDENTITY);

  assert.equal(startedLeft.activeExperience, "galaxy");
  assert.deepEqual(startedLeft.galaxyRun, startedRight.galaxyRun);
  assert.deepEqual(withoutGalaxyNamespace(startedLeft), withoutGalaxyNamespace(leftBefore));
  assert.deepEqual(withoutGalaxyNamespace(startedRight), withoutGalaxyNamespace(rightBefore));
  assert.deepEqual(left, leftBefore);
  assert.deepEqual(right, rightBefore);
  assert.notEqual(startedLeft.galaxyRun, startedRight.galaxyRun);
  assert.notEqual(startedLeft.galaxyRun?.ship.upgrades, left.upgrades);
  assert.notEqual(startedLeft.galaxyRun?.resources.materials, left.materials);
  assert.notEqual(startedLeft.galaxyRun?.colonies, left.colonies);
  assert.notEqual(startedLeft.galaxyRun?.ship, startedRight.galaxyRun?.ship);
  assert.notEqual(startedLeft.galaxyRun?.atlas.knowledge, startedRight.galaxyRun?.atlas.knowledge);
});

test("fresh G0 content is complete, authored, and reducer-founded", () => {
  const run = createFreshGalaxyRun(COMPLETE_IDENTITY);

  assert.deepEqual(run.identity, COMPLETE_IDENTITY);
  assert.notEqual(run.identity, COMPLETE_IDENTITY);
  assert.equal(run.worldCycle, 0);
  assert.equal(run.nextTransactionOrdinal, 1);
  assert.deepEqual(run.resources, { supply: G0_STARTING_SUPPLY, credits: 0, materials: [] });
  assert.equal(G0_STARTING_SUPPLY, 12);
  assert.deepEqual(run.ship, {
    upgrades: DEFAULT_UPGRADES,
    unlockedEnhancements: [],
    equippedWeaponType: "kinetic",
    consumableInventory: {},
    equippedConsumables: [],
  });
  assert.notEqual(run.ship.upgrades, DEFAULT_UPGRADES);
  assert.deepEqual(run.pilot, {
    xp: 0,
    level: 1,
    skillPoints: 0,
    allocatedSkills: [],
    bestiary: {},
  });
  assert.deepEqual(run.codex, { unlocked: [], viewed: [] });
  assert.deepEqual(run.storyItems, []);
  assert.deepEqual(run.vessel, {
    status: "stationary",
    coordinate: { sectorX: 0, sectorY: 0, localX: 512, localY: 512 },
    contactId: "contact:vanguard",
    transitTransactionId: null,
  });
  assert.deepEqual(
    Object.values(run.atlas.knowledge).map((record) => [
      record.subjectId,
      record.state,
      record.confidence,
      record.source,
      record.observedCycle,
      record.expiresCycle,
    ]),
    [
      ["contact:vanguard", "visited", "high", "authored", 0, null],
      ["contact:ashfall", "charted", "high", "authored", 0, null],
      ["contact:hostile-picket", "charted", "medium", "authored", 0, null],
      ["contact:kepler", "charted", "medium", "authored", 0, null],
      ["signal:unresolved-g0", "signal", "low", "authored", 0, null],
    ],
  );
  assert.equal(Object.keys(run.atlas.materializedFacts).length, 5);
  assert.equal(run.atlas.mappedCellKeys.length, 4);
  assert.deepEqual(run.atlas.accessFacts, []);
  assert.equal(run.atlas.threatObservations.length, 25);

  const threat = (subjectId: string, dimension: string) =>
    run.atlas.threatObservations.find((entry) =>
      entry.subjectId === subjectId && entry.dimension === dimension);
  for (const dimension of ["military", "political", "environmental", "logistical", "anomalous"]) {
    assert.equal(threat("contact:vanguard", dimension)?.band, "low");
  }
  assert.equal(threat("contact:ashfall", "environmental")?.band, "moderate");
  assert.equal(threat("contact:hostile-picket", "military")?.band, "high");
  assert.equal(threat("contact:hostile-picket", "logistical")?.band, "moderate");
  assert.equal(threat("contact:kepler", "environmental")?.band, "moderate");
  assert.equal(threat("contact:kepler", "anomalous")?.band, "moderate");
  assert.equal(threat("signal:unresolved-g0", "anomalous")?.band, "moderate");
  assert.equal(threat("signal:unresolved-g0", "military")?.band, "unknown");

  assert.deepEqual(Object.keys(run.operations), [
    "op:hostile-picket",
    "op:kepler-black-box",
    "op:ashfall-sortie",
  ]);
  for (const operation of Object.values(run.operations)) {
    assert.deepEqual(operation, validOperation());
  }
  assert.equal(run.activeTravel, null);
  assert.deepEqual(run.appliedOutcomeIds, []);
  assert.deepEqual(run.historyFacts.map((fact) => fact.id), [
    "fact:vanguard-operational",
    "fact:ashfall-distress",
    "fact:picket-patrol-active",
    "fact:kepler-recorder-signal",
    "fact:unresolved-signal",
  ]);
  assert.equal(run.historyFacts.every((fact) => fact.cycle === 0), true);
  assert.equal(run.historyFacts.every((fact) => fact.causeFactIds.length === 0), true);

  assert.equal(run.colonies.length, 1);
  assert.deepEqual({
    id: run.colonies[0].id,
    name: run.colonies[0].name,
    planetId: run.colonies[0].planetId,
    foundingType: run.colonies[0].foundingType,
    regionNodeId: run.colonies[0].regionNodeId,
    layoutSeed: run.colonies[0].layoutSeed,
    resources: run.colonies[0].resources,
    buildings: run.colonies[0].buildings,
    population: run.colonies[0].population.total,
  }, {
    id: "galaxy:ashfall-primary",
    name: "Ashfall Primary",
    planetId: "ashfall",
    foundingType: "outpost",
    regionNodeId: "ashfall-forward-camp",
    layoutSeed: 4107,
    resources: { food: 0, water: 0, metal: 0, credits: 0 },
    buildings: [],
    population: 0,
  });
  assert.equal(run.planets.length, 1);
  assert.equal(run.planets[0].id, "ashfall");
  assert.equal(run.planets[0].regionMap.seed, 4107);
  assert.equal(
    run.planets[0].regionMap.nodes.find((node) => node.id === "ashfall-forward-camp")?.intel,
    "claimed",
  );
  assert.deepEqual(run.factionStandings, defaultFactionStandings());
});

test("omitted identity uses G0 while a supplied identity is preserved exactly", () => {
  assert.deepEqual(createFreshGalaxyRun().identity, G0_GENERATION_IDENTITY);
  assert.deepEqual(createFreshGalaxyRun(COMPLETE_IDENTITY).identity, COMPLETE_IDENTITY);
});

test("unsupported safe identity versions survive migration and report recoverable reasons", () => {
  const bothUnsupported = migrateGalaxyRun({
    ...jsonClone(createFreshGalaxyRun()),
    identity: {
      galaxySeed: "saved-future",
      generationVersion: 999,
      authoredAnchorRegistryVersion: 998,
    },
  });
  assert.deepEqual(bothUnsupported.identity, {
    galaxySeed: "saved-future",
    generationVersion: 999,
    authoredAnchorRegistryVersion: 998,
  });
  assert.deepEqual(getGalaxyRunAvailability(bothUnsupported), {
    status: "unavailable",
    recoverable: true,
    reason: "unsupported_generation_version",
  });

  const registryUnsupported = migrateGalaxyRun({
    ...jsonClone(createFreshGalaxyRun()),
    identity: {
      galaxySeed: "saved-future",
      generationVersion: 1,
      authoredAnchorRegistryVersion: 998,
    },
  });
  assert.deepEqual(getGalaxyRunAvailability(registryUnsupported.identity), {
    status: "unavailable",
    recoverable: true,
    reason: "unsupported_registry_version",
  });
  assert.deepEqual(getGalaxyRunAvailability(null), { status: "not_started" });
  assert.deepEqual(getGalaxyRunAvailability(createFreshGalaxyRun()), { status: "available" });
});

test("corrupt nested fields fall back independently to fresh values", () => {
  const fresh = createFreshGalaxyRun(COMPLETE_IDENTITY);
  const raw = jsonClone(fresh) as Record<string, any>;
  raw.worldCycle = -1;
  raw.nextTransactionOrdinal = 3.5;
  raw.resources.supply = -8;
  raw.resources.credits = Number.POSITIVE_INFINITY;
  raw.resources.materials = ["not-a-material"];
  raw.ship.upgrades.hullPlating = -1;
  raw.ship.unlockedEnhancements = ["not-an-enhancement"];
  raw.ship.equippedWeaponType = "plasma";
  raw.ship.consumableInventory["hull-repair"] = -2;
  raw.ship.equippedConsumables = ["not-a-consumable"];
  raw.pilot.xp = -1;
  raw.pilot.level = 0;
  raw.pilot.skillPoints = -4;
  raw.pilot.allocatedSkills = ["not-a-skill"];
  raw.pilot.bestiary.SCOUT = { enemyType: "SCOUT", classId: 7, killCount: -1 };
  raw.codex.unlocked = ["valid", 4];
  raw.storyItems = ["not-a-story-item"];
  raw.vessel.status = "flying";
  raw.vessel.contactId = 42;
  raw.operations["op:hostile-picket"].acceptedCycle = -1;
  raw.operations["op:hostile-picket"].completionIds = ["ok", 1];
  raw.historyFacts[0].cycle = -1;
  raw.historyFacts[0].causeFactIds = ["ok", false];
  raw.appliedOutcomeIds = ["ok", null];
  raw.colonies = [null];
  raw.planets = "not-an-array";
  raw.factionStandings[0].rank = "venerated";

  const migrated = migrateGalaxyRun(raw);

  assert.equal(migrated.worldCycle, fresh.worldCycle);
  assert.equal(migrated.nextTransactionOrdinal, fresh.nextTransactionOrdinal);
  assert.deepEqual(migrated.resources, fresh.resources);
  assert.deepEqual(migrated.ship, fresh.ship);
  assert.deepEqual(migrated.pilot, fresh.pilot);
  assert.deepEqual(migrated.codex, fresh.codex);
  assert.deepEqual(migrated.storyItems, fresh.storyItems);
  assert.deepEqual(migrated.vessel, fresh.vessel);
  assert.deepEqual(migrated.operations["op:hostile-picket"], fresh.operations["op:hostile-picket"]);
  assert.deepEqual(migrated.historyFacts[0], fresh.historyFacts[0]);
  assert.deepEqual(migrated.appliedOutcomeIds, fresh.appliedOutcomeIds);
  assert.deepEqual(migrated.colonies, fresh.colonies);
  assert.deepEqual(migrated.planets, fresh.planets);
  assert.deepEqual(migrated.factionStandings, fresh.factionStandings);
});

test("valid nested serialized fields survive migration without aliases", () => {
  const raw = jsonClone(createFreshGalaxyRun(COMPLETE_IDENTITY)) as Record<string, any>;
  raw.worldCycle = 17;
  raw.nextTransactionOrdinal = 19;
  raw.resources = { supply: 8, credits: 77, materials: ["bio-fiber"] };
  raw.ship = {
    upgrades: {
      hullPlating: 1,
      engineBoost: 2,
      weaponCore: 1,
      munitionsBay: 1,
      fireControl: 1,
      shieldGenerator: 1,
    },
    unlockedEnhancements: ["reinforced-shield"],
    equippedWeaponType: "energy",
    consumableInventory: { "hull-repair": 2 },
    equippedConsumables: ["hull-repair"],
  };
  raw.pilot = {
    xp: 101,
    level: 3,
    skillPoints: 2,
    allocatedSkills: ["sharpshooter"],
    bestiary: {
      SCOUT: { enemyType: EnemyType.SCOUT, classId: "swarm", killCount: 5, firstSeenWorld: 1 },
    },
  };
  raw.codex = { unlocked: ["codex:new"], viewed: ["codex:new"] };
  raw.storyItems = ["kepler-black-box"];
  raw.vessel = {
    status: "in_transit",
    coordinate: { sectorX: 2, sectorY: 3, localX: 256, localY: 512 },
    contactId: null,
    transitTransactionId: "travel:19",
  };
  raw.atlas.accessFacts = [{
    id: "access:new",
    subjectId: "contact:vanguard",
    assessment: "contested",
    causeFactIds: ["fact:new"],
    cycle: 16,
  }];
  raw.atlas.threatObservations.push({
    id: "threat:new",
    subjectId: "contact:vanguard",
    dimension: "political",
    band: "severe",
    confidence: "medium",
    source: "report",
    observedCycle: 16,
  });
  raw.operations["op:new"] = {
    state: "active",
    acceptedCycle: 4,
    resolvedCycle: null,
    completionIds: ["completion:a"],
  };
  raw.activeTravel = {
    transactionId: "travel:19",
    state: "advancing",
    routePlanId: "route:kepler",
    origin: { sectorX: 2, sectorY: 3, localX: 256, localY: 512 },
    destination: { sectorX: 2, sectorY: 3, localX: 2048, localY: 1024 },
    targetId: "contact:kepler",
    legs: [{
      id: "leg:1",
      from: { sectorX: 2, sectorY: 3, localX: 256, localY: 512 },
      to: { sectorX: 2, sectorY: 3, localX: 2048, localY: 1024 },
      distanceUnits: 1863,
      cycles: 3,
      supplyCost: 4,
      interruptionCauseId: null,
    }],
    nextLegIndex: 0,
    appliedCheckpointIds: ["checkpoint:departed"],
    supplyCost: 4,
    elapsedCycles: 1,
    interruptionOperationId: null,
  };
  raw.historyFacts.push({
    id: "fact:new",
    kind: "travel_departed",
    subjectId: "travel:19",
    cycle: 17,
    causeFactIds: ["fact:vanguard-operational"],
  });
  raw.appliedOutcomeIds = ["outcome:new"];

  const migrated = migrateGalaxyRun(raw);

  assert.equal(migrated.worldCycle, 17);
  assert.equal(migrated.nextTransactionOrdinal, 19);
  assert.deepEqual(migrated.resources, raw.resources);
  assert.deepEqual(migrated.ship, raw.ship);
  assert.deepEqual(migrated.pilot, raw.pilot);
  assert.deepEqual(migrated.codex, raw.codex);
  assert.deepEqual(migrated.storyItems, raw.storyItems);
  assert.deepEqual(migrated.vessel, raw.vessel);
  assert.deepEqual(migrated.atlas.accessFacts, raw.atlas.accessFacts);
  assert.deepEqual(migrated.atlas.threatObservations.at(-1), raw.atlas.threatObservations.at(-1));
  assert.deepEqual(migrated.operations["op:new"], raw.operations["op:new"]);
  assert.deepEqual(migrated.activeTravel, raw.activeTravel);
  assert.deepEqual(migrated.historyFacts.at(-1), raw.historyFacts.at(-1));
  assert.deepEqual(migrated.appliedOutcomeIds, raw.appliedOutcomeIds);
  assert.notEqual(migrated.resources, raw.resources);
  assert.notEqual(migrated.ship.upgrades, raw.ship.upgrades);
  assert.notEqual(migrated.pilot.bestiary, raw.pilot.bestiary);
  assert.notEqual(migrated.atlas.accessFacts, raw.atlas.accessFacts);
  assert.notEqual(migrated.activeTravel?.legs, raw.activeTravel.legs);
  assert.notEqual(migrated.historyFacts, raw.historyFacts);
  assert.notEqual(migrated.colonies, raw.colonies);
  assert.notEqual(migrated.planets, raw.planets);
  assert.notEqual(migrated.factionStandings, raw.factionStandings);
});

test("invalid enum members fall back at field scope", () => {
  const fresh = createFreshGalaxyRun(COMPLETE_IDENTITY);
  const raw = jsonClone(fresh) as Record<string, any>;
  const factKey = Object.keys(raw.atlas.materializedFacts)[0];
  const knowledgeKey = Object.keys(raw.atlas.knowledge)[0];
  raw.atlas.materializedFacts[factKey].kind = "planet";
  raw.atlas.knowledge[knowledgeKey].state = "remembered";
  raw.atlas.knowledge[knowledgeKey].confidence = "certain";
  raw.atlas.knowledge[knowledgeKey].source = "oracle";
  raw.atlas.accessFacts = [{
    id: "bad-access",
    subjectId: "contact:vanguard",
    assessment: "open",
    causeFactIds: [],
    cycle: 0,
  }];
  raw.atlas.threatObservations[0].dimension = "economic";
  raw.atlas.threatObservations[0].band = "critical";
  raw.atlas.threatObservations[0].confidence = "certain";
  raw.atlas.threatObservations[0].source = "oracle";
  raw.operations["op:hostile-picket"].state = "paused";
  raw.activeTravel = {
    transactionId: "travel:enum",
    state: "teleported",
    routePlanId: "route:enum",
    origin: { sectorX: 0, sectorY: 0, localX: 512, localY: 512 },
    destination: { sectorX: 0, sectorY: 0, localX: 1024, localY: 512 },
    targetId: "contact:ashfall",
    legs: [],
    nextLegIndex: 0,
    appliedCheckpointIds: [],
    supplyCost: 1,
    elapsedCycles: 0,
    interruptionOperationId: null,
  };

  const migrated = migrateGalaxyRun(raw);

  assert.equal(migrated.atlas.materializedFacts[factKey].kind, fresh.atlas.materializedFacts[factKey].kind);
  assert.deepEqual(migrated.atlas.knowledge[knowledgeKey], fresh.atlas.knowledge[knowledgeKey]);
  assert.deepEqual(migrated.atlas.accessFacts, fresh.atlas.accessFacts);
  assert.deepEqual(migrated.atlas.threatObservations[0], fresh.atlas.threatObservations[0]);
  assert.equal(migrated.operations["op:hostile-picket"].state, "available");
  assert.equal(migrated.activeTravel?.state, "committed");
});

test("unsafe and fractional coordinates fall back predictably without throwing", () => {
  const fresh = createFreshGalaxyRun(COMPLETE_IDENTITY);
  const raw = jsonClone(fresh) as Record<string, any>;
  const factKey = Object.keys(raw.atlas.materializedFacts)[0];
  raw.vessel.coordinate.localX = 1.5;
  raw.atlas.materializedFacts[factKey].coordinate.sectorX = Number.MAX_SAFE_INTEGER + 1;
  raw.activeTravel = {
    transactionId: "travel:unsafe",
    state: "committed",
    routePlanId: "route:unsafe",
    origin: { sectorX: 0, sectorY: 0, localX: 1.25, localY: 0 },
    destination: { sectorX: 0, sectorY: 0, localX: Number.MAX_SAFE_INTEGER + 1, localY: 0 },
    targetId: null,
    legs: [{
      id: "leg:unsafe",
      from: { sectorX: 0, sectorY: 0, localX: 2.5, localY: 0 },
      to: { sectorX: 0, sectorY: 0, localX: 0, localY: Number.NaN },
      distanceUnits: 0,
      cycles: 0,
      supplyCost: 0,
      interruptionCauseId: null,
    }],
    nextLegIndex: 0,
    appliedCheckpointIds: [],
    supplyCost: 0,
    elapsedCycles: 0,
    interruptionOperationId: null,
  };

  const migrated = migrateGalaxyRun(raw);

  assert.deepEqual(migrated.vessel.coordinate, fresh.vessel.coordinate);
  assert.deepEqual(
    migrated.atlas.materializedFacts[factKey].coordinate,
    fresh.atlas.materializedFacts[factKey].coordinate,
  );
  assert.deepEqual(migrated.activeTravel?.origin, fresh.vessel.coordinate);
  assert.deepEqual(migrated.activeTravel?.destination, fresh.vessel.coordinate);
  assert.deepEqual(migrated.activeTravel?.legs[0].from, fresh.vessel.coordinate);
  assert.deepEqual(migrated.activeTravel?.legs[0].to, fresh.vessel.coordinate);
});

test("travel checkpoints and record arrays reject malformed serialized members", () => {
  const raw = jsonClone(createFreshGalaxyRun(COMPLETE_IDENTITY)) as Record<string, any>;
  raw.activeTravel = {
    transactionId: "travel:arrays",
    state: "arrived",
    routePlanId: "route:arrays",
    origin: { sectorX: 0, sectorY: 0, localX: 512, localY: 512 },
    destination: { sectorX: 0, sectorY: 0, localX: 1024, localY: 512 },
    targetId: "contact:ashfall",
    legs: [null],
    nextLegIndex: 1,
    appliedCheckpointIds: ["checkpoint:valid", 5],
    supplyCost: 1,
    elapsedCycles: 1,
    interruptionOperationId: null,
  };
  raw.atlas.mappedCellKeys = ["0:0:2:2", false];

  const migrated = migrateGalaxyRun(raw);

  assert.deepEqual(migrated.activeTravel?.legs, []);
  assert.deepEqual(migrated.activeTravel?.appliedCheckpointIds, []);
  assert.deepEqual(migrated.atlas.mappedCellKeys, createFreshGalaxyRun(COMPLETE_IDENTITY).atlas.mappedCellKeys);
});

test("prototype-sensitive map keys survive migration and JSON roundtrip as own data", () => {
  const operation = JSON.stringify(validOperation("available"));
  const raw = JSON.parse(`{
    "identity":{"galaxySeed":"proto","generationVersion":1,"authoredAnchorRegistryVersion":1},
    "operations":{"__proto__":${operation},"constructor":${operation}},
    "atlas":{
      "materializedFacts":{"__proto__":{"id":"fact:proto","cellKey":"proto","coordinate":{"sectorX":0,"sectorY":0,"localX":0,"localY":0},"kind":"empty","contactId":null,"stableSeed":1,"authored":false}},
      "knowledge":{"constructor":{"id":"knowledge:constructor","subjectId":"fact:proto","state":"charted","observedProperties":{"__proto__":"safe"},"confidence":"medium","source":"report","observedCycle":1,"expiresCycle":null}}
    }
  }`);

  const migrated = migrateGalaxyRun(raw);
  const roundTripped = migrateGalaxyRun(JSON.parse(JSON.stringify(migrated)));

  for (const key of ["__proto__", "constructor"]) {
    assert.equal(Object.prototype.hasOwnProperty.call(migrated.operations, key), true);
    assert.equal(migrated.operations[key].state, "available");
    assert.equal(Object.prototype.hasOwnProperty.call(roundTripped.operations, key), true);
    assert.deepEqual(roundTripped.operations[key], migrated.operations[key]);
  }
  assert.equal(
    Object.prototype.hasOwnProperty.call(migrated.atlas.materializedFacts, "__proto__"),
    true,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(migrated.atlas.knowledge, "constructor"),
    true,
  );
  const constructorKnowledge = Object.entries(migrated.atlas.knowledge)
    .find(([key]) => key === "constructor")?.[1];
  assert.ok(constructorKnowledge);
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      constructorKnowledge.observedProperties,
      "__proto__",
    ),
    true,
  );
});

test("migration clones current colony, planet, faction, atlas, and travel records", () => {
  const raw = jsonClone(createFreshGalaxyRun(COMPLETE_IDENTITY));
  const migrated = migrateGalaxyRun(raw);

  assert.deepEqual(migrated.colonies, raw.colonies);
  assert.deepEqual(migrated.planets, raw.planets);
  assert.deepEqual(migrated.factionStandings, raw.factionStandings);
  assert.deepEqual(migrated.atlas, raw.atlas);
  assert.notEqual(migrated.colonies, raw.colonies);
  assert.notEqual(migrated.colonies[0], raw.colonies[0]);
  assert.notEqual(migrated.colonies[0].population, raw.colonies[0].population);
  assert.notEqual(migrated.planets, raw.planets);
  assert.notEqual(migrated.planets[0].regionMap, raw.planets[0].regionMap);
  assert.notEqual(migrated.factionStandings, raw.factionStandings);
  assert.notEqual(migrated.atlas.materializedFacts, raw.atlas.materializedFacts);
});

test("JSON roundtrip and repeated migration are deterministic and alias-free", () => {
  const fresh = createFreshGalaxyRun(COMPLETE_IDENTITY);
  const serialized = JSON.parse(JSON.stringify(fresh));
  const first = migrateGalaxyRun(serialized);
  const second = migrateGalaxyRun(serialized);
  const remigrated = migrateGalaxyRun(JSON.parse(JSON.stringify(first)));

  assert.deepEqual(first, fresh);
  assert.deepEqual(second, first);
  assert.deepEqual(remigrated, first);
  assert.notEqual(second, first);
  assert.notEqual(second.resources, first.resources);
  assert.notEqual(second.atlas.knowledge, first.atlas.knowledge);
  assert.notEqual(second.colonies[0], first.colonies[0]);
});

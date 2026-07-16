import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultFactionStandings } from "../../app/components/colony/shared/factionLedger";
import {
  G0_GENERATION_IDENTITY,
  resolveCell,
} from "../../app/components/engine/galaxy/atlas";
import {
  G0_STARTING_SUPPLY,
  createFreshGalaxyRun,
  getGalaxyRunAvailability,
  migrateGalaxyRun,
  startFreshGalaxy,
} from "../../app/components/engine/galaxy/galaxyRun";
import { DEFAULT_UPGRADES, EnemyType } from "../../app/components/engine/types";
import { MAX_PILOT_LEVEL } from "../../app/components/engine/pilotLevel";
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

const TRAVEL_ORIGIN = { sectorX: 0, sectorY: 0, localX: 512, localY: 512 };
const TRAVEL_DESTINATION = { sectorX: 0, sectorY: 0, localX: 1024, localY: 512 };

function validTravel(state: string = "advancing") {
  const completed = state === "arrived";
  return {
    transactionId: "travel:quality",
    state,
    routePlanId: "route:quality",
    origin: { ...TRAVEL_ORIGIN },
    destination: { ...TRAVEL_DESTINATION },
    targetId: "contact:ashfall",
    legs: [{
      id: "leg:quality",
      from: { ...TRAVEL_ORIGIN },
      to: { ...TRAVEL_DESTINATION },
      distanceUnits: 512,
      cycles: 2,
      supplyCost: 2,
      interruptionCauseId: null,
    }],
    nextLegIndex: completed ? 1 : 0,
    appliedCheckpointIds: completed
      ? ["travel:quality:leg:0", "checkpoint:departed"]
      : ["checkpoint:departed"],
    supplyCost: 2,
    elapsedCycles: completed ? 2 : 0,
    interruptionOperationId: null,
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
  assert.deepEqual(migrated.codex, { unlocked: ["valid"], viewed: [] });
  assert.deepEqual(migrated.storyItems, fresh.storyItems);
  assert.deepEqual(migrated.vessel, fresh.vessel);
  assert.deepEqual(migrated.operations["op:hostile-picket"], {
    ...fresh.operations["op:hostile-picket"],
    completionIds: ["ok"],
  });
  assert.deepEqual(migrated.historyFacts[0], {
    ...fresh.historyFacts[0],
    causeFactIds: ["ok"],
  });
  assert.deepEqual(migrated.appliedOutcomeIds, ["ok"]);
  assert.deepEqual(migrated.colonies, []);
  assert.deepEqual(migrated.planets, fresh.planets);
  assert.deepEqual(migrated.factionStandings, fresh.factionStandings);
});

test("mixed enum arrays preserve valid members and clone non-array fallbacks", () => {
  const raw = jsonClone(createFreshGalaxyRun(COMPLETE_IDENTITY)) as Record<string, any>;
  raw.resources.materials = ["bio-fiber", "future-material", "phase-crystal"];
  raw.ship.unlockedEnhancements = [
    "reinforced-shield",
    "future-enhancement",
    "extended-magnet",
  ];
  raw.ship.equippedConsumables = [
    "hull-repair",
    "future-consumable",
    "scanner-pulse",
  ];
  raw.pilot.allocatedSkills = ["sharpshooter", "future-skill", "adrenaline"];
  raw.storyItems = ["kepler-black-box", "future-story-item", "kepler-black-box"];
  const before = jsonClone(raw);

  const migrated = migrateGalaxyRun(raw);

  assert.deepEqual(migrated.resources.materials, ["bio-fiber", "phase-crystal"]);
  assert.deepEqual(migrated.ship.unlockedEnhancements, [
    "reinforced-shield",
    "extended-magnet",
  ]);
  assert.deepEqual(migrated.ship.equippedConsumables, ["hull-repair", "scanner-pulse"]);
  assert.deepEqual(migrated.pilot.allocatedSkills, ["sharpshooter", "adrenaline"]);
  assert.deepEqual(migrated.storyItems, ["kepler-black-box", "kepler-black-box"]);
  assert.deepEqual(raw, before);
  assert.notEqual(migrated.resources.materials, raw.resources.materials);
  assert.notEqual(migrated.ship.unlockedEnhancements, raw.ship.unlockedEnhancements);
  assert.notEqual(migrated.ship.equippedConsumables, raw.ship.equippedConsumables);
  assert.notEqual(migrated.pilot.allocatedSkills, raw.pilot.allocatedSkills);
  assert.notEqual(migrated.storyItems, raw.storyItems);

  const malformed = jsonClone(createFreshGalaxyRun(COMPLETE_IDENTITY)) as Record<string, any>;
  malformed.resources.materials = { future: true };
  malformed.ship.unlockedEnhancements = null;
  malformed.ship.equippedConsumables = 7;
  malformed.pilot.allocatedSkills = "future-skill";
  malformed.storyItems = { future: true };
  const malformedBefore = jsonClone(malformed);
  const firstFallback = migrateGalaxyRun(malformed);
  const secondFallback = migrateGalaxyRun(malformed);

  assert.deepEqual(firstFallback.resources.materials, []);
  assert.deepEqual(firstFallback.ship.unlockedEnhancements, []);
  assert.deepEqual(firstFallback.ship.equippedConsumables, []);
  assert.deepEqual(firstFallback.pilot.allocatedSkills, []);
  assert.deepEqual(firstFallback.storyItems, []);
  assert.notEqual(firstFallback.resources.materials, secondFallback.resources.materials);
  assert.notEqual(
    firstFallback.ship.unlockedEnhancements,
    secondFallback.ship.unlockedEnhancements,
  );
  assert.notEqual(
    firstFallback.ship.equippedConsumables,
    secondFallback.ship.equippedConsumables,
  );
  assert.notEqual(firstFallback.pilot.allocatedSkills, secondFallback.pilot.allocatedSkills);
  assert.notEqual(firstFallback.storyItems, secondFallback.storyItems);
  assert.deepEqual(malformed, malformedBefore);
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
    elapsedCycles: 0,
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
  assert.equal(migrated.activeTravel, null);
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
  assert.equal(migrated.activeTravel, null);
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

  assert.equal(migrated.activeTravel, null);
  assert.deepEqual(migrated.atlas.mappedCellKeys, ["0:0:2:2"]);
});

test("malformed prototype-key map entries use own type-correct fallbacks", () => {
  const raw = JSON.parse(`{
    "identity":{"galaxySeed":"prototype-fallbacks","generationVersion":1,"authoredAnchorRegistryVersion":1},
    "operations":{
      "__proto__":{"state":"future-operation"},
      "constructor":null,
      "op:valid-sibling":{"state":"active","acceptedCycle":2,"resolvedCycle":null,"completionIds":["completion:valid"]}
    },
    "atlas":{
      "materializedFacts":{
        "__proto__":{"kind":"future-fact"},
        "constructor":{"id":"fact:constructor"},
        "cell:valid-sibling":{"id":"fact:valid-sibling","cellKey":"cell:valid-sibling","coordinate":{"sectorX":1,"sectorY":2,"localX":256,"localY":512},"kind":"ruin","contactId":null,"stableSeed":44,"authored":false}
      },
      "knowledge":{
        "__proto__":{"state":"future-knowledge"},
        "constructor":{"id":"knowledge:constructor"},
        "knowledge:valid-sibling":{"id":"knowledge:valid-sibling","subjectId":"fact:valid-sibling","state":"visited","observedProperties":{"safe":true},"confidence":"high","source":"direct_visit","observedCycle":3,"expiresCycle":null}
      }
    }
  }`);

  const ownEntry = (map: Record<string, unknown>, key: string): any => {
    const descriptor = Object.getOwnPropertyDescriptor(map, key);
    assert.ok(descriptor, `${key} must be retained as an own data property`);
    assert.equal("value" in descriptor, true);
    return descriptor.value;
  };
  const operationStates = new Set([
    "available", "accepted", "active", "complete", "failed", "expired",
  ]);
  const factKinds = new Set([
    "empty", "stellar_contact", "hazard", "ruin", "anomaly", "signal",
  ]);
  const knowledgeStates = new Set([
    "unknown", "signal", "charted", "visited", "lost_contact",
  ]);
  const confidences = new Set(["low", "medium", "high"]);
  const sources = new Set([
    "sensor", "report", "rumor", "archive", "ally", "direct_visit", "authored",
  ]);
  const assertOperationEntry = (entry: any) => {
    assert.equal(operationStates.has(entry.state), true);
    assert.equal(
      entry.acceptedCycle === null ||
        (Number.isSafeInteger(entry.acceptedCycle) && entry.acceptedCycle >= 0),
      true,
    );
    assert.equal(
      entry.resolvedCycle === null ||
        (Number.isSafeInteger(entry.resolvedCycle) && entry.resolvedCycle >= 0),
      true,
    );
    assert.equal(Array.isArray(entry.completionIds), true);
    assert.equal(entry.completionIds.every((id: unknown) => typeof id === "string"), true);
  };
  const assertCellFactEntry = (entry: any) => {
    assert.equal(typeof entry.id, "string");
    assert.equal(typeof entry.cellKey, "string");
    assert.equal(factKinds.has(entry.kind), true);
    assert.equal(entry.contactId === null || typeof entry.contactId === "string", true);
    assert.equal(Number.isSafeInteger(entry.stableSeed) && entry.stableSeed >= 0, true);
    assert.equal(typeof entry.authored, "boolean");
    for (const field of ["sectorX", "sectorY", "localX", "localY"]) {
      assert.equal(Number.isSafeInteger(entry.coordinate[field]), true);
    }
  };
  const assertKnowledgeEntry = (entry: any) => {
    assert.equal(typeof entry.id, "string");
    assert.equal(typeof entry.subjectId, "string");
    assert.equal(knowledgeStates.has(entry.state), true);
    assert.equal(entry.observedProperties !== null && typeof entry.observedProperties === "object", true);
    assert.equal(confidences.has(entry.confidence), true);
    assert.equal(sources.has(entry.source), true);
    assert.equal(Number.isSafeInteger(entry.observedCycle) && entry.observedCycle >= 0, true);
    assert.equal(
      entry.expiresCycle === null ||
        (Number.isSafeInteger(entry.expiresCycle) && entry.expiresCycle >= 0),
      true,
    );
  };

  let migrated: ReturnType<typeof migrateGalaxyRun> | undefined;
  assert.doesNotThrow(() => {
    migrated = migrateGalaxyRun(raw);
  });
  assert.ok(migrated);

  for (const key of ["__proto__", "constructor"]) {
    assertOperationEntry(ownEntry(migrated.operations, key));
    assertCellFactEntry(ownEntry(migrated.atlas.materializedFacts, key));
    assertKnowledgeEntry(ownEntry(migrated.atlas.knowledge, key));
  }
  assert.equal(ownEntry(migrated.operations, "op:valid-sibling").state, "active");
  assert.equal(ownEntry(migrated.atlas.materializedFacts, "cell:valid-sibling").kind, "ruin");
  assert.equal(ownEntry(migrated.atlas.knowledge, "knowledge:valid-sibling").state, "visited");

  const roundTripped = migrateGalaxyRun(JSON.parse(JSON.stringify(migrated)));
  for (const key of ["__proto__", "constructor"]) {
    assertOperationEntry(ownEntry(roundTripped.operations, key));
    assertCellFactEntry(ownEntry(roundTripped.atlas.materializedFacts, key));
    assertKnowledgeEntry(ownEntry(roundTripped.atlas.knowledge, key));
  }
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

test("quality group 1 preserves valid siblings in mixed-corrupt collections", () => {
  const raw = jsonClone(createFreshGalaxyRun(COMPLETE_IDENTITY)) as Record<string, any>;
  raw.codex = {
    unlocked: ["codex:a", 7, "codex:b", "codex:a"],
    viewed: [false, "codex:b", "codex:c", "codex:b"],
  };
  raw.atlas.mappedCellKeys = ["cell:a", null, "cell:b", "cell:a"];
  raw.atlas.accessFacts = [{
    id: "access:a",
    subjectId: "contact:vanguard",
    assessment: "reachable",
    causeFactIds: ["fact:a", false, "fact:b", "fact:a"],
    cycle: 1,
  }, null, {
    id: "access:b",
    subjectId: "contact:ashfall",
    assessment: "contested",
    causeFactIds: [],
    cycle: 2,
  }];
  raw.atlas.threatObservations = [{
    id: "observation:a",
    subjectId: "contact:vanguard",
    dimension: "military",
    band: "low",
    confidence: "high",
    source: "report",
    observedCycle: 1,
  }, null, {
    id: "observation:b",
    subjectId: "contact:ashfall",
    dimension: "environmental",
    band: "moderate",
    confidence: "medium",
    source: "sensor",
    observedCycle: 2,
  }];
  raw.operations["op:hostile-picket"].completionIds = [
    "completion:a", 2, "completion:b", "completion:a",
  ];
  raw.historyFacts = [{
    id: "history:a",
    kind: "test",
    subjectId: "subject:a",
    cycle: 1,
    causeFactIds: ["cause:a", {}, "cause:b", "cause:a"],
  }, null, {
    id: "history:b",
    kind: "test",
    subjectId: "subject:b",
    cycle: 2,
    causeFactIds: [],
  }];
  raw.appliedOutcomeIds = ["outcome:a", 9, "outcome:b", "outcome:a"];
  raw.ship.consumableInventory = {
    "hull-repair": 2,
    "scanner-pulse": -1,
    "cryo-charge": 3,
  };

  raw.vessel = {
    status: "in_transit",
    coordinate: { ...TRAVEL_ORIGIN },
    contactId: null,
    transitTransactionId: "travel:quality",
  };
  raw.activeTravel = validTravel();
  raw.activeTravel.appliedCheckpointIds = [
    "checkpoint:a", 3, "checkpoint:b", "checkpoint:a",
  ];

  const colony = raw.colonies[0];
  colony.namedNpcs = ["npc:a", 4, "npc:b", "npc:a"];
  colony.activeQuestlines = ["quest:a", null, "quest:b", "quest:a"];
  colony.discoveredPoiIds = ["poi:a", {}, "poi:b", "poi:a"];
  colony.population.recentDeaths = [{
    npcId: "npc:a",
    cyclesAgo: 1,
    cause: "natural",
    colonyId: colony.id,
  }, null, {
    npcId: null,
    cyclesAgo: 2,
    cause: "raid",
    colonyId: colony.id,
  }];
  colony.buildings = [{
    id: "building:a",
    type: "farm",
    tier: 1,
    status: "operational",
    buildProgressCycles: 0,
    hp: 10,
    maxHp: 10,
    interiorTemplateId: null,
    assignedNpcIds: ["npc:a", 1, "npc:b", "npc:a"],
    districtId: null,
  }, null, {
    id: "building:b",
    type: "habitat_module",
    tier: 1,
    status: "operational",
    buildProgressCycles: 0,
    hp: 8,
    maxHp: 8,
    interiorTemplateId: null,
    assignedNpcIds: [],
    districtId: null,
  }];
  colony.districts = [{
    id: "district:a",
    colonyId: colony.id,
    kind: "residential",
    tiles: [[0, 0]],
    travelAnchorId: null,
  }, null, {
    id: "district:b",
    colonyId: colony.id,
    kind: "industrial",
    tiles: [[1, 1]],
    travelAnchorId: null,
  }];
  colony.activeThreats = [{
    id: "colony-threat:a",
    kind: "raid_incoming",
    cyclesUntilResolve: 2,
    severity: "minor",
    targetBuildingId: null,
    payload: { retained: true },
  }, null, {
    id: "colony-threat:b",
    kind: "supply_disruption",
    cyclesUntilResolve: 4,
    severity: "major",
    targetBuildingId: null,
    payload: null,
  }];
  const before = jsonClone(raw);

  const migrated = migrateGalaxyRun(raw);

  assert.deepEqual(migrated.codex.unlocked, ["codex:a", "codex:b"]);
  assert.deepEqual(migrated.codex.viewed, ["codex:b", "codex:c"]);
  assert.deepEqual(migrated.atlas.mappedCellKeys, ["cell:a", "cell:b"]);
  assert.deepEqual(migrated.atlas.accessFacts.map((entry) => entry.id), ["access:a", "access:b"]);
  assert.deepEqual(migrated.atlas.accessFacts[0].causeFactIds, ["fact:a", "fact:b"]);
  assert.deepEqual(
    migrated.atlas.threatObservations.map((entry) => entry.id),
    ["observation:a", "observation:b"],
  );
  assert.deepEqual(
    migrated.operations["op:hostile-picket"].completionIds,
    ["completion:a", "completion:b"],
  );
  assert.deepEqual(migrated.historyFacts.map((entry) => entry.id), ["history:a", "history:b"]);
  assert.deepEqual(migrated.historyFacts[0].causeFactIds, ["cause:a", "cause:b"]);
  assert.deepEqual(migrated.appliedOutcomeIds, ["outcome:a", "outcome:b"]);
  assert.deepEqual(migrated.ship.consumableInventory, {
    "hull-repair": 2,
    "cryo-charge": 3,
  });
  assert.deepEqual(migrated.activeTravel?.appliedCheckpointIds, [
    "checkpoint:a", "checkpoint:b",
  ]);
  assert.deepEqual(migrated.colonies[0].namedNpcs, ["npc:a", "npc:b"]);
  assert.deepEqual(migrated.colonies[0].activeQuestlines, ["quest:a", "quest:b"]);
  assert.deepEqual(migrated.colonies[0].discoveredPoiIds, ["poi:a", "poi:b"]);
  assert.deepEqual(
    migrated.colonies[0].population.recentDeaths.map((entry) => entry.npcId),
    ["npc:a", null],
  );
  assert.deepEqual(migrated.colonies[0].buildings.map((entry) => entry.id), [
    "building:a", "building:b",
  ]);
  assert.deepEqual(migrated.colonies[0].buildings[0].assignedNpcIds, ["npc:a", "npc:b"]);
  assert.deepEqual(migrated.colonies[0].districts.map((entry) => entry.id), [
    "district:a", "district:b",
  ]);
  assert.deepEqual(migrated.colonies[0].activeThreats.map((entry) => entry.id), [
    "colony-threat:a", "colony-threat:b",
  ]);
  assert.deepEqual(raw, before);
  assert.notEqual(migrated.codex.unlocked, raw.codex.unlocked);

  const malformed = jsonClone(createFreshGalaxyRun(COMPLETE_IDENTITY)) as Record<string, any>;
  malformed.codex.unlocked = { not: "an array" };
  const left = migrateGalaxyRun(malformed);
  const right = migrateGalaxyRun(malformed);
  assert.deepEqual(left.codex.unlocked, []);
  assert.notEqual(left.codex.unlocked, right.codex.unlocked);
});

test("quality group 2 isolates keyed records and de-duplicates the first valid ID", () => {
  const fresh = createFreshGalaxyRun(COMPLETE_IDENTITY);
  const raw = jsonClone(fresh) as Record<string, any>;

  const customColony = jsonClone(fresh.colonies[0]) as Record<string, any>;
  customColony.id = "colony:verdania";
  customColony.name = "Verdania Relay";
  customColony.planetId = "verdania";
  customColony.regionNodeId = "verdania-relay";
  const duplicateColony = { ...jsonClone(customColony), name: "Duplicate Colony" };
  raw.colonies = [{ id: "colony:incomplete" }, customColony, null, duplicateColony];

  const customPlanet = jsonClone(fresh.planets[0]) as Record<string, any>;
  customPlanet.id = "verdania";
  customPlanet.biome = "jungle";
  const firstNode = jsonClone(customPlanet.regionMap.nodes[0]) as Record<string, any>;
  firstNode.id = "verdania-relay";
  firstNode.name = "Verdania Relay";
  const secondNode = { ...jsonClone(firstNode), id: "verdania-grove", name: "Verdania Grove" };
  customPlanet.regionMap.nodes = [
    firstNode,
    { id: "node:incomplete" },
    secondNode,
    null,
    { ...jsonClone(secondNode), name: "Duplicate Grove" },
  ];
  customPlanet.regionMap.edges = [
    [firstNode.id, secondNode.id],
    null,
    [secondNode.id, firstNode.id],
    [firstNode.id, secondNode.id],
  ];
  raw.planets = [
    { id: "verdania" },
    customPlanet,
    null,
    { ...jsonClone(customPlanet), biome: "ice" },
  ];

  raw.factionStandings = [
    { factionId: "future_faction" },
    { factionId: "future_faction", standing: 150, rank: "hostile", permissions: ["trade"] },
    null,
    { factionId: "future_faction", standing: -100, rank: "hostile", permissions: [] },
  ];

  const migrated = migrateGalaxyRun(raw);

  assert.deepEqual(migrated.colonies.map((entry) => entry.id), ["colony:verdania"]);
  assert.equal(migrated.colonies[0].name, "Verdania Relay");
  assert.deepEqual(migrated.planets.map((entry) => entry.id), ["verdania"]);
  assert.equal(migrated.planets[0].biome, "jungle");
  assert.deepEqual(migrated.planets[0].regionMap.nodes.map((entry) => entry.id), [
    "verdania-relay", "verdania-grove",
  ]);
  assert.equal(migrated.planets[0].regionMap.nodes[1].name, "Verdania Grove");
  assert.deepEqual(migrated.planets[0].regionMap.edges, [
    ["verdania-relay", "verdania-grove"],
    ["verdania-grove", "verdania-relay"],
  ]);
  assert.deepEqual(migrated.factionStandings, [{
    factionId: "future_faction",
    standing: 100,
    rank: "allied",
    permissions: ["trade"],
  }]);
});

test("quality group 3 validates travel atomically across every valid state", () => {
  for (const state of [
    "committed", "advancing", "interrupted", "diverted", "arrived", "resolved",
  ]) {
    const raw = jsonClone(createFreshGalaxyRun(COMPLETE_IDENTITY)) as Record<string, any>;
    raw.activeTravel = validTravel(state);
    if (state === "diverted") {
      raw.vessel = {
        status: "stranded",
        coordinate: { ...TRAVEL_ORIGIN },
        contactId: null,
        transitTransactionId: "travel:quality",
      };
    } else if (state === "arrived") {
      raw.vessel = {
        status: "stationary",
        coordinate: { ...TRAVEL_DESTINATION },
        contactId: "contact:ashfall",
        transitTransactionId: null,
      };
    } else if (state === "resolved") {
      raw.vessel = {
        status: "stationary",
        coordinate: { ...TRAVEL_ORIGIN },
        contactId: "contact:vanguard",
        transitTransactionId: null,
      };
    } else {
      raw.vessel = {
        status: "in_transit",
        coordinate: { ...TRAVEL_ORIGIN },
        contactId: null,
        transitTransactionId: "travel:quality",
      };
    }

    const migrated = migrateGalaxyRun(raw);
    assert.deepEqual(migrated.activeTravel, raw.activeTravel, `${state} travel must survive`);
    assert.deepEqual(migrated.vessel, raw.vessel, `${state} vessel must survive`);
  }

  const partialRoute = jsonClone(createFreshGalaxyRun(COMPLETE_IDENTITY)) as Record<string, any>;
  partialRoute.activeTravel = validTravel("committed");
  partialRoute.activeTravel.legs = [partialRoute.activeTravel.legs[0], null];
  partialRoute.vessel = {
    status: "in_transit",
    coordinate: { ...TRAVEL_DESTINATION },
    contactId: null,
    transitTransactionId: "travel:quality",
  };
  const partialRecovery = migrateGalaxyRun(partialRoute);
  assert.equal(partialRecovery.activeTravel, null);
  assert.deepEqual(partialRecovery.vessel, {
    status: "stationary",
    coordinate: TRAVEL_ORIGIN,
    contactId: null,
    transitTransactionId: null,
  });

  const corrupt = jsonClone(createFreshGalaxyRun(COMPLETE_IDENTITY)) as Record<string, any>;
  corrupt.activeTravel = validTravel("advancing");
  corrupt.activeTravel.nextLegIndex = 99;
  corrupt.activeTravel.legs.push({
    ...jsonClone(corrupt.activeTravel.legs[0]),
    from: { ...TRAVEL_DESTINATION },
    to: { sectorX: 0, sectorY: 0, localX: 1536, localY: 512 },
  });
  corrupt.activeTravel.appliedCheckpointIds = ["checkpoint:a", "checkpoint:a"];
  corrupt.activeTravel.supplyCost = 999;
  corrupt.vessel = {
    status: "in_transit",
    coordinate: { ...TRAVEL_DESTINATION },
    contactId: null,
    transitTransactionId: "travel:quality",
  };
  const recovered = migrateGalaxyRun(corrupt);
  assert.equal(recovered.activeTravel, null);
  assert.deepEqual(recovered.vessel, {
    status: "stationary",
    coordinate: TRAVEL_ORIGIN,
    contactId: null,
    transitTransactionId: null,
  });

  const incoherentArrival = jsonClone(createFreshGalaxyRun(COMPLETE_IDENTITY)) as Record<string, any>;
  incoherentArrival.activeTravel = validTravel("arrived");
  incoherentArrival.vessel = {
    status: "stationary",
    coordinate: { ...TRAVEL_ORIGIN },
    contactId: "contact:vanguard",
    transitTransactionId: null,
  };
  const arrivalRecovery = migrateGalaxyRun(incoherentArrival);
  assert.equal(arrivalRecovery.activeTravel, null);
  assert.deepEqual(arrivalRecovery.vessel, incoherentArrival.vessel);

  const invalidNumeric = jsonClone(createFreshGalaxyRun(COMPLETE_IDENTITY)) as Record<string, any>;
  invalidNumeric.activeTravel = validTravel("advancing");
  invalidNumeric.activeTravel.nextLegIndex = -1;
  invalidNumeric.activeTravel.legs[0].supplyCost = 0.5;
  invalidNumeric.activeTravel.supplyCost = 0;
  invalidNumeric.vessel = {
    status: "in_transit",
    coordinate: { ...TRAVEL_DESTINATION },
    contactId: null,
    transitTransactionId: "travel:quality",
  };
  const numericRecovery = migrateGalaxyRun(invalidNumeric);
  assert.equal(numericRecovery.activeTravel, null);
  assert.deepEqual(numericRecovery.vessel, {
    ...invalidNumeric.vessel,
    status: "stationary",
    coordinate: TRAVEL_ORIGIN,
    transitTransactionId: null,
  });
});

function advancingTravelFixture(): Record<string, any> {
  const raw = jsonClone(createFreshGalaxyRun(COMPLETE_IDENTITY)) as Record<string, any>;
  raw.activeTravel = validTravel("advancing");
  raw.vessel = {
    status: "in_transit",
    coordinate: { ...TRAVEL_ORIGIN },
    contactId: null,
    transitTransactionId: "travel:quality",
  };
  return raw;
}

function assertAtomicTravelRecovery(raw: Record<string, any>): void {
  const migrated = migrateGalaxyRun(raw);
  assert.equal(migrated.activeTravel, null);
  assert.deepEqual(migrated.vessel, {
    status: "stationary",
    coordinate: TRAVEL_ORIGIN,
    contactId: null,
    transitTransactionId: null,
  });
}

test("travel progress rejects elapsed cycles beyond completed legs", () => {
  const raw = advancingTravelFixture();
  raw.activeTravel.elapsedCycles = 99;
  assertAtomicTravelRecovery(raw);
});

test("travel progress rejects a completed leg without its canonical checkpoint", () => {
  const raw = advancingTravelFixture();
  raw.activeTravel.nextLegIndex = 1;
  raw.activeTravel.elapsedCycles = 2;
  raw.vessel.coordinate = { ...TRAVEL_DESTINATION };
  assertAtomicTravelRecovery(raw);
});

test("travel progress rejects a premature canonical leg checkpoint", () => {
  const raw = advancingTravelFixture();
  raw.activeTravel.appliedCheckpointIds.push("travel:quality:leg:0");
  assertAtomicTravelRecovery(raw);
});

test("travel progress rejects an in-transit vessel away from its route endpoint", () => {
  const raw = advancingTravelFixture();
  raw.vessel.coordinate = { sectorX: 0, sectorY: 0, localX: 777, localY: 777 };
  assertAtomicTravelRecovery(raw);
});

test("travel progress rejects an empty checkpoint ID", () => {
  const raw = advancingTravelFixture();
  raw.activeTravel.appliedCheckpointIds.push("");
  assertAtomicTravelRecovery(raw);
});

test("quality group 4 enforces numeric domains and accepts exact boundaries", () => {
  const fresh = createFreshGalaxyRun(COMPLETE_IDENTITY);
  const invalid = jsonClone(fresh) as Record<string, any>;
  invalid.resources = { supply: 1.5, credits: Number.MAX_SAFE_INTEGER + 1, materials: [] };
  invalid.ship.upgrades = {
    hullPlating: -1,
    engineBoost: 6,
    weaponCore: 2.5,
    munitionsBay: Number.MAX_SAFE_INTEGER,
    fireControl: Number.POSITIVE_INFINITY,
    shieldGenerator: "5",
  };
  invalid.pilot.xp = 0.5;
  invalid.pilot.level = MAX_PILOT_LEVEL + 1;
  invalid.pilot.skillPoints = Number.MAX_SAFE_INTEGER + 1;
  invalid.colonies[0].lastGameClock = {
    day: 0.5,
    hour: 24,
    minute: 60,
    realtimeMsPerGameMinute: 0,
    season: "standard",
  };
  invalid.colonies[0].siteStats = {
    oreDensity: -1,
    waterTable: 101,
    buildableSlots: 7,
    threat: Number.NaN,
  };
  invalid.colonies[0].backgroundColonistDensity = 1.1;
  invalid.colonies[0].happiness = 101;
  invalid.factionStandings = [
    { factionId: "earth_command", standing: 150, rank: "hostile", permissions: [] },
    { factionId: "ashfall_camp", standing: -150, rank: "allied", permissions: [] },
    { factionId: "free_traders", standing: 50, rank: "hostile", permissions: [] },
  ];

  const recovered = migrateGalaxyRun(invalid);
  assert.deepEqual(recovered.resources, fresh.resources);
  assert.deepEqual(recovered.ship.upgrades, DEFAULT_UPGRADES);
  assert.deepEqual(recovered.pilot, fresh.pilot);
  assert.deepEqual(recovered.colonies[0].lastGameClock, fresh.colonies[0].lastGameClock);
  assert.deepEqual(recovered.colonies[0].siteStats, fresh.colonies[0].siteStats);
  assert.equal(
    recovered.colonies[0].backgroundColonistDensity,
    fresh.colonies[0].backgroundColonistDensity,
  );
  assert.equal(recovered.colonies[0].happiness, fresh.colonies[0].happiness);
  assert.deepEqual(recovered.factionStandings.map(({ standing, rank }) => ({ standing, rank })), [
    { standing: 100, rank: "allied" },
    { standing: -100, rank: "hostile" },
    { standing: 50, rank: "liked" },
  ]);

  const boundary = jsonClone(fresh) as Record<string, any>;
  boundary.resources = { supply: 0, credits: Number.MAX_SAFE_INTEGER, materials: [] };
  boundary.ship.upgrades = {
    hullPlating: 0,
    engineBoost: 5,
    weaponCore: 0,
    munitionsBay: 5,
    fireControl: 0,
    shieldGenerator: 5,
  };
  boundary.pilot = {
    ...boundary.pilot,
    xp: Number.MAX_SAFE_INTEGER,
    level: MAX_PILOT_LEVEL,
    skillPoints: 0,
  };
  boundary.colonies[0].lastGameClock = {
    day: 0,
    hour: 23,
    minute: 59,
    realtimeMsPerGameMinute: 0.01,
    season: "standard",
  };
  boundary.colonies[0].siteStats = {
    oreDensity: 0,
    waterTable: 100,
    buildableSlots: 0,
    threat: 100,
  };
  boundary.colonies[0].backgroundColonistDensity = 1;
  boundary.colonies[0].happiness = 0;
  boundary.factionStandings = [
    { factionId: "lower", standing: -100, rank: "allied", permissions: [] },
    { factionId: "upper", standing: 100, rank: "hostile", permissions: [] },
  ];

  const preserved = migrateGalaxyRun(boundary);
  assert.deepEqual(preserved.resources, boundary.resources);
  assert.deepEqual(preserved.ship.upgrades, boundary.ship.upgrades);
  assert.equal(preserved.pilot.xp, Number.MAX_SAFE_INTEGER);
  assert.equal(preserved.pilot.level, MAX_PILOT_LEVEL);
  assert.equal(preserved.pilot.skillPoints, 0);
  assert.deepEqual(preserved.colonies[0].lastGameClock, boundary.colonies[0].lastGameClock);
  assert.deepEqual(preserved.colonies[0].siteStats, boundary.colonies[0].siteStats);
  assert.equal(preserved.colonies[0].backgroundColonistDensity, 1);
  assert.equal(preserved.colonies[0].happiness, 0);
  assert.deepEqual(preserved.factionStandings.map(({ standing, rank }) => ({ standing, rank })), [
    { standing: -100, rank: "hostile" },
    { standing: 100, rank: "allied" },
  ]);
});

test("quality group 5 keeps the save selector coherent with a recovered run", () => {
  const missing = migrateSave({ activeExperience: "galaxy", galaxyRun: null });
  const malformed = migrateSave({ activeExperience: "galaxy", galaxyRun: [] });
  const invalidObject = migrateSave({ activeExperience: "galaxy", galaxyRun: {} });
  assert.equal(missing.activeExperience, "legacy");
  assert.equal(missing.galaxyRun, null);
  assert.equal(malformed.activeExperience, "legacy");
  assert.equal(malformed.galaxyRun, null);
  assert.equal(invalidObject.activeExperience, "legacy");
  assert.equal(invalidObject.galaxyRun, null);

  const stored = createFreshGalaxyRun(COMPLETE_IDENTITY);
  const legacy = migrateSave({ activeExperience: "legacy", galaxyRun: stored });
  assert.equal(legacy.activeExperience, "legacy");
  assert.deepEqual(legacy.galaxyRun, stored);
});

const INVALID_SAVE_IDENTITIES: ReadonlyArray<readonly [string, unknown]> = [
  ["an empty identity", {}],
  ["a missing galaxySeed", {
    generationVersion: 1,
    authoredAnchorRegistryVersion: 1,
  }],
  ["a non-string galaxySeed", {
    galaxySeed: 7,
    generationVersion: 1,
    authoredAnchorRegistryVersion: 1,
  }],
  ["a missing generationVersion", {
    galaxySeed: "partial",
    authoredAnchorRegistryVersion: 1,
  }],
  ["a non-number generationVersion", {
    galaxySeed: "partial",
    generationVersion: "1",
    authoredAnchorRegistryVersion: 1,
  }],
  ["a negative generationVersion", {
    galaxySeed: "partial",
    generationVersion: -1,
    authoredAnchorRegistryVersion: 1,
  }],
  ["a fractional generationVersion", {
    galaxySeed: "partial",
    generationVersion: 1.5,
    authoredAnchorRegistryVersion: 1,
  }],
  ["an unsafe generationVersion", {
    galaxySeed: "partial",
    generationVersion: Number.MAX_SAFE_INTEGER + 1,
    authoredAnchorRegistryVersion: 1,
  }],
  ["a missing authoredAnchorRegistryVersion", {
    galaxySeed: "partial",
    generationVersion: 1,
  }],
  ["a non-number authoredAnchorRegistryVersion", {
    galaxySeed: "partial",
    generationVersion: 1,
    authoredAnchorRegistryVersion: "1",
  }],
  ["a negative authoredAnchorRegistryVersion", {
    galaxySeed: "partial",
    generationVersion: 1,
    authoredAnchorRegistryVersion: -1,
  }],
  ["a fractional authoredAnchorRegistryVersion", {
    galaxySeed: "partial",
    generationVersion: 1,
    authoredAnchorRegistryVersion: 1.5,
  }],
  ["an unsafe authoredAnchorRegistryVersion", {
    galaxySeed: "partial",
    generationVersion: 1,
    authoredAnchorRegistryVersion: Number.MAX_SAFE_INTEGER + 1,
  }],
];

for (const [description, identity] of INVALID_SAVE_IDENTITIES) {
  test(`SaveData boundary rejects ${description}`, () => {
    const migrated = migrateSave({
      activeExperience: "galaxy",
      galaxyRun: { identity },
    });
    assert.equal(migrated.activeExperience, "legacy");
    assert.equal(migrated.galaxyRun, null);
  });
}

test("SaveData boundary drops an invalid run even under the legacy selector", () => {
  const migrated = migrateSave({
    activeExperience: "legacy",
    galaxyRun: { identity: { galaxySeed: "partial" } },
  });
  assert.equal(migrated.activeExperience, "legacy");
  assert.equal(migrated.galaxyRun, null);
});

test("SaveData boundary preserves a complete unsupported identity for neutral recovery", () => {
  const identity = {
    galaxySeed: "future-save-boundary",
    generationVersion: 999,
    authoredAnchorRegistryVersion: 998,
  };
  const migrated = migrateSave({
    activeExperience: "galaxy",
    galaxyRun: { identity },
  });
  assert.equal(migrated.activeExperience, "galaxy");
  assert.deepEqual(migrated.galaxyRun?.identity, identity);
  assert.deepEqual(getGalaxyRunAvailability(migrated.galaxyRun), {
    status: "unavailable",
    recoverable: true,
    reason: "unsupported_generation_version",
  });
  assert.deepEqual(migrated.galaxyRun?.atlas, {
    materializedFacts: {},
    knowledge: {},
    mappedCellKeys: [],
    accessFacts: [],
    threatObservations: [],
  });
});

test("quality group 6 uses supplied identities and neutral unsupported recovery", () => {
  const alternateIdentity = {
    galaxySeed: "alternate-supported-seed",
    generationVersion: 1,
    authoredAnchorRegistryVersion: 1,
  };
  const first = createFreshGalaxyRun(alternateIdentity);
  const second = createFreshGalaxyRun(alternateIdentity);
  assert.deepEqual(first, second);
  assert.deepEqual(first.identity, alternateIdentity);
  for (const fact of Object.values(first.atlas.materializedFacts)) {
    const resolved = resolveCell(alternateIdentity, fact.coordinate);
    assert.equal(resolved.ok, true);
    if (resolved.ok) assert.deepEqual(fact, resolved.fact);
  }

  const unsupportedGeneration = {
    galaxySeed: "future-generation",
    generationVersion: 999,
    authoredAnchorRegistryVersion: 1,
  };
  const unsupportedRegistry = {
    galaxySeed: "future-registry",
    generationVersion: 1,
    authoredAnchorRegistryVersion: 999,
  };
  assert.throws(
    () => createFreshGalaxyRun(unsupportedGeneration),
    { name: "RangeError", message: "Cannot create fresh galaxy run: unsupported_generation_version" },
  );
  assert.throws(
    () => createFreshGalaxyRun(unsupportedRegistry),
    { name: "RangeError", message: "Cannot create fresh galaxy run: unsupported_registry_version" },
  );
  const legacySave = migrateSave({ credits: 17 });
  const before = jsonClone(legacySave);
  assert.throws(
    () => startFreshGalaxy(legacySave, unsupportedGeneration),
    { name: "RangeError", message: "Cannot create fresh galaxy run: unsupported_generation_version" },
  );
  assert.deepEqual(legacySave, before);

  const migrated = migrateGalaxyRun({
    identity: unsupportedGeneration,
    operations: {
      "op:future": {
        state: "active",
        acceptedCycle: 4,
        resolvedCycle: null,
        completionIds: ["future:completion"],
      },
    },
  });
  assert.deepEqual(migrated.identity, unsupportedGeneration);
  assert.deepEqual(getGalaxyRunAvailability(migrated), {
    status: "unavailable",
    recoverable: true,
    reason: "unsupported_generation_version",
  });
  assert.deepEqual(migrated.atlas, {
    materializedFacts: {},
    knowledge: {},
    mappedCellKeys: [],
    accessFacts: [],
    threatObservations: [],
  });
  assert.deepEqual(Object.keys(migrated.operations), ["op:future"]);
  assert.deepEqual(migrated.resources, { supply: 0, credits: 0, materials: [] });
  assert.deepEqual(migrated.colonies, []);
  assert.deepEqual(migrated.planets, []);
  assert.deepEqual(migrated.factionStandings, []);
  assert.deepEqual(migrated.historyFacts, []);
  assert.deepEqual(migrated.appliedOutcomeIds, []);
});

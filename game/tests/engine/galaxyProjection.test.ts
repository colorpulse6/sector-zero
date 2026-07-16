import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceWorldCycle } from "../../app/components/colony/shared/cycleProcessor";
import { rankFromStanding } from "../../app/components/colony/shared/factionLedger";
import { recordKill } from "../../app/components/engine/bestiary";
import {
  advanceGalaxyWorldCycles,
  mergeProjectionIntoGalaxy,
  projectGalaxyRunToLegacySave,
  type GalaxyProjectionDelta,
} from "../../app/components/engine/galaxy/galaxyProjection";
import {
  createFreshGalaxyRun,
  startFreshGalaxy,
} from "../../app/components/engine/galaxy/galaxyRun";
import type { GalaxyRunState } from "../../app/components/engine/galaxy/galaxyTypes";
import { migrateSave } from "../../app/components/engine/save";
import {
  DEFAULT_UPGRADES,
  EnemyType,
  type SaveData,
} from "../../app/components/engine/types";

const SAVE_DATA_FIELDS: Record<keyof SaveData, true> = {
  currentWorld: true,
  levels: true,
  credits: true,
  totalStars: true,
  totalScore: true,
  xp: true,
  introSeen: true,
  upgrades: true,
  unlockedCodex: true,
  viewedCodex: true,
  viewedConversations: true,
  completedQuests: true,
  activeQuests: true,
  completedPlanets: true,
  unlockedSpecialMissions: true,
  completedSpecialMissions: true,
  storyItems: true,
  materials: true,
  consumableInventory: true,
  equippedConsumables: true,
  unlockedEnhancements: true,
  bestiary: true,
  equippedWeaponType: true,
  pilotLevel: true,
  skillPoints: true,
  allocatedSkills: true,
  colonies: true,
  planets: true,
  earthShipments: true,
  factionStandings: true,
  bounties: true,
  missionsSinceStart: true,
  gameClock: true,
  activeExperience: true,
  galaxyRun: true,
};

const LEGACY_TOP_LEVEL_FIELDS = (
  Object.keys(SAVE_DATA_FIELDS) as Array<keyof SaveData>
).filter((key) => key !== "activeExperience" && key !== "galaxyRun");

function richLegacyParent(): SaveData {
  const legacy = migrateSave({
    currentWorld: 8,
    levels: {
      "1-1": { completed: true, stars: 3, highScore: 12345 },
      "8-3": { completed: true, stars: 2, highScore: 98765 },
    },
    credits: 9999,
    totalStars: 77,
    totalScore: 456789,
    xp: 22222,
    introSeen: true,
    upgrades: {
      hullPlating: 3,
      engineBoost: 3,
      weaponCore: 2,
      munitionsBay: 3,
      fireControl: 2,
      shieldGenerator: 2,
    },
    unlockedCodex: ["legacy:codex"],
    viewedCodex: ["legacy:codex"],
    viewedConversations: ["legacy:conversation"],
    completedQuests: ["legacy:completed-quest"],
    activeQuests: ["legacy:active-quest"],
    completedPlanets: ["verdania", "pyraxis"],
    unlockedSpecialMissions: ["kepler-black-box"],
    completedSpecialMissions: ["kepler-black-box"],
    storyItems: ["kepler-black-box"],
    materials: ["phase-crystal", "ruin-shard"],
    consumableInventory: { "hull-repair": 4 },
    equippedConsumables: ["hull-repair"],
    unlockedEnhancements: ["reinforced-shield"],
    bestiary: {
      SCOUT: {
        enemyType: EnemyType.SCOUT,
        classId: "swarm",
        killCount: 99,
      },
    },
    equippedWeaponType: "energy",
    pilotLevel: 12,
    skillPoints: 7,
    allocatedSkills: ["sharpshooter"],
    colonies: [],
    planets: [],
    earthShipments: [{
      id: "legacy:shipment",
      contents: { metal: 50 },
      eta: { missionCount: 90 },
      interceptionChance: 0,
      interceptionTriggered: false,
      destinationColonyId: "legacy:colony",
      costPaid: 10,
    }],
    factionStandings: [{
      factionId: "earth_command",
      standing: 100,
      rank: "allied",
      permissions: ["legacy:permission"],
    }],
    bounties: [{
      id: "legacy:bounty",
      colonyId: "legacy:colony",
      amount: 500,
      reason: "treason",
      witnesses: ["legacy:witness"],
      issued: { missionCount: 4 },
      expired: false,
    }],
    missionsSinceStart: 88,
    gameClock: {
      day: 91,
      hour: 23,
      minute: 59,
      realtimeMsPerGameMinute: 250,
      season: "storm",
    },
  });
  return startFreshGalaxy(legacy);
}

function legacySnapshot(save: SaveData): Record<string, unknown> {
  return Object.fromEntries(
    LEGACY_TOP_LEVEL_FIELDS.map((key) => [key, structuredClone(save[key])]),
  );
}

function requireGalaxyRun(result: ReturnType<typeof mergeProjectionIntoGalaxy>): GalaxyRunState {
  assert.equal(result.ok, true, result.ok ? undefined : JSON.stringify(result.errors));
  if (!result.ok) throw new Error("projection merge was unexpectedly rejected");
  return result.galaxyRun;
}

test("engine projection cannot inherit legacy availability or progression", () => {
  const parent = richLegacyParent();
  assert.ok(parent.galaxyRun);

  const projected = projectGalaxyRunToLegacySave(parent);

  assert.deepEqual(projected.levels, {});
  assert.deepEqual(projected.completedPlanets, []);
  assert.deepEqual(projected.unlockedSpecialMissions, []);
  assert.deepEqual(projected.completedSpecialMissions, []);
  assert.deepEqual(projected.completedQuests, []);
  assert.deepEqual(projected.activeQuests, []);
  assert.deepEqual(projected.viewedConversations, []);
  assert.deepEqual(projected.earthShipments, []);
  assert.deepEqual(projected.bounties, []);
  assert.equal(projected.currentWorld, 1);
  assert.equal(projected.totalStars, 0);
  assert.equal(projected.totalScore, 0);
  assert.deepEqual(projected.colonies, parent.galaxyRun.colonies);
  assert.deepEqual(projected.planets, parent.galaxyRun.planets);
  assert.deepEqual(projected.factionStandings, parent.galaxyRun.factionStandings);
});

test("projection assigns every SaveData field and is explicitly non-recursive", () => {
  const parent = richLegacyParent();
  const projected = projectGalaxyRunToLegacySave(parent);

  assert.deepEqual(
    Object.keys(projected).sort(),
    Object.keys(SAVE_DATA_FIELDS).sort(),
  );
  assert.equal(Object.prototype.hasOwnProperty.call(projected, "introSeen"), true);
  assert.equal(projected.introSeen, undefined);
  assert.equal(projected.activeExperience, "legacy");
  assert.equal(projected.galaxyRun, null);
  assert.equal(projected.missionsSinceStart, parent.galaxyRun?.worldCycle);
});

test("projection exposes only galaxy-owned engine state", () => {
  const parent = richLegacyParent();
  const run = parent.galaxyRun!;
  run.resources.credits = 41;
  run.resources.materials = ["bio-fiber"];
  run.ship.upgrades.engineBoost = 2;
  run.ship.unlockedEnhancements = ["extended-magnet"];
  run.ship.equippedWeaponType = "cryogenic";
  run.ship.consumableInventory = { "scanner-pulse": 2 };
  run.ship.equippedConsumables = ["scanner-pulse"];
  run.pilot.xp = 101;
  run.pilot.level = 3;
  run.pilot.skillPoints = 1;
  run.pilot.allocatedSkills = ["sharpshooter"];
  run.pilot.bestiary = {
    DRONE: {
      enemyType: EnemyType.DRONE,
      classId: "tech-drone",
      killCount: 4,
    },
  };
  run.codex = { unlocked: ["galaxy:entry"], viewed: ["galaxy:entry"] };
  run.storyItems = ["kepler-black-box"];

  const projected = projectGalaxyRunToLegacySave(parent);

  assert.equal(projected.credits, 41);
  assert.deepEqual(projected.materials, ["bio-fiber"]);
  assert.deepEqual(projected.upgrades, run.ship.upgrades);
  assert.deepEqual(projected.unlockedEnhancements, ["extended-magnet"]);
  assert.equal(projected.equippedWeaponType, "cryogenic");
  assert.deepEqual(projected.consumableInventory, { "scanner-pulse": 2 });
  assert.deepEqual(projected.equippedConsumables, ["scanner-pulse"]);
  assert.equal(projected.xp, 101);
  assert.equal(projected.pilotLevel, 3);
  assert.equal(projected.skillPoints, 1);
  assert.deepEqual(projected.allocatedSkills, ["sharpshooter"]);
  assert.deepEqual(projected.bestiary, run.pilot.bestiary);
  assert.deepEqual(projected.unlockedCodex, ["galaxy:entry"]);
  assert.deepEqual(projected.viewedCodex, ["galaxy:entry"]);
  assert.deepEqual(projected.storyItems, ["kepler-black-box"]);
});

test("projection deep-copies every mutable galaxy value", () => {
  const parent = richLegacyParent();
  const run = parent.galaxyRun!;
  run.codex.unlocked.push("galaxy:before");
  const projected = projectGalaxyRunToLegacySave(parent);

  assert.notEqual(projected.upgrades, run.ship.upgrades);
  assert.notEqual(projected.colonies, run.colonies);
  assert.notEqual(projected.colonies[0], run.colonies[0]);
  assert.notEqual(projected.planets, run.planets);
  assert.notEqual(projected.factionStandings, run.factionStandings);
  assert.notEqual(projected.bestiary, run.pilot.bestiary);
  assert.notEqual(projected.unlockedCodex, run.codex.unlocked);

  projected.upgrades.engineBoost = 5;
  projected.colonies[0].resources.metal += 500;
  projected.planets[0].regionMap.nodes[0].name = "mutated projection";
  projected.factionStandings[0].permissions.push("mutated projection");
  projected.unlockedCodex.push("projection:only");
  run.codex.unlocked.push("run:only");

  assert.notEqual(run.ship.upgrades.engineBoost, 5);
  assert.notEqual(run.colonies[0].resources.metal, projected.colonies[0].resources.metal);
  assert.notEqual(run.planets[0].regionMap.nodes[0].name, "mutated projection");
  assert.equal(run.factionStandings[0].permissions.includes("mutated projection"), false);
  assert.equal(run.codex.unlocked.includes("projection:only"), false);
  assert.equal(projected.unlockedCodex.includes("run:only"), false);
});

test("projection requires a canonical parent with an active galaxy namespace", () => {
  assert.throws(
    () => projectGalaxyRunToLegacySave(migrateSave({})),
    /galaxy run/i,
  );
});

test("allowlisted merge covers every authorized projection delta", () => {
  const run = createFreshGalaxyRun();
  const before = structuredClone(run);
  const colonies = structuredClone(run.colonies);
  colonies[0].resources.metal += 25;
  colonies[0].name = "Ashfall Primary Relay";
  const planets = structuredClone(run.planets);
  const factionStandings = structuredClone(run.factionStandings);
  factionStandings[0] = {
    ...factionStandings[0],
    standing: 40,
    rank: rankFromStanding(40),
    permissions: ["dock:vanguard"],
  };
  const delta: GalaxyProjectionDelta = {
    colonies,
    planets,
    factionStandings,
    pilot: {
      xp: 3000,
      level: 3,
      skillPoints: 0,
      allocatedSkills: ["sharpshooter"],
      bestiary: {
        SCOUT: {
          enemyType: EnemyType.SCOUT,
          classId: "swarm",
          killCount: 3,
          firstSeenPlanet: "ashfall",
          firstSeenWorld: 1,
        },
      },
    },
    ship: {
      upgrades: { ...DEFAULT_UPGRADES, hullPlating: 1 },
      unlockedEnhancements: ["reinforced-shield"],
      equippedWeaponType: "energy",
      consumableInventory: { "hull-repair": 2 },
      equippedConsumables: ["hull-repair"],
    },
    resources: {
      supply: 10,
      credits: 17,
      materials: ["bio-fiber"],
    },
    codex: {
      unlocked: ["galaxy:ashfall"],
      viewed: ["galaxy:ashfall"],
    },
    storyItems: ["kepler-black-box"],
    missionsSinceStart: 0,
  };
  const deltaBefore = structuredClone(delta);

  const next = requireGalaxyRun(mergeProjectionIntoGalaxy(run, delta));

  assert.deepEqual(next.colonies, colonies);
  assert.deepEqual(next.planets, planets);
  assert.deepEqual(next.factionStandings, factionStandings);
  assert.deepEqual(next.pilot, delta.pilot);
  assert.deepEqual(next.ship, delta.ship);
  assert.deepEqual(next.resources, delta.resources);
  assert.deepEqual(next.codex, delta.codex);
  assert.deepEqual(next.storyItems, delta.storyItems);
  assert.equal(next.worldCycle, 0);
  assert.deepEqual(run, before);
  assert.deepEqual(delta, deltaBefore);
  assert.notEqual(next, run);
  assert.notEqual(next.colonies, delta.colonies);
  assert.notEqual(next.ship, delta.ship);
});

test("world-only recordKill Bestiary output crosses the projection boundary", () => {
  const run = createFreshGalaxyRun();
  const recorded = recordKill(
    run.pilot.bestiary,
    EnemyType.DRONE,
    "tech-drone",
    { world: 1 },
  );
  const recordedEntry = recorded.DRONE!;
  assert.equal(
    Object.prototype.hasOwnProperty.call(recordedEntry, "firstSeenPlanet"),
    true,
  );
  assert.equal(recordedEntry.firstSeenPlanet, undefined);

  const result = mergeProjectionIntoGalaxy(run, {
    pilot: { bestiary: recorded },
  });

  assert.equal(result.ok, true, result.ok ? undefined : JSON.stringify(result.errors));
  if (!result.ok) return;
  assert.deepEqual(result.galaxyRun.pilot.bestiary.DRONE, {
    enemyType: EnemyType.DRONE,
    classId: "tech-drone",
    killCount: 1,
    firstSeenWorld: 1,
  });
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      result.galaxyRun.pilot.bestiary.DRONE!,
      "firstSeenPlanet",
    ),
    false,
  );
});

test("unknown, inherited, prototype, accessor, and nested delta keys reject atomically", () => {
  const cases: Array<{ name: string; delta: unknown }> = [
    { name: "legacy levels", delta: { levels: { "1-1": true } } },
    { name: "unknown top-level", delta: { currentWorld: 8 } },
    { name: "prototype key", delta: JSON.parse('{"__proto__":{"polluted":true}}') },
    { name: "nested unknown", delta: { resources: { credits: 2, totalStars: 9 } } },
  ];
  const inherited = Object.create({ credits: 900 });
  inherited.resources = { credits: 2 };
  cases.push({ name: "inherited key", delta: inherited });
  let getterCalls = 0;
  const accessor: Record<string, unknown> = {};
  Object.defineProperty(accessor, "resources", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return { credits: 2 };
    },
  });
  cases.push({ name: "accessor", delta: accessor });

  for (const { name, delta } of cases) {
    const run = createFreshGalaxyRun();
    const before = structuredClone(run);
    const result = mergeProjectionIntoGalaxy(
      run,
      delta as GalaxyProjectionDelta,
    );
    assert.equal(result.ok, false, name);
    assert.deepEqual(run, before, name);
  }
  assert.equal(getterCalls, 0);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});

test("malformed or regressive authorized deltas fail closed", () => {
  const base = createFreshGalaxyRun();
  base.pilot.xp = 100;
  base.pilot.level = 2;
  base.ship.upgrades.hullPlating = 1;
  base.codex.unlocked = ["galaxy:existing"];
  base.storyItems = ["kepler-black-box"];
  base.pilot.bestiary = {
    SCOUT: {
      enemyType: EnemyType.SCOUT,
      classId: "swarm",
      killCount: 4,
      firstSeenPlanet: "ashfall",
    },
  };
  const removedColony = structuredClone(base.colonies);
  removedColony.length = 0;
  const rewrittenColony = structuredClone(base.colonies);
  rewrittenColony[0].siteStats.oreDensity += 1;
  const badRank = structuredClone(base.factionStandings);
  badRank[0] = { ...badRank[0], standing: 40, rank: "neutral" };
  const mismatchedCycleColonies = structuredClone(base.colonies);
  mismatchedCycleColonies[0].lastCycleProcessed = 0;

  const cases: Array<{ name: string; delta: GalaxyProjectionDelta }> = [
    { name: "negative credits", delta: { resources: { credits: -1 } } },
    { name: "xp decrement", delta: { pilot: { xp: 99 } } },
    { name: "level decrement", delta: { pilot: { level: 1 } } },
    {
      name: "upgrade decrement",
      delta: { ship: { upgrades: { ...base.ship.upgrades, hullPlating: 0 } } },
    },
    { name: "codex removal", delta: { codex: { unlocked: [] } } },
    { name: "story removal", delta: { storyItems: [] } },
    {
      name: "bestiary decrement",
      delta: {
        pilot: {
          bestiary: {
            SCOUT: {
              ...base.pilot.bestiary.SCOUT!,
              killCount: 3,
            },
          },
        },
      },
    },
    { name: "colony removal", delta: { colonies: removedColony } },
    { name: "immutable site rewrite", delta: { colonies: rewrittenColony } },
    { name: "bad faction rank", delta: { factionStandings: badRank } },
    { name: "cycle decrement", delta: { missionsSinceStart: -1 } },
    {
      name: "cycle-colony mismatch",
      delta: { missionsSinceStart: 1, colonies: mismatchedCycleColonies },
    },
    {
      name: "unknown material",
      delta: { resources: { materials: ["future-matter" as never] } },
    },
    {
      name: "non-finite data",
      delta: { resources: { credits: Number.POSITIVE_INFINITY } },
    },
    {
      name: "null bestiary patch",
      delta: { pilot: { bestiary: null as never } },
    },
    {
      name: "undefined outside an optional Bestiary field",
      delta: { codex: { unlocked: undefined as never } },
    },
    {
      name: "impossible pilot totals",
      delta: {
        pilot: {
          xp: 3000,
          level: 3,
          skillPoints: 1,
          allocatedSkills: ["sharpshooter"],
        },
      },
    },
  ];

  for (const { name, delta } of cases) {
    const run = structuredClone(base);
    const before = structuredClone(run);
    const result = mergeProjectionIntoGalaxy(run, delta);
    assert.equal(result.ok, false, name);
    assert.deepEqual(run, before, name);
  }
});

test("galaxy cycle advancement preserves every legacy field and ticks exactly N", () => {
  const parent = richLegacyParent();
  const parentBefore = structuredClone(parent);
  const legacyBefore = legacySnapshot(parent);
  const startingRun = structuredClone(parent.galaxyRun!);

  const result = advanceGalaxyWorldCycles(parent, 2);

  assert.equal(result.ok, true, result.ok ? undefined : JSON.stringify(result.errors));
  if (!result.ok) return;
  assert.deepEqual(legacySnapshot(result.save), legacyBefore);
  assert.deepEqual(parent, parentBefore);
  assert.equal(result.save.activeExperience, parent.activeExperience);
  assert.equal(result.save.galaxyRun?.worldCycle, startingRun.worldCycle + 2);
  assert.equal(result.galaxyRun.worldCycle, startingRun.worldCycle + 2);
  for (const colony of result.galaxyRun.colonies) {
    assert.equal(colony.lastCycleProcessed, startingRun.worldCycle + 2);
  }

  let expectedProjection = projectGalaxyRunToLegacySave(parent);
  expectedProjection = advanceWorldCycle(expectedProjection);
  expectedProjection = advanceWorldCycle(expectedProjection);
  assert.deepEqual(result.galaxyRun.colonies, expectedProjection.colonies);
  assert.equal(expectedProjection.activeExperience, "legacy");
  assert.equal(expectedProjection.galaxyRun, null);
});

test("run-only cycle API is deterministic for Task 6 and introduces no second counter", () => {
  const run = createFreshGalaxyRun();
  const before = structuredClone(run);

  const left = advanceGalaxyWorldCycles(run, 3);
  const right = advanceGalaxyWorldCycles(run, 3);

  assert.equal(left.ok, true, left.ok ? undefined : JSON.stringify(left.errors));
  assert.equal(right.ok, true, right.ok ? undefined : JSON.stringify(right.errors));
  if (!left.ok || !right.ok) return;
  assert.deepEqual(left.galaxyRun, right.galaxyRun);
  assert.equal(left.galaxyRun.worldCycle, 3);
  assert.equal(
    Object.prototype.hasOwnProperty.call(left.galaxyRun, "missionsSinceStart"),
    false,
  );
  assert.deepEqual(run, before);
  assert.notEqual(left.galaxyRun, run);
  assert.notEqual(left.galaxyRun, right.galaxyRun);
});

test("zero cycles is an identity no-op and invalid counts fail without mutation", () => {
  const run = createFreshGalaxyRun();
  const runBefore = structuredClone(run);
  const zeroRun = advanceGalaxyWorldCycles(run, 0);
  assert.equal(zeroRun.ok, true);
  if (zeroRun.ok) assert.equal(zeroRun.galaxyRun, run);

  const parent = richLegacyParent();
  const parentBefore = structuredClone(parent);
  const zeroSave = advanceGalaxyWorldCycles(parent, 0);
  assert.equal(zeroSave.ok, true);
  if (zeroSave.ok) {
    assert.equal(zeroSave.save, parent);
    assert.equal(zeroSave.galaxyRun, parent.galaxyRun);
  }

  for (const count of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN]) {
    const runResult = advanceGalaxyWorldCycles(run, count);
    const saveResult = advanceGalaxyWorldCycles(parent, count);
    assert.equal(runResult.ok, false, String(count));
    assert.equal(saveResult.ok, false, String(count));
    assert.deepEqual(run, runBefore, String(count));
    assert.deepEqual(parent, parentBefore, String(count));
  }
});

test("canonical cycle advancement rejects a missing galaxy namespace", () => {
  const legacy = migrateSave({ missionsSinceStart: 9 });
  const before = structuredClone(legacy);
  const result = advanceGalaxyWorldCycles(legacy, 1);

  assert.equal(result.ok, false);
  assert.deepEqual(legacy, before);
});

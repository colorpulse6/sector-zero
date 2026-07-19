import { test } from "node:test";
import assert from "node:assert/strict";
import { beginGalaxyExperience } from "../../app/components/engine/galaxy/experienceFlow";
import { migrateSave } from "../../app/components/engine/save";
import {
  acknowledgeOutcomeReturn,
  commitOutcome,
  createOutcomeAttempt,
  createOutcomeEnvelope,
  recoverLegacyPreparedOutcome,
  recoverOutcomeReturn,
  stageLegacyPreparedOutcome,
  type CanonicalSaveStore,
  type OutcomeDeclaredField,
} from "../../app/components/engine/missionOutcome";
import type {
  OutcomeAttempt,
  OutcomeRecoveryRecord,
  OutcomeRouteIdentity,
  OutcomeRouteKind,
  SaveData,
  SerializedOutcomeEnvelope,
} from "../../app/components/engine/types";
import { completePlanet } from "../../app/components/engine/planets";
import { unlockCodexEntries } from "../../app/components/engine/codex";
import { ROUTE_FOLD_FIELDS } from "../../app/components/engine/missionOutcomeFolds";
import { LEGACY_POI_FOLD_FIELDS } from "../../app/components/engine/missionOutcomeFolds";
import { colonyReducer } from "../../app/components/colony/shared/colonyReducer";
import { Events } from "../../app/components/colony/shared/colonyEvents";
import { dispatchPoi } from "../../app/components/colony/region/poiDispatcher";
import { GameScreen } from "../../app/components/engine/types";
import {
  recoverGalaxyPoiOutcomeAuthority,
  stageGalaxyPoiOutcomeAuthority,
} from "../../app/components/engine/operations/operationAdapters";
import {
  campaignMissionDescriptor,
  colonyMissionDescriptor,
  launchContextFromSave,
  routeIdentityMatchesMissionId,
  snapshotOutcomeRouteIdentity,
} from "../../app/components/engine/missionContext";
import { planRoute } from "../../app/components/engine/galaxy/routePlanner";
import {
  commitTravel,
  finalizeTravel,
  resumeTravelToBoundary,
} from "../../app/components/engine/galaxy/travelResolver";
import {
  createGalaxyPoiPreparedFact,
  recoverGalaxyPoiPreparation,
} from "../../app/components/engine/galaxy/galaxyPoiOutcomeAuthority";
import {
  mergeProjectionIntoGalaxy,
  projectGalaxyRunToLegacyState,
} from "../../app/components/engine/galaxy/galaxyProjection";

function attempt(
  save: SaveData,
  routeKind: OutcomeRouteKind,
  launchId: string,
  persistenceAuthority: OutcomeAttempt["persistenceAuthority"],
  returnTarget: OutcomeAttempt["returnTarget"],
  declaredFields: OutcomeDeclaredField[],
): OutcomeAttempt {
  const routeIdentity: OutcomeRouteIdentity = routeKind === "campaign"
    ? { kind: "campaign", world: 1, level: 1 }
    : routeKind === "planet"
      ? { kind: "planet", planetId: "glaciem" }
      : routeKind === "special"
        ? { kind: "special", missionId: "kepler-black-box" }
        : routeKind === "operation"
          ? { kind: "operation", operationId: "op:ashfall-sortie" }
          : routeKind === "colony"
            ? { kind: "colony", colonyId: "home", mode: "exterior", buildingId: null }
            : {
                kind: "poi",
                originColonyId: "home",
                nodeId: "ashfall-cinder-relay",
                engine: "firstPerson",
                templateId: "fp-ruin-cinder-relay",
                rewardEligible: true,
              };
  return {
    version: 1,
    routeKind,
    missionId: routeKind === "campaign" ? "campaign:1-1"
      : routeKind === "planet" ? "planet:glaciem"
        : routeKind === "special" ? "special:kepler-black-box"
          : routeKind === "operation" ? "operation:op:ashfall-sortie"
            : routeKind === "colony" ? "colony:4:home:exterior"
              : "poi:20:fp-ruin-cinder-relay:20:ashfall-cinder-relay",
    routeIdentity,
    launchId,
    expectedRevision: save.saveRevision,
    persistenceAuthority,
    returnTarget,
    declaredFields,
    launchSnapshot: Object.fromEntries(
      declaredFields.map((field) => [field, structuredClone(save[field])]),
    ),
  };
}

function envelope(
  outcomeAttempt: OutcomeAttempt,
  payload: unknown,
  terminalKind: "success" | "failure" | "retreat" = "success",
): SerializedOutcomeEnvelope {
  return createOutcomeEnvelope(outcomeAttempt, terminalKind, payload);
}

function campaignCommand(score = 100) {
  return {
    version: 1,
    kind: "campaign_result_v1",
    score,
    xpEarned: 25,
    killCount: 1,
    bestiaryKills: [{ type: "SCOUT", classId: "swarm" }],
    totalEnemies: 1,
    deaths: 0,
    frameCount: 120,
    playerHp: 100,
    playerMaxHp: 100,
  };
}

function campaignEnvelope(
  save: SaveData,
  launchId: string,
  returnTarget: "legacy-star-map" | "legacy-cockpit" = "legacy-cockpit",
  score = 100,
) {
  return envelope(
    attempt(save, "campaign", launchId, "legacy", returnTarget, [...ROUTE_FOLD_FIELDS.campaign]),
    campaignCommand(score),
  );
}

const LEGACY_POI_FIELDS = [...LEGACY_POI_FOLD_FIELDS];

function readyLegacyPoi(base: SaveData): SaveData {
  let save = colonyReducer(base, Events.founded({
    colonyId: "home",
    name: "Home",
    planetId: "ashfall",
    foundingType: "outpost",
    regionNodeId: "ashfall-forward-camp",
    missionCount: 0,
    layoutSeed: 1,
  }));
  save = {
    ...save,
    planets: save.planets.map((planet) => ({
      ...planet,
      regionMap: {
        ...planet.regionMap,
        nodes: planet.regionMap.nodes.map((node) => node.id === "ashfall-cinder-relay"
          ? { ...node, intel: "surveyed" as const }
          : node),
      },
    })),
  };
  return save;
}

function atAshfall(): SaveData {
  const begun = beginGalaxyExperience(migrateSave({}));
  assert.ok(begun.galaxyRun);
  const preview = planRoute(begun.galaxyRun!, { kind: "contact", contactId: "contact:ashfall" });
  assert.equal(preview.ok, true);
  if (!preview.ok) throw new Error("Ashfall route unavailable");
  const committed = commitTravel(begun.galaxyRun!, preview.plan);
  assert.equal(committed.ok, true);
  if (!committed.ok) throw new Error("Ashfall travel commit failed");
  const resumed = resumeTravelToBoundary(committed.galaxyRun);
  assert.equal(resumed.ok, true);
  if (!resumed.ok) throw new Error("Ashfall travel resume failed");
  const finalized = finalizeTravel(resumed.galaxyRun);
  assert.equal(finalized.ok, true);
  if (!finalized.ok) throw new Error("Ashfall travel finalize failed");
  return { ...begun, galaxyRun: finalized.galaxyRun };
}

function preparedLegacyRecord(base: SaveData, launchId: string, missionsSinceStart: number) {
  const canonical = readyLegacyPoi({ ...base, missionsSinceStart });
  const preparedEnvelope = envelope(
    attempt(canonical, "poi", launchId, "legacy", "legacy-colony-exterior", [...LEGACY_POI_FIELDS]),
    {
      version: 2,
      kind: "poi_prepared_v2",
    },
  );
  return { version: 2 as const, kind: "legacy_poi_prepared" as const, envelope: preparedEnvelope };
}

function memoryStore(initial: SaveData) {
  let current = initial;
  let writes = 0;
  let writeMode: "ok" | "before" | "after" = "ok";
  const store: CanonicalSaveStore = {
    read: () => current,
    write: (candidate) => {
      writes += 1;
      if (writeMode === "before") throw new Error("quota exceeded");
      current = candidate;
      if (writeMode === "after") throw new Error("write landed before acknowledgement");
    },
  };
  return {
    store,
    current: () => current,
    writes: () => writes,
    setCurrent: (save: SaveData) => { current = save; },
    setWriteMode: (mode: typeof writeMode) => { writeMode = mode; },
  };
}

function recoveryRecords(save: SaveData): OutcomeRecoveryRecord[] {
  return save.outcomeRecoveryRecords;
}

test("save migration defaults the canonical outcome metadata", () => {
  const migrated = migrateSave({});

  assert.equal(migrated.saveRevision, 0);
  assert.deepEqual(migrated.appliedOutcomeIds, []);
  assert.deepEqual(migrated.outcomeRecoveryRecords, []);
});

test("save migration bounds the root journal independently of the Galaxy operation journal", () => {
  const begun = beginGalaxyExperience(migrateSave({}));
  assert.ok(begun.galaxyRun);
  const rootIds = Array.from({ length: 270 }, (_, index) => `root:${index}`);
  const migrated = migrateSave({
    ...begun,
    saveRevision: 7,
    appliedOutcomeIds: [null, "root:duplicate", ...rootIds, "root:duplicate"],
    galaxyRun: {
      ...begun.galaxyRun,
      appliedOutcomeIds: ["operation:nested"],
    },
  });

  assert.equal(migrated.saveRevision, 7);
  assert.equal(migrated.appliedOutcomeIds.length, 256);
  assert.equal(new Set(migrated.appliedOutcomeIds).size, 256);
  assert.deepEqual(migrated.galaxyRun?.appliedOutcomeIds, ["operation:nested"]);
});

test("recovery migration accepts only exact own-data records and never invokes accessors", () => {
  const base = migrateSave({ missionsSinceStart: 1 });
  const prepared = preparedLegacyRecord(base, "prepared-launch", 2);
  const applied = {
    version: 2,
    kind: "applied_return",
    outcomeId: "applied-launch:success",
    launchId: "applied-launch",
    missionId: "campaign:1-1",
    routeKind: "campaign",
    routeIdentity: { kind: "campaign", world: 1, level: 1 },
    terminalKind: "success",
    persistenceAuthority: "legacy",
    returnTarget: "legacy-cockpit",
    appliedRevision: 2,
    returnPending: true,
  };
  let accessorReads = 0;
  const accessor = { ...applied };
  Object.defineProperty(accessor, "version", {
    enumerable: true,
    get() { accessorReads += 1; return 1; },
  });
  const inherited = Object.create(applied) as Record<string, unknown>;
  const hostile = [
    { ...applied, outcomeId: "forged" },
    { ...applied, appliedRevision: -1 },
    { ...applied, persistenceAuthority: "galaxy", returnTarget: "legacy-cockpit" },
    accessor,
    inherited,
  ];

  const accepted = migrateSave({
    saveRevision: 2,
    appliedOutcomeIds: [applied.outcomeId],
    outcomeRecoveryRecords: [applied, prepared, accessor, inherited],
  });

  assert.equal(accessorReads, 0);
  assert.deepEqual(accepted.outcomeRecoveryRecords, [applied, prepared]);
  const migrated = migrateSave({
    saveRevision: 2,
    appliedOutcomeIds: [applied.outcomeId],
    outcomeRecoveryRecords: [applied, prepared, ...hostile],
  });
  assert.equal(migrated.outcomeRecoveryRecords[0]?.kind, "reconciliation_required");
});

test("pending return migration locks incoherent journal and revision authority", () => {
  const applied = {
    version: 2,
    kind: "applied_return",
    outcomeId: "incoherent-return:success",
    launchId: "incoherent-return",
    missionId: "campaign:1-1",
    routeKind: "campaign",
    routeIdentity: { kind: "campaign", world: 1, level: 1 },
    terminalKind: "success",
    persistenceAuthority: "legacy",
    returnTarget: "legacy-cockpit",
    appliedRevision: 2,
    returnPending: true,
  } as const;

  const missingJournal = migrateSave({
    saveRevision: 2,
    outcomeRecoveryRecords: [applied],
  });
  const futureRevision = migrateSave({
    saveRevision: 1,
    appliedOutcomeIds: [applied.outcomeId],
    outcomeRecoveryRecords: [applied],
  });

  assert.equal(missingJournal.outcomeRecoveryRecords[0]?.kind, "reconciliation_required");
  assert.equal(futureRevision.outcomeRecoveryRecords[0]?.kind, "reconciliation_required");
});

test("hostile reconciliation protection cannot leave an oversized root journal", () => {
  const protectedOutcomeIds = Array.from({ length: 300 }, (_, index) => `locked:${index}`);
  const migrated = migrateSave({
    appliedOutcomeIds: protectedOutcomeIds,
    outcomeRecoveryRecords: [{
      version: 1,
      kind: "reconciliation_required",
      reason: "recovery_capacity_exceeded",
      protectedOutcomeIds,
    }],
  });

  assert.equal(migrated.appliedOutcomeIds.length, 256);
  const lock = migrated.outcomeRecoveryRecords[0];
  assert.equal(lock?.kind, "reconciliation_required");
  assert.equal(migrated.appliedOutcomeIds.includes("locked:0"), false);
  if (lock?.kind === "reconciliation_required") {
    assert.equal(lock.protectedOutcomeIds.includes("locked:0"), false);
    assert.equal(lock.protectedOutcomeIds.length, 256);
    assert.equal((lock as typeof lock & { quarantinedOutcomeCount: number }).quarantinedOutcomeCount, 44);
  }
});

test("generated reconciliation locks bound hundreds of invalid receipts and preparations", () => {
  const invalidReceipts = Array.from({ length: 300 }, (_, index) => ({
    version: 2,
    kind: "applied_return",
    outcomeId: `invalid-receipt:${index}:success`,
    launchId: `invalid-receipt:${index}`,
    missionId: "campaign:1-1",
    routeKind: "campaign",
    routeIdentity: { kind: "campaign", world: 1, level: 1 },
    terminalKind: "success",
    persistenceAuthority: "legacy",
    returnTarget: "legacy-cockpit",
    appliedRevision: 1,
    returnPending: true,
  }));
  const receiptSave = migrateSave({ saveRevision: 0, outcomeRecoveryRecords: invalidReceipts });
  const receiptLock = receiptSave.outcomeRecoveryRecords[0];
  assert.equal(receiptLock?.kind, "reconciliation_required");
  if (receiptLock?.kind === "reconciliation_required") {
    assert.equal(receiptLock.protectedOutcomeIds.length, 256);
    assert.equal(receiptLock.protectedOutcomeIds.includes("invalid-receipt:0:success"), false);
    assert.equal(receiptLock.quarantinedOutcomeCount, 44);
  }

  const template = preparedLegacyRecord(migrateSave({}), "invalid-prepared:template", 1);
  const invalidPrepared = Array.from({ length: 300 }, (_, index) => ({
    ...template,
    envelope: {
      ...template.envelope,
      launchId: `invalid-prepared:${index}`,
      outcomeId: `invalid-prepared:${index}:success`,
      payload: { version: 2, kind: "forged_preparation" },
    },
  }));
  const preparedSave = migrateSave({ outcomeRecoveryRecords: invalidPrepared });
  const preparedLock = preparedSave.outcomeRecoveryRecords[0];
  assert.equal(preparedLock?.kind, "reconciliation_required");
  if (preparedLock?.kind === "reconciliation_required") {
    assert.equal(preparedLock.protectedOutcomeIds.length, 256);
    assert.equal(preparedLock.protectedOutcomeIds.includes("invalid-prepared:0:success"), false);
    assert.equal(preparedLock.quarantinedOutcomeCount, 44);
  }

  const validPrepared = Array.from({ length: 300 }, (_, index) => ({
    ...template,
    envelope: {
      ...template.envelope,
      launchId: `valid-prepared:${index}`,
      outcomeId: `valid-prepared:${index}:success`,
    },
  }));
  const validPreparedSave = migrateSave({ outcomeRecoveryRecords: validPrepared });
  const capacityLock = validPreparedSave.outcomeRecoveryRecords[0];
  assert.equal(capacityLock?.kind, "reconciliation_required");
  if (capacityLock?.kind === "reconciliation_required") {
    assert.equal(capacityLock.reason, "recovery_capacity_exceeded");
    assert.equal(capacityLock.protectedOutcomeIds.length, 256);
    assert.equal(capacityLock.quarantinedOutcomeCount, 44);
    assert.equal(validPreparedSave.appliedOutcomeIds.length, 0);
  }
});

test("an invalid durable Legacy preparation migrates to a reconciliation lock", () => {
  const base = migrateSave({ missionsSinceStart: 1 });
  const valid = preparedLegacyRecord(base, "valid-prepared", 2);
  const invalid = {
    ...valid,
    envelope: { ...valid.envelope, payload: () => 1 },
  };

  const migrated = migrateSave({ outcomeRecoveryRecords: [valid, invalid] });

  assert.deepEqual(migrated.outcomeRecoveryRecords, [{
    version: 2,
    kind: "reconciliation_required",
    reason: "prepared_outcome_invalid",
    protectedOutcomeIds: [valid.envelope.outcomeId],
    quarantinedOutcomeCount: 0,
  }]);
});

test("recovery migration locks reconciliation instead of truncating unresolved authority", () => {
  const base = migrateSave({ missionsSinceStart: 1 });
  const unresolved = Array.from({ length: 33 }, (_, index) =>
    preparedLegacyRecord(base, `prepared-${index}`, index + 2));

  const migrated = migrateSave({ outcomeRecoveryRecords: unresolved });

  assert.equal(migrated.outcomeRecoveryRecords.length, 1);
  assert.deepEqual(migrated.outcomeRecoveryRecords[0], {
    version: 2,
    kind: "reconciliation_required",
    reason: "recovery_capacity_exceeded",
    protectedOutcomeIds: unresolved.map((record) => record.envelope.outcomeId),
    quarantinedOutcomeCount: 0,
  });
});

test("the outcome boundary exposes a serializable envelope, canonical store, and recovery API", async () => {
  const coordinator = await import("../../app/components/engine/missionOutcome") as Record<string, unknown>;

  assert.equal(typeof coordinator.commitOutcome, "function");
  assert.equal(typeof coordinator.createOutcomeAttempt, "function");
  assert.equal(typeof coordinator.createOutcomeEnvelope, "function");
  assert.equal(typeof coordinator.recoverOutcomeReturn, "function");
  assert.equal(typeof coordinator.acknowledgeOutcomeReturn, "function");
});

test("code-owned route folds derive campaign, planet, and special effects", () => {
  const legacy = migrateSave({ credits: 10 });
  const routes: Array<{
    name: string;
    save: SaveData;
    outcome: SerializedOutcomeEnvelope;
    inspect: (save: SaveData) => unknown;
    expected: unknown;
  }> = [
    {
      name: "campaign", save: legacy,
      outcome: campaignEnvelope(legacy, "campaign-attempt", "legacy-star-map", 100),
      inspect: (save) => save.levels["1-1"]?.completed, expected: true,
    },
    {
      name: "planet", save: legacy,
      outcome: envelope(
        attempt(legacy, "planet", "planet-attempt", "legacy", "legacy-cockpit", [...ROUTE_FOLD_FIELDS.planet]),
        { version: 1, kind: "planet_result_v1", bestiaryKills: [] },
      ),
      inspect: (save) => save.completedPlanets, expected: ["glaciem"],
    },
    {
      name: "special", save: legacy,
      outcome: envelope(
        attempt(legacy, "special", "special-attempt", "legacy", "legacy-cockpit", [...ROUTE_FOLD_FIELDS.special]),
        { version: 1, kind: "special_result_v1", score: 100, objectiveCollected: true, bestiaryKills: [] },
      ),
      inspect: (save) => save.storyItems, expected: ["kepler-black-box"],
    },
  ];

  for (const route of routes) {
    const memory = memoryStore(route.save);
    const result = commitOutcome(memory.store, route.outcome);
    assert.equal(result.status, "committed", route.name);
    if (result.status !== "committed") continue;
    assert.strictEqual(memory.current(), result.save, route.name);
    assert.deepEqual(route.inspect(result.save), route.expected, route.name);
    assert.equal(result.save.saveRevision, route.save.saveRevision + 1, route.name);
    assert.ok(result.save.appliedOutcomeIds.includes(route.outcome.outcomeId), route.name);
    assert.deepEqual(recoverOutcomeReturn(result.save), {
      version: 2,
      kind: "applied_return",
      outcomeId: route.outcome.outcomeId,
      launchId: route.outcome.launchId,
      missionId: route.outcome.missionId,
      routeKind: route.outcome.routeKind,
      routeIdentity: route.outcome.routeIdentity,
      terminalKind: route.outcome.terminalKind,
      persistenceAuthority: route.outcome.persistenceAuthority,
      returnTarget: route.outcome.returnTarget,
      appliedRevision: result.save.saveRevision,
      returnPending: true,
    }, route.name);
  }
});

test("every route class can journal an authorized no-op failure without invented dependencies", () => {
  const legacy = migrateSave({});
  const galaxy = beginGalaxyExperience(legacy);
  const routes: Array<[OutcomeRouteKind, SaveData, "legacy" | "galaxy", OutcomeAttempt["returnTarget"]]> = [
    ["campaign", legacy, "legacy", "legacy-star-map"],
    ["planet", legacy, "legacy", "legacy-cockpit"],
    ["special", legacy, "legacy", "legacy-cockpit"],
    ["colony", legacy, "legacy", "legacy-cockpit"],
    ["poi", legacy, "legacy", "legacy-colony-exterior"],
  ];

  for (const [routeKind, save, authority, returnTarget] of routes) {
    const terminal = envelope(
      attempt(save, routeKind, `${routeKind}-failure`, authority, returnTarget, []),
      { version: 1, kind: "terminal_noop_v1" },
      "failure",
    );
    const result = commitOutcome(memoryStore(save).store, terminal);
    assert.equal(result.status, "committed", routeKind);
    if (result.status === "committed") {
      assert.ok(result.save.appliedOutcomeIds.includes(terminal.outcomeId), routeKind);
      assert.deepEqual(recoverOutcomeReturn(result.save)?.returnTarget, returnTarget, routeKind);
    }
  }

  const invalidSuccess = envelope(
    attempt(legacy, "campaign", "empty-success", "legacy", "legacy-cockpit", []),
    { version: 1, kind: "terminal_noop_v1" },
  );
  assert.equal(commitOutcome(memoryStore(legacy).store, invalidSuccess).status, "conflict");
});

test("route registry retains real planet rewards and campaign Codex unlocks", () => {
  const planetLaunch = migrateSave({});
  const planetResult = completePlanet(planetLaunch, "glaciem");
  const planetOutcome = envelope(
    attempt(planetLaunch, "planet", "glaciem-success", "legacy", "legacy-cockpit", [...ROUTE_FOLD_FIELDS.planet]),
    { version: 1, kind: "planet_result_v1", bestiaryKills: [] },
  );
  const planetCommit = commitOutcome(memoryStore(planetLaunch).store, planetOutcome);
  assert.equal(planetCommit.status, "committed");
  if (planetCommit.status === "committed") {
    assert.deepEqual(planetCommit.save.materials, planetResult.materials);
    assert.deepEqual(planetCommit.save.unlockedEnhancements, planetResult.unlockedEnhancements);
  }

  const campaignLaunch = migrateSave({
    levels: { "1-1": { completed: true, stars: 1, highScore: 100 } },
    unlockedCodex: [],
  });
  const campaignResult = unlockCodexEntries(campaignLaunch);
  assert.notDeepEqual(campaignResult.unlockedCodex, campaignLaunch.unlockedCodex);
  const campaignOutcome = envelope(
    attempt(campaignLaunch, "campaign", "campaign-codex", "legacy", "legacy-cockpit", [...ROUTE_FOLD_FIELDS.campaign]),
    campaignCommand(150),
  );
  const campaignCommit = commitOutcome(memoryStore(campaignLaunch).store, campaignOutcome);
  assert.equal(campaignCommit.status, "committed");
  if (campaignCommit.status === "committed") {
    assert.deepEqual(campaignCommit.save.unlockedCodex, campaignResult.unlockedCodex);
  }
});

test("launch attempt capture snapshots declared fields once and rejects route mismatches", () => {
  const save = migrateSave({ credits: 10, levels: {} });
  const context = launchContextFromSave(
    save,
    campaignMissionDescriptor(1, 1),
    "legacy",
    "star-map",
    "legacy-star-map",
    () => "attempt-snapshot",
  );
  const captured = createOutcomeAttempt(save, context, "campaign");
  save.credits = 999;
  save.levels["1-1"] = { completed: true, stars: 3, highScore: 999 };

  assert.deepEqual(captured, {
    version: 1,
    routeKind: "campaign",
    missionId: "campaign:1-1",
    routeIdentity: { kind: "campaign", world: 1, level: 1 },
    launchId: "attempt-snapshot",
    expectedRevision: 0,
    persistenceAuthority: "legacy",
    returnTarget: "legacy-star-map",
    declaredFields: [...ROUTE_FOLD_FIELDS.campaign],
    launchSnapshot: captured.launchSnapshot,
  });
  assert.throws(() => createOutcomeAttempt(save, context, "operation"));
});

test("Colony route authority exactly mirrors the six A2 return pairs", () => {
  const legacy = migrateSave({});
  const galaxy = beginGalaxyExperience(legacy);
  const descriptor = colonyMissionDescriptor("authority-colony", "exterior");
  const valid = [
    [legacy, "legacy", "cockpit", "legacy-cockpit"],
    [legacy, "legacy", "landing-pad", "legacy-colony-exterior"],
    [legacy, "legacy", "landing-pad", "legacy-landing-pad"],
    [galaxy, "galaxy", "atlas", "galaxy-atlas"],
    [galaxy, "galaxy", "landing-pad", "galaxy-colony-exterior"],
    [galaxy, "galaxy", "landing-pad", "galaxy-landing-pad"],
  ] as const;
  for (const [save, authority, provenance, returnTarget] of valid) {
    const context = launchContextFromSave(
      save,
      descriptor,
      authority,
      provenance,
      returnTarget,
      () => `colony-authority:${returnTarget}`,
    );
    assert.doesNotThrow(() => createOutcomeAttempt(save, context, "colony"), returnTarget);
  }
  const forbiddenRegion = launchContextFromSave(
    galaxy,
    descriptor,
    "galaxy",
    "region",
    "galaxy-region",
    () => "colony-authority:forbidden-region",
  );
  assert.throws(() => createOutcomeAttempt(galaxy, forbiddenRegion, "colony"));
});

test("continuous campaign folds allow kill count beyond the encounter total", () => {
  const save = migrateSave({});
  const command = campaignCommand(250);
  const terminal = envelope(
    attempt(save, "campaign", "continuous-kills", "legacy", "legacy-cockpit", [...ROUTE_FOLD_FIELDS.campaign]),
    { ...command, killCount: 12, totalEnemies: 1 },
  );
  const committed = commitOutcome(memoryStore(save).store, terminal);
  assert.equal(committed.status, "committed");
  if (committed.status === "committed") {
    assert.equal(committed.save.levels["1-1"]?.stars, 3);
    assert.ok(committed.save.credits >= 500);
  }
});

test("unknown and hostile route identities conflict without throwing", () => {
  const save = migrateSave({});
  const terminal = campaignEnvelope(save, "unknown-identity");
  const unknown: SerializedOutcomeEnvelope = {
    ...terminal,
    routeIdentity: { kind: "campaign", world: 999, level: 999 },
  };
  assert.equal(routeIdentityMatchesMissionId(
    unknown.routeIdentity as OutcomeRouteIdentity,
    "campaign",
    unknown.missionId,
  ), false);
  assert.doesNotThrow(() => commitOutcome(memoryStore(save).store, unknown));
  assert.equal(commitOutcome(memoryStore(save).store, unknown).status, "conflict");

  let reads = 0;
  const accessorIdentity = { kind: "campaign", level: 1 } as Record<string, unknown>;
  Object.defineProperty(accessorIdentity, "world", {
    enumerable: true,
    get() { reads += 1; return 1; },
  });
  const accessorEnvelope = { ...terminal, routeIdentity: accessorIdentity as unknown as OutcomeRouteIdentity };
  assert.doesNotThrow(() => commitOutcome(memoryStore(save).store, accessorEnvelope));
  assert.equal(commitOutcome(memoryStore(save).store, accessorEnvelope).status, "conflict");
  assert.equal(reads, 0);

  const proxyEnvelope = {
    ...terminal,
    routeIdentity: new Proxy({}, { ownKeys() { throw new Error("hostile identity"); } }) as OutcomeRouteIdentity,
  };
  assert.doesNotThrow(() => commitOutcome(memoryStore(save).store, proxyEnvelope));
  assert.equal(commitOutcome(memoryStore(save).store, proxyEnvelope).status, "conflict");
});

test("the shared route identity codec rejects the same malformed bindings for runtime and migration", () => {
  const malformed: Array<[OutcomeRouteKind, string, unknown]> = [
    ["campaign", "campaign:1-1", { kind: "campaign", world: 999, level: 999 }],
    ["planet", "planet:glaciem", { kind: "planet", planetId: "" }],
    ["special", "special:kepler-black-box", { kind: "special", missionId: "unknown" }],
    ["operation", "operation:op:ashfall-sortie", { kind: "operation", operationId: "unknown" }],
    ["colony", "colony:4:home:exterior", { kind: "colony", colonyId: "", mode: "exterior", buildingId: null }],
    ["poi", "poi:20:fp-ruin-cinder-relay:20:ashfall-cinder-relay", {
      kind: "poi",
      originColonyId: "",
      nodeId: "ashfall-cinder-relay",
      engine: "firstPerson",
      templateId: "fp-ruin-cinder-relay",
      rewardEligible: true,
    }],
  ];
  for (const [routeKind, missionId, identity] of malformed) {
    assert.equal(snapshotOutcomeRouteIdentity(identity, routeKind, missionId), null, routeKind);
  }

  const forgedReceipt = {
    version: 2,
    kind: "applied_return",
    outcomeId: "forged-poi:success",
    launchId: "forged-poi",
    missionId: "poi:20:fp-ruin-cinder-relay:20:ashfall-cinder-relay",
    routeKind: "poi",
    routeIdentity: malformed.at(-1)![2],
    terminalKind: "success",
    persistenceAuthority: "legacy",
    returnTarget: "legacy-colony-exterior",
    appliedRevision: 1,
    returnPending: true,
  };
  const migrated = migrateSave({
    saveRevision: 1,
    appliedOutcomeIds: [forgedReceipt.outcomeId],
    outcomeRecoveryRecords: [forgedReceipt],
  });
  assert.equal(migrated.outcomeRecoveryRecords[0]?.kind, "reconciliation_required");
});

test("Legacy POI success requires and atomically consumes one matching staged preparation", () => {
  const launch = readyLegacyPoi(migrateSave({}));
  const poiAttempt = attempt(
    launch,
    "poi",
    "legacy-prepared",
    "legacy",
    "legacy-colony-exterior",
    [...LEGACY_POI_FIELDS],
  );
  const preparedEnvelope = envelope(poiAttempt, { version: 2, kind: "poi_prepared_v2" });
  const finalEnvelope = envelope(poiAttempt, {
    version: 2,
    kind: "poi_result_v2",
    destinationColonyId: "home",
  });
  assert.equal(commitOutcome(memoryStore(launch).store, finalEnvelope).status, "conflict");
  const staged = stageLegacyPreparedOutcome(launch, preparedEnvelope);
  assert.ok(staged);
  assert.strictEqual(stageLegacyPreparedOutcome(staged!, preparedEnvelope), staged);
  assert.equal(recoverLegacyPreparedOutcome(staged!)?.outcomeId, finalEnvelope.outcomeId);
  const secondAttempt = { ...poiAttempt, launchId: "legacy-prepared-second" };
  const secondPrepared = envelope(secondAttempt, { version: 2, kind: "poi_prepared_v2" });
  assert.equal(stageLegacyPreparedOutcome(staged!, secondPrepared), null);

  const memory = memoryStore(staged!);
  const committed = commitOutcome(memory.store, finalEnvelope);
  assert.equal(committed.status, "committed");
  if (committed.status !== "committed") return;
  assert.deepEqual(recoverOutcomeReturn(committed.save)?.routeIdentity, poiAttempt.routeIdentity);
  assert.equal(committed.save.outcomeRecoveryRecords.some((record) =>
    record.kind === "legacy_poi_prepared"), false);
  assert.equal(commitOutcome(memory.store, finalEnvelope).status, "already_applied");
});

test("v2 return receipts preserve exact Colony mount identity and old locator-free receipts lock", () => {
  const save = migrateSave({});
  const base = attempt(save, "colony", "colony-interior-return", "legacy", "legacy-landing-pad", []);
  const interiorAttempt: OutcomeAttempt = {
    ...base,
    missionId: "colony:4:home:interior:3:lab",
    routeIdentity: { kind: "colony", colonyId: "home", mode: "interior", buildingId: "lab" },
  };
  const terminal = envelope(interiorAttempt, { version: 1, kind: "terminal_noop_v1" });
  const committed = commitOutcome(memoryStore(save).store, terminal);
  assert.equal(committed.status, "committed");
  if (committed.status === "committed") {
    const recovered = recoverOutcomeReturn(committed.save);
    assert.equal(recovered?.routeKind, "colony");
    assert.deepEqual(recovered?.routeIdentity, interiorAttempt.routeIdentity);
  }

  const oldPoiReceipt = {
    version: 1,
    kind: "applied_return",
    outcomeId: "old-poi:success",
    launchId: "old-poi",
    terminalKind: "success",
    persistenceAuthority: "legacy",
    returnTarget: "legacy-colony-exterior",
    appliedRevision: 1,
    returnPending: true,
  };
  const migrated = migrateSave({
    saveRevision: 1,
    appliedOutcomeIds: [oldPoiReceipt.outcomeId],
    outcomeRecoveryRecords: [oldPoiReceipt],
  });
  assert.equal(migrated.outcomeRecoveryRecords[0]?.kind, "reconciliation_required");
});

test("operation success, failure, and retreat are code-owned Galaxy folds with exact nested ownership", () => {
  for (const resultKind of ["success", "failure", "retreat"] as const) {
    const save = atAshfall();
    const cycleBefore = save.galaxyRun!.worldCycle;
    const metalBefore = save.galaxyRun!.colonies.find(
      (colony) => colony.id === "galaxy:ashfall-primary",
    )!.resources.metal;
    const terminal = envelope(
      attempt(save, "operation", `operation-${resultKind}`, "galaxy", "galaxy-atlas", ["galaxyRun"]),
      { version: 1, kind: "operation_result_v1", result: resultKind, metrics: null },
      resultKind,
    );
    const memory = memoryStore(save);
    const committed = commitOutcome(memory.store, terminal);
    assert.equal(committed.status, "committed", resultKind);
    if (committed.status !== "committed" || committed.save.galaxyRun === null) continue;
    assert.equal(committed.save.galaxyRun.appliedOutcomeIds.filter((id) => id === terminal.outcomeId).length, 1);
    assert.equal(committed.save.galaxyRun.operations["op:ashfall-sortie"].completionIds.filter(
      (id) => id === terminal.outcomeId,
    ).length, 1);
    assert.equal(committed.save.galaxyRun.operations["op:ashfall-sortie"].state,
      resultKind === "success" ? "complete" : "failed");
    assert.equal(committed.save.galaxyRun.worldCycle, cycleBefore + 1);
    const metalAfter = committed.save.galaxyRun.colonies.find(
      (colony) => colony.id === "galaxy:ashfall-primary",
    )!.resources.metal;
    assert.equal(metalAfter, resultKind === "success" ? metalBefore + 80 : metalBefore);

    const rootOnly = structuredClone(committed.save);
    rootOnly.galaxyRun!.appliedOutcomeIds = rootOnly.galaxyRun!.appliedOutcomeIds.filter(
      (id) => id !== terminal.outcomeId,
    );
    assert.equal(commitOutcome(memoryStore(rootOnly).store, terminal).status, "conflict");
    const nestedOnly = structuredClone(committed.save);
    nestedOnly.appliedOutcomeIds = nestedOnly.appliedOutcomeIds.filter((id) => id !== terminal.outcomeId);
    nestedOnly.outcomeRecoveryRecords = [];
    assert.equal(commitOutcome(memoryStore(nestedOnly).store, terminal).status, "conflict");
    const missingOwner = structuredClone(committed.save);
    missingOwner.galaxyRun!.operations["op:ashfall-sortie"].completionIds = [];
    assert.equal(commitOutcome(memoryStore(missingOwner).store, terminal).status, "conflict");
  }
});

test("hostile Galaxy journals and operation records never become replay authority", () => {
  const save = atAshfall();
  const terminal = envelope(
    attempt(save, "operation", "hostile-nested-journal", "galaxy", "galaxy-atlas", ["galaxyRun"]),
    { version: 1, kind: "operation_result_v1", result: "success", metrics: null },
    "success",
  );
  const committed = commitOutcome(memoryStore(save).store, terminal);
  assert.equal(committed.status, "committed");
  if (committed.status !== "committed" || committed.save.galaxyRun === null) return;

  const variants: SaveData[] = [];
  const sparse = structuredClone(committed.save);
  delete sparse.galaxyRun!.appliedOutcomeIds[0];
  variants.push(sparse);
  const nonString = structuredClone(committed.save);
  (nonString.galaxyRun!.appliedOutcomeIds as unknown[])[0] = 7;
  variants.push(nonString);
  const duplicate = structuredClone(committed.save);
  duplicate.galaxyRun!.appliedOutcomeIds.push(terminal.outcomeId);
  variants.push(duplicate);
  const hostilePrototype = structuredClone(committed.save);
  Object.setPrototypeOf(hostilePrototype.galaxyRun!.appliedOutcomeIds, {});
  variants.push(hostilePrototype);
  const sparseRecord = structuredClone(committed.save);
  delete sparseRecord.galaxyRun!.operations["op:ashfall-sortie"].completionIds[0];
  variants.push(sparseRecord);
  const duplicateRecord = structuredClone(committed.save);
  duplicateRecord.galaxyRun!.operations["op:ashfall-sortie"].completionIds.push(terminal.outcomeId);
  variants.push(duplicateRecord);

  let accessorReads = 0;
  const accessor = structuredClone(committed.save);
  Object.defineProperty(accessor.galaxyRun!.appliedOutcomeIds, "0", {
    enumerable: true,
    configurable: true,
    get() { accessorReads += 1; return terminal.outcomeId; },
  });
  variants.push(accessor);

  for (const variant of variants) {
    assert.doesNotThrow(() => commitOutcome(memoryStore(variant).store, terminal));
    assert.equal(commitOutcome(memoryStore(variant).store, terminal).status, "conflict");
  }
  assert.equal(accessorReads, 0);
});

test("Galaxy POI shell staging writes only v2 authority and rebuilds the exact attempt after reload", () => {
  const begun = beginGalaxyExperience(migrateSave({}));
  assert.ok(begun.galaxyRun);
  const run = structuredClone(begun.galaxyRun!);
  run.planets = run.planets.map((planet) => ({
    ...planet,
    regionMap: {
      ...planet.regionMap,
      nodes: planet.regionMap.nodes.map((node) => node.id === "ashfall-cinder-relay"
        ? { ...node, intel: "surveyed" as const }
        : node),
    },
  }));
  const save = { ...begun, galaxyRun: run };
  const projection = projectGalaxyRunToLegacyState(run);
  const dispatched = dispatchPoi(projection, "galaxy:ashfall-primary", "ashfall-cinder-relay");
  assert.equal(dispatched.ok, true);
  if (!dispatched.ok) return;
  const routeIdentity: Extract<OutcomeRouteIdentity, { kind: "poi" }> = {
    kind: "poi",
    originColonyId: "galaxy:ashfall-primary",
    nodeId: "ashfall-cinder-relay",
    engine: "firstPerson",
    templateId: "fp-ruin-cinder-relay",
    rewardEligible: true,
  };
  const initialAttempt: OutcomeAttempt = {
    version: 1,
    routeKind: "poi",
    missionId: "poi:20:fp-ruin-cinder-relay:20:ashfall-cinder-relay",
    routeIdentity,
    launchId: "galaxy-shell-stage",
    expectedRevision: save.saveRevision,
    persistenceAuthority: "galaxy",
    returnTarget: "galaxy-region",
    declaredFields: ["galaxyRun"],
    launchSnapshot: { galaxyRun: structuredClone(run) },
  };
  const staged = stageGalaxyPoiOutcomeAuthority(
    save,
    { originColonyId: routeIdentity.originColonyId, session: dispatched.session },
    GameScreen.LEVEL_COMPLETE,
    initialAttempt,
  );
  assert.equal(staged.ok, true);
  if (!staged.ok) return;
  assert.equal(staged.save.saveRevision, save.saveRevision + 1);
  assert.equal(staged.save.galaxyRun?.worldCycle, save.galaxyRun?.worldCycle);
  const reloaded = migrateSave(JSON.parse(JSON.stringify(staged.save)));
  const recovered = recoverGalaxyPoiOutcomeAuthority(reloaded);
  assert.deepEqual(recovered, staged.attempt);
  assert.equal(recovered?.expectedRevision, reloaded.saveRevision);
  assert.deepEqual(recovered?.launchSnapshot, { galaxyRun: reloaded.galaxyRun });
});

test("Galaxy POI preparation binds the exact root outcome, consumes its fact, and journals both authorities", () => {
  const begun = beginGalaxyExperience(migrateSave({}));
  assert.ok(begun.galaxyRun);
  let run = structuredClone(begun.galaxyRun!);
  run.planets = run.planets.map((planet) => ({
    ...planet,
    regionMap: {
      ...planet.regionMap,
      nodes: planet.regionMap.nodes.map((node) => node.id === "ashfall-cinder-relay"
        ? { ...node, intel: "surveyed" as const }
        : node),
    },
  }));
  let projected = projectGalaxyRunToLegacyState(run);
  projected = {
    ...projected,
    planets: projected.planets.map((planet) => ({
      ...planet,
      regionMap: {
        ...planet.regionMap,
        nodes: planet.regionMap.nodes.map((node) => node.id === "ashfall-basalt-basin"
          ? { ...node, intel: "surveyed" as const, discovered: true }
          : node),
      },
    })),
  };
  projected = colonyReducer(projected, Events.founded({
    colonyId: "galaxy:destination",
    name: "Destination",
    planetId: "ashfall",
    foundingType: "outpost",
    regionNodeId: "ashfall-basalt-basin",
    missionCount: 0,
    layoutSeed: 2,
  }));
  const withDestination = mergeProjectionIntoGalaxy(run, {
    colonies: projected.colonies,
    planets: projected.planets,
  });
  assert.equal(withDestination.ok, true);
  if (!withDestination.ok) return;
  run = withDestination.galaxyRun;
  const identity: Extract<OutcomeRouteIdentity, { kind: "poi" }> = {
    kind: "poi",
    originColonyId: "galaxy:ashfall-primary",
    nodeId: "ashfall-cinder-relay",
    engine: "firstPerson",
    templateId: "fp-ruin-cinder-relay",
    rewardEligible: true,
  };
  const binding = { launchId: "galaxy-poi", outcomeId: "galaxy-poi:success", preparedRevision: 1 };
  const fact = createGalaxyPoiPreparedFact(run, {
    kind: "poi",
    templateId: identity.templateId,
    rewardEligible: identity.rewardEligible,
    nodeId: identity.nodeId,
    originColonyId: identity.originColonyId,
    engine: identity.engine,
  }, binding);
  assert.ok(fact);
  const canonicalFact = createGalaxyPoiPreparedFact(run, identity, binding);
  assert.equal(canonicalFact?.id, fact?.id);
  run.historyFacts.push(fact!);
  const staged = migrateSave(JSON.parse(JSON.stringify({ ...begun, saveRevision: 1, galaxyRun: run })));
  assert.ok(staged.galaxyRun);
  const stagedCycle = staged.galaxyRun.worldCycle;
  const recoveredPreparation = recoverGalaxyPoiPreparation(staged.galaxyRun);
  assert.equal(recoveredPreparation?.launchId, binding.launchId);
  assert.equal(recoveredPreparation?.outcomeId, binding.outcomeId);
  assert.equal(recoveredPreparation?.preparedRevision, binding.preparedRevision);
  assert.deepEqual(recoveredPreparation?.identity, {
    kind: "poi",
    originColonyId: identity.originColonyId,
    nodeId: identity.nodeId,
    templateId: identity.templateId,
    engine: identity.engine,
    rewardEligible: true,
  });
  const poiAttempt: OutcomeAttempt = {
    version: 1,
    routeKind: "poi",
    missionId: "poi:20:fp-ruin-cinder-relay:20:ashfall-cinder-relay",
    routeIdentity: identity,
    launchId: binding.launchId,
    expectedRevision: binding.preparedRevision,
    persistenceAuthority: "galaxy",
    returnTarget: "galaxy-region",
    declaredFields: ["galaxyRun"],
    launchSnapshot: { galaxyRun: structuredClone(staged.galaxyRun) },
  };
  const terminal = envelope(poiAttempt, {
    version: 2,
    kind: "poi_result_v2",
    destinationColonyId: "galaxy:destination",
  });
  const memory = memoryStore(staged);
  const committed = commitOutcome(memory.store, terminal);
  assert.equal(committed.status, "committed");
  if (committed.status !== "committed" || committed.save.galaxyRun === null) return;
  assert.equal(staged.galaxyRun.worldCycle, stagedCycle);
  assert.equal(committed.save.galaxyRun.worldCycle, stagedCycle + 1);
  assert.equal(recoverGalaxyPoiPreparation(committed.save.galaxyRun), null);
  assert.equal(committed.save.galaxyRun.historyFacts.some((entry) => entry.id === fact!.id), false);
  assert.equal(committed.save.appliedOutcomeIds.includes(terminal.outcomeId), true);
  assert.equal(committed.save.galaxyRun.appliedOutcomeIds.includes(terminal.outcomeId), true);
  assert.equal(committed.save.galaxyRun.colonies.find(
    (colony) => colony.id === "galaxy:destination",
  )?.resources.metal, 80);
  assert.equal(committed.save.galaxyRun.colonies.find(
    (colony) => colony.id === "galaxy:ashfall-primary",
  )?.resources.metal, 0);
  const replay = commitOutcome(memory.store, terminal);
  assert.equal(replay.status, "already_applied");
  if (replay.status === "already_applied") assert.equal(replay.save.galaxyRun?.worldCycle, stagedCycle + 1);

  const intervening = { ...staged, saveRevision: 2 };
  assert.equal(commitOutcome(memoryStore(intervening).store, terminal).status, "conflict");
  const wrongBinding = { ...terminal, launchId: "forged", outcomeId: "forged:success" };
  assert.equal(commitOutcome(memoryStore(staged).store, wrongBinding).status, "conflict");
});

test("duplicate callback and serialized UI-loss recovery never reapply a route fold", () => {
  const initial = migrateSave({ credits: 5 });
  const terminal = campaignEnvelope(initial, "duplicate-attempt");
  const memory = memoryStore(initial);
  const first = commitOutcome(memory.store, terminal);
  assert.equal(first.status, "committed");
  if (first.status !== "committed") return;

  const reloaded = migrateSave(JSON.parse(JSON.stringify(first.save)));
  const recovered = commitOutcome(memoryStore(reloaded).store, terminal);

  assert.equal(recovered.status, "already_applied");
  assert.equal(reloaded.credits, first.save.credits);
  assert.equal(reloaded.saveRevision, 1);
  assert.equal(recoverOutcomeReturn(reloaded)?.returnTarget, "legacy-cockpit");
});

test("write failure retries the same envelope and post-write throw rereads idempotently", () => {
  const initial = migrateSave({ credits: 5 });
  const terminal = campaignEnvelope(initial, "write-attempt");
  const before = memoryStore(initial);
  before.setWriteMode("before");
  const failed = commitOutcome(before.store, terminal);
  before.setWriteMode("ok");
  const retried = commitOutcome(before.store, terminal);

  assert.equal(failed.status, "write_failed");
  assert.equal(retried.status, "committed");
  assert.equal(terminal.outcomeId, "write-attempt:success");

  const after = memoryStore(initial);
  after.setWriteMode("after");
  const landed = commitOutcome(after.store, terminal);
  assert.equal(landed.status, "already_applied");
  assert.ok(after.current().credits > initial.credits);
  assert.equal(after.writes(), 1);
});

test("fresh-store two-writer handling rebases disjoint fields and conflicts on declared drift", () => {
  const launch = migrateSave({ credits: 10, viewedCodex: [], levels: {} });
  const terminal = campaignEnvelope(launch, "writer-one");
  const unrelated = { ...launch, saveRevision: 1, viewedCodex: ["enemy:scout"] };
  const memory = memoryStore(unrelated);
  memory.setCurrent(unrelated);
  const rebased = commitOutcome(memory.store, terminal);
  assert.equal(rebased.status, "committed");
  if (rebased.status === "committed") {
    assert.deepEqual(rebased.save.viewedCodex, ["enemy:scout"]);
    assert.equal(rebased.save.saveRevision, 2);
  }
  memory.setCurrent({ ...unrelated, credits: unrelated.credits + 1 });
  assert.equal(commitOutcome(memory.store, terminal).status, "conflict");
});

test("unrelated future root accessors remain opaque through a canonical commit", () => {
  const launch = migrateSave({});
  const terminal = campaignEnvelope(launch, "opaque-future-root");
  let reads = 0;
  Object.defineProperty(launch, "futureRoot", {
    enumerable: true,
    configurable: true,
    get() { reads += 1; throw new Error("future root executed"); },
  });
  const committed = commitOutcome(memoryStore(launch).store, terminal);
  assert.equal(committed.status, "committed");
  assert.equal(reads, 0);
  if (committed.status === "committed") {
    const descriptor = Object.getOwnPropertyDescriptor(committed.save, "futureRoot");
    assert.equal(typeof descriptor?.get, "function");
  }
});

test("two-tab terminal outcomes cannot cross the canonical experience namespace", () => {
  const legacy = migrateSave({});
  const galaxy = beginGalaxyExperience(legacy);
  assert.ok(galaxy.galaxyRun);
  const legacyFailure = envelope(
    attempt(legacy, "campaign", "legacy-experience-tab", "legacy", "legacy-cockpit", []),
    { version: 1, kind: "terminal_noop_v1" },
    "failure",
  );
  const galaxyFailure = envelope(
    attempt(galaxy, "operation", "galaxy-experience-tab", "galaxy", "galaxy-atlas", []),
    { version: 1, kind: "operation_result_v1", result: "failure", metrics: null },
    "failure",
  );

  assert.equal(commitOutcome(memoryStore(galaxy).store, legacyFailure).status, "conflict");
  assert.equal(commitOutcome(memoryStore({ ...galaxy, activeExperience: "legacy" }).store, galaxyFailure).status, "conflict");
  assert.equal(commitOutcome(memoryStore({ ...galaxy, galaxyRun: null }).store, galaxyFailure).status, "conflict");
});

test("serializable envelopes reject undeclared patches, malformed domains, and authority crossings", () => {
  const legacy = migrateSave({ credits: 10, xp: 2 });
  const begun = beginGalaxyExperience(legacy);
  const valid = campaignEnvelope(legacy, "valid-attempt");
  const malformed: SerializedOutcomeEnvelope[] = [
    { ...valid, declaredFields: [] },
    { ...valid, declaredFields: ["credits", "credits"] },
    { ...valid, outcomeId: "forged:success" },
    { ...valid, terminalKind: "timeout" as SerializedOutcomeEnvelope["terminalKind"], outcomeId: "valid-attempt:timeout" },
    { ...valid, returnTarget: "galaxy-atlas" },
    { ...valid, routeIdentity: { kind: "campaign", world: 999, level: 999 } },
    { ...valid, payload: { version: 1, kind: "special_result_v1", fields: { credits: 11 } } },
    { ...valid, payload: { version: 1, kind: "campaign_result_v1", fields: { credits: 11 } } },
  ];

  for (const terminal of malformed) {
    assert.equal(commitOutcome(memoryStore(terminal.persistenceAuthority === "galaxy" ? begun : legacy).store, terminal).status, "conflict");
  }
});

test("allowlisted serialized final values are not outcome authority", () => {
  const save = migrateSave({ credits: 10 });
  const forgedPatch = { ...campaignEnvelope(save, "forged-final-fields"), payload: { credits: 999_999 } };

  assert.equal(commitOutcome(memoryStore(save).store, forgedPatch).status, "conflict");
});

test("journal pruning protects validated recovery records and fails closed on recovery overflow", () => {
  const appliedOutcomeIds = ["old:success", ...Array.from({ length: 255 }, (_, index) => `old:${index + 1}`)];
  const protectedRecord: OutcomeRecoveryRecord = {
    version: 2,
    kind: "applied_return",
    outcomeId: "old:success",
    launchId: "old",
    missionId: "campaign:1-1",
    routeKind: "campaign",
    routeIdentity: { kind: "campaign", world: 1, level: 1 },
    terminalKind: "success",
    persistenceAuthority: "legacy",
    returnTarget: "legacy-cockpit",
    appliedRevision: 1,
    returnPending: true,
  };
  const launch = migrateSave({ saveRevision: 1, appliedOutcomeIds, outcomeRecoveryRecords: [protectedRecord] });
  const terminal = campaignEnvelope(launch, "new-attempt");
  const committed = commitOutcome(memoryStore(launch).store, terminal);
  assert.equal(committed.status, "committed");
  if (committed.status === "committed") {
    assert.equal(committed.save.appliedOutcomeIds.length, 256);
    assert.ok(committed.save.appliedOutcomeIds.includes("old:success"));
    assert.ok(committed.save.appliedOutcomeIds.includes(terminal.outcomeId));
    assert.ok(!committed.save.appliedOutcomeIds.includes("old:1"));
  }

  const overflow = {
    ...launch,
    outcomeRecoveryRecords: Array.from({ length: 33 }, (_, index) => ({
      ...protectedRecord,
      outcomeId: `overflow:${index}:success`,
      launchId: `overflow:${index}`,
    })),
  };
  assert.equal(commitOutcome(memoryStore(overflow).store, terminal).status, "conflict");

  const oversizedRoot = {
    ...launch,
    appliedOutcomeIds: Array.from({ length: 257 }, (_, index) => `oversized:${index}`),
  };
  assert.equal(commitOutcome(memoryStore(oversizedRoot).store, terminal).status, "conflict");
});

test("reload return acknowledgement is a fresh canonical write", () => {
  const initial = migrateSave({ credits: 1 });
  const terminal = campaignEnvelope(initial, "return-attempt", "legacy-star-map");
  const firstMemory = memoryStore(initial);
  const committed = commitOutcome(firstMemory.store, terminal);
  assert.equal(committed.status, "committed");
  if (committed.status !== "committed") return;
  const reloaded = migrateSave(JSON.parse(JSON.stringify(committed.save)));
  const memory = memoryStore(reloaded);

  const acknowledged = acknowledgeOutcomeReturn(memory.store, terminal.outcomeId);

  assert.equal(acknowledged.status, "committed");
  if (acknowledged.status !== "committed") return;
  assert.equal(acknowledged.save.saveRevision, reloaded.saveRevision + 1);
  assert.equal(recoverOutcomeReturn(acknowledged.save), null);
  const receipt = recoveryRecords(acknowledged.save).find((record) =>
    record.kind === "applied_return" && record.outcomeId === terminal.outcomeId);
  assert.ok(receipt?.kind === "applied_return");
  assert.equal(receipt.returnPending, false);

  const preWrite = memoryStore(reloaded);
  preWrite.setWriteMode("before");
  assert.equal(acknowledgeOutcomeReturn(preWrite.store, terminal.outcomeId).status, "write_failed");
  assert.equal(recoverOutcomeReturn(preWrite.current())?.outcomeId, terminal.outcomeId);

  const postWrite = memoryStore(reloaded);
  postWrite.setWriteMode("after");
  assert.equal(acknowledgeOutcomeReturn(postWrite.store, terminal.outcomeId).status, "already_applied");
  assert.equal(recoverOutcomeReturn(postWrite.current()), null);
});

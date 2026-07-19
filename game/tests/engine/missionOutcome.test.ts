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
  snapshotOutcomeRootAuthority,
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
  poiMissionDescriptor,
  poiOutcomeMissionId,
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
  isGalaxyPoiPreparedAuthorityFact,
  recoverGalaxyPoiPreparation,
  resolveGalaxyPoiOutcomeFromRun,
} from "../../app/components/engine/galaxy/galaxyPoiOutcomeAuthority";
import {
  mergeProjectionIntoGalaxy,
  projectGalaxyRunToLegacyState,
} from "../../app/components/engine/galaxy/galaxyProjection";
import { authorizeOperationLaunch } from "../../app/components/engine/operations/operationCatalog";
import {
  applyOperationOutcomeToRun,
  normalizeOperationOutcome,
} from "../../app/components/engine/operations/operationOutcome";

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
              : poiOutcomeMissionId(
                  "poi:20:fp-ruin-cinder-relay:20:ashfall-cinder-relay",
                  "home",
                ),
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

function postWriteThrowStore(initial: SaveData, transform: (candidate: SaveData) => SaveData): CanonicalSaveStore {
  let current = initial;
  return {
    read: () => current,
    write: (candidate) => {
      current = transform(candidate);
      throw new Error("post-write probe");
    },
  };
}

type HostileArrayMode = "static" | "delayed" | "revoked";

function hostileArray<T>(entries: readonly T[], mode: HostileArrayMode): T[] {
  const target = [...entries];
  if (mode === "revoked") {
    const revocable = Proxy.revocable(target, {});
    revocable.revoke();
    return revocable.proxy;
  }
  let armed = mode === "static";
  return new Proxy(target, {
    ownKeys(inner) {
      if (mode === "delayed") armed = true;
      return Reflect.ownKeys(inner);
    },
    get(inner, property, receiver) {
      if (armed) throw new Error(`${mode} hostile indexed read: ${String(property)}`);
      return Reflect.get(inner, property, receiver);
    },
  });
}

function totalCall<T>(label: string, call: () => T): T {
  let value!: T;
  assert.doesNotThrow(() => { value = call(); }, label);
  return value;
}

function hostileMigrationContainer(mode: HostileArrayMode): unknown[] {
  const target: unknown[] = ["opaque-authority"];
  if (mode === "revoked") {
    const revocable = Proxy.revocable(target, {});
    revocable.revoke();
    return revocable.proxy;
  }
  let armed = mode === "static";
  return new Proxy(target, {
    ownKeys(inner) {
      if (armed) throw new Error(`${mode} hostile authority enumeration`);
      armed = true;
      return Reflect.ownKeys(inner);
    },
    getOwnPropertyDescriptor(inner, property) {
      if (armed) throw new Error(`${mode} hostile authority descriptor: ${String(property)}`);
      return Reflect.getOwnPropertyDescriptor(inner, property);
    },
  });
}

function readyGalaxyPoi(): SaveData {
  const save = atAshfall();
  const run = structuredClone(save.galaxyRun!);
  run.planets = run.planets.map((planet) => ({
    ...planet,
    regionMap: {
      ...planet.regionMap,
      nodes: planet.regionMap.nodes.map((node) => node.id === "ashfall-cinder-relay"
        ? { ...node, intel: "surveyed" as const }
        : node),
    },
  }));
  return { ...save, galaxyRun: run };
}

function galaxyStageFixture(launchId = "galaxy-stage-fixture") {
  const save = readyGalaxyPoi();
  const projection = projectGalaxyRunToLegacyState(save.galaxyRun!);
  const dispatched = dispatchPoi(projection, "galaxy:ashfall-primary", "ashfall-cinder-relay");
  if (!dispatched.ok) throw new Error("Galaxy POI fixture dispatch failed");
  const routeIdentity = {
    kind: "poi" as const,
    originColonyId: "galaxy:ashfall-primary",
    nodeId: "ashfall-cinder-relay",
    engine: "firstPerson" as const,
    templateId: "fp-ruin-cinder-relay",
    rewardEligible: true,
  };
  const attempt: OutcomeAttempt = {
    version: 1,
    routeKind: "poi",
    missionId: poiOutcomeMissionId(
      "poi:20:fp-ruin-cinder-relay:20:ashfall-cinder-relay",
      routeIdentity.originColonyId,
    ),
    routeIdentity,
    launchId,
    expectedRevision: save.saveRevision,
    persistenceAuthority: "galaxy",
    returnTarget: "galaxy-region",
    declaredFields: ["galaxyRun"],
    launchSnapshot: { galaxyRun: structuredClone(save.galaxyRun) },
  };
  return {
    save,
    active: { originColonyId: routeIdentity.originColonyId, session: dispatched.session },
    attempt,
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

test("migration locks partially present A3 authority instead of defaulting missing fields", () => {
  const variants: Array<[string, Record<string, unknown>]> = [
    ["revision only", { saveRevision: 1 }],
    ["revision and journal", { saveRevision: 1, appliedOutcomeIds: [] }],
    ["journals without revision", { appliedOutcomeIds: [], outcomeRecoveryRecords: [] }],
  ];

  for (const [label, raw] of variants) {
    const migrated = migrateSave(raw);
    assert.equal(migrated.outcomeRecoveryRecords[0]?.kind, "reconciliation_required", label);
    assert.equal(snapshotOutcomeRootAuthority(migrated)?.locked, true, label);
    assert.deepEqual(migrateSave(JSON.parse(JSON.stringify(migrated))), migrated, `${label} idempotence`);
  }
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

test("pre-A3 Galaxy operation ownership migrates into coherent root authority", () => {
  const begun = beginGalaxyExperience(migrateSave({}));
  assert.ok(begun.galaxyRun);
  const outcomeId = "pre-a3-operation:success";
  const raw = structuredClone(begun) as unknown as Record<string, unknown>;
  delete raw.saveRevision;
  delete raw.appliedOutcomeIds;
  delete raw.outcomeRecoveryRecords;
  const run = raw.galaxyRun as NonNullable<SaveData["galaxyRun"]>;
  run.appliedOutcomeIds = [outcomeId];
  run.operations["op:ashfall-sortie"].completionIds = [outcomeId];

  const migrated = migrateSave(raw);

  assert.deepEqual(migrated.appliedOutcomeIds, [outcomeId]);
  assert.deepEqual(migrated.galaxyRun?.appliedOutcomeIds, [outcomeId]);
  assert.deepEqual(migrated.outcomeRecoveryRecords, []);
  assert.ok(snapshotOutcomeRootAuthority(migrated));
});

test("migration locks raw duplicate or malformed outcome ownership before normalization", () => {
  const begun = beginGalaxyExperience(migrateSave({}));
  assert.ok(begun.galaxyRun);
  const outcomeId = "raw-owned:success";
  const canonical = structuredClone({
    ...begun,
    saveRevision: 1,
    appliedOutcomeIds: [outcomeId],
    outcomeRecoveryRecords: [],
    galaxyRun: {
      ...begun.galaxyRun!,
      appliedOutcomeIds: [outcomeId],
      operations: {
        ...begun.galaxyRun!.operations,
        "op:ashfall-sortie": {
          ...begun.galaxyRun!.operations["op:ashfall-sortie"],
          completionIds: [outcomeId],
        },
      },
    },
  });
  const variants: Array<[string, Record<string, unknown>]> = [
    ["duplicate root", { ...canonical, appliedOutcomeIds: [outcomeId, outcomeId] }],
    ["duplicate nested", {
      ...canonical,
      galaxyRun: { ...canonical.galaxyRun!, appliedOutcomeIds: [outcomeId, outcomeId] },
    }],
    ["duplicate owner", {
      ...canonical,
      galaxyRun: {
        ...canonical.galaxyRun!,
        operations: {
          ...canonical.galaxyRun!.operations,
          "op:ashfall-sortie": {
            ...canonical.galaxyRun!.operations["op:ashfall-sortie"],
            completionIds: [outcomeId, outcomeId],
          },
        },
      },
    }],
    ["malformed owner", {
      ...canonical,
      galaxyRun: {
        ...canonical.galaxyRun!,
        operations: {
          ...canonical.galaxyRun!.operations,
          "op:ashfall-sortie": {
            ...canonical.galaxyRun!.operations["op:ashfall-sortie"],
            completionIds: [outcomeId, null],
          },
        },
      },
    }],
  ];
  for (const [label, raw] of variants) {
    assert.equal(migrateSave(raw).outcomeRecoveryRecords[0]?.kind, "reconciliation_required", label);
  }
});

test("malformed reconciliation records remain locked with recoverable evidence", () => {
  const migrated = migrateSave({
    outcomeRecoveryRecords: [{
      version: 2,
      kind: "reconciliation_required",
      reason: "outcome_authority_invalid",
      protectedOutcomeIds: ["locked:outcome", null],
      quarantinedOutcomeCount: 7,
    }],
  });
  const lock = migrated.outcomeRecoveryRecords[0];
  assert.equal(lock?.kind, "reconciliation_required");
  if (lock?.kind !== "reconciliation_required") return;
  assert.ok(lock.protectedOutcomeIds.includes("locked:outcome"));
  assert.ok(lock.quarantinedOutcomeCount >= 7);
  assert.equal(snapshotOutcomeRootAuthority(migrated)?.locked, true);
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
  const nonPlain = Object.assign(new Date(0), applied);
  const revoked = Proxy.revocable({ ...applied }, {});
  revoked.revoke();
  const invalidAcknowledged = { ...applied, appliedRevision: -1, returnPending: false };

  const accepted = migrateSave({
    ...prepared.envelope.launchSnapshot,
    saveRevision: 2,
    appliedOutcomeIds: [applied.outcomeId],
    outcomeRecoveryRecords: [applied, prepared],
  });

  assert.deepEqual(accepted.outcomeRecoveryRecords, [applied, prepared]);
  const hostile: ReadonlyArray<readonly [string, unknown, boolean]> = [
    ["accessor", accessor, true],
    ["inherited", inherited, false],
    ["non-plain", nonPlain, true],
    ["opaque", 17, false],
    ["revoked", revoked.proxy, false],
    ["unknown plain record", { kind: "future_recovery", outcomeId: applied.outcomeId }, true],
    ["invalid acknowledged applied return", invalidAcknowledged, true],
  ];
  for (const [label, entry, salvagesOutcomeId] of hostile) {
    const migrated = totalCall(label, () => migrateSave({
      ...prepared.envelope.launchSnapshot,
      saveRevision: 2,
      appliedOutcomeIds: [applied.outcomeId],
      outcomeRecoveryRecords: [entry],
    }));
    const lock = migrated.outcomeRecoveryRecords[0];
    assert.equal(lock?.kind, "reconciliation_required", label);
    if (lock?.kind !== "reconciliation_required") continue;
    assert.equal(lock.version, 2, label);
    assert.equal(lock.reason, "outcome_authority_invalid", label);
    assert.equal(lock.protectedOutcomeIds.includes(applied.outcomeId), salvagesOutcomeId, label);
    assert.ok(lock.quarantinedOutcomeCount >= (salvagesOutcomeId ? 0 : 1), label);
  }
  assert.equal(accessorReads, 0);
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

test("migration locks when valid protected outcome authority exceeds root journal capacity", () => {
  const begun = beginGalaxyExperience(migrateSave({ credits: 731, introSeen: true }));
  assert.ok(begun.galaxyRun);
  const pendingOutcomeId = "protected-capacity-legacy:success";
  const galaxyOutcomeIds = Array.from({ length: 256 }, (_, index) => `protected-capacity-galaxy:${index}`);
  const pendingReturn: OutcomeRecoveryRecord = {
    version: 2,
    kind: "applied_return",
    outcomeId: pendingOutcomeId,
    launchId: "protected-capacity-legacy",
    missionId: "campaign:1-1",
    routeKind: "campaign",
    routeIdentity: { kind: "campaign", world: 1, level: 1 },
    terminalKind: "success",
    persistenceAuthority: "legacy",
    returnTarget: "legacy-cockpit",
    appliedRevision: begun.saveRevision,
    returnPending: true,
  };
  const raw: SaveData = {
    ...begun,
    appliedOutcomeIds: [pendingOutcomeId, ...galaxyOutcomeIds],
    outcomeRecoveryRecords: [pendingReturn],
    galaxyRun: {
      ...begun.galaxyRun!,
      appliedOutcomeIds: [...galaxyOutcomeIds],
    },
  };

  const migrated = migrateSave(JSON.parse(JSON.stringify(raw)));

  assert.deepEqual(migrated.appliedOutcomeIds, galaxyOutcomeIds);
  assert.deepEqual(migrated.galaxyRun?.appliedOutcomeIds, galaxyOutcomeIds);
  assert.equal(migrated.credits, 731);
  assert.equal(migrated.introSeen, true);
  const lock = migrated.outcomeRecoveryRecords[0];
  assert.equal(lock?.kind, "reconciliation_required");
  if (lock?.kind !== "reconciliation_required") return;
  assert.equal(lock.version, 2);
  assert.equal(lock.reason, "recovery_capacity_exceeded");
  assert.equal(lock.protectedOutcomeIds.length, 256);
  assert.equal(lock.quarantinedOutcomeCount, 1);
  const authority = snapshotOutcomeRootAuthority(migrated);
  assert.ok(authority);
  assert.equal(authority?.locked, true);
  assert.deepEqual(migrateSave(JSON.parse(JSON.stringify(migrated))), migrated);
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
  assert.deepEqual(migrateSave(JSON.parse(JSON.stringify(preparedSave))), preparedSave);

  const validPrepared = Array.from({ length: 300 }, (_, index) => ({
    ...template,
    envelope: {
      ...template.envelope,
      launchId: `valid-prepared:${index}`,
      outcomeId: `valid-prepared:${index}:success`,
    },
  }));
  const validPreparedSave = migrateSave({
    ...template.envelope.launchSnapshot,
    outcomeRecoveryRecords: validPrepared,
  });
  const capacityLock = validPreparedSave.outcomeRecoveryRecords[0];
  assert.equal(capacityLock?.kind, "reconciliation_required");
  if (capacityLock?.kind === "reconciliation_required") {
    assert.equal(capacityLock.reason, "recovery_capacity_exceeded");
    assert.equal(capacityLock.protectedOutcomeIds.length, 256);
    assert.equal(capacityLock.quarantinedOutcomeCount, 44);
    assert.equal(validPreparedSave.appliedOutcomeIds.length, 0);
  }
  assert.deepEqual(migrateSave(JSON.parse(JSON.stringify(validPreparedSave))), validPreparedSave);
});

test("reconciliation quarantine arithmetic saturates at the safe-integer boundary", () => {
  const protectedOutcomeIds = Array.from({ length: 300 }, (_, index) => `saturated:${index}`);
  const migrated = migrateSave({
    appliedOutcomeIds: protectedOutcomeIds,
    outcomeRecoveryRecords: [{
      version: 2,
      kind: "reconciliation_required",
      reason: "outcome_authority_invalid",
      protectedOutcomeIds,
      quarantinedOutcomeCount: Number.MAX_SAFE_INTEGER - 10,
    }],
  });
  const lock = migrated.outcomeRecoveryRecords[0];
  assert.equal(lock?.kind, "reconciliation_required");
  if (lock?.kind !== "reconciliation_required") return;
  assert.equal(lock.protectedOutcomeIds.length, 256);
  assert.equal(lock.quarantinedOutcomeCount, Number.MAX_SAFE_INTEGER);
  assert.ok(Number.isSafeInteger(lock.quarantinedOutcomeCount));
  assert.deepEqual(migrateSave(JSON.parse(JSON.stringify(migrated))), migrated);

  const summed = migrateSave({
    outcomeRecoveryRecords: [{
      version: 2,
      kind: "reconciliation_required",
      reason: "outcome_authority_invalid",
      protectedOutcomeIds: ["summed:first"],
      quarantinedOutcomeCount: Number.MAX_SAFE_INTEGER - 5,
    }, {
      version: 2,
      kind: "reconciliation_required",
      reason: "prepared_outcome_invalid",
      protectedOutcomeIds: ["summed:second"],
      quarantinedOutcomeCount: 10,
    }],
  });
  const summedLock = summed.outcomeRecoveryRecords[0];
  assert.equal(summedLock?.kind, "reconciliation_required");
  if (summedLock?.kind !== "reconciliation_required") return;
  assert.equal(summedLock.quarantinedOutcomeCount, Number.MAX_SAFE_INTEGER);
  assert.deepEqual(summedLock.protectedOutcomeIds, ["summed:first", "summed:second"]);
  assert.deepEqual(migrateSave(JSON.parse(JSON.stringify(summed))), summed);
});

test("an invalid durable Legacy preparation migrates to a reconciliation lock", () => {
  const base = migrateSave({ missionsSinceStart: 1 });
  const valid = preparedLegacyRecord(base, "valid-prepared", 2);
  const invalid = {
    ...valid,
    envelope: { ...valid.envelope, payload: () => 1 },
  };

  const migrated = migrateSave({
    ...valid.envelope.launchSnapshot,
    outcomeRecoveryRecords: [valid, invalid],
  });

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
    preparedLegacyRecord(base, `prepared-${index}`, 2));

  const migrated = migrateSave({
    ...unresolved[0].envelope.launchSnapshot,
    outcomeRecoveryRecords: unresolved,
  });

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
  const dynamicLegacy = readyLegacyPoi(legacy);
  const galaxy = beginGalaxyExperience(legacy);
  const routes: Array<[OutcomeRouteKind, SaveData, "legacy" | "galaxy", OutcomeAttempt["returnTarget"]]> = [
    ["campaign", legacy, "legacy", "legacy-star-map"],
    ["planet", legacy, "legacy", "legacy-cockpit"],
    ["special", legacy, "legacy", "legacy-cockpit"],
    ["colony", dynamicLegacy, "legacy", "legacy-cockpit"],
    ["poi", dynamicLegacy, "legacy", "legacy-colony-exterior"],
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
    missionId: poiOutcomeMissionId("poi:20:fp-ruin-cinder-relay:20:ashfall-cinder-relay", "home"),
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
  const reloadedCommitted = migrateSave(JSON.parse(JSON.stringify(committed.save)));
  assert.equal(reloadedCommitted.outcomeRecoveryRecords[0]?.kind, "applied_return");
  assert.deepEqual(recoverOutcomeReturn(reloadedCommitted)?.routeIdentity, poiAttempt.routeIdentity);
  assert.equal(commitOutcome(memory.store, finalEnvelope).status, "already_applied");
});

test("v2 return receipts preserve exact Colony mount identity and old locator-free receipts lock", () => {
  const founded = readyLegacyPoi(migrateSave({}));
  const save: SaveData = {
    ...founded,
    colonies: founded.colonies.map((colony) => colony.id === "home" ? {
      ...colony,
      buildings: [...colony.buildings, {
        id: "lab",
        type: "med_bay" as const,
        tier: 1 as const,
        status: "operational" as const,
        buildProgressCycles: 0,
        hp: 100,
        maxHp: 100,
        interiorTemplateId: null,
        assignedNpcIds: [],
        districtId: null,
      }],
    } : colony),
  };
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

test("Galaxy operation outcomes commit at full coherent journal capacity", () => {
  const base = atAshfall();
  assert.ok(base.galaxyRun);
  const protectedOutcomeId = "capacity-protected:success";
  const prunedOutcomeId = "capacity-pruned:success";
  const fillerIds = [
    protectedOutcomeId,
    prunedOutcomeId,
    ...Array.from({ length: 254 }, (_, index) => `capacity-operation:${index}`),
  ];
  const protectedReceipt: OutcomeRecoveryRecord = {
    version: 2,
    kind: "applied_return",
    outcomeId: protectedOutcomeId,
    launchId: "capacity-protected",
    missionId: "operation:op:hostile-picket",
    routeKind: "operation",
    routeIdentity: { kind: "operation", operationId: "op:hostile-picket" },
    terminalKind: "success",
    persistenceAuthority: "galaxy",
    returnTarget: "galaxy-atlas",
    appliedRevision: base.saveRevision,
    returnPending: true,
  };
  const run = structuredClone(base.galaxyRun!);
  run.appliedOutcomeIds = [...fillerIds];
  run.operations["op:hostile-picket"].completionIds = [protectedOutcomeId, prunedOutcomeId];
  const save: SaveData = {
    ...base,
    appliedOutcomeIds: [...fillerIds],
    outcomeRecoveryRecords: [protectedReceipt],
    galaxyRun: run,
  };
  assert.ok(snapshotOutcomeRootAuthority(save));
  const terminal = envelope(
    attempt(save, "operation", "capacity-operation-new", "galaxy", "galaxy-atlas", ["galaxyRun"]),
    { version: 1, kind: "operation_result_v1", result: "failure", metrics: null },
    "failure",
  );

  const committed = commitOutcome(memoryStore(save).store, terminal);

  assert.equal(committed.status, "committed");
  if (committed.status !== "committed" || committed.save.galaxyRun === null) return;
  assert.equal(committed.save.appliedOutcomeIds.length, 256);
  assert.equal(committed.save.galaxyRun.appliedOutcomeIds.length, 256);
  assert.ok(committed.save.appliedOutcomeIds.includes(protectedOutcomeId));
  assert.ok(committed.save.galaxyRun.appliedOutcomeIds.includes(protectedOutcomeId));
  assert.ok(!committed.save.appliedOutcomeIds.includes(prunedOutcomeId));
  assert.ok(!committed.save.galaxyRun.appliedOutcomeIds.includes(prunedOutcomeId));
  assert.ok(committed.save.appliedOutcomeIds.includes(terminal.outcomeId));
  assert.ok(committed.save.galaxyRun.appliedOutcomeIds.includes(terminal.outcomeId));
  assert.deepEqual(committed.save.galaxyRun.operations["op:hostile-picket"].completionIds, [protectedOutcomeId]);
  assert.deepEqual(committed.save.galaxyRun.operations["op:ashfall-sortie"].completionIds, [terminal.outcomeId]);
});

test("Legacy outcomes prune retained Galaxy authority coherently at full root capacity", () => {
  const begun = beginGalaxyExperience(migrateSave({}));
  assert.ok(begun.galaxyRun);
  let run = begun.galaxyRun!;
  const applyContactOperation = (
    contactId: "contact:kepler" | "contact:ashfall",
    operationId: "op:kepler-black-box" | "op:ashfall-sortie",
    completionId: string,
  ) => {
    const preview = planRoute(run, { kind: "contact", contactId });
    assert.equal(preview.ok, true);
    if (!preview.ok) throw new Error(`Route unavailable: ${contactId}`);
    const committedTravel = commitTravel(run, preview.plan);
    assert.equal(committedTravel.ok, true);
    if (!committedTravel.ok) throw new Error(`Travel commit failed: ${contactId}`);
    const resumed = resumeTravelToBoundary(committedTravel.galaxyRun);
    assert.equal(resumed.ok, true);
    if (!resumed.ok) throw new Error(`Travel resume failed: ${contactId}`);
    const finalized = finalizeTravel(resumed.galaxyRun);
    assert.equal(finalized.ok, true);
    if (!finalized.ok) throw new Error(`Travel finalization failed: ${contactId}`);
    const authorization = authorizeOperationLaunch(finalized.galaxyRun, operationId);
    assert.equal(authorization.ok, true);
    if (!authorization.ok) throw new Error(`Operation unavailable: ${operationId}`);
    const normalized = normalizeOperationOutcome(finalized.galaxyRun, authorization.context, {
      completionId,
      result: "success",
      metrics: null,
    });
    assert.equal(normalized.ok, true);
    if (!normalized.ok) throw new Error(`Operation normalization failed: ${operationId}`);
    const applied = applyOperationOutcomeToRun(finalized.galaxyRun, normalized.outcome);
    assert.equal(applied.ok, true);
    if (!applied.ok) throw new Error(`Operation fold failed: ${operationId}`);
    run = applied.galaxyRun;
  };
  const prunedOutcomeId = "legacy-capacity-pruned:success";
  const recoveryOutcomeId = "legacy-capacity-recovery:success";
  const checkpointOutcomeId = "legacy-capacity-checkpoint:success";
  applyContactOperation("contact:kepler", "op:kepler-black-box", prunedOutcomeId);
  applyContactOperation("contact:ashfall", "op:ashfall-sortie", recoveryOutcomeId);

  const hostilePreview = planRoute(run, { kind: "contact", contactId: "contact:hostile-picket" });
  assert.equal(hostilePreview.ok, true);
  if (!hostilePreview.ok) throw new Error("Hostile route unavailable");
  const hostileTravel = commitTravel(run, hostilePreview.plan);
  assert.equal(hostileTravel.ok, true);
  if (!hostileTravel.ok) throw new Error("Hostile travel commit failed");
  const interrupted = resumeTravelToBoundary(hostileTravel.galaxyRun);
  assert.equal(interrupted.ok, true);
  if (!interrupted.ok) throw new Error("Hostile travel resume failed");
  const hostileAuthorization = authorizeOperationLaunch(interrupted.galaxyRun, "op:hostile-picket");
  assert.equal(hostileAuthorization.ok, true);
  if (!hostileAuthorization.ok) throw new Error("Hostile operation unavailable");
  const hostileNormalized = normalizeOperationOutcome(interrupted.galaxyRun, hostileAuthorization.context, {
    completionId: checkpointOutcomeId,
    result: "success",
    metrics: { frameCount: 3600 },
  });
  assert.equal(hostileNormalized.ok, true);
  if (!hostileNormalized.ok) throw new Error("Hostile operation normalization failed");
  const hostileApplied = applyOperationOutcomeToRun(interrupted.galaxyRun, hostileNormalized.outcome);
  assert.equal(hostileApplied.ok, true);
  if (!hostileApplied.ok) throw new Error("Hostile operation fold failed");
  run = hostileApplied.galaxyRun;

  const fillerIds = Array.from({ length: 253 }, (_, index) => `legacy-capacity-filler:${index}`);
  const galaxyOutcomeIds = [checkpointOutcomeId, recoveryOutcomeId, prunedOutcomeId, ...fillerIds];
  run.appliedOutcomeIds = [...galaxyOutcomeIds];
  const recoveryReceipt: OutcomeRecoveryRecord = {
    version: 2,
    kind: "applied_return",
    outcomeId: recoveryOutcomeId,
    launchId: "legacy-capacity-recovery",
    missionId: "operation:op:ashfall-sortie",
    routeKind: "operation",
    routeIdentity: { kind: "operation", operationId: "op:ashfall-sortie" },
    terminalKind: "success",
    persistenceAuthority: "galaxy",
    returnTarget: "galaxy-atlas",
    appliedRevision: begun.saveRevision,
    returnPending: true,
  };
  const save: SaveData = {
    ...begun,
    activeExperience: "legacy",
    appliedOutcomeIds: [...galaxyOutcomeIds],
    outcomeRecoveryRecords: [recoveryReceipt],
    galaxyRun: run,
  };
  assert.equal(snapshotOutcomeRootAuthority(save)?.locked, false);
  const terminal = campaignEnvelope(save, "legacy-capacity-new");

  const committed = commitOutcome(memoryStore(save).store, terminal);

  assert.equal(committed.status, "committed");
  if (committed.status !== "committed" || committed.save.galaxyRun === null) return;
  assert.equal(committed.save.appliedOutcomeIds.length, 256);
  assert.equal(committed.save.galaxyRun.appliedOutcomeIds.length, 255);
  assert.ok(committed.save.appliedOutcomeIds.includes(terminal.outcomeId));
  assert.ok(!committed.save.galaxyRun.appliedOutcomeIds.includes(terminal.outcomeId));
  assert.ok(!committed.save.appliedOutcomeIds.includes(prunedOutcomeId));
  assert.ok(!committed.save.galaxyRun.appliedOutcomeIds.includes(prunedOutcomeId));
  assert.deepEqual(committed.save.galaxyRun.operations["op:kepler-black-box"].completionIds, []);
  assert.ok(committed.save.appliedOutcomeIds.includes(recoveryOutcomeId));
  assert.ok(committed.save.galaxyRun.appliedOutcomeIds.includes(recoveryOutcomeId));
  assert.deepEqual(committed.save.galaxyRun.operations["op:ashfall-sortie"].completionIds, [recoveryOutcomeId]);
  assert.ok(committed.save.appliedOutcomeIds.includes(checkpointOutcomeId));
  assert.ok(committed.save.galaxyRun.appliedOutcomeIds.includes(checkpointOutcomeId));
  assert.deepEqual(committed.save.galaxyRun.operations["op:hostile-picket"].completionIds, [checkpointOutcomeId]);
  assert.ok(committed.save.galaxyRun.activeTravel?.appliedCheckpointIds.some((checkpointId) =>
    checkpointId.endsWith(`:operation-outcome:${checkpointOutcomeId}`)));

  const postWrite = commitOutcome(postWriteThrowStore(save, (candidate) => ({
    ...candidate,
    galaxyRun: candidate.galaxyRun === null ? null : {
      ...candidate.galaxyRun,
      resources: {
        ...candidate.galaxyRun.resources,
        supply: candidate.galaxyRun.resources.supply + 1,
      },
    },
  })), terminal);
  assert.equal(postWrite.status, "write_failed");
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
    missionId: poiOutcomeMissionId(
      "poi:20:fp-ruin-cinder-relay:20:ashfall-cinder-relay",
      routeIdentity.originColonyId,
    ),
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

test("Galaxy POI outcomes commit at full coherent journal capacity", () => {
  const fixture = galaxyStageFixture("capacity-galaxy-poi");
  const fillerIds = Array.from({ length: 256 }, (_, index) => `capacity-poi:${index}`);
  const run = structuredClone(fixture.save.galaxyRun!);
  run.appliedOutcomeIds = [...fillerIds];
  const save: SaveData = {
    ...fixture.save,
    appliedOutcomeIds: [...fillerIds],
    galaxyRun: run,
  };
  const staged = stageGalaxyPoiOutcomeAuthority(
    save,
    fixture.active,
    GameScreen.LEVEL_COMPLETE,
    {
      ...fixture.attempt,
      expectedRevision: save.saveRevision,
      launchSnapshot: { galaxyRun: structuredClone(run) },
    },
  );
  assert.equal(staged.ok, true);
  if (!staged.ok) return;
  const terminal = envelope(staged.attempt, {
    version: 2,
    kind: "poi_result_v2",
    destinationColonyId: "galaxy:ashfall-primary",
  });

  const committed = commitOutcome(memoryStore(staged.save).store, terminal);

  assert.equal(committed.status, "committed");
  if (committed.status !== "committed" || committed.save.galaxyRun === null) return;
  assert.equal(committed.save.appliedOutcomeIds.length, 256);
  assert.equal(committed.save.galaxyRun.appliedOutcomeIds.length, 256);
  assert.ok(!committed.save.appliedOutcomeIds.includes(fillerIds[0]));
  assert.ok(!committed.save.galaxyRun.appliedOutcomeIds.includes(fillerIds[0]));
  assert.ok(committed.save.appliedOutcomeIds.includes(terminal.outcomeId));
  assert.ok(committed.save.galaxyRun.appliedOutcomeIds.includes(terminal.outcomeId));
  assert.equal(recoverGalaxyPoiPreparation(committed.save.galaxyRun), null);
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
    missionId: poiOutcomeMissionId(
      "poi:20:fp-ruin-cinder-relay:20:ashfall-cinder-relay",
      identity.originColonyId,
    ),
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
  const reloadedCommitted = migrateSave(JSON.parse(JSON.stringify(committed.save)));
  assert.equal(reloadedCommitted.outcomeRecoveryRecords[0]?.kind, "applied_return");
  assert.deepEqual(recoverOutcomeReturn(reloadedCommitted)?.routeIdentity, identity);

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

  assert.equal(
    acknowledgeOutcomeReturn(memoryStore(migrateSave({})).store, "never-issued:success").status,
    "conflict",
  );
});

test("migration bounds journals without pruning retained acknowledged Galaxy authority", () => {
  const initial = atAshfall();
  const operation = envelope(
    attempt(initial, "operation", "acknowledged-galaxy", "galaxy", "galaxy-atlas", ["galaxyRun"]),
    { version: 1, kind: "operation_result_v1", result: "failure", metrics: null },
    "failure",
  );
  const committed = commitOutcome(memoryStore(initial).store, operation);
  assert.equal(committed.status, "committed");
  if (committed.status !== "committed") return;
  const acknowledged = acknowledgeOutcomeReturn(memoryStore(committed.save).store, operation.outcomeId);
  assert.equal(acknowledged.status, "committed");
  if (acknowledged.status !== "committed") return;
  const oversized = {
    ...acknowledged.save,
    appliedOutcomeIds: [
      operation.outcomeId,
      ...Array.from({ length: 256 }, (_, index) => `legacy-filler:${index}`),
    ],
  };

  const migrated = migrateSave(JSON.parse(JSON.stringify(oversized)));

  assert.equal(migrated.appliedOutcomeIds.length, 256);
  assert.ok(migrated.appliedOutcomeIds.includes(operation.outcomeId));
  assert.equal(migrated.outcomeRecoveryRecords[0]?.kind, "applied_return");
  assert.ok(snapshotOutcomeRootAuthority(migrated));
});

test("durable outcome APIs are total over static, delayed, and revoked root and nested array proxies", () => {
  const base = readyLegacyPoi(migrateSave({}));
  const campaign = campaignEnvelope(base, "proxy-root-commit");
  const committed = commitOutcome(memoryStore(base).store, campaign);
  assert.equal(committed.status, "committed");
  if (committed.status !== "committed") return;

  const poiAttempt = attempt(base, "poi", "proxy-root-prepared", "legacy", "legacy-colony-exterior", [
    ...LEGACY_POI_FIELDS,
  ]);
  const preparedEnvelope = envelope(poiAttempt, { version: 2, kind: "poi_prepared_v2" });
  const staged = stageLegacyPreparedOutcome(base, preparedEnvelope);
  assert.ok(staged);
  if (staged === null) return;

  for (const mode of ["static", "delayed", "revoked"] as const) {
    const hostileJournal: SaveData = {
      ...committed.save,
      appliedOutcomeIds: hostileArray(committed.save.appliedOutcomeIds, mode),
    };
    const recoveredReturn: ReturnType<typeof recoverOutcomeReturn> = totalCall(
      `recover return ${mode}`,
      () => recoverOutcomeReturn(hostileJournal),
    );
    const acknowledged = totalCall(`ack ${mode}`, () =>
      acknowledgeOutcomeReturn(memoryStore(hostileJournal).store, campaign.outcomeId));
    const recommit = totalCall(`commit root journal ${mode}`, () =>
      commitOutcome(memoryStore(hostileJournal).store, campaign));

    const hostileRecords: SaveData = {
      ...staged,
      outcomeRecoveryRecords: hostileArray(staged.outcomeRecoveryRecords, mode),
    };
    const recoveredPrepared: ReturnType<typeof recoverLegacyPreparedOutcome> = totalCall(
      `recover prepared ${mode}`,
      () => recoverLegacyPreparedOutcome(hostileRecords),
    );
    const emptyHostileRecords = {
      ...base,
      outcomeRecoveryRecords: hostileArray(base.outcomeRecoveryRecords, mode),
    };
    const restaged = totalCall(`stage prepared ${mode}`, () =>
      stageLegacyPreparedOutcome(emptyHostileRecords, preparedEnvelope));

    if (mode === "revoked") {
      assert.equal(recoveredReturn, null);
      assert.equal(acknowledged?.status, "conflict");
      assert.equal(recommit?.status, "conflict");
      assert.equal(recoveredPrepared, null);
      assert.equal(restaged, null);
    }
  }

  const galaxy = atAshfall();
  const operation = envelope(
    attempt(galaxy, "operation", "proxy-nested-operation", "galaxy", "galaxy-atlas", ["galaxyRun"]),
    { version: 1, kind: "operation_result_v1", result: "failure", metrics: null },
    "failure",
  );
  for (const mode of ["static", "delayed", "revoked"] as const) {
    const hostileNested = {
      ...galaxy,
      galaxyRun: {
        ...galaxy.galaxyRun!,
        appliedOutcomeIds: hostileArray(galaxy.galaxyRun!.appliedOutcomeIds, mode),
      },
    };
    const result = totalCall(`nested journal ${mode}`, () =>
      commitOutcome(memoryStore(hostileNested).store, operation));
    assert.equal(result.status, "conflict");

    const hostileFacts = {
      ...galaxy,
      galaxyRun: {
        ...galaxy.galaxyRun!,
        historyFacts: hostileArray(galaxy.galaxyRun!.historyFacts, mode),
      },
    };
    const recovered = totalCall(`Galaxy POI recovery ${mode}`, () =>
      recoverGalaxyPoiOutcomeAuthority(hostileFacts));
    assert.equal(recovered, null);
  }
});

test("present malformed migration authority containers lock instead of erasing idempotency proof", () => {
  const containers: ReadonlyArray<readonly [string, unknown]> = [
    ...(["static", "delayed", "revoked"] as const).map((mode) => [mode, hostileMigrationContainer(mode)] as const),
    ["non-array", { opaque: true }],
  ];
  for (const [label, container] of containers) {
    for (const field of ["appliedOutcomeIds", "outcomeRecoveryRecords"] as const) {
      const migrated = totalCall(`${field} ${label}`, () => migrateSave({ [field]: container }));
      const lock = migrated.outcomeRecoveryRecords[0];
      assert.equal(lock?.kind, "reconciliation_required", `${field} ${label}`);
      if (lock?.kind === "reconciliation_required") {
        assert.equal(lock.reason, "outcome_authority_invalid", `${field} ${label}`);
        assert.ok(lock.protectedOutcomeIds.length <= 256, `${field} ${label}`);
        assert.ok(lock.quarantinedOutcomeCount >= 1, `${field} ${label}`);
      }
      assert.equal(
        commitOutcome(memoryStore(migrated).store, campaignEnvelope(migrated, `blocked-${field}-${label}`)).status,
        "conflict",
        `${field} ${label}`,
      );
    }
  }

  const absent = migrateSave({});
  assert.deepEqual(absent.appliedOutcomeIds, []);
  assert.deepEqual(absent.outcomeRecoveryRecords, []);
});

test("new dynamic POI and Colony terminals require exact latest inherited authority", () => {
  const legacy = readyLegacyPoi(migrateSave({}));
  const forged = [
    {
      label: "ghost POI",
      terminal: envelope({
        ...attempt(legacy, "poi", "legacy-ghost-poi", "legacy", "legacy-colony-exterior", []),
        routeIdentity: {
          kind: "poi" as const,
          originColonyId: "ghost",
          nodeId: "ashfall-cinder-relay",
          engine: "firstPerson" as const,
          templateId: "fp-ruin-cinder-relay",
          rewardEligible: true,
        },
      }, { version: 1, kind: "terminal_noop_v1" }, "failure"),
    },
    {
      label: "ghost Colony building",
      terminal: envelope({
        ...attempt(legacy, "colony", "legacy-ghost-building", "legacy", "legacy-landing-pad", []),
        missionId: "colony:4:home:interior:5:ghost",
        routeIdentity: { kind: "colony" as const, colonyId: "home", mode: "interior" as const, buildingId: "ghost" },
      }, { version: 1, kind: "terminal_noop_v1" }, "failure"),
    },
  ];
  for (const probe of forged) {
    assert.equal(commitOutcome(memoryStore(legacy).store, probe.terminal).status, "conflict", probe.label);
  }

  const crossLegacy = colonyReducer(legacy, Events.founded({
    colonyId: "cross-origin",
    name: "Cross Origin",
    planetId: "ashfall",
    foundingType: "outpost",
    regionNodeId: "ashfall-basalt-basin",
    missionCount: 0,
    layoutSeed: 44,
  }));
  const crossLegacyTerminal = envelope({
    ...attempt(crossLegacy, "poi", "legacy-cross-origin", "legacy", "legacy-colony-exterior", []),
    routeIdentity: {
      kind: "poi",
      originColonyId: "cross-origin",
      nodeId: "ashfall-cinder-relay",
      engine: "firstPerson",
      templateId: "fp-ruin-cinder-relay",
      rewardEligible: true,
    },
  }, { version: 1, kind: "terminal_noop_v1" }, "failure");
  assert.equal(commitOutcome(memoryStore(crossLegacy).store, crossLegacyTerminal).status, "conflict");

  const galaxy = readyGalaxyPoi();
  const galaxyGhost = envelope({
    ...attempt(galaxy, "poi", "galaxy-ghost-poi", "galaxy", "galaxy-region", []),
    routeIdentity: {
      kind: "poi",
      originColonyId: "galaxy:ghost",
      nodeId: "ashfall-cinder-relay",
      engine: "firstPerson",
      templateId: "fp-ruin-cinder-relay",
      rewardEligible: true,
    },
  }, { version: 1, kind: "terminal_noop_v1" }, "failure");
  assert.equal(commitOutcome(memoryStore(galaxy).store, galaxyGhost).status, "conflict");

  let projected = projectGalaxyRunToLegacyState(galaxy.galaxyRun!);
  projected = colonyReducer(projected, Events.founded({
    colonyId: "galaxy:cross-origin",
    name: "Galaxy Cross Origin",
    planetId: "ashfall",
    foundingType: "outpost",
    regionNodeId: "ashfall-basalt-basin",
    missionCount: 0,
    layoutSeed: 45,
  }));
  const merged = mergeProjectionIntoGalaxy(galaxy.galaxyRun!, {
    colonies: projected.colonies,
    planets: projected.planets,
  });
  assert.equal(merged.ok, true);
  if (!merged.ok) return;
  const galaxyCross = { ...galaxy, galaxyRun: merged.galaxyRun };
  const galaxyCrossTerminal = envelope({
    ...attempt(galaxyCross, "poi", "galaxy-cross-origin", "galaxy", "galaxy-region", []),
    routeIdentity: {
      kind: "poi",
      originColonyId: "galaxy:cross-origin",
      nodeId: "ashfall-cinder-relay",
      engine: "firstPerson",
      templateId: "fp-ruin-cinder-relay",
      rewardEligible: true,
    },
  }, { version: 1, kind: "terminal_noop_v1" }, "failure");
  assert.equal(commitOutcome(memoryStore(galaxyCross).store, galaxyCrossTerminal).status, "conflict");

  const ghostReceipt = {
    version: 2,
    kind: "applied_return",
    outcomeId: "ghost-receipt:failure",
    launchId: "ghost-receipt",
    missionId: poiOutcomeMissionId(
      "poi:20:fp-ruin-cinder-relay:20:ashfall-cinder-relay",
      "galaxy:ghost",
    ),
    routeKind: "poi",
    routeIdentity: galaxyGhost.routeIdentity,
    terminalKind: "failure",
    persistenceAuthority: "legacy",
    returnTarget: "legacy-colony-exterior",
    appliedRevision: 1,
    returnPending: true,
  } as const;
  const migrated = migrateSave({
    ...legacy,
    saveRevision: 1,
    appliedOutcomeIds: [ghostReceipt.outcomeId],
    outcomeRecoveryRecords: [ghostReceipt],
  });
  assert.equal(migrated.outcomeRecoveryRecords[0]?.kind, "reconciliation_required");
});

test("every Galaxy terminal owns exact root and nested journal parity", () => {
  for (const terminalKind of ["failure", "retreat"] as const) {
    const save = readyGalaxyPoi();
    const terminal = envelope({
      ...attempt(save, "poi", `galaxy-poi-${terminalKind}`, "galaxy", "galaxy-region", []),
      missionId: poiOutcomeMissionId(
        "poi:20:fp-ruin-cinder-relay:20:ashfall-cinder-relay",
        "galaxy:ashfall-primary",
      ),
      routeIdentity: {
        kind: "poi",
        originColonyId: "galaxy:ashfall-primary",
        nodeId: "ashfall-cinder-relay",
        engine: "firstPerson",
        templateId: "fp-ruin-cinder-relay",
        rewardEligible: true,
      },
    }, { version: 1, kind: "terminal_noop_v1" }, terminalKind);
    const memory = memoryStore(save);
    const committed = commitOutcome(memory.store, terminal);
    assert.equal(committed.status, "committed", terminalKind);
    if (committed.status !== "committed" || committed.save.galaxyRun === null) continue;
    assert.equal(committed.save.appliedOutcomeIds.filter((id) => id === terminal.outcomeId).length, 1);
    assert.equal(committed.save.galaxyRun.appliedOutcomeIds.filter((id) => id === terminal.outcomeId).length, 1);
    assert.equal(commitOutcome(memory.store, terminal).status, "already_applied");
    const rootOnly = structuredClone(committed.save);
    rootOnly.galaxyRun!.appliedOutcomeIds = rootOnly.galaxyRun!.appliedOutcomeIds.filter(
      (id) => id !== terminal.outcomeId,
    );
    assert.equal(commitOutcome(memoryStore(rootOnly).store, terminal).status, "conflict");
    const nestedOnly = structuredClone(committed.save);
    nestedOnly.appliedOutcomeIds = nestedOnly.appliedOutcomeIds.filter((id) => id !== terminal.outcomeId);
    nestedOnly.outcomeRecoveryRecords = [];
    assert.equal(commitOutcome(memoryStore(nestedOnly).store, terminal).status, "conflict");
  }

  const colonySave = atAshfall();
  const colonyTerminal = envelope({
    ...attempt(colonySave, "colony", "galaxy-colony-noop", "galaxy", "galaxy-atlas", []),
    missionId: colonyMissionDescriptor("galaxy:ashfall-primary", "exterior").id,
    routeIdentity: {
      kind: "colony",
      colonyId: "galaxy:ashfall-primary",
      mode: "exterior",
      buildingId: null,
    },
  }, { version: 1, kind: "terminal_noop_v1" }, "failure");
  const colonyCommitted = commitOutcome(memoryStore(colonySave).store, colonyTerminal);
  assert.equal(colonyCommitted.status, "committed");
  if (colonyCommitted.status === "committed" && colonyCommitted.save.galaxyRun !== null) {
    assert.ok(colonyCommitted.save.appliedOutcomeIds.includes(colonyTerminal.outcomeId));
    assert.ok(colonyCommitted.save.galaxyRun.appliedOutcomeIds.includes(colonyTerminal.outcomeId));
  }
});

test("root validation rejects incoherent and duplicate durable recovery authority", () => {
  const base = migrateSave({});
  const terminal = campaignEnvelope(base, "coherent-receipt");
  const committed = commitOutcome(memoryStore(base).store, terminal);
  assert.equal(committed.status, "committed");
  if (committed.status !== "committed") return;
  const receipt = committed.save.outcomeRecoveryRecords.find((record) => record.kind === "applied_return");
  assert.ok(receipt?.kind === "applied_return");
  if (receipt?.kind !== "applied_return") return;

  const missingJournal = { ...committed.save, appliedOutcomeIds: [] };
  const futureReceipt = {
    ...committed.save,
    outcomeRecoveryRecords: [{ ...receipt, appliedRevision: committed.save.saveRevision + 1 }],
  };
  const duplicate = {
    ...committed.save,
    outcomeRecoveryRecords: [structuredClone(receipt), structuredClone(receipt)],
  };
  for (const [label, save] of [
    ["missing journal", missingJournal],
    ["future receipt", futureReceipt],
    ["duplicate receipt", duplicate],
  ] as const) {
    assert.equal(recoverOutcomeReturn(save), null, label);
    assert.equal(acknowledgeOutcomeReturn(memoryStore(save).store, terminal.outcomeId).status, "conflict", label);
    assert.equal(commitOutcome(memoryStore(save).store, campaignEnvelope(save, `blocked-${label}`)).status, "conflict", label);
  }

  const migratedDuplicate = migrateSave(duplicate as unknown as Record<string, unknown>);
  assert.equal(migratedDuplicate.outcomeRecoveryRecords[0]?.kind, "reconciliation_required");

  const legacyPoi = readyLegacyPoi(migrateSave({}));
  const preparedEnvelope = envelope(
    attempt(legacyPoi, "poi", "duplicate-prepared", "legacy", "legacy-colony-exterior", [...LEGACY_POI_FIELDS]),
    { version: 2, kind: "poi_prepared_v2" },
  );
  const preparedRecord = { version: 2 as const, kind: "legacy_poi_prepared" as const, envelope: preparedEnvelope };
  const duplicatePrepared = {
    ...legacyPoi,
    outcomeRecoveryRecords: [preparedRecord, structuredClone(preparedRecord)],
  };
  assert.equal(recoverLegacyPreparedOutcome(duplicatePrepared), null);
  assert.equal(migrateSave(duplicatePrepared as unknown as Record<string, unknown>)
    .outcomeRecoveryRecords[0]?.kind, "reconciliation_required");
});

test("Legacy prepared authority locks when its revision is future or canonical fields drift", () => {
  const base = readyLegacyPoi(migrateSave({ saveRevision: 2, missionsSinceStart: 4 }));
  const record = {
    version: 2 as const,
    kind: "legacy_poi_prepared" as const,
    envelope: envelope(
      attempt(base, "poi", "migration-prepared", "legacy", "legacy-colony-exterior", [...LEGACY_POI_FIELDS]),
      { version: 2, kind: "poi_prepared_v2" },
    ),
  };
  const future = structuredClone(record);
  future.envelope.expectedRevision = base.saveRevision + 1;
  const drifted = structuredClone(record);
  drifted.envelope.launchSnapshot.missionsSinceStart = base.missionsSinceStart - 1;

  for (const [label, candidate] of [["future", future], ["drift", drifted]] as const) {
    const runtime = { ...base, outcomeRecoveryRecords: [candidate] };
    assert.equal(recoverLegacyPreparedOutcome(runtime), null, label);
    assert.equal(commitOutcome(memoryStore(runtime).store, campaignEnvelope(runtime, `blocked-prep-${label}`)).status, "conflict");
    const migrated = migrateSave(runtime as unknown as Record<string, unknown>);
    assert.equal(migrated.outcomeRecoveryRecords[0]?.kind, "reconciliation_required", label);
  }
});

test("Galaxy POI v2 staging requires coherent unlocked root and nested authority", () => {
  const save = readyGalaxyPoi();
  const projection = projectGalaxyRunToLegacyState(save.galaxyRun!);
  const dispatched = dispatchPoi(projection, "galaxy:ashfall-primary", "ashfall-cinder-relay");
  assert.equal(dispatched.ok, true);
  if (!dispatched.ok) return;
  const routeIdentity = {
    kind: "poi" as const,
    originColonyId: "galaxy:ashfall-primary",
    nodeId: "ashfall-cinder-relay",
    engine: "firstPerson" as const,
    templateId: "fp-ruin-cinder-relay",
    rewardEligible: true,
  };
  const initialAttempt: OutcomeAttempt = {
    version: 1,
    routeKind: "poi",
    missionId: poiOutcomeMissionId(
      "poi:20:fp-ruin-cinder-relay:20:ashfall-cinder-relay",
      routeIdentity.originColonyId,
    ),
    routeIdentity,
    launchId: "galaxy-stage-coherence",
    expectedRevision: save.saveRevision,
    persistenceAuthority: "galaxy",
    returnTarget: "galaxy-region",
    declaredFields: ["galaxyRun"],
    launchSnapshot: { galaxyRun: structuredClone(save.galaxyRun) },
  };
  const active = { originColonyId: routeIdentity.originColonyId, session: dispatched.session };
  const valid = stageGalaxyPoiOutcomeAuthority(save, active, GameScreen.LEVEL_COMPLETE, initialAttempt);
  assert.equal(valid.ok, true);
  if (valid.ok) assert.deepEqual(recoverGalaxyPoiOutcomeAuthority(valid.save), valid.attempt);

  const lock: OutcomeRecoveryRecord = {
    version: 2,
    kind: "reconciliation_required",
    reason: "outcome_authority_invalid",
    protectedOutcomeIds: [],
    quarantinedOutcomeCount: 1,
  };
  const outcomeId = `${initialAttempt.launchId}:success`;
  const probes: Array<[string, SaveData]> = [
    ["wrong experience", { ...save, activeExperience: "legacy" }],
    ["reconciliation lock", { ...save, outcomeRecoveryRecords: [lock] }],
    ["root-only outcome", { ...save, appliedOutcomeIds: [outcomeId] }],
    ["nested-only outcome", {
      ...save,
      galaxyRun: { ...save.galaxyRun!, appliedOutcomeIds: [outcomeId] },
    }],
    ["incoherent pending receipt", {
      ...save,
      outcomeRecoveryRecords: [{
        version: 2,
        kind: "applied_return",
        outcomeId,
        launchId: initialAttempt.launchId,
        missionId: initialAttempt.missionId,
        routeKind: "poi",
        routeIdentity,
        terminalKind: "success",
        persistenceAuthority: "galaxy",
        returnTarget: "galaxy-region",
        appliedRevision: save.saveRevision + 1,
        returnPending: true,
      }],
    }],
    ["old v1 preparation gate", {
      ...save,
      galaxyRun: {
        ...save.galaxyRun!,
        historyFacts: [...save.galaxyRun!.historyFacts, {
          id: "history:poi-prepared:00000000:%5B%5D",
          kind: "poi_completion_prepared",
          subjectId: routeIdentity.nodeId,
          cycle: save.galaxyRun!.worldCycle,
          causeFactIds: [],
        }],
      },
    }],
  ];
  for (const [label, candidate] of probes) {
    const result = totalCall(label, () =>
      stageGalaxyPoiOutcomeAuthority(candidate, active, GameScreen.LEVEL_COMPLETE, initialAttempt));
    assert.equal(result.ok, false, label);
    assert.equal(recoverGalaxyPoiOutcomeAuthority(candidate), null, label);
  }

  for (const mode of ["static", "delayed", "revoked"] as const) {
    const hostileRoot = {
      ...save,
      appliedOutcomeIds: hostileArray(save.appliedOutcomeIds, mode),
      outcomeRecoveryRecords: hostileArray(save.outcomeRecoveryRecords, mode),
    };
    assert.doesNotThrow(() => {
      stageGalaxyPoiOutcomeAuthority(hostileRoot, active, GameScreen.LEVEL_COMPLETE, initialAttempt);
    }, `hostile Galaxy stage ${mode}`);
  }
});

test("post-write throws require exact unlocked receipts, parity, and committed effects", () => {
  const initial = migrateSave({ credits: 5 });
  const terminal = campaignEnvelope(initial, "post-write-proof");
  const lock: OutcomeRecoveryRecord = {
    version: 2,
    kind: "reconciliation_required",
    reason: "outcome_authority_invalid",
    protectedOutcomeIds: [terminal.outcomeId],
    quarantinedOutcomeCount: 1,
  };
  const probes: Array<[string, (candidate: SaveData) => SaveData]> = [
    ["missing receipt", (candidate) => ({ ...candidate, outcomeRecoveryRecords: [] })],
    ["locked root", (candidate) => ({ ...candidate, outcomeRecoveryRecords: [lock] })],
    ["missing declared effect", (candidate) => ({ ...candidate, credits: initial.credits })],
    ["wrong receipt revision", (candidate) => ({
      ...candidate,
      outcomeRecoveryRecords: candidate.outcomeRecoveryRecords.map((record) => record.kind === "applied_return"
        ? { ...record, appliedRevision: record.appliedRevision + 1 }
        : record),
    })],
  ];
  for (const [label, transform] of probes) {
    assert.equal(commitOutcome(postWriteThrowStore(initial, transform), terminal).status, "write_failed", label);
  }

  let partialAfterMutation = initial;
  const mutatingStore: CanonicalSaveStore = {
    read: () => partialAfterMutation,
    write: (candidate) => {
      partialAfterMutation = { ...candidate, credits: initial.credits };
      candidate.credits = initial.credits;
      throw new Error("mutated candidate after partial write");
    },
  };
  assert.equal(commitOutcome(mutatingStore, terminal).status, "write_failed", "mutated candidate");

  const committed = commitOutcome(memoryStore(initial).store, terminal);
  assert.equal(committed.status, "committed");
  if (committed.status !== "committed") return;
  const ackTransforms: Array<[string, (candidate: SaveData) => SaveData]> = [
    ["ack missing receipt", (candidate) => ({ ...candidate, outcomeRecoveryRecords: [] })],
    ["ack locked root", (candidate) => ({ ...candidate, outcomeRecoveryRecords: [lock] })],
  ];
  for (const [label, transform] of ackTransforms) {
    assert.equal(
      acknowledgeOutcomeReturn(postWriteThrowStore(committed.save, transform), terminal.outcomeId).status,
      "write_failed",
      label,
    );
  }
});

test("Galaxy POI staging snapshots one exact bound attempt and never invokes attempt accessors", () => {
  const fixture = galaxyStageFixture("exact-stage-attempt");
  const valid = stageGalaxyPoiOutcomeAuthority(
    fixture.save,
    fixture.active,
    GameScreen.LEVEL_COMPLETE,
    fixture.attempt,
  );
  assert.equal(valid.ok, true);
  if (valid.ok) {
    const recovered = recoverGalaxyPoiOutcomeAuthority(valid.save);
    assert.deepEqual(recovered, valid.attempt);
    assert.equal(recovered?.missionId, fixture.attempt.missionId);
    assert.deepEqual(recovered?.routeIdentity, fixture.attempt.routeIdentity);
  }

  let accessorReads = 0;
  const accessorAttempt = { ...fixture.attempt } as OutcomeAttempt;
  Object.defineProperty(accessorAttempt, "missionId", {
    enumerable: true,
    configurable: true,
    get() { accessorReads += 1; return fixture.attempt.missionId; },
  });
  let delayed = false;
  const delayedAttempt = new Proxy(structuredClone(fixture.attempt), {
    ownKeys(target) { delayed = true; return Reflect.ownKeys(target); },
    get(target, property, receiver) {
      if (delayed) throw new Error(`delayed attempt read ${String(property)}`);
      return Reflect.get(target, property, receiver);
    },
  });
  const invalidAttempts = [
    { ...fixture.attempt, version: 2 as 1 },
    { ...fixture.attempt, missionId: poiOutcomeMissionId(
      "poi:20:fp-ruin-cinder-relay:20:ashfall-cinder-relay",
      "other-origin",
    ) },
    { ...fixture.attempt, extra: true } as unknown as OutcomeAttempt,
    accessorAttempt,
    delayedAttempt,
  ];
  for (const candidate of invalidAttempts) {
    const result = totalCall("invalid exact stage attempt", () => stageGalaxyPoiOutcomeAuthority(
      fixture.save,
      fixture.active,
      GameScreen.LEVEL_COMPLETE,
      candidate,
    ));
    assert.equal(result.ok, false);
  }
  assert.equal(accessorReads, 0);
});

test("historical Galaxy journal and operation ownership parity blocks all later authority", () => {
  const operationSave = atAshfall();
  const operation = envelope(
    attempt(operationSave, "operation", "historical-operation", "galaxy", "galaxy-atlas", ["galaxyRun"]),
    { version: 1, kind: "operation_result_v1", result: "failure", metrics: null },
    "failure",
  );
  const committed = commitOutcome(memoryStore(operationSave).store, operation);
  assert.equal(committed.status, "committed");
  if (committed.status !== "committed" || committed.save.galaxyRun === null) return;
  const missingNested = structuredClone(committed.save);
  missingNested.galaxyRun!.appliedOutcomeIds = [];
  const missingOwner = structuredClone(committed.save);
  missingOwner.galaxyRun!.operations["op:ashfall-sortie"].completionIds = [];
  const orphanNested = structuredClone(operationSave);
  orphanNested.galaxyRun!.appliedOutcomeIds.push("historical:orphan");
  const later = envelope({
    ...attempt(committed.save, "colony", "later-galaxy-colony", "galaxy", "galaxy-atlas", []),
    missionId: colonyMissionDescriptor("galaxy:ashfall-primary", "exterior").id,
    routeIdentity: {
      kind: "colony",
      colonyId: "galaxy:ashfall-primary",
      mode: "exterior",
      buildingId: null,
    },
  }, { version: 1, kind: "terminal_noop_v1" }, "failure");
  for (const [label, save] of [["missing nested", missingNested], ["missing owner", missingOwner], ["orphan", orphanNested]] as const) {
    assert.equal(commitOutcome(memoryStore(save).store, later).status, "conflict", label);
    const migrated = migrateSave(JSON.parse(JSON.stringify(save)));
    assert.equal(migrated.outcomeRecoveryRecords[0]?.kind, "reconciliation_required", label);
    assert.deepEqual(migrateSave(JSON.parse(JSON.stringify(migrated))), migrated, `${label} idempotence`);
  }
  const stage = galaxyStageFixture("historical-stage-block");
  stage.save.galaxyRun!.appliedOutcomeIds.push("historical:orphan-stage");
  assert.equal(stageGalaxyPoiOutcomeAuthority(
    stage.save,
    stage.active,
    GameScreen.LEVEL_COMPLETE,
    stage.attempt,
  ).ok, false);
  assert.equal(recoverGalaxyPoiOutcomeAuthority(stage.save), null);
});

test("dynamic zero-field validation snapshots hostile Colony and POI authority without getter reads", () => {
  const save = readyLegacyPoi(migrateSave({}));
  const terminal = envelope(
    attempt(save, "poi", "dynamic-getter", "legacy", "legacy-colony-exterior", []),
    { version: 1, kind: "terminal_noop_v1" },
    "failure",
  );
  let rootReads = 0;
  const rootGetter = { ...save };
  Object.defineProperty(rootGetter, "colonies", {
    enumerable: true,
    configurable: true,
    get() { rootReads += 1; return save.colonies; },
  });
  assert.equal(commitOutcome(memoryStore(rootGetter).store, terminal).status, "conflict");
  assert.equal(rootReads, 0);
  assert.equal(typeof Object.getOwnPropertyDescriptor(rootGetter, "colonies")?.get, "function");

  let nestedReads = 0;
  const hostileColony = { ...save.colonies[0] };
  Object.defineProperty(hostileColony, "id", {
    enumerable: true,
    configurable: true,
    get() { nestedReads += 1; return "home"; },
  });
  const nestedGetter = { ...save, colonies: [hostileColony as SaveData["colonies"][number]] };
  assert.equal(commitOutcome(memoryStore(nestedGetter).store, terminal).status, "conflict");
  assert.equal(nestedReads, 0);

  let runReads = 0;
  const galaxyFixture = galaxyStageFixture("dynamic-run-getter");
  const hostileRun = { ...galaxyFixture.save.galaxyRun! };
  Object.defineProperty(hostileRun, "colonies", {
    enumerable: true,
    configurable: true,
    get() { runReads += 1; return galaxyFixture.save.galaxyRun!.colonies; },
  });
  const galaxyTerminal = envelope(
    { ...galaxyFixture.attempt, declaredFields: [], launchSnapshot: {} },
    { version: 1, kind: "terminal_noop_v1" },
    "failure",
  );
  assert.equal(commitOutcome(memoryStore({ ...galaxyFixture.save, galaxyRun: hostileRun }).store, galaxyTerminal).status, "conflict");
  assert.equal(runReads, 0);
});

test("outcome metadata migration distinguishes absent fields from explicit or accessor authority", () => {
  const absent = migrateSave({});
  assert.deepEqual(absent.appliedOutcomeIds, []);
  assert.deepEqual(absent.outcomeRecoveryRecords, []);
  for (const value of [undefined, null]) {
    for (const field of ["appliedOutcomeIds", "outcomeRecoveryRecords"] as const) {
      const migrated = migrateSave({ [field]: value });
      assert.equal(migrated.outcomeRecoveryRecords[0]?.kind, "reconciliation_required", `${field} ${value}`);
    }
  }
  for (const field of ["appliedOutcomeIds", "outcomeRecoveryRecords"] as const) {
    let reads = 0;
    const raw: Record<string, unknown> = {};
    Object.defineProperty(raw, field, {
      enumerable: true,
      configurable: true,
      get() { reads += 1; return []; },
    });
    const migrated = migrateSave(raw);
    assert.equal(reads, 0, field);
    assert.equal(migrated.outcomeRecoveryRecords[0]?.kind, "reconciliation_required", field);
  }

  let galaxyRunReads = 0;
  const galaxyRunAccessor: Record<string, unknown> = {
    saveRevision: 0,
    appliedOutcomeIds: [],
    outcomeRecoveryRecords: [],
  };
  Object.defineProperty(galaxyRunAccessor, "galaxyRun", {
    enumerable: true,
    configurable: true,
    get() { galaxyRunReads += 1; return null; },
  });
  const migratedAccessor = migrateSave(galaxyRunAccessor);
  assert.equal(galaxyRunReads, 0);
  assert.equal(migratedAccessor.outcomeRecoveryRecords[0]?.kind, "reconciliation_required");
});

test("present hostile or throwing GalaxyRun containers fail closed without resetting root history", () => {
  const begun = beginGalaxyExperience(migrateSave({}));
  assert.ok(begun.galaxyRun);
  const rootOutcomeId = "unrelated-root-history:success";
  const base = {
    ...begun,
    credits: 73,
    saveRevision: 4,
    appliedOutcomeIds: [rootOutcomeId],
    outcomeRecoveryRecords: [],
  };
  const delayedRun = new Proxy(structuredClone(begun.galaxyRun!), {
    getOwnPropertyDescriptor(target, property) {
      const descriptor = Reflect.getOwnPropertyDescriptor(target, property);
      if (property === "identity") {
        Object.defineProperty(target, "worldCycle", {
          enumerable: true,
          configurable: true,
          get() { throw new Error("delayed Galaxy migration failure"); },
        });
      }
      return descriptor;
    },
  });
  const revokedRun = Proxy.revocable(structuredClone(begun.galaxyRun!), {});
  revokedRun.revoke();
  const throwingRun = structuredClone(begun.galaxyRun!);
  Object.defineProperty(throwingRun, "worldCycle", {
    enumerable: true,
    configurable: true,
    get() { throw new Error("Galaxy field migration failure"); },
  });

  for (const [label, galaxyRun] of [
    ["delayed", delayedRun],
    ["revoked", revokedRun.proxy],
    ["throwing valid run", throwingRun],
    ["explicit undefined", undefined],
  ] as const) {
    const migrated = totalCall(label, () => migrateSave({ ...base, galaxyRun }));
    assert.equal(migrated.credits, 73, label);
    assert.deepEqual(migrated.appliedOutcomeIds, [rootOutcomeId], label);
    const lock = migrated.outcomeRecoveryRecords[0];
    assert.equal(lock?.kind, "reconciliation_required", label);
    if (lock?.kind !== "reconciliation_required") continue;
    assert.equal(lock.version, 2, label);
    assert.equal(lock.reason, "outcome_authority_invalid", label);
    assert.ok(lock.protectedOutcomeIds.length <= 256, label);
    assert.ok(lock.quarantinedOutcomeCount >= 1, label);
  }

  const explicitNull = migrateSave({ ...base, activeExperience: "legacy", galaxyRun: null });
  assert.deepEqual(explicitNull.appliedOutcomeIds, [rootOutcomeId]);
  assert.deepEqual(explicitNull.outcomeRecoveryRecords, []);
});

test("multiple distinct Legacy preparations are invalid runtime and migration authority", () => {
  const save = readyLegacyPoi(migrateSave({}));
  const first = envelope(
    attempt(save, "poi", "prepared-one", "legacy", "legacy-colony-exterior", [...LEGACY_POI_FIELDS]),
    { version: 2, kind: "poi_prepared_v2" },
  );
  const second = envelope(
    attempt(save, "poi", "prepared-two", "legacy", "legacy-colony-exterior", [...LEGACY_POI_FIELDS]),
    { version: 2, kind: "poi_prepared_v2" },
  );
  const records: OutcomeRecoveryRecord[] = [first, second].map((prepared) => ({
    version: 2,
    kind: "legacy_poi_prepared",
    envelope: prepared,
  }));
  const ambiguous = { ...save, outcomeRecoveryRecords: records };
  assert.equal(recoverLegacyPreparedOutcome(ambiguous), null);
  assert.equal(commitOutcome(memoryStore(ambiguous).store, campaignEnvelope(ambiguous, "blocked-two-prep")).status, "conflict");
  assert.equal(migrateSave(ambiguous as unknown as Record<string, unknown>)
    .outcomeRecoveryRecords[0]?.kind, "reconciliation_required");
});

test("lower Galaxy prepared authority APIs are total over hostile public inputs", () => {
  const fixture = galaxyStageFixture("lower-api-total");
  const run = fixture.save.galaxyRun!;
  const identity = fixture.attempt.routeIdentity as Extract<OutcomeRouteIdentity, { kind: "poi" }>;
  const binding = {
    launchId: fixture.attempt.launchId,
    outcomeId: `${fixture.attempt.launchId}:success`,
    preparedRevision: fixture.save.saveRevision + 1,
  };
  const revokedRun = Proxy.revocable(run, {});
  revokedRun.revoke();
  assert.equal(totalCall("create revoked run", () => createGalaxyPoiPreparedFact(
    revokedRun.proxy,
    identity,
    binding,
  )), null);
  assert.equal(totalCall("recover revoked run", () => recoverGalaxyPoiPreparation(revokedRun.proxy)), null);
  assert.deepEqual(totalCall("resolve revoked run", () => resolveGalaxyPoiOutcomeFromRun(
    revokedRun.proxy,
    identity,
    binding,
    null,
  )), { ok: false });
  let factReads = 0;
  const hostileFact = { kind: "poi_completion_prepared" } as { id: string; kind: string };
  Object.defineProperty(hostileFact, "id", {
    enumerable: true,
    get() { factReads += 1; throw new Error("fact getter"); },
  });
  assert.equal(totalCall("hostile predicate", () => isGalaxyPoiPreparedAuthorityFact(hostileFact as never)), false);
  assert.equal(factReads, 0);
  const hostileBinding = new Proxy(binding, { get() { throw new Error("binding getter"); } });
  assert.equal(totalCall("hostile binding", () => createGalaxyPoiPreparedFact(run, identity, hostileBinding)), null);
});

test("reserved Galaxy preparation facts migrate to explicit reconciliation unless exactly valid v2", () => {
  const fixture = galaxyStageFixture("reserved-fact-migration");
  const oldFact = {
    id: "history:poi-prepared:00000000:%5B%5D",
    kind: "poi_completion_prepared" as const,
    subjectId: "ashfall-cinder-relay",
    cycle: fixture.save.galaxyRun!.worldCycle,
    causeFactIds: [],
  };
  const oldSave = {
    ...fixture.save,
    galaxyRun: {
      ...fixture.save.galaxyRun!,
      historyFacts: [...fixture.save.galaxyRun!.historyFacts, oldFact],
    },
  };
  const oldMigrated = migrateSave(JSON.parse(JSON.stringify(oldSave)));
  assert.equal(oldMigrated.outcomeRecoveryRecords[0]?.kind, "reconciliation_required");
  assert.deepEqual(migrateSave(JSON.parse(JSON.stringify(oldMigrated))), oldMigrated);
  const staged = stageGalaxyPoiOutcomeAuthority(
    fixture.save,
    fixture.active,
    GameScreen.LEVEL_COMPLETE,
    fixture.attempt,
  );
  assert.equal(staged.ok, true);
  if (!staged.ok) return;
  const validReload = migrateSave(JSON.parse(JSON.stringify(staged.save)));
  assert.ok(recoverGalaxyPoiOutcomeAuthority(validReload));
  assert.deepEqual(migrateSave(JSON.parse(JSON.stringify(validReload))), validReload);
  const revisionMismatch = migrateSave(JSON.parse(JSON.stringify({
    ...staged.save,
    saveRevision: staged.save.saveRevision + 1,
  })));
  assert.equal(revisionMismatch.outcomeRecoveryRecords[0]?.kind, "reconciliation_required");
  const ambiguous = migrateSave(JSON.parse(JSON.stringify({
    ...staged.save,
    galaxyRun: {
      ...staged.save.galaxyRun!,
      historyFacts: [...staged.save.galaxyRun!.historyFacts, ...staged.save.galaxyRun!.historyFacts.filter(
        isGalaxyPoiPreparedAuthorityFact,
      )],
    },
  })));
  assert.equal(ambiguous.outcomeRecoveryRecords[0]?.kind, "reconciliation_required");
});

test("durable POI origin binding rejects substitution between two otherwise valid adjacent origins", () => {
  let save = readyLegacyPoi(migrateSave({}));
  save = {
    ...save,
    planets: save.planets.map((planet) => ({
      ...planet,
      regionMap: {
        ...planet.regionMap,
        nodes: planet.regionMap.nodes.map((node) =>
          node.id === "ashfall-ironreach-shelf"
            ? { ...node, intel: "surveyed" as const, discovered: true }
            : node.id === "ashfall-oathbreaker-wreck"
              ? { ...node, intel: "surveyed" as const, discovered: true }
              : node),
      },
    })),
  };
  save = colonyReducer(save, Events.founded({
    colonyId: "second-origin",
    name: "Second Origin",
    planetId: "ashfall",
    foundingType: "outpost",
    regionNodeId: "ashfall-ironreach-shelf",
    missionCount: 0,
    layoutSeed: 91,
  }));
  assert.equal(dispatchPoi(save, "home", "ashfall-oathbreaker-wreck").ok, true);
  assert.equal(dispatchPoi(save, "second-origin", "ashfall-oathbreaker-wreck").ok, true);
  const descriptor = poiMissionDescriptor("ashfall-oathbreaker-wreck", "boarding");
  const homeAttempt: OutcomeAttempt = {
    ...attempt(save, "poi", "origin-bound", "legacy", "legacy-colony-exterior", []),
    missionId: poiOutcomeMissionId(descriptor.id, "home"),
    routeIdentity: {
      kind: "poi",
      originColonyId: "home",
      nodeId: "ashfall-oathbreaker-wreck",
      engine: "boarding",
      templateId: "boarding-wreck-oathbreaker",
      rewardEligible: true,
    },
  };
  const terminal = envelope(homeAttempt, { version: 1, kind: "terminal_noop_v1" }, "failure");
  const substituted = {
    ...terminal,
    routeIdentity: { ...terminal.routeIdentity, originColonyId: "second-origin" },
  } as SerializedOutcomeEnvelope;
  assert.equal(commitOutcome(memoryStore(save).store, substituted).status, "conflict");
  const receipt = {
    version: 2,
    kind: "applied_return",
    outcomeId: substituted.outcomeId,
    launchId: substituted.launchId,
    missionId: substituted.missionId,
    routeKind: "poi",
    routeIdentity: substituted.routeIdentity,
    terminalKind: "failure",
    persistenceAuthority: "legacy",
    returnTarget: "legacy-colony-exterior",
    appliedRevision: 1,
    returnPending: true,
  } as const;
  const migrated = migrateSave({
    ...save,
    saveRevision: 1,
    appliedOutcomeIds: [receipt.outcomeId],
    outcomeRecoveryRecords: [receipt],
  });
  assert.equal(migrated.outcomeRecoveryRecords[0]?.kind, "reconciliation_required");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { beginGalaxyExperience } from "../../app/components/engine/galaxy/experienceFlow";
import { migrateSave } from "../../app/components/engine/save";
import {
  acknowledgeOutcomeReturn,
  commitOutcome,
  createOutcomeAttempt,
  createOutcomeEnvelope,
  recoverOutcomeReturn,
  type CanonicalSaveStore,
  type OutcomeDeclaredField,
} from "../../app/components/engine/missionOutcome";
import type {
  OutcomeAttempt,
  OutcomeRecoveryRecord,
  OutcomeRouteKind,
  SaveData,
  SerializedOutcomeEnvelope,
} from "../../app/components/engine/types";
import { completePlanet } from "../../app/components/engine/planets";
import { unlockCodexEntries } from "../../app/components/engine/codex";
import {
  campaignMissionDescriptor,
  launchContextFromSave,
} from "../../app/components/engine/missionContext";

function attempt(
  save: SaveData,
  routeKind: OutcomeRouteKind,
  launchId: string,
  persistenceAuthority: OutcomeAttempt["persistenceAuthority"],
  returnTarget: OutcomeAttempt["returnTarget"],
  declaredFields: OutcomeDeclaredField[],
): OutcomeAttempt {
  return {
    version: 1,
    routeKind,
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
  fields: Record<string, unknown>,
  terminalKind: "success" | "failure" | "retreat" = "success",
): SerializedOutcomeEnvelope {
  return createOutcomeEnvelope(outcomeAttempt, terminalKind, {
    version: 1,
    kind: `${outcomeAttempt.routeKind}_result_v1`,
    fields,
  });
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
  const preparedEnvelope = envelope(
    attempt(base, "poi", "prepared-launch", "legacy", "legacy-colony-exterior", ["missionsSinceStart"]),
    { missionsSinceStart: 2 },
  );
  const applied = {
    version: 1,
    kind: "applied_return",
    outcomeId: "applied-launch:success",
    launchId: "applied-launch",
    terminalKind: "success",
    persistenceAuthority: "legacy",
    returnTarget: "legacy-cockpit",
    appliedRevision: 2,
    returnPending: true,
  };
  const prepared = { version: 1, kind: "legacy_poi_prepared", envelope: preparedEnvelope };
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

  const migrated = migrateSave({
    saveRevision: 2,
    appliedOutcomeIds: [applied.outcomeId],
    outcomeRecoveryRecords: [applied, prepared, ...hostile],
  });

  assert.equal(accessorReads, 0);
  assert.deepEqual(migrated.outcomeRecoveryRecords, [applied, prepared]);
});

test("pending return migration locks incoherent journal and revision authority", () => {
  const applied = {
    version: 1,
    kind: "applied_return",
    outcomeId: "incoherent-return:success",
    launchId: "incoherent-return",
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
  assert.equal(migrated.outcomeRecoveryRecords[0]?.kind, "reconciliation_required");
});

test("an invalid durable Legacy preparation migrates to a reconciliation lock", () => {
  const base = migrateSave({ missionsSinceStart: 1 });
  const valid = {
    version: 1,
    kind: "legacy_poi_prepared",
    envelope: envelope(
      attempt(base, "poi", "valid-prepared", "legacy", "legacy-colony-exterior", ["missionsSinceStart"]),
      { missionsSinceStart: 2 },
    ),
  };
  const invalid = {
    ...valid,
    envelope: { ...valid.envelope, payload: () => 1 },
  };

  const migrated = migrateSave({ outcomeRecoveryRecords: [valid, invalid] });

  assert.deepEqual(migrated.outcomeRecoveryRecords, [{
    version: 1,
    kind: "reconciliation_required",
    reason: "prepared_outcome_invalid",
    protectedOutcomeIds: [valid.envelope.outcomeId],
  }]);
});

test("recovery migration locks reconciliation instead of truncating unresolved authority", () => {
  const base = migrateSave({ missionsSinceStart: 1 });
  const unresolved = Array.from({ length: 33 }, (_, index) => ({
    version: 1,
    kind: "legacy_poi_prepared",
    envelope: envelope(
      attempt(base, "poi", `prepared-${index}`, "legacy", "legacy-colony-exterior", ["missionsSinceStart"]),
      { missionsSinceStart: index + 2 },
    ),
  }));

  const migrated = migrateSave({ outcomeRecoveryRecords: unresolved });

  assert.equal(migrated.outcomeRecoveryRecords.length, 1);
  assert.deepEqual(migrated.outcomeRecoveryRecords[0], {
    version: 1,
    kind: "reconciliation_required",
    reason: "recovery_capacity_exceeded",
    protectedOutcomeIds: unresolved.map((record) => record.envelope.outcomeId),
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

test("every terminal route class commits one registry fold and durable owned return", () => {
  const legacy = migrateSave({ credits: 10 });
  const galaxy = beginGalaxyExperience(legacy);
  assert.ok(galaxy.galaxyRun);
  const routes: Array<{
    name: string;
    save: SaveData;
    outcome: SerializedOutcomeEnvelope;
    inspect: (save: SaveData) => unknown;
    expected: unknown;
  }> = [
    {
      name: "campaign", save: legacy,
      outcome: envelope(attempt(legacy, "campaign", "campaign-attempt", "legacy", "legacy-star-map", ["credits"]), { credits: 60 }),
      inspect: (save) => save.credits, expected: 60,
    },
    {
      name: "planet", save: legacy,
      outcome: envelope(attempt(legacy, "planet", "planet-attempt", "legacy", "legacy-cockpit", ["completedPlanets"]), { completedPlanets: ["ashfall"] }),
      inspect: (save) => save.completedPlanets, expected: ["ashfall"],
    },
    {
      name: "special", save: legacy,
      outcome: envelope(attempt(legacy, "special", "special-attempt", "legacy", "legacy-cockpit", ["storyItems"]), { storyItems: ["kepler-black-box"] }),
      inspect: (save) => save.storyItems, expected: ["kepler-black-box"],
    },
    {
      name: "operation", save: galaxy,
      outcome: envelope(attempt(galaxy, "operation", "operation-attempt", "galaxy", "galaxy-atlas", ["galaxyRun"]), {
        galaxyRun: { ...galaxy.galaxyRun, worldCycle: galaxy.galaxyRun.worldCycle + 1 },
      }, "failure"),
      inspect: (save) => save.galaxyRun?.worldCycle, expected: galaxy.galaxyRun.worldCycle + 1,
    },
    {
      name: "colony", save: legacy,
      outcome: envelope(attempt(legacy, "colony", "colony-attempt", "legacy", "legacy-cockpit", ["missionsSinceStart"]), { missionsSinceStart: 1 }, "failure"),
      inspect: (save) => save.missionsSinceStart, expected: 1,
    },
    {
      name: "POI", save: legacy,
      outcome: envelope(attempt(legacy, "poi", "poi-attempt", "legacy", "legacy-colony-exterior", ["missionsSinceStart"]), { missionsSinceStart: 1 }),
      inspect: (save) => save.missionsSinceStart, expected: 1,
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
      version: 1,
      kind: "applied_return",
      outcomeId: route.outcome.outcomeId,
      launchId: route.outcome.launchId,
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
    ["operation", galaxy, "galaxy", "galaxy-atlas"],
    ["colony", legacy, "legacy", "legacy-cockpit"],
    ["poi", legacy, "legacy", "legacy-colony-exterior"],
  ];

  for (const [routeKind, save, authority, returnTarget] of routes) {
    const terminal = envelope(
      attempt(save, routeKind, `${routeKind}-failure`, authority, returnTarget, []),
      {},
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
    {},
  );
  assert.equal(commitOutcome(memoryStore(legacy).store, invalidSuccess).status, "conflict");
});

test("route registry retains real planet rewards and campaign Codex unlocks", () => {
  const planetLaunch = migrateSave({});
  const planetResult = completePlanet(planetLaunch, "glaciem");
  const planetFields: OutcomeDeclaredField[] = [
    "completedPlanets", "materials", "unlockedEnhancements", "factionStandings",
  ];
  const planetOutcome = envelope(
    attempt(planetLaunch, "planet", "glaciem-success", "legacy", "legacy-cockpit", planetFields),
    Object.fromEntries(planetFields.map((field) => [field, planetResult[field]])),
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
    attempt(campaignLaunch, "campaign", "campaign-codex", "legacy", "legacy-cockpit", ["unlockedCodex"]),
    { unlockedCodex: campaignResult.unlockedCodex },
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
  const captured = createOutcomeAttempt(save, context, "campaign", ["credits", "levels"]);
  save.credits = 999;
  save.levels["1-1"] = { completed: true, stars: 3, highScore: 999 };

  assert.deepEqual(captured, {
    version: 1,
    routeKind: "campaign",
    launchId: "attempt-snapshot",
    expectedRevision: 0,
    persistenceAuthority: "legacy",
    returnTarget: "legacy-star-map",
    declaredFields: ["credits", "levels"],
    launchSnapshot: { credits: 10, levels: {} },
  });
  assert.throws(() => createOutcomeAttempt(save, context, "operation", ["galaxyRun"]));
  assert.throws(() => createOutcomeAttempt(save, context, "campaign", ["credits", "credits"]));
});

test("duplicate callback and serialized UI-loss recovery never reapply a route fold", () => {
  const initial = migrateSave({ credits: 5 });
  const terminal = envelope(
    attempt(initial, "campaign", "duplicate-attempt", "legacy", "legacy-cockpit", ["credits"]),
    { credits: 30 },
  );
  const memory = memoryStore(initial);
  const first = commitOutcome(memory.store, terminal);
  assert.equal(first.status, "committed");
  if (first.status !== "committed") return;

  const reloaded = migrateSave(JSON.parse(JSON.stringify(first.save)));
  const recovered = commitOutcome(memoryStore(reloaded).store, terminal);

  assert.equal(recovered.status, "already_applied");
  assert.equal(reloaded.credits, 30);
  assert.equal(reloaded.saveRevision, 1);
  assert.equal(recoverOutcomeReturn(reloaded)?.returnTarget, "legacy-cockpit");
});

test("write failure retries the same envelope and post-write throw rereads idempotently", () => {
  const initial = migrateSave({ credits: 5 });
  const terminal = envelope(
    attempt(initial, "campaign", "write-attempt", "legacy", "legacy-cockpit", ["credits"]),
    { credits: 30 },
  );
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
  assert.equal(after.current().credits, 30);
  assert.equal(after.writes(), 1);
});

test("fresh-store two-writer handling rebases disjoint fields and conflicts on declared drift", () => {
  const launch = migrateSave({ credits: 10, viewedCodex: [], levels: {} });
  const creditOutcome = envelope(
    attempt(launch, "campaign", "writer-one", "legacy", "legacy-cockpit", ["credits"]),
    { credits: 15 },
  );
  const disjoint = envelope(
    attempt(launch, "campaign", "writer-two", "legacy", "legacy-star-map", ["levels"]),
    { levels: { "1-1": { completed: true, stars: 1, highScore: 10 } } },
  );
  const sameField = envelope(
    attempt(launch, "campaign", "writer-three", "legacy", "legacy-cockpit", ["credits"]),
    { credits: 12 },
  );
  const memory = memoryStore(launch);
  const first = commitOutcome(memory.store, creditOutcome);
  assert.equal(first.status, "committed");
  if (first.status !== "committed") return;

  const unrelated = { ...first.save, saveRevision: 2, viewedCodex: ["enemy:scout"] };
  memory.setCurrent(unrelated);
  const rebased = commitOutcome(memory.store, disjoint);
  assert.equal(rebased.status, "committed");
  if (rebased.status === "committed") {
    assert.equal(rebased.save.credits, 15);
    assert.deepEqual(rebased.save.viewedCodex, ["enemy:scout"]);
    assert.equal(rebased.save.saveRevision, 3);
  }
  memory.setCurrent(unrelated);
  assert.equal(commitOutcome(memory.store, sameField).status, "conflict");
});

test("two-tab terminal outcomes cannot cross the canonical experience namespace", () => {
  const legacy = migrateSave({});
  const galaxy = beginGalaxyExperience(legacy);
  assert.ok(galaxy.galaxyRun);
  const legacyFailure = envelope(
    attempt(legacy, "campaign", "legacy-experience-tab", "legacy", "legacy-cockpit", []),
    {},
    "failure",
  );
  const galaxyFailure = envelope(
    attempt(galaxy, "operation", "galaxy-experience-tab", "galaxy", "galaxy-atlas", []),
    {},
    "failure",
  );

  assert.equal(commitOutcome(memoryStore(galaxy).store, legacyFailure).status, "conflict");
  assert.equal(commitOutcome(memoryStore({ ...galaxy, activeExperience: "legacy" }).store, galaxyFailure).status, "conflict");
  assert.equal(commitOutcome(memoryStore({ ...galaxy, galaxyRun: null }).store, galaxyFailure).status, "conflict");
});

test("serializable envelopes reject undeclared patches, malformed domains, and authority crossings", () => {
  const legacy = migrateSave({ credits: 10, xp: 2 });
  const begun = beginGalaxyExperience(legacy);
  const validAttempt = attempt(legacy, "campaign", "valid-attempt", "legacy", "legacy-cockpit", ["credits"]);
  const malformed: SerializedOutcomeEnvelope[] = [
    envelope(validAttempt, { credits: 11, xp: 3 }),
    envelope({ ...validAttempt, declaredFields: [] }, {}),
    envelope({ ...validAttempt, declaredFields: ["credits", "credits"] }, { credits: 11 }),
    { ...envelope(validAttempt, { credits: 11 }), outcomeId: "forged:success" },
    { ...envelope(validAttempt, { credits: 11 }), terminalKind: "timeout" as SerializedOutcomeEnvelope["terminalKind"], outcomeId: "valid-attempt:timeout" },
    envelope({ ...validAttempt, returnTarget: "galaxy-atlas" }, { credits: 11 }),
    envelope(attempt(begun, "operation", "galaxy-cross", "galaxy", "galaxy-atlas", ["credits"]), { credits: 11 }),
    envelope(attempt(begun, "operation", "legacy-cross", "legacy", "legacy-cockpit", ["galaxyRun"]), { galaxyRun: begun.galaxyRun }),
    envelope(attempt(legacy, "campaign", "campaign-special-cross", "legacy", "legacy-cockpit", ["storyItems"]), { storyItems: ["kepler-black-box"] }),
    envelope(attempt(legacy, "poi", "poi-credit-cross", "legacy", "legacy-colony-exterior", ["credits"]), { credits: 999 }),
    {
      ...envelope(validAttempt, { credits: 11 }),
      payload: { version: 1, kind: "special_result_v1", fields: { credits: 11 } },
    },
  ];

  for (const terminal of malformed) {
    assert.equal(commitOutcome(memoryStore(terminal.persistenceAuthority === "galaxy" ? begun : legacy).store, terminal).status, "conflict");
  }
});

test("journal pruning protects validated recovery records and fails closed on recovery overflow", () => {
  const appliedOutcomeIds = ["old:success", ...Array.from({ length: 255 }, (_, index) => `old:${index + 1}`)];
  const protectedRecord: OutcomeRecoveryRecord = {
    version: 1,
    kind: "applied_return",
    outcomeId: "old:success",
    launchId: "old",
    terminalKind: "success",
    persistenceAuthority: "legacy",
    returnTarget: "legacy-cockpit",
    appliedRevision: 1,
    returnPending: true,
  };
  const launch = migrateSave({ saveRevision: 1, appliedOutcomeIds, outcomeRecoveryRecords: [protectedRecord] });
  const terminal = envelope(
    attempt(launch, "campaign", "new-attempt", "legacy", "legacy-cockpit", ["credits"]),
    { credits: 1 },
  );
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
  const terminal = envelope(
    attempt(initial, "campaign", "return-attempt", "legacy", "legacy-star-map", ["credits"]),
    { credits: 2 },
  );
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
});

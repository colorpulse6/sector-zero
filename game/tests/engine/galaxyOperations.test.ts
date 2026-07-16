import { test } from "node:test";
import assert from "node:assert/strict";
import { coord } from "../../app/components/engine/galaxy/coordinates";
import { projectGalaxyRunToLegacySave } from "../../app/components/engine/galaxy/galaxyProjection";
import {
  createFreshGalaxyRun,
  startFreshGalaxy,
} from "../../app/components/engine/galaxy/galaxyRun";
import type { GalaxyRunState } from "../../app/components/engine/galaxy/galaxyTypes";
import { planRoute } from "../../app/components/engine/galaxy/routePlanner";
import {
  commitTravel,
  finalizeTravel,
  resumeTravelToBoundary,
} from "../../app/components/engine/galaxy/travelResolver";
import {
  authorizeOperationLaunch,
  evaluateOperationModifier,
  getOperation,
  listG0Operations,
} from "../../app/components/engine/operations/operationCatalog";
import { launchOperation } from "../../app/components/engine/operations/operationAdapters";
import type {
  OperationId,
  OperationLaunchContext,
} from "../../app/components/engine/operations/operationTypes";
import { migrateSave } from "../../app/components/engine/save";
import type { SaveData } from "../../app/components/engine/types";

const IDS: readonly OperationId[] = [
  "op:hostile-picket",
  "op:kepler-black-box",
  "op:ashfall-sortie",
];

function requireTravelSuccess<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  assert.equal(result.ok, true, "errors" in result ? JSON.stringify(result.errors) : undefined);
  if (!result.ok) throw new Error("travel transition failed");
  return result as Extract<T, { ok: true }>;
}

function atContact(contactId: "contact:ashfall" | "contact:kepler", finalize = false): GalaxyRunState {
  const run = createFreshGalaxyRun();
  const preview = planRoute(run, { kind: "contact", contactId });
  assert.equal(preview.ok, true, preview.ok ? undefined : preview.reasons.join("; "));
  if (!preview.ok) throw new Error("route preview failed");
  const committed = requireTravelSuccess(commitTravel(run, preview.plan));
  const arrived = requireTravelSuccess(resumeTravelToBoundary(committed.galaxyRun));
  assert.equal(arrived.galaxyRun.activeTravel?.state, "arrived");
  return finalize
    ? requireTravelSuccess(finalizeTravel(arrived.galaxyRun)).galaxyRun
    : arrived.galaxyRun;
}

function atHostileInterruption(): GalaxyRunState {
  const run = createFreshGalaxyRun();
  const preview = planRoute(run, {
    kind: "contact",
    contactId: "contact:hostile-picket",
  });
  assert.equal(preview.ok, true, preview.ok ? undefined : preview.reasons.join("; "));
  if (!preview.ok) throw new Error("hostile route preview failed");
  const committed = requireTravelSuccess(commitTravel(run, preview.plan));
  const interrupted = requireTravelSuccess(resumeTravelToBoundary(committed.galaxyRun));
  assert.equal(interrupted.galaxyRun.activeTravel?.state, "interrupted");
  return interrupted.galaxyRun;
}

function richParent(run: GalaxyRunState): SaveData {
  const parent = startFreshGalaxy(migrateSave({
    currentWorld: 8,
    levels: { "1-1": { completed: true, stars: 3, highScore: 9999 } },
    completedQuests: ["q-reyes-1-1"],
    activeQuests: ["q-voss-1-2"],
    completedPlanets: ["ashfall"],
    unlockedSpecialMissions: ["kepler-black-box"],
    completedSpecialMissions: ["kepler-black-box"],
    storyItems: ["kepler-black-box"],
  }));
  return { ...parent, galaxyRun: run };
}

function requireAuthorization(run: GalaxyRunState, operationId: OperationId): OperationLaunchContext {
  const result = authorizeOperationLaunch(run, operationId);
  assert.equal(result.ok, true, result.ok ? undefined : result.availability.reasons.join("; "));
  if (!result.ok) throw new Error("operation was unexpectedly unavailable");
  return result.context;
}

test("G0 catalog is complete, located, serializable, and linked to fresh run records", () => {
  const run = createFreshGalaxyRun();
  const before = structuredClone(run);
  const result = listG0Operations(run);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.deepEqual(result.operations.map((operation) => operation.id), IDS);
  assert.equal(JSON.stringify(result.operations).includes("function"), false);
  assert.deepEqual(
    result.operations.map((operation) => ({
      id: operation.id,
      source: operation.source,
      location: operation.location,
      contactId: operation.contactId,
      issuerId: operation.issuerId,
      causeFactIds: operation.causeFactIds,
      objective: operation.objective,
      modifiers: operation.modifiers,
      phases: operation.phases,
      knownThreat: operation.knownThreat,
      costs: operation.costs,
      rewards: operation.rewards,
      availability: operation.availability,
      state: operation.state,
    })),
    result.operations,
  );
  for (const operation of result.operations) {
    assert.equal(operation.state, run.operations[operation.id].state);
    assert.equal(operation.costs.supply, 0);
    assert.equal(operation.costs.worldCycles, 1);
  }
  assert.deepEqual(run, before);
});

test("catalog snapshots pin G0 coordinates, causes, modes, adapters, and exact outcomes", () => {
  const result = listG0Operations(createFreshGalaxyRun());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const byId = Object.fromEntries(result.operations.map((operation) => [operation.id, operation]));

  assert.deepEqual(byId["op:hostile-picket"], {
    id: "op:hostile-picket",
    source: "systemic",
    location: coord(0, 0, 1280, 1024),
    contactId: "contact:hostile-picket",
    issuerId: null,
    causeFactIds: ["fact:picket-patrol-active"],
    objective: { kind: "intercept", targetId: "contact:hostile-picket", label: "Break the hostile picket" },
    modifiers: [{
      id: "modifier:q-reyes-1-1",
      kind: "side_quest",
      optional: true,
      questId: "q-reyes-1-1",
      name: "Quick Draw",
      description: "Clear 1-1 in under 60 seconds",
      offeredBy: "reyes",
      condition: { kind: "time_attack", metric: "frameCount", comparison: "at_most", value: 3600, unit: "frames" },
      reward: { credits: 200 },
    }],
    phases: [{
      id: "phase:hostile-picket:interception",
      mode: "shooter",
      objective: "destroy_hostile_wave",
      adapter: { kind: "legacy_level", world: 1, level: 1 },
    }],
    knownThreat: {
      confidence: "medium",
      dimensions: { military: "high", political: "low", environmental: "low", logistical: "moderate", anomalous: "low" },
    },
    costs: { supply: 0, worldCycles: 1 },
    rewards: {
      success: {
        supply: 2, credits: 0, pilotXp: 100, storyItemIds: [],
        knowledge: [{ subjectId: "contact:hostile-picket", state: "visited", confidence: "high" }],
        accessFactIds: ["access:picket-cleared"], historyKinds: ["hostile_picket_cleared"],
        missionDelivery: null, travelResolution: "cleared", strandedAt: null, returnToOrigin: false,
      },
      failure: {
        supply: 0, credits: 0, pilotXp: 0, storyItemIds: [], knowledge: [], accessFactIds: [],
        historyKinds: ["hostile_picket_failed"], missionDelivery: null, travelResolution: "failed",
        strandedAt: coord(0, 0, 1280, 1024), returnToOrigin: false,
      },
      retreat: {
        supply: 0, credits: 0, pilotXp: 0, storyItemIds: [], knowledge: [], accessFactIds: [],
        historyKinds: ["hostile_picket_retreated"], missionDelivery: null, travelResolution: "retreated",
        strandedAt: null, returnToOrigin: true,
      },
    },
    availability: { status: "unavailable", recoverable: true, reasons: ["missing_active_interruption"] },
    state: "available",
  });

  assert.deepEqual(byId["op:kepler-black-box"], {
    id: "op:kepler-black-box",
    source: "exploration",
    location: coord(0, 0, 2048, 1024),
    contactId: "contact:kepler",
    issuerId: null,
    causeFactIds: ["fact:kepler-recorder-signal"],
    objective: { kind: "recover", targetId: "kepler-black-box", label: "Recover the Kepler black box" },
    modifiers: [],
    phases: [{ id: "phase:kepler:black-box", mode: "first-person", objective: "recover_black_box", adapter: { kind: "special_mission", missionId: "kepler-black-box" } }],
    knownThreat: { confidence: "medium", dimensions: { military: "low", political: "low", environmental: "moderate", logistical: "low", anomalous: "moderate" } },
    costs: { supply: 0, worldCycles: 1 },
    rewards: {
      success: { supply: 0, credits: 200, pilotXp: 100, storyItemIds: ["kepler-black-box"], knowledge: [{ subjectId: "contact:kepler", state: "visited", confidence: "high" }], accessFactIds: [], historyKinds: ["kepler_black_box_recovered"], missionDelivery: null, travelResolution: "none", strandedAt: null, returnToOrigin: false },
      failure: { supply: 0, credits: 0, pilotXp: 0, storyItemIds: [], knowledge: [], accessFactIds: [], historyKinds: ["kepler_black_box_failed"], missionDelivery: null, travelResolution: "none", strandedAt: null, returnToOrigin: false },
      retreat: { supply: 0, credits: 0, pilotXp: 0, storyItemIds: [], knowledge: [], accessFactIds: [], historyKinds: ["kepler_black_box_retreated"], missionDelivery: null, travelResolution: "none", strandedAt: null, returnToOrigin: false },
    },
    availability: { status: "unavailable", recoverable: true, reasons: ["contact_not_visited", "wrong_location"] },
    state: "available",
  });

  assert.deepEqual(byId["op:ashfall-sortie"], {
    id: "op:ashfall-sortie",
    source: "story",
    location: coord(0, 0, 1024, 512),
    contactId: "contact:ashfall",
    issuerId: null,
    causeFactIds: ["fact:ashfall-distress"],
    objective: { kind: "sortie", targetId: "ashfall", label: "Secure the Ashfall distress zone" },
    modifiers: [],
    phases: [{ id: "phase:ashfall:sortie", mode: "shooter", objective: "complete_desert_mission", adapter: { kind: "planet_mission", planetId: "ashfall" } }],
    knownThreat: { confidence: "high", dimensions: { military: "low", political: "low", environmental: "moderate", logistical: "low", anomalous: "low" } },
    costs: { supply: 0, worldCycles: 1 },
    rewards: {
      success: { supply: 0, credits: 0, pilotXp: 75, storyItemIds: [], knowledge: [{ subjectId: "contact:ashfall", state: "visited", confidence: "high" }], accessFactIds: [], historyKinds: ["ashfall_sortie_complete"], missionDelivery: { planetId: "ashfall", colonyId: "galaxy:ashfall-primary", reason: "mission_delivery" }, travelResolution: "none", strandedAt: null, returnToOrigin: false },
      failure: { supply: 0, credits: 0, pilotXp: 0, storyItemIds: [], knowledge: [], accessFactIds: [], historyKinds: ["ashfall_sortie_failed"], missionDelivery: null, travelResolution: "none", strandedAt: null, returnToOrigin: false },
      retreat: { supply: 0, credits: 0, pilotXp: 0, storyItemIds: [], knowledge: [], accessFactIds: [], historyKinds: ["ashfall_sortie_retreated"], missionDelivery: null, travelResolution: "none", strandedAt: null, returnToOrigin: false },
    },
    availability: { status: "unavailable", recoverable: true, reasons: ["contact_not_visited", "wrong_location"] },
    state: "available",
  });
});

test("Quick Draw adapts the stable condition and reward but ignores legacy quest gates", () => {
  const run = atHostileInterruption();
  const operation = getOperation(run, "op:hostile-picket");
  assert.equal(operation.ok, true);
  if (!operation.ok) return;
  assert.equal(operation.operation.availability.status, "available");
  assert.deepEqual(operation.operation.modifiers[0], {
    id: "modifier:q-reyes-1-1", kind: "side_quest", optional: true, questId: "q-reyes-1-1",
    name: "Quick Draw", description: "Clear 1-1 in under 60 seconds", offeredBy: "reyes",
    condition: { kind: "time_attack", metric: "frameCount", comparison: "at_most", value: 3600, unit: "frames" },
    reward: { credits: 200 },
  });

  const projection = projectGalaxyRunToLegacySave(richParent(run));
  projection.levels = {};
  projection.completedQuests = [];
  projection.activeQuests = [];
  const launched = launchOperation(run, projection, requireAuthorization(run, "op:hostile-picket"));
  assert.equal(launched.ok, true, launched.ok ? undefined : launched.availability.reasons.join("; "));
  const modifier = operation.operation.modifiers[0];
  assert.deepEqual(evaluateOperationModifier(modifier, { frameCount: 3600 }), { met: true, credits: 200 });
  assert.deepEqual(evaluateOperationModifier(modifier, { frameCount: 3601 }), { met: false, credits: 0 });
});

test("arbitrary legacy saves cannot masquerade as an engine projection", () => {
  const run = atContact("contact:ashfall", true);
  const legacy = migrateSave({
    currentWorld: 8,
    levels: { "1-1": { completed: true, stars: 3, highScore: 9999 } },
    completedQuests: ["q-reyes-1-1"],
  });
  const result = launchOperation(run, legacy, requireAuthorization(run, "op:ashfall-sortie"));
  assert.equal(result.ok, false);
  if (!result.ok) assert.deepEqual(result.availability.reasons, ["projection_not_locked"]);
});

test("projection validation cannot be bypassed by live upgrades or toJSON", () => {
  const run = atHostileInterruption();
  const projection = projectGalaxyRunToLegacySave(richParent(run));
  let toJSONReads = 0;
  projection.upgrades = {
    ...projection.upgrades,
    hullPlating: 999,
    toJSON() {
      toJSONReads += 1;
      return structuredClone(run.ship.upgrades);
    },
  } as typeof projection.upgrades;

  const result = launchOperation(
    run,
    projection,
    requireAuthorization(run, "op:hostile-picket"),
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(result.availability.reasons, ["projection_not_locked"]);
  }
  assert.equal(toJSONReads, 0);
});

test("explicit canonical launch contexts bypass all locked legacy availability fields", () => {
  const fixtures: Array<[OperationId, GalaxyRunState, string, number, number]> = [
    ["op:hostile-picket", atHostileInterruption(), "shooter", 1, 1],
    ["op:kepler-black-box", atContact("contact:kepler"), "first-person", 4, 2],
    ["op:ashfall-sortie", atContact("contact:ashfall", true), "shooter", 6, 1],
  ];

  for (const [operationId, run, mode, world, level] of fixtures) {
    const projection = projectGalaxyRunToLegacySave(richParent(run));
    assert.deepEqual(projection.levels, {});
    assert.deepEqual(projection.completedPlanets, []);
    assert.deepEqual(projection.unlockedSpecialMissions, []);
    assert.deepEqual(projection.completedSpecialMissions, []);
    assert.deepEqual(projection.completedQuests, []);
    assert.deepEqual(projection.activeQuests, []);
    const context = requireAuthorization(run, operationId);
    const launched = launchOperation(run, projection, context);
    assert.equal(launched.ok, true, launched.ok ? undefined : launched.availability.reasons.join("; "));
    if (!launched.ok) continue;
    assert.equal(launched.context.operationId, operationId);
    assert.equal(launched.gameState.currentMode, mode);
    assert.equal(launched.gameState.currentWorld, world);
    assert.equal(launched.gameState.currentLevel, level);
    if (operationId === "op:ashfall-sortie") assert.equal(launched.gameState.planetId, "ashfall");
  }
});

test("Kepler objective provenance comes only from canonical galaxy story items", () => {
  const unrecovered = atContact("contact:kepler");
  const legacyRich = projectGalaxyRunToLegacySave(richParent(unrecovered));
  legacyRich.storyItems = ["kepler-black-box"];
  legacyRich.completedSpecialMissions = ["kepler-black-box"];
  const first = launchOperation(unrecovered, legacyRich, requireAuthorization(unrecovered, "op:kepler-black-box"));
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.gameState.firstPersonState?.objectivePickup?.label, "KEPLER BLACK BOX");

  const recovered = structuredClone(unrecovered);
  recovered.storyItems = ["kepler-black-box"];
  const lockedProjection = projectGalaxyRunToLegacySave(richParent(recovered));
  lockedProjection.storyItems = [];
  lockedProjection.completedSpecialMissions = [];
  const replay = launchOperation(recovered, lockedProjection, requireAuthorization(recovered, "op:kepler-black-box"));
  assert.equal(replay.ok, true);
  if (!replay.ok) return;
  assert.equal(replay.gameState.firstPersonState?.objectivePickup, undefined);
});

test("availability requires canonical physical location or the exact active interruption", () => {
  const fresh = createFreshGalaxyRun();
  for (const id of IDS) {
    assert.equal(authorizeOperationLaunch(fresh, id).ok, false);
  }

  for (const [id, run] of [
    ["op:hostile-picket", atHostileInterruption()],
    ["op:kepler-black-box", atContact("contact:kepler")],
    ["op:kepler-black-box", atContact("contact:kepler", true)],
    ["op:ashfall-sortie", atContact("contact:ashfall")],
    ["op:ashfall-sortie", atContact("contact:ashfall", true)],
  ] as const) {
    assert.equal(authorizeOperationLaunch(run, id).ok, true);
  }

  const wrongLocation = atContact("contact:ashfall", true);
  assert.equal(authorizeOperationLaunch(wrongLocation, "op:kepler-black-box").ok, false);
  const fakeHostile = structuredClone(atHostileInterruption());
  fakeHostile.activeTravel!.interruptionOperationId = "op:ashfall-sortie";
  assert.equal(authorizeOperationLaunch(fakeHostile, "op:hostile-picket").ok, false);
});

test("cause, contact, access, state, and unique history gates fail closed", () => {
  const cases: GalaxyRunState[] = [];
  const missingCause = atContact("contact:kepler", true);
  missingCause.historyFacts = missingCause.historyFacts.filter((fact) => fact.id !== "fact:kepler-recorder-signal");
  cases.push(missingCause);
  const missingContact = atContact("contact:kepler", true);
  for (const key of Object.keys(missingContact.atlas.materializedFacts)) {
    if (missingContact.atlas.materializedFacts[key].contactId === "contact:kepler") delete missingContact.atlas.materializedFacts[key];
  }
  cases.push(missingContact);
  const denied = atContact("contact:kepler", true);
  denied.atlas.accessFacts.push({ id: "access:kepler-denied", subjectId: "contact:kepler", assessment: "denied", causeFactIds: [], cycle: denied.worldCycle });
  cases.push(denied);
  const complete = atContact("contact:kepler", true);
  complete.operations["op:kepler-black-box"].state = "complete";
  cases.push(complete);
  const historical = atContact("contact:kepler", true);
  historical.historyFacts.push({ id: "completion:kepler", kind: "operation_complete", subjectId: "op:kepler-black-box", cycle: historical.worldCycle, causeFactIds: ["fact:kepler-recorder-signal"] });
  historical.operations["op:kepler-black-box"].completionIds = ["completion:kepler"];
  cases.push(historical);
  const duplicateContact = atContact("contact:kepler", true);
  const originalContact = Object.values(duplicateContact.atlas.materializedFacts).find(
    (fact) => fact.contactId === "contact:kepler",
  )!;
  duplicateContact.atlas.materializedFacts["duplicate:kepler"] = {
    ...structuredClone(originalContact),
    id: "contact:kepler-duplicate",
  };
  cases.push(duplicateContact);

  for (const run of cases) {
    const result = authorizeOperationLaunch(run, "op:kepler-black-box");
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.availability.recoverable, true);
  }

  const clearedCause = atHostileInterruption();
  clearedCause.atlas.accessFacts.push({
    id: "access:picket-cleared",
    subjectId: "contact:hostile-picket",
    assessment: "secured",
    causeFactIds: ["fact:picket-patrol-active"],
    cycle: clearedCause.worldCycle,
  });
  const clearedResult = authorizeOperationLaunch(clearedCause, "op:hostile-picket");
  assert.equal(clearedResult.ok, false);
  if (!clearedResult.ok) assert.ok(clearedResult.availability.reasons.includes("cause_resolved"));
});

test("unknown, malformed, accessor, and prototype inputs return recoverable unavailable copies", () => {
  const run = atContact("contact:kepler", true);
  const unknown = authorizeOperationLaunch(run, "op:unknown" as OperationId);
  assert.equal(unknown.ok, false);
  if (!unknown.ok) {
    assert.equal(unknown.operation, null);
    assert.deepEqual(unknown.availability.reasons, ["unknown_operation"]);
  }

  const malformed = structuredClone(run) as GalaxyRunState;
  malformed.operations["op:kepler-black-box"] = { state: "paused" } as never;
  const malformedResult = authorizeOperationLaunch(malformed, "op:kepler-black-box");
  assert.equal(malformedResult.ok, false);
  if (!malformedResult.ok) {
    assert.equal(malformedResult.operation?.id, "op:kepler-black-box");
    assert.equal(malformedResult.availability.recoverable, true);
  }

  const missingRecord = structuredClone(run);
  delete missingRecord.operations["op:kepler-black-box"];
  const missingRecordResult = authorizeOperationLaunch(missingRecord, "op:kepler-black-box");
  assert.equal(missingRecordResult.ok, false);
  if (!missingRecordResult.ok) {
    assert.equal(missingRecordResult.operation?.id, "op:kepler-black-box");
    assert.deepEqual(missingRecordResult.availability.reasons, ["missing_operation_record"]);
  }

  const inheritedOperations = structuredClone(run);
  inheritedOperations.operations = Object.create(inheritedOperations.operations);
  assert.equal(authorizeOperationLaunch(inheritedOperations, "op:kepler-black-box").ok, false);

  const accessor = structuredClone(run);
  Object.defineProperty(accessor.vessel, "contactId", { enumerable: true, get() { throw new Error("must not execute"); } });
  assert.doesNotThrow(() => authorizeOperationLaunch(accessor, "op:kepler-black-box"));
  assert.equal(authorizeOperationLaunch(accessor, "op:kepler-black-box").ok, false);

  const projection = projectGalaxyRunToLegacySave(richParent(run));
  const context = requireAuthorization(run, "op:kepler-black-box");
  const badContext = { ...context, adapterKind: "legacy_level" } as OperationLaunchContext;
  assert.equal(launchOperation(run, projection, badContext).ok, false);
});

test("public availability paths contain delayed Proxy reads after descriptor validation", () => {
  const source = atHostileInterruption();
  const before = structuredClone(source);
  function trappedRun(): GalaxyRunState {
    const reads = new Map<PropertyKey, number>();
    return new Proxy(source, {
      get(target, key, receiver) {
        const count = (reads.get(key) ?? 0) + 1;
        reads.set(key, count);
        if ((key === "atlas" || key === "vessel") && count >= 2) {
          throw new Error(`delayed ${String(key)} trap`);
        }
        return Reflect.get(target, key, receiver);
      },
    });
  }

  let getResult!: ReturnType<typeof getOperation>;
  assert.doesNotThrow(() => {
    getResult = getOperation(trappedRun(), "op:hostile-picket");
  });
  assert.equal(getResult.ok, false);
  if (!getResult.ok) assert.deepEqual(getResult.availability.reasons, ["malformed_run"]);

  let listResult!: ReturnType<typeof listG0Operations>;
  assert.doesNotThrow(() => {
    listResult = listG0Operations(trappedRun());
  });
  assert.equal(listResult.ok, false);
  if (!listResult.ok) assert.deepEqual(listResult.availability.reasons, ["malformed_run"]);

  let authorizeResult!: ReturnType<typeof authorizeOperationLaunch>;
  assert.doesNotThrow(() => {
    authorizeResult = authorizeOperationLaunch(trappedRun(), "op:hostile-picket");
  });
  assert.equal(authorizeResult.ok, false);
  if (!authorizeResult.ok) {
    assert.equal(authorizeResult.operation?.id, "op:hostile-picket");
    assert.deepEqual(authorizeResult.availability.reasons, ["malformed_run"]);
  }
  assert.deepEqual(source, before);
});

test("hostile launch binds the saved target and destination but permits its exact fixed cell", () => {
  const rebound = atHostileInterruption();
  rebound.activeTravel!.targetId = "contact:ashfall";
  rebound.activeTravel!.destination = coord(0, 0, 1024, 512);
  rebound.activeTravel!.legs[rebound.activeTravel!.legs.length - 1].to = coord(0, 0, 1024, 512);
  const reboundBefore = structuredClone(rebound);
  const rejected = authorizeOperationLaunch(rebound, "op:hostile-picket");
  assert.equal(rejected.ok, false);
  assert.deepEqual(rebound, reboundBefore);

  const sameCellRun = createFreshGalaxyRun();
  const target = coord(0, 0, 1281, 1025);
  const preview = planRoute(sameCellRun, { kind: "coordinate", coordinate: target });
  assert.equal(preview.ok, true, preview.ok ? undefined : preview.reasons.join("; "));
  if (!preview.ok) return;
  const committed = requireTravelSuccess(commitTravel(sameCellRun, preview.plan));
  const interrupted = requireTravelSuccess(resumeTravelToBoundary(committed.galaxyRun));
  assert.equal(interrupted.galaxyRun.activeTravel?.state, "interrupted");
  assert.equal(interrupted.galaxyRun.activeTravel?.targetId, null);
  assert.deepEqual(interrupted.galaxyRun.vessel.coordinate, target);
  assert.equal(authorizeOperationLaunch(interrupted.galaxyRun, "op:hostile-picket").ok, true);
});

test("launch snapshots own context data once and cannot drift through getters or toJSON", () => {
  const run = atHostileInterruption();
  const projection = projectGalaxyRunToLegacySave(richParent(run));
  const canonical = requireAuthorization(run, "op:hostile-picket");
  const target = structuredClone(canonical);
  let operationReads = 0;
  let toJSONReads = 0;
  const drifting = new Proxy(target, {
    get(object, key, receiver) {
      if (key === "toJSON") {
        toJSONReads += 1;
        return () => structuredClone(canonical);
      }
      if (key === "operationId") {
        operationReads += 1;
        return operationReads === 1 ? "op:hostile-picket" : "op:kepler-black-box";
      }
      if (key === "adapterKind") return "special_mission";
      if (key === "adapterPayload") {
        return { kind: "special_mission", missionId: "kepler-black-box" };
      }
      return Reflect.get(object, key, receiver);
    },
  }) as OperationLaunchContext;

  let launch!: ReturnType<typeof launchOperation>;
  assert.doesNotThrow(() => {
    launch = launchOperation(run, projection, drifting);
  });
  assert.equal(launch.ok, true, launch.ok ? undefined : launch.availability.reasons.join("; "));
  if (launch.ok) {
    assert.equal(launch.context.operationId, "op:hostile-picket");
    assert.equal(launch.context.adapterKind, "legacy_level");
    assert.equal(launch.gameState.currentMode, "shooter");
    assert.equal(launch.gameState.currentWorld, 1);
    assert.equal(launch.gameState.currentLevel, 1);
  }
  assert.equal(operationReads, 0);
  assert.equal(toJSONReads, 0);
  assert.deepEqual(target, canonical);

  let accessorReads = 0;
  const accessor = structuredClone(canonical);
  Object.defineProperty(accessor, "operationId", {
    enumerable: true,
    get() {
      accessorReads += 1;
      return "op:hostile-picket";
    },
  });
  let rejected!: ReturnType<typeof launchOperation>;
  assert.doesNotThrow(() => {
    rejected = launchOperation(run, projection, accessor);
  });
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.availability.recoverable, true);
  assert.equal(accessorReads, 0);
});

test("contexts and adapter payloads are stable, exhaustive, non-mutating authority", () => {
  const fixtures: Array<[OperationId, GalaxyRunState]> = [
    ["op:hostile-picket", atHostileInterruption()],
    ["op:kepler-black-box", atContact("contact:kepler", true)],
    ["op:ashfall-sortie", atContact("contact:ashfall", true)],
  ];
  for (const [id, run] of fixtures) {
    const before = structuredClone(run);
    const one = requireAuthorization(run, id);
    const two = requireAuthorization(run, id);
    assert.deepEqual(one, two);
    const operation = getOperation(run, id);
    assert.equal(operation.ok, true);
    if (!operation.ok) continue;
    assert.deepEqual(one.adapterKind, operation.operation.phases[0].adapter.kind);
    assert.deepEqual(one.adapterPayload, operation.operation.phases[0].adapter);
    const projection = projectGalaxyRunToLegacySave(richParent(run));
    const projectionBefore = structuredClone(projection);
    const launch = launchOperation(run, projection, one);
    assert.equal(launch.ok, true);
    assert.deepEqual(run, before);
    assert.deepEqual(projection, projectionBefore);
    assert.deepEqual(one, two);
  }
});

test("operation modules import without window or document globals", async () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  try {
    Reflect.deleteProperty(globalThis, "window");
    Reflect.deleteProperty(globalThis, "document");
    await assert.doesNotReject(import("../../app/components/engine/operations/operationCatalog"));
    await assert.doesNotReject(import("../../app/components/engine/operations/operationAdapters"));
  } finally {
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument);
  }
});

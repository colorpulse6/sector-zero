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
import {
  prepareGalaxyPoiCompletion,
  resolveGalaxyPoiCompletion,
  startGalaxyRegionExpedition,
  launchOperation,
} from "../../app/components/engine/operations/operationAdapters";
import type {
  OperationId,
  OperationLaunchContext,
} from "../../app/components/engine/operations/operationTypes";
import { migrateSave } from "../../app/components/engine/save";
import { GameScreen, type SaveData } from "../../app/components/engine/types";
import { MAX_PILOT_LEVEL } from "../../app/components/engine/pilotLevel";
import {
  operationMissionDescriptor,
  retryLaunchContext,
} from "../../app/components/engine/missionContext";

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

test("validated Galaxy loadout is a single snapshot and never re-reads the caller projection", () => {
  const run = atHostileInterruption();
  const projection = projectGalaxyRunToLegacySave(richParent(run));
  let lateReads = 0;
  const unstable = new Proxy(projection, {
    get(target, property, receiver) {
      if (property === "equippedWeaponType") {
        lateReads += 1;
        return "cryogenic";
      }
      if (property === "equippedConsumables") {
        lateReads += 1;
        return ["shield-charge"];
      }
      if (property === "consumableInventory") {
        lateReads += 1;
        return { "shield-charge": 99 };
      }
      return Reflect.get(target, property, receiver);
    },
  });

  const result = launchOperation(
    run,
    unstable,
    requireAuthorization(run, "op:hostile-picket"),
  );

  assert.equal(result.ok, true, result.ok ? undefined : result.availability.reasons.join("; "));
  if (!result.ok) return;
  assert.equal(lateReads, 0);
  assert.equal(result.gameState.equippedWeaponType, run.ship.equippedWeaponType);
  assert.deepEqual(result.gameState.pilotLoadout.equippedConsumables, run.ship.equippedConsumables);
  assert.deepEqual(result.gameState.pilotLoadout.consumableInventory, run.ship.consumableInventory);
});

test("operation retries accept a separate issued gameplay context and preserve its pilot snapshot", () => {
  const run = atHostileInterruption();
  run.ship.equippedWeaponType = "energy";
  run.ship.equippedConsumables = ["scanner-pulse"];
  run.ship.consumableInventory = { "scanner-pulse": 2 };
  const authorization = requireAuthorization(run, "op:hostile-picket");
  const first = launchOperation(
    run,
    projectGalaxyRunToLegacySave(richParent(run)),
    authorization,
    () => "launch:test:operation-retry-source",
  );
  assert.equal(first.ok, true, first.ok ? undefined : first.availability.reasons.join("; "));
  if (!first.ok || first.gameState.launchContext === undefined) return;
  const retry = retryLaunchContext(
    first.gameState.launchContext,
    () => "launch:test:operation-retry-child",
  );

  const changedRun = structuredClone(run);
  changedRun.ship.equippedWeaponType = "cryogenic";
  changedRun.ship.equippedConsumables = ["hull-repair"];
  changedRun.ship.consumableInventory = { "hull-repair": 1 };

  const injectedRetry = retryLaunchContext(
    first.gameState.launchContext,
    () => "launch:test:operation-retry-injected",
  );
  injectedRetry.pilot.equippedWeaponType = "incendiary";
  injectedRetry.pilot.equippedConsumables = ["weapon-overcharge"];
  injectedRetry.pilot.consumableInventory = { "weapon-overcharge": 99 };
  const rejectedInjection = launchOperation(
    changedRun,
    projectGalaxyRunToLegacySave(richParent(changedRun)),
    authorization,
    injectedRetry,
  );
  assert.equal(rejectedInjection.ok, false);
  if (!rejectedInjection.ok) {
    assert.deepEqual(rejectedInjection.availability.reasons, ["context_mismatch"]);
  }

  const retried = launchOperation(
    changedRun,
    projectGalaxyRunToLegacySave(richParent(changedRun)),
    authorization,
    retry,
  );

  assert.equal(retried.ok, true, retried.ok ? undefined : retried.availability.reasons.join("; "));
  if (!retried.ok) return;
  assert.equal(retried.context.operationId, authorization.operationId);
  assert.equal(retried.gameState.launchContext?.launchId, retry.launchId);
  assert.equal(retried.gameState.launchContext?.entryProvenance, "retry");
  assert.equal(retried.gameState.equippedWeaponType, "energy");
  assert.deepEqual(retried.gameState.pilotLoadout.equippedConsumables, ["scanner-pulse"]);
  assert.deepEqual(retried.gameState.pilotLoadout.consumableInventory, { "scanner-pulse": 2 });

  const wrongMission = retryLaunchContext(
    first.gameState.launchContext,
    () => "launch:test:operation-retry-wrong-mission",
  );
  wrongMission.mission = operationMissionDescriptor("op:ashfall-sortie");
  const rejectedMission = launchOperation(
    changedRun,
    projectGalaxyRunToLegacySave(richParent(changedRun)),
    authorization,
    wrongMission,
  );
  assert.equal(rejectedMission.ok, false);
  if (!rejectedMission.ok) {
    assert.deepEqual(rejectedMission.availability.reasons, ["context_mismatch"]);
  }

  const rejectedProvenance = launchOperation(
    changedRun,
    projectGalaxyRunToLegacySave(richParent(changedRun)),
    authorization,
    first.gameState.launchContext,
  );
  assert.equal(rejectedProvenance.ok, false);
  if (!rejectedProvenance.ok) {
    assert.deepEqual(rejectedProvenance.availability.reasons, ["context_mismatch"]);
  }
});

test("locked projection tolerates unrelated future own data fields without weakening consumed shapes", () => {
  const run = atHostileInterruption();
  const projection = Object.assign(
    projectGalaxyRunToLegacySave(richParent(run)),
    { saveRevision: 7, appliedOutcomeIds: ["outcome:prior"] },
  );

  const result = launchOperation(
    run,
    projection,
    requireAuthorization(run, "op:hostile-picket"),
  );

  assert.equal(result.ok, true, result.ok ? undefined : result.availability.reasons.join("; "));
});

test("locked projections reject matching but impossible PilotLoadout domain values", () => {
  const cases: Array<[
    string,
    (run: GalaxyRunState, projection: SaveData) => void,
  ]> = [
    ["upgrade above authored cap", (run, projection) => {
      run.ship.upgrades.hullPlating = 6;
      projection.upgrades.hullPlating = 6;
    }],
    ["fractional upgrade", (run, projection) => {
      run.ship.upgrades.weaponCore = 1.5;
      projection.upgrades.weaponCore = 1.5;
    }],
    ["pilot below level one", (run, projection) => {
      run.pilot.level = 0;
      projection.pilotLevel = 0;
    }],
    ["pilot above authored maximum", (run, projection) => {
      run.pilot.level = MAX_PILOT_LEVEL + 1;
      projection.pilotLevel = MAX_PILOT_LEVEL + 1;
    }],
    ["unknown enhancement", (run, projection) => {
      run.ship.unlockedEnhancements = ["future-enhancement" as never];
      projection.unlockedEnhancements = ["future-enhancement" as never];
    }],
    ["duplicate enhancement", (run, projection) => {
      run.ship.unlockedEnhancements = ["reinforced-shield", "reinforced-shield"];
      projection.unlockedEnhancements = ["reinforced-shield", "reinforced-shield"];
    }],
    ["unknown skill", (run, projection) => {
      run.pilot.allocatedSkills = ["future-skill" as never];
      projection.allocatedSkills = ["future-skill" as never];
    }],
    ["duplicate skill", (run, projection) => {
      run.pilot.allocatedSkills = ["sharpshooter", "sharpshooter"];
      projection.allocatedSkills = ["sharpshooter", "sharpshooter"];
    }],
    ["missing skill prerequisite", (run, projection) => {
      run.pilot.allocatedSkills = ["berserker"];
      projection.allocatedSkills = ["berserker"];
    }],
    ["unknown weapon", (run, projection) => {
      run.ship.equippedWeaponType = "future-weapon" as never;
      projection.equippedWeaponType = "future-weapon" as never;
    }],
    ["unknown equipped consumable", (run, projection) => {
      run.ship.equippedConsumables = ["future-consumable" as never];
      projection.equippedConsumables = ["future-consumable" as never];
    }],
    ["duplicate equipped consumable", (run, projection) => {
      run.ship.equippedConsumables = ["hull-repair", "hull-repair"];
      projection.equippedConsumables = ["hull-repair", "hull-repair"];
    }],
    ["unknown inventory key", (run, projection) => {
      (run.ship.consumableInventory as Record<string, number>)["future-consumable"] = 1;
      (projection.consumableInventory as Record<string, number>)["future-consumable"] = 1;
    }],
    ["negative inventory quantity", (run, projection) => {
      run.ship.consumableInventory = { "hull-repair": -1 };
      projection.consumableInventory = { "hull-repair": -1 };
    }],
    ["fractional inventory quantity", (run, projection) => {
      run.ship.consumableInventory = { "hull-repair": 1.5 };
      projection.consumableInventory = { "hull-repair": 1.5 };
    }],
  ];

  for (const [label, mutate] of cases) {
    const run = atHostileInterruption();
    const authorization = requireAuthorization(run, "op:hostile-picket");
    const projection = projectGalaxyRunToLegacySave(richParent(run));
    mutate(run, projection);
    const result = launchOperation(run, projection, authorization);
    assert.equal(result.ok, false, label);
    if (!result.ok) assert.deepEqual(result.availability.reasons, ["projection_not_locked"], label);
  }
});

test("Galaxy Region and POI boundaries preserve unrelated future save-root data", () => {
  const parent = Object.assign(
    richParent(atContact("contact:ashfall", true)),
    { saveRevision: 7, appliedOutcomeIds: ["outcome:prior"] },
  );
  const originColonyId = "galaxy:ashfall-primary";
  const targetNodeId = "ashfall-cinder-relay";
  const surveyed = startGalaxyRegionExpedition(
    parent,
    "contact:ashfall",
    { kind: "survey", originColonyId, targetNodeId },
    null,
  );
  assert.equal(surveyed.ok, true, surveyed.ok ? undefined : surveyed.reason);
  if (!surveyed.ok) return;
  assert.equal((surveyed.save as SaveData & { saveRevision: number }).saveRevision, 7);
  assert.deepEqual(
    (surveyed.save as SaveData & { appliedOutcomeIds: string[] }).appliedOutcomeIds,
    ["outcome:prior"],
  );

  const launched = startGalaxyRegionExpedition(
    surveyed.save,
    "contact:ashfall",
    { kind: "poi", originColonyId, targetNodeId },
    null,
  );
  assert.equal(launched.ok, true, launched.ok ? undefined : launched.reason);
  if (!launched.ok || launched.session === null) return;
  const prepared = prepareGalaxyPoiCompletion(
    launched.save,
    "contact:ashfall",
    { originColonyId, session: launched.session },
    GameScreen.LEVEL_COMPLETE,
  );
  assert.equal(prepared.ok, true, prepared.ok ? undefined : prepared.reason);
  if (!prepared.ok) return;
  const resolved = resolveGalaxyPoiCompletion(
    prepared.save,
    "contact:ashfall",
    prepared.pending,
    originColonyId,
  );
  assert.equal(resolved.ok, true, resolved.ok ? undefined : resolved.reason);
  if (!resolved.ok) return;
  assert.equal((resolved.save as SaveData & { saveRevision: number }).saveRevision, 7);
  assert.deepEqual(
    (resolved.save as SaveData & { appliedOutcomeIds: string[] }).appliedOutcomeIds,
    ["outcome:prior"],
  );
});

test("Galaxy Region and POI reject reflective future root fields without invoking them", () => {
  const request = {
    kind: "survey" as const,
    originColonyId: "galaxy:ashfall-primary",
    targetNodeId: "ashfall-cinder-relay",
  };
  let getterReads = 0;
  const accessorSave = richParent(atContact("contact:ashfall", true));
  Object.defineProperty(accessorSave, "futureAccessor", {
    enumerable: true,
    get() {
      getterReads += 1;
      return "unsafe";
    },
  });
  const accessorResult = startGalaxyRegionExpedition(
    accessorSave,
    "contact:ashfall",
    request,
    null,
  );
  assert.equal(accessorResult.ok, false);
  if (!accessorResult.ok) assert.equal(accessorResult.reason, "malformed_save");
  assert.equal(getterReads, 0);

  let functionCalls = 0;
  const functionSave = Object.assign(richParent(atContact("contact:ashfall", true)), {
    futureFunction() {
      functionCalls += 1;
      return "unsafe";
    },
  });
  const functionResult = startGalaxyRegionExpedition(
    functionSave,
    "contact:ashfall",
    request,
    null,
  );
  assert.equal(functionResult.ok, false);
  if (!functionResult.ok) assert.equal(functionResult.reason, "malformed_save");
  assert.equal(functionCalls, 0);

  const surveyed = startGalaxyRegionExpedition(
    richParent(atContact("contact:ashfall", true)),
    "contact:ashfall",
    request,
    null,
  );
  assert.equal(surveyed.ok, true, surveyed.ok ? undefined : surveyed.reason);
  if (!surveyed.ok) return;
  const launched = startGalaxyRegionExpedition(
    surveyed.save,
    "contact:ashfall",
    { ...request, kind: "poi" },
    null,
  );
  assert.equal(launched.ok, true, launched.ok ? undefined : launched.reason);
  if (!launched.ok || launched.session === null) return;
  const prepared = prepareGalaxyPoiCompletion(
    launched.save,
    "contact:ashfall",
    { originColonyId: request.originColonyId, session: launched.session },
    GameScreen.LEVEL_COMPLETE,
  );
  assert.equal(prepared.ok, true, prepared.ok ? undefined : prepared.reason);
  if (!prepared.ok) return;
  let pendingGetterReads = 0;
  Object.defineProperty(prepared.pending.baseSave, "futurePendingAccessor", {
    enumerable: true,
    get() {
      pendingGetterReads += 1;
      return "unsafe";
    },
  });
  const pendingResult = resolveGalaxyPoiCompletion(
    prepared.save,
    "contact:ashfall",
    prepared.pending,
    request.originColonyId,
  );
  assert.equal(pendingResult.ok, false);
  if (!pendingResult.ok) assert.equal(pendingResult.reason, "invalid_poi_session");
  assert.equal(pendingGetterReads, 0);
});

test("Galaxy POI resolution treats nested future root data as opaque without invoking it", () => {
  let accessorReads = 0;
  let functionCalls = 0;
  const futureOpaque = {} as Record<string, unknown>;
  Object.defineProperty(futureOpaque, "aAccessor", {
    enumerable: true,
    get() {
      accessorReads += 1;
      return "canonical";
    },
  });
  Object.defineProperty(futureOpaque, "zFunction", {
    enumerable: true,
    value() {
      functionCalls += 1;
      return "canonical";
    },
  });
  const parent = Object.assign(
    richParent(atContact("contact:ashfall", true)),
    { futureOpaque },
  );
  const originColonyId = "galaxy:ashfall-primary";
  const targetNodeId = "ashfall-cinder-relay";
  const surveyed = startGalaxyRegionExpedition(
    parent,
    "contact:ashfall",
    { kind: "survey", originColonyId, targetNodeId },
    null,
  );
  assert.equal(surveyed.ok, true, surveyed.ok ? undefined : surveyed.reason);
  if (!surveyed.ok) return;
  assert.strictEqual(
    (surveyed.save as SaveData & { futureOpaque: object }).futureOpaque,
    futureOpaque,
  );
  const launched = startGalaxyRegionExpedition(
    surveyed.save,
    "contact:ashfall",
    { kind: "poi", originColonyId, targetNodeId },
    null,
  );
  assert.equal(launched.ok, true, launched.ok ? undefined : launched.reason);
  if (!launched.ok || launched.session === null) return;
  const prepared = prepareGalaxyPoiCompletion(
    launched.save,
    "contact:ashfall",
    { originColonyId, session: launched.session },
    GameScreen.LEVEL_COMPLETE,
  );
  assert.equal(prepared.ok, true, prepared.ok ? undefined : prepared.reason);
  if (!prepared.ok) return;

  const aliasOpaque = {} as Record<string, unknown>;
  Object.defineProperty(aliasOpaque, "aAccessor", {
    enumerable: true,
    get() {
      accessorReads += 1;
      return "alias";
    },
  });
  Object.defineProperty(aliasOpaque, "zFunction", {
    enumerable: true,
    value() {
      functionCalls += 1;
      return "alias";
    },
  });
  const pending = {
    ...prepared.pending,
    projectedSave: {
      ...prepared.pending.projectedSave,
      futureOpaque: aliasOpaque,
    } as SaveData,
  };
  const resolved = resolveGalaxyPoiCompletion(
    prepared.save,
    "contact:ashfall",
    pending,
    originColonyId,
  );

  assert.equal(resolved.ok, true, resolved.ok ? undefined : resolved.reason);
  assert.equal(accessorReads, 0);
  assert.equal(functionCalls, 0);
  if (!resolved.ok) return;
  assert.strictEqual(
    (resolved.save as SaveData & { futureOpaque: object }).futureOpaque,
    futureOpaque,
  );
});

test("explicit canonical launch contexts bypass all locked legacy availability fields", () => {
  const fixtures: Array<[OperationId, GalaxyRunState, string, number, number, string]> = [
    ["op:hostile-picket", atHostileInterruption(), "shooter", 1, 1, "HOSTILE PICKET"],
    ["op:kepler-black-box", atContact("contact:kepler"), "first-person", 4, 2, "KEPLER BLACK BOX"],
    ["op:ashfall-sortie", atContact("contact:ashfall", true), "shooter", 6, 1, "ASHFALL SORTIE"],
  ];

  for (const [operationId, run, mode, world, level, label] of fixtures) {
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
    assert.deepEqual(launched.gameState.galaxyOperation, { id: operationId, label });
    if (operationId === "op:hostile-picket") {
      assert.deepEqual(launched.gameState.dialogTriggers, []);
      assert.equal(launched.gameState.dialog.currentLine, null);
      assert.deepEqual(launched.gameState.dialog.queue, []);
    }
    if (operationId === "op:ashfall-sortie") assert.equal(launched.gameState.planetId, "ashfall");
  }
});

test("Kepler objective provenance comes only from canonical galaxy story items", () => {
  const unrecovered = atContact("contact:kepler");
  const staleAuthorization = requireAuthorization(unrecovered, "op:kepler-black-box");
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
  const replay = launchOperation(recovered, lockedProjection, staleAuthorization);
  assert.equal(replay.ok, false);
  if (!replay.ok) assert.deepEqual(replay.availability.reasons, ["operation_resolved"]);
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

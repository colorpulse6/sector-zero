import { test } from "node:test";
import assert from "node:assert/strict";
import { missionDeliveryEvent } from "../../app/components/colony/shared/missionDelivery";
import { coord } from "../../app/components/engine/galaxy/coordinates";
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
import { authorizeOperationLaunch } from "../../app/components/engine/operations/operationCatalog";
import {
  applyOperationOutcome,
  normalizeOperationOutcome,
  type NormalizedOperationOutcome,
  type OperationOutcomeApplyResult,
} from "../../app/components/engine/operations/operationOutcome";
import type {
  OperationId,
  OperationLaunchContext,
} from "../../app/components/engine/operations/operationTypes";
import { migrateSave } from "../../app/components/engine/save";
import type { SaveData } from "../../app/components/engine/types";

function requireTravelSuccess<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  assert.equal(result.ok, true, "errors" in result ? JSON.stringify(result.errors) : undefined);
  if (!result.ok) throw new Error("travel transition failed");
  return result as Extract<T, { ok: true }>;
}

function requireOutcomeSuccess(result: OperationOutcomeApplyResult): Extract<OperationOutcomeApplyResult, { ok: true }> {
  assert.equal(result.ok, true, result.ok ? undefined : JSON.stringify(result.errors));
  if (!result.ok) throw new Error("operation outcome failed");
  return result;
}

function requireContext(run: GalaxyRunState, operationId: OperationId): OperationLaunchContext {
  const authorized = authorizeOperationLaunch(run, operationId);
  assert.equal(authorized.ok, true, authorized.ok ? undefined : authorized.availability.reasons.join("; "));
  if (!authorized.ok) throw new Error("operation authorization failed");
  return authorized.context;
}

function normalize(
  run: GalaxyRunState,
  context: OperationLaunchContext,
  completionId: string,
  result: "success" | "failure" | "retreat",
  frameCount: number | null = null,
): NormalizedOperationOutcome {
  const normalized = normalizeOperationOutcome(run, context, {
    completionId,
    result,
    metrics: frameCount === null ? null : { frameCount },
  });
  assert.equal(normalized.ok, true, normalized.ok ? undefined : JSON.stringify(normalized.errors));
  if (!normalized.ok) throw new Error("operation normalization failed");
  return normalized.outcome;
}

function parentFor(run: GalaxyRunState): SaveData {
  const legacy = startFreshGalaxy(migrateSave({
    currentWorld: 8,
    credits: 9876,
    materials: ["phase-crystal"],
    completedQuests: ["q-reyes-1-1"],
    completedPlanets: ["ashfall"],
    completedSpecialMissions: ["kepler-black-box"],
    storyItems: ["kepler-black-box"],
  }));
  return { ...legacy, galaxyRun: run };
}

function legacySnapshot(save: SaveData): Omit<SaveData, "galaxyRun"> {
  const { galaxyRun: _galaxyRun, ...legacy } = structuredClone(save);
  return legacy;
}

function atContact(contactId: "contact:ashfall" | "contact:kepler"): GalaxyRunState {
  const run = createFreshGalaxyRun();
  const preview = planRoute(run, { kind: "contact", contactId });
  assert.equal(preview.ok, true, preview.ok ? undefined : preview.reasons.join("; "));
  if (!preview.ok) throw new Error("route preview failed");
  const committed = requireTravelSuccess(commitTravel(run, preview.plan));
  const arrived = requireTravelSuccess(resumeTravelToBoundary(committed.galaxyRun));
  return requireTravelSuccess(finalizeTravel(arrived.galaxyRun)).galaxyRun;
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

test("one hostile completion applies operation, material, knowledge, access, history, pilot, travel, and cycle state once", () => {
  const run = atHostileInterruption();
  const parent = parentFor(run);
  const legacyBefore = legacySnapshot(parent);
  const cycleBefore = run.worldCycle;
  const supplyBefore = run.resources.supply;
  const normalized = normalize(
    run,
    requireContext(run, "op:hostile-picket"),
    "completion:picket:cleared:1",
    "success",
    3600,
  );

  const first = requireOutcomeSuccess(applyOperationOutcome(parent, normalized));
  assert.equal(first.changed, true);
  assert.equal(first.galaxyRun.worldCycle, cycleBefore + 1);
  assert.equal(first.galaxyRun.resources.supply, supplyBefore + 2);
  assert.equal(first.galaxyRun.resources.credits, 200);
  assert.deepEqual(first.galaxyRun.resources.materials, []);
  assert.equal(first.galaxyRun.pilot.xp, 100);
  assert.deepEqual(first.galaxyRun.operations["op:hostile-picket"], {
    state: "complete",
    acceptedCycle: normalized.authorizedCycle,
    resolvedCycle: cycleBefore + 1,
    completionIds: [normalized.completionId],
  });
  assert.deepEqual(first.galaxyRun.appliedOutcomeIds, [normalized.completionId]);
  assert.equal(first.galaxyRun.atlas.accessFacts.filter((fact) => fact.id === "access:picket-cleared").length, 1);
  assert.deepEqual(
    first.galaxyRun.atlas.accessFacts.find((fact) => fact.id === "access:picket-cleared"),
    {
      id: "access:picket-cleared",
      subjectId: "contact:hostile-picket",
      assessment: "secured",
      causeFactIds: ["fact:picket-patrol-active"],
      cycle: cycleBefore + 1,
    },
  );
  assert.equal(Object.values(first.galaxyRun.atlas.knowledge).some((record) =>
    record.subjectId === "contact:hostile-picket" &&
    record.state === "visited" &&
    record.confidence === "high" &&
    record.observedCycle === cycleBefore + 1), true);
  assert.equal(first.galaxyRun.historyFacts.filter((fact) =>
    fact.kind === "hostile_picket_cleared" && fact.subjectId === "op:hostile-picket").length, 1);
  assert.equal(first.galaxyRun.activeTravel?.state, "arrived");
  assert.deepEqual(first.galaxyRun.vessel.coordinate, coord(0, 0, 1280, 1024));
  assert.equal(first.galaxyRun.activeTravel?.appliedCheckpointIds.includes(
    `${run.activeTravel!.transactionId}:operation-outcome:${normalized.completionId}`,
  ), true);
  assert.deepEqual(legacySnapshot(first.save), legacyBefore);

  const reloaded = migrateSave(JSON.parse(JSON.stringify(first.save)) as Partial<SaveData>);
  const replay = requireOutcomeSuccess(applyOperationOutcome(reloaded, normalized));
  assert.equal(replay.changed, false);
  assert.deepEqual(replay.save, reloaded);
});

test("Kepler's black box story item and historical fact are unique across replays and completion IDs", () => {
  const run = atContact("contact:kepler");
  const context = requireContext(run, "op:kepler-black-box");
  const firstOutcome = normalize(run, context, "completion:kepler:1", "success");
  const first = requireOutcomeSuccess(applyOperationOutcome(parentFor(run), firstOutcome));

  assert.deepEqual(first.galaxyRun.storyItems, ["kepler-black-box"]);
  assert.equal(first.galaxyRun.historyFacts.filter((fact) => fact.kind === "kepler_black_box_recovered").length, 1);
  assert.equal(first.galaxyRun.resources.credits, 200);
  assert.equal(first.galaxyRun.pilot.xp, 100);

  const replay = requireOutcomeSuccess(applyOperationOutcome(first.save, firstOutcome));
  assert.equal(replay.changed, false);
  assert.deepEqual(replay.save, first.save);

  const secondOutcome = {
    ...structuredClone(firstOutcome),
    completionId: "completion:kepler:2",
  };
  const beforeDuplicate = structuredClone(first.save);
  const duplicate = applyOperationOutcome(first.save, secondOutcome);
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) assert.equal(duplicate.errors[0]?.code, "duplicate_unique_fact");
  assert.deepEqual(first.save, beforeDuplicate);
});

test("Ashfall cargo crosses the projection allowlist through mission_delivery without touching legacy state", () => {
  const run = atContact("contact:ashfall");
  const parent = parentFor(run);
  const legacyBefore = legacySnapshot(parent);
  const colonyBefore = structuredClone(run.colonies.find((colony) => colony.id === "galaxy:ashfall-primary")!);
  const outcome = normalize(
    run,
    requireContext(run, "op:ashfall-sortie"),
    "completion:ashfall:1",
    "success",
  );

  const result = requireOutcomeSuccess(applyOperationOutcome(parent, outcome));
  const colony = result.galaxyRun.colonies.find((entry) => entry.id === "galaxy:ashfall-primary");
  assert.ok(colony);
  assert.equal(colony.resources.metal, colonyBefore.resources.metal + 80);
  assert.equal(colony.resources.food, colonyBefore.resources.food);
  assert.equal(colony.resources.water, colonyBefore.resources.water);
  assert.equal(result.galaxyRun.pilot.xp, 75);
  assert.equal(result.delivery?.colonyId, "galaxy:ashfall-primary");
  assert.equal(result.delivery?.payload.metal, 80);
  const event = missionDeliveryEvent(result.delivery!);
  assert.equal(event.type, "colony/resourceChanged");
  if (event.type === "colony/resourceChanged") {
    assert.equal(event.payload.reason, "mission_delivery");
  }
  assert.deepEqual(legacySnapshot(result.save), legacyBefore);
});

test("picket failure and retreat advance one operation cycle, record history, and resolve travel without false access", () => {
  for (const fixture of [
    { result: "failure" as const, completionId: "completion:picket:failed", history: "hostile_picket_failed", travel: "diverted", vessel: "stranded" },
    { result: "retreat" as const, completionId: "completion:picket:retreated", history: "hostile_picket_retreated", travel: "resolved", vessel: "stationary" },
  ]) {
    const run = atHostileInterruption();
    const cycleBefore = run.worldCycle;
    const supplyBefore = run.resources.supply;
    const outcome = normalize(run, requireContext(run, "op:hostile-picket"), fixture.completionId, fixture.result);
    const folded = requireOutcomeSuccess(applyOperationOutcome(parentFor(run), outcome));

    assert.equal(folded.galaxyRun.worldCycle, cycleBefore + 1);
    assert.equal(folded.galaxyRun.resources.supply, supplyBefore);
    assert.equal(folded.galaxyRun.resources.credits, 0);
    assert.equal(folded.galaxyRun.pilot.xp, 0);
    assert.equal(folded.galaxyRun.operations["op:hostile-picket"].state, "failed");
    assert.equal(folded.galaxyRun.atlas.accessFacts.some((fact) => fact.id === "access:picket-cleared"), false);
    assert.equal(folded.galaxyRun.historyFacts.filter((fact) => fact.kind === fixture.history).length, 1);
    assert.equal(folded.galaxyRun.activeTravel?.state, fixture.travel);
    assert.equal(folded.galaxyRun.activeTravel?.appliedCheckpointIds.includes(
      `${run.activeTravel!.transactionId}:operation-outcome:${outcome.completionId}`,
    ), true);
    assert.equal(folded.galaxyRun.vessel.status, fixture.vessel);
    if (fixture.result === "retreat") {
      assert.deepEqual(folded.galaxyRun.vessel.coordinate, coord(0, 0, 512, 512));
    } else {
      assert.deepEqual(folded.galaxyRun.vessel.coordinate, coord(0, 0, 1280, 1024));
    }

    const replay = requireOutcomeSuccess(applyOperationOutcome(folded.save, outcome));
    assert.equal(replay.changed, false);
    assert.deepEqual(replay.save, folded.save);
  }
});

test("cleared picket access removes its military cause from later routes", () => {
  const run = atHostileInterruption();
  const cleared = requireOutcomeSuccess(applyOperationOutcome(
    parentFor(run),
    normalize(run, requireContext(run, "op:hostile-picket"), "completion:picket:route", "success", 3601),
  )).galaxyRun;
  const released = requireTravelSuccess(finalizeTravel(cleared)).galaxyRun;

  const toVanguard = planRoute(released, { kind: "contact", contactId: "contact:vanguard" });
  assert.equal(toVanguard.ok, true, toVanguard.ok ? undefined : toVanguard.reasons.join("; "));
  if (!toVanguard.ok) return;
  const home = requireTravelSuccess(finalizeTravel(
    requireTravelSuccess(resumeTravelToBoundary(
      requireTravelSuccess(commitTravel(released, toVanguard.plan)).galaxyRun,
    )).galaxyRun,
  )).galaxyRun;
  const returnRoute = planRoute(home, { kind: "contact", contactId: "contact:hostile-picket" });
  assert.equal(returnRoute.ok, true, returnRoute.ok ? undefined : returnRoute.reasons.join("; "));
  if (!returnRoute.ok) return;
  assert.equal(returnRoute.plan.legs[0].interruptionCauseId, null);
});

test("unknown operation, cause, contact, reward, and unique-history payloads fail before mutation", () => {
  const run = atContact("contact:kepler");
  const parent = parentFor(run);
  const canonical = normalize(run, requireContext(run, "op:kepler-black-box"), "completion:tamper", "success");
  const cases: Array<[string, NormalizedOperationOutcome, string]> = [
    ["operation", { ...structuredClone(canonical), operationId: "op:unknown" as OperationId }, "unknown_operation"],
    ["cause", { ...structuredClone(canonical), causeFactIds: ["fact:invented"] }, "unknown_cause_fact"],
    ["contact", { ...structuredClone(canonical), contactId: "contact:invented" }, "unknown_contact"],
    ["reward", {
      ...structuredClone(canonical),
      rewards: { ...structuredClone(canonical.rewards), mysteryCredits: 999 } as typeof canonical.rewards,
    }, "unknown_reward_field"],
  ];

  for (const [label, outcome, code] of cases) {
    const before = structuredClone(parent);
    const result = applyOperationOutcome(parent, outcome);
    assert.equal(result.ok, false, label);
    if (!result.ok) assert.equal(result.errors[0]?.code, code, label);
    assert.deepEqual(parent, before, label);
  }

  const missingContact = structuredClone(parent);
  for (const key of Object.keys(missingContact.galaxyRun!.atlas.materializedFacts)) {
    if (missingContact.galaxyRun!.atlas.materializedFacts[key].contactId === "contact:kepler") {
      delete missingContact.galaxyRun!.atlas.materializedFacts[key];
    }
  }
  const beforeMissingContact = structuredClone(missingContact);
  const lostContact = applyOperationOutcome(missingContact, canonical);
  assert.equal(lostContact.ok, false);
  if (!lostContact.ok) assert.equal(lostContact.errors[0]?.code, "unknown_contact");
  assert.deepEqual(missingContact, beforeMissingContact);

  const historical = structuredClone(parent);
  historical.galaxyRun!.storyItems.push("kepler-black-box");
  historical.galaxyRun!.historyFacts.push({
    id: "history:existing-kepler",
    kind: "kepler_black_box_recovered",
    subjectId: "op:kepler-black-box",
    cycle: historical.galaxyRun!.worldCycle,
    causeFactIds: ["fact:kepler-recorder-signal"],
  });
  const before = structuredClone(historical);
  const duplicate = applyOperationOutcome(historical, canonical);
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) assert.equal(duplicate.errors[0]?.code, "duplicate_unique_fact");
  assert.deepEqual(historical, before);
});

test("normalization rejects malformed engine metrics and contexts without reading legacy authority", () => {
  const run = atHostileInterruption();
  const context = requireContext(run, "op:hostile-picket");
  const unknownMetric = normalizeOperationOutcome(run, context, {
    completionId: "completion:bad-metric",
    result: "success",
    metrics: { frameCount: 1, credits: 999 } as { frameCount: number },
  });
  assert.equal(unknownMetric.ok, false);
  if (!unknownMetric.ok) assert.equal(unknownMetric.errors[0]?.code, "invalid_engine_result");

  const forgedContext = { ...structuredClone(context), contactId: "contact:ashfall" };
  const forged = normalizeOperationOutcome(run, forgedContext, {
    completionId: "completion:bad-context",
    result: "success",
    metrics: null,
  });
  assert.equal(forged.ok, false);
  if (!forged.ok) assert.equal(forged.errors[0]?.code, "context_mismatch");
});

test("a caller cannot forge a declared modifier reward after normalization", () => {
  const run = atHostileInterruption();
  const parent = parentFor(run);
  const canonical = normalize(
    run,
    requireContext(run, "op:hostile-picket"),
    "completion:forged-quick-draw",
    "success",
    3601,
  );
  assert.deepEqual(canonical.modifierIds, []);
  const forged = {
    ...structuredClone(canonical),
    modifierIds: ["modifier:q-reyes-1-1"],
    rewards: {
      ...structuredClone(canonical.rewards),
      credits: canonical.rewards.credits + 200,
    },
  };

  const before = structuredClone(parent);
  const result = applyOperationOutcome(parent, forged);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.errors[0]?.code, "unknown_modifier");
  assert.deepEqual(parent, before);
});

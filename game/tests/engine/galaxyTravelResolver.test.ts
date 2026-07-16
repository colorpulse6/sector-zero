import { test } from "node:test";
import assert from "node:assert/strict";
import { BLIND_FIXTURE_COORDINATE } from "../../app/components/engine/galaxy/authoredAnchors";
import {
  cellKey,
  coord,
  stableHash,
} from "../../app/components/engine/galaxy/coordinates";
import { resolveCell } from "../../app/components/engine/galaxy/atlas";
import {
  createFreshGalaxyRun,
  startFreshGalaxy,
} from "../../app/components/engine/galaxy/galaxyRun";
import type {
  GalaxyRunState,
  TravelCommitment,
} from "../../app/components/engine/galaxy/galaxyTypes";
import {
  G0_DIRECT_ROUTE_POLICY,
  planRoute,
  type AtlasTarget,
  type RoutePlan,
} from "../../app/components/engine/galaxy/routePlanner";
import {
  advanceTravelCheckpoint,
  commitTravel,
  emergencyRetreat,
  finalizeTravel,
  resolveTravelInterruption,
  resumeTravelToBoundary,
  type TravelTransitionResult,
} from "../../app/components/engine/galaxy/travelResolver";
import { migrateSave } from "../../app/components/engine/save";
import type { SaveData } from "../../app/components/engine/types";

function requirePlan(run: GalaxyRunState, target: AtlasTarget): RoutePlan {
  const result = planRoute(run, target);
  assert.equal(result.ok, true, result.ok ? undefined : result.reasons.join("; "));
  if (!result.ok) throw new Error("route unexpectedly blocked");
  return result.plan;
}

function requireSuccess(result: TravelTransitionResult) {
  assert.equal(result.ok, true, result.ok ? undefined : result.errors.map((entry) => entry.message).join("; "));
  if (!result.ok) throw new Error("travel transition unexpectedly failed");
  return result;
}

function commitTo(run: GalaxyRunState, target: AtlasTarget) {
  const plan = requirePlan(run, target);
  return { plan, result: requireSuccess(commitTravel(run, plan)) };
}

function contact(contactId: string): AtlasTarget {
  return { kind: "contact", contactId };
}

function migrateRun(run: GalaxyRunState): GalaxyRunState {
  const migrated = migrateSave({
    activeExperience: "galaxy",
    galaxyRun: structuredClone(run),
  } as unknown as Record<string, unknown>);
  assert.ok(migrated.galaxyRun);
  return migrated.galaxyRun;
}

function resolvedTo(run: GalaxyRunState, target: AtlasTarget) {
  const committed = commitTo(run, target);
  return {
    plan: committed.plan,
    result: requireSuccess(resumeTravelToBoundary(committed.result.galaxyRun)),
  };
}

test("initial route commitment is atomic and identity-idempotent", () => {
  const run = createFreshGalaxyRun();
  const plan = requirePlan(run, contact("contact:ashfall"));
  const before = structuredClone(run);
  const first = requireSuccess(commitTravel(run, plan));

  assert.deepEqual(run, before);
  assert.equal(first.changed, true);
  assert.equal(first.galaxyRun.resources.supply, 10);
  assert.equal(first.galaxyRun.nextTransactionOrdinal, 2);
  assert.equal(
    first.galaxyRun.activeTravel?.transactionId,
    `travel:${plan.id}:1`,
  );
  assert.equal(first.galaxyRun.activeTravel?.state, "committed");
  assert.deepEqual(first.galaxyRun.activeTravel?.appliedCheckpointIds, []);
  assert.deepEqual(first.galaxyRun.vessel, {
    status: "in_transit",
    coordinate: coord(0, 0, 512, 512),
    contactId: null,
    transitTransactionId: `travel:${plan.id}:1`,
  });
  assert.deepEqual(first.nextActions, [{ kind: "resolve" }]);

  const second = requireSuccess(commitTravel(first.galaxyRun, plan));
  assert.equal(second.changed, false);
  assert.equal(second.galaxyRun, first.galaxyRun);
  assert.equal(second.galaxyRun.resources.supply, 10);
  assert.equal(second.galaxyRun.nextTransactionOrdinal, 2);
  assert.deepEqual(second.galaxyRun.activeTravel?.appliedCheckpointIds, []);
});

test("commit re-plans and rejects every stale immutable preview input", () => {
  const fresh = createFreshGalaxyRun();
  const plan = requirePlan(fresh, contact("contact:ashfall"));
  const variants: Array<[string, (run: GalaxyRunState) => void]> = [
    ["resources", (run) => { run.resources.supply += 1; }],
    ["cycle", (run) => { run.worldCycle += 1; }],
    ["capability", (run) => { run.ship.upgrades.engineBoost += 1; }],
    ["identity", (run) => { run.identity.galaxySeed = "stale-seed"; }],
    ["cause", (run) => {
      run.historyFacts = run.historyFacts.filter((fact) => fact.id !== "fact:picket-patrol-active");
    }],
  ];

  for (const [label, mutate] of variants) {
    const run = createFreshGalaxyRun();
    const candidatePlan = label === "cause"
      ? requirePlan(run, contact("contact:hostile-picket"))
      : plan;
    mutate(run);
    const before = structuredClone(run);
    const result = commitTravel(run, candidatePlan);
    assert.equal(result.ok, false, `${label} must be stale`);
    if (!result.ok) assert.equal(result.errors[0]?.code, "stale_plan");
    assert.deepEqual(run, before);
  }

  for (const tampered of [
    { ...structuredClone(plan), supplyCost: 1 },
    { ...structuredClone(plan), identity: { ...plan.identity, galaxySeed: "caller-authored" } },
    { ...structuredClone(plan), policy: { ...G0_DIRECT_ROUTE_POLICY, allowBlindCoordinates: false } },
    { ...structuredClone(plan), legs: [{ ...plan.legs[0], cycles: 3 }] },
  ]) {
    const run = createFreshGalaxyRun();
    const before = structuredClone(run);
    const result = commitTravel(run, tampered as RoutePlan);
    assert.equal(result.ok, false);
    assert.deepEqual(run, before);
  }
});

test("one checkpoint advances exact promised time once and safe travel arrives", () => {
  const { plan, result: committed } = commitTo(createFreshGalaxyRun(), contact("contact:ashfall"));
  const transactionId = committed.galaxyRun.activeTravel!.transactionId;
  const advanced = requireSuccess(advanceTravelCheckpoint(committed.galaxyRun));

  assert.equal(advanced.galaxyRun.worldCycle, plan.elapsedCycles);
  assert.equal(advanced.galaxyRun.resources.supply, 10);
  assert.equal(advanced.galaxyRun.activeTravel?.state, "arrived");
  assert.equal(advanced.galaxyRun.activeTravel?.elapsedCycles, plan.elapsedCycles);
  assert.equal(advanced.galaxyRun.activeTravel?.nextLegIndex, 1);
  assert.deepEqual(advanced.galaxyRun.activeTravel?.appliedCheckpointIds, [
    `${transactionId}:leg:0`,
  ]);
  assert.deepEqual(advanced.galaxyRun.vessel, {
    status: "stationary",
    coordinate: plan.destination,
    contactId: "contact:ashfall",
    transitTransactionId: null,
  });
  assert.deepEqual(advanced.nextActions, [{ kind: "return" }]);

  const repeated = requireSuccess(advanceTravelCheckpoint(advanced.galaxyRun));
  assert.equal(repeated.changed, false);
  assert.equal(repeated.galaxyRun, advanced.galaxyRun);
});

test("resume after migration applies only missing work in every commitment state", () => {
  const committed = commitTo(createFreshGalaxyRun(), contact("contact:ashfall")).result.galaxyRun;
  const advancing = structuredClone(committed);
  advancing.activeTravel!.state = "advancing";
  const arrived = resolvedTo(createFreshGalaxyRun(), contact("contact:ashfall")).result.galaxyRun;

  const hostileCommitted = commitTo(createFreshGalaxyRun(), contact("contact:hostile-picket")).result.galaxyRun;
  const interrupted = requireSuccess(resumeTravelToBoundary(hostileCommitted)).galaxyRun;
  const diverted = requireSuccess(
    resolveTravelInterruption(interrupted, "op:hostile-picket", "failed"),
  ).galaxyRun;
  const resolved = requireSuccess(
    resolveTravelInterruption(interrupted, "op:hostile-picket", "retreated"),
  ).galaxyRun;

  const fixtures: Array<[TravelCommitment["state"], GalaxyRunState, TravelCommitment["state"], number]> = [
    ["committed", committed, "arrived", 1],
    ["advancing", advancing, "arrived", 1],
    ["interrupted", interrupted, "interrupted", 0],
    ["arrived", arrived, "arrived", 0],
    ["diverted", diverted, "diverted", 0],
    ["resolved", resolved, "resolved", 0],
  ];

  for (const [state, source, expectedState, additionalCycles] of fixtures) {
    const migrated = migrateRun(source);
    assert.equal(migrated.activeTravel?.state, state);
    const beforeSupply = migrated.resources.supply;
    const beforeCycle = migrated.worldCycle;
    const beforeIds = [...(migrated.activeTravel?.appliedCheckpointIds ?? [])];
    const first = requireSuccess(resumeTravelToBoundary(migrated));
    assert.equal(first.galaxyRun.activeTravel?.state, expectedState);
    assert.equal(first.galaxyRun.resources.supply, beforeSupply);
    assert.equal(first.galaxyRun.worldCycle, beforeCycle + additionalCycles);
    assert.equal(new Set(first.galaxyRun.activeTravel?.appliedCheckpointIds).size, first.galaxyRun.activeTravel?.appliedCheckpointIds.length);
    if (additionalCycles === 0) {
      assert.deepEqual(first.galaxyRun.activeTravel?.appliedCheckpointIds, beforeIds);
    }
    const second = requireSuccess(resumeTravelToBoundary(migrateRun(first.galaxyRun)));
    assert.equal(second.changed, false);
    assert.deepEqual(second.galaxyRun, migrateRun(first.galaxyRun));
  }
});

test("hostile travel stops at its saved caused operation with launch and retreat", () => {
  const committed = commitTo(createFreshGalaxyRun(), contact("contact:hostile-picket"));
  const stopped = requireSuccess(resumeTravelToBoundary(committed.result.galaxyRun));
  const transactionId = stopped.galaxyRun.activeTravel!.transactionId;

  assert.equal(stopped.galaxyRun.worldCycle, committed.plan.elapsedCycles);
  assert.equal(stopped.galaxyRun.activeTravel?.state, "interrupted");
  assert.equal(stopped.galaxyRun.activeTravel?.interruptionOperationId, "op:hostile-picket");
  assert.deepEqual(stopped.galaxyRun.vessel.coordinate, coord(0, 0, 1280, 1024));
  assert.deepEqual(stopped.galaxyRun.activeTravel?.appliedCheckpointIds, [
    `${transactionId}:leg:0`,
  ]);
  assert.deepEqual(stopped.nextActions, [
    { kind: "launch", operationId: "op:hostile-picket" },
    { kind: "retreat" },
  ]);
});

test("interruption outcomes and emergency retreat are typed, atomic, and idempotent", () => {
  function interruption(): GalaxyRunState {
    const committed = commitTo(createFreshGalaxyRun(), contact("contact:hostile-picket"));
    return requireSuccess(resumeTravelToBoundary(committed.result.galaxyRun)).galaxyRun;
  }

  const cleared = requireSuccess(resolveTravelInterruption(interruption(), "op:hostile-picket", "cleared"));
  assert.equal(cleared.galaxyRun.activeTravel?.state, "arrived");
  assert.deepEqual(cleared.galaxyRun.vessel.coordinate, coord(0, 0, 1280, 1024));
  assert.deepEqual(cleared.nextActions, [{ kind: "return" }]);
  const clearedAgain = requireSuccess(resolveTravelInterruption(cleared.galaxyRun, "op:hostile-picket", "cleared"));
  assert.equal(clearedAgain.changed, false);

  const failed = requireSuccess(resolveTravelInterruption(interruption(), "op:hostile-picket", "failed"));
  assert.equal(failed.galaxyRun.activeTravel?.state, "diverted");
  assert.equal(failed.galaxyRun.vessel.status, "stranded");
  assert.deepEqual(failed.galaxyRun.vessel.coordinate, coord(0, 0, 1280, 1024));
  assert.deepEqual(failed.nextActions, [{ kind: "emergency_retreat" }]);
  const failedAgain = requireSuccess(resolveTravelInterruption(failed.galaxyRun, "op:hostile-picket", "failed"));
  assert.equal(failedAgain.changed, false);

  const retreated = requireSuccess(resolveTravelInterruption(interruption(), "op:hostile-picket", "retreated"));
  assert.equal(retreated.galaxyRun.activeTravel?.state, "resolved");
  assert.deepEqual(retreated.galaxyRun.vessel, {
    status: "stationary",
    coordinate: coord(0, 0, 512, 512),
    contactId: "contact:vanguard",
    transitTransactionId: null,
  });
  const retreatedAgain = requireSuccess(resolveTravelInterruption(migrateRun(retreated.galaxyRun), "op:hostile-picket", "retreated"));
  assert.equal(retreatedAgain.changed, false);

  const supplyBeforeEmergency = failed.galaxyRun.resources.supply;
  const cycleBeforeEmergency = failed.galaxyRun.worldCycle;
  const emergency = requireSuccess(emergencyRetreat(failed.galaxyRun));
  assert.equal(emergency.galaxyRun.resources.supply, supplyBeforeEmergency);
  assert.equal(emergency.galaxyRun.worldCycle, cycleBeforeEmergency + 1);
  assert.equal(emergency.galaxyRun.activeTravel?.state, "resolved");
  assert.deepEqual(emergency.galaxyRun.vessel.coordinate, coord(0, 0, 512, 512));
  const emergencyAgain = requireSuccess(emergencyRetreat(migrateRun(emergency.galaxyRun)));
  assert.equal(emergencyAgain.changed, false);

  const wrongOperation = resolveTravelInterruption(interruption(), "op:ashfall-sortie", "cleared");
  assert.equal(wrongOperation.ok, false);
});

const KIND_IDENTITIES = [
  ["empty", "travel-kind-0", 330095976],
  ["stellar_contact", "travel-kind-1", 124292527],
  ["hazard", "travel-kind-2", 2267156366],
  ["signal", "travel-kind-3", 1244096285],
  ["anomaly", "travel-kind-11", 1790268100],
  ["ruin", "travel-kind-16", 2466494541],
] as const;

test("blind arrival materializes and directly records every procedural kind once", () => {
  for (const [kind, galaxySeed, stableSeed] of KIND_IDENTITIES) {
    const run = createFreshGalaxyRun({
      galaxySeed,
      generationVersion: 1,
      authoredAnchorRegistryVersion: 1,
    });
    const generated = resolveCell(run.identity, BLIND_FIXTURE_COORDINATE);
    assert.equal(generated.ok, true);
    if (!generated.ok) continue;
    assert.equal(generated.fact.kind, kind);
    assert.equal(generated.fact.stableSeed, stableSeed);

    const arrived = resolvedTo(run, {
      kind: "coordinate",
      coordinate: BLIND_FIXTURE_COORDINATE,
    }).result.galaxyRun;
    const key = cellKey(BLIND_FIXTURE_COORDINATE);
    assert.deepEqual(arrived.atlas.materializedFacts[key], generated.fact);
    assert.ok(arrived.atlas.mappedCellKeys.includes(key));
    const records = Object.values(arrived.atlas.knowledge).filter(
      (record) => record.subjectId === generated.fact.id && record.source === "direct_visit",
    );
    assert.equal(records.length, 1, `${kind} must have one direct-visit record`);
    assert.equal(records[0].state, kind === "empty" ? "charted" : kind === "signal" ? "signal" : "visited");
    assert.equal(records[0].observedProperties.kind, kind);
    if (kind === "empty") assert.equal(records[0].observedProperties.negativeSurvey, true);

    const resumed = requireSuccess(resumeTravelToBoundary(migrateRun(arrived)));
    assert.equal(resumed.changed, false);
    assert.equal(
      Object.values(resumed.galaxyRun.atlas.knowledge).filter(
        (record) => record.subjectId === generated.fact.id && record.source === "direct_visit",
      ).length,
      1,
    );
  }
});

test("blind fixed-cell arrival keeps exact vessel coordinate but canonical fact identity", () => {
  const run = createFreshGalaxyRun({
    galaxySeed: "travel-kind-0",
    generationVersion: 1,
    authoredAnchorRegistryVersion: 1,
  });
  const exactTarget = coord(0, 0, 1793, 1793);
  const arrived = resolvedTo(run, { kind: "coordinate", coordinate: exactTarget }).result.galaxyRun;
  const fact = arrived.atlas.materializedFacts[cellKey(exactTarget)];
  assert.deepEqual(arrived.vessel.coordinate, exactTarget);
  assert.deepEqual(fact.coordinate, coord(0, 0, 1792, 1792));
  assert.equal(fact.cellKey, cellKey(exactTarget));
});

test("arrived and resolved journals close explicitly before a future route", () => {
  const arrived = resolvedTo(createFreshGalaxyRun(), contact("contact:ashfall")).result.galaxyRun;
  assert.equal(planRoute(arrived, contact("contact:kepler")).ok, false);
  const closedArrival = requireSuccess(finalizeTravel(arrived));
  assert.equal(closedArrival.galaxyRun.activeTravel, null);
  assert.equal(planRoute(closedArrival.galaxyRun, contact("contact:kepler")).ok, true);
  const closedAgain = requireSuccess(finalizeTravel(closedArrival.galaxyRun));
  assert.equal(closedAgain.changed, false);

  const hostile = resolvedTo(createFreshGalaxyRun(), contact("contact:hostile-picket")).result.galaxyRun;
  const retreated = requireSuccess(resolveTravelInterruption(hostile, "op:hostile-picket", "retreated"));
  const closedRetreat = requireSuccess(finalizeTravel(retreated.galaxyRun));
  assert.equal(closedRetreat.galaxyRun.activeTravel, null);
  assert.equal(planRoute(closedRetreat.galaxyRun, contact("contact:ashfall")).ok, true);
});

test("canonical SaveData transitions preserve every legacy top-level field", () => {
  const legacy = migrateSave({
    currentWorld: 8,
    credits: 999,
    totalScore: 123456,
    levels: { "8-5": { completed: true, stars: 3, highScore: 9999 } },
    completedQuests: ["legacy:quest"],
    completedPlanets: ["verdania"],
    missionsSinceStart: 77,
  });
  const parent = startFreshGalaxy(legacy);
  const plan = requirePlan(parent.galaxyRun!, contact("contact:ashfall"));
  const legacyKeys = Object.keys(parent).filter((key) => key !== "galaxyRun");
  const before = Object.fromEntries(legacyKeys.map((key) => [key, structuredClone((parent as unknown as Record<string, unknown>)[key])]));

  const committed = requireSuccess(commitTravel(parent, plan));
  assert.ok(committed.save);
  const advanced = requireSuccess(resumeTravelToBoundary(committed.save!));
  assert.ok(advanced.save);
  const after = Object.fromEntries(legacyKeys.map((key) => [key, structuredClone((advanced.save as unknown as Record<string, unknown>)[key])]));
  assert.deepEqual(after, before);
});

test("malformed travel and prototype plans fail closed while prototype keys stay data", () => {
  const run = createFreshGalaxyRun();
  const plan = requirePlan(run, contact("contact:ashfall"));
  const inheritedPlan = Object.create({ ...plan }) as RoutePlan;
  const before = structuredClone(run);
  assert.equal(commitTravel(run, inheritedPlan).ok, false);
  assert.deepEqual(run, before);

  const committed = commitTo(createFreshGalaxyRun(), contact("contact:ashfall")).result.galaxyRun;
  const malformed = structuredClone(committed);
  malformed.activeTravel!.appliedCheckpointIds = ["duplicate", "duplicate"];
  const malformedBefore = structuredClone(malformed);
  assert.equal(resumeTravelToBoundary(malformed).ok, false);
  assert.deepEqual(malformed, malformedBefore);

  const safe = createFreshGalaxyRun({
    galaxySeed: "travel-kind-0",
    generationVersion: 1,
    authoredAnchorRegistryVersion: 1,
  });
  const dictionary = Object.create(null) as GalaxyRunState["atlas"]["knowledge"];
  Object.assign(dictionary, safe.atlas.knowledge);
  Object.defineProperty(dictionary, "__proto__", {
    configurable: true,
    enumerable: true,
    writable: true,
    value: {
      id: "__proto__",
      subjectId: "contact:vanguard",
      state: "charted",
      observedProperties: { safe: true },
      confidence: "high",
      source: "direct_visit",
      observedCycle: 0,
      expiresCycle: null,
    },
  });
  safe.atlas.knowledge = dictionary;
  const safeBefore = JSON.stringify(safe);
  const committedSafe = requireSuccess(commitTravel(safe, requirePlan(safe, {
    kind: "coordinate",
    coordinate: BLIND_FIXTURE_COORDINATE,
  })));
  const result = requireSuccess(resumeTravelToBoundary(committedSafe.galaxyRun));
  assert.equal(result.galaxyRun.activeTravel?.state, "arrived");
  assert.equal(JSON.stringify(safe), safeBefore);
  assert.equal(({} as { polluted?: boolean }).polluted, undefined);
});

test("same inputs produce deterministic commitments and travel outcomes", () => {
  const leftRun = createFreshGalaxyRun();
  const rightRun = createFreshGalaxyRun();
  const leftPlan = requirePlan(leftRun, contact("contact:ashfall"));
  const rightPlan = requirePlan(rightRun, contact("contact:ashfall"));
  assert.deepEqual(leftPlan, rightPlan);
  const left = requireSuccess(resumeTravelToBoundary(requireSuccess(commitTravel(leftRun, leftPlan)).galaxyRun));
  const right = requireSuccess(resumeTravelToBoundary(requireSuccess(commitTravel(rightRun, rightPlan)).galaxyRun));
  assert.deepEqual(left.galaxyRun, right.galaxyRun);
  assert.deepEqual(left.nextActions, right.nextActions);
});

test("migrated resolved-at-origin and completed-destination journals remain finalizable", () => {
  const originResolved = commitTo(
    createFreshGalaxyRun(),
    contact("contact:ashfall"),
  ).result.galaxyRun;
  originResolved.activeTravel!.state = "resolved";
  originResolved.vessel = {
    status: "stationary",
    coordinate: structuredClone(originResolved.activeTravel!.origin),
    contactId: "contact:vanguard",
    transitTransactionId: null,
  };

  const destinationResolved = resolvedTo(
    createFreshGalaxyRun(),
    contact("contact:ashfall"),
  ).result.galaxyRun;
  destinationResolved.activeTravel!.state = "resolved";

  for (const source of [originResolved, destinationResolved]) {
    const migrated = migrateRun(source);
    assert.equal(migrated.activeTravel?.state, "resolved");
    const resumed = requireSuccess(resumeTravelToBoundary(migrated));
    assert.equal(resumed.changed, false);
    const finalized = requireSuccess(finalizeTravel(resumed.galaxyRun));
    assert.equal(finalized.galaxyRun.activeTravel, null);
    assert.equal(finalized.galaxyRun.vessel.status, "stationary");
  }
});

test("every public transition contains reflection, accessor, and clone failures", () => {
  const run = createFreshGalaxyRun();
  const plan = requirePlan(run, contact("contact:ashfall"));
  const reflectionTrap = new Proxy(run, {
    ownKeys() {
      throw new Error("hostile reflection");
    },
  });
  const calls = [
    () => commitTravel(reflectionTrap, plan),
    () => advanceTravelCheckpoint(reflectionTrap),
    () => resumeTravelToBoundary(reflectionTrap),
    () => resolveTravelInterruption(reflectionTrap, "op:hostile-picket", "cleared"),
    () => emergencyRetreat(reflectionTrap),
    () => finalizeTravel(reflectionTrap),
  ];
  for (const call of calls) {
    assert.doesNotThrow(call);
    const result = call();
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.errors[0]?.code, "unsafe_input");
  }

  const accessorPlan = { ...structuredClone(plan) } as RoutePlan;
  Object.defineProperty(accessorPlan, "id", {
    configurable: true,
    enumerable: true,
    get() {
      throw new Error("delayed accessor");
    },
  });
  assert.doesNotThrow(() => commitTravel(run, accessorPlan));
  assert.equal(commitTravel(run, accessorPlan).ok, false);

  const cloneTrap = new Proxy(run, {});
  assert.doesNotThrow(() => commitTravel(cloneTrap, plan));
  const cloneFailure = commitTravel(cloneTrap, plan);
  assert.equal(cloneFailure.ok, false);
  if (!cloneFailure.ok) assert.equal(cloneFailure.errors[0]?.code, "unsafe_input");
});

test("migrated commitments cannot tamper canonical route or transaction identity", () => {
  function committed(): GalaxyRunState {
    return commitTo(
      createFreshGalaxyRun(),
      contact("contact:ashfall"),
    ).result.galaxyRun;
  }

  function rebindTamperedPlan(run: GalaxyRunState): void {
    const travel = run.activeTravel!;
    const payloadText = travel.routePlanId.slice(
      travel.routePlanId.indexOf(":", 6) + 1,
    );
    const payload = JSON.parse(payloadText) as unknown[];
    payload[8] = travel.legs.map((leg) => [
      leg.id,
      [leg.from.sectorX, leg.from.sectorY, leg.from.localX, leg.from.localY],
      [leg.to.sectorX, leg.to.sectorY, leg.to.localX, leg.to.localY],
      leg.distanceUnits,
      leg.cycles,
      leg.supplyCost,
      leg.interruptionCauseId,
    ]);
    const capability = payload[5] as number[];
    payload[9] = [
      travel.legs.reduce((total, leg) => total + leg.distanceUnits, 0),
      travel.legs.reduce((total, leg) => total + leg.cycles, 0),
      travel.supplyCost,
      capability[1] - travel.supplyCost,
    ];
    const reboundPayload = JSON.stringify(payload);
    const hash = stableHash(`route:${reboundPayload}`).toString(16).padStart(8, "0");
    travel.routePlanId = `route:${hash}:${reboundPayload}`;
    travel.transactionId = `travel:${travel.routePlanId}:1`;
    run.vessel.transitTransactionId = travel.transactionId;
  }

  const multiLeg = committed();
  multiLeg.activeTravel!.legs = [
    {
      id: "leg:tampered:first",
      from: coord(0, 0, 512, 512),
      to: coord(0, 0, 768, 512),
      distanceUnits: 256,
      cycles: 1,
      supplyCost: 1,
      interruptionCauseId: null,
    },
    {
      id: "leg:tampered:second",
      from: coord(0, 0, 768, 512),
      to: coord(0, 0, 1024, 512),
      distanceUnits: 256,
      cycles: 1,
      supplyCost: 1,
      interruptionCauseId: null,
    },
  ];
  rebindTamperedPlan(multiLeg);

  const cheapCycle = committed();
  cheapCycle.activeTravel!.legs[0].cycles = 0;
  rebindTamperedPlan(cheapCycle);

  const wrongLegId = committed();
  wrongLegId.activeTravel!.legs[0].id = "leg:caller-authored";
  rebindTamperedPlan(wrongLegId);

  const wrongTransaction = committed();
  wrongTransaction.activeTravel!.transactionId = "travel:wrong:77";
  wrongTransaction.vessel.transitTransactionId = "travel:wrong:77";

  const corruptPlanHash = committed();
  corruptPlanHash.activeTravel!.routePlanId = `${corruptPlanHash.activeTravel!.routePlanId}:tampered`;
  corruptPlanHash.activeTravel!.transactionId = `travel:${corruptPlanHash.activeTravel!.routePlanId}:1`;
  corruptPlanHash.vessel.transitTransactionId = corruptPlanHash.activeTravel!.transactionId;

  for (const [label, source] of [
    ["multi-leg", multiLeg],
    ["cheap-cycle", cheapCycle],
    ["wrong-leg-id", wrongLegId],
    ["wrong-transaction", wrongTransaction],
    ["corrupt-plan-hash", corruptPlanHash],
  ] as const) {
    const migrated = migrateRun(source);
    assert.ok(migrated.activeTravel, `${label} fixture must reach resolver validation`);
    const before = structuredClone(migrated);
    const result = resumeTravelToBoundary(migrated);
    assert.equal(result.ok, false, `${label} must fail closed`);
    if (!result.ok) assert.equal(result.errors[0]?.code, "malformed_travel");
    assert.deepEqual(migrated, before);
  }
});

test("migrated travel states stay bound to the exact picket cause and closure", () => {
  function interrupted(): GalaxyRunState {
    const committed = commitTo(
      createFreshGalaxyRun(),
      contact("contact:hostile-picket"),
    ).result.galaxyRun;
    return requireSuccess(resumeTravelToBoundary(committed)).galaxyRun;
  }

  const nullOperation = interrupted();
  nullOperation.activeTravel!.interruptionOperationId = null;

  const interruptedCleared = interrupted();
  interruptedCleared.activeTravel!.appliedCheckpointIds.push(
    `${interruptedCleared.activeTravel!.transactionId}:interruption:cleared`,
  );

  const divertedWithoutFailure = interrupted();
  divertedWithoutFailure.activeTravel!.state = "diverted";
  divertedWithoutFailure.vessel.status = "stranded";

  const completedCommitted = interrupted();
  completedCommitted.activeTravel!.state = "committed";
  completedCommitted.activeTravel!.interruptionOperationId = null;

  const completedAdvancing = structuredClone(completedCommitted);
  completedAdvancing.activeTravel!.state = "advancing";

  const safeArrivedWithFailure = resolvedTo(
    createFreshGalaxyRun(),
    contact("contact:ashfall"),
  ).result.galaxyRun;
  safeArrivedWithFailure.activeTravel!.appliedCheckpointIds.push(
    `${safeArrivedWithFailure.activeTravel!.transactionId}:interruption:failed`,
  );

  const causedResolvedWithCleared = interrupted();
  causedResolvedWithCleared.activeTravel!.state = "resolved";
  causedResolvedWithCleared.activeTravel!.interruptionOperationId = null;
  causedResolvedWithCleared.activeTravel!.appliedCheckpointIds.push(
    `${causedResolvedWithCleared.activeTravel!.transactionId}:interruption:cleared`,
  );
  causedResolvedWithCleared.vessel = {
    status: "stationary",
    coordinate: structuredClone(causedResolvedWithCleared.activeTravel!.origin),
    contactId: "contact:vanguard",
    transitTransactionId: null,
  };

  for (const [label, source] of [
    ["interrupted-null-op", nullOperation],
    ["interrupted-cleared", interruptedCleared],
    ["diverted-without-failed", divertedWithoutFailure],
    ["committed-completed-cause", completedCommitted],
    ["advancing-completed-cause", completedAdvancing],
    ["safe-arrived-failed", safeArrivedWithFailure],
    ["caused-resolved-cleared", causedResolvedWithCleared],
  ] as const) {
    const migrated = migrateRun(source);
    assert.ok(migrated.activeTravel, `${label} fixture must reach resolver validation`);
    const result = resumeTravelToBoundary(migrated);
    assert.equal(result.ok, false, `${label} must fail explicitly`);
    if (!result.ok) assert.equal(result.errors[0]?.code, "malformed_travel");
  }
});

test("saved destination fact outranks an unavailable generator during arrival", () => {
  const run = commitTo(
    createFreshGalaxyRun(),
    contact("contact:ashfall"),
  ).result.galaxyRun;
  const travel = run.activeTravel!;
  const oldPlanId = travel.routePlanId;
  const payloadText = oldPlanId.slice(oldPlanId.indexOf(":", 6) + 1);
  const payload = JSON.parse(payloadText) as unknown[];
  (payload[7] as unknown[])[1] = 999;
  const unsupportedPayload = JSON.stringify(payload);
  const hash = stableHash(`route:${unsupportedPayload}`).toString(16).padStart(8, "0");
  const unsupportedPlanId = `route:${hash}:${unsupportedPayload}`;
  const transactionId = `travel:${unsupportedPlanId}:1`;

  run.identity.generationVersion = 999;
  run.worldCycle = travel.legs[0].cycles;
  travel.routePlanId = unsupportedPlanId;
  travel.transactionId = transactionId;
  travel.state = "advancing";
  travel.nextLegIndex = 1;
  travel.elapsedCycles = travel.legs[0].cycles;
  travel.appliedCheckpointIds = [`${transactionId}:leg:0`];
  run.vessel = {
    status: "in_transit",
    coordinate: structuredClone(travel.destination),
    contactId: null,
    transitTransactionId: transactionId,
  };

  const migrated = migrateRun(run);
  assert.equal(migrated.identity.generationVersion, 999);
  assert.ok(migrated.atlas.materializedFacts[cellKey(travel.destination)]);
  const result = resumeTravelToBoundary(migrated);
  assert.equal(result.ok, true, result.ok ? undefined : result.errors[0]?.message);
  if (!result.ok) return;
  assert.equal(result.galaxyRun.activeTravel?.state, "arrived");
  assert.equal(
    result.galaxyRun.atlas.materializedFacts[cellKey(travel.destination)].id,
    "contact:ashfall",
  );
});

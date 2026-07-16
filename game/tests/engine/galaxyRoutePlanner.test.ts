import { test } from "node:test";
import assert from "node:assert/strict";
import { BLIND_FIXTURE_COORDINATE } from "../../app/components/engine/galaxy/authoredAnchors";
import { coord } from "../../app/components/engine/galaxy/coordinates";
import { createFreshGalaxyRun } from "../../app/components/engine/galaxy/galaxyRun";
import type {
  GalaxyRunState,
  ThreatDimension,
} from "../../app/components/engine/galaxy/galaxyTypes";
import {
  G0_DIRECT_ROUTE_POLICY,
  planRoute,
  type AtlasTarget,
  type RoutePlan,
} from "../../app/components/engine/galaxy/routePlanner";

const THREAT_DIMENSIONS: readonly ThreatDimension[] = [
  "military",
  "political",
  "environmental",
  "logistical",
  "anomalous",
];

function runAtVanguard(overrides: { supply?: number } = {}): GalaxyRunState {
  const run = createFreshGalaxyRun();
  if (overrides.supply !== undefined) {
    run.resources.supply = overrides.supply;
  }
  return run;
}

function requirePlan(
  result: ReturnType<typeof planRoute>,
): RoutePlan {
  assert.equal(result.ok, true, result.ok ? undefined : result.reasons.join("; "));
  if (!result.ok) throw new Error("route was unexpectedly blocked");
  return result.plan;
}

function planTo(contactId: string, run = runAtVanguard()) {
  return planRoute(run, { kind: "contact", contactId });
}

function costTo(contactId: string) {
  const plan = requirePlan(planTo(contactId));
  return {
    distanceUnits: plan.distanceUnits,
    elapsedCycles: plan.elapsedCycles,
    supplyCost: plan.supplyCost,
  };
}

function blockCodes(result: ReturnType<typeof planRoute>): string[] {
  assert.equal(result.ok, false);
  return result.ok ? [] : result.reasonDetails.map((reason) => reason.code);
}

test("preview exposes all five threat dimensions", () => {
  const result = planRoute(runAtVanguard(), {
    kind: "contact",
    contactId: "contact:ashfall",
  });
  const plan = requirePlan(result);

  assert.deepEqual(Object.keys(plan.threat.dimensions).sort(), [
    "anomalous",
    "environmental",
    "logistical",
    "military",
    "political",
  ]);
  for (const dimension of THREAT_DIMENSIONS) {
    assert.deepEqual(Object.keys(plan.threat.dimensions[dimension]).sort(), [
      "band",
      "confidence",
      "sources",
      "unknownContributors",
    ]);
  }
  assert.deepEqual(plan.threat.overall, {
    band: "moderate",
    confidence: "high",
    presentation: "MODERATE EXPOSURE",
  });
});

test("insufficient supply blocks without mutation", () => {
  const run = runAtVanguard({ supply: 0 });
  const before = structuredClone(run);
  const result = planRoute(run, {
    kind: "contact",
    contactId: "contact:kepler",
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, "blocked");
  assert.match(result.reasons.join(" "), /supply/i);
  assert.ok(blockCodes(result).includes("insufficient_supply"));
  assert.deepEqual(run, before);
});

test("G0 route economy matches the versioned content table", () => {
  assert.deepEqual(costTo("contact:ashfall"), {
    distanceUnits: 512,
    elapsedCycles: 1,
    supplyCost: 2,
  });
  assert.deepEqual(costTo("contact:hostile-picket"), {
    distanceUnits: 923,
    elapsedCycles: 2,
    supplyCost: 3,
  });
  assert.deepEqual(costTo("contact:kepler"), {
    distanceUnits: 1619,
    elapsedCycles: 3,
    supplyCost: 5,
  });

  const unresolved = planTo("signal:unresolved-g0");
  assert.equal(unresolved.ok, false);
  assert.ok(blockCodes(unresolved).includes("over_maximum_leg_distance"));
});

test("successful direct preview returns immutable route inputs and explicit G0 opportunity arrays", () => {
  const run = runAtVanguard();
  const before = structuredClone(run);
  const plan = requirePlan(planTo("contact:ashfall", run));

  assert.deepEqual(plan.origin, coord(0, 0, 512, 512));
  assert.deepEqual(plan.destination, coord(0, 0, 1024, 512));
  assert.deepEqual(plan.target, {
    kind: "contact",
    contactId: "contact:ashfall",
  });
  assert.equal(plan.targetId, "contact:ashfall");
  assert.deepEqual(plan.identity, run.identity);
  assert.deepEqual(plan.capability, {
    maxLegDistance: 2048,
    availableSupply: 12,
    engineBoostLevel: run.ship.upgrades.engineBoost,
  });
  assert.deepEqual(plan.policy, G0_DIRECT_ROUTE_POLICY);
  assert.equal(plan.cycleSnapshot, 0);
  assert.equal(plan.projectedReserve, 10);
  assert.equal(plan.legs.length, 1);
  assert.deepEqual(plan.legs[0], {
    id: "leg:direct:0:0:512:512:0:0:1024:512",
    from: coord(0, 0, 512, 512),
    to: coord(0, 0, 1024, 512),
    distanceUnits: 512,
    cycles: 1,
    supplyCost: 2,
    interruptionCauseId: null,
  });
  assert.deepEqual(plan.knownPorts, []);
  assert.deepEqual(plan.relayCandidates, []);
  assert.deepEqual(plan.knownAllies, []);
  assert.deepEqual(plan.repairOpportunities, []);
  assert.deepEqual(plan.forecastedWorldChanges, []);
  assert.deepEqual(run, before);
});

test("hostile picket carries only its saved authored interruption cause", () => {
  const run = runAtVanguard();
  const hostile = requirePlan(planTo("contact:hostile-picket", run));

  assert.equal(
    hostile.legs[0]?.interruptionCauseId,
    "fact:picket-patrol-active",
  );
  assert.equal(hostile.threat.dimensions.military.band, "high");
  assert.equal(hostile.threat.dimensions.logistical.band, "moderate");
  assert.deepEqual(hostile.threat.overall, {
    band: "high",
    confidence: "medium",
    presentation: "HIGH EXPOSURE",
  });

  run.historyFacts = run.historyFacts.filter(
    (fact) => fact.id !== "fact:picket-patrol-active",
  );
  const withoutCause = requirePlan(planTo("contact:hostile-picket", run));
  assert.equal(withoutCause.legs[0]?.interruptionCauseId, null);
  assert.notEqual(withoutCause.id, hostile.id);
});

test("blind coordinate preview is explicitly uncertain and never secretly lethal", () => {
  const result = planRoute(runAtVanguard(), {
    kind: "coordinate",
    coordinate: BLIND_FIXTURE_COORDINATE,
  });
  const plan = requirePlan(result);

  assert.deepEqual(
    {
      distanceUnits: plan.distanceUnits,
      elapsedCycles: plan.elapsedCycles,
      supplyCost: plan.supplyCost,
      projectedReserve: plan.projectedReserve,
    },
    {
      distanceUnits: 1810,
      elapsedCycles: 3,
      supplyCost: 5,
      projectedReserve: 7,
    },
  );
  for (const dimension of THREAT_DIMENSIONS) {
    const preview = plan.threat.dimensions[dimension];
    assert.equal(preview.band, "unknown");
    assert.equal(preview.confidence, "low");
    assert.deepEqual(preview.sources, []);
    assert.deepEqual(preview.unknownContributors, [
      "unobserved:0:0:1792:1792",
    ]);
  }
  assert.deepEqual(plan.threat.overall, {
    band: "unknown",
    confidence: "low",
    presentation: "UNCERTAIN — INCOMPLETE THREAT DATA",
  });
  assert.doesNotMatch(JSON.stringify(plan), /successProbability|success_percentage/i);
  assert.doesNotMatch(JSON.stringify(plan.threat), /severe/);
});

test("route output and identity are deterministic independent of observation order", () => {
  const firstRun = runAtVanguard();
  const secondRun = structuredClone(firstRun);
  secondRun.atlas.threatObservations.reverse();

  const first = requirePlan(planTo("contact:kepler", firstRun));
  const repeated = requirePlan(planTo("contact:kepler", firstRun));
  const reordered = requirePlan(planTo("contact:kepler", secondRun));

  assert.deepEqual(first, repeated);
  assert.deepEqual(first, reordered);
  assert.match(first.id, /^route:[0-9a-f]{8}:/);
});

test("route-plan identity changes for every immutable stale-plan input", () => {
  const baseRun = runAtVanguard();
  const base = requirePlan(planTo("contact:ashfall", baseRun));

  const changedCycle = structuredClone(baseRun);
  changedCycle.worldCycle += 1;
  const changedSupply = structuredClone(baseRun);
  changedSupply.resources.supply -= 1;
  const changedCapability = structuredClone(baseRun);
  changedCapability.ship.upgrades.engineBoost += 1;
  const changedOrigin = structuredClone(baseRun);
  changedOrigin.vessel.coordinate.localX += 1;
  const changedIdentity = structuredClone(baseRun);
  changedIdentity.identity.galaxySeed = "sector-zero-g0-alternate";

  const changedIds = [
    requirePlan(planTo("contact:ashfall", changedCycle)).id,
    requirePlan(planTo("contact:ashfall", changedSupply)).id,
    requirePlan(planTo("contact:ashfall", changedCapability)).id,
    requirePlan(planTo("contact:ashfall", changedOrigin)).id,
    requirePlan(planTo("contact:ashfall", changedIdentity)).id,
    requirePlan(planTo("contact:kepler", baseRun)).id,
    requirePlan(
      planRoute(
        baseRun,
        { kind: "contact", contactId: "contact:ashfall" },
        { ...G0_DIRECT_ROUTE_POLICY, allowBlindCoordinates: false },
      ),
    ).id,
  ];

  assert.equal(new Set([base.id, ...changedIds]).size, changedIds.length + 1);
});

test("unknown, hidden, and prototype-key contacts block without leaking authored coordinates", () => {
  const run = runAtVanguard();
  const knowledgeEntry = Object.entries(run.atlas.knowledge).find(
    ([, record]) => record.subjectId === "contact:ashfall",
  );
  assert.ok(knowledgeEntry);
  delete run.atlas.knowledge[knowledgeEntry[0]];

  for (const contactId of ["contact:missing", "__proto__", "constructor"]) {
    const result = planTo(contactId, run);
    assert.equal(result.ok, false);
    assert.ok(blockCodes(result).includes("unknown_contact"));
  }

  const hidden = planTo("contact:ashfall", run);
  assert.equal(hidden.ok, false);
  assert.ok(blockCodes(hidden).includes("unknown_contact"));
});

test("invalid, out-of-bounds, cross-sector, and inherited targets block with explicit reasons", () => {
  const run = runAtVanguard();
  const invalidTargets: Array<[AtlasTarget, string]> = [
    [
      {
        kind: "coordinate",
        coordinate: { sectorX: 0, sectorY: 0, localX: 12.5, localY: 512 },
      },
      "invalid_coordinate",
    ],
    [
      {
        kind: "coordinate",
        coordinate: { sectorX: 0, sectorY: 0, localX: 4096, localY: 512 },
      },
      "outside_g0_bounds",
    ],
    [
      {
        kind: "coordinate",
        coordinate: { sectorX: 1, sectorY: 0, localX: 512, localY: 512 },
      },
      "cross_sector_route",
    ],
  ];

  for (const [target, expectedCode] of invalidTargets) {
    const result = planRoute(run, target);
    assert.equal(result.ok, false);
    assert.ok(blockCodes(result).includes(expectedCode));
  }

  const inherited = Object.create({
    kind: "contact",
    contactId: "contact:ashfall",
  }) as AtlasTarget;
  const inheritedResult = planRoute(run, inherited);
  assert.equal(inheritedResult.ok, false);
  assert.ok(blockCodes(inheritedResult).includes("invalid_target"));
});

test("a malformed saved contact coordinate blocks instead of throwing", () => {
  const run = runAtVanguard();
  const ashfall = Object.values(run.atlas.materializedFacts).find(
    (fact) => fact.id === "contact:ashfall",
  );
  assert.ok(ashfall);
  ashfall.coordinate.localX = 12.5;

  const result = planTo("contact:ashfall", run);
  assert.equal(result.ok, false);
  assert.ok(blockCodes(result).includes("invalid_coordinate"));
});

test("unsupported generation identities return recoverable unsupported results", () => {
  const unsupportedGeneration = runAtVanguard();
  unsupportedGeneration.identity.generationVersion = 999;
  const generationResult = planTo("contact:ashfall", unsupportedGeneration);
  assert.equal(generationResult.ok, false);
  if (!generationResult.ok) {
    assert.equal(generationResult.status, "unsupported");
    assert.ok(
      generationResult.reasonDetails.some(
        (reason) => reason.code === "unsupported_generation_version",
      ),
    );
  }

  const unsupportedRegistry = runAtVanguard();
  unsupportedRegistry.identity.authoredAnchorRegistryVersion = 999;
  const registryResult = planTo("contact:ashfall", unsupportedRegistry);
  assert.equal(registryResult.ok, false);
  if (!registryResult.ok) {
    assert.equal(registryResult.status, "unsupported");
    assert.ok(
      registryResult.reasonDetails.some(
        (reason) => reason.code === "unsupported_registry_version",
      ),
    );
  }
});

test("non-stationary vessels and active commitments cannot preview another route", () => {
  for (const status of ["in_transit", "stranded"] as const) {
    const run = runAtVanguard();
    run.vessel.status = status;
    run.vessel.transitTransactionId = "travel:existing";
    const result = planTo("contact:ashfall", run);
    assert.equal(result.ok, false);
    assert.ok(blockCodes(result).includes("vessel_not_stationary"));
  }

  const run = runAtVanguard();
  run.activeTravel = {
    transactionId: "travel:existing",
    state: "advancing",
    routePlanId: "route:existing",
    origin: coord(0, 0, 512, 512),
    destination: coord(0, 0, 1024, 512),
    targetId: "contact:ashfall",
    legs: [],
    nextLegIndex: 0,
    appliedCheckpointIds: [],
    supplyCost: 2,
    elapsedCycles: 0,
    interruptionOperationId: null,
  };
  const result = planTo("contact:kepler", run);
  assert.equal(result.ok, false);
  assert.ok(blockCodes(result).includes("active_travel_exists"));
});

test("zero-distance travel and policy-disabled blind travel block explicitly", () => {
  const zeroDistance = planTo("contact:vanguard");
  assert.equal(zeroDistance.ok, false);
  assert.ok(blockCodes(zeroDistance).includes("already_at_destination"));

  const blindDisabled = planRoute(
    runAtVanguard(),
    { kind: "coordinate", coordinate: BLIND_FIXTURE_COORDINATE },
    { ...G0_DIRECT_ROUTE_POLICY, allowBlindCoordinates: false },
  );
  assert.equal(blindDisabled.ok, false);
  assert.ok(blockCodes(blindDisabled).includes("blind_travel_disabled"));
});

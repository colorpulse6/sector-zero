import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BLIND_FIXTURE_COORDINATE,
  getAuthoredAnchorRegistry,
} from "../../app/components/engine/galaxy/authoredAnchors";
import {
  G0_GENERATION_IDENTITY,
  G0_SECTOR_BOUNDS,
  chartFact,
  getGenerationAvailability,
  materializeCell,
  observeFact,
  recordNegativeSurvey,
  resolveCell,
  visitFact,
} from "../../app/components/engine/galaxy/atlas";
import { coord } from "../../app/components/engine/galaxy/coordinates";
import type {
  AtlasCellFact,
  AtlasGenerationIdentity,
  AtlasKnowledgeRecord,
  GalaxyAtlasState,
} from "../../app/components/engine/galaxy/galaxyTypes";

const AUTHORED_ANCHORS = [
  ["contact:vanguard", coord(0, 0, 512, 512)],
  ["contact:ashfall", coord(0, 0, 1024, 512)],
  ["contact:hostile-picket", coord(0, 0, 1280, 1024)],
  ["contact:kepler", coord(0, 0, 2048, 1024)],
  ["signal:unresolved-g0", coord(0, 0, 2816, 1792)],
] as const;

function expectFact(
  identity: AtlasGenerationIdentity,
  coordinate: ReturnType<typeof coord>,
): AtlasCellFact {
  const result = resolveCell(identity, coordinate);
  if (!result.ok) {
    assert.fail(result.reason);
  }
  assert.equal(result.ok, true);
  return result.fact;
}

function emptyAtlasState(): GalaxyAtlasState {
  return {
    materializedFacts: {},
    knowledge: {},
    mappedCellKeys: [],
    accessFacts: [],
    threatObservations: [],
  };
}

function knowledgeInput(
  fact: AtlasCellFact,
  overrides: Partial<Omit<AtlasKnowledgeRecord, "state" | "subjectId">> = {},
) {
  return {
    fact,
    record: {
      id: "knowledge:fixture",
      observedProperties: {
        label: "unverified contact",
        strength: 2,
        hostile: false,
        note: null,
      },
      confidence: "medium" as const,
      source: "report" as const,
      observedCycle: 17,
      expiresCycle: 41,
      ...overrides,
    },
  };
}

test("same complete generation identity and coordinate produces deep-identical facts", () => {
  const first = resolveCell(G0_GENERATION_IDENTITY, BLIND_FIXTURE_COORDINATE);
  const second = resolveCell(
    { ...G0_GENERATION_IDENTITY },
    { ...BLIND_FIXTURE_COORDINATE },
  );

  assert.deepEqual(second, first);
  assert.notEqual(second, first);
});

test("registry v1 keeps the non-authored blind fixture stable", () => {
  assert.deepEqual(expectFact(G0_GENERATION_IDENTITY, BLIND_FIXTURE_COORDINATE), {
    id: "procedural:f92b2a4b",
    cellKey: "0:0:7:7",
    coordinate: coord(0, 0, 1792, 1792),
    kind: "stellar_contact",
    contactId: "contact:procedural:f92b2a4b",
    stableSeed: 339038167,
    authored: false,
  });
});

test("registry version 999 returns the typed unsupported result", () => {
  assert.deepEqual(getAuthoredAnchorRegistry(999), {
    ok: false,
    reason: "unsupported_registry_version",
  });
});

test("the complete G0 generation identity is available", () => {
  const availability = getGenerationAvailability(G0_GENERATION_IDENTITY);

  assert.equal(availability.status, "available");
  assert.equal(availability.generationVersionAvailable, true);
  assert.equal(availability.authoredAnchorRegistryVersionAvailable, true);
});

test("generation version 999 is unavailable", () => {
  const availability = getGenerationAvailability({
    ...G0_GENERATION_IDENTITY,
    generationVersion: 999,
  });

  assert.equal(availability.status, "unavailable");
  assert.equal(availability.generationVersionAvailable, false);
  assert.equal(availability.authoredAnchorRegistryVersionAvailable, true);
});

test("registry version 999 is unavailable", () => {
  const availability = getGenerationAvailability({
    ...G0_GENERATION_IDENTITY,
    authoredAnchorRegistryVersion: 999,
  });

  assert.equal(availability.status, "unavailable");
  assert.equal(availability.generationVersionAvailable, true);
  assert.equal(availability.authoredAnchorRegistryVersionAvailable, false);
});

test("all authored IDs and coordinates stay reserved when only galaxySeed changes", () => {
  const alternateIdentity = {
    ...G0_GENERATION_IDENTITY,
    galaxySeed: "sector-zero-alternate",
  };

  for (const [id, coordinate] of AUTHORED_ANCHORS) {
    const original = expectFact(G0_GENERATION_IDENTITY, coordinate);
    const alternate = expectFact(alternateIdentity, coordinate);

    assert.equal(original.id, id);
    assert.equal(original.authored, true);
    assert.equal(alternate.id, id);
    assert.deepEqual(alternate.coordinate, coordinate);
    assert.equal(alternate.contactId, original.contactId);
    assert.equal(alternate.stableSeed, original.stableSeed);
  }
});

test("contact anchors resolve as stellar contacts and the unresolved anchor as signal", () => {
  for (const [id, coordinate] of AUTHORED_ANCHORS) {
    const fact = expectFact(G0_GENERATION_IDENTITY, coordinate);
    const isContact = id.startsWith("contact:");

    assert.equal(fact.kind, isContact ? "stellar_contact" : "signal");
    assert.equal(fact.contactId, isContact ? id : null);
  }
});

test("registry v1 has exactly five anchors and no relay reservation", () => {
  const result = getAuthoredAnchorRegistry(1);
  if (!result.ok) {
    assert.fail(result.reason);
  }
  assert.equal(result.ok, true);

  assert.deepEqual(
    result.anchors.map((anchor) => anchor.id),
    AUTHORED_ANCHORS.map(([id]) => id),
  );
  assert.equal(result.anchors.some((anchor) => /relay/i.test(anchor.id)), false);
});

test("repeated coordinates in one 256-unit cell return one stable procedural fact", () => {
  const first = expectFact(G0_GENERATION_IDENTITY, coord(0, 0, 1537, 1793));
  const second = expectFact(G0_GENERATION_IDENTITY, coord(0, 0, 1791, 2047));

  assert.equal(first.authored, false);
  assert.equal(second.authored, false);
  assert.equal(second.id, first.id);
  assert.deepEqual(second, first);
});

test("changing only galaxySeed changes a non-anchor cell", () => {
  const original = expectFact(G0_GENERATION_IDENTITY, BLIND_FIXTURE_COORDINATE);
  const alternate = expectFact(
    { ...G0_GENERATION_IDENTITY, galaxySeed: "sector-zero-g0-alternate" },
    BLIND_FIXTURE_COORDINATE,
  );

  assert.notEqual(alternate.id, original.id);
  assert.notEqual(alternate.stableSeed, original.stableSeed);
});

test("materializeCell prefers the serialized saved fact", () => {
  const saved = expectFact(G0_GENERATION_IDENTITY, BLIND_FIXTURE_COORDINATE);
  const regenerated = expectFact(
    { ...G0_GENERATION_IDENTITY, galaxySeed: "later-seed" },
    BLIND_FIXTURE_COORDINATE,
  );

  assert.equal(materializeCell(saved, regenerated), saved);
  assert.equal(materializeCell(null, regenerated), regenerated);
});

test("resolveCell dispatches generation before registry and never falls through", () => {
  assert.deepEqual(
    resolveCell(
      {
        galaxySeed: "unsupported",
        generationVersion: 999,
        authoredAnchorRegistryVersion: 999,
      },
      BLIND_FIXTURE_COORDINATE,
    ),
    { ok: false, reason: "unsupported_generation_version" },
  );
  assert.deepEqual(
    resolveCell(
      {
        ...G0_GENERATION_IDENTITY,
        authoredAnchorRegistryVersion: 999,
      },
      BLIND_FIXTURE_COORDINATE,
    ),
    { ok: false, reason: "unsupported_registry_version" },
  );
});

test("authored reservation wins for every coordinate inside an authored cell", () => {
  const resolved = expectFact(
    { ...G0_GENERATION_IDENTITY, galaxySeed: "must-not-reroll-authored" },
    coord(0, 0, 767, 767),
  );

  assert.equal(resolved.id, "contact:vanguard");
  assert.deepEqual(resolved.coordinate, coord(0, 0, 512, 512));
  assert.equal(resolved.kind, "stellar_contact");
  assert.equal(resolved.contactId, "contact:vanguard");
  assert.equal(resolved.authored, true);
});

test("procedural IDs and seeds pin the full identity tuple and cell address", () => {
  const fact = expectFact(G0_GENERATION_IDENTITY, BLIND_FIXTURE_COORDINATE);

  assert.equal(fact.id, "procedural:f92b2a4b");
  assert.equal(fact.stableSeed, 339038167);
  assert.equal(fact.cellKey, "0:0:7:7");
});

test("procedural kind selection uses the fixed explicit six-kind table", () => {
  const fixtures = [
    [coord(0, 0, 1, 1), "stellar_contact"],
    [coord(0, 0, 257, 1), "anomaly"],
    [coord(0, 0, 513, 1), "signal"],
    [coord(0, 0, 769, 1), "empty"],
    [coord(0, 0, 1281, 1), "hazard"],
    [coord(0, 0, 1, 513), "ruin"],
  ] as const;

  assert.deepEqual(
    fixtures.map(([coordinate]) =>
      expectFact(G0_GENERATION_IDENTITY, coordinate).kind,
    ),
    fixtures.map(([, kind]) => kind),
  );
});

test("public fixed constants and registry results cannot leak singleton mutation", () => {
  assert.deepEqual(G0_GENERATION_IDENTITY, {
    galaxySeed: "sector-zero-g0",
    generationVersion: 1,
    authoredAnchorRegistryVersion: 1,
  });
  assert.deepEqual(G0_SECTOR_BOUNDS, { min: 0, max: 4095, cellSize: 256 });
  assert.equal(Object.isFrozen(G0_GENERATION_IDENTITY), true);
  assert.equal(Object.isFrozen(G0_SECTOR_BOUNDS), true);
  assert.equal(Object.isFrozen(BLIND_FIXTURE_COORDINATE), true);

  const first = getAuthoredAnchorRegistry(1);
  const second = getAuthoredAnchorRegistry(1);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (!first.ok || !second.ok) {
    throw new Error("registry v1 must be supported");
  }
  assert.notEqual(first.anchors, second.anchors);
  assert.notEqual(first.anchors[0], second.anchors[0]);
  assert.notEqual(first.anchors[0].coordinate, second.anchors[0].coordinate);
  assert.equal(Object.isFrozen(first.anchors), true);
  assert.equal(Object.isFrozen(first.anchors[0]), true);
  assert.equal(Object.isFrozen(first.anchors[0].coordinate), true);
});

test("observeFact creates signal knowledge and preserves supplied metadata", () => {
  const fact = expectFact(G0_GENERATION_IDENTITY, BLIND_FIXTURE_COORDINATE);
  const input = knowledgeInput(fact);
  const prior = emptyAtlasState();
  const next = observeFact(prior, input);

  assert.deepEqual(next.knowledge[input.record.id], {
    ...input.record,
    subjectId: fact.id,
    state: "signal",
  });
  assert.deepEqual(next.materializedFacts[fact.cellKey], fact);
  assert.deepEqual(next.mappedCellKeys, []);
  assert.deepEqual(prior, emptyAtlasState());
});

test("an explicitly serialized unknown record promotes to signal", () => {
  const fact = expectFact(G0_GENERATION_IDENTITY, BLIND_FIXTURE_COORDINATE);
  const input = knowledgeInput(fact);
  const unknownRecord: AtlasKnowledgeRecord = {
    ...input.record,
    subjectId: fact.id,
    state: "unknown",
  };
  const prior: GalaxyAtlasState = {
    ...emptyAtlasState(),
    knowledge: { [unknownRecord.id]: unknownRecord },
  };
  const next = observeFact(prior, input);

  assert.equal(next.knowledge[input.record.id].state, "signal");
  assert.equal(prior.knowledge[input.record.id].state, "unknown");
});

test("chartFact and visitFact promote forward and map the cell once", () => {
  const fact = expectFact(G0_GENERATION_IDENTITY, BLIND_FIXTURE_COORDINATE);
  const observed = observeFact(emptyAtlasState(), knowledgeInput(fact));
  const chartInput = knowledgeInput(fact, {
    confidence: "high",
    source: "sensor",
    observedCycle: 18,
    expiresCycle: null,
    observedProperties: { chartQuality: 0.9 },
  });
  const charted = chartFact(observed, chartInput);
  const visitInput = knowledgeInput(fact, {
    source: "direct_visit",
    observedCycle: 23,
    observedProperties: { landed: true },
  });
  const visited = visitFact(charted, visitInput);

  assert.deepEqual(charted.knowledge[chartInput.record.id], {
    ...chartInput.record,
    subjectId: fact.id,
    state: "charted",
  });
  assert.deepEqual(visited.knowledge[visitInput.record.id], {
    ...visitInput.record,
    subjectId: fact.id,
    state: "visited",
  });
  assert.deepEqual(charted.mappedCellKeys, [fact.cellKey]);
  assert.deepEqual(visited.mappedCellKeys, [fact.cellKey]);
  assert.equal(observed.knowledge[chartInput.record.id].state, "signal");
  assert.equal(charted.knowledge[visitInput.record.id].state, "charted");
});

test("forward promotion preserves a saved materialization over a regenerated fact", () => {
  const savedFact = expectFact(
    G0_GENERATION_IDENTITY,
    BLIND_FIXTURE_COORDINATE,
  );
  const regeneratedFact = expectFact(
    { ...G0_GENERATION_IDENTITY, galaxySeed: "later-regeneration-seed" },
    BLIND_FIXTURE_COORDINATE,
  );
  const observed = observeFact(emptyAtlasState(), knowledgeInput(savedFact));
  const charted = chartFact(observed, knowledgeInput(regeneratedFact));

  assert.notEqual(regeneratedFact.id, savedFact.id);
  assert.deepEqual(charted.materializedFacts[savedFact.cellKey], savedFact);
  assert.equal(
    charted.knowledge["knowledge:fixture"].subjectId,
    savedFact.id,
  );
});

test("backward or duplicate promotion is a no-op", () => {
  const fact = expectFact(G0_GENERATION_IDENTITY, BLIND_FIXTURE_COORDINATE);
  const visited = visitFact(emptyAtlasState(), knowledgeInput(fact));

  assert.equal(chartFact(visited, knowledgeInput(fact)), visited);
  assert.equal(observeFact(visited, knowledgeInput(fact)), visited);
  assert.equal(visitFact(visited, knowledgeInput(fact)), visited);
});

test("lost-contact knowledge can be explicitly recovered at every promotion level", () => {
  const fact = expectFact(G0_GENERATION_IDENTITY, BLIND_FIXTURE_COORDINATE);
  const lostRecord: AtlasKnowledgeRecord = {
    ...knowledgeInput(fact).record,
    subjectId: fact.id,
    state: "lost_contact",
  };
  const lost = {
    ...emptyAtlasState(),
    knowledge: { [lostRecord.id]: lostRecord },
  };

  assert.equal(
    observeFact(lost, knowledgeInput(fact)).knowledge[lostRecord.id].state,
    "signal",
  );
  assert.equal(
    chartFact(lost, knowledgeInput(fact)).knowledge[lostRecord.id].state,
    "charted",
  );
  assert.equal(
    visitFact(lost, knowledgeInput(fact)).knowledge[lostRecord.id].state,
    "visited",
  );
});

test("knowledge updates do not alias prior state or caller-owned nested values", () => {
  const fact = expectFact(G0_GENERATION_IDENTITY, BLIND_FIXTURE_COORDINATE);
  const existingFact = expectFact(G0_GENERATION_IDENTITY, coord(0, 0, 1, 1));
  const prior: GalaxyAtlasState = {
    materializedFacts: { [existingFact.cellKey]: existingFact },
    knowledge: {
      existing: {
        id: "existing",
        subjectId: existingFact.id,
        state: "signal",
        observedProperties: { nestedBoundary: "flat-value" },
        confidence: "low",
        source: "rumor",
        observedCycle: 2,
        expiresCycle: 5,
      },
    },
    mappedCellKeys: [existingFact.cellKey],
    accessFacts: [
      {
        id: "access:1",
        subjectId: existingFact.id,
        assessment: "contested",
        causeFactIds: ["cause:1"],
        cycle: 3,
      },
    ],
    threatObservations: [
      {
        id: "threat:1",
        subjectId: existingFact.id,
        dimension: "military",
        band: "moderate",
        confidence: "low",
        source: "rumor",
        observedCycle: 3,
      },
    ],
  };
  const input = knowledgeInput(fact);
  const next = observeFact(prior, input);

  assert.notEqual(next, prior);
  assert.notEqual(next.materializedFacts, prior.materializedFacts);
  assert.notEqual(next.materializedFacts[existingFact.cellKey], existingFact);
  assert.notEqual(
    next.materializedFacts[existingFact.cellKey].coordinate,
    existingFact.coordinate,
  );
  assert.notEqual(next.knowledge, prior.knowledge);
  assert.notEqual(next.knowledge.existing, prior.knowledge.existing);
  assert.notEqual(
    next.knowledge.existing.observedProperties,
    prior.knowledge.existing.observedProperties,
  );
  assert.notEqual(next.mappedCellKeys, prior.mappedCellKeys);
  assert.notEqual(next.accessFacts, prior.accessFacts);
  assert.notEqual(next.accessFacts[0], prior.accessFacts[0]);
  assert.notEqual(
    next.accessFacts[0].causeFactIds,
    prior.accessFacts[0].causeFactIds,
  );
  assert.notEqual(next.threatObservations, prior.threatObservations);
  assert.notEqual(next.threatObservations[0], prior.threatObservations[0]);
  assert.notEqual(
    next.knowledge[input.record.id].observedProperties,
    input.record.observedProperties,
  );
  assert.notEqual(next.materializedFacts[fact.cellKey], fact);
  assert.notEqual(next.materializedFacts[fact.cellKey].coordinate, fact.coordinate);

  input.record.observedProperties.label = "caller mutation";
  fact.coordinate.localX = 999;
  assert.equal(
    next.knowledge[input.record.id].observedProperties.label,
    "unverified contact",
  );
  assert.equal(next.materializedFacts[fact.cellKey].coordinate.localX, 1792);
});

test("recordNegativeSurvey durably maps and materializes the supplied fact idempotently", () => {
  const fact = expectFact(G0_GENERATION_IDENTITY, coord(0, 0, 3841, 3841));
  const input = knowledgeInput(fact, {
    id: "knowledge:negative-survey:0:0:15:15",
    observedProperties: { surveyResult: "no_contact" },
    confidence: "high",
    source: "sensor",
    observedCycle: 29,
    expiresCycle: null,
  });
  const first = recordNegativeSurvey(emptyAtlasState(), input);
  const second = recordNegativeSurvey(first, input);

  assert.deepEqual(first.knowledge[input.record.id], {
    ...input.record,
    subjectId: fact.id,
    state: "charted",
  });
  assert.deepEqual(first.mappedCellKeys, [fact.cellKey]);
  assert.deepEqual(first.materializedFacts[fact.cellKey], fact);
  assert.equal(first.knowledge[input.record.id].expiresCycle, null);
  assert.equal(second, first);
});

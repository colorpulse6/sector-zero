import { test } from "node:test";
import assert from "node:assert/strict";
import { BLIND_FIXTURE_COORDINATE } from "../../app/components/engine/galaxy/authoredAnchors";
import { cellKey, coord } from "../../app/components/engine/galaxy/coordinates";
import { planRoute } from "../../app/components/engine/galaxy/routePlanner";
import { migrateSave } from "../../app/components/engine/save";
import type { SaveData } from "../../app/components/engine/types";
import {
  GALAXY_FIXTURES,
  applyGalaxyFixture,
  findGalaxyFixture,
} from "../../app/components/galaxy/devFixtures";

const FIXTURE_IDS = [
  "atlas-start",
  "known-route",
  "hostile-route",
  "blind-discovery",
  "insufficient-supply",
  "in-transit-reload",
] as const;

function legacySnapshot(save: SaveData): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(save)
      .filter(([key]) => key !== "activeExperience" && key !== "galaxyRun")
      .map(([key, value]) => [key, structuredClone(value)]),
  );
}

function requireFixture(id: (typeof FIXTURE_IDS)[number]) {
  const fixture = findGalaxyFixture(id);
  assert.ok(fixture, `missing fixture ${id}`);
  return fixture;
}

function seeded(id: (typeof FIXTURE_IDS)[number]): SaveData {
  const legacy = migrateSave({
    currentWorld: 8,
    credits: 9876,
    totalScore: 54321,
    completedQuests: ["legacy:quest"],
    completedPlanets: ["verdania"],
    missionsSinceStart: 77,
  });
  return applyGalaxyFixture(legacy, requireFixture(id));
}

test("fixture roster exposes the six fixed G0 playtest states", () => {
  assert.deepEqual(GALAXY_FIXTURES.map((fixture) => fixture.id), FIXTURE_IDS);
  assert.equal(new Set(GALAXY_FIXTURES.map((fixture) => fixture.id)).size, FIXTURE_IDS.length);
});

test("fixtures are deterministic, idempotent, and preserve every legacy top-level field", () => {
  const legacy = migrateSave({
    currentWorld: 7,
    credits: 1234,
    totalScore: 24680,
    levels: { "7-4": { completed: true, stars: 3, highScore: 9999 } },
    completedQuests: ["legacy:kept"],
    storyItems: ["legacy:item"],
    missionsSinceStart: 44,
  });
  const beforeLegacy = legacySnapshot(legacy);

  for (const fixture of GALAXY_FIXTURES) {
    const first = applyGalaxyFixture(legacy, fixture);
    const second = applyGalaxyFixture(first, fixture);
    const fromFreshInput = applyGalaxyFixture(legacy, fixture);

    assert.equal(first.activeExperience, "galaxy", fixture.id);
    assert.ok(first.galaxyRun, fixture.id);
    assert.deepEqual(second.galaxyRun, first.galaxyRun, `${fixture.id}: double apply`);
    assert.deepEqual(fromFreshInput.galaxyRun, first.galaxyRun, `${fixture.id}: repeat build`);
    assert.deepEqual(legacySnapshot(first), beforeLegacy, `${fixture.id}: first apply legacy isolation`);
    assert.deepEqual(legacySnapshot(second), beforeLegacy, `${fixture.id}: second apply legacy isolation`);
    assert.deepEqual(legacySnapshot(legacy), beforeLegacy, `${fixture.id}: input mutation`);
  }
});

test("route fixtures are reducer-authored commitments with canonical costs and causes", () => {
  const known = seeded("known-route").galaxyRun!;
  assert.equal(known.activeTravel?.state, "committed");
  assert.equal(known.activeTravel?.targetId, "contact:ashfall");
  assert.equal(known.activeTravel?.supplyCost, 2);
  assert.deepEqual(known.activeTravel?.appliedCheckpointIds, []);
  assert.equal(known.resources.supply, 10);

  const hostile = seeded("hostile-route").galaxyRun!;
  assert.equal(hostile.activeTravel?.state, "committed");
  assert.equal(hostile.activeTravel?.targetId, "contact:hostile-picket");
  assert.equal(hostile.activeTravel?.supplyCost, 3);
  assert.equal(hostile.activeTravel?.legs[0]?.interruptionCauseId, "fact:picket-patrol-active");
  assert.deepEqual(hostile.activeTravel?.appliedCheckpointIds, []);
  assert.equal(hostile.resources.supply, 9);
});

test("blind fixture records a deterministic public-reducer discovery", () => {
  const run = seeded("blind-discovery").galaxyRun!;
  const key = cellKey(BLIND_FIXTURE_COORDINATE);
  const fact = run.atlas.materializedFacts[key];

  assert.ok(fact);
  assert.deepEqual(run.vessel.coordinate, BLIND_FIXTURE_COORDINATE);
  assert.equal(run.vessel.status, "stationary");
  assert.equal(run.activeTravel?.state, "arrived");
  assert.equal(run.resources.supply, 7);
  assert.ok(
    Object.values(run.atlas.knowledge).some(
      (record) => record.subjectId === fact.id && record.state === "visited" && record.source === "direct_visit",
    ),
  );
});

test("insufficient-supply fixture reaches the blocked state through completed public travel", () => {
  const run = seeded("insufficient-supply").galaxyRun!;
  assert.equal(run.activeTravel, null);
  assert.deepEqual(run.vessel.coordinate, coord(0, 0, 512, 512));
  assert.equal(run.resources.supply, 2);
  assert.equal(run.worldCycle, 6);

  const result = planRoute(run, { kind: "contact", contactId: "contact:hostile-picket" });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.reasonDetails.some((reason) => reason.code === "insufficient_supply"));
});

test("reload fixture is exactly one checkpoint past a canonical hostile commitment", () => {
  const seededSave = seeded("in-transit-reload");
  const run = seededSave.galaxyRun!;
  assert.equal(run.activeTravel?.state, "interrupted");
  assert.equal(run.activeTravel?.targetId, "contact:hostile-picket");
  assert.equal(run.activeTravel?.nextLegIndex, 1);
  assert.deepEqual(run.activeTravel?.appliedCheckpointIds, [
    `${run.activeTravel?.transactionId}:leg:0`,
  ]);
  assert.equal(run.worldCycle, 2);
  assert.deepEqual(run.vessel.coordinate, coord(0, 0, 1280, 1024));

  const reloaded = migrateSave(JSON.parse(JSON.stringify(seededSave)) as Record<string, unknown>);
  assert.deepEqual(reloaded.galaxyRun, run);
});

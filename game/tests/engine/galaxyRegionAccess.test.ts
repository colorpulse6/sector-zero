import { test } from "node:test";
import assert from "node:assert/strict";
import { createFreshGalaxyRun } from "../../app/components/engine/galaxy/galaxyRun";
import { advanceTravelCheckpoint, finalizeTravel } from "../../app/components/engine/galaxy/travelResolver";
import type { GalaxyRunState } from "../../app/components/engine/galaxy/galaxyTypes";
import { migrateSave } from "../../app/components/engine/save";
import { applyGalaxyFixture, findGalaxyFixture } from "../../app/components/galaxy/devFixtures";
import { atlasRegionAccess } from "../../app/components/galaxy/regionAccess";

function runAtAshfall(): GalaxyRunState {
  const fixture = findGalaxyFixture("known-route");
  assert.ok(fixture);
  const committed = applyGalaxyFixture(migrateSave({}), fixture).galaxyRun;
  assert.ok(committed);
  const arrived = advanceTravelCheckpoint(committed);
  assert.ok(arrived.ok);
  const finalized = finalizeTravel(arrived.galaxyRun);
  assert.ok(finalized.ok);
  return finalized.galaxyRun;
}

test("region access is full only when the vessel is parked at a visited Ashfall", () => {
  const run = runAtAshfall();
  assert.equal(run.vessel.contactId, "contact:ashfall");
  assert.deepEqual(atlasRegionAccess(run, "contact:ashfall"), { status: "full", contactId: "contact:ashfall" });
});

test("a visited Ashfall is view-only while the vessel is elsewhere or moving", () => {
  const run = runAtAshfall();
  const away = { ...run, vessel: { ...run.vessel, contactId: "contact:vanguard" } };
  assert.deepEqual(atlasRegionAccess(away, "contact:ashfall"), { status: "view", contactId: "contact:ashfall" });
  const moving = { ...run, vessel: { ...run.vessel, status: "in_transit" as const } };
  assert.equal(atlasRegionAccess(moving, "contact:ashfall").status, "view");
});

test("an unacknowledged arrival at Ashfall is view-only until the travel record closes", () => {
  const fixture = findGalaxyFixture("known-route");
  assert.ok(fixture);
  const committed = applyGalaxyFixture(migrateSave({}), fixture).galaxyRun;
  assert.ok(committed);
  const arrived = advanceTravelCheckpoint(committed);
  assert.ok(arrived.ok);
  assert.equal(arrived.galaxyRun.activeTravel?.state, "arrived");
  assert.equal(arrived.galaxyRun.vessel.contactId, "contact:ashfall");
  assert.equal(atlasRegionAccess(arrived.galaxyRun, "contact:ashfall").status, "view");
});

test("region access explains why it is unavailable", () => {
  const fresh = createFreshGalaxyRun();
  assert.deepEqual(atlasRegionAccess(fresh, "contact:ashfall"), { status: "unavailable", reason: "ARRIVE AT ASHFALL FIRST" });
  assert.deepEqual(atlasRegionAccess(fresh, "contact:vanguard"), { status: "unavailable", reason: "NO REGION CHART HERE" });
  assert.deepEqual(atlasRegionAccess(fresh, null), { status: "unavailable", reason: "SELECT A COLONY STAR" });
  assert.deepEqual(atlasRegionAccess(null, "contact:ashfall"), { status: "unavailable", reason: "SELECT A COLONY STAR" });
});

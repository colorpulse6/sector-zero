// OW-0: dev fixtures cover colony STAGES (grown / strained), not just times of day.

import { test } from "node:test";
import assert from "node:assert/strict";
import { COLONY_FIXTURES, findFixture, applyColonyFixture } from "../../app/components/colony/dev/seedColony";
import { runStandardInvariants } from "../../app/components/colony/shared/colonyAssert";
import { generateExteriorState } from "../../app/components/colony/exploration/colonyLayout";
import { makeTestSave } from "./fixtures";
import { migrateSave } from "../../app/components/engine/save";
import { bootstrapColonyEvent } from "../../app/components/colony/meta/ColoniesScreen";
import { colonyReducer } from "../../app/components/colony/shared/colonyReducer";

test("fixture roster: original three retained, grown + strained added", () => {
  const ids = COLONY_FIXTURES.map(f => f.id);
  for (const id of ["day", "night", "build", "grown", "strained", "region"]) {
    assert.ok(ids.includes(id), `missing fixture ${id}`);
  }
});

test("bootstrap grants no resources", () => {
  const fresh = migrateSave({});
  const founded = colonyReducer(fresh, bootstrapColonyEvent(fresh));
  assert.deepEqual(founded.colonies[0].resources, { food: 0, water: 0, metal: 0, credits: 0 });
});

test("REGION fixture provides deterministic affordable M1 state", () => {
  const fx = findFixture("region")!;
  const first = applyColonyFixture(migrateSave({}), fx).save;
  const second = applyColonyFixture(migrateSave({}), fx).save;
  assert.deepEqual(first, second);
  const colony = first.colonies.find(c => c.id === "fx_region")!;
  assert.deepEqual(colony.resources, { food: 250, water: 250, metal: 600, credits: 0 });
  const nodes = new Map(first.planets[0].regionMap.nodes.map(n => [n.id, n.intel]));
  assert.equal(nodes.get("ashfall-cinder-relay"), "surveyed");
  assert.equal(nodes.get("ashfall-oathbreaker-wreck"), "surveyed");
  assert.equal(nodes.get("ashfall-glassknife-canyon"), "rumored");
  assert.equal(nodes.get("ashfall-basalt-basin"), "surveyed");
});

test("every fixture applies cleanly and yields an invariant-clean colony", () => {
  for (const fx of COLONY_FIXTURES) {
    const { save, colonyId } = applyColonyFixture(makeTestSave(), fx);
    const colony = save.colonies.find(c => c.id === colonyId);
    assert.ok(colony, `${fx.id}: colony not created`);
    runStandardInvariants(colony!);
    assert.equal(save.gameClock.hour, fx.hour, `${fx.id}: gameClock hour applied`);
    // Every fixture must also survive FP exterior generation (DevPanel descends immediately)
    const state = generateExteriorState(colony!, save.gameClock);
    assert.ok(state.map.tiles.length > 0, `${fx.id}: exterior generation failed`);
  }
});

test("GROWN: all 5 building types operational (incl. mine), pop 20 at capacity 20, healthy", () => {
  const fx = findFixture("grown")!;
  const { save, colonyId } = applyColonyFixture(makeTestSave(), fx);
  const colony = save.colonies.find(c => c.id === colonyId)!;

  const operationalTypes = new Set(
    colony.buildings.filter(b => b.status === "operational").map(b => b.type),
  );
  for (const t of ["solar_array", "farm", "water_purifier", "habitat_module", "mine"] as const) {
    assert.ok(operationalTypes.has(t), `grown: ${t} should be operational`);
  }
  assert.equal(colony.population.total, 20);
  assert.equal(colony.population.capacity, 20, "2 operational habitats → capacity 20");
  assert.ok(colony.happiness > 60, `grown colony should be happy, got ${colony.happiness}`);
  assert.ok(colony.resources.food >= 100, "healthy food stockpile");
  assert.ok(colony.resources.water >= 100, "healthy water stockpile");
});

test("STRAINED: operational buildings but starving — pop 12, happiness ~30, food/water near zero", () => {
  const fx = findFixture("strained")!;
  const { save, colonyId } = applyColonyFixture(makeTestSave(), fx);
  const colony = save.colonies.find(c => c.id === colonyId)!;

  assert.ok(colony.buildings.every(b => b.status === "operational"), "all strained buildings operational");
  assert.equal(colony.population.total, 12);
  assert.equal(colony.happiness, 30);
  assert.ok(colony.resources.food <= 5, `food near zero, got ${colony.resources.food}`);
  assert.ok(colony.resources.water <= 5, `water near zero, got ${colony.resources.water}`);
});

test("fixtures are idempotent: reseeding the same fixture keeps one colony", () => {
  const fx = findFixture("grown")!;
  let { save } = applyColonyFixture(makeTestSave(), fx);
  ({ save } = applyColonyFixture(save, fx));
  assert.equal(save.colonies.filter(c => c.id === "fx_grown").length, 1);
});

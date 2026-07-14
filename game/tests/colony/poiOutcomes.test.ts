import { test } from "node:test";
import assert from "node:assert/strict";
import { migrateSave } from "../../app/components/engine/save";
import { colonyReducer } from "../../app/components/colony/shared/colonyReducer";
import { Events } from "../../app/components/colony/shared/colonyEvents";
import { createPoiOutcome, confirmPoiOutcome, POI_CARGO } from "../../app/components/colony/region/poiOutcomes";

function saveWithSurveyedPoi() {
  const fresh = migrateSave({});
  let save = colonyReducer(fresh, Events.founded({ colonyId: "home", name: "Home", planetId: "ashfall", foundingType: "outpost", regionNodeId: "ashfall-forward-camp", missionCount: 0, layoutSeed: 1 }));
  save = { ...save, planets: save.planets.map(planet => ({ ...planet, regionMap: { ...planet.regionMap, nodes: planet.regionMap.nodes.map(node => node.id === "ashfall-cinder-relay" ? { ...node, intel: "surveyed" as const, discovered: true } : node) } })) };
  return save;
}

test("first clear reveals neighbors and delivers cargo once", () => {
  const save = saveWithSurveyedPoi();
  const created = createPoiOutcome(save, "home", "ashfall-cinder-relay");
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(created.save.planets[0].regionMap.nodes.find(n => n.id === "ashfall-cinder-relay")?.intel, "cleared");
  assert.equal(created.save.planets[0].regionMap.nodes.find(n => n.id === "ashfall-glassknife-canyon")?.intel, "rumored");
  const confirmed = confirmPoiOutcome(save, created.outcome, "home");
  assert.equal(confirmed.ok, true);
  if (!confirmed.ok) return;
  assert.deepEqual(confirmed.delivery.payload, POI_CARGO);
  assert.equal(confirmed.save.colonies[0].resources.metal, 80);
  const duplicate = confirmPoiOutcome(confirmed.save, created.outcome, "home");
  assert.equal(duplicate.ok, false);
  assert.strictEqual(duplicate.save, confirmed.save);
});

test("invalid destination and replay cannot award cargo", () => {
  const save = saveWithSurveyedPoi();
  const created = createPoiOutcome(save, "home", "ashfall-cinder-relay");
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const missing = confirmPoiOutcome(save, created.outcome, "missing");
  assert.equal(missing.ok, false);
  assert.strictEqual(missing.save, save);
  assert.equal(createPoiOutcome(created.save, "home", "ashfall-cinder-relay").ok, false);
});

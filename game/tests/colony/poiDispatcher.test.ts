import { test } from "node:test";
import assert from "node:assert/strict";
import { migrateSave } from "../../app/components/engine/save";
import { colonyReducer } from "../../app/components/colony/shared/colonyReducer";
import { Events } from "../../app/components/colony/shared/colonyEvents";
import { dispatchPoi, startRegionExpedition } from "../../app/components/colony/region/poiDispatcher";

function ready(nodeId: string) {
  const fresh = migrateSave({});
  let save = colonyReducer(fresh, Events.founded({ colonyId: "ashfall_primary", name: "Ashfall", planetId: "ashfall", foundingType: "outpost", regionNodeId: "ashfall-forward-camp", missionCount: 0, layoutSeed: 42 }));
  save = { ...save, planets: save.planets.map(planet => ({ ...planet, regionMap: { ...planet.regionMap, nodes: planet.regionMap.nodes.map(node => node.id === nodeId ? { ...node, intel: "surveyed" as const, discovered: true } : node) } })) };
  return save;
}

test("dispatcher maps the authored POI ids to native engines", () => {
  assert.equal(dispatchPoi(ready("ashfall-cinder-relay"), "ashfall_primary", "ashfall-cinder-relay").ok, true);
  const ruin = dispatchPoi(ready("ashfall-cinder-relay"), "ashfall_primary", "ashfall-cinder-relay");
  const wreck = dispatchPoi(ready("ashfall-oathbreaker-wreck"), "ashfall_primary", "ashfall-oathbreaker-wreck");
  assert.equal(ruin.ok && ruin.session.engine, "firstPerson");
  assert.equal(wreck.ok && wreck.session.engine, "boarding");
});

test("travel costs one cycle and duplicate/rejected requests do not mutate", () => {
  const save = ready("ashfall-cinder-relay");
  const request = { kind: "poi" as const, originColonyId: "ashfall_primary", targetNodeId: "ashfall-cinder-relay" };
  const launched = startRegionExpedition(save, request, null);
  assert.equal(launched.ok, true);
  assert.equal(launched.save.missionsSinceStart, 1);
  const duplicate = startRegionExpedition(save, request, "active");
  assert.equal(duplicate.ok, false);
  assert.strictEqual(duplicate.save, save);
  const blocked = dispatchPoi(ready("ashfall-basalt-basin"), "ashfall_primary", "ashfall-basalt-basin");
  assert.equal(blocked.ok, false);
});

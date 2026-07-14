import { test } from "node:test";
import assert from "node:assert/strict";
import { migrateSave } from "../../app/components/engine/save";
import { colonyReducer } from "../../app/components/colony/shared/colonyReducer";
import { Events } from "../../app/components/colony/shared/colonyEvents";
import { checkRegionAction, surveyRegionNode } from "../../app/components/colony/region/siteEconomy";

function claimedAshfallSave() {
  const fresh = migrateSave({});
  return colonyReducer(fresh, Events.founded({
    colonyId: "ashfall_primary",
    name: "Ashfall Primary",
    planetId: "ashfall",
    foundingType: "outpost",
    regionNodeId: "ashfall-forward-camp",
    missionCount: fresh.missionsSinceStart,
    layoutSeed: 42,
  }));
}

function intel(save: ReturnType<typeof claimedAshfallSave>, nodeId: string) {
  return save.planets[0].regionMap.nodes.find(node => node.id === nodeId)?.intel;
}

test("region actions require a claimed origin colony node", () => {
  const save = migrateSave({});
  assert.deepEqual(checkRegionAction(save, "missing", "ashfall-cinder-relay", "survey"), {
    allowed: false,
    reason: "origin_colony_missing",
  });

  const withColony = claimedAshfallSave();
  assert.equal(intel(withColony, "ashfall-forward-camp"), "claimed");
  assert.deepEqual(checkRegionAction(withColony, "ashfall_primary", "ashfall-cinder-relay", "survey"), {
    allowed: true,
    reason: null,
  });
});

test("unknown and non-adjacent nodes cannot be surveyed from the origin pad", () => {
  const save = claimedAshfallSave();
  assert.deepEqual(checkRegionAction(save, "ashfall_primary", "ashfall-glassknife-canyon", "survey"), {
    allowed: false,
    reason: "target_unknown",
  });

  const withRumor = {
    ...save,
    planets: save.planets.map(planet => ({
      ...planet,
      regionMap: {
        ...planet.regionMap,
        nodes: planet.regionMap.nodes.map(node => node.id === "ashfall-glassknife-canyon"
          ? { ...node, intel: "rumored" as const }
          : node),
      },
    })),
  };
  assert.deepEqual(checkRegionAction(withRumor, "ashfall_primary", "ashfall-glassknife-canyon", "survey"), {
    allowed: false,
    reason: "target_not_adjacent",
  });
});

test("survey expedition advances exactly one cycle and reveals adjacent unknown nodes", () => {
  const before = claimedAshfallSave();
  const result = surveyRegionNode(before, "ashfall_primary", "ashfall-cinder-relay");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.save.missionsSinceStart, before.missionsSinceStart + 1);
  assert.equal(intel(result.save, "ashfall-cinder-relay"), "surveyed");
  assert.equal(intel(result.save, "ashfall-glassknife-canyon"), "rumored");
  assert.equal(before.missionsSinceStart, 0, "input save must not mutate");
  assert.equal(intel(before, "ashfall-cinder-relay"), "rumored");
});

test("rejected or repeated survey does not advance the cycle", () => {
  const before = claimedAshfallSave();
  const rejected = surveyRegionNode(before, "ashfall_primary", "ashfall-glassknife-canyon");
  assert.equal(rejected.ok, false);
  assert.strictEqual(rejected.save, before);
  assert.equal(rejected.save.missionsSinceStart, 0);

  const first = surveyRegionNode(before, "ashfall_primary", "ashfall-cinder-relay");
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const repeated = surveyRegionNode(first.save, "ashfall_primary", "ashfall-cinder-relay");
  assert.equal(repeated.ok, false);
  assert.strictEqual(repeated.save, first.save);
  assert.equal(repeated.save.missionsSinceStart, 1);
});

test("travel requires a surveyed POI; cleared POIs remain replayable", () => {
  const before = claimedAshfallSave();
  assert.deepEqual(checkRegionAction(before, "ashfall_primary", "ashfall-cinder-relay", "travel"), {
    allowed: false,
    reason: "target_not_surveyed",
  });
  const surveyed = surveyRegionNode(before, "ashfall_primary", "ashfall-cinder-relay");
  assert.equal(surveyed.ok, true);
  if (!surveyed.ok) return;
  assert.equal(checkRegionAction(surveyed.save, "ashfall_primary", "ashfall-cinder-relay", "travel").allowed, true);

  const cleared = colonyReducer(surveyed.save, Events.poiCleared({
    colonyId: "ashfall_primary",
    regionNodeId: "ashfall-cinder-relay",
  }));
  assert.equal(checkRegionAction(cleared, "ashfall_primary", "ashfall-cinder-relay", "travel").allowed, true);
  assert.deepEqual(checkRegionAction(cleared, "ashfall_primary", "ashfall-cinder-relay", "survey"), {
    allowed: false,
    reason: "target_not_rumored",
  });
});

test("colony sites cannot be entered as POI travel targets", () => {
  const before = claimedAshfallSave();
  const surveyed = surveyRegionNode(before, "ashfall_primary", "ashfall-basalt-basin");
  assert.equal(surveyed.ok, true);
  if (!surveyed.ok) return;
  assert.deepEqual(checkRegionAction(surveyed.save, "ashfall_primary", "ashfall-basalt-basin", "travel"), {
    allowed: false,
    reason: "target_not_poi",
  });
});

test("regionSurveyed reducer event cannot bypass adjacency or downgrade a cleared POI", () => {
  const before = claimedAshfallSave();
  const bypass = colonyReducer(before, Events.regionSurveyed({
    colonyId: "ashfall_primary",
    regionNodeId: "ashfall-glassknife-canyon",
  }));
  assert.strictEqual(bypass, before);

  const surveyed = surveyRegionNode(before, "ashfall_primary", "ashfall-cinder-relay");
  assert.equal(surveyed.ok, true);
  if (!surveyed.ok) return;
  const cleared = colonyReducer(surveyed.save, Events.poiCleared({
    colonyId: "ashfall_primary",
    regionNodeId: "ashfall-cinder-relay",
  }));
  const downgrade = colonyReducer(cleared, Events.regionSurveyed({
    colonyId: "ashfall_primary",
    regionNodeId: "ashfall-cinder-relay",
  }));
  assert.strictEqual(downgrade, cleared);
  assert.equal(intel(downgrade, "ashfall-cinder-relay"), "cleared");
});

test("colony/founded cannot forge a claimed origin on a POI", () => {
  const before = migrateSave({});
  const forged = colonyReducer(before, Events.founded({
    colonyId: "forged_ruin",
    name: "Forged Ruin",
    planetId: "ashfall",
    foundingType: "outpost",
    regionNodeId: "ashfall-cinder-relay",
    missionCount: before.missionsSinceStart,
    layoutSeed: 99,
  }));

  assert.strictEqual(forged, before);
  assert.equal(forged.colonies.length, 0);
  assert.equal(intel(forged, "ashfall-cinder-relay"), "rumored");
});

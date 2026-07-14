import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REGION_INTEL_ORDER,
  createPlanetRegionState,
  generateRegionMap,
} from "../../app/components/colony/region/regionMap";

test("regionMap: Ashfall generation is deterministic for a seed", () => {
  assert.deepEqual(generateRegionMap("ashfall", 4107), generateRegionMap("ashfall", 4107));
});

test("regionMap: different seeds vary generated node data", () => {
  const first = generateRegionMap("ashfall", 4107);
  const second = generateRegionMap("ashfall", 4108);
  assert.notDeepEqual(first.nodes.map(node => ({ coords: node.coords, stats: node.siteStats })),
    second.nodes.map(node => ({ coords: node.coords, stats: node.siteStats })));
});

test("regionMap: Ashfall has the M1 vertical-slice node roster", () => {
  const map = generateRegionMap("ashfall", 4107);
  const types = map.nodes.map(node => node.type);
  assert.equal(map.nodes.length, 6);
  assert.equal(types.filter(type => type === "colony_site").length, 3);
  assert.ok(types.includes("ruins"));
  assert.ok(types.includes("wreck"));
  assert.ok(types.includes("cave"));
  const anchor = map.nodes.find(node => node.id === "ashfall-forward-camp");
  assert.equal(anchor?.intel, "surveyed");
  assert.deepEqual(anchor?.siteStats, {
    oreDensity: 50, waterTable: 50, buildableSlots: 6, threat: 50,
  });
});

test("regionMap: edges reference real nodes and the graph is connected", () => {
  const map = generateRegionMap("ashfall", 4107);
  const ids = new Set(map.nodes.map(node => node.id));
  for (const [from, to] of map.edges) {
    assert.ok(ids.has(from), `missing edge origin ${from}`);
    assert.ok(ids.has(to), `missing edge target ${to}`);
  }

  const seen = new Set<string>([map.nodes[0].id]);
  while (true) {
    const before = seen.size;
    for (const [from, to] of map.edges) {
      if (seen.has(from)) seen.add(to);
      if (seen.has(to)) seen.add(from);
    }
    if (seen.size === before) break;
  }
  assert.equal(seen.size, map.nodes.length);
});

test("regionMap: generated site stats stay inside M1 bounds", () => {
  const map = generateRegionMap("ashfall", 4107);
  const sites = map.nodes.filter(node => node.type === "colony_site");
  for (const node of sites) {
    assert.ok(node.siteStats);
    assert.ok(node.siteStats.oreDensity >= 0 && node.siteStats.oreDensity <= 100);
    assert.ok(node.siteStats.waterTable >= 0 && node.siteStats.waterTable <= 100);
    assert.ok(node.siteStats.threat >= 0 && node.siteStats.threat <= 100);
    assert.ok(node.siteStats.buildableSlots >= 3 && node.siteStats.buildableSlots <= 6);
  }
});

test("regionMap: intel ordering is explicit and planet state carries the seed", () => {
  assert.deepEqual(REGION_INTEL_ORDER, ["unknown", "rumored", "surveyed", "cleared", "claimed"]);
  const planet = createPlanetRegionState("ashfall", 4107);
  assert.equal(planet.regionMap.seed, 4107);
  assert.equal(planet.biome, "desert");
  assert.equal(planet.campaignUnlocked, true);
});

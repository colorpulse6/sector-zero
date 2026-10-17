import { test } from "node:test";
import assert from "node:assert/strict";
import { BIOME_PALETTES, generateRegionTerrain } from "../../app/components/colony/meta/regionMapTerrain";
import { ASHFALL_REGION_SEED } from "../../app/components/colony/region/regionMap";

test("region terrain is deterministic per seed and biome and stays inside the chart", () => {
  const first = generateRegionTerrain(ASHFALL_REGION_SEED, "desert");
  const second = generateRegionTerrain(ASHFALL_REGION_SEED, "desert");
  assert.deepEqual(first, second);
  assert.notDeepEqual(first, generateRegionTerrain(ASHFALL_REGION_SEED + 1, "desert"));
  assert.notDeepEqual(first, generateRegionTerrain(ASHFALL_REGION_SEED, "ice"));
  assert.ok(first.contours.length >= 9);
  assert.ok(first.ridges.length >= 5);
  assert.equal(first.specks.length, 42);
  for (const speck of first.specks) {
    assert.ok(speck.x >= 0 && speck.x <= 100);
    assert.ok(speck.y >= 0 && speck.y <= 100);
  }
});

test("every biome has a chart palette", () => {
  for (const biome of ["ice", "volcanic", "ocean", "desert", "jungle", "urban", "barren", "toxic"] as const) {
    assert.ok(BIOME_PALETTES[biome].base.length > 0);
    assert.ok(BIOME_PALETTES[biome].label.length > 0);
  }
});

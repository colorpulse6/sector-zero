import { test } from "node:test";
import assert from "node:assert/strict";
import { BUILDING_FOOTPRINTS, INTERIOR_TEMPLATES } from "../../app/components/colony/exploration/buildingTiles";

const PHASE_1_BUILDING_TYPES = ["solar_array", "farm", "water_purifier", "habitat_module"] as const;
const REGISTERED_INTERIOR_TYPES = [...PHASE_1_BUILDING_TYPES, "mine", "cantina"] as const;

test("BUILDING_FOOTPRINTS: has entries for all Phase 1 types", () => {
  for (const t of PHASE_1_BUILDING_TYPES) {
    assert.ok(BUILDING_FOOTPRINTS[t], `missing footprint for ${t}`);
  }
});

test("BUILDING_FOOTPRINTS: each entry has valid dims and doorSide", () => {
  for (const t of PHASE_1_BUILDING_TYPES) {
    const fp = BUILDING_FOOTPRINTS[t]!;
    assert.ok(fp.w >= 3 && fp.h >= 3, `${t} footprint too small: ${fp.w}x${fp.h}`);
    assert.ok(fp.w <= 4 && fp.h <= 4, `${t} footprint too large: ${fp.w}x${fp.h}`);
    assert.ok(["north", "south", "east", "west"].includes(fp.doorSide), `${t} bad doorSide: ${fp.doorSide}`);
    assert.ok(fp.interiorTemplateId, `${t} missing interiorTemplateId`);
  }
});

test("INTERIOR_TEMPLATES: every referenced template ID exists", () => {
  for (const t of REGISTERED_INTERIOR_TYPES) {
    const fp = BUILDING_FOOTPRINTS[t]!;
    assert.ok(fp, `${t} missing footprint`);
    const tmpl = INTERIOR_TEMPLATES[fp.interiorTemplateId];
    assert.ok(tmpl, `${t} references missing template ${fp.interiorTemplateId}`);
  }
});

test("INTERIOR_TEMPLATES: each has exactly one exit-door tile", () => {
  for (const [id, tmpl] of Object.entries(INTERIOR_TEMPLATES)) {
    const doorCount = tmpl.tiles.filter(row => row.includes("D")).reduce(
      (n, row) => n + [...row].filter(c => c === "D").length,
      0
    );
    assert.equal(doorCount, 1, `template ${id} has ${doorCount} exit doors, expected 1`);
  }
});

test("INTERIOR_TEMPLATES: each has a spawn pointing north", () => {
  for (const [id, tmpl] of Object.entries(INTERIOR_TEMPLATES)) {
    assert.equal(tmpl.spawn.facing, "north", `template ${id} spawn must face north`);
    assert.ok(tmpl.spawn.x >= 0 && tmpl.spawn.x < tmpl.width, `template ${id} spawn x out of bounds`);
    assert.ok(tmpl.spawn.y >= 0 && tmpl.spawn.y < tmpl.height, `template ${id} spawn y out of bounds`);
  }
});

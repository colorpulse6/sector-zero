// OW-0: the mine is buildable — commission menu entry, affordability,
// and an FP exterior/interior presence (footprint + interior template).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PHASE_1_BUILD_OPTIONS,
  canAfford,
  shortfallMessage,
} from "../../app/components/colony/meta/ColonyCommissionMenu";
import { HABITAT_CAPACITY_PER_MODULE } from "../../app/components/colony/shared/colonyCatalog";
import { BUILDING_FOOTPRINTS, INTERIOR_TEMPLATES } from "../../app/components/colony/exploration/buildingTiles";
import { generateExteriorState, generateInteriorState, assignSlots } from "../../app/components/colony/exploration/colonyLayout";
import { OUTPOST_TEMPLATE } from "../../app/components/colony/exploration/outpostTemplate";
import { makeTestColony, makeBuilding } from "./fixtures";

test("build menu: mine option exists at 150 metal, 2 cycles", () => {
  const mine = PHASE_1_BUILD_OPTIONS.find(o => o.type === "mine");
  assert.ok(mine, "mine must be in the Phase 1 build menu");
  assert.deepEqual(mine!.cost, { metal: 150 });
  assert.equal(mine!.cyclesToBuild, 2);
  assert.ok(mine!.shortDesc.includes("+10 metal"), `shortDesc should advertise production, got "${mine!.shortDesc}"`);
});

test("build menu: habitat 'Houses N' copy derives from HABITAT_CAPACITY_PER_MODULE", () => {
  const habitat = PHASE_1_BUILD_OPTIONS.find(o => o.type === "habitat_module")!;
  assert.equal(habitat.shortDesc, `Houses ${HABITAT_CAPACITY_PER_MODULE}`);
});

test("build menu affordability: mine affordable at exactly 150 metal, not at 149", () => {
  const rich = makeTestColony({ resources: { food: 0, water: 0, metal: 150, credits: 0 } });
  const poor = makeTestColony({ resources: { food: 0, water: 0, metal: 149, credits: 0 } });
  const mine = PHASE_1_BUILD_OPTIONS.find(o => o.type === "mine")!;
  assert.equal(canAfford(rich, mine.cost), true);
  assert.equal(canAfford(poor, mine.cost), false);
  assert.equal(shortfallMessage(poor.resources, mine.cost), "Need 1 more metal");
});

test("build menu affordability: founding grant (500 metal) covers each option individually", () => {
  const founded = makeTestColony({ resources: { food: 0, water: 0, metal: 500, credits: 0 } });
  for (const opt of PHASE_1_BUILD_OPTIONS) {
    assert.equal(canAfford(founded, opt.cost), true, `${opt.type} should be affordable after founding`);
  }
});

test("every build-menu type has an FP footprint and interior template", () => {
  for (const opt of PHASE_1_BUILD_OPTIONS) {
    const fp = BUILDING_FOOTPRINTS[opt.type];
    assert.ok(fp, `${opt.type} missing BUILDING_FOOTPRINTS entry`);
    assert.ok(INTERIOR_TEMPLATES[fp!.interiorTemplateId], `${opt.type} missing interior template`);
    assert.ok(fp!.wallSpriteId, `${opt.type} missing wall sprite`);
  }
});

test("mine footprint fits every outpost slot", () => {
  const fp = BUILDING_FOOTPRINTS.mine!;
  for (const slot of OUTPOST_TEMPLATE.slots) {
    assert.ok(fp.w <= slot.maxFootprint.w && fp.h <= slot.maxFootprint.h,
      `mine ${fp.w}x${fp.h} exceeds slot ${slot.id} max ${slot.maxFootprint.w}x${slot.maxFootprint.h}`);
  }
});

test("FP exterior: operational mine renders walls, texture, and a door", () => {
  const colony = makeTestColony({ buildings: [makeBuilding("mine")] });
  const clock = { day: 0, hour: 12, minute: 0, realtimeMsPerGameMinute: 1000, season: "standard" as const };
  const state = generateExteriorState(colony, clock);
  const { tiles, wallTextureMap } = state.map;
  const mineSprite = BUILDING_FOOTPRINTS.mine!.wallSpriteId;

  let texturedWalls = 0;
  let doors = 0;
  for (let y = 0; y < state.map.height; y++) {
    for (let x = 0; x < state.map.width; x++) {
      if (wallTextureMap?.[y][x] === mineSprite && tiles[y][x] === "wall") texturedWalls++;
      if (tiles[y][x] === "door") doors++;
    }
  }
  // 3x3 footprint → 8 perimeter cells, one carved into the door.
  assert.equal(texturedWalls, 7, "mine perimeter walls carry the mine wall texture");
  assert.equal(doors, 1, "mine door carved");
});

test("FP interior: mine interior generates a 6x6 room with a prop", () => {
  const state = generateInteriorState(makeBuilding("mine"), 42);
  assert.equal(state.map.width, 6);
  assert.equal(state.map.height, 6);
  assert.ok((state.props?.length ?? 0) >= 1, "mine interior should have the extraction rig prop");
});

test("slot assignment: a 5-building colony (5th type = mine) gets 5 distinct slots", () => {
  const colony = makeTestColony({
    buildings: [
      makeBuilding("solar_array"),
      makeBuilding("farm"),
      makeBuilding("water_purifier"),
      makeBuilding("habitat_module"),
      makeBuilding("mine"),
    ],
  });
  const slotMap = assignSlots(colony);
  assert.equal(slotMap.size, 5);
  assert.equal(new Set(slotMap.values()).size, 5, "each building gets its own slot");
});

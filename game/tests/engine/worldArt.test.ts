import { test } from "node:test";
import assert from "node:assert/strict";
import { createCombatDressing } from "../../app/components/engine/worldArt";
import { createKeplerBlackBoxFirstPersonState } from "../../app/components/engine/keplerBlackBoxMission";
import { createFirstPersonRuinTemplate } from "../../app/components/colony/region/poiTemplates";
import { generateInteriorState } from "../../app/components/colony/exploration/colonyLayout";
import { makeBuilding } from "../colony/fixtures";
import { SPRITES } from "../../app/components/engine/sprites";

test("every inhabited interior has enclosed materials and utility rooms are visually distinct", () => {
  const walls = new Set<string>(), floors = new Set<string>();
  for (const type of ["solar_array", "farm", "water_purifier", "habitat_module", "mine", "cantina"] as const) {
    const fp = generateInteriorState(makeBuilding(type), 42, 12);
    assert.ok(fp.environmentArt?.ceilingSprite, `${type} needs a ceiling`);
    assert.equal(fp.environmentArt.skySprite, undefined, `${type} cannot expose the outdoor sky`);
    walls.add(fp.environmentArt.wallSprite!); floors.add(fp.environmentArt.floorSprite!);
    assert.equal(fp.map.tiles.flat().filter(tile => tile === "door").length, 1);
    assert.equal(fp.map.tiles[Math.floor(fp.posY)][Math.floor(fp.posX)], "door");
    if (type === "mine") assert.equal(fp.props?.[0].sprite, SPRITES.WORLD_MINE_EXTRACTOR);
  }
  assert.equal(walls.size, 6); assert.equal(floors.size, 6);
});

test("station and Cinder constructors select different kits without changing mission geometry", () => {
  const station = createKeplerBlackBoxFirstPersonState(false), ruin = createFirstPersonRuinTemplate(42);
  assert.deepEqual(ruin.map.tiles, station.map.tiles);
  assert.equal(station.environmentArt?.wallSprite, SPRITES.WORLD_STATION_WALL);
  assert.equal(ruin.environmentArt?.wallSprite, SPRITES.WORLD_RUIN_WALL);
  assert.ok(station.environmentArt?.ceilingSprite && ruin.environmentArt?.ceilingSprite);
  assert.equal(ruin.objectivePickup?.label, "CINDER RELAY CORE");
  assert.equal(station.objectivePickup?.label, "KEPLER BLACK BOX");
  const before = JSON.stringify(station.map);
  for (const theme of ["station", "ruin"] as const) {
    const { props } = createCombatDressing(station.map, theme);
    assert.ok(props.length > 0 && props.length <= 4);
    for (const p of props) {
      const x = Math.floor(p.x), y = Math.floor(p.y);
      assert.equal(station.map.tiles[y][x], "floor");
      for (const [dx, dy] of [[1,0], [-1,0], [0,1], [0,-1]]) {
        assert.ok(!["door", "goal", "spawn"].includes(station.map.tiles[y+dy][x+dx]));
      }
    }
  }
  assert.equal(JSON.stringify(station.map), before);
});

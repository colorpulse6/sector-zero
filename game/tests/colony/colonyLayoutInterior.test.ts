import { test } from "node:test";
import assert from "node:assert/strict";
import { generateInteriorState } from "../../app/components/colony/exploration/colonyLayout";
import { SPRITES } from "../../app/components/engine/sprites";

const stubBuilding = (type: string): any => ({
  id: `b-${type}` as any, type, tier: 1 as const,
  status: "operational" as const, buildProgressCycles: 0,
  hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null,
});

test("generateInteriorState: produces 6×6 map for each Phase 1 type", () => {
  for (const type of ["solar_array", "farm", "water_purifier", "habitat_module", "mine"]) {
    const state = generateInteriorState(stubBuilding(type as any), 42, 12);
    assert.equal(state.map.width, 6);
    assert.equal(state.map.height, 6);
  }
});

test("generateInteriorState: player spawns ON the exit door tile facing north", () => {
  const state = generateInteriorState(stubBuilding("solar_array"), 42, 12);
  // exit door is at (2, 5) per solar_array_stub template
  assert.equal(Math.floor(state.posX), 2);
  assert.equal(Math.floor(state.posY), 5);
  assert.equal(state.dirX, 0);
  assert.equal(state.dirY, -1);
});

test("generateInteriorState: colonyContext mode is 'interior'", () => {
  const state = generateInteriorState(stubBuilding("farm"), 42, 12);
  assert.ok(state.colonyContext);
  assert.equal(state.colonyContext!.mode, "interior");
});

test("generateInteriorState: standingOn exit door returns exit_interior", () => {
  const state = generateInteriorState(stubBuilding("solar_array"), 42, 12);
  const result = state.colonyContext!.onDoorInteract({ x: 2, y: 5 }, { x: 2, y: 4 });
  assert.equal(result.kind, "exit_interior");
});

test("generateInteriorState: standingOn non-door returns no_door", () => {
  const state = generateInteriorState(stubBuilding("solar_array"), 42, 12);
  const result = state.colonyContext!.onDoorInteract({ x: 2, y: 3 }, { x: 2, y: 2 });
  assert.equal(result.kind, "no_door");
});

test("generateInteriorState: onLandingPadInteract returns not_on_pad", () => {
  // Interiors have no landing pad — always not_on_pad
  const state = generateInteriorState(stubBuilding("solar_array"), 42, 12);
  const result = state.colonyContext!.onLandingPadInteract({ x: 2, y: 5 });
  assert.equal(result.kind, "not_on_pad");
});

test("generateInteriorState: stub interiors preserve Ashfall art, props, and zero NPCs", () => {
  const expectedProps = {
    solar_array: [{ sprite: SPRITES.INTERIOR_SOLAR_PANEL, scale: 1.0 }],
    farm: [{ sprite: SPRITES.INTERIOR_FARM_CRATE, scale: 1.0 }],
    water_purifier: [{ sprite: SPRITES.INTERIOR_PURIFIER_PUMP, scale: 1.2 }],
    habitat_module: [
      { sprite: SPRITES.INTERIOR_BUNK, scale: 1.0 },
      { sprite: SPRITES.INTERIOR_BUNK, scale: 1.0 },
      { sprite: SPRITES.INTERIOR_BUNK, scale: 1.0 },
      { sprite: SPRITES.INTERIOR_BUNK, scale: 1.0 },
    ],
    mine: [{ sprite: SPRITES.INTERIOR_PURIFIER_PUMP, scale: 1.2 }],
  } as const;

  for (const type of Object.keys(expectedProps) as Array<keyof typeof expectedProps>) {
    const state = generateInteriorState(stubBuilding(type), 42, 12);
    assert.equal(state.environmentArt?.skySprite, SPRITES.EXPLORE_OUTPOST_SKY);
    assert.equal(state.environmentArt?.wallSprite, SPRITES.EXPLORE_OUTPOST_WALL_INTERIOR);
    assert.equal(state.environmentArt?.floorSprite, SPRITES.EXPLORE_OUTPOST_FLOOR_METAL);
    assert.equal(state.environmentArt?.ceilingSprite, undefined);
    assert.deepEqual(state.props?.map(({ sprite, scale }) => ({ sprite, scale })), expectedProps[type]);
    assert.deepEqual(state.npcs, []);

    const floorSprite = state.environmentArt?.floorSprite;
    assert.ok(floorSprite, `${type}: environmentArt.floorSprite must be set`);
    const { tiles, floorTextureMap } = state.map;
    assert.ok(floorTextureMap, `${type}: interior map must carry a floorTextureMap`);
    for (let y = 0; y < state.map.height; y++) {
      for (let x = 0; x < state.map.width; x++) {
        if (tiles[y][x] !== "floor") continue;
        // Pinned to environmentArt.floorSprite (not the sprite constant): the
        // two are single-sourced in colonyLayout.ts and must never diverge.
        assert.equal(floorTextureMap![y][x], floorSprite,
          `${type}: floor tile (${x},${y}) must carry the interior floor sprite`);
      }
    }
  }
});

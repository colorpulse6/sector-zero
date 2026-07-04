import { test } from "node:test";
import assert from "node:assert/strict";
import { generateExteriorState } from "../../app/components/colony/exploration/colonyLayout";
import { makeTestColony } from "./fixtures";
import type { GameClock } from "../../app/components/colony/shared/colonyTypes";
import { SPRITES } from "../../app/components/engine/sprites";

const clock: GameClock = { day: 0, hour: 12, minute: 0, realtimeMsPerGameMinute: 1000, season: "standard" };

test("generateExteriorState is deterministic for the same inputs", () => {
  const colony = makeTestColony({ layoutSeed: 42 });
  const a = generateExteriorState(colony, clock);
  const b = generateExteriorState(colony, clock);
  assert.deepEqual(a.map.tiles, b.map.tiles);
  assert.equal(a.posX, b.posX);
  assert.equal(a.posY, b.posY);
});

test("generateExteriorState spawns at landing pad center facing north", () => {
  const colony = makeTestColony();
  const state = generateExteriorState(colony, clock);
  assert.equal(state.posX, 11.5);
  assert.equal(state.posY, 22.5);
  assert.equal(state.dirX, 0);
  assert.equal(state.dirY, -1);
});

test("generateExteriorState places buildings in insertion order rotated by seed", () => {
  // Two colonies with same buildings but different seeds → different slot layouts
  const c1 = makeTestColony({
    layoutSeed: 0,
    buildings: [
      { id: "b1", type: "solar_array", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const c2 = makeTestColony({
    layoutSeed: 3,
    buildings: [
      { id: "b1", type: "solar_array", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const s1 = generateExteriorState(c1, clock);
  const s2 = generateExteriorState(c2, clock);
  // Same seed = same tiles; different seed = at least some tile differences
  assert.notDeepStrictEqual(s1.map.tiles, s2.map.tiles);
});

test("generateExteriorState: constructing building renders foundation only (no walls)", () => {
  const colony = makeTestColony({
    layoutSeed: 0,   // rotation=0 → slot 0 → NW corner at (2,2)
    buildings: [
      { id: "b1", type: "solar_array", tier: 1, status: "constructing", buildProgressCycles: 1, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const state = generateExteriorState(colony, clock);
  // Slot 0 footprint is at anchor (2,2), size 3×3. Constructing building must NOT write wall tiles.
  // Check that the cells in that region are still "floor"-equivalent (walkable, not '#').
  const wallTilesInSlot0 = countWallTilesInRegion(state.map.tiles, 2, 2, 3, 3);
  assert.equal(wallTilesInSlot0, 0, "constructing building should have no wall tiles");
});

test("generateExteriorState: operational building renders full perimeter walls + door", () => {
  const colony = makeTestColony({
    layoutSeed: 0,
    buildings: [
      { id: "b1", type: "solar_array", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const state = generateExteriorState(colony, clock);
  const wallTilesInSlot0 = countWallTilesInRegion(state.map.tiles, 2, 2, 3, 3);
  // 3×3 building with door on south: perimeter is 8 cells, minus 1 for door = 7 walls
  assert.ok(wallTilesInSlot0 >= 6, `expected >=6 wall tiles in operational footprint, got ${wallTilesInSlot0}`);
});

test("generateExteriorState: empty colony renders only frame + pad + plaza", () => {
  const colony = makeTestColony({ layoutSeed: 0, buildings: [] });
  const state = generateExteriorState(colony, clock);
  // All slot regions should be empty floor
  for (const slot of [{ x: 2, y: 2 }, { x: 18, y: 2 }]) {
    const walls = countWallTilesInRegion(state.map.tiles, slot.x, slot.y, 4, 4);
    assert.equal(walls, 0, `empty slot at (${slot.x},${slot.y}) should have no walls`);
  }
});

test("generateExteriorState: landing pad tiles carry the landing-pad floor sprite", () => {
  const colony = makeTestColony({ layoutSeed: 0, buildings: [] });
  const state = generateExteriorState(colony, clock);
  // (11,20) is inside the 4x4 pad region { x: 10, y: 19, w: 4, h: 4 }.
  assert.equal(state.map.floorTextureMap?.[20]?.[11], SPRITES.COLONY_LANDING_PAD);
});

test("generateExteriorState: constructing building writes foundation floor sprite on its footprint", () => {
  const colony = makeTestColony({
    layoutSeed: 0,   // rotation=0 -> slot 0 -> NW corner anchored at (2,2), 3x3 solar_array footprint
    buildings: [
      { id: "b1", type: "solar_array", tier: 1, status: "constructing", buildProgressCycles: 1, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const state = generateExteriorState(colony, clock);
  assert.equal(state.map.floorTextureMap?.[2]?.[2], SPRITES.COLONY_FOUNDATION);
});

test("generateExteriorState: night hours emit a warm door light for each operational building", () => {
  const nightClock: GameClock = { day: 0, hour: 22, minute: 0, realtimeMsPerGameMinute: 1000, season: "standard" };
  const colony = makeTestColony({
    layoutSeed: 0,
    buildings: [
      { id: "b1", type: "solar_array", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const state = generateExteriorState(colony, nightClock);
  const lights = state.environmentArt?.pointLights ?? [];
  assert.ok(lights.length >= 1, "night colony must emit at least one point light");
  assert.ok(lights.some(l => l.color === "#ffb066" && l.power === 2),
    "operational building gets a warm power-2 door light");
});

test("generateExteriorState: day hours emit no point lights", () => {
  const colony = makeTestColony({
    layoutSeed: 0,
    buildings: [
      { id: "b1", type: "solar_array", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const state = generateExteriorState(colony, clock);   // module-level `clock` is hour 12
  assert.equal((state.environmentArt?.pointLights ?? []).length, 0, "daytime colony emits no point lights");
});

test("generateExteriorState: night scaffolding gets a cool light; non-operational buildings get no door light", () => {
  const nightClock: GameClock = { day: 0, hour: 2, minute: 0, realtimeMsPerGameMinute: 1000, season: "standard" };
  const colony = makeTestColony({
    layoutSeed: 0,
    buildings: [
      { id: "b1", type: "solar_array", tier: 1, status: "constructing", buildProgressCycles: 1, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
      { id: "b2", type: "farm", tier: 1, status: "offline", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const state = generateExteriorState(colony, nightClock);
  const lights = state.environmentArt?.pointLights ?? [];
  assert.ok(lights.some(l => l.color === "#9fd0ff" && l.power === 1.5),
    "constructing building's scaffolding gets a cool power-1.5 light");
  assert.equal(lights.filter(l => l.color === "#ffb066").length, 0,
    "no warm door light: the only two buildings are constructing/offline, neither operational");
});

// Helper
function countWallTilesInRegion(tiles: string[][], x: number, y: number, w: number, h: number): number {
  let count = 0;
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) {
      if (tiles[j]?.[i] === "wall") count++;
    }
  }
  return count;
}

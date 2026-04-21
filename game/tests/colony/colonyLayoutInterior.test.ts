import { test } from "node:test";
import assert from "node:assert/strict";
import { generateInteriorState } from "../../app/components/colony/exploration/colonyLayout";

const stubBuilding = (type: string): any => ({
  id: `b-${type}` as any, type, tier: 1 as const,
  status: "operational" as const, buildProgressCycles: 0,
  hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null,
});

test("generateInteriorState: produces 6×6 map for each Phase 1 type", () => {
  for (const type of ["solar_array", "farm", "water_purifier", "habitat_module"]) {
    const state = generateInteriorState(stubBuilding(type as any), 42);
    assert.equal(state.map.width, 6);
    assert.equal(state.map.height, 6);
  }
});

test("generateInteriorState: player spawns ON the exit door tile facing north", () => {
  const state = generateInteriorState(stubBuilding("solar_array"), 42);
  // exit door is at (2, 5) per solar_array_stub template
  assert.equal(Math.floor(state.posX), 2);
  assert.equal(Math.floor(state.posY), 5);
  assert.equal(state.dirX, 0);
  assert.equal(state.dirY, -1);
});

test("generateInteriorState: colonyContext mode is 'interior'", () => {
  const state = generateInteriorState(stubBuilding("farm"), 42);
  assert.ok(state.colonyContext);
  assert.equal(state.colonyContext!.mode, "interior");
});

test("generateInteriorState: standingOn exit door returns exit_interior", () => {
  const state = generateInteriorState(stubBuilding("solar_array"), 42);
  const result = state.colonyContext!.onDoorInteract({ x: 2, y: 5 }, { x: 2, y: 4 });
  assert.equal(result.kind, "exit_interior");
});

test("generateInteriorState: standingOn non-door returns no_door", () => {
  const state = generateInteriorState(stubBuilding("solar_array"), 42);
  const result = state.colonyContext!.onDoorInteract({ x: 2, y: 3 }, { x: 2, y: 2 });
  assert.equal(result.kind, "no_door");
});

test("generateInteriorState: onLandingPadInteract returns not_on_pad", () => {
  // Interiors have no landing pad — always not_on_pad
  const state = generateInteriorState(stubBuilding("solar_array"), 42);
  const result = state.colonyContext!.onLandingPadInteract({ x: 2, y: 5 });
  assert.equal(result.kind, "not_on_pad");
});

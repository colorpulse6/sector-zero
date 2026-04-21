import { test } from "node:test";
import assert from "node:assert/strict";
import { pushInterior, popToExterior, isInInterior } from "../../app/components/colony/exploration/sceneStack";
import type { SceneStack, SceneLayer } from "../../app/components/colony/exploration/sceneStack";
import type { FirstPersonState } from "../../app/components/engine/types";
import type { ColonyBuilding } from "../../app/components/colony/shared/colonyTypes";
import { makeTestColony } from "./fixtures";

function stubFpState(): FirstPersonState {
  return {
    map: { width: 24, height: 24, tileSize: 64, tiles: [] },
    posX: 0, posY: 0, dirX: 0, dirY: -1, planeX: 0.66, planeY: 0,
    moveSpeed: 0.06, rotSpeed: 0.04, goalReached: false,
    enemies: [], gunFireTimer: 0, gunCooldown: 0,
    npcs: [], dialogState: null,
  };
}

function stubBuilding(): ColonyBuilding {
  return {
    id: "b1" as any, type: "solar_array", tier: 1 as const,
    status: "operational" as const, buildProgressCycles: 0,
    hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null,
  };
}

test("sceneStack: fresh stack has current=exterior, parent=null", () => {
  const exteriorLayer: SceneLayer = {
    kind: "exterior",
    buildingId: null,
    state: stubFpState(),
    returnToTile: null,
  };
  const stack: SceneStack = {
    colonyId: "c1" as any,
    current: exteriorLayer,
    parent: null,
  };
  assert.equal(stack.current.kind, "exterior");
  assert.equal(stack.parent, null);
  assert.equal(isInInterior(stack), false);
});

test("sceneStack: pushInterior moves exterior → parent, sets interior as current", () => {
  const exteriorLayer: SceneLayer = {
    kind: "exterior",
    buildingId: null,
    state: stubFpState(),
    returnToTile: null,
  };
  const stack: SceneStack = {
    colonyId: "c1" as any,
    current: exteriorLayer,
    parent: null,
  };
  const interiorState = stubFpState();
  const next = pushInterior(stack, stubBuilding(), interiorState, { x: 3, y: 4 });

  assert.equal(next.current.kind, "interior");
  assert.equal(next.current.buildingId, "b1");
  assert.equal(next.current.state, interiorState);
  assert.deepEqual(next.current.returnToTile, { x: 3, y: 4 });
  assert.equal(next.parent, exteriorLayer);
  assert.equal(isInInterior(next), true);
});

test("sceneStack: popToExterior restores parent, clears parent slot", () => {
  const exteriorLayer: SceneLayer = {
    kind: "exterior",
    buildingId: null,
    state: stubFpState(),
    returnToTile: null,
  };
  const interior: SceneStack = {
    colonyId: "c1" as any,
    current: {
      kind: "interior",
      buildingId: "b1" as any,
      state: stubFpState(),
      returnToTile: { x: 3, y: 4 },
    },
    parent: exteriorLayer,
  };
  const popped = popToExterior(interior);
  assert.equal(popped.current, exteriorLayer);
  assert.equal(popped.parent, null);
  assert.equal(isInInterior(popped), false);
});

test("sceneStack: depth invariant — never exceeds 2 layers", () => {
  // The type itself prevents >2: single `parent` field cannot nest further.
  // Additional assertion: pushInterior on an already-interior stack should throw.
  const exteriorLayer: SceneLayer = {
    kind: "exterior",
    buildingId: null,
    state: stubFpState(),
    returnToTile: null,
  };
  const stack: SceneStack = { colonyId: "c1" as any, current: exteriorLayer, parent: null };
  const once = pushInterior(stack, stubBuilding(), stubFpState(), { x: 3, y: 4 });
  assert.throws(
    () => pushInterior(once, stubBuilding(), stubFpState(), { x: 5, y: 6 }),
    /already in interior|stack depth/i,
  );
});

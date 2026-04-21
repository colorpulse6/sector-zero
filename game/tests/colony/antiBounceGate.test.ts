import { test } from "node:test";
import assert from "node:assert/strict";
import { updateFirstPerson } from "../../app/components/engine/firstPersonEngine";
import { generateExteriorState } from "../../app/components/colony/exploration/colonyLayout";
import { makeTestColony } from "./fixtures";
import type { GameClock } from "../../app/components/colony/shared/colonyTypes";
import type { FirstPersonState } from "../../app/components/engine/types";

const clock: GameClock = { day: 0, hour: 12, minute: 0, realtimeMsPerGameMinute: 1000, season: "standard" };

function stubKeys(overrides: Partial<any> = {}): any {
  return {
    left: false, right: false, up: false, down: false,
    strafeLeft: false, strafeRight: false,
    shoot: false, bomb: false, jump: false,
    ...overrides,
  };
}

// Stub enough of GameState that updateFirstPerson's full code path doesn't crash
// when falling through the colony guard into the default FPS shoot path
// (the no-op gate test specifically needs this).
function stubGameState(firstPersonState: FirstPersonState, mode: string = "colony-exploration"): any {
  return {
    currentMode: mode,
    firstPersonState,
    levelCompleteTimer: 0,
    score: 0,
    xp: 0,
    kills: 0,
    credits: 0,
    floatingLabels: [],
    screenShake: 0,
    equippedWeaponType: "kinetic",
    allocatedSkills: [],
    audioEvents: [],
    player: { bankDir: 0 },
    pilotLevel: 1,
  };
}

function placePlayerOnPad(state: ReturnType<typeof generateExteriorState>) {
  state.posX = 11.5;
  state.posY = 20.5;  // inside pad region
}

test("antiBounce: held Z fires hook at most once per key release cycle", () => {
  const colony = makeTestColony({ layoutSeed: 0 });
  const state = generateExteriorState(colony, clock);
  placePlayerOnPad(state);

  // Frame 1: Z pressed, hook should fire (transition request written)
  const gs = stubGameState(state);
  updateFirstPerson(gs, stubKeys({ shoot: true }));
  assert.ok(state.colonyTransitionRequest, "first press should fire hook");

  // Clear the request (simulates orchestrator consuming it)
  state.colonyTransitionRequest = undefined;

  // Frame 2: Z STILL pressed — no release — hook must NOT fire again
  updateFirstPerson(gs, stubKeys({ shoot: true }));
  assert.equal(state.colonyTransitionRequest, undefined, "held Z must not re-fire");
});

test("antiBounce: cooldown blocks hook fire for 15 frames after transition", () => {
  const colony = makeTestColony({ layoutSeed: 0 });
  const state = generateExteriorState(colony, clock);
  placePlayerOnPad(state);
  state.colonyInteractCooldownFrames = 15;
  state.colonyInteractArmed = true;

  // Frame 1: Z pressed — cooldown > 0, must NOT fire
  const gs = stubGameState(state);
  updateFirstPerson(gs, stubKeys({ shoot: true }));
  assert.equal(state.colonyTransitionRequest, undefined, "cooldown should block");

  // Simulate 14 more frames of held Z
  for (let i = 0; i < 14; i++) {
    updateFirstPerson(gs, stubKeys({ shoot: true }));
  }
  // Cooldown should now be 0
  assert.equal(state.colonyInteractCooldownFrames, 0);
});

test("antiBounce: key release → press → fires again", () => {
  const colony = makeTestColony({ layoutSeed: 0 });
  const state = generateExteriorState(colony, clock);
  placePlayerOnPad(state);

  const gs = stubGameState(state);

  // First press
  updateFirstPerson(gs, stubKeys({ shoot: true }));
  assert.ok(state.colonyTransitionRequest);
  state.colonyTransitionRequest = undefined;

  // Release (armed should flip true)
  updateFirstPerson(gs, stubKeys({ shoot: false }));
  assert.equal(state.colonyInteractArmed, true);

  // Re-press — must fire (assuming cooldown has cleared; simulate enough frames first)
  for (let i = 0; i < 15; i++) {
    updateFirstPerson(gs, stubKeys({ shoot: false }));
  }
  updateFirstPerson(gs, stubKeys({ shoot: true }));
  assert.ok(state.colonyTransitionRequest, "re-press after release should fire");
});

test("antiBounce: gate is no-op when colonyContext is undefined", () => {
  // Non-colony FPS state (Ashfall Camp equivalent) — tiles must contain at least walkable floor
  // so the default shoot path doesn't hit an undefined tile when checking collisions.
  const tiles: any[][] = [];
  for (let y = 0; y < 10; y++) {
    tiles.push(new Array(10).fill("floor"));
  }
  const state: any = {
    map: { width: 10, height: 10, tileSize: 64, tiles },
    posX: 5, posY: 5, dirX: 0, dirY: -1, planeX: 0.66, planeY: 0,
    moveSpeed: 0.06, rotSpeed: 0.04, goalReached: false,
    enemies: [], gunFireTimer: 0, gunCooldown: 0,
    npcs: [], dialogState: null,
  };
  const gs = stubGameState(state, "first-person");
  updateFirstPerson(gs, stubKeys({ shoot: true }));
  // Whatever the engine did, the anti-bounce fields should not have been set by the colony block
  assert.equal(state.colonyInteractArmed, undefined);
  assert.equal(state.colonyInteractCooldownFrames, undefined);
});

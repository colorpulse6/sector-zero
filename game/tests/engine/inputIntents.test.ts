import { test } from "node:test";
import assert from "node:assert/strict";
import {
  advanceInputFrame,
  createEmptyInputState,
  keyboardInputSource,
  mapKeyboardIntent,
  pressInputSource,
  releaseInputSource,
  toEngineKeys,
  type InputContext,
  type InputIntent,
  type KeyboardInput,
} from "../../app/components/engine/inputIntents";
import { createGameState, updateGame } from "../../app/components/engine/gameEngine";
import { createTurretState, updateTurretEngine } from "../../app/components/engine/turretEngine";
import { updateGroundEngine } from "../../app/components/engine/groundEngine";
import { updateBoardingEngine } from "../../app/components/engine/boardingEngine";
import { drawBoardingGame } from "../../app/components/engine/boardingRenderer";
import { loadSprite, SPRITES } from "../../app/components/engine/sprites";
import { AudioEvent, BULLET_SPEED, GameScreen, type GameMode, type GameState, type Keys } from "../../app/components/engine/types";

const modes: GameMode[] = [
  "shooter", "ground-run", "boarding", "first-person", "turret",
  "base-defense", "mech-duel", "colony-exploration",
];
const emptyKeys: Keys = {
  left: false, right: false, up: false, down: false,
  strafeLeft: false, strafeRight: false, shoot: false, bomb: false, jump: false,
};
const gameplay = (mode: GameMode): InputContext => ({ surface: "gameplay", mode });

test("Space has one mode-specific action, including the shooter fallback modes", () => {
  const expected: Record<GameMode, InputIntent> = {
    shooter: "primary", "ground-run": "jump", boarding: "dash",
    "first-person": "primary", turret: "primary", "base-defense": "primary",
    "mech-duel": "primary", "colony-exploration": "primary",
  };
  for (const mode of modes) {
    assert.equal(mapKeyboardIntent({ key: " " }, gameplay(mode)), expected[mode], mode);
  }
});

test("gameplay keeps primary and secondary aliases distinct from Space movement actions", () => {
  for (const mode of modes) {
    for (const key of ["z", "Z", "Shift"]) {
      assert.equal(mapKeyboardIntent({ key }, gameplay(mode)), "primary", `${mode}: ${key}`);
    }
    for (const key of ["b", "B"]) {
      assert.equal(mapKeyboardIntent({ key }, gameplay(mode)), "secondary", mode);
    }
    assert.equal(mapKeyboardIntent({ key: "Enter" }, gameplay(mode)), null, mode);
  }
});

test("movement aliases turn or strafe only on first-person gameplay surfaces", () => {
  for (const mode of modes) {
    const firstPerson = mode === "first-person" || mode === "colony-exploration";
    const cases: [string[], InputIntent][] = [
      [["ArrowLeft"], firstPerson ? "turn-left" : "move-left"],
      [["ArrowRight"], firstPerson ? "turn-right" : "move-right"],
      [["a", "A"], firstPerson ? "strafe-left" : "move-left"],
      [["d", "D"], firstPerson ? "strafe-right" : "move-right"],
      [["ArrowUp", "w", "W"], "move-up"],
      [["ArrowDown", "s", "S"], "move-down"],
    ];
    for (const [keys, intent] of cases) {
      for (const key of keys) {
        assert.equal(mapKeyboardIntent({ key }, gameplay(mode)), intent, `${mode}: ${key}`);
      }
    }
  }
});

test("UI navigation and activation depend on surface even with a stale gameplay mode", () => {
  const cases: [string[], InputIntent][] = [
    [["ArrowLeft", "a", "A"], "ui-left"],
    [["ArrowRight", "d", "D"], "ui-right"],
    [["ArrowUp", "w", "W"], "ui-up"],
    [["ArrowDown", "s", "S"], "ui-down"],
    [[" ", "z", "Z", "Shift", "Enter"], "activate"],
    [["Escape"], "back"],
    [["m", "M"], "mute"],
  ];
  for (const mode of modes) {
    const context = { surface: "ui" as const, mode };
    for (const [keys, intent] of cases) {
      for (const key of keys) {
        assert.equal(mapKeyboardIntent({ key }, context), intent, `${mode}: ${key}`);
      }
    }
    for (const key of ["b", "p"]) assert.equal(mapKeyboardIntent({ key }, context), null);
  }
});

test("pause and mute commands are isolated from held movement and fire", () => {
  for (const mode of modes) {
    for (const key of ["p", "P", "Escape"]) {
      assert.equal(mapKeyboardIntent({ key }, gameplay(mode)), "pause");
    }
    for (const key of ["m", "M"]) {
      assert.equal(mapKeyboardIntent({ key }, gameplay(mode)), "mute");
    }
  }
  const context: InputContext = { surface: "paused" };
  for (const key of ["p", "P"]) assert.equal(mapKeyboardIntent({ key }, context), "pause");
  assert.equal(mapKeyboardIntent({ key: "Escape" }, context), "back");
  assert.equal(mapKeyboardIntent({ key: "Enter" }, context), "activate");
  assert.equal(mapKeyboardIntent({ key: "m" }, context), "mute");
  for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "a", "d", "w", "s", " ", "z", "Shift", "b"]) {
    assert.equal(mapKeyboardIntent({ key }, context), null, key);
  }
});

const candidateKeys = [
  "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "a", "A", "d", "D",
  "w", "W", "s", "S", " ", "z", "Z", "Shift", "b", "B", "Enter",
  "Escape", "p", "P", "m", "M", "Tab", "q", "Unidentified", "",
];
const contexts: InputContext[] = [
  ...modes.map(gameplay), { surface: "ui" }, { surface: "paused" }, { surface: "blocked" },
];

test("blocked surfaces ignore every candidate key", () => {
  for (const key of candidateKeys) {
    assert.equal(mapKeyboardIntent({ key }, { surface: "blocked" }), null, key);
  }
});

test("modified shortcuts and repeats never create intents or rearm cleared input", () => {
  for (const context of contexts) {
    for (const key of candidateKeys) {
      for (const modifier of ["ctrlKey", "metaKey", "altKey", "repeat"] as const) {
        assert.equal(mapKeyboardIntent({ key, [modifier]: true }, context), null, `${context.surface}: ${key}: ${modifier}`);
      }
    }
  }
  let state = pressInputSource(createEmptyInputState(), "keyboard:Space", "primary");
  assert.equal(toEngineKeys(state).shoot, true);
  state = createEmptyInputState();
  const repeated = mapKeyboardIntent({ key: " ", code: "Space", repeat: true }, gameplay("shooter"));
  if (repeated) state = pressInputSource(state, "keyboard:Space", repeated);
  assert.deepEqual(toEngineKeys(state), emptyKeys);
});

test("physical codes win over a layout-dependent key, with normalized fallback", () => {
  const cases: [KeyboardInput, InputIntent][] = [
    [{ key: "q", code: "KeyA" }, "move-left"],
    [{ key: "y", code: "KeyZ" }, "primary"],
    [{ key: "B", code: "KeyM" }, "mute"],
    [{ key: "Unidentified", code: "Space" }, "primary"],
    [{ key: "Unidentified", code: "ShiftLeft" }, "primary"],
    [{ key: "Unidentified", code: "ShiftRight" }, "primary"],
    [{ key: "A" }, "move-left"],
    [{ key: "W", code: "" }, "move-up"],
    [{ key: "D", code: "Unidentified" }, "move-right"],
    [{ key: "S", code: "Unknown" }, "move-down"],
  ];
  for (const [event, expected] of cases) {
    assert.equal(mapKeyboardIntent(event, gameplay("shooter")), expected, JSON.stringify(event));
  }
});

test("each mapped physical event projects to at most one engine flag", () => {
  for (const context of contexts) {
    for (const key of candidateKeys) {
      const intent = mapKeyboardIntent({ key }, context);
      const state = intent ? pressInputSource(createEmptyInputState(), "one-event", intent) : createEmptyInputState();
      const flags = Object.values(toEngineKeys(state)).filter(Boolean);
      assert.ok(flags.length <= 1, `${context.surface}: ${key} set ${flags.length} flags`);
    }
  }
});

test("all semantic held actions project to the existing engine Keys contract", () => {
  const cases: [InputIntent[], keyof Keys][] = [
    [["move-left", "turn-left", "ui-left"], "left"],
    [["move-right", "turn-right", "ui-right"], "right"],
    [["move-up", "ui-up"], "up"], [["move-down", "ui-down"], "down"],
    [["strafe-left"], "strafeLeft"], [["strafe-right"], "strafeRight"],
    [["primary", "activate"], "shoot"], [["secondary"], "bomb"],
    [["jump", "dash"], "jump"],
  ];
  for (const [intents, flag] of cases) {
    for (const intent of intents) {
      assert.deepEqual(toEngineKeys(pressInputSource(createEmptyInputState(), "test", intent)), { ...emptyKeys, [flag]: true }, intent);
    }
  }
  for (const intent of ["pause", "mute", "back"] as const) {
    assert.deepEqual(toEngineKeys(pressInputSource(createEmptyInputState(), "command", intent)), emptyKeys);
  }
});

test("keyboard sources retain physical identity and normalize fallback casing", () => {
  assert.equal(keyboardInputSource({ key: "a", code: "KeyA" }), "keyboard:KeyA");
  assert.equal(keyboardInputSource({ key: "A", code: "KeyA" }), "keyboard:KeyA");
  assert.equal(keyboardInputSource({ key: "a" }), keyboardInputSource({ key: "A" }));
  assert.equal(keyboardInputSource({ key: "A", code: "Unidentified" }), keyboardInputSource({ key: "a" }));
  assert.notEqual(keyboardInputSource({ key: "Shift", code: "ShiftLeft" }), keyboardInputSource({ key: "Shift", code: "ShiftRight" }));
});

test("releasing one alias or touch source preserves every other held source", () => {
  const cases: [string, string, InputIntent, keyof Keys][] = [
    ["keyboard:KeyA", "keyboard:ArrowLeft", "move-left", "left"],
    ["keyboard:KeyZ", "keyboard:Space", "primary", "shoot"],
    ["keyboard:ShiftLeft", "keyboard:ShiftRight", "primary", "shoot"],
    ["keyboard:KeyZ", "touch:primary", "primary", "shoot"],
    ["keyboard:KeyB", "touch:secondary", "secondary", "bomb"],
  ];
  for (const [first, second, intent, flag] of cases) {
    for (const [released, retained] of [[first, second], [second, first]]) {
      const initial = pressInputSource(pressInputSource(createEmptyInputState(), first, intent), second, intent);
      const afterOneRelease = releaseInputSource(initial, released);
      assert.deepEqual(toEngineKeys(afterOneRelease), { ...emptyKeys, [flag]: true });
      assert.deepEqual(toEngineKeys(releaseInputSource(afterOneRelease, retained)), emptyKeys);
    }
  }
});

test("a held source captures its first intent until release even when context changes", () => {
  const initial = pressInputSource(createEmptyInputState(), "keyboard:Space", "jump");
  const repeated = pressInputSource(initial, "keyboard:Space", "primary");
  assert.deepEqual(toEngineKeys(repeated), { ...emptyKeys, jump: true });
  const pressedAgain = pressInputSource(releaseInputSource(repeated, "keyboard:Space"), "keyboard:Space", "primary");
  assert.deepEqual(toEngineKeys(pressedAgain), { ...emptyKeys, shoot: true });
});

test("source helpers do not mutate previous states and engine projections are detached", () => {
  const empty = Object.freeze(createEmptyInputState());
  const held = Object.freeze(pressInputSource(empty, "keyboard:KeyA", "move-left"));
  const both = pressInputSource(held, "touch:primary", "primary");
  const released = releaseInputSource(both, "keyboard:KeyA");
  assert.deepEqual(toEngineKeys(empty), emptyKeys);
  assert.deepEqual(toEngineKeys(held), { ...emptyKeys, left: true });
  assert.deepEqual(toEngineKeys(both), { ...emptyKeys, left: true, shoot: true });
  assert.deepEqual(toEngineKeys(released), { ...emptyKeys, shoot: true });
  assert.deepEqual(releaseInputSource(held, "missing"), held);
  assert.notEqual(createEmptyInputState(), createEmptyInputState());
  const keys = toEngineKeys(held);
  keys.left = false;
  keys.shoot = true;
  assert.deepEqual(toEngineKeys(held), { ...emptyKeys, left: true });
});

for (const [key, intent] of [["ArrowRight", "ui-right"], [" ", "activate"]] as const) {
  test(`catch-up stops UI ${intent} at the real briefing-to-playing boundary`, () => {
    const state = createGameState(1, 1);
    state.briefingTimer = 1;
    assert.equal(state.screen, GameScreen.BRIEFING);
    assert.equal(mapKeyboardIntent({ key }, { surface: "ui" }), intent);
    const heldKeys = toEngineKeys(pressInputSource(createEmptyInputState(), keyboardInputSource({ key }), intent));
    const initialX = state.player.x;
    const stepMs = 1000 / 60;
    const availableMs = stepMs * 3;
    const result = advanceInputFrame(state, availableMs, stepMs, (current) =>
      updateGame(current, heldKeys, null, null, stepMs));

    assert.equal(result.state.player.x, initialX, "UI direction must not move the player after briefing ends");
    assert.equal(result.state.playerBullets.length, 0, "UI activation must not fire after briefing ends");
    assert.equal(result.state.audioEvents.includes(AudioEvent.PLAYER_SHOOT), false);
    assert.equal(result.state.screen, GameScreen.PLAYING);
    assert.equal(result.state.frameCount, 1);
    assert.equal(result.boundaryChanged, true);
    assert.equal(result.simulatedMs, stepMs);
    assert.equal(result.remainingMs, availableMs - stepMs);

    const resumed = advanceInputFrame(result.state, result.remainingMs, stepMs, (current) =>
      updateGame(current, toEngineKeys(createEmptyInputState()), null, null, stepMs));
    assert.equal(resumed.state.frameCount, 2, "retained time can advance after the caller clears input");
    assert.equal(resumed.state.player.x, initialX);
    assert.equal(resumed.state.playerBullets.length, 0);
    assert.equal(resumed.boundaryChanged, false);
  });
}

type TickState = Pick<GameState, "screen" | "currentMode" | "currentPhase"> & { ticks: number };

function tickState(): TickState {
  return { screen: GameScreen.PLAYING, currentMode: "shooter", currentPhase: 0, ticks: 0 };
}

const boundaryChanges: [string, (state: TickState) => void][] = [
  ["screen", (state) => { state.screen = GameScreen.PHASE_TRANSITION; }],
  ["mode", (state) => { state.currentMode = "ground-run"; }],
  ["phase", (state) => { state.currentPhase += 1; }],
];

for (const [label, change] of boundaryChanges) {
  test(`catch-up detects a ${label} boundary when update mutates the same state object`, () => {
    const state = tickState();
    const result = advanceInputFrame(state, 30, 10, (current) => {
      current.ticks += 1;
      change(current);
      return current;
    });

    assert.equal(result.state.ticks, 1, "no later tick may consume input from the previous boundary");
    assert.equal(result.state, state);
    assert.equal(result.boundaryChanged, true);
    assert.equal(result.simulatedMs, 10);
    assert.equal(result.remainingMs, 20);
  });
}

test("catch-up advances all ordinary whole ticks and retains the fractional remainder", () => {
  const initial = Object.freeze(tickState());
  const result = advanceInputFrame(initial, 55, 10, (current) => ({ ...current, ticks: current.ticks + 1 }));
  assert.equal(result.state.ticks, 5);
  assert.equal(initial.ticks, 0);
  assert.equal(result.simulatedMs, 50);
  assert.equal(result.remainingMs, 5);
  assert.equal(result.boundaryChanged, false);
});

test("catch-up preserves the existing repeated-subtraction arithmetic at 60Hz", () => {
  const stepMs = 1000 / 60;
  const result = advanceInputFrame(tickState(), 50, stepMs, (current) => ({ ...current, ticks: current.ticks + 1 }));
  assert.equal(result.state.ticks, 2, "flooring 50 / stepMs would incorrectly introduce a third tick");
  assert.equal(result.simulatedMs, stepMs + stepMs);
  assert.equal(result.remainingMs, (50 - stepMs) - stepMs);
  assert.equal(result.boundaryChanged, false);
});

test("catch-up with no whole tick preserves state identity and does not call update", () => {
  const state = Object.freeze(tickState());
  for (const availableMs of [0, 4.5]) {
    const result = advanceInputFrame(state, availableMs, 10, () => assert.fail("no update is due"));
    assert.equal(result.state, state);
    assert.equal(result.remainingMs, availableMs);
    assert.equal(result.simulatedMs, 0);
    assert.equal(result.boundaryChanged, false);
  }
});

test("catch-up rejects invalid or non-progressing time values before calling update", () => {
  const cases: [number, number][] = [
    [-1, 10], [NaN, 10], [Infinity, 10], [-Infinity, 10],
    [20, 0], [20, -1], [20, NaN], [20, Infinity], [20, -Infinity],
    [1, Number.MIN_VALUE],
  ];
  for (const [availableMs, stepMs] of cases) {
    assert.throws(() => advanceInputFrame(tickState(), availableMs, stepMs, () => {
      throw new Error("invalid timing reached update");
    }), RangeError, `${availableMs}, ${stepMs}`);
  }
});

function turretInputGame(): GameState {
  const state = createGameState(1, 1);
  state.screen = GameScreen.PLAYING;
  state.currentMode = "turret";
  state.turretState = createTurretState();
  return state;
}

test("turret: explicit normalized aim owns the crosshair and the fired bolt", () => {
  const state = turretInputGame();
  const next = updateGame(state, { ...emptyKeys, right: true, up: true, shoot: true }, null, null, 16.67, { x: 0.25, y: 0.75 });
  assert.equal(next.turretState!.crosshairX, 0.25);
  assert.equal(next.turretState!.crosshairY, 0.75);
  assert.equal(next.turretState!.bolts.length, 1);
  assert.equal(next.turretState!.bolts[0].targetX, 0.25);
  assert.equal(next.turretState!.bolts[0].targetY, 0.75);
});

test("turret: held normalized aim stays fixed across catch-up ticks until released", () => {
  const keys = { ...emptyKeys, right: true };
  const frame = advanceInputFrame(turretInputGame(), 30, 10, (state) =>
    updateGame(state, keys, null, null, 10, { x: 0.3, y: 0.7 }));
  assert.equal(frame.state.frameCount, 3);
  assert.equal(frame.state.turretState!.crosshairX, 0.3);
  assert.equal(frame.state.turretState!.crosshairY, 0.7);
  const released = updateGame(frame.state, keys, null, null, 16.67, null);
  assert.ok(Math.abs(released.turretState!.crosshairX - 0.312) < 1e-12);
  assert.equal(released.turretState!.crosshairY, 0.7);
});

test("turret: finite aim clamps to the playable crosshair range", () => {
  for (const [aim, expected] of [
    [{ x: -2, y: 3 }, { x: 0.05, y: 0.95 }],
    [{ x: 1, y: 0 }, { x: 0.95, y: 0.05 }],
  ]) {
    const state = turretInputGame();
    updateTurretEngine(state, { ...emptyKeys, left: true, down: true }, aim);
    assert.equal(state.turretState!.crosshairX, expected.x);
    assert.equal(state.turretState!.crosshairY, expected.y);
  }
});

test("turret: absent or non-finite aim preserves normalized keyboard movement", () => {
  for (const aim of [null, { x: NaN, y: 0.2 }, { x: 0.2, y: NaN },
    { x: Infinity, y: 0.2 }, { x: 0.2, y: -Infinity }]) {
    const state = turretInputGame();
    updateTurretEngine(state, { ...emptyKeys, left: true, down: true }, aim);
    assert.ok(Math.abs(state.turretState!.crosshairX - (0.5 - 0.012 * Math.SQRT1_2)) < 1e-12);
    assert.ok(Math.abs(state.turretState!.crosshairY - (0.5 + 0.012 * Math.SQRT1_2)) < 1e-12);
  }
});

test("turret: paused gameplay does not consume explicit aim or fire", () => {
  const state = turretInputGame();
  state.screen = GameScreen.PAUSED;
  const next = updateGame(state, { ...emptyKeys, shoot: true }, null, null, 16.67, { x: 0.2, y: 0.8 });
  assert.equal(next, state);
  assert.equal(next.turretState!.crosshairX, 0.5);
  assert.equal(next.turretState!.crosshairY, 0.5);
  assert.equal(next.turretState!.bolts.length, 0);
});

function groundInputGame(): GameState {
  const state = createGameState(1, 1);
  state.screen = GameScreen.PLAYING;
  state.currentMode = "ground-run";
  state.player = { ...state.player, x: 128, y: 128, fireTimer: 0 };
  state.groundState = {
    tileMap: {
      width: 20, height: 12, tileSize: 32,
      tiles: Array.from({ length: 12 }, (_, row) => Array.from({ length: 20 }, () => row === 11 ? "solid" : "empty")),
    },
    cameraX: 0, groundEnemies: [], groundBullets: [],
    playerOnGround: false, playerVY: 0, playerFacingRight: true, goalReached: false,
  };
  return state;
}

const groundAimCases: [string, Partial<Keys>, number, number][] = [
  ["up", { up: true }, 0, -1],
  ["down", { down: true }, 0, 1],
  ["up-left", { up: true, left: true }, -Math.SQRT1_2, -Math.SQRT1_2],
  ["up-right", { up: true, right: true }, Math.SQRT1_2, -Math.SQRT1_2],
  ["down-left", { down: true, left: true }, -Math.SQRT1_2, Math.SQRT1_2],
  ["down-right", { down: true, right: true }, Math.SQRT1_2, Math.SQRT1_2],
];
for (const [direction, held, x, y] of groundAimCases) {
  test(`ground: ${direction} fires a projectile along the normalized aim vector`, () => {
    const state = groundInputGame();
    updateGroundEngine(state, { ...emptyKeys, ...held, shoot: true });
    assert.equal(state.groundState!.groundBullets.length, 1);
    const bullet = state.groundState!.groundBullets[0];
    assert.ok(Math.abs(bullet.vx - x * BULLET_SPEED) < 1e-12, `vx=${bullet.vx}`);
    assert.ok(Math.abs(bullet.vy - y * BULLET_SPEED) < 1e-12, `vy=${bullet.vy}`);
    assert.ok(Math.abs(Math.hypot(bullet.vx, bullet.vy) - BULLET_SPEED) < 1e-12);
    assert.equal(state.groundState!.playerVY, 0.5, "aim must not trigger jump");
  });
}

for (const facingRight of [false, true]) {
  test(`ground: opposed vertical inputs fire horizontally while facing ${facingRight ? "right" : "left"}`, () => {
    const state = groundInputGame();
    state.groundState!.playerFacingRight = facingRight;
    updateGroundEngine(state, { ...emptyKeys, up: true, down: true, shoot: true });
    const bullet = state.groundState!.groundBullets[0];
    assert.ok(bullet);
    assert.equal(bullet.vx, facingRight ? BULLET_SPEED : -BULLET_SPEED);
    assert.equal(bullet.vy, 0);
  });
}

test("ground: jump and fire remain independent held actions", () => {
  for (const action of ["jump", "shoot"] as const) {
    const state = groundInputGame();
    state.player.y = 11 * 32 - 40;
    state.groundState!.playerOnGround = true;
    const initialY = state.player.y;
    updateGroundEngine(state, { ...emptyKeys, [action]: true });
    if (action === "jump") {
      assert.ok(state.player.y < initialY);
      assert.ok(state.groundState!.playerVY < 0);
      assert.equal(state.groundState!.groundBullets.length, 0);
    } else {
      assert.equal(state.player.y, initialY);
      assert.equal(state.groundState!.playerVY, 0);
      assert.equal(state.groundState!.groundBullets.length, 1);
    }
  }
});

function boardingInputGame(): GameState {
  const state = createGameState(1, 1);
  state.screen = GameScreen.PLAYING;
  state.currentMode = "boarding";
  state.player = { ...state.player, x: 160, y: 160, fireTimer: 0, invincibleTimer: 0 };
  state.boardingState = {
    map: {
      width: 30, height: 30, tileSize: 32,
      tiles: Array.from({ length: 30 }, () => Array.from({ length: 30 }, () => "floor")),
    },
    cameraX: 0, cameraY: 0, enemies: [], bullets: [], playerFacing: "right",
    dashTimer: 0, dashCooldown: 0, goalReached: false,
  };
  return state;
}

const boardingAimCases: [string, Partial<Keys>, number, number][] = [
  ["up", { up: true }, 0, -1],
  ["down", { down: true }, 0, 1],
  ["left", { left: true }, -1, 0],
  ["right", { right: true }, 1, 0],
  ...groundAimCases.filter(([direction]) => direction.includes("-")),
];
for (const [direction, held, x, y] of boardingAimCases) {
  test(`boarding: ${direction} movement and retained fire share a normalized direction`, () => {
    const state = boardingInputGame();
    const bs = state.boardingState!;
    updateBoardingEngine(state, { ...emptyKeys, ...held, shoot: true });
    assert.ok(Math.abs(state.player.x - 160 - x * 2.5) < 1e-12);
    assert.ok(Math.abs(state.player.y - 160 - y * 2.5) < 1e-12);
    assert.equal(bs.bullets.length, 1);
    const first = bs.bullets[0];
    assert.ok(Math.abs(first.vx - x * 7) < 1e-12, `vx=${first.vx}`);
    assert.ok(Math.abs(first.vy - y * 7) < 1e-12, `vy=${first.vy}`);
    assert.ok(Math.abs(Math.hypot(first.vx, first.vy) - 7) < 1e-12);
    assert.equal(bs.dashTimer, 0);

    const stoppedAt = { x: state.player.x, y: state.player.y };
    state.player.fireTimer = 0;
    bs.bullets = [];
    updateBoardingEngine(state, { ...emptyKeys, shoot: true });
    assert.deepEqual({ x: state.player.x, y: state.player.y }, stoppedAt);
    assert.equal(bs.bullets.length, 1);
    assert.equal(bs.bullets[0].vx, first.vx, "release must retain aim");
    assert.equal(bs.bullets[0].vy, first.vy, "release must retain aim");
  });
}

test("boarding: movement, fire, and dash remain separate actions", () => {
  const moving = boardingInputGame();
  updateBoardingEngine(moving, { ...emptyKeys, right: true });
  assert.equal(moving.player.x, 162.5);
  assert.equal(moving.boardingState!.bullets.length, 0);
  assert.equal(moving.boardingState!.dashTimer, 0);

  const firing = boardingInputGame();
  updateBoardingEngine(firing, { ...emptyKeys, shoot: true });
  assert.equal(firing.player.x, 160);
  assert.equal(firing.player.y, 160);
  assert.equal(firing.boardingState!.bullets.length, 1);
  assert.equal(firing.boardingState!.dashTimer, 0);

  const dashing = boardingInputGame();
  updateBoardingEngine(dashing, { ...emptyKeys, jump: true });
  assert.equal(dashing.player.x, 160, "stationary dash must not introduce propulsion");
  assert.equal(dashing.player.y, 160);
  assert.equal(dashing.boardingState!.dashTimer, 7);
  assert.equal(dashing.boardingState!.bullets.length, 0);
  updateBoardingEngine(dashing, { ...emptyKeys, right: true });
  assert.equal(dashing.player.x, 168, "active dash retains its existing movement speed");
});

test("boarding: opposed movement inputs retain the previous diagonal aim", () => {
  const state = boardingInputGame();
  updateBoardingEngine(state, { ...emptyKeys, up: true, left: true });
  const stoppedAt = { x: state.player.x, y: state.player.y };
  updateBoardingEngine(state, { ...emptyKeys, up: true, down: true, left: true, right: true, shoot: true });
  assert.deepEqual({ x: state.player.x, y: state.player.y }, stoppedAt);
  assert.ok(Math.abs(state.boardingState!.bullets[0].vx + 7 * Math.SQRT1_2) < 1e-12);
  assert.ok(Math.abs(state.boardingState!.bullets[0].vy + 7 * Math.SQRT1_2) < 1e-12);
});

test("boarding: loaded cardinal art keeps a visible diagonal aim marker and matching dash trail", async () => {
  const originalImage = Object.getOwnPropertyDescriptor(globalThis, "Image");
  class TestImage {
    width = 36;
    height = 36;
    onload: (() => void) | null = null;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
  }
  Object.defineProperty(globalThis, "Image", { configurable: true, writable: true, value: TestImage });
  try {
    const sprite = await loadSprite(SPRITES.BOARDING_PLAYER_RIGHT);
    const state = boardingInputGame();
    updateBoardingEngine(state, { ...emptyKeys, up: true, right: true });
    const bs = state.boardingState!;
    bs.dashTimer = 4;
    const center = { x: state.player.x + 12 - bs.cameraX, y: state.player.y + 12 - bs.cameraY };
    const arcs: number[][] = [];
    const images: { args: unknown[]; alpha: unknown }[] = [];
    const properties: Record<PropertyKey, unknown> = { globalAlpha: 1 };
    const gradient = { addColorStop() {} };
    const methods: Record<PropertyKey, unknown> = {
      createLinearGradient: () => gradient, createRadialGradient: () => gradient,
      measureText: (value: unknown) => ({ width: String(value).length * 7 }),
      arc: (...args: number[]) => arcs.push(args),
      drawImage: (...args: unknown[]) => images.push({ args, alpha: properties.globalAlpha }),
    };
    const ctx = new Proxy(methods, {
      get(target, property) { return target[property] ?? properties[property] ?? (() => {}); },
      set(_target, property, value) { properties[property] = value; return true; },
    }) as unknown as CanvasRenderingContext2D;
    drawBoardingGame(ctx, state);
    assert.ok(arcs.some(([x, y, radius]) => radius === 3 &&
      Math.abs(x - center.x - 20 * Math.SQRT1_2) < 1e-12 &&
      Math.abs(y - center.y + 20 * Math.SQRT1_2) < 1e-12),
    "a visible marker must indicate actual diagonal fire even when a cardinal sprite loads");
    const trail = images.find(({ args, alpha }) => args[0] === sprite && alpha === 0.3);
    assert.ok(trail, "the existing cardinal sprite must still draw the dash trail");
    assert.ok(Math.abs(Number(trail.args[1]) - (center.x - 18 - 18 * Math.SQRT1_2)) < 1e-12);
    assert.ok(Math.abs(Number(trail.args[2]) - (center.y - 18 + 18 * Math.SQRT1_2)) < 1e-12);
  } finally {
    if (originalImage) Object.defineProperty(globalThis, "Image", originalImage);
    else Reflect.deleteProperty(globalThis, "Image");
  }
});

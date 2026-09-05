import { test } from "node:test";
import assert from "node:assert/strict";
import {
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
import type { GameMode, Keys } from "../../app/components/engine/types";

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

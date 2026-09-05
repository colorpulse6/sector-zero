import type { GameMode, GameState, Keys } from "./types";

export type InputContext =
  | { surface: "gameplay"; mode: GameMode }
  | { surface: "ui" }
  | { surface: "paused" }
  | { surface: "blocked" };

export interface KeyboardInput {
  key: string;
  code?: string;
  repeat?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

export type InputIntent =
  | "move-left" | "move-right" | "move-up" | "move-down"
  | "turn-left" | "turn-right" | "strafe-left" | "strafe-right"
  | "primary" | "secondary" | "jump" | "dash"
  | "ui-left" | "ui-right" | "ui-up" | "ui-down" | "activate" | "back"
  | "pause" | "mute";

export type HeldInputState = Readonly<Record<string, InputIntent>>;

type KeyBindings = Readonly<Partial<Record<string, InputIntent>>>;

const SHOOTER_BINDINGS: KeyBindings = {
  arrowleft: "move-left", a: "move-left",
  arrowright: "move-right", d: "move-right",
  arrowup: "move-up", w: "move-up",
  arrowdown: "move-down", s: "move-down",
  " ": "primary", z: "primary", shift: "primary", b: "secondary",
  escape: "pause", p: "pause", m: "mute",
};

const FIRST_PERSON_BINDINGS: KeyBindings = {
  ...SHOOTER_BINDINGS,
  arrowleft: "turn-left", arrowright: "turn-right",
  a: "strafe-left", d: "strafe-right",
};

const GAMEPLAY_BINDINGS: Record<GameMode, KeyBindings> = {
  shooter: SHOOTER_BINDINGS,
  "ground-run": { ...SHOOTER_BINDINGS, " ": "jump" },
  boarding: { ...SHOOTER_BINDINGS, " ": "dash" },
  "first-person": FIRST_PERSON_BINDINGS,
  turret: SHOOTER_BINDINGS,
  "base-defense": SHOOTER_BINDINGS,
  "mech-duel": SHOOTER_BINDINGS,
  "colony-exploration": FIRST_PERSON_BINDINGS,
};

const UI_BINDINGS: KeyBindings = {
  arrowleft: "ui-left", a: "ui-left",
  arrowright: "ui-right", d: "ui-right",
  arrowup: "ui-up", w: "ui-up",
  arrowdown: "ui-down", s: "ui-down",
  " ": "activate", z: "activate", shift: "activate", enter: "activate",
  escape: "back", m: "mute",
};

const PAUSED_BINDINGS: KeyBindings = {
  p: "pause", escape: "back", enter: "activate", m: "mute",
};

function normalizedKey(event: KeyboardInput): string {
  const code = event.code ?? "";
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  switch (code) {
    case "Space": return " ";
    case "ShiftLeft":
    case "ShiftRight": return "shift";
    case "Enter":
    case "NumpadEnter": return "enter";
    case "ArrowLeft":
    case "ArrowRight":
    case "ArrowUp":
    case "ArrowDown":
    case "Escape": return code.toLowerCase();
    default: return event.key.toLowerCase();
  }
}

export function mapKeyboardIntent(event: KeyboardInput, context: InputContext): InputIntent | null {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || context.surface === "blocked") {
    return null;
  }
  const bindings = context.surface === "gameplay"
    ? GAMEPLAY_BINDINGS[context.mode]
    : context.surface === "ui" ? UI_BINDINGS : PAUSED_BINDINGS;
  const key = normalizedKey(event);
  return Object.prototype.hasOwnProperty.call(bindings, key) ? bindings[key] ?? null : null;
}

export function keyboardInputSource(event: KeyboardInput): string {
  return event.code && event.code !== "Unidentified"
    ? `keyboard:${event.code}`
    : `keyboard:key:${normalizedKey(event)}`;
}

export function createEmptyInputState(): HeldInputState {
  return {};
}

export function pressInputSource(state: HeldInputState, sourceId: string, intent: InputIntent): HeldInputState {
  if (Object.prototype.hasOwnProperty.call(state, sourceId)) return state;
  return { ...state, [sourceId]: intent };
}

export function releaseInputSource(state: HeldInputState, sourceId: string): HeldInputState {
  if (!Object.prototype.hasOwnProperty.call(state, sourceId)) return state;
  const next = { ...state };
  delete next[sourceId];
  return next;
}

const ENGINE_FLAGS: Partial<Record<InputIntent, keyof Keys>> = {
  "move-left": "left", "turn-left": "left", "ui-left": "left",
  "move-right": "right", "turn-right": "right", "ui-right": "right",
  "move-up": "up", "ui-up": "up", "move-down": "down", "ui-down": "down",
  "strafe-left": "strafeLeft", "strafe-right": "strafeRight",
  primary: "shoot", activate: "shoot", secondary: "bomb", jump: "jump", dash: "jump",
};

export function toEngineKeys(state: HeldInputState): Keys {
  const keys: Keys = {
    left: false, right: false, up: false, down: false,
    strafeLeft: false, strafeRight: false, shoot: false, bomb: false, jump: false,
  };
  for (const intent of Object.values(state)) {
    const flag = ENGINE_FLAGS[intent];
    if (flag) keys[flag] = true;
  }
  return keys;
}

export function advanceInputFrame<T extends Pick<GameState, "screen" | "currentMode" | "currentPhase">>(
  state: T,
  availableMs: number,
  stepMs: number,
  update: (state: T) => T,
): { state: T; remainingMs: number; simulatedMs: number; boundaryChanged: boolean } {
  if (!Number.isFinite(availableMs) || availableMs < 0) {
    throw new RangeError("availableMs must be finite and nonnegative");
  }
  if (!Number.isFinite(stepMs) || stepMs <= 0) {
    throw new RangeError("stepMs must be finite and positive");
  }
  if (availableMs >= stepMs && availableMs - stepMs === availableMs) {
    throw new RangeError("stepMs must reduce availableMs");
  }
  let remainingMs = availableMs;
  let simulatedMs = 0;
  let boundaryChanged = false;
  while (remainingMs >= stepMs) {
    // Capture primitives: an engine update may mutate and return the same object.
    const { screen, currentMode, currentPhase } = state;
    remainingMs -= stepMs;
    simulatedMs += stepMs;
    state = update(state);
    if (state.screen !== screen || state.currentMode !== currentMode || state.currentPhase !== currentPhase) {
      boundaryChanged = true;
      break;
    }
  }
  return { state, remainingMs, simulatedMs, boundaryChanged };
}

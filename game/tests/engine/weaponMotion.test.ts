import { test } from "node:test";
import assert from "node:assert/strict";
import { stepWeaponMotion, weaponOffsets, type WeaponMotion } from "../../app/components/engine/weaponMotion";
import { updateFirstPerson } from "../../app/components/engine/firstPersonEngine";
import { drawGunHUD } from "../../app/components/engine/firstPersonRenderer";
import { CANVAS_WIDTH, GAME_AREA_HEIGHT } from "../../app/components/engine/types";
import type { BoardingMap, FirstPersonState, GameState, Keys } from "../../app/components/engine/types";

const FRAME_MS = 16.67;
const STEP = { deltaX: 0, deltaY: 0, dtMs: FRAME_MS, gunFireTimer: 0, dialogueActive: false };
const REST: WeaponMotion = { phase: 0, amplitude: 0, recoil: 0 };

function close(actual: number, expected: number, message: string): void {
  assert.ok(Math.abs(actual - expected) < 1e-10, `${message}: ${actual} vs ${expected}`);
}

test("weapon motion: absent state is neutral, with finite render offsets", () => {
  assert.deepEqual(stepWeaponMotion(undefined, STEP), REST);
  assert.deepEqual(weaponOffsets(undefined), { x: 0, y: 0 });
});

test("weapon motion: equivalent travel has the same gait and offsets across dt", () => {
  const full = stepWeaponMotion(undefined, { ...STEP, deltaX: 0.06 });
  let halves: WeaponMotion | undefined;
  for (let i = 0; i < 2; i++) {
    halves = stepWeaponMotion(halves, { ...STEP, deltaX: 0.03, dtMs: FRAME_MS / 2 });
  }
  assert.ok(full.phase > 0, "travel advances the gait");
  assert.ok(full.amplitude > 0, "travel introduces subtle bob");
  close(halves!.phase, full.phase, "gait phase");
  close(halves!.amplitude, full.amplitude, "moving envelope");
  close(weaponOffsets(halves).x, weaponOffsets(full).x, "horizontal offset");
  close(weaponOffsets(halves).y, weaponOffsets(full).y, "vertical offset");
});

test("weapon motion: actual distance works equally for forward, strafe, and diagonal travel", () => {
  const forwards = stepWeaponMotion(undefined, { ...STEP, deltaX: 0.06 });
  const strafe = stepWeaponMotion(undefined, { ...STEP, deltaY: -0.06 });
  const diagonal = stepWeaponMotion(undefined, { ...STEP, deltaX: 0.06 * Math.SQRT1_2, deltaY: 0.06 * Math.SQRT1_2 });
  close(strafe.phase, forwards.phase, "strafe gait");
  close(diagonal.phase, forwards.phase, "diagonal gait");
});

test("weapon motion: zero travel keeps gait phase still and smoothly settles the offsets", () => {
  const moving = stepWeaponMotion(undefined, { ...STEP, deltaX: 0.3 });
  let settled = stepWeaponMotion(moving, STEP);
  assert.equal(settled.phase, moving.phase);
  assert.ok(settled.amplitude > 0 && settled.amplitude < moving.amplitude, "first idle step eases toward rest");
  assert.ok(Math.abs(weaponOffsets(settled).x) < Math.abs(weaponOffsets(moving).x));
  for (let i = 0; i < 120; i++) settled = stepWeaponMotion(settled, STEP);
  assert.equal(settled.phase, moving.phase);
  assert.ok(Math.abs(weaponOffsets(settled).x) < 0.001);
  assert.ok(Math.abs(weaponOffsets(settled).y) < 0.001);
});

test("weapon motion: idle settling is equivalent across dt and a long stall is clamped", () => {
  const moving = { phase: 0.9, amplitude: 0.8, recoil: 0 };
  const full = stepWeaponMotion(moving, STEP);
  const half = stepWeaponMotion(moving, { ...STEP, dtMs: FRAME_MS / 2 });
  const halves = stepWeaponMotion(half, { ...STEP, dtMs: FRAME_MS / 2 });
  close(full.amplitude, halves.amplitude, "settle envelope");
  assert.deepEqual(
    stepWeaponMotion(moving, { ...STEP, dtMs: 5000 }),
    stepWeaponMotion(moving, { ...STEP, dtMs: FRAME_MS * 3 }),
  );
});

test("weapon motion: dialogue freezes gait, settle, and recoil without mutating prior state", () => {
  const previous = Object.freeze({ phase: 0.7, amplitude: 0.6, recoil: 0.4 });
  const frozen = stepWeaponMotion(previous, { ...STEP, deltaX: 1, gunFireTimer: 6, dtMs: 1000, dialogueActive: true });
  assert.equal(frozen, previous, "dialogue retains the same presentation record");
  assert.deepEqual(stepWeaponMotion(undefined, { ...STEP, dialogueActive: true }), REST);
});

test("weapon motion: recoil follows the existing six-frame shot timer without accumulating", () => {
  const shot = stepWeaponMotion(undefined, { ...STEP, gunFireTimer: 6 });
  const halfway = stepWeaponMotion(shot, { ...STEP, gunFireTimer: 3 });
  const rested = stepWeaponMotion(halfway, STEP);
  assert.equal(shot.recoil, 1);
  assert.equal(halfway.recoil, 0.5);
  assert.deepEqual(rested, REST);
  assert.ok(weaponOffsets(shot).y > weaponOffsets(halfway).y);
  let repeated = shot;
  for (let i = 0; i < 100; i++) repeated = stepWeaponMotion(repeated, { ...STEP, gunFireTimer: 6 });
  assert.deepEqual(repeated, shot);
});

test("weapon motion: invalid inputs and legacy/corrupt state produce finite bounded offsets", () => {
  const values = [Number.NaN, Infinity, -Infinity, -1, 0, Number.MAX_VALUE];
  for (const value of values) {
    const corrupt = { phase: value, amplitude: value, recoil: value };
    const next = stepWeaponMotion(corrupt, { ...STEP, deltaX: value, deltaY: value, dtMs: value, gunFireTimer: value });
    for (const state of [corrupt, next]) {
      const offsets = weaponOffsets(state);
      assert.ok(Number.isFinite(offsets.x) && Number.isFinite(offsets.y));
      assert.ok(Math.abs(offsets.x) <= 3 && offsets.y >= 0 && offsets.y <= 7);
    }
    assert.ok(Number.isFinite(next.phase) && next.phase >= 0 && next.phase < Math.PI * 2);
    assert.ok(next.amplitude >= 0 && next.amplitude <= 1);
    assert.ok(next.recoil >= 0 && next.recoil <= 1);
  }
});

test("weapon motion: invalid or nonpositive simulation dt does not advance the presentation", () => {
  const previous = { phase: 0.7, amplitude: 0.6, recoil: 0.4 };
  for (const dtMs of [0, -1, Number.NaN, Infinity]) {
    assert.deepEqual(stepWeaponMotion(previous, { ...STEP, deltaX: 1, dtMs, gunFireTimer: 6 }), previous);
  }
});

const NO_KEYS: Keys = {
  left: false, right: false, up: false, down: false,
  strafeLeft: false, strafeRight: false, shoot: false, bomb: false, jump: false,
};
const OPEN_MAP: BoardingMap = {
  width: 5, height: 5, tileSize: 32,
  tiles: [
    ["wall", "wall", "wall", "wall", "wall"],
    ["wall", "floor", "floor", "floor", "wall"],
    ["wall", "floor", "floor", "floor", "wall"],
    ["wall", "floor", "floor", "floor", "wall"],
    ["wall", "wall", "wall", "wall", "wall"],
  ],
};

function game(overrides: Partial<FirstPersonState> = {}): GameState {
  return {
    firstPersonState: {
      map: OPEN_MAP, posX: 2.5, posY: 2.5,
      dirX: 1, dirY: 0, planeX: 0, planeY: 0.66,
      moveSpeed: 0.06, rotSpeed: 0.04, goalReached: false,
      enemies: [], gunFireTimer: 0, gunCooldown: 0, npcs: [], dialogState: null,
      ...overrides,
    },
    levelCompleteTimer: 0,
    player: { invincibleTimer: 0, bankDir: 0, hp: 10, maxHp: 10 },
    lives: 3, deaths: 0, score: 0, xp: 0, kills: 0,
    screenShake: 0, equippedWeaponType: "kinetic", allocatedSkills: [],
    floatingLabels: [], audioEvents: [],
  } as unknown as GameState;
}

test("weapon motion integration: blocked input and turning in place never advance gait", () => {
  const blocked = game({ posX: 3.74 });
  updateFirstPerson(blocked, { ...NO_KEYS, up: true });
  assert.equal(blocked.firstPersonState!.posX, 3.74);
  assert.deepEqual(blocked.firstPersonState!.weaponMotion, REST);
  const turning = game();
  updateFirstPerson(turning, { ...NO_KEYS, left: true });
  assert.deepEqual(turning.firstPersonState!.weaponMotion, REST);
});

test("weapon motion integration: wall sliding measures only collision-resolved travel", () => {
  const sliding = game({ posX: 3.74 });
  updateFirstPerson(sliding, { ...NO_KEYS, up: true, strafeRight: true });
  const fp = sliding.firstPersonState!;
  assert.equal(fp.posX, 3.74);
  assert.ok(fp.posY > 2.5);
  const expected = stepWeaponMotion(undefined, { ...STEP, deltaY: fp.posY - 2.5 });
  assert.deepEqual(fp.weaponMotion, expected);
  assert.ok(fp.weaponMotion!.phase > 0);
});

test("weapon motion integration: existing speed and equivalent dt produce matching presentation", () => {
  const full = game(), halves = game();
  updateFirstPerson(full, { ...NO_KEYS, up: true });
  updateFirstPerson(halves, { ...NO_KEYS, up: true }, FRAME_MS / 2);
  updateFirstPerson(halves, { ...NO_KEYS, up: true }, FRAME_MS / 2);
  close(full.firstPersonState!.posX - 2.5, 0.06, "existing movement speed");
  assert.ok(full.firstPersonState!.weaponMotion);
  close(full.firstPersonState!.weaponMotion!.phase, halves.firstPersonState!.weaponMotion!.phase, "engine gait");
});

test("weapon motion integration: a shot presents recoil immediately without changing cooldown", () => {
  const firing = game();
  updateFirstPerson(firing, { ...NO_KEYS, shoot: true });
  const fp = firing.firstPersonState!;
  assert.equal(fp.gunCooldown, 15);
  assert.equal(fp.gunFireTimer, 6);
  assert.equal(fp.weaponMotion?.recoil, 1);
  updateFirstPerson(firing, NO_KEYS);
  assert.equal(fp.gunCooldown, 14);
  assert.equal(fp.gunFireTimer, 5);
  assert.equal(fp.weaponMotion?.recoil, 5 / 6);
});

test("weapon motion integration: dialogue freezes the presentation including its closing frame", () => {
  const previous = Object.freeze({ phase: 0.7, amplitude: 0.6, recoil: 0.4 });
  const talking = game({
    weaponMotion: previous,
    dialogState: { active: true, npcId: 1, lines: [{ speaker: "Q", text: "Hello" }], currentLine: 0, shopOpen: false },
  });
  updateFirstPerson(talking, { ...NO_KEYS, up: true });
  assert.equal(talking.firstPersonState!.weaponMotion, previous);
  updateFirstPerson(talking, { ...NO_KEYS, shoot: true });
  assert.equal(talking.firstPersonState!.dialogState, null);
  assert.equal(talking.firstPersonState!.weaponMotion, previous);
  updateFirstPerson(talking, NO_KEYS);
  assert.ok(talking.firstPersonState!.weaponMotion!.amplitude < previous.amplitude);
});

test("weapon motion integration: colony early return still advances travel and settles idle", () => {
  const walking = game({
    colonyContext: {
      onLandingPadInteract: () => ({ kind: "none" }),
      onDoorInteract: () => ({ kind: "no_door" }),
    } as unknown as FirstPersonState["colonyContext"],
  });
  updateFirstPerson(walking, { ...NO_KEYS, up: true });
  const moving = walking.firstPersonState!.weaponMotion;
  assert.ok(moving && moving.phase > 0 && moving.amplitude > 0);
  updateFirstPerson(walking, NO_KEYS);
  const idle = walking.firstPersonState!.weaponMotion!;
  assert.equal(idle.phase, moving.phase);
  assert.ok(idle.amplitude < moving.amplitude);
});

function renderGun(fp: FirstPersonState): number[][] {
  const rectangles: number[][] = [];
  const canvas = new Proxy({
    fillRect: (...args: number[]) => rectangles.push(args),
  } as Record<string, unknown>, {
    get: (target, key: string) => target[key] ?? (() => undefined),
    set: (target, key: string, value: unknown) => { target[key] = value; return true; },
  });
  drawGunHUD(canvas as unknown as CanvasRenderingContext2D, fp);
  return rectangles;
}

test("weapon motion HUD: a legacy state draws a stationary gun at the neutral position", () => {
  const fp = game().firstPersonState!;
  const rectangles = renderGun(fp);
  assert.deepEqual(rectangles[0], [CANVAS_WIDTH / 2 - 15, GAME_AREA_HEIGHT - 140, 30, 100]);
  assert.deepEqual(renderGun(fp), rectangles);
  assert.equal(fp.weaponMotion, undefined, "rendering does not initialize simulation state");
});

test("weapon motion HUD: draw offsets match the simulation and repeated draws never mutate it", () => {
  const weaponMotion = Object.freeze({ phase: Math.PI / 2, amplitude: 1, recoil: 1 });
  const fp = game({ weaponMotion }).firstPersonState!;
  const rectangles = renderGun(fp);
  assert.deepEqual(rectangles[0], [CANVAS_WIDTH / 2 - 15 + 3, GAME_AREA_HEIGHT - 140 + 7, 30, 100]);
  assert.deepEqual(renderGun(fp), rectangles);
  assert.equal(fp.weaponMotion, weaponMotion);
});

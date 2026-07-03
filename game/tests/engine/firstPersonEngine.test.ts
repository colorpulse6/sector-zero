import { test } from "node:test";
import assert from "node:assert/strict";
import {
  updateFirstPerson,
  __runFirstPersonSelfTests,
} from "../../app/components/engine/firstPersonEngine";
import type { BoardingMap, Keys } from "../../app/components/engine/types";

// ─── Fixtures ────────────────────────────────────────────────────────
// Task 6: frame-rate-independent movement. These tests pin the delta-time
// contract: dtF = min(dtMs / 16.67, 3), so 16.67ms → 1.0 (60fps identity).

const NO_KEYS: Keys = {
  left: false, right: false, up: false, down: false,
  strafeLeft: false, strafeRight: false,
  shoot: false, bomb: false, jump: false,
};

function keys(overrides: Partial<Keys> = {}): Keys {
  return { ...NO_KEYS, ...overrides };
}

const OPEN_MAP: BoardingMap = {
  width: 5,
  height: 5,
  tileSize: 32,
  tiles: [
    ["wall", "wall", "wall", "wall", "wall"],
    ["wall", "floor", "floor", "floor", "wall"],
    ["wall", "floor", "floor", "floor", "wall"],
    ["wall", "floor", "floor", "floor", "wall"],
    ["wall", "wall", "wall", "wall", "wall"],
  ],
};

// Minimal combat FP GameState facing +X (dirX=1) at the center of open space.
function makeFpGame(fpOverrides: Record<string, unknown> = {}) {
  const fp = {
    map: OPEN_MAP,
    posX: 2.5, posY: 2.5,
    dirX: 1, dirY: 0, planeX: 0, planeY: 0.66,
    moveSpeed: 0.06, rotSpeed: 0.04,
    goalReached: false,
    enemies: [] as unknown[],
    gunFireTimer: 0, gunCooldown: 0,
    npcs: [], dialogState: null,
    ...fpOverrides,
  };
  const game = {
    firstPersonState: fp,
    levelCompleteTimer: 0,
    player: { invincibleTimer: 0, bankDir: 0, hp: 10, maxHp: 10 },
    lives: 3, deaths: 0, score: 0, xp: 0, kills: 0,
    screenShake: 0,
    equippedWeaponType: "kinetic",
    allocatedSkills: [],
    floatingLabels: [],
    audioEvents: [],
  };
  // Loosely typed on purpose: updateFirstPerson only touches the fields above.
  return { game: game as never, fp };
}

// ─── Tests ───────────────────────────────────────────────────────────

test("dt: two half-steps travel the same distance as one full step (±1e-9)", () => {
  const HALF = 16.67 / 2;

  const full = makeFpGame();
  updateFirstPerson(full.game, keys({ up: true }), 16.67);
  const distFull = full.fp.posX - 2.5;

  const halved = makeFpGame();
  updateFirstPerson(halved.game, keys({ up: true }), HALF);
  updateFirstPerson(halved.game, keys({ up: true }), HALF);
  const distHalf = halved.fp.posX - 2.5;

  assert.ok(distFull > 0, "full step should move forward");
  assert.ok(Math.abs(distFull - distHalf) < 1e-9,
    `half-steps ${distHalf} must equal full step ${distFull}`);
});

test("dt: a huge dtMs clamps to 3 frames of movement (not 12)", () => {
  const single = makeFpGame();
  updateFirstPerson(single.game, keys({ up: true }), 16.67);
  const distSingle = single.fp.posX - 2.5;

  const clamped = makeFpGame();
  updateFirstPerson(clamped.game, keys({ up: true }), 200); // 200/16.67 ≈ 12 → clamp 3
  const distClamped = clamped.fp.posX - 2.5;

  assert.ok(Math.abs(distClamped - distSingle * 3) < 1e-9,
    `dtMs=200 should move 3× a single step, got ${distClamped / distSingle}×`);
  assert.ok(distClamped < distSingle * 12 - 1e-9, "must NOT move 12 frames' worth");
});

test("dt: a cooldown that overshoots 0 under dtF=3 still fires at the <=0 window", () => {
  // gunCooldown 2, dtF=3 → 2 - 3 = -1 (floored to 0) → <= 0 → fire.
  const firing = makeFpGame({ gunCooldown: 2 });
  updateFirstPerson(firing.game, keys({ shoot: true }), 200);
  assert.ok(firing.fp.gunFireTimer > 0, "cooldown should fire when it reaches the <=0 window");

  // Control: a cooldown still above 0 after one 60fps step must NOT fire.
  const cooling = makeFpGame({ gunCooldown: 10 });
  updateFirstPerson(cooling.game, keys({ shoot: true }), 16.67); // 10 - 1 = 9 > 0
  assert.equal(cooling.fp.gunFireTimer, 0, "still-cooling gun must not fire");
});

test("dt: a dying enemy reaches the -1 sentinel and is removed under dtF=3", () => {
  const dyingEnemy = {
    id: 1, x: 3.5, y: 2.5, hp: 0, maxHp: 3, speed: 0.015,
    type: "grunt", aggroRange: 6, isAggro: false, deathTimer: 30,
    fireTimer: 0, classId: "swarm",
  };
  const dying = makeFpGame({ enemies: [dyingEnemy] });

  // deathTimer 30 at dtF=3 → -3/frame → hits <=0 after 10 frames, becomes -1,
  // then the `!== -1` filter removes it. If deathTimer were (wrongly) clamped at
  // 0 it would park at the "alive" value and never be removed — this would hang
  // until the guard and fail the length assertion.
  let guard = 0;
  while ((dying.fp.enemies as unknown[]).length > 0 && guard++ < 40) {
    updateFirstPerson(dying.game, NO_KEYS, 200);
  }
  assert.equal((dying.fp.enemies as unknown[]).length, 0,
    "dying enemy must transition to -1 and be filtered out");
  assert.ok(guard <= 12, `should remove within ~10 frames at dtF=3, took ${guard}`);
});

test("FP engine self-test suite passes (console.assert guard)", () => {
  // __runFirstPersonSelfTests uses console.assert (non-throwing). Patch it to
  // collect failures so the whole self-test function — including the Task 6
  // delta-time scenarios — is verified as a real pass/fail in CI.
  const original = console.assert;
  const failures: string[] = [];
  console.assert = ((cond: unknown, ...args: unknown[]) => {
    if (!cond) failures.push(args.map(String).join(" "));
  }) as typeof console.assert;
  try {
    __runFirstPersonSelfTests();
  } finally {
    console.assert = original;
  }
  assert.equal(failures.length, 0, `self-test failures: ${failures.join(" | ")}`);
});

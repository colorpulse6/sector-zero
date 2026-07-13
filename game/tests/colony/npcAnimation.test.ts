// Animated NPC billboards (DOOM overhaul) — pins:
//   - resolveNpcSprite frame selection: walkSprites while isMoving, idleSprites
//     while standing, fallback chain walk → idle → static, FRAME_MS boundaries,
//     wrap-around, and the strict opt-in guarantee (no animation fields → the
//     exact pre-existing static resolution, golden-safe).
//   - stepColonyNpcs animation input: animClockMs accumulates threaded dtMs
//     (frozen with the plaza during dialog), isMoving true only on frames where
//     the NPC actually moved (path advance / applied idle-mill shuffle).
//   - The quartermaster's own sprite (spec 2026-07-05 §5.4): no longer shares
//     SPRITES.NPC_KAEL.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveNpcSprite, NPC_ANIM_FRAME_MS, NPC_SPRITE_MAP } from "../../app/components/engine/fpRender/sceneInput";
import { SPRITES } from "../../app/components/engine/sprites";
import { stepColonyNpcs } from "../../app/components/colony/exploration/npc/npcStep";
import { generateColonyNpcs } from "../../app/components/colony/exploration/npc/colonyNpcs";
import { generateExteriorState } from "../../app/components/colony/exploration/colonyLayout";
import type { BoardingMap, FPNPC, FPDialogLine } from "../../app/components/engine/types";
import type { ColonyNpc, Tile } from "../../app/components/colony/exploration/npc/types";
import type { GameClock } from "../../app/components/colony/shared/colonyTypes";
import { makeTestColony } from "./fixtures";

const STEP_MS = 16.67; // dtF = 1
const CLOCK: GameClock = { day: 3, hour: 12, minute: 0, realtimeMsPerGameMinute: 1000, season: "standard" };

const WALK = ["/sprites/test/walk-0.png", "/sprites/test/walk-1.png", "/sprites/test/walk-2.png"];
const IDLE = ["/sprites/test/idle-0.png", "/sprites/test/idle-1.png"];
const STATIC = "/sprites/test/static.png";

// 6x6: perimeter wall, open floor interior (x,y in 1..4) — matches npcStep.test.ts.
function room(): BoardingMap {
  const W = 6, H = 6;
  const tiles = Array.from({ length: H }, (_, y) =>
    Array.from({ length: W }, (_, x) =>
      (x === 0 || y === 0 || x === W - 1 || y === H - 1) ? "wall" : "floor"));
  return { width: W, height: H, tileSize: 32, tiles: tiles as never };
}

function makeNpc(id: number, spawn: Tile, target: Tile, opts: Partial<ColonyNpc> = {}): ColonyNpc {
  return {
    id, kind: "colonist", name: "C", sprite: "s",
    posX: spawn.x + 0.5, posY: spawn.y + 0.5,
    homeTile: spawn, workTile: target, postTile: null,
    targetTile: target, happinessTier: "content",
    path: [], pathComputed: false, millSeed: 12345, millCounter: 0,
    ...opts,
  };
}

function makeFp(id: number, x: number, y: number): FPNPC {
  return {
    id, x, y, name: "C", type: "lore",
    dialog: [] as FPDialogLine[], color: "#fff", interacted: false,
  };
}

// ─── Frame selection: walk vs idle vs static, boundaries, wrap-around ─────────

test("resolveNpcSprite: moving NPC cycles walkSprites on FRAME_MS boundaries and wraps", () => {
  const at = (animClockMs: number): string =>
    resolveNpcSprite({ name: "A", sprite: STATIC, walkSprites: WALK, idleSprites: IDLE, isMoving: true, animClockMs });
  assert.equal(at(0), WALK[0], "clock 0 → frame 0");
  assert.equal(at(NPC_ANIM_FRAME_MS - 0.01), WALK[0], "just under one FRAME_MS → still frame 0");
  assert.equal(at(NPC_ANIM_FRAME_MS), WALK[1], "exactly FRAME_MS → frame 1");
  assert.equal(at(2 * NPC_ANIM_FRAME_MS - 1), WALK[1], "just under 2×FRAME_MS → frame 1");
  assert.equal(at(2 * NPC_ANIM_FRAME_MS), WALK[2], "2×FRAME_MS → frame 2");
  assert.equal(at(3 * NPC_ANIM_FRAME_MS), WALK[0], "3×FRAME_MS wraps back to frame 0 (n=3)");
  assert.equal(at(7 * NPC_ANIM_FRAME_MS), WALK[1], "7×FRAME_MS → 7 % 3 = frame 1");
});

test("resolveNpcSprite: standing NPC cycles idleSprites, never walk frames", () => {
  const at = (animClockMs: number): string =>
    resolveNpcSprite({ name: "A", sprite: STATIC, walkSprites: WALK, idleSprites: IDLE, isMoving: false, animClockMs });
  assert.equal(at(0), IDLE[0]);
  assert.equal(at(NPC_ANIM_FRAME_MS), IDLE[1]);
  assert.equal(at(2 * NPC_ANIM_FRAME_MS), IDLE[0], "wraps (n=2)");
  // Walk frames while standing would look like moonwalking-in-place: an NPC
  // with ONLY walk frames falls through to the static sprite when idle.
  assert.equal(
    resolveNpcSprite({ name: "A", sprite: STATIC, walkSprites: WALK, isMoving: false, animClockMs: 999 }),
    STATIC, "idle + walkSprites only → static, walk frames never shown standing");
});

test("resolveNpcSprite: fallback chain walk → idle → static", () => {
  // Moving, no walkSprites → idle frames stand in.
  assert.equal(
    resolveNpcSprite({ name: "A", sprite: STATIC, idleSprites: IDLE, isMoving: true, animClockMs: NPC_ANIM_FRAME_MS }),
    IDLE[1], "moving without walk frames falls back to idle frames");
  // Moving, neither array → static sprite.
  assert.equal(
    resolveNpcSprite({ name: "A", sprite: STATIC, isMoving: true, animClockMs: 999 }),
    STATIC, "moving without any frames falls back to the static sprite");
  // Empty arrays behave as absent (no frames[NaN % 0] traps).
  assert.equal(
    resolveNpcSprite({ name: "A", sprite: STATIC, walkSprites: [], idleSprites: [], isMoving: true, animClockMs: 999 }),
    STATIC, "empty frame arrays are treated as absent");
  // Undefined animClockMs reads as 0 → frame 0.
  assert.equal(
    resolveNpcSprite({ name: "A", sprite: STATIC, walkSprites: WALK, isMoving: true }),
    WALK[0], "missing animClockMs → frame 0");
});

test("resolveNpcSprite: NPCs without animation fields resolve exactly as before (opt-in guarantee)", () => {
  // Even with isMoving/animClockMs set, no frame arrays → the legacy chain:
  // explicit sprite → name map → survivor. This is what keeps existing scenes
  // (and their golden hashes) bit-identical.
  assert.equal(
    resolveNpcSprite({ name: "Doc Kael", sprite: STATIC, isMoving: true, animClockMs: 5000 }),
    STATIC, "explicit sprite still wins");
  assert.equal(
    resolveNpcSprite({ name: "Doc Kael", isMoving: true, animClockMs: 5000 }),
    NPC_SPRITE_MAP["Doc Kael"], "name map still applies");
  assert.equal(
    resolveNpcSprite({ name: "Nobody In The Map", isMoving: true }),
    SPRITES.NPC_SURVIVOR, "survivor fallback still applies");
});

// ─── dt accumulation: animClockMs is threaded step time, frozen with dialog ───

test("stepColonyNpcs: animClockMs accumulates the exact threaded dtMs per stepped frame", () => {
  const map = room();
  const npc = makeNpc(0, { x: 1, y: 1 }, { x: 4, y: 4 });
  const fp = makeFp(0, npc.posX, npc.posY);

  let expected = 0;
  for (let i = 0; i < 10; i++) { stepColonyNpcs([npc], [fp], map, STEP_MS, false); expected += STEP_MS; }
  for (let i = 0; i < 5; i++) { stepColonyNpcs([npc], [fp], map, 33.34, false); expected += 33.34; }
  assert.equal(fp.animClockMs, expected, "clock = sum of stepped dtMs (variable dt included)");
});

test("stepColonyNpcs: dialogActive freezes animClockMs and isMoving with the plaza", () => {
  const map = room();
  const npc = makeNpc(0, { x: 1, y: 1 }, { x: 4, y: 4 });
  const fp = makeFp(0, npc.posX, npc.posY);

  stepColonyNpcs([npc], [fp], map, STEP_MS, false);   // one real step
  const clock = fp.animClockMs, moving = fp.isMoving;
  assert.equal(typeof clock, "number");
  assert.equal(moving, true);

  for (let i = 0; i < 50; i++) stepColonyNpcs([npc], [fp], map, STEP_MS, true);
  assert.equal(fp.animClockMs, clock, "clock does not advance during dialog → frame freezes");
  assert.equal(fp.isMoving, moving, "isMoving untouched during dialog");
});

// ─── isMoving: true only on frames where the NPC actually moved ───────────────

test("stepColonyNpcs: isMoving is true on every path-advancing frame", () => {
  const map = room();
  const npc = makeNpc(0, { x: 1, y: 1 }, { x: 4, y: 4 });
  const fp = makeFp(0, npc.posX, npc.posY);
  for (let i = 0; i < 20; i++) {
    stepColonyNpcs([npc], [fp], map, STEP_MS, false);
    assert.ok(npc.path.length > 0, `step ${i}: still en route (test premise)`);
    assert.equal(fp.isMoving, true, `step ${i}: advancing along the path → moving`);
  }
});

test("stepColonyNpcs: idle-mill shuffles count as moving; a walkable-rejected candidate does not", () => {
  const map = room();
  // Anchor hugs the west wall (x < 1 is solid): pathComputed with an empty path
  // drops straight into the mill, capturing anchor (1.05, 1.5). With millSeed 0
  // the drift candX = 1.05 + 0.3·sin(0.05c) dips below x=1 for part of the
  // cycle — those candidates are rejected by the walkable guard (position
  // held → NOT moving), while the rest are applied (shuffle → moving).
  const npc = makeNpc(0, { x: 1, y: 1 }, { x: 1, y: 1 }, { pathComputed: true, path: [], millSeed: 0 });
  npc.posX = 1.05; npc.posY = 1.5;
  const fp = makeFp(0, npc.posX, npc.posY);

  let movedFrames = 0, heldFrames = 0;
  for (let i = 0; i < 200; i++) {
    const px = npc.posX, py = npc.posY;
    stepColonyNpcs([npc], [fp], map, STEP_MS, false);
    const changed = npc.posX !== px || npc.posY !== py;
    assert.equal(fp.isMoving, changed, `step ${i}: isMoving mirrors an actual position change`);
    if (changed) movedFrames++; else heldFrames++;
  }
  assert.ok(movedFrames > 0, "some mill shuffles were applied (count as moving)");
  assert.ok(heldFrames > 0, "some candidates were wall-rejected (held → not moving)");
});

// ─── Quartermaster's own sprite (spec §5.4) ───────────────────────────────────

test("generateColonyNpcs: quartermaster has its own sprite — no longer shares Kael's", () => {
  const colony = makeTestColony({ layoutSeed: 42 });
  const map = generateExteriorState(colony, CLOCK).map;
  const { fpNpcs, sidecar } = generateColonyNpcs(colony, CLOCK, map);

  const qmIdx = sidecar.findIndex((n) => n.kind === "quartermaster");
  const govIdx = sidecar.findIndex((n) => n.kind === "governor");
  assert.ok(qmIdx >= 0 && govIdx >= 0, "governor + quartermaster present");
  const qmFp = fpNpcs[qmIdx], govFp = fpNpcs[govIdx];

  assert.equal(qmFp.sprite, SPRITES.NPC_QUARTERMASTER, "quartermaster uses its own asset");
  assert.equal(SPRITES.NPC_QUARTERMASTER, "/sprites/boarding/npc-quartermaster.png");
  assert.ok(
    existsSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "public", SPRITES.NPC_QUARTERMASTER)),
    "quartermaster billboard asset exists on disk");
  assert.notEqual(qmFp.sprite, SPRITES.NPC_KAEL, "no longer reuses Kael's sprite path");
  assert.equal(govFp.sprite, SPRITES.NPC_VOSS, "governor unchanged");
  assert.equal(sidecar[qmIdx].sprite, qmFp.sprite, "sidecar mirrors the FPNPC sprite");
  // Standing still: frame selection falls back to the static billboard.
  assert.equal(resolveNpcSprite(qmFp), SPRITES.NPC_QUARTERMASTER);

  // The quartermaster carries the reference-locked 2-frame walk cycle; both
  // frame assets must exist on disk (a lost asset should fail here, not
  // render the transparent-billboard fallback).
  assert.deepEqual(qmFp.walkSprites, [SPRITES.NPC_QUARTERMASTER_WALK_1, SPRITES.NPC_QUARTERMASTER_WALK_2]);
  for (const framePath of qmFp.walkSprites ?? []) {
    assert.ok(
      existsSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "public", framePath)),
      `walk frame asset exists on disk: ${framePath}`);
  }
  // Walking: the selector alternates the walk frames by the anim clock.
  const walking = { ...qmFp, isMoving: true, animClockMs: 0 };
  assert.equal(resolveNpcSprite(walking), SPRITES.NPC_QUARTERMASTER_WALK_1);
  walking.animClockMs = 180;
  assert.equal(resolveNpcSprite(walking), SPRITES.NPC_QUARTERMASTER_WALK_2);

  // The enabler stays opt-in — every OTHER colony NPC renders statically.
  for (const fp of fpNpcs) {
    if (fp === qmFp) continue;
    assert.equal(fp.walkSprites, undefined, `${fp.name}: no walk frames assigned at generation`);
    assert.equal(fp.idleSprites, undefined, `${fp.name}: no idle frames assigned at generation`);
  }
});

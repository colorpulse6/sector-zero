import { test } from "node:test";
import assert from "node:assert/strict";
import { stepColonyNpcs } from "../../app/components/colony/exploration/npc/npcStep";
import type { BoardingMap, FPNPC, FPDialogLine } from "../../app/components/engine/types";
import type { ColonyNpc, Tile } from "../../app/components/colony/exploration/npc/types";

const STEP_MS = 16.67; // dtF = 1

// 6x6: perimeter wall, open floor interior (x,y in 1..4).
function room(): BoardingMap {
  const W = 6, H = 6;
  const tiles = Array.from({ length: H }, (_, y) =>
    Array.from({ length: W }, (_, x) =>
      (x === 0 || y === 0 || x === W - 1 || y === H - 1) ? "wall" : "floor"));
  return { width: W, height: H, tileSize: 32, tiles: tiles as never };
}

// 5x5: perimeter wall + a solid wall column at x=2 splitting the interior into two
// disconnected floor corridors (left x=1, right x=3) with NO door — the right side is
// unreachable from the left.
function splitRoom(): BoardingMap {
  const W = 5, H = 5;
  const tiles = Array.from({ length: H }, (_, y) =>
    Array.from({ length: W }, (_, x) =>
      (x === 0 || y === 0 || x === W - 1 || y === H - 1 || x === 2) ? "wall" : "floor"));
  return { width: W, height: H, tileSize: 32, tiles: tiles as never };
}

function walkable(map: BoardingMap, x: number, y: number): boolean {
  const tx = Math.floor(x), ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return false;
  const t = map.tiles[ty][tx];
  return t === "floor" || t === "door";
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

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

// ─── (a) An NPC with a path advances toward and reaches its target ────────────

test("stepColonyNpcs: an NPC advances toward and reaches its target (path empties)", () => {
  const map = room();
  const target: Tile = { x: 4, y: 4 };
  const npc = makeNpc(0, { x: 1, y: 1 }, target);
  const fp = makeFp(0, npc.posX, npc.posY);
  const sidecar = [npc], fpNpcs = [fp];

  const startDist = dist(npc.posX, npc.posY, target.x + 0.5, target.y + 0.5);

  // First step: path is computed and the NPC starts moving.
  stepColonyNpcs(sidecar, fpNpcs, map, STEP_MS, false);
  assert.equal(npc.pathComputed, true, "path computed on first step");
  assert.ok(npc.path.length > 0, "a non-trivial path exists (start !== target)");

  // After a handful of steps it is measurably closer (advances toward target).
  for (let i = 0; i < 20; i++) stepColonyNpcs(sidecar, fpNpcs, map, STEP_MS, false);
  assert.ok(
    dist(npc.posX, npc.posY, target.x + 0.5, target.y + 0.5) < startDist,
    "NPC moved closer to its target",
  );

  // Given enough frames it consumes the whole path and arrives.
  for (let i = 0; i < 400; i++) stepColonyNpcs(sidecar, fpNpcs, map, STEP_MS, false);
  assert.equal(npc.path.length, 0, "path fully consumed (arrived)");
  assert.ok(
    dist(npc.posX, npc.posY, target.x + 0.5, target.y + 0.5) < 0.5,
    "settled within the mill clamp of the target center",
  );
  // FPNPC x/y stayed synced to the sidecar throughout.
  assert.equal(fp.x, npc.posX);
  assert.equal(fp.y, npc.posY);
});

// ─── (b) On arrival it idle-mills, never on a solid tile ─────────────────────

test("stepColonyNpcs: idle-mill stays within clamp and never lands on a solid tile", () => {
  const map = room();
  // Target hugs the NW corner (walls at x=0 and y=0) so an over-wide mill would clip.
  const target: Tile = { x: 1, y: 1 };
  const npc = makeNpc(0, { x: 1, y: 1 }, target, { pathComputed: true, path: [] });
  const fp = makeFp(0, npc.posX, npc.posY);
  const sidecar = [npc], fpNpcs = [fp];

  for (let i = 0; i < 100; i++) {
    stepColonyNpcs(sidecar, fpNpcs, map, STEP_MS, false);
    assert.ok(
      walkable(map, npc.posX, npc.posY),
      `step ${i}: mill pos (${npc.posX.toFixed(3)}, ${npc.posY.toFixed(3)}) is walkable`,
    );
    // Bounded drift around the target center (well inside 1 tile).
    assert.ok(dist(npc.posX, npc.posY, target.x + 0.5, target.y + 0.5) <= 0.8, `step ${i}: within clamp`);
    // Sync held.
    assert.equal(fp.x, npc.posX);
    assert.equal(fp.y, npc.posY);
  }
});

test("stepColonyNpcs: idle-mill is deterministic given a fixed step count", () => {
  const map = room();
  const target: Tile = { x: 3, y: 3 };
  const runN = (n: number): [number, number] => {
    const npc = makeNpc(0, { x: 3, y: 3 }, target, { pathComputed: true, path: [] });
    const fp = makeFp(0, npc.posX, npc.posY);
    for (let i = 0; i < n; i++) stepColonyNpcs([npc], [fp], map, STEP_MS, false);
    return [npc.posX, npc.posY];
  };
  assert.deepEqual(runN(50), runN(50), "same step count → identical mill position");
});

test("stepColonyNpcs: an unreachable target does NOT teleport the NPC (mills at spawn)", () => {
  const map = splitRoom();
  // Spawn on the LEFT corridor (x=1); target on the RIGHT corridor (x=3) — walled off,
  // so findPath returns [] and the NPC drops straight into the mill branch.
  const spawn: Tile = { x: 1, y: 1 };
  const target: Tile = { x: 3, y: 1 };
  const npc = makeNpc(0, spawn, target);
  const fp = makeFp(0, npc.posX, npc.posY);
  const sidecar = [npc], fpNpcs = [fp];

  stepColonyNpcs(sidecar, fpNpcs, map, STEP_MS, false);
  assert.equal(npc.pathComputed, true);
  assert.equal(npc.path.length, 0, "target is unreachable → empty path");
  // The NPC mills where it stands, NOT at the target across the wall.
  assert.ok(Math.floor(npc.posX) < 2, "stays on the spawn side of the wall (no teleport)");
  assert.ok(
    dist(npc.posX, npc.posY, target.x + 0.5, target.y + 0.5) > 1.0,
    "did NOT jump to the target",
  );
  assert.ok(walkable(map, npc.posX, npc.posY), "still on a walkable tile");

  // ...and stays put over many frames (bounded drift around spawn, never crossing the wall).
  for (let i = 0; i < 100; i++) {
    stepColonyNpcs(sidecar, fpNpcs, map, STEP_MS, false);
    assert.ok(Math.floor(npc.posX) < 2, `step ${i}: remains on the spawn side of the wall`);
    assert.ok(walkable(map, npc.posX, npc.posY), `step ${i}: walkable`);
  }
});

// ─── (c) Mutates the SAME FPNPC objects; does not reset interacted/dialog ─────

test("stepColonyNpcs: mutates FPNPC objects in place, preserving identity + interacted/dialog", () => {
  const map = room();
  const sidecar = [
    makeNpc(0, { x: 1, y: 1 }, { x: 4, y: 4 }),
    makeNpc(1, { x: 4, y: 1 }, { x: 1, y: 4 }),
  ];
  const fpNpcs = [makeFp(0, sidecar[0].posX, sidecar[0].posY), makeFp(1, sidecar[1].posX, sidecar[1].posY)];

  // Simulate an open conversation / merchant state bound to fpNpcs[0].
  const ref0 = fpNpcs[0], ref1 = fpNpcs[1];
  ref0.interacted = true;
  const dialogRef = ref0.dialog;
  const x0Before = ref0.x, y0Before = ref0.y;

  for (let i = 0; i < 30; i++) stepColonyNpcs(sidecar, fpNpcs, map, STEP_MS, false);

  // Element references are unchanged — never rebuilt / replaced.
  assert.equal(fpNpcs[0], ref0, "fpNpcs[0] is the same object");
  assert.equal(fpNpcs[1], ref1, "fpNpcs[1] is the same object");
  // Per-NPC state was NOT reset by stepping.
  assert.equal(ref0.interacted, true, "interacted flag preserved");
  assert.equal(ref0.dialog, dialogRef, "dialog array reference preserved");
  // But x/y WERE mutated in place (movement happened).
  assert.ok(ref0.x !== x0Before || ref0.y !== y0Before, "position mutated in place");
  assert.equal(ref0.x, sidecar[0].posX, "fp.x synced to sidecar");
  assert.equal(ref0.y, sidecar[0].posY, "fp.y synced to sidecar");
});

// ─── (d) dialogActive → no movement ──────────────────────────────────────────

test("stepColonyNpcs: dialogActive=true freezes all movement", () => {
  const map = room();
  const npc = makeNpc(0, { x: 1, y: 1 }, { x: 4, y: 4 });
  const fp = makeFp(0, npc.posX, npc.posY);
  const px = npc.posX, py = npc.posY;

  for (let i = 0; i < 50; i++) stepColonyNpcs([npc], [fp], map, STEP_MS, true);

  assert.equal(npc.posX, px, "posX unchanged while dialog active");
  assert.equal(npc.posY, py, "posY unchanged while dialog active");
  assert.equal(npc.pathComputed, false, "no path computed while frozen");
  assert.equal(fp.x, px, "fp.x unchanged");
  assert.equal(fp.y, py, "fp.y unchanged");
});

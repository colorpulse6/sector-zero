import { test } from "node:test";
import assert from "node:assert/strict";
import { findPath } from "../../app/components/colony/exploration/npc/npcPathfind";
import type { BoardingMap, BoardingTileType } from "../../app/components/engine/types";

// 5x5: perimeter wall, open interior, one interior wall pillar at (2,2).
function tinyMap(): BoardingMap {
  const W = 5, H = 5;
  const tiles = Array.from({ length: H }, (_, y) =>
    Array.from({ length: W }, (_, x) =>
      (x === 0 || y === 0 || x === W - 1 || y === H - 1) ? "wall" : "floor"));
  tiles[2][2] = "wall";
  return { width: W, height: H, tileSize: 32, tiles: tiles as never };
}

// 5x5: perimeter wall + a solid wall column at x=2, splitting the interior into two
// disconnected floor corridors (left x=1, right x=3). `door` param optionally punches a
// door through the divider at (2,2), making the two sides connectable through it.
function splitMap(door = false): BoardingMap {
  const W = 5, H = 5;
  const tiles: BoardingTileType[][] = Array.from({ length: H }, (_, y) =>
    Array.from({ length: W }, (_, x): BoardingTileType =>
      (x === 0 || y === 0 || x === W - 1 || y === H - 1 || x === 2) ? "wall" : "floor"));
  if (door) tiles[2][2] = "door";
  return { width: W, height: H, tileSize: 32, tiles };
}

test("findPath returns an optimal walkable path start→goal", () => {
  const path = findPath(tinyMap(), { x: 1, y: 1 }, { x: 3, y: 3 });
  assert.ok(path.length > 0, "path found");
  assert.equal(path.length, 4);
  for (const p of path) assert.notEqual(tinyMap().tiles[p.y][p.x], "wall");
  assert.deepEqual(path[path.length - 1], { x: 3, y: 3 });
});

test("findPath is deterministic (identical inputs → identical path)", () => {
  const a = findPath(tinyMap(), { x: 1, y: 1 }, { x: 3, y: 3 });
  const b = findPath(tinyMap(), { x: 1, y: 1 }, { x: 3, y: 3 });
  assert.deepEqual(a, b);
});

test("findPath returns [] for an unreachable goal", () => {
  assert.deepEqual(findPath(tinyMap(), { x: 1, y: 1 }, { x: 0, y: 0 }), []);
});

test("findPath handles start === goal", () => {
  assert.deepEqual(findPath(tinyMap(), { x: 1, y: 1 }, { x: 1, y: 1 }), []);
});

test("findPath pins the exact N/E/S/W tie-break waypoint sequence", () => {
  // Locks the neighbor expansion order so a tie-break regression that still returns a
  // length-4 path (and thus passes the optimal-length test above) is caught here.
  assert.deepEqual(
    findPath(tinyMap(), { x: 1, y: 1 }, { x: 3, y: 3 }),
    [{ x: 2, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 2 }, { x: 3, y: 3 }],
  );
});

test("findPath returns [] when a walkable goal is fully enclosed (exhaustion branch)", () => {
  // Goal is `floor` (walkable) but a wall column at x=2 severs it from start, so A*
  // exhausts the open set and hits the terminal `return []` — the branch the wall-goal
  // test short-circuits before reaching (goal there fails the early !walkable check).
  const map = splitMap();
  assert.equal(map.tiles[1][3], "floor", "goal is a walkable floor tile");
  assert.deepEqual(findPath(map, { x: 1, y: 1 }, { x: 3, y: 1 }), []);
});

test("findPath routes through a door (doors are walkable)", () => {
  // Same split map, but a door at (2,2) is the ONLY crossing between the two corridors.
  const map = splitMap(true);
  assert.equal(map.tiles[2][2], "door", "the only crossing is a door tile");
  const path = findPath(map, { x: 1, y: 1 }, { x: 3, y: 1 });
  assert.ok(path.length > 0, "path found across the door");
  assert.ok(path.some((p) => p.x === 2 && p.y === 2), "path traverses the door tile (2,2)");
  assert.deepEqual(path[path.length - 1], { x: 3, y: 1 });
});

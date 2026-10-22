import { test } from "node:test";
import assert from "node:assert/strict";
import { fitContain, sliceColumns } from "../../app/components/engine/fighterSprites";
import { planMirrorTiles, plateTilePeriod } from "../../app/components/engine/background";
import { drawEnemies, createEnemy } from "../../app/components/engine/enemies";
import { EnemyType } from "../../app/components/engine/types";

function occupancy(width: number, runs: Array<[number, number]>): Uint8Array {
  const cols = new Uint8Array(width);
  for (const [a, b] of runs) for (let x = a; x <= b; x++) cols[x] = 1;
  return cols;
}

test("sliceColumns keeps alpha runs when they match the frame count", () => {
  // Shape of enemy-bullet.png: four items that straddle the equal-column grid.
  const cols = occupancy(1536, [[271, 448], [498, 713], [766, 1004], [1062, 1275]]);
  assert.deepEqual(sliceColumns(cols, 1536, 4), [[271, 448], [498, 713], [766, 1004], [1062, 1275]]);
});

test("sliceColumns merges the closest runs when a frame has internal gaps", () => {
  // Shape of player-bullets.png: the large crystal has a 5px alpha gap inside it.
  const cols = occupancy(1536, [[350, 407], [500, 560], [566, 917], [963, 1423]]);
  assert.deepEqual(sliceColumns(cols, 1536, 4), [[350, 407], [500, 560], [566, 917], [963, 1423]]);
  const cols5 = occupancy(1536, [[350, 407], [500, 560], [566, 700], [705, 917], [963, 1423]]);
  assert.deepEqual(sliceColumns(cols5, 1536, 4), [[350, 407], [500, 560], [566, 917], [963, 1423]]);
});

test("sliceColumns falls back to equal columns when runs are fewer than frames", () => {
  const cols = occupancy(1536, [[39, 224], [271, 1508]]);
  const cells = sliceColumns(cols, 1536, 7);
  assert.equal(cells.length, 7);
  assert.deepEqual(cells[0], [0, 218]);
  assert.deepEqual(cells[6], [1316, 1535]);
});

test("fitContain preserves aspect inside the box", () => {
  assert.deepEqual(fitContain(200, 100, 50, 50), { w: 50, h: 25 });
  assert.deepEqual(fitContain(100, 200, 50, 50), { w: 25, h: 50 });
  assert.deepEqual(fitContain(0, 0, 40, 40), { w: 40, h: 40 });
});

test("mirror tiles stay contiguous, alternate flips and cover the view", () => {
  for (const scrollY of [0, 1, 359.5, 720, 1234.25, 7199]) {
    const tiles = planMirrorTiles(scrollY, 720, 854);
    assert.ok(tiles[0].screenY <= 0, `first tile starts above the view at ${scrollY}`);
    assert.ok(tiles[tiles.length - 1].screenY + 720 >= 854, `last tile reaches the bottom at ${scrollY}`);
    for (let i = 1; i < tiles.length; i++) {
      assert.equal(tiles[i].screenY, tiles[i - 1].screenY + 720, "tiles abut");
      assert.notEqual(tiles[i].flipped, tiles[i - 1].flipped, "every seam is a mirror seam");
    }
  }
});

test("the three plate periods never coincide within a long scroll", () => {
  const far = plateTilePeriod(1024, 1536, 1);
  const mid = plateTilePeriod(1024, 1536, 1.2);
  const near = plateTilePeriod(1024, 1536, 1.45);
  assert.equal(far, 720);
  assert.ok(mid !== far && near !== far && near !== mid);
  // Distinct periods: no shared alignment for at least 60 seconds of travel.
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const lcm = (a: number, b: number) => (a * b) / gcd(a, b);
  assert.ok(lcm(lcm(far, mid), near) / 0.3 > 60 * 60);
});

type Call = { op: string; args: unknown[] };
function recordingContext(): { ctx: CanvasRenderingContext2D; calls: Call[]; state: Record<string, unknown> } {
  const calls: Call[] = [];
  const state: Record<string, unknown> = { globalAlpha: 1, globalCompositeOperation: "source-over" };
  const stack: Record<string, unknown>[] = [];
  const ctx = new Proxy({}, {
    get(_, prop: string) {
      if (prop in state) return state[prop];
      if (prop === "save") return () => { stack.push({ ...state }); calls.push({ op: prop, args: [] }); };
      if (prop === "restore") return () => { Object.assign(state, stack.pop() ?? {}); calls.push({ op: prop, args: [] }); };
      return (...args: unknown[]) => { calls.push({ op: prop, args }); return undefined; };
    },
    set(_, prop: string, value) { state[prop] = value; calls.push({ op: `set:${prop}`, args: [value] }); return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls, state };
}

test("drawEnemies never paints an unclipped tint rectangle (multiply overlay regression)", () => {
  const { ctx, calls, state } = recordingContext();
  const enemies = [createEnemy(EnemyType.SCOUT, 100, 100), createEnemy(EnemyType.CLOAKER, 200, 100)];
  drawEnemies(ctx, enemies);
  const composites = calls.filter((c) => c.op === "set:globalCompositeOperation").map((c) => c.args[0]);
  assert.ok(!composites.includes("multiply"), "no multiply overlay over the sprite box");
  // Without decoded art the fallback body is the only fill inside the box; the
  // old code painted a second, padded rectangle over it.
  const fills = calls.filter((c) => c.op === "fillRect");
  assert.equal(fills.filter((c) => c.args[0] === 96 || c.args[0] === 196).length, 0, "no 4px-padded fills");
  assert.equal(state.globalAlpha, 1, "alpha restored after a cloaked enemy");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { scheduleTargetTile } from "../../app/components/colony/exploration/npc/npcSchedule";
import { bucketForHour, type DayBucket } from "../../app/components/colony/exploration/dayNightTint";
import type { ColonyNpc, Tile } from "../../app/components/colony/exploration/npc/types";

const HOME: Tile = { x: 1, y: 1 };
const WORK: Tile = { x: 2, y: 2 };
const POST: Tile = { x: 3, y: 3 };

function colonist(id: number, home: Tile = HOME, work: Tile = WORK): ColonyNpc {
  return {
    id, kind: "colonist", name: "C", sprite: "",
    posX: 0, posY: 0,
    homeTile: home, workTile: work, postTile: null,
    targetTile: { x: 0, y: 0 }, happinessTier: "content",
    path: [], pathComputed: false, millSeed: 0,
  };
}

function named(id: number, home: Tile = HOME, post: Tile = POST): ColonyNpc {
  return { ...colonist(id, home, WORK), kind: "governor", postTile: post };
}

// ─── bucketForHour: every hour maps to the correct bucket ────────────────────

function expectedBucket(hour: number): DayBucket {
  if (hour < 5 || hour >= 22) return "night";
  if (hour < 7) return "dawn";
  if (hour < 17) return "day";
  if (hour < 20) return "dusk";
  return "evening";
}

test("bucketForHour: all 24 hours map to the correct bucket", () => {
  for (let h = 0; h < 24; h++) {
    assert.equal(bucketForHour(h), expectedBucket(h), `hour ${h}`);
  }
});

test("bucketForHour: exact boundary hours", () => {
  assert.equal(bucketForHour(4), "night");
  assert.equal(bucketForHour(5), "dawn");
  assert.equal(bucketForHour(7), "day");
  assert.equal(bucketForHour(17), "dusk");
  assert.equal(bucketForHour(20), "evening");
  assert.equal(bucketForHour(22), "night");
});

// ─── Colonist targets per entry bucket ───────────────────────────────────────

test("scheduleTargetTile: colonist night → homeTile", () => {
  assert.deepEqual(scheduleTargetTile(colonist(0), 0, []), HOME);
  assert.deepEqual(scheduleTargetTile(colonist(0), 23, []), HOME);
});

test("scheduleTargetTile: colonist dawn/day → workTile", () => {
  assert.deepEqual(scheduleTargetTile(colonist(0), 6, []), WORK);
  assert.deepEqual(scheduleTargetTile(colonist(0), 12, []), WORK);
});

test("scheduleTargetTile: colonist evening → homeTile", () => {
  assert.deepEqual(scheduleTargetTile(colonist(0), 21, []), HOME);
});

test("scheduleTargetTile: colonist dusk → a plaza tile (id-selected)", () => {
  const plaza: Tile[] = [{ x: 6, y: 8 }, { x: 7, y: 8 }, { x: 8, y: 8 }];
  assert.deepEqual(scheduleTargetTile(colonist(0), 18, plaza), plaza[0]);
  assert.deepEqual(scheduleTargetTile(colonist(1), 18, plaza), plaza[1]);
  assert.deepEqual(scheduleTargetTile(colonist(2), 18, plaza), plaza[2]);
  assert.deepEqual(scheduleTargetTile(colonist(3), 18, plaza), plaza[0]); // wraps (3 % 3)
});

test("scheduleTargetTile: colonist dusk with empty plaza falls back to home", () => {
  assert.deepEqual(scheduleTargetTile(colonist(0), 18, []), HOME);
});

// ─── Named-NPC targets per entry bucket ──────────────────────────────────────

test("scheduleTargetTile: named NPC night/evening → homeTile", () => {
  assert.deepEqual(scheduleTargetTile(named(0), 0, []), HOME);
  assert.deepEqual(scheduleTargetTile(named(0), 21, []), HOME);
});

test("scheduleTargetTile: named NPC dawn/day/dusk → postTile", () => {
  assert.deepEqual(scheduleTargetTile(named(0), 6, []), POST);
  assert.deepEqual(scheduleTargetTile(named(0), 12, []), POST);
  assert.deepEqual(scheduleTargetTile(named(0), 18, []), POST);
});

test("scheduleTargetTile: a named NPC never routes to a plaza tile (postTile wins at dusk)", () => {
  const plaza: Tile[] = [{ x: 6, y: 8 }, { x: 7, y: 8 }];
  assert.deepEqual(scheduleTargetTile(named(1), 18, plaza), POST);
});

// ─── Plaza-tile selection: deterministic + spread ────────────────────────────

test("scheduleTargetTile: dusk plaza selection is deterministic for the same id", () => {
  const plaza: Tile[] = Array.from({ length: 8 }, (_, i) => ({ x: 6 + i, y: 8 }));
  const a = scheduleTargetTile(colonist(5), 18, plaza);
  const b = scheduleTargetTile(colonist(5), 18, plaza);
  assert.deepEqual(a, b);
});

test("scheduleTargetTile: dusk plaza selection spreads distinct ids across distinct tiles", () => {
  const plaza: Tile[] = Array.from({ length: 8 }, (_, i) => ({ x: 6 + i, y: 8 }));
  const picked = new Set<string>();
  for (let id = 0; id < plaza.length; id++) {
    const t = scheduleTargetTile(colonist(id), 18, plaza);
    picked.add(`${t.x},${t.y}`);
  }
  assert.equal(picked.size, plaza.length, "ids 0..len-1 should each land on a distinct plaza tile");
});

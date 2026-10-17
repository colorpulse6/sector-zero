import { test } from "node:test";
import assert from "node:assert/strict";
import { pinToEdgeRing, spreadAlongRing } from "../../app/components/galaxy/system/SystemScene";

// 1000 x 600 render pixels at scaling 1: the ring is inset 84 x 78, so rx = 416 and ry = 222.
const W = 1000, H = 600, RX = 416, RY = 222;
const onRing = (x: number, y: number) => Math.hypot((x - W / 2) / RX, (y - H / 2) / RY);

test("points inside the ring stay put unless forced onto it in their own direction", () => {
  const inside = pinToEdgeRing(560, 260, W, H, true, 1);
  assert.deepEqual([inside.x, inside.y, inside.pinned], [560, 260, false]);
  const forced = pinToEdgeRing(560, 260, W, H, true, 1, true);
  assert.equal(forced.pinned, true);
  assert.ok(Math.abs(onRing(forced.x, forced.y) - 1) < 1e-9);
  assert.ok(forced.x > W / 2 && forced.y < H / 2, "keeps the up-right direction");
});

test("points outside the ring pin to it, mirrored when behind the camera", () => {
  const front = pinToEdgeRing(1400, 300, W, H, true, 1);
  assert.equal(front.pinned, true);
  assert.ok(Math.abs(front.x - (W / 2 + RX)) < 1e-9 && Math.abs(front.y - H / 2) < 1e-9);
  const behind = pinToEdgeRing(1400, 300, W, H, false, 1);
  assert.ok(Math.abs(behind.x - (W / 2 - RX)) < 1e-9, "a point behind the camera flips to the far side");
});

test("spreading keeps every pinned pair at least the minimum angle apart, even six on one bearing", () => {
  for (const start of [[0.1, 0.12, 0.15, 3], [0, 0.01, 0.02, 0.03, 0.04, 0.05]]) {
    const entries = start.map(angle => ({ angle }));
    spreadAlongRing(entries, RX, RY, 120);
    const minAngle = Math.min((Math.PI * 2) / entries.length, 120 / ((RX + RY) / 2));
    const sorted = entries.map(entry => entry.angle).sort((a, b) => a - b);
    for (let index = 0; index < sorted.length; index += 1) {
      const next = index === sorted.length - 1 ? sorted[0] + Math.PI * 2 : sorted[index + 1];
      assert.ok(next - sorted[index] >= minAngle - 1e-5, `${start.length} entries, gap ${index}`);
    }
  }
});

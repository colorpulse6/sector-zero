import { test } from "node:test";
import assert from "node:assert/strict";
import { generateColonyNpcs } from "../../app/components/colony/exploration/npc/colonyNpcs";
import { generateExteriorState } from "../../app/components/colony/exploration/colonyLayout";
import { stepColonyNpcs } from "../../app/components/colony/exploration/npc/npcStep";
import { makeTestColony } from "./fixtures";
import type { GameClock } from "../../app/components/colony/shared/colonyTypes";

const clock: GameClock = { day: 1, hour: 12, minute: 0, realtimeMsPerGameMinute: 1000, season: "standard" };
function fixture() {
  const colony = makeTestColony();
  const map = generateExteriorState(colony, clock).map;
  const { fpNpcs, sidecar } = generateColonyNpcs(colony, clock, map);
  const index = sidecar.findIndex(n => n.kind === "quartermaster");
  return { map, fpNpcs, sidecar, index, npc: sidecar[index], fp: fpNpcs[index] };
}

test("quartermaster opts into directional animation and works without drifting", () => {
  const f = fixture();
  assert.ok(f.fp.atlasAnimation, "quartermaster must opt into the new atlas");
  const initial = { x: f.fp.x, y: f.fp.y };
  for (let i = 0; i < 60; i++) stepColonyNpcs(f.sidecar, f.fpNpcs, f.map, 16.67, false);
  assert.equal(f.fp.x, initial.x);
  assert.equal(f.fp.y, initial.y);
  assert.equal(f.fp.atlasAnimation.action, "work");
  assert.equal(f.fp.atlasAnimation.walkDistance, 0);
  assert.ok(f.fp.atlasAnimation.clockMs > 900);
});

test("quartermaster visibly walks, rests and returns on walkable cells; gait tracks travel", () => {
  const f = fixture();
  assert.ok(f.fp.atlasAnimation);
  const origin = { x: f.fp.x, y: f.fp.y };
  const actions = new Set<string>();
  let distance = 0, furthest = 0, returned = false;
  for (let i = 0; i < 1200; i++) {
    const { x, y } = f.fp;
    stepColonyNpcs(f.sidecar, f.fpNpcs, f.map, 16.67, false);
    distance += Math.hypot(f.fp.x - x, f.fp.y - y);
    const offset = Math.hypot(f.fp.x - origin.x, f.fp.y - origin.y);
    furthest = Math.max(furthest, offset);
    if (furthest > 0.9 && offset < 0.01) returned = true;
    assert.equal(f.map.tiles[Math.floor(f.fp.y)][Math.floor(f.fp.x)], "floor");
    actions.add(f.fp.atlasAnimation.action);
  }
  assert.deepEqual([...actions].sort(), ["idle", "walk", "work"]);
  assert.ok(furthest > 0.9 && furthest < 1.01);
  assert.ok(returned);
  assert.ok(Math.abs(distance - f.fp.atlasAnimation.walkDistance) < 1e-7);
});

test("dialogue freezes position, heading and every motion clock", () => {
  const f = fixture();
  for (let i = 0; i < 300; i++) stepColonyNpcs(f.sidecar, f.fpNpcs, f.map, 16.67, false);
  const before = JSON.stringify({ npc: f.npc, fp: f.fp });
  stepColonyNpcs(f.sidecar, f.fpNpcs, f.map, 1000, true);
  assert.equal(JSON.stringify({ npc: f.npc, fp: f.fp }), before);
});

test("enclosed station has no idle slide or teleport and remains usable", () => {
  const f = fixture();
  assert.ok(f.fp.atlasAnimation);
  const x = Math.floor(f.fp.x), y = Math.floor(f.fp.y);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) f.map.tiles[y + dy][x + dx] = "wall";
  const before = { x: f.fp.x, y: f.fp.y };
  for (let i = 0; i < 700; i++) stepColonyNpcs(f.sidecar, f.fpNpcs, f.map, 16.67, false);
  assert.equal(f.fp.x, before.x);
  assert.equal(f.fp.y, before.y);
  assert.equal(f.fp.atlasAnimation.walkDistance, 0);
  assert.equal(f.fp.canBuy, true);
});

test("equivalent simulation time preserves station work across frame rates", () => {
  const a = fixture(), b = fixture();
  assert.ok(a.fp.atlasAnimation && b.fp.atlasAnimation);
  for (let i = 0; i < 60; i++) stepColonyNpcs(a.sidecar, a.fpNpcs, a.map, 1000 / 60, false);
  for (let i = 0; i < 30; i++) stepColonyNpcs(b.sidecar, b.fpNpcs, b.map, 1000 / 30, false);
  assert.ok(Math.abs(a.fp.atlasAnimation.clockMs - b.fp.atlasAnimation.clockMs) < 1e-7);
  assert.equal(a.fp.x, b.fp.x);
  assert.equal(a.fp.y, b.fp.y);
});

test("multiple complete work/walk/turn cycles agree at 30, 60 and 120 Hz", () => {
  const outcomes = [30, 60, 120].map(hz => {
    const f = fixture();
    for (let i = 0; i < hz * 120; i++) stepColonyNpcs(f.sidecar, f.fpNpcs, f.map, 1000 / hz, false);
    return { x: f.fp.x, y: f.fp.y, animation: f.fp.atlasAnimation, motion: f.npc.quartermasterMotion };
  });
  assert.deepEqual(outcomes[0], outcomes[1]);
  assert.deepEqual(outcomes[1], outcomes[2]);
});

test("turning takes the short path across the angle wrap", () => {
  const f = fixture();
  const animation = f.fp.atlasAnimation!;
  animation.facingAngle = Math.PI * 2 - 0.04;
  f.npc.pathComputed = true;
  f.npc.path = [{ x: Math.floor(f.fp.x) + 1, y: Math.floor(f.fp.y) }];
  const heading = animation.facingAngle;
  stepColonyNpcs(f.sidecar, f.fpNpcs, f.map, 1000 / 120, false);
  assert.ok(animation.facingAngle > heading);
  assert.ok(animation.facingAngle - heading <= 0.004 * 1000 / 120 + 1e-8);
});

test("an unreachable schedule target does not teleport the quartermaster", () => {
  const f = fixture();
  const before = { x: f.fp.x, y: f.fp.y };
  f.npc.targetTile = { x: 0, y: 0 };
  f.npc.pathComputed = false;
  for (let i = 0; i < 600; i++) stepColonyNpcs(f.sidecar, f.fpNpcs, f.map, 1000 / 60, false);
  assert.equal(f.fp.x, before.x);
  assert.equal(f.fp.y, before.y);
  assert.equal(f.fp.atlasAnimation!.walkDistance, 0);
  assert.equal(f.fp.atlasAnimation!.action, "idle");
});

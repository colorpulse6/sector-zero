import { test } from "node:test";
import assert from "node:assert/strict";
import { homeSystem, neighboursOf } from "../../app/components/galaxy/system/starSystems";
import { clampToEdgeRing, planSystemLayout } from "../../app/components/galaxy/system/systemLayout";

test("flat system plan places every planet and neighbour inside the field", () => {
  const home = homeSystem();
  const plan = planSystemLayout(home, neighboursOf(home.id), 0);
  assert.equal(plan.length, home.planets.length + neighboursOf(home.id).length);
  for (const landmark of plan) {
    assert.ok(landmark.x >= 4 && landmark.x <= 96, `${landmark.id} x ${landmark.x}`);
    assert.ok(landmark.y >= 4 && landmark.y <= 96, `${landmark.id} y ${landmark.y}`);
  }
  assert.deepEqual(plan, planSystemLayout(home, neighboursOf(home.id), 0));
  assert.notDeepEqual(plan, planSystemLayout(home, neighboursOf(home.id), 37));
});

test("edge ring clamps by bearing and stays inside the frame", () => {
  for (let step = 0; step < 16; step++) {
    const point = clampToEdgeRing((step / 16) * Math.PI * 2);
    assert.ok(point.x >= 6 && point.x <= 94);
    assert.ok(point.y >= 6 && point.y <= 94);
  }
  assert.deepEqual(clampToEdgeRing(0), { x: 94, y: 50 });
});

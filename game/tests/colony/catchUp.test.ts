import { test } from "node:test";
import assert from "node:assert/strict";
import { catchUpColony } from "../../app/components/colony/shared/catchUp";
import { makeTestColony } from "./fixtures";

test("catchUpColony with zero missed cycles returns identity", () => {
  const c = makeTestColony({ lastCycleProcessed: 5 });
  const next = catchUpColony(c, 5);
  assert.equal(next.lastCycleProcessed, 5);
});

test("catchUpColony with 3 missed cycles runs 3 times", () => {
  const c = makeTestColony({ lastCycleProcessed: 0 });
  const next = catchUpColony(c, 3);
  assert.equal(next.lastCycleProcessed, 3);
});

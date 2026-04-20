import { test } from "node:test";
import assert from "node:assert/strict";
import * as ColonyApi from "../../app/components/colony";

test("public API exports core functions", () => {
  assert.equal(typeof ColonyApi.colonyReducer, "function");
  assert.equal(typeof ColonyApi.advanceWorldCycle, "function");
  assert.equal(typeof ColonyApi.processCycle, "function");
  assert.equal(typeof ColonyApi.rankFromStanding, "function");
  assert.equal(typeof ColonyApi.derivePowerGrid, "function");
  assert.equal(typeof ColonyApi.Events, "object");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { processCycle } from "../../app/components/colony/shared/cycleProcessor";
import { makeTestColony } from "./fixtures";

test("processCycle step 4.5: constructing building at 2 cycles decrements to 1", () => {
  const before = makeTestColony({
    buildings: [
      { id: "b1", type: "solar_array", tier: 1, status: "constructing", buildProgressCycles: 2, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const after = processCycle(before, 1);
  const b = after.buildings.find(x => x.id === "b1")!;
  assert.equal(b.status, "constructing");
  assert.equal(b.buildProgressCycles, 1);
});

test("processCycle step 4.5: constructing building at 1 cycle completes to operational", () => {
  const before = makeTestColony({
    buildings: [
      { id: "b1", type: "solar_array", tier: 1, status: "constructing", buildProgressCycles: 1, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const after = processCycle(before, 1);
  const b = after.buildings.find(x => x.id === "b1")!;
  assert.equal(b.status, "operational");
  assert.equal(b.buildProgressCycles, 0);
});

test("processCycle step 4.5: operational buildings are unchanged", () => {
  const before = makeTestColony({
    buildings: [
      { id: "b1", type: "farm", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
      // Paired solar array to keep power grid in surplus so the farm isn't shed by step 3 brownout.
      { id: "s1", type: "solar_array", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const after = processCycle(before, 1);
  const b = after.buildings.find(x => x.id === "b1")!;
  assert.equal(b.status, "operational");
  assert.equal(b.buildProgressCycles, 0);
});

test("processCycle step 4.5: buildProgressCycles never goes negative", () => {
  const before = makeTestColony({
    buildings: [
      { id: "b1", type: "solar_array", tier: 1, status: "constructing", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const after = processCycle(before, 1);
  const b = after.buildings.find(x => x.id === "b1")!;
  assert.equal(b.status, "operational");
  assert.equal(b.buildProgressCycles, 0);
});

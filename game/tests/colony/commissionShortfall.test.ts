import { test } from "node:test";
import assert from "node:assert/strict";
import { shortfallMessage } from "../../app/components/colony/meta/ColonyCommissionMenu";
import type { ColonyResources } from "../../app/components/colony/shared/colonyTypes";

test("shortfallMessage: affordable returns empty string", () => {
  const have: ColonyResources = { food: 100, water: 100, metal: 500, credits: 0 };
  const msg = shortfallMessage(have, { metal: 80 });
  assert.equal(msg, "");
});

test("shortfallMessage: single resource shortfall reports correct amount", () => {
  const have: ColonyResources = { food: 0, water: 0, metal: 50, credits: 0 };
  const msg = shortfallMessage(have, { metal: 80 });
  assert.equal(msg, "Need 30 more metal");
});

test("shortfallMessage: multi-resource shortfall lists every missing one", () => {
  const have: ColonyResources = { food: 0, water: 0, metal: 50, credits: 0 };
  const msg = shortfallMessage(have, { metal: 80, food: 20 });
  // Order is deterministic (metal before food in iteration) — adjust to match impl
  assert.ok(msg.includes("30 more metal"));
  assert.ok(msg.includes("20 more food"));
});

test("shortfallMessage: zero-cost entries ignored (no undefined spam)", () => {
  const have: ColonyResources = { food: 0, water: 0, metal: 100, credits: 0 };
  const msg = shortfallMessage(have, { metal: 80, food: 0 });
  // food cost is 0 — shouldn't appear in message
  assert.ok(!msg.includes("food"));
  assert.equal(msg, "");  // metal 100 >= 80, food 0 >= 0 → affordable
});

test("shortfallMessage: credits shortfall reports correctly", () => {
  const have: ColonyResources = { food: 0, water: 0, metal: 0, credits: 50 };
  const msg = shortfallMessage(have, { credits: 200 });
  assert.equal(msg, "Need 150 more credits");
});

test("shortfallMessage: water + metal + credits multi-shortfall", () => {
  const have: ColonyResources = { food: 0, water: 5, metal: 20, credits: 10 };
  const msg = shortfallMessage(have, { water: 30, metal: 100, credits: 50 });
  assert.ok(msg.includes("25 more water"));
  assert.ok(msg.includes("80 more metal"));
  assert.ok(msg.includes("40 more credits"));
});

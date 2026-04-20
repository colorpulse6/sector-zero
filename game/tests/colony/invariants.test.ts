import { test } from "node:test";
import assert from "node:assert/strict";
import { assertColonyInvariant, assertSaveInvariant } from "../../app/components/colony/shared/colonyAssert";
import { makeTestColony } from "./fixtures";

test("assertColonyInvariant throws in dev when condition false", () => {
  const origEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    const colony = makeTestColony({ population: { total: 100, capacity: 10, namedCount: 0, growthRate: 0, recentDeaths: [] } });
    assert.throws(
      () => assertColonyInvariant(colony, c => c.population.total <= c.population.capacity + 50, "pop sane"),
      /pop sane/,
    );
  } finally {
    process.env.NODE_ENV = origEnv;
  }
});

test("assertColonyInvariant no-op in production when condition false", () => {
  const origEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const colony = makeTestColony({ population: { total: 100, capacity: 10, namedCount: 0, growthRate: 0, recentDeaths: [] } });
    assert.doesNotThrow(() =>
      assertColonyInvariant(colony, c => c.population.total <= c.population.capacity + 50, "pop sane"),
    );
  } finally {
    process.env.NODE_ENV = origEnv;
  }
});

test("assertColonyInvariant passes silently when condition true", () => {
  const colony = makeTestColony();
  assert.doesNotThrow(() => assertColonyInvariant(colony, c => c.population.total >= 0, "non-negative"));
});

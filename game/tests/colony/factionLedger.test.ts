import { test } from "node:test";
import assert from "node:assert/strict";
import { rankFromStanding } from "../../app/components/colony/shared/factionLedger";

test("rankFromStanding returns hostile for -100..-80", () => {
  assert.equal(rankFromStanding(-100), "hostile");
  assert.equal(rankFromStanding(-80), "hostile");
  assert.equal(rankFromStanding(-81), "hostile");
});

test("rankFromStanding returns hated for -79..-40", () => {
  assert.equal(rankFromStanding(-79), "hated");
  assert.equal(rankFromStanding(-40), "hated");
});

test("rankFromStanding returns neutral for -39..39", () => {
  assert.equal(rankFromStanding(-39), "neutral");
  assert.equal(rankFromStanding(0), "neutral");
  assert.equal(rankFromStanding(39), "neutral");
});

test("rankFromStanding returns liked for 40..79", () => {
  assert.equal(rankFromStanding(40), "liked");
  assert.equal(rankFromStanding(79), "liked");
});

test("rankFromStanding returns allied for 80..100", () => {
  assert.equal(rankFromStanding(80), "allied");
  assert.equal(rankFromStanding(100), "allied");
});

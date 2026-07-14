import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialRegionSelection,
  moveRegionSelection,
  reconcileRegionSelection,
} from "../../app/components/colony/meta/regionMapSelection";

const visible = ["origin", "relay", "wreck"];

test("region selection initializes to the visible origin or first visible node", () => {
  assert.equal(initialRegionSelection(visible, "origin"), "origin");
  assert.equal(initialRegionSelection(visible, "missing"), "origin");
  assert.equal(initialRegionSelection([], "origin"), null);
});

test("region selection reconciliation retains a visible selection and falls back predictably", () => {
  assert.equal(reconcileRegionSelection("relay", visible, "origin"), "relay");
  assert.equal(reconcileRegionSelection("gone", visible, "origin"), "origin");
  assert.equal(reconcileRegionSelection("gone", ["relay", "wreck"], "origin"), "relay");
  assert.equal(reconcileRegionSelection("gone", [], "origin"), null);
});

test("region selection movement follows visible order and wraps at either edge", () => {
  assert.equal(moveRegionSelection("origin", visible, "next"), "relay");
  assert.equal(moveRegionSelection("relay", visible, "previous"), "origin");
  assert.equal(moveRegionSelection("wreck", visible, "next"), "origin");
  assert.equal(moveRegionSelection("origin", visible, "previous"), "wreck");
  assert.equal(moveRegionSelection("gone", visible, "next"), "origin");
  assert.equal(moveRegionSelection("origin", [], "next"), null);
});

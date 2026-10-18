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

test("spatial region selection jumps to the nearest node in the pressed direction", async () => {
  const { moveRegionSelectionSpatial } = await import("../../app/components/colony/meta/regionMapSelection");
  const points = [
    { id: "camp", x: 50, y: 82 },
    { id: "relay", x: 28, y: 59 },
    { id: "wreck", x: 73, y: 61 },
    { id: "canyon", x: 18, y: 29 },
    { id: "basin", x: 51, y: 43 },
    { id: "shelf", x: 84, y: 31 },
  ];
  assert.equal(moveRegionSelectionSpatial("camp", points, "up"), "basin");
  assert.equal(moveRegionSelectionSpatial("camp", points, "left"), "relay");
  assert.equal(moveRegionSelectionSpatial("camp", points, "right"), "wreck");
  assert.equal(moveRegionSelectionSpatial("camp", points, "down"), null);
  assert.equal(moveRegionSelectionSpatial("relay", points, "up"), "canyon");
  assert.equal(moveRegionSelectionSpatial("wreck", points, "up"), "shelf");
  assert.equal(moveRegionSelectionSpatial("basin", points, "down"), "camp");
  assert.equal(moveRegionSelectionSpatial("gone", points, "left"), "camp");
  assert.equal(moveRegionSelectionSpatial("camp", [], "left"), null);
});

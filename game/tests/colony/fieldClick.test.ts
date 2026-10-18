import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FIELD_SNAP_RADIUS_PX,
  resolveFieldClick,
  type FieldClickCandidate,
} from "../../app/components/galaxy/fieldClick";

function star(key: string, x: number, y: number, label = true, selected = false): FieldClickCandidate {
  // Mirrors the DOM: a name line 20-36px under the centre and a subtitle line under it.
  return {
    key,
    center: { x, y },
    labelBoxes: label
      ? [
          { left: x - 30, top: y + 20, right: x + 30, bottom: y + 36 },
          { left: x - 25, top: y + 39, right: x + 25, bottom: y + 49 },
        ]
      : [],
    selected,
  };
}

test("a click on a star's name selects that star", () => {
  const field = [star("contact:vanguard", 100, 200), star("contact:ashfall", 180, 140)];
  assert.equal(resolveFieldClick(180, 168, field), "contact:ashfall");
  assert.equal(resolveFieldClick(205, 183, field), "contact:ashfall");
});

test("a near miss on the star glow snaps to the star", () => {
  const field = [star("contact:ashfall", 180, 140, false)];
  assert.equal(resolveFieldClick(180 + 28, 140, field), "contact:ashfall");
  assert.equal(resolveFieldClick(180, 140 - FIELD_SNAP_RADIUS_PX, field), "contact:ashfall");
});

test("a click in open space selects nothing, so it plots a coordinate", () => {
  const field = [star("contact:ashfall", 180, 140)];
  assert.equal(resolveFieldClick(180 + FIELD_SNAP_RADIUS_PX + 1, 140, field), null);
  assert.equal(resolveFieldClick(400, 400, field), null);
  assert.equal(resolveFieldClick(400, 400, []), null);
});

test("the nearest star wins when two are in reach", () => {
  const field = [star("a", 100, 100, false), star("b", 140, 100, false)];
  assert.equal(resolveFieldClick(125, 100, field), "b");
  assert.equal(resolveFieldClick(112, 100, field), "a");
});

test("a name wins over a nearer star centre, and the selected name wins a tie", () => {
  const field = [star("a", 100, 100), star("b", 100, 140, false)];
  // (100, 128) is 12px from b's centre but on a's name.
  assert.equal(resolveFieldClick(100, 128, field), "a");
  const overlapping = [star("a", 100, 100), star("b", 110, 100, true, true)];
  assert.equal(resolveFieldClick(105, 128, overlapping), "b");
});

test("non-finite candidates are ignored", () => {
  const field = [star("lost", Number.NaN, Number.NaN), star("ashfall", 180, 140, false)];
  assert.equal(resolveFieldClick(185, 140, field), "ashfall");
});

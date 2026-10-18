import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTOR_CATALOG, HOSTILE_PRESENTATION, HOSTILE_TYPE_SCALE, enemyBillboardPresentation } from "../../app/components/engine/actorAssets";

// Measured on the shipped hostile atlas (docs/assets/fps-enemy/README.md):
// standing cells end at row 237 of 256, the death slump at 243.
const STANDING_FOOT_ROW = 237, LOWEST_FOOT_ROW = 243, CELL = 256, SUBJECT_ROWS = 211;
const CLASSIC_BILLBOARD = 0.6;

test("hostile framing stands the measured foot line on the floor and reads as a brute", () => {
  assert.equal(ACTOR_CATALOG.hostile.presentation, HOSTILE_PRESENTATION, "the catalog carries the shared framing");
  assert.equal(HOSTILE_PRESENTATION.groundLine, STANDING_FOOT_ROW / CELL);
  assert.ok(HOSTILE_PRESENTATION.groundLine <= LOWEST_FOOT_ROW / CELL, "no pose may hang below the cell");
  const creatureWallHeights = HOSTILE_PRESENTATION.scale * CLASSIC_BILLBOARD * SUBJECT_ROWS / CELL;
  assert.ok(creatureWallHeights > 0.7 && creatureWallHeights < 0.9, `creature height ${creatureWallHeights.toFixed(2)} wall heights`);
});

test("every hostile type resolves a framing; the charger is leaner and the sentry bulkier than the grunt", () => {
  const grunt = enemyBillboardPresentation({ type: "grunt" });
  const charger = enemyBillboardPresentation({ type: "charger" });
  const sentry = enemyBillboardPresentation({ type: "sentry" });
  assert.equal(grunt.scale, HOSTILE_PRESENTATION.scale);
  assert.ok(charger.scale < grunt.scale && grunt.scale < sentry.scale);
  for (const look of [grunt, charger, sentry]) {
    assert.equal(look.groundLine, HOSTILE_PRESENTATION.groundLine, "one atlas, one foot line");
    assert.ok(look.scale * CLASSIC_BILLBOARD <= 1.15, "a cell never exceeds 1.15 wall heights");
  }
  assert.deepEqual(Object.keys(HOSTILE_TYPE_SCALE).sort(), ["charger", "grunt", "sentry"]);
  const unknown = enemyBillboardPresentation({ type: "unknown" as "grunt" });
  assert.equal(unknown.scale, grunt.scale, "unknown types fall back to the grunt framing");
});

test("humanoid colonists carry no hostile framing", () => {
  for (const [name, set] of Object.entries(ACTOR_CATALOG)) if (name !== "hostile") assert.equal(set.presentation, undefined, name);
});

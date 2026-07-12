import { test } from "node:test";
import assert from "node:assert/strict";
import { migrateSave } from "../../app/components/engine/save";
import { defaultFactionStandings } from "../../app/components/colony/shared/factionLedger";

test("migrateSave on empty object produces default colony fields", () => {
  const migrated = migrateSave({});
  assert.deepEqual(migrated.colonies, []);
  assert.deepEqual(migrated.planets, []);
  assert.deepEqual(migrated.earthShipments, []);
  assert.deepEqual(migrated.factionStandings, defaultFactionStandings());
  assert.deepEqual(migrated.bounties, []);
  assert.equal(migrated.missionsSinceStart, 0);
  assert.equal(migrated.gameClock.hour, 7);
});

test("migrateSave preserves pre-existing non-colony fields", () => {
  const oldSave = {
    currentWorld: 3,
    credits: 500,
    xp: 1200,
  };
  const migrated = migrateSave(oldSave);
  assert.equal(migrated.currentWorld, 3);
  assert.equal(migrated.credits, 500);
  assert.equal(migrated.xp, 1200);
});

test("migrateSave preserves colony fields if present", () => {
  const oldSave = {
    missionsSinceStart: 12,
    colonies: [],
    gameClock: { day: 5, hour: 14, minute: 30, realtimeMsPerGameMinute: 1000, season: "storm" },
  };
  const migrated = migrateSave(oldSave);
  assert.equal(migrated.missionsSinceStart, 12);
  assert.equal(migrated.gameClock.day, 5);
  assert.equal(migrated.gameClock.season, "storm");
});

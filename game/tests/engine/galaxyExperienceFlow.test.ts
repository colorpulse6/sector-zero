import { test } from "node:test";
import assert from "node:assert/strict";
import {
  beginGalaxyExperience,
  legacyProgressionSnapshot,
  mapSurfaceForExperience,
  returnSurfaceForOperation,
} from "../../app/components/engine/galaxy/experienceFlow";
import { migrateSave } from "../../app/components/engine/save";

function legacyFixture() {
  return migrateSave({
    currentWorld: 6,
    levels: { "5-3": { completed: true, stars: 3, highScore: 42_000 } },
    credits: 9_999,
    xp: 2_400,
    completedQuests: ["q-reyes-1-1"],
    materials: ["phase-crystal"],
    activeExperience: "legacy",
    galaxyRun: null,
  });
}

test("beginning a galaxy experience creates a run without changing legacy progression", () => {
  const legacy = legacyFixture();
  const legacyBefore = legacyProgressionSnapshot(legacy);

  const begun = beginGalaxyExperience(legacy);

  assert.equal(begun.activeExperience, "galaxy");
  assert.notEqual(begun.galaxyRun, null);
  assert.deepEqual(legacyProgressionSnapshot(begun), legacyBefore);
});

test("beginning an existing galaxy experience resumes its canonical run", () => {
  const begun = beginGalaxyExperience(legacyFixture());
  assert.ok(begun.galaxyRun);
  const resumedSave = {
    ...begun,
    activeExperience: "legacy" as const,
    galaxyRun: { ...begun.galaxyRun, worldCycle: 17 },
  };

  const resumed = beginGalaxyExperience(resumedSave);

  assert.equal(resumed.activeExperience, "galaxy");
  assert.equal(resumed.galaxyRun?.worldCycle, 17);
  assert.deepEqual(
    legacyProgressionSnapshot(resumed),
    legacyProgressionSnapshot(resumedSave),
  );
});

test("experience selector routes legacy to the numbered map and galaxy to the Atlas", () => {
  assert.equal(mapSurfaceForExperience("legacy"), "legacy_star_map");
  assert.equal(mapSurfaceForExperience("galaxy"), "galaxy_atlas");
});

test("a galaxy operation returns to the Atlas without changing legacy progression", () => {
  const begun = beginGalaxyExperience(legacyFixture());
  assert.ok(begun.galaxyRun);
  const legacyBefore = legacyProgressionSnapshot(begun);
  const completed = {
    ...begun,
    galaxyRun: {
      ...begun.galaxyRun,
      worldCycle: begun.galaxyRun.worldCycle + 1,
      appliedOutcomeIds: ["operation:test:complete"],
    },
  };

  assert.equal(returnSurfaceForOperation(completed), "galaxy_atlas");
  assert.deepEqual(legacyProgressionSnapshot(completed), legacyBefore);
});

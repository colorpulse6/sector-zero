import { test } from "node:test";
import assert from "node:assert/strict";
import {
  attemptCanonicalPersistence,
  beginGalaxyExperience,
  galaxyPoiRecoverySurface,
  isInteractiveKeyboardTarget,
  legacyProgressionSnapshot,
  mapSurfaceForExperience,
  operationSurfaceLabel,
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

test("global game shortcuts yield to interactive controls and their descendants", () => {
  assert.equal(isInteractiveKeyboardTarget({ tagName: "BUTTON" }), true);
  assert.equal(isInteractiveKeyboardTarget({ tagName: "A", getAttribute: (name: string) => name === "href" ? "/atlas" : null }), true);
  assert.equal(isInteractiveKeyboardTarget({ tagName: "DIV", isContentEditable: true }), true);
  assert.equal(isInteractiveKeyboardTarget({ tagName: "DIV", getAttribute: (name: string) => name === "role" ? "button" : null }), true);
  assert.equal(isInteractiveKeyboardTarget({
    tagName: "SPAN",
    closest: (selector: string) => selector.includes("button") ? { tagName: "BUTTON" } : null,
  }), true);
  assert.equal(isInteractiveKeyboardTarget({ tagName: "CANVAS" }), false);
  assert.equal(isInteractiveKeyboardTarget(null), false);
});

test("operation surface labels override compatibility coordinates without changing legacy labels", () => {
  assert.equal(
    operationSurfaceLabel({ galaxyOperation: { id: "op:hostile-picket", label: "HOSTILE PICKET" } }, "Aurelia Belt — Level 1"),
    "HOSTILE PICKET",
  );
  assert.equal(operationSurfaceLabel({}, "Aurelia Belt — Level 1"), "Aurelia Belt — Level 1");
});

test("canonical persistence reports failure without consuming a later retry", () => {
  const value = { cycle: 7 };
  let attempts = 0;
  const persist = (candidate: typeof value) => {
    attempts += 1;
    assert.strictEqual(candidate, value);
    if (attempts === 1) throw new Error("quota exceeded");
  };

  assert.deepEqual(attemptCanonicalPersistence(value, persist), { ok: false });
  assert.deepEqual(attemptCanonicalPersistence(value, persist), { ok: true });
  assert.equal(attempts, 2);
});

test("POI recovery exposes Atlas only when no unresolved or rejected journal exists", () => {
  assert.equal(galaxyPoiRecoverySurface({ ok: true, pending: null }), "atlas");
  assert.equal(galaxyPoiRecoverySurface({ ok: true, pending: { preparedFactId: "history:prepared" } }), "poi_outcome");
  assert.equal(galaxyPoiRecoverySurface({ ok: false }), "blocked");
});

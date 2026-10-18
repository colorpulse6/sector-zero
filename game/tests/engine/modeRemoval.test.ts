import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_LEVELS, getMultiPhaseLevelData } from "../../app/components/engine/levels";
import { migrateSave } from "../../app/components/engine/save";
import { beginGalaxyExperience } from "../../app/components/engine/galaxy/experienceFlow";

test("removed campaign phases preserve all forty levels, their shooter content and rewards", () => {
  assert.equal(ALL_LEVELS.length, 40);
  for (const [world, reward] of [[1, "kinetic-core"], [2, "energy-cell"], [6, "void-fragment"], [7, "hollow-resonance"]] as const) {
    const base = ALL_LEVELS.find(level => level.world === world && level.level === 3)!;
    const level = getMultiPhaseLevelData(world, 3)!;
    assert.equal(level.name, base.name);
    assert.deepEqual(level.completionRewards, [reward]);
    assert.equal(level.phases.length, 1);
    assert.equal(level.phases[0].config.mode, "shooter");
    assert.deepEqual(level.phases[0].config.waves, base.waves);
  }
  for (const [world, mode] of [[3, "turret"], [5, "first-person"], [8, "turret"]] as const) {
    assert.deepEqual(getMultiPhaseLevelData(world, 3)!.phases.map(phase => phase.config.mode), ["shooter", mode]);
  }
});

for (const engine of ["boarding", "groundRun", "ground-run"] as const) {
  test(`save migration discards transient ${engine} state and preserves both economies and campaign progress`, () => {
    const baseline = beginGalaxyExperience(migrateSave({ credits: 765, currentWorld: 7,
      levels: { "1-3": { completed: true, stars: 3, highScore: 456 } } }));
    const transient = { engine, currentMode: engine, currentPhase: 1, groundState: {}, boardingState: {} };
    const raw = JSON.parse(JSON.stringify({ ...baseline,
      ...transient, pendingPoiSession: transient, activeOperation: transient, sceneStack: [transient],
      galaxyRun: { ...baseline.galaxyRun, pendingPoiSession: transient, activeOperation: transient,
        sceneStack: [transient], checkpoint: transient } }));
    assert.deepEqual(migrateSave(raw), baseline);
  });
}

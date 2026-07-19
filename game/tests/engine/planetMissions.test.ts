import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createDefendStructure,
  createObjectiveState,
  updateObjective,
} from "../../app/components/engine/objectives";
import { createEnemy } from "../../app/components/engine/enemies";
import {
  createPlanetGameState,
  createPlayer,
  updateGame,
} from "../../app/components/engine/gameEngine";
import { PLANET_DEFS } from "../../app/components/engine/planets";
import {
  EnemyType,
  GameScreen,
  type DefendStructure,
  type Keys,
} from "../../app/components/engine/types";

const NO_KEYS: Keys = {
  left: false,
  right: false,
  up: false,
  down: false,
  strafeLeft: false,
  strafeRight: false,
  shoot: false,
  bomb: false,
  jump: false,
};

function enemyAtStructure(structure: DefendStructure) {
  const enemy = createEnemy(EnemyType.SCOUT, 0, 0);
  enemy.x = structure.x - enemy.width / 2;
  enemy.y = structure.y - enemy.height / 2;
  return enemy;
}

test("defend completes after the final authored wave when the living structure has no remaining threats", () => {
  const structure = createDefendStructure(15);
  const result = updateObjective(
    createObjectiveState("defend", structure.maxHp),
    1,
    createPlayer(),
    [],
    [],
    { allWavesSpawned: true, hasActiveBoss: false },
    undefined,
    structure,
  );

  assert.equal(result.objective.completed, true);
  assert.equal(result.objective.failed, false);
});

test("defend remains active before the final wave or while a threat remains", () => {
  const structure = createDefendStructure(15);
  const beforeFinalWave = updateObjective(
    createObjectiveState("defend", structure.maxHp),
    1,
    createPlayer(),
    [],
    [],
    { allWavesSpawned: false, hasActiveBoss: false },
    undefined,
    structure,
  );
  assert.equal(beforeFinalWave.objective.completed, false);

  const activeBoss = updateObjective(
    createObjectiveState("defend", structure.maxHp),
    1,
    createPlayer(),
    [],
    [],
    { allWavesSpawned: true, hasActiveBoss: true },
    undefined,
    structure,
  );
  assert.equal(activeBoss.objective.completed, false);

  const remainingEnemy = createEnemy(EnemyType.SCOUT, 0, 0);
  const withEnemy = updateObjective(
    createObjectiveState("defend", structure.maxHp),
    1,
    createPlayer(),
    [],
    [remainingEnemy],
    { allWavesSpawned: true, hasActiveBoss: false },
    undefined,
    structure,
  );
  assert.equal(withEnemy.objective.completed, false);
});

test("defend fails rather than completes when the structure reaches zero HP", () => {
  const structure = createDefendStructure(1);
  const result = updateObjective(
    createObjectiveState("defend", structure.maxHp),
    1,
    createPlayer(),
    [],
    [enemyAtStructure(structure)],
    { allWavesSpawned: true, hasActiveBoss: false },
    undefined,
    structure,
  );

  assert.equal(result.structure?.hp, 0);
  assert.equal(result.objective.failed, true);
  assert.equal(result.objective.completed, false);
});

test("defend resolves the last ramming threat from the structure HP left by that update", () => {
  for (const [startingHp, expected] of [
    [2, { hp: 1, completed: true, failed: false }],
    [1, { hp: 0, completed: false, failed: true }],
  ] as const) {
    const structure = createDefendStructure(startingHp);
    const result = updateObjective(
      createObjectiveState("defend", structure.maxHp),
      1,
      createPlayer(),
      [],
      [enemyAtStructure(structure)],
      { allWavesSpawned: true, hasActiveBoss: false },
      undefined,
      structure,
    );

    assert.equal(result.structure?.hp, expected.hp, `starting HP ${startingHp}`);
    assert.equal(result.objective.completed, expected.completed, `starting HP ${startingHp}`);
    assert.equal(result.objective.failed, expected.failed, `starting HP ${startingHp}`);
  }
});

test("all ten authored planet objectives can reach the engine completion transition", () => {
  assert.equal(PLANET_DEFS.length, 10);
  assert.deepEqual(
    new Set(PLANET_DEFS.map((planet) => planet.objective)),
    new Set(["collect", "survive", "escort", "defend"]),
  );

  for (const planet of PLANET_DEFS) {
    const state = createPlanetGameState(planet.id);
    state.screen = GameScreen.PLAYING;
    state.devInvincible = true;
    state.currentWave = state.totalWaves;
    state.waveDelay = 0;
    state.waves = state.waves.map((wave) => ({ ...wave, spawned: true }));
    state.enemies = [];
    state.enemyBullets = [];

    switch (state.objective?.type) {
      case "collect":
        state.objective.progress = state.objective.target;
        break;
      case "survive":
        state.objective.progress = state.objective.target * 60 - 1;
        break;
      case "escort":
        assert.ok(state.escort);
        state.escort.waypointIndex = Number.MAX_SAFE_INTEGER;
        break;
      case "defend":
        assert.ok(state.defendStructure);
        break;
      default:
        assert.fail(`Missing objective for ${planet.id}`);
    }

    const terminal = updateGame(state, NO_KEYS, null, null);
    assert.equal(terminal.objective?.completed, true, planet.id);
    assert.ok(terminal.levelCompleteTimer > 0, planet.id);
    assert.equal(terminal.screen, GameScreen.PLAYING, planet.id);
  }
});

test("survive missions keep looping authored combat waves before their timer expires", () => {
  const state = createPlanetGameState("glaciem");
  state.screen = GameScreen.PLAYING;
  state.devInvincible = true;
  state.currentWave = state.totalWaves;
  state.waveDelay = 0;
  state.waves = state.waves.map((wave) => ({ ...wave, spawned: true }));
  state.enemies = [];

  const updated = updateGame(state, NO_KEYS, null, null);

  assert.equal(updated.currentWave, updated.loopFromWave);
  assert.equal(updated.objective?.completed, false);
  assert.ok(updated.waves.slice(updated.loopFromWave).every((wave) => !wave.spawned));
});

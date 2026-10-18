import { test } from "node:test";
import assert from "node:assert/strict";
import { createGameState } from "../../app/components/engine/gameEngine";
import { createAshfallForwardCampState } from "../../app/components/engine/ashfallForwardCamp";
import { updateFirstPerson } from "../../app/components/engine/firstPersonEngine";
import { GameScreen, type FPEnemy, type Keys } from "../../app/components/engine/types";

const IDLE: Keys = { left: false, right: false, up: false, down: false,
  strafeLeft: false, strafeRight: false, shoot: false, bomb: false, jump: false };

for (const type of ["grunt", "charger"] as const) {
  test(`${type} stops in striking range without crossing the camera, and follows a retreat`, () => {
    const game = createGameState(1, 1);
    const fp = createAshfallForwardCampState();
    const enemy: FPEnemy = { id: 1, x: fp.posX + 1, y: fp.posY, hp: 10, maxHp: 10,
      speed: 0.03, type, aggroRange: 6, isAggro: true, deathTimer: 0, fireTimer: 0, classId: "swarm" };
    fp.enemies = [enemy];
    fp.npcs = [];
    game.firstPersonState = fp;
    game.currentMode = "first-person";
    game.screen = GameScreen.PLAYING;
    game.player.hp = game.player.maxHp = 1000;
    game.player.invincibleTimer = 0;
    for (let frame = 0; frame < 100; frame++) {
      updateFirstPerson(game, IDLE, 200); // exercise maximum catch-up movement
      assert.ok(Math.hypot(enemy.x - fp.posX, enemy.y - fp.posY) >= 0.45 - 1e-9,
        "approach movement must not put the hostile inside the camera");
    }
    assert.ok(game.player.hp < 1000, "contact damage still reaches the player");
    assert.ok(Math.hypot(enemy.x - fp.posX, enemy.y - fp.posY) < 0.5, "hold inside existing attack range");
    const previousX = enemy.x;
    fp.posX -= 1;
    for (let frame = 0; frame < 30; frame++) updateFirstPerson(game, IDLE, 200);
    assert.ok(enemy.x < previousX, "the enemy resumes pursuit when the player retreats");
    assert.ok(Math.hypot(enemy.x - fp.posX, enemy.y - fp.posY) >= 0.45 - 1e-9);
  });
}

import type { GameState, GroundState, GroundEntity, Keys, Bullet } from "./types";
import { GameScreen, AudioEvent, BULLET_SPEED, ENEMY_BULLET_SPEED, PLAYER_INVINCIBLE_FRAMES, CANVAS_WIDTH, GAME_AREA_HEIGHT } from "./types";
// EnemyType.SCOUT is the PoC category for bestiary tracking (resolved at SaveData level)
import { applyGravity, resolveHorizontal, JUMP_VELOCITY, GROUND_TILE_SIZE } from "./groundPhysics";
import { getGoalPosition, getSpawnPosition } from "./groundLevel";
import { resolveAffinity } from "./enemyClasses";
import { AFFINITY_MULTIPLIER } from "./weaponTypes";
import { createAffinityLabel } from "./floatingLabels";
import { createSpriteExplosion } from "./particles";
import { hasSkill, getSkillEffect } from "./skillTree";

// ─── Constants ────────────────────────────────────────────────────────
const PLAYER_MOVE_SPEED = 3;
const PLAYER_FIRE_RATE = 12;
const PLAYER_W = 32;
const PLAYER_H = 40;
const BULLET_W = 10;
const BULLET_H = 6;
const ENEMY_BULLET_W = 8;
const ENEMY_BULLET_H = 8;
const TURRET_FIRE_RATE = 180; // 3 seconds between shots
const JUMPER_JUMP_COOLDOWN = 90;
const FLYER_BOB_SPEED = 0.04;
const FLYER_BOB_AMP = 20;
const FLYER_MOVE_SPEED = 1.5;
const ENEMY_BULLET_DAMAGE = 1;
const PLAYER_BULLET_DAMAGE = 1;
const GOAL_OVERLAP_W = 24;
const GOAL_OVERLAP_H = 32;

let _bulletId = 10000;

function nextBulletId(): number {
  return ++_bulletId;
}

function rectsOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// ─── Player input & movement ──────────────────────────────────────────

function updatePlayerMovement(
  gs: GameState,
  ground: GroundState,
  keys: Keys
): void {
  const p = gs.player;
  const map = ground.tileMap;

  // Horizontal
  let vx = 0;
  if (keys.left) {
    vx = -PLAYER_MOVE_SPEED;
    ground.playerFacingRight = false;
    gs.player.bankDir = -1; // Signal to renderer: moving left
  } else if (keys.right) {
    vx = PLAYER_MOVE_SPEED;
    ground.playerFacingRight = true;
    gs.player.bankDir = 1; // Signal to renderer: moving right
  } else {
    gs.player.bankDir = 0; // Idle
  }

  const newX = resolveHorizontal(map, p.x, p.y, vx, PLAYER_W, PLAYER_H);
  p.x = newX;

  // Jump (Space / keys.jump — NOT up arrow, which is used for aiming)
  if (keys.jump && ground.playerOnGround) {
    ground.playerVY = JUMP_VELOCITY;
    ground.playerOnGround = false;
  }

  // Gravity & vertical
  const { y, vy, onGround } = applyGravity(map, p.x, p.y, ground.playerVY, PLAYER_W, PLAYER_H);
  p.y = y;
  ground.playerVY = vy;
  ground.playerOnGround = onGround;

  // Camera follow — smooth scroll, clamped to map bounds
  const mapPixelWidth = map.width * map.tileSize;
  const targetCameraX = p.x + PLAYER_W / 2 - CANVAS_WIDTH / 2;
  const maxCameraX = mapPixelWidth - CANVAS_WIDTH;
  ground.cameraX += (targetCameraX - ground.cameraX) * 0.1;
  ground.cameraX = Math.max(0, Math.min(ground.cameraX, maxCameraX));
}

// ─── Player shooting ──────────────────────────────────────────────────

function updatePlayerShooting(gs: GameState, ground: GroundState, keys: Keys): void {
  const p = gs.player;
  if (p.fireTimer > 0) {
    p.fireTimer--;
    return;
  }
  if (!keys.shoot) return;

  // Determine aim direction from arrow keys
  // Horizontal: facing direction (or override with left/right while shooting)
  let aimX = ground.playerFacingRight ? 1 : -1;
  let aimY = 0;

  if (keys.up && !keys.down) aimY = -1;
  if (keys.down && !keys.up) aimY = 1;
  // If ONLY up/down pressed (no horizontal), shoot straight up/down
  if (keys.up && !keys.left && !keys.right) aimX = 0;

  // Normalize diagonal speed
  const mag = Math.sqrt(aimX * aimX + aimY * aimY) || 1;
  const bvx = (aimX / mag) * BULLET_SPEED;
  const bvy = (aimY / mag) * BULLET_SPEED;

  // Spawn bullet from the direction we're aiming
  let bulletX = p.x + PLAYER_W / 2 - BULLET_W / 2;
  let bulletY = p.y + PLAYER_H / 2 - BULLET_H / 2;
  if (aimX > 0) bulletX = p.x + PLAYER_W;
  else if (aimX < 0) bulletX = p.x - BULLET_W;
  if (aimY < 0) bulletY = p.y - BULLET_H;
  else if (aimY > 0) bulletY = p.y + PLAYER_H;

  const bullet: Bullet = {
    id: nextBulletId(),
    x: bulletX,
    y: bulletY,
    vx: bvx,
    vy: bvy,
    width: BULLET_W,
    height: BULLET_H,
    damage: PLAYER_BULLET_DAMAGE,
    isPlayer: true,
    piercing: false,
    weaponType: "kinetic",
  };

  // sharpshooter skill: extra damage
  const dmgBonus = getSkillEffect(gs.allocatedSkills, "sharpshooter");
  if (dmgBonus > 0) bullet.damage += dmgBonus;

  // glass-cannon: piercing
  if (hasSkill(gs.allocatedSkills, "glass-cannon")) bullet.piercing = true;

  ground.groundBullets.push(bullet);
  gs.audioEvents.push(AudioEvent.PLAYER_SHOOT);
  p.fireTimer = PLAYER_FIRE_RATE;
}

// ─── Patrol edge detection helper ─────────────────────────────────────

function hasGroundAhead(ground: GroundState, enemy: GroundEntity): boolean {
  const map = ground.tileMap;
  const T = GROUND_TILE_SIZE;
  // foot row: one row below the bottom of the entity
  const feetY = enemy.y + enemy.height;
  const groundRow = Math.floor(feetY / T);
  // column one step ahead in movement direction
  const aheadX = enemy.facingRight
    ? enemy.x + enemy.width + 1
    : enemy.x - 1;
  const aheadCol = Math.floor(aheadX / T);

  if (aheadCol < 0 || aheadCol >= map.width) return false;
  if (groundRow < 0 || groundRow >= map.height) return false;
  return map.tiles[groundRow][aheadCol] === "solid";
}

// ─── Enemy AI update ──────────────────────────────────────────────────

function updateEnemyAI(gs: GameState, ground: GroundState): void {
  const map = ground.tileMap;
  const p = gs.player;

  for (const enemy of ground.groundEnemies) {
    switch (enemy.type) {
      // ── Patrol: walks back and forth, reverses on wall or edge ──────
      case "patrol": {
        // Apply gravity
        const grav = applyGravity(map, enemy.x, enemy.y, enemy.vy, enemy.width, enemy.height);
        enemy.y = grav.y;
        enemy.vy = grav.vy;
        enemy.onGround = grav.onGround;

        const speed = enemy.facingRight ? 1 : -1;

        // Check wall ahead or no ground ahead → reverse
        const wallAhead = resolveHorizontal(map, enemy.x, enemy.y, speed, enemy.width, enemy.height) === enemy.x;
        const edgeAhead = !hasGroundAhead(ground, enemy);

        if (wallAhead || edgeAhead) {
          enemy.facingRight = !enemy.facingRight;
          enemy.vx = enemy.facingRight ? 1 : -1;
        } else {
          enemy.vx = speed;
          enemy.x = resolveHorizontal(map, enemy.x, enemy.y, speed, enemy.width, enemy.height);
        }
        break;
      }

      // ── Turret: stationary, shoots at player ─────────────────────
      case "turret": {
        // Gravity to stay grounded
        const grav = applyGravity(map, enemy.x, enemy.y, enemy.vy, enemy.width, enemy.height);
        enemy.y = grav.y;
        enemy.vy = grav.vy;
        enemy.onGround = grav.onGround;
        enemy.vx = 0;

        // Face player
        enemy.facingRight = p.x > enemy.x;

        // Only shoot when within screen range (~500px)
        const distToPlayer = Math.abs((enemy.x + enemy.width / 2) - (p.x + PLAYER_W / 2));

        if (enemy.fireTimer > 0) {
          enemy.fireTimer--;
        } else if (distToPlayer < CANVAS_WIDTH + 50) {
          // Fire toward player (only when on/near screen)
          const cx = enemy.x + enemy.width / 2;
          const cy = enemy.y + enemy.height / 2;
          const dx = (p.x + PLAYER_W / 2) - cx;
          const dy = (p.y + PLAYER_H / 2) - cy;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const bvx = (dx / len) * ENEMY_BULLET_SPEED;
          const bvy = (dy / len) * ENEMY_BULLET_SPEED;

          ground.groundBullets.push({
            id: nextBulletId(),
            x: cx - ENEMY_BULLET_W / 2,
            y: cy - ENEMY_BULLET_H / 2,
            vx: bvx,
            vy: bvy,
            width: ENEMY_BULLET_W,
            height: ENEMY_BULLET_H,
            damage: ENEMY_BULLET_DAMAGE,
            isPlayer: false,
            piercing: false,
            weaponType: "kinetic",
          });
          gs.audioEvents.push(AudioEvent.ENEMY_SHOOT);
          enemy.fireTimer = TURRET_FIRE_RATE;
        }
        break;
      }

      // ── Jumper: moves toward player, jumps when player is above ──
      case "jumper": {
        const grav = applyGravity(map, enemy.x, enemy.y, enemy.vy, enemy.width, enemy.height);
        enemy.y = grav.y;
        enemy.vy = grav.vy;
        enemy.onGround = grav.onGround;

        const dirToPlayer = p.x + PLAYER_W / 2 > enemy.x + enemy.width / 2 ? 1 : -1;
        enemy.facingRight = dirToPlayer > 0;

        const newX = resolveHorizontal(map, enemy.x, enemy.y, dirToPlayer * 2, enemy.width, enemy.height);
        enemy.x = newX;
        enemy.vx = dirToPlayer * 2;

        // Jump if player is above and enemy is on ground
        const playerAbove = p.y < enemy.y - 16;
        if (playerAbove && enemy.onGround) {
          if ((enemy.fireTimer || 0) <= 0) {
            enemy.vy = JUMP_VELOCITY;
            enemy.onGround = false;
            enemy.fireTimer = JUMPER_JUMP_COOLDOWN;
          }
        }

        if (enemy.fireTimer > 0) {
          enemy.fireTimer--;
        }
        break;
      }

      // ── Flyer: bobs in air, drifts toward player ──────────────────
      case "flyer": {
        // No gravity — flies
        const dirToPlayer = p.x + PLAYER_W / 2 > enemy.x + enemy.width / 2 ? 1 : -1;
        enemy.facingRight = dirToPlayer > 0;

        // Drift toward player horizontally
        enemy.x += dirToPlayer * FLYER_MOVE_SPEED;

        // Sine-wave vertical bobbing (use fireTimer as frame counter)
        enemy.fireTimer += 1;
        enemy.vy = Math.cos(enemy.fireTimer * FLYER_BOB_SPEED) * FLYER_BOB_AMP * 0.05;
        enemy.y += enemy.vy;

        // Clamp to stay in game area
        enemy.y = Math.max(32, Math.min(enemy.y, GAME_AREA_HEIGHT - 64));

        break;
      }
    }
  }
}

// ─── Bullet movement & culling ────────────────────────────────────────

function updateBullets(ground: GroundState): void {
  const map = ground.tileMap;
  const mapPixelWidth = map.width * map.tileSize;
  const mapPixelHeight = map.height * map.tileSize;

  ground.groundBullets = ground.groundBullets.filter((b) => {
    b.x += b.vx;
    b.y += b.vy;
    // Remove if out of map bounds or hits a solid tile
    if (b.x < 0 || b.x > mapPixelWidth || b.y < 0 || b.y > mapPixelHeight) return false;
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    const col = Math.floor(cx / map.tileSize);
    const row = Math.floor(cy / map.tileSize);
    if (row >= 0 && row < map.height && col >= 0 && col < map.width) {
      if (map.tiles[row][col] === "solid") return false;
    }
    return true;
  });
}

// ─── Bullet–enemy collisions ─────────────────────────────────────────

function resolveBulletEnemyCollisions(gs: GameState, ground: GroundState): void {
  const bulletsToRemove = new Set<number>();

  for (const bullet of ground.groundBullets) {
    if (!bullet.isPlayer) continue;

    for (const enemy of ground.groundEnemies) {
      if (enemy.hp <= 0) continue;
      if (!rectsOverlap(bullet.x, bullet.y, bullet.width, bullet.height,
                        enemy.x, enemy.y, enemy.width, enemy.height)) continue;

      // Affinity
      const affinity = bullet.weaponType
        ? resolveAffinity(bullet.weaponType, enemy.classId)
        : "neutral";
      const mult = AFFINITY_MULTIPLIER[affinity];
      const dmg = Math.round(bullet.damage * mult);

      enemy.hp -= dmg;
      gs.audioEvents.push(AudioEvent.ENEMY_HIT);

      // Floating affinity label
      const label = createAffinityLabel(enemy.x + enemy.width / 2, enemy.y, affinity);
      if (label) gs.floatingLabels.push(label);

      if (!bullet.piercing) bulletsToRemove.add(bullet.id);

      if (enemy.hp <= 0) {
        gs.score += 100;
        gs.kills++;
        gs.audioEvents.push(AudioEvent.ENEMY_DESTROY);
        gs.explosions.push(createSpriteExplosion(
          enemy.x + enemy.width / 2,
          enemy.y + enemy.height / 2,
          48
        ));

        // Bestiary tracking is handled at SaveData level (outside GameState).
        // PoC placeholder: ground kills are categorized as EnemyType.SCOUT when
        // the caller merges results into SaveData after the level ends.
      }
    }
  }

  // Remove spent bullets
  if (bulletsToRemove.size > 0) {
    ground.groundBullets = ground.groundBullets.filter((b) => !bulletsToRemove.has(b.id));
  }

  // Remove dead enemies
  ground.groundEnemies = ground.groundEnemies.filter((e) => e.hp > 0);
}

// ─── Player–enemy-bullet collisions ──────────────────────────────────

function resolvePlayerHits(gs: GameState, ground: GroundState): void {
  const p = gs.player;

  // Player hit by enemy bullets
  const bulletsToRemove = new Set<number>();
  for (const bullet of ground.groundBullets) {
    if (bullet.isPlayer) continue;
    if (p.invincibleTimer > 0) break;
    if (!rectsOverlap(bullet.x, bullet.y, bullet.width, bullet.height,
                      p.x, p.y, PLAYER_W, PLAYER_H)) continue;

    bulletsToRemove.add(bullet.id);
    p.hp -= bullet.damage;
    p.invincibleTimer = PLAYER_INVINCIBLE_FRAMES;
    gs.audioEvents.push(AudioEvent.PLAYER_HIT);
    gs.screenShake = Math.max(gs.screenShake, 8);

    if (p.hp <= 0) {
      handlePlayerDeath(gs, ground);
      return;
    }
  }
  ground.groundBullets = ground.groundBullets.filter((b) => !bulletsToRemove.has(b.id));

  // Player touching an enemy directly
  if (p.invincibleTimer > 0) return;
  for (const enemy of ground.groundEnemies) {
    if (!rectsOverlap(p.x, p.y, PLAYER_W, PLAYER_H,
                      enemy.x, enemy.y, enemy.width, enemy.height)) continue;

    p.hp -= 1;
    p.invincibleTimer = PLAYER_INVINCIBLE_FRAMES;
    gs.audioEvents.push(AudioEvent.PLAYER_HIT);
    gs.screenShake = Math.max(gs.screenShake, 8);

    if (p.hp <= 0) {
      handlePlayerDeath(gs, ground);
      return;
    }
    break;
  }
}

function handlePlayerDeath(gs: GameState, ground: GroundState): void {
  gs.deaths++;
  gs.audioEvents.push(AudioEvent.PLAYER_DEATH);
  gs.explosions.push(createSpriteExplosion(
    gs.player.x + PLAYER_W / 2,
    gs.player.y + PLAYER_H / 2,
    56
  ));

  if (gs.lives > 0) {
    gs.lives--;
    const spawn = getSpawnPosition(ground.tileMap);
    gs.player.x = spawn.x;
    gs.player.y = spawn.y;
    gs.player.hp = gs.player.maxHp;
    gs.player.invincibleTimer = PLAYER_INVINCIBLE_FRAMES * 2;
    ground.playerVY = 0;
    ground.playerOnGround = false;
  } else {
    gs.screen = GameScreen.GAME_OVER;
    gs.audioEvents.push(AudioEvent.GAME_OVER);
  }
}

// ─── Invincibility timer ──────────────────────────────────────────────

function tickInvincibility(gs: GameState): void {
  if (gs.player.invincibleTimer > 0) gs.player.invincibleTimer--;
}

// ─── Goal detection ───────────────────────────────────────────────────

function checkGoal(gs: GameState, ground: GroundState): void {
  if (ground.goalReached) return;
  const goal = getGoalPosition(ground.tileMap);
  if (rectsOverlap(
    gs.player.x, gs.player.y, PLAYER_W, PLAYER_H,
    goal.x, goal.y, GOAL_OVERLAP_W, GOAL_OVERLAP_H
  )) {
    ground.goalReached = true;
    gs.levelCompleteTimer = 360;
    gs.audioEvents.push(AudioEvent.LEVEL_COMPLETE);
  }
}

// ─── Main ground update ───────────────────────────────────────────────

export function updateGroundEngine(
  gs: GameState,
  keys: Keys
): void {
  const ground = gs.groundState;
  if (!ground) return;

  // Skip updates if level is completing
  if (gs.levelCompleteTimer > 0) return;

  updatePlayerMovement(gs, ground, keys);
  updatePlayerShooting(gs, ground, keys);
  updateEnemyAI(gs, ground);
  updateBullets(ground);
  resolveBulletEnemyCollisions(gs, ground);
  resolvePlayerHits(gs, ground);
  tickInvincibility(gs);
  checkGoal(gs, ground);
}

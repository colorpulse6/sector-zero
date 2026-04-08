import type { GameState, BoardingState, BoardingEntity, Keys, Bullet, FacingDirection } from "./types";
import { GameScreen, AudioEvent, CANVAS_WIDTH, GAME_AREA_HEIGHT } from "./types";
import { resolveMovement, hasLineOfSight } from "./boardingPhysics";
import { getBoardingGoal } from "./boardingLevel";
import { resolveAffinity } from "./enemyClasses";
import { AFFINITY_MULTIPLIER } from "./weaponTypes";
import { createAffinityLabel } from "./floatingLabels";
import { createSpriteExplosion } from "./particles";
import { hasSkill, getSkillEffect } from "./skillTree";

// ─── Constants ──────────────────────────────────────────────────────

const PLAYER_SPEED = 2.5;
const DASH_SPEED = 8;
const DASH_DURATION = 8;   // frames
const DASH_COOLDOWN = 40;  // frames after dash ends
const BULLET_SPEED = 7;
const FIRE_RATE = 14;
const PLAYER_W = 24;
const PLAYER_H = 24;
const BULLET_W = 6;
const BULLET_H = 6;
const ENEMY_BULLET_SPEED = 3;
const SENTRY_FIRE_RATE = 150;  // 2.5s
const GRUNT_CHASE_SPEED = 1.2;
const CHARGER_CHASE_SPEED = 2.5;
const GOAL_RANGE = 24;

let bulletIdCounter = 80000;
function nextBulletId(): number { return ++bulletIdCounter; }

// ─── Direction helpers ──────────────────────────────────────────────

function facingToVec(f: FacingDirection): { x: number; y: number } {
  switch (f) {
    case "up": return { x: 0, y: -1 };
    case "down": return { x: 0, y: 1 };
    case "left": return { x: -1, y: 0 };
    case "right": return { x: 1, y: 0 };
  }
}

function keysToFacing(keys: Keys, current: FacingDirection): FacingDirection {
  // Prioritize last pressed — simple: check in order
  if (keys.up) return "up";
  if (keys.down) return "down";
  if (keys.left) return "left";
  if (keys.right) return "right";
  return current;
}

// ─── Main Update ────────────────────────────────────────────────────

export function updateBoardingEngine(gs: GameState, keys: Keys): void {
  const bs = gs.boardingState;
  if (!bs || gs.levelCompleteTimer > 0) return;

  const p = gs.player;
  const map = bs.map;

  // ── Player movement ──
  let vx = 0;
  let vy = 0;
  if (keys.left) vx -= 1;
  if (keys.right) vx += 1;
  if (keys.up) vy -= 1;
  if (keys.down) vy += 1;

  // Update facing from input
  if (vx !== 0 || vy !== 0) {
    // Prefer horizontal for diagonal
    if (Math.abs(vx) >= Math.abs(vy)) {
      bs.playerFacing = vx > 0 ? "right" : "left";
    } else {
      bs.playerFacing = vy > 0 ? "down" : "up";
    }
    // Signal movement to renderer
    p.bankDir = 1;
  } else {
    p.bankDir = 0;
  }

  // Normalize diagonal
  const mag = Math.sqrt(vx * vx + vy * vy) || 1;
  const speed = bs.dashTimer > 0 ? DASH_SPEED : PLAYER_SPEED;
  vx = (vx / mag) * speed;
  vy = (vy / mag) * speed;

  const resolved = resolveMovement(map, p.x, p.y, vx, vy, PLAYER_W, PLAYER_H);
  p.x = resolved.x;
  p.y = resolved.y;

  // ── Dash ──
  if (keys.jump && bs.dashCooldown <= 0 && bs.dashTimer <= 0) {
    bs.dashTimer = DASH_DURATION;
    bs.dashCooldown = DASH_COOLDOWN;
    p.invincibleTimer = DASH_DURATION; // i-frames during dash
  }
  if (bs.dashTimer > 0) bs.dashTimer--;
  if (bs.dashCooldown > 0) bs.dashCooldown--;

  // ── Shooting ──
  if (keys.shoot && p.fireTimer <= 0) {
    const dir = facingToVec(bs.playerFacing);
    const cx = p.x + PLAYER_W / 2;
    const cy = p.y + PLAYER_H / 2;
    bs.bullets.push({
      id: nextBulletId(),
      x: cx + dir.x * 14 - BULLET_W / 2,
      y: cy + dir.y * 14 - BULLET_H / 2,
      vx: dir.x * BULLET_SPEED,
      vy: dir.y * BULLET_SPEED,
      width: BULLET_W,
      height: BULLET_H,
      damage: 1,
      isPlayer: true,
      piercing: false,
      weaponType: gs.equippedWeaponType,
    });
    p.fireTimer = FIRE_RATE;
    gs.audioEvents.push(AudioEvent.PLAYER_SHOOT);
  }
  if (p.fireTimer > 0) p.fireTimer--;

  // ── Update bullets ──
  bs.bullets = bs.bullets
    .map((b) => ({ ...b, x: b.x + b.vx, y: b.y + b.vy }))
    .filter((b) => {
      // Remove if hit wall
      const col = Math.floor((b.x + b.width / 2) / map.tileSize);
      const row = Math.floor((b.y + b.height / 2) / map.tileSize);
      if (row < 0 || row >= map.height || col < 0 || col >= map.width) return false;
      const tile = map.tiles[row][col];
      if (tile === "wall" || tile === "empty") return false;
      // Remove if too far from player
      const dx = b.x - p.x;
      const dy = b.y - p.y;
      return dx * dx + dy * dy < 800 * 800;
    });

  // ── Enemy AI ──
  const pcx = p.x + PLAYER_W / 2;
  const pcy = p.y + PLAYER_H / 2;

  for (const e of bs.enemies) {
    const ecx = e.x + e.width / 2;
    const ecy = e.y + e.height / 2;
    const dx = pcx - ecx;
    const dy = pcy - ecy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Aggro check
    if (!e.isAggro && dist < e.aggroRange) {
      if (hasLineOfSight(map, ecx, ecy, pcx, pcy)) {
        e.isAggro = true;
      }
    }

    if (!e.isAggro) {
      if (e.fireTimer > 0) e.fireTimer--;
      continue;
    }

    // Face player
    if (Math.abs(dx) > Math.abs(dy)) {
      e.facing = dx > 0 ? "right" : "left";
    } else {
      e.facing = dy > 0 ? "down" : "up";
    }

    switch (e.type) {
      case "grunt": {
        // Walk toward player
        const len = dist || 1;
        const mvx = (dx / len) * GRUNT_CHASE_SPEED;
        const mvy = (dy / len) * GRUNT_CHASE_SPEED;
        const res = resolveMovement(map, e.x, e.y, mvx, mvy, e.width, e.height);
        e.x = res.x;
        e.y = res.y;
        break;
      }

      case "charger": {
        // Rush toward player faster
        const len = dist || 1;
        const mvx = (dx / len) * CHARGER_CHASE_SPEED;
        const mvy = (dy / len) * CHARGER_CHASE_SPEED;
        const res = resolveMovement(map, e.x, e.y, mvx, mvy, e.width, e.height);
        e.x = res.x;
        e.y = res.y;
        break;
      }

      case "sentry": {
        // Stationary — shoots at player
        if (e.fireTimer > 0) {
          e.fireTimer--;
        } else if (dist < CANVAS_WIDTH && hasLineOfSight(map, ecx, ecy, pcx, pcy)) {
          const len = dist || 1;
          bs.bullets.push({
            id: nextBulletId(),
            x: ecx - 3,
            y: ecy - 3,
            vx: (dx / len) * ENEMY_BULLET_SPEED,
            vy: (dy / len) * ENEMY_BULLET_SPEED,
            width: 6,
            height: 6,
            damage: 1,
            isPlayer: false,
            piercing: false,
          });
          gs.audioEvents.push(AudioEvent.ENEMY_SHOOT);
          e.fireTimer = SENTRY_FIRE_RATE;
        }
        break;
      }
    }

    if (e.fireTimer > 0) e.fireTimer--;
  }

  // ── Bullet-enemy collisions ──
  const deadBullets = new Set<number>();
  const deadEnemies = new Set<number>();

  for (const b of bs.bullets) {
    if (deadBullets.has(b.id)) continue;

    if (b.isPlayer) {
      for (const e of bs.enemies) {
        if (deadEnemies.has(e.id)) continue;
        if (b.x < e.x + e.width && b.x + b.width > e.x &&
            b.y < e.y + e.height && b.y + b.height > e.y) {
          deadBullets.add(b.id);

          let dmg = b.damage;
          if (b.weaponType) {
            const aff = resolveAffinity(b.weaponType, e.classId);
            dmg = b.damage * AFFINITY_MULTIPLIER[aff];
            if (hasSkill(gs.allocatedSkills, "sharpshooter") && aff === "effective") {
              dmg *= 1 + getSkillEffect(gs.allocatedSkills, "sharpshooter");
            }
            const label = createAffinityLabel(e.x + e.width / 2, e.y - 4, aff);
            if (label) gs.floatingLabels = [...gs.floatingLabels, label];
          }

          e.hp -= dmg;
          if (e.hp <= 0) {
            deadEnemies.add(e.id);
            gs.score += 200;
            gs.xp += 200;
            gs.kills += 1;
            gs.explosions = [...gs.explosions,
              createSpriteExplosion(e.x + e.width / 2, e.y + e.height / 2, 40)];
            gs.audioEvents.push(AudioEvent.ENEMY_DESTROY);
          }
          break;
        }
      }
    } else {
      // Enemy bullet → player
      if (p.invincibleTimer <= 0 &&
          b.x < p.x + PLAYER_W && b.x + b.width > p.x &&
          b.y < p.y + PLAYER_H && b.y + b.height > p.y) {
        deadBullets.add(b.id);
        p.hp -= 1;
        p.invincibleTimer = 60;
        gs.screenShake = 4;
        gs.audioEvents.push(AudioEvent.PLAYER_HIT);
        if (p.hp <= 0) {
          gs.lives -= 1;
          gs.deaths += 1;
          if (gs.lives <= 0) {
            gs.screen = GameScreen.GAME_OVER;
            gs.audioEvents.push(AudioEvent.GAME_OVER);
          } else {
            const { getBoardingSpawn } = require("./boardingLevel");
            const spawn = getBoardingSpawn(map);
            p.x = spawn.x;
            p.y = spawn.y;
            p.hp = p.maxHp;
            p.invincibleTimer = 90;
          }
        }
      }
    }

    // Contact damage (grunt/charger touching player)
    for (const e of bs.enemies) {
      if (deadEnemies.has(e.id)) continue;
      if (e.type === "sentry") continue;
      if (p.invincibleTimer > 0) continue;
      if (e.x < p.x + PLAYER_W && e.x + e.width > p.x &&
          e.y < p.y + PLAYER_H && e.y + e.height > p.y) {
        p.hp -= 1;
        p.invincibleTimer = 60;
        gs.screenShake = 4;
        gs.audioEvents.push(AudioEvent.PLAYER_HIT);
        if (p.hp <= 0) {
          gs.lives -= 1;
          gs.deaths += 1;
          if (gs.lives <= 0) {
            gs.screen = GameScreen.GAME_OVER;
            gs.audioEvents.push(AudioEvent.GAME_OVER);
          }
        }
        break;
      }
    }
  }

  bs.bullets = bs.bullets.filter((b) => !deadBullets.has(b.id));
  bs.enemies = bs.enemies.filter((e) => !deadEnemies.has(e.id));

  // ── Invincibility ──
  if (p.invincibleTimer > 0) p.invincibleTimer--;

  // ── Camera ──
  const targetCX = p.x + PLAYER_W / 2 - CANVAS_WIDTH / 2;
  const targetCY = p.y + PLAYER_H / 2 - GAME_AREA_HEIGHT / 2;
  const maxCX = map.width * map.tileSize - CANVAS_WIDTH;
  const maxCY = map.height * map.tileSize - GAME_AREA_HEIGHT;
  bs.cameraX += (Math.max(0, Math.min(targetCX, maxCX)) - bs.cameraX) * 0.1;
  bs.cameraY += (Math.max(0, Math.min(targetCY, maxCY)) - bs.cameraY) * 0.1;

  // ── Goal check ──
  const goal = getBoardingGoal(map);
  if (Math.abs(p.x - goal.x) < GOAL_RANGE && Math.abs(p.y - goal.y) < GOAL_RANGE) {
    bs.goalReached = true;
  }

  if (bs.goalReached && gs.levelCompleteTimer === 0) {
    gs.levelCompleteTimer = 360;
    gs.xp += 500;
    gs.audioEvents.push(AudioEvent.LEVEL_COMPLETE);
  }
}

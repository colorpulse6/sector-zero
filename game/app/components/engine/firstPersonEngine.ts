import type { GameState, Keys, FirstPersonState, BoardingMap, FPEnemy } from "./types";
import { GameScreen, AudioEvent, CANVAS_WIDTH, GAME_AREA_HEIGHT } from "./types";
import { resolveAffinity } from "./enemyClasses";
import { AFFINITY_MULTIPLIER } from "./weaponTypes";
import { createAffinityLabel } from "./floatingLabels";
import { hasSkill, getSkillEffect } from "./skillTree";

// ─── Constants ──────────────────────────────────────────────────────

const MOVE_SPEED = 0.06;
const ROT_SPEED = 0.04;
const COLLISION_RADIUS = 0.25;
const GUN_FIRE_RATE = 15;     // frames between shots
const GUN_FLASH_DURATION = 6; // frames of muzzle flash
const BULLET_RANGE = 12;      // max hit distance in tiles
const BULLET_DAMAGE = 1;
const ENEMY_AGGRO_RANGE = 6;  // tiles
const ENEMY_CONTACT_RANGE = 0.5; // tiles — melee damage
const ENEMY_CONTACT_DAMAGE = 1;
const SENTRY_FIRE_RANGE = 8;
const SENTRY_FIRE_RATE = 120;
const OBJECTIVE_PICKUP_RANGE = 0.55;

type FacingVector = Pick<FirstPersonState, "dirX" | "dirY" | "planeX" | "planeY">;

// ─── Wall collision ─────────────────────────────────────────────────

function isWalkable(map: BoardingMap, x: number, y: number): boolean {
  const col = Math.floor(x);
  const row = Math.floor(y);
  if (col < 0 || col >= map.width || row < 0 || row >= map.height) return false;
  const tile = map.tiles[row][col];
  return tile !== "wall" && tile !== "empty";
}

// ─── Line of sight (simplified) ─────────────────────────────────────

function hasLOS(map: BoardingMap, x1: number, y1: number, x2: number, y2: number): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.ceil(dist * 3);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = x1 + dx * t;
    const py = y1 + dy * t;
    const col = Math.floor(px);
    const row = Math.floor(py);
    if (col < 0 || col >= map.width || row < 0 || row >= map.height) return false;
    const tile = map.tiles[row][col];
    if (tile === "wall" || tile === "empty") return false;
  }
  return true;
}

function rotateView(view: FacingVector, angle: number): FacingVector {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return {
    dirX: view.dirX * cos - view.dirY * sin,
    dirY: view.dirX * sin + view.dirY * cos,
    planeX: view.planeX * cos - view.planeY * sin,
    planeY: view.planeX * sin + view.planeY * cos,
  };
}

function moveWithCollision(
  map: BoardingMap,
  posX: number,
  posY: number,
  deltaX: number,
  deltaY: number
): { posX: number; posY: number } {
  let nextX = posX;
  let nextY = posY;

  const candidateX = posX + deltaX;
  const candidateY = posY + deltaY;

  if (isWalkable(map, candidateX + COLLISION_RADIUS * Math.sign(deltaX), posY)) nextX = candidateX;
  if (isWalkable(map, nextX, candidateY + COLLISION_RADIUS * Math.sign(deltaY))) nextY = candidateY;

  return { posX: nextX, posY: nextY };
}

// ─── Main Update ────────────────────────────────────────────────────

export function updateFirstPerson(gs: GameState, keys: Keys): void {
  const fp = gs.firstPersonState;
  if (!fp || gs.levelCompleteTimer > 0) return;

  let { posX, posY, dirX, dirY, planeX, planeY } = fp;

  // ── Rotation ──
  if (keys.left) {
    ({ dirX, dirY, planeX, planeY } = rotateView({ dirX, dirY, planeX, planeY }, ROT_SPEED));
  }
  if (keys.right) {
    ({ dirX, dirY, planeX, planeY } = rotateView({ dirX, dirY, planeX, planeY }, -ROT_SPEED));
  }

  // ── Movement ──
  if (keys.up) {
    ({ posX, posY } = moveWithCollision(fp.map, posX, posY, dirX * MOVE_SPEED, dirY * MOVE_SPEED));
  }
  if (keys.down) {
    ({ posX, posY } = moveWithCollision(fp.map, posX, posY, -dirX * MOVE_SPEED, -dirY * MOVE_SPEED));
  }
  if (keys.strafeLeft) {
    ({ posX, posY } = moveWithCollision(fp.map, posX, posY, dirY * MOVE_SPEED, -dirX * MOVE_SPEED));
  }
  if (keys.strafeRight) {
    ({ posX, posY } = moveWithCollision(fp.map, posX, posY, -dirY * MOVE_SPEED, dirX * MOVE_SPEED));
  }

  fp.posX = posX;
  fp.posY = posY;
  fp.dirX = dirX;
  fp.dirY = dirY;
  fp.planeX = planeX;
  fp.planeY = planeY;

  // ── NPC Dialog System ──
  if (fp.dialogState?.active) {
    // Dialog is open — shoot key advances dialog
    if (keys.shoot && fp.gunCooldown <= 0) {
      fp.gunCooldown = 15; // Debounce
      const ds = fp.dialogState;
      if (ds.shopOpen) {
        // Shop is open — shoot closes it
        ds.shopOpen = false;
      } else if (ds.currentLine < ds.lines.length - 1) {
        ds.currentLine++;
      } else {
        // End of dialog — open shop if merchant, otherwise close
        const npc = fp.npcs.find((n) => n.id === ds.npcId);
        if (npc?.type === "merchant" && npc.shopItems && !npc.interacted) {
          ds.shopOpen = true;
          ds.shopItems = npc.shopItems;
          npc.interacted = true;
        } else {
          fp.dialogState = null;
          if (npc) npc.interacted = true;
        }
      }
    }
    if (fp.gunCooldown > 0) fp.gunCooldown--;
    gs.player.bankDir = 0;
    return; // Don't process movement/combat while in dialog
  }

  // ── NPC Interaction (press shoot near NPC) ──
  if (fp.npcs && keys.shoot && fp.gunCooldown <= 0) {
    const NPC_INTERACT_RANGE = 2.0;
    for (const npc of fp.npcs) {
      const dx = npc.x - posX;
      const dy = npc.y - posY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < NPC_INTERACT_RANGE) {
        // Check if roughly facing the NPC
        const dot = dx * dirX + dy * dirY;
        if (dot > 0) { // NPC is in front of us
          fp.dialogState = {
            active: true,
            npcId: npc.id,
            lines: npc.dialog,
            currentLine: 0,
            shopOpen: false,
            shopItems: npc.shopItems,
          };
          fp.gunCooldown = 15;
          gs.audioEvents.push(AudioEvent.DIALOG_ADVANCE);
          gs.player.bankDir = 0;
          return; // Skip shooting this frame
        }
      }
    }
  }

  // ── Shooting ──
  if (fp.gunCooldown > 0) fp.gunCooldown--;
  if (fp.gunFireTimer > 0) fp.gunFireTimer--;

  if (keys.shoot && fp.gunCooldown <= 0) {
    fp.gunFireTimer = GUN_FLASH_DURATION;
    fp.gunCooldown = GUN_FIRE_RATE;
    gs.audioEvents.push(AudioEvent.PLAYER_SHOOT);

    // Hitscan — check if any enemy is near the center ray
    let closestHit: FPEnemy | null = null;
    let closestDist = BULLET_RANGE;

    for (const enemy of fp.enemies) {
      if (enemy.deathTimer !== 0) continue;

      const dx = enemy.x - posX;
      const dy = enemy.y - posY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > BULLET_RANGE || dist > closestDist) continue;

      // Check if enemy is roughly in crosshair
      // Project enemy onto camera plane
      const invDet = 1.0 / (planeX * dirY - dirX * planeY);
      const transformY = invDet * (-planeY * dx + planeX * dy); // depth
      if (transformY <= 0) continue; // Behind camera

      const transformX = invDet * (dirY * dx - dirX * dy);
      const screenX = Math.floor((CANVAS_WIDTH / 2) * (1 + transformX / transformY));

      // Hit tolerance: enemy must be within ~30% of screen center
      const hitWidth = Math.abs(CANVAS_WIDTH / transformY) * 0.4;
      if (Math.abs(screenX - CANVAS_WIDTH / 2) < hitWidth) {
        // Line of sight check
        if (hasLOS(fp.map, posX, posY, enemy.x, enemy.y)) {
          closestHit = enemy;
          closestDist = dist;
        }
      }
    }

    if (closestHit) {
      // Apply damage with affinity
      let dmg = BULLET_DAMAGE;
      const affinity = resolveAffinity(gs.equippedWeaponType, closestHit.classId);
      dmg *= AFFINITY_MULTIPLIER[affinity];

      if (hasSkill(gs.allocatedSkills, "sharpshooter") && affinity === "effective") {
        dmg *= 1 + getSkillEffect(gs.allocatedSkills, "sharpshooter");
      }
      if (hasSkill(gs.allocatedSkills, "glass-cannon")) {
        dmg *= 1 + getSkillEffect(gs.allocatedSkills, "glass-cannon");
      }

      closestHit.hp -= dmg;
      gs.screenShake = 2;

      // Floating label (in screen space — approximate)
      const label = createAffinityLabel(CANVAS_WIDTH / 2, GAME_AREA_HEIGHT / 2 - 40, affinity);
      if (label) gs.floatingLabels = [...gs.floatingLabels, label];

      if (closestHit.hp <= 0) {
        closestHit.deathTimer = 30; // 0.5s death animation
        gs.score += 200;
        gs.xp += 200;
        gs.kills += 1;
        gs.audioEvents.push(AudioEvent.ENEMY_DESTROY);
      } else {
        gs.audioEvents.push(AudioEvent.BOSS_HIT); // reuse for hit sound
      }
    }
  }

  // ── Enemy AI ──
  for (const enemy of fp.enemies) {
    if (enemy.deathTimer > 0) {
      enemy.deathTimer--;
      if (enemy.deathTimer <= 0) enemy.deathTimer = -1; // Mark for removal
      continue;
    }
    if (enemy.deathTimer < 0) continue; // Dead

    const dx = posX - enemy.x;
    const dy = posY - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Aggro
    if (!enemy.isAggro && dist < ENEMY_AGGRO_RANGE) {
      if (hasLOS(fp.map, enemy.x, enemy.y, posX, posY)) {
        enemy.isAggro = true;
      }
    }

    if (!enemy.isAggro) continue;

    switch (enemy.type) {
      case "grunt":
      case "charger": {
        // Move toward player
        const speed = enemy.type === "charger" ? enemy.speed * 1.5 : enemy.speed;
        const len = dist || 1;
        const mvx = (dx / len) * speed;
        const mvy = (dy / len) * speed;
        const newX = enemy.x + mvx;
        const newY = enemy.y + mvy;
        if (isWalkable(fp.map, newX, enemy.y)) enemy.x = newX;
        if (isWalkable(fp.map, enemy.x, newY)) enemy.y = newY;

        // Contact damage
        if (dist < ENEMY_CONTACT_RANGE && gs.player.invincibleTimer <= 0) {
          gs.player.hp -= ENEMY_CONTACT_DAMAGE;
          gs.player.invincibleTimer = 60;
          gs.screenShake = 5;
          gs.audioEvents.push(AudioEvent.PLAYER_HIT);
          if (gs.player.hp <= 0) {
            gs.lives -= 1;
            gs.deaths += 1;
            if (gs.lives <= 0) {
              gs.screen = GameScreen.GAME_OVER;
              gs.audioEvents.push(AudioEvent.GAME_OVER);
            } else {
              // Respawn
              gs.player.hp = gs.player.maxHp;
              gs.player.invincibleTimer = 90;
              // Find spawn
              for (let r = 0; r < fp.map.height; r++) {
                for (let c = 0; c < fp.map.width; c++) {
                  if (fp.map.tiles[r][c] === "spawn") {
                    fp.posX = c + 0.5;
                    fp.posY = r + 0.5;
                  }
                }
              }
            }
          }
        }
        break;
      }
      case "sentry": {
        // Stationary — shoots at player (TODO: implement projectiles in FP)
        // For now: hitscan damage at interval
        if (enemy.fireTimer > 0) {
          enemy.fireTimer--;
        } else if (dist < SENTRY_FIRE_RANGE && hasLOS(fp.map, enemy.x, enemy.y, posX, posY)) {
          if (gs.player.invincibleTimer <= 0) {
            gs.player.hp -= 1;
            gs.player.invincibleTimer = 40;
            gs.screenShake = 3;
            gs.audioEvents.push(AudioEvent.PLAYER_HIT);
            if (gs.player.hp <= 0) {
              gs.lives -= 1;
              gs.deaths += 1;
              if (gs.lives <= 0) {
                gs.screen = GameScreen.GAME_OVER;
                gs.audioEvents.push(AudioEvent.GAME_OVER);
              } else {
                gs.player.hp = gs.player.maxHp;
                gs.player.invincibleTimer = 90;
              }
            }
          }
          enemy.fireTimer = SENTRY_FIRE_RATE;
          gs.audioEvents.push(AudioEvent.ENEMY_SHOOT);
        }
        break;
      }
    }
  }

  // Remove dead enemies
  fp.enemies = fp.enemies.filter((e) => e.deathTimer !== -1);

  // ── Invincibility ──
  if (gs.player.invincibleTimer > 0) gs.player.invincibleTimer--;

  // ── Objective pickup ──
  if (fp.objectivePickup && !fp.objectiveCollected) {
    const pickupDX = fp.objectivePickup.x - posX;
    const pickupDY = fp.objectivePickup.y - posY;
    if (Math.sqrt(pickupDX * pickupDX + pickupDY * pickupDY) <= OBJECTIVE_PICKUP_RANGE) {
      fp.objectiveCollected = true;
      fp.objectivePickup = undefined;
      fp.goalReached = true;
      gs.xp += 250;
      gs.audioEvents.push(AudioEvent.POWER_UP_COLLECT);
    }
  }

  // ── Goal check ──
  const goalCol = Math.floor(posX);
  const goalRow = Math.floor(posY);
  if (goalCol >= 0 && goalCol < fp.map.width && goalRow >= 0 && goalRow < fp.map.height) {
    if (fp.map.tiles[goalRow][goalCol] === "goal") {
      fp.goalReached = true;
    }
  }

  if (fp.goalReached && gs.levelCompleteTimer === 0) {
    gs.levelCompleteTimer = 360;
    gs.xp += 500;
    gs.audioEvents.push(AudioEvent.LEVEL_COMPLETE);
  }

  gs.player.bankDir = (keys.up || keys.down) ? 1 : 0;
}

export function __runFirstPersonSelfTests(): void {
  const turnedLeft = rotateView({ dirX: 1, dirY: 0, planeX: 0, planeY: 0.66 }, -ROT_SPEED);
  console.assert(turnedLeft.dirY < 0, "Left turn should rotate toward negative Y");

  const turnedRight = rotateView({ dirX: 1, dirY: 0, planeX: 0, planeY: 0.66 }, ROT_SPEED);
  console.assert(turnedRight.dirY > 0, "Right turn should rotate toward positive Y");

  const testMap: BoardingMap = {
    width: 5,
    height: 5,
    tileSize: 32,
    tiles: [
      ["wall", "wall", "wall", "wall", "wall"],
      ["wall", "floor", "floor", "floor", "wall"],
      ["wall", "floor", "floor", "floor", "wall"],
      ["wall", "floor", "floor", "floor", "wall"],
      ["wall", "wall", "wall", "wall", "wall"],
    ],
  };

  const strafeLeft = moveWithCollision(testMap, 2.5, 2.5, 0, -MOVE_SPEED);
  console.assert(strafeLeft.posY < 2.5, "Strafe left should move perpendicular to facing");

  const strafeRight = moveWithCollision(testMap, 2.5, 2.5, 0, MOVE_SPEED);
  console.assert(strafeRight.posY > 2.5, "Strafe right should move perpendicular to facing");

  const objectiveState = {
    map: testMap,
    posX: 2.5,
    posY: 2.5,
    dirX: 1,
    dirY: 0,
    planeX: 0,
    planeY: 0.66,
    moveSpeed: MOVE_SPEED,
    rotSpeed: ROT_SPEED,
    goalReached: false,
    objectivePickup: { x: 2.6, y: 2.5, label: "TEST" },
    objectiveCollected: false,
    enemies: [],
    gunFireTimer: 0,
    gunCooldown: 0,
  };
  const objectiveGame = {
    firstPersonState: objectiveState,
    levelCompleteTimer: 0,
    player: { invincibleTimer: 0, bankDir: 0 },
    xp: 0,
    audioEvents: [],
  } as unknown as GameState;
  updateFirstPerson(objectiveGame, {
    left: false,
    right: false,
    up: false,
    down: false,
    strafeLeft: false,
    strafeRight: false,
    shoot: false,
    bomb: false,
    jump: false,
  });
  console.assert(objectiveState.objectiveCollected, "Objective pickup should collect when player is within range");
  console.assert(objectiveState.goalReached, "Objective pickup should mark the mission complete");
}

if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
  __runFirstPersonSelfTests();
}

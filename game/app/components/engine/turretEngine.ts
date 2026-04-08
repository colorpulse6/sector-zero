import type { GameState, Keys, TurretState, TurretEnemy } from "./types";
import { GameScreen, AudioEvent, CANVAS_WIDTH, GAME_AREA_HEIGHT } from "./types";
import { resolveAffinity } from "./enemyClasses";
import { AFFINITY_MULTIPLIER } from "./weaponTypes";
import { createAffinityLabel } from "./floatingLabels";
import { hasSkill, getSkillEffect } from "./skillTree";
import { createSpriteExplosion } from "./particles";

// ─── Constants ──────────────────────────────────────────────────────

const CROSSHAIR_SPEED = 0.012;  // Normalized per frame
const FIRE_COOLDOWN = 8;        // Frames between shots
const HIT_RADIUS = 0.06;        // Crosshair hit tolerance (normalized)
const DAMAGE_ON_REACH = 1;      // HP lost when enemy reaches z=0
const WAVE_DELAY = 180;         // Frames between waves (3s)
const SPAWN_INTERVAL = 30;      // Frames between spawns within a wave

let turretEnemyId = 0;

// ─── Wave Definitions ───────────────────────────────────────────────

interface WaveDef {
  enemies: Array<{ type: TurretEnemy["type"]; count: number }>;
}

const WAVES: WaveDef[] = [
  { enemies: [{ type: "drone", count: 4 }] },
  { enemies: [{ type: "fighter", count: 3 }, { type: "drone", count: 2 }] },
  { enemies: [{ type: "fighter", count: 4 }, { type: "drone", count: 3 }] },
  { enemies: [{ type: "bomber", count: 2 }, { type: "fighter", count: 3 }] },
  { enemies: [{ type: "bomber", count: 3 }, { type: "fighter", count: 4 }, { type: "drone", count: 4 }] },
];

// ─── Enemy Templates ────────────────────────────────────────────────

function createTurretEnemy(type: TurretEnemy["type"]): TurretEnemy {
  // Spawn from random edge position, far away
  const angle = Math.random() * Math.PI * 2;
  const spawnRadius = 0.4 + Math.random() * 0.2;

  const base = {
    id: ++turretEnemyId,
    x: 0.5 + Math.cos(angle) * spawnRadius,
    y: 0.5 + Math.sin(angle) * spawnRadius,
    z: 1.0 + Math.random() * 0.3, // Start beyond far plane
    // Drift toward center with some randomness
    vx: (0.5 - (0.5 + Math.cos(angle) * spawnRadius)) * 0.002 + (Math.random() - 0.5) * 0.001,
    vy: (0.5 - (0.5 + Math.sin(angle) * spawnRadius)) * 0.002 + (Math.random() - 0.5) * 0.001,
  };

  switch (type) {
    case "drone":
      return { ...base, speed: 0.008 + Math.random() * 0.003, hp: 1, maxHp: 1, type, classId: "tech-drone", score: 100 };
    case "fighter":
      return { ...base, speed: 0.005 + Math.random() * 0.002, hp: 2, maxHp: 2, type, classId: "armored", score: 200 };
    case "bomber":
      return { ...base, speed: 0.003 + Math.random() * 0.001, hp: 4, maxHp: 4, type, classId: "heavy-mech", score: 400 };
  }
}

// ─── State Creation ─────────────────────────────────────────────────

export function createTurretState(): TurretState {
  turretEnemyId = 0;
  return {
    crosshairX: 0.5,
    crosshairY: 0.5,
    enemies: [],
    shipHp: 10,
    shipMaxHp: 10,
    wave: 0,
    totalWaves: WAVES.length,
    waveTimer: 120, // 2s before first wave
    spawnTimer: 0,
    enemiesRemaining: 0,
    killCount: 0,
    targetKills: 0,
    completed: false,
    fireCooldown: 0,
    bolts: [],
  };
}

let boltIdCounter = 0;

// ─── Main Update ────────────────────────────────────────────────────

export function updateTurretEngine(gs: GameState, keys: Keys): void {
  const ts = gs.turretState;
  if (!ts || ts.completed || gs.levelCompleteTimer > 0) return;

  // ── Crosshair movement ──
  if (keys.left) ts.crosshairX -= CROSSHAIR_SPEED;
  if (keys.right) ts.crosshairX += CROSSHAIR_SPEED;
  if (keys.up) ts.crosshairY -= CROSSHAIR_SPEED;
  if (keys.down) ts.crosshairY += CROSSHAIR_SPEED;
  ts.crosshairX = Math.max(0.05, Math.min(0.95, ts.crosshairX));
  ts.crosshairY = Math.max(0.05, Math.min(0.95, ts.crosshairY));

  // ── Shooting ──
  if (ts.fireCooldown > 0) ts.fireCooldown--;

  if (keys.shoot && ts.fireCooldown <= 0) {
    ts.fireCooldown = FIRE_COOLDOWN;
    gs.audioEvents.push(AudioEvent.PLAYER_SHOOT);
    gs.screenShake = 1;

    // Spawn visible laser bolt from center toward crosshair
    ts.bolts.push({
      id: ++boltIdCounter,
      x: 0.5,
      y: 0.5,
      z: 0,
      targetX: ts.crosshairX,
      targetY: ts.crosshairY,
      speed: 0.08,
      life: 20,
    });

    // Find closest enemy near crosshair
    let bestEnemy: TurretEnemy | null = null;
    let bestDist = HIT_RADIUS;

    for (const e of ts.enemies) {
      if (e.z <= 0) continue;
      // Project enemy to screen space based on depth
      const projX = 0.5 + (e.x - 0.5) / e.z;
      const projY = 0.5 + (e.y - 0.5) / e.z;
      const dx = projX - ts.crosshairX;
      const dy = projY - ts.crosshairY;
      // Hit tolerance scales with distance (farther = harder to hit)
      const tolerance = HIT_RADIUS + (1 - e.z) * 0.03;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < tolerance && dist < bestDist) {
        bestEnemy = e;
        bestDist = dist;
      }
    }

    if (bestEnemy) {
      let dmg = 1;
      const affinity = resolveAffinity(gs.equippedWeaponType, bestEnemy.classId);
      dmg *= AFFINITY_MULTIPLIER[affinity];

      if (hasSkill(gs.allocatedSkills, "sharpshooter") && affinity === "effective") {
        dmg *= 1 + getSkillEffect(gs.allocatedSkills, "sharpshooter");
      }
      if (hasSkill(gs.allocatedSkills, "glass-cannon")) {
        dmg *= 1 + getSkillEffect(gs.allocatedSkills, "glass-cannon");
      }

      bestEnemy.hp -= dmg;

      const labelX = ts.crosshairX * CANVAS_WIDTH;
      const labelY = ts.crosshairY * GAME_AREA_HEIGHT - 20;
      const label = createAffinityLabel(labelX, labelY, affinity);
      if (label) gs.floatingLabels = [...gs.floatingLabels, label];

      if (bestEnemy.hp <= 0) {
        gs.score += bestEnemy.score;
        gs.xp += bestEnemy.score;
        gs.kills += 1;
        ts.killCount += 1;
        gs.audioEvents.push(AudioEvent.ENEMY_DESTROY);

        // Explosion at screen position
        const projX = 0.5 + (bestEnemy.x - 0.5) / bestEnemy.z;
        const projY = 0.5 + (bestEnemy.y - 0.5) / bestEnemy.z;
        gs.explosions = [...gs.explosions,
          createSpriteExplosion(projX * CANVAS_WIDTH, projY * GAME_AREA_HEIGHT, 60 / bestEnemy.z)
        ];
      }
    }
  }

  // ── Update enemies ──
  const alive: TurretEnemy[] = [];
  for (const e of ts.enemies) {
    if (e.hp <= 0) continue;

    // Approach camera
    e.z -= e.speed;
    e.x += e.vx;
    e.y += e.vy;

    // Slight weaving for fighters
    if (e.type === "fighter") {
      e.vx += (Math.random() - 0.5) * 0.0005;
      e.vy += (Math.random() - 0.5) * 0.0005;
    }

    // Drones are jittery
    if (e.type === "drone") {
      e.x += (Math.random() - 0.5) * 0.003;
      e.y += (Math.random() - 0.5) * 0.003;
    }

    if (e.z <= 0) {
      // Enemy reached the ship — deal damage
      ts.shipHp -= DAMAGE_ON_REACH;
      gs.screenShake = 6;
      gs.audioEvents.push(AudioEvent.PLAYER_HIT);

      if (ts.shipHp <= 0) {
        gs.screen = GameScreen.GAME_OVER;
        gs.audioEvents.push(AudioEvent.GAME_OVER);
        return;
      }
    } else {
      alive.push(e);
    }
  }
  ts.enemies = alive;

  // ── Update bolts ──
  ts.bolts = ts.bolts
    .map((b) => {
      const dx = b.targetX - 0.5;
      const dy = b.targetY - 0.5;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      return {
        ...b,
        x: b.x + (dx / len) * b.speed * 0.5,
        y: b.y + (dy / len) * b.speed * 0.5,
        z: b.z + b.speed,
        life: b.life - 1,
      };
    })
    .filter((b) => b.life > 0 && b.z < 1.5);

  // ── Wave spawning ──
  if (ts.wave < ts.totalWaves) {
    if (ts.waveTimer > 0) {
      ts.waveTimer--;
    } else if (ts.enemiesRemaining > 0) {
      // Spawn next enemy from current wave
      if (ts.spawnTimer > 0) {
        ts.spawnTimer--;
      } else {
        const waveDef = WAVES[ts.wave];
        // Find next enemy type to spawn
        for (const group of waveDef.enemies) {
          if (group.count > 0) {
            ts.enemies.push(createTurretEnemy(group.type));
            group.count--;
            ts.enemiesRemaining--;
            ts.spawnTimer = SPAWN_INTERVAL;
            break;
          }
        }
      }
    } else if (ts.enemies.length === 0) {
      // Wave cleared — advance
      ts.wave++;
      if (ts.wave < ts.totalWaves) {
        // Reset wave counts
        const waveDef = WAVES[ts.wave];
        ts.enemiesRemaining = waveDef.enemies.reduce((sum, g) => sum + g.count, 0);
        // Clone counts so we can decrement
        WAVES[ts.wave] = {
          enemies: waveDef.enemies.map((g) => ({ ...g })),
        };
        ts.waveTimer = WAVE_DELAY;
      } else {
        // All waves cleared!
        ts.completed = true;
        gs.levelCompleteTimer = 360;
        gs.xp += 1000;
        gs.audioEvents.push(AudioEvent.LEVEL_COMPLETE);
      }
    }
  }

  // Initialize first wave if needed
  if (ts.wave === 0 && ts.enemiesRemaining === 0 && ts.waveTimer <= 0 && !ts.completed) {
    const waveDef = WAVES[0];
    ts.enemiesRemaining = waveDef.enemies.reduce((sum, g) => sum + g.count, 0);
    WAVES[0] = { enemies: waveDef.enemies.map((g) => ({ ...g })) };
  }
}

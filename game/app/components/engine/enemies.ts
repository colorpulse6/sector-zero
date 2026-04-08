import {
  CANVAS_WIDTH,
  GAME_AREA_HEIGHT,
  ENEMY_BULLET_SPEED,
  ENEMY_DEFS,
  EnemyType,
  type EnemyClass,
  type Enemy,
  type EnemyBehavior,
  type Bullet,
  type BulletVariant,
  type Player,
  type FormationType,
} from "./types";
import { getSprite, SPRITES } from "./sprites";
import { DEFAULT_ENEMY_CLASS, ENEMY_CLASS_PROFILES } from "./enemyClasses";

let enemyIdCounter = 0;
let bulletIdCounter = 10000; // offset from player bullets

/** World-based difficulty scaling for planet expansion */
let currentDifficultyScale = { hp: 1, speed: 1, fireRate: 1 };

/** Planet-mission class override. When set, 70% of spawns use this class. */
let currentPlanetClass: EnemyClass | null = null;

export function setPlanetClassOverride(classId: EnemyClass | null): void {
  currentPlanetClass = classId;
}

const WORLD_DIFFICULTY: Record<number, { hp: number; speed: number; fireRate: number }> = {
  1: { hp: 1, speed: 1, fireRate: 1 },
  2: { hp: 1, speed: 1, fireRate: 1 },
  3: { hp: 1, speed: 1, fireRate: 1 },
  4: { hp: 1.15, speed: 1, fireRate: 0.9 },
  5: { hp: 1.15, speed: 1, fireRate: 0.9 },
  6: { hp: 1.25, speed: 1.1, fireRate: 0.85 },
  7: { hp: 1.25, speed: 1.1, fireRate: 0.85 },
  8: { hp: 1.35, speed: 1.15, fireRate: 0.8 },
};

export function setDifficultyForWorld(world: number): void {
  currentDifficultyScale = WORLD_DIFFICULTY[world] ?? { hp: 1, speed: 1, fireRate: 1 };
}

export function resetEnemyIds(): void {
  enemyIdCounter = 0;
  bulletIdCounter = 10000;
}

export function createEnemy(
  type: EnemyType,
  x: number,
  y: number,
  behavior?: EnemyBehavior,
  classOverride?: EnemyClass,
): Enemy {
  const def = ENEMY_DEFS[type];
  const defaultBehavior = getDefaultBehavior(type);

  const classId = classOverride
    ?? (currentPlanetClass && Math.random() < 0.7
      ? currentPlanetClass
      : DEFAULT_ENEMY_CLASS[type]);
  const classProfile = ENEMY_CLASS_PROFILES[classId];

  const scaledHp = Math.max(1, Math.ceil(
    def.hp * currentDifficultyScale.hp * classProfile.hpMult
  ));
  const scaledSpeed = def.speed * currentDifficultyScale.speed * classProfile.speedMult;
  const scaledFireRate = Math.max(10, Math.floor(
    def.fireRate * currentDifficultyScale.fireRate * classProfile.fireRateMult
  ));
  const scaledScore = Math.floor(def.score * classProfile.scoreMult);

  return {
    id: ++enemyIdCounter,
    type,
    x,
    y,
    width: def.width,
    height: def.height,
    hp: scaledHp,
    maxHp: scaledHp,
    speed: scaledSpeed,
    vx: 0,
    vy: scaledSpeed,
    score: scaledScore,
    fireTimer: Math.floor(Math.random() * scaledFireRate),
    fireRate: scaledFireRate,
    shoots: def.shoots,
    behavior: behavior ?? defaultBehavior,
    behaviorTimer: 0,
    cloaked: type === EnemyType.CLOAKER || type === EnemyType.ECHO,
    classId,
    lastHitAffinity: undefined,
    lastHitTimer: 0,
  };
}

function getDefaultBehavior(type: EnemyType): EnemyBehavior {
  switch (type) {
    case EnemyType.SCOUT: return "formation";
    case EnemyType.DRONE: return "zigzag";
    case EnemyType.GUNNER: return "formation";
    case EnemyType.SHIELDER: return "formation";
    case EnemyType.BOMBER: return "kamikaze";
    case EnemyType.SWARM: return "chase";
    case EnemyType.TURRET: return "static";
    case EnemyType.CLOAKER: return "cloak";
    case EnemyType.ELITE: return "formation";
    case EnemyType.MINE: return "drift";
    case EnemyType.WRAITH: return "formation";
    case EnemyType.ECHO: return "phase";
    case EnemyType.MIRROR: return "mirror";
    default: return "formation";
  }
}

export function spawnFormation(
  type: EnemyType,
  count: number,
  formation: FormationType,
  spawnY: number = -60
): Enemy[] {
  const enemies: Enemy[] = [];
  const def = ENEMY_DEFS[type];
  const centerX = CANVAS_WIDTH / 2;

  switch (formation) {
    case "line":
      for (let i = 0; i < count; i++) {
        const totalWidth = count * (def.width + 12);
        const startX = centerX - totalWidth / 2;
        enemies.push(createEnemy(type, startX + i * (def.width + 12), spawnY));
      }
      break;

    case "v-shape":
      for (let i = 0; i < count; i++) {
        const half = Math.floor(count / 2);
        const offset = i - half;
        const x = centerX + offset * (def.width + 8);
        const y = spawnY - Math.abs(offset) * 20;
        enemies.push(createEnemy(type, x, y));
      }
      break;

    case "grid": {
      const cols = Math.ceil(Math.sqrt(count));
      for (let i = 0; i < count; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const totalWidth = cols * (def.width + 12);
        const startX = centerX - totalWidth / 2;
        enemies.push(
          createEnemy(type, startX + col * (def.width + 12), spawnY + row * (def.height + 8))
        );
      }
      break;
    }

    case "scatter":
      for (let i = 0; i < count; i++) {
        const x = 30 + Math.random() * (CANVAS_WIDTH - 60 - def.width);
        const y = spawnY - Math.random() * 80;
        enemies.push(createEnemy(type, x, y));
      }
      break;

    case "single-file":
      for (let i = 0; i < count; i++) {
        enemies.push(createEnemy(type, centerX - def.width / 2, spawnY - i * (def.height + 20)));
      }
      break;

    case "circle":
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const radius = 60;
        const x = centerX + Math.cos(angle) * radius - def.width / 2;
        const y = spawnY + Math.sin(angle) * radius;
        enemies.push(createEnemy(type, x, y));
      }
      break;
  }

  return enemies;
}

export function updateEnemy(enemy: Enemy, player: Player): Enemy {
  const updated = { ...enemy, behaviorTimer: enemy.behaviorTimer + 1 };

  switch (updated.behavior) {
    case "formation":
      // Drift down slowly, slight horizontal sway
      updated.vy = updated.speed * 0.5;
      updated.vx = Math.sin(updated.behaviorTimer * 0.03) * updated.speed * 0.5;
      break;

    case "zigzag":
      updated.vy = updated.speed;
      updated.vx = Math.sin(updated.behaviorTimer * 0.08) * updated.speed * 2;
      break;

    case "dive":
      updated.vy = updated.speed * 2;
      updated.vx = 0;
      break;

    case "chase": {
      const dx = (player.x + player.width / 2) - (updated.x + updated.width / 2);
      const dy = (player.y + player.height / 2) - (updated.y + updated.height / 2);
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      updated.vx = (dx / dist) * updated.speed;
      updated.vy = (dy / dist) * updated.speed;
      break;
    }

    case "kamikaze": {
      const dx = (player.x + player.width / 2) - (updated.x + updated.width / 2);
      const dy = (player.y + player.height / 2) - (updated.y + updated.height / 2);
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      updated.vx = (dx / dist) * updated.speed * 1.2;
      updated.vy = (dy / dist) * updated.speed * 1.2;
      break;
    }

    case "static":
      updated.vx = 0;
      updated.vy = updated.speed * 0.3;
      break;

    case "cloak":
      updated.vy = updated.speed * 0.5;
      updated.vx = Math.sin(updated.behaviorTimer * 0.04) * updated.speed;
      // Toggle cloak every ~2 seconds
      if (updated.behaviorTimer % 120 === 0) {
        updated.cloaked = !updated.cloaked;
      }
      break;

    case "drift":
      updated.vy = updated.speed * 0.3;
      updated.vx = Math.sin(updated.behaviorTimer * 0.02) * 0.5;
      break;

    case "orbit":
      updated.vx = Math.cos(updated.behaviorTimer * 0.04) * updated.speed * 1.5;
      updated.vy = Math.sin(updated.behaviorTimer * 0.04) * updated.speed * 0.5 + 0.3;
      break;

    case "phase":
      // Echo: drift down with sway, toggle between visible/ghosted every 90 frames
      updated.vy = updated.speed * 0.6;
      updated.vx = Math.sin(updated.behaviorTimer * 0.05) * updated.speed * 0.8;
      if (updated.behaviorTimer % 90 === 0) {
        updated.cloaked = !updated.cloaked;
      }
      break;

    case "mirror":
      // Mirror: formation-style drift but with slight evasive jitter
      updated.vy = updated.speed * 0.5;
      updated.vx = Math.sin(updated.behaviorTimer * 0.06) * updated.speed * 1.2;
      // Slight random jitter to simulate evasion
      if (updated.behaviorTimer % 30 === 0) {
        updated.vx += (Math.random() - 0.5) * updated.speed;
      }
      break;
  }

  updated.x += updated.vx;
  updated.y += updated.vy;

  if (updated.lastHitTimer > 0) {
    updated.lastHitTimer -= 1;
    if (updated.lastHitTimer === 0) {
      updated.lastHitAffinity = undefined;
    }
  }

  return updated;
}

export function enemyShouldFire(enemy: Enemy): boolean {
  if (!enemy.shoots || enemy.cloaked) return false;
  return enemy.fireTimer <= 0;
}

// Map enemy behavior to bullet visual variant
const BEHAVIOR_BULLET_VARIANT: Partial<Record<EnemyBehavior, BulletVariant>> = {
  cloak: "bolt",
  phase: "bolt",
  mirror: "bolt",
  orbit: "fire",
  static: "fire",
  kamikaze: "acid",
  drift: "acid",
};

export function fireEnemyBullet(enemy: Enemy, player: Player): Bullet[] {
  const cx = enemy.x + enemy.width / 2;
  const cy = enemy.y + enemy.height;

  const dx = (player.x + player.width / 2) - cx;
  const dy = (player.y + player.height / 2) - cy;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;

  return [
    {
      id: ++bulletIdCounter,
      x: cx - 3,
      y: cy,
      vx: (dx / dist) * ENEMY_BULLET_SPEED,
      vy: (dy / dist) * ENEMY_BULLET_SPEED,
      width: 6,
      height: 6,
      damage: 1,
      isPlayer: false,
      piercing: false,
      variant: BEHAVIOR_BULLET_VARIANT[enemy.behavior] ?? "orb",
    },
  ];
}

export function isEnemyOffscreen(enemy: Enemy): boolean {
  return (
    enemy.y > GAME_AREA_HEIGHT + 50 ||
    enemy.y < -200 ||
    enemy.x < -100 ||
    enemy.x > CANVAS_WIDTH + 100
  );
}

// ─── Sprite map ──────────────────────────────────────────────────────

export const ENEMY_SPRITE_MAP: Record<EnemyType, string> = {
  [EnemyType.SCOUT]: SPRITES.ENEMY_SCOUT,
  [EnemyType.DRONE]: SPRITES.ENEMY_DRONE,
  [EnemyType.GUNNER]: SPRITES.ENEMY_GUNNER,
  [EnemyType.SHIELDER]: SPRITES.ENEMY_SHIELDER,
  [EnemyType.BOMBER]: SPRITES.ENEMY_BOMBER,
  [EnemyType.SWARM]: SPRITES.ENEMY_SWARM,
  [EnemyType.TURRET]: SPRITES.ENEMY_TURRET,
  [EnemyType.CLOAKER]: SPRITES.ENEMY_CLOAKER,
  [EnemyType.ELITE]: SPRITES.ENEMY_ELITE,
  [EnemyType.MINE]: SPRITES.ENEMY_MINE,
  [EnemyType.WRAITH]: SPRITES.ENEMY_WRAITH,
  [EnemyType.ECHO]: SPRITES.ENEMY_ECHO,
  [EnemyType.MIRROR]: SPRITES.ENEMY_MIRROR,
};

export function drawEnemies(
  ctx: CanvasRenderingContext2D,
  enemies: Enemy[]
): void {
  for (const enemy of enemies) {
    if (enemy.cloaked) {
      ctx.globalAlpha = 0.15;
    }

    ctx.save();

    const spritePath = ENEMY_SPRITE_MAP[enemy.type];
    const sprite = spritePath ? getSprite(spritePath) : null;

    const pad = 4;
    const dx = enemy.x - pad;
    const dy = enemy.y - pad;
    const dw = enemy.width + pad * 2;
    const dh = enemy.height + pad * 2;

    if (sprite) {
      ctx.drawImage(sprite, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = "#aa44ff";
      ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
    }

    // Class tint overlay (subtle multiply blend)
    const classProfile = ENEMY_CLASS_PROFILES[enemy.classId];
    if (classProfile) {
      const baseAlpha = enemy.cloaked ? 0.15 : 1;
      ctx.globalCompositeOperation = "multiply";
      ctx.globalAlpha = baseAlpha * 0.35;
      ctx.fillStyle = classProfile.tint;
      ctx.fillRect(dx, dy, dw, dh);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = baseAlpha;
    }

    ctx.restore();

    // HP bar
    if (enemy.maxHp > 1 && enemy.hp < enemy.maxHp) {
      const barW = enemy.width;
      const barH = 3;
      const barX = enemy.x;
      const barY = enemy.y - 6;
      ctx.fillStyle = "#333";
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = "#ff3333";
      ctx.fillRect(barX, barY, barW * (enemy.hp / enemy.maxHp), barH);
    }

    // Affinity indicator (arrow above enemy after hit)
    if (enemy.lastHitAffinity && enemy.lastHitTimer > 0 && enemy.lastHitAffinity !== "neutral") {
      const arrow = enemy.lastHitAffinity === "effective" ? "\u2B06" : "\u2B07";
      const color = enemy.lastHitAffinity === "effective" ? "#ffdd44" : "#888899";
      const alpha = Math.min(1, enemy.lastHitTimer / 60);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(arrow, enemy.x + enemy.width / 2, enemy.y - 10);
      ctx.restore();
    }

    ctx.globalAlpha = 1;
  }
}

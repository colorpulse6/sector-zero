import {
  CANVAS_WIDTH,
  GAME_AREA_HEIGHT,
  type Bullet,
  type Collectible,
  type DefendStructure,
  type Enemy,
  type EscortEntity,
  type ObjectiveState,
  type ObjectiveType,
  type Player,
} from "./types";

// ─── Objective Factory ──────────────────────────────────────────────

let nextCollectibleId = 1;

export function createObjectiveState(
  type: ObjectiveType,
  value: number
): ObjectiveState {
  return {
    type,
    progress: 0,
    target: value,
    entityHp: type === "escort" || type === "defend" ? value : 0,
    entityMaxHp: type === "escort" || type === "defend" ? value : 0,
    intensityTier: 0,
    collectibles: [],
    completed: false,
    failed: false,
  };
}

// ─── Escort Entity ──────────────────────────────────────────────────

const ESCORT_WAYPOINTS: { x: number; y: number }[] = [
  { x: CANVAS_WIDTH / 2, y: GAME_AREA_HEIGHT - 80 },
  { x: 100, y: GAME_AREA_HEIGHT * 0.6 },
  { x: CANVAS_WIDTH - 100, y: GAME_AREA_HEIGHT * 0.45 },
  { x: CANVAS_WIDTH / 2, y: GAME_AREA_HEIGHT * 0.3 },
  { x: 120, y: GAME_AREA_HEIGHT * 0.15 },
  { x: CANVAS_WIDTH / 2, y: -60 }, // exit top
];

export function createEscortEntity(maxHp: number): EscortEntity {
  const start = ESCORT_WAYPOINTS[0];
  return {
    x: start.x,
    y: GAME_AREA_HEIGHT + 40, // start offscreen bottom
    width: 40,
    height: 40,
    hp: maxHp,
    maxHp,
    speed: 0.8,
    waypointIndex: 0,
  };
}

export function updateEscort(escort: EscortEntity): boolean {
  const wp = ESCORT_WAYPOINTS[escort.waypointIndex];
  if (!wp) return true; // reached end = objective complete

  const dx = wp.x - escort.x;
  const dy = wp.y - escort.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 5) {
    escort.waypointIndex++;
    return escort.waypointIndex >= ESCORT_WAYPOINTS.length;
  }

  escort.x += (dx / dist) * escort.speed;
  escort.y += (dy / dist) * escort.speed;
  return false;
}

/** Check if enemy bullets hit the escort */
export function checkEscortBulletCollisions(
  escort: EscortEntity,
  bullets: Bullet[]
): { hitBullets: number[]; damage: number } {
  const hitBullets: number[] = [];
  let damage = 0;

  for (const b of bullets) {
    if (
      b.x + b.width > escort.x - escort.width / 2 &&
      b.x < escort.x + escort.width / 2 &&
      b.y + b.height > escort.y - escort.height / 2 &&
      b.y < escort.y + escort.height / 2
    ) {
      hitBullets.push(b.id);
      damage += b.damage;
    }
  }

  return { hitBullets, damage };
}

// ─── Defend Structure ───────────────────────────────────────────────

export function createDefendStructure(maxHp: number): DefendStructure {
  return {
    x: CANVAS_WIDTH / 2,
    y: GAME_AREA_HEIGHT / 2 + 40,
    width: 64,
    height: 64,
    hp: maxHp,
    maxHp,
  };
}

/** Check if enemy bullets hit the structure */
export function checkStructureBulletCollisions(
  structure: DefendStructure,
  bullets: Bullet[]
): { hitBullets: number[]; damage: number } {
  const hitBullets: number[] = [];
  let damage = 0;
  const left = structure.x - structure.width / 2;
  const right = structure.x + structure.width / 2;
  const top = structure.y - structure.height / 2;
  const bottom = structure.y + structure.height / 2;

  for (const b of bullets) {
    if (b.x + b.width > left && b.x < right && b.y + b.height > top && b.y < bottom) {
      hitBullets.push(b.id);
      damage += b.damage;
    }
  }

  return { hitBullets, damage };
}

/** Check if enemies collide with the structure (ramming damage) */
export function checkStructureEnemyCollisions(
  structure: DefendStructure,
  enemies: Enemy[]
): number[] {
  const hitEnemies: number[] = [];
  const left = structure.x - structure.width / 2;
  const right = structure.x + structure.width / 2;
  const top = structure.y - structure.height / 2;
  const bottom = structure.y + structure.height / 2;

  for (const e of enemies) {
    const ex = e.x + e.width / 2;
    const ey = e.y + e.height / 2;
    if (ex > left && ex < right && ey > top && ey < bottom) {
      hitEnemies.push(e.id);
    }
  }

  return hitEnemies;
}

// ─── Collectible Spawning ───────────────────────────────────────────

const COLLECTIBLE_SIZE = 20;
const COLLECTIBLE_LIFETIME = 480; // 8 seconds at 60fps
const COLLECTIBLE_SPEED = 0.5;

export function spawnCollectible(): Collectible {
  return {
    id: nextCollectibleId++,
    x: 40 + Math.random() * (CANVAS_WIDTH - 80),
    y: -COLLECTIBLE_SIZE,
    width: COLLECTIBLE_SIZE,
    height: COLLECTIBLE_SIZE,
    vy: COLLECTIBLE_SPEED + Math.random() * 0.5,
    lifetime: COLLECTIBLE_LIFETIME,
    maxLifetime: COLLECTIBLE_LIFETIME,
  };
}

export function updateCollectibles(
  collectibles: Collectible[],
  player: Player
): { remaining: Collectible[]; collected: number } {
  let collected = 0;
  const remaining: Collectible[] = [];

  for (const c of collectibles) {
    c.y += c.vy;
    c.lifetime--;

    // Check player pickup (generous hitbox)
    const px = player.x + player.width / 2;
    const py = player.y + player.height / 2;
    const cx = c.x + c.width / 2;
    const cy = c.y + c.height / 2;
    const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);

    if (dist < 30) {
      collected++;
      continue;
    }

    // Remove if expired or offscreen
    if (c.lifetime <= 0 || c.y > GAME_AREA_HEIGHT + 20) {
      continue;
    }

    remaining.push(c);
  }

  return { remaining, collected };
}

// ─── Master Objective Update ────────────────────────────────────────

export interface ObjectiveUpdateResult {
  objective: ObjectiveState;
  /** Escort entity (if escort mission) */
  escort?: EscortEntity;
  /** Defend structure (if defend mission) */
  structure?: DefendStructure;
}

/** How often to spawn collectibles (in frames) */
const COLLECT_SPAWN_INTERVAL = 90; // every 1.5s

/** Survive: intensity escalation thresholds (in seconds) */
const SURVIVE_TIERS = [0, 30, 60, 90, 120, 150];

export function updateObjective(
  objective: ObjectiveState,
  frameCount: number,
  player: Player,
  enemyBullets: Bullet[],
  enemies: Enemy[],
  escort?: EscortEntity,
  structure?: DefendStructure
): ObjectiveUpdateResult {
  if (objective.completed || objective.failed) {
    return { objective, escort, structure };
  }

  const updated = { ...objective };

  switch (updated.type) {
    case "collect": {
      // Spawn collectibles periodically
      if (frameCount % COLLECT_SPAWN_INTERVAL === 0) {
        updated.collectibles = [...updated.collectibles, spawnCollectible()];
      }

      // Update collectibles & check pickups
      const { remaining, collected } = updateCollectibles(updated.collectibles, player);
      updated.collectibles = remaining;
      updated.progress += collected;

      if (updated.progress >= updated.target) {
        updated.completed = true;
      }
      break;
    }

    case "survive": {
      // Progress is in frames, target is in seconds
      updated.progress++;
      const seconds = updated.progress / 60;

      // Update intensity tier
      for (let i = SURVIVE_TIERS.length - 1; i >= 0; i--) {
        if (seconds >= SURVIVE_TIERS[i]) {
          updated.intensityTier = i;
          break;
        }
      }

      if (seconds >= updated.target) {
        updated.completed = true;
      }
      break;
    }

    case "escort": {
      if (escort) {
        const reached = updateEscort(escort);
        if (reached) {
          updated.completed = true;
        }

        // Check bullet damage to escort
        const { hitBullets, damage } = checkEscortBulletCollisions(escort, enemyBullets);
        if (damage > 0) {
          escort.hp = Math.max(0, escort.hp - damage);
          updated.entityHp = escort.hp;
          // Remove hit bullets from the array (caller must handle)
        }

        if (escort.hp <= 0) {
          updated.failed = true;
        }

        // Store hit bullet IDs for caller to remove
        if (hitBullets.length > 0) {
          (updated as ObjectiveState & { _hitBulletIds?: number[] })._hitBulletIds = hitBullets;
        }
      }
      break;
    }

    case "defend": {
      if (structure) {
        // Check bullet damage to structure
        const bulletResult = checkStructureBulletCollisions(structure, enemyBullets);
        if (bulletResult.damage > 0) {
          structure.hp = Math.max(0, structure.hp - bulletResult.damage);
          updated.entityHp = structure.hp;
        }

        // Check enemy ramming damage
        const ramEnemies = checkStructureEnemyCollisions(structure, enemies);
        if (ramEnemies.length > 0) {
          structure.hp = Math.max(0, structure.hp - ramEnemies.length);
          updated.entityHp = structure.hp;
        }

        if (structure.hp <= 0) {
          updated.failed = true;
        }

        // Store IDs for caller cleanup
        const allHitBullets = bulletResult.hitBullets;
        if (allHitBullets.length > 0 || ramEnemies.length > 0) {
          (updated as ObjectiveState & { _hitBulletIds?: number[]; _hitEnemyIds?: number[] })._hitBulletIds = allHitBullets;
          (updated as ObjectiveState & { _hitEnemyIds?: number[] })._hitEnemyIds = ramEnemies;
        }
      }
      break;
    }
  }

  return { objective: updated, escort, structure };
}

// ─── Rendering Helpers ──────────────────────────────────────────────

export function getObjectiveHudText(objective: ObjectiveState): string {
  switch (objective.type) {
    case "collect":
      return `${objective.progress} / ${objective.target}`;
    case "survive": {
      const elapsed = Math.floor(objective.progress / 60);
      const em = Math.floor(elapsed / 60);
      const es = elapsed % 60;
      const tm = Math.floor(objective.target / 60);
      const ts = Math.floor(objective.target % 60);
      return `${em}:${es.toString().padStart(2, "0")} / ${tm}:${ts.toString().padStart(2, "0")}`;
    }
    case "escort":
    case "defend":
      return `HP: ${objective.entityHp} / ${objective.entityMaxHp}`;
  }
}

export function getObjectiveLabel(type: ObjectiveType): string {
  switch (type) {
    case "collect": return "SALVAGE";
    case "survive": return "SURVIVE";
    case "escort": return "ESCORT";
    case "defend": return "DEFEND";
  }
}

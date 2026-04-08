import {
  CANVAS_WIDTH,
  GAME_AREA_HEIGHT,
  ENEMY_BULLET_SPEED,
  EnemyType,
  AudioEvent,
  type Boss,
  type Bullet,
  type Player,
  type Enemy,
} from "./types";
import { createEnemy } from "./enemies";

// ─── Boss Bullet IDs ────────────────────────────────────────────────
let bossBulletId = 50000;

export function resetBossBulletIds(): void {
  bossBulletId = 50000;
}

// ─── Update Result ──────────────────────────────────────────────────
export interface BossUpdateResult {
  boss: Boss;
  bullets: Bullet[];
  spawnedEnemies: Enemy[];
  audioEvents: AudioEvent[];
}

// ─── Create Rockjaw ─────────────────────────────────────────────────
export function createRockjaw(): Boss {
  return {
    id: 1,
    name: "Rockjaw",
    x: CANVAS_WIDTH / 2 - 128,
    y: -260,
    width: 256,
    height: 256,
    hp: 250,
    maxHp: 250,
    phase: 1,
    maxPhases: 2,
    parts: [
      {
        id: 1,
        x: 0,
        y: 0,
        width: 256,
        height: 256,
        hp: 250,
        maxHp: 250,
        isWeakPoint: false,
        vulnerable: false,
      },
      {
        id: 2,
        x: 80,
        y: 100,
        width: 96,
        height: 80,
        hp: 250,
        maxHp: 250,
        isWeakPoint: true,
        vulnerable: false,
      },
    ],
    fireTimer: 60,
    behaviorTimer: 0,
    defeated: false,
    velocityX: 1.5,
    velocityY: 0,
    mouthOpen: false,
    mouthTimer: 150,
    chargeState: "none",
    chargeTimer: 0,
    spawnTimer: 240,
  };
}

// ─── Check Defeated ─────────────────────────────────────────────────
export function isBossDefeated(boss: Boss): boolean {
  return boss.hp <= 0;
}

// ─── Update Boss ────────────────────────────────────────────────────
export function updateBoss(
  boss: Boss,
  player: Player,
  frameCount: number
): BossUpdateResult {
  const b = { ...boss, behaviorTimer: boss.behaviorTimer + 1 };
  const bullets: Bullet[] = [];
  const spawnedEnemies: Enemy[] = [];
  const audioEvents: AudioEvent[] = [];

  // ── Entrance animation ──────────────────────────────────────────
  if (b.y < 40) {
    b.y += 2.5;
    return { boss: b, bullets, spawnedEnemies, audioEvents };
  }

  // ── Phase check ─────────────────────────────────────────────────
  if (b.hp <= b.maxHp * 0.5 && b.phase === 1) {
    b.phase = 2;
    b.mouthOpen = true;
    b.velocityX = b.velocityX > 0 ? 2.5 : -2.5;
    audioEvents.push(AudioEvent.BOSS_PHASE);
  }

  // ── Mouth cycle (Phase 1 only) ─────────────────────────────────
  if (b.phase === 1) {
    b.mouthTimer -= 1;
    if (b.mouthTimer <= 0) {
      b.mouthOpen = !b.mouthOpen;
      // Shorter vulnerability window, longer closed
      b.mouthTimer = b.mouthOpen ? 90 : 200;
    }
  }

  // Update weak point vulnerability
  const updatedParts = b.parts.map((p) =>
    p.isWeakPoint ? { ...p, vulnerable: b.mouthOpen } : p
  );
  b.parts = updatedParts;

  // ── Charge attack (Phase 2 only) ───────────────────────────────
  if (b.phase === 2) {
    b.chargeTimer -= 1;

    switch (b.chargeState) {
      case "none":
        if (b.chargeTimer <= 0) {
          b.chargeState = "winding";
          b.chargeTimer = 60;
        }
        break;

      case "winding":
        // Shake in place
        b.x += (Math.random() - 0.5) * 4;
        if (b.chargeTimer <= 0) {
          b.chargeState = "charging";
          b.chargeTimer = 90;
          // Aim at player's X
          const targetX = player.x + player.width / 2 - b.width / 2;
          b.velocityX = targetX > b.x ? 8 : -8;
          b.velocityY = 2;
        }
        break;

      case "charging":
        b.x += b.velocityX;
        b.y += b.velocityY;
        if (b.chargeTimer <= 0) {
          b.chargeState = "recovering";
          b.chargeTimer = 60;
          b.velocityY = -2;
        }
        break;

      case "recovering":
        // Return to top
        b.y += b.velocityY;
        if (b.y <= 40) {
          b.y = 40;
          b.velocityY = 0;
        }
        if (b.chargeTimer <= 0) {
          b.chargeState = "none";
          b.chargeTimer = 300;
          b.velocityX = 2.5 * (Math.random() > 0.5 ? 1 : -1);
        }
        break;
    }
  }

  // ── Movement (skip during charge) ──────────────────────────────
  if (b.phase === 1 || b.chargeState === "none") {
    b.x += b.velocityX;

    // Bounce off edges
    if (b.x <= 10) {
      b.x = 10;
      b.velocityX = Math.abs(b.velocityX);
    } else if (b.x >= CANVAS_WIDTH - b.width - 10) {
      b.x = CANVAS_WIDTH - b.width - 10;
      b.velocityX = -Math.abs(b.velocityX);
    }
  }

  // ── Firing ─────────────────────────────────────────────────────
  b.fireTimer -= 1;
  if (b.fireTimer <= 0) {
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height * 0.7;
    const speed = ENEMY_BULLET_SPEED * 0.8;

    if (b.phase === 1) {
      // 3-way spread + aimed shot
      const angles = [-0.4, 0, 0.4];
      for (const angle of angles) {
        bullets.push({
          id: ++bossBulletId,
          x: cx - 3,
          y: cy,
          vx: Math.sin(angle) * speed,
          vy: Math.cos(angle) * speed,
          width: 8,
          height: 8,
          damage: 1,
          isPlayer: false,
          piercing: false,
        });
      }
      // Aimed shot at player
      const dx = (player.x + player.width / 2) - cx;
      const dy = (player.y + player.height / 2) - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      bullets.push({
        id: ++bossBulletId,
        x: cx - 3,
        y: cy,
        vx: (dx / dist) * speed * 0.9,
        vy: (dy / dist) * speed * 0.9,
        width: 8,
        height: 8,
        damage: 1,
        isPlayer: false,
        piercing: false,
      });
      b.fireTimer = 55;
    } else {
      // 5-way spread + double aimed
      const angles = [-0.6, -0.3, 0, 0.3, 0.6];
      for (const angle of angles) {
        bullets.push({
          id: ++bossBulletId,
          x: cx - 3,
          y: cy,
          vx: Math.sin(angle) * speed,
          vy: Math.cos(angle) * speed,
          width: 8,
          height: 8,
          damage: 1,
          isPlayer: false,
          piercing: false,
        });
      }
      // Two aimed shots at player
      const dx = (player.x + player.width / 2) - cx;
      const dy = (player.y + player.height / 2) - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      for (const offset of [-0.15, 0.15]) {
        bullets.push({
          id: ++bossBulletId,
          x: cx - 3,
          y: cy,
          vx: (dx / dist) * speed + offset * speed,
          vy: (dy / dist) * speed,
          width: 8,
          height: 8,
          damage: 1,
          isPlayer: false,
          piercing: false,
        });
      }
      b.fireTimer = 40;
    }
    audioEvents.push(AudioEvent.ENEMY_SHOOT);
  }

  // ── Minion spawning ────────────────────────────────────────────
  b.spawnTimer -= 1;
  if (b.spawnTimer <= 0) {
    if (b.phase === 1) {
      // Spawn 3 scouts
      for (let i = 0; i < 3; i++) {
        const sx = 40 + Math.random() * (CANVAS_WIDTH - 120);
        spawnedEnemies.push(createEnemy(EnemyType.SCOUT, sx, -40 - i * 25));
      }
      b.spawnTimer = 360;
    } else {
      // Spawn 4 mines + 1 drone
      for (let i = 0; i < 4; i++) {
        const mx = 30 + Math.random() * (CANVAS_WIDTH - 90);
        spawnedEnemies.push(createEnemy(EnemyType.MINE, mx, -30 - i * 20));
      }
      spawnedEnemies.push(createEnemy(EnemyType.DRONE, CANVAS_WIDTH / 2, -80));
      b.spawnTimer = 360;
    }
  }

  // Clamp boss to screen bounds
  b.x = Math.max(-20, Math.min(CANVAS_WIDTH - b.width + 20, b.x));
  b.y = Math.max(-20, Math.min(GAME_AREA_HEIGHT / 2, b.y));

  return { boss: b, bullets, spawnedEnemies, audioEvents };
}

// ─── Create Glacius (World 2 Boss) ──────────────────────────────────
export function createGlacius(): Boss {
  return {
    id: 2,
    name: "Glacius",
    x: CANVAS_WIDTH / 2 - 128,
    y: -260,
    width: 256,
    height: 256,
    hp: 200,
    maxHp: 200,
    phase: 1,
    maxPhases: 2,
    parts: [
      {
        id: 1, x: 0, y: 0, width: 256, height: 256,
        hp: 200, maxHp: 200, isWeakPoint: false, vulnerable: false,
      },
      {
        id: 2, x: 80, y: 80, width: 96, height: 96,
        hp: 200, maxHp: 200, isWeakPoint: true, vulnerable: true,
      },
    ],
    fireTimer: 80,
    behaviorTimer: 0,
    defeated: false,
    velocityX: 0.8,
    velocityY: 0,
    mouthOpen: true, // core always exposed
    mouthTimer: 0,
    chargeState: "none",
    chargeTimer: 0,
    spawnTimer: 360,
  };
}

export function updateGlacius(
  boss: Boss,
  player: Player,
  frameCount: number
): BossUpdateResult {
  const b = { ...boss, behaviorTimer: boss.behaviorTimer + 1 };
  const bullets: Bullet[] = [];
  const spawnedEnemies: Enemy[] = [];
  const audioEvents: AudioEvent[] = [];

  // Entrance
  if (b.y < 40) {
    b.y += 2;
    return { boss: b, bullets, spawnedEnemies, audioEvents };
  }

  // Phase check
  if (b.hp <= 100 && b.phase === 1) {
    b.phase = 2;
    b.velocityX = b.velocityX > 0 ? 1.5 : -1.5;
    audioEvents.push(AudioEvent.BOSS_PHASE);
  }

  // Core always vulnerable
  b.parts = b.parts.map((p) =>
    p.isWeakPoint ? { ...p, vulnerable: true } : p
  );

  // Movement — slow side-to-side
  b.x += b.velocityX;
  if (b.x <= 10) { b.x = 10; b.velocityX = Math.abs(b.velocityX); }
  else if (b.x >= CANVAS_WIDTH - b.width - 10) {
    b.x = CANVAS_WIDTH - b.width - 10;
    b.velocityX = -Math.abs(b.velocityX);
  }

  // Firing
  b.fireTimer -= 1;
  if (b.fireTimer <= 0) {
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height * 0.7;
    const speed = ENEMY_BULLET_SPEED * 0.8;

    if (b.phase === 1) {
      // 3-way ice shard spread
      const angles = [-0.3, 0, 0.3];
      for (const angle of angles) {
        bullets.push({
          id: ++bossBulletId, x: cx - 3, y: cy,
          vx: Math.sin(angle) * speed, vy: Math.cos(angle) * speed,
          width: 8, height: 8, damage: 1, isPlayer: false, piercing: false,
        });
      }
      b.fireTimer = 75;
    } else {
      // Ice wall — horizontal line of bullets
      const count = 7;
      const spacing = (CANVAS_WIDTH - 60) / (count - 1);
      for (let i = 0; i < count; i++) {
        bullets.push({
          id: ++bossBulletId, x: 30 + i * spacing, y: b.y + b.height,
          vx: 0, vy: ENEMY_BULLET_SPEED * 0.6,
          width: 8, height: 8, damage: 1, isPlayer: false, piercing: false,
        });
      }
      b.fireTimer = 75;
    }
    audioEvents.push(AudioEvent.ENEMY_SHOOT);
  }

  // Minion spawning
  b.spawnTimer -= 1;
  if (b.spawnTimer <= 0) {
    if (b.phase === 1) {
      const sx = 40 + Math.random() * (CANVAS_WIDTH - 120);
      spawnedEnemies.push(createEnemy(EnemyType.SHIELDER, sx, -50));
      b.spawnTimer = 480;
    } else {
      for (let i = 0; i < 3; i++) {
        const dx = 30 + Math.random() * (CANVAS_WIDTH - 90);
        spawnedEnemies.push(createEnemy(EnemyType.DRONE, dx, -30 - i * 20));
      }
      b.spawnTimer = 420;
    }
  }

  b.x = Math.max(-20, Math.min(CANVAS_WIDTH - b.width + 20, b.x));
  b.y = Math.max(-20, Math.min(GAME_AREA_HEIGHT / 2, b.y));

  return { boss: b, bullets, spawnedEnemies, audioEvents };
}

// ─── Create Cindermaw (World 3 Boss) ────────────────────────────────
export function createCindermaw(): Boss {
  return {
    id: 3,
    name: "Cindermaw",
    x: CANVAS_WIDTH / 2 - 128,
    y: -260,
    width: 256,
    height: 256,
    hp: 250,
    maxHp: 250,
    phase: 1,
    maxPhases: 2,
    parts: [
      {
        id: 1, x: 0, y: 0, width: 256, height: 256,
        hp: 250, maxHp: 250, isWeakPoint: false, vulnerable: false,
      },
      {
        id: 2, x: 80, y: 100, width: 96, height: 80,
        hp: 250, maxHp: 250, isWeakPoint: true, vulnerable: false,
      },
    ],
    fireTimer: 70,
    behaviorTimer: 0,
    defeated: false,
    velocityX: 1.2,
    velocityY: 0,
    mouthOpen: false,
    mouthTimer: 150,
    chargeState: "none",
    chargeTimer: 0,
    spawnTimer: 300,
  };
}

export function updateCindermaw(
  boss: Boss,
  player: Player,
  frameCount: number
): BossUpdateResult {
  const b = { ...boss, behaviorTimer: boss.behaviorTimer + 1 };
  const bullets: Bullet[] = [];
  const spawnedEnemies: Enemy[] = [];
  const audioEvents: AudioEvent[] = [];

  // Entrance
  if (b.y < 40) {
    b.y += 2;
    return { boss: b, bullets, spawnedEnemies, audioEvents };
  }

  // Phase check
  if (b.hp <= 125 && b.phase === 1) {
    b.phase = 2;
    b.mouthOpen = true;
    b.velocityX = b.velocityX > 0 ? 2 : -2;
    audioEvents.push(AudioEvent.BOSS_PHASE);
  }

  // Mouth cycle (Phase 1)
  if (b.phase === 1) {
    b.mouthTimer -= 1;
    if (b.mouthTimer <= 0) {
      b.mouthOpen = !b.mouthOpen;
      b.mouthTimer = b.mouthOpen ? 100 : 160;
    }
  }

  b.parts = b.parts.map((p) =>
    p.isWeakPoint ? { ...p, vulnerable: b.mouthOpen } : p
  );

  // Phase 2 charge attack
  if (b.phase === 2) {
    b.chargeTimer -= 1;
    switch (b.chargeState) {
      case "none":
        if (b.chargeTimer <= 0) {
          b.chargeState = "winding";
          b.chargeTimer = 50;
        }
        break;
      case "winding":
        b.x += (Math.random() - 0.5) * 5;
        if (b.chargeTimer <= 0) {
          b.chargeState = "charging";
          b.chargeTimer = 80;
          const targetX = player.x + player.width / 2 - b.width / 2;
          b.velocityX = targetX > b.x ? 7 : -7;
          b.velocityY = 2.5;
        }
        break;
      case "charging":
        b.x += b.velocityX;
        b.y += b.velocityY;
        if (b.chargeTimer <= 0) {
          b.chargeState = "recovering";
          b.chargeTimer = 50;
          b.velocityY = -2.5;
        }
        break;
      case "recovering":
        b.y += b.velocityY;
        if (b.y <= 40) { b.y = 40; b.velocityY = 0; }
        if (b.chargeTimer <= 0) {
          b.chargeState = "none";
          b.chargeTimer = 360;
          b.velocityX = 2 * (Math.random() > 0.5 ? 1 : -1);
        }
        break;
    }
  }

  // Movement
  if (b.phase === 1 || b.chargeState === "none") {
    b.x += b.velocityX;
    if (b.x <= 10) { b.x = 10; b.velocityX = Math.abs(b.velocityX); }
    else if (b.x >= CANVAS_WIDTH - b.width - 10) {
      b.x = CANVAS_WIDTH - b.width - 10;
      b.velocityX = -Math.abs(b.velocityX);
    }
  }

  // Firing
  b.fireTimer -= 1;
  if (b.fireTimer <= 0) {
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height * 0.8;
    const speed = ENEMY_BULLET_SPEED * 0.7;

    if (b.phase === 1) {
      // Aimed shot at player + lava bombs
      const dx = player.x + player.width / 2 - cx;
      const dy = player.y + player.height / 2 - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      bullets.push({
        id: ++bossBulletId, x: cx - 3, y: cy,
        vx: (dx / dist) * speed, vy: (dy / dist) * speed,
        width: 10, height: 10, damage: 1, isPlayer: false, piercing: false,
      });
      // Lava bombs (slow-fall)
      bullets.push({
        id: ++bossBulletId, x: cx - 40, y: cy,
        vx: -0.5, vy: speed * 0.4,
        width: 12, height: 12, damage: 1, isPlayer: false, piercing: false,
      });
      bullets.push({
        id: ++bossBulletId, x: cx + 40, y: cy,
        vx: 0.5, vy: speed * 0.4,
        width: 12, height: 12, damage: 1, isPlayer: false, piercing: false,
      });
      b.fireTimer = 70;
    } else {
      // Eruption — burst in 8 directions
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        bullets.push({
          id: ++bossBulletId, x: cx - 3, y: cy,
          vx: Math.sin(angle) * speed, vy: Math.cos(angle) * speed,
          width: 8, height: 8, damage: 1, isPlayer: false, piercing: false,
        });
      }
      b.fireTimer = 60;
    }
    audioEvents.push(AudioEvent.ENEMY_SHOOT);
  }

  // Minion spawning
  b.spawnTimer -= 1;
  if (b.spawnTimer <= 0) {
    if (b.phase === 1) {
      for (let i = 0; i < 2; i++) {
        const bx = 40 + Math.random() * (CANVAS_WIDTH - 120);
        spawnedEnemies.push(createEnemy(EnemyType.BOMBER, bx, -40 - i * 20));
      }
      b.spawnTimer = 420;
    } else {
      const tx = 40 + Math.random() * (CANVAS_WIDTH - 120);
      spawnedEnemies.push(createEnemy(EnemyType.TURRET, tx, -50));
      const bx = 40 + Math.random() * (CANVAS_WIDTH - 120);
      spawnedEnemies.push(createEnemy(EnemyType.BOMBER, bx, -30));
      b.spawnTimer = 400;
    }
  }

  b.x = Math.max(-20, Math.min(CANVAS_WIDTH - b.width + 20, b.x));
  b.y = Math.max(-20, Math.min(GAME_AREA_HEIGHT / 2, b.y));

  return { boss: b, bullets, spawnedEnemies, audioEvents };
}

// ─── Create Revenant (World 4 Boss) ─────────────────────────────────
export function createRevenant(): Boss {
  return {
    id: 4,
    name: "Revenant",
    x: CANVAS_WIDTH / 2 - 128,
    y: -260,
    width: 256,
    height: 256,
    hp: 275,
    maxHp: 275,
    phase: 1,
    maxPhases: 2,
    parts: [
      {
        id: 1, x: 0, y: 0, width: 256, height: 256,
        hp: 275, maxHp: 275, isWeakPoint: false, vulnerable: false,
      },
      {
        // The bridge — exposed only in Phase 2
        id: 2, x: 80, y: 60, width: 96, height: 70,
        hp: 275, maxHp: 275, isWeakPoint: true, vulnerable: false,
      },
    ],
    fireTimer: 80,
    behaviorTimer: 0,
    defeated: false,
    velocityX: 1,
    velocityY: 0,
    mouthOpen: false, // bridge shielded initially
    mouthTimer: 0,
    chargeState: "none",
    chargeTimer: 0,
    spawnTimer: 360,
  };
}

export function updateRevenant(
  boss: Boss,
  player: Player,
  frameCount: number
): BossUpdateResult {
  const b = { ...boss, behaviorTimer: boss.behaviorTimer + 1 };
  const bullets: Bullet[] = [];
  const spawnedEnemies: Enemy[] = [];
  const audioEvents: AudioEvent[] = [];

  // Entrance
  if (b.y < 40) {
    b.y += 2;
    return { boss: b, bullets, spawnedEnemies, audioEvents };
  }

  // Phase check — bridge exposed when Hollow growth consumes hull
  if (b.hp <= 137 && b.phase === 1) {
    b.phase = 2;
    b.mouthOpen = true; // bridge exposed
    b.velocityX = b.velocityX > 0 ? 1.8 : -1.8;
    audioEvents.push(AudioEvent.BOSS_PHASE);
  }

  // Update weak point vulnerability (bridge)
  b.parts = b.parts.map((p) =>
    p.isWeakPoint ? { ...p, vulnerable: b.mouthOpen } : p
  );

  // Movement — side to side, slightly faster in Phase 2
  b.x += b.velocityX;
  if (b.x <= 10) { b.x = 10; b.velocityX = Math.abs(b.velocityX); }
  else if (b.x >= CANVAS_WIDTH - b.width - 10) {
    b.x = CANVAS_WIDTH - b.width - 10;
    b.velocityX = -Math.abs(b.velocityX);
  }

  // Firing
  b.fireTimer -= 1;
  if (b.fireTimer <= 0) {
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height * 0.7;
    const speed = ENEMY_BULLET_SPEED * 0.8;

    if (b.phase === 1) {
      // Human-style weapons — recognizable aimed double-shot
      const dx = player.x + player.width / 2 - cx;
      const dy = player.y + player.height / 2 - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      // Twin cannons (offset left/right)
      bullets.push({
        id: ++bossBulletId, x: cx - 30, y: cy,
        vx: (dx / dist) * speed, vy: (dy / dist) * speed,
        width: 8, height: 8, damage: 1, isPlayer: false, piercing: false,
      });
      bullets.push({
        id: ++bossBulletId, x: cx + 24, y: cy,
        vx: (dx / dist) * speed, vy: (dy / dist) * speed,
        width: 8, height: 8, damage: 1, isPlayer: false, piercing: false,
      });
      b.fireTimer = 70;
    } else {
      // Phase 2: Hollow organic weapons — 5-way spread + aimed
      const angles = [-0.6, -0.3, 0, 0.3, 0.6];
      for (const angle of angles) {
        bullets.push({
          id: ++bossBulletId, x: cx - 3, y: cy,
          vx: Math.sin(angle) * speed, vy: Math.cos(angle) * speed,
          width: 8, height: 8, damage: 1, isPlayer: false, piercing: false,
        });
      }
      // Plus aimed organic shot
      const dx = player.x + player.width / 2 - cx;
      const dy = player.y + player.height / 2 - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      bullets.push({
        id: ++bossBulletId, x: cx - 3, y: cy,
        vx: (dx / dist) * speed * 1.2, vy: (dy / dist) * speed * 1.2,
        width: 10, height: 10, damage: 1, isPlayer: false, piercing: false,
      });
      b.fireTimer = 60;
    }
    audioEvents.push(AudioEvent.ENEMY_SHOOT);
  }

  // Minion spawning
  b.spawnTimer -= 1;
  if (b.spawnTimer <= 0) {
    if (b.phase === 1) {
      // Spawn Wraith escorts (human-style fighters)
      for (let i = 0; i < 2; i++) {
        const sx = 40 + Math.random() * (CANVAS_WIDTH - 120);
        spawnedEnemies.push(createEnemy(EnemyType.WRAITH, sx, -40 - i * 20));
      }
      b.spawnTimer = 420;
    } else {
      // Phase 2: Mixed Hollow + Wraith
      const sx1 = 40 + Math.random() * (CANVAS_WIDTH - 120);
      spawnedEnemies.push(createEnemy(EnemyType.WRAITH, sx1, -40));
      for (let i = 0; i < 2; i++) {
        const sx = 30 + Math.random() * (CANVAS_WIDTH - 90);
        spawnedEnemies.push(createEnemy(EnemyType.DRONE, sx, -30 - i * 20));
      }
      b.spawnTimer = 380;
    }
  }

  b.x = Math.max(-20, Math.min(CANVAS_WIDTH - b.width + 20, b.x));
  b.y = Math.max(-20, Math.min(GAME_AREA_HEIGHT / 2, b.y));

  return { boss: b, bullets, spawnedEnemies, audioEvents };
}

// ─── Create Nyxar (World 5 Boss) ────────────────────────────────────
export function createNyxar(): Boss {
  return {
    id: 5,
    name: "Nyxar",
    x: CANVAS_WIDTH / 2 - 128,
    y: -260,
    width: 256,
    height: 256,
    hp: 300,
    maxHp: 300,
    phase: 1,
    maxPhases: 3,
    parts: [
      {
        id: 1, x: 0, y: 0, width: 256, height: 256,
        hp: 300, maxHp: 300, isWeakPoint: false, vulnerable: false,
      },
      {
        id: 2, x: 80, y: 80, width: 96, height: 96,
        hp: 300, maxHp: 300, isWeakPoint: true, vulnerable: true,
      },
    ],
    fireTimer: 60,
    behaviorTimer: 0,
    defeated: false,
    velocityX: 1,
    velocityY: 0,
    mouthOpen: true, // always vulnerable
    mouthTimer: 240, // used as teleport timer
    chargeState: "none",
    chargeTimer: 0,
    spawnTimer: 400,
  };
}

export function updateNyxar(
  boss: Boss,
  player: Player,
  frameCount: number
): BossUpdateResult {
  const b = { ...boss, behaviorTimer: boss.behaviorTimer + 1 };
  const bullets: Bullet[] = [];
  const spawnedEnemies: Enemy[] = [];
  const audioEvents: AudioEvent[] = [];

  // Entrance
  if (b.y < 40) {
    b.y += 2;
    return { boss: b, bullets, spawnedEnemies, audioEvents };
  }

  // Phase checks
  if (b.hp <= 200 && b.phase === 1) {
    b.phase = 2;
    audioEvents.push(AudioEvent.BOSS_PHASE);
  }
  if (b.hp <= 100 && b.phase === 2) {
    b.phase = 3;
    b.mouthOpen = true;
    audioEvents.push(AudioEvent.BOSS_PHASE);
  }

  b.parts = b.parts.map((p) =>
    p.isWeakPoint ? { ...p, vulnerable: true } : p
  );

  // Teleport mechanic (Phase 1 & 2)
  if (b.phase <= 2) {
    b.mouthTimer -= 1;
    if (b.mouthTimer <= 0) {
      // Teleport to random position
      b.x = 30 + Math.random() * (CANVAS_WIDTH - b.width - 60);
      b.y = 30 + Math.random() * (GAME_AREA_HEIGHT / 3);
      b.mouthTimer = b.phase === 1 ? 180 : 120;
    }
  }

  // Phase 3 — aggressive charge
  if (b.phase === 3) {
    b.chargeTimer -= 1;
    switch (b.chargeState) {
      case "none":
        b.x += b.velocityX;
        if (b.x <= 10) { b.x = 10; b.velocityX = Math.abs(b.velocityX) * 1.5; }
        else if (b.x >= CANVAS_WIDTH - b.width - 10) {
          b.x = CANVAS_WIDTH - b.width - 10;
          b.velocityX = -Math.abs(b.velocityX) * 1.5;
        }
        b.velocityX = Math.max(-3, Math.min(3, b.velocityX));
        if (b.chargeTimer <= 0) {
          b.chargeState = "winding";
          b.chargeTimer = 40;
        }
        break;
      case "winding":
        b.x += (Math.random() - 0.5) * 3;
        if (b.chargeTimer <= 0) {
          b.chargeState = "charging";
          b.chargeTimer = 70;
          const targetX = player.x + player.width / 2 - b.width / 2;
          b.velocityX = targetX > b.x ? 6 : -6;
          b.velocityY = 3;
        }
        break;
      case "charging":
        b.x += b.velocityX;
        b.y += b.velocityY;
        if (b.chargeTimer <= 0) {
          b.chargeState = "recovering";
          b.chargeTimer = 40;
          b.velocityY = -3;
        }
        break;
      case "recovering":
        b.y += b.velocityY;
        if (b.y <= 40) { b.y = 40; b.velocityY = 0; }
        if (b.chargeTimer <= 0) {
          b.chargeState = "none";
          b.chargeTimer = 300;
          b.velocityX = 2 * (Math.random() > 0.5 ? 1 : -1);
        }
        break;
    }
  } else {
    // Normal movement (phases 1-2)
    b.x += b.velocityX;
    if (b.x <= 10) { b.x = 10; b.velocityX = Math.abs(b.velocityX); }
    else if (b.x >= CANVAS_WIDTH - b.width - 10) {
      b.x = CANVAS_WIDTH - b.width - 10;
      b.velocityX = -Math.abs(b.velocityX);
    }
  }

  // Firing
  b.fireTimer -= 1;
  if (b.fireTimer <= 0) {
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height * 0.6;
    const speed = ENEMY_BULLET_SPEED * 0.8;

    if (b.phase === 1) {
      // Tracking bullet aimed at player
      const dx = player.x + player.width / 2 - cx;
      const dy = player.y + player.height / 2 - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      bullets.push({
        id: ++bossBulletId, x: cx - 3, y: cy,
        vx: (dx / dist) * speed, vy: (dy / dist) * speed,
        width: 10, height: 10, damage: 1, isPlayer: false, piercing: false,
      });
      b.fireTimer = 60;
    } else if (b.phase === 2) {
      // Spiral pattern
      const baseAngle = (b.behaviorTimer * 0.1) % (Math.PI * 2);
      for (let i = 0; i < 4; i++) {
        const angle = baseAngle + (i / 4) * Math.PI * 2;
        bullets.push({
          id: ++bossBulletId, x: cx - 3, y: cy,
          vx: Math.sin(angle) * speed, vy: Math.cos(angle) * speed,
          width: 8, height: 8, damage: 1, isPlayer: false, piercing: false,
        });
      }
      b.fireTimer = 50;
    } else {
      // Rapid fire — 6-way burst
      const angles = [-0.8, -0.4, -0.1, 0.1, 0.4, 0.8];
      for (const angle of angles) {
        bullets.push({
          id: ++bossBulletId, x: cx - 3, y: cy,
          vx: Math.sin(angle) * speed * 1.2, vy: Math.cos(angle) * speed * 1.2,
          width: 8, height: 8, damage: 1, isPlayer: false, piercing: false,
        });
      }
      b.fireTimer = 45;
    }
    audioEvents.push(AudioEvent.ENEMY_SHOOT);
  }

  // Minion spawning
  b.spawnTimer -= 1;
  if (b.spawnTimer <= 0) {
    if (b.phase === 1) {
      const sx = 40 + Math.random() * (CANVAS_WIDTH - 120);
      spawnedEnemies.push(createEnemy(EnemyType.CLOAKER, sx, -40));
      b.spawnTimer = 480;
    } else if (b.phase === 2) {
      for (let i = 0; i < 2; i++) {
        const sx = 30 + Math.random() * (CANVAS_WIDTH - 90);
        spawnedEnemies.push(createEnemy(EnemyType.CLOAKER, sx, -30 - i * 20));
      }
      b.spawnTimer = 420;
    } else {
      for (let i = 0; i < 4; i++) {
        const sx = 20 + Math.random() * (CANVAS_WIDTH - 70);
        spawnedEnemies.push(createEnemy(EnemyType.SWARM, sx, -20 - i * 15));
      }
      b.spawnTimer = 360;
    }
  }

  b.x = Math.max(-20, Math.min(CANVAS_WIDTH - b.width + 20, b.x));
  b.y = Math.max(-20, Math.min(GAME_AREA_HEIGHT / 2, b.y));

  return { boss: b, bullets, spawnedEnemies, audioEvents };
}

// ─── Create The Beacon (World 6 Boss) ────────────────────────────────
export function createBeacon(): Boss {
  return {
    id: 6,
    name: "The Beacon",
    x: CANVAS_WIDTH / 2 - 128,
    y: -260,
    width: 256,
    height: 256,
    hp: 325,
    maxHp: 325,
    phase: 1,
    maxPhases: 2,
    parts: [
      {
        id: 1, x: 0, y: 0, width: 256, height: 256,
        hp: 325, maxHp: 325, isWeakPoint: false, vulnerable: false,
      },
      {
        // Signal core — exposed during emission pauses
        id: 2, x: 80, y: 80, width: 96, height: 96,
        hp: 325, maxHp: 325, isWeakPoint: true, vulnerable: false,
      },
    ],
    fireTimer: 90,
    behaviorTimer: 0,
    defeated: false,
    velocityX: 0.5,
    velocityY: 0,
    mouthOpen: false, // core shielded during emission
    mouthTimer: 150, // emission/pause cycle timer
    chargeState: "none",
    chargeTimer: 0,
    spawnTimer: 300,
  };
}

export function updateBeacon(
  boss: Boss,
  player: Player,
  frameCount: number
): BossUpdateResult {
  const b = { ...boss, behaviorTimer: boss.behaviorTimer + 1 };
  const bullets: Bullet[] = [];
  const spawnedEnemies: Enemy[] = [];
  const audioEvents: AudioEvent[] = [];

  // Entrance
  if (b.y < 40) {
    b.y += 2;
    return { boss: b, bullets, spawnedEnemies, audioEvents };
  }

  // Phase check
  if (b.hp <= 162 && b.phase === 1) {
    b.phase = 2;
    b.velocityX = b.velocityX > 0 ? 1 : -1;
    audioEvents.push(AudioEvent.BOSS_PHASE);
  }

  // Emission cycle — core exposed during pauses
  b.mouthTimer -= 1;
  if (b.mouthTimer <= 0) {
    b.mouthOpen = !b.mouthOpen;
    b.mouthTimer = b.mouthOpen ? 120 : (b.phase === 1 ? 150 : 100);
  }

  b.parts = b.parts.map((p) =>
    p.isWeakPoint ? { ...p, vulnerable: b.mouthOpen } : p
  );

  // Slow movement
  b.x += b.velocityX;
  if (b.x <= 10) { b.x = 10; b.velocityX = Math.abs(b.velocityX); }
  else if (b.x >= CANVAS_WIDTH - b.width - 10) {
    b.x = CANVAS_WIDTH - b.width - 10;
    b.velocityX = -Math.abs(b.velocityX);
  }

  // Firing — shockwave rings during emission, aimed shots during pause
  b.fireTimer -= 1;
  if (b.fireTimer <= 0) {
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height * 0.6;
    const speed = ENEMY_BULLET_SPEED * 0.7;

    if (!b.mouthOpen) {
      // Emitting — shockwave ring pattern
      const ringCount = b.phase === 1 ? 8 : 12;
      for (let i = 0; i < ringCount; i++) {
        const angle = (i / ringCount) * Math.PI * 2;
        bullets.push({
          id: ++bossBulletId, x: cx - 3, y: cy,
          vx: Math.sin(angle) * speed, vy: Math.cos(angle) * speed,
          width: 8, height: 8, damage: 1, isPlayer: false, piercing: false,
        });
      }
      b.fireTimer = b.phase === 1 ? 80 : 60;
    } else {
      // Paused/exposed — aimed double shots
      const dx = player.x + player.width / 2 - cx;
      const dy = player.y + player.height / 2 - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      bullets.push({
        id: ++bossBulletId, x: cx - 20, y: cy,
        vx: (dx / dist) * speed, vy: (dy / dist) * speed,
        width: 8, height: 8, damage: 1, isPlayer: false, piercing: false,
      });
      bullets.push({
        id: ++bossBulletId, x: cx + 14, y: cy,
        vx: (dx / dist) * speed, vy: (dy / dist) * speed,
        width: 8, height: 8, damage: 1, isPlayer: false, piercing: false,
      });
      b.fireTimer = 70;
    }
    audioEvents.push(AudioEvent.ENEMY_SHOOT);
  }

  // Minion spawning — summons from temporal rifts
  b.spawnTimer -= 1;
  if (b.spawnTimer <= 0) {
    if (b.phase === 1) {
      // Standard enemies
      for (let i = 0; i < 2; i++) {
        const sx = 40 + Math.random() * (CANVAS_WIDTH - 120);
        spawnedEnemies.push(createEnemy(EnemyType.ECHO, sx, -40 - i * 20));
      }
      b.spawnTimer = 420;
    } else {
      // Phase 2: Echo + Wraith mix
      for (let i = 0; i < 2; i++) {
        const sx = 30 + Math.random() * (CANVAS_WIDTH - 90);
        spawnedEnemies.push(createEnemy(EnemyType.ECHO, sx, -30 - i * 20));
      }
      const wx = 40 + Math.random() * (CANVAS_WIDTH - 120);
      spawnedEnemies.push(createEnemy(EnemyType.WRAITH, wx, -50));
      b.spawnTimer = 360;
    }
  }

  b.x = Math.max(-20, Math.min(CANVAS_WIDTH - b.width + 20, b.x));
  b.y = Math.max(-20, Math.min(GAME_AREA_HEIGHT / 2, b.y));

  return { boss: b, bullets, spawnedEnemies, audioEvents };
}

// ─── Create The Reflection (World 7 Boss) ────────────────────────────
export function createReflection(): Boss {
  return {
    id: 7,
    name: "The Reflection",
    x: CANVAS_WIDTH / 2 - 128,
    y: -260,
    width: 256,
    height: 256,
    hp: 350,
    maxHp: 350,
    phase: 1,
    maxPhases: 3,
    parts: [
      {
        id: 1, x: 0, y: 0, width: 256, height: 256,
        hp: 350, maxHp: 350, isWeakPoint: false, vulnerable: false,
      },
      {
        // Glowing seam where mirror image fractures
        id: 2, x: 80, y: 80, width: 96, height: 96,
        hp: 350, maxHp: 350, isWeakPoint: true, vulnerable: true,
      },
    ],
    fireTimer: 70,
    behaviorTimer: 0,
    defeated: false,
    velocityX: 1.5,
    velocityY: 0,
    mouthOpen: true, // seam always exposed
    mouthTimer: 0,
    chargeState: "none",
    chargeTimer: 0,
    spawnTimer: 360,
  };
}

export function updateReflection(
  boss: Boss,
  player: Player,
  frameCount: number
): BossUpdateResult {
  const b = { ...boss, behaviorTimer: boss.behaviorTimer + 1 };
  const bullets: Bullet[] = [];
  const spawnedEnemies: Enemy[] = [];
  const audioEvents: AudioEvent[] = [];

  // Entrance
  if (b.y < 40) {
    b.y += 2;
    return { boss: b, bullets, spawnedEnemies, audioEvents };
  }

  // Phase checks
  if (b.hp <= 233 && b.phase === 1) {
    b.phase = 2;
    b.velocityX = b.velocityX > 0 ? 2 : -2;
    audioEvents.push(AudioEvent.BOSS_PHASE);
  }
  if (b.hp <= 116 && b.phase === 2) {
    b.phase = 3;
    b.velocityX = b.velocityX > 0 ? 2.5 : -2.5;
    audioEvents.push(AudioEvent.BOSS_PHASE);
  }

  b.parts = b.parts.map((p) =>
    p.isWeakPoint ? { ...p, vulnerable: true } : p
  );

  // Movement — mirrors player's X position with delay
  if (b.phase >= 2) {
    const targetX = player.x + player.width / 2 - b.width / 2;
    const dx = targetX - b.x;
    b.velocityX = dx * 0.02 * b.phase; // Faster tracking in higher phases
  }
  b.x += b.velocityX;
  if (b.x <= 10) { b.x = 10; b.velocityX = Math.abs(b.velocityX); }
  else if (b.x >= CANVAS_WIDTH - b.width - 10) {
    b.x = CANVAS_WIDTH - b.width - 10;
    b.velocityX = -Math.abs(b.velocityX);
  }

  // Firing — mirrors player weapon patterns
  b.fireTimer -= 1;
  if (b.fireTimer <= 0) {
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height * 0.8;
    const speed = ENEMY_BULLET_SPEED * 0.9;

    if (b.phase === 1) {
      // Phase 1: Mirrored base weapon — single aimed shot downward
      bullets.push({
        id: ++bossBulletId, x: cx - 3, y: cy,
        vx: 0, vy: speed,
        width: 8, height: 8, damage: 1, isPlayer: false, piercing: false,
      });
      b.fireTimer = 60;
    } else if (b.phase === 2) {
      // Phase 2: Mirrored upgraded weapons — 3-way spread + side gunners
      const angles = [-0.3, 0, 0.3];
      for (const angle of angles) {
        bullets.push({
          id: ++bossBulletId, x: cx - 3, y: cy,
          vx: Math.sin(angle) * speed, vy: Math.cos(angle) * speed,
          width: 8, height: 8, damage: 1, isPlayer: false, piercing: false,
        });
      }
      // Side gunners
      bullets.push({
        id: ++bossBulletId, x: b.x - 5, y: cy - 20,
        vx: -speed * 0.3, vy: speed * 0.8,
        width: 6, height: 6, damage: 1, isPlayer: false, piercing: false,
      });
      bullets.push({
        id: ++bossBulletId, x: b.x + b.width + 5, y: cy - 20,
        vx: speed * 0.3, vy: speed * 0.8,
        width: 6, height: 6, damage: 1, isPlayer: false, piercing: false,
      });
      b.fireTimer = 50;
    } else {
      // Phase 3: Full mirror — 5-way burst + aimed + side gunners
      const angles = [-0.6, -0.3, 0, 0.3, 0.6];
      for (const angle of angles) {
        bullets.push({
          id: ++bossBulletId, x: cx - 3, y: cy,
          vx: Math.sin(angle) * speed, vy: Math.cos(angle) * speed,
          width: 8, height: 8, damage: 1, isPlayer: false, piercing: false,
        });
      }
      // Aimed shot
      const dx = player.x + player.width / 2 - cx;
      const dy = player.y + player.height / 2 - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      bullets.push({
        id: ++bossBulletId, x: cx - 3, y: cy,
        vx: (dx / dist) * speed * 1.2, vy: (dy / dist) * speed * 1.2,
        width: 10, height: 10, damage: 1, isPlayer: false, piercing: false,
      });
      // Side gunners
      bullets.push({
        id: ++bossBulletId, x: b.x - 5, y: cy - 20,
        vx: -speed * 0.4, vy: speed * 0.7,
        width: 6, height: 6, damage: 1, isPlayer: false, piercing: false,
      });
      bullets.push({
        id: ++bossBulletId, x: b.x + b.width + 5, y: cy - 20,
        vx: speed * 0.4, vy: speed * 0.7,
        width: 6, height: 6, damage: 1, isPlayer: false, piercing: false,
      });
      b.fireTimer = 40;
    }
    audioEvents.push(AudioEvent.ENEMY_SHOOT);
  }

  // Minion spawning
  b.spawnTimer -= 1;
  if (b.spawnTimer <= 0) {
    if (b.phase === 1) {
      const sx = 40 + Math.random() * (CANVAS_WIDTH - 120);
      spawnedEnemies.push(createEnemy(EnemyType.MIRROR, sx, -40));
      b.spawnTimer = 480;
    } else if (b.phase === 2) {
      for (let i = 0; i < 2; i++) {
        const sx = 30 + Math.random() * (CANVAS_WIDTH - 90);
        spawnedEnemies.push(createEnemy(EnemyType.MIRROR, sx, -30 - i * 20));
      }
      b.spawnTimer = 420;
    } else {
      for (let i = 0; i < 2; i++) {
        const sx = 30 + Math.random() * (CANVAS_WIDTH - 90);
        spawnedEnemies.push(createEnemy(EnemyType.MIRROR, sx, -30 - i * 20));
      }
      const ex = 40 + Math.random() * (CANVAS_WIDTH - 120);
      spawnedEnemies.push(createEnemy(EnemyType.ECHO, ex, -50));
      b.spawnTimer = 360;
    }
  }

  b.x = Math.max(-20, Math.min(CANVAS_WIDTH - b.width + 20, b.x));
  b.y = Math.max(-20, Math.min(GAME_AREA_HEIGHT / 2, b.y));

  return { boss: b, bullets, spawnedEnemies, audioEvents };
}

// ─── Create The Hollow Mind (World 8 Boss) ──────────────────────────
export function createHollowMind(): Boss {
  return {
    id: 8,
    name: "The Hollow Mind",
    x: CANVAS_WIDTH / 2 - 160,
    y: -330,
    width: 320,
    height: 320,
    hp: 500,
    maxHp: 500,
    phase: 1,
    maxPhases: 3,
    parts: [
      {
        id: 1, x: 0, y: 0, width: 320, height: 320,
        hp: 500, maxHp: 500, isWeakPoint: false, vulnerable: false,
      },
      {
        id: 2, x: 112, y: 112, width: 96, height: 96,
        hp: 500, maxHp: 500, isWeakPoint: true, vulnerable: true,
      },
    ],
    fireTimer: 50,
    behaviorTimer: 0,
    defeated: false,
    velocityX: 0.6,
    velocityY: 0,
    mouthOpen: true, // central eye always exposed
    mouthTimer: 300, // used for neural pulse timer
    chargeState: "none",
    chargeTimer: 0,
    spawnTimer: 240,
  };
}

export function updateHollowMind(
  boss: Boss,
  player: Player,
  frameCount: number
): BossUpdateResult {
  const b = { ...boss, behaviorTimer: boss.behaviorTimer + 1 };
  const bullets: Bullet[] = [];
  const spawnedEnemies: Enemy[] = [];
  const audioEvents: AudioEvent[] = [];

  // Entrance
  if (b.y < 20) {
    b.y += 2;
    return { boss: b, bullets, spawnedEnemies, audioEvents };
  }

  // Phase checks
  if (b.hp <= 333 && b.phase === 1) {
    b.phase = 2;
    audioEvents.push(AudioEvent.BOSS_PHASE);
  }
  if (b.hp <= 166 && b.phase === 2) {
    b.phase = 3;
    b.velocityX = b.velocityX > 0 ? 1.2 : -1.2;
    audioEvents.push(AudioEvent.BOSS_PHASE);
  }

  b.parts = b.parts.map((p) =>
    p.isWeakPoint ? { ...p, vulnerable: true } : p
  );

  // Slow movement + rotation effect
  b.x += b.velocityX;
  if (b.x <= 0) { b.x = 0; b.velocityX = Math.abs(b.velocityX); }
  else if (b.x >= CANVAS_WIDTH - b.width) {
    b.x = CANVAS_WIDTH - b.width;
    b.velocityX = -Math.abs(b.velocityX);
  }

  // Firing
  b.fireTimer -= 1;
  if (b.fireTimer <= 0) {
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height * 0.6;
    const speed = ENEMY_BULLET_SPEED * 0.8;

    if (b.phase === 1) {
      // Tentacle wave — wide spread
      const angles = [-0.7, -0.35, 0, 0.35, 0.7];
      for (const angle of angles) {
        bullets.push({
          id: ++bossBulletId, x: cx - 3, y: cy,
          vx: Math.sin(angle) * speed, vy: Math.cos(angle) * speed,
          width: 10, height: 10, damage: 1, isPlayer: false, piercing: false,
        });
      }
      b.fireTimer = 60;
    } else if (b.phase === 2) {
      // Neural pulse — rotating pattern + aimed
      const baseAngle = (b.behaviorTimer * 0.08) % (Math.PI * 2);
      for (let i = 0; i < 6; i++) {
        const angle = baseAngle + (i / 6) * Math.PI * 2;
        bullets.push({
          id: ++bossBulletId, x: cx - 3, y: cy,
          vx: Math.sin(angle) * speed, vy: Math.cos(angle) * speed,
          width: 8, height: 8, damage: 1, isPlayer: false, piercing: false,
        });
      }
      b.fireTimer = 50;
    } else {
      // Phase 3 — everything: 8-way burst + aimed
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        bullets.push({
          id: ++bossBulletId, x: cx - 3, y: cy,
          vx: Math.sin(angle) * speed * 1.1, vy: Math.cos(angle) * speed * 1.1,
          width: 8, height: 8, damage: 1, isPlayer: false, piercing: false,
        });
      }
      // Plus aimed shot
      const dx = player.x + player.width / 2 - cx;
      const dy = player.y + player.height / 2 - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      bullets.push({
        id: ++bossBulletId, x: cx - 3, y: cy,
        vx: (dx / dist) * speed * 1.3, vy: (dy / dist) * speed * 1.3,
        width: 12, height: 12, damage: 1, isPlayer: false, piercing: false,
      });
      b.fireTimer = 40;
    }
    audioEvents.push(AudioEvent.ENEMY_SHOOT);
  }

  // Minion spawning — all enemy types
  b.spawnTimer -= 1;
  if (b.spawnTimer <= 0) {
    const spawnTypes: EnemyType[] = b.phase === 1
      ? [EnemyType.SCOUT, EnemyType.DRONE, EnemyType.GUNNER]
      : b.phase === 2
        ? [EnemyType.ELITE, EnemyType.SHIELDER, EnemyType.CLOAKER]
        : [EnemyType.ELITE, EnemyType.BOMBER, EnemyType.SWARM, EnemyType.CLOAKER];

    const count = b.phase === 3 ? 4 : 3;
    for (let i = 0; i < count; i++) {
      const type = spawnTypes[Math.floor(Math.random() * spawnTypes.length)];
      const sx = 30 + Math.random() * (CANVAS_WIDTH - 90);
      spawnedEnemies.push(createEnemy(type, sx, -30 - i * 20));
    }
    b.spawnTimer = b.phase === 3 ? 300 : 360;
  }

  b.x = Math.max(-20, Math.min(CANVAS_WIDTH - b.width + 20, b.x));
  b.y = Math.max(-20, Math.min(GAME_AREA_HEIGHT / 3, b.y));

  return { boss: b, bullets, spawnedEnemies, audioEvents };
}

// ─── Boss Factory ───────────────────────────────────────────────────
export function createBossForWorld(world: number): Boss {
  switch (world) {
    case 1: return createRockjaw();
    case 2: return createGlacius();
    case 3: return createCindermaw();
    case 4: return createRevenant();
    case 5: return createNyxar();
    case 6: return createBeacon();
    case 7: return createReflection();
    case 8: return createHollowMind();
    default: return createRockjaw();
  }
}

export function updateBossForWorld(
  world: number,
  boss: Boss,
  player: Player,
  frameCount: number
): BossUpdateResult {
  switch (world) {
    case 1: return updateBoss(boss, player, frameCount);
    case 2: return updateGlacius(boss, player, frameCount);
    case 3: return updateCindermaw(boss, player, frameCount);
    case 4: return updateRevenant(boss, player, frameCount);
    case 5: return updateNyxar(boss, player, frameCount);
    case 6: return updateBeacon(boss, player, frameCount);
    case 7: return updateReflection(boss, player, frameCount);
    case 8: return updateHollowMind(boss, player, frameCount);
    default: return updateBoss(boss, player, frameCount);
  }
}

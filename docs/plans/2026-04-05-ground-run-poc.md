# Ground Run-and-Gun Proof-of-Concept Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal side-scrolling ground run-and-gun mode that plays inside a Phase 2 of an existing multi-phase level — proving the multi-mode architecture works end-to-end. Player lands on a planet surface, runs left/right, jumps, and shoots ground enemies on a scrolling platform level.

**Architecture:** Create three new modules: `groundPhysics.ts` (gravity, ground/platform collision, jumping), `groundEngine.ts` (ground-run update loop: player movement, enemy spawning/AI, bullet management, level completion), and `groundRenderer.ts` (side-scrolling camera, platform rendering, infantry player/enemy sprites). Wire these into the existing `updateGame()` and `drawGame()` dispatches via a `currentMode` field on GameState. Define a test level map as a tile grid. Reuse the existing damage/affinity system, floating labels, and dashboard.

**Tech Stack:** TypeScript, Next.js 15, React 19, HTML5 Canvas 2D. No test framework — `yarn build` + manual playtest.

**Spec reference:** [2026-04-05-sector-zero-expansion-design.md](../specs/2026-04-05-sector-zero-expansion-design.md) — System 2, Mode 1

**MVP scope (proof-of-concept):**
- Side-scrolling camera following the player
- Gravity + jumping + platform collision
- Left/right movement with 8-direction aim (simplified to left/right/up for PoC)
- Player shoots horizontally (reuses existing bullet system with modified direction)
- 2-3 ground enemy types (stationary turret, walking patrol, jumping attacker)
- One test level map defined as a tile grid
- Phase 2 of W1-L3 uses `mode: "ground-run"` instead of second shooter phase
- Level completes when player reaches the end of the map OR clears all enemies
- HP/weapon level carry from Phase 1 (shooter) → Phase 2 (ground-run)

**NOT in scope:** Crouching, ladders, destructible terrain, boss fights, custom infantry sprites (reuses colored rectangles for PoC), mobile touch controls for ground mode.

**Verified codebase facts:**
- `GameMode` type includes `"ground-run"` (already defined in types.ts)
- `PhaseConfig.mode` determines the gameplay mode per phase
- `updateGame()` dispatches at line 375: `if (state.screen !== GameScreen.PLAYING) return state`
- `drawGame()` falls through to PLAYING/BOSS_FIGHT rendering after screen checks
- `CANVAS_WIDTH = 480`, `GAME_AREA_HEIGHT = 714`, `DASHBOARD_HEIGHT = 140`
- Player input: `Keys` interface has `left, right, up, down, shoot, bomb`
- Touch input: `touchX, touchY` passed to updateGame
- The phase system clears enemies/bullets between phases

---

## File Structure

### New files

| Path | Responsibility |
|------|----------------|
| `engine/groundPhysics.ts` | Gravity, platform/ground collision, jumping, tile map collision checks |
| `engine/groundEngine.ts` | Ground-run update loop: player ground movement, enemy AI, shooting, win condition |
| `engine/groundRenderer.ts` | Side-scrolling camera, tile map rendering, ground player/enemy drawing |
| `engine/groundLevel.ts` | Test level tile map definition, ground enemy spawn data |

### Modified files

| Path | Changes |
|------|---------|
| `engine/types.ts` | Add `currentMode: GameMode` to GameState; add `GroundEntity`, `TileMap`, `GroundLevelData` interfaces |
| `engine/gameEngine.ts` | Dispatch to ground-run update when `currentMode === "ground-run"` |
| `engine/renderer.ts` | Dispatch to ground-run renderer when `currentMode === "ground-run"` |
| `engine/levels.ts` | Change W1-L3 Phase 2 from shooter to ground-run |

---

## Task 1: Add ground-run types to types.ts

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/types.ts`

- [ ] **Step 1: Find GameState and add currentMode**

```bash
cd games/sector-zero/web && grep -n "currentPhase:" app/components/engine/types.ts
```

Add `currentMode: GameMode` right after `currentPhase`:

```typescript
  currentPhase: number;
  currentMode: GameMode;  // NEW — "shooter" | "ground-run" | etc.
  totalPhases: number;
```

- [ ] **Step 2: Add ground-run specific types**

Find `// ─── Multi-Phase Levels ───`. After the `CheckpointState` interface, add:

```typescript
// ─── Ground Run-and-Gun ─────────────────────────────────────────────

/** Single tile in a ground-run level map */
export type TileType = "empty" | "solid" | "platform" | "spawn" | "goal";

export interface TileMap {
  width: number;     // tiles across
  height: number;    // tiles tall
  tileSize: number;  // pixels per tile
  tiles: TileType[][]; // [row][col], row 0 = top
}

export interface GroundEntity {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  type: "patrol" | "turret" | "jumper";
  onGround: boolean;
  facingRight: boolean;
  fireTimer: number;
  classId: EnemyClass;
}

export interface GroundState {
  tileMap: TileMap;
  cameraX: number;       // horizontal scroll offset (pixels)
  groundEnemies: GroundEntity[];
  groundBullets: Bullet[];
  playerOnGround: boolean;
  playerVY: number;      // vertical velocity (positive = falling)
  playerFacingRight: boolean;
  goalReached: boolean;
}
```

- [ ] **Step 3: Add optional groundState to GameState**

In `GameState`, after `phaseTransitionSubtext`:

```typescript
  /** Ground run-and-gun mode state (only populated when currentMode === "ground-run") */
  groundState?: GroundState;
```

- [ ] **Step 4: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

Expected: Build fails (new `currentMode` field not initialized). Expected.

- [ ] **Step 5: Commit**

```bash
cd /Users/nichalasbarnes/Desktop/projects/knicks-knacks
git add games/sector-zero/web/app/components/engine/types.ts
git commit -m "feat(sector-zero): add ground run-and-gun types and currentMode to GameState"
```

---

## Task 2: Initialize currentMode in GameState factories

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/gameEngine.ts`

- [ ] **Step 1: Find state factories**

```bash
cd games/sector-zero/web && grep -n "currentPhase:" app/components/engine/gameEngine.ts | head -5
```

- [ ] **Step 2: Add currentMode at each site**

After `currentPhase: 0,` add:

```typescript
    currentMode: "shooter",
```

Do this in BOTH `createGameState` and `createPlanetGameState`.

- [ ] **Step 3: Update phase transition to set currentMode**

Find the phase transition trigger code (where `s.currentPhase += 1` happens):

```bash
cd games/sector-zero/web && grep -n "s.currentPhase += 1" app/components/engine/gameEngine.ts | head -5
```

At EACH site, after `s.currentPhase += 1`, add:

```typescript
      // Set the mode for the new phase
      const nextMode = nextPhaseData?.config.mode ?? "shooter";
      s.currentMode = nextMode;
```

Note: `nextPhaseData` is already defined in scope from the existing phase transition code.

- [ ] **Step 4: Verify build is clean**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully`

- [ ] **Step 5: Commit**

```bash
git add games/sector-zero/web/app/components/engine/gameEngine.ts
git commit -m "feat(sector-zero): initialize currentMode and set it during phase transitions"
```

---

## Task 3: Create groundPhysics.ts — gravity and collision

**Files:**
- Create: `games/sector-zero/web/app/components/engine/groundPhysics.ts`

- [ ] **Step 1: Create the module**

```typescript
import type { TileMap, TileType } from "./types";

export const GRAVITY = 0.5;
export const JUMP_VELOCITY = -10;
export const MAX_FALL_SPEED = 12;
export const GROUND_TILE_SIZE = 32;

/** Get the tile at a world-pixel position. Returns "empty" if out of bounds. */
export function getTileAt(map: TileMap, worldX: number, worldY: number): TileType {
  const col = Math.floor(worldX / map.tileSize);
  const row = Math.floor(worldY / map.tileSize);
  if (row < 0 || row >= map.height || col < 0 || col >= map.width) return "empty";
  return map.tiles[row][col];
}

/** Check if a rectangle collides with any solid tile (NOT platforms — they are one-way). */
export function collidesWithSolid(
  map: TileMap,
  x: number,
  y: number,
  width: number,
  height: number
): boolean {
  const left = Math.floor(x / map.tileSize);
  const right = Math.floor((x + width - 1) / map.tileSize);
  const top = Math.floor(y / map.tileSize);
  const bottom = Math.floor((y + height - 1) / map.tileSize);

  for (let row = top; row <= bottom; row++) {
    for (let col = left; col <= right; col++) {
      if (row < 0 || row >= map.height || col < 0 || col >= map.width) continue;
      if (map.tiles[row][col] === "solid") return true;
    }
  }
  return false;
}

/** Apply gravity and resolve vertical collision. Returns new y, vy, onGround. */
export function applyGravity(
  map: TileMap,
  x: number,
  y: number,
  vy: number,
  width: number,
  height: number
): { y: number; vy: number; onGround: boolean } {
  let newVY = Math.min(vy + GRAVITY, MAX_FALL_SPEED);
  let newY = y + newVY;
  let onGround = false;

  if (newVY > 0) {
    // Falling — check ground collision
    const feetY = newY + height;
    const left = Math.floor(x / map.tileSize);
    const right = Math.floor((x + width - 1) / map.tileSize);
    const tileRow = Math.floor(feetY / map.tileSize);

    for (let col = left; col <= right; col++) {
      if (col < 0 || col >= map.width || tileRow < 0 || tileRow >= map.height) continue;
      const tile = map.tiles[tileRow][col];
      if (tile === "solid" || tile === "platform") {
        // Snap to top of tile
        newY = tileRow * map.tileSize - height;
        newVY = 0;
        onGround = true;
        break;
      }
    }
  } else if (newVY < 0) {
    // Rising — check ceiling collision
    const headY = newY;
    const left = Math.floor(x / map.tileSize);
    const right = Math.floor((x + width - 1) / map.tileSize);
    const tileRow = Math.floor(headY / map.tileSize);

    for (let col = left; col <= right; col++) {
      if (col < 0 || col >= map.width || tileRow < 0 || tileRow >= map.height) continue;
      const tile = map.tiles[tileRow][col];
      if (tile === "solid") {
        newY = (tileRow + 1) * map.tileSize;
        newVY = 0;
        break;
      }
    }
  }

  return { y: newY, vy: newVY, onGround };
}

/** Resolve horizontal collision. Returns new x. */
export function resolveHorizontal(
  map: TileMap,
  x: number,
  y: number,
  vx: number,
  width: number,
  height: number
): number {
  const newX = x + vx;

  // Check leading edge
  const checkX = vx > 0 ? newX + width - 1 : newX;
  const top = Math.floor(y / map.tileSize);
  const bottom = Math.floor((y + height - 1) / map.tileSize);

  for (let row = top; row <= bottom; row++) {
    const col = Math.floor(checkX / map.tileSize);
    if (row < 0 || row >= map.height || col < 0 || col >= map.width) continue;
    if (map.tiles[row][col] === "solid") {
      // Snap to edge of tile
      if (vx > 0) {
        return col * map.tileSize - width;
      } else {
        return (col + 1) * map.tileSize;
      }
    }
  }

  // Clamp to map bounds
  return Math.max(0, Math.min(newX, map.width * map.tileSize - width));
}

// ─── Dev self-tests ─────────────────────────────────────────────────

export function __runGroundPhysicsSelfTests(): void {
  const testMap: TileMap = {
    width: 5,
    height: 5,
    tileSize: 32,
    tiles: [
      ["empty", "empty", "empty", "empty", "empty"],
      ["empty", "empty", "empty", "empty", "empty"],
      ["empty", "empty", "solid", "empty", "empty"],
      ["empty", "empty", "empty", "empty", "empty"],
      ["solid", "solid", "solid", "solid", "solid"],
    ],
  };

  // getTileAt
  console.assert(getTileAt(testMap, 0, 128) === "solid", "Bottom-left is solid");
  console.assert(getTileAt(testMap, 0, 0) === "empty", "Top-left is empty");
  console.assert(getTileAt(testMap, 64, 64) === "solid", "Middle tile is solid");
  console.assert(getTileAt(testMap, -10, 0) === "empty", "Out of bounds is empty");

  // collidesWithSolid
  console.assert(collidesWithSolid(testMap, 0, 120, 16, 16), "Should collide with bottom row");
  console.assert(!collidesWithSolid(testMap, 0, 0, 16, 16), "Should not collide at top-left");
}

if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
  __runGroundPhysicsSelfTests();
}
```

- [ ] **Step 2: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add games/sector-zero/web/app/components/engine/groundPhysics.ts
git commit -m "feat(sector-zero): add ground physics module with gravity and tile collision"
```

---

## Task 4: Create groundLevel.ts — test level tile map

**Files:**
- Create: `games/sector-zero/web/app/components/engine/groundLevel.ts`

- [ ] **Step 1: Create the module**

The tile map is a simple 2D grid. The test level is a short side-scrolling map with platforms and a goal at the end.

```typescript
import type { TileMap, GroundEntity, GroundState, Bullet } from "./types";
import { GROUND_TILE_SIZE } from "./groundPhysics";
import type { EnemyClass } from "./types";

const T = GROUND_TILE_SIZE;

/**
 * Test ground-run level: 40 tiles wide × 22 tiles tall (fills GAME_AREA_HEIGHT).
 * Legend: . = empty, # = solid, = = platform, S = spawn, G = goal
 */
function parseMap(lines: string[]): TileMap {
  const tiles = lines.map((line) =>
    line.split("").map((ch): "empty" | "solid" | "platform" | "spawn" | "goal" => {
      switch (ch) {
        case "#": return "solid";
        case "=": return "platform";
        case "S": return "spawn";
        case "G": return "goal";
        default: return "empty";
      }
    })
  );
  return {
    width: tiles[0]?.length ?? 0,
    height: tiles.length,
    tileSize: T,
    tiles,
  };
}

const TEST_GROUND_MAP = parseMap([
  // 40 chars wide, 22 rows tall (~704px, fits in GAME_AREA_HEIGHT of 714)
  "........................................",
  "........................................",
  "........................................",
  "........................................",
  "........................................",
  "........................................",
  "........................................",
  "........................................",
  "........................................",
  "........................................",
  "..............====......................",
  "........................................",
  "........====........====..........====.",
  "........................................",
  "..S.............===..................G..",
  "........................................",
  "....====..........====......====.......",
  "........................................",
  "........................................",
  "........................................",
  "........................................",
  "########################################",
]);

// Enemies placed on ground floor (row 21 is solid, so y = 20*T - height puts them on top)
const GROUND_Y = 20 * T - 32; // ground floor, adjusted for enemy height

const TEST_GROUND_ENEMIES: Omit<GroundEntity, "id">[] = [
  {
    x: 12 * T, y: GROUND_Y, width: 24, height: 32,
    vx: 0, vy: 0, hp: 2, maxHp: 2,
    type: "turret", onGround: true, facingRight: false,
    fireTimer: 60, classId: "heavy-mech",
  },
  {
    x: 20 * T, y: GROUND_Y, width: 24, height: 32,
    vx: 1, vy: 0, hp: 1, maxHp: 1,
    type: "patrol", onGround: true, facingRight: true,
    fireTimer: 0, classId: "swarm",
  },
  {
    x: 28 * T, y: GROUND_Y, width: 24, height: 32,
    vx: 0, vy: 0, hp: 3, maxHp: 3,
    type: "turret", onGround: true, facingRight: false,
    fireTimer: 90, classId: "armored",
  },
  {
    x: 35 * T, y: GROUND_Y, width: 24, height: 32,
    vx: 2, vy: 0, hp: 2, maxHp: 2,
    type: "jumper", onGround: true, facingRight: false,
    fireTimer: 0, classId: "bio-organic",
  },
];

let groundEntityId = 0;

export function createTestGroundState(): GroundState {
  groundEntityId = 0;
  return {
    tileMap: TEST_GROUND_MAP,
    cameraX: 0,
    groundEnemies: TEST_GROUND_ENEMIES.map((e) => ({ ...e, id: ++groundEntityId })),
    groundBullets: [],
    playerOnGround: false,
    playerVY: 0,
    playerFacingRight: true,
    goalReached: false,
  };
}

/** Find spawn position from map. */
export function getSpawnPosition(map: TileMap): { x: number; y: number } {
  for (let row = 0; row < map.height; row++) {
    for (let col = 0; col < map.width; col++) {
      if (map.tiles[row][col] === "spawn") {
        return { x: col * map.tileSize, y: (row - 1) * map.tileSize };
      }
    }
  }
  return { x: 64, y: 400 };
}

/** Find goal position from map. */
export function getGoalPosition(map: TileMap): { x: number; y: number } {
  for (let row = 0; row < map.height; row++) {
    for (let col = 0; col < map.width; col++) {
      if (map.tiles[row][col] === "goal") {
        return { x: col * map.tileSize, y: row * map.tileSize };
      }
    }
  }
  return { x: 1200, y: 400 };
}
```

- [ ] **Step 2: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add games/sector-zero/web/app/components/engine/groundLevel.ts
git commit -m "feat(sector-zero): add test ground-run level with tile map and enemies"
```

---

## Task 5: Create groundEngine.ts — ground-run update loop

**Files:**
- Create: `games/sector-zero/web/app/components/engine/groundEngine.ts`

- [ ] **Step 1: Create the module**

```typescript
import {
  CANVAS_WIDTH,
  GAME_AREA_HEIGHT,
  BULLET_SPEED,
  GameScreen,
  EnemyType,
  AudioEvent,
  type GameState,
  type Keys,
  type Bullet,
  type GroundState,
  type GroundEntity,
} from "./types";
import { applyGravity, resolveHorizontal, JUMP_VELOCITY, GROUND_TILE_SIZE } from "./groundPhysics";
import { getGoalPosition, getSpawnPosition } from "./groundLevel";
import { resolveAffinity } from "./enemyClasses";
import { AFFINITY_MULTIPLIER } from "./weaponTypes";
import { createAffinityLabel } from "./floatingLabels";
import { createSpriteExplosion } from "./particles";
import { hasSkill, getSkillEffect } from "./skillTree";

const GROUND_PLAYER_SPEED = 3;
const GROUND_FIRE_RATE = 12;

let bulletIdCounter = 50000; // offset from other bullet IDs

export function updateGroundRun(
  state: GameState,
  keys: Keys,
  touchX: number | null,
  touchY: number | null
): GameState {
  if (!state.groundState) return state;

  let s = { ...state, frameCount: state.frameCount + 1, audioEvents: [] as AudioEvent[] };
  let gs = { ...s.groundState };
  const map = gs.tileMap;
  const player = { ...s.player };

  // ── Player horizontal movement ──
  let moveX = 0;
  if (keys.left) { moveX = -GROUND_PLAYER_SPEED; gs.playerFacingRight = false; }
  if (keys.right) { moveX = GROUND_PLAYER_SPEED; gs.playerFacingRight = true; }

  player.x = resolveHorizontal(map, player.x, player.y, moveX, player.width, player.height);

  // ── Player vertical (gravity + jump) ──
  if (keys.up && gs.playerOnGround) {
    gs.playerVY = JUMP_VELOCITY;
    gs.playerOnGround = false;
    s.audioEvents.push(AudioEvent.PLAYER_SHOOT); // reuse sound for jump
  }

  const grav = applyGravity(map, player.x, player.y, gs.playerVY, player.width, player.height);
  player.y = grav.y;
  gs.playerVY = grav.vy;
  gs.playerOnGround = grav.onGround;

  // ── Player shooting ──
  if (keys.shoot && player.fireTimer <= 0) {
    const dir = gs.playerFacingRight ? 1 : -1;
    const bulletX = gs.playerFacingRight ? player.x + player.width : player.x - 4;
    const bulletY = player.y + player.height / 2 - 2;
    gs.groundBullets = [
      ...gs.groundBullets,
      {
        id: ++bulletIdCounter,
        x: bulletX,
        y: bulletY,
        vx: dir * BULLET_SPEED,
        vy: 0,
        width: 8,
        height: 4,
        damage: 1,
        isPlayer: true,
        piercing: false,
        weaponType: s.equippedWeaponType,
      },
    ];
    player.fireTimer = GROUND_FIRE_RATE;
    s.audioEvents.push(AudioEvent.PLAYER_SHOOT);
  }
  if (player.fireTimer > 0) player.fireTimer -= 1;

  // ── Update bullets ──
  gs.groundBullets = gs.groundBullets
    .map((b) => ({ ...b, x: b.x + b.vx, y: b.y + b.vy }))
    .filter((b) => {
      // Remove if off-screen relative to camera
      const screenX = b.x - gs.cameraX;
      return screenX > -50 && screenX < CANVAS_WIDTH + 50;
    });

  // ── Update ground enemies ──
  let newEnemies: GroundEntity[] = [];
  for (const enemy of gs.groundEnemies) {
    let e = { ...enemy };

    // AI by type
    switch (e.type) {
      case "patrol": {
        e.x += e.vx * (e.facingRight ? 1 : -1);
        // Check ground ahead (row below feet) — reverse if no ground
        const checkX = e.facingRight ? e.x + e.width + 2 : e.x - 2;
        const col = Math.floor(checkX / map.tileSize);
        const groundRow = Math.floor((e.y + e.height) / map.tileSize); // tile below feet
        // Reverse if hitting a wall or no ground ahead
        const wallRow = Math.floor((e.y + e.height / 2) / map.tileSize);
        const hitsWall = col >= 0 && col < map.width && map.tiles[wallRow]?.[col] === "solid";
        const noGround = !map.tiles[groundRow]?.[col] || map.tiles[groundRow][col] !== "solid";
        if (col < 0 || col >= map.width || hitsWall || noGround) {
          e.facingRight = !e.facingRight;
        }
        break;
      }
      case "turret": {
        // Face player
        e.facingRight = player.x > e.x;
        // Fire at player
        e.fireTimer -= 1;
        if (e.fireTimer <= 0) {
          const dir = e.facingRight ? 1 : -1;
          gs.groundBullets.push({
            id: ++bulletIdCounter,
            x: e.facingRight ? e.x + e.width : e.x - 6,
            y: e.y + e.height / 2,
            vx: dir * 3,
            vy: 0,
            width: 6,
            height: 4,
            damage: 1,
            isPlayer: false,
            piercing: false,
          });
          e.fireTimer = 90;
          s.audioEvents.push(AudioEvent.ENEMY_SHOOT);
        }
        break;
      }
      case "jumper": {
        e.facingRight = player.x > e.x;
        e.x += (e.facingRight ? 1 : -1) * e.vx;
        // Simple jump AI — jump when player is above
        if (e.onGround && player.y < e.y - 32) {
          e.vy = JUMP_VELOCITY * 0.7;
          e.onGround = false;
        }
        const jGrav = applyGravity(map, e.x, e.y, e.vy, e.width, e.height);
        e.y = jGrav.y;
        e.vy = jGrav.vy;
        e.onGround = jGrav.onGround;
        break;
      }
    }

    newEnemies.push(e);
  }
  gs.groundEnemies = newEnemies;

  // ── Bullet-enemy collisions ──
  const destroyedBullets = new Set<number>();
  const destroyedEnemies = new Set<number>();

  for (const bullet of gs.groundBullets) {
    if (destroyedBullets.has(bullet.id)) continue;

    if (bullet.isPlayer) {
      // Player bullet → enemy
      for (const enemy of gs.groundEnemies) {
        if (destroyedEnemies.has(enemy.id)) continue;
        if (
          bullet.x < enemy.x + enemy.width &&
          bullet.x + bullet.width > enemy.x &&
          bullet.y < enemy.y + enemy.height &&
          bullet.y + bullet.height > enemy.y
        ) {
          destroyedBullets.add(bullet.id);

          // Apply affinity damage
          let finalDamage = bullet.damage;
          if (bullet.weaponType) {
            const affinity = resolveAffinity(bullet.weaponType, enemy.classId);
            finalDamage = bullet.damage * AFFINITY_MULTIPLIER[affinity];

            if (hasSkill(s.allocatedSkills, "sharpshooter") && affinity === "effective") {
              finalDamage *= 1 + getSkillEffect(s.allocatedSkills, "sharpshooter");
            }

            const label = createAffinityLabel(enemy.x + enemy.width / 2, enemy.y - 4, affinity);
            if (label) s.floatingLabels = [...s.floatingLabels, label];
          }

          enemy.hp -= finalDamage;
          if (enemy.hp <= 0) {
            destroyedEnemies.add(enemy.id);
            s.score += 200;
            s.xp += 200;
            s.kills += 1;
            s.explosions = [
              ...s.explosions,
              createSpriteExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, 48),
            ];
            s.audioEvents.push(AudioEvent.ENEMY_DESTROY);
            // PoC: ground enemies don't map 1:1 to EnemyType yet.
            // Use SCOUT as placeholder for bestiary tracking.
            s.pendingBestiaryKills = [
              ...s.pendingBestiaryKills,
              { type: EnemyType.SCOUT, classId: enemy.classId },
            ];
          }
          break;
        }
      }
    } else {
      // Enemy bullet → player
      if (
        s.player.invincibleTimer <= 0 &&
        bullet.x < player.x + player.width &&
        bullet.x + bullet.width > player.x &&
        bullet.y < player.y + player.height &&
        bullet.y + bullet.height > player.y
      ) {
        destroyedBullets.add(bullet.id);
        player.hp -= 1;
        player.invincibleTimer = 90;
        s.screenShake = 5;
        s.audioEvents.push(AudioEvent.PLAYER_HIT);
        if (player.hp <= 0) {
          s.lives -= 1;
          s.deaths += 1;
          if (s.lives <= 0) {
            s.screen = GameScreen.GAME_OVER;
            s.audioEvents.push(AudioEvent.GAME_OVER);
          } else {
            // Respawn at map start
            const spawn = getSpawnPosition(gs.tileMap);
            player.x = spawn.x;
            player.y = spawn.y;
            player.hp = player.maxHp;
            player.invincibleTimer = 120;
            gs.cameraX = 0;
          }
        }
      }
    }
  }

  gs.groundBullets = gs.groundBullets.filter((b) => !destroyedBullets.has(b.id));
  gs.groundEnemies = gs.groundEnemies.filter((e) => !destroyedEnemies.has(e.id));

  // ── Invincibility timer ──
  if (player.invincibleTimer > 0) player.invincibleTimer -= 1;

  // ── Camera follow ──
  const targetCamX = player.x - CANVAS_WIDTH / 3;
  const maxCamX = gs.tileMap.width * gs.tileMap.tileSize - CANVAS_WIDTH;
  gs.cameraX += (Math.max(0, Math.min(targetCamX, maxCamX)) - gs.cameraX) * 0.1;

  // ── Goal check ──
  const goalPos = getGoalPosition(gs.tileMap);
  if (
    Math.abs(player.x - goalPos.x) < 32 &&
    Math.abs(player.y - goalPos.y) < 48
  ) {
    gs.goalReached = true;
  }

  // ── Level complete ──
  if (gs.goalReached && s.levelCompleteTimer === 0) {
    s.levelCompleteTimer = 360;
    s.xp += 500;
    s.audioEvents.push(AudioEvent.LEVEL_COMPLETE);
  }

  s.player = player;
  s.groundState = gs;
  return s;
}
```

Note: `getSpawnPosition` is already imported at the top of the file via `import { getGoalPosition, getSpawnPosition } from "./groundLevel";`.

- [ ] **Step 2: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add games/sector-zero/web/app/components/engine/groundEngine.ts
git commit -m "feat(sector-zero): add ground run-and-gun update loop"
```

---

## Task 6: Create groundRenderer.ts — side-scrolling renderer

**Files:**
- Create: `games/sector-zero/web/app/components/engine/groundRenderer.ts`

- [ ] **Step 1: Create the module**

```typescript
import {
  CANVAS_WIDTH,
  GAME_AREA_HEIGHT,
  type GameState,
  type GroundState,
  type TileMap,
} from "./types";
import { drawDashboard } from "./dashboard";
import { drawFloatingLabels } from "./floatingLabels";
import { drawSpriteExplosions } from "./particles";

const TILE_COLORS: Record<string, string> = {
  solid: "#3a3a4a",
  platform: "#4a4a5a",
  goal: "#44ff8855",
};

/** Draw the full ground-run frame. */
export function drawGroundRun(
  ctx: CanvasRenderingContext2D,
  state: GameState
): void {
  if (!state.groundState) return;

  const gs = state.groundState;
  const cam = gs.cameraX;

  ctx.save();

  // ── Background ──
  // Simple gradient sky for PoC
  const grad = ctx.createLinearGradient(0, 0, 0, GAME_AREA_HEIGHT);
  grad.addColorStop(0, "#0a0a1a");
  grad.addColorStop(0.6, "#1a1a2a");
  grad.addColorStop(1, "#2a2a3a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, GAME_AREA_HEIGHT);

  // Distant stars
  ctx.fillStyle = "#ffffff22";
  for (let i = 0; i < 30; i++) {
    const sx = ((i * 137 + 23) % CANVAS_WIDTH);
    const sy = ((i * 97 + 47) % (GAME_AREA_HEIGHT * 0.6));
    ctx.fillRect(sx, sy, 1, 1);
  }

  // ── Clip to game area ──
  ctx.beginPath();
  ctx.rect(0, 0, CANVAS_WIDTH, GAME_AREA_HEIGHT);
  ctx.clip();

  // ── Tile map ──
  drawTileMap(ctx, gs.tileMap, cam);

  // ── Goal marker ──
  drawGoalMarker(ctx, gs, state.frameCount, cam);

  // ── Ground enemies ──
  for (const enemy of gs.groundEnemies) {
    const ex = enemy.x - cam;
    const ey = enemy.y;
    if (ex < -50 || ex > CANVAS_WIDTH + 50) continue;

    // Enemy body (colored rectangle for PoC)
    const color = enemy.type === "turret" ? "#cc4444" :
                  enemy.type === "patrol" ? "#44cc44" : "#4488ff";
    ctx.fillStyle = color;
    ctx.fillRect(ex, ey, enemy.width, enemy.height);

    // Direction indicator
    ctx.fillStyle = "#ffffff88";
    const eyeX = enemy.facingRight ? ex + enemy.width - 6 : ex + 2;
    ctx.fillRect(eyeX, ey + 6, 4, 4);

    // HP bar
    if (enemy.hp < enemy.maxHp) {
      ctx.fillStyle = "#333";
      ctx.fillRect(ex, ey - 6, enemy.width, 3);
      ctx.fillStyle = "#ff3333";
      ctx.fillRect(ex, ey - 6, enemy.width * (enemy.hp / enemy.maxHp), 3);
    }
  }

  // ── Ground bullets ──
  for (const b of gs.groundBullets) {
    const bx = b.x - cam;
    if (bx < -20 || bx > CANVAS_WIDTH + 20) continue;

    ctx.fillStyle = b.isPlayer ? "#44ccff" : "#ff4444";
    ctx.shadowBlur = 4;
    ctx.shadowColor = b.isPlayer ? "#44ccff" : "#ff4444";
    ctx.fillRect(bx, b.y, b.width, b.height);
    ctx.shadowBlur = 0;
  }

  // ── Player ──
  const px = state.player.x - cam;
  const py = state.player.y;

  // Invincibility blink
  if (state.player.invincibleTimer > 0 && Math.floor(state.player.invincibleTimer / 4) % 2 === 0) {
    // Skip drawing (blink)
  } else {
    // Player body (colored rectangle for PoC — will be replaced with infantry sprite)
    ctx.fillStyle = "#44aaff";
    ctx.fillRect(px, py, state.player.width, state.player.height);

    // Direction indicator
    ctx.fillStyle = "#ffffff";
    const pEyeX = gs.playerFacingRight ? px + state.player.width - 8 : px + 4;
    ctx.fillRect(pEyeX, py + 10, 4, 4);

    // Gun
    ctx.fillStyle = "#aaccff";
    const gunX = gs.playerFacingRight ? px + state.player.width : px - 10;
    ctx.fillRect(gunX, py + state.player.height / 2 - 2, 10, 4);
  }

  // ── Explosions & labels ──
  // Offset by camera for proper positioning
  ctx.save();
  ctx.translate(-cam, 0);
  drawSpriteExplosions(ctx, state.explosions);
  drawFloatingLabels(ctx, state.floatingLabels);
  ctx.restore();

  // ── Level complete banner ──
  if (state.levelCompleteTimer > 0) {
    const bannerAlpha = Math.min(1, state.levelCompleteTimer / 30);
    ctx.globalAlpha = bannerAlpha;
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, GAME_AREA_HEIGHT / 2 - 40, CANVAS_WIDTH, 80);
    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 24px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PHASE COMPLETE", CANVAS_WIDTH / 2, GAME_AREA_HEIGHT / 2);
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  // ── Dashboard (always on top, outside clip) ──
  drawDashboard(ctx, state);
}

function drawTileMap(
  ctx: CanvasRenderingContext2D,
  map: TileMap,
  cameraX: number
): void {
  const startCol = Math.max(0, Math.floor(cameraX / map.tileSize));
  const endCol = Math.min(map.width, Math.ceil((cameraX + CANVAS_WIDTH) / map.tileSize) + 1);

  for (let row = 0; row < map.height; row++) {
    for (let col = startCol; col < endCol; col++) {
      const tile = map.tiles[row][col];
      const color = TILE_COLORS[tile];
      if (!color) continue;

      const x = col * map.tileSize - cameraX;
      const y = row * map.tileSize;

      ctx.fillStyle = color;
      if (tile === "platform") {
        // Platform: just the top surface
        ctx.fillRect(x, y, map.tileSize, 4);
        ctx.fillStyle = "#3a3a4a22";
        ctx.fillRect(x, y + 4, map.tileSize, map.tileSize - 4);
      } else {
        ctx.fillRect(x, y, map.tileSize, map.tileSize);
        // Top edge highlight
        ctx.fillStyle = "#5a5a6a";
        ctx.fillRect(x, y, map.tileSize, 2);
      }
    }
  }
}

function drawGoalMarker(
  ctx: CanvasRenderingContext2D,
  gs: GroundState,
  frameCount: number,
  cameraX: number
): void {
  // Find goal tile
  for (let row = 0; row < gs.tileMap.height; row++) {
    for (let col = 0; col < gs.tileMap.width; col++) {
      if (gs.tileMap.tiles[row][col] === "goal") {
        const x = col * gs.tileMap.tileSize - cameraX;
        const y = row * gs.tileMap.tileSize;
        const pulse = 0.5 + 0.3 * Math.sin(frameCount * 0.05);

        ctx.fillStyle = `rgba(68, 255, 136, ${pulse * 0.3})`;
        ctx.fillRect(x, y, gs.tileMap.tileSize, gs.tileMap.tileSize);

        ctx.strokeStyle = `rgba(68, 255, 136, ${pulse})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, gs.tileMap.tileSize - 4, gs.tileMap.tileSize - 4);

        ctx.fillStyle = "#44ff88";
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        ctx.fillText("GOAL", x + gs.tileMap.tileSize / 2, y - 6);
      }
    }
  }
}
```

- [ ] **Step 2: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add games/sector-zero/web/app/components/engine/groundRenderer.ts
git commit -m "feat(sector-zero): add ground run-and-gun side-scrolling renderer"
```

---

## Task 7: Wire ground-run mode into game engine + renderer dispatches

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/gameEngine.ts`
- Modify: `games/sector-zero/web/app/components/engine/renderer.ts`

- [ ] **Step 1: Import ground modules in gameEngine.ts**

```typescript
import { updateGroundRun } from "./groundEngine";
import { createTestGroundState, getSpawnPosition } from "./groundLevel";
```

- [ ] **Step 2: Dispatch ground-run update**

Find the line `if (state.screen !== GameScreen.PLAYING) return state;` (around line 375). AFTER it, before the standard PLAYING logic begins, add:

```typescript
  // ── Ground-run mode dispatch ──
  if (state.currentMode === "ground-run") {
    let s = updateGroundRun(state, keys, touchX, touchY);
    // Handle levelCompleteTimer for ground-run (same phase transition logic)
    if (s.levelCompleteTimer > 0) {
      s.levelCompleteTimer -= 1;
      if (s.levelCompleteTimer <= 0) {
        // Import isLastPhase if not already
        if (!isLastPhase(s)) {
          // Phase transition (same code as shooter)
          // ... actually this is already handled below. Ground-run sets levelCompleteTimer
          // and the existing timer code runs on the next frame when screen is still PLAYING.
        }
        s.screen = GameScreen.LEVEL_COMPLETE;
      }
    }
    // Update particles/explosions/labels
    s.particles = updateParticles(s.particles);
    s.explosions = updateSpriteExplosions(s.explosions);
    s.floatingLabels = updateFloatingLabels(s.floatingLabels);
    return s;
  }
```

Wait — the existing `levelCompleteTimer` countdown code at line ~533 already handles the phase transition for all modes. It runs AFTER the PLAYING guard. So ground-run just needs to set `levelCompleteTimer = 360` when the goal is reached (which it already does in `updateGroundRun`), and the existing timer code will handle the rest. 

Simplify to:

```typescript
  // ── Ground-run mode dispatch ──
  if (state.currentMode === "ground-run") {
    let s = updateGroundRun(state, keys, touchX, touchY);
    s.particles = updateParticles(s.particles);
    s.explosions = updateSpriteExplosions(s.explosions);
    s.floatingLabels = updateFloatingLabels(s.floatingLabels);
    s.background = updateBackground(s.background);
    // levelCompleteTimer countdown handled by existing code below
    // (falls through to the timer check, then returns)
  }
```

Hmm, but then the standard shooter update would also run after the if block. Need an early return:

```typescript
  // ── Ground-run mode dispatch ──
  // Returns early — ground-run has its own complete update loop.
  // NOTE: levelCompleteTimer handling is done INSIDE updateGroundRun.
  // This is intentional duplication to keep mode-specific logic self-contained.
  // A shared timer helper can be extracted later when more modes exist.
  if (state.currentMode === "ground-run") {
    let s = updateGroundRun(state, keys, touchX, touchY);
    s.particles = updateParticles(s.particles);
    s.explosions = updateSpriteExplosions(s.explosions);
    s.floatingLabels = updateFloatingLabels(s.floatingLabels);
    s.background = updateBackground(s.background);
    if (s.screenShake > 0) s.screenShake *= 0.9;
    return s;
  }
```

- [ ] **Step 3: Initialize groundState when entering ground-run phase**

Find the phase transition code where waves are loaded (the `nextPhaseData?.config.waves` block). After the wave loading, add ground-run initialization:

```typescript
      // Initialize ground-run state if entering ground-run mode
      if (nextPhaseData?.config.mode === "ground-run") {
        s.groundState = createTestGroundState();
        // Place player at spawn point
        const spawn = getSpawnPosition(s.groundState.tileMap);
        s.player = { ...s.player, x: spawn.x, y: spawn.y };
      } else {
        s.groundState = undefined;
      }
```

Do this in BOTH phase transition trigger sites (normal + boss).

- [ ] **Step 4: Wire ground-run rendering in renderer.ts**

Import:
```typescript
import { drawGroundRun } from "./groundRenderer";
```

Find the PLAYING/BOSS_FIGHT fallthrough rendering (after PHASE_TRANSITION, BRIEFING, BOSS_INTRO checks). BEFORE the existing gameplay rendering (drawPowerUps, drawEnemies, etc.), add:

```typescript
  // Ground-run mode has its own renderer
  // Note: drawGroundRun handles its own ctx.save()/restore() internally.
  // The outer drawGame ctx.restore() at the end handles the initial save.
  if (state.currentMode === "ground-run") {
    drawGroundRun(ctx, state);
    ctx.restore();
    return;
  }
```

- [ ] **Step 5: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(sector-zero): wire ground-run mode into game engine and renderer dispatches"
```

---

## Task 8: Change W1-L3 Phase 2 to ground-run

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/levels.ts`

- [ ] **Step 1: Update getMultiPhaseLevelData**

Find the Phase 2 definition in the W1-L3 multi-phase data. Change its mode from `"shooter"` to `"ground-run"`:

```bash
cd games/sector-zero/web && grep -n "REINFORCEMENTS\|mode.*shooter.*Phase 2\|waves.*slice" app/components/engine/levels.ts | head -10
```

Replace Phase 2:

```typescript
        // PHASE 2: Ground deployment
        {
          config: {
            mode: "ground-run",
            waves: [],  // Ground-run uses its own enemy system, not waves
            isBoss: false,
            briefingText: "Deploy to the surface. Reach the extraction point.",
          },
          transitionIn: {
            cardText: "GROUND DEPLOYMENT",
            cardSubtext: "Phase 2: Reach the extraction point",
            duration: 180,
          },
        },
```

- [ ] **Step 2: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add games/sector-zero/web/app/components/engine/levels.ts
git commit -m "feat(sector-zero): change W1-L3 Phase 2 to ground-run mode"
```

---

## Task 9: Handle ground-run in Game.tsx active screens + input

**Files:**
- Modify: `games/sector-zero/web/app/components/Game.tsx`

- [ ] **Step 1: Verify PLAYING is in active screens list**

The ground-run mode uses `screen: GameScreen.PLAYING` — same as shooter. The game loop's active screens list should already include PLAYING. Verify:

```bash
cd games/sector-zero/web && grep -n "activeScreens" app/components/Game.tsx
```

No changes needed if PLAYING is listed.

- [ ] **Step 2: Verify input handling works for ground-run**

The `Keys` interface has `left, right, up, down, shoot, bomb`. Ground-run uses `left, right, up (jump), shoot`. These are already mapped from keyboard/touch in Game.tsx. No changes needed.

- [ ] **Step 3: Verify checkpoint restore works for ground-run**

The `restoreCheckpoint` function restores player state (HP, lives, weapon level). When restarting a ground-run phase, `groundState` needs to be re-initialized. Find the checkpoint restore in `restartGame`:

```bash
cd games/sector-zero/web && grep -n "restoreCheckpoint\|phaseCheckpoint" app/components/Game.tsx | head -10
```

After the checkpoint restore, re-initialize ground state if we're in ground-run mode:

```typescript
    // Re-initialize ground state for ground-run phases
    if (gameState.currentMode === "ground-run") {
      const { createTestGroundState, getSpawnPosition } = require("./engine/groundLevel");
      const groundState = createTestGroundState();
      const spawn = getSpawnPosition(groundState.tileMap);
      // Include in setGameState along with the checkpoint restore
    }
```

Actually, cleaner approach: import at top level and add to the checkpoint restore's setGameState:

```typescript
import { createTestGroundState, getSpawnPosition as getGroundSpawn } from "./engine/groundLevel";
```

In the checkpoint restore block, after setting the restored state:

```typescript
    if (gameState.currentMode === "ground-run") {
      const gs = createTestGroundState();
      const spawn = getGroundSpawn(gs.tileMap);
      // Add to the setGameState call:
      // groundState: gs,
      // player x/y: spawn.x, spawn.y
    }
```

Read the existing checkpoint restore code and integrate. If the setGameState already uses a spread, add `groundState` to it.

- [ ] **Step 4: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add games/sector-zero/web/app/components/Game.tsx
git commit -m "feat(sector-zero): handle ground-run checkpoint restart and input"
```

---

## Task 10: Final verification

**Files:** All

- [ ] **Step 1: Full build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -25
```

Expected: `✓ Compiled successfully`

- [ ] **Step 2: Playtest checklist**

```bash
cd games/sector-zero/web && yarn dev
```

- [ ] Play W1-L3 Phase 1 (shooter) — normal gameplay
- [ ] Clear all enemies → "GROUND DEPLOYMENT" transition card appears
- [ ] Phase 2 loads: side-scrolling view, platforms visible, player rectangle at spawn
- [ ] Arrow left/right moves player horizontally
- [ ] Arrow up jumps (only when on ground)
- [ ] Player falls with gravity, lands on platforms and ground
- [ ] Space fires horizontal bullets in facing direction
- [ ] Ground enemies visible (turret = red, patrol = green, jumper = blue)
- [ ] Turrets shoot at player
- [ ] Patrol enemies walk back and forth
- [ ] Bullets hit enemies, damage applies (affinity labels appear)
- [ ] Explosions play when enemies die
- [ ] Camera follows player horizontally
- [ ] Reaching the green GOAL marker triggers level complete
- [ ] LEVEL_COMPLETE screen shows combined stats from both phases
- [ ] Dashboard (HP, score, bombs) visible at bottom
- [ ] Dying in Phase 2 → TRY AGAIN restarts from Phase 2 checkpoint
- [ ] Other levels still work normally (single-phase shooter)

- [ ] **Step 3: Final commit**

```bash
git status
git add -A
git commit -m "chore(sector-zero): ground run-and-gun PoC final polish" || echo "Nothing to commit"
```

---

## Summary

After Task 10, the game has:

- ✅ **Side-scrolling platformer engine** with gravity, jumping, platform collision
- ✅ **Tile-based level maps** with solid/platform/spawn/goal tiles
- ✅ **3 ground enemy types**: turret (stationary shooter), patrol (walking), jumper (leaping toward player)
- ✅ **Horizontal shooting** with existing affinity/damage system integrated
- ✅ **Camera system** following the player with smooth scrolling
- ✅ **Goal-based completion** — reach the end of the map to complete the phase
- ✅ **Multi-mode transition working end-to-end**: Shooter Phase 1 → transition card → Ground Run Phase 2
- ✅ **HP/weapon level carry** from shooter to ground-run
- ✅ **Checkpoint restart** works for ground-run phases
- ✅ Placeholder graphics (colored rectangles) — ready for sprite replacement

**Out of scope (future expansion):**
- Infantry player sprite + animation
- Ground enemy sprites
- Crouching, ladders, destructible terrain
- 8-direction aiming (PoC has left/right only)
- Mobile touch controls optimized for ground mode
- Multiple ground-run levels (only test level exists)
- Boss fights in ground-run mode
- Level editor / data-driven level loading

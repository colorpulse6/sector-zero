import type { TileMap, GroundEntity, GroundState, Bullet } from "./types";
import { GROUND_TILE_SIZE } from "./groundPhysics";

const T = GROUND_TILE_SIZE;

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

// 40 chars wide × 22 rows tall (~704px, fits in GAME_AREA_HEIGHT of 714)
// ── Full Ground-Run Level ──────────────────────────────────────────
// 80 cols × 22 rows. Ground at row 21. Jump height ~3 tiles.
// 4 sections: Flatlands → Platforms → Trenches → Ascent to Goal
//
// Legend: # = solid, = = platform, S = spawn, G = goal, . = empty
const TEST_GROUND_MAP = parseMap([
  // 80 chars wide
  "................................................................................",  // 0
  "................................................................................",  // 1
  "................................................................................",  // 2
  "................................................................................",  // 3
  "................................................................................",  // 4
  "................................................................................",  // 5
  "................................................................................",  // 6
  "................................................................................",  // 7
  "................................................................................",  // 8
  "................................................................................",  // 9
  "..............................................................................G.",  // 10
  "............................................................................====",  // 11
  "........................................................................====....",  // 12
  "....................................................................====........",  // 13
  ".........................................====.........................====........",  // 14
  "..................................====.......====...........====..................",  // 15
  "...........................====..............................................####",  // 16
  "..S...........====...====...................====.....====..........====...........####",  // 17
  "..............................................................................####",  // 18
  ".......................##########.....####......####..........####...............####",  // 19
  "................................................................................",  // 20
  "################################################################################",  // 21
]);

// Helper to place an enemy on a specific tile row (feet on top of tile)
function enemyOnRow(col: number, row: number, type: GroundEntity["type"], hp: number, classId: GroundEntity["classId"], vx: number = 0): Omit<GroundEntity, "id"> {
  return {
    x: col * T, y: row * T - 32, width: 24, height: 32,
    vx, vy: 0, hp, maxHp: hp,
    type, onGround: true, facingRight: false,
    fireTimer: type === "turret" ? 60 + Math.floor(Math.random() * 40) : 0,
    classId,
  };
}

const TEST_GROUND_ENEMIES: Omit<GroundEntity, "id">[] = [
  // Section 1: Flatlands (cols 0-20) — intro enemies on ground
  enemyOnRow(8, 21, "patrol", 1, "swarm", 1),
  enemyOnRow(12, 21, "patrol", 1, "swarm", 1),
  enemyOnRow(16, 21, "turret", 2, "heavy-mech"),

  // Section 2: Platforms (cols 20-40) — enemies on platforms and ground
  enemyOnRow(24, 21, "patrol", 2, "bio-organic", 1),
  enemyOnRow(28, 16, "turret", 2, "armored"),  // on platform at row 16
  enemyOnRow(32, 21, "jumper", 2, "bio-organic", 2),
  enemyOnRow(36, 15, "turret", 3, "heavy-mech"),  // on platform at row 15

  // Section 3: Trenches (cols 40-60) — enemies in and around trenches
  enemyOnRow(44, 14, "turret", 2, "armored"),  // on platform
  enemyOnRow(48, 19, "patrol", 2, "swarm", 1),  // on trench floor
  enemyOnRow(52, 21, "jumper", 3, "bio-organic", 2),
  enemyOnRow(56, 15, "turret", 3, "heavy-mech"),

  // Flyers — airborne across the level (placed at various heights)
  { x: 18 * T, y: 12 * T, width: 28, height: 28, vx: 0, vy: 0, hp: 1, maxHp: 1,
    type: "flyer", onGround: false, facingRight: false, fireTimer: 0, classId: "tech-drone" },
  { x: 38 * T, y: 10 * T, width: 28, height: 28, vx: 0, vy: 0, hp: 2, maxHp: 2,
    type: "flyer", onGround: false, facingRight: false, fireTimer: 30, classId: "tech-drone" },
  { x: 55 * T, y: 8 * T, width: 28, height: 28, vx: 0, vy: 0, hp: 2, maxHp: 2,
    type: "flyer", onGround: false, facingRight: false, fireTimer: 60, classId: "tech-drone" },

  // Section 4: Ascent (cols 60-80) — vertical climb to goal
  enemyOnRow(62, 21, "patrol", 2, "swarm", 1),
  enemyOnRow(66, 16, "turret", 3, "armored"),  // on solid at row 16
  enemyOnRow(70, 13, "turret", 4, "heavy-mech"),  // on platform
  enemyOnRow(74, 11, "jumper", 3, "bio-organic", 2),  // near goal

  // Final flyer guarding the goal
  { x: 72 * T, y: 6 * T, width: 28, height: 28, vx: 0, vy: 0, hp: 3, maxHp: 3,
    type: "flyer", onGround: false, facingRight: false, fireTimer: 0, classId: "tech-drone" },
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

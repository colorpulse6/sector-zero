import type { BoardingMap, BoardingEntity, BoardingState, BoardingTileType } from "./types";

const T = 32; // tile size

// ─── Map Parser ──────────────────────────────────────────────────────

function parseMap(lines: string[]): BoardingMap {
  const tiles = lines.map((line) =>
    line.split("").map((ch): BoardingTileType => {
      switch (ch) {
        case "#": return "wall";
        case ".": return "floor";
        case "D": return "door";
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

// ─── Ship Interior Map ───────────────────────────────────────────────
// 30 cols × 30 rows = 960×960 pixel map
// Legend: # wall, . floor, D door, S spawn, G goal, (space) empty
//
// Layout: Entry bay → main corridor → branching rooms → reactor core (goal)

const BOARDING_MAP = parseMap([
  // 30 chars wide
  "##############################", // 0
  "#....#........#.............##", // 1
  "#.S..D........D.............##", // 2
  "#....#........#..####..####.##", // 3
  "######..####..#..#........#.##", // 4
  "#.......#..#..#..#........#.##", // 5
  "#.......#..#..D..D........D.##", // 6
  "#..###..#..#..#..#........#.##", // 7
  "#..#.#..####..#..####..####.##", // 8
  "#..D.#........#.............##", // 9
  "#..#.#........#.............##", // 10
  "#..#.###D######..##D##..##.##", // 11
  "#..#.............#....#..#..##", // 12
  "#..#.............#....#..#..##", // 13
  "#..##############D....D..D..##", // 14
  "#...............##....#..#..##", // 15
  "#...............##....#..#..##", // 16
  "###D########..###########..##", // 17
  "#..........#..#.............##", // 18
  "#..........#..#.............##", // 19
  "#..........D..D.............##", // 20
  "#..........#..#..########..##", // 21
  "#..........#..#..#......#..##", // 22
  "############..#..#..G...#..##", // 23
  "#.............#..#......#..##", // 24
  "#.............#..########..##", // 25
  "#.............#............##", // 26
  "#.............#............##", // 27
  "#..........................##", // 28
  "##############################", // 29
]);

// ─── Enemy Placements ────────────────────────────────────────────────

function enemy(
  col: number,
  row: number,
  type: BoardingEntity["type"],
  hp: number,
  classId: BoardingEntity["classId"],
  facing: BoardingEntity["facing"] = "down",
  aggroRange: number = 160
): Omit<BoardingEntity, "id"> {
  return {
    x: col * T + 4, y: row * T + 4,
    width: 24, height: 24,
    vx: 0, vy: 0,
    hp, maxHp: hp,
    type, facing,
    fireTimer: 0,
    classId,
    aggroRange,
    isAggro: false,
  };
}

const BOARDING_ENEMIES: Omit<BoardingEntity, "id">[] = [
  // Entry corridor guards
  enemy(8, 2, "grunt", 2, "armored", "left"),
  enemy(12, 5, "grunt", 1, "swarm", "down"),

  // Left wing rooms
  enemy(3, 9, "sentry", 3, "heavy-mech", "right"),
  enemy(2, 12, "grunt", 2, "armored", "down"),

  // Central corridor
  enemy(8, 10, "charger", 2, "bio-organic", "down"),
  enemy(12, 13, "grunt", 2, "swarm", "left"),

  // Right wing rooms
  enemy(20, 6, "grunt", 2, "armored", "left"),
  enemy(23, 6, "sentry", 3, "heavy-mech", "down"),
  enemy(20, 12, "charger", 2, "bio-organic", "right"),

  // Lower maze
  enemy(5, 18, "grunt", 2, "swarm", "right"),
  enemy(8, 20, "charger", 3, "bio-organic", "up"),
  enemy(15, 18, "sentry", 4, "heavy-mech", "left"),

  // Approach to reactor
  enemy(15, 24, "grunt", 2, "armored", "up"),
  enemy(18, 22, "charger", 3, "bio-organic", "left"),

  // Reactor room guards
  enemy(20, 23, "sentry", 4, "heavy-mech", "left", 200),
  enemy(22, 24, "grunt", 3, "armored", "up"),
];

// ─── State Creation ──────────────────────────────────────────────────

let entityId = 0;

export function createBoardingState(): BoardingState {
  entityId = 0;
  return {
    map: BOARDING_MAP,
    cameraX: 0,
    cameraY: 0,
    enemies: BOARDING_ENEMIES.map((e) => ({ ...e, id: ++entityId })),
    bullets: [],
    playerFacing: "right",
    dashTimer: 0,
    dashCooldown: 0,
    goalReached: false,
  };
}

export function getBoardingSpawn(map: BoardingMap): { x: number; y: number } {
  for (let row = 0; row < map.height; row++) {
    for (let col = 0; col < map.width; col++) {
      if (map.tiles[row][col] === "spawn") {
        return { x: col * map.tileSize + 4, y: row * map.tileSize + 4 };
      }
    }
  }
  return { x: 64, y: 64 };
}

export function getBoardingGoal(map: BoardingMap): { x: number; y: number } {
  for (let row = 0; row < map.height; row++) {
    for (let col = 0; col < map.width; col++) {
      if (map.tiles[row][col] === "goal") {
        return { x: col * map.tileSize, y: row * map.tileSize };
      }
    }
  }
  return { x: 800, y: 800 };
}

import type { BoardingMap, BoardingTileType, EnemyClass, FPEnemy, FirstPersonState } from "./types";

const T = 32;
const FP_CHARGER_SPEED = 0.03;
const FP_GRUNT_SPEED = 0.015;

function enemy(
  id: number,
  col: number,
  row: number,
  type: FPEnemy["type"],
  hp: number,
  classId: EnemyClass,
  fireTimer: number = 0,
  aggroRange: number = 6
): FPEnemy {
  return {
    id,
    x: col + 0.5,
    y: row + 0.5,
    hp,
    maxHp: hp,
    speed: type === "charger" ? FP_CHARGER_SPEED : FP_GRUNT_SPEED,
    type,
    aggroRange,
    isAggro: false,
    deathTimer: 0,
    fireTimer,
    classId,
  };
}

function parseMissionMap(lines: string[]): {
  map: BoardingMap;
  spawn: { x: number; y: number };
  objective: { x: number; y: number };
} {
  let spawn = { x: 1.5, y: 1.5 };
  let objective = { x: 0, y: 0 };

  const tiles = lines.map((line, row) =>
    line.split("").map((ch, col): BoardingTileType => {
      switch (ch) {
        case "#":
          return "wall";
        case ".":
          return "floor";
        case "D":
          return "door";
        case "S":
          spawn = { x: col + 0.5, y: row + 0.5 };
          return "spawn";
        case "G":
          objective = { x: col + 0.5, y: row + 0.5 };
          return "goal";
        case "B":
          objective = { x: col + 0.5, y: row + 0.5 };
          return "floor";
        default:
          return "empty";
      }
    })
  );

  return {
    map: {
      width: tiles[0]?.length ?? 0,
      height: tiles.length,
      tileSize: T,
      tiles,
    },
    spawn,
    objective,
  };
}

const KEPLER_MAP_DATA = parseMissionMap([
  "##################",
  "#S...#......#...##",
  "###D##.####.#.#.##",
  "#......#..#.#.#.##",
  "#.######..#.#.#.##",
  "#.#....D..#...#.##",
  "#.#.######.#####.#",
  "#.#......#.....#.#",
  "#.######.#####.#.#",
  "#......#.....#.#.#",
  "######.#####.#.#.#",
  "#....#.....#.#.#.#",
  "#.##.#####.#.#.#.#",
  "#.##.....#...#...#",
  "#.######.#######.#",
  "#..............B.#",
  "##################",
]);

const KEPLER_ENEMIES: FPEnemy[] = [
  enemy(1, 4, 3, "grunt", 2, "armored"),
  enemy(2, 9, 5, "charger", 2, "bio-organic"),
  enemy(3, 6, 7, "grunt", 2, "swarm"),
  enemy(4, 12, 9, "sentry", 4, "heavy-mech", 90, 8),
  enemy(5, 4, 12, "charger", 3, "bio-organic"),
  enemy(6, 14, 14, "grunt", 3, "armored"),
];

export function createKeplerBlackBoxFirstPersonState(
  blackBoxRecovered: boolean
): FirstPersonState {
  return {
    map: KEPLER_MAP_DATA.map,
    posX: KEPLER_MAP_DATA.spawn.x,
    posY: KEPLER_MAP_DATA.spawn.y,
    dirX: 1,
    dirY: 0,
    planeX: 0,
    planeY: 0.66,
    moveSpeed: 0.06,
    rotSpeed: 0.04,
    goalReached: false,
    objectivePickup: blackBoxRecovered
      ? undefined
      : {
          x: KEPLER_MAP_DATA.objective.x,
          y: KEPLER_MAP_DATA.objective.y,
          label: "KEPLER BLACK BOX",
        },
    objectiveCollected: false,
    enemies: KEPLER_ENEMIES.map((entry) => ({ ...entry })),
    gunFireTimer: 0,
    gunCooldown: 0,
    npcs: [],
    dialogState: null,
  };
}

export function __runKeplerBlackBoxMissionSelfTests(): void {
  console.assert(
    KEPLER_MAP_DATA.map.tiles.flat().filter((tile) => tile === "spawn").length === 1,
    "Kepler map should contain exactly one spawn tile"
  );
  console.assert(
    createKeplerBlackBoxFirstPersonState(false).objectivePickup?.label === "KEPLER BLACK BOX",
    "First clear should include the black box objective"
  );
  console.assert(
    createKeplerBlackBoxFirstPersonState(true).objectivePickup === undefined,
    "Replay should suppress the black box objective"
  );
}

if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
  __runKeplerBlackBoxMissionSelfTests();
}

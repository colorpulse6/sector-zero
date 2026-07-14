import { createKeplerBlackBoxFirstPersonState } from "../../engine/keplerBlackBoxMission";
import { createBoardingState } from "../../engine/boardingLevel";
import type { GroundEntity, GroundState, TileMap } from "../../engine/types";

function seededInt(seed: number, salt: number, min: number, max: number): number {
  let value = (seed ^ Math.imul(salt, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  return min + ((value >>> 0) % (max - min + 1));
}

export function createFirstPersonRuinTemplate(seed: number) {
  const state = createKeplerBlackBoxFirstPersonState(false);
  return {
    ...state,
    enemies: state.enemies.map((enemy, index) => ({
      ...enemy,
      hp: enemy.hp + seededInt(seed, index + 1, 0, 1),
      maxHp: enemy.maxHp + seededInt(seed, index + 1, 0, 1),
    })),
    objectivePickup: state.objectivePickup
      ? { ...state.objectivePickup, label: "CINDER RELAY CORE" }
      : undefined,
    missionLabel: "CINDER RELAY RUINS",
  };
}

export function createBoardingWreckTemplate(seed: number) {
  const state = createBoardingState();
  return {
    ...state,
    enemies: state.enemies.map((enemy, index) => {
      const bonus = seededInt(seed, index + 20, 0, 1);
      return { ...enemy, hp: enemy.hp + bonus, maxHp: enemy.maxHp + bonus };
    }),
  };
}

const CANYON_LINES = [
  "................................................................",
  "................................................................",
  "................................................................",
  "..............................................................G.",
  "............................................................====",
  "....................................................====........",
  ".......................................====.....................",
  "............................====................................",
  ".................====.........................====..............",
  "..S.............................................................",
  "################################################################",
] as const;

function canyonMap(): TileMap {
  const tiles = CANYON_LINES.map(line => [...line].map(char => {
    if (char === "#") return "solid" as const;
    if (char === "=") return "platform" as const;
    if (char === "S") return "spawn" as const;
    if (char === "G") return "goal" as const;
    return "empty" as const;
  }));
  return { width: tiles[0].length, height: tiles.length, tileSize: 32, tiles };
}

function canyonEnemy(seed: number, index: number, x: number, type: GroundEntity["type"]): GroundEntity {
  const hp = seededInt(seed, index + 40, 1, 3);
  return {
    id: index + 1, x, y: 9 * 32 - 32, width: 24, height: 32,
    vx: type === "patrol" ? 1 : 0, vy: 0, hp, maxHp: hp, type,
    onGround: true, facingRight: false, fireTimer: seededInt(seed, index + 50, 0, 60),
    classId: type === "turret" ? "heavy-mech" : "swarm",
  };
}

export function createGroundRunCanyonTemplate(seed: number): GroundState {
  return {
    tileMap: canyonMap(),
    cameraX: 0,
    groundEnemies: [
      canyonEnemy(seed, 0, 12 * 32, "patrol"),
      canyonEnemy(seed, 1, 28 * 32, "turret"),
      canyonEnemy(seed, 2, 47 * 32, "patrol"),
    ],
    groundBullets: [], playerOnGround: false, playerVY: 0,
    playerFacingRight: true, goalReached: false,
  };
}

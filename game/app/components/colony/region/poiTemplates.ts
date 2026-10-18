import { createCombatDressing } from "../../engine/worldArt";
import { createKeplerBlackBoxFirstPersonState } from "../../engine/keplerBlackBoxMission";

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
    ...createCombatDressing(state.map, "ruin"),
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

/** Keep site identity and rewards while sharing the existing first-person encounter. */
export function createFirstPersonWreckTemplate(seed: number) {
  const state = createFirstPersonRuinTemplate(seed);
  return { ...state, ...createCombatDressing(state.map, "station"),
    missionLabel: "OATHBREAKER WRECK",
    objectivePickup: state.objectivePickup ? { ...state.objectivePickup, x: 12.5, y: 13.5, label: "WRECK DATA CORE" } : undefined };
}

export function createFirstPersonCanyonTemplate(seed: number) {
  const state = createFirstPersonRuinTemplate(seed);
  return { ...state, missionLabel: "GLASSKNIFE CANYON",
    objectivePickup: state.objectivePickup ? { ...state.objectivePickup, x: 12.5, y: 13.5, label: "CANYON SURVEY CORE" } : undefined };
}

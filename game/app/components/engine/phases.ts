import type {
  CheckpointState,
  GameState,
  PhaseDefinition,
  MultiPhaseLevelData,
  ActivePowerUp,
} from "./types";
import type { LevelData } from "./levels";

/** Snapshot player state at phase entry for checkpoint restart. */
export function createCheckpoint(state: GameState): CheckpointState {
  return {
    hp: state.player.hp,
    maxHp: state.player.maxHp,
    lives: state.lives,
    weaponLevel: state.player.weaponLevel,
    score: state.score,
    kills: state.kills,
    deaths: state.deaths,
    maxCombo: state.maxCombo,
    activePowerUps: [...state.activePowerUps],
  };
}

/** Restore player state from a checkpoint (on retry from phase start). */
export function restoreCheckpoint(
  state: GameState,
  checkpoint: CheckpointState
): Partial<GameState> {
  return {
    score: checkpoint.score,
    lives: checkpoint.lives,
    kills: checkpoint.kills,
    deaths: checkpoint.deaths,
    maxCombo: checkpoint.maxCombo,
    activePowerUps: [...checkpoint.activePowerUps],
    player: {
      ...state.player,
      hp: checkpoint.hp,
      maxHp: checkpoint.maxHp,
      weaponLevel: checkpoint.weaponLevel,
    },
  };
}

/** Wrap a single LevelData as a 1-phase MultiPhaseLevelData. */
export function wrapAsMultiPhase(levelData: LevelData): MultiPhaseLevelData {
  return {
    world: levelData.world,
    level: levelData.level,
    name: levelData.name,
    briefingText: levelData.briefingText,
    worldIntroText: levelData.worldIntroText,
    phases: [
      {
        config: {
          mode: "shooter",
          waves: levelData.waves,
          isBoss: levelData.isBoss,
        },
      },
    ],
  };
}

/** Check if current phase is the last phase. */
export function isLastPhase(state: GameState): boolean {
  return state.currentPhase >= state.totalPhases - 1;
}

/** Get the next phase definition from the multi-phase data. */
export function getNextPhaseTransition(
  phases: PhaseDefinition[],
  currentPhase: number
): PhaseDefinition | null {
  const nextIdx = currentPhase + 1;
  if (nextIdx >= phases.length) return null;
  return phases[nextIdx];
}

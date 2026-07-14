import type { GameState, SaveData } from "../../engine/types";
import { GameScreen } from "../../engine/types";
import { createGameState } from "../../engine/gameEngine";
import { getBoardingSpawn } from "../../engine/boardingLevel";
import { getSpawnPosition as getGroundSpawn } from "../../engine/groundLevel";
import { advanceWorldCycle } from "../shared/cycleProcessor";
import type { ColonyId } from "../shared/colonyTypes";
import type { PoiSession } from "./poiDispatcher";
import { createPoiOutcome, confirmPoiOutcome, type PendingPoiOutcome } from "./poiOutcomes";

export interface ActivePoiDescriptor { originColonyId: ColonyId; session: PoiSession }
export interface PendingPoiResolution {
  originColonyId: ColonyId;
  nodeId: string;
  baseSave: SaveData;
  projectedSave: SaveData;
  outcome: PendingPoiOutcome | null;
}

export function createPoiGameState(session: PoiSession, save: SaveData): GameState {
  const base = createGameState(1, 1, save.upgrades, save.unlockedEnhancements, save.pilotLevel, save.allocatedSkills);
  if (session.engine === "firstPerson") return { ...base, screen: GameScreen.PLAYING, currentMode: "first-person", currentPhase: 0, totalPhases: 1, firstPersonState: session.state, briefingTimer: 0 };
  if (session.engine === "boarding") {
    const spawn = getBoardingSpawn(session.state.map);
    return { ...base, screen: GameScreen.PLAYING, currentMode: "boarding", currentPhase: 0, totalPhases: 1, boardingState: session.state, player: { ...base.player, x: spawn.x, y: spawn.y }, briefingTimer: 0 };
  }
  const spawn = getGroundSpawn(session.state.tileMap);
  return { ...base, screen: GameScreen.PLAYING, currentMode: "ground-run", currentPhase: 0, totalPhases: 1, groundState: session.state, player: { ...base.player, x: spawn.x, y: spawn.y }, briefingTimer: 0 };
}

export function preparePoiCompletion(save: SaveData, activePoi: ActivePoiDescriptor | null, screen: GameScreen): PendingPoiResolution | null {
  if (!activePoi || screen !== GameScreen.LEVEL_COMPLETE) return null;
  const baseSave = advanceWorldCycle(save);
  if (!activePoi.session.rewardEligible) return { originColonyId: activePoi.originColonyId, nodeId: activePoi.session.nodeId, baseSave, projectedSave: baseSave, outcome: null };
  const created = createPoiOutcome(baseSave, activePoi.originColonyId, activePoi.session.nodeId);
  if (!created.ok) return null;
  return { originColonyId: activePoi.originColonyId, nodeId: activePoi.session.nodeId, baseSave, projectedSave: created.save, outcome: created.outcome };
}

export function resolvePoiCompletion(pending: PendingPoiResolution, destinationColonyId: ColonyId | null) {
  if (!pending.outcome) return { ok: true as const, save: pending.baseSave, delivery: null };
  if (!destinationColonyId) return { ok: false as const, save: pending.baseSave, reason: "destination_missing" as const };
  return confirmPoiOutcome(pending.baseSave, pending.outcome, destinationColonyId);
}

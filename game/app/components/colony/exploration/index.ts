import type { SaveData, GameMode, FirstPersonState } from "../../engine/types";
import type { ColonyId, ColonyState } from "../shared/colonyTypes";
import { generateExteriorState } from "./colonyLayout";
import { type SceneStack, type SceneLayer, pushInterior, popToExterior, isInInterior } from "./sceneStack";
import type { ColonyContext, DoorInteractResult, LandingPadResult } from "./colonyContext";

export type { SceneStack, SceneLayer } from "./sceneStack";
export type { ColonyContext, DoorInteractResult, LandingPadResult } from "./colonyContext";

export interface EnterResult {
  mode: GameMode;
  firstPersonState: FirstPersonState;
  sceneStack: SceneStack;
}

export function enterColonyExploration(save: SaveData, colonyId: ColonyId): EnterResult {
  const colony = save.colonies.find(c => c.id === colonyId);
  if (!colony) throw new Error(`[colony/exploration] colony ${colonyId} not found`);
  const firstPersonState = generateExteriorState(colony, save.gameClock);
  const exteriorLayer: SceneLayer = {
    kind: "exterior",
    buildingId: null,
    state: firstPersonState,
    returnToTile: null,
  };
  return {
    mode: "colony-exploration" as GameMode,
    firstPersonState,
    sceneStack: {
      colonyId,
      current: exteriorLayer,
      parent: null,
    },
  };
}

/**
 * Step the exploration state forward one frame.
 * Reads the engine's `colonyTransitionRequest`, performs push/pop if set,
 * and returns the updated SceneStack.
 * Pure function.
 */
export function stepColonyExploration(
  stack: SceneStack,
  save: SaveData,
  _deltaMs: number,
): SceneStack {
  const request = stack.current.state.colonyTransitionRequest as
    | DoorInteractResult
    | LandingPadResult
    | undefined;
  if (!request) return stack;

  // Consume the one-shot request on the current state
  stack.current.state.colonyTransitionRequest = undefined;

  if (request.kind === "enter_interior") {
    // Task 5 implements the interior generator + this full transition
    // Stub: return stack unchanged; Task 5 replaces this body
    return stack;
  }
  if (request.kind === "exit_interior") {
    return popToExterior(stack);
  }
  if (request.kind === "show_exit_menu") {
    // Handled by Game.tsx (opens exitMenu DOM). Orchestrator no-op here.
    return stack;
  }
  return stack;
}

export function exitColonyExploration(_stack: SceneStack): { returnToCockpit: true } {
  return { returnToCockpit: true };
}

export { isInInterior };

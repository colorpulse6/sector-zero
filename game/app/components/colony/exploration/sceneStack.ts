import type { ColonyId, BuildingInstanceId, ColonyBuilding } from "../shared/colonyTypes";
import type { FirstPersonState } from "../../engine/types";
import type { ColonyNpc } from "./npc/types";

export interface SceneLayer {
  kind: "exterior" | "interior";
  buildingId: BuildingInstanceId | null;
  state: FirstPersonState;
  /** Tile coord on the parent (exterior) map where this interior was entered.
   *  Used on popToExterior to re-position the player outside the door. */
  returnToTile: { x: number; y: number } | null;
  /** Phase 5a: the orchestrator-owned NPC movement sidecar. Lives on the EXTERIOR
   *  layer only (interiors have no NPCs). Preserved as `parent` across interior
   *  push/pop, so it survives and resumes on pop. Stepped by stepColonyNpcs. */
  npcSidecar?: ColonyNpc[];
}

export interface SceneStack {
  colonyId: ColonyId;
  current: SceneLayer;
  parent: SceneLayer | null;
}

export function pushInterior(
  stack: SceneStack,
  building: ColonyBuilding,
  interiorState: FirstPersonState,
  returnToTile: { x: number; y: number },
): SceneStack {
  if (stack.parent !== null || stack.current.kind === "interior") {
    throw new Error("[sceneStack] cannot push: already in interior (Phase 2 max depth is 2)");
  }
  return {
    colonyId: stack.colonyId,
    parent: stack.current,
    current: {
      kind: "interior",
      buildingId: building.id,
      state: interiorState,
      returnToTile,
    },
  };
}

export function popToExterior(stack: SceneStack): SceneStack {
  if (!stack.parent) {
    throw new Error("[sceneStack] cannot pop: already at exterior");
  }
  return {
    colonyId: stack.colonyId,
    current: stack.parent,
    parent: null,
  };
}

export function isInInterior(stack: SceneStack): boolean {
  return stack.current.kind === "interior";
}

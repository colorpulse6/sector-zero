import type { SaveData, GameMode, FirstPersonState } from "../../engine/types";
import type { ColonyId, ColonyState } from "../shared/colonyTypes";
import { generateExteriorState, generateInteriorState } from "./colonyLayout";
import { OUTPOST_TEMPLATE } from "./outpostTemplate";
import { BUILDING_FOOTPRINTS } from "./buildingTiles";
import { type SceneStack, type SceneLayer, pushInterior, popToExterior, isInInterior } from "./sceneStack";
import type { ColonyContext, DoorInteractResult, LandingPadResult } from "./colonyContext";
import { generateColonyNpcs } from "./npc/colonyNpcs";
import { stepColonyNpcs } from "./npc/npcStep";

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
  // Phase 5a: populate the exterior with NPCs. generateExteriorState is unchanged;
  // NPC generation happens here and the movement sidecar rides on the exterior layer.
  // Standings drive greeting tone + quartermaster prices/refusal.
  const { fpNpcs, sidecar } = generateColonyNpcs(colony, save.gameClock, firstPersonState.map, save.factionStandings);
  firstPersonState.npcs = fpNpcs;
  const exteriorLayer: SceneLayer = {
    kind: "exterior",
    buildingId: null,
    state: firstPersonState,
    returnToTile: null,
    npcSidecar: sidecar,
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
 * Not pure: consumes colonyTransitionRequest on current.state as a one-shot message.
 */
export function stepColonyExploration(
  stack: SceneStack,
  save: SaveData,
  deltaMs: number,
): SceneStack {
  // Phase 5a: advance NPCs BEFORE the no-transition early return, or they never
  // move on the common frame. Exterior-only — the sidecar lives on the exterior
  // layer, so on interior frames (current.kind === "interior") this no-ops. The
  // sidecar survives interior push/pop (preserved as `parent`) and resumes on pop.
  if (stack.current.kind === "exterior" && stack.current.npcSidecar) {
    stepColonyNpcs(
      stack.current.npcSidecar,
      stack.current.state.npcs,
      stack.current.state.map,
      deltaMs,
      !!stack.current.state.dialogState?.active,
    );
  }

  const request = stack.current.state.colonyTransitionRequest as
    | DoorInteractResult
    | LandingPadResult
    | undefined;
  if (!request) return stack;

  // Consume the one-shot request on the current state
  stack.current.state.colonyTransitionRequest = undefined;

  if (request.kind === "enter_interior") {
    const colony = save.colonies.find(c => c.id === stack.colonyId);
    if (!colony) return stack;
    const building = colony.buildings.find(b => b.id === request.buildingId);
    if (!building) return stack;

    // Derive interior seed from colony seed + buildingId (deterministic, no RNG)
    const hashed = Array.from(request.buildingId).reduce((a, ch) => a * 31 + ch.charCodeAt(0), 0);
    const interiorSeed = colony.layoutSeed ^ hashed;

    const interiorState = generateInteriorState(building, interiorSeed, save.gameClock.hour);
    // Fill in the colonyId on the interior context (it defaults to empty string in the generator)
    interiorState.colonyContext!.colonyId = stack.colonyId;

    // Compute door tile on the exterior (used as returnToTile for when the interior is popped)
    const rotation = colony.layoutSeed % 6;
    const idx = colony.buildings.findIndex(b => b.id === request.buildingId);
    if (idx < 0) return stack;
    const slotId = (rotation + idx) % 6;
    const slot = OUTPOST_TEMPLATE.slots[slotId];
    const fpSpec = BUILDING_FOOTPRINTS[building.type];
    if (!fpSpec) return stack;
    const doorTile = {
      x: fpSpec.doorSide === "east" ? slot.anchorX + fpSpec.w - 1
       : fpSpec.doorSide === "west" ? slot.anchorX
       : slot.anchorX + Math.floor(fpSpec.w / 2),
      y: fpSpec.doorSide === "south" ? slot.anchorY + fpSpec.h - 1
       : fpSpec.doorSide === "north" ? slot.anchorY
       : slot.anchorY + Math.floor(fpSpec.h / 2),
    };

    return pushInterior(stack, building, interiorState, doorTile);
  }
  if (request.kind === "exit_interior") {
    // Grab returnToTile from the (about-to-be-popped) interior layer BEFORE popping
    const stashedReturn = stack.current.returnToTile;
    const popped = popToExterior(stack);

    if (stashedReturn) {
      // Reposition player one tile south of the door, facing south (away from building).
      // Phase 2 assumes all doors are south-facing (all 4 Phase 1 buildings use doorSide: "south").
      // Future footprints with other doorSides will need side-aware repositioning.
      popped.current.state.posX = stashedReturn.x + 0.5;
      popped.current.state.posY = stashedReturn.y + 1.5;
      popped.current.state.dirX = 0;
      popped.current.state.dirY = 1;  // south
      // The camera plane must be reset WITH dir, keeping the same handedness as
      // the exterior's canonical basis (dir (0,-1) × plane (0.66,0) → det
      // planeX*dirY - dirX*planeY = -0.66). Leaving the entry-time plane in
      // place flipped the determinant sign (or sheared the FOV off-cardinal),
      // horizontally mirroring the whole exterior view for the rest of the
      // visit — rotateView preserves det sign, so turning never healed it.
      popped.current.state.planeX = -0.66;
      popped.current.state.planeY = 0;
    }
    popped.current.state.colonyInteractArmed = false;
    popped.current.state.colonyInteractCooldownFrames = 15;
    return popped;
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

export { LandingPadExitMenu } from "./exitMenu";
export type { ExitMenuProps } from "./exitMenu";

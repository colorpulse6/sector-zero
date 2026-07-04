import type { ColonyId, BuildingInstanceId } from "../shared/colonyTypes";

export type DoorInteractResult =
  | { kind: "enter_interior"; buildingId: BuildingInstanceId }
  | { kind: "exit_interior" }
  | { kind: "locked"; reason: string }
  | { kind: "no_door" };

export type LandingPadResult =
  | { kind: "show_exit_menu" }
  | { kind: "not_on_pad" };

export interface ColonyContext {
  colonyId: ColonyId;
  mode: "exterior" | "interior";
  interiorBuildingId: BuildingInstanceId | null;

  /** Engine passes standingOn (floor(posX), floor(posY)) and facingTile
   *  (one cardinal step ahead via dominant-axis of dirX/dirY).
   *  - EXTERIOR mode: check facingTile for an exterior-door tile.
   *  - INTERIOR mode: check standingOn for the exit-door tile. */
  onDoorInteract(
    standingOn: { x: number; y: number },
    facingTile: { x: number; y: number }
  ): DoorInteractResult;

  /** Engine passes standingOn; adapter checks pad region membership. */
  onLandingPadInteract(standingOn: { x: number; y: number }): LandingPadResult;
}

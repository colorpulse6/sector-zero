import type { FPNPC } from "../../../engine/types";

export type Tile = { x: number; y: number };            // coord, NOT a tile-kind string
export type NpcKind = "governor" | "quartermaster" | "colonist";

export interface ColonyNpc {
  id: number;
  kind: NpcKind;
  name: string;
  sprite: string;                 // a SPRITES.NPC_* path; copied to FPNPC.sprite
  posX: number; posY: number;     // continuous tile coords (spawn = homeTile center)
  homeTile: Tile;
  workTile: Tile;                 // placed operational building's door/approach tile (home fallback)
  postTile: Tile | null;          // named NPCs' active-hours station; null for colonists
  targetTile: Tile;               // RESOLVED entry-hour target (scheduleTargetTile); fixed for the visit
  happinessTier: "content" | "strained" | "grim";
  path: Tile[];                   // remaining waypoints to targetTile ([] once arrived)
  pathComputed: boolean;          // A* run once on first step
  millSeed: number;               // deterministic idle-mill offset key
  millCounter?: number;           // accumulates dtF while idle-milling; drives the deterministic drift
  millAnchorX?: number;           // idle-mill anchor, captured from posX/posY the first frame the
  millAnchorY?: number;           //   path empties — mill drifts around this, so an unreachable
                                  //   target mills at spawn instead of teleporting to the target
}

export interface GeneratedNpcs { fpNpcs: FPNPC[]; sidecar: ColonyNpc[]; }

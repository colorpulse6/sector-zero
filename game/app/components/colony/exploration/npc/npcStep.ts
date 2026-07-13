// Per-frame NPC stepping (Phase 5a, Task 6).
//
// Advances the orchestrator-owned ColonyNpc sidecar one frame and syncs each
// NPC's position into its paired, persistent FPNPC render object. All new
// movement logic lives here; the engine stays colony-agnostic (it just renders
// fp.npcs and runs its generic dialog/shop flow).
//
// Boundaries (spec Section C):
//   - Movement PAUSES while a dialog/shop is open (dialogActive) — the plaza
//     holds still while the player talks.
//   - Delta-time scaled via the shared clamp dtF = min(dtMs/16.67, 3).
//   - Each NPC's target is a fixed entry-hour snapshot, so its A* path is
//     computed ONCE (on first step) and then followed; on arrival it idle-mills.
//   - The idle-mill is a small, bounded, DETERMINISTIC drift keyed to a per-NPC
//     millSeed + an accumulating counter, clamped so it never leaves a walkable
//     tile.
//
// FPNPC identity rule (LOAD-BEARING — Codex finding): this MUST mutate
// fpNpcs[i].x/y in place on the SAME objects generation created. It must NEVER
// rebuild the fpNpcs array or replace an element — an open dialog binds to
// dialogState.npcId, and the engine reads each NPC's live x/y straight off
// that same object every frame; replacing objects mid-conversation would
// orphan the dialog and desync its rendered position.

import type { BoardingMap, FPNPC } from "../../../engine/types";
import type { ColonyNpc } from "./types";
import { findPath } from "./npcPathfind";

const NPC_WALK_SPEED = 0.03;   // tiles per frame at 60fps (dtF = 1)
const ARRIVE_EPSILON = 0.02;   // snap distance to a waypoint center
const MILL_RADIUS = 0.3;       // idle-drift amplitude (tiles) around the mill anchor; each
                               //   candidate is walkable-guarded before it's applied
const MILL_FREQ_X = 0.05;      // angular frequency of the X drift (rad per accumulated frame)
const MILL_FREQ_Y = 0.04;      // Y drift frequency — differs from X so the drift traces a Lissajous path

function isWalkable(map: BoardingMap, x: number, y: number): boolean {
  const tx = Math.floor(x), ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return false;
  const t = map.tiles[ty][tx];
  return t === "floor" || t === "door";
}

/**
 * Step every NPC one frame in place. `sidecar[i]` and `fpNpcs[i]` are index-paired
 * (built together in generateColonyNpcs, sharing an id); the engine never reorders
 * fp.npcs, so index pairing stays valid for the visit.
 */
export function stepColonyNpcs(
  sidecar: ColonyNpc[],
  fpNpcs: FPNPC[],            // the SAME persistent FPNPC objects generation created
  map: BoardingMap,
  dtMs: number,
  dialogActive: boolean,
): void {
  // Freeze the whole plaza while the player is in dialog/shop.
  if (dialogActive) return;

  const dtF = Math.min(dtMs / 16.67, 3);

  for (let i = 0; i < sidecar.length; i++) {
    const npc = sidecar[i];

    // 1. Compute the path once (fixed entry-hour target).
    if (!npc.pathComputed) {
      npc.path = findPath(
        map,
        { x: Math.floor(npc.posX), y: Math.floor(npc.posY) },
        npc.targetTile,
      );
      npc.pathComputed = true;
    }

    // Billboard animation input (DOOM overhaul): true only on frames where the
    // NPC actually moved — any path advance, or an idle-mill shuffle that was
    // applied (a mill candidate rejected by the walkable guard holds position
    // → NOT moving). Synced onto the FPNPC below alongside x/y.
    let moved = false;

    if (npc.path.length > 0) {
      // 2. Advance toward the next waypoint's center.
      const wp = npc.path[0];
      const cx = wp.x + 0.5, cy = wp.y + 0.5;
      const dx = cx - npc.posX, dy = cy - npc.posY;
      const dist = Math.hypot(dx, dy);
      const step = NPC_WALK_SPEED * dtF;
      if (dist <= step + ARRIVE_EPSILON) {
        // Snap onto the waypoint and consume it.
        npc.posX = cx;
        npc.posY = cy;
        npc.path.shift();
      } else {
        npc.posX += (dx / dist) * step;
        npc.posY += (dy / dist) * step;
      }
      moved = true;
    } else {
      // 3. Idle-mill — deterministic bounded drift around a fixed anchor. The
      //    anchor is captured ONCE, the first frame the path empties, from the
      //    NPC's CURRENT position: a normal arrival mills around the target
      //    center, while an NPC whose target is unreachable (findPath → [], so it
      //    drops straight here) mills where it stands instead of teleporting
      //    across the map to the target. Keyed to millSeed + an accumulating
      //    counter; only applied if the candidate is walkable, else the NPC holds
      //    its previous (walkable) position.
      if (npc.millAnchorX === undefined || npc.millAnchorY === undefined) {
        npc.millAnchorX = npc.posX;
        npc.millAnchorY = npc.posY;
      }
      const c = (npc.millCounter ?? 0) + dtF;
      npc.millCounter = c;
      const candX = npc.millAnchorX + MILL_RADIUS * Math.sin(c * MILL_FREQ_X + npc.millSeed);
      const candY = npc.millAnchorY + MILL_RADIUS * Math.cos(c * MILL_FREQ_Y + npc.millSeed);
      if (isWalkable(map, candX, candY)) {
        npc.posX = candX;
        npc.posY = candY;
        moved = true;   // idle-mill shuffles count as moving during the shuffle
      }
    }

    // 4. FPNPC identity rule: mutate x/y (and animation state) in place on the
    //    persistent object. NEVER reassign fpNpcs[i] or rebuild the array.
    //    animClockMs accumulates threaded dtMs (never wall time) and drives
    //    resolveNpcSprite's frame selection; the dialog freeze above returns
    //    before this, so the clock — and thus the visible frame — pauses with
    //    the plaza. Inert for NPCs without walk/idle sprites.
    const fp = fpNpcs[i];
    if (fp) {
      fp.x = npc.posX;
      fp.y = npc.posY;
      fp.isMoving = moved;
      fp.animClockMs = (fp.animClockMs ?? 0) + dtMs;
    }
  }
}

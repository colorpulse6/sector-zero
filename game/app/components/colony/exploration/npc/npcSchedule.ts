// Entry-hour schedule resolution (Phase 5a, Task 2).
//
// Pure function — no rendering, no engine mutation, no Date.now/Math.random.
// The game clock is frozen during a colony visit, so each NPC's target tile is
// resolved ONCE at generation from the entry hour and never changes while the
// player is in the colony. Buckets come from the shared bucketForHour so the
// schedule and the day/night tint derive the five buckets from one source.
//
// Section B table (see the Phase 5a design spec):
//   | Entry bucket | Colonist target       | Named-NPC target |
//   | night        | homeTile              | homeTile         |
//   | dawn / day   | workTile              | postTile         |
//   | dusk         | a plaza tile (social) | postTile         |
//   | evening      | homeTile              | homeTile         |

import type { ColonyNpc, Tile } from "./types";
import { bucketForHour } from "../dayNightTint";

/**
 * The single entry-hour target tile for an NPC. Named NPCs are distinguished by
 * a non-null `postTile`; colonists have `postTile === null`. A colonist's dusk
 * plaza tile is chosen deterministically from its id (`plazaTiles[id % len]`) so
 * the crowd spreads across the plaza instead of clumping on one cell.
 *
 * Called once per NPC at generation (`generateColonyNpcs`); the result is stored
 * on `ColonyNpc.targetTile` and is fixed for the visit.
 */
export function scheduleTargetTile(npc: ColonyNpc, hour: number, plazaTiles: Tile[]): Tile {
  const bucket = bucketForHour(hour);

  // Everyone (colonists and named NPCs) heads home at night and in the evening.
  if (bucket === "night" || bucket === "evening") return npc.homeTile;

  // Named NPCs man their fixed station through dawn/day/dusk.
  if (npc.postTile !== null) return npc.postTile;

  // Colonists gather in the plaza at dusk...
  if (bucket === "dusk") {
    return plazaTiles.length > 0 ? plazaTiles[npc.id % plazaTiles.length] : npc.homeTile;
  }

  // ...and are at their work-door through dawn/day.
  return npc.workTile;
}

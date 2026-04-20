import type { ColonyState } from "./colonyTypes";
import { processCycle } from "./cycleProcessor";

/**
 * Catch a colony up from its last-processed cycle to the given target.
 * Reserved for save migrations and dev/debug harnesses — during normal play,
 * every colony is always current (invariant: lastCycleProcessed === missionsSinceStart).
 */
export function catchUpColony(colony: ColonyState, targetCycle: number): ColonyState {
  let next = colony;
  while (next.lastCycleProcessed < targetCycle) {
    next = processCycle(next, next.lastCycleProcessed + 1);
  }
  return next;
}

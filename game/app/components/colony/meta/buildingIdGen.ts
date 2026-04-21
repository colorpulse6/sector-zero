import type { ColonyState, BuildingInstanceId, BuildingType } from "../shared/colonyTypes";

/**
 * Deterministic building ID generator. Uses colony ID + current building count
 * + building type. Matches the threat-ID convention from Phase 0's final-review
 * cleanup — no Date.now, no Math.random.
 *
 * Caveat: if two buildings of the same type are commissioned in the same state
 * snapshot (unreachable in Phase 1 because each click re-dispatches before the
 * next click can fire), IDs could theoretically collide. Phase 1 safety comes
 * from React's event batching + single-writer reducer.
 */
export function genBuildingId(colony: ColonyState, buildingType: BuildingType): BuildingInstanceId {
  return `b-${colony.id}-${colony.buildings.length}-${buildingType}`;
}

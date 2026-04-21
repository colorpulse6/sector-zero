import type { BuildingType, ColonyResources } from "./colonyTypes";

/**
 * Resource production per cycle, per operational building type.
 * Spec Section E authoritative values.
 */
export const RESOURCE_PRODUCTION: Partial<Record<BuildingType, Partial<ColonyResources>>> = {
  farm: { food: 15 },
  water_purifier: { water: 12 },
  mine: { metal: 10 },
  // Marketplace income is population-driven; handled separately in Phase 7a.
};

/**
 * Resource upkeep per cycle, per operational building type.
 * Power-based upkeep is handled via powerGrid, not resource consumption.
 */
export const RESOURCE_UPKEEP: Partial<Record<BuildingType, Partial<ColonyResources>>> = {
  farm: { water: 5 },
  mine: {},
  refinery: { metal: 5 },
  barracks: { food: 3 },
};

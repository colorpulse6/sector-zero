import type { BuildingType, ColonyBuilding, ColonyResources } from "./colonyTypes";

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
 * Population housed per operational habitat_module (OW-0).
 * Single source of truth: the commission menu's "Houses N" copy and the
 * capacity recompute (cycleProcessor + buildingCompleted reducer) both
 * derive from this constant.
 */
export const HABITAT_CAPACITY_PER_MODULE = 10;

/**
 * Derived population capacity for a building roster: 10 per OPERATIONAL
 * habitat_module. Constructing / damaged / offline / destroyed habitats
 * house nobody — a brownout that sheds a habitat really does cost housing.
 */
export function habitatCapacity(buildings: readonly ColonyBuilding[]): number {
  let count = 0;
  for (const b of buildings) {
    if (b.type === "habitat_module" && b.status === "operational") count++;
  }
  return count * HABITAT_CAPACITY_PER_MODULE;
}

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

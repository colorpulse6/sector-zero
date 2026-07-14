import type { ColonyState, PowerGrid, BuildingType } from "./colonyTypes";
import { purifierPowerPenalty } from "../region/siteModifiers";

// Spec Section E: Survival & Infrastructure building catalog.
// These are the authoritative Phase 0 values. Later phases may add richer
// building variants (generators, building tiers); this table is the baseline.
const POWER_CAPACITY: Partial<Record<BuildingType, number>> = {
  solar_array: 10,
};

const POWER_DEMAND: Partial<Record<BuildingType, number>> = {
  farm: 2,
  water_purifier: 3,
  mine: 3,
  refinery: 10,
  habitat_module: 2,
  med_bay: 5,
  marketplace: 2,
  cantina: 2,
  town_hall: 4,
  barracks: 5,
  turret_defense: 4,
  shield_generator: 8,
  radar_array: 3,
  comms_tower: 3,
  research_lab: 8,
  spaceport: 10,
  atmosphere_processor: 15,
};

export function derivePowerGrid(colony: ColonyState): PowerGrid {
  let capacity = 0;
  let demand = 0;
  for (const building of colony.buildings) {
    if (building.status !== "operational") continue;
    capacity += POWER_CAPACITY[building.type] ?? 0;
    demand += powerDemandOf(building.type, colony);
  }
  return { capacity, demand, surplus: capacity - demand };
}

export function powerCapacityOf(buildingType: BuildingType): number {
  return POWER_CAPACITY[buildingType] ?? 0;
}

export function powerDemandOf(buildingType: BuildingType, colony?: Pick<ColonyState, "siteStats">): number {
  const base = POWER_DEMAND[buildingType] ?? 0;
  return buildingType === "water_purifier" && colony ? base + purifierPowerPenalty(colony) : base;
}

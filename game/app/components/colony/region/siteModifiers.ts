import type { ColonyState } from "../shared/colonyTypes";

export function mineOutputForSite(colony: Pick<ColonyState, "siteStats">, baseOutput: number): number {
  const ore = Math.max(0, Math.min(100, colony.siteStats.oreDensity));
  return Math.max(0, Math.round(baseOutput * (0.5 + ore / 100)));
}

export function purifierPowerPenalty(colony: Pick<ColonyState, "siteStats">): number {
  const water = Math.max(0, Math.min(100, colony.siteStats.waterTable));
  return Math.min(2, Math.ceil(Math.max(0, 50 - water) / 25));
}

export function hasBuildableSlot(colony: Pick<ColonyState, "siteStats" | "buildings">): boolean {
  return colony.buildings.length < Math.max(0, colony.siteStats.buildableSlots);
}

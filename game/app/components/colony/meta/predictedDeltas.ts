import { RESOURCE_PRODUCTION, RESOURCE_UPKEEP } from "../shared/colonyCatalog";
import type { ColonyState } from "../shared/colonyTypes";
import { mineOutputForSite } from "../region/siteModifiers";

export type StockpileDelta = {
  food: number;
  water: number;
  metal: number;
};

/**
 * Predict per-cycle deltas for the three stockpile resources based on the
 * current colony state. Credits omitted — no Phase 1 source for them.
 * Power is a derived grid value, not a stockpile, and is computed separately
 * via derivePowerGrid.
 *
 * Mirrors cycleProcessor.ts step1/2/3 math so the UI hint matches what will
 * actually happen on the next mission completion.
 */
export function predictedDeltas(colony: ColonyState): StockpileDelta {
  const delta: StockpileDelta = { food: 0, water: 0, metal: 0 };

  for (const b of colony.buildings) {
    if (b.status !== "operational") continue;
    const prod = RESOURCE_PRODUCTION[b.type];
    if (prod?.food) delta.food += prod.food;
    if (prod?.water) delta.water += prod.water;
    if (prod?.metal) delta.metal += b.type === "mine" ? mineOutputForSite(colony, prod.metal) : prod.metal;
  }

  for (const b of colony.buildings) {
    if (b.status !== "operational") continue;
    const up = RESOURCE_UPKEEP[b.type];
    if (up?.food) delta.food -= up.food;
    if (up?.water) delta.water -= up.water;
    if (up?.metal) delta.metal -= up.metal;
  }

  delta.food -= colony.population.total;
  delta.water -= Math.floor(colony.population.total * 0.5);

  return delta;
}

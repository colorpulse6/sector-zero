import type { BuildingType, ColonyBuilding, ColonyState } from "../../colony/shared/colonyTypes";
import { BUILD_SPECS, habitatCapacity } from "../../colony/shared/colonyCatalog";
import { happinessFactors, processCycle, type HappinessFactorId } from "../../colony/shared/cycleProcessor";
import { powerCapacityOf, powerDemandOf } from "../../colony/shared/powerGrid";
import { hasBuildableSlot } from "../../colony/region/siteModifiers";

/**
 * Settlement rules for galaxy colonies (spec 2026-10-18-ashfall-settlement-loop-design §3).
 * They read one colony and never change the shared cost, power or cycle rules. The command,
 * its re-quote and the management screen all call `settlementCommissionBlock`.
 */

const RESOURCE_KEYS = ["food", "water", "metal", "credits"] as const;
const MINE_COST = BUILD_SPECS.mine?.cost.metal ?? 0;
const SOLAR_COST = BUILD_SPECS.solar_array?.cost.metal ?? 0;
const MINE_POWER = powerDemandOf("mine");
const SETTLER_HAPPINESS = 60;

export interface PlannedPower {
  capacity: number;
  demand: number;
  spare: number;
}

export type SettlementBlockReason = "no_buildable_slot" | "insufficient_power" | "insufficient_resources" | "mine_first";
export interface SettlementBlock {
  reason: SettlementBlockReason;
  message: string;
}

function planned(building: ColonyBuilding): boolean {
  return building.status === "operational" || building.status === "constructing";
}

/** Power once everything operational or under construction is running. */
export function plannedPower(colony: ColonyState): PlannedPower {
  let capacity = 0;
  let demand = 0;
  for (const building of colony.buildings) {
    if (!planned(building)) continue;
    capacity += powerCapacityOf(building.type);
    demand += powerDemandOf(building.type, colony);
  }
  return { capacity, demand, spare: capacity - demand };
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "S"}`;
}

/**
 * Why `type` may not be commissioned now, or null. Order: slot, power, metal, mine first.
 * Which types a run supports is the command's decision, not this rule's.
 * Power: a consumer needs planned spare power, so the command can never cause a brownout.
 * Mine first: until a mine is planned, scarce metal and slots stay available for a powered mine.
 */
export function settlementCommissionBlock(colony: ColonyState, type: BuildingType): SettlementBlock | null {
  const cost = BUILD_SPECS[type]?.cost ?? {};
  if (!hasBuildableSlot(colony)) return { reason: "no_buildable_slot", message: "NO BUILDABLE SLOT" };
  const power = plannedPower(colony);
  const need = powerDemandOf(type, colony);
  if (need > 0 && power.spare < need) {
    return {
      reason: "insufficient_power",
      message: `NEEDS ${need} POWER · ${Math.max(0, power.spare)} SPARE · BUILD A SOLAR ARRAY`,
    };
  }
  if (RESOURCE_KEYS.some(key => (cost[key] ?? 0) > colony.resources[key])) {
    return { reason: "insufficient_resources", message: "NOT ENOUGH RESOURCES" };
  }
  if (type === "mine" || colony.buildings.some(b => b.type === "mine" && planned(b))) return null;
  const spareAfter = power.spare + powerCapacityOf(type) - need;
  const minePower = spareAfter < MINE_POWER;
  const powersTheMine = type === "solar_array" && power.spare < MINE_POWER;
  const keepMetal = powersTheMine ? 0 : MINE_COST + (minePower ? SOLAR_COST : 0);
  const keepSlots = 1 + (minePower ? 1 : 0);
  const metalAfter = colony.resources.metal - (cost.metal ?? 0);
  const slotsAfter = colony.siteStats.buildableSlots - colony.buildings.length - 1;
  if (metalAfter >= keepMetal && slotsAfter >= keepSlots) return null;
  const keep = [keepMetal > 0 ? `${keepMetal} METAL` : null, plural(keepSlots, "SLOT")].filter(Boolean).join(" AND ");
  return { reason: "mine_first", message: `MINE FIRST · KEEP ${keep} FOR IT` };
}

const FACTOR_LABELS: Record<HappinessFactorId, string> = {
  food_stock: "FOOD STOCK OVER 2× SETTLERS",
  food_short: "FOOD STOCK UNDER SETTLERS",
  water_stock: "WATER STOCK OVER SETTLERS",
  water_short: "WATER STOCK UNDER HALF THE SETTLERS",
  power_ok: "POWERED GRID",
  power_deficit: "POWER DEFICIT",
  overcrowded: "OVERCROWDED",
  med_bay: "MED BAY",
  marketplace: "MARKETPLACE",
  barracks: "BARRACKS",
  recent_attack: "RECENT ATTACK",
};

export interface SettlementFactor {
  id: HappinessFactorId;
  label: string;
  delta: number;
  met: boolean;
}

export interface SettlementOutlook {
  housing: { settlers: number; capacity: number; free: number };
  /** Drives the next cycle's arrivals (growth reads the stored value). */
  happiness: number;
  nextHappiness: number;
  /** The terms of `nextHappiness`. */
  factors: SettlementFactor[];
  /** Net settlers after the next cycle, from a preview run of `processCycle`. */
  settlerChange: number;
  /** Why no settler arrives next cycle; null when one does. */
  waiting: string | null;
}

/** Preview the next cycle with the real cycle processor; nothing is saved. */
export function settlementOutlook(colony: ColonyState, worldCycle: number): SettlementOutlook {
  const next = processCycle(colony, worldCycle + 1);
  const settlerChange = next.population.total - colony.population.total;
  const housingNow = habitatCapacity(colony.buildings);
  let waiting: string | null = null;
  if (settlerChange <= 0) {
    const pendingHabitat = colony.buildings
      .filter(b => b.type === "habitat_module" && b.status === "constructing")
      .map(b => b.buildProgressCycles);
    if (housingNow === 0 && pendingHabitat.length > 0) {
      waiting = `HOUSING READY IN ${plural(Math.min(...pendingHabitat), "CYCLE")}`;
    } else if (housingNow === 0) {
      waiting = "NO HOUSING · BUILD A HABITAT MODULE";
    } else if (colony.population.total >= housingNow) {
      waiting = "HOUSING FULL";
    } else {
      waiting = `HAPPINESS ${colony.happiness} · SETTLERS NEED OVER ${SETTLER_HAPPINESS}`;
    }
  }
  return {
    housing: {
      settlers: colony.population.total,
      capacity: colony.population.capacity,
      free: Math.max(0, colony.population.capacity - colony.population.total),
    },
    happiness: colony.happiness,
    nextHappiness: next.happiness,
    // Happiness is computed before threat timers expire in the same cycle.
    factors: happinessFactors({ ...next, activeThreats: colony.activeThreats })
      .map(factor => ({ ...factor, label: FACTOR_LABELS[factor.id] })),
    settlerChange,
    waiting,
  };
}

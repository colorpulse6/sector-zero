import type { ColonyState, ColonyResources } from "./colonyTypes";
import type { SaveData } from "../../engine/types";
import { derivePowerGrid, powerCapacityOf, powerDemandOf } from "./powerGrid";
import { runStandardInvariants } from "./colonyAssert";
import { RESOURCE_PRODUCTION, RESOURCE_UPKEEP } from "./colonyCatalog";

export function processCycle(colony: ColonyState, toCycle: number): ColonyState {
  let state = colony;
  state = step1_production(state);
  state = step2_populationConsumption(state);
  state = step3_buildingUpkeep(state);
  state = step4_populationChange(state);
  state = step5_happinessRecompute(state);
  state = step6_threatProgression(state);
  state = step7_earthShipmentTick(state);
  state = step8_questTick(state);
  state = step9_bountyDecay(state);
  state = step10_finalize(state, toCycle);
  return state;
}

function step1_production(c: ColonyState): ColonyState {
  const delta: Partial<ColonyResources> = { food: 0, water: 0, metal: 0, credits: 0 };
  for (const b of c.buildings) {
    if (b.status !== "operational") continue;
    const prod = RESOURCE_PRODUCTION[b.type];
    if (!prod) continue;
    if (prod.food) delta.food! += prod.food;
    if (prod.water) delta.water! += prod.water;
    if (prod.metal) delta.metal! += prod.metal;
    if (prod.credits) delta.credits! += prod.credits;
  }
  return applyResourceDelta(c, delta);
}

function step2_populationConsumption(c: ColonyState): ColonyState {
  const pop = c.population.total;
  const foodNeed = pop;
  const waterNeed = Math.floor(pop * 0.5);
  return applyResourceDelta(c, { food: -foodNeed, water: -waterNeed });
}

function step3_buildingUpkeep(c: ColonyState): ColonyState {
  let state = c;
  const delta: Partial<ColonyResources> = { food: 0, water: 0, metal: 0 };
  for (const b of c.buildings) {
    if (b.status !== "operational") continue;
    const up = RESOURCE_UPKEEP[b.type];
    if (!up) continue;
    if (up.food) delta.food! -= up.food;
    if (up.water) delta.water! -= up.water;
    if (up.metal) delta.metal! -= up.metal;
  }
  state = applyResourceDelta(state, delta);

  // Power grid brownout: if surplus < 0, shed operational consumers until covered.
  // Never shed buildings that contribute capacity (would deepen the deficit).
  const grid = derivePowerGrid(state);
  if (grid.surplus < 0) {
    const deficit = -grid.surplus;
    let shed = 0;
    const nextBuildings = state.buildings.map(b => ({ ...b }));
    for (const b of state.buildings) {
      if (shed >= deficit) break;
      if (b.status !== "operational") continue;
      if (powerCapacityOf(b.type) > 0) continue;  // never shed a capacity producer
      const demand = powerDemandOf(b.type);
      if (demand <= 0) continue;                    // no point shedding a zero-demand building
      const i = nextBuildings.findIndex(nb => nb.id === b.id);
      nextBuildings[i].status = "offline";
      shed += demand;                               // accumulate in power units
    }
    state = { ...state, buildings: nextBuildings };
  }
  return state;
}

function step4_populationChange(c: ColonyState): ColonyState {
  const h = c.happiness;
  let newborns = 0;
  let departures = 0;
  if (h > 60) {
    newborns = Math.floor(c.population.total * 0.02 * (h / 100));
  }
  if (h < 40) {
    departures = Math.floor(c.population.total * 0.05 * ((40 - h) / 40));
  }
  const nextTotal = Math.max(0, Math.min(c.population.capacity, c.population.total + newborns - departures));
  return {
    ...c,
    population: { ...c.population, total: nextTotal, growthRate: newborns - departures },
  };
}

function step5_happinessRecompute(c: ColonyState): ColonyState {
  let h = 50; // baseline
  if (c.resources.food > c.population.total * 2) h += 15;
  if (c.resources.food < c.population.total) h -= 30;
  if (c.resources.water > c.population.total) h += 10;
  if (c.resources.water < c.population.total * 0.5) h -= 25;
  const grid = derivePowerGrid(c);
  if (grid.surplus >= 0 && grid.demand > 0) h += 5;
  if (grid.surplus < 0) h -= 20;
  if (c.population.total > c.population.capacity) h -= 20;
  const hasMedBay = c.buildings.some(b => b.type === "med_bay" && b.status === "operational");
  if (hasMedBay) h += 10;
  const hasMarketplace = c.buildings.some(b => b.type === "marketplace" && b.status === "operational");
  if (hasMarketplace) h += 10;
  const hasBarracks = c.buildings.some(b => b.type === "barracks" && b.status === "operational");
  if (hasBarracks) h += 5;
  const recentAttack = c.activeThreats.some(t => t.kind === "raid_incoming" || t.kind === "siege_ongoing");
  if (recentAttack) h -= 15;
  return { ...c, happiness: Math.max(0, Math.min(100, h)) };
}

function step6_threatProgression(c: ColonyState): ColonyState {
  // Phase 0 stub: tick down threat timers. Full resolution logic in Phase 8.
  if (c.activeThreats.length === 0) return c;
  const nextThreats = c.activeThreats
    .map(t => ({ ...t, cyclesUntilResolve: t.cyclesUntilResolve - 1 }))
    .filter(t => t.cyclesUntilResolve > 0);
  return { ...c, activeThreats: nextThreats };
}

function step7_earthShipmentTick(c: ColonyState): ColonyState {
  // Phase 0 stub: shipment tick lives at the save level (advanceWorldCycle).
  // Full interception rolls and arrival handling lands in Phase 7b.
  return c;
}

function step8_questTick(c: ColonyState): ColonyState {
  // Phase 0 stub: quest tick lives at the save level. Lands in Phase 10.
  return c;
}

function step9_bountyDecay(c: ColonyState): ColonyState {
  // Phase 0 stub: bounties are save-level. Decay logic lands in Phase 5b.
  return c;
}

function step10_finalize(c: ColonyState, toCycle: number): ColonyState {
  const selfSufficient =
    c.resources.food >= c.population.total &&
    c.resources.water >= Math.floor(c.population.total * 0.5) &&
    c.happiness >= 50;
  return { ...c, lastCycleProcessed: toCycle, selfSufficient };
}

function applyResourceDelta(c: ColonyState, delta: Partial<ColonyResources>): ColonyState {
  const nextResources = { ...c.resources };
  if (delta.food !== undefined) nextResources.food = Math.max(0, nextResources.food + delta.food);
  if (delta.water !== undefined) nextResources.water = Math.max(0, nextResources.water + delta.water);
  if (delta.metal !== undefined) nextResources.metal = Math.max(0, nextResources.metal + delta.metal);
  if (delta.credits !== undefined) nextResources.credits = Math.max(0, nextResources.credits + delta.credits);
  return { ...c, resources: nextResources };
}

/**
 * World-level cycle orchestrator. Called on mission completion.
 * Increments missionsSinceStart by exactly 1 and runs processCycle for every colony.
 * Invariants are asserted after each colony's cycle — panics loudly in dev, no-op in prod.
 */
export function advanceWorldCycle(save: SaveData): SaveData {
  const newCycle = save.missionsSinceStart + 1;
  const nextColonies = save.colonies.map(c => {
    const next = processCycle(c, newCycle);
    runStandardInvariants(next);
    return next;
  });
  return { ...save, colonies: nextColonies, missionsSinceStart: newCycle };
}

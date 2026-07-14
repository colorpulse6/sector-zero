import type { SaveData } from "../../engine/types";
import type { ColonyEvent } from "./colonyEvents";
import type { ColonyState } from "./colonyTypes";
import { rankFromStanding } from "./factionLedger";
import { habitatCapacity } from "./colonyCatalog";
import { neutralSiteStats } from "../region/regionMap";

export function colonyReducer(state: SaveData, event: ColonyEvent): SaveData {
  switch (event.type) {
    case "colony/founded":
      return handleFounded(state, event.payload);
    case "colony/buildingCommissioned":
      return handleBuildingCommissioned(state, event.payload);
    case "colony/buildingCompleted":
      return handleBuildingCompleted(state, event.payload);
    case "colony/cycleAdvanced":
      return handleCycleAdvanced(state, event.payload);
    case "colony/resourceChanged":
      return handleResourceChanged(state, event.payload);
    case "colony/npcKilled":
      return handleNpcKilled(state, event.payload);
    case "colony/witnessed":
      return handleWitnessed(state, event.payload);
    case "colony/standingChanged":
      return handleStandingChanged(state, event.payload);
    case "colony/attackIncoming":
      return handleAttackIncoming(state, event.payload);
    case "colony/poiCleared":
      return handlePoiCleared(state, event.payload);
    case "colony/regionSurveyed":
      return handleRegionSurveyed(state, event.payload);
    case "colony/shipmentOrdered":
      return handleShipmentOrdered(state, event.payload);
    case "colony/shipmentArrived":
      return handleShipmentArrived(state, event.payload);
    default: {
      // Exhaustiveness check: if a new ColonyEvent variant is added to the union
      // without a corresponding handler above, this line will fail to compile
      // ("Type 'X' is not assignable to type 'never'").
      const _exhaustive: never = event;
      void _exhaustive;  // suppress "declared but not used" in strict unused-locals
      return state;
    }
  }
}

function handleFounded(
  state: SaveData,
  p: Extract<ColonyEvent, { type: "colony/founded" }>["payload"]
): SaveData {
  if (state.colonies.some(c => c.id === p.colonyId)) {
    throw new Error(`[colonyReducer] colony/founded: colony ${p.colonyId} already exists`);
  }
  const foundingPlanet = state.planets.find(planet => planet.id === p.planetId);
  if (foundingPlanet) {
    const foundingNode = foundingPlanet.regionMap.nodes.find(node => node.id === p.regionNodeId);
    if (!foundingNode || foundingNode.type !== "colony_site" || foundingNode.intel !== "surveyed") {
      return state;
    }
  }
  const newColony: ColonyState = {
    id: p.colonyId,
    name: p.name,
    planetId: p.planetId,
    foundingType: p.foundingType,
    tier: 1,
    regionNodeId: p.regionNodeId,
    siteStats: neutralSiteStats(),
    population: { total: 0, capacity: 0, namedCount: 0, growthRate: 0, recentDeaths: [] },
    resources: { food: 0, water: 0, metal: 0, credits: 0 },
    buildings: [],
    districts: [],
    namedNpcs: [],
    backgroundColonistDensity: 0,
    happiness: 50,
    selfSufficient: false,
    lastCycleProcessed: p.missionCount,
    lastGameClock: { day: 0, hour: 7, minute: 0, realtimeMsPerGameMinute: 1000, season: "standard" },
    activeThreats: [],
    activeQuestlines: [],
    discoveredPoiIds: [],
    layoutSeed: p.layoutSeed,
    founded: { missionCount: p.missionCount, gameClockTick: 0 },
  };
  const colonies = [...state.colonies, newColony];
  const planets = state.planets.map(planet => {
    if (planet.id !== p.planetId) return planet;
    const nodeIdx = planet.regionMap.nodes.findIndex(node => node.id === p.regionNodeId);
    if (nodeIdx < 0) return planet;
    const nodes = [...planet.regionMap.nodes];
    nodes[nodeIdx] = {
      ...nodes[nodeIdx],
      intel: "claimed",
      discovered: true,
      cleared: true,
    };
    return { ...planet, regionMap: { ...planet.regionMap, nodes } };
  });
  return { ...state, colonies, planets };
}

function handleBuildingCommissioned(
  state: SaveData,
  p: Extract<ColonyEvent, { type: "colony/buildingCommissioned" }>["payload"]
): SaveData {
  const idx = state.colonies.findIndex(c => c.id === p.colonyId);
  if (idx < 0) throw new Error(`[colonyReducer] buildingCommissioned: colony ${p.colonyId} not found`);
  const colony = state.colonies[idx];

  const nextResources = { ...colony.resources };
  for (const [k, v] of Object.entries(p.costDeducted)) {
    if (v === undefined) continue;
    nextResources[k as keyof typeof nextResources] -= v;
  }

  const nextColony: ColonyState = {
    ...colony,
    resources: nextResources,
    buildings: [
      ...colony.buildings,
      {
        id: p.buildingId,
        type: p.buildingType,
        tier: 1,
        status: "constructing",
        buildProgressCycles: p.cyclesToBuild,
        hp: 100,
        maxHp: 100,
        interiorTemplateId: null,
        assignedNpcIds: [],
        districtId: null,
      },
    ],
  };
  const nextColonies = [...state.colonies];
  nextColonies[idx] = nextColony;
  return { ...state, colonies: nextColonies };
}

function handleBuildingCompleted(
  state: SaveData,
  p: Extract<ColonyEvent, { type: "colony/buildingCompleted" }>["payload"]
): SaveData {
  const idx = state.colonies.findIndex(c => c.id === p.colonyId);
  if (idx < 0) throw new Error(`[colonyReducer] buildingCompleted: colony ${p.colonyId} not found`);
  const colony = state.colonies[idx];
  const bIdx = colony.buildings.findIndex(b => b.id === p.buildingId);
  if (bIdx < 0) throw new Error(`[colonyReducer] buildingCompleted: building ${p.buildingId} not found`);
  const nextBuildings = [...colony.buildings];
  nextBuildings[bIdx] = { ...nextBuildings[bIdx], status: "operational", buildProgressCycles: 0 };
  const nextColonies = [...state.colonies];
  // OW-0: capacity is derived from operational habitats — recompute immediately
  // so a habitat completing construction houses colonists without waiting a cycle.
  nextColonies[idx] = {
    ...colony,
    buildings: nextBuildings,
    population: { ...colony.population, capacity: habitatCapacity(nextBuildings) },
  };
  return { ...state, colonies: nextColonies };
}

function handleCycleAdvanced(state: SaveData, p: Extract<ColonyEvent, { type: "colony/cycleAdvanced" }>["payload"]): SaveData {
  const idx = state.colonies.findIndex(c => c.id === p.colonyId);
  if (idx < 0) throw new Error(`[colonyReducer] cycleAdvanced: colony ${p.colonyId} not found`);
  const colony = state.colonies[idx];
  const nextResources = { ...colony.resources };
  for (const [k, v] of Object.entries(p.resourceDelta)) {
    if (v === undefined) continue;
    nextResources[k as keyof typeof nextResources] += v;
  }
  const nextColonies = [...state.colonies];
  nextColonies[idx] = {
    ...colony,
    lastCycleProcessed: p.toCycle,
    resources: nextResources,
    population: { ...colony.population, total: Math.max(0, colony.population.total + p.populationDelta) },
    happiness: Math.max(0, Math.min(100, p.happinessAfter)),
  };
  return { ...state, colonies: nextColonies };
}

function handleResourceChanged(state: SaveData, p: Extract<ColonyEvent, { type: "colony/resourceChanged" }>["payload"]): SaveData {
  const idx = state.colonies.findIndex(c => c.id === p.colonyId);
  if (idx < 0) throw new Error(`[colonyReducer] resourceChanged: colony ${p.colonyId} not found`);
  const colony = state.colonies[idx];
  const nextResources = { ...colony.resources };
  for (const [k, v] of Object.entries(p.delta)) {
    if (v === undefined) continue;
    nextResources[k as keyof typeof nextResources] += v;
  }
  const nextColonies = [...state.colonies];
  nextColonies[idx] = { ...colony, resources: nextResources };
  return { ...state, colonies: nextColonies };
}

function handleNpcKilled(state: SaveData, p: Extract<ColonyEvent, { type: "colony/npcKilled" }>["payload"]): SaveData {
  // Phase 0 stub — full NPC lifecycle in Phase 5a.
  void state; void p;
  return state;
}

function handleWitnessed(state: SaveData, p: Extract<ColonyEvent, { type: "colony/witnessed" }>["payload"]): SaveData {
  // Phase 0 stub — full bounty issuance in Phase 5b.
  void state; void p;
  return state;
}

function handleStandingChanged(state: SaveData, p: Extract<ColonyEvent, { type: "colony/standingChanged" }>["payload"]): SaveData {
  const idx = state.factionStandings.findIndex(f => f.factionId === p.factionId);
  const rank = rankFromStanding(p.newStanding);
  if (idx < 0) {
    return {
      ...state,
      factionStandings: [...state.factionStandings, { factionId: p.factionId, standing: p.newStanding, rank, permissions: [] }],
    };
  }
  const next = [...state.factionStandings];
  next[idx] = { ...next[idx], standing: p.newStanding, rank };
  return { ...state, factionStandings: next };
}

function handleAttackIncoming(state: SaveData, p: Extract<ColonyEvent, { type: "colony/attackIncoming" }>["payload"]): SaveData {
  const idx = state.colonies.findIndex(c => c.id === p.colonyId);
  if (idx < 0) throw new Error(`[colonyReducer] attackIncoming: colony ${p.colonyId} not found`);
  const colony = state.colonies[idx];
  const next = [...state.colonies];
  next[idx] = {
    ...colony,
    activeThreats: [...colony.activeThreats, {
      id: `threat-${p.colonyId}-${colony.activeThreats.length}-${p.threatKind}`,
      kind: p.threatKind,
      cyclesUntilResolve: p.cyclesUntilResolve,
      severity: "minor",
      targetBuildingId: null,
      payload: {},
    }],
  };
  return { ...state, colonies: next };
}

function handlePoiCleared(state: SaveData, p: Extract<ColonyEvent, { type: "colony/poiCleared" }>["payload"]): SaveData {
  const colony = state.colonies.find(c => c.id === p.colonyId);
  if (!colony) return state;
  const planet = state.planets.find(pl => pl.id === colony.planetId);
  if (!planet) return state;
  const nodeIdx = planet.regionMap.nodes.findIndex(n => n.id === p.regionNodeId);
  if (nodeIdx < 0) return state;
  const nextNodes = [...planet.regionMap.nodes];
  nextNodes[nodeIdx] = {
    ...nextNodes[nodeIdx],
    intel: "cleared",
    discovered: true,
    cleared: true,
  };
  const nextPlanets = state.planets.map(pl =>
    pl.id === colony.planetId
      ? { ...pl, regionMap: { ...pl.regionMap, nodes: nextNodes } }
      : pl
  );
  return { ...state, planets: nextPlanets };
}

function handleRegionSurveyed(
  state: SaveData,
  p: Extract<ColonyEvent, { type: "colony/regionSurveyed" }>["payload"],
): SaveData {
  const colony = state.colonies.find(entry => entry.id === p.colonyId);
  if (!colony) return state;
  const planetIdx = state.planets.findIndex(planet => planet.id === colony.planetId);
  if (planetIdx < 0) return state;
  const planet = state.planets[planetIdx];
  const origin = planet.regionMap.nodes.find(node => node.id === colony.regionNodeId);
  const target = planet.regionMap.nodes.find(node => node.id === p.regionNodeId);
  if (!origin || origin.intel !== "claimed" || !target || target.intel !== "rumored") {
    return state;
  }
  const isAdjacent = planet.regionMap.edges.some(([from, to]) =>
    (from === origin.id && to === target.id) || (from === target.id && to === origin.id)
  );
  if (!isAdjacent) return state;

  const adjacent = new Set<string>();
  for (const [from, to] of planet.regionMap.edges) {
    if (from === p.regionNodeId) adjacent.add(to);
    if (to === p.regionNodeId) adjacent.add(from);
  }
  const nodes = planet.regionMap.nodes.map(node => {
    if (node.id === p.regionNodeId) {
      return { ...node, intel: "surveyed" as const, discovered: true, cleared: false };
    }
    if (adjacent.has(node.id) && node.intel === "unknown") {
      return { ...node, intel: "rumored" as const, discovered: true };
    }
    return node;
  });
  const planets = [...state.planets];
  planets[planetIdx] = { ...planet, regionMap: { ...planet.regionMap, nodes } };
  return { ...state, planets };
}

function handleShipmentOrdered(state: SaveData, p: Extract<ColonyEvent, { type: "colony/shipmentOrdered" }>["payload"]): SaveData {
  return {
    ...state,
    earthShipments: [...state.earthShipments, {
      id: p.shipmentId,
      contents: p.contents,
      eta: { missionCount: state.missionsSinceStart + p.etaCycles },
      interceptionChance: 0,
      interceptionTriggered: false,
      destinationColonyId: p.colonyId,
      costPaid: p.costPaid,
    }],
  };
}

function handleShipmentArrived(state: SaveData, p: Extract<ColonyEvent, { type: "colony/shipmentArrived" }>["payload"]): SaveData {
  const shipmentIdx = state.earthShipments.findIndex(s => s.id === p.shipmentId);
  if (shipmentIdx < 0) return state;
  const colonyIdx = state.colonies.findIndex(c => c.id === p.colonyId);
  if (colonyIdx < 0) return state;

  const colony = state.colonies[colonyIdx];
  const nextResources = { ...colony.resources };
  if (p.delivered.food !== undefined) nextResources.food += p.delivered.food;
  if (p.delivered.water !== undefined) nextResources.water += p.delivered.water;
  if (p.delivered.metal !== undefined) nextResources.metal += p.delivered.metal;
  if (p.delivered.credits !== undefined) nextResources.credits += p.delivered.credits;

  const nextColonies = [...state.colonies];
  nextColonies[colonyIdx] = { ...colony, resources: nextResources };

  const nextShipments = state.earthShipments.filter(s => s.id !== p.shipmentId);
  return { ...state, colonies: nextColonies, earthShipments: nextShipments };
}

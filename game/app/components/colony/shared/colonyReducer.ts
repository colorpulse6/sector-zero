import type { SaveData } from "../../engine/types";
import type { ColonyEvent } from "./colonyEvents";
import type { ColonyState } from "./colonyTypes";

export function colonyReducer(state: SaveData, event: ColonyEvent): SaveData {
  switch (event.type) {
    case "colony/founded":
      return handleFounded(state, event.payload);
    case "colony/buildingCommissioned":
      return handleBuildingCommissioned(state, event.payload);
    case "colony/buildingCompleted":
      return handleBuildingCompleted(state, event.payload);
    default:
      // Phase 0 implements a subset of events; remaining handlers land in T10/T11.
      return state;
  }
}

function handleFounded(
  state: SaveData,
  p: Extract<ColonyEvent, { type: "colony/founded" }>["payload"]
): SaveData {
  if (state.colonies.some(c => c.id === p.colonyId)) {
    throw new Error(`[colonyReducer] colony/founded: colony ${p.colonyId} already exists`);
  }
  const newColony: ColonyState = {
    id: p.colonyId,
    name: p.name,
    planetId: p.planetId,
    foundingType: p.foundingType,
    tier: 1,
    regionNodeId: p.regionNodeId,
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
  return { ...state, colonies: [...state.colonies, newColony] };
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
  nextColonies[idx] = { ...colony, buildings: nextBuildings };
  return { ...state, colonies: nextColonies };
}

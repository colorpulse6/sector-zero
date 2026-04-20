import type { SaveData } from "../../engine/types";
import type { ColonyEvent } from "./colonyEvents";
import type { ColonyState } from "./colonyTypes";

export function colonyReducer(state: SaveData, event: ColonyEvent): SaveData {
  switch (event.type) {
    case "colony/founded":
      return handleFounded(state, event.payload);
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

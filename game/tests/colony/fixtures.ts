import type { ColonyState, ColonyId } from "../../app/components/colony/shared/colonyTypes";
import type { PlanetId } from "../../app/components/engine/types";

export function makeTestColony(overrides: Partial<ColonyState> = {}): ColonyState {
  return {
    id: "test-colony-1" as ColonyId,
    name: "Test Colony",
    planetId: "ashfall" as PlanetId,
    foundingType: "outpost",
    tier: 1,
    regionNodeId: "test-region-node-1",
    population: {
      total: 0,
      capacity: 0,
      namedCount: 0,
      growthRate: 0,
      recentDeaths: [],
    },
    resources: { food: 0, water: 0, metal: 0, credits: 0 },
    buildings: [],
    districts: [],
    namedNpcs: [],
    backgroundColonistDensity: 0,
    happiness: 50,
    selfSufficient: false,
    lastCycleProcessed: 0,
    lastGameClock: { day: 0, hour: 7, minute: 0, realtimeMsPerGameMinute: 1000, season: "standard" },
    activeThreats: [],
    activeQuestlines: [],
    discoveredPoiIds: [],
    layoutSeed: 42,
    founded: { missionCount: 0, gameClockTick: 0 },
    ...overrides,
  };
}

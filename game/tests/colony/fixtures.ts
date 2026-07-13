import type { ColonyState, ColonyId, ColonyBuilding, BuildingType } from "../../app/components/colony/shared/colonyTypes";
import type { PlanetId, SaveData } from "../../app/components/engine/types";

/** Minimal empty SaveData for reducer/delivery/fixture tests. */
export function makeTestSave(overrides: Partial<SaveData> = {}): SaveData {
  return {
    currentWorld: 1, levels: {}, credits: 0, totalStars: 0, totalScore: 0, xp: 0,
    upgrades: {} as SaveData["upgrades"], unlockedCodex: [], viewedCodex: [],
    viewedConversations: [], completedQuests: [], activeQuests: [],
    completedPlanets: [], unlockedSpecialMissions: [], completedSpecialMissions: [],
    storyItems: [], materials: [], consumableInventory: {}, equippedConsumables: [],
    unlockedEnhancements: [], bestiary: {}, equippedWeaponType: "kinetic",
    pilotLevel: 1, skillPoints: 0, allocatedSkills: [],
    colonies: [], planets: [], earthShipments: [], factionStandings: [], bounties: [],
    missionsSinceStart: 0,
    gameClock: { day: 0, hour: 7, minute: 0, realtimeMsPerGameMinute: 1000, season: "standard" },
    ...overrides,
  };
}

let buildingSeq = 0;

/** Build a ColonyBuilding literal without the 10-field boilerplate. */
export function makeBuilding(type: BuildingType, overrides: Partial<ColonyBuilding> = {}): ColonyBuilding {
  buildingSeq += 1;
  return {
    id: `b_${type}_${buildingSeq}`,
    type,
    tier: 1,
    status: "operational",
    buildProgressCycles: 0,
    hp: 100,
    maxHp: 100,
    interiorTemplateId: null,
    assignedNpcIds: [],
    districtId: null,
    ...overrides,
  };
}

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

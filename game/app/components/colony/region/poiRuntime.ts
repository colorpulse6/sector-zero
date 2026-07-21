import type {
  GameState,
  OutcomeAttempt,
  SaveData,
  SerializedOutcomeEnvelope,
} from "../../engine/types";
import { GameScreen } from "../../engine/types";
import { createGameState } from "../../engine/gameEngine";
import {
  createOutcomeAttempt,
  createOutcomeEnvelope,
  recoverLegacyPreparedOutcome,
  snapshotOutcomeRootAuthority,
  stageLegacyPreparedOutcome,
} from "../../engine/missionOutcome";
import {
  launchContextFromSave,
  poiMissionDescriptor,
  snapshotRetryLaunchContext,
  type ExperienceRoute,
  type LaunchIdFactory,
  type LaunchContext,
} from "../../engine/missionContext";
import { getBoardingSpawn } from "../../engine/boardingLevel";
import { getSpawnPosition as getGroundSpawn } from "../../engine/groundLevel";
import { MAX_PILOT_LEVEL } from "../../engine/pilotLevel";
import { advanceWorldCycle } from "../shared/cycleProcessor";
import type { ColonyId } from "../shared/colonyTypes";
import type { MissionDelivery } from "../shared/missionDelivery";
import { dispatchPoi, type PoiSession } from "./poiDispatcher";
import { createPoiOutcome, confirmPoiOutcome, POI_CARGO, type PendingPoiOutcome } from "./poiOutcomes";

export interface ActivePoiDescriptor { originColonyId: ColonyId; session: PoiSession }
export type PoiExperience = "legacy" | "galaxy";
export interface PendingPoiResolution {
  originColonyId: ColonyId;
  nodeId: string;
  baseSave: SaveData;
  projectedSave: SaveData;
  outcome: PendingPoiOutcome | null;
}

export interface LegacyPreparedPoiResolution extends PendingPoiResolution {
  preparedSave: SaveData;
  preparedEnvelope: SerializedOutcomeEnvelope;
}

const INVALID_DURABLE_SNAPSHOT = Symbol("invalid-durable-snapshot");
const OUTCOME_ATTEMPT_KEYS = [
  "version", "routeKind", "missionId", "routeIdentity", "launchId", "expectedRevision",
  "persistenceAuthority", "returnTarget", "declaredFields", "launchSnapshot",
] as const;
const PENDING_RESOLUTION_KEYS = [
  "originColonyId", "nodeId", "baseSave", "projectedSave", "outcome",
] as const;
const PREPARED_RESOLUTION_KEYS = [
  ...PENDING_RESOLUTION_KEYS, "preparedSave", "preparedEnvelope",
] as const;
const REQUIRED_SAVE_DATA_KEYS = [
  "saveRevision", "appliedOutcomeIds", "outcomeRecoveryRecords", "currentWorld", "levels", "credits",
  "totalStars", "totalScore", "xp", "introSeen", "upgrades", "unlockedCodex", "viewedCodex",
  "viewedConversations", "completedQuests", "activeQuests", "completedPlanets", "unlockedSpecialMissions",
  "completedSpecialMissions", "storyItems", "materials", "consumableInventory", "equippedConsumables",
  "unlockedEnhancements", "bestiary", "equippedWeaponType", "pilotLevel", "skillPoints", "allocatedSkills",
  "colonies", "planets", "earthShipments", "factionStandings", "bounties", "missionsSinceStart",
  "gameClock", "activeExperience", "galaxyRun",
] as const;
const UPGRADE_LIMITS = {
  hullPlating: 3,
  engineBoost: 3,
  weaponCore: 2,
  munitionsBay: 3,
  fireControl: 2,
  shieldGenerator: 2,
} as const;
const PLANET_IDS = [
  "verdania", "glaciem", "pyraxis", "ossuary", "abyssia",
  "ashfall", "prismara", "genesis", "luminos", "bastion",
] as const;
const SPECIAL_MISSION_IDS = ["kepler-black-box"] as const;
const STORY_ITEM_IDS = ["kepler-black-box"] as const;
const MATERIAL_IDS = [
  "bio-fiber", "cryogenic-alloy", "molten-core", "ruin-shard", "abyssal-plating",
  "desert-glass", "phase-crystal", "genesis-seed", "neon-circuitry", "ferro-steel",
  "kinetic-core", "energy-cell", "ember-shard", "cryo-essence", "void-fragment",
  "hollow-resonance",
] as const;
const CONSUMABLE_IDS = [
  "hull-repair", "cryo-charge", "shield-charge", "weapon-overcharge", "scanner-pulse",
] as const;
const ENHANCEMENT_IDS = [
  "reinforced-shield", "incendiary-bombs", "extended-magnet", "homing-gunners", "resonance-field",
] as const;
const SKILL_NODE_IDS = [
  "sharpshooter", "overcharge", "berserker", "glass-cannon", "adrenaline", "signature-weapon",
] as const;
const WEAPON_TYPES = ["kinetic", "energy", "incendiary", "cryogenic"] as const;
const ENEMY_TYPES = [
  "SCOUT", "DRONE", "GUNNER", "SHIELDER", "BOMBER", "SWARM", "TURRET",
  "CLOAKER", "ELITE", "MINE", "WRAITH", "ECHO", "MIRROR",
] as const;
const ENEMY_CLASSES = [
  "armored", "swarm", "bio-organic", "tech-drone", "heavy-mech",
  "elemental-fire", "elemental-ice", "elemental-cinder",
] as const;
const GAME_CLOCK_SEASONS = ["standard", "storm", "bloom", "deadzone"] as const;
const PLANET_BIOMES = ["ice", "volcanic", "ocean", "desert", "jungle", "urban", "barren", "toxic"] as const;
const COLONY_FOUNDING_TYPES = ["outpost", "colony", "stronghold"] as const;
const BUILDING_TYPES = [
  "solar_array", "farm", "water_purifier", "mine", "refinery", "habitat_module", "med_bay",
  "marketplace", "cantina", "town_hall", "barracks", "turret_defense", "shield_generator",
  "radar_array", "comms_tower", "spaceport", "research_lab", "atmosphere_processor",
] as const;
const BUILDING_STATUSES = ["constructing", "operational", "damaged", "offline", "destroyed"] as const;
const DISTRICT_KINDS = ["residential", "market", "industrial", "civic", "military"] as const;
const THREAT_KINDS = ["raid_incoming", "siege_ongoing", "disaster_active", "supply_disruption"] as const;
const THREAT_SEVERITIES = ["minor", "major", "catastrophic"] as const;
const DEATH_CAUSES = ["hunger", "disease", "raid", "siege", "disaster", "player", "natural"] as const;
const REGION_NODE_TYPES = [
  "colony_site", "ruins", "hollow_bunker", "cave", "crash_site", "wreck", "raider_outpost",
  "neutral_village", "wilderness", "anomaly", "abandoned_colony",
] as const;
const REGION_INTEL_STATES = ["unknown", "rumored", "surveyed", "cleared", "claimed"] as const;
const FACTION_RANKS = ["hostile", "hated", "neutral", "liked", "allied"] as const;
const BOUNTY_REASONS = ["murder", "theft", "trespass", "treason"] as const;
const compatibilityPendingAuthority = new WeakMap<object, PendingPoiResolution>();

function ownDataRecord(value: unknown): Record<string, unknown> | null {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const snapshot = Object.create(null) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor)) return null;
      Object.defineProperty(snapshot, key, {
        value: descriptor.value,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return snapshot;
  } catch {
    return null;
  }
}

function exactOwnData(value: unknown, expectedKeys: readonly string[]): Record<string, unknown> | null {
  const snapshot = ownDataRecord(value);
  if (snapshot === null) return null;
  const keys = Object.keys(snapshot).sort();
  const expected = [...expectedKeys].sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index])
    ? snapshot
    : null;
}

function requiredOwnData(value: unknown, requiredKeys: readonly string[]): Record<string, unknown> | null {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const snapshot: Record<string, unknown> = {};
    for (const key of requiredKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor)) return null;
      snapshot[key] = descriptor.value;
    }
    return snapshot;
  } catch {
    return null;
  }
}

function snapshotDurableData(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
): unknown | typeof INVALID_DURABLE_SNAPSHOT {
  if (typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
    return INVALID_DURABLE_SNAPSHOT;
  }
  if (typeof value === "number" && !Number.isFinite(value)) return INVALID_DURABLE_SNAPSHOT;
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return INVALID_DURABLE_SNAPSHOT;
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) return INVALID_DURABLE_SNAPSHOT;
      const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
      if (lengthDescriptor === undefined || !("value" in lengthDescriptor) ||
        !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0) {
        return INVALID_DURABLE_SNAPSHOT;
      }
      const length = lengthDescriptor.value as number;
      const keys = Reflect.ownKeys(value);
      if (keys.length !== length + 1 || keys.some((key) => key !== "length" &&
        (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length))) {
        return INVALID_DURABLE_SNAPSHOT;
      }
      const snapshot: unknown[] = [];
      for (let index = 0; index < length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (descriptor === undefined || !("value" in descriptor)) return INVALID_DURABLE_SNAPSHOT;
        const entry = snapshotDurableData(descriptor.value, seen);
        if (entry === INVALID_DURABLE_SNAPSHOT) return INVALID_DURABLE_SNAPSHOT;
        snapshot.push(entry);
      }
      return snapshot;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return INVALID_DURABLE_SNAPSHOT;
    const snapshot = Object.create(prototype) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") return INVALID_DURABLE_SNAPSHOT;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor)) return INVALID_DURABLE_SNAPSHOT;
      const entry = snapshotDurableData(descriptor.value, seen);
      if (entry === INVALID_DURABLE_SNAPSHOT) return INVALID_DURABLE_SNAPSHOT;
      Object.defineProperty(snapshot, key, {
        value: entry,
        enumerable: descriptor.enumerable,
        writable: true,
        configurable: true,
      });
    }
    return snapshot;
  } catch {
    return INVALID_DURABLE_SNAPSHOT;
  } finally {
    seen.delete(value);
  }
}

function isNonnegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isKnownString(value: unknown, allowed: readonly string[]): value is string {
  return typeof value === "string" && allowed.includes(value);
}

function isStringArray(value: unknown, allowed?: readonly string[]): value is string[] {
  return Array.isArray(value) && value.every((entry) =>
    typeof entry === "string" && entry.length > 0 && (allowed === undefined || allowed.includes(entry)));
}

function isNullableString(value: unknown): boolean {
  return value === null || (typeof value === "string" && value.length > 0);
}

function isFiniteInRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function isCanonicalSiteStats(value: unknown): boolean {
  const stats = exactOwnData(value, ["oreDensity", "waterTable", "buildableSlots", "threat"]);
  return stats !== null && isFiniteInRange(stats.oreDensity, 0, 100) &&
    isFiniteInRange(stats.waterTable, 0, 100) &&
    Number.isSafeInteger(stats.buildableSlots) && (stats.buildableSlots as number) >= 0 &&
    isFiniteInRange(stats.threat, 0, 100);
}

function isCanonicalDeathRecord(value: unknown): boolean {
  const record = exactOwnData(value, ["npcId", "cyclesAgo", "cause", "colonyId"]);
  return record !== null && isNullableString(record.npcId) && isNonnegativeSafeInteger(record.cyclesAgo) &&
    isKnownString(record.cause, DEATH_CAUSES) && typeof record.colonyId === "string" &&
    record.colonyId.length > 0;
}

function isCanonicalPopulation(value: unknown): boolean {
  const population = exactOwnData(value, ["total", "capacity", "namedCount", "growthRate", "recentDeaths"]);
  return population !== null && isNonnegativeSafeInteger(population.total) &&
    isNonnegativeSafeInteger(population.capacity) && isNonnegativeSafeInteger(population.namedCount) &&
    typeof population.growthRate === "number" && Number.isFinite(population.growthRate) &&
    Array.isArray(population.recentDeaths) && population.recentDeaths.length <= 10 &&
    population.recentDeaths.every(isCanonicalDeathRecord);
}

function isCanonicalColonyResources(value: unknown): boolean {
  const resources = exactOwnData(value, ["food", "water", "metal", "credits"]);
  return resources !== null && Object.values(resources).every(isNonnegativeSafeInteger);
}

function isCanonicalBuilding(value: unknown): boolean {
  const building = exactOwnData(value, [
    "id", "type", "tier", "status", "buildProgressCycles", "hp", "maxHp",
    "interiorTemplateId", "assignedNpcIds", "districtId",
  ]);
  return building !== null && typeof building.id === "string" && building.id.length > 0 &&
    isKnownString(building.type, BUILDING_TYPES) &&
    Number.isSafeInteger(building.tier) && (building.tier as number) >= 1 && (building.tier as number) <= 3 &&
    isKnownString(building.status, BUILDING_STATUSES) && isNonnegativeSafeInteger(building.buildProgressCycles) &&
    isNonnegativeSafeInteger(building.hp) && isNonnegativeSafeInteger(building.maxHp) &&
    (building.hp as number) <= (building.maxHp as number) && isNullableString(building.interiorTemplateId) &&
    isStringArray(building.assignedNpcIds) && isNullableString(building.districtId);
}

function isCanonicalDistrict(value: unknown): boolean {
  const district = exactOwnData(value, ["id", "colonyId", "kind", "tiles", "travelAnchorId"]);
  return district !== null && typeof district.id === "string" && district.id.length > 0 &&
    typeof district.colonyId === "string" && district.colonyId.length > 0 &&
    isKnownString(district.kind, DISTRICT_KINDS) && Array.isArray(district.tiles) &&
    district.tiles.every((tile) => Array.isArray(tile) && tile.length === 2 &&
      tile.every((coordinate) => Number.isSafeInteger(coordinate))) &&
    isNullableString(district.travelAnchorId);
}

function isCanonicalThreat(value: unknown): boolean {
  const threat = exactOwnData(value, [
    "id", "kind", "cyclesUntilResolve", "severity", "targetBuildingId", "payload",
  ]);
  return threat !== null && typeof threat.id === "string" && threat.id.length > 0 &&
    isKnownString(threat.kind, THREAT_KINDS) && isNonnegativeSafeInteger(threat.cyclesUntilResolve) &&
    isKnownString(threat.severity, THREAT_SEVERITIES) && isNullableString(threat.targetBuildingId);
}

function isCanonicalColony(value: unknown): boolean {
  const colony = exactOwnData(value, [
    "id", "name", "planetId", "foundingType", "tier", "regionNodeId", "siteStats", "population",
    "resources", "buildings", "districts", "namedNpcs", "backgroundColonistDensity", "happiness",
    "selfSufficient", "lastCycleProcessed", "lastGameClock", "activeThreats", "activeQuestlines",
    "discoveredPoiIds", "layoutSeed", "founded",
  ]);
  if (colony === null || typeof colony.id !== "string" || colony.id.length === 0 ||
    typeof colony.name !== "string" || colony.name.length === 0 || !isKnownString(colony.planetId, PLANET_IDS) ||
    !isKnownString(colony.foundingType, COLONY_FOUNDING_TYPES) || !Number.isSafeInteger(colony.tier) ||
    (colony.tier as number) < 1 || (colony.tier as number) > 4 ||
    typeof colony.regionNodeId !== "string" || colony.regionNodeId.length === 0 ||
    !isCanonicalSiteStats(colony.siteStats) || !isCanonicalPopulation(colony.population) ||
    !isCanonicalColonyResources(colony.resources) || !Array.isArray(colony.buildings) ||
    !colony.buildings.every(isCanonicalBuilding) || !Array.isArray(colony.districts) ||
    !colony.districts.every(isCanonicalDistrict) || !isStringArray(colony.namedNpcs) ||
    !isFiniteInRange(colony.backgroundColonistDensity, 0, 1) || !isFiniteInRange(colony.happiness, 0, 100) ||
    typeof colony.selfSufficient !== "boolean" || !isNonnegativeSafeInteger(colony.lastCycleProcessed) ||
    !isCanonicalGameClock(colony.lastGameClock) || !Array.isArray(colony.activeThreats) ||
    !colony.activeThreats.every(isCanonicalThreat) || !isStringArray(colony.activeQuestlines) ||
    !isStringArray(colony.discoveredPoiIds) || !Number.isSafeInteger(colony.layoutSeed)) return false;
  const founded = exactOwnData(colony.founded, ["missionCount", "gameClockTick"]);
  return founded !== null && isNonnegativeSafeInteger(founded.missionCount) &&
    isNonnegativeSafeInteger(founded.gameClockTick);
}

function isCanonicalElevationMetadata(value: unknown): boolean {
  if (value === null) return true;
  const elevation = exactOwnData(value, [
    "authoredTemplateId", "overrideName", "questlineId", "requiredCampaignState",
  ]);
  return elevation !== null && typeof elevation.authoredTemplateId === "string" &&
    elevation.authoredTemplateId.length > 0 && typeof elevation.overrideName === "string" &&
    elevation.overrideName.length > 0 && typeof elevation.questlineId === "string" &&
    elevation.questlineId.length > 0 && isNullableString(elevation.requiredCampaignState);
}

function isCanonicalRegionNode(value: unknown): boolean {
  const node = exactOwnData(value, [
    "id", "name", "type", "intel", "siteStats", "discovered", "authored", "templateId", "seed",
    "cleared", "respawnMissions", "coords", "elevationMetadata",
  ]);
  if (node === null || typeof node.id !== "string" || node.id.length === 0 ||
    typeof node.name !== "string" || node.name.length === 0 || !isKnownString(node.type, REGION_NODE_TYPES) ||
    !isKnownString(node.intel, REGION_INTEL_STATES) ||
    (node.type === "colony_site" ? !isCanonicalSiteStats(node.siteStats) : node.siteStats !== null) ||
    typeof node.discovered !== "boolean" || typeof node.authored !== "boolean" ||
    !isNullableString(node.templateId) || !isNonnegativeSafeInteger(node.seed) ||
    typeof node.cleared !== "boolean" ||
    !(node.respawnMissions === null || isNonnegativeSafeInteger(node.respawnMissions)) ||
    !isCanonicalElevationMetadata(node.elevationMetadata)) return false;
  const coords = exactOwnData(node.coords, ["x", "y"]);
  return coords !== null && typeof coords.x === "number" && Number.isFinite(coords.x) &&
    typeof coords.y === "number" && Number.isFinite(coords.y);
}

function isCanonicalRegionMap(value: unknown): boolean {
  const map = exactOwnData(value, ["seed", "nodes", "edges"]);
  if (map === null || !isNonnegativeSafeInteger(map.seed) || !Array.isArray(map.nodes) ||
    !map.nodes.every(isCanonicalRegionNode) || !Array.isArray(map.edges)) return false;
  const nodeIds = new Set((map.nodes as Array<{ id: string }>).map((node) => node.id));
  if (nodeIds.size !== map.nodes.length) return false;
  return map.edges.every((edge) => Array.isArray(edge) && edge.length === 2 &&
    edge.every((nodeId) => typeof nodeId === "string" && nodeIds.has(nodeId)));
}

function isCanonicalPlanet(value: unknown): boolean {
  const planet = exactOwnData(value, ["id", "regionMap", "biome", "campaignUnlocked"]);
  return planet !== null && isKnownString(planet.id, PLANET_IDS) && isCanonicalRegionMap(planet.regionMap) &&
    isKnownString(planet.biome, PLANET_BIOMES) && typeof planet.campaignUnlocked === "boolean";
}

function isCanonicalShipmentContents(value: unknown): boolean {
  const contents = ownDataRecord(value);
  if (contents === null || Object.keys(contents).some((key) =>
    !["food", "water", "metal", "credits", "combatMaterials"].includes(key))) return false;
  return ["food", "water", "metal", "credits"].every((key) =>
    contents[key] === undefined || isNonnegativeSafeInteger(contents[key])) &&
    (contents.combatMaterials === undefined || (() => {
      const materials = ownDataRecord(contents.combatMaterials);
      return materials !== null && Object.entries(materials).every(([key, count]) =>
        key.length > 0 && isNonnegativeSafeInteger(count));
    })());
}

function isCanonicalShipment(value: unknown): boolean {
  const shipment = exactOwnData(value, [
    "id", "contents", "eta", "interceptionChance", "interceptionTriggered", "destinationColonyId", "costPaid",
  ]);
  if (shipment === null || typeof shipment.id !== "string" || shipment.id.length === 0 ||
    !isCanonicalShipmentContents(shipment.contents) || !isFiniteInRange(shipment.interceptionChance, 0, 1) ||
    typeof shipment.interceptionTriggered !== "boolean" || typeof shipment.destinationColonyId !== "string" ||
    shipment.destinationColonyId.length === 0 || !isNonnegativeSafeInteger(shipment.costPaid)) return false;
  const eta = exactOwnData(shipment.eta, ["missionCount"]);
  return eta !== null && isNonnegativeSafeInteger(eta.missionCount);
}

function isCanonicalFactionStanding(value: unknown): boolean {
  const standing = exactOwnData(value, ["factionId", "standing", "rank", "permissions"]);
  return standing !== null && typeof standing.factionId === "string" && standing.factionId.length > 0 &&
    isFiniteInRange(standing.standing, -100, 100) && isKnownString(standing.rank, FACTION_RANKS) &&
    isStringArray(standing.permissions);
}

function isCanonicalBounty(value: unknown): boolean {
  const bounty = exactOwnData(value, ["id", "colonyId", "amount", "reason", "witnesses", "issued", "expired"]);
  if (bounty === null || typeof bounty.id !== "string" || bounty.id.length === 0 ||
    typeof bounty.colonyId !== "string" || bounty.colonyId.length === 0 ||
    !isNonnegativeSafeInteger(bounty.amount) || !isKnownString(bounty.reason, BOUNTY_REASONS) ||
    !isStringArray(bounty.witnesses) || typeof bounty.expired !== "boolean") return false;
  const issued = exactOwnData(bounty.issued, ["missionCount"]);
  return issued !== null && isNonnegativeSafeInteger(issued.missionCount);
}

function isCanonicalRecordArray(value: unknown, validate: (entry: unknown) => boolean): boolean {
  return Array.isArray(value) && value.every(validate);
}

function hasCanonicalTypedCollections(fields: Record<string, unknown>): boolean {
  if (!isCanonicalRecordArray(fields.colonies, isCanonicalColony) ||
    !isCanonicalRecordArray(fields.planets, isCanonicalPlanet) ||
    !isCanonicalRecordArray(fields.earthShipments, isCanonicalShipment) ||
    !isCanonicalRecordArray(fields.factionStandings, isCanonicalFactionStanding) ||
    !isCanonicalRecordArray(fields.bounties, isCanonicalBounty)) return false;
  const colonies = fields.colonies as Array<Record<string, unknown>>;
  const planets = fields.planets as Array<Record<string, unknown>>;
  const colonyIds = new Set(colonies.map((colony) => colony.id as string));
  const planetIds = new Set(planets.map((planet) => planet.id as string));
  if (colonyIds.size !== colonies.length || planetIds.size !== planets.length) return false;
  for (const colony of colonies) {
    const planet = planets.find((candidate) => candidate.id === colony.planetId);
    const regionMap = planet === undefined ? null : ownDataRecord(planet.regionMap);
    if (regionMap === null || !Array.isArray(regionMap.nodes) || !regionMap.nodes.some((node) => {
      const candidate = ownDataRecord(node);
      return candidate !== null && candidate.id === colony.regionNodeId;
    })) return false;
  }
  const uniqueIds = (entries: Array<Record<string, unknown>>, key: string): boolean => {
    const ids = entries.map((entry) => entry[key] as string);
    return new Set(ids).size === ids.length;
  };
  return uniqueIds(fields.earthShipments as Array<Record<string, unknown>>, "id") &&
    uniqueIds(fields.factionStandings as Array<Record<string, unknown>>, "factionId") &&
    uniqueIds(fields.bounties as Array<Record<string, unknown>>, "id");
}

function isCanonicalLevelLedger(value: unknown): boolean {
  const levels = ownDataRecord(value);
  if (levels === null) return false;
  return Object.entries(levels).every(([key, entry]) => {
    const level = exactOwnData(entry, ["completed", "stars", "highScore"]);
    return key.length > 0 && level !== null && typeof level.completed === "boolean" &&
      Number.isSafeInteger(level.stars) && (level.stars as number) >= 0 && (level.stars as number) <= 3 &&
      isNonnegativeSafeInteger(level.highScore);
  });
}

function isCanonicalUpgrades(value: unknown): boolean {
  const upgrades = exactOwnData(value, Object.keys(UPGRADE_LIMITS));
  return upgrades !== null && Object.entries(UPGRADE_LIMITS).every(([key, maximum]) =>
    isNonnegativeSafeInteger(upgrades[key]) && (upgrades[key] as number) <= maximum);
}

function isCanonicalInventory(value: unknown): boolean {
  const inventory = ownDataRecord(value);
  return inventory !== null && Object.entries(inventory).every(([key, count]) =>
    CONSUMABLE_IDS.includes(key as (typeof CONSUMABLE_IDS)[number]) && isNonnegativeSafeInteger(count));
}

function isCanonicalBestiary(value: unknown): boolean {
  const bestiary = ownDataRecord(value);
  if (bestiary === null) return false;
  return Object.entries(bestiary).every(([key, value]) => {
    if (!ENEMY_TYPES.includes(key as (typeof ENEMY_TYPES)[number])) return false;
    const entry = ownDataRecord(value);
    if (entry === null || Object.keys(entry).some((field) =>
      !["enemyType", "classId", "killCount", "firstSeenPlanet", "firstSeenWorld"].includes(field))) return false;
    return entry.enemyType === key && isKnownString(entry.classId, ENEMY_CLASSES) &&
      isNonnegativeSafeInteger(entry.killCount) &&
      (entry.firstSeenPlanet === undefined || isKnownString(entry.firstSeenPlanet, PLANET_IDS)) &&
      (entry.firstSeenWorld === undefined ||
        (Number.isSafeInteger(entry.firstSeenWorld) && (entry.firstSeenWorld as number) >= 1));
  });
}

function isCanonicalGameClock(value: unknown): boolean {
  const clock = exactOwnData(value, ["day", "hour", "minute", "realtimeMsPerGameMinute", "season"]);
  return clock !== null && isNonnegativeSafeInteger(clock.day) &&
    Number.isSafeInteger(clock.hour) && (clock.hour as number) >= 0 && (clock.hour as number) <= 23 &&
    Number.isSafeInteger(clock.minute) && (clock.minute as number) >= 0 && (clock.minute as number) <= 59 &&
    typeof clock.realtimeMsPerGameMinute === "number" && Number.isFinite(clock.realtimeMsPerGameMinute) &&
    clock.realtimeMsPerGameMinute > 0 && isKnownString(clock.season, GAME_CLOCK_SEASONS);
}

function hasCanonicalDurablePrimitives(value: unknown, root = true): boolean {
  if (value === undefined) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;
  if (Array.isArray(value)) return value.every((entry) => hasCanonicalDurablePrimitives(entry, false));
  const record = ownDataRecord(value);
  return record !== null && Object.entries(record).every(([key, entry]) =>
    root && key === "introSeen" && entry === undefined
      ? true
      : hasCanonicalDurablePrimitives(entry, false));
}

function hasCanonicalSaveFieldDomains(fields: Record<string, unknown>): boolean {
  const numericFields = ["credits", "totalStars", "totalScore", "xp", "skillPoints", "missionsSinceStart"];
  const openStringArrays = [
    "unlockedCodex", "viewedCodex", "viewedConversations", "completedQuests", "activeQuests",
  ];
  return Number.isSafeInteger(fields.currentWorld) && (fields.currentWorld as number) >= 1 &&
    numericFields.every((key) => isNonnegativeSafeInteger(fields[key])) &&
    (fields.introSeen === undefined || typeof fields.introSeen === "boolean") &&
    isCanonicalLevelLedger(fields.levels) && isCanonicalUpgrades(fields.upgrades) &&
    openStringArrays.every((key) => isStringArray(fields[key])) &&
    isStringArray(fields.completedPlanets, PLANET_IDS) &&
    isStringArray(fields.unlockedSpecialMissions, SPECIAL_MISSION_IDS) &&
    isStringArray(fields.completedSpecialMissions, SPECIAL_MISSION_IDS) &&
    isStringArray(fields.storyItems, STORY_ITEM_IDS) && isStringArray(fields.materials, MATERIAL_IDS) &&
    isCanonicalInventory(fields.consumableInventory) &&
    isStringArray(fields.equippedConsumables, CONSUMABLE_IDS) &&
    isStringArray(fields.unlockedEnhancements, ENHANCEMENT_IDS) &&
    isCanonicalBestiary(fields.bestiary) && isKnownString(fields.equippedWeaponType, WEAPON_TYPES) &&
    Number.isSafeInteger(fields.pilotLevel) && (fields.pilotLevel as number) >= 1 &&
    (fields.pilotLevel as number) <= MAX_PILOT_LEVEL &&
    isStringArray(fields.allocatedSkills, SKILL_NODE_IDS) &&
    hasCanonicalTypedCollections(fields) && isCanonicalGameClock(fields.gameClock) &&
    (fields.activeExperience === "legacy" || fields.activeExperience === "galaxy") &&
    (fields.galaxyRun === null || ownDataRecord(fields.galaxyRun) !== null);
}

function sameDurableData(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) return false;
  const leftIsArray = Array.isArray(left);
  const rightIsArray = Array.isArray(right);
  if (leftIsArray || rightIsArray) {
    if (!leftIsArray || !rightIsArray || left.length !== right.length) return false;
    return left.every((entry, index) => sameDurableData(entry, right[index]));
  }
  const leftRecord = ownDataRecord(left);
  const rightRecord = ownDataRecord(right);
  if (leftRecord === null || rightRecord === null) return false;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) =>
    key === rightKeys[index] && sameDurableData(leftRecord[key], rightRecord[key]));
}

function snapshotActivePoiMetadata(value: unknown): ActivePoiDescriptor | null {
  const active = exactOwnData(value, ["originColonyId", "session"]);
  const session = active === null
    ? null
    : exactOwnData(active.session, ["nodeId", "engine", "state", "rewardEligible"]);
  if (active === null || session === null || typeof active.originColonyId !== "string" ||
    active.originColonyId.length === 0 || typeof session.nodeId !== "string" || session.nodeId.length === 0 ||
    (session.engine !== "firstPerson" && session.engine !== "boarding" && session.engine !== "groundRun") ||
    typeof session.rewardEligible !== "boolean") return null;
  return {
    originColonyId: active.originColonyId,
    session: {
      nodeId: session.nodeId,
      engine: session.engine,
      state: session.state,
      rewardEligible: session.rewardEligible,
    } as PoiSession,
  };
}

function isCanonicalCompletionSave(value: unknown): value is SaveData {
  const fields = requiredOwnData(value, REQUIRED_SAVE_DATA_KEYS);
  return fields !== null && hasCanonicalDurablePrimitives(value) && hasCanonicalSaveFieldDomains(fields) &&
    snapshotOutcomeRootAuthority(value as SaveData) !== null;
}

function snapshotCanonicalCompletionSave(value: unknown): SaveData | null {
  const snapshot = snapshotDurableData(value);
  return snapshot !== INVALID_DURABLE_SNAPSHOT && isCanonicalCompletionSave(snapshot)
    ? snapshot
    : null;
}

export function createPoiGameState(
  session: PoiSession,
  save: SaveData,
  experience: PoiExperience = "legacy",
  launchIdFactoryOrRetry?: LaunchIdFactory | LaunchContext,
  canonicalParent?: SaveData,
  originColonyId?: ColonyId,
): GameState {
  const returnTarget: ExperienceRoute = experience === "galaxy"
    ? "galaxy-region"
    : "legacy-colony-exterior";
  const mission = poiMissionDescriptor(session.nodeId, session.engine);
  const launchContext = typeof launchIdFactoryOrRetry === "function" || launchIdFactoryOrRetry === undefined
    ? launchContextFromSave(
        save,
        mission,
        experience,
        "region",
        returnTarget,
        launchIdFactoryOrRetry,
      )
    : snapshotRetryLaunchContext(
        launchIdFactoryOrRetry,
        mission,
        experience,
        returnTarget,
      );
  if (launchContext === null) {
    throw new Error("POI retry launch context does not match the session and experience.");
  }
  let outcomeAttempt: GameState["outcomeAttempt"];
  if ((canonicalParent === undefined) !== (originColonyId === undefined)) {
    throw new Error("POI outcome authority requires both canonical parent and explicit origin.");
  }
  if (canonicalParent !== undefined && originColonyId !== undefined) {
    const colonies = experience === "galaxy" ? canonicalParent.galaxyRun?.colonies : canonicalParent.colonies;
    const planets = experience === "galaxy" ? canonicalParent.galaxyRun?.planets : canonicalParent.planets;
    const origin = colonies?.find((colony) => colony.id === originColonyId);
    const node = planets?.find((planet) => planet.id === origin?.planetId)
      ?.regionMap.nodes.find((entry) => entry.id === session.nodeId);
    if (origin === undefined || node === undefined || node.templateId === null) {
      throw new Error("POI outcome authority does not match the explicit canonical origin.");
    }
    outcomeAttempt = createOutcomeAttempt(canonicalParent, launchContext, "poi", {
      originColonyId,
      rewardEligible: session.rewardEligible,
    });
  }
  const base = { ...createGameState(1, 1, launchContext), ...(outcomeAttempt === undefined ? {} : { outcomeAttempt }) };
  const nodeName = experience === "galaxy"
    ? save.planets
        .flatMap((planet) => planet.regionMap.nodes)
        .find((node) => node.id === session.nodeId)?.name
    : undefined;
  const galaxyPresentation = experience === "galaxy"
    ? { galaxyOperation: { id: `poi:${session.nodeId}`, label: nodeName ?? "ASHFALL EXPEDITION" } }
    : {};
  if (session.engine === "firstPerson") return { ...base, ...galaxyPresentation, screen: GameScreen.PLAYING, currentMode: "first-person", currentPhase: 0, totalPhases: 1, firstPersonState: session.state, briefingTimer: 0 };
  if (session.engine === "boarding") {
    const spawn = getBoardingSpawn(session.state.map);
    return { ...base, ...galaxyPresentation, screen: GameScreen.PLAYING, currentMode: "boarding", currentPhase: 0, totalPhases: 1, boardingState: session.state, player: { ...base.player, x: spawn.x, y: spawn.y }, briefingTimer: 0 };
  }
  const spawn = getGroundSpawn(session.state.tileMap);
  return { ...base, ...galaxyPresentation, screen: GameScreen.PLAYING, currentMode: "ground-run", currentPhase: 0, totalPhases: 1, groundState: session.state, player: { ...base.player, x: spawn.x, y: spawn.y }, briefingTimer: 0 };
}

export function preparePoiCompletion(
  save: SaveData,
  activePoi: ActivePoiDescriptor | null,
  screen: GameScreen,
  attempt: OutcomeAttempt,
): LegacyPreparedPoiResolution | null;
export function preparePoiCompletion(
  save: SaveData,
  activePoi: ActivePoiDescriptor | null,
  screen: GameScreen,
): PendingPoiResolution | null;
export function preparePoiCompletion(
  save: SaveData,
  activePoi: ActivePoiDescriptor | null,
  screen: GameScreen,
  attempt?: OutcomeAttempt,
): PendingPoiResolution | LegacyPreparedPoiResolution | null {
  if (screen !== GameScreen.LEVEL_COMPLETE) return null;
  try {
    const safeActivePoi = snapshotActivePoiMetadata(activePoi);
    const safeSave = snapshotCanonicalCompletionSave(save);
    if (safeActivePoi === null || safeSave === null) return null;
    const rebound = dispatchPoi(
      safeSave,
      safeActivePoi.originColonyId,
      safeActivePoi.session.nodeId,
    );
    if (!rebound.ok || rebound.session.engine !== safeActivePoi.session.engine ||
      rebound.session.rewardEligible !== safeActivePoi.session.rewardEligible) return null;
    if (attempt !== undefined) {
      const attemptSnapshot = snapshotDurableData(attempt);
      const attemptRecord = attemptSnapshot === INVALID_DURABLE_SNAPSHOT
        ? null
        : exactOwnData(attemptSnapshot, OUTCOME_ATTEMPT_KEYS);
      const identity = attemptRecord === null
        ? null
        : exactOwnData(attemptRecord.routeIdentity, [
            "kind", "originColonyId", "nodeId", "engine", "templateId", "rewardEligible",
          ]);
      if (attemptRecord === null || identity === null || attemptRecord.version !== 1 ||
        attemptRecord.routeKind !== "poi" || identity.kind !== "poi" ||
        attemptRecord.persistenceAuthority !== "legacy" ||
        attemptRecord.returnTarget !== "legacy-colony-exterior" ||
        identity.originColonyId !== safeActivePoi.originColonyId ||
        identity.nodeId !== safeActivePoi.session.nodeId ||
        identity.engine !== safeActivePoi.session.engine ||
        identity.rewardEligible !== safeActivePoi.session.rewardEligible) return null;
      const safeAttempt = attemptSnapshot as OutcomeAttempt;
      const preparedEnvelope = createOutcomeEnvelope(safeAttempt, "success", {
        version: 2,
        kind: "poi_prepared_v2",
      });
      const preparedSave = stageLegacyPreparedOutcome(safeSave, preparedEnvelope);
      if (preparedSave === null) return null;
      return {
        originColonyId: safeActivePoi.originColonyId,
        nodeId: safeActivePoi.session.nodeId,
        baseSave: safeSave,
        projectedSave: safeSave,
        outcome: null,
        preparedSave,
        preparedEnvelope,
      };
    }
    const baseSave = advanceWorldCycle(safeSave);
    if (!safeActivePoi.session.rewardEligible) {
      const pending: PendingPoiResolution = {
        originColonyId: safeActivePoi.originColonyId,
        nodeId: safeActivePoi.session.nodeId,
        baseSave,
        projectedSave: baseSave,
        outcome: null,
      };
      const authority = snapshotDurableData(pending);
      if (authority === INVALID_DURABLE_SNAPSHOT) return null;
      compatibilityPendingAuthority.set(pending, authority as PendingPoiResolution);
      return pending;
    }
    const created = createPoiOutcome(baseSave, safeActivePoi.originColonyId, safeActivePoi.session.nodeId);
    if (!created.ok) return null;
    const pending: PendingPoiResolution = {
      originColonyId: safeActivePoi.originColonyId,
      nodeId: safeActivePoi.session.nodeId,
      baseSave,
      projectedSave: created.save,
      outcome: created.outcome,
    };
    const authority = snapshotDurableData(pending);
    if (authority === INVALID_DURABLE_SNAPSHOT) return null;
    compatibilityPendingAuthority.set(pending, authority as PendingPoiResolution);
    return pending;
  } catch {
    return null;
  }
}

export function recoverLegacyPoiCompletion(save: SaveData): LegacyPreparedPoiResolution | null {
  const safeSave = snapshotCanonicalCompletionSave(save);
  if (safeSave === null) return null;
  const preparedEnvelope = recoverLegacyPreparedOutcome(safeSave);
  if (preparedEnvelope === null || preparedEnvelope.routeIdentity.kind !== "poi") return null;
  return {
    originColonyId: preparedEnvelope.routeIdentity.originColonyId,
    nodeId: preparedEnvelope.routeIdentity.nodeId,
    baseSave: safeSave,
    projectedSave: safeSave,
    outcome: null,
    preparedSave: safeSave,
    preparedEnvelope,
  };
}

export function resolvePoiCompletion(
  pending: LegacyPreparedPoiResolution,
  destinationColonyId: ColonyId | null,
): { ok: true; save: SaveData; delivery: null; envelope: SerializedOutcomeEnvelope } | null;
export function resolvePoiCompletion(
  pending: PendingPoiResolution,
  destinationColonyId: ColonyId | null,
):
  | { ok: true; save: SaveData; delivery: MissionDelivery | null }
  | { ok: false; save: SaveData; reason: "destination_missing" | "outcome_stale" }
  | null;
export function resolvePoiCompletion(pending: PendingPoiResolution, destinationColonyId: ColonyId | null) {
  try {
    if (destinationColonyId !== null &&
      (typeof destinationColonyId !== "string" || destinationColonyId.length === 0)) return null;
    const preparedRecord = exactOwnData(pending, PREPARED_RESOLUTION_KEYS);
    if (preparedRecord !== null) {
      const baseSave = snapshotCanonicalCompletionSave(preparedRecord.baseSave);
      const projectedSave = snapshotCanonicalCompletionSave(preparedRecord.projectedSave);
      const preparedSave = snapshotCanonicalCompletionSave(preparedRecord.preparedSave);
      if (typeof preparedRecord.originColonyId !== "string" || preparedRecord.originColonyId.length === 0 ||
        typeof preparedRecord.nodeId !== "string" || preparedRecord.nodeId.length === 0 ||
        baseSave === null || projectedSave === null || preparedSave === null ||
        preparedRecord.outcome !== null || !sameDurableData(baseSave, projectedSave)) return null;
      const submittedEnvelope = snapshotDurableData(preparedRecord.preparedEnvelope);
      const recoveredEnvelope = recoverLegacyPreparedOutcome(preparedSave);
      if (submittedEnvelope === INVALID_DURABLE_SNAPSHOT || recoveredEnvelope === null ||
        !sameDurableData(submittedEnvelope, recoveredEnvelope) ||
        recoveredEnvelope.routeIdentity.kind !== "poi" ||
        recoveredEnvelope.routeIdentity.originColonyId !== preparedRecord.originColonyId ||
        recoveredEnvelope.routeIdentity.nodeId !== preparedRecord.nodeId) return null;
      return {
        ok: true as const,
        save: preparedSave,
        delivery: null,
        envelope: createOutcomeEnvelope(recoveredEnvelope, "success", {
          version: 2,
          kind: "poi_result_v2",
          destinationColonyId,
        }),
      };
    }

    if (typeof pending !== "object" || pending === null) return null;
    const trustedPending = compatibilityPendingAuthority.get(pending);
    const submittedPending = snapshotDurableData(pending);
    if (trustedPending === undefined || submittedPending === INVALID_DURABLE_SNAPSHOT ||
      !sameDurableData(submittedPending, trustedPending)) return null;
    const pendingRecord = exactOwnData(trustedPending, PENDING_RESOLUTION_KEYS);
    if (pendingRecord === null || typeof pendingRecord.originColonyId !== "string" ||
      pendingRecord.originColonyId.length === 0 || typeof pendingRecord.nodeId !== "string" ||
      pendingRecord.nodeId.length === 0) return null;
    const baseSave = snapshotCanonicalCompletionSave(pendingRecord.baseSave);
    const projectedSave = snapshotCanonicalCompletionSave(pendingRecord.projectedSave);
    if (baseSave === null || projectedSave === null) return null;
    if (pendingRecord.outcome === null) {
      return sameDurableData(baseSave, projectedSave)
        ? { ok: true as const, save: baseSave, delivery: null }
        : null;
    }
    const outcome = exactOwnData(pendingRecord.outcome, ["originColonyId", "nodeId", "payload"]);
    const payload = outcome === null ? null : exactOwnData(outcome.payload, ["metal"]);
    if (outcome === null || payload === null || outcome.originColonyId !== pendingRecord.originColonyId ||
      outcome.nodeId !== pendingRecord.nodeId || payload.metal !== POI_CARGO.metal) return null;
    const recreated = createPoiOutcome(baseSave, pendingRecord.originColonyId, pendingRecord.nodeId);
    if (!recreated.ok || !sameDurableData(recreated.outcome, outcome) ||
      !sameDurableData(recreated.save, projectedSave)) return null;
    if (destinationColonyId === null) {
      return { ok: false as const, save: baseSave, reason: "destination_missing" as const };
    }
    return confirmPoiOutcome(baseSave, recreated.outcome, destinationColonyId);
  } catch {
    return null;
  }
}

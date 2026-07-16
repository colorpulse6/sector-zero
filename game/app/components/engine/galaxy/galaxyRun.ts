import { Events } from "../../colony/shared/colonyEvents";
import { colonyReducer } from "../../colony/shared/colonyReducer";
import {
  clampStanding,
  defaultFactionStandings,
  rankFromStanding,
} from "../../colony/shared/factionLedger";
import {
  ASHFALL_REGION_SEED,
  createPlanetRegionState,
} from "../../colony/region/regionMap";
import type {
  ColonyBuilding,
  ColonyState,
  DeathRecord,
  District,
  FactionStanding,
  GameClock,
  PlanetState,
  RegionNode,
  SiteStats,
  Threat,
} from "../../colony/shared/colonyTypes";
import { DEFAULT_UPGRADES, EnemyType } from "../types";
import { MAX_PILOT_LEVEL } from "../pilotLevel";
import type {
  BestiaryEntry,
  ConsumableId,
  EnhancementId,
  EnemyClass,
  MaterialId,
  PlanetId,
  SaveData,
  ShipUpgrades,
  SkillNodeId,
  StoryItemId,
  WeaponType,
} from "../types";
import {
  G0_GENERATION_IDENTITY,
  chartFact,
  getGenerationAvailability,
  observeFact,
  resolveCell,
  visitFact,
} from "./atlas";
import { coord, sameCoordinate, validateCoordinate } from "./coordinates";
import type {
  AccessFact,
  AtlasCellFact,
  AtlasGenerationIdentity,
  AtlasKnowledgeRecord,
  GalaxyAtlasState,
  GalaxyOperationRecord,
  GalaxyPilotState,
  GalaxyRunState,
  GalaxyShipState,
  HistoricalFact,
  KnowledgeConfidence,
  KnowledgeSource,
  KnowledgeState,
  RouteLeg,
  ThreatBand,
  ThreatDimension,
  ThreatObservation,
  TravelCommitment,
} from "./galaxyTypes";

export const G0_STARTING_SUPPLY = 12;

export type GalaxyRunAvailability =
  | { status: "not_started" }
  | { status: "available" }
  | {
      status: "unavailable";
      recoverable: true;
      reason:
        | "unsupported_generation_version"
        | "unsupported_registry_version";
    };

type UnknownRecord = Record<string, unknown>;

const MATERIAL_IDS: readonly MaterialId[] = [
  "bio-fiber",
  "cryogenic-alloy",
  "molten-core",
  "ruin-shard",
  "abyssal-plating",
  "desert-glass",
  "phase-crystal",
  "genesis-seed",
  "neon-circuitry",
  "ferro-steel",
  "kinetic-core",
  "energy-cell",
  "ember-shard",
  "cryo-essence",
  "void-fragment",
  "hollow-resonance",
];
const CONSUMABLE_IDS: readonly ConsumableId[] = [
  "hull-repair",
  "cryo-charge",
  "shield-charge",
  "weapon-overcharge",
  "scanner-pulse",
];
const ENHANCEMENT_IDS: readonly EnhancementId[] = [
  "reinforced-shield",
  "incendiary-bombs",
  "extended-magnet",
  "homing-gunners",
  "resonance-field",
];
const WEAPON_TYPES: readonly WeaponType[] = [
  "kinetic",
  "energy",
  "incendiary",
  "cryogenic",
];
const SKILL_NODE_IDS: readonly SkillNodeId[] = [
  "sharpshooter",
  "overcharge",
  "berserker",
  "glass-cannon",
  "adrenaline",
  "signature-weapon",
];
const STORY_ITEM_IDS: readonly StoryItemId[] = ["kepler-black-box"];
const PLANET_IDS: readonly PlanetId[] = [
  "verdania",
  "glaciem",
  "pyraxis",
  "ossuary",
  "abyssia",
  "ashfall",
  "prismara",
  "genesis",
  "luminos",
  "bastion",
];
const ENEMY_TYPES: readonly EnemyType[] = Object.freeze(Object.values(EnemyType));
const ENEMY_CLASSES: readonly EnemyClass[] = [
  "armored",
  "swarm",
  "bio-organic",
  "tech-drone",
  "heavy-mech",
  "elemental-fire",
  "elemental-ice",
  "elemental-cinder",
];
const KNOWLEDGE_STATES: readonly KnowledgeState[] = [
  "unknown",
  "signal",
  "charted",
  "visited",
  "lost_contact",
];
const KNOWLEDGE_CONFIDENCES: readonly KnowledgeConfidence[] = [
  "low",
  "medium",
  "high",
];
const KNOWLEDGE_SOURCES: readonly KnowledgeSource[] = [
  "sensor",
  "report",
  "rumor",
  "archive",
  "ally",
  "direct_visit",
  "authored",
];
const THREAT_DIMENSIONS: readonly ThreatDimension[] = [
  "military",
  "political",
  "environmental",
  "logistical",
  "anomalous",
];
const THREAT_BANDS: readonly ThreatBand[] = [
  "low",
  "moderate",
  "high",
  "severe",
  "unknown",
];
const CELL_KINDS: readonly AtlasCellFact["kind"][] = [
  "empty",
  "stellar_contact",
  "hazard",
  "ruin",
  "anomaly",
  "signal",
];
const ACCESS_ASSESSMENTS: readonly AccessFact["assessment"][] = [
  "reachable",
  "contested",
  "secured",
  "denied",
  "disrupted",
];
const OPERATION_STATES: readonly GalaxyOperationRecord["state"][] = [
  "available",
  "accepted",
  "active",
  "complete",
  "failed",
  "expired",
];
const TRAVEL_STATES: readonly TravelCommitment["state"][] = [
  "committed",
  "advancing",
  "interrupted",
  "arrived",
  "diverted",
  "resolved",
];
const VESSEL_STATUSES: readonly GalaxyRunState["vessel"]["status"][] = [
  "stationary",
  "in_transit",
  "stranded",
];
const BUILDING_TYPES: readonly ColonyBuilding["type"][] = [
  "solar_array",
  "farm",
  "water_purifier",
  "mine",
  "refinery",
  "habitat_module",
  "med_bay",
  "marketplace",
  "cantina",
  "town_hall",
  "barracks",
  "turret_defense",
  "shield_generator",
  "radar_array",
  "comms_tower",
  "spaceport",
  "research_lab",
  "atmosphere_processor",
];
const BUILDING_STATUSES: readonly ColonyBuilding["status"][] = [
  "constructing",
  "operational",
  "damaged",
  "offline",
  "destroyed",
];
const FOUNDING_TYPES: readonly ColonyState["foundingType"][] = [
  "outpost",
  "colony",
  "stronghold",
];
const COLONY_TIERS: readonly ColonyState["tier"][] = [1, 2, 3, 4];
const BUILDING_TIERS: readonly ColonyBuilding["tier"][] = [1, 2, 3];
const REGION_NODE_TYPES: readonly RegionNode["type"][] = [
  "colony_site",
  "ruins",
  "hollow_bunker",
  "cave",
  "crash_site",
  "wreck",
  "raider_outpost",
  "neutral_village",
  "wilderness",
  "anomaly",
  "abandoned_colony",
];
const REGION_INTEL_STATES: readonly RegionNode["intel"][] = [
  "unknown",
  "rumored",
  "surveyed",
  "cleared",
  "claimed",
];
const PLANET_BIOMES: readonly PlanetState["biome"][] = [
  "ice",
  "volcanic",
  "ocean",
  "desert",
  "jungle",
  "urban",
  "barren",
  "toxic",
];
const SEASONS: readonly GameClock["season"][] = [
  "standard",
  "storm",
  "bloom",
  "deadzone",
];
const DEATH_CAUSES: readonly DeathRecord["cause"][] = [
  "hunger",
  "disease",
  "raid",
  "siege",
  "disaster",
  "player",
  "natural",
];
const DISTRICT_KINDS: readonly District["kind"][] = [
  "residential",
  "market",
  "industrial",
  "civic",
  "military",
];
const COLONY_THREAT_KINDS: readonly Threat["kind"][] = [
  "raid_incoming",
  "siege_ongoing",
  "disaster_active",
  "supply_disruption",
];
const COLONY_THREAT_SEVERITIES: readonly Threat["severity"][] = [
  "minor",
  "major",
  "catastrophic",
];

const STARTING_CONTACTS = [
  {
    subjectId: "contact:vanguard",
    coordinate: coord(0, 0, 512, 512),
    recordId: "knowledge:vanguard-operational",
    state: "visited",
    confidence: "high",
    observedProperties: { label: "Vanguard", operational: true },
  },
  {
    subjectId: "contact:ashfall",
    coordinate: coord(0, 0, 1024, 512),
    recordId: "knowledge:ashfall-distress",
    state: "charted",
    confidence: "high",
    observedProperties: { label: "Ashfall", distressSignal: true },
  },
  {
    subjectId: "contact:hostile-picket",
    coordinate: coord(0, 0, 1280, 1024),
    recordId: "knowledge:hostile-picket",
    state: "charted",
    confidence: "medium",
    observedProperties: { label: "Hostile Picket", hostile: true },
  },
  {
    subjectId: "contact:kepler",
    coordinate: coord(0, 0, 2048, 1024),
    recordId: "knowledge:kepler-recorder",
    state: "charted",
    confidence: "medium",
    observedProperties: { label: "Kepler", recorderSignal: true },
  },
  {
    subjectId: "signal:unresolved-g0",
    coordinate: coord(0, 0, 2816, 1792),
    recordId: "knowledge:unresolved-signal",
    state: "signal",
    confidence: "low",
    observedProperties: { label: "Unresolved Signal", unresolved: true },
  },
] as const;

const STARTING_THREAT_BANDS: Readonly<
  Record<string, Readonly<Record<ThreatDimension, ThreatBand>>>
> = Object.freeze({
  "contact:vanguard": Object.freeze({
    military: "low",
    political: "low",
    environmental: "low",
    logistical: "low",
    anomalous: "low",
  }),
  "contact:ashfall": Object.freeze({
    military: "low",
    political: "low",
    environmental: "moderate",
    logistical: "low",
    anomalous: "low",
  }),
  "contact:hostile-picket": Object.freeze({
    military: "high",
    political: "low",
    environmental: "low",
    logistical: "moderate",
    anomalous: "low",
  }),
  "contact:kepler": Object.freeze({
    military: "low",
    political: "low",
    environmental: "moderate",
    logistical: "low",
    anomalous: "moderate",
  }),
  "signal:unresolved-g0": Object.freeze({
    military: "unknown",
    political: "unknown",
    environmental: "unknown",
    logistical: "unknown",
    anomalous: "moderate",
  }),
});

function startingAtlas(identity: AtlasGenerationIdentity): GalaxyAtlasState {
  let atlas: GalaxyAtlasState = {
    materializedFacts: {},
    knowledge: {},
    mappedCellKeys: [],
    accessFacts: [],
    threatObservations: [],
  };

  for (const contact of STARTING_CONTACTS) {
    const resolved = resolveCell(identity, contact.coordinate);
    if (!resolved.ok || resolved.fact.id !== contact.subjectId) {
      throw new Error(`Unable to materialize authored G0 anchor ${contact.subjectId}`);
    }
    const input = {
      fact: resolved.fact,
      record: {
        id: contact.recordId,
        observedProperties: { ...contact.observedProperties },
        confidence: contact.confidence,
        source: "authored" as const,
        observedCycle: 0,
        expiresCycle: null,
      },
    };
    if (contact.state === "visited") {
      atlas = visitFact(atlas, input);
    } else if (contact.state === "charted") {
      atlas = chartFact(atlas, input);
    } else {
      atlas = observeFact(atlas, input);
    }
  }

  const materializedFacts: Record<string, AtlasCellFact> = {};
  for (const [key, fact] of Object.entries(atlas.materializedFacts)) {
    defineOwn(materializedFacts, key, cloneCellFact(fact));
  }
  const knowledge: Record<string, AtlasKnowledgeRecord> = {};
  for (const [key, knowledgeRecord] of Object.entries(atlas.knowledge)) {
    defineOwn(knowledge, key, cloneKnowledge(knowledgeRecord));
  }
  atlas = { ...atlas, materializedFacts, knowledge };

  atlas.threatObservations = STARTING_CONTACTS.flatMap((contact) =>
    THREAT_DIMENSIONS.map((dimension) => ({
      id: `threat:${contact.subjectId}:${dimension}`,
      subjectId: contact.subjectId,
      dimension,
      band: STARTING_THREAT_BANDS[contact.subjectId][dimension],
      confidence: contact.confidence,
      source: "authored" as const,
      observedCycle: 0,
    })),
  );
  return atlas;
}

function colonyBootstrapSave(): SaveData {
  return {
    currentWorld: 1,
    levels: {},
    credits: 0,
    totalStars: 0,
    totalScore: 0,
    xp: 0,
    upgrades: { ...DEFAULT_UPGRADES },
    unlockedCodex: [],
    viewedCodex: [],
    viewedConversations: [],
    completedQuests: [],
    activeQuests: [],
    completedPlanets: [],
    unlockedSpecialMissions: [],
    completedSpecialMissions: [],
    storyItems: [],
    materials: [],
    consumableInventory: {},
    equippedConsumables: [],
    unlockedEnhancements: [],
    bestiary: {},
    equippedWeaponType: "kinetic",
    pilotLevel: 1,
    skillPoints: 0,
    allocatedSkills: [],
    colonies: [],
    planets: [createPlanetRegionState("ashfall", ASHFALL_REGION_SEED)],
    earthShipments: [],
    factionStandings: defaultFactionStandings(),
    bounties: [],
    missionsSinceStart: 0,
    gameClock: {
      day: 0,
      hour: 7,
      minute: 0,
      realtimeMsPerGameMinute: 1000,
      season: "standard",
    },
    activeExperience: "galaxy",
    galaxyRun: null,
  };
}

function startingColoniesAndPlanets(): Pick<GalaxyRunState, "colonies" | "planets"> {
  const founded = colonyReducer(
    colonyBootstrapSave(),
    Events.founded({
      colonyId: "galaxy:ashfall-primary",
      name: "Ashfall Primary",
      planetId: "ashfall",
      foundingType: "outpost",
      regionNodeId: "ashfall-forward-camp",
      missionCount: 0,
      layoutSeed: ASHFALL_REGION_SEED,
    }),
  );
  if (founded.colonies.length !== 1) {
    throw new Error("Unable to found the authored G0 Ashfall colony");
  }
  return { colonies: founded.colonies, planets: founded.planets };
}

function initialOperations(): Record<string, GalaxyOperationRecord> {
  return {
    "op:hostile-picket": {
      state: "available",
      acceptedCycle: null,
      resolvedCycle: null,
      completionIds: [],
    },
    "op:kepler-black-box": {
      state: "available",
      acceptedCycle: null,
      resolvedCycle: null,
      completionIds: [],
    },
    "op:ashfall-sortie": {
      state: "available",
      acceptedCycle: null,
      resolvedCycle: null,
      completionIds: [],
    },
  };
}

function initialHistoryFacts(): HistoricalFact[] {
  return [
    {
      id: "fact:vanguard-operational",
      kind: "operational",
      subjectId: "contact:vanguard",
      cycle: 0,
      causeFactIds: [],
    },
    {
      id: "fact:ashfall-distress",
      kind: "distress_signal",
      subjectId: "contact:ashfall",
      cycle: 0,
      causeFactIds: [],
    },
    {
      id: "fact:picket-patrol-active",
      kind: "patrol_active",
      subjectId: "contact:hostile-picket",
      cycle: 0,
      causeFactIds: [],
    },
    {
      id: "fact:kepler-recorder-signal",
      kind: "recorder_signal",
      subjectId: "contact:kepler",
      cycle: 0,
      causeFactIds: [],
    },
    {
      id: "fact:unresolved-signal",
      kind: "unresolved_signal",
      subjectId: "signal:unresolved-g0",
      cycle: 0,
      causeFactIds: [],
    },
  ];
}

export function createFreshGalaxyRun(
  identity: AtlasGenerationIdentity = G0_GENERATION_IDENTITY,
): GalaxyRunState {
  const availability = getGalaxyRunAvailability(identity);
  if (availability.status === "unavailable") {
    throw new RangeError(`Cannot create fresh galaxy run: ${availability.reason}`);
  }
  const colonyState = startingColoniesAndPlanets();
  return {
    identity: { ...identity },
    worldCycle: 0,
    nextTransactionOrdinal: 1,
    resources: { supply: G0_STARTING_SUPPLY, credits: 0, materials: [] },
    ship: {
      upgrades: { ...DEFAULT_UPGRADES },
      unlockedEnhancements: [],
      equippedWeaponType: "kinetic",
      consumableInventory: {},
      equippedConsumables: [],
    },
    pilot: {
      xp: 0,
      level: 1,
      skillPoints: 0,
      allocatedSkills: [],
      bestiary: {},
    },
    codex: { unlocked: [], viewed: [] },
    storyItems: [],
    vessel: {
      status: "stationary",
      coordinate: coord(0, 0, 512, 512),
      contactId: "contact:vanguard",
      transitTransactionId: null,
    },
    atlas: startingAtlas(identity),
    operations: initialOperations(),
    activeTravel: null,
    colonies: colonyState.colonies,
    planets: colonyState.planets,
    factionStandings: defaultFactionStandings(),
    historyFacts: initialHistoryFacts(),
    appliedOutcomeIds: [],
  };
}

export function startFreshGalaxy(
  save: SaveData,
  identity: AtlasGenerationIdentity = G0_GENERATION_IDENTITY,
): SaveData {
  return {
    ...save,
    activeExperience: "galaxy",
    galaxyRun: createFreshGalaxyRun(identity),
  };
}

export function getGalaxyRunAvailability(
  runOrIdentity: GalaxyRunState | AtlasGenerationIdentity | null,
): GalaxyRunAvailability {
  if (runOrIdentity === null) return { status: "not_started" };
  const identity = "identity" in runOrIdentity
    ? runOrIdentity.identity
    : runOrIdentity;
  const availability = getGenerationAvailability(identity);
  if (!availability.generationVersionAvailable) {
    return {
      status: "unavailable",
      recoverable: true,
      reason: "unsupported_generation_version",
    };
  }
  if (!availability.authoredAnchorRegistryVersionAvailable) {
    return {
      status: "unavailable",
      recoverable: true,
      reason: "unsupported_registry_version",
    };
  }
  return { status: "available" };
}

function createGenerationNeutralRecoverySkeleton(
  identity: AtlasGenerationIdentity,
): GalaxyRunState {
  return {
    identity: { ...identity },
    worldCycle: 0,
    nextTransactionOrdinal: 1,
    resources: { supply: 0, credits: 0, materials: [] },
    ship: {
      upgrades: { ...DEFAULT_UPGRADES },
      unlockedEnhancements: [],
      equippedWeaponType: "kinetic",
      consumableInventory: {},
      equippedConsumables: [],
    },
    pilot: {
      xp: 0,
      level: 1,
      skillPoints: 0,
      allocatedSkills: [],
      bestiary: {},
    },
    codex: { unlocked: [], viewed: [] },
    storyItems: [],
    vessel: {
      status: "stationary",
      coordinate: coord(0, 0, 0, 0),
      contactId: null,
      transitTransactionId: null,
    },
    atlas: {
      materializedFacts: {},
      knowledge: {},
      mappedCellKeys: [],
      accessFacts: [],
      threatObservations: [],
    },
    operations: {},
    activeTravel: null,
    colonies: [],
    planets: [],
    factionStandings: [],
    historyFacts: [],
    appliedOutcomeIds: [],
  };
}

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function own(source: UnknownRecord | null, key: string): unknown {
  if (source === null || !Object.prototype.hasOwnProperty.call(source, key)) {
    return undefined;
  }
  return source[key];
}

function enumMatch<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | undefined {
  return allowed.find((candidate) => candidate === value);
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return enumMatch(value, allowed) ?? fallback;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function nullableString(
  value: unknown,
  fallback: string | null,
): string | null {
  return value === null || typeof value === "string" ? value : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function finiteValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nonnegativeFinite(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : fallback;
}

function finiteInRange(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  return typeof value === "number"
      && Number.isFinite(value)
      && value >= minimum
      && value <= maximum
    ? value
    : fallback;
}

function positiveFinite(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function nonnegativeSafeInteger(value: unknown, fallback: number): number {
  return Number.isSafeInteger(value) && (value as number) >= 0
    ? value as number
    : fallback;
}

function positiveSafeInteger(value: unknown, fallback: number): number {
  return Number.isSafeInteger(value) && (value as number) >= 1
    ? value as number
    : fallback;
}

function safeIntegerInRange(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  return Number.isSafeInteger(value)
      && (value as number) >= minimum
      && (value as number) <= maximum
    ? value as number
    : fallback;
}

function optionalNonnegativeSafeInteger(
  value: unknown,
  fallback: number | undefined,
): number | undefined {
  if (value === undefined) return fallback;
  return Number.isSafeInteger(value) && (value as number) >= 0
    ? value as number
    : fallback;
}

function nullableNonnegativeSafeInteger(
  value: unknown,
  fallback: number | null,
): number | null {
  if (value === null) return null;
  return Number.isSafeInteger(value) && (value as number) >= 0
    ? value as number
    : fallback;
}

function stringArray(value: unknown, fallback: readonly string[]): string[] {
  const source = Array.isArray(value) ? value : fallback;
  const result: string[] = [];
  const seen = new Set<string>();
  for (const entry of source) {
    if (typeof entry !== "string" || seen.has(entry)) continue;
    seen.add(entry);
    result.push(entry);
  }
  return result;
}

function enumArray<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: readonly T[],
): T[] {
  if (!Array.isArray(value)) return [...fallback];
  const result: T[] = [];
  for (const entry of value) {
    const matched = enumMatch(entry, allowed);
    if (matched !== undefined) result.push(matched);
  }
  return result;
}

function ownDictionaryValue<T>(
  dictionary: Readonly<Record<string, T>>,
  key: string,
): T | undefined {
  if (!Object.prototype.hasOwnProperty.call(dictionary, key)) return undefined;
  return dictionary[key];
}

function defineOwn<T>(target: Record<string, T>, key: string, value: T): void {
  Object.defineProperty(target, key, {
    value,
    configurable: true,
    enumerable: true,
    writable: true,
  });
}

function nullDictionary<T>(): Record<string, T> {
  return {};
}

function cloneSerializable(value: unknown): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(cloneSerializable);
  }
  const source = record(value);
  if (source === null) return null;
  const cloned: Record<string, unknown> = {};
  for (const key of Object.keys(source)) {
    defineOwn(cloned, key, cloneSerializable(own(source, key)));
  }
  return cloned;
}

function cloneObservedProperties(
  value: unknown,
  fallback: Readonly<Record<string, string | number | boolean | null>>,
): Record<string, string | number | boolean | null> {
  const source = record(value);
  if (source === null) return { ...fallback };
  const result: Record<string, string | number | boolean | null> = {};
  for (const key of Object.keys(source)) {
    const entry = own(source, key);
    if (
      entry !== null &&
      typeof entry !== "string" &&
      typeof entry !== "boolean" &&
      !(typeof entry === "number" && Number.isFinite(entry))
    ) {
      return { ...fallback };
    }
    defineOwn(result, key, entry);
  }
  return result;
}

function migrateCoordinate(value: unknown, fallback: GalaxyRunState["vessel"]["coordinate"]) {
  if (!validateCoordinate(value).ok) return { ...fallback };
  const source = record(value);
  if (source === null) return { ...fallback };
  return {
    sectorX: own(source, "sectorX") as number,
    sectorY: own(source, "sectorY") as number,
    localX: own(source, "localX") as number,
    localY: own(source, "localY") as number,
  };
}

function migrateIdentity(
  value: unknown,
  fallback: AtlasGenerationIdentity,
): AtlasGenerationIdentity {
  const source = record(value);
  return {
    galaxySeed: stringValue(own(source, "galaxySeed"), fallback.galaxySeed),
    generationVersion: nonnegativeSafeInteger(
      own(source, "generationVersion"),
      fallback.generationVersion,
    ),
    authoredAnchorRegistryVersion: nonnegativeSafeInteger(
      own(source, "authoredAnchorRegistryVersion"),
      fallback.authoredAnchorRegistryVersion,
    ),
  };
}

function migrateUpgrades(value: unknown, fallback: ShipUpgrades): ShipUpgrades {
  const source = record(value);
  return {
    hullPlating: safeIntegerInRange(own(source, "hullPlating"), 0, 5, fallback.hullPlating),
    engineBoost: safeIntegerInRange(own(source, "engineBoost"), 0, 5, fallback.engineBoost),
    weaponCore: safeIntegerInRange(own(source, "weaponCore"), 0, 5, fallback.weaponCore),
    munitionsBay: safeIntegerInRange(own(source, "munitionsBay"), 0, 5, fallback.munitionsBay),
    fireControl: safeIntegerInRange(own(source, "fireControl"), 0, 5, fallback.fireControl),
    shieldGenerator: safeIntegerInRange(
      own(source, "shieldGenerator"),
      0,
      5,
      fallback.shieldGenerator,
    ),
  };
}

function migrateConsumableInventory(
  value: unknown,
  fallback: GalaxyShipState["consumableInventory"],
): GalaxyShipState["consumableInventory"] {
  const source = record(value);
  if (source === null) return { ...fallback };
  const result: GalaxyShipState["consumableInventory"] = {};
  for (const id of CONSUMABLE_IDS) {
    const entry = own(source, id);
    if (entry === undefined) continue;
    if (!Number.isSafeInteger(entry) || (entry as number) < 0) continue;
    result[id] = entry as number;
  }
  return result;
}

function migrateShip(value: unknown, fallback: GalaxyShipState): GalaxyShipState {
  const source = record(value);
  return {
    upgrades: migrateUpgrades(own(source, "upgrades"), fallback.upgrades),
    unlockedEnhancements: enumArray(
      own(source, "unlockedEnhancements"),
      ENHANCEMENT_IDS,
      fallback.unlockedEnhancements,
    ),
    equippedWeaponType: enumValue(
      own(source, "equippedWeaponType"),
      WEAPON_TYPES,
      fallback.equippedWeaponType,
    ),
    consumableInventory: migrateConsumableInventory(
      own(source, "consumableInventory"),
      fallback.consumableInventory,
    ),
    equippedConsumables: enumArray(
      own(source, "equippedConsumables"),
      CONSUMABLE_IDS,
      fallback.equippedConsumables,
    ),
  };
}

function migrateBestiaryEntry(
  value: unknown,
  fallback: BestiaryEntry | undefined,
): BestiaryEntry | null {
  const source = record(value);
  if (source === null) return fallback === undefined ? null : { ...fallback };
  const enemyType = enumMatch(own(source, "enemyType"), ENEMY_TYPES) ?? fallback?.enemyType;
  const classId = enumMatch(own(source, "classId"), ENEMY_CLASSES) ?? fallback?.classId;
  if (enemyType === undefined || classId === undefined) return null;
  const entry: BestiaryEntry = {
    enemyType,
    classId,
    killCount: nonnegativeSafeInteger(own(source, "killCount"), fallback?.killCount ?? 0),
  };
  const firstSeenPlanet = enumMatch(own(source, "firstSeenPlanet"), PLANET_IDS)
    ?? fallback?.firstSeenPlanet;
  const firstSeenWorld = optionalNonnegativeSafeInteger(
    own(source, "firstSeenWorld"),
    fallback?.firstSeenWorld,
  );
  if (firstSeenPlanet !== undefined) entry.firstSeenPlanet = firstSeenPlanet;
  if (firstSeenWorld !== undefined) entry.firstSeenWorld = firstSeenWorld;
  return entry;
}

function migrateBestiary(
  value: unknown,
  fallback: GalaxyPilotState["bestiary"],
): GalaxyPilotState["bestiary"] {
  const source = record(value);
  if (source === null) {
    const cloned: GalaxyPilotState["bestiary"] = {};
    for (const id of ENEMY_TYPES) {
      const entry = fallback[id];
      if (entry !== undefined) cloned[id] = { ...entry };
    }
    return cloned;
  }
  const result: GalaxyPilotState["bestiary"] = {};
  for (const id of ENEMY_TYPES) {
    const rawEntry = own(source, id);
    if (rawEntry === undefined && fallback[id] === undefined) continue;
    const migrated = migrateBestiaryEntry(rawEntry, fallback[id]);
    if (migrated !== null) result[id] = migrated;
  }
  return result;
}

function migratePilot(value: unknown, fallback: GalaxyPilotState): GalaxyPilotState {
  const source = record(value);
  return {
    xp: nonnegativeSafeInteger(own(source, "xp"), fallback.xp),
    level: safeIntegerInRange(own(source, "level"), 1, MAX_PILOT_LEVEL, fallback.level),
    skillPoints: nonnegativeSafeInteger(own(source, "skillPoints"), fallback.skillPoints),
    allocatedSkills: enumArray(
      own(source, "allocatedSkills"),
      SKILL_NODE_IDS,
      fallback.allocatedSkills,
    ),
    bestiary: migrateBestiary(own(source, "bestiary"), fallback.bestiary),
  };
}

function migrateOperation(
  value: unknown,
  fallback: GalaxyOperationRecord,
): GalaxyOperationRecord {
  const source = record(value);
  const acceptedCycleValue = own(source, "acceptedCycle");
  const resolvedCycleValue = own(source, "resolvedCycle");
  return {
    state: enumValue(own(source, "state"), OPERATION_STATES, fallback.state),
    acceptedCycle: nullableNonnegativeSafeInteger(
      acceptedCycleValue,
      fallback.acceptedCycle,
    ),
    resolvedCycle: nullableNonnegativeSafeInteger(
      resolvedCycleValue,
      fallback.resolvedCycle,
    ),
    completionIds: stringArray(own(source, "completionIds"), fallback.completionIds),
  };
}

function migrateOperationMap(
  value: unknown,
  fallback: Record<string, GalaxyOperationRecord>,
): Record<string, GalaxyOperationRecord> {
  const result: Record<string, GalaxyOperationRecord> = {};
  for (const key of Object.keys(fallback)) {
    const ownFallback = ownDictionaryValue(fallback, key);
    if (ownFallback !== undefined) {
      defineOwn(result, key, migrateOperation(ownFallback, ownFallback));
    }
  }
  const source = record(value);
  if (source === null) return result;
  for (const key of Object.keys(source)) {
    const rawEntry = own(source, key);
    const entryFallback = ownDictionaryValue(fallback, key) ?? {
      state: "available",
      acceptedCycle: null,
      resolvedCycle: null,
      completionIds: [],
    };
    defineOwn(result, key, migrateOperation(rawEntry, entryFallback));
  }
  return result;
}

function migrateRouteLeg(
  value: unknown,
  coordinateFallback: GalaxyRunState["vessel"]["coordinate"],
): RouteLeg | null {
  const source = record(value);
  if (source === null || typeof own(source, "id") !== "string") return null;
  const distanceUnits = own(source, "distanceUnits");
  const cycles = own(source, "cycles");
  const supplyCost = own(source, "supplyCost");
  if (
    !validateCoordinate(own(source, "from")).ok
    || !validateCoordinate(own(source, "to")).ok
    || typeof distanceUnits !== "number"
    || !Number.isFinite(distanceUnits)
    || distanceUnits < 0
    || !Number.isSafeInteger(cycles)
    || (cycles as number) < 0
    || !Number.isSafeInteger(supplyCost)
    || (supplyCost as number) < 0
  ) return null;
  return {
    id: own(source, "id") as string,
    from: migrateCoordinate(own(source, "from"), coordinateFallback),
    to: migrateCoordinate(own(source, "to"), coordinateFallback),
    distanceUnits,
    cycles: cycles as number,
    supplyCost: supplyCost as number,
    interruptionCauseId: nullableString(own(source, "interruptionCauseId"), null),
  };
}

function migrateTravel(
  value: unknown,
  coordinateFallback: GalaxyRunState["vessel"]["coordinate"],
): TravelCommitment | null {
  if (value === null) return null;
  const source = record(value);
  if (source === null) return null;
  const state = enumMatch(own(source, "state"), TRAVEL_STATES);
  if (state === undefined) return null;
  const nextLegIndex = own(source, "nextLegIndex");
  const supplyCost = own(source, "supplyCost");
  const elapsedCycles = own(source, "elapsedCycles");
  if (
    !validateCoordinate(own(source, "origin")).ok
    || !validateCoordinate(own(source, "destination")).ok
    || !Number.isSafeInteger(nextLegIndex)
    || (nextLegIndex as number) < 0
    || !Number.isSafeInteger(supplyCost)
    || (supplyCost as number) < 0
    || !Number.isSafeInteger(elapsedCycles)
    || (elapsedCycles as number) < 0
  ) return null;
  const rawLegs = own(source, "legs");
  if (!Array.isArray(rawLegs) || rawLegs.length === 0) return null;
  const legs: RouteLeg[] = [];
  for (const entry of rawLegs) {
    const migrated = migrateRouteLeg(entry, coordinateFallback);
    if (migrated === null) return null;
    legs.push(migrated);
  }
  return {
    transactionId: stringValue(own(source, "transactionId"), ""),
    state,
    routePlanId: stringValue(own(source, "routePlanId"), ""),
    origin: migrateCoordinate(own(source, "origin"), coordinateFallback),
    destination: migrateCoordinate(own(source, "destination"), coordinateFallback),
    targetId: nullableString(own(source, "targetId"), null),
    legs,
    nextLegIndex: nextLegIndex as number,
    appliedCheckpointIds: stringArray(own(source, "appliedCheckpointIds"), []),
    supplyCost: supplyCost as number,
    elapsedCycles: elapsedCycles as number,
    interruptionOperationId: nullableString(
      own(source, "interruptionOperationId"),
      null,
    ),
  };
}

function travelCommitmentIsCoherent(
  travel: TravelCommitment,
  vessel: GalaxyRunState["vessel"],
): boolean {
  if (travel.transactionId.length === 0 || travel.routePlanId.length === 0) return false;
  if (
    travel.legs.length === 0
    || travel.nextLegIndex < 0
    || travel.nextLegIndex > travel.legs.length
  ) return false;
  if (!sameCoordinate(travel.legs[0].from, travel.origin)) return false;
  if (!sameCoordinate(travel.legs[travel.legs.length - 1].to, travel.destination)) {
    return false;
  }

  const legIds = new Set<string>();
  let totalSupply = 0;
  for (let index = 0; index < travel.legs.length; index++) {
    const leg = travel.legs[index];
    if (leg.id.length === 0 || legIds.has(leg.id)) return false;
    legIds.add(leg.id);
    totalSupply += leg.supplyCost;
    if (!Number.isSafeInteger(totalSupply)) return false;
    if (index > 0 && !sameCoordinate(travel.legs[index - 1].to, leg.from)) return false;
  }
  if (totalSupply !== travel.supplyCost) return false;

  let completedCycles = 0;
  const completedCheckpoints = new Set<string>();
  for (let index = 0; index < travel.nextLegIndex; index++) {
    completedCycles += travel.legs[index].cycles;
    if (!Number.isSafeInteger(completedCycles)) return false;
    completedCheckpoints.add(`${travel.transactionId}:leg:${index}`);
  }
  if (completedCycles !== travel.elapsedCycles) return false;
  const legCheckpointPrefix = `${travel.transactionId}:leg:`;
  const checkpointIds = new Set(travel.appliedCheckpointIds);
  for (const checkpointId of checkpointIds) {
    if (checkpointId.length === 0) return false;
    if (
      checkpointId.startsWith(legCheckpointPrefix)
      && !completedCheckpoints.has(checkpointId)
    ) return false;
  }
  for (const checkpointId of completedCheckpoints) {
    if (!checkpointIds.has(checkpointId)) return false;
  }

  const progressCoordinate = travel.nextLegIndex === 0
    ? travel.origin
    : travel.legs[travel.nextLegIndex - 1].to;

  if (
    travel.state === "committed"
    || travel.state === "advancing"
    || travel.state === "interrupted"
  ) {
    return vessel.status === "in_transit"
      && vessel.transitTransactionId === travel.transactionId
      && sameCoordinate(vessel.coordinate, progressCoordinate);
  }
  if (travel.state === "diverted") {
    return vessel.status === "stranded"
      && vessel.transitTransactionId === travel.transactionId
      && sameCoordinate(vessel.coordinate, progressCoordinate);
  }
  if (travel.state === "arrived") {
    return vessel.status === "stationary"
      && vessel.transitTransactionId === null
      && travel.nextLegIndex === travel.legs.length
      && sameCoordinate(vessel.coordinate, travel.destination);
  }
  return vessel.status === "stationary"
    && vessel.transitTransactionId === null
    && (
      sameCoordinate(vessel.coordinate, travel.origin)
      || (
        travel.nextLegIndex === travel.legs.length
        && sameCoordinate(vessel.coordinate, travel.destination)
      )
    );
}

function reconcileTravel(
  travel: TravelCommitment | null,
  vessel: GalaxyRunState["vessel"],
  recoveryOrigin: GalaxyRunState["vessel"]["coordinate"] | null,
): Pick<GalaxyRunState, "activeTravel" | "vessel"> {
  if (travel !== null && travelCommitmentIsCoherent(travel, vessel)) {
    return { activeTravel: travel, vessel };
  }
  if (travel === null && vessel.status === "stationary") {
    return { activeTravel: null, vessel };
  }
  return {
    activeTravel: null,
    vessel: {
      ...vessel,
      status: "stationary",
      coordinate: vessel.status === "stationary"
        ? { ...vessel.coordinate }
        : { ...(travel?.origin ?? recoveryOrigin ?? vessel.coordinate) },
      transitTransactionId: null,
    },
  };
}

function travelRecoveryOrigin(
  value: unknown,
): GalaxyRunState["vessel"]["coordinate"] | null {
  const source = record(value);
  const origin = own(source, "origin");
  if (!validateCoordinate(origin).ok) return null;
  return migrateCoordinate(origin, coord(0, 0, 0, 0));
}

function cloneCellFact(fact: AtlasCellFact): AtlasCellFact {
  return { ...fact, coordinate: { ...fact.coordinate } };
}

function migrateCellFact(
  value: unknown,
  fallback: AtlasCellFact,
  coordinateFallback: GalaxyRunState["vessel"]["coordinate"],
): AtlasCellFact {
  const source = record(value);
  return {
    id: stringValue(own(source, "id"), fallback.id),
    cellKey: stringValue(own(source, "cellKey"), fallback.cellKey),
    coordinate: migrateCoordinate(
      own(source, "coordinate"),
      fallback.coordinate ?? coordinateFallback,
    ),
    kind: enumValue(own(source, "kind"), CELL_KINDS, fallback.kind),
    contactId: nullableString(own(source, "contactId"), fallback.contactId),
    stableSeed: nonnegativeSafeInteger(own(source, "stableSeed"), fallback.stableSeed),
    authored: booleanValue(own(source, "authored"), fallback.authored),
  };
}

function migrateCellFactMap(
  value: unknown,
  fallback: Record<string, AtlasCellFact>,
  coordinateFallback: GalaxyRunState["vessel"]["coordinate"],
): Record<string, AtlasCellFact> {
  const result = nullDictionary<AtlasCellFact>();
  for (const key of Object.keys(fallback)) {
    const ownFallback = ownDictionaryValue(fallback, key);
    if (ownFallback !== undefined) defineOwn(result, key, cloneCellFact(ownFallback));
  }
  const source = record(value);
  if (source === null) return result;
  for (const key of Object.keys(source)) {
    const rawEntry = own(source, key);
    const entryFallback = ownDictionaryValue(fallback, key) ?? {
      id: key,
      cellKey: key,
      coordinate: { ...coordinateFallback },
      kind: "empty",
      contactId: null,
      stableSeed: 0,
      authored: false,
    };
    defineOwn(result, key, migrateCellFact(rawEntry, entryFallback, coordinateFallback));
  }
  return result;
}

function cloneKnowledge(recordValue: AtlasKnowledgeRecord): AtlasKnowledgeRecord {
  return {
    ...recordValue,
    observedProperties: cloneObservedProperties(
      recordValue.observedProperties,
      recordValue.observedProperties,
    ),
  };
}

function migrateKnowledgeRecord(
  value: unknown,
  fallback: AtlasKnowledgeRecord,
): AtlasKnowledgeRecord {
  const source = record(value);
  const expiresCycleValue = own(source, "expiresCycle");
  return {
    id: stringValue(own(source, "id"), fallback.id),
    subjectId: stringValue(own(source, "subjectId"), fallback.subjectId),
    state: enumValue(own(source, "state"), KNOWLEDGE_STATES, fallback.state),
    observedProperties: cloneObservedProperties(
      own(source, "observedProperties"),
      fallback.observedProperties,
    ),
    confidence: enumValue(
      own(source, "confidence"),
      KNOWLEDGE_CONFIDENCES,
      fallback.confidence,
    ),
    source: enumValue(own(source, "source"), KNOWLEDGE_SOURCES, fallback.source),
    observedCycle: nonnegativeSafeInteger(
      own(source, "observedCycle"),
      fallback.observedCycle,
    ),
    expiresCycle: nullableNonnegativeSafeInteger(
      expiresCycleValue,
      fallback.expiresCycle,
    ),
  };
}

function migrateKnowledgeMap(
  value: unknown,
  fallback: Record<string, AtlasKnowledgeRecord>,
): Record<string, AtlasKnowledgeRecord> {
  const result = nullDictionary<AtlasKnowledgeRecord>();
  for (const key of Object.keys(fallback)) {
    const ownFallback = ownDictionaryValue(fallback, key);
    if (ownFallback !== undefined) defineOwn(result, key, cloneKnowledge(ownFallback));
  }
  const source = record(value);
  if (source === null) return result;
  for (const key of Object.keys(source)) {
    const rawEntry = own(source, key);
    const entryFallback = ownDictionaryValue(fallback, key) ?? {
      id: key,
      subjectId: key,
      state: "unknown",
      observedProperties: {},
      confidence: "low",
      source: "report",
      observedCycle: 0,
      expiresCycle: null,
    };
    defineOwn(result, key, migrateKnowledgeRecord(rawEntry, entryFallback));
  }
  return result;
}

function migrateAccessFact(
  value: unknown,
  fallback: AccessFact | undefined,
): AccessFact | null {
  const source = record(value);
  if (source === null) {
    return fallback === undefined
      ? null
      : { ...fallback, causeFactIds: [...fallback.causeFactIds] };
  }
  const assessment = enumMatch(own(source, "assessment"), ACCESS_ASSESSMENTS)
    ?? fallback?.assessment;
  if (assessment === undefined) return null;
  if (fallback === undefined && (
    typeof own(source, "id") !== "string"
    || typeof own(source, "subjectId") !== "string"
  )) return null;
  return {
    id: stringValue(own(source, "id"), fallback?.id ?? "access:recovered"),
    subjectId: stringValue(
      own(source, "subjectId"),
      fallback?.subjectId ?? "subject:unknown",
    ),
    assessment,
    causeFactIds: stringArray(own(source, "causeFactIds"), fallback?.causeFactIds ?? []),
    cycle: nonnegativeSafeInteger(own(source, "cycle"), fallback?.cycle ?? 0),
  };
}

function migrateAccessFacts(
  value: unknown,
  fallback: readonly AccessFact[],
): AccessFact[] {
  if (!Array.isArray(value)) {
    return fallback.map((fact) => ({ ...fact, causeFactIds: [...fact.causeFactIds] }));
  }
  const fallbackById = new Map(fallback.map((fact) => [fact.id, fact]));
  const result: AccessFact[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const entrySource = record(entry);
    const id = typeof own(entrySource, "id") === "string"
      ? own(entrySource, "id") as string
      : undefined;
    const migrated = migrateAccessFact(entry, id === undefined ? undefined : fallbackById.get(id));
    if (migrated === null || seen.has(migrated.id)) continue;
    seen.add(migrated.id);
    result.push(migrated);
  }
  return result;
}

function migrateThreatObservation(
  value: unknown,
  fallback: ThreatObservation | undefined,
): ThreatObservation | null {
  const source = record(value);
  if (source === null) return fallback === undefined ? null : { ...fallback };
  const dimension = enumMatch(own(source, "dimension"), THREAT_DIMENSIONS)
    ?? fallback?.dimension;
  const band = enumMatch(own(source, "band"), THREAT_BANDS) ?? fallback?.band;
  const confidence = enumMatch(own(source, "confidence"), KNOWLEDGE_CONFIDENCES)
    ?? fallback?.confidence;
  const knowledgeSource = enumMatch(own(source, "source"), KNOWLEDGE_SOURCES)
    ?? fallback?.source;
  if (
    dimension === undefined ||
    band === undefined ||
    confidence === undefined ||
    knowledgeSource === undefined
  ) {
    return null;
  }
  if (fallback === undefined && (
    typeof own(source, "id") !== "string"
    || typeof own(source, "subjectId") !== "string"
  )) return null;
  return {
    id: stringValue(own(source, "id"), fallback?.id ?? "threat:recovered"),
    subjectId: stringValue(
      own(source, "subjectId"),
      fallback?.subjectId ?? "subject:unknown",
    ),
    dimension,
    band,
    confidence,
    source: knowledgeSource,
    observedCycle: nonnegativeSafeInteger(
      own(source, "observedCycle"),
      fallback?.observedCycle ?? 0,
    ),
  };
}

function migrateThreatObservations(
  value: unknown,
  fallback: readonly ThreatObservation[],
): ThreatObservation[] {
  if (!Array.isArray(value)) return fallback.map((observation) => ({ ...observation }));
  const fallbackById = new Map(fallback.map((observation) => [observation.id, observation]));
  const result: ThreatObservation[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const entrySource = record(entry);
    const id = typeof own(entrySource, "id") === "string"
      ? own(entrySource, "id") as string
      : undefined;
    const migrated = migrateThreatObservation(
      entry,
      id === undefined ? undefined : fallbackById.get(id),
    );
    if (migrated === null || seen.has(migrated.id)) continue;
    seen.add(migrated.id);
    result.push(migrated);
  }
  return result;
}

function migrateAtlas(
  value: unknown,
  fallback: GalaxyAtlasState,
  coordinateFallback: GalaxyRunState["vessel"]["coordinate"],
): GalaxyAtlasState {
  const source = record(value);
  return {
    materializedFacts: migrateCellFactMap(
      own(source, "materializedFacts"),
      fallback.materializedFacts,
      coordinateFallback,
    ),
    knowledge: migrateKnowledgeMap(own(source, "knowledge"), fallback.knowledge),
    mappedCellKeys: stringArray(
      own(source, "mappedCellKeys"),
      fallback.mappedCellKeys,
    ),
    accessFacts: migrateAccessFacts(own(source, "accessFacts"), fallback.accessFacts),
    threatObservations: migrateThreatObservations(
      own(source, "threatObservations"),
      fallback.threatObservations,
    ),
  };
}

function migrateHistoryFact(
  value: unknown,
  fallback: HistoricalFact | undefined,
): HistoricalFact | null {
  const source = record(value);
  if (source === null) {
    return fallback === undefined
      ? null
      : { ...fallback, causeFactIds: [...fallback.causeFactIds] };
  }
  if (fallback === undefined && (
    typeof own(source, "id") !== "string" ||
    typeof own(source, "kind") !== "string" ||
    typeof own(source, "subjectId") !== "string"
  )) {
    return null;
  }
  return {
    id: stringValue(own(source, "id"), fallback?.id ?? "fact:recovered"),
    kind: stringValue(own(source, "kind"), fallback?.kind ?? "recovered"),
    subjectId: stringValue(
      own(source, "subjectId"),
      fallback?.subjectId ?? "subject:unknown",
    ),
    cycle: nonnegativeSafeInteger(own(source, "cycle"), fallback?.cycle ?? 0),
    causeFactIds: stringArray(own(source, "causeFactIds"), fallback?.causeFactIds ?? []),
  };
}

function migrateHistoryFacts(
  value: unknown,
  fallback: readonly HistoricalFact[],
): HistoricalFact[] {
  if (!Array.isArray(value)) {
    return fallback.map((fact) => ({ ...fact, causeFactIds: [...fact.causeFactIds] }));
  }
  const fallbackById = new Map(fallback.map((fact) => [fact.id, fact]));
  const result: HistoricalFact[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const source = record(entry);
    const id = typeof own(source, "id") === "string"
      ? own(source, "id") as string
      : undefined;
    const migrated = migrateHistoryFact(entry, id === undefined ? undefined : fallbackById.get(id));
    if (migrated === null || seen.has(migrated.id)) continue;
    seen.add(migrated.id);
    result.push(migrated);
  }
  return result;
}

function numberEnumMatch<T extends number>(
  value: unknown,
  allowed: readonly T[],
): T | undefined {
  return allowed.find((candidate) => candidate === value);
}

function migrateGameClock(value: unknown, fallback: GameClock): GameClock {
  const source = record(value);
  return {
    day: nonnegativeSafeInteger(own(source, "day"), fallback.day),
    hour: safeIntegerInRange(own(source, "hour"), 0, 23, fallback.hour),
    minute: safeIntegerInRange(own(source, "minute"), 0, 59, fallback.minute),
    realtimeMsPerGameMinute: positiveFinite(
      own(source, "realtimeMsPerGameMinute"),
      fallback.realtimeMsPerGameMinute,
    ),
    season: enumValue(own(source, "season"), SEASONS, fallback.season),
  };
}

function migrateSiteStats(value: unknown, fallback: SiteStats): SiteStats {
  const source = record(value);
  return {
    oreDensity: finiteInRange(own(source, "oreDensity"), 0, 100, fallback.oreDensity),
    waterTable: finiteInRange(own(source, "waterTable"), 0, 100, fallback.waterTable),
    buildableSlots: safeIntegerInRange(
      own(source, "buildableSlots"),
      0,
      6,
      fallback.buildableSlots,
    ),
    threat: finiteInRange(own(source, "threat"), 0, 100, fallback.threat),
  };
}

function migrateDeathRecord(
  value: unknown,
  fallback: DeathRecord | undefined,
): DeathRecord | null {
  const source = record(value);
  if (source === null) return fallback === undefined ? null : { ...fallback };
  const cause = enumMatch(own(source, "cause"), DEATH_CAUSES) ?? fallback?.cause;
  if (cause === undefined) return null;
  if (fallback === undefined && typeof own(source, "colonyId") !== "string") return null;
  return {
    npcId: nullableString(own(source, "npcId"), fallback?.npcId ?? null),
    cyclesAgo: nonnegativeSafeInteger(own(source, "cyclesAgo"), fallback?.cyclesAgo ?? 0),
    cause,
    colonyId: stringValue(own(source, "colonyId"), fallback?.colonyId ?? "colony:unknown"),
  };
}

function migrateDeathRecords(
  value: unknown,
  fallback: readonly DeathRecord[],
): DeathRecord[] {
  if (!Array.isArray(value)) return fallback.map((entry) => ({ ...entry }));
  const result: DeathRecord[] = [];
  for (const entry of value) {
    const migrated = migrateDeathRecord(entry, undefined);
    if (migrated !== null) result.push(migrated);
  }
  return result;
}

function migrateBuilding(
  value: unknown,
  fallback: ColonyBuilding | undefined,
): ColonyBuilding | null {
  const source = record(value);
  if (source === null) {
    return fallback === undefined
      ? null
      : { ...fallback, assignedNpcIds: [...fallback.assignedNpcIds] };
  }
  const type = enumMatch(own(source, "type"), BUILDING_TYPES) ?? fallback?.type;
  const tier = numberEnumMatch(own(source, "tier"), BUILDING_TIERS) ?? fallback?.tier;
  const status = enumMatch(own(source, "status"), BUILDING_STATUSES) ?? fallback?.status;
  if (type === undefined || tier === undefined || status === undefined) return null;
  if (fallback === undefined && typeof own(source, "id") !== "string") return null;
  return {
    id: stringValue(own(source, "id"), fallback?.id ?? "building:unknown"),
    type,
    tier,
    status,
    buildProgressCycles: nonnegativeSafeInteger(
      own(source, "buildProgressCycles"),
      fallback?.buildProgressCycles ?? 0,
    ),
    hp: nonnegativeFinite(own(source, "hp"), fallback?.hp ?? 0),
    maxHp: nonnegativeFinite(own(source, "maxHp"), fallback?.maxHp ?? 0),
    interiorTemplateId: nullableString(
      own(source, "interiorTemplateId"),
      fallback?.interiorTemplateId ?? null,
    ),
    assignedNpcIds: stringArray(
      own(source, "assignedNpcIds"),
      fallback?.assignedNpcIds ?? [],
    ),
    districtId: nullableString(own(source, "districtId"), fallback?.districtId ?? null),
  };
}

function migrateBuildings(
  value: unknown,
  fallback: readonly ColonyBuilding[],
): ColonyBuilding[] {
  if (!Array.isArray(value)) {
    return fallback.map((building) => ({
      ...building,
      assignedNpcIds: [...building.assignedNpcIds],
    }));
  }
  const fallbackById = new Map(fallback.map((building) => [building.id, building]));
  const result: ColonyBuilding[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const source = record(entry);
    const id = typeof own(source, "id") === "string" ? own(source, "id") as string : undefined;
    const migrated = migrateBuilding(entry, id === undefined ? undefined : fallbackById.get(id));
    if (migrated === null || seen.has(migrated.id)) continue;
    seen.add(migrated.id);
    result.push(migrated);
  }
  return result;
}

function migrateDistrict(
  value: unknown,
  fallback: District | undefined,
): District | null {
  const source = record(value);
  if (source === null) {
    return fallback === undefined
      ? null
      : { ...fallback, tiles: fallback.tiles.map(([x, y]) => [x, y]) };
  }
  const kind = enumMatch(own(source, "kind"), DISTRICT_KINDS) ?? fallback?.kind;
  if (kind === undefined) return null;
  if (fallback === undefined && (
    typeof own(source, "id") !== "string" ||
    typeof own(source, "colonyId") !== "string"
  )) return null;
  const rawTiles = own(source, "tiles");
  let tiles: Array<[number, number]>;
  if (!Array.isArray(rawTiles)) {
    tiles = fallback?.tiles.map(([x, y]) => [x, y]) ?? [];
  } else {
    tiles = [];
    for (const entry of rawTiles) {
      if (
        !Array.isArray(entry) ||
        entry.length < 2 ||
        !Number.isSafeInteger(entry[0]) ||
        !Number.isSafeInteger(entry[1])
      ) {
        return fallback === undefined
          ? null
          : { ...fallback, tiles: fallback.tiles.map(([x, y]) => [x, y]) };
      }
      tiles.push([entry[0], entry[1]]);
    }
  }
  return {
    id: stringValue(own(source, "id"), fallback?.id ?? "district:unknown"),
    colonyId: stringValue(
      own(source, "colonyId"),
      fallback?.colonyId ?? "colony:unknown",
    ),
    kind,
    tiles,
    travelAnchorId: nullableString(
      own(source, "travelAnchorId"),
      fallback?.travelAnchorId ?? null,
    ),
  };
}

function migrateDistricts(value: unknown, fallback: readonly District[]): District[] {
  if (!Array.isArray(value)) {
    return fallback.map((district) => ({
      ...district,
      tiles: district.tiles.map(([x, y]) => [x, y]),
    }));
  }
  const fallbackById = new Map(fallback.map((district) => [district.id, district]));
  const result: District[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const source = record(entry);
    const id = typeof own(source, "id") === "string" ? own(source, "id") as string : undefined;
    const migrated = migrateDistrict(entry, id === undefined ? undefined : fallbackById.get(id));
    if (migrated === null || seen.has(migrated.id)) continue;
    seen.add(migrated.id);
    result.push(migrated);
  }
  return result;
}

function migrateColonyThreat(
  value: unknown,
  fallback: Threat | undefined,
): Threat | null {
  const source = record(value);
  if (source === null) {
    return fallback === undefined ? null : { ...fallback, payload: cloneSerializable(fallback.payload) };
  }
  const kind = enumMatch(own(source, "kind"), COLONY_THREAT_KINDS) ?? fallback?.kind;
  const severity = enumMatch(own(source, "severity"), COLONY_THREAT_SEVERITIES)
    ?? fallback?.severity;
  if (kind === undefined || severity === undefined) return null;
  if (fallback === undefined && typeof own(source, "id") !== "string") return null;
  return {
    id: stringValue(own(source, "id"), fallback?.id ?? "threat:unknown"),
    kind,
    cyclesUntilResolve: nonnegativeSafeInteger(
      own(source, "cyclesUntilResolve"),
      fallback?.cyclesUntilResolve ?? 0,
    ),
    severity,
    targetBuildingId: nullableString(
      own(source, "targetBuildingId"),
      fallback?.targetBuildingId ?? null,
    ),
    payload: own(source, "payload") === undefined
      ? cloneSerializable(fallback?.payload ?? null)
      : cloneSerializable(own(source, "payload")),
  };
}

function migrateColonyThreats(value: unknown, fallback: readonly Threat[]): Threat[] {
  if (!Array.isArray(value)) {
    return fallback.map((entry) => ({ ...entry, payload: cloneSerializable(entry.payload) }));
  }
  const fallbackById = new Map(fallback.map((threat) => [threat.id, threat]));
  const result: Threat[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const source = record(entry);
    const id = typeof own(source, "id") === "string" ? own(source, "id") as string : undefined;
    const migrated = migrateColonyThreat(
      entry,
      id === undefined ? undefined : fallbackById.get(id),
    );
    if (migrated === null || seen.has(migrated.id)) continue;
    seen.add(migrated.id);
    result.push(migrated);
  }
  return result;
}

function migrateColony(
  value: unknown,
  fallback: ColonyState | undefined,
): ColonyState | null {
  const source = record(value);
  if (source === null) return fallback === undefined ? null : migrateColony(fallback, fallback);
  const planetId = enumMatch(own(source, "planetId"), PLANET_IDS) ?? fallback?.planetId;
  const foundingType = enumMatch(own(source, "foundingType"), FOUNDING_TYPES)
    ?? fallback?.foundingType;
  const tier = numberEnumMatch(own(source, "tier"), COLONY_TIERS) ?? fallback?.tier;
  if (planetId === undefined || foundingType === undefined || tier === undefined) return null;
  if (fallback === undefined && (
    typeof own(source, "id") !== "string" ||
    typeof own(source, "name") !== "string" ||
    typeof own(source, "regionNodeId") !== "string"
  )) return null;
  const fallbackStats = fallback?.siteStats ?? {
    oreDensity: 50,
    waterTable: 50,
    buildableSlots: 6,
    threat: 50,
  };
  const populationSource = record(own(source, "population"));
  const fallbackPopulation = fallback?.population ?? {
    total: 0,
    capacity: 0,
    namedCount: 0,
    growthRate: 0,
    recentDeaths: [],
  };
  const resourcesSource = record(own(source, "resources"));
  const fallbackResources = fallback?.resources ?? { food: 0, water: 0, metal: 0, credits: 0 };
  const foundedSource = record(own(source, "founded"));
  const fallbackFounded = fallback?.founded ?? { missionCount: 0, gameClockTick: 0 };
  const fallbackClock = fallback?.lastGameClock ?? {
    day: 0,
    hour: 7,
    minute: 0,
    realtimeMsPerGameMinute: 1000,
    season: "standard" as const,
  };
  return {
    id: stringValue(own(source, "id"), fallback?.id ?? "colony:unknown"),
    name: stringValue(own(source, "name"), fallback?.name ?? "Unknown Colony"),
    planetId,
    foundingType,
    tier,
    regionNodeId: stringValue(
      own(source, "regionNodeId"),
      fallback?.regionNodeId ?? "region:unknown",
    ),
    siteStats: migrateSiteStats(own(source, "siteStats"), fallbackStats),
    population: {
      total: nonnegativeSafeInteger(own(populationSource, "total"), fallbackPopulation.total),
      capacity: nonnegativeSafeInteger(
        own(populationSource, "capacity"),
        fallbackPopulation.capacity,
      ),
      namedCount: nonnegativeSafeInteger(
        own(populationSource, "namedCount"),
        fallbackPopulation.namedCount,
      ),
      growthRate: finiteValue(own(populationSource, "growthRate"), fallbackPopulation.growthRate),
      recentDeaths: migrateDeathRecords(
        own(populationSource, "recentDeaths"),
        fallbackPopulation.recentDeaths,
      ),
    },
    resources: {
      food: nonnegativeFinite(own(resourcesSource, "food"), fallbackResources.food),
      water: nonnegativeFinite(own(resourcesSource, "water"), fallbackResources.water),
      metal: nonnegativeFinite(own(resourcesSource, "metal"), fallbackResources.metal),
      credits: nonnegativeFinite(own(resourcesSource, "credits"), fallbackResources.credits),
    },
    buildings: migrateBuildings(own(source, "buildings"), fallback?.buildings ?? []),
    districts: migrateDistricts(own(source, "districts"), fallback?.districts ?? []),
    namedNpcs: stringArray(own(source, "namedNpcs"), fallback?.namedNpcs ?? []),
    backgroundColonistDensity: finiteInRange(
      own(source, "backgroundColonistDensity"),
      0,
      1,
      fallback?.backgroundColonistDensity ?? 0,
    ),
    happiness: finiteInRange(
      own(source, "happiness"),
      0,
      100,
      fallback?.happiness ?? 50,
    ),
    selfSufficient: booleanValue(
      own(source, "selfSufficient"),
      fallback?.selfSufficient ?? false,
    ),
    lastCycleProcessed: nonnegativeSafeInteger(
      own(source, "lastCycleProcessed"),
      fallback?.lastCycleProcessed ?? 0,
    ),
    lastGameClock: migrateGameClock(own(source, "lastGameClock"), fallbackClock),
    activeThreats: migrateColonyThreats(
      own(source, "activeThreats"),
      fallback?.activeThreats ?? [],
    ),
    activeQuestlines: stringArray(
      own(source, "activeQuestlines"),
      fallback?.activeQuestlines ?? [],
    ),
    discoveredPoiIds: stringArray(
      own(source, "discoveredPoiIds"),
      fallback?.discoveredPoiIds ?? [],
    ),
    layoutSeed: nonnegativeSafeInteger(own(source, "layoutSeed"), fallback?.layoutSeed ?? 0),
    founded: {
      missionCount: nonnegativeSafeInteger(
        own(foundedSource, "missionCount"),
        fallbackFounded.missionCount,
      ),
      gameClockTick: nonnegativeSafeInteger(
        own(foundedSource, "gameClockTick"),
        fallbackFounded.gameClockTick,
      ),
    },
  };
}

function cloneColonies(fallback: readonly ColonyState[]): ColonyState[] {
  return fallback.map((colony) => {
    const cloned = migrateColony(colony, colony);
    if (cloned === null) throw new Error("Invalid internal colony fallback");
    return cloned;
  });
}

function migrateColonies(value: unknown, fallback: readonly ColonyState[]): ColonyState[] {
  if (!Array.isArray(value)) return cloneColonies(fallback);
  const fallbackById = new Map(fallback.map((colony) => [colony.id, colony]));
  const result: ColonyState[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const source = record(entry);
    const id = typeof own(source, "id") === "string" ? own(source, "id") as string : undefined;
    const migrated = migrateColony(entry, id === undefined ? undefined : fallbackById.get(id));
    if (migrated === null || seen.has(migrated.id)) continue;
    seen.add(migrated.id);
    result.push(migrated);
  }
  return result;
}

function migrateRegionNode(
  value: unknown,
  fallback: RegionNode | undefined,
): RegionNode | null {
  const source = record(value);
  if (source === null) return fallback === undefined ? null : migrateRegionNode(fallback, fallback);
  const type = enumMatch(own(source, "type"), REGION_NODE_TYPES) ?? fallback?.type;
  const intel = enumMatch(own(source, "intel"), REGION_INTEL_STATES) ?? fallback?.intel;
  if (type === undefined || intel === undefined) return null;
  if (fallback === undefined && (
    typeof own(source, "id") !== "string" ||
    typeof own(source, "name") !== "string"
  )) return null;
  const rawSiteStats = own(source, "siteStats");
  let siteStats: SiteStats | null;
  if (rawSiteStats === null) {
    siteStats = null;
  } else if (record(rawSiteStats) !== null) {
    siteStats = migrateSiteStats(
      rawSiteStats,
      fallback?.siteStats ?? {
        oreDensity: 50,
        waterTable: 50,
        buildableSlots: 6,
        threat: 50,
      },
    );
  } else {
    siteStats = fallback?.siteStats === null || fallback?.siteStats === undefined
      ? null
      : { ...fallback.siteStats };
  }
  const coordsSource = record(own(source, "coords"));
  const fallbackCoords = fallback?.coords ?? { x: 50, y: 50 };
  const rawElevation = own(source, "elevationMetadata");
  const fallbackElevation = fallback?.elevationMetadata ?? null;
  let elevationMetadata: RegionNode["elevationMetadata"];
  if (rawElevation === null) {
    elevationMetadata = null;
  } else {
    const elevationSource = record(rawElevation);
    if (elevationSource === null) {
      elevationMetadata = fallbackElevation === null ? null : { ...fallbackElevation };
    } else if (
      fallbackElevation === null &&
      (
        typeof own(elevationSource, "authoredTemplateId") !== "string" ||
        typeof own(elevationSource, "overrideName") !== "string" ||
        typeof own(elevationSource, "questlineId") !== "string"
      )
    ) {
      elevationMetadata = null;
    } else {
      elevationMetadata = {
        authoredTemplateId: stringValue(
          own(elevationSource, "authoredTemplateId"),
          fallbackElevation?.authoredTemplateId ?? "template:unknown",
        ),
        overrideName: stringValue(
          own(elevationSource, "overrideName"),
          fallbackElevation?.overrideName ?? "Unknown",
        ),
        questlineId: stringValue(
          own(elevationSource, "questlineId"),
          fallbackElevation?.questlineId ?? "quest:unknown",
        ),
        requiredCampaignState: nullableString(
          own(elevationSource, "requiredCampaignState"),
          fallbackElevation?.requiredCampaignState ?? null,
        ),
      };
    }
  }
  const respawnValue = own(source, "respawnMissions");
  const result: RegionNode = {
    id: stringValue(own(source, "id"), fallback?.id ?? "region:unknown"),
    name: stringValue(own(source, "name"), fallback?.name ?? "Unknown Region"),
    type,
    intel,
    siteStats,
    authored: booleanValue(own(source, "authored"), fallback?.authored ?? false),
    templateId: nullableString(own(source, "templateId"), fallback?.templateId ?? null),
    seed: nonnegativeSafeInteger(own(source, "seed"), fallback?.seed ?? 0),
    respawnMissions: nullableNonnegativeSafeInteger(
      respawnValue,
      fallback?.respawnMissions ?? null,
    ),
    coords: {
      x: finiteValue(own(coordsSource, "x"), fallbackCoords.x),
      y: finiteValue(own(coordsSource, "y"), fallbackCoords.y),
    },
    elevationMetadata,
  };
  const discovered = own(source, "discovered");
  const cleared = own(source, "cleared");
  if (typeof discovered === "boolean") result.discovered = discovered;
  else if (fallback?.discovered !== undefined) result.discovered = fallback.discovered;
  if (typeof cleared === "boolean") result.cleared = cleared;
  else if (fallback?.cleared !== undefined) result.cleared = fallback.cleared;
  return result;
}

function migrateRegionNodes(
  value: unknown,
  fallback: readonly RegionNode[],
): RegionNode[] {
  if (!Array.isArray(value)) {
    return fallback.map((node) => {
      const cloned = migrateRegionNode(node, node);
      if (cloned === null) throw new Error("Invalid internal region-node fallback");
      return cloned;
    });
  }
  const fallbackById = new Map(fallback.map((node) => [node.id, node]));
  const result: RegionNode[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const source = record(entry);
    const id = typeof own(source, "id") === "string" ? own(source, "id") as string : undefined;
    const migrated = migrateRegionNode(entry, id === undefined ? undefined : fallbackById.get(id));
    if (migrated === null || seen.has(migrated.id)) continue;
    seen.add(migrated.id);
    result.push(migrated);
  }
  return result;
}

function migrateEdges(
  value: unknown,
  fallback: ReadonlyArray<readonly [string, string]>,
): Array<[string, string]> {
  if (!Array.isArray(value)) return fallback.map(([from, to]) => [from, to]);
  const result: Array<[string, string]> = [];
  const seen = new Set<string>();
  for (const edge of value) {
    if (
      !Array.isArray(edge) ||
      edge.length < 2 ||
      typeof edge[0] !== "string" ||
      typeof edge[1] !== "string"
    ) {
      continue;
    }
    const key = `${edge[0]}\u0000${edge[1]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push([edge[0], edge[1]]);
  }
  return result;
}

function migratePlanet(
  value: unknown,
  fallback: PlanetState | undefined,
): PlanetState | null {
  const source = record(value);
  if (source === null) return fallback === undefined ? null : migratePlanet(fallback, fallback);
  const id = enumMatch(own(source, "id"), PLANET_IDS) ?? fallback?.id;
  const biome = enumMatch(own(source, "biome"), PLANET_BIOMES) ?? fallback?.biome;
  if (id === undefined || biome === undefined) return null;
  const fallbackMap = fallback?.regionMap ?? { seed: 0, nodes: [], edges: [] };
  const mapSource = record(own(source, "regionMap"));
  if (fallback === undefined && mapSource === null) return null;
  return {
    id,
    regionMap: {
      seed: nonnegativeSafeInteger(own(mapSource, "seed"), fallbackMap.seed),
      nodes: migrateRegionNodes(own(mapSource, "nodes"), fallbackMap.nodes),
      edges: migrateEdges(own(mapSource, "edges"), fallbackMap.edges),
    },
    biome,
    campaignUnlocked: booleanValue(
      own(source, "campaignUnlocked"),
      fallback?.campaignUnlocked ?? false,
    ),
  };
}

function clonePlanets(fallback: readonly PlanetState[]): PlanetState[] {
  return fallback.map((planet) => {
    const cloned = migratePlanet(planet, planet);
    if (cloned === null) throw new Error("Invalid internal planet fallback");
    return cloned;
  });
}

function migratePlanets(value: unknown, fallback: readonly PlanetState[]): PlanetState[] {
  if (!Array.isArray(value)) return clonePlanets(fallback);
  const fallbackById = new Map(fallback.map((planet) => [planet.id, planet]));
  const result: PlanetState[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const source = record(entry);
    const id = enumMatch(own(source, "id"), PLANET_IDS);
    const migrated = migratePlanet(entry, id === undefined ? undefined : fallbackById.get(id));
    if (migrated === null || seen.has(migrated.id)) continue;
    seen.add(migrated.id);
    result.push(migrated);
  }
  return result;
}

function migrateFactionStanding(
  value: unknown,
  fallback: FactionStanding | undefined,
): FactionStanding | null {
  const source = record(value);
  if (source === null) {
    return fallback === undefined
      ? null
      : { ...fallback, permissions: [...fallback.permissions] };
  }
  if (fallback === undefined && (
    typeof own(source, "factionId") !== "string"
    || typeof own(source, "standing") !== "number"
    || !Number.isFinite(own(source, "standing"))
  )) return null;
  const standing = clampStanding(finiteValue(own(source, "standing"), fallback?.standing ?? 0));
  return {
    factionId: stringValue(
      own(source, "factionId"),
      fallback?.factionId ?? "faction:unknown",
    ),
    standing,
    rank: rankFromStanding(standing),
    permissions: stringArray(own(source, "permissions"), fallback?.permissions ?? []),
  };
}

function cloneFactionStandings(fallback: readonly FactionStanding[]): FactionStanding[] {
  return fallback.map((entry) => {
    const standing = clampStanding(entry.standing);
    return {
      ...entry,
      standing,
      rank: rankFromStanding(standing),
      permissions: stringArray(entry.permissions, []),
    };
  });
}

function migrateFactionStandings(
  value: unknown,
  fallback: readonly FactionStanding[],
): FactionStanding[] {
  if (!Array.isArray(value)) return cloneFactionStandings(fallback);
  const fallbackById = new Map(fallback.map((standing) => [standing.factionId, standing]));
  const result: FactionStanding[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const source = record(entry);
    const id = typeof own(source, "factionId") === "string"
      ? own(source, "factionId") as string
      : undefined;
    const migrated = migrateFactionStanding(
      entry,
      id === undefined ? undefined : fallbackById.get(id),
    );
    if (migrated === null || seen.has(migrated.factionId)) continue;
    seen.add(migrated.factionId);
    result.push(migrated);
  }
  return result;
}

export function migrateGalaxyRun(
  raw: unknown,
  fallbackIdentity: AtlasGenerationIdentity = G0_GENERATION_IDENTITY,
): GalaxyRunState {
  const source = record(raw);
  const identity = migrateIdentity(own(source, "identity"), fallbackIdentity);
  const availability = getGalaxyRunAvailability(identity);
  const fallback = availability.status === "available"
    ? createFreshGalaxyRun(identity)
    : createGenerationNeutralRecoverySkeleton(identity);
  const resourcesSource = record(own(source, "resources"));
  const codexSource = record(own(source, "codex"));
  const vesselSource = record(own(source, "vessel"));
  const rawTravel = own(source, "activeTravel");
  const vessel: GalaxyRunState["vessel"] = {
    status: enumValue(
      own(vesselSource, "status"),
      VESSEL_STATUSES,
      fallback.vessel.status,
    ),
    coordinate: migrateCoordinate(
      own(vesselSource, "coordinate"),
      fallback.vessel.coordinate,
    ),
    contactId: nullableString(
      own(vesselSource, "contactId"),
      fallback.vessel.contactId,
    ),
    transitTransactionId: nullableString(
      own(vesselSource, "transitTransactionId"),
      fallback.vessel.transitTransactionId,
    ),
  };
  const travel = reconcileTravel(
    migrateTravel(rawTravel, fallback.vessel.coordinate),
    vessel,
    travelRecoveryOrigin(rawTravel),
  );

  return {
    identity,
    worldCycle: nonnegativeSafeInteger(own(source, "worldCycle"), fallback.worldCycle),
    nextTransactionOrdinal: positiveSafeInteger(
      own(source, "nextTransactionOrdinal"),
      fallback.nextTransactionOrdinal,
    ),
    resources: {
      supply: nonnegativeSafeInteger(
        own(resourcesSource, "supply"),
        fallback.resources.supply,
      ),
      credits: nonnegativeSafeInteger(
        own(resourcesSource, "credits"),
        fallback.resources.credits,
      ),
      materials: enumArray(
        own(resourcesSource, "materials"),
        MATERIAL_IDS,
        fallback.resources.materials,
      ),
    },
    ship: migrateShip(own(source, "ship"), fallback.ship),
    pilot: migratePilot(own(source, "pilot"), fallback.pilot),
    codex: {
      unlocked: stringArray(own(codexSource, "unlocked"), fallback.codex.unlocked),
      viewed: stringArray(own(codexSource, "viewed"), fallback.codex.viewed),
    },
    storyItems: enumArray(
      own(source, "storyItems"),
      STORY_ITEM_IDS,
      fallback.storyItems,
    ),
    vessel: travel.vessel,
    atlas: migrateAtlas(own(source, "atlas"), fallback.atlas, fallback.vessel.coordinate),
    operations: migrateOperationMap(own(source, "operations"), fallback.operations),
    activeTravel: travel.activeTravel,
    colonies: migrateColonies(own(source, "colonies"), fallback.colonies),
    planets: migratePlanets(own(source, "planets"), fallback.planets),
    factionStandings: migrateFactionStandings(
      own(source, "factionStandings"),
      fallback.factionStandings,
    ),
    historyFacts: migrateHistoryFacts(own(source, "historyFacts"), fallback.historyFacts),
    appliedOutcomeIds: stringArray(
      own(source, "appliedOutcomeIds"),
      fallback.appliedOutcomeIds,
    ),
  };
}

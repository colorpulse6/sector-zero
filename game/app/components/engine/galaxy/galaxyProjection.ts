import { advanceWorldCycle } from "../../colony/shared/cycleProcessor";
import type {
  ColonyState,
  FactionStanding,
  PlanetState,
  RegionIntelState,
} from "../../colony/shared/colonyTypes";
import { rankFromStanding } from "../../colony/shared/factionLedger";
import { getNode } from "../skillTree";
import type {
  BestiaryEntry,
  EnemyType,
  SaveData,
  ShipUpgrades,
} from "../types";
import { calcPilotLevel, skillPointsAtLevel } from "../pilotLevel";
import { migrateGalaxyRun } from "./galaxyRun";
import type {
  GalaxyCodexState,
  GalaxyPilotState,
  GalaxyResources,
  GalaxyRunState,
  GalaxyShipState,
} from "./galaxyTypes";

/**
 * The only state an existing engine may return across the galaxy boundary.
 * Every nested object is a patch except the collection-valued fields, which
 * represent the complete post-operation collection unless documented below.
 */
export interface GalaxyProjectionDelta {
  colonies?: ColonyState[];
  planets?: PlanetState[];
  factionStandings?: FactionStanding[];
  pilot?: Partial<Omit<GalaxyPilotState, "bestiary">> & {
    /** Bestiary is an entry patch; omitted saved enemies remain unchanged. */
    bestiary?: Partial<Record<EnemyType, BestiaryEntry>>;
  };
  ship?: Partial<GalaxyShipState>;
  resources?: Partial<GalaxyResources>;
  codex?: Partial<GalaxyCodexState>;
  storyItems?: GalaxyRunState["storyItems"];
  /** The compatibility projection's sole cycle field. */
  missionsSinceStart?: number;
}

export type ProjectionErrorCode =
  | "missing_galaxy_run"
  | "unsafe_delta"
  | "unknown_delta_key"
  | "invalid_delta_value"
  | "regressive_delta"
  | "domain_invariant"
  | "invalid_cycle_count"
  | "cycle_advance_failed";

export interface ProjectionError {
  code: ProjectionErrorCode;
  path: string;
  message: string;
}

export type ProjectionMergeResult =
  | { ok: true; galaxyRun: GalaxyRunState }
  | { ok: false; errors: ProjectionError[] };

export type GalaxyRunCycleAdvanceResult =
  | { ok: true; galaxyRun: GalaxyRunState }
  | { ok: false; errors: ProjectionError[] };

export type GalaxySaveCycleAdvanceResult =
  | { ok: true; galaxyRun: GalaxyRunState; save: SaveData }
  | { ok: false; errors: ProjectionError[] };

const PROJECTION_CLOCK: SaveData["gameClock"] = Object.freeze({
  day: 0,
  hour: 7,
  minute: 0,
  realtimeMsPerGameMinute: 1000,
  season: "standard",
});

const TOP_LEVEL_DELTA_KEYS = new Set([
  "colonies",
  "planets",
  "factionStandings",
  "pilot",
  "ship",
  "resources",
  "codex",
  "storyItems",
  "missionsSinceStart",
]);
const PILOT_DELTA_KEYS = new Set([
  "xp",
  "level",
  "skillPoints",
  "allocatedSkills",
  "bestiary",
]);
const SHIP_DELTA_KEYS = new Set([
  "upgrades",
  "unlockedEnhancements",
  "equippedWeaponType",
  "consumableInventory",
  "equippedConsumables",
]);
const RESOURCE_DELTA_KEYS = new Set(["supply", "credits", "materials"]);
const CODEX_DELTA_KEYS = new Set(["unlocked", "viewed"]);
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

const INTEL_RANK: Readonly<Record<RegionIntelState, number>> = Object.freeze({
  unknown: 0,
  rumored: 1,
  surveyed: 2,
  cleared: 3,
  claimed: 4,
});

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function error(
  code: ProjectionErrorCode,
  path: string,
  message: string,
): ProjectionError {
  return { code, path, message };
}

function failed(problem: ProjectionError): ProjectionMergeResult {
  return { ok: false, errors: [problem] };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function isCanonicalSave(value: SaveData | GalaxyRunState): value is SaveData {
  return hasOwn(value, "galaxyRun") && hasOwn(value, "activeExperience");
}

function projectionFromRun(run: GalaxyRunState): SaveData {
  return {
    currentWorld: 1,
    levels: {},
    credits: run.resources.credits,
    totalStars: 0,
    totalScore: 0,
    xp: run.pilot.xp,
    introSeen: undefined,
    upgrades: clone(run.ship.upgrades),
    unlockedCodex: clone(run.codex.unlocked),
    viewedCodex: clone(run.codex.viewed),
    viewedConversations: [],
    completedQuests: [],
    activeQuests: [],
    completedPlanets: [],
    unlockedSpecialMissions: [],
    completedSpecialMissions: [],
    storyItems: clone(run.storyItems),
    materials: clone(run.resources.materials),
    consumableInventory: clone(run.ship.consumableInventory),
    equippedConsumables: clone(run.ship.equippedConsumables),
    unlockedEnhancements: clone(run.ship.unlockedEnhancements),
    bestiary: clone(run.pilot.bestiary),
    equippedWeaponType: run.ship.equippedWeaponType,
    pilotLevel: run.pilot.level,
    skillPoints: run.pilot.skillPoints,
    allocatedSkills: clone(run.pilot.allocatedSkills),
    colonies: clone(run.colonies),
    planets: clone(run.planets),
    earthShipments: [],
    factionStandings: clone(run.factionStandings),
    bounties: [],
    missionsSinceStart: run.worldCycle,
    gameClock: clone(PROJECTION_CLOCK),
    activeExperience: "legacy",
    galaxyRun: null,
  };
}

/**
 * Build a disposable existing-engine view from the canonical galaxy namespace.
 * No preserved top-level legacy field is read, and callers must never persist
 * this deliberately non-recursive object.
 */
export function projectGalaxyRunToLegacySave(parent: SaveData): SaveData {
  if (parent.galaxyRun === null) {
    throw new Error("Cannot project legacy engine state without a galaxy run");
  }
  return projectionFromRun(parent.galaxyRun);
}

function inspectPlainData(
  value: unknown,
  path: string,
  ancestors = new WeakSet<object>(),
): ProjectionError | null {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? null
      : error("unsafe_delta", path, "Delta numbers must be finite.");
  }
  if (typeof value !== "object") {
    return error(
      "unsafe_delta",
      path,
      "Delta values must be plain serializable data.",
    );
  }
  if (ancestors.has(value)) {
    return error("unsafe_delta", path, "Delta values cannot contain cycles.");
  }

  const prototype = Object.getPrototypeOf(value);
  if (Array.isArray(value)) {
    if (prototype !== Array.prototype) {
      return error("unsafe_delta", path, "Delta arrays cannot have custom prototypes.");
    }
    const keys = Reflect.ownKeys(value);
    for (const key of keys) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key)) {
        return error("unsafe_delta", `${path}.${String(key)}`, "Delta arrays cannot have custom keys.");
      }
    }
    ancestors.add(value);
    for (let index = 0; index < value.length; index += 1) {
      if (!hasOwn(value, index)) {
        ancestors.delete(value);
        return error("unsafe_delta", `${path}[${index}]`, "Sparse delta arrays are not accepted.");
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !("value" in descriptor)) {
        ancestors.delete(value);
        return error("unsafe_delta", `${path}[${index}]`, "Delta accessors are not accepted.");
      }
      const problem = inspectPlainData(descriptor.value, `${path}[${index}]`, ancestors);
      if (problem !== null) {
        ancestors.delete(value);
        return problem;
      }
    }
    ancestors.delete(value);
    return null;
  }

  if (prototype !== Object.prototype && prototype !== null) {
    return error("unsafe_delta", path, "Delta objects cannot have inherited custom properties.");
  }
  ancestors.add(value);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") {
      ancestors.delete(value);
      return error("unsafe_delta", path, "Symbol delta keys are not accepted.");
    }
    if (DANGEROUS_KEYS.has(key)) {
      ancestors.delete(value);
      return error("unsafe_delta", `${path}.${key}`, "Prototype delta keys are not accepted.");
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor)) {
      ancestors.delete(value);
      return error("unsafe_delta", `${path}.${key}`, "Delta accessors are not accepted.");
    }
    const problem = inspectPlainData(descriptor.value, `${path}.${key}`, ancestors);
    if (problem !== null) {
      ancestors.delete(value);
      return problem;
    }
  }
  ancestors.delete(value);
  return null;
}

function unknownKey(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: string,
): ProjectionError | null {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      return error(
        "unknown_delta_key",
        `${path}.${key}`,
        `Unknown projection delta key: ${key}.`,
      );
    }
  }
  return null;
}

function nestedRecord(
  value: unknown,
  allowed: ReadonlySet<string>,
  path: string,
): ProjectionError | null {
  if (!isRecord(value)) {
    return error("invalid_delta_value", path, "Delta section must be an object.");
  }
  return unknownKey(value, allowed, path);
}

function validateDeltaShape(delta: unknown): ProjectionError | null {
  const plainProblem = inspectPlainData(delta, "delta");
  if (plainProblem !== null) return plainProblem;
  if (!isRecord(delta)) {
    return error("invalid_delta_value", "delta", "Projection delta must be an object.");
  }
  const topProblem = unknownKey(delta, TOP_LEVEL_DELTA_KEYS, "delta");
  if (topProblem !== null) return topProblem;
  if (hasOwn(delta, "pilot")) {
    const problem = nestedRecord(delta.pilot, PILOT_DELTA_KEYS, "delta.pilot");
    if (problem !== null) return problem;
    const pilot = delta.pilot as Record<string, unknown>;
    if (hasOwn(pilot, "bestiary") && !isRecord(pilot.bestiary)) {
      return error(
        "invalid_delta_value",
        "delta.pilot.bestiary",
        "Bestiary delta must be an entry object.",
      );
    }
  }
  if (hasOwn(delta, "ship")) {
    const problem = nestedRecord(delta.ship, SHIP_DELTA_KEYS, "delta.ship");
    if (problem !== null) return problem;
  }
  if (hasOwn(delta, "resources")) {
    const problem = nestedRecord(delta.resources, RESOURCE_DELTA_KEYS, "delta.resources");
    if (problem !== null) return problem;
  }
  if (hasOwn(delta, "codex")) {
    const problem = nestedRecord(delta.codex, CODEX_DELTA_KEYS, "delta.codex");
    if (problem !== null) return problem;
  }
  return null;
}

function mergeBestiary(
  current: GalaxyPilotState["bestiary"],
  patch: unknown,
): GalaxyPilotState["bestiary"] {
  const merged = clone(current);
  for (const key of Object.keys(patch as Record<string, unknown>)) {
    Object.defineProperty(merged, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: clone((patch as Record<string, BestiaryEntry>)[key]),
    });
  }
  return merged;
}

function applyDelta(
  run: GalaxyRunState,
  rawDelta: Record<string, unknown>,
): GalaxyRunState {
  const candidate = clone(run);
  if (hasOwn(rawDelta, "colonies")) {
    candidate.colonies = clone(rawDelta.colonies as ColonyState[]);
  }
  if (hasOwn(rawDelta, "planets")) {
    candidate.planets = clone(rawDelta.planets as PlanetState[]);
  }
  if (hasOwn(rawDelta, "factionStandings")) {
    candidate.factionStandings = clone(rawDelta.factionStandings as FactionStanding[]);
  }
  if (hasOwn(rawDelta, "pilot")) {
    const patch = rawDelta.pilot as Record<string, unknown>;
    if (hasOwn(patch, "xp")) candidate.pilot.xp = patch.xp as number;
    if (hasOwn(patch, "level")) candidate.pilot.level = patch.level as number;
    if (hasOwn(patch, "skillPoints")) {
      candidate.pilot.skillPoints = patch.skillPoints as number;
    }
    if (hasOwn(patch, "allocatedSkills")) {
      candidate.pilot.allocatedSkills = clone(
        patch.allocatedSkills as GalaxyPilotState["allocatedSkills"],
      );
    }
    if (hasOwn(patch, "bestiary")) {
      candidate.pilot.bestiary = mergeBestiary(candidate.pilot.bestiary, patch.bestiary);
    }
  }
  if (hasOwn(rawDelta, "ship")) {
    const patch = rawDelta.ship as Record<string, unknown>;
    if (hasOwn(patch, "upgrades")) {
      candidate.ship.upgrades = clone(patch.upgrades as ShipUpgrades);
    }
    if (hasOwn(patch, "unlockedEnhancements")) {
      candidate.ship.unlockedEnhancements = clone(
        patch.unlockedEnhancements as GalaxyShipState["unlockedEnhancements"],
      );
    }
    if (hasOwn(patch, "equippedWeaponType")) {
      candidate.ship.equippedWeaponType = patch.equippedWeaponType as GalaxyShipState["equippedWeaponType"];
    }
    if (hasOwn(patch, "consumableInventory")) {
      candidate.ship.consumableInventory = clone(
        patch.consumableInventory as GalaxyShipState["consumableInventory"],
      );
    }
    if (hasOwn(patch, "equippedConsumables")) {
      candidate.ship.equippedConsumables = clone(
        patch.equippedConsumables as GalaxyShipState["equippedConsumables"],
      );
    }
  }
  if (hasOwn(rawDelta, "resources")) {
    const patch = rawDelta.resources as Record<string, unknown>;
    if (hasOwn(patch, "supply")) candidate.resources.supply = patch.supply as number;
    if (hasOwn(patch, "credits")) candidate.resources.credits = patch.credits as number;
    if (hasOwn(patch, "materials")) {
      candidate.resources.materials = clone(
        patch.materials as GalaxyResources["materials"],
      );
    }
  }
  if (hasOwn(rawDelta, "codex")) {
    const patch = rawDelta.codex as Record<string, unknown>;
    if (hasOwn(patch, "unlocked")) {
      candidate.codex.unlocked = clone(patch.unlocked as string[]);
    }
    if (hasOwn(patch, "viewed")) {
      candidate.codex.viewed = clone(patch.viewed as string[]);
    }
  }
  if (hasOwn(rawDelta, "storyItems")) {
    candidate.storyItems = clone(rawDelta.storyItems as GalaxyRunState["storyItems"]);
  }
  if (hasOwn(rawDelta, "missionsSinceStart")) {
    candidate.worldCycle = rawDelta.missionsSinceStart as number;
  }
  return candidate;
}

function sameData(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) {
    return false;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((entry, index) => sameData(entry, right[index]));
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every(
    (key, index) =>
      key === rightKeys[index] &&
      hasOwn(rightRecord, key) &&
      sameData(leftRecord[key], rightRecord[key]),
  );
}

function isUnique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function containsAll(next: readonly string[], current: readonly string[]): boolean {
  const nextSet = new Set(next);
  return current.every((entry) => nextSet.has(entry));
}

function immutableColonyFieldsMatch(current: ColonyState, next: ColonyState): boolean {
  return (
    current.id === next.id &&
    current.planetId === next.planetId &&
    current.foundingType === next.foundingType &&
    current.regionNodeId === next.regionNodeId &&
    current.layoutSeed === next.layoutSeed &&
    sameData(current.siteStats, next.siteStats) &&
    sameData(current.founded, next.founded)
  );
}

function immutablePlanetFieldsMatch(current: PlanetState, next: PlanetState): boolean {
  if (
    current.id !== next.id ||
    current.biome !== next.biome ||
    current.regionMap.seed !== next.regionMap.seed ||
    !sameData(current.regionMap.edges, next.regionMap.edges) ||
    (current.campaignUnlocked && !next.campaignUnlocked)
  ) {
    return false;
  }
  const nextNodes = new Map(next.regionMap.nodes.map((node) => [node.id, node]));
  for (const currentNode of current.regionMap.nodes) {
    const nextNode = nextNodes.get(currentNode.id);
    if (nextNode === undefined) return false;
    if (
      currentNode.type !== nextNode.type ||
      currentNode.authored !== nextNode.authored ||
      currentNode.templateId !== nextNode.templateId ||
      currentNode.seed !== nextNode.seed ||
      !sameData(currentNode.siteStats, nextNode.siteStats) ||
      !sameData(currentNode.coords, nextNode.coords) ||
      !sameData(currentNode.elevationMetadata, nextNode.elevationMetadata) ||
      INTEL_RANK[nextNode.intel] < INTEL_RANK[currentNode.intel]
    ) {
      return false;
    }
  }
  return true;
}

function validateMonotonicState(
  current: GalaxyRunState,
  next: GalaxyRunState,
  delta: Record<string, unknown>,
): ProjectionError | null {
  if (next.worldCycle < current.worldCycle) {
    return error("regressive_delta", "delta.missionsSinceStart", "Galaxy world cycle cannot decrease.");
  }
  if (next.pilot.xp < current.pilot.xp) {
    return error("regressive_delta", "delta.pilot.xp", "Pilot XP cannot decrease.");
  }
  if (next.pilot.level < current.pilot.level) {
    return error("regressive_delta", "delta.pilot.level", "Pilot level cannot decrease.");
  }
  if (!containsAll(next.pilot.allocatedSkills, current.pilot.allocatedSkills)) {
    return error("regressive_delta", "delta.pilot.allocatedSkills", "Allocated skills cannot be removed.");
  }
  if (!isUnique(next.pilot.allocatedSkills)) {
    return error("domain_invariant", "delta.pilot.allocatedSkills", "Allocated skills must be unique.");
  }
  const allocated = new Set(next.pilot.allocatedSkills);
  let spentSkillPoints = 0;
  for (const skillId of next.pilot.allocatedSkills) {
    const node = getNode(skillId);
    if (node === undefined || !node.prerequisites.every((id) => allocated.has(id))) {
      return error("domain_invariant", "delta.pilot.allocatedSkills", `Skill prerequisites are not satisfied for ${skillId}.`);
    }
    spentSkillPoints += node.cost;
  }
  const pilotDelta = hasOwn(delta, "pilot")
    ? delta.pilot as Record<string, unknown>
    : null;
  if (
    pilotDelta !== null &&
    ["xp", "level", "skillPoints", "allocatedSkills"].some((key) => hasOwn(pilotDelta, key)) &&
    (
      next.pilot.level !== calcPilotLevel(next.pilot.xp) ||
      next.pilot.skillPoints !== Math.max(
        0,
        skillPointsAtLevel(next.pilot.level) - spentSkillPoints,
      )
    )
  ) {
    return error(
      "domain_invariant",
      "delta.pilot",
      "Pilot level and available skill points must match XP and allocated skill costs.",
    );
  }

  for (const [key, nextEntry] of Object.entries(next.pilot.bestiary)) {
    if (nextEntry === undefined) continue;
    if (nextEntry.enemyType !== key) {
      return error("domain_invariant", `delta.pilot.bestiary.${key}`, "Bestiary key must match enemy type.");
    }
    const currentEntry = current.pilot.bestiary[key as EnemyType];
    if (currentEntry === undefined) continue;
    if (
      nextEntry.killCount < currentEntry.killCount ||
      nextEntry.enemyType !== currentEntry.enemyType ||
      nextEntry.classId !== currentEntry.classId ||
      (currentEntry.firstSeenPlanet !== undefined && nextEntry.firstSeenPlanet !== currentEntry.firstSeenPlanet) ||
      (currentEntry.firstSeenWorld !== undefined && nextEntry.firstSeenWorld !== currentEntry.firstSeenWorld)
    ) {
      return error("regressive_delta", `delta.pilot.bestiary.${key}`, "Bestiary history cannot be removed, decremented, or rewritten.");
    }
  }

  const upgradeKeys: Array<keyof ShipUpgrades> = [
    "hullPlating",
    "engineBoost",
    "weaponCore",
    "munitionsBay",
    "fireControl",
    "shieldGenerator",
  ];
  for (const key of upgradeKeys) {
    if (next.ship.upgrades[key] < current.ship.upgrades[key]) {
      return error("regressive_delta", `delta.ship.upgrades.${key}`, "Ship upgrades cannot decrease.");
    }
  }
  if (!containsAll(next.ship.unlockedEnhancements, current.ship.unlockedEnhancements)) {
    return error("regressive_delta", "delta.ship.unlockedEnhancements", "Unlocked enhancements cannot be removed.");
  }
  if (
    !isUnique(next.ship.unlockedEnhancements) ||
    !isUnique(next.ship.equippedConsumables) ||
    !isUnique(next.resources.materials) ||
    !isUnique(next.codex.unlocked) ||
    !isUnique(next.codex.viewed) ||
    !isUnique(next.storyItems)
  ) {
    return error("domain_invariant", "delta", "Galaxy collection entries must be unique.");
  }
  if (!containsAll(next.codex.unlocked, current.codex.unlocked)) {
    return error("regressive_delta", "delta.codex.unlocked", "Unlocked Codex entries cannot be removed.");
  }
  if (!containsAll(next.codex.viewed, current.codex.viewed)) {
    return error("regressive_delta", "delta.codex.viewed", "Viewed Codex entries cannot be removed.");
  }
  if (!next.codex.viewed.every((entry) => next.codex.unlocked.includes(entry))) {
    return error("domain_invariant", "delta.codex.viewed", "Viewed Codex entries must also be unlocked.");
  }
  if (!containsAll(next.storyItems, current.storyItems)) {
    return error("regressive_delta", "delta.storyItems", "Story items cannot be removed.");
  }

  const nextColonies = new Map(next.colonies.map((colony) => [colony.id, colony]));
  for (const colony of current.colonies) {
    const nextColony = nextColonies.get(colony.id);
    if (nextColony === undefined) {
      return error("regressive_delta", "delta.colonies", `Colony ${colony.id} cannot be removed.`);
    }
    if (!immutableColonyFieldsMatch(colony, nextColony)) {
      return error("domain_invariant", `delta.colonies.${colony.id}`, "Immutable colony identity or founding fields were rewritten.");
    }
  }

  const nextPlanets = new Map(next.planets.map((planet) => [planet.id, planet]));
  for (const planet of current.planets) {
    const nextPlanet = nextPlanets.get(planet.id);
    if (nextPlanet === undefined) {
      return error("regressive_delta", "delta.planets", `Planet ${planet.id} cannot be removed.`);
    }
    if (!immutablePlanetFieldsMatch(planet, nextPlanet)) {
      return error("domain_invariant", `delta.planets.${planet.id}`, "Planet identity, map topology, or intel progression was rewritten.");
    }
  }

  const nextFactions = new Map(next.factionStandings.map((entry) => [entry.factionId, entry]));
  for (const faction of current.factionStandings) {
    const nextFaction = nextFactions.get(faction.factionId);
    if (nextFaction === undefined) {
      return error("regressive_delta", "delta.factionStandings", `Faction ${faction.factionId} cannot be removed.`);
    }
    if (!containsAll(nextFaction.permissions, faction.permissions)) {
      return error("regressive_delta", `delta.factionStandings.${faction.factionId}.permissions`, "Faction permissions cannot be removed.");
    }
  }
  for (const faction of next.factionStandings) {
    if (faction.rank !== rankFromStanding(faction.standing)) {
      return error("domain_invariant", `delta.factionStandings.${faction.factionId}.rank`, "Faction rank must match standing.");
    }
  }

  if (hasOwn(delta, "colonies") || hasOwn(delta, "missionsSinceStart")) {
    for (const colony of next.colonies) {
      if (colony.lastCycleProcessed !== next.worldCycle) {
        return error("domain_invariant", `delta.colonies.${colony.id}.lastCycleProcessed`, "Every projected colony must be current at the galaxy world cycle.");
      }
    }
  }
  return null;
}

/**
 * Validate and merge only explicitly authorized compatibility output. Invalid
 * data returns an error and leaves both the run and delta untouched.
 */
export function mergeProjectionIntoGalaxy(
  run: GalaxyRunState,
  delta: GalaxyProjectionDelta,
): ProjectionMergeResult {
  const shapeProblem = validateDeltaShape(delta);
  if (shapeProblem !== null) return failed(shapeProblem);
  const rawDelta = delta as Record<string, unknown>;
  let candidate: GalaxyRunState;
  let normalized: GalaxyRunState;
  try {
    candidate = applyDelta(run, rawDelta);
    normalized = migrateGalaxyRun(candidate, candidate.identity);
  } catch (cause) {
    return failed(error(
      "invalid_delta_value",
      "delta",
      cause instanceof Error ? cause.message : "Projection delta could not be applied.",
    ));
  }
  if (!sameData(candidate, normalized)) {
    return failed(error(
      "invalid_delta_value",
      "delta",
      "Projection delta does not round-trip through the saved galaxy domain.",
    ));
  }
  const monotonicProblem = validateMonotonicState(run, candidate, rawDelta);
  if (monotonicProblem !== null) return failed(monotonicProblem);
  return { ok: true, galaxyRun: candidate };
}

export function advanceGalaxyWorldCycles(
  parent: SaveData,
  cycles: number,
): GalaxySaveCycleAdvanceResult;
export function advanceGalaxyWorldCycles(
  run: GalaxyRunState,
  cycles: number,
): GalaxyRunCycleAdvanceResult;
export function advanceGalaxyWorldCycles(
  input: SaveData | GalaxyRunState,
  cycles: number,
): GalaxySaveCycleAdvanceResult | GalaxyRunCycleAdvanceResult {
  if (!Number.isSafeInteger(cycles) || cycles < 0) {
    return {
      ok: false,
      errors: [error(
        "invalid_cycle_count",
        "cycles",
        "Galaxy cycle count must be a nonnegative safe integer.",
      )],
    };
  }

  const parent = isCanonicalSave(input) ? input : null;
  const startingRun: GalaxyRunState | null = parent === null
    ? input as GalaxyRunState
    : parent.galaxyRun;
  if (startingRun === null) {
    return {
      ok: false,
      errors: [error(
        "missing_galaxy_run",
        "save.galaxyRun",
        "Cannot advance galaxy cycles without a galaxy run.",
      )],
    };
  }
  if (cycles === 0) {
    return parent === null
      ? { ok: true, galaxyRun: startingRun }
      : { ok: true, galaxyRun: startingRun, save: parent };
  }

  let current = startingRun;
  try {
    for (let index = 0; index < cycles; index += 1) {
      const projection = projectionFromRun(current);
      const advanced = advanceWorldCycle(projection);
      const merged = mergeProjectionIntoGalaxy(current, {
        colonies: advanced.colonies,
        missionsSinceStart: advanced.missionsSinceStart,
      });
      if (!merged.ok) return merged;
      current = merged.galaxyRun;
    }
  } catch (cause) {
    return {
      ok: false,
      errors: [error(
        "cycle_advance_failed",
        "cycles",
        cause instanceof Error ? cause.message : "Galaxy cycle advancement failed.",
      )],
    };
  }

  if (parent === null) return { ok: true, galaxyRun: current };
  return {
    ok: true,
    galaxyRun: current,
    save: { ...parent, galaxyRun: current },
  };
}

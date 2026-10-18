import type { CanonicalSaveStore } from "../missionOutcome";
import type { BuildingType, ColonyBuilding, ColonyResources, ColonyState } from "../../colony/shared/colonyTypes";
import { BUILD_SPECS } from "../../colony/shared/colonyCatalog";
import { colonyReducer } from "../../colony/shared/colonyReducer";
import { Events } from "../../colony/shared/colonyEvents";
import { genBuildingId } from "../../colony/meta/buildingIdGen";
import type { SaveData } from "../types";
import { galaxyColonyAccess, samePlainData, type GalaxyColonyAccess } from "./galaxyColony";
import { mergeProjectionIntoGalaxy, projectGalaxyRunToLegacyState } from "./galaxyProjection";
import { settlementCommissionBlock } from "./galaxySettlement";
import type { GalaxyRunState } from "./galaxyTypes";

/**
 * Building types a galaxy colony may commission, in settlement-path order: power, metal,
 * housing, food, water (settlement-loop spec §1). No cantina or marketplace.
 */
export const GALAXY_COMMISSION_TYPES: readonly BuildingType[] = Object.freeze([
  "solar_array", "mine", "habitat_module", "farm", "water_purifier",
]);

const RESOURCE_KEYS = ["food", "water", "metal", "credits"] as const;
const QUOTE_KEYS = [
  "colonyId", "buildingType", "buildingId", "cost", "cyclesToBuild", "worldCycle", "buildingCount", "resources",
] as const;

/** What the player saw when they chose to build. Commit re-derives it; any difference is stale. */
export interface GalaxyCommissionQuote {
  colonyId: string;
  buildingType: BuildingType;
  buildingId: string;
  cost: Partial<ColonyResources>;
  cyclesToBuild: number;
  worldCycle: number;
  buildingCount: number;
  resources: ColonyResources;
}

export type GalaxyCommissionRefusal =
  | "no_galaxy_run"
  | "run_unreadable"
  | "access_unavailable"
  | "unsupported_building"
  | "no_buildable_slot"
  | "insufficient_power"
  | "insufficient_resources"
  | "mine_first"
  | "malformed_command"
  | "stale_command"
  | "unauthorized_change"
  | "merge_failed";

type Refusal = { ok: false; reason: GalaxyCommissionRefusal; message: string };
export type GalaxyCommissionQuoteResult = { ok: true; quote: GalaxyCommissionQuote } | Refusal;
export type GalaxyCommissionResult = { ok: true; save: SaveData; buildingId: string } | Refusal;

function refuse(reason: GalaxyCommissionRefusal, message: string): Refusal {
  return { ok: false, reason, message };
}

/** Management uses the descent rule (GC1); only the refusal wording changes. */
export function galaxyColonyManagementAccess(run: GalaxyRunState | null, colonyId: string | null): GalaxyColonyAccess {
  const access = galaxyColonyAccess(run, colonyId);
  return access.status === "unavailable"
    ? { status: "unavailable", reason: access.reason.replace(" TO DESCEND", " TO MANAGE") }
    : access;
}

function readRun(save: SaveData): { ok: true; parent: SaveData; run: GalaxyRunState } | Refusal {
  if (save.activeExperience !== "galaxy" || save.galaxyRun === null) {
    return refuse("no_galaxy_run", "NO ACTIVE GALAXY RUN");
  }
  const validated = mergeProjectionIntoGalaxy(save.galaxyRun, {});
  if (!validated.ok) return refuse("run_unreadable", "GALAXY RUN COULD NOT BE READ");
  return { ok: true, parent: { ...save, galaxyRun: validated.galaxyRun }, run: validated.galaxyRun };
}

function quoteFromRun(run: GalaxyRunState, colonyId: string, buildingType: BuildingType): GalaxyCommissionQuoteResult {
  const access = galaxyColonyManagementAccess(run, colonyId);
  if (access.status === "unavailable") return refuse("access_unavailable", access.reason);
  const colony = run.colonies.find(entry => entry.id === colonyId);
  if (colony === undefined) return refuse("access_unavailable", "NO COLONY HERE");
  const spec = GALAXY_COMMISSION_TYPES.includes(buildingType) ? BUILD_SPECS[buildingType] : undefined;
  if (spec === undefined) return refuse("unsupported_building", "NOT AVAILABLE IN THIS RUN YET");
  const block = settlementCommissionBlock(colony, buildingType);
  if (block !== null) return refuse(block.reason, block.message);
  return {
    ok: true,
    quote: {
      colonyId,
      buildingType,
      buildingId: genBuildingId(colony, buildingType),
      cost: { ...spec.cost },
      cyclesToBuild: spec.cyclesToBuild,
      worldCycle: run.worldCycle,
      buildingCount: colony.buildings.length,
      resources: { ...colony.resources },
    },
  };
}

/** Quote a commission from the current canonical save. Never trusts UI-supplied cost or time. */
export function quoteGalaxyColonyCommission(
  save: SaveData,
  colonyId: string,
  buildingType: BuildingType,
): GalaxyCommissionQuoteResult {
  try {
    const read = readRun(save);
    return read.ok ? quoteFromRun(read.run, colonyId, buildingType) : read;
  } catch {
    return refuse("run_unreadable", "GALAXY RUN COULD NOT BE READ");
  }
}

function plainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const own = Reflect.ownKeys(value);
  return own.length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
}

function count(value: unknown): boolean {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function amount(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** Copy a submitted quote as plain data, or null when its shape is wrong. */
function snapshotQuote(value: unknown): GalaxyCommissionQuote | null {
  if (!plainRecord(value) || !exactKeys(value, QUOTE_KEYS)) return null;
  const { colonyId, buildingType, buildingId, cost, cyclesToBuild, worldCycle, buildingCount, resources } = value;
  if (typeof colonyId !== "string" || typeof buildingType !== "string" || typeof buildingId !== "string") return null;
  if (!count(cyclesToBuild) || !count(worldCycle) || !count(buildingCount)) return null;
  if (!plainRecord(cost) || !plainRecord(resources) || !exactKeys(resources, RESOURCE_KEYS)) return null;
  const costKeys = Reflect.ownKeys(cost);
  if (!costKeys.every(key => typeof key === "string" &&
    (RESOURCE_KEYS as readonly string[]).includes(key) && amount(cost[key]))) return null;
  if (!RESOURCE_KEYS.every(key => amount(resources[key]))) return null;
  return structuredClone({
    colonyId, buildingType, buildingId, cost, cyclesToBuild, worldCycle, buildingCount, resources,
  }) as unknown as GalaxyCommissionQuote;
}

/**
 * True when `after` differs from `before` only by the quoted commission: the target colony
 * gains exactly the quoted building and loses exactly the quoted cost; nothing else moves.
 */
export function isExactCommissionChange(
  before: readonly ColonyState[],
  after: readonly ColonyState[],
  quote: GalaxyCommissionQuote,
): boolean {
  if (before.length !== after.length) return false;
  return before.every((colony, index) => {
    const next = after[index];
    if (next === undefined || next.id !== colony.id) return false;
    if (colony.id !== quote.colonyId) return samePlainData(colony, next);
    const { resources: oldResources, buildings: oldBuildings, ...oldRest } = colony;
    const { resources: newResources, buildings: newBuildings, ...newRest } = next;
    if (!samePlainData(oldRest, newRest)) return false;
    if (newBuildings.length !== oldBuildings.length + 1 ||
      !samePlainData(newBuildings.slice(0, oldBuildings.length), oldBuildings)) return false;
    const expected: ColonyBuilding = {
      id: quote.buildingId, type: quote.buildingType, tier: 1, status: "constructing",
      buildProgressCycles: quote.cyclesToBuild, hp: 100, maxHp: 100,
      interiorTemplateId: null, assignedNpcIds: [], districtId: null,
    };
    if (!samePlainData(newBuildings[oldBuildings.length], expected)) return false;
    return RESOURCE_KEYS.every(key => newResources[key] === oldResources[key] - (quote.cost[key] ?? 0));
  });
}

/**
 * Commission a building in a galaxy colony. Re-derives the quote from the current canonical
 * save; a different quote is stale. Writes only `galaxyRun.colonies`.
 */
export function commitGalaxyColonyCommission(save: SaveData, submitted: GalaxyCommissionQuote): GalaxyCommissionResult {
  try {
    const quote = snapshotQuote(submitted);
    if (quote === null) return refuse("malformed_command", "COMMAND REJECTED");
    const read = readRun(save);
    if (!read.ok) return read;
    // A screen drawn from an older colony is stale before any rule runs: the player chose
    // against different numbers.
    const current = read.run.colonies.find(entry => entry.id === quote.colonyId);
    if (current !== undefined && (read.run.worldCycle !== quote.worldCycle ||
      current.buildings.length !== quote.buildingCount || !samePlainData(current.resources, quote.resources))) {
      return refuse("stale_command", "COLONY CHANGED · REVIEW AND TRY AGAIN");
    }
    const authoritative = quoteFromRun(read.run, quote.colonyId, quote.buildingType);
    if (!authoritative.ok) return authoritative;
    if (!samePlainData(authoritative.quote, quote)) {
      return refuse("stale_command", "COLONY CHANGED · REVIEW AND TRY AGAIN");
    }
    const before = projectGalaxyRunToLegacyState(read.run);
    const after = colonyReducer(before, Events.buildingCommissioned({
      colonyId: quote.colonyId,
      buildingId: quote.buildingId,
      buildingType: quote.buildingType,
      costDeducted: { ...quote.cost },
      cyclesToBuild: quote.cyclesToBuild,
    }));
    if (!isExactCommissionChange(before.colonies, after.colonies, quote)) {
      return refuse("unauthorized_change", "COLONY RECORD REJECTED THE CHANGE");
    }
    const merged = mergeProjectionIntoGalaxy(read.run, { colonies: after.colonies });
    if (!merged.ok) return refuse("merge_failed", "COLONY RECORD REJECTED THE CHANGE");
    return { ok: true, save: { ...read.parent, galaxyRun: merged.galaxyRun }, buildingId: quote.buildingId };
  } catch {
    return refuse("run_unreadable", "GALAXY RUN COULD NOT BE READ");
  }
}

/** Refusals that come from a readable galaxy save; only these may reconcile the UI. */
const RECONCILABLE: ReadonlySet<GalaxyCommissionRefusal> = new Set([
  "stale_command", "insufficient_resources", "no_buildable_slot", "access_unavailable", "unsupported_building",
  "insufficient_power", "mine_first",
]);

export type GalaxyCommissionStoreResult =
  | { ok: true; save: SaveData; buildingId: string }
  | {
      ok: false;
      reason: GalaxyCommissionRefusal | "storage_unreadable" | "write_failed";
      message: string;
      /** A readable stored galaxy save to adopt so the screen shows current state; null = adopt nothing. */
      reconcile: SaveData | null;
    };

/**
 * GC2-A persistence boundary. The stored save, not the session copy, is the authority: read it,
 * commit against that fresh parent, write, and let the caller adopt only after the write.
 * Read and write run in one synchronous call like the other canonical writers; no cross-tab
 * atomicity is claimed.
 */
export function commitGalaxyColonyCommissionToStore(
  store: CanonicalSaveStore,
  quote: GalaxyCommissionQuote,
): GalaxyCommissionStoreResult {
  let stored: SaveData;
  try { stored = store.read(); }
  catch {
    return { ok: false, reason: "storage_unreadable", message: "SAVE COULD NOT BE READ · NOTHING CHANGED", reconcile: null };
  }
  const result = commitGalaxyColonyCommission(stored, quote);
  if (!result.ok) return { ...result, reconcile: RECONCILABLE.has(result.reason) ? stored : null };
  try { store.write(result.save); }
  catch {
    return { ok: false, reason: "write_failed", message: "MANAGEMENT SAVE FAILED · NOTHING CHANGED", reconcile: null };
  }
  return result;
}

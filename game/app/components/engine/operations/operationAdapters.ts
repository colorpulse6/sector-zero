import {
  createGameState,
  createPlanetGameState,
  createSpecialMissionGameState,
} from "../gameEngine";
import { dispatchPoi, startRegionExpedition } from "../../colony/region/poiDispatcher";
import type {
  ActivePoiDescriptor,
  PendingPoiResolution,
} from "../../colony/region/poiRuntime";
import {
  preparePoiCompletion,
  resolvePoiCompletion,
} from "../../colony/region/poiRuntime";
import { POI_CARGO } from "../../colony/region/poiOutcomes";
import {
  foundOutpost,
  type RegionActionBlockReason,
} from "../../colony/region/siteEconomy";
import type {
  PoiSession,
  RegionExpeditionRequest,
} from "../../colony/region/poiDispatcher";
import type {
  ColonyId,
  ColonyState,
  RegionNodeId,
} from "../../colony/shared/colonyTypes";
import type { MissionDelivery } from "../../colony/shared/missionDelivery";
import {
  mergeProjectionIntoGalaxy,
  projectGalaxyRunToLegacySave,
  type GalaxyProjectionDelta,
} from "../galaxy/galaxyProjection";
import { getGalaxyRunAvailability } from "../galaxy/galaxyRun";
import type { GalaxyRunState } from "../galaxy/galaxyTypes";
import type {
  EnhancementId,
  GameScreen,
  SaveData,
  ShipUpgrades,
  SkillNodeId,
} from "../types";
import {
  authorizeOperationLaunch,
  sameOperationLaunchContext,
  snapshotOperationLaunchContext,
} from "./operationCatalog";
import type {
  OperationAvailability,
  OperationLaunchContext,
  OperationLaunchResult,
  OperationUnavailableReason,
} from "./operationTypes";

function unavailable(reason: OperationUnavailableReason): Extract<OperationAvailability, { status: "unavailable" }> {
  return { status: "unavailable", recoverable: true, reasons: [reason] };
}

interface EngineProjectionInput {
  upgrades: ShipUpgrades;
  enhancements: EnhancementId[];
  pilotLevel: number;
  allocatedSkills: SkillNodeId[];
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

const SAVE_DATA_KEYS = [
  "currentWorld", "levels", "credits", "totalStars", "totalScore", "xp",
  "introSeen", "upgrades", "unlockedCodex", "viewedCodex",
  "viewedConversations", "completedQuests", "activeQuests",
  "completedPlanets", "unlockedSpecialMissions", "completedSpecialMissions",
  "storyItems", "materials", "consumableInventory", "equippedConsumables",
  "unlockedEnhancements", "bestiary", "equippedWeaponType", "pilotLevel",
  "skillPoints", "allocatedSkills", "colonies", "planets", "earthShipments",
  "factionStandings", "bounties", "missionsSinceStart", "gameClock",
  "activeExperience", "galaxyRun",
] as const;

const UPGRADE_KEYS = [
  "hullPlating",
  "engineBoost",
  "weaponCore",
  "munitionsBay",
  "fireControl",
  "shieldGenerator",
] as const;

function exactOwnData(
  value: unknown,
  expectedKeys: readonly string[],
): Record<string, unknown> | null {
  if (!isPlainRecord(value)) return null;
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
  ) return null;
  const snapshot: Record<string, unknown> = {};
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor) || typeof descriptor.value === "function") {
      return null;
    }
    snapshot[key] = descriptor.value;
  }
  return snapshot;
}

function arraySnapshot(value: unknown): unknown[] | null {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (
    lengthDescriptor === undefined || !("value" in lengthDescriptor) ||
    !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0
  ) return null;
  const length = lengthDescriptor.value as number;
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== length + 1 ||
    keys.some((key) => key !== "length" && (
      typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length
    ))
  ) return null;
  const snapshot: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !("value" in descriptor) || typeof descriptor.value === "function") {
      return null;
    }
    snapshot.push(descriptor.value);
  }
  return snapshot;
}

function stringArraySnapshot(value: unknown): string[] | null {
  const snapshot = arraySnapshot(value);
  return snapshot !== null && snapshot.every((entry) => typeof entry === "string")
    ? snapshot as string[]
    : null;
}

function upgradeSnapshot(value: unknown): ShipUpgrades | null {
  const snapshot = exactOwnData(value, UPGRADE_KEYS);
  if (snapshot === null || UPGRADE_KEYS.some((key) =>
    !Number.isSafeInteger(snapshot[key]) || (snapshot[key] as number) < 0)) {
    return null;
  }
  return {
    hullPlating: snapshot.hullPlating as number,
    engineBoost: snapshot.engineBoost as number,
    weaponCore: snapshot.weaponCore as number,
    munitionsBay: snapshot.munitionsBay as number,
    fireControl: snapshot.fireControl as number,
    shieldGenerator: snapshot.shieldGenerator as number,
  };
}

function sameUpgrades(left: ShipUpgrades, right: ShipUpgrades): boolean {
  return UPGRADE_KEYS.every((key) => left[key] === right[key]);
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

function canonicalBlackBoxRecovered(run: GalaxyRunState): boolean | null {
  try {
    const root = exactOwnData(run, Reflect.ownKeys(run).filter(
      (key): key is string => typeof key === "string",
    ));
    if (root === null) return null;
    const storyItems = stringArraySnapshot(root.storyItems);
    if (storyItems === null) return null;
    return storyItems.includes("kepler-black-box");
  } catch {
    return null;
  }
}

function lockedProjection(
  projection: SaveData,
  run: GalaxyRunState,
): EngineProjectionInput | null {
  try {
    const snapshot = exactOwnData(projection, SAVE_DATA_KEYS);
    if (snapshot === null) return null;
    const levels = exactOwnData(snapshot.levels, []);
    const completedQuests = stringArraySnapshot(snapshot.completedQuests);
    const activeQuests = stringArraySnapshot(snapshot.activeQuests);
    const completedPlanets = stringArraySnapshot(snapshot.completedPlanets);
    const unlockedSpecialMissions = stringArraySnapshot(snapshot.unlockedSpecialMissions);
    const upgrades = upgradeSnapshot(snapshot.upgrades);
    const enhancements = stringArraySnapshot(snapshot.unlockedEnhancements);
    const allocatedSkills = stringArraySnapshot(snapshot.allocatedSkills);
    const canonicalUpgrades = upgradeSnapshot(run.ship.upgrades);
    const canonicalEnhancements = stringArraySnapshot(run.ship.unlockedEnhancements);
    const canonicalSkills = stringArraySnapshot(run.pilot.allocatedSkills);
    if (
      snapshot.activeExperience !== "legacy" || snapshot.galaxyRun !== null ||
      snapshot.currentWorld !== 1 || levels === null ||
      snapshot.totalStars !== 0 || snapshot.totalScore !== 0 ||
      completedQuests === null || completedQuests.length !== 0 ||
      activeQuests === null || activeQuests.length !== 0 ||
      completedPlanets === null || completedPlanets.length !== 0 ||
      unlockedSpecialMissions === null || unlockedSpecialMissions.length !== 0 ||
      upgrades === null || enhancements === null || allocatedSkills === null ||
      canonicalUpgrades === null || canonicalEnhancements === null || canonicalSkills === null ||
      !Number.isSafeInteger(snapshot.pilotLevel) ||
      !sameUpgrades(upgrades, canonicalUpgrades) ||
      !sameStrings(enhancements, canonicalEnhancements) ||
      snapshot.pilotLevel !== run.pilot.level ||
      !sameStrings(allocatedSkills, canonicalSkills)
    ) return null;
    return {
      upgrades,
      enhancements: enhancements as EnhancementId[],
      pilotLevel: snapshot.pilotLevel as number,
      allocatedSkills: allocatedSkills as SkillNodeId[],
    };
  } catch {
    return null;
  }
}

function fail(
  context: OperationLaunchContext | null,
  reason: OperationUnavailableReason,
): OperationLaunchResult {
  return {
    ok: false,
    context,
    operation: null,
    availability: unavailable(reason),
  };
}

/**
 * Launch an existing engine only after canonical galaxy authorization. The
 * compatibility projection supplies engine state, never availability.
 */
export function launchOperation(
  run: GalaxyRunState,
  projection: SaveData,
  context: OperationLaunchContext,
): OperationLaunchResult {
  let safeContext: OperationLaunchContext | null = null;
  try {
    safeContext = snapshotOperationLaunchContext(context);
    if (safeContext === null) return fail(null, "context_mismatch");
    const safeRun = structuredClone(run);
    const authorization = authorizeOperationLaunch(safeRun, safeContext.operationId);
    if (!authorization.ok) {
      return {
        ok: false,
        context: safeContext,
        operation: authorization.operation,
        availability: authorization.availability,
      };
    }
    if (!sameOperationLaunchContext(authorization.context, safeContext)) {
      return {
        ok: false,
        context: safeContext,
        operation: authorization.operation,
        availability: unavailable("context_mismatch"),
      };
    }
    const engineInput = lockedProjection(projection, safeRun);
    if (engineInput === null) {
      return {
        ok: false,
        context: safeContext,
        operation: authorization.operation,
        availability: unavailable("projection_not_locked"),
      };
    }

    const common = [
      engineInput.upgrades,
      engineInput.enhancements,
      engineInput.pilotLevel,
      engineInput.allocatedSkills,
    ] as const;
    let gameState;
    switch (safeContext.adapterKind) {
      case "legacy_level": {
        const payload = safeContext.adapterPayload;
        if (payload.kind !== "legacy_level" || payload.world !== 1 || payload.level !== 1 ||
          safeContext.operationId !== "op:hostile-picket") return fail(safeContext, "context_mismatch");
        gameState = createGameState(payload.world, payload.level, ...common);
        break;
      }
      case "special_mission": {
        const payload = safeContext.adapterPayload;
        if (payload.kind !== "special_mission" || payload.missionId !== "kepler-black-box" ||
          safeContext.operationId !== "op:kepler-black-box") return fail(safeContext, "context_mismatch");
        const blackBoxRecovered = canonicalBlackBoxRecovered(safeRun);
        if (blackBoxRecovered === null) return fail(safeContext, "malformed_run");
        gameState = createSpecialMissionGameState(
          payload.missionId,
          blackBoxRecovered,
          ...common,
        );
        break;
      }
      case "planet_mission": {
        const payload = safeContext.adapterPayload;
        if (payload.kind !== "planet_mission" || payload.planetId !== "ashfall" ||
          safeContext.operationId !== "op:ashfall-sortie") return fail(safeContext, "context_mismatch");
        gameState = createPlanetGameState(payload.planetId, ...common);
        break;
      }
      default: {
        const exhaustive: never = safeContext.adapterKind;
        return fail(safeContext, exhaustive);
      }
    }
    return { ok: true, context: structuredClone(authorization.context), gameState };
  } catch {
    return fail(safeContext, "malformed_run");
  }
}

export type GalaxyRegionAdapterReason =
  | "missing_galaxy_run"
  | "unsupported_contact"
  | "contact_not_visited"
  | "generation_unavailable"
  | "ashfall_origin_missing"
  | "malformed_save"
  | "malformed_request"
  | "invalid_poi_session"
  | "completion_not_ready"
  | "projection_merge_failed"
  | "projected_result_invalid"
  | "unsupported_poi_type"
  | "expedition_in_flight"
  | "destination_missing"
  | "outcome_stale"
  | RegionActionBlockReason;

export interface GalaxyPendingPoiResolution extends PendingPoiResolution {
  /** Canonical galaxy parent after the completion cycle; never a projection. */
  baseSave: SaveData;
  /** Canonical alias retained for PoiOutcomeScreen's existing structural prop. */
  projectedSave: SaveData;
}

export type GalaxyRegionOpenResult =
  | {
      ok: true;
      originColony: ColonyState;
      projectedSave: SaveData;
    }
  | { ok: false; reason: GalaxyRegionAdapterReason };

type GalaxyRegionOpenFailure = Extract<GalaxyRegionOpenResult, { ok: false }>;

export type GalaxyRegionExpeditionResult =
  | {
      ok: true;
      save: SaveData;
      requestId: string;
      session: PoiSession | null;
    }
  | { ok: false; save: SaveData; reason: GalaxyRegionAdapterReason };

export type GalaxyOutpostResult =
  | { ok: true; save: SaveData; colonyId: ColonyId }
  | { ok: false; save: SaveData; reason: GalaxyRegionAdapterReason };

export type GalaxyPoiPreparationResult =
  | {
      ok: true;
      save: SaveData;
      pending: GalaxyPendingPoiResolution;
    }
  | { ok: false; reason: GalaxyRegionAdapterReason };

export type GalaxyPoiResolutionResult =
  | { ok: true; save: SaveData; delivery: MissionDelivery | null }
  | { ok: false; save: SaveData; reason: GalaxyRegionAdapterReason };

interface OpenAshfallProjection {
  parent: SaveData;
  run: GalaxyRunState;
  originColony: ColonyState;
  projectedSave: SaveData;
}

function samePlainData(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (
    typeof left !== "object" || left === null ||
    typeof right !== "object" || right === null
  ) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((entry, index) => samePlainData(entry, right[index]));
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) =>
    key === rightKeys[index] && Object.prototype.hasOwnProperty.call(rightRecord, key) &&
    samePlainData(leftRecord[key], rightRecord[key]));
}

function openAshfallProjection(
  save: SaveData,
  contactId: string,
): OpenAshfallProjection | GalaxyRegionOpenFailure {
  if (contactId !== "contact:ashfall") {
    return { ok: false, reason: "unsupported_contact" };
  }
  try {
    const root = exactOwnData(save, SAVE_DATA_KEYS);
    if (root === null) return { ok: false, reason: "malformed_save" };
    const parent = root as unknown as SaveData;
    if (parent.activeExperience !== "galaxy" || parent.galaxyRun === null) {
      return { ok: false, reason: "missing_galaxy_run" };
    }
    const validated = mergeProjectionIntoGalaxy(parent.galaxyRun, {});
    if (!validated.ok) return { ok: false, reason: "malformed_save" };
    const run = validated.galaxyRun;
    if (getGalaxyRunAvailability(run).status !== "available") {
      return { ok: false, reason: "generation_unavailable" };
    }
    const visited = Object.values(run.atlas.knowledge).some((record) =>
      record.subjectId === "contact:ashfall" && record.state === "visited");
    if (!visited) return { ok: false, reason: "contact_not_visited" };
    const originColony = run.colonies.find((colony) =>
      colony.id === "galaxy:ashfall-primary" &&
      colony.planetId === "ashfall" &&
      colony.regionNodeId === "ashfall-forward-camp");
    if (originColony === undefined ||
      !run.planets.some((planet) => planet.id === "ashfall")) {
      return { ok: false, reason: "ashfall_origin_missing" };
    }
    const canonical = { ...parent, galaxyRun: run };
    return {
      parent: canonical,
      run,
      originColony,
      projectedSave: projectGalaxyRunToLegacySave(canonical),
    };
  } catch {
    return { ok: false, reason: "malformed_save" };
  }
}

function isOpenFailure(
  result: OpenAshfallProjection | GalaxyRegionOpenFailure,
): result is GalaxyRegionOpenFailure {
  return "ok" in result && result.ok === false;
}

function mergeProjectedRegion(
  opened: OpenAshfallProjection,
  projected: SaveData,
): { ok: true; save: SaveData } | { ok: false; reason: GalaxyRegionAdapterReason } {
  try {
    const projection = exactOwnData(projected, SAVE_DATA_KEYS);
    if (projection === null || projection.activeExperience !== "legacy" || projection.galaxyRun !== null) {
      return { ok: false, reason: "projected_result_invalid" };
    }
    const delta: GalaxyProjectionDelta = {
      colonies: projection.colonies as SaveData["colonies"],
      planets: projection.planets as SaveData["planets"],
      missionsSinceStart: projection.missionsSinceStart as number,
    };
    const merged = mergeProjectionIntoGalaxy(opened.run, delta);
    if (!merged.ok) return { ok: false, reason: "projection_merge_failed" };
    return {
      ok: true,
      save: { ...opened.parent, activeExperience: "galaxy", galaxyRun: merged.galaxyRun },
    };
  } catch {
    return { ok: false, reason: "projected_result_invalid" };
  }
}

function snapshotExpeditionRequest(value: RegionExpeditionRequest): RegionExpeditionRequest | null {
  try {
    const snapshot = exactOwnData(value, ["kind", "originColonyId", "targetNodeId"]);
    if (snapshot === null || (snapshot.kind !== "survey" && snapshot.kind !== "poi") ||
      typeof snapshot.originColonyId !== "string" || snapshot.originColonyId.length === 0 ||
      typeof snapshot.targetNodeId !== "string" || snapshot.targetNodeId.length === 0) return null;
    return {
      kind: snapshot.kind,
      originColonyId: snapshot.originColonyId,
      targetNodeId: snapshot.targetNodeId,
    } as RegionExpeditionRequest;
  } catch {
    return null;
  }
}

function snapshotActivePoi(value: ActivePoiDescriptor): ActivePoiDescriptor | null {
  try {
    const active = exactOwnData(value, ["originColonyId", "session"]);
    const session = active === null
      ? null
      : exactOwnData(active.session, ["nodeId", "engine", "state", "rewardEligible"]);
    if (active === null || session === null || typeof active.originColonyId !== "string" ||
      typeof session.nodeId !== "string" ||
      (session.engine !== "firstPerson" && session.engine !== "boarding" && session.engine !== "groundRun") ||
      typeof session.rewardEligible !== "boolean") return null;
    return structuredClone(value);
  } catch {
    return null;
  }
}

function validPoiSession(
  projection: SaveData,
  active: ActivePoiDescriptor,
): boolean {
  const expected = dispatchPoi(projection, active.originColonyId, active.session.nodeId);
  return expected.ok && samePlainData(expected.session, active.session);
}

/**
 * Open the already-visited Ashfall contact as a disposable M1 compatibility
 * view. The returned projection deliberately has no galaxy namespace and must
 * never be persisted.
 */
export function openGalaxyRegion(
  save: SaveData,
  contactId: string,
): GalaxyRegionOpenResult {
  const opened = openAshfallProjection(save, contactId);
  if (isOpenFailure(opened)) return opened;
  return {
    ok: true,
    originColony: structuredClone(opened.originColony),
    projectedSave: opened.projectedSave,
  };
}

export function startGalaxyRegionExpedition(
  save: SaveData,
  contactId: string,
  request: RegionExpeditionRequest,
  activeRequestId: string | null,
): GalaxyRegionExpeditionResult {
  const safeRequest = snapshotExpeditionRequest(request);
  if (safeRequest === null ||
    (activeRequestId !== null && (typeof activeRequestId !== "string" || activeRequestId.length === 0))) {
    return { ok: false, save, reason: "malformed_request" };
  }
  const opened = openAshfallProjection(save, contactId);
  if (isOpenFailure(opened)) return { ...opened, save };
  try {
    const result = startRegionExpedition(opened.projectedSave, safeRequest, activeRequestId);
    if (!result.ok) return { ok: false, save, reason: result.reason };
    const merged = mergeProjectedRegion(opened, result.save);
    if (!merged.ok) return { ok: false, save, reason: merged.reason };
    return {
      ok: true,
      save: merged.save,
      requestId: result.requestId,
      session: result.session === null ? null : structuredClone(result.session),
    };
  } catch {
    return { ok: false, save, reason: "projected_result_invalid" };
  }
}

export function foundGalaxyOutpost(
  save: SaveData,
  contactId: string,
  originColonyId: ColonyId,
  targetNodeId: RegionNodeId,
  name: string,
): GalaxyOutpostResult {
  if (typeof originColonyId !== "string" || originColonyId.length === 0 ||
    typeof targetNodeId !== "string" || targetNodeId.length === 0 ||
    typeof name !== "string" || name.trim().length === 0) {
    return { ok: false, save, reason: "malformed_request" };
  }
  const opened = openAshfallProjection(save, contactId);
  if (isOpenFailure(opened)) return { ...opened, save };
  try {
    const result = foundOutpost(
      opened.projectedSave,
      originColonyId,
      targetNodeId,
      name,
    );
    if (!result.ok) return { ok: false, save, reason: result.reason };
    const merged = mergeProjectedRegion(opened, result.save);
    if (!merged.ok) return { ok: false, save, reason: merged.reason };
    return { ok: true, save: merged.save, colonyId: result.colonyId };
  } catch {
    return { ok: false, save, reason: "projected_result_invalid" };
  }
}

export function prepareGalaxyPoiCompletion(
  save: SaveData,
  contactId: string,
  activePoi: ActivePoiDescriptor,
  screen: GameScreen,
): GalaxyPoiPreparationResult {
  const safeActive = snapshotActivePoi(activePoi);
  if (safeActive === null) return { ok: false, reason: "invalid_poi_session" };
  const opened = openAshfallProjection(save, contactId);
  if (isOpenFailure(opened)) return opened;
  try {
    if (!validPoiSession(opened.projectedSave, safeActive)) {
      return { ok: false, reason: "invalid_poi_session" };
    }
    const native = preparePoiCompletion(opened.projectedSave, safeActive, screen);
    if (native === null) return { ok: false, reason: "completion_not_ready" };
    const base = mergeProjectedRegion(opened, native.baseSave);
    if (!base.ok) return base;
    // Validate the deferred clear/delivery candidate now, but commit only the
    // native base cycle. Resolution reconstructs a fresh projection later.
    const deferred = mergeProjectedRegion(opened, native.projectedSave);
    if (!deferred.ok) return deferred;
    const pending: GalaxyPendingPoiResolution = {
      originColonyId: native.originColonyId,
      nodeId: native.nodeId,
      baseSave: base.save,
      projectedSave: base.save,
      outcome: native.outcome === null ? null : structuredClone(native.outcome),
    };
    return { ok: true, save: base.save, pending };
  } catch {
    return { ok: false, reason: "projected_result_invalid" };
  }
}

function snapshotGalaxyPending(
  save: SaveData,
  pending: GalaxyPendingPoiResolution,
): GalaxyPendingPoiResolution | null {
  try {
    const snapshot = exactOwnData(
      pending,
      ["originColonyId", "nodeId", "baseSave", "projectedSave", "outcome"],
    );
    if (snapshot === null || typeof snapshot.originColonyId !== "string" ||
      typeof snapshot.nodeId !== "string") return null;
    const baseRoot = exactOwnData(snapshot.baseSave, SAVE_DATA_KEYS);
    const aliasRoot = exactOwnData(snapshot.projectedSave, SAVE_DATA_KEYS);
    const currentRoot = exactOwnData(save, SAVE_DATA_KEYS);
    if (baseRoot === null || aliasRoot === null || currentRoot === null ||
      baseRoot.activeExperience !== "galaxy" || baseRoot.galaxyRun === null ||
      !samePlainData(baseRoot, aliasRoot) ||
      !SAVE_DATA_KEYS.filter((key) => key !== "galaxyRun").every((key) =>
        samePlainData(baseRoot[key], currentRoot[key]))) return null;
    const baseRun = mergeProjectionIntoGalaxy(baseRoot.galaxyRun as GalaxyRunState, {});
    const currentRun = currentRoot.galaxyRun === null
      ? null
      : mergeProjectionIntoGalaxy(currentRoot.galaxyRun as GalaxyRunState, {});
    if (!baseRun.ok || currentRun === null || !currentRun.ok ||
      !samePlainData(baseRun.galaxyRun.identity, currentRun.galaxyRun.identity) ||
      baseRun.galaxyRun.worldCycle !== currentRun.galaxyRun.worldCycle) return null;
    if (snapshot.outcome !== null) {
      const outcome = exactOwnData(snapshot.outcome, ["originColonyId", "nodeId", "payload"]);
      const payload = outcome === null ? null : exactOwnData(outcome.payload, Object.keys(POI_CARGO));
      if (outcome === null || payload === null ||
        outcome.originColonyId !== snapshot.originColonyId ||
        outcome.nodeId !== snapshot.nodeId ||
        !samePlainData(payload, POI_CARGO)) return null;
    }
    return structuredClone(pending);
  } catch {
    return null;
  }
}

export function resolveGalaxyPoiCompletion(
  save: SaveData,
  contactId: string,
  pending: GalaxyPendingPoiResolution,
  destinationColonyId: ColonyId | null,
): GalaxyPoiResolutionResult {
  const safePending = snapshotGalaxyPending(save, pending);
  if (safePending === null ||
    (destinationColonyId !== null &&
      (typeof destinationColonyId !== "string" || destinationColonyId.length === 0))) {
    return { ok: false, save, reason: "invalid_poi_session" };
  }
  const opened = openAshfallProjection(save, contactId);
  if (isOpenFailure(opened)) return { ...opened, save };
  try {
    const nativePending: PendingPoiResolution = {
      originColonyId: safePending.originColonyId,
      nodeId: safePending.nodeId,
      baseSave: opened.projectedSave,
      projectedSave: opened.projectedSave,
      outcome: safePending.outcome,
    };
    const native = resolvePoiCompletion(nativePending, destinationColonyId);
    if (!native.ok) return { ok: false, save, reason: native.reason };
    const merged = mergeProjectedRegion(opened, native.save);
    if (!merged.ok) return { ok: false, save, reason: merged.reason };
    return {
      ok: true,
      save: merged.save,
      delivery: native.delivery === null ? null : structuredClone(native.delivery),
    };
  } catch {
    return { ok: false, save, reason: "projected_result_invalid" };
  }
}

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
import { isSupportedPoiNode, type PoiTemplateId } from "../../colony/region/poiCatalog";
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
import { stableHash } from "../galaxy/coordinates";
import { getGalaxyRunAvailability } from "../galaxy/galaxyRun";
import type { GalaxyRunState, HistoricalFact } from "../galaxy/galaxyTypes";
import type {
  EnhancementId,
  GameScreen,
  SaveData,
  ShipUpgrades,
  SkillNodeId,
} from "../types";
import {
  authorizeOperationLaunch,
  operationDisplayLabel,
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
    gameState.galaxyOperation = {
      id: authorization.operation.id,
      label: operationDisplayLabel(authorization.operation.id),
    };
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
  /** Adapter-owned journal proof binding this exact canonical preparation. */
  preparedFactId: string;
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

export type GalaxyPoiRecoveryResult =
  | {
      ok: true;
      save: SaveData;
      pending: GalaxyPendingPoiResolution | null;
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

interface StableActivePoiAuthority {
  originColonyId: ColonyId;
  nodeId: RegionNodeId;
  engine: PoiSession["engine"];
  rewardEligible: boolean;
}

interface CanonicalPoiAuthority extends StableActivePoiAuthority {
  templateId: PoiTemplateId;
  session: PoiSession;
}

function snapshotActivePoi(value: ActivePoiDescriptor): StableActivePoiAuthority | null {
  try {
    const active = exactOwnData(value, ["originColonyId", "session"]);
    const session = active === null
      ? null
      : exactOwnData(active.session, ["nodeId", "engine", "state", "rewardEligible"]);
    if (active === null || session === null || typeof active.originColonyId !== "string" ||
      active.originColonyId.length === 0 ||
      typeof session.nodeId !== "string" || session.nodeId.length === 0 ||
      (session.engine !== "firstPerson" && session.engine !== "boarding" && session.engine !== "groundRun") ||
      typeof session.rewardEligible !== "boolean") return null;
    // The live engine owns session.state and mutates it every frame. Completion
    // authority deliberately snapshots only stable launch fields and never
    // clones, compares, or later consumes that mutable gameplay object.
    return {
      originColonyId: active.originColonyId,
      nodeId: session.nodeId,
      engine: session.engine,
      rewardEligible: session.rewardEligible,
    };
  } catch {
    return null;
  }
}

function canonicalPoiAuthority(
  projection: SaveData,
  originColonyId: ColonyId,
  nodeId: RegionNodeId,
): CanonicalPoiAuthority | null {
  const expected = dispatchPoi(projection, originColonyId, nodeId);
  if (!expected.ok) return null;
  const colony = projection.colonies.find((entry) => entry.id === originColonyId);
  const node = projection.planets.find((entry) => entry.id === colony?.planetId)
    ?.regionMap.nodes.find((entry) => entry.id === nodeId);
  if (node === undefined || !isSupportedPoiNode(node)) return null;
  return {
    originColonyId,
    nodeId,
    engine: expected.session.engine,
    rewardEligible: expected.session.rewardEligible,
    templateId: node.templateId,
    session: expected.session,
  };
}

function authorizedPoiSession(
  projection: SaveData,
  active: StableActivePoiAuthority,
): CanonicalPoiAuthority | null {
  const canonical = canonicalPoiAuthority(
    projection,
    active.originColonyId,
    active.nodeId,
  );
  return canonical !== null &&
    canonical.engine === active.engine &&
    canonical.rewardEligible === active.rewardEligible
    ? canonical
    : null;
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

type PreparedPoiOutcomePayload = readonly [
  originColonyId: ColonyId,
  nodeId: RegionNodeId,
  cargo: ReadonlyArray<readonly [string, number]>,
] | null;

type PreparedPoiPayload = readonly [
  version: 1,
  originColonyId: ColonyId,
  nodeId: RegionNodeId,
  cycle: number,
  templateId: PoiTemplateId,
  engine: PoiSession["engine"],
  rewardEligible: boolean,
  outcome: PreparedPoiOutcomePayload,
];

function snapshotPreparedOutcome(
  value: PendingPoiResolution["outcome"],
  originColonyId: ColonyId,
  nodeId: RegionNodeId,
): { outcome: PendingPoiResolution["outcome"]; payload: PreparedPoiOutcomePayload } | null {
  if (value === null) return { outcome: null, payload: null };
  try {
    const outcome = exactOwnData(value, ["originColonyId", "nodeId", "payload"]);
    const cargoKeys = Object.keys(POI_CARGO).sort();
    const payload = outcome === null ? null : exactOwnData(outcome.payload, cargoKeys);
    if (outcome === null || payload === null ||
      outcome.originColonyId !== originColonyId || outcome.nodeId !== nodeId ||
      !cargoKeys.every((key) => payload[key] === POI_CARGO[key as keyof typeof POI_CARGO])) {
      return null;
    }
    const cargo = cargoKeys.map((key) => [key, payload[key] as number] as const);
    return {
      outcome: {
        originColonyId,
        nodeId,
        payload: Object.fromEntries(cargo),
      },
      payload: [originColonyId, nodeId, cargo],
    };
  } catch {
    return null;
  }
}

function preparedPoiPayload(
  authority: CanonicalPoiAuthority,
  cycle: number,
  outcome: PendingPoiResolution["outcome"],
): { payload: PreparedPoiPayload; outcome: PendingPoiResolution["outcome"] } | null {
  if (!Number.isSafeInteger(cycle) || cycle < 0) return null;
  const canonicalOutcome = snapshotPreparedOutcome(
    outcome,
    authority.originColonyId,
    authority.nodeId,
  );
  if (canonicalOutcome === null ||
    authority.rewardEligible !== (canonicalOutcome.outcome !== null)) return null;
  return {
    payload: [
      1,
      authority.originColonyId,
      authority.nodeId,
      cycle,
      authority.templateId,
      authority.engine,
      authority.rewardEligible,
      canonicalOutcome.payload,
    ],
    outcome: canonicalOutcome.outcome,
  };
}

function preparedFactId(payload: PreparedPoiPayload): string {
  const canonical = JSON.stringify(payload);
  const hash = stableHash(`poi-prepared:${canonical}`).toString(16).padStart(8, "0");
  // The canonical payload suffix keeps identities collision-safe even if two
  // distinct preparations share the compact 32-bit hash.
  return `history:poi-prepared:${hash}:${encodeURIComponent(canonical)}`;
}

function journalPoiPreparation(
  save: SaveData,
  authority: CanonicalPoiAuthority,
  outcome: PendingPoiResolution["outcome"],
): { save: SaveData; preparedFactId: string; outcome: PendingPoiResolution["outcome"] } | null {
  if (save.galaxyRun === null) return null;
  const prepared = preparedPoiPayload(authority, save.galaxyRun.worldCycle, outcome);
  if (prepared === null) return null;
  const id = preparedFactId(prepared.payload);
  if (save.galaxyRun.historyFacts.some((fact) => fact.id === id)) return null;
  const fact: HistoricalFact = {
    id,
    kind: "poi_completion_prepared",
    subjectId: authority.nodeId,
    cycle: save.galaxyRun.worldCycle,
    causeFactIds: [],
  };
  const candidate = structuredClone(save.galaxyRun);
  candidate.historyFacts.push(fact);
  const validated = mergeProjectionIntoGalaxy(candidate, {});
  if (!validated.ok) return null;
  return {
    save: { ...save, activeExperience: "galaxy", galaxyRun: validated.galaxyRun },
    preparedFactId: id,
    outcome: prepared.outcome,
  };
}

function decodePreparedOutcomePayload(
  value: unknown,
  originColonyId: ColonyId,
  nodeId: RegionNodeId,
): { outcome: PendingPoiResolution["outcome"]; payload: PreparedPoiOutcomePayload } | null {
  if (value === null) return { outcome: null, payload: null };
  const tuple = arraySnapshot(value);
  if (tuple === null || tuple.length !== 3 || tuple[0] !== originColonyId || tuple[1] !== nodeId) {
    return null;
  }
  const cargoEntries = arraySnapshot(tuple[2]);
  if (cargoEntries === null) return null;
  const cargo: Record<string, number> = {};
  for (const rawEntry of cargoEntries) {
    const entry = arraySnapshot(rawEntry);
    if (entry === null || entry.length !== 2 || typeof entry[0] !== "string" ||
      typeof entry[1] !== "number" || !Number.isFinite(entry[1]) ||
      Object.prototype.hasOwnProperty.call(cargo, entry[0])) return null;
    cargo[entry[0]] = entry[1];
  }
  const canonical = snapshotPreparedOutcome(
    { originColonyId, nodeId, payload: cargo },
    originColonyId,
    nodeId,
  );
  return canonical !== null && samePlainData(canonical.payload, value)
    ? canonical
    : null;
}

function decodePreparedFact(
  fact: HistoricalFact,
): { payload: PreparedPoiPayload; outcome: PendingPoiResolution["outcome"] } | null {
  try {
    const snapshot = exactOwnData(
      fact,
      ["id", "kind", "subjectId", "cycle", "causeFactIds"],
    );
    if (snapshot === null || snapshot.kind !== "poi_completion_prepared" ||
      typeof snapshot.id !== "string" || typeof snapshot.subjectId !== "string" ||
      !Number.isSafeInteger(snapshot.cycle) || (snapshot.cycle as number) < 0) return null;
    const match = /^history:poi-prepared:([0-9a-f]{8}):(.*)$/.exec(snapshot.id);
    if (match === null) return null;
    const decoded = arraySnapshot(JSON.parse(decodeURIComponent(match[2])));
    if (decoded === null || decoded.length !== 8 || decoded[0] !== 1 ||
      typeof decoded[1] !== "string" || decoded[1].length === 0 ||
      typeof decoded[2] !== "string" || decoded[2].length === 0 ||
      !Number.isSafeInteger(decoded[3]) || (decoded[3] as number) < 0 ||
      typeof decoded[4] !== "string" || decoded[4].length === 0 ||
      (decoded[5] !== "firstPerson" && decoded[5] !== "boarding" && decoded[5] !== "groundRun") ||
      typeof decoded[6] !== "boolean") return null;
    const outcome = decodePreparedOutcomePayload(
      decoded[7],
      decoded[1] as ColonyId,
      decoded[2] as RegionNodeId,
    );
    if (outcome === null || decoded[6] !== (outcome.outcome !== null)) return null;
    const payload: PreparedPoiPayload = [
      1,
      decoded[1] as ColonyId,
      decoded[2] as RegionNodeId,
      decoded[3] as number,
      decoded[4] as PoiTemplateId,
      decoded[5],
      decoded[6],
      outcome.payload,
    ];
    const expectedId = preparedFactId(payload);
    return samePlainData(snapshot, {
      id: expectedId,
      kind: "poi_completion_prepared",
      subjectId: payload[2],
      cycle: payload[3],
      causeFactIds: [],
    })
      ? { payload, outcome: outcome.outcome }
      : null;
  } catch {
    return null;
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
    const authority = authorizedPoiSession(opened.projectedSave, safeActive);
    if (authority === null) {
      return { ok: false, reason: "invalid_poi_session" };
    }
    const native = preparePoiCompletion(opened.projectedSave, {
      originColonyId: authority.originColonyId,
      session: authority.session,
    }, screen);
    if (native === null) return { ok: false, reason: "completion_not_ready" };
    const base = mergeProjectedRegion(opened, native.baseSave);
    if (!base.ok) return base;
    // Validate the deferred clear/delivery candidate now, but commit only the
    // native base cycle. Resolution reconstructs a fresh projection later.
    const deferred = mergeProjectedRegion(opened, native.projectedSave);
    if (!deferred.ok) return deferred;
    const journaled = journalPoiPreparation(base.save, authority, native.outcome);
    if (journaled === null) return { ok: false, reason: "projected_result_invalid" };
    const pending: GalaxyPendingPoiResolution = {
      originColonyId: native.originColonyId,
      nodeId: native.nodeId,
      preparedFactId: journaled.preparedFactId,
      baseSave: journaled.save,
      projectedSave: journaled.save,
      outcome: journaled.outcome,
    };
    return { ok: true, save: journaled.save, pending };
  } catch {
    return { ok: false, reason: "projected_result_invalid" };
  }
}

/**
 * Rebuild the one deferred Ashfall outcome that survived a page reload. The
 * journal is treated as hostile serialized input: every embedded field is
 * rebound to the current canonical projection before a pending result exists.
 */
export function recoverGalaxyPoiCompletion(
  save: SaveData,
  contactId: string,
): GalaxyPoiRecoveryResult {
  const opened = openAshfallProjection(save, contactId);
  if (isOpenFailure(opened)) return opened;
  try {
    const preparedFacts = opened.run.historyFacts.filter((fact) =>
      fact.kind === "poi_completion_prepared");
    const unresolved: Array<{
      payload: PreparedPoiPayload;
      outcome: PendingPoiResolution["outcome"];
    }> = [];
    for (const fact of preparedFacts) {
      const decoded = decodePreparedFact(fact);
      if (decoded === null) return { ok: false, reason: "invalid_poi_session" };
      const [, originColonyId, nodeId, cycle, templateId, engine, rewardEligible] = decoded.payload;
      const colony = opened.projectedSave.colonies.find((entry) => entry.id === originColonyId);
      const node = opened.projectedSave.planets.find((entry) => entry.id === colony?.planetId)
        ?.regionMap.nodes.find((entry) => entry.id === nodeId);
      if (node === undefined || node.templateId !== templateId) {
        return { ok: false, reason: "invalid_poi_session" };
      }
      if (node.intel === "cleared") continue;
      const authority = canonicalPoiAuthority(opened.projectedSave, originColonyId, nodeId);
      const rebound = authority === null
        ? null
        : preparedPoiPayload(authority, cycle, decoded.outcome);
      if (authority === null || rebound === null || authority.templateId !== templateId ||
        authority.engine !== engine || authority.rewardEligible !== rewardEligible ||
        !samePlainData(rebound.payload, decoded.payload)) {
        return { ok: false, reason: "invalid_poi_session" };
      }
      unresolved.push(decoded);
    }
    if (unresolved.length === 0) {
      return { ok: true, save: opened.parent, pending: null };
    }
    if (unresolved.length !== 1 || unresolved[0].payload[3] !== opened.run.worldCycle) {
      return { ok: false, reason: "invalid_poi_session" };
    }
    const [, originColonyId, nodeId] = unresolved[0].payload;
    const preparedId = preparedFactId(unresolved[0].payload);
    const pending: GalaxyPendingPoiResolution = {
      originColonyId,
      nodeId,
      preparedFactId: preparedId,
      baseSave: opened.parent,
      projectedSave: opened.parent,
      outcome: unresolved[0].outcome,
    };
    return { ok: true, save: opened.parent, pending };
  } catch {
    return { ok: false, reason: "invalid_poi_session" };
  }
}

interface ValidatedGalaxyPending {
  originColonyId: ColonyId;
  nodeId: RegionNodeId;
  preparedFactId: string;
  baseSave: SaveData;
  currentSave: SaveData;
  outcome: PendingPoiResolution["outcome"];
}

function hasExactPreparedFact(
  run: GalaxyRunState,
  id: string,
  nodeId: RegionNodeId,
  cycle: number,
): boolean {
  const matches = run.historyFacts.filter((fact) =>
    fact.kind === "poi_completion_prepared" &&
    fact.subjectId === nodeId &&
    fact.cycle === cycle);
  return matches.length === 1 && samePlainData(matches[0], {
    id,
    kind: "poi_completion_prepared",
    subjectId: nodeId,
    cycle,
    causeFactIds: [],
  });
}

function snapshotGalaxyPending(
  save: SaveData,
  pending: GalaxyPendingPoiResolution,
): ValidatedGalaxyPending | null {
  try {
    const snapshot = exactOwnData(
      pending,
      ["originColonyId", "nodeId", "preparedFactId", "baseSave", "projectedSave", "outcome"],
    );
    if (snapshot === null || typeof snapshot.originColonyId !== "string" ||
      snapshot.originColonyId.length === 0 || typeof snapshot.nodeId !== "string" ||
      snapshot.nodeId.length === 0 || typeof snapshot.preparedFactId !== "string" ||
      snapshot.preparedFactId.length === 0) return null;
    const baseRoot = exactOwnData(snapshot.baseSave, SAVE_DATA_KEYS);
    const aliasRoot = exactOwnData(snapshot.projectedSave, SAVE_DATA_KEYS);
    const currentRoot = exactOwnData(save, SAVE_DATA_KEYS);
    if (baseRoot === null || aliasRoot === null || currentRoot === null ||
      baseRoot.activeExperience !== "galaxy" || baseRoot.galaxyRun === null ||
      currentRoot.activeExperience !== "galaxy" || currentRoot.galaxyRun === null ||
      !samePlainData(baseRoot, aliasRoot) ||
      !SAVE_DATA_KEYS.filter((key) => key !== "galaxyRun").every((key) =>
        samePlainData(baseRoot[key], currentRoot[key]))) return null;
    const baseRun = mergeProjectionIntoGalaxy(baseRoot.galaxyRun as GalaxyRunState, {});
    const currentRun = mergeProjectionIntoGalaxy(currentRoot.galaxyRun as GalaxyRunState, {});
    if (!baseRun.ok || !currentRun.ok) return null;
    const baseSave = {
      ...(baseRoot as unknown as SaveData),
      galaxyRun: baseRun.galaxyRun,
    };
    const currentSave = {
      ...(currentRoot as unknown as SaveData),
      galaxyRun: currentRun.galaxyRun,
    };
    const authority = canonicalPoiAuthority(
      projectGalaxyRunToLegacySave(baseSave),
      snapshot.originColonyId,
      snapshot.nodeId,
    );
    if (authority === null) return null;
    const prepared = preparedPoiPayload(
      authority,
      baseRun.galaxyRun.worldCycle,
      snapshot.outcome as PendingPoiResolution["outcome"],
    );
    if (prepared === null) return null;
    const expectedFactId = preparedFactId(prepared.payload);
    if (snapshot.preparedFactId !== expectedFactId ||
      !hasExactPreparedFact(
        baseRun.galaxyRun,
        expectedFactId,
        authority.nodeId,
        baseRun.galaxyRun.worldCycle,
      ) ||
      !hasExactPreparedFact(
        currentRun.galaxyRun,
        expectedFactId,
        authority.nodeId,
        baseRun.galaxyRun.worldCycle,
      )) return null;
    return {
      originColonyId: authority.originColonyId,
      nodeId: authority.nodeId,
      preparedFactId: expectedFactId,
      baseSave,
      currentSave,
      outcome: prepared.outcome,
    };
  } catch {
    return null;
  }
}

function resolveValidatedGalaxyPending(
  save: SaveData,
  contactId: string,
  pending: ValidatedGalaxyPending,
  destinationColonyId: ColonyId | null,
): GalaxyPoiResolutionResult {
  const opened = openAshfallProjection(save, contactId);
  if (isOpenFailure(opened)) return { ...opened, save };
  const nativePending: PendingPoiResolution = {
    originColonyId: pending.originColonyId,
    nodeId: pending.nodeId,
    baseSave: opened.projectedSave,
    projectedSave: opened.projectedSave,
    outcome: pending.outcome,
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
  try {
    const atPreparedBase = samePlainData(safePending.baseSave, safePending.currentSave);
    if (!atPreparedBase) {
      const canonicalResolution = resolveValidatedGalaxyPending(
        safePending.baseSave,
        contactId,
        safePending,
        destinationColonyId,
      );
      if (!canonicalResolution.ok ||
        !samePlainData(canonicalResolution.save, safePending.currentSave)) {
        return { ok: false, save, reason: "invalid_poi_session" };
      }
      const stale = resolveValidatedGalaxyPending(
        safePending.currentSave,
        contactId,
        safePending,
        destinationColonyId,
      );
      return !stale.ok && stale.reason === "outcome_stale"
        ? { ok: false, save, reason: "outcome_stale" }
        : { ok: false, save, reason: "invalid_poi_session" };
    }
    const resolved = resolveValidatedGalaxyPending(
      safePending.currentSave,
      contactId,
      safePending,
      destinationColonyId,
    );
    return resolved.ok ? resolved : { ...resolved, save };
  } catch {
    return { ok: false, save, reason: "projected_result_invalid" };
  }
}

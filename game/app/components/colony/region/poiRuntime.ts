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
import { advanceWorldCycle } from "../shared/cycleProcessor";
import type { ColonyId } from "../shared/colonyTypes";
import type { MissionDelivery } from "../shared/missionDelivery";
import type { PoiSession } from "./poiDispatcher";
import { createPoiOutcome, confirmPoiOutcome, type PendingPoiOutcome } from "./poiOutcomes";

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

function snapshotDurableData(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
): unknown | typeof INVALID_DURABLE_SNAPSHOT {
  if (value === null || (typeof value !== "object" && typeof value !== "function")) return value;
  if (typeof value === "function" || seen.has(value)) return INVALID_DURABLE_SNAPSHOT;
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
  const saveSnapshot = snapshotDurableData(save);
  const activePoiSnapshot = snapshotDurableData(activePoi);
  const attemptSnapshot = attempt === undefined ? undefined : snapshotDurableData(attempt);
  if (saveSnapshot === INVALID_DURABLE_SNAPSHOT ||
    activePoiSnapshot === INVALID_DURABLE_SNAPSHOT || activePoiSnapshot === null ||
    attemptSnapshot === INVALID_DURABLE_SNAPSHOT || screen !== GameScreen.LEVEL_COMPLETE) return null;
  const safeSave = saveSnapshot as SaveData;
  const safeActivePoi = activePoiSnapshot as ActivePoiDescriptor;
  if (attempt !== undefined) {
    const safeAttempt = attemptSnapshot as OutcomeAttempt;
    if (safeAttempt.routeKind !== "poi" || safeAttempt.routeIdentity.kind !== "poi" ||
      safeAttempt.persistenceAuthority !== "legacy" || safeAttempt.returnTarget !== "legacy-colony-exterior" ||
      safeAttempt.routeIdentity.originColonyId !== safeActivePoi.originColonyId ||
      safeAttempt.routeIdentity.nodeId !== safeActivePoi.session.nodeId ||
      safeAttempt.routeIdentity.engine !== safeActivePoi.session.engine ||
      safeAttempt.routeIdentity.rewardEligible !== safeActivePoi.session.rewardEligible) return null;
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
  if (!safeActivePoi.session.rewardEligible) return { originColonyId: safeActivePoi.originColonyId, nodeId: safeActivePoi.session.nodeId, baseSave, projectedSave: baseSave, outcome: null };
  const created = createPoiOutcome(baseSave, safeActivePoi.originColonyId, safeActivePoi.session.nodeId);
  if (!created.ok) return null;
  return { originColonyId: safeActivePoi.originColonyId, nodeId: safeActivePoi.session.nodeId, baseSave, projectedSave: created.save, outcome: created.outcome };
}

export function recoverLegacyPoiCompletion(save: SaveData): LegacyPreparedPoiResolution | null {
  const preparedEnvelope = recoverLegacyPreparedOutcome(save);
  if (preparedEnvelope === null || preparedEnvelope.routeIdentity.kind !== "poi") return null;
  return {
    originColonyId: preparedEnvelope.routeIdentity.originColonyId,
    nodeId: preparedEnvelope.routeIdentity.nodeId,
    baseSave: save,
    projectedSave: save,
    outcome: null,
    preparedSave: save,
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
  const pendingSnapshot = snapshotDurableData(pending);
  if (pendingSnapshot === INVALID_DURABLE_SNAPSHOT || pendingSnapshot === null) return null;
  const safePending = pendingSnapshot as PendingPoiResolution;
  if ("preparedEnvelope" in safePending && "preparedSave" in safePending) {
    const prepared = safePending as LegacyPreparedPoiResolution;
    return {
      ok: true as const,
      save: prepared.preparedSave,
      delivery: null,
      envelope: createOutcomeEnvelope(prepared.preparedEnvelope, "success", {
        version: 2,
        kind: "poi_result_v2",
        destinationColonyId,
      }),
    };
  }
  if (!safePending.outcome) return { ok: true as const, save: safePending.baseSave, delivery: null };
  if (!destinationColonyId) return { ok: false as const, save: safePending.baseSave, reason: "destination_missing" as const };
  return confirmPoiOutcome(safePending.baseSave, safePending.outcome, destinationColonyId);
}

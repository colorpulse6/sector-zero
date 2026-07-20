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
import { advanceWorldCycle } from "../shared/cycleProcessor";
import type { ColonyId } from "../shared/colonyTypes";
import type { MissionDelivery } from "../shared/missionDelivery";
import type { PoiSession } from "./poiDispatcher";
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

function ownDataRecord(value: unknown): Record<string, unknown> | null {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const snapshot: Record<string, unknown> = {};
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor)) return null;
      snapshot[key] = descriptor.value;
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
  const fields = requiredOwnData(value, ["colonies", "planets", "missionsSinceStart"]);
  return fields !== null && Array.isArray(fields.colonies) && Array.isArray(fields.planets) &&
    Number.isSafeInteger(fields.missionsSinceStart) && (fields.missionsSinceStart as number) >= 0 &&
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
    if (safeActivePoi === null) return null;
    if (attempt !== undefined) {
      if (!isCanonicalCompletionSave(save)) return null;
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
      const preparedSave = stageLegacyPreparedOutcome(save, preparedEnvelope);
      if (preparedSave === null) return null;
      return {
        originColonyId: safeActivePoi.originColonyId,
        nodeId: safeActivePoi.session.nodeId,
        baseSave: save,
        projectedSave: save,
        outcome: null,
        preparedSave,
        preparedEnvelope,
      };
    }
    const safeSave = snapshotCanonicalCompletionSave(save);
    if (safeSave === null) return null;
    const baseSave = advanceWorldCycle(safeSave);
    if (!safeActivePoi.session.rewardEligible) {
      return {
        originColonyId: safeActivePoi.originColonyId,
        nodeId: safeActivePoi.session.nodeId,
        baseSave,
        projectedSave: baseSave,
        outcome: null,
      };
    }
    const created = createPoiOutcome(baseSave, safeActivePoi.originColonyId, safeActivePoi.session.nodeId);
    if (!created.ok) return null;
    return {
      originColonyId: safeActivePoi.originColonyId,
      nodeId: safeActivePoi.session.nodeId,
      baseSave,
      projectedSave: created.save,
      outcome: created.outcome,
    };
  } catch {
    return null;
  }
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
  try {
    if (destinationColonyId !== null &&
      (typeof destinationColonyId !== "string" || destinationColonyId.length === 0)) return null;
    const preparedRecord = exactOwnData(pending, PREPARED_RESOLUTION_KEYS);
    if (preparedRecord !== null) {
      if (typeof preparedRecord.originColonyId !== "string" || preparedRecord.originColonyId.length === 0 ||
        typeof preparedRecord.nodeId !== "string" || preparedRecord.nodeId.length === 0 ||
        !isCanonicalCompletionSave(preparedRecord.baseSave) ||
        !isCanonicalCompletionSave(preparedRecord.projectedSave) ||
        !isCanonicalCompletionSave(preparedRecord.preparedSave) ||
        preparedRecord.outcome !== null ||
        !sameDurableData(preparedRecord.baseSave, preparedRecord.projectedSave)) return null;
      const submittedEnvelope = snapshotDurableData(preparedRecord.preparedEnvelope);
      const recoveredEnvelope = recoverLegacyPreparedOutcome(preparedRecord.preparedSave);
      if (submittedEnvelope === INVALID_DURABLE_SNAPSHOT || recoveredEnvelope === null ||
        !sameDurableData(submittedEnvelope, recoveredEnvelope) ||
        recoveredEnvelope.routeIdentity.kind !== "poi" ||
        recoveredEnvelope.routeIdentity.originColonyId !== preparedRecord.originColonyId ||
        recoveredEnvelope.routeIdentity.nodeId !== preparedRecord.nodeId) return null;
      return {
        ok: true as const,
        save: preparedRecord.preparedSave,
        delivery: null,
        envelope: createOutcomeEnvelope(recoveredEnvelope, "success", {
          version: 2,
          kind: "poi_result_v2",
          destinationColonyId,
        }),
      };
    }

    const pendingRecord = exactOwnData(pending, PENDING_RESOLUTION_KEYS);
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

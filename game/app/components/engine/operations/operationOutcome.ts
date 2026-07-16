import {
  applyExplicitMissionDelivery,
  deliveryPayloadForPlanet,
  missionDeliveryEvent,
  type MissionDelivery,
} from "../../colony/shared/missionDelivery";
import { calcPilotLevel, skillPointsAtLevel } from "../pilotLevel";
import { getNode } from "../skillTree";
import type { SaveData } from "../types";
import {
  advanceGalaxyWorldCycles,
  mergeProjectionIntoGalaxy,
  projectGalaxyRunToLegacySave,
  type GalaxyProjectionDelta,
} from "../galaxy/galaxyProjection";
import type {
  AtlasKnowledgeRecord,
  GalaxyRunState,
  HistoricalFact,
} from "../galaxy/galaxyTypes";
import { resolveTravelInterruption } from "../galaxy/travelResolver";
import {
  authorizeOperationLaunch,
  evaluateOperationModifier,
  getOperation,
  sameOperationLaunchContext,
  snapshotOperationLaunchContext,
} from "./operationCatalog";
import type {
  Operation,
  OperationId,
  OperationLaunchContext,
  OperationOutcomeDefinition,
} from "./operationTypes";

export type OperationResultKind = "success" | "failure" | "retreat";

export interface OperationEngineResult {
  completionId: string;
  result: OperationResultKind;
  metrics: { frameCount: number } | null;
}

/** Exact catalog-derived payload accepted by the journal reducer. */
export interface NormalizedOperationOutcome {
  completionId: string;
  operationId: OperationId;
  result: OperationResultKind;
  authorizedCycle: number;
  contactId: string | null;
  causeFactIds: string[];
  travelTransactionId: string | null;
  metrics: OperationEngineResult["metrics"];
  modifierIds: string[];
  rewards: OperationOutcomeDefinition;
}

export type OperationOutcomeErrorCode =
  | "missing_galaxy_run"
  | "malformed_run"
  | "invalid_engine_result"
  | "context_mismatch"
  | "unknown_operation"
  | "unknown_cause_fact"
  | "unknown_contact"
  | "unknown_modifier"
  | "unknown_reward_field"
  | "invalid_outcome"
  | "invalid_operation_state"
  | "duplicate_unique_fact"
  | "incoherent_completion_journal"
  | "cycle_advance_failed"
  | "mission_delivery_failed"
  | "projection_merge_failed"
  | "travel_resolution_failed";

export interface OperationOutcomeError {
  code: OperationOutcomeErrorCode;
  message: string;
}

export type OperationOutcomeNormalizationResult =
  | { ok: true; outcome: NormalizedOperationOutcome }
  | { ok: false; errors: OperationOutcomeError[] };

export type OperationOutcomeApplyResult =
  | {
      ok: true;
      changed: boolean;
      save: SaveData;
      galaxyRun: GalaxyRunState;
      delivery: MissionDelivery | null;
    }
  | { ok: false; changed: false; errors: OperationOutcomeError[] };

type UnknownRecord = Record<string, unknown>;

const ENGINE_RESULT_KEYS = ["completionId", "result", "metrics"] as const;
const METRIC_KEYS = ["frameCount"] as const;
const OUTCOME_KEYS = [
  "completionId",
  "operationId",
  "result",
  "authorizedCycle",
  "contactId",
  "causeFactIds",
  "travelTransactionId",
  "metrics",
  "modifierIds",
  "rewards",
] as const;
const REWARD_KEYS = [
  "supply",
  "credits",
  "pilotXp",
  "storyItemIds",
  "knowledge",
  "accessFactIds",
  "historyKinds",
  "missionDelivery",
  "travelResolution",
  "strandedAt",
  "returnToOrigin",
] as const;
const KNOWLEDGE_KEYS = ["subjectId", "state", "confidence"] as const;
const DELIVERY_KEYS = ["planetId", "colonyId", "reason"] as const;
const COORDINATE_KEYS = ["sectorX", "sectorY", "localX", "localY"] as const;

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isPlainRecord(value: unknown): value is UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactOwnData(
  value: unknown,
  expectedKeys: readonly string[],
): UnknownRecord | null {
  if (!isPlainRecord(value)) return null;
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
  ) return null;
  const snapshot: UnknownRecord = {};
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor) || typeof descriptor.value === "function") {
      return null;
    }
    snapshot[key] = descriptor.value;
  }
  return snapshot;
}

function denseArray(value: unknown): unknown[] | null {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== value.length + 1 ||
    keys.some((key) => key !== "length" && (
      typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length
    ))
  ) return null;
  const snapshot: unknown[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !("value" in descriptor) || typeof descriptor.value === "function") {
      return null;
    }
    snapshot.push(descriptor.value);
  }
  return snapshot;
}

function stringArray(value: unknown): string[] | null {
  const snapshot = denseArray(value);
  return snapshot !== null && snapshot.every((entry) => typeof entry === "string")
    ? snapshot as string[]
    : null;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function sameData(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (
    typeof left !== "object" || left === null ||
    typeof right !== "object" || right === null
  ) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((entry, index) => sameData(entry, right[index]));
  }
  const leftRecord = left as UnknownRecord;
  const rightRecord = right as UnknownRecord;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) =>
    key === rightKeys[index] && hasOwn(rightRecord, key) && sameData(leftRecord[key], rightRecord[key]));
}

function failed(
  code: OperationOutcomeErrorCode,
  message: string,
): { ok: false; changed: false; errors: OperationOutcomeError[] } {
  return { ok: false, changed: false, errors: [{ code, message }] };
}

function normalizationFailed(
  code: OperationOutcomeErrorCode,
  message: string,
): OperationOutcomeNormalizationResult {
  return { ok: false, errors: [{ code, message }] };
}

function validCompletionId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 160 &&
    /^[A-Za-z0-9][A-Za-z0-9:._-]*$/.test(value);
}

function snapshotEngineResult(value: unknown): OperationEngineResult | null {
  const result = exactOwnData(value, ENGINE_RESULT_KEYS);
  if (result === null || !validCompletionId(result.completionId) ||
    (result.result !== "success" && result.result !== "failure" && result.result !== "retreat")) {
    return null;
  }
  let metrics: OperationEngineResult["metrics"] = null;
  if (result.metrics !== null) {
    const rawMetrics = exactOwnData(result.metrics, METRIC_KEYS);
    if (rawMetrics === null || !Number.isSafeInteger(rawMetrics.frameCount) ||
      (rawMetrics.frameCount as number) < 0) return null;
    metrics = { frameCount: rawMetrics.frameCount as number };
  }
  return {
    completionId: result.completionId,
    result: result.result,
    metrics,
  } as OperationEngineResult;
}

function snapshotMetrics(value: unknown): OperationEngineResult["metrics"] | undefined {
  if (value === null) return null;
  const rawMetrics = exactOwnData(value, METRIC_KEYS);
  if (rawMetrics === null || !Number.isSafeInteger(rawMetrics.frameCount) ||
    (rawMetrics.frameCount as number) < 0) return undefined;
  return { frameCount: rawMetrics.frameCount as number };
}

function snapshotRewards(value: unknown): OperationOutcomeDefinition | null {
  const reward = exactOwnData(value, REWARD_KEYS);
  if (reward === null) return null;
  const storyItemIds = stringArray(reward.storyItemIds);
  const accessFactIds = stringArray(reward.accessFactIds);
  const historyKinds = stringArray(reward.historyKinds);
  const rawKnowledge = denseArray(reward.knowledge);
  if (
    !Number.isSafeInteger(reward.supply) || (reward.supply as number) < 0 ||
    !Number.isSafeInteger(reward.credits) || (reward.credits as number) < 0 ||
    !Number.isSafeInteger(reward.pilotXp) || (reward.pilotXp as number) < 0 ||
    storyItemIds === null || accessFactIds === null || historyKinds === null || rawKnowledge === null ||
    !["cleared", "failed", "retreated", "none"].includes(String(reward.travelResolution)) ||
    typeof reward.returnToOrigin !== "boolean"
  ) return null;

  const knowledge: OperationOutcomeDefinition["knowledge"] = [];
  for (const raw of rawKnowledge) {
    const entry = exactOwnData(raw, KNOWLEDGE_KEYS);
    if (entry === null || typeof entry.subjectId !== "string" ||
      !["unknown", "signal", "charted", "visited", "lost_contact"].includes(String(entry.state)) ||
      !["low", "medium", "high"].includes(String(entry.confidence))) return null;
    knowledge.push({
      subjectId: entry.subjectId,
      state: entry.state as OperationOutcomeDefinition["knowledge"][number]["state"],
      confidence: entry.confidence as OperationOutcomeDefinition["knowledge"][number]["confidence"],
    });
  }

  let missionDelivery: OperationOutcomeDefinition["missionDelivery"] = null;
  if (reward.missionDelivery !== null) {
    const delivery = exactOwnData(reward.missionDelivery, DELIVERY_KEYS);
    if (delivery === null || delivery.planetId !== "ashfall" ||
      delivery.colonyId !== "galaxy:ashfall-primary" || delivery.reason !== "mission_delivery") return null;
    missionDelivery = {
      planetId: "ashfall",
      colonyId: "galaxy:ashfall-primary",
      reason: "mission_delivery",
    };
  }

  let strandedAt: OperationOutcomeDefinition["strandedAt"] = null;
  if (reward.strandedAt !== null) {
    const coordinate = exactOwnData(reward.strandedAt, COORDINATE_KEYS);
    if (coordinate === null || COORDINATE_KEYS.some((key) => !Number.isSafeInteger(coordinate[key]))) {
      return null;
    }
    strandedAt = {
      sectorX: coordinate.sectorX as number,
      sectorY: coordinate.sectorY as number,
      localX: coordinate.localX as number,
      localY: coordinate.localY as number,
    };
  }

  return {
    supply: reward.supply as number,
    credits: reward.credits as number,
    pilotXp: reward.pilotXp as number,
    storyItemIds: storyItemIds as OperationOutcomeDefinition["storyItemIds"],
    knowledge,
    accessFactIds,
    historyKinds,
    missionDelivery,
    travelResolution: reward.travelResolution as OperationOutcomeDefinition["travelResolution"],
    strandedAt,
    returnToOrigin: reward.returnToOrigin,
  };
}

function snapshotNormalizedOutcome(value: unknown):
  | { ok: true; outcome: NormalizedOperationOutcome }
  | { ok: false; code: OperationOutcomeErrorCode } {
  try {
    const outcome = exactOwnData(value, OUTCOME_KEYS);
    if (outcome === null) return { ok: false, code: "invalid_outcome" };
    const causeFactIds = stringArray(outcome.causeFactIds);
    const modifierIds = stringArray(outcome.modifierIds);
    const rewards = snapshotRewards(outcome.rewards);
    const metrics = snapshotMetrics(outcome.metrics);
    if (rewards === null) return { ok: false, code: "unknown_reward_field" };
    if (
      !validCompletionId(outcome.completionId) ||
      typeof outcome.operationId !== "string" || outcome.operationId.length === 0 ||
      (outcome.result !== "success" && outcome.result !== "failure" && outcome.result !== "retreat") ||
      !Number.isSafeInteger(outcome.authorizedCycle) || (outcome.authorizedCycle as number) < 0 ||
      !(outcome.contactId === null || typeof outcome.contactId === "string") ||
      !(outcome.travelTransactionId === null || typeof outcome.travelTransactionId === "string") ||
      causeFactIds === null || modifierIds === null ||
      metrics === undefined ||
      new Set(causeFactIds).size !== causeFactIds.length ||
      new Set(modifierIds).size !== modifierIds.length
    ) return { ok: false, code: "invalid_outcome" };
    return {
      ok: true,
      outcome: {
        completionId: outcome.completionId,
        operationId: outcome.operationId as OperationId,
        result: outcome.result,
        authorizedCycle: outcome.authorizedCycle as number,
        contactId: outcome.contactId as string | null,
        causeFactIds,
        travelTransactionId: outcome.travelTransactionId as string | null,
        metrics,
        modifierIds,
        rewards,
      } as NormalizedOperationOutcome,
    };
  } catch {
    return { ok: false, code: "invalid_outcome" };
  }
}

function rewardFor(operation: Operation, result: OperationResultKind): OperationOutcomeDefinition {
  switch (result) {
    case "success": return clone(operation.rewards.success);
    case "failure": return clone(operation.rewards.failure);
    case "retreat": return clone(operation.rewards.retreat);
  }
}

/** Translate a guarded engine result into immutable catalog-owned rewards. */
export function normalizeOperationOutcome(
  run: GalaxyRunState,
  context: OperationLaunchContext,
  engineResult: OperationEngineResult,
): OperationOutcomeNormalizationResult {
  try {
    const safeResult = snapshotEngineResult(engineResult);
    if (safeResult === null) {
      return normalizationFailed("invalid_engine_result", "Operation engine result is not exact safe data.");
    }
    const safeContext = snapshotOperationLaunchContext(context);
    if (safeContext === null) {
      return normalizationFailed("context_mismatch", "Operation launch context is malformed.");
    }
    const authorization = authorizeOperationLaunch(run, safeContext.operationId);
    if (!authorization.ok || !sameOperationLaunchContext(authorization.context, safeContext)) {
      return normalizationFailed("context_mismatch", "Operation result is not bound to current launch authority.");
    }
    if (safeContext.operationId !== "op:hostile-picket" && safeResult.metrics !== null) {
      return normalizationFailed("invalid_engine_result", "This operation does not declare engine metrics.");
    }

    const rewards = rewardFor(authorization.operation, safeResult.result);
    const modifierIds: string[] = [];
    if (
      safeResult.result === "success" &&
      safeContext.operationId === "op:hostile-picket" &&
      safeResult.metrics !== null
    ) {
      for (const modifier of authorization.operation.modifiers) {
        const evaluation = evaluateOperationModifier(modifier, safeResult.metrics);
        if (evaluation.met) {
          modifierIds.push(modifier.id);
          rewards.credits += evaluation.credits;
        }
      }
    }
    return {
      ok: true,
      outcome: {
        completionId: safeResult.completionId,
        operationId: safeContext.operationId,
        result: safeResult.result,
        authorizedCycle: safeContext.authorizedCycle,
        contactId: safeContext.contactId,
        causeFactIds: clone(safeContext.causeFactIds),
        travelTransactionId: safeContext.travelTransactionId,
        metrics: safeResult.metrics,
        modifierIds,
        rewards,
      },
    };
  } catch {
    return normalizationFailed("malformed_run", "Operation result could not safely inspect the galaxy run.");
  }
}

function expectedRewards(
  operation: Operation,
  outcome: NormalizedOperationOutcome,
): OperationOutcomeDefinition | null {
  const expected = rewardFor(operation, outcome.result);
  if (operation.id !== "op:hostile-picket" && outcome.metrics !== null) return null;
  const expectedModifierIds: string[] = [];
  if (outcome.result === "success" && outcome.metrics !== null) {
    for (const modifier of operation.modifiers) {
      const evaluation = evaluateOperationModifier(modifier, outcome.metrics);
      if (evaluation.met) {
        expectedModifierIds.push(modifier.id);
        expected.credits += evaluation.credits;
      }
    }
  }
  if (!sameData(expectedModifierIds, outcome.modifierIds)) return null;
  return expected;
}

function pilotSkillPoints(run: GalaxyRunState, level: number): number | null {
  let spent = 0;
  for (const skillId of run.pilot.allocatedSkills) {
    const node = getNode(skillId);
    if (node === undefined) return null;
    spent += node.cost;
  }
  return Math.max(0, skillPointsAtLevel(level) - spent);
}

function findCauseProblem(run: GalaxyRunState, outcome: NormalizedOperationOutcome): OperationOutcomeError | null {
  for (const causeId of outcome.causeFactIds) {
    const matches = run.historyFacts.filter((fact) => fact.id === causeId);
    if (
      matches.length !== 1 ||
      matches[0].subjectId !== outcome.contactId
    ) {
      return { code: "unknown_cause_fact", message: `Cause ${causeId} is not bound to the operation contact.` };
    }
  }
  return null;
}

function duplicateUniqueProblem(
  run: GalaxyRunState,
  outcome: NormalizedOperationOutcome,
): boolean {
  return outcome.rewards.storyItemIds.some((item) => run.storyItems.includes(item)) ||
    outcome.rewards.accessFactIds.some((id) => run.atlas.accessFacts.some((fact) => fact.id === id)) ||
    outcome.rewards.historyKinds.some((kind) => run.historyFacts.some((fact) =>
      fact.kind === kind && fact.subjectId === outcome.operationId));
}

type CompletionJournalStatus =
  | { kind: "new" }
  | { kind: "replay" }
  | { kind: "error"; message: string };

function completionJournalStatus(
  run: GalaxyRunState,
  outcome: NormalizedOperationOutcome,
): CompletionJournalStatus {
  if (!Array.isArray(run.appliedOutcomeIds)) {
    return { kind: "error", message: "The global completion journal is malformed." };
  }
  const globalOccurrences = run.appliedOutcomeIds.filter((id) => id === outcome.completionId).length;
  const owners: Array<{ operationId: string; occurrences: number }> = [];
  for (const [operationId, rawRecord] of Object.entries(run.operations)) {
    if (!isPlainRecord(rawRecord) || !Array.isArray(rawRecord.completionIds) ||
      !rawRecord.completionIds.every((id) => typeof id === "string")) {
      return { kind: "error", message: "An operation completion journal is malformed." };
    }
    const occurrences = rawRecord.completionIds.filter((id) => id === outcome.completionId).length;
    if (occurrences > 0) owners.push({ operationId, occurrences });
  }
  if (globalOccurrences === 0 && owners.length === 0) return { kind: "new" };
  if (
    globalOccurrences !== 1 ||
    owners.length !== 1 ||
    owners[0].operationId !== outcome.operationId ||
    owners[0].occurrences !== 1
  ) {
    return {
      kind: "error",
      message: "Completion ID does not have one coherent global and operation owner.",
    };
  }
  return { kind: "replay" };
}

function incoherentReplay(message: string): OperationOutcomeError {
  return { code: "incoherent_completion_journal", message };
}

function replayArtifactProblem(
  run: GalaxyRunState,
  operation: Operation,
  outcome: NormalizedOperationOutcome,
  record: GalaxyRunState["operations"][string],
): OperationOutcomeError | null {
  const expectedState = outcome.result === "success" ? "complete" : "failed";
  const expectedResolvedCycle = outcome.authorizedCycle + operation.costs.worldCycles;
  if (
    record.state !== expectedState ||
    record.acceptedCycle === null ||
    record.acceptedCycle > outcome.authorizedCycle ||
    !Number.isSafeInteger(expectedResolvedCycle) ||
    record.resolvedCycle !== expectedResolvedCycle
  ) {
    return incoherentReplay("Resolved operation state does not match the submitted completion.");
  }

  const historyPrefix = `history:outcome:${outcome.completionId}:`;
  const completionHistory = run.historyFacts.filter((fact) => fact.id.startsWith(historyPrefix));
  if (completionHistory.length !== outcome.rewards.historyKinds.length) {
    return incoherentReplay("Completion history does not match the catalog outcome.");
  }
  for (let index = 0; index < outcome.rewards.historyKinds.length; index += 1) {
    const id = `${historyPrefix}${index}`;
    const matches = completionHistory.filter((fact) => fact.id === id);
    if (
      matches.length !== 1 ||
      matches[0].kind !== outcome.rewards.historyKinds[index] ||
      matches[0].subjectId !== outcome.operationId ||
      matches[0].cycle !== record.resolvedCycle ||
      !sameData(matches[0].causeFactIds, outcome.causeFactIds)
    ) {
      return incoherentReplay(`History artifact ${id} does not match the submitted completion.`);
    }
  }

  const knowledgePrefix = `knowledge:outcome:${outcome.completionId}:`;
  const completionKnowledge = Object.entries(run.atlas.knowledge).filter(([, knowledge]) =>
    knowledge.id.startsWith(knowledgePrefix) ||
    knowledge.observedProperties?.completionId === outcome.completionId);
  if (completionKnowledge.length !== outcome.rewards.knowledge.length) {
    return incoherentReplay("Completion knowledge does not match the catalog outcome.");
  }
  for (let index = 0; index < outcome.rewards.knowledge.length; index += 1) {
    const id = `${knowledgePrefix}${index}`;
    const reward = outcome.rewards.knowledge[index];
    const matches = completionKnowledge.filter(([dictionaryKey, knowledge]) =>
      dictionaryKey === id && knowledge.id === id);
    if (
      matches.length !== 1 ||
      matches[0][1].subjectId !== reward.subjectId ||
      matches[0][1].state !== reward.state ||
      matches[0][1].confidence !== reward.confidence ||
      matches[0][1].source !== "direct_visit" ||
      matches[0][1].observedCycle !== record.resolvedCycle ||
      matches[0][1].expiresCycle !== null ||
      !sameData(matches[0][1].observedProperties, {
        operationId: outcome.operationId,
        completionId: outcome.completionId,
      })
    ) {
      return incoherentReplay(`Knowledge artifact ${id} does not match the submitted completion.`);
    }
  }

  for (const accessId of outcome.rewards.accessFactIds) {
    const matches = run.atlas.accessFacts.filter((fact) => fact.id === accessId);
    if (
      matches.length !== 1 ||
      matches[0].subjectId !== outcome.contactId ||
      matches[0].assessment !== "secured" ||
      matches[0].cycle !== record.resolvedCycle ||
      !sameData(matches[0].causeFactIds, outcome.causeFactIds)
    ) {
      return incoherentReplay(`Access artifact ${accessId} does not match the submitted completion.`);
    }
  }

  for (const storyItemId of outcome.rewards.storyItemIds) {
    if (run.storyItems.filter((item) => item === storyItemId).length !== 1) {
      return incoherentReplay(`Story artifact ${storyItemId} does not match the submitted completion.`);
    }
  }

  if (outcome.rewards.travelResolution !== "none" && run.activeTravel !== null) {
    if (
      outcome.travelTransactionId === null ||
      run.activeTravel.transactionId !== outcome.travelTransactionId
    ) {
      return incoherentReplay("Retained travel does not own the operation completion.");
    }
    const sharedCheckpoint = `${outcome.travelTransactionId}:operation-outcome:${outcome.completionId}`;
    const completionSuffix = `:operation-outcome:${outcome.completionId}`;
    const sharedMatches = run.activeTravel.appliedCheckpointIds.filter((id) => id === sharedCheckpoint);
    const completionMatches = run.activeTravel.appliedCheckpointIds.filter((id) =>
      id.endsWith(completionSuffix));
    const interruptionCheckpoint = `${outcome.travelTransactionId}:interruption:${outcome.rewards.travelResolution}`;
    if (
      sharedMatches.length !== 1 ||
      completionMatches.length !== 1 ||
      !run.activeTravel.appliedCheckpointIds.includes(interruptionCheckpoint)
    ) {
      return incoherentReplay("Retained travel is missing its exact shared operation-outcome checkpoint.");
    }
  }

  return null;
}

function applyOutcomeImpl(
  parent: SaveData,
  submitted: NormalizedOperationOutcome,
): OperationOutcomeApplyResult {
  let safeParent: SaveData;
  try {
    safeParent = clone(parent);
  } catch {
    return failed("malformed_run", "Operation outcome parent save is not safe serializable data.");
  }
  const run = safeParent.galaxyRun;
  if (run === null) return failed("missing_galaxy_run", "Cannot fold an operation without a galaxy run.");
  const snapshot = snapshotNormalizedOutcome(submitted);
  if (!snapshot.ok) {
    return failed(snapshot.code, snapshot.code === "unknown_reward_field"
      ? "Operation reward contains unknown or malformed fields."
      : "Normalized operation outcome is malformed.");
  }
  const outcome = snapshot.outcome;
  const lookup = getOperation(run, outcome.operationId);
  if (!lookup.ok && lookup.operation === null) {
    return failed("unknown_operation", "Operation outcome references an unknown operation.");
  }
  if (lookup.operation === null) return failed("malformed_run", "Operation catalog could not inspect the saved record.");
  const operation = lookup.operation;
  if (outcome.contactId !== operation.contactId) {
    return failed("unknown_contact", "Operation outcome contact does not match the catalog.");
  }
  if (!sameData(outcome.causeFactIds, operation.causeFactIds)) {
    return failed("unknown_cause_fact", "Operation outcome causes do not match the catalog.");
  }
  const causeProblem = findCauseProblem(run, outcome);
  if (causeProblem !== null) return failed(causeProblem.code, causeProblem.message);
  const expected = expectedRewards(operation, outcome);
  if (expected === null) return failed("unknown_modifier", "Operation outcome references an unknown modifier.");
  if (!sameData(expected, outcome.rewards)) {
    return failed("unknown_reward_field", "Operation rewards differ from the versioned catalog.");
  }
  if (outcome.authorizedCycle > run.worldCycle) {
    return failed("invalid_outcome", "Operation authorization cycle is in the future.");
  }
  const record = run.operations[outcome.operationId];
  if (record === undefined) return failed("malformed_run", "Operation record is missing.");
  const journal = completionJournalStatus(run, outcome);
  if (journal.kind === "error") {
    return failed("incoherent_completion_journal", journal.message);
  }
  if (journal.kind === "replay") {
    const replayProblem = replayArtifactProblem(run, operation, outcome, record);
    if (replayProblem !== null) return failed(replayProblem.code, replayProblem.message);
    return {
      ok: true,
      changed: false,
      save: parent,
      galaxyRun: parent.galaxyRun!,
      delivery: null,
    };
  }
  if (outcome.operationId === "op:hostile-picket") {
    if (outcome.travelTransactionId === null || run.activeTravel?.transactionId !== outcome.travelTransactionId) {
      return failed("context_mismatch", "Picket outcome is not bound to its travel interruption.");
    }
  } else if (outcome.travelTransactionId !== null &&
    run.activeTravel?.transactionId !== outcome.travelTransactionId) {
    return failed("context_mismatch", "Operation outcome travel journal no longer matches launch authority.");
  }
  if (duplicateUniqueProblem(run, outcome)) {
    return failed("duplicate_unique_fact", "Operation would duplicate a unique galaxy fact or reward.");
  }
  const currentAuthorization = authorizeOperationLaunch(run, outcome.operationId);
  if (!currentAuthorization.ok) {
    if (currentAuthorization.availability.reasons.includes("missing_contact")) {
      return failed("unknown_contact", "The operation contact is no longer a unique authored Atlas fact.");
    }
    if (currentAuthorization.availability.reasons.includes("missing_cause_fact")) {
      return failed("unknown_cause_fact", "The operation cause is no longer present and bound to its contact.");
    }
    if (currentAuthorization.availability.reasons.some((reason) =>
      reason === "operation_resolved" || reason === "invalid_operation_state")) {
      return failed("invalid_operation_state", "Only an unresolved operation can accept a new completion.");
    }
    return failed("context_mismatch", "Saved operation launch authority changed before completion.");
  }
  if (
    currentAuthorization.context.authorizedCycle !== outcome.authorizedCycle ||
    currentAuthorization.context.contactId !== outcome.contactId ||
    currentAuthorization.context.travelTransactionId !== outcome.travelTransactionId ||
    !sameData(currentAuthorization.context.causeFactIds, outcome.causeFactIds)
  ) {
    return failed("context_mismatch", "Normalized outcome no longer matches current launch authority.");
  }
  if (record.state !== "available" && record.state !== "accepted" && record.state !== "active") {
    return failed("invalid_operation_state", "Only an unresolved operation can accept a new completion.");
  }

  const advanced = advanceGalaxyWorldCycles(run, operation.costs.worldCycles);
  if (!advanced.ok) {
    return failed("cycle_advance_failed", advanced.errors.map((entry) => entry.message).join("; "));
  }
  let current = advanced.galaxyRun;
  let delivery: MissionDelivery | null = null;
  let deliveredColonies: GalaxyProjectionDelta["colonies"];
  if (outcome.rewards.missionDelivery !== null) {
    const definition = outcome.rewards.missionDelivery;
    const projectionParent = { ...safeParent, galaxyRun: current };
    let projection: SaveData;
    try {
      projection = projectGalaxyRunToLegacySave(projectionParent);
    } catch {
      return failed("mission_delivery_failed", "Ashfall delivery projection could not be created.");
    }
    const applied = applyExplicitMissionDelivery(
      projection,
      definition.colonyId,
      deliveryPayloadForPlanet(definition.planetId),
    );
    const deliveryEvent = applied.delivery === null
      ? null
      : missionDeliveryEvent(applied.delivery);
    if (deliveryEvent === null || deliveryEvent.type !== "colony/resourceChanged" ||
      deliveryEvent.payload.reason !== definition.reason) {
      return failed("mission_delivery_failed", "Authored Ashfall delivery could not reach its galaxy colony.");
    }
    delivery = applied.delivery;
    deliveredColonies = applied.save.colonies;
  }

  const nextXp = current.pilot.xp + outcome.rewards.pilotXp;
  const nextSupply = current.resources.supply + outcome.rewards.supply;
  const nextCredits = current.resources.credits + outcome.rewards.credits;
  if (![nextXp, nextSupply, nextCredits].every(Number.isSafeInteger)) {
    return failed("invalid_outcome", "Operation reward would overflow saved integer bounds.");
  }
  const nextLevel = calcPilotLevel(nextXp);
  const nextSkillPoints = pilotSkillPoints(current, nextLevel);
  if (nextSkillPoints === null) return failed("malformed_run", "Saved pilot skills are not recognized.");
  const delta: GalaxyProjectionDelta = {
    resources: {
      supply: nextSupply,
      credits: nextCredits,
      materials: clone(current.resources.materials),
    },
    pilot: {
      xp: nextXp,
      level: nextLevel,
      skillPoints: nextSkillPoints,
      allocatedSkills: clone(current.pilot.allocatedSkills),
    },
    storyItems: [...current.storyItems, ...clone(outcome.rewards.storyItemIds)],
    ...(deliveredColonies === undefined ? {} : { colonies: deliveredColonies }),
  };
  const merged = mergeProjectionIntoGalaxy(current, delta);
  if (!merged.ok) {
    return failed("projection_merge_failed", merged.errors.map((entry) => entry.message).join("; "));
  }
  current = merged.galaxyRun;

  const candidate = clone(current);
  const resolvedCycle = candidate.worldCycle;
  for (let index = 0; index < outcome.rewards.knowledge.length; index += 1) {
    const reward = outcome.rewards.knowledge[index];
    const recordId = `knowledge:outcome:${outcome.completionId}:${index}`;
    if (hasOwn(candidate.atlas.knowledge, recordId)) {
      return failed("duplicate_unique_fact", `Knowledge record ${recordId} already exists.`);
    }
    const knowledge: AtlasKnowledgeRecord = {
      id: recordId,
      subjectId: reward.subjectId,
      state: reward.state,
      observedProperties: {
        operationId: outcome.operationId,
        completionId: outcome.completionId,
      },
      confidence: reward.confidence,
      source: "direct_visit",
      observedCycle: resolvedCycle,
      expiresCycle: null,
    };
    candidate.atlas.knowledge[recordId] = knowledge;
  }
  for (const accessId of outcome.rewards.accessFactIds) {
    candidate.atlas.accessFacts.push({
      id: accessId,
      subjectId: outcome.contactId!,
      assessment: "secured",
      causeFactIds: clone(outcome.causeFactIds),
      cycle: resolvedCycle,
    });
  }
  for (let index = 0; index < outcome.rewards.historyKinds.length; index += 1) {
    const history: HistoricalFact = {
      id: `history:outcome:${outcome.completionId}:${index}`,
      kind: outcome.rewards.historyKinds[index],
      subjectId: outcome.operationId,
      cycle: resolvedCycle,
      causeFactIds: clone(outcome.causeFactIds),
    };
    if (candidate.historyFacts.some((fact) => fact.id === history.id)) {
      return failed("duplicate_unique_fact", `History fact ${history.id} already exists.`);
    }
    candidate.historyFacts.push(history);
  }
  candidate.operations[outcome.operationId] = {
    state: outcome.result === "success" ? "complete" : "failed",
    acceptedCycle: record.acceptedCycle ?? outcome.authorizedCycle,
    resolvedCycle,
    completionIds: [...record.completionIds, outcome.completionId],
  };
  candidate.appliedOutcomeIds.push(outcome.completionId);

  let resolved = candidate;
  if (outcome.rewards.travelResolution !== "none") {
    const travel = resolveTravelInterruption(
      candidate,
      outcome.operationId,
      outcome.rewards.travelResolution,
    );
    if (!travel.ok) {
      return failed("travel_resolution_failed", travel.errors.map((entry) => entry.message).join("; "));
    }
    resolved = travel.galaxyRun;
    if (resolved.activeTravel === null || outcome.travelTransactionId === null ||
      resolved.activeTravel.transactionId !== outcome.travelTransactionId) {
      return failed("travel_resolution_failed", "Travel closure lost its shared operation completion journal.");
    }
    const sharedCheckpoint = `${outcome.travelTransactionId}:operation-outcome:${outcome.completionId}`;
    if (resolved.activeTravel.appliedCheckpointIds.includes(sharedCheckpoint)) {
      return failed("incoherent_completion_journal", "Travel already contains this operation completion ID.");
    }
    resolved = clone(resolved);
    resolved.activeTravel!.appliedCheckpointIds.push(sharedCheckpoint);
  }
  const save = { ...safeParent, galaxyRun: resolved };
  return { ok: true, changed: true, save, galaxyRun: resolved, delivery };
}

/** Validate and journal one normalized operation outcome without touching legacy state. */
export function applyOperationOutcome(
  parent: SaveData,
  outcome: NormalizedOperationOutcome,
): OperationOutcomeApplyResult {
  try {
    return applyOutcomeImpl(parent, outcome);
  } catch {
    return failed("malformed_run", "Operation outcome could not safely inspect or copy submitted state.");
  }
}

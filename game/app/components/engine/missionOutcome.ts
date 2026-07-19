import { OUTCOME_JOURNAL_LIMIT, OUTCOME_RECOVERY_LIMIT } from "./save";
import type {
  AppliedOutcomeReturnRecord,
  OutcomeAttempt,
  OutcomeRecoveryRecord,
  OutcomeRouteKind,
  OutcomeTerminalKind,
  SaveData,
  SerializedOutcomeEnvelope,
} from "./types";
import {
  dynamicOutcomeRouteIdentityIsCanonical,
  outcomeRouteIdentityFromLaunch,
  outcomeAuthorityReturnMatches,
  poiOutcomeMissionId,
  snapshotOutcomeRouteIdentity,
  type LaunchContext,
  type PoiOutcomeRouteInput,
} from "./missionContext";
import { foldMissionOutcome, outcomeAttemptFields, outcomeEnvelopeFields } from "./missionOutcomeFolds";
import { snapshotGalaxyOutcomeAuthority } from "./outcomeJournalAuthority";

export type OutcomeDeclaredField = Exclude<
  keyof SaveData,
  "saveRevision" | "appliedOutcomeIds" | "outcomeRecoveryRecords"
>;

export interface CanonicalSaveStore {
  read: () => SaveData;
  write: (save: SaveData) => void;
}

export type CommitOutcomeResult =
  | { status: "committed"; save: SaveData }
  | { status: "already_applied"; save: SaveData }
  | { status: "conflict"; latest: SaveData }
  | { status: "write_failed"; error: Error };

const TERMINAL_KINDS = new Set<OutcomeTerminalKind>(["success", "failure", "retreat"]);
const ROUTE_KINDS = new Set<OutcomeRouteKind>(["campaign", "planet", "special", "operation", "colony", "poi"]);
const METADATA_FIELDS = new Set(["saveRevision", "appliedOutcomeIds", "outcomeRecoveryRecords"]);
const LEGACY_POI_FIELDS: readonly OutcomeDeclaredField[] = [
  "colonies", "planets", "missionsSinceStart",
];

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

function snapshotDenseArray(value: unknown): unknown[] | null {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (lengthDescriptor === undefined || !("value" in lengthDescriptor) ||
      !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0) return null;
    const length = lengthDescriptor.value as number;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== length + 1 || keys.some((key) => key !== "length" &&
      (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length))) return null;
    const snapshot: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !("value" in descriptor)) return null;
      snapshot.push(descriptor.value);
    }
    return snapshot;
  } catch {
    return null;
  }
}

function snapshotStringJournal(value: unknown): string[] | null {
  const snapshot = snapshotDenseArray(value);
  return snapshot !== null && snapshot.every((entry) => typeof entry === "string" && entry.length > 0) &&
    new Set(snapshot).size === snapshot.length
    ? snapshot as string[]
    : null;
}

function isPlainSerializable(value: unknown, ancestors = new Set<object>()): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || ancestors.has(value)) return false;
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const snapshot = snapshotDenseArray(value);
      return snapshot !== null && snapshot.every((entry) => isPlainSerializable(entry, ancestors));
    }
    const snapshot = ownDataRecord(value);
    return snapshot !== null && Object.values(snapshot).every((entry) => isPlainSerializable(entry, ancestors));
  } catch {
    return false;
  } finally {
    ancestors.delete(value);
  }
}

function sameData(left: unknown, right: unknown): boolean {
  try {
    if (Object.is(left, right)) return true;
    if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) return false;
    const leftIsArray = Array.isArray(left);
    const rightIsArray = Array.isArray(right);
    if (leftIsArray || rightIsArray) {
      if (!leftIsArray || !rightIsArray) return false;
      const leftArray = snapshotDenseArray(left);
      const rightArray = snapshotDenseArray(right);
      return leftArray !== null && rightArray !== null && leftArray.length === rightArray.length &&
        leftArray.every((entry, index) => sameData(entry, rightArray[index]));
    }
    const leftRecord = ownDataRecord(left);
    const rightRecord = ownDataRecord(right);
    if (leftRecord === null || rightRecord === null) return false;
    const leftKeys = Object.keys(leftRecord).sort();
    const rightKeys = Object.keys(rightRecord).sort();
    return leftKeys.length === rightKeys.length && leftKeys.every((key, index) =>
      key === rightKeys[index] && sameData(leftRecord[key], rightRecord[key]));
  } catch {
    return false;
  }
}

function withRootOverrides(save: SaveData, overrides: Partial<SaveData>): SaveData | null {
  try {
    const descriptors = Object.getOwnPropertyDescriptors(save);
    for (const [key, value] of Object.entries(overrides)) {
      descriptors[key] = { value, enumerable: true, configurable: true, writable: true };
    }
    return Object.create(Object.getPrototypeOf(save), descriptors) as SaveData;
  } catch {
    return null;
  }
}

interface ValidatedEnvelope {
  envelope: SerializedOutcomeEnvelope;
  fields: OutcomeDeclaredField[];
}

type OutcomeJournalStatus = "new" | "applied" | "conflict";

function snapshotGalaxyAuthorityFromSave(
  save: SaveData,
  rootOutcomeIds: readonly string[],
  recoveryRecords: readonly OutcomeRecoveryRecord[],
) {
  const saveData = requiredOwnData(save, ["galaxyRun"]);
  return saveData === null
    ? { ok: false as const, knownOutcomeIds: [], quarantinedOutcomeCount: 1 }
    : snapshotGalaxyOutcomeAuthority(
        saveData.galaxyRun,
        rootOutcomeIds,
        recoveryRecords,
        OUTCOME_JOURNAL_LIMIT,
      );
}

function outcomeJournalStatus(
  save: SaveData,
  outcome: SerializedOutcomeEnvelope,
  root: ValidatedOutcomeRoot,
): OutcomeJournalStatus {
  try {
    const galaxyAuthority = snapshotGalaxyAuthorityFromSave(
      save,
      root.appliedOutcomeIds,
      root.outcomeRecoveryRecords,
    );
    if (!galaxyAuthority.ok) return "conflict";
    const rootOccurrences = root.appliedOutcomeIds.filter((id) => id === outcome.outcomeId).length;
    if (outcome.persistenceAuthority !== "galaxy") {
      return rootOccurrences === 0 ? "new" : rootOccurrences === 1 ? "applied" : "conflict";
    }
    const nestedOccurrences = galaxyAuthority.nestedOutcomeIds.filter((id) => id === outcome.outcomeId).length;
    const owner = galaxyAuthority.operationOwners.get(outcome.outcomeId);
    if (outcome.routeKind === "operation") {
      if (outcome.routeIdentity.kind !== "operation") return "conflict";
      if (rootOccurrences === 0 && nestedOccurrences === 0 && owner === undefined) return "new";
      return rootOccurrences === 1 && nestedOccurrences === 1 && owner === outcome.routeIdentity.operationId
        ? "applied"
        : "conflict";
    }
    if (rootOccurrences === 0 && nestedOccurrences === 0 && owner === undefined) return "new";
    return rootOccurrences === 1 && nestedOccurrences === 1 && owner === undefined ? "applied" : "conflict";
  } catch {
    return "conflict";
  }
}

function validateEnvelope(value: unknown): ValidatedEnvelope | null {
  const envelope = exactOwnData(value, [
    "version", "routeKind", "missionId", "routeIdentity", "launchId", "expectedRevision", "persistenceAuthority",
    "returnTarget", "declaredFields", "launchSnapshot", "outcomeId", "terminalKind", "payload",
  ]);
  if (envelope === null || envelope.version !== 1 || !ROUTE_KINDS.has(envelope.routeKind as OutcomeRouteKind) ||
    typeof envelope.missionId !== "string" || envelope.missionId.length === 0 ||
    typeof envelope.launchId !== "string" || envelope.launchId.length === 0 ||
    !Number.isSafeInteger(envelope.expectedRevision) || (envelope.expectedRevision as number) < 0 ||
    !TERMINAL_KINDS.has(envelope.terminalKind as OutcomeTerminalKind) ||
    envelope.outcomeId !== `${envelope.launchId}:${envelope.terminalKind}` ||
    !Array.isArray(envelope.declaredFields) ||
    envelope.declaredFields.some((field) => typeof field !== "string" || field.length === 0 || METADATA_FIELDS.has(field)) ||
    new Set(envelope.declaredFields).size !== envelope.declaredFields.length) return null;
  const routeKind = envelope.routeKind as OutcomeRouteKind;
  if (!outcomeAuthorityReturnMatches(routeKind, envelope.persistenceAuthority, envelope.returnTarget)) return null;
  const identity = snapshotOutcomeRouteIdentity(envelope.routeIdentity, routeKind, envelope.missionId as string);
  if (identity === null) return null;
  const fields = envelope.declaredFields as OutcomeDeclaredField[];
  const expectedFields = outcomeEnvelopeFields(
    routeKind,
    envelope.persistenceAuthority as "legacy" | "galaxy",
    envelope.terminalKind as OutcomeTerminalKind,
    envelope.payload,
  );
  if (expectedFields === null || fields.length !== expectedFields.length ||
    fields.some((field, index) => field !== expectedFields[index])) return null;
  const launchSnapshot = exactOwnData(envelope.launchSnapshot, fields);
  if (launchSnapshot === null || !isPlainSerializable(launchSnapshot) ||
    !isPlainSerializable(envelope.payload)) return null;
  const cloned = structuredClone(envelope) as unknown as SerializedOutcomeEnvelope;
  return {
    envelope: cloned,
    fields,
  };
}

function validateLegacyPreparedEnvelope(value: unknown): SerializedOutcomeEnvelope | null {
  const envelope = exactOwnData(value, [
    "version", "routeKind", "missionId", "routeIdentity", "launchId", "expectedRevision", "persistenceAuthority",
    "returnTarget", "declaredFields", "launchSnapshot", "outcomeId", "terminalKind", "payload",
  ]);
  if (envelope === null || envelope.version !== 1 || envelope.routeKind !== "poi" ||
    typeof envelope.missionId !== "string" || envelope.missionId.length === 0 ||
    typeof envelope.launchId !== "string" || envelope.launchId.length === 0 ||
    !Number.isSafeInteger(envelope.expectedRevision) || (envelope.expectedRevision as number) < 0 ||
    envelope.persistenceAuthority !== "legacy" || envelope.returnTarget !== "legacy-colony-exterior" ||
    envelope.terminalKind !== "success" || envelope.outcomeId !== `${envelope.launchId}:success` ||
    !Array.isArray(envelope.declaredFields) || envelope.declaredFields.length !== LEGACY_POI_FIELDS.length ||
    envelope.declaredFields.some((field, index) => field !== LEGACY_POI_FIELDS[index])) return null;
  const identity = snapshotOutcomeRouteIdentity(envelope.routeIdentity, "poi", envelope.missionId as string);
  if (identity === null || identity.kind !== "poi") return null;
  const launchSnapshot = exactOwnData(envelope.launchSnapshot, LEGACY_POI_FIELDS);
  const payload = exactOwnData(envelope.payload, ["version", "kind"]);
  if (launchSnapshot === null || payload === null || payload.version !== 2 ||
    payload.kind !== "poi_prepared_v2" || !isPlainSerializable(launchSnapshot) ||
    !Array.isArray(launchSnapshot.colonies) || !Array.isArray(launchSnapshot.planets)) return null;
  const colonies = launchSnapshot.colonies as SaveData["colonies"];
  const planets = launchSnapshot.planets as SaveData["planets"];
  const origin = colonies.find((colony) => colony.id === identity.originColonyId);
  const node = planets.find((planet) => planet.id === origin?.planetId)
    ?.regionMap.nodes.find((entry) => entry.id === identity.nodeId);
  if (origin === undefined || node === undefined || node.templateId !== identity.templateId ||
    (node.intel !== "surveyed" && node.intel !== "cleared") ||
    identity.rewardEligible !== (node.intel === "surveyed")) return null;
  return structuredClone(envelope) as unknown as SerializedOutcomeEnvelope;
}

function snapshotAppliedReturn(value: unknown): AppliedOutcomeReturnRecord | null {
  const receipt = exactOwnData(value, [
    "version", "kind", "outcomeId", "launchId", "missionId", "routeKind", "routeIdentity", "terminalKind", "persistenceAuthority",
    "returnTarget", "appliedRevision", "returnPending",
  ]);
  if (receipt === null || receipt.version !== 2 || receipt.kind !== "applied_return" ||
    !ROUTE_KINDS.has(receipt.routeKind as OutcomeRouteKind)) return null;
  const identity = typeof receipt.missionId === "string"
    ? snapshotOutcomeRouteIdentity(receipt.routeIdentity, receipt.routeKind as OutcomeRouteKind, receipt.missionId)
    : null;
  if (identity === null || typeof receipt.launchId !== "string" || receipt.launchId.length === 0 ||
    typeof receipt.missionId !== "string" || typeof receipt.outcomeId !== "string" ||
    !TERMINAL_KINDS.has(receipt.terminalKind as OutcomeTerminalKind) ||
    receipt.outcomeId !== `${receipt.launchId}:${receipt.terminalKind}` ||
    !outcomeAuthorityReturnMatches(
      receipt.routeKind as OutcomeRouteKind,
      receipt.persistenceAuthority,
      receipt.returnTarget,
    ) ||
    !Number.isSafeInteger(receipt.appliedRevision) || (receipt.appliedRevision as number) < 0 ||
    typeof receipt.returnPending !== "boolean") return null;
  return {
    version: 2,
    kind: "applied_return",
    outcomeId: receipt.outcomeId,
    launchId: receipt.launchId,
    missionId: receipt.missionId,
    routeKind: receipt.routeKind as OutcomeRouteKind,
    routeIdentity: identity,
    terminalKind: receipt.terminalKind as OutcomeTerminalKind,
    persistenceAuthority: receipt.persistenceAuthority as AppliedOutcomeReturnRecord["persistenceAuthority"],
    returnTarget: receipt.returnTarget as AppliedOutcomeReturnRecord["returnTarget"],
    appliedRevision: receipt.appliedRevision as number,
    returnPending: receipt.returnPending as boolean,
  };
}

interface SnapshotRecoveryRecord {
  record: OutcomeRecoveryRecord;
  identity: string;
  protectedIds: string[];
  locked: boolean;
}

function snapshotRecoveryRecord(value: unknown): SnapshotRecoveryRecord | null {
  const recordData = ownDataRecord(value);
  if (recordData === null) return null;
  if (recordData.kind === "applied_return") {
    const receipt = snapshotAppliedReturn(value);
    return receipt === null ? null : {
      record: receipt,
      identity: receipt.outcomeId,
      protectedIds: receipt.returnPending || receipt.persistenceAuthority === "galaxy" ? [receipt.outcomeId] : [],
      locked: false,
    };
  }
  if (recordData.kind === "legacy_poi_prepared") {
    const wrapped = exactOwnData(value, ["version", "kind", "envelope"]);
    const validated = wrapped?.version === 2 && wrapped.kind === "legacy_poi_prepared"
      ? validateLegacyPreparedEnvelope(wrapped.envelope)
      : null;
    return validated === null ? null : {
      record: { version: 2, kind: "legacy_poi_prepared", envelope: validated },
      identity: validated.outcomeId,
      protectedIds: [validated.outcomeId],
      locked: false,
    };
  }
  const lock = exactOwnData(value, ["version", "kind", "reason", "protectedOutcomeIds", "quarantinedOutcomeCount"]);
  const protectedIds = lock === null ? null : snapshotStringJournal(lock.protectedOutcomeIds);
  return lock !== null && protectedIds !== null && lock.version === 2 && lock.kind === "reconciliation_required" &&
    (lock.reason === "recovery_capacity_exceeded" || lock.reason === "prepared_outcome_invalid" ||
      lock.reason === "outcome_authority_invalid") &&
    protectedIds.length <= OUTCOME_JOURNAL_LIMIT && Number.isSafeInteger(lock.quarantinedOutcomeCount) &&
    (lock.quarantinedOutcomeCount as number) >= 0
    ? {
        record: {
          version: 2,
          kind: "reconciliation_required",
          reason: lock.reason,
          protectedOutcomeIds: protectedIds,
          quarantinedOutcomeCount: lock.quarantinedOutcomeCount as number,
        },
        identity: `lock:${lock.reason}`,
        protectedIds,
        locked: true,
      }
    : null;
}

export interface ValidatedOutcomeRoot {
  saveRevision: number;
  appliedOutcomeIds: string[];
  outcomeRecoveryRecords: OutcomeRecoveryRecord[];
  protectedIds: string[];
  locked: boolean;
}

function validateRoot(save: SaveData): ValidatedOutcomeRoot | null {
  const root = requiredOwnData(save, ["saveRevision", "appliedOutcomeIds", "outcomeRecoveryRecords"]);
  const appliedOutcomeIds = root === null ? null : snapshotStringJournal(root.appliedOutcomeIds);
  const outcomeRecoveryRecords = root === null ? null : snapshotDenseArray(root.outcomeRecoveryRecords);
  if (root === null || !Number.isSafeInteger(root.saveRevision) || (root.saveRevision as number) < 0 ||
    appliedOutcomeIds === null || appliedOutcomeIds.length > OUTCOME_JOURNAL_LIMIT ||
    outcomeRecoveryRecords === null || outcomeRecoveryRecords.length > OUTCOME_RECOVERY_LIMIT) return null;
  const snapshots: OutcomeRecoveryRecord[] = [];
  const protectedIds: string[] = [];
  const identities = new Set<string>();
  let locked = false;
  let legacyPreparedCount = 0;
  for (const rawRecord of outcomeRecoveryRecords) {
    const snapshot = snapshotRecoveryRecord(rawRecord);
    if (snapshot === null || identities.has(snapshot.identity)) return null;
    identities.add(snapshot.identity);
    snapshots.push(snapshot.record);
    protectedIds.push(...snapshot.protectedIds);
    locked ||= snapshot.locked;
    if (snapshot.record.kind === "applied_return") {
      if (snapshot.record.returnPending &&
        (snapshot.record.appliedRevision > (root.saveRevision as number) ||
          !appliedOutcomeIds.includes(snapshot.record.outcomeId))) return null;
      if ((snapshot.record.routeKind === "poi" || snapshot.record.routeKind === "colony") &&
        !dynamicOutcomeRouteIdentityIsCanonical(
          save,
          snapshot.record.routeIdentity,
          snapshot.record.persistenceAuthority,
          "applied",
        )) return null;
    } else if (snapshot.record.kind === "legacy_poi_prepared") {
      legacyPreparedCount += 1;
      if (legacyPreparedCount > 1) return null;
      const preparedRecord = snapshot.record;
      const current = requiredOwnData(save, LEGACY_POI_FIELDS);
      if (current === null || preparedRecord.envelope.expectedRevision > (root.saveRevision as number) ||
        LEGACY_POI_FIELDS.some((field) =>
          !sameData(current[field], preparedRecord.envelope.launchSnapshot[field]))) return null;
    }
  }
  if (!snapshotGalaxyAuthorityFromSave(save, appliedOutcomeIds, snapshots).ok) return null;
  return {
    saveRevision: root.saveRevision as number,
    appliedOutcomeIds,
    outcomeRecoveryRecords: snapshots,
    protectedIds: [...new Set(protectedIds)],
    locked,
  };
}

export function snapshotOutcomeRootAuthority(save: SaveData): ValidatedOutcomeRoot | null {
  try { return validateRoot(save); }
  catch { return null; }
}

export function snapshotOutcomeIdJournal(value: unknown): string[] | null {
  return snapshotStringJournal(value);
}

function legacyPreparationMatchesFinal(
  prepared: SerializedOutcomeEnvelope,
  final: SerializedOutcomeEnvelope,
): boolean {
  return prepared.routeKind === "poi" && final.routeKind === "poi" &&
    prepared.persistenceAuthority === "legacy" && final.persistenceAuthority === "legacy" &&
    prepared.terminalKind === "success" && final.terminalKind === "success" &&
    prepared.missionId === final.missionId && prepared.launchId === final.launchId &&
    prepared.outcomeId === final.outcomeId && prepared.expectedRevision === final.expectedRevision &&
    prepared.returnTarget === final.returnTarget &&
    sameData(prepared.routeIdentity, final.routeIdentity) &&
    sameData(prepared.declaredFields, final.declaredFields) &&
    sameData(prepared.launchSnapshot, final.launchSnapshot);
}

function appendJournal(journal: readonly string[], outcomeId: string, protectedIds: readonly string[]): string[] | null {
  const next = [...journal.filter((id) => id !== outcomeId), outcomeId];
  const protectedSet = new Set(protectedIds);
  for (let index = 0; next.length > OUTCOME_JOURNAL_LIMIT && index < next.length;) {
    if (protectedSet.has(next[index])) index += 1;
    else next.splice(index, 1);
  }
  return next.length <= OUTCOME_JOURNAL_LIMIT ? next : null;
}

function appendRecoveryRecord(
  records: readonly OutcomeRecoveryRecord[],
  receipt: AppliedOutcomeReturnRecord,
  consumedOutcomeId: string,
): OutcomeRecoveryRecord[] | null {
  const next = records.filter((record) => {
    if (record.kind === "applied_return") return record.outcomeId !== receipt.outcomeId;
    if (record.kind === "legacy_poi_prepared") return record.envelope.outcomeId !== consumedOutcomeId;
    return true;
  });
  next.push(receipt);
  for (let index = 0; next.length > OUTCOME_RECOVERY_LIMIT && index < next.length;) {
    const record = next[index];
    if (record.kind === "applied_return" && !record.returnPending) next.splice(index, 1);
    else index += 1;
  }
  return next.length <= OUTCOME_RECOVERY_LIMIT ? next : null;
}

export function createOutcomeEnvelope(
  attempt: OutcomeAttempt,
  terminalKind: OutcomeTerminalKind,
  payload: unknown,
): SerializedOutcomeEnvelope {
  const fields = outcomeEnvelopeFields(
    attempt.routeKind,
    attempt.persistenceAuthority,
    terminalKind,
    payload,
  );
  const declaredFields = fields === null ? attempt.declaredFields : [...fields];
  const launchSnapshot = Object.fromEntries(declaredFields.map((field) => [
    field,
    structuredClone(attempt.launchSnapshot[field]),
  ]));
  return structuredClone({
    ...attempt,
    declaredFields,
    launchSnapshot,
    outcomeId: `${attempt.launchId}:${terminalKind}`,
    terminalKind,
    payload,
  }) as SerializedOutcomeEnvelope;
}

export function createOutcomeAttempt(
  save: SaveData,
  context: LaunchContext,
  routeKind: OutcomeRouteKind,
  poi?: PoiOutcomeRouteInput,
): OutcomeAttempt {
  const root = validateRoot(save);
  if (root === null || root.locked || !ROUTE_KINDS.has(routeKind) ||
    typeof context.launchId !== "string" || context.launchId.length === 0 ||
    !outcomeAuthorityReturnMatches(routeKind, context.persistenceAuthority, context.returnTarget) ||
    (context.persistenceAuthority === "legacy" && save.activeExperience !== "legacy") ||
    (context.persistenceAuthority === "galaxy" &&
      (save.activeExperience !== "galaxy" || save.galaxyRun === null))) {
    throw new Error("Outcome attempt requires a valid canonical launch context.");
  }
  const routeMatchesMission = routeKind === "poi"
    ? context.mission.kind === "colony" && context.mission.id.startsWith("poi:")
    : routeKind === "colony"
      ? context.mission.kind === "colony" && context.mission.id.startsWith("colony:")
      : context.mission.kind === routeKind;
  if (!routeMatchesMission) {
    throw new Error("Outcome route does not match the launched mission.");
  }
  const routeIdentity = outcomeRouteIdentityFromLaunch(save, context, routeKind, poi);
  const fields = [...outcomeAttemptFields(routeKind, context.persistenceAuthority)] as OutcomeDeclaredField[];
  const launchSnapshot = Object.fromEntries(fields.map((field) => [field, structuredClone(save[field])])) as
    Pick<SaveData, OutcomeDeclaredField>;
  return {
    version: 1,
    routeKind,
    missionId: routeIdentity.kind === "poi"
      ? poiOutcomeMissionId(context.mission.id, routeIdentity.originColonyId)
      : context.mission.id,
    routeIdentity,
    launchId: context.launchId,
    expectedRevision: root.saveRevision,
    persistenceAuthority: context.persistenceAuthority,
    returnTarget: context.returnTarget,
    declaredFields: fields,
    launchSnapshot,
  };
}

function stageLegacyPreparedOutcomeImpl(
  save: SaveData,
  submitted: SerializedOutcomeEnvelope,
): SaveData | null {
  const root = validateRoot(save);
  const envelope = validateLegacyPreparedEnvelope(submitted);
  const saveData = requiredOwnData(save, [
    "activeExperience", ...LEGACY_POI_FIELDS,
  ]);
  if (root === null || root.locked || envelope === null || saveData === null ||
    saveData.activeExperience !== "legacy" ||
    root.appliedOutcomeIds.includes(envelope.outcomeId) || root.saveRevision < envelope.expectedRevision ||
    LEGACY_POI_FIELDS.some((field) => !sameData(saveData[field], envelope.launchSnapshot[field]))) return null;
  const preparedRecords = root.outcomeRecoveryRecords.filter((record): record is Extract<OutcomeRecoveryRecord, {
    kind: "legacy_poi_prepared";
  }> => record.kind === "legacy_poi_prepared");
  const existing = preparedRecords.find((record) => record.envelope.outcomeId === envelope.outcomeId);
  if (existing !== undefined) {
    return sameData(existing.envelope, envelope) ? save : null;
  }
  if (preparedRecords.length > 0) return null;
  const records = root.outcomeRecoveryRecords.filter((record) =>
    record.kind !== "applied_return" || record.returnPending);
  records.push({ version: 2, kind: "legacy_poi_prepared", envelope });
  if (records.length > OUTCOME_RECOVERY_LIMIT) return null;
  const revision = root.saveRevision + 1;
  return Number.isSafeInteger(revision)
    ? withRootOverrides(save, { saveRevision: revision, outcomeRecoveryRecords: records })
    : null;
}

export function stageLegacyPreparedOutcome(
  save: SaveData,
  submitted: SerializedOutcomeEnvelope,
): SaveData | null {
  try { return stageLegacyPreparedOutcomeImpl(save, submitted); }
  catch { return null; }
}

function recoverLegacyPreparedOutcomeImpl(save: SaveData): SerializedOutcomeEnvelope | null {
  const root = validateRoot(save);
  const saveData = requiredOwnData(save, [
    "activeExperience", ...LEGACY_POI_FIELDS,
  ]);
  if (root === null || root.locked || saveData === null || saveData.activeExperience !== "legacy") return null;
  const prepared = root.outcomeRecoveryRecords.filter(
    (record) => record.kind === "legacy_poi_prepared",
  );
  if (prepared.length !== 1) return null;
  const envelope = validateLegacyPreparedEnvelope(prepared[0].envelope);
  if (envelope === null || root.appliedOutcomeIds.includes(envelope.outcomeId) ||
    root.saveRevision < envelope.expectedRevision ||
    LEGACY_POI_FIELDS.some((field) => !sameData(saveData[field], envelope.launchSnapshot[field]))) return null;
  return envelope;
}

export function recoverLegacyPreparedOutcome(save: SaveData): SerializedOutcomeEnvelope | null {
  try { return recoverLegacyPreparedOutcomeImpl(save); }
  catch { return null; }
}

interface OutcomeWriteProof {
  expectedRevision: number;
  expectedOutcomeIds: string[];
  expectedRecords: OutcomeRecoveryRecord[];
  effectFields: OutcomeDeclaredField[];
  expectedEffects: Record<string, unknown>;
}

function createOutcomeWriteProof(
  candidate: SaveData,
  expectedRevision: number,
  expectedOutcomeIds: readonly string[],
  expectedRecords: readonly OutcomeRecoveryRecord[],
  effectFields: readonly OutcomeDeclaredField[],
): OutcomeWriteProof | null {
  try {
    const effects = requiredOwnData(candidate, effectFields);
    return effects === null ? null : {
      expectedRevision,
      expectedOutcomeIds: structuredClone(expectedOutcomeIds) as string[],
      expectedRecords: structuredClone(expectedRecords) as OutcomeRecoveryRecord[],
      effectFields: [...effectFields],
      expectedEffects: structuredClone(effects),
    };
  } catch {
    return null;
  }
}

function exactPostWriteProof(
  after: SaveData,
  proof: OutcomeWriteProof,
): ValidatedOutcomeRoot | null {
  const afterRoot = validateRoot(after);
  if (afterRoot === null || afterRoot.locked || afterRoot.saveRevision !== proof.expectedRevision ||
    !sameData(afterRoot.appliedOutcomeIds, proof.expectedOutcomeIds) ||
    !sameData(afterRoot.outcomeRecoveryRecords, proof.expectedRecords)) return null;
  const afterEffects = requiredOwnData(after, proof.effectFields);
  if (afterEffects === null || proof.effectFields.some((field) =>
    !sameData(afterEffects[field], proof.expectedEffects[field]))) return null;
  return afterRoot;
}

function commitOutcomeImpl(
  store: CanonicalSaveStore,
  submitted: SerializedOutcomeEnvelope,
): CommitOutcomeResult {
  let latest: SaveData;
  try { latest = store.read(); }
  catch { return { status: "write_failed", error: new Error("Canonical save read failed") }; }
  let root: ReturnType<typeof validateRoot>;
  let validated: ValidatedEnvelope | null;
  let latestData: Record<string, unknown> | null;
  try {
    root = validateRoot(latest);
    validated = validateEnvelope(submitted);
    latestData = validated === null ? null : requiredOwnData(latest, [
      "activeExperience", "galaxyRun",
      ...validated.fields,
    ]);
  } catch {
    return { status: "conflict", latest };
  }
  if (root === null || root.locked || validated === null || latestData === null) return { status: "conflict", latest };
  const outcome = validated.envelope;
  if ((outcome.persistenceAuthority === "legacy" && latestData.activeExperience !== "legacy") ||
    (outcome.persistenceAuthority === "galaxy" &&
      (latestData.activeExperience !== "galaxy" || latestData.galaxyRun === null))) {
    return { status: "conflict", latest };
  }
  const journalStatus = outcomeJournalStatus(latest, outcome, root);
  if (journalStatus === "conflict") return { status: "conflict", latest };
  if (journalStatus === "applied") return { status: "already_applied", save: latest };
  if ((outcome.routeKind === "poi" || outcome.routeKind === "colony") &&
    !dynamicOutcomeRouteIdentityIsCanonical(
      latest,
      outcome.routeIdentity,
      outcome.persistenceAuthority,
      "new",
    )) return { status: "conflict", latest };
  if (outcome.persistenceAuthority === "galaxy" && outcome.routeKind === "poi" &&
    root.saveRevision !== outcome.expectedRevision) return { status: "conflict", latest };
  if (outcome.persistenceAuthority === "legacy" && outcome.routeKind === "poi" &&
    outcome.terminalKind === "success") {
    const prepared = root.outcomeRecoveryRecords.filter((record): record is Extract<OutcomeRecoveryRecord, {
      kind: "legacy_poi_prepared";
    }> => record.kind === "legacy_poi_prepared" && record.envelope.outcomeId === outcome.outcomeId);
    if (prepared.length !== 1 || !legacyPreparationMatchesFinal(prepared[0].envelope, outcome)) {
      return { status: "conflict", latest };
    }
  }
  if (root.saveRevision < outcome.expectedRevision || validated.fields.some((field) =>
    !sameData(latestData![field], outcome.launchSnapshot[field]))) return { status: "conflict", latest };
  const projection = Object.fromEntries(validated.fields.map((field) => [
    field,
    structuredClone(latestData![field]),
  ])) as unknown as SaveData;
  const folded = foldMissionOutcome(
    projection,
    outcome.routeKind,
    outcome.routeIdentity,
    outcome.persistenceAuthority,
    outcome.terminalKind,
    outcome.launchId,
    outcome.outcomeId,
    outcome.expectedRevision,
    outcome.payload,
  );
  if (!folded.ok || folded.fields.length !== validated.fields.length ||
    folded.fields.some((field, index) => field !== validated.fields[index])) {
    return { status: "conflict", latest };
  }
  const revision = root.saveRevision + 1;
  if (!Number.isSafeInteger(revision)) return { status: "conflict", latest };
  const receipt: AppliedOutcomeReturnRecord = {
    version: 2,
    kind: "applied_return",
    outcomeId: outcome.outcomeId,
    launchId: outcome.launchId,
    missionId: outcome.missionId,
    routeKind: outcome.routeKind,
    routeIdentity: structuredClone(outcome.routeIdentity),
    terminalKind: outcome.terminalKind,
    persistenceAuthority: outcome.persistenceAuthority,
    returnTarget: outcome.returnTarget,
    appliedRevision: revision,
    returnPending: true,
  };
  const records = appendRecoveryRecord(root.outcomeRecoveryRecords, receipt, outcome.outcomeId);
  if (records === null) return { status: "conflict", latest };
  const protectedIds = records.flatMap((record) => snapshotRecoveryRecord(record)?.protectedIds ?? []);
  const journal = appendJournal(root.appliedOutcomeIds, outcome.outcomeId, protectedIds);
  if (journal === null) return { status: "conflict", latest };
  const foldedOverrides = Object.fromEntries(folded.fields.map((field) => [
    field,
    structuredClone(folded.nextSave[field]),
  ])) as Partial<SaveData>;
  if (outcome.persistenceAuthority === "galaxy") {
    const sourceRun = (folded.fields.includes("galaxyRun")
      ? folded.nextSave.galaxyRun
      : latestData.galaxyRun) as SaveData["galaxyRun"] | undefined;
    if (sourceRun === null || sourceRun === undefined) return { status: "conflict", latest };
    const galaxyRun = structuredClone(sourceRun) as NonNullable<SaveData["galaxyRun"]>;
    const nestedJournal = snapshotStringJournal(galaxyRun.appliedOutcomeIds);
    if (nestedJournal === null) return { status: "conflict", latest };
    const nestedOccurrences = nestedJournal.filter((id) => id === outcome.outcomeId).length;
    const nextNested = nestedOccurrences === 0
      ? appendJournal(nestedJournal, outcome.outcomeId, root.protectedIds)
      : nestedOccurrences === 1 ? nestedJournal : null;
    if (nextNested === null) return { status: "conflict", latest };
    galaxyRun.appliedOutcomeIds = nextNested;
    foldedOverrides.galaxyRun = galaxyRun;
  }
  const candidate = withRootOverrides(latest, {
    ...foldedOverrides,
    saveRevision: revision,
    appliedOutcomeIds: journal,
    outcomeRecoveryRecords: records,
  });
  if (candidate === null) return { status: "conflict", latest };
  const candidateRoot = validateRoot(candidate);
  if (candidateRoot === null || outcomeJournalStatus(candidate, outcome, candidateRoot) !== "applied") {
    return { status: "conflict", latest };
  }
  const effectFields = [...new Set<OutcomeDeclaredField>([
    ...folded.fields,
    ...(outcome.persistenceAuthority === "galaxy" ? ["galaxyRun" as const] : []),
  ])];
  const writeProof = createOutcomeWriteProof(candidate, revision, journal, records, effectFields);
  if (writeProof === null) return { status: "conflict", latest };
  try {
    store.write(candidate);
  } catch (cause) {
    try {
      const after = store.read();
      const afterRoot = exactPostWriteProof(after, writeProof);
      if (afterRoot !== null && outcomeJournalStatus(after, outcome, afterRoot) === "applied") {
        return { status: "already_applied", save: after };
      }
    } catch { /* preserve the original write failure */ }
    return { status: "write_failed", error: cause instanceof Error ? cause : new Error("Outcome write failed") };
  }
  return { status: "committed", save: candidate };
}

export function commitOutcome(
  store: CanonicalSaveStore,
  submitted: SerializedOutcomeEnvelope,
): CommitOutcomeResult {
  try { return commitOutcomeImpl(store, submitted); }
  catch {
    let latest: SaveData;
    try { latest = store.read(); }
    catch { return { status: "write_failed", error: new Error("Canonical save read failed") }; }
    return { status: "conflict", latest };
  }
}

function recoverOutcomeReturnImpl(save: SaveData): AppliedOutcomeReturnRecord | null {
  const root = validateRoot(save);
  if (root === null || root.locked) return null;
  for (let index = root.outcomeRecoveryRecords.length - 1; index >= 0; index -= 1) {
    const record = root.outcomeRecoveryRecords[index];
    if (record.kind === "applied_return" && record.returnPending &&
      root.appliedOutcomeIds.includes(record.outcomeId)) return structuredClone(record);
  }
  return null;
}

export function recoverOutcomeReturn(save: SaveData): AppliedOutcomeReturnRecord | null {
  try { return recoverOutcomeReturnImpl(save); }
  catch { return null; }
}

function acknowledgeOutcomeReturnImpl(
  store: CanonicalSaveStore,
  outcomeId: string,
): CommitOutcomeResult {
  let latest: SaveData;
  try { latest = store.read(); }
  catch { return { status: "write_failed", error: new Error("Canonical save read failed") }; }
  const root = validateRoot(latest);
  if (root === null || root.locked || typeof outcomeId !== "string" || outcomeId.length === 0) {
    return { status: "conflict", latest };
  }
  const currentRecords = root.outcomeRecoveryRecords;
  const matches = currentRecords.map((record, index) => ({ record, index })).filter(({ record }) =>
    record.kind === "applied_return" && record.outcomeId === outcomeId);
  if (matches.length === 0) return { status: "already_applied", save: latest };
  if (matches.length !== 1) return { status: "conflict", latest };
  const index = matches[0].index;
  const record = currentRecords[index];
  if (record.kind !== "applied_return") return { status: "conflict", latest };
  if (!record.returnPending) return { status: "already_applied", save: latest };
  const revision = root.saveRevision + 1;
  if (!Number.isSafeInteger(revision)) return { status: "conflict", latest };
  const records = structuredClone(currentRecords);
  records[index] = { ...record, returnPending: false };
  const candidate = withRootOverrides(latest, { saveRevision: revision, outcomeRecoveryRecords: records });
  if (candidate === null || validateRoot(candidate) === null) return { status: "conflict", latest };
  const writeProof = createOutcomeWriteProof(candidate, revision, root.appliedOutcomeIds, records, []);
  if (writeProof === null) return { status: "conflict", latest };
  try { store.write(candidate); }
  catch (cause) {
    try {
      const after = store.read();
      const afterRoot = exactPostWriteProof(after, writeProof);
      if (afterRoot !== null && afterRoot.appliedOutcomeIds.includes(outcomeId)) {
        return { status: "already_applied", save: after };
      }
    } catch { /* preserve the original write failure */ }
    return { status: "write_failed", error: cause instanceof Error ? cause : new Error("Outcome acknowledgement failed") };
  }
  return { status: "committed", save: candidate };
}

export function acknowledgeOutcomeReturn(
  store: CanonicalSaveStore,
  outcomeId: string,
): CommitOutcomeResult {
  try { return acknowledgeOutcomeReturnImpl(store, outcomeId); }
  catch {
    let latest: SaveData;
    try { latest = store.read(); }
    catch { return { status: "write_failed", error: new Error("Canonical save read failed") }; }
    return { status: "conflict", latest };
  }
}

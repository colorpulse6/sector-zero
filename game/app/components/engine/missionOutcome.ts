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
  outcomeRouteIdentityFromLaunch,
  outcomeAuthorityReturnMatches,
  snapshotOutcomeRouteIdentity,
  type LaunchContext,
  type PoiOutcomeRouteInput,
} from "./missionContext";
import { foldMissionOutcome, outcomeAttemptFields, outcomeEnvelopeFields } from "./missionOutcomeFolds";

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
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== value.length + 1 || keys.some((key) => key !== "length" &&
    (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length))) return null;
  const snapshot: unknown[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !("value" in descriptor)) return null;
    snapshot.push(descriptor.value);
  }
  return snapshot;
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
      if (Object.getPrototypeOf(value) !== Array.prototype || Object.keys(value).length !== value.length) return false;
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (descriptor === undefined || !("value" in descriptor) || !isPlainSerializable(descriptor.value, ancestors)) return false;
      }
      return true;
    }
    const snapshot = ownDataRecord(value);
    return snapshot !== null && Object.values(snapshot).every((entry) => isPlainSerializable(entry, ancestors));
  } finally {
    ancestors.delete(value);
  }
}

function sameData(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
      left.every((entry, index) => sameData(entry, right[index]));
  }
  const leftRecord = ownDataRecord(left);
  const rightRecord = ownDataRecord(right);
  if (leftRecord === null || rightRecord === null) return false;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) =>
    key === rightKeys[index] && sameData(leftRecord[key], rightRecord[key]));
}

function withRootOverrides(save: SaveData, overrides: Partial<SaveData>): SaveData {
  const descriptors = Object.getOwnPropertyDescriptors(save);
  for (const [key, value] of Object.entries(overrides)) {
    descriptors[key] = { value, enumerable: true, configurable: true, writable: true };
  }
  return Object.create(Object.getPrototypeOf(save), descriptors) as SaveData;
}

interface ValidatedEnvelope {
  envelope: SerializedOutcomeEnvelope;
  fields: OutcomeDeclaredField[];
}

type OutcomeJournalStatus = "new" | "applied" | "conflict";

function outcomeJournalStatus(save: SaveData, outcome: SerializedOutcomeEnvelope): OutcomeJournalStatus {
  const root = requiredOwnData(save, ["appliedOutcomeIds", "galaxyRun"]);
  if (root === null) return "conflict";
  const rootJournal = snapshotStringJournal(root.appliedOutcomeIds);
  if (rootJournal === null) return "conflict";
  const rootOccurrences = rootJournal.filter((id) => id === outcome.outcomeId).length;
  if (outcome.persistenceAuthority !== "galaxy" ||
    (outcome.routeKind !== "operation" && outcome.routeKind !== "poi")) {
    return rootOccurrences === 0 ? "new" : rootOccurrences === 1 ? "applied" : "conflict";
  }
  const run = requiredOwnData(root.galaxyRun, ["appliedOutcomeIds", "operations"]);
  if (run === null) return "conflict";
  const nestedJournal = snapshotStringJournal(run.appliedOutcomeIds);
  if (nestedJournal === null) return "conflict";
  const nestedOccurrences = nestedJournal.filter((id) => id === outcome.outcomeId).length;
  if (outcome.routeKind === "operation") {
    if (outcome.routeIdentity.kind !== "operation") return "conflict";
    let ownerCount = 0;
    let exactOwnerOccurrences = 0;
    const operations = ownDataRecord(run.operations);
    if (operations === null) return "conflict";
    for (const [operationId, rawRecord] of Object.entries(operations)) {
      const record = ownDataRecord(rawRecord);
      const completions = record === null ? null : snapshotStringJournal(record.completionIds);
      if (completions === null) return "conflict";
      const occurrences = completions.filter((id) => id === outcome.outcomeId).length;
      if (occurrences > 0) {
        ownerCount += 1;
        if (operationId === outcome.routeIdentity.operationId) exactOwnerOccurrences = occurrences;
      }
    }
    if (rootOccurrences === 0 && nestedOccurrences === 0 && ownerCount === 0) return "new";
    return rootOccurrences === 1 && nestedOccurrences === 1 && ownerCount === 1 && exactOwnerOccurrences === 1
      ? "applied"
      : "conflict";
  }
  if (rootOccurrences === 0 && nestedOccurrences === 0) return "new";
  return rootOccurrences === 1 && nestedOccurrences === 1 ? "applied" : "conflict";
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
    typeof envelope.missionId !== "string" || !envelope.missionId.startsWith("poi:") ||
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

function validAppliedReturn(value: unknown): value is AppliedOutcomeReturnRecord {
  const receipt = exactOwnData(value, [
    "version", "kind", "outcomeId", "launchId", "missionId", "routeKind", "routeIdentity", "terminalKind", "persistenceAuthority",
    "returnTarget", "appliedRevision", "returnPending",
  ]);
  if (receipt === null || receipt.version !== 2 || receipt.kind !== "applied_return" ||
    !ROUTE_KINDS.has(receipt.routeKind as OutcomeRouteKind)) return false;
  const identity = typeof receipt.missionId === "string"
    ? snapshotOutcomeRouteIdentity(receipt.routeIdentity, receipt.routeKind as OutcomeRouteKind, receipt.missionId)
    : null;
  return identity !== null &&
    typeof receipt.launchId === "string" && receipt.launchId.length > 0 &&
    TERMINAL_KINDS.has(receipt.terminalKind as OutcomeTerminalKind) &&
    receipt.outcomeId === `${receipt.launchId}:${receipt.terminalKind}` &&
    outcomeAuthorityReturnMatches(
      receipt.routeKind as OutcomeRouteKind,
      receipt.persistenceAuthority,
      receipt.returnTarget,
    ) &&
    Number.isSafeInteger(receipt.appliedRevision) && (receipt.appliedRevision as number) >= 0 &&
    typeof receipt.returnPending === "boolean";
}

function recoveryIdentity(record: OutcomeRecoveryRecord): string[] | null {
  const recordData = ownDataRecord(record);
  if (recordData === null) return null;
  if (recordData.kind === "applied_return") {
    return validAppliedReturn(record) && record.returnPending ? [record.outcomeId] : [];
  }
  if (recordData.kind === "legacy_poi_prepared") {
    const wrapped = exactOwnData(record, ["version", "kind", "envelope"]);
    const validated = wrapped?.version === 2 && wrapped.kind === "legacy_poi_prepared"
      ? validateLegacyPreparedEnvelope(wrapped.envelope)
      : null;
    return validated !== null
      ? [validated.outcomeId]
      : null;
  }
  const lock = exactOwnData(record, ["version", "kind", "reason", "protectedOutcomeIds", "quarantinedOutcomeCount"]);
  return lock !== null && lock.version === 2 && lock.kind === "reconciliation_required" &&
    (lock.reason === "recovery_capacity_exceeded" || lock.reason === "prepared_outcome_invalid" ||
      lock.reason === "outcome_authority_invalid") &&
    Array.isArray(lock.protectedOutcomeIds) &&
    lock.protectedOutcomeIds.length <= OUTCOME_JOURNAL_LIMIT &&
    lock.protectedOutcomeIds.every((id) => typeof id === "string" && id.length > 0) &&
    new Set(lock.protectedOutcomeIds).size === lock.protectedOutcomeIds.length
    && Number.isSafeInteger(lock.quarantinedOutcomeCount) && (lock.quarantinedOutcomeCount as number) >= 0
    ? structuredClone(lock.protectedOutcomeIds) as string[]
    : null;
}

function validateRoot(save: SaveData): { protectedIds: string[]; locked: boolean } | null {
  const root = requiredOwnData(save, ["saveRevision", "appliedOutcomeIds", "outcomeRecoveryRecords"]);
  const appliedOutcomeIds = root === null ? null : snapshotStringJournal(root.appliedOutcomeIds);
  const outcomeRecoveryRecords = root === null ? null : snapshotDenseArray(root.outcomeRecoveryRecords);
  if (root === null || !Number.isSafeInteger(root.saveRevision) || (root.saveRevision as number) < 0 ||
    appliedOutcomeIds === null || appliedOutcomeIds.length > OUTCOME_JOURNAL_LIMIT ||
    outcomeRecoveryRecords === null || outcomeRecoveryRecords.length > OUTCOME_RECOVERY_LIMIT) return null;
  const protectedIds: string[] = [];
  let locked = false;
  for (const rawRecord of outcomeRecoveryRecords) {
    const record = rawRecord as OutcomeRecoveryRecord;
    const ids = recoveryIdentity(record);
    if (ids === null) return null;
    protectedIds.push(...ids);
    if (ownDataRecord(record)?.kind === "reconciliation_required") locked = true;
  }
  return { protectedIds: [...new Set(protectedIds)], locked };
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
    missionId: context.mission.id,
    routeIdentity,
    launchId: context.launchId,
    expectedRevision: save.saveRevision,
    persistenceAuthority: context.persistenceAuthority,
    returnTarget: context.returnTarget,
    declaredFields: fields,
    launchSnapshot,
  };
}

export function stageLegacyPreparedOutcome(
  save: SaveData,
  submitted: SerializedOutcomeEnvelope,
): SaveData | null {
  const root = validateRoot(save);
  const envelope = validateLegacyPreparedEnvelope(submitted);
  const saveData = requiredOwnData(save, [
    "activeExperience", "appliedOutcomeIds", "saveRevision", "outcomeRecoveryRecords", ...LEGACY_POI_FIELDS,
  ]);
  if (root === null || root.locked || envelope === null || saveData === null ||
    saveData.activeExperience !== "legacy" ||
    (saveData.appliedOutcomeIds as string[]).includes(envelope.outcomeId) ||
    (saveData.saveRevision as number) < envelope.expectedRevision ||
    LEGACY_POI_FIELDS.some((field) => !sameData(saveData[field], envelope.launchSnapshot[field]))) return null;
  const preparedRecords = (saveData.outcomeRecoveryRecords as OutcomeRecoveryRecord[]).filter((record): record is Extract<OutcomeRecoveryRecord, {
    kind: "legacy_poi_prepared";
  }> => record.kind === "legacy_poi_prepared");
  const existing = preparedRecords.find((record) => record.envelope.outcomeId === envelope.outcomeId);
  if (existing !== undefined) {
    return sameData(existing.envelope, envelope) ? save : null;
  }
  if (preparedRecords.length > 0) return null;
  const records = (saveData.outcomeRecoveryRecords as OutcomeRecoveryRecord[]).filter((record) =>
    record.kind !== "applied_return" || record.returnPending);
  records.push({ version: 2, kind: "legacy_poi_prepared", envelope });
  if (records.length > OUTCOME_RECOVERY_LIMIT) return null;
  const revision = (saveData.saveRevision as number) + 1;
  return Number.isSafeInteger(revision)
    ? withRootOverrides(save, { saveRevision: revision, outcomeRecoveryRecords: records })
    : null;
}

export function recoverLegacyPreparedOutcome(save: SaveData): SerializedOutcomeEnvelope | null {
  const root = validateRoot(save);
  const saveData = requiredOwnData(save, [
    "activeExperience", "appliedOutcomeIds", "saveRevision", "outcomeRecoveryRecords", ...LEGACY_POI_FIELDS,
  ]);
  if (root === null || root.locked || saveData === null || saveData.activeExperience !== "legacy") return null;
  const prepared = (saveData.outcomeRecoveryRecords as OutcomeRecoveryRecord[]).filter(
    (record) => record.kind === "legacy_poi_prepared",
  );
  if (prepared.length !== 1) return null;
  const envelope = validateLegacyPreparedEnvelope(prepared[0].envelope);
  if (envelope === null || (saveData.appliedOutcomeIds as string[]).includes(envelope.outcomeId) ||
    (saveData.saveRevision as number) < envelope.expectedRevision ||
    LEGACY_POI_FIELDS.some((field) => !sameData(saveData[field], envelope.launchSnapshot[field]))) return null;
  return envelope;
}

export function commitOutcome(
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
      "saveRevision", "activeExperience", "galaxyRun", "appliedOutcomeIds", "outcomeRecoveryRecords",
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
  const journalStatus = outcomeJournalStatus(latest, outcome);
  if (journalStatus === "conflict") return { status: "conflict", latest };
  if (journalStatus === "applied") return { status: "already_applied", save: latest };
  if (outcome.persistenceAuthority === "galaxy" && outcome.routeKind === "poi" &&
    latestData.saveRevision !== outcome.expectedRevision) return { status: "conflict", latest };
  if (outcome.persistenceAuthority === "legacy" && outcome.routeKind === "poi" &&
    outcome.terminalKind === "success") {
    const prepared = latest.outcomeRecoveryRecords.filter((record): record is Extract<OutcomeRecoveryRecord, {
      kind: "legacy_poi_prepared";
    }> => record.kind === "legacy_poi_prepared" && record.envelope.outcomeId === outcome.outcomeId);
    if (prepared.length !== 1 || !legacyPreparationMatchesFinal(prepared[0].envelope, outcome)) {
      return { status: "conflict", latest };
    }
  }
  if ((latestData.saveRevision as number) < outcome.expectedRevision || validated.fields.some((field) =>
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
  const revision = (latestData.saveRevision as number) + 1;
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
  const records = appendRecoveryRecord(latest.outcomeRecoveryRecords, receipt, outcome.outcomeId);
  if (records === null) return { status: "conflict", latest };
  const protectedIds = records.flatMap((record) => recoveryIdentity(record) ?? []);
  const journal = appendJournal(latest.appliedOutcomeIds, outcome.outcomeId, protectedIds);
  if (journal === null) return { status: "conflict", latest };
  const candidate = withRootOverrides(latest, {
    ...Object.fromEntries(folded.fields.map((field) => [field, structuredClone(folded.nextSave[field])])),
    saveRevision: revision,
    appliedOutcomeIds: journal,
    outcomeRecoveryRecords: records,
  });
  if (outcomeJournalStatus(candidate, outcome) !== "applied") return { status: "conflict", latest };
  try {
    store.write(candidate);
  } catch (cause) {
    try {
      const after = store.read();
      if (validateRoot(after) !== null && outcomeJournalStatus(after, outcome) === "applied") {
        return { status: "already_applied", save: after };
      }
    } catch { /* preserve the original write failure */ }
    return { status: "write_failed", error: cause instanceof Error ? cause : new Error("Outcome write failed") };
  }
  return { status: "committed", save: candidate };
}

export function recoverOutcomeReturn(save: SaveData): AppliedOutcomeReturnRecord | null {
  const saveData = requiredOwnData(save, ["appliedOutcomeIds", "outcomeRecoveryRecords"]);
  if (validateRoot(save) === null || saveData === null) return null;
  const records = saveData.outcomeRecoveryRecords as OutcomeRecoveryRecord[];
  const journal = saveData.appliedOutcomeIds as string[];
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (record.kind === "applied_return" && validAppliedReturn(record) && record.returnPending &&
      journal.includes(record.outcomeId)) return structuredClone(record);
  }
  return null;
}

export function acknowledgeOutcomeReturn(
  store: CanonicalSaveStore,
  outcomeId: string,
): CommitOutcomeResult {
  let latest: SaveData;
  try { latest = store.read(); }
  catch { return { status: "write_failed", error: new Error("Canonical save read failed") }; }
  const root = validateRoot(latest);
  const latestData = requiredOwnData(latest, ["saveRevision", "appliedOutcomeIds", "outcomeRecoveryRecords"]);
  if (root === null || root.locked || latestData === null || typeof outcomeId !== "string" || outcomeId.length === 0) {
    return { status: "conflict", latest };
  }
  const currentRecords = latestData.outcomeRecoveryRecords as OutcomeRecoveryRecord[];
  const index = currentRecords.findIndex((record) =>
    record.kind === "applied_return" && record.outcomeId === outcomeId);
  if (index < 0) return { status: "already_applied", save: latest };
  const record = currentRecords[index];
  if (record.kind !== "applied_return" || !validAppliedReturn(record)) return { status: "conflict", latest };
  if (!record.returnPending) return { status: "already_applied", save: latest };
  const revision = (latestData.saveRevision as number) + 1;
  if (!Number.isSafeInteger(revision)) return { status: "conflict", latest };
  const records = structuredClone(currentRecords);
  records[index] = { ...record, returnPending: false };
  const candidate = withRootOverrides(latest, { saveRevision: revision, outcomeRecoveryRecords: records });
  try { store.write(candidate); }
  catch (cause) {
    try {
      const after = store.read();
      const afterRoot = validateRoot(after);
      const pending = after.outcomeRecoveryRecords.find((entry) =>
        entry.kind === "applied_return" && entry.outcomeId === outcomeId);
      if (afterRoot !== null && after.appliedOutcomeIds.includes(outcomeId) &&
        (pending === undefined || (pending.kind === "applied_return" && validAppliedReturn(pending) && !pending.returnPending))) {
        return { status: "already_applied", save: after };
      }
    } catch { /* preserve the original write failure */ }
    return { status: "write_failed", error: cause instanceof Error ? cause : new Error("Outcome acknowledgement failed") };
  }
  return { status: "committed", save: candidate };
}

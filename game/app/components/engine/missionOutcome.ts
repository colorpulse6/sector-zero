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
import type { LaunchContext } from "./missionContext";

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
const LEGACY_RETURNS = new Set(["legacy-star-map", "legacy-cockpit", "legacy-colony-exterior"]);
const GALAXY_RETURNS = new Set(["galaxy-atlas", "galaxy-region"]);
const METADATA_FIELDS = new Set(["saveRevision", "appliedOutcomeIds", "outcomeRecoveryRecords"]);

const ROUTE_FIELDS: Readonly<Record<OutcomeRouteKind, ReadonlySet<OutcomeDeclaredField>>> = {
  campaign: new Set([
    "levels", "credits", "totalStars", "totalScore", "xp", "pilotLevel", "skillPoints",
    "completedQuests", "activeQuests", "bestiary", "materials", "unlockedSpecialMissions",
    "unlockedCodex", "colonies", "planets", "earthShipments", "factionStandings", "bounties",
    "missionsSinceStart", "gameClock",
  ]),
  planet: new Set([
    "completedPlanets", "bestiary", "materials", "unlockedEnhancements",
    "colonies", "planets", "earthShipments",
    "factionStandings", "bounties", "missionsSinceStart", "gameClock",
  ]),
  special: new Set([
    "credits", "completedSpecialMissions", "storyItems", "unlockedCodex", "bestiary",
    "colonies", "planets", "earthShipments", "factionStandings", "bounties",
    "missionsSinceStart", "gameClock",
  ]),
  operation: new Set(["galaxyRun"]),
  colony: new Set([
    "colonies", "planets", "earthShipments", "factionStandings", "bounties",
    "missionsSinceStart", "gameClock", "galaxyRun",
  ]),
  poi: new Set([
    "colonies", "planets", "earthShipments", "factionStandings", "bounties",
    "missionsSinceStart", "gameClock", "galaxyRun",
  ]),
};

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

function authorityReturnMatches(authority: unknown, returnTarget: unknown): boolean {
  return authority === "legacy"
    ? typeof returnTarget === "string" && LEGACY_RETURNS.has(returnTarget)
    : authority === "galaxy" && typeof returnTarget === "string" && GALAXY_RETURNS.has(returnTarget);
}

function routeAuthorityMatches(routeKind: OutcomeRouteKind, authority: unknown, returnTarget: unknown): boolean {
  if (!authorityReturnMatches(authority, returnTarget)) return false;
  if (routeKind === "operation") return authority === "galaxy" && returnTarget === "galaxy-atlas";
  if (routeKind === "campaign") return authority === "legacy" &&
    (returnTarget === "legacy-star-map" || returnTarget === "legacy-cockpit");
  if (routeKind === "planet" || routeKind === "special") return authority === "legacy" && returnTarget === "legacy-cockpit";
  if (routeKind === "poi") return (authority === "legacy" && returnTarget === "legacy-colony-exterior") ||
    (authority === "galaxy" && returnTarget === "galaxy-region");
  return (authority === "legacy" && (returnTarget === "legacy-cockpit" || returnTarget === "legacy-colony-exterior")) ||
    (authority === "galaxy" && returnTarget === "galaxy-region");
}

interface ValidatedEnvelope {
  envelope: SerializedOutcomeEnvelope;
  fields: OutcomeDeclaredField[];
  patch: Partial<Pick<SaveData, OutcomeDeclaredField>>;
}

function validateEnvelope(value: unknown): ValidatedEnvelope | null {
  const envelope = exactOwnData(value, [
    "version", "routeKind", "launchId", "expectedRevision", "persistenceAuthority",
    "returnTarget", "declaredFields", "launchSnapshot", "outcomeId", "terminalKind", "payload",
  ]);
  if (envelope === null || envelope.version !== 1 || !ROUTE_KINDS.has(envelope.routeKind as OutcomeRouteKind) ||
    typeof envelope.launchId !== "string" || envelope.launchId.length === 0 ||
    !Number.isSafeInteger(envelope.expectedRevision) || (envelope.expectedRevision as number) < 0 ||
    !TERMINAL_KINDS.has(envelope.terminalKind as OutcomeTerminalKind) ||
    envelope.outcomeId !== `${envelope.launchId}:${envelope.terminalKind}` ||
    !Array.isArray(envelope.declaredFields) ||
    (envelope.declaredFields.length === 0 && envelope.terminalKind === "success") ||
    envelope.declaredFields.some((field) => typeof field !== "string" || field.length === 0 || METADATA_FIELDS.has(field)) ||
    new Set(envelope.declaredFields).size !== envelope.declaredFields.length) return null;
  const routeKind = envelope.routeKind as OutcomeRouteKind;
  if (!routeAuthorityMatches(routeKind, envelope.persistenceAuthority, envelope.returnTarget)) return null;
  const fields = envelope.declaredFields as OutcomeDeclaredField[];
  if (fields.some((field) => !ROUTE_FIELDS[routeKind].has(field))) return null;
  if (envelope.persistenceAuthority === "galaxy" && fields.some((field) => field !== "galaxyRun")) return null;
  if (envelope.persistenceAuthority === "legacy" && fields.some((field) => field === "galaxyRun" || field === "activeExperience")) return null;
  const launchSnapshot = exactOwnData(envelope.launchSnapshot, fields);
  const payload = exactOwnData(envelope.payload, ["version", "kind", "fields"]);
  const patch = payload === null ? null : exactOwnData(payload.fields, fields);
  if (launchSnapshot === null || payload === null || payload.version !== 1 ||
    payload.kind !== `${routeKind}_result_v1` || patch === null ||
    !isPlainSerializable(launchSnapshot) || !isPlainSerializable(patch)) return null;
  const cloned = structuredClone(envelope) as unknown as SerializedOutcomeEnvelope;
  return {
    envelope: cloned,
    fields,
    patch: structuredClone(patch) as Partial<Pick<SaveData, OutcomeDeclaredField>>,
  };
}

function validAppliedReturn(value: unknown): value is AppliedOutcomeReturnRecord {
  const receipt = exactOwnData(value, [
    "version", "kind", "outcomeId", "launchId", "terminalKind", "persistenceAuthority",
    "returnTarget", "appliedRevision", "returnPending",
  ]);
  return receipt !== null && receipt.version === 1 && receipt.kind === "applied_return" &&
    typeof receipt.launchId === "string" && receipt.launchId.length > 0 &&
    TERMINAL_KINDS.has(receipt.terminalKind as OutcomeTerminalKind) &&
    receipt.outcomeId === `${receipt.launchId}:${receipt.terminalKind}` &&
    authorityReturnMatches(receipt.persistenceAuthority, receipt.returnTarget) &&
    Number.isSafeInteger(receipt.appliedRevision) && (receipt.appliedRevision as number) >= 0 &&
    typeof receipt.returnPending === "boolean";
}

function recoveryIdentity(record: OutcomeRecoveryRecord): string[] | null {
  if (record.kind === "applied_return") return validAppliedReturn(record) && record.returnPending ? [record.outcomeId] : [];
  if (record.kind === "legacy_poi_prepared") {
    const wrapped = exactOwnData(record, ["version", "kind", "envelope"]);
    const validated = wrapped?.version === 1 && wrapped.kind === "legacy_poi_prepared"
      ? validateEnvelope(wrapped.envelope)
      : null;
    return validated !== null && validated.envelope.routeKind === "poi" &&
      validated.envelope.persistenceAuthority === "legacy" &&
      validated.envelope.returnTarget === "legacy-colony-exterior"
      ? [validated.envelope.outcomeId]
      : null;
  }
  const lock = exactOwnData(record, ["version", "kind", "reason", "protectedOutcomeIds"]);
  return lock !== null && lock.version === 1 && lock.kind === "reconciliation_required" &&
    (lock.reason === "recovery_capacity_exceeded" || lock.reason === "prepared_outcome_invalid") &&
    Array.isArray(lock.protectedOutcomeIds) &&
    lock.protectedOutcomeIds.every((id) => typeof id === "string" && id.length > 0) &&
    new Set(lock.protectedOutcomeIds).size === lock.protectedOutcomeIds.length
    ? structuredClone(lock.protectedOutcomeIds) as string[]
    : null;
}

function validateRoot(save: SaveData): { protectedIds: string[]; locked: boolean } | null {
  if (!Number.isSafeInteger(save.saveRevision) || save.saveRevision < 0 ||
    !Array.isArray(save.appliedOutcomeIds) || save.appliedOutcomeIds.some((id) => typeof id !== "string" || id.length === 0) ||
    new Set(save.appliedOutcomeIds).size !== save.appliedOutcomeIds.length ||
    !Array.isArray(save.outcomeRecoveryRecords) || save.outcomeRecoveryRecords.length > OUTCOME_RECOVERY_LIMIT) return null;
  const protectedIds: string[] = [];
  let locked = false;
  for (const record of save.outcomeRecoveryRecords) {
    const ids = recoveryIdentity(record);
    if (ids === null) return null;
    protectedIds.push(...ids);
    if (record.kind === "reconciliation_required") locked = true;
  }
  return { protectedIds: [...new Set(protectedIds)], locked };
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
  return structuredClone({
    ...attempt,
    outcomeId: `${attempt.launchId}:${terminalKind}`,
    terminalKind,
    payload,
  }) as SerializedOutcomeEnvelope;
}

export function createOutcomeAttempt(
  save: SaveData,
  context: LaunchContext,
  routeKind: OutcomeRouteKind,
  declaredFields: readonly OutcomeDeclaredField[],
): OutcomeAttempt {
  if (validateRoot(save) === null || !ROUTE_KINDS.has(routeKind) ||
    typeof context.launchId !== "string" || context.launchId.length === 0 ||
    !routeAuthorityMatches(routeKind, context.persistenceAuthority, context.returnTarget)) {
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
  const fields = [...declaredFields];
  if (fields.some((field) => typeof field !== "string" || METADATA_FIELDS.has(field) ||
      !ROUTE_FIELDS[routeKind].has(field)) || new Set(fields).size !== fields.length ||
    (context.persistenceAuthority === "galaxy" && fields.some((field) => field !== "galaxyRun")) ||
    (context.persistenceAuthority === "legacy" && fields.some((field) => field === "galaxyRun" || field === "activeExperience"))) {
    throw new Error("Outcome attempt declares unauthorized fields.");
  }
  const launchSnapshot = Object.fromEntries(fields.map((field) => [field, structuredClone(save[field])])) as
    Pick<SaveData, OutcomeDeclaredField>;
  return {
    version: 1,
    routeKind,
    launchId: context.launchId,
    expectedRevision: save.saveRevision,
    persistenceAuthority: context.persistenceAuthority,
    returnTarget: context.returnTarget,
    declaredFields: fields,
    launchSnapshot,
  };
}

export function commitOutcome(
  store: CanonicalSaveStore,
  submitted: SerializedOutcomeEnvelope,
): CommitOutcomeResult {
  let latest: SaveData;
  try { latest = store.read(); }
  catch { return { status: "write_failed", error: new Error("Canonical save read failed") }; }
  const root = validateRoot(latest);
  const validated = validateEnvelope(submitted);
  if (root === null || root.locked || validated === null) return { status: "conflict", latest };
  const outcome = validated.envelope;
  if (latest.appliedOutcomeIds.includes(outcome.outcomeId)) return { status: "already_applied", save: latest };
  if (latest.saveRevision < outcome.expectedRevision || validated.fields.some((field) =>
    !sameData(latest[field], outcome.launchSnapshot[field]))) return { status: "conflict", latest };
  const revision = latest.saveRevision + 1;
  if (!Number.isSafeInteger(revision)) return { status: "conflict", latest };
  const receipt: AppliedOutcomeReturnRecord = {
    version: 1,
    kind: "applied_return",
    outcomeId: outcome.outcomeId,
    launchId: outcome.launchId,
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
  const candidate: SaveData = {
    ...latest,
    ...validated.patch,
    saveRevision: revision,
    appliedOutcomeIds: journal,
    outcomeRecoveryRecords: records,
  };
  try {
    store.write(candidate);
  } catch (cause) {
    try {
      const after = store.read();
      if (validateRoot(after) !== null && after.appliedOutcomeIds.includes(outcome.outcomeId)) {
        return { status: "already_applied", save: after };
      }
    } catch { /* preserve the original write failure */ }
    return { status: "write_failed", error: cause instanceof Error ? cause : new Error("Outcome write failed") };
  }
  return { status: "committed", save: candidate };
}

export function recoverOutcomeReturn(save: SaveData): AppliedOutcomeReturnRecord | null {
  if (validateRoot(save) === null) return null;
  for (let index = save.outcomeRecoveryRecords.length - 1; index >= 0; index -= 1) {
    const record = save.outcomeRecoveryRecords[index];
    if (record.kind === "applied_return" && validAppliedReturn(record) && record.returnPending &&
      save.appliedOutcomeIds.includes(record.outcomeId)) return structuredClone(record);
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
  if (root === null || root.locked || typeof outcomeId !== "string" || outcomeId.length === 0) {
    return { status: "conflict", latest };
  }
  const index = latest.outcomeRecoveryRecords.findIndex((record) =>
    record.kind === "applied_return" && record.outcomeId === outcomeId);
  if (index < 0) return { status: "already_applied", save: latest };
  const record = latest.outcomeRecoveryRecords[index];
  if (record.kind !== "applied_return" || !validAppliedReturn(record)) return { status: "conflict", latest };
  if (!record.returnPending) return { status: "already_applied", save: latest };
  const revision = latest.saveRevision + 1;
  if (!Number.isSafeInteger(revision)) return { status: "conflict", latest };
  const records = structuredClone(latest.outcomeRecoveryRecords);
  records[index] = { ...record, returnPending: false };
  const candidate = { ...latest, saveRevision: revision, outcomeRecoveryRecords: records };
  try { store.write(candidate); }
  catch (cause) { return { status: "write_failed", error: cause instanceof Error ? cause : new Error("Outcome acknowledgement failed") }; }
  return { status: "committed", save: candidate };
}

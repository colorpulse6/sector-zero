import type { OutcomeRecoveryRecord } from "./types";

export type GalaxyOutcomeAuthoritySnapshot =
  | {
      ok: true;
      nestedOutcomeIds: string[];
      operationOwners: Map<string, string>;
    }
  | {
      ok: false;
      knownOutcomeIds: string[];
      quarantinedOutcomeCount: number;
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

function requiredOwnData(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const snapshot: Record<string, unknown> = {};
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor)) return null;
      snapshot[key] = descriptor.value;
    }
    return snapshot;
  } catch {
    return null;
  }
}

function snapshotStringJournal(value: unknown): string[] | null {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (lengthDescriptor === undefined || !("value" in lengthDescriptor) ||
      !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0) return null;
    const length = lengthDescriptor.value as number;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== length + 1 || keys.some((key) => key !== "length" &&
      (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length))) return null;
    const snapshot: string[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !("value" in descriptor) ||
        typeof descriptor.value !== "string" || descriptor.value.length === 0) return null;
      snapshot.push(descriptor.value);
    }
    return new Set(snapshot).size === snapshot.length ? snapshot : null;
  } catch {
    return null;
  }
}

/** Snapshot and validate durable Galaxy root/nested/operation outcome ownership. */
export function snapshotGalaxyOutcomeAuthority(
  galaxyRun: unknown,
  rootOutcomeIds: readonly string[],
  recoveryRecords: readonly OutcomeRecoveryRecord[],
  journalLimit: number,
): GalaxyOutcomeAuthoritySnapshot {
  const knownOutcomeIds = new Set<string>();
  const invalid = (count = 1): GalaxyOutcomeAuthoritySnapshot => ({
    ok: false,
    knownOutcomeIds: [...knownOutcomeIds],
    quarantinedOutcomeCount: Math.max(1, count),
  });
  try {
    if (galaxyRun === null) {
      return recoveryRecords.some((record) =>
        record.kind === "applied_return" && record.persistenceAuthority === "galaxy")
        ? invalid()
        : { ok: true, nestedOutcomeIds: [], operationOwners: new Map() };
    }
    const run = requiredOwnData(galaxyRun, ["appliedOutcomeIds", "operations"]);
    const nestedOutcomeIds = run === null ? null : snapshotStringJournal(run.appliedOutcomeIds);
    const operations = run === null ? null : ownDataRecord(run.operations);
    if (nestedOutcomeIds === null || operations === null || nestedOutcomeIds.length > journalLimit) return invalid();
    nestedOutcomeIds.forEach((outcomeId) => knownOutcomeIds.add(outcomeId));
    let invalidCount = nestedOutcomeIds.filter((outcomeId) => !rootOutcomeIds.includes(outcomeId)).length;
    const operationOwners = new Map<string, string>();
    for (const [operationId, rawOperation] of Object.entries(operations)) {
      const operation = requiredOwnData(rawOperation, ["completionIds"]);
      const completionIds = operation === null ? null : snapshotStringJournal(operation.completionIds);
      if (completionIds === null) return invalid(invalidCount + 1);
      for (const outcomeId of completionIds) {
        knownOutcomeIds.add(outcomeId);
        if (!rootOutcomeIds.includes(outcomeId) || !nestedOutcomeIds.includes(outcomeId) ||
          operationOwners.has(outcomeId)) invalidCount += 1;
        else operationOwners.set(outcomeId, operationId);
      }
    }
    for (const record of recoveryRecords) {
      if (record.kind !== "applied_return") continue;
      const nested = nestedOutcomeIds.includes(record.outcomeId);
      const owner = operationOwners.get(record.outcomeId);
      if (record.persistenceAuthority !== "galaxy") {
        if (nested || owner !== undefined) invalidCount += 1;
        continue;
      }
      knownOutcomeIds.add(record.outcomeId);
      if (!rootOutcomeIds.includes(record.outcomeId) || !nested) invalidCount += 1;
      if (record.routeKind === "operation") {
        if (record.routeIdentity.kind !== "operation" || owner !== record.routeIdentity.operationId) invalidCount += 1;
      } else if (owner !== undefined) invalidCount += 1;
    }
    return invalidCount > 0
      ? invalid(invalidCount)
      : { ok: true, nestedOutcomeIds, operationOwners };
  } catch {
    return invalid();
  }
}

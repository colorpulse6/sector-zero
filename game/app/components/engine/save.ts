import {
  DEFAULT_UPGRADES,
  type ConsumableId,
  type EnhancementId,
  type MaterialId,
  type OutcomeRouteKind,
  type OutcomeRecoveryRecord,
  type PlanetId,
  type SaveData,
  type ShipUpgrades,
  type SpecialMissionId,
  type StoryItemId,
  type WeaponType,
} from "./types";
import {
  dynamicOutcomeRouteIdentityIsCanonical,
  outcomeAuthorityReturnMatches,
  snapshotOutcomeRouteIdentity,
} from "./missionContext";
import type {
  ColonyState,
  PlanetState,
  EarthShipment,
  FactionStanding,
  Bounty,
  GameClock,
} from "../colony/shared/colonyTypes";
import { defaultFactionStandings } from "../colony/shared/factionLedger";
import { unlockCodexEntries } from "./codex";
import { calcPilotLevel, creditBonus, skillPointsAtLevel } from "./pilotLevel";
import { getNode } from "./skillTree";
import {
  ASHFALL_REGION_SEED,
  createPlanetRegionState,
  generateRegionMap,
  neutralSiteStats,
} from "../colony/region/regionMap";
import type { RegionIntelState, RegionNode, SiteStats } from "../colony/shared/colonyTypes";
import { migrateGalaxyRun } from "./galaxy/galaxyRun";
import {
  inspectGalaxyPoiPreparedAuthority,
  type GalaxyPoiPreparedAuthorityInspection,
} from "./galaxy/galaxyPoiOutcomeAuthority";
import {
  inspectGalaxyOutcomeJournals,
  snapshotGalaxyOutcomeAuthority,
} from "./outcomeJournalAuthority";
export type { SaveData };

const SAVE_KEY = "sector-zero-save";
export const OUTCOME_JOURNAL_LIMIT = 256;
export const OUTCOME_RECOVERY_LIMIT = 32;

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

type OwnFieldSnapshot =
  | { kind: "absent" }
  | { kind: "invalid" }
  | { kind: "data"; value: unknown };

function snapshotOwnField(value: unknown, key: string): OwnFieldSnapshot {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return { kind: "invalid" };
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) return { kind: "absent" };
    return "value" in descriptor
      ? { kind: "data", value: descriptor.value }
      : { kind: "invalid" };
  } catch {
    return { kind: "invalid" };
  }
}

function migrateStringJournal(value: unknown): string[] {
  const entries = snapshotDenseArray(value);
  if (entries === null) return [];
  const newestFirst: string[] = [];
  const seen = new Set<string>();
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (typeof entry !== "string" || entry.length === 0 || seen.has(entry)) continue;
    seen.add(entry);
    newestFirst.push(entry);
  }
  return newestFirst.reverse();
}

function snapshotStrictStringJournal(value: unknown): string[] | null {
  const entries = snapshotDenseArray(value);
  return entries !== null && entries.every((entry) => typeof entry === "string" && entry.length > 0) &&
    new Set(entries).size === entries.length
    ? entries as string[]
    : null;
}

function migrateOutcomeJournal(value: unknown, protectedIds: readonly string[] = []): string[] {
  const journal = migrateStringJournal(value);
  if (journal.length <= OUTCOME_JOURNAL_LIMIT) return journal;
  const protectedSet = new Set(protectedIds);
  for (let index = 0; index < journal.length && journal.length > OUTCOME_JOURNAL_LIMIT;) {
    if (protectedSet.has(journal[index])) {
      index += 1;
    } else {
      journal.splice(index, 1);
    }
  }
  return journal.slice(-OUTCOME_JOURNAL_LIMIT);
}

const OUTCOME_ROUTE_KINDS = new Set(["campaign", "planet", "special", "operation", "colony", "poi"]);
const OUTCOME_TERMINAL_KINDS = new Set(["success", "failure", "retreat"]);
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
  if (typeof value !== "object") return false;
  if (ancestors.has(value)) return false;
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

function snapshotOutcomeEnvelope(value: unknown): Record<string, unknown> | null {
  const envelope = exactOwnData(value, [
    "version", "routeKind", "missionId", "routeIdentity", "launchId", "expectedRevision", "persistenceAuthority",
    "returnTarget", "declaredFields", "launchSnapshot", "outcomeId", "terminalKind", "payload",
  ]);
  if (envelope === null || envelope.version !== 1 || envelope.routeKind !== "poi" ||
    typeof envelope.missionId !== "string" || envelope.missionId.length === 0 ||
    typeof envelope.launchId !== "string" || envelope.launchId.length === 0 ||
    !Number.isSafeInteger(envelope.expectedRevision) || (envelope.expectedRevision as number) < 0 ||
    envelope.persistenceAuthority !== "legacy" || envelope.returnTarget !== "legacy-colony-exterior" ||
    envelope.terminalKind !== "success" || envelope.outcomeId !== `${envelope.launchId}:success`) return null;
  const rawFields = snapshotDenseArray(envelope.declaredFields);
  if (rawFields === null || rawFields.some((field) => typeof field !== "string")) return null;
  const fields = rawFields as string[];
  const expectedFields = [
    "colonies", "planets", "missionsSinceStart",
  ];
  if (fields.length !== expectedFields.length || fields.some((field, index) => field !== expectedFields[index])) return null;
  const routeIdentity = snapshotOutcomeRouteIdentity(
    envelope.routeIdentity,
    "poi",
    envelope.missionId as string,
  );
  if (routeIdentity === null || routeIdentity.kind !== "poi") return null;
  const launchSnapshot = exactOwnData(envelope.launchSnapshot, fields);
  const payload = exactOwnData(envelope.payload, ["version", "kind"]);
  if (launchSnapshot === null || payload === null || payload.version !== 2 ||
    payload.kind !== "poi_prepared_v2" || !isPlainSerializable(launchSnapshot) ||
    !Array.isArray(launchSnapshot.colonies) || !Array.isArray(launchSnapshot.planets)) return null;
  const colonies = launchSnapshot.colonies as SaveData["colonies"];
  const planets = launchSnapshot.planets as SaveData["planets"];
  const origin = colonies.find((colony) => colony.id === routeIdentity.originColonyId);
  const node = planets.find((planet) => planet.id === origin?.planetId)
    ?.regionMap.nodes.find((entry) => entry.id === routeIdentity.nodeId);
  if (origin === undefined || node === undefined || node.templateId !== routeIdentity.templateId ||
    (node.intel !== "surveyed" && node.intel !== "cleared") ||
    routeIdentity.rewardEligible !== (node.intel === "surveyed")) return null;
  if (!isPlainSerializable(envelope)) return null;
  try { return structuredClone(envelope) as Record<string, unknown>; }
  catch { return null; }
}

function snapshotAppliedReturn(value: unknown): OutcomeRecoveryRecord | null {
  const source = exactOwnData(value, [
    "version", "kind", "outcomeId", "launchId", "missionId", "routeKind", "routeIdentity", "terminalKind", "persistenceAuthority",
    "returnTarget", "appliedRevision", "returnPending",
  ]);
  const identity = source === null || typeof source.routeKind !== "string" || typeof source.missionId !== "string"
    ? null
    : snapshotOutcomeRouteIdentity(
        source.routeIdentity,
        source.routeKind as OutcomeRouteKind,
        source.missionId,
      );
  if (source === null || source.version !== 2 || source.kind !== "applied_return" ||
    typeof source.routeKind !== "string" || !OUTCOME_ROUTE_KINDS.has(source.routeKind) ||
    typeof source.missionId !== "string" || source.missionId.length === 0 || identity === null ||
    typeof source.launchId !== "string" || source.launchId.length === 0 ||
    !OUTCOME_TERMINAL_KINDS.has(source.terminalKind as string) ||
    source.outcomeId !== `${source.launchId}:${source.terminalKind}` ||
    !outcomeAuthorityReturnMatches(
      source.routeKind as OutcomeRouteKind,
      source.persistenceAuthority,
      source.returnTarget,
    ) ||
    !Number.isSafeInteger(source.appliedRevision) || (source.appliedRevision as number) < 0 ||
    typeof source.returnPending !== "boolean") return null;
  try { return structuredClone(source) as unknown as OutcomeRecoveryRecord; }
  catch { return null; }
}

function snapshotReconciliation(value: unknown): OutcomeRecoveryRecord | null {
  const record = ownDataRecord(value);
  if (record === null) return null;
  const source = record.version === 2
    ? exactOwnData(value, ["version", "kind", "reason", "protectedOutcomeIds", "quarantinedOutcomeCount"])
    : exactOwnData(value, ["version", "kind", "reason", "protectedOutcomeIds"]);
  if (source === null || (source.version !== 1 && source.version !== 2) || source.kind !== "reconciliation_required" ||
    (source.reason !== "recovery_capacity_exceeded" && source.reason !== "prepared_outcome_invalid" &&
      source.reason !== "outcome_authority_invalid") ||
    migrateStringJournal(source.protectedOutcomeIds).length !== (snapshotDenseArray(source.protectedOutcomeIds)?.length ?? -1)) return null;
  const protectedOutcomeIds = migrateStringJournal(source.protectedOutcomeIds);
  const priorQuarantine = source.version === 2 && Number.isSafeInteger(source.quarantinedOutcomeCount) &&
    (source.quarantinedOutcomeCount as number) >= 0
    ? source.quarantinedOutcomeCount as number
    : source.version === 1 ? 0 : -1;
  if (priorQuarantine < 0) return null;
  return reconciliationLock(
    source.reason as OutcomeReconciliationReason,
    protectedOutcomeIds,
    priorQuarantine,
  );
}

function salvageReconciliation(value: unknown): Extract<OutcomeRecoveryRecord, {
  kind: "reconciliation_required";
}> {
  const idsField = snapshotOwnField(value, "protectedOutcomeIds");
  const countField = snapshotOwnField(value, "quarantinedOutcomeCount");
  const protectedOutcomeIds = idsField.kind === "data" ? migrateStringJournal(idsField.value) : [];
  const priorQuarantine = countField.kind === "data" && Number.isSafeInteger(countField.value) &&
    (countField.value as number) >= 0
    ? countField.value as number
    : 0;
  return reconciliationLock("outcome_authority_invalid", protectedOutcomeIds, Math.max(1, priorQuarantine));
}

type OutcomeReconciliationReason = Extract<OutcomeRecoveryRecord, {
  kind: "reconciliation_required";
}>["reason"];

function reconciliationLock(
  reason: OutcomeReconciliationReason,
  outcomeIds: readonly string[],
  quarantinedOutcomeCount = 0,
): Extract<OutcomeRecoveryRecord, { kind: "reconciliation_required" }> {
  const unique = [...new Set(outcomeIds)];
  const protectedOutcomeIds = structuredClone(unique.slice(-OUTCOME_JOURNAL_LIMIT));
  return {
    version: 2,
    kind: "reconciliation_required",
    reason,
    protectedOutcomeIds,
    quarantinedOutcomeCount: quarantinedOutcomeCount + unique.length - protectedOutcomeIds.length,
  };
}

function protectedRecoveryOutcomeIds(records: readonly OutcomeRecoveryRecord[]): string[] {
  return records.flatMap((record) =>
    record.kind === "applied_return"
      ? record.returnPending || record.persistenceAuthority === "galaxy" ? [record.outcomeId] : []
      : record.kind === "legacy_poi_prepared"
        ? [record.envelope.outcomeId]
        : record.protectedOutcomeIds);
}

function reconcileRecoveryAuthority(
  records: readonly OutcomeRecoveryRecord[],
  reason: OutcomeReconciliationReason,
  additionalOutcomeIds: readonly string[],
  quarantinedOutcomeCount: number,
): OutcomeRecoveryRecord[] {
  const existingLock = records.find((record): record is Extract<OutcomeRecoveryRecord, {
    kind: "reconciliation_required";
  }> => record.kind === "reconciliation_required");
  const priorQuarantine = records.reduce((total, record) =>
    total + (record.kind === "reconciliation_required" ? record.quarantinedOutcomeCount : 0), 0);
  return [reconciliationLock(
    existingLock?.reason ?? reason,
    [...protectedRecoveryOutcomeIds(records), ...additionalOutcomeIds],
    existingLock === undefined
      ? priorQuarantine + Math.max(1, quarantinedOutcomeCount)
      : Math.max(priorQuarantine, quarantinedOutcomeCount),
  )];
}

function migrateOutcomeRecoveryRecords(
  value: unknown,
  rootRevision: number,
  rootJournal: readonly string[],
  authorityView: Pick<SaveData, "colonies" | "planets" | "missionsSinceStart" | "galaxyRun">,
): OutcomeRecoveryRecord[] {
  const entries = snapshotDenseArray(value);
  if (entries === null) return [];
  const newestFirst: OutcomeRecoveryRecord[] = [];
  const seen = new Set<string>();
  const invalidPreparedIds: string[] = [];
  let invalidPrepared = false;
  const invalidAuthorityIds: string[] = [];
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    const kindField = snapshotOwnField(entry, "kind");
    if (kindField.kind === "data" && kindField.value === "reconciliation_required") {
      return [snapshotReconciliation(entry) ?? salvageReconciliation(entry)];
    }
    const source = ownDataRecord(entry);
    if (source === null) continue;
    let record: OutcomeRecoveryRecord | null = null;
    let identity: unknown;
    if (source.kind === "applied_return") {
      record = snapshotAppliedReturn(entry);
      identity = source.outcomeId;
      if (record === null) {
        if (source.returnPending === true && typeof source.outcomeId === "string" && source.outcomeId.length > 0) {
          invalidAuthorityIds.push(source.outcomeId);
        }
        continue;
      }
      if (record?.kind === "applied_return" && record.returnPending &&
        (record.appliedRevision > rootRevision || !rootJournal.includes(record.outcomeId))) {
        invalidAuthorityIds.push(record.outcomeId);
        continue;
      }
      if (record?.kind === "applied_return" &&
        (record.routeKind === "poi" || record.routeKind === "colony") &&
        !dynamicOutcomeRouteIdentityIsCanonical(
          authorityView as SaveData,
          record.routeIdentity,
          record.persistenceAuthority,
          "applied",
        )) {
        invalidAuthorityIds.push(record.outcomeId);
        continue;
      }
    } else if (source.kind === "legacy_poi_prepared") {
      const wrapped = exactOwnData(entry, ["version", "kind", "envelope"]);
      const envelope = wrapped === null ? null : snapshotOutcomeEnvelope(wrapped.envelope);
      if (wrapped === null || wrapped.version !== 2 || envelope === null ||
        envelope.routeKind !== "poi" || envelope.persistenceAuthority !== "legacy" ||
        envelope.returnTarget !== "legacy-colony-exterior") {
        invalidPrepared = true;
        const rawEnvelope = ownDataRecord(source.envelope);
        if (rawEnvelope !== null && typeof rawEnvelope.outcomeId === "string" && rawEnvelope.outcomeId.length > 0) {
          invalidPreparedIds.push(rawEnvelope.outcomeId);
        }
        continue;
      }
      record = { version: 2, kind: "legacy_poi_prepared", envelope } as unknown as OutcomeRecoveryRecord;
      identity = envelope.outcomeId;
      const launchSnapshot = ownDataRecord(envelope.launchSnapshot);
      if ((envelope.expectedRevision as number) > rootRevision || launchSnapshot === null ||
        !sameData(launchSnapshot.colonies, authorityView.colonies) ||
        !sameData(launchSnapshot.planets, authorityView.planets) ||
        !sameData(launchSnapshot.missionsSinceStart, authorityView.missionsSinceStart)) {
        invalidPrepared = true;
        invalidPreparedIds.push(envelope.outcomeId as string);
        continue;
      }
    } else {
      continue;
    }
    if (typeof identity !== "string" || identity.length === 0) continue;
    if (seen.has(identity)) {
      if (record?.kind === "legacy_poi_prepared") {
        invalidPrepared = true;
        invalidPreparedIds.push(identity);
      } else {
        invalidAuthorityIds.push(identity);
      }
      continue;
    }
    if (record === null) continue;
    seen.add(identity);
    newestFirst.push(record);
  }
  const records = newestFirst.reverse();
  const retainedPreparedIds = records.flatMap((record) =>
    record.kind === "legacy_poi_prepared" ? [record.envelope.outcomeId] : []);
  const protectedOutcomeIds = records.flatMap((record) =>
    record.kind === "legacy_poi_prepared"
      ? [record.envelope.outcomeId]
      : record.kind === "applied_return" &&
          (record.returnPending || record.persistenceAuthority === "galaxy")
        ? [record.outcomeId]
        : []);
  if (invalidAuthorityIds.length > 0) {
    return [reconciliationLock(
      "outcome_authority_invalid",
      [...protectedOutcomeIds, ...invalidAuthorityIds.reverse()],
    )];
  }
  if (invalidPrepared) {
    return [reconciliationLock(
      "prepared_outcome_invalid",
      [...protectedOutcomeIds, ...invalidPreparedIds.reverse()],
    )];
  }
  const overflowDiscard = records.slice(0, Math.max(0, records.length - OUTCOME_RECOVERY_LIMIT));
  if (overflowDiscard.some((record) =>
    record.kind === "legacy_poi_prepared" || (record.kind === "applied_return" && record.returnPending))) {
    return [reconciliationLock("recovery_capacity_exceeded", protectedOutcomeIds)];
  }
  if (retainedPreparedIds.length > 1) {
    return [reconciliationLock("prepared_outcome_invalid", retainedPreparedIds)];
  }
  return records.slice(-OUTCOME_RECOVERY_LIMIT);
}

function createDefaultSave(): SaveData {
  return {
  saveRevision: 0,
  appliedOutcomeIds: [],
  outcomeRecoveryRecords: [],
  currentWorld: 1,
  levels: {},
  credits: 0,
  totalStars: 0,
  totalScore: 0,
  xp: 0,
  introSeen: undefined,
  upgrades: { ...DEFAULT_UPGRADES },
  unlockedCodex: [],
  viewedCodex: [],
  viewedConversations: [],
  completedQuests: [],
  activeQuests: [],
  completedPlanets: [],
  unlockedSpecialMissions: [],
  completedSpecialMissions: [],
  storyItems: [],
  materials: [],
  consumableInventory: {},
  equippedConsumables: [],
  unlockedEnhancements: [],
  bestiary: {},
  equippedWeaponType: "kinetic",
  pilotLevel: 1,
  skillPoints: 0,
  allocatedSkills: [],
  colonies: [],
  planets: [createPlanetRegionState("ashfall", ASHFALL_REGION_SEED)],
  earthShipments: [],
  factionStandings: defaultFactionStandings(),
  bounties: [],
  missionsSinceStart: 0,
  gameClock: {
    day: 0,
    hour: 7,
    minute: 0,
    realtimeMsPerGameMinute: 1000,
    season: "standard",
  },
  activeExperience: "legacy",
  galaxyRun: null,
  };
}

/** Stable server/client seed; browser persistence is loaded only after hydration. */
export function createHydrationSafeSave(): SaveData {
  return createDefaultSave();
}

/** Migrate old saves that lack new fields */
export function migrateSave(raw: Record<string, unknown>): SaveData {
  const colonies = migrateColonies(raw.colonies);
  const planets = migratePlanets(raw.planets, colonies);
  const rawGalaxyRunField = snapshotOwnField(raw, "galaxyRun");
  const rawGalaxyRun = rawGalaxyRunField.kind === "data" ? rawGalaxyRunField.value : null;
  const rawGalaxyJournalInspection = rawGalaxyRun === null || rawGalaxyRun === undefined
    ? { ok: true as const, nestedOutcomeIds: [], operationOwners: new Map<string, string>() }
    : inspectGalaxyOutcomeJournals(rawGalaxyRun, OUTCOME_JOURNAL_LIMIT);
  const rawGalaxyHistoryField = rawGalaxyRun !== null && typeof rawGalaxyRun === "object" && !Array.isArray(rawGalaxyRun)
    ? snapshotOwnField(rawGalaxyRun, "historyFacts")
    : { kind: "absent" as const };
  const rawPreparedInspection: GalaxyPoiPreparedAuthorityInspection = rawGalaxyHistoryField.kind === "absent"
    ? { status: "none" }
    : inspectGalaxyPoiPreparedAuthority(rawGalaxyRun);
  const rawGalaxyIdentityField = rawGalaxyRun !== null && typeof rawGalaxyRun === "object" && !Array.isArray(rawGalaxyRun)
    ? snapshotOwnField(rawGalaxyRun, "identity")
    : { kind: "absent" as const };
  const identitySource = rawGalaxyIdentityField.kind === "data"
    ? ownDataRecord(rawGalaxyIdentityField.value)
    : null;
  const identityIsComplete = identitySource !== null
    && typeof identitySource.galaxySeed === "string"
    && Number.isSafeInteger(identitySource.generationVersion)
    && (identitySource.generationVersion as number) >= 0
    && Number.isSafeInteger(identitySource.authoredAnchorRegistryVersion)
    && (identitySource.authoredAnchorRegistryVersion as number) >= 0;
  let galaxyRun: SaveData["galaxyRun"] = null;
  if (identityIsComplete) {
    try { galaxyRun = migrateGalaxyRun(rawGalaxyRun); }
    catch { galaxyRun = null; }
  }
  const rawRevisionField = snapshotOwnField(raw, "saveRevision");
  const rawJournalField = snapshotOwnField(raw, "appliedOutcomeIds");
  const rawRecoveryField = snapshotOwnField(raw, "outcomeRecoveryRecords");
  const isPreA3Authority = rawRevisionField.kind === "absent" && rawJournalField.kind === "absent" &&
    rawRecoveryField.kind === "absent";
  const absentAuthorityFieldCount = Number(rawRevisionField.kind === "absent") +
    Number(rawJournalField.kind === "absent") + Number(rawRecoveryField.kind === "absent");
  const hasPartialA3Authority = absentAuthorityFieldCount > 0 && absentAuthorityFieldCount < 3;
  const saveRevision = rawRevisionField.kind === "data" && Number.isSafeInteger(rawRevisionField.value) &&
    (rawRevisionField.value as number) >= 0
    ? rawRevisionField.value as number
    : 0;
  const activeExperience = raw.activeExperience === "galaxy" && galaxyRun !== null
    ? "galaxy"
    : "legacy";
  const missionsSinceStart = (raw.missionsSinceStart as number) ?? 0;
  const journalSnapshot = rawJournalField.kind === "data" ? snapshotDenseArray(rawJournalField.value) :
    rawJournalField.kind === "absent" ? [] : null;
  const strictRootJournal = rawJournalField.kind === "data"
    ? snapshotStrictStringJournal(rawJournalField.value)
    : rawJournalField.kind === "absent" ? [] : null;
  const recoverySnapshot = rawRecoveryField.kind === "absent"
    ? []
    : rawRecoveryField.kind === "data" ? snapshotDenseArray(rawRecoveryField.value) : null;
  const preA3SeedIsCoherent = isPreA3Authority && rawGalaxyJournalInspection.ok &&
    rawGalaxyJournalInspection.operationOwners.size === rawGalaxyJournalInspection.nestedOutcomeIds.length;
  const malformedGalaxyRunContainer = rawGalaxyRunField.kind === "invalid";
  const malformedJournalContainer = rawJournalField.kind !== "absent" && strictRootJournal === null;
  const malformedRecoveryContainer = recoverySnapshot === null;
  const malformedRevision = rawRevisionField.kind === "invalid" ||
    (rawRevisionField.kind === "data" && (!Number.isSafeInteger(rawRevisionField.value) ||
      (rawRevisionField.value as number) < 0));
  const rawOutcomeJournal = preA3SeedIsCoherent
    ? [...rawGalaxyJournalInspection.nestedOutcomeIds]
    : migrateStringJournal(journalSnapshot ?? []);
  let outcomeRecoveryRecords = migrateOutcomeRecoveryRecords(
    recoverySnapshot ?? [],
    saveRevision,
    rawOutcomeJournal,
    { colonies, planets, missionsSinceStart, galaxyRun },
  );
  const opaqueAuthorityCount = Number(malformedGalaxyRunContainer) + Number(malformedJournalContainer) +
    Number(malformedRecoveryContainer) + Number(malformedRevision) +
    Number(isPreA3Authority && !preA3SeedIsCoherent);
  if (opaqueAuthorityCount > 0) {
    outcomeRecoveryRecords = reconcileRecoveryAuthority(
      outcomeRecoveryRecords,
      "outcome_authority_invalid",
      [],
      opaqueAuthorityCount,
    );
  }
  if (hasPartialA3Authority) {
    outcomeRecoveryRecords = reconcileRecoveryAuthority(
      outcomeRecoveryRecords,
      "outcome_authority_invalid",
      [],
      0,
    );
  }
  const rawParity = snapshotGalaxyOutcomeAuthority(
    rawGalaxyRun,
    rawOutcomeJournal,
    outcomeRecoveryRecords,
    OUTCOME_JOURNAL_LIMIT,
  );
  if (!rawParity.ok) {
    outcomeRecoveryRecords = reconcileRecoveryAuthority(
      outcomeRecoveryRecords,
      "outcome_authority_invalid",
      rawParity.knownOutcomeIds,
      rawParity.quarantinedOutcomeCount,
    );
  }
  if (rawPreparedInspection.status === "invalid") {
    outcomeRecoveryRecords = reconcileRecoveryAuthority(
      outcomeRecoveryRecords,
      "prepared_outcome_invalid",
      [],
      rawPreparedInspection.quarantinedCount,
    );
  } else if (rawPreparedInspection.status === "valid") {
    const preparation = rawPreparedInspection.preparation;
    const migratedInspection = galaxyRun === null
      ? { status: "invalid" as const, quarantinedCount: 1 }
      : inspectGalaxyPoiPreparedAuthority(galaxyRun);
    const migratedMatches = migratedInspection.status === "valid" &&
      migratedInspection.preparation.launchId === preparation.launchId &&
      migratedInspection.preparation.outcomeId === preparation.outcomeId &&
      migratedInspection.preparation.preparedRevision === preparation.preparedRevision &&
      migratedInspection.preparation.factId === preparation.factId;
    const nestedOutcomeIds = galaxyRun?.appliedOutcomeIds ?? [];
    if (!migratedMatches || activeExperience !== "galaxy" ||
      preparation.preparedRevision !== saveRevision || rawOutcomeJournal.includes(preparation.outcomeId) ||
      nestedOutcomeIds.includes(preparation.outcomeId)) {
      outcomeRecoveryRecords = reconcileRecoveryAuthority(
        outcomeRecoveryRecords,
        "prepared_outcome_invalid",
        [preparation.outcomeId],
        1,
      );
    }
  }
  let protectedOutcomeIds = [
    ...protectedRecoveryOutcomeIds(outcomeRecoveryRecords),
    ...(rawParity.ok ? rawParity.nestedOutcomeIds : []),
  ];
  let appliedOutcomeIds = migrateOutcomeJournal(rawOutcomeJournal, protectedOutcomeIds);
  const parity = snapshotGalaxyOutcomeAuthority(
    galaxyRun,
    appliedOutcomeIds,
    outcomeRecoveryRecords,
    OUTCOME_JOURNAL_LIMIT,
  );
  if (!parity.ok) {
    outcomeRecoveryRecords = reconcileRecoveryAuthority(
      outcomeRecoveryRecords,
      "outcome_authority_invalid",
      parity.knownOutcomeIds,
      parity.quarantinedOutcomeCount,
    );
    protectedOutcomeIds = protectedRecoveryOutcomeIds(outcomeRecoveryRecords);
    appliedOutcomeIds = migrateOutcomeJournal(rawOutcomeJournal, protectedOutcomeIds);
  }
  return {
    saveRevision,
    appliedOutcomeIds,
    outcomeRecoveryRecords,
    currentWorld: (raw.currentWorld as number) ?? 1,
    levels: (raw.levels as SaveData["levels"]) ?? {},
    credits: (raw.credits as number) ?? 0,
    totalStars: (raw.totalStars as number) ?? 0,
    totalScore: (raw.totalScore as number) ?? 0,
    xp: (raw.xp as number) ?? 0,
    introSeen: (raw.introSeen as boolean) ?? undefined,
    upgrades: (raw.upgrades as ShipUpgrades) ?? { ...DEFAULT_UPGRADES },
    unlockedCodex: (raw.unlockedCodex as string[]) ?? [],
    viewedCodex: (raw.viewedCodex as string[]) ?? [],
    viewedConversations: (raw.viewedConversations as string[]) ?? [],
    completedQuests: (raw.completedQuests as string[]) ?? [],
    activeQuests: (raw.activeQuests as string[]) ?? [],
    completedPlanets: (raw.completedPlanets as PlanetId[]) ?? [],
    unlockedSpecialMissions: (raw.unlockedSpecialMissions as SpecialMissionId[]) ?? [],
    completedSpecialMissions: (raw.completedSpecialMissions as SpecialMissionId[]) ?? [],
    storyItems: (raw.storyItems as StoryItemId[]) ?? [],
    materials: (raw.materials as MaterialId[]) ?? [],
    consumableInventory: (raw.consumableInventory as Partial<Record<ConsumableId, number>>) ?? {},
    equippedConsumables: (raw.equippedConsumables as ConsumableId[]) ?? [],
    unlockedEnhancements: (raw.unlockedEnhancements as EnhancementId[]) ?? [],
    bestiary: (raw.bestiary as SaveData["bestiary"]) ?? {},
    equippedWeaponType: (raw.equippedWeaponType as WeaponType | undefined) ?? "kinetic",
    pilotLevel: (raw.pilotLevel as number) ?? 1,
    skillPoints: (raw.skillPoints as number) ?? 0,
    allocatedSkills: (raw.allocatedSkills as SaveData["allocatedSkills"]) ?? [],
    colonies,
    planets,
    earthShipments: (raw.earthShipments as EarthShipment[]) ?? [],
    factionStandings: (raw.factionStandings as FactionStanding[]) ?? defaultFactionStandings(),
    bounties: (raw.bounties as Bounty[]) ?? [],
    missionsSinceStart,
    gameClock: (raw.gameClock as GameClock) ?? {
      day: 0,
      hour: 7,
      minute: 0,
      realtimeMsPerGameMinute: 1000,
      season: "standard",
    },
    activeExperience,
    galaxyRun,
  };
}

const INTEL_STATES = new Set<RegionIntelState>(["unknown", "rumored", "surveyed", "cleared", "claimed"]);
const LEGACY_ASHFALL_ANCHORS = new Set(["ashfall_starter_region", "dev_seed_region"]);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function finite(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function migrateSiteStats(value: unknown, fallback: SiteStats = neutralSiteStats()): SiteStats {
  const source = record(value);
  return {
    oreDensity: finite(source.oreDensity, fallback.oreDensity),
    waterTable: finite(source.waterTable, fallback.waterTable),
    buildableSlots: finite(source.buildableSlots, fallback.buildableSlots),
    threat: finite(source.threat, fallback.threat),
  };
}

function migrateColonies(value: unknown): ColonyState[] {
  if (!Array.isArray(value)) return [];
  return value.map(entry => {
    const source = record(entry);
    const planetId = source.planetId as PlanetId;
    const oldNodeId = String(source.regionNodeId ?? "");
    const regionNodeId = planetId === "ashfall" && LEGACY_ASHFALL_ANCHORS.has(oldNodeId)
      ? "ashfall-forward-camp"
      : oldNodeId;
    return {
      ...source,
      regionNodeId,
      siteStats: migrateSiteStats(source.siteStats),
    } as unknown as ColonyState;
  });
}

function titleFromId(id: string): string {
  return id
    .split(/[-_]/g)
    .filter(Boolean)
    .map(part => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function migrateIntel(source: Record<string, unknown>): RegionIntelState {
  if (source.intel === "claimed") return "claimed";
  if (source.cleared === true) return "cleared";
  if (typeof source.intel === "string" && INTEL_STATES.has(source.intel as RegionIntelState)) {
    return source.intel as RegionIntelState;
  }
  if (source.discovered === true) return "rumored";
  return "unknown";
}

function migrateRegionNode(value: unknown, fallback?: RegionNode): RegionNode {
  const source = record(value);
  const id = String(source.id ?? fallback?.id ?? "region-node");
  const type = (source.type ?? fallback?.type ?? "wilderness") as RegionNode["type"];
  const intel = migrateIntel(source.intel === undefined && source.discovered === undefined && fallback
    ? { ...source, intel: fallback.intel }
    : source);
  const fallbackStats = fallback?.siteStats ?? neutralSiteStats();
  const siteStats = type === "colony_site"
    ? migrateSiteStats(source.siteStats, fallbackStats)
    : null;
  const rawCoords = record(source.coords);
  return {
    id,
    name: String(source.name ?? fallback?.name ?? titleFromId(id)),
    type,
    intel,
    siteStats,
    discovered: intel !== "unknown",
    authored: (source.authored as boolean | undefined) ?? fallback?.authored ?? false,
    templateId: (source.templateId as string | null | undefined) ?? fallback?.templateId ?? null,
    seed: finite(source.seed, fallback?.seed ?? 0),
    cleared: intel === "cleared" || intel === "claimed",
    respawnMissions: (source.respawnMissions as number | null | undefined) ?? fallback?.respawnMissions ?? null,
    coords: {
      x: finite(rawCoords.x, fallback?.coords.x ?? 50),
      y: finite(rawCoords.y, fallback?.coords.y ?? 50),
    },
    elevationMetadata: (source.elevationMetadata as RegionNode["elevationMetadata"] | undefined)
      ?? fallback?.elevationMetadata
      ?? null,
  };
}

function migratePlanet(value: unknown): PlanetState {
  const source = record(value);
  const id = (source.id ?? "ashfall") as PlanetId;
  const rawMap = record(source.regionMap);
  const seed = finite(rawMap.seed, id === "ashfall" ? ASHFALL_REGION_SEED : 0);
  const generated = generateRegionMap(id, seed);
  const rawNodes = Array.isArray(rawMap.nodes) ? rawMap.nodes : [];
  const generatedById = new Map(generated.nodes.map(node => [node.id, node]));
  const migratedNodes = rawNodes.length > 0
    ? rawNodes.map(nodeValue => {
        const nodeSource = record(nodeValue);
        return migrateRegionNode(nodeValue, generatedById.get(String(nodeSource.id ?? "")));
      })
    : [];
  const migratedIds = new Set(migratedNodes.map(node => node.id));
  const nodes = [
    ...migratedNodes,
    ...generated.nodes
      .filter(node => !migratedIds.has(node.id))
      .map(node => migrateRegionNode(node, node)),
  ];
  const nodeIds = new Set(nodes.map(node => node.id));
  const rawEdges: [string, string][] = Array.isArray(rawMap.edges)
    ? rawMap.edges
        .filter((edge): edge is unknown[] => Array.isArray(edge) && edge.length >= 2)
        .map(edge => [String(edge[0]), String(edge[1])] as [string, string])
        .filter(([from, to]) => nodeIds.has(from) && nodeIds.has(to))
    : [];
  const edgeKeys = new Set(rawEdges.map(([from, to]) => `${from}\u0000${to}`));
  const edges: [string, string][] = [
    ...rawEdges,
    ...generated.edges.filter(([from, to]) => {
      const key = `${from}\u0000${to}`;
      if (edgeKeys.has(key)) return false;
      edgeKeys.add(key);
      return true;
    }),
  ];
  const generatedPlanet = createPlanetRegionState(id, seed);
  return {
    id,
    regionMap: { seed, nodes, edges },
    biome: (source.biome as PlanetState["biome"] | undefined) ?? generatedPlanet.biome,
    campaignUnlocked: (source.campaignUnlocked as boolean | undefined) ?? generatedPlanet.campaignUnlocked,
  };
}

function migratePlanets(value: unknown, colonies: readonly ColonyState[]): PlanetState[] {
  const source = Array.isArray(value) ? value.map(migratePlanet) : [];
  if (!source.some(planet => planet.id === "ashfall")) {
    source.push(createPlanetRegionState("ashfall", ASHFALL_REGION_SEED));
  }
  return source.map(planet => {
    const claimed = new Set(colonies.filter(colony => colony.planetId === planet.id).map(colony => colony.regionNodeId));
    if (claimed.size === 0) return planet;
    return {
      ...planet,
      regionMap: {
        ...planet.regionMap,
        nodes: planet.regionMap.nodes.map(node => claimed.has(node.id)
          ? { ...node, intel: "claimed", discovered: true, cleared: true }
          : node),
      },
    };
  });
}

/** Recalculate pilot level and available skill points from total XP.
 *  Called on load to ensure save data is consistent. */
export function recalcPilotLevel(save: SaveData): SaveData {
  const level = calcPilotLevel(save.xp);
  const totalPoints = skillPointsAtLevel(level);
  let spentPoints = 0;
  for (const id of save.allocatedSkills) {
    const node = getNode(id);
    spentPoints += node?.cost ?? 1;
  }
  return {
    ...save,
    pilotLevel: level,
    skillPoints: Math.max(0, totalPoints - spentPoints),
  };
}

export function loadSave(): SaveData {
  if (typeof window === "undefined") return createDefaultSave();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return unlockCodexEntries(createDefaultSave());
    const parsed = JSON.parse(raw);
    return recalcPilotLevel(unlockCodexEntries(migrateSave(parsed)));
  } catch {
    return unlockCodexEntries(createDefaultSave());
  }
}

export function saveSave(data: SaveData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

export function unlockSpecialMission(save: SaveData, missionId: SpecialMissionId): SaveData {
  if (save.unlockedSpecialMissions.includes(missionId)) return save;
  return {
    ...save,
    unlockedSpecialMissions: [...save.unlockedSpecialMissions, missionId],
  };
}

export function completeSpecialMission(save: SaveData, missionId: SpecialMissionId): SaveData {
  if (save.completedSpecialMissions.includes(missionId)) return save;
  return {
    ...save,
    completedSpecialMissions: [...save.completedSpecialMissions, missionId],
  };
}

export function addStoryItem(save: SaveData, itemId: StoryItemId): SaveData {
  if (save.storyItems.includes(itemId)) return save;
  return {
    ...save,
    storyItems: [...save.storyItems, itemId],
  };
}

// ─── Credits Economy ────────────────────────────────────────────────

export function calculateCreditsEarned(
  score: number,
  stars: number,
  world: number,
  pilotLevel: number = 1
): number {
  const baseCredits = Math.floor(score / 10);
  const starBonus = stars * 50;
  const worldMultiplier = 1 + (world - 1) * 0.2;
  const pilotMultiplier = 1 + creditBonus(pilotLevel);
  return Math.floor((baseCredits + starBonus) * worldMultiplier * pilotMultiplier);
}

// ─── Level Results ──────────────────────────────────────────────────

export function updateLevelResult(
  save: SaveData,
  world: number,
  level: number,
  score: number,
  stars: number,
  xpEarned: number = 0
): SaveData {
  const key = `${world}-${level}`;
  const existing = save.levels[key];

  const newLevel = {
    completed: true,
    stars: Math.max(existing?.stars ?? 0, stars),
    highScore: Math.max(existing?.highScore ?? 0, score),
  };

  const newLevels = { ...save.levels, [key]: newLevel };

  // Calculate totals
  let totalStars = 0;
  let totalScore = 0;
  for (const lv of Object.values(newLevels)) {
    totalStars += lv.stars;
    totalScore += lv.highScore;
  }

  // Award credits
  const creditsEarned = calculateCreditsEarned(score, stars, world, save.pilotLevel);

  const updated: SaveData = {
    ...save,
    levels: newLevels,
    totalStars,
    totalScore,
    credits: save.credits + creditsEarned,
    xp: save.xp + xpEarned,
  };

  // Auto-unlock codex entries based on new progression
  return unlockCodexEntries(updated);
}

// ─── Upgrades ───────────────────────────────────────────────────────

export function purchaseUpgrade(
  save: SaveData,
  upgradeId: keyof ShipUpgrades,
  cost: number
): SaveData | null {
  if (save.credits < cost) return null;
  return {
    ...save,
    credits: save.credits - cost,
    upgrades: {
      ...save.upgrades,
      [upgradeId]: save.upgrades[upgradeId] + 1,
    },
  };
}

// ─── Profile ────────────────────────────────────────────────────────

export function updateSectorZeroProfile(score: number): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem("sector-zero-profile");
    const profile = raw ? JSON.parse(raw) : null;
    if (!profile) return;
    const stats = profile.games?.["sector-zero"] || {
      gamesPlayed: 0,
      highScore: 0,
      lastPlayed: null,
    };
    stats.gamesPlayed += 1;
    if (score > stats.highScore) stats.highScore = score;
    stats.lastPlayed = new Date().toISOString();
    profile.games["sector-zero"] = stats;
    profile.lastPlayed = stats.lastPlayed;
    localStorage.setItem("sector-zero-profile", JSON.stringify(profile));
  } catch {}
}

export function getPlayerName(): string {
  if (typeof window === "undefined") return "Guest";
  try {
    const raw = localStorage.getItem("sector-zero-profile");
    const profile = raw ? JSON.parse(raw) : null;
    return profile?.name || "Guest";
  } catch {
    return "Guest";
  }
}

export function __runSaveSelfTests(): void {
  const migrated = recalcPilotLevel(unlockCodexEntries(migrateSave({})));
  console.assert(Array.isArray(migrated.unlockedSpecialMissions), "Special mission unlocks should migrate to an array");
  console.assert(Array.isArray(migrated.completedSpecialMissions), "Completed special missions should migrate to an array");
  console.assert(Array.isArray(migrated.storyItems), "Story items should migrate to an array");

  const unlocked = unlockSpecialMission(migrated, "kepler-black-box");
  console.assert(unlocked.unlockedSpecialMissions.includes("kepler-black-box"), "Special mission should unlock once");

  const completed = completeSpecialMission(unlocked, "kepler-black-box");
  console.assert(completed.completedSpecialMissions.includes("kepler-black-box"), "Special mission should complete once");

  const withItem = addStoryItem(completed, "kepler-black-box");
  console.assert(withItem.storyItems.includes("kepler-black-box"), "Story item should persist once");
}

if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
  __runSaveSelfTests();
}

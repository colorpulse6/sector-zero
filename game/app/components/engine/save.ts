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
export type { SaveData };

const SAVE_KEY = "sector-zero-save";
export const OUTCOME_JOURNAL_LIMIT = 256;
export const OUTCOME_RECOVERY_LIMIT = 32;

function migrateStringJournal(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const newestFirst: string[] = [];
  const seen = new Set<string>();
  for (let index = value.length - 1; index >= 0; index -= 1) {
    const entry = value[index];
    if (typeof entry !== "string" || entry.length === 0 || seen.has(entry)) continue;
    seen.add(entry);
    newestFirst.push(entry);
  }
  return newestFirst.reverse();
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

function snapshotOutcomeEnvelope(value: unknown): Record<string, unknown> | null {
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
    !Array.isArray(envelope.declaredFields)) return null;
  const fields = envelope.declaredFields as string[];
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
  return isPlainSerializable(envelope) ? envelope : null;
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
  return structuredClone(source) as unknown as OutcomeRecoveryRecord;
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
    !Array.isArray(source.protectedOutcomeIds) ||
    source.protectedOutcomeIds.some((id) => typeof id !== "string" || id.length === 0) ||
    new Set(source.protectedOutcomeIds).size !== source.protectedOutcomeIds.length) return null;
  const priorQuarantine = source.version === 2 && Number.isSafeInteger(source.quarantinedOutcomeCount) &&
    (source.quarantinedOutcomeCount as number) >= 0
    ? source.quarantinedOutcomeCount as number
    : source.version === 1 ? 0 : -1;
  if (priorQuarantine < 0) return null;
  return reconciliationLock(
    source.reason as OutcomeReconciliationReason,
    source.protectedOutcomeIds as string[],
    priorQuarantine,
  );
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

function migrateOutcomeRecoveryRecords(
  value: unknown,
  rootRevision: number,
  rootJournal: readonly string[],
): OutcomeRecoveryRecord[] {
  if (!Array.isArray(value)) return [];
  const newestFirst: OutcomeRecoveryRecord[] = [];
  const seen = new Set<string>();
  const invalidPreparedIds: string[] = [];
  let invalidPrepared = false;
  const invalidAuthorityIds: string[] = [];
  for (let index = value.length - 1; index >= 0; index -= 1) {
    const entry = value[index];
    const source = ownDataRecord(entry);
    if (source === null) continue;
    if (source.kind === "reconciliation_required") {
      const lock = snapshotReconciliation(entry);
      if (lock !== null) return [lock];
      continue;
    }
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
      record = structuredClone(entry) as OutcomeRecoveryRecord;
      identity = envelope.outcomeId;
    } else {
      continue;
    }
    if (typeof identity !== "string" || identity.length === 0 || seen.has(identity)) continue;
    if (record === null) continue;
    seen.add(identity);
    newestFirst.push(record);
  }
  const records = newestFirst.reverse();
  const protectedOutcomeIds = records.flatMap((record) =>
    record.kind === "legacy_poi_prepared"
      ? [record.envelope.outcomeId]
      : record.kind === "applied_return" && record.returnPending
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
  const rawGalaxyRun = raw.galaxyRun;
  const rawGalaxyIdentity = rawGalaxyRun !== null
      && typeof rawGalaxyRun === "object"
      && !Array.isArray(rawGalaxyRun)
      && Object.prototype.hasOwnProperty.call(rawGalaxyRun, "identity")
    ? (rawGalaxyRun as Record<string, unknown>).identity
    : null;
  const identitySource = rawGalaxyIdentity !== null
      && typeof rawGalaxyIdentity === "object"
      && !Array.isArray(rawGalaxyIdentity)
    ? rawGalaxyIdentity as Record<string, unknown>
    : null;
  const identityIsComplete = identitySource !== null
    && Object.prototype.hasOwnProperty.call(identitySource, "galaxySeed")
    && typeof identitySource.galaxySeed === "string"
    && Object.prototype.hasOwnProperty.call(identitySource, "generationVersion")
    && Number.isSafeInteger(identitySource.generationVersion)
    && (identitySource.generationVersion as number) >= 0
    && Object.prototype.hasOwnProperty.call(
      identitySource,
      "authoredAnchorRegistryVersion",
    )
    && Number.isSafeInteger(identitySource.authoredAnchorRegistryVersion)
    && (identitySource.authoredAnchorRegistryVersion as number) >= 0;
  const galaxyRun = identityIsComplete ? migrateGalaxyRun(rawGalaxyRun) : null;
  const saveRevision = Number.isSafeInteger(raw.saveRevision) && (raw.saveRevision as number) >= 0
    ? raw.saveRevision as number
    : 0;
  const rawOutcomeJournal = migrateStringJournal(raw.appliedOutcomeIds);
  const outcomeRecoveryRecords = migrateOutcomeRecoveryRecords(
    raw.outcomeRecoveryRecords,
    saveRevision,
    rawOutcomeJournal,
  );
  const protectedOutcomeIds = outcomeRecoveryRecords.flatMap((record) =>
    record.kind === "applied_return"
      ? record.returnPending ? [record.outcomeId] : []
      : record.kind === "legacy_poi_prepared"
        ? [record.envelope.outcomeId]
        : record.protectedOutcomeIds);
  return {
    saveRevision,
    appliedOutcomeIds: migrateOutcomeJournal(rawOutcomeJournal, protectedOutcomeIds),
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
    missionsSinceStart: (raw.missionsSinceStart as number) ?? 0,
    gameClock: (raw.gameClock as GameClock) ?? {
      day: 0,
      hour: 7,
      minute: 0,
      realtimeMsPerGameMinute: 1000,
      season: "standard",
    },
    activeExperience: raw.activeExperience === "galaxy" && galaxyRun !== null
      ? "galaxy"
      : "legacy",
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

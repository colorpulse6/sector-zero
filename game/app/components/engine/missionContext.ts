import type {
  ConsumableId,
  EnhancementId,
  PlanetId,
  OutcomeRouteIdentity,
  OutcomeRouteKind,
  SaveData,
  ShipUpgrades,
  SkillNodeId,
  WeaponType,
} from "./types";
import { ALL_LEVELS, WORLD_NAMES } from "./levels";
import { PLANET_DEFS } from "./planets";
import {
  G0_OPERATION_IDS,
  operationDisplayLabel,
} from "./operations/operationCatalog";
import type { OperationId } from "./operations/operationTypes";
import { dispatchPoi } from "../colony/region/poiDispatcher";

export type MissionKind = "campaign" | "planet" | "special" | "operation" | "colony";
export type ControlsProfileId =
  | "shooter"
  | "ground-run"
  | "boarding"
  | "first-person"
  | "turret"
  | "colony-exploration";
export type ReplayPolicy = "repeatable" | "one-shot" | "replay-variant";
export type PersistenceAuthority = "legacy" | "galaxy";
export type EntryProvenance =
  | "selector"
  | "cockpit"
  | "star-map"
  | "atlas"
  | "region"
  | "landing-pad"
  | "retry"
  | "continue";
export type ExperienceRoute =
  | "experience-selector"
  | "legacy-cockpit"
  | "legacy-star-map"
  | "legacy-region"
  | "legacy-colony-exterior"
  | "legacy-landing-pad"
  | "galaxy-atlas"
  | "galaxy-region"
  | "galaxy-colony-exterior"
  | "galaxy-landing-pad";

export interface MissionDescriptor {
  id: string;
  kind: MissionKind;
  title: string;
  locationLabel?: string;
  objectiveLabel: string;
  controlsProfile: ControlsProfileId;
  replayPolicy: ReplayPolicy;
}

export interface PilotLoadout {
  upgrades: ShipUpgrades;
  unlockedEnhancements: EnhancementId[];
  pilotLevel: number;
  allocatedSkills: SkillNodeId[];
  equippedWeaponType: WeaponType;
  equippedConsumables: ConsumableId[];
  consumableInventory: Partial<Record<ConsumableId, number>>;
}

export interface LaunchContext {
  launchId: string;
  mission: MissionDescriptor;
  pilot: PilotLoadout;
  persistenceAuthority: PersistenceAuthority;
  entryProvenance: EntryProvenance;
  returnTarget: ExperienceRoute;
}

export type LaunchIdFactory = () => string;
export type ColonyExplorationMode = "exterior" | "interior";
export type PoiEngineAdapter = "firstPerson" | "boarding" | "groundRun";
export type EngineLaunchRoute =
  | { kind: "campaign"; world: number; level: number }
  | { kind: "planet"; planetId: PlanetId }
  | { kind: "special"; missionId: "kepler-black-box" };

let fallbackLaunchSequence = 0;
const issuedLaunchIds = new Set<string>();
const issuedLaunchContexts = new Map<string, LaunchContext>();
const mountedLaunchContexts = new Map<string, LaunchContext>();

export const createLaunchId: LaunchIdFactory = () => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  fallbackLaunchSequence += 1;
  return `launch:${Date.now().toString(36)}:${fallbackLaunchSequence.toString(36)}`;
};

function issueLaunchId(launchIdFactory: LaunchIdFactory): string {
  const launchId = launchIdFactory();
  if (typeof launchId !== "string") {
    throw new Error("Launch ID factories must return a non-empty, non-blank string.");
  }
  const canonicalLaunchId = launchId.trim();
  if (canonicalLaunchId.length === 0) {
    throw new Error("Launch ID factories must return a non-empty, non-blank string.");
  }
  if (issuedLaunchIds.has(canonicalLaunchId)) {
    throw new Error(`Duplicate launch ID ${canonicalLaunchId}.`);
  }
  issuedLaunchIds.add(canonicalLaunchId);
  return canonicalLaunchId;
}

export function claimLaunchContextForGameState(context: LaunchContext): void {
  if (typeof context.launchId !== "string") {
    throw new Error("Launch contexts require a non-empty, non-blank launch ID.");
  }
  const canonicalLaunchId = context.launchId.trim();
  if (canonicalLaunchId.length === 0) {
    throw new Error("Launch contexts require a non-empty, non-blank launch ID.");
  }
  const snapshot = cloneLaunchContext(context);
  snapshot.launchId = canonicalLaunchId;
  const issued = issuedLaunchContexts.get(canonicalLaunchId);
  if (issued !== undefined && !sameLaunchContext(snapshot, issued)) {
    throw new Error(`Launch context ${canonicalLaunchId} does not match its issued snapshot.`);
  }
  if (mountedLaunchContexts.has(canonicalLaunchId)) {
    throw new Error(`Launch ID ${canonicalLaunchId} is already mounted.`);
  }
  issuedLaunchIds.add(canonicalLaunchId);
  if (issued === undefined) issuedLaunchContexts.set(canonicalLaunchId, cloneLaunchContext(snapshot));
  mountedLaunchContexts.set(canonicalLaunchId, cloneLaunchContext(snapshot));
  context.launchId = canonicalLaunchId;
}

function encodeIdentityComponent(value: string): string {
  return `${value.length}:${value}`;
}

function decodeIdentityComponent(
  identity: string,
  offset: number,
): { value: string; nextOffset: number } | null {
  const separator = identity.indexOf(":", offset);
  if (separator < 0) return null;
  const encodedLength = identity.slice(offset, separator);
  if (!/^[1-9]\d*$/.test(encodedLength)) return null;
  const length = Number(encodedLength);
  if (!Number.isSafeInteger(length)) return null;
  const valueOffset = separator + 1;
  const nextOffset = valueOffset + length;
  if (nextOffset > identity.length) return null;
  return { value: identity.slice(valueOffset, nextOffset), nextOffset };
}

const POI_TEMPLATES: Record<PoiEngineAdapter, string> = {
  firstPerson: "fp-ruin-cinder-relay",
  boarding: "boarding-wreck-oathbreaker",
  groundRun: "ground-canyon-glassknife",
};

export function campaignMissionDescriptor(world: number, level: number): MissionDescriptor {
  const authored = ALL_LEVELS.find((entry) => entry.world === world && entry.level === level);
  if (authored === undefined) {
    throw new Error(`Unknown campaign coordinates ${world}-${level}.`);
  }
  return {
    id: `campaign:${world}-${level}`,
    kind: "campaign",
    title: authored.name,
    locationLabel: WORLD_NAMES[world - 1],
    objectiveLabel: "Complete the campaign level",
    controlsProfile: "shooter",
    replayPolicy: "repeatable",
  };
}

export function planetMissionDescriptor(planetId: PlanetId): MissionDescriptor {
  const planet = PLANET_DEFS.find((entry) => entry.id === planetId);
  if (planet === undefined) throw new Error(`Unknown planet mission ${String(planetId)}.`);
  return {
    id: `planet:${planet.id}`,
    kind: "planet",
    title: planet.name,
    locationLabel: planet.subtitle,
    objectiveLabel: planet.objectiveLabel,
    controlsProfile: "shooter",
    replayPolicy: "one-shot",
  };
}

export function specialMissionDescriptor(missionId: "kepler-black-box"): MissionDescriptor {
  if (missionId !== "kepler-black-box") {
    throw new Error(`Unknown special mission ${String(missionId)}.`);
  }
  return {
    id: "special:kepler-black-box",
    kind: "special",
    title: "Kepler Black Box",
    locationLabel: "Kepler Derelict",
    objectiveLabel: "Recover the black box",
    controlsProfile: "first-person",
    replayPolicy: "one-shot",
  };
}

export function operationMissionDescriptor(operationId: OperationId): MissionDescriptor {
  if (!G0_OPERATION_IDS.includes(operationId)) {
    throw new Error(`Unknown Galaxy operation ${String(operationId)}.`);
  }
  const controlsProfile: ControlsProfileId = operationId === "op:kepler-black-box"
    ? "first-person"
    : "shooter";
  return {
    id: `operation:${operationId}`,
    kind: "operation",
    title: operationDisplayLabel(operationId),
    objectiveLabel: "Complete the authorized operation",
    controlsProfile,
    replayPolicy: "one-shot",
  };
}

function requireIdentity(value: string, label: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) throw new Error(`${label} must be non-empty.`);
  return normalized;
}

export function colonyMissionDescriptor(
  colonyId: string,
  mode: ColonyExplorationMode,
  buildingId?: string,
): MissionDescriptor {
  const ownedColonyId = requireIdentity(colonyId, "Colony ID");
  if (mode !== "exterior" && mode !== "interior") {
    throw new Error(`Unknown Colony exploration mode ${String(mode)}.`);
  }
  const ownedBuildingId = mode === "interior"
    ? requireIdentity(buildingId ?? "", "Interior building ID")
    : null;
  return {
    id: ownedBuildingId === null
      ? `colony:${encodeIdentityComponent(ownedColonyId)}:exterior`
      : `colony:${encodeIdentityComponent(ownedColonyId)}:interior:${encodeIdentityComponent(ownedBuildingId)}`,
    kind: "colony",
    title: mode === "exterior" ? "Colony Exterior" : "Colony Interior",
    locationLabel: ownedColonyId,
    objectiveLabel: "Explore the Colony",
    controlsProfile: "colony-exploration",
    replayPolicy: "repeatable",
  };
}

export function poiMissionDescriptor(
  nodeId: string,
  adapter: PoiEngineAdapter,
): MissionDescriptor {
  const ownedNodeId = requireIdentity(nodeId, "POI node ID");
  const profiles: Record<PoiEngineAdapter, ControlsProfileId> = {
    firstPerson: "first-person",
    boarding: "boarding",
    groundRun: "ground-run",
  };
  const controlsProfile = profiles[adapter];
  if (controlsProfile === undefined) {
    throw new Error(`Unknown POI engine adapter ${String(adapter)}.`);
  }
  return {
    id: `poi:${encodeIdentityComponent(POI_TEMPLATES[adapter])}:${encodeIdentityComponent(ownedNodeId)}`,
    kind: "colony",
    title: "Region Expedition",
    locationLabel: ownedNodeId,
    objectiveLabel: "Complete the POI encounter",
    controlsProfile,
    replayPolicy: "replay-variant",
  };
}

function assertAuthorityReturnTarget(
  authority: PersistenceAuthority,
  returnTarget: ExperienceRoute,
): void {
  const coherent = authority === "legacy"
    ? returnTarget.startsWith("legacy-")
    : returnTarget.startsWith("galaxy-");
  if (!coherent) {
    throw new Error(`${authority} launch authority cannot return through ${returnTarget}.`);
  }
}

function sameDescriptor(left: MissionDescriptor, right: MissionDescriptor): boolean {
  return left.id === right.id &&
    left.kind === right.kind &&
    left.title === right.title &&
    left.locationLabel === right.locationLabel &&
    left.objectiveLabel === right.objectiveLabel &&
    left.controlsProfile === right.controlsProfile &&
    left.replayPolicy === right.replayPolicy;
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

function sameInventory(
  left: PilotLoadout["consumableInventory"],
  right: PilotLoadout["consumableInventory"],
): boolean {
  const leftKeys = Reflect.ownKeys(left);
  const rightKeys = Reflect.ownKeys(right);
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) =>
    key === rightKeys[index] && left[key as ConsumableId] === right[key as ConsumableId]);
}

function samePilotLoadout(left: PilotLoadout, right: PilotLoadout): boolean {
  return left.upgrades.hullPlating === right.upgrades.hullPlating &&
    left.upgrades.engineBoost === right.upgrades.engineBoost &&
    left.upgrades.weaponCore === right.upgrades.weaponCore &&
    left.upgrades.munitionsBay === right.upgrades.munitionsBay &&
    left.upgrades.fireControl === right.upgrades.fireControl &&
    left.upgrades.shieldGenerator === right.upgrades.shieldGenerator &&
    sameStringArray(left.unlockedEnhancements, right.unlockedEnhancements) &&
    left.pilotLevel === right.pilotLevel &&
    sameStringArray(left.allocatedSkills, right.allocatedSkills) &&
    left.equippedWeaponType === right.equippedWeaponType &&
    sameStringArray(left.equippedConsumables, right.equippedConsumables) &&
    sameInventory(left.consumableInventory, right.consumableInventory);
}

function sameLaunchContext(left: LaunchContext, right: LaunchContext): boolean {
  return left.launchId === right.launchId &&
    sameDescriptor(left.mission, right.mission) &&
    samePilotLoadout(left.pilot, right.pilot) &&
    left.persistenceAuthority === right.persistenceAuthority &&
    left.entryProvenance === right.entryProvenance &&
    left.returnTarget === right.returnTarget;
}

function registerIssuedLaunchContext(context: LaunchContext): void {
  const snapshot = cloneLaunchContext(context);
  const existing = issuedLaunchContexts.get(snapshot.launchId);
  if (existing !== undefined && !sameLaunchContext(snapshot, existing)) {
    throw new Error(`Launch context ${snapshot.launchId} conflicts with its issued snapshot.`);
  }
  issuedLaunchContexts.set(snapshot.launchId, snapshot);
}

export function snapshotRetryLaunchContext(
  context: LaunchContext,
  expectedMission: MissionDescriptor,
  persistenceAuthority: PersistenceAuthority,
  returnTarget: ExperienceRoute,
): LaunchContext | null {
  try {
    const snapshot = cloneLaunchContext(context);
    const issued = issuedLaunchContexts.get(snapshot.launchId);
    if (snapshot.launchId !== snapshot.launchId.trim() ||
      issued === undefined || !sameLaunchContext(snapshot, issued) ||
      snapshot.entryProvenance !== "retry" ||
      snapshot.persistenceAuthority !== persistenceAuthority ||
      snapshot.returnTarget !== returnTarget ||
      !sameDescriptor(snapshot.mission, expectedMission)) return null;
    return snapshot;
  } catch {
    return null;
  }
}

function canonicalPoiDescriptorFromId(id: string): MissionDescriptor | null {
  if (!id.startsWith("poi:")) return null;
  const template = decodeIdentityComponent(id, "poi:".length);
  if (template === null || id[template.nextOffset] !== ":") return null;
  const node = decodeIdentityComponent(id, template.nextOffset + 1);
  if (node === null || node.nextOffset !== id.length) return null;
  const adapter = (Object.keys(POI_TEMPLATES) as PoiEngineAdapter[]).find(
    (candidate) => POI_TEMPLATES[candidate] === template.value,
  );
  return adapter === undefined ? null : poiMissionDescriptor(node.value, adapter);
}

interface DecodedPoiIdentity {
  nodeId: string;
  templateId: string;
  engine: PoiEngineAdapter;
}

interface DecodedPoiOutcomeMission {
  descriptorId: string;
  originColonyId: string;
}

function decodePoiIdentity(id: string): DecodedPoiIdentity | null {
  if (!id.startsWith("poi:")) return null;
  const template = decodeIdentityComponent(id, "poi:".length);
  if (template === null || id[template.nextOffset] !== ":") return null;
  const node = decodeIdentityComponent(id, template.nextOffset + 1);
  if (node === null || node.nextOffset !== id.length) return null;
  const engine = (Object.keys(POI_TEMPLATES) as PoiEngineAdapter[]).find(
    (candidate) => POI_TEMPLATES[candidate] === template.value,
  );
  return engine === undefined ? null : { nodeId: node.value, templateId: template.value, engine };
}

const POI_OUTCOME_MISSION_PREFIX = "outcome-poi:";

export function poiOutcomeMissionId(descriptorId: string, originColonyId: string): string {
  if (canonicalPoiDescriptorFromId(descriptorId) === null) {
    throw new Error("POI outcome descriptor identity is malformed.");
  }
  const origin = requireIdentity(originColonyId, "POI outcome origin");
  return `${POI_OUTCOME_MISSION_PREFIX}${encodeIdentityComponent(descriptorId)}:${encodeIdentityComponent(origin)}`;
}

function decodePoiOutcomeMissionId(value: string): DecodedPoiOutcomeMission | null {
  if (!value.startsWith(POI_OUTCOME_MISSION_PREFIX)) return null;
  const descriptor = decodeIdentityComponent(value, POI_OUTCOME_MISSION_PREFIX.length);
  if (descriptor === null || value[descriptor.nextOffset] !== ":" ||
    canonicalPoiDescriptorFromId(descriptor.value) === null) return null;
  const origin = decodeIdentityComponent(value, descriptor.nextOffset + 1);
  return origin !== null && origin.nextOffset === value.length
    ? { descriptorId: descriptor.value, originColonyId: origin.value }
    : null;
}

function canonicalColonyDescriptorFromId(id: string): MissionDescriptor | null {
  if (!id.startsWith("colony:")) return null;
  const colony = decodeIdentityComponent(id, "colony:".length);
  if (colony === null) return null;
  const suffix = id.slice(colony.nextOffset);
  if (suffix === ":exterior") return colonyMissionDescriptor(colony.value, "exterior");
  const interiorMarker = ":interior:";
  if (!suffix.startsWith(interiorMarker)) return null;
  const building = decodeIdentityComponent(id, colony.nextOffset + interiorMarker.length);
  return building !== null && building.nextOffset === id.length
    ? colonyMissionDescriptor(colony.value, "interior", building.value)
    : null;
}

function decodeColonyIdentity(id: string): Extract<OutcomeRouteIdentity, { kind: "colony" }> | null {
  if (!id.startsWith("colony:")) return null;
  const colony = decodeIdentityComponent(id, "colony:".length);
  if (colony === null) return null;
  const suffix = id.slice(colony.nextOffset);
  if (suffix === ":exterior") {
    return { kind: "colony", colonyId: colony.value, mode: "exterior", buildingId: null };
  }
  const interiorMarker = ":interior:";
  if (!suffix.startsWith(interiorMarker)) return null;
  const building = decodeIdentityComponent(id, colony.nextOffset + interiorMarker.length);
  return building !== null && building.nextOffset === id.length
    ? { kind: "colony", colonyId: colony.value, mode: "interior", buildingId: building.value }
    : null;
}

export interface PoiOutcomeRouteInput {
  originColonyId: string;
  rewardEligible: boolean;
}

function exactOutcomeIdentityData(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const actual = Reflect.ownKeys(value);
    if (actual.length !== keys.length || actual.some((key) => typeof key !== "string" || !keys.includes(key))) return null;
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

/** Total hostile-input codec shared by runtime envelopes and save migration. */
export function snapshotOutcomeRouteIdentity(
  value: unknown,
  routeKind: OutcomeRouteKind,
  missionId: string,
): OutcomeRouteIdentity | null {
  let snapshot: Record<string, unknown> | null = null;
  if (routeKind === "campaign") {
    snapshot = exactOutcomeIdentityData(value, ["kind", "world", "level"]);
    if (snapshot === null || snapshot.kind !== routeKind || !Number.isSafeInteger(snapshot.world) ||
      (snapshot.world as number) <= 0 || !Number.isSafeInteger(snapshot.level) || (snapshot.level as number) <= 0) return null;
  } else if (routeKind === "planet") {
    snapshot = exactOutcomeIdentityData(value, ["kind", "planetId"]);
    if (snapshot === null || snapshot.kind !== routeKind || typeof snapshot.planetId !== "string" ||
      snapshot.planetId.length === 0) return null;
  } else if (routeKind === "special") {
    snapshot = exactOutcomeIdentityData(value, ["kind", "missionId"]);
    if (snapshot === null || snapshot.kind !== routeKind || typeof snapshot.missionId !== "string" ||
      snapshot.missionId.length === 0) return null;
  } else if (routeKind === "operation") {
    snapshot = exactOutcomeIdentityData(value, ["kind", "operationId"]);
    if (snapshot === null || snapshot.kind !== routeKind || typeof snapshot.operationId !== "string" ||
      snapshot.operationId.length === 0) return null;
  } else if (routeKind === "colony") {
    snapshot = exactOutcomeIdentityData(value, ["kind", "colonyId", "mode", "buildingId"]);
    if (snapshot === null || snapshot.kind !== routeKind || typeof snapshot.colonyId !== "string" ||
      snapshot.colonyId.length === 0 || (snapshot.mode !== "exterior" && snapshot.mode !== "interior") ||
      (snapshot.mode === "exterior" ? snapshot.buildingId !== null :
        typeof snapshot.buildingId !== "string" || snapshot.buildingId.length === 0)) return null;
  } else if (routeKind === "poi") {
    snapshot = exactOutcomeIdentityData(value, [
      "kind", "originColonyId", "nodeId", "engine", "templateId", "rewardEligible",
    ]);
    if (snapshot === null || snapshot.kind !== routeKind || typeof snapshot.originColonyId !== "string" ||
      snapshot.originColonyId.length === 0 || typeof snapshot.nodeId !== "string" || snapshot.nodeId.length === 0 ||
      typeof snapshot.templateId !== "string" || snapshot.templateId.length === 0 ||
      (snapshot.engine !== "firstPerson" && snapshot.engine !== "boarding" && snapshot.engine !== "groundRun") ||
      typeof snapshot.rewardEligible !== "boolean") return null;
  }
  if (snapshot === null) return null;
  const identity = structuredClone(snapshot) as unknown as OutcomeRouteIdentity;
  if (identity.kind === "poi") {
    const binding = decodePoiOutcomeMissionId(missionId);
    return binding !== null && binding.originColonyId === identity.originColonyId &&
      routeIdentityMatchesMissionId(identity, routeKind, binding.descriptorId)
      ? identity
      : null;
  }
  return routeIdentityMatchesMissionId(identity, routeKind, missionId) ? identity : null;
}

/** Canonical route/authority/return policy shared by runtime and migration. */
export function outcomeAuthorityReturnMatches(
  routeKind: OutcomeRouteKind,
  authority: unknown,
  returnTarget: unknown,
): boolean {
  if (routeKind === "operation") return authority === "galaxy" && returnTarget === "galaxy-atlas";
  if (routeKind === "campaign") return authority === "legacy" &&
    (returnTarget === "legacy-star-map" || returnTarget === "legacy-cockpit");
  if (routeKind === "planet" || routeKind === "special") {
    return authority === "legacy" && returnTarget === "legacy-cockpit";
  }
  if (routeKind === "poi") return (authority === "legacy" && returnTarget === "legacy-colony-exterior") ||
    (authority === "galaxy" && returnTarget === "galaxy-region");
  return (authority === "legacy" &&
    (returnTarget === "legacy-cockpit" || returnTarget === "legacy-colony-exterior" ||
      returnTarget === "legacy-landing-pad")) ||
    (authority === "galaxy" &&
      (returnTarget === "galaxy-atlas" || returnTarget === "galaxy-colony-exterior" ||
        returnTarget === "galaxy-landing-pad"));
}

export type DynamicOutcomeAuthorityPhase = "new" | "applied";

const INVALID_OWN_DATA_TREE = Symbol("invalid-own-data-tree");

function ownDataProperty(value: unknown, key: string): unknown | typeof INVALID_OWN_DATA_TREE {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return INVALID_OWN_DATA_TREE;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return INVALID_OWN_DATA_TREE;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && "value" in descriptor
      ? descriptor.value
      : INVALID_OWN_DATA_TREE;
  } catch {
    return INVALID_OWN_DATA_TREE;
  }
}

/** Recursively detach hostile authority data without invoking property accessors. */
function snapshotOwnDataTree(
  value: unknown,
  ancestors = new Set<object>(),
): unknown | typeof INVALID_OWN_DATA_TREE {
  if (value === null || value === undefined || typeof value === "string" ||
    typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value !== "object" || ancestors.has(value)) return INVALID_OWN_DATA_TREE;
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) return INVALID_OWN_DATA_TREE;
      const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
      if (lengthDescriptor === undefined || !("value" in lengthDescriptor) ||
        !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0) {
        return INVALID_OWN_DATA_TREE;
      }
      const length = lengthDescriptor.value as number;
      const keys = Reflect.ownKeys(value);
      if (keys.length !== length + 1 || keys.some((key) => key !== "length" &&
        (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length))) {
        return INVALID_OWN_DATA_TREE;
      }
      const snapshot: unknown[] = [];
      for (let index = 0; index < length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (descriptor === undefined || !("value" in descriptor)) return INVALID_OWN_DATA_TREE;
        const entry = snapshotOwnDataTree(descriptor.value, ancestors);
        if (entry === INVALID_OWN_DATA_TREE) return INVALID_OWN_DATA_TREE;
        snapshot.push(entry);
      }
      return snapshot;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return INVALID_OWN_DATA_TREE;
    const snapshot: Record<string, unknown> = {};
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") return INVALID_OWN_DATA_TREE;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor)) return INVALID_OWN_DATA_TREE;
      const entry = snapshotOwnDataTree(descriptor.value, ancestors);
      if (entry === INVALID_OWN_DATA_TREE) return INVALID_OWN_DATA_TREE;
      snapshot[key] = entry;
    }
    return snapshot;
  } catch {
    return INVALID_OWN_DATA_TREE;
  } finally {
    ancestors.delete(value);
  }
}

function snapshotDynamicSurface(
  save: SaveData,
  authority: PersistenceAuthority,
): Pick<SaveData, "colonies" | "planets"> | null {
  const container = authority === "galaxy"
    ? ownDataProperty(save, "galaxyRun")
    : save;
  if (container === INVALID_OWN_DATA_TREE || container === null) return null;
  const rawColonies = ownDataProperty(container, "colonies");
  const rawPlanets = ownDataProperty(container, "planets");
  if (rawColonies === INVALID_OWN_DATA_TREE || rawPlanets === INVALID_OWN_DATA_TREE) return null;
  const colonies = snapshotOwnDataTree(rawColonies);
  const planets = snapshotOwnDataTree(rawPlanets);
  return colonies !== INVALID_OWN_DATA_TREE && planets !== INVALID_OWN_DATA_TREE &&
    Array.isArray(colonies) && Array.isArray(planets)
    ? { colonies: colonies as SaveData["colonies"], planets: planets as SaveData["planets"] }
    : null;
}

/** Validate dynamic route identity against the selected latest save namespace. */
export function dynamicOutcomeRouteIdentityIsCanonical(
  save: SaveData,
  identity: OutcomeRouteIdentity,
  authority: PersistenceAuthority,
  phase: DynamicOutcomeAuthorityPhase,
): boolean {
  try {
    const surface = snapshotDynamicSurface(save, authority);
    const identitySnapshot = snapshotOwnDataTree(identity);
    if (surface === null || identitySnapshot === INVALID_OWN_DATA_TREE ||
      typeof identitySnapshot !== "object" || identitySnapshot === null || Array.isArray(identitySnapshot)) return false;
    const canonicalIdentity = identitySnapshot as OutcomeRouteIdentity;
    if (canonicalIdentity.kind === "colony") {
      const data = exactOutcomeIdentityData(canonicalIdentity, ["kind", "colonyId", "mode", "buildingId"]);
      if (data === null || typeof canonicalIdentity.colonyId !== "string" || canonicalIdentity.colonyId.length === 0 ||
        (canonicalIdentity.mode !== "exterior" && canonicalIdentity.mode !== "interior")) return false;
      const colony = surface.colonies.find((entry) => entry.id === canonicalIdentity.colonyId);
      if (colony === undefined) return false;
      return canonicalIdentity.mode === "exterior"
        ? canonicalIdentity.buildingId === null
        : typeof canonicalIdentity.buildingId === "string" && canonicalIdentity.buildingId.length > 0 &&
          colony.buildings.some((building) => building.id === canonicalIdentity.buildingId);
    }
    if (canonicalIdentity.kind !== "poi" || exactOutcomeIdentityData(canonicalIdentity, [
      "kind", "originColonyId", "nodeId", "engine", "templateId", "rewardEligible",
    ]) === null || typeof canonicalIdentity.originColonyId !== "string" || canonicalIdentity.originColonyId.length === 0 ||
      typeof canonicalIdentity.nodeId !== "string" || canonicalIdentity.nodeId.length === 0 ||
      typeof canonicalIdentity.templateId !== "string" || canonicalIdentity.templateId.length === 0 ||
      (canonicalIdentity.engine !== "firstPerson" && canonicalIdentity.engine !== "boarding" &&
        canonicalIdentity.engine !== "groundRun") || typeof canonicalIdentity.rewardEligible !== "boolean") return false;
    const dispatched = dispatchPoi(surface as SaveData, canonicalIdentity.originColonyId, canonicalIdentity.nodeId);
    if (!dispatched.ok || dispatched.session.engine !== canonicalIdentity.engine) return false;
    const colony = surface.colonies.find((entry) => entry.id === canonicalIdentity.originColonyId);
    const node = surface.planets.find((entry) => entry.id === colony?.planetId)
      ?.regionMap.nodes.find((entry) => entry.id === canonicalIdentity.nodeId);
    if (node === undefined || node.templateId !== canonicalIdentity.templateId) return false;
    if (phase === "new") return dispatched.session.rewardEligible === canonicalIdentity.rewardEligible;
    return node.intel === "cleared" || canonicalIdentity.rewardEligible === dispatched.session.rewardEligible;
  } catch {
    return false;
  }
}

export function routeIdentityMatchesMissionId(
  identity: OutcomeRouteIdentity,
  routeKind: OutcomeRouteKind,
  missionId: string,
): boolean {
  try {
    if (identity.kind !== routeKind) return false;
    switch (identity.kind) {
      case "campaign":
        return missionId === campaignMissionDescriptor(identity.world, identity.level).id;
      case "planet":
        return missionId === planetMissionDescriptor(identity.planetId).id;
      case "special":
        return missionId === specialMissionDescriptor(identity.missionId).id;
      case "operation":
        return missionId === operationMissionDescriptor(identity.operationId as OperationId).id;
      case "colony": {
        const decoded = decodeColonyIdentity(missionId);
        return decoded !== null && decoded.colonyId === identity.colonyId && decoded.mode === identity.mode &&
          decoded.buildingId === identity.buildingId;
      }
      case "poi": {
        const decoded = decodePoiIdentity(missionId);
        return decoded !== null && decoded.nodeId === identity.nodeId && decoded.templateId === identity.templateId &&
          decoded.engine === identity.engine;
      }
    }
  } catch {
    return false;
  }
}

export function outcomeRouteIdentityFromLaunch(
  save: SaveData,
  context: LaunchContext,
  routeKind: OutcomeRouteKind,
  poi?: PoiOutcomeRouteInput,
): OutcomeRouteIdentity {
  let identity: OutcomeRouteIdentity;
  if (routeKind === "campaign") {
    const match = /^campaign:([1-9]\d*)-([1-9]\d*)$/.exec(context.mission.id);
    if (match === null) throw new Error("Campaign launch identity is malformed.");
    identity = { kind: "campaign", world: Number(match[1]), level: Number(match[2]) };
  } else if (routeKind === "planet") {
    if (!context.mission.id.startsWith("planet:")) throw new Error("Planet launch identity is malformed.");
    identity = { kind: "planet", planetId: context.mission.id.slice("planet:".length) as PlanetId };
  } else if (routeKind === "special") {
    if (!context.mission.id.startsWith("special:")) throw new Error("Special launch identity is malformed.");
    identity = { kind: "special", missionId: context.mission.id.slice("special:".length) as "kepler-black-box" };
  } else if (routeKind === "operation") {
    if (!context.mission.id.startsWith("operation:")) throw new Error("Operation launch identity is malformed.");
    identity = { kind: "operation", operationId: context.mission.id.slice("operation:".length) };
  } else if (routeKind === "colony") {
    const decoded = decodeColonyIdentity(context.mission.id);
    if (decoded === null) throw new Error("Colony launch identity is malformed.");
    identity = decoded;
  } else {
    const decoded = decodePoiIdentity(context.mission.id);
    if (decoded === null || poi === undefined || typeof poi.originColonyId !== "string" ||
      poi.originColonyId.length === 0 || typeof poi.rewardEligible !== "boolean") {
      throw new Error("POI launch identity is incomplete.");
    }
    const colonies = context.persistenceAuthority === "galaxy" ? save.galaxyRun?.colonies : save.colonies;
    const planets = context.persistenceAuthority === "galaxy" ? save.galaxyRun?.planets : save.planets;
    const colony = colonies?.find((entry) => entry.id === poi.originColonyId);
    const node = planets?.find((entry) => entry.id === colony?.planetId)
      ?.regionMap.nodes.find((entry) => entry.id === decoded.nodeId);
    const canonicalReward = node?.intel === "surveyed";
    if (colony === undefined || node === undefined || node.templateId !== decoded.templateId ||
      (node.intel !== "surveyed" && node.intel !== "cleared") || canonicalReward !== poi.rewardEligible) {
      throw new Error("POI launch identity is not canonical save authority.");
    }
    identity = { kind: "poi", ...decoded, ...poi };
  }
  if (!routeIdentityMatchesMissionId(identity, routeKind, context.mission.id)) {
    throw new Error("Outcome route identity does not match the launched mission.");
  }
  return structuredClone(identity);
}

function assertPolicy(
  context: LaunchContext,
  authority: PersistenceAuthority,
  provenances: readonly EntryProvenance[],
  returnTargets: readonly ExperienceRoute[],
): void {
  if (context.persistenceAuthority !== authority) {
    throw new Error(`Mission authority must be ${authority}.`);
  }
  if (!provenances.includes(context.entryProvenance)) {
    throw new Error(`Mission provenance ${context.entryProvenance} is unauthorized.`);
  }
  if (!returnTargets.includes(context.returnTarget)) {
    throw new Error(`Mission return ${context.returnTarget} is unauthorized.`);
  }
}

function assertCompatibilityShell(context: LaunchContext, world: number, level: number): void {
  if (world !== 1 || level !== 1 || context.mission.kind !== "colony") {
    throw new Error("Mission descriptor does not match the campaign engine shell.");
  }
  const authority = context.persistenceAuthority;
  if (context.mission.id.startsWith("poi:")) {
    const expected = canonicalPoiDescriptorFromId(context.mission.id);
    if (expected === null || !sameDescriptor(context.mission, expected)) {
      throw new Error("POI descriptor does not match its compatibility shell.");
    }
    assertPolicy(
      context,
      authority,
      ["region", "retry", "continue"],
      [authority === "legacy" ? "legacy-colony-exterior" : "galaxy-region"],
    );
    return;
  }
  if (context.mission.id.startsWith("colony:")) {
    const expected = canonicalColonyDescriptorFromId(context.mission.id);
    if (expected === null || !sameDescriptor(context.mission, expected)) {
      throw new Error("Colony descriptor does not match its compatibility shell.");
    }
    assertPolicy(
      context,
      authority,
      ["cockpit", "landing-pad", "retry", "continue"],
      authority === "legacy"
        ? ["legacy-cockpit", "legacy-colony-exterior", "legacy-landing-pad"]
        : ["galaxy-atlas", "galaxy-colony-exterior", "galaxy-landing-pad"],
    );
    return;
  }
  throw new Error("Colony descriptor does not match its compatibility shell.");
}

export function assertLaunchContextMatchesEngineRoute(
  context: LaunchContext,
  route: EngineLaunchRoute,
): void {
  assertAuthorityReturnTarget(context.persistenceAuthority, context.returnTarget);
  if (route.kind === "campaign") {
    if (context.mission.kind === "campaign") {
      const expected = campaignMissionDescriptor(route.world, route.level);
      if (!sameDescriptor(context.mission, expected)) {
        throw new Error("Campaign descriptor does not match engine coordinates.");
      }
      assertPolicy(
        context,
        "legacy",
        ["star-map", "cockpit", "retry", "continue"],
        ["legacy-star-map", "legacy-cockpit"],
      );
      return;
    }
    if (context.mission.kind === "operation") {
      const expected = operationMissionDescriptor("op:hostile-picket");
      if (route.world !== 1 || route.level !== 1 || !sameDescriptor(context.mission, expected)) {
        throw new Error("Operation descriptor does not match the campaign engine shell.");
      }
      assertPolicy(context, "galaxy", ["atlas", "retry", "continue"], ["galaxy-atlas"]);
      return;
    }
    assertCompatibilityShell(context, route.world, route.level);
    return;
  }
  if (route.kind === "planet") {
    if (context.mission.kind === "planet") {
      const expected = planetMissionDescriptor(route.planetId);
      if (!sameDescriptor(context.mission, expected)) {
        throw new Error("Planet descriptor does not match the selected planet.");
      }
      assertPolicy(context, "legacy", ["cockpit", "retry", "continue"], ["legacy-cockpit"]);
      return;
    }
    const expected = operationMissionDescriptor("op:ashfall-sortie");
    if (route.planetId !== "ashfall" || !sameDescriptor(context.mission, expected)) {
      throw new Error("Operation descriptor does not match the planet engine shell.");
    }
    assertPolicy(context, "galaxy", ["atlas", "retry", "continue"], ["galaxy-atlas"]);
    return;
  }
  if (context.mission.kind === "special") {
    const expected = specialMissionDescriptor(route.missionId);
    if (!sameDescriptor(context.mission, expected)) {
      throw new Error("Special descriptor does not match the selected mission.");
    }
    assertPolicy(context, "legacy", ["cockpit", "retry", "continue"], ["legacy-cockpit"]);
    return;
  }
  const expected = operationMissionDescriptor("op:kepler-black-box");
  if (!sameDescriptor(context.mission, expected)) {
    throw new Error("Operation descriptor does not match the special engine shell.");
  }
  assertPolicy(context, "galaxy", ["atlas", "retry", "continue"], ["galaxy-atlas"]);
}

export function clonePilotLoadout(pilot: PilotLoadout): PilotLoadout {
  return {
    upgrades: { ...pilot.upgrades },
    unlockedEnhancements: [...pilot.unlockedEnhancements],
    pilotLevel: pilot.pilotLevel,
    allocatedSkills: [...pilot.allocatedSkills],
    equippedWeaponType: pilot.equippedWeaponType,
    equippedConsumables: [...pilot.equippedConsumables],
    consumableInventory: { ...pilot.consumableInventory },
  };
}

export function cloneLaunchContext(context: LaunchContext): LaunchContext {
  assertAuthorityReturnTarget(context.persistenceAuthority, context.returnTarget);
  return {
    launchId: context.launchId,
    mission: { ...context.mission },
    pilot: clonePilotLoadout(context.pilot),
    persistenceAuthority: context.persistenceAuthority,
    entryProvenance: context.entryProvenance,
    returnTarget: context.returnTarget,
  };
}

export function launchContextFromSave(
  save: SaveData,
  mission: MissionDescriptor,
  persistenceAuthority: PersistenceAuthority,
  entryProvenance: EntryProvenance,
  returnTarget: ExperienceRoute,
  launchIdFactory: LaunchIdFactory = createLaunchId,
): LaunchContext {
  return launchContextFromPilotLoadout(
    {
      upgrades: { ...save.upgrades },
      unlockedEnhancements: [...save.unlockedEnhancements],
      pilotLevel: save.pilotLevel,
      allocatedSkills: [...save.allocatedSkills],
      equippedWeaponType: save.equippedWeaponType,
      equippedConsumables: [...save.equippedConsumables],
      consumableInventory: { ...save.consumableInventory },
    },
    mission,
    persistenceAuthority,
    entryProvenance,
    returnTarget,
    launchIdFactory,
  );
}

export function launchContextFromPilotLoadout(
  pilot: PilotLoadout,
  mission: MissionDescriptor,
  persistenceAuthority: PersistenceAuthority,
  entryProvenance: EntryProvenance,
  returnTarget: ExperienceRoute,
  launchIdFactory: LaunchIdFactory = createLaunchId,
): LaunchContext {
  const launchId = issueLaunchId(launchIdFactory);
  assertAuthorityReturnTarget(persistenceAuthority, returnTarget);
  const context: LaunchContext = {
    launchId,
    mission: { ...mission },
    pilot: clonePilotLoadout(pilot),
    persistenceAuthority,
    entryProvenance,
    returnTarget,
  };
  registerIssuedLaunchContext(context);
  return context;
}

function continuedAttempt(
  context: LaunchContext,
  entryProvenance: "retry" | "continue",
  launchIdFactory: LaunchIdFactory,
): LaunchContext {
  const copy = cloneLaunchContext(context);
  const mounted = mountedLaunchContexts.get(copy.launchId);
  if (mounted === undefined || !sameLaunchContext(copy, mounted)) {
    throw new Error("Retry and continue require an exact claimed mounted launch context.");
  }
  const launchId = issueLaunchId(launchIdFactory);
  if (launchId === context.launchId) {
    throw new Error("A new gameplay attempt requires a new launch ID.");
  }
  const child = { ...copy, launchId, entryProvenance };
  registerIssuedLaunchContext(child);
  return child;
}

export function retryLaunchContext(
  context: LaunchContext,
  launchIdFactory: LaunchIdFactory = createLaunchId,
): LaunchContext {
  return continuedAttempt(context, "retry", launchIdFactory);
}

export function continueLaunchContext(
  context: LaunchContext,
  launchIdFactory: LaunchIdFactory = createLaunchId,
): LaunchContext {
  return continuedAttempt(context, "continue", launchIdFactory);
}

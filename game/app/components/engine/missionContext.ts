import type {
  ConsumableId,
  EnhancementId,
  PlanetId,
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

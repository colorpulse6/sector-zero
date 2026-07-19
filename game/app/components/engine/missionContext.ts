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

let fallbackLaunchSequence = 0;

export const createLaunchId: LaunchIdFactory = () => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  fallbackLaunchSequence += 1;
  return `launch:${Date.now().toString(36)}:${fallbackLaunchSequence.toString(36)}`;
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
      ? `colony:${ownedColonyId}:exterior`
      : `colony:${ownedColonyId}:interior:${ownedBuildingId}`,
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
  const templateIds: Record<PoiEngineAdapter, string> = {
    firstPerson: "fp-ruin-cinder-relay",
    boarding: "boarding-wreck-oathbreaker",
    groundRun: "ground-canyon-glassknife",
  };
  return {
    id: `poi:${templateIds[adapter]}:${ownedNodeId}`,
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
  const launchId = launchIdFactory();
  if (typeof launchId !== "string" || launchId.length === 0) {
    throw new Error("Launch ID factories must return a non-empty string.");
  }
  assertAuthorityReturnTarget(persistenceAuthority, returnTarget);
  return {
    launchId,
    mission: { ...mission },
    pilot: {
      upgrades: { ...save.upgrades },
      unlockedEnhancements: [...save.unlockedEnhancements],
      pilotLevel: save.pilotLevel,
      allocatedSkills: [...save.allocatedSkills],
      equippedWeaponType: save.equippedWeaponType,
      equippedConsumables: [...save.equippedConsumables],
      consumableInventory: { ...save.consumableInventory },
    },
    persistenceAuthority,
    entryProvenance,
    returnTarget,
  };
}

function continuedAttempt(
  context: LaunchContext,
  entryProvenance: "retry" | "continue",
  launchIdFactory: LaunchIdFactory,
): LaunchContext {
  const copy = cloneLaunchContext(context);
  const launchId = launchIdFactory();
  if (typeof launchId !== "string" || launchId.length === 0 || launchId === context.launchId) {
    throw new Error("A new gameplay attempt requires a new non-empty launch ID.");
  }
  return { ...copy, launchId, entryProvenance };
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

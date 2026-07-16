import {
  createGameState,
  createPlanetGameState,
  createSpecialMissionGameState,
} from "../gameEngine";
import type { GalaxyRunState } from "../galaxy/galaxyTypes";
import type {
  EnhancementId,
  SaveData,
  ShipUpgrades,
  SkillNodeId,
} from "../types";
import {
  authorizeOperationLaunch,
  sameOperationLaunchContext,
  snapshotOperationLaunchContext,
} from "./operationCatalog";
import type {
  OperationAvailability,
  OperationLaunchContext,
  OperationLaunchResult,
  OperationUnavailableReason,
} from "./operationTypes";

function unavailable(reason: OperationUnavailableReason): Extract<OperationAvailability, { status: "unavailable" }> {
  return { status: "unavailable", recoverable: true, reasons: [reason] };
}

interface EngineProjectionInput {
  upgrades: ShipUpgrades;
  enhancements: EnhancementId[];
  pilotLevel: number;
  allocatedSkills: SkillNodeId[];
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

const SAVE_DATA_KEYS = [
  "currentWorld", "levels", "credits", "totalStars", "totalScore", "xp",
  "introSeen", "upgrades", "unlockedCodex", "viewedCodex",
  "viewedConversations", "completedQuests", "activeQuests",
  "completedPlanets", "unlockedSpecialMissions", "completedSpecialMissions",
  "storyItems", "materials", "consumableInventory", "equippedConsumables",
  "unlockedEnhancements", "bestiary", "equippedWeaponType", "pilotLevel",
  "skillPoints", "allocatedSkills", "colonies", "planets", "earthShipments",
  "factionStandings", "bounties", "missionsSinceStart", "gameClock",
  "activeExperience", "galaxyRun",
] as const;

const UPGRADE_KEYS = [
  "hullPlating",
  "engineBoost",
  "weaponCore",
  "munitionsBay",
  "fireControl",
  "shieldGenerator",
] as const;

function exactOwnData(
  value: unknown,
  expectedKeys: readonly string[],
): Record<string, unknown> | null {
  if (!isPlainRecord(value)) return null;
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
  ) return null;
  const snapshot: Record<string, unknown> = {};
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor) || typeof descriptor.value === "function") {
      return null;
    }
    snapshot[key] = descriptor.value;
  }
  return snapshot;
}

function arraySnapshot(value: unknown): unknown[] | null {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (
    lengthDescriptor === undefined || !("value" in lengthDescriptor) ||
    !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0
  ) return null;
  const length = lengthDescriptor.value as number;
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== length + 1 ||
    keys.some((key) => key !== "length" && (
      typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length
    ))
  ) return null;
  const snapshot: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !("value" in descriptor) || typeof descriptor.value === "function") {
      return null;
    }
    snapshot.push(descriptor.value);
  }
  return snapshot;
}

function stringArraySnapshot(value: unknown): string[] | null {
  const snapshot = arraySnapshot(value);
  return snapshot !== null && snapshot.every((entry) => typeof entry === "string")
    ? snapshot as string[]
    : null;
}

function upgradeSnapshot(value: unknown): ShipUpgrades | null {
  const snapshot = exactOwnData(value, UPGRADE_KEYS);
  if (snapshot === null || UPGRADE_KEYS.some((key) =>
    !Number.isSafeInteger(snapshot[key]) || (snapshot[key] as number) < 0)) {
    return null;
  }
  return {
    hullPlating: snapshot.hullPlating as number,
    engineBoost: snapshot.engineBoost as number,
    weaponCore: snapshot.weaponCore as number,
    munitionsBay: snapshot.munitionsBay as number,
    fireControl: snapshot.fireControl as number,
    shieldGenerator: snapshot.shieldGenerator as number,
  };
}

function sameUpgrades(left: ShipUpgrades, right: ShipUpgrades): boolean {
  return UPGRADE_KEYS.every((key) => left[key] === right[key]);
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

function canonicalBlackBoxRecovered(run: GalaxyRunState): boolean | null {
  try {
    const root = exactOwnData(run, Reflect.ownKeys(run).filter(
      (key): key is string => typeof key === "string",
    ));
    if (root === null) return null;
    const storyItems = stringArraySnapshot(root.storyItems);
    if (storyItems === null) return null;
    return storyItems.includes("kepler-black-box");
  } catch {
    return null;
  }
}

function lockedProjection(
  projection: SaveData,
  run: GalaxyRunState,
): EngineProjectionInput | null {
  try {
    const snapshot = exactOwnData(projection, SAVE_DATA_KEYS);
    if (snapshot === null) return null;
    const levels = exactOwnData(snapshot.levels, []);
    const completedQuests = stringArraySnapshot(snapshot.completedQuests);
    const activeQuests = stringArraySnapshot(snapshot.activeQuests);
    const completedPlanets = stringArraySnapshot(snapshot.completedPlanets);
    const unlockedSpecialMissions = stringArraySnapshot(snapshot.unlockedSpecialMissions);
    const upgrades = upgradeSnapshot(snapshot.upgrades);
    const enhancements = stringArraySnapshot(snapshot.unlockedEnhancements);
    const allocatedSkills = stringArraySnapshot(snapshot.allocatedSkills);
    const canonicalUpgrades = upgradeSnapshot(run.ship.upgrades);
    const canonicalEnhancements = stringArraySnapshot(run.ship.unlockedEnhancements);
    const canonicalSkills = stringArraySnapshot(run.pilot.allocatedSkills);
    if (
      snapshot.activeExperience !== "legacy" || snapshot.galaxyRun !== null ||
      snapshot.currentWorld !== 1 || levels === null ||
      snapshot.totalStars !== 0 || snapshot.totalScore !== 0 ||
      completedQuests === null || completedQuests.length !== 0 ||
      activeQuests === null || activeQuests.length !== 0 ||
      completedPlanets === null || completedPlanets.length !== 0 ||
      unlockedSpecialMissions === null || unlockedSpecialMissions.length !== 0 ||
      upgrades === null || enhancements === null || allocatedSkills === null ||
      canonicalUpgrades === null || canonicalEnhancements === null || canonicalSkills === null ||
      !Number.isSafeInteger(snapshot.pilotLevel) ||
      !sameUpgrades(upgrades, canonicalUpgrades) ||
      !sameStrings(enhancements, canonicalEnhancements) ||
      snapshot.pilotLevel !== run.pilot.level ||
      !sameStrings(allocatedSkills, canonicalSkills)
    ) return null;
    return {
      upgrades,
      enhancements: enhancements as EnhancementId[],
      pilotLevel: snapshot.pilotLevel as number,
      allocatedSkills: allocatedSkills as SkillNodeId[],
    };
  } catch {
    return null;
  }
}

function fail(
  context: OperationLaunchContext | null,
  reason: OperationUnavailableReason,
): OperationLaunchResult {
  return {
    ok: false,
    context,
    operation: null,
    availability: unavailable(reason),
  };
}

/**
 * Launch an existing engine only after canonical galaxy authorization. The
 * compatibility projection supplies engine state, never availability.
 */
export function launchOperation(
  run: GalaxyRunState,
  projection: SaveData,
  context: OperationLaunchContext,
): OperationLaunchResult {
  let safeContext: OperationLaunchContext | null = null;
  try {
    safeContext = snapshotOperationLaunchContext(context);
    if (safeContext === null) return fail(null, "context_mismatch");
    const safeRun = structuredClone(run);
    const authorization = authorizeOperationLaunch(safeRun, safeContext.operationId);
    if (!authorization.ok) {
      return {
        ok: false,
        context: safeContext,
        operation: authorization.operation,
        availability: authorization.availability,
      };
    }
    if (!sameOperationLaunchContext(authorization.context, safeContext)) {
      return {
        ok: false,
        context: safeContext,
        operation: authorization.operation,
        availability: unavailable("context_mismatch"),
      };
    }
    const engineInput = lockedProjection(projection, safeRun);
    if (engineInput === null) {
      return {
        ok: false,
        context: safeContext,
        operation: authorization.operation,
        availability: unavailable("projection_not_locked"),
      };
    }

    const common = [
      engineInput.upgrades,
      engineInput.enhancements,
      engineInput.pilotLevel,
      engineInput.allocatedSkills,
    ] as const;
    let gameState;
    switch (safeContext.adapterKind) {
      case "legacy_level": {
        const payload = safeContext.adapterPayload;
        if (payload.kind !== "legacy_level" || payload.world !== 1 || payload.level !== 1 ||
          safeContext.operationId !== "op:hostile-picket") return fail(safeContext, "context_mismatch");
        gameState = createGameState(payload.world, payload.level, ...common);
        break;
      }
      case "special_mission": {
        const payload = safeContext.adapterPayload;
        if (payload.kind !== "special_mission" || payload.missionId !== "kepler-black-box" ||
          safeContext.operationId !== "op:kepler-black-box") return fail(safeContext, "context_mismatch");
        const blackBoxRecovered = canonicalBlackBoxRecovered(safeRun);
        if (blackBoxRecovered === null) return fail(safeContext, "malformed_run");
        gameState = createSpecialMissionGameState(
          payload.missionId,
          blackBoxRecovered,
          ...common,
        );
        break;
      }
      case "planet_mission": {
        const payload = safeContext.adapterPayload;
        if (payload.kind !== "planet_mission" || payload.planetId !== "ashfall" ||
          safeContext.operationId !== "op:ashfall-sortie") return fail(safeContext, "context_mismatch");
        gameState = createPlanetGameState(payload.planetId, ...common);
        break;
      }
      default: {
        const exhaustive: never = safeContext.adapterKind;
        return fail(safeContext, exhaustive);
      }
    }
    return { ok: true, context: structuredClone(authorization.context), gameState };
  } catch {
    return fail(safeContext, "malformed_run");
  }
}

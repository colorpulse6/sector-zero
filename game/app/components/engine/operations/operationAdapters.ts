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

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function dataProperty(value: unknown, key: string): unknown {
  if (!isPlainRecord(value) || !hasOwn(value, key)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
}

function denseArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false;
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !("value" in descriptor)) return false;
  }
  return true;
}

function sameData(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function canonicalBlackBoxRecovered(run: GalaxyRunState): boolean | null {
  const storyItems = dataProperty(run, "storyItems");
  if (!denseArray(storyItems) || !storyItems.every((entry) => typeof entry === "string")) {
    return null;
  }
  return storyItems.some((entry) => entry === "kepler-black-box");
}

function lockedProjection(
  projection: SaveData,
  run: GalaxyRunState,
): EngineProjectionInput | null {
  if (!isPlainRecord(projection)) return null;
  const activeExperience = dataProperty(projection, "activeExperience");
  const galaxyRun = dataProperty(projection, "galaxyRun");
  const currentWorld = dataProperty(projection, "currentWorld");
  const levels = dataProperty(projection, "levels");
  const totalStars = dataProperty(projection, "totalStars");
  const totalScore = dataProperty(projection, "totalScore");
  const completedQuests = dataProperty(projection, "completedQuests");
  const activeQuests = dataProperty(projection, "activeQuests");
  const completedPlanets = dataProperty(projection, "completedPlanets");
  const unlockedSpecialMissions = dataProperty(projection, "unlockedSpecialMissions");
  const upgrades = dataProperty(projection, "upgrades");
  const enhancements = dataProperty(projection, "unlockedEnhancements");
  const pilotLevel = dataProperty(projection, "pilotLevel");
  const allocatedSkills = dataProperty(projection, "allocatedSkills");
  if (
    activeExperience !== "legacy" || galaxyRun !== null || currentWorld !== 1 ||
    !isPlainRecord(levels) || Object.keys(levels).length !== 0 ||
    totalStars !== 0 || totalScore !== 0 ||
    !denseArray(completedQuests) || completedQuests.length !== 0 ||
    !denseArray(activeQuests) || activeQuests.length !== 0 ||
    !denseArray(completedPlanets) || completedPlanets.length !== 0 ||
    !denseArray(unlockedSpecialMissions) || unlockedSpecialMissions.length !== 0 ||
    !isPlainRecord(upgrades) || !denseArray(enhancements) ||
    !Number.isSafeInteger(pilotLevel) || !denseArray(allocatedSkills) ||
    !enhancements.every((entry) => typeof entry === "string") ||
    !allocatedSkills.every((entry) => typeof entry === "string") ||
    !sameData(upgrades, run.ship.upgrades) ||
    !sameData(enhancements, run.ship.unlockedEnhancements) ||
    pilotLevel !== run.pilot.level ||
    !sameData(allocatedSkills, run.pilot.allocatedSkills)
  ) return null;
  return {
    upgrades: upgrades as unknown as ShipUpgrades,
    enhancements: enhancements as EnhancementId[],
    pilotLevel: pilotLevel as number,
    allocatedSkills: allocatedSkills as SkillNodeId[],
  };
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
  try {
    const authorization = authorizeOperationLaunch(run, context.operationId);
    if (!authorization.ok) {
      return {
        ok: false,
        context,
        operation: authorization.operation,
        availability: authorization.availability,
      };
    }
    if (!sameOperationLaunchContext(authorization.context, context)) {
      return {
        ok: false,
        context,
        operation: authorization.operation,
        availability: unavailable("context_mismatch"),
      };
    }
    const engineInput = lockedProjection(projection, run);
    if (engineInput === null) {
      return {
        ok: false,
        context,
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
    switch (context.adapterKind) {
      case "legacy_level": {
        const payload = context.adapterPayload;
        if (payload.kind !== "legacy_level" || payload.world !== 1 || payload.level !== 1 ||
          context.operationId !== "op:hostile-picket") return fail(context, "context_mismatch");
        gameState = createGameState(payload.world, payload.level, ...common);
        break;
      }
      case "special_mission": {
        const payload = context.adapterPayload;
        if (payload.kind !== "special_mission" || payload.missionId !== "kepler-black-box" ||
          context.operationId !== "op:kepler-black-box") return fail(context, "context_mismatch");
        const blackBoxRecovered = canonicalBlackBoxRecovered(run);
        if (blackBoxRecovered === null) return fail(context, "malformed_run");
        gameState = createSpecialMissionGameState(
          payload.missionId,
          blackBoxRecovered,
          ...common,
        );
        break;
      }
      case "planet_mission": {
        const payload = context.adapterPayload;
        if (payload.kind !== "planet_mission" || payload.planetId !== "ashfall" ||
          context.operationId !== "op:ashfall-sortie") return fail(context, "context_mismatch");
        gameState = createPlanetGameState(payload.planetId, ...common);
        break;
      }
      default: {
        const exhaustive: never = context.adapterKind;
        return fail(context, exhaustive);
      }
    }
    return { ok: true, context: structuredClone(authorization.context), gameState };
  } catch {
    return fail(context, "malformed_run");
  }
}

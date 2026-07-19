import { advanceWorldCycle } from "../colony/shared/cycleProcessor";
import { applyMissionDelivery } from "../colony/shared/missionDelivery";
import { confirmPoiOutcome, createPoiOutcome } from "../colony/region/poiOutcomes";
import { recordKill } from "./bestiary";
import { unlockCodexEntry } from "./codex";
import { getLevelData, getMultiPhaseLevelData } from "./levels";
import { authorizeOperationLaunch } from "./operations/operationCatalog";
import {
  applyOperationOutcomeToRun,
  normalizeOperationOutcome,
} from "./operations/operationOutcome";
import { resolveGalaxyPoiOutcomeFromRun } from "./galaxy/galaxyPoiOutcomeAuthority";
import { completePlanet, getPlanetDef } from "./planets";
import { checkQuestCompletion, type QuestCheckData } from "./sideQuests";
import { getSpecialMissionDef } from "./specialMissions";
import {
  addStoryItem,
  calculateCreditsEarned,
  completeSpecialMission,
  recalcPilotLevel,
  unlockSpecialMission,
  updateLevelResult,
} from "./save";
import {
  EnemyType,
  type EnemyClass,
  type OutcomeRouteKind,
  type OutcomeRouteIdentity,
  type OutcomeTerminalKind,
  type SaveData,
} from "./types";

export type OutcomeFoldField = Exclude<
  keyof SaveData,
  "saveRevision" | "appliedOutcomeIds" | "outcomeRecoveryRecords"
>;

export const ROUTE_FOLD_FIELDS: Readonly<Record<OutcomeRouteKind, readonly OutcomeFoldField[]>> = {
  campaign: [
    "levels", "credits", "totalStars", "totalScore", "xp", "pilotLevel", "skillPoints", "allocatedSkills",
    "completedQuests", "activeQuests", "bestiary", "materials", "unlockedSpecialMissions",
    "unlockedCodex", "colonies", "missionsSinceStart",
  ],
  planet: [
    "completedPlanets", "bestiary", "materials", "unlockedEnhancements",
    "colonies", "factionStandings", "missionsSinceStart",
  ],
  special: [
    "credits", "completedSpecialMissions", "storyItems", "unlockedCodex", "bestiary",
    "colonies", "missionsSinceStart",
  ],
  operation: ["galaxyRun"],
  colony: [],
  poi: ["colonies", "planets", "missionsSinceStart", "galaxyRun"],
};

export const LEGACY_POI_FOLD_FIELDS: readonly OutcomeFoldField[] = ["colonies", "planets", "missionsSinceStart"];
export const GALAXY_POI_FOLD_FIELDS: readonly OutcomeFoldField[] = ["galaxyRun"];

export function outcomeAttemptFields(
  routeKind: OutcomeRouteKind,
  authority: "legacy" | "galaxy",
): readonly OutcomeFoldField[] {
  if (routeKind === "poi") return authority === "galaxy" ? GALAXY_POI_FOLD_FIELDS : LEGACY_POI_FOLD_FIELDS;
  return ROUTE_FOLD_FIELDS[routeKind];
}

export interface OutcomeFoldSuccess {
  ok: true;
  fields: OutcomeFoldField[];
  nextSave: Partial<SaveData>;
}

export type OutcomeFoldResult = OutcomeFoldSuccess | { ok: false };

type KillMetric = { type: EnemyType; classId: EnemyClass };

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

function exact(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  const snapshot = ownDataRecord(value);
  if (snapshot === null) return null;
  const actual = Object.keys(snapshot).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
    ? snapshot
    : null;
}

function payloadKind(value: unknown): string | null {
  const snapshot = ownDataRecord(value);
  return snapshot !== null && typeof snapshot.kind === "string" ? snapshot.kind : null;
}

export function outcomeEnvelopeFields(
  routeKind: OutcomeRouteKind,
  authority: "legacy" | "galaxy",
  terminalKind: OutcomeTerminalKind,
  payload: unknown,
): readonly OutcomeFoldField[] | null {
  const kind = payloadKind(payload);
  if (routeKind !== "operation" && terminalKind !== "success") {
    return kind === "terminal_noop_v1" ? [] : null;
  }
  if (routeKind === "colony") return kind === "terminal_noop_v1" ? [] : null;
  if (routeKind === "operation") return kind === "operation_result_v1" ? ROUTE_FOLD_FIELDS.operation : null;
  if (routeKind === "poi") {
    return kind === "poi_result_v2"
      ? authority === "galaxy" ? GALAXY_POI_FOLD_FIELDS : LEGACY_POI_FOLD_FIELDS
      : null;
  }
  return kind === `${routeKind}_result_v1` ? ROUTE_FOLD_FIELDS[routeKind] : null;
}

function guardedProjection(save: SaveData, fields: readonly OutcomeFoldField[]): SaveData | null {
  const keys = Reflect.ownKeys(save);
  if (keys.length !== fields.length || keys.some((key, index) => key !== fields[index])) return null;
  const allowed = new Set<PropertyKey>(fields);
  return new Proxy(save, {
    get(target, property, receiver) {
      if (!allowed.has(property)) throw new Error(`Outcome fold read undeclared field ${String(property)}.`);
      return Reflect.get(target, property, receiver);
    },
    set() { throw new Error("Outcome folds cannot mutate their input projection."); },
    defineProperty() { throw new Error("Outcome folds cannot define projection fields."); },
    deleteProperty() { throw new Error("Outcome folds cannot delete projection fields."); },
    ownKeys() { return [...fields]; },
    getOwnPropertyDescriptor(target, property) {
      return allowed.has(property) ? Reflect.getOwnPropertyDescriptor(target, property) : undefined;
    },
  });
}

function exactFoldOutput(result: OutcomeFoldResult, fields: readonly OutcomeFoldField[]): OutcomeFoldResult {
  if (!result.ok) return result;
  const keys = Reflect.ownKeys(result.nextSave);
  return keys.length === fields.length && keys.every((key, index) => key === fields[index])
    ? { ok: true, fields: [...fields], nextSave: result.nextSave }
    : { ok: false };
}

function safeNonnegative(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

const ENEMY_TYPES = new Set(Object.values(EnemyType));
const ENEMY_CLASSES = new Set<EnemyClass>([
  "armored", "swarm", "bio-organic", "tech-drone", "heavy-mech",
  "elemental-fire", "elemental-ice", "elemental-cinder",
]);

function snapshotKills(value: unknown): KillMetric[] | null {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype ||
    Object.keys(value).length !== value.length) return null;
  const kills: KillMetric[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    const kill = descriptor !== undefined && "value" in descriptor
      ? exact(descriptor.value, ["type", "classId"])
      : null;
    if (kill === null || !ENEMY_TYPES.has(kill.type as EnemyType) ||
      !ENEMY_CLASSES.has(kill.classId as EnemyClass)) return null;
    kills.push({ type: kill.type as EnemyType, classId: kill.classId as EnemyClass });
  }
  return kills;
}

function applyKills(
  save: SaveData,
  kills: readonly KillMetric[],
  world: number,
  planetId?: SaveData["completedPlanets"][number],
): SaveData {
  let bestiary = save.bestiary;
  for (const kill of kills) bestiary = recordKill(bestiary, kill.type, kill.classId, { world, planetId });
  return { ...save, bestiary };
}

function campaignFold(
  save: SaveData,
  identity: Extract<OutcomeRouteIdentity, { kind: "campaign" }>,
  payload: unknown,
): OutcomeFoldResult {
  const command = exact(payload, [
    "version", "kind", "score", "xpEarned", "killCount", "bestiaryKills", "totalEnemies", "deaths",
    "frameCount", "playerHp", "playerMaxHp",
  ]);
  const level = getLevelData(identity.world, identity.level);
  const bestiaryKills = command === null ? null : snapshotKills(command.bestiaryKills);
  if (command === null || level === undefined || command.version !== 1 || command.kind !== "campaign_result_v1" ||
    !safeNonnegative(command.score) || !safeNonnegative(command.xpEarned) || !safeNonnegative(command.killCount) ||
    bestiaryKills === null ||
    !safeNonnegative(command.totalEnemies) || !safeNonnegative(command.deaths) ||
    !safeNonnegative(command.frameCount) || !safeNonnegative(command.playerHp) ||
    !safeNonnegative(command.playerMaxHp) || (command.playerHp as number) > (command.playerMaxHp as number) ||
    bestiaryKills.length > (command.killCount as number)) return { ok: false };
  const stars = command.deaths === 0 && (command.killCount as number) / Math.max(1, command.totalEnemies as number) >= 0.8
    ? 3
    : command.deaths === 0 ? 2 : 1;
  let next = updateLevelResult(
    save,
    identity.world,
    identity.level,
    command.score as number,
    stars,
    command.xpEarned as number,
  );
  if ((command.totalEnemies as number) > 0 && (command.killCount as number) >= (command.totalEnemies as number)) {
    next = { ...next, credits: next.credits + 500 };
  }
  next = recalcPilotLevel(next);
  const questData: QuestCheckData = {
    world: identity.world,
    level: identity.level,
    kills: command.killCount as number,
    totalEnemies: command.totalEnemies as number,
    deaths: command.deaths as number,
    frameCount: command.frameCount as number,
    playerHp: command.playerHp as number,
    playerMaxHp: command.playerMaxHp as number,
  };
  next = checkQuestCompletion(next, questData).newSave;
  next = applyKills(next, bestiaryKills, identity.world);
  const multiPhase = getMultiPhaseLevelData(identity.world, identity.level);
  for (const material of multiPhase?.completionRewards ?? []) {
    if (!next.materials.includes(material)) next = { ...next, materials: [...next.materials, material] };
  }
  if (identity.world === 4 && identity.level === 2) next = unlockSpecialMission(next, "kepler-black-box");
  next = advanceWorldCycle(next);
  return { ok: true, fields: [...ROUTE_FOLD_FIELDS.campaign], nextSave: next };
}

function planetFold(
  save: SaveData,
  identity: Extract<OutcomeRouteIdentity, { kind: "planet" }>,
  payload: unknown,
): OutcomeFoldResult {
  const command = exact(payload, ["version", "kind", "bestiaryKills"]);
  const kills = command === null ? null : snapshotKills(command.bestiaryKills);
  if (command === null || command.version !== 1 || command.kind !== "planet_result_v1" ||
    kills === null) return { ok: false };
  try {
    const planet = getPlanetDef(identity.planetId);
    let next = completePlanet(save, planet.id);
    next = applyKills(next, kills, planet.pairedWorld, planet.id);
    next = applyMissionDelivery(next, planet.id).save;
    next = advanceWorldCycle(next);
    return { ok: true, fields: [...ROUTE_FOLD_FIELDS.planet], nextSave: next };
  } catch {
    return { ok: false };
  }
}

function specialFold(
  save: SaveData,
  identity: Extract<OutcomeRouteIdentity, { kind: "special" }>,
  payload: unknown,
): OutcomeFoldResult {
  const command = exact(payload, ["version", "kind", "score", "objectiveCollected", "bestiaryKills"]);
  const kills = command === null ? null : snapshotKills(command.bestiaryKills);
  if (command === null || command.version !== 1 || command.kind !== "special_result_v1" ||
    !safeNonnegative(command.score) || typeof command.objectiveCollected !== "boolean" || kills === null ||
    identity.missionId !== "kepler-black-box") {
    return { ok: false };
  }
  try {
    const mission = getSpecialMissionDef(identity.missionId);
    let next = {
      ...save,
      credits: save.credits + calculateCreditsEarned(command.score as number, 1, mission.world),
    };
    next = applyKills(next, kills, mission.world);
    next = completeSpecialMission(next, mission.id);
    if (command.objectiveCollected) {
      next = addStoryItem(next, mission.storyItemId);
      next = unlockCodexEntry(next, mission.storyCodexId);
    }
    next = advanceWorldCycle(next);
    return { ok: true, fields: [...ROUTE_FOLD_FIELDS.special], nextSave: next };
  } catch {
    return { ok: false };
  }
}

function operationFold(
  save: SaveData,
  identity: Extract<OutcomeRouteIdentity, { kind: "operation" }>,
  terminalKind: OutcomeTerminalKind,
  outcomeId: string,
  payload: unknown,
): OutcomeFoldResult {
  const command = exact(payload, ["version", "kind", "result", "metrics"]);
  if (command === null || command.version !== 1 || command.kind !== "operation_result_v1" ||
    command.result !== terminalKind ||
    (command.result !== "success" && command.result !== "failure" && command.result !== "retreat") ||
    save.galaxyRun === null) return { ok: false };
  const run = save.galaxyRun;
  const authorization = authorizeOperationLaunch(run, identity.operationId as never);
  if (!authorization.ok) return { ok: false };
  const normalized = normalizeOperationOutcome(run, authorization.context, {
    completionId: outcomeId,
    result: command.result,
    metrics: command.metrics as { frameCount: number } | null,
  });
  if (!normalized.ok || normalized.outcome.completionId !== outcomeId ||
    normalized.outcome.result !== terminalKind) return { ok: false };
  const applied = applyOperationOutcomeToRun(run, normalized.outcome);
  return applied.ok
    ? { ok: true, fields: [...ROUTE_FOLD_FIELDS.operation], nextSave: { galaxyRun: applied.galaxyRun } }
    : { ok: false };
}

function legacyPoiFold(
  save: SaveData,
  identity: Extract<OutcomeRouteIdentity, { kind: "poi" }>,
  payload: unknown,
): OutcomeFoldResult {
  const command = exact(payload, ["version", "kind", "destinationColonyId"]);
  if (command === null || command.version !== 2 || command.kind !== "poi_result_v2" ||
    !(command.destinationColonyId === null || typeof command.destinationColonyId === "string")) return { ok: false };
  const cycled = advanceWorldCycle(save);
  const created = createPoiOutcome(cycled, identity.originColonyId, identity.nodeId);
  if (!created.ok) {
    const origin = cycled.colonies.find((colony) => colony.id === identity.originColonyId);
    const node = cycled.planets.find((planet) => planet.id === origin?.planetId)
      ?.regionMap.nodes.find((entry) => entry.id === identity.nodeId);
    return node?.intel === "cleared"
      ? { ok: true, fields: [...LEGACY_POI_FOLD_FIELDS], nextSave: cycled }
      : { ok: false };
  }
  if (typeof command.destinationColonyId !== "string" || command.destinationColonyId.length === 0) {
    return { ok: false };
  }
  const confirmed = confirmPoiOutcome(cycled, created.outcome, command.destinationColonyId);
  return confirmed.ok
    ? { ok: true, fields: [...LEGACY_POI_FOLD_FIELDS], nextSave: confirmed.save }
    : { ok: false };
}

function galaxyPoiIdentityFold(
  save: SaveData,
  identity: Extract<OutcomeRouteIdentity, { kind: "poi" }>,
  launchId: string,
  outcomeId: string,
  preparedRevision: number,
  payload: unknown,
): OutcomeFoldResult {
  const command = exact(payload, ["version", "kind", "destinationColonyId"]);
  if (command === null || command.version !== 2 || command.kind !== "poi_result_v2" ||
    !(command.destinationColonyId === null || typeof command.destinationColonyId === "string") ||
    save.galaxyRun === null || save.galaxyRun.appliedOutcomeIds.includes(outcomeId)) return { ok: false };
  const resolved = resolveGalaxyPoiOutcomeFromRun(
    save.galaxyRun,
    identity,
    { launchId, outcomeId, preparedRevision },
    command.destinationColonyId as string | null,
  );
  if (!resolved.ok) return { ok: false };
  const galaxyRun = structuredClone(resolved.galaxyRun);
  galaxyRun.appliedOutcomeIds.push(outcomeId);
  return { ok: true, fields: [...GALAXY_POI_FOLD_FIELDS], nextSave: { galaxyRun } };
}

export function foldMissionOutcome(
  save: SaveData,
  routeKind: OutcomeRouteKind,
  routeIdentity: OutcomeRouteIdentity,
  authority: "legacy" | "galaxy",
  terminalKind: OutcomeTerminalKind,
  launchId: string,
  outcomeId: string,
  expectedRevision: number,
  payload: unknown,
): OutcomeFoldResult {
  if (routeIdentity.kind !== routeKind) return { ok: false };
  const fields = outcomeEnvelopeFields(routeKind, authority, terminalKind, payload);
  if (fields === null) return { ok: false };
  const projection = guardedProjection(save, fields);
  if (projection === null) return { ok: false };
  let result: OutcomeFoldResult;
  if (routeKind !== "operation" && terminalKind !== "success") {
    const noOp = exact(payload, ["version", "kind"]);
    result = noOp !== null && noOp.version === 1 && noOp.kind === "terminal_noop_v1"
      ? { ok: true, fields: [], nextSave: projection }
      : { ok: false };
    return exactFoldOutput(result, fields);
  }
  try {
    switch (routeKind) {
      case "campaign": result = routeIdentity.kind === "campaign" ? campaignFold(projection, routeIdentity, payload) : { ok: false }; break;
      case "planet": result = routeIdentity.kind === "planet" ? planetFold(projection, routeIdentity, payload) : { ok: false }; break;
      case "special": result = routeIdentity.kind === "special" ? specialFold(projection, routeIdentity, payload) : { ok: false }; break;
      case "operation": result = routeIdentity.kind === "operation"
        ? operationFold(projection, routeIdentity, terminalKind, outcomeId, payload)
        : { ok: false };
        break;
      case "poi": result = routeIdentity.kind === "poi"
        ? authority === "legacy"
          ? legacyPoiFold(projection, routeIdentity, payload)
          : galaxyPoiIdentityFold(
              projection,
              routeIdentity,
              launchId,
              outcomeId,
              expectedRevision,
              payload,
            )
        : { ok: false };
        break;
      case "colony": {
        const noOp = exact(payload, ["version", "kind"]);
        result = noOp !== null && noOp.version === 1 && noOp.kind === "terminal_noop_v1"
          ? { ok: true, fields: [], nextSave: projection }
          : { ok: false };
        break;
      }
    }
    return exactFoldOutput(result, fields);
  } catch {
    return { ok: false };
  }
}

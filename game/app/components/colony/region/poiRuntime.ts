import type {
  GameState,
  OutcomeAttempt,
  SaveData,
  SerializedOutcomeEnvelope,
} from "../../engine/types";
import { GameScreen } from "../../engine/types";
import { createGameState } from "../../engine/gameEngine";
import {
  createOutcomeAttempt,
  createOutcomeEnvelope,
  recoverLegacyPreparedOutcome,
  stageLegacyPreparedOutcome,
} from "../../engine/missionOutcome";
import {
  launchContextFromSave,
  poiMissionDescriptor,
  snapshotRetryLaunchContext,
  type ExperienceRoute,
  type LaunchIdFactory,
  type LaunchContext,
} from "../../engine/missionContext";
import { getBoardingSpawn } from "../../engine/boardingLevel";
import { getSpawnPosition as getGroundSpawn } from "../../engine/groundLevel";
import { advanceWorldCycle } from "../shared/cycleProcessor";
import type { ColonyId } from "../shared/colonyTypes";
import type { MissionDelivery } from "../shared/missionDelivery";
import type { PoiSession } from "./poiDispatcher";
import { createPoiOutcome, confirmPoiOutcome, type PendingPoiOutcome } from "./poiOutcomes";

export interface ActivePoiDescriptor { originColonyId: ColonyId; session: PoiSession }
export type PoiExperience = "legacy" | "galaxy";
export interface PendingPoiResolution {
  originColonyId: ColonyId;
  nodeId: string;
  baseSave: SaveData;
  projectedSave: SaveData;
  outcome: PendingPoiOutcome | null;
}

export interface LegacyPreparedPoiResolution extends PendingPoiResolution {
  preparedSave: SaveData;
  preparedEnvelope: SerializedOutcomeEnvelope;
}

export function createPoiGameState(
  session: PoiSession,
  save: SaveData,
  experience: PoiExperience = "legacy",
  launchIdFactoryOrRetry?: LaunchIdFactory | LaunchContext,
  canonicalParent?: SaveData,
  originColonyId?: ColonyId,
): GameState {
  const returnTarget: ExperienceRoute = experience === "galaxy"
    ? "galaxy-region"
    : "legacy-colony-exterior";
  const mission = poiMissionDescriptor(session.nodeId, session.engine);
  const launchContext = typeof launchIdFactoryOrRetry === "function" || launchIdFactoryOrRetry === undefined
    ? launchContextFromSave(
        save,
        mission,
        experience,
        "region",
        returnTarget,
        launchIdFactoryOrRetry,
      )
    : snapshotRetryLaunchContext(
        launchIdFactoryOrRetry,
        mission,
        experience,
        returnTarget,
      );
  if (launchContext === null) {
    throw new Error("POI retry launch context does not match the session and experience.");
  }
  let outcomeAttempt: GameState["outcomeAttempt"];
  if ((canonicalParent === undefined) !== (originColonyId === undefined)) {
    throw new Error("POI outcome authority requires both canonical parent and explicit origin.");
  }
  if (canonicalParent !== undefined && originColonyId !== undefined) {
    const colonies = experience === "galaxy" ? canonicalParent.galaxyRun?.colonies : canonicalParent.colonies;
    const planets = experience === "galaxy" ? canonicalParent.galaxyRun?.planets : canonicalParent.planets;
    const origin = colonies?.find((colony) => colony.id === originColonyId);
    const node = planets?.find((planet) => planet.id === origin?.planetId)
      ?.regionMap.nodes.find((entry) => entry.id === session.nodeId);
    if (origin === undefined || node === undefined || node.templateId === null) {
      throw new Error("POI outcome authority does not match the explicit canonical origin.");
    }
    outcomeAttempt = createOutcomeAttempt(canonicalParent, launchContext, "poi", {
      originColonyId,
      rewardEligible: session.rewardEligible,
    });
  }
  const base = { ...createGameState(1, 1, launchContext), ...(outcomeAttempt === undefined ? {} : { outcomeAttempt }) };
  const nodeName = experience === "galaxy"
    ? save.planets
        .flatMap((planet) => planet.regionMap.nodes)
        .find((node) => node.id === session.nodeId)?.name
    : undefined;
  const galaxyPresentation = experience === "galaxy"
    ? { galaxyOperation: { id: `poi:${session.nodeId}`, label: nodeName ?? "ASHFALL EXPEDITION" } }
    : {};
  if (session.engine === "firstPerson") return { ...base, ...galaxyPresentation, screen: GameScreen.PLAYING, currentMode: "first-person", currentPhase: 0, totalPhases: 1, firstPersonState: session.state, briefingTimer: 0 };
  if (session.engine === "boarding") {
    const spawn = getBoardingSpawn(session.state.map);
    return { ...base, ...galaxyPresentation, screen: GameScreen.PLAYING, currentMode: "boarding", currentPhase: 0, totalPhases: 1, boardingState: session.state, player: { ...base.player, x: spawn.x, y: spawn.y }, briefingTimer: 0 };
  }
  const spawn = getGroundSpawn(session.state.tileMap);
  return { ...base, ...galaxyPresentation, screen: GameScreen.PLAYING, currentMode: "ground-run", currentPhase: 0, totalPhases: 1, groundState: session.state, player: { ...base.player, x: spawn.x, y: spawn.y }, briefingTimer: 0 };
}

export function preparePoiCompletion(
  save: SaveData,
  activePoi: ActivePoiDescriptor | null,
  screen: GameScreen,
  attempt: OutcomeAttempt,
): LegacyPreparedPoiResolution | null;
export function preparePoiCompletion(
  save: SaveData,
  activePoi: ActivePoiDescriptor | null,
  screen: GameScreen,
): PendingPoiResolution | null;
export function preparePoiCompletion(
  save: SaveData,
  activePoi: ActivePoiDescriptor | null,
  screen: GameScreen,
  attempt?: OutcomeAttempt,
): PendingPoiResolution | LegacyPreparedPoiResolution | null {
  if (!activePoi || screen !== GameScreen.LEVEL_COMPLETE) return null;
  if (attempt !== undefined) {
    if (attempt.routeKind !== "poi" || attempt.routeIdentity.kind !== "poi" ||
      attempt.persistenceAuthority !== "legacy" || attempt.returnTarget !== "legacy-colony-exterior" ||
      attempt.routeIdentity.originColonyId !== activePoi.originColonyId ||
      attempt.routeIdentity.nodeId !== activePoi.session.nodeId ||
      attempt.routeIdentity.engine !== activePoi.session.engine ||
      attempt.routeIdentity.rewardEligible !== activePoi.session.rewardEligible) return null;
    const preparedEnvelope = createOutcomeEnvelope(attempt, "success", {
      version: 2,
      kind: "poi_prepared_v2",
    });
    const preparedSave = stageLegacyPreparedOutcome(save, preparedEnvelope);
    if (preparedSave === null) return null;
    return {
      originColonyId: activePoi.originColonyId,
      nodeId: activePoi.session.nodeId,
      baseSave: save,
      projectedSave: save,
      outcome: null,
      preparedSave,
      preparedEnvelope,
    };
  }
  const baseSave = advanceWorldCycle(save);
  if (!activePoi.session.rewardEligible) return { originColonyId: activePoi.originColonyId, nodeId: activePoi.session.nodeId, baseSave, projectedSave: baseSave, outcome: null };
  const created = createPoiOutcome(baseSave, activePoi.originColonyId, activePoi.session.nodeId);
  if (!created.ok) return null;
  return { originColonyId: activePoi.originColonyId, nodeId: activePoi.session.nodeId, baseSave, projectedSave: created.save, outcome: created.outcome };
}

export function recoverLegacyPoiCompletion(save: SaveData): LegacyPreparedPoiResolution | null {
  const preparedEnvelope = recoverLegacyPreparedOutcome(save);
  if (preparedEnvelope === null || preparedEnvelope.routeIdentity.kind !== "poi") return null;
  return {
    originColonyId: preparedEnvelope.routeIdentity.originColonyId,
    nodeId: preparedEnvelope.routeIdentity.nodeId,
    baseSave: save,
    projectedSave: save,
    outcome: null,
    preparedSave: save,
    preparedEnvelope,
  };
}

export function resolvePoiCompletion(
  pending: LegacyPreparedPoiResolution,
  destinationColonyId: ColonyId | null,
): { ok: true; save: SaveData; delivery: null; envelope: SerializedOutcomeEnvelope };
export function resolvePoiCompletion(
  pending: PendingPoiResolution,
  destinationColonyId: ColonyId | null,
):
  | { ok: true; save: SaveData; delivery: MissionDelivery | null }
  | { ok: false; save: SaveData; reason: "destination_missing" | "outcome_stale" };
export function resolvePoiCompletion(pending: PendingPoiResolution, destinationColonyId: ColonyId | null) {
  if ("preparedEnvelope" in pending && "preparedSave" in pending) {
    const prepared = pending as LegacyPreparedPoiResolution;
    return {
      ok: true as const,
      save: prepared.preparedSave,
      delivery: null,
      envelope: createOutcomeEnvelope(prepared.preparedEnvelope, "success", {
        version: 2,
        kind: "poi_result_v2",
        destinationColonyId,
      }),
    };
  }
  if (!pending.outcome) return { ok: true as const, save: pending.baseSave, delivery: null };
  if (!destinationColonyId) return { ok: false as const, save: pending.baseSave, reason: "destination_missing" as const };
  return confirmPoiOutcome(pending.baseSave, pending.outcome, destinationColonyId);
}

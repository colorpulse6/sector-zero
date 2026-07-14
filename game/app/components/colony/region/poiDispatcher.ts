import type { SaveData } from "../../engine/types";
import type { BoardingState, FirstPersonState, GroundState } from "../../engine/types";
import type { ColonyId, RegionNodeId } from "../shared/colonyTypes";
import { checkRegionAction, surveyRegionNode, type RegionActionBlockReason } from "./siteEconomy";
import { advanceWorldCycle } from "../shared/cycleProcessor";
import { createBoardingWreckTemplate, createFirstPersonRuinTemplate, createGroundRunCanyonTemplate } from "./poiTemplates";
import { isSupportedPoiNode } from "./poiCatalog";

export type PoiSession =
  | { nodeId: RegionNodeId; engine: "firstPerson"; state: FirstPersonState; rewardEligible: boolean }
  | { nodeId: RegionNodeId; engine: "boarding"; state: BoardingState; rewardEligible: boolean }
  | { nodeId: RegionNodeId; engine: "groundRun"; state: GroundState; rewardEligible: boolean };

export type PoiDispatchResult =
  | { ok: true; session: PoiSession }
  | { ok: false; reason: RegionActionBlockReason | "unsupported_poi_type" };

export function dispatchPoi(save: SaveData, originColonyId: ColonyId, targetNodeId: RegionNodeId): PoiDispatchResult {
  const check = checkRegionAction(save, originColonyId, targetNodeId, "travel");
  if (!check.allowed) return { ok: false, reason: check.reason };
  const colony = save.colonies.find(entry => entry.id === originColonyId);
  const node = save.planets.find(entry => entry.id === colony?.planetId)?.regionMap.nodes.find(entry => entry.id === targetNodeId);
  if (!node) return { ok: false, reason: "target_missing" };
  if (!isSupportedPoiNode(node)) return { ok: false, reason: "unsupported_poi_type" };
  const rewardEligible = node.intel === "surveyed";
  if (node.templateId === "fp-ruin-cinder-relay") return { ok: true, session: { nodeId: node.id, engine: "firstPerson", state: createFirstPersonRuinTemplate(node.seed), rewardEligible } };
  if (node.templateId === "boarding-wreck-oathbreaker") return { ok: true, session: { nodeId: node.id, engine: "boarding", state: createBoardingWreckTemplate(node.seed), rewardEligible } };
  return { ok: true, session: { nodeId: node.id, engine: "groundRun", state: createGroundRunCanyonTemplate(node.seed), rewardEligible } };
}

export type RegionExpeditionRequest = { kind: "survey" | "poi"; originColonyId: ColonyId; targetNodeId: RegionNodeId };
export function regionExpeditionRequestId(request: RegionExpeditionRequest): string {
  return `${request.kind}:${request.originColonyId}:${request.targetNodeId}`;
}

export function startRegionExpedition(save: SaveData, request: RegionExpeditionRequest, activeRequestId: string | null) {
  if (activeRequestId) return { ok: false as const, save, reason: "expedition_in_flight" as const };
  if (request.kind === "survey") {
    const surveyed = surveyRegionNode(save, request.originColonyId, request.targetNodeId);
    return surveyed.ok
      ? { ok: true as const, save: surveyed.save, requestId: regionExpeditionRequestId(request), session: null }
      : { ok: false as const, save, reason: surveyed.reason };
  }
  const dispatched = dispatchPoi(save, request.originColonyId, request.targetNodeId);
  return dispatched.ok
    ? { ok: true as const, save: advanceWorldCycle(save), requestId: regionExpeditionRequestId(request), session: dispatched.session }
    : { ok: false as const, save, reason: dispatched.reason };
}

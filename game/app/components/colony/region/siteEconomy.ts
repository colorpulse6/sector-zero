import type { SaveData } from "../../engine/types";
import type { ColonyId, RegionNodeId } from "../shared/colonyTypes";
import { advanceWorldCycle } from "../shared/cycleProcessor";
import { Events } from "../shared/colonyEvents";
import { colonyReducer } from "../shared/colonyReducer";

export type RegionAction = "survey" | "travel";
export type RegionActionBlockReason =
  | "origin_colony_missing"
  | "origin_planet_missing"
  | "origin_node_missing"
  | "origin_not_claimed"
  | "target_missing"
  | "target_unknown"
  | "target_not_adjacent"
  | "target_not_rumored"
  | "target_not_surveyed"
  | "target_not_poi";

export type RegionActionCheck =
  | { allowed: true; reason: null }
  | { allowed: false; reason: RegionActionBlockReason };

function denied(reason: RegionActionBlockReason): RegionActionCheck {
  return { allowed: false, reason };
}

export function checkRegionAction(
  save: SaveData,
  originColonyId: ColonyId,
  targetNodeId: RegionNodeId,
  action: RegionAction,
): RegionActionCheck {
  const colony = save.colonies.find(entry => entry.id === originColonyId);
  if (!colony) return denied("origin_colony_missing");
  const planet = save.planets.find(entry => entry.id === colony.planetId);
  if (!planet) return denied("origin_planet_missing");
  const origin = planet.regionMap.nodes.find(node => node.id === colony.regionNodeId);
  if (!origin) return denied("origin_node_missing");
  if (origin.intel !== "claimed") return denied("origin_not_claimed");
  const target = planet.regionMap.nodes.find(node => node.id === targetNodeId);
  if (!target) return denied("target_missing");
  if (target.intel === "unknown") return denied("target_unknown");
  const adjacent = planet.regionMap.edges.some(([from, to]) =>
    (from === origin.id && to === target.id) || (from === target.id && to === origin.id));
  if (!adjacent) return denied("target_not_adjacent");

  if (action === "survey") {
    return target.intel === "rumored"
      ? { allowed: true, reason: null }
      : denied("target_not_rumored");
  }
  if (target.type === "colony_site") return denied("target_not_poi");
  if (target.intel !== "surveyed" && target.intel !== "cleared") {
    return denied("target_not_surveyed");
  }
  return { allowed: true, reason: null };
}

export type SurveyRegionResult =
  | { ok: true; save: SaveData; nodeId: RegionNodeId }
  | { ok: false; save: SaveData; reason: RegionActionBlockReason };

export function surveyRegionNode(
  save: SaveData,
  originColonyId: ColonyId,
  targetNodeId: RegionNodeId,
): SurveyRegionResult {
  const check = checkRegionAction(save, originColonyId, targetNodeId, "survey");
  if (!check.allowed) {
    return { ok: false, save, reason: check.reason };
  }
  const cycled = advanceWorldCycle(save);
  const surveyed = colonyReducer(cycled, Events.regionSurveyed({
    colonyId: originColonyId,
    regionNodeId: targetNodeId,
  }));
  return { ok: true, save: surveyed, nodeId: targetNodeId };
}

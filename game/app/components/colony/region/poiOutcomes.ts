import type { SaveData } from "../../engine/types";
import type { ColonyId, ColonyResources, RegionNodeId } from "../shared/colonyTypes";
import { Events } from "../shared/colonyEvents";
import { colonyReducer } from "../shared/colonyReducer";
import { applyExplicitMissionDelivery, type MissionDelivery } from "../shared/missionDelivery";

export const POI_CARGO: Readonly<Partial<ColonyResources>> = { metal: 80 };

export interface PendingPoiOutcome {
  originColonyId: ColonyId;
  nodeId: RegionNodeId;
  payload: Partial<ColonyResources>;
}

export function createPoiOutcome(save: SaveData, originColonyId: ColonyId, nodeId: RegionNodeId) {
  const colony = save.colonies.find(entry => entry.id === originColonyId);
  const planet = save.planets.find(entry => entry.id === colony?.planetId);
  const node = planet?.regionMap.nodes.find(entry => entry.id === nodeId);
  if (!colony || !planet || !node || node.intel !== "surveyed") return { ok: false as const, save, reason: "outcome_stale" as const };
  const cleared = colonyReducer(save, Events.poiCleared({ colonyId: originColonyId, regionNodeId: nodeId }));
  return { ok: true as const, save: cleared, outcome: { originColonyId, nodeId, payload: { ...POI_CARGO } } };
}

export function confirmPoiOutcome(save: SaveData, outcome: PendingPoiOutcome, destinationColonyId: ColonyId):
  { ok: true; save: SaveData; delivery: MissionDelivery } | { ok: false; save: SaveData; reason: "destination_missing" | "outcome_stale" } {
  const origin = save.colonies.find(entry => entry.id === outcome.originColonyId);
  const node = save.planets.find(entry => entry.id === origin?.planetId)?.regionMap.nodes.find(entry => entry.id === outcome.nodeId);
  if (!origin || !node || node.intel !== "surveyed") return { ok: false, save, reason: "outcome_stale" };
  if (!save.colonies.some(entry => entry.id === destinationColonyId)) return { ok: false, save, reason: "destination_missing" };
  const cleared = colonyReducer(save, Events.poiCleared({ colonyId: origin.id, regionNodeId: node.id }));
  const delivered = applyExplicitMissionDelivery(cleared, destinationColonyId, outcome.payload);
  if (!delivered.delivery) return { ok: false, save, reason: "destination_missing" };
  return { ok: true, save: delivered.save, delivery: delivered.delivery };
}

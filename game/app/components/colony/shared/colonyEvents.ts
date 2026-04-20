import type {
  ColonyId, BuildingInstanceId, BuildingType, NpcId, FactionId, ShipmentId,
  RegionNodeId, BountyId, ColonyResources, ShipmentContents,
} from "./colonyTypes";

export type ColonyEvent =
  | { type: "colony/founded"; payload: {
      colonyId: ColonyId;
      name: string;
      planetId: string;
      foundingType: "outpost" | "colony" | "stronghold";
      regionNodeId: RegionNodeId;
      missionCount: number;
      layoutSeed: number;
    } }
  | { type: "colony/buildingCommissioned"; payload: {
      colonyId: ColonyId;
      buildingId: BuildingInstanceId;
      buildingType: BuildingType;
      costDeducted: Partial<ColonyResources>;
      cyclesToBuild: number;
    } }
  | { type: "colony/buildingCompleted"; payload: {
      colonyId: ColonyId;
      buildingId: BuildingInstanceId;
    } }
  | { type: "colony/cycleAdvanced"; payload: {
      colonyId: ColonyId;
      toCycle: number;
      resourceDelta: Partial<ColonyResources>;
      populationDelta: number;
      happinessAfter: number;
    } }
  | { type: "colony/resourceChanged"; payload: {
      colonyId: ColonyId;
      delta: Partial<ColonyResources>;
      reason: string;
    } }
  | { type: "colony/npcKilled"; payload: {
      colonyId: ColonyId;
      npcId: NpcId;
      killedBy: "player" | "hollow" | "natural";
    } }
  | { type: "colony/witnessed"; payload: {
      colonyId: ColonyId;
      witnessNpcId: NpcId;
      severity: "assault" | "murder" | "mass_killing";
      bountyId: BountyId | null;
    } }
  | { type: "colony/standingChanged"; payload: {
      factionId: FactionId;
      delta: number;
      newStanding: number;
    } }
  | { type: "colony/attackIncoming"; payload: {
      colonyId: ColonyId;
      threatKind: "raid_incoming" | "siege_ongoing" | "disaster_active" | "supply_disruption";
      cyclesUntilResolve: number;
    } }
  | { type: "colony/poiCleared"; payload: {
      colonyId: ColonyId;
      regionNodeId: RegionNodeId;
    } }
  | { type: "colony/shipmentOrdered"; payload: {
      colonyId: ColonyId;
      shipmentId: ShipmentId;
      contents: ShipmentContents;
      etaCycles: number;
      costPaid: number;
    } }
  | { type: "colony/shipmentArrived"; payload: {
      colonyId: ColonyId;
      shipmentId: ShipmentId;
      delivered: ShipmentContents;
    } };

// Constructor helpers (prefer these over raw object literals for type inference)
export const Events = {
  founded: (payload: Extract<ColonyEvent, { type: "colony/founded" }>["payload"]):
    Extract<ColonyEvent, { type: "colony/founded" }> => ({ type: "colony/founded", payload }),
  buildingCommissioned: (payload: Extract<ColonyEvent, { type: "colony/buildingCommissioned" }>["payload"]):
    Extract<ColonyEvent, { type: "colony/buildingCommissioned" }> => ({ type: "colony/buildingCommissioned", payload }),
  buildingCompleted: (payload: Extract<ColonyEvent, { type: "colony/buildingCompleted" }>["payload"]):
    Extract<ColonyEvent, { type: "colony/buildingCompleted" }> => ({ type: "colony/buildingCompleted", payload }),
  cycleAdvanced: (payload: Extract<ColonyEvent, { type: "colony/cycleAdvanced" }>["payload"]):
    Extract<ColonyEvent, { type: "colony/cycleAdvanced" }> => ({ type: "colony/cycleAdvanced", payload }),
  resourceChanged: (payload: Extract<ColonyEvent, { type: "colony/resourceChanged" }>["payload"]):
    Extract<ColonyEvent, { type: "colony/resourceChanged" }> => ({ type: "colony/resourceChanged", payload }),
  npcKilled: (payload: Extract<ColonyEvent, { type: "colony/npcKilled" }>["payload"]):
    Extract<ColonyEvent, { type: "colony/npcKilled" }> => ({ type: "colony/npcKilled", payload }),
  witnessed: (payload: Extract<ColonyEvent, { type: "colony/witnessed" }>["payload"]):
    Extract<ColonyEvent, { type: "colony/witnessed" }> => ({ type: "colony/witnessed", payload }),
  standingChanged: (payload: Extract<ColonyEvent, { type: "colony/standingChanged" }>["payload"]):
    Extract<ColonyEvent, { type: "colony/standingChanged" }> => ({ type: "colony/standingChanged", payload }),
  attackIncoming: (payload: Extract<ColonyEvent, { type: "colony/attackIncoming" }>["payload"]):
    Extract<ColonyEvent, { type: "colony/attackIncoming" }> => ({ type: "colony/attackIncoming", payload }),
  poiCleared: (payload: Extract<ColonyEvent, { type: "colony/poiCleared" }>["payload"]):
    Extract<ColonyEvent, { type: "colony/poiCleared" }> => ({ type: "colony/poiCleared", payload }),
  shipmentOrdered: (payload: Extract<ColonyEvent, { type: "colony/shipmentOrdered" }>["payload"]):
    Extract<ColonyEvent, { type: "colony/shipmentOrdered" }> => ({ type: "colony/shipmentOrdered", payload }),
  shipmentArrived: (payload: Extract<ColonyEvent, { type: "colony/shipmentArrived" }>["payload"]):
    Extract<ColonyEvent, { type: "colony/shipmentArrived" }> => ({ type: "colony/shipmentArrived", payload }),
};

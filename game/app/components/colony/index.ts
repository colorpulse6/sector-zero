// Public API for the colony subsystem.
// Consumers OUTSIDE game/app/components/colony/ must import only from this file.

export { colonyReducer } from "./shared/colonyReducer";
export { advanceWorldCycle, processCycle } from "./shared/cycleProcessor";
export { catchUpColony } from "./shared/catchUp";
export { rankFromStanding, applyStandingDelta } from "./shared/factionLedger";
export { derivePowerGrid, powerCapacityOf, powerDemandOf } from "./shared/powerGrid";
export {
  assertColonyInvariant,
  assertSaveInvariant,
  runStandardInvariants,
} from "./shared/colonyAssert";
export { Events } from "./shared/colonyEvents";
export type { ColonyEvent } from "./shared/colonyEvents";

export {
  enterColonyExploration,
  stepColonyExploration,
  exitColonyExploration,
  LandingPadExitMenu,
} from "./exploration";
export type {
  SceneStack,
  SceneLayer,
  ColonyContext,
  DoorInteractResult,
  LandingPadResult,
  ExitMenuProps,
} from "./exploration";

// Re-export types
export type {
  ColonyState,
  ColonyBuilding,
  PopulationState,
  ColonyResources,
  PowerGrid,
  Npc,
  PlanetState,
  RegionMap,
  RegionNode,
  ElevationMeta,
  EarthShipment,
  ShipmentContents,
  FactionStanding,
  Bounty,
  GameClock,
  CollapseState,
  District,
  Threat,
  Mood,
  Quest,
  QuestReward,
  Objective,
  GateCondition,
  ColonyId,
  BuildingInstanceId,
  BuildingType,
  DistrictId,
  NpcId,
  QuestId,
  RegionNodeId,
  TemplateId,
  FactionId,
  PlanetBiome,
  PoiType,
} from "./shared/colonyTypes";

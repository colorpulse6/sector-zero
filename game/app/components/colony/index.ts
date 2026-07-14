// Public API for the colony subsystem.
// Consumers OUTSIDE game/app/components/colony/ must import only from this file.

export { colonyReducer } from "./shared/colonyReducer";
export { advanceWorldCycle, processCycle } from "./shared/cycleProcessor";
export { catchUpColony } from "./shared/catchUp";
export {
  FACTIONS,
  PLANET_MISSION_STANDING,
  rankFromStanding,
  clampStanding,
  applyStandingDelta,
  adjustStanding,
  standingFor,
  rankFor,
  defaultFactionStandings,
  buyPriceMultiplier,
  sellPriceMultiplier,
  adjustedBuyPrice,
  merchantRefusesTrade,
  primaryFactionForPlanet,
  colonyMerchantRank,
} from "./shared/factionLedger";
export type { FactionRank, KnownFactionId, FactionDef } from "./shared/factionLedger";
export { derivePowerGrid, powerCapacityOf, powerDemandOf } from "./shared/powerGrid";
export { HABITAT_CAPACITY_PER_MODULE, habitatCapacity } from "./shared/colonyCatalog";
export {
  MISSION_DELIVERY_REASON,
  deliveryPayloadForPlanet,
  resolveDeliveryColony,
  resolveMissionDelivery,
  missionDeliveryEvent,
  applyMissionDelivery,
  deliveryPayloadLabel,
} from "./shared/missionDelivery";
export type { MissionDelivery } from "./shared/missionDelivery";
export {
  assertColonyInvariant,
  assertSaveInvariant,
  runStandardInvariants,
} from "./shared/colonyAssert";
export { Events } from "./shared/colonyEvents";
export type { ColonyEvent } from "./shared/colonyEvents";
export {
  ASHFALL_REGION_SEED,
  REGION_INTEL_ORDER,
  createPlanetRegionState,
  generateRegionMap,
  neutralSiteStats,
} from "./region/regionMap";
export { checkRegionAction, surveyRegionNode } from "./region/siteEconomy";
export { dispatchPoi, startRegionExpedition } from "./region/poiDispatcher";
export { createPoiOutcome, confirmPoiOutcome, POI_CARGO } from "./region/poiOutcomes";
export { createFirstPersonRuinTemplate, createBoardingWreckTemplate, createGroundRunCanyonTemplate } from "./region/poiTemplates";
export type {
  RegionAction,
  RegionActionBlockReason,
  RegionActionCheck,
  SurveyRegionResult,
} from "./region/siteEconomy";

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
  RegionIntelState,
  SiteStats,
} from "./shared/colonyTypes";

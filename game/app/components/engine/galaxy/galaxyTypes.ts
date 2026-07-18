import type {
  ColonyState,
  FactionStanding,
  PlanetState,
} from "../../colony/shared/colonyTypes";
import type {
  BestiaryEntry,
  ConsumableId,
  EnhancementId,
  EnemyType,
  MaterialId,
  ShipUpgrades,
  SkillNodeId,
  StoryItemId,
  WeaponType,
} from "../types";

export type ExperienceMode = "legacy" | "galaxy";

export type KnowledgeState =
  | "unknown"
  | "signal"
  | "charted"
  | "visited"
  | "lost_contact";

export type AtlasViewLevel = "galaxy" | "sector" | "system" | "region";

export type ThreatDimension =
  | "military"
  | "political"
  | "environmental"
  | "logistical"
  | "anomalous";

export type ThreatBand = "low" | "moderate" | "high" | "severe" | "unknown";

export interface GalaxyCoordinate {
  sectorX: number;
  sectorY: number;
  localX: number;
  localY: number;
}

export interface GalaxyCellAddress {
  sectorX: number;
  sectorY: number;
  cellX: number;
  cellY: number;
}

export type CoordinateValidationResult =
  | { ok: true }
  | { ok: false; error: string };

export interface AtlasGenerationIdentity {
  galaxySeed: string;
  generationVersion: number;
  authoredAnchorRegistryVersion: number;
}

export type KnowledgeSource =
  | "sensor"
  | "report"
  | "rumor"
  | "archive"
  | "ally"
  | "direct_visit"
  | "authored";

export type KnowledgeConfidence = "low" | "medium" | "high";

export interface AtlasCellFact {
  id: string;
  cellKey: string;
  coordinate: GalaxyCoordinate;
  kind:
    | "empty"
    | "stellar_contact"
    | "hazard"
    | "ruin"
    | "anomaly"
    | "signal";
  contactId: string | null;
  stableSeed: number;
  authored: boolean;
}

export interface AtlasKnowledgeRecord {
  id: string;
  subjectId: string;
  state: KnowledgeState;
  observedProperties: Record<string, string | number | boolean | null>;
  confidence: KnowledgeConfidence;
  source: KnowledgeSource;
  observedCycle: number;
  expiresCycle: number | null;
}

export interface AccessFact {
  id: string;
  subjectId: string;
  assessment: "reachable" | "contested" | "secured" | "denied" | "disrupted";
  causeFactIds: string[];
  cycle: number;
}

export interface ThreatObservation {
  id: string;
  subjectId: string;
  dimension: ThreatDimension;
  band: ThreatBand;
  confidence: KnowledgeConfidence;
  source: KnowledgeSource;
  observedCycle: number;
}

export interface GalaxyAtlasState {
  materializedFacts: Record<string, AtlasCellFact>;
  knowledge: Record<string, AtlasKnowledgeRecord>;
  mappedCellKeys: string[];
  accessFacts: AccessFact[];
  threatObservations: ThreatObservation[];
}

export interface RouteLeg {
  id: string;
  from: GalaxyCoordinate;
  to: GalaxyCoordinate;
  distanceUnits: number;
  cycles: number;
  supplyCost: number;
  interruptionCauseId: string | null;
}

export interface GalaxyResources {
  supply: number;
  credits: number;
  materials: MaterialId[];
}

export interface GalaxyShipState {
  upgrades: ShipUpgrades;
  unlockedEnhancements: EnhancementId[];
  equippedWeaponType: WeaponType;
  consumableInventory: Partial<Record<ConsumableId, number>>;
  equippedConsumables: ConsumableId[];
}

export interface GalaxyPilotState {
  xp: number;
  level: number;
  skillPoints: number;
  allocatedSkills: SkillNodeId[];
  bestiary: Partial<Record<EnemyType, BestiaryEntry>>;
}

export interface GalaxyVesselState {
  status: "stationary" | "in_transit" | "stranded";
  coordinate: GalaxyCoordinate;
  contactId: string | null;
  transitTransactionId: string | null;
}

export interface GalaxyOperationRecord {
  state:
    | "available"
    | "accepted"
    | "active"
    | "complete"
    | "failed"
    | "expired";
  acceptedCycle: number | null;
  resolvedCycle: number | null;
  completionIds: string[];
}

export interface GalaxyCodexState {
  unlocked: string[];
  viewed: string[];
}

export interface HistoricalFact {
  id: string;
  kind: string;
  subjectId: string;
  cycle: number;
  causeFactIds: string[];
}

export interface TravelCommitment {
  transactionId: string;
  state:
    | "committed"
    | "advancing"
    | "interrupted"
    | "arrived"
    | "diverted"
    | "resolved";
  routePlanId: string;
  origin: GalaxyCoordinate;
  destination: GalaxyCoordinate;
  targetId: string | null;
  legs: RouteLeg[];
  nextLegIndex: number;
  appliedCheckpointIds: string[];
  supplyCost: number;
  elapsedCycles: number;
  interruptionOperationId: string | null;
}

export interface GalaxyRunState {
  identity: AtlasGenerationIdentity;
  worldCycle: number;
  nextTransactionOrdinal: number;
  resources: GalaxyResources;
  ship: GalaxyShipState;
  pilot: GalaxyPilotState;
  codex: GalaxyCodexState;
  storyItems: StoryItemId[];
  vessel: GalaxyVesselState;
  atlas: GalaxyAtlasState;
  operations: Record<string, GalaxyOperationRecord>;
  activeTravel: TravelCommitment | null;
  colonies: ColonyState[];
  planets: PlanetState[];
  factionStandings: FactionStanding[];
  historyFacts: HistoricalFact[];
  appliedOutcomeIds: string[];
}

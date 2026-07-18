import type {
  GalaxyCoordinate,
  GalaxyOperationRecord,
  KnowledgeConfidence,
  KnowledgeState,
  ThreatBand,
  ThreatDimension,
} from "../galaxy/galaxyTypes";
import type {
  GameMode,
  GameState,
  PlanetId,
  SpecialMissionId,
  StoryItemId,
} from "../types";

export type OperationId =
  | "op:hostile-picket"
  | "op:kepler-black-box"
  | "op:ashfall-sortie";

export type OperationSource =
  | "story"
  | "character"
  | "board"
  | "systemic"
  | "exploration"
  | "reliable_work";

export type OperationAdapterPayload =
  | { kind: "legacy_level"; world: 1; level: 1 }
  | { kind: "special_mission"; missionId: SpecialMissionId }
  | { kind: "planet_mission"; planetId: PlanetId };

export type OperationAdapterKind = OperationAdapterPayload["kind"];

export interface OperationObjective {
  kind: "intercept" | "recover" | "sortie";
  targetId: string;
  label: string;
}

export interface OperationSideQuestModifier {
  id: string;
  kind: "side_quest";
  optional: true;
  questId: string;
  name: string;
  description: string;
  offeredBy: string;
  condition: {
    kind: "time_attack";
    metric: "frameCount";
    comparison: "at_most";
    value: number;
    unit: "frames";
  };
  reward: { credits: number };
}

export type OperationModifier = OperationSideQuestModifier;

export interface OperationPhase {
  id: string;
  mode: GameMode;
  objective: string;
  adapter: OperationAdapterPayload;
}

export interface OperationThreatAssessment {
  confidence: KnowledgeConfidence;
  dimensions: Record<ThreatDimension, ThreatBand>;
}

export interface OperationCosts {
  supply: number;
  worldCycles: number;
}

export interface OperationKnowledgeReward {
  subjectId: string;
  state: KnowledgeState;
  confidence: KnowledgeConfidence;
}

export interface OperationMissionDelivery {
  planetId: "ashfall";
  colonyId: "galaxy:ashfall-primary";
  reason: "mission_delivery";
}

export interface OperationOutcomeDefinition {
  supply: number;
  credits: number;
  pilotXp: number;
  storyItemIds: StoryItemId[];
  knowledge: OperationKnowledgeReward[];
  accessFactIds: string[];
  historyKinds: string[];
  missionDelivery: OperationMissionDelivery | null;
  travelResolution: "cleared" | "failed" | "retreated" | "none";
  strandedAt: GalaxyCoordinate | null;
  returnToOrigin: boolean;
}

export interface OperationRewards {
  success: OperationOutcomeDefinition;
  failure: OperationOutcomeDefinition;
  retreat: OperationOutcomeDefinition;
}

export type OperationUnavailableReason =
  | "unknown_operation"
  | "malformed_run"
  | "missing_operation_record"
  | "invalid_operation_state"
  | "operation_resolved"
  | "missing_cause_fact"
  | "cause_resolved"
  | "missing_contact"
  | "contact_not_visited"
  | "wrong_location"
  | "access_denied"
  | "active_travel_conflict"
  | "missing_active_interruption"
  | "interruption_mismatch"
  | "unique_history_resolved"
  | "context_mismatch"
  | "projection_not_locked"
  | "missing_adapter";

export type OperationAvailability =
  | { status: "available"; reasons: [] }
  | {
      status: "unavailable";
      recoverable: true;
      reasons: OperationUnavailableReason[];
    };

/** Serializable located-operation contract. Engine payloads are compatibility data only. */
export interface Operation {
  id: OperationId;
  source: OperationSource;
  location: GalaxyCoordinate;
  contactId: string | null;
  issuerId: string | null;
  causeFactIds: string[];
  objective: OperationObjective;
  modifiers: OperationModifier[];
  phases: OperationPhase[];
  knownThreat: OperationThreatAssessment;
  costs: OperationCosts;
  rewards: OperationRewards;
  availability: OperationAvailability;
  state: GalaxyOperationRecord["state"];
}

export interface OperationLaunchContext {
  operationId: OperationId;
  adapterKind: OperationAdapterKind;
  adapterPayload: OperationAdapterPayload;
  authorizedCycle: number;
  operationState: GalaxyOperationRecord["state"];
  location: GalaxyCoordinate;
  contactId: string | null;
  causeFactIds: string[];
  travelTransactionId: string | null;
}

export interface OperationModifierEvaluation {
  met: boolean;
  credits: number;
}

export type OperationCatalogResult =
  | { ok: true; operations: Operation[] }
  | { ok: false; operations: Operation[]; availability: OperationAvailability };

export type OperationLookupResult =
  | { ok: true; operation: Operation }
  | {
      ok: false;
      operation: Operation | null;
      availability: Extract<OperationAvailability, { status: "unavailable" }>;
    };

export type OperationAuthorizationResult =
  | { ok: true; operation: Operation; context: OperationLaunchContext }
  | {
      ok: false;
      operation: Operation | null;
      availability: Extract<OperationAvailability, { status: "unavailable" }>;
    };

export type OperationLaunchResult =
  | {
      ok: true;
      context: OperationLaunchContext;
      gameState: GameState;
    }
  | {
      ok: false;
      context: OperationLaunchContext | null;
      operation: Operation | null;
      availability: Extract<OperationAvailability, { status: "unavailable" }>;
    };

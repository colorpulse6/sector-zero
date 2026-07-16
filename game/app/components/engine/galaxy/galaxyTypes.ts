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

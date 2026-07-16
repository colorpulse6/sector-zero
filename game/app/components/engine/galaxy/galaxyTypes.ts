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

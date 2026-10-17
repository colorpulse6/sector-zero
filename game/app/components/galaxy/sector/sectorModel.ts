import type {
  AtlasCellFact,
  GalaxyCoordinate,
  GalaxyRunState,
  GalaxyVesselState,
  KnowledgeConfidence,
  KnowledgeState,
  ThreatBand,
  TravelCommitment,
} from "../../engine/galaxy/galaxyTypes";
import type { AtlasTarget, RoutePlan } from "../../engine/galaxy/routePlanner";
import { sameCoordinate } from "../../engine/galaxy/coordinates";
import { selectedTargetIdFor } from "../atlasViewport";
import { contactIdForPlanet, contactLabel, latestKnowledge, starClassForFact } from "../system/contactSystems";
import type { StarClass } from "../system/starSystems";

/**
 * Pure view model for the Galaxy Atlas sector field.
 *
 * Everything the scene and the landmark layer draw comes from here, derived from the run.
 * The model never invents a contact the run does not know about and never writes state.
 */

export interface SectorStar {
  targetId: string;
  contactId: string | null;
  factId: string;
  label: string;
  kind: AtlasCellFact["kind"];
  knowledge: KnowledgeState;
  confidence: KnowledgeConfidence;
  coordinate: GalaxyCoordinate;
  /** Highest observed threat band for this subject; `unknown` when nothing was observed. */
  threat: ThreatBand;
  colonies: number;
  vessel: boolean;
  /** Spectral class for the star colour; null while only a signal is known (fog). */
  starClass: StarClass | null;
  /** Decorative height above or below the galactic plane, in [-1, 1], stable per fact id. */
  elevation: number;
}

export type SectorLegState = "planned" | "done" | "active" | "pending";

export interface SectorRouteLeg {
  from: GalaxyCoordinate;
  to: GalaxyCoordinate;
  band: ThreatBand;
  state: SectorLegState;
}

export interface SectorModel {
  stars: SectorStar[];
  vessel: { coordinate: GalaxyCoordinate; status: GalaxyVesselState["status"]; contactId: string | null };
  route: { legs: SectorRouteLeg[]; band: ThreatBand; destination: GalaxyCoordinate } | null;
  travel: { legs: SectorRouteLeg[]; nextLegIndex: number; state: TravelCommitment["state"] } | null;
  blindTarget: GalaxyCoordinate | null;
  /** Changes whenever anything drawable changes; scenes skip rebuilds on an equal key. */
  key: string;
}

const BAND_RANK: Readonly<Record<ThreatBand, number>> = Object.freeze({
  unknown: 0,
  low: 1,
  moderate: 2,
  high: 3,
  severe: 4,
});

function safeValues<T>(record: Record<string, T>): T[] {
  return Object.keys(record)
    .filter(key => Object.prototype.hasOwnProperty.call(record, key))
    .map(key => record[key]);
}

export function highestBand(bands: readonly ThreatBand[]): ThreatBand {
  return bands.reduce<ThreatBand>((best, band) => (BAND_RANK[band] > BAND_RANK[best] ? band : best), "unknown");
}

function observedThreat(run: GalaxyRunState, subjectIds: readonly string[]): ThreatBand {
  return highestBand(
    run.atlas.threatObservations
      .filter(observation => subjectIds.includes(observation.subjectId))
      .map(observation => observation.band),
  );
}

function colonyCount(run: GalaxyRunState, contactId: string | null): number {
  if (!contactId) return 0;
  return run.colonies.filter(colony => contactIdForPlanet(colony.planetId) === contactId).length;
}

/** FNV-1a over the fact id, mapped to [-1, 1]; decorative only, never part of game state. */
export function elevationForFact(factId: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < factId.length; index += 1) {
    hash ^= factId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  hash = (hash ^ (hash >>> 16)) >>> 0;
  hash = Math.imul(hash, 0x7feb352d) >>> 0;
  hash = (hash ^ (hash >>> 15)) >>> 0;
  return Math.round(((hash % 2001) / 1000 - 1) * 1000) / 1000;
}

/** Known contacts in the same order the CONTACTS listbox uses. */
export function sectorStars(run: GalaxyRunState): SectorStar[] {
  return safeValues(run.atlas.materializedFacts)
    .map((fact): SectorStar | null => {
      const knowledge = latestKnowledge(run, fact.id);
      if (!knowledge || knowledge.state === "unknown" || knowledge.state === "lost_contact") return null;
      const target: AtlasTarget = fact.contactId === null
        ? { kind: "coordinate", coordinate: { ...fact.coordinate } }
        : { kind: "contact", contactId: fact.contactId };
      const targetId = selectedTargetIdFor(target);
      const vessel = run.vessel.status !== "in_transit"
        && (run.vessel.contactId === fact.contactId && fact.contactId !== null
          || sameCoordinate(run.vessel.coordinate, fact.coordinate));
      return {
        targetId,
        contactId: fact.contactId,
        factId: fact.id,
        label: contactLabel(fact, knowledge),
        kind: fact.kind,
        knowledge: knowledge.state,
        confidence: knowledge.confidence,
        coordinate: { ...fact.coordinate },
        threat: observedThreat(run, fact.contactId ? [fact.id, fact.contactId] : [fact.id]),
        colonies: colonyCount(run, fact.contactId),
        vessel,
        starClass: knowledge.state === "signal" || fact.kind === "signal" ? null : starClassForFact(fact),
        elevation: elevationForFact(fact.id),
      };
    })
    .filter((star): star is SectorStar => star !== null)
    .sort((left, right) =>
      left.coordinate.localX - right.coordinate.localX
      || left.coordinate.localY - right.coordinate.localY
      || left.targetId.localeCompare(right.targetId));
}

function routeFromPlan(plan: RoutePlan | null): SectorModel["route"] {
  if (!plan) return null;
  const band = plan.threat.overall.band;
  return {
    band,
    destination: { ...plan.destination },
    legs: plan.legs.map(leg => ({ from: { ...leg.from }, to: { ...leg.to }, band, state: "planned" as const })),
  };
}

function legStateFor(index: number, travel: TravelCommitment): SectorLegState {
  if (travel.state === "arrived" || travel.state === "resolved") return "done";
  if (index < travel.nextLegIndex) return "done";
  if (index === travel.nextLegIndex) return "active";
  return "pending";
}

function travelFromRun(run: GalaxyRunState): SectorModel["travel"] {
  const travel = run.activeTravel;
  if (!travel) return null;
  const band = observedThreat(run, travel.targetId ? [travel.targetId] : []);
  return {
    state: travel.state,
    nextLegIndex: travel.nextLegIndex,
    legs: travel.legs.map((leg, index) => ({
      from: { ...leg.from },
      to: { ...leg.to },
      band: leg.interruptionCauseId ? highestBand([band, "high"]) : band,
      state: legStateFor(index, travel),
    })),
  };
}

function coordinateKeyOf(coordinate: GalaxyCoordinate): string {
  return `${coordinate.sectorX}:${coordinate.sectorY}:${coordinate.localX}:${coordinate.localY}`;
}

export function buildSectorModel(
  run: GalaxyRunState,
  selectedTarget: AtlasTarget | null,
  plan: RoutePlan | null,
): SectorModel {
  const stars = sectorStars(run);
  const route = routeFromPlan(plan);
  const travel = travelFromRun(run);
  const blindTarget = selectedTarget?.kind === "coordinate" ? { ...selectedTarget.coordinate } : null;
  const key = [
    stars.map(star => `${star.targetId}|${star.knowledge}|${star.threat}|${star.colonies}|${star.vessel ? 1 : 0}`).join(","),
    `${run.vessel.status}@${coordinateKeyOf(run.vessel.coordinate)}`,
    route ? `route:${route.band}:${route.legs.map(leg => coordinateKeyOf(leg.to)).join(">")}` : "route:none",
    travel ? `travel:${travel.state}:${travel.nextLegIndex}:${travel.legs.length}` : "travel:none",
    blindTarget ? `blind:${coordinateKeyOf(blindTarget)}` : "blind:none",
  ].join(";");
  return {
    stars,
    vessel: { coordinate: { ...run.vessel.coordinate }, status: run.vessel.status, contactId: run.vessel.contactId },
    route,
    travel,
    blindTarget,
    key,
  };
}

import { G0_SECTOR_BOUNDS, getGenerationAvailability } from "./atlas";
import {
  cellKey,
  coordinateKey,
  distanceUnits as measureDistanceUnits,
  sameCoordinate,
  stableHash,
  validateCoordinate,
} from "./coordinates";
import type {
  AtlasCellFact,
  AtlasGenerationIdentity,
  GalaxyCoordinate,
  GalaxyRunState,
  KnowledgeConfidence,
  KnowledgeSource,
  RouteLeg,
  ThreatBand,
  ThreatDimension,
  ThreatObservation,
} from "./galaxyTypes";

export const G0_MAX_LEG_DISTANCE = 2048;
export const G0_CYCLE_DISTANCE = 768;
export const G0_SUPPLY_DISTANCE = 384;

export interface RoutePlanningPolicy {
  routing: "direct_only";
  allowBlindCoordinates: boolean;
}

export const G0_DIRECT_ROUTE_POLICY: Readonly<RoutePlanningPolicy> =
  Object.freeze({
    routing: "direct_only",
    allowBlindCoordinates: true,
  });

export type AtlasTarget =
  | { kind: "contact"; contactId: string }
  | { kind: "coordinate"; coordinate: GalaxyCoordinate };

export interface RouteCapabilitySnapshot {
  maxLegDistance: number;
  availableSupply: number;
  engineBoostLevel: number;
}

export interface ThreatDimensionPreview {
  band: ThreatBand;
  confidence: KnowledgeConfidence;
  sources: KnowledgeSource[];
  unknownContributors: string[];
}

export interface OverallThreatPreview {
  band: ThreatBand;
  confidence: KnowledgeConfidence;
  presentation:
    | "LOW EXPOSURE"
    | "MODERATE EXPOSURE"
    | "HIGH EXPOSURE"
    | "SEVERE EXPOSURE"
    | "UNCERTAIN — INCOMPLETE THREAT DATA";
}

export interface RouteThreatPreview {
  dimensions: Record<ThreatDimension, ThreatDimensionPreview>;
  overall: OverallThreatPreview;
}

export interface RoutePlan {
  id: string;
  origin: GalaxyCoordinate;
  destination: GalaxyCoordinate;
  target: AtlasTarget;
  targetId: string | null;
  identity: AtlasGenerationIdentity;
  capability: RouteCapabilitySnapshot;
  policy: RoutePlanningPolicy;
  cycleSnapshot: number;
  legs: RouteLeg[];
  distanceUnits: number;
  elapsedCycles: number;
  supplyCost: number;
  projectedReserve: number;
  threat: RouteThreatPreview;
  knownPorts: string[];
  relayCandidates: string[];
  knownAllies: string[];
  repairOpportunities: string[];
  forecastedWorldChanges: string[];
}

export type RouteBlockCode =
  | "invalid_generation_identity"
  | "unsupported_generation_version"
  | "unsupported_registry_version"
  | "unsupported_policy"
  | "invalid_cycle_snapshot"
  | "invalid_capability"
  | "invalid_supply"
  | "active_travel_exists"
  | "vessel_not_stationary"
  | "vessel_has_transit"
  | "invalid_origin"
  | "outside_g0_bounds"
  | "invalid_target"
  | "unknown_contact"
  | "ambiguous_contact"
  | "blind_travel_disabled"
  | "invalid_coordinate"
  | "cross_sector_route"
  | "already_at_destination"
  | "over_maximum_leg_distance"
  | "insufficient_supply"
  | "access_denied";

export interface RouteBlockReason {
  code: RouteBlockCode;
  message: string;
}

export type RoutePlanResult =
  | { ok: true; plan: RoutePlan }
  | {
      ok: false;
      status: "blocked" | "unsupported";
      reasons: string[];
      reasonDetails: RouteBlockReason[];
    };

interface ResolvedTarget {
  target: AtlasTarget;
  targetId: string | null;
  destination: GalaxyCoordinate;
  threatSubjectId: string | null;
}

const THREAT_DIMENSIONS: readonly ThreatDimension[] = Object.freeze([
  "military",
  "political",
  "environmental",
  "logistical",
  "anomalous",
]);

const BAND_RANK: Readonly<Record<Exclude<ThreatBand, "unknown">, number>> =
  Object.freeze({
    low: 0,
    moderate: 1,
    high: 2,
    severe: 3,
  });

const CONFIDENCE_RANK: Readonly<Record<KnowledgeConfidence, number>> =
  Object.freeze({
    low: 0,
    medium: 1,
    high: 2,
  });

const CONFIDENCES: readonly KnowledgeConfidence[] = Object.freeze([
  "low",
  "medium",
  "high",
]);

const THREAT_BANDS: readonly ThreatBand[] = Object.freeze([
  "low",
  "moderate",
  "high",
  "severe",
  "unknown",
]);

const KNOWLEDGE_SOURCES: readonly KnowledgeSource[] = Object.freeze([
  "sensor",
  "report",
  "rumor",
  "archive",
  "ally",
  "direct_visit",
  "authored",
]);

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function blocked(
  code: RouteBlockCode,
  message: string,
  status: "blocked" | "unsupported" = "blocked",
): RoutePlanResult {
  return {
    ok: false,
    status,
    reasons: [message],
    reasonDetails: [{ code, message }],
  };
}

function cloneCoordinate(coordinate: GalaxyCoordinate): GalaxyCoordinate {
  return {
    sectorX: coordinate.sectorX,
    sectorY: coordinate.sectorY,
    localX: coordinate.localX,
    localY: coordinate.localY,
  };
}

function isWithinG0LocalBounds(coordinate: GalaxyCoordinate): boolean {
  return (
    coordinate.sectorX === 0 &&
    coordinate.sectorY === 0 &&
    coordinate.localX >= G0_SECTOR_BOUNDS.min &&
    coordinate.localX <= G0_SECTOR_BOUNDS.max &&
    coordinate.localY >= G0_SECTOR_BOUNDS.min &&
    coordinate.localY <= G0_SECTOR_BOUNDS.max
  );
}

function validGenerationIdentity(
  value: unknown,
): value is AtlasGenerationIdentity {
  if (!isRecord(value)) return false;
  return (
    typeof value.galaxySeed === "string" &&
    value.galaxySeed.length > 0 &&
    Number.isSafeInteger(value.generationVersion) &&
    Number.isSafeInteger(value.authoredAnchorRegistryVersion)
  );
}

function ownValues<T>(dictionary: Record<string, T>): T[] {
  const values: T[] = [];
  for (const key of Object.keys(dictionary)) {
    if (hasOwn(dictionary, key)) values.push(dictionary[key]);
  }
  return values;
}

function isKnownFact(run: GalaxyRunState, fact: AtlasCellFact): boolean {
  return ownValues(run.atlas.knowledge).some(
    (record) =>
      record.subjectId === fact.id &&
      record.state !== "unknown" &&
      record.state !== "lost_contact",
  );
}

function factsForContact(
  run: GalaxyRunState,
  contactId: string,
): AtlasCellFact[] {
  return ownValues(run.atlas.materializedFacts).filter(
    (fact) =>
      (fact.id === contactId || fact.contactId === contactId) &&
      isKnownFact(run, fact),
  );
}

function factAtCoordinate(
  run: GalaxyRunState,
  coordinate: GalaxyCoordinate,
): AtlasCellFact | null {
  const requestedCellKey = cellKey(coordinate);
  const matches = ownValues(run.atlas.materializedFacts)
    .filter(
      (fact) =>
        validateCoordinate(fact.coordinate).ok &&
        cellKey(fact.coordinate) === requestedCellKey &&
        isKnownFact(run, fact),
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  return matches.length === 1 ? matches[0] : null;
}

function resolveTarget(
  run: GalaxyRunState,
  value: unknown,
  policy: RoutePlanningPolicy,
): ResolvedTarget | RoutePlanResult {
  if (!isRecord(value) || !hasOwn(value, "kind")) {
    return blocked(
      "invalid_target",
      "Route target must be an explicit target object.",
    );
  }

  if (value.kind === "contact") {
    if (
      !hasOwn(value, "contactId") ||
      typeof value.contactId !== "string" ||
      value.contactId.length === 0
    ) {
      return blocked(
        "invalid_target",
        "Contact targets require a non-empty contact ID.",
      );
    }
    const matches = factsForContact(run, value.contactId);
    if (matches.length === 0) {
      return blocked(
        "unknown_contact",
        `Contact ${value.contactId} is not known in the saved Atlas.`,
      );
    }
    if (matches.length !== 1) {
      return blocked(
        "ambiguous_contact",
        `Contact ${value.contactId} resolves to more than one saved Atlas fact.`,
      );
    }
    const fact = matches[0];
    if (!validateCoordinate(fact.coordinate).ok) {
      return blocked(
        "invalid_coordinate",
        `Contact ${value.contactId} has an invalid saved coordinate.`,
      );
    }
    return {
      target: { kind: "contact", contactId: value.contactId },
      targetId: value.contactId,
      destination: cloneCoordinate(fact.coordinate),
      threatSubjectId: fact.id,
    };
  }

  if (value.kind === "coordinate") {
    if (!policy.allowBlindCoordinates) {
      return blocked(
        "blind_travel_disabled",
        "Current route policy does not allow blind coordinate travel.",
      );
    }
    if (
      !hasOwn(value, "coordinate") ||
      !validateCoordinate(value.coordinate).ok
    ) {
      return blocked(
        "invalid_coordinate",
        "Coordinate target must contain four safe integer authority values.",
      );
    }
    const destination = cloneCoordinate(value.coordinate as GalaxyCoordinate);
    const knownFact = factAtCoordinate(run, destination);
    return {
      target: { kind: "coordinate", coordinate: cloneCoordinate(destination) },
      targetId: null,
      destination,
      threatSubjectId: knownFact?.id ?? null,
    };
  }

  return blocked("invalid_target", "Route target kind is not supported.");
}

function validPolicy(value: unknown): value is RoutePlanningPolicy {
  if (!isRecord(value)) return false;
  return (
    hasOwn(value, "routing") &&
    value.routing === "direct_only" &&
    hasOwn(value, "allowBlindCoordinates") &&
    typeof value.allowBlindCoordinates === "boolean"
  );
}

function isThreatBand(value: unknown): value is ThreatBand {
  return THREAT_BANDS.some((candidate) => candidate === value);
}

function isConfidence(value: unknown): value is KnowledgeConfidence {
  return CONFIDENCES.some((candidate) => candidate === value);
}

function isKnowledgeSource(value: unknown): value is KnowledgeSource {
  return KNOWLEDGE_SOURCES.some((candidate) => candidate === value);
}

function lowerConfidence(
  left: KnowledgeConfidence,
  right: KnowledgeConfidence,
): KnowledgeConfidence {
  return CONFIDENCE_RANK[left] <= CONFIDENCE_RANK[right] ? left : right;
}

function higherKnownBand(
  left: Exclude<ThreatBand, "unknown">,
  right: Exclude<ThreatBand, "unknown">,
): Exclude<ThreatBand, "unknown"> {
  return BAND_RANK[left] >= BAND_RANK[right] ? left : right;
}

function currentDimensionObservations(
  run: GalaxyRunState,
  subjectId: string,
  dimension: ThreatDimension,
): ThreatObservation[] {
  const candidates = run.atlas.threatObservations.filter(
    (observation) =>
      observation.subjectId === subjectId &&
      observation.dimension === dimension &&
      isThreatBand(observation.band) &&
      isConfidence(observation.confidence) &&
      isKnowledgeSource(observation.source) &&
      Number.isSafeInteger(observation.observedCycle) &&
      observation.observedCycle >= 0,
  );
  if (candidates.length === 0) return [];
  const latestCycle = Math.max(
    ...candidates.map((observation) => observation.observedCycle),
  );
  return candidates
    .filter((observation) => observation.observedCycle === latestCycle)
    .sort((left, right) => left.id.localeCompare(right.id));
}

function previewDimension(
  run: GalaxyRunState,
  subjectId: string | null,
  destination: GalaxyCoordinate,
  dimension: ThreatDimension,
): ThreatDimensionPreview {
  const unknownMarker =
    subjectId === null
      ? `unobserved:${coordinateKey(destination)}`
      : `unobserved:${subjectId}:${dimension}`;
  if (subjectId === null) {
    return {
      band: "unknown",
      confidence: "low",
      sources: [],
      unknownContributors: [unknownMarker],
    };
  }

  const observations = currentDimensionObservations(run, subjectId, dimension);
  if (observations.length === 0) {
    return {
      band: "unknown",
      confidence: "low",
      sources: [],
      unknownContributors: [unknownMarker],
    };
  }

  let band: ThreatBand = "unknown";
  let confidence: KnowledgeConfidence = "high";
  const sources = new Set<KnowledgeSource>();
  const unknownContributors: string[] = [];
  for (const observation of observations) {
    confidence = lowerConfidence(confidence, observation.confidence);
    sources.add(observation.source);
    if (observation.band === "unknown") {
      unknownContributors.push(observation.id);
      continue;
    }
    band =
      band === "unknown"
        ? observation.band
        : higherKnownBand(band, observation.band);
  }

  return {
    band,
    confidence,
    sources: [...sources].sort(),
    unknownContributors: unknownContributors.sort(),
  };
}

function threatPresentation(band: ThreatBand): OverallThreatPreview["presentation"] {
  switch (band) {
    case "low":
      return "LOW EXPOSURE";
    case "moderate":
      return "MODERATE EXPOSURE";
    case "high":
      return "HIGH EXPOSURE";
    case "severe":
      return "SEVERE EXPOSURE";
    case "unknown":
      return "UNCERTAIN — INCOMPLETE THREAT DATA";
  }
}

function previewThreat(
  run: GalaxyRunState,
  subjectId: string | null,
  destination: GalaxyCoordinate,
): RouteThreatPreview {
  const dimensions = {} as Record<ThreatDimension, ThreatDimensionPreview>;
  let overallBand: ThreatBand = "unknown";
  let overallConfidence: KnowledgeConfidence = "high";
  let hasUnknownDimension = false;

  for (const dimension of THREAT_DIMENSIONS) {
    const preview = previewDimension(run, subjectId, destination, dimension);
    dimensions[dimension] = preview;
    overallConfidence = lowerConfidence(overallConfidence, preview.confidence);
    if (preview.band === "unknown") {
      hasUnknownDimension = true;
    } else {
      overallBand =
        overallBand === "unknown"
          ? preview.band
          : higherKnownBand(overallBand, preview.band);
    }
  }

  if (hasUnknownDimension) overallBand = "unknown";
  return {
    dimensions,
    overall: {
      band: overallBand,
      confidence: overallConfidence,
      presentation: threatPresentation(overallBand),
    },
  };
}

function latestAccessAssessment(
  run: GalaxyRunState,
  subjectId: string | null,
): GalaxyRunState["atlas"]["accessFacts"][number] | null {
  if (subjectId === null) return null;
  const matching = run.atlas.accessFacts
    .filter(
      (fact) =>
        fact.subjectId === subjectId &&
        Number.isSafeInteger(fact.cycle) &&
        fact.cycle >= 0,
    )
    .sort(
      (left, right) =>
        left.cycle - right.cycle || left.id.localeCompare(right.id),
    );
  return matching[matching.length - 1] ?? null;
}

function interruptionCause(
  run: GalaxyRunState,
  subjectId: string | null,
): string | null {
  if (subjectId !== "contact:hostile-picket") return null;
  if (latestAccessAssessment(run, subjectId)?.assessment === "secured") {
    return null;
  }
  return run.historyFacts.some(
    (fact) =>
      fact.id === "fact:picket-patrol-active" &&
      fact.subjectId === "contact:hostile-picket",
  )
    ? "fact:picket-patrol-active"
    : null;
}

type RouteIdentityInputs = Omit<
  RoutePlan,
  | "id"
  | "threat"
  | "knownPorts"
  | "relayCandidates"
  | "knownAllies"
  | "repairOpportunities"
  | "forecastedWorldChanges"
>;

function identityPayload(plan: RouteIdentityInputs): string {
  return JSON.stringify([
    "route-plan-v1",
    [
      plan.origin.sectorX,
      plan.origin.sectorY,
      plan.origin.localX,
      plan.origin.localY,
    ],
    [
      plan.destination.sectorX,
      plan.destination.sectorY,
      plan.destination.localX,
      plan.destination.localY,
    ],
    plan.target.kind === "contact"
      ? ["contact", plan.target.contactId]
      : [
          "coordinate",
          plan.target.coordinate.sectorX,
          plan.target.coordinate.sectorY,
          plan.target.coordinate.localX,
          plan.target.coordinate.localY,
        ],
    plan.targetId,
    [
      plan.capability.maxLegDistance,
      plan.capability.availableSupply,
      plan.capability.engineBoostLevel,
    ],
    [plan.policy.routing, plan.policy.allowBlindCoordinates],
    [
      plan.identity.galaxySeed,
      plan.identity.generationVersion,
      plan.identity.authoredAnchorRegistryVersion,
    ],
    plan.legs.map((leg) => [
      leg.id,
      [leg.from.sectorX, leg.from.sectorY, leg.from.localX, leg.from.localY],
      [leg.to.sectorX, leg.to.sectorY, leg.to.localX, leg.to.localY],
      leg.distanceUnits,
      leg.cycles,
      leg.supplyCost,
      leg.interruptionCauseId,
    ]),
    [
      plan.distanceUnits,
      plan.elapsedCycles,
      plan.supplyCost,
      plan.projectedReserve,
    ],
    plan.cycleSnapshot,
  ]);
}

function planId(payload: string): string {
  const hash = stableHash(`route:${payload}`).toString(16).padStart(8, "0");
  // The canonical payload suffix makes IDs distinct even if the compact hash
  // prefix collides. This stays synchronous and identical in SSR and browsers.
  return `route:${hash}:${payload}`;
}

export function planRoute(
  run: GalaxyRunState,
  target: AtlasTarget,
  policy: RoutePlanningPolicy = G0_DIRECT_ROUTE_POLICY,
): RoutePlanResult {
  if (!validGenerationIdentity(run.identity)) {
    return blocked(
      "invalid_generation_identity",
      "The saved galaxy generation identity is incomplete.",
      "unsupported",
    );
  }
  const availability = getGenerationAvailability(run.identity);
  if (!availability.generationVersionAvailable) {
    return blocked(
      "unsupported_generation_version",
      `Generation version ${run.identity.generationVersion} is unavailable but recoverable.`,
      "unsupported",
    );
  }
  if (!availability.authoredAnchorRegistryVersionAvailable) {
    return blocked(
      "unsupported_registry_version",
      `Authored anchor registry version ${run.identity.authoredAnchorRegistryVersion} is unavailable but recoverable.`,
      "unsupported",
    );
  }
  if (!validPolicy(policy)) {
    return blocked(
      "unsupported_policy",
      "Only the version-1 direct-route policy is supported.",
      "unsupported",
    );
  }
  if (!Number.isSafeInteger(run.worldCycle) || run.worldCycle < 0) {
    return blocked(
      "invalid_cycle_snapshot",
      "The saved world-cycle snapshot is invalid.",
    );
  }
  if (
    !Number.isSafeInteger(run.ship.upgrades.engineBoost) ||
    run.ship.upgrades.engineBoost < 0
  ) {
    return blocked(
      "invalid_capability",
      "The saved ship capability is invalid.",
    );
  }
  if (!Number.isSafeInteger(run.resources.supply) || run.resources.supply < 0) {
    return blocked("invalid_supply", "The saved supply reserve is invalid.");
  }
  if (run.activeTravel !== null) {
    return blocked(
      "active_travel_exists",
      "Finish or resolve the active travel commitment before plotting another route.",
    );
  }
  if (run.vessel.status !== "stationary") {
    return blocked(
      "vessel_not_stationary",
      `The vessel is ${run.vessel.status}; route previews require a stationary vessel.`,
    );
  }
  if (run.vessel.transitTransactionId !== null) {
    return blocked(
      "vessel_has_transit",
      "The vessel still references an unresolved transit transaction.",
    );
  }
  if (!validateCoordinate(run.vessel.coordinate).ok) {
    return blocked("invalid_origin", "The saved vessel origin is invalid.");
  }
  if (!isWithinG0LocalBounds(run.vessel.coordinate)) {
    return blocked(
      "outside_g0_bounds",
      "The saved vessel origin is outside the version-1 G0 sector bounds.",
    );
  }

  const resolvedTarget = resolveTarget(run, target, policy);
  if (!("destination" in resolvedTarget)) return resolvedTarget;
  const origin = cloneCoordinate(run.vessel.coordinate);
  const destination = cloneCoordinate(resolvedTarget.destination);

  if (
    destination.sectorX !== origin.sectorX ||
    destination.sectorY !== origin.sectorY
  ) {
    return blocked(
      "cross_sector_route",
      "Version-1 route distance is available only within the current sector.",
    );
  }
  if (!isWithinG0LocalBounds(destination)) {
    return blocked(
      "outside_g0_bounds",
      "The destination is outside the version-1 G0 sector bounds.",
    );
  }
  if (sameCoordinate(origin, destination)) {
    return blocked(
      "already_at_destination",
      "The vessel is already at that destination.",
    );
  }

  const directDistance = Math.round(measureDistanceUnits(origin, destination));
  if (directDistance > G0_MAX_LEG_DISTANCE) {
    return blocked(
      "over_maximum_leg_distance",
      `Direct route distance ${directDistance} exceeds the maximum leg distance ${G0_MAX_LEG_DISTANCE}. No relay is available in G0 version 1.`,
    );
  }
  const elapsedCycles = Math.max(
    1,
    Math.min(3, Math.ceil(directDistance / G0_CYCLE_DISTANCE)),
  );
  const supplyCost = Math.ceil(directDistance / G0_SUPPLY_DISTANCE);
  if (run.resources.supply < supplyCost) {
    return blocked(
      "insufficient_supply",
      `Route requires ${supplyCost} supply; only ${run.resources.supply} is available.`,
    );
  }

  const access = latestAccessAssessment(run, resolvedTarget.threatSubjectId);
  if (access?.assessment === "denied") {
    return blocked(
      "access_denied",
      `Saved access fact ${access.id} denies travel to this destination.`,
    );
  }

  const capability: RouteCapabilitySnapshot = {
    maxLegDistance: G0_MAX_LEG_DISTANCE,
    availableSupply: run.resources.supply,
    engineBoostLevel: run.ship.upgrades.engineBoost,
  };
  const policySnapshot: RoutePlanningPolicy = {
    routing: policy.routing,
    allowBlindCoordinates: policy.allowBlindCoordinates,
  };
  const identity = { ...run.identity };
  const causeId = interruptionCause(run, resolvedTarget.threatSubjectId);
  const leg: RouteLeg = {
    id: `leg:direct:${coordinateKey(origin)}:${coordinateKey(destination)}`,
    from: cloneCoordinate(origin),
    to: cloneCoordinate(destination),
    distanceUnits: directDistance,
    cycles: elapsedCycles,
    supplyCost,
    interruptionCauseId: causeId,
  };
  const targetSnapshot: AtlasTarget =
    resolvedTarget.target.kind === "contact"
      ? { ...resolvedTarget.target }
      : {
          kind: "coordinate",
          coordinate: cloneCoordinate(resolvedTarget.target.coordinate),
        };
  const identityInputs = {
    origin: cloneCoordinate(origin),
    destination: cloneCoordinate(destination),
    target: targetSnapshot,
    targetId: resolvedTarget.targetId,
    identity,
    capability,
    policy: policySnapshot,
    cycleSnapshot: run.worldCycle,
    legs: [leg],
    distanceUnits: directDistance,
    elapsedCycles,
    supplyCost,
    projectedReserve: run.resources.supply - supplyCost,
  };
  const payload = identityPayload(identityInputs);

  return {
    ok: true,
    plan: {
      id: planId(payload),
      ...identityInputs,
      threat: previewThreat(
        run,
        resolvedTarget.threatSubjectId,
        destination,
      ),
      knownPorts: [],
      relayCandidates: [],
      knownAllies: [],
      repairOpportunities: [],
      forecastedWorldChanges: [],
    },
  };
}

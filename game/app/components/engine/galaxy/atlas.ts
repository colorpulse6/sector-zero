import {
  getAuthoredAnchorRegistry,
  type AuthoredAnchor,
} from "./authoredAnchors";
import { cellAddress, cellKey, coord, stableHash } from "./coordinates";
import type {
  AtlasCellFact,
  AtlasGenerationIdentity,
  AtlasKnowledgeRecord,
  GalaxyAtlasState,
  KnowledgeConfidence,
  KnowledgeSource,
  KnowledgeState,
} from "./galaxyTypes";

export const G0_GENERATION_IDENTITY = Object.freeze({
  galaxySeed: "sector-zero-g0",
  generationVersion: 1,
  authoredAnchorRegistryVersion: 1,
} as const);

export const G0_SECTOR_BOUNDS = Object.freeze({
  min: 0,
  max: 4095,
  cellSize: 256,
} as const);

export type ResolveCellResult =
  | { ok: true; fact: AtlasCellFact }
  | {
      ok: false;
      reason:
        | "unsupported_generation_version"
        | "unsupported_registry_version";
    };

export interface GenerationAvailability {
  status: "available" | "unavailable";
  generationVersionAvailable: boolean;
  authoredAnchorRegistryVersionAvailable: boolean;
}

export interface AtlasKnowledgePromotionInput {
  fact: AtlasCellFact;
  record: Omit<AtlasKnowledgeRecord, "state" | "subjectId">;
}

export interface NegativeSurveyInput {
  fact: AtlasCellFact & { kind: "empty"; contactId: null };
  source: KnowledgeSource;
  confidence: KnowledgeConfidence;
  observedCycle: number;
}

const PROCEDURAL_KINDS: readonly AtlasCellFact["kind"][] = Object.freeze([
  "empty",
  "stellar_contact",
  "hazard",
  "ruin",
  "anomaly",
  "signal",
]);

type GenerationResolver = (
  identity: AtlasGenerationIdentity,
  coordinate: AtlasCellFact["coordinate"],
  anchors: readonly AuthoredAnchor[],
) => AtlasCellFact;

function canonicalCoordinate(
  coordinate: AtlasCellFact["coordinate"],
): AtlasCellFact["coordinate"] {
  const address = cellAddress(coordinate);
  return coord(
    address.sectorX,
    address.sectorY,
    address.cellX * G0_SECTOR_BOUNDS.cellSize,
    address.cellY * G0_SECTOR_BOUNDS.cellSize,
  );
}

function authoredFact(
  identity: AtlasGenerationIdentity,
  anchor: AuthoredAnchor,
): AtlasCellFact {
  return {
    id: anchor.id,
    cellKey: cellKey(anchor.coordinate),
    coordinate: { ...anchor.coordinate },
    kind: anchor.kind,
    contactId: anchor.contactId,
    stableSeed: stableHash(
      `authored:${identity.authoredAnchorRegistryVersion}:${anchor.id}`,
    ),
    authored: true,
  };
}

function proceduralIdentityKey(
  identity: AtlasGenerationIdentity,
  coordinate: AtlasCellFact["coordinate"],
): string {
  const address = cellAddress(coordinate);
  return JSON.stringify([
    identity.galaxySeed,
    identity.generationVersion,
    identity.authoredAnchorRegistryVersion,
    address.sectorX,
    address.sectorY,
    address.cellX,
    address.cellY,
  ]);
}

function proceduralFact(
  identity: AtlasGenerationIdentity,
  coordinate: AtlasCellFact["coordinate"],
): AtlasCellFact {
  const identityKey = proceduralIdentityKey(identity, coordinate);
  const stableSeed = stableHash(`seed:${identityKey}`);
  const factId = `procedural:${identityKey}`;
  const kind = PROCEDURAL_KINDS[stableSeed % PROCEDURAL_KINDS.length];

  return {
    id: factId,
    cellKey: cellKey(coordinate),
    coordinate: canonicalCoordinate(coordinate),
    kind,
    contactId: kind === "stellar_contact" ? `contact:${factId}` : null,
    stableSeed,
    authored: false,
  };
}

function resolveGenerationV1(
  identity: AtlasGenerationIdentity,
  coordinate: AtlasCellFact["coordinate"],
  anchors: readonly AuthoredAnchor[],
): AtlasCellFact {
  const requestedCellKey = cellKey(coordinate);
  const anchor = anchors.find(
    (candidate) => cellKey(candidate.coordinate) === requestedCellKey,
  );
  if (anchor !== undefined) {
    return authoredFact(identity, anchor);
  }
  return proceduralFact(identity, coordinate);
}

const GENERATION_RESOLVERS = Object.freeze({
  1: resolveGenerationV1,
});

function generationResolverFor(
  version: number,
): GenerationResolver | undefined {
  if (!Object.prototype.hasOwnProperty.call(GENERATION_RESOLVERS, version)) {
    return undefined;
  }
  return GENERATION_RESOLVERS[version as keyof typeof GENERATION_RESOLVERS];
}

export function getGenerationAvailability(
  identity: AtlasGenerationIdentity,
): GenerationAvailability {
  const generationVersionAvailable =
    generationResolverFor(identity.generationVersion) !== undefined;
  const authoredAnchorRegistryVersionAvailable = getAuthoredAnchorRegistry(
    identity.authoredAnchorRegistryVersion,
  ).ok;

  return {
    status:
      generationVersionAvailable && authoredAnchorRegistryVersionAvailable
        ? "available"
        : "unavailable",
    generationVersionAvailable,
    authoredAnchorRegistryVersionAvailable,
  };
}

export function resolveCell(
  identity: AtlasGenerationIdentity,
  coordinate: AtlasCellFact["coordinate"],
): ResolveCellResult {
  const resolver = generationResolverFor(identity.generationVersion);
  if (resolver === undefined) {
    return { ok: false, reason: "unsupported_generation_version" };
  }

  const registry = getAuthoredAnchorRegistry(
    identity.authoredAnchorRegistryVersion,
  );
  if (!registry.ok) {
    return registry;
  }

  return { ok: true, fact: resolver(identity, coordinate, registry.anchors) };
}

export function materializeCell(
  savedFact: AtlasCellFact | null,
  regeneratedFact: AtlasCellFact,
): AtlasCellFact {
  return savedFact ?? regeneratedFact;
}

const PROMOTION_RANK: Readonly<Record<Exclude<KnowledgeState, "lost_contact">, number>> =
  Object.freeze({
    unknown: 0,
    signal: 1,
    charted: 2,
    visited: 3,
  });

function cloneFact(fact: AtlasCellFact): AtlasCellFact {
  return { ...fact, coordinate: { ...fact.coordinate } };
}

function cloneKnowledgeRecord(
  record: AtlasKnowledgeRecord,
): AtlasKnowledgeRecord {
  return {
    ...record,
    observedProperties: { ...record.observedProperties },
  };
}

function emptyDictionary<T>(): Record<string, T> {
  return Object.create(null) as Record<string, T>;
}

function ownDictionaryValue<T>(
  dictionary: Record<string, T>,
  key: string,
): T | undefined {
  if (!Object.prototype.hasOwnProperty.call(dictionary, key)) {
    return undefined;
  }
  return dictionary[key];
}

function cloneAtlasState(state: GalaxyAtlasState): GalaxyAtlasState {
  const materializedFacts = emptyDictionary<AtlasCellFact>();
  for (const [key, fact] of Object.entries(state.materializedFacts)) {
    materializedFacts[key] = cloneFact(fact);
  }

  const knowledge = emptyDictionary<AtlasKnowledgeRecord>();
  for (const [key, record] of Object.entries(state.knowledge)) {
    knowledge[key] = cloneKnowledgeRecord(record);
  }

  return {
    materializedFacts,
    knowledge,
    mappedCellKeys: [...state.mappedCellKeys],
    accessFacts: state.accessFacts.map((fact) => ({
      ...fact,
      causeFactIds: [...fact.causeFactIds],
    })),
    threatObservations: state.threatObservations.map((observation) => ({
      ...observation,
    })),
  };
}

function canPromote(
  current: AtlasKnowledgeRecord | undefined,
  targetState: Exclude<KnowledgeState, "unknown" | "lost_contact">,
): boolean {
  if (current === undefined || current.state === "lost_contact") {
    return true;
  }
  return PROMOTION_RANK[targetState] > PROMOTION_RANK[current.state];
}

function promoteKnowledge(
  state: GalaxyAtlasState,
  input: AtlasKnowledgePromotionInput,
  targetState: Exclude<KnowledgeState, "unknown" | "lost_contact">,
): GalaxyAtlasState {
  const materializedFact = materializeCell(
    ownDictionaryValue(state.materializedFacts, input.fact.cellKey) ?? null,
    input.fact,
  );
  const current = ownDictionaryValue(state.knowledge, input.record.id);
  if (current !== undefined && current.subjectId !== materializedFact.id) {
    return state;
  }
  if (!canPromote(current, targetState)) {
    return state;
  }

  const next = cloneAtlasState(state);
  next.materializedFacts[materializedFact.cellKey] = cloneFact(materializedFact);
  next.knowledge[input.record.id] = {
    ...input.record,
    subjectId: materializedFact.id,
    observedProperties: { ...input.record.observedProperties },
    state: targetState,
  };

  if (
    targetState !== "signal" &&
    !next.mappedCellKeys.includes(materializedFact.cellKey)
  ) {
    next.mappedCellKeys.push(materializedFact.cellKey);
  }

  return next;
}

export function observeFact(
  state: GalaxyAtlasState,
  input: AtlasKnowledgePromotionInput,
): GalaxyAtlasState {
  return promoteKnowledge(state, input, "signal");
}

export function chartFact(
  state: GalaxyAtlasState,
  input: AtlasKnowledgePromotionInput,
): GalaxyAtlasState {
  return promoteKnowledge(state, input, "charted");
}

export function visitFact(
  state: GalaxyAtlasState,
  input: AtlasKnowledgePromotionInput,
): GalaxyAtlasState {
  return promoteKnowledge(state, input, "visited");
}

export function recordNegativeSurvey(
  state: GalaxyAtlasState,
  input: NegativeSurveyInput,
): GalaxyAtlasState {
  if (input.fact.kind !== "empty" || input.fact.contactId !== null) {
    return state;
  }

  const materializedFact = materializeCell(
    ownDictionaryValue(state.materializedFacts, input.fact.cellKey) ?? null,
    input.fact,
  );
  if (materializedFact.kind !== "empty" || materializedFact.contactId !== null) {
    return state;
  }

  const recordId = `knowledge:negative-survey:${JSON.stringify([
    materializedFact.cellKey,
    materializedFact.id,
  ])}`;
  if (ownDictionaryValue(state.knowledge, recordId) !== undefined) {
    return state;
  }

  return promoteKnowledge(
    state,
    {
      fact: materializedFact,
      record: {
        id: recordId,
        observedProperties: {
          negativeSurvey: true,
          surveyResult: "no_contact",
          cellKey: materializedFact.cellKey,
        },
        confidence: input.confidence,
        source: input.source,
        observedCycle: input.observedCycle,
        expiresCycle: null,
      },
    },
    "charted",
  );
}

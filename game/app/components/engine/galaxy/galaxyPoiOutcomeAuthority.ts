import { dispatchPoi } from "../../colony/region/poiDispatcher";
import { confirmPoiOutcome, POI_CARGO } from "../../colony/region/poiOutcomes";
import type { ColonyId } from "../../colony/shared/colonyTypes";
import { stableHash } from "./coordinates";
import { getGalaxyRunAvailability } from "./galaxyRun";
import {
  advanceGalaxyWorldCycles,
  mergeProjectionIntoGalaxy,
  projectGalaxyRunToLegacyState,
} from "./galaxyProjection";
import type { GalaxyRunState, HistoricalFact } from "./galaxyTypes";
import type { MissionDelivery } from "../../colony/shared/missionDelivery";
import type { OutcomeRouteIdentity, SaveData } from "../types";

type PoiIdentity = Extract<OutcomeRouteIdentity, { kind: "poi" }>;

export interface GalaxyPoiPreparedBinding {
  launchId: string;
  outcomeId: string;
  preparedRevision: number;
}

export interface RecoveredGalaxyPoiPreparation extends GalaxyPoiPreparedBinding {
  identity: PoiIdentity;
  cycle: number;
  factId: string;
}

export type GalaxyPoiAuthorityResult =
  | { ok: true; galaxyRun: GalaxyRunState; delivery: MissionDelivery | null }
  | { ok: false };

type PreparedTuple = readonly [
  version: 2,
  launchId: string,
  outcomeId: string,
  preparedRevision: number,
  originColonyId: string,
  nodeId: string,
  templateId: string,
  engine: PoiIdentity["engine"],
  rewardEligible: boolean,
];

function ownData(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const actual = Reflect.ownKeys(value);
  if (actual.length !== keys.length || actual.some((key) => typeof key !== "string" || !keys.includes(key))) return null;
  const snapshot: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor)) return null;
    snapshot[key] = descriptor.value;
  }
  return snapshot;
}

function denseTuple(value: unknown): unknown[] | null {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== value.length + 1 || keys.some((key) => key !== "length" &&
    (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length))) return null;
  const snapshot: unknown[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !("value" in descriptor)) return null;
    snapshot.push(descriptor.value);
  }
  return snapshot;
}

function preparedTuple(identity: PoiIdentity, binding: GalaxyPoiPreparedBinding): PreparedTuple | null {
  if (typeof binding.launchId !== "string" || binding.launchId.length === 0 ||
    binding.outcomeId !== `${binding.launchId}:success` ||
    !Number.isSafeInteger(binding.preparedRevision) || binding.preparedRevision < 0) return null;
  return [
    2,
    binding.launchId,
    binding.outcomeId,
    binding.preparedRevision,
    identity.originColonyId,
    identity.nodeId,
    identity.templateId,
    identity.engine,
    identity.rewardEligible,
  ];
}

function preparedFactId(tuple: PreparedTuple): string {
  const canonical = JSON.stringify(tuple);
  const hash = stableHash(`poi-prepared-v2:${canonical}`).toString(16).padStart(8, "0");
  return `history:poi-prepared-v2:${hash}:${encodeURIComponent(canonical)}`;
}

export function isGalaxyPoiPreparedAuthorityFact(fact: Pick<HistoricalFact, "id" | "kind">): boolean {
  return fact.kind === "poi_completion_prepared" ||
    (typeof fact.id === "string" &&
      (fact.id.startsWith("history:poi-prepared:") || fact.id.startsWith("history:poi-prepared-v2:")));
}

function decodePreparedFact(fact: HistoricalFact): RecoveredGalaxyPoiPreparation | null {
  const snapshot = ownData(fact, ["id", "kind", "subjectId", "cycle", "causeFactIds"]);
  if (snapshot === null || snapshot.kind !== "poi_completion_prepared" ||
    typeof snapshot.id !== "string" || !Number.isSafeInteger(snapshot.cycle) || (snapshot.cycle as number) < 0) return null;
  const causes = denseTuple(snapshot.causeFactIds);
  if (causes === null || causes.length !== 0) return null;
  const match = /^history:poi-prepared-v2:([0-9a-f]{8}):(.*)$/.exec(snapshot.id);
  if (match === null) return null;
  let decoded: unknown[] | null;
  try { decoded = denseTuple(JSON.parse(decodeURIComponent(match[2]))); }
  catch { return null; }
  if (decoded === null || decoded.length !== 9 || decoded[0] !== 2 ||
    typeof decoded[1] !== "string" || decoded[1].length === 0 ||
    decoded[2] !== `${decoded[1]}:success` ||
    !Number.isSafeInteger(decoded[3]) || (decoded[3] as number) < 0 ||
    typeof decoded[4] !== "string" || decoded[4].length === 0 ||
    typeof decoded[5] !== "string" || decoded[5].length === 0 ||
    typeof decoded[6] !== "string" || decoded[6].length === 0 ||
    (decoded[7] !== "firstPerson" && decoded[7] !== "boarding" && decoded[7] !== "groundRun") ||
    typeof decoded[8] !== "boolean" || snapshot.subjectId !== decoded[5]) return null;
  const identity: PoiIdentity = {
    kind: "poi",
    originColonyId: decoded[4],
    nodeId: decoded[5],
    templateId: decoded[6],
    engine: decoded[7],
    rewardEligible: decoded[8],
  };
  const tuple = preparedTuple(identity, {
    launchId: decoded[1],
    outcomeId: decoded[2] as string,
    preparedRevision: decoded[3] as number,
  });
  if (tuple === null || snapshot.id !== preparedFactId(tuple)) return null;
  return {
    launchId: tuple[1],
    outcomeId: tuple[2],
    preparedRevision: tuple[3],
    identity,
    cycle: snapshot.cycle as number,
    factId: snapshot.id,
  };
}

function canonicalIdentity(run: GalaxyRunState, identity: PoiIdentity): boolean {
  try {
    const projection = projectGalaxyRunToLegacyState(run);
    const dispatched = dispatchPoi(projection, identity.originColonyId, identity.nodeId);
    const colony = projection.colonies.find((entry) => entry.id === identity.originColonyId);
    const node = projection.planets.find((entry) => entry.id === colony?.planetId)
      ?.regionMap.nodes.find((entry) => entry.id === identity.nodeId);
    return dispatched.ok && node !== undefined && node.templateId === identity.templateId &&
      dispatched.session.engine === identity.engine &&
      dispatched.session.rewardEligible === identity.rewardEligible;
  } catch {
    return false;
  }
}

export function createGalaxyPoiPreparedFact(
  submittedRun: GalaxyRunState,
  identity: PoiIdentity,
  binding: GalaxyPoiPreparedBinding,
): HistoricalFact | null {
  const tuple = preparedTuple(identity, binding);
  const validated = mergeProjectionIntoGalaxy(submittedRun, {});
  if (tuple === null || !validated.ok || !canonicalIdentity(validated.galaxyRun, identity) ||
    validated.galaxyRun.historyFacts.some(isGalaxyPoiPreparedAuthorityFact)) return null;
  return {
    id: preparedFactId(tuple),
    kind: "poi_completion_prepared",
    subjectId: identity.nodeId,
    cycle: validated.galaxyRun.worldCycle,
    causeFactIds: [],
  };
}

export function recoverGalaxyPoiPreparation(
  submittedRun: GalaxyRunState,
): RecoveredGalaxyPoiPreparation | null {
  const validated = mergeProjectionIntoGalaxy(submittedRun, {});
  if (!validated.ok) return null;
  const reserved = validated.galaxyRun.historyFacts.filter(isGalaxyPoiPreparedAuthorityFact);
  if (reserved.length !== 1) return null;
  const recovered = decodePreparedFact(reserved[0]);
  return recovered !== null && recovered.cycle === validated.galaxyRun.worldCycle &&
    canonicalIdentity(validated.galaxyRun, recovered.identity)
    ? recovered
    : null;
}

export function resolveGalaxyPoiOutcomeFromRun(
  submittedRun: GalaxyRunState,
  identity: PoiIdentity,
  binding: GalaxyPoiPreparedBinding,
  destinationColonyId: ColonyId | null,
): GalaxyPoiAuthorityResult {
  if (destinationColonyId !== null &&
    (typeof destinationColonyId !== "string" || destinationColonyId.length === 0)) return { ok: false };
  const validated = mergeProjectionIntoGalaxy(submittedRun, {});
  if (!validated.ok || getGalaxyRunAvailability(validated.galaxyRun).status !== "available") return { ok: false };
  const recovered = recoverGalaxyPoiPreparation(validated.galaxyRun);
  if (recovered === null || recovered.launchId !== binding.launchId ||
    recovered.outcomeId !== binding.outcomeId || recovered.preparedRevision !== binding.preparedRevision ||
    recovered.identity.originColonyId !== identity.originColonyId ||
    recovered.identity.nodeId !== identity.nodeId || recovered.identity.templateId !== identity.templateId ||
    recovered.identity.engine !== identity.engine ||
    recovered.identity.rewardEligible !== identity.rewardEligible) return { ok: false };
  const advanced = advanceGalaxyWorldCycles(validated.galaxyRun, 1);
  if (!advanced.ok) return { ok: false };
  const projection = projectGalaxyRunToLegacyState(advanced.galaxyRun);
  let resolvedSave: SaveData = projection;
  let delivery: MissionDelivery | null = null;
  if (identity.rewardEligible) {
    if (destinationColonyId === null) return { ok: false };
    const resolved = confirmPoiOutcome(projection, {
      originColonyId: identity.originColonyId,
      nodeId: identity.nodeId,
      payload: { ...POI_CARGO },
    }, destinationColonyId);
    if (!resolved.ok) return { ok: false };
    resolvedSave = resolved.save;
    delivery = resolved.delivery;
  }
  const merged = mergeProjectionIntoGalaxy(advanced.galaxyRun, {
    colonies: resolvedSave.colonies,
    planets: resolvedSave.planets,
    missionsSinceStart: resolvedSave.missionsSinceStart,
  });
  if (!merged.ok) return { ok: false };
  const galaxyRun = structuredClone(merged.galaxyRun);
  const matches = galaxyRun.historyFacts.filter((fact) => fact.id === recovered.factId);
  if (matches.length !== 1) return { ok: false };
  galaxyRun.historyFacts = galaxyRun.historyFacts.filter((fact) => fact.id !== recovered.factId);
  const finalValidation = mergeProjectionIntoGalaxy(galaxyRun, {});
  return finalValidation.ok
    ? { ok: true, galaxyRun: finalValidation.galaxyRun, delivery }
    : { ok: false };
}

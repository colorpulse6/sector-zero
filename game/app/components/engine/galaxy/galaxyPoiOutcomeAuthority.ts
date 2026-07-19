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
  try {
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
  } catch {
    return null;
  }
}

function requiredOwnData(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const snapshot: Record<string, unknown> = {};
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor) || typeof descriptor.value === "function") return null;
      snapshot[key] = descriptor.value;
    }
    return keys.every((key) => Object.prototype.hasOwnProperty.call(snapshot, key))
      ? snapshot
      : null;
  } catch {
    return null;
  }
}

function denseTuple(value: unknown): unknown[] | null {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (lengthDescriptor === undefined || !("value" in lengthDescriptor) ||
      !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0) return null;
    const length = lengthDescriptor.value as number;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== length + 1 || keys.some((key) => key !== "length" &&
      (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length))) return null;
    const snapshot: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !("value" in descriptor)) return null;
      snapshot.push(descriptor.value);
    }
    return snapshot;
  } catch {
    return null;
  }
}

function snapshotPoiIdentity(value: unknown): PoiIdentity | null {
  const identity = ownData(value, [
    "kind", "originColonyId", "nodeId", "templateId", "engine", "rewardEligible",
  ]);
  if (identity === null || identity.kind !== "poi" ||
    typeof identity.originColonyId !== "string" || identity.originColonyId.length === 0 ||
    typeof identity.nodeId !== "string" || identity.nodeId.length === 0 ||
    typeof identity.templateId !== "string" || identity.templateId.length === 0 ||
    (identity.engine !== "firstPerson" && identity.engine !== "boarding" && identity.engine !== "groundRun") ||
    typeof identity.rewardEligible !== "boolean") return null;
  try { structuredClone(value); }
  catch { return null; }
  return {
    kind: "poi",
    originColonyId: identity.originColonyId,
    nodeId: identity.nodeId,
    templateId: identity.templateId,
    engine: identity.engine,
    rewardEligible: identity.rewardEligible,
  };
}

function snapshotPreparedBinding(value: unknown): GalaxyPoiPreparedBinding | null {
  const binding = ownData(value, ["launchId", "outcomeId", "preparedRevision"]);
  if (binding === null || typeof binding.launchId !== "string" || binding.launchId.length === 0 ||
    binding.outcomeId !== `${binding.launchId}:success` ||
    !Number.isSafeInteger(binding.preparedRevision) || (binding.preparedRevision as number) < 0) return null;
  try { structuredClone(value); }
  catch { return null; }
  return {
    launchId: binding.launchId,
    outcomeId: binding.outcomeId as string,
    preparedRevision: binding.preparedRevision as number,
  };
}

function snapshotPreparedFactHeader(value: unknown): { id: string; kind: string } | null {
  const fact = requiredOwnData(value, ["id", "kind"]);
  return fact !== null && typeof fact.id === "string" && typeof fact.kind === "string"
    ? { id: fact.id, kind: fact.kind }
    : null;
}

type ReservedFactSignal = "reserved" | "other" | "invalid";

function reservedFactSignal(value: unknown): ReservedFactSignal {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return "other";
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return "invalid";
    const idDescriptor = Object.getOwnPropertyDescriptor(value, "id");
    const kindDescriptor = Object.getOwnPropertyDescriptor(value, "kind");
    const id = idDescriptor !== undefined && "value" in idDescriptor ? idDescriptor.value : undefined;
    const kind = kindDescriptor !== undefined && "value" in kindDescriptor ? kindDescriptor.value : undefined;
    if (kind === "poi_completion_prepared" || (typeof id === "string" &&
      (id.startsWith("history:poi-prepared:") || id.startsWith("history:poi-prepared-v2:")))) return "reserved";
    if ((idDescriptor !== undefined && !("value" in idDescriptor)) ||
      (kindDescriptor !== undefined && !("value" in kindDescriptor))) return "invalid";
    return "other";
  } catch {
    return "invalid";
  }
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

export function isGalaxyPoiPreparedAuthorityFact(value: unknown): boolean {
  try {
    const fact = snapshotPreparedFactHeader(value);
    return fact !== null && (fact.kind === "poi_completion_prepared" ||
      fact.id.startsWith("history:poi-prepared:") || fact.id.startsWith("history:poi-prepared-v2:"));
  } catch {
    return false;
  }
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
  try {
    const safeIdentity = snapshotPoiIdentity(identity);
    const safeBinding = snapshotPreparedBinding(binding);
    if (safeIdentity === null || safeBinding === null) return null;
    const tuple = preparedTuple(safeIdentity, safeBinding);
    const validated = mergeProjectionIntoGalaxy(submittedRun, {});
    if (tuple === null || !validated.ok || !canonicalIdentity(validated.galaxyRun, safeIdentity) ||
      validated.galaxyRun.historyFacts.some(isGalaxyPoiPreparedAuthorityFact)) return null;
    return {
      id: preparedFactId(tuple),
      kind: "poi_completion_prepared",
      subjectId: safeIdentity.nodeId,
      cycle: validated.galaxyRun.worldCycle,
      causeFactIds: [],
    };
  } catch {
    return null;
  }
}

export function recoverGalaxyPoiPreparation(
  submittedRun: GalaxyRunState,
): RecoveredGalaxyPoiPreparation | null {
  try {
    const validated = mergeProjectionIntoGalaxy(submittedRun, {});
    if (!validated.ok) return null;
    const reserved = validated.galaxyRun.historyFacts.filter(isGalaxyPoiPreparedAuthorityFact);
    if (reserved.length !== 1) return null;
    const recovered = decodePreparedFact(reserved[0]);
    return recovered !== null && recovered.cycle === validated.galaxyRun.worldCycle &&
      canonicalIdentity(validated.galaxyRun, recovered.identity)
      ? recovered
      : null;
  } catch {
    return null;
  }
}

export type GalaxyPoiPreparedAuthorityInspection =
  | { status: "none" }
  | { status: "valid"; preparation: RecoveredGalaxyPoiPreparation }
  | { status: "invalid"; quarantinedCount: number };

/** Inspect raw reserved facts before Galaxy migration can normalize or deduplicate them. */
export function inspectGalaxyPoiPreparedAuthority(
  submittedRun: unknown,
): GalaxyPoiPreparedAuthorityInspection {
  try {
    const run = requiredOwnData(submittedRun, ["historyFacts"]);
    const facts = run === null ? null : denseTuple(run.historyFacts);
    if (facts === null) return { status: "invalid", quarantinedCount: 1 };
    let reservedCount = 0;
    let opaqueCount = 0;
    for (const fact of facts) {
      const signal = reservedFactSignal(fact);
      if (signal === "reserved") reservedCount += 1;
      else if (signal === "invalid") opaqueCount += 1;
    }
    if (opaqueCount > 0) {
      return { status: "invalid", quarantinedCount: Math.max(1, reservedCount + opaqueCount) };
    }
    if (reservedCount === 0) return { status: "none" };
    if (reservedCount !== 1) return { status: "invalid", quarantinedCount: reservedCount };
    const preparation = recoverGalaxyPoiPreparation(submittedRun as GalaxyRunState);
    return preparation === null
      ? { status: "invalid", quarantinedCount: 1 }
      : { status: "valid", preparation };
  } catch {
    return { status: "invalid", quarantinedCount: 1 };
  }
}

export function resolveGalaxyPoiOutcomeFromRun(
  submittedRun: GalaxyRunState,
  identity: PoiIdentity,
  binding: GalaxyPoiPreparedBinding,
  destinationColonyId: ColonyId | null,
): GalaxyPoiAuthorityResult {
  try {
    const safeIdentity = snapshotPoiIdentity(identity);
    const safeBinding = snapshotPreparedBinding(binding);
    if (safeIdentity === null || safeBinding === null || (destinationColonyId !== null &&
      (typeof destinationColonyId !== "string" || destinationColonyId.length === 0))) return { ok: false };
    const validated = mergeProjectionIntoGalaxy(submittedRun, {});
    if (!validated.ok || getGalaxyRunAvailability(validated.galaxyRun).status !== "available") return { ok: false };
    const recovered = recoverGalaxyPoiPreparation(validated.galaxyRun);
    if (recovered === null || recovered.launchId !== safeBinding.launchId ||
      recovered.outcomeId !== safeBinding.outcomeId || recovered.preparedRevision !== safeBinding.preparedRevision ||
      recovered.identity.originColonyId !== safeIdentity.originColonyId ||
      recovered.identity.nodeId !== safeIdentity.nodeId || recovered.identity.templateId !== safeIdentity.templateId ||
      recovered.identity.engine !== safeIdentity.engine ||
      recovered.identity.rewardEligible !== safeIdentity.rewardEligible) return { ok: false };
    const advanced = advanceGalaxyWorldCycles(validated.galaxyRun, 1);
    if (!advanced.ok) return { ok: false };
    const projection = projectGalaxyRunToLegacyState(advanced.galaxyRun);
    let resolvedSave: SaveData = projection;
    let delivery: MissionDelivery | null = null;
    if (safeIdentity.rewardEligible) {
      if (destinationColonyId === null) return { ok: false };
      const resolved = confirmPoiOutcome(projection, {
        originColonyId: safeIdentity.originColonyId,
        nodeId: safeIdentity.nodeId,
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
  } catch {
    return { ok: false };
  }
}

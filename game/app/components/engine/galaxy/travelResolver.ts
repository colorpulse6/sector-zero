import type { SaveData } from "../types";
import {
  materializeCell,
  observeFact,
  recordNegativeSurvey,
  resolveCell,
  visitFact,
} from "./atlas";
import {
  cellKey,
  sameCoordinate,
  validateCoordinate,
} from "./coordinates";
import { advanceGalaxyWorldCycles } from "./galaxyProjection";
import type {
  AtlasCellFact,
  AtlasKnowledgeRecord,
  GalaxyCoordinate,
  GalaxyRunState,
  RouteLeg,
  TravelCommitment,
} from "./galaxyTypes";
import { planRoute, type RoutePlan } from "./routePlanner";

export type TravelInterruptionResult = "cleared" | "failed" | "retreated";

export type TravelNextAction =
  | { kind: "resolve" }
  | { kind: "launch"; operationId: "op:hostile-picket" }
  | { kind: "retreat" }
  | { kind: "emergency_retreat" }
  | { kind: "return" };

export type TravelErrorCode =
  | "missing_galaxy_run"
  | "unsafe_input"
  | "stale_plan"
  | "active_travel_exists"
  | "malformed_travel"
  | "invalid_travel_state"
  | "invalid_interruption"
  | "cycle_advance_failed"
  | "arrival_conflict"
  | "generation_unavailable";

export interface TravelError {
  code: TravelErrorCode;
  message: string;
}

export interface TravelTransitionSuccess {
  ok: true;
  changed: boolean;
  galaxyRun: GalaxyRunState;
  save?: SaveData;
  nextActions: TravelNextAction[];
}

export interface TravelTransitionFailure {
  ok: false;
  changed: false;
  errors: TravelError[];
  nextActions: TravelNextAction[];
}

export type TravelTransitionResult =
  | TravelTransitionSuccess
  | TravelTransitionFailure;

type TravelInput = SaveData | GalaxyRunState;

interface TravelContext {
  input: TravelInput;
  parent: SaveData | null;
  run: GalaxyRunState;
}

const TRAVEL_STATES: readonly TravelCommitment["state"][] = [
  "committed",
  "advancing",
  "interrupted",
  "arrived",
  "diverted",
  "resolved",
];
const CELL_KINDS: readonly AtlasCellFact["kind"][] = [
  "empty",
  "stellar_contact",
  "hazard",
  "ruin",
  "anomaly",
  "signal",
];

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function cloneCoordinate(coordinate: GalaxyCoordinate): GalaxyCoordinate {
  return {
    sectorX: coordinate.sectorX,
    sectorY: coordinate.sectorY,
    localX: coordinate.localX,
    localY: coordinate.localY,
  };
}

function inspectPlainData(
  value: unknown,
  ancestors = new WeakSet<object>(),
): boolean {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    value === undefined
  ) {
    return true;
  }
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || ancestors.has(value)) return false;

  const prototype = Object.getPrototypeOf(value);
  if (Array.isArray(value)) {
    if (prototype !== Array.prototype) return false;
    for (let index = 0; index < value.length; index += 1) {
      if (!hasOwn(value, index)) return false;
    }
  } else if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }

  ancestors.add(value);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") {
      ancestors.delete(value);
      return false;
    }
    if (Array.isArray(value) && key === "length") continue;
    if (Array.isArray(value) && !/^(0|[1-9]\d*)$/.test(key)) {
      ancestors.delete(value);
      return false;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor)) {
      ancestors.delete(value);
      return false;
    }
    if (!inspectPlainData(descriptor.value, ancestors)) {
      ancestors.delete(value);
      return false;
    }
  }
  ancestors.delete(value);
  return true;
}

function sameData(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (
    typeof left !== "object" || left === null ||
    typeof right !== "object" || right === null
  ) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }
    return left.every((entry, index) => sameData(entry, right[index]));
  }
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every(
    (key) => hasOwn(right, key) && sameData(
      (left as Record<string, unknown>)[key],
      (right as Record<string, unknown>)[key],
    ),
  );
}

function isSaveData(input: TravelInput): input is SaveData {
  return hasOwn(input, "galaxyRun") && hasOwn(input, "activeExperience");
}

function failure(
  code: TravelErrorCode,
  message: string,
  nextActions: TravelNextAction[] = [],
): TravelTransitionFailure {
  return {
    ok: false,
    changed: false,
    errors: [{ code, message }],
    nextActions,
  };
}

function contextFor(input: TravelInput): TravelContext | TravelTransitionFailure {
  if (!isRecord(input)) {
    return failure("unsafe_input", "Travel state must be a plain saved value.");
  }
  if (isSaveData(input)) {
    if (input.galaxyRun === null) {
      return failure("missing_galaxy_run", "Cannot resolve travel without a galaxy run.");
    }
    if (!inspectPlainData(input.galaxyRun)) {
      return failure("unsafe_input", "Galaxy travel state contains unsafe data.");
    }
    return { input, parent: input, run: input.galaxyRun };
  }
  if (!inspectPlainData(input)) {
    return failure("unsafe_input", "Galaxy travel state contains unsafe data.");
  }
  return { input, parent: null, run: input as GalaxyRunState };
}

function success(
  context: TravelContext,
  run: GalaxyRunState,
  changed: boolean,
  nextActions = actionsFor(run),
): TravelTransitionSuccess {
  if (!changed) {
    return context.parent === null
      ? { ok: true, changed: false, galaxyRun: context.run, nextActions }
      : {
          ok: true,
          changed: false,
          galaxyRun: context.run,
          save: context.parent,
          nextActions,
        };
  }
  if (context.parent === null) {
    return { ok: true, changed: true, galaxyRun: run, nextActions };
  }
  return {
    ok: true,
    changed: true,
    galaxyRun: run,
    save: { ...context.parent, galaxyRun: run },
    nextActions,
  };
}

function actionsFor(run: GalaxyRunState): TravelNextAction[] {
  const travel = run.activeTravel;
  if (travel === null) return [];
  switch (travel.state) {
    case "committed":
    case "advancing":
      return [{ kind: "resolve" }];
    case "interrupted":
      return travel.interruptionOperationId === "op:hostile-picket"
        ? [
            { kind: "launch", operationId: "op:hostile-picket" },
            { kind: "retreat" },
          ]
        : [];
    case "arrived":
    case "resolved":
      return [{ kind: "return" }];
    case "diverted":
      return [{ kind: "emergency_retreat" }];
  }
}

function operationForCause(causeFactId: string | null): "op:hostile-picket" | null {
  return causeFactId === "fact:picket-patrol-active"
    ? "op:hostile-picket"
    : null;
}

function isRouteLeg(value: unknown): value is RouteLeg {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    validateCoordinate(value.from).ok &&
    validateCoordinate(value.to).ok &&
    Number.isSafeInteger(value.distanceUnits) &&
    (value.distanceUnits as number) >= 0 &&
    Number.isSafeInteger(value.cycles) &&
    (value.cycles as number) >= 0 &&
    Number.isSafeInteger(value.supplyCost) &&
    (value.supplyCost as number) >= 0 &&
    (value.interruptionCauseId === null ||
      value.interruptionCauseId === "fact:picket-patrol-active")
  );
}

function validCheckpointSet(travel: TravelCommitment): boolean {
  if (
    !Array.isArray(travel.appliedCheckpointIds) ||
    new Set(travel.appliedCheckpointIds).size !== travel.appliedCheckpointIds.length
  ) return false;

  const expectedLegs = new Set<string>();
  for (let index = 0; index < travel.nextLegIndex; index += 1) {
    expectedLegs.add(`${travel.transactionId}:leg:${index}`);
  }
  const legPrefix = `${travel.transactionId}:leg:`;
  const interruptionPrefix = `${travel.transactionId}:interruption:`;
  const emergencyId = `${travel.transactionId}:emergency-retreat`;
  let interruptionResult: TravelInterruptionResult | null = null;
  let hasEmergency = false;

  for (const checkpointId of travel.appliedCheckpointIds) {
    if (typeof checkpointId !== "string" || checkpointId.length === 0) return false;
    if (checkpointId.startsWith(legPrefix)) {
      if (!expectedLegs.has(checkpointId)) return false;
      continue;
    }
    if (checkpointId.startsWith(interruptionPrefix)) {
      const result = checkpointId.slice(interruptionPrefix.length);
      if (
        result !== "cleared" && result !== "failed" && result !== "retreated"
      ) return false;
      if (interruptionResult !== null) return false;
      interruptionResult = result;
      continue;
    }
    if (checkpointId === emergencyId) {
      if (hasEmergency) return false;
      hasEmergency = true;
      continue;
    }
    // Earlier/future migrated journals may contain additional non-leg markers.
    // They are opaque history: only this resolver's namespaced IDs have effects.
  }

  for (const checkpointId of expectedLegs) {
    if (!travel.appliedCheckpointIds.includes(checkpointId)) return false;
  }
  if (hasEmergency && interruptionResult !== "failed") return false;
  return true;
}

function contactAtCoordinate(run: GalaxyRunState, coordinate: GalaxyCoordinate): string | null {
  const key = cellKey(coordinate);
  const contacts = Object.keys(run.atlas.materializedFacts)
    .filter((dictionaryKey) => hasOwn(run.atlas.materializedFacts, dictionaryKey))
    .map((dictionaryKey) => run.atlas.materializedFacts[dictionaryKey])
    .filter(
      (fact) =>
        fact !== undefined &&
        fact.cellKey === key &&
        fact.contactId !== null,
    )
    .map((fact) => fact.contactId as string);
  return contacts.length === 1 ? contacts[0] : null;
}

function validateTravel(run: GalaxyRunState): TravelError | null {
  const travel = run.activeTravel;
  if (travel === null) return null;
  if (!isRecord(travel) || !TRAVEL_STATES.includes(travel.state)) {
    return { code: "malformed_travel", message: "Active travel has an invalid state." };
  }
  if (
    travel.transactionId.length === 0 ||
    travel.routePlanId.length === 0 ||
    !validateCoordinate(travel.origin).ok ||
    !validateCoordinate(travel.destination).ok ||
    !Array.isArray(travel.legs) ||
    travel.legs.length === 0 ||
    !Number.isSafeInteger(travel.nextLegIndex) ||
    travel.nextLegIndex < 0 ||
    travel.nextLegIndex > travel.legs.length ||
    !Number.isSafeInteger(travel.supplyCost) ||
    travel.supplyCost < 0 ||
    !Number.isSafeInteger(travel.elapsedCycles) ||
    travel.elapsedCycles < 0 ||
    (travel.targetId !== null && typeof travel.targetId !== "string")
  ) {
    return { code: "malformed_travel", message: "Active travel identity or progress is malformed." };
  }
  if (!travel.legs.every(isRouteLeg)) {
    return { code: "malformed_travel", message: "Active travel contains an invalid route leg." };
  }
  if (!sameCoordinate(travel.legs[0].from, travel.origin)) {
    return { code: "malformed_travel", message: "Active travel does not begin at its saved origin." };
  }
  if (!sameCoordinate(travel.legs[travel.legs.length - 1].to, travel.destination)) {
    return { code: "malformed_travel", message: "Active travel does not end at its saved destination." };
  }

  let supplyCost = 0;
  let elapsedCycles = 0;
  const legIds = new Set<string>();
  for (let index = 0; index < travel.legs.length; index += 1) {
    const leg = travel.legs[index];
    if (legIds.has(leg.id)) {
      return { code: "malformed_travel", message: "Active travel route leg IDs are not unique." };
    }
    legIds.add(leg.id);
    supplyCost += leg.supplyCost;
    if (index < travel.nextLegIndex) elapsedCycles += leg.cycles;
    if (index > 0 && !sameCoordinate(travel.legs[index - 1].to, leg.from)) {
      return { code: "malformed_travel", message: "Active travel route legs are discontinuous." };
    }
  }
  if (
    !Number.isSafeInteger(supplyCost) ||
    !Number.isSafeInteger(elapsedCycles) ||
    supplyCost !== travel.supplyCost ||
    elapsedCycles !== travel.elapsedCycles ||
    !validCheckpointSet(travel)
  ) {
    return { code: "malformed_travel", message: "Active travel cost, time, or checkpoints are incoherent." };
  }

  const progressCoordinate = travel.nextLegIndex === 0
    ? travel.origin
    : travel.legs[travel.nextLegIndex - 1].to;
  const checkpoint = (result: TravelInterruptionResult) =>
    travel.appliedCheckpointIds.includes(
      `${travel.transactionId}:interruption:${result}`,
    );
  if (travel.state === "committed" || travel.state === "advancing") {
    if (
      run.vessel.status !== "in_transit" ||
      run.vessel.transitTransactionId !== travel.transactionId ||
      !sameCoordinate(run.vessel.coordinate, progressCoordinate)
    ) return { code: "malformed_travel", message: "In-transit vessel and route progress disagree." };
  } else if (travel.state === "interrupted") {
    if (
      run.vessel.status !== "in_transit" ||
      run.vessel.transitTransactionId !== travel.transactionId ||
      !sameCoordinate(run.vessel.coordinate, progressCoordinate)
    ) return { code: "malformed_travel", message: "Interrupted travel lacks its saved active cause." };
  } else if (travel.state === "arrived") {
    const finalLeg = travel.legs[travel.legs.length - 1];
    if (
      travel.nextLegIndex !== travel.legs.length ||
      (finalLeg.interruptionCauseId !== null && !checkpoint("cleared")) ||
      run.vessel.status !== "stationary" ||
      run.vessel.transitTransactionId !== null ||
      !sameCoordinate(run.vessel.coordinate, travel.destination)
    ) return { code: "malformed_travel", message: "Arrived travel and vessel destination disagree." };
  } else if (travel.state === "diverted") {
    if (
      run.vessel.status !== "stranded" ||
      run.vessel.transitTransactionId !== travel.transactionId ||
      !sameCoordinate(run.vessel.coordinate, progressCoordinate)
    ) return { code: "malformed_travel", message: "Diverted travel is not stranded at its saved cause." };
  } else {
    const resolvedAtOrigin = sameCoordinate(run.vessel.coordinate, travel.origin);
    const resolvedAtDestination =
      travel.nextLegIndex === travel.legs.length &&
      sameCoordinate(run.vessel.coordinate, travel.destination);
    if (
      run.vessel.status !== "stationary" ||
      run.vessel.transitTransactionId !== null ||
      (!resolvedAtOrigin && !resolvedAtDestination)
    ) return { code: "malformed_travel", message: "Resolved travel lacks a valid closure checkpoint." };
  }
  return null;
}

function commitmentMatchesPlan(
  travel: TravelCommitment,
  plan: RoutePlan,
): boolean {
  return (
    travel.routePlanId === plan.id &&
    sameData(travel.origin, plan.origin) &&
    sameData(travel.destination, plan.destination) &&
    travel.targetId === plan.targetId &&
    sameData(travel.legs, plan.legs) &&
    travel.supplyCost === plan.supplyCost
  );
}

function cellFactIsCoherent(fact: AtlasCellFact, expectedCellKey: string): boolean {
  return (
    typeof fact.id === "string" &&
    fact.id.length > 0 &&
    fact.cellKey === expectedCellKey &&
    validateCoordinate(fact.coordinate).ok &&
    cellKey(fact.coordinate) === expectedCellKey &&
    CELL_KINDS.includes(fact.kind) &&
    (fact.contactId === null || typeof fact.contactId === "string") &&
    Number.isSafeInteger(fact.stableSeed) &&
    fact.stableSeed >= 0 &&
    typeof fact.authored === "boolean"
  );
}

function savedFactAtCell(
  run: GalaxyRunState,
  key: string,
): AtlasCellFact | null | TravelError {
  const matches: AtlasCellFact[] = [];
  for (const dictionaryKey of Object.keys(run.atlas.materializedFacts)) {
    if (!hasOwn(run.atlas.materializedFacts, dictionaryKey)) continue;
    const fact = run.atlas.materializedFacts[dictionaryKey];
    if (!isRecord(fact) || fact.cellKey !== key) continue;
    if (
      dictionaryKey !== fact.cellKey ||
      !cellFactIsCoherent(fact as unknown as AtlasCellFact, key)
    ) return { code: "arrival_conflict", message: "Saved Atlas fact identity conflicts with its fixed cell." };
    matches.push(fact as unknown as AtlasCellFact);
  }
  if (matches.length === 0) return null;
  const distinctIds = new Set(matches.map((fact) => fact.id));
  if (matches.length !== 1 || distinctIds.size !== 1) {
    return { code: "arrival_conflict", message: "More than one saved fact claims the arrival cell." };
  }
  return matches[0];
}

function directVisitRecord(fact: AtlasCellFact, cycle: number): AtlasKnowledgeRecord {
  return {
    id: `knowledge:direct-visit:${JSON.stringify([fact.cellKey, fact.id])}`,
    subjectId: fact.id,
    state: fact.kind === "signal" ? "signal" : "visited",
    observedProperties: {
      kind: fact.kind,
      cellKey: fact.cellKey,
      sectorX: fact.coordinate.sectorX,
      sectorY: fact.coordinate.sectorY,
      localX: fact.coordinate.localX,
      localY: fact.coordinate.localY,
    },
    confidence: "high",
    source: "direct_visit",
    observedCycle: cycle,
    expiresCycle: null,
  };
}

function materializeArrival(
  run: GalaxyRunState,
  travel: TravelCommitment,
): GalaxyRunState | TravelError {
  const key = cellKey(travel.destination);
  const saved = savedFactAtCell(run, key);
  if (saved !== null && "code" in saved) return saved;
  const regenerated = resolveCell(run.identity, travel.destination);
  if (!regenerated.ok) {
    return {
      code: "generation_unavailable",
      message: `Arrival generation is unavailable: ${regenerated.reason}.`,
    };
  }
  const fact = materializeCell(saved, regenerated.fact);
  if (!cellFactIsCoherent(fact, key)) {
    return { code: "arrival_conflict", message: "Arrival fact is not stable for its fixed cell." };
  }

  const record = directVisitRecord(fact, run.worldCycle);
  let atlas = run.atlas;
  if (fact.kind === "empty") {
    atlas = recordNegativeSurvey(atlas, {
      fact: fact as AtlasCellFact & { kind: "empty"; contactId: null },
      source: "direct_visit",
      confidence: "high",
      observedCycle: run.worldCycle,
    });
    const recordId = `knowledge:negative-survey:${JSON.stringify([fact.cellKey, fact.id])}`;
    const negative = atlas.knowledge[recordId];
    if (negative !== undefined) {
      atlas = clone(atlas);
      atlas.knowledge[recordId] = {
        ...negative,
        observedProperties: {
          ...negative.observedProperties,
          kind: fact.kind,
        },
      };
    }
  } else if (fact.kind === "signal") {
    atlas = observeFact(atlas, { fact, record });
  } else {
    atlas = visitFact(atlas, { fact, record });
  }

  if (!hasOwn(atlas.materializedFacts, key)) {
    return { code: "arrival_conflict", message: "Arrival did not persist its materialized fact." };
  }
  const hasKnowledge = Object.keys(atlas.knowledge).some(
    (recordId) =>
      hasOwn(atlas.knowledge, recordId) &&
      atlas.knowledge[recordId].subjectId === fact.id &&
      atlas.knowledge[recordId].source === "direct_visit",
  );
  if (!hasKnowledge) {
    return { code: "arrival_conflict", message: "Arrival did not persist direct knowledge." };
  }
  if (!atlas.mappedCellKeys.includes(key)) {
    atlas = clone(atlas);
    atlas.mappedCellKeys.push(key);
  }

  return {
    ...run,
    atlas,
    vessel: {
      status: "stationary",
      coordinate: cloneCoordinate(travel.destination),
      contactId: travel.targetId ?? fact.contactId,
      transitTransactionId: null,
    },
    activeTravel: {
      ...travel,
      state: "arrived",
      interruptionOperationId: null,
    },
  };
}

function advanceOneRun(run: GalaxyRunState): TravelTransitionResult {
  const problem = validateTravel(run);
  if (problem !== null) return failure(problem.code, problem.message, actionsFor(run));
  const travel = run.activeTravel;
  if (travel === null) {
    return {
      ok: true,
      changed: false,
      galaxyRun: run,
      nextActions: [],
    };
  }
  if (travel.state !== "committed" && travel.state !== "advancing") {
    return {
      ok: true,
      changed: false,
      galaxyRun: run,
      nextActions: actionsFor(run),
    };
  }
  if (travel.nextLegIndex >= travel.legs.length) {
    const arrived = materializeArrival(run, travel);
    return "code" in arrived
      ? failure(arrived.code, arrived.message, actionsFor(run))
      : {
          ok: true,
          changed: true,
          galaxyRun: arrived,
          nextActions: actionsFor(arrived),
        };
  }

  const index = travel.nextLegIndex;
  const checkpointId = `${travel.transactionId}:leg:${index}`;
  if (travel.appliedCheckpointIds.includes(checkpointId)) {
    return failure(
      "malformed_travel",
      "Travel checkpoint was journaled without matching saved progress.",
      actionsFor(run),
    );
  }
  const leg = travel.legs[index];
  const operationId = operationForCause(leg.interruptionCauseId);
  if (leg.interruptionCauseId !== null && operationId === null) {
    return failure(
      "invalid_interruption",
      "Travel leg references an unsupported interruption cause.",
      actionsFor(run),
    );
  }

  const advanced = advanceGalaxyWorldCycles(run, leg.cycles);
  if (!advanced.ok) {
    return failure(
      "cycle_advance_failed",
      advanced.errors.map((entry) => entry.message).join("; "),
      actionsFor(run),
    );
  }
  const advancedRun = advanced.galaxyRun;
  const current = advancedRun.activeTravel;
  if (current === null || current.transactionId !== travel.transactionId) {
    return failure(
      "malformed_travel",
      "Cycle advancement did not preserve the active travel journal.",
      actionsFor(run),
    );
  }
  const nextTravel: TravelCommitment = {
    ...current,
    state: "advancing",
    nextLegIndex: index + 1,
    elapsedCycles: current.elapsedCycles + leg.cycles,
    appliedCheckpointIds: [...current.appliedCheckpointIds, checkpointId],
    interruptionOperationId: null,
  };
  let nextRun: GalaxyRunState = {
    ...advancedRun,
    activeTravel: nextTravel,
    vessel: {
      status: "in_transit",
      coordinate: cloneCoordinate(leg.to),
      contactId: null,
      transitTransactionId: travel.transactionId,
    },
  };

  if (operationId !== null) {
    nextRun = {
      ...nextRun,
      activeTravel: {
        ...nextTravel,
        state: "interrupted",
        interruptionOperationId: operationId,
      },
    };
    return {
      ok: true,
      changed: true,
      galaxyRun: nextRun,
      nextActions: actionsFor(nextRun),
    };
  }
  if (nextTravel.nextLegIndex === nextTravel.legs.length) {
    const arrived = materializeArrival(nextRun, nextTravel);
    return "code" in arrived
      ? failure(arrived.code, arrived.message, actionsFor(run))
      : {
          ok: true,
          changed: true,
          galaxyRun: arrived,
          nextActions: actionsFor(arrived),
        };
  }
  return {
    ok: true,
    changed: true,
    galaxyRun: nextRun,
    nextActions: actionsFor(nextRun),
  };
}

/**
 * Revalidate and atomically journal a displayed plan. Submitted leg, cost, policy,
 * identity, and cycle data are never authority: the fresh planner result must match.
 */
function commitTravelImpl(
  input: TravelInput,
  submittedPlan: RoutePlan,
): TravelTransitionResult {
  const context = contextFor(input);
  if (!("run" in context)) return context;
  if (!inspectPlainData(submittedPlan) || !isRecord(submittedPlan)) {
    return failure("unsafe_input", "Submitted route plan contains unsafe data.");
  }

  const existing = context.run.activeTravel;
  if (existing !== null) {
    const problem = validateTravel(context.run);
    if (problem !== null) return failure(problem.code, problem.message, actionsFor(context.run));
    if (commitmentMatchesPlan(existing, submittedPlan)) {
      return success(context, context.run, false);
    }
    return failure(
      "active_travel_exists",
      "A different travel commitment is already active.",
      actionsFor(context.run),
    );
  }

  const target = submittedPlan.target;
  const policy = submittedPlan.policy;
  const authoritative = planRoute(context.run, target, policy);
  if (!authoritative.ok || !sameData(authoritative.plan, submittedPlan)) {
    return failure(
      "stale_plan",
      authoritative.ok
        ? "The displayed route plan no longer matches authoritative state."
        : authoritative.reasons.join("; "),
    );
  }
  const ordinal = context.run.nextTransactionOrdinal;
  if (!Number.isSafeInteger(ordinal) || ordinal < 1) {
    return failure("unsafe_input", "Travel transaction ordinal is invalid.");
  }
  const transactionId = `travel:${authoritative.plan.id}:${ordinal}`;
  const next = clone(context.run);
  next.resources.supply -= authoritative.plan.supplyCost;
  next.nextTransactionOrdinal += 1;
  next.activeTravel = {
    transactionId,
    state: "committed",
    routePlanId: authoritative.plan.id,
    origin: cloneCoordinate(authoritative.plan.origin),
    destination: cloneCoordinate(authoritative.plan.destination),
    targetId: authoritative.plan.targetId,
    legs: clone(authoritative.plan.legs),
    nextLegIndex: 0,
    appliedCheckpointIds: [],
    supplyCost: authoritative.plan.supplyCost,
    elapsedCycles: 0,
    interruptionOperationId: null,
  };
  next.vessel = {
    status: "in_transit",
    coordinate: cloneCoordinate(authoritative.plan.origin),
    contactId: null,
    transitTransactionId: transactionId,
  };
  return success(context, next, true);
}

/** Apply exactly one missing route-leg checkpoint. */
function advanceTravelCheckpointImpl(input: TravelInput): TravelTransitionResult {
  const context = contextFor(input);
  if (!("run" in context)) return context;
  const result = advanceOneRun(context.run);
  if (!result.ok) return result;
  return success(context, result.galaxyRun, result.changed, result.nextActions);
}

/** Advance committed legs until arrival or an authored interruption boundary. */
function resumeTravelToBoundaryImpl(input: TravelInput): TravelTransitionResult {
  const context = contextFor(input);
  if (!("run" in context)) return context;
  const initialProblem = validateTravel(context.run);
  if (initialProblem !== null) {
    return failure(initialProblem.code, initialProblem.message, actionsFor(context.run));
  }
  if (context.run.activeTravel === null) return success(context, context.run, false, []);
  if (
    context.run.activeTravel.state !== "committed" &&
    context.run.activeTravel.state !== "advancing"
  ) return success(context, context.run, false);

  let current = context.run;
  let changed = false;
  while (
    current.activeTravel !== null &&
    (current.activeTravel.state === "committed" || current.activeTravel.state === "advancing")
  ) {
    const step = advanceOneRun(current);
    if (!step.ok) return step;
    if (!step.changed) break;
    changed = true;
    current = step.galaxyRun;
  }
  return success(context, current, changed, actionsFor(current));
}

function resolveTravelInterruptionImpl(
  input: TravelInput,
  operationId: string,
  result: TravelInterruptionResult,
): TravelTransitionResult {
  const context = contextFor(input);
  if (!("run" in context)) return context;
  const problem = validateTravel(context.run);
  if (problem !== null) return failure(problem.code, problem.message, actionsFor(context.run));
  const travel = context.run.activeTravel;
  if (travel === null) {
    return failure("invalid_travel_state", "There is no travel interruption to resolve.");
  }
  if (result !== "cleared" && result !== "failed" && result !== "retreated") {
    return failure("invalid_interruption", "Interruption outcome is not supported.", actionsFor(context.run));
  }
  const checkpointId = `${travel.transactionId}:interruption:${result}`;
  if (travel.appliedCheckpointIds.includes(checkpointId)) {
    return success(context, context.run, false);
  }
  if (
    travel.state !== "interrupted" ||
    operationId !== "op:hostile-picket" ||
    travel.interruptionOperationId !== operationId ||
    travel.nextLegIndex === 0 ||
    operationForCause(
      travel.legs[travel.nextLegIndex - 1].interruptionCauseId,
    ) !== operationId
  ) {
    return failure(
      "invalid_interruption",
      "Only the saved active interruption operation may resolve this travel.",
      actionsFor(context.run),
    );
  }

  const nextTravel: TravelCommitment = {
    ...clone(travel),
    appliedCheckpointIds: [...travel.appliedCheckpointIds, checkpointId],
  };
  if (result === "failed") {
    nextTravel.state = "diverted";
    const next: GalaxyRunState = {
      ...clone(context.run),
      activeTravel: nextTravel,
      vessel: {
        status: "stranded",
        coordinate: cloneCoordinate(context.run.vessel.coordinate),
        contactId: null,
        transitTransactionId: travel.transactionId,
      },
    };
    return success(context, next, true);
  }
  if (result === "retreated") {
    nextTravel.state = "resolved";
    nextTravel.interruptionOperationId = null;
    const next: GalaxyRunState = {
      ...clone(context.run),
      activeTravel: nextTravel,
      vessel: {
        status: "stationary",
        coordinate: cloneCoordinate(travel.origin),
        contactId: contactAtCoordinate(context.run, travel.origin),
        transitTransactionId: null,
      },
    };
    return success(context, next, true);
  }

  nextTravel.state = "advancing";
  nextTravel.interruptionOperationId = null;
  const resuming: GalaxyRunState = {
    ...clone(context.run),
    activeTravel: nextTravel,
  };
  if (nextTravel.nextLegIndex === nextTravel.legs.length) {
    const arrived = materializeArrival(resuming, nextTravel);
    if ("code" in arrived) {
      return failure(arrived.code, arrived.message, actionsFor(context.run));
    }
    return success(context, arrived, true);
  }

  let current = resuming;
  while (
    current.activeTravel !== null &&
    current.activeTravel.state === "advancing"
  ) {
    const step = advanceOneRun(current);
    if (!step.ok) return step;
    if (!step.changed) break;
    current = step.galaxyRun;
  }
  return success(context, current, true);
}

function emergencyRetreatImpl(input: TravelInput): TravelTransitionResult {
  const context = contextFor(input);
  if (!("run" in context)) return context;
  const problem = validateTravel(context.run);
  if (problem !== null) return failure(problem.code, problem.message, actionsFor(context.run));
  const travel = context.run.activeTravel;
  if (travel === null) {
    return failure("invalid_travel_state", "There is no stranded travel to retreat from.");
  }
  const checkpointId = `${travel.transactionId}:emergency-retreat`;
  if (travel.appliedCheckpointIds.includes(checkpointId)) {
    return success(context, context.run, false);
  }
  if (
    travel.state !== "diverted" ||
    travel.interruptionOperationId !== "op:hostile-picket" ||
    !travel.appliedCheckpointIds.includes(`${travel.transactionId}:interruption:failed`) ||
    context.run.vessel.status !== "stranded"
  ) {
    return failure(
      "invalid_travel_state",
      "Emergency retreat is available only from a failed stranded interruption.",
      actionsFor(context.run),
    );
  }

  const advanced = advanceGalaxyWorldCycles(context.run, 1);
  if (!advanced.ok) {
    return failure(
      "cycle_advance_failed",
      advanced.errors.map((entry) => entry.message).join("; "),
      actionsFor(context.run),
    );
  }
  const current = advanced.galaxyRun.activeTravel;
  if (current === null || current.transactionId !== travel.transactionId) {
    return failure("malformed_travel", "Cycle advancement lost the stranded travel journal.");
  }
  const next: GalaxyRunState = {
    ...advanced.galaxyRun,
    activeTravel: {
      ...current,
      state: "resolved",
      interruptionOperationId: null,
      appliedCheckpointIds: [...current.appliedCheckpointIds, checkpointId],
    },
    vessel: {
      status: "stationary",
      coordinate: cloneCoordinate(travel.origin),
      contactId: contactAtCoordinate(context.run, travel.origin),
      transitTransactionId: null,
    },
  };
  return success(context, next, true);
}

/**
 * Explicitly acknowledges an observable arrival/retreat journal and releases the
 * route planner. Nothing closes travel implicitly before the player can see it.
 */
function finalizeTravelImpl(input: TravelInput): TravelTransitionResult {
  const context = contextFor(input);
  if (!("run" in context)) return context;
  const problem = validateTravel(context.run);
  if (problem !== null) return failure(problem.code, problem.message, actionsFor(context.run));
  const travel = context.run.activeTravel;
  if (travel === null) return success(context, context.run, false, []);
  if (travel.state !== "arrived" && travel.state !== "resolved") {
    return failure(
      "invalid_travel_state",
      "Only an arrived or resolved travel journal can be finalized.",
      actionsFor(context.run),
    );
  }
  const next = clone(context.run);
  next.activeTravel = null;
  next.vessel.status = "stationary";
  next.vessel.transitTransactionId = null;
  return success(context, next, true, []);
}

function guardedTransition(work: () => TravelTransitionResult): TravelTransitionResult {
  try {
    return work();
  } catch {
    return failure(
      "unsafe_input",
      "Travel transition could not safely inspect or copy the submitted state.",
    );
  }
}

export function commitTravel(
  input: TravelInput,
  submittedPlan: RoutePlan,
): TravelTransitionResult {
  return guardedTransition(() => commitTravelImpl(input, submittedPlan));
}

export function advanceTravelCheckpoint(input: TravelInput): TravelTransitionResult {
  return guardedTransition(() => advanceTravelCheckpointImpl(input));
}

export function resumeTravelToBoundary(input: TravelInput): TravelTransitionResult {
  return guardedTransition(() => resumeTravelToBoundaryImpl(input));
}

export function resolveTravelInterruption(
  input: TravelInput,
  operationId: string,
  result: TravelInterruptionResult,
): TravelTransitionResult {
  return guardedTransition(() =>
    resolveTravelInterruptionImpl(input, operationId, result),
  );
}

export function emergencyRetreat(input: TravelInput): TravelTransitionResult {
  return guardedTransition(() => emergencyRetreatImpl(input));
}

export function finalizeTravel(input: TravelInput): TravelTransitionResult {
  return guardedTransition(() => finalizeTravelImpl(input));
}

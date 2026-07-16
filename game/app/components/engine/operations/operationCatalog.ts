import { SIDE_QUESTS } from "../sideQuests";
import { coord, sameCoordinate, validateCoordinate } from "../galaxy/coordinates";
import type {
  AtlasCellFact,
  AtlasKnowledgeRecord,
  GalaxyCoordinate,
  GalaxyOperationRecord,
  GalaxyRunState,
  HistoricalFact,
  TravelCommitment,
} from "../galaxy/galaxyTypes";
import type {
  Operation,
  OperationAdapterPayload,
  OperationAuthorizationResult,
  OperationAvailability,
  OperationCatalogResult,
  OperationId,
  OperationLaunchContext,
  OperationLookupResult,
  OperationModifier,
  OperationModifierEvaluation,
  OperationOutcomeDefinition,
  OperationUnavailableReason,
} from "./operationTypes";

type OperationTemplate = Omit<Operation, "availability" | "state">;
type UnknownRecord = Record<string, unknown>;

export const G0_OPERATION_IDS: readonly OperationId[] = Object.freeze([
  "op:hostile-picket",
  "op:kepler-black-box",
  "op:ashfall-sortie",
]);

const OPERATION_STATES: readonly GalaxyOperationRecord["state"][] = [
  "available",
  "accepted",
  "active",
  "complete",
  "failed",
  "expired",
];

const QUICK_DRAW = SIDE_QUESTS.find((quest) => quest.id === "q-reyes-1-1");
if (QUICK_DRAW === undefined || QUICK_DRAW.type !== "time_attack") {
  throw new Error("The G0 hostile-picket adapter requires Quick Draw (q-reyes-1-1).");
}

function outcome(overrides: Partial<OperationOutcomeDefinition>): OperationOutcomeDefinition {
  return {
    supply: 0,
    credits: 0,
    pilotXp: 0,
    storyItemIds: [],
    knowledge: [],
    accessFactIds: [],
    historyKinds: [],
    missionDelivery: null,
    travelResolution: "none",
    strandedAt: null,
    returnToOrigin: false,
    ...overrides,
  };
}

const HOSTILE_PICKET: OperationTemplate = {
  id: "op:hostile-picket",
  source: "systemic",
  location: coord(0, 0, 1280, 1024),
  contactId: "contact:hostile-picket",
  issuerId: null,
  causeFactIds: ["fact:picket-patrol-active"],
  objective: {
    kind: "intercept",
    targetId: "contact:hostile-picket",
    label: "Break the hostile picket",
  },
  modifiers: [{
    id: `modifier:${QUICK_DRAW.id}`,
    kind: "side_quest",
    optional: true,
    questId: QUICK_DRAW.id,
    name: QUICK_DRAW.name,
    description: QUICK_DRAW.description,
    offeredBy: QUICK_DRAW.offeredBy,
    condition: {
      kind: QUICK_DRAW.type,
      metric: "frameCount",
      comparison: "at_most",
      value: QUICK_DRAW.conditionValue,
      unit: "frames",
    },
    reward: { credits: QUICK_DRAW.reward },
  }],
  phases: [{
    id: "phase:hostile-picket:interception",
    mode: "shooter",
    objective: "destroy_hostile_wave",
    adapter: { kind: "legacy_level", world: 1, level: 1 },
  }],
  knownThreat: {
    confidence: "medium",
    dimensions: {
      military: "high",
      political: "low",
      environmental: "low",
      logistical: "moderate",
      anomalous: "low",
    },
  },
  costs: { supply: 0, worldCycles: 1 },
  rewards: {
    success: outcome({
      supply: 2,
      pilotXp: 100,
      knowledge: [{ subjectId: "contact:hostile-picket", state: "visited", confidence: "high" }],
      accessFactIds: ["access:picket-cleared"],
      historyKinds: ["hostile_picket_cleared"],
      travelResolution: "cleared",
    }),
    failure: outcome({
      historyKinds: ["hostile_picket_failed"],
      travelResolution: "failed",
      strandedAt: coord(0, 0, 1280, 1024),
    }),
    retreat: outcome({
      historyKinds: ["hostile_picket_retreated"],
      travelResolution: "retreated",
      returnToOrigin: true,
    }),
  },
};

const KEPLER_BLACK_BOX: OperationTemplate = {
  id: "op:kepler-black-box",
  source: "exploration",
  location: coord(0, 0, 2048, 1024),
  contactId: "contact:kepler",
  issuerId: null,
  causeFactIds: ["fact:kepler-recorder-signal"],
  objective: {
    kind: "recover",
    targetId: "kepler-black-box",
    label: "Recover the Kepler black box",
  },
  modifiers: [],
  phases: [{
    id: "phase:kepler:black-box",
    mode: "first-person",
    objective: "recover_black_box",
    adapter: { kind: "special_mission", missionId: "kepler-black-box" },
  }],
  knownThreat: {
    confidence: "medium",
    dimensions: {
      military: "low",
      political: "low",
      environmental: "moderate",
      logistical: "low",
      anomalous: "moderate",
    },
  },
  costs: { supply: 0, worldCycles: 1 },
  rewards: {
    success: outcome({
      credits: 200,
      pilotXp: 100,
      storyItemIds: ["kepler-black-box"],
      knowledge: [{ subjectId: "contact:kepler", state: "visited", confidence: "high" }],
      historyKinds: ["kepler_black_box_recovered"],
    }),
    failure: outcome({ historyKinds: ["kepler_black_box_failed"] }),
    retreat: outcome({ historyKinds: ["kepler_black_box_retreated"] }),
  },
};

const ASHFALL_SORTIE: OperationTemplate = {
  id: "op:ashfall-sortie",
  source: "story",
  location: coord(0, 0, 1024, 512),
  contactId: "contact:ashfall",
  issuerId: null,
  causeFactIds: ["fact:ashfall-distress"],
  objective: {
    kind: "sortie",
    targetId: "ashfall",
    label: "Secure the Ashfall distress zone",
  },
  modifiers: [],
  phases: [{
    id: "phase:ashfall:sortie",
    mode: "shooter",
    objective: "complete_desert_mission",
    adapter: { kind: "planet_mission", planetId: "ashfall" },
  }],
  knownThreat: {
    confidence: "high",
    dimensions: {
      military: "low",
      political: "low",
      environmental: "moderate",
      logistical: "low",
      anomalous: "low",
    },
  },
  costs: { supply: 0, worldCycles: 1 },
  rewards: {
    success: outcome({
      pilotXp: 75,
      knowledge: [{ subjectId: "contact:ashfall", state: "visited", confidence: "high" }],
      historyKinds: ["ashfall_sortie_complete"],
      missionDelivery: {
        planetId: "ashfall",
        colonyId: "galaxy:ashfall-primary",
        reason: "mission_delivery",
      },
    }),
    failure: outcome({ historyKinds: ["ashfall_sortie_failed"] }),
    retreat: outcome({ historyKinds: ["ashfall_sortie_retreated"] }),
  },
};

function templateFor(operationId: unknown): OperationTemplate | null {
  switch (operationId) {
    case "op:hostile-picket": return HOSTILE_PICKET;
    case "op:kepler-black-box": return KEPLER_BLACK_BOX;
    case "op:ashfall-sortie": return ASHFALL_SORTIE;
    default: return null;
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function dataProperty(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null || !hasOwn(value, key)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
}

function isPlainRecord(value: unknown): value is UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isDensePlainArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false;
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !("value" in descriptor)) return false;
  }
  return true;
}

function ownValues(value: unknown): unknown[] | null {
  if (!isPlainRecord(value)) return null;
  const values: unknown[] = [];
  for (const key of Object.keys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor)) return null;
    values.push(descriptor.value);
  }
  return values;
}

function validCoordinate(value: unknown): value is GalaxyCoordinate {
  if (!isPlainRecord(value)) return false;
  const coordinate = {
    sectorX: dataProperty(value, "sectorX"),
    sectorY: dataProperty(value, "sectorY"),
    localX: dataProperty(value, "localX"),
    localY: dataProperty(value, "localY"),
  };
  return validateCoordinate(coordinate).ok;
}

function validOperationRecord(value: unknown): value is GalaxyOperationRecord {
  if (!isPlainRecord(value)) return false;
  const state = dataProperty(value, "state");
  const acceptedCycle = dataProperty(value, "acceptedCycle");
  const resolvedCycle = dataProperty(value, "resolvedCycle");
  const completionIds = dataProperty(value, "completionIds");
  return (
    typeof state === "string" && OPERATION_STATES.includes(state as GalaxyOperationRecord["state"]) &&
    (acceptedCycle === null || (Number.isSafeInteger(acceptedCycle) && (acceptedCycle as number) >= 0)) &&
    (resolvedCycle === null || (Number.isSafeInteger(resolvedCycle) && (resolvedCycle as number) >= 0)) &&
    isDensePlainArray(completionIds) && completionIds.every((id) => typeof id === "string")
  );
}

function validHistoryFact(value: unknown): value is HistoricalFact {
  if (!isPlainRecord(value)) return false;
  const id = dataProperty(value, "id");
  const kind = dataProperty(value, "kind");
  const subjectId = dataProperty(value, "subjectId");
  const cycle = dataProperty(value, "cycle");
  const causes = dataProperty(value, "causeFactIds");
  return typeof id === "string" && typeof kind === "string" && typeof subjectId === "string" &&
    Number.isSafeInteger(cycle) && (cycle as number) >= 0 && isDensePlainArray(causes) &&
    causes.every((cause) => typeof cause === "string");
}

function safeRelevantState(run: unknown, operationId: OperationId): {
  run: GalaxyRunState;
  record: GalaxyOperationRecord;
  history: HistoricalFact[];
  materialized: AtlasCellFact[];
  knowledge: AtlasKnowledgeRecord[];
  activeTravel: TravelCommitment | null;
} | null {
  try {
    if (!isPlainRecord(run)) return null;
    const worldCycle = dataProperty(run, "worldCycle");
    const vessel = dataProperty(run, "vessel");
    const operations = dataProperty(run, "operations");
    const historyFacts = dataProperty(run, "historyFacts");
    const atlas = dataProperty(run, "atlas");
    const activeTravel = dataProperty(run, "activeTravel");
    if (!Number.isSafeInteger(worldCycle) || (worldCycle as number) < 0 || !isPlainRecord(vessel) ||
      !isPlainRecord(operations) || !isDensePlainArray(historyFacts) || !isPlainRecord(atlas)) return null;
    const record = dataProperty(operations, operationId);
    if (!validOperationRecord(record) || !historyFacts.every(validHistoryFact)) return null;
    const coordinate = dataProperty(vessel, "coordinate");
    const status = dataProperty(vessel, "status");
    const contactId = dataProperty(vessel, "contactId");
    const transitId = dataProperty(vessel, "transitTransactionId");
    if (!validCoordinate(coordinate) || !["stationary", "in_transit", "stranded"].includes(String(status)) ||
      !(contactId === null || typeof contactId === "string") || !(transitId === null || typeof transitId === "string")) return null;
    const materializedValues = ownValues(dataProperty(atlas, "materializedFacts"));
    const knowledgeValues = ownValues(dataProperty(atlas, "knowledge"));
    const accessFacts = dataProperty(atlas, "accessFacts");
    if (materializedValues === null || knowledgeValues === null || !isDensePlainArray(accessFacts)) return null;
    for (const fact of materializedValues) {
      if (!isPlainRecord(fact) || typeof dataProperty(fact, "id") !== "string" ||
        !(dataProperty(fact, "contactId") === null || typeof dataProperty(fact, "contactId") === "string") ||
        !["empty", "stellar_contact", "hazard", "ruin", "anomaly", "signal"].includes(String(dataProperty(fact, "kind"))) ||
        !validCoordinate(dataProperty(fact, "coordinate"))) return null;
    }
    for (const recordValue of knowledgeValues) {
      if (!isPlainRecord(recordValue) || typeof dataProperty(recordValue, "subjectId") !== "string" ||
        !["unknown", "signal", "charted", "visited", "lost_contact"].includes(String(dataProperty(recordValue, "state")))) return null;
    }
    for (const fact of accessFacts) {
      if (!isPlainRecord(fact) || typeof dataProperty(fact, "id") !== "string" ||
        typeof dataProperty(fact, "subjectId") !== "string" ||
        !["reachable", "contested", "secured", "denied", "disrupted"].includes(String(dataProperty(fact, "assessment")))) return null;
    }
    if (activeTravel !== null) {
      if (!isPlainRecord(activeTravel)) return null;
      const travelState = dataProperty(activeTravel, "state");
      const transactionId = dataProperty(activeTravel, "transactionId");
      const interruptionId = dataProperty(activeTravel, "interruptionOperationId");
      const targetId = dataProperty(activeTravel, "targetId");
      const nextLegIndex = dataProperty(activeTravel, "nextLegIndex");
      const destination = dataProperty(activeTravel, "destination");
      const legs = dataProperty(activeTravel, "legs");
      if (!["committed", "advancing", "interrupted", "arrived", "diverted", "resolved"].includes(String(travelState)) ||
        typeof transactionId !== "string" ||
        !(interruptionId === null || typeof interruptionId === "string") ||
        !(targetId === null || typeof targetId === "string") ||
        !Number.isSafeInteger(nextLegIndex) || (nextLegIndex as number) < 0 ||
        !validCoordinate(destination) || !isDensePlainArray(legs)) return null;
      for (const leg of legs) {
        if (!isPlainRecord(leg) || !validCoordinate(dataProperty(leg, "from")) ||
          !validCoordinate(dataProperty(leg, "to")) ||
          !(dataProperty(leg, "interruptionCauseId") === null ||
            typeof dataProperty(leg, "interruptionCauseId") === "string")) return null;
      }
    }
    return {
      run: run as unknown as GalaxyRunState,
      record,
      history: historyFacts,
      materialized: materializedValues as AtlasCellFact[],
      knowledge: knowledgeValues as AtlasKnowledgeRecord[],
      activeTravel: activeTravel as TravelCommitment | null,
    };
  } catch {
    return null;
  }
}

function unavailable(...reasons: OperationUnavailableReason[]): Extract<OperationAvailability, { status: "unavailable" }> {
  return { status: "unavailable", recoverable: true, reasons };
}

function stateAvailability(
  relevant: NonNullable<ReturnType<typeof safeRelevantState>>,
  template: OperationTemplate,
): OperationAvailability {
  const { run, record, history, materialized, knowledge, activeTravel } = relevant;
  const reasons: OperationUnavailableReason[] = [];
  if (record.state === "complete" || record.state === "failed" || record.state === "expired") {
    reasons.push("operation_resolved");
  } else if (record.state !== "available" && record.state !== "accepted" && record.state !== "active") {
    reasons.push("invalid_operation_state");
  }
  if (record.completionIds.length > 0 || history.some((fact) => fact.subjectId === template.id && fact.kind === "operation_complete")) {
    reasons.push("unique_history_resolved");
  }
  if (!template.causeFactIds.every((causeId) => history.some((fact) => fact.id === causeId))) {
    reasons.push("missing_cause_fact");
  }
  const causeFacts = history.filter((fact) => template.causeFactIds.includes(fact.id));
  if (
    causeFacts.length !== template.causeFactIds.length ||
    causeFacts.some((fact) => fact.subjectId !== template.contactId)
  ) {
    reasons.push("missing_cause_fact");
  }
  if (template.contactId !== null && run.atlas.accessFacts.some((fact) =>
    fact.subjectId === template.contactId && (fact.assessment === "denied" || fact.assessment === "disrupted"))) {
    reasons.push("access_denied");
  }
  if (template.id === "op:hostile-picket" && run.atlas.accessFacts.some((fact) =>
    fact.id === "access:picket-cleared" ||
    (fact.subjectId === template.contactId && fact.assessment === "secured"))) {
    reasons.push("cause_resolved");
  }

  if (template.id === "op:hostile-picket") {
    if (activeTravel === null || activeTravel.state !== "interrupted") {
      reasons.push("missing_active_interruption");
    } else if (
      activeTravel.interruptionOperationId !== template.id ||
      run.vessel.status !== "in_transit" ||
      run.vessel.transitTransactionId !== activeTravel.transactionId ||
      !sameCoordinate(run.vessel.coordinate, template.location) ||
      activeTravel.nextLegIndex < 1 ||
      activeTravel.legs[activeTravel.nextLegIndex - 1]?.interruptionCauseId !== template.causeFactIds[0]
    ) {
      reasons.push("interruption_mismatch");
    }
  } else {
    const matchingContacts = materialized.filter((fact) =>
      fact.id === template.contactId || fact.contactId === template.contactId);
    if (
      matchingContacts.length !== 1 ||
      matchingContacts[0].id !== template.contactId ||
      matchingContacts[0].contactId !== template.contactId ||
      matchingContacts[0].kind !== "stellar_contact" ||
      !sameCoordinate(matchingContacts[0].coordinate, template.location)
    ) reasons.push("missing_contact");
    const visited = knowledge.some((entry) => entry.subjectId === template.contactId && entry.state === "visited");
    if (!visited) reasons.push("contact_not_visited");
    if (run.vessel.status !== "stationary" || run.vessel.contactId !== template.contactId ||
      !sameCoordinate(run.vessel.coordinate, template.location)) reasons.push("wrong_location");
    if (activeTravel !== null) {
      const arrivedHere = activeTravel.state === "arrived" &&
        activeTravel.targetId === template.contactId &&
        sameCoordinate(activeTravel.destination, template.location);
      if (!arrivedHere) reasons.push("active_travel_conflict");
    }
  }
  return reasons.length === 0 ? { status: "available", reasons: [] } : unavailable(...new Set(reasons));
}

function operationFrom(
  template: OperationTemplate,
  state: GalaxyOperationRecord["state"],
  availability: OperationAvailability,
): Operation {
  return { ...clone(template), availability: clone(availability), state };
}

function malformedCopy(template: OperationTemplate): Operation {
  return operationFrom(template, "available", unavailable("malformed_run"));
}

export function getOperation(run: GalaxyRunState, operationId: unknown): OperationLookupResult {
  const template = templateFor(operationId);
  if (template === null) {
    return { ok: false, operation: null, availability: unavailable("unknown_operation") };
  }
  try {
    const operations = dataProperty(run, "operations");
    if (isPlainRecord(operations) && !hasOwn(operations, template.id)) {
      const availability = unavailable("missing_operation_record");
      return {
        ok: false,
        operation: operationFrom(template, "available", availability),
        availability,
      };
    }
  } catch {
    // The full safety pass below returns a malformed recoverable copy.
  }
  const relevant = safeRelevantState(run, template.id);
  if (relevant === null) {
    const operation = malformedCopy(template);
    return { ok: false, operation, availability: operation.availability as Extract<OperationAvailability, { status: "unavailable" }> };
  }
  return {
    ok: true,
    operation: operationFrom(template, relevant.record.state, stateAvailability(relevant, template)),
  };
}

export function listG0Operations(run: GalaxyRunState): OperationCatalogResult {
  const operations: Operation[] = [];
  for (const id of G0_OPERATION_IDS) {
    const result = getOperation(run, id);
    if (!result.ok) {
      const copies = G0_OPERATION_IDS.map((operationId) => {
        const template = templateFor(operationId)!;
        return operationId === id && result.operation !== null
          ? result.operation
          : malformedCopy(template);
      });
      return { ok: false, operations: copies, availability: result.availability };
    }
    operations.push(result.operation);
  }
  return { ok: true, operations };
}

function launchContext(operation: Operation, run: GalaxyRunState): OperationLaunchContext {
  const adapter = operation.phases[0]?.adapter;
  if (adapter === undefined) throw new Error(`Operation ${operation.id} has no adapter phase.`);
  return {
    operationId: operation.id,
    adapterKind: adapter.kind,
    adapterPayload: clone(adapter),
    authorizedCycle: run.worldCycle,
    operationState: operation.state,
    location: clone(operation.location),
    contactId: operation.contactId,
    causeFactIds: clone(operation.causeFactIds),
    travelTransactionId: run.activeTravel?.transactionId ?? null,
  };
}

export function authorizeOperationLaunch(
  run: GalaxyRunState,
  operationId: unknown,
): OperationAuthorizationResult {
  const result = getOperation(run, operationId);
  if (!result.ok) return result;
  if (result.operation.availability.status === "unavailable") {
    return {
      ok: false,
      operation: result.operation,
      availability: result.operation.availability,
    };
  }
  if (result.operation.phases.length !== 1 || result.operation.phases[0]?.adapter === undefined) {
    const availability = unavailable("missing_adapter");
    return {
      ok: false,
      operation: { ...result.operation, availability },
      availability,
    };
  }
  return {
    ok: true,
    operation: result.operation,
    context: launchContext(result.operation, run),
  };
}

export function sameOperationLaunchContext(
  left: OperationLaunchContext,
  right: OperationLaunchContext,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function adapterPayloadFor(operation: Operation): OperationAdapterPayload | null {
  return operation.phases.length === 1 ? clone(operation.phases[0].adapter) : null;
}

/** Evaluate a declared optional modifier without consulting legacy quest progression. */
export function evaluateOperationModifier(
  modifier: OperationModifier,
  metrics: { frameCount: number },
): OperationModifierEvaluation {
  const met = Number.isSafeInteger(metrics.frameCount) &&
    metrics.frameCount >= 0 &&
    modifier.kind === "side_quest" &&
    modifier.condition.kind === "time_attack" &&
    modifier.condition.metric === "frameCount" &&
    modifier.condition.comparison === "at_most" &&
    metrics.frameCount <= modifier.condition.value;
  return { met, credits: met ? modifier.reward.credits : 0 };
}

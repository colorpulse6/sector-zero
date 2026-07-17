import { SIDE_QUESTS } from "../sideQuests";
import {
  cellKey,
  coord,
  sameCoordinate,
  validateCoordinate,
} from "../galaxy/coordinates";
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

const G0_OPERATION_LABELS: Readonly<Record<OperationId, string>> = Object.freeze({
  "op:hostile-picket": "HOSTILE PICKET",
  "op:kepler-black-box": "KEPLER BLACK BOX",
  "op:ashfall-sortie": "ASHFALL SORTIE",
});

export function operationDisplayLabel(operationId: OperationId): string {
  return G0_OPERATION_LABELS[operationId];
}

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
    } else {
      const finalLeg = activeTravel.legs[activeTravel.legs.length - 1];
      const targetMatches = activeTravel.targetId === template.contactId
        ? sameCoordinate(activeTravel.destination, template.location)
        : activeTravel.targetId === null;
      const picketCell = cellKey(template.location);
      const destinationInPicketCell = cellKey(activeTravel.destination) === picketCell;
      const vesselAtDestination = sameCoordinate(
        run.vessel.coordinate,
        activeTravel.destination,
      );
      const finalLegBound = finalLeg !== undefined &&
        sameCoordinate(finalLeg.to, activeTravel.destination) &&
        cellKey(finalLeg.to) === picketCell &&
        finalLeg.interruptionCauseId === template.causeFactIds[0];
      if (
        !targetMatches ||
        !destinationInPicketCell ||
        !finalLegBound ||
        activeTravel.interruptionOperationId !== template.id ||
        activeTravel.nextLegIndex !== activeTravel.legs.length ||
        run.vessel.status !== "in_transit" ||
        run.vessel.transitTransactionId !== activeTravel.transactionId ||
        !vesselAtDestination
      ) {
        reasons.push("interruption_mismatch");
      }
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

function failedLookup(
  template: OperationTemplate,
  reason: OperationUnavailableReason,
): OperationLookupResult {
  const availability = unavailable(reason);
  return {
    ok: false,
    operation: operationFrom(template, "available", availability),
    availability,
  };
}

function failedAuthorization(
  template: OperationTemplate,
  reason: OperationUnavailableReason,
): Extract<OperationAuthorizationResult, { ok: false }> {
  const availability = unavailable(reason);
  return {
    ok: false,
    operation: operationFrom(template, "available", availability),
    availability,
  };
}

function getOperationFromSafeRun(
  run: GalaxyRunState,
  template: OperationTemplate,
): OperationLookupResult {
  const operations = dataProperty(run, "operations");
  if (isPlainRecord(operations) && !hasOwn(operations, template.id)) {
    return failedLookup(template, "missing_operation_record");
  }
  const relevant = safeRelevantState(run, template.id);
  if (relevant === null) {
    return failedLookup(template, "malformed_run");
  }
  return {
    ok: true,
    operation: operationFrom(template, relevant.record.state, stateAvailability(relevant, template)),
  };
}

export function getOperation(run: GalaxyRunState, operationId: unknown): OperationLookupResult {
  const template = templateFor(operationId);
  if (template === null) {
    return { ok: false, operation: null, availability: unavailable("unknown_operation") };
  }
  try {
    return getOperationFromSafeRun(clone(run), template);
  } catch {
    return failedLookup(template, "malformed_run");
  }
}

export function listG0Operations(run: GalaxyRunState): OperationCatalogResult {
  try {
    const safeRun = clone(run);
    const operations: Operation[] = [];
    for (const id of G0_OPERATION_IDS) {
      const result = getOperationFromSafeRun(safeRun, templateFor(id)!);
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
  } catch {
    return {
      ok: false,
      operations: G0_OPERATION_IDS.map((id) => malformedCopy(templateFor(id)!)),
      availability: unavailable("malformed_run"),
    };
  }
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
  const template = templateFor(operationId);
  if (template === null) {
    return { ok: false, operation: null, availability: unavailable("unknown_operation") };
  }
  try {
    const safeRun = clone(run);
    const result = getOperationFromSafeRun(safeRun, template);
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
      context: launchContext(result.operation, safeRun),
    };
  } catch {
    return failedAuthorization(template, "malformed_run");
  }
}

const LAUNCH_CONTEXT_KEYS = [
  "operationId",
  "adapterKind",
  "adapterPayload",
  "authorizedCycle",
  "operationState",
  "location",
  "contactId",
  "causeFactIds",
  "travelTransactionId",
] as const;

function exactOwnData(
  value: unknown,
  expectedKeys: readonly string[],
): Record<string, unknown> | null {
  if (!isPlainRecord(value)) return null;
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
  ) return null;
  const snapshot: Record<string, unknown> = {};
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor)) return null;
    snapshot[key] = descriptor.value;
  }
  return snapshot;
}

function stringArraySnapshot(value: unknown): string[] | null {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (
    lengthDescriptor === undefined || !("value" in lengthDescriptor) ||
    !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0
  ) return null;
  const length = lengthDescriptor.value as number;
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== length + 1 ||
    keys.some((key) => key !== "length" && (
      typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length
    ))
  ) return null;
  const snapshot: string[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !("value" in descriptor) || typeof descriptor.value !== "string") {
      return null;
    }
    snapshot.push(descriptor.value);
  }
  return snapshot;
}

function coordinateSnapshot(value: unknown): GalaxyCoordinate | null {
  const snapshot = exactOwnData(value, ["sectorX", "sectorY", "localX", "localY"]);
  if (snapshot === null) return null;
  const coordinate = {
    sectorX: snapshot.sectorX,
    sectorY: snapshot.sectorY,
    localX: snapshot.localX,
    localY: snapshot.localY,
  };
  return validateCoordinate(coordinate).ok
    ? coordinate as GalaxyCoordinate
    : null;
}

function adapterSnapshot(value: unknown): OperationAdapterPayload | null {
  const base = exactOwnData(value, ["kind", "world", "level"]);
  if (base !== null) {
    return base.kind === "legacy_level" && base.world === 1 && base.level === 1
      ? { kind: "legacy_level", world: 1, level: 1 }
      : null;
  }
  const special = exactOwnData(value, ["kind", "missionId"]);
  if (special !== null) {
    return special.kind === "special_mission" && special.missionId === "kepler-black-box"
      ? { kind: "special_mission", missionId: "kepler-black-box" }
      : null;
  }
  const planet = exactOwnData(value, ["kind", "planetId"]);
  if (planet !== null) {
    return planet.kind === "planet_mission" && planet.planetId === "ashfall"
      ? { kind: "planet_mission", planetId: "ashfall" }
      : null;
  }
  return null;
}

/** Copy launch authority from own data descriptors without invoking caller code. */
export function snapshotOperationLaunchContext(
  value: unknown,
): OperationLaunchContext | null {
  try {
    const snapshot = exactOwnData(value, LAUNCH_CONTEXT_KEYS);
    if (snapshot === null) return null;
    const template = templateFor(snapshot.operationId);
    const adapter = adapterSnapshot(snapshot.adapterPayload);
    const location = coordinateSnapshot(snapshot.location);
    const causes = stringArraySnapshot(snapshot.causeFactIds);
    if (
      template === null || adapter === null || location === null || causes === null ||
      snapshot.adapterKind !== adapter.kind ||
      !Number.isSafeInteger(snapshot.authorizedCycle) ||
      (snapshot.authorizedCycle as number) < 0 ||
      typeof snapshot.operationState !== "string" ||
      !OPERATION_STATES.includes(snapshot.operationState as GalaxyOperationRecord["state"]) ||
      !(snapshot.contactId === null || typeof snapshot.contactId === "string") ||
      !(snapshot.travelTransactionId === null || typeof snapshot.travelTransactionId === "string")
    ) return null;
    return {
      operationId: template.id,
      adapterKind: adapter.kind,
      adapterPayload: adapter,
      authorizedCycle: snapshot.authorizedCycle as number,
      operationState: snapshot.operationState as GalaxyOperationRecord["state"],
      location,
      contactId: snapshot.contactId as string | null,
      causeFactIds: causes,
      travelTransactionId: snapshot.travelTransactionId as string | null,
    };
  } catch {
    return null;
  }
}

function sameAdapter(
  left: OperationAdapterPayload,
  right: OperationAdapterPayload,
): boolean {
  if (left.kind !== right.kind) return false;
  switch (left.kind) {
    case "legacy_level":
      return right.kind === "legacy_level" &&
        left.world === right.world && left.level === right.level;
    case "special_mission":
      return right.kind === "special_mission" && left.missionId === right.missionId;
    case "planet_mission":
      return right.kind === "planet_mission" && left.planetId === right.planetId;
  }
}

export function sameOperationLaunchContext(
  left: unknown,
  right: unknown,
): boolean {
  const safeLeft = snapshotOperationLaunchContext(left);
  const safeRight = snapshotOperationLaunchContext(right);
  return safeLeft !== null && safeRight !== null &&
    safeLeft.operationId === safeRight.operationId &&
    safeLeft.adapterKind === safeRight.adapterKind &&
    sameAdapter(safeLeft.adapterPayload, safeRight.adapterPayload) &&
    safeLeft.authorizedCycle === safeRight.authorizedCycle &&
    safeLeft.operationState === safeRight.operationState &&
    sameCoordinate(safeLeft.location, safeRight.location) &&
    safeLeft.contactId === safeRight.contactId &&
    safeLeft.causeFactIds.length === safeRight.causeFactIds.length &&
    safeLeft.causeFactIds.every((cause, index) => cause === safeRight.causeFactIds[index]) &&
    safeLeft.travelTransactionId === safeRight.travelTransactionId;
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

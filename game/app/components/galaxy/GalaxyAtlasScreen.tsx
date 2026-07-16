"use client";

import React, {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { getGalaxyRunAvailability } from "../engine/galaxy/galaxyRun";
import type {
  AtlasCellFact,
  AtlasKnowledgeRecord,
  GalaxyCoordinate,
  GalaxyRunState,
  ThreatBand,
  ThreatDimension,
} from "../engine/galaxy/galaxyTypes";
import {
  planRoute,
  type AtlasTarget,
  type RoutePlan,
  type RoutePlanResult,
} from "../engine/galaxy/routePlanner";
import { listG0Operations } from "../engine/operations/operationCatalog";
import type { Operation, OperationId } from "../engine/operations/operationTypes";
import {
  ATLAS_CONTACT_HIT_RADIUS_PX,
  atlasViewportReducer,
  createAtlasViewportState,
  panActionFromArrowKey,
  panActionFromTouchControl,
  selectedTargetIdFor,
  targetFromCoordinateForm,
  targetFromDomContact,
  targetFromKeyboardContact,
  targetFromPointer,
  targetFromTouch,
  worldToScreen,
  zoomAction,
  zoomActionFromPinch,
  type AtlasCoordinateFormInput,
  type AtlasViewportAction,
  type AtlasViewportContact,
  type ScreenPoint,
  type ViewportSize,
} from "./atlasViewport";

export interface GalaxyAtlasScreenProps {
  run: GalaxyRunState | null;
  onClose: () => void;
  onRestoreFocus?: () => void;
  initialTarget?: AtlasTarget;
  statusMessage?: string | null;
  onSelectTarget?: (target: AtlasTarget) => void;
  onCommitTravel?: (plan: RoutePlan) => void;
  onLaunchOperation?: (operationId: OperationId) => void;
  onRetreat?: () => void;
  onEmergencyRetreat?: () => void;
  onResumeTravel?: () => void;
  onFinalizeTravel?: () => void;
  onOpenAshfallRegion?: () => void;
}

interface AtlasContactView extends AtlasViewportContact {
  factId: string;
  target: AtlasTarget;
  label: string;
  knowledgeState: AtlasKnowledgeRecord["state"];
  confidence: AtlasKnowledgeRecord["confidence"];
  kind: AtlasCellFact["kind"];
}

type PointerGesture = {
  pointerId: number;
  last: ScreenPoint;
  moved: boolean;
};

type TouchGesture =
  | { kind: "tap"; last: ScreenPoint; moved: boolean }
  | { kind: "pinch"; initialDistance: number; initialZoom: number };

const CANVAS_SIZE: ViewportSize = Object.freeze({ width: 960, height: 520 });
const THREAT_DIMENSIONS: readonly ThreatDimension[] = Object.freeze([
  "military",
  "political",
  "environmental",
  "logistical",
  "anomalous",
]);
const CYAN = "#00f0ff";
const PANEL = "rgba(5, 15, 24, .96)";
const BORDER = "#245164";

const CONTROL_STYLE: React.CSSProperties = {
  minHeight: 40,
  border: `1px solid ${CYAN}`,
  background: "rgba(0, 70, 86, .28)",
  color: "#e7fcff",
  font: "inherit",
  padding: "8px 12px",
  cursor: "pointer",
};

function safeValues<T>(record: Record<string, T>): T[] {
  return Object.keys(record)
    .filter((key) => Object.prototype.hasOwnProperty.call(record, key))
    .map((key) => record[key]);
}

function latestKnowledgeFor(
  run: GalaxyRunState,
  subjectId: string,
): AtlasKnowledgeRecord | null {
  return safeValues(run.atlas.knowledge)
    .filter((entry) => entry.subjectId === subjectId)
    .sort(
      (left, right) =>
        right.observedCycle - left.observedCycle || left.id.localeCompare(right.id),
    )[0] ?? null;
}

function fallbackLabel(subjectId: string): string {
  return subjectId
    .replace(/^(contact|signal):/, "")
    .replace(/[-_:]+/g, " ")
    .trim()
    .toUpperCase();
}

function contactViews(run: GalaxyRunState | null): AtlasContactView[] {
  if (run === null) return [];
  return safeValues(run.atlas.materializedFacts)
    .map((fact): AtlasContactView | null => {
      const knowledge = latestKnowledgeFor(run, fact.id);
      if (
        knowledge === null ||
        knowledge.state === "unknown" ||
        knowledge.state === "lost_contact"
      ) {
        return null;
      }
      const target: AtlasTarget = fact.contactId === null
        ? { kind: "coordinate", coordinate: { ...fact.coordinate } }
        : { kind: "contact", contactId: fact.contactId };
      const targetId = selectedTargetIdFor(target);
      const observedLabel = knowledge.observedProperties.label;
      return {
        targetId,
        contactId: targetId,
        factId: fact.id,
        target,
        coordinate: { ...fact.coordinate },
        label:
          typeof observedLabel === "string" && observedLabel.trim().length > 0
            ? observedLabel.toUpperCase()
            : fallbackLabel(fact.id),
        knowledgeState: knowledge.state,
        confidence: knowledge.confidence,
        kind: fact.kind,
      };
    })
    .filter((contact): contact is AtlasContactView => contact !== null)
    .sort(
      (left, right) =>
        left.coordinate.localX - right.coordinate.localX ||
        left.coordinate.localY - right.coordinate.localY ||
        left.targetId.localeCompare(right.targetId),
    );
}

function defaultTarget(contacts: readonly AtlasContactView[]): AtlasTarget | null {
  const ashfall = contacts.find((contact) =>
    contact.target.kind === "contact" &&
    contact.target.contactId === "contact:ashfall"
  );
  const contact = ashfall ?? contacts[0];
  return contact?.target ?? null;
}

function activeTravelTarget(run: GalaxyRunState | null): AtlasTarget | null {
  const travel = run?.activeTravel;
  if (travel === null || travel === undefined) return null;
  return travel.targetId === null
    ? { kind: "coordinate", coordinate: { ...travel.destination } }
    : { kind: "contact", contactId: travel.targetId };
}

export function atlasSelectionForRun(
  run: GalaxyRunState | null,
  requestedTarget: AtlasTarget | null,
): AtlasTarget | null {
  return activeTravelTarget(run) ?? requestedTarget;
}

function normalizeContactViewTarget(
  target: AtlasTarget,
  contacts: readonly AtlasContactView[],
): AtlasTarget {
  if (target.kind !== "contact") return target;
  return contacts.find((contact) => contact.targetId === target.contactId)?.target ?? target;
}

function coordinateLabel(coordinate: GalaxyCoordinate): string {
  return `S${coordinate.sectorX},${coordinate.sectorY} · ${coordinate.localX},${coordinate.localY}`;
}

function targetLabel(
  target: AtlasTarget | null,
  contacts: readonly AtlasContactView[],
): string {
  if (target === null) return "NO TARGET";
  if (target.kind === "coordinate") return coordinateLabel(target.coordinate);
  return contacts.find((contact) =>
    contact.target.kind === "contact" &&
    contact.target.contactId === target.contactId
  )?.label ??
    fallbackLabel(target.contactId);
}

function selectedContactId(target: AtlasTarget | null): string | null {
  return target?.kind === "contact" ? target.contactId : null;
}

function bandColor(band: ThreatBand): string {
  switch (band) {
    case "low": return "#66d39e";
    case "moderate": return "#e8c65c";
    case "high": return "#ff8a56";
    case "severe": return "#ff496f";
    case "unknown": return "#8d86ad";
  }
}

function canvasPoint(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): ScreenPoint {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / Math.max(1, rect.width)) * CANVAS_SIZE.width,
    y: ((clientY - rect.top) / Math.max(1, rect.height)) * CANVAS_SIZE.height,
  };
}

export function atlasCanvasHitRadius(cssWidth: number): number {
  if (!Number.isFinite(cssWidth) || cssWidth <= 0) {
    throw new RangeError("Atlas Canvas CSS width must be positive and finite");
  }
  return ATLAS_CONTACT_HIT_RADIUS_PX * (CANVAS_SIZE.width / cssWidth);
}

export function shouldHandleAtlasPointer(pointerType: string): boolean {
  return pointerType !== "touch";
}

export function restoreAtlasFocus(
  onRestoreFocus: (() => void) | undefined,
  fallback: Pick<HTMLElement, "focus" | "isConnected"> | null,
): void {
  if (onRestoreFocus !== undefined) {
    onRestoreFocus();
    return;
  }
  if (fallback?.isConnected) fallback.focus();
}

function touchDistance(left: React.Touch, right: React.Touch): number {
  return Math.hypot(left.clientX - right.clientX, left.clientY - right.clientY);
}

function sameTarget(left: AtlasTarget | null, right: AtlasTarget): boolean {
  return left !== null && selectedTargetIdFor(left) === selectedTargetIdFor(right);
}

function operationForTarget(
  operations: readonly Operation[],
  contactId: string | null,
): Operation | null {
  if (contactId === null) return null;
  return operations.find((operation) => operation.contactId === contactId) ?? null;
}

function interruptedOperationId(run: GalaxyRunState | null): OperationId | null {
  const operationId = run?.activeTravel?.interruptionOperationId;
  return operationId === "op:hostile-picket" ? operationId : null;
}

function unavailableGenerationCopy(
  availability: ReturnType<typeof getGalaxyRunAvailability>,
): string | null {
  if (availability.status !== "unavailable") return null;
  const identityName = availability.reason === "unsupported_generation_version"
    ? "GENERATION VERSION"
    : "AUTHORED REGISTRY VERSION";
  return `${identityName} IS UNAVAILABLE — THIS SAVE IS RECOVERABLE. KEEP THIS SAVE; AN EXPLICIT MIGRATION IS REQUIRED.`;
}

function Button({
  children,
  style,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      style={{
        ...CONTROL_STYLE,
        ...(props.disabled ? { opacity: 0.46, cursor: "not-allowed" } : null),
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function GalaxyAtlasScreen({
  run,
  onClose,
  onRestoreFocus,
  initialTarget,
  statusMessage = null,
  onSelectTarget,
  onCommitTravel,
  onLaunchOperation,
  onRetreat,
  onEmergencyRetreat,
  onResumeTravel,
  onFinalizeTravel,
  onOpenAshfallRegion,
}: GalaxyAtlasScreenProps) {
  const contacts = useMemo(() => contactViews(run), [run]);
  const firstTarget = atlasSelectionForRun(
    run,
    initialTarget ?? defaultTarget(contacts),
  );
  const [localSelectedTarget, setLocalSelectedTarget] = useState<AtlasTarget | null>(firstTarget);
  const selectedTarget = atlasSelectionForRun(run, localSelectedTarget);
  const [viewport, dispatchViewport] = useReducer(
    atlasViewportReducer,
    undefined,
    () => createAtlasViewportState({
      center: run?.vessel.coordinate,
      selectedTargetId: firstTarget === null ? null : selectedTargetIdFor(firstTarget),
    }),
  );
  const [coordinateInput, setCoordinateInput] = useState<AtlasCoordinateFormInput>(() => {
    const coordinate = firstTarget?.kind === "coordinate"
      ? firstTarget.coordinate
      : run?.vessel.coordinate ?? { sectorX: 0, sectorY: 0, localX: 512, localY: 512 };
    return { ...coordinate };
  });
  const [formError, setFormError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detailsHeadingRef = useRef<HTMLHeadingElement>(null);
  const invokingControlRef = useRef<HTMLElement | null>(null);
  const pendingControlFocusRef = useRef<HTMLElement | null>(null);
  const pointerGestureRef = useRef<PointerGesture | null>(null);
  const touchGestureRef = useRef<TouchGesture | null>(null);
  const onCloseRef = useRef(onClose);
  const onRestoreFocusRef = useRef(onRestoreFocus);
  onCloseRef.current = onClose;
  onRestoreFocusRef.current = onRestoreFocus;

  const availability = useMemo(() => getGalaxyRunAvailability(run), [run]);
  const generationCopy = unavailableGenerationCopy(availability);
  const routeResult: RoutePlanResult | null = useMemo(() => {
    if (
      run === null ||
      selectedTarget === null ||
      availability.status !== "available" ||
      run.activeTravel !== null
    ) {
      return null;
    }
    return planRoute(run, selectedTarget);
  }, [availability.status, run, selectedTarget]);
  const operationCatalog = useMemo(
    () => run === null ? null : listG0Operations(run),
    [run],
  );
  const operations = operationCatalog?.operations ?? [];
  const targetContactId = selectedContactId(selectedTarget);
  const selectedOperation = operationForTarget(operations, targetContactId);
  const activeInterruptionId = interruptedOperationId(run);
  const ashfallVisited = run !== null && safeValues(run.atlas.knowledge).some(
    (record) => record.subjectId === "contact:ashfall" && record.state === "visited",
  );
  const ashfallRegionAvailable =
    run?.vessel.status === "stationary" &&
    run.vessel.contactId === "contact:ashfall" &&
    targetContactId === "contact:ashfall" &&
    ashfallVisited;
  const currentSelectedId = selectedTarget === null
    ? null
    : selectedTargetIdFor(selectedTarget);

  useEffect(() => {
    invokingControlRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      restoreAtlasFocus(onRestoreFocusRef.current, invokingControlRef.current);
    };
  }, []);

  useEffect(() => {
    if (selectedTarget === null) return;
    detailsHeadingRef.current?.focus();
  }, [currentSelectedId, selectedTarget]);

  useEffect(() => {
    const control = pendingControlFocusRef.current;
    if (control?.isConnected) control.focus();
    pendingControlFocusRef.current = null;
  }, [viewport.center.localX, viewport.center.localY, viewport.zoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const context = canvas.getContext("2d");
    if (context === null) return;

    context.clearRect(0, 0, CANVAS_SIZE.width, CANVAS_SIZE.height);
    context.fillStyle = "#040b13";
    context.fillRect(0, 0, CANVAS_SIZE.width, CANVAS_SIZE.height);
    context.strokeStyle = "rgba(54, 103, 123, .28)";
    context.lineWidth = 1;
    for (let x = 0; x <= CANVAS_SIZE.width; x += 64) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, CANVAS_SIZE.height);
      context.stroke();
    }
    for (let y = 0; y <= CANVAS_SIZE.height; y += 64) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(CANVAS_SIZE.width, y);
      context.stroke();
    }

    if (routeResult?.ok) {
      const destination = worldToScreen(routeResult.plan.destination, viewport, CANVAS_SIZE);
      const rank: Record<ThreatBand, number> = {
        low: 1,
        moderate: 2,
        high: 3,
        severe: 4,
        unknown: 2,
      };
      const highestBand = THREAT_DIMENSIONS
        .map((dimension) => routeResult.plan.threat.dimensions[dimension].band)
        .sort((left, right) => rank[right] - rank[left])[0] ?? "unknown";
      context.beginPath();
      context.arc(destination.x, destination.y, 28 + rank[highestBand] * 9, 0, Math.PI * 2);
      context.fillStyle = `${bandColor(highestBand)}22`;
      context.fill();
      context.strokeStyle = `${bandColor(highestBand)}88`;
      context.stroke();

      const origin = worldToScreen(routeResult.plan.origin, viewport, CANVAS_SIZE);
      context.beginPath();
      context.moveTo(origin.x, origin.y);
      context.lineTo(destination.x, destination.y);
      context.setLineDash([8, 7]);
      context.strokeStyle = "#8eeff5";
      context.lineWidth = 2;
      context.stroke();
      context.setLineDash([]);
    }

    for (const contact of contacts) {
      const point = worldToScreen(contact.coordinate, viewport, CANVAS_SIZE);
      const selected = currentSelectedId === contact.targetId;
      context.beginPath();
      context.arc(point.x, point.y, selected ? 9 : 6, 0, Math.PI * 2);
      context.fillStyle = selected ? "#ffffff" : contact.kind === "signal" ? "#d6a4ff" : CYAN;
      context.fill();
      if (selected) {
        context.beginPath();
        context.arc(point.x, point.y, 16, 0, Math.PI * 2);
        context.strokeStyle = CYAN;
        context.lineWidth = 2;
        context.stroke();
      }
    }
  }, [contacts, currentSelectedId, routeResult, viewport]);

  const selectTarget = (target: AtlasTarget) => {
    if (run?.activeTravel !== null && run?.activeTravel !== undefined) return;
    const normalizedTarget = normalizeContactViewTarget(target, contacts);
    setLocalSelectedTarget((current) =>
      sameTarget(current, normalizedTarget) ? current : normalizedTarget
    );
    if (normalizedTarget.kind === "contact") {
      dispatchViewport({ type: "select-contact", targetId: normalizedTarget.contactId });
    } else {
      dispatchViewport({ type: "select-coordinate", coordinate: normalizedTarget.coordinate });
      setCoordinateInput({ ...normalizedTarget.coordinate });
    }
    setFormError(null);
    onSelectTarget?.(normalizedTarget);
  };

  const dispatchFromControl = (
    action: AtlasViewportAction,
    control: HTMLElement,
  ) => {
    if (atlasViewportReducer(viewport, action) === viewport) {
      pendingControlFocusRef.current = null;
      control.focus();
      return;
    }
    pendingControlFocusRef.current = control;
    dispatchViewport(action);
  };

  const targetAtPoint = (
    point: ScreenPoint,
    touch: boolean,
    hitRadius: number,
  ) =>
    normalizeContactViewTarget(touch
      ? targetFromTouch(point, viewport, CANVAS_SIZE, contacts, hitRadius)
      : targetFromPointer(point, viewport, CANVAS_SIZE, contacts, hitRadius),
    contacts);

  const canvasPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!shouldHandleAtlasPointer(event.pointerType) || viewport.viewLevel !== "sector") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerGestureRef.current = {
      pointerId: event.pointerId,
      last: canvasPoint(event.currentTarget, event.clientX, event.clientY),
      moved: false,
    };
  };

  const canvasPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!shouldHandleAtlasPointer(event.pointerType)) return;
    const gesture = pointerGestureRef.current;
    if (gesture === null || gesture.pointerId !== event.pointerId) return;
    const next = canvasPoint(event.currentTarget, event.clientX, event.clientY);
    const deltaX = next.x - gesture.last.x;
    const deltaY = next.y - gesture.last.y;
    if (Math.hypot(deltaX, deltaY) >= 2) gesture.moved = true;
    if (gesture.moved) {
      dispatchViewport({
        type: "pan",
        deltaX: -deltaX / viewport.zoom,
        deltaY: -deltaY / viewport.zoom,
      });
      gesture.last = next;
    }
  };

  const canvasPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!shouldHandleAtlasPointer(event.pointerType)) return;
    const gesture = pointerGestureRef.current;
    if (gesture === null || gesture.pointerId !== event.pointerId) return;
    pointerGestureRef.current = null;
    if (gesture.moved) return;
    const rect = event.currentTarget.getBoundingClientRect();
    selectTarget(targetAtPoint(
      canvasPoint(event.currentTarget, event.clientX, event.clientY),
      false,
      atlasCanvasHitRadius(rect.width),
    ));
  };

  const canvasPointerCancel = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!shouldHandleAtlasPointer(event.pointerType)) return;
    if (pointerGestureRef.current?.pointerId === event.pointerId) {
      pointerGestureRef.current = null;
    }
  };

  const canvasTouchStart = (event: React.TouchEvent<HTMLCanvasElement>) => {
    if (viewport.viewLevel !== "sector") return;
    if (event.touches.length >= 2) {
      touchGestureRef.current = {
        kind: "pinch",
        initialDistance: touchDistance(event.touches[0], event.touches[1]),
        initialZoom: viewport.zoom,
      };
      return;
    }
    const touch = event.touches[0];
    if (touch === undefined) return;
    touchGestureRef.current = {
      kind: "tap",
      last: canvasPoint(event.currentTarget, touch.clientX, touch.clientY),
      moved: false,
    };
  };

  const canvasTouchMove = (event: React.TouchEvent<HTMLCanvasElement>) => {
    const gesture = touchGestureRef.current;
    if (gesture === null) return;
    event.preventDefault();
    if (gesture.kind === "pinch" && event.touches.length >= 2) {
      dispatchViewport(zoomActionFromPinch(
        gesture.initialDistance,
        touchDistance(event.touches[0], event.touches[1]),
        gesture.initialZoom,
      ));
      return;
    }
    if (gesture.kind !== "tap" || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const next = canvasPoint(event.currentTarget, touch.clientX, touch.clientY);
    const deltaX = next.x - gesture.last.x;
    const deltaY = next.y - gesture.last.y;
    if (Math.hypot(deltaX, deltaY) >= 2) gesture.moved = true;
    if (gesture.moved) {
      dispatchViewport({
        type: "pan",
        deltaX: -deltaX / viewport.zoom,
        deltaY: -deltaY / viewport.zoom,
      });
      gesture.last = next;
    }
  };

  const canvasTouchEnd = (event: React.TouchEvent<HTMLCanvasElement>) => {
    const gesture = touchGestureRef.current;
    if (event.touches.length > 0) return;
    touchGestureRef.current = null;
    if (gesture?.kind !== "tap" || gesture.moved) return;
    const touch = event.changedTouches[0];
    if (touch === undefined) return;
    const rect = event.currentTarget.getBoundingClientRect();
    selectTarget(targetAtPoint(
      canvasPoint(event.currentTarget, touch.clientX, touch.clientY),
      true,
      atlasCanvasHitRadius(rect.width),
    ));
  };

  const submitCoordinate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const target = targetFromCoordinateForm(coordinateInput);
    if (target === null) {
      setFormError("COORDINATE MUST BE A SAFE INTEGER INSIDE G0 SECTOR 0,0 (0–4095). ");
      return;
    }
    selectTarget(target);
  };

  if (run === null) {
    return (
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Galaxy Atlas"
        style={{ padding: 24, background: "#060d15", color: "#d9eef2", fontFamily: "ui-monospace, Menlo, monospace" }}
      >
        <h1 style={{ color: CYAN }}>NO GALAXY RUN IS ACTIVE</h1>
        <p>Begin a galaxy expedition from the experience selector. Legacy progress remains preserved.</p>
        <Button onClick={onCloseRef.current}>RETURN TO EXPERIENCE SELECTOR</Button>
      </section>
    );
  }

  if (generationCopy !== null) {
    const version = availability.status === "unavailable" && availability.reason === "unsupported_generation_version"
      ? run.identity.generationVersion
      : run.identity.authoredAnchorRegistryVersion;
    return (
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Galaxy Atlas unavailable"
        style={{ padding: 24, background: "#060d15", color: "#d9eef2", fontFamily: "ui-monospace, Menlo, monospace" }}
      >
        <h1 style={{ color: "#ffbd66" }}>
          {availability.status === "unavailable" && availability.reason === "unsupported_generation_version"
            ? `GENERATION VERSION ${version} IS UNAVAILABLE`
            : `AUTHORED REGISTRY VERSION ${version} IS UNAVAILABLE`}
        </h1>
        <p>{generationCopy}</p>
        <Button onClick={onCloseRef.current}>RETURN SAFELY</Button>
      </section>
    );
  }

  const routePlan = routeResult?.ok ? routeResult.plan : null;
  const routeReasons = routeResult !== null && !routeResult.ok ? routeResult.reasons : [];
  const blindTarget = selectedTarget?.kind === "coordinate";
  const travel = run.activeTravel;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Galaxy Atlas"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1150,
        overflow: "auto",
        padding: 16,
        background: "#040a12",
        color: "#d9eef2",
        fontFamily: "ui-monospace, Menlo, monospace",
      }}
    >
      <header style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${BORDER}`, paddingBottom: 12 }}>
        <Button onClick={onCloseRef.current}>← CLOSE ATLAS</Button>
        <div>
          <p style={{ margin: 0, color: "#6aa8b8", letterSpacing: ".12em" }}>VANGUARD NAVIGATION</p>
          <h1 style={{ margin: "4px 0", color: CYAN }}>GALAXY ATLAS · G0 SECTOR</h1>
          <small>CYCLE {run.worldCycle} · SUPPLY {run.resources.supply}</small>
        </div>
      </header>

      <nav aria-label="Atlas levels" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, margin: "14px 0" }}>
        <span aria-disabled="true" title="Galaxy framing preview is not interactive in G0" style={{ padding: 8, color: "#7797a4" }}>GALAXY</span>
        <span aria-hidden="true">/</span>
        <Button
          aria-pressed={viewport.viewLevel === "sector"}
          onClick={() => dispatchViewport({ type: "set-view", viewLevel: "sector" })}
        >
          SECTOR
        </Button>
        <span aria-hidden="true">/</span>
        <Button
          aria-pressed={viewport.viewLevel === "system"}
          disabled={selectedTarget === null}
          onClick={() => dispatchViewport({ type: "set-view", viewLevel: "system" })}
        >
          SYSTEM
        </Button>
        <span aria-hidden="true">/</span>
        <Button disabled={!ashfallRegionAvailable || !onOpenAshfallRegion} onClick={onOpenAshfallRegion}>
          REGION
        </Button>
      </nav>

      <div
        data-atlas-layout="responsive"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: 16, alignItems: "start" }}
      >
        <main style={{ minWidth: 0 }}>
          <section aria-label="Atlas field" style={{ border: `1px solid ${BORDER}`, background: PANEL, padding: 12 }}>
            <div
              tabIndex={0}
              aria-label="Atlas field keyboard navigation"
              onKeyDown={(event) => {
                const action = panActionFromArrowKey(event.key);
                if (action === null) return;
                event.preventDefault();
                dispatchFromControl(action, event.currentTarget);
              }}
            >
              <canvas
                ref={canvasRef}
                width={CANVAS_SIZE.width}
                height={CANVAS_SIZE.height}
                aria-hidden="true"
                onPointerDown={canvasPointerDown}
                onPointerMove={canvasPointerMove}
                onPointerUp={canvasPointerUp}
                onPointerCancel={canvasPointerCancel}
                onTouchStart={canvasTouchStart}
                onTouchMove={canvasTouchMove}
                onTouchEnd={canvasTouchEnd}
                onTouchCancel={() => { touchGestureRef.current = null; }}
                style={{ display: "block", width: "100%", height: "auto", maxHeight: "56vh", border: "1px solid #173747", touchAction: "none", cursor: viewport.viewLevel === "sector" ? "crosshair" : "default" }}
              />
            </div>

            <div aria-label="Atlas pan and zoom controls" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              {(["left", "right", "up", "down"] as const).map((direction) => (
                <Button
                  key={direction}
                  aria-label={`PAN ${direction.toUpperCase()}`}
                  disabled={viewport.viewLevel !== "sector"}
                  onClick={(event) => dispatchFromControl(
                    panActionFromTouchControl(direction),
                    event.currentTarget,
                  )}
                >
                  {direction === "left" ? "←" : direction === "right" ? "→" : direction === "up" ? "↑" : "↓"}
                </Button>
              ))}
              <Button
                aria-label="ZOOM OUT"
                disabled={viewport.viewLevel !== "sector"}
                onClick={(event) => dispatchFromControl(zoomAction(viewport.zoom / 1.4), event.currentTarget)}
              >
                −
              </Button>
              <Button
                aria-label="ZOOM IN"
                disabled={viewport.viewLevel !== "sector"}
                onClick={(event) => dispatchFromControl(zoomAction(viewport.zoom * 1.4), event.currentTarget)}
              >
                +
              </Button>
              <output style={{ alignSelf: "center", color: "#86aeb9" }}>
                CENTER {viewport.center.localX},{viewport.center.localY} · ZOOM {viewport.zoom.toFixed(2)}×
              </output>
            </div>
          </section>

          <section style={{ marginTop: 16, border: `1px solid ${BORDER}`, background: PANEL, padding: 12 }}>
            <h2 style={{ marginTop: 0, color: CYAN }}>PLOT COORDINATE</h2>
            <form
              data-coordinate-layout="wrapping"
              onSubmit={submitCoordinate}
              style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 110px), 1fr))", gap: 8, alignItems: "end" }}
            >
              {(["sectorX", "sectorY", "localX", "localY"] as const).map((field) => (
                <label key={field} style={{ display: "grid", gap: 4, minWidth: 0 }}>
                  <span>{field.replace(/([A-Z])/g, " $1").toUpperCase()}</span>
                  <input
                    name={field}
                    type="number"
                    step="1"
                    value={coordinateInput[field]}
                    onChange={(event) => setCoordinateInput((current) => ({ ...current, [field]: event.target.value }))}
                    style={{ width: "100%", minWidth: 0, minHeight: 40, border: `1px solid ${BORDER}`, background: "#07131d", color: "#ffffff", font: "inherit", padding: "6px 8px" }}
                  />
                </label>
              ))}
              <Button type="submit">PLOT</Button>
            </form>
            {formError !== null && <p role="alert" style={{ color: "#ffbd66" }}>{formError}</p>}
          </section>
        </main>

        <aside style={{ display: "grid", gap: 16 }}>
          <section style={{ border: `1px solid ${BORDER}`, background: PANEL, padding: 12 }}>
            <h2 style={{ marginTop: 0, color: CYAN }}>CONTACTS</h2>
            <div role="listbox" aria-label="Atlas contacts" style={{ display: "grid", gap: 8 }}>
              {contacts.map((contact) => {
                const selected = currentSelectedId === contact.targetId;
                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    data-atlas-contact={contact.targetId}
                    data-target-kind={contact.target.kind}
                    data-selected-target={selected ? currentSelectedId ?? undefined : undefined}
                    key={contact.targetId}
                    onClick={() => {
                      const target = targetFromDomContact(contact.targetId, contacts);
                      if (target !== null) selectTarget(target);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                      event.preventDefault();
                      const target = targetFromKeyboardContact(
                        currentSelectedId,
                        event.key === "ArrowDown" ? "next" : "previous",
                        contacts,
                      );
                      if (target !== null) selectTarget(target);
                    }}
                    style={{
                      minHeight: 50,
                      padding: 10,
                      textAlign: "left",
                      border: selected ? `2px solid ${CYAN}` : `1px solid ${BORDER}`,
                      background: selected ? "rgba(0, 92, 110, .35)" : "#07131d",
                      color: "#e8fbff",
                      font: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    <strong>{contact.label}</strong><br />
                    <small>{contact.knowledgeState.toUpperCase()} · CONFIDENCE {contact.confidence.toUpperCase()} · {coordinateLabel(contact.coordinate)}</small>
                  </button>
                );
              })}
            </div>
          </section>

          <section
            aria-labelledby="atlas-target-heading"
            data-selected-target={currentSelectedId ?? undefined}
            style={{ border: `1px solid ${CYAN}`, background: PANEL, padding: 14 }}
          >
            <p style={{ margin: 0, color: "#75a6b2" }}>SELECTED TARGET</p>
            <h2
              id="atlas-target-heading"
              ref={detailsHeadingRef}
              tabIndex={-1}
              style={{ margin: "6px 0 14px", color: CYAN, outline: "none" }}
            >
              {targetLabel(selectedTarget, contacts)}
            </h2>
            {blindTarget && <p style={{ color: "#c8a7e7" }}>BLIND COORDINATE · UNKNOWN CONTRIBUTORS POSSIBLE</p>}

            {travel?.state === "interrupted" && activeInterruptionId !== null ? (
              <div data-selected-target={currentSelectedId ?? undefined}>
                <h3 style={{ color: "#ffbd66" }}>TRAVEL INTERRUPTED</h3>
                <p>A saved military cause blocks this route. Launch it or retreat to the journaled origin.</p>
                <div style={{ display: "grid", gap: 8 }}>
                  <Button disabled={!onLaunchOperation} onClick={() => onLaunchOperation?.(activeInterruptionId)}>
                    LAUNCH INTERCEPTION
                  </Button>
                  <Button disabled={!onRetreat} onClick={onRetreat}>RETREAT TO ORIGIN</Button>
                </div>
              </div>
            ) : travel?.state === "diverted" && run.vessel.status === "stranded" ? (
              <div>
                <h3 style={{ color: "#ff7e8d" }}>VESSEL STRANDED</h3>
                <Button disabled={!onEmergencyRetreat} onClick={onEmergencyRetreat}>EMERGENCY RETREAT</Button>
              </div>
            ) : travel !== null ? (
              <div>
                <h3>TRAVEL {travel.state.toUpperCase()}</h3>
                <p>TRANSACTION {travel.transactionId}</p>
                {travel.state === "arrived" || travel.state === "resolved" ? (
                  <Button disabled={!onFinalizeTravel} onClick={onFinalizeTravel}>ACKNOWLEDGE ARRIVAL</Button>
                ) : (
                  <Button disabled={!onResumeTravel} onClick={onResumeTravel}>RESUME TRAVEL</Button>
                )}
              </div>
            ) : routePlan !== null ? (
              <div data-selected-target={currentSelectedId ?? undefined}>
                <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "7px 12px", margin: 0 }}>
                  <dt>DISTANCE</dt><dd style={{ margin: 0 }}>{routePlan.distanceUnits} UNITS</dd>
                  <dt>CYCLES</dt><dd style={{ margin: 0 }}>{routePlan.elapsedCycles}</dd>
                  <dt>SUPPLY</dt><dd style={{ margin: 0 }}>{routePlan.supplyCost} · RESERVE {routePlan.projectedReserve}</dd>
                  <dt>CONFIDENCE</dt><dd style={{ margin: 0 }}>{routePlan.threat.overall.confidence.toUpperCase()}</dd>
                </dl>
                <p style={{ color: bandColor(routePlan.threat.overall.band) }}>{routePlan.threat.overall.presentation}</p>
                <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "7px 12px" }}>
                  {THREAT_DIMENSIONS.map((dimension) => (
                    <React.Fragment key={dimension}>
                      <dt>{dimension.toUpperCase()}</dt>
                      <dd style={{ margin: 0, color: bandColor(routePlan.threat.dimensions[dimension].band) }}>
                        {routePlan.threat.dimensions[dimension].band.toUpperCase()} · {routePlan.threat.dimensions[dimension].confidence.toUpperCase()}
                        {routePlan.threat.dimensions[dimension].unknownContributors.length > 0 ? " · UNKNOWN CONTRIBUTORS" : ""}
                      </dd>
                    </React.Fragment>
                  ))}
                </dl>
                <Button
                  data-selected-target={currentSelectedId ?? undefined}
                  disabled={!onCommitTravel}
                  onClick={() => onCommitTravel?.(routePlan)}
                  style={{ width: "100%", marginTop: 12 }}
                >
                  COMMIT TRAVEL
                </Button>
              </div>
            ) : (
              <div>
                {routeReasons.length > 0 ? (
                  <div role="alert">
                    <h3 style={{ color: "#ffbd66" }}>ROUTE BLOCKED</h3>
                    <ul>{routeReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                  </div>
                ) : <p>SELECT A KNOWN CONTACT OR PLOT A COORDINATE.</p>}
                <Button disabled>COMMIT TRAVEL</Button>
              </div>
            )}

            {selectedOperation !== null && travel?.state !== "interrupted" && (
              <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: 14, paddingTop: 14 }}>
                <h3 style={{ marginTop: 0 }}>LOCATED OPERATION</h3>
                <p>{selectedOperation.objective.label.toUpperCase()}</p>
                <Button
                  disabled={selectedOperation.availability.status !== "available" || !onLaunchOperation}
                  onClick={() => onLaunchOperation?.(selectedOperation.id)}
                >
                  LAUNCH OPERATION
                </Button>
                {selectedOperation.availability.status === "unavailable" && (
                  <p style={{ color: "#9bb4bd" }}>
                    UNAVAILABLE · {selectedOperation.availability.reasons.join(", ").replaceAll("_", " ").toUpperCase()}
                  </p>
                )}
              </div>
            )}

            {targetContactId === "contact:ashfall" && (
              <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: 14, paddingTop: 14 }}>
                <Button disabled={!ashfallRegionAvailable || !onOpenAshfallRegion} onClick={onOpenAshfallRegion}>
                  OPEN ASHFALL REGION
                </Button>
                {!ashfallRegionAvailable && <p style={{ color: "#9bb4bd" }}>REGION LINK REQUIRES A VISITED ASHFALL ARRIVAL.</p>}
              </div>
            )}
          </section>

          <div role="status" aria-live="polite" style={{ minHeight: 24, color: "#9bd9e2" }}>
            {statusMessage ?? (routeResult?.ok ? `ROUTE READY · ${targetLabel(selectedTarget, contacts)}` : routeReasons[0] ?? `ATLAS READY · ${targetLabel(selectedTarget, contacts)}`)}
          </div>
        </aside>
      </div>
    </div>
  );
}

"use client";

import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useModalFocus, restoreModalFocus } from "../ui/ModalFocus";
import { getGalaxyRunAvailability } from "../engine/galaxy/galaxyRun";
import { projectGalaxyRunToLegacyState } from "../engine/galaxy/galaxyProjection";
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
  zoomAction,
  zoomActionFromPinch,
  type AtlasCoordinateFormInput,
  type AtlasViewportAction,
  type AtlasViewportContact,
  type ViewportSize,
} from "./atlasViewport";
import { buildSectorModel, type SectorModel, type SectorStar } from "./sector/sectorModel";
import { fromScene, SECTOR_SCENE_SIZE, toScene } from "./sector/sectorSpace";
import { createSectorScene, type SectorSceneHandle } from "./sector/SectorScene";
import { fallbackContactLabel, systemCatalogueForRun } from "./system/contactSystems";
import { SystemAtlasScreen } from "./system/SystemAtlasScreen";
import { atlasRegionAccess, REGION_CONTACT_ID } from "./regionAccess";
import { galaxyColonyAccess, galaxyColonyAtContact } from "../engine/galaxy/galaxyColony";

export interface GalaxyAtlasScreenProps {
  run: GalaxyRunState | null;
  onClose: () => void;
  onRestoreFocus?: () => void;
  focusActive?: boolean;
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
  /** GC1: walk a galaxy colony in first person. The caller re-derives access before launching. */
  onDescendToColony?: (colonyId: string) => void;
}

interface AtlasContactView extends AtlasViewportContact {
  factId: string;
  target: AtlasTarget;
  label: string;
  knowledgeState: AtlasKnowledgeRecord["state"];
  confidence: AtlasKnowledgeRecord["confidence"];
  kind: AtlasCellFact["kind"];
}

type LivePoint = { x: number; y: number; visible: boolean };

const CANVAS_SIZE: ViewportSize = Object.freeze({ width: 960, height: 520 });
const THREAT_DIMENSIONS: readonly ThreatDimension[] = Object.freeze([
  "military",
  "political",
  "environmental",
  "logistical",
  "anomalous",
]);
const LABEL_BOX = Object.freeze({ width: 150, height: 34 });
/** Most labels the sector field shows at once; the CONTACTS list carries the rest. */
const LABEL_LIMIT = 12;
/** Label anchor offset from the marker centre: below stars, above the vessel. */
const LABEL_OFFSET_Y = 28;
const BAND_RANK: Readonly<Record<ThreatBand, number>> = Object.freeze({
  unknown: 0,
  low: 1,
  moderate: 2,
  high: 3,
  severe: 4,
});

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

/** Same designation the sector field uses, so list, heading and landmark agree. */
function fallbackLabel(subjectId: string): string {
  return fallbackContactLabel(subjectId);
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

function dominantBand(bands: readonly ThreatBand[]): ThreatBand {
  return bands.reduce<ThreatBand>((best, band) => (BAND_RANK[band] > BAND_RANK[best] ? band : best), "unknown");
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
  restoreModalFocus(onRestoreFocus, fallback);
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

function planPercent(coordinate: GalaxyCoordinate): { x: number; y: number } {
  const point = toScene(coordinate);
  return {
    x: (point.x / SECTOR_SCENE_SIZE + 0.5) * 100,
    y: (point.z / SECTOR_SCENE_SIZE + 0.5) * 100,
  };
}

function starSubtitle(star: SectorStar): string {
  if (star.knowledge === "signal") return "SIGNAL";
  if (star.colonies > 0) return `${star.colonies} ${star.colonies === 1 ? "COLONY" : "COLONIES"}`;
  if (star.knowledge === "visited") return "VISITED";
  return "CHARTED";
}

function placeLandmark(element: HTMLElement, point: LivePoint) {
  const left = `${Math.round(point.x)}px`;
  const top = `${Math.round(point.y)}px`;
  if (element.style.left !== left) element.style.left = left;
  if (element.style.top !== top) element.style.top = top;
  const visible = point.visible ? "true" : "false";
  if (element.dataset.visible !== visible) element.dataset.visible = visible;
}

function readLandmarkPoint(element: HTMLElement, width: number, height: number): { x: number; y: number } {
  const left = element.style.left;
  const top = element.style.top;
  return {
    x: left.endsWith("%") ? (Number.parseFloat(left) / 100) * width : Number.parseFloat(left),
    y: top.endsWith("%") ? (Number.parseFloat(top) / 100) * height : Number.parseFloat(top),
  };
}

interface LabelBox { x: number; y: number; width: number }

/** Rough rendered width of a landmark label: 13px name over an 8px mono subtitle. Computed at render. */
function labelWidth(name: string, subtitle: string): number {
  return Math.min(LABEL_BOX.width, Math.max(name.length * 8, subtitle.length * 6) + 12);
}

function estimateLabelWidth(element: HTMLElement): number {
  const width = Number(element.dataset.labelWidth);
  return Number.isFinite(width) && width > 0 ? width : LABEL_BOX.width;
}

function overlapsLabel(candidate: LabelBox, boxes: readonly LabelBox[]): boolean {
  return boxes.some((box) =>
    Math.abs(box.x - candidate.x) < (box.width + candidate.width) / 2 + 8
    && Math.abs(box.y - candidate.y) < LABEL_BOX.height
  );
}

/**
 * Greedy label budget. In sector view the selected, visited, colony and vessel marks always
 * keep a label; others are labelled nearest-centre first while they fit without overlap,
 * up to LABEL_LIMIT. Galaxy view keeps only visited and colony stars.
 */
function applyLabelBudget(field: HTMLElement, level: string) {
  const width = field.clientWidth;
  const height = field.clientHeight;
  if (width <= 0 || height <= 0) return;
  const centerX = width / 2;
  const centerY = height / 2;
  const entries = [...field.querySelectorAll<HTMLElement>("[data-sector-landmark], [data-sector-marker]")]
    .map((element) => {
      const point = readLandmarkPoint(element, width, height);
      const galaxyKeep = element.dataset.sectorMarker === undefined
        && (element.dataset.knowledge === "visited" || element.dataset.colony === "true");
      const always = level !== "galaxy" && (
        element.dataset.selected === "true"
        || element.dataset.knowledge === "visited"
        || element.dataset.colony === "true"
        || element.dataset.vessel === "true"
      );
      const labelY = point.y + (element.dataset.sectorMarker === "vessel" ? -LABEL_OFFSET_Y : LABEL_OFFSET_Y);
      return {
        element,
        x: point.x,
        y: labelY,
        width: estimateLabelWidth(element),
        distance: Math.hypot(point.x - centerX, point.y - centerY),
        always,
        galaxyKeep,
        visible: element.dataset.visible !== "false",
      };
    })
    .sort((left, right) => left.distance - right.distance || (left.element.dataset.sectorLandmark ?? left.element.dataset.sectorMarker ?? "").localeCompare(right.element.dataset.sectorLandmark ?? right.element.dataset.sectorMarker ?? ""));
  const boxes: LabelBox[] = [];
  const setLabelled = (element: HTMLElement, value: "true" | "false") => {
    if (element.dataset.labelled !== value) element.dataset.labelled = value;
  };
  for (const entry of entries) {
    const keep = level === "galaxy" ? entry.galaxyKeep : entry.always;
    if (!keep) continue;
    setLabelled(entry.element, "true");
    if (Number.isFinite(entry.x) && Number.isFinite(entry.y)) boxes.push({ x: entry.x, y: entry.y, width: entry.width });
  }
  for (const entry of entries) {
    const keep = level === "galaxy" ? entry.galaxyKeep : entry.always;
    if (keep) continue;
    const fits = level !== "galaxy"
      && boxes.length < LABEL_LIMIT
      && entry.visible
      && Number.isFinite(entry.x)
      && Number.isFinite(entry.y)
      // Optional labels never run off the field edge.
      && entry.x - entry.width / 2 >= 0
      && entry.x + entry.width / 2 <= width
      && !overlapsLabel(entry, boxes);
    setLabelled(entry.element, fits ? "true" : "false");
    if (fits) boxes.push({ x: entry.x, y: entry.y, width: entry.width });
  }
}

/** Server and first paint: only the always-labelled marks; the live budget fills in the rest. */
function renderedLabelled(level: string, always: boolean, galaxyKeep: boolean): "true" | "false" {
  if (level === "galaxy") return galaxyKeep ? "true" : "false";
  return always ? "true" : "false";
}

function Button({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...props} className={className ? `sz-atlas-button ${className}` : "sz-atlas-button"}>
      {children}
    </button>
  );
}

function Journal({
  transactionId,
  legs,
}: {
  transactionId: string | null;
  legs: readonly { from: GalaxyCoordinate; to: GalaxyCoordinate }[];
}) {
  if (transactionId === null && legs.length === 0) return null;
  return (
    <details className="sz-atlas-journal">
      <summary tabIndex={0}>JOURNAL</summary>
      {transactionId !== null && <p>TRANSACTION {transactionId}</p>}
      {legs.length > 0 && (
        <ol>
          {legs.map((leg, index) => (
            <li key={`${coordinateLabel(leg.from)}:${coordinateLabel(leg.to)}:${index}`}>
              {coordinateLabel(leg.from)} → {coordinateLabel(leg.to)}
            </li>
          ))}
        </ol>
      )}
    </details>
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
  onDescendToColony,
  focusActive = true,
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
  const [sceneReady, setSceneReady] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const headerRef = useRef<HTMLElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const detailsHeadingRef = useRef<HTMLHeadingElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const pendingControlFocusRef = useRef<HTMLElement | null>(null);
  const sceneRef = useRef<SectorSceneHandle | null>(null);
  const landmarkRefs = useRef(new Map<string, HTMLElement>());
  const livePoints = useRef(new Map<string, LivePoint>());
  const pointerRef = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const selectRef = useRef<(clientX: number, clientY: number) => void>(() => {});
  const levelRef = useRef(viewport.viewLevel);
  const zoomRef = useRef(viewport.zoom);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  levelRef.current = viewport.viewLevel;
  zoomRef.current = viewport.zoom;

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
  const routePlan = routeResult?.ok ? routeResult.plan : null;
  const model = useMemo(
    () => (run === null ? null : buildSectorModel(run, selectedTarget, routePlan)),
    [run, selectedTarget, routePlan],
  );
  const systemCatalogue = useMemo(
    () => (run !== null && viewport.viewLevel === "system" ? systemCatalogueForRun(run) : null),
    [run, viewport.viewLevel],
  );
  const legacySave = useMemo(
    () => (run !== null && viewport.viewLevel === "system" ? projectGalaxyRunToLegacyState(run) : null),
    [run, viewport.viewLevel],
  );
  const operationCatalog = useMemo(
    () => run === null ? null : listG0Operations(run),
    [run],
  );
  const operations = operationCatalog?.operations ?? [];
  const targetContactId = selectedContactId(selectedTarget);
  const selectedOperation = operationForTarget(operations, targetContactId);
  const activeInterruptionId = interruptedOperationId(run);
  const regionAccess = atlasRegionAccess(run, targetContactId);
  const regionOpenable = regionAccess.status !== "unavailable" && onOpenAshfallRegion !== undefined;
  const regionLevelNote = regionAccess.status === "unavailable"
    ? regionAccess.reason
    : regionAccess.status === "view" ? "VIEW ONLY" : null;
  const regionPanelNote = regionAccess.status === "unavailable"
    ? regionAccess.reason
    : regionAccess.status === "view" ? "VIEW ONLY · PARK THE VESSEL AT ASHFALL TO SURVEY OR TRAVEL" : null;
  const descendColonyId = galaxyColonyAtContact(run, targetContactId);
  const descendAccess = galaxyColonyAccess(run, descendColonyId);
  const descendable = descendAccess.status === "full" && onDescendToColony !== undefined;
  const currentSelectedId = selectedTarget === null
    ? null
    : selectedTargetIdFor(selectedTarget);
  const contactTabStopId = contacts.some((contact) => contact.targetId === currentSelectedId)
    ? currentSelectedId
    : contacts[0]?.targetId;
  const showField = run !== null && generationCopy === null;
  const sceneMounted = showField && viewport.viewLevel !== "system";

  useModalFocus({ active: focusActive, rootRef, onEscape: onClose, restoreFocus: onRestoreFocus,
    initialFocus: () => {
      const root = rootRef.current;
      const option = root?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]') ?? null;
      // A collapsed panel hides the contacts; its toggle keeps focus inside the atlas.
      if (option && option.getClientRects().length > 0) return option;
      return root?.querySelector<HTMLElement>(".sz-atlas-toggle") ?? null;
    } });

  useEffect(() => {
    const control = pendingControlFocusRef.current;
    if (control?.isConnected) control.focus();
    pendingControlFocusRef.current = null;
  }, [viewport.center.localX, viewport.center.localY, viewport.zoom]);

  useEffect(() => {
    if (!sceneMounted) return;
    const canvas = canvasRef.current;
    const field = fieldRef.current;
    if (!canvas || !field) return;
    let cancelled = false;
    let handle: SectorSceneHandle | null = null;
    let observer: ResizeObserver | null = null;
    let unsubscribe = () => {};
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyMotion = () => handle?.setReducedMotion(motion.matches);
    motion.addEventListener("change", applyMotion);

    (async () => {
      try {
        handle = await createSectorScene(canvas);
      } catch {
        return;
      }
      if (cancelled) {
        handle.dispose();
        return;
      }
      sceneRef.current = handle;
      applyMotion();
      unsubscribe = handle.onFrame((projected) => {
        const next = new Map<string, LivePoint>();
        for (const point of projected) {
          next.set(point.id, point);
          const element = landmarkRefs.current.get(point.id);
          if (element) placeLandmark(element, point);
        }
        livePoints.current = next;
        const host = fieldRef.current;
        if (host) applyLabelBudget(host, levelRef.current);
      });
      observer = new ResizeObserver(() => handle?.resize());
      observer.observe(field);
      handle.resize();
      if (!cancelled) setSceneReady(true);
    })();

    return () => {
      cancelled = true;
      motion.removeEventListener("change", applyMotion);
      unsubscribe();
      observer?.disconnect();
      sceneRef.current = null;
      handle?.dispose();
      setSceneReady(false);
    };
  }, [sceneMounted]);

  // The top bar and HUD float over the stage; publish their heights so the stage, the overlay
  // panel and the embedded system view can keep clear of them.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const header = headerRef.current;
    const hud = hudRef.current;
    if (!root || !header || !hud) return;
    const publish = () => {
      root.style.setProperty("--atlas-top", `${Math.ceil(header.getBoundingClientRect().height)}px`);
      root.style.setProperty("--atlas-bottom", `${Math.ceil(hud.getBoundingClientRect().height) + 16}px`);
    };
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(header);
    observer.observe(hud);
    return () => observer.disconnect();
  }, [showField]);

  // While the overlay panel covers the field, the 3D view centres in the space left of it.
  useEffect(() => {
    const scene = sceneRef.current;
    const field = fieldRef.current;
    if (!scene || !field) return;
    const measure = () => {
      const panel = asideRef.current;
      const fieldBox = field.getBoundingClientRect();
      const panelBox = panel?.getBoundingClientRect();
      const overlaps = panelBox !== undefined && panelBox.width > 0 && panelBox.height > 0
        && panelBox.left < fieldBox.right && panelBox.right > fieldBox.left
        && panelBox.top < fieldBox.bottom && panelBox.bottom > fieldBox.top;
      scene.setViewInset(overlaps ? fieldBox.right - panelBox.left : 0);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(field);
    if (asideRef.current) observer.observe(asideRef.current);
    return () => observer.disconnect();
  }, [sceneReady, panelOpen, viewport.viewLevel]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !model || viewport.viewLevel === "system") return;
    scene.setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    scene.setModel(model);
    scene.focusTarget(currentSelectedId);
  }, [model, currentSelectedId, sceneReady, viewport.viewLevel]);

  useEffect(() => {
    const scene = sceneRef.current;
    // Only the sector level follows the reducer's centre and zoom; setLevel owns the galaxy framing.
    if (!scene || viewport.viewLevel !== "sector") return;
    scene.setViewport(viewport.center, viewport.zoom);
  }, [viewport.center, viewport.zoom, viewport.viewLevel, sceneReady]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || viewport.viewLevel === "system") return;
    void scene.setLevel(viewport.viewLevel === "galaxy" ? "galaxy" : "sector");
  }, [viewport.viewLevel, sceneReady]);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field || !showField) return;
    const onWheel = (event: WheelEvent) => {
      if (levelRef.current !== "sector") return;
      event.preventDefault();
      const zoom = zoomRef.current;
      dispatchViewport(zoomAction(event.deltaY > 0 ? zoom / 1.12 : zoom * 1.12));
    };
    let pinch: { initialDistance: number; initialZoom: number } | null = null;
    let tap: { x: number; y: number; moved: boolean } | null = null;
    const onTouchStart = (event: TouchEvent) => {
      if (levelRef.current !== "sector") return;
      if (event.touches.length >= 2) {
        pinch = {
          initialDistance: Math.hypot(
            event.touches[0].clientX - event.touches[1].clientX,
            event.touches[0].clientY - event.touches[1].clientY,
          ),
          initialZoom: zoomRef.current,
        };
        tap = null;
        return;
      }
      const touch = event.touches[0];
      if (!touch) return;
      pinch = null;
      tap = { x: touch.clientX, y: touch.clientY, moved: false };
    };
    const onTouchMove = (event: TouchEvent) => {
      if (pinch && event.touches.length >= 2) {
        event.preventDefault();
        const distance = Math.hypot(
          event.touches[0].clientX - event.touches[1].clientX,
          event.touches[0].clientY - event.touches[1].clientY,
        );
        dispatchViewport(zoomActionFromPinch(pinch.initialDistance, distance, pinch.initialZoom));
        return;
      }
      if (!tap || event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (Math.hypot(touch.clientX - tap.x, touch.clientY - tap.y) > 4) tap.moved = true;
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length > 0) return;
      const ended = tap;
      tap = null;
      pinch = null;
      if (!ended || ended.moved || levelRef.current !== "sector") return;
      const touch = event.changedTouches[0];
      if (!touch) return;
      if (event.target instanceof Element && event.target.closest("[data-sector-landmark], [data-sector-marker]")) return;
      selectRef.current(touch.clientX, touch.clientY);
    };
    const onTouchCancel = () => { tap = null; pinch = null; };
    field.addEventListener("wheel", onWheel, { passive: false });
    field.addEventListener("touchstart", onTouchStart, { passive: true });
    field.addEventListener("touchmove", onTouchMove, { passive: false });
    field.addEventListener("touchend", onTouchEnd);
    field.addEventListener("touchcancel", onTouchCancel);
    return () => {
      field.removeEventListener("wheel", onWheel);
      field.removeEventListener("touchstart", onTouchStart);
      field.removeEventListener("touchmove", onTouchMove);
      field.removeEventListener("touchend", onTouchEnd);
      field.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [showField]);

  useLayoutEffect(() => {
    if (viewport.viewLevel === "system") return;
    livePoints.current.forEach((point, id) => {
      const element = landmarkRefs.current.get(id);
      if (element) placeLandmark(element, point);
    });
    const field = fieldRef.current;
    if (field) applyLabelBudget(field, levelRef.current);
  });

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

  const selectFromPointer = (clientX: number, clientY: number) => {
    if (viewport.viewLevel !== "sector" || model === null) return;
    const field = fieldRef.current;
    const scene = sceneRef.current;
    const picked = scene
      ? scene.pick(clientX, clientY)
      : field
        ? planPick(field, clientX, clientY)
        : null;
    if (!picked) return;
    const coordinate = fromScene(picked.x, picked.z);
    const rect = field?.getBoundingClientRect();
    let nearest: SectorStar | null = null;
    let best = ATLAS_CONTACT_HIT_RADIUS_PX;
    if (rect) {
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      for (const star of model.stars) {
        const live = livePoints.current.get(star.targetId);
        const fallback = planPercent(star.coordinate);
        const px = live?.x ?? (fallback.x / 100) * rect.width;
        const py = live?.y ?? (fallback.y / 100) * rect.height;
        if (live && !live.visible) continue;
        const distance = Math.hypot(px - x, py - y);
        if (distance <= best) {
          best = distance;
          nearest = star;
        }
      }
    }
    if (nearest) {
      const star = nearest;
      const contact = contacts.find((entry) => entry.targetId === star.targetId);
      selectTarget(contact?.target ?? (
        star.contactId
          ? { kind: "contact", contactId: star.contactId }
          : { kind: "coordinate", coordinate: star.coordinate }
      ));
      return;
    }
    selectTarget({ kind: "coordinate", coordinate });
  };
  selectRef.current = selectFromPointer;

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
      <div
        ref={rootRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Galaxy Atlas"
        className="sz-atlas"
      >
        <div className="sz-atlas-shell">
          <h1>NO GALAXY RUN IS ACTIVE</h1>
          <p>Begin a galaxy expedition from the experience selector. Legacy progress remains preserved.</p>
          <Button onClick={onCloseRef.current}>RETURN TO EXPERIENCE SELECTOR</Button>
        </div>
      </div>
    );
  }

  if (generationCopy !== null) {
    const version = availability.status === "unavailable" && availability.reason === "unsupported_generation_version"
      ? run.identity.generationVersion
      : run.identity.authoredAnchorRegistryVersion;
    return (
      <div
        ref={rootRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Galaxy Atlas unavailable"
        className="sz-atlas"
      >
        <div className="sz-atlas-shell">
          <h1>
            {availability.status === "unavailable" && availability.reason === "unsupported_generation_version"
              ? `GENERATION VERSION ${version} IS UNAVAILABLE`
              : `AUTHORED REGISTRY VERSION ${version} IS UNAVAILABLE`}
          </h1>
          <p>{generationCopy}</p>
          <Button onClick={onCloseRef.current}>RETURN SAFELY</Button>
        </div>
      </div>
    );
  }

  const routeReasons = routeResult !== null && !routeResult.ok ? routeResult.reasons : [];
  const blindTarget = selectedTarget?.kind === "coordinate";
  const travel = run.activeTravel;
  const sectorModel: SectorModel = model ?? buildSectorModel(run, selectedTarget, routePlan);
  const selectedContact = contacts.find((contact) => contact.targetId === currentSelectedId) ?? null;
  const systemLevelAvailable = selectedContact?.target.kind === "contact"
    && selectedContact.kind === "stellar_contact"
    && (selectedContact.knowledgeState === "charted" || selectedContact.knowledgeState === "visited");
  const systemInitialId = selectedContact?.target.kind === "contact" ? selectedContact.target.contactId : undefined;
  const knownCount = contacts.filter((contact) => contact.knowledgeState === "charted" || contact.knowledgeState === "visited").length;
  const colonyTotal = run.colonies.length;
  const routeMarker = sectorModel.travel
    ? { band: dominantBand(sectorModel.travel.legs.map((leg) => leg.band)), state: "travel" as const }
    : sectorModel.route
      ? { band: sectorModel.route.band, state: "planned" as const }
      : null;
  const vesselStar = sectorModel.stars.find((star) => star.vessel) ?? null;
  const selectedLabel = targetLabel(selectedTarget, contacts);

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Galaxy Atlas"
      className="sz-atlas"
      data-atlas-view={viewport.viewLevel}
      data-panel={panelOpen ? "open" : "closed"}
    >
      <div className="sz-atlas-shell">
        <header
          ref={headerRef}
          style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}
          className="sz-atlas-header"
        >
          <Button onClick={onCloseRef.current}>← CLOSE ATLAS</Button>
          <div className="sz-atlas-brand">
            <p className="sz-atlas-eyebrow">VANGUARD NAVIGATION</p>
            <h1>GALAXY ATLAS</h1>
            <div className="sz-atlas-chips" aria-label="Atlas status">
              <span className="sz-atlas-chip">CYCLE <b>{run.worldCycle}</b></span>
              <span className="sz-atlas-chip">SUPPLY <b>{run.resources.supply}</b></span>
              <span className="sz-atlas-chip">{knownCount} KNOWN · {colonyTotal} COLONIES</span>
            </div>
          </div>

          <nav aria-label="Atlas levels" className="sz-atlas-levels">
            <Button
              aria-pressed={viewport.viewLevel === "galaxy"}
              onClick={() => dispatchViewport({ type: "set-view", viewLevel: "galaxy" })}
            >
              GALAXY
            </Button>
            <span className="sz-atlas-slash" aria-hidden="true">/</span>
            <Button
              aria-pressed={viewport.viewLevel === "sector"}
              onClick={() => dispatchViewport({ type: "set-view", viewLevel: "sector" })}
            >
              SECTOR
            </Button>
            <span className="sz-atlas-slash" aria-hidden="true">/</span>
            <Button
              aria-pressed={viewport.viewLevel === "system"}
              disabled={!systemLevelAvailable}
              onClick={() => dispatchViewport({ type: "set-view", viewLevel: "system" })}
            >
              SYSTEM
            </Button>
            <span className="sz-atlas-slash" aria-hidden="true">/</span>
            <Button
              disabled={!regionOpenable}
              aria-describedby={regionLevelNote ? "atlas-region-note" : undefined}
              onClick={onOpenAshfallRegion}
            >
              REGION
            </Button>
            {regionLevelNote && <span id="atlas-region-note" className="sz-atlas-level-note">{regionLevelNote}</span>}
          </nav>

          {viewport.viewLevel !== "system" && (
            <button
              type="button"
              className="sz-atlas-toggle"
              aria-expanded={panelOpen}
              aria-controls="atlas-side"
              onClick={() => setPanelOpen((open) => !open)}
            >
              {panelOpen ? (
                <>HIDE PANEL<span aria-hidden="true"> ▸</span></>
              ) : (
                <><span className="sz-atlas-sr">SHOW PANEL · </span><span aria-hidden="true">◂ </span>{selectedLabel}</>
              )}
            </button>
          )}
        </header>

        <div data-atlas-layout="hud" className="sz-atlas-layout">
          <main className="sz-atlas-main">
            <section aria-label="Atlas field" className="sz-atlas-stage">
              <div
                ref={fieldRef}
                data-sector-field="true"
                data-scene={sceneReady ? "3d" : "plan"}
                data-atlas-level={viewport.viewLevel}
                data-route-band={routeMarker?.band}
                data-route-state={routeMarker?.state}
                className="sz-atlas-field"
                tabIndex={viewport.viewLevel === "system" ? -1 : 0}
                aria-label="Atlas field keyboard navigation"
                onKeyDown={(event) => {
                  if (viewport.viewLevel !== "sector" || event.target !== event.currentTarget) return;
                  const action = panActionFromArrowKey(event.key);
                  if (action === null) return;
                  event.preventDefault();
                  dispatchFromControl(action, event.currentTarget);
                }}
                onPointerEnter={() => sceneRef.current?.setSpinPaused(true)}
                onPointerLeave={() => sceneRef.current?.setSpinPaused(false)}
                onPointerDown={(event) => {
                  if (!shouldHandleAtlasPointer(event.pointerType) || viewport.viewLevel !== "sector") return;
                  if (event.target instanceof Element && event.target.closest("button, [data-sector-landmark], [data-sector-marker]")) return;
                  pointerRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
                }}
                onPointerMove={(event) => {
                  const gesture = pointerRef.current;
                  if (!gesture || gesture.id !== event.pointerId) return;
                  if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 4) gesture.moved = true;
                }}
                onPointerUp={(event) => {
                  if (!shouldHandleAtlasPointer(event.pointerType)) return;
                  const gesture = pointerRef.current;
                  if (!gesture || gesture.id !== event.pointerId) return;
                  pointerRef.current = null;
                  if (gesture.moved || Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 4) return;
                  if (event.target instanceof Element && event.target.closest("[data-sector-landmark], [data-sector-marker], button")) return;
                  selectFromPointer(event.clientX, event.clientY);
                }}
                onPointerCancel={() => { pointerRef.current = null; }}
              >
                {viewport.viewLevel === "system" && systemCatalogue && legacySave ? (
                  <div data-system-embedded="true" className="sz-atlas-embedded">
                    <button
                      type="button"
                      className="sz-atlas-back"
                      onClick={() => dispatchViewport({ type: "set-view", viewLevel: "sector" })}
                    >
                      ← BACK TO SECTOR
                    </button>
                    <SystemAtlasScreen
                      embedded
                      catalogue={systemCatalogue}
                      save={legacySave}
                      initialSystemId={systemInitialId}
                      onClose={() => dispatchViewport({ type: "set-view", viewLevel: "sector" })}
                      onOpenRegion={onOpenAshfallRegion ? () => onOpenAshfallRegion() : undefined}
                      regionAccess={(systemId) => atlasRegionAccess(run, systemId)}
                      onDescend={onDescendToColony}
                      descendAccess={(colonyId) => galaxyColonyAccess(run, colonyId)}
                    />
                  </div>
                ) : (
                  <>
                    <canvas ref={canvasRef} className="sz-atlas-canvas" tabIndex={-1} aria-hidden="true" />
                    {!sceneReady && (
                      <svg className="sz-atlas-plan" aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {sectorModel.stars.map((star) => {
                          const point = planPercent(star.coordinate);
                          return (
                            <circle
                              key={star.targetId}
                              data-plan-star={star.targetId}
                              data-knowledge={star.knowledge}
                              cx={point.x}
                              cy={point.y}
                              r={star.knowledge === "signal" ? 0.7 : 1.15}
                            />
                          );
                        })}
                      </svg>
                    )}
                    <span className="sz-atlas-corner" data-corner="tl" aria-hidden="true" />
                    <span className="sz-atlas-corner" data-corner="tr" aria-hidden="true" />
                    <span className="sz-atlas-corner" data-corner="bl" aria-hidden="true" />
                    <span className="sz-atlas-corner" data-corner="br" aria-hidden="true" />
                    {viewport.viewLevel === "galaxy" && <p className="sz-atlas-caption">SECTOR 0,0 · G0 FRONTIER</p>}
                    <div className="sz-atlas-landmarks" aria-hidden="true">
                      {sectorModel.stars.map((star) => {
                        const point = planPercent(star.coordinate);
                        const selected = currentSelectedId === star.targetId;
                        const always = selected || star.knowledge === "visited" || star.colonies > 0 || star.vessel;
                        const galaxyKeep = star.knowledge === "visited" || star.colonies > 0;
                        return (
                          <div
                            key={star.targetId}
                            ref={(element) => {
                              if (element) landmarkRefs.current.set(star.targetId, element);
                              else landmarkRefs.current.delete(star.targetId);
                            }}
                            data-sector-landmark={star.targetId}
                            data-knowledge={star.knowledge}
                            data-threat={star.threat}
                            data-colony={star.colonies > 0 ? "true" : "false"}
                            data-vessel={star.vessel ? "true" : "false"}
                            data-selected={selected ? "true" : "false"}
                            data-labelled={renderedLabelled(viewport.viewLevel, always, galaxyKeep)}
                            data-label-width={labelWidth(star.label, starSubtitle(star))}
                            className="sz-atlas-landmark"
                            style={{ left: `${point.x}%`, top: `${point.y}%` }}
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation();
                              const contact = contacts.find((entry) => entry.targetId === star.targetId);
                              if (contact) selectTarget(contact.target);
                            }}
                          >
                            <span className="sz-atlas-bracket" aria-hidden="true" />
                            <span className="sz-atlas-marker" aria-hidden="true" />
                            <span className="sz-atlas-label">
                              <strong>{star.label}</strong>
                              <span>{starSubtitle(star)}</span>
                            </span>
                          </div>
                        );
                      })}
                      {!sectorModel.stars.some((star) => star.vessel) && (
                      <div
                        ref={(element) => {
                          if (element) landmarkRefs.current.set("vessel", element);
                          else landmarkRefs.current.delete("vessel");
                        }}
                        data-sector-marker="vessel"
                        data-knowledge={vesselStar?.knowledge ?? "unknown"}
                        data-threat={vesselStar?.threat ?? "unknown"}
                        data-colony={vesselStar && vesselStar.colonies > 0 ? "true" : "false"}
                        data-vessel="true"
                        data-selected="false"
                        data-labelled={renderedLabelled(viewport.viewLevel, true, false)}
                        data-label-width={labelWidth("VESSEL", sectorModel.vessel.status.replaceAll("_", " "))}
                        className="sz-atlas-landmark"
                        style={{ left: `${planPercent(sectorModel.vessel.coordinate).x}%`, top: `${planPercent(sectorModel.vessel.coordinate).y}%` }}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (sectorModel.vessel.contactId) {
                            const contact = contacts.find((entry) => entry.target.kind === "contact" && entry.target.contactId === sectorModel.vessel.contactId);
                            if (contact) selectTarget(contact.target);
                            return;
                          }
                          selectTarget({ kind: "coordinate", coordinate: sectorModel.vessel.coordinate });
                        }}
                      >
                        <span className="sz-atlas-bracket" aria-hidden="true" />
                        <span className="sz-atlas-marker" aria-hidden="true" />
                        <span className="sz-atlas-label">
                          <strong>VESSEL</strong>
                          <span>{sectorModel.vessel.status.replaceAll("_", " ").toUpperCase()}</span>
                        </span>
                      </div>
                      )}
                      {sectorModel.blindTarget && (
                        <div
                          ref={(element) => {
                            if (element) landmarkRefs.current.set("blind", element);
                            else landmarkRefs.current.delete("blind");
                          }}
                          data-sector-marker="blind"
                          data-knowledge="unknown"
                          data-threat="unknown"
                          data-colony="false"
                          data-vessel="false"
                          data-selected="true"
                          data-labelled={renderedLabelled(viewport.viewLevel, true, false)}
                          data-label-width={labelWidth("BLIND COORDINATE", coordinateLabel(sectorModel.blindTarget))}
                          className="sz-atlas-landmark"
                          style={{ left: `${planPercent(sectorModel.blindTarget).x}%`, top: `${planPercent(sectorModel.blindTarget).y}%` }}
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (sectorModel.blindTarget) selectTarget({ kind: "coordinate", coordinate: sectorModel.blindTarget });
                          }}
                        >
                          <span className="sz-atlas-bracket" aria-hidden="true" />
                          <span className="sz-atlas-marker" aria-hidden="true" />
                          <span className="sz-atlas-label">
                            <strong>BLIND COORDINATE</strong>
                            <span>{coordinateLabel(sectorModel.blindTarget)}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </section>

            <div ref={hudRef} className="sz-atlas-hud">
              <div className="sz-atlas-hud-tools" hidden={viewport.viewLevel === "system"}>
                <div aria-label="Atlas pan and zoom controls" className="sz-atlas-controls">
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
                  <output className="sz-atlas-readout">
                    CENTER {viewport.center.localX},{viewport.center.localY} · ZOOM {viewport.zoom.toFixed(2)}×
                  </output>
                </div>
                <div className="sz-atlas-legend" aria-label="Map legend">
                  <span><i className="sz-atlas-key-star" />Star</span>
                  <span><i className="sz-atlas-key-visited" />Visited</span>
                  <span><i className="sz-atlas-key-colony" />Colony</span>
                  <span><i className="sz-atlas-key-signal" />Signal</span>
                  <span><i className="sz-atlas-key-vessel" />Vessel</span>
                  <span><i className="sz-atlas-key-route" />Route</span>
                </div>
                <p className="sz-atlas-keys" aria-hidden="true">
                  <span><kbd>Drag</kbd> orbit</span>
                  <span><kbd>Wheel</kbd> zoom</span>
                  <span><kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> pan</span>
                  <span><kbd>Esc</kbd> close</span>
                </p>
                <details className="sz-atlas-plot">
                  <summary>PLOT COORDINATE</summary>
                  <form
                    data-coordinate-layout="wrapping"
                    className="sz-atlas-form"
                    onSubmit={submitCoordinate}
                    style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 110px), 1fr))", gap: 8, alignItems: "end" }}
                  >
                    {(["sectorX", "sectorY", "localX", "localY"] as const).map((field) => (
                      <label key={field}>
                        <span>{field.replace(/([A-Z])/g, " $1").toUpperCase()}</span>
                        <input
                          name={field}
                          type="number"
                          step="1"
                          value={coordinateInput[field]}
                          onChange={(event) => setCoordinateInput((current) => ({ ...current, [field]: event.target.value }))}
                        />
                      </label>
                    ))}
                    <Button type="submit">PLOT</Button>
                  </form>
                  {formError !== null && <p role="alert" className="sz-atlas-alert">{formError}</p>}
                </details>
              </div>
              <div role="status" aria-live="polite" className="sz-atlas-status">
                {statusMessage ?? (routeResult?.ok ? `ROUTE READY · ${selectedLabel}` : routeReasons[0] ?? `ATLAS READY · ${selectedLabel}`)}
              </div>
            </div>
          </main>

          <aside id="atlas-side" ref={asideRef} aria-label="Atlas panel" className="sz-atlas-side">
            <section className="sz-atlas-panel">
              <h2>CONTACTS <span className="sz-atlas-count">{contacts.length}</span></h2>
              <div role="listbox" aria-label="Atlas contacts" className="sz-atlas-contacts">
                {contacts.map((contact) => {
                  const selected = currentSelectedId === contact.targetId;
                  return (
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      tabIndex={contact.targetId === contactTabStopId ? 0 : -1}
                      data-atlas-contact={contact.targetId}
                      data-target-kind={contact.target.kind}
                      data-selected-target={selected ? currentSelectedId ?? undefined : undefined}
                      key={contact.targetId}
                      className="sz-atlas-contact"
                      onClick={() => {
                        const target = targetFromDomContact(contact.targetId, contacts);
                        if (target !== null) selectTarget(target);
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                        event.preventDefault();
                        const target = targetFromKeyboardContact(
                          contact.targetId,
                          event.key === "ArrowDown" ? "next" : "previous",
                          contacts,
                        );
                        if (target !== null && !run.activeTravel) {
                          selectTarget(target);
                          const id = selectedTargetIdFor(target);
                          const option = [...(rootRef.current?.querySelectorAll<HTMLElement>("[data-atlas-contact]") ?? [])]
                            .find(element => element.dataset.atlasContact === id);
                          option?.focus();
                          option?.scrollIntoView({ block: "nearest" });
                        }
                      }}
                    >
                      <strong>{contact.label}</strong>
                      <small data-knowledge={contact.knowledgeState}>{contact.knowledgeState.toUpperCase()}</small>
                      <span className="sz-atlas-sr"> · CONFIDENCE {contact.confidence.toUpperCase()} · {coordinateLabel(contact.coordinate)}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section
              aria-labelledby="atlas-target-heading"
              data-selected-target={currentSelectedId ?? undefined}
              className="sz-atlas-panel sz-atlas-detail"
            >
              <p className="sz-atlas-kicker">SELECTED TARGET</p>
              <h2
                id="atlas-target-heading"
                ref={detailsHeadingRef}
                tabIndex={-1}
              >
                {selectedLabel}
              </h2>
              {selectedContact && (
                <p className="sz-atlas-meta">
                  {selectedContact.knowledgeState.toUpperCase()} · CONFIDENCE {selectedContact.confidence.toUpperCase()} · {coordinateLabel(selectedContact.coordinate)}
                </p>
              )}
              {blindTarget && <p className="sz-atlas-blind">BLIND COORDINATE · UNKNOWN CONTRIBUTORS POSSIBLE</p>}

              {travel?.state === "interrupted" && activeInterruptionId !== null ? (
                <div data-selected-target={currentSelectedId ?? undefined}>
                  <h3 className="sz-atlas-alert">TRAVEL INTERRUPTED</h3>
                  <p>A saved military cause blocks this route. Launch it or retreat to the journaled origin.</p>
                  <div className="sz-atlas-contacts">
                    <Button disabled={!onLaunchOperation} onClick={() => onLaunchOperation?.(activeInterruptionId)}>
                      LAUNCH INTERCEPTION
                    </Button>
                    <Button disabled={!onRetreat} onClick={onRetreat}>RETREAT TO ORIGIN</Button>
                  </div>
                  <Journal transactionId={travel.transactionId} legs={travel.legs} />
                </div>
              ) : travel?.state === "diverted" && run.vessel.status === "stranded" ? (
                <div>
                  <h3 className="sz-atlas-alert">VESSEL STRANDED</h3>
                  <Button disabled={!onEmergencyRetreat} onClick={onEmergencyRetreat}>EMERGENCY RETREAT</Button>
                  <Journal transactionId={travel.transactionId} legs={travel.legs} />
                </div>
              ) : travel !== null ? (
                <div>
                  <h3>TRAVEL {travel.state.toUpperCase()}</h3>
                  {travel.state === "arrived" || travel.state === "resolved" ? (
                    <Button disabled={!onFinalizeTravel} onClick={onFinalizeTravel}>ACKNOWLEDGE ARRIVAL</Button>
                  ) : (
                    <Button disabled={!onResumeTravel} onClick={onResumeTravel}>RESUME TRAVEL</Button>
                  )}
                  <Journal transactionId={travel.transactionId} legs={travel.legs} />
                </div>
              ) : routePlan !== null ? (
                <div data-selected-target={currentSelectedId ?? undefined}>
                  <dl className="sz-atlas-facts sz-atlas-facts--grid">
                    <div><dt>DISTANCE</dt><dd>{routePlan.distanceUnits} UNITS</dd></div>
                    <div><dt>CYCLES</dt><dd>{routePlan.elapsedCycles}</dd></div>
                    <div><dt>SUPPLY</dt><dd>{routePlan.supplyCost} · RESERVE {routePlan.projectedReserve}</dd></div>
                    <div><dt>CONFIDENCE</dt><dd>{routePlan.threat.overall.confidence.toUpperCase()}</dd></div>
                  </dl>
                  <p className="sz-atlas-threat" style={{ color: bandColor(routePlan.threat.overall.band) }}>{routePlan.threat.overall.presentation}</p>
                  <details className="sz-atlas-breakdown">
                    <summary>THREAT BREAKDOWN</summary>
                    <dl className="sz-atlas-facts">
                      {THREAT_DIMENSIONS.map((dimension) => (
                        <React.Fragment key={dimension}>
                          <dt>{dimension.toUpperCase()}</dt>
                          <dd style={{ color: bandColor(routePlan.threat.dimensions[dimension].band) }}>
                            {routePlan.threat.dimensions[dimension].band.toUpperCase()} · {routePlan.threat.dimensions[dimension].confidence.toUpperCase()}
                            {routePlan.threat.dimensions[dimension].unknownContributors.length > 0 ? " · UNKNOWN CONTRIBUTORS" : ""}
                          </dd>
                        </React.Fragment>
                      ))}
                    </dl>
                  </details>
                  <Button
                    data-selected-target={currentSelectedId ?? undefined}
                    disabled={!onCommitTravel}
                    onClick={() => onCommitTravel?.(routePlan)}
                    className="sz-atlas-button-wide"
                  >
                    COMMIT TRAVEL
                  </Button>
                  <Journal transactionId={null} legs={routePlan.legs} />
                </div>
              ) : (
                <div>
                  {routeReasons.length > 0 ? (
                    <div role="alert">
                      <h3 className="sz-atlas-alert">ROUTE BLOCKED</h3>
                      <ul>{routeReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                    </div>
                  ) : <p>SELECT A KNOWN CONTACT OR PLOT A COORDINATE.</p>}
                  <Button disabled>COMMIT TRAVEL</Button>
                </div>
              )}

              {selectedOperation !== null && travel?.state !== "interrupted" && (
                <div>
                  <h3>LOCATED OPERATION</h3>
                  <p>{selectedOperation.objective.label.toUpperCase()}</p>
                  <Button
                    disabled={selectedOperation.availability.status !== "available" || !onLaunchOperation}
                    onClick={() => onLaunchOperation?.(selectedOperation.id)}
                  >
                    LAUNCH OPERATION
                  </Button>
                  {selectedOperation.availability.status === "unavailable" && (
                    <p className="sz-atlas-note">
                      UNAVAILABLE · {selectedOperation.availability.reasons.join(", ").replaceAll("_", " ").toUpperCase()}
                    </p>
                  )}
                </div>
              )}

              {descendColonyId !== null && (
                <div className="sz-atlas-region">
                  <Button
                    disabled={!descendable}
                    aria-describedby={descendAccess.status === "unavailable" ? "atlas-descend-note" : undefined}
                    onClick={() => onDescendToColony?.(descendColonyId)}
                  >
                    DESCEND TO COLONY
                  </Button>
                  {descendAccess.status === "unavailable" && (
                    <p id="atlas-descend-note" className="sz-atlas-note">{descendAccess.reason}</p>
                  )}
                </div>
              )}

              {targetContactId === REGION_CONTACT_ID && (
                <div className="sz-atlas-region">
                  <Button
                    disabled={!regionOpenable}
                    aria-describedby={regionPanelNote ? "atlas-region-panel-note" : undefined}
                    onClick={onOpenAshfallRegion}
                  >
                    {regionAccess.status === "view" ? "VIEW ASHFALL REGION" : "OPEN ASHFALL REGION"}
                  </Button>
                  {regionPanelNote && <p id="atlas-region-panel-note" className="sz-atlas-note">{regionPanelNote}</p>}
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function planPick(field: HTMLElement, clientX: number, clientY: number): { x: number; z: number } | null {
  const rect = field.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const nx = (clientX - rect.left) / rect.width;
  const nz = (clientY - rect.top) / rect.height;
  if (nx < 0 || nz < 0 || nx > 1 || nz > 1) return null;
  return {
    x: (nx - 0.5) * SECTOR_SCENE_SIZE,
    z: (nz - 0.5) * SECTOR_SCENE_SIZE,
  };
}

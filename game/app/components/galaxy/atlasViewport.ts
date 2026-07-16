import { G0_SECTOR_BOUNDS } from "../engine/galaxy/atlas";
import {
  coord,
  coordinateKey,
  validateCoordinate,
} from "../engine/galaxy/coordinates";
import type {
  AtlasViewLevel,
  GalaxyCoordinate,
} from "../engine/galaxy/galaxyTypes";
import type { AtlasTarget } from "../engine/galaxy/routePlanner";

export const ATLAS_ZOOM_MIN = 0.1;
export const ATLAS_ZOOM_MAX = 4;
export const ATLAS_DEFAULT_ZOOM = ATLAS_ZOOM_MIN;
export const ATLAS_PAN_STEP_UNITS = G0_SECTOR_BOUNDS.cellSize;
export const ATLAS_CONTACT_HIT_RADIUS_PX = 20;

export interface AtlasViewLevelMetadata {
  purpose:
    | "non-interactive-frame"
    | "functional-field"
    | "selected-contact-detail"
    | "ashfall-handoff";
  fieldInteractive: boolean;
  handoffContactId: string | null;
}

export const ATLAS_VIEW_LEVEL_METADATA: Readonly<
  Record<AtlasViewLevel, Readonly<AtlasViewLevelMetadata>>
> = Object.freeze({
  galaxy: Object.freeze({
    purpose: "non-interactive-frame",
    fieldInteractive: false,
    handoffContactId: null,
  }),
  sector: Object.freeze({
    purpose: "functional-field",
    fieldInteractive: true,
    handoffContactId: null,
  }),
  system: Object.freeze({
    purpose: "selected-contact-detail",
    fieldInteractive: false,
    handoffContactId: null,
  }),
  region: Object.freeze({
    purpose: "ashfall-handoff",
    fieldInteractive: false,
    handoffContactId: "contact:ashfall",
  }),
});

export interface AtlasViewportState {
  viewLevel: AtlasViewLevel;
  center: GalaxyCoordinate;
  zoom: number;
  selectedTargetId: string | null;
}

export type AtlasViewportAction =
  | { type: "set-view"; viewLevel: AtlasViewLevel }
  | { type: "pan"; deltaX: number; deltaY: number }
  | { type: "zoom"; zoom: number }
  | { type: "select-contact"; targetId: string }
  | { type: "select-coordinate"; coordinate: GalaxyCoordinate };

export interface ViewportSize {
  width: number;
  height: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface AtlasViewportContact {
  targetId: string;
  contactId: string;
  coordinate: GalaxyCoordinate;
}

export interface AtlasCoordinateFormInput {
  sectorX: string | number;
  sectorY: string | number;
  localX: string | number;
  localY: string | number;
}

export type AtlasPanDirection = "left" | "right" | "up" | "down";
export type AtlasKeyboardDirection = "next" | "previous";

const VIEW_LEVELS: readonly AtlasViewLevel[] = Object.freeze([
  "galaxy",
  "sector",
  "system",
  "region",
]);

const DEFAULT_CENTER = Object.freeze(coord(0, 0, 2048, 2048));

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function clampZoom(zoom: number): number {
  return clamp(zoom, ATLAS_ZOOM_MIN, ATLAS_ZOOM_MAX);
}

function isG0Coordinate(value: unknown): value is GalaxyCoordinate {
  if (!validateCoordinate(value).ok) return false;
  const coordinate = value as GalaxyCoordinate;
  return (
    coordinate.sectorX === 0 &&
    coordinate.sectorY === 0 &&
    coordinate.localX >= G0_SECTOR_BOUNDS.min &&
    coordinate.localX <= G0_SECTOR_BOUNDS.max &&
    coordinate.localY >= G0_SECTOR_BOUNDS.min &&
    coordinate.localY <= G0_SECTOR_BOUNDS.max
  );
}

function cloneCoordinate(coordinate: GalaxyCoordinate): GalaxyCoordinate {
  return coord(
    coordinate.sectorX,
    coordinate.sectorY,
    coordinate.localX,
    coordinate.localY,
  );
}

function assertG0Coordinate(
  coordinate: unknown,
): asserts coordinate is GalaxyCoordinate {
  if (!isG0Coordinate(coordinate)) {
    throw new RangeError("Atlas coordinate must be a fixed-point point in G0");
  }
}

function assertViewportSize(size: ViewportSize): void {
  if (
    !Number.isFinite(size.width) ||
    !Number.isFinite(size.height) ||
    size.width <= 0 ||
    size.height <= 0
  ) {
    throw new RangeError("Atlas viewport dimensions must be positive and finite");
  }
}

function assertScreenPoint(point: ScreenPoint): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new RangeError("Atlas screen point must be finite");
  }
}

function isViewLevel(value: unknown): value is AtlasViewLevel {
  return VIEW_LEVELS.includes(value as AtlasViewLevel);
}

function isValidTargetId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function createAtlasViewportState(
  initial: Partial<AtlasViewportState> = {},
): AtlasViewportState {
  const viewLevel = initial.viewLevel ?? "sector";
  const center = initial.center ?? DEFAULT_CENTER;
  const zoom = initial.zoom ?? ATLAS_DEFAULT_ZOOM;
  const selectedTargetId = initial.selectedTargetId ?? null;

  if (!isViewLevel(viewLevel)) {
    throw new RangeError("Unknown Atlas view level");
  }
  assertG0Coordinate(center);
  if (!Number.isFinite(zoom) || zoom <= 0) {
    throw new RangeError("Atlas zoom must be positive and finite");
  }
  if (selectedTargetId !== null && !isValidTargetId(selectedTargetId)) {
    throw new RangeError("Atlas selected target ID must be non-empty");
  }

  return {
    viewLevel,
    center: cloneCoordinate(center),
    zoom: clampZoom(zoom),
    selectedTargetId,
  };
}

function fieldInputEnabled(state: AtlasViewportState): boolean {
  return ATLAS_VIEW_LEVEL_METADATA[state.viewLevel].fieldInteractive;
}

export function selectedTargetIdFor(target: AtlasTarget): string {
  if (target.kind === "contact") return target.contactId;
  return `coordinate:${coordinateKey(target.coordinate)}`;
}

export function atlasViewportReducer(
  state: AtlasViewportState,
  action: AtlasViewportAction,
): AtlasViewportState {
  if (action.type === "set-view") {
    if (!isViewLevel(action.viewLevel) || state.viewLevel === action.viewLevel) {
      return state;
    }
    return { ...state, viewLevel: action.viewLevel };
  }

  if (!fieldInputEnabled(state)) return state;

  switch (action.type) {
    case "pan": {
      if (!Number.isFinite(action.deltaX) || !Number.isFinite(action.deltaY)) {
        return state;
      }
      const localX = Math.round(
        clamp(
          state.center.localX + action.deltaX,
          G0_SECTOR_BOUNDS.min,
          G0_SECTOR_BOUNDS.max,
        ),
      );
      const localY = Math.round(
        clamp(
          state.center.localY + action.deltaY,
          G0_SECTOR_BOUNDS.min,
          G0_SECTOR_BOUNDS.max,
        ),
      );
      if (
        localX === state.center.localX &&
        localY === state.center.localY
      ) {
        return state;
      }
      return {
        ...state,
        center: coord(
          state.center.sectorX,
          state.center.sectorY,
          localX,
          localY,
        ),
      };
    }
    case "zoom": {
      if (!Number.isFinite(action.zoom) || action.zoom <= 0) return state;
      const zoom = clampZoom(action.zoom);
      return zoom === state.zoom ? state : { ...state, zoom };
    }
    case "select-contact":
      if (!isValidTargetId(action.targetId)) return state;
      return action.targetId === state.selectedTargetId
        ? state
        : { ...state, selectedTargetId: action.targetId };
    case "select-coordinate":
      if (!isG0Coordinate(action.coordinate)) return state;
      return {
        ...state,
        selectedTargetId: selectedTargetIdFor({
          kind: "coordinate",
          coordinate: action.coordinate,
        }),
      };
  }
}

export function worldToScreen(
  coordinate: GalaxyCoordinate,
  state: AtlasViewportState,
  size: ViewportSize,
): ScreenPoint {
  assertG0Coordinate(coordinate);
  assertG0Coordinate(state.center);
  assertViewportSize(size);
  if (!Number.isFinite(state.zoom) || state.zoom <= 0) {
    throw new RangeError("Atlas zoom must be positive and finite");
  }

  return {
    x: size.width / 2 + (coordinate.localX - state.center.localX) * state.zoom,
    y:
      size.height / 2 + (coordinate.localY - state.center.localY) * state.zoom,
  };
}

export function screenToWorld(
  point: ScreenPoint,
  state: AtlasViewportState,
  size: ViewportSize,
): GalaxyCoordinate {
  assertScreenPoint(point);
  assertG0Coordinate(state.center);
  assertViewportSize(size);
  if (!Number.isFinite(state.zoom) || state.zoom <= 0) {
    throw new RangeError("Atlas zoom must be positive and finite");
  }

  return coord(
    state.center.sectorX,
    state.center.sectorY,
    Math.round(
      clamp(
        state.center.localX + (point.x - size.width / 2) / state.zoom,
        G0_SECTOR_BOUNDS.min,
        G0_SECTOR_BOUNDS.max,
      ),
    ),
    Math.round(
      clamp(
        state.center.localY + (point.y - size.height / 2) / state.zoom,
        G0_SECTOR_BOUNDS.min,
        G0_SECTOR_BOUNDS.max,
      ),
    ),
  );
}

function isValidContact(value: AtlasViewportContact): boolean {
  return (
    isValidTargetId(value.targetId) &&
    isValidTargetId(value.contactId) &&
    isG0Coordinate(value.coordinate)
  );
}

function contactTarget(contact: AtlasViewportContact): AtlasTarget {
  return { kind: "contact", contactId: contact.contactId };
}

function nearestContact(
  point: ScreenPoint,
  state: AtlasViewportState,
  size: ViewportSize,
  contacts: readonly AtlasViewportContact[],
  hitRadiusPx: number,
): AtlasViewportContact | null {
  if (!Number.isFinite(hitRadiusPx) || hitRadiusPx < 0) {
    throw new RangeError("Atlas contact hit radius must be finite and non-negative");
  }

  const candidates = contacts
    .filter(isValidContact)
    .map((contact) => {
      const projected = worldToScreen(contact.coordinate, state, size);
      return {
        contact,
        distance: Math.hypot(projected.x - point.x, projected.y - point.y),
      };
    })
    .filter((candidate) => candidate.distance <= hitRadiusPx)
    .sort(
      (left, right) =>
        left.distance - right.distance ||
        left.contact.targetId.localeCompare(right.contact.targetId),
    );

  return candidates[0]?.contact ?? null;
}

export function targetFromPointer(
  point: ScreenPoint,
  state: AtlasViewportState,
  size: ViewportSize,
  contacts: readonly AtlasViewportContact[],
  hitRadiusPx = ATLAS_CONTACT_HIT_RADIUS_PX,
): AtlasTarget {
  assertScreenPoint(point);
  const contact = nearestContact(point, state, size, contacts, hitRadiusPx);
  if (contact !== null) return contactTarget(contact);
  return { kind: "coordinate", coordinate: screenToWorld(point, state, size) };
}

export function targetFromTouch(
  point: ScreenPoint,
  state: AtlasViewportState,
  size: ViewportSize,
  contacts: readonly AtlasViewportContact[],
  hitRadiusPx = ATLAS_CONTACT_HIT_RADIUS_PX,
): AtlasTarget {
  return targetFromPointer(point, state, size, contacts, hitRadiusPx);
}

export function targetFromDomContact(
  targetId: string,
  contacts: readonly AtlasViewportContact[],
): AtlasTarget | null {
  const contact = contacts.find(
    (candidate) =>
      isValidContact(candidate) && candidate.targetId === targetId,
  );
  return contact === undefined ? null : contactTarget(contact);
}

export function targetFromKeyboardContact(
  currentTargetId: string | null,
  direction: AtlasKeyboardDirection,
  contacts: readonly AtlasViewportContact[],
): AtlasTarget | null {
  const available = contacts.filter(isValidContact);
  if (available.length === 0) return null;

  const currentIndex = available.findIndex(
    (contact) => selectedTargetIdFor(contactTarget(contact)) === currentTargetId,
  );
  const offset = direction === "previous" ? -1 : 1;
  const baseIndex =
    currentIndex >= 0
      ? currentIndex
      : direction === "previous"
        ? 0
        : -1;
  const nextIndex = (baseIndex + offset + available.length) % available.length;
  return contactTarget(available[nextIndex]);
}

function parseSafeInteger(value: string | number): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? value : null;
  }
  const normalized = value.trim();
  if (!/^[+-]?\d+$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function targetFromCoordinateForm(
  input: AtlasCoordinateFormInput,
): AtlasTarget | null {
  const sectorX = parseSafeInteger(input.sectorX);
  const sectorY = parseSafeInteger(input.sectorY);
  const localX = parseSafeInteger(input.localX);
  const localY = parseSafeInteger(input.localY);
  if (
    sectorX === null ||
    sectorY === null ||
    localX === null ||
    localY === null
  ) {
    return null;
  }

  const coordinate = { sectorX, sectorY, localX, localY };
  return isG0Coordinate(coordinate)
    ? { kind: "coordinate", coordinate: cloneCoordinate(coordinate) }
    : null;
}

function panActionForDirection(
  direction: AtlasPanDirection,
): Extract<AtlasViewportAction, { type: "pan" }> {
  switch (direction) {
    case "left":
      return { type: "pan", deltaX: -ATLAS_PAN_STEP_UNITS, deltaY: 0 };
    case "right":
      return { type: "pan", deltaX: ATLAS_PAN_STEP_UNITS, deltaY: 0 };
    case "up":
      return { type: "pan", deltaX: 0, deltaY: -ATLAS_PAN_STEP_UNITS };
    case "down":
      return { type: "pan", deltaX: 0, deltaY: ATLAS_PAN_STEP_UNITS };
  }
}

export function panActionFromArrowKey(
  key: string,
): Extract<AtlasViewportAction, { type: "pan" }> | null {
  const directionByKey: Readonly<Record<string, AtlasPanDirection>> = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    ArrowDown: "down",
  };
  const direction = directionByKey[key];
  return direction === undefined ? null : panActionForDirection(direction);
}

export function panActionFromTouchControl(
  direction: AtlasPanDirection,
): Extract<AtlasViewportAction, { type: "pan" }> {
  return panActionForDirection(direction);
}

export function zoomAction(
  zoom: number,
): Extract<AtlasViewportAction, { type: "zoom" }> {
  if (!Number.isFinite(zoom) || zoom <= 0) {
    throw new RangeError("Atlas zoom action must be positive and finite");
  }
  return { type: "zoom", zoom: clampZoom(zoom) };
}

export function zoomActionFromPinch(
  initialDistance: number,
  currentDistance: number,
  currentZoom: number,
): Extract<AtlasViewportAction, { type: "zoom" }> {
  if (
    !Number.isFinite(initialDistance) ||
    !Number.isFinite(currentDistance) ||
    initialDistance <= 0 ||
    currentDistance <= 0
  ) {
    return zoomAction(currentZoom);
  }
  return zoomAction(currentZoom * (currentDistance / initialDistance));
}

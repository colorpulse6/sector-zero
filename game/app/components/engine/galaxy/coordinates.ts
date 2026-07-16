import type {
  CoordinateValidationResult,
  GalaxyCellAddress,
  GalaxyCoordinate,
} from "./galaxyTypes";

const CELL_SIZE_UNITS = 256;
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const COORDINATE_FIELDS = ["sectorX", "sectorY", "localX", "localY"] as const;

export function validateCoordinate(value: unknown): CoordinateValidationResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, error: "coordinate must be an object" };
  }

  const candidate = value as Record<string, unknown>;
  for (const field of COORDINATE_FIELDS) {
    if (!Number.isSafeInteger(candidate[field])) {
      return { ok: false, error: `${field} must be a safe integer` };
    }
  }

  return { ok: true };
}

function assertCoordinate(value: unknown): asserts value is GalaxyCoordinate {
  const validation = validateCoordinate(value);
  if (!validation.ok) {
    throw new RangeError(`Invalid galaxy coordinate: ${validation.error}`);
  }
}

export function coord(
  sectorX: number,
  sectorY: number,
  localX: number,
  localY: number,
): GalaxyCoordinate {
  const coordinate: GalaxyCoordinate = { sectorX, sectorY, localX, localY };
  assertCoordinate(coordinate);
  return coordinate;
}

export function coordinateKey(coordinate: GalaxyCoordinate): string {
  assertCoordinate(coordinate);
  return `${coordinate.sectorX}:${coordinate.sectorY}:${coordinate.localX}:${coordinate.localY}`;
}

export function cellAddress(coordinate: GalaxyCoordinate): GalaxyCellAddress {
  assertCoordinate(coordinate);
  return {
    sectorX: coordinate.sectorX,
    sectorY: coordinate.sectorY,
    cellX: Math.floor(coordinate.localX / CELL_SIZE_UNITS),
    cellY: Math.floor(coordinate.localY / CELL_SIZE_UNITS),
  };
}

export function cellKey(coordinate: GalaxyCoordinate): string {
  const address = cellAddress(coordinate);
  return `${address.sectorX}:${address.sectorY}:${address.cellX}:${address.cellY}`;
}

export function sameCoordinate(
  left: GalaxyCoordinate,
  right: GalaxyCoordinate,
): boolean {
  assertCoordinate(left);
  assertCoordinate(right);
  return (
    left.sectorX === right.sectorX &&
    left.sectorY === right.sectorY &&
    left.localX === right.localX &&
    left.localY === right.localY
  );
}

export function distanceUnits(
  left: GalaxyCoordinate,
  right: GalaxyCoordinate,
): number {
  assertCoordinate(left);
  assertCoordinate(right);
  if (left.sectorX !== right.sectorX || left.sectorY !== right.sectorY) {
    throw new RangeError(
      "Cannot measure fixed-point distance across different sectors",
    );
  }

  return Math.hypot(right.localX - left.localX, right.localY - left.localY);
}

/**
 * Returns an unsigned FNV-1a-style hash over JavaScript UTF-16 code units.
 * Surrogate pairs are deliberately processed as two code units so the result
 * is independent of text encoders and browser APIs.
 */
export function stableHash(value: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
}

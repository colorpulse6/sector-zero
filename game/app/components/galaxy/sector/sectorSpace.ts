import { G0_SECTOR_BOUNDS } from "../../engine/galaxy/atlas";
import { coord } from "../../engine/galaxy/coordinates";
import type { GalaxyCoordinate } from "../../engine/galaxy/galaxyTypes";

/**
 * Mapping between authoritative integer sector coordinates and Babylon scene units.
 *
 * The 4096-unit G0 sector spans SECTOR_SCENE_SIZE units on the scene's XZ plane with the
 * sector centre at the origin. Scene positions are projections only; nothing here is saved.
 */

export const SECTOR_SCENE_SIZE = 40;

const SECTOR_UNITS = G0_SECTOR_BOUNDS.max - G0_SECTOR_BOUNDS.min + 1;
const SECTOR_CENTRE = (G0_SECTOR_BOUNDS.max + G0_SECTOR_BOUNDS.min + 1) / 2;
const UNITS_PER_SCENE = SECTOR_UNITS / SECTOR_SCENE_SIZE;

export function toScene(coordinate: GalaxyCoordinate): { x: number; z: number } {
  return {
    x: (coordinate.localX - SECTOR_CENTRE) / UNITS_PER_SCENE,
    z: (coordinate.localY - SECTOR_CENTRE) / UNITS_PER_SCENE,
  };
}

function clamp(value: number): number {
  return Math.min(G0_SECTOR_BOUNDS.max, Math.max(G0_SECTOR_BOUNDS.min, value));
}

/** Scene point → nearest integer coordinate inside the sector. */
export function fromScene(
  x: number,
  z: number,
  sector: { sectorX: number; sectorY: number } = { sectorX: 0, sectorY: 0 },
): GalaxyCoordinate {
  return coord(
    sector.sectorX,
    sector.sectorY,
    Math.round(clamp(x * UNITS_PER_SCENE + SECTOR_CENTRE)),
    Math.round(clamp(z * UNITS_PER_SCENE + SECTOR_CENTRE)),
  );
}

/** One 256-unit atlas cell in scene units. */
export function cellSceneSize(): number {
  return G0_SECTOR_BOUNDS.cellSize / UNITS_PER_SCENE;
}

/** Scene units per authoritative unit, for hit radii and zoom mapping. */
export function sceneUnitsPerCoordinateUnit(): number {
  return 1 / UNITS_PER_SCENE;
}

/**
 * Camera radius for an `atlasViewport` zoom. zoom 4 (closest) → 8 units; zoom 0.1 (whole
 * sector) → 60 units. Logarithmic so each wheel step feels even.
 */
export function cameraRadiusForZoom(zoom: number): number {
  const clamped = Math.min(4, Math.max(0.1, zoom));
  const t = Math.log(clamped / 0.1) / Math.log(4 / 0.1);
  return 60 - t * (60 - 8);
}

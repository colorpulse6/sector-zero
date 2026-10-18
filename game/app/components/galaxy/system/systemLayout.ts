import { planetScenePosition, type StarSystem, type SystemNeighbour } from "./starSystems";

/**
 * Flat plan of a system in 0–100 % field coordinates. Used before the WebGL scene is ready,
 * when WebGL is unavailable, and in server rendering. Pure and deterministic.
 */

export interface LandmarkPlan {
  id: string;
  kind: "planet" | "system";
  x: number;
  y: number;
}

/** Ellipse squash for the flat plan so orbits read as a tilted table. */
export const PLAN_TILT = 0.62;
/** Max orbit radius in scene units maps to this many percent of the field width. */
const PLAN_SCALE = 10.4;
/** Neighbour systems sit on this ring (percent of field half-size). */
export const NEIGHBOUR_RING_PERCENT = 44;

export function clampToEdgeRing(bearing: number, radiusPercent: number = NEIGHBOUR_RING_PERCENT): { x: number; y: number } {
  return {
    x: Number((50 + Math.cos(bearing) * radiusPercent).toFixed(2)),
    y: Number((50 + Math.sin(bearing) * radiusPercent * PLAN_TILT).toFixed(2)),
  };
}

export function planSystemLayout(system: StarSystem, neighbours: readonly SystemNeighbour[], cycle: number): LandmarkPlan[] {
  const planets = system.planets.map(planet => {
    const position = planetScenePosition(planet, cycle, 0);
    return {
      id: `planet:${planet.planetId}`,
      kind: "planet" as const,
      x: Number((50 + position.x * PLAN_SCALE).toFixed(2)),
      y: Number((50 + position.z * PLAN_SCALE * PLAN_TILT).toFixed(2)),
    };
  });
  const systems = neighbours.map(neighbour => {
    const point = clampToEdgeRing(neighbour.bearing);
    return { id: neighbour.system.id, kind: "system" as const, x: point.x, y: point.y };
  });
  return [...planets, ...systems];
}

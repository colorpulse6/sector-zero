import type { PlanetBiome } from "../shared/colonyTypes";

/**
 * Deterministic decorative terrain for the region chart.
 *
 * Everything here is presentation only: contour rings, ridge lines and dust
 * specks derived from the region seed so the same planet always draws the same
 * chart. Nothing in this module reads or writes save state.
 */

export interface TerrainPalette {
  /** Chart floor colour. */
  base: string;
  /** Darker floor tone used for the outer vignette. */
  deep: string;
  /** Elevation contour stroke. */
  contour: string;
  /** Ridge / feature stroke. */
  ridge: string;
  /** Warm or cold haze glow laid over the floor. */
  haze: string;
  /** Grid line colour. */
  grid: string;
  /** Human label for the legend strip. */
  label: string;
}

export const BIOME_PALETTES: Record<PlanetBiome, TerrainPalette> = {
  desert: { base: "#141008", deep: "#090705", contour: "#8a5a22", ridge: "#c47a2a", haze: "rgba(214, 140, 52, .16)", grid: "rgba(214, 160, 90, .08)", label: "Desert basin" },
  volcanic: { base: "#160a08", deep: "#0a0504", contour: "#8a2a1e", ridge: "#ff5a36", haze: "rgba(255, 90, 54, .14)", grid: "rgba(255, 120, 90, .07)", label: "Volcanic plain" },
  ice: { base: "#0a1218", deep: "#05090d", contour: "#3f7a99", ridge: "#9adcff", haze: "rgba(140, 210, 255, .14)", grid: "rgba(160, 220, 255, .07)", label: "Ice shelf" },
  ocean: { base: "#061018", deep: "#03080c", contour: "#1f5f80", ridge: "#3fb3e0", haze: "rgba(60, 170, 220, .14)", grid: "rgba(90, 190, 230, .07)", label: "Archipelago" },
  jungle: { base: "#08140a", deep: "#040a05", contour: "#2f7a3a", ridge: "#5fd36a", haze: "rgba(90, 210, 110, .12)", grid: "rgba(120, 220, 140, .07)", label: "Jungle canopy" },
  urban: { base: "#0d0f16", deep: "#06070b", contour: "#4a5570", ridge: "#9fb0d8", haze: "rgba(160, 180, 230, .12)", grid: "rgba(170, 190, 240, .08)", label: "Urban sprawl" },
  barren: { base: "#100f0e", deep: "#070706", contour: "#5f5a52", ridge: "#a39a8c", haze: "rgba(170, 160, 140, .12)", grid: "rgba(190, 180, 160, .07)", label: "Barren crust" },
  toxic: { base: "#0d1208", deep: "#060904", contour: "#6f8a1e", ridge: "#b8e03a", haze: "rgba(180, 220, 60, .12)", grid: "rgba(190, 230, 90, .07)", label: "Toxic flats" },
};

export interface ContourRing {
  /** SVG polygon points in a 0–100 chart space. */
  points: string;
  /** Stroke alpha, inner rings are brighter. */
  alpha: number;
}

export interface RidgeLine {
  /** SVG polyline points in a 0–100 chart space. */
  points: string;
  alpha: number;
}

export interface DustSpeck {
  x: number;
  y: number;
  r: number;
  alpha: number;
}

export interface RegionTerrain {
  contours: ContourRing[];
  ridges: RidgeLine[];
  specks: DustSpeck[];
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function fixed(value: number): string {
  return value.toFixed(2);
}

/**
 * Generates terrain for a region. The output is a pure function of the seed
 * and biome, so snapshots are stable across reloads and sessions.
 */
export function generateRegionTerrain(seed: number, biome: PlanetBiome): RegionTerrain {
  const rand = mulberry32(seed ^ biome.length * 7919);
  const contours: ContourRing[] = [];
  const massifCount = 3 + Math.floor(rand() * 2);
  for (let massif = 0; massif < massifCount; massif++) {
    const cx = 15 + rand() * 70;
    const cy = 15 + rand() * 70;
    const baseRadius = 9 + rand() * 11;
    const rings = 3 + Math.floor(rand() * 3);
    const lobes = 2 + Math.floor(rand() * 3);
    const phase = rand() * Math.PI * 2;
    const stretchX = 0.8 + rand() * 0.6;
    const stretchY = 0.8 + rand() * 0.6;
    const wobble = 0.1 + rand() * 0.14;
    for (let ring = 0; ring < rings; ring++) {
      const radius = baseRadius * (1 - ring / (rings + 0.6));
      const vertices: string[] = [];
      const steps = 28;
      for (let step = 0; step < steps; step++) {
        const angle = (step / steps) * Math.PI * 2;
        const noise = 1 + Math.sin(angle * lobes + phase) * wobble + (rand() - 0.5) * 0.05;
        vertices.push(`${fixed(cx + Math.cos(angle) * radius * stretchX * noise)},${fixed(cy + Math.sin(angle) * radius * stretchY * noise)}`);
      }
      contours.push({ points: vertices.join(" "), alpha: 0.22 + (ring / rings) * 0.3 });
    }
  }

  const ridges: RidgeLine[] = [];
  const ridgeCount = 5 + Math.floor(rand() * 3);
  for (let ridge = 0; ridge < ridgeCount; ridge++) {
    const startX = rand() * 100;
    const startY = rand() * 100;
    const heading = rand() * Math.PI * 2;
    const length = 18 + rand() * 30;
    const bend = (rand() - 0.5) * 0.9;
    const vertices: string[] = [];
    const steps = 10;
    for (let step = 0; step <= steps; step++) {
      const t = step / steps;
      const angle = heading + bend * t;
      const x = startX + Math.cos(angle) * length * t + Math.sin(t * Math.PI * 2) * 1.5;
      const y = startY + Math.sin(angle) * length * t;
      vertices.push(`${fixed(x)},${fixed(y)}`);
    }
    ridges.push({ points: vertices.join(" "), alpha: 0.18 + rand() * 0.22 });
  }

  const specks: DustSpeck[] = [];
  const speckCount = 42;
  for (let speck = 0; speck < speckCount; speck++) {
    specks.push({
      x: Number(fixed(rand() * 100)),
      y: Number(fixed(rand() * 100)),
      r: Number(fixed(0.15 + rand() * 0.35)),
      alpha: Number(fixed(0.15 + rand() * 0.35)),
    });
  }

  return { contours, ridges, specks };
}

import type { PlanetId } from "../../engine/types";
import { PLANET_DEFS } from "../../engine/planets";

/**
 * Seeded star-system catalogue for the System Atlas.
 *
 * Presentation-era test seed: five systems carry the ten catalogue planets. Everything is a
 * pure function of SYSTEM_ATLAS_SEED, so the same systems render the same way every time.
 * Nothing here reads or writes save state, travel, or cycle costs.
 */

export const SYSTEM_ATLAS_SEED = 7331;

export type StarClass = "O" | "B" | "A" | "F" | "G" | "K" | "M";
export type SystemKnowledge = "home" | "charted" | "signal";

export interface SystemPlanet {
  planetId: PlanetId;
  /** Scene units from the star, 1.0 … 4.5. */
  orbitRadius: number;
  /** Radians at cycle 0. */
  orbitPhase: number;
  /** Cycles per revolution; decorative drift only. */
  orbitPeriod: number;
  /** Scene units, 0.12 … 0.32. */
  radius: number;
}

export interface StarSystem {
  id: string;
  name: string;
  starClass: StarClass;
  starColor: string;
  /** Sector-plane units; the home system sits at the origin. */
  position: { x: number; y: number };
  knowledge: SystemKnowledge;
  planets: SystemPlanet[];
}

export interface SystemNeighbour {
  system: StarSystem;
  distanceUnits: number;
  /** Radians, measured from +x towards +y. */
  bearing: number;
}

function hashText(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(seed: number, salt: string): number {
  let value = (seed ^ hashText(salt)) >>> 0;
  value += 0x6d2b79f5;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

export const STAR_COLORS: Record<StarClass, string> = {
  O: "#9bb0ff",
  B: "#aabfff",
  A: "#cad8ff",
  F: "#f8f7ff",
  G: "#fff4e8",
  K: "#ffd2a1",
  M: "#ffb56b",
};

interface SystemSeed {
  id: string;
  name: string;
  starClass: StarClass;
  position: { x: number; y: number };
  knowledge: SystemKnowledge;
  planetIds: PlanetId[];
}

const SYSTEM_SEEDS: readonly SystemSeed[] = [
  { id: "system:ashfall-reach", name: "Ashfall Reach", starClass: "G", position: { x: 0, y: 0 }, knowledge: "home", planetIds: ["ashfall", "ossuary", "pyraxis"] },
  { id: "system:verdant-chain", name: "Verdant Chain", starClass: "K", position: { x: -260, y: -190 }, knowledge: "charted", planetIds: ["verdania", "genesis"] },
  { id: "system:glaciem-drift", name: "Glaciem Drift", starClass: "A", position: { x: 310, y: -120 }, knowledge: "charted", planetIds: ["glaciem", "abyssia"] },
  { id: "system:luminos-core", name: "Luminos Core", starClass: "B", position: { x: 90, y: 360 }, knowledge: "charted", planetIds: ["luminos", "bastion"] },
  { id: "system:prismara-veil", name: "Prismara Veil", starClass: "M", position: { x: -340, y: 240 }, knowledge: "signal", planetIds: ["prismara"] },
];

export function buildPlanets(seed: number, systemId: string, planetIds: PlanetId[]): SystemPlanet[] {
  const count = planetIds.length;
  return planetIds.map((planetId, index) => {
    const salt = `${systemId}:${planetId}`;
    // Spread orbits evenly between 1.4 and 4.2 units with a little seeded jitter so systems
    // never look like identical rings.
    const base = count === 1 ? 2.6 : 1.4 + (index / (count - 1)) * 2.8;
    return {
      planetId,
      orbitRadius: Number((base + (seededUnit(seed, `${salt}:r`) - 0.5) * 0.4).toFixed(3)),
      orbitPhase: Number((seededUnit(seed, `${salt}:phase`) * Math.PI * 2).toFixed(4)),
      orbitPeriod: Math.round(40 + seededUnit(seed, `${salt}:period`) * 160 + index * 60),
      radius: Number((0.12 + seededUnit(seed, `${salt}:size`) * 0.2).toFixed(3)),
    };
  });
}

function buildSystems(seed: number): StarSystem[] {
  return SYSTEM_SEEDS.map(entry => ({
    id: entry.id,
    name: entry.name,
    starClass: entry.starClass,
    starColor: STAR_COLORS[entry.starClass],
    position: { ...entry.position },
    knowledge: entry.knowledge,
    planets: buildPlanets(seed, entry.id, entry.planetIds),
  }));
}

export const STAR_SYSTEMS: readonly StarSystem[] = Object.freeze(buildSystems(SYSTEM_ATLAS_SEED));

/**
 * A set of systems the atlas can show. The seeded catalogue is the default; the Galaxy Atlas
 * builds one from the live galaxy run (see `contactSystems.ts`).
 */
export interface SystemCatalogue {
  systems: readonly StarSystem[];
  homeId: string;
}

export const DEFAULT_CATALOGUE: SystemCatalogue = Object.freeze({
  systems: STAR_SYSTEMS,
  homeId: STAR_SYSTEMS.find(system => system.knowledge === "home")?.id ?? STAR_SYSTEMS[0].id,
});

export function homeSystem(catalogue: SystemCatalogue = DEFAULT_CATALOGUE): StarSystem {
  const home = catalogue.systems.find(system => system.id === catalogue.homeId) ?? catalogue.systems[0];
  if (!home) throw new Error("System atlas has no home system");
  return home;
}

export function findSystem(id: string, catalogue: SystemCatalogue = DEFAULT_CATALOGUE): StarSystem | undefined {
  return catalogue.systems.find(system => system.id === id);
}

export function systemForPlanet(planetId: PlanetId, catalogue: SystemCatalogue = DEFAULT_CATALOGUE): StarSystem {
  const system = catalogue.systems.find(entry => entry.planets.some(planet => planet.planetId === planetId));
  if (!system) throw new Error(`Planet ${planetId} is not assigned to a system`);
  return system;
}

export function planetName(planetId: PlanetId): string {
  return PLANET_DEFS.find(planet => planet.id === planetId)?.name ?? planetId;
}

/** Neighbours sorted by distance, nearest first; ties break by id. */
export function neighboursOf(systemId: string, catalogue: SystemCatalogue = DEFAULT_CATALOGUE): SystemNeighbour[] {
  const origin = findSystem(systemId, catalogue);
  if (!origin) return [];
  return catalogue.systems
    .filter(system => system.id !== origin.id)
    .map(system => {
      const dx = system.position.x - origin.position.x;
      const dy = system.position.y - origin.position.y;
      return { system, distanceUnits: Math.round(Math.hypot(dx, dy)), bearing: Math.atan2(dy, dx) };
    })
    .sort((left, right) => left.distanceUnits - right.distanceUnits || left.system.id.localeCompare(right.system.id));
}

/** Label shown for a system; signal-only systems never disclose their name. */
export function systemLabel(system: StarSystem): string {
  return system.knowledge === "signal" ? "UNKNOWN SYSTEM" : system.name;
}

/**
 * Orbital position on the scene's XZ plane. `cycle` is the world cycle (one revolution per
 * orbitPeriod cycles); `driftSeconds` adds slow decorative motion between cycles.
 */
export function planetScenePosition(planet: SystemPlanet, cycle: number, driftSeconds: number): { x: number; z: number } {
  const angle = planet.orbitPhase
    + (cycle / planet.orbitPeriod) * Math.PI * 2
    + (driftSeconds / (planet.orbitPeriod * 6)) * Math.PI * 2;
  return { x: Math.cos(angle) * planet.orbitRadius, z: Math.sin(angle) * planet.orbitRadius };
}

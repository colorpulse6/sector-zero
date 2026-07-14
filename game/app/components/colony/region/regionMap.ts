import type { PlanetId } from "../../engine/types";
import type {
  PlanetBiome,
  PlanetState,
  RegionIntelState,
  RegionMap,
  RegionNode,
  SiteStats,
} from "../shared/colonyTypes";

export const REGION_INTEL_ORDER: readonly RegionIntelState[] = [
  "unknown",
  "rumored",
  "surveyed",
  "cleared",
  "claimed",
];

export const ASHFALL_REGION_SEED = 4107;

const PLANET_BIOMES: Record<PlanetId, PlanetBiome> = {
  verdania: "jungle",
  glaciem: "ice",
  pyraxis: "volcanic",
  ossuary: "barren",
  abyssia: "ocean",
  ashfall: "desert",
  prismara: "barren",
  genesis: "toxic",
  luminos: "urban",
  bastion: "urban",
};

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

function seededInt(seed: number, salt: string, min: number, max: number): number {
  return min + Math.floor(seededUnit(seed, salt) * (max - min + 1));
}

export function neutralSiteStats(): SiteStats {
  return { oreDensity: 50, waterTable: 50, buildableSlots: 6, threat: 50 };
}

function siteStats(seed: number, id: string): SiteStats {
  return {
    oreDensity: seededInt(seed, `${id}:ore`, 15, 95),
    waterTable: seededInt(seed, `${id}:water`, 10, 90),
    buildableSlots: seededInt(seed, `${id}:slots`, 3, 6),
    threat: seededInt(seed, `${id}:threat`, 5, 90),
  };
}

function coords(seed: number, id: string, x: number, y: number): { x: number; y: number } {
  return {
    x: x + seededInt(seed, `${id}:x`, -3, 3),
    y: y + seededInt(seed, `${id}:y`, -3, 3),
  };
}

function node(
  planetId: PlanetId,
  regionSeed: number,
  id: string,
  name: string,
  type: RegionNode["type"],
  intel: RegionIntelState,
  x: number,
  y: number,
  templateId: string | null,
  siteStatsOverride?: SiteStats,
): RegionNode {
  const fullId = `${planetId}-${id}`;
  return {
    id: fullId,
    name,
    type,
    intel,
    siteStats: type === "colony_site" ? (siteStatsOverride ?? siteStats(regionSeed, fullId)) : null,
    discovered: intel !== "unknown",
    authored: false,
    templateId,
    seed: hashText(`${regionSeed}:${fullId}`),
    cleared: false,
    respawnMissions: null,
    coords: coords(regionSeed, fullId, x, y),
    elevationMetadata: null,
  };
}

export function generateRegionMap(planetId: PlanetId, seed: number): RegionMap {
  const nodes: RegionNode[] = [
    node(planetId, seed, "forward-camp", "Forward Camp", "colony_site", "surveyed", 50, 82, null, neutralSiteStats()),
    node(planetId, seed, "cinder-relay", "Cinder Relay Ruins", "ruins", "rumored", 28, 59, "fp-ruin-cinder-relay"),
    node(planetId, seed, "oathbreaker-wreck", "Oathbreaker Wreck", "wreck", "rumored", 73, 61, "boarding-wreck-oathbreaker"),
    node(planetId, seed, "glassknife-canyon", "Glassknife Canyon", "cave", "unknown", 18, 29, "ground-canyon-glassknife"),
    node(planetId, seed, "basalt-basin", "Basalt Basin", "colony_site", "rumored", 51, 43, null),
    node(planetId, seed, "ironreach-shelf", "Ironreach Shelf", "colony_site", "unknown", 84, 31, null),
  ];

  return {
    seed,
    nodes,
    edges: [
      [nodes[0].id, nodes[1].id],
      [nodes[0].id, nodes[2].id],
      [nodes[0].id, nodes[4].id],
      [nodes[1].id, nodes[3].id],
      [nodes[2].id, nodes[5].id],
    ],
  };
}

export function createPlanetRegionState(planetId: PlanetId, seed: number): PlanetState {
  return {
    id: planetId,
    regionMap: generateRegionMap(planetId, seed),
    biome: PLANET_BIOMES[planetId],
    campaignUnlocked: planetId === "ashfall",
  };
}

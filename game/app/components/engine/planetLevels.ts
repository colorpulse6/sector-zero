import { EnemyType, type WaveDefinition, type FormationType, type PlanetId } from "./types";

// ─── Planet Level Data ──────────────────────────────────────────────

export interface PlanetLevelData {
  planetId: PlanetId;
  waves: WaveDefinition[];
  /** For survive missions: waves repeat after this index */
  loopFromWave?: number;
}

function wave(
  enemies: { type: EnemyType; count: number; formation: FormationType }[],
  delay: number = 1500,
  spawnPattern: "top" | "sides" | "formation" | "scatter" = "top"
): WaveDefinition {
  return { enemies, delay, spawnPattern };
}

// ── Verdania (Jungle / Collect) ─────────────────────────────────────
// Sparse waves — player juggles collecting bio-samples with combat
const verdaniaWaves: WaveDefinition[] = [
  wave([{ type: EnemyType.SCOUT, count: 4, formation: "v-shape" }]),
  wave([{ type: EnemyType.DRONE, count: 3, formation: "line" }]),
  wave([
    { type: EnemyType.SCOUT, count: 4, formation: "scatter" },
    { type: EnemyType.DRONE, count: 2, formation: "line" },
  ]),
  wave([{ type: EnemyType.GUNNER, count: 2, formation: "line" }]),
  wave([
    { type: EnemyType.SCOUT, count: 5, formation: "v-shape" },
    { type: EnemyType.GUNNER, count: 1, formation: "single-file" },
  ]),
  wave([
    { type: EnemyType.DRONE, count: 4, formation: "scatter" },
    { type: EnemyType.BOMBER, count: 2, formation: "line" },
  ]),
  wave([
    { type: EnemyType.GUNNER, count: 2, formation: "line" },
    { type: EnemyType.SHIELDER, count: 1, formation: "single-file" },
  ]),
  wave([
    { type: EnemyType.SCOUT, count: 6, formation: "circle" },
    { type: EnemyType.DRONE, count: 3, formation: "scatter" },
    { type: EnemyType.GUNNER, count: 2, formation: "line" },
  ]),
];

// ── Glaciem (Arctic / Survive) ──────────────────────────────────────
// Dense waves that loop and escalate
const glaciemWaves: WaveDefinition[] = [
  // Tier 0: 0-30s — light
  wave([{ type: EnemyType.SCOUT, count: 5, formation: "line" }]),
  wave([{ type: EnemyType.DRONE, count: 4, formation: "v-shape" }]),
  // Tier 1: 30-60s — medium
  wave([
    { type: EnemyType.SHIELDER, count: 2, formation: "line" },
    { type: EnemyType.SCOUT, count: 4, formation: "scatter" },
  ]),
  wave([
    { type: EnemyType.GUNNER, count: 3, formation: "line" },
    { type: EnemyType.DRONE, count: 3, formation: "v-shape" },
  ]),
  // Tier 2: 60-90s — heavy
  wave([
    { type: EnemyType.SHIELDER, count: 3, formation: "line" },
    { type: EnemyType.GUNNER, count: 2, formation: "scatter" },
  ], 1200, "sides"),
  wave([
    { type: EnemyType.BOMBER, count: 4, formation: "scatter" },
    { type: EnemyType.DRONE, count: 5, formation: "v-shape" },
  ]),
  // Tier 3: 90-120s — intense
  wave([
    { type: EnemyType.ELITE, count: 1, formation: "single-file" },
    { type: EnemyType.SHIELDER, count: 3, formation: "line" },
  ]),
  wave([
    { type: EnemyType.GUNNER, count: 4, formation: "grid" },
    { type: EnemyType.BOMBER, count: 3, formation: "scatter" },
  ], 1000, "sides"),
  // Tier 4: 120-150s — brutal
  wave([
    { type: EnemyType.ELITE, count: 2, formation: "line" },
    { type: EnemyType.TURRET, count: 2, formation: "scatter" },
  ]),
  wave([
    { type: EnemyType.SHIELDER, count: 4, formation: "line" },
    { type: EnemyType.GUNNER, count: 3, formation: "scatter" },
    { type: EnemyType.DRONE, count: 5, formation: "v-shape" },
  ]),
  // Tier 5: 150s+ — loop back to tier 3
];

// ── Pyraxis (Volcanic / Escort) ─────────────────────────────────────
// Waves that spawn around the escort path
const pyraxisWaves: WaveDefinition[] = [
  wave([{ type: EnemyType.SCOUT, count: 5, formation: "v-shape" }]),
  wave([
    { type: EnemyType.DRONE, count: 3, formation: "line" },
    { type: EnemyType.BOMBER, count: 2, formation: "scatter" },
  ], 1200, "sides"),
  wave([
    { type: EnemyType.GUNNER, count: 2, formation: "line" },
    { type: EnemyType.SCOUT, count: 4, formation: "scatter" },
  ]),
  wave([
    { type: EnemyType.TURRET, count: 2, formation: "scatter" },
    { type: EnemyType.DRONE, count: 3, formation: "v-shape" },
  ], 1000, "sides"),
  wave([
    { type: EnemyType.SHIELDER, count: 2, formation: "line" },
    { type: EnemyType.BOMBER, count: 3, formation: "scatter" },
  ]),
  wave([
    { type: EnemyType.GUNNER, count: 3, formation: "line" },
    { type: EnemyType.TURRET, count: 1, formation: "single-file" },
    { type: EnemyType.DRONE, count: 4, formation: "scatter" },
  ]),
  wave([
    { type: EnemyType.ELITE, count: 1, formation: "single-file" },
    { type: EnemyType.SHIELDER, count: 2, formation: "line" },
    { type: EnemyType.BOMBER, count: 3, formation: "scatter" },
  ]),
  wave([
    { type: EnemyType.GUNNER, count: 4, formation: "grid" },
    { type: EnemyType.SCOUT, count: 6, formation: "circle" },
  ]),
];

// ── Ossuary (Ruins / Defend) ────────────────────────────────────────
// Multi-directional assault
const ossuaryWaves: WaveDefinition[] = [
  wave([{ type: EnemyType.SCOUT, count: 6, formation: "scatter" }], 1500, "sides"),
  wave([
    { type: EnemyType.DRONE, count: 4, formation: "line" },
    { type: EnemyType.SCOUT, count: 3, formation: "scatter" },
  ], 1200, "sides"),
  wave([
    { type: EnemyType.BOMBER, count: 4, formation: "scatter" },
  ], 1000, "scatter"),
  wave([
    { type: EnemyType.GUNNER, count: 3, formation: "line" },
    { type: EnemyType.SHIELDER, count: 2, formation: "line" },
  ], 1200, "sides"),
  wave([
    { type: EnemyType.WRAITH, count: 3, formation: "v-shape" },
    { type: EnemyType.DRONE, count: 4, formation: "scatter" },
  ]),
  wave([
    { type: EnemyType.CLOAKER, count: 3, formation: "scatter" },
    { type: EnemyType.BOMBER, count: 3, formation: "scatter" },
  ], 1000, "scatter"),
  wave([
    { type: EnemyType.TURRET, count: 2, formation: "scatter" },
    { type: EnemyType.GUNNER, count: 3, formation: "line" },
    { type: EnemyType.SHIELDER, count: 2, formation: "line" },
  ], 1200, "sides"),
  wave([
    { type: EnemyType.ELITE, count: 1, formation: "single-file" },
    { type: EnemyType.WRAITH, count: 3, formation: "v-shape" },
    { type: EnemyType.BOMBER, count: 4, formation: "scatter" },
  ]),
];

// ── Abyssia (Ocean / Collect) ───────────────────────────────────────
// Moderate waves — salvage wreckage while fighting sea-themed enemies
const abyssiaWaves: WaveDefinition[] = [
  wave([
    { type: EnemyType.DRONE, count: 4, formation: "line" },
    { type: EnemyType.SWARM, count: 6, formation: "scatter" },
  ]),
  wave([
    { type: EnemyType.CLOAKER, count: 2, formation: "line" },
    { type: EnemyType.DRONE, count: 3, formation: "v-shape" },
  ]),
  wave([
    { type: EnemyType.SHIELDER, count: 2, formation: "line" },
    { type: EnemyType.SWARM, count: 8, formation: "scatter" },
  ]),
  wave([
    { type: EnemyType.WRAITH, count: 2, formation: "line" },
    { type: EnemyType.GUNNER, count: 2, formation: "scatter" },
  ], 1200, "sides"),
  wave([
    { type: EnemyType.ELITE, count: 1, formation: "single-file" },
    { type: EnemyType.CLOAKER, count: 3, formation: "scatter" },
  ]),
  wave([
    { type: EnemyType.SHIELDER, count: 3, formation: "line" },
    { type: EnemyType.WRAITH, count: 2, formation: "v-shape" },
    { type: EnemyType.SWARM, count: 6, formation: "scatter" },
  ]),
  wave([
    { type: EnemyType.TURRET, count: 2, formation: "scatter" },
    { type: EnemyType.GUNNER, count: 3, formation: "line" },
    { type: EnemyType.DRONE, count: 4, formation: "scatter" },
  ]),
  wave([
    { type: EnemyType.ELITE, count: 2, formation: "line" },
    { type: EnemyType.SHIELDER, count: 2, formation: "scatter" },
    { type: EnemyType.CLOAKER, count: 3, formation: "scatter" },
  ]),
];

// ── Ashfall (Desert / Survive) ──────────────────────────────────────
// Escalating waves with sandstorm-themed intensity
const ashfallWaves: WaveDefinition[] = [
  // Tier 0: 0-30s
  wave([{ type: EnemyType.SCOUT, count: 6, formation: "line" }]),
  wave([
    { type: EnemyType.DRONE, count: 4, formation: "scatter" },
    { type: EnemyType.MINE, count: 4, formation: "scatter" },
  ]),
  // Tier 1: 30-60s
  wave([
    { type: EnemyType.WRAITH, count: 3, formation: "v-shape" },
    { type: EnemyType.GUNNER, count: 2, formation: "line" },
  ]),
  wave([
    { type: EnemyType.ECHO, count: 3, formation: "scatter" },
    { type: EnemyType.BOMBER, count: 3, formation: "scatter" },
  ], 1200, "sides"),
  // Tier 2: 60-90s
  wave([
    { type: EnemyType.SHIELDER, count: 3, formation: "line" },
    { type: EnemyType.WRAITH, count: 3, formation: "v-shape" },
  ]),
  wave([
    { type: EnemyType.TURRET, count: 3, formation: "scatter" },
    { type: EnemyType.ECHO, count: 3, formation: "scatter" },
  ], 1000, "sides"),
  // Tier 3: 90-120s
  wave([
    { type: EnemyType.ELITE, count: 2, formation: "line" },
    { type: EnemyType.CLOAKER, count: 3, formation: "scatter" },
  ]),
  wave([
    { type: EnemyType.MIRROR, count: 3, formation: "v-shape" },
    { type: EnemyType.GUNNER, count: 4, formation: "grid" },
  ], 1000, "sides"),
  // Tier 4: 120-150s
  wave([
    { type: EnemyType.ELITE, count: 2, formation: "line" },
    { type: EnemyType.SHIELDER, count: 3, formation: "line" },
    { type: EnemyType.WRAITH, count: 3, formation: "scatter" },
  ]),
  wave([
    { type: EnemyType.MIRROR, count: 4, formation: "scatter" },
    { type: EnemyType.TURRET, count: 2, formation: "scatter" },
    { type: EnemyType.ECHO, count: 4, formation: "scatter" },
  ]),
  // Tier 5: 150s+ loop back to tier 3
];

// ── Prismara (Crystal / Escort) ─────────────────────────────────────
// Enemies target the probe aggressively
const prismaraWaves: WaveDefinition[] = [
  wave([
    { type: EnemyType.ECHO, count: 4, formation: "line" },
    { type: EnemyType.SCOUT, count: 4, formation: "scatter" },
  ]),
  wave([
    { type: EnemyType.MIRROR, count: 3, formation: "v-shape" },
    { type: EnemyType.DRONE, count: 3, formation: "scatter" },
  ], 1200, "sides"),
  wave([
    { type: EnemyType.CLOAKER, count: 3, formation: "scatter" },
    { type: EnemyType.ECHO, count: 3, formation: "line" },
  ]),
  wave([
    { type: EnemyType.WRAITH, count: 3, formation: "v-shape" },
    { type: EnemyType.GUNNER, count: 3, formation: "line" },
  ], 1000, "sides"),
  wave([
    { type: EnemyType.MIRROR, count: 4, formation: "scatter" },
    { type: EnemyType.SHIELDER, count: 2, formation: "line" },
  ]),
  wave([
    { type: EnemyType.ELITE, count: 1, formation: "single-file" },
    { type: EnemyType.ECHO, count: 4, formation: "circle" },
    { type: EnemyType.CLOAKER, count: 2, formation: "scatter" },
  ]),
  wave([
    { type: EnemyType.WRAITH, count: 4, formation: "line" },
    { type: EnemyType.MIRROR, count: 3, formation: "v-shape" },
    { type: EnemyType.TURRET, count: 2, formation: "scatter" },
  ]),
  wave([
    { type: EnemyType.ELITE, count: 2, formation: "line" },
    { type: EnemyType.SHIELDER, count: 3, formation: "scatter" },
    { type: EnemyType.ECHO, count: 4, formation: "scatter" },
  ]),
];

// ── Genesis (Garden / Defend) ───────────────────────────────────────
// Final planet — toughest defend mission, waves from all sides
const genesisWaves: WaveDefinition[] = [
  wave([
    { type: EnemyType.ECHO, count: 5, formation: "scatter" },
    { type: EnemyType.SWARM, count: 8, formation: "scatter" },
  ], 1500, "scatter"),
  wave([
    { type: EnemyType.MIRROR, count: 3, formation: "v-shape" },
    { type: EnemyType.WRAITH, count: 3, formation: "line" },
  ], 1200, "sides"),
  wave([
    { type: EnemyType.BOMBER, count: 5, formation: "scatter" },
    { type: EnemyType.CLOAKER, count: 3, formation: "scatter" },
  ], 1000, "scatter"),
  wave([
    { type: EnemyType.SHIELDER, count: 3, formation: "line" },
    { type: EnemyType.GUNNER, count: 4, formation: "grid" },
  ], 1200, "sides"),
  wave([
    { type: EnemyType.ELITE, count: 2, formation: "line" },
    { type: EnemyType.ECHO, count: 4, formation: "circle" },
  ]),
  wave([
    { type: EnemyType.MIRROR, count: 4, formation: "scatter" },
    { type: EnemyType.WRAITH, count: 3, formation: "v-shape" },
    { type: EnemyType.TURRET, count: 2, formation: "scatter" },
  ], 1000, "sides"),
  wave([
    { type: EnemyType.BOMBER, count: 4, formation: "scatter" },
    { type: EnemyType.CLOAKER, count: 4, formation: "scatter" },
    { type: EnemyType.SWARM, count: 10, formation: "scatter" },
  ], 800, "scatter"),
  wave([
    { type: EnemyType.ELITE, count: 3, formation: "v-shape" },
    { type: EnemyType.SHIELDER, count: 4, formation: "line" },
    { type: EnemyType.MIRROR, count: 3, formation: "scatter" },
  ]),
];

// ── Luminos (Neon City / Collect) ──────────────────────────────────
// Mid-difficulty — player salvages data cores amid city ambushes
const luminosWaves: WaveDefinition[] = [
  wave([
    { type: EnemyType.SCOUT, count: 5, formation: "scatter" },
    { type: EnemyType.DRONE, count: 3, formation: "line" },
  ]),
  wave([
    { type: EnemyType.CLOAKER, count: 3, formation: "scatter" },
    { type: EnemyType.GUNNER, count: 2, formation: "line" },
  ], 1200, "sides"),
  wave([
    { type: EnemyType.SHIELDER, count: 2, formation: "line" },
    { type: EnemyType.ECHO, count: 3, formation: "v-shape" },
  ]),
  wave([
    { type: EnemyType.WRAITH, count: 3, formation: "scatter" },
    { type: EnemyType.DRONE, count: 4, formation: "v-shape" },
  ], 1000, "sides"),
  wave([
    { type: EnemyType.BOMBER, count: 3, formation: "scatter" },
    { type: EnemyType.CLOAKER, count: 2, formation: "scatter" },
    { type: EnemyType.SCOUT, count: 4, formation: "line" },
  ]),
  wave([
    { type: EnemyType.TURRET, count: 2, formation: "scatter" },
    { type: EnemyType.GUNNER, count: 3, formation: "line" },
  ], 1200, "sides"),
  wave([
    { type: EnemyType.ELITE, count: 1, formation: "single-file" },
    { type: EnemyType.SHIELDER, count: 2, formation: "line" },
    { type: EnemyType.ECHO, count: 3, formation: "scatter" },
  ]),
  wave([
    { type: EnemyType.WRAITH, count: 3, formation: "v-shape" },
    { type: EnemyType.MIRROR, count: 2, formation: "line" },
    { type: EnemyType.GUNNER, count: 3, formation: "scatter" },
  ]),
];

// ── Bastion (Fortress City / Defend) ──────────────────────────────
// Heavy multi-directional assault, military-themed
const bastionWaves: WaveDefinition[] = [
  wave([
    { type: EnemyType.SCOUT, count: 6, formation: "line" },
    { type: EnemyType.DRONE, count: 4, formation: "scatter" },
  ], 1500, "sides"),
  wave([
    { type: EnemyType.GUNNER, count: 3, formation: "line" },
    { type: EnemyType.SHIELDER, count: 2, formation: "line" },
  ], 1200, "sides"),
  wave([
    { type: EnemyType.BOMBER, count: 4, formation: "scatter" },
    { type: EnemyType.MINE, count: 5, formation: "scatter" },
  ], 1000, "scatter"),
  wave([
    { type: EnemyType.TURRET, count: 3, formation: "scatter" },
    { type: EnemyType.WRAITH, count: 3, formation: "v-shape" },
  ], 1200, "sides"),
  wave([
    { type: EnemyType.ELITE, count: 1, formation: "single-file" },
    { type: EnemyType.GUNNER, count: 4, formation: "grid" },
  ]),
  wave([
    { type: EnemyType.CLOAKER, count: 3, formation: "scatter" },
    { type: EnemyType.BOMBER, count: 4, formation: "scatter" },
    { type: EnemyType.SHIELDER, count: 3, formation: "line" },
  ], 1000, "scatter"),
  wave([
    { type: EnemyType.MIRROR, count: 3, formation: "v-shape" },
    { type: EnemyType.TURRET, count: 2, formation: "scatter" },
    { type: EnemyType.WRAITH, count: 3, formation: "scatter" },
  ], 1200, "sides"),
  wave([
    { type: EnemyType.ELITE, count: 2, formation: "line" },
    { type: EnemyType.SHIELDER, count: 3, formation: "line" },
    { type: EnemyType.ECHO, count: 4, formation: "scatter" },
  ]),
];

// ─── Export ─────────────────────────────────────────────────────────

export const PLANET_LEVELS: Record<PlanetId, PlanetLevelData> = {
  verdania: { planetId: "verdania", waves: verdaniaWaves },
  glaciem: { planetId: "glaciem", waves: glaciemWaves, loopFromWave: 6 },
  pyraxis: { planetId: "pyraxis", waves: pyraxisWaves },
  ossuary: { planetId: "ossuary", waves: ossuaryWaves },
  abyssia: { planetId: "abyssia", waves: abyssiaWaves },
  ashfall: { planetId: "ashfall", waves: ashfallWaves, loopFromWave: 6 },
  prismara: { planetId: "prismara", waves: prismaraWaves },
  genesis: { planetId: "genesis", waves: genesisWaves },
  luminos: { planetId: "luminos", waves: luminosWaves },
  bastion: { planetId: "bastion", waves: bastionWaves },
};

export function getPlanetLevelData(planetId: PlanetId): PlanetLevelData {
  return PLANET_LEVELS[planetId];
}

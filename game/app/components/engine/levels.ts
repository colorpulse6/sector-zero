import { EnemyType, type WaveDefinition, type FormationType, type MultiPhaseLevelData } from "./types";

export interface LevelData {
  world: number;
  level: number;
  name: string;
  isBoss: boolean;
  waves: WaveDefinition[];
  briefingText: string;
  worldIntroText?: string;
}

// ─── World Names ─────────────────────────────────────────────────────
export const WORLD_NAMES = [
  "Aurelia Belt",
  "Cryon Nebula",
  "Ignis Rift",
  "The Graveyard",
  "Void Abyss",
  "The Scar",
  "The Fold",
  "The Hollow Core",
];

export const WORLD_THEMES = [
  "asteroid",
  "ice",
  "volcanic",
  "graveyard",
  "darkness",
  "scar",
  "fold",
  "hive",
];

// ─── Helper ──────────────────────────────────────────────────────────
function wave(
  enemies: { type: EnemyType; count: number; formation: FormationType }[],
  delay: number = 1500,
  spawnPattern: "top" | "sides" | "formation" | "scatter" = "top"
): WaveDefinition {
  return { enemies, delay, spawnPattern };
}

// ─── Story Text ─────────────────────────────────────────────────────
const WORLD_1_INTRO =
  "The Hollow's first scouts have been detected in the Aurelia Belt. An ancient asteroid field at the edge of known space. Clear the sector and find their commander.";

const WORLD_2_INTRO =
  "The Hollow's forces have retreated into the Cryon Nebula — a frozen expanse of crystallized gas and rogue ice formations. Sensors are unreliable here. Trust your instincts.";

const WORLD_3_INTRO =
  "Intelligence reports point to a Hollow weapons forge deep in the Ignis Rift — a region of volcanic planetoids and solar flares. Hull temperature is already critical.";

const WORLD_5_INTRO =
  "No light reaches the Void Abyss. The Hollow have built a shadow network here — cloaked stations connected by dark-energy corridors. We're flying blind.";

const WORLD_8_INTRO =
  "This is it. The Hollow Core — the source of every alien force we've fought. It's alive. The walls are alive. Everything here wants us dead. End this.";

// ─── World 1: Aurelia Belt ───────────────────────────────────────────
const world1: LevelData[] = [
  {
    world: 1, level: 1,
    name: "First Contact",
    isBoss: false,
    briefingText: "Alien scouts detected. Engage and assess enemy capabilities.",
    worldIntroText: WORLD_1_INTRO,
    waves: [
      wave([{ type: EnemyType.SCOUT, count: 5, formation: "line" }]),
      wave([{ type: EnemyType.SCOUT, count: 7, formation: "v-shape" }]),
      wave([{ type: EnemyType.SCOUT, count: 6, formation: "line" },
            { type: EnemyType.DRONE, count: 3, formation: "scatter" }]),
      wave([{ type: EnemyType.DRONE, count: 5, formation: "line" }]),
      wave([{ type: EnemyType.SCOUT, count: 8, formation: "v-shape" }]),
      wave([{ type: EnemyType.SCOUT, count: 6, formation: "circle" },
            { type: EnemyType.DRONE, count: 4, formation: "line" }]),
      wave([{ type: EnemyType.DRONE, count: 6, formation: "scatter" }]),
      wave([{ type: EnemyType.SCOUT, count: 8, formation: "v-shape" },
            { type: EnemyType.DRONE, count: 5, formation: "scatter" }]),
    ],
  },
  {
    world: 1, level: 2,
    name: "Debris Field",
    isBoss: false,
    briefingText: "Navigate the asteroid debris. Enemy drones are using it as cover.",
    waves: [
      wave([{ type: EnemyType.SCOUT, count: 6, formation: "v-shape" }]),
      wave([{ type: EnemyType.DRONE, count: 7, formation: "zigzag" as FormationType }]),
      wave([{ type: EnemyType.GUNNER, count: 3, formation: "line" }]),
      wave([{ type: EnemyType.DRONE, count: 6, formation: "circle" },
            { type: EnemyType.SCOUT, count: 4, formation: "line" }]),
      wave([{ type: EnemyType.SCOUT, count: 8, formation: "scatter" },
            { type: EnemyType.DRONE, count: 5, formation: "line" }]),
      wave([{ type: EnemyType.GUNNER, count: 4, formation: "line" }]),
      wave([{ type: EnemyType.GUNNER, count: 3, formation: "grid" },
            { type: EnemyType.DRONE, count: 6, formation: "v-shape" }]),
      wave([{ type: EnemyType.SCOUT, count: 10, formation: "v-shape" },
            { type: EnemyType.GUNNER, count: 3, formation: "scatter" }]),
      wave([{ type: EnemyType.MINE, count: 8, formation: "scatter" }]),
    ],
  },
  {
    world: 1, level: 3,
    name: "Ambush",
    isBoss: false,
    briefingText: "Sensor readings are off the charts. It's a trap.",
    waves: [
      wave([{ type: EnemyType.SCOUT, count: 7, formation: "v-shape" }]),
      wave([{ type: EnemyType.BOMBER, count: 5, formation: "single-file" }]),
      wave([{ type: EnemyType.GUNNER, count: 4, formation: "line" },
            { type: EnemyType.DRONE, count: 6, formation: "scatter" }]),
      wave([{ type: EnemyType.SCOUT, count: 7, formation: "circle" },
            { type: EnemyType.BOMBER, count: 3, formation: "line" }]),
      wave([{ type: EnemyType.BOMBER, count: 7, formation: "scatter" }]),
      wave([{ type: EnemyType.SCOUT, count: 8, formation: "circle" },
            { type: EnemyType.GUNNER, count: 3, formation: "line" }]),
      wave([{ type: EnemyType.DRONE, count: 7, formation: "grid" },
            { type: EnemyType.BOMBER, count: 4, formation: "scatter" }]),
      wave([{ type: EnemyType.BOMBER, count: 5, formation: "single-file" },
            { type: EnemyType.DRONE, count: 6, formation: "v-shape" }]),
      wave([{ type: EnemyType.GUNNER, count: 5, formation: "grid" },
            { type: EnemyType.MINE, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.SCOUT, count: 10, formation: "v-shape" },
            { type: EnemyType.BOMBER, count: 6, formation: "scatter" }]),
    ],
  },
  {
    world: 1, level: 4,
    name: "The Gauntlet",
    isBoss: false,
    briefingText: "Heavy enemy fortifications ahead. Break through at all costs.",
    waves: [
      wave([{ type: EnemyType.DRONE, count: 8, formation: "v-shape" }]),
      wave([{ type: EnemyType.GUNNER, count: 5, formation: "grid" }]),
      wave([{ type: EnemyType.BOMBER, count: 8, formation: "scatter" },
            { type: EnemyType.SCOUT, count: 6, formation: "line" }]),
      wave([{ type: EnemyType.DRONE, count: 7, formation: "circle" },
            { type: EnemyType.GUNNER, count: 4, formation: "line" }]),
      wave([{ type: EnemyType.TURRET, count: 3, formation: "line" },
            { type: EnemyType.DRONE, count: 6, formation: "scatter" }]),
      wave([{ type: EnemyType.SWARM, count: 14, formation: "scatter" }]),
      wave([{ type: EnemyType.GUNNER, count: 4, formation: "line" },
            { type: EnemyType.BOMBER, count: 6, formation: "scatter" },
            { type: EnemyType.DRONE, count: 4, formation: "v-shape" }]),
      wave([{ type: EnemyType.BOMBER, count: 7, formation: "single-file" },
            { type: EnemyType.SCOUT, count: 7, formation: "v-shape" }]),
      wave([{ type: EnemyType.ELITE, count: 1, formation: "line" },
            { type: EnemyType.SCOUT, count: 8, formation: "circle" }]),
      wave([{ type: EnemyType.GUNNER, count: 6, formation: "grid" },
            { type: EnemyType.MINE, count: 8, formation: "scatter" }]),
    ],
  },
  {
    world: 1, level: 5,
    name: "Rockjaw",
    isBoss: true,
    briefingText: "WARNING: Massive hostile detected. It's using the asteroids as armor.",
    waves: [
      // Boss level — waves handled by boss system
      wave([{ type: EnemyType.SCOUT, count: 6, formation: "v-shape" }]),
    ],
  },
];

// ─── World 2: Cryon Nebula ────────────────────────────────────────────
const world2: LevelData[] = [
  {
    world: 2, level: 1,
    name: "Frozen Vanguard",
    isBoss: false,
    briefingText: "Ice-class drones patrol the nebula's edge. Weapons may freeze up in these temperatures — keep firing.",
    worldIntroText: WORLD_2_INTRO,
    waves: [
      wave([{ type: EnemyType.SCOUT, count: 7, formation: "v-shape" }]),
      wave([{ type: EnemyType.DRONE, count: 6, formation: "line" },
            { type: EnemyType.SCOUT, count: 4, formation: "scatter" }]),
      wave([{ type: EnemyType.SHIELDER, count: 3, formation: "line" }]),
      wave([{ type: EnemyType.SCOUT, count: 6, formation: "circle" },
            { type: EnemyType.SHIELDER, count: 3, formation: "scatter" }]),
      wave([{ type: EnemyType.GUNNER, count: 4, formation: "line" },
            { type: EnemyType.DRONE, count: 6, formation: "v-shape" }]),
      wave([{ type: EnemyType.DRONE, count: 7, formation: "grid" },
            { type: EnemyType.SCOUT, count: 5, formation: "line" }]),
      wave([{ type: EnemyType.SHIELDER, count: 4, formation: "line" },
            { type: EnemyType.SCOUT, count: 6, formation: "scatter" }]),
      wave([{ type: EnemyType.GUNNER, count: 4, formation: "scatter" },
            { type: EnemyType.SHIELDER, count: 4, formation: "v-shape" }]),
      wave([{ type: EnemyType.GUNNER, count: 5, formation: "grid" },
            { type: EnemyType.SHIELDER, count: 3, formation: "line" }]),
    ],
  },
  {
    world: 2, level: 2,
    name: "Crystal Caverns",
    isBoss: false,
    briefingText: "Dense crystal formations are interfering with targeting. Enemy shielders are using them as cover.",
    waves: [
      wave([{ type: EnemyType.SHIELDER, count: 4, formation: "line" }]),
      wave([{ type: EnemyType.DRONE, count: 8, formation: "v-shape" }]),
      wave([{ type: EnemyType.GUNNER, count: 4, formation: "line" },
            { type: EnemyType.SHIELDER, count: 3, formation: "scatter" }]),
      wave([{ type: EnemyType.DRONE, count: 6, formation: "single-file" },
            { type: EnemyType.SHIELDER, count: 4, formation: "line" }]),
      wave([{ type: EnemyType.SCOUT, count: 10, formation: "circle" }]),
      wave([{ type: EnemyType.SHIELDER, count: 5, formation: "grid" },
            { type: EnemyType.DRONE, count: 5, formation: "line" }]),
      wave([{ type: EnemyType.GUNNER, count: 5, formation: "line" },
            { type: EnemyType.SHIELDER, count: 4, formation: "scatter" }]),
      wave([{ type: EnemyType.SHIELDER, count: 4, formation: "v-shape" },
            { type: EnemyType.GUNNER, count: 4, formation: "grid" }]),
      wave([{ type: EnemyType.MINE, count: 8, formation: "scatter" },
            { type: EnemyType.SHIELDER, count: 3, formation: "line" }]),
    ],
  },
  {
    world: 2, level: 3,
    name: "Blizzard Run",
    isBoss: false,
    briefingText: "A massive ion storm is rolling in. Push through before it cuts off our escape route.",
    waves: [
      wave([{ type: EnemyType.SCOUT, count: 8, formation: "v-shape" },
            { type: EnemyType.DRONE, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.BOMBER, count: 6, formation: "single-file" }]),
      wave([{ type: EnemyType.SHIELDER, count: 4, formation: "line" },
            { type: EnemyType.GUNNER, count: 4, formation: "line" }]),
      wave([{ type: EnemyType.DRONE, count: 7, formation: "circle" },
            { type: EnemyType.BOMBER, count: 4, formation: "scatter" }]),
      wave([{ type: EnemyType.SWARM, count: 16, formation: "scatter" }]),
      wave([{ type: EnemyType.BOMBER, count: 7, formation: "scatter" },
            { type: EnemyType.DRONE, count: 5, formation: "v-shape" }]),
      wave([{ type: EnemyType.TURRET, count: 3, formation: "line" },
            { type: EnemyType.SHIELDER, count: 4, formation: "scatter" }]),
      wave([{ type: EnemyType.GUNNER, count: 5, formation: "line" },
            { type: EnemyType.SHIELDER, count: 3, formation: "grid" }]),
      wave([{ type: EnemyType.GUNNER, count: 6, formation: "grid" },
            { type: EnemyType.SCOUT, count: 6, formation: "line" }]),
      wave([{ type: EnemyType.SHIELDER, count: 5, formation: "line" },
            { type: EnemyType.BOMBER, count: 6, formation: "scatter" }]),
    ],
  },
  {
    world: 2, level: 4,
    name: "The Deep Freeze",
    isBoss: false,
    briefingText: "We've located their cryo-facility. Expect heavy resistance — they're protecting something.",
    waves: [
      wave([{ type: EnemyType.GUNNER, count: 5, formation: "grid" }]),
      wave([{ type: EnemyType.SHIELDER, count: 5, formation: "line" },
            { type: EnemyType.DRONE, count: 6, formation: "scatter" }]),
      wave([{ type: EnemyType.TURRET, count: 4, formation: "line" },
            { type: EnemyType.SCOUT, count: 8, formation: "v-shape" }]),
      wave([{ type: EnemyType.DRONE, count: 7, formation: "circle" },
            { type: EnemyType.SHIELDER, count: 4, formation: "v-shape" }]),
      wave([{ type: EnemyType.BOMBER, count: 8, formation: "scatter" },
            { type: EnemyType.SHIELDER, count: 4, formation: "line" }]),
      wave([{ type: EnemyType.ELITE, count: 2, formation: "line" },
            { type: EnemyType.GUNNER, count: 4, formation: "scatter" }]),
      wave([{ type: EnemyType.SWARM, count: 18, formation: "scatter" }]),
      wave([{ type: EnemyType.GUNNER, count: 5, formation: "line" },
            { type: EnemyType.BOMBER, count: 6, formation: "single-file" }]),
      wave([{ type: EnemyType.TURRET, count: 3, formation: "line" },
            { type: EnemyType.SHIELDER, count: 4, formation: "line" },
            { type: EnemyType.BOMBER, count: 4, formation: "scatter" }]),
      wave([{ type: EnemyType.ELITE, count: 2, formation: "line" },
            { type: EnemyType.GUNNER, count: 5, formation: "grid" }]),
    ],
  },
  {
    world: 2, level: 5,
    name: "Glacius",
    isBoss: true,
    briefingText: "WARNING: A Hollow war-form is using the nebula's cold to power its shields. Find a way through its armor.",
    waves: [
      wave([{ type: EnemyType.SHIELDER, count: 4, formation: "line" },
            { type: EnemyType.DRONE, count: 6, formation: "v-shape" }]),
    ],
  },
];

// ─── World 3: Ignis Rift ─────────────────────────────────────────────
const world3: LevelData[] = [
  {
    world: 3, level: 1,
    name: "Magma Approach",
    isBoss: false,
    briefingText: "Volcanic debris is everywhere. Watch for eruption patterns and clear a path through the fire.",
    worldIntroText: WORLD_3_INTRO,
    waves: [
      wave([{ type: EnemyType.SCOUT, count: 8, formation: "v-shape" }]),
      wave([{ type: EnemyType.BOMBER, count: 6, formation: "single-file" },
            { type: EnemyType.DRONE, count: 4, formation: "scatter" }]),
      wave([{ type: EnemyType.GUNNER, count: 6, formation: "line" }]),
      wave([{ type: EnemyType.SCOUT, count: 7, formation: "circle" },
            { type: EnemyType.BOMBER, count: 4, formation: "line" }]),
      wave([{ type: EnemyType.BOMBER, count: 8, formation: "scatter" }]),
      wave([{ type: EnemyType.DRONE, count: 7, formation: "grid" },
            { type: EnemyType.GUNNER, count: 4, formation: "scatter" }]),
      wave([{ type: EnemyType.TURRET, count: 3, formation: "line" },
            { type: EnemyType.SCOUT, count: 7, formation: "v-shape" }]),
      wave([{ type: EnemyType.BOMBER, count: 6, formation: "v-shape" },
            { type: EnemyType.TURRET, count: 3, formation: "scatter" }]),
      wave([{ type: EnemyType.BOMBER, count: 7, formation: "scatter" },
            { type: EnemyType.GUNNER, count: 4, formation: "line" }]),
    ],
  },
  {
    world: 3, level: 2,
    name: "Forge Gates",
    isBoss: false,
    briefingText: "Hollow turrets guard the outer forge. They've dug into the rock — you'll need to flush them out.",
    waves: [
      wave([{ type: EnemyType.TURRET, count: 4, formation: "line" }]),
      wave([{ type: EnemyType.DRONE, count: 8, formation: "v-shape" },
            { type: EnemyType.SCOUT, count: 6, formation: "scatter" }]),
      wave([{ type: EnemyType.TURRET, count: 3, formation: "line" },
            { type: EnemyType.GUNNER, count: 4, formation: "line" }]),
      wave([{ type: EnemyType.SHIELDER, count: 4, formation: "v-shape" },
            { type: EnemyType.TURRET, count: 3, formation: "scatter" }]),
      wave([{ type: EnemyType.BOMBER, count: 7, formation: "scatter" },
            { type: EnemyType.SHIELDER, count: 3, formation: "line" }]),
      wave([{ type: EnemyType.TURRET, count: 6, formation: "grid" }]),
      wave([{ type: EnemyType.DRONE, count: 7, formation: "circle" },
            { type: EnemyType.GUNNER, count: 4, formation: "line" }]),
      wave([{ type: EnemyType.GUNNER, count: 6, formation: "line" },
            { type: EnemyType.TURRET, count: 3, formation: "scatter" }]),
      wave([{ type: EnemyType.TURRET, count: 4, formation: "v-shape" },
            { type: EnemyType.BOMBER, count: 6, formation: "single-file" }]),
      wave([{ type: EnemyType.MINE, count: 11, formation: "scatter" },
            { type: EnemyType.TURRET, count: 4, formation: "line" }]),
    ],
  },
  {
    world: 3, level: 3,
    name: "Solar Storm",
    isBoss: false,
    briefingText: "A solar flare is destabilizing the sector. Enemy bombers are using the chaos to make attack runs.",
    waves: [
      wave([{ type: EnemyType.BOMBER, count: 8, formation: "scatter" }]),
      wave([{ type: EnemyType.SCOUT, count: 11, formation: "circle" },
            { type: EnemyType.BOMBER, count: 4, formation: "single-file" }]),
      wave([{ type: EnemyType.GUNNER, count: 6, formation: "grid" },
            { type: EnemyType.DRONE, count: 7, formation: "v-shape" }]),
      wave([{ type: EnemyType.BOMBER, count: 7, formation: "v-shape" },
            { type: EnemyType.SCOUT, count: 6, formation: "line" }]),
      wave([{ type: EnemyType.BOMBER, count: 11, formation: "scatter" }]),
      wave([{ type: EnemyType.TURRET, count: 4, formation: "line" },
            { type: EnemyType.SHIELDER, count: 4, formation: "line" }]),
      wave([{ type: EnemyType.DRONE, count: 8, formation: "circle" },
            { type: EnemyType.BOMBER, count: 6, formation: "scatter" }]),
      wave([{ type: EnemyType.ELITE, count: 2, formation: "line" },
            { type: EnemyType.BOMBER, count: 7, formation: "scatter" }]),
      wave([{ type: EnemyType.SWARM, count: 22, formation: "scatter" }]),
      wave([{ type: EnemyType.SHIELDER, count: 4, formation: "grid" },
            { type: EnemyType.TURRET, count: 4, formation: "line" }]),
      wave([{ type: EnemyType.GUNNER, count: 7, formation: "grid" },
            { type: EnemyType.BOMBER, count: 6, formation: "scatter" },
            { type: EnemyType.TURRET, count: 3, formation: "line" }]),
    ],
  },
  {
    world: 3, level: 4,
    name: "The Crucible",
    isBoss: false,
    briefingText: "The inner forge is online and producing new Hollow units. Shut it down before they overwhelm us.",
    waves: [
      wave([{ type: EnemyType.TURRET, count: 4, formation: "line" },
            { type: EnemyType.SHIELDER, count: 4, formation: "line" }]),
      wave([{ type: EnemyType.BOMBER, count: 8, formation: "scatter" },
            { type: EnemyType.GUNNER, count: 4, formation: "line" }]),
      wave([{ type: EnemyType.DRONE, count: 7, formation: "circle" },
            { type: EnemyType.TURRET, count: 4, formation: "scatter" }]),
      wave([{ type: EnemyType.ELITE, count: 3, formation: "line" },
            { type: EnemyType.DRONE, count: 8, formation: "v-shape" }]),
      wave([{ type: EnemyType.TURRET, count: 6, formation: "grid" },
            { type: EnemyType.MINE, count: 8, formation: "scatter" }]),
      wave([{ type: EnemyType.BOMBER, count: 11, formation: "scatter" },
            { type: EnemyType.SHIELDER, count: 4, formation: "line" }]),
      wave([{ type: EnemyType.GUNNER, count: 7, formation: "v-shape" },
            { type: EnemyType.SHIELDER, count: 3, formation: "line" }]),
      wave([{ type: EnemyType.SWARM, count: 24, formation: "scatter" },
            { type: EnemyType.TURRET, count: 3, formation: "line" }]),
      wave([{ type: EnemyType.ELITE, count: 3, formation: "line" },
            { type: EnemyType.GUNNER, count: 6, formation: "grid" }]),
      wave([{ type: EnemyType.BOMBER, count: 8, formation: "single-file" },
            { type: EnemyType.MINE, count: 7, formation: "scatter" }]),
      wave([{ type: EnemyType.TURRET, count: 4, formation: "line" },
            { type: EnemyType.BOMBER, count: 7, formation: "scatter" },
            { type: EnemyType.ELITE, count: 2, formation: "line" }]),
    ],
  },
  {
    world: 3, level: 5,
    name: "Cindermaw",
    isBoss: true,
    briefingText: "WARNING: The forge is guarded by a Hollow titan fused with volcanic rock. It can reshape the battlefield.",
    waves: [
      wave([{ type: EnemyType.BOMBER, count: 6, formation: "scatter" },
            { type: EnemyType.TURRET, count: 3, formation: "line" }]),
    ],
  },
];

// ─── World 4: The Graveyard ──────────────────────────────────────────

const WORLD_4_INTRO =
  "A vast debris field stretches before you — ancient ships, shattered hulls, silence. Something terrible happened here long ago. Find out what.";

const world4: LevelData[] = [
  {
    world: 4, level: 1,
    name: "Debris Approach",
    isBoss: false,
    briefingText: "Massive debris field detected. Unidentified contacts moving among the wreckage.",
    worldIntroText: WORLD_4_INTRO,
    waves: [
      wave([{ type: EnemyType.SCOUT, count: 7, formation: "v-shape" }]),
      wave([{ type: EnemyType.WRAITH, count: 3, formation: "line" }]),
      wave([{ type: EnemyType.DRONE, count: 6, formation: "scatter" },
            { type: EnemyType.WRAITH, count: 3, formation: "line" }]),
      wave([{ type: EnemyType.SCOUT, count: 7, formation: "circle" },
            { type: EnemyType.WRAITH, count: 3, formation: "scatter" }]),
      wave([{ type: EnemyType.GUNNER, count: 4, formation: "line" },
            { type: EnemyType.WRAITH, count: 4, formation: "v-shape" }]),
      wave([{ type: EnemyType.DRONE, count: 6, formation: "grid" },
            { type: EnemyType.WRAITH, count: 4, formation: "line" }]),
      wave([{ type: EnemyType.WRAITH, count: 6, formation: "v-shape" },
            { type: EnemyType.SCOUT, count: 6, formation: "scatter" }]),
      wave([{ type: EnemyType.GUNNER, count: 6, formation: "v-shape" },
            { type: EnemyType.WRAITH, count: 3, formation: "scatter" }]),
      wave([{ type: EnemyType.WRAITH, count: 4, formation: "line" },
            { type: EnemyType.GUNNER, count: 4, formation: "line" }]),
    ],
  },
  {
    world: 4, level: 2,
    name: "The Kepler Graveyard",
    isBoss: false,
    briefingText: "Colony ship wreckage identified. These ships are ancient... and familiar.",
    waves: [
      wave([{ type: EnemyType.WRAITH, count: 4, formation: "v-shape" }]),
      wave([{ type: EnemyType.SHIELDER, count: 4, formation: "line" },
            { type: EnemyType.WRAITH, count: 3, formation: "scatter" }]),
      wave([{ type: EnemyType.WRAITH, count: 4, formation: "circle" },
            { type: EnemyType.DRONE, count: 4, formation: "line" }]),
      wave([{ type: EnemyType.DRONE, count: 7, formation: "v-shape" },
            { type: EnemyType.WRAITH, count: 4, formation: "line" }]),
      wave([{ type: EnemyType.MINE, count: 11, formation: "scatter" }]),
      wave([{ type: EnemyType.WRAITH, count: 6, formation: "v-shape" },
            { type: EnemyType.GUNNER, count: 4, formation: "line" }]),
      wave([{ type: EnemyType.SHIELDER, count: 4, formation: "grid" },
            { type: EnemyType.WRAITH, count: 4, formation: "scatter" }]),
      wave([{ type: EnemyType.TURRET, count: 3, formation: "line" },
            { type: EnemyType.WRAITH, count: 4, formation: "scatter" }]),
      wave([{ type: EnemyType.GUNNER, count: 6, formation: "v-shape" },
            { type: EnemyType.WRAITH, count: 4, formation: "line" }]),
      wave([{ type: EnemyType.WRAITH, count: 7, formation: "v-shape" },
            { type: EnemyType.SHIELDER, count: 3, formation: "line" }]),
    ],
  },
  {
    world: 4, level: 3,
    name: "Ship Logs",
    isBoss: false,
    briefingText: "We're recovering data from the wreckage. Expect heavy resistance — something doesn't want us reading those logs.",
    waves: [
      wave([{ type: EnemyType.WRAITH, count: 6, formation: "line" },
            { type: EnemyType.CLOAKER, count: 3, formation: "scatter" }]),
      wave([{ type: EnemyType.BOMBER, count: 6, formation: "single-file" },
            { type: EnemyType.WRAITH, count: 4, formation: "v-shape" }]),
      wave([{ type: EnemyType.WRAITH, count: 4, formation: "circle" },
            { type: EnemyType.CLOAKER, count: 4, formation: "scatter" }]),
      wave([{ type: EnemyType.GUNNER, count: 6, formation: "grid" },
            { type: EnemyType.WRAITH, count: 3, formation: "line" }]),
      wave([{ type: EnemyType.SWARM, count: 18, formation: "scatter" }]),
      wave([{ type: EnemyType.WRAITH, count: 6, formation: "v-shape" },
            { type: EnemyType.SHIELDER, count: 4, formation: "line" }]),
      wave([{ type: EnemyType.BOMBER, count: 7, formation: "scatter" },
            { type: EnemyType.WRAITH, count: 4, formation: "line" }]),
      wave([{ type: EnemyType.TURRET, count: 4, formation: "line" },
            { type: EnemyType.WRAITH, count: 4, formation: "scatter" }]),
      wave([{ type: EnemyType.ELITE, count: 2, formation: "line" },
            { type: EnemyType.WRAITH, count: 6, formation: "v-shape" }]),
      wave([{ type: EnemyType.GUNNER, count: 4, formation: "v-shape" },
            { type: EnemyType.WRAITH, count: 6, formation: "scatter" }]),
      wave([{ type: EnemyType.WRAITH, count: 7, formation: "line" },
            { type: EnemyType.CLOAKER, count: 4, formation: "scatter" }]),
    ],
  },
  {
    world: 4, level: 4,
    name: "Ghost Fleet",
    isBoss: false,
    briefingText: "The escort fleet is still here. What's left of it. Something fused the ships with Hollow biotech.",
    waves: [
      wave([{ type: EnemyType.WRAITH, count: 7, formation: "v-shape" },
            { type: EnemyType.CLOAKER, count: 4, formation: "scatter" }]),
      wave([{ type: EnemyType.TURRET, count: 4, formation: "line" },
            { type: EnemyType.WRAITH, count: 4, formation: "line" }]),
      wave([{ type: EnemyType.WRAITH, count: 6, formation: "circle" },
            { type: EnemyType.CLOAKER, count: 3, formation: "line" }]),
      wave([{ type: EnemyType.ELITE, count: 3, formation: "line" },
            { type: EnemyType.WRAITH, count: 6, formation: "v-shape" }]),
      wave([{ type: EnemyType.BOMBER, count: 8, formation: "scatter" },
            { type: EnemyType.MINE, count: 11, formation: "scatter" }]),
      wave([{ type: EnemyType.WRAITH, count: 8, formation: "v-shape" },
            { type: EnemyType.SHIELDER, count: 4, formation: "line" }]),
      wave([{ type: EnemyType.TURRET, count: 4, formation: "grid" },
            { type: EnemyType.WRAITH, count: 6, formation: "scatter" }]),
      wave([{ type: EnemyType.SWARM, count: 21, formation: "scatter" },
            { type: EnemyType.WRAITH, count: 4, formation: "scatter" }]),
      wave([{ type: EnemyType.GUNNER, count: 6, formation: "grid" },
            { type: EnemyType.WRAITH, count: 6, formation: "line" },
            { type: EnemyType.CLOAKER, count: 4, formation: "scatter" }]),
      wave([{ type: EnemyType.BOMBER, count: 7, formation: "single-file" },
            { type: EnemyType.WRAITH, count: 7, formation: "v-shape" }]),
      wave([{ type: EnemyType.ELITE, count: 3, formation: "line" },
            { type: EnemyType.WRAITH, count: 7, formation: "v-shape" }]),
    ],
  },
  {
    world: 4, level: 5,
    name: "Revenant",
    isBoss: true,
    briefingText: "WARNING: A massive derelict warship is powering up. Half human, half Hollow. That bridge... it's a UEC Dreadnought.",
    waves: [
      wave([{ type: EnemyType.WRAITH, count: 5, formation: "v-shape" },
            { type: EnemyType.DRONE, count: 4, formation: "scatter" }]),
    ],
  },
];

// ─── World 5: Void Abyss ─────────────────────────────────────────────
const world5: LevelData[] = [
  {
    world: 5, level: 1,
    name: "Dark Entry",
    isBoss: false,
    briefingText: "Visibility near zero. Enemies will appear without warning. Keep your trigger finger ready.",
    worldIntroText: WORLD_5_INTRO,
    waves: [
      wave([{ type: EnemyType.CLOAKER, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.SCOUT, count: 9, formation: "v-shape" },
            { type: EnemyType.CLOAKER, count: 3, formation: "scatter" }]),
      wave([{ type: EnemyType.DRONE, count: 6, formation: "circle" },
            { type: EnemyType.CLOAKER, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.GUNNER, count: 6, formation: "line" },
            { type: EnemyType.CLOAKER, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.MINE, count: 12, formation: "scatter" }]),
      wave([{ type: EnemyType.SCOUT, count: 7, formation: "single-file" },
            { type: EnemyType.CLOAKER, count: 6, formation: "scatter" }]),
      wave([{ type: EnemyType.CLOAKER, count: 7, formation: "scatter" },
            { type: EnemyType.DRONE, count: 6, formation: "v-shape" }]),
      wave([{ type: EnemyType.GUNNER, count: 5, formation: "v-shape" },
            { type: EnemyType.CLOAKER, count: 5, formation: "line" }]),
      wave([{ type: EnemyType.MINE, count: 9, formation: "scatter" },
            { type: EnemyType.DRONE, count: 7, formation: "grid" }]),
      wave([{ type: EnemyType.GUNNER, count: 6, formation: "grid" },
            { type: EnemyType.CLOAKER, count: 5, formation: "scatter" }]),
    ],
  },
  {
    world: 5, level: 2,
    name: "Shadow Network",
    isBoss: false,
    briefingText: "Cloaked stations are coordinating enemy attacks. Destroy the relay nodes to break their formation.",
    waves: [
      wave([{ type: EnemyType.CLOAKER, count: 6, formation: "scatter" },
            { type: EnemyType.DRONE, count: 6, formation: "line" }]),
      wave([{ type: EnemyType.TURRET, count: 5, formation: "line" },
            { type: EnemyType.CLOAKER, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.DRONE, count: 7, formation: "circle" },
            { type: EnemyType.CLOAKER, count: 5, formation: "line" }]),
      wave([{ type: EnemyType.SHIELDER, count: 5, formation: "line" },
            { type: EnemyType.CLOAKER, count: 6, formation: "scatter" }]),
      wave([{ type: EnemyType.MINE, count: 14, formation: "scatter" }]),
      wave([{ type: EnemyType.GUNNER, count: 6, formation: "grid" },
            { type: EnemyType.CLOAKER, count: 6, formation: "scatter" }]),
      wave([{ type: EnemyType.SHIELDER, count: 6, formation: "v-shape" },
            { type: EnemyType.CLOAKER, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.ELITE, count: 2, formation: "line" },
            { type: EnemyType.CLOAKER, count: 7, formation: "scatter" }]),
      wave([{ type: EnemyType.DRONE, count: 7, formation: "grid" },
            { type: EnemyType.TURRET, count: 3, formation: "line" }]),
      wave([{ type: EnemyType.TURRET, count: 5, formation: "line" },
            { type: EnemyType.SHIELDER, count: 5, formation: "line" },
            { type: EnemyType.CLOAKER, count: 5, formation: "scatter" }]),
    ],
  },
  {
    world: 5, level: 3,
    name: "Phantom Fleet",
    isBoss: false,
    briefingText: "An entire Hollow fleet just appeared on sensors... then vanished. They're hunting us.",
    waves: [
      wave([{ type: EnemyType.CLOAKER, count: 9, formation: "scatter" }]),
      wave([{ type: EnemyType.SCOUT, count: 14, formation: "circle" },
            { type: EnemyType.CLOAKER, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.BOMBER, count: 7, formation: "single-file" },
            { type: EnemyType.CLOAKER, count: 6, formation: "scatter" }]),
      wave([{ type: EnemyType.CLOAKER, count: 7, formation: "v-shape" },
            { type: EnemyType.GUNNER, count: 5, formation: "line" }]),
      wave([{ type: EnemyType.GUNNER, count: 7, formation: "grid" },
            { type: EnemyType.SHIELDER, count: 5, formation: "line" }]),
      wave([{ type: EnemyType.SWARM, count: 25, formation: "scatter" },
            { type: EnemyType.CLOAKER, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.BOMBER, count: 6, formation: "v-shape" },
            { type: EnemyType.CLOAKER, count: 6, formation: "scatter" }]),
      wave([{ type: EnemyType.ELITE, count: 3, formation: "line" },
            { type: EnemyType.CLOAKER, count: 6, formation: "scatter" }]),
      wave([{ type: EnemyType.TURRET, count: 5, formation: "line" },
            { type: EnemyType.MINE, count: 12, formation: "scatter" }]),
      wave([{ type: EnemyType.SHIELDER, count: 5, formation: "grid" },
            { type: EnemyType.CLOAKER, count: 7, formation: "scatter" }]),
      wave([{ type: EnemyType.CLOAKER, count: 9, formation: "scatter" },
            { type: EnemyType.GUNNER, count: 6, formation: "grid" },
            { type: EnemyType.BOMBER, count: 5, formation: "scatter" }]),
    ],
  },
  {
    world: 5, level: 4,
    name: "Event Horizon",
    isBoss: false,
    briefingText: "We're approaching something massive. Gravity distortions are pulling everything inward.",
    waves: [
      wave([{ type: EnemyType.CLOAKER, count: 7, formation: "scatter" },
            { type: EnemyType.GUNNER, count: 6, formation: "grid" }]),
      wave([{ type: EnemyType.TURRET, count: 6, formation: "line" },
            { type: EnemyType.SHIELDER, count: 5, formation: "line" }]),
      wave([{ type: EnemyType.CLOAKER, count: 6, formation: "v-shape" },
            { type: EnemyType.BOMBER, count: 6, formation: "single-file" }]),
      wave([{ type: EnemyType.ELITE, count: 3, formation: "line" },
            { type: EnemyType.CLOAKER, count: 7, formation: "scatter" }]),
      wave([{ type: EnemyType.BOMBER, count: 12, formation: "scatter" },
            { type: EnemyType.MINE, count: 12, formation: "scatter" }]),
      wave([{ type: EnemyType.GUNNER, count: 6, formation: "circle" },
            { type: EnemyType.CLOAKER, count: 6, formation: "scatter" }]),
      wave([{ type: EnemyType.SWARM, count: 28, formation: "scatter" },
            { type: EnemyType.CLOAKER, count: 6, formation: "scatter" }]),
      wave([{ type: EnemyType.TURRET, count: 5, formation: "line" },
            { type: EnemyType.ELITE, count: 3, formation: "line" },
            { type: EnemyType.SHIELDER, count: 5, formation: "line" }]),
      wave([{ type: EnemyType.SHIELDER, count: 6, formation: "grid" },
            { type: EnemyType.CLOAKER, count: 7, formation: "scatter" }]),
      wave([{ type: EnemyType.GUNNER, count: 7, formation: "grid" },
            { type: EnemyType.CLOAKER, count: 9, formation: "scatter" }]),
      wave([{ type: EnemyType.BOMBER, count: 7, formation: "v-shape" },
            { type: EnemyType.TURRET, count: 5, formation: "line" }]),
      wave([{ type: EnemyType.ELITE, count: 4, formation: "line" },
            { type: EnemyType.CLOAKER, count: 7, formation: "scatter" },
            { type: EnemyType.BOMBER, count: 6, formation: "scatter" }]),
    ],
  },
  {
    world: 5, level: 5,
    name: "Nyxar",
    isBoss: true,
    briefingText: "WARNING: The Void commander controls darkness itself. It will try to blind you before striking.",
    waves: [
      wave([{ type: EnemyType.CLOAKER, count: 6, formation: "scatter" },
            { type: EnemyType.MINE, count: 8, formation: "scatter" }]),
    ],
  },
];

// ─── World 6: The Scar ──────────────────────────────────────────────

const WORLD_6_INTRO =
  "The Signal is deafening. Space itself warps and flickers ahead. Ship systems are glitching. Whatever lies beyond this scar in reality... it's been calling us.";

const world6: LevelData[] = [
  {
    world: 6, level: 1,
    name: "Signal Approach",
    isBoss: false,
    briefingText: "The Signal is intensifying. New contact type -- they phase in and out of existence.",
    worldIntroText: WORLD_6_INTRO,
    waves: [
      wave([{ type: EnemyType.SCOUT, count: 7, formation: "v-shape" },
            { type: EnemyType.ECHO, count: 3, formation: "scatter" }]),
      wave([{ type: EnemyType.ECHO, count: 5, formation: "line" }]),
      wave([{ type: EnemyType.DRONE, count: 6, formation: "circle" },
            { type: EnemyType.ECHO, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.WRAITH, count: 5, formation: "v-shape" },
            { type: EnemyType.ECHO, count: 3, formation: "scatter" }]),
      wave([{ type: EnemyType.SCOUT, count: 9, formation: "grid" },
            { type: EnemyType.ECHO, count: 3, formation: "line" }]),
      wave([{ type: EnemyType.GUNNER, count: 5, formation: "line" },
            { type: EnemyType.ECHO, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.ECHO, count: 6, formation: "v-shape" },
            { type: EnemyType.DRONE, count: 6, formation: "scatter" }]),
      wave([{ type: EnemyType.WRAITH, count: 6, formation: "circle" },
            { type: EnemyType.ECHO, count: 3, formation: "line" }]),
      wave([{ type: EnemyType.GUNNER, count: 6, formation: "v-shape" },
            { type: EnemyType.ECHO, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.WRAITH, count: 5, formation: "line" },
            { type: EnemyType.ECHO, count: 5, formation: "line" }]),
    ],
  },
  {
    world: 6, level: 2,
    name: "Distortion Field",
    isBoss: false,
    briefingText: "Space is warping. Sensors can't distinguish past from present. The flickering enemies are everywhere.",
    waves: [
      wave([{ type: EnemyType.ECHO, count: 6, formation: "scatter" }]),
      wave([{ type: EnemyType.SHIELDER, count: 5, formation: "line" },
            { type: EnemyType.ECHO, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.WRAITH, count: 6, formation: "v-shape" },
            { type: EnemyType.ECHO, count: 3, formation: "line" }]),
      wave([{ type: EnemyType.ECHO, count: 6, formation: "circle" },
            { type: EnemyType.SHIELDER, count: 3, formation: "line" }]),
      wave([{ type: EnemyType.TURRET, count: 5, formation: "line" },
            { type: EnemyType.ECHO, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.BOMBER, count: 7, formation: "scatter" },
            { type: EnemyType.ECHO, count: 6, formation: "v-shape" }]),
      wave([{ type: EnemyType.WRAITH, count: 5, formation: "grid" },
            { type: EnemyType.ECHO, count: 5, formation: "line" }]),
      wave([{ type: EnemyType.ELITE, count: 2, formation: "line" },
            { type: EnemyType.ECHO, count: 6, formation: "scatter" }]),
      wave([{ type: EnemyType.TURRET, count: 3, formation: "line" },
            { type: EnemyType.ECHO, count: 6, formation: "v-shape" }]),
      wave([{ type: EnemyType.WRAITH, count: 6, formation: "line" },
            { type: EnemyType.ECHO, count: 5, formation: "scatter" },
            { type: EnemyType.MINE, count: 9, formation: "scatter" }]),
    ],
  },
  {
    world: 6, level: 3,
    name: "Memory Shards",
    isBoss: false,
    briefingText: "The crew is experiencing flashes of memories that aren't theirs. The enemies are relentless.",
    waves: [
      wave([{ type: EnemyType.ECHO, count: 7, formation: "v-shape" },
            { type: EnemyType.CLOAKER, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.GUNNER, count: 6, formation: "grid" },
            { type: EnemyType.ECHO, count: 5, formation: "line" }]),
      wave([{ type: EnemyType.ECHO, count: 6, formation: "circle" },
            { type: EnemyType.CLOAKER, count: 5, formation: "line" }]),
      wave([{ type: EnemyType.WRAITH, count: 6, formation: "v-shape" },
            { type: EnemyType.ECHO, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.SWARM, count: 22, formation: "scatter" }]),
      wave([{ type: EnemyType.TURRET, count: 5, formation: "line" },
            { type: EnemyType.ECHO, count: 6, formation: "v-shape" }]),
      wave([{ type: EnemyType.CLOAKER, count: 6, formation: "scatter" },
            { type: EnemyType.ECHO, count: 6, formation: "line" }]),
      wave([{ type: EnemyType.ELITE, count: 3, formation: "line" },
            { type: EnemyType.ECHO, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.GUNNER, count: 6, formation: "v-shape" },
            { type: EnemyType.WRAITH, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.BOMBER, count: 7, formation: "scatter" },
            { type: EnemyType.WRAITH, count: 5, formation: "line" },
            { type: EnemyType.ECHO, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.ECHO, count: 7, formation: "grid" },
            { type: EnemyType.TURRET, count: 3, formation: "line" }]),
      wave([{ type: EnemyType.ECHO, count: 9, formation: "v-shape" },
            { type: EnemyType.SHIELDER, count: 5, formation: "line" }]),
    ],
  },
  {
    world: 6, level: 4,
    name: "The Signal Source",
    isBoss: false,
    briefingText: "We've traced The Signal to its relay point. Everything is converging to stop us from reaching it.",
    waves: [
      wave([{ type: EnemyType.ECHO, count: 7, formation: "scatter" },
            { type: EnemyType.WRAITH, count: 6, formation: "v-shape" }]),
      wave([{ type: EnemyType.TURRET, count: 6, formation: "line" },
            { type: EnemyType.ECHO, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.WRAITH, count: 6, formation: "circle" },
            { type: EnemyType.ECHO, count: 5, formation: "line" }]),
      wave([{ type: EnemyType.ELITE, count: 3, formation: "line" },
            { type: EnemyType.ECHO, count: 6, formation: "v-shape" }]),
      wave([{ type: EnemyType.BOMBER, count: 9, formation: "scatter" },
            { type: EnemyType.MINE, count: 12, formation: "scatter" }]),
      wave([{ type: EnemyType.ECHO, count: 7, formation: "v-shape" },
            { type: EnemyType.CLOAKER, count: 6, formation: "scatter" }]),
      wave([{ type: EnemyType.SWARM, count: 25, formation: "scatter" },
            { type: EnemyType.ECHO, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.ECHO, count: 7, formation: "grid" },
            { type: EnemyType.CLOAKER, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.GUNNER, count: 7, formation: "grid" },
            { type: EnemyType.WRAITH, count: 6, formation: "line" },
            { type: EnemyType.ECHO, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.BOMBER, count: 7, formation: "single-file" },
            { type: EnemyType.ECHO, count: 6, formation: "v-shape" }]),
      wave([{ type: EnemyType.ELITE, count: 4, formation: "line" },
            { type: EnemyType.ECHO, count: 7, formation: "v-shape" }]),
    ],
  },
  {
    world: 6, level: 5,
    name: "The Beacon",
    isBoss: true,
    briefingText: "WARNING: A massive Signal relay node is broadcasting across spacetime. Destroy it to open the path forward.",
    waves: [
      wave([{ type: EnemyType.ECHO, count: 6, formation: "scatter" },
            { type: EnemyType.WRAITH, count: 5, formation: "v-shape" }]),
    ],
  },
];

// ─── World 7: The Fold ──────────────────────────────────────────────

const WORLD_7_INTRO =
  "Inside the temporal anomaly. Reality inverts. Past and present overlap. The things you fight here... they are you. From before. From the last cycle.";

const world7: LevelData[] = [
  {
    world: 7, level: 1,
    name: "Through the Mirror",
    isBoss: false,
    briefingText: "Reality has inverted. Corrupted copies of our own ships are attacking. This is The Fold.",
    worldIntroText: WORLD_7_INTRO,
    waves: [
      wave([{ type: EnemyType.MIRROR, count: 5, formation: "v-shape" }]),
      wave([{ type: EnemyType.ECHO, count: 5, formation: "scatter" },
            { type: EnemyType.MIRROR, count: 3, formation: "line" }]),
      wave([{ type: EnemyType.MIRROR, count: 5, formation: "circle" },
            { type: EnemyType.DRONE, count: 5, formation: "line" }]),
      wave([{ type: EnemyType.WRAITH, count: 5, formation: "v-shape" },
            { type: EnemyType.MIRROR, count: 5, formation: "line" }]),
      wave([{ type: EnemyType.MIRROR, count: 6, formation: "v-shape" },
            { type: EnemyType.DRONE, count: 6, formation: "scatter" }]),
      wave([{ type: EnemyType.ECHO, count: 5, formation: "grid" },
            { type: EnemyType.MIRROR, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.GUNNER, count: 5, formation: "line" },
            { type: EnemyType.MIRROR, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.WRAITH, count: 5, formation: "circle" },
            { type: EnemyType.MIRROR, count: 6, formation: "line" }]),
      wave([{ type: EnemyType.GUNNER, count: 6, formation: "v-shape" },
            { type: EnemyType.ECHO, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.MIRROR, count: 8, formation: "v-shape" },
            { type: EnemyType.ECHO, count: 3, formation: "scatter" }]),
    ],
  },
  {
    world: 7, level: 2,
    name: "Temporal Fracture",
    isBoss: false,
    briefingText: "Spacetime is fracturing. Mirror copies are spawning from the seams between moments.",
    waves: [
      wave([{ type: EnemyType.MIRROR, count: 6, formation: "v-shape" }]),
      wave([{ type: EnemyType.SHIELDER, count: 5, formation: "line" },
            { type: EnemyType.MIRROR, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.ECHO, count: 6, formation: "scatter" },
            { type: EnemyType.MIRROR, count: 5, formation: "v-shape" }]),
      wave([{ type: EnemyType.MIRROR, count: 6, formation: "circle" },
            { type: EnemyType.ECHO, count: 5, formation: "line" }]),
      wave([{ type: EnemyType.TURRET, count: 5, formation: "line" },
            { type: EnemyType.MIRROR, count: 5, formation: "line" }]),
      wave([{ type: EnemyType.WRAITH, count: 6, formation: "v-shape" },
            { type: EnemyType.MIRROR, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.SHIELDER, count: 5, formation: "grid" },
            { type: EnemyType.MIRROR, count: 6, formation: "line" }]),
      wave([{ type: EnemyType.ELITE, count: 2, formation: "line" },
            { type: EnemyType.MIRROR, count: 6, formation: "v-shape" }]),
      wave([{ type: EnemyType.ECHO, count: 6, formation: "v-shape" },
            { type: EnemyType.MIRROR, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.MIRROR, count: 8, formation: "line" },
            { type: EnemyType.ECHO, count: 5, formation: "scatter" },
            { type: EnemyType.MINE, count: 9, formation: "scatter" }]),
    ],
  },
  {
    world: 7, level: 3,
    name: "The Visions",
    isBoss: false,
    briefingText: "The crew sees visions -- a launch ceremony, a fleet entering a light, faces transforming. Fight through.",
    waves: [
      wave([{ type: EnemyType.MIRROR, count: 6, formation: "v-shape" },
            { type: EnemyType.CLOAKER, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.BOMBER, count: 8, formation: "single-file" },
            { type: EnemyType.MIRROR, count: 5, formation: "line" }]),
      wave([{ type: EnemyType.MIRROR, count: 6, formation: "circle" },
            { type: EnemyType.ECHO, count: 5, formation: "line" }]),
      wave([{ type: EnemyType.GUNNER, count: 6, formation: "grid" },
            { type: EnemyType.MIRROR, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.SWARM, count: 22, formation: "scatter" },
            { type: EnemyType.MIRROR, count: 3, formation: "line" }]),
      wave([{ type: EnemyType.CLOAKER, count: 6, formation: "scatter" },
            { type: EnemyType.MIRROR, count: 6, formation: "v-shape" }]),
      wave([{ type: EnemyType.ECHO, count: 6, formation: "v-shape" },
            { type: EnemyType.MIRROR, count: 6, formation: "scatter" }]),
      wave([{ type: EnemyType.TURRET, count: 5, formation: "line" },
            { type: EnemyType.WRAITH, count: 5, formation: "line" },
            { type: EnemyType.MIRROR, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.BOMBER, count: 6, formation: "v-shape" },
            { type: EnemyType.MIRROR, count: 6, formation: "grid" }]),
      wave([{ type: EnemyType.ELITE, count: 3, formation: "line" },
            { type: EnemyType.MIRROR, count: 6, formation: "v-shape" }]),
      wave([{ type: EnemyType.WRAITH, count: 6, formation: "circle" },
            { type: EnemyType.MIRROR, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.MIRROR, count: 9, formation: "v-shape" },
            { type: EnemyType.ECHO, count: 5, formation: "scatter" }]),
    ],
  },
  {
    world: 7, level: 4,
    name: "The Lie",
    isBoss: false,
    briefingText: "Navigation logs have been altered since mission start. Something has been guiding us here. Fight to the source.",
    waves: [
      wave([{ type: EnemyType.MIRROR, count: 8, formation: "v-shape" },
            { type: EnemyType.ECHO, count: 6, formation: "scatter" }]),
      wave([{ type: EnemyType.TURRET, count: 6, formation: "line" },
            { type: EnemyType.MIRROR, count: 5, formation: "line" }]),
      wave([{ type: EnemyType.MIRROR, count: 6, formation: "circle" },
            { type: EnemyType.WRAITH, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.ELITE, count: 3, formation: "line" },
            { type: EnemyType.MIRROR, count: 6, formation: "v-shape" }]),
      wave([{ type: EnemyType.BOMBER, count: 9, formation: "scatter" },
            { type: EnemyType.MINE, count: 12, formation: "scatter" }]),
      wave([{ type: EnemyType.ECHO, count: 6, formation: "grid" },
            { type: EnemyType.MIRROR, count: 6, formation: "scatter" }]),
      wave([{ type: EnemyType.MIRROR, count: 9, formation: "v-shape" },
            { type: EnemyType.WRAITH, count: 6, formation: "line" }]),
      wave([{ type: EnemyType.SWARM, count: 24, formation: "scatter" },
            { type: EnemyType.MIRROR, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.GUNNER, count: 8, formation: "grid" },
            { type: EnemyType.MIRROR, count: 6, formation: "line" },
            { type: EnemyType.CLOAKER, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.TURRET, count: 5, formation: "line" },
            { type: EnemyType.MIRROR, count: 8, formation: "v-shape" }]),
      wave([{ type: EnemyType.ELITE, count: 5, formation: "line" },
            { type: EnemyType.MIRROR, count: 8, formation: "v-shape" }]),
    ],
  },
  {
    world: 7, level: 5,
    name: "The Reflection",
    isBoss: true,
    briefingText: "WARNING: A massive warped copy of your own ship. It uses your weapons reflected back. It IS you. From the last cycle.",
    waves: [
      wave([{ type: EnemyType.MIRROR, count: 6, formation: "v-shape" },
            { type: EnemyType.ECHO, count: 5, formation: "scatter" }]),
    ],
  },
];

// ─── World 8: The Hollow Core ─────────────────────────────────────────
const world8: LevelData[] = [
  {
    world: 8, level: 1,
    name: "Outer Membrane",
    isBoss: false,
    briefingText: "The hive's outer shell is infested with bioforms. Burn through before it heals itself.",
    worldIntroText: WORLD_8_INTRO,
    waves: [
      wave([{ type: EnemyType.SWARM, count: 18, formation: "scatter" }]),
      wave([{ type: EnemyType.DRONE, count: 9, formation: "v-shape" },
            { type: EnemyType.SCOUT, count: 9, formation: "circle" }]),
      wave([{ type: EnemyType.CLOAKER, count: 6, formation: "scatter" },
            { type: EnemyType.SWARM, count: 12, formation: "scatter" }]),
      wave([{ type: EnemyType.GUNNER, count: 6, formation: "grid" },
            { type: EnemyType.SHIELDER, count: 5, formation: "line" }]),
      wave([{ type: EnemyType.BOMBER, count: 8, formation: "single-file" },
            { type: EnemyType.DRONE, count: 8, formation: "circle" }]),
      wave([{ type: EnemyType.ELITE, count: 3, formation: "line" },
            { type: EnemyType.SWARM, count: 15, formation: "scatter" }]),
      wave([{ type: EnemyType.SHIELDER, count: 6, formation: "grid" },
            { type: EnemyType.GUNNER, count: 6, formation: "v-shape" }]),
      wave([{ type: EnemyType.BOMBER, count: 9, formation: "scatter" },
            { type: EnemyType.CLOAKER, count: 6, formation: "scatter" }]),
      wave([{ type: EnemyType.ELITE, count: 3, formation: "line" },
            { type: EnemyType.DRONE, count: 9, formation: "line" }]),
      wave([{ type: EnemyType.TURRET, count: 5, formation: "line" },
            { type: EnemyType.GUNNER, count: 6, formation: "grid" },
            { type: EnemyType.SWARM, count: 12, formation: "scatter" }]),
    ],
  },
  {
    world: 8, level: 2,
    name: "Neural Pathways",
    isBoss: false,
    briefingText: "We're inside. These corridors pulse with some kind of neural energy. Follow the signal.",
    waves: [
      wave([{ type: EnemyType.CLOAKER, count: 8, formation: "scatter" },
            { type: EnemyType.DRONE, count: 9, formation: "v-shape" }]),
      wave([{ type: EnemyType.ELITE, count: 3, formation: "line" },
            { type: EnemyType.SHIELDER, count: 6, formation: "line" }]),
      wave([{ type: EnemyType.GUNNER, count: 8, formation: "circle" },
            { type: EnemyType.CLOAKER, count: 5, formation: "scatter" }]),
      wave([{ type: EnemyType.BOMBER, count: 9, formation: "scatter" },
            { type: EnemyType.GUNNER, count: 6, formation: "grid" }]),
      wave([{ type: EnemyType.SWARM, count: 24, formation: "scatter" },
            { type: EnemyType.CLOAKER, count: 6, formation: "scatter" }]),
      wave([{ type: EnemyType.SHIELDER, count: 6, formation: "v-shape" },
            { type: EnemyType.DRONE, count: 8, formation: "grid" }]),
      wave([{ type: EnemyType.TURRET, count: 6, formation: "line" },
            { type: EnemyType.ELITE, count: 3, formation: "line" }]),
      wave([{ type: EnemyType.MINE, count: 15, formation: "scatter" },
            { type: EnemyType.SHIELDER, count: 6, formation: "line" }]),
      wave([{ type: EnemyType.BOMBER, count: 8, formation: "single-file" },
            { type: EnemyType.CLOAKER, count: 6, formation: "scatter" }]),
      wave([{ type: EnemyType.TURRET, count: 5, formation: "grid" },
            { type: EnemyType.ELITE, count: 3, formation: "line" }]),
      wave([{ type: EnemyType.ELITE, count: 5, formation: "line" },
            { type: EnemyType.GUNNER, count: 8, formation: "grid" },
            { type: EnemyType.CLOAKER, count: 5, formation: "scatter" }]),
    ],
  },
  {
    world: 8, level: 3,
    name: "Spawning Chamber",
    isBoss: false,
    briefingText: "They're producing new units at an alarming rate. Destroy the spawning pods or we'll be overrun.",
    waves: [
      wave([{ type: EnemyType.SWARM, count: 28, formation: "scatter" }]),
      wave([{ type: EnemyType.DRONE, count: 12, formation: "circle" },
            { type: EnemyType.SCOUT, count: 12, formation: "v-shape" }]),
      wave([{ type: EnemyType.CLOAKER, count: 6, formation: "scatter" },
            { type: EnemyType.GUNNER, count: 6, formation: "v-shape" }]),
      wave([{ type: EnemyType.ELITE, count: 5, formation: "line" },
            { type: EnemyType.BOMBER, count: 8, formation: "scatter" }]),
      wave([{ type: EnemyType.TURRET, count: 6, formation: "grid" },
            { type: EnemyType.SHIELDER, count: 6, formation: "line" }]),
      wave([{ type: EnemyType.SWARM, count: 30, formation: "scatter" },
            { type: EnemyType.CLOAKER, count: 6, formation: "scatter" }]),
      wave([{ type: EnemyType.SHIELDER, count: 6, formation: "circle" },
            { type: EnemyType.ELITE, count: 3, formation: "line" }]),
      wave([{ type: EnemyType.GUNNER, count: 9, formation: "grid" },
            { type: EnemyType.ELITE, count: 3, formation: "line" }]),
      wave([{ type: EnemyType.BOMBER, count: 12, formation: "scatter" },
            { type: EnemyType.MINE, count: 15, formation: "scatter" }]),
      wave([{ type: EnemyType.DRONE, count: 9, formation: "v-shape" },
            { type: EnemyType.TURRET, count: 5, formation: "line" }]),
      wave([{ type: EnemyType.SWARM, count: 22, formation: "scatter" },
            { type: EnemyType.BOMBER, count: 8, formation: "single-file" }]),
      wave([{ type: EnemyType.ELITE, count: 5, formation: "line" },
            { type: EnemyType.TURRET, count: 5, formation: "line" },
            { type: EnemyType.SWARM, count: 18, formation: "scatter" }]),
    ],
  },
  {
    world: 8, level: 4,
    name: "The Nerve Center",
    isBoss: false,
    briefingText: "We've reached the hive mind's core defenses. Every unit in the sector is converging on us.",
    waves: [
      wave([{ type: EnemyType.ELITE, count: 5, formation: "line" },
            { type: EnemyType.CLOAKER, count: 8, formation: "scatter" }]),
      wave([{ type: EnemyType.TURRET, count: 6, formation: "grid" },
            { type: EnemyType.SHIELDER, count: 6, formation: "line" }]),
      wave([{ type: EnemyType.GUNNER, count: 8, formation: "circle" },
            { type: EnemyType.CLOAKER, count: 6, formation: "scatter" }]),
      wave([{ type: EnemyType.BOMBER, count: 12, formation: "scatter" },
            { type: EnemyType.GUNNER, count: 8, formation: "grid" }]),
      wave([{ type: EnemyType.SWARM, count: 30, formation: "scatter" },
            { type: EnemyType.ELITE, count: 3, formation: "line" }]),
      wave([{ type: EnemyType.SHIELDER, count: 6, formation: "v-shape" },
            { type: EnemyType.TURRET, count: 6, formation: "line" }]),
      wave([{ type: EnemyType.CLOAKER, count: 9, formation: "scatter" },
            { type: EnemyType.TURRET, count: 5, formation: "line" },
            { type: EnemyType.MINE, count: 12, formation: "scatter" }]),
      wave([{ type: EnemyType.ELITE, count: 6, formation: "line" },
            { type: EnemyType.SHIELDER, count: 6, formation: "line" }]),
      wave([{ type: EnemyType.BOMBER, count: 9, formation: "single-file" },
            { type: EnemyType.ELITE, count: 3, formation: "line" }]),
      wave([{ type: EnemyType.GUNNER, count: 9, formation: "grid" },
            { type: EnemyType.BOMBER, count: 9, formation: "scatter" },
            { type: EnemyType.CLOAKER, count: 6, formation: "scatter" }]),
      wave([{ type: EnemyType.SWARM, count: 24, formation: "scatter" },
            { type: EnemyType.CLOAKER, count: 8, formation: "scatter" }]),
      wave([{ type: EnemyType.ELITE, count: 6, formation: "line" },
            { type: EnemyType.TURRET, count: 6, formation: "grid" },
            { type: EnemyType.SWARM, count: 22, formation: "scatter" }]),
    ],
  },
  {
    world: 8, level: 5,
    name: "The Hollow Mind",
    isBoss: true,
    briefingText: "WARNING: This is the intelligence behind everything. Destroy it and the Hollow forces collapse. Fail, and humanity falls.",
    waves: [
      wave([{ type: EnemyType.ELITE, count: 5, formation: "line" },
            { type: EnemyType.CLOAKER, count: 6, formation: "scatter" },
            { type: EnemyType.SWARM, count: 15, formation: "scatter" }]),
    ],
  },
];

// ─── Export all levels ───────────────────────────────────────────────
export const ALL_LEVELS: LevelData[] = [
  ...world1,
  ...world2,
  ...world3,
  ...world4,
  ...world5,
  ...world6,
  ...world7,
  ...world8,
];

export function getLevelData(world: number, level: number): LevelData | undefined {
  return ALL_LEVELS.find((l) => l.world === world && l.level === level);
}

export function getLevelKey(world: number, level: number): string {
  return `${world}-${level}`;
}

export function getWorldLevelCount(world: number): number {
  return ALL_LEVELS.filter((l) => l.world === world).length;
}

/**
 * Get multi-phase level data. Returns null for standard single-phase levels.
 * Extension point for future multi-phase content.
 */
export function getMultiPhaseLevelData(
  world: number,
  level: number
): MultiPhaseLevelData | null {
  const baseLevel = getLevelData(world, level);
  if (!baseLevel) return null;

  // Helper to wrap base level as Phase 1 (shooter) + a Phase 2 in another mode
  function makeMultiPhase(
    mode: import("./types").GameMode,
    cardText: string,
    cardSubtext: string,
    rewards?: import("./types").MaterialId[]
  ): MultiPhaseLevelData {
    return {
      world,
      level,
      name: baseLevel!.name,
      briefingText: baseLevel!.briefingText,
      worldIntroText: baseLevel!.worldIntroText,
      phases: [
        {
          config: {
            mode: "shooter",
            waves: baseLevel!.waves,
            isBoss: baseLevel!.isBoss,
          },
        },
        {
          config: {
            mode,
            waves: [],
            isBoss: false,
          },
          transitionIn: {
            cardText,
            cardSubtext,
            duration: 180,
          },
        },
      ],
      completionRewards: rewards,
    };
  }

  // ── World 1, Level 3: Ground Run-and-Gun ──
  if (world === 1 && level === 3) {
    return makeMultiPhase(
      "ground-run",
      "GROUND DEPLOYMENT",
      "Phase 2: Reach the extraction point",
      ["kinetic-core"]
    );
  }

  // ── World 2, Level 3: Ship Boarding ──
  if (world === 2 && level === 3) {
    return makeMultiPhase(
      "boarding",
      "DERELICT DETECTED",
      "Phase 2: Board the vessel and extract the data core",
      ["energy-cell"]
    );
  }

  // ── World 3, Level 3: Ship Turret ──
  if (world === 3 && level === 3) {
    return makeMultiPhase(
      "turret",
      "ENEMY FIGHTERS SCRAMBLING",
      "Phase 2: Man the turret — defend the Vanguard!",
      ["ember-shard"]
    );
  }

  // ── World 5, Level 3: First-Person Exploration ──
  if (world === 5 && level === 3) {
    return makeMultiPhase(
      "first-person",
      "ANCIENT STATION DETECTED",
      "Phase 2: Investigate the abandoned facility on foot",
      ["cryo-essence"]
    );
  }

  // ── World 6, Level 3: Ground Run-and-Gun ──
  if (world === 6 && level === 3) {
    return makeMultiPhase(
      "ground-run",
      "SURFACE ASSAULT",
      "Phase 2: Clear the Hollow ground forces",
      ["void-fragment"]
    );
  }

  // ── World 7, Level 3: Ship Boarding ──
  if (world === 7 && level === 3) {
    return makeMultiPhase(
      "boarding",
      "HOLLOW VESSEL INTERCEPTED",
      "Phase 2: Board and sabotage the reactor",
      ["hollow-resonance"]
    );
  }

  // ── World 8, Level 3: Ship Turret (final approach) ──
  if (world === 8 && level === 3) {
    return makeMultiPhase(
      "turret",
      "FINAL APPROACH",
      "Phase 2: Defend the Vanguard — all hands to turrets!",
    );
  }

  return null;
}

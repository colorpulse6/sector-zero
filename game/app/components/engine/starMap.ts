import { CANVAS_WIDTH, type Keys, type PlanetId, type SaveData } from "./types";
import { ALL_LEVELS, WORLD_NAMES, getWorldLevelCount } from "./levels";
import { PLANET_DEFS, isPlanetUnlocked, isPlanetCompleted, getPlanetsForWorld } from "./planets";

// ─── Star Map State ─────────────────────────────────────────────────
export interface StarMapState {
  selectedWorld: number;
  selectedLevel: number;
  expanded: boolean; // whether level sub-nodes are showing
  animTimer: number;
}

export function createStarMapState(): StarMapState {
  return {
    selectedWorld: 1,
    selectedLevel: 1,
    expanded: false,
    animTimer: 0,
  };
}

// ─── World Node Layout ──────────────────────────────────────────────
export interface WorldNodeLayout {
  world: number;
  name: string;
  x: number;
  y: number;
  color: string;
  unlocked: boolean;
}

export interface LevelNodeLayout {
  world: number;
  level: number;
  name: string;
  x: number;
  y: number;
  unlocked: boolean;
  completed: boolean;
  stars: number;
  isBoss: boolean;
}

const WORLD_COLORS = [
  "#ff9944", // Aurelia Belt — amber/orange
  "#44aaff", // Cryon Nebula — ice blue
  "#ff4422", // Ignis Rift — red/orange
  "#667788", // The Graveyard — cold grey-blue
  "#8844cc", // Void Abyss — deep purple
  "#ff6644", // The Scar — signal distortion orange
  "#4466ff", // The Fold — temporal blue
  "#44cc66", // The Hollow Core — sickly green
];

export function getWorldNodes(save: SaveData): WorldNodeLayout[] {
  // Arc layout from left to right across the canvas
  const positions = [
    { x: 60, y: 720 },
    { x: 110, y: 620 },
    { x: 160, y: 530 },
    { x: 210, y: 450 },
    { x: 260, y: 380 },
    { x: 310, y: 310 },
    { x: 360, y: 240 },
    { x: 410, y: 170 },
  ];

  return positions.map((pos, i) => ({
    world: i + 1,
    name: WORLD_NAMES[i],
    x: pos.x,
    y: pos.y,
    color: WORLD_COLORS[i],
    unlocked: isWorldUnlocked(i + 1, save),
  }));
}

export function getLevelNodes(
  world: number,
  worldNode: WorldNodeLayout,
  save: SaveData
): LevelNodeLayout[] {
  const count = getWorldLevelCount(world);
  const nodes: LevelNodeLayout[] = [];

  for (let lvl = 1; lvl <= count; lvl++) {
    const levelData = ALL_LEVELS.find((l) => l.world === world && l.level === lvl);
    const key = `${world}-${lvl}`;
    const saveLevel = save.levels[key];

    nodes.push({
      world,
      level: lvl,
      name: levelData?.name ?? `Level ${lvl}`,
      // Vertical column to the right of the world node
      x: worldNode.x + 60,
      y: worldNode.y - 60 + (lvl - 1) * 35,
      unlocked: isLevelUnlocked(world, lvl, save),
      completed: saveLevel?.completed ?? false,
      stars: saveLevel?.stars ?? 0,
      isBoss: levelData?.isBoss ?? false,
    });
  }

  return nodes;
}

// ─── Unlock Logic ───────────────────────────────────────────────────
export function isWorldUnlocked(world: number, save: SaveData): boolean {
  if (world === 1) return true;
  // World N unlocked when boss of the nearest preceding world with content is beaten.
  // Skip worlds that have no levels yet (e.g., worlds 4, 6, 7 before they're built).
  for (let prev = world - 1; prev >= 1; prev--) {
    const prevCount = getWorldLevelCount(prev);
    if (prevCount > 0) {
      const prevBossKey = `${prev}-${prevCount}`;
      return save.levels[prevBossKey]?.completed ?? false;
    }
  }
  return true; // No preceding worlds have content, so unlocked
}

export function isLevelUnlocked(world: number, level: number, save: SaveData): boolean {
  if (!isWorldUnlocked(world, save)) return false;
  if (level === 1) return true;
  // Level X-N unlocked when Level X-(N-1) is completed
  const prevKey = `${world}-${level - 1}`;
  return save.levels[prevKey]?.completed ?? false;
}

// ─── Planet Node Layout (visual only — launching is from cockpit) ───

export interface PlanetNodeLayout {
  planetId: PlanetId;
  name: string;
  x: number;
  y: number;
  color: string;
  unlocked: boolean;
  completed: boolean;
  pairedWorld: number;
  objective: string;
}

export function getPlanetNodes(save: SaveData): PlanetNodeLayout[] {
  const worldNodes = getWorldNodes(save);

  return PLANET_DEFS.map((planet) => {
    const worldNode = worldNodes[planet.pairedWorld - 1];
    return {
      planetId: planet.id,
      name: planet.name,
      // Offset to the left/below the paired world node
      x: worldNode.x - 40,
      y: worldNode.y + 35,
      color: planet.color,
      unlocked: isPlanetUnlocked(planet, save),
      completed: isPlanetCompleted(planet.id, save),
      pairedWorld: planet.pairedWorld,
      objective: planet.objectiveLabel,
    };
  });
}

// ─── Input Handling ─────────────────────────────────────────────────
export interface StarMapAction {
  type: "select-level" | "back" | "none";
  world?: number;
  level?: number;
}

// Track key state to prevent repeated navigation
let prevKeys: Keys | null = null;

export function updateStarMap(
  state: StarMapState,
  keys: Keys,
  save: SaveData
): { newState: StarMapState; action: StarMapAction } {
  const s = { ...state, animTimer: state.animTimer + 1 };
  const justPressed = {
    up: keys.up && (!prevKeys || !prevKeys.up),
    down: keys.down && (!prevKeys || !prevKeys.down),
    left: keys.left && (!prevKeys || !prevKeys.left),
    right: keys.right && (!prevKeys || !prevKeys.right),
    shoot: keys.shoot && (!prevKeys || !prevKeys.shoot),
  };
  prevKeys = { ...keys };

  if (!s.expanded) {
    // World selection mode
    if (justPressed.up && s.selectedWorld > 1) {
      // Find next unlocked world going up
      for (let w = s.selectedWorld - 1; w >= 1; w--) {
        if (isWorldUnlocked(w, save)) {
          s.selectedWorld = w;
          break;
        }
      }
    }
    if (justPressed.down && s.selectedWorld < 8) {
      for (let w = s.selectedWorld + 1; w <= 8; w++) {
        if (isWorldUnlocked(w, save)) {
          s.selectedWorld = w;
          break;
        }
      }
    }
    if (justPressed.shoot && isWorldUnlocked(s.selectedWorld, save)) {
      s.expanded = true;
      s.selectedLevel = 1;
    }
    // Left = back to menu
    if (justPressed.left) {
      return { newState: s, action: { type: "back" } };
    }
    // Right also expands
    if (justPressed.right && isWorldUnlocked(s.selectedWorld, save)) {
      s.expanded = true;
      s.selectedLevel = 1;
    }
  } else {
    // Level selection mode (planets are visual-only, launched from cockpit)
    const count = getWorldLevelCount(s.selectedWorld);

    if (justPressed.up && s.selectedLevel > 1) {
      s.selectedLevel -= 1;
    }
    if (justPressed.down && s.selectedLevel < count) {
      s.selectedLevel += 1;
    }
    if (justPressed.left) {
      s.expanded = false;
    }
    if (justPressed.shoot && isLevelUnlocked(s.selectedWorld, s.selectedLevel, save)) {
      return {
        newState: s,
        action: { type: "select-level", world: s.selectedWorld, level: s.selectedLevel },
      };
    }
  }

  return { newState: s, action: { type: "none" } };
}

export function resetStarMapKeys(): void {
  prevKeys = null;
}

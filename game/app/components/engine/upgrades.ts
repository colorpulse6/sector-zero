import type { MaterialId, SaveData, ShipUpgrades } from "./types";
import { hasMaterial } from "./planets";

// ─── Upgrade Definitions ────────────────────────────────────────────

export interface UpgradeDef {
  id: keyof ShipUpgrades;
  name: string;
  description: string;
  maxLevel: number;
  costs: number[];       // cost per level (index 0 = cost to go from lv0→lv1)
  effects: string[];     // description per level
  icon: string;          // character icon for fallback rendering
  color: string;
  // XP required to unlock each upgrade tier (index 0 = XP for lv1, etc.)
  xpRequired: number[];
  // Material required per tier (undefined = no material needed for that tier)
  materialRequired: (MaterialId | undefined)[];
}

export const UPGRADE_DEFS: UpgradeDef[] = [
  {
    id: "hullPlating",
    name: "HULL PLATING",
    description: "Reinforced hull absorbs more damage",
    maxLevel: 5,
    costs: [200, 500, 1000, 2500, 5000],
    effects: ["+1 Max HP (4 total)", "+2 Max HP (5 total)", "+3 Max HP (6 total)", "+3 Max HP + regen between waves", "+4 Max HP (7 total)"],
    icon: "\u2666",  // diamond
    color: "#44aaff",
    xpRequired: [0, 8000, 25000, 50000, 100000],
    materialRequired: [undefined, "bio-fiber", "abyssal-plating", "cryo-essence", "void-fragment"],
  },
  {
    id: "engineBoost",
    name: "ENGINE BOOST",
    description: "Overclocked thrusters for faster movement",
    maxLevel: 5,
    costs: [150, 400, 800, 2000, 4000],
    effects: ["+0.5 Speed", "+1.0 Speed", "+1.5 Speed", "+2.0 Speed", "+2.5 Speed"],
    icon: "\u25B2",  // triangle up
    color: "#ffaa44",
    xpRequired: [0, 8000, 20000, 45000, 90000],
    materialRequired: [undefined, "cryogenic-alloy", undefined, "energy-cell", "void-fragment"],
  },
  {
    id: "weaponCore",
    name: "WEAPON CORE",
    description: "Start missions with stronger weapons",
    maxLevel: 5,
    costs: [300, 800, 1500, 3000, 6000],
    effects: ["Start at Weapon Lv 2", "Start at Weapon Lv 3", "Start at Weapon Lv 4", "Start at Weapon Lv 5", "Start at Weapon Lv 5"],
    icon: "\u2726",  // star
    color: "#ff4444",
    xpRequired: [5000, 25000, 40000, 60000, 120000],
    materialRequired: [undefined, "molten-core", "kinetic-core", "ember-shard", "hollow-resonance"],
  },
  {
    id: "munitionsBay",
    name: "MUNITIONS BAY",
    description: "Expanded storage for additional bombs",
    maxLevel: 5,
    costs: [200, 500, 1000, 2000, 4500],
    effects: ["+1 Starting Bomb (3)", "+2 Starting Bombs (4)", "+3 Starting Bombs (5)", "+4 Starting Bombs (6)", "+5 Starting Bombs (7)"],
    icon: "\u25CF",  // filled circle
    color: "#ff3333",
    xpRequired: [0, 8000, 20000, 45000, 90000],
    materialRequired: [undefined, "ruin-shard", undefined, "ember-shard", "hollow-resonance"],
  },
  {
    id: "fireControl",
    name: "FIRE CONTROL",
    description: "Targeting computer increases fire rate",
    maxLevel: 5,
    costs: [250, 600, 1200, 2500, 5000],
    effects: ["-1 Frame Fire Delay", "-2 Frame Fire Delay", "-3 Frame Fire Delay", "-3 Frame Fire Delay + tracking", "-4 Frame Fire Delay"],
    icon: "\u2694",  // crossed swords
    color: "#44ff88",
    xpRequired: [15000, 40000, 55000, 75000, 130000],
    materialRequired: [undefined, "desert-glass", "kinetic-core", "energy-cell", "void-fragment"],
  },
  {
    id: "shieldGenerator",
    name: "SHIELD GEN",
    description: "Shield power-ups last longer",
    maxLevel: 5,
    costs: [300, 700, 1400, 3000, 5500],
    effects: ["+200 Shield Duration", "+400 Shield Duration", "+600 Shield Duration", "+800 Shield Duration", "+1000 Shield Duration"],
    icon: "\u2B21",  // hexagon
    color: "#4488ff",
    xpRequired: [5000, 25000, 40000, 60000, 110000],
    materialRequired: [undefined, "phase-crystal", "cryo-essence", "energy-cell", "hollow-resonance"],
  },
];

// ─── Helpers ────────────────────────────────────────────────────────

/** Check if a specific upgrade level is unlocked based on XP and materials */
export function isUpgradeLevelUnlocked(
  def: UpgradeDef,
  targetLevel: number,
  save: SaveData
): boolean {
  if (targetLevel <= 0 || targetLevel > def.maxLevel) return false;
  const req = def.xpRequired[targetLevel - 1];
  if (req === undefined) return false;
  if (save.xp < req) return false;
  // Check material requirement
  const mat = def.materialRequired[targetLevel - 1];
  if (mat && !hasMaterial(mat, save)) return false;
  return true;
}

/** Get the unlock requirement text for the next level */
export function getUnlockRequirement(def: UpgradeDef, currentLevel: number, save: SaveData): string | null {
  if (currentLevel >= def.maxLevel) return null;

  const parts: string[] = [];

  // Check XP requirement
  const req = def.xpRequired[currentLevel];
  if (req !== undefined && save.xp < req) {
    parts.push(`${req.toLocaleString()} XP`);
  }

  // Check material requirement
  const mat = def.materialRequired[currentLevel];
  if (mat && !hasMaterial(mat, save)) {
    // Import-safe: format material name from id
    const matName = mat.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    parts.push(matName);
  }

  if (parts.length === 0) return null;
  return `Requires ${parts.join(" + ")}`;
}

/** Get the XP progress for the next tier (0-1) */
export function getXpProgress(def: UpgradeDef, currentLevel: number, save: SaveData): number {
  if (currentLevel >= def.maxLevel) return 1;
  const req = def.xpRequired[currentLevel];
  if (req === undefined || req === 0) return 1;
  return Math.min(1, save.xp / req);
}

export function getUpgradeCost(def: UpgradeDef, currentLevel: number): number | null {
  if (currentLevel >= def.maxLevel) return null;
  return def.costs[currentLevel];
}

export function canPurchase(save: SaveData, def: UpgradeDef, currentLevel: number): boolean {
  const cost = getUpgradeCost(def, currentLevel);
  if (cost === null) return false;
  if (save.credits < cost) return false;
  return isUpgradeLevelUnlocked(def, currentLevel + 1, save);
}

export function getNextEffect(def: UpgradeDef, currentLevel: number): string | null {
  if (currentLevel >= def.maxLevel) return null;
  return def.effects[currentLevel];
}

export function getCurrentEffect(def: UpgradeDef, currentLevel: number): string | null {
  if (currentLevel === 0) return null;
  return def.effects[currentLevel - 1];
}

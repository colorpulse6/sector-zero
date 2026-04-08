import type {
  ConsumableId,
  EnhancementId,
  MaterialId,
  ObjectiveType,
  PlanetId,
  SaveData,
} from "./types";

// ─── Planet Definition ──────────────────────────────────────────────

export interface PlanetDef {
  id: PlanetId;
  name: string;
  subtitle: string;
  theme: string;
  pairedWorld: number;
  objective: ObjectiveType;
  objectiveLabel: string;
  /** Collect: target count / Survive: target seconds / Escort/Defend: entity maxHp */
  objectiveValue: number;
  color: string;
  /** Unlock: must have completed this level key (e.g. "1-3") */
  unlockAfterLevel: string;
  /** Unlock: minimum total stars */
  unlockStars: number;
  /** Material awarded on first completion */
  material: MaterialId;
  /** Consumable unlocked on completion (if any) */
  consumableUnlock?: ConsumableId;
  /** Power-up enhancement unlocked on completion (if any) */
  enhancementUnlock?: EnhancementId;
  /** Background sprite keys (far, mid, near) */
  bgKeys: [string, string, string];
  /** Map icon sprite key */
  mapIcon: string;
  /** Brief description shown on star map */
  description: string;
}

export const PLANET_DEFS: PlanetDef[] = [
  // ── Planet 1: Verdania ─────────────────────────────────────────────
  {
    id: "verdania",
    name: "Verdania",
    subtitle: "The Living Jungle",
    theme: "jungle",
    pairedWorld: 1,
    objective: "collect",
    objectiveLabel: "Gather 20 bio-samples",
    objectiveValue: 20,
    color: "#33cc66",
    unlockAfterLevel: "1-3",
    unlockStars: 0,
    material: "bio-fiber",
    consumableUnlock: "hull-repair",
    bgKeys: ["BG_VERDANIA_FAR", "BG_VERDANIA_MID", "BG_VERDANIA_NEAR"],
    mapIcon: "MAP_PLANET_1",
    description: "Dense alien jungle. Colonist bio-signatures detected in the canopy.",
  },
  // ── Planet 2: Glaciem ──────────────────────────────────────────────
  {
    id: "glaciem",
    name: "Glaciem",
    subtitle: "The Frozen Wastes",
    theme: "arctic",
    pairedWorld: 2,
    objective: "survive",
    objectiveLabel: "Survive 3 minutes",
    objectiveValue: 180, // seconds
    color: "#66ccff",
    unlockAfterLevel: "2-3",
    unlockStars: 8,
    material: "cryogenic-alloy",
    consumableUnlock: "cryo-charge",
    enhancementUnlock: "reinforced-shield",
    bgKeys: ["BG_GLACIEM_FAR", "BG_GLACIEM_MID", "BG_GLACIEM_NEAR"],
    mapIcon: "MAP_PLANET_2",
    description: "Ice world. Cryogenic pods detected beneath the surface.",
  },
  // ── Planet 3: Pyraxis ──────────────────────────────────────────────
  {
    id: "pyraxis",
    name: "Pyraxis",
    subtitle: "The Crucible",
    theme: "volcanic",
    pairedWorld: 3,
    objective: "escort",
    objectiveLabel: "Escort survey craft to extraction",
    objectiveValue: 10, // escort HP
    color: "#ff6622",
    unlockAfterLevel: "3-3",
    unlockStars: 15,
    material: "molten-core",
    enhancementUnlock: "incendiary-bombs",
    bgKeys: ["BG_PYRAXIS_FAR", "BG_PYRAXIS_MID", "BG_PYRAXIS_NEAR"],
    mapIcon: "MAP_PLANET_3",
    description: "Volcanic hellscape. Mining tunnels reach deep into the mantle.",
  },
  // ── Planet 4: Ossuary ──────────────────────────────────────────────
  {
    id: "ossuary",
    name: "Ossuary",
    subtitle: "The Temple of Bone",
    theme: "ruins",
    pairedWorld: 4,
    objective: "defend",
    objectiveLabel: "Defend the excavation site",
    objectiveValue: 15, // structure HP
    color: "#998866",
    unlockAfterLevel: "3-5",
    unlockStars: 20,
    material: "ruin-shard",
    consumableUnlock: "shield-charge",
    bgKeys: ["BG_OSSUARY_FAR", "BG_OSSUARY_MID", "BG_OSSUARY_NEAR"],
    mapIcon: "MAP_PLANET_4",
    description: "Ancient ruins. These temples were built by human hands.",
  },
  // ── Planet 5: Abyssia ──────────────────────────────────────────────
  {
    id: "abyssia",
    name: "Abyssia",
    subtitle: "The Sunken City",
    theme: "ocean",
    pairedWorld: 5,
    objective: "collect",
    objectiveLabel: "Salvage 25 wreckage fragments",
    objectiveValue: 25,
    color: "#2266cc",
    unlockAfterLevel: "4-5",
    unlockStars: 28,
    material: "abyssal-plating",
    enhancementUnlock: "extended-magnet",
    bgKeys: ["BG_ABYSSIA_FAR", "BG_ABYSSIA_MID", "BG_ABYSSIA_NEAR"],
    mapIcon: "MAP_PLANET_5",
    description: "Underwater world. The most advanced colony resisted longest.",
  },
  // ── Planet 6: Ashfall ──────────────────────────────────────────────
  {
    id: "ashfall",
    name: "Ashfall",
    subtitle: "The Last Outpost",
    theme: "desert",
    pairedWorld: 6,
    objective: "survive",
    objectiveLabel: "Survive 3:30 in the dust storm",
    objectiveValue: 210, // seconds
    color: "#cc8833",
    unlockAfterLevel: "5-5",
    unlockStars: 36,
    material: "desert-glass",
    consumableUnlock: "weapon-overcharge",
    bgKeys: ["BG_ASHFALL_FAR", "BG_ASHFALL_MID", "BG_ASHFALL_NEAR"],
    mapIcon: "MAP_PLANET_6",
    description: "Desert outpost. A distress signal still broadcasts after 400 years.",
  },
  // ── Planet 7: Prismara ─────────────────────────────────────────────
  {
    id: "prismara",
    name: "Prismara",
    subtitle: "The Crystal Mind",
    theme: "crystal",
    pairedWorld: 7,
    objective: "escort",
    objectiveLabel: "Guide resonance probe to the core",
    objectiveValue: 8, // escort HP (harder — fewer HP)
    color: "#aa44ff",
    unlockAfterLevel: "6-5",
    unlockStars: 44,
    material: "phase-crystal",
    enhancementUnlock: "homing-gunners",
    bgKeys: ["BG_PRISMARA_FAR", "BG_PRISMARA_MID", "BG_PRISMARA_NEAR"],
    mapIcon: "MAP_PLANET_7",
    description: "Crystal caverns. The crystals are solidified neural pathways.",
  },
  // ── Planet 8: Genesis ──────────────────────────────────────────────
  {
    id: "genesis",
    name: "Genesis",
    subtitle: "The Garden of Memory",
    theme: "garden",
    pairedWorld: 8,
    objective: "defend",
    objectiveLabel: "Defend against the Hollow remnants",
    objectiveValue: 12, // structure HP (harder)
    color: "#66cc33",
    unlockAfterLevel: "7-5",
    unlockStars: 52,
    material: "genesis-seed",
    enhancementUnlock: "resonance-field",
    bgKeys: ["BG_GENESIS_FAR", "BG_GENESIS_MID", "BG_GENESIS_NEAR"],
    mapIcon: "MAP_PLANET_8",
    description: "A paradise grown from Hollow biomass. Memories encoded in every leaf.",
  },
  // ── Planet 9: Luminos (Neon Metropolis) ────────────────────────────
  {
    id: "luminos",
    name: "Luminos",
    subtitle: "The Neon Graveyard",
    theme: "neon-city",
    pairedWorld: 4,
    objective: "collect",
    objectiveLabel: "Salvage 22 data cores",
    objectiveValue: 22,
    color: "#cc44ff",
    unlockAfterLevel: "4-3",
    unlockStars: 25,
    material: "neon-circuitry",
    bgKeys: ["BG_LUMINOS_FAR", "BG_LUMINOS_MID", "BG_LUMINOS_NEAR"],
    mapIcon: "MAP_PLANET_9",
    description: "A colony city that still runs itself. The people became the circuitry.",
  },
  // ── Planet 10: Bastion (Fortress Industrial) ──────────────────────
  {
    id: "bastion",
    name: "Bastion",
    subtitle: "The Iron Fortress",
    theme: "fortress-city",
    pairedWorld: 6,
    objective: "defend",
    objectiveLabel: "Defend the last reactor",
    objectiveValue: 14, // structure HP
    color: "#cc6633",
    unlockAfterLevel: "6-3",
    unlockStars: 40,
    material: "ferro-steel",
    bgKeys: ["BG_BASTION_FAR", "BG_BASTION_MID", "BG_BASTION_NEAR"],
    mapIcon: "MAP_PLANET_10",
    description: "The military colony. They built walls against everything except themselves.",
  },
];

// ─── Material Definitions ───────────────────────────────────────────

export interface MaterialDef {
  id: MaterialId;
  name: string;
  icon: string;
  color: string;
  sourcePlanet?: PlanetId;  // Optional for rare/legendary materials
  description: string;
}

export const MATERIAL_DEFS: MaterialDef[] = [
  { id: "bio-fiber", name: "Bio-Fiber", icon: "🌿", color: "#33cc66", sourcePlanet: "verdania", description: "Organic composite from Verdania's canopy" },
  { id: "cryogenic-alloy", name: "Cryogenic Alloy", icon: "❄", color: "#66ccff", sourcePlanet: "glaciem", description: "Supercooled metal from Glaciem's ice sheets" },
  { id: "molten-core", name: "Molten Core", icon: "🔥", color: "#ff6622", sourcePlanet: "pyraxis", description: "Magma-forged mineral from Pyraxis" },
  { id: "ruin-shard", name: "Ruin Shard", icon: "🔷", color: "#998866", sourcePlanet: "ossuary", description: "Ancient alloy fragment from Ossuary's temples" },
  { id: "abyssal-plating", name: "Abyssal Plating", icon: "🌊", color: "#2266cc", sourcePlanet: "abyssia", description: "Pressure-hardened hull from Abyssia's depths" },
  { id: "desert-glass", name: "Desert Glass", icon: "💎", color: "#cc8833", sourcePlanet: "ashfall", description: "Fulgurite crystal from Ashfall's storms" },
  { id: "phase-crystal", name: "Phase Crystal", icon: "🔮", color: "#aa44ff", sourcePlanet: "prismara", description: "Refractive crystal from Prismara's caverns" },
  { id: "genesis-seed", name: "Genesis Seed", icon: "🌱", color: "#66cc33", sourcePlanet: "genesis", description: "Hollow bio-catalyst from Genesis" },
  { id: "neon-circuitry", name: "Neon Circuitry", icon: "⚡", color: "#cc44ff", sourcePlanet: "luminos", description: "Living circuit substrate from Luminos" },
  { id: "ferro-steel", name: "Ferro-Steel", icon: "🛡", color: "#cc6633", sourcePlanet: "bastion", description: "Militarized hull alloy from Bastion" },
  // ── Rare Materials ──
  { id: "kinetic-core", name: "Kinetic Core", icon: "◆", color: "#e8e8ee", description: "Dense projectile matrix. Required for prestige weapon upgrades." },
  { id: "energy-cell", name: "Energy Cell", icon: "◆", color: "#44ccff", description: "Concentrated energy lattice. Powers prestige shield and engine systems." },
  { id: "ember-shard", name: "Ember Shard", icon: "◆", color: "#ff6a1a", description: "Volatile incendiary fragment. Fuels prestige munitions upgrades." },
  { id: "cryo-essence", name: "Cryo Essence", icon: "◆", color: "#aaddff", description: "Supercooled crystalline extract. Required for prestige hull reinforcement." },
  // ── Legendary Materials ──
  { id: "void-fragment", name: "Void Fragment", icon: "★", color: "#aa44ff", description: "A shard of compressed spacetime from the Void Abyss." },
  { id: "hollow-resonance", name: "Hollow Resonance", icon: "★", color: "#ff4444", description: "A crystallized echo of the Hollow Mind's signal." },
];

// ─── Consumable Definitions ─────────────────────────────────────────

export interface ConsumableDef {
  id: ConsumableId;
  name: string;
  description: string;
  icon: string;
  color: string;
  cost: number;
  maxCarry: number;
  /** Which planet must be completed to unlock this for purchase */
  unlockPlanet?: PlanetId;
  /** OR: number of total planets completed to unlock */
  unlockPlanetCount?: number;
}

export const CONSUMABLE_DEFS: ConsumableDef[] = [
  {
    id: "hull-repair",
    name: "Hull Repair Kit",
    description: "Restore 1 HP during a mission",
    icon: "+",
    color: "#44ff88",
    cost: 300,
    maxCarry: 2,
    unlockPlanet: "verdania",
  },
  {
    id: "cryo-charge",
    name: "Cryo Charge",
    description: "Freeze nearby enemies for 3 seconds",
    icon: "*",
    color: "#66ccff",
    cost: 350,
    maxCarry: 2,
    unlockPlanet: "glaciem",
  },
  {
    id: "shield-charge",
    name: "Shield Charge",
    description: "Instant 8-second protective shield",
    icon: "S",
    color: "#4488ff",
    cost: 400,
    maxCarry: 2,
    unlockPlanet: "ossuary",
  },
  {
    id: "weapon-overcharge",
    name: "Weapon Overcharge",
    description: "+2 weapon levels for 20 seconds",
    icon: "W",
    color: "#ff8800",
    cost: 500,
    maxCarry: 1,
    unlockPlanet: "ashfall",
  },
  {
    id: "scanner-pulse",
    name: "Scanner Pulse",
    description: "Reveal cloaked enemies & boss weak points for 15s",
    icon: "?",
    color: "#aa44ff",
    cost: 250,
    maxCarry: 2,
    unlockPlanetCount: 4,
  },
];

// ─── Enhancement Definitions ────────────────────────────────────────

export interface EnhancementDef {
  id: EnhancementId;
  name: string;
  description: string;
  icon: string;
  color: string;
  sourcePlanet: PlanetId;
}

export const ENHANCEMENT_DEFS: EnhancementDef[] = [
  {
    id: "reinforced-shield",
    name: "Reinforced Shield",
    description: "Shield power-up reflects 1 bullet on hit",
    icon: "⬡",
    color: "#4488ff",
    sourcePlanet: "glaciem",
  },
  {
    id: "incendiary-bombs",
    name: "Incendiary Bombs",
    description: "Bomb explosions leave a 3-second damage zone",
    icon: "✦",
    color: "#ff6622",
    sourcePlanet: "pyraxis",
  },
  {
    id: "extended-magnet",
    name: "Extended Magnet",
    description: "Magnet attraction range doubled",
    icon: "◎",
    color: "#aa44ff",
    sourcePlanet: "abyssia",
  },
  {
    id: "homing-gunners",
    name: "Homing Gunners",
    description: "Side Gunner bullets track nearest enemy",
    icon: "⊕",
    color: "#44ff44",
    sourcePlanet: "prismara",
  },
  {
    id: "resonance-field",
    name: "Resonance Field",
    description: "All power-up durations +25%",
    icon: "◇",
    color: "#66cc33",
    sourcePlanet: "genesis",
  },
];

// ─── Helpers ────────────────────────────────────────────────────────

export function getPlanetDef(id: PlanetId): PlanetDef {
  return PLANET_DEFS.find((p) => p.id === id)!;
}

export function getPlanetForWorld(world: number): PlanetDef | undefined {
  return PLANET_DEFS.find((p) => p.pairedWorld === world);
}

export function getPlanetsForWorld(world: number): PlanetDef[] {
  return PLANET_DEFS.filter((p) => p.pairedWorld === world);
}

export function isPlanetUnlocked(planet: PlanetDef, save: SaveData): boolean {
  // Check level completion requirement
  const levelData = save.levels[planet.unlockAfterLevel];
  if (!levelData?.completed) return false;
  // Check star requirement
  if (save.totalStars < planet.unlockStars) return false;
  return true;
}

export function isPlanetCompleted(planetId: PlanetId, save: SaveData): boolean {
  return save.completedPlanets.includes(planetId);
}

export function hasMaterial(materialId: MaterialId, save: SaveData): boolean {
  return save.materials.includes(materialId);
}

export function hasEnhancement(enhancementId: EnhancementId, save: SaveData): boolean {
  return save.unlockedEnhancements.includes(enhancementId);
}

export function isConsumableUnlocked(def: ConsumableDef, save: SaveData): boolean {
  if (def.unlockPlanet) {
    return save.completedPlanets.includes(def.unlockPlanet);
  }
  if (def.unlockPlanetCount) {
    return save.completedPlanets.length >= def.unlockPlanetCount;
  }
  return true;
}

export function getConsumableCount(consumableId: ConsumableId, save: SaveData): number {
  return save.consumableInventory[consumableId] ?? 0;
}

export function getMaterialDef(id: MaterialId): MaterialDef {
  return MATERIAL_DEFS.find((m) => m.id === id)!;
}

export function getConsumableDef(id: ConsumableId): ConsumableDef {
  return CONSUMABLE_DEFS.find((c) => c.id === id)!;
}

export function getEnhancementDef(id: EnhancementId): EnhancementDef {
  return ENHANCEMENT_DEFS.find((e) => e.id === id)!;
}

/** Award planet completion rewards to save data */
export function completePlanet(save: SaveData, planetId: PlanetId): SaveData {
  const planet = getPlanetDef(planetId);
  const updated = { ...save };

  // Mark planet completed (avoid duplicates)
  if (!updated.completedPlanets.includes(planetId)) {
    updated.completedPlanets = [...updated.completedPlanets, planetId];
  }

  // Award material (first completion only)
  if (!updated.materials.includes(planet.material)) {
    updated.materials = [...updated.materials, planet.material];
  }

  // Unlock enhancement
  if (planet.enhancementUnlock && !updated.unlockedEnhancements.includes(planet.enhancementUnlock)) {
    updated.unlockedEnhancements = [...updated.unlockedEnhancements, planet.enhancementUnlock];
  }

  return updated;
}

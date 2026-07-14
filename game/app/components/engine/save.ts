import {
  DEFAULT_UPGRADES,
  type ConsumableId,
  type EnhancementId,
  type MaterialId,
  type PlanetId,
  type SaveData,
  type ShipUpgrades,
  type SpecialMissionId,
  type StoryItemId,
  type WeaponType,
} from "./types";
import type {
  ColonyState,
  PlanetState,
  EarthShipment,
  FactionStanding,
  Bounty,
  GameClock,
} from "../colony/shared/colonyTypes";
import { defaultFactionStandings } from "../colony/shared/factionLedger";
import { unlockCodexEntries } from "./codex";
import { calcPilotLevel, creditBonus, skillPointsAtLevel } from "./pilotLevel";
import { getNode } from "./skillTree";
import {
  ASHFALL_REGION_SEED,
  createPlanetRegionState,
  generateRegionMap,
  neutralSiteStats,
} from "../colony/region/regionMap";
import type { RegionIntelState, RegionNode, SiteStats } from "../colony/shared/colonyTypes";
export type { SaveData };

const SAVE_KEY = "sector-zero-save";

function createDefaultSave(): SaveData {
  return {
  currentWorld: 1,
  levels: {},
  credits: 0,
  totalStars: 0,
  totalScore: 0,
  xp: 0,
  upgrades: { ...DEFAULT_UPGRADES },
  unlockedCodex: [],
  viewedCodex: [],
  viewedConversations: [],
  completedQuests: [],
  activeQuests: [],
  completedPlanets: [],
  unlockedSpecialMissions: [],
  completedSpecialMissions: [],
  storyItems: [],
  materials: [],
  consumableInventory: {},
  equippedConsumables: [],
  unlockedEnhancements: [],
  bestiary: {},
  equippedWeaponType: "kinetic",
  pilotLevel: 1,
  skillPoints: 0,
  allocatedSkills: [],
  colonies: [],
  planets: [createPlanetRegionState("ashfall", ASHFALL_REGION_SEED)],
  earthShipments: [],
  factionStandings: defaultFactionStandings(),
  bounties: [],
  missionsSinceStart: 0,
  gameClock: {
    day: 0,
    hour: 7,
    minute: 0,
    realtimeMsPerGameMinute: 1000,
    season: "standard",
  },
  };
}

/** Migrate old saves that lack new fields */
export function migrateSave(raw: Record<string, unknown>): SaveData {
  const colonies = migrateColonies(raw.colonies);
  const planets = migratePlanets(raw.planets, colonies);
  return {
    currentWorld: (raw.currentWorld as number) ?? 1,
    levels: (raw.levels as SaveData["levels"]) ?? {},
    credits: (raw.credits as number) ?? 0,
    totalStars: (raw.totalStars as number) ?? 0,
    totalScore: (raw.totalScore as number) ?? 0,
    xp: (raw.xp as number) ?? 0,
    introSeen: (raw.introSeen as boolean) ?? undefined,
    upgrades: (raw.upgrades as ShipUpgrades) ?? { ...DEFAULT_UPGRADES },
    unlockedCodex: (raw.unlockedCodex as string[]) ?? [],
    viewedCodex: (raw.viewedCodex as string[]) ?? [],
    viewedConversations: (raw.viewedConversations as string[]) ?? [],
    completedQuests: (raw.completedQuests as string[]) ?? [],
    activeQuests: (raw.activeQuests as string[]) ?? [],
    completedPlanets: (raw.completedPlanets as PlanetId[]) ?? [],
    unlockedSpecialMissions: (raw.unlockedSpecialMissions as SpecialMissionId[]) ?? [],
    completedSpecialMissions: (raw.completedSpecialMissions as SpecialMissionId[]) ?? [],
    storyItems: (raw.storyItems as StoryItemId[]) ?? [],
    materials: (raw.materials as MaterialId[]) ?? [],
    consumableInventory: (raw.consumableInventory as Partial<Record<ConsumableId, number>>) ?? {},
    equippedConsumables: (raw.equippedConsumables as ConsumableId[]) ?? [],
    unlockedEnhancements: (raw.unlockedEnhancements as EnhancementId[]) ?? [],
    bestiary: (raw.bestiary as SaveData["bestiary"]) ?? {},
    equippedWeaponType: (raw.equippedWeaponType as WeaponType | undefined) ?? "kinetic",
    pilotLevel: (raw.pilotLevel as number) ?? 1,
    skillPoints: (raw.skillPoints as number) ?? 0,
    allocatedSkills: (raw.allocatedSkills as SaveData["allocatedSkills"]) ?? [],
    colonies,
    planets,
    earthShipments: (raw.earthShipments as EarthShipment[]) ?? [],
    factionStandings: (raw.factionStandings as FactionStanding[]) ?? defaultFactionStandings(),
    bounties: (raw.bounties as Bounty[]) ?? [],
    missionsSinceStart: (raw.missionsSinceStart as number) ?? 0,
    gameClock: (raw.gameClock as GameClock) ?? {
      day: 0,
      hour: 7,
      minute: 0,
      realtimeMsPerGameMinute: 1000,
      season: "standard",
    },
  };
}

const INTEL_STATES = new Set<RegionIntelState>(["unknown", "rumored", "surveyed", "cleared", "claimed"]);
const LEGACY_ASHFALL_ANCHORS = new Set(["ashfall_starter_region", "dev_seed_region"]);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function finite(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function migrateSiteStats(value: unknown, fallback: SiteStats = neutralSiteStats()): SiteStats {
  const source = record(value);
  return {
    oreDensity: finite(source.oreDensity, fallback.oreDensity),
    waterTable: finite(source.waterTable, fallback.waterTable),
    buildableSlots: finite(source.buildableSlots, fallback.buildableSlots),
    threat: finite(source.threat, fallback.threat),
  };
}

function migrateColonies(value: unknown): ColonyState[] {
  if (!Array.isArray(value)) return [];
  return value.map(entry => {
    const source = record(entry);
    const planetId = source.planetId as PlanetId;
    const oldNodeId = String(source.regionNodeId ?? "");
    const regionNodeId = planetId === "ashfall" && LEGACY_ASHFALL_ANCHORS.has(oldNodeId)
      ? "ashfall-forward-camp"
      : oldNodeId;
    return {
      ...source,
      regionNodeId,
      siteStats: migrateSiteStats(source.siteStats),
    } as unknown as ColonyState;
  });
}

function titleFromId(id: string): string {
  return id
    .split(/[-_]/g)
    .filter(Boolean)
    .map(part => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function migrateIntel(source: Record<string, unknown>): RegionIntelState {
  if (source.intel === "claimed") return "claimed";
  if (source.cleared === true) return "cleared";
  if (typeof source.intel === "string" && INTEL_STATES.has(source.intel as RegionIntelState)) {
    return source.intel as RegionIntelState;
  }
  if (source.discovered === true) return "rumored";
  return "unknown";
}

function migrateRegionNode(value: unknown, fallback?: RegionNode): RegionNode {
  const source = record(value);
  const id = String(source.id ?? fallback?.id ?? "region-node");
  const type = (source.type ?? fallback?.type ?? "wilderness") as RegionNode["type"];
  const intel = migrateIntel(source.intel === undefined && source.discovered === undefined && fallback
    ? { ...source, intel: fallback.intel }
    : source);
  const fallbackStats = fallback?.siteStats ?? neutralSiteStats();
  const siteStats = type === "colony_site"
    ? migrateSiteStats(source.siteStats, fallbackStats)
    : null;
  const rawCoords = record(source.coords);
  return {
    id,
    name: String(source.name ?? fallback?.name ?? titleFromId(id)),
    type,
    intel,
    siteStats,
    discovered: intel !== "unknown",
    authored: (source.authored as boolean | undefined) ?? fallback?.authored ?? false,
    templateId: (source.templateId as string | null | undefined) ?? fallback?.templateId ?? null,
    seed: finite(source.seed, fallback?.seed ?? 0),
    cleared: intel === "cleared" || intel === "claimed",
    respawnMissions: (source.respawnMissions as number | null | undefined) ?? fallback?.respawnMissions ?? null,
    coords: {
      x: finite(rawCoords.x, fallback?.coords.x ?? 50),
      y: finite(rawCoords.y, fallback?.coords.y ?? 50),
    },
    elevationMetadata: (source.elevationMetadata as RegionNode["elevationMetadata"] | undefined)
      ?? fallback?.elevationMetadata
      ?? null,
  };
}

function migratePlanet(value: unknown): PlanetState {
  const source = record(value);
  const id = (source.id ?? "ashfall") as PlanetId;
  const rawMap = record(source.regionMap);
  const seed = finite(rawMap.seed, id === "ashfall" ? ASHFALL_REGION_SEED : 0);
  const generated = generateRegionMap(id, seed);
  const rawNodes = Array.isArray(rawMap.nodes) ? rawMap.nodes : [];
  const generatedById = new Map(generated.nodes.map(node => [node.id, node]));
  const migratedNodes = rawNodes.length > 0
    ? rawNodes.map(nodeValue => {
        const nodeSource = record(nodeValue);
        return migrateRegionNode(nodeValue, generatedById.get(String(nodeSource.id ?? "")));
      })
    : [];
  const migratedIds = new Set(migratedNodes.map(node => node.id));
  const nodes = [
    ...migratedNodes,
    ...generated.nodes
      .filter(node => !migratedIds.has(node.id))
      .map(node => migrateRegionNode(node, node)),
  ];
  const nodeIds = new Set(nodes.map(node => node.id));
  const rawEdges: [string, string][] = Array.isArray(rawMap.edges)
    ? rawMap.edges
        .filter((edge): edge is unknown[] => Array.isArray(edge) && edge.length >= 2)
        .map(edge => [String(edge[0]), String(edge[1])] as [string, string])
        .filter(([from, to]) => nodeIds.has(from) && nodeIds.has(to))
    : [];
  const edgeKeys = new Set(rawEdges.map(([from, to]) => `${from}\u0000${to}`));
  const edges: [string, string][] = [
    ...rawEdges,
    ...generated.edges.filter(([from, to]) => {
      const key = `${from}\u0000${to}`;
      if (edgeKeys.has(key)) return false;
      edgeKeys.add(key);
      return true;
    }),
  ];
  const generatedPlanet = createPlanetRegionState(id, seed);
  return {
    id,
    regionMap: { seed, nodes, edges },
    biome: (source.biome as PlanetState["biome"] | undefined) ?? generatedPlanet.biome,
    campaignUnlocked: (source.campaignUnlocked as boolean | undefined) ?? generatedPlanet.campaignUnlocked,
  };
}

function migratePlanets(value: unknown, colonies: readonly ColonyState[]): PlanetState[] {
  const source = Array.isArray(value) ? value.map(migratePlanet) : [];
  if (!source.some(planet => planet.id === "ashfall")) {
    source.push(createPlanetRegionState("ashfall", ASHFALL_REGION_SEED));
  }
  return source.map(planet => {
    const claimed = new Set(colonies.filter(colony => colony.planetId === planet.id).map(colony => colony.regionNodeId));
    if (claimed.size === 0) return planet;
    return {
      ...planet,
      regionMap: {
        ...planet.regionMap,
        nodes: planet.regionMap.nodes.map(node => claimed.has(node.id)
          ? { ...node, intel: "claimed", discovered: true, cleared: true }
          : node),
      },
    };
  });
}

/** Recalculate pilot level and available skill points from total XP.
 *  Called on load to ensure save data is consistent. */
export function recalcPilotLevel(save: SaveData): SaveData {
  const level = calcPilotLevel(save.xp);
  const totalPoints = skillPointsAtLevel(level);
  let spentPoints = 0;
  for (const id of save.allocatedSkills) {
    const node = getNode(id);
    spentPoints += node?.cost ?? 1;
  }
  return {
    ...save,
    pilotLevel: level,
    skillPoints: Math.max(0, totalPoints - spentPoints),
  };
}

export function loadSave(): SaveData {
  if (typeof window === "undefined") return createDefaultSave();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return unlockCodexEntries(createDefaultSave());
    const parsed = JSON.parse(raw);
    return recalcPilotLevel(unlockCodexEntries(migrateSave(parsed)));
  } catch {
    return unlockCodexEntries(createDefaultSave());
  }
}

export function saveSave(data: SaveData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

export function unlockSpecialMission(save: SaveData, missionId: SpecialMissionId): SaveData {
  if (save.unlockedSpecialMissions.includes(missionId)) return save;
  return {
    ...save,
    unlockedSpecialMissions: [...save.unlockedSpecialMissions, missionId],
  };
}

export function completeSpecialMission(save: SaveData, missionId: SpecialMissionId): SaveData {
  if (save.completedSpecialMissions.includes(missionId)) return save;
  return {
    ...save,
    completedSpecialMissions: [...save.completedSpecialMissions, missionId],
  };
}

export function addStoryItem(save: SaveData, itemId: StoryItemId): SaveData {
  if (save.storyItems.includes(itemId)) return save;
  return {
    ...save,
    storyItems: [...save.storyItems, itemId],
  };
}

// ─── Credits Economy ────────────────────────────────────────────────

export function calculateCreditsEarned(
  score: number,
  stars: number,
  world: number,
  pilotLevel: number = 1
): number {
  const baseCredits = Math.floor(score / 10);
  const starBonus = stars * 50;
  const worldMultiplier = 1 + (world - 1) * 0.2;
  const pilotMultiplier = 1 + creditBonus(pilotLevel);
  return Math.floor((baseCredits + starBonus) * worldMultiplier * pilotMultiplier);
}

// ─── Level Results ──────────────────────────────────────────────────

export function updateLevelResult(
  save: SaveData,
  world: number,
  level: number,
  score: number,
  stars: number,
  xpEarned: number = 0
): SaveData {
  const key = `${world}-${level}`;
  const existing = save.levels[key];

  const newLevel = {
    completed: true,
    stars: Math.max(existing?.stars ?? 0, stars),
    highScore: Math.max(existing?.highScore ?? 0, score),
  };

  const newLevels = { ...save.levels, [key]: newLevel };

  // Calculate totals
  let totalStars = 0;
  let totalScore = 0;
  for (const lv of Object.values(newLevels)) {
    totalStars += lv.stars;
    totalScore += lv.highScore;
  }

  // Award credits
  const creditsEarned = calculateCreditsEarned(score, stars, world, save.pilotLevel);

  const updated: SaveData = {
    ...save,
    levels: newLevels,
    totalStars,
    totalScore,
    credits: save.credits + creditsEarned,
    xp: save.xp + xpEarned,
  };

  // Auto-unlock codex entries based on new progression
  return unlockCodexEntries(updated);
}

// ─── Upgrades ───────────────────────────────────────────────────────

export function purchaseUpgrade(
  save: SaveData,
  upgradeId: keyof ShipUpgrades,
  cost: number
): SaveData | null {
  if (save.credits < cost) return null;
  return {
    ...save,
    credits: save.credits - cost,
    upgrades: {
      ...save.upgrades,
      [upgradeId]: save.upgrades[upgradeId] + 1,
    },
  };
}

// ─── Profile ────────────────────────────────────────────────────────

export function updateSectorZeroProfile(score: number): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem("sector-zero-profile");
    const profile = raw ? JSON.parse(raw) : null;
    if (!profile) return;
    const stats = profile.games?.["sector-zero"] || {
      gamesPlayed: 0,
      highScore: 0,
      lastPlayed: null,
    };
    stats.gamesPlayed += 1;
    if (score > stats.highScore) stats.highScore = score;
    stats.lastPlayed = new Date().toISOString();
    profile.games["sector-zero"] = stats;
    profile.lastPlayed = stats.lastPlayed;
    localStorage.setItem("sector-zero-profile", JSON.stringify(profile));
  } catch {}
}

export function getPlayerName(): string {
  if (typeof window === "undefined") return "Guest";
  try {
    const raw = localStorage.getItem("sector-zero-profile");
    const profile = raw ? JSON.parse(raw) : null;
    return profile?.name || "Guest";
  } catch {
    return "Guest";
  }
}

export function __runSaveSelfTests(): void {
  const migrated = recalcPilotLevel(unlockCodexEntries(migrateSave({})));
  console.assert(Array.isArray(migrated.unlockedSpecialMissions), "Special mission unlocks should migrate to an array");
  console.assert(Array.isArray(migrated.completedSpecialMissions), "Completed special missions should migrate to an array");
  console.assert(Array.isArray(migrated.storyItems), "Story items should migrate to an array");

  const unlocked = unlockSpecialMission(migrated, "kepler-black-box");
  console.assert(unlocked.unlockedSpecialMissions.includes("kepler-black-box"), "Special mission should unlock once");

  const completed = completeSpecialMission(unlocked, "kepler-black-box");
  console.assert(completed.completedSpecialMissions.includes("kepler-black-box"), "Special mission should complete once");

  const withItem = addStoryItem(completed, "kepler-black-box");
  console.assert(withItem.storyItems.includes("kepler-black-box"), "Story item should persist once");
}

if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
  __runSaveSelfTests();
}

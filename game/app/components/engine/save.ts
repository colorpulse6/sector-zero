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
import { unlockCodexEntries } from "./codex";
import { calcPilotLevel, creditBonus, skillPointsAtLevel } from "./pilotLevel";
import { getNode } from "./skillTree";
export type { SaveData };

const SAVE_KEY = "sector-zero-save";

const defaultSave: SaveData = {
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
};

/** Migrate old saves that lack new fields */
function migrateSave(raw: Record<string, unknown>): SaveData {
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
  };
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
  if (typeof window === "undefined") return { ...defaultSave };
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return unlockCodexEntries({ ...defaultSave });
    const parsed = JSON.parse(raw);
    return recalcPilotLevel(unlockCodexEntries(migrateSave(parsed)));
  } catch {
    return unlockCodexEntries({ ...defaultSave });
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
    const raw = localStorage.getItem("knicks-knacks-profile");
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
    localStorage.setItem("knicks-knacks-profile", JSON.stringify(profile));
  } catch {}
}

export function getPlayerName(): string {
  if (typeof window === "undefined") return "Guest";
  try {
    const raw = localStorage.getItem("knicks-knacks-profile");
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

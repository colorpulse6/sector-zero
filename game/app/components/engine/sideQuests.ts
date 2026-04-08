import type { SaveData } from "./types";

// ─── Quest Types ───────────────────────────────────────────────────

export type QuestType = "time_attack" | "no_damage" | "accuracy" | "pacifist";

export interface SideQuest {
  id: string;
  name: string;
  description: string;
  type: QuestType;
  offeredBy: string;        // crew id: "voss", "reyes", "kael"
  offeredByColor: string;
  /** Target level in "world-level" format */
  targetLevel: string;
  /** Condition value (frames for time attack, percentage for accuracy) */
  conditionValue: number;
  reward: number;           // credits
  /** Level key required to unlock this quest (null = always available) */
  unlockAfter: string | null;
}

export const QUEST_TYPE_NAMES: Record<QuestType, string> = {
  time_attack: "TIME ATTACK",
  no_damage: "NO DAMAGE",
  accuracy: "ACCURACY",
  pacifist: "PACIFIST",
};

export const QUEST_TYPE_ICONS: Record<QuestType, string> = {
  time_attack: "\u23F1",  // stopwatch
  no_damage: "\u2764",    // heart
  accuracy: "\u25CE",     // bullseye
  pacifist: "\u262E",     // peace
};

export const QUEST_TYPE_COLORS: Record<QuestType, string> = {
  time_attack: "#ffaa44",
  no_damage: "#ff4488",
  accuracy: "#44ff88",
  pacifist: "#aa88ff",
};

// ─── Quest Definitions ─────────────────────────────────────────────

export const SIDE_QUESTS: SideQuest[] = [
  // ── World 1 Quests ──
  {
    id: "q-reyes-1-1",
    name: "Quick Draw",
    description: "Clear 1-1 in under 60 seconds",
    type: "time_attack",
    offeredBy: "reyes",
    offeredByColor: "#ff8844",
    targetLevel: "1-1",
    conditionValue: 3600, // 60s at 60fps
    reward: 200,
    unlockAfter: "1-1",
  },
  {
    id: "q-voss-1-2",
    name: "Iron Hull",
    description: "Complete 1-2 without taking damage",
    type: "no_damage",
    offeredBy: "voss",
    offeredByColor: "#44ccff",
    targetLevel: "1-2",
    conditionValue: 0,
    reward: 250,
    unlockAfter: "1-2",
  },
  {
    id: "q-kael-1-3",
    name: "Data Collection",
    description: "Destroy 90% of enemies in 1-3",
    type: "accuracy",
    offeredBy: "kael",
    offeredByColor: "#44ff88",
    targetLevel: "1-3",
    conditionValue: 90,
    reward: 200,
    unlockAfter: "1-3",
  },

  // ── World 2 Quests ──
  {
    id: "q-reyes-2-1",
    name: "Nebula Sprint",
    description: "Clear 2-1 in under 50 seconds",
    type: "time_attack",
    offeredBy: "reyes",
    offeredByColor: "#ff8844",
    targetLevel: "2-1",
    conditionValue: 3000, // 50s
    reward: 300,
    unlockAfter: "2-1",
  },
  {
    id: "q-voss-2-3",
    name: "Shield Discipline",
    description: "Complete 2-3 without taking damage",
    type: "no_damage",
    offeredBy: "voss",
    offeredByColor: "#44ccff",
    targetLevel: "2-3",
    conditionValue: 0,
    reward: 350,
    unlockAfter: "2-3",
  },

  // ── World 3 Quests ──
  {
    id: "q-kael-3-2",
    name: "Specimen Collection",
    description: "Destroy 95% of enemies in 3-2",
    type: "accuracy",
    offeredBy: "kael",
    offeredByColor: "#44ff88",
    targetLevel: "3-2",
    conditionValue: 95,
    reward: 350,
    unlockAfter: "3-2",
  },
  {
    id: "q-reyes-3-1",
    name: "Rift Runner",
    description: "Clear 3-1 in under 45 seconds",
    type: "time_attack",
    offeredBy: "reyes",
    offeredByColor: "#ff8844",
    targetLevel: "3-1",
    conditionValue: 2700, // 45s
    reward: 350,
    unlockAfter: "3-1",
  },

  // ── World 4 Quests ──
  {
    id: "q-voss-4-1",
    name: "Ghost Protocol",
    description: "Complete 4-1 without taking damage",
    type: "no_damage",
    offeredBy: "voss",
    offeredByColor: "#44ccff",
    targetLevel: "4-1",
    conditionValue: 0,
    reward: 400,
    unlockAfter: "4-1",
  },
  {
    id: "q-kael-4-3",
    name: "Wreckage Analysis",
    description: "Destroy 90% of enemies in 4-3",
    type: "accuracy",
    offeredBy: "kael",
    offeredByColor: "#44ff88",
    targetLevel: "4-3",
    conditionValue: 90,
    reward: 400,
    unlockAfter: "4-3",
  },

  // ── World 5 Quests ──
  {
    id: "q-reyes-5-2",
    name: "Void Dash",
    description: "Clear 5-2 in under 40 seconds",
    type: "time_attack",
    offeredBy: "reyes",
    offeredByColor: "#ff8844",
    targetLevel: "5-2",
    conditionValue: 2400, // 40s
    reward: 450,
    unlockAfter: "5-2",
  },
  {
    id: "q-voss-5-3",
    name: "Untouchable",
    description: "Complete 5-3 without taking damage",
    type: "no_damage",
    offeredBy: "voss",
    offeredByColor: "#44ccff",
    targetLevel: "5-3",
    conditionValue: 0,
    reward: 500,
    unlockAfter: "5-3",
  },

  // ── World 6 Quests ──
  {
    id: "q-kael-6-2",
    name: "Scar Sweep",
    description: "Destroy 95% of enemies in 6-2",
    type: "accuracy",
    offeredBy: "kael",
    offeredByColor: "#44ff88",
    targetLevel: "6-2",
    conditionValue: 95,
    reward: 500,
    unlockAfter: "6-2",
  },

  // ── World 7 Quests ──
  {
    id: "q-reyes-7-1",
    name: "Fold Blitz",
    description: "Clear 7-1 in under 35 seconds",
    type: "time_attack",
    offeredBy: "reyes",
    offeredByColor: "#ff8844",
    targetLevel: "7-1",
    conditionValue: 2100, // 35s
    reward: 500,
    unlockAfter: "7-1",
  },
  {
    id: "q-voss-7-2",
    name: "Perfect Run",
    description: "Complete 7-2 without taking damage",
    type: "no_damage",
    offeredBy: "voss",
    offeredByColor: "#44ccff",
    targetLevel: "7-2",
    conditionValue: 0,
    reward: 500,
    unlockAfter: "7-2",
  },
];

// ─── Helpers ───────────────────────────────────────────────────────

/** Get quests available based on progression (unlocked but not necessarily accepted) */
export function getAvailableQuests(save: SaveData): SideQuest[] {
  return SIDE_QUESTS.filter((q) => {
    if (save.completedQuests.includes(q.id)) return false;
    if (q.unlockAfter === null) return true;
    return !!save.levels[q.unlockAfter]?.completed;
  });
}

/** Get only quests that are currently active (accepted) */
export function getActiveQuests(save: SaveData): SideQuest[] {
  return SIDE_QUESTS.filter((q) => save.activeQuests.includes(q.id));
}

/** Check if a quest is completed */
export function isQuestCompleted(questId: string, save: SaveData): boolean {
  return save.completedQuests.includes(questId);
}

/** Check if a quest is active */
export function isQuestActive(questId: string, save: SaveData): boolean {
  return save.activeQuests.includes(questId);
}

/** Accept a quest (add to active, max 3) */
export function acceptQuest(save: SaveData, questId: string): SaveData | null {
  if (save.activeQuests.length >= 3) return null;
  if (save.activeQuests.includes(questId)) return null;
  if (save.completedQuests.includes(questId)) return null;
  return {
    ...save,
    activeQuests: [...save.activeQuests, questId],
  };
}

/** Abandon a quest */
export function abandonQuest(save: SaveData, questId: string): SaveData {
  return {
    ...save,
    activeQuests: save.activeQuests.filter((id) => id !== questId),
  };
}

/** Validate quest completion based on level result data */
export interface QuestCheckData {
  world: number;
  level: number;
  kills: number;
  totalEnemies: number;
  deaths: number;
  frameCount: number;
  playerHp: number;
  playerMaxHp: number;
}

export function checkQuestCompletion(
  save: SaveData,
  data: QuestCheckData
): { completedQuests: SideQuest[]; newSave: SaveData } {
  const levelKey = `${data.world}-${data.level}`;
  const active = getActiveQuests(save);
  const completed: SideQuest[] = [];
  let updatedSave = { ...save };

  for (const quest of active) {
    if (quest.targetLevel !== levelKey) continue;

    let passed = false;
    switch (quest.type) {
      case "time_attack":
        passed = data.frameCount <= quest.conditionValue;
        break;
      case "no_damage":
        passed = data.deaths === 0 && data.playerHp === data.playerMaxHp;
        break;
      case "accuracy":
        passed = data.totalEnemies > 0 &&
          (data.kills / data.totalEnemies) * 100 >= quest.conditionValue;
        break;
      case "pacifist":
        passed = data.kills <= quest.conditionValue;
        break;
    }

    if (passed) {
      completed.push(quest);
      updatedSave = {
        ...updatedSave,
        activeQuests: updatedSave.activeQuests.filter((id) => id !== quest.id),
        completedQuests: [...updatedSave.completedQuests, quest.id],
        credits: updatedSave.credits + quest.reward,
      };
    }
  }

  return { completedQuests: completed, newSave: updatedSave };
}

/** Count available quests that haven't been accepted or completed */
export function countAvailableQuests(save: SaveData): number {
  return getAvailableQuests(save).filter(
    (q) => !save.activeQuests.includes(q.id)
  ).length;
}

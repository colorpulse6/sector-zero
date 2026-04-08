import type { SaveData, SpecialMissionId } from "./types";

export interface SpecialMissionDef {
  id: SpecialMissionId;
  name: string;
  subtitle: string;
  description: string;
  world: number;
  unlockAfterLevel: string;
  mode: "first-person";
  offeredBy: "reyes";
  offeredByColor: string;
  briefingText: string;
  storyCodexId: string;
  storyItemId: "kepler-black-box";
}

export const SPECIAL_MISSIONS: SpecialMissionDef[] = [
  {
    id: "kepler-black-box",
    name: "Kepler Black Box",
    subtitle: "Recorder Retrieval",
    description: "Board a drifting Kepler wreck and recover its surviving black box before the Hollow erase it.",
    world: 4,
    unlockAfterLevel: "4-2",
    mode: "first-person",
    offeredBy: "reyes",
    offeredByColor: "#ff8844",
    briefingText: "Reyes has traced a surviving recorder beacon to the bridge deck of a drifting Kepler hull. Board the wreck, reach the recorder vault, and recover the black box.",
    storyCodexId: "personal-reyes-kepler-black-box",
    storyItemId: "kepler-black-box",
  },
];

export function getSpecialMissionDef(id: SpecialMissionId): SpecialMissionDef {
  const mission = SPECIAL_MISSIONS.find((m) => m.id === id);
  if (!mission) throw new Error(`Unknown special mission: ${id}`);
  return mission;
}

export function isSpecialMissionUnlocked(id: SpecialMissionId, save: SaveData): boolean {
  return save.unlockedSpecialMissions.includes(id);
}

export function isSpecialMissionCompleted(id: SpecialMissionId, save: SaveData): boolean {
  return save.completedSpecialMissions.includes(id);
}

export function getAvailableSpecialMissions(save: SaveData): SpecialMissionDef[] {
  return SPECIAL_MISSIONS.filter((mission) => isSpecialMissionUnlocked(mission.id, save));
}

export function __runSpecialMissionSelfTests(): void {
  const mission = getSpecialMissionDef("kepler-black-box");
  console.assert(mission.unlockAfterLevel === "4-2", "Kepler mission should unlock after 4-2");

  const emptySave = {
    unlockedSpecialMissions: [],
    completedSpecialMissions: [],
  } as unknown as SaveData;
  console.assert(!isSpecialMissionUnlocked("kepler-black-box", emptySave), "Mission should start locked");

  const unlockedSave = {
    ...emptySave,
    unlockedSpecialMissions: ["kepler-black-box"],
  } as unknown as SaveData;
  console.assert(getAvailableSpecialMissions(unlockedSave).length === 1, "Unlocked mission should appear in available list");
}

if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
  __runSpecialMissionSelfTests();
}

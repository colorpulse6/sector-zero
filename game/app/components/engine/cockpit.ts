import { type Keys, type SaveData, type PlanetId, type SpecialMissionId, AudioEvent } from "./types";
import { UPGRADE_DEFS, getUpgradeCost, canPurchase } from "./upgrades";
import { purchaseUpgrade } from "./save";
import { CREW, getAvailableConversations, markConversationViewed } from "./crewDialog";
import { CODEX_CATEGORIES, getEntriesForCategory, markCodexRead } from "./codex";
import { getBestiaryList } from "./bestiary";
import { getAvailableQuests, isQuestActive, isQuestCompleted, acceptQuest, abandonQuest } from "./sideQuests";
import { PLANET_DEFS, isPlanetUnlocked, isPlanetCompleted } from "./planets";
import { getTreeNodes, canAllocate } from "./skillTree";
import type { SkillNodeId } from "./types";
import { getAvailableSpecialMissions, isSpecialMissionCompleted } from "./specialMissions";

// ─── Cockpit Screen Types ───────────────────────────────────────────

export type CockpitScreen = "hub" | "starmap" | "armory" | "crew" | "missions" | "codex" | "bestiary" | "pilot";

export interface CockpitHubState {
  screen: CockpitScreen;
  selectedHotspot: number;
  animTimer: number;
  transitionTimer: number;
  audioEvents: AudioEvent[];
  // Sub-screen navigation
  armorySelected: number;
  crewSelected: number;
  crewConvoIndex: number;
  crewDialogLine: number;
  crewDialogActive: boolean;
  missionSelected: number;
  /** 0 = Side Quests tab, 1 = Special Missions tab, 2 = Planet Missions tab */
  missionTab: number;
  codexCategory: number;
  codexSelected: number;
  codexReading: boolean;
  bestiarySelected: number;
  bestiaryReading: boolean;
  pilotTreeSelected: number;
}

// ─── Hotspot Definitions ────────────────────────────────────────────

export interface Hotspot {
  id: CockpitScreen;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  description: string;
}

export const COCKPIT_HOTSPOTS: Hotspot[] = [
  { id: "starmap",  name: "STAR MAP",       x: 190, y: 460, w: 100, h: 80, description: "Select mission" },
  { id: "armory",   name: "ARMORY",          x: 190, y: 610, w: 100, h: 70, description: "Upgrade ship" },
  { id: "crew",     name: "CREW QUARTERS",   x: 40,  y: 280, w: 130, h: 80, description: "Talk to crew" },
  { id: "missions", name: "MISSION BOARD",   x: 310, y: 280, w: 130, h: 80, description: "Side quests" },
  { id: "codex",    name: "SHIP'S LOG",      x: 40,  y: 110, w: 120, h: 70, description: "Intel & research" },
  { id: "bestiary", name: "BESTIARY",         x: 310, y: 110, w: 120, h: 70, description: "Enemy database" },
  { id: "pilot",   name: "PILOT",             x: 190, y: 720, w: 100, h: 60, description: "Level & skills" },
];

// ─── Navigation Graph (which hotspot each arrow goes to) ────────────
// Maps: [up, down, left, right] → hotspot index (-1 = no move)
const NAV_GRAPH: Record<number, [number, number, number, number]> = {
  0: [2, 1, 2, 3],    // starmap: up→crew(L), down→armory, left→crew, right→missions
  1: [0, 6, -1, -1],  // armory: up→starmap, down→PILOT
  2: [4, 0, -1, 3],   // crew: up→codex, down→starmap, right→missions
  3: [5, 0, 2, -1],   // missions: up→bestiary, down→starmap, left→crew
  4: [-1, 2, -1, 5],  // codex: down→crew, right→bestiary
  5: [-1, 3, 4, -1],  // bestiary: down→missions, left→codex
  6: [1, -1, -1, -1], // pilot: up→armory
};

// Transition duration in frames
const TRANSITION_FRAMES = 12;

// ─── State Creation ─────────────────────────────────────────────────

export function createCockpitState(): CockpitHubState {
  return {
    screen: "hub",
    selectedHotspot: 0,
    animTimer: 0,
    transitionTimer: 0,
    audioEvents: [],
    armorySelected: 0,
    crewSelected: 0,
    crewConvoIndex: 0,
    crewDialogLine: 0,
    crewDialogActive: false,
    missionSelected: 0,
    missionTab: 0,
    codexCategory: 0,
    codexSelected: 0,
    codexReading: false,
    bestiarySelected: 0,
    bestiaryReading: false,
    pilotTreeSelected: 0,
  };
}

// ─── Actions ────────────────────────────────────────────────────────

export type CockpitAction =
  | { type: "none" }
  | { type: "open-starmap" }
  | { type: "back" }
  | { type: "save-updated"; save: SaveData }
  | { type: "launch-planet"; planetId: PlanetId }
  | { type: "launch-special-mission"; missionId: SpecialMissionId }
  | { type: "allocate-skill"; nodeId: SkillNodeId };

// ─── Input Handling ─────────────────────────────────────────────────

let prevKeys: Keys | null = null;

export function resetCockpitKeys(): void {
  prevKeys = null;
}

export function updateCockpit(
  state: CockpitHubState,
  keys: Keys,
  save: SaveData
): { newState: CockpitHubState; action: CockpitAction } {
  const s = { ...state, animTimer: state.animTimer + 1, audioEvents: [] as AudioEvent[] };

  // Tick down transition timer
  if (s.transitionTimer > 0) s.transitionTimer -= 1;

  const justPressed = {
    up: keys.up && (!prevKeys || !prevKeys.up),
    down: keys.down && (!prevKeys || !prevKeys.down),
    left: keys.left && (!prevKeys || !prevKeys.left),
    right: keys.right && (!prevKeys || !prevKeys.right),
    shoot: keys.shoot && (!prevKeys || !prevKeys.shoot),
  };
  prevKeys = { ...keys };

  // ── Hub screen (hotspot navigation) ──
  if (s.screen === "hub") {
    const prevHotspot = s.selectedHotspot;
    const nav = NAV_GRAPH[s.selectedHotspot];
    if (nav) {
      if (justPressed.up && nav[0] >= 0) s.selectedHotspot = nav[0];
      if (justPressed.down && nav[1] >= 0) s.selectedHotspot = nav[1];
      if (justPressed.left && nav[2] >= 0) s.selectedHotspot = nav[2];
      if (justPressed.right && nav[3] >= 0) s.selectedHotspot = nav[3];
    }
    if (s.selectedHotspot !== prevHotspot) {
      s.audioEvents.push(AudioEvent.COCKPIT_NAV);
    }

    // Select hotspot
    if (justPressed.shoot) {
      const hotspot = COCKPIT_HOTSPOTS[s.selectedHotspot];
      if (hotspot) {
        if (hotspot.id === "starmap") {
          s.audioEvents.push(AudioEvent.COCKPIT_OPEN);
          return { newState: s, action: { type: "open-starmap" } };
        }
        // Open sub-screen
        s.screen = hotspot.id;
        s.transitionTimer = TRANSITION_FRAMES;
        s.audioEvents.push(AudioEvent.COCKPIT_OPEN);
      }
    }

    return { newState: s, action: { type: "none" } };
  }

  // ── Armory screen ──
  if (s.screen === "armory") {
    return updateArmory(s, justPressed, save);
  }

  // ── Crew screen ──
  if (s.screen === "crew") {
    return updateCrew(s, justPressed, save);
  }

  // ── Codex screen ──
  if (s.screen === "codex") {
    return updateCodex(s, justPressed, save);
  }

  // ── Bestiary screen ──
  if (s.screen === "bestiary") {
    return updateBestiary(s, justPressed, save);
  }

  // ── Missions screen ──
  if (s.screen === "missions") {
    return updateMissions(s, justPressed, save);
  }

  // ── Pilot screen ──
  if (s.screen === "pilot") {
    return updatePilot(s, justPressed, save);
  }

  // ── Other sub-screens: left goes back to hub ──
  if (justPressed.left) {
    s.screen = "hub";
    s.transitionTimer = TRANSITION_FRAMES;
    s.audioEvents.push(AudioEvent.COCKPIT_BACK);
    return { newState: s, action: { type: "none" } };
  }

  return { newState: s, action: { type: "none" } };
}

// ─── Armory Input ──────────────────────────────────────────────────

function updateArmory(
  s: CockpitHubState,
  justPressed: Record<string, boolean>,
  save: SaveData
): { newState: CockpitHubState; action: CockpitAction } {
  const prevSelected = s.armorySelected;

  // Navigate upgrade list
  if (justPressed.up) {
    s.armorySelected = Math.max(0, s.armorySelected - 1);
  }
  if (justPressed.down) {
    s.armorySelected = Math.min(UPGRADE_DEFS.length - 1, s.armorySelected + 1);
  }
  if (s.armorySelected !== prevSelected) {
    s.audioEvents.push(AudioEvent.COCKPIT_NAV);
  }

  // Back to hub
  if (justPressed.left) {
    s.screen = "hub";
    s.transitionTimer = TRANSITION_FRAMES;
    s.audioEvents.push(AudioEvent.COCKPIT_BACK);
    return { newState: s, action: { type: "none" } };
  }

  // Purchase upgrade
  if (justPressed.shoot) {
    const def = UPGRADE_DEFS[s.armorySelected];
    const currentLevel = save.upgrades[def.id];
    const cost = getUpgradeCost(def, currentLevel);

    if (cost !== null && canPurchase(save, def, currentLevel)) {
      const newSave = purchaseUpgrade(save, def.id, cost);
      if (newSave) {
        s.audioEvents.push(AudioEvent.UPGRADE_PURCHASE);
        return { newState: s, action: { type: "save-updated", save: newSave } };
      }
    }
    // Can't afford or maxed
    s.audioEvents.push(AudioEvent.UPGRADE_DENIED);
  }

  return { newState: s, action: { type: "none" } };
}

// ─── Crew Input ───────────────────────────────────────────────────────

function updateCrew(
  s: CockpitHubState,
  justPressed: Record<string, boolean>,
  save: SaveData
): { newState: CockpitHubState; action: CockpitAction } {
  const crew = CREW[s.crewSelected];
  const convos = crew ? getAvailableConversations(crew.id, save) : [];

  // ── Dialog active: reading a conversation ──
  if (s.crewDialogActive) {
    const convo = convos[s.crewConvoIndex];

    // Advance dialog line
    if (justPressed.shoot || justPressed.right) {
      if (convo && s.crewDialogLine < convo.lines.length - 1) {
        s.crewDialogLine += 1;
        s.audioEvents.push(AudioEvent.DIALOG_ADVANCE);
      } else {
        // End of conversation — mark as viewed and exit dialog
        if (convo) {
          const newSave = markConversationViewed(save, convo.id);
          s.crewDialogActive = false;
          s.crewDialogLine = 0;
          s.audioEvents.push(AudioEvent.DIALOG_CLOSE);
          return { newState: s, action: { type: "save-updated", save: newSave } };
        }
        s.crewDialogActive = false;
        s.crewDialogLine = 0;
        s.audioEvents.push(AudioEvent.DIALOG_CLOSE);
      }
      return { newState: s, action: { type: "none" } };
    }

    // Go back from dialog
    if (justPressed.left) {
      const convo2 = convos[s.crewConvoIndex];
      if (convo2) {
        const newSave = markConversationViewed(save, convo2.id);
        s.crewDialogActive = false;
        s.crewDialogLine = 0;
        s.audioEvents.push(AudioEvent.DIALOG_CLOSE);
        return { newState: s, action: { type: "save-updated", save: newSave } };
      }
      s.crewDialogActive = false;
      s.crewDialogLine = 0;
      s.audioEvents.push(AudioEvent.DIALOG_CLOSE);
    }

    return { newState: s, action: { type: "none" } };
  }

  // ── Character selection (left/right) ──
  if (justPressed.left && s.crewSelected > 0) {
    s.crewSelected -= 1;
    s.crewConvoIndex = 0;
    s.audioEvents.push(AudioEvent.COCKPIT_NAV);
    return { newState: s, action: { type: "none" } };
  }
  if (justPressed.right && s.crewSelected < CREW.length - 1) {
    s.crewSelected += 1;
    s.crewConvoIndex = 0;
    s.audioEvents.push(AudioEvent.COCKPIT_NAV);
    return { newState: s, action: { type: "none" } };
  }

  // ── Conversation list navigation (up/down) ──
  const prevConvo = s.crewConvoIndex;
  if (justPressed.up && s.crewConvoIndex > 0) {
    s.crewConvoIndex -= 1;
  }
  if (justPressed.down && convos.length > 0) {
    s.crewConvoIndex = Math.min(convos.length - 1, s.crewConvoIndex + 1);
  }
  if (s.crewConvoIndex !== prevConvo) {
    s.audioEvents.push(AudioEvent.COCKPIT_NAV);
  }

  // ── Open conversation ──
  if (justPressed.shoot && convos.length > 0) {
    s.crewDialogActive = true;
    s.crewDialogLine = 0;
    s.audioEvents.push(AudioEvent.DIALOG_ADVANCE);
    return { newState: s, action: { type: "none" } };
  }

  // ── Back to hub (at leftmost character and pressing left) ──
  if (justPressed.left) {
    s.screen = "hub";
    s.transitionTimer = TRANSITION_FRAMES;
    s.audioEvents.push(AudioEvent.COCKPIT_BACK);
    return { newState: s, action: { type: "none" } };
  }

  return { newState: s, action: { type: "none" } };
}

// ─── Missions Input ───────────────────────────────────────────────────

function updateMissions(
  s: CockpitHubState,
  justPressed: Record<string, boolean>,
  save: SaveData
): { newState: CockpitHubState; action: CockpitAction } {
  // Tab switching: left/right at top level switches tabs
  if (justPressed.right && s.missionTab < 2) {
    s.missionTab += 1;
    s.missionSelected = 0;
    s.audioEvents.push(AudioEvent.COCKPIT_NAV);
    return { newState: s, action: { type: "none" } };
  }
  if (justPressed.left && s.missionTab > 0) {
    s.missionTab = 0;
    s.missionSelected = 0;
    s.audioEvents.push(AudioEvent.COCKPIT_NAV);
    return { newState: s, action: { type: "none" } };
  }

  // Back to hub (left on first tab)
  if (justPressed.left && s.missionTab === 0) {
    s.screen = "hub";
    s.missionTab = 0;
    s.missionSelected = 0;
    s.transitionTimer = TRANSITION_FRAMES;
    s.audioEvents.push(AudioEvent.COCKPIT_BACK);
    return { newState: s, action: { type: "none" } };
  }

  if (s.missionTab === 0) {
    // ── Side Quests tab ──
    return updateMissionsQuests(s, justPressed, save);
  } else if (s.missionTab === 1) {
    // ── Special Missions tab ──
    return updateMissionsSpecial(s, justPressed, save);
  } else {
    // ── Planet Missions tab ──
    return updateMissionsPlanets(s, justPressed, save);
  }
}

function updateMissionsQuests(
  s: CockpitHubState,
  justPressed: Record<string, boolean>,
  save: SaveData
): { newState: CockpitHubState; action: CockpitAction } {
  const quests = getAvailableQuests(save);

  // Navigate quest list
  const prevMission = s.missionSelected;
  if (justPressed.up && s.missionSelected > 0) {
    s.missionSelected -= 1;
  }
  if (justPressed.down && quests.length > 0) {
    s.missionSelected = Math.min(quests.length - 1, s.missionSelected + 1);
  }
  if (s.missionSelected !== prevMission) {
    s.audioEvents.push(AudioEvent.COCKPIT_NAV);
  }

  // Accept / Abandon quest
  if (justPressed.shoot && quests.length > 0) {
    const quest = quests[s.missionSelected];
    if (quest) {
      if (isQuestActive(quest.id, save)) {
        // Abandon
        const newSave = abandonQuest(save, quest.id);
        s.audioEvents.push(AudioEvent.QUEST_ABANDON);
        return { newState: s, action: { type: "save-updated", save: newSave } };
      } else if (!isQuestCompleted(quest.id, save)) {
        // Accept (max 3)
        const newSave = acceptQuest(save, quest.id);
        if (newSave) {
          s.audioEvents.push(AudioEvent.QUEST_ACCEPT);
          return { newState: s, action: { type: "save-updated", save: newSave } };
        }
        // At max capacity
        s.audioEvents.push(AudioEvent.UPGRADE_DENIED);
      }
    }
  }

  return { newState: s, action: { type: "none" } };
}

function updateMissionsPlanets(
  s: CockpitHubState,
  justPressed: Record<string, boolean>,
  save: SaveData
): { newState: CockpitHubState; action: CockpitAction } {
  const planets = PLANET_DEFS;

  // Navigate planet list
  const prevMission = s.missionSelected;
  if (justPressed.up && s.missionSelected > 0) {
    s.missionSelected -= 1;
  }
  if (justPressed.down && planets.length > 0) {
    s.missionSelected = Math.min(planets.length - 1, s.missionSelected + 1);
  }
  if (s.missionSelected !== prevMission) {
    s.audioEvents.push(AudioEvent.COCKPIT_NAV);
  }

  // Launch planet mission
  if (justPressed.shoot && planets.length > 0) {
    const planet = planets[s.missionSelected];
    if (planet && isPlanetUnlocked(planet, save) && !isPlanetCompleted(planet.id, save)) {
      s.audioEvents.push(AudioEvent.COCKPIT_OPEN);
      return { newState: s, action: { type: "launch-planet", planetId: planet.id } };
    }
    // Can't launch — locked or already completed
    s.audioEvents.push(AudioEvent.UPGRADE_DENIED);
  }

  return { newState: s, action: { type: "none" } };
}

function updateMissionsSpecial(
  s: CockpitHubState,
  justPressed: Record<string, boolean>,
  save: SaveData
): { newState: CockpitHubState; action: CockpitAction } {
  const missions = getAvailableSpecialMissions(save);

  const prevMission = s.missionSelected;
  if (justPressed.up && s.missionSelected > 0) {
    s.missionSelected -= 1;
  }
  if (justPressed.down && missions.length > 0) {
    s.missionSelected = Math.min(missions.length - 1, s.missionSelected + 1);
  }
  if (s.missionSelected !== prevMission) {
    s.audioEvents.push(AudioEvent.COCKPIT_NAV);
  }

  if (justPressed.shoot && missions.length > 0) {
    const mission = missions[s.missionSelected];
    if (mission) {
      s.audioEvents.push(AudioEvent.COCKPIT_OPEN);
      return { newState: s, action: { type: "launch-special-mission", missionId: mission.id } };
    }
  }

  return { newState: s, action: { type: "none" } };
}

// ─── Codex Input ──────────────────────────────────────────────────────

function updateCodex(
  s: CockpitHubState,
  justPressed: Record<string, boolean>,
  save: SaveData
): { newState: CockpitHubState; action: CockpitAction } {
  const cat = CODEX_CATEGORIES[s.codexCategory];
  const entries = cat ? getEntriesForCategory(cat.id, save) : [];

  // ── Reading an entry ──
  if (s.codexReading) {
    const entry = entries[s.codexSelected];

    // Close reading view
    if (justPressed.left || justPressed.shoot) {
      if (entry) {
        const newSave = markCodexRead(save, entry.id);
        s.codexReading = false;
        s.audioEvents.push(AudioEvent.COCKPIT_BACK);
        return { newState: s, action: { type: "save-updated", save: newSave } };
      }
      s.codexReading = false;
      s.audioEvents.push(AudioEvent.COCKPIT_BACK);
    }

    // Scroll (up/down) — handled in renderer, state just tracks
    return { newState: s, action: { type: "none" } };
  }

  // ── Category tabs (left/right) ──
  if (justPressed.right && s.codexCategory < CODEX_CATEGORIES.length - 1) {
    s.codexCategory += 1;
    s.codexSelected = 0;
    s.audioEvents.push(AudioEvent.COCKPIT_NAV);
    return { newState: s, action: { type: "none" } };
  }
  if (justPressed.left && s.codexCategory > 0) {
    s.codexCategory -= 1;
    s.codexSelected = 0;
    s.audioEvents.push(AudioEvent.COCKPIT_NAV);
    return { newState: s, action: { type: "none" } };
  }

  // ── Entry list navigation (up/down) ──
  const prevEntry = s.codexSelected;
  if (justPressed.up && s.codexSelected > 0) {
    s.codexSelected -= 1;
  }
  if (justPressed.down && entries.length > 0) {
    s.codexSelected = Math.min(entries.length - 1, s.codexSelected + 1);
  }
  if (s.codexSelected !== prevEntry) {
    s.audioEvents.push(AudioEvent.COCKPIT_NAV);
  }

  // ── Open entry ──
  if (justPressed.shoot && entries.length > 0 && entries[s.codexSelected]) {
    s.codexReading = true;
    s.audioEvents.push(AudioEvent.COCKPIT_OPEN);
    return { newState: s, action: { type: "none" } };
  }

  // ── Back to hub (left at first category) ──
  if (justPressed.left) {
    s.screen = "hub";
    s.transitionTimer = TRANSITION_FRAMES;
    s.audioEvents.push(AudioEvent.COCKPIT_BACK);
    return { newState: s, action: { type: "none" } };
  }

  return { newState: s, action: { type: "none" } };
}

// ─── Bestiary Input ───────────────────────────────────────────────────

function updateBestiary(
  s: CockpitHubState,
  justPressed: Record<string, boolean>,
  save: SaveData
): { newState: CockpitHubState; action: CockpitAction } {
  const entries = getBestiaryList(save.bestiary);

  // In reading mode — Enter or Left closes detail view
  if (s.bestiaryReading) {
    if (justPressed.left || justPressed.shoot) {
      s.bestiaryReading = false;
      s.audioEvents.push(AudioEvent.COCKPIT_BACK);
    }
    return { newState: s, action: { type: "none" } };
  }

  // Navigate entry list
  const prevSelected = s.bestiarySelected;
  if (justPressed.up && s.bestiarySelected > 0) {
    s.bestiarySelected -= 1;
  }
  if (justPressed.down && entries.length > 0) {
    s.bestiarySelected = Math.min(entries.length - 1, s.bestiarySelected + 1);
  }
  if (s.bestiarySelected !== prevSelected) {
    s.audioEvents.push(AudioEvent.COCKPIT_NAV);
  }

  // Enter to open detail view
  if (justPressed.shoot && entries.length > 0) {
    s.bestiaryReading = true;
    s.audioEvents.push(AudioEvent.COCKPIT_OPEN);
    return { newState: s, action: { type: "none" } };
  }

  // Back to hub
  if (justPressed.left) {
    s.screen = "hub";
    s.transitionTimer = TRANSITION_FRAMES;
    s.audioEvents.push(AudioEvent.COCKPIT_BACK);
    return { newState: s, action: { type: "none" } };
  }

  return { newState: s, action: { type: "none" } };
}

// ─── Pilot Input ──────────────────────────────────────────────────────

function updatePilot(
  s: CockpitHubState,
  justPressed: Record<string, boolean>,
  save: SaveData
): { newState: CockpitHubState; action: CockpitAction } {
  const nodes = getTreeNodes("combat");

  if (justPressed.up && s.pilotTreeSelected > 0) {
    s.pilotTreeSelected -= 1;
    s.audioEvents.push(AudioEvent.COCKPIT_NAV);
  }
  if (justPressed.down && s.pilotTreeSelected < nodes.length - 1) {
    s.pilotTreeSelected += 1;
    s.audioEvents.push(AudioEvent.COCKPIT_NAV);
  }

  // Allocate skill point
  if (justPressed.shoot && nodes.length > 0) {
    const node = nodes[s.pilotTreeSelected];
    if (canAllocate(node.id, save.allocatedSkills, save.skillPoints)) {
      s.audioEvents.push(AudioEvent.UPGRADE_PURCHASE);
      return {
        newState: s,
        action: { type: "allocate-skill", nodeId: node.id },
      };
    } else {
      s.audioEvents.push(AudioEvent.UPGRADE_DENIED);
    }
  }

  // Back to hub
  if (justPressed.left) {
    s.screen = "hub";
    s.transitionTimer = TRANSITION_FRAMES;
    s.audioEvents.push(AudioEvent.COCKPIT_BACK);
    return { newState: s, action: { type: "none" } };
  }

  return { newState: s, action: { type: "none" } };
}

// ─── Touch Handling ─────────────────────────────────────────────────

export function getCockpitTouchHotspot(x: number, y: number): number {
  for (let i = 0; i < COCKPIT_HOTSPOTS.length; i++) {
    const h = COCKPIT_HOTSPOTS[i];
    if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) {
      return i;
    }
  }
  return -1;
}

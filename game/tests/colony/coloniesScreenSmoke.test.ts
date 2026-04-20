import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { ColoniesScreen } from "../../app/components/colony/meta";
import type { SaveData } from "../../app/components/engine/types";

function makeEmptySave(): SaveData {
  return {
    currentWorld: 1, levels: {}, credits: 0, totalStars: 0, totalScore: 0, xp: 0,
    upgrades: {} as SaveData["upgrades"], unlockedCodex: [], viewedCodex: [],
    viewedConversations: [], completedQuests: [], activeQuests: [],
    completedPlanets: [], unlockedSpecialMissions: [], completedSpecialMissions: [],
    storyItems: [], materials: [], consumableInventory: {}, equippedConsumables: [],
    unlockedEnhancements: [], bestiary: {}, equippedWeaponType: "kinetic",
    pilotLevel: 1, skillPoints: 0, allocatedSkills: [],
    colonies: [], planets: [], earthShipments: [], factionStandings: [], bounties: [],
    missionsSinceStart: 0,
    gameClock: { day: 0, hour: 7, minute: 0, realtimeMsPerGameMinute: 1000, season: "standard" },
  };
}

test("ColoniesScreen renders empty state without throwing", () => {
  const save = makeEmptySave();
  const html = renderToString(createElement(ColoniesScreen, {
    save,
    onDispatch: () => {},
    onExit: () => {},
  }));
  assert.ok(html.includes("NO COLONIES FOUNDED"), "should render the empty-state heading");
  assert.ok(html.includes("Found Colony at Ashfall"), "should render the found button");
});

test("ColoniesScreen renders populated state without throwing", () => {
  const save = makeEmptySave();
  const populated = {
    ...save,
    missionsSinceStart: 3,
    colonies: [{
      id: "ashfall_primary",
      name: "Ashfall Primary",
      planetId: "ashfall" as const,
      foundingType: "outpost" as const,
      tier: 1 as const,
      regionNodeId: "ashfall_starter_region",
      population: { total: 0, capacity: 0, namedCount: 0, growthRate: 0, recentDeaths: [] },
      resources: { food: 0, water: 0, metal: 500, credits: 0 },
      buildings: [],
      districts: [],
      namedNpcs: [],
      backgroundColonistDensity: 0,
      happiness: 50,
      selfSufficient: false,
      lastCycleProcessed: 0,
      lastGameClock: { day: 0, hour: 7, minute: 0, realtimeMsPerGameMinute: 1000, season: "standard" },
      activeThreats: [],
      activeQuestlines: [],
      discoveredPoiIds: [],
      layoutSeed: 42,
      founded: { missionCount: 0, gameClockTick: 0 },
    }],
  };
  const html = renderToString(createElement(ColoniesScreen, {
    save: populated,
    onDispatch: () => {},
    onExit: () => {},
  }));
  assert.ok(html.includes("Ashfall Primary"), "should render colony name");
  assert.ok(html.includes("RETURN TO COCKPIT"), "should render back link");
});

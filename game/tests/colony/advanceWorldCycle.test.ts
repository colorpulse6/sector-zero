import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceWorldCycle } from "../../app/components/colony/shared/cycleProcessor";
import type { SaveData } from "../../app/components/engine/types";
import { makeTestColony } from "./fixtures";

function makeSaveWith(colonies: SaveData["colonies"]): SaveData {
  return {
    currentWorld: 1, levels: {}, credits: 0, totalStars: 0, totalScore: 0, xp: 0,
    upgrades: {} as SaveData["upgrades"], unlockedCodex: [], viewedCodex: [],
    viewedConversations: [], completedQuests: [], activeQuests: [],
    completedPlanets: [], unlockedSpecialMissions: [], completedSpecialMissions: [],
    storyItems: [], materials: [], consumableInventory: {}, equippedConsumables: [],
    unlockedEnhancements: [], bestiary: {}, equippedWeaponType: "kinetic",
    pilotLevel: 1, skillPoints: 0, allocatedSkills: [],
    colonies, planets: [], earthShipments: [], factionStandings: [], bounties: [],
    missionsSinceStart: 0,
    gameClock: { day: 0, hour: 7, minute: 0, realtimeMsPerGameMinute: 1000, season: "standard" },
  };
}

test("advanceWorldCycle increments missionsSinceStart and ticks every colony", () => {
  const save = makeSaveWith([
    makeTestColony({ id: "c1" }),
    makeTestColony({ id: "c2" }),
  ]);
  const next = advanceWorldCycle(save);
  assert.equal(next.missionsSinceStart, 1);
  assert.equal(next.colonies[0].lastCycleProcessed, 1);
  assert.equal(next.colonies[1].lastCycleProcessed, 1);
});

test("advanceWorldCycle maintains invariant: all colonies at missionsSinceStart", () => {
  const save = makeSaveWith([makeTestColony({ id: "c1" })]);
  const next = advanceWorldCycle(save);
  assert.equal(next.colonies[0].lastCycleProcessed, next.missionsSinceStart);
});

test("advanceWorldCycle does not mutate input", () => {
  const save = makeSaveWith([makeTestColony({ id: "c1" })]);
  advanceWorldCycle(save);
  assert.equal(save.missionsSinceStart, 0);
});

test("advanceWorldCycle handles empty colonies list", () => {
  const save = makeSaveWith([]);
  const next = advanceWorldCycle(save);
  assert.equal(next.missionsSinceStart, 1);
});

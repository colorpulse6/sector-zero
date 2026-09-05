import assert from "node:assert/strict";
import { test } from "node:test";
import * as cockpit from "../../app/components/engine/cockpit";
import { createHydrationSafeSave } from "../../app/components/engine/save";
import { CODEX_CATEGORIES, CODEX_ENTRIES, getEntriesForCategory } from "../../app/components/engine/codex";
import { CREW, getAvailableConversations } from "../../app/components/engine/crewDialog";
import { UPGRADE_DEFS } from "../../app/components/engine/upgrades";
import { EnemyType, type SaveData } from "../../app/components/engine/types";

const saveFixture = (): SaveData => {
  const save = createHydrationSafeSave();
  save.credits = 100000;
  save.xp = 100000;
  save.skillPoints = 10;
  save.unlockedCodex = CODEX_ENTRIES.map((entry) => entry.id);
  for (let world = 1; world <= 8; world += 1) {
    for (let level = 1; level <= 5; level += 1) {
      save.levels[`${world}-${level}`] = { completed: true, stars: 3, highScore: 1000 };
    }
  }
  save.bestiary = {
    [EnemyType.SCOUT]: { enemyType: EnemyType.SCOUT, classId: "swarm", killCount: 1 },
    [EnemyType.DRONE]: { enemyType: EnemyType.DRONE, classId: "tech-drone", killCount: 1 },
  };
  return save;
};

function activate(state: cockpit.CockpitHubState, save: SaveData, x: number, y: number) {
  const hit = cockpit.hitTestCockpitScreen(state, save, x, y);
  assert.ok(hit, `Expected a visible ${state.screen} target at ${x}, ${y}`);
  return cockpit.applyCockpitScreenHit(state, save, hit);
}

test("armory click purchases the hit row instead of keyboard selection, with canonical costs", () => {
  const save = saveFixture();
  const state = { ...cockpit.createCockpitState(), screen: "armory" as const };
  const result = activate(state, save, 100, 150);
  assert.equal(result.newState.armorySelected, 1);
  assert.equal(result.action.type, "save-updated");
  if (result.action.type !== "save-updated") return;
  assert.equal(result.action.save.upgrades[UPGRADE_DEFS[1].id], 1);
  assert.equal(result.action.save.upgrades[UPGRADE_DEFS[0].id], 0);
  assert.equal(save.upgrades[UPGRADE_DEFS[1].id], 0);
  assert.equal(state.armorySelected, 0);
});

test("crew cards select the hit person and conversation rows open the hit conversation", () => {
  const save = saveFixture();
  const state = { ...cockpit.createCockpitState(), screen: "crew" as const };
  const selected = activate(state, save, 400, 120).newState;
  assert.equal(selected.crewSelected, 2);
  assert.equal(selected.crewDialogActive, false);
  assert.ok(getAvailableConversations(CREW[2].id, save).length >= 2);
  const opened = activate(selected, save, 100, 320).newState;
  assert.equal(opened.crewConvoIndex, 1);
  assert.equal(opened.crewDialogActive, true);
  assert.equal(opened.crewDialogLine, 0);
  const advanced = activate(opened, save, 240, 774).newState;
  assert.equal(advanced.crewDialogLine, 1);
  const closed = activate(advanced, save, 35, 22);
  assert.equal(closed.newState.crewDialogActive, false);
  assert.equal(closed.newState.screen, "crew");
  assert.equal(closed.action.type, "save-updated");
});

test("codex tab and row activation read the hit entry and close through the canonical read fold", () => {
  const save = saveFixture();
  const state = { ...cockpit.createCockpitState(), screen: "codex" as const };
  const selected = activate(state, save, 180, 70).newState;
  assert.equal(selected.codexCategory, 1);
  assert.ok(getEntriesForCategory(CODEX_CATEGORIES[1].id, save).length >= 2);
  const opened = activate(selected, save, 100, 150).newState;
  assert.equal(opened.codexSelected, 1);
  assert.equal(opened.codexReading, true);
  const closed = activate(opened, save, 240, 814);
  assert.equal(closed.newState.codexReading, false);
  assert.equal(closed.newState.screen, "codex");
  assert.equal(closed.action.type, "save-updated");
});

test("bestiary click opens the hit entry and explicit close returns to its selection", () => {
  const save = saveFixture();
  const state = { ...cockpit.createCockpitState(), screen: "bestiary" as const };
  const opened = activate(state, save, 100, 125).newState;
  assert.equal(opened.bestiarySelected, 1);
  assert.equal(opened.bestiaryReading, true);
  const closed = activate(opened, save, 240, 829);
  assert.equal(closed.newState.bestiaryReading, false);
  assert.equal(closed.newState.bestiarySelected, 1);
});

test("pilot click allocates the hit node and retains prerequisite checks", () => {
  const save = saveFixture();
  const state = { ...cockpit.createCockpitState(), screen: "pilot" as const };
  const result = activate(state, save, 100, 270);
  assert.equal(result.newState.pilotTreeSelected, 1);
  assert.deepEqual(result.action, { type: "allocate-skill", nodeId: "overcharge" });
  const denied = activate(state, save, 100, 320);
  assert.equal(denied.newState.pilotTreeSelected, 2);
  assert.equal(denied.action.type, "none");
  assert.deepEqual(save.allocatedSkills, []);
});

for (const screen of ["armory", "crew", "codex", "bestiary", "pilot"] as const) {
  test(`${screen} back is explicit and hit testing never changes keyboard selection`, () => {
    const save = saveFixture();
    const state = { ...cockpit.createCockpitState(), screen, crewSelected: 2, codexCategory: 2 };
    const before = structuredClone(state);
    assert.equal(cockpit.hitTestCockpitScreen(state, save, 470, 760), null);
    assert.deepEqual(state, before);
    const result = activate(state, save, 35, 25);
    assert.equal(result.newState.screen, "hub");
    assert.equal(result.action.type, "none");
    assert.deepEqual(state, before);
  });
}

test("empty list space and detail content have no accidental activation target", () => {
  const save = createHydrationSafeSave();
  const state = { ...cockpit.createCockpitState(), screen: "bestiary" as const };
  assert.equal(cockpit.hitTestCockpitScreen(state, save, 100, 125), null);
  for (const detailed of [
    { ...state, bestiaryReading: true },
    { ...state, screen: "crew" as const, crewDialogActive: true },
    { ...state, screen: "codex" as const, codexReading: true },
  ]) assert.equal(cockpit.hitTestCockpitScreen(detailed, saveFixture(), 240, 350), null);
});

test("a hit from a different category cannot activate the new category's row", () => {
  const save = saveFixture();
  const state = { ...cockpit.createCockpitState(), screen: "codex" as const };
  const hit = cockpit.hitTestCockpitScreen(state, save, 100, 110);
  assert.ok(hit);
  const switched = { ...state, codexCategory: 1 };
  const result = cockpit.applyCockpitScreenHit(switched, save, hit);
  assert.equal(result.newState.codexReading, false);
  assert.equal(result.action.type, "none");
});

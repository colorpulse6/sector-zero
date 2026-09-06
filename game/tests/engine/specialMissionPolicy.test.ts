import assert from "node:assert/strict";
import test from "node:test";

import {
  createCockpitState,
  resetCockpitKeys,
  updateCockpit,
} from "../../app/components/engine/cockpit";
import * as cockpit from "../../app/components/engine/cockpit";
import { createHydrationSafeSave } from "../../app/components/engine/save";
import {
  getAvailableSpecialMissions,
  isSpecialMissionCompleted,
} from "../../app/components/engine/specialMissions";
import { PLANET_DEFS } from "../../app/components/engine/planets";
import type { Keys, SaveData } from "../../app/components/engine/types";

const RELEASED: Keys = {
  left: false,
  right: false,
  up: false,
  down: false,
  strafeLeft: false,
  strafeRight: false,
  shoot: false,
  bomb: false,
  jump: false,
};

function keplerSave(completed: boolean): SaveData {
  const save = createHydrationSafeSave();
  save.unlockedSpecialMissions = ["kepler-black-box"];
  save.completedSpecialMissions = completed ? ["kepler-black-box"] : [];
  save.storyItems = completed ? ["kepler-black-box"] : [];
  return save;
}

function press(
  state: ReturnType<typeof createCockpitState>,
  save: SaveData,
  key: keyof Keys,
) {
  resetCockpitKeys();
  return updateCockpit(state, { ...RELEASED, [key]: true }, save);
}

test("cleared Kepler remains listed but keyboard activation is denied", () => {
  const save = keplerSave(true);
  const missions = getAvailableSpecialMissions(save);
  assert.deepEqual(missions.map((mission) => mission.id), ["kepler-black-box"]);
  assert.equal(isSpecialMissionCompleted("kepler-black-box", save), true);

  const state = {
    ...createCockpitState(),
    screen: "missions" as const,
    missionTab: 1,
    missionSelected: 0,
  };
  const result = press(state, save, "shoot");

  assert.deepEqual(result.action, { type: "none" });
});

test("Mission Board Left moves from Planet Missions to adjacent Special Ops", () => {
  const state = {
    ...createCockpitState(),
    screen: "missions" as const,
    missionTab: 2,
    missionSelected: 4,
  };

  const result = press(state, keplerSave(false), "left");

  assert.equal(result.newState.missionTab, 1);
  assert.equal(result.newState.missionSelected, 0);
});

test("Mission Board exposes one geometry and hit/action contract", () => {
  const api = cockpit as typeof cockpit & {
    getMissionBoardLayout?: unknown;
    hitTestMissionBoard?: unknown;
    applyMissionBoardHit?: unknown;
  };

  assert.equal(typeof api.getMissionBoardLayout, "function");
  assert.equal(typeof api.hitTestMissionBoard, "function");
  assert.equal(typeof api.applyMissionBoardHit, "function");
});

test("Mission Board geometry owns tab and visible-row hit targets", () => {
  type Rect = { x: number; y: number; w: number; h: number };
  type Layout = {
    back: Rect;
    tabs: Array<Rect & { tab: number }>;
    rows: Array<Rect & { index: number; enabled: boolean }>;
  };
  const api = cockpit as typeof cockpit & {
    getMissionBoardLayout: (state: ReturnType<typeof createCockpitState>, save: SaveData) => Layout;
    hitTestMissionBoard: (
      state: ReturnType<typeof createCockpitState>,
      save: SaveData,
      x: number,
      y: number,
    ) => { kind: string; tab?: number; index?: number } | null;
  };
  const state = {
    ...createCockpitState(),
    screen: "missions" as const,
    missionTab: 1,
  };

  const layout = api.getMissionBoardLayout(state, keplerSave(false));

  assert.deepEqual(layout.tabs.map(({ x, y, w, h }) => ({ x, y, w, h })), [
    { x: 12, y: 52, w: 148, h: 26 },
    { x: 166, y: 52, w: 148, h: 26 },
    { x: 320, y: 52, w: 148, h: 26 },
  ]);
  assert.deepEqual(layout.rows[0], { x: 12, y: 88, w: 456, h: 68, index: 0, enabled: true });
  assert.deepEqual(api.hitTestMissionBoard(state, keplerSave(false), 240, 65), {
    kind: "tab",
    tab: 1,
  });
  assert.deepEqual(api.hitTestMissionBoard(state, keplerSave(false), 240, 120), {
    kind: "row",
    tab: 1,
    index: 0,
  });
});

test("pointer/touch row activation launches the hit planet rather than stale selection", () => {
  type Hit = { kind: "row"; tab: 2; index: number };
  const api = cockpit as typeof cockpit & {
    applyMissionBoardHit: (
      state: ReturnType<typeof createCockpitState>,
      save: SaveData,
      hit: Hit,
    ) => ReturnType<typeof updateCockpit>;
  };
  const save = createHydrationSafeSave();
  save.levels = Object.fromEntries(PLANET_DEFS.map((planet) => [
    planet.unlockAfterLevel,
    { completed: true, stars: 3, highScore: 1 },
  ]));
  save.totalStars = Math.max(...PLANET_DEFS.map((planet) => planet.unlockStars));
  const state = {
    ...createCockpitState(),
    screen: "missions" as const,
    missionTab: 2,
    missionSelected: 0,
  };

  const result = api.applyMissionBoardHit(state, save, { kind: "row", tab: 2, index: 4 });

  assert.equal(result.newState.missionSelected, 4);
  assert.deepEqual(result.action, { type: "launch-planet", planetId: PLANET_DEFS[4].id });
});

test("cleared Kepler row hit is selected but cannot activate", () => {
  type Hit = { kind: "row"; tab: 1; index: number };
  const api = cockpit as typeof cockpit & {
    applyMissionBoardHit: (
      state: ReturnType<typeof createCockpitState>,
      save: SaveData,
      hit: Hit,
    ) => ReturnType<typeof updateCockpit>;
  };
  const state = {
    ...createCockpitState(),
    screen: "missions" as const,
    missionTab: 1,
    missionSelected: 0,
  };

  const result = api.applyMissionBoardHit(state, keplerSave(true), {
    kind: "row",
    tab: 1,
    index: 0,
  });

  assert.equal(result.newState.missionSelected, 0);
  assert.deepEqual(result.action, { type: "none" });
});

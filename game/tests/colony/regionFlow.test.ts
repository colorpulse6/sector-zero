import { test } from "node:test";
import assert from "node:assert/strict";
import { GameScreen } from "../../app/components/engine/types";
import { migrateSave } from "../../app/components/engine/save";
import { colonyReducer } from "../../app/components/colony/shared/colonyReducer";
import { Events } from "../../app/components/colony/shared/colonyEvents";
import { dispatchPoi } from "../../app/components/colony/region/poiDispatcher";
import { createPoiGameState, preparePoiCompletion, resolvePoiCompletion } from "../../app/components/colony/region/poiRuntime";

function ready() {
  const fresh = migrateSave({});
  let save = colonyReducer(fresh, Events.founded({ colonyId: "home", name: "Home", planetId: "ashfall", foundingType: "outpost", regionNodeId: "ashfall-forward-camp", missionCount: 0, layoutSeed: 1 }));
  save = { ...save, planets: save.planets.map(p => ({ ...p, regionMap: { ...p.regionMap, nodes: p.regionMap.nodes.map(n => n.id === "ashfall-cinder-relay" ? { ...n, intel: "surveyed" as const } : n) } })) };
  return save;
}

test("native sessions create launchable states for all engine modes", () => {
  const save = ready();
  const dispatched = dispatchPoi(save, "home", "ashfall-cinder-relay");
  assert.equal(dispatched.ok, true);
  if (!dispatched.ok) return;
  const state = createPoiGameState(dispatched.session, save);
  assert.equal(state.currentMode, "first-person");
  assert.equal(state.screen, GameScreen.PLAYING);
});

test("only active LEVEL_COMPLETE prepares one completion cycle and atomic outcome", () => {
  const save = ready();
  const dispatched = dispatchPoi(save, "home", "ashfall-cinder-relay");
  assert.equal(dispatched.ok, true);
  if (!dispatched.ok) return;
  const active = { originColonyId: "home", session: dispatched.session };
  assert.equal(preparePoiCompletion(save, active, GameScreen.GAME_OVER), null);
  const pending = preparePoiCompletion(save, active, GameScreen.LEVEL_COMPLETE);
  assert.ok(pending);
  assert.equal(pending!.baseSave.missionsSinceStart, save.missionsSinceStart + 1);
  const resolved = resolvePoiCompletion(pending!, "home");
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;
  assert.equal(resolved.save.colonies[0].resources.metal, 80);
  assert.equal(resolved.save.planets[0].regionMap.nodes.find(n => n.id === "ashfall-cinder-relay")?.intel, "cleared");
});

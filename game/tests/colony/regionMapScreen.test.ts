import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RegionMapScreen } from "../../app/components/colony/meta/RegionMapScreen";
import { migrateSave } from "../../app/components/engine/save";
import { colonyReducer } from "../../app/components/colony/shared/colonyReducer";
import { Events } from "../../app/components/colony/shared/colonyEvents";
import { surveyRegionNode } from "../../app/components/colony/region/siteEconomy";

function save() {
  const fresh = migrateSave({});
  let result = colonyReducer(fresh, Events.founded({ colonyId: "home", name: "Home", planetId: "ashfall", foundingType: "outpost", regionNodeId: "ashfall-forward-camp", missionCount: 0, layoutSeed: 1 }));
  result = colonyReducer(result, Events.resourceChanged({ colonyId: "home", delta: { metal: 600, food: 100, water: 100 }, reason: "test" }));
  return result;
}

test("region map hides unknown stats and cockpit mode is view-only", () => {
  const html = renderToStaticMarkup(React.createElement(RegionMapScreen, { save: save(), originColonyId: "home", mode: "view", onClose() {} }));
  assert.match(html, /COCKPIT VIEW/);
  assert.match(html, /UNKNOWN SIGNAL/);
  assert.doesNotMatch(html, />SURVEY/);
  assert.doesNotMatch(html, />TRAVEL/);
  assert.doesNotMatch(html, /Found outpost at/);
});

test("pad mode exposes only graph-eligible actions and surveyed stats", () => {
  const surveyed = surveyRegionNode(save(), "home", "ashfall-basalt-basin");
  assert.equal(surveyed.ok, true);
  if (!surveyed.ok) return;
  const html = renderToStaticMarkup(React.createElement(RegionMapScreen, { save: surveyed.save, originColonyId: "home", mode: "pad", onClose() {}, onSurvey() {}, onTravel() {}, onFound() {} }));
  assert.match(html, /ORE DENSITY/);
  assert.match(html, /Found outpost at Basalt Basin/);
  assert.match(html, /300 METAL/);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RegionMapScreen } from "../../app/components/colony/meta/RegionMapScreen";
import { migrateSave } from "../../app/components/engine/save";
import { colonyReducer } from "../../app/components/colony/shared/colonyReducer";
import { Events } from "../../app/components/colony/shared/colonyEvents";
import { surveyRegionNode } from "../../app/components/colony/region/siteEconomy";
import { foundOutpost } from "../../app/components/colony/region/siteEconomy";

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
  assert.match(html, /role="listbox"/);
  assert.match(html, /aria-selected="true"/);
  assert.doesNotMatch(html, />SURVEY/);
  assert.doesNotMatch(html, />TRAVEL/);
  assert.doesNotMatch(html, /Found outpost at/);
  assert.match(html, /COCKPIT VIEW[^<]*—[^<]*REGION ACTIONS ARE UNAVAILABLE/);
});

test("node options contain no direct actions and one selected action renders outside the listbox", () => {
  const surveyed = surveyRegionNode(save(), "home", "ashfall-oathbreaker-wreck");
  assert.equal(surveyed.ok, true);
  if (!surveyed.ok) return;
  const html = renderToStaticMarkup(React.createElement(RegionMapScreen, {
    save: surveyed.save,
    originColonyId: "home",
    mode: "pad",
    initialSelectedNodeId: "ashfall-oathbreaker-wreck",
    onClose() {}, onSurvey() {}, onTravel() {}, onFound() {},
  }));
  const listbox = html.slice(html.indexOf('data-region-node-list="true"'), html.indexOf('data-region-detail-panel="true"'));
  assert.doesNotMatch(listbox, /SURVEY ·|TRAVEL ·|FOUND OUTPOST/);
  assert.equal((html.match(/data-region-action="true"/g) ?? []).length, 1);
  assert.match(html, /Oathbreaker Wreck/);
  assert.match(html, /BOARDING/);
  assert.match(html, /TRAVEL COST[\s\S]*?1 CYCLE/);
  assert.match(html, /Travel to Oathbreaker Wreck/);
});

test("selected rumored destination exposes one survey action outside the listbox", () => {
  const html = renderToStaticMarkup(React.createElement(RegionMapScreen, {
    save: save(), originColonyId: "home", mode: "pad",
    initialSelectedNodeId: "ashfall-cinder-relay", onClose() {}, onSurvey() {},
  }));
  const listbox = html.slice(html.indexOf('data-region-node-list="true"'), html.indexOf('data-region-detail-panel="true"'));
  assert.doesNotMatch(listbox, /SURVEY ·|TRAVEL ·|FOUND OUTPOST/);
  assert.equal((html.match(/data-region-action="true"/g) ?? []).length, 1);
  assert.match(html, /Survey Cinder Relay Ruins/);
  assert.match(html, /SURVEY · 1 CYCLE/);
});

test("selected origin and cockpit selections render zero actions with explicit unavailable copy", () => {
  const originHtml = renderToStaticMarkup(React.createElement(RegionMapScreen, {
    save: save(), originColonyId: "home", mode: "pad", onClose() {},
  }));
  assert.equal((originHtml.match(/data-region-action="true"/g) ?? []).length, 0);
  assert.match(originHtml, /ORIGIN NODE[^<]*—[^<]*NO ACTION AVAILABLE/);

  const surveyed = surveyRegionNode(save(), "home", "ashfall-cinder-relay");
  assert.equal(surveyed.ok, true);
  if (!surveyed.ok) return;
  const cockpitHtml = renderToStaticMarkup(React.createElement(RegionMapScreen, {
    save: surveyed.save,
    originColonyId: "home",
    mode: "view",
    initialSelectedNodeId: "ashfall-cinder-relay",
    onClose() {}, onTravel() {},
  }));
  assert.equal((cockpitHtml.match(/data-region-action="true"/g) ?? []).length, 0);
  assert.match(cockpitHtml, /COCKPIT VIEW[^<]*—[^<]*REGION ACTIONS ARE UNAVAILABLE/);
});

test("selected POIs disclose the correct encounter label only after intel permits it", () => {
  const cinder = surveyRegionNode(save(), "home", "ashfall-cinder-relay");
  assert.equal(cinder.ok, true);
  if (!cinder.ok) return;
  const cinderHtml = renderToStaticMarkup(React.createElement(RegionMapScreen, {
    save: cinder.save, originColonyId: "home", mode: "pad",
    initialSelectedNodeId: "ashfall-cinder-relay", onClose() {}, onTravel() {},
  }));
  assert.match(cinderHtml, /FIRST-PERSON/);

  const basalt = surveyRegionNode(cinder.save, "home", "ashfall-basalt-basin");
  assert.equal(basalt.ok, true);
  if (!basalt.ok) return;
  const founded = foundOutpost(basalt.save, "home", "ashfall-basalt-basin", "Basalt Basin");
  assert.equal(founded.ok, true);
  if (!founded.ok) return;
  const glassknife = surveyRegionNode(founded.save, founded.colonyId, "ashfall-glassknife-canyon");
  assert.equal(glassknife.ok, true);
  if (!glassknife.ok) return;
  const glassknifeHtml = renderToStaticMarkup(React.createElement(RegionMapScreen, {
    save: glassknife.save, originColonyId: founded.colonyId, mode: "pad",
    initialSelectedNodeId: "ashfall-glassknife-canyon", onClose() {}, onTravel() {},
  }));
  assert.match(glassknifeHtml, /GROUND-RUN/);
});

test("selected surveyed colony site exposes one founding action and its stats", () => {
  const surveyed = surveyRegionNode(save(), "home", "ashfall-basalt-basin");
  assert.equal(surveyed.ok, true);
  if (!surveyed.ok) return;
  const html = renderToStaticMarkup(React.createElement(RegionMapScreen, {
    save: surveyed.save, originColonyId: "home", mode: "pad",
    initialSelectedNodeId: "ashfall-basalt-basin", onClose() {}, onFound() {},
  }));
  assert.match(html, /ORE DENSITY/);
  assert.equal((html.match(/data-region-action="true"/g) ?? []).length, 1);
  assert.match(html, /Found outpost at Basalt Basin/);
  assert.match(html, /300 METAL/);
});

test("unknown selection reveals no real name, engine, template, stats, or action", () => {
  const html = renderToStaticMarkup(React.createElement(RegionMapScreen, {
    save: save(), originColonyId: "home", mode: "pad",
    initialSelectedNodeId: "ashfall-glassknife-canyon", onClose() {},
    onSurvey() {}, onTravel() {}, onFound() {},
  }));
  assert.match(html, /UNKNOWN SIGNAL/);
  assert.match(html, /INTEL INSUFFICIENT/);
  assert.doesNotMatch(html, /Glassknife Canyon|ground-canyon-glassknife|GROUND-RUN|ORE DENSITY|WATER TABLE|BUILDABLE SLOTS/);
  assert.equal((html.match(/data-region-action="true"/g) ?? []).length, 0);
});

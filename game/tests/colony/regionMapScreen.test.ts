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
  const html = renderToStaticMarkup(React.createElement(RegionMapScreen, { save: save(), originColonyId: "home", source: "cockpit", actionsEnabled: false, onClose() {} }));
  assert.match(html, /COCKPIT VIEW/);
  assert.match(html, /UNKNOWN SIGNAL/);
  assert.match(html, /role="listbox"/);
  assert.match(html, /aria-selected="true"/);
  assert.doesNotMatch(html, />SURVEY/);
  assert.doesNotMatch(html, />TRAVEL/);
  assert.doesNotMatch(html, /Found outpost at/);
  assert.match(html, /Descend to the landing pad to survey or travel\./);
});

test("node options contain no direct actions and one selected action renders outside the listbox", () => {
  const surveyed = surveyRegionNode(save(), "home", "ashfall-oathbreaker-wreck");
  assert.equal(surveyed.ok, true);
  if (!surveyed.ok) return;
  const html = renderToStaticMarkup(React.createElement(RegionMapScreen, {
    save: surveyed.save,
    originColonyId: "home",
    source: "landing-pad", actionsEnabled: true,
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
    save: save(), originColonyId: "home", source: "landing-pad", actionsEnabled: true,
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
    save: save(), originColonyId: "home", source: "landing-pad", actionsEnabled: true, onClose() {},
  }));
  assert.equal((originHtml.match(/data-region-action="true"/g) ?? []).length, 0);
  assert.match(originHtml, /Choose a destination to plan your next expedition\./);

  const surveyed = surveyRegionNode(save(), "home", "ashfall-cinder-relay");
  assert.equal(surveyed.ok, true);
  if (!surveyed.ok) return;
  const cockpitHtml = renderToStaticMarkup(React.createElement(RegionMapScreen, {
    save: surveyed.save,
    originColonyId: "home",
    source: "cockpit", actionsEnabled: false,
    initialSelectedNodeId: "ashfall-cinder-relay",
    onClose() {}, onTravel() {},
  }));
  assert.equal((cockpitHtml.match(/data-region-action="true"/g) ?? []).length, 0);
  assert.match(cockpitHtml, /Descend to the landing pad to survey or travel\./);
});

test("selected POIs disclose the correct encounter label only after intel permits it", () => {
  const cinder = surveyRegionNode(save(), "home", "ashfall-cinder-relay");
  assert.equal(cinder.ok, true);
  if (!cinder.ok) return;
  const cinderHtml = renderToStaticMarkup(React.createElement(RegionMapScreen, {
    save: cinder.save, originColonyId: "home", source: "landing-pad", actionsEnabled: true,
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
    save: glassknife.save, originColonyId: founded.colonyId, source: "landing-pad", actionsEnabled: true,
    initialSelectedNodeId: "ashfall-glassknife-canyon", onClose() {}, onTravel() {},
  }));
  assert.match(glassknifeHtml, /GROUND-RUN/);
});

test("selected surveyed colony site exposes one founding action and its stats", () => {
  const surveyed = surveyRegionNode(save(), "home", "ashfall-basalt-basin");
  assert.equal(surveyed.ok, true);
  if (!surveyed.ok) return;
  const html = renderToStaticMarkup(React.createElement(RegionMapScreen, {
    save: surveyed.save, originColonyId: "home", source: "landing-pad", actionsEnabled: true,
    initialSelectedNodeId: "ashfall-basalt-basin", onClose() {}, onFound() {},
  }));
  assert.match(html, /ORE DENSITY/);
  assert.equal((html.match(/data-region-action="true"/g) ?? []).length, 1);
  assert.match(html, /Found outpost at Basalt Basin/);
  assert.match(html, /300 METAL/);
});

test("unknown selection reveals no real name, engine, template, stats, or action", () => {
  const html = renderToStaticMarkup(React.createElement(RegionMapScreen, {
    save: save(), originColonyId: "home", source: "landing-pad", actionsEnabled: true,
    initialSelectedNodeId: "ashfall-glassknife-canyon", onClose() {},
    onSurvey() {}, onTravel() {}, onFound() {},
  }));
  assert.match(html, /UNKNOWN SIGNAL/);
  assert.match(html, /Explore connected sites to learn more about this signal\./);
  assert.doesNotMatch(html, /Glassknife Canyon|ground-canyon-glassknife|GROUND-RUN|ORE DENSITY|WATER TABLE|BUILDABLE SLOTS/);
  assert.equal((html.match(/data-region-action="true"/g) ?? []).length, 0);
});

test("Region source labels and return controls do not imply action permission", () => {
  for (const [source, provenance, back] of [
    ["atlas", "ATLAS LINK", "RETURN TO ATLAS"],
    ["landing-pad", "PAD LINK", "RETURN TO LANDING PAD"],
    ["cockpit", "COCKPIT VIEW", "RETURN TO COLONIES"],
  ] as const) {
    for (const actionsEnabled of [false, true]) {
      const html = renderToStaticMarkup(React.createElement(RegionMapScreen, {
        save: save(), originColonyId: "home", source, actionsEnabled,
        initialSelectedNodeId: "ashfall-cinder-relay", onClose() {}, onSurvey() {},
      }));
      assert.match(html, new RegExp(provenance));
      assert.match(html, new RegExp(back));
      assert.equal((html.match(/data-region-action="true"/g) ?? []).length, actionsEnabled ? 1 : 0);
      if (!actionsEnabled) assert.match(html, /View only/);
      if (source !== "cockpit") assert.doesNotMatch(html, /COCKPIT VIEW/);
      if (source !== "landing-pad") assert.doesNotMatch(html, /PAD LINK/);
    }
  }
});

test("landmarks and route endpoints use the same saved coordinate space", () => {
  const state = save();
  const html = renderToStaticMarkup(React.createElement(RegionMapScreen, {
    save: state, originColonyId: "home", source: "landing-pad", actionsEnabled: true,
    initialSelectedNodeId: "ashfall-cinder-relay", onClose() {}, onSurvey() {},
  }));
  const map = state.planets.find(planet => planet.id === "ashfall")!.regionMap;
  for (const node of map.nodes) {
    const label = node.intel === "unknown" ? "UNKNOWN SIGNAL" : node.name;
    const options = html.match(/<[^>]+role="option"[^>]*>/g) ?? [];
    assert.ok(options.some(option => option.includes(`aria-label="${label}, ${node.intel}"`)
      && option.includes(`left:${node.coords.x}%`) && option.includes(`top:${node.coords.y}%`)), label);
  }
  const origin = map.nodes.find(node => node.id === "ashfall-forward-camp")!;
  const selected = map.nodes.find(node => node.id === "ashfall-cinder-relay")!;
  assert.match(html, new RegExp(`x1="${origin.coords.x}" y1="${origin.coords.y}" x2="${selected.coords.x}" y2="${selected.coords.y}"[^>]*data-route-state="selected"`));
  assert.equal((html.match(/data-region-origin="true"/g) ?? []).length, 1);
  assert.match(html, /EXPEDITION ORIGIN/);
});

test("unknown landmarks and routes reveal no hidden identity or destination type", () => {
  const state = save();
  const map = state.planets.find(planet => planet.id === "ashfall")!.regionMap;
  // A latent contact not connected to known space must not be rendered at all.
  map.nodes.push({ ...map.nodes[3], id: "hidden-node", name: "Hidden Fortress", coords: { x: 6, y: 8 } });
  map.edges.push(["ashfall-glassknife-canyon", "hidden-node"]);
  const html = renderToStaticMarkup(React.createElement(RegionMapScreen, {
    save: state, originColonyId: "home", source: "landing-pad", actionsEnabled: true,
    initialSelectedNodeId: "ashfall-glassknife-canyon", onClose() {},
  }));
  assert.doesNotMatch(html, /Hidden Fortress|hidden-node|glassknife|ironreach|GROUND-RUN/);
  assert.equal((html.match(/data-landmark="unknown"/g) ?? []).length, 2);
  assert.doesNotMatch(html, /data-route-state="selected"/);
  assert.match(html, /data-route-state="unknown"/);
});

test("site statistics and named connections are optional while the founding cost stays visible", () => {
  const surveyed = surveyRegionNode(save(), "home", "ashfall-basalt-basin");
  assert.ok(surveyed.ok);
  if (!surveyed.ok) return;
  const html = renderToStaticMarkup(React.createElement(RegionMapScreen, {
    save: surveyed.save, originColonyId: "home", source: "landing-pad", actionsEnabled: true,
    initialSelectedNodeId: "ashfall-basalt-basin", onClose() {}, onFound() {},
  }));
  assert.match(html, /<details[^>]*><summary[^>]*>SITE INTEL<\/summary>[\s\S]*ORE DENSITY/);
  assert.doesNotMatch(html, /<details[^>]*open/);
  assert.match(html, /FOUND OUTPOST · 300 METAL · 50 FOOD · 50 WATER/);
  assert.doesNotMatch(html.slice(0, html.indexOf('data-region-detail-panel="true"')), /Connections:/);
});

test("an eligible action without a connected callback is visibly disabled", () => {
  const html = renderToStaticMarkup(React.createElement(RegionMapScreen, {
    save: save(), originColonyId: "home", source: "landing-pad", actionsEnabled: true,
    initialSelectedNodeId: "ashfall-cinder-relay", onClose() {},
  }));
  assert.match(html, /<button[^>]*data-region-action="true"[^>]*disabled=""/);
});

test("rumored colony sites do not disclose statistics inside collapsed site intel", () => {
  const html = renderToStaticMarkup(React.createElement(RegionMapScreen, {
    save: save(), originColonyId: "home", source: "landing-pad", actionsEnabled: true,
    initialSelectedNodeId: "ashfall-basalt-basin", onClose() {}, onSurvey() {},
  }));
  assert.doesNotMatch(html, /ORE DENSITY|WATER TABLE|BUILDABLE SLOTS/);
});

test("a founded outpost becomes the route origin without moving saved landmarks", () => {
  const surveyed = surveyRegionNode(save(), "home", "ashfall-basalt-basin");
  assert.ok(surveyed.ok);
  if (!surveyed.ok) return;
  const founded = foundOutpost(surveyed.save, "home", "ashfall-basalt-basin", "Basin Camp");
  assert.ok(founded.ok);
  if (!founded.ok) return;
  const html = renderToStaticMarkup(React.createElement(RegionMapScreen, {
    save: founded.save, originColonyId: founded.colonyId, source: "landing-pad", actionsEnabled: true,
    initialSelectedNodeId: "ashfall-glassknife-canyon", onClose() {}, onSurvey() {},
  }));
  const origin = (html.match(/<[^>]+role="option"[^>]*>/g) ?? []).find(option => option.includes('data-region-origin="true"'));
  assert.ok(origin?.includes('aria-label="Basalt Basin, claimed"'));
  const lines = html.match(/<line[^>]*data-route-state="selected"[^>]*>/g) ?? [];
  assert.equal(lines.length, 1);
  const nodes = founded.save.planets.find(planet => planet.id === "ashfall")!.regionMap.nodes;
  const basin = nodes.find(node => node.id === "ashfall-basalt-basin")!;
  assert.match(lines[0], new RegExp(`x1="${basin.coords.x}" y1="${basin.coords.y}"`));
});

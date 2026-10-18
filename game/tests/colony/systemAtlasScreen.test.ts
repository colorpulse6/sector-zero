import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SystemAtlasScreen } from "../../app/components/galaxy/system/SystemAtlasScreen";
import { STAR_SYSTEMS, homeSystem, neighboursOf, planetName } from "../../app/components/galaxy/system/starSystems";
import { migrateSave } from "../../app/components/engine/save";
import { colonyReducer } from "../../app/components/colony/shared/colonyReducer";
import { Events } from "../../app/components/colony/shared/colonyEvents";

function save() {
  const fresh = migrateSave({});
  return colonyReducer(fresh, Events.founded({ colonyId: "home", name: "Home", planetId: "ashfall", foundingType: "outpost", regionNodeId: "ashfall-forward-camp", missionCount: 0, layoutSeed: 1 }));
}

function render(props: Partial<React.ComponentProps<typeof SystemAtlasScreen>> = {}) {
  return renderToStaticMarkup(React.createElement(SystemAtlasScreen, { save: save(), onClose() {}, ...props }));
}

test("system atlas renders without a DOM: one option per planet and neighbour, flat plan positions", () => {
  const html = render();
  const home = homeSystem();
  const options = html.match(/<[^>]+role="option"[^>]*>/g) ?? [];
  assert.equal(options.length, home.planets.length + neighboursOf(home.id).length);
  assert.match(html, /role="listbox"/);
  assert.match(html, /data-system-node-list="true"/);
  assert.match(html, /aria-label="Ashfall, planet"/);
  assert.equal((html.match(/aria-selected="true"/g) ?? []).length, 1);
  for (const option of options) assert.match(option, /left:\d+(\.\d+)?%;top:\d+(\.\d+)?%/);
  assert.match(html, /role="dialog"[^>]*aria-label="System map"|aria-label="System map"[^>]*role="dialog"/);
  assert.match(html, /← RETURN TO COLONIES/);
  assert.match(html, /SYSTEM ATLAS/);
});

test("signal-only systems leak no name, star class or planet count", () => {
  const html = render();
  const signal = STAR_SYSTEMS.find(system => system.knowledge === "signal")!;
  assert.doesNotMatch(html, new RegExp(signal.name));
  assert.doesNotMatch(html, new RegExp(signal.id.replace(/[-:]/g, "\\$&")));
  assert.match(html, /UNKNOWN SYSTEM, system/);
  const unknownSelected = render({ initialSelectedId: signal.id });
  assert.doesNotMatch(unknownSelected, new RegExp(signal.name));
  assert.doesNotMatch(unknownSelected, /STAR CLASS|KNOWN PLANETS/);
  assert.equal((unknownSelected.match(/data-system-action="true"/g) ?? []).length, 0);
  assert.match(unknownSelected, /Signal only/);
});

test("a planet with a colony exposes exactly one region action; one without exposes none", () => {
  const withColony = render({ initialSelectedId: "planet:ashfall", onOpenRegion() {} });
  assert.equal((withColony.match(/data-system-action="true"/g) ?? []).length, 1);
  assert.match(withColony, /Open region chart for Ashfall/);
  assert.match(withColony, /REGION INTEL/);
  const noCallback = render({ initialSelectedId: "planet:ashfall" });
  assert.match(noCallback, /<button[^>]*data-system-action="true"[^>]*disabled=""/);
  const noColony = render({ initialSelectedId: "planet:ossuary", onOpenRegion() {} });
  assert.equal((noColony.match(/data-system-action="true"/g) ?? []).length, 0);
  assert.match(noColony, /Landing authority needed/);
});

test("a charted neighbour exposes exactly one view action with its distance", () => {
  const neighbour = neighboursOf(homeSystem().id).find(entry => entry.system.knowledge === "charted")!;
  const html = render({ initialSelectedId: neighbour.system.id });
  assert.equal((html.match(/data-system-action="true"/g) ?? []).length, 1);
  assert.match(html, new RegExp(`View ${neighbour.system.name}`));
  assert.match(html, new RegExp(`VIEW SYSTEM · ${neighbour.distanceUnits} UNITS`));
  const listbox = html.slice(html.indexOf('data-system-node-list="true"'), html.indexOf('data-system-detail-panel="true"'));
  assert.doesNotMatch(listbox, /VIEW SYSTEM|OPEN REGION/);
});

test("a different initial system renders its own planets and neighbours", () => {
  const other = STAR_SYSTEMS.find(system => system.knowledge === "charted")!;
  const html = render({ initialSystemId: other.id });
  assert.match(html, new RegExp(`<h1[^>]*>${other.name}</h1>`));
  for (const planet of other.planets) assert.match(html, new RegExp(`aria-label="${planetName(planet.planetId)}, planet"`));
  assert.doesNotMatch(html, /aria-label="Ashfall, planet"/);
  assert.match(html, /Ashfall Reach, system/);
});

test("opening on a signal system hides its worlds, biomes and any region action", () => {
  const signal = STAR_SYSTEMS.find(system => system.knowledge === "signal")!;
  const html = render({ initialSystemId: signal.id });
  assert.match(html, /<h1[^>]*>UNKNOWN SYSTEM<\/h1>/);
  for (const planet of signal.planets) {
    assert.doesNotMatch(html, new RegExp(planetName(planet.planetId)));
    assert.doesNotMatch(html, new RegExp(planet.planetId, "i"));
  }
  assert.doesNotMatch(html, /BASIN|SHELF|PLAIN|CRUST|ARCHIPELAGO|CANOPY|SPRAWL|WASTE/);
  assert.match(html, /UNKNOWN WORLD, planet/);
  assert.doesNotMatch(html, /OPEN REGION CHART|Open region chart/);
  assert.match(html, /Signal only\. Chart it from the Galaxy Atlas\./);
});

test("the screen module imports nothing from @babylonjs at load time", async () => {
  const before = Object.keys(require.cache ?? {}).filter(key => key.includes("@babylonjs")).length;
  await import("../../app/components/galaxy/system/SystemScene");
  const after = Object.keys(require.cache ?? {}).filter(key => key.includes("@babylonjs")).length;
  assert.equal(after, before);
});

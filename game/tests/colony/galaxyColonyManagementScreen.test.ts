import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GalaxyColonyManagementScreen } from "../../app/components/colony/meta/GalaxyColonyManagementScreen";
import { ColonyCommissionMenu } from "../../app/components/colony/meta/ColonyCommissionMenu";
import { makeBuilding, makeTestColony } from "./fixtures";

test("galaxy management shows only supported options, the status line and BACK", () => {
  const colony = makeTestColony({ resources: { food: 0, water: 0, metal: 80, credits: 0 } });
  const html = renderToStaticMarkup(React.createElement(GalaxyColonyManagementScreen, {
    colony, worldCycle: 4, supportedTypes: ["solar_array"], status: "SOLAR ARRAY COMMISSIONED · READY IN 1 CYCLE",
    onCommission: () => {}, onExit: () => {},
  }));
  assert.match(html, /aria-label="Colony management"/);
  assert.match(html, /☀ Solar Array/);
  assert.doesNotMatch(html, /⛏ Mine|🍺 Cantina|🌾 Farm|💧 Water Purifier|🏠 Habitat Module/);
  assert.match(html, /role="status"[^>]*>SOLAR ARRAY COMMISSIONED · READY IN 1 CYCLE</);
  assert.match(html, /← BACK/);
  assert.doesNotMatch(html, /RETURN TO COCKPIT|REGION — VIEW ONLY|SYSTEM MAP/);
});

test("legacy commission menu still offers every Phase-1 option", () => {
  const colony = makeTestColony({ resources: { food: 0, water: 0, metal: 500, credits: 0 } });
  const html = renderToStaticMarkup(React.createElement(ColonyCommissionMenu, { colony, onDispatch: () => {} }));
  for (const label of ["Solar Array", "Farm", "Water Purifier", "Habitat Module", "Mine", "Cantina"]) {
    assert.match(html, new RegExp(label));
  }
});

const SETTLEMENT_TYPES = ["solar_array", "mine", "habitat_module", "farm", "water_purifier"] as const;

function renderScreen(colony: ReturnType<typeof makeTestColony>): string {
  return renderToStaticMarkup(React.createElement(GalaxyColonyManagementScreen, {
    colony, worldCycle: 4, supportedTypes: SETTLEMENT_TYPES, status: null, onCommission: () => {}, onExit: () => {},
  }));
}

test("galaxy management lists the settlement path in order and names why a choice is blocked", () => {
  const colony = makeTestColony({
    resources: { food: 0, water: 0, metal: 160, credits: 0 },
    buildings: [makeBuilding("solar_array", { status: "constructing", buildProgressCycles: 1 })],
  });
  const html = renderScreen(colony);
  const order = ["☀ Solar Array", "⛏ Mine", "🏠 Habitat Module", "🌾 Farm", "💧 Water Purifier"].map(label => html.indexOf(label));
  assert.ok(order.every(index => index >= 0), "all five options render");
  assert.deepEqual([...order].sort((a, b) => a - b), order, "path order: power, mine, housing, food, water");
  assert.equal(html.match(/>Build</g)?.length, 1, "only the mine is buildable");
  assert.equal(html.match(/MINE FIRST · KEEP 150 METAL AND 1 SLOT FOR IT/g)?.length, 4);
  assert.match(html, /POWER PLAN<\/span><span[^>]*>10 \/ 0 · 10 SPARE/);
  assert.match(html, /BUILD SLOTS<\/span><span[^>]*>1 \/ 6 USED/);
  assert.doesNotMatch(html, /🍺 Cantina/);
});

test("an unpowered colony's consumers name the solar array instead of a metal shortfall", () => {
  const html = renderScreen(makeTestColony({ resources: { food: 0, water: 0, metal: 0, credits: 0 } }));
  assert.match(html, /Need 80 more metal/);
  assert.equal(html.match(/BUILD A SOLAR ARRAY/g)?.length, 4);
});

test("the settlers panel shows housing, happiness, its factors, the next cycle and the time rule", () => {
  const colony = makeTestColony({
    happiness: 55,
    population: { total: 0, capacity: 10, namedCount: 0, growthRate: 0, recentDeaths: [] },
    buildings: [makeBuilding("solar_array"), makeBuilding("habitat_module")],
  });
  const html = renderScreen(colony);
  assert.match(html, /HOUSING<\/span><span[^>]*>0 \/ 10 · 10 FREE/);
  assert.match(html, /HAPPINESS 55 · SETTLERS NEED OVER 60/);
  assert.match(html, /✗ FOOD STOCK OVER 2× SETTLERS \+15/);
  assert.match(html, /✗ WATER STOCK OVER SETTLERS \+10/);
  assert.match(html, /✓ POWERED GRID \+5/);
  assert.doesNotMatch(html, /MED BAY|MARKETPLACE|BARRACKS/, "no bonus from a building this run cannot build");
  assert.match(html, /SETTLERS ARRIVE ONE PER CYCLE WHILE HAPPINESS IS OVER 60 AND HOUSING IS FREE/);
  assert.match(html, /TIME PASSES WITH SURVEYS, EXPEDITIONS, TRAVEL AND OPERATIONS/);
  assert.match(html, /FINISHED BUILDINGS APPEAR IN THE WALK ON YOUR NEXT DESCENT/);
});

test("a happy colony with free housing forecasts a settler", () => {
  const colony = makeTestColony({
    happiness: 80,
    population: { total: 3, capacity: 10, namedCount: 0, growthRate: 0, recentDeaths: [] },
    resources: { food: 30, water: 20, metal: 0, credits: 0 },
    buildings: SETTLEMENT_TYPES.map(type => makeBuilding(type)),
  });
  assert.match(renderScreen(colony), /NEXT CYCLE<\/span><span[^>]*>\+1 SETTLER/);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GalaxyColonyManagementScreen } from "../../app/components/colony/meta/GalaxyColonyManagementScreen";
import { ColonyCommissionMenu } from "../../app/components/colony/meta/ColonyCommissionMenu";
import { makeTestColony } from "./fixtures";

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

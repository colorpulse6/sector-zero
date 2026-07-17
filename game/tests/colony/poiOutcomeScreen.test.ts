import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PoiOutcomeScreen } from "../../app/components/colony/meta/PoiOutcomeScreen";
import { makeTestColony, makeTestSave } from "./fixtures";

test("outcome screen offers destination cargo and save retry copy", () => {
  const colony = makeTestColony({ id: "home", name: "Home" });
  const base = makeTestSave({ colonies: [colony] });
  const pending = { originColonyId: "home", nodeId: "ruin", baseSave: base, projectedSave: base, outcome: { originColonyId: "home", nodeId: "ruin", payload: { metal: 80 } } };
  const html = renderToStaticMarkup(React.createElement(PoiOutcomeScreen, { pending, colonies: [colony], resolving: false, error: "SAVE FAILED — RETRY DELIVERY", onConfirm() {}, onHub() {} }));
  assert.match(html, /\+80 METAL/);
  assert.match(html, /Home/);
  assert.match(html, /SAVE FAILED/);
  assert.match(html, /CONFIRM DELIVERY/);
});

test("replay outcome promises no duplicate cargo", () => {
  const colony = makeTestColony({ id: "home" });
  const base = makeTestSave({ colonies: [colony] });
  const pending = { originColonyId: "home", nodeId: "ruin", baseSave: base, projectedSave: base, outcome: null };
  const html = renderToStaticMarkup(React.createElement(PoiOutcomeScreen, { pending, colonies: [colony], resolving: false, error: null, onConfirm() {}, onHub() {} }));
  assert.match(html, /ALREADY RECOVERED/);
});

test("a locked delivery retry cannot expose a hub escape", () => {
  const colony = makeTestColony({ id: "home", name: "Home" });
  const base = makeTestSave({ colonies: [colony] });
  const pending = { originColonyId: "home", nodeId: "ruin", baseSave: base, projectedSave: base, outcome: { originColonyId: "home", nodeId: "ruin", payload: { metal: 80 } } };
  const html = renderToStaticMarkup(React.createElement(PoiOutcomeScreen, {
    pending,
    colonies: [colony],
    resolving: false,
    error: "SAVE FAILED — RETRY DELIVERY",
    onConfirm() {},
  }));

  assert.match(html, /CONFIRM DELIVERY/);
  assert.doesNotMatch(html, /RETURN TO HUB/);
});

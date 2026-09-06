import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LandingPadExitMenu } from "../../app/components/colony/exploration/exitMenu";

test("landing pad presents a named modal and a Resume action", () => {
  const html = renderToStaticMarkup(React.createElement(LandingPadExitMenu, {
    onTakeOff() {}, onStay() {}, onRegionMap() {},
  }));
  assert.match(html, /role="dialog"[^>]*aria-modal="true"[^>]*aria-label="Landing pad exit menu"/);
  assert.match(html, />Resume<\/button>/);
  assert.doesNotMatch(html, />Stay<\/button>/);
});

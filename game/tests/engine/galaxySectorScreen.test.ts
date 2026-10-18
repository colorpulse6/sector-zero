import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createFreshGalaxyRun } from "../../app/components/engine/galaxy/galaxyRun";
import { migrateSave } from "../../app/components/engine/save";
import { applyGalaxyFixture, findGalaxyFixture } from "../../app/components/galaxy/devFixtures";
import { GalaxyAtlasScreen } from "../../app/components/galaxy/GalaxyAtlasScreen";

function render(run = createFreshGalaxyRun()) {
  return renderToStaticMarkup(React.createElement(GalaxyAtlasScreen, { run, onClose() {} }));
}

test("the sector field renders a landmark per known contact over an aria-hidden canvas and a plan fallback", () => {
  const html = render();
  assert.match(html, /data-sector-field="true"/);
  assert.match(html, /data-atlas-level="sector"/);
  assert.match(html, /<canvas[^>]*aria-hidden="true"/);
  assert.match(html, /class="sz-atlas-plan"/);
  const landmarks = html.match(/data-sector-landmark="[^"]+"/g) ?? [];
  assert.equal(landmarks.length, 5);
  assert.match(html, /data-sector-landmark="contact:vanguard"[^>]*data-vessel="true"|data-vessel="true"[^>]*data-sector-landmark="contact:vanguard"/);
  assert.match(html, /data-sector-landmark="contact:ashfall"[^>]*data-colony="true"|data-colony="true"[^>]*data-sector-landmark="contact:ashfall"/);
  assert.match(html, /data-knowledge="signal"/);
  // The CONTACTS listbox is the accessible equivalent; the landmark layer stays out of the tree.
  assert.match(html, /class="sz-atlas-landmarks"[^>]*aria-hidden="true"|aria-hidden="true"[^>]*class="sz-atlas-landmarks"/);
});

test("the default selection draws a planned route with a threat band on the field", () => {
  const html = render();
  assert.match(html, /data-route-state="planned"/);
  assert.match(html, /data-route-band="(low|moderate|high|severe|unknown)"/);
});

test("a signal contact leaks no star class, world or coordinates beyond its contact line", () => {
  const html = render();
  const start = html.indexOf('data-sector-landmark="coordinate:');
  assert.ok(start >= 0, "signal landmark missing");
  const landmark = html.slice(start, html.indexOf("</div>", start));
  assert.match(landmark, /UNRESOLVED SIGNAL/);
  assert.doesNotMatch(landmark, /-CLASS|WORLDS|COLONY/);
});

test("the dense sector fixture renders every charted procedural contact as both landmark and option", () => {
  const fixture = findGalaxyFixture("dense-sector");
  assert.ok(fixture);
  const run = applyGalaxyFixture(migrateSave({}), fixture).galaxyRun;
  assert.ok(run);
  const html = render(run);
  const landmarks = (html.match(/data-sector-landmark="[^"]+"/g) ?? []).length;
  const options = (html.match(/data-atlas-contact="[^"]+"/g) ?? []).length;
  assert.ok(landmarks >= 20, `landmarks ${landmarks}`);
  assert.equal(landmarks, options);
  // The CONTACTS list uses the same designation as the field, never the raw identity key.
  assert.doesNotMatch(html, /PROCEDURAL|SECTOR ZERO G0/);
  assert.match(html, /CONTACT \d\d-\d\d/);
  assert.equal((html.match(/<button[^>]*role="option"[^>]*tabindex="0"/g) ?? []).length, 1);
});

test("the sector scene module loads nothing from @babylonjs until a scene is created", async () => {
  const before = Object.keys(require.cache ?? {}).filter(key => key.includes("@babylonjs")).length;
  await import("../../app/components/galaxy/sector/SectorScene");
  const after = Object.keys(require.cache ?? {}).filter(key => key.includes("@babylonjs")).length;
  assert.equal(after, before);
});

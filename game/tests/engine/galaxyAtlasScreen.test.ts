import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { coord } from "../../app/components/engine/galaxy/coordinates";
import { createFreshGalaxyRun } from "../../app/components/engine/galaxy/galaxyRun";
import { planRoute } from "../../app/components/engine/galaxy/routePlanner";
import {
  commitTravel,
  resumeTravelToBoundary,
} from "../../app/components/engine/galaxy/travelResolver";
import {
  GalaxyAtlasScreen,
  GalaxyExperienceGate,
} from "../../app/components/galaxy";
import {
  atlasCanvasHitRadius,
  atlasSelectionForRun,
  restoreAtlasFocus,
  shouldHandleAtlasPointer,
} from "../../app/components/galaxy/GalaxyAtlasScreen";

function screen(
  overrides: Partial<React.ComponentProps<typeof GalaxyAtlasScreen>> = {},
): string {
  return renderToStaticMarkup(
    React.createElement(GalaxyAtlasScreen, {
      run: createFreshGalaxyRun(),
      onClose() {},
      onCommitTravel() {},
      onLaunchOperation() {},
      onRetreat() {},
      onEmergencyRetreat() {},
      onOpenAshfallRegion() {},
      ...overrides,
    }),
  );
}

function interruptedRun() {
  const run = createFreshGalaxyRun();
  const preview = planRoute(run, {
    kind: "contact",
    contactId: "contact:hostile-picket",
  });
  assert.equal(preview.ok, true);
  if (!preview.ok) throw new Error("Expected hostile route preview");
  const committed = commitTravel(run, preview.plan);
  assert.equal(committed.ok, true);
  if (!committed.ok) throw new Error("Expected hostile route commitment");
  const interrupted = resumeTravelToBoundary(committed.galaxyRun);
  assert.equal(interrupted.ok, true);
  if (!interrupted.ok) throw new Error("Expected hostile interruption");
  assert.equal(interrupted.galaxyRun.activeTravel?.state, "interrupted");
  return interrupted.galaxyRun;
}

test("Atlas has a DOM-complete travel path", () => {
  const html = screen({
    initialTarget: { kind: "contact", contactId: "contact:ashfall" },
  });

  assert.match(html, /role="listbox"/);
  assert.match(html, /ASHFALL/);
  assert.match(html, /DISTANCE[\s\S]*CYCLES[\s\S]*SUPPLY/);
  for (const label of [
    "MILITARY",
    "POLITICAL",
    "ENVIRONMENTAL",
    "LOGISTICAL",
    "ANOMALOUS",
  ]) {
    assert.match(html, new RegExp(label));
  }
  assert.match(html, /PLOT COORDINATE/);
  assert.match(html, /COMMIT TRAVEL/);
  assert.doesNotMatch(html, /W1|WORLD 1|NEXT LEVEL/);
});

test("every visible Atlas contact has a button equivalent outside Canvas", () => {
  const html = screen();
  const buttons = html.match(/<button[^>]*data-atlas-contact=/g) ?? [];
  assert.equal(buttons.length, 5);
  assert.match(html, /<canvas[^>]*aria-hidden="true"/);
  assert.match(html, /VANGUARD/);
  assert.match(html, /HOSTILE PICKET/);
  assert.match(html, /KEPLER/);
  assert.match(html, /UNRESOLVED SIGNAL/);
});

test("experience gate exposes focusable galaxy and legacy entry choices", () => {
  const begin = renderToStaticMarkup(
    React.createElement(GalaxyExperienceGate, {
      hasGalaxyRun: false,
      onGalaxy() {},
      onLegacy() {},
    }),
  );
  assert.match(begin, /<button[^>]*>BEGIN GALAXY<\/button>/);
  assert.match(begin, /<button[^>]*>LEGACY CAMPAIGN<\/button>/);
  assert.doesNotMatch(begin, /disabled/);

  const resume = renderToStaticMarkup(
    React.createElement(GalaxyExperienceGate, {
      hasGalaxyRun: true,
      onGalaxy() {},
      onLegacy() {},
    }),
  );
  assert.match(resume, /CONTINUE GALAXY/);
});

test("insufficient supply names the block and disables commitment", () => {
  const run = createFreshGalaxyRun();
  run.resources.supply = 1;
  const html = screen({
    run,
    initialTarget: { kind: "contact", contactId: "contact:ashfall" },
  });

  assert.match(html, /Route requires 2 supply; only 1 is available\./);
  assert.match(html, /<button[^>]*disabled=""[^>]*>COMMIT TRAVEL<\/button>/);
});

test("blind coordinate preview discloses low confidence and unknown contributors", () => {
  const html = screen({
    initialTarget: {
      kind: "coordinate",
      coordinate: coord(0, 0, 1792, 1792),
    },
  });

  assert.match(html, /BLIND COORDINATE/);
  assert.match(html, /UNCERTAIN — INCOMPLETE THREAT DATA/);
  assert.match(html, /CONFIDENCE[\s\S]*LOW/);
  assert.match(html, /UNKNOWN CONTRIBUTORS/);
});

test("interrupted travel exposes launch and retreat without a new commitment", () => {
  const run = interruptedRun();
  const requested = { kind: "contact", contactId: "contact:ashfall" } as const;
  const html = screen({
    run,
    initialTarget: requested,
  });

  assert.match(html, /TRAVEL INTERRUPTED/);
  assert.match(html, /LAUNCH INTERCEPTION/);
  assert.match(html, /RETREAT TO ORIGIN/);
  assert.match(html, /data-selected-target="contact:hostile-picket"/);
  assert.match(html, /SELECTED TARGET[\s\S]*HOSTILE PICKET/);
  assert.doesNotMatch(html, /data-selected-target="contact:ashfall"/);
  assert.doesNotMatch(html, />COMMIT TRAVEL<\/button>/);

  assert.deepEqual(atlasSelectionForRun(run, requested), {
    kind: "contact",
    contactId: "contact:hostile-picket",
  });
  const blindTravel = structuredClone(run);
  blindTravel.activeTravel!.targetId = null;
  assert.deepEqual(atlasSelectionForRun(blindTravel, requested), {
    kind: "coordinate",
    coordinate: blindTravel.activeTravel!.destination,
  });
});

test("visited contactless facts remain coordinate targets in DOM and selection state", () => {
  const run = createFreshGalaxyRun();
  const signal = Object.values(run.atlas.materializedFacts).find(
    (fact) => fact.id === "signal:unresolved-g0",
  );
  assert.ok(signal);
  assert.equal(signal.contactId, null);
  run.atlas.knowledge["knowledge:unresolved-signal"].state = "visited";

  const html = screen({
    run,
    initialTarget: { kind: "coordinate", coordinate: signal.coordinate },
  });

  assert.match(
    html,
    /data-atlas-contact="coordinate:0:0:2816:1792"[^>]*data-target-kind="coordinate"[^>]*data-selected-target="coordinate:0:0:2816:1792"/,
  );
  assert.doesNotMatch(html, /data-atlas-contact="signal:unresolved-g0"/);
  assert.match(html, /BLIND COORDINATE/);
});

test("unsupported generation keeps the save visible with recoverable copy", () => {
  const run = createFreshGalaxyRun();
  run.identity.generationVersion = 99;
  const html = screen({ run });

  assert.match(html, /GENERATION VERSION 99 IS UNAVAILABLE/);
  assert.match(html, /RECOVERABLE/);
  assert.match(html, /KEEP THIS SAVE/);
  assert.doesNotMatch(html, /COMMIT TRAVEL/);
});

test("no-run state is safe and returns to the experience selector", () => {
  const html = screen({ run: null });

  assert.match(html, /NO GALAXY RUN IS ACTIVE/);
  assert.match(html, /RETURN TO EXPERIENCE SELECTOR/);
  assert.doesNotMatch(html, /<canvas/);
});

test("Atlas exposes semantic levels, equivalent controls, and one selected target", () => {
  const html = screen({
    initialTarget: { kind: "contact", contactId: "contact:ashfall" },
  });

  assert.match(html, /GALAXY[\s\S]*SECTOR[\s\S]*SYSTEM[\s\S]*REGION/);
  for (const label of ["PAN LEFT", "PAN RIGHT", "PAN UP", "PAN DOWN", "ZOOM IN", "ZOOM OUT"]) {
    assert.match(html, new RegExp(`aria-label="${label}"`));
  }
  for (const name of ["sectorX", "sectorY", "localX", "localY"]) {
    assert.match(html, new RegExp(`<input[^>]*type="number"[^>]*name="${name}"`));
  }
  assert.match(html, /role="status"[^>]*aria-live="polite"/);
  assert.ok((html.match(/data-selected-target="contact:ashfall"/g) ?? []).length >= 3);
});

test("480px Atlas layout stacks its main panels and wraps coordinate controls", () => {
  const html = screen();

  assert.match(
    html,
    /data-atlas-layout="responsive"[^>]*style="[^"]*grid-template-columns:repeat\(auto-fit, minmax\(min\(100%, 360px\), 1fr\)\)/,
  );
  assert.match(
    html,
    /data-coordinate-layout="wrapping"[^>]*style="[^"]*grid-template-columns:repeat\(auto-fit, minmax\(min\(100%, 110px\), 1fr\)\)/,
  );
  assert.match(html, /<header style="[^"]*flex-wrap:wrap/);
});

test("Canvas hit testing preserves a twenty CSS pixel radius when scaled", () => {
  assert.equal(atlasCanvasHitRadius(960), 20);
  assert.equal(atlasCanvasHitRadius(480), 40);
  assert.equal(atlasCanvasHitRadius(320), 60);
  assert.equal(atlasCanvasHitRadius(480) * (480 / 960), 20);
});

test("touch input is owned only by the touch gesture stream", () => {
  assert.equal(shouldHandleAtlasPointer("touch"), false);
  assert.equal(shouldHandleAtlasPointer("mouse"), true);
  assert.equal(shouldHandleAtlasPointer("pen"), true);
  assert.equal(shouldHandleAtlasPointer(""), true);
});

test("parent-controlled focus restoration outranks the connected-element fallback", () => {
  const calls: string[] = [];
  const fallback = {
    isConnected: true,
    focus() { calls.push("fallback"); },
  } as HTMLElement;

  restoreAtlasFocus(() => { calls.push("parent"); }, fallback);
  assert.deepEqual(calls, ["parent"]);

  restoreAtlasFocus(undefined, fallback);
  assert.deepEqual(calls, ["parent", "fallback"]);

  restoreAtlasFocus(undefined, { ...fallback, isConnected: false });
  assert.deepEqual(calls, ["parent", "fallback"]);
});

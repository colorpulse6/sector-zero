import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RegionMapScreen } from "../../app/components/colony/meta/RegionMapScreen";
import { createPoiGameState } from "../../app/components/colony/region/poiRuntime";
import { POI_CARGO } from "../../app/components/colony/region/poiOutcomes";
import { OUTPOST_FOUNDING_COST } from "../../app/components/colony/region/siteEconomy";
import { Events } from "../../app/components/colony/shared/colonyEvents";
import { colonyReducer } from "../../app/components/colony/shared/colonyReducer";
import { missionDeliveryEvent } from "../../app/components/colony/shared/missionDelivery";
import { updateBoardingEngine } from "../../app/components/engine/boardingEngine";
import { updateFirstPerson } from "../../app/components/engine/firstPersonEngine";
import { updateGroundEngine } from "../../app/components/engine/groundEngine";
import {
  createFreshGalaxyRun,
  startFreshGalaxy,
} from "../../app/components/engine/galaxy/galaxyRun";
import { stableHash } from "../../app/components/engine/galaxy/coordinates";
import type { GalaxyRunState } from "../../app/components/engine/galaxy/galaxyTypes";
import { planRoute } from "../../app/components/engine/galaxy/routePlanner";
import {
  commitTravel,
  finalizeTravel,
  resumeTravelToBoundary,
} from "../../app/components/engine/galaxy/travelResolver";
import {
  foundGalaxyOutpost,
  openGalaxyRegion,
  prepareGalaxyPoiCompletion,
  recoverGalaxyPoiCompletion,
  resolveGalaxyPoiCompletion,
  startGalaxyRegionExpedition,
} from "../../app/components/engine/operations/operationAdapters";
import { migrateSave } from "../../app/components/engine/save";
import { GameScreen, type Keys, type SaveData } from "../../app/components/engine/types";

function requireTravel<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  assert.equal(result.ok, true, "errors" in result ? JSON.stringify(result.errors) : undefined);
  if (!result.ok) throw new Error("travel transition failed");
  return result as Extract<T, { ok: true }>;
}

function atAshfall(): GalaxyRunState {
  const run = createFreshGalaxyRun();
  const preview = planRoute(run, { kind: "contact", contactId: "contact:ashfall" });
  assert.equal(preview.ok, true, preview.ok ? undefined : preview.reasons.join("; "));
  if (!preview.ok) throw new Error("route preview failed");
  const committed = requireTravel(commitTravel(run, preview.plan));
  const arrived = requireTravel(resumeTravelToBoundary(committed.galaxyRun));
  return requireTravel(finalizeTravel(arrived.galaxyRun)).galaxyRun;
}

function parentFor(run: GalaxyRunState = atAshfall()): SaveData {
  const legacySeed = migrateSave({
    currentWorld: 7,
    credits: 9876,
    materials: ["phase-crystal"],
    completedQuests: ["legacy-quest"],
    completedPlanets: ["pyraxis"],
  });
  const withLegacyColony = colonyReducer(legacySeed, Events.founded({
    colonyId: "legacy:ashfall",
    name: "Preserved Legacy Ashfall",
    planetId: "ashfall",
    foundingType: "outpost",
    regionNodeId: "ashfall-forward-camp",
    missionCount: legacySeed.missionsSinceStart,
    layoutSeed: 99,
  }));
  const legacy = startFreshGalaxy(withLegacyColony);
  return { ...legacy, galaxyRun: run };
}

function legacySnapshot(save: SaveData): Omit<SaveData, "galaxyRun"> {
  const { galaxyRun: _galaxyRun, ...legacy } = structuredClone(save);
  return legacy;
}

function requireRegion<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  assert.equal(result.ok, true, "reason" in result ? String(result.reason) : undefined);
  if (!result.ok) throw new Error("galaxy region transition failed");
  return result as Extract<T, { ok: true }>;
}

const NO_KEYS: Keys = {
  left: false,
  right: false,
  up: false,
  down: false,
  strafeLeft: false,
  strafeRight: false,
  shoot: false,
  bomb: false,
  jump: false,
};

function launchSurveyedPoi(targetNodeId: string) {
  const primaryId = "galaxy:ashfall-primary";
  let save = parentFor();
  let originColonyId = primaryId;

  if (targetNodeId === "ashfall-glassknife-canyon") {
    const funded = structuredClone(save);
    const primary = funded.galaxyRun!.colonies.find((colony) => colony.id === primaryId)!;
    primary.resources = { ...primary.resources, ...OUTPOST_FOUNDING_COST };
    const surveyedSite = requireRegion(startGalaxyRegionExpedition(
      funded,
      "contact:ashfall",
      { kind: "survey", originColonyId: primaryId, targetNodeId: "ashfall-basalt-basin" },
      null,
    ));
    const founded = requireRegion(foundGalaxyOutpost(
      surveyedSite.save,
      "contact:ashfall",
      primaryId,
      "ashfall-basalt-basin",
      "Basalt Basin",
    ));
    save = founded.save;
    originColonyId = founded.colonyId;
  }

  const surveyed = requireRegion(startGalaxyRegionExpedition(
    save,
    "contact:ashfall",
    { kind: "survey", originColonyId, targetNodeId },
    null,
  ));
  const launched = requireRegion(startGalaxyRegionExpedition(
    surveyed.save,
    "contact:ashfall",
    { kind: "poi", originColonyId, targetNodeId },
    null,
  ));
  assert.ok(launched.session);
  return { ...launched, originColonyId };
}

test("visited Ashfall opens the galaxy-owned origin through a disposable RegionMapScreen projection", () => {
  const parent = parentFor();
  const opened = requireRegion(openGalaxyRegion(parent, "contact:ashfall"));

  assert.equal(opened.originColony.id, "galaxy:ashfall-primary");
  assert.equal(opened.originColony.planetId, "ashfall");
  assert.equal(opened.projectedSave.activeExperience, "legacy");
  assert.equal(opened.projectedSave.galaxyRun, null);
  assert.notStrictEqual(opened.projectedSave, parent);
  assert.notStrictEqual(opened.originColony, parent.galaxyRun!.colonies[0]);

  const html = renderToStaticMarkup(React.createElement(RegionMapScreen, {
    save: opened.projectedSave,
    originColonyId: opened.originColony.id,
    mode: "pad",
    onClose() {},
  }));
  assert.match(html, /ASHFALL REGION/);
  assert.match(html, /Forward Camp/);
});

test("region opening rejects non-Ashfall, non-visited, legacy, and reflective inputs", () => {
  const parent = parentFor();
  assert.deepEqual(openGalaxyRegion(parent, "contact:kepler"), {
    ok: false,
    reason: "unsupported_contact",
  });

  const charted = parentFor(createFreshGalaxyRun());
  assert.deepEqual(openGalaxyRegion(charted, "contact:ashfall"), {
    ok: false,
    reason: "contact_not_visited",
  });

  const unsupported = atAshfall();
  unsupported.identity = { ...unsupported.identity, generationVersion: 999 };
  assert.deepEqual(openGalaxyRegion(parentFor(unsupported), "contact:ashfall"), {
    ok: false,
    reason: "generation_unavailable",
  });

  const legacy = migrateSave({ activeExperience: "legacy", galaxyRun: null });
  assert.deepEqual(openGalaxyRegion(legacy, "contact:ashfall"), {
    ok: false,
    reason: "missing_galaxy_run",
  });

  const trapped = parentFor();
  trapped.galaxyRun = new Proxy(trapped.galaxyRun!, {
    ownKeys() {
      throw new Error("atlas reflection trap");
    },
  });
  assert.deepEqual(openGalaxyRegion(trapped, "contact:ashfall"), {
    ok: false,
    reason: "malformed_save",
  });
});

test("survey expedition advances only the galaxy cycle and merges region intel", () => {
  const parent = parentFor();
  const legacyBefore = legacySnapshot(parent);
  const cycleBefore = parent.galaxyRun!.worldCycle;
  const result = requireRegion(startGalaxyRegionExpedition(
    parent,
    "contact:ashfall",
    {
      kind: "survey",
      originColonyId: "galaxy:ashfall-primary",
      targetNodeId: "ashfall-cinder-relay",
    },
    null,
  ));

  assert.equal(result.save.activeExperience, "galaxy");
  assert.ok(result.save.galaxyRun);
  assert.equal(result.save.galaxyRun.worldCycle, cycleBefore + 1);
  assert.equal(result.save.missionsSinceStart, parent.missionsSinceStart);
  assert.equal(
    result.save.galaxyRun.planets[0].regionMap.nodes.find((node) =>
      node.id === "ashfall-cinder-relay")?.intel,
    "surveyed",
  );
  assert.deepEqual(legacySnapshot(result.save), legacyBefore);
  assert.equal(parent.galaxyRun!.worldCycle, cycleBefore, "input save must remain immutable");
});

test("founding deducts only galaxy-colony resources and claims the deterministic site", () => {
  const run = atAshfall();
  const primary = run.colonies.find((colony) => colony.id === "galaxy:ashfall-primary")!;
  primary.resources = { ...primary.resources, ...OUTPOST_FOUNDING_COST };
  const parent = parentFor(run);
  const legacyBefore = legacySnapshot(parent);

  const surveyed = requireRegion(startGalaxyRegionExpedition(
    parent,
    "contact:ashfall",
    {
      kind: "survey",
      originColonyId: primary.id,
      targetNodeId: "ashfall-basalt-basin",
    },
    null,
  ));
  const founded = requireRegion(foundGalaxyOutpost(
    surveyed.save,
    "contact:ashfall",
    primary.id,
    "ashfall-basalt-basin",
    "Basalt Basin",
  ));

  const canonicalRun = founded.save.galaxyRun!;
  assert.deepEqual(
    canonicalRun.colonies.find((colony) => colony.id === primary.id)?.resources,
    { food: 0, water: 0, metal: 0, credits: 0 },
  );
  assert.equal(
    canonicalRun.planets[0].regionMap.nodes.find((node) =>
      node.id === "ashfall-basalt-basin")?.intel,
    "claimed",
  );
  assert.equal(founded.colonyId, "outpost:ashfall-basalt-basin");
  assert.equal(canonicalRun.colonies.some((colony) => colony.id === founded.colonyId), true);
  assert.deepEqual(legacySnapshot(founded.save), legacyBefore);
});

test("gameplay-mutated sessions for every native POI engine prepare from canonical dispatch authority", () => {
  const fixtures = [
    ["ashfall-cinder-relay", "firstPerson"],
    ["ashfall-oathbreaker-wreck", "boarding"],
    ["ashfall-glassknife-canyon", "groundRun"],
  ] as const;

  for (const [nodeId, engine] of fixtures) {
    const launched = launchSurveyedPoi(nodeId);
    const session = launched.session!;
    assert.equal(session.engine, engine);
    const initialNativeState = structuredClone(session.state);
    const projection = requireRegion(openGalaxyRegion(launched.save, "contact:ashfall")).projectedSave;
    const gameState = createPoiGameState(session, projection);

    if (session.engine === "firstPerson") {
      updateFirstPerson(gameState, { ...NO_KEYS, right: true });
      assert.ok(gameState.firstPersonState);
      session.state = gameState.firstPersonState!;
    } else if (session.engine === "boarding") {
      updateBoardingEngine(gameState, { ...NO_KEYS, jump: true });
      assert.ok(gameState.boardingState);
      session.state = gameState.boardingState!;
    } else {
      updateGroundEngine(gameState, { ...NO_KEYS, shoot: true });
      assert.ok(gameState.groundState);
      session.state = gameState.groundState!;
    }
    assert.notDeepEqual(session.state, initialNativeState, `${engine} update must mutate native session state`);
    let mutableStateReads = 0;
    (session as { state: object }).state = new Proxy(session.state, {
      get() {
        mutableStateReads += 1;
        throw new Error(`${engine} mutable state read`);
      },
      ownKeys() {
        mutableStateReads += 1;
        throw new Error(`${engine} mutable state reflection`);
      },
    });

    const prepared = prepareGalaxyPoiCompletion(
      launched.save,
      "contact:ashfall",
      { originColonyId: launched.originColonyId, session },
      GameScreen.LEVEL_COMPLETE,
    );
    assert.equal(prepared.ok, true, prepared.ok ? undefined : prepared.reason);
    assert.equal(mutableStateReads, 0);
  }
});

test("POI preparation journals collision-safe canonical authority without an extra cycle", () => {
  const launched = launchSurveyedPoi("ashfall-cinder-relay");
  const cycleBefore = launched.save.galaxyRun!.worldCycle;
  const legacyBefore = legacySnapshot(launched.save);
  const prepared = requireRegion(prepareGalaxyPoiCompletion(
    launched.save,
    "contact:ashfall",
    { originColonyId: launched.originColonyId, session: launched.session! },
    GameScreen.LEVEL_COMPLETE,
  ));
  const pending = prepared.pending as typeof prepared.pending & { preparedFactId: string };

  assert.equal(prepared.save.galaxyRun!.worldCycle, cycleBefore + 1);
  assert.deepEqual(legacySnapshot(prepared.save), legacyBefore);
  assert.strictEqual(prepared.save, pending.baseSave);
  assert.strictEqual(pending.baseSave, pending.projectedSave);
  assert.match(pending.preparedFactId, /^history:poi-prepared:[0-9a-f]{8}:/);
  const fact = prepared.save.galaxyRun!.historyFacts.find((entry) =>
    entry.id === pending.preparedFactId);
  assert.deepEqual(fact, {
    id: pending.preparedFactId,
    kind: "poi_completion_prepared",
    subjectId: "ashfall-cinder-relay",
    cycle: cycleBefore + 1,
    causeFactIds: [],
  });
  const encodedPayload = pending.preparedFactId.split(":").slice(3).join(":");
  assert.deepEqual(JSON.parse(decodeURIComponent(encodedPayload)), [
    1,
    "galaxy:ashfall-primary",
    "ashfall-cinder-relay",
    cycleBefore + 1,
    "fp-ruin-cinder-relay",
    "firstPerson",
    true,
    ["galaxy:ashfall-primary", "ashfall-cinder-relay", [["metal", 80]]],
  ]);
});

test("POI travel, completion, and mission_delivery remain galaxy-only and idempotent", () => {
  const parent = parentFor();
  const legacyBefore = legacySnapshot(parent);
  const primaryId = "galaxy:ashfall-primary";
  const surveyed = requireRegion(startGalaxyRegionExpedition(
    parent,
    "contact:ashfall",
    { kind: "survey", originColonyId: primaryId, targetNodeId: "ashfall-cinder-relay" },
    null,
  ));
  const cycleAfterSurvey = surveyed.save.galaxyRun!.worldCycle;
  const launched = requireRegion(startGalaxyRegionExpedition(
    surveyed.save,
    "contact:ashfall",
    { kind: "poi", originColonyId: primaryId, targetNodeId: "ashfall-cinder-relay" },
    null,
  ));
  assert.ok(launched.session);
  assert.equal(launched.session?.rewardEligible, true);
  assert.equal(launched.save.galaxyRun!.worldCycle, cycleAfterSurvey + 1);

  const pending = requireRegion(prepareGalaxyPoiCompletion(
    launched.save,
    "contact:ashfall",
    { originColonyId: primaryId, session: launched.session! },
    GameScreen.LEVEL_COMPLETE,
  ));
  assert.equal(pending.pending.baseSave.activeExperience, "galaxy");
  assert.ok(pending.pending.baseSave.galaxyRun);
  assert.equal(pending.pending.projectedSave.activeExperience, "galaxy");
  assert.ok(pending.pending.projectedSave.galaxyRun);
  assert.equal(pending.save.galaxyRun!.worldCycle, cycleAfterSurvey + 2);
  assert.deepEqual(legacySnapshot(pending.save), legacyBefore);

  const resolved = requireRegion(resolveGalaxyPoiCompletion(
    pending.save,
    "contact:ashfall",
    pending.pending,
    primaryId,
  ));
  const colony = resolved.save.galaxyRun!.colonies.find((entry) => entry.id === primaryId)!;
  assert.equal(colony.resources.metal, 80);
  assert.equal(
    resolved.save.galaxyRun!.planets[0].regionMap.nodes.find((node) =>
      node.id === "ashfall-cinder-relay")?.intel,
    "cleared",
  );
  assert.equal(resolved.delivery?.payload.metal, 80);
  const event = missionDeliveryEvent(resolved.delivery!);
  assert.equal(event.type, "colony/resourceChanged");
  if (event.type === "colony/resourceChanged") {
    assert.equal(event.payload.reason, "mission_delivery");
  }
  assert.deepEqual(legacySnapshot(resolved.save), legacyBefore);

  const beforeDuplicate = structuredClone(resolved.save);
  const duplicate = resolveGalaxyPoiCompletion(
    resolved.save,
    "contact:ashfall",
    pending.pending,
    primaryId,
  );
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) {
    assert.equal(duplicate.reason, "outcome_stale");
    assert.strictEqual(duplicate.save, resolved.save);
  }
  assert.deepEqual(resolved.save, beforeDuplicate);
});

test("a migrated reload recovers one prepared POI outcome and resolves its cycle and cargo exactly once", () => {
  const launched = launchSurveyedPoi("ashfall-cinder-relay");
  const prepared = requireRegion(prepareGalaxyPoiCompletion(
    launched.save,
    "contact:ashfall",
    { originColonyId: launched.originColonyId, session: launched.session! },
    GameScreen.LEVEL_COMPLETE,
  ));
  const preparedCycle = prepared.save.galaxyRun!.worldCycle;
  const reloaded = migrateSave(JSON.parse(JSON.stringify(prepared.save)));

  const recovered = requireRegion(recoverGalaxyPoiCompletion(reloaded, "contact:ashfall"));
  assert.ok(recovered.pending);
  assert.strictEqual(recovered.pending?.baseSave, recovered.pending?.projectedSave);
  assert.strictEqual(recovered.pending?.baseSave, recovered.save);
  const resolved = requireRegion(resolveGalaxyPoiCompletion(
    recovered.save,
    "contact:ashfall",
    recovered.pending!,
    launched.originColonyId,
  ));
  assert.equal(resolved.save.galaxyRun!.worldCycle, preparedCycle);
  assert.equal(
    resolved.save.galaxyRun!.colonies.find((colony) => colony.id === launched.originColonyId)?.resources.metal,
    80,
  );
  const afterResolution = requireRegion(recoverGalaxyPoiCompletion(resolved.save, "contact:ashfall"));
  assert.equal(afterResolution.pending, null);
});

test("prepared POI recovery rejects malformed and ambiguous unresolved journals", () => {
  const launched = launchSurveyedPoi("ashfall-cinder-relay");
  const prepared = requireRegion(prepareGalaxyPoiCompletion(
    launched.save,
    "contact:ashfall",
    { originColonyId: launched.originColonyId, session: launched.session! },
    GameScreen.LEVEL_COMPLETE,
  ));
  const malformed = structuredClone(prepared.save);
  malformed.galaxyRun!.historyFacts.find((fact) =>
    fact.id === prepared.pending.preparedFactId)!.causeFactIds = ["fact:forged"];
  const malformedResult = recoverGalaxyPoiCompletion(malformed, "contact:ashfall");
  assert.deepEqual(malformedResult, { ok: false, reason: "invalid_poi_session" });

  const secondSurvey = requireRegion(startGalaxyRegionExpedition(
    prepared.save,
    "contact:ashfall",
    { kind: "survey", originColonyId: launched.originColonyId, targetNodeId: "ashfall-oathbreaker-wreck" },
    null,
  ));
  const secondLaunch = requireRegion(startGalaxyRegionExpedition(
    secondSurvey.save,
    "contact:ashfall",
    { kind: "poi", originColonyId: launched.originColonyId, targetNodeId: "ashfall-oathbreaker-wreck" },
    null,
  ));
  const ambiguous = requireRegion(prepareGalaxyPoiCompletion(
    secondLaunch.save,
    "contact:ashfall",
    { originColonyId: launched.originColonyId, session: secondLaunch.session! },
    GameScreen.LEVEL_COMPLETE,
  ));
  const ambiguousResult = recoverGalaxyPoiCompletion(ambiguous.save, "contact:ashfall");
  assert.deepEqual(ambiguousResult, { ok: false, reason: "invalid_poi_session" });
});

test("a cleared POI replay costs travel and completion cycles but cannot pay cargo twice", () => {
  const primaryId = "galaxy:ashfall-primary";
  const surveyed = requireRegion(startGalaxyRegionExpedition(
    parentFor(),
    "contact:ashfall",
    { kind: "survey", originColonyId: primaryId, targetNodeId: "ashfall-cinder-relay" },
    null,
  ));
  const launched = requireRegion(startGalaxyRegionExpedition(
    surveyed.save,
    "contact:ashfall",
    { kind: "poi", originColonyId: primaryId, targetNodeId: "ashfall-cinder-relay" },
    null,
  ));
  const pending = requireRegion(prepareGalaxyPoiCompletion(
    launched.save,
    "contact:ashfall",
    { originColonyId: primaryId, session: launched.session! },
    GameScreen.LEVEL_COMPLETE,
  ));
  const first = requireRegion(resolveGalaxyPoiCompletion(
    pending.save,
    "contact:ashfall",
    pending.pending,
    primaryId,
  ));
  const replayStartCycle = first.save.galaxyRun!.worldCycle;

  const replay = requireRegion(startGalaxyRegionExpedition(
    first.save,
    "contact:ashfall",
    { kind: "poi", originColonyId: primaryId, targetNodeId: "ashfall-cinder-relay" },
    null,
  ));
  assert.equal(replay.session?.rewardEligible, false);
  const replayPending = requireRegion(prepareGalaxyPoiCompletion(
    replay.save,
    "contact:ashfall",
    { originColonyId: primaryId, session: replay.session! },
    GameScreen.LEVEL_COMPLETE,
  ));
  assert.equal(replayPending.pending.outcome, null);
  const replayResolved = requireRegion(resolveGalaxyPoiCompletion(
    replayPending.save,
    "contact:ashfall",
    replayPending.pending,
    null,
  ));
  assert.equal(replayResolved.delivery, null);
  assert.equal(replayResolved.save.galaxyRun!.worldCycle, replayStartCycle + 2);
  assert.equal(
    replayResolved.save.galaxyRun!.colonies.find((entry) => entry.id === primaryId)?.resources.metal,
    80,
  );
});

test("forged pending outcomes for surveyed POIs and colony sites fail unchanged", () => {
  const primaryId = "galaxy:ashfall-primary";
  for (const nodeId of ["ashfall-cinder-relay", "ashfall-basalt-basin"]) {
    const surveyed = requireRegion(startGalaxyRegionExpedition(
      parentFor(),
      "contact:ashfall",
      { kind: "survey", originColonyId: primaryId, targetNodeId: nodeId },
      null,
    ));
    const before = structuredClone(surveyed.save);
    const forgedPending = {
      originColonyId: primaryId,
      nodeId,
      preparedFactId: "history:poi-prepared:00000000:%5B%5D",
      baseSave: surveyed.save,
      projectedSave: surveyed.save,
      outcome: { originColonyId: primaryId, nodeId, payload: { ...POI_CARGO } },
    };

    const result = resolveGalaxyPoiCompletion(
      surveyed.save,
      "contact:ashfall",
      forgedPending as never,
      primaryId,
    );
    assert.equal(result.ok, false, `${nodeId} forged pending must be rejected`);
    if (!result.ok) {
      assert.equal(result.reason, "invalid_poi_session");
      assert.strictEqual(result.save, surveyed.save);
    }
    assert.deepEqual(surveyed.save, before);
  }
});

test("same-cycle galaxy divergence invalidates an otherwise authentic pending completion", () => {
  const launched = launchSurveyedPoi("ashfall-cinder-relay");
  const prepared = requireRegion(prepareGalaxyPoiCompletion(
    launched.save,
    "contact:ashfall",
    { originColonyId: launched.originColonyId, session: launched.session! },
    GameScreen.LEVEL_COMPLETE,
  ));
  const divergent = structuredClone(prepared.save);
  divergent.galaxyRun!.resources.supply += 1;
  assert.equal(divergent.galaxyRun!.worldCycle, prepared.save.galaxyRun!.worldCycle);
  const before = structuredClone(divergent);

  const result = resolveGalaxyPoiCompletion(
    divergent,
    "contact:ashfall",
    prepared.pending,
    launched.originColonyId,
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "invalid_poi_session");
    assert.strictEqual(result.save, divergent);
  }
  assert.deepEqual(divergent, before);
});

test("resolution validates every prepared journal field and its canonical payload", () => {
  const launched = launchSurveyedPoi("ashfall-cinder-relay");
  const prepared = requireRegion(prepareGalaxyPoiCompletion(
    launched.save,
    "contact:ashfall",
    { originColonyId: launched.originColonyId, session: launched.session! },
    GameScreen.LEVEL_COMPLETE,
  ));
  const mutations: Array<(save: SaveData, pending: typeof prepared.pending) => void> = [
    (save) => {
      save.galaxyRun!.historyFacts.at(-1)!.kind = "poi_completion_forged";
    },
    (save) => {
      save.galaxyRun!.historyFacts.at(-1)!.subjectId = "ashfall-basalt-basin";
    },
    (save) => {
      save.galaxyRun!.historyFacts.at(-1)!.cycle += 1;
    },
    (save, pending) => {
      const encoded = pending.preparedFactId.split(":").slice(3).join(":");
      const payload = JSON.parse(decodeURIComponent(encoded));
      payload[5] = "boarding";
      const canonical = JSON.stringify(payload);
      const hash = stableHash(`poi-prepared:${canonical}`).toString(16).padStart(8, "0");
      const forgedId = `history:poi-prepared:${hash}:${encodeURIComponent(canonical)}`;
      save.galaxyRun!.historyFacts.at(-1)!.id = forgedId;
      pending.preparedFactId = forgedId;
    },
  ];

  for (const mutate of mutations) {
    const forgedSave = structuredClone(prepared.save);
    const forgedPending = structuredClone(prepared.pending);
    mutate(forgedSave, forgedPending);
    forgedPending.baseSave = forgedSave;
    forgedPending.projectedSave = forgedSave;
    const before = structuredClone(forgedSave);
    const result = resolveGalaxyPoiCompletion(
      forgedSave,
      "contact:ashfall",
      forgedPending,
      launched.originColonyId,
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "invalid_poi_session");
      assert.strictEqual(result.save, forgedSave);
    }
    assert.deepEqual(forgedSave, before);
  }
});

test("unknown and forged region mutation inputs fail closed without changing canonical state", () => {
  const parent = parentFor();
  const before = structuredClone(parent);
  const unknown = startGalaxyRegionExpedition(
    parent,
    "contact:ashfall",
    { kind: "survey", originColonyId: "legacy:colony", targetNodeId: "ashfall-cinder-relay" },
    null,
  );
  assert.equal(unknown.ok, false);
  assert.deepEqual(parent, before);

  const forgedSession = {
    nodeId: "ashfall-cinder-relay",
    engine: "firstPerson" as const,
    state: {},
    rewardEligible: false,
  };
  const forged = prepareGalaxyPoiCompletion(
    parent,
    "contact:ashfall",
    { originColonyId: "galaxy:ashfall-primary", session: forgedSession as never },
    GameScreen.LEVEL_COMPLETE,
  );
  assert.deepEqual(forged, { ok: false, reason: "invalid_poi_session" });
  assert.deepEqual(parent, before);
});

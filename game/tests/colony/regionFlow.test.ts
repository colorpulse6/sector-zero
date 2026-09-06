import { test } from "node:test";
import assert from "node:assert/strict";
import { EnemyType, GameScreen } from "../../app/components/engine/types";
import { migrateSave } from "../../app/components/engine/save";
import { recordKill } from "../../app/components/engine/bestiary";
import { colonyReducer } from "../../app/components/colony/shared/colonyReducer";
import { Events } from "../../app/components/colony/shared/colonyEvents";
import { dispatchPoi } from "../../app/components/colony/region/poiDispatcher";
import {
  createPoiGameState,
  preparePoiCompletion,
  recoverLegacyPoiCompletion,
  resolvePoiCompletion,
} from "../../app/components/colony/region/poiRuntime";

function ready() {
  const fresh = migrateSave({});
  let save = colonyReducer(fresh, Events.founded({ colonyId: "home", name: "Home", planetId: "ashfall", foundingType: "outpost", regionNodeId: "ashfall-forward-camp", missionCount: 0, layoutSeed: 1 }));
  save = { ...save, planets: save.planets.map(p => ({ ...p, regionMap: { ...p.regionMap, nodes: p.regionMap.nodes.map(n => n.id === "ashfall-cinder-relay" ? { ...n, intel: "surveyed" as const } : n) } })) };
  return save;
}

test("native sessions create launchable states for all engine modes", () => {
  const save = ready();
  const dispatched = dispatchPoi(save, "home", "ashfall-cinder-relay");
  assert.equal(dispatched.ok, true);
  if (!dispatched.ok) return;
  const state = createPoiGameState(dispatched.session, save);
  assert.equal(state.currentMode, "first-person");
  assert.equal(state.screen, GameScreen.PLAYING);
});

test("POI outcome attempts keep the explicit dispatch origin when two colonies share one planet", () => {
  let save = ready();
  save = {
    ...save,
    planets: save.planets.map((planet) => ({
      ...planet,
      regionMap: {
        ...planet.regionMap,
        nodes: planet.regionMap.nodes.map((node) => node.id === "ashfall-basalt-basin"
          ? { ...node, intel: "surveyed" as const, discovered: true }
          : node),
      },
    })),
  };
  save = colonyReducer(save, Events.founded({
    colonyId: "secondary",
    name: "Secondary",
    planetId: "ashfall",
    foundingType: "outpost",
    regionNodeId: "ashfall-basalt-basin",
    missionCount: 0,
    layoutSeed: 2,
  }));
  const dispatched = dispatchPoi(save, "home", "ashfall-cinder-relay");
  assert.equal(dispatched.ok, true);
  if (!dispatched.ok) return;
  const state = createPoiGameState(
    dispatched.session,
    save,
    "legacy",
    () => "explicit-poi-origin",
    save,
    "home",
  );
  assert.equal(state.outcomeAttempt?.routeIdentity.kind, "poi");
  if (state.outcomeAttempt?.routeIdentity.kind === "poi") {
    assert.equal(state.outcomeAttempt.routeIdentity.originColonyId, "home");
  }
  assert.throws(() => createPoiGameState(
    dispatched.session,
    save,
    "legacy",
    () => "forged-poi-origin",
    save,
    "missing-origin",
  ));
  assert.throws(() => createPoiGameState(
    dispatched.session,
    save,
    "legacy",
    () => "partial-poi-origin",
    save,
  ));
});

test("only active LEVEL_COMPLETE stages v2 authority; the final fold owns the one domain cycle", () => {
  const save = ready();
  const dispatched = dispatchPoi(save, "home", "ashfall-cinder-relay");
  assert.equal(dispatched.ok, true);
  if (!dispatched.ok) return;
  const active = { originColonyId: "home", session: dispatched.session };
  const state = createPoiGameState(
    dispatched.session,
    save,
    "legacy",
    () => "legacy-poi-prepared",
    save,
    "home",
  );
  assert.ok(state.outcomeAttempt);
  assert.equal(preparePoiCompletion(save, active, GameScreen.GAME_OVER, state.outcomeAttempt!), null);
  const pending = preparePoiCompletion(save, active, GameScreen.LEVEL_COMPLETE, state.outcomeAttempt!);
  assert.ok(pending);
  assert.equal(pending!.baseSave.missionsSinceStart, save.missionsSinceStart);
  assert.equal(pending!.preparedSave.missionsSinceStart, save.missionsSinceStart);
  assert.equal(pending!.preparedSave.saveRevision, save.saveRevision + 1);
  assert.deepEqual(pending!.preparedSave.outcomeRecoveryRecords, [{
    version: 2,
    kind: "legacy_poi_prepared",
    envelope: pending!.preparedEnvelope,
  }]);
  assert.equal(pending!.preparedEnvelope.outcomeId, "legacy-poi-prepared:success");
  assert.equal((pending!.preparedEnvelope.payload as { kind: string }).kind, "poi_prepared_v2");

  const reloaded = migrateSave(JSON.parse(JSON.stringify(pending!.preparedSave)));
  const recovered = recoverLegacyPoiCompletion(reloaded);
  assert.ok(recovered);
  assert.equal(recovered!.preparedEnvelope.outcomeId, pending!.preparedEnvelope.outcomeId);
  assert.deepEqual(recovered!.outcome, pending!.outcome);

  const resolved = resolvePoiCompletion(pending!, "home");
  assert.ok(resolved);
  if (!resolved) return;
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;
  assert.equal(resolved.envelope.outcomeId, pending!.preparedEnvelope.outcomeId);
  assert.deepEqual(resolved.envelope.payload, {
    version: 2,
    kind: "poi_result_v2",
    destinationColonyId: "home",
  });
  assert.equal(resolved.save.colonies[0].resources.metal, 0);
  assert.equal(resolved.save.planets[0].regionMap.nodes.find(n => n.id === "ashfall-cinder-relay")?.intel, "surveyed");
});

test("the shipped Legacy POI compatibility path still resolves one cycle and one cargo fold", () => {
  const save = ready();
  const dispatched = dispatchPoi(save, "home", "ashfall-cinder-relay");
  assert.equal(dispatched.ok, true);
  if (!dispatched.ok) return;
  const active = { originColonyId: "home", session: dispatched.session };
  const pending = preparePoiCompletion(save, active, GameScreen.LEVEL_COMPLETE);
  assert.ok(pending);
  if (!pending) return;
  assert.equal(pending.baseSave.missionsSinceStart, save.missionsSinceStart + 1);
  const resolved = resolvePoiCompletion(pending, "home");
  assert.ok(resolved);
  if (!resolved || !resolved.ok) return;
  assert.equal(resolved.save.colonies[0].resources.metal, 80);
  assert.equal(
    resolved.save.planets[0].regionMap.nodes.find((node) => node.id === "ashfall-cinder-relay")?.intel,
    "cleared",
  );
});

test("Legacy POI outcome APIs reject hostile inputs without invoking getters or throwing", () => {
  const save = ready();
  const dispatched = dispatchPoi(save, "home", "ashfall-cinder-relay");
  assert.equal(dispatched.ok, true);
  if (!dispatched.ok) return;
  const active = { originColonyId: "home", session: dispatched.session };
  const state = createPoiGameState(
    dispatched.session,
    save,
    "legacy",
    () => "hostile-poi-inputs",
    save,
    "home",
  );
  assert.ok(state.outcomeAttempt);

  const revokedSave = Proxy.revocable(save, {});
  revokedSave.revoke();
  assert.doesNotThrow(() => preparePoiCompletion(
    revokedSave.proxy,
    active,
    GameScreen.LEVEL_COMPLETE,
    state.outcomeAttempt!,
  ));
  assert.equal(preparePoiCompletion(
    revokedSave.proxy,
    active,
    GameScreen.LEVEL_COMPLETE,
    state.outcomeAttempt!,
  ), null);

  let saveReads = 0;
  const accessorSave = { ...save };
  Object.defineProperty(accessorSave, "saveRevision", {
    enumerable: true,
    get() {
      saveReads += 1;
      throw new Error("save getter must remain opaque");
    },
  });
  assert.equal(preparePoiCompletion(
    accessorSave,
    active,
    GameScreen.LEVEL_COMPLETE,
    state.outcomeAttempt!,
  ), null);
  assert.equal(saveReads, 0);

  const revokedActive = Proxy.revocable(active, {});
  revokedActive.revoke();
  assert.doesNotThrow(() => preparePoiCompletion(
    save,
    revokedActive.proxy,
    GameScreen.LEVEL_COMPLETE,
    state.outcomeAttempt!,
  ));
  assert.equal(preparePoiCompletion(
    save,
    revokedActive.proxy,
    GameScreen.LEVEL_COMPLETE,
    state.outcomeAttempt!,
  ), null);

  let activeSessionReads = 0;
  const accessorActive = { originColonyId: "home" } as typeof active;
  Object.defineProperty(accessorActive, "session", {
    enumerable: true,
    get() {
      activeSessionReads += 1;
      throw new Error("active session getter must remain opaque");
    },
  });
  assert.equal(preparePoiCompletion(
    save,
    accessorActive,
    GameScreen.LEVEL_COMPLETE,
    state.outcomeAttempt!,
  ), null);
  assert.equal(activeSessionReads, 0);

  let attemptReads = 0;
  const accessorAttempt = { ...state.outcomeAttempt! };
  Object.defineProperty(accessorAttempt, "routeKind", {
    enumerable: true,
    get() {
      attemptReads += 1;
      throw new Error("attempt getter must remain opaque");
    },
  });
  assert.equal(preparePoiCompletion(
    save,
    active,
    GameScreen.LEVEL_COMPLETE,
    accessorAttempt,
  ), null);
  assert.equal(attemptReads, 0);

  const revokedPending = Proxy.revocable({}, {});
  revokedPending.revoke();
  assert.doesNotThrow(() => resolvePoiCompletion(revokedPending.proxy as never, null));
  assert.equal(resolvePoiCompletion(revokedPending.proxy as never, null), null);

  let pendingReads = 0;
  const accessorPending = {};
  Object.defineProperty(accessorPending, "preparedEnvelope", {
    enumerable: true,
    get() {
      pendingReads += 1;
      throw new Error("pending getter must remain opaque");
    },
  });
  assert.equal(resolvePoiCompletion(accessorPending as never, null), null);
  assert.equal(pendingReads, 0);
});

test("Legacy POI outcome APIs fail closed over malformed plain objects", () => {
  const save = ready();
  const dispatched = dispatchPoi(save, "home", "ashfall-cinder-relay");
  assert.equal(dispatched.ok, true);
  if (!dispatched.ok) return;
  const active = { originColonyId: "home", session: dispatched.session };
  const state = createPoiGameState(
    dispatched.session,
    save,
    "legacy",
    () => "malformed-poi-inputs",
    save,
    "home",
  );
  assert.ok(state.outcomeAttempt);

  const malformedPrepareInputs: ReadonlyArray<readonly [string, unknown, unknown]> = [
    ["empty active POI", {}, state.outcomeAttempt],
    ["missing session fields", { originColonyId: "home", session: {} }, state.outcomeAttempt],
    ["empty attempt", active, {}],
    ["null route identity", active, { ...state.outcomeAttempt!, routeIdentity: null }],
    ["extra attempt authority", active, { ...state.outcomeAttempt!, opaque: true }],
  ];
  for (const [label, malformedActive, malformedAttempt] of malformedPrepareInputs) {
    assert.doesNotThrow(() => preparePoiCompletion(
      save,
      malformedActive as never,
      GameScreen.LEVEL_COMPLETE,
      malformedAttempt as never,
    ), label);
    assert.equal(preparePoiCompletion(
      save,
      malformedActive as never,
      GameScreen.LEVEL_COMPLETE,
      malformedAttempt as never,
    ), null, label);
  }
  assert.doesNotThrow(() => preparePoiCompletion(
    {} as never,
    active,
    GameScreen.LEVEL_COMPLETE,
    state.outcomeAttempt!,
  ));
  assert.equal(preparePoiCompletion(
    {} as never,
    active,
    GameScreen.LEVEL_COMPLETE,
    state.outcomeAttempt!,
  ), null);

  const nonexistentNoReward = {
    originColonyId: "missing-colony",
    session: {
      ...dispatched.session,
      nodeId: "missing-node",
      rewardEligible: false,
    },
  };
  assert.equal(preparePoiCompletion(
    save,
    nonexistentNoReward as never,
    GameScreen.LEVEL_COMPLETE,
  ), null);

  const missingCredits = { ...save } as Partial<typeof save>;
  delete missingCredits.credits;
  assert.equal(preparePoiCompletion(
    missingCredits as never,
    active,
    GameScreen.LEVEL_COMPLETE,
    state.outcomeAttempt!,
  ), null);
  const invalidSaveFields: ReadonlyArray<readonly [string, unknown]> = [
    ["undefined credits", { ...save, credits: undefined }],
    ["non-finite credits", { ...save, credits: Number.NaN }],
    ["negative credits", { ...save, credits: -1 }],
    ["undefined XP", { ...save, xp: undefined }],
    ["undefined current world", { ...save, currentWorld: undefined }],
    ["zero current world", { ...save, currentWorld: 0 }],
    ["invalid intro flag", { ...save, introSeen: "yes" }],
    ["malformed level ledger", { ...save, levels: { "1-1": { completed: true, stars: -1, highScore: 0 } } }],
    ["malformed upgrades", { ...save, upgrades: { ...save.upgrades, hullPlating: 4 } }],
    ["malformed string journal", { ...save, completedQuests: [42] }],
    ["unknown consumable inventory", { ...save, consumableInventory: { forged: 1 } }],
    ["negative consumable inventory", { ...save, consumableInventory: { "hull-repair": -1 } }],
    ["malformed bestiary", { ...save, bestiary: [] }],
    ["unknown equipped weapon", { ...save, equippedWeaponType: "forged" }],
    ["zero pilot level", { ...save, pilotLevel: 0 }],
    ["negative skill points", { ...save, skillPoints: -1 }],
    ["malformed colony collection", { ...save, colonies: [42] }],
    ["malformed planet collection", { ...save, planets: {} }],
    ["malformed game clock", { ...save, gameClock: { ...save.gameClock, hour: 24 } }],
    ["unknown experience", { ...save, activeExperience: "forged" }],
    ["malformed galaxy run", { ...save, galaxyRun: [] }],
    ["undefined extension", { ...save, futureField: undefined }],
  ];
  for (const [label, invalidSave] of invalidSaveFields) {
    assert.equal(preparePoiCompletion(
      invalidSave as never,
      active,
      GameScreen.LEVEL_COMPLETE,
      state.outcomeAttempt!,
    ), null, label);
  }

  const invalidTypedCollections: ReadonlyArray<readonly [string, unknown]> = [
    ["empty colony record", { ...save, colonies: [...save.colonies, {}] }],
    ["malformed colony population", {
      ...save,
      colonies: [{ ...save.colonies[0], population: {} }],
    }],
    ["empty planet record", { ...save, planets: [...save.planets, {}] }],
    ["malformed planet region map", {
      ...save,
      planets: [...save.planets, { ...save.planets[0], id: "verdania", regionMap: {} }],
    }],
    ["empty shipment record", { ...save, earthShipments: [{}] }],
    ["empty standing record", { ...save, factionStandings: [{}] }],
    ["empty bounty record", { ...save, bounties: [{}] }],
    ["population exceeds canonical overflow", {
      ...save,
      colonies: [{
        ...save.colonies[0],
        population: { ...save.colonies[0].population, total: save.colonies[0].population.capacity + 100 },
      }],
    }],
    ["colony site snapshot diverges from founding node", {
      ...save,
      colonies: [{
        ...save.colonies[0],
        siteStats: { ...save.colonies[0].siteStats, threat: save.colonies[0].siteStats.threat + 1 },
      }],
    }],
    ["shipment destination does not exist", {
      ...save,
      earthShipments: [{
        id: "shipment-missing-destination",
        contents: { metal: 10 },
        eta: { missionCount: 2 },
        interceptionChance: 0,
        interceptionTriggered: false,
        destinationColonyId: "missing-colony",
        costPaid: 10,
      }],
    }],
    ["standing rank contradicts value", {
      ...save,
      factionStandings: [{ ...save.factionStandings[0], standing: 100, rank: "hostile" }],
    }],
    ["bounty colony does not exist", {
      ...save,
      bounties: [{
        id: "bounty-missing-colony",
        colonyId: "missing-colony",
        amount: 10,
        reason: "trespass",
        witnesses: [],
        issued: { missionCount: 1 },
        expired: false,
      }],
    }],
  ];
  for (const [label, invalidSave] of invalidTypedCollections) {
    const invalidState = createPoiGameState(
      dispatched.session,
      invalidSave as never,
      "legacy",
      () => `malformed-typed-collection:${label}`,
      invalidSave as never,
      "home",
    );
    assert.ok(invalidState.outcomeAttempt, label);
    assert.equal(preparePoiCompletion(
      invalidSave as never,
      active,
      GameScreen.LEVEL_COMPLETE,
      invalidState.outcomeAttempt!,
    ), null, label);
  }

  const codeOwnedBestiary = recordKill(
    save.bestiary,
    EnemyType.DRONE,
    "tech-drone",
    { world: 1 },
  );
  const saveAfterCampaignKill = { ...save, bestiary: codeOwnedBestiary };
  const postKillState = createPoiGameState(
    dispatched.session,
    saveAfterCampaignKill,
    "legacy",
    () => "poi-after-campaign-kill",
    saveAfterCampaignKill,
    "home",
  );
  assert.ok(preparePoiCompletion(
    saveAfterCampaignKill,
    active,
    GameScreen.LEVEL_COMPLETE,
    postKillState.outcomeAttempt!,
  ));

  const attemptWithProto = { ...state.outcomeAttempt! };
  Object.defineProperty(attemptWithProto, "__proto__", {
    configurable: true,
    enumerable: true,
    value: { forged: true },
  });
  assert.equal(preparePoiCompletion(
    save,
    active,
    GameScreen.LEVEL_COMPLETE,
    attemptWithProto,
  ), null);

  const prepared = preparePoiCompletion(
    save,
    active,
    GameScreen.LEVEL_COMPLETE,
    state.outcomeAttempt!,
  );
  assert.ok(prepared);
  if (!prepared) return;
  const malformedPendingInputs: ReadonlyArray<readonly [string, unknown]> = [
    ["empty pending", {}],
    ["missing save", {
      originColonyId: "home",
      nodeId: dispatched.session.nodeId,
      baseSave: undefined,
      projectedSave: undefined,
      outcome: null,
    }],
    ["extra pending authority", { ...prepared, opaque: true }],
    ["forged prepared envelope", { ...prepared, preparedEnvelope: {} }],
    ["forged prepared save", { ...prepared, preparedSave: {} }],
    ["wrong prepared field type", { ...prepared, originColonyId: 42 }],
  ];
  for (const [label, malformedPending] of malformedPendingInputs) {
    assert.doesNotThrow(() => resolvePoiCompletion(malformedPending as never, null), label);
    assert.equal(resolvePoiCompletion(malformedPending as never, null), null, label);
  }

  const fabricatedNoOutcome = {
    originColonyId: "missing-colony",
    nodeId: "missing-node",
    baseSave: migrateSave({}),
    projectedSave: migrateSave({}),
    outcome: null,
  };
  assert.equal(resolvePoiCompletion(fabricatedNoOutcome as never, null), null);

  const compatibilityPending = preparePoiCompletion(save, active, GameScreen.LEVEL_COMPLETE);
  assert.ok(compatibilityPending);
  if (!compatibilityPending) return;
  assert.equal(resolvePoiCompletion({
    ...compatibilityPending,
    baseSave: { ...compatibilityPending.baseSave, credits: compatibilityPending.baseSave.credits + 999 },
  }, "home"), null);

  let nestedReads = 0;
  const accessorColonies = [...prepared.baseSave.colonies];
  Object.defineProperty(accessorColonies, "0", {
    configurable: true,
    enumerable: true,
    get() {
      nestedReads += 1;
      return prepared.baseSave.colonies[0];
    },
  });
  const accessorBaseSave = { ...prepared.baseSave, colonies: accessorColonies };
  assert.equal(resolvePoiCompletion({
    ...prepared,
    baseSave: accessorBaseSave,
    projectedSave: accessorBaseSave,
  }, null), null);
  assert.equal(nestedReads, 0);

  let preparedSaveReads = 0;
  const accessorPreparedSave = { ...prepared.preparedSave };
  Object.defineProperty(accessorPreparedSave, "credits", {
    configurable: true,
    enumerable: true,
    get() {
      preparedSaveReads += 1;
      return prepared.preparedSave.credits;
    },
  });
  assert.equal(resolvePoiCompletion({ ...prepared, preparedSave: accessorPreparedSave }, null), null);
  assert.equal(preparedSaveReads, 0);

  const pendingWithProto = { ...prepared };
  Object.defineProperty(pendingWithProto, "__proto__", {
    configurable: true,
    enumerable: true,
    value: { forged: true },
  });
  assert.equal(resolvePoiCompletion(pendingWithProto, null), null);
});

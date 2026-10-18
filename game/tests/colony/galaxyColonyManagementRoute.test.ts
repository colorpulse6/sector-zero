import { test } from "node:test";
import assert from "node:assert/strict";
import { commitGalaxyColonyCommission, quoteGalaxyColonyCommission } from "../../app/components/engine/galaxy/galaxyColonyManagement";
import { createFreshGalaxyRun, startFreshGalaxy } from "../../app/components/engine/galaxy/galaxyRun";
import { projectGalaxyRunToLegacyState } from "../../app/components/engine/galaxy/galaxyProjection";
import { planRoute } from "../../app/components/engine/galaxy/routePlanner";
import { commitTravel, finalizeTravel, resumeTravelToBoundary } from "../../app/components/engine/galaxy/travelResolver";
import { startGalaxyRegionExpedition, stageGalaxyPoiOutcomeAuthority } from "../../app/components/engine/operations/operationAdapters";
import { dispatchPoi } from "../../app/components/colony/region/poiDispatcher";
import { poiMissionDescriptor, poiOutcomeMissionId } from "../../app/components/engine/missionContext";
import { commitOutcome, createOutcomeEnvelope } from "../../app/components/engine/missionOutcome";
import { generateExteriorState } from "../../app/components/colony/exploration/colonyLayout";
import { SPRITES } from "../../app/components/engine/sprites";
import { migrateSave } from "../../app/components/engine/save";
import { GameScreen, type OutcomeAttempt, type SaveData } from "../../app/components/engine/types";
import { deliveryPayloadForPlanet } from "../../app/components/colony/shared/missionDelivery";
import { derivePowerGrid } from "../../app/components/colony/shared/powerGrid";
import type { BuildingType, ColonyState } from "../../app/components/colony/shared/colonyTypes";

const COLONY = "galaxy:ashfall-primary";

function ok<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  assert.equal(result.ok, true, JSON.stringify(result));
  return result as Extract<T, { ok: true }>;
}

function arrivedAtAshfall(): SaveData {
  const fresh = createFreshGalaxyRun();
  const preview = planRoute(fresh, { kind: "contact", contactId: "contact:ashfall" });
  if (!preview.ok) throw new Error(preview.reasons.join("; "));
  const committed = ok(commitTravel(fresh, preview.plan)).galaxyRun;
  const arrived = ok(finalizeTravel(ok(resumeTravelToBoundary(committed)).galaxyRun)).galaxyRun;
  return { ...startFreshGalaxy(migrateSave({ credits: 4321, completedPlanets: ["pyraxis"] })), galaxyRun: arrived };
}

function survey(save: SaveData, nodeId: string): SaveData {
  return ok(startGalaxyRegionExpedition(save, "contact:ashfall", { kind: "survey", originColonyId: COLONY, targetNodeId: nodeId }, null)).save;
}

function clearPoi(save: SaveData, nodeId: string, templateId: string): SaveData {
  const run = save.galaxyRun!;
  const dispatched = dispatchPoi(projectGalaxyRunToLegacyState(run), COLONY, nodeId);
  if (!dispatched.ok) throw new Error("POI dispatch failed");
  const routeIdentity = {
    kind: "poi" as const, originColonyId: COLONY, nodeId,
    engine: "firstPerson" as const, templateId, rewardEligible: true,
  };
  const attempt: OutcomeAttempt = {
    version: 1,
    routeKind: "poi",
    missionId: poiOutcomeMissionId(poiMissionDescriptor(nodeId, "firstPerson", templateId).id, COLONY),
    routeIdentity,
    launchId: `gc2a-route-poi-${nodeId}`,
    expectedRevision: save.saveRevision,
    persistenceAuthority: "galaxy",
    returnTarget: "galaxy-region",
    declaredFields: ["galaxyRun"],
    launchSnapshot: { galaxyRun: structuredClone(run) },
  };
  const staged = stageGalaxyPoiOutcomeAuthority(save, { originColonyId: COLONY, session: dispatched.session }, GameScreen.LEVEL_COMPLETE, attempt);
  if (!staged.ok) throw new Error(`POI staging failed: ${staged.reason}`);
  let canonical = staged.save;
  const committed = commitOutcome({ read: () => canonical, write: next => { canonical = next; } },
    createOutcomeEnvelope(staged.attempt, "success", { version: 2, kind: "poi_result_v2", destinationColonyId: COLONY }));
  if (committed.status !== "committed") throw new Error(`POI commit failed: ${committed.status}`);
  return committed.save;
}

function clearCinderRelay(save: SaveData): SaveData {
  return clearPoi(save, "ashfall-cinder-relay", "fp-ruin-cinder-relay");
}

test("fresh run: travel, earn POI metal, commission, survey, reload, see the Solar Array", () => {
  let save = arrivedAtAshfall();
  save = survey(save, "ashfall-cinder-relay");
  save = clearCinderRelay(save);
  const colonyAfterPoi = save.galaxyRun!.colonies.find(c => c.id === COLONY)!;
  assert.equal(colonyAfterPoi.resources.metal, 80);

  // Compare legacy fields after the same reload normalization on both sides.
  const legacyOf = (value: SaveData): string => {
    const { galaxyRun: _run, ...legacy } = migrateSave(JSON.parse(JSON.stringify(value)));
    return JSON.stringify(legacy);
  };
  const legacyBefore = legacyOf(save);
  const quote = ok(quoteGalaxyColonyCommission(save, COLONY, "solar_array")).quote;
  save = ok(commitGalaxyColonyCommission(save, quote)).save;
  const cycleAtCommission = save.galaxyRun!.worldCycle;
  save = survey(save, "ashfall-oathbreaker-wreck");
  assert.equal(save.galaxyRun!.worldCycle, cycleAtCommission + 1);

  const reloaded = migrateSave(JSON.parse(JSON.stringify(save)));
  const colony = reloaded.galaxyRun!.colonies.find(c => c.id === COLONY)!;
  assert.deepEqual(colony.buildings.map(b => [b.type, b.status]), [["solar_array", "operational"]]);
  assert.equal(legacyOf(save), legacyBefore, "management and the survey change no legacy field");
  const exterior = JSON.stringify(generateExteriorState(colony, reloaded.gameClock));
  assert.ok(exterior.includes(SPRITES.COLONY_WALL_SOLAR), "the walk draws the Solar Array walls");
  assert.ok(exterior.includes('"door"'), "the operational Solar Array has a door");
});

function ashfall(save: SaveData): ColonyState {
  return save.galaxyRun!.colonies.find(c => c.id === COLONY)!;
}

function build(save: SaveData, type: BuildingType): SaveData {
  return ok(commitGalaxyColonyCommission(save, ok(quoteGalaxyColonyCommission(save, COLONY, type)).quote)).save;
}

/** One repeatable cycle: re-enter the cleared Cinder Relay from the colony (no reward, no supply). */
function revisitCinderRelay(save: SaveData): SaveData {
  const before = save.galaxyRun!.worldCycle;
  const metal = ashfall(save).resources.metal;
  const minePerCycle = ashfall(save).buildings.some(b => b.type === "mine" && b.status === "operational") ? 10 : 0;
  const next = ok(startGalaxyRegionExpedition(save, "contact:ashfall",
    { kind: "poi", originColonyId: COLONY, targetNodeId: "ashfall-cinder-relay" }, null)).save;
  assert.equal(next.galaxyRun!.worldCycle, before + 1, "re-entering a cleared site passes one cycle");
  assert.equal(ashfall(next).resources.metal, metal + minePerCycle, "the only new metal is the mine's");
  assert.deepEqual(next.galaxyRun!.resources, save.galaxyRun!.resources, "no supply or run resource is spent or earned");
  return next;
}

test("settlement loop: one-time metal, power, mine, housing, food, water, settlers to 10/10", () => {
  let save = arrivedAtAshfall();
  const legacyOf = (value: SaveData): string => {
    const { galaxyRun: _run, ...legacy } = migrateSave(JSON.parse(JSON.stringify(value)));
    return JSON.stringify(legacy);
  };
  save = survey(save, "ashfall-cinder-relay");
  save = clearCinderRelay(save);
  assert.equal(ashfall(save).resources.metal, 80);
  save = build(save, "solar_array");
  save = survey(save, "ashfall-oathbreaker-wreck");
  save = clearPoi(save, "ashfall-oathbreaker-wreck", "boarding-wreck-oathbreaker");
  assert.equal(ashfall(save).resources.metal, 80);
  // Outcome receipts move shared fields; from here on, only management and cycles run.
  const legacyBefore = legacyOf(save);
  // The Ashfall sortie's success delivery; its route is covered by the operation suites.
  const sortie = deliveryPayloadForPlanet("ashfall").metal ?? 0;
  assert.equal(sortie, 80);
  save = { ...save, galaxyRun: { ...save.galaxyRun!, colonies: save.galaxyRun!.colonies.map(c => c.id === COLONY
    ? { ...c, resources: { ...c.resources, metal: c.resources.metal + sortie } } : c) } };
  assert.equal(quoteGalaxyColonyCommission(save, COLONY, "habitat_module").ok, false, "mine first with 160 metal");
  save = build(save, "mine");
  assert.equal(ashfall(save).resources.metal, 10);

  const queue: BuildingType[] = ["habitat_module", "farm", "water_purifier"];
  const startCycle = save.galaxyRun!.worldCycle;
  let fullAt: number | null = null;
  let lastSettlers = 0;
  for (let cycle = 0; cycle < 80 && fullAt === null; cycle += 1) {
    while (queue.length > 0 && quoteGalaxyColonyCommission(save, COLONY, queue[0]).ok) save = build(save, queue.shift()!);
    save = revisitCinderRelay(save);
    const colony = ashfall(save);
    assert.ok(colony.buildings.every(b => b.status !== "offline"), "no brownout");
    assert.ok(colony.population.total - lastSettlers <= 1, "settlers arrive one per cycle at most");
    lastSettlers = colony.population.total;
    if (colony.population.total === 10) fullAt = save.galaxyRun!.worldCycle - startCycle;
  }
  assert.equal(queue.length, 0, "all five buildings were commissioned from mine output");
  assert.ok(fullAt !== null && fullAt <= 50, `housing filled from zero to ten (${fullAt} cycles after the mine order)`);

  const atFull = ashfall(save);
  for (let cycle = 0; cycle < 5; cycle += 1) save = revisitCinderRelay(save);
  const later = ashfall(save);
  assert.equal(later.population.total, 10);
  assert.equal(later.population.capacity, 10);
  assert.equal(later.resources.food, atFull.resources.food + 25, "food +5 per cycle at 10 settlers");
  assert.equal(later.resources.water, atFull.resources.water + 10, "water +2 per cycle at 10 settlers");
  assert.equal(later.resources.metal, atFull.resources.metal + 50, "metal +10 per cycle");
  assert.deepEqual(derivePowerGrid(later), { capacity: 10, demand: 10, surplus: 0 });
  assert.ok(later.happiness > 60);

  const reloaded = migrateSave(JSON.parse(JSON.stringify(save)));
  assert.deepEqual(ashfall(reloaded), later, "a JSON reload keeps the colony");
  assert.equal(legacyOf(save), legacyBefore, "the settlement loop changes no legacy field");
  const exterior = JSON.stringify(generateExteriorState(later, reloaded.gameClock));
  for (const wall of [SPRITES.COLONY_WALL_SOLAR, SPRITES.COLONY_WALL_MINE, SPRITES.COLONY_WALL_HABITAT,
    SPRITES.COLONY_WALL_FARM, SPRITES.COLONY_WALL_PURIFIER]) {
    assert.ok(exterior.includes(wall), `the walk draws ${wall}`);
  }
});

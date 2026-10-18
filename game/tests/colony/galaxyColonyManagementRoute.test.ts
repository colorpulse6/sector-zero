import { test } from "node:test";
import assert from "node:assert/strict";
import { commitGalaxyColonyCommission, quoteGalaxyColonyCommission } from "../../app/components/engine/galaxy/galaxyColonyManagement";
import { createFreshGalaxyRun, startFreshGalaxy } from "../../app/components/engine/galaxy/galaxyRun";
import { projectGalaxyRunToLegacyState } from "../../app/components/engine/galaxy/galaxyProjection";
import { planRoute } from "../../app/components/engine/galaxy/routePlanner";
import { commitTravel, finalizeTravel, resumeTravelToBoundary } from "../../app/components/engine/galaxy/travelResolver";
import { startGalaxyRegionExpedition, stageGalaxyPoiOutcomeAuthority } from "../../app/components/engine/operations/operationAdapters";
import { dispatchPoi } from "../../app/components/colony/region/poiDispatcher";
import { poiOutcomeMissionId } from "../../app/components/engine/missionContext";
import { commitOutcome, createOutcomeEnvelope } from "../../app/components/engine/missionOutcome";
import { generateExteriorState } from "../../app/components/colony/exploration/colonyLayout";
import { SPRITES } from "../../app/components/engine/sprites";
import { migrateSave } from "../../app/components/engine/save";
import { GameScreen, type OutcomeAttempt, type SaveData } from "../../app/components/engine/types";

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

function clearCinderRelay(save: SaveData): SaveData {
  const run = save.galaxyRun!;
  const dispatched = dispatchPoi(projectGalaxyRunToLegacyState(run), COLONY, "ashfall-cinder-relay");
  if (!dispatched.ok) throw new Error("POI dispatch failed");
  const routeIdentity = {
    kind: "poi" as const, originColonyId: COLONY, nodeId: "ashfall-cinder-relay",
    engine: "firstPerson" as const, templateId: "fp-ruin-cinder-relay", rewardEligible: true,
  };
  const attempt: OutcomeAttempt = {
    version: 1,
    routeKind: "poi",
    missionId: poiOutcomeMissionId("poi:20:fp-ruin-cinder-relay:20:ashfall-cinder-relay", COLONY),
    routeIdentity,
    launchId: "gc2a-route-poi",
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

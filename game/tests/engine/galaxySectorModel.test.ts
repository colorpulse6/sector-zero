import { test } from "node:test";
import assert from "node:assert/strict";
import { createFreshGalaxyRun } from "../../app/components/engine/galaxy/galaxyRun";
import { planRoute } from "../../app/components/engine/galaxy/routePlanner";
import { coord } from "../../app/components/engine/galaxy/coordinates";
import { migrateSave } from "../../app/components/engine/save";
import { applyGalaxyFixture, findGalaxyFixture } from "../../app/components/galaxy/devFixtures";
import { buildSectorModel, elevationForFact, highestBand, sectorStars } from "../../app/components/galaxy/sector/sectorModel";
import {
  cameraRadiusForZoom,
  cellSceneSize,
  fromScene,
  SECTOR_SCENE_SIZE,
  toScene,
} from "../../app/components/galaxy/sector/sectorSpace";

function fixtureRun(id: string) {
  const fixture = findGalaxyFixture(id);
  assert.ok(fixture, `missing fixture ${id}`);
  const run = applyGalaxyFixture(migrateSave({}), fixture).galaxyRun;
  assert.ok(run);
  return run;
}

test("sector space maps the sector centre to the origin and round-trips integer coordinates", () => {
  const centre = toScene(coord(0, 0, 2048, 2048));
  assert.deepEqual(centre, { x: 0, z: 0 });
  const corner = toScene(coord(0, 0, 0, 4095));
  assert.ok(Math.abs(corner.x + SECTOR_SCENE_SIZE / 2) < 0.05);
  assert.ok(Math.abs(corner.z - SECTOR_SCENE_SIZE / 2) < 0.05);
  for (const point of [coord(0, 0, 512, 512), coord(0, 0, 1024, 512), coord(0, 0, 2816, 1792)]) {
    const scene = toScene(point);
    assert.deepEqual(fromScene(scene.x, scene.z), point);
  }
  assert.deepEqual(fromScene(-999, 999), coord(0, 0, 0, 4095));
  assert.ok(Math.abs(cellSceneSize() - SECTOR_SCENE_SIZE / 16) < 1e-9);
});

test("camera radius follows zoom monotonically between 8 and 60 units", () => {
  assert.equal(cameraRadiusForZoom(4), 8);
  assert.equal(cameraRadiusForZoom(0.1), 60);
  const mid = cameraRadiusForZoom(0.6);
  assert.ok(mid > 8 && mid < 60);
  assert.ok(cameraRadiusForZoom(2) < mid);
  assert.equal(cameraRadiusForZoom(99), 8);
});

test("a fresh run yields the five known contacts in listbox order, with the colony and vessel marked", () => {
  const run = createFreshGalaxyRun();
  const stars = sectorStars(run);
  assert.deepEqual(stars.map(star => star.label), ["VANGUARD", "ASHFALL", "HOSTILE PICKET", "KEPLER", "UNRESOLVED SIGNAL"]);
  const vanguard = stars.find(star => star.contactId === "contact:vanguard")!;
  const ashfall = stars.find(star => star.contactId === "contact:ashfall")!;
  const signal = stars.find(star => star.kind === "signal")!;
  assert.equal(vanguard.vessel, true);
  assert.equal(ashfall.vessel, false);
  assert.equal(ashfall.colonies, 1);
  assert.equal(vanguard.colonies, 0);
  assert.equal(signal.contactId, null);
  assert.equal(signal.knowledge, "signal");
  assert.match(signal.targetId, /^coordinate:/);
});

test("stars carry their class colour and a deterministic elevation; signals carry no class", () => {
  const stars = sectorStars(createFreshGalaxyRun());
  const byId = new Map(stars.map(star => [star.targetId, star]));
  assert.equal(byId.get("contact:vanguard")?.starClass, "F");
  assert.equal(byId.get("contact:ashfall")?.starClass, "G");
  assert.equal(byId.get("contact:hostile-picket")?.starClass, "M");
  assert.equal(byId.get("contact:kepler")?.starClass, "K");
  const signal = stars.find(star => star.knowledge === "signal")!;
  assert.equal(signal.starClass, null);
  for (const star of stars) assert.ok(star.elevation >= -1 && star.elevation <= 1, `${star.targetId} ${star.elevation}`);
  assert.deepEqual(sectorStars(createFreshGalaxyRun()).map(star => star.elevation), stars.map(star => star.elevation));
  const dense = sectorStars(fixtureRun("dense-sector"));
  const distinct = new Set(dense.map(star => star.elevation.toFixed(3)));
  assert.ok(distinct.size > dense.length * 0.6, `elevations should spread, got ${distinct.size} of ${dense.length}`);
  assert.ok(dense.some(star => star.elevation > 0.4) && dense.some(star => star.elevation < -0.4));
  // Golden values: saved sectors must not reshuffle their heights if the hash is touched.
  assert.equal(elevationForFact("contact:ashfall"), 0.179);
  assert.equal(elevationForFact("contact:vanguard"), -0.553);
  assert.equal(elevationForFact("signal:0001"), 0.768);
});

test("a route plan becomes planned legs coloured by the overall band; a blind target is exposed", () => {
  const run = createFreshGalaxyRun();
  const result = planRoute(run, { kind: "contact", contactId: "contact:ashfall" });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const model = buildSectorModel(run, { kind: "contact", contactId: "contact:ashfall" }, result.plan);
  assert.ok(model.route);
  assert.equal(model.route.legs.length, result.plan.legs.length);
  assert.ok(model.route.legs.every(leg => leg.state === "planned" && leg.band === result.plan.threat.overall.band));
  assert.deepEqual(model.route.destination, coord(0, 0, 1024, 512));
  assert.equal(model.travel, null);
  assert.equal(model.blindTarget, null);

  const blind = buildSectorModel(run, { kind: "coordinate", coordinate: coord(0, 0, 1792, 1792) }, null);
  assert.deepEqual(blind.blindTarget, coord(0, 0, 1792, 1792));
  assert.notEqual(blind.key, model.key);
});

test("committed travel marks the active leg and keeps the vessel off every star while in transit", () => {
  const run = fixtureRun("known-route");
  const model = buildSectorModel(run, null, null);
  assert.ok(model.travel);
  assert.equal(model.travel.legs[model.travel.nextLegIndex]?.state, "active");
  assert.ok(model.travel.legs.slice(0, model.travel.nextLegIndex).every(leg => leg.state === "done"));
  assert.ok(model.travel.legs.slice(model.travel.nextLegIndex + 1).every(leg => leg.state === "pending"));
  if (run.vessel.status === "in_transit") assert.ok(model.stars.every(star => !star.vessel));
});

test("highest band ranks severe over unknown and treats unknown as the floor", () => {
  assert.equal(highestBand([]), "unknown");
  assert.equal(highestBand(["unknown", "low"]), "low");
  assert.equal(highestBand(["moderate", "severe", "high"]), "severe");
});

test("the dense sector fixture adds dozens of deterministic procedural contacts without new authored anchors", () => {
  const first = fixtureRun("dense-sector");
  const second = fixtureRun("dense-sector");
  const stars = sectorStars(first);
  assert.ok(stars.length >= 20, `expected a dense sector, got ${stars.length}`);
  assert.deepEqual(sectorStars(second).map(star => star.targetId), stars.map(star => star.targetId));
  assert.equal(first.identity.authoredAnchorRegistryVersion, createFreshGalaxyRun().identity.authoredAnchorRegistryVersion);
  const procedural = stars.filter(star => star.factId.startsWith("procedural:"));
  assert.ok(procedural.length >= 15);
  assert.ok(procedural.every(star => /^CONTACT \d\d-\d\d$/.test(star.label)), procedural[0]?.label);
  assert.ok(stars.some(star => star.kind === "signal" && star.factId.startsWith("procedural:")));
});

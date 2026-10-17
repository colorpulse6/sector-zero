import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STAR_SYSTEMS,
  homeSystem,
  neighboursOf,
  planetScenePosition,
  systemForPlanet,
  systemLabel,
} from "../../app/components/galaxy/system/starSystems";
import { PLANET_DEFS as PLANETS } from "../../app/components/engine/planets";

test("every catalogue planet belongs to exactly one system and the home holds Ashfall", () => {
  const assigned = STAR_SYSTEMS.flatMap(system => system.planets.map(planet => planet.planetId));
  assert.equal(assigned.length, PLANETS.length);
  assert.equal(new Set(assigned).size, PLANETS.length);
  for (const planet of PLANETS) assert.ok(assigned.includes(planet.id), planet.id);
  assert.equal(homeSystem().id, systemForPlanet("ashfall").id);
  assert.equal(STAR_SYSTEMS.filter(system => system.knowledge === "home").length, 1);
});

test("system catalogue is deterministic and keeps orbits inside the scene budget", () => {
  for (const system of STAR_SYSTEMS) {
    for (const planet of system.planets) {
      assert.ok(planet.orbitRadius >= 1.0 && planet.orbitRadius <= 4.5, `${planet.planetId} orbit ${planet.orbitRadius}`);
      assert.ok(planet.radius >= 0.12 && planet.radius <= 0.32, `${planet.planetId} radius ${planet.radius}`);
      assert.ok(planet.orbitPeriod > 0);
    }
    const radii = system.planets.map(planet => planet.orbitRadius);
    assert.deepEqual(radii, [...radii].sort((a, b) => a - b), `${system.id} orbits ascend`);
  }
  const again = STAR_SYSTEMS.map(system => JSON.stringify(system));
  assert.deepEqual(again, STAR_SYSTEMS.map(system => JSON.stringify(system)));
});

test("neighbours sort nearest first with positive distances and stable bearings", () => {
  const neighbours = neighboursOf(homeSystem().id);
  assert.equal(neighbours.length, STAR_SYSTEMS.length - 1);
  for (let i = 1; i < neighbours.length; i++) assert.ok(neighbours[i - 1].distanceUnits <= neighbours[i].distanceUnits);
  for (const neighbour of neighbours) {
    assert.ok(neighbour.distanceUnits > 0);
    assert.ok(Number.isFinite(neighbour.bearing));
  }
  assert.deepEqual(neighboursOf("system:nowhere"), []);
});

test("signal-only systems never disclose their name", () => {
  const signal = STAR_SYSTEMS.find(system => system.knowledge === "signal")!;
  assert.equal(systemLabel(signal), "UNKNOWN SYSTEM");
  assert.notEqual(systemLabel(homeSystem()), "UNKNOWN SYSTEM");
});

test("orbital positions stay on their radius and advance with cycles", () => {
  const planet = homeSystem().planets[0];
  const start = planetScenePosition(planet, 0, 0);
  const later = planetScenePosition(planet, planet.orbitPeriod / 4, 0);
  assert.ok(Math.abs(Math.hypot(start.x, start.z) - planet.orbitRadius) < 1e-9);
  assert.ok(Math.abs(Math.hypot(later.x, later.z) - planet.orbitRadius) < 1e-9);
  assert.ok(Math.hypot(later.x - start.x, later.z - start.z) > 0.1);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { createFreshGalaxyRun } from "../../app/components/engine/galaxy/galaxyRun";
import { migrateSave } from "../../app/components/engine/save";
import { applyGalaxyFixture, findGalaxyFixture } from "../../app/components/galaxy/devFixtures";
import {
  contactIdForPlanet,
  fallbackContactLabel,
  starSystemForContact,
  systemCatalogueForRun,
  systemKnowledgeFor,
} from "../../app/components/galaxy/system/contactSystems";
import { homeSystem, neighboursOf, systemLabel } from "../../app/components/galaxy/system/starSystems";

test("a fresh run binds the four anchors and the signal into a catalogue with the vessel's system as home", () => {
  const run = createFreshGalaxyRun();
  const catalogue = systemCatalogueForRun(run);
  assert.equal(catalogue.systems.length, 5);
  assert.equal(catalogue.homeId, "contact:vanguard");
  assert.equal(homeSystem(catalogue).name, "Vanguard");
  const ashfall = catalogue.systems.find(system => system.id === "contact:ashfall")!;
  assert.deepEqual(ashfall.planets.map(planet => planet.planetId), ["ashfall", "pyraxis", "ossuary"]);
  assert.equal(ashfall.starClass, "G");
  assert.equal(ashfall.knowledge, "charted");
  const signal = catalogue.systems.find(system => system.knowledge === "signal")!;
  assert.equal(signal.planets.length, 0);
  assert.equal(systemLabel(signal), "UNKNOWN SYSTEM");
  const neighbours = neighboursOf("contact:vanguard", catalogue);
  assert.equal(neighbours.length, 4);
  assert.equal(neighbours[0].system.id, "contact:ashfall");
});

test("planets map back to their authored contact; procedural-only worlds have none", () => {
  assert.equal(contactIdForPlanet("ashfall"), "contact:ashfall");
  assert.equal(contactIdForPlanet("glaciem"), "contact:hostile-picket");
  assert.equal(contactIdForPlanet("bastion"), "contact:vanguard");
  assert.equal(contactIdForPlanet("abyssia"), null);
});

test("procedural ids read as sector designations whatever prefix they carry", () => {
  const key = '["sector-zero-g0",1,1,0,0,7,3]';
  assert.equal(fallbackContactLabel(`procedural:${key}`), "CONTACT 07-03");
  assert.equal(fallbackContactLabel(`contact:procedural:${key}`), "CONTACT 07-03");
  assert.equal(fallbackContactLabel("contact:hostile-picket"), "HOSTILE PICKET");
});

test("system fog follows contact knowledge and the vessel's position", () => {
  assert.equal(systemKnowledgeFor("visited", true), "home");
  assert.equal(systemKnowledgeFor("visited", false), "charted");
  assert.equal(systemKnowledgeFor("charted", false), "charted");
  assert.equal(systemKnowledgeFor("signal", false), "signal");
  assert.equal(systemKnowledgeFor("unknown", false), null);
  assert.equal(systemKnowledgeFor("lost_contact", true), null);
});

test("procedural stellar contacts become seeded systems with stable classes and placeholder worlds", () => {
  const fixture = findGalaxyFixture("dense-sector")!;
  const run = applyGalaxyFixture(migrateSave({}), fixture).galaxyRun!;
  const catalogue = systemCatalogueForRun(run);
  assert.ok(catalogue.systems.length >= 20);
  const procedural = catalogue.systems.filter(system => system.id.startsWith("contact:procedural:"));
  assert.ok(procedural.length >= 15);
  for (const system of procedural) {
    assert.match(system.name, /^Contact \d\d-\d\d$/);
    assert.ok(system.planets.length >= 1 && system.planets.length <= 2);
    assert.equal(system.knowledge, "charted");
    const again = starSystemForContact(run, system.id)!;
    assert.deepEqual(again, system);
  }
  assert.equal(catalogue.homeId, "contact:vanguard");
  // Fog: every system known only as a signal carries no worlds.
  const signals = catalogue.systems.filter(system => system.knowledge === "signal");
  assert.ok(signals.length >= 1);
  assert.ok(signals.every(system => system.planets.length === 0));
});

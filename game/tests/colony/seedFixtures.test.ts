// OW-0: dev fixtures cover colony STAGES (grown / strained), not just times of day.

import { test } from "node:test";
import assert from "node:assert/strict";
import { COLONY_FIXTURES, findFixture, applyColonyFixture } from "../../app/components/colony/dev/seedColony";
import { runStandardInvariants } from "../../app/components/colony/shared/colonyAssert";
import {
  assignSlots,
  generateExteriorState,
} from "../../app/components/colony/exploration/colonyLayout";
import { BUILDING_FOOTPRINTS } from "../../app/components/colony/exploration/buildingTiles";
import { OUTPOST_TEMPLATE } from "../../app/components/colony/exploration/outpostTemplate";
import {
  enterColonyExploration,
  stepColonyExploration,
} from "../../app/components/colony/exploration";
import { makeTestSave } from "./fixtures";
import { migrateSave } from "../../app/components/engine/save";
import { SPRITES } from "../../app/components/engine/sprites";
import { bootstrapColonyEvent } from "../../app/components/colony/meta/ColoniesScreen";
import { colonyReducer } from "../../app/components/colony/shared/colonyReducer";
import type {
  BuildingInstanceId,
  ColonyId,
  ColonyState,
} from "../../app/components/colony/shared/colonyTypes";

function assignedDoor(
  colony: ColonyState,
  buildingId: BuildingInstanceId,
): { x: number; y: number } {
  const slotId = assignSlots(colony).get(buildingId);
  assert.notEqual(slotId, undefined, `${buildingId} must have an assigned exterior slot`);
  const slot = OUTPOST_TEMPLATE.slots[slotId!];
  const building = colony.buildings.find(candidate => candidate.id === buildingId)!;
  const footprint = BUILDING_FOOTPRINTS[building.type]!;
  return {
    x: footprint.doorSide === "east" ? slot.anchorX + footprint.w - 1
      : footprint.doorSide === "west" ? slot.anchorX
      : slot.anchorX + Math.floor(footprint.w / 2),
    y: footprint.doorSide === "south" ? slot.anchorY + footprint.h - 1
      : footprint.doorSide === "north" ? slot.anchorY
      : slot.anchorY + Math.floor(footprint.h / 2),
  };
}

test("fixture roster: original three retained, grown + strained added", () => {
  const ids = COLONY_FIXTURES.map(f => f.id);
  for (const id of ["day", "night", "build", "grown", "strained", "region", "cantina"]) {
    assert.ok(ids.includes(id), `missing fixture ${id}`);
  }
});

test("CANTINA fixture is discoverable with the exact generic registry contract", () => {
  assert.deepEqual(findFixture("cantina"), {
    id: "cantina",
    label: "SEED CANTINA",
    buildings: [
      { type: "solar_array", operational: true },
      { type: "farm", operational: true },
      { type: "water_purifier", operational: true },
      { type: "habitat_module", operational: true },
      { type: "cantina", operational: true },
    ],
    hour: 17,
    layoutSeed: 1337,
    playerCredits: 5,
  });
});

test("CANTINA fixture overrides player credits while fixtures without an override preserve them", () => {
  const incoming = makeTestSave({ credits: 77 });
  const cantina = applyColonyFixture(incoming, findFixture("cantina")!).save;
  const day = applyColonyFixture(incoming, findFixture("day")!).save;
  assert.equal(cantina.credits, 5);
  assert.equal(day.credits, 77);
});

test("CANTINA fixture renders its real operational facade and accessible exterior door", () => {
  const { save, colonyId } = applyColonyFixture(makeTestSave(), findFixture("cantina")!);
  const colony = save.colonies.find(candidate => candidate.id === colonyId)!;
  assert.deepEqual(
    colony.buildings.map(building => ({ type: building.type, status: building.status })),
    [
      { type: "solar_array", status: "operational" },
      { type: "farm", status: "operational" },
      { type: "water_purifier", status: "operational" },
      { type: "habitat_module", status: "operational" },
      { type: "cantina", status: "operational" },
    ],
  );

  const cantina = colony.buildings.find(building => building.type === "cantina")!;
  const slotId = assignSlots(colony).get(cantina.id);
  assert.notEqual(slotId, undefined, "Cantina must be within the first six assigned exterior slots");
  assert.equal(assignSlots(colony).size, 5);

  const exterior = generateExteriorState(colony, save.gameClock);
  const slot = OUTPOST_TEMPLATE.slots[slotId!];
  const footprint = BUILDING_FOOTPRINTS.cantina!;
  const door = assignedDoor(colony, cantina.id);
  let facadeWalls = 0;
  for (let y = slot.anchorY; y < slot.anchorY + footprint.h; y++) {
    for (let x = slot.anchorX; x < slot.anchorX + footprint.w; x++) {
      if (exterior.map.wallTextureMap?.[y][x] === SPRITES.COLONY_WALL_CANTINA) facadeWalls++;
    }
  }
  assert.equal(facadeWalls, 11, "4x4 Cantina perimeter has 11 facade walls plus its carved door");
  assert.equal(exterior.map.tiles[door.y][door.x], "door");
  assert.deepEqual(
    exterior.colonyContext!.onDoorInteract({ x: door.x, y: door.y + 1 }, door),
    { kind: "enter_interior", buildingId: cantina.id },
  );
});

test("CANTINA fixture enters through the transition seam with all period-0 roles", () => {
  const { save, colonyId } = applyColonyFixture(makeTestSave(), findFixture("cantina")!);
  const colony = save.colonies.find(candidate => candidate.id === colonyId)!;
  const cantina = colony.buildings.find(building => building.type === "cantina")!;
  const door = assignedDoor(colony, cantina.id);
  const entered = enterColonyExploration(save, colonyId as ColonyId);
  const request = entered.sceneStack.current.state.colonyContext!.onDoorInteract(
    { x: door.x, y: door.y + 1 },
    door,
  );
  assert.deepEqual(request, { kind: "enter_interior", buildingId: cantina.id });
  entered.sceneStack.current.state.colonyTransitionRequest = request;

  const interior = stepColonyExploration(entered.sceneStack, save, 0);
  assert.equal(interior.current.kind, "interior");
  assert.equal(interior.current.buildingId, cantina.id);
  assert.deepEqual(
    interior.current.state.npcs.map(npc => ({ id: npc.id, x: npc.x, y: npc.y, name: npc.name })),
    [
      { id: 1, x: 3.5, y: 2.5, name: "BARTENDER" },
      { id: 2, x: 4.5, y: 6.5, name: "REGULAR" },
      { id: 3, x: 9.5, y: 5.5, name: "SIGNAL CHASER" },
    ],
  );
});

test("bootstrap grants no resources", () => {
  const fresh = migrateSave({});
  const founded = colonyReducer(fresh, bootstrapColonyEvent(fresh));
  assert.deepEqual(founded.colonies[0].resources, { food: 0, water: 0, metal: 0, credits: 0 });
});

test("REGION fixture provides deterministic affordable M1 state", () => {
  const fx = findFixture("region")!;
  const first = applyColonyFixture(migrateSave({}), fx).save;
  const second = applyColonyFixture(migrateSave({}), fx).save;
  assert.deepEqual(first, second);
  const colony = first.colonies.find(c => c.id === "fx_region")!;
  assert.deepEqual(colony.resources, { food: 250, water: 250, metal: 600, credits: 0 });
  const nodes = new Map(first.planets[0].regionMap.nodes.map(n => [n.id, n.intel]));
  assert.equal(nodes.get("ashfall-cinder-relay"), "surveyed");
  assert.equal(nodes.get("ashfall-oathbreaker-wreck"), "surveyed");
  assert.equal(nodes.get("ashfall-glassknife-canyon"), "rumored");
  assert.equal(nodes.get("ashfall-basalt-basin"), "surveyed");
});

test("every fixture applies cleanly and yields an invariant-clean colony", () => {
  for (const fx of COLONY_FIXTURES) {
    const { save, colonyId } = applyColonyFixture(makeTestSave(), fx);
    const colony = save.colonies.find(c => c.id === colonyId);
    assert.ok(colony, `${fx.id}: colony not created`);
    runStandardInvariants(colony!);
    assert.equal(save.gameClock.hour, fx.hour, `${fx.id}: gameClock hour applied`);
    // Every fixture must also survive FP exterior generation (DevPanel descends immediately)
    const state = generateExteriorState(colony!, save.gameClock);
    assert.ok(state.map.tiles.length > 0, `${fx.id}: exterior generation failed`);
  }
});

test("GROWN: all 5 building types operational (incl. mine), pop 20 at capacity 20, healthy", () => {
  const fx = findFixture("grown")!;
  const { save, colonyId } = applyColonyFixture(makeTestSave(), fx);
  const colony = save.colonies.find(c => c.id === colonyId)!;

  const operationalTypes = new Set(
    colony.buildings.filter(b => b.status === "operational").map(b => b.type),
  );
  for (const t of ["solar_array", "farm", "water_purifier", "habitat_module", "mine"] as const) {
    assert.ok(operationalTypes.has(t), `grown: ${t} should be operational`);
  }
  assert.equal(colony.population.total, 20);
  assert.equal(colony.population.capacity, 20, "2 operational habitats → capacity 20");
  assert.ok(colony.happiness > 60, `grown colony should be happy, got ${colony.happiness}`);
  assert.ok(colony.resources.food >= 100, "healthy food stockpile");
  assert.ok(colony.resources.water >= 100, "healthy water stockpile");
});

test("STRAINED: operational buildings but starving — pop 12, happiness ~30, food/water near zero", () => {
  const fx = findFixture("strained")!;
  const { save, colonyId } = applyColonyFixture(makeTestSave(), fx);
  const colony = save.colonies.find(c => c.id === colonyId)!;

  assert.ok(colony.buildings.every(b => b.status === "operational"), "all strained buildings operational");
  assert.equal(colony.population.total, 12);
  assert.equal(colony.happiness, 30);
  assert.ok(colony.resources.food <= 5, `food near zero, got ${colony.resources.food}`);
  assert.ok(colony.resources.water <= 5, `water near zero, got ${colony.resources.water}`);
});

test("fixtures are idempotent: reseeding the same fixture keeps one colony", () => {
  const fx = findFixture("grown")!;
  let { save } = applyColonyFixture(makeTestSave(), fx);
  ({ save } = applyColonyFixture(save, fx));
  assert.equal(save.colonies.filter(c => c.id === "fx_grown").length, 1);
});

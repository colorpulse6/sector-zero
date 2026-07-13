// OW-0: completing a planet mission delivers a resource payload to a colony.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MISSION_DELIVERY_REASON,
  deliveryPayloadForPlanet,
  resolveDeliveryColony,
  resolveMissionDelivery,
  missionDeliveryEvent,
  applyMissionDelivery,
  deliveryPayloadLabel,
} from "../../app/components/colony/shared/missionDelivery";
import { PLANET_DEFS } from "../../app/components/engine/planets";
import { makeTestColony, makeTestSave } from "./fixtures";

test("payload table sanity: every planet ships at least the 60-metal base, all values positive", () => {
  for (const def of PLANET_DEFS) {
    const payload = deliveryPayloadForPlanet(def.id);
    assert.ok((payload.metal ?? 0) >= 60, `${def.id}: metal base missing, got ${payload.metal}`);
    for (const [k, v] of Object.entries(payload)) {
      assert.ok((v ?? 0) > 0, `${def.id}: non-positive payload entry ${k}=${v}`);
    }
  }
});

test("payload biome flavor: ashfall metal-rich, verdania ships food, glaciem/abyssia ship water", () => {
  assert.equal(deliveryPayloadForPlanet("ashfall").metal, 80);        // 60 base + 20 desert
  assert.equal(deliveryPayloadForPlanet("verdania").food, 30);        // jungle
  assert.equal(deliveryPayloadForPlanet("genesis").food, 30);         // garden
  assert.equal(deliveryPayloadForPlanet("glaciem").water, 30);        // arctic
  assert.equal(deliveryPayloadForPlanet("abyssia").water, 30);        // ocean
  // Unmapped theme (ruins) → base only
  assert.deepEqual(deliveryPayloadForPlanet("ossuary"), { metal: 60 });
});

test("routing: colony on the mission planet wins", () => {
  const verdaniaColony = makeTestColony({ id: "c_verdania", name: "Canopy Base", planetId: "verdania" });
  const ashfallColony = makeTestColony({ id: "c_ashfall", name: "Ashfall Primary", planetId: "ashfall" });
  const target = resolveDeliveryColony([verdaniaColony, ashfallColony], "ashfall");
  assert.equal(target?.id, "c_ashfall");
});

test("routing: no colony on the planet → player's first colony", () => {
  const verdaniaColony = makeTestColony({ id: "c_verdania", name: "Canopy Base", planetId: "verdania" });
  const ashfallColony = makeTestColony({ id: "c_ashfall", name: "Ashfall Primary", planetId: "ashfall" });
  const target = resolveDeliveryColony([verdaniaColony, ashfallColony], "glaciem");
  assert.equal(target?.id, "c_verdania", "first colony receives when no colony is on the planet");
});

test("routing: no colonies → no delivery", () => {
  assert.equal(resolveDeliveryColony([], "ashfall"), null);
  assert.equal(resolveMissionDelivery("ashfall", []), null);
});

test("missionDeliveryEvent: resourceChanged with reason mission_delivery", () => {
  const delivery = resolveMissionDelivery("ashfall", [makeTestColony({ planetId: "ashfall" })])!;
  const event = missionDeliveryEvent(delivery);
  assert.equal(event.type, "colony/resourceChanged");
  if (event.type === "colony/resourceChanged") {
    assert.equal(event.payload.reason, MISSION_DELIVERY_REASON);
    assert.equal(event.payload.reason, "mission_delivery");
    assert.equal(event.payload.colonyId, delivery.colonyId);
    assert.deepEqual(event.payload.delta, { metal: 80 });
  }
});

test("applyMissionDelivery: payload lands in the destination colony's stockpile", () => {
  const colony = makeTestColony({
    id: "c1", name: "Ashfall Primary", planetId: "ashfall",
    resources: { food: 10, water: 10, metal: 100, credits: 0 },
  });
  const save = makeTestSave({ colonies: [colony] });
  const { save: after, delivery } = applyMissionDelivery(save, "ashfall");
  assert.ok(delivery);
  assert.equal(delivery!.colonyId, "c1");
  assert.equal(after.colonies[0].resources.metal, 180); // 100 + 60 base + 20 desert
  assert.equal(after.colonies[0].resources.food, 10, "untouched resources stay put");
});

test("applyMissionDelivery: food-flavored planet routes food to the first colony", () => {
  const colony = makeTestColony({
    id: "c1", name: "Ashfall Primary", planetId: "ashfall",
    resources: { food: 0, water: 0, metal: 0, credits: 0 },
  });
  const save = makeTestSave({ colonies: [colony] });
  const { save: after, delivery } = applyMissionDelivery(save, "verdania");
  assert.equal(delivery!.colonyId, "c1", "no verdania colony → first colony");
  assert.equal(after.colonies[0].resources.metal, 60);
  assert.equal(after.colonies[0].resources.food, 30);
});

test("applyMissionDelivery: no colonies is a no-op", () => {
  const save = makeTestSave();
  const { save: after, delivery } = applyMissionDelivery(save, "ashfall");
  assert.equal(delivery, null);
  assert.equal(after, save, "save object unchanged");
});

test("deliveryPayloadLabel formats nonzero entries in display order", () => {
  assert.equal(deliveryPayloadLabel({ metal: 60, food: 30 }), "+60 METAL, +30 FOOD");
  assert.equal(deliveryPayloadLabel({ metal: 80 }), "+80 METAL");
  assert.equal(deliveryPayloadLabel({ water: 30, metal: 60 }), "+60 METAL, +30 WATER");
});

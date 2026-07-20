import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BUILDING_FOOTPRINTS,
  INTERIOR_TEMPLATES,
  type InteriorNpcContentId,
} from "../../app/components/colony/exploration/buildingTiles";
import {
  INTERIOR_NPC_DEFINITIONS,
  selectCantinaRumor,
} from "../../app/components/colony/exploration/cantinaContent";
import { generateInteriorState } from "../../app/components/colony/exploration/colonyLayout";
import {
  generateInteriorNpcs,
  resolveInteriorSchedule,
} from "../../app/components/colony/exploration/interiorNpcs";
import { OUTPOST_TEMPLATE } from "../../app/components/colony/exploration/outpostTemplate";
import { SPRITES } from "../../app/components/engine/sprites";
import { buildServiceShopItem } from "../../app/components/engine/shopServices";
import { makeBuilding } from "./fixtures";

const CANTINA_ROWS = [
  "############",
  "#.B..#.....#",
  "#....#.....#",
  "#...C......#",
  "#..........#",
  "#..T....R..#",
  "#..........#",
  "#..........#",
  "#..........#",
  "#####D######",
];

const RUMOR_POOLS = {
  "hub-regular": [
    "A convoy saw lights moving under the western glass.",
    "The old relay wakes just before the dust turns.",
    "Long-range static has been spelling out colony call signs.",
  ],
  "hub-signal-chaser": [
    "I caught our colony beacon echoing from below the ridge.",
    "Someone is stepping on the emergency band every sixth pulse.",
    "The rumor terminal logs a carrier wave no relay admits sending.",
  ],
} as const;

test("Cantina footprint is a south-doored 4x4 facade that fits every Outpost slot", () => {
  const footprint = BUILDING_FOOTPRINTS.cantina;
  assert.ok(footprint, "Cantina footprint must be registered");
  assert.equal(footprint.w, 4);
  assert.equal(footprint.h, 4);
  assert.equal(footprint.doorSide, "south");
  assert.equal(footprint.wallSpriteId, SPRITES.COLONY_WALL_CANTINA);

  for (const slot of OUTPOST_TEMPLATE.slots) {
    assert.ok(footprint.w <= slot.maxFootprint.w);
    assert.ok(footprint.h <= slot.maxFootprint.h);
  }
});

test("Cantina template has the exact authored 12x10 room, exit, and spawn", () => {
  const footprint = BUILDING_FOOTPRINTS.cantina;
  assert.ok(footprint);
  const template = INTERIOR_TEMPLATES[footprint.interiorTemplateId];
  assert.ok(template, "Cantina interior template must be registered");

  assert.equal(template.width, 12);
  assert.equal(template.height, 10);
  assert.deepEqual(template.tiles, CANTINA_ROWS);
  assert.equal(template.tiles.length, 10);
  assert.ok(template.tiles.every((row) => row.length === 12));

  const doors = template.tiles.flatMap((row, y) =>
    [...row].flatMap((tile, x) => tile === "D" ? [{ x, y }] : []),
  );
  assert.deepEqual(doors, [{ x: 5, y: 9 }]);
  assert.deepEqual(template.spawn, { x: 5, y: 9, facing: "north" });
});

test("Cantina props and scheduled anchors are in bounds on non-wall tiles", () => {
  const footprint = BUILDING_FOOTPRINTS.cantina!;
  const template = INTERIOR_TEMPLATES[footprint.interiorTemplateId];
  const assertWalkable = (point: { x: number; y: number }, label: string) => {
    assert.ok(point.x >= 0 && point.x < template.width, `${label}: x out of bounds`);
    assert.ok(point.y >= 0 && point.y < template.height, `${label}: y out of bounds`);
    assert.notEqual(template.tiles[point.y][point.x], "#", `${label}: placed on wall`);
  };

  template.propSlots.forEach((prop, index) => assertWalkable(prop, `prop ${index}`));
  template.npcSlots?.forEach((slot) => {
    slot.schedule.forEach((period, periodIndex) => {
      if (period.anchor) assertWalkable(period.anchor, `${slot.contentId} period ${periodIndex}`);
    });
  });
});

test("Cantina template selects its reviewed environment art and exact prop scales", () => {
  const footprint = BUILDING_FOOTPRINTS.cantina!;
  const template = INTERIOR_TEMPLATES[footprint.interiorTemplateId];
  assert.equal(template.environmentArt?.skySpriteId, undefined);
  assert.deepEqual(template.environmentArt, {
    wallSpriteId: SPRITES.HUB_CANTINA_WALL,
    floorSpriteId: SPRITES.HUB_CANTINA_FLOOR,
    ceilingSpriteId: SPRITES.HUB_CANTINA_CEILING,
  });
  assert.deepEqual(template.propSlots, [
    { x: 2, y: 1, spriteId: SPRITES.HUB_CANTINA_PROP_BOTTLE_RACK, scale: 1.0 },
    { x: 4, y: 3, spriteId: SPRITES.HUB_CANTINA_PROP_BAR_COUNTER, scale: 1.4 },
    { x: 3, y: 5, spriteId: SPRITES.HUB_CANTINA_PROP_TABLE_CLUSTER, scale: 1.2 },
    { x: 8, y: 5, spriteId: SPRITES.HUB_CANTINA_PROP_RUMOR_TERMINAL, scale: 1.0 },
  ]);
});

test("two-period schedules use inclusive 06:00 and 18:00 boundaries with midnight wrap", () => {
  const slots = INTERIOR_TEMPLATES[BUILDING_FOOTPRINTS.cantina!.interiorTemplateId].npcSlots!;
  const expected = [
    { hour: 5, periodIndex: 1, anchors: [{ x: 3, y: 1 }, { x: 6, y: 4 }, null] },
    { hour: 6, periodIndex: 0, anchors: [{ x: 3, y: 2 }, { x: 4, y: 6 }, { x: 9, y: 5 }] },
    { hour: 17, periodIndex: 0, anchors: [{ x: 3, y: 2 }, { x: 4, y: 6 }, { x: 9, y: 5 }] },
    { hour: 18, periodIndex: 1, anchors: [{ x: 3, y: 1 }, { x: 6, y: 4 }, null] },
  ] as const;

  for (const sample of expected) {
    slots.forEach((slot, index) => {
      assert.deepEqual(resolveInteriorSchedule(slot.schedule, sample.hour), {
        periodIndex: sample.periodIndex,
        anchor: sample.anchors[index],
      });
    });
  }

  assert.equal(resolveInteriorSchedule(slots[0].schedule, 30).periodIndex, 0);
  assert.equal(resolveInteriorSchedule(slots[0].schedule, -6).periodIndex, 1);
});

test("scheduled projection preserves authored slot IDs when an absent role is filtered", () => {
  const slots = INTERIOR_TEMPLATES[BUILDING_FOOTPRINTS.cantina!.interiorTemplateId].npcSlots!;

  assert.deepEqual(
    generateInteriorNpcs(slots, 17, 1337).map(({ id, x, y, name }) => ({ id, x, y, name })),
    [
      { id: 1, x: 3.5, y: 2.5, name: "BARTENDER" },
      { id: 2, x: 4.5, y: 6.5, name: "REGULAR" },
      { id: 3, x: 9.5, y: 5.5, name: "SIGNAL CHASER" },
    ],
  );
  assert.deepEqual(
    generateInteriorNpcs(slots, 18, 1337).map(({ id, x, y, name }) => ({ id, x, y, name })),
    [
      { id: 1, x: 3.5, y: 1.5, name: "BARTENDER" },
      { id: 2, x: 6.5, y: 4.5, name: "REGULAR" },
    ],
  );
});

test("Cantina content definitions exhaustively project identities, portraits, and House Pour", () => {
  const expected = {
    "hub-bartender": {
      name: "BARTENDER",
      type: "merchant",
      spriteId: SPRITES.NPC_HUB_BARTENDER,
      portraitKey: "PORTRAIT_HUB_BARTENDER",
      color: "#ffaa44",
      canBuy: true,
    },
    "hub-regular": {
      name: "REGULAR",
      type: "lore",
      spriteId: SPRITES.NPC_HUB_REGULAR,
      portraitKey: "PORTRAIT_HUB_REGULAR",
      color: "#66ccff",
      canBuy: undefined,
    },
    "hub-signal-chaser": {
      name: "SIGNAL CHASER",
      type: "lore",
      spriteId: SPRITES.NPC_HUB_SIGNAL_CHASER,
      portraitKey: "PORTRAIT_HUB_SIGNAL_CHASER",
      color: "#cc88ff",
      canBuy: undefined,
    },
  } as const;
  const contentIds = Object.keys(expected) as InteriorNpcContentId[];

  assert.deepEqual(Object.keys(INTERIOR_NPC_DEFINITIONS), contentIds);
  for (const contentId of contentIds) {
    const definition = INTERIOR_NPC_DEFINITIONS[contentId];
    assert.equal(definition.roleId, contentId);
    for (const [key, value] of Object.entries(expected[contentId])) {
      assert.equal(definition[key as keyof typeof definition], value, `${contentId}: ${key}`);
    }
  }

  const bartender = INTERIOR_NPC_DEFINITIONS["hub-bartender"];
  assert.deepEqual(bartender.buildDialog({ seed: 1337, periodIndex: 0 }), [{
    speaker: "BARTENDER",
    text: "House pour is five credits. Rumors come free.",
  }]);
  assert.deepEqual(bartender.buildShopItems?.({ seed: 1337, periodIndex: 0 }), [
    buildServiceShopItem("cantina-house-pour"),
  ]);

  const slots = INTERIOR_TEMPLATES[BUILDING_FOOTPRINTS.cantina!.interiorTemplateId].npcSlots!;
  for (const npc of generateInteriorNpcs(slots, 17, 1337)) {
    const definition = INTERIOR_NPC_DEFINITIONS[slots[npc.id - 1].contentId];
    assert.ok(npc.dialog.length > 0);
    assert.ok(npc.dialog.every((line) => line.portraitKey === definition.portraitKey));
    assert.equal(npc.sprite, definition.spriteId);
    assert.equal(npc.color, definition.color);
    assert.equal(npc.type, definition.type);
    assert.equal(npc.canBuy, definition.canBuy);
  }
});

test("authored rumor selection is stable, pool-bounded, and independent of randomness or clock", () => {
  const originalRandom = Math.random;
  const originalDateNow = Date.now;
  Math.random = () => { throw new Error("rumor selection must not use Math.random"); };
  Date.now = () => { throw new Error("rumor selection must not use the clock"); };

  try {
    for (const roleId of ["hub-regular", "hub-signal-chaser"] as const) {
      for (const periodIndex of [0, 1] as const) {
        const context = { seed: 0x5eed1234, periodIndex };
        const first = selectCantinaRumor(roleId, context);
        const second = selectCantinaRumor(roleId, context);
        assert.equal(first, second);
        assert.ok((RUMOR_POOLS[roleId] as readonly string[]).includes(first));
      }
    }
  } finally {
    Math.random = originalRandom;
    Date.now = originalDateNow;
  }
});

test("repeated Cantina generation deep-equals NPC identities, positions, and dialog", () => {
  const building = makeBuilding("cantina");
  const first = generateInteriorState(building, 1337, 17);
  const second = generateInteriorState(building, 1337, 17);
  assert.deepEqual(first.npcs, second.npcs);

  assert.equal(first.environmentArt?.wallSprite, SPRITES.HUB_CANTINA_WALL);
  assert.equal(first.environmentArt?.floorSprite, SPRITES.HUB_CANTINA_FLOOR);
  assert.equal(first.environmentArt?.ceilingSprite, SPRITES.HUB_CANTINA_CEILING);
  assert.equal(first.environmentArt?.skySprite, undefined);
  assert.ok(first.map.floorTextureMap?.every((row) =>
    row.every((sprite) => sprite === SPRITES.HUB_CANTINA_FLOOR),
  ));
});

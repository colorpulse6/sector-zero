import { test } from "node:test";
import assert from "node:assert/strict";
import {
  updateFirstPerson,
  __runFirstPersonSelfTests,
} from "../../app/components/engine/firstPersonEngine";
import type {
  BoardingMap,
  FPServiceId,
  FPShopPurchaseRequest,
  FirstPersonState,
  Keys,
  SaveData,
} from "../../app/components/engine/types";
import { AudioEvent } from "../../app/components/engine/types";
import type { FactionRank } from "../../app/components/colony/shared/factionLedger";
import { NPC_SPRITE_MAP, resolveNpcSprite } from "../../app/components/engine/fpRender/sceneInput";
import { SPRITES } from "../../app/components/engine/sprites";
import { applyShopPurchase } from "../../app/components/engine/consumables";
import { createAshfallForwardCampState } from "../../app/components/engine/ashfallForwardCamp";
import {
  drainShopPurchaseRequest,
  shopPurchaseFeedback,
} from "../../app/components/engine/shopServices";

// ─── Fixtures ────────────────────────────────────────────────────────
// Task 6: frame-rate-independent movement. These tests pin the delta-time
// contract: dtF = min(dtMs / 16.67, 3), so 16.67ms → 1.0 (60fps identity).

const NO_KEYS: Keys = {
  left: false, right: false, up: false, down: false,
  strafeLeft: false, strafeRight: false,
  shoot: false, bomb: false, jump: false,
};

function keys(overrides: Partial<Keys> = {}): Keys {
  return { ...NO_KEYS, ...overrides };
}

const OPEN_MAP: BoardingMap = {
  width: 5,
  height: 5,
  tileSize: 32,
  tiles: [
    ["wall", "wall", "wall", "wall", "wall"],
    ["wall", "floor", "floor", "floor", "wall"],
    ["wall", "floor", "floor", "floor", "wall"],
    ["wall", "floor", "floor", "floor", "wall"],
    ["wall", "wall", "wall", "wall", "wall"],
  ],
};

// Minimal combat FP GameState facing +X (dirX=1) at the center of open space.
function makeFpGame(fpOverrides: Record<string, unknown> = {}) {
  const fp = {
    map: OPEN_MAP,
    posX: 2.5, posY: 2.5,
    dirX: 1, dirY: 0, planeX: 0, planeY: 0.66,
    moveSpeed: 0.06, rotSpeed: 0.04,
    goalReached: false,
    enemies: [] as unknown[],
    gunFireTimer: 0, gunCooldown: 0,
    npcs: [], dialogState: null,
    ...fpOverrides,
  };
  const game = {
    firstPersonState: fp,
    levelCompleteTimer: 0,
    player: { invincibleTimer: 0, bankDir: 0, hp: 10, maxHp: 10 },
    lives: 3, deaths: 0, score: 0, xp: 0, kills: 0,
    screenShake: 0,
    equippedWeaponType: "kinetic",
    allocatedSkills: [],
    floatingLabels: [],
    audioEvents: [],
  };
  // Loosely typed on purpose: updateFirstPerson only touches the fields above.
  return { game: game as never, fp };
}

// ─── Tests ───────────────────────────────────────────────────────────

test("dt: two half-steps travel the same distance as one full step (±1e-9)", () => {
  const HALF = 16.67 / 2;

  const full = makeFpGame();
  updateFirstPerson(full.game, keys({ up: true }), 16.67);
  const distFull = full.fp.posX - 2.5;

  const halved = makeFpGame();
  updateFirstPerson(halved.game, keys({ up: true }), HALF);
  updateFirstPerson(halved.game, keys({ up: true }), HALF);
  const distHalf = halved.fp.posX - 2.5;

  assert.ok(distFull > 0, "full step should move forward");
  assert.ok(Math.abs(distFull - distHalf) < 1e-9,
    `half-steps ${distHalf} must equal full step ${distFull}`);
});

test("dt: a huge dtMs clamps to 3 frames of movement (not 12)", () => {
  const single = makeFpGame();
  updateFirstPerson(single.game, keys({ up: true }), 16.67);
  const distSingle = single.fp.posX - 2.5;

  const clamped = makeFpGame();
  updateFirstPerson(clamped.game, keys({ up: true }), 200); // 200/16.67 ≈ 12 → clamp 3
  const distClamped = clamped.fp.posX - 2.5;

  assert.ok(Math.abs(distClamped - distSingle * 3) < 1e-9,
    `dtMs=200 should move 3× a single step, got ${distClamped / distSingle}×`);
  assert.ok(distClamped < distSingle * 12 - 1e-9, "must NOT move 12 frames' worth");
});

test("dt: a cooldown that overshoots 0 under dtF=3 still fires at the <=0 window", () => {
  // gunCooldown 2, dtF=3 → 2 - 3 = -1 (floored to 0) → <= 0 → fire.
  const firing = makeFpGame({ gunCooldown: 2 });
  updateFirstPerson(firing.game, keys({ shoot: true }), 200);
  assert.ok(firing.fp.gunFireTimer > 0, "cooldown should fire when it reaches the <=0 window");

  // Control: a cooldown still above 0 after one 60fps step must NOT fire.
  const cooling = makeFpGame({ gunCooldown: 10 });
  updateFirstPerson(cooling.game, keys({ shoot: true }), 16.67); // 10 - 1 = 9 > 0
  assert.equal(cooling.fp.gunFireTimer, 0, "still-cooling gun must not fire");
});

test("dt: a dying enemy reaches the -1 sentinel and is removed under dtF=3", () => {
  const dyingEnemy = {
    id: 1, x: 3.5, y: 2.5, hp: 0, maxHp: 3, speed: 0.015,
    type: "grunt", aggroRange: 6, isAggro: false, deathTimer: 30,
    fireTimer: 0, classId: "swarm",
  };
  const dying = makeFpGame({ enemies: [dyingEnemy] });

  // deathTimer 30 at dtF=3 → -3/frame → hits <=0 after 10 frames, becomes -1,
  // then the `!== -1` filter removes it. If deathTimer were (wrongly) clamped at
  // 0 it would park at the "alive" value and never be removed — this would hang
  // until the guard and fail the length assertion.
  let guard = 0;
  while ((dying.fp.enemies as unknown[]).length > 0 && guard++ < 40) {
    updateFirstPerson(dying.game, NO_KEYS, 200);
  }
  assert.equal((dying.fp.enemies as unknown[]).length, 0,
    "dying enemy must transition to -1 and be filtered out");
  assert.ok(guard <= 12, `should remove within ~10 frames at dtF=3, took ${guard}`);
});

// ─── Input → rotation direction ──────────────────────────────────────
// Regression guard for the long-standing inverted-turn bug: the self-test
// verifies rotateView() in isolation, but nothing exercised the
// keys.left/right → sign mapping in updateFirstPerson, where the signs were
// swapped. Facing +X (east), the player's LEFT is -Y (north) — confirmed by
// strafe-left moving -Y and by rotateView's own "Left turn → negative Y" test.

test("input: pressing left turns toward the player's left (dirY < 0 facing +X)", () => {
  const g = makeFpGame(); // dir=(1,0), facing +X
  updateFirstPerson(g.game, keys({ left: true }), 16.67);
  assert.ok(g.fp.dirY < 0,
    `left turn must rotate toward -Y (player's left); got dirY=${g.fp.dirY}`);
});

test("input: pressing right turns toward the player's right (dirY > 0 facing +X)", () => {
  const g = makeFpGame();
  updateFirstPerson(g.game, keys({ right: true }), 16.67);
  assert.ok(g.fp.dirY > 0,
    `right turn must rotate toward +Y (player's right); got dirY=${g.fp.dirY}`);
});

test("input: left and right turns are opposite and symmetric", () => {
  const l = makeFpGame();
  const r = makeFpGame();
  updateFirstPerson(l.game, keys({ left: true }), 16.67);
  updateFirstPerson(r.game, keys({ right: true }), 16.67);
  // Mirror images across the facing axis: same forward component, opposite lateral.
  assert.ok(Math.abs(l.fp.dirX - r.fp.dirX) < 1e-12, "forward components should match");
  assert.ok(Math.abs(l.fp.dirY + r.fp.dirY) < 1e-12, "lateral components should be opposite");
});

test("FP engine self-test suite passes (console.assert guard)", () => {
  // __runFirstPersonSelfTests uses console.assert (non-throwing). Patch it to
  // collect failures so the whole self-test function — including the Task 6
  // delta-time scenarios — is verified as a real pass/fail in CI.
  const original = console.assert;
  const failures: string[] = [];
  console.assert = ((cond: unknown, ...args: unknown[]) => {
    if (!cond) failures.push(args.map(String).join(" "));
  }) as typeof console.assert;
  try {
    __runFirstPersonSelfTests();
  } finally {
    console.assert = original;
  }
  assert.equal(failures.length, 0, `self-test failures: ${failures.join(" | ")}`);
});

// ─── Phase 5a §H1 — colony-mode NPC interaction ──────────────────────
// The colony-exploration hook early-returns before the generic NPC-dialog
// block, so before this task colony NPCs rendered but could never be talked to.
// These pin: colony NPCs are talkable; the colony `canFire` gate (armed +
// cooldown), NOT gunCooldown, controls it; opening disarms (close-frame
// anti-bounce); the door/pad path still resolves when no NPC is targeted; and
// the extracted helper behaves identically at the non-colony (Ashfall) site.

interface DialogShape { active: boolean; npcId: number; shopOpen: boolean }
interface TestFp {
  dialogState: DialogShape | null;
  colonyInteractArmed?: boolean;
  gunCooldown: number;
}
interface TestGame {
  player: { bankDir: number };
  audioEvents: AudioEvent[];
}
const fpOf = (g: { fp: unknown }) => g.fp as TestFp;
const gameOf = (g: { game: unknown }) => g.game as unknown as TestGame;

function makeNpc(overrides: Record<string, unknown> = {}) {
  return {
    id: 1, x: 3.5, y: 2.5, name: "Test NPC", type: "lore",
    dialog: [{ speaker: "Test", text: "Hello there." }],
    color: "#ffffff", interacted: false,
    ...overrides,
  };
}

type PadResult = { kind: "show_exit_menu" } | { kind: "not_on_pad" };
type DoorResult = { kind: "no_door" } | { kind: "enter_interior"; buildingId: string };

// Minimal ColonyContext stub — the hook only calls these two methods. Counters
// let a test assert the door/pad path still runs when no NPC is targeted.
function makeColonyContext(over: { pad?: () => PadResult; door?: () => DoorResult } = {}) {
  const calls = { pad: 0, door: 0 };
  const ctx = {
    colonyId: "test-colony",
    mode: "exterior",
    interiorBuildingId: null,
    onLandingPadInteract: (): PadResult => {
      calls.pad++;
      return over.pad ? over.pad() : { kind: "not_on_pad" };
    },
    onDoorInteract: (): DoorResult => {
      calls.door++;
      return over.door ? over.door() : { kind: "no_door" };
    },
  };
  return { ctx, calls };
}

test("colony: NPC in range + faced + armed + shoot opens dialog (early-return regression)", () => {
  const { ctx } = makeColonyContext();
  const g = makeFpGame({
    npcs: [makeNpc({ id: 7 })],
    colonyContext: ctx,
    colonyInteractArmed: true,
    colonyInteractCooldownFrames: 0,
  });
  updateFirstPerson(g.game, keys({ shoot: true }), 16.67);
  const ds = fpOf(g).dialogState;
  assert.ok(ds, "colony NPC dialog must open (the hook no longer early-returns past it)");
  assert.equal(ds!.npcId, 7, "dialog is bound to the faced NPC");
});

test("colony: NPC interaction is gated by colonyInteractArmed, not gunCooldown", () => {
  const { ctx } = makeColonyContext();
  const g = makeFpGame({
    npcs: [makeNpc({ id: 7 })],
    colonyContext: ctx,
    colonyInteractArmed: false,      // disarmed → canFire is false
    colonyInteractCooldownFrames: 0,
    gunCooldown: 0,                  // gunCooldown ready: if IT were the gate, the dialog would open
  });
  updateFirstPerson(g.game, keys({ shoot: true }), 16.67);
  assert.equal(fpOf(g).dialogState, null,
    "disarmed colony interact must not open a dialog even with gunCooldown ready");
});

test("colony: opening an NPC dialog disarms colonyInteractArmed (close-frame anti-bounce)", () => {
  const { ctx } = makeColonyContext();
  const g = makeFpGame({
    npcs: [makeNpc({ id: 7 })],
    colonyContext: ctx,
    colonyInteractArmed: true,
    colonyInteractCooldownFrames: 0,
  });
  updateFirstPerson(g.game, keys({ shoot: true }), 16.67);
  assert.ok(fpOf(g).dialogState, "sanity: dialog opened");
  assert.equal(fpOf(g).colonyInteractArmed, false,
    "opening must disarm so a held interact key can't bounce into door/pad on the close frame");
});

test("colony: with no NPC targeted, the door/pad resolution still runs", () => {
  const { ctx, calls } = makeColonyContext();
  const g = makeFpGame({
    npcs: [],                        // nothing to target
    colonyContext: ctx,
    colonyInteractArmed: true,
    colonyInteractCooldownFrames: 0,
  });
  updateFirstPerson(g.game, keys({ shoot: true }), 16.67);
  assert.equal(fpOf(g).dialogState, null, "no NPC → no dialog");
  assert.equal(calls.pad, 1, "landing-pad resolution still invoked");
  assert.equal(calls.door, 1, "door resolution still invoked (pad returned not_on_pad)");
});

test("colony: an out-of-range NPC falls through to door/pad (helper returns false)", () => {
  const { ctx, calls } = makeColonyContext();
  const g = makeFpGame({
    npcs: [makeNpc({ id: 7, x: 4.5, y: 2.5 })],   // dist 2.0 from (2.5,2.5) → NOT < 2.0
    colonyContext: ctx,
    colonyInteractArmed: true,
    colonyInteractCooldownFrames: 0,
  });
  updateFirstPerson(g.game, keys({ shoot: true }), 16.67);
  assert.equal(fpOf(g).dialogState, null, "out-of-range NPC must not open a dialog");
  assert.equal(calls.door, 1, "door/pad resolution runs even with a (too-far) NPC present");
});

test("non-colony (Ashfall): NPC in range + faced + shoot + gunCooldown ready opens dialog (helper parity)", () => {
  const g = makeFpGame({
    npcs: [makeNpc({ id: 3 })],
    gunCooldown: 0,
    // no colonyContext → the extracted helper runs at the original Ashfall site
  });
  gameOf(g).player.bankDir = 5;      // pre-set to prove the helper clears it
  updateFirstPerson(g.game, keys({ shoot: true }), 16.67);
  const ds = fpOf(g).dialogState;
  assert.ok(ds, "non-colony dialog opens via the extracted helper");
  assert.equal(ds!.npcId, 3);
  assert.equal(fpOf(g).gunCooldown, 15, "helper sets the 15-frame debounce");
  assert.ok(gameOf(g).audioEvents.includes(AudioEvent.DIALOG_ADVANCE), "DIALOG_ADVANCE audio pushed");
  assert.equal(gameOf(g).player.bankDir, 0, "bankDir cleared by the helper");
});

// ─── Phase 5a §H2 — additive FPNPC.sprite resolution ─────────────────

test("H2: NPC sprite resolution prefers an explicit sprite, else name map, else survivor", () => {
  assert.equal(
    resolveNpcSprite({ name: "Commander Voss", sprite: "/sprites/colony/governor.png" }),
    "/sprites/colony/governor.png",
    "explicit sprite wins over the name map");
  assert.equal(
    resolveNpcSprite({ name: "Commander Voss" }),
    NPC_SPRITE_MAP["Commander Voss"],
    "name-mapped NPC with no sprite resolves via the map (Ashfall path preserved)");
  assert.equal(
    resolveNpcSprite({ name: "Nobody In The Map" }),
    SPRITES.NPC_SURVIVOR,
    "unmapped, spriteless NPC falls back to survivor");
});

// ─── Phase 5a §I / M3 Cantina — FP shop purchase flow ──────────────
// Buyable shops emit typed requests for supported consumables and services.
// Ashfall's shop (no canBuy → shopCanBuy falsy) stays display-only. These pin:
// selection nav (debounced), typed requests, LEAVE-closes, the Ashfall regression
// (never buys, old close, no soft-lock), reopenability, movement-freeze, and the
// pure purchase-application helpers.

interface ShopItemLike {
  id: string; name: string; description: string; cost: number; type: string;
  itemId?: string; serviceId?: string;
}
interface ShopDialogLike {
  active: boolean; npcId: number; lines: { speaker: string; text: string }[]; currentLine: number;
  shopOpen: boolean; shopCanBuy?: boolean; selectedIndex?: number; shopSeen?: boolean;
  shopNavCooldown?: number; shopItems?: ShopItemLike[]; shopFlashFrames?: number;
}
interface ShopFp {
  dialogState: ShopDialogLike | null;
  shopPurchaseRequest?: { kind: string; itemId?: string; serviceId?: string };
  posX: number; posY: number; gunCooldown: number;
}
const shopFp = (g: { fp: unknown }) => g.fp as ShopFp;

function item(over: Partial<ShopItemLike> = {}): ShopItemLike {
  return { id: "hull", name: "Hull Repair Kit", description: "Restore 1 HP", cost: 300, type: "consumable", itemId: "hull-repair", ...over };
}
// A fresh, already-open BUYABLE shop (quartermaster). Override fields as needed.
function shopDialog(over: Partial<ShopDialogLike> = {}): ShopDialogLike {
  return {
    active: true, npcId: 1, lines: [{ speaker: "Quartermaster", text: "Supplies." }], currentLine: 0,
    shopOpen: true, shopCanBuy: true, selectedIndex: 0, shopItems: [item()],
    ...over,
  };
}

test("shop(I): up/down move selectedIndex, debounced by shopNavCooldown", () => {
  const g = makeFpGame({
    dialogState: shopDialog({ shopItems: [item({ id: "a" }), item({ id: "b", itemId: "cryo-charge" })] }),
    npcs: [makeNpc({ id: 1, type: "merchant", canBuy: true })],
    gunCooldown: 0,
  });
  // items 0,1 then a trailing LEAVE row at index 2.
  updateFirstPerson(g.game, keys({ down: true }), 16.67);
  assert.equal(shopFp(g).dialogState!.selectedIndex, 1, "first down moves selection to item 1");

  updateFirstPerson(g.game, keys({ down: true }), 16.67);
  assert.equal(shopFp(g).dialogState!.selectedIndex, 1, "an immediate second down is debounced (no move)");

  for (let i = 0; i < 10; i++) updateFirstPerson(g.game, keys(), 16.67); // let shopNavCooldown expire
  updateFirstPerson(g.game, keys({ down: true }), 16.67);
  assert.equal(shopFp(g).dialogState!.selectedIndex, 2, "after cooldown, down reaches the LEAVE row (index 2)");

  for (let i = 0; i < 10; i++) updateFirstPerson(g.game, keys(), 16.67);
  updateFirstPerson(g.game, keys({ down: true }), 16.67);
  assert.equal(shopFp(g).dialogState!.selectedIndex, 2, "selection clamps at the LEAVE row (no overflow)");

  for (let i = 0; i < 10; i++) updateFirstPerson(g.game, keys(), 16.67);
  updateFirstPerson(g.game, keys({ up: true }), 16.67);
  assert.equal(shopFp(g).dialogState!.selectedIndex, 1, "up moves the selection back");
});

test("shop(I): interact on a consumable row emits a typed purchase request; shop stays open", () => {
  const g = makeFpGame({
    dialogState: shopDialog({ selectedIndex: 0, shopItems: [item({ itemId: "hull-repair" })] }),
    npcs: [makeNpc({ id: 1, type: "merchant", canBuy: true })],
    gunCooldown: 0,
  });
  updateFirstPerson(g.game, keys({ shoot: true }), 16.67);
  const req = shopFp(g).shopPurchaseRequest;
  assert.ok(req, "a purchase request is emitted");
  assert.equal(req!.kind, "consumable", "request is a consumable buy");
  assert.equal(req!.itemId, "hull-repair", "request carries the selected row's itemId");
  assert.ok(shopFp(g).dialogState, "the shop stays open after a buy (not closed)");
});

test("shop(M3): interact on a service row emits the exact typed request; shop stays open", () => {
  const g = makeFpGame({
    dialogState: shopDialog({
      selectedIndex: 0,
      shopItems: [item({
        id: "cantina-house-pour",
        name: "House Pour",
        description: "A local drink and a place at the bar.",
        cost: 5,
        type: "service",
        itemId: undefined,
        serviceId: "cantina-house-pour",
      })],
    }),
    npcs: [makeNpc({ id: 1, type: "merchant", canBuy: true })],
    gunCooldown: 0,
  });

  updateFirstPerson(g.game, keys({ shoot: true }), 16.67);

  assert.deepEqual(
    shopFp(g).shopPurchaseRequest,
    { kind: "service", serviceId: "cantina-house-pour" },
    "the engine emits only the authoritative service identity",
  );
  assert.equal(shopFp(g).dialogState?.shopOpen, true, "the shop stays open after selecting a service");
});

test("shop(M3): a drained service request is not re-emitted without another accepted interact", () => {
  const g = makeFpGame({
    dialogState: shopDialog({
      selectedIndex: 0,
      shopItems: [item({
        id: "cantina-house-pour",
        name: "House Pour",
        description: "A local drink and a place at the bar.",
        cost: 5,
        type: "service",
        itemId: undefined,
        serviceId: "cantina-house-pour",
      })],
    }),
    npcs: [makeNpc({ id: 1, type: "merchant", canBuy: true })],
    gunCooldown: 0,
  });

  updateFirstPerson(g.game, keys({ shoot: true }), 16.67);
  assert.ok(shopFp(g).shopPurchaseRequest, "sanity: the first accepted interact emits a request");
  shopFp(g).shopPurchaseRequest = undefined; // Simulate the later Game.tsx drain.

  updateFirstPerson(g.game, keys(), 16.67);

  assert.equal(
    shopFp(g).shopPurchaseRequest,
    undefined,
    "a frame with no accepted interact leaves the drained channel empty",
  );
});

test("shop(M3) regression: buyable legacy material and upgrade rows emit no request", () => {
  for (const type of ["material", "upgrade"] as const) {
    const g = makeFpGame({
      dialogState: shopDialog({
        selectedIndex: 0,
        shopItems: [item({ type, itemId: `legacy-${type}` })],
      }),
      npcs: [makeNpc({ id: 1, type: "merchant", canBuy: true })],
      gunCooldown: 0,
    });

    updateFirstPerson(g.game, keys({ shoot: true }), 16.67);

    assert.equal(shopFp(g).shopPurchaseRequest, undefined, `${type}: no request is emitted`);
    assert.equal(shopFp(g).dialogState?.shopOpen, true, `${type}: the display row leaves the shop open`);
  }
});

test("shop(M3): buildServiceShopItem mirrors the authoritative House Pour catalog at 5 credits", async () => {
  const { CANTINA_SERVICE_DEFS, buildServiceShopItem } = await import(
    "../../app/components/engine/shopServices"
  );
  const serviceId = "cantina-house-pour";

  const item = buildServiceShopItem(serviceId);

  assert.deepEqual(item, {
    id: serviceId,
    type: "service",
    serviceId,
    ...CANTINA_SERVICE_DEFS[serviceId],
  });
  assert.equal(item.cost, 5, "the displayed House Pour cost is exactly 5 credits");
});

test("shop(I): interact on the LEAVE row closes the dialog and emits no request", () => {
  const g = makeFpGame({
    dialogState: shopDialog({ selectedIndex: 1, shopItems: [item()] }), // leaveIndex = 1
    npcs: [makeNpc({ id: 1, type: "merchant", canBuy: true })],
    gunCooldown: 0,
  });
  updateFirstPerson(g.game, keys({ shoot: true }), 16.67);
  assert.equal(shopFp(g).dialogState, null, "LEAVE row closes the dialog");
  assert.equal(shopFp(g).shopPurchaseRequest, undefined, "LEAVE emits no purchase request");
});

test("shop(I) regression: a display-only shop (no shopCanBuy) never buys; interact closes the shop", () => {
  const g = makeFpGame({
    // shopCanBuy omitted → display-only. Use an INVALID itemId like Ashfall's real data.
    dialogState: shopDialog({ shopCanBuy: undefined, shopItems: [item({ itemId: "hull-repair-kit" })] }),
    npcs: [makeNpc({ id: 1, type: "merchant" })], // no canBuy
    gunCooldown: 0,
  });
  updateFirstPerson(g.game, keys({ shoot: true }), 16.67);
  assert.equal(shopFp(g).shopPurchaseRequest, undefined, "display-only shop never emits a purchase request");
  assert.equal(shopFp(g).dialogState!.shopOpen, false, "interact closes the display-only shop (old behavior)");
});

test("shop(M3) regression: real Lt. Reyes inventory remains display-only and closes without a request", () => {
  const camp = createAshfallForwardCampState();
  const reyes = camp.npcs.find((npc) => npc.name === "Lt. Reyes");
  assert.ok(reyes, "the Ashfall fixture includes Lt. Reyes");
  assert.notEqual(reyes!.canBuy, true, "Reyes remains a display-only merchant");
  assert.deepEqual(
    reyes!.shopItems?.map(({ id, type, itemId }) => ({ id, type, itemId })),
    [
      { id: "hull-repair", type: "consumable", itemId: "hull-repair-kit" },
      { id: "scanner", type: "consumable", itemId: "scanner-pulse" },
      { id: "desert-glass", type: "material", itemId: "desert-glass" },
    ],
    "all three legacy Reyes rows remain intact",
  );

  const g = makeFpGame({
    dialogState: shopDialog({
      npcId: reyes!.id,
      shopCanBuy: undefined,
      shopItems: reyes!.shopItems as unknown as ShopItemLike[],
    }),
    npcs: camp.npcs,
    gunCooldown: 0,
  });

  updateFirstPerson(g.game, keys({ shoot: true }), 16.67);

  assert.equal(shopFp(g).dialogState?.shopOpen, false, "interact closes Reyes' display-only shop");
  assert.equal(shopFp(g).shopPurchaseRequest, undefined, "Reyes never emits a purchase request");
});

test("shop(I): a merchant's shop opens at end-of-dialog regardless of npc.interacted (reopenable)", () => {
  const g = makeFpGame({
    // fresh dialog: shopOpen false, shopSeen unset. Merchant already interacted before.
    dialogState: { active: true, npcId: 1, lines: [{ speaker: "Q", text: "only line" }], currentLine: 0, shopOpen: false },
    npcs: [makeNpc({ id: 1, type: "merchant", canBuy: true, interacted: true, shopItems: [item()] })],
    gunCooldown: 0,
  });
  updateFirstPerson(g.game, keys({ shoot: true }), 16.67);
  const ds = shopFp(g).dialogState!;
  assert.equal(ds.shopOpen, true, "shop opens despite npc.interacted=true (no interacted gate)");
  assert.equal(ds.shopCanBuy, true, "a canBuy merchant → shopCanBuy enabled");
  assert.equal(ds.selectedIndex, 0, "selection initialized to the first row");
});

test("shop(I) regression: a display-only merchant closes in two steps — no soft-lock", () => {
  const npc = makeNpc({ id: 1, type: "merchant", shopItems: [item({ itemId: "hull-repair-kit" })] }); // no canBuy
  const g = makeFpGame({
    dialogState: { active: true, npcId: 1, lines: [{ speaker: "R", text: "only" }], currentLine: 0, shopOpen: false },
    npcs: [npc], gunCooldown: 0,
  });
  // 1) end-of-dialog interact → opens the display-only shop
  updateFirstPerson(g.game, keys({ shoot: true }), 16.67);
  assert.equal(shopFp(g).dialogState!.shopOpen, true, "step 1: shop opens");
  assert.notEqual(shopFp(g).dialogState!.shopCanBuy, true, "opened shop is display-only");
  for (let i = 0; i < 16; i++) updateFirstPerson(g.game, keys(), 16.67); // release + gunCooldown
  // 2) interact → closes the shop, dialog persists
  updateFirstPerson(g.game, keys({ shoot: true }), 16.67);
  assert.equal(shopFp(g).dialogState!.shopOpen, false, "step 2: shop closes, dialog persists");
  for (let i = 0; i < 16; i++) updateFirstPerson(g.game, keys(), 16.67);
  // 3) interact → closes the dialog (shopSeen gate stops an infinite reopen)
  updateFirstPerson(g.game, keys({ shoot: true }), 16.67);
  assert.equal(shopFp(g).dialogState, null, "step 3: dialog closes — no soft-lock");
});

test("shop(I): player movement is frozen while a dialog is active", () => {
  const g = makeFpGame({
    dialogState: { active: true, npcId: 1, lines: [{ speaker: "x", text: "y" }], currentLine: 0, shopOpen: false },
    npcs: [makeNpc({ id: 1 })],
  });
  const x0 = shopFp(g).posX, y0 = shopFp(g).posY;
  updateFirstPerson(g.game, keys({ up: true }), 16.67);
  assert.equal(shopFp(g).posX, x0, "posX unchanged while dialog active (up held)");
  assert.equal(shopFp(g).posY, y0, "posY unchanged while dialog active (up held)");
});

test("shop(I): the purchase-unavailable flash counts down each frame and clamps at 0", () => {
  const g = makeFpGame({
    dialogState: shopDialog({ shopFlashFrames: 3 }),
    npcs: [makeNpc({ id: 1, type: "merchant", canBuy: true })],
    gunCooldown: 0,
  });
  updateFirstPerson(g.game, keys(), 16.67); // dtF = 1
  assert.equal(shopFp(g).dialogState!.shopFlashFrames, 2, "flash decrements one frame's worth (3 → 2)");
  updateFirstPerson(g.game, keys(), 16.67);
  updateFirstPerson(g.game, keys(), 16.67);
  assert.equal(shopFp(g).dialogState!.shopFlashFrames, 0, "flash reaches 0");
  updateFirstPerson(g.game, keys(), 16.67);
  assert.equal(shopFp(g).dialogState!.shopFlashFrames, 0, "flash stays clamped at 0 (never negative)");
});

test("shop(M3) drain: a consumable request is returned once and cleared", () => {
  const fp: Pick<FirstPersonState, "shopPurchaseRequest"> = {
    shopPurchaseRequest: { kind: "consumable", itemId: "hull-repair" },
  };

  assert.deepEqual(
    drainShopPurchaseRequest(fp),
    { kind: "consumable", itemId: "hull-repair" },
  );
  assert.equal(fp.shopPurchaseRequest, undefined, "the request is cleared after being read");
  assert.equal(drainShopPurchaseRequest(fp), undefined, "a second drain has nothing to replay");
});

test("shop(M3) drain: a service request is returned once and cleared", () => {
  const fp: Pick<FirstPersonState, "shopPurchaseRequest"> = {
    shopPurchaseRequest: { kind: "service", serviceId: "cantina-house-pour" },
  };

  assert.deepEqual(
    drainShopPurchaseRequest(fp),
    { kind: "service", serviceId: "cantina-house-pour" },
  );
  assert.equal(fp.shopPurchaseRequest, undefined, "the request is cleared after being read");
  assert.equal(drainShopPurchaseRequest(fp), undefined, "a second drain has nothing to replay");
});

test("shop(M3) drain: an absent purchase request remains absent", () => {
  const fp: Pick<FirstPersonState, "shopPurchaseRequest"> = {};

  assert.equal(drainShopPurchaseRequest(fp), undefined);
  assert.equal(fp.shopPurchaseRequest, undefined);
});

test("shop(M3) feedback: service outcomes produce exact transient messages", () => {
  const request: FPShopPurchaseRequest = {
    kind: "service",
    serviceId: "cantina-house-pour",
  };

  assert.deepEqual(shopPurchaseFeedback(request, true), {
    text: "HOUSE POUR SERVED",
    tone: "success",
    frames: 90,
  });
  assert.deepEqual(shopPurchaseFeedback(request, false), {
    text: "PURCHASE UNAVAILABLE",
    tone: "error",
    frames: 90,
  });
});

test("shop(M3) feedback: consumables flash only when rejected", () => {
  const request: FPShopPurchaseRequest = {
    kind: "consumable",
    itemId: "hull-repair",
  };

  assert.equal(shopPurchaseFeedback(request, true), null);
  assert.deepEqual(shopPurchaseFeedback(request, false), {
    text: "PURCHASE UNAVAILABLE",
    tone: "error",
    frames: 90,
  });
});

test("shop(I) drain: applyShopPurchase deducts credits and grants an affordable consumable", () => {
  const save = { credits: 500, completedPlanets: ["verdania"], consumableInventory: {} } as unknown as SaveData;
  const next = applyShopPurchase(save, { kind: "consumable", itemId: "hull-repair" });
  assert.ok(next, "affordable purchase returns a new save");
  assert.equal(next!.credits, 200, "credits deducted by the 300 cost");
  assert.equal(next!.consumableInventory["hull-repair"], 1, "the consumable is granted");
});

test("shop(I) drain: applyShopPurchase returns null when unaffordable (→ generic flash, no mutation)", () => {
  const save = { credits: 50, completedPlanets: ["verdania"], consumableInventory: {} } as unknown as SaveData;
  const next = applyShopPurchase(save, { kind: "consumable", itemId: "hull-repair" });
  assert.equal(next, null, "unaffordable purchase returns null");
});

test("shop(I) drain: applyShopPurchase charges the faction-adjusted price (Phase 5a)", () => {
  const save = { credits: 500, completedPlanets: ["verdania"], consumableInventory: {} } as unknown as SaveData;
  const next = applyShopPurchase(save, { kind: "consumable", itemId: "hull-repair" }, "allied");
  assert.ok(next, "allied purchase succeeds");
  // 300-cost hull-repair at allied (-10%) charges adjustedBuyPrice(300) = 270.
  assert.equal(next!.credits, 230, "allied buys the 300-cost item for 270");
});

test("shop(I) drain: hated rank doubles the charge — an otherwise-affordable item becomes unaffordable", () => {
  const save = { credits: 500, completedPlanets: ["verdania"], consumableInventory: {} } as unknown as SaveData;
  const next = applyShopPurchase(save, { kind: "consumable", itemId: "hull-repair" }, "hated");
  assert.equal(next, null, "300-cost item costs 600 at hated → unaffordable with 500 credits");
});

test("shop(M3) drain: an affordable House Pour deducts 5 credits without changing consumables", () => {
  const consumableInventory = { "hull-repair": 2 } as const;
  const save = { credits: 5, consumableInventory } as unknown as SaveData;

  const next = applyShopPurchase(save, { kind: "service", serviceId: "cantina-house-pour" });

  assert.ok(next, "an affordable service returns a save");
  assert.notEqual(next, save, "a successful service returns a new save object");
  assert.equal(next!.credits, 0, "House Pour costs exactly 5 credits");
  assert.equal(next!.consumableInventory, consumableInventory, "services do not touch consumable inventory");
});

test("shop(M3) drain: House Pour costs exactly 5 at every faction rank", () => {
  const ranks: readonly FactionRank[] = ["hostile", "hated", "neutral", "liked", "allied"];

  for (const rank of ranks) {
    const save = { credits: 5, consumableInventory: {} } as unknown as SaveData;
    const next = applyShopPurchase(
      save,
      { kind: "service", serviceId: "cantina-house-pour" },
      rank,
    );
    assert.ok(next, `${rank}: a 5-credit wallet can always afford the service`);
    assert.equal(next!.credits, 0, `${rank}: service pricing ignores faction rank`);
  }
});

test("shop(M3) drain: credits below 5 fail without mutating the input save", () => {
  const save = { credits: 4, consumableInventory: { "hull-repair": 1 } } as unknown as SaveData;
  const before = JSON.parse(JSON.stringify(save));

  const next = applyShopPurchase(save, { kind: "service", serviceId: "cantina-house-pour" });

  assert.equal(next, null, "an unaffordable service returns null");
  assert.deepEqual(save, before, "the failed application leaves the input unchanged");
});

test("shop(M3) drain: unknown runtime service IDs fail closed without mutation", async () => {
  const { purchaseService } = await import("../../app/components/engine/shopServices");
  const save = { credits: 100, consumableInventory: { "hull-repair": 1 } } as unknown as SaveData;
  const before = JSON.parse(JSON.stringify(save));

  for (const runtimeId of ["cantina-unknown", "__proto__", "constructor", "toString"] as const) {
    const unknownId = runtimeId as FPServiceId;
    const next = purchaseService(save, unknownId);
    assert.equal(next, null, `${runtimeId}: an unknown service returns null`);
    assert.deepEqual(save, before, `${runtimeId}: the unknown service leaves the input unchanged`);

    const unknownRequest = { kind: "service", serviceId: unknownId } as FPShopPurchaseRequest;
    assert.equal(
      applyShopPurchase(save, unknownRequest),
      null,
      `${runtimeId}: the application boundary also fails closed`,
    );
    assert.deepEqual(save, before, `${runtimeId}: the application boundary does not mutate the input`);
  }
});

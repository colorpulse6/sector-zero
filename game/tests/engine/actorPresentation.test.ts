import { test } from "node:test";
import assert from "node:assert/strict";
import { updateFirstPerson } from "../../app/components/engine/firstPersonEngine";
import { initializeActorPresentation } from "../../app/components/engine/actorPresentation";
import { releaseActorAssets, syncActorAssets } from "../../app/components/engine/actorAssets";
import { selectNpcAtlasFrame } from "../../app/components/engine/fpRender/npcAtlas";
import { SceneBuilder } from "../../app/components/engine/fpRender/sceneInput";
import { TextureRegistry } from "../../app/components/engine/fpRender/textures";
import { SPRITES } from "../../app/components/engine/sprites";
import { createAshfallForwardCampState } from "../../app/components/engine/ashfallForwardCamp";
import { createKeplerBlackBoxFirstPersonState } from "../../app/components/engine/keplerBlackBoxMission";
import { createFirstPersonRuinTemplate } from "../../app/components/colony/region/poiTemplates";
import { generateInteriorState } from "../../app/components/colony/exploration/colonyLayout";
import { makeBuilding } from "../colony/fixtures";
import type { FirstPersonState, FPEnemy, GameState, Keys } from "../../app/components/engine/types";
const NO_KEYS: Keys = { left: false, right: false, up: false, down: false, strafeLeft: false, strafeRight: false, shoot: false, bomb: false, jump: false };
const enemy = (overrides: Partial<FPEnemy> = {}): FPEnemy => ({ id: 1, x: 4.5, y: 3.5, hp: 10, maxHp: 10, speed: .015, type: "grunt", aggroRange: 6, isAggro: false, deathTimer: 0, fireTimer: 0, classId: "swarm", ...overrides });
function state(enemies: FPEnemy[] = []): FirstPersonState {
  return { map: { width: 12, height: 8, tileSize: 32, tiles: Array.from({ length: 8 }, (_, y) => Array.from({ length: 12 }, (_, x) => x === 0 || y === 0 || x === 11 || y === 7 ? "wall" : "floor")) }, posX: 2.5, posY: 3.5, dirX: 1, dirY: 0, planeX: 0, planeY: .66, moveSpeed: .06, rotSpeed: .04, goalReached: false, gunFireTimer: 0, gunCooldown: 0, enemies, npcs: [], dialogState: null };
}
function game(fp: FirstPersonState): GameState {
  return { firstPersonState: fp, levelCompleteTimer: 0, player: { hp: 10, maxHp: 10, invincibleTimer: 0, bankDir: 0 }, equippedWeaponType: "kinetic", allocatedSkills: [], floatingLabels: [], audioEvents: [], score: 0, xp: 0, kills: 0, lives: 3, deaths: 0, screenShake: 0 } as unknown as GameState;
}

test("universal first-person initialization covers Ashfall Cantina Kepler Cinder and all combat affinities", () => {
  const scenes = [createAshfallForwardCampState(), generateInteriorState(makeBuilding("cantina"), 42, 12), createKeplerBlackBoxFirstPersonState(false), createFirstPersonRuinTemplate(42), state(["swarm", "armored", "bio-organic", "heavy-mech"].map(classId => enemy({ classId: classId as FPEnemy["classId"] })))];
  for (const fp of scenes) {
    const gs = game(fp);
    updateFirstPerson(gs, NO_KEYS, 0);
    assert.ok(fp.npcs.length + fp.enemies.length > 0);
    for (const npc of fp.npcs) assert.ok(npc.atlasAnimation, npc.name);
    for (const e of fp.enemies) assert.equal(e.atlasAnimation?.set, "hostile");
    const before = JSON.stringify(fp.npcs.map(n => n.atlasAnimation));
    initializeActorPresentation(fp);
    assert.equal(JSON.stringify(fp.npcs.map(n => n.atlasAnimation)), before, "initialization is idempotent");
  }
});

test("fixed Ashfall and Cantina NPCs animate in place without changing their gameplay data", () => {
  for (const fp of [createAshfallForwardCampState(), generateInteriorState(makeBuilding("cantina"), 42, 12)]) {
    const gs = game(fp), coords = fp.npcs.map(n => [n.x, n.y]), dialogs = fp.npcs.map(n => n.dialog);
    for (let i = 0; i < 40; i++) updateFirstPerson(gs, NO_KEYS);
    assert.deepEqual(fp.npcs.map(n => [n.x, n.y]), coords);
    fp.npcs.forEach((n, i) => { assert.equal(n.atlasAnimation?.action, "idle"); assert.ok(n.atlasAnimation!.clockMs > 300); assert.equal(n.dialog, dialogs[i]); });
  }
});

test("enemy facing and gait follow collision-resolved travel while preserving AI speeds", () => {
  for (const type of ["grunt", "charger", "sentry"] as const) {
    const e = enemy({ type, fireTimer: 100 }), fp = state([e]), gs = game(fp);
    updateFirstPerson(gs, NO_KEYS);
    const distance = type === "sentry" ? 0 : .015 * (type === "charger" ? 1.5 : 1);
    assert.ok(Math.abs(e.x - (4.5 - distance)) < 1e-9);
    assert.ok(Math.abs(e.atlasAnimation!.walkDistance - distance) < 1e-9);
    assert.equal(e.atlasAnimation!.action, distance ? "walk" : "idle");
    if (distance) assert.equal(Math.abs(e.atlasAnimation!.facingAngle), Math.PI);
  }
  const e = enemy({ isAggro: true }), fp = state([e]);
  fp.map.tiles[3][4] = "wall";
  updateFirstPerson(game(fp), NO_KEYS);
  assert.equal(e.atlasAnimation!.walkDistance, 0);
  assert.equal(e.atlasAnimation!.action, "idle");
});

test("hits produce transient hurt; low HP alone never pins the flinch; kills keep rewards and removal", () => {
  const e = enemy(), fp = state([e]), gs = game(fp);
  updateFirstPerson(gs, { ...NO_KEYS, shoot: true });
  assert.ok(e.hp < 10);
  assert.equal(e.atlasAnimation!.action, "hurt");
  for (let i = 0; i < 20; i++) updateFirstPerson(gs, NO_KEYS);
  assert.equal(e.atlasAnimation!.action, "walk");
  e.hp = .01; fp.gunCooldown = 0;
  updateFirstPerson(gs, { ...NO_KEYS, shoot: true });
  assert.equal(e.atlasAnimation!.action, "death");
  assert.equal(gs.score, 200); assert.equal(gs.xp, 200); assert.equal(gs.kills, 1);
  for (let i = 0; i < 30; i++) updateFirstPerson(gs, NO_KEYS);
  assert.equal(fp.enemies.length, 0);
});

test("actual melee and sentry attacks start attack clips without changing damage or cooldowns", () => {
  for (const type of ["grunt", "charger", "sentry"] as const) {
    const e = enemy({ type, x: type === "sentry" ? 4.5 : 2.8 }), fp = state([e]), gs = game(fp);
    updateFirstPerson(gs, NO_KEYS);
    assert.equal(gs.player.hp, 9);
    assert.equal(e.atlasAnimation!.action, "attack");
    if (type === "sentry") assert.equal(e.fireTimer, 120);
    else assert.equal(gs.player.invincibleTimer, 59);
  }
});

test("dialogue freezes NPC and hostile animation including the closing frame; rendering is read-only", () => {
  const e = enemy(), fp = state([e]);
  fp.npcs = [{ id: 2, x: 3.5, y: 4.5, name: "Doc Kael", type: "lore", dialog: [], color: "#fff", interacted: false }];
  const gs = game(fp); updateFirstPerson(gs, NO_KEYS);
  fp.dialogState = { active: true, npcId: 2, lines: [], currentLine: 0, shopOpen: false };
  const before = JSON.stringify([fp.npcs, e]);
  for (let i = 0; i < 10; i++) updateFirstPerson(gs, NO_KEYS);
  updateFirstPerson(gs, { ...NO_KEYS, shoot: true });
  const builder = new SceneBuilder(), registry = new TextureRegistry();
  for (let i = 0; i < 10; i++) { selectNpcAtlasFrame(e, fp.posX, fp.posY); builder.build(fp, registry); }
  assert.equal(JSON.stringify([fp.npcs, e]), before);
});

test("legacy enemy fallback uses flinch only during a transient hurt event", () => {
  const e = enemy({ hp: 1 }), fp = state([e]), builder = new SceneBuilder(), registry = new TextureRegistry();
  initializeActorPresentation(fp);
  assert.equal(builder.build(fp, registry).billboards[0].texId, registry.idFor(SPRITES.FP_ENEMY_FRONT, "billboard"));
  e.atlasAnimation!.action = "hurt";
  assert.equal(builder.build(fp, registry).billboards[0].texId, registry.idFor(SPRITES.FP_ENEMY_FLINCH, "billboard"));
});

test("scene frames are protected before atlas use and preserve NPC/hostile aspect and anchors", async () => {
  // Match SceneBuilder's static import: tsx on Node 20 can instantiate a
  // separate actor cache when this stateful module is dynamically imported.
  const previous = globalThis.Image;
  globalThis.Image = class { onload?: () => void; set src(_path: string) { queueMicrotask(() => this.onload?.()); } } as unknown as typeof Image;
  try {
    const fp = state([enemy()]);
    fp.npcs = [{ id: 2, x: 3.5, y: 4.5, name: "Doc Kael", type: "lore", dialog: [], color: "#fff", interacted: false }];
    initializeActorPresentation(fp); syncActorAssets(fp);
    await Promise.resolve(); await Promise.resolve();
    const order: string[] = [];
    class Registry extends TextureRegistry {
      override beginFrame() { order.push("begin"); super.beginFrame(); }
      override idForFrame() { order.push("frame"); return 42; }
    }
    const scene = new SceneBuilder().build(fp, new Registry());
    assert.deepEqual(order, ["begin", "frame", "frame"]);
    assert.deepEqual(scene.billboards.map(b => [b.texId, b.widthFactor, b.vAnchor]), [[42, 1, "center"], [42, .5, "npc"]]);
  } finally { releaseActorAssets(); globalThis.Image = previous; }
});

test("actual campaign station transition and special mission dispatch initialize hostile presentation", async () => {
  const { createGameState, createSpecialMissionGameState, updateGame } = await import("../../app/components/engine/gameEngine");
  const { GameScreen } = await import("../../app/components/engine/types");
  const campaign = createGameState(5, 3);
  campaign.screen = GameScreen.PLAYING;
  campaign.levelCompleteTimer = 1;
  const station = updateGame(campaign, NO_KEYS, null, null);
  assert.equal(station.currentMode, "first-person");
  assert.ok(station.firstPersonState!.enemies.length > 0);
  station.screen = GameScreen.PLAYING;
  const special = createSpecialMissionGameState("kepler-black-box", false);
  special.screen = GameScreen.PLAYING;
  for (const gs of [station, special]) {
    const updated = updateGame(gs, NO_KEYS, null, null);
    for (const e of updated.firstPersonState!.enemies) assert.equal(e.atlasAnimation?.set, "hostile");
  }
});

test("presentation preserves all four live class affinity outcomes and wall LOS", () => {
  const damage = {
    armored: [.5, 1.5, 1, 1], swarm: [.5, 1, 1.5, 1],
    "bio-organic": [1, 1.5, 1.5, .5], "heavy-mech": [1.5, .5, 1, 1],
  };
  const weapons = ["kinetic", "energy", "incendiary", "cryogenic"] as const;
  for (const [classId, amounts] of Object.entries(damage)) weapons.forEach((weapon, i) => {
    const e = enemy({ classId: classId as FPEnemy["classId"] }), fp = state([e]), gs = game(fp);
    gs.equippedWeaponType = weapon;
    updateFirstPerson(gs, { ...NO_KEYS, shoot: true });
    assert.equal(e.hp, 10 - amounts[i], `${classId}/${weapon}`);
    assert.equal(e.atlasAnimation!.action, "hurt");
  });
  for (const type of ["grunt", "sentry"] as const) {
    const e = enemy({ x: 5.5, type }), fp = state([e]), gs = game(fp);
    fp.map.tiles[3][4] = "wall";
    updateFirstPerson(gs, { ...NO_KEYS, shoot: true });
    assert.equal(e.hp, 10); assert.equal(gs.player.hp, 10); assert.equal(e.isAggro, false);
    assert.equal(e.atlasAnimation!.action, "idle");
  }
});

test("a stationary sentry faces the current hitscan target when its next shot starts", () => {
  const e = enemy({ type: "sentry", fireTimer: 1 }), fp = state([e]), gs = game(fp);
  updateFirstPerson(gs, NO_KEYS);
  assert.equal(e.fireTimer, 0);
  assert.equal(gs.player.hp, 10, "cooldown frame does not fire");
  assert.equal(e.atlasAnimation!.facingAngle, Math.PI, "initial target is west");
  fp.posX = 6.5; // The player circles behind the stationary creature before its next shot.
  updateFirstPerson(gs, NO_KEYS);
  assert.equal(e.atlasAnimation!.action, "attack");
  assert.equal(gs.player.hp, 9, "the normal sentry hitscan fired");
  assert.equal(gs.player.invincibleTimer, 39);
  assert.equal(e.fireTimer, 120, "normal sentry cooldown is unchanged");
  assert.equal(e.atlasAnimation!.facingAngle, 0, "attack faces the new eastern target");
  assert.equal(selectNpcAtlasFrame(e, fp.posX, fp.posY)!.y, 0, "the target sees the attack's front row");
  assert.equal(e.x, 4.5); assert.equal(e.y, 3.5);
  assert.equal(e.atlasAnimation!.walkDistance, 0, "turning to shoot cannot invent travel");

  fp.posX = 2.5;
  const shotFacing = e.atlasAnimation!.facingAngle;
  updateFirstPerson(gs, NO_KEYS);
  assert.equal(e.atlasAnimation!.facingAngle, shotFacing, "cooldown does not continuously track the viewer");
  assert.equal(e.fireTimer, 119);
});

test("grunt and charger contact attacks retain facing derived from their actual approach", () => {
  for (const type of ["grunt", "charger"] as const) {
    const e = enemy({ type, x: 4.5 }), fp = state([e]), gs = game(fp);
    initializeActorPresentation(fp);
    assert.equal(e.atlasAnimation!.facingAngle, Math.PI);
    fp.posX = 4.8;
    const beforeX = e.x;
    updateFirstPerson(gs, NO_KEYS);
    assert.equal(e.atlasAnimation!.action, "attack");
    assert.equal(gs.player.hp, 9);
    assert.equal(e.atlasAnimation!.facingAngle, 0);
    assert.equal(selectNpcAtlasFrame(e, fp.posX, fp.posY)!.y, 0);
    assert.ok(Math.abs(e.x - beforeX - .015 * (type === "charger" ? 1.5 : 1)) < 1e-9);
  }
});

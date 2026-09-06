import { test } from "node:test";
import assert from "node:assert/strict";
import { selectNpcAtlasFrame, QUARTERMASTER_ATLASES, WALK_CYCLE_DISTANCE, type NpcAtlasAnimation } from "../../app/components/engine/fpRender/npcAtlas";
import { TextureRegistry } from "../../app/components/engine/fpRender/textures";

const state = (overrides: Partial<NpcAtlasAnimation> = {}): NpcAtlasAnimation => ({
  set: "quartermaster", facingAngle: 0, action: "idle", clockMs: 0, walkDistance: 0, ...overrides,
});

test("legacy NPCs have no atlas frame", () => {
  assert.equal(selectNpcAtlasFrame({ x: 0, y: 0 }, 3, 0), null);
});

test("eight views follow front, actor right, back, actor left and wrap", () => {
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    const frame = selectNpcAtlasFrame({ x: 2, y: 3, atlasAnimation: state() }, 2 + Math.cos(a) * 2, 3 + Math.sin(a) * 2)!;
    assert.ok(frame, "opted-in NPC must resolve a directional frame");
    assert.equal(frame.y, i * 256);
    assert.equal(frame.path, QUARTERMASTER_ATLASES.idle);
  }
  const npc = { x: 0, y: 0, atlasAnimation: state({ facingAngle: Math.PI * 2 - 0.01 }) };
  assert.equal(selectNpcAtlasFrame(npc, 2, 0)!.y, 0);
  npc.atlasAnimation.facingAngle = Math.PI / 2;
  assert.equal(selectNpcAtlasFrame(npc, 0, 2)!.y, 0);
});

test("walk phase follows distance, independent of elapsed idle time", () => {
  const npc = { x: 0, y: 0, atlasAnimation: state({ action: "walk", walkDistance: WALK_CYCLE_DISTANCE * 3 / 8 }) };
  const first = selectNpcAtlasFrame(npc, 2, 0)!;
  assert.ok(first, "walking NPC must resolve a gait frame");
  assert.equal(first.path, QUARTERMASTER_ATLASES.walk);
  assert.equal(first.x, 3 * 128);
  npc.atlasAnimation.clockMs = 90000;
  assert.equal(selectNpcAtlasFrame(npc, 2, 0), first);
  npc.atlasAnimation.walkDistance = WALK_CYCLE_DISTANCE;
  assert.equal(selectNpcAtlasFrame(npc, 2, 0)!.x, 0);
});

test("idle and work have distinct timed clips and bounded frame indices", () => {
  const npc = { x: 0, y: 0, atlasAnimation: state({ clockMs: 300 }) };
  assert.ok(selectNpcAtlasFrame(npc, 1, 0), "stationary NPC must resolve an idle frame");
  assert.equal(selectNpcAtlasFrame(npc, 1, 0)!.x, 128);
  npc.atlasAnimation = state({ action: "work", clockMs: 250 });
  assert.equal(selectNpcAtlasFrame(npc, 1, 0)!.x, 256);
  assert.equal(selectNpcAtlasFrame(npc, 1, 0)!.path, QUARTERMASTER_ATLASES.work);
  npc.atlasAnimation.clockMs = 1000;
  assert.equal(selectNpcAtlasFrame(npc, 1, 0)!.x, 0);
  npc.atlasAnimation.clockMs = -1;
  assert.equal(selectNpcAtlasFrame(npc, 1, 0)!.x, 0);
});

test("unloaded atlas returns no texture id so caller can keep the static actor", () => {
  const reg = new TextureRegistry();
  const frame = selectNpcAtlasFrame({ x: 0, y: 0, atlasAnimation: state() }, 1, 0)!;
  assert.equal(reg.idForFrame(frame), -1);
});

test("all humanoid identities use distance-driven 128x256 cells", () => {
  for (const set of ["voss", "kael", "reyes", "survivor", "scavenger", "hub-bartender", "hub-regular", "hub-signal-chaser"] as const) {
    const actor = { x: 0, y: 0, atlasAnimation: state({ set, action: "walk", walkDistance: WALK_CYCLE_DISTANCE / 2 }) };
    assert.deepEqual(selectNpcAtlasFrame(actor, -2, 0), { path: `/sprites/actors/${set}/walk.png`, x: 512, y: 1024, width: 128, height: 256 });
  }
});

test("hostile attack is timed and square; death holds its final frame", () => {
  const actor = { x: 0, y: 0, atlasAnimation: state({ set: "hostile", action: "attack", clockMs: 200 }) };
  assert.deepEqual(selectNpcAtlasFrame(actor, 0, 2), { path: "/sprites/actors/hostile/attack.png", x: 512, y: 512, width: 256, height: 256 });
  actor.atlasAnimation = state({ set: "hostile", action: "hurt", clockMs: 10000 });
  assert.equal(selectNpcAtlasFrame(actor, -1, 0)!.x, 0);
  actor.atlasAnimation = state({ set: "hostile", action: "death", clockMs: 10000 });
  assert.deepEqual(selectNpcAtlasFrame(actor, 0, -1), { path: "/sprites/actors/hostile/death.png", x: 1280, y: 0, width: 256, height: 256 });
});

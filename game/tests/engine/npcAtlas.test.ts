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

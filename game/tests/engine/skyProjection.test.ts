import { test } from "node:test";
import assert from "node:assert/strict";
import { Framebuffer } from "../../app/components/engine/fpRender/framebuffer";
import { TextureRegistry } from "../../app/components/engine/fpRender/textures";
import { renderScene } from "../../app/components/engine/fpRender/renderCore";
import { tinyScene, GREY } from "./fixtures";

function sceneAt(angle = 0, width = 480) {
  const reg = new TextureRegistry();
  reg.registerRaw("wall", new Uint32Array(16).fill(GREY), 4, 4);
  const sky = new Uint32Array(2048 * 2);
  for (let i = 0; i < sky.length; i++) sky[i] = (0xff000000 | (i % 2048)) >>> 0;
  const skyId = reg.registerRaw("angular-sky", sky, 2048, 2);
  const scene = tinyScene();
  scene.art.wallTexId = 0; scene.art.floorTexId = -1; scene.art.ceilingTexId = -1;
  scene.art.skyTexId = skyId;
  scene.map.wallTexture.fill(-1); scene.map.floorTexture.fill(-1);
  scene.dirX = Math.cos(angle); scene.dirY = Math.sin(angle);
  scene.planeX = -Math.sin(angle) * 0.66; scene.planeY = Math.cos(angle) * 0.66;
  const fb = new Framebuffer(width, 100);
  renderScene(fb, scene, reg);
  return { fb, scene, reg };
}

function expectedColumn(x: number, width: number, angle: number) {
  const rayAngle = angle + Math.atan((2 * x / width - 1) * 0.66);
  return Math.floor((rayAngle + Math.PI) / (Math.PI * 2) * 2048) & 2047;
}

test("sky rays follow camera field of view instead of showing the whole panorama", () => {
  const { fb } = sceneAt();
  for (const x of [0, 80, 240, 400, 479]) {
    assert.equal(fb.px[x] & 0xffffff, expectedColumn(x, 480, 0), `sky ray at column ${x}`);
  }
});

test("changing viewport width keeps the same center and edge directions", () => {
  const small = sceneAt(0, 240), large = sceneAt(0, 960);
  assert.equal(small.fb.px[0], large.fb.px[0]);
  assert.equal(small.fb.px[120], large.fb.px[480]);
});

test("sky wraps smoothly across west and is identical after a full turn", () => {
  const west = sceneAt(Math.PI), turned = sceneAt(Math.PI * 3);
  for (const x of [0, 100, 240, 350, 479]) {
    assert.equal(west.fb.px[x] & 0xffffff, expectedColumn(x, 480, Math.PI));
    assert.equal(west.fb.px[x], turned.fb.px[x]);
  }
});

test("turning refreshes sky columns while translation leaves the distant sky fixed", () => {
  const { fb, scene, reg } = sceneAt();
  const before = fb.px.slice(0, fb.w);
  scene.camX += 0.2;
  renderScene(fb, scene, reg);
  assert.deepEqual(fb.px.slice(0, fb.w), before);
  scene.dirX = 0; scene.dirY = 1; scene.planeX = -0.66; scene.planeY = 0;
  renderScene(fb, scene, reg);
  assert.equal(fb.px[240] & 0xffffff, 1536);
  assert.notDeepEqual(fb.px.slice(0, fb.w), before);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { TextureRegistry, textureTargetSize } from "../../app/components/engine/fpRender/textures";
import { buildMipChain, mipForFootprint } from "../../app/components/engine/fpRender/mipmaps";
import { loadSprite, releaseSprite } from "../../app/components/engine/sprites";
import { Framebuffer } from "../../app/components/engine/fpRender/framebuffer";
import { renderScene } from "../../app/components/engine/fpRender/renderCore";
import { tinyScene } from "./fixtures";

test("static decoding retains detail within power-of-two limits", () => {
  assert.deepEqual(textureTargetSize(512, 512, "tile"), { w: 256, h: 256 });
  assert.deepEqual(textureTargetSize(4096, 1024, "sky"), { w: 2048, h: 512 });
  assert.deepEqual(textureTargetSize(1536, 1024, "billboard"), { w: 512, h: 512 });
  assert.deepEqual(textureTargetSize(128, 256, "billboard"), { w: 128, h: 256 });
});

test("distant checker texture filters to its average instead of shimmering", () => {
  const pixels = new Uint32Array(16);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) pixels[y * 4 + x] = (x + y) % 2 ? 0xffffffff : 0xff000000;
  const levels = buildMipChain(pixels, 4, 4);
  assert.equal(levels[0].texels, pixels, "nearby sampling keeps source detail without a copy");
  assert.equal(levels.length, 3);
  assert.ok(levels[1].texels.every(pixel => pixel === 0xff7f7f7f));
  assert.equal(levels[2].texels[0], 0xff7f7f7f);
  assert.equal(mipForFootprint(0.5 / 256), 0);
  assert.equal(mipForFootprint(4 / 256), 2);
  assert.equal(mipForFootprint(100 / 256), 6);
});

test("frame slots stay bounded while static texture IDs and current-frame cells remain valid", async () => {
  const previousImage = globalThis.Image, previousDocument = globalThis.document;
  class MockImage {
    width = 1024; height = 1024; onload: (() => void) | null = null;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
  }
  globalThis.Image = MockImage as unknown as typeof Image;
  globalThis.document = {
    createElement: () => {
      const canvas = { width: 0, height: 0, getContext: () => ({
        drawImage: () => undefined,
        getImageData: () => ({ data: new Uint8ClampedArray(canvas.width * canvas.height * 4).fill(255) }),
      }) };
      return canvas;
    },
  } as unknown as Document;
  const path = "/sprites/actors/cache-test/walk.png";
  try {
    await loadSprite(path);
    const bytes = 128 * 256 * 4;
    const reg = new TextureRegistry(bytes * 2);
    const fixed = reg.registerRaw("map-material", new Uint32Array(4).fill(0xff123456), 2, 2);
    const cell = (x: number) => ({ path, x, y: 0, width: 128, height: 256 });
    reg.beginFrame();
    const first = reg.idForFrame(cell(0)), second = reg.idForFrame(cell(128));
    assert.ok(first >= 0 && second >= 0 && first !== second);
    assert.equal(reg.idForFrame(cell(256)), -1, "never recycle a cell already used in this frame");
    for (let i = 0; i < 100; i++) {
      reg.beginFrame();
      assert.ok(reg.idForFrame(cell((i % 8) * 128)) >= 0);
      assert.equal(reg.idFor("map-material", "tile"), fixed);
      assert.equal(reg.get(fixed).texels[0], 0xff123456);
      assert.ok(reg.getFrameCacheStats().bytes <= bytes * 2);
      assert.ok(reg.getFrameCacheStats().slots <= 2);
    }
    releaseSprite(path);
    reg.beginFrame();
    assert.equal(reg.idForFrame({ ...cell(0), path: "/missing.png" }), -1);
  } finally {
    releaseSprite(path);
    globalThis.Image = previousImage;
    globalThis.document = previousDocument;
  }
});

test("floor casting actually uses distance filtering under subpixel camera movement", () => {
  const reg = new TextureRegistry();
  const pixels = new Uint32Array(256 * 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) pixels[y * 256 + x] = (x + y) % 2 ? 0xffffffff : 0xff000000;
  const id = reg.registerRaw("checker-floor", pixels, 256, 256);
  reg.get(id).mips = buildMipChain(pixels, 256, 256);
  const scene = tinyScene();
  scene.map.solid.fill(0);
  scene.map.wallTexture.fill(-1);
  scene.art = { skyTexId: -1, wallTexId: id, floorTexId: id, ceilingTexId: -1 };
  const fb = new Framebuffer(96, 142);
  renderScene(fb, scene, reg);
  const before = fb.px.slice(110 * fb.w, 111 * fb.w);
  scene.camY += 1 / 256;
  renderScene(fb, scene, reg);
  assert.deepEqual(fb.px.slice(110 * fb.w, 111 * fb.w), before, "subpixel motion must not invert the checker pattern");
  assert.equal(new Set(before).size, 1, "far checker pixels average to a calm surface");
  reg.get(id).mips = undefined;
  renderScene(fb, scene, reg);
  assert.notDeepEqual(fb.px.slice(110 * fb.w, 111 * fb.w), before, "fixture must expose unfiltered aliasing");
});

test("floor filtering includes the forward footprint between screen rows", () => {
  const reg = new TextureRegistry(), pixels = new Uint32Array(256 * 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) pixels[y * 256 + x] = (x >> 3) % 2 ? 0xffffffff : 0xff000000;
  const id = reg.registerRaw("striped-floor", pixels, 256, 256);
  reg.get(id).mips = buildMipChain(pixels, 256, 256);
  const scene = tinyScene(); scene.map.solid.fill(0); scene.map.wallTexture.fill(-1);
  scene.art = { skyTexId: -1, wallTexId: id, floorTexId: id, ceilingTexId: id };
  const fb = new Framebuffer(480, 714);
  renderScene(fb, scene, reg);
  const floorBefore = fb.px.slice(407 * 480, 408 * 480);
  const ceilingBefore = fb.px.slice(306 * 480, 307 * 480);
  scene.camX += 8 / 256;
  renderScene(fb, scene, reg);
  assert.deepEqual(fb.px.slice(407 * 480, 408 * 480), floorBefore, "forward movement must not invert distant floor bands");
  assert.deepEqual(fb.px.slice(306 * 480, 307 * 480), ceilingBefore, "ceiling uses the same stable footprint");
});

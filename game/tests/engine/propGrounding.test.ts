import { test } from "node:test";
import assert from "node:assert/strict";
import { Framebuffer } from "../../app/components/engine/fpRender/framebuffer";
import { TextureRegistry } from "../../app/components/engine/fpRender/textures";
import { renderScene } from "../../app/components/engine/fpRender/renderCore";
import { tinyScene } from "./fixtures";

test("prop feet project onto the floor plane independently of asset scale and distance", () => {
  for (const distance of [2, 4, 6]) for (const scale of [.55, 1, 1.4]) {
    const reg = new TextureRegistry();
    const id = reg.registerRaw("prop", new Uint32Array(16).fill(0xff0000ff), 4, 4);
    const scene = tinyScene(); scene.map.solid.fill(0); scene.map.wallTexture.fill(-1);
    scene.billboards = [{ x: scene.camX + distance, y: scene.camY, texId: id, scale, alpha256: 256, widthFactor: 1, vAnchor: "prop" }];
    const fb = new Framebuffer(160, 240); renderScene(fb, scene, reg);
    const bottom = Math.floor(fb.h / 2 + fb.h / (2 * distance)) - 1;
    const pixel = fb.px[bottom * fb.w + fb.w / 2];
    assert.ok((pixel & 255) > 80, `prop scale ${scale}, distance ${distance} must touch ground row ${bottom}`);
    const below = fb.px[(bottom + 1) * fb.w + fb.w / 2];
    assert.ok((below & 255) < 30, "prop must not extend below its world-space ground contact");
  }
});

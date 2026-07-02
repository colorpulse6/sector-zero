import { Framebuffer, presentFramebuffer } from "./framebuffer";
import { TextureRegistry } from "./textures";
import { SceneBuilder } from "./sceneInput";
import { renderScene, projectBillboard } from "./renderCore";
import type { FirstPersonState } from "../types";
import { CANVAS_WIDTH, GAME_AREA_HEIGHT } from "../types";

const registry = new TextureRegistry();
const builder = new SceneBuilder();
const fb = new Framebuffer(CANVAS_WIDTH, GAME_AREA_HEIGHT);   // Task 5 makes this switchable

export function drawFirstPersonPixel(ctx: CanvasRenderingContext2D, fp: FirstPersonState): void {
  registry.refresh();
  const scene = builder.build(fp, registry);
  renderScene(fb, scene, registry);
  presentFramebuffer(fb, ctx, CANVAS_WIDTH, GAME_AREA_HEIGHT);
}

export function currentFrame(): Framebuffer { return fb; }        // overlays read zbuf (occlusion)
export function currentScene() { return builder.lastBuilt; }      // overlays project via
export { projectBillboard };

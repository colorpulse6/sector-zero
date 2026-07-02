/** Pixel + depth target for the FP scene. DOM-free except presentFramebuffer. */
export class Framebuffer {
  readonly w: number;
  readonly h: number;
  readonly px: Uint32Array<ArrayBuffer>;   // concrete ArrayBuffer: ImageData wraps this buffer
  readonly zbuf: Float32Array;          // per-column perpendicular wall distance
  readonly colDoor: Uint8Array;         // 1 if the column's wall hit is a door tile
  readonly colTop: Int16Array;          // wall strip drawStart per column (overlay glow)
  readonly colBot: Int16Array;          // wall strip drawEnd per column

  constructor(w: number, h: number) {
    this.w = w; this.h = h;
    this.px = new Uint32Array(w * h);
    this.zbuf = new Float32Array(w);
    this.colDoor = new Uint8Array(w);
    this.colTop = new Int16Array(w);
    this.colBot = new Int16Array(w);
  }
}

// Present path (browser only). Lazily create ImageData wrapping the SAME
// buffer (zero copy) + an offscreen canvas; blit with integer upscale.
const presentCache = new WeakMap<Framebuffer, {
  imageData: ImageData; off: HTMLCanvasElement; offCtx: CanvasRenderingContext2D;
}>();

export function presentFramebuffer(
  fb: Framebuffer, ctx: CanvasRenderingContext2D,
  targetW: number, targetH: number,
): void {
  let entry = presentCache.get(fb);
  if (!entry) {
    const imageData = new ImageData(new Uint8ClampedArray(fb.px.buffer), fb.w, fb.h);
    const off = document.createElement("canvas");
    off.width = fb.w; off.height = fb.h;
    const offCtx = off.getContext("2d");
    if (!offCtx) return;
    entry = { imageData, off, offCtx };
    presentCache.set(fb, entry);
  }
  entry.offCtx.putImageData(entry.imageData, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(entry.off, 0, 0, fb.w, fb.h, 0, 0, targetW, targetH);
}

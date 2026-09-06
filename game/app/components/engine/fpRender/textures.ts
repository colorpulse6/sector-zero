import { getSprite, SPRITES } from "../sprites";
import type { AtlasFrame } from "./npcAtlas";
import { buildMipChain, type TextureLevel } from "./mipmaps";

export type TexKind = "tile" | "sky" | "billboard";

export interface Texture extends TextureLevel {
  ready: boolean;                 // false while serving fallback texels
  mips?: TextureLevel[];
}

const TILE_SIZE = 256;
const SKY_W = 2048, SKY_H = 512;
const BILLBOARD_MAX = 512;
const FRAME_MAX = 256;
const MAX_FRAME_BYTES = 40 * 1024 * 1024;
const MAX_FRAME_SLOTS = 320;
type CachedFrame = { id: number; path: string; bytes: number; usedAt: number };
// sprites.ts's loadSprite() only populates its cache in the onload handler —
// an onerror (404, etc.) never enters the cache, so getSprite() returns null
// forever for that path and is indistinguishable here from "still loading".
// After this many frames (~10s at 60fps), refresh() decimates the entry's
// polling to every 60th frame: bounded cost for a permanently-bad path,
// while a legitimately slow load (a first-visit connection pushing
// preloadAll's tail images past the window) is still recovered by a later
// poll instead of being dropped for the session.
const RETRY_LIMIT_FRAMES = 600;

/** Class fallback colors — keep visual continuity with the classic
 *  WALL_COLORS record while an image loads / if it 404s. */
// 0xAABBGGRR packing! tile fallback = classic cool blue-grey #3a4a5a
// → packed 0xff5a4a3a (B=0x5a, G=0x4a, R=0x3a).
const FALLBACK: Record<TexKind, number> = {
  tile: 0xff5a4a3a, sky: 0xff2e1c14, billboard: 0x00000000,
};

export class TextureRegistry {
  private byPath = new Map<string, number>();
  private textures: Texture[] = [];
  private pending: { id: number; path: string; kind: TexKind; framesWaited: number }[] = [];
  private frames = new Map<string, CachedFrame>();
  private freeFrameIds: number[] = [];
  private frameBytes = 0;
  private frameSlots = 0;
  private frameNumber = 0;

  constructor(private readonly frameBudget = MAX_FRAME_BYTES) {}

  /** Protect every atlas ID selected by this scene until the next build. */
  beginFrame(): void { this.frameNumber++; }

  getFrameCacheStats() {
    return { bytes: this.frameBytes, entries: this.frames.size, slots: this.frameSlots, budget: this.frameBudget };
  }

  /** Actor source images and decoded frame cells have separate lifetimes.
   * Only frame slots are recycled; cached map texture IDs always stay valid. */
  retainFramePaths(paths: ReadonlySet<string>): void {
    for (const [key, entry] of this.frames) if (!paths.has(entry.path)) this.releaseFrame(key, entry);
  }

  private releaseFrame(key: string, entry: CachedFrame): void {
    this.frames.delete(key);
    this.frameBytes -= entry.bytes;
    this.textures[entry.id] = this.fallbackTexture("billboard");
    this.freeFrameIds.push(entry.id);
  }

  private makeFrameSpace(bytes: number): boolean {
    if (bytes > this.frameBudget) return false;
    while (this.frameBytes + bytes > this.frameBudget || (!this.freeFrameIds.length && this.frameSlots >= MAX_FRAME_SLOTS)) {
      let oldestKey: string | undefined, oldest: CachedFrame | undefined;
      for (const [key, entry] of this.frames) {
        if (entry.usedAt === this.frameNumber) continue;
        if (!oldest || entry.usedAt < oldest.usedAt) { oldestKey = key; oldest = entry; }
      }
      if (!oldest || oldestKey === undefined) return false;
      this.releaseFrame(oldestKey, oldest);
    }
    return true;
  }

  /** Node tests: register texels directly. Dimensions must be powers of two. */
  registerRaw(path: string, texels: Uint32Array, w: number, h: number): number {
    const id = this.textures.length;
    this.byPath.set(path, id);
    this.textures.push({ texels, w, h, wMask: w - 1, hMask: h - 1, ready: true });
    return id;
  }

  /** Browser: resolve a sprite path to an id, decoding lazily. */
  idFor(path: string | null | undefined, kind: TexKind): number {
    if (!path) return -1;
    const existing = this.byPath.get(path);
    if (existing !== undefined) return existing;
    const id = this.textures.length;
    this.byPath.set(path, id);
    this.textures.push(this.fallbackTexture(kind));
    this.pending.push({ id, path, kind, framesWaited: 0 });
    return id;
  }

  get(id: number): Texture { return this.textures[id]; }

  /** Decode a single authored cell, never resize the atlas as one billboard.
   * Missing/invalid cells return -1 so scene construction retains its static
   * actor. The LRU frame pool has fixed byte/slot caps across scene changes. */
  idForFrame(frame: AtlasFrame): number {
    const key = `${frame.path}#${frame.x},${frame.y},${frame.width},${frame.height}`;
    const cached = this.frames.get(key);
    if (cached) { cached.usedAt = this.frameNumber; return cached.id; }
    const img = getSprite(frame.path);
    if (!img || typeof document === "undefined") return -1;
    const { x, y, width, height } = frame;
    if (![x, y, width, height].every(Number.isInteger) || x < 0 || y < 0
      || width < 1 || height < 1 || width > FRAME_MAX || height > FRAME_MAX
      || (width & (width - 1)) || (height & (height - 1))
      || x + width > img.width || y + height > img.height) return -1;
    const bytes = width * height * 4;
    if (!this.makeFrameSpace(bytes)) return -1;
    const cv = document.createElement("canvas");
    cv.width = width; cv.height = height;
    const ctx = cv.getContext("2d");
    if (!ctx) return -1;
    ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
    const pixels = ctx.getImageData(0, 0, width, height);
    let id = this.freeFrameIds.pop();
    if (id === undefined) { id = this.textures.length; this.frameSlots++; }
    this.textures[id] = { texels: new Uint32Array(pixels.data.buffer), w: width, h: height, wMask: width - 1, hMask: height - 1, ready: true };
    this.frames.set(key, { id, path: frame.path, bytes, usedAt: this.frameNumber });
    this.frameBytes += bytes;
    return id;
  }

  /** Called once per frame (cheap): decode any images that finished loading.
   *  Compacts `pending` IN PLACE instead of `Array.prototype.filter` (which
   *  allocates a fresh array on every call regardless of whether anything was
   *  removed) — with nothing to resolve this is a no-alloc scan. Entries that
   *  outlast RETRY_LIMIT_FRAMES are never dropped, only polled at 1/60 rate —
   *  see the constant's comment for the recovery rationale. */
  refresh(): void {
    if (this.pending.length === 0) return;
    let write = 0;
    for (let read = 0; read < this.pending.length; read++) {
      const entry = this.pending[read];
      entry.framesWaited++;
      // Decimated polling past the cap: skip the lookup on 59 of every 60
      // frames so a path that will never resolve costs one Map probe per
      // second instead of sixty, yet still decodes if it eventually lands.
      if (entry.framesWaited >= RETRY_LIMIT_FRAMES && entry.framesWaited % 60 !== 0) {
        this.pending[write++] = entry;
        continue;
      }
      const img = getSprite(entry.path);
      if (img) {
        this.textures[entry.id] = decode(img, entry.path, entry.kind);
        continue;                                  // resolved — drop from pending
      }
      this.pending[write++] = entry;                // still pending — keep
    }
    this.pending.length = write;                    // no-op when nothing resolved
  }

  private fallbackTexture(kind: TexKind): Texture {
    const texels = new Uint32Array(4).fill(FALLBACK[kind]);
    return { texels, w: 2, h: 2, wMask: 1, hMask: 1, ready: false };
  }
}

function decode(img: HTMLImageElement, path: string, kind: TexKind): Texture {
  const { w, h } = textureTargetSize(img.width, img.height, kind);
  let srcX = 0, srcW = img.width;
  // Classic renderer treats BOARDING_TILES as a 3-frame atlas and samples
  // the middle third for generic FP walls — slice it here, once, forever.
  if (path === SPRITES.BOARDING_TILES) { srcX = img.width / 3; srcW = img.width / 3; }
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const c = cv.getContext("2d");
  if (!c) return { texels: new Uint32Array(w * h), w, h, wMask: w - 1, hMask: h - 1, ready: false };
  c.imageSmoothingEnabled = true;   // downscale smoothing is desirable here
  c.drawImage(img, srcX, 0, srcW, img.height, 0, 0, w, h);
  const data = c.getImageData(0, 0, w, h);
  const texels = new Uint32Array(data.data.buffer);
  return { texels, w, h, wMask: w - 1, hMask: h - 1, ready: true,
    ...(kind === "tile" ? { mips: buildMipChain(texels, w, h) } : {}),
  };
}

export function textureTargetSize(width: number, height: number, kind: TexKind) {
  if (kind === "tile") return { w: TILE_SIZE, h: TILE_SIZE };
  if (kind === "sky") return { w: Math.min(SKY_W, pow2Ceil(width)), h: Math.min(SKY_H, pow2Ceil(height)) };
  return { w: Math.min(BILLBOARD_MAX, pow2Ceil(width)), h: Math.min(BILLBOARD_MAX, pow2Ceil(height)) };
}

function pow2Ceil(n: number): number { let p = 1; while (p < n) p <<= 1; return p; }

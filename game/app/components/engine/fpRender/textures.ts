import { getSprite, SPRITES } from "../sprites";

export type TexKind = "tile" | "sky" | "billboard";

export interface Texture {
  texels: Uint32Array;
  w: number; h: number;
  wMask: number; hMask: number;   // pow2 masks (w-1 / h-1); tile+sky are always pow2
  ready: boolean;                 // false while serving fallback texels
}

const TILE_SIZE = 128;
const SKY_W = 512, SKY_H = 256;
const BILLBOARD_MAX = 256;
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
  let w: number, h: number, srcX = 0, srcW = img.width;
  if (kind === "tile") { w = TILE_SIZE; h = TILE_SIZE; }
  else if (kind === "sky") { w = SKY_W; h = SKY_H; }
  else {
    // billboards keep native size capped, rounded up to pow2 for masking
    w = Math.min(BILLBOARD_MAX, pow2Ceil(img.width));
    h = Math.min(BILLBOARD_MAX, pow2Ceil(img.height));
  }
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
  return { texels: new Uint32Array(data.data.buffer), w, h, wMask: w - 1, hMask: h - 1, ready: true };
}

function pow2Ceil(n: number): number { let p = 1; while (p < n) p <<= 1; return p; }

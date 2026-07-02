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
  private pending: { id: number; path: string; kind: TexKind }[] = [];

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
    this.pending.push({ id, path, kind });
    return id;
  }

  get(id: number): Texture { return this.textures[id]; }

  /** Called once per frame (cheap): decode any images that finished loading. */
  refresh(): void {
    if (this.pending.length === 0) return;
    this.pending = this.pending.filter(({ id, path, kind }) => {
      const img = getSprite(path);
      if (!img) return true;                       // still loading — keep pending
      this.textures[id] = decode(img, path, kind);
      return false;
    });
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

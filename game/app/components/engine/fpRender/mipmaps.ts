export interface TextureLevel {
  texels: Uint32Array;
  w: number;
  h: number;
  wMask: number;
  hMask: number;
}

/** Tile textures are opaque, so a box average preserves their distant color
 * without the bright/dark alternation of undersampled individual texels. */
export function buildMipChain(texels: Uint32Array, w: number, h: number): TextureLevel[] {
  const levels: TextureLevel[] = [{ texels, w, h, wMask: w - 1, hMask: h - 1 }];
  while (w > 1 || h > 1) {
    const nextW = Math.max(1, w >> 1), nextH = Math.max(1, h >> 1);
    const next = new Uint32Array(nextW * nextH);
    for (let y = 0; y < nextH; y++) for (let x = 0; x < nextW; x++) {
      const sx = Math.min(w - 1, x * 2), sy = Math.min(h - 1, y * 2);
      const a = texels[sy * w + sx], b = texels[sy * w + Math.min(w - 1, sx + 1)];
      const c = texels[Math.min(h - 1, sy + 1) * w + sx], d = texels[Math.min(h - 1, sy + 1) * w + Math.min(w - 1, sx + 1)];
      const r = ((a & 255) + (b & 255) + (c & 255) + (d & 255)) >> 2;
      const g = (((a >>> 8) & 255) + ((b >>> 8) & 255) + ((c >>> 8) & 255) + ((d >>> 8) & 255)) >> 2;
      const blue = (((a >>> 16) & 255) + ((b >>> 16) & 255) + ((c >>> 16) & 255) + ((d >>> 16) & 255)) >> 2;
      const alpha = ((a >>> 24) + (b >>> 24) + (c >>> 24) + (d >>> 24)) >> 2;
      next[y * nextW + x] = (alpha << 24) | (blue << 16) | (g << 8) | r;
    }
    texels = next; w = nextW; h = nextH;
    levels.push({ texels, w, h, wMask: w - 1, hMask: h - 1 });
  }
  return levels;
}

/** World-space width of one screen pixel, assuming the runtime's 256px tiles. */
export function mipForFootprint(worldPixelFootprint: number): number {
  return Math.max(0, Math.floor(Math.log2(Math.max(1, worldPixelFootprint * 256))));
}

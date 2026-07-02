export interface RgbMul { rMul: number; gMul: number; bMul: number } // 0–256 fixed point

/** Convert the existing dayNightTint HSL shift into RGB multipliers.
 *  hueShift > 0 warms (R up, B down); saturationMul pulls channels toward
 *  their mean; lightnessMul scales. tintForHour(12) = {0,1,1} → identity. */
export function hslShiftToRgbMul(t: { hueShift: number; saturationMul: number; lightnessMul: number }): RgbMul {
  const L = t.lightnessMul;
  const warm = t.hueShift * 0.006;
  let r = L * (1 + warm), g = L * (1 + warm * 0.25), b = L * (1 - warm);
  r = L + (r - L) * t.saturationMul;
  g = L + (g - L) * t.saturationMul;
  b = L + (b - L) * t.saturationMul;
  const fx = (v: number) => Math.max(0, Math.min(320, Math.round(v * 256)));
  return { rMul: fx(r), gMul: fx(g), bMul: fx(b) };
}

export const IDENTITY_TINT: RgbMul = { rMul: 256, gMul: 256, bMul: 256 };

/** Per-tile RGB light multipliers, 0–320 fixed point (256 = neutral). */
export interface LightGrid { r: Int16Array; g: Int16Array; b: Int16Array; w: number; h: number }

/** Parsed point-light shape (RGB already split out of the authored hex color).
 *  Canonical owner of this shape — sceneInput.ts imports it for RenderScene
 *  rather than redeclaring it inline (sceneInput already imports from this
 *  module for RgbMul/LightGrid, so importing one more type adds no new edge
 *  and cannot create a cycle: lighting.ts never imports from sceneInput.ts). */
export interface LightGridPointLight { x: number; y: number; r: number; g: number; b: number; power: number }

/**
 * Recomputed once per frame, sized to map dimensions. Combines a per-tile
 * baseLight map (0–255, null = uniform 255) with the environment tint and any
 * point lights (inverse-square falloff in tile units, no sqrt). Reuse the
 * previous grid via `out` when dimensions match — callers own the persisted
 * instance (SceneBuilder, via the RenderScene it reuses across frames) so this
 * stays allocation-free at steady state.
 */
export function buildLightGrid(
  w: number, h: number,
  baseLight: Uint8Array | null,
  lights: LightGridPointLight[],
  tint: RgbMul,
  out?: LightGrid,
): LightGrid {
  const g = out && out.w === w && out.h === h ? out
    : { r: new Int16Array(w * h), g: new Int16Array(w * h), b: new Int16Array(w * h), w, h };
  for (let i = 0; i < w * h; i++) {
    const base = baseLight ? baseLight[i] : 255;                 // 0–255
    // Math.round((base/255) * tintMul) — NOT (base*tintMul)>>8, which yields 255
    // for the neutral case and fails the identity test / dims every golden.
    let r = Math.round((base / 255) * tint.rMul);
    let gg = Math.round((base / 255) * tint.gMul);
    let b = Math.round((base / 255) * tint.bMul);
    const cx = (i % w) + 0.5, cy = ((i / w) | 0) + 0.5;
    for (const L of lights) {
      const dx = cx - L.x, dy = cy - L.y;
      const f = L.power / (1 + dx * dx + dy * dy);               // no sqrt
      r += L.r * f; gg += L.g * f; b += L.b * f;
    }
    g.r[i] = r > 320 ? 320 : r; g.g[i] = gg > 320 ? 320 : gg; g.b[i] = b > 320 ? 320 : b;
  }
  return g;
}

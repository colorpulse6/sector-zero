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

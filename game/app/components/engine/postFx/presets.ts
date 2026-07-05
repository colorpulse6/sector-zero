/** Grade presets for the post-FX color-grade pass.
 *
 *  This module owns the AUTHORITATIVE `GradeParams` type (the set of uniforms the
 *  grade fragment shader consumes) plus the named presets and the mode→preset
 *  selection seam. gradeGL.ts imports the type from here; index.ts re-exports it,
 *  so all four postFx modules agree on one shape.
 *
 *  Build safety: plain data + a pure function — no GL, no DOM, nothing evaluated
 *  beyond object/number literals — so this is safe in Next's static-export
 *  prerender graph (see the build note in ./gradeGL.ts). */

/** Per-frame grading parameters, one field per grade-shader uniform. Consumed by
 *  gradeGL's uploadAndDraw (which pushes each into the compiled program) and the
 *  DOOM grade fragment in shaders.ts. Tints are linear-ish [r,g,b] in 0..1. */
export interface GradeParams {
  /** Black point lifted to 0 by the tone curve — everything below this luma is
   *  crushed to black. Keep small; large values swallow shadow detail. */
  blackPoint: number;
  /** Contrast multiplier pivoted on mid-gray (0.5). 1 = none. Kept gentle so
   *  midtone HUD/dialog text is not clipped. */
  contrast: number;
  /** Color shadows are pulled toward (dark warm brown for the DOOM look). */
  shadowTint: readonly [number, number, number];
  /** Color highlights are pulled toward (hellfire orange for the DOOM look). */
  highlightTint: readonly [number, number, number];
  /** How far the split-tone lerps the image toward the tints, 0..1. Low = subtle
   *  warm cast; high = full recolor. */
  tintStrength: number;
  /** Edge-darkening amount, 0..1. Fraction of brightness removed at the extreme
   *  corners; 0 = no vignette. */
  vignetteStrength: number;
  /** Peak-to-peak film-grain amplitude added per pixel, 0..1. Subtle by design. */
  grainStrength: number;
}

/** Legibility-safe restrained-DOOM default. Every mode maps to this today; the
 *  values are tuned for a warm, low-saturation, mildly contrasty look that never
 *  clips the midtones the HUD, FP gun, and dialog boxes are drawn in.
 *
 *  Tints are the exact 8-bit hex targets converted to 0..1:
 *    shadowTint    #1a0f08  → (26,15,8)/255
 *    highlightTint #ff5a1e  → (255,90,30)/255 */
export const DEFAULT: GradeParams = {
  blackPoint: 0.04,
  contrast: 1.15,
  shadowTint: [0.102, 0.059, 0.031],
  highlightTint: [1.0, 0.353, 0.118],
  tintStrength: 0.18,
  vignetteStrength: 0.22,
  grainStrength: 0.04,
};

/** Select the grade preset for a game mode. Per-scene presets (e.g. a hotter
 *  cast in the FP hell levels, a cooler one in space) are a LATER task — this is
 *  the seam where that mapping will hang. For now every mode returns DEFAULT. */
export function selectPreset(mode: string): GradeParams {
  // `mode` is intentionally unmapped for now — referenced so it is not flagged
  // as unused and so the seam's signature is stable when presets are added.
  void mode;
  return DEFAULT;
}

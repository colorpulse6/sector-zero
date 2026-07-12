/** Grade presets for the post-FX color-grade pass.
 *
 *  This module owns the AUTHORITATIVE `GradeParams` type (the set of uniforms the
 *  grade fragment shader consumes) plus the named presets and the scene→preset
 *  selection seam. gradeGL.ts imports the type from here; index.ts re-exports it,
 *  so all four postFx modules agree on one shape.
 *
 *  Build safety: plain data + a pure function — no GL, no DOM, nothing evaluated
 *  beyond object/number literals — so this is safe in Next's static-export
 *  prerender graph (see the build note in ./gradeGL.ts). */

import type { GameMode } from "../types";

/** Per-frame grading parameters, one field per grade-shader uniform. Consumed by
 *  gradeGL's uploadAndDraw (which pushes each into the compiled programs) and the
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
  /** Bright-pass luma cutoff, 0..1 — only pixels ABOVE this feed the bloom
   *  chain. Kept high so just the strong emissives glow, never HUD midtones. */
  bloomThreshold: number;
  /** Additive strength of the blurred bloom buffer in the final composite,
   *  0..~1. 0 disables bloom's visible contribution (the chain still runs). */
  bloomStrength: number;
  /** Edge-darkening amount, 0..1. Fraction of brightness removed at the extreme
   *  corners; 0 = no vignette. */
  vignetteStrength: number;
  /** Peak-to-peak film-grain amplitude added per pixel, 0..1. Subtle by design. */
  grainStrength: number;
}

/** Scene key for preset selection: a live game mode, or "menu" for every
 *  non-gameplay surface (start screen, cockpit, star map, intro, ending). */
export type GradeScene = GameMode | "menu";

/** Legibility-safe restrained-DOOM default. Menus and any unmapped scene get
 *  this; the values are tuned for a warm, low-saturation, mildly contrasty look
 *  that never clips the midtones the HUD, FP gun, and dialog boxes are drawn in.
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
  bloomThreshold: 0.75,
  bloomStrength: 0.35,
  vignetteStrength: 0.22,
  grainStrength: 0.04,
};

/** Cold dead UAC-register tech-base: steel-blue shadows, pale highlights, the
 *  least warm cast. Ashfall colony + ship interiors (spec §2: "the Ashfall
 *  outpost is the tech-base"). */
export const TECHBASE: GradeParams = {
  // Dark-scene safe: the FP/colony interiors this preset serves already sit
  // near black, so blackPoint/contrast stay gentle — the register comes from
  // the cool tint, not from crushing (playtest 2026-07-12: harder curves
  // deleted wall detail in the raycaster's dim scenes).
  blackPoint: 0.02,
  contrast: 1.08,
  shadowTint: [0.039, 0.063, 0.086], // #0a1016 steel-blue
  highlightTint: [1.0, 0.85, 0.7], // pale warm-white
  tintStrength: 0.14,
  bloomThreshold: 0.8,
  bloomStrength: 0.3,
  vignetteStrength: 0.22,
  grainStrength: 0.05,
};

/** Hot demonic-corruption register: deep ember shadows, hellfire highlights,
 *  the strongest cast and bloom. The FP descent (spec §2: "the FP descent
 *  drops into the corruption"). */
export const HELL: GradeParams = {
  // Dark-scene safe like TECHBASE (the FP descent is the game's darkest
  // surface): heat comes from the strong ember/hellfire split-tone and the
  // hot bloom, NOT from the curve — blackPoint 0.06 + contrast 1.22 crushed
  // the dungeon walls to invisibility in the 2026-07-12 playtest.
  blackPoint: 0.02,
  contrast: 1.1,
  shadowTint: [0.102, 0.031, 0.024], // #1a0806 ember-black
  highlightTint: [1.0, 0.235, 0.078], // #ff3c14 hellfire
  tintStrength: 0.24,
  bloomThreshold: 0.65,
  bloomStrength: 0.55,
  vignetteStrength: 0.26,
  grainStrength: 0.05,
};

/** Punchier combat grade for the action modes: DEFAULT's warmth with harder
 *  contrast and more emissive bloom (plasma, engine trails, explosions). */
export const COMBAT: GradeParams = {
  blackPoint: 0.05,
  contrast: 1.22,
  shadowTint: [0.102, 0.059, 0.031],
  highlightTint: [1.0, 0.353, 0.118],
  tintStrength: 0.16,
  bloomThreshold: 0.7,
  bloomStrength: 0.45,
  vignetteStrength: 0.24,
  grainStrength: 0.04,
};

/** Mode → preset. Typed against the GameMode union so a renamed mode is a
 *  compile error here, not a silent fall-through to DEFAULT. */
const MODE_PRESET: Record<GameMode, GradeParams> = {
  "shooter": COMBAT,
  "turret": COMBAT,
  "ground-run": DEFAULT,
  "boarding": TECHBASE,
  "first-person": HELL,
  "colony-exploration": TECHBASE,
  "base-defense": COMBAT,
  "mech-duel": COMBAT,
};

/** Select the grade preset for a scene. Menus (and anything unmapped at
 *  runtime) fall back to DEFAULT. The present loop lerps between presets, so
 *  scene switches fade rather than pop. */
export function selectPreset(scene: GradeScene): GradeParams {
  if (scene === "menu") return DEFAULT;
  return MODE_PRESET[scene] ?? DEFAULT;
}

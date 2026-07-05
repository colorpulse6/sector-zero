/** GLSL ES 1.00 (WebGL1) shader sources for the post-FX color-grade pass.
 *
 *  These are plain strings — no GL objects, no DOM, nothing evaluated at import
 *  time — so this module is safe to sit in Next's static-export prerender graph
 *  (see the build note in ./gradeGL.ts). Actual compilation happens at runtime
 *  inside createGradeGL.
 *
 *  The pass draws a single fullscreen TRIANGLE (not a quad): 3 clip-space verts
 *  at (-1,-1), (3,-1), (-1,3) whose interior fully covers the [-1,1]² viewport,
 *  so one draw call re-presents the whole source with no seam and no index
 *  buffer. UVs are derived from position in the vertex shader, so the only
 *  vertex attribute is the 2D clip-space position. */

/** Fullscreen-triangle vertex shader. Maps clip position → [0,1] UV; the
 *  visible square samples UV in [0,1]², matching the source texture. */
export const VERT_SRC = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

/** Identity fragment shader — passthrough of the source texture. Kept as the
 *  documented baseline / reference; the active pass compiles FRAG_GRADE_SRC
 *  below. (The pass no-ops entirely while disabled, so identity is not needed as
 *  a runtime fallback.) */
export const FRAG_IDENTITY_SRC = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uSrc;
void main() {
  gl_FragColor = texture2D(uSrc, vUv);
}
`;

/** DOOM color-grade fragment shader. A single pass runs, in order:
 *    1. tone curve       — crush blacks to uBlackPoint, gentle contrast on 0.5
 *    2. warm split-tone  — lerp toward uShadowTint (shadows) / uHighlightTint
 *                          (highlights) by luma, scaled by uTintStrength
 *    3. vignette         — quadratic edge darkening scaled by uVignette
 *    4. film grain       — fine per-pixel noise, animated by uTime (uGrain amp)
 *
 *  Legibility is a hard constraint: the HUD/dashboard and the FP gun + dialog
 *  boxes are drawn INTO the source canvas, so the tone curve pivots on mid-gray
 *  and stays gentle (midtones barely move), the split-tone strength is low, and
 *  grain amplitude is tiny — none of these clip the text these layers rely on.
 *
 *  Every declared uniform is consumed below, so none get optimized out (an
 *  unused uniform would make getUniformLocation return null and silently no-op).
 *
 *  Precision: the grain hash multiplies by a large constant, which needs highp
 *  to avoid banding; we opt into highp where the fragment stage supports it and
 *  fall back to mediump (grain may band slightly) elsewhere so the shader still
 *  compiles rather than failing the whole pass.
 *
 *  NOT here: additive highlight bloom (a LATER task — a clearly marked seam sits
 *  between split-tone and vignette) and depth haze (intentionally absent — this
 *  is a post-composite grade over a flat 2D canvas with no depth buffer). */
export const FRAG_GRADE_SRC = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 vUv;

uniform sampler2D uSrc;
uniform float uBlackPoint;
uniform float uContrast;
uniform vec3  uShadowTint;
uniform vec3  uHighlightTint;
uniform float uTintStrength;
uniform float uVignette;
uniform float uGrain;
uniform float uTime;

const vec3 LUMA = vec3(0.299, 0.587, 0.114);

void main() {
  vec4 src = texture2D(uSrc, vUv);
  vec3 color = src.rgb;

  // 1) Tone curve: remap [uBlackPoint, 1] -> [0, 1] (crush blacks), then a gentle
  //    contrast expansion pivoted on mid-gray so 0.5 is a fixed point and midtone
  //    text barely shifts. Clamp before the tint so later steps see valid colour.
  color = max(color - uBlackPoint, 0.0) / max(1.0 - uBlackPoint, 1e-4);
  color = (color - 0.5) * uContrast + 0.5;
  color = clamp(color, 0.0, 1.0);

  // 2) Warm split-tone: pick a per-pixel target between the shadow and highlight
  //    tints by luma, then lerp the colour toward it. Low strength = subtle warm,
  //    low-saturation cast rather than a full recolour.
  float luma = dot(color, LUMA);
  vec3 splitTarget = mix(uShadowTint, uHighlightTint, luma);
  color = mix(color, splitTarget, uTintStrength);

  // ---- BLOOM COMPOSITE SEAM (LATER TASK) --------------------------------------
  // Additive highlight bloom will composite over \`color\` HERE, after the tint and
  // before the vignette/grain. Not built yet: no bloom target or uniform exists.
  // (Do not add depth haze here — flat 2D source, no depth buffer.)
  // -----------------------------------------------------------------------------

  // 3) Vignette: quadratic radial falloff from centre, so darkening concentrates
  //    in the corners; centre (and thus most gameplay) is untouched.
  vec2 vd = vUv - 0.5;
  float vig = 1.0 - uVignette * dot(vd, vd) * 2.0;
  color *= vig;

  // 4) Film grain: high-frequency hash of the UV, phase-shifted by uTime so it
  //    re-randomises every frame. The fract() of a large-scaled sin amplifies the
  //    per-frame phase delta into fresh per-pixel noise. uGrain is peak-to-peak.
  float g = fract(sin(dot(vUv, vec2(12.9898, 78.233)) + uTime) * 43758.5453);
  color += (g - 0.5) * uGrain;

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), src.a);
}
`;

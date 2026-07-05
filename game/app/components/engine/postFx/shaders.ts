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

/** Identity fragment shader — passthrough of the source texture. Layer A of the
 *  visual overhaul lands the plumbing here; real grading (exposure/contrast/
 *  tint/vignette) replaces this body in a later task. */
export const FRAG_IDENTITY_SRC = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uSrc;
void main() {
  gl_FragColor = texture2D(uSrc, vUv);
}
`;

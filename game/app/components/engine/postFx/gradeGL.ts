/** WebGL1 backend for the post-FX color-grade pass.
 *
 *  ── BUILD CONSTRAINT (read before editing) ──────────────────────────────
 *  This app is a static export (`output: 'export'`), so every module in the
 *  import graph is EVALUATED during `next build`'s prerender. Touching
 *  `window`/`document`/WebGL at module scope breaks `yarn build`. Everything
 *  here that reaches for a GL context or the DOM therefore lives INSIDE
 *  createGradeGL / the returned closures, which only ever run client-side at
 *  runtime — nothing runs at import time. This mirrors the same rule documented
 *  in ../fpRender/index.ts (lazy localStorage init) and
 *  ../fpRender/framebuffer.ts (lazy present-canvas creation).
 *
 *  ── FRAME PIPELINE ───────────────────────────────────────────────────────
 *  1. upload   — texImage2D(source canvas) into srcTex (flipped upright)
 *  2. bright   — srcTex → half-res FBO A (luma threshold, dashboard masked)
 *  3. blur H   — FBO A → FBO B (separable Gaussian)
 *  4. blur V   — FBO B → FBO A
 *  5. grade    — srcTex + FBO A (bloom) → default framebuffer (the canvas):
 *                tone curve → split-tone → +bloom → vignette → grain
 *
 *  Static state (attrib pointer, flip-Y, sampler bindings that never change)
 *  is set ONCE at init: aPos is bound to attribute location 0 in every program
 *  pre-link, so one vertexAttribPointer setup serves all passes.
 *
 *  Fail-soft: createGradeGL returns `null` (never throws) when a context can't
 *  be created or a program can't be built, so callers can no-op safely on
 *  machines without WebGL. */

import { VERT_SRC, FRAG_BRIGHT_SRC, FRAG_BLUR_SRC, FRAG_GRADE_SRC } from "./shaders";
import type { GradeParams } from "./presets";

// GradeParams is owned by ./presets (the authoritative uniform shape). Re-export
// it so index.ts keeps importing the whole surface from this module.
export type { GradeParams };

/** Runtime handle over the compiled programs + GPU resources. */
export interface GradeGL {
  /** Run the full pipeline: upload `source`, build the bloom buffer, draw the
   *  graded composite onto the GL canvas (plus an internal time uniform for
   *  the animated grain). */
  uploadAndDraw(source: HTMLCanvasElement, params: GradeParams): void;
  /** Delete every GL object this handle owns. Idempotent. */
  dispose(): void;
}

/** Compile one shader stage; returns null (after cleanup) on failure. */
function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  src: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/** Compile + link one pass program; returns null (after cleanup) on any
 *  failure. `aPos` is bound to attribute location 0 BEFORE linking so every
 *  pass shares one attribute setup. Shaders are deleted post-link — the linked
 *  program keeps its own copies. */
function buildProgram(gl: WebGLRenderingContext, fragSrc: string): WebGLProgram | null {
  const vert = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
  if (!vert) return null;
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  if (!frag) {
    gl.deleteShader(vert);
    return null;
  }
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    return null;
  }
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.bindAttribLocation(program, 0, "aPos");
  gl.linkProgram(program);
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

/** One half-res render target (texture + FBO). */
interface Target {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
}

function createTarget(gl: WebGLRenderingContext, w: number, h: number): Target | null {
  const tex = gl.createTexture();
  if (!tex) return null;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  const fbo = gl.createFramebuffer();
  if (!fbo) {
    gl.deleteTexture(tex);
    return null;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (!ok) {
    gl.deleteFramebuffer(fbo);
    gl.deleteTexture(tex);
    return null;
  }
  return { tex, fbo };
}

/** Create the WebGL1 grade backend bound to `glCanvas`. Returns null (never
 *  throws) if the context or any program/target is unavailable — callers treat
 *  null as "grading disabled" and pass frames through untouched. */
export function createGradeGL(glCanvas: HTMLCanvasElement): GradeGL | null {
  // Explicit attrs: alpha + premultiplied so the (opaque-output) graded canvas
  // composites over the game canvas beneath it; no depth/AA/preserved buffer —
  // this is a fullscreen blit chain redrawn every frame.
  const context = glCanvas.getContext("webgl", {
    alpha: true,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    antialias: false,
  });
  if (!context) return null;
  // Rebind to a non-null const: the `if (!context) return` narrowing above is
  // not carried into the nested closures, so they'd see a nullable type.
  const gl: WebGLRenderingContext = context;

  const fullW = glCanvas.width;
  const fullH = glCanvas.height;
  const halfW = Math.max(1, Math.floor(fullW / 2));
  const halfH = Math.max(1, Math.floor(fullH / 2));

  // ── Programs (aPos pre-bound to location 0 in each) ──
  const brightProg = buildProgram(gl, FRAG_BRIGHT_SRC);
  const blurProg = buildProgram(gl, FRAG_BLUR_SRC);
  const gradeProg = buildProgram(gl, FRAG_GRADE_SRC);
  const cleanupPrograms = () => {
    if (brightProg) gl.deleteProgram(brightProg);
    if (blurProg) gl.deleteProgram(blurProg);
    if (gradeProg) gl.deleteProgram(gradeProg);
  };
  if (!brightProg || !blurProg || !gradeProg) {
    cleanupPrograms();
    return null;
  }

  // ── Fullscreen triangle + one-time attribute state (location 0 everywhere) ──
  const buffer = gl.createBuffer();
  if (!buffer) {
    cleanupPrograms();
    return null;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // ── Uniform locations, cached once per program ──
  const uBrightSrc = gl.getUniformLocation(brightProg, "uSrc");
  const uBrightThreshold = gl.getUniformLocation(brightProg, "uBloomThreshold");

  const uBlurSrc = gl.getUniformLocation(blurProg, "uSrc");
  const uBlurTexel = gl.getUniformLocation(blurProg, "uTexel");
  const uBlurDir = gl.getUniformLocation(blurProg, "uDir");

  const uSrc = gl.getUniformLocation(gradeProg, "uSrc");
  const uBloom = gl.getUniformLocation(gradeProg, "uBloom");
  const uBloomStrength = gl.getUniformLocation(gradeProg, "uBloomStrength");
  const uBlackPoint = gl.getUniformLocation(gradeProg, "uBlackPoint");
  const uContrast = gl.getUniformLocation(gradeProg, "uContrast");
  const uShadowTint = gl.getUniformLocation(gradeProg, "uShadowTint");
  const uHighlightTint = gl.getUniformLocation(gradeProg, "uHighlightTint");
  const uTintStrength = gl.getUniformLocation(gradeProg, "uTintStrength");
  const uVignette = gl.getUniformLocation(gradeProg, "uVignette");
  const uGrain = gl.getUniformLocation(gradeProg, "uGrain");
  const uTime = gl.getUniformLocation(gradeProg, "uTime");

  // One-time sampler bindings: source always sits on unit 0, bloom on unit 1.
  gl.useProgram(brightProg);
  if (uBrightSrc) gl.uniform1i(uBrightSrc, 0);
  gl.useProgram(blurProg);
  if (uBlurSrc) gl.uniform1i(uBlurSrc, 0);
  if (uBlurTexel) gl.uniform2f(uBlurTexel, 1 / halfW, 1 / halfH);
  gl.useProgram(gradeProg);
  if (uSrc) gl.uniform1i(uSrc, 0);
  if (uBloom) gl.uniform1i(uBloom, 1);

  // ── Source texture — re-uploaded from the game canvas each frame ──
  const srcTex = gl.createTexture();
  if (!srcTex) {
    gl.deleteBuffer(buffer);
    cleanupPrograms();
    return null;
  }
  gl.bindTexture(gl.TEXTURE_2D, srcTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  // ── Half-res bloom ping-pong targets ──
  const targetA = createTarget(gl, halfW, halfH);
  const targetB = createTarget(gl, halfW, halfH);
  if (!targetA || !targetB) {
    if (targetA) {
      gl.deleteFramebuffer(targetA.fbo);
      gl.deleteTexture(targetA.tex);
    }
    gl.deleteTexture(srcTex);
    gl.deleteBuffer(buffer);
    cleanupPrograms();
    return null;
  }

  // FLIP_Y aligns canvas top-left origin with GL's bottom-left texture origin;
  // it only affects texImage2D uploads, so set once. (FBO passes render
  // in-orientation — no flip needed between them.)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  let disposed = false;

  function uploadAndDraw(source: HTMLCanvasElement, params: GradeParams): void {
    if (disposed) return;

    // 1) Upload the freshly-drawn game canvas.
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

    // 2) Bright-pass → half-res A.
    gl.useProgram(brightProg);
    gl.uniform1f(uBrightThreshold, params.bloomThreshold);
    gl.bindFramebuffer(gl.FRAMEBUFFER, targetA!.fbo);
    gl.viewport(0, 0, halfW, halfH);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 3) Horizontal blur A → B, then 4) vertical blur B → A.
    gl.useProgram(blurProg);
    gl.uniform2f(uBlurDir, 1, 0);
    gl.bindTexture(gl.TEXTURE_2D, targetA!.tex);
    gl.bindFramebuffer(gl.FRAMEBUFFER, targetB!.fbo);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.uniform2f(uBlurDir, 0, 1);
    gl.bindTexture(gl.TEXTURE_2D, targetB!.tex);
    gl.bindFramebuffer(gl.FRAMEBUFFER, targetA!.fbo);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 5) Final grade → the canvas. uTime is a 2π-wrapped seconds phase (small
    // value keeps the grain hash precise on all hardware).
    gl.useProgram(gradeProg);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, fullW, fullH);
    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, targetA!.tex);
    gl.activeTexture(gl.TEXTURE0);
    const uTimeValue = (performance.now() * 0.001) % (Math.PI * 2.0);
    gl.uniform1f(uBloomStrength, params.bloomStrength);
    gl.uniform1f(uBlackPoint, params.blackPoint);
    gl.uniform1f(uContrast, params.contrast);
    gl.uniform3f(uShadowTint, params.shadowTint[0], params.shadowTint[1], params.shadowTint[2]);
    gl.uniform3f(uHighlightTint, params.highlightTint[0], params.highlightTint[1], params.highlightTint[2]);
    gl.uniform1f(uTintStrength, params.tintStrength);
    gl.uniform1f(uVignette, params.vignetteStrength);
    gl.uniform1f(uGrain, params.grainStrength);
    gl.uniform1f(uTime, uTimeValue);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    gl.deleteFramebuffer(targetA!.fbo);
    gl.deleteTexture(targetA!.tex);
    gl.deleteFramebuffer(targetB!.fbo);
    gl.deleteTexture(targetB!.tex);
    gl.deleteTexture(srcTex);
    gl.deleteBuffer(buffer);
    cleanupPrograms();
  }

  return { uploadAndDraw, dispose };
}

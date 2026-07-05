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
 *  Fail-soft: createGradeGL returns `null` (never throws) when a context can't
 *  be created or the program can't be built, so callers can no-op safely on
 *  machines without WebGL. */

import { VERT_SRC, FRAG_GRADE_SRC } from "./shaders";
import type { GradeParams } from "./presets";

// GradeParams is owned by ./presets (the authoritative uniform shape). Re-export
// it so index.ts keeps importing the whole surface from this module.
export type { GradeParams };

/** Runtime handle over the compiled program + GPU resources. */
export interface GradeGL {
  /** Upload `source` into the sampler and draw the fullscreen triangle onto the
   *  GL canvas, applying the DOOM grade with `params` (plus an internal time
   *  uniform for the animated grain). */
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

/** Compile + link the grade program; returns null (after cleanup) on any
 *  failure. Shaders are deleted post-link — the linked program keeps its own
 *  copies, so the flagged-for-delete shaders are freed once detached. */
function buildProgram(gl: WebGLRenderingContext): WebGLProgram | null {
  const vert = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
  if (!vert) return null;
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_GRADE_SRC);
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
  gl.linkProgram(program);
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

/** Create the WebGL1 grade backend bound to `glCanvas`. Returns null (never
 *  throws) if the context or program is unavailable — callers treat null as
 *  "grading disabled" and pass frames through untouched. */
export function createGradeGL(glCanvas: HTMLCanvasElement): GradeGL | null {
  // Explicit attrs: alpha + premultiplied so the graded canvas composites over
  // the game canvas beneath it; no depth/AA/preserved buffer — this is a single
  // opaque fullscreen blit redrawn every frame.
  const context = glCanvas.getContext("webgl", {
    alpha: true,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    antialias: false,
  });
  if (!context) return null;
  // Rebind to a non-null const: the `if (!context) return` narrowing above is
  // not carried into the nested uploadAndDraw/dispose closures, so they'd see
  // `WebGLRenderingContext | null` and error. A fresh typed const fixes capture.
  const gl: WebGLRenderingContext = context;

  const program = buildProgram(gl);
  if (!program) return null;

  // Fullscreen triangle: 3 clip-space verts covering [-1,1]². One static buffer,
  // one attribute (position); UVs are derived in the vertex shader.
  const buffer = gl.createBuffer();
  if (!buffer) {
    gl.deleteProgram(program);
    return null;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );

  const aPos = gl.getAttribLocation(program, "aPos");
  const uSrc = gl.getUniformLocation(program, "uSrc");

  // Grade uniform locations, cached once. Every one is consumed by FRAG_GRADE_SRC,
  // so none should come back null on a successful link; setting a null location is
  // a WebGL no-op regardless, so uploadAndDraw stays fail-soft either way.
  const uBlackPoint = gl.getUniformLocation(program, "uBlackPoint");
  const uContrast = gl.getUniformLocation(program, "uContrast");
  const uShadowTint = gl.getUniformLocation(program, "uShadowTint");
  const uHighlightTint = gl.getUniformLocation(program, "uHighlightTint");
  const uTintStrength = gl.getUniformLocation(program, "uTintStrength");
  const uVignette = gl.getUniformLocation(program, "uVignette");
  const uGrain = gl.getUniformLocation(program, "uGrain");
  const uTime = gl.getUniformLocation(program, "uTime");

  // Source texture — re-uploaded from the game canvas each frame. CLAMP + LINEAR
  // is standard for a same-size present; the min filter is LINEAR (no mipmaps)
  // because we never generate mips for a per-frame-replaced texture.
  const texture = gl.createTexture();
  if (!texture) {
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    return null;
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  let disposed = false;

  function uploadAndDraw(source: HTMLCanvasElement, params: GradeParams): void {
    if (disposed) return;
    gl.useProgram(program);

    // Bind + upload the source. FLIP_Y aligns canvas top-left origin with GL's
    // bottom-left texture origin so the presented image is upright.
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    if (uSrc) gl.uniform1i(uSrc, 0);

    // Push the grade params into the program. Null locations no-op, so this is
    // safe even if a driver optimized a uniform out. uTime is a 2π-wrapped
    // seconds phase read at draw time (runtime-only — performance.now() is fine
    // here, never at module scope) that animates the grain each frame; the wrap
    // keeps the value small so the grain hash stays precise on all hardware.
    const uTimeValue = (performance.now() * 0.001) % (Math.PI * 2.0);
    gl.uniform1f(uBlackPoint, params.blackPoint);
    gl.uniform1f(uContrast, params.contrast);
    gl.uniform3f(uShadowTint, params.shadowTint[0], params.shadowTint[1], params.shadowTint[2]);
    gl.uniform3f(uHighlightTint, params.highlightTint[0], params.highlightTint[1], params.highlightTint[2]);
    gl.uniform1f(uTintStrength, params.tintStrength);
    gl.uniform1f(uVignette, params.vignetteStrength);
    gl.uniform1f(uGrain, params.grainStrength);
    gl.uniform1f(uTime, uTimeValue);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.viewport(0, 0, glCanvas.width, glCanvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    gl.deleteTexture(texture);
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
  }

  return { uploadAndDraw, dispose };
}

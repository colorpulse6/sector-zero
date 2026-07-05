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

import { VERT_SRC, FRAG_IDENTITY_SRC } from "./shaders";
import type { GradeParams } from "./presets";

// GradeParams is owned by ./presets (the authoritative uniform shape). Re-export
// it so index.ts keeps importing the whole surface from this module.
export type { GradeParams };

/** Runtime handle over the compiled program + GPU resources. */
export interface GradeGL {
  /** Upload `source` into the sampler and draw the fullscreen triangle onto the
   *  GL canvas. `params` is accepted for forward-compat and ignored by identity. */
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

/** Compile + link the identity program; returns null (after cleanup) on any
 *  failure. Shaders are deleted post-link — the linked program keeps its own
 *  copies, so the flagged-for-delete shaders are freed once detached. */
function buildProgram(gl: WebGLRenderingContext): WebGLProgram | null {
  const vert = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
  if (!vert) return null;
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_IDENTITY_SRC);
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

  function uploadAndDraw(source: HTMLCanvasElement, _params: GradeParams): void {
    if (disposed) return;
    gl.useProgram(program);

    // Bind + upload the source. FLIP_Y aligns canvas top-left origin with GL's
    // bottom-left texture origin so the presented image is upright.
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    if (uSrc) gl.uniform1i(uSrc, 0);

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

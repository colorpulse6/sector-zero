/**
 * Render-core performance bench: frame-time p50/p95 + forced-GC heap delta.
 *
 * Committed (not a throwaway script) so the render-core budget check in
 * docs/superpowers/plans/2026-07-02-fp-pixel-graphics-system.md can be re-run
 * on demand instead of hand-rolled every time a reviewer wants numbers. The
 * forced-GC bracketing pattern below matches the throwaway harness used for
 * the audit in commit 00c7a2d ("fix(engine): hardening pass ... audit
 * evidence") — node v22.19.0, fb 480x714, 120-frame warmup before each
 * measurement bracket — just generalized into scenarios and kept in the tree.
 *
 * Usage:
 *   npx tsx tests/perf/renderBench.ts
 *     Frame-time p50/p95 for every scenario below. Heap delta is still
 *     printed but unforced (noisier — V8 may not have collected everything
 *     between snapshots) if the process wasn't launched with --expose-gc.
 *
 *   npx tsx --expose-gc tests/perf/renderBench.ts
 *     Same, plus a clean forced-GC bracketed heap delta (tsx forwards node
 *     flags placed before the entry file — verified against tsx 4.21.0).
 *
 * NOT a `*.test.ts` file, on purpose: `yarn engine:test` globs
 * `tests/engine/*.test.ts` only, and this lives under `tests/perf/` besides —
 * it will never run as part of that suite. It DOES still typecheck under
 * `npx tsc --noEmit` (Next's tsconfig sweeps every .ts file under game/,
 * recursively), so keep it clean rather than excluding it.
 *
 * Budget context: the design spec's ≤4ms full-res median budget is a CHROME
 * number on the dev machine. Node/V8 here runs measurably higher (different
 * JIT tiering and GC pacing, no compositor) — treat these numbers as a
 * relative, reproducible regression signal against the reference points
 * recorded in the commit history, not a literal pass/fail against 4ms.
 */
import { Framebuffer } from "../../app/components/engine/fpRender/framebuffer";
import { TextureRegistry } from "../../app/components/engine/fpRender/textures";
import { renderScene } from "../../app/components/engine/fpRender/renderCore";
import { tinyScene } from "../engine/fixtures";
import type { RenderScene, BillboardInput } from "../../app/components/engine/fpRender/sceneInput";
import { CANVAS_WIDTH, GAME_AREA_HEIGHT } from "../../app/components/engine/types";

const WARMUP_FRAMES = 120;    // matches the AUTO-downgrade window + the prior audit's bracket warmup
const MEASURED_FRAMES = 300;  // matches the prior audit's standard bracket size

// ─── Synthetic production-scale textures ─────────────────────────────────
// 128x128 (walls/floor/ceiling) and 512x256 (sky) match textures.ts's real
// decode() normalization sizes. The unit tests' 4x4 quadTexture fixtures are
// fine for golden-hash correctness (tiny, deterministic, easy to reason
// about by hand) but sit entirely in L1 cache and understate real per-pixel
// sampling cost — this bench cares about realistic timing, so it generates
// full-size texel arrays instead.
function synthTexture(w: number, h: number, seed: number): Uint32Array {
  const t = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const r = (x * 31 + seed) & 0xff;
      const g = (y * 17 + seed * 7) & 0xff;
      const b = ((x ^ y) * 13 + seed * 3) & 0xff;
      t[y * w + x] = 0xff000000 | (b << 16) | (g << 8) | r;   // always opaque — no free alpha-test skip
    }
  }
  return t;
}

function benchRegistry(): TextureRegistry {
  const reg = new TextureRegistry();
  reg.registerRaw("wall-default", synthTexture(128, 128, 1), 128, 128);  // id 0
  reg.registerRaw("wall-pillar", synthTexture(128, 128, 2), 128, 128);   // id 1
  reg.registerRaw("floor", synthTexture(128, 128, 3), 128, 128);         // id 2
  reg.registerRaw("ceiling", synthTexture(128, 128, 4), 128, 128);       // id 3
  reg.registerRaw("sky", synthTexture(512, 256, 5), 512, 256);           // id 4
  reg.registerRaw("bb-a", synthTexture(128, 128, 6), 128, 128);          // id 5
  reg.registerRaw("bb-b", synthTexture(128, 128, 7), 128, 128);          // id 6
  return reg;
}

// ─── Colony-scale map ─────────────────────────────────────────────────────
// 24x24 — matches the design doc's real colony map size. The unit tests' 8x8
// tinyScene room is deliberately tiny for fast, easy-to-hand-verify pixel
// math, but a closed 8x8 room caps every ray's DDA walk at a few tiles; a
// real map lets sightlines run much longer before a wall (or the 64-step
// guard) stops them, so it understates wall-cast cost. Shared by both
// scenarios below on purpose: the only thing that should differ between the
// "exterior" and "interior double-cast" numbers is the environment art
// (sky vs. cast ceiling), not incidental map-topology differences.
const MAP_SIZE = 24;

function benchMap(): RenderScene["map"] {
  const w = MAP_SIZE, h = MAP_SIZE;
  const solid = new Uint8Array(w * h);
  const wallTexture = new Int16Array(w * h).fill(-1);
  const floorTexture = new Int16Array(w * h).fill(-1);
  for (let x = 0; x < w; x++) { solid[x] = 1; solid[(h - 1) * w + x] = 1; }
  for (let y = 0; y < h; y++) { solid[y * w] = 1; solid[y * w + w - 1] = 1; }
  // A handful of interior pillars (texture id 1) — breaks up sightlines like
  // real colony plazas/interiors without enclosing the camera's start tile.
  const pillars: [number, number][] = [[6, 6], [17, 6], [6, 17], [17, 17], [11, 11], [12, 12]];
  for (const [px, py] of pillars) { solid[py * w + px] = 1; wallTexture[py * w + px] = 1; }
  return { width: w, height: h, solid, wallTexture, floorTexture };
}

function benchBillboards(): BillboardInput[] {
  // 8 mixed billboards (prop/npc/enemy-shaped) scattered around the map —
  // representative of a populated colony plaza, not an empty room.
  const list: BillboardInput[] = [];
  for (let i = 0; i < 8; i++) {
    const kind = i % 3;
    list.push({
      x: 3 + (i % 4) * 5,
      y: 3 + ((i / 4) | 0) * 16,
      texId: 5 + (i % 2),
      scale: 1,
      alpha256: 256,
      widthFactor: kind === 0 ? 0.4 : 1,
      vAnchor: kind === 0 ? "npc" : kind === 1 ? "prop" : "center",
    });
  }
  return list;
}

interface Scenario {
  name: string;
  scene: RenderScene;
  fbW: number;
  fbH: number;
}

function buildScenarios(): Scenario[] {
  const map = benchMap();
  const billboards = benchBillboards();

  // Exterior: sky present -> ceiling painted by panorama sample (top-half
  // loop), only the floor gets the per-row perspective cast.
  const exterior = tinyScene({
    camX: 12, camY: 12, dirX: 1, dirY: 0, planeX: 0, planeY: 0.66,
    map, billboards,
    art: { skyTexId: 4, wallTexId: 0, floorTexId: 2, ceilingTexId: -1 },
    pointLights: [{ x: 12.5, y: 12.5, r: 255, g: 220, b: 180, power: 1 }],
  });

  // Interior double-cast: no sky + a ceiling texture -> the per-row
  // perspective-cast loop does BOTH floor and ceiling (drawEnvironment's
  // `castCeil` branch), roughly doubling that pass's per-pixel cost. Also
  // carries an authored baseLight map and two point lights, matching a real
  // night-colony interior rather than a fully-lit degenerate case.
  const interior = tinyScene({
    camX: 12, camY: 12, dirX: 1, dirY: 0, planeX: 0, planeY: 0.66,
    map, billboards,
    art: { skyTexId: -1, wallTexId: 0, floorTexId: 2, ceilingTexId: 3 },
    baseLight: new Uint8Array(MAP_SIZE * MAP_SIZE).fill(200),
    pointLights: [
      { x: 8.5, y: 8.5, r: 255, g: 200, b: 140, power: 1.2 },
      { x: 16.5, y: 16.5, r: 160, g: 200, b: 255, power: 0.8 },
    ],
  });

  const half = { w: CANVAS_WIDTH / 2, h: GAME_AREA_HEIGHT / 2 };
  return [
    { name: "exterior             @ full 480x714", scene: exterior, fbW: CANVAS_WIDTH, fbH: GAME_AREA_HEIGHT },
    { name: "interior double-cast @ full 480x714", scene: interior, fbW: CANVAS_WIDTH, fbH: GAME_AREA_HEIGHT },
    { name: "exterior             @ half 240x357", scene: exterior, fbW: half.w, fbH: half.h },
    { name: "interior double-cast @ half 240x357", scene: interior, fbW: half.w, fbH: half.h },
  ];
}

// ─── Timing / GC helpers ──────────────────────────────────────────────────

/** Ascending-sorted Float64Array -> the value at percentile p (0-1). */
function percentile(sorted: Float64Array, p: number): number {
  return sorted[Math.floor(p * (sorted.length - 1))];
}

/** Deterministic per-frame camera drift. renderScene has no cache to trip
 *  either way, but a perfectly static camera under-states real gameplay
 *  variance in DDA path length / billboard screen position — this sweeps a
 *  full rotation across the measured window instead. */
function orbit(scene: RenderScene, frame: number): void {
  const a = (frame % 360) * (Math.PI / 180);
  scene.dirX = Math.cos(a); scene.dirY = Math.sin(a);
  scene.planeX = -scene.dirY * 0.66; scene.planeY = scene.dirX * 0.66;
}

function runScenario(reg: TextureRegistry, s: Scenario): void {
  const fb = new Framebuffer(s.fbW, s.fbH);
  const gc = (globalThis as { gc?: () => void }).gc;

  for (let i = 0; i < WARMUP_FRAMES; i++) {
    orbit(s.scene, i);
    renderScene(fb, s.scene, reg);
  }

  gc?.();
  const heapBefore = process.memoryUsage().heapUsed;

  const times = new Float64Array(MEASURED_FRAMES);
  for (let i = 0; i < MEASURED_FRAMES; i++) {
    orbit(s.scene, WARMUP_FRAMES + i);
    const t0 = performance.now();
    renderScene(fb, s.scene, reg);
    times[i] = performance.now() - t0;
  }

  gc?.();
  const heapAfter = process.memoryUsage().heapUsed;

  times.sort();   // TypedArray default sort is ascending numeric (unlike Array's lexicographic default)
  const p50 = percentile(times, 0.5);
  const p95 = percentile(times, 0.95);
  const deltaKB = (heapAfter - heapBefore) / 1024;
  const perFrameBytes = (heapAfter - heapBefore) / MEASURED_FRAMES;

  const gcNote = gc ? "" : "  (heapΔ unforced — run with --expose-gc for a clean reading)";
  console.log(
    `${s.name}  p50 ${p50.toFixed(2).padStart(6)}ms  p95 ${p95.toFixed(2).padStart(6)}ms` +
    `  heapΔ ${deltaKB.toFixed(1).padStart(8)}KB (${perFrameBytes.toFixed(2)}B/frame)${gcNote}`
  );
}

function main(): void {
  const gcAvailable = typeof (globalThis as { gc?: () => void }).gc === "function";
  console.log(`renderBench — node ${process.version}, ${WARMUP_FRAMES}f warmup + ${MEASURED_FRAMES}f measured per scenario, gc=${gcAvailable ? "forced" : "unforced"}\n`);
  const reg = benchRegistry();
  for (const scenario of buildScenarios()) {
    runScenario(reg, scenario);
  }
}

main();

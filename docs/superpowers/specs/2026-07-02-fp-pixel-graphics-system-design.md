# Sector Zero — First-Person Pixel Graphics System

**Date:** 2026-07-02
**Status:** Design approved in session (Sections 1–2 explicitly; 3–5 presented, pending final user read-through), ready for spec review
**Predecessors:**
- `docs/superpowers/specs/2026-04-21-colony-phase-2-fps-descent-design.md` (Phase 2 — the mode this upgrades first)
- `docs/superpowers/specs/2026-04-20-colony-system-design.md` (master spec)
**Scope:** Replace the first-person scene renderer (`firstPersonRenderer.ts` scene path) with a per-pixel software framebuffer pipeline serving **all four FP surfaces** — campaign W5-L3, Kepler black-box mission, Ashfall Forward Camp, colony exploration (exterior + interiors). Adds textured floor/ceiling casting, a tile-grid lighting system, day/night-as-lighting, adaptive internal resolution, and frame-rate-independent movement. Engine simulation (`firstPersonEngine.ts`) is untouched.

---

## Goal

A **better and more robust graphics system** for the FPS modes, with two locked constraints from the user:

1. **Maximize performance.** This is a public app on GitHub Pages; the floor is a mid-range visitor machine, not the dev Mac. Budgets below are sized for hardware 3–4× slower than the dev machine.
2. **No feature flags / migration toggles.** The new renderer replaces the old scene path outright. Safety comes from shippable commits, golden-frame tests, and playtests — not from parallel code paths someone has to remember to delete.

What the player gets, most visibly in the colony descent: the landing pad and foundations become real textured ground instead of minimap-only metadata; plazas get paving; interiors get per-building floors; night colonies get actual darkness with warm point lights at doors and scaffolding; dawn/dusk tint the world through lighting instead of a canvas filter.

---

## Why a per-pixel framebuffer (decision record)

Three approaches were evaluated:

| | A. Per-pixel software framebuffer | B. Incremental Canvas2D | C. WebGL2 |
|---|---|---|---|
| Floor/ceiling casting | native | fakeable, slow path | native |
| Per-pixel lighting/fog/tint | native, integer math | no (stacked fillRect / ctx.filter only) | native |
| Perf ceiling at 480×714 | measured 2.4ms median | unknown, API-bound | highest, but irrelevant at this size |
| Testability | pure function → node-testable golden frames | canvas-bound | context-bound, brittle |
| Rewrite size | ~800–1000 lines, one subsystem | small patches, dead end | largest, new failure modes (context loss, shaders) |

**Chosen: A.** It is the only option that meets the feature set and the performance goal while *increasing* testability. C is deliberately deferred — the `RenderScene` boundary (Section B) would let a WebGL back end slot in later without touching the engine.

### Empirical basis (benchmark, 2026-07-02)

A standalone bench (`2026-07-02-fp-graphics-bench.html`, committed next to this spec) simulated the full proposed pipeline — inline-DDA textured walls, true floor+ceiling perspective casting with per-tile textures, per-pixel fog + 2 point lights + global tint, 8 depth-tested alpha billboards — against a faithful replica of the current renderer's technique, over a 24×24 scene with an orbiting camera. Median CPU per frame, visible tab, Apple Silicon dev machine:

| Pipeline | p50 | p95 | Present cost |
|---|---|---|---|
| Current-style Canvas2D 480×714 | ~2.1ms (JS-issue only¹) | 17ms | — |
| **Pixel framebuffer 480×714** | **2.4ms** | 11.3ms | 0.1–0.2ms |
| Pixel framebuffer 240×357 → 2× | 0.8ms | 0.9ms | 0.1ms |

¹ `drawImage`-based rendering defers rasterization to the compositor; its true cost exceeds the JS-measured number. The framebuffer numbers are complete.

Methodology notes (hard-won): hidden-tab measurements are invalid — Chrome deprioritizes hidden renderer processes onto efficiency cores, inflating sustained-CPU loops 5–20× and deferring Canvas2D raster entirely (first runs showed 56–69ms for the identical code that measures 2.4ms visible). The bench therefore runs chunked-synchronously, presents via offscreen canvas (direct `putImageData` to a displayed accelerated canvas is a known slow path), and tags results with `document.visibilityState`. The bench's per-pixel light divisions are deliberately pessimistic; production precomputes a per-tile light grid (Section B), so production cost lands below the bench number.

**Budget derived:** render core ≤ 4ms median at full res on the dev machine ⇒ ~13–16ms on a 3–4× slower machine at worst ⇒ 60fps holds, with the adaptive half-res fallback (Section D) as the safety valve. Measured 2.4ms leaves ~40% slack against the budget.

---

## Scope contract

### In scope

- New `engine/fpRender/` subsystem (6 files, Section A)
- Textured **floor + ceiling perspective casting** with per-tile floor textures
- **Sky panorama** sampling by ray angle (exteriors)
- **Lighting system:** per-tile baseline light map, colored point lights with falloff, distance fog, day/night global multiply — replacing `ctx.filter` HSL tint entirely
- **Unified billboard pass** (props, enemies, NPCs, objective marker) — one sorted, per-column depth-tested, per-pixel alpha-tested path
- **Texture registry**: decode-and-normalize all FP textures to typed arrays at preload; per-class fallback tints (preserves current missing-sprite behavior)
- **Adaptive internal resolution** (480×714 default ↘ 240×357 on slow machines) + DevPanel perf readout and override
- **Frame-rate-independent movement** in `firstPersonEngine.ts`, `groundEngine.ts`, `boardingEngine.ts` (the known Phase-2 follow-up; mandatory for a public app)
- Golden-frame + property test suite under `tsx --test`; new `yarn engine:test`; CI job step
- Colony opt-in data: pad/foundation/plaza/interior floor textures, night point lights (assets already on disk)
- Removal of the classic scene-drawing code in the same commit that replaces it

### Out of scope (deferred)

- Directional (8-angle) or animated sprites; animated wall textures
- Wall decals (damaged buildings) — the pipeline makes them easy later; data format reserved, not implemented
- Retro post-FX (dithering, palette quantization, scanlines) — cheap to add on the framebuffer later if wanted
- Variable wall heights / non-grid geometry (Build-engine territory — different game)
- WebGL/WebGPU back end
- Any `firstPersonEngine.ts` gameplay change beyond delta-time scaling
- New art assets (at most 1–2 ceiling textures later via the existing prompt pipeline)

---

## Section A — Files & boundaries

### New

```
game/app/components/engine/fpRender/
├── framebuffer.ts    # Framebuffer: Uint32Array + ImageData; present(ctx) via
│                     #   offscreen canvas + integer upscale, imageSmoothing off
├── textures.ts       # TextureRegistry: preload-time decode of FP sprites into
│                     #   Uint32Array texels at normalized sizes; fallback tints
├── sceneInput.ts     # RenderScene type + buildRenderScene(fp: FirstPersonState)
├── lighting.ts       # LightGrid: per-frame per-tile RGB multipliers
├── renderCore.ts     # renderScene(fb, scene, textures, grid) — pure, DOM-free
└── index.ts          # drawFirstPersonPixel(ctx, gs) orchestration

game/tests/engine/
├── renderCore.test.ts        # golden-frame hashes + properties
├── lighting.test.ts          # grid math, falloff, tint composition
└── fixtures.ts               # synthetic maps + 4×4 generated textures
```

### Modified

```
firstPersonRenderer.ts   # scene-drawing body (ceiling/floor/walls/billboard
                         #   passes) REPLACED by drawFirstPersonPixel call;
                         #   HUD/minimap/crosshair/compass/gun/dialog/dashboard
                         #   functions unchanged and still drawn over the scene;
                         #   classic scene code deleted (no toggle)
sprites.ts               # preloadAll() additionally feeds TextureRegistry
types.ts                 # additive optional fields (Section C)
firstPersonEngine.ts     # delta-time scaling only (Section D)
groundEngine.ts          # delta-time scaling only
boardingEngine.ts        # delta-time scaling only
Game.tsx                 # passes frame dt into update loop (single plumb)
DevPanel.tsx             # perf readout (p50/p95 ms), resolution override
.github/workflows/…      # engine:test job step
game/package.json        # "engine:test": "tsx --test tests/engine/*.test.ts"
colony/exploration/colonyLayout.ts  # opt-in floor/light data (Section C)
```

### Boundary rules

1. **`renderCore.ts` is a pure function.** Inputs: framebuffer, `RenderScene`, `TextureRegistry` view, `LightGrid`. No DOM, no engine imports, no `getSprite`, no globals, no allocation at steady state. This is what makes golden-frame tests possible in node.
2. **The engine never changes for graphics reasons.** `FirstPersonState` is read, snapshotted into `RenderScene`, rendered. All new map/art fields are optional and additive (the `wallTextureMap` precedent).
3. **`raycaster.ts` stays** for engine logic (LOS). The render core inlines its own DDA — the current `castAllRays` allocates 480 `RayHit` objects per frame, which violates the zero-allocation rule.
4. **HUD stays Canvas2D vector**, drawn after `present()`. Enemy HP bars and NPC name tags remain overlay draws (they need crisp text, not pixels).

---

## Section B — Data contracts

### RenderScene (renderer's entire world view)

```typescript
interface RenderScene {
  camX: number; camY: number;
  dirX: number; dirY: number;
  planeX: number; planeY: number;
  map: {
    width: number; height: number;
    solid: Uint8Array;                    // 1 = wall/empty, row-major (built once per map, cached)
    wallTexture: Int16Array;              // texture id per tile (-1 = environment default)
    floorTexture: Int16Array;             // texture id per tile (-1 = environment default)
  };
  art: {
    skyTexId: number;                     // -1 = gradient ceiling instead
    wallTexId: number; floorTexId: number; ceilingTexId: number;
  };
  billboards: BillboardInput[];           // props + enemies + npcs + objective, pre-flattened
  // lighting inputs
  baseLight: Uint8Array | null;           // per-tile 0–255 (null = all 255)
  pointLights: PointLightInput[];
  tint: { rMul: number; gMul: number; bMul: number };  // 0–256 fixed point; from environmentTint
}
```

`buildRenderScene` (in `sceneInput.ts`) converts `FirstPersonState` → `RenderScene` each frame **into a reused instance** (arrays reused; map-derived typed arrays rebuilt only when the `map` object identity changes — scene-stack transitions swap maps, so identity is the correct invalidation key). String sprite paths resolve to integer texture ids here, once, not per pixel.

`environmentTint` (HSL shift) is converted to RGB multipliers at scene build. The existing `dayNightTint.ts` output continues to work unchanged; the HSL→RGB-multiplier conversion is a small pure function with its own tests, tuned so hour-12 is identity and night lands within ±10% of the current `ctx.filter` appearance (verified by playtest, not pixel-exactness — the filter path was never color-managed anyway).

### TextureRegistry

- Fed by `preloadAll()`: when each `Image` loads, it is drawn once to a small offscreen canvas at its **normalized size** and read back via `getImageData` into a `Uint32Array`.
- Normalized sizes: walls/floors/ceilings → **128×128** (fixes the 1024² Ashfall vs 64² colony split; 128 retains detail at the distances a 24×24 map produces); sky → **512-wide** panorama strip; billboards → native size capped at 256.
- Registry maps sprite path → integer id → `{ texels, w, h, wMask, hMask }` (power-of-two masks for wrap).
- **Fallback tints preserved:** until an image loads (or if it 404s), its id resolves to a generated 2×2 flat-color texel block using the same `WALL_COLORS`-class colors the classic renderer used. Rendering never branches on "loaded?" — the registry always returns sample-able texels.
- Memory: ~64KB per normalized wall texture; the full current FP set lands ≈ 2–3MB — negligible.

### LightGrid

- Recomputed once per frame, sized to map dimensions (current maps: 24×24 colony = 576 cells, 27×25 Ashfall = 675 cells — trivial either way): `cellLight = clamp(baseLight[i] × tint × Σ pointLightFalloff)` per RGB channel, stored as three `Int16Array`s in 0–320 fixed-point (values >256 allow modest over-brightening near lights).
- Point-light falloff: `power / (1 + d²)` with d in tile units — no sqrt, matches the bench.
- Per-pixel cost in the render passes is therefore **three multiplies + shifts**, no divisions. Floor pixels sample the grid at their world tile; wall columns sample at the hit tile; billboards at their anchor tile.
- Distance fog applied after light: `ch += ((fogCh − ch) × fogF) >> 8`, with `fogF = min(0.7, dist × 0.08)` in fixed point and fog color `rgb(5,5,16)` — **identical constants to the classic renderer**, so default scenes keep their look.
- Interiors: Phase 2's rule stands — fixed neutral tint (identity multipliers), `baseLight` from the interior template if provided, else 255.

---

## Section C — Frame pipeline & type extensions

Per frame, in order, all into preallocated buffers:

1. **Light grid** (Section B).
2. **Ceiling half.** Exterior (`skyTexId ≥ 0`): per-column panorama sample by ray angle (`atan2(rayDirY, rayDirX)` folded to texture U; V spans the half-height) — replaces the per-frame `createPattern`. Interior: perspective ceiling cast mirroring the floor rows, sampling `ceilingTexId`. No texture: the existing two-stop gradient colors, computed per row.
3. **Floor half.** Standard per-row perspective cast: `rowDist = (h/2) / (y − h/2)`; world coords stepped incrementally per pixel; each pixel resolves its tile → `floorTexture[tile]` override or environment default; shade = tile light + row fog.
4. **Walls.** Inline DDA per column over `solid`; per-tile texture via `wallTexture` (populated from the existing `wallTextureMap`); nearest-neighbor sampling with fixed-point `texPos` stepping; shade = side-shade (×0.7 on side 1 — current constant) × tile light, then fog; writes `zbuf[x] = perpDist`.
5. **Billboards.** One flattened list (props, enemies with flinch/death frame selection preserved, NPCs), sorted far→near into a reused scratch array; camera-space transform; per-column `zbuf` test; per-pixel alpha test (`texel >>> 24 === 0` skip); per-billboard scalar alpha (0–256) blended in the inner loop — this carries the dying-enemy fade (`deathTimer / 30`, today done via `globalAlpha`). Size scale preserves the current `×0.6` factor. Replaces three separate passes and their three per-frame depth-buffer allocations and clip-path rectangles. **Exception — objective marker:** today it deliberately draws *through* walls as a wayfinding beacon (`drawObjectiveBillboard` takes no z-buffer); that behavior is gameplay-load-bearing in W5-L3/Kepler, so it renders after the depth-tested pass with the z-test skipped, distance-scaled as before.
6. **Present.** `putImageData` → offscreen canvas → single `drawImage` to the game canvas (integer 1× or 2× scale, smoothing off). Direct `putImageData` to the displayed canvas is avoided (measured slow path).
7. HUD/dialog/minimap/gun/dashboard draw over the presented scene — unchanged code.

**Door look-at glow** (the one classic scene effect beyond walls/fog): reproduced as a small emissive boost in the door tile's light-grid cell when the facing tile is a door — same visual cue, now via the lighting system.

### Type extensions (all optional, additive — `types.ts`)

```typescript
interface BoardingMap {
  // existing fields + existing wallTextureMap stay as-is
  floorTextureMap?: (string | null)[][];   // per-tile floor sprite override
  lightMap?: number[][];                    // 0–255 per-tile baseline light
}

interface FPEnvironmentArt {
  // existing fields + environmentTint stay as-is
  pointLights?: { x: number; y: number; color: string; power: number }[];
}
```

### Colony opt-in (`colonyLayout.ts`)

- `floorTextureMap`: `COLONY_LANDING_PAD` on pad tiles, `COLONY_FOUNDATION` on foundation cells, plaza-border variant on `▓` tiles (existing ground sprite until a paving texture exists), interior floors per template.
- `pointLights` (night hours only, from `gameClock.hour`): warm light at each operational building's door tile; cool flicker-free light at scaffolding on constructing slots.
- Campaign W5-L3, Kepler, Ashfall: **zero data changes** — defaults reproduce today's look through the new pipeline.

---

## Section D — Performance system

- **Budget:** render core ≤ 4ms median full-res on the dev machine (measured today: 2.4ms pessimistic bench). Regression above budget blocks merge (perf numbers are printed by the DevPanel readout and eyeballed in the playtest checklist; no automated perf CI — CI runners' variance makes that noise, not signal).
- **Zero-allocation rule:** no per-frame allocations in `fpRender/` at steady state. Framebuffer, z-buffer, light grids, billboard scratch, and the `RenderScene` instance are preallocated and reused. (The engine's existing per-frame allocations — e.g. `enemies.filter` — are out of scope; the renderer just stops adding its own.)
- **Adaptive internal resolution:** render at 480×714; if the rolling p95 of the last 120 FP frames exceeds 12ms, switch to 240×357 with 2× nearest upscale (measured 3× cheaper) for the rest of the session and persist the choice in `localStorage` (`szFpResolution`). DevPanel: live p50/p95 ms readout + FULL/HALF/AUTO override. Hysteresis: AUTO never switches back up mid-session (prevents oscillation).
- **Frame-rate-independent movement:** `updateFirstPerson`, `updateGroundEngine`, `updateBoardingEngine` receive `dtMs` from `Game.tsx`'s rAF loop and scale movement/rotation/timers by `dtMs / 16.67`, clamped to ≤ 3 frames' worth (protects against tab-switch spikes). Constants keep their current per-frame semantics (`MOVE_SPEED = 0.06` per 16.67ms), so behavior at 60fps is bit-compatible-in-spirit and slower devices stop feeling stuck. Existing self-tests extended for the clamp.

---

## Section E — Testing

Under the existing `tsx --test` pattern; new script `yarn engine:test` (`tsx --test tests/engine/*.test.ts`); added to the CI workflow beside `colony:test`.

**Golden-frame tests** (render synthetic scenes into the framebuffer, FNV-1a hash the `Uint32Array`, compare to a recorded constant):

1. Wall orientation & side shading (N/S vs E/W darkening)
2. Per-tile wall texture override vs environment default
3. Floor casting tile-boundary alignment (pad tile edges land where the map says)
4. Ceiling cast (interior) vs sky sample (exterior) selection
5. Fog monotonicity with distance (probe pixel columns at increasing depth)
6. Point-light falloff shape and color
7. Day/night tint identity at hour 12; night multipliers within expected range
8. Billboard occlusion by nearer wall; alpha-hole transparency
9. Full-scene determinism: same `RenderScene` twice → identical hash
10. Half-res render validity (no NaN/oob writes; hash stable)

Fixtures inject generated 4×4 textures directly into a test `TextureRegistry` — no PNG decoding in node needed. Golden updates are intentional: re-record hashes via `UPDATE_GOLDENS=1 yarn engine:test` and eyeball the change in the browser before committing.

**Property tests:** randomized cameras inside open cells → every written pixel has alpha 0xFF and no ray escapes the map guard; `buildRenderScene` reuses its instance (identity check) and rebuilds typed arrays only on map identity change.

**Manual playtest checklist (pre-merge):** all four FP surfaces — W5-L3 phase, Kepler mission, Ashfall camp (NPCs, dialog, shop, props), colony DAY/NIGHT/DAWN fixtures (pad/foundation floors visible, night lights, interiors per building) — plus DevPanel res override and a deliberate half-res session.

---

## Section F — Delivery

**Branch:** created off `colony/phase-2` (content-identical to post-merge `main` since `main` has no other commits); PR targets `main` after PR #5 merges. *PR #5 resolution is the user's call and blocks only the final PR, not the work.*

One PR, ~6 sequential commits, **each green (`yarn build`, `npx tsc --noEmit`, tests) and fully playable**:

| # | Commit | Contents | Proof |
|---|---|---|---|
| 1 | Texture registry + framebuffer + full pixel pipeline at parity | walls, fog, tint, billboards, gradient/pattern-equivalent floor & ceiling; classic scene code deleted same commit | goldens 1–2, 5, 7–9; playtest all 4 surfaces |
| 2 | Floor + ceiling casting & sky sampling | pipeline steps 2–3; colony floor data opt-in | goldens 3–4; pad/foundation visible in playtest |
| 3 | Lighting system | light grid, point lights, day/night-as-lighting, door glow port; `ctx.filter` removed; **billboards join the lighting model here — an intended visual change** (today sprites draw full-bright even at night, since `applyTint` never wrapped them; commit 1 keeps tint off billboards to preserve strict parity) | goldens 6–7; NIGHT fixture playtest |
| 4 | Billboard unification polish | enemy frames/HP-bar overlay verified across surfaces; three legacy depth-buffer allocs gone | golden 8; Ashfall + W5-L3 combat playtest |
| 5 | Adaptive resolution + DevPanel perf readout | AUTO/FULL/HALF, localStorage, readout | golden 10; forced-HALF playtest |
| 6 | Delta-time movement (FP + ground + boarding) | `dtMs` plumb, clamp, self-tests | existing suites + slow-machine simulation (CPU throttle in devtools) |

### Success criteria

- [ ] `yarn engine:test` green (≥10 golden/property tests); `yarn colony:test` still 100/100; `yarn build` + `npx tsc --noEmit` green; CI green
- [ ] Render core ≤ 4ms median full-res on dev machine (DevPanel readout during playtest)
- [ ] Landing pad, foundation, plaza, interior floors visibly textured in colony playtest
- [ ] NIGHT colony shows point-lit doors/scaffolding; hour-12 look matches pre-change screenshots
- [ ] No `ctx.filter`, no per-frame `createPattern`, no per-frame allocations in `fpRender/`
- [ ] All four FP surfaces playtested; no visual regressions beyond intended upgrades
- [ ] Classic scene-drawing code fully removed (grep: no dead `WALL_COLORS` wall-strip path)
- [ ] Movement feel unchanged at 60fps; playable at simulated 4× CPU throttle

### Risks

| Risk | Mitigation |
|---|---|
| Parity regressions on non-colony surfaces | Commit-1 parity goldens + 4-surface playtest before any new features land |
| Low-end machines miss 60fps at full res | measured 3× cheaper half-res AUTO fallback + localStorage stickiness |
| GC hitches from hidden allocations | zero-alloc rule scoped to `fpRender/`; p95 readout in DevPanel exposes spikes |
| Texture memory blow-up | normalization caps (128² walls, 512 sky, 256 billboards) |
| HSL→RGB tint conversion shifts night look | tuned against current fixtures (DAY/NIGHT/DAWN) during commit 3 playtest |
| Delta-time change alters game feel | per-frame semantics preserved at 60fps; clamp; self-tests; own commit for easy bisect |
| Scope creep (decals, post-FX, sprites) | explicit deferred list; pipeline designed so they're additive later |

### Open items

- **PR #5** — merge/playtest decision pending user; blocks only the final PR target.
- Plaza paving + 1–2 ceiling textures — optional later assets via the existing prompt pipeline; renderer falls back gracefully meanwhile.

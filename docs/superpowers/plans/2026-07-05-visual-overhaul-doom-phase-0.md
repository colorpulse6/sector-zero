# DOOM Visual Overhaul — Phase 0 (Keystone) Implementation Plan

> **STATUS: COMPLETE (2026-07-12).** All 10 tasks landed on `graphics/doom-overhaul`
> (Tasks 1–4 on 07-05; Tasks 5–7 `38f1fde`, Task 8 `2418bbb`, Task 9 `3151f84`,
> Task 10 `e8728ed` on 07-12). Playtested in a prod build: grade + bloom render,
> HUD legible, A/B + auto-disable verified live (budget corrected 3ms→6ms from
> measurement), dark-scene presets softened once. Remaining human item from the
> done-checklist: user feel-tune of the presets. Next: Phase 1 pilot per
> `docs/assets/2026-07-12-asset-pipeline-free-options.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.
>
> **Revised after plan-review** (fixed: atlas allowlist not denylist; dropped the false "goldens prove atlas safety" claim; stage-sizing collapse; single dedicated present-rAF; DevPanel↔postFx singleton mirror; `scripts/**` tsconfig exclude; line-refs).

**Goal:** Ship the runtime DOOM color-grade over the whole game (Layer A), clean the legacy sprites' alpha **safely** (allowlist-only), and replace the pixel-art style guide with the DOOM one — transforming the look with **zero asset regeneration**.

**Architecture:** A client-only WebGL post-process pass runs in **its own dedicated rAF loop**, sampling the single `<canvas>` **element** each frame and re-presenting a graded image on a second, `pointer-events:none` WebGL canvas layered exactly over it. The 2D game path is untouched (engine golden-frame hashes stay valid — they only prove the FP raycaster path, which is real and sufficient for Layer A).

**Tech Stack:** TypeScript, React 19, Next.js 15 static export, raw WebGL1 (no libraries), `tsx` for node scripts, `rembg`/BiRefNet (Python CLI, local) for alpha.

**Base branch:** `graphics/doom-overhaul` (off `colony/phase-5a`). **Per-task gate:** `cd game && yarn build` passes; `yarn engine:test` goldens stay green (they prove the **2D/FP path is untouched** — NOT that sprites are unchanged). WebGL visual/feel is human-verified via playtest — flagged where it applies.

**Flag policy (per user):** grade is **ON by default** — no lingering user-facing feature flag. Keep only (a) an internal **auto-disable** perf fallback and (b) a **dev-only** A/B toggle in DevPanel.

---

## File Structure

**Create:**
- `game/app/components/engine/postFx/index.ts` — public API + **module-level singleton mirror** (`getGradeStats()`, `setGradeEnabled()`, `isGradeEnabled()`) so DevPanel can read/toggle without holding the instance (mirrors the `fpRender` module-singleton pattern)
- `game/app/components/engine/postFx/gradeGL.ts` — WebGL context (explicit attrs), texture upload, program(s), draw
- `game/app/components/engine/postFx/shaders.ts` — GLSL source (vertex + grade fragment + bloom passes)
- `game/app/components/engine/postFx/presets.ts` — `GradeParams` type + per-scene presets
- `game/scripts/sprites/sheets.ts` — the **allowlist model**: every confirmed multi-frame sheet (see Task 8) + a `matAllowlist` of confirmed single-frame billboards
- `game/scripts/sprites/classify.ts` — inventory + classify → manifest (written OUTSIDE `public/`)
- `game/scripts/sprites/remat.ts` — allowlist-only BiRefNet remediation + changed-files guard
- `game/tests/sprites/classify.test.ts` — runs under a new `sprites:test` glob
- `docs/assets/prompts/doom/00-master-style-guide.md` — the DOOM master style guide

**Modify:**
- `game/app/components/Game.tsx` — relative wrapper that shrink-wraps the existing canvas + sibling WebGL canvas + `gameStateRef` + dedicated present-rAF (own ref). Anchors: canvas `:1449`, wrapper div `:1448`, game loop `:1361`, mouse handlers `:1460-1481`, touch `:978-985`, DOM overlays `:1526/:1580/:1835/:1846/:1862/:1870/:1880`.
- `game/app/components/DevPanel.tsx` — post-pass p50/p95 readout beside FP stats (`:245-267`) + A/B toggle, via the postFx singleton accessors
- `game/tsconfig.json` — add `"scripts/**"` to `exclude` (keep it out of the Next type-check graph)
- `game/package.json` — add `"sprites:test"`, `"sprites:classify"`, `"sprites:remat"` scripts
- `docs/assets/prompts/README.md` — index the new `doom/` guide
- `docs/assets/prompts/colony-phase-2/00-shared-style-guide.md` — supersede its Aesthetic lines (`:5-7`) with a pointer to the master guide

---

## Task 1: postFx module — identity passthrough + singleton mirror

**Files:** Create `postFx/gradeGL.ts`, `postFx/shaders.ts`, `postFx/index.ts`.

- [ ] **Step 1:** `shaders.ts` — fullscreen-triangle vertex shader + **identity** fragment (`gl_FragColor = texture2D(uSrc, vUv)`).
- [ ] **Step 2:** `gradeGL.ts` — `createGradeGL(glCanvas)`: get `webgl` context with **explicit attrs** `{alpha:true, premultipliedAlpha:true, preserveDrawingBuffer:false, antialias:false}`; **fail-soft → null** if unavailable. Compile program, fullscreen triangle, source texture. `uploadAndDraw(source, params)`: `pixelStorei(UNPACK_FLIP_Y_WEBGL,true)` + `texImage2D(source)` then draw. **No module-scope GL / no `window`/`document` at import** (mirror `fpRender/index.ts:71-88`).
- [ ] **Step 3:** `index.ts` — `createGradePass(glCanvas)` → `{ present(source, params), setEnabled(b), getStats(), dispose() }`. ALSO maintain **module-level mirrors** updated by the active instance: `getGradeStats()`, `isGradeEnabled()`, `setGradeEnabled(b)` (exported for DevPanel). `present` no-ops if GL null or disabled.
- [ ] **Step 4:** `cd game && yarn build` passes (nothing imports it yet — confirms SSR-safety).
- [ ] **Step 5:** Commit: `feat(postfx): WebGL grade scaffold (identity shader + singleton mirror)`

**Verify:** build green.

---

## Task 2: Game.tsx overlay integration (sizing-safe, input-safe)

**Files:** Modify `Game.tsx`.

- [ ] **Step 1:** Wrap the existing `<canvas>` (`:1449`) in an **inner relative wrapper that shrink-wraps the canvas** — e.g. `<div style={{position:'relative', display:'inline-flex', lineHeight:0}}>` placed inside the current flex-centering parent (`:1448`). **Leave the 2D canvas's own `maxHeight/maxWidth/objectFit` sizing unchanged** — the canvas keeps sizing the wrapper (its intrinsic 480×854 gives the wrapper a definite box; do NOT move sizing to a bare `<div>`, which would collapse to zero). *(Alt if needed: size the wrapper explicitly `width:min(100vw, calc(100vh*480/854)); aspect-ratio:480/854`.)*
- [ ] **Step 2:** Add a sibling **`glCanvasRef` `<canvas width={480} height={854}>`** after the game canvas: `style={{position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none'}}`. It overlays the 2D canvas exactly; input still reaches the 2D canvas beneath (handlers `:1460-1481`, touch `:978-985`). Coordinate math (uses the 2D canvas `getBoundingClientRect()`) is unaffected.
- [ ] **Step 3:** Confirm DOM UI overlays (`:1526/:1580/:1835/:1846/:1862/:1870/:1880`) are later-in-source siblings so they paint **above** `glCanvas`, ungraded (intended).
- [ ] **Step 4:** In a client `useEffect`: `const pass = createGradePass(glCanvasRef.current)`; start a **dedicated present rAF** stored in its **own** `presentRafRef` (NOT `animationFrameRef` — that ref is shared by the 5 game loops and must not be clobbered). Each frame: `pass.present(canvasRef.current, DEFAULT_PARAMS)`. Cancel + `pass.dispose()` on unmount. Start with identity params.
- [ ] **Step 5:** Verify **look unchanged + input intact**: playtest — image pixel-identical (identity proves upload/orientation/overlay), turret aim / cockpit hotspots / colony clicks / menu buttons all respond, no misalignment at multiple window sizes. `yarn build` + `yarn engine:test` green.
- [ ] **Step 6:** Commit: `feat(postfx): mount grade pass over the canvas (own rAF, input-safe)`

**Verify:** build + goldens green; manual: input works, look unchanged, aligned.

---

## Task 3: gameStateRef threading (per-scene params)

**Files:** Modify `Game.tsx`.

- [ ] **Step 1:** Add `const gameStateRef = useRef(gameState)` and update it each tick in the game loop (`:1361`) — the dedicated present rAF can't read React state directly.
- [ ] **Step 2:** In the present rAF, read `gameStateRef.current.currentMode` (+ colony/scene sub-state) and pass it to `present()` for preset selection (wired in Task 6).
- [ ] **Step 3:** Verify: logged mode reaching `present()` changes with mode switches; `yarn build` green.
- [ ] **Step 4:** Commit: `feat(postfx): thread gameStateRef into the present loop`

---

## Task 4: DOOM grade fragment chain (single pass)

**Files:** Modify `shaders.ts`, create `presets.ts`, modify `gradeGL.ts`.

- [ ] **Step 1:** Replace identity with the ordered chain (single pass): **tone curve** (crush blacks, raise contrast) → **warm cast** (lerp shadows→`#1a0f08`, highlights→`#ff5a1e`) → **vignette** → **animated film grain** (`uTime` from the present rAF's own clock, low amplitude). Uniforms for each strength. *(Note: the spec's "depth haze" is intentionally dropped here — a post-composite grade over a flat 2D canvas has no depth buffer; revisit only in Layer C.)*
- [ ] **Step 2:** `presets.ts` — `GradeParams` type + a `DEFAULT` preset tuned **legibility-safe** (gentle midtone curve; the HUD/dashboard is drawn into the canvas at `renderer.ts:148` and FP HUD after the scene at `firstPersonRenderer.ts:501/559/573`, so it gets graded — keep text readable).
- [ ] **Step 3:** Verify: visible DOOM grade; HUD legible; `yarn build` + goldens green.
- [ ] **Step 4:** Commit: `feat(postfx): DOOM tone-curve + warm-cast + vignette + grain`

**Verify:** build + goldens green; **playtest for feel + HUD legibility** (human).

---

## Task 5: Bloom (thresholded, half-res)

**Files:** Modify `gradeGL.ts`, `shaders.ts`.

- [ ] **Step 1:** Bright-pass (high threshold — only strong emissives) → separable blur on a **half-res** FBO → additive composite into the final pass. Two small FBOs.
- [ ] **Step 2:** Threshold/intensity in `GradeParams`; default so HUD/text does **not** bloom.
- [ ] **Step 3:** Verify: emissive reds/plasma/lava bloom; HUD unaffected; `yarn build` + goldens green.
- [ ] **Step 4:** Commit: `feat(postfx): half-res thresholded bloom on emissives`

**Verify:** build + goldens green; playtest (human).

---

## Task 6: Per-scene presets

**Files:** Modify `presets.ts`, `Game.tsx`.

- [ ] **Step 1:** Presets `TECHBASE` (cooler), `HELL` (hotter, stronger bloom), `COMBAT` (punchier), `DEFAULT`; map `currentMode`/scene → preset.
- [ ] **Step 2:** Select from `gameStateRef` in `present()`; optional lerp on transitions (nice-to-have).
- [ ] **Step 3:** Verify: exteriors vs interiors vs combat visibly differ; `yarn build` green.
- [ ] **Step 4:** Commit: `feat(postfx): per-scene DOOM grade presets`

**Verify:** build green; playtest (human).

---

## Task 7: Perf readout + auto-disable fallback + dev A/B toggle

**Files:** Modify `postFx/index.ts`, `gradeGL.ts`, `DevPanel.tsx`.

- [ ] **Step 1:** Time upload+shader per frame; rolling p50/p95 via the `perfWindow.ts` `windowPercentiles`/`windowExceedsBudget` ring. Push into the module-level stats mirror.
- [ ] **Step 2:** **Auto-disable:** if p95 exceeds budget (e.g. >3ms) over a window, `setEnabled(false)` and **hide the glCanvas via CSS** (`display:none` / `opacity:0`) so the raw 2D canvas shows deterministically (do NOT rely on GL clear-alpha). Re-probe occasionally.
- [ ] **Step 3:** `DevPanel.tsx` — show post-pass p50/p95 beside FP stats (`:245-267`) and a **dev-only** A/B toggle, using the postFx **singleton accessors** (`getGradeStats`/`isGradeEnabled`/`setGradeEnabled`) — DevPanel has no instance handle.
- [ ] **Step 4:** Verify: DevPanel shows post-pass timing; forcing a tiny budget cleanly reveals the ungraded 2D canvas; `yarn build` green.
- [ ] **Step 5:** Commit: `feat(postfx): perf readout + auto-disable fallback + dev A/B`

**Verify:** build green; DevPanel timing visible; fallback verified; **playtest on a throttled profile** (human).

---

## Task 8: Sprite allowlist + classification manifest (SAFE model)

**Files:** Create `game/scripts/sprites/sheets.ts`, `classify.ts`, `game/tests/sprites/classify.test.ts`; modify `tsconfig.json`, `package.json`.

- [ ] **Step 1 (prep):** Add `"scripts/**"` to `game/tsconfig.json` `exclude` (the Next build type-checks `**/*.ts`, so node scripts would otherwise break `yarn build`). Add `package.json` scripts `sprites:classify`/`sprites:remat`/`sprites:test` (`sprites:test` = `tsx --test tests/sprites/*.test.ts`).
- [ ] **Step 2:** `sheets.ts` — enumerate **every multi-frame sheet** by grepping `\.width\s*/`, `/\s*[A-Z_]*FRAMES`, and `frameCount`/`FRAMES` across `engine/*Renderer.ts`, `weapons.ts`, `particles.ts` (and anything else). Known so far: player `/3` (`renderer.ts:222` & escort `:347`), powerups `/6` (`:424`), boarding tiles `/3` (`boardingRenderer.ts:38`), FP gun `/2` (`firstPersonRenderer.ts:254`), player-bullet `/4` (`weapons.ts:141`), enemy-bullet `/4` (`weapons.ts:233`), explosion `/7` (`particles.ts:152`). Record each with its source line. Then define `matAllowlist`: the **explicit** set of confirmed single-frame transparent billboards to remat (the NPC/enemy billboards with halos) — built by inspection, NOT by "everything not an atlas."
- [ ] **Step 3:** `classify.ts` (`tsx`) — walk `game/public/sprites/**`, read dimensions, tag each `sheet` / `allowlisted-billboard` / `other`. Emit manifest **outside `public/`**: `game/scripts/sprites/_manifest.json`.
- [ ] **Step 4:** `classify.test.ts` — assert every `sheets.ts` sheet is tagged `sheet` and is **absent** from `matAllowlist`; assert `matAllowlist` ⊆ existing files.
- [ ] **Step 5:** Verify: `yarn sprites:classify` writes the manifest; `yarn sprites:test` passes; `yarn build` still green (scripts excluded).
- [ ] **Step 6:** Commit: `feat(sprites): safe allowlist classification manifest`

---

## Task 9: Allowlist-only alpha remediation

**Files:** Create `game/scripts/sprites/remat.ts`. Requires local `rembg` (`pip install "rembg[cli]"`) — document in the task.

- [ ] **Step 1:** `remat.ts` — remat **only** `matAllowlist` entries via `rembg -m birefnet-general` (shell out) → temp → back to path. Nothing else is touched.
- [ ] **Step 2:** **Guards:** (a) dimension guard (out W×H == in, restore on mismatch); (b) after the run, compute the **git changed-file set** and assert it ⊆ `matAllowlist` (no sheet/other file changed — this is the real safety net, since goldens do NOT decode PNGs and W×H alone can't detect frame corruption).
- [ ] **Step 3:** Run it. Spot-check remediated billboards (`boarding/npc-kael.png`, `boarding/npc-survivor.png`, `boarding/npc-scavenger.png`) — halos gone, dimensions identical.
- [ ] **Step 4:** Verify: `git status` shows only allowlisted billboards changed; `yarn engine:test` green (proves the FP/2D render path unaffected); `yarn build` green.
- [ ] **Step 5:** Commit: `fix(sprites): allowlist-only BiRefNet alpha remediation (halos removed)`

**Verify:** changed files ⊆ allowlist; halos gone on sampled billboards; no sheet touched.

---

## Task 10: DOOM master style guide

**Files:** Create `docs/assets/prompts/doom/00-master-style-guide.md`; modify `docs/assets/prompts/README.md`, `docs/assets/prompts/colony-phase-2/00-shared-style-guide.md`.

- [ ] **Step 1:** Write `doom/00-master-style-guide.md` from spec §2/§5.1: north-star, full hex palette (surface + emissive tiers), materials/lighting/form/mood, do/don't, copy-paste **positive & negative prompt suffixes**, per-asset spec template (id, path, resolution, framing, alpha, seed), and the "cyan/purple/green/red = emissive only" rule.
- [ ] **Step 2:** Index `doom/` in `README.md`. In `colony-phase-2/00-shared-style-guide.md`, replace the "pixel-art-adjacent / Wolfenstein 3D" Aesthetic lines (`:5-7`) with a pointer to the master guide (keep biome/perspective/process).
- [ ] **Step 3:** Verify: docs read cleanly; no dangling refs.
- [ ] **Step 4:** Commit: `docs(assets): DOOM master style guide supersedes pixel-art guide`

---

## Done-with-Phase-0 checklist
- [ ] Grade visibly transforms all modes + menus + FP view; HUD legible; input intact; aligned at all window sizes.
- [ ] `yarn build` + `yarn engine:test` green throughout (goldens prove the render path untouched — NOT sprite content).
- [ ] Post-pass p50/p95 within budget on a throttled profile; auto-disable reveals the 2D canvas cleanly.
- [ ] Only allowlisted billboards changed; halos gone; **no sheet corrupted** (changed-file guard).
- [ ] Style guide replaced. Then: **user playtest** → tune presets → proceed to Phase 1 (pilot).
```

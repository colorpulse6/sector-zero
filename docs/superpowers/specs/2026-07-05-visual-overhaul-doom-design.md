# Sector Zero — Visual Overhaul (Modern DOOM) — Design Spec

**Date:** 2026-07-05
**Status:** Revised after dual review (Claude spec-review + Codex, both against the codebase) — pending user approval
**Origin:** 4-lane parallel research fan-out (rendering engine · AI 2D generation · AI 3D/2.5D generation · art direction)
**Reference aesthetic:** Modern DOOM — DOOM (2016) / DOOM Eternal. NOT classic 1993 pixel-DOOM (we borrow only its *discipline*: pre-rendered billboards + ruthlessly readable silhouettes).

---

## 1. Goal & Problem

**Goal:** Give Sector Zero one cohesive, modern, grounded **modern-DOOM** visual identity — built end-to-end with **AI, no manual art**, driven from the **terminal/API** — while **keeping the runtime 2D and the working 6-mode engine**, and holding **60fps on mid-tier devices** under **static export**.

**Problem (today):**
- AI-generated PNGs don't cohere: resolutions sprawl **48px → 1536px**, style drifts across "eras," and several sprites carry **dirty alpha (white matte halos)**.
- The set reads as "dated / incoherent."
- Runtime is HTML5 Canvas 2D (480×854, 60fps) dispatching six mode renderers; a per-pixel **software framebuffer** now drives the FP raycaster.

**Constraints:** static export (`output:'export'`, GitHub Pages, no server — assets are static files); mid-tier-device 60fps; keep the six-mode architecture; no hand-art / no manual Blender modeling; tools must be CLI/API-drivable.

---

## 2. North Star (the look)

> Sector Zero looks like **DOOM (2016) / DOOM Eternal rendered as 2.5D billboards**: high-fidelity, visceral, grounded industrial-sci-fi colliding with hell. Every surface is heavy, worn, scarred metal and cracked concrete under crushed near-black shadow — then torn open by intense emissive hellfire, lava, plasma, and tech-screen glow. Two registers fight each other: cold dead UAC-style tech-base and hot demonic-organic corruption bleeding through. The **Ashfall outpost is the tech-base; the FP descent drops into the corruption.** Feeling: dread + power fantasy — oppressive, metal, kinetic.

**HUD rule:** existing HUD tokens survive, but cyan/purple/green/red become **emissive light only** — never surface paint. `#ff3366` reads as demon-red, `#44ff99` as toxic/plasma-green natively. Global look = **low ambient saturation + very high contrast**.

**Palette anchors** (full table in the style guide, §5.1):
- *Surface tier (desaturated):* void `#05070b` · base-black `#0a0e17` *(existing)* · gunmetal `#2b2f36` · steel `#565e68` · rust `#8a4b2d` · concrete `#4a4744` · Ashfall dust `#8a7a5c`.
- *Emissive tier (HDR hot-spots):* hellfire `#ff5a1e` · ember `#d1341a` · lava `#ffcf6e→#ffe9b0` · demon-red `#ff3366` · toxic-green `#44ff99` · tech-cyan `#00f0ff` · portal-purple `#7800ff` *(last four existing)*.

---

## 3. Strategy — Three Layers

The central finding across all four lanes: **the "DOOM look" is art direction + a runtime grade, not a new render engine.** Two lanes (engine + art) *independently converged* on the runtime grade (Layer A) as the highest-leverage move.

| Layer | What | Leverage | Status |
|---|---|---|---|
| **A — Runtime grade** | A WebGL post-process pass over the composited **canvas element** | **Highest** — harmonizes *all* existing assets, zero regeneration | Phase 0 (keystone) |
| **B — Asset pipeline** | AI-generate a cohesive DOOM asset set + atlas-aware alpha fix + (optional) format optimization | High — fixes sprites at the source | Phase 1–2 |
| **C — FP GPU renderer** | Port the FP software raycaster to a GLSL fragment shader | Medium — biggest single-*mode* jump | **Pulled forward** (committed, per user) — runs after A |

**Runtime stays 2D. No real-time 3D, no PixiJS/three.js migration** (§6). Layers A and B are independent; **C is coupled to A** (it must rejoin A's composite and preserve the FP depth contract — §4.4).

---

## 4. Layer A — Runtime DOOM Grade (keystone)

### 4.1 Corrected architecture — sample the canvas *element*, not `drawGame`
Review finding (both reviewers): there is **not** one `drawGame` call — gameplay (`Game.tsx:1359`), the non-playing-screen path (`~:1430`), `drawCockpit` (`:1254`), star map, intro crawl, and ending each draw to the **same single `<canvas>` element** (`canvasRef`, `:1449`) through separate paths. The single thing they share is the **canvas surface**, so Layer A hooks the surface, not any one draw call.

**Mechanism:** an independent presentation step (an rAF loop, or a `presentPostProcessedFrame()` invoked at the end of the existing tick after whichever draw path ran) each frame does: `gl.texImage2D(gameCanvas)` → grade shader chain → draw to a **second, WebGL canvas** layered exactly over the first. Because it samples the element, it captures **every** draw path automatically. (You cannot get a `webgl` context from a canvas that already holds `2d` — a second canvas is required.)

### 4.2 Overlay / DOM integration contract (was missing — now mandatory)
- **Stage wrapper:** a `position:relative` div with `aspect-ratio:480/854`; both canvases `position:absolute; inset:0; width:100%; height:100%`. This makes the WebGL layer track the **letterboxed game box** (the source canvas is CSS-scaled via `objectFit:contain`/`maxHeight/maxWidth`), not fill the viewport.
- **Input:** the WebGL canvas is **`pointer-events:none`** so mouse/touch/click reach the 2D canvas beneath (turret aim, cockpit hotspots, colony clicks at `Game.tsx:1460-1481`, touch at `:973`). Coordinate math stays on the source-canvas rect.
- **Backing store & DPR:** both canvases use the fixed **480×854** backing store (the game uses no `devicePixelRatio` scaling — do not add it, or the layers desync).
- **Z-order:** WebGL grade canvas sits **above the game canvas but below the DOM UI overlays** (start/pause/game-over/controls/dev/colony/exit at `:1526/:1580/:1835/:1862/:1870/:1880`). Those overlays are DOM, render above the grade, and are styled separately (intentionally *not* graded).

### 4.3 The DOOM grade chain & the HUD-legibility decision
Chain (ordered): **tone curve** (crush blacks, high contrast) → **warm cast** (shadows→`#1a0f08`, highlights→`#ff5a1e`) → **bloom** (thresholded on bright *emissive* pixels only) → **film grain** → **vignette** → **subtle depth haze**.

**HUD caveat (Codex, net-new):** the dashboard HUD is drawn *inside* the game canvas (`renderer.ts:148`) and FP gun/dialog/dashboard are drawn after the FP scene (`firstPersonRenderer.ts:500,:572`), so a full-canvas grade **also grades the HUD/text**. Decision: **Phase 0 uses a legibility-safe grade** — high bloom threshold (only very bright emissives bloom), gentle midtone tone-curve so HUD text stays readable. If legibility still suffers, fall back to splitting HUD to a separate un-graded layer (more invasive; deferred, not default).

**Per-scene params:** a new **`gameStateRef`** (updated each tick) feeds `currentMode`/scene to the presentation step to select the grade preset (cooler tech-base vs hotter hell/combat). A raw loop can't read React state.

### 4.4 Perf, fallback, and build-safety (was under-specified)
- **60fps is unproven, not "trivial"** (Codex refused to confirm the invariant — correct). Bloom adds passes; canvas→texture upload has real cost. **Measure before committing:** add post-pass **upload + shader p50/p95** to the DevPanel readout (today it only measures FPS + the *software* FP render). Downsample the bloom buffer (half-res). Ship an **auto-disable/fallback** to the ungraded 2D canvas if the pass exceeds budget.
- **Static-export safety:** create the GL context **only client-side** (in `useEffect`/refs), never at module scope; guard `window`/`document`; keep shader source inline. This mirrors the constraint the FP module already documents (`fpRender/index.ts:71`) — touching DOM at import time breaks `yarn build`.

### 4.5 Verification
Engine golden-frame tests hash the **`Framebuffer.px` buffer** (not the canvas; `renderCore.test.ts`, `fixtures.ts`) — Layer A is post-composite and **cannot affect them** (confirmed by both reviewers). Add reference-screenshot A/B for the grade, a toggle flag, DevPanel FPS + post-pass timing on a throttled profile, and a HUD-legibility spot-check.

---

## 5. Layer B — Asset Cohesion Pipeline

### 5.1 Master DOOM style guide (supersedes the pixel-art one)
New master guide under `docs/assets/prompts/` **replacing the aesthetic section** of `colony-phase-2/00-shared-style-guide.md` (its "pixel-art-adjacent / Wolfenstein 3D" line is now the opposite of the goal; keep its biome/perspective/process conventions). Carries: full hex palette, materials/lighting/form/mood spec, do/don't lists, copy-paste **positive & negative prompt suffixes**, and a per-asset spec template (sprite ID, path, resolution, framing, alpha, **fixed seed**).

### 5.2 Atlas-aware alpha cleanup (kills halos — carefully)
`BiRefNet` via `rembg -m birefnet-general`, local & free. **NOT a blind batch** (Codex, net-new): several sprites are **atlases with width-division assumptions** — player `/3` (`renderer.ts:221`), powerups `/6` (`:423`), boarding tiles `/3` (`boardingRenderer.ts:36`), FP gun `/2` (`firstPersonRenderer.ts:253`). Process:
1. **Classify** every sprite: single-frame billboard vs. multi-frame atlas vs. opaque tile/background.
2. Run matting **only on single-frame transparent billboards**; **skip** atlases and opaque backgrounds (or cut them frame-by-frame preserving exact geometry).
3. **Preserve exact pixel dimensions**; add a dimension/atlas regression check so no sheet's frame math breaks.

### 5.3 Format optimization (optional, *not* code-free)
PNG→WebP/AVIF + right-sizing is a real load-time win (backgrounds are **3.4–4.8MB**; ~332MB total) — but **not "runtime untouched"** (Codex): `sprites.ts` hard-codes `.png` paths (`:66–:304`) consumed by the loader (`:6`). Requires a **generated asset manifest** or updated constants (with PNG fallback). Scoped as a **separate optimization task**, not bundled into the Phase 0 keystone.

### 5.4 THE PILOT — 2D vs 2.5D (one test subject)
Decide the manufacturing pipeline from real output on **one** subject. **Prerequisite (Codex, net-new):** add a dedicated **`NPC_QUARTERMASTER`** sprite constant first — the quartermaster currently shares `SPRITES.NPC_KAEL` (`colonyNpcs.ts:216`, also mapped at `sceneInput.ts:41`), so regenerating "the quartermaster" would silently change Kael.

- **Path A — 2D style-locked.** FLUX via **fal.ai** with a fixed DOOM **style-reference + locked seed** → BiRefNet alpha. Pure terminal, **no Blender/GPU**. ~$0.03–0.05/img. Weakness: no guaranteed multi-angle consistency.
- **Path B — 2.5D pre-rendered (the native DOOM method).** AI 3D model (fal.ai/Meshy ~$0.10–0.40, or **free local TRELLIS.2**) → one **shared headless Blender rig** (fixed DOOM key-light/camera/transparent bg, EEVEE) → billboard(s) → BiRefNet if needed. **Scripted Blender, not hand-modeling.** Automatic lighting cohesion + free turnarounds. Weaknesses: heavier local toolchain **and** consuming **8-angle** billboards needs a **runtime enabler** the engine lacks (it picks one texture per enemy at `sceneInput.ts:139` / samples the whole texture at `renderCore.ts:273`) — `BillboardInput` must gain atlas/angle metadata + camera-yaw frame selection. (The pilot itself only needs one front angle; the enabler is only required if Path B wins for enemies.)

**Judged on the quartermaster:** DOOM-fidelity · silhouette readability at **48px** · alpha cleanliness · cohesion potential · per-asset time/cost · pipeline weight (incl. Path B's runtime enabler).

### 5.5 Regeneration order (after the pilot)
By visibility: **enemy/demon billboards** (the FP showcase) → colony NPCs → props/interiors → walls/floors → backgrounds. Register new assets following the **existing `SPRITES` path-constant pattern** in `sprites.ts`. The Layer A grade + alpha pass carry the long tail — no blind full-library regen.

### 5.6 Style-lock at scale
Pilot uses style-reference + seed. If Path A wins, bake a **FLUX style-LoRA** from the first ~30 accepted assets. If Path B wins, the shared rig *is* the lock. Palette enforced in-prompt (hex + suffix) and in-post (nearest-color snap). Optional managed alt: **Scenario.gg** (~$45/mo, MCP-drivable).

---

## 6. Explicitly Out of Scope (YAGNI)

- **No real-time 3D engine** (three.js/WebGPU) — multi-month rewrite, mid-tier-hostile, doesn't fix the look.
- **No PixiJS migration** — **2,847 immediate-mode `ctx.*` calls** across 6 renderers (Codex counted; even more than first estimated — it *strengthens* this call). Not worth it.
- **No blind full-library regeneration** — prioritize by visibility.
- **HUD/world layer-split is deferred** — only if the legibility-safe grade proves insufficient (§4.3).

---

## 7. Sequencing

- **Phase 0 — Keystone:** Layer A grade with the §4.1–4.4 architecture (sampling overlay, pointer-events/z-index contract, `gameStateRef`, perf timing + fallback, client-only init) + **atlas-aware** alpha remediation + master style-guide rewrite. Visible transformation, zero regeneration.
- **Phase 1 — Pilot:** add `NPC_QUARTERMASTER`; stand up both asset paths on it → pick the pipeline.
- **Phase 2 — Regeneration + FP GPU renderer (parallel tracks):**
  - *Assets:* produce priority assets via the chosen pipeline; register in `sprites.ts`. (If Path B: build the 8-angle runtime enabler first.)
  - *Layer C (FP GPU renderer, pulled forward):* port `fpRender` `renderCore` to a GLSL fragment shader. **Must preserve the FP contract (Codex, net-new):** overlays read `currentFrame().zbuf` for occlusion (`firstPersonRenderer.ts:155`); `currentFrame/currentScene` are exported (`fpRender/index.ts:157`). The GPU port must still expose z/depth/projection data (or migrate those overlays) **and rejoin Layer A's composite** so the grade still applies. Depends on Layer A being in place.
- **(Optional) Format optimization** — WebP/AVIF + manifest (§5.3), any time.

---

## 8. Toolchain & Cost

| Need | Tool | Drive | Cost |
|---|---|---|---|
| Runtime grade + FP shader | Hand-rolled WebGL/GLSL | in-repo | $0 |
| 2D generation | FLUX via fal.ai (or Scenario) | REST/Bash | $2 LoRA; ~$0.03–0.05/img (Scenario $45/mo) |
| 3D generation | fal.ai / Meshy / **TRELLIS.2 local** | REST/Bash | $0.10–0.40/model; **$0 local** (GPU) |
| 2.5D render | Headless Blender (EEVEE), shared rig | Bash | $0 (local render time) |
| Alpha | BiRefNet via `rembg` (atlas-aware) | Bash | $0 local |

All generation is **offline on the dev machine — outputs committed; game CI/static-export untouched** (true for PNG replacement; format *conversion* additionally needs the §5.3 manifest/constants change). Real difference between asset paths is **pipeline weight** (Path B adds Blender+GPU **and** a runtime yaw-selection enabler).

---

## 9. Risks & Open Questions

1. **DOOM era** — assumed 2016/Eternal. If Dark Ages (medieval-industrial) or classic design-language, palette/materials shift. *Confirm.*
2. **Layer A perf unproven** — bloom + upload cost; must measure on a throttled profile; ship auto-disable fallback (§4.4).
3. **HUD-in-canvas grading** — full-canvas grade also grades HUD/text; mitigated by legibility-safe grade, with layer-split as fallback (§4.3).
4. **Overlay integration** — pointer-events/letterbox/z-index/`gameStateRef` are load-bearing (§4.2); getting them wrong breaks input or misaligns the grade.
5. **Atlas-aware alpha** — blind matting corrupts sprite sheets; classify first (§5.2).
6. **Format conversion touches `sprites.ts`** — needs manifest/fallback (§5.3).
7. **Path B runtime enabler** — 8-angle billboards need `BillboardInput` + yaw selection (§5.4).
8. **Layer C coupling** — must preserve FP `zbuf`/scene exports and rejoin Layer A's composite (§7).
9. **Blender dependency (Path B)** — local Blender (+GPU for Cycles; EEVEE fast without). Path A avoids it.
10. **Branch** — new initiative; implementation branches off `main`, separate from in-flight colony work.

---

## 10. Verification

`yarn build` green + manual playtest per phase. Layer A: reference-screenshot A/B + DevPanel FPS **and post-pass p50/p95** on a throttled profile + flag toggle + HUD-legibility spot-check + input-still-works check (pointer-events). Alpha: dimension/atlas regression check + halo spot-check. Billboards: 48px silhouette-readability. FP GPU port: FP golden parity (or re-baselined goldens) + `zbuf`-dependent overlays still occlude correctly. Engine goldens unaffected by Layer A (post-composite).

# M2 Wraith and Echo Recovery — Prompt and Provenance Ledger

**Date:** 2026-07-16
**Branch:** `feat/m2-wraith-echo-recovery`
**Scope:** Recover the already-generated Wraith attempt 2 and Echo attempt 1 from the quality-controlled second tranche. No new image generation, gameplay code, renderer, registration, stat, spawn, collision, hitbox, balance, save, atlas, or pipeline-script change is permitted.

## Why this recovery exists

PR #14 retained both production originals because automated input could not open their live Bestiary detail screens. The candidates had already passed exact-size static review and representative gameplay presentation. This slice reconstructs those same candidate pixels, produces explicit matched evidence, and leaves acceptance provisional until the user reviews each enemy.

## Preserved contracts

| Enemy | Original SHA-256 | Production canvas | Frames | Original 5%-alpha bounds | Entity | Draw | Bestiary | Default class |
|---|---|---:|---:|---:|---:|---:|---:|---|
| Wraith | `b0c3198822dae2410922b4e59f52c8c1fa404081bc8a52c900a863f45331c241` | `1024x1536` sRGBA | 1 | `968x1284+28+97` | `48x44` | `56x52` | `96x96` | `elemental-cinder` |
| Echo | `dc4a2532e68ef83225b9f30b5c32bb054f339796b06e8942ccdd4c5a5bf3cf4d` | `1536x1024` sRGBA | 1 | `1037x895+258+49` | `36x36` | `44x44` | `96x96` | `tech-drone` |

Production paths remain:

- `game/public/sprites/enemies/wraith.png`
- `game/public/sprites/enemies/echo.png`

Both are registered single-frame billboards in `SPRITES`, `ENEMY_SPRITE_MAP`, and the mat allowlist and are absent from the width-divided sheet registry.

## Pinned recovery toolchain

- Built-in generation sources remain under `$CODEX_HOME/generated_images`; no new generation call was made.
- Chroma helper: `/Users/nichalasbarnes/.codex/skills/.system/imagegen/scripts/remove_chroma_key.py`, SHA-256 `3f7b9b14ad5c90f37618bc1c16a039a2076abca12ddc41b3ae470e2b1cad6c0e`.
- Python: `/Users/nichalasbarnes/.local/pipx/venvs/rembg/bin/python`, `Python 3.14.4`.
- Pillow: `12.3.0`.
- ImageMagick: `7.1.1-43 Q16-HDRI aarch64 22550`, features `Cipher DPC HDRI Modules OpenMP`, compiler `clang (16.0.0)`.

## Wraith recovery — provisional

### Generation provenance

- **Original built-in generation:** Wraith attempt 2, output `exec-f8531636-6934-4e1d-ac24-3224300278f7.png`, generation directory `019f65d8-7d10-74a0-81ca-f90ea197b34c`.
- **Source:** `1254x1254` sRGB RGB, one PNG frame; SHA-256 `ec33e8ee82c17e77bf8dea106b6fe962be6e21e0d3fbcffb8bed9920314cf42c`.
- **Seed:** not exposed by the built-in tool.
- **Reference role:** Wraith attempt 1 was the edit target and silhouette/geometry reference. The production original was a contract and comparison reference, not an image input.
- **Exact prompt:** unchanged from `docs/assets/prompts/shooter/02-m2-second-tranche.md`, section “Wraith attempt 2 — targeted reference edit.” That section contains the complete precise-object-edit request, the authoritative positive suffix, and the authoritative negative suffix used by the successful invocation. No prompt was re-run in this recovery.

### Matte and deterministic fit

- Chroma removal: border auto-key, soft matte, transparent threshold `12`, opaque threshold `220`, despill, no edge contraction, no hand painting, no BiRefNet fallback.
- Sampled key: `#13e613`.
- Matte counts: 1,005,126 transparent and 3,994 partially transparent pixels of 1,572,516.
- Matte: `1254x1254` sRGBA; 5%-alpha bounds `993x1129+127+64`; four transparent corners; SHA-256 `535792477f4e9d3e8efe65f568b4214713035ae5eb40b87b0bbd16ece212ff76`.
- Fit: crop those bounds, resize proportionally inside `968x1284`, center on that transparent extent, composite at `+28+97` on a `1024x1536` transparent canvas, then strip volatile PNG metadata.
- Canonical stripped fit SHA-256: `6bd64656fe270cd7db170951d7d9ae7e5a74a00862d1623b2a106c8fb9099b1b`; pixel signature `e6802e100e8f6613e5e80b92e9bc8d81fb6aa8be24b7dbeea1acd46e63232255`.
- Canonical stripped derivative SHA-256: `43974298bbc745519666291584e5642f0071d16d587598d57735d9ca51614f9d`; pixel signature `8f4cb9ae11275f3d95f16203826c6b6bb11724721bb8254d9a77fe1253246a64`.
- Derivative: `1024x1536` sRGBA, one frame; 5%-alpha bounds `968x1101+28+188`; center2 `1024,1477`; four transparent corners.

The previous ledger's unstripped fit/derivative file hashes contained ImageMagick PNG date metadata and are not reproducibility gates. Two unstripped reruns produced different file hashes while retaining the same pixel signature; `magick compare -metric AE` returned `0`. Adding `-strip` made two reconstructions byte-identical. The candidate pixels, scale, placement, and alpha are unchanged.

### Static and live evidence

- Exact renderer-size `56x52` comparison on `#05070b` and `#b8b8b0`, with the existing `#cc6644` 35% multiply presentation: `docs/assets/reviews/m2-wraith-echo-recovery/matched/wraith.png`.
- Full-horizontal-magnitude complete-canvas `96x96` Bestiary simulation, with the existing 25% class tint: `docs/assets/reviews/m2-wraith-echo-recovery/bestiary/after-wraith.png`.
- `48x44` entity/hitbox plus four-pixel renderer-padding overlay: `docs/assets/reviews/m2-wraith-echo-recovery/alignment/wraith-hitbox-overlay.png`.
- Matched `480x854` W4-2 Wave 1 comparison after the same DevPanel launch, god-mode capture, briefing skip, and 5.2-second observation window: `docs/assets/reviews/m2-wraith-echo-recovery/matched/wraith-gameplay.png`.
- Candidate W4-2 observation: all four Wraiths remained readable across the bright central starfield, kept the authored V, slow formation motion, Cinder tint, and red projectile presentation. Console: zero errors and zero warnings in the candidate gameplay session.

### Alignment disclosure

The original alpha center is Y `739.0` on the `1536`-pixel source canvas; the candidate is Y `738.5`. The recorded difference is `-0.5` source pixel, equivalent to approximately `-0.0176` pixel in the unchanged `56x52` renderer draw. The candidate remains inside the approved geometry tolerance, but acceptance requires explicit user approval of this disclosed difference.

### Bestiary blocker and decision

The isolated save visibly entered the sole-entry Wraith list (`DISCOVERED 1/13`). The same fresh-session blur reset, neutral interval, first-canvas focus, trusted held Enter, release, and post-input wait that successfully opened Echo's live detail left Wraith on the list. One direct click on the visible Wraith card also left the list unchanged. This reproduces the pre-existing Wraith-specific blocker without changing game code. The static `96x96` evidence passes, but live candidate detail remains unobserved. The bounded attempts are complete; no further automation retries are claimed.

**Decision:** accepted by explicit user approval on 2026-07-16, including the disclosed alignment difference and a waiver of the pre-existing Wraith live Bestiary-detail blocker. No gameplay or Bestiary code was changed. If the candidate is later rejected, restore the pinned original byte-for-byte.

## Echo recovery — provisional

### Generation provenance

- **Original built-in generation:** Echo attempt 1, output `exec-7ca19769-a7b4-4cc7-b175-487443e7e27c.png`, generation directory `019f6670-5b36-7d92-86d0-694268c55d80`.
- **Source:** `1254x1254` sRGB RGB, one PNG frame; SHA-256 `07c4fe09c4330dd696ecbb131a06480fe653fb04787d12c2d68d457a5998f43d`.
- **Seed:** not exposed by the built-in tool.
- **Reference role:** the production original constrained the canvas, draw contract, alignment, and comparison evidence; it was not an image-generation input.
- **Exact prompt:** unchanged from `docs/assets/prompts/shooter/02-m2-second-tranche.md`, section “Echo attempt 1.” That section contains the full role prompt plus the authoritative positive and negative suffixes used by the successful invocation. No prompt was re-run in this recovery.

### Matte and deterministic fit

- Chroma removal: border auto-key, soft matte, transparent threshold `12`, opaque threshold `220`, despill, no edge contraction, no hand painting, no BiRefNet fallback.
- Sampled key: `#0df60a`.
- Matte counts: 967,379 transparent and 4,397 partially transparent pixels of 1,572,516.
- Matte: `1254x1254` sRGBA; 5%-alpha bounds `956x1079+149+82`; four transparent corners; SHA-256 `77d031b4e3daaf62484de7811ea6386d9d9cab4be7440d9fba46168b05729786`.
- Fit: crop those bounds, resize proportionally inside the original `1037x895` alpha envelope, center on that transparent extent, composite at `+258+49` on a `1536x1024` transparent canvas, then strip volatile PNG metadata.
- Canonical stripped fit SHA-256: `f019609c2c7d9ecc4cadccaedc8b4bbe7c08788682fd3560c972b3abdbf3f0f0`; pixel signature `0a2b20e6a09f62c01f61e8364cc0f09332a91e24786959f574f083bc8297fd2f`.
- Canonical stripped derivative SHA-256: `801253b039b634f899b6d465eca25a68ec9fede3ad3cd837955edff6d12858e1`; pixel signature `59ce19cd8176bf012519862fd30e54067e986d62fd0729bbf27fcb8e2298b6a5`.
- Derivative: `1536x1024` sRGBA, one frame; 5%-alpha bounds `793x895+380+49`; center2 `1553,993`; four transparent corners.
- A second stripped reconstruction produced the same fit and derivative file hashes, pixel signatures, and `magick compare -metric AE` result of `0`.

The candidate and original share the exact 5%-alpha center2 (`1553,993`). Their complete source canvas, frame count, renderer draw box, entity/hitbox, class tint, phase opacity, and registration path remain unchanged.

### Static and live evidence

- Exact renderer-size `44x44` visible comparison on `#05070b` and `#b8b8b0`: `docs/assets/reviews/m2-wraith-echo-recovery/matched/echo-visible.png`.
- Exact renderer-size `44x44` comparison at the authored 15% phase opacity: `docs/assets/reviews/m2-wraith-echo-recovery/matched/echo-ghosted.png`.
- Complete-canvas `96x96` Bestiary simulation with the existing 25% Tech Drone tint: `docs/assets/reviews/m2-wraith-echo-recovery/bestiary/after-echo.png`.
- Deterministic matched `480x854` W6-2 Wave 1 RAW captures at 2,400 ms and 3,200 ms after the same single-script DevPanel launch, briefing skip, god-mode activation, and panel close: `docs/assets/reviews/m2-wraith-echo-recovery/matched/echo-gameplay-visible.png` and `echo-gameplay-ghosted.png`.
- Candidate-only graded W6-2 visible and phase-state captures: `docs/assets/reviews/m2-wraith-echo-recovery/gameplay/after-echo-w6-2-visible.png` and `after-echo-w6-2-ghosted.png`.
- Cross-tranche actual-draw-size comparison against the six retained/accepted production silhouettes: `docs/assets/reviews/m2-wraith-echo-recovery/tranche-silhouette-comparison.png`.
- Candidate W6-2 observations: the connected offset masses remain readable in both full-opacity and phase presentation, stay distinct from the accepted round Drone and broad Gunner, and preserve the authored six-unit motion and purple phase-light presentation. Both graded and matched RAW candidate sessions reported zero console errors and zero warnings.

### Live Bestiary and decision

The isolated save visibly entered the sole-entry Echo list (`DISCOVERED 1/13`). A fresh-session blur reset, neutral interval, first-canvas focus, trusted held Enter, release, and post-input wait opened the live Echo detail. The candidate remains centered and readable in the actual `96x96` turntable presentation; its class, stats, behavior copy, and layout are unchanged. Evidence: `docs/assets/reviews/m2-wraith-echo-recovery/bestiary/live-echo.png`. The session reported zero console errors and zero warnings.

**Decision:** accepted by explicit user approval on 2026-07-16. If the candidate is later rejected, restore the pinned original byte-for-byte.

## Recovery acceptance checkpoint

Both production paths contain the explicitly approved candidates. Acceptance records the visual review decision separately from the automated evidence below.

| Enemy | Static actual size | Live gameplay | Live Bestiary | Alignment | Current state |
|---|---|---|---|---|---|
| Wraith | Pass | Pass, W4-2 | Waived: existing detail entry behavior | `-0.5` source Y pixel (`-0.0176` draw pixel) | Accepted by explicit user approval |
| Echo | Pass visible and 15% phase | Pass, W6-2 | Pass | Exact center | Accepted by explicit user approval |

# Asset Pipeline — Free Options (Decision Doc)

**Date:** 2026-07-12 · **Status:** RECOMMENDED, awaiting user sign-off
**Question:** "Currently I make my own assets and import them — is there a better way? Can we source or generate them? Free options only (I have Claude Max + Codex/ChatGPT max-tier subs)."

Research method: 5 parallel research agents (one per lane, ~200 live page fetches), then an
adversarial verification pass re-checking the 10 load-bearing claims against primary sources
(GitHub repos, HuggingFace model cards, official pricing pages). Verified July 12, 2026.

---

## TL;DR — the recommended pipeline

**"Codex-seeded local":** hero/reference art through the sub you already pay for; volume,
alpha, and style-lock local on the Mac. Everything scriptable from Claude Code. $0 new spend.

1. **Hero art / references — Codex CLI's native `image_gen` tool.** Verified: the Codex CLI
   ships an image-generation tool (`codex-rs/ext/image-generation` in
   [github.com/openai/codex](https://github.com/openai/codex)) plus an official `$imagegen`
   skill whose docs explicitly list **game sprites** as a use case. Runs on ChatGPT-plan OAuth —
   no API key, no metered billing — and works non-interactively via `codex exec`, so Claude Code
   can orchestrate it. Caveats: image turns burn plan limits ~3–5× faster than text; current
   model (gpt-image-2) has **no transparent background support** — generate on flat `#00FF00`
   and key/matte locally; one-shot multi-pose sprite sheets fail (limb-swap) — generate
   frame-by-frame against a locked reference image.
2. **Volume generation — local on Apple Silicon.** [mflux](https://github.com/filipstrand/mflux)
   (MIT, pure CLI) running Apache-2.0 models: **FLUX.2-klein-4B** (FLUX-grade realism,
   multi-reference editing), **Z-Image-Turbo** (8-step, fast-iteration workhorse, fits 16GB),
   FLUX.1-schnell (baseline). Alternative: **Draw Things** (free, faster Metal kernels,
   headless gRPC server, and **on-device LoRA training**). Unlimited, license-clean, ~30–90s
   per 1024px image on M-series — batch overnight.
3. **Alpha — local `rembg` with `birefnet-general` (MIT)** — already the plan's Task 9 tool.
   Avoid the `bria-rmbg` model (non-commercial). Semi-transparent glows matte poorly —
   generate those on black and additive-blend in canvas instead.
4. **Style lock:** master-style-guide prompt suffixes + a canonical reference image per subject
   + fixed seeds; once ~25–40 accepted assets exist, train a style LoRA in Draw Things
   (~15–20 min on M-series) or `mflux-train`. **License trap:** FLUX Redux/Kontext-dev/Krea-dev
   are non-commercial — the Apache-clean reference-editing alternative is Qwen-Image-Edit.
5. **The 8-yaw NPC billboard problem** (spec §5.4 Path B): hero image →
   [TRELLIS.2](https://github.com/microsoft/TRELLIS.2) (MIT; Mac port `trellis-mac`, ~3.5–5
   min/mesh, wants 24GB+) → headless Blender (`blender -b -P render_yaws.py`, 8 camera yaws)
   → low-denoise img2img LoRA style pass → rembg. Yaw 3 and yaw 7 are guaranteed the same
   creature — pure prompting still drifts on back-quarter views in 2026.

**Fallback (hosted, recurring-free):** Leonardo.ai — verified 150 tokens/day recurring, the
only free tier with **native transparent-PNG** generation; commercial use allowed on free plan
(non-exclusive, images public — fine for a free web game). Web-UI only.

**Free library wins to take regardless (effects are a solved problem):**
- Explosions/particles: Sinestesia CC0 explosion sheets (OpenGameArt) + Kenney Particle Pack
  (CC0) — tint to the emissive palette.
- FP weapons: Rekkimaru FPS gun sprites (itch.io) — gritty rendered-then-painted, ~80% fit.
- Space backgrounds: Screaming Brain seamless nebulas (CC0).
- Industrial texture seeds: ambientCG / Poly Haven / Foxtex (all CC0) — feed as references.
- **Never Realm667** — openly credits id Software sprites; reference only.

## What's NOT free (verified, so we stop wondering)

| Option | Verdict |
|---|---|
| Higgsfield MCP (connected to Claude) | 0 credits on the account, trial needs a card — not free |
| Google AI Studio API | free tier **excludes all image models** now (web UI is free but unscriptable) |
| Recraft free | Recraft owns free-plan images — unusable |
| Krea free | no commercial use below $9/mo |
| fal.ai / Replicate | pay-per-use (the spec's original Path A costs ~$0.03–0.05/img — cheap but not $0) |
| Claude Max | no image generation exists; orchestration only |

## First pilot (spec §5.4, adapted): 1 enemy sheet + 1 background, ~half a day

1. **Setup (~30 min):** `pipx install mflux "rembg[cli]"`; install Draw Things; confirm
   `codex` login. `brew install imagemagick`.
2. **Style bible via Codex (~20 min):** one canonical style paragraph from
   `docs/assets/prompts/doom/00-master-style-guide.md` + flat `#00FF00` background directive;
   `codex exec '$imagegen …'` × 8–10 concepts of ONE subject; keep the best as the canonical
   reference.
3. **Frames (~1–2h):** frame-by-frame, re-attaching the canonical reference every call
   ("transfer only the pose; preserve identity; frame N of 8; same green background; do not
   mirror"). Expect 2–3 retries/frame.
4. **Alpha + pack (~30 min, scripted):** HSV chroma-key the green (hue ±22°, sat/val ≥ 0.3) or
   `rembg i -m birefnet-general`; `magick montage -background none -tile 8x1` → sheet PNG.
5. **Background (~30 min):** mflux portrait 1024×1536, seeded with a CC0 metal texture
   reference; downscale to 480-wide; check the vertical tiling seam.
6. **The real quality gate:** drop into the game, `yarn build`, playtest at 480×854 —
   silhouette readability at draw size, not 1024px prettiness.
7. **If it passes:** train the style LoRA from accumulated approved images; volume goes local;
   TRELLIS.2→Blender for the first billboard NPC (quartermaster — after `NPC_QUARTERMASTER`
   gets its own sprite constant, spec §5.4 prerequisite).

## Honest caveats

- Frame-to-frame identity drift is the #1 failure mode (mitigation: reference re-attachment,
  retries, per-character LoRA for recurring subjects).
- On a 16GB Mac local FLUX is quantized-only and slow; Z-Image-Turbo is the escape hatch.
- Purely AI-generated art may not be copyrightable — acceptable for a free web game.
- Semi-verified: exact ChatGPT Pro image caps; Draw Things JS/HTTP scripting (gRPC is solid);
  Leonardo transparency-on-free-plan is docs-implied.

## How this changes the committed spec

Spec §5.4's Path A (FLUX via fal.ai, ~$0.03–0.05/img) is replaced as primary by **Codex
`image_gen` + local mflux** (both $0). Path B's 3D leg (fal.ai/Meshy) is replaced by **local
TRELLIS.2**. BiRefNet alpha and the style-guide/seed discipline are unchanged. The pilot
subject (quartermaster) and judging criteria (spec §5.4) are unchanged.

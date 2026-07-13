# Asset Pilot — Quartermaster (2026-07-13)

First live run of the free pipeline from `../2026-07-12-asset-pipeline-free-options.md`.
Total cost: $0 (one Codex image turn ≈ 72k plan tokens + ~30s local CPU for the matte).

## Files

| File | What |
|---|---|
| `quartermaster-hero-v1.png` | Raw Codex `image_gen` output, 1024×1536, flat #00FF00 bg |
| `quartermaster-hero-v1-alpha.png` | After local BiRefNet matte (transparent bg) |
| `quartermaster-billboard-128x256.png` | Downscaled to the NPC billboard size the raycaster uses |

## The three commands (rerunnable)

```bash
# 1. Generate (Codex CLI, runs on the ChatGPT sub — no API key)
codex exec -s workspace-write -C docs/assets/pilot '$imagegen Generate ONE image and
save it to <name>.png ... [subject + framing] ... Background: FLAT SOLID pure green
#00FF00 ... [positive suffix from docs/assets/prompts/doom/00-master-style-guide.md §8]
... Avoid: [negative suffix §8]'

# 2. Alpha (local, free — BiRefNet via rembg, installed: pipx install "rembg[cpu,cli]")
rembg i -m birefnet-general <name>.png <name>-alpha.png

# 3. Game-size preview (the real quality gate is readability at draw size)
sips -z 256 128 <name>-alpha.png --out <name>-billboard.png
```

## Verdict inputs (spec §5.4 judging criteria — USER CALL PENDING)

- DOOM-fidelity: strong — worn plating, crushed shadows, hot key light, emissive-only cyan.
- Silhouette at billboard scale: reads clearly at 128×256 (and the slate still shows).
- Alpha cleanliness: corners fully transparent; faint green edge-spill visible at 100% zoom
  (invisible at game scale; a despill pass or HSV chroma-key instead of matting removes it
  if it ever matters).
- Cohesion potential: this image becomes the CANONICAL REFERENCE — every variant/pose
  re-attaches it ("transfer only the pose; preserve identity") with the same suffixes.

## Next steps if approved

1. Pin this as the quartermaster reference; add `NPC_QUARTERMASTER` to `sprites.ts`
   (spec §5.4 prerequisite — quartermaster currently shares `NPC_KAEL`).
2. Generate 2–3 more subjects the same way (~30–40 accepted images unlocks a style LoRA
   in Draw Things for full local volume).
3. For multi-yaw NPCs: TRELLIS.2 → headless Blender per the pipeline doc.

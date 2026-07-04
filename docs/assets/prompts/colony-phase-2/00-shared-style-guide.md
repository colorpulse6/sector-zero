# Colony Phase 2 — Shared Style Guide

Apply this context to every Phase 2 asset prompt.

## Aesthetic

- Retro-futuristic, pixel-art-adjacent. Think Wolfenstein 3D meets a
  hand-painted sci-fi illustration.
- Canvas 2D friendly: limited anti-aliasing, crisp edges, readable at
  small raycaster draw sizes.
- Palette tied to the companion site's HUD tokens:
  - Deep background: `#0a0e17`
  - Cyan accent: `#00f0ff`
  - Purple accent: `#7800ff`
  - Text primary: `#e0e6ed`
  - Danger: `#ff3366`
  - Success: `#44ff99`

## Biome

Phase 2 colonies are on Ashfall (desert). Sky/ground/walls in the
exterior reuse existing Ashfall sprites. NEW Phase 2 assets should
be biome-agnostic where possible (building walls, interior props
work anywhere). Biome-aware variants land in Phase 4+.

## Perspective

- **Wall textures**: square tile (64×64), square-on perspective,
  tileable edges, no vignette or gradient that breaks the tile.
- **Environment floor tiles** (landing pad, foundation): square tile
  (64×64), top-down view with slight perspective, tileable.
- **Billboards** (props, scaffolding, interior items): front-facing
  view, transparent background, standing on ground plane at bottom.

## Negative prompts (apply to all)

- No text, letters, or numbers on the asset
- No people, NPCs, or living creatures
- No transparent gradients that clash with raycaster draw
- No heavy JPEG artifacts, no watermarks
- No logos, no brand marks

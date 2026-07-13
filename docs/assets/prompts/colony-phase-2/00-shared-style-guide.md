# Colony Phase 2 — Shared Style Guide

Apply this context to every Phase 2 asset prompt.

## Aesthetic

**Superseded — see `../doom/00-master-style-guide.md`** (modern DOOM 2016/Eternal
direction: desaturated worn surfaces, crushed shadows, emissive-only accent colors).
The pixel-art-adjacent / Wolfenstein 3D direction that used to live here is now the
opposite of the goal. The HUD hex tokens survive in the master guide's emissive tier;
readability at small raycaster draw sizes still applies (silhouette-first, §5 there).

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

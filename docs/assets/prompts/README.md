# Asset Prompts

This folder holds GPT prompt templates for generating Sector Zero game assets.
Each phase (or asset class) gets its own subfolder.

## How this works

1. Spec/plan author drafts a prompt file per asset class, with:
   - Sprite ID (matches entries in `game/app/components/engine/sprites.ts`)
   - Target filename + path
   - Dimensions, perspective, alpha
   - A copy-paste-ready GPT prompt
   - A negative prompt (what to avoid)
   - Iteration notes (filled during generation)
2. User runs GPT sessions with the prompts, drops resulting images into
   `game/public/sprites/<class>/...` at the paths specified.
3. User opens a small PR registering the sprite path constants in `sprites.ts`.
4. Renderer picks them up automatically. Color-tint fallback was used until then.

## Index

- `doom/` — **master style guide** (modern-DOOM art direction; ALL prompts inherit it)
- `colony-phase-2/` — 11 assets for Phase 2 FPS descent (walls, environment, interiors);
  its aesthetic section is superseded by `doom/00-master-style-guide.md`

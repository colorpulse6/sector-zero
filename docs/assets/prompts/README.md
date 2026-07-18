# Asset Prompts

This folder holds GPT prompt templates for generating Sector Zero game assets.
Each phase (or asset class) gets its own subfolder.

## How this works

1. Spec/plan author drafts a prompt file per asset class, with:
   - Planned Sprite ID (becomes a `sprites.ts` entry only when a real consumer exists)
   - Target filename + path
   - Dimensions, perspective, alpha
   - A copy-paste-ready GPT prompt
   - A negative prompt (what to avoid)
   - Iteration notes (filled during generation)
2. An operator or asset agent generates candidates with the accepted pipeline; rejected
   attempts stay outside the repository.
3. Selected candidates are processed to their exact runtime dimensions/alpha contract and
   reviewed at their intended renderer size on the required comparison panels.
4. Once a real consumer exists, a small PR registers and consumes the already reviewed PNG;
   data modules reference the `sprites.ts` constant rather than hardcoded renderer paths.
5. The color-tint fallback remains until the registered asset is exercised in the game.

## Index

- `doom/` — **master style guide** (modern-DOOM art direction; ALL prompts inherit it)
- `colony-phase-2/` — 11 assets for Phase 2 FPS descent (walls, environment, interiors);
  its aesthetic section is superseded by `doom/00-master-style-guide.md`
- `m3-hubs/` — execution-ready Cantina, Marketplace, and Town Hall environment/NPC
  contracts, prompts, and review gates; produce in that order

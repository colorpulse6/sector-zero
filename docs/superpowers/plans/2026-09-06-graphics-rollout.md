# DOOM Graphics Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement bounded lanes with independent review. The existing pilot is user-approved; continue its accepted architecture.

**Goal:** Apply the approved asset detail and motion treatment to every live first-person scene and actor.

**Architecture:** Retain the CPU raycaster, add correct panoramic sampling and static-texture detail, parameterize Blender actor production, and wire richer world materials into existing map/interaction contracts.

**Tech Stack:** TypeScript/Next.js, Canvas raycaster, Blender 4.4.3 Python, native image generation when useful, node:test and Playwright.

## 1. Baseline and catalog

- [x] Create `codex/graphics-rollout` from `a334698`, install locked dependencies and run all engine/colony/sprite tests.
- [x] Record live scene/actor inventory and approved source references under `docs/assets/graphics-rollout/`.
- [x] Review this spec/plan against real constructors before implementation.

## 2. Renderer — parent ownership

Files: `engine/fpRender/renderCore.ts`, `textures.ts`, `fpRender/index.ts`, `engine/sprites.ts`, new small sampling/mip helpers as needed, `tests/engine/`.

- [x] Prove wrong sky FOV with ray-angle and viewport-independent tests; implement angular columns with wrap and bounded reuse.
- [x] Test tile/sky/prop decode dimensions and mip selection; implement higher static detail and distance filtering without changing actor cell dimensions.
- [x] Parent owns the singleton registry, stable static texture IDs, a separate 40 MiB frame pool, `sprites.ts` source-image release API, and new static path registration/preload. Runtime lane owns `actorAssets.ts` scene retention using those APIs: retain only current-scene images up to 80 MiB, ignore departed-scene late completions, and keep legacy fallback above the cap. Verify repeated exterior/interior/combat/return and late-load behavior.
- [x] Run render/lighting/atlas tests; retain deterministic golden explanations.

## 3. Environment art — asset lane ownership

Files: `game/scripts/world-assets/`, `docs/assets/graphics-rollout/world/`, owned replacement low-res static PNGs, new `game/public/sprites/world/` assets. No TypeScript changes.

- [x] Inspect existing art and create exact subject/dimension manifest.
- [x] Generate detailed utility facade/floor/prop replacements and shared room/station/ruin material sets, retaining editable Blender source and scripts.
- [x] Render sample facades and machinery for parent inspection before full batch.
- [x] Verify dimensions, transparency, no clipped silhouettes and consistent materials; record bytes/source hashes.

## 4. Actor art — asset lane ownership

Files: `game/scripts/actors/`, `docs/assets/actor-motion/`, `game/public/sprites/actors/`. No runtime files.

- [x] Inspect all 8 new live humanoid references plus the existing shared monster.
- [x] Parameterize source generation by identity; preserve quartermaster source unchanged.
- [x] Render Voss/Reyes/one monster sample for parent review, then all new live identities and agreed clip contracts.
- [x] Produce contact sheets, alpha/frame validation, source manifests and repeatable scripts without redundant imported rig copies per identity.

## 5. Actor runtime — runtime lane ownership

Files: `engine/fpRender/npcAtlas.ts`, `sceneInput.ts`, new `engine/actorAssets.ts` and actor initialization/stepping helpers, `engine/types.ts`, `firstPersonEngine.ts`, colony `npc/` step/generation files; matching tests. This lane does not edit `sprites.ts`, `textures.ts`, Ashfall/interior factories, `gameEngine.ts`, `Game.tsx` or `poiTemplates.ts`. Export helper APIs for any constructor hooks the parent must wire. Prefer universal first-person update initialization where it covers all routes without duplicated constructor edits.

- [x] Add catalog-driven frame selection, scene-specific preload and static fallback. Coordinate exact set/clip contract with asset lane before coding assumptions.
- [x] Use state-owned clocks and actual traveled distance across NPC/enemy construction routes. Preserve quartermaster routine; eliminate continuous idle drifting for other walkers with pauses and short purposeful walks.
- [x] Connect hostile action clips to actual attack/hit/death events without modifying combat outcomes.
- [x] Test all named NPC and hostile spawn paths, direction/clock/action behavior, freeze, schedule constraints, fallback and bounded loads.

## 6. World integration and preview — parent ownership

Files: `colony/exploration/buildingTiles.ts`, `colonyLayout.ts`, `engine/ashfallForwardCamp.ts`, `keplerBlackBoxMission.ts`, `colony/region/poiTemplates.ts`, `gameEngine.ts`, `Game.tsx` shared FP conversion paths as necessary, new inspection route/component, browser tests. Parent wires any actor helpers into these shared constructors; runtime lane never edits these files.

- [x] Replace the Ashfall sky and update background/material consumers; first correct projection, then inspect a full turn.
- [x] Add distinct utility-room surfaces/ceilings and safe decorative dressing; add station/ruin material kits to all existing constructors.
- [x] Extend the playable inspection route to real scene fixtures and all actors. Provide labels and controls useful for visual review.
- [x] Validate each inventory family in actual runtime; no silently omitted family.

## 7. Final verification and handoff

- [x] Run complete engine/colony/sprite tests, relevant browser regressions, base-path static export, and production visual inspection.
- [x] Obtain fresh spec and code review; fix material findings, rerun affected checks.
- [x] Record screenshots, asset sizes, warm local render timing and any honest art limitations.
- [x] Commit owned paths, confirm clean worktree, and leave the playable rollout running. Do not merge or deploy without further authorization.

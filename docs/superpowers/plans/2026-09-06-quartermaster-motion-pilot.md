# Quartermaster Motion Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Deliver the approved DOOM-style quartermaster asset and movement pilot in a playable browser scene and actual colony entry.

**Architecture:** Keep the CPU raycaster. Add opt-in atlas animation, state-owned quartermaster motion and distance-based weapon presentation, with Blender-rendered assets and existing sprite fallbacks.

**Tech Stack:** TypeScript, Next.js, node:test/tsx, Playwright, Blender 4.4.3 Python.

## 1. Establish baseline and asset source

- [x] Install the worktree's locked game dependencies and run engine/colony tests to a retained log.
- [x] Inspect original quartermaster reference and source/license of any imported humanoid.
- [x] Create `game/scripts/quartermaster/render_pilot.py` and editable source under `docs/assets/quartermaster-motion/`; render an early sample for review, then the three specified atlases and workstation. Asset agent owns only these paths and `game/public/sprites/pilot/quartermaster/`.
- [x] Add `game/tests/sprites/quartermasterAssets.test.ts` to verify PNG dimensions, alpha, nonempty cells, atlas count and bounded bytes once sample approval establishes actual art paths. Assets must match the design's fixed atlas contract.

## 2. Add directional animation and atlas decoding

Files: create `engine/fpRender/npcAtlas.ts`; modify `engine/types.ts`, `engine/fpRender/textures.ts`, `engine/fpRender/sceneInput.ts`; create `tests/engine/npcAtlas.test.ts` (paths under `game/app/components` / `game`).

- [x] Write failing tests for eight viewer-relative directions including wrap, static legacy fallback, idle/work timing and walk phase driven by distance.
- [x] Implement typed atlas metadata and a pure frame selector. Use 4/8/8 columns and 128x256 cells, clamped/normalized inputs. Retain `resolveNpcSprite` unchanged as loading and legacy fallback.
- [x] Add a TextureRegistry frame-crop entry point, bounded cache by asset+cell, and lazy asset requests. Decode ready frames without resizing the entire atlas; failures retain the static NPC.
- [x] Run selector and existing render golden tests. Exercise crop output in browser with the actual atlas.

## 3. Connect state-owned motion and workstation

Files: create `colony/exploration/npc/quartermasterMotion.ts`; modify `npc/npcStep.ts`, `npc/colonyNpcs.ts`, `npc/types.ts`, `colony/exploration/index.ts`; create `tests/colony/quartermasterMotion.test.ts`.

- [x] Write failing tests for work pauses, short walk and return, collision-safe candidate selection, cumulative traveled distance, heading wrap, frame-rate-independent stepping and full dialogue freeze.
- [x] Implement the small deterministic quartermaster cycle behind the opt-in actor metadata. Preserve existing A* schedule approach and legacy actors. Use actual position changes to derive heading/gait, stationary work/idle clips and short facing transitions.
- [x] Attach the workstation to the daytime post and preload the pilot assets on entry. Placement is decorative, does not add invisible collisions, and must not sit over the actor/door/pad.
- [x] Run all colony tests including existing shop/faction tests and verify legacy sprite fallbacks.

## 4. Improve weapon presentation

Files: create `engine/weaponMotion.ts`, `tests/engine/weaponMotion.test.ts`; modify `engine/firstPersonEngine.ts`, `engine/firstPersonRenderer.ts`, `engine/types.ts`.

- [x] Write failing tests for idle settling, collision-resolved distance, equivalent travel across dt values, dialogue freeze, finite bounded recoil and absent-state defaults.
- [x] Advance an optional state-owned presentation record after movement resolution. Render gun offsets from this record; keep gun asset/firing logic and player speed unchanged.
- [x] Run existing first-person engine/input tests and the new presentation tests.

## 5. Build preview and complete verification

Files: create `game/app/quartermaster-pilot/page.tsx`, `game/app/components/QuartermasterPilot.tsx`, and `game/tests/browser/quartermasterPilot.spec.ts`; document receipts under `docs/assets/quartermaster-motion/`.

- [x] Build a no-save preview from a deterministic colony fixture, using actual engine rendering and movement. Provide browser keyboard navigation plus inspection controls for front/side/back views and existing automatic actor animation. Keep controls separate from gameplay UI.
- [x] Browser assertions exercise visible scene startup, atlas requests/crops, moving and stationary presentation, no page errors and no save writes. Verify actual legacy colony entry and quartermaster shop still work.
- [x] Run engine/colony/sprite suites and static build. Use production preview for final visual inspection and retain screenshots/video and perf observations.
- [x] Review spec compliance, then code quality with independent fresh-context reviewer(s), resolve meaningful findings, commit only pilot-owned paths and leave the preview running for the user. Do not merge, push or deploy.

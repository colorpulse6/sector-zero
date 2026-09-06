# Graphics rollout verification — 2026-09-06

The first-person rollout is implemented on `codex/graphics-rollout`, based on the accepted quartermaster pilot at `a334698`. The original checkout and pilot worktree were preserved. This is an isolated local change, not merged, pushed or deployed.

## Final checks

Commands ran from the rollout's `game/` directory.

| Check | Outcome |
|---|---|
| `corepack yarn tsx --test tests/engine/*.test.ts tests/colony/*.test.ts tests/sprites/*.test.ts` | 895 passed, 0 failed, 0 skipped; exit 0 |
| `NEXT_PUBLIC_BASE_PATH=/sector-zero corepack yarn build` | Production compilation, lint/type checks and static export passed; exit 0 |
| Playwright `graphicsPreview.spec.ts`, desktop-keyboard, production export at port 3088 | 4 passed in 1.1 minutes; exit 0 |
| Existing `cantinaIntegration`, `quartermasterPilot`, `quartermasterTrade` browser regressions | 4 passed in 2.8 minutes against the development server; exit 0 |
| Runtime PNGs compared with the final static export | All 55 changed/new PNGs match SHA-256; 35,399,315 compressed bytes |

The final aggregate and production browser run include the corrected hostile strike/recoil assets and floor-based prop positioning. Existing campaign purchase regressions ran before the final prop positioning correction; that correction changes prop rendering and labels, not purchase, dialogue, movement or save behavior.

The production gallery browser command was:

```sh
GRAPHICS_TEST_URL=http://127.0.0.1:3088 NEXT_PUBLIC_BASE_PATH=/sector-zero \
  PLAYWRIGHT_OUTPUT_DIR=/tmp/sector-zero-graphics-production-grounded-results \
  corepack yarn playwright test graphicsPreview.spec.ts \
  --config /tmp/sector-zero-graphics-playwright.config.ts --project desktop-keyboard
```

The temporary configuration imports the repository's Playwright configuration, disables its development server, selects the running production export, and uses one worker. Browser assertions exercise all 11 real scene factories and repeated returns; all active actor source images load, PNG responses succeed, and source/frame caches remain within budget. Separate cases verify dialogue freeze and an in-memory purchase, legacy image fallback and recovery, and actual attack/hurt/death frame decoding during combat. The existing browser cases verify campaign purchase persistence through room exits, takeoff and reload, plus quartermaster preview save isolation and image fallback.

## Visual and resource receipts

- [All 11 production scenes](screenshots/scene-contact.png), individual captures and four quarter-turn Ashfall captures are in `screenshots/`.
- [Per-scene measurements and actor/cache state](scene-render-receipts.json) retain the actual browser snapshots.
- [Runtime/export file hashes](runtime-export-verification.json) cover all 55 changed/new runtime PNGs.
- [World source receipt](world/verification-receipt.md) covers 32 Blender renders: 23 opaque tiles and 9 transparent props, totaling 9,509,544 compressed bytes.
- [Actor receipt](../actor-motion/verification-summary.json) covers 9 new identities, 21 atlases and 910 cells, totaling 21,305,172 compressed bytes. The approved quartermaster remains separate and unchanged.

Production captures were inspected for ground contact, room surfaces, backgrounds, sprite visibility and the complete sky turn. The solar machinery was also inspected interactively in the production browser after its ground-position correction. The gallery uses an in-memory save; the normal game consumes the same rendering and actor implementation.

Warm local renderer measurements use the full 480×714 scene buffer after a three-second settling period, sampling the renderer's rolling timing window. They exclude post-processing and other game-loop work, and are not a cross-device frame-rate guarantee. A separate visible browser preview was open during this run.

| Scene | Median render ms | p95 render ms | Resident actor sources MiB | Decoded actor cells MiB |
|---|---:|---:|---:|---:|
| Ashfall | 4.7 | 5.3 | 36.0 | 1.50 |
| Colony | 7.1 | 9.8 | 56.0 | 9.38 |
| Solar room | 8.7 | 9.8 | 0 | 0 |
| Farm | 8.5 | 9.5 | 0 | 0 |
| Purifier | 8.7 | 9.8 | 0 | 0 |
| Habitat | 8.9 | 9.9 | 0 | 0 |
| Mine | 9.5 | 9.8 | 0 | 0 |
| Cantina | 9.6 | 11.8 | 36.0 | 1.50 |
| Station | 6.5 | 6.9 | 35.5 | 1.00 |
| Kepler | 6.5 | 7.2 | 35.5 | 1.00 |
| Cinder | 6.4 | 6.7 | 35.5 | 1.00 |

Source images are capped at 80 MiB, decoded actor frames at 40 MiB / 320 slots. These figures describe actor storage, not total process memory. Runtime sky, wall, floor and static prop textures use the separate static registry.

## Review corrections

Fresh specification, runtime and art reviews were completed in the independent work lanes. Findings resolved before the final checks:

- Floor filtering now accounts for both forward and lateral pixel footprints, reducing distant texture shimmer.
- Pilot actor retention initializes before the first animation frame; departed-scene late completions are released.
- Sentries face the current target at actual shot onset while preserving combat damage and timing.
- Hostile attack talons advance toward the target; hurt recoils backward. Reopened editable-source renders reproduce shipped reference pixels.
- Static props and their labels use the projected floor plane. A regression test first failed under the old positioning, then passed for multiple distances and scales after the correction.

The hostile idle/walk loops intentionally contain symmetric return poses: three distinct idle poses in four frames and five walking poses in eight frames. All clips animate. Editable actor sources reopen with packed images; world source reopens without external image dependencies. Detailed source geometry and replay evidence live beside those sources.

Known artistic limits remain the original raycaster's flat floors and camera-facing billboards. Material panels repeat, and fractured ruin tiles have more visible edge variation than uniform metal. The separate 2D space combat, menus, portrait libraries and dormant shops are outside this first-person pass.

## Local handoff

Preview: <http://127.0.0.1:3088/sector-zero/graphics-preview/>. It serves this worktree's `game/out` production export. The gallery allows scene and actor selection, four actor viewpoints, a full sky turn, lighting changes and render-resolution selection. The approved quartermaster pilot remains available on its original port 3086.

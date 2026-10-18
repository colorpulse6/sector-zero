# Plan — Remove the ground run-and-gun and ship boarding modes

Date: 2026-10-18. Owner: Codex cleanup agent ("Cleanup", gpt-6-astra) in worktree
`~/.config/superpowers/worktrees/sector-zero/remove-ground-boarding`, branch
`codex/remove-ground-boarding` (from `2ef7779`). Coordinator: the Claude "Colony" session.

## Why

Nic is simplifying Sector Zero around one structure:

1. **Hub** — the cockpit.
2. **Star map** — the Galaxy Atlas (galaxy / sector / system / region).
3. **Travel battles** — travel takes time and can be interrupted by space battles
   (vertical shooter and turret).
4. **Colony** — descend to a planet: walk the colony in first person and manage it.

Ground run-and-gun (Contra-style) and ship boarding (top-down) do not fit this structure.
Nic decided (2026-10-18) to remove both. Everything else stays.

## Keep (do not remove or weaken)

- Vertical shooter (`gameEngine.ts`, `renderer.ts`) and its variants (`base-defense`,
  `mech-duel` if they are shooter variants).
- Ship turret (`turretEngine.ts`, `turretRenderer.ts`).
- First-person raycaster: missions (for example the Kepler black box) **and**
  `colony-exploration` (the colony walk-in). The colony depends on it.
- Multi-phase level chaining (`phases.ts`, `phaseTransition.ts`).
- The legacy campaign plumbing and the galaxy run plumbing. Another session is moving the hub
  and colonies onto the galaxy run; do not restructure either experience.

## Remove

- [x] **R1 Inventory.** List every reference to `"ground-run"`, `groundState`,
  `groundEngine`, `groundRenderer`, `"boarding"`, `boardingState`, `boardingEngine`,
  `boardingRenderer`, `EngineKind` `"groundRun"` / `"boarding"`, ground/boarding sprites,
  DevPanel shortcuts, touch-control mappings, input intents, levels/phases, tests and docs.
  Record the list in this file under "Inventory" before deleting anything.
- [x] **R2 Engines and types.** Delete the four engine/renderer files. Remove the two
  `GameMode` members, the two `GameState` fields, and every dispatch branch (game loop,
  renderer, dashboard, input intents, touch controls, Game.tsx, GraphicsPreview, DevPanel).
- [x] **R3 Levels and phases.** Campaign levels or phases that use either mode: drop those
  phases and keep the rest of the level. If a level would become empty, convert it to a
  single shooter phase (keep its id, name and rewards). List every changed level here.
- [x] **R4 Region sites.** `EngineKind` loses `"groundRun"` and `"boarding"`. The region
  POI templates that used them (2 + 2 today) move to `firstPerson` using the existing
  first-person templates in `colony/region/poiTemplates.ts`. Keep POI ids, names, rewards
  and outcome ids stable. Check `galaxyPoiOutcomeAuthority.ts`, `poiRuntime.ts` and the
  operation adapters.
- [x] **R5 Save safety.** `save.ts` migrates field by field. Any persisted value that can
  name a removed mode or engine (pending POI session, active operation phase, scene stack,
  campaign position, outcome envelope, galaxy run checkpoints) must load into a safe state:
  remap to `firstPerson` where a session can continue, otherwise cancel it without losing
  resources. Add migration tests with old-shape fixtures.
- [x] **R6 Assets.** Remove sprite registrations used only by the removed modes, and their
  files under `game/public/sprites/`, only after a repo-wide search shows no other use.
  Do not touch `site/`.
- [x] **R7 Tests.** Delete tests that only cover removed modes. Update tests that used them
  as fixtures to use first-person or shooter. Browser specs: update or remove with a reason.
- [x] **R8 Docs.** Update the mode tables in `CLAUDE.md` and `game/CLAUDE.md`. Add one line to
  `docs/ROADMAP.md` "Decisions of record" (2026-10-18: ground run-and-gun and boarding
  removed; structure is hub → atlas → travel battles → colony).
- [x] **R9 Verify.** All must pass, from `game/`:
  `npx tsc --noEmit -p .`;
  `npx tsx --test tests/colony/*.test.ts tests/engine/*.test.ts` (plus any other test dirs
  the repo already runs, e.g. sprite checks);
  `NEXT_PUBLIC_DEVTOOLS=1 yarn build`;
  browser specs with the local static config:
  `COREPACK_ENABLE_PROJECT_SPEC=0 PLAYWRIGHT_TEST_PORT=3117 ./node_modules/.bin/playwright test --config playwright.static.config.ts --workers=1 --retries=0 --reporter=line`
  (run `yarn install` first in this worktree; `next dev` does not work on this machine).
  Finally `grep -rn "ground-run\|groundState\|boarding" game/app game/tests` returns only
  intentional matches (for example save migration of old values), each listed in the report.

## Rules

- Work only in this worktree and branch. Commit in small steps. Never push, never merge,
  never touch `main` or `feat/region-map-chart`.
- Do not edit these files beyond deleting ground/boarding branches (another session owns
  them): `game/app/components/galaxy/**`, `game/app/components/colony/meta/**`,
  `game/app/components/engine/galaxy/**` (except removing engine names).
- In `Game.tsx` keep edits surgical: delete the ground/boarding branches only. No
  reformatting, reordering or renaming; the other session is editing Game.tsx in parallel.
- Leave `site/`, `docs/research/` and `site/tsconfig.tsbuildinfo` alone.
- If a removal turns out to break something the "Keep" list needs (for example the colony
  uses a boarding helper), stop that step, write it under "Blockers" here, and continue with
  the rest.

## Inventory

Captured before any deletion on `codex/remove-ground-boarding` at `2ef7779`. Reference locations below are pre-removal line numbers. Historical docs are inventoried but retained as historical evidence; `site/` and `docs/research/` are excluded from edits.

- `CLAUDE.md`: 38, 39
- `README.md`: 39
- `docs/ROADMAP.md`: 79
- `docs/assets/actor-motion/hostile-source-verification.json`: 7, 731
- `docs/assets/actor-motion/hub-bartender-source-verification.json`: 7
- `docs/assets/actor-motion/hub-regular-source-verification.json`: 7
- `docs/assets/actor-motion/hub-signal-chaser-source-verification.json`: 7
- `docs/assets/actor-motion/kael-source-verification.json`: 7
- `docs/assets/actor-motion/reyes-source-verification.json`: 7
- `docs/assets/actor-motion/scavenger-source-verification.json`: 7
- `docs/assets/actor-motion/source-provenance.json`: 8, 23, 38, 53, 68, 99
- `docs/assets/actor-motion/survivor-source-verification.json`: 7
- `docs/assets/actor-motion/voss-source-verification.json`: 7
- `docs/assets/prompts/m3-hubs/README.md`: 144
- `docs/assets/prompts/m3-hubs/manifest.json`: 20, 21, 22, 41, 42, 43, 62, 63
- `docs/assets/quartermaster-motion/runtime-evidence/unit-tests.log`: 660, 661, 662, 663, 664, 665, 666, 667, 668, 669, 670
- `docs/assets/reviews/m3-hubs/cantina/provenance.md`: 202, 216, 230
- `docs/assets/reviews/m3-hubs/marketplace/provenance.md`: 72, 84, 96
- `docs/assets/reviews/m3-hubs/town-hall/provenance.md`: 122, 142
- `docs/audits/2026-07-12-full-game-audit.md`: 3, 13, 14, 21, 40, 45, 64
- `docs/audits/2026-07-19-game-engine-synchronization-audit.md`: 96, 144, 152
- `docs/game/colony-system-design.md`: 16, 265
- `docs/handoffs/2026-09-05-b1-input-checkpoint.md`: 16
- `docs/handoffs/2026-09-05-b2-touch-checkpoint.md`: 21, 59, 67, 69, 71
- `docs/handoffs/2026-09-05-b3-navigation-checkpoint.md`: 50, 52
- `docs/plans/2026-04-05-ground-run-poc.md`: 7, 20, 22, 27, 44, 45, 46, 47, 53, 54, 55, 56, 60, 75, 79, 86, 96, 113, 116, 125, 130, 131, 208, 211, 221, 379, 385, 388, 395, 396, 399, 402, 425, 452, 454, 456, 462, 468, 474, 483, 486, 488, 531, 532, 537, 540, 555, 556, 558, 559, 566, 567, 577, 580, 586, 587, 624, 639, 820, 825, 836, 842, 845, 854, 867, 872, 874, 1031, 1069, 1075, 1084, 1085, 1088, 1094, 1096, 1117, 1123, 1138, 1142, 1153, 1155, 1158, 1159, 1160, 1162, 1165, 1171, 1175, 1184, 1201, 1206, 1213, 1225, 1248, 1253, 1260, 1268, 1272, 1274, 1280, 1283, 1284, 1285, 1286, 1287, 1295, 1301, 1302, 1305, 1310, 1322, 1385, 1386, 1395, 1396
- `docs/plans/2026-04-05-multi-phase-levels.md`: 84, 948
- `docs/plans/2026-04-07-ashfall-forward-camp-explore.md`: 219, 229
- `docs/plans/2026-04-07-sector-zero-site.md`: 518, 522, 523, 526, 527, 758, 759, 768, 769, 802, 807, 823, 827, 828, 832, 835, 837, 841, 898, 902, 925, 1423, 1424
- `docs/playtest/2026-07-13-playtest-checklist.md`: 30
- `docs/playtests/2026-07-19-input-intents.md`: 11
- `docs/playtests/2026-07-19-navigation-focus.md`: 36
- `docs/playtests/2026-07-19-touch-gameplay.md`: 16, 39, 70, 75, 76
- `docs/playtests/2026-07-20-m3-cantina.md`: 108, 109, 110
- `docs/playtests/2026-09-06-region-map-presentation.md`: 48
- `docs/specs/2026-04-05-sector-zero-expansion-design.md`: 14, 46, 53, 58, 83, 84, 94, 117, 176, 291, 475, 497
- `docs/specs/2026-04-07-sector-zero-site-design.md`: 84, 85, 216, 217
- `docs/superpowers/plans/2026-04-20-colony-phase-0-data-model.md`: 198
- `docs/superpowers/plans/2026-04-21-colony-phase-2-fps-descent.md`: 120, 1091, 1115, 1116, 1118, 1123, 1143, 1154, 1252, 1732, 1734, 1736, 1737, 1738, 2679, 2681, 2693, 2706
- `docs/superpowers/plans/2026-07-02-fp-pixel-graphics-system.md`: 31, 218, 299, 301, 365, 410, 429, 463, 750, 763, 820, 838, 908, 980, 985, 993, 997, 999
- `docs/superpowers/plans/2026-07-04-colony-phase-5a-npcs.md`: 90, 93, 135, 140, 150, 404
- `docs/superpowers/plans/2026-07-05-visual-overhaul-doom-phase-0.md`: 148, 162
- `docs/superpowers/plans/2026-07-14-m1-the-region.md`: 100, 102
- `docs/superpowers/plans/2026-07-18-m3-hub-asset-production.md`: 45, 235, 275, 288, 312, 332, 360
- `docs/superpowers/plans/2026-07-19-game-engine-synchronization.md`: 39, 398, 402, 420, 421, 422, 433, 439, 448, 470, 477, 529, 553, 588, 589, 620, 631
- `docs/superpowers/plans/2026-07-20-m3-cantina-runtime.md`: 100, 101, 102
- `docs/superpowers/specs/2026-04-20-colony-system-design.md`: 38, 103, 104, 125, 394, 395, 424, 425, 529, 530, 531, 955, 956, 972, 1037, 1083, 1206, 1210, 1211, 1383, 1473, 1604, 1928
- `docs/superpowers/specs/2026-04-21-colony-phase-2-fps-descent-design.md`: 140, 141, 517
- `docs/superpowers/specs/2026-07-02-fp-pixel-graphics-system-design.md`: 66, 115, 116, 199, 224, 266
- `docs/superpowers/specs/2026-07-04-colony-phase-5a-npcs-design.md`: 181, 198, 216
- `docs/superpowers/specs/2026-07-05-visual-overhaul-doom-design.md`: 84
- `docs/superpowers/specs/2026-07-13-decay-arc-emergent-antagonists-design.md`: 96, 103
- `docs/superpowers/specs/2026-07-13-open-world-colony-design-draft.md`: 48, 82
- `docs/superpowers/specs/2026-07-14-living-galaxy-vision-design.md`: 54, 92, 593, 609
- `docs/superpowers/specs/2026-07-14-region-map-selection-design.md`: 11, 49
- `docs/superpowers/specs/2026-07-15-civilization-frontier-design.md`: 48, 49, 460, 462
- `docs/superpowers/specs/2026-07-19-game-engine-conductor-design.md`: 73, 217, 278, 369
- `game/CLAUDE.md`: 19, 20, 30, 31, 64, 85
- `game/app/components/DevPanel.tsx`: 209, 212, 215, 218
- `game/app/components/Game.tsx`: 84, 86, 1484, 1485, 1486, 1487, 1519, 1520, 1670, 1675, 1676, 1682, 1685, 1769, 1782, 1826, 1831, 1832, 1837, 1840
- `game/app/components/GraphicsPreview.tsx`: 53
- `game/app/components/OpeningScreen.tsx`: 44
- `game/app/components/TouchControls.tsx`: 55, 68, 95, 343, 378
- `game/app/components/colony/exploration/colonyLayout.ts`: 9, 35, 36, 38, 43, 63, 80, 246, 302, 304, 306, 307, 308
- `game/app/components/colony/exploration/npc/colonyNpcs.ts`: 21, 46, 66, 98
- `game/app/components/colony/exploration/npc/npcPathfind.ts`: 1, 6, 18
- `game/app/components/colony/exploration/npc/npcStep.ts`: 5, 15, 22, 62
- `game/app/components/colony/exploration/npc/quartermasterMotion.ts`: 1, 14, 20, 30, 51, 101
- `game/app/components/colony/index.ts`: 54
- `game/app/components/colony/region/poiCatalog.ts`: 5, 10, 14, 21
- `game/app/components/colony/region/poiDispatcher.ts`: 2, 6, 11, 12, 27, 28
- `game/app/components/colony/region/poiRuntime.ts`: 24, 25, 593, 677, 678, 679, 682
- `game/app/components/colony/region/poiTemplates.ts`: 3, 4, 31, 32, 67, 77
- `game/app/components/colony/region/regionMap.ts`: 109
- `game/app/components/colony/shared/colonyTypes.ts`: 71, 72
- `game/app/components/engine/ashfallForwardCamp.ts`: 3, 4, 12, 14, 128
- `game/app/components/engine/boardingEngine.ts`: 1, 3, 4, 54, 55, 287, 288, 324, 325, 354
- `game/app/components/engine/boardingLevel.ts`: 1, 7, 9, 34, 73, 75, 76, 78, 92, 128, 131, 134, 143, 154
- `game/app/components/engine/boardingPhysics.ts`: 1, 3, 6, 14, 20, 77
- `game/app/components/engine/boardingRenderer.ts`: 5, 6, 7, 31, 36, 116, 121, 122, 186, 197, 198, 199, 200, 239, 283, 328, 332
- `game/app/components/engine/firstPersonEngine.ts`: 1, 31, 41, 72, 561, 624
- `game/app/components/engine/fpRender/sceneInput.ts`: 1, 77, 115, 201
- `game/app/components/engine/fpRender/textures.ts`: 173, 175
- `game/app/components/engine/galaxy/galaxyPoiOutcomeAuthority.ts`: 114, 221
- `game/app/components/engine/gameEngine.ts`: 62, 63, 64, 65, 516, 563, 564, 565, 566, 567, 569, 570, 571, 572, 573, 577, 579, 580, 587, 589, 590, 594, 603, 604, 607, 608, 611, 612, 672, 684, 685, 687
- `game/app/components/engine/groundEngine.ts`: 1, 4, 5, 48, 94, 154, 156, 173, 307, 334, 394, 437, 469, 489
- `game/app/components/engine/groundLevel.ts`: 1, 2, 4, 32, 59, 69, 108, 111, 113
- `game/app/components/engine/groundPhysics.ts`: 6
- `game/app/components/engine/groundRenderer.ts`: 5, 7, 14, 16, 25, 26, 65, 132, 136, 137, 138, 139, 242, 254, 255, 256, 257, 264, 266, 268, 272, 331
- `game/app/components/engine/inputIntents.ts`: 29, 30, 57, 58
- `game/app/components/engine/keplerBlackBoxMission.ts`: 2, 35, 43
- `game/app/components/engine/levels.ts`: 1160, 1167, 1170, 1200, 1207, 1210
- `game/app/components/engine/missionContext.ts`: 24, 25, 83, 163, 164, 267, 268, 521, 676, 677
- `game/app/components/engine/operations/operationAdapters.ts`: 811, 1100
- `game/app/components/engine/postFx/presets.ts`: 124, 125
- `game/app/components/engine/renderer.ts`: 29, 30, 91, 97, 98, 99
- `game/app/components/engine/sprites.ts`: 237, 238, 239, 240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 252, 253, 254, 255, 256, 257, 258, 259, 260, 277, 278, 279, 280, 281, 282, 283, 284, 292, 293, 294, 295, 348, 349, 350
- `game/app/components/engine/types.ts`: 554, 555, 556, 557, 717, 775, 792, 795, 803, 805, 809, 827, 831, 848, 849, 852, 1050, 1126
- `game/app/components/engine/worldArt.ts`: 1, 5
- `game/scripts/actors/pack_atlases.py`: 41
- `game/scripts/actors/render_actors.py`: 80, 457, 557
- `game/scripts/sprites/_manifest.json`: 358, 364, 370, 376, 382, 388, 396, 402, 408, 414, 420, 426, 432, 438, 444, 450
- `game/scripts/sprites/sheets.ts`: 32, 33, 34, 78, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93
- `game/tests/browser/graphicsPreview.spec.ts`: 89
- `game/tests/browser/inputIntents.spec.ts`: 42, 75, 104, 134, 156, 157, 166, 218
- `game/tests/browser/quartermasterTrade.spec.ts`: 94
- `game/tests/browser/regionMapPresentation.spec.ts`: 155
- `game/tests/browser/touchGameplay.spec.ts`: 85, 89, 216, 223, 299, 320, 368, 369, 616, 621, 707, 710, 714, 813, 818, 946, 963, 1017
- `game/tests/colony/colonyNpcs.test.ts`: 7, 25
- `game/tests/colony/galaxyRegionAdapter.test.ts`: 12, 14, 274, 275, 297, 298, 299, 300, 303, 304, 653
- `game/tests/colony/npcAnimation.test.ts`: 22, 35, 196
- `game/tests/colony/npcPathfind.test.ts`: 4, 7, 19, 21, 22
- `game/tests/colony/npcStep.test.ts`: 4, 10, 21, 29
- `game/tests/colony/poiDispatcher.test.ts`: 20
- `game/tests/colony/poiTemplates.test.ts`: 3, 4, 5, 9, 20, 21, 22
- `game/tests/colony/regionMapScreen.test.ts`: 46
- `game/tests/engine/actorAssets.test.ts`: 22
- `game/tests/engine/firstPersonEngine.test.ts`: 8, 42
- `game/tests/engine/groundPhysics.test.ts`: 3, 15
- `game/tests/engine/inputIntents.test.ts`: 17, 18, 19, 24, 35, 284, 413, 415, 438, 439, 443, 450, 452, 463, 468, 469, 472, 473, 478, 481, 483, 494, 501, 502, 503, 504, 505, 518, 526, 527, 528, 530, 531, 533, 534, 537, 538, 540, 541, 544, 545, 546, 550, 551, 552, 554, 556, 557, 560, 570, 571, 572, 573, 590
- `game/tests/engine/missionLaunch.test.ts`: 354, 383, 401, 932
- `game/tests/engine/missionOutcome.test.ts`: 3158, 3166, 3167
- `game/tests/engine/renderCore.test.ts`: 12, 13, 371, 372, 381
- `game/tests/engine/weaponMotion.test.ts`: 7, 115
- `game/tests/site/cinematicSite.spec.ts`: 7, 8

Additional relative-path asset registry references found during sprite validation: `game/scripts/sprites/sheets.ts` and generated `game/scripts/sprites/_manifest.json`. Their removed-mode entries are deleted along with the assets.

### Sprite files (usage audit required before deletion)

- `game/public/sprites/ground/tiles.png`
- `game/public/sprites/ground/player-shoot.png`
- `game/public/sprites/ground/enemy-turret.png`
- `game/public/sprites/ground/enemy-patrol.png`
- `game/public/sprites/ground/player-infantry.png`
- `game/public/sprites/ground/enemy-flyer.png`
- `game/public/sprites/ground/player-jump.png`
- `game/public/sprites/ground/bg-surface-near.png`
- `game/public/sprites/ground/enemy-jumper.png`
- `game/public/sprites/ground/player-run-3.png`
- `game/public/sprites/ground/player-run-2.png`
- `game/public/sprites/ground/player-hurt.png`
- `game/public/sprites/ground/bg-surface-mid.png`
- `game/public/sprites/ground/bg-surface-far.png`
- `game/public/sprites/ground/player-run-1.png`
- `game/public/sprites/ground/player-idle.png`
- `game/public/sprites/ground/player-run-4.png`
- `game/public/sprites/boarding/npc-hub-governor.png`
- `game/public/sprites/boarding/enemy-fp-front.png`
- `game/public/sprites/boarding/enemy-fp-flinch.png`
- `game/public/sprites/boarding/npc-scavenger.png`
- `game/public/sprites/boarding/npc-hub-civic-clerk.png`
- `game/public/sprites/boarding/npc-hub-regular.png`
- `game/public/sprites/boarding/player-down.png`
- `game/public/sprites/boarding/npc-hub-arms-dealer.png`
- `game/public/sprites/boarding/npc-reyes.png`
- `game/public/sprites/boarding/npc-hub-bartender.png`
- `game/public/sprites/boarding/npc-quartermaster.png`
- `game/public/sprites/boarding/enemy-grunt-idle.png`
- `game/public/sprites/boarding/npc-hub-signal-chaser.png`
- `game/public/sprites/boarding/player-right.png`
- `game/public/sprites/boarding/npc-hub-provisioner.png`
- `game/public/sprites/boarding/player-up.png`
- `game/public/sprites/boarding/npc-survivor.png`
- `game/public/sprites/boarding/enemy-fp-death.png`
- `game/public/sprites/boarding/gun-sheet.png`
- `game/public/sprites/boarding/npc-hub-contract-broker.png`
- `game/public/sprites/boarding/npc-kael.png`
- `game/public/sprites/boarding/enemy-grunt-attack.png`
- `game/public/sprites/boarding/player-left.png`
- `game/public/sprites/boarding/tiles.png`
- `game/public/sprites/boarding/npc-quartermaster-walk-2.png`
- `game/public/sprites/boarding/npc-voss.png`
- `game/public/sprites/boarding/npc-quartermaster-walk-1.png`

### Dependencies and persistence boundaries

- First-person campaign/dev missions reuse `boardingLevel.ts` and `BoardingMap`/tile types; colony layout also uses those map types. Preserve these shared helpers and their assets.
- `dashboard.ts` has no removed-mode dispatch; `phases.ts` and `phaseTransition.ts` are generic and remain.
- Four campaign phase additions use removed modes (worlds 1, 2, 6, 7 level 3); all have shooter phases to retain.
- Region template ids are persisted identity: keep `boarding-wreck-oathbreaker` and `ground-canyon-glassknife` stable while mapping their engines to first-person.
- Audit `save.ts`, POI pending outcomes, mission context/scene stacks, operations and galaxy checkpoints before tightening validators.
- Generic retrieval start failed with `ValueError: private workspace`; use direct scoped reads. No retrieval success claimed.


## Blockers

- Pre-existing kept-content issue: the Kepler/Cinder map objective is disconnected from the spawn in a walkability flood-fill. Kepler and Cinder remain unchanged per scope. New wreck/canyon first-person variants use reachable tile (12,13); tests verify their objective reachability.

- Shared-helper boundary: first-person missions and colony exploration depend on boarding-named map types, `boardingLevel.ts`, and shared sprites. Retain these dependencies; removing the playable boarding mode does not require deleting them.

## Progress checkpoints

- R2–R5: removed playable mode dispatch, kept shared first-person map helpers, collapsed four affected levels to their existing shooter phase with rewards, remapped wreck/canyon POIs, and added old-save migration fixtures. TypeScript and static build passed; all engine/colony tests passed (sprite registry fixes verified separately).
- R6/R8: 23 unused sprites removed, both sprite registries updated, all 11 sprite checks passed; current developer guides, README and roadmap updated. Browser updates committed; final fixed-snapshot static Playwright run passed all 103 cases with zero retries.
- External router review was rejected by automatic approval: recorded source-disclosure scope covers Cerebro/KB harness, not Sector Zero. Local diff review completed; no external reviewer result claimed.

## Report

Status: R1–R9 complete. Implementation, tests and final report are committed locally on `codex/remove-ground-boarding`. No push, merge or branch switch performed.

| Rung | Claim | Evidence |
|---|---|---|
| VERIFIED | Forty campaign levels retained; four removed-mode phases dropped with names, shooter waves and rewards preserved; turret/FP multi-phase levels retained | `tests/engine/modeRemoval.test.ts` |
| VERIFIED | Wreck and canyon dispatch first-person, retain POI identity and have reachable objectives | `poiTemplates.test.ts`, `galaxyRegionAdapter.test.ts`, `missionLaunch.test.ts` |
| VERIFIED | Old legacy prepared/applied and galaxy v2 outcomes recover with stable outcome ids, unchanged resources, exactly-once delivery; frozen input and corrupt hashes covered | `missionOutcome.test.ts` removed-mode fixtures, four tests |
| VERIFIED | Transient removed-mode state is discarded by existing field-by-field save allowlists without changing either economy or campaign progress | `modeRemoval.test.ts`, three old-shape fixtures |
| VERIFIED | TypeScript and all unit/sprite tests | `npx tsc --noEmit -p .`; 936/936 tests, zero skipped (full colony, engine, sprites suites) |
| RUNS | Production static export with devtools | `NEXT_PUBLIC_DEVTOOLS=1 yarn build`, exit 0 after immutable-input fix; removed sprites absent from export and shared FP sprites retained |
| VERIFIED | Browser specs retain general input ownership coverage using first-person/turret and remove only retired-mode-specific tests | Exact R9 static Playwright command: 103/103 passed, zero retries, exit 0 (8.5 minutes), final production export |
| VERIFIED | Scope boundaries | `Game.tsx` diff only deletes removed-mode imports/branches; protected galaxy file only loses two engine names; no changes to `site/`, `docs/research/`, galaxy UI or colony meta UI |
| WRITTEN | Guides, README, roadmap decision and this report | Current mode descriptions updated; historical design/playtest documents retained |

Verification history: the first full browser pass reported 101/103, with a stale wreck-control expectation and the system-tour aggregate timeout. The wreck expectation was updated to first-person. The system-tour trace showed intact behavior assertions; the single-test timing adjustment is explained below. The final exact-command run passed 103/103 with no retries. Final unit/sprite tests passed 936/936 with none skipped; the final production export and TypeScript check exited successfully.

### Local implementation commits

`git log --oneline 2ef7779..HEAD` before the final report commit:

```text
facb036 test: budget the complete animated system atlas tour
93312d0 test: move retained input and POI browser coverage to first person
c66ef6d fix: migrate immutable legacy POI save snapshots safely
8786319 chore: remove retired mode assets and update gameplay docs
23f11f3 refactor: remove ground and boarding modes with safe POI migration
ece9ff1 docs: inventory ground and boarding removal scope
```

The final documentation commit records this completed report. No remote action is part of this task.

### Changed levels

| Stable id | Stable name | Remaining phase | Preserved reward |
|---|---|---|---|
| 1-3 | Ambush | shooter | kinetic-core |
| 2-3 | Blizzard Run | shooter | energy-cell |
| 6-3 | Memory Shards | shooter | void-fragment |
| 7-3 | The Visions | shooter | hollow-resonance |

No level became empty. Multi-phase chaining stays for 3-3 (turret), 5-3 (first-person), 8-3 (turret).

### Remapped POIs

- `boarding-wreck-oathbreaker`: `boarding` → `firstPerson`, Oathbreaker Wreck (`ashfall-oathbreaker-wreck` on Ashfall).
- `ground-canyon-glassknife`: `groundRun` → `firstPerson`, Glassknife Canyon (`ashfall-glassknife-canyon` on Ashfall).
- These are two shared templates, one of each per generated planet, rather than four distinct templates. All generated instances keep node/template ids, names, reward policy and outcome ids. Station/ruin dressing reuses the existing first-person template. New objectives sit on reachable tile (12,13); original Cinder/Kepler content remains unchanged.

### Save migrations and persistence audit

- `save.ts` remaps only exact old engine/template pairs in legacy prepared envelopes and applied return receipts. Validators still reject malformed authority. Outcome ids, launch ids, mission ids and resource balances stay stable.
- Encoded galaxy preparation facts are hash-checked before changing their engine and recomputing the fact id; causal references are updated. Outcome ids and journal entries are preserved. Valid v2 preparations resume and deliver once. Older v1 authority keeps the existing reconciliation safeguards; it is never treated as a new reward grant.
- Campaign persistence stores world and completed level records, not active phase indices. Keeping all ids avoids campaign-position migration.
- Pending gameplay sessions, active combat phases, scene stacks and native engine checkpoints are runtime-only. Old-shaped extra fields are dropped on reload. Galaxy operations retain state/cycle/completion records, and travel checkpoints retain route progress; neither has a supported persisted removed-mode engine field.
- Migration leaves the input snapshot untouched, works with frozen inputs, and is idempotent in the old-shape tests.

### Browser-spec decisions

- `inputIntents.spec.ts`: retained alias, blur/pause, visibility/transition and touch-vs-keyboard ownership checks, now exercised in first-person. Deleted only the obsolete Space-jump expectation. Added absent DevPanel shortcut assertions.
- `touchGameplay.spec.ts`: deleted ground/boarding profile cases, their engine-only projectile observation fixtures, and their gameplay cases; kept shooter/FP/colony/turret coverage. Moved lifecycle and visible-button keyboard/mouse checks to first-person/turret.
- `regionMapPresentation.spec.ts`: wreck launch now expects first-person controls; fog assertions still protect undisclosed site information.
- `groundPhysics.test.ts`: deleted because its engine/physics were removed. Shared tests now use first-person/shooter fixtures.
- `systemAtlas.spec.ts`: the existing multi-step pointer tour exceeded its 30-second total budget even when every behavior assertion passed. Trace review and an unchanged-assertion diagnostic run verified this; this single test now has a 60-second total budget. Individual expectation limits and application/UI code remain unchanged. This is a test timing adjustment, not a UI performance fix.
- `tests/site/cinematicSite.spec.ts`: untouched, because companion-site content is explicitly outside scope.

### Removed files

- `game/app/components/engine/boardingEngine.ts`
- `game/app/components/engine/boardingPhysics.ts`
- `game/app/components/engine/boardingRenderer.ts`
- `game/app/components/engine/groundEngine.ts`
- `game/app/components/engine/groundLevel.ts`
- `game/app/components/engine/groundPhysics.ts`
- `game/app/components/engine/groundRenderer.ts`
- `game/public/sprites/boarding/enemy-grunt-attack.png`
- `game/public/sprites/boarding/enemy-grunt-idle.png`
- `game/public/sprites/boarding/player-down.png`
- `game/public/sprites/boarding/player-left.png`
- `game/public/sprites/boarding/player-right.png`
- `game/public/sprites/boarding/player-up.png`
- `game/public/sprites/ground/bg-surface-far.png`
- `game/public/sprites/ground/bg-surface-mid.png`
- `game/public/sprites/ground/bg-surface-near.png`
- `game/public/sprites/ground/enemy-flyer.png`
- `game/public/sprites/ground/enemy-jumper.png`
- `game/public/sprites/ground/enemy-patrol.png`
- `game/public/sprites/ground/enemy-turret.png`
- `game/public/sprites/ground/player-hurt.png`
- `game/public/sprites/ground/player-idle.png`
- `game/public/sprites/ground/player-infantry.png`
- `game/public/sprites/ground/player-jump.png`
- `game/public/sprites/ground/player-run-1.png`
- `game/public/sprites/ground/player-run-2.png`
- `game/public/sprites/ground/player-run-3.png`
- `game/public/sprites/ground/player-run-4.png`
- `game/public/sprites/ground/player-shoot.png`
- `game/public/sprites/ground/tiles.png`
- `game/tests/engine/groundPhysics.test.ts`

### Remaining intentional grep matches

Command: `grep -rn "ground-run\|groundState\|boarding" game/app game/tests`.
46 matches, each listed below. Categories: shared first-person interior helper/local variable; retained shared sprite paths; stable POI template ids; explicit old-save/negative fixtures; untouched companion-site specs. Capitalized `BoardingMap`/tile/helper types also remain because first-person and colony code depend on them. Legacy `Keys.jump` remains an inert structural field with no input intent or control binding.

```text
game/app/components/Game.tsx:85:import { createBoardingState } from "./engine/boardingLevel";
game/app/components/Game.tsx:1750:        // Create enemies from boarding state positions (convert pixel → tile coords)
game/app/components/colony/region/poiDispatcher.ts:25:  if (node.templateId === "boarding-wreck-oathbreaker") return { ok: true, session: { nodeId: node.id, engine: "firstPerson", state: createFirstPersonWreckTemplate(node.seed), rewardEligible } };
game/app/components/colony/region/regionMap.ts:109:    node(planetId, seed, "oathbreaker-wreck", "Oathbreaker Wreck", "wreck", "rumored", 73, 61, "boarding-wreck-oathbreaker"),
game/app/components/colony/region/poiCatalog.ts:5:  "boarding-wreck-oathbreaker",
game/app/components/colony/region/poiCatalog.ts:14:    || (node.type === "wreck" && node.templateId === "boarding-wreck-oathbreaker")
game/app/components/engine/sprites.ts:237:  BOARDING_TILES: "/sprites/boarding/tiles.png",
game/app/components/engine/sprites.ts:238:  FP_GUN_SHEET: "/sprites/boarding/gun-sheet.png",
game/app/components/engine/sprites.ts:255:  NPC_VOSS: "/sprites/boarding/npc-voss.png",
game/app/components/engine/sprites.ts:256:  NPC_KAEL: "/sprites/boarding/npc-kael.png",
game/app/components/engine/sprites.ts:257:  NPC_REYES: "/sprites/boarding/npc-reyes.png",
game/app/components/engine/sprites.ts:258:  NPC_SURVIVOR: "/sprites/boarding/npc-survivor.png",
game/app/components/engine/sprites.ts:259:  NPC_SCAVENGER: "/sprites/boarding/npc-scavenger.png",
game/app/components/engine/sprites.ts:260:  NPC_QUARTERMASTER: "/sprites/boarding/npc-quartermaster.png",
game/app/components/engine/sprites.ts:261:  NPC_QUARTERMASTER_WALK_1: "/sprites/boarding/npc-quartermaster-walk-1.png",
game/app/components/engine/sprites.ts:262:  NPC_QUARTERMASTER_WALK_2: "/sprites/boarding/npc-quartermaster-walk-2.png",
game/app/components/engine/sprites.ts:270:  FP_ENEMY_FRONT: "/sprites/boarding/enemy-fp-front.png",
game/app/components/engine/sprites.ts:271:  FP_ENEMY_FLINCH: "/sprites/boarding/enemy-fp-flinch.png",
game/app/components/engine/sprites.ts:272:  FP_ENEMY_DEATH: "/sprites/boarding/enemy-fp-death.png",
game/app/components/engine/sprites.ts:325:  NPC_HUB_BARTENDER: "/sprites/boarding/npc-hub-bartender.png",
game/app/components/engine/sprites.ts:326:  NPC_HUB_REGULAR: "/sprites/boarding/npc-hub-regular.png",
game/app/components/engine/sprites.ts:327:  NPC_HUB_SIGNAL_CHASER: "/sprites/boarding/npc-hub-signal-chaser.png",
game/app/components/engine/missionContext.ts:159:const POI_TEMPLATES = ["fp-ruin-cinder-relay", "boarding-wreck-oathbreaker", "ground-canyon-glassknife"];
game/app/components/engine/gameEngine.ts:62:import { createBoardingState } from "./boardingLevel";
game/app/components/engine/gameEngine.ts:561:      const boardingState = createBoardingState();
game/app/components/engine/gameEngine.ts:563:        map: boardingState.map,
game/app/components/engine/gameEngine.ts:564:        ...createCombatDressing(boardingState.map, "station"),
game/app/components/engine/gameEngine.ts:571:        enemies: boardingState.enemies.map((e, i) => ({
game/app/components/engine/gameEngine.ts:573:          x: e.x / boardingState.map.tileSize + 0.5,
game/app/components/engine/gameEngine.ts:574:          y: e.y / boardingState.map.tileSize + 0.5,
game/app/components/engine/gameEngine.ts:578:          aggroRange: e.aggroRange / boardingState.map.tileSize,
game/app/components/engine/save.ts:643:  return (engine === "boarding" && template === "boarding-wreck-oathbreaker") ||
game/tests/colony/galaxyRegionAdapter.test.ts:643:      payload[5] = "boarding";
game/tests/colony/npcAnimation.test.ts:196:  assert.equal(SPRITES.NPC_QUARTERMASTER, "/sprites/boarding/npc-quartermaster.png");
game/tests/browser/touchGameplay.spec.ts:74:        else if (src.endsWith("/boarding/gun-sheet.png")) pending.gun ||= args[0] > 0;
game/tests/browser/inputIntents.spec.ts:33:      if (active(this) && source instanceof HTMLImageElement && source.src.endsWith("/boarding/gun-sheet.png")) gun ||= args[0] > 0;
game/tests/browser/graphicsPreview.spec.ts:89:      if (source instanceof HTMLImageElement && /\/boarding\/npc-(voss|kael|reyes)\.png/.test(source.src)) {
game/tests/browser/quartermasterTrade.spec.ts:94:        if (active(this) && source.src.includes("/boarding/gun-sheet.png")) gun = { x: args[4], y: args[5] };
game/tests/site/cinematicSite.spec.ts:7:  "ground-run-and-gun",
game/tests/site/cinematicSite.spec.ts:8:  "ship-boarding",
game/tests/engine/modeRemoval.test.ts:23:for (const engine of ["boarding", "groundRun", "ground-run"] as const) {
game/tests/engine/modeRemoval.test.ts:27:    const transient = { engine, currentMode: engine, currentPhase: 1, groundState: {}, boardingState: {} };
game/tests/engine/missionOutcome.test.ts:3158:  const descriptor = poiMissionDescriptor("ashfall-oathbreaker-wreck", "firstPerson", "boarding-wreck-oathbreaker");
game/tests/engine/missionOutcome.test.ts:3167:      templateId: "boarding-wreck-oathbreaker",
game/tests/engine/missionOutcome.test.ts:3202:  ["boarding", "ashfall-oathbreaker-wreck", "boarding-wreck-oathbreaker"],
game/tests/engine/actorAssets.test.ts:22:  for (const set of ["hub-bartender", "hub-regular", "hub-signal-chaser", "quartermaster"] as const) assert.equal(resolveNpcActorSet({ name: "ignored", sprite: `/sprites/boarding/npc-${set}.png` }), set);
```

### Blockers and next owner

- No removal implementation blocker. Shared boarding-named helpers/assets are intentional keep dependencies, not playable mode support.
- Existing Kepler/Cinder objective reachability issue remains out of scope. Owner: Colony coordinator/Nic; separate completion condition is a reachable objective plus a native first-person completion playtest.
- External independent review was rejected by automatic approval because the authorized source-disclosure scope did not cover Sector Zero. No external review was performed; local diff review, strict migration tests and runtime checks are the available evidence.
- Generic retrieval start and assessment were unavailable (`ValueError: private workspace`); direct worktree reads supplied the source evidence, and no retrieval success is claimed.
- No required cleanup implementation or verification work remains. Cleanup completion condition: R1–R9 checked, final export and all tests passing, report committed, and worktree clean.
- Integration with the parallel Colony branch is outside this task. Owner: Colony coordinator; review these local commits and resolve any integration conflicts before accepting that combined branch. No push, merge or branch switch performed here.

Residual risk: the kept Kepler/Cinder objective layout is still disconnected, and integration with the parallel Colony branch has not been exercised.

# Quartermaster pilot runtime receipt — 2026-09-06

Branch: `codex/quartermaster-motion-pilot`, based on `ab9ed79`. This is an isolated pilot, not a deployment or merge. The CPU raycaster, existing scene lighting and browser delivery remain the graphics foundation.

## Delivered

- Quartermaster uses eight directional views and idle/walk/handheld-inventory clips (160 Blender-rendered cells). Static original sprites remain the loading/failure fallback. Other NPC art and behavior remain on their prior paths.
- The quartermaster works, rests, turns, takes a one-tile inspection walk and returns. Fixed 120 Hz substeps preserve the routine across display frame rates; traveled distance drives the walk clip. Dialogue freezes player, character and weapon presentation.
- A separate worn supply console sits at the daytime post. It is decorative, adds no collision, and preserves the shop/door/pad contracts.
- Weapon bob follows actual collision-resolved player travel, settles at rest and uses the existing shot timer for recoil.
- `/quartermaster-pilot/` uses the real colony engine with a private fixture. It never reads or writes the campaign save. The initial camera shows the routine; four close inspection views, pause, night tint and movement controls are available.

## Verification

| Check | Result |
|---|---|
| Original engine + colony baseline | 820 passed |
| Final engine + colony suite | 850 passed |
| Sprite suite, including decoding every authored cell | 9 passed |
| Preview browser tests | 2 passed; cardinal atlas rows, work/walk transitions, no save write/page error, original texture alpha decoded when pilot requests fail |
| Actual colony trade browser test | 1 passed; keyboard entry and approach, 14 work-atlas crops, frozen actor/player/weapon during dialogue, one Hull Repair Kit purchase writes 300 credits to zero once, reload preserves purchase |
| Independent reviews | Timing/fallback findings fixed; fresh final review found no consequential defect |
| Static export | `NEXT_PUBLIC_BASE_PATH=/sector-zero corepack yarn build` passed, including lint/typecheck; pilot route statically generated |
| Production browser inspection | Images load under `/sector-zero/`; front, both sides, back, day/night and motion inspected through the actual UI |

`runtime-evidence/` retains browser purchase screenshots, a route receipt and test/build logs. `asset-verification.json` contains image dimensions, byte counts, hashes, alpha bounds and Blender-source checks. `direction-contact-sheet.png`, `walk-inspection.gif` and `work-inspection.gif` show the source renders.

## Size and observed cost

The three atlases and workstation total **3,989,337 bytes (3.80 MiB)**, loaded only when entering a colony or this preview. Atlas decoding is bounded to 160 cells (20 MiB of RGBA texels at full coverage, excluding browser image objects and existing assets). The pilot preview adds 6.9 kB of route JavaScript; its total first-load JavaScript in the production build is 245 kB.

The production preview's rolling median **scene-render** time was approximately **3.1–3.8 ms** during desktop inspection on this machine, with the established rendering resolution of 480x714 plus the existing HUD. This is not whole-frame time, a mobile benchmark or a cross-device 60-fps guarantee. The earlier original-art fallback was around 3.0 ms in the same preview; these observations are not a controlled benchmark.

## Art assessment and next decision

The worn brown/gunmetal palette and cyan scanner fit the current scene, and directional body movement is now reproducible from one editable source. The front recovers some hero detail through reference projection; anatomy and side/back surfaces remain simpler than the original hero. Night tint keeps a readable silhouette but hides fine dark material detail. Inspect the playable pilot before propagating this model quality to the full cast.

The recommended next art pass is the same pipeline with better garment folds, accessory shaping and authored side/back textures, followed by one reusable industrial building kit. This pilot does not need an engine migration to improve further.

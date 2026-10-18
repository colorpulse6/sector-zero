# Ashfall boards — provenance and honest labels

All three images are built from files already in this repository by `build-boards.sh`
(ImageMagick 7, already installed; no downloads, no generation, no paid tools). Building and
inspecting them is a direct file check, not gameplay evidence.

| File | What it is | What it is not |
| --- | --- | --- |
| `reference-board.png` (1824×2180) | Contact sheet: four baseline captures (2026-09-06 graphics rollout), the live exterior kit, the live cast, reviewed-but-unregistered hub art, two rejected legacy props, and a palette whose surface values are the measured mean colour of each live asset | Not a mockup of the proposed result; nothing is rendered or generated |
| `baseline-annotated.png` (850×1632) | `docs/assets/graphics-rollout/screenshots/scene-colony.png` at 2× with callouts. Cyan boxes mark what exists; amber dashed boxes mark proposed placements | The amber boxes are positions, not art |
| `candidates/quartermaster-portrait-candidate.png` (512×512) | Square crop of `docs/assets/pilot/quartermaster-hero-v1.png` (approved pilot source) with the flat-green backdrop keyed to `#121720` | Not registered, not in `game/public`; has a green fringe at hair and shoulder edges that needs cleanup before any registration |

Rebuild: `bash docs/ashfall/boards/build-boards.sh` from any directory.

Measured palette method: `magick <asset> -resize 1x1! -depth 8 txt:-` (mean colour); the sky
zenith and horizon values use a 200 px band from the top and bottom of the panorama.

## Caption key for `reference-board.png`

Tile captions are short two-line display labels so they fit under each tile. This table gives
the full file for every caption. Sprite paths are under `game/public/sprites/`; captures are
under `docs/assets/`.

| Caption | File | Registered key on `30b0726` |
| --- | --- | --- |
| A: colony exterior, QM + station | `docs/assets/graphics-rollout/screenshots/scene-colony.png` | capture |
| A: legacy forward camp | `docs/assets/graphics-rollout/screenshots/scene-ashfall.png` | capture |
| A: habitat module interior | `docs/assets/graphics-rollout/screenshots/scene-habitat_module.png` | capture |
| A: cantina interior, night | `docs/assets/graphics-rollout/screenshots/scene-cantina.png` | capture |
| B-1 outpost sky | `explore/scrapyard-outpost-sky.png` (1774×887; shown resized) | `EXPLORE_OUTPOST_SKY` |
| B-2 outpost ground | `explore/scrapyard-outpost-ground.png` | `EXPLORE_OUTPOST_GROUND` |
| B-3 outpost wall ext | `explore/scrapyard-outpost-wall-exterior.png` | `EXPLORE_OUTPOST_WALL_EXTERIOR` |
| B-4 landing pad | `environment/landing-pad.png` | `COLONY_LANDING_PAD` |
| B-5 foundation | `environment/foundation.png` | `COLONY_FOUNDATION` |
| B-6 scaffolding | `props/scaffolding.png` | `COLONY_SCAFFOLDING` |
| B-7 wall habitat | `walls/habitat.png` | `COLONY_WALL_HABITAT` |
| B-8 wall solar | `walls/solar.png` | `COLONY_WALL_SOLAR` |
| B-9 wall mine | `walls/mine.png` | `COLONY_WALL_MINE` |
| B-10 QM workstation | `pilot/quartermaster/workstation.png` | `QUARTERMASTER_WORKSTATION` |
| C-1 QM idle, cell 0 | `pilot/quartermaster/idle.png` (first 128×256 cell of the atlas) | `actorAssets.ts` quartermaster `idle` (actor atlas, not a `sprites.ts` key) |
| C-2 QM work, cell 0 | `pilot/quartermaster/work.png` (first 128×256 cell of the atlas) | `actorAssets.ts` quartermaster `work` (actor atlas, not a `sprites.ts` key) |
| C-3 NPC Voss | `boarding/npc-voss.png` | `NPC_VOSS` (used as the Overseer today) |
| C-4 NPC survivor | `boarding/npc-survivor.png` | `NPC_SURVIVOR` |
| C-5 NPC scavenger | `boarding/npc-scavenger.png` | `NPC_SCAVENGER` |
| C-6 portrait Voss | `portraits/voss.png` | `PORTRAIT_VOSS` |
| C-7 portrait hub bartender | `portraits/hub-bartender.png` | `PORTRAIT_HUB_BARTENDER` |
| D-1 NPC hub governor | `boarding/npc-hub-governor.png` | none (Kit B1 candidate) |
| D-2 portrait governor | `portraits/hub-governor.png` | none (Kit B2 candidate) |
| D-3 NPC provisioner | `boarding/npc-hub-provisioner.png` | none (later) |
| D-4 portrait provisioner | `portraits/hub-provisioner.png` | none (later) |
| D-5 m3 marketplace wall | `interiors/m3/marketplace/wall.png` | none (salvage branch `289f4eb`) |
| D-6 m3 vendor counter | `interiors/m3/marketplace/vendor-counter.png` | none (salvage branch) |
| D-7 m3 trade terminal | `interiors/m3/marketplace/trade-terminal.png` | none (salvage branch) |
| D-8 m3 holo atlas | `interiors/m3/town-hall/holo-atlas.png` | none (salvage branch) |
| D-9 m3 petition terminal | `interiors/m3/town-hall/petition-terminal.png` | none (salvage branch) |
| D-10 town hall facade | `walls/town-hall.png` (64×64) | none |
| D-11 prop antenna | `explore/scrapyard-outpost-prop-antenna.png` | `EXPLORE_OUTPOST_PROP_ANTENNA`; rejected: white halo |
| D-12 landmark rig | `explore/scrapyard-outpost-landmark-rig.png` | `EXPLORE_OUTPOST_LANDMARK_RIG`; rejected: baked text |
| E swatches | generated flat colour; surface values measured from the B-row assets, emissives from `docs/assets/prompts/doom/00-master-style-guide.md` and `colonyLayout.ts` | — |

Key names in the last column are as read in `sprites.ts` and `actorAssets.ts` on `30b0726`
(SOURCE-REVIEWED); the two rejected props are still referenced by the legacy forward camp.

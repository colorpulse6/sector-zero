# Ashfall boards — provenance and honest labels

All three images are built from files already in this repository by `build-boards.sh`
(ImageMagick 7, already installed; no downloads, no generation, no paid tools).

| File | What it is | What it is not |
| --- | --- | --- |
| `reference-board.png` | Contact sheet: four baseline captures (2026-09-06 graphics rollout), the live exterior kit, the live cast, reviewed-but-unregistered hub art, two rejected legacy props, and a palette whose surface values are the measured mean colour of each live asset | Not a mockup of the proposed result; nothing is rendered or generated |
| `baseline-annotated.png` | `docs/assets/graphics-rollout/screenshots/scene-colony.png` at 2× with callouts. Cyan boxes mark what exists; amber dashed boxes mark proposed placements | The amber boxes are positions, not art |
| `candidates/quartermaster-portrait-candidate.png` | 512×512 square crop of `docs/assets/pilot/quartermaster-hero-v1.png` (approved pilot source) with the flat-green backdrop keyed to `#121720` | Not registered, not in `game/public`; has a green fringe at hair and shoulder edges that needs cleanup before any registration |

Rebuild: `bash docs/ashfall/boards/build-boards.sh` from any directory.

Measured palette method: `magick <asset> -resize 1x1! -depth 8 txt:-` (mean colour); the sky
zenith and horizon values use a 200 px band from the top and bottom of the panorama.

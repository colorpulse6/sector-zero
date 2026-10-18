#!/usr/bin/env bash
# Builds the Ashfall reference boards from assets already in the repository.
# Requires ImageMagick 7 (`magick`). No generation, no downloads, no installs.
# Outputs (all in docs/ashfall/boards/):
#   reference-board.png      contact sheet of existing runtime art + measured palette
#   baseline-annotated.png   the 2026-09-06 baseline colony capture with proposal callouts
#   candidates/quartermaster-portrait-candidate.png  512x512 derivative of the approved pilot hero
# Tile captions are short two-line display labels; the label -> file table is in README.md.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
S="$ROOT/game/public/sprites"
D="$ROOT/docs/assets"
OUT="$ROOT/docs/ashfall/boards"
BG='#0a0e17'; FG='#e0e6ed'; MUTED='#7f8a94'; CYAN='#00f0ff'; AMBER='#ffb066'
FONT=Helvetica
W=1800   # board content width; every row fits inside it
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

row_title() { # $1 out, $2 text (wraps if longer than the board)
  magick -background "$BG" -fill "$CYAN" -font "$FONT" -pointsize 18 -size "${W}x" -gravity west caption:"  $2" "$1"
}
sheet() { # $1 out, $2 tile geometry, $3 tiles, then label/file pairs; labels may contain \n
  local out="$1" geom="$2" tile="$3"; shift 3
  local args=()
  while (( $# )); do args+=( -label "$1" "$2" ); shift 2; done
  magick montage "${args[@]}" -tile "$tile" -geometry "$geom" -background "$BG" -fill "$FG" -font "$FONT" -pointsize 13 "$out"
}

# Row A: baseline captures (graphics-rollout 2026-09-06, 415x738 each, unmodified apart from scaling)
row_title "$TMP/tA.png" "A. BASELINE CAPTURES (2026-09-06 graphics rollout) - current art, not the proposal"
sheet "$TMP/rA.png" 230x410+60+8 4x1 \
  'colony exterior\nQM + station' "$D/graphics-rollout/screenshots/scene-colony.png" \
  'legacy forward camp\n(Ashfall scene)' "$D/graphics-rollout/screenshots/scene-ashfall.png" \
  'habitat module\ninterior' "$D/graphics-rollout/screenshots/scene-habitat_module.png" \
  'cantina interior\nnight' "$D/graphics-rollout/screenshots/scene-cantina.png"

# Row B: exterior kit live in the colony exterior today (two rows of five)
row_title "$TMP/tB.png" "B. ASHFALL EXTERIOR KIT - live in generateExteriorState / BUILDING_FOOTPRINTS today (reuse as-is)"
magick "$S/explore/scrapyard-outpost-sky.png" -resize 560x280 "$TMP/sky.png"
sheet "$TMP/rB.png" 200x200+30+8 5x2 \
  'B-1 outpost sky\n1774x887' "$TMP/sky.png" \
  'B-2 outpost ground\n1254x1254' "$S/explore/scrapyard-outpost-ground.png" \
  'B-3 outpost wall ext\n1024x1024' "$S/explore/scrapyard-outpost-wall-exterior.png" \
  'B-4 landing pad\n512x512' "$S/environment/landing-pad.png" \
  'B-5 foundation\n512x512' "$S/environment/foundation.png" \
  'B-6 scaffolding\n512x512 RGBA' "$S/props/scaffolding.png" \
  'B-7 wall habitat\n512x512' "$S/walls/habitat.png" \
  'B-8 wall solar\n512x512' "$S/walls/solar.png" \
  'B-9 wall mine\n512x512' "$S/walls/mine.png" \
  'B-10 QM workstation\n512x512' "$S/pilot/quartermaster/workstation.png"

# Row C: cast live today (atlas cell 0 = facing the viewer)
row_title "$TMP/tC.png" "C. CAST LIVE TODAY - quartermaster (approved pilot atlas), Voss billboard used as the Overseer, colonists, Voss portrait"
magick "$S/pilot/quartermaster/idle.png" -crop 128x256+0+0 +repage "$TMP/qm-idle0.png"
magick "$S/pilot/quartermaster/work.png" -crop 128x256+0+0 +repage "$TMP/qm-work0.png"
sheet "$TMP/rC.png" 150x256+50+8 7x1 \
  'C-1 QM idle, cell 0\n128x256' "$TMP/qm-idle0.png" \
  'C-2 QM work, cell 0\n128x256' "$TMP/qm-work0.png" \
  'C-3 NPC Voss\nOverseer today' "$S/boarding/npc-voss.png" \
  'C-4 NPC survivor\n128x256' "$S/boarding/npc-survivor.png" \
  'C-5 NPC scavenger\n128x256' "$S/boarding/npc-scavenger.png" \
  'C-6 portrait Voss\n1024x1024' "$S/portraits/voss.png" \
  'C-7 portrait\nhub bartender' "$S/portraits/hub-bartender.png"

# Row D: reviewed art on disk with no runtime consumer (candidates), plus two legacy props flagged (two rows of six)
row_title "$TMP/tD.png" "D. ON DISK, REVIEWED, UNREGISTERED (candidates) - last two: legacy props flagged as not acceptable"
sheet "$TMP/rD.png" 150x256+50+8 6x2 \
  'D-1 NPC hub governor\nOverseer candidate' "$S/boarding/npc-hub-governor.png" \
  'D-2 portrait governor\nOverseer candidate' "$S/portraits/hub-governor.png" \
  'D-3 NPC provisioner\nlater' "$S/boarding/npc-hub-provisioner.png" \
  'D-4 portrait provisioner\nlater' "$S/portraits/hub-provisioner.png" \
  'D-5 m3 marketplace wall\nlater' "$S/interiors/m3/marketplace/wall.png" \
  'D-6 m3 vendor counter\nlater' "$S/interiors/m3/marketplace/vendor-counter.png" \
  'D-7 m3 trade terminal\nlater' "$S/interiors/m3/marketplace/trade-terminal.png" \
  'D-8 m3 holo atlas\nlater' "$S/interiors/m3/town-hall/holo-atlas.png" \
  'D-9 m3 petition terminal\nlater' "$S/interiors/m3/town-hall/petition-terminal.png" \
  'D-10 town hall facade\n64x64' "$S/walls/town-hall.png" \
  'D-11 prop antenna\nhalo, rejected' "$S/explore/scrapyard-outpost-prop-antenna.png" \
  'D-12 landmark rig\ndefective' "$S/explore/scrapyard-outpost-landmark-rig.png"

# Row E: palette. Surface values are measured means of the live assets (magick -resize 1x1); emissives come from the master style guide and existing code.
row_title "$TMP/tE.png" "E. ASHFALL PALETTE - surfaces measured from live assets (mean colour); emissive accents from the master guide and existing code"
sw() { magick -size 120x70 xc:"$2" "$TMP/sw-$1.png"; echo "$TMP/sw-$1.png"; }
sheet "$TMP/rE.png" 120x70+15+8 12x1 \
  'sky mean\n#503021' "$(sw 1 '#503021')" \
  'sky horizon\n#7B472C' "$(sw 2 '#7B472C')" \
  'sky zenith\n#2D1F19' "$(sw 3 '#2D1F19')" \
  'ground\n#553C2D' "$(sw 4 '#553C2D')" \
  'frame wall\n#795E4B' "$(sw 5 '#795E4B')" \
  'landing pad\n#4F5358' "$(sw 6 '#4F5358')" \
  'foundation\n#615E5C' "$(sw 7 '#615E5C')" \
  'habitat facade\n#4A4743' "$(sw 8 '#4A4743')" \
  'porch (code)\n#ffb066' "$(sw 9 '#ffb066')" \
  'scaffold (code)\n#9fd0ff' "$(sw 10 '#9fd0ff')" \
  'ember / mast\n#d1341a' "$(sw 11 '#d1341a')" \
  'tech cyan\n#00f0ff' "$(sw 12 '#00f0ff')"

magick -background "$BG" -fill "$FG" -font "$FONT" -pointsize 26 -size "${W}x" -gravity west caption:"  ASHFALL PRIMARY - REFERENCE BOARD (2026-10-18, design/ashfall-lock)" "$TMP/h1.png"
magick -background "$BG" -fill "$MUTED" -font "$FONT" -pointsize 14 -size "${W}x" -gravity west caption:"  Contact sheet of EXISTING repository art only. Nothing here is generated or a render of the proposal. Built by docs/ashfall/boards/build-boards.sh. Captions are display labels; full filenames are in docs/ashfall/boards/README.md." "$TMP/h2.png"
magick "$TMP/h1.png" "$TMP/h2.png" "$TMP/tA.png" "$TMP/rA.png" "$TMP/tB.png" "$TMP/rB.png" "$TMP/tC.png" "$TMP/rC.png" "$TMP/tD.png" "$TMP/rD.png" "$TMP/tE.png" "$TMP/rE.png" \
  -background "$BG" -gravity west -append -bordercolor "$BG" -border 12 "$OUT/reference-board.png"

# Annotated baseline capture: proposal callouts over the real 2026-09-06 capture (2x nearest-neighbour scale).
magick "$D/graphics-rollout/screenshots/scene-colony.png" -filter point -resize 200% \
  -font "$FONT" -pointsize 22 -strokewidth 3 \
  -stroke "$CYAN" -fill none -draw "rectangle 180,540 370,740" -draw "rectangle 0,760 830,1230" -draw "rectangle 0,560 140,700" -draw "rectangle 690,560 830,700" \
  -stroke "$AMBER" -draw "stroke-dasharray 10 8 rectangle 360,420 470,590" -draw "stroke-dasharray 10 8 rectangle 300,580 520,620" \
  -stroke none -fill "$CYAN" -annotate +186+532 "A" -annotate +8+1250 "B" -annotate +6+552 "C" -annotate +696+552 "C" \
  -fill "$AMBER" -annotate +366+412 "E" -annotate +306+572 "F" \
  "$TMP/annot.png"
# caption: wraps long lines inside the 830 px width instead of clipping them
magick -background "$BG" -fill "$FG" -font "$FONT" -pointsize 15 -size 810x -gravity west \
  caption:"ANNOTATED BASELINE CAPTURE - scene-colony.png (2026-09-06 graphics rollout, 415x738, shown at 2x)
Cyan = exists today.  Amber dashed = PROPOSED placement, not rendered.
A  Quartermaster + SUPPLY STATION prop at the pad stall (exists; approved pilot asset)
B  Landing pad tile (exists; COLONY_LANDING_PAD)
C  Perimeter frame wall (exists; EXPLORE_OUTPOST_WALL_EXTERIOR); Ashfall variant deferred
E  Relay Mast landmark at tile (10,6), north of the plaza, on the pad-stall-plaza axis (PROPOSED new billboard, lit/dark)
F  Overseer post at plaza centre (10,11) - exists; new identity PROPOSED (hub-governor pair)
Sky, ground, quartermaster atlas and HUD are unchanged by this packet." "$TMP/legend.png"
magick "$TMP/annot.png" "$TMP/legend.png" -background "$BG" -gravity west -append -bordercolor "$BG" -border 10 "$OUT/baseline-annotated.png"

# Candidate quartermaster portrait: square crop of the approved pilot hero source, green keyed to the HUD deep tone.
magick "$D/pilot/quartermaster-hero-v1.png" -crop 640x640+192+0 +repage -fuzz 18% -fill '#121720' -opaque '#00FF00' -resize 512x512 "$OUT/candidates/quartermaster-portrait-candidate.png"

echo "built: $OUT/reference-board.png $OUT/baseline-annotated.png $OUT/candidates/quartermaster-portrait-candidate.png"

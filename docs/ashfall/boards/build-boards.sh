#!/usr/bin/env bash
# Builds the Ashfall reference boards from assets already in the repository.
# Requires ImageMagick 7 (`magick`). No generation, no downloads, no installs.
# Outputs (all in docs/ashfall/boards/):
#   reference-board.png      contact sheet of existing runtime art + measured palette
#   baseline-annotated.png   the 2026-09-06 baseline colony capture with proposal callouts
#   candidates/quartermaster-portrait-candidate.png  512x512 derivative of the approved pilot hero
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
S="$ROOT/game/public/sprites"
D="$ROOT/docs/assets"
OUT="$ROOT/docs/ashfall/boards"
BG='#0a0e17'; FG='#e0e6ed'; MUTED='#7f8a94'; CYAN='#00f0ff'; AMBER='#ffb066'
FONT=Helvetica
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

row_title() { # $1 out, $2 text
  magick -background "$BG" -fill "$CYAN" -font "$FONT" -pointsize 18 -size 1900x34 -gravity west label:"  $2" "$1"
}
sheet() { # $1 out, $2 tile geometry, $3 tiles, then label/file pairs
  local out="$1" geom="$2" tile="$3"; shift 3
  local args=()
  while (( $# )); do args+=( -label "$1" "$2" ); shift 2; done
  magick montage "${args[@]}" -tile "$tile" -geometry "$geom" -background "$BG" -fill "$FG" -font "$FONT" -pointsize 12 "$out"
}

# Row A: baseline captures (graphics-rollout 2026-09-06, 415x738 each, unmodified apart from scaling)
row_title "$TMP/tA.png" "A. BASELINE CAPTURES (docs/assets/graphics-rollout/screenshots, 2026-09-06) - current art, not the proposal"
sheet "$TMP/rA.png" 230x410+60+8 4x1 \
  "scene-colony: exterior, QM + station" "$D/graphics-rollout/screenshots/scene-colony.png" \
  "scene-ashfall: legacy forward camp" "$D/graphics-rollout/screenshots/scene-ashfall.png" \
  "scene-habitat_module: interior" "$D/graphics-rollout/screenshots/scene-habitat_module.png" \
  "scene-cantina: interior, night" "$D/graphics-rollout/screenshots/scene-cantina.png"

# Row B: exterior kit live in the colony exterior today
row_title "$TMP/tB.png" "B. ASHFALL EXTERIOR KIT - live in generateExteriorState / BUILDING_FOOTPRINTS today (reuse as-is)"
magick "$S/explore/scrapyard-outpost-sky.png" -resize 560x280 "$TMP/sky.png"
sheet "$TMP/rB.png" 190x190+14+8 10x1 \
  "OUTPOST_SKY 1774x887" "$TMP/sky.png" \
  "OUTPOST_GROUND 1254^2" "$S/explore/scrapyard-outpost-ground.png" \
  "OUTPOST_WALL_EXT 1024^2" "$S/explore/scrapyard-outpost-wall-exterior.png" \
  "COLONY_LANDING_PAD 512^2" "$S/environment/landing-pad.png" \
  "COLONY_FOUNDATION 512^2" "$S/environment/foundation.png" \
  "COLONY_SCAFFOLDING 512^2 RGBA" "$S/props/scaffolding.png" \
  "COLONY_WALL_HABITAT 512^2" "$S/walls/habitat.png" \
  "COLONY_WALL_SOLAR 512^2" "$S/walls/solar.png" \
  "COLONY_WALL_MINE 512^2" "$S/walls/mine.png" \
  "QM_WORKSTATION 512^2" "$S/pilot/quartermaster/workstation.png"

# Row C: cast live today (atlas cell 0 = facing the viewer)
row_title "$TMP/tC.png" "C. CAST LIVE TODAY - quartermaster (approved pilot atlas), Voss billboard used as the Overseer, colonists, Voss portrait"
magick "$S/pilot/quartermaster/idle.png" -crop 128x256+0+0 +repage "$TMP/qm-idle0.png"
magick "$S/pilot/quartermaster/work.png" -crop 128x256+0+0 +repage "$TMP/qm-work0.png"
sheet "$TMP/rC.png" 150x256+50+8 7x1 \
  "QM idle/0 128x256 cell" "$TMP/qm-idle0.png" \
  "QM work/0 128x256 cell" "$TMP/qm-work0.png" \
  "NPC_VOSS (Overseer today)" "$S/boarding/npc-voss.png" \
  "NPC_SURVIVOR 128x256" "$S/boarding/npc-survivor.png" \
  "NPC_SCAVENGER 128x256" "$S/boarding/npc-scavenger.png" \
  "PORTRAIT_VOSS 1024^2" "$S/portraits/voss.png" \
  "PORTRAIT_HUB_BARTENDER" "$S/portraits/hub-bartender.png"

# Row D: reviewed art on disk with no runtime consumer (candidates), plus two legacy props flagged
row_title "$TMP/tD.png" "D. ON DISK, REVIEWED, UNREGISTERED (candidates) - right end: two legacy props flagged as not acceptable"
sheet "$TMP/rD.png" 150x256+40+8 12x1 \
  "npc-hub-governor -> Overseer?" "$S/boarding/npc-hub-governor.png" \
  "hub-governor portrait -> Overseer?" "$S/portraits/hub-governor.png" \
  "npc-hub-provisioner (later)" "$S/boarding/npc-hub-provisioner.png" \
  "hub-provisioner portrait (later)" "$S/portraits/hub-provisioner.png" \
  "m3 marketplace wall (later)" "$S/interiors/m3/marketplace/wall.png" \
  "m3 vendor-counter (later)" "$S/interiors/m3/marketplace/vendor-counter.png" \
  "m3 trade-terminal (later)" "$S/interiors/m3/marketplace/trade-terminal.png" \
  "m3 holo-atlas (later)" "$S/interiors/m3/town-hall/holo-atlas.png" \
  "m3 petition-terminal (later)" "$S/interiors/m3/town-hall/petition-terminal.png" \
  "town-hall facade 64^2" "$S/walls/town-hall.png" \
  "PROP_ANTENNA: halo, rejected" "$S/explore/scrapyard-outpost-prop-antenna.png" \
  "LANDMARK_RIG: defective" "$S/explore/scrapyard-outpost-landmark-rig.png"

# Row E: palette. Surface values are measured means of the live assets (magick -resize 1x1); emissives come from the master style guide and existing code.
row_title "$TMP/tE.png" "E. ASHFALL PALETTE - surfaces measured from live assets (mean colour); emissive accents from the master guide and existing code"
sw() { magick -size 120x70 xc:"$2" "$TMP/sw-$1.png"; echo "$TMP/sw-$1.png"; }
sheet "$TMP/rE.png" 120x70+30+8 12x1 \
  "sky mean #503021" "$(sw 1 '#503021')" \
  "sky horizon #7B472C" "$(sw 2 '#7B472C')" \
  "sky zenith #2D1F19" "$(sw 3 '#2D1F19')" \
  "ground #553C2D" "$(sw 4 '#553C2D')" \
  "frame wall #795E4B" "$(sw 5 '#795E4B')" \
  "landing pad #4F5358" "$(sw 6 '#4F5358')" \
  "foundation #615E5C" "$(sw 7 '#615E5C')" \
  "habitat facade #4A4743" "$(sw 8 '#4A4743')" \
  "porch #ffb066 (code)" "$(sw 9 '#ffb066')" \
  "scaffold #9fd0ff (code)" "$(sw 10 '#9fd0ff')" \
  "ember/mast #d1341a" "$(sw 11 '#d1341a')" \
  "tech cyan #00f0ff" "$(sw 12 '#00f0ff')"

magick -background "$BG" -fill "$FG" -font "$FONT" -pointsize 26 -size 1900x44 -gravity west label:"  ASHFALL PRIMARY - REFERENCE BOARD (2026-10-18, design/ashfall-lock)" "$TMP/h1.png"
magick -background "$BG" -fill "$MUTED" -font "$FONT" -pointsize 14 -size 1900x26 -gravity west label:"  Contact sheet of EXISTING repository art only. Nothing here is generated or a render of the proposal. Built by docs/ashfall/boards/build-boards.sh." "$TMP/h2.png"
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
magick -background "$BG" -fill "$FG" -font "$FONT" -pointsize 15 -size 830x -gravity west \
  label:"  ANNOTATED BASELINE CAPTURE - scene-colony.png (2026-09-06 graphics rollout, 415x738, shown at 2x)\n  Cyan = exists today.  Amber dashed = PROPOSED placement, not rendered.\n  A  Quartermaster + SUPPLY STATION prop at the pad stall (exists; approved pilot asset)\n  B  Landing pad tile (exists; COLONY_LANDING_PAD)\n  C  Perimeter frame wall (exists; EXPLORE_OUTPOST_WALL_EXTERIOR) - Ashfall-specific variant deferred\n  E  Relay Mast landmark at tile (10,6), north of the plaza, on the pad-stall-plaza axis (PROPOSED new billboard, lit/dark)\n  F  Overseer post at plaza centre (10,11) - exists; new identity PROPOSED (hub-governor pair)\n  Sky, ground, quartermaster atlas and HUD are unchanged by this packet." "$TMP/legend.png"
magick "$TMP/annot.png" "$TMP/legend.png" -background "$BG" -gravity west -append -bordercolor "$BG" -border 10 "$OUT/baseline-annotated.png"

# Candidate quartermaster portrait: square crop of the approved pilot hero source, green keyed to the HUD deep tone.
magick "$D/pilot/quartermaster-hero-v1.png" -crop 640x640+192+0 +repage -fuzz 18% -fill '#121720' -opaque '#00FF00' -resize 512x512 "$OUT/candidates/quartermaster-portrait-candidate.png"

echo "built: $OUT/reference-board.png $OUT/baseline-annotated.png $OUT/candidates/quartermaster-portrait-candidate.png"

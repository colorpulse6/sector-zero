# M2 Shooter Enemy Tranche — Prompts and Provenance

**Date:** 2026-07-14
**Branch:** `feat/m2-shooter-enemy-tranche`
**Pipeline:** built-in Codex image generation → local chroma-key matte → exact-canvas PNG

## Selection evidence

Counts are explicit authored spawns in campaign `ALL_LEVELS` plus
`PLANET_LEVELS`.

| Enemy | Campaign | Planet | Total | Representative verification |
|---|---:|---:|---:|---|
| Swarm | 549 | 38 | 587 | World 8-3 Spawning Chamber; World 5-4 Event Horizon |
| Bomber | 447 | 51 | 498 | World 3-3 Solar Storm; World 5-4 Event Horizon |
| Gunner | 397 | 67 | 464 | World 1-4 The Gauntlet; World 5-4 Event Horizon |
| Drone | 374 | 76 | 450 | World 1-4 The Gauntlet; World 5-4 Event Horizon |

The next-highest authored total is Cloaker at 403.

## Preserved runtime contracts

All four assets are single-frame sRGBA billboards registered at their existing
paths by `SPRITES` and `ENEMY_SPRITE_MAP`. The renderer draws four pixels beyond
each side of the entity rectangle. Bestiary detail reuses each path at 96x96.

| Enemy | Path | Source | Frames | 5%-alpha envelope | Entity | Gameplay render | Bestiary |
|---|---|---:|---:|---:|---:|---:|---:|
| Swarm | `enemies/swarm.png` | 1536x1024 | 1 | 559x594 | 24x24 | 32x32 | 96x96 |
| Bomber | `enemies/bomber.png` | 1536x1024 | 1 | 414x829 | 36x48 | 44x56 | 96x96 |
| Gunner | `enemies/gunner.png` | 1536x1024 | 1 | 668x548 | 48x48 | 56x56 | 96x96 |
| Drone | `enemies/drone.png` | 1536x1024 | 1 | 420x413 | 32x32 | 40x40 | 96x96 |

## Shared generation prompt

### Flat-background block

```text
Create one top-down vertical-shooter enemy sprite on a perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Keep the subject fully separated from the background with crisp edges and generous padding. Do not use #00ff00 anywhere in the subject. No cast shadow, no contact shadow, no reflection, no watermark, and no text.
```

### Authoritative positive suffix

```text
modern DOOM (2016 / Eternal) aesthetic, gritty industrial sci-fi, heavy worn scarred
gunmetal and cracked concrete, crushed near-black shadows, very high contrast, low ambient
saturation, single hot directional key light, emissive glow accents only (hellfire orange
#ff5a1e, demon red #ff3366, toxic green #44ff99, tech cyan #00f0ff, portal purple #7800ff),
strong readable silhouette, chunky weighted forms, painterly realistic detail, game asset,
dark background separation, dramatic rim lighting
```

### Authoritative negative suffix

```text
pixel art, 8-bit, 16-bit, dithering, visible pixels, cartoon, cel shading, anime, flat
colors, outline style, pastel, bright cheerful colors, saturated painted surfaces, clean new
pristine surfaces, chrome, gloss plastic, soft even lighting, washed out, low contrast, text,
letters, numbers, logos, watermark, signature, jpeg artifacts, blurry, white background halo
```

For shooter assets, role and actual-size silhouette outrank literal FPS/DOOM
fidelity. Originals are semantic references only, not silhouettes to copy.

## Pre-change baseline

Run from `game/` on `a0cfb7e` before production sprite changes (rebased onto
the current `origin/main`):

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | pass, exit 0 |
| `yarn colony:test` | 268/268 pass |
| `yarn engine:test` | 66/66 pass |
| `yarn sprites:test` | 4/4 pass |
| `yarn build` | static export pass; restricted-network attempt could not fetch Google Fonts, approved network rerun passed |
| `NEXT_PUBLIC_DEVTOOLS=1 yarn build` | static export pass |

## Generation ledger

The built-in image tool does not currently expose a numeric seed. Record that
as `not exposed by built-in tool` unless an individual result provides one.
Generated and rejected source images stay under `/private/tmp`, outside the
production sprite tree.

### Swarm

- **Sprite ID:** `SPRITES.ENEMY_SWARM`
- **Accepted output identifier/path:** built-in image result
  `019f6093-6ee2-7e32-a1dc-389622647e4f/exec-200ab586-2f83-4777-a6f2-277ff615ca87.png`;
  production `game/public/sprites/enemies/swarm.png`
- **Seed:** not exposed by built-in tool
- **Reference role:** original sprite inspected for semantics and scale only
- **Generated source dimensions:** 1254x1254 RGB
- **Matte:** local `remove_chroma_key.py` with border sampling, soft matte,
  thresholds 12/220, and despill. The system `python3` lacked Pillow, so the
  helper ran with the existing rembg virtualenv interpreter (Pillow 12.3)
  without invoking rembg. Sampled key `#04f608`; 1,013,621 transparent and
  4,125 partially transparent source pixels. Output is 1536x1024 sRGBA with a
  transparent corner and 559x362 5%-alpha envelope.
- **Iteration notes:** Candidate 2 widened the cluster, simplified each lobe,
  and raised the scorched-bone edge values after candidate 1 failed the live
  dark-scene gate. No cropping, stretching, or hand-painted correction was
  used.
- **Actual-size verdict:** accepted at 32x32 on dark and bright comparison
  fields, at 96x96 in the Bestiary contract, and live in World 8-3 Spawning
  Chamber. The three-body claw cluster remains readable after the wave
  separates; no green fringe or white halo was visible. Browser console: zero
  errors and zero warnings.
- **Rejected candidates:** candidate 1
  (`/private/tmp/sector-zero-m2-rejected/swarm-candidate-1-source.png`) became
  a narrow orange streak at 32x32 in World 8-3 and lost its three-lobed role
  silhouette.

### Bomber

- **Sprite ID:** `SPRITES.ENEMY_BOMBER`
- **Accepted output identifier/path:** built-in image result
  `019f6093-6ee2-7e32-a1dc-389622647e4f/exec-fa063d3b-e514-403e-8a4e-362d9404491a.png`;
  production `game/public/sprites/enemies/bomber.png`
- **Seed:** not exposed by built-in tool
- **Reference role:** original sprite inspected for semantics and scale only
- **Generated source dimensions:** 1122x1402 RGB
- **Matte:** local `remove_chroma_key.py` with border sampling, soft matte,
  thresholds 12/220, despill, and a one-pixel edge contraction. Sampled key
  `#03f905`; 912,339 transparent and 5,105 partially transparent source
  pixels. Output is 1536x1024 sRGBA with a transparent corner and 414x674
  5%-alpha envelope.
- **Iteration notes:** Candidate 1 passed the shape gate. The first live check
  appeared to show green edge spill, so the approved one-pixel contraction was
  tested. Pixel tracing then proved the 44x56 asset contained zero
  green-dominant pixels: the live green is the unchanged bio-organic
  `#44ff66` multiply tint in `drawEnemies`, not chroma contamination. The
  contracted matte was retained as the more conservative edge result.
- **Actual-size verdict:** accepted at 44x56 on dark and bright comparison
  fields, at 96x96 in the Bestiary contract, and live in World 3-3 Solar
  Storm. The bone ram, furnace sac, and tall impact profile remain distinct
  during the close attack run; no chroma or white halo was present. Browser
  console: zero errors and zero warnings.
- **Rejected candidates:** none; one candidate with two matte passes

### Gunner

- **Sprite ID:** `SPRITES.ENEMY_GUNNER`
- **Accepted output identifier/path:** built-in image result
  `019f6093-6ee2-7e32-a1dc-389622647e4f/exec-e362a9d3-7d51-40b7-aab1-742fcc5753ab.png`;
  production `game/public/sprites/enemies/gunner.png`
- **Seed:** not exposed by built-in tool
- **Reference role:** original sprite inspected for semantics and scale only
- **Generated source dimensions:** 1254x1254 RGB
- **Matte:** local `remove_chroma_key.py` with border sampling, soft matte,
  thresholds 12/220, and despill. Sampled key `#06f806`; 684,226 transparent
  and 4,675 partially transparent source pixels. Output is 1536x1024 sRGBA
  with a transparent corner and 564x548 5%-alpha envelope.
- **Iteration notes:** Candidate 1 passed without a generation or matte retry.
  The first browser capture caught the formation partly above the playfield, so
  the same W1-4 wave was restarted and captured once the five-unit grid had
  fully entered. No art or renderer adjustment was made.
- **Actual-size verdict:** accepted at 56x56 on dark and bright comparison
  fields, at 96x96 in the Bestiary contract, and live in World 1-4 The
  Gauntlet. The repeated squared-U silhouette, twin cannon shoulders, and red
  apertures remain legible in the five-unit grid; no chroma or white halo was
  visible. Browser console: zero errors and zero warnings.
- **Rejected candidates:** none

### Drone

- **Sprite ID:** `SPRITES.ENEMY_DRONE`
- **Accepted output identifier/path:** built-in image result
  `019f6093-6ee2-7e32-a1dc-389622647e4f/exec-619ef135-93bd-4bd5-82d1-5d309a6d54bc.png`;
  production `game/public/sprites/enemies/drone.png`
- **Seed:** not exposed by built-in tool
- **Reference role:** original sprite inspected for semantics and scale only
- **Generated source dimensions:** 1254x1254 RGB
- **Matte:** local `remove_chroma_key.py` with border sampling, soft matte,
  thresholds 12/220, and despill. Sampled key `#04f605`; 874,818 transparent
  and 3,718 partially transparent source pixels. Output is 1536x1024 sRGBA
  with a transparent corner and 417x413 5%-alpha envelope.
- **Iteration notes:** Candidate 1 was rejected before production because its
  large side vanes collapsed into a Y-shaped fighter at 40x40. Candidate 2
  made the spherical core at least 70% of the silhouette and reduced the three
  vanes to short indexing tabs. The first live screenshots missed the fast
  opening wave; the accepted capture polls DevPanel for a fresh `Enemies: 0`
  state, then captures 300ms after the eight-Drone spawn.
- **Actual-size verdict:** accepted at 40x40 on dark and bright comparison
  fields, at 96x96 in the Bestiary contract, and live in the opening V
  formation of World 1-4 The Gauntlet. All eight units read as compact
  cyan-centered armored orbs; no chroma or white halo was visible. Browser
  console: zero errors and zero warnings.
- **Rejected candidates:** candidate 1
  (`/private/tmp/sector-zero-m2-rejected/drone-candidate-1-source.png`) became
  a winged Y-shaped fighter at 40x40 and lost the required spherical role read.

## Browser verification

Before and after captures use the DevPanel-enabled production static export at
480x854. The final export completed successfully with
`NEXT_PUBLIC_DEVTOOLS=1 yarn build` before these captures.

| Enemy | Gameplay evidence | Bestiary evidence | Verdict |
|---|---|---|---|
| Drone | `after-world-1-4-drone.png` | `after-bestiary-drone.png` | Eight compact cyan-centered orbs remain distinct in the opening V formation. |
| Gunner | `after-world-1-4-gunner.png`; `after-world-5-4.png` | `after-bestiary-gunner.png` | Squared-U barges remain legible in the five-unit grid and Event Horizon darkness. |
| Bomber | `after-world-3-3-bomber.png` | `after-bestiary-bomber.png` | Tall bone ram and furnace sac remain visible over Solar Storm's red field. |
| Swarm | `after-world-8-3-swarm.png` | `after-bestiary-swarm.png` | The orange-edged three-body cluster survives a 28-unit scatter wave. |

All level and Bestiary sessions reported zero browser-console errors and zero
warnings. The green visible on Bomber is the existing bio-organic multiply
tint; the accepted 44x56 PNG contains zero green-dominant pixels.

Actual-size sheets are under `actual-size/`. Each sheet is a 2x2 grid with
before/after on the top dark row and before/after on the bottom bright row.
Each source was first reduced exactly as the renderer does, then enlarged with
point filtering only for inspection:

```text
magick <1536x1024-source> -resize '<gameplay-width>x<gameplay-height>!' <actual.png>
magick -size <gameplay-width>x<gameplay-height> xc:<field> <actual.png> \
  -gravity center -composite -filter point -resize '320x320' \
  -gravity center -background '#111111' -extent 320x320 <panel.png>
```

No source-code, registration, atlas, frame-count, renderer, hitbox, spawn,
stat, collision, or balance change was required.

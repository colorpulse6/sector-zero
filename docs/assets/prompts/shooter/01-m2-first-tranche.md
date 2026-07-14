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

The envelope column records the **original maximum envelope** used to constrain
candidate fitting. Accepted envelopes are recorded in each generation ledger.

| Enemy | Path | Source | Frames | Original max 5%-alpha envelope | Entity | Gameplay render | Bestiary |
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

## Exact per-attempt prompt ledger

Every canonical request used this exact order: `Use case` line, shared
flat-background block, attempt-specific subject block, authoritative positive
suffix, then `Negative prompt:` followed by the authoritative negative suffix
and the listed attempt-specific negative additions. No image reference was
passed to the generation tool. The existing production sprite was inspected
locally for semantics, scale, and comparison only.

### Shared use case

```text
Use case: polished 2D game production asset, a single enemy billboard for a top-down vertical shooter.
```

### Swarm attempt 1 — rejected

- **Output:** `019f6093-6ee2-7e32-a1dc-389622647e4f/exec-af1358b5-0628-4330-a69a-69f7e7ed9f31.png`
- **Seed:** not exposed by built-in tool
- **Source:** 1024x1536 RGB; no image reference input
- **Subject block:**

```text
Subject: SWARM enemy. A compact three-body hooked bio-organic predator cluster, fused tightly enough to read as one chunky connected game unit. Strict top-down/front-down view with the cluster pointing toward the bottom of the image, like an enemy descending toward the player. The silhouette must be an unmistakable asymmetric three-lobed serrated shape: three overlapping organisms with hooked outer mandibles and broad torn-fin chitin edges, no thin antennae, no disconnected pieces. Materials are scorched black leathery chitin and worn bone ridges with tiny restrained hellfire-orange sensory pits. No machinery, guns, armor plating, humanoid anatomy, wings, or legs. The complete silhouette must remain identifiable when reduced to 32 by 32 pixels. Avoid a clean triangular arrowhead, avoid a single bulbous torpedo form, and avoid resembling the Bomber role. Centered, generous padding, no cropping.
```

- **Negative additions:** `cast shadow, contact shadow, floor, scene, multiple separate enemies, floating debris, thin antennae, human, humanoid, mech, spaceship, triangular arrowhead`
- **Matte and candidate derivative:** local `remove_chroma_key.py` with border
  sampling, soft matte, thresholds 12/220, and despill. Sampled key `#03f903`;
  1,050,607 transparent and 6,267 partially transparent source pixels. The
  candidate derivative was 1536x1024 sRGBA, one frame, with a transparent
  corner and a 466x594 5%-alpha envelope.
- **Disposition:** rejected after actual-size inspection and a temporary W8-3
  playtest; it was never committed to the production sprite tree. The dark
  core collapsed into a narrow orange streak at 32x32.

### Swarm attempt 2 — accepted

- **Output:** `019f6093-6ee2-7e32-a1dc-389622647e4f/exec-200ab586-2f83-4777-a6f2-277ff615ca87.png`
- **Seed:** not exposed by built-in tool
- **Source:** 1254x1254 RGB; no image reference input; attempt 1's live failure
  was described textually
- **Subject block:**

```text
Subject: SWARM enemy. One compact fused cluster made from exactly three broad hooked bio-organic organisms. Strict top-down/front-down view, descending toward the bottom of the image. Make the overall silhouette WIDE, short-to-medium length, and unmistakably three-lobed: a large left claw-body, a slightly lower central claw-body, and a large right claw-body, all visibly connected by one thick shared core. Each lobe must have a broad pale scorched-bone outer rim and a dark leathery chitin interior, so all three lobes remain separately readable against a near-black game scene when the whole source is reduced to 32 by 32 pixels. Use chunky solid masses, large shape breaks, bright warm rim lighting, and only a few small but visible hellfire-orange sensory pits. The full cluster should occupy a broad roughly 1.1:1 silhouette, not a tall spear. No thin antennae, disconnected pieces, tiny intricate holes, or narrow tail. No machinery, guns, armor plating, humanoid anatomy, wings, or legs. Avoid a triangular arrowhead, avoid a vertical orange streak, avoid a single bulbous torpedo, and avoid resembling the Bomber role. Centered, generous padding, no cropping.
```

- **Negative additions:** `cast shadow, contact shadow, floor, scene, multiple separate enemies, floating debris, thin antennae, human, humanoid, mech, spaceship, triangular arrowhead, narrow spear, long tail, mostly black silhouette, tiny detail, tall portrait composition`

### Bomber attempt 1 — accepted

- **Output:** `019f6093-6ee2-7e32-a1dc-389622647e4f/exec-fa063d3b-e514-403e-8a4e-362d9404491a.png`
- **Seed:** not exposed by built-in tool
- **Source:** 1122x1402 RGB; no image reference input
- **Subject block:**

```text
Subject: BOMBER enemy, a heavy bio-organic kamikaze breaching torpedo. Strict top-down/front-down view, descending toward the bottom of the image. The silhouette must be tall, blunt, bulbous, and unmistakably different from a fighter or humanoid: a massive cracked bone-and-chitin armored ram at the lower leading end, a swollen dark organic furnace sac in the center, and two short thick stabilizing carapace fins high on the sides. One connected organism, no separate parts. Large simple shape breaks for readability at a 44 by 56 gameplay draw. Scorched black leathery tissue, worn pale bone armor, a restrained vertical seam of hellfire-orange heat leaking through deep cracks, and one small hot vent near the ram. It should feel dangerously overpressurized and built to detonate on impact. Chunky weighted mass, no thin antennae, no long tail, no delicate legs. No guns, cockpit, engines, machinery, humanoid anatomy, face, wings, or three-body cluster. Avoid a sleek missile, avoid a narrow spear, avoid the Swarm's broad three-lobed claw shape, and avoid the Gunner's square mechanical barge. Centered, generous padding, no cropping.
```

- **Negative additions:** `cast shadow, contact shadow, floor, scene, multiple enemies, floating debris, thin antennae, human, humanoid, mech, spaceship cockpit, gun, broad three-lobed cluster, triangular fighter, sleek missile, long narrow tail`

### Gunner attempt 1 — accepted

- **Output:** `019f6093-6ee2-7e32-a1dc-389622647e4f/exec-e362a9d3-7d51-40b7-aab1-742fcc5753ab.png`
- **Seed:** not exposed by built-in tool
- **Source:** 1254x1254 RGB; no image reference input
- **Subject block:**

```text
Subject: GUNNER enemy, a broad square industrial weapons barge. Strict top-down/front-down view, descending toward the bottom of the image. A low, wide, armored mechanical platform with two huge blocky cannon shoulders at the lower left and lower right, a recessed central ammunition-and-reactor trench, and a heavy rectangular rear chassis. The silhouette must read as a wide squared U-shaped siege unit, not a humanoid torso and not a sleek aircraft. Twin cannons are thick, short, and visually dominant; the central body is one connected mass. Worn scarred gunmetal, soot-black recesses, burnt dark rust, chipped industrial armor, restrained deep-red weapon apertures and tiny amber service lights. Large simple value blocks and a strong rim so it remains identifiable at a 56 by 56 gameplay draw. No legs, arms, head, face, cockpit glass, wings, thin barrels, antennae, or disconnected turrets. Avoid Bomber's tall organic torpedo, avoid Swarm's hooked bio cluster, avoid Drone's spherical three-vane silhouette, and avoid a human mech. Centered, generous padding, no cropping.
```

- **Negative additions:** `cast shadow, contact shadow, floor, scene, multiple enemies, floating debris, human, humanoid, biped, head, face, cockpit, wings, sleek spaceship, organic flesh, long thin gun barrels, spherical drone, tall missile`

### Drone attempt 1 — rejected

- **Output:** `019f6093-6ee2-7e32-a1dc-389622647e4f/exec-d6d80f76-65bc-4643-a534-73aee873f228.png`
- **Seed:** not exposed by built-in tool
- **Source:** 1254x1254 RGB; no image reference input
- **Subject block:**

```text
Subject: DRONE enemy, a compact fast automated attack machine. Strict top-down/front-down view, descending toward the bottom of the image. One dense spherical armored core with exactly three thick stabilizer vanes arranged as a clear triangular silhouette: broad left vane, broad right vane, and a short lower tail vane. A single large recessed tech-cyan sensor lens dominates the lower-facing center, with two tiny cyan status slits. The vanes are chunky armored wedges, not wings and not thin antennae. Worn desaturated blue-black gunmetal, scratched dark steel, soot in panel seams, restrained cyan emissive light only. The whole unit must read as a compact round three-vane machine when reduced to a 40 by 40 gameplay draw. No humanoid anatomy, head, face, legs, arms, cockpit, guns, long barrels, organic flesh, bone, or disconnected pieces. Avoid Gunner's broad rectangular barge, Bomber's tall organic torpedo, Swarm's hooked three-body cluster, and a sleek triangular fighter. Centered, generous padding, no cropping.
```

- **Negative additions:** `cast shadow, contact shadow, floor, scene, multiple enemies, floating debris, human, humanoid, biped, head, face, cockpit, organic flesh, bone, broad rectangular tank, tall missile, long thin antennae, wings, sleek fighter, four or more vanes`
- **Matte and candidate derivative:** local `remove_chroma_key.py` with border
  sampling, soft matte, thresholds 12/220, and despill. Sampled key `#0cf60d`;
  1,085,771 transparent and 4,011 partially transparent source pixels. The
  candidate derivative was 1536x1024 sRGBA, one frame, with a transparent
  corner and a 420x343 5%-alpha envelope.
- **Disposition:** rejected at the 40x40 actual-size gate and never placed in
  the production sprite tree. It was not playtested in a level or Bestiary;
  the broad vanes already read as a Y-shaped fighter.

### Drone attempt 2 — accepted

- **Output:** `019f6093-6ee2-7e32-a1dc-389622647e4f/exec-619ef135-93bd-4bd5-82d1-5d309a6d54bc.png`
- **Seed:** not exposed by built-in tool
- **Source:** 1254x1254 RGB; no image reference input; attempt 1's actual-size
  failure was described textually
- **Subject block:**

```text
Subject: DRONE enemy, a compact spherical automated attack machine. Strict top-down/front-down view, descending toward the bottom of the image. The large round armored core must occupy at least 70 percent of the complete silhouette and remain unmistakably circular at 40 by 40 pixels. Attach exactly three VERY SHORT, thick stabilizer tabs directly to the sphere at upper-left, upper-right, and bottom; each tab projects only about 10 percent of the core diameter. The total silhouette stays nearly circular, like a heavy sensor orb with three small indexing notches, never a Y-shaped aircraft. A single large recessed tech-cyan sensor lens dominates the lower-facing center, with two small cyan status slits. Worn desaturated blue-black gunmetal, scratched dark steel, soot in panel seams, restrained cyan emissive light only. Use broad rim highlights around the sphere and large simple panel breaks. One connected machine. No wings, long vanes, antennae, guns, barrels, humanoid anatomy, face, cockpit, organic flesh, bone, or disconnected parts. Avoid a triangular fighter, avoid a Y silhouette, avoid Gunner's rectangular barge, Bomber's tall torpedo, and Swarm's claw cluster. Centered, generous padding, no cropping.
```

- **Negative additions:** `cast shadow, contact shadow, floor, scene, multiple enemies, floating debris, human, humanoid, biped, head, face, cockpit, organic flesh, bone, rectangular tank, tall missile, antennae, wing, long vane, triangular fighter, Y shape, broad side fins, four or more tabs`

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

## Post-change verification

Full verification ran from `game/` on reviewed art/code head `6517607`.
Subsequent corrections are documentation and matched review captures only; the
verified `game/` subtree remains
`bcb0f36cdbea11a31531a37bdb5a2e33201ea319`.

| Gate | Final result |
|---|---|
| `npx tsc --noEmit` | pass, exit 0 |
| `yarn colony:test` | 268/268 pass |
| `yarn engine:test` | 66/66 pass |
| `yarn sprites:test` | 4/4 pass |
| `yarn build` | static export pass |
| `NEXT_PUBLIC_DEVTOOLS=1 yarn build` | static export pass |
| Browser console | zero errors; the matched-capture rerun emitted only two unchanged Next.js font-preload warnings |
| `git diff --check origin/main...HEAD` | pass |

The independent production-readiness review also reran TypeScript and all
three test suites successfully on the same game subtree.

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
- **Iteration notes:** Candidate 1 was rejected before live playtesting because
  its large side vanes collapsed into a Y-shaped fighter at 40x40. Candidate 2
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
the same 480x854 canvas size. The final export completed successfully with
`NEXT_PUBLIC_DEVTOOLS=1 yarn build` before these captures. Gameplay pairs use
the same authored level and target wave entry; their exact live positions are
not pixel-identical because the shooter continues to tick. Bestiary pairs were
selected from turntable bursts at equivalent front-facing rotations.

| Enemy | Matched review sheet | Gameplay source pair | Bestiary source pair | Verdict |
|---|---|---|---|---|
| Drone | `matched/drone.png` | `before-world-1-4-drone-matched.png`; `after-world-1-4-drone-matched.png` | `before-bestiary-drone-matched.png`; `after-bestiary-drone-matched.png` | Eight compact cyan-centered orbs remain distinct in the opening V formation. |
| Gunner | `matched/gunner.png` | `before-world-1-4-gunner-matched.png`; `after-world-1-4-gunner-matched.png` | `before-bestiary-gunner-matched.png`; `after-bestiary-gunner-matched.png` | Squared-U barges remain legible in the five-unit grid; `after-world-5-4.png` also covers Event Horizon darkness. |
| Bomber | `matched/bomber.png` | `before-world-3-3-bomber-matched.png`; `after-world-3-3-bomber-matched.png` | `before-bestiary-bomber-matched.png`; `after-bestiary-bomber-matched.png` | Tall bone ram and furnace sac remain visible over Solar Storm's red field. |
| Swarm | `matched/swarm.png` | `before-world-8-3-swarm-matched.png`; `after-world-8-3-swarm-matched.png` | `before-bestiary-swarm-matched.png`; `after-bestiary-swarm-matched.png` | The orange-edged three-body cluster survives a 28-unit scatter wave. |

All level and Bestiary sessions reported zero browser-console errors. The
matched-capture rerun reported only two unchanged Next.js preload warnings for
font files; it introduced no gameplay or asset warnings. The green visible on
Bomber is the existing bio-organic multiply tint; the accepted 44x56 PNG
contains zero green-dominant pixels.

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

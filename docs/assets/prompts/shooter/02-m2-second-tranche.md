# M2 Shooter Enemy Tranche 2 — Prompts and Provenance

**Date:** 2026-07-15
**Branch:** `feat/m2-shooter-enemy-tranche-2`
**Base:** `origin/main` at `a110cd3bc6a18e3275c389d0bed42ef4912bb958`
**Pipeline:** built-in Codex image generation → local chroma-key matte → exact-canvas PNG

## Audited selection baseline

Counts are explicit authored spawns in campaign `ALL_LEVELS` plus
`PLANET_LEVELS`. Conditional boss additions are excluded.

| Enemy | Campaign | Planet | Total | Representative baseline |
|---|---:|---:|---:|---|
| Cloaker | 369 | 34 | 403 | World 5-3 Phantom Fleet, HUD Wave 1 |
| Scout | 319 | 77 | 396 | World 1-1 First Contact, HUD Wave 1 |
| Wraith | 296 | 44 | 340 | World 4-2 The Kepler Graveyard, HUD Wave 1 |
| Echo | 296 | 44 | 340 | World 6-2 Distortion Field, HUD Wave 1 |

These are the next four highest authored totals after the merged first tranche.

## Preserved runtime contracts

All four assets are single-frame sRGBA billboards registered at their current
paths in `SPRITES` and `ENEMY_SPRITE_MAP`. They are present in `MAT_ALLOWLIST`
and absent from the width-divided `SHEETS` registry. `drawEnemies` draws four
pixels beyond every side of the entity/hitbox rectangle. Bestiary detail reuses
the same path in a 96x96 square. No registration, frame count, source canvas,
alpha semantics, hitbox, draw size, class tint, mechanic, stats, spawning,
collision, or balance changes are permitted.

| Enemy | Sprite registration / path | Source | Frames | Original 5%-alpha bounds | Entity / hitbox | Draw | Class tint | Bestiary | Mechanic / representative level |
|---|---|---:|---:|---:|---:|---:|---|---:|---|
| Cloaker | `SPRITES.ENEMY_CLOAKER` / `enemies/cloaker.png` | 1536x1024 sRGBA | 1 | `633x596+452+147` | 44x44 | 52x52 | `tech-drone` | 96x96 | lateral cloak, starts hidden, toggles every 120 frames, cannot shoot or collide while hidden; W5-3 Wave 1 |
| Scout | `SPRITES.ENEMY_SCOUT` / `enemies/scout.png` | 1536x1024 sRGBA | 1 | `602x476+465+240` | 40x40 | 48x48 | `swarm` | 96x96 | 1 HP, speed 3, unarmed formation attacker; W1-1 Wave 1 |
| Wraith | `SPRITES.ENEMY_WRAITH` / `enemies/wraith.png` | 1024x1536 sRGBA | 1 | `968x1284+28+97` | 48x44 | 56x52 | `elemental-cinder` | 96x96 | 4 HP, speed 2.5, armed slow formation drift; W4-2 Wave 1 |
| Echo | `SPRITES.ENEMY_ECHO` / `enemies/echo.png` | 1536x1024 sRGBA | 1 | `1037x895+258+49` | 36x36 | 44x44 | `tech-drone` | 96x96 | lateral phase sway, starts hidden, toggles every 90 frames, cannot shoot or collide while hidden; W6-2 Wave 1 |

The offsets are placement contracts because the complete source canvas maps to
the padded entity rectangle. Wraith's portrait canvas is intentional.

## Approved visual-role briefs

- **Scout:** A lean, uncomplicated forward interceptor that instantly reads as
  the fast, unarmed baseline attacker at 48x48.
- **Cloaker:** A crescent/shutter-shaped organic stealth hunter whose negative
  space remains recognizable when visible at 52x52 and ghosted to 15% alpha.
- **Wraith:** A broad, heavy corrupted sarcophagus/reliquary containing a
  trapped-human cue, with restrained cinder light at 56x52.
- **Echo:** A compact connected craft of visibly displaced repeating plates or
  afterimage masses, readable both visible and at 15% alpha at 44x44.

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

Every request uses the shared flat-background block and the two authoritative
suffixes verbatim. The initial attempt for each enemy records `no image
reference input`; originals are semantic, contract, and comparison references
only. A built-in generation seed is recorded as `not exposed by built-in tool`
unless the returned result exposes one.

## Attempt ledger template

### `<Enemy>` attempt `<N>` — `<decision>`

- **Output identifier/path:** `<built-in output ID and source path>`
- **Seed policy:** `not exposed by built-in tool` unless exposed by the result
- **Reference role:** `no image reference input`; production original inspected
  only for semantics, contracts, scale, and comparison
- **Generated source dimensions:** `<width>x<height> <channels>`
- **Matte:** `<helper, border/key method, soft-matte thresholds, despill,
  optional edge contraction>`; sampled key `<#rrggbb>`
- **Fitted production derivative:** `<canvas/channels/frame count>`; 5%-alpha
  bounds `<WxH+X+Y>`; transparent-corner result `<result>`
- **Decision:** `<accepted or rejected>`
- **Rejection reason:** `<concrete failed gate, or none>`

## Verified pre-change baseline

This evidence was already run on this branch before production sprite changes;
it is recorded here without rerunning the full suite merely to rewrite history.

| Gate | Pre-change result |
|---|---|
| `npx tsc --noEmit` | pass, exit 0 |
| `yarn colony:test` | 268/268 pass |
| `yarn engine:test` | 66/66 pass |
| `yarn sprites:test` | 4/4 pass |
| `yarn build` | normal static export pass |
| `NEXT_PUBLIC_DEVTOOLS=1 yarn build` | DevPanel static export pass |

## Preserved-original audit

On baseline HEAD `cc187fc`, each file in
`/private/tmp/sector-zero-m2-tranche2-originals/` matched its production path
byte-for-byte. All are one-frame sRGBA images with meaningful transparency.

| Enemy | SHA-256 | Identity / geometry result |
|---|---|---|
| Cloaker | `bcb400c45435948e3bbd9d1e43214f9bf7503092a031b2567fdaa250cdd51869` | byte-identical; 1536x1024; `633x596+452+147` |
| Scout | `cb47c0a8ba9a6e5674ae00d4303f2a12de6db3097fd7a25bd3e766170a598114` | byte-identical; 1536x1024; `602x476+465+240` |
| Wraith | `b0c3198822dae2410922b4e59f52c8c1fa404081bc8a52c900a863f45331c241` | byte-identical; 1024x1536; `968x1284+28+97` |
| Echo | `dc4a2532e68ef83225b9f30b5c32bb054f339796b06e8942ccdd4c5a5bf3cf4d` | byte-identical; 1536x1024; `1037x895+258+49` |

## Exact-size baseline panel commands

The complete canvas is resized exactly to the renderer rectangle. No visible
alpha is cropped. The flattened exact-size dark and bright fields are enlarged
8x with point filtering only for inspection.

```bash
magick /private/tmp/sector-zero-m2-tranche2-originals/cloaker.png -resize '52x52!' /private/tmp/sector-zero-m2-tranche2-audit/cloaker-before-actual.png
magick -size 52x52 xc:'#05070b' /private/tmp/sector-zero-m2-tranche2-audit/cloaker-before-actual.png -gravity center -composite /private/tmp/sector-zero-m2-tranche2-audit/cloaker-before-dark.png
magick -size 52x52 xc:'#b8b8b0' /private/tmp/sector-zero-m2-tranche2-audit/cloaker-before-actual.png -gravity center -composite /private/tmp/sector-zero-m2-tranche2-audit/cloaker-before-bright.png
magick /private/tmp/sector-zero-m2-tranche2-audit/cloaker-before-dark.png -filter point -resize '416x416!' -set label 'DARK — exact 52x52 shown 8x' /private/tmp/sector-zero-m2-tranche2-audit/cloaker-before-dark-review.png
magick /private/tmp/sector-zero-m2-tranche2-audit/cloaker-before-bright.png -filter point -resize '416x416!' -set label 'BRIGHT — exact 52x52 shown 8x' /private/tmp/sector-zero-m2-tranche2-audit/cloaker-before-bright-review.png
magick montage /private/tmp/sector-zero-m2-tranche2-audit/cloaker-before-dark-review.png /private/tmp/sector-zero-m2-tranche2-audit/cloaker-before-bright-review.png -tile 2x1 -geometry +16+16 -background '#202020' -fill white -pointsize 20 docs/assets/reviews/m2-shooter-enemies-2/actual-size/before-cloaker.png

magick /private/tmp/sector-zero-m2-tranche2-originals/scout.png -resize '48x48!' /private/tmp/sector-zero-m2-tranche2-audit/scout-before-actual.png
magick -size 48x48 xc:'#05070b' /private/tmp/sector-zero-m2-tranche2-audit/scout-before-actual.png -gravity center -composite /private/tmp/sector-zero-m2-tranche2-audit/scout-before-dark.png
magick -size 48x48 xc:'#b8b8b0' /private/tmp/sector-zero-m2-tranche2-audit/scout-before-actual.png -gravity center -composite /private/tmp/sector-zero-m2-tranche2-audit/scout-before-bright.png
magick /private/tmp/sector-zero-m2-tranche2-audit/scout-before-dark.png -filter point -resize '384x384!' -set label 'DARK — exact 48x48 shown 8x' /private/tmp/sector-zero-m2-tranche2-audit/scout-before-dark-review.png
magick /private/tmp/sector-zero-m2-tranche2-audit/scout-before-bright.png -filter point -resize '384x384!' -set label 'BRIGHT — exact 48x48 shown 8x' /private/tmp/sector-zero-m2-tranche2-audit/scout-before-bright-review.png
magick montage /private/tmp/sector-zero-m2-tranche2-audit/scout-before-dark-review.png /private/tmp/sector-zero-m2-tranche2-audit/scout-before-bright-review.png -tile 2x1 -geometry +16+16 -background '#202020' -fill white -pointsize 20 docs/assets/reviews/m2-shooter-enemies-2/actual-size/before-scout.png

magick /private/tmp/sector-zero-m2-tranche2-originals/wraith.png -resize '56x52!' /private/tmp/sector-zero-m2-tranche2-audit/wraith-before-actual.png
magick -size 56x52 xc:'#05070b' /private/tmp/sector-zero-m2-tranche2-audit/wraith-before-actual.png -gravity center -composite /private/tmp/sector-zero-m2-tranche2-audit/wraith-before-dark.png
magick -size 56x52 xc:'#b8b8b0' /private/tmp/sector-zero-m2-tranche2-audit/wraith-before-actual.png -gravity center -composite /private/tmp/sector-zero-m2-tranche2-audit/wraith-before-bright.png
magick /private/tmp/sector-zero-m2-tranche2-audit/wraith-before-dark.png -filter point -resize '448x416!' -set label 'DARK — exact 56x52 shown 8x' /private/tmp/sector-zero-m2-tranche2-audit/wraith-before-dark-review.png
magick /private/tmp/sector-zero-m2-tranche2-audit/wraith-before-bright.png -filter point -resize '448x416!' -set label 'BRIGHT — exact 56x52 shown 8x' /private/tmp/sector-zero-m2-tranche2-audit/wraith-before-bright-review.png
magick montage /private/tmp/sector-zero-m2-tranche2-audit/wraith-before-dark-review.png /private/tmp/sector-zero-m2-tranche2-audit/wraith-before-bright-review.png -tile 2x1 -geometry +16+16 -background '#202020' -fill white -pointsize 20 docs/assets/reviews/m2-shooter-enemies-2/actual-size/before-wraith.png

magick /private/tmp/sector-zero-m2-tranche2-originals/echo.png -resize '44x44!' /private/tmp/sector-zero-m2-tranche2-audit/echo-before-actual.png
magick -size 44x44 xc:'#05070b' /private/tmp/sector-zero-m2-tranche2-audit/echo-before-actual.png -gravity center -composite /private/tmp/sector-zero-m2-tranche2-audit/echo-before-dark.png
magick -size 44x44 xc:'#b8b8b0' /private/tmp/sector-zero-m2-tranche2-audit/echo-before-actual.png -gravity center -composite /private/tmp/sector-zero-m2-tranche2-audit/echo-before-bright.png
magick /private/tmp/sector-zero-m2-tranche2-audit/echo-before-dark.png -filter point -resize '352x352!' -set label 'DARK — exact 44x44 shown 8x' /private/tmp/sector-zero-m2-tranche2-audit/echo-before-dark-review.png
magick /private/tmp/sector-zero-m2-tranche2-audit/echo-before-bright.png -filter point -resize '352x352!' -set label 'BRIGHT — exact 44x44 shown 8x' /private/tmp/sector-zero-m2-tranche2-audit/echo-before-bright-review.png
magick montage /private/tmp/sector-zero-m2-tranche2-audit/echo-before-dark-review.png /private/tmp/sector-zero-m2-tranche2-audit/echo-before-bright-review.png -tile 2x1 -geometry +16+16 -background '#202020' -fill white -pointsize 20 docs/assets/reviews/m2-shooter-enemies-2/actual-size/before-echo.png
```

## Browser baseline evidence

The unchanged DevPanel static export was rebuilt successfully with
`NEXT_PUBLIC_DEVTOOLS=1 yarn build`. Corepack added a tool-only `packageManager`
field to the root `package.json`; that file was restored immediately, and no
game source, sprite, registration, renderer, level, or package change remains.
The export was served from `game/out` on port 3000 and captured through named
Playwright session `m2b` at `window.innerWidth=480`,
`window.innerHeight=854`, and device pixel ratio 1.

### Reproducible DevPanel navigation

The baseline browser was opened and sized with:

```bash
playwright-cli -s=m2b open http://127.0.0.1:3000
playwright-cli -s=m2b resize 480 854
```

The initial set used `m2b`; the focused Cloaker/Scout correction used `m2c`
with the same URL and viewport. For each gameplay capture, click `DEV`, click
the exact level button, click `GOD ON` once for the session (later level
launches preserve it), click `SKIP BRIEF`, and close the panel with its exact
`X` button. The final accepted timings after that sequence were:

- W5-3: wait 3,700 ms and capture the start-hidden 15%-alpha opening wave,
  then wait another 500 ms and capture the first visible interval;
- W1-1: start a fresh level, wait 4,300 ms, then capture the fully entered
  five-Scout line;
- W4-2: start a fresh level, wait 3,400 ms, then capture the four-Wraith V;
- W6-2 visible: start a fresh level, wait 4,000 ms, then capture after the
  first 90-frame phase transition;
- W6-2 ghosted: start another fresh level, wait 3,200 ms, then capture during
  the start-hidden interval.

The same actions were issued with Playwright role locators, for example:

```js
await page.getByRole('button', { name: 'DEV' }).click();
await page.getByRole('button', { name: '5-3', exact: true }).click();
await page.getByRole('button', { name: 'SKIP BRIEF' }).click();
await page.getByRole('button', { name: 'X', exact: true }).click();
```

### Browser-session Bestiary seed and navigation

The Bestiary setup modified only the isolated Playwright session's existing
save. It contains no credential or secret. This is the complete exact storage
key and four-record payload mutation used before reload:

```js
const key = 'sector-zero-save';
const s = JSON.parse(localStorage.getItem(key) || '{}');
s.introSeen = true;
s.bestiary = {
  SCOUT: {
    enemyType: 'SCOUT',
    classId: 'swarm',
    killCount: 1,
    firstSeenWorld: 1,
  },
  CLOAKER: {
    enemyType: 'CLOAKER',
    classId: 'tech-drone',
    killCount: 1,
    firstSeenWorld: 5,
  },
  WRAITH: {
    enemyType: 'WRAITH',
    classId: 'elemental-cinder',
    killCount: 1,
    firstSeenWorld: 4,
  },
  ECHO: {
    enemyType: 'ECHO',
    classId: 'tech-drone',
    killCount: 1,
    firstSeenWorld: 6,
  },
};
localStorage.setItem(key, JSON.stringify(s));
```

After `page.reload()`, click `START MISSION` to enter the cockpit, then click
the Bestiary hotspot at canvas-relative `(370, 145)` on the first game canvas.
The seeded list order is Scout, Cloaker, Wraith, Echo. Open Scout, then close
the detail, move down once, and reopen for each subsequent enemy.

Cockpit selection is sampled by its animation loop. An instantaneous
Playwright `press Enter` can complete between frames and be missed. Hold Space
for roughly 200-350 ms before releasing it; held `Z` is the equivalent shoot/
select input in the game key map. Hold `ArrowDown` the same way between
entries, allow a release frame before the next input, and capture only when the
96x96 turntable sprite is at full horizontal magnitude rather than edge-on.
When an earlier input remained latched during automation, the actual recovery
sequence dispatched the game's existing blur reset before the next held input:

```js
await page.evaluate(() => window.dispatchEvent(new Event('blur')));
await page.waitForTimeout(300);
await page.keyboard.down(' ');
await page.waitForTimeout(300);
await page.keyboard.up(' ');
await page.waitForTimeout(200);
```

### Matching policy

Authored `scatter` formations call `Math.random()` for initial positions, so
their positions are intentionally nondeterministic. Gameplay comparisons are
state-matched by level, visible HUD wave, visibility/cloak state, unchanged
class tint, 480x854 viewport, and target count. They are not position-matched
or pixel-matched. Bestiary comparisons are matched by selected enemy, 96x96
draw contract, and full-magnitude turntable angle/state; the continuously
animated bob, glow, and rotation mean those captures are not assumed to be
pixel-identical either.

| Evidence | Level / state | Capture timing and observed contract |
|---|---|---|
| `gameplay/before-cloaker-w5-3-visible.png` | W5-3 Phantom Fleet, HUD Wave 1/11 | About 4.2 seconds after DevPanel briefing skip; all nine opening-wave Cloakers are distinct and fully inside the playfield after the first 120-frame cloak transition, with unchanged `tech-drone` tint |
| `gameplay/before-cloaker-w5-3-ghosted.png` | W5-3 Phantom Fleet, HUD Wave 1/11 | About 3.7 seconds after the same briefing skip and before the first cloak transition; the same pure nine-Cloaker opening scatter is in its unchanged start-hidden 15%-alpha state |
| `gameplay/before-scout-w1-1.png` | W1-1 First Contact, HUD Wave 1/8 | About 4.3 seconds after briefing skip; all five Scouts are fully and readably inside the playfield in the authored line under unchanged `swarm` tint |
| `gameplay/before-wraith-w4-2.png` | W4-2 The Kepler Graveyard, HUD Wave 1 | About 3.4 seconds after briefing skip; four-Wraith V visible under unchanged `elemental-cinder` tint |
| `gameplay/before-echo-w6-2-visible.png` | W6-2 Distortion Field, HUD Wave 1 | Opening six-Echo scatter after the first 90-frame phase transition; visible sprites under unchanged `tech-drone` tint |
| `gameplay/before-echo-w6-2-ghosted.png` | W6-2 Distortion Field, HUD Wave 1 | About 3.2 seconds after briefing skip during the start-hidden interval; unchanged 15% alpha makes the baseline silhouettes nearly disappear against the bright field |

For Bestiary capture, only this isolated browser session's
`sector-zero-save.bestiary` map was seeded with one discovered record for each
of the four targets. The production cockpit flow was then used to open each
detail. `bestiary/before-{cloaker,scout,wraith,echo}.png` each shows the shared
96x96 sprite draw at a full-magnitude turntable angle; every inspected capture
is broad/front-facing rather than edge-on or visibly squashed.

The complete browser session reported zero console errors. It emitted only the
same two unchanged Next.js font-preload warnings for
`fc727f226c737876-s.p.woff2` and `806de4d605d3ad01-s.p.woff2`; there were no new
gameplay, asset, or renderer warnings. The focused correction capture session
`m2c` separately reported zero console errors and zero warnings.

Console evidence was inspected after the complete capture flow with:

```bash
playwright-cli -s=m2b console warning
playwright-cli -s=m2b console error
```

The `warning` query reported `Total messages: 2 (Errors: 0, Warnings: 2)` and
listed the two font-preload messages above. The stricter `error` query reported
the same total session summary but returned zero messages at error level. The
focused correction session repeated the process with `-s=m2c`; both its
warning- and error-level queries reported zero messages.

## Cloaker production quality gate

### Cloaker attempt 1 — rejected before matte

- **Output identifier/path:** built-in generation `019f658c-f3d8-7251-8962-c1cb6978da22`, source `/Users/nichalasbarnes/.codex/generated_images/019f658c-f3d8-7251-8962-c1cb6978da22/exec-fe06809a-016f-4a6e-b9e9-10c5b88688a8.png`
- **Seed policy:** not exposed by built-in tool
- **Reference role:** no image reference input; the production original was inspected only for semantics, contracts, scale, and comparison
- **Generated source dimensions:** `1024x1536` sRGB RGB, one PNG frame
- **Generated source SHA-256:**
  `40d32a9bc7429ecfa26809b5332e44bf40d699e7cfbfad5b994d685841455dff`;
  the built-in output and preserved rejected copy are byte-identical
- **Matte:** not run because the source-footprint gate had already failed
- **Decision:** rejected; preserved as `/private/tmp/sector-zero-m2-tranche2-rejected/cloaker-attempt1-source.png`
- **Rejection reason:** portrait canvas and tall, narrow subject. Proportional
  fitting inside `633x596` would substantially underfill the available width
  and lose the required broad crescent role read; scaling it to fill the width
  would exceed and crop the permitted height.

Exact prompt:

```text
Use case: stylized-concept
Asset type: polished 2D game production asset, a single enemy billboard for a top-down vertical shooter.

Create one top-down vertical-shooter enemy sprite on a perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Keep the subject fully separated from the background with crisp edges and generous padding. Do not use #00ff00 anywhere in the subject. No cast shadow, no contact shadow, no reflection, no watermark, and no text.

Subject: CLOAKER enemy, an organic stealth hunter built around one large broken-ring or crescent silhouette. Strict orthographic or near-orthographic top-down/front-down spacecraft view, descending toward the bottom of the image. A dense dark predatory core is partly enclosed by two chunky shutter-like chitin arcs, leaving one dominant open negative-space cutout that survives reduction to a 52 by 52 gameplay draw and remains recognizable at 15 percent opacity. Add worn black membrane, scarred desaturated shell, and only a few restrained cold tech-cyan seams that suggest an invasive cloaking mechanism. One connected enemy, broad solid shape breaks, strong rim separation, no thin wisps. It must read as hollow and evasive, never as Wraith's solid reliquary or Echo's repeated plates. Centered with generous padding and no cropping.

modern DOOM (2016 / Eternal) aesthetic, gritty industrial sci-fi, heavy worn scarred
gunmetal and cracked concrete, crushed near-black shadows, very high contrast, low ambient
saturation, single hot directional key light, emissive glow accents only (hellfire orange
#ff5a1e, demon red #ff3366, toxic green #44ff99, tech cyan #00f0ff, portal purple #7800ff),
strong readable silhouette, chunky weighted forms, painterly realistic detail, game asset,
dark background separation, dramatic rim lighting

Negative prompt:
pixel art, 8-bit, 16-bit, dithering, visible pixels, cartoon, cel shading, anime, flat
colors, outline style, pastel, bright cheerful colors, saturated painted surfaces, clean new
pristine surfaces, chrome, gloss plastic, soft even lighting, washed out, low contrast, text,
letters, numbers, logos, watermark, signature, jpeg artifacts, blurry, white background halo
thin wisps, smoke body, loose particles, solid coffin, repeated afterimages, humanoid, side view, three-quarter perspective, floor, contact shadow, cast shadow, horizon, environment scene
```

### Cloaker attempt 2 — rejected after live review

- **Output identifier/path:** built-in generation `019f658c-f3d8-7251-8962-c1cb6978da22`, source `/Users/nichalasbarnes/.codex/generated_images/019f658c-f3d8-7251-8962-c1cb6978da22/exec-d646dc8d-03ad-4e97-94ce-7d528eb3853a.png`
- **Seed policy:** not exposed by built-in tool
- **Reference role:** no image reference input; the production original was inspected only for semantics, contracts, scale, and comparison
- **Generated source dimensions:** `1536x1024` sRGB RGB, one PNG frame
- **Generated source SHA-256:**
  `49351aa6a1ad1ef7247ebbd22d99bac064fa76a2b393dc5bc68330e5e478fea3`;
  the built-in output and canonical local source are byte-identical
- **Matte:** installed `remove_chroma_key.py`; border auto-key, soft matte, thresholds 12/220, despill; sampled key `#03f902`; 1,115,357 transparent and 7,323 partially transparent pixels of 1,572,864. No edge contraction was needed because dark/light inspection showed no green fringe.
- **Source matte geometry:** `1536x1024` sRGBA; 5%-alpha bounds `1009x930+238+46`; four transparent corners
- **Fitted production derivative:** `1536x1024` sRGBA, one frame, 256 alpha values; 5%-alpha bounds `633x583+452+153`; twice-center `X=1537`, `Y=889`; four transparent corners
- **Fitted rejected derivative SHA-256:**
  `b80911f70e728c082148ac3cb3145115823532ca95864083516229ec95c637e6`
  at `/private/tmp/sector-zero-m2-tranche2-sources/cloaker-production.png`
- **Decision:** rejected; the byte-identical production original was retained.
  The targeted retry corrected the portrait footprint, and its proportional fit
  was centered, uncropped, and unstretched, but it failed the live visual-role
  gate.
- **Rejection reason:** the live 15%-alpha W5-3 frame had no discernible
  Cloaker silhouettes. In the visible frame, the dominant crescent read
  predominantly as a right-facing shape rather than a hunter oriented forward
  down-screen. It therefore was not clearly better than the production
  original and could not be promoted.

Exact prompt:

```text
Use case: stylized-concept
Asset type: polished 2D game production asset, a single enemy billboard for a top-down vertical shooter.

Create one top-down vertical-shooter enemy sprite on a perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Keep the subject fully separated from the background with crisp edges and generous padding. Do not use #00ff00 anywhere in the subject. No cast shadow, no contact shadow, no reflection, no watermark, and no text.

Subject: CLOAKER enemy, an organic stealth hunter built around one large broken-ring or crescent silhouette. Strict orthographic or near-orthographic top-down/front-down spacecraft view, descending toward the bottom of the image. A dense dark predatory core is partly enclosed by two chunky shutter-like chitin arcs, leaving one dominant open negative-space cutout that survives reduction to a 52 by 52 gameplay draw and remains recognizable at 15 percent opacity. Add worn black membrane, scarred desaturated shell, and only a few restrained cold tech-cyan seams that suggest an invasive cloaking mechanism. One connected enemy, broad solid shape breaks, strong rim separation, no thin wisps. It must read as hollow and evasive, never as Wraith's solid reliquary or Echo's repeated plates. Centered with generous padding and no cropping. Targeted correction for the rejected first attempt: compose on a landscape 1536 by 1024 canvas and keep the connected subject footprint broad and approximately square, not tall or portrait, so fitting into a 633 by 596 production box does not squash or stretch it. Preserve one large clean crescent opening rather than several small perforations.

modern DOOM (2016 / Eternal) aesthetic, gritty industrial sci-fi, heavy worn scarred
gunmetal and cracked concrete, crushed near-black shadows, very high contrast, low ambient
saturation, single hot directional key light, emissive glow accents only (hellfire orange
#ff5a1e, demon red #ff3366, toxic green #44ff99, tech cyan #00f0ff, portal purple #7800ff),
strong readable silhouette, chunky weighted forms, painterly realistic detail, game asset,
dark background separation, dramatic rim lighting

Negative prompt:
pixel art, 8-bit, 16-bit, dithering, visible pixels, cartoon, cel shading, anime, flat
colors, outline style, pastel, bright cheerful colors, saturated painted surfaces, clean new
pristine surfaces, chrome, gloss plastic, soft even lighting, washed out, low contrast, text,
letters, numbers, logos, watermark, signature, jpeg artifacts, blurry, white background halo
thin wisps, smoke body, loose particles, solid coffin, repeated afterimages, humanoid, side view, three-quarter perspective, floor, contact shadow, cast shadow, horizon, environment scene
```

### Cloaker retained-original disposition

- **Static review:** exact complete-canvas `52x52` visible and 15%-alpha
  simulations were inspected on `#05070b` and `#b8b8b0`, and the candidate was
  compared with the original, Wraith, and Echo. Those isolated fields were not
  sufficient to establish replacement quality because the candidate failed
  the live gameplay gate.
- **Live blocker:** fresh cache-bypassed Playwright session `cloaker2`,
  `480x854`, W5-3 HUD `WAVE 1/11`; the pure nine-Cloaker scatter was captured
  about 3.7 seconds into the start-hidden interval and 500 ms later after the
  first 120-frame transition. The 15%-alpha frame had no discernible candidate
  silhouettes, and the visible frame read predominantly right-facing rather
  than forward down-screen. The candidate was therefore rejected.
- **Bestiary / console:** the isolated save was seeded only for discovery and
  the candidate was inspected in the production cockpit Bestiary at the shared
  `96x96` turntable draw. The session reported zero errors; four warnings were
  the same two baseline Next.js font-preload warnings repeated after reload.
- **Collision exercise:** a direct live player-contact collision exercise was
  not completed. Restoring the byte-identical production original eliminates
  any production art or collision change from this task; behavior code and
  hitboxes were never modified.
- **Evidence disposition:** the candidate-only actual-size sheet, two W5-3
  after captures, Bestiary after capture, and two matched sheets were removed.
  A non-replacement must not leave review artifacts that imply acceptance.
  All preserved `before-*` baseline evidence remains unchanged.
- **Production restoration:** `game/public/sprites/enemies/cloaker.png` was
  restored byte-for-byte from the preserved original, SHA-256
  `bcb400c45435948e3bbd9d1e43214f9bf7503092a031b2567fdaa250cdd51869`;
  `1536x1024` sRGBA, one frame, 5%-alpha bounds `633x596+452+147`,
  twice-center `X=1537`, `Y=890`.
- **Post-restoration validation:** `NEXT_PUBLIC_DEVTOOLS=1 yarn build`
  compiled, typechecked, generated six static pages, and exported three
  routes. `yarn sprites:test` passed 4/4. Corepack's tool-only root
  `packageManager` drift was restored after both runs.

### Scout attempt 1 — rejected at the static actual-size gate

- **Output identifier/path:** built-in generation
  `019f65c3-e930-7d41-b36a-8094d6abd855`, source
  `/Users/nichalasbarnes/.codex/generated_images/019f65c3-e930-7d41-b36a-8094d6abd855/exec-fc133370-6db2-42c8-a2d5-280211075f90.png`
- **Seed policy:** not exposed by built-in tool
- **Reference role:** no image reference input; the production original was
  inspected only for semantics, contracts, scale, and comparison
- **Generated source dimensions:** `1024x1536` sRGB RGB, one PNG frame
- **Generated source SHA-256:**
  `12119424cfb3b971c19fb1b87def4c34ad92c06d7450e3388f48e2d0b090451f`;
  the built-in output and preserved rejected source are byte-identical
- **Matte:** installed `remove_chroma_key.py`; border auto-key, soft matte,
  thresholds 12/220, despill; sampled key `#05f90b`; 1,223,247 transparent
  and 3,199 partially transparent pixels of 1,572,864. No edge contraction
  or BiRefNet fallback was used.
- **Source matte geometry:** `1024x1536` sRGBA, one frame; 5%-alpha bounds
  `672x1246+175+135`; four transparent corners
- **Fitted rejected derivative:** `1536x1024` sRGBA, one frame, 254 alpha
  values; 5%-alpha bounds `257x476+637+240`; twice-center `X=1531`,
  `Y=956`; four transparent corners; SHA-256
  `577bf730601daa0aa1f607b636cdd830be07e06b5e28e47764085a36d41c0a80`
- **Preserved files:** source, alpha matte, fit, and production derivative are
  retained under `/private/tmp/sector-zero-m2-tranche2-rejected/` with the
  `scout-attempt1-*` prefix.
- **Decision:** rejected; one targeted retry was justified by a concrete
  proportion and readability failure.
- **Rejection reason:** proportional fitting reduced the visible footprint to
  only about `8x22` pixels inside the exact `48x48` gameplay draw. It read as
  a weak needle or generic glowing triangle on both `#05070b` and `#b8b8b0`,
  and the production original's fin span was clearly more legible.

Exact prompt:

```text
Use case: stylized-concept
Asset type: polished 2D game production asset, a single enemy billboard for a top-down vertical shooter.
Create one top-down vertical-shooter enemy sprite on a perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Keep the subject fully separated from the background with crisp edges and generous padding. Do not use #00ff00 anywhere in the subject. No cast shadow, no contact shadow, no reflection, no watermark, and no text.
Subject: SCOUT enemy, the first and simplest fast attacker: a lean compact forward interceptor with a narrow dart-like body, two short swept structural fins, and one unmistakable down-screen attack axis. Strict orthographic or near-orthographic top-down/front-down spacecraft view, descending toward the bottom of the image. Worn desaturated industrial metal, crushed dark recesses, a restrained warm swarm-class drive seam, and only a few large panel breaks. The silhouette must remain uncomplicated and immediately legible at a 48 by 48 gameplay draw: lighter and simpler than Cloaker, Wraith, Echo, Gunner, and Drone, but not a generic glowing triangle. One connected craft, no humanoid anatomy, no guns as the code-defined Scout is unarmed. Centered with generous padding and no cropping.
modern DOOM (2016 / Eternal) aesthetic, gritty industrial sci-fi, heavy worn scarred
gunmetal and cracked concrete, crushed near-black shadows, very high contrast, low ambient
saturation, single hot directional key light, emissive glow accents only (hellfire orange
#ff5a1e, demon red #ff3366, toxic green #44ff99, tech cyan #00f0ff, portal purple #7800ff),
strong readable silhouette, chunky weighted forms, painterly realistic detail, game asset,
dark background separation, dramatic rim lighting
Negative prompt:
pixel art, 8-bit, 16-bit, dithering, visible pixels, cartoon, cel shading, anime, flat
colors, outline style, pastel, bright cheerful colors, saturated painted surfaces, clean new
pristine surfaces, chrome, gloss plastic, soft even lighting, washed out, low contrast, text,
letters, numbers, logos, watermark, signature, jpeg artifacts, blurry, white background halo
generic glowing triangle, large central orb, broad weapons barge, hollow crescent, coffin silhouette, repeated afterimage plates, gun barrels, humanoid, side view, three-quarter perspective, floor, contact shadow, cast shadow, horizon, environment scene.
```

### Scout attempt 2 — rejected at the static visual-role gate

- **Output identifier/path:** built-in generation
  `019f65c3-e930-7d41-b36a-8094d6abd855`, source
  `/Users/nichalasbarnes/.codex/generated_images/019f65c3-e930-7d41-b36a-8094d6abd855/exec-678cc52e-2718-40ec-afd7-81a62191bf50.png`
- **Seed policy:** not exposed by built-in tool
- **Reference role:** no image reference input; the production original and
  attempt 1 were inspected only for semantics, contracts, scale, and comparison
- **Generated source dimensions:** `1536x1024` sRGB RGB, one PNG frame
- **Generated source SHA-256:**
  `51b2c4121d51e6619915971f72df61dbf98bd50e1d15f4fa7ad84bed109b21f5`;
  the built-in output and canonical local source are byte-identical
- **Matte:** installed `remove_chroma_key.py`; border auto-key, soft matte,
  thresholds 12/220, despill; sampled key `#05f808`; 1,302,898 transparent
  and 2,737 partially transparent pixels of 1,572,864. No edge contraction
  or BiRefNet fallback was used.
- **Source matte geometry:** `1536x1024` sRGBA, one frame; 5%-alpha bounds
  `767x810+384+107`; four transparent corners
- **Fitted rejected derivative:** `1536x1024` sRGBA, one frame, 256 alpha
  values; 5%-alpha bounds `451x476+540+240`; twice-center `X=1531`,
  `Y=956`; four transparent corners; SHA-256
  `0241a8bfb2f07a71a3e8e4670a2f23098e15cb3be6edd3ee8718a264756f956a`
- **Preserved files:** source, alpha matte, fit, and production derivative are
  retained under `/private/tmp/sector-zero-m2-tranche2-sources/` with the
  canonical `scout-*` names.
- **Decision:** rejected; the byte-identical production original was retained.
- **Rejection reason:** the targeted retry corrected the long portrait
  footprint without stretching or cropping, but at the exact `48x48` draw its
  split upper masses read as twin gun barrels or heavy prongs. That contradicts
  Scout's unarmed, light, simplest-attacker role, and the production original
  remained clearly better.

Exact prompt:

```text
Use case: stylized-concept
Asset type: polished 2D game production asset, a single enemy billboard for a top-down vertical shooter.
Create one top-down vertical-shooter enemy sprite on a perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Keep the subject fully separated from the background with crisp edges and generous padding. Do not use #00ff00 anywhere in the subject. No cast shadow, no contact shadow, no reflection, no watermark, and no text.
Subject: SCOUT enemy, the first and simplest fast attacker: a lean compact forward interceptor with a narrow dart-like body, two short swept structural fins, and one unmistakable down-screen attack axis. Strict orthographic or near-orthographic top-down/front-down spacecraft view, descending toward the bottom of the image. Worn desaturated industrial metal, crushed dark recesses, a restrained warm swarm-class drive seam, and only a few large panel breaks. The silhouette must remain uncomplicated and immediately legible at a 48 by 48 gameplay draw: lighter and simpler than Cloaker, Wraith, Echo, Gunner, and Drone, but not a generic glowing triangle. One connected craft, no humanoid anatomy, no guns as the code-defined Scout is unarmed. Centered with generous padding and no cropping.
Targeted retry correction: the first attempt failed because its long needle-like silhouette became only about eight pixels wide at the 48 by 48 gameplay draw. Make this retry a compact interceptor footprint about 1.25 to 1.5 times as tall as it is wide, with the two short swept structural fins forming a clear shoulder span. Avoid a long spear body and avoid any silhouette narrower than half its height. Keep all other requirements unchanged and compose the isolated craft on a 3:2 landscape canvas.
modern DOOM (2016 / Eternal) aesthetic, gritty industrial sci-fi, heavy worn scarred
gunmetal and cracked concrete, crushed near-black shadows, very high contrast, low ambient
saturation, single hot directional key light, emissive glow accents only (hellfire orange
#ff5a1e, demon red #ff3366, toxic green #44ff99, tech cyan #00f0ff, portal purple #7800ff),
strong readable silhouette, chunky weighted forms, painterly realistic detail, game asset,
dark background separation, dramatic rim lighting
Negative prompt:
pixel art, 8-bit, 16-bit, dithering, visible pixels, cartoon, cel shading, anime, flat
colors, outline style, pastel, bright cheerful colors, saturated painted surfaces, clean new
pristine surfaces, chrome, gloss plastic, soft even lighting, washed out, low contrast, text,
letters, numbers, logos, watermark, signature, jpeg artifacts, blurry, white background halo
generic glowing triangle, large central orb, broad weapons barge, hollow crescent, coffin silhouette, repeated afterimage plates, gun barrels, humanoid, side view, three-quarter perspective, floor, contact shadow, cast shadow, horizon, environment scene, long needle, spear-like body, silhouette narrower than half its height.
```

### Scout retained-original disposition

- **Static review:** attempt 1 and attempt 2 were inspected at exact complete-
  canvas `48x48` on `#05070b` and `#b8b8b0`, and attempt 2 was also inspected
  at the production Bestiary's `96x96` draw. Both were compared directly with
  the production original, merged Drone, and current Echo. Attempt 1 became an
  undersized needle; attempt 2 looked armed/heavy because of its twin upper
  prongs. Neither was clearly better than the original.
- **Live gameplay / Bestiary / contact / console:** not attempted. The retry
  failed the required static visual-role interceptor, so it was never installed
  and no browser state was changed. No claim is made for candidate speed,
  formation overlap, swarm tint, unarmed behavior, contact collision, removal,
  Bestiary turntable behavior, or browser console state.
- **Evidence disposition:** no candidate-only `after-scout`, Bestiary after,
  gameplay after, or `matched/scout.png` files were created. All preserved
  `before-*` baseline evidence remains unchanged.
- **Production restoration:** `game/public/sprites/enemies/scout.png` was
  copied from the preserved original and verified byte-for-byte, SHA-256
  `cb47c0a8ba9a6e5674ae00d4303f2a12de6db3097fd7a25bd3e766170a598114`;
  `1536x1024` sRGBA, one frame, 5%-alpha bounds `602x476+465+240`,
  twice-center `X=1532`, `Y=956`.
- **Post-restoration validation:** `NEXT_PUBLIC_DEVTOOLS=1 yarn build`
  compiled, typechecked, generated six static pages, and exported three
  routes. `yarn sprites:test` passed 4/4. Corepack's tool-only root
  `packageManager` drift was restored after both runs.

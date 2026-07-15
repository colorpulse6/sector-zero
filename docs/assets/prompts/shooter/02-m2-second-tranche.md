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

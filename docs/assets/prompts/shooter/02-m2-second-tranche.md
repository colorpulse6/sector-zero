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
  footprint without stretching or cropping, but it over-corrected to an
  almost-square `451x476` fitted envelope despite the requested `1.25` to
  `1.5` tall:wide footprint. At the exact `48x48` draw its split upper masses
  read as twin gun barrels or heavy prongs. That contradicts Scout's unarmed,
  light, simplest-attacker role, and the production original remained clearly
  better.

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
  in a static simulation of the `96x96` Bestiary draw. Both were compared
  directly with the production original, merged Drone, and current Echo.
  Attempt 1 became an undersized needle; attempt 2 looked armed/heavy because
  of its twin upper prongs. Neither was clearly better than the original.
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

## Wraith production quality gate

### Wraith attempt 1 — rejected after superseding quality review

- **Output identifier/path:** built-in generation
  `019f65d8-7d10-74a0-81ca-f90ea197b34c`, source
  `/Users/nichalasbarnes/.codex/generated_images/019f65d8-7d10-74a0-81ca-f90ea197b34c/exec-1df14f9e-7787-4267-9c7e-16b99316dd16.png`
- **Seed policy:** not exposed by the built-in tool
- **Reference role:** no image reference input; the production original was
  inspected only for semantics, canvas contract, scale, and comparison
- **Generated source dimensions:** `1254x1254` sRGB RGB, one PNG frame
- **Generated source SHA-256:**
  `1fa70c15779298ee457fd1ea2e8782ea03989135058de493ac395339295a7c1c`;
  the built-in output and canonical local source are byte-identical
- **Matte:** installed `remove_chroma_key.py`; border auto-key, soft matte,
  thresholds 12/220, despill; sampled key `#03f905`; 1,004,280 transparent
  and 4,283 partially transparent pixels of 1,572,516. No edge contraction,
  retry, hand painting, or BiRefNet fallback was used.
- **Source matte geometry:** `1254x1254` sRGBA, one frame; 5%-alpha bounds
  `994x1129+127+64`; four transparent corners; SHA-256
  `d49e6d4fcc943b9218e5db77dfdc8c60813aa0392a89f12c851887fb524146a7`
- **Fit method:** crop the source matte to its 5%-alpha bounds, resize
  proportionally inside the original's `968x1284` visible envelope, center on
  a `968x1284` transparent extent, then composite at `+28+97` on the preserved
  `1024x1536` production canvas. No stretching or subject cropping was used.
- **Fitted production derivative:** `1024x1536` sRGBA, one frame, 256 alpha
  values; 5%-alpha bounds `968x1099+28+189`; twice-center `X=1024`, `Y=1477`;
  four transparent corners; SHA-256
  `a50c7392e0c5ccb258512ba6d13422b491546ab12108bb619a7bb0c72dac70b0`
- **Preserved files:** source, alpha matte, fit, and production derivative are
  retained under `/private/tmp/sector-zero-m2-tranche2-sources/` with the
  canonical `wraith-*` names.
- **Decision:** rejected. The earlier acceptance recorded by commit `8718db3`
  is superseded by the quality review below.
- **Rejection reason:** the central clear window contains a literal skull,
  face, glowing eyes, bare torso, arms, and exposed full humanoid. That is a
  direct violation of the prompt's `never as a portrait or exposed humanoid`
  constraint. The earlier matched-sheet Bestiary pair also used mismatched
  turntable angles, so it could not support an acceptance comparison.

Exact prompt:

```text
Use case: stylized-concept
Asset type: polished 2D game production asset, a single enemy billboard for a top-down vertical shooter.
Create one top-down vertical-shooter enemy sprite on a perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Keep the subject fully separated from the background with crisp edges and generous padding. Do not use #00ff00 anywhere in the subject. No cast shadow, no contact shadow, no reflection, no watermark, and no text.
Subject: WRAITH enemy, a broad heavy corrupted sarcophagus-ship containing a trapped human pilot presence. Strict orthographic or near-orthographic top-down/front-down spacecraft view, descending toward the bottom of the image. Build one wide solid cruciform or armored reliquary silhouette with a dense central coffin chamber and broad weighted side masses. Show the human-scale containment cue only as a recessed shape behind cracked dark material, never as a portrait or exposed humanoid. Scorched desaturated armor, organic hull intrusion, crushed near-black recesses, and restrained cinder-orange light leaking through a few cracks and vents. It must remain a broad solid threat at a 56 by 52 gameplay draw, clearly heavier than Scout and Echo and never hollow like Cloaker. Centered with generous padding and no cropping.
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
letters, numbers, logos, watermark, signature, jpeg artifacts, blurry, white background halo,
wispy ghost, smoke body, hollow crescent, repeated afterimages, exposed human portrait, bright orange painted armor, sleek fighter, side view, three-quarter perspective, floor, contact shadow, cast shadow, horizon, environment scene
```

### Wraith attempt 1 superseding review and disposition

- **Superseding static review:** the broad cruciform, weighted side masses,
  cinder cracks, and dense center survived complete-canvas `56x52` dark/bright
  Cinder simulations and a complete-canvas `96x96` draw. However, inspection
  of the full generated source exposed a literal skull, face, glowing eyes,
  bare torso, arms, and full humanoid behind a clear window. Reduced-size
  readability does not waive that explicit semantic gate; the candidate is
  rejected.
- **Live gameplay:** a fresh cache-bypassed `480x854` browser session entered
  W4-2 and captured Wave 1/10 with all four Wraiths in the intended V. The
  complete-canvas `56x52` draws remain distinct across dark and brighter
  starfield areas, retain the Cinder tint, descend slowly as a formation, and
  visibly fire their existing red projectiles. The dark rectangular tint
  fields also appear in the unchanged before baseline and are existing
  renderer behavior, not an asset regression.
- **Contact limitation:** a deliberate GOD-off ArrowUp pass visibly aligned
  and overlapped the player with a Wraith. The player had already received
  projectile damage and was in its existing hit/invulnerability sequence; all
  four Wraiths remained through the overlap, and a later player explosion
  cannot be attributed specifically to contact. A clean rerun reached Game
  Over behind the open DEV panel before the timed input. This gate therefore
  proves visible sprite/contact alignment only. It does **not** prove
  collision-specific removal or claim zero collision regression beyond the
  unchanged draw contract and unchanged collision/code paths.
- **Bestiary evidence:** the earlier before/after pair was later found to use
  mismatched turntable angles. It is discarded as acceptance evidence. The
  existing `BEHAVIOR: Pursuit, phasing` copy is a pre-existing mismatch with
  implemented behavior and was deliberately not used as art direction or
  edited in this art-only tranche.
- **Console:** the final fresh gameplay and Bestiary sessions each reported
  zero browser console errors and zero warnings.
- **Evidence disposition:** the candidate-only files
  `docs/assets/reviews/m2-shooter-enemies-2/actual-size/after-wraith.png`
  (`960x476`),
  `docs/assets/reviews/m2-shooter-enemies-2/gameplay/after-wraith-w4-2.png`
  (`480x854`),
  `docs/assets/reviews/m2-shooter-enemies-2/bestiary/after-wraith.png`
  (`480x854`), and the true four-panel matched sheet
  `docs/assets/reviews/m2-shooter-enemies-2/matched/wraith.png`
  (`2200x1900`) were removed after rejection. Baseline `before-*` evidence is
  retained. No attempt-1 after or matched artifact remains at HEAD.
- **Historical validation:** `yarn sprites:test` passed 4/4. A fresh
  `NEXT_PUBLIC_DEVTOOLS=1 yarn build` compiled, typechecked, generated six
  static pages, and exported three routes. Corepack's tool-only root
  `packageManager` drift was restored after both runs.

### Wraith attempt 2 — targeted reference edit, not accepted

- **Reference role:** the attempt-1 generated source
  `/private/tmp/sector-zero-m2-tranche2-sources/wraith-source.png`, SHA-256
  `1fa70c15779298ee457fd1ea2e8782ea03989135058de493ac395339295a7c1c`,
  was supplied as the edit target and silhouette/geometry reference. The
  preserved production original remained a contract and comparison reference;
  it was not an image input.
- **Invocation history:** the initial built-in reference-edit invocation used
  the exact prompt below but produced neither an artifact nor an error after
  the practical timeout and was terminated after roughly six minutes. It has
  no output ID or source path. One explicitly authorized fresh invocation then
  reused the identical prompt and reference and succeeded.
- **Successful output identifier/path:** built-in output
  `exec-f8531636-6934-4e1d-ac24-3224300278f7.png`, source
  `/Users/nichalasbarnes/.codex/generated_images/019f65d8-7d10-74a0-81ca-f90ea197b34c/exec-f8531636-6934-4e1d-ac24-3224300278f7.png`.
- **Seed policy:** not exposed by the built-in tool.
- **Generated source:** `1254x1254` sRGB RGB, one PNG frame; SHA-256
  `ec33e8ee82c17e77bf8dea106b6fe962be6e21e0d3fbcffb8bed9920314cf42c`.
  The built-in output and preserved
  `/private/tmp/sector-zero-m2-tranche2-sources/wraith-attempt2-source.png`
  are byte-identical.
- **Matte:** installed `remove_chroma_key.py` with the same border auto-key,
  soft-matte, thresholds 12/220, and despill pipeline as attempt 1; sampled key
  `#13e613`; 1,005,126 transparent and 3,994 partially transparent pixels of
  1,572,516. The source matte is `1254x1254` sRGBA, one frame, with 5%-alpha
  bounds `993x1129+127+64`, four transparent corners, and SHA-256
  `535792477f4e9d3e8efe65f568b4214713035ae5eb40b87b0bbd16ece212ff76`.
- **Fit method:** crop the matte to its 5%-alpha bounds, resize
  proportionally inside the original's `968x1284` visible envelope, center on
  a `968x1284` transparent extent, then composite at `+28+97` on the preserved
  `1024x1536` canvas. The intermediate fit SHA-256 is
  `453f3f73feca9e17ace9a3f090dc6f6fe51321ea52e2cd3ae829216e696be78e`.
- **Fitted production derivative:** `1024x1536` sRGBA, one frame;
  5%-alpha bounds `968x1101+28+188`; twice-center `X=1024`, `Y=1477`; four
  transparent corners; SHA-256
  `0d57dde688e04dda4f703941b703be9e04cfdafccdad32216166a7734d8fd378`.
- **Full-source semantic gate:** passed. The broad cruciform/reliquary and
  weighted side masses remain, while the center is an opaque cracked plate.
  No identifiable skull, face, eyes, skin, torso, body, limbs, anatomy, glass
  display, or exposed pilot remains.

Exact reference-edit prompt used for both invocations:

```text
Use case: precise-object-edit
Asset type: polished 2D game production asset, a single enemy billboard for a top-down vertical shooter.
Input images: Image 1: edit target and silhouette/geometry reference.
Primary request: Make one targeted correction to Image 1 while preserving its successful broad reliquary design.
Create one top-down vertical-shooter enemy sprite on a perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Keep the subject fully separated from the background with crisp edges and generous padding. Do not use #00ff00 anywhere in the subject. No cast shadow, no contact shadow, no reflection, no watermark, and no text.
Subject: WRAITH enemy, a broad heavy corrupted sarcophagus-ship containing a trapped human pilot presence. Strict orthographic or near-orthographic top-down/front-down spacecraft view, descending toward the bottom of the image.
Targeted retry invariants and corrections: Preserve the broad solid cruciform/reliquary outer silhouette, weighted side masses, exact top-down/front-down down-screen orientation, and restrained cinder crack layout from Image 1. Change the central chamber only: replace the clear glass window and literal visible skull, face, glowing eyes, bare torso, arms, and full body with an OPAQUE cracked dark sarcophagus plate. No face, skull, eyes, skin, body, limbs, anatomy, portrait, glass display, or exposed humanoid. Human presence may be suggested only by an ambiguous recessed human-scale head-and-shoulder depression, rib-like shadow, or biometric silhouette BENEATH opaque scarred material; it must not be identifiable as a person. Any current skull-like surface motif must become ambiguous organic or mechanical intrusion without changing the outer geometry. Slightly raise desaturated midtone separation on the coffin recess and inner rim so the reliquary center survives the unchanged #cc6644 multiply tint at 56 by 52, without painting armor orange or increasing emissive coverage. Keep the uniform chroma background, no floor, shadow, reflection, or scene, centered and padded. The only semantic correction is eliminating literal humanoid and skull imagery; do not redesign the outer craft.
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
letters, numbers, logos, watermark, signature, jpeg artifacts, blurry, white background halo,
wispy ghost, smoke body, hollow crescent, repeated afterimages, exposed human portrait, bright orange painted armor, sleek fighter, side view, three-quarter perspective, floor, contact shadow, cast shadow, horizon, environment scene,
skull, face, eyes, glowing eyes, skin, bare torso, arms, legs, full human body, anatomy, portrait, glass coffin, transparent window, exposed pilot, orange painted armor
```

### Wraith attempt 2 review and final retained-original disposition

- **Static review:** complete-canvas `56x52` dark and bright simulations with
  the production Cinder-Wraith multiply tint (`#cc6644` at 0.35 alpha) passed.
  The opaque center, inner rim, broad reliquary, and restrained cinder cracks
  also survive a complete-canvas `96x96` simulation. The deterministic
  Bestiary simulations resized the complete preserved original and complete
  retry production canvas exactly to `96x96`, with no alpha crop or horizontal
  compression and the same neutral presentation.
- **Retry gameplay:** a fresh `480x854` DevPanel build entered W4-2 The Kepler
  Graveyard and captured HUD WAVE 1/10 with all four retry Wraiths in the
  intended V. Their Cinder tint, slow descending formation, readable centers,
  and existing red projectile fire were visible. This proves the unchanged
  gameplay draw/state contract only; it is not collision-specific evidence.
- **Retry Bestiary blocker:** mandatory live detail verification was not
  completed. Multiple earlier automation runs that remained on the isolated
  WRAITH list were invalid and discarded. The final code-traced run entered
  Bestiary through the mouse hotspot, held ArrowDown for 120 ms, released it,
  waited 350 ms for a neutral cockpit tick, held Enter for 200 ms, released it,
  and waited 500 ms. It still remained on the isolated WRAITH list instead of
  opening detail. No alternate final key attempt was made. The final session
  reported zero console errors and zero warnings.
- **Validation:** the retry passed `yarn sprites:test` 4/4 and a fresh
  `NEXT_PUBLIC_DEVTOOLS=1 yarn build`. These gates do not substitute for the
  missing mandatory live Bestiary detail verification.
- **Decision:** not accepted. Under the fail-closed evidence policy, the
  preserved production original is retained. Temporary deterministic `96x96`
  simulations are not committed, and no candidate-only after or matched sheet
  remains. All baseline `before-*` evidence remains.
- **Retained original:**
  `/private/tmp/sector-zero-m2-tranche2-originals/wraith.png` was restored
  byte-for-byte to `game/public/sprites/enemies/wraith.png`; SHA-256
  `b0c3198822dae2410922b4e59f52c8c1fa404081bc8a52c900a863f45331c241`;
  `1024x1536` sRGBA, one frame; 5%-alpha bounds `968x1284+28+97`;
  twice-center `X=1024`, `Y=1478`; four transparent corners.
- **Runtime disposition:** production is identical to the pre-task original,
  so there is no Wraith sprite, registration, draw, collision, behavior,
  spawn, mechanic, statistic, balance, or runtime delta.
- **Post-restoration validation:** with the original restored,
  `yarn sprites:test` passed 4/4 and
  `NEXT_PUBLIC_DEVTOOLS=1 yarn build` compiled, typechecked, generated six
  static pages, and exported three routes. No package-manager drift remained.

## Echo production quality gate

### Echo attempt 1 — rejected at the mandatory live Bestiary gate

- **Output identifier/path:** built-in generation
  `019f6670-5b36-7d92-86d0-694268c55d80`, source
  `/Users/nichalasbarnes/.codex/generated_images/019f6670-5b36-7d92-86d0-694268c55d80/exec-7ca19769-a7b4-4cc7-b175-487443e7e27c.png`.
- **Seed policy:** not exposed by the built-in tool.
- **Reference role:** no image reference input; the production original was
  inspected only for semantics, contracts, scale, and comparison.
- **Generated source:** `1254x1254` sRGB RGB, one PNG frame; SHA-256
  `07c4fe09c4330dd696ecbb131a06480fe653fb04787d12c2d68d457a5998f43d`.
  The built-in output and canonical
  `/private/tmp/sector-zero-m2-tranche2-sources/echo-source.png` are
  byte-identical.
- **Matte:** installed `remove_chroma_key.py`, invoked with the already
  installed rembg pipx Python because the system Python lacked Pillow; border
  auto-key, soft matte, thresholds 12/220, and despill; sampled key `#0df60a`;
  967,379 transparent and 4,397 partially transparent pixels of 1,572,516.
  No edge contraction, hand painting, or BiRefNet fallback was used.
- **Source matte:** `1254x1254` sRGBA, one frame; 5%-alpha bounds
  `956x1079+149+82`; four transparent corners; SHA-256
  `77d031b4e3daaf62484de7811ea6386d9d9cab4be7440d9fba46168b05729786`.
- **Fit method:** crop the matte to its 5%-alpha bounds, resize proportionally
  inside the original's `1037x895` visible envelope, center on a `1037x895`
  transparent extent, then composite at `+258+49` on the preserved
  `1536x1024` production canvas. No stretching or subject cropping was used.
- **Fitted candidate derivative:** `1536x1024` sRGBA, one frame, 256 alpha
  values; 5%-alpha bounds `793x895+380+49`; twice-center exactly `X=1553`,
  `Y=993`; four transparent corners; SHA-256
  `7792dd06f55d200df43084d7acd06b487e16058a3b1b350318967100701b276e`.
  Dark and bright inspection showed no green fringe, halo, floor, reflection,
  cast shadow, or contact shadow.
- **Iteration decision:** no retry. The one generated candidate had no concrete
  static defect that justified blind iteration; it advanced to live review.
- **Decision:** rejected. The mandatory one-attempt live Bestiary detail gate
  did not open, so the byte-identical production original was restored and no
  candidate-only after or matched evidence was retained.

Exact prompt:

```text
Use case: stylized-concept
Asset type: polished 2D game production asset, a single enemy billboard for a top-down vertical shooter.

Create one top-down vertical-shooter enemy sprite on a perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Keep the subject fully separated from the background with crisp edges and generous padding. Do not use #00ff00 anywhere in the subject. No cast shadow, no contact shadow, no reflection, no watermark, and no text.

Subject: ECHO enemy, a compact phase craft assembled from one stable dark core and two or three visibly displaced repeating armor masses. Strict orthographic or near-orthographic top-down/front-down spacecraft view, descending toward the bottom of the image. The repeated plates overlap and remain physically connected, forming a chunky offset silhouette that communicates delayed pattern mimicry without loose particles or scanline effects. Use worn desaturated tech surfaces, crushed dark gaps, restrained cold tech-cyan seams with a few muted warm phase seams, and large simple value breaks. It must read as one compact connected enemy at a 44 by 44 gameplay draw and remain recognizable at 15 percent opacity. Avoid Scout's clean dart, Cloaker's hollow crescent, and Wraith's solid coffin mass. Centered with generous padding and no cropping.

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
loose particles, disconnected copies, thin scanlines, motion blur, transparent smoke, simple triangular fighter, hollow crescent, solid coffin, humanoid, side view, three-quarter perspective, floor, contact shadow, cast shadow, horizon, environment scene.
```

### Echo retained-original disposition

- **Static review:** the fitted candidate passed exact complete-canvas `44x44`
  visible and 15%-alpha simulations on `#05070b` and `#b8b8b0`, plus a static
  simulation of the complete-canvas `96x96` Bestiary draw. Its connected,
  staggered armor masses remained attached around one stable dark core; the
  visible and ghosted silhouettes were more readable than the production
  original and did not read as Scout's triangle, Cloaker's crescent, or
  Wraith's coffin.
- **Candidate validation:** after temporary installation,
  `yarn sprites:test` passed 4/4. The first sandboxed invocation could not
  create tsx's local IPC socket (`listen EPERM`); the identical approved
  outside-sandbox invocation passed. `NEXT_PUBLIC_DEVTOOLS=1 yarn build`
  completed successfully, and the fresh export served the candidate at
  `480x854`.
- **Live gameplay:** W6-2 Distortion Field HUD `WAVE 1/10` was launched twice
  from the fresh DevPanel export. At about 4.0 seconds after briefing skip,
  the six-Echo scatter was visible as three random overlap groups with the
  candidate's connected displaced-cluster silhouette, unchanged dark/cyan
  `tech-drone` tint, lateral offsets, and visible purple enemy fire. At about
  3.2 seconds after a fresh launch, the start-hidden 15%-alpha craft nearly
  disappeared against the bright field, consistent with the baseline, and no
  enemy fire was visible. These observations prove the draw/state presentation
  only; they do not prove collision behavior.
- **Contact limitation:** a deliberate player-contact pass was not attempted
  after the mandatory Bestiary gate failed. No claim is made for candidate
  collision-specific removal or pass-through. The draw canvas, hitbox, phase
  code, collision code, registration, and statistics were never changed, and
  restoration removes every production art delta.
- **Mandatory Bestiary blocker:** the documented four-entry isolated save was
  seeded in `Scout, Cloaker, Wraith, Echo` order. The production cockpit
  Bestiary was entered by its mouse hotspot; three held ArrowDown inputs
  selected Echo; after a neutral tick, one held-Space input was issued for 300
  ms and released. The UI remained on the Echo list row instead of opening the
  96x96 detail. Per the one-controlled-attempt rule, no Enter retry or loop was
  attempted. Live Bestiary use was therefore not verified.
- **Console:** the final session reported zero browser console errors and two
  warnings, both the unchanged Next.js font-preload warnings for
  `fc727f226c737876-s.p.woff2` and `806de4d605d3ad01-s.p.woff2`.
- **Evidence disposition:** temporary candidate files
  `actual-size/after-echo.png`, `gameplay/after-echo-w6-2-visible.png`,
  `gameplay/after-echo-w6-2-ghosted.png`, `bestiary/after-echo.png`,
  `matched/echo-visible.png`, and `matched/echo-ghosted.png` do not remain.
  All preserved `before-*` evidence remains unchanged. The Playwright session,
  local server, and `.playwright-cli` metadata were removed.
- **Production restoration:** `game/public/sprites/enemies/echo.png` was
  restored byte-for-byte from the preserved original, SHA-256
  `dc4a2532e68ef83225b9f30b5c32bb054f339796b06e8942ccdd4c5a5bf3cf4d`;
  `1536x1024` sRGBA, one frame; 5%-alpha bounds `1037x895+258+49`;
  twice-center `X=1553`, `Y=993`; four transparent corners.
- **Post-restoration validation:** against the restored original,
  `yarn sprites:test` passed 4/4 and a fresh
  `NEXT_PUBLIC_DEVTOOLS=1 yarn build` compiled, typechecked, generated six
  static pages, and exported three routes. Corepack's tool-only package drift
  was restored after verification.

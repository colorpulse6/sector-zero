# Fighter battle presentation polish — handoff (2026-10-19)

Branch `design/fighter-battle-polish` (base `dc35da2`). Scope: top-down fighter
(vertical shooter) presentation only. No gameplay, save, economy, controls,
Game.tsx, shared types or build config changes.

## Root causes found (VERIFIED on the fighter inspection route)

| Symptom reported | Cause | Evidence |
|---|---|---|
| "Some dimming happening" | The WebGL grade pass used the `COMBAT` preset for `shooter` (black point 0.05, contrast 1.22, brown split-tone, vignette 0.24). On a star field it crushes the backdrop. | Game-area mean luminance 18 → 6, near-black pixels 39% → 92% (before, raw vs graded). |
| Dim/hazy look even with grade off | Mid/near asteroid plates were drawn at 15% / 8% opacity: light-grey dust at low alpha reads as fog over the stars. | `before/showcase-raw.jpg` |
| "Graphics are quite shit" (tiny, squashed enemies) | Enemy PNGs are 1536×1024 cards whose ship occupies ~30–40% of the frame; the renderer drew the whole card into a 32–56px box, so a Drone was ~9×13px and 3:2 squashed. | `before/live-w1l1-f660.jpg` scouts at top |
| "Borders around enemies" | Class tint was a `multiply` `fillRect` over a 4px-padded box. Canvas blend modes paint the source colour wherever the destination is transparent, so a 35% tinted rectangle appeared around every silhouette. | `before/showcase-raw.jpg` (shielder/elite), new browser spec |
| Player shots look like half an arrow | `player-bullets.png` items are not on an equal 4-column grid (large crystal spans the frame-1/2 boundary). Level-3 shots drew the right half of the diamond. Same misalignment in `enemy-bullet.png` and `powerups.png`. | column-gap probe: items at x 350–407, 500–917, 963–1423 |
| "Background repeating" | All three plates had the same 720px tile period at canvas width; mirror-tiled with nothing else moving, the loop is obvious every screen height. | `before/showcase-raw-scroll-1200.jpg` |

Intentional overlays left alone: briefing dim (0.7), boss intro dim (0.8), level-complete banner, bomb flash, invincibility blink, cloaked enemies at 15%.

## What changed (WRITTEN + RUNS; art is candidate until Nic reviews at runtime)

New `game/app/components/engine/fighterSprites.ts`
- Alpha-trimmed content cells per sprite, sheet cells found by alpha column gaps (`sliceColumns`, closest-gap merge, equal-column fallback).
- Halo cleanup (alpha ≤ 28 cleared), clipped `source-atop` class tint, cached ≤192px cells.
- Cached radial glow discs + tapered streaks replace every per-draw `shadowBlur`.

`enemies.ts` (draw only): aspect-fitted silhouettes inside the hit box, dark separation halo, clipped class tint (22%), 8-frame white hit flash from `lastHitTimer`, HP bar anchored above the drawn art. No padded rectangle.

`background.ts`: far plate mirror-tiled as before; live star field drawn on top (three speeds, nearest as streaks); mid/near plates scaled 1.2× / 1.45× (periods 864 / 1044px vs far 720px), shaded at cache time (more for bright plates such as Cryon ice), honest opacity 34% / 46%, slow horizontal sway. Plates cached at draw size (1:1 blits). `planMirrorTiles` / `plateTilePeriod` exported for tests.

`weapons.ts`: bullets drawn from alpha-sliced cells, rotated to velocity (missile frame points right in the sheet, crystals up), additive glow + streak. `drawEnemyBullets` gained an optional `frameCount` for orb/acid spin.

`particles.ts`: additive embers/trails/sparks with streaks; sprite explosions use sliced cells, additive flash + shock ring on the fire frames, normal blending for the fireball art, smoke fades out.

`renderer.ts`: twin-nozzle additive exhaust (`drawPlayerExhaust`), trimmed player hull with separation halo, power-up icons from sliced cells with a glow pulse, boss drawn trimmed with halo and additive weak-point glow, side gunners without `shadowBlur`.

`postFx/presets.ts` — **outside the listed ownership, flagged for Manager**: new `SPACE` preset mapped to `shooter` only (black point 0, contrast 1.06, cool shadows, bloom 0.5, vignette 0.06). One preset + one map line; revert by mapping `shooter` back to `COMBAT`. Turret/base-defense/mech-duel still use `COMBAT`.

Harness: `game/app/fighter-preview/` + `game/app/components/FighterPreview.tsx` — real `drawGame`/`updateGame`, seeded `Math.random`, scenes Showcase / Live W1-1 / Rockjaw, backdrop world select, grade toggle, frame stepping, `window.__fighterPreview` for specs. No save access.

## Tests

- `tests/engine/fighterPresentation.test.ts` (7): column slicing incl. the real bullet-sheet shapes, contain-fit, mirror-tile contiguity, distinct plate periods, and a recording-context regression that `drawEnemies` never uses `multiply` or a padded fill.
- `tests/browser/fighterPolish.spec.ts` (@keyboard, 2): renders/scrolls every scene with no page errors or 404 sprites and writes captures when `FIGHTER_CAPTURE_DIR` is set; pixel probe at sprite-box corners is identical with and without enemies (tint-rectangle regression).
- Full engine suite: 610 tests, 610 pass (one pre-existing composition test needed the spark pixel to stay at `(p.x, p.y)`; kept that contract).
- `tsc --noEmit` clean; `next build` static export succeeds (`/fighter-preview` exported). No ESLint config exists in the repo, so lint was not run.

## Performance / readability limits

- Free-running `drawGame` cost (headless Chromium, 480×854): p50 0.4ms, p95 0.5ms in both live W1-1 and the Rockjaw fight. First use of a sprite prepares its cells (boss 512px cell, three plates): a one-off spike of ~16–18ms on that frame.
- Caches: ≤192px cells per (sprite, tint), plates at draw size with a 6-entry LRU (~6MB per world).
- Cryon (world 2) stays bright because its far plate is bright ice; enemies read via the dark halo but the scene is high-key. If Nic wants it darker, a per-world far-plate shade is a one-line follow-up in `background.ts`.
- The "RESISTED" floating labels (`floatingLabels.ts`, not in scope) stack large grey text over the fight; worth a pass by whoever owns them.
- Asset request: none required. Should Nic want higher-fidelity thrusters or a dedicated muzzle flash, those would be new raster art (not available here).

## How to play it

```bash
cd game && WATCHPACK_POLLING=true yarn dev --hostname 127.0.0.1 --port 3211
# open http://127.0.0.1:3211/fighter-preview/   (inspection route, no save)
# or the game itself: DevPanel → LEVEL SELECT → 1-1 / 1-5 (boss)
```

Captures: `docs/assets/fighter-polish/before/*.jpg` vs `after/*.jpg` (same scenes, same seeded frames; `after/render-timing.json`).

Residual risk: the grade preset edit sits outside my listed files; the asteroid opacities are a taste call Nic should confirm in motion.

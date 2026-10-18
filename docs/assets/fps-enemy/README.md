# First-person hostiles: first family refresh

Date: 2026-10-18. Lane: Claude (FPS enemy art). Branch `design/fps-enemy-refresh`, base `183cbda`.
Request (Nic, via Manager): "the monsters in fps view, they are shit. make them better."

Commits on this branch:

| Commit | Scope | Owner |
| --- | --- | --- |
| `2f4a06a` | Hostile framing data, atlas-matched fallback stills, presentation and asset tests, `@visual` capture spec | this lane (owned files only) |
| `5c14f8d` | Renderer consumption: `ground` billboard anchor, per-type scale, death-opacity hold, tests | renderer integration for the Manager, kept separate so it can be accepted, amended or dropped |
| this commit | this document, comparison sheets, capture logs, capture-spec timing (freeze after each shot) | this lane |

Evidence rungs used below: **WRITTEN** (exists in source), **RUNS** (executed here, result quoted),
**VERIFIED** (checked against an independent artefact: a capture, a pixel comparison or a test),
**direct check** (a file measurement, never gameplay evidence).

## Verdict in one paragraph

The shared hostile atlas (`game/public/sprites/actors/hostile/`, 256×256 cells, eight directions,
idle/walk/attack/hurt plus a six-frame death, authored in `docs/assets/actor-motion/`) is sound art
inside the master style guide: angular fractured carapace, ember eyes and chest core, a silhouette
that still reads at 48 px. What made it look bad in play was framing, not pixels. In the real
first-person viewport the creature was drawn centred on the horizon so it floated a fifth of a
wall height above the floor, at half a wall height tall, with all three hostile types identical,
with the legacy fallback a different creature squashed 1.5:1, with the death fading from its first
frame, and with grunts walking into the camera so the attack and the death happened inside the
near-plane cull. This slice fixes the floating, the size, the type identity, the fallback and the
death fade with existing art, proves it with before/after captures from the actual renderer, and
hands the Manager the one engine change (hold at contact range) that attack readability for
chargers and grunts still needs. Regenerating the art would not have fixed any of this.

## Manager integration addendum — 2026-10-18

All three lane commits are integrated on `feat/galaxy-colony` as `3adf04c`, `fe3a525`
and `cb56280`. The historical diagnosis and lane handback below describe their original scope.
The manager also clamped grunt/charger approach steps at 0.45 tiles and explicitly faces the
player on a stationary melee attack. Contact range, damage and cadence are unchanged. Tests
cover both enemy types at maximum catch-up time, continued damage, and pursuit after retreat.

Final integrated checks: 1025 unit tests, TypeScript and static export pass. A fresh isolated
Kepler capture has no page errors and shows the grunt's attack at 0.45 tiles, visible in the
actual viewport: [`integrated-attack-0.png`](captures/integrated-attack-0.png), with state in
[`integrated-log.json`](captures/integrated-log.json). The later death capture is at 0.21 tiles
after the preview player resets position, so it does not establish death readability at the
normal hold distance; the sentry death comparisons below remain the visual evidence for the
opacity change. The close-up still shows the existing 256-pixel atlas resolution. Distinct
charger/sentry art and outdoor aesthetic acceptance remain future work.

## Before and after (RUNS, VERIFIED by the sheets in `captures/`)

Same scene (Kepler ruins on the `/graphics-preview` route), same harness
(`game/tests/browser/fpsEnemyCaptures.spec.ts`), same static export served by `python3 -m http.server`.
Distances and clip clocks come from the preview's state snapshot at capture time; every run's log is
in `captures/<tag>-<hostile>-r<run>-log.json` and each sheet names the runs it was composed from.
The before side was captured from a build of `183cbda` (`game/app` checked out at that commit, then
restored), the after side from a build of `5c14f8d`.

| Sheet | Hostile | Range | Before `183cbda` | After `5c14f8d` |
| --- | --- | --- | --- | --- |
| `compare-grunt-near.jpg` | grunt, idle, paused | 1.4 tiles | floats mid-door at about a third of the wall height | stands in the doorway on the floor, 0.79 wall heights tall |
| `compare-grunt-mid.jpg` | grunt, walking | 1.65 → 1.25 tiles | hovering toy in a doorway, feet far above the floor | grounded, fills the doorway, coming at the player |
| `compare-grunt-far.jpg` | grunt, walking | 2.41 → 2.04 tiles | a faint dark shape high on the left wall | a grounded figure at the corridor corner, horns and eyes readable |
| `compare-sentry-near.jpg` | sentry, idle, paused | 0.7 tiles | detailed and hostile, feet on the floor by coincidence of range | fills the view (sentry scale 1.15 × 1.6) |
| `compare-sentry-mid.jpg` | sentry, idle, paused | 1.99 → 1.94 tiles | floating, half a wall height | 0.9 wall heights, standing in the junction |
| `compare-sentry-attack.jpg` | sentry, attack frame 0 (clock 75 / 59 ms, unfrozen) | 1.85 tiles | arms-out strike visible but floating and small | the same strike on the floor at full size |
| `compare-sentry-hurt.jpg` | sentry, hurt frame (clock 92 / 84 ms, unfrozen) | 1.85 tiles | recoil visible, floating | recoil on the floor, HP bar above the head |
| `compare-sentry-death.jpg` | sentry, death frozen at clock 267 ms (timer 14 of 30) | 1.85 tiles | drawn at 14/30 alpha: a translucent ghost | drawn opaque; the fade starts only at timer 10 |

The final harness revision (`after-sentry-r5-log.json`) freezes the simulation right after each
shot and captured both the hurt recoil and the death at clip clock 157 ms on the sentry; the sheets
above use the earlier runs so that before and after share a clock.

What the sheets do not show: the grunt's own attack and death. In both runs the grunt walked into
the camera (distance 0.00 to 0.03 at the attack and death captures, see `captures/*-grunt-log.json`)
and was culled by the near plane. That is the engine's movement rule, not framing; the fix is in the
integration section.

## Diagnosis (SOURCE-REVIEWED on `183cbda`, measurements are direct checks)

Renderer math (`fpRender/renderCore.ts`): a billboard's height is `h / depth × 0.6 × scale`;
walls are `h / depth`. A `center` anchor puts the billboard's bottom at `half + 0.3·wallH`, while
the floor at that depth is at `half + 0.5·wallH`. The hostile's feet sit at row 237 of its 256 cell,
so the creature's feet hung `0.2·wallH + 19/256·size` above the floor: 87 px at two tiles on the
714 px frame. Its visible body spans 211 of 256 rows, so at `scale 1` it stood 0.49 wall heights
tall, shorter than a colonist reads at the `npc` anchor.

Cell framing (direct check, `magick -trim` over every cell): idle 184×211 at rows 26–237, walk
rows 26–242, attack rows 28–237, hurt rows 41–237, death rows 28–243 (the slump drops the foot
line six rows). Mean alpha coverage of a standing cell is 0.29.

Legacy fallback (`sprites/boarding/enemy-fp-front.png`, 1536×1024): the subject is 603×697 inside
a 1.5:1 canvas that the registry decodes to 512×512, so the fallback creature rendered thin, small
and horizontally squashed, and it was a different design from the atlas. The atlas loads only when
a level with enemies starts (`syncActorAssets` from the updater), so the fallback is what the
player sees in the first frames of every fight.

Attack cadence (`firstPersonEngine.ts`): contact attacks trigger once per 60-frame invincibility
window, so the 400 ms attack clip plays fully; no restart bug. Grunts and chargers keep stepping
toward the player below the 0.5-tile contact range, overshoot, and oscillate through the camera
position; the renderer culls anything closer than 0.1 tiles. Death: `alpha = deathTimer/30`, so the
six-frame collapse (480 ms) was drawn at 50 % opacity by its third frame.

Lighting: `shade()` multiplies every texel by the light grid and fogs by 0.08 per tile, so the
emissive eyes and core darken with the carapace; at 2.4 tiles in a dark corridor the before capture
shows a grey smudge. Frames have no mip levels (tiles do), so a far hostile is nearest-sampled
from 256 px.

Identity: grunt, charger and sentry all draw the same atlas at the same size.

## What changed

Owned commit `2f4a06a` (WRITTEN, RUNS: typecheck clean, engine 575/575, sprites 17/17, colony 405/405):

- `engine/actorAssets.ts`: `ActorPresentation { scale, groundLine }` on the hostile set
  (`HOSTILE_PRESENTATION = { scale: 1.6, groundLine: 237/256 }`) and
  `enemyBillboardPresentation(enemy)` with `HOSTILE_TYPE_SCALE = { grunt: 1, charger: 0.9, sentry: 1.15 }`.
  Scale 1.6 makes the cell span 0.96 wall heights and the creature 0.79; a sentry reads 0.9, a
  charger 0.71. Unknown types fall back to the grunt framing.
- `engine/sprites.ts`: `FP_ENEMY_FRONT/FLINCH/DEATH` now point at
  `sprites/actors/hostile/fallback-{front,hurt,death}.png`, exact 256×256 crops of the atlas
  (idle row 0 col 0, hurt row 0, death col 5; `magick compare -metric AE` = 0 against the cells,
  direct check; also asserted pixel-for-pixel by `tests/sprites/fpsEnemyFallbackAssets.test.ts`,
  VERIFIED). The crops are geometric extractions of accepted art; no pixels were painted. The
  retired boarding billboards stay on disk because the actor-motion provenance records and the
  render script reference them (see parked problems).
- Tests: `tests/engine/fpsEnemyPresentation.test.ts` (framing contract, type ordering, no framing
  on colonists), `tests/sprites/fpsEnemyFallbackAssets.test.ts`,
  `tests/browser/fpsEnemyCaptures.spec.ts` (`@visual`; no default project greps it).
- `engine/actorPresentation.ts` is unchanged on purpose: attack, hurt and death windows already
  match the clips (400/180/480 ms against a 500 ms death timer) and the sentry's facing is set by
  the engine when it fires.

Renderer integration `5c14f8d` (WRITTEN, RUNS: same suites; the shared `graphicsPreview.spec.ts`
passes 4/4 against the rebuilt export, including its hostile attack/hurt/death cell check):

- `fpRender/sceneInput.ts`: `BillboardInput.vAnchor` gains `"ground"` with `groundLine`; enemies
  push `scale` and `groundLine` from `enemyBillboardPresentation(e)`; death alpha is
  `min(256, deathTimer/10 × 256)` so the collapse stays opaque and only the last ten timer frames fade.
- `fpRender/renderCore.ts`: `ground` places `size × groundLine` on the same floor plane props use;
  rows below the foot line (the transparent margin, the death slump) sink into the floor.
- Tests: `renderCore.test.ts` ground-anchor placement against the prop plane (groundLine 1 is
  pixel-identical to `prop`; groundLine 0.5 sinks half the cell) and the scene-builder expectations
  for anchor, scale, per-type size and the fade hold; `actorPresentation.test.ts` anchor expectation.

## Integration notes for the Manager

1. Cherry-pick `2f4a06a` on its own if the renderer change needs a second opinion; it compiles and
   passes without `5c14f8d` (the fallback stills already match the atlas framing, and the
   presentation data is inert until consumed).
2. `5c14f8d` is the whole renderer consumption. If re-applied by hand: two type lines and one
   push in `sceneInput.ts`, one anchor branch in `renderCore.ts`, plus the test updates listed above.
3. Engine change this lane could not make (`firstPersonEngine.ts`, grunt/charger case): stop
   stepping toward the player once inside the contact range so the attacker stays in view.

   ```ts
   // before the move: hold position at melee range instead of walking through the camera
   if (dist > ENEMY_CONTACT_RANGE * 0.9) {
     if (isWalkable(fp.map, newX, enemy.y)) enemy.x = newX;
     if (isWalkable(fp.map, enemy.x, newY)) enemy.y = newY;
   }
   ```

   At 0.45 tiles the grunt cell projects to 1.5× the frame height, so the player sees the face,
   eyes and core during the strike, as the sentry sheet already shows at range. Death at that range
   then collapses in view instead of inside the near cull. No gameplay numbers change: contact
   range, damage and cadence are untouched.
4. Follow-ups that stay in the renderer, in order of value: (a) mip levels for atlas frames
   (`idForFrame` → `buildMipChain`, pick by `size` in `drawBillboards`; frame bytes grow by a third
   inside the 40 MiB LRU) to stop far-range sparkle; (b) an emissive floor for hostile billboards
   (clamp the light multiplier for texels whose red exceeds green and blue by a margin) so the eyes
   and core survive dark rooms, which the master guide expects; (c) a sentry faces the player while
   idle and aggro, which needs the player position in `stepEnemyPresentation`.

## Remaining families and the generation brief

Today one atlas serves three types; the per-type scale is the only identity. The next asset slice
is a charger and a sentry variant with the same contract so the renderer needs no change:

| Property | Value (from `ACTOR_CATALOG.hostile` and the actor-motion README) |
| --- | --- |
| Cell | 256×256 RGBA8, transparent film, no backdrop, no halo |
| Clips | idle 4×8 at 300 ms; walk 8×8 at 100 ms; attack 4×8 at 100 ms, no loop; hurt 1×8 at 180 ms, no loop; death 6×1 (front only) at 80 ms, no loop |
| Rows | row 0 faces the viewer; rows advance by 45° as `selectNpcAtlasFrame` resolves them (order in `docs/assets/actor-motion/hostile-directions.png`) |
| Foot line | standing poses end at row 237; nothing below row 243; keep the 26-row top margin so the horns clear the cell |
| Width | subject 184–190 px of 256 at the shoulders; keep the silhouette inside 36–222 |
| Palette | desaturated carapace in the greys of the current hostile; emissive accents only, demon red per `docs/assets/prompts/doom/00-master-style-guide.md`; rim light from the right as in the current renders |
| Readability | silhouette must read at 48 px on the contact sheet; attack talons advance toward the viewer, hurt recoils the skull, idle and walk loops return to their first pose (`docs/assets/graphics-rollout/verification.md`) |
| Transfer | all five sheets under 8 MiB per type; the residency budget is 80 MiB shared with the quartermaster |

Charger: leaner and forward-leaning, longer forelimbs, smaller horns swept back, a narrower core;
the walk should be a lope. Sentry: heavier shoulders and a wider stance, a larger chest core as the
"turret", short thick horns; idle breathes, attack is a brace-and-discharge, not a lunge.

Two production routes exist, neither run in this slice: a Blender re-render of a modified
`docs/assets/actor-motion/hostile-editable.blend` through `game/scripts/actors/render_actors.py`
(Blender.app is installed on this machine; the script re-packs atlases and verification records),
or image generation, which was not available to this session. A 512-cell near-range atlas is not
feasible under the budget (the walk sheet alone would be 64 MiB), so the up-close pixel chunk at
under one tile stays until a near-only clip is budgeted.

## Running the capture harness

The spec is tagged `@visual` and is not in any default Playwright project. Build the static export
with Node 20, then run it with a local override whose project greps `/@visual/` and whose
`webServer` serves `game/out` (this machine cannot run the `next dev` watcher under Playwright):

```ts
// playwright.visual.config.ts (keep it out of the repo; absolute paths)
import { defineConfig } from "<repo>/game/node_modules/@playwright/test";
import base from "<repo>/game/playwright.config";
const port = 38431, baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({ ...base, testDir: "<repo>/game/tests/browser", outputDir: process.env.FPS_CAPTURE_OUT ?? "/tmp/fps-art/results",
  retries: 0, use: { ...base.use, baseURL, trace: "off", screenshot: "off" },
  webServer: { command: `python3 -m http.server ${port} --bind 127.0.0.1 --directory <repo>/game/out`, url: `${baseURL}/graphics-preview/`, reuseExistingServer: false },
  projects: [{ name: "visual", grep: /@visual/, use: { browserName: "chromium", viewport: { width: 1280, height: 1200 } } }] });
```

```sh
cd game && ./node_modules/.bin/next build
FPS_CAPTURE_TAG=after FPS_CAPTURE_OUT=/tmp/fps-art/after-grunt FPS_CAPTURE_SCENE=kepler FPS_CAPTURE_ACTOR=0 \
  ./node_modules/.bin/playwright test --config /path/to/playwright.visual.config.ts fpsEnemyCaptures
FPS_CAPTURE_ACTOR=3 ...   # the Kepler sentry: stationary, fires at range, best for attack/hurt/death
```

Each run writes `<TAG>-<label>.png` and `<TAG>-log.json` (distance, action, clip clock, positions)
into its output folder. Near, mid and far captures are taken with the simulation paused; attack is
taken live (a sentry fires every two seconds with line of sight; a grunt charges); hurt and death
are frozen right after the shot that caused them so their clip clock is known. Playwright empties
the output folder on every run, so give each run its own `FPS_CAPTURE_OUT`. The sheets in `captures/` were composed with `magick montage` from those
files and saved as JPEG to keep the repository small; the PNG originals are reproducible.

## Parked problems (not fixed here, outside this lane's files)

1. `sprites/boarding/enemy-fp-{front,flinch,death}.png` are now unreferenced at runtime but still
   named by `docs/assets/actor-motion/hostile-source-verification.json`, `source-provenance.json`,
   `game/scripts/actors/render_actors.py` and `game/scripts/sprites/sheets.ts`; moving them under
   `docs/assets` needs those script paths updated.
2. The Kepler layout has no sightline longer than about 2.4 tiles to a hostile from the preview
   placements, so far-range sparkle is diagnosed from the sampling code, not captured.
3. The player damage flash tints every capture taken while a hostile is firing; the sheets keep it
   because that is what the player sees.

Residual risk: the ground anchor and the 1.6 scale were judged on Kepler corridors and one sentry
junction; a wide outdoor scene (Ashfall camp, colony exterior) with hostiles has not been captured
because none of the preview scenes spawn hostiles outdoors.

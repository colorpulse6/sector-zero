# M2 Shooter Enemy Art Tranche 2 Design

**Date:** 2026-07-15
**Status:** Approved in conversation

## Goal

Continue M2 "The Look" with a second quality-controlled vertical-shooter
enemy tranche covering Cloaker, Scout, Wraith, and Echo. Each accepted
replacement must communicate its code-defined role more clearly at the real
44-56 px gameplay draw size while preserving every existing runtime and
gameplay contract.

This is an art-only slice. A current sprite remains in production when a new
candidate is not clearly better in exact-size comparisons, the 96x96 Bestiary,
and a representative live level.

## Selection evidence

Selection is based on explicit authored spawn counts in `ALL_LEVELS` and
`PLANET_LEVELS`. The audit imports the current level definitions and sums every
wave group's `count`; conditional boss adds are not included.

| Enemy | Campaign spawns | Planet spawns | Total |
|---|---:|---:|---:|
| Cloaker | 369 | 34 | 403 |
| Scout | 319 | 77 | 396 |
| Wraith | 296 | 44 | 340 |
| Echo | 296 | 44 | 340 |

These are the next four highest authored totals after the merged first tranche
(Swarm, Bomber, Gunner, and Drone). Shielder is next at 308.

## Preserved runtime contracts

All four assets are inspected single-frame sRGBA billboards. They are
registered at their current paths in `SPRITES` and `ENEMY_SPRITE_MAP`, are
present in `MAT_ALLOWLIST`, and are absent from the width-divided `SHEETS`
registry. The renderer draws four pixels beyond each side of the entity
rectangle; the Bestiary separately renders the same source in a 96x96 square.

| Enemy | Production path | Source canvas | Frames | Original max 5%-alpha bounds | Entity / hitbox | Gameplay draw | Bestiary |
|---|---|---:|---:|---:|---:|---:|---:|
| Cloaker | `game/public/sprites/enemies/cloaker.png` | 1536x1024 | 1 | `633x596+452+147` | 44x44 | 52x52 | 96x96 |
| Scout | `game/public/sprites/enemies/scout.png` | 1536x1024 | 1 | `602x476+465+240` | 40x40 | 48x48 | 96x96 |
| Wraith | `game/public/sprites/enemies/wraith.png` | 1024x1536 | 1 | `968x1284+28+97` | 48x44 | 56x52 | 96x96 |
| Echo | `game/public/sprites/enemies/echo.png` | 1536x1024 | 1 | `1037x895+258+49` | 36x36 | 44x44 | 96x96 |

Every original has a transparent corner and meaningful alpha. Wraith's
portrait 1024x1536 canvas is intentional and must not be normalized to the
landscape canvas used by the other three.

The `+X+Y` offsets are part of the placement contract, not incidental
metadata. `drawEnemies` maps the complete source canvas directly onto the
padded entity rectangle, so moving the alpha mass within that canvas moves the
visible enemy relative to its unchanged collision box. Fit each candidate
inside the recorded bounds and align its alpha-bounds center to the original
alpha-bounds center; do not recenter it on the source canvas. Any intentional
deviation requires an exact-size collision-alignment comparison and explicit
user approval.

No registration, source dimensions, frame counts, alpha semantics, renderer
padding, class tinting, entity dimensions, hitboxes, stats, spawning,
collision, or balance may change.

## Code-defined roles and approved visual briefs

### Scout

Code truth: 1 HP, speed 3, no weapon, formation behavior, default `swarm`
class, and the campaign's first encountered hostile.

**Visual-role brief:** A lean, uncomplicated forward interceptor that instantly
reads as the fast, unarmed baseline attacker at 48x48.

Use a compact dart or narrow swept-wing mass with one obvious forward axis and
few internal breaks. It must remain simpler and lighter than the other three,
without becoming a generic glowing triangle or resembling the accepted Drone.

### Cloaker

Code truth: 3 HP, speed 3, armed, lateral cloak behavior, starts cloaked,
toggles visibility every 120 frames, cannot shoot or collide while cloaked,
and renders at 15% alpha while hidden. Its default class is `tech-drone`, while
Bestiary lore identifies the cloaking process as organic.

**Visual-role brief:** A crescent/shutter-shaped organic stealth hunter whose
negative space remains recognizable when visible at 52x52 and ghosted to 15%
alpha.

Preserve one large negative-space cutout or broken-ring read rather than thin
wisps. The visible state needs a dark central hunter mass and restrained cold
tech light, with organic membrane or chitin explaining the lore. It must not
read as Wraith's solid heavy hull.

### Wraith

Code truth: 4 HP, speed 2.5, armed, slow formation drift, 48x44 hitbox, and
default `elemental-cinder` class. Bestiary lore describes human pilots absorbed
into organic hulls despite its stale "pursuit, phasing" label; current runtime
does not cloak or chase.

**Visual-role brief:** A broad, heavy corrupted sarcophagus-ship containing a
trapped human presence, with restrained cinder emissives at 56x52.

Use a wide solid cruciform, coffin, or armored reliquary mass with one central
human-scale containment cue. Cinder light should mark cracks or vents rather
than paint the surface. Avoid wispy ghost anatomy, Cloaker's hollow crescent,
and Echo's displaced repetition.

### Echo

Code truth: 3 HP, speed 3, armed, phase behavior with lateral sway, starts
cloaked, toggles every 90 frames, cannot shoot or collide while cloaked, and
renders at 15% alpha while hidden. Its default class is `tech-drone` and its
Bestiary identity is delayed pattern mimicry and repeated dead-pilot movement.

**Visual-role brief:** A compact craft assembled from visibly displaced
repeating plates or twin afterimage masses, communicating phase repetition at
44x44 without resembling Scout.

The repetition must be part of one connected silhouette so collision and
orientation remain legible. Use two or three chunky offset echoes around a
stable dark core, with restrained cold and warm phase seams. Avoid loose
particles, thin scanline noise, a simple triangular fighter, or an effect that
depends on source-scale detail.

## Silhouette system

The tranche uses four deliberately different black-shape families:

- Scout: small forward dart;
- Cloaker: open crescent or shutter with a dominant void;
- Wraith: broad solid reliquary or cruciform;
- Echo: compact offset/repeated mass.

Actual-size role recognition outranks surface detail and literal DOOM
fidelity. Tech and corruption registers remain distinct, but all four retain
Sector Zero's worn low-saturation surfaces, crushed shadows, restrained
emissives, and strong rim separation. The exact positive and negative suffixes
from `docs/assets/prompts/doom/00-master-style-guide.md` section 8 remain
verbatim in every generation and provenance record.

## Shared framing contract

Every generation is an orthographic or near-orthographic top-down/front-down
spacecraft billboard. The enemy's attack/forward axis points toward the bottom
of the screen, matching its descent toward the player. A slight front-down cue
may expose the leading structure, but the result must not become a side view or
dramatic three-quarter perspective. There is no horizon, ground plane, floor,
contact shadow, cast shadow, or environmental scene.

The Bestiary uses this same top-down asset. A "front-facing" Bestiary evidence
frame means the turntable's horizontal `scaleX` is at or near full magnitude,
so the sprite is not edge-on or visibly squashed; it does not request a
front-view generation.

## Generation and alpha pipeline

Generate and review one enemy at a time with the built-in image-generation
tool. Each attempt uses the established flat `#00ff00` background block with
no floor, shadow, reflection, gradient, texture, or green in the subject. The
current production sprite is a semantic and scale reference only; no image
reference is passed unless a later targeted correction genuinely needs one and
that reference role is recorded.

For each enemy:

1. preserve the original outside the repository and record its dimensions,
   alpha envelope, registration, draw contract, mechanics, and target level;
2. generate one strong behavior-derived candidate;
3. matte outside the production tree with border sampling, soft matte,
   thresholds 12/220, and despill;
4. proportionally fit the subject inside the original maximum 5%-alpha bounds
   without stretching, aligning the candidate alpha center to the recorded
   original alpha center rather than the source-canvas center;
5. verify dimensions, one-frame layout, transparent corners, alpha, and edge
   quality;
6. test exact gameplay size on dark and bright fields and at 96x96;
7. replace the production PNG only when the candidate is clearly better;
8. make at most a targeted retry for a concrete failed gate, keeping every
   rejected source outside `game/public/sprites/`.

Retry once with a one-pixel edge contraction only when chroma fringe remains.
Do not hand-paint corrections, add placeholder assets, change pipeline code,
or train a LoRA in this tranche.

## Provenance and evidence

Create `docs/assets/prompts/shooter/02-m2-second-tranche.md` and a matching
review folder under `docs/assets/reviews/m2-shooter-enemies-2/`. Record for
every accepted and rejected attempt:

- the complete shared and asset-specific prompt blocks;
- exact authoritative positive and negative suffixes;
- generation identifier/path and seed policy;
- reference-image role, or explicit no-reference status;
- generated source dimensions;
- matte settings and sampled key;
- candidate and production dimensions, frame layout, alpha envelope, and
  transparent-corner result;
- actual-size, Bestiary, and live-level verdicts;
- concrete iteration or rejection reason.

For every accepted replacement, commit an exact-size dark/bright comparison,
a matched 480x854 before/after gameplay pair, a matched full-scale-turntable
96x96 Bestiary pair, and a four-panel review sheet. If an original is retained,
document the rejected candidate and why the original won; do not manufacture a
misleading accepted-replacement sheet.

## Representative live verification

Use isolated, early authored waves so the target is readable without unrelated
enemy clutter:

| Enemy | Primary level | Target wave | Why |
|---|---|---:|---|
| Scout | World 1-1, First Contact | HUD Wave 1: 5 Scout line | Baseline first-contact role on an early scene |
| Cloaker | World 5-3, Phantom Fleet | HUD Wave 1: 9 Cloaker scatter | Pure Cloaker wave in the native dark stealth register |
| Wraith | World 4-2, The Kepler Graveyard | HUD Wave 1: 4 Wraith V | Pure Wraith wave against the graveyard setting |
| Echo | World 6-2, Distortion Field | HUD Wave 1: 6 Echo scatter | Pure Echo wave in its phase-distortion chapter |

Also cross-check Cloaker and Echo in both visible and 15%-alpha states, Wraith
under its default cinder class tint, Scout in a dense later W1-1 formation, and
all four in the Bestiary turntable. Browser sessions use the DevPanel-enabled
static export at a 480x854 viewport and must report zero new errors; unchanged
framework warnings are recorded separately.

## Acceptance gates

Every accepted replacement must satisfy all of the following:

- exact original source dimensions and one sRGBA frame;
- transparent corners and meaningful non-binary edge alpha;
- no green fringe, white halo, boxy wash, floor, or contact shadow;
- no text, logos, watermark, pixel-art treatment, cartoon outline, clean
  plastic, or saturated painted surfaces;
- no stretching or crop outside the original maximum alpha bounds, and no
  source-space alignment shift relative to the original bounds center;
- recognizable at the exact gameplay rectangle and at 96x96;
- readable under the unchanged 35% class multiply tint;
- Cloaker and Echo retain a meaningful silhouette at 15% alpha;
- distinct from one another and from the merged first tranche;
- clearly better than the original in a real 480x854 scene.

If any candidate fails the final criterion, restore the original and document
the non-replacement.

## Verification and delivery boundary

Run from `game/` after the art and evidence are final:

```bash
npx tsc --noEmit
yarn colony:test
yarn engine:test
yarn sprites:test
yarn build
NEXT_PUBLIC_DEVTOOLS=1 yarn build
```

Then run the full browser playtest, console check, PNG geometry/alpha audit,
`git diff --check origin/main...HEAD`, and an independent production-readiness
review. The draft PR contains only accepted in-place PNG replacements,
provenance, and visual evidence. It contains no source code, renderer, atlas,
save, boss, first-person, background, hub, registration, stat, spawning,
collision, or balance changes, and it remains unmerged pending user approval.

# M2 Shooter Enemy Art Tranche Design

**Date:** 2026-07-14
**Status:** Approved in conversation

## Goal

Begin M2 "The Look" with four high-visibility vertical-shooter enemy
replacements that are clearly more readable and more distinctive at their real
32-56 px gameplay render sizes, without changing gameplay, sprite registration,
asset geometry, or rendering behavior.

This is a quality-controlled pilot tranche. It does not establish a mandate
that vertical-shooter art must look like first-person DOOM art. For these
enemies, gameplay silhouette and Sector Zero identity outrank literal DOOM
fidelity.

## Tranche selection

Selection is based on explicit authored spawn counts in `ALL_LEVELS` and
`PLANET_LEVELS`, not intuition or file-name frequency. Conditional boss adds
reinforce the chosen set and do not change the selection boundary.

| Enemy | Campaign spawns | Planet spawns | Total | Entity/hitbox | Gameplay render rectangle |
|---|---:|---:|---:|---:|---:|
| Swarm | 549 | 38 | 587 | 24x24 px | 32x32 px |
| Bomber | 447 | 51 | 498 | 36x48 px | 44x56 px |
| Gunner | 397 | 67 | 464 | 48x48 px | 56x56 px |
| Drone | 374 | 76 | 450 | 32x32 px | 40x40 px |

The next-highest authored total is Cloaker at 403, leaving a clear boundary
below the selected four.

`drawEnemies` expands the entity rectangle by four pixels on every side when it
draws the sprite; the actual-size quality gate uses the gameplay render
rectangle, never the smaller entity/hitbox dimensions. The Bestiary separately
draws the same source paths in a 96x96 square and is a required enlarged-use
check.

All four current files are inspected single-frame RGBA billboards, not atlases.
Each production source canvas is 1536x1024 px and is registered at its existing
path in `SPRITES` and `ENEMY_SPRITE_MAP`.

## Visual identities

The four replacements must not collapse into variations of the current narrow
arrowhead silhouette.

- **Swarm:** a compact cluster of three hooked bio-organic attack organisms
  that reads as one serrated mass at its 32x32 render size. It is a
  hell-corruption/swarm register asset, fast and numerous rather than
  individually imposing.
- **Bomber:** a heavy, bulbous hell-corrupted breaching torpedo with a bright
  furnace sac and an armored ram. Its mass and forward momentum must read at
  its 44x56 render size without looking like the Swarm.
- **Gunner:** a wide, square industrial weapons barge with twin oversized
  cannon shoulders and restrained amber emissives. It is the armored
  tech-base silhouette and must feel slow, stable, and dangerous at 56x56.
- **Drone:** a compact spherical tech drone with three stabilizer vanes and one
  cold cyan sensor. It must remain visually distinct from the broad Gunner at
  its 40x40 render size.

No humanoids are introduced. Tech-base and hell-corruption registers remain
visibly distinct.

## Art-direction priority

When goals compete, use this order:

1. silhouette readability at the actual gameplay render size;
2. enemy role and bestiary semantics;
3. distinct tech-base versus bio-organic/hell register;
4. cohesion with Sector Zero's desaturated industrial palette and emissive
   accents;
5. modern DOOM influence where it improves the asset.

The exact positive and negative suffixes from
`docs/assets/prompts/doom/00-master-style-guide.md` remain attached to and
recorded with every generation. Asset-specific prompt text may steer away from
FPS-monster framing when top-down shooter readability requires it.

## Generation and alpha pipeline

Each enemy is generated independently with the built-in image generation tool.
The original sprite is a semantic reference, not a silhouette template. The
generation uses a perfectly flat solid `#00ff00` background with no floor,
shadow, reflection, gradient, texture, or green in the subject.

For each enemy:

1. inspect and record the original path, dimensions, alpha, registration,
   entity/hitbox dimensions, gameplay render rectangle, Bestiary size, and
   representative levels;
2. generate one strong canonical candidate using the asset-specific prompt plus
   the authoritative suffixes;
3. self-reject and regenerate with one targeted correction when the result is
   not clearly better; bring only genuinely ambiguous artistic choices to the
   user;
4. keep all generated and rejected sources outside
   `game/public/sprites/`;
5. remove the chroma background with the established local alpha helper using
   a soft matte and despill;
6. proportionally fit the accepted subject onto a transparent 1536x1024 canvas
   without stretching, preserving suitable edge padding and the existing
   top-down orientation;
7. replace the production PNG only after alpha, geometry, and actual-size
   inspection pass.

The four existing paths and registrations do not change:

- `game/public/sprites/enemies/swarm.png`
- `game/public/sprites/enemies/bomber.png`
- `game/public/sprites/enemies/gunner.png`
- `game/public/sprites/enemies/drone.png`

No atlas construction or frame slicing is involved. If evidence unexpectedly
requires a pipeline or registration change, that change must be isolated,
justified, and protected by a focused failing test before implementation.

## Provenance

Create a shooter-specific prompt/provenance document under
`docs/assets/prompts/shooter/` that references, but is not aesthetically bound
to, the DOOM master guide. Record for each accepted and rejected attempt:

- complete asset-specific prompt;
- the exact authoritative positive and negative suffixes;
- generation tool and output identifier/path;
- seed when exposed, or an explicit note that the built-in tool did not expose
  one;
- reference-image roles;
- generated source dimensions;
- production dimensions and one-frame layout;
- alpha/matting settings;
- iteration and rejection notes;
- actual-size acceptance result;
- representative playtested levels.

Before/after contact sheets and gameplay screenshots are provenance artifacts,
not production sprites. They may be committed with the prompt documentation
when useful to make the visual review reproducible.

## Acceptance gates

Every accepted replacement must pass all of these gates:

- exactly 1536x1024 px;
- one RGBA frame with meaningful transparency and transparent corners;
- no white halo, green fringe, boxy matte, or accidental floor/contact shadow;
- no text, logo, watermark, pixel-art treatment, cartoon outline, or saturated
  painted armor;
- no stretching or crop that changes the enemy's top-down gameplay footprint;
- recognizable as its own enemy at the gameplay render size and in the 96x96
  Bestiary view;
- clearly distinct from the other three silhouettes;
- clearly better than the original in a real game scene, not only when viewed
  at source resolution.

An enlarged inspection view is necessary for matte defects but cannot override
a failed actual-size test. If a replacement is not clearly better, retain the
original until a stronger candidate exists.

## Real-level visual verification

Playtest the replacements in authored levels where they are heavily used:

- Drone and Gunner: World 1-4, **The Gauntlet**;
- Bomber: World 3-3, **Solar Storm**;
- Swarm: World 8-3, **Spawning Chamber**;
- dark-scene cross-check: World 5-4, **Event Horizon**.

Inspect movement, overlap, class tinting, weapon effects, bright backgrounds,
crushed dark scenes, emissive readability, edge halos, and the shared 96x96
Bestiary presentation. Capture before and after screenshots at the actual
480x854 game scale and confirm the browser console has no new errors.

## Repository and verification contract

Work on `feat/m2-shooter-enemy-tranche` in an isolated worktree created from the
fresh `origin/main`. The primary checkout's `.DS_Store` and `yarn.lock` changes
are unrelated and must remain untouched.

Record the current baseline before asset replacement. After the replacements,
run from `game/`:

```bash
npx tsc --noEmit
yarn colony:test
yarn engine:test
yarn sprites:test
yarn build
NEXT_PUBLIC_DEVTOOLS=1 yarn build
```

Then serve `out/`, complete the browser playtests and screenshots, check the
console, and run `git diff --check` from the repository root. Preserve static
export safety, renderer defaults, golden framebuffer expectations, gameplay
stats, spawn rules, collision, and balance.

## Delivery boundary

The draft PR contains only:

- the four accepted in-place enemy PNG replacements;
- their prompt/provenance documentation and review images;
- a strictly necessary, focused-tested pipeline change only if the unchanged
  pipeline cannot satisfy the approved contract.

The PR body lists each enemy, original/output dimensions, frame count,
playtested levels, exact verification results, and rejected candidates. It does
not include bosses, first-person billboards, backgrounds, hub work, LoRA
training, or long-term simulation/galaxy work. The PR remains draft and is not
merged in this slice.

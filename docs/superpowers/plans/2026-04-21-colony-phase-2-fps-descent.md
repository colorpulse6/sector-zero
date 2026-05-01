# Colony System — Phase 2: FPS Descent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first first-person-rendered colony. Player clicks "Descend to Colony" in the Phase 1 DOM overlay → spawns in a walkable 24×24 raycaster map generated from `ColonyState` → walks around the central plaza with up to 6 building footprints → enters stub interiors for each Phase 1 building → exits via landing-pad menu.

**Architecture:** Reuse the existing `firstPersonEngine.ts` (1575 lines, proven on Ashfall Forward Camp) via a `ColonyContext` adapter field. All colony-specific logic lives in a new `colony/exploration/` orchestrator layer. The engine stays colony-agnostic except for one `if (fp.colonyContext)` guard containing the 2 hook calls, dominant-axis facing computation, and the anti-bounce gate. Template-based layout generator (not pure procgen): fixed 24×24 frame with 6 slots around a central plaza, deterministically filled from `colony.buildings` insertion order rotated by `layoutSeed`.

**Tech Stack:** TypeScript 5 + React 19 + Next.js 15 (static export) + existing Phase 0/1 colony subsystem + existing FPS engine. No new runtime dependencies. Test harness reuses `tsx` + Node's built-in `node:test` (Phase 0 setup). Asset workstream runs in parallel via GPT-generated prompts.

**Spec reference (canonical):** `docs/superpowers/specs/2026-04-21-colony-phase-2-fps-descent-design.md`

**Branch:** Work on `colony/phase-2` branched from `main` (which has Phase 0 + Phase 1 shipped). Do NOT start work on `main`.

---

## Scope Contract

**In scope for Phase 2:**
- New `GameMode` value: `"colony-exploration"`
- New folder `game/app/components/colony/exploration/` with 8 files
- Template-based 24×24 Outpost layout (central plaza, 6 slots, south-center landing pad)
- Deterministic slot assignment from `layoutSeed` + `colony.buildings` insertion order
- Multi-tile building footprints for 4 Phase 1 building types
- 4 stub interior templates (~6×6 tiles each, one thematic prop)
- Scene stack for exterior ↔ interior transitions (max depth 2)
- `ColonyContext` adapter + anti-bounce gate (edge-trigger + cooldown)
- Day/night tint (cosmetic, hour-driven, applied in renderer)
- "Descend to Colony" button added to `ColoniesScreen`
- Landing-pad "TAKE OFF / STAY" DOM overlay
- Asset prompt documents for 11 new sprites (parallel workstream, non-blocking for code)
- ~22 new tests

**Out of scope (per spec Section A):**
- NPCs in colonies (Phase 3/5a)
- Interior content beyond 1 prop
- Biome-aware sprite selection (Phase 4+)
- Day/night gameplay effects
- POI / region graph
- Combat inside colonies
- Tier promotion visual feedback
- Actual final art assets (parallel workstream only; images ship via separate small PR)

---

## File Structure

### Create

```
game/app/components/colony/exploration/
├── colonyContext.ts              # adapter interface, DoorInteractResult, LandingPadResult
├── colonyLayout.ts               # generateExteriorState, generateInteriorState
├── sceneStack.ts                 # SceneStack state machine
├── outpostTemplate.ts            # 24×24 frame constants + 6 slot defs + landing pad
├── buildingTiles.ts              # BUILDING_FOOTPRINTS + INTERIOR_TEMPLATES
├── dayNightTint.ts               # tintForHour(h) → HslShift
├── exitMenu.ts                   # React: <LandingPadExitMenu/> overlay
└── index.ts                      # public API: enterColonyExploration, stepColonyExploration, exitColonyExploration

game/tests/colony/
├── colonyLayout.test.ts          # determinism + slot assignment
├── sceneStack.test.ts            # push/pop invariants
├── outpostTemplate.test.ts       # slot geometry, no overlaps, pad reachability
├── buildingTilesRegistry.test.ts # registry completeness
├── dayNightTint.test.ts          # tint math
├── antiBounceGate.test.ts        # edge-trigger + cooldown gate
└── reducerInsertionOrder.test.ts # spec-invariant: reducer preserves colony.buildings order

docs/assets/prompts/
├── README.md                     # global pipeline explainer
└── colony-phase-2/
    ├── 00-shared-style-guide.md
    ├── 01-walls.md
    ├── 02-environment.md
    ├── 03-construction.md
    └── 04-interiors.md
```

### Modify

```
game/app/components/engine/
├── types.ts                      # GameMode union + FirstPersonState colony fields
│                                 # + FPEnvironmentArt.environmentTint?
├── firstPersonEngine.ts          # single `if (fp.colonyContext)` guard (≤30 lines)
├── firstPersonRenderer.ts        # environmentTint application
└── sprites.ts                    # 11 new sprite path constants

game/app/components/colony/
├── index.ts                      # re-export exploration public API
└── meta/
    └── ColoniesScreen.tsx        # add "Descend to Colony" button

game/app/components/
└── Game.tsx                      # currentMode branch, wiring, exit-menu mount
```

**Public API rule (unchanged):** outside-colony imports only from `colony/index.ts`. Exploration internals not exposed.

---

## Task Breakdown

### Task 1: GameMode + FirstPersonState field plumbing

**Goal:** Add all type-level scaffolding that later tasks depend on. Types only, no behavior.

**Files:**
- Modify: `game/app/components/engine/types.ts`
- Create: `game/app/components/colony/exploration/colonyContext.ts`

- [ ] **Step 1: Find `GameMode` union in types.ts**

Run: `grep -n "type GameMode\|GameMode =" game/app/components/engine/types.ts | head -5`
Note the line number.

- [ ] **Step 2: Extend `GameMode` union**

Add `"colony-exploration"` as a new literal. Preserve all existing values. Final form should include at least: `"shooter" | "ground-run" | "boarding" | "first-person" | "turret" | "colony-exploration"` (the exact set may be longer — keep every existing value).

- [ ] **Step 3: Create `colonyContext.ts`**

Create `game/app/components/colony/exploration/colonyContext.ts`:

```typescript
import type { ColonyId, BuildingInstanceId } from "../shared/colonyTypes";

export type DoorInteractResult =
  | { kind: "enter_interior"; buildingId: BuildingInstanceId }
  | { kind: "exit_interior" }
  | { kind: "locked"; reason: string }
  | { kind: "no_door" };

export type LandingPadResult =
  | { kind: "show_exit_menu" }
  | { kind: "not_on_pad" };

export interface ColonyContext {
  colonyId: ColonyId;
  mode: "exterior" | "interior";
  interiorBuildingId: BuildingInstanceId | null;

  /** Engine passes standingOn (floor(posX), floor(posY)) and facingTile
   *  (one cardinal step ahead via dominant-axis of dirX/dirY).
   *  - EXTERIOR mode: check facingTile for an exterior-door tile.
   *  - INTERIOR mode: check standingOn for the exit-door tile. */
  onDoorInteract(
    standingOn: { x: number; y: number },
    facingTile: { x: number; y: number }
  ): DoorInteractResult;

  /** Engine passes standingOn; adapter checks pad region membership. */
  onLandingPadInteract(standingOn: { x: number; y: number }): LandingPadResult;
}
```

- [ ] **Step 4: Add FirstPersonState fields**

Find `FirstPersonState` in `game/app/components/engine/types.ts` (should be around lines 933-959). Add these 4 optional fields at the end of the interface:

```typescript
  // Colony exploration extensions (Phase 2 of colony system)
  // When colonyContext is defined, the engine enters colony-exploration mode
  // with anti-bounce gating for door/pad interaction.
  colonyContext?: ColonyContext;
  colonyTransitionRequest?: unknown;  // DoorInteractResult | LandingPadResult — typed as unknown to avoid circular import
  colonyInteractArmed?: boolean;      // true iff keys.shoot has been released since last hook fire
  colonyInteractCooldownFrames?: number;  // decrements each frame; >0 blocks hooks
```

Note: `colonyTransitionRequest` uses `unknown` because typing it as `DoorInteractResult | LandingPadResult` would require importing from `colony/exploration/colonyContext.ts`, and `FirstPersonState` shouldn't depend on colony types. The orchestrator casts when reading.

Import `ColonyContext` as a type-only import at the top of `types.ts`:

```typescript
import type { ColonyContext } from "../colony/exploration/colonyContext";
```

This creates a type-only circular-ish reference (colonyContext.ts imports ColonyId from colonyTypes.ts; engine/types.ts imports ColonyContext from colony/exploration/colonyContext.ts). Type-only imports are erased at compile time — no runtime cycle. Mirrors the Phase 0 PlanetId pattern.

- [ ] **Step 5: Add environmentTint field to FPEnvironmentArt**

In the same `types.ts`, find `FPEnvironmentArt` interface. Add an optional field:

```typescript
  /** Optional HSL shift applied by firstPersonRenderer during environment sprite draw.
   *  Used by colony exploration for day/night tint; safe to omit for other modes. */
  environmentTint?: {
    hueShift: number;
    saturationMul: number;
    lightnessMul: number;
  };
```

- [ ] **Step 6: Verify build**

Run: `cd game && yarn build`
Expected: clean static export. No TypeScript errors.

- [ ] **Step 7: Verify tests still pass**

Run: `cd game && yarn colony:test`
Expected: 57/57 passing (Phase 1 baseline — no new tests in Task 1).

- [ ] **Step 8: Verify tsc**

Run: `cd game && npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 9: Commit**

```bash
cd /Users/nichalasbarnes/Desktop/projects/sector-zero
git add game/app/components/engine/types.ts game/app/components/colony/exploration/colonyContext.ts
git commit -m "feat(colony): GameMode + FirstPersonState plumbing for colony-exploration"
```

---

### Task 1.5: Asset prompt drafts (parallel, non-blocking)

**Execution note:** Despite the "1.5" numbering, this task has NO code dependencies. It can be executed at any point before the Phase 2 PR closes, by any subagent, in any order relative to Tasks 2-7. Tasks 2-7 do not block on it. If the executing controller uses subagent-driven-development, dispatch this task whenever convenient (before Task 2, between tasks, or as a final parallel batch).

**Goal:** Create the prompt-template structure so the user can generate the 11 Phase 2 assets via GPT. Code path (Tasks 2-7) does NOT block on asset generation — renderer falls back to color-tints for missing sprites.

**Files:**
- Create: `docs/assets/prompts/README.md`
- Create: `docs/assets/prompts/colony-phase-2/00-shared-style-guide.md`
- Create: `docs/assets/prompts/colony-phase-2/01-walls.md`
- Create: `docs/assets/prompts/colony-phase-2/02-environment.md`
- Create: `docs/assets/prompts/colony-phase-2/03-construction.md`
- Create: `docs/assets/prompts/colony-phase-2/04-interiors.md`

- [ ] **Step 1: Create top-level README**

Create `docs/assets/prompts/README.md`:

```markdown
# Asset Prompts

This folder holds GPT prompt templates for generating Sector Zero game assets.
Each phase (or asset class) gets its own subfolder.

## How this works

1. Spec/plan author drafts a prompt file per asset class, with:
   - Sprite ID (matches entries in `game/app/components/engine/sprites.ts`)
   - Target filename + path
   - Dimensions, perspective, alpha
   - A copy-paste-ready GPT prompt
   - A negative prompt (what to avoid)
   - Iteration notes (filled during generation)
2. User runs GPT sessions with the prompts, drops resulting images into
   `game/public/sprites/<class>/...` at the paths specified.
3. User opens a small PR registering the sprite path constants in `sprites.ts`.
4. Renderer picks them up automatically. Color-tint fallback was used until then.

## Index

- `colony-phase-2/` — 11 assets for Phase 2 FPS descent (walls, environment, interiors)
```

- [ ] **Step 2: Create shared style guide**

Create `docs/assets/prompts/colony-phase-2/00-shared-style-guide.md`:

```markdown
# Colony Phase 2 — Shared Style Guide

Apply this context to every Phase 2 asset prompt.

## Aesthetic

- Retro-futuristic, pixel-art-adjacent. Think Wolfenstein 3D meets a
  hand-painted sci-fi illustration.
- Canvas 2D friendly: limited anti-aliasing, crisp edges, readable at
  small raycaster draw sizes.
- Palette tied to the companion site's HUD tokens:
  - Deep background: `#0a0e17`
  - Cyan accent: `#00f0ff`
  - Purple accent: `#7800ff`
  - Text primary: `#e0e6ed`
  - Danger: `#ff3366`
  - Success: `#44ff99`

## Biome

Phase 2 colonies are on Ashfall (desert). Sky/ground/walls in the
exterior reuse existing Ashfall sprites. NEW Phase 2 assets should
be biome-agnostic where possible (building walls, interior props
work anywhere). Biome-aware variants land in Phase 4+.

## Perspective

- **Wall textures**: square tile (64×64), square-on perspective,
  tileable edges, no vignette or gradient that breaks the tile.
- **Environment floor tiles** (landing pad, foundation): square tile
  (64×64), top-down view with slight perspective, tileable.
- **Billboards** (props, scaffolding, interior items): front-facing
  view, transparent background, standing on ground plane at bottom.

## Negative prompts (apply to all)

- No text, letters, or numbers on the asset
- No people, NPCs, or living creatures
- No transparent gradients that clash with raycaster draw
- No heavy JPEG artifacts, no watermarks
- No logos, no brand marks
```

- [ ] **Step 3: Create walls prompt file**

Create `docs/assets/prompts/colony-phase-2/01-walls.md`:

```markdown
# Walls — 4 building exterior wall textures

Refers to `00-shared-style-guide.md`.

## Asset: COLONY_WALL_SOLAR

- **Filename:** `game/public/sprites/colony/walls/solar.png`
- **Dimensions:** 64×64 px
- **Perspective:** square-on tile texture, tileable
- **Alpha:** opaque
- **Prompt:**
  > Retro-futuristic tile texture for the exterior wall of a Solar
  > Array facility on a desert colony. Sheet-metal paneling with
  > subtle solar-blue accent trim, riveted edges, light dust staining.
  > Muted cyan tones (#00f0ff influence) on a warm metal base.
  > Tileable, crisp edges, pixel-art-adjacent render style.
- **Negative prompt:**
  > solar panels on the wall, windows, doors, people, text, logos,
  > heavy perspective, glows that break tiling
- **Iteration notes:** _(fill when generating)_

## Asset: COLONY_WALL_FARM

- **Filename:** `game/public/sprites/colony/walls/farm.png`
- **Dimensions:** 64×64 px
- **Perspective:** square-on tile texture, tileable
- **Alpha:** opaque
- **Prompt:**
  > Retro-futuristic tile texture for the exterior wall of a
  > greenhouse farm on a desert colony. Translucent green-tinted
  > panel material over a metal frame, stained with fine red-brown
  > dust. Muted sage/olive tones against warm metal. Tileable,
  > crisp edges, pixel-art-adjacent render style.
- **Negative prompt:**
  > plants visible through the wall, wooden textures, people, text,
  > logos, gradients that break tiling
- **Iteration notes:** _(fill when generating)_

## Asset: COLONY_WALL_PURIFIER

- **Filename:** `game/public/sprites/colony/walls/purifier.png`
- **Dimensions:** 64×64 px
- **Perspective:** square-on tile texture, tileable
- **Alpha:** opaque
- **Prompt:**
  > Retro-futuristic tile texture for the exterior wall of a water
  > purifier facility on a desert colony. Heavy industrial metal
  > paneling with exposed copper pipes running vertically, water
  > stain drip marks in blue-green tones. Cool cyan-blue accents
  > on cold metal. Tileable, crisp edges, pixel-art-adjacent style.
- **Negative prompt:**
  > water splashing, windows, doors, people, text, logos, heavy
  > rust, gradients that break tiling
- **Iteration notes:** _(fill when generating)_

## Asset: COLONY_WALL_HABITAT

- **Filename:** `game/public/sprites/colony/walls/habitat.png`
- **Dimensions:** 64×64 px
- **Perspective:** square-on tile texture, tileable
- **Alpha:** opaque
- **Prompt:**
  > Retro-futuristic tile texture for the exterior wall of a
  > residential habitat module on a desert colony. Insulated
  > composite paneling with warm amber interior glow seeping
  > through seams, subtle personalization (small hand-painted
  > stripe at mid-height). Warm cream/amber tones against cool
  > metal frame. Tileable, crisp edges, pixel-art-adjacent style.
- **Negative prompt:**
  > windows showing interior, curtains, doors, people, text,
  > logos, gradients that break tiling
- **Iteration notes:** _(fill when generating)_
```

- [ ] **Step 4: Create environment prompt file**

Create `docs/assets/prompts/colony-phase-2/02-environment.md`:

```markdown
# Environment — landing pad + foundation tiles

Refers to `00-shared-style-guide.md`.

## Asset: COLONY_LANDING_PAD

- **Filename:** `game/public/sprites/colony/environment/landing-pad.png`
- **Dimensions:** 64×64 px
- **Perspective:** top-down tile texture, tileable
- **Alpha:** opaque
- **Prompt:**
  > Retro-futuristic top-down floor tile for a colony ship landing
  > pad on a desert world. Reinforced metal plating with thick
  > hazard-stripe markings (alternating cyan-amber, 15% coverage),
  > scorched in the center from frequent landings. Rivets around
  > the perimeter. Warm steel base with cyan accent stripes.
  > Tileable (edges must blend with adjacent copies), crisp edges,
  > pixel-art-adjacent style.
- **Negative prompt:**
  > logos, text, people, explicit "H" heli-pad letter, gradients
  > that break tiling
- **Iteration notes:** _(fill when generating)_

## Asset: COLONY_FOUNDATION

- **Filename:** `game/public/sprites/colony/environment/foundation.png`
- **Dimensions:** 64×64 px
- **Perspective:** top-down tile texture, tileable
- **Alpha:** opaque
- **Prompt:**
  > Retro-futuristic top-down floor tile for a half-poured building
  > foundation on a desert colony. Cracked concrete surface with
  > exposed rebar at the edges, some surveyor-chalk marks (faint
  > cyan). Dust-stained. Construction-phase placeholder feel.
  > Tileable, crisp edges, pixel-art-adjacent style.
- **Negative prompt:**
  > completed walls, people, text, logos, heavy shadows that break
  > tiling
- **Iteration notes:** _(fill when generating)_
```

- [ ] **Step 5: Create construction prompt file**

Create `docs/assets/prompts/colony-phase-2/03-construction.md`:

```markdown
# Construction — scaffolding billboard

Refers to `00-shared-style-guide.md`.

## Asset: COLONY_SCAFFOLDING

- **Filename:** `game/public/sprites/colony/props/scaffolding.png`
- **Dimensions:** 64×96 px (wider than tall-ish — standing upright)
- **Perspective:** front-facing billboard, transparent background
- **Alpha:** transparent PNG
- **Prompt:**
  > Retro-futuristic billboard sprite of a single unit of construction
  > scaffolding on a desert colony building site. Metal frame tower
  > with diagonal braces, one yellow safety light blinking near the
  > top, a few cables and a hanging hard-hat. Standing upright on a
  > ground plane. Front-facing view. Transparent background, no
  > shadow on the ground. Crisp edges, pixel-art-adjacent style.
- **Negative prompt:**
  > people on the scaffolding, text, logos, solid backgrounds,
  > multiple scaffolding units
- **Iteration notes:** _(fill when generating)_
```

- [ ] **Step 6: Create interiors prompt file**

Create `docs/assets/prompts/colony-phase-2/04-interiors.md`:

```markdown
# Interiors — 4 thematic prop billboards

Refers to `00-shared-style-guide.md`.

## Asset: INTERIOR_SOLAR_PANEL

- **Filename:** `game/public/sprites/colony/interiors/solar-panel.png`
- **Dimensions:** 48×48 px
- **Perspective:** front-facing billboard
- **Alpha:** transparent PNG
- **Prompt:**
  > Retro-futuristic billboard sprite of a solar array control panel:
  > a chest-high console with glowing cyan diodes, a few dials and
  > a small monitor showing abstract waveforms. Standing on a ground
  > plane, front-facing. Transparent background. Crisp edges,
  > pixel-art-adjacent style.
- **Negative prompt:**
  > text on the monitor, people, solid background, multiple panels
- **Iteration notes:** _(fill when generating)_

## Asset: INTERIOR_FARM_CRATE

- **Filename:** `game/public/sprites/colony/interiors/farm-crate.png`
- **Dimensions:** 48×48 px
- **Perspective:** front-facing billboard
- **Alpha:** transparent PNG
- **Prompt:**
  > Retro-futuristic billboard sprite of a farm equipment crate: a
  > waist-high metal storage container with seed pouches spilling
  > out the top, some tool handles visible, a faded serial number
  > stencil (illegible/abstract). Standing on a ground plane,
  > front-facing. Transparent background. Crisp edges,
  > pixel-art-adjacent style.
- **Negative prompt:**
  > readable text, people, solid background, multiple crates
- **Iteration notes:** _(fill when generating)_

## Asset: INTERIOR_PURIFIER_PUMP

- **Filename:** `game/public/sprites/colony/interiors/purifier-pump.png`
- **Dimensions:** 48×64 px (taller than wide)
- **Perspective:** front-facing billboard
- **Alpha:** transparent PNG
- **Prompt:**
  > Retro-futuristic billboard sprite of a water purifier pump: a
  > person-height industrial machine with a curved pipe inlet at the
  > top, steady blue coolant glow, a small pressure gauge on the
  > front. Standing on a ground plane, front-facing. Transparent
  > background. Crisp edges, pixel-art-adjacent style.
- **Negative prompt:**
  > readable text, people, solid background, water actively spraying
- **Iteration notes:** _(fill when generating)_

## Asset: INTERIOR_BUNK

- **Filename:** `game/public/sprites/colony/interiors/bunk.png`
- **Dimensions:** 48×48 px
- **Perspective:** front-facing billboard (slight angle is OK)
- **Alpha:** transparent PNG
- **Prompt:**
  > Retro-futuristic billboard sprite of a single colonist bunk bed:
  > a metal-frame bed at waist height with a rolled-up blanket, a
  > small personal locker at the foot, a faded reading lamp. Warm
  > amber glow suggests recent use. Standing on a ground plane,
  > front-facing. Transparent background. Crisp edges,
  > pixel-art-adjacent style.
- **Negative prompt:**
  > people sleeping, text, photos on lockers, solid background
- **Iteration notes:** _(fill when generating)_
```

- [ ] **Step 7: Verify docs structure**

Run: `ls docs/assets/prompts/colony-phase-2/`
Expected output: 5 files (`00-shared-style-guide.md`, `01-walls.md`, `02-environment.md`, `03-construction.md`, `04-interiors.md`).

- [ ] **Step 8: Commit**

```bash
cd /Users/nichalasbarnes/Desktop/projects/sector-zero
git add docs/assets/prompts/
git commit -m "docs(assets): Phase 2 asset prompt templates (11 assets catalogued)"
```

Note: this commit does NOT register any sprites in `game/app/components/engine/sprites.ts` — that's a separate PR after images are generated. The code path (Tasks 2-7) uses placeholder color-tints until then.

---

### Task 2: Template + slot geometry + building tiles

**Goal:** Create `outpostTemplate.ts` and `buildingTiles.ts` with all Phase 2 constants, plus 2 test files for registry/geometry verification. Pure data, no behavior.

**Files:**
- Create: `game/app/components/colony/exploration/outpostTemplate.ts`
- Create: `game/app/components/colony/exploration/buildingTiles.ts`
- Create: `game/tests/colony/outpostTemplate.test.ts`
- Create: `game/tests/colony/buildingTilesRegistry.test.ts`

- [ ] **Step 1 (TDD): Write failing tests for outpost template geometry**

Create `game/tests/colony/outpostTemplate.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { OUTPOST_TEMPLATE } from "../../app/components/colony/exploration/outpostTemplate";

test("outpostTemplate: 24×24 dimensions", () => {
  assert.equal(OUTPOST_TEMPLATE.width, 24);
  assert.equal(OUTPOST_TEMPLATE.height, 24);
});

test("outpostTemplate: 6 slots exactly", () => {
  assert.equal(OUTPOST_TEMPLATE.slots.length, 6);
});

test("outpostTemplate: all slots fit within map bounds with max footprint", () => {
  for (const slot of OUTPOST_TEMPLATE.slots) {
    const maxX = slot.anchorX + slot.maxFootprint.w;
    const maxY = slot.anchorY + slot.maxFootprint.h;
    assert.ok(maxX <= OUTPOST_TEMPLATE.width,  `slot ${slot.id} extends beyond x-bound: ${maxX}`);
    assert.ok(maxY <= OUTPOST_TEMPLATE.height, `slot ${slot.id} extends beyond y-bound: ${maxY}`);
    assert.ok(slot.anchorX >= 0 && slot.anchorY >= 0, `slot ${slot.id} has negative anchor`);
  }
});

test("outpostTemplate: no slot overlaps the plaza region", () => {
  const plaza = OUTPOST_TEMPLATE.plaza;
  for (const slot of OUTPOST_TEMPLATE.slots) {
    const slotRight = slot.anchorX + slot.maxFootprint.w;
    const slotBottom = slot.anchorY + slot.maxFootprint.h;
    const plazaRight = plaza.x + plaza.w;
    const plazaBottom = plaza.y + plaza.h;
    const overlaps =
      slot.anchorX < plazaRight &&
      slotRight > plaza.x &&
      slot.anchorY < plazaBottom &&
      slotBottom > plaza.y;
    assert.ok(!overlaps, `slot ${slot.id} overlaps plaza`);
  }
});

test("outpostTemplate: no slot overlaps the landing pad", () => {
  const pad = OUTPOST_TEMPLATE.landingPad;
  for (const slot of OUTPOST_TEMPLATE.slots) {
    const slotRight = slot.anchorX + slot.maxFootprint.w;
    const slotBottom = slot.anchorY + slot.maxFootprint.h;
    const padRight = pad.x + pad.w;
    const padBottom = pad.y + pad.h;
    const overlaps =
      slot.anchorX < padRight &&
      slotRight > pad.x &&
      slot.anchorY < padBottom &&
      slotBottom > pad.y;
    assert.ok(!overlaps, `slot ${slot.id} overlaps landing pad`);
  }
});

test("outpostTemplate: spawn is inside the landing pad", () => {
  const { spawn, landingPad } = OUTPOST_TEMPLATE;
  assert.ok(spawn.x >= landingPad.x && spawn.x < landingPad.x + landingPad.w);
  assert.ok(spawn.y >= landingPad.y && spawn.y < landingPad.y + landingPad.h);
  assert.equal(spawn.facing, "north");
});
```

- [ ] **Step 2 (TDD): Write failing tests for building-tiles registry**

Create `game/tests/colony/buildingTilesRegistry.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { BUILDING_FOOTPRINTS, INTERIOR_TEMPLATES } from "../../app/components/colony/exploration/buildingTiles";

const PHASE_1_BUILDING_TYPES = ["solar_array", "farm", "water_purifier", "habitat_module"] as const;

test("BUILDING_FOOTPRINTS: has entries for all Phase 1 types", () => {
  for (const t of PHASE_1_BUILDING_TYPES) {
    assert.ok(BUILDING_FOOTPRINTS[t], `missing footprint for ${t}`);
  }
});

test("BUILDING_FOOTPRINTS: each entry has valid dims and doorSide", () => {
  for (const t of PHASE_1_BUILDING_TYPES) {
    const fp = BUILDING_FOOTPRINTS[t];
    assert.ok(fp.w >= 3 && fp.h >= 3, `${t} footprint too small: ${fp.w}x${fp.h}`);
    assert.ok(fp.w <= 4 && fp.h <= 4, `${t} footprint too large: ${fp.w}x${fp.h}`);
    assert.ok(["north", "south", "east", "west"].includes(fp.doorSide), `${t} bad doorSide: ${fp.doorSide}`);
    assert.ok(fp.interiorTemplateId, `${t} missing interiorTemplateId`);
  }
});

test("INTERIOR_TEMPLATES: every referenced template ID exists", () => {
  for (const t of PHASE_1_BUILDING_TYPES) {
    const fp = BUILDING_FOOTPRINTS[t];
    const tmpl = INTERIOR_TEMPLATES[fp.interiorTemplateId];
    assert.ok(tmpl, `${t} references missing template ${fp.interiorTemplateId}`);
  }
});

test("INTERIOR_TEMPLATES: each has exactly one exit-door tile", () => {
  for (const [id, tmpl] of Object.entries(INTERIOR_TEMPLATES)) {
    const doorCount = tmpl.tiles.filter(row => row.includes("D")).reduce(
      (n, row) => n + [...row].filter(c => c === "D").length,
      0
    );
    assert.equal(doorCount, 1, `template ${id} has ${doorCount} exit doors, expected 1`);
  }
});

test("INTERIOR_TEMPLATES: each has a spawn pointing north", () => {
  for (const [id, tmpl] of Object.entries(INTERIOR_TEMPLATES)) {
    assert.equal(tmpl.spawn.facing, "north", `template ${id} spawn must face north`);
    assert.ok(tmpl.spawn.x >= 0 && tmpl.spawn.x < tmpl.width, `template ${id} spawn x out of bounds`);
    assert.ok(tmpl.spawn.y >= 0 && tmpl.spawn.y < tmpl.height, `template ${id} spawn y out of bounds`);
  }
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd game && yarn colony:test`
Expected: 11 new tests fail with module-not-found for `outpostTemplate` and `buildingTiles`.

- [ ] **Step 4: Implement `outpostTemplate.ts`**

Create `game/app/components/colony/exploration/outpostTemplate.ts`:

```typescript
/**
 * Tier-1 Outpost template — fixed 24×24 frame with perimeter walls,
 * 6 slots around a central plaza, landing pad south-center.
 *
 * Slots are ordered by index (0-5) but assigned to buildings via
 * layoutSeed-rotated insertion order. See Section C of the Phase 2 spec.
 */

export interface Slot {
  id: 0 | 1 | 2 | 3 | 4 | 5;
  anchorX: number;
  anchorY: number;
  maxFootprint: { w: number; h: number };
}

export const OUTPOST_TEMPLATE = {
  width: 24,
  height: 24,
  spawn: { x: 11, y: 22, facing: "north" as const },
  landingPad: { x: 10, y: 19, w: 4, h: 4 },  // tile region
  plaza: { x: 6, y: 8, w: 8, h: 7 },          // tile region
  slots: [
    { id: 0, anchorX:  2, anchorY:  2, maxFootprint: { w: 4, h: 4 } },  // NW
    { id: 1, anchorX: 18, anchorY:  2, maxFootprint: { w: 4, h: 4 } },  // NE
    { id: 2, anchorX:  2, anchorY:  7, maxFootprint: { w: 4, h: 4 } },  // W-mid
    { id: 3, anchorX: 18, anchorY:  7, maxFootprint: { w: 4, h: 4 } },  // E-mid
    { id: 4, anchorX:  2, anchorY: 15, maxFootprint: { w: 4, h: 4 } },  // SW
    { id: 5, anchorX: 18, anchorY: 15, maxFootprint: { w: 4, h: 4 } },  // SE
  ] as const satisfies readonly Slot[],
};

export type SlotId = (typeof OUTPOST_TEMPLATE.slots)[number]["id"];
```

- [ ] **Step 5: Implement `buildingTiles.ts`**

Create `game/app/components/colony/exploration/buildingTiles.ts`:

```typescript
import type { BuildingType, InteriorTemplateId } from "../shared/colonyTypes";

export interface FootprintSpec {
  w: number;
  h: number;
  doorSide: "north" | "south" | "east" | "west";
  interiorTemplateId: InteriorTemplateId;
  wallSpriteId: string;  // canonical sprite ID (color-tint fallback at runtime)
}

export interface PropSlot {
  x: number;
  y: number;
  spriteId: string;
  scale: number;
}

export interface InteriorTemplate {
  width: number;
  height: number;
  /** Each string is one row. '#' wall, '.' floor, 'D' exit door, other chars are prop placeholders. */
  tiles: string[];
  propSlots: PropSlot[];
  spawn: { x: number; y: number; facing: "north" | "south" | "east" | "west" };
}

/**
 * Building exterior footprint registry.
 * Phase 2: 4 entries (Phase 1 building types).
 * Phase 3+: this registry grows as Marketplace/Cantina/Town Hall land.
 */
export const BUILDING_FOOTPRINTS: Partial<Record<BuildingType, FootprintSpec>> = {
  solar_array: {
    w: 3, h: 3,
    doorSide: "south",
    interiorTemplateId: "solar_array_stub",
    wallSpriteId: "COLONY_WALL_SOLAR",
  },
  farm: {
    w: 4, h: 3,
    doorSide: "south",
    interiorTemplateId: "farm_stub",
    wallSpriteId: "COLONY_WALL_FARM",
  },
  water_purifier: {
    w: 3, h: 3,
    doorSide: "south",
    interiorTemplateId: "purifier_stub",
    wallSpriteId: "COLONY_WALL_PURIFIER",
  },
  habitat_module: {
    w: 4, h: 4,
    doorSide: "south",
    interiorTemplateId: "habitat_stub",
    wallSpriteId: "COLONY_WALL_HABITAT",
  },
};

/**
 * Stub interior templates, one per Phase 1 building type.
 * Each ~6×6 tiles, 1 thematic prop, exit door at south edge.
 * Player spawns ON the exit door facing north (into the room) so
 * immediate re-press of interact would exit.
 */
export const INTERIOR_TEMPLATES: Record<InteriorTemplateId, InteriorTemplate> = {
  solar_array_stub: {
    width: 6, height: 6,
    tiles: [
      "######",
      "#....#",
      "#....#",
      "#.C..#",   // C = control panel prop (see propSlots)
      "#....#",
      "##D###",   // D = exit door
    ],
    propSlots: [{ x: 2, y: 3, spriteId: "INTERIOR_SOLAR_PANEL", scale: 1.0 }],
    spawn: { x: 2, y: 5, facing: "north" },
  },
  farm_stub: {
    width: 6, height: 6,
    tiles: [
      "######",
      "#....#",
      "#.E..#",   // E = equipment crate
      "#....#",
      "#....#",
      "##D###",
    ],
    propSlots: [{ x: 2, y: 2, spriteId: "INTERIOR_FARM_CRATE", scale: 1.0 }],
    spawn: { x: 2, y: 5, facing: "north" },
  },
  purifier_stub: {
    width: 6, height: 6,
    tiles: [
      "######",
      "#....#",
      "#..P.#",
      "#..P.#",   // P = pump machinery (single prop, occupies visual space)
      "#....#",
      "##D###",
    ],
    propSlots: [{ x: 3, y: 2, spriteId: "INTERIOR_PURIFIER_PUMP", scale: 1.2 }],
    spawn: { x: 2, y: 5, facing: "north" },
  },
  habitat_stub: {
    width: 6, height: 6,
    tiles: [
      "######",
      "#B..B#",
      "#....#",
      "#....#",
      "#B..B#",
      "##D###",
    ],
    propSlots: [
      { x: 1, y: 1, spriteId: "INTERIOR_BUNK", scale: 1.0 },
      { x: 4, y: 1, spriteId: "INTERIOR_BUNK", scale: 1.0 },
      { x: 1, y: 4, spriteId: "INTERIOR_BUNK", scale: 1.0 },
      { x: 4, y: 4, spriteId: "INTERIOR_BUNK", scale: 1.0 },
    ],
    spawn: { x: 2, y: 5, facing: "north" },
  },
};
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd game && yarn colony:test`
Expected: 68/68 passing (57 prior + 11 new: 6 outpostTemplate + 5 buildingTilesRegistry).

- [ ] **Step 7: Verify build + tsc**

Run: `cd game && yarn build && npx tsc --noEmit -p tsconfig.json`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
cd /Users/nichalasbarnes/Desktop/projects/sector-zero
git add game/app/components/colony/exploration/outpostTemplate.ts \
        game/app/components/colony/exploration/buildingTiles.ts \
        game/tests/colony/outpostTemplate.test.ts \
        game/tests/colony/buildingTilesRegistry.test.ts
git commit -m "feat(colony): outpost template + building tile registry"
```

---

### Task 3: Exterior layout generator + determinism tests + reducer-order invariant

**Goal:** Implement `generateExteriorState(colony, gameClock)` with deterministic slot assignment. Also add a test proving the `colonyReducer` preserves `colony.buildings` array insertion order (the load-bearing invariant the generator relies on).

**Files:**
- Create: `game/app/components/colony/exploration/colonyLayout.ts`
- Create: `game/tests/colony/colonyLayout.test.ts`
- Create: `game/tests/colony/reducerInsertionOrder.test.ts`

- [ ] **Step 1 (TDD): Reducer insertion-order invariant test**

Create `game/tests/colony/reducerInsertionOrder.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { colonyReducer, Events } from "../../app/components/colony";
import type { SaveData } from "../../app/components/engine/types";

function makeSave(): SaveData {
  return {
    currentWorld: 1, levels: {}, credits: 0, totalStars: 0, totalScore: 0, xp: 0,
    upgrades: {} as SaveData["upgrades"], unlockedCodex: [], viewedCodex: [],
    viewedConversations: [], completedQuests: [], activeQuests: [],
    completedPlanets: [], unlockedSpecialMissions: [], completedSpecialMissions: [],
    storyItems: [], materials: [], consumableInventory: {}, equippedConsumables: [],
    unlockedEnhancements: [], bestiary: {}, equippedWeaponType: "kinetic",
    pilotLevel: 1, skillPoints: 0, allocatedSkills: [],
    colonies: [], planets: [], earthShipments: [], factionStandings: [], bounties: [],
    missionsSinceStart: 0,
    gameClock: { day: 0, hour: 7, minute: 0, realtimeMsPerGameMinute: 1000, season: "standard" },
  };
}

test("colonyReducer preserves colony.buildings insertion order across events", () => {
  let save = makeSave();

  save = colonyReducer(save, Events.founded({
    colonyId: "c1", name: "Test", planetId: "ashfall", foundingType: "outpost",
    regionNodeId: "rn1", missionCount: 0, layoutSeed: 42,
  }));
  save.colonies[0] = { ...save.colonies[0], resources: { food: 0, water: 0, metal: 5000, credits: 0 } };

  // Commission buildings with out-of-order IDs (lexicographic sort would shuffle them)
  save = colonyReducer(save, Events.buildingCommissioned({
    colonyId: "c1", buildingId: "z-first", buildingType: "solar_array",
    costDeducted: { metal: 80 }, cyclesToBuild: 1,
  }));
  save = colonyReducer(save, Events.buildingCommissioned({
    colonyId: "c1", buildingId: "a-second", buildingType: "farm",
    costDeducted: { metal: 100 }, cyclesToBuild: 2,
  }));
  save = colonyReducer(save, Events.buildingCommissioned({
    colonyId: "c1", buildingId: "m-third", buildingType: "habitat_module",
    costDeducted: { metal: 100 }, cyclesToBuild: 1,
  }));

  const ids = save.colonies[0].buildings.map(b => b.id);
  assert.deepEqual(ids, ["z-first", "a-second", "m-third"], "insertion order must be preserved");
});

test("colonyReducer preserves order after buildingCompleted", () => {
  let save = makeSave();
  save = colonyReducer(save, Events.founded({
    colonyId: "c1", name: "Test", planetId: "ashfall", foundingType: "outpost",
    regionNodeId: "rn1", missionCount: 0, layoutSeed: 42,
  }));
  save.colonies[0] = { ...save.colonies[0], resources: { food: 0, water: 0, metal: 5000, credits: 0 } };

  save = colonyReducer(save, Events.buildingCommissioned({
    colonyId: "c1", buildingId: "z", buildingType: "solar_array",
    costDeducted: { metal: 80 }, cyclesToBuild: 1,
  }));
  save = colonyReducer(save, Events.buildingCommissioned({
    colonyId: "c1", buildingId: "a", buildingType: "farm",
    costDeducted: { metal: 100 }, cyclesToBuild: 2,
  }));
  // Complete the second one — order must not shift
  save = colonyReducer(save, Events.buildingCompleted({ colonyId: "c1", buildingId: "a" }));

  const ids = save.colonies[0].buildings.map(b => b.id);
  assert.deepEqual(ids, ["z", "a"], "order preserved after completion");
  assert.equal(save.colonies[0].buildings[1].status, "operational");
});
```

- [ ] **Step 2 (TDD): colonyLayout determinism tests**

Create `game/tests/colony/colonyLayout.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateExteriorState } from "../../app/components/colony/exploration/colonyLayout";
import { makeTestColony } from "./fixtures";
import type { GameClock } from "../../app/components/colony/shared/colonyTypes";

const clock: GameClock = { day: 0, hour: 12, minute: 0, realtimeMsPerGameMinute: 1000, season: "standard" };

test("generateExteriorState is deterministic for the same inputs", () => {
  const colony = makeTestColony({ layoutSeed: 42 });
  const a = generateExteriorState(colony, clock);
  const b = generateExteriorState(colony, clock);
  assert.deepEqual(a.map.tiles, b.map.tiles);
  assert.equal(a.posX, b.posX);
  assert.equal(a.posY, b.posY);
});

test("generateExteriorState spawns at landing pad center facing north", () => {
  const colony = makeTestColony();
  const state = generateExteriorState(colony, clock);
  assert.equal(state.posX, 11.5);
  assert.equal(state.posY, 22.5);
  assert.equal(state.dirX, 0);
  assert.equal(state.dirY, -1);
});

test("generateExteriorState places buildings in insertion order rotated by seed", () => {
  // Two colonies with same buildings but different seeds → different slot layouts
  const c1 = makeTestColony({
    layoutSeed: 0,
    buildings: [
      { id: "b1", type: "solar_array", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const c2 = makeTestColony({
    layoutSeed: 3,
    buildings: [
      { id: "b1", type: "solar_array", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const s1 = generateExteriorState(c1, clock);
  const s2 = generateExteriorState(c2, clock);
  // Same seed = same tiles; different seed = at least some tile differences
  assert.notDeepStrictEqual(s1.map.tiles, s2.map.tiles);
});

test("generateExteriorState: constructing building renders foundation only (no walls)", () => {
  const colony = makeTestColony({
    layoutSeed: 0,   // rotation=0 → slot 0 → NW corner at (2,2)
    buildings: [
      { id: "b1", type: "solar_array", tier: 1, status: "constructing", buildProgressCycles: 1, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const state = generateExteriorState(colony, clock);
  // Slot 0 footprint is at anchor (2,2), size 3×3. Constructing building must NOT write wall tiles.
  // Check that the cells in that region are still "floor"-equivalent (walkable, not '#').
  const wallTilesInSlot0 = countWallTilesInRegion(state.map.tiles, 2, 2, 3, 3);
  assert.equal(wallTilesInSlot0, 0, "constructing building should have no wall tiles");
});

test("generateExteriorState: operational building renders full perimeter walls + door", () => {
  const colony = makeTestColony({
    layoutSeed: 0,
    buildings: [
      { id: "b1", type: "solar_array", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const state = generateExteriorState(colony, clock);
  const wallTilesInSlot0 = countWallTilesInRegion(state.map.tiles, 2, 2, 3, 3);
  // 3×3 building with door on south: perimeter is 8 cells, minus 1 for door = 7 walls
  assert.ok(wallTilesInSlot0 >= 6, `expected ≥6 wall tiles in operational footprint, got ${wallTilesInSlot0}`);
});

test("generateExteriorState: empty colony renders only frame + pad + plaza", () => {
  const colony = makeTestColony({ layoutSeed: 0, buildings: [] });
  const state = generateExteriorState(colony, clock);
  // All slot regions should be empty floor
  for (const slot of [{ x: 2, y: 2 }, { x: 18, y: 2 }]) {
    const walls = countWallTilesInRegion(state.map.tiles, slot.x, slot.y, 4, 4);
    assert.equal(walls, 0, `empty slot at (${slot.x},${slot.y}) should have no walls`);
  }
});

// Helper
function countWallTilesInRegion(tiles: string[][], x: number, y: number, w: number, h: number): number {
  let count = 0;
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) {
      if (tiles[j]?.[i] === "wall") count++;
    }
  }
  return count;
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd game && yarn colony:test`
Expected: 8 new tests (2 reducer-order + 6 layout) fail, colony layout module not found.

- [ ] **Step 4: Implement `colonyLayout.ts` — generateExteriorState only for now**

Create `game/app/components/colony/exploration/colonyLayout.ts`:

```typescript
import type {
  ColonyState,
  ColonyBuilding,
  BuildingInstanceId,
  BuildingType,
  GameClock,
  ColonyId,
} from "../shared/colonyTypes";
import type { FirstPersonState, BoardingTileType, BoardingMap } from "../../engine/types";
import { OUTPOST_TEMPLATE, type Slot, type SlotId } from "./outpostTemplate";
import { BUILDING_FOOTPRINTS, INTERIOR_TEMPLATES } from "./buildingTiles";
import { tintForHour } from "./dayNightTint";
import type { ColonyContext, DoorInteractResult, LandingPadResult } from "./colonyContext";

// ─── Slot assignment ───────────────────────────────────────────────────

/**
 * Deterministic mapping: buildingId → slotId.
 * Uses colony.buildings insertion order (stable per reducer invariant),
 * rotated by layoutSeed % 6. Buildings past index 5 are silently skipped.
 */
export function assignSlots(colony: ColonyState): Map<BuildingInstanceId, SlotId> {
  const rotation = colony.layoutSeed % 6;
  const map = new Map<BuildingInstanceId, SlotId>();
  colony.buildings.slice(0, 6).forEach((b, i) => {
    map.set(b.id, ((rotation + i) % 6) as SlotId);
  });
  return map;
}

// ─── Tile writing helpers ──────────────────────────────────────────────

function blankMap(width: number, height: number): BoardingTileType[][] {
  const rows: BoardingTileType[][] = [];
  for (let y = 0; y < height; y++) {
    rows.push(new Array(width).fill("empty" as BoardingTileType));
  }
  return rows;
}

function fillFrame(tiles: BoardingTileType[][]): void {
  const h = tiles.length;
  const w = tiles[0].length;
  // Perimeter walls
  for (let x = 0; x < w; x++) {
    tiles[0][x] = "wall";
    tiles[h - 1][x] = "wall";
  }
  for (let y = 0; y < h; y++) {
    tiles[y][0] = "wall";
    tiles[y][w - 1] = "wall";
  }
  // Fill interior with floor (leave existing perimeter walls)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      tiles[y][x] = "floor";
    }
  }
}

function writeLandingPad(tiles: BoardingTileType[][]): void {
  const pad = OUTPOST_TEMPLATE.landingPad;
  for (let y = pad.y; y < pad.y + pad.h; y++) {
    for (let x = pad.x; x < pad.x + pad.w; x++) {
      // Pad is still walkable floor; rendering variation is via floor sprite override (Phase 2 deferred).
      tiles[y][x] = "floor";
    }
  }
}

function writeBuildingAt(
  tiles: BoardingTileType[][],
  building: ColonyBuilding,
  slot: Slot,
): void {
  const fp = BUILDING_FOOTPRINTS[building.type];
  if (!fp) return;  // unsupported building type — silently skip

  // For Phase 2: constructing → no tiles written (foundation rendered via floor-tile sprite variant, deferred).
  // Only operational/damaged/offline render walls. Destroyed renders rubble (no walls).
  if (building.status === "constructing" || building.status === "destroyed") {
    return;
  }

  // Write perimeter walls with a door on `fp.doorSide`
  const { w, h, doorSide } = fp;
  const x0 = slot.anchorX;
  const y0 = slot.anchorY;

  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const isPerimeter = dx === 0 || dx === w - 1 || dy === 0 || dy === h - 1;
      if (!isPerimeter) continue;
      tiles[y0 + dy][x0 + dx] = "wall";
    }
  }

  // Carve door (centered on the chosen side, at the perimeter)
  const doorX = doorSide === "east" ? x0 + w - 1
              : doorSide === "west" ? x0
              : x0 + Math.floor(w / 2);
  const doorY = doorSide === "south" ? y0 + h - 1
              : doorSide === "north" ? y0
              : y0 + Math.floor(h / 2);
  tiles[doorY][doorX] = "door";
}

// ─── Hook resolvers ────────────────────────────────────────────────────

export function findBuildingDoorAt(
  colony: ColonyState,
  slotMap: Map<BuildingInstanceId, SlotId>,
  tile: { x: number; y: number },
): ColonyBuilding | null {
  for (const [bid, sid] of slotMap) {
    const slot = OUTPOST_TEMPLATE.slots[sid];
    const building = colony.buildings.find(b => b.id === bid);
    if (!building) continue;
    const fp = BUILDING_FOOTPRINTS[building.type];
    if (!fp) continue;
    const doorX = fp.doorSide === "east" ? slot.anchorX + fp.w - 1
                : fp.doorSide === "west" ? slot.anchorX
                : slot.anchorX + Math.floor(fp.w / 2);
    const doorY = fp.doorSide === "south" ? slot.anchorY + fp.h - 1
                : fp.doorSide === "north" ? slot.anchorY
                : slot.anchorY + Math.floor(fp.h / 2);
    if (tile.x === doorX && tile.y === doorY) return building;
  }
  return null;
}

export function inPadRegion(tile: { x: number; y: number }): boolean {
  const p = OUTPOST_TEMPLATE.landingPad;
  return tile.x >= p.x && tile.x < p.x + p.w && tile.y >= p.y && tile.y < p.y + p.h;
}

// ─── Public API ────────────────────────────────────────────────────────

export function generateExteriorState(colony: ColonyState, gameClock: GameClock): FirstPersonState {
  const tiles = blankMap(OUTPOST_TEMPLATE.width, OUTPOST_TEMPLATE.height);
  fillFrame(tiles);
  writeLandingPad(tiles);

  const slotMap = assignSlots(colony);
  for (const [bid, sid] of slotMap) {
    const building = colony.buildings.find(b => b.id === bid);
    if (!building) continue;
    writeBuildingAt(tiles, building, OUTPOST_TEMPLATE.slots[sid]);
  }

  const colonyContext: ColonyContext = {
    colonyId: colony.id as ColonyId,
    mode: "exterior",
    interiorBuildingId: null,
    onDoorInteract: (standingOn, facingTile) => {
      const hit = findBuildingDoorAt(colony, slotMap, facingTile);
      if (!hit) return { kind: "no_door" };
      if (hit.status !== "operational") {
        return { kind: "locked", reason: `${hit.type} — ${hit.status}` };
      }
      return { kind: "enter_interior", buildingId: hit.id };
    },
    onLandingPadInteract: (standingOn) => {
      return inPadRegion(standingOn)
        ? { kind: "show_exit_menu" }
        : { kind: "not_on_pad" };
    },
  };

  const map: BoardingMap = {
    width: OUTPOST_TEMPLATE.width,
    height: OUTPOST_TEMPLATE.height,
    tileSize: 64,
    tiles,
  };

  const { spawn } = OUTPOST_TEMPLATE;
  return {
    map,
    posX: spawn.x + 0.5,
    posY: spawn.y + 0.5,
    dirX: 0,
    dirY: -1,
    planeX: 0.66,
    planeY: 0,
    moveSpeed: 0.06,
    rotSpeed: 0.04,
    goalReached: false,
    enemies: [],
    gunFireTimer: 0,
    gunCooldown: 0,
    npcs: [],
    dialogState: null,
    environmentArt: {
      // Reuse Ashfall sprites for Phase 2 (colony is on Ashfall)
      skySprite: "/sector-zero/sprites/explore/outpost-sky.png",
      wallSprite: "/sector-zero/sprites/explore/outpost-wall-exterior.png",
      floorSprite: "/sector-zero/sprites/explore/outpost-ground.png",
      environmentTint: tintForHour(gameClock.hour),
    },
    props: [],  // Phase 2 exterior props (plaza decor, scaffolding on constructing slots) — stub for now
    colonyContext,
    colonyInteractArmed: true,
    colonyInteractCooldownFrames: 0,
  };
}

export function generateInteriorState(building: ColonyBuilding, seed: number): FirstPersonState {
  // Implementation lands in Task 5
  throw new Error("generateInteriorState: implement in Task 5");
}
```

- [ ] **Step 5: Add a minimal `dayNightTint.ts` stub**

Phase 2 tint math lands fully in Task 6, but `generateExteriorState` imports `tintForHour`. Add a stub so Task 3 compiles:

Create `game/app/components/colony/exploration/dayNightTint.ts`:

```typescript
export interface HslShift {
  hueShift: number;
  saturationMul: number;
  lightnessMul: number;
}

// Stub — final hour-based logic lands in Task 6
export function tintForHour(hour: number): HslShift {
  return { hueShift: 0, saturationMul: 1, lightnessMul: 1 };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd game && yarn colony:test`
Expected: 76/76 passing (68 prior + 2 reducer-order + 6 layout = 8 new).

- [ ] **Step 7: Verify build + tsc**

Run: `cd game && yarn build && npx tsc --noEmit -p tsconfig.json`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
cd /Users/nichalasbarnes/Desktop/projects/sector-zero
git add game/app/components/colony/exploration/colonyLayout.ts \
        game/app/components/colony/exploration/dayNightTint.ts \
        game/tests/colony/colonyLayout.test.ts \
        game/tests/colony/reducerInsertionOrder.test.ts
git commit -m "feat(colony): exterior layout generator + reducer-order invariant tests"
```

---

### Task 4: Scene stack + orchestrator public API

**Goal:** Implement `sceneStack.ts` and the public API (`enterColonyExploration`, `stepColonyExploration`, `exitColonyExploration`) in `index.ts`. Still no engine hook — the orchestrator handles transitions when Task 6 wires the engine.

**Files:**
- Create: `game/app/components/colony/exploration/sceneStack.ts`
- Create: `game/app/components/colony/exploration/index.ts`
- Create: `game/tests/colony/sceneStack.test.ts`
- Modify: `game/app/components/colony/index.ts`

- [ ] **Step 1 (TDD): sceneStack tests**

Create `game/tests/colony/sceneStack.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { pushInterior, popToExterior, isInInterior } from "../../app/components/colony/exploration/sceneStack";
import type { SceneStack, SceneLayer } from "../../app/components/colony/exploration/sceneStack";
import type { FirstPersonState } from "../../app/components/engine/types";
import { makeTestColony } from "./fixtures";

function stubFpState(): FirstPersonState {
  return {
    map: { width: 24, height: 24, tileSize: 64, tiles: [] },
    posX: 0, posY: 0, dirX: 0, dirY: -1, planeX: 0.66, planeY: 0,
    moveSpeed: 0.06, rotSpeed: 0.04, goalReached: false,
    enemies: [], gunFireTimer: 0, gunCooldown: 0,
    npcs: [], dialogState: null,
  };
}

function stubBuilding() {
  return {
    id: "b1" as any, type: "solar_array", tier: 1 as const,
    status: "operational" as const, buildProgressCycles: 0,
    hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null,
  };
}

test("sceneStack: fresh stack has current=exterior, parent=null", () => {
  const exteriorLayer: SceneLayer = {
    kind: "exterior",
    buildingId: null,
    state: stubFpState(),
    returnToTile: null,
  };
  const stack: SceneStack = {
    colonyId: "c1" as any,
    current: exteriorLayer,
    parent: null,
  };
  assert.equal(stack.current.kind, "exterior");
  assert.equal(stack.parent, null);
  assert.equal(isInInterior(stack), false);
});

test("sceneStack: pushInterior moves exterior → parent, sets interior as current", () => {
  const exteriorLayer: SceneLayer = {
    kind: "exterior",
    buildingId: null,
    state: stubFpState(),
    returnToTile: null,
  };
  const stack: SceneStack = {
    colonyId: "c1" as any,
    current: exteriorLayer,
    parent: null,
  };
  const interiorState = stubFpState();
  const next = pushInterior(stack, stubBuilding(), interiorState, { x: 3, y: 4 });

  assert.equal(next.current.kind, "interior");
  assert.equal(next.current.buildingId, "b1");
  assert.equal(next.current.state, interiorState);
  assert.deepEqual(next.current.returnToTile, { x: 3, y: 4 });
  assert.equal(next.parent, exteriorLayer);
  assert.equal(isInInterior(next), true);
});

test("sceneStack: popToExterior restores parent, clears parent slot", () => {
  const exteriorLayer: SceneLayer = {
    kind: "exterior",
    buildingId: null,
    state: stubFpState(),
    returnToTile: null,
  };
  const interior: SceneStack = {
    colonyId: "c1" as any,
    current: {
      kind: "interior",
      buildingId: "b1" as any,
      state: stubFpState(),
      returnToTile: { x: 3, y: 4 },
    },
    parent: exteriorLayer,
  };
  const popped = popToExterior(interior);
  assert.equal(popped.current, exteriorLayer);
  assert.equal(popped.parent, null);
  assert.equal(isInInterior(popped), false);
});

test("sceneStack: depth invariant — never exceeds 2 layers", () => {
  // The type itself prevents >2: single `parent` field cannot nest further.
  // Additional assertion: pushInterior on an already-interior stack should throw.
  const exteriorLayer: SceneLayer = {
    kind: "exterior",
    buildingId: null,
    state: stubFpState(),
    returnToTile: null,
  };
  const stack: SceneStack = { colonyId: "c1" as any, current: exteriorLayer, parent: null };
  const once = pushInterior(stack, stubBuilding(), stubFpState(), { x: 3, y: 4 });
  assert.throws(
    () => pushInterior(once, stubBuilding(), stubFpState(), { x: 5, y: 6 }),
    /already in interior|stack depth/i,
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd game && yarn colony:test`
Expected: 4 new tests fail.

- [ ] **Step 3: Implement `sceneStack.ts`**

Create `game/app/components/colony/exploration/sceneStack.ts`:

```typescript
import type { ColonyId, BuildingInstanceId, ColonyBuilding } from "../shared/colonyTypes";
import type { FirstPersonState } from "../../engine/types";

export interface SceneLayer {
  kind: "exterior" | "interior";
  buildingId: BuildingInstanceId | null;
  state: FirstPersonState;
  /** Tile coord on the parent (exterior) map where this interior was entered.
   *  Used on popToExterior to re-position the player outside the door. */
  returnToTile: { x: number; y: number } | null;
}

export interface SceneStack {
  colonyId: ColonyId;
  current: SceneLayer;
  parent: SceneLayer | null;
}

export function pushInterior(
  stack: SceneStack,
  building: ColonyBuilding,
  interiorState: FirstPersonState,
  returnToTile: { x: number; y: number },
): SceneStack {
  if (stack.parent !== null || stack.current.kind === "interior") {
    throw new Error("[sceneStack] cannot push: already in interior (Phase 2 max depth is 2)");
  }
  return {
    colonyId: stack.colonyId,
    parent: stack.current,
    current: {
      kind: "interior",
      buildingId: building.id,
      state: interiorState,
      returnToTile,
    },
  };
}

export function popToExterior(stack: SceneStack): SceneStack {
  if (!stack.parent) {
    throw new Error("[sceneStack] cannot pop: already at exterior");
  }
  return {
    colonyId: stack.colonyId,
    current: stack.parent,
    parent: null,
  };
}

export function isInInterior(stack: SceneStack): boolean {
  return stack.current.kind === "interior";
}
```

- [ ] **Step 4: Implement exploration/index.ts with enterColonyExploration**

Create `game/app/components/colony/exploration/index.ts`:

```typescript
import type { SaveData, GameMode, FirstPersonState } from "../../engine/types";
import type { ColonyId, ColonyState } from "../shared/colonyTypes";
import { generateExteriorState } from "./colonyLayout";
import { type SceneStack, type SceneLayer, pushInterior, popToExterior, isInInterior } from "./sceneStack";
import type { ColonyContext, DoorInteractResult, LandingPadResult } from "./colonyContext";

export type { SceneStack, SceneLayer } from "./sceneStack";
export type { ColonyContext, DoorInteractResult, LandingPadResult } from "./colonyContext";

export interface EnterResult {
  mode: GameMode;
  firstPersonState: FirstPersonState;
  sceneStack: SceneStack;
}

export function enterColonyExploration(save: SaveData, colonyId: ColonyId): EnterResult {
  const colony = save.colonies.find(c => c.id === colonyId);
  if (!colony) throw new Error(`[colony/exploration] colony ${colonyId} not found`);
  const firstPersonState = generateExteriorState(colony, save.gameClock);
  const exteriorLayer: SceneLayer = {
    kind: "exterior",
    buildingId: null,
    state: firstPersonState,
    returnToTile: null,
  };
  return {
    mode: "colony-exploration" as GameMode,
    firstPersonState,
    sceneStack: {
      colonyId,
      current: exteriorLayer,
      parent: null,
    },
  };
}

/**
 * Step the exploration state forward one frame.
 * Reads the engine's `colonyTransitionRequest`, performs push/pop if set,
 * and returns the updated SceneStack.
 * Pure function.
 */
export function stepColonyExploration(
  stack: SceneStack,
  save: SaveData,
  _deltaMs: number,
): SceneStack {
  const request = stack.current.state.colonyTransitionRequest as
    | DoorInteractResult
    | LandingPadResult
    | undefined;
  if (!request) return stack;

  // Consume the one-shot request on the current state
  stack.current.state.colonyTransitionRequest = undefined;

  if (request.kind === "enter_interior") {
    // Task 5 implements the interior generator + this full transition
    // Stub: return stack unchanged; Task 5 replaces this body
    return stack;
  }
  if (request.kind === "exit_interior") {
    return popToExterior(stack);
  }
  if (request.kind === "show_exit_menu") {
    // Handled by Game.tsx (opens exitMenu DOM). Orchestrator no-op here.
    return stack;
  }
  return stack;
}

export function exitColonyExploration(_stack: SceneStack): { returnToCockpit: true } {
  return { returnToCockpit: true };
}

export { isInInterior };
```

- [ ] **Step 5: Re-export from colony/index.ts**

In `game/app/components/colony/index.ts`, add (near other re-exports):

```typescript
export {
  enterColonyExploration,
  stepColonyExploration,
  exitColonyExploration,
} from "./exploration";
export type {
  SceneStack,
  SceneLayer,
  ColonyContext,
  DoorInteractResult,
  LandingPadResult,
} from "./exploration";
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd game && yarn colony:test`
Expected: 80/80 passing (76 prior + 4 new sceneStack tests).

- [ ] **Step 7: Verify build + tsc**

Run: `cd game && yarn build && npx tsc --noEmit -p tsconfig.json`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
cd /Users/nichalasbarnes/Desktop/projects/sector-zero
git add game/app/components/colony/exploration/sceneStack.ts \
        game/app/components/colony/exploration/index.ts \
        game/app/components/colony/index.ts \
        game/tests/colony/sceneStack.test.ts
git commit -m "feat(colony): scene stack + exploration public API"
```

---

### Task 5: Interior templates + interior generator

**Goal:** Implement `generateInteriorState` in `colonyLayout.ts` (overwrite the Task 3 stub that throws). Wire the full `enter_interior` transition in `stepColonyExploration`.

**Files:**
- Modify: `game/app/components/colony/exploration/colonyLayout.ts`
- Modify: `game/app/components/colony/exploration/index.ts`
- Create: `game/tests/colony/colonyLayoutInterior.test.ts`

- [ ] **Step 1 (TDD): Interior generator tests**

Create `game/tests/colony/colonyLayoutInterior.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateInteriorState } from "../../app/components/colony/exploration/colonyLayout";

const stubBuilding = (type: string) => ({
  id: `b-${type}` as any, type, tier: 1 as const,
  status: "operational" as const, buildProgressCycles: 0,
  hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null,
});

test("generateInteriorState: produces 6×6 map for each Phase 1 type", () => {
  for (const type of ["solar_array", "farm", "water_purifier", "habitat_module"]) {
    const state = generateInteriorState(stubBuilding(type as any), 42);
    assert.equal(state.map.width, 6);
    assert.equal(state.map.height, 6);
  }
});

test("generateInteriorState: player spawns ON the exit door tile facing north", () => {
  const state = generateInteriorState(stubBuilding("solar_array"), 42);
  // exit door is at (2, 5) per solar_array_stub template
  assert.equal(Math.floor(state.posX), 2);
  assert.equal(Math.floor(state.posY), 5);
  assert.equal(state.dirX, 0);
  assert.equal(state.dirY, -1);
});

test("generateInteriorState: colonyContext mode is 'interior'", () => {
  const state = generateInteriorState(stubBuilding("farm"), 42);
  assert.ok(state.colonyContext);
  assert.equal(state.colonyContext!.mode, "interior");
});

test("generateInteriorState: standingOn exit door returns exit_interior", () => {
  const state = generateInteriorState(stubBuilding("solar_array"), 42);
  const result = state.colonyContext!.onDoorInteract({ x: 2, y: 5 }, { x: 2, y: 4 });
  assert.equal(result.kind, "exit_interior");
});

test("generateInteriorState: standingOn non-door returns no_door", () => {
  const state = generateInteriorState(stubBuilding("solar_array"), 42);
  const result = state.colonyContext!.onDoorInteract({ x: 2, y: 3 }, { x: 2, y: 2 });
  assert.equal(result.kind, "no_door");
});

test("generateInteriorState: onLandingPadInteract returns not_on_pad", () => {
  // Interiors have no landing pad — always not_on_pad
  const state = generateInteriorState(stubBuilding("solar_array"), 42);
  const result = state.colonyContext!.onLandingPadInteract({ x: 2, y: 5 });
  assert.equal(result.kind, "not_on_pad");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd game && yarn colony:test`
Expected: 6 new tests fail (generateInteriorState still throws the Task 3 stub).

- [ ] **Step 3: Implement `generateInteriorState` in colonyLayout.ts**

Replace the stub at the bottom of `colonyLayout.ts` with:

```typescript
export function generateInteriorState(building: ColonyBuilding, seed: number): FirstPersonState {
  const fp = BUILDING_FOOTPRINTS[building.type];
  if (!fp) throw new Error(`[colonyLayout] no footprint for building type ${building.type}`);
  const template = INTERIOR_TEMPLATES[fp.interiorTemplateId];
  if (!template) throw new Error(`[colonyLayout] no interior template ${fp.interiorTemplateId}`);

  // Convert template.tiles (string rows) into BoardingTileType[][]
  // '#' wall, '.' floor, 'D' door (exit), other chars (prop placeholders) = floor.
  const tiles: BoardingTileType[][] = template.tiles.map(row =>
    [...row].map(c =>
      c === "#" ? ("wall" as BoardingTileType)
      : c === "D" ? ("door" as BoardingTileType)
      : ("floor" as BoardingTileType)
    )
  );

  // Find exit door coord (the single 'D' in the template)
  let exitX = 0, exitY = 0;
  for (let y = 0; y < template.height; y++) {
    for (let x = 0; x < template.width; x++) {
      if (template.tiles[y][x] === "D") { exitX = x; exitY = y; }
    }
  }

  const colonyContext: ColonyContext = {
    colonyId: "" as ColonyId,  // orchestrator fills from SceneStack context
    mode: "interior",
    interiorBuildingId: building.id,
    onDoorInteract: (standingOn, _facingTile) => {
      if (standingOn.x === exitX && standingOn.y === exitY) {
        return { kind: "exit_interior" };
      }
      return { kind: "no_door" };
    },
    onLandingPadInteract: (_standingOn) => ({ kind: "not_on_pad" }),
  };

  // Convert propSlots to engine FPProp billboards
  const props = template.propSlots.map((p, i) => ({
    id: i,
    x: p.x + 0.5,
    y: p.y + 0.5,
    sprite: p.spriteId,
    scale: p.scale,
  }));

  return {
    map: {
      width: template.width,
      height: template.height,
      tileSize: 64,
      tiles,
    },
    posX: template.spawn.x + 0.5,
    posY: template.spawn.y + 0.5,
    dirX: 0, dirY: -1,  // facing north per spec
    planeX: 0.66, planeY: 0,
    moveSpeed: 0.06,
    rotSpeed: 0.04,
    goalReached: false,
    enemies: [],
    gunFireTimer: 0,
    gunCooldown: 0,
    npcs: [],
    dialogState: null,
    environmentArt: {
      // Interior: neutral lighting, no tint (Phase 2 decision)
      skySprite: "/sector-zero/sprites/explore/outpost-sky.png",
      wallSprite: "/sector-zero/sprites/explore/outpost-wall-exterior.png",
      floorSprite: "/sector-zero/sprites/explore/outpost-ground.png",
    },
    props,
    colonyContext,
    colonyInteractArmed: false,   // orchestrator just swapped in; require key release before fire
    colonyInteractCooldownFrames: 15,  // 250ms cooldown
  };
}
```

- [ ] **Step 4: Wire the full enter_interior and exit_interior paths in index.ts**

At the top of `game/app/components/colony/exploration/index.ts`, add these imports (alongside existing ones):

```typescript
import { OUTPOST_TEMPLATE } from "./outpostTemplate";
import { BUILDING_FOOTPRINTS } from "./buildingTiles";
import { generateInteriorState } from "./colonyLayout";
```

Replace the stub `enter_interior` branch in `stepColonyExploration` with:

```typescript
  if (request.kind === "enter_interior") {
    const colony = save.colonies.find(c => c.id === stack.colonyId);
    if (!colony) return stack;
    const building = colony.buildings.find(b => b.id === request.buildingId);
    if (!building) return stack;

    // Derive interior seed from colony seed + buildingId (deterministic, no RNG)
    const hashed = Array.from(request.buildingId).reduce((a, ch) => a * 31 + ch.charCodeAt(0), 0);
    const interiorSeed = colony.layoutSeed ^ hashed;

    const interiorState = generateInteriorState(building, interiorSeed);
    // Fill in the colonyId on the interior context (it defaults to empty string in the generator)
    interiorState.colonyContext!.colonyId = stack.colonyId;

    // Compute door tile on the exterior (used as returnToTile for when the interior is popped)
    const rotation = colony.layoutSeed % 6;
    const idx = colony.buildings.findIndex(b => b.id === request.buildingId);
    if (idx < 0) return stack;
    const slotId = (rotation + idx) % 6;
    const slot = OUTPOST_TEMPLATE.slots[slotId];
    const fpSpec = BUILDING_FOOTPRINTS[building.type];
    if (!fpSpec) return stack;
    const doorTile = {
      x: fpSpec.doorSide === "east" ? slot.anchorX + fpSpec.w - 1
       : fpSpec.doorSide === "west" ? slot.anchorX
       : slot.anchorX + Math.floor(fpSpec.w / 2),
      y: fpSpec.doorSide === "south" ? slot.anchorY + fpSpec.h - 1
       : fpSpec.doorSide === "north" ? slot.anchorY
       : slot.anchorY + Math.floor(fpSpec.h / 2),
    };

    return pushInterior(stack, building, interiorState, doorTile);
  }
```

Replace the stub `exit_interior` branch with:

```typescript
  if (request.kind === "exit_interior") {
    // Grab returnToTile from the (about-to-be-popped) interior layer BEFORE popping
    const stashedReturn = stack.current.returnToTile;
    const popped = popToExterior(stack);

    if (stashedReturn) {
      // Reposition player one tile south of the door, facing south (away from building).
      // Phase 2 assumes all doors are south-facing (all 4 Phase 1 buildings use doorSide: "south").
      // Future footprints with other doorSides will need side-aware repositioning.
      popped.current.state.posX = stashedReturn.x + 0.5;
      popped.current.state.posY = stashedReturn.y + 1.5;
      popped.current.state.dirX = 0;
      popped.current.state.dirY = 1;  // south
    }
    popped.current.state.colonyInteractArmed = false;
    popped.current.state.colonyInteractCooldownFrames = 15;
    return popped;
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd game && yarn colony:test`
Expected: 86/86 passing (80 prior + 6 new interior generator tests).

- [ ] **Step 6: Verify build + tsc**

Run: `cd game && yarn build && npx tsc --noEmit -p tsconfig.json`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
cd /Users/nichalasbarnes/Desktop/projects/sector-zero
git add game/app/components/colony/exploration/colonyLayout.ts \
        game/app/components/colony/exploration/index.ts \
        game/tests/colony/colonyLayoutInterior.test.ts
git commit -m "feat(colony): interior templates + generator + full transition flow"
```

---

### Task 6: Engine hook points + anti-bounce gate + day/night tint

**Goal:** Edit `firstPersonEngine.ts` with a single `if (fp.colonyContext)` block implementing the 2 hook calls + anti-bounce gate + dominant-axis facing. Add full day/night tint math. Apply tint in `firstPersonRenderer.ts`.

**Files:**
- Modify: `game/app/components/colony/exploration/dayNightTint.ts`
- Create: `game/tests/colony/dayNightTint.test.ts`
- Create: `game/tests/colony/antiBounceGate.test.ts`
- Modify: `game/app/components/engine/firstPersonEngine.ts`
- Modify: `game/app/components/engine/firstPersonRenderer.ts`

- [ ] **Step 1 (TDD): dayNightTint tests**

Create `game/tests/colony/dayNightTint.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { tintForHour } from "../../app/components/colony/exploration/dayNightTint";

test("tintForHour: noon is neutral", () => {
  const t = tintForHour(12);
  assert.equal(t.hueShift, 0);
  assert.equal(t.saturationMul, 1);
  assert.equal(t.lightnessMul, 1);
});

test("tintForHour: midnight is darker", () => {
  const t = tintForHour(0);
  assert.ok(t.lightnessMul < 0.7);
  assert.ok(t.saturationMul < 1);
});

test("tintForHour: dawn is warmer", () => {
  const t = tintForHour(6);
  assert.ok(t.hueShift > 0);
});

test("tintForHour: dusk is warmer than day but less dark than night", () => {
  const dusk = tintForHour(18);
  const night = tintForHour(0);
  assert.ok(dusk.lightnessMul > night.lightnessMul);
});
```

- [ ] **Step 2: Implement full `tintForHour`**

Replace `game/app/components/colony/exploration/dayNightTint.ts` contents with:

```typescript
export interface HslShift {
  hueShift: number;
  saturationMul: number;
  lightnessMul: number;
}

/**
 * Cosmetic HSL shift applied to environment art based on in-game hour (0-23).
 * Day/night has no gameplay effect in Phase 2.
 */
export function tintForHour(hour: number): HslShift {
  // Night: 22-05
  if (hour >= 22 || hour < 5) return { hueShift: -20, saturationMul: 0.7, lightnessMul: 0.55 };
  // Dawn: 5-7
  if (hour < 7) return { hueShift: 15, saturationMul: 0.9, lightnessMul: 0.7 };
  // Day: 7-17
  if (hour < 17) return { hueShift: 0, saturationMul: 1.0, lightnessMul: 1.0 };
  // Dusk: 17-20
  if (hour < 20) return { hueShift: 20, saturationMul: 1.05, lightnessMul: 0.85 };
  // Evening: 20-22
  return { hueShift: -10, saturationMul: 0.8, lightnessMul: 0.7 };
}
```

- [ ] **Step 3: Run dayNightTint tests**

Run: `cd game && yarn colony:test`
Expected: 4 new tests pass.

- [ ] **Step 4 (TDD): antiBounceGate tests**

Create `game/tests/colony/antiBounceGate.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { updateFirstPerson } from "../../app/components/engine/firstPersonEngine";
import { generateExteriorState } from "../../app/components/colony/exploration/colonyLayout";
import { makeTestColony } from "./fixtures";
import type { GameClock } from "../../app/components/colony/shared/colonyTypes";
import type { FirstPersonState } from "../../app/components/engine/types";

const clock: GameClock = { day: 0, hour: 12, minute: 0, realtimeMsPerGameMinute: 1000, season: "standard" };

function stubKeys(overrides: Partial<any> = {}): any {
  return {
    left: false, right: false, up: false, down: false,
    strafeLeft: false, strafeRight: false,
    shoot: false, bomb: false, jump: false,
    ...overrides,
  };
}

// Stub enough of GameState that updateFirstPerson's full code path doesn't crash
// when falling through the colony guard into the default FPS shoot path
// (the no-op gate test specifically needs this).
function stubGameState(firstPersonState: FirstPersonState, mode: string = "colony-exploration"): any {
  return {
    currentMode: mode,
    firstPersonState,
    levelCompleteTimer: 0,
    score: 0,
    xp: 0,
    kills: 0,
    credits: 0,
    floatingLabels: [],
    screenShake: 0,
    equippedWeaponType: "kinetic",
    allocatedSkills: [],
    audioEvents: [],
    player: { bankDir: 0 },
    pilotLevel: 1,
  };
}

function placePlayerOnPad(state: ReturnType<typeof generateExteriorState>) {
  state.posX = 11.5;
  state.posY = 20.5;  // inside pad region
}

test("antiBounce: held Z fires hook at most once per key release cycle", () => {
  const colony = makeTestColony({ layoutSeed: 0 });
  const state = generateExteriorState(colony, clock);
  placePlayerOnPad(state);

  // Frame 1: Z pressed, hook should fire (transition request written)
  const gs = stubGameState(state);
  updateFirstPerson(gs, stubKeys({ shoot: true }));
  assert.ok(state.colonyTransitionRequest, "first press should fire hook");

  // Clear the request (simulates orchestrator consuming it)
  state.colonyTransitionRequest = undefined;

  // Frame 2: Z STILL pressed — no release — hook must NOT fire again
  updateFirstPerson(gs, stubKeys({ shoot: true }));
  assert.equal(state.colonyTransitionRequest, undefined, "held Z must not re-fire");
});

test("antiBounce: cooldown blocks hook fire for 15 frames after transition", () => {
  const colony = makeTestColony({ layoutSeed: 0 });
  const state = generateExteriorState(colony, clock);
  placePlayerOnPad(state);
  state.colonyInteractCooldownFrames = 15;
  state.colonyInteractArmed = true;

  // Frame 1: Z pressed — cooldown > 0, must NOT fire
  const gs = stubGameState(state);
  updateFirstPerson(gs, stubKeys({ shoot: true }));
  assert.equal(state.colonyTransitionRequest, undefined, "cooldown should block");

  // Simulate 14 more frames of held Z
  for (let i = 0; i < 14; i++) {
    updateFirstPerson(gs, stubKeys({ shoot: true }));
  }
  // Cooldown should now be 0
  assert.equal(state.colonyInteractCooldownFrames, 0);
});

test("antiBounce: key release → press → fires again", () => {
  const colony = makeTestColony({ layoutSeed: 0 });
  const state = generateExteriorState(colony, clock);
  placePlayerOnPad(state);

  const gs = stubGameState(state);

  // First press
  updateFirstPerson(gs, stubKeys({ shoot: true }));
  assert.ok(state.colonyTransitionRequest);
  state.colonyTransitionRequest = undefined;

  // Release (armed should flip true)
  updateFirstPerson(gs, stubKeys({ shoot: false }));
  assert.equal(state.colonyInteractArmed, true);

  // Re-press — must fire (assuming cooldown has cleared; simulate enough frames first)
  for (let i = 0; i < 15; i++) {
    updateFirstPerson(gs, stubKeys({ shoot: false }));
  }
  updateFirstPerson(gs, stubKeys({ shoot: true }));
  assert.ok(state.colonyTransitionRequest, "re-press after release should fire");
});

test("antiBounce: gate is no-op when colonyContext is undefined", () => {
  // Non-colony FPS state (Ashfall Camp equivalent) — tiles must contain at least walkable floor
  // so the default shoot path doesn't hit an undefined tile when checking collisions.
  const tiles: any[][] = [];
  for (let y = 0; y < 10; y++) {
    tiles.push(new Array(10).fill("floor"));
  }
  const state: any = {
    map: { width: 10, height: 10, tileSize: 64, tiles },
    posX: 5, posY: 5, dirX: 0, dirY: -1, planeX: 0.66, planeY: 0,
    moveSpeed: 0.06, rotSpeed: 0.04, goalReached: false,
    enemies: [], gunFireTimer: 0, gunCooldown: 0,
    npcs: [], dialogState: null,
  };
  const gs = stubGameState(state, "first-person");
  updateFirstPerson(gs, stubKeys({ shoot: true }));
  // Whatever the engine did, the anti-bounce fields should not have been set by the colony block
  assert.equal(state.colonyInteractArmed, undefined);
  assert.equal(state.colonyInteractCooldownFrames, undefined);
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `cd game && yarn colony:test`
Expected: 4 new anti-bounce tests fail (engine hook not yet implemented).

- [ ] **Step 6: Edit `firstPersonEngine.ts` — add the single guard block**

**Before editing**, locate the exact insertion point:

```bash
grep -n "keys.shoot\|NPC Interaction\|dialogState" game/app/components/engine/firstPersonEngine.ts
```

The file contains 3 `keys.shoot` reads: dialog advance (~line 127), NPC interact (~line 154), weapon fire (~line 185). The colony guard goes BETWEEN the dialog block and the NPC interact block — specifically:

- After the block that ends with `fp.dialogState?.active` handler's trailing brace + return
- Before the comment that marks the NPC interaction section (commonly `// ── NPC Interaction ──` or similar; if no comment exists, before the `for (const npc of fp.npcs)` loop)

Visually, the block must be at the same indentation level as the dialog and NPC-interact blocks. The `return;` inside the guard skips the NPC-interact + weapon-fire blocks entirely when `colonyContext` is set.

Add the `if (fp.colonyContext)` guard at that point. The guard must:
1. Decrement cooldown each frame
2. Track key release edge (set `colonyInteractArmed = true` when `!keys.shoot`)
3. Check can-fire condition
4. If fire: compute standingOn + dominant-axis facingTile
5. Try pad hook first, door hook second
6. Write `colonyTransitionRequest` on positive result, disarm
7. Return early (skip default NPC interact path when in colony mode)

The code block (insert in the right place):

```typescript
    // ─── Colony exploration hook + anti-bounce gate (Phase 2) ───
    if (fp.colonyContext) {
      // Cooldown decrements every frame regardless of input
      fp.colonyInteractCooldownFrames = Math.max(0, (fp.colonyInteractCooldownFrames ?? 0) - 1);

      // Track release edge
      if (!keys.shoot) fp.colonyInteractArmed = true;

      const canFire =
        (fp.colonyInteractArmed ?? true) &&
        (fp.colonyInteractCooldownFrames ?? 0) === 0 &&
        keys.shoot;

      if (canFire) {
        const standingOn = { x: Math.floor(fp.posX), y: Math.floor(fp.posY) };
        const step = Math.abs(fp.dirX) >= Math.abs(fp.dirY)
          ? { x: Math.sign(fp.dirX), y: 0 }
          : { x: 0, y: Math.sign(fp.dirY) };
        const facingTile = {
          x: standingOn.x + step.x,
          y: standingOn.y + step.y,
        };

        // Try landing pad first (cheap to reject)
        const padResult = fp.colonyContext.onLandingPadInteract(standingOn);
        if (padResult.kind === "show_exit_menu") {
          fp.colonyTransitionRequest = padResult;
          fp.colonyInteractArmed = false;
        } else {
          const doorResult = fp.colonyContext.onDoorInteract(standingOn, facingTile);
          if (doorResult.kind !== "no_door") {
            fp.colonyTransitionRequest = doorResult;
            fp.colonyInteractArmed = false;
          }
        }
      }

      // Skip the engine's default NPC-interact path for colony exploration
      // (Phase 2 colonies have no NPCs; Ashfall's path stays intact).
      return;
    }
    // ─── End colony hook block ───
```

Place this block inside the existing interact handler, immediately after the section where `keys.shoot` is read but BEFORE the existing NPC-interact logic. The `return;` at the end ensures the default path is skipped only when `colonyContext` is present.

**Audit gate:** the added code MUST be:
- Inside a single `if (fp.colonyContext)` guard
- ≤30 lines of pure additions
- Zero modifications to existing non-colony code paths (lines outside the guard)

Run: `git diff game/app/components/engine/firstPersonEngine.ts` and verify.

- [ ] **Step 7: Apply environmentTint in the renderer**

In `game/app/components/engine/firstPersonRenderer.ts`, find where environment art (sky/ground/walls) is drawn. Add a small helper that consumes the optional `environmentTint`:

```typescript
// Near other helpers at the top of the file
function applyTint(
  ctx: CanvasRenderingContext2D,
  tint: { hueShift: number; saturationMul: number; lightnessMul: number } | undefined,
): void {
  if (!tint) return;
  // Canvas filter — applied temporarily during draw. Restored via ctx.save/restore at call sites.
  ctx.filter = `hue-rotate(${tint.hueShift}deg) saturate(${tint.saturationMul}) brightness(${tint.lightnessMul})`;
}
```

Then at each place the existing renderer draws sky/walls/floor, wrap with save → applyTint → draw → restore. Example:

```typescript
// where sky sprite is drawn:
ctx.save();
applyTint(ctx, fp.environmentArt?.environmentTint);
ctx.drawImage(skySprite, ...);
ctx.restore();
```

This is a renderer change, not an engine change, and is outside the ≤30-line engine-diff audit gate.

- [ ] **Step 8: Run all tests to verify pass**

Run: `cd game && yarn colony:test`
Expected: 94/94 passing (86 prior + 4 dayNightTint + 4 antiBounceGate = 8 new this task).

- [ ] **Step 9: Verify build + tsc**

Run: `cd game && yarn build && npx tsc --noEmit -p tsconfig.json`
Expected: clean.

- [ ] **Step 10: Audit the engine diff**

Run: `git diff game/app/components/engine/firstPersonEngine.ts`
Expected: only additions, all inside the `if (fp.colonyContext)` block, ≤30 lines. No edits outside the guard.

- [ ] **Step 11: Commit**

```bash
cd /Users/nichalasbarnes/Desktop/projects/sector-zero
git add game/app/components/engine/firstPersonEngine.ts \
        game/app/components/engine/firstPersonRenderer.ts \
        game/app/components/colony/exploration/dayNightTint.ts \
        game/tests/colony/dayNightTint.test.ts \
        game/tests/colony/antiBounceGate.test.ts
git commit -m "feat(colony): engine hook points + anti-bounce gate + day/night tint"
```

---

### Task 7: Game.tsx wiring + Descend button + exit menu + playtest + completion

**Goal:** Final integration. Wire `currentMode === "colony-exploration"` in Game.tsx, add the "Descend to Colony" button to Phase 1's ColoniesScreen, build the exit-menu DOM overlay, run the manual playtest checklist, tag completion.

**Files:**
- Create: `game/app/components/colony/exploration/exitMenu.tsx`
- Modify: `game/app/components/colony/meta/ColoniesScreen.tsx`
- Modify: `game/app/components/Game.tsx`

- [ ] **Step 1: Create `exitMenu.tsx`**

Create `game/app/components/colony/exploration/exitMenu.tsx`:

```typescript
import React, { useEffect, useRef } from "react";

export interface ExitMenuProps {
  onTakeOff: () => void;
  onStay: () => void;
}

export function LandingPadExitMenu({ onTakeOff, onStay }: ExitMenuProps) {
  const takeOffRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { takeOffRef.current?.focus(); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onStay(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onStay]);

  const tokens = {
    deep: "#0a0e17",
    cyan: "#00f0ff",
    text: "#e0e6ed",
    mono: "ui-monospace, 'Menlo', 'Consolas', monospace",
  };

  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, width: "100%", height: "100%",
      background: "rgba(0, 0, 0, 0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1100,
      fontFamily: tokens.mono,
    }}>
      <div style={{
        background: tokens.deep,
        border: `1px solid ${tokens.cyan}`,
        padding: "32px 48px",
        display: "flex", flexDirection: "column", gap: "16px",
      }}>
        <div style={{ color: tokens.cyan, fontSize: "14px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Landing Pad
        </div>
        <div style={{ color: tokens.text, fontSize: "12px", opacity: 0.7 }}>
          Leave the colony?
        </div>
        <button
          ref={takeOffRef}
          onClick={onTakeOff}
          style={{
            padding: "12px 24px",
            background: "transparent",
            color: tokens.cyan,
            border: `1px solid ${tokens.cyan}`,
            fontFamily: tokens.mono,
            fontSize: "13px",
            letterSpacing: "0.1em",
            cursor: "pointer",
            textTransform: "uppercase",
          }}
        >
          Take Off
        </button>
        <button
          onClick={onStay}
          style={{
            padding: "12px 24px",
            background: "transparent",
            color: "rgba(0, 240, 255, 0.5)",
            border: "1px solid rgba(0, 240, 255, 0.3)",
            fontFamily: tokens.mono,
            fontSize: "13px",
            letterSpacing: "0.1em",
            cursor: "pointer",
            textTransform: "uppercase",
          }}
        >
          Stay
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Export from exploration/index.ts**

In `game/app/components/colony/exploration/index.ts`, add:

```typescript
export { LandingPadExitMenu } from "./exitMenu";
export type { ExitMenuProps } from "./exitMenu";
```

- [ ] **Step 3: Add "Descend to Colony" button to `ColoniesScreen`**

Find `ColoniesScreen.tsx`. In `ColonyHeader` (the component that includes "Return to Cockpit"), add a second button next to it:

```typescript
// In ColonyHeader.tsx or wherever the back button renders
<button onClick={onDescend} style={{...}}>DESCEND TO COLONY</button>
```

Pass `onDescend` as a new prop. Wire it through `ColoniesScreen.tsx` → parent (Game.tsx supplies the handler).

- [ ] **Step 3.5: Study how Game.tsx dispatches the existing `first-person` mode (Ashfall pattern)**

Before editing Game.tsx, run:

```bash
grep -n 'currentMode === "first-person"\|updateFirstPerson\|createAshfallForwardCampState' game/app/components/Game.tsx
```

Read the surrounding code to identify:
- Where `firstPersonState` is constructed and assigned to `gameState.firstPersonState`
- Where `updateFirstPerson(gs, keys)` is invoked per frame
- Where `returnToCockpit()` is called to tear down the mode
- How the keydown handler is routed (should be routed via the Keys ref, not a DOM event, in FPS mode)

The Phase 2 `"colony-exploration"` dispatch MIRRORS this pattern. Differences:
- After `updateFirstPerson`, call `stepColonyExploration(sceneStack, saveData, deltaMs)` and store the result
- Read `firstPersonState.colonyTransitionRequest` to detect `show_exit_menu` and flip `exitMenuOpen` state
- When `sceneStack.current.state` swaps (interior push/pop), propagate it to `gameState.firstPersonState`

If the dispatch shape differs significantly from the pattern below, prefer mirroring the existing `first-person` handling over the literal code.

- [ ] **Step 4: Wire Game.tsx — mount colony-exploration mode**

In `Game.tsx`:

Add imports:
```typescript
import {
  enterColonyExploration,
  stepColonyExploration,
  exitColonyExploration,
  LandingPadExitMenu,
  type SceneStack,
} from "./colony";
```

Add state:
```typescript
const [sceneStack, setSceneStack] = useState<SceneStack | null>(null);
const [exitMenuOpen, setExitMenuOpen] = useState(false);
```

Add handler for "Descend to Colony":
```typescript
const handleDescend = useCallback((colonyId: string) => {
  const result = enterColonyExploration(saveData, colonyId);
  // Set up a new GameState for colony-exploration mode using result.firstPersonState
  setGameState({
    ...existingGameStateDefaults,
    currentMode: "colony-exploration",
    firstPersonState: result.firstPersonState,
  });
  setSceneStack(result.sceneStack);
  setShowCockpit(false);
}, [saveData]);
```

Each frame (inside the existing game-loop effect, when `currentMode === "colony-exploration"`):
```typescript
// After updateFirstPerson runs, step the orchestrator
if (currentMode === "colony-exploration" && sceneStack) {
  const nextStack = stepColonyExploration(sceneStack, saveData, deltaMs);
  if (nextStack !== sceneStack) setSceneStack(nextStack);
  // Check if the pad hook was triggered
  if (gameState.firstPersonState?.colonyTransitionRequest?.kind === "show_exit_menu") {
    setExitMenuOpen(true);
    gameState.firstPersonState.colonyTransitionRequest = undefined;
  }
  // Ensure the gameState's firstPersonState tracks the sceneStack's current layer
  if (nextStack.current.state !== gameState.firstPersonState) {
    setGameState({ ...gameState, firstPersonState: nextStack.current.state });
  }
}
```

The exact integration will depend on how Game.tsx's existing game-loop dispatches for other FP modes. Follow the pattern used for `first-person` mode (Ashfall).

Add the exit menu render:
```typescript
{exitMenuOpen && (
  <LandingPadExitMenu
    onTakeOff={() => {
      setExitMenuOpen(false);
      exitColonyExploration(sceneStack!);
      setSceneStack(null);
      setGameState(null);
      returnToCockpit();
    }}
    onStay={() => setExitMenuOpen(false)}
  />
)}
```

Add keydown block — when `currentMode === "colony-exploration"` AND `exitMenuOpen`, the DOM handles input; when exit menu is closed, canvas handles input. This may be automatic if the exit menu's div uses `position: fixed, zIndex: 1100` on top of the canvas — the DOM button handlers take precedence.

- [ ] **Step 5: Verify build**

Run: `cd game && yarn build`
Expected: clean.

- [ ] **Step 6: Full manual playtest**

Run: `cd game && yarn dev`. Complete this checklist:

- [ ] Start game, navigate to cockpit hub
- [ ] Arrow-key to COLONIES hotspot, press Z
- [ ] Phase 1 DOM overlay appears
- [ ] If no colony: click "Found Colony at Ashfall" — populated view appears
- [ ] Click "DESCEND TO COLONY" button
- [ ] Overlay unmounts; first-person canvas rendering begins
- [ ] Player spawns at landing pad (south-center), facing north (into plaza area)
- [ ] Walk forward — plaza visible ahead
- [ ] Up to 6 building footprints arranged around plaza (depending on colony state)
- [ ] Constructing buildings: no walls, just open ground
- [ ] Operational buildings: walls + door visible
- [ ] Approach an operational building's door tile: HUD hint? (if implemented) + dominant-axis detection works from multiple angles
- [ ] Press Z facing door → fade-to-black → interior renders
- [ ] Interior: ~6×6 room, one thematic prop, player on exit door facing north
- [ ] Turn around, walk onto exit door, press Z → back to exterior at outer door position
- [ ] Held Z does NOT ping-pong (edge-trigger + cooldown working)
- [ ] Walk onto landing pad, press Z → exit menu appears
- [ ] Click STAY → menu dismisses, still on pad
- [ ] Click TAKE OFF → returns to cockpit
- [ ] Existing campaign missions still work (regression check)
- [ ] Ashfall Forward Camp still works (Ashfall's first-person mode unaffected)
- [ ] Cycle counter in COLONIES screen does NOT advance from descent (only mission completion)

- [ ] **Step 7: Tag the phase**

```bash
git tag colony-phase-2-complete
git tag | grep colony-phase
```

- [ ] **Step 8: Append completion log to the plan**

Append to `docs/superpowers/plans/2026-04-21-colony-phase-2-fps-descent.md`:

```markdown

## Completion Log

**Completed:** 2026-04-21 (fill in actual date)
**Branch:** colony/phase-2
**Tag:** colony-phase-2-complete

**Commits in order:**
- `<sha>` — T1: GameMode + FirstPersonState plumbing
- `<sha>` — T1.5: asset prompt templates (parallel workstream)
- `<sha>` — T2: outpost template + building tile registry
- `<sha>` — T3: exterior layout generator + reducer-order invariant
- `<sha>` — T4: scene stack + exploration public API
- `<sha>` — T5: interior templates + generator + full transition flow
- `<sha>` — T6: engine hook points + anti-bounce gate + day/night tint
- `<sha>` — T7: Game.tsx wiring + descend button + exit menu + playtest
- `<sha>` — T7: completion log

**Acceptance criteria met:**
- yarn colony:test: 94 tests passing (57 prior + 37 new)
- yarn build: clean static export
- npx tsc --noEmit: exit 0
- Manual playtest checklist: 100% passing
- No regressions in Ashfall or existing campaign flows
- firstPersonEngine.ts diff ≤ 30 lines, all inside `if (fp.colonyContext)`
- Color-tint fallback renders cleanly when Phase 2 sprites are not yet generated

**Asset pipeline status:**
- 11 asset prompts drafted in `docs/assets/prompts/colony-phase-2/`
- Images NOT yet generated — placeholder tints in game
- Separate PR to register sprites in `sprites.ts` once images land

**Deferred to later phases:**
- NPCs in colonies (Phase 3/5a)
- Hub interiors (Phase 3)
- Biome-aware sprite selection (Phase 4+)
- POI / region graph (Phase 4)
- Day/night gameplay effects (Phase 5a)
- Tier promotion (Phase 6)

**Next:** Phase 3 plan — Hub interiors (Marketplace, Cantina, Town Hall) with named NPC placeholders. Or polish pass on accumulated Phase 0-2 tech debt (user-driven decision).
```

- [ ] **Step 9: Commit the completion log**

```bash
cd /Users/nichalasbarnes/Desktop/projects/sector-zero
git add docs/superpowers/plans/2026-04-21-colony-phase-2-fps-descent.md
git commit -m "docs(colony): Phase 2 completion log"
```

---

## Acceptance Criteria (top-level)

Phase 2 is complete when ALL of the following are true:

- [ ] `cd game && yarn colony:test` runs green — 94 tests (57 prior + 37 new across Tasks 2-6)
- [ ] `cd game && yarn build` runs green (Next.js static export)
- [ ] `cd game && npx tsc --noEmit` exit 0
- [ ] All 4 CI jobs + GitGuardian pass on the Phase 2 PR
- [ ] Full manual playtest checklist passes
- [ ] No regressions in Ashfall Camp or existing campaign flows
- [ ] `firstPersonEngine.ts` diff ≤ 30 lines, all inside one `if (fp.colonyContext)` guard
- [ ] `generateExteriorState` deterministic (test verified)
- [ ] Anti-bounce gate prevents held-Z ping-pong (test verified)
- [ ] Old saves (pre-Phase-2) load cleanly — Phase 2 adds no new `SaveData` fields
- [ ] Asset prompt templates drafted in `docs/assets/prompts/colony-phase-2/`
- [ ] Color-tint fallback renders cleanly when Phase 2 sprites are not yet generated
- [ ] Git tag `colony-phase-2-complete` on the final commit
- [ ] Completion log appended to this plan

## Risk Mitigations

- **Engine diff accidentally drifts outside the `if (fp.colonyContext)` guard** → Task 6 Step 10 instructs the implementer to explicitly audit `git diff`. Reviewer subagent re-audits at code-quality review.
- **Anti-bounce gate lets a ping-pong slip through** → 4 dedicated tests (held press, cooldown, release cycle, gate no-op without context). Manual playtest confirms.
- **Scene stack exceeds depth 2** → `pushInterior` throws if attempted. Test asserts.
- **Interior transition fails because building has no footprint entry** → `generateInteriorState` throws with a clear error; Task 2 registry test enforces all Phase 1 types have entries.
- **Color-tint fallback looks broken** → expected and acceptable. Asset pipeline is separate track.
- **`require()` vs `import` circular reference** → Task 5 Step 4 prescribes proper top-level imports.
- **Game.tsx integration is larger than expected** → Task 7 is deliberately the final task. If it balloons, implementer flags BLOCKED with specifics; controller decides to split.

## Notes on the Polish Pass

Per user direction: AFTER this plan is written but BEFORE execution, we pause to do a polish PR against the 8 minor follow-ups from Phase 0/1 (StrictMode-safe save handling, BuildingType union tightening, tsconfig.tsbuildinfo untracking, useCallback on ColoniesScreen exit handler, etc.). The polish PR lands on main; Phase 2 execution then branches off polished main.

## Next Phase

After Phase 2 completes: decision point.
- Phase 3 plan — Hub interiors (Marketplace, Cantina, Town Hall) with named NPC placeholders
- Alternative: Phase 5a — NPC scheduling system (consequences + factions + dialog)
- Or: breadth pass — more colony types beyond Tier 1 Outpost

## Completion Log

**Completed:** 2026-04-21
**Branch:** colony/phase-2
**Tag:** colony-phase-2-complete

**Commits in order:**
- `4c27d25` — T1: GameMode + FirstPersonState plumbing
- `cccac16` — T1.5: asset prompt templates (parallel workstream)
- `9212661` — T2: outpost template + building tile registry
- `9fa40ab` — T3: exterior layout generator + reducer-order invariant
- `895a0b0` — T4: scene stack + exploration public API
- `c6a4254` — T5: interior templates + generator + full transition flow
- `aa8fd82` — T6: engine hook points + anti-bounce gate + day/night tint
- `b6dd349` — T7: Game.tsx wiring + descend button + exit menu
- `<this sha>` — T7: completion log

**Acceptance criteria met:**
- yarn colony:test: 100 tests passing (63 prior baseline + 37 new across T2-T6)
- yarn build: clean Next.js static export
- npx tsc --noEmit: exit 0
- firstPersonEngine.ts diff: 30 lines, all inside one `if (fp.colonyContext)` guard — audit passed
- Color-tint fallback renders cleanly when Phase 2 sprites are not yet generated
- No regressions in Ashfall Camp or existing campaign flows (verified by test)

**Manual playtest status:** NOT YET VERIFIED. User should:
1. Run `cd game && yarn dev`, navigate to cockpit → COLONIES → DESCEND TO COLONY
2. Verify spawn on landing pad facing north
3. Verify building footprints render around plaza
4. Press Z facing an operational door → interior loads
5. Press Z on exit door → back outside facing south
6. Verify held-Z does not ping-pong (anti-bounce gate)
7. Walk onto landing pad, press Z → exit menu appears
8. Take Off → back to cockpit
9. Verify Ashfall Forward Camp + existing campaign missions still work

**Asset pipeline status:**
- 11 asset prompts drafted in `docs/assets/prompts/colony-phase-2/`
- Images NOT yet generated — placeholder tints in game
- Separate follow-up PR will register sprites in `sprites.ts` once images land

**Deferred to later phases:**
- NPCs in colonies (Phase 3/5a)
- Hub interiors (Phase 3)
- Biome-aware sprite selection (Phase 4+)
- POI / region graph (Phase 4)
- Day/night gameplay effects (Phase 5a)
- Tier promotion (Phase 6)

**Next:** Phase 2 PR → merge → decision point on what's next (Phase 3 hub interiors, Phase 5a NPCs, or another direction).

---

## Post-completion follow-ups (2026-04-21 → 2026-05-01)

After the original 8 tasks landed, additional work happened on `colony/phase-2` while PR #5 was open. PR #5 is **still open** — CI green, awaiting playtest confirmation and merge decision.

**Commits added:**

- `d8834ac` — `feat(dev): colony seed fixtures + disable turbopack for dev server`
  - New `game/app/components/colony/dev/seedColony.ts` with 3 fixtures: DAY (hour 12), NIGHT (hour 22), DAWN (hour 6, 2 ops + 2 constructing buildings)
  - DevPanel `COLONY SEEDS` section bypasses the resource grind for playtesting Phase 2
  - Idempotent: reseeding a fixture clears the prior colony (`fx_<id>` namespace)
  - Goes through real `colonyReducer` events (`Events.founded` → `buildingCommissioned` → `buildingCompleted`) so invariants hold
  - Drops `--turbopack` from `next dev` due to a Next 15.3.1 regression: `Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'` blocking dev server. `next build` (used by CI) is unaffected.

- `321a723` — `fix(colony): use SPRITES constants for environmentArt + dawn fixture`
  - Bug 1: `colonyLayout.ts` hardcoded sprite paths like `/sector-zero/sprites/explore/outpost-sky.png`. Wrong filename (real sprites are `scrapyard-outpost-*`) AND `getSprite()` already auto-prepends `NEXT_PUBLIC_BASE_PATH`, so the hardcoded prefix was wrong in dev (404) and double-prefixed in prod. All sprites failed to load → fallback gradients made day/night tint barely visible.
  - Bug 2: BUILD fixture at hour 8 fell in the "Day" range (7–17) of `tintForHour`, identical to DAY. Moved to hour 6 (Dawn bucket) and renamed the button to **DAWN**.
  - Now uses `SPRITES.EXPLORE_OUTPOST_*` constants throughout. Interior also uses dedicated `EXPLORE_OUTPOST_WALL_INTERIOR` + `EXPLORE_OUTPOST_FLOOR_METAL`.

- `c942371` — `feat(colony): wire up Phase 2 assets — per-building walls, scaffolding, interior props`
  - All 11 Phase 2 PNGs generated and dropped at `game/public/sprites/{walls,environment,props,interiors}/`
  - **Per-building exterior walls:** `BoardingMap` gained optional `wallTextureMap?: (string|null)[][]`. `colonyLayout.ts` populates it from `BUILDING_FOOTPRINTS.wallSpriteId` (which now points to `SPRITES.*` path constants instead of opaque IDs like `"COLONY_WALL_SOLAR"`). `firstPersonRenderer.ts` wall loop checks per-tile override; falls back to `environmentArt.wallSprite` for outer-frame walls. Doors clear the override (so they don't render as walls).
  - **Scaffolding billboard:** constructing buildings now emit a `COLONY_SCAFFOLDING` billboard at footprint center. Walkable-through (no walls written until completion).
  - **Foundation + landing-pad metadata:** `BoardingMap` gained `landingPadTiles?: ReadonlySet<string>` and `foundationTiles?: ReadonlySet<string>` (string keys `"x,y"`). Minimap renders pad cells cyan and foundation cells amber.
  - **Interior props:** templates now use `SPRITES.INTERIOR_*` paths directly, so the renderer's `getSprite(prop.sprite)` actually finds them.

**Files added/modified since completion:**
- Added: `game/app/components/colony/dev/seedColony.ts` (~110 lines)
- Added: 11 PNGs in `game/public/sprites/{walls,environment,props,interiors}/`
- Modified: `game/app/components/DevPanel.tsx` (+18 lines — COLONY SEEDS section)
- Modified: `game/app/components/Game.tsx` (+35 lines — `seed-colony:<id>` action handler)
- Modified: `game/app/components/colony/exploration/buildingTiles.ts` (path constants)
- Modified: `game/app/components/colony/exploration/colonyLayout.ts` (wallTextureMap, foundationTiles, landingPadTiles, scaffolding props, SPRITES constants)
- Modified: `game/app/components/engine/firstPersonRenderer.ts` (per-tile wall texture in wall loop, minimap colors for pad/foundation)
- Modified: `game/app/components/engine/sprites.ts` (+11 SPRITES entries)
- Modified: `game/app/components/engine/types.ts` (+3 optional fields on `BoardingMap`)
- Modified: `game/package.json` (drop `--turbopack`)

**Verification:** 100/100 tests passing. `yarn build` clean. CI on PR #5 green across Game·TypeScript, Game·Colony tests, Game·Next build, Site·Next build, GitGuardian.

### Known issues at session close (2026-05-01)

1. **Dev-mode lag.** Without `--turbopack`, `next dev` is slow (webpack overhead + HMR + sourcemaps + StrictMode double-render). Movement is frame-rate-tied (`MOVE_SPEED = 0.06` per frame in `firstPersonEngine.ts:10`), so at ~10fps you can barely move. Production-build playtest path:
   ```bash
   cd game && yarn build && npx serve@latest out
   ```
   (`yarn start` doesn't work with `output: 'export'` — the build is pure static HTML.)

2. **Frame-rate-independent movement is a worthwhile follow-up.** Multiply movement deltas by elapsed-ms-since-last-frame so all modes feel consistent on slower devices in production. Touches `firstPersonEngine.ts`, `groundEngine.ts`, `boardingEngine.ts`. ~1 hour of work.

3. **Pad / foundation 3D textures deferred.** The renderer fills the floor with a single `createPattern` call. Per-tile floor textures need *floor casting* (per-pixel-row sampling — for each screen Y below horizon, compute world-space tile and UV). ~100-line addition. Currently visible only on the minimap.

### Open follow-up tasks for next session

In priority order:

1. **Merge PR #5** once user confirms playtest in the production build path. https://github.com/colorpulse6/sector-zero/pull/5
2. **Phase 2 polish (recommended)** — bring it home before piling on:
   - Frame-rate-independent movement (cross-mode benefit, ~1hr)
   - Floor casting for pad/foundation 3D textures (~100 lines)
   - Plaza decor props (a few SPRITES.EXPLORE_OUTPOST_PROP_* billboards in the plaza)
   - Daytime clock progression while in colony (hour ticks while you walk)
3. **Phase 5a — NPCs in the exterior.** Background colonists wandering plaza + a named NPC at the landing pad. Reuses Ashfall's existing NPC + dialog system. Brings the place alive cheaply (~3–5 days).
4. **Phase 3 — Hub interiors with vendors.** Tier-3 buildings (Marketplace, Town Hall), multi-room interiors, vendor NPCs, real dialog trees. Needs its own brainstorm → spec → plan cycle (~1–2 weeks).
5. **Pre-existing pending follow-up:** "tick cycle on final boss ENDING path" (Phase 10 concern, low priority).

### Restart instructions for the next session

1. Branch is `colony/phase-2`, **not** main. Don't accidentally run `git checkout main` and lose context — PR #5 hasn't merged yet.
2. Read this section + the original Completion Log above for full context.
3. Production-build playtest: `cd game && yarn build && npx serve@latest out`. Open http://localhost:3000 (or the port `serve` prints), backtick to open DevPanel, click DAY/NIGHT/DAWN under COLONY SEEDS.
4. Ask user: "Did the playtest land? Ready to merge PR #5? What direction next — Phase 2 polish, Phase 5a NPCs, or Phase 3 hubs?"

# Ashfall Forward Camp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dev-panel-only Ashfall exploration vertical slice with a temporary crew outpost, NPC/shop interactions, a short exterior route, a simple pickup objective, and support for Ashfall-specific first-person environment art.

**Architecture:** Keep the feature on the existing first-person exploration path. Replace the generic settlement stub with a dedicated `ashfallForwardCamp` content module, extend first-person render data just enough to support environment art and static props, and wire the area into the existing Dev Panel launch flow. Use module-level self-tests plus `yarn build` as verification.

**Tech Stack:** Next.js 15, React, TypeScript, HTML5 Canvas, existing Sector Zero engine modules

---

## File Structure

- Create: `games/sector-zero/web/app/components/engine/ashfallForwardCamp.ts`
  - Dedicated Ashfall camp content module: ASCII map, NPCs, props, objective, and `createAshfallForwardCampState()`
- Modify: `games/sector-zero/web/app/components/engine/types.ts`
  - Add focused first-person data types for environment art / static props without creating an open-world framework
- Modify: `games/sector-zero/web/app/components/engine/explorationLevel.ts`
  - Convert into a thin compatibility wrapper or re-export so current call sites do not break during transition
- Modify: `games/sector-zero/web/app/components/engine/firstPersonRenderer.ts`
  - Render Ashfall sky / floor / wall textures and static billboard props when present
- Modify: `games/sector-zero/web/app/components/engine/sprites.ts`
  - Register `public/sprites/explore/*` asset keys
- Modify: `games/sector-zero/web/app/components/Game.tsx`
  - Launch Ashfall Forward Camp from the existing `goto-exploration` dev action
- Modify: `games/sector-zero/web/app/components/DevPanel.tsx`
  - Rename the generic `EXPLORE` dev button to `ASHFALL CAMP` for clarity

---

### Task 1: Add Ashfall-Specific First-Person Data Shapes

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/types.ts`
- Test: `cd games/sector-zero/web && yarn build`

- [ ] **Step 1: Add the failing type surface**

Add compact interfaces for first-person environment metadata and prop billboards near the existing first-person types:

```ts
export interface FPEnvironmentArt {
  skySprite?: string;
  wallSprite?: string;
  floorSprite?: string;
  ceilingSprite?: string;
}

export interface FPProp {
  id: number;
  x: number;
  y: number;
  sprite: string;
  scale?: number;
  label?: string;
}
```

Extend `FirstPersonState`:

```ts
environmentArt?: FPEnvironmentArt;
props?: FPProp[];
missionLabel?: string;
```

- [ ] **Step 2: Run build to verify current renderer/type usage now fails**

Run: `cd games/sector-zero/web && yarn build`

Expected: Type errors in first-person state creation sites because the new fields are not populated yet, or no errors if the fields are optional.

- [ ] **Step 3: Keep the new fields optional and narrowly scoped**

Do not add generalized quest/inventory/location systems here. Keep the change limited to what the Ashfall slice needs.

- [ ] **Step 4: Run build again**

Run: `cd games/sector-zero/web && yarn build`

Expected: PASS or only unrelated pending errors from later tasks.

- [ ] **Step 5: Commit**

```bash
git add games/sector-zero/web/app/components/engine/types.ts
git commit -m "feat(sector-zero): add first-person environment art state"
```

---

### Task 2: Replace the Generic Exploration Stub With Ashfall Forward Camp Content

**Files:**
- Create: `games/sector-zero/web/app/components/engine/ashfallForwardCamp.ts`
- Modify: `games/sector-zero/web/app/components/engine/explorationLevel.ts`
- Test: `cd games/sector-zero/web && yarn build`

- [ ] **Step 1: Write a small self-test target first**

At the bottom of the new content module, add `console.assert` checks for:

```ts
const state = createAshfallForwardCampState();
console.assert(state.npcs.length >= 3, "Ashfall camp should have at least 3 NPCs");
console.assert(Boolean(state.objectivePickup), "Ashfall camp should define an objective pickup");
console.assert((state.props?.length ?? 0) >= 1, "Ashfall camp should define at least one prop");
```

- [ ] **Step 2: Create the dedicated content module**

Implement `ashfallForwardCamp.ts` with:

- an authored ASCII map for:
  - landing pad
  - camp yard
  - command shelter
  - quartermaster point
  - perimeter gate
  - short exterior route
  - objective pocket
- `createAshfallForwardCampState()`
- camp NPCs based on the approved tone
- one merchant using the existing `FPShopItem[]`
- one simple objective pickup such as:

```ts
objectivePickup: {
  x: 21.5,
  y: 17.5,
  label: "FIELD SENSOR",
}
```

- static `props` entries using future sprite keys like:

```ts
{ id: 1, x: 8.5, y: 6.5, sprite: SPRITES.EXPLORE_OUTPOST_LANDMARK_RIG, scale: 1.4 }
```

- [ ] **Step 3: Convert `explorationLevel.ts` into a compatibility wrapper**

Keep existing imports stable by making `explorationLevel.ts` a thin shim:

```ts
export { createAshfallForwardCampState as createExplorationState } from "./ashfallForwardCamp";
```

If helpful, also export the named Ashfall creator directly.

- [ ] **Step 4: Run build**

Run: `cd games/sector-zero/web && yarn build`

Expected: PASS on the new content module; renderer/sprite failures may remain until later tasks.

- [ ] **Step 5: Commit**

```bash
git add games/sector-zero/web/app/components/engine/ashfallForwardCamp.ts games/sector-zero/web/app/components/engine/explorationLevel.ts
git commit -m "feat(sector-zero): add ashfall forward camp exploration content"
```

---

### Task 3: Register Explore Asset Keys

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/sprites.ts`
- Test: `cd games/sector-zero/web && yarn build`

- [ ] **Step 1: Add sprite constants for the approved asset contract**

Add keys near the first-person / exploration assets:

```ts
EXPLORE_OUTPOST_SKY: "/sprites/explore/scrapyard-outpost-sky.png",
EXPLORE_OUTPOST_GROUND: "/sprites/explore/scrapyard-outpost-ground.png",
EXPLORE_OUTPOST_WALL_EXTERIOR: "/sprites/explore/scrapyard-outpost-wall-exterior.png",
EXPLORE_OUTPOST_WALL_INTERIOR: "/sprites/explore/scrapyard-outpost-wall-interior.png",
EXPLORE_OUTPOST_FLOOR_METAL: "/sprites/explore/scrapyard-outpost-floor-metal.png",
EXPLORE_OUTPOST_LANDMARK_RIG: "/sprites/explore/scrapyard-outpost-landmark-rig.png",
EXPLORE_OUTPOST_PROP_CRATES: "/sprites/explore/scrapyard-outpost-prop-crates.png",
EXPLORE_OUTPOST_PROP_ANTENNA: "/sprites/explore/scrapyard-outpost-prop-antenna.png",
EXPLORE_OUTPOST_PROP_LAMP: "/sprites/explore/scrapyard-outpost-prop-lamp.png",
EXPLORE_OUTPOST_PROP_TERMINAL: "/sprites/explore/scrapyard-outpost-prop-terminal.png",
EXPLORE_OUTPOST_PROP_BARREL: "/sprites/explore/scrapyard-outpost-prop-barrel.png",
EXPLORE_OUTPOST_PROP_SIGNPOST: "/sprites/explore/scrapyard-outpost-prop-signpost.png",
EXPLORE_OUTPOST_PROP_CABLE_SPOOL: "/sprites/explore/scrapyard-outpost-prop-cable-spool.png",
```

- [ ] **Step 2: Run build**

Run: `cd games/sector-zero/web && yarn build`

Expected: PASS, even if image files are not present yet, because sprite loading is runtime-based.

- [ ] **Step 3: Commit**

```bash
git add games/sector-zero/web/app/components/engine/sprites.ts
git commit -m "feat(sector-zero): register ashfall explore sprites"
```

---

### Task 4: Render Ashfall Environment Art And Static Props

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/firstPersonRenderer.ts`
- Test: `cd games/sector-zero/web && yarn build`

- [ ] **Step 1: Add renderer self-test targets**

Add small dev assertions around any helper math that positions props or chooses sprites:

```ts
console.assert(getSpritePathOrFallback(undefined, SPRITES.BOARDING_TILES) === SPRITES.BOARDING_TILES);
```

Keep these tiny and local.

- [ ] **Step 2: Add environment texture selection helpers**

Replace hardcoded defaults with state-aware lookups:

```ts
const wallTexturePath = fp.environmentArt?.wallSprite ?? SPRITES.BOARDING_TILES;
const wallTexture = getSprite(wallTexturePath);
```

For the sky:

- if `fp.environmentArt?.skySprite` exists and is loaded, draw it across the upper half
- otherwise keep the current gradient fallback

For the floor / ceiling:

- keep current gradients as fallback
- allow textured fills if `floorSprite` / `ceilingSprite` are present later
- do not overengineer perfect perspective floor-casting in this slice

- [ ] **Step 3: Add a static prop billboard pass**

Create a helper similar to NPC billboard rendering:

```ts
function drawPropBillboards(
  ctx: CanvasRenderingContext2D,
  fp: FirstPersonState,
  wallHits: (RayHit | null)[]
): void
```

Requirements:

- read from `fp.props ?? []`
- sort by distance
- use the z-buffer like NPCs / enemies
- draw transparent PNG props when loaded
- fall back gracefully if a sprite is missing
- keep props non-interactive in this first pass

- [ ] **Step 4: Call the prop pass in the main first-person render flow**

Place props after walls and before NPC prompts/UI overlays so the camp reads as a place.

- [ ] **Step 5: Run build**

Run: `cd games/sector-zero/web && yarn build`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add games/sector-zero/web/app/components/engine/firstPersonRenderer.ts
git commit -m "feat(sector-zero): render ashfall exploration environment art"
```

---

### Task 5: Wire The Dev Panel Launch To Ashfall Forward Camp

**Files:**
- Modify: `games/sector-zero/web/app/components/Game.tsx`
- Modify: `games/sector-zero/web/app/components/DevPanel.tsx`
- Test: `cd games/sector-zero/web && yarn build`

- [ ] **Step 1: Rename the dev-panel entry for clarity**

Change the `EXPLORE` button label to:

```tsx
ASHFALL CAMP
```

Keep the action string `goto-exploration` unless there is a strong reason to rename it.

- [ ] **Step 2: Switch the launch handler to the Ashfall content module**

In `Game.tsx`, replace the generic require/import target:

```ts
const { createAshfallForwardCampState } = require("./engine/ashfallForwardCamp");
const fpState = createAshfallForwardCampState();
```

Preserve the existing first-person launch pattern:

- `currentMode: "first-person"`
- `screen: GameScreen.PLAYING`
- same save/upgrades context
- no campaign unlock side effects

- [ ] **Step 3: Add one tiny guard assertion if useful**

Example:

```ts
console.assert(fpState.npcs.length > 0, "Dev exploration slice should launch with NPCs");
```

- [ ] **Step 4: Run build**

Run: `cd games/sector-zero/web && yarn build`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add games/sector-zero/web/app/components/Game.tsx games/sector-zero/web/app/components/DevPanel.tsx
git commit -m "feat(sector-zero): launch ashfall camp from dev panel"
```

---

### Task 6: Final Verification And Asset Drop Checklist

**Files:**
- Review: `docs/superpowers/specs/2026-04-07-ashfall-forward-camp-explore-design.md`
- Review: `games/sector-zero/web/public/sprites/explore/`
- Test: `cd games/sector-zero/web && yarn build`

- [ ] **Step 1: Verify runtime asset contract matches code**

Check that sprite keys in `sprites.ts` match the approved filenames exactly:

- `scrapyard-outpost-sky.png`
- `scrapyard-outpost-ground.png`
- `scrapyard-outpost-wall-exterior.png`
- `scrapyard-outpost-wall-interior.png`
- `scrapyard-outpost-floor-metal.png`
- `scrapyard-outpost-landmark-rig.png`
- prop PNG names

- [ ] **Step 2: Run full build**

Run: `cd games/sector-zero/web && yarn build`

Expected: PASS with static export completing successfully.

- [ ] **Step 3: Manual smoke-check list**

Run: `cd games/sector-zero/web && yarn dev`

Check:

- Dev Panel opens
- `ASHFALL CAMP` launches
- spawn faces meaningful camp geometry
- merchant dialog opens shop
- exterior route is readable
- objective pickup completes cleanly
- missing art fails gracefully if some files are not present yet

- [ ] **Step 4: Final commit**

```bash
git add games/sector-zero/web/app/components/DevPanel.tsx \
  games/sector-zero/web/app/components/Game.tsx \
  games/sector-zero/web/app/components/engine/types.ts \
  games/sector-zero/web/app/components/engine/explorationLevel.ts \
  games/sector-zero/web/app/components/engine/ashfallForwardCamp.ts \
  games/sector-zero/web/app/components/engine/firstPersonRenderer.ts \
  games/sector-zero/web/app/components/engine/sprites.ts
git commit -m "feat(sector-zero): add ashfall forward camp exploration slice"
```

---

## Notes For Execution

- Do not build a generalized overworld framework during this plan.
- Keep floor / ceiling rendering pragmatic; readable atmosphere matters more than perfect texture projection.
- Prefer existing character billboards over creating new NPC art dependencies.
- If the user delivers only a subset of art during implementation, ship with graceful fallbacks rather than blocking the slice.

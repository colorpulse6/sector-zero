# Colony System — Phase 1: Meta Layer (Single Colony) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the "proof of life" colony UI — a DOM overlay on the canvas cockpit that lets the player found Ashfall Primary, commission buildings, and see the state update after completing missions.

**Architecture:** The canvas cockpit gains one new hotspot (COLONIES) that routes to a new `currentScreen === "colonies"` mode. When active, canvas rendering short-circuits for the sub-screen and a React overlay mounts as a sibling of the canvas in `Game.tsx`. The overlay is pure React/DOM with inline style objects derived from a shared `hudTokens.ts` constants file; no CSS modules, no Tailwind, no frameworks. Mutations flow through the existing Phase 0 `colonyReducer`. Mission completion triggers `advanceWorldCycle` and the cycle processor gains a new step to decrement `buildProgressCycles` and auto-complete buildings.

**Tech Stack:** React 19 + TypeScript 5 + Next.js 15 (static export) + existing Phase 0 colony subsystem. No new runtime dependencies. Test harness reuses `tsx` + Node's built-in `node:test` (Phase 0 setup); adds `react-dom/server` (part of `react-dom`, already installed) for the SSR smoke test.

**Spec reference (canonical):** `docs/superpowers/specs/2026-04-20-colony-phase-1-meta-single-colony-design.md`

---

## Scope Contract

**In scope for Phase 1:**
- Extract `RESOURCE_PRODUCTION` and `RESOURCE_UPKEEP` from `cycleProcessor.ts` into a new `colony/shared/colonyCatalog.ts`
- Add step 4.5 (building progress) to the cycle processor pipeline
- Wire `advanceWorldCycle` into `nextLevel` in `Game.tsx`
- Add `"colonies"` to the cockpit screen state + one new hotspot in the hub
- New `colony/meta/` React components (ColoniesScreen, ColonyHeader, ColonyResourcePanel, ColonyMetrics, ColonyBuildingsList, ColonyCommissionMenu, ColonyEmptyState)
- Inline-styled via `colony/meta/hudTokens.ts` constants
- Empty-state founding flow (one click → two events: `founded` + `resourceChanged` for starter metal)
- Affordability gating on commission cards
- One SSR smoke test for `<ColoniesScreen/>`

**Out of scope for Phase 1 (per spec):**
- Multiple colonies
- FPS descent / raycaster integration
- Grid planner / physical placement
- Population/happiness management systems (display only)
- POI / region interactions
- Faction UI, shipments UI
- Completion notifications / HUD badges
- Narrative dialog on founding
- Tier promotion
- CSS modules / Tailwind (inline styles only in Phase 1)

---

## File Structure

### Create

```
game/app/components/colony/
├── meta/
│   ├── ColoniesScreen.tsx          # fullscreen overlay entrypoint
│   ├── ColonyHeader.tsx            # back arrow + name + tier + cycle counter
│   ├── ColonyResourcePanel.tsx     # 4-resource grid (food, water, metal, power)
│   ├── ColonyMetrics.tsx           # population + happiness + self-sufficient
│   ├── ColonyBuildingsList.tsx     # operational + constructing buildings
│   ├── ColonyCommissionMenu.tsx    # 4-card commission grid with BUILD buttons
│   ├── ColonyEmptyState.tsx        # pre-founding screen with Found button
│   ├── hudTokens.ts                # HUD color/spacing/font constants
│   ├── buildingIdGen.ts            # deterministic building ID helper
│   ├── predictedDeltas.ts          # pure helper: per-cycle resource deltas
│   └── index.ts                    # exports ColoniesScreen ONLY
└── shared/
    └── colonyCatalog.ts            # extracted RESOURCE_PRODUCTION + RESOURCE_UPKEEP

game/tests/colony/
├── coloniesScreenSmoke.test.ts     # SSR renders without throwing
├── cycleProgress.test.ts           # new cycle step unit tests
└── predictedDeltas.test.ts         # helper unit tests
```

### Modify

```
game/app/components/colony/shared/
└── cycleProcessor.ts               # import from colonyCatalog, add step 4.5

game/app/components/engine/
├── cockpit.ts                      # add "colonies" to CockpitScreen + hotspot + nav graph
└── cockpitRenderer.ts              # early-return when state.screen === "colonies"

game/app/components/
└── Game.tsx                        # mount <ColoniesScreen/>, wire advanceWorldCycle, block canvas keydown for colonies

game/app/components/colony/
└── index.ts                        # optionally re-export ColoniesScreen (or keep in meta/index.ts)

game/tests/colony/
└── integration.test.ts             # update 5-cycle sim to auto-complete without manual events
```

**Public API rule (unchanged):** anything outside `game/app/components/colony/` imports only from `colony/index.ts` or `colony/meta/index.ts`.

---

## Task Breakdown

### Task 1: Extract catalog + refactor cycleProcessor

**Goal:** Lift `RESOURCE_PRODUCTION` and `RESOURCE_UPKEEP` from `cycleProcessor.ts` into `shared/colonyCatalog.ts` so Phase 1 components can import the same authoritative tables.

**Files:**
- Create: `game/app/components/colony/shared/colonyCatalog.ts`
- Modify: `game/app/components/colony/shared/cycleProcessor.ts`

- [ ] **Step 1: Create `colonyCatalog.ts` with the constants moved verbatim**

Create `game/app/components/colony/shared/colonyCatalog.ts`:

```typescript
import type { BuildingType, ColonyResources } from "./colonyTypes";

/**
 * Resource production per cycle, per operational building type.
 * Spec Section E authoritative values.
 */
export const RESOURCE_PRODUCTION: Partial<Record<BuildingType, Partial<ColonyResources>>> = {
  farm: { food: 15 },
  water_purifier: { water: 12 },
  mine: { metal: 10 },
  // Marketplace income is population-driven; handled separately in Phase 7a.
};

/**
 * Resource upkeep per cycle, per operational building type.
 * Power-based upkeep is handled via powerGrid, not resource consumption.
 */
export const RESOURCE_UPKEEP: Partial<Record<BuildingType, Partial<ColonyResources>>> = {
  farm: { water: 5 },
  mine: {},
  refinery: { metal: 5 },
  barracks: { food: 3 },
};
```

- [ ] **Step 2: Remove the two constants from `cycleProcessor.ts` and import from catalog**

In `game/app/components/colony/shared/cycleProcessor.ts`:

Replace the existing local `RESOURCE_PRODUCTION` and `RESOURCE_UPKEEP` declarations (top of file) with:

```typescript
import { RESOURCE_PRODUCTION, RESOURCE_UPKEEP } from "./colonyCatalog";
```

Leave everything else in the file unchanged.

- [ ] **Step 3: Run tests to verify no regression**

Run: `cd game && yarn colony:test`
Expected: 47/47 passing (same as before the refactor — this is a pure extraction).

- [ ] **Step 4: Verify build**

Run: `cd game && yarn build`
Expected: clean static export.

- [ ] **Step 5: Commit**

```bash
cd /Users/nichalasbarnes/Desktop/projects/sector-zero
git add game/app/components/colony/shared/colonyCatalog.ts game/app/components/colony/shared/cycleProcessor.ts
git commit -m "refactor(colony): extract RESOURCE_PRODUCTION/UPKEEP into colonyCatalog"
```

---

### Task 2: Add cycle step 4.5 (building progress)

**Goal:** The cycle processor decrements `buildProgressCycles` for constructing buildings and auto-flips them to `"operational"` when the counter reaches zero.

**Files:**
- Modify: `game/app/components/colony/shared/cycleProcessor.ts`
- Create: `game/tests/colony/cycleProgress.test.ts`
- Modify: `game/tests/colony/integration.test.ts`

- [ ] **Step 1 (TDD): Write failing tests for the new cycle step**

Create `game/tests/colony/cycleProgress.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { processCycle } from "../../app/components/colony/shared/cycleProcessor";
import { makeTestColony } from "./fixtures";

test("processCycle step 4.5: constructing building at 2 cycles decrements to 1", () => {
  const before = makeTestColony({
    buildings: [
      { id: "b1", type: "solar_array", tier: 1, status: "constructing", buildProgressCycles: 2, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const after = processCycle(before, 1);
  const b = after.buildings.find(x => x.id === "b1")!;
  assert.equal(b.status, "constructing");
  assert.equal(b.buildProgressCycles, 1);
});

test("processCycle step 4.5: constructing building at 1 cycle completes to operational", () => {
  const before = makeTestColony({
    buildings: [
      { id: "b1", type: "solar_array", tier: 1, status: "constructing", buildProgressCycles: 1, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const after = processCycle(before, 1);
  const b = after.buildings.find(x => x.id === "b1")!;
  assert.equal(b.status, "operational");
  assert.equal(b.buildProgressCycles, 0);
});

test("processCycle step 4.5: operational buildings are unchanged", () => {
  const before = makeTestColony({
    buildings: [
      { id: "b1", type: "farm", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const after = processCycle(before, 1);
  const b = after.buildings.find(x => x.id === "b1")!;
  assert.equal(b.status, "operational");
  assert.equal(b.buildProgressCycles, 0);
});

test("processCycle step 4.5: buildProgressCycles never goes negative", () => {
  const before = makeTestColony({
    buildings: [
      // Edge case: status says "constructing" but counter is already 0
      { id: "b1", type: "solar_array", tier: 1, status: "constructing", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const after = processCycle(before, 1);
  const b = after.buildings.find(x => x.id === "b1")!;
  assert.equal(b.status, "operational");
  assert.equal(b.buildProgressCycles, 0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd game && yarn colony:test`
Expected: 4 new tests fail (step 4.5 not implemented; constructing buildings pass through unchanged).

- [ ] **Step 3: Implement step 4.5 in `cycleProcessor.ts`**

In `game/app/components/colony/shared/cycleProcessor.ts`, add a new step function after `step4_populationChange`:

```typescript
function step4_5_buildingProgress(c: ColonyState): ColonyState {
  const nextBuildings = c.buildings.map(b => {
    if (b.status !== "constructing") return b;
    const next = b.buildProgressCycles - 1;
    if (next <= 0) {
      return { ...b, status: "operational" as const, buildProgressCycles: 0 };
    }
    return { ...b, buildProgressCycles: next };
  });
  return { ...c, buildings: nextBuildings };
}
```

Then update `processCycle` to call it between step 4 and step 5:

```typescript
export function processCycle(colony: ColonyState, toCycle: number): ColonyState {
  let state = colony;
  state = step1_production(state);
  state = step2_populationConsumption(state);
  state = step3_buildingUpkeep(state);
  state = step4_populationChange(state);
  state = step4_5_buildingProgress(state);  // NEW
  state = step5_happinessRecompute(state);
  state = step6_threatProgression(state);
  state = step7_earthShipmentTick(state);
  state = step8_questTick(state);
  state = step9_bountyDecay(state);
  state = step10_finalize(state, toCycle);
  return state;
}
```

- [ ] **Step 4: Run tests to verify the 4 new tests pass**

Run: `cd game && yarn colony:test`
Expected: 51/51 passing (47 prior + 4 new).

- [ ] **Step 5: Update integration test to auto-complete buildings**

In `game/tests/colony/integration.test.ts`, remove the manual `buildingCompleted` event dispatches. The existing flow is:

```typescript
// Cycle 1: solar completes (after 1 cycle)
save = advanceWorldCycle(save);
save = colonyReducer(save, Events.buildingCompleted({ colonyId: "ashfall_primary", buildingId: "b_solar" }));
```

Change to:

```typescript
// Cycle 1: solar auto-completes via processCycle step 4.5
save = advanceWorldCycle(save);
// No manual buildingCompleted needed — cycleProcessor handles it
```

Do the same for the cycle-2 farm + water_purifier completion. The final assertions (lastCycleProcessed=5, operational buildings count=3) should still hold — they just happen automatically now.

- [ ] **Step 6: Run tests to verify integration still passes**

Run: `cd game && yarn colony:test`
Expected: still 51/51 passing. The integration test now exercises step 4.5.

- [ ] **Step 7: Verify build**

Run: `cd game && yarn build`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
cd /Users/nichalasbarnes/Desktop/projects/sector-zero
git add game/app/components/colony/shared/cycleProcessor.ts game/tests/colony/cycleProgress.test.ts game/tests/colony/integration.test.ts
git commit -m "feat(colony): cycle step 4.5 auto-completes constructing buildings"
```

---

### Task 3: Wire `advanceWorldCycle` into mission completion

**Goal:** Completing a mission advances all colonies by one cycle. Single-line insertion in `Game.tsx` `nextLevel` success path.

**Files:**
- Modify: `game/app/components/Game.tsx`
- Modify: `game/app/components/engine/phases.ts` (comment only)

- [ ] **Step 1: Find `nextLevel` in Game.tsx**

Run: `grep -n "nextLevel" game/app/components/Game.tsx | head -5`
Note the line range (should be roughly 305-425 per the exploration).

- [ ] **Step 2: Add import at top of Game.tsx**

If not already present, add near the existing colony imports (there may not be any yet — add at the top with other colony-adjacent imports):

```typescript
import { advanceWorldCycle } from "./colony";
```

- [ ] **Step 3: Insert `advanceWorldCycle` call in every mission-success branch**

**Before editing**, enumerate every target site up front:

```bash
grep -n "saveSave(newSave)\|returnToCockpit()" game/app/components/Game.tsx
```

This gives you the full list of `saveSave` + `returnToCockpit` pair sites. Cross-reference with the `nextLevel` function bounds — every `saveSave(newSave) → setSaveData(newSave) → returnToCockpit()` pattern that falls inside `nextLevel` needs the injection. Other patterns elsewhere in Game.tsx (e.g., a standalone cockpit save-state flush) do NOT.

In `Game.tsx`, the `nextLevel` callback has multiple branches (planet missions, shooter levels, special missions). Each branch has a pattern like:

```typescript
saveSave(newSave);
setSaveData(newSave);
returnToCockpit();
```

Change each occurrence to:

```typescript
const cycledSave = advanceWorldCycle(newSave);
saveSave(cycledSave);
setSaveData(cycledSave);
returnToCockpit();
```

Be thorough — walk through every branch that leads to `returnToCockpit()` after mission completion. Do NOT modify failure/retry/abandon paths.

- [ ] **Step 4: Add a code comment in `phases.ts`**

In `game/app/components/engine/phases.ts`, near the top of the file (after existing imports, before exports), add:

```typescript
// IMPORTANT: Do NOT call advanceWorldCycle() when transitioning between phases
// of a multi-phase level. One completed mission = one cycle. Only the final
// phase's completion routes through Game.tsx nextLevel(), which is where
// advanceWorldCycle fires. Adding a call here would double-tick the cycle.
```

- [ ] **Step 5: Verify build**

Run: `cd game && yarn build`
Expected: clean.

- [ ] **Step 6: Verify colony tests still green**

Run: `cd game && yarn colony:test`
Expected: 51/51 passing (no test changes; just wiring).

- [ ] **Step 7: Manual smoke test (quick)**

Run: `cd game && yarn dev` — open the game in a browser. Start a new game, complete any existing campaign mission (e.g., a quick shooter level). Then open the browser devtools console and inspect `localStorage.getItem("sector-zero-save")`. The `missionsSinceStart` field should be 1 (or higher if the player has played more). If the colonies array is empty, it remains so — that's expected for Phase 1 before Task 5.

If `missionsSinceStart` stayed at 0, a branch was missed. Audit `nextLevel` and fix.

- [ ] **Step 8: Commit**

```bash
cd /Users/nichalasbarnes/Desktop/projects/sector-zero
git add game/app/components/Game.tsx game/app/components/engine/phases.ts
git commit -m "feat(colony): wire advanceWorldCycle into mission completion"
```

---

### Task 4: Canvas cockpit COLONIES hotspot + keydown block

**Goal:** Add COLONIES to the cockpit hub so the player can navigate to it. Canvas renders the hotspot label in the hub but does NOT draw a sub-screen — the DOM overlay (Task 5) does that.

**Files:**
- Modify: `game/app/components/engine/cockpit.ts`
- Modify: `game/app/components/engine/cockpitRenderer.ts`
- Modify: `game/app/components/Game.tsx` (keydown block)

- [ ] **Step 1: Find the CockpitScreen union**

Run: `grep -n "CockpitScreen" game/app/components/engine/cockpit.ts`
Note the line (should be ~15).

- [ ] **Step 2: Add `"colonies"` to the CockpitScreen union**

In `game/app/components/engine/cockpit.ts`, extend the union type:

```typescript
export type CockpitScreen =
  | "cockpit-hub"
  | "starmap"
  | "armory"
  | "crew"
  | "missions"
  | "codex"
  | "bestiary"
  | "pilot"
  | "colonies";  // NEW
```

- [ ] **Step 3: Find `COCKPIT_HOTSPOTS` and add the COLONIES entry**

**Before editing**, enumerate existing hotspot coords to inform your placement:

```bash
grep -A 12 "const COCKPIT_HOTSPOTS" game/app/components/engine/cockpit.ts
```

This prints the full array. Note the x/y/w/h of existing entries so you can pick a non-overlapping position. Canvas is 480×854 (per `game/CLAUDE.md`); hotspots are typically in the 200-400 x range and 150-650 y range. Choose a free slot — visually below or to the right of a secondary station is usually fine.

Add a new hotspot entry. Suggested starting coordinates (may need to be adjusted after visual inspection):

```typescript
{ id: "colonies", label: "COLONIES", x: 350, y: 480, w: 120, h: 40 },
```

After adding, run `yarn dev` briefly to confirm the label renders in the hub and doesn't collide with existing hotspots. Adjust x/y if needed.

- [ ] **Step 4: Update `NAV_GRAPH` so arrow keys route to/from COLONIES**

`NAV_GRAPH` maps hotspot index → `[up, down, left, right]` neighbor indices. Add an entry for the new COLONIES hotspot. The COLONIES hotspot index is the last one in `COCKPIT_HOTSPOTS` after your addition.

Also update at least two existing neighbors' nav arrays so they can route TO the new colonies hotspot. Choose neighbors based on the x/y you picked in Step 3.

If the nav graph is maintained by index number, remember to update any indices that shift when you add a new hotspot. A conservative approach: append the new hotspot at the end of `COCKPIT_HOTSPOTS` so existing indices don't change, and only add new entries — don't re-index.

- [ ] **Step 5: Early-return in `cockpitRenderer.ts`**

In `game/app/components/engine/cockpitRenderer.ts`, find the dispatch logic that routes to `drawArmoryScreen`, `drawCrewScreen`, etc. (around line 27-41 per the exploration). Add an early-return for `"colonies"`:

```typescript
if (state.screen === "colonies") {
  return;  // DOM overlay handles rendering
}
```

This goes BEFORE the other sub-screen dispatch branches (e.g., `if (state.screen === "armory") drawArmoryScreen(...)`). The hub rendering (which draws all hotspot labels including COLONIES) must still run when `state.screen === "cockpit-hub"` — do not block that.

- [ ] **Step 6: Block canvas keydown when colonies is active**

In `game/app/components/Game.tsx`, find the main keydown handler (the one that dispatches to cockpit input when `currentScreen` is a cockpit variant). Add an early-return at the top:

```typescript
const handleKeyDown = (e: KeyboardEvent) => {
  if (currentScreen === "colonies") return;  // DOM overlay handles keys
  // ... existing handler body
};
```

**Tip for the implementer:** `currentScreen` may be a different variable name in Game.tsx (e.g., `screen`, `gameScreen`). Use `grep` to find it. The check must match the actual variable storing the cockpit-screen value when the DOM overlay is active.

- [ ] **Step 7: Verify the canvas transition**

Run: `cd game && yarn dev`

Navigate in the browser to the cockpit hub. Arrow-key to highlight COLONIES. Press Z/Enter. The canvas should blank out (no sub-screen rendered). The hub hotspots may briefly disappear. This is expected — Task 5 adds the overlay.

Press Escape or the Back key (whatever the existing stations use to return to hub). The hub should return.

If the screen gets "stuck" (can't escape), you've missed the return-to-hub path. Back-out logic for the "colonies" screen should mirror existing stations' back-out (call `returnToCockpit()` or whatever sets `currentScreen = "cockpit-hub"`).

- [ ] **Step 8: Verify build**

Run: `cd game && yarn build`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
cd /Users/nichalasbarnes/Desktop/projects/sector-zero
git add game/app/components/engine/cockpit.ts game/app/components/engine/cockpitRenderer.ts game/app/components/Game.tsx
git commit -m "feat(colony): add COLONIES hotspot to cockpit hub (canvas blanks for DOM overlay)"
```

---

### Task 5: DOM overlay scaffold — hudTokens, ColoniesScreen, EmptyState, founding

**Goal:** When `currentScreen === "colonies"`, a React overlay mounts fullscreen. If no colonies exist, show the founding button. Click dispatches two events (founded + starter grant) and the overlay re-renders into a populated placeholder state (full populated screen lands in Tasks 6-8).

**Files:**
- Create: `game/app/components/colony/meta/hudTokens.ts`
- Create: `game/app/components/colony/meta/ColoniesScreen.tsx`
- Create: `game/app/components/colony/meta/ColonyEmptyState.tsx`
- Create: `game/app/components/colony/meta/index.ts`
- Create: `game/tests/colony/coloniesScreenSmoke.test.ts`
- Modify: `game/app/components/Game.tsx`

- [ ] **Step 1: Create `hudTokens.ts`**

Create `game/app/components/colony/meta/hudTokens.ts`:

```typescript
/**
 * Shared style constants for the colony DOM overlay.
 * Mirrors the HUD aesthetic from the existing canvas cockpit.
 * Colors match the companion site's @theme tokens in site/app/globals.css
 * so both apps feel consistent.
 */

export const hudColors = {
  deep: "#0a0e17",
  deepLighter: "#0f1520",
  cyanAccent: "#00f0ff",
  purpleAccent: "#7800ff",
  textPrimary: "#e0e6ed",
  textMuted: "rgba(0, 240, 255, 0.5)",
  dangerAccent: "#ff3366",
  success: "#44ff99",
  borderHud: "rgba(0, 240, 255, 0.15)",
  borderActive: "rgba(0, 240, 255, 0.4)",
  dimOverlay: "rgba(0, 0, 0, 0.85)",
};

export const hudFonts = {
  mono: "ui-monospace, 'Menlo', 'Consolas', monospace",
  heading: "ui-monospace, 'Menlo', 'Consolas', monospace",
};

export const hudSpacing = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
};
```

- [ ] **Step 2: Create `ColonyEmptyState.tsx`**

Create `game/app/components/colony/meta/ColonyEmptyState.tsx`:

```typescript
import { useRef, useEffect } from "react";
import { hudColors, hudFonts, hudSpacing } from "./hudTokens";

export interface ColonyEmptyStateProps {
  onFound: () => void;
}

export function ColonyEmptyState({ onFound }: ColonyEmptyStateProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
      padding: hudSpacing.xl,
      fontFamily: hudFonts.mono,
      color: hudColors.textPrimary,
    }}>
      <h2 style={{
        fontSize: "24px",
        color: hudColors.cyanAccent,
        marginBottom: hudSpacing.md,
        fontWeight: "bold",
        letterSpacing: "0.1em",
      }}>
        NO COLONIES FOUNDED
      </h2>
      <p style={{
        maxWidth: "480px",
        textAlign: "center",
        color: hudColors.textMuted,
        marginBottom: hudSpacing.xl,
        lineHeight: 1.6,
      }}>
        Earth has authorized founding protocols. Your first settlement can
        anchor on Ashfall — a desert world already mapped by forward scouts.
      </p>
      <button
        ref={buttonRef}
        onClick={onFound}
        style={{
          padding: `${hudSpacing.md} ${hudSpacing.xl}`,
          background: "transparent",
          color: hudColors.cyanAccent,
          border: `1px solid ${hudColors.cyanAccent}`,
          fontFamily: hudFonts.mono,
          fontSize: "14px",
          letterSpacing: "0.1em",
          cursor: "pointer",
          textTransform: "uppercase",
        }}
      >
        Found Colony at Ashfall
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Create `ColoniesScreen.tsx` (scaffold with empty-state routing)**

Create `game/app/components/colony/meta/ColoniesScreen.tsx`:

```typescript
import { useEffect } from "react";
import type { SaveData } from "../../engine/types";
import type { ColonyEvent } from "../shared/colonyEvents";
import { Events } from "../shared/colonyEvents";
import { hudColors, hudFonts } from "./hudTokens";
import { ColonyEmptyState } from "./ColonyEmptyState";

export interface ColoniesScreenProps {
  save: SaveData;
  onDispatch: (event: ColonyEvent) => void;
  onExit: () => void;
}

export function ColoniesScreen({ save, onDispatch, onExit }: ColoniesScreenProps) {
  // Escape key to exit
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onExit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onExit]);

  const handleFound = () => {
    onDispatch(Events.founded({
      colonyId: "ashfall_primary",
      name: "Ashfall Primary",
      planetId: "ashfall",
      foundingType: "outpost",
      regionNodeId: "ashfall_starter_region",
      missionCount: save.missionsSinceStart,
      layoutSeed: 42,
    }));
    onDispatch(Events.resourceChanged({
      colonyId: "ashfall_primary",
      delta: { metal: 500 },
      reason: "starter_grant",
    }));
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      background: hudColors.deep,
      color: hudColors.textPrimary,
      fontFamily: hudFonts.mono,
      zIndex: 1000,
      overflow: "auto",
    }}>
      {save.colonies.length === 0 ? (
        <ColonyEmptyState onFound={handleFound} />
      ) : (
        <PopulatedPlaceholder onExit={onExit} save={save} />
      )}
    </div>
  );
}

// Placeholder until Tasks 6-8 replace it with the real components.
function PopulatedPlaceholder({ onExit, save }: { onExit: () => void; save: SaveData }) {
  const colony = save.colonies[0];
  return (
    <div style={{ padding: "32px" }}>
      <button onClick={onExit} style={{
        background: "transparent",
        border: "none",
        color: hudColors.cyanAccent,
        fontFamily: hudFonts.mono,
        cursor: "pointer",
        fontSize: "14px",
      }}>
        ← RETURN TO COCKPIT
      </button>
      <h1 style={{ color: hudColors.cyanAccent, marginTop: "16px" }}>
        {colony.name}
      </h1>
      <p style={{ color: hudColors.textMuted, marginTop: "8px" }}>
        Tier {colony.tier} · {colony.foundingType} · Cycle {save.missionsSinceStart}
      </p>
      <p style={{ marginTop: "24px", color: hudColors.textMuted }}>
        [Populated screen lands in Tasks 6-8]
      </p>
      <p style={{ marginTop: "16px" }}>
        Resources: food {colony.resources.food}, water {colony.resources.water}, metal {colony.resources.metal}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Create `meta/index.ts`**

Create `game/app/components/colony/meta/index.ts`:

```typescript
export { ColoniesScreen } from "./ColoniesScreen";
export type { ColoniesScreenProps } from "./ColoniesScreen";
```

- [ ] **Step 5 (TDD): Write the SSR smoke test**

Create `game/tests/colony/coloniesScreenSmoke.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { ColoniesScreen } from "../../app/components/colony/meta";
import type { SaveData } from "../../app/components/engine/types";

function makeEmptySave(): SaveData {
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

test("ColoniesScreen renders empty state without throwing", () => {
  const save = makeEmptySave();
  const html = renderToString(createElement(ColoniesScreen, {
    save,
    onDispatch: () => {},
    onExit: () => {},
  }));
  assert.ok(html.includes("NO COLONIES FOUNDED"), "should render the empty-state heading");
  assert.ok(html.includes("Found Colony at Ashfall"), "should render the found button");
});

test("ColoniesScreen renders populated state without throwing", () => {
  const save = makeEmptySave();
  const populated = {
    ...save,
    missionsSinceStart: 3,
    colonies: [{
      id: "ashfall_primary",
      name: "Ashfall Primary",
      planetId: "ashfall" as const,
      foundingType: "outpost" as const,
      tier: 1 as const,
      regionNodeId: "ashfall_starter_region",
      population: { total: 0, capacity: 0, namedCount: 0, growthRate: 0, recentDeaths: [] },
      resources: { food: 0, water: 0, metal: 500, credits: 0 },
      buildings: [],
      districts: [],
      namedNpcs: [],
      backgroundColonistDensity: 0,
      happiness: 50,
      selfSufficient: false,
      lastCycleProcessed: 0,
      lastGameClock: { day: 0, hour: 7, minute: 0, realtimeMsPerGameMinute: 1000, season: "standard" },
      activeThreats: [],
      activeQuestlines: [],
      discoveredPoiIds: [],
      layoutSeed: 42,
      founded: { missionCount: 0, gameClockTick: 0 },
    }],
  };
  const html = renderToString(createElement(ColoniesScreen, {
    save: populated,
    onDispatch: () => {},
    onExit: () => {},
  }));
  assert.ok(html.includes("Ashfall Primary"), "should render colony name");
  assert.ok(html.includes("RETURN TO COCKPIT"), "should render back link");
});
```

- [ ] **Step 6: Run the smoke test**

Run: `cd game && yarn colony:test`
Expected: 53/53 passing (51 prior + 2 smoke tests).

If the test fails with a `react-dom/server` resolution error, check that `react-dom` is in `game/package.json` dependencies — it already should be (it's a Next.js peer dep). If needed, try importing from `react-dom/server.node` (the Node-specific export that React 19 provides).

- [ ] **Step 7: Mount ColoniesScreen in Game.tsx**

In `game/app/components/Game.tsx`:

Add import near the top with other colony-adjacent imports:

```typescript
import { ColoniesScreen } from "./colony/meta";
import type { ColonyEvent } from "./colony";
import { colonyReducer } from "./colony";
```

Add a dispatch handler as a memoized callback inside the component (near other handlers):

```typescript
const handleColonyDispatch = useCallback((event: ColonyEvent) => {
  setSaveData(prev => {
    const next = colonyReducer(prev, event);
    saveSave(next);
    return next;
  });
}, []);
```

At the bottom of the component's returned JSX (as a sibling of the `<canvas>`), add:

```tsx
{currentScreen === "colonies" && (
  <ColoniesScreen
    save={saveData}
    onDispatch={handleColonyDispatch}
    onExit={returnToCockpit}
  />
)}
```

**Tip:** the variable holding the screen state may be named differently (e.g., `screen`, `cockpitScreen`). Use the actual variable name. The dispatch may also use `setSaveData` with a direct value instead of a functional updater — read the surrounding code and pick the pattern that's consistent.

If `useCallback` isn't already imported from React, add it to the imports.

- [ ] **Step 8: Playtest — founding flow**

Run: `cd game && yarn dev`

Navigate to cockpit → COLONIES → overlay appears with empty state → click "Found Colony at Ashfall" → overlay rerenders with "Ashfall Primary" placeholder. Click "Return to Cockpit" or press Escape → overlay unmounts → canvas cockpit visible again.

Inspect localStorage (`sector-zero-save`): `colonies` should be a 1-element array, `colonies[0].resources.metal` should be 500.

- [ ] **Step 9: Verify build**

Run: `cd game && yarn build`
Expected: clean.

- [ ] **Step 10: Commit**

```bash
cd /Users/nichalasbarnes/Desktop/projects/sector-zero
git add \
  game/app/components/colony/meta/hudTokens.ts \
  game/app/components/colony/meta/ColonyEmptyState.tsx \
  game/app/components/colony/meta/ColoniesScreen.tsx \
  game/app/components/colony/meta/index.ts \
  game/tests/colony/coloniesScreenSmoke.test.ts \
  game/app/components/Game.tsx
git commit -m "feat(colony): DOM overlay scaffold with empty-state founding"
```

---

### Task 6: ColonyHeader + predictedDeltas + ColonyResourcePanel

**Goal:** The populated screen gains a proper header and resource panel. `predictedDeltas` is a pure helper with unit tests.

**Files:**
- Create: `game/app/components/colony/meta/predictedDeltas.ts`
- Create: `game/tests/colony/predictedDeltas.test.ts`
- Create: `game/app/components/colony/meta/ColonyHeader.tsx`
- Create: `game/app/components/colony/meta/ColonyResourcePanel.tsx`
- Modify: `game/app/components/colony/meta/ColoniesScreen.tsx`

- [ ] **Step 1 (TDD): Write failing tests for predictedDeltas**

Create `game/tests/colony/predictedDeltas.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { predictedDeltas } from "../../app/components/colony/meta/predictedDeltas";
import { makeTestColony } from "./fixtures";

test("predictedDeltas: empty colony produces zero deltas", () => {
  const colony = makeTestColony();
  const d = predictedDeltas(colony);
  assert.equal(d.food, 0);
  assert.equal(d.water, 0);
  assert.equal(d.metal, 0);
});

test("predictedDeltas: operational farm + water purifier minus farm upkeep", () => {
  const colony = makeTestColony({
    buildings: [
      { id: "f", type: "farm", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
      { id: "w", type: "water_purifier", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
    population: { total: 0, capacity: 0, namedCount: 0, growthRate: 0, recentDeaths: [] },
  });
  const d = predictedDeltas(colony);
  // farm +15 food, water_purifier +12 water, farm upkeep -5 water, pop=0
  assert.equal(d.food, 15);
  assert.equal(d.water, 7);
  assert.equal(d.metal, 0);
});

test("predictedDeltas: population subtracts consumption", () => {
  const colony = makeTestColony({
    buildings: [
      { id: "f", type: "farm", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
    population: { total: 10, capacity: 10, namedCount: 0, growthRate: 0, recentDeaths: [] },
  });
  const d = predictedDeltas(colony);
  // farm +15 food, farm upkeep -5 water, pop 10 eats 10 food + 5 water
  assert.equal(d.food, 5);  // 15 - 10
  assert.equal(d.water, -10); // 0 - 5 upkeep - 5 consumption
});

test("predictedDeltas: constructing buildings do not contribute", () => {
  const colony = makeTestColony({
    buildings: [
      { id: "f", type: "farm", tier: 1, status: "constructing", buildProgressCycles: 2, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const d = predictedDeltas(colony);
  assert.equal(d.food, 0);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `cd game && yarn colony:test`
Expected: 4 new tests fail (module-not-found).

- [ ] **Step 3: Implement `predictedDeltas.ts`**

Create `game/app/components/colony/meta/predictedDeltas.ts`:

```typescript
import { RESOURCE_PRODUCTION, RESOURCE_UPKEEP } from "../shared/colonyCatalog";
import type { ColonyState } from "../shared/colonyTypes";

export type StockpileDelta = {
  food: number;
  water: number;
  metal: number;
};

/**
 * Predict per-cycle deltas for the three stockpile resources based on the
 * current colony state. Credits omitted — no Phase 1 source for them.
 * Power is a derived grid value, not a stockpile, and is computed separately
 * via derivePowerGrid.
 *
 * This mirrors the cycle processor's step1-3 + step2 math so the UI hint
 * matches what will actually happen on the next mission completion.
 */
export function predictedDeltas(colony: ColonyState): StockpileDelta {
  const delta: StockpileDelta = { food: 0, water: 0, metal: 0 };

  for (const b of colony.buildings) {
    if (b.status !== "operational") continue;
    const prod = RESOURCE_PRODUCTION[b.type];
    if (prod?.food) delta.food += prod.food;
    if (prod?.water) delta.water += prod.water;
    if (prod?.metal) delta.metal += prod.metal;
  }

  for (const b of colony.buildings) {
    if (b.status !== "operational") continue;
    const up = RESOURCE_UPKEEP[b.type];
    if (up?.food) delta.food -= up.food;
    if (up?.water) delta.water -= up.water;
    if (up?.metal) delta.metal -= up.metal;
  }

  delta.food -= colony.population.total;
  delta.water -= Math.floor(colony.population.total * 0.5);

  return delta;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd game && yarn colony:test`
Expected: 57/57 passing (53 prior + 4 new).

- [ ] **Step 5: Create ColonyHeader.tsx**

Create `game/app/components/colony/meta/ColonyHeader.tsx`:

```typescript
import type { ColonyState } from "../shared/colonyTypes";
import { hudColors, hudFonts, hudSpacing } from "./hudTokens";

export interface ColonyHeaderProps {
  colony: ColonyState;
  missionsSinceStart: number;
  onBack: () => void;
}

export function ColonyHeader({ colony, missionsSinceStart, onBack }: ColonyHeaderProps) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      padding: hudSpacing.md,
      borderBottom: `1px solid ${hudColors.borderHud}`,
    }}>
      <button
        onClick={onBack}
        style={{
          background: "transparent",
          border: "none",
          color: hudColors.cyanAccent,
          fontFamily: hudFonts.mono,
          fontSize: "14px",
          cursor: "pointer",
          padding: 0,
          marginRight: hudSpacing.lg,
        }}
      >
        ← RETURN TO COCKPIT
      </button>
      <div style={{ flex: 1 }}>
        <h1 style={{
          fontSize: "18px",
          color: hudColors.cyanAccent,
          margin: 0,
          letterSpacing: "0.1em",
        }}>
          {colony.name.toUpperCase()}
        </h1>
        <div style={{
          fontSize: "11px",
          color: hudColors.textMuted,
          marginTop: "2px",
          letterSpacing: "0.08em",
        }}>
          TIER {colony.tier} · {colony.foundingType.toUpperCase()}
        </div>
      </div>
      <div style={{
        fontSize: "11px",
        color: hudColors.textMuted,
        letterSpacing: "0.08em",
      }}>
        CYCLE {missionsSinceStart}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create ColonyResourcePanel.tsx**

Create `game/app/components/colony/meta/ColonyResourcePanel.tsx`:

```typescript
import type { ColonyState } from "../shared/colonyTypes";
import { derivePowerGrid } from "../shared/powerGrid";
import { predictedDeltas } from "./predictedDeltas";
import { hudColors, hudFonts, hudSpacing } from "./hudTokens";

export interface ColonyResourcePanelProps {
  colony: ColonyState;
}

function formatDelta(n: number): string {
  if (n > 0) return `+${n}`;
  return `${n}`;
}

export function ColonyResourcePanel({ colony }: ColonyResourcePanelProps) {
  const deltas = predictedDeltas(colony);
  const grid = derivePowerGrid(colony);

  const tile = (label: string, value: string | number, deltaLabel: string, deltaColor: string) => (
    <div style={{
      border: `1px solid ${hudColors.borderHud}`,
      padding: hudSpacing.md,
      minWidth: "120px",
    }}>
      <div style={{ fontSize: "10px", color: hudColors.textMuted, letterSpacing: "0.1em" }}>
        {label}
      </div>
      <div style={{ fontSize: "24px", color: hudColors.textPrimary, marginTop: "4px" }}>
        {value}
      </div>
      <div style={{ fontSize: "11px", color: deltaColor, marginTop: "2px" }}>
        {deltaLabel}
      </div>
    </div>
  );

  const deltaColor = (n: number) =>
    n > 0 ? hudColors.success : n < 0 ? hudColors.dangerAccent : hudColors.textMuted;

  const powerDelta = grid.surplus;
  const powerLabel = grid.demand === 0 && grid.capacity === 0
    ? "idle"
    : powerDelta >= 0 ? `surplus ${powerDelta}` : `deficit ${Math.abs(powerDelta)}`;

  return (
    <div style={{
      display: "flex",
      gap: hudSpacing.md,
      padding: hudSpacing.md,
      fontFamily: hudFonts.mono,
    }}>
      {tile("FOOD", colony.resources.food, `${formatDelta(deltas.food)}/cycle`, deltaColor(deltas.food))}
      {tile("WATER", colony.resources.water, `${formatDelta(deltas.water)}/cycle`, deltaColor(deltas.water))}
      {tile("METAL", colony.resources.metal, `${formatDelta(deltas.metal)}/cycle`, deltaColor(deltas.metal))}
      {tile("POWER", `${grid.capacity}/${grid.demand}`, powerLabel, powerDelta >= 0 ? hudColors.success : hudColors.dangerAccent)}
    </div>
  );
}
```

- [ ] **Step 7: Wire ColonyHeader + ColonyResourcePanel into ColoniesScreen**

Update `game/app/components/colony/meta/ColoniesScreen.tsx`:

Replace the `PopulatedPlaceholder` component with a real populated view:

```typescript
import { ColonyHeader } from "./ColonyHeader";
import { ColonyResourcePanel } from "./ColonyResourcePanel";

// ... replace the PopulatedPlaceholder function with:

function PopulatedView({ save, onExit }: { save: SaveData; onExit: () => void }) {
  const colony = save.colonies[0];
  return (
    <>
      <ColonyHeader
        colony={colony}
        missionsSinceStart={save.missionsSinceStart}
        onBack={onExit}
      />
      <ColonyResourcePanel colony={colony} />
      <div style={{ padding: "32px", opacity: 0.6 }}>
        [ColonyMetrics / BuildingsList / CommissionMenu land in Tasks 7-8]
      </div>
    </>
  );
}
```

And replace the `PopulatedPlaceholder` reference in the main component with `PopulatedView`.

- [ ] **Step 8: Run smoke test to verify nothing broke**

Run: `cd game && yarn colony:test`
Expected: 57/57 passing. Smoke test still asserts "Ashfall Primary" appears in the populated render.

- [ ] **Step 9: Verify build**

Run: `cd game && yarn build`
Expected: clean.

- [ ] **Step 10: Playtest**

Run: `cd game && yarn dev`. Navigate to COLONIES, found colony, verify the header shows name/tier/cycle and the 4 resource tiles show 0/0/500/0 with appropriate delta indicators. Metal tile: 500, delta 0/cycle (no operational buildings).

- [ ] **Step 11: Commit**

```bash
cd /Users/nichalasbarnes/Desktop/projects/sector-zero
git add \
  game/app/components/colony/meta/predictedDeltas.ts \
  game/app/components/colony/meta/ColonyHeader.tsx \
  game/app/components/colony/meta/ColonyResourcePanel.tsx \
  game/app/components/colony/meta/ColoniesScreen.tsx \
  game/tests/colony/predictedDeltas.test.ts
git commit -m "feat(colony): ColonyHeader + ColonyResourcePanel + predictedDeltas helper"
```

---

### Task 7: ColonyMetrics + ColonyBuildingsList

**Goal:** Add the two middle sections of the populated screen — population/happiness metrics and the buildings list.

**Files:**
- Create: `game/app/components/colony/meta/ColonyMetrics.tsx`
- Create: `game/app/components/colony/meta/ColonyBuildingsList.tsx`
- Modify: `game/app/components/colony/meta/ColoniesScreen.tsx`

- [ ] **Step 1: Create ColonyMetrics.tsx**

Create `game/app/components/colony/meta/ColonyMetrics.tsx`:

```typescript
import type { ColonyState } from "../shared/colonyTypes";
import { hudColors, hudFonts, hudSpacing } from "./hudTokens";

export interface ColonyMetricsProps {
  colony: ColonyState;
}

function happinessLabel(h: number): string {
  if (h >= 80) return "Thriving";
  if (h >= 50) return "Stable";
  if (h >= 25) return "Declining";
  return "Collapsing";
}

export function ColonyMetrics({ colony }: ColonyMetricsProps) {
  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display: "flex", gap: hudSpacing.md, marginBottom: "4px" }}>
      <span style={{ color: hudColors.textMuted, minWidth: "120px", fontSize: "11px", letterSpacing: "0.08em" }}>
        {label}
      </span>
      <span style={{ color: hudColors.textPrimary, fontSize: "13px" }}>
        {value}
      </span>
    </div>
  );

  return (
    <div style={{
      padding: hudSpacing.md,
      fontFamily: hudFonts.mono,
      borderBottom: `1px solid ${hudColors.borderHud}`,
    }}>
      {row("POPULATION", `${colony.population.total} / ${colony.population.capacity}`)}
      {row("HAPPINESS", `${colony.happiness} · ${happinessLabel(colony.happiness)}`)}
      {row("SELF-SUFFICIENT", colony.selfSufficient ? "✓ Yes" : "— No")}
    </div>
  );
}
```

- [ ] **Step 2: Create ColonyBuildingsList.tsx**

Create `game/app/components/colony/meta/ColonyBuildingsList.tsx`:

```typescript
import type { ColonyState, ColonyBuilding } from "../shared/colonyTypes";
import { hudColors, hudFonts, hudSpacing } from "./hudTokens";

export interface ColonyBuildingsListProps {
  colony: ColonyState;
}

function statusIcon(status: ColonyBuilding["status"]): string {
  switch (status) {
    case "operational": return "●";
    case "constructing": return "○";
    case "damaged": return "!";
    case "offline": return "×";
    case "destroyed": return "✗";
  }
}

function statusColor(status: ColonyBuilding["status"]): string {
  switch (status) {
    case "operational": return hudColors.success;
    case "constructing": return hudColors.cyanAccent;
    case "damaged": return hudColors.dangerAccent;
    case "offline": return hudColors.textMuted;
    case "destroyed": return hudColors.dangerAccent;
  }
}

function prettyType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export function ColonyBuildingsList({ colony }: ColonyBuildingsListProps) {
  return (
    <div style={{
      padding: hudSpacing.md,
      fontFamily: hudFonts.mono,
      borderBottom: `1px solid ${hudColors.borderHud}`,
    }}>
      <div style={{
        fontSize: "10px",
        color: hudColors.textMuted,
        letterSpacing: "0.1em",
        marginBottom: hudSpacing.sm,
      }}>
        BUILDINGS
      </div>
      {colony.buildings.length === 0 ? (
        <div style={{
          padding: hudSpacing.sm,
          border: `1px dashed ${hudColors.borderHud}`,
          color: hudColors.textMuted,
          fontSize: "12px",
        }}>
          No buildings yet — commission your first below.
        </div>
      ) : (
        <div>
          {colony.buildings.map(b => (
            <div key={b.id} style={{
              display: "flex",
              gap: hudSpacing.md,
              padding: "4px 0",
              fontSize: "12px",
            }}>
              <span style={{ color: statusColor(b.status), minWidth: "16px" }}>
                {statusIcon(b.status)}
              </span>
              <span style={{ color: hudColors.textPrimary, minWidth: "140px" }}>
                {prettyType(b.type)}
              </span>
              <span style={{ color: hudColors.textMuted, minWidth: "100px" }}>
                {b.status}
              </span>
              <span style={{ color: hudColors.textMuted }}>
                {b.status === "constructing"
                  ? `${b.buildProgressCycles} cycle${b.buildProgressCycles === 1 ? "" : "s"} remaining`
                  : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire into ColoniesScreen**

Update `ColoniesScreen.tsx`'s `PopulatedView`:

```typescript
import { ColonyMetrics } from "./ColonyMetrics";
import { ColonyBuildingsList } from "./ColonyBuildingsList";

function PopulatedView({ save, onExit }: { save: SaveData; onExit: () => void }) {
  const colony = save.colonies[0];
  return (
    <>
      <ColonyHeader colony={colony} missionsSinceStart={save.missionsSinceStart} onBack={onExit} />
      <ColonyResourcePanel colony={colony} />
      <ColonyMetrics colony={colony} />
      <ColonyBuildingsList colony={colony} />
      <div style={{ padding: "32px", opacity: 0.6 }}>
        [CommissionMenu lands in Task 8]
      </div>
    </>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `cd game && yarn colony:test`
Expected: 57/57 passing (no test changes).

- [ ] **Step 5: Verify build**

Run: `cd game && yarn build`
Expected: clean.

- [ ] **Step 6: Playtest**

Run: `cd game && yarn dev`. Navigate to COLONIES. The populated screen should now show:
- Header
- 4 resource tiles
- Population 0/0, Happiness 50 Stable, Self-Sufficient — No
- Buildings section with the dashed "No buildings yet" placeholder

- [ ] **Step 7: Commit**

```bash
cd /Users/nichalasbarnes/Desktop/projects/sector-zero
git add \
  game/app/components/colony/meta/ColonyMetrics.tsx \
  game/app/components/colony/meta/ColonyBuildingsList.tsx \
  game/app/components/colony/meta/ColoniesScreen.tsx
git commit -m "feat(colony): ColonyMetrics + ColonyBuildingsList"
```

---

### Task 8: ColonyCommissionMenu + commission flow

**Goal:** Player can click a BUILD card to commission one of 4 buildings. Affordability is gated client-side. The commission event dispatches through the reducer.

**Files:**
- Create: `game/app/components/colony/meta/buildingIdGen.ts`
- Create: `game/app/components/colony/meta/ColonyCommissionMenu.tsx`
- Modify: `game/app/components/colony/meta/ColoniesScreen.tsx`

- [ ] **Step 1: Create buildingIdGen.ts**

Create `game/app/components/colony/meta/buildingIdGen.ts`:

```typescript
import type { ColonyState, BuildingInstanceId, BuildingType } from "../shared/colonyTypes";

/**
 * Deterministic building ID generator. Uses colony ID + current building count
 * + building type. Matches the threat-ID convention from Phase 0's final-review
 * cleanup — no Date.now, no Math.random.
 *
 * Caveat: if two buildings of the same type are commissioned in the same state
 * snapshot (unreachable in Phase 1 because each click re-dispatches before the
 * next click can fire), IDs could theoretically collide. Phase 1 safety comes
 * from React's event batching + single-writer reducer.
 */
export function genBuildingId(colony: ColonyState, buildingType: BuildingType): BuildingInstanceId {
  return `b-${colony.id}-${colony.buildings.length}-${buildingType}`;
}
```

- [ ] **Step 2: Create ColonyCommissionMenu.tsx**

Create `game/app/components/colony/meta/ColonyCommissionMenu.tsx`:

```typescript
import type { ColonyState, BuildingType, ColonyResources } from "../shared/colonyTypes";
import type { ColonyEvent } from "../shared/colonyEvents";
import { Events } from "../shared/colonyEvents";
import { genBuildingId } from "./buildingIdGen";
import { hudColors, hudFonts, hudSpacing } from "./hudTokens";

export interface ColonyCommissionMenuProps {
  colony: ColonyState;
  onDispatch: (event: ColonyEvent) => void;
}

interface BuildOption {
  type: BuildingType;
  label: string;
  icon: string;
  cost: Partial<ColonyResources>;
  cyclesToBuild: number;
  shortDesc: string;
}

const PHASE_1_BUILD_OPTIONS: BuildOption[] = [
  { type: "solar_array", label: "Solar Array", icon: "☀", cost: { metal: 80 }, cyclesToBuild: 1, shortDesc: "+10 power" },
  { type: "farm", label: "Farm", icon: "🌾", cost: { metal: 100 }, cyclesToBuild: 2, shortDesc: "+15 food, −5 water" },
  { type: "water_purifier", label: "Water Purifier", icon: "💧", cost: { metal: 120 }, cyclesToBuild: 2, shortDesc: "+12 water" },
  { type: "habitat_module", label: "Habitat Module", icon: "🏠", cost: { metal: 100 }, cyclesToBuild: 1, shortDesc: "Houses 10" },
];

function canAfford(colony: ColonyState, cost: Partial<ColonyResources>): boolean {
  return (cost.food ?? 0) <= colony.resources.food
    && (cost.water ?? 0) <= colony.resources.water
    && (cost.metal ?? 0) <= colony.resources.metal
    && (cost.credits ?? 0) <= colony.resources.credits;
}

function costLabel(cost: Partial<ColonyResources>): string {
  const parts: string[] = [];
  if (cost.metal) parts.push(`${cost.metal} metal`);
  if (cost.food) parts.push(`${cost.food} food`);
  if (cost.water) parts.push(`${cost.water} water`);
  return parts.join(" · ");
}

export function ColonyCommissionMenu({ colony, onDispatch }: ColonyCommissionMenuProps) {
  const handleBuild = (opt: BuildOption) => {
    onDispatch(Events.buildingCommissioned({
      colonyId: colony.id,
      buildingId: genBuildingId(colony, opt.type),
      buildingType: opt.type,
      costDeducted: opt.cost,
      cyclesToBuild: opt.cyclesToBuild,
    }));
  };

  return (
    <div style={{
      padding: hudSpacing.md,
      fontFamily: hudFonts.mono,
    }}>
      <div style={{
        fontSize: "10px",
        color: hudColors.textMuted,
        letterSpacing: "0.1em",
        marginBottom: hudSpacing.sm,
      }}>
        COMMISSION NEW BUILDING
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: hudSpacing.md,
      }}>
        {PHASE_1_BUILD_OPTIONS.map(opt => {
          const affordable = canAfford(colony, opt.cost);
          return (
            <div
              key={opt.type}
              style={{
                border: `1px solid ${affordable ? hudColors.borderActive : hudColors.borderHud}`,
                padding: hudSpacing.md,
                opacity: affordable ? 1 : 0.5,
              }}
            >
              <div style={{
                fontSize: "14px",
                color: hudColors.textPrimary,
                marginBottom: "4px",
              }}>
                {opt.icon} {opt.label}
              </div>
              <div style={{
                fontSize: "10px",
                color: hudColors.textMuted,
                marginBottom: "2px",
              }}>
                {costLabel(opt.cost)} · {opt.cyclesToBuild} cycle{opt.cyclesToBuild === 1 ? "" : "s"}
              </div>
              <div style={{
                fontSize: "10px",
                color: hudColors.textMuted,
                marginBottom: hudSpacing.sm,
              }}>
                {opt.shortDesc}
              </div>
              <button
                onClick={() => handleBuild(opt)}
                disabled={!affordable}
                style={{
                  width: "100%",
                  padding: `${hudSpacing.sm} ${hudSpacing.md}`,
                  background: affordable ? "rgba(0, 240, 255, 0.08)" : "transparent",
                  color: affordable ? hudColors.cyanAccent : hudColors.textMuted,
                  border: `1px solid ${affordable ? hudColors.cyanAccent : hudColors.borderHud}`,
                  fontFamily: hudFonts.mono,
                  fontSize: "12px",
                  letterSpacing: "0.1em",
                  cursor: affordable ? "pointer" : "not-allowed",
                  textTransform: "uppercase",
                }}
              >
                {affordable ? "Build" : `Need ${(opt.cost.metal ?? 0) - colony.resources.metal} more metal`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire ColonyCommissionMenu into ColoniesScreen**

Update `PopulatedView` in `ColoniesScreen.tsx`:

```typescript
import { ColonyCommissionMenu } from "./ColonyCommissionMenu";

function PopulatedView({
  save,
  onDispatch,
  onExit,
}: {
  save: SaveData;
  onDispatch: (event: ColonyEvent) => void;
  onExit: () => void;
}) {
  const colony = save.colonies[0];
  return (
    <>
      <ColonyHeader colony={colony} missionsSinceStart={save.missionsSinceStart} onBack={onExit} />
      <ColonyResourcePanel colony={colony} />
      <ColonyMetrics colony={colony} />
      <ColonyBuildingsList colony={colony} />
      <ColonyCommissionMenu colony={colony} onDispatch={onDispatch} />
    </>
  );
}
```

The top-level `ColoniesScreen` must now pass `onDispatch` down:

```typescript
{save.colonies.length === 0 ? (
  <ColonyEmptyState onFound={handleFound} />
) : (
  <PopulatedView save={save} onDispatch={onDispatch} onExit={onExit} />
)}
```

- [ ] **Step 4: Run tests**

Run: `cd game && yarn colony:test`
Expected: 57/57 passing.

- [ ] **Step 5: Verify build**

Run: `cd game && yarn build`
Expected: clean.

- [ ] **Step 6: Playtest the full flow**

Run: `cd game && yarn dev`.

- Navigate to COLONIES → empty state shows
- Click "Found Colony at Ashfall" → populated screen appears with 500 metal
- 4 commission cards show: 3 BUILD buttons enabled (Solar, Farm, Habitat) + 1 disabled (Water Purifier needs 120 metal, we only have 500 — actually this should be enabled too at 500 metal; only disable Water Purifier after spending enough)
- Click BUILD on Solar Array → card still visible, metal drops 500 → 420, Solar Array appears in buildings list as "constructing, 1 cycle remaining"
- Build Farm: metal 420 → 320, farm appears constructing 2 cycles remaining
- Return to cockpit → launch any mission → complete it
- Reopen COLONIES: cycle counter shows 1, Solar Array now operational, Farm shows "1 cycle remaining"
- Complete another mission: Farm now operational, Solar Array still operational

- [ ] **Step 7: Commit**

```bash
cd /Users/nichalasbarnes/Desktop/projects/sector-zero
git add \
  game/app/components/colony/meta/buildingIdGen.ts \
  game/app/components/colony/meta/ColonyCommissionMenu.tsx \
  game/app/components/colony/meta/ColoniesScreen.tsx
git commit -m "feat(colony): ColonyCommissionMenu + full Phase 1 commission flow"
```

---

### Task 9: Final verification + completion log

**Goal:** Verify acceptance criteria, tag the phase, append completion log.

**Files:**
- Modify: `docs/superpowers/plans/2026-04-20-colony-phase-1-meta-single-colony.md` (completion log)
- Create: git tag `colony-phase-1-complete`

- [ ] **Step 1: Run all tests**

Run: `cd /Users/nichalasbarnes/Desktop/projects/sector-zero/game && yarn colony:test`
Expected: **57/57 or more** passing, 0 failing.

Run: `cd /Users/nichalasbarnes/Desktop/projects/sector-zero/game && yarn build`
Expected: clean static export.

Run: `cd /Users/nichalasbarnes/Desktop/projects/sector-zero/game && npx tsc --noEmit -p tsconfig.json`
Expected: exit 0, no output.

- [ ] **Step 2: Complete manual playtest checklist**

Run `cd game && yarn dev` and walk through:

- [ ] Game loads to title/hub
- [ ] Cockpit hub visible, all existing stations (STAR MAP, ARMORY, CREW, MISSIONS, CODEX, BESTIARY, PILOT) functional
- [ ] Arrow-key navigation lands on COLONIES hotspot
- [ ] Pressing Z/Enter opens fullscreen DOM overlay
- [ ] Empty state shows with "Found Colony at Ashfall" button auto-focused
- [ ] Click button → populated screen: header, 4 resource tiles, population/happiness/self-suff, empty buildings list, 4 commission cards
- [ ] Metal = 500; Food/Water = 0; Power shows 0/0
- [ ] BUILD on Solar Array → metal 500 → 420; Solar Array listed as constructing 1 cycle
- [ ] BUILD on Farm → metal 420 → 320; Farm listed as constructing 2 cycles
- [ ] BUILD on Water Purifier → metal 320 → 200; purifier listed 2 cycles
- [ ] BUILD on Habitat → metal 200 → 100; Habitat listed 1 cycle
- [ ] After 4 commissions, metal = 100, none of the 4 are affordable anymore (disabled)
- [ ] Press Escape → overlay unmounts, canvas cockpit visible
- [ ] Launch a campaign mission (any), complete it successfully
- [ ] Cockpit reopens; navigate back to COLONIES
- [ ] Cycle counter shows 1; Solar Array + Habitat now operational; Farm + Purifier show "1 cycle remaining"
- [ ] Food delta still 0/cycle (Farm is still constructing); food stockpile still 0
- [ ] Launch another mission, complete; return to COLONIES
- [ ] Cycle 2; Farm + Purifier operational; food now shows +15/cycle delta; next cycle food should tick up
- [ ] Launch another mission; return to COLONIES
- [ ] Cycle 3; food = 15; water = 7 (12 produced - 5 farm upkeep)
- [ ] No console errors at any point
- [ ] Existing campaign missions (pick one, complete) still work normally

- [ ] **Step 3: Tag the phase**

Run:
```bash
cd /Users/nichalasbarnes/Desktop/projects/sector-zero
git tag colony-phase-1-complete
git tag | grep colony-phase
```

Expected output: both `colony-phase-0-complete` and `colony-phase-1-complete`.

- [ ] **Step 4: Append completion log**

Using the Edit tool, append this section to `docs/superpowers/plans/2026-04-20-colony-phase-1-meta-single-colony.md`:

```markdown

## Completion Log

**Completed:** 2026-04-20 (fill in actual date on completion)
**Branch:** colony/phase-1
**Tag:** colony-phase-1-complete

**Commits in order:**
- `<sha>` — T1: extract colonyCatalog
- `<sha>` — T2: cycle step 4.5 (building progress)
- `<sha>` — T3: wire advanceWorldCycle into mission completion
- `<sha>` — T4: add COLONIES hotspot to cockpit hub
- `<sha>` — T5: DOM overlay scaffold with empty-state founding
- `<sha>` — T6: ColonyHeader + ColonyResourcePanel + predictedDeltas
- `<sha>` — T7: ColonyMetrics + ColonyBuildingsList
- `<sha>` — T8: ColonyCommissionMenu + full commission flow
- `<sha>` — T9: completion log

**Acceptance criteria met:**
- `yarn colony:test`: green, N tests passing (fill in actual count, expect 57+)
- `yarn build`: green Next.js static export
- `npx tsc --noEmit`: exit 0
- Manual playtest checklist: 100% passing
- No regressions in existing campaign flow
- All state changes flow through colonyReducer

**Deferred to later phases:**
- Population/happiness management (Phase 5a)
- Multiple colonies + galaxy map (Phase 9)
- FPS descent (Phase 2)
- Grid planner (Phase 6)
- Tier promotion (Phase 6)
- Narrative dialog on founding (Phase 5a)
- Earth shipments UI (Phase 7b)
- CSS modules / Tailwind integration (Phase 12 polish)

**Next:** Phase 2 plan — FPS descent into the colony. Walking around the physical layout. The first raycaster-based colony content.
```

- [ ] **Step 5: Commit the completion log**

```bash
cd /Users/nichalasbarnes/Desktop/projects/sector-zero
git add docs/superpowers/plans/2026-04-20-colony-phase-1-meta-single-colony.md
git commit -m "docs(colony): Phase 1 completion log"
```

- [ ] **Step 6: Final status report**

Report:
- Branch: colony/phase-1
- Final commit SHA
- Test count
- Link to git log (`git log --oneline colony/phase-1 -12`)

---

## Acceptance Criteria (top-level)

Phase 1 is complete when ALL of the following are true:

- [ ] `cd game && yarn colony:test` runs green (expect 57+ tests)
- [ ] `cd game && yarn build` runs green
- [ ] `cd game && npx tsc --noEmit` exit 0
- [ ] All 4 CI jobs + GitGuardian pass on the Phase 1 PR
- [ ] Full manual playtest checklist (Task 9 Step 2) passes
- [ ] No regressions in existing campaign flow
- [ ] All state changes flow through `colonyReducer` (no direct `saveData.colonies[i] = ...`)
- [ ] Old saves (pre-Phase-1) load cleanly via `migrateSave`
- [ ] Git tag `colony-phase-1-complete` on the final commit
- [ ] Completion log appended to this plan

## Risk Mitigations

- **`advanceWorldCycle` wired in wrong place in `Game.tsx`** → Task 3 includes an audit step + manual smoke test. If missionsSinceStart doesn't tick, the implementer is instructed to audit and fix.
- **Canvas/DOM focus handoff causes stuck input** → Task 4 Step 6 blocks canvas keydown for "colonies"; Task 5 adds Escape-key handling to the overlay.
- **React mount thrashing on SaveData changes** → Mount is gated on `currentScreen === "colonies"`, not on saveData equality. React's internal diffing handles the rest.
- **`buildProgressCycles` step placement wrong** → Task 2 unit tests verify the boundaries (decrement, completion, operational no-op, non-negative).
- **CSS HUD tokens don't match existing aesthetic** → hudTokens.ts mirrors the site's @theme values; playtest catches visual regression.
- **react-dom/server import path in Node** → Task 5 Step 6 includes a fallback to `react-dom/server.node` if the default export resolution fails.
- **Nav graph indices shift when adding hotspot** → Task 4 Step 4 instructs the implementer to append COLONIES at the END of `COCKPIT_HOTSPOTS` to avoid re-indexing existing entries.

## Next Phase

After Phase 1 completes: Phase 2 plan (FPS descent). The colony becomes a walkable physical space in the first-person raycaster engine. See master spec for scope.

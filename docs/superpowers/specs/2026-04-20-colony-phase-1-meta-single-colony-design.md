# Sector Zero — Colony System Phase 1: Meta Layer (Single Colony)

**Date:** 2026-04-20
**Status:** Design approved, ready for implementation planning
**Predecessor:** `docs/superpowers/specs/2026-04-20-colony-system-design.md` (master spec, Phase 0 already shipped)
**Scope:** First player-visible colony UI. React/DOM overlay triggered from a new canvas cockpit hotspot. One colony. Four buildable types. Cycle ticks wired into mission completion.

---

## Goal

Deliver the **"proof of life"** increment of the colony system. After Phase 1 ships, a player can:

1. Start the game and navigate to a new COLONIES station in the cockpit hub
2. Found their first colony (Ashfall Primary) with one click
3. Commission buildings (Solar Array, Farm, Water Purifier, Habitat Module)
4. Fly a campaign mission
5. Return to cockpit, reopen COLONIES, and observe:
   - Cycle counter has advanced
   - Resources have changed per production / consumption math
   - Constructing buildings have progressed or completed

Every subsequent phase of the colony system adds depth on top of this loop; Phase 1 is where the loop exists at all.

---

## Scope Contract

### In scope
- DOM overlay in `game/app/components/colony/meta/`
- Canvas cockpit hotspot for COLONIES
- Empty-state founding flow (one button → one event)
- Populated colony screen: resources, metrics, buildings list, commission menu
- `advanceWorldCycle` hooked into `nextLevel` success path
- Cycle processor extended with a building-progress step
- Starter metal grant (500 metal dispatched after founding)
- `colonyCatalog.ts` extracted from `cycleProcessor.ts` (shared production/upkeep tables)
- Playtest checklist + one React smoke test in `yarn colony:test`

### Out of scope (deferred to later phases)
- Multiple colonies (Phase 9)
- FPS descent / raycaster integration (Phase 2)
- Grid planner / physical building placement (Phase 6)
- Population / happiness management systems (Phase 5a)
- POI / region interactions (Phase 4)
- Faction / reputation UI (Phase 5a)
- Earth shipments UI (Phase 7b)
- Completion notifications, HUD badges (Phase 12)
- Narrative dialog (Voss messages) on founding (Phase 5a)
- Tech tree / research (Phase 7a)
- Tier promotion (Phase 6)
- Destruction / retirement of buildings (deferred)

---

## Architecture

### The three-layer model, Phase 1 scope

Phase 0 established the three-layer architecture (Meta / Exploration / POI/Dungeon). Phase 1 implements the first portion of the **Meta Layer**:

- **Meta Layer** ← **Phase 1 lands here**: React/DOM overlay for single-colony planning
- **Exploration Layer** — Phase 2+
- **POI/Dungeon Layer** — Phase 4+

### Decision: DOM overlay over canvas

**Decision: Option B (DOM overlay on canvas).** The Phase 0 master spec called for "Meta layer: React/DOM UI, no canvas." The existing cockpit hub is canvas-rendered; Phase 1 introduces the first DOM-based station. The canvas cockpit itself is not touched beyond adding one new hotspot. When the player activates COLONIES, a React component mounts on top of the canvas and takes over the full viewport.

**Rejected alternatives:**
- Canvas station (matches existing pattern) — rejected because the grid planner in Phase 6 and galaxy map in Phase 9 become painful in canvas
- Hybrid canvas-summary + DOM-deep-view — rejected because Phase 1 is small; one render path is enough

### Decision: Fullscreen takeover transition

**Decision: Option A (fullscreen takeover).** When `currentScreen === "colonies"`, canvas rendering halts for the colony station (cockpitRenderer.ts early-returns) and the React overlay fills the viewport. Pressing Escape or clicking "Return to Cockpit" unmounts the overlay; canvas resumes.

**Rejected alternatives:**
- Floating modal — rejected (feels like web app, not game)
- Slide-in drawer — rejected (no reuse value in later phases)

### Decision: Sibling mount in Game.tsx

**Decision: Option A (sibling of canvas in Game.tsx).** No portals, no context API. The overlay is conditional JSX next to the canvas element:

```tsx
return (
  <>
    <canvas ref={canvasRef} ... />
    {currentScreen === "colonies" && (
      <ColoniesScreen
        save={saveData}
        onDispatch={handleColonyDispatch}
        onExit={returnToCockpit}
      />
    )}
  </>
);
```

### Decision: Player-initiated founding

**Decision: Option B (player clicks "Found Colony at Ashfall").** COLONIES station opens to an empty state if no colonies exist. One button click dispatches `Events.founded(...)` → reducer adds the colony → React re-renders into the populated screen. Narrative framing (Voss dialog, Earth Command authorization) is deferred to Phase 5a.

---

## File Layout

### New files

```
game/app/components/colony/
├── meta/
│   ├── ColoniesScreen.tsx              # fullscreen overlay, entrypoint
│   ├── ColonyHeader.tsx                # back arrow + name + tier + cycle counter
│   ├── ColonyResourcePanel.tsx         # 4-resource grid with per-cycle delta hints
│   ├── ColonyMetrics.tsx               # population + happiness + self-sufficient
│   ├── ColonyBuildingsList.tsx         # operational + constructing buildings
│   ├── ColonyCommissionMenu.tsx        # 4-card commission grid
│   ├── ColonyEmptyState.tsx            # pre-founding screen with Found button
│   ├── buildingIdGen.ts                # deterministic ID helper for new buildings
│   ├── predictedDeltas.ts              # pure helper for resource delta hints
│   ├── coloniesScreen.module.css       # scoped HUD-themed styles
│   └── index.ts                        # exports ColoniesScreen ONLY
└── shared/
    └── colonyCatalog.ts                # NEW: extracted RESOURCE_PRODUCTION + RESOURCE_UPKEEP

game/tests/colony/
└── coloniesScreenSmoke.test.ts         # SSR smoke test (renderToString with synthetic save)
```

### Modified files

```
game/app/components/colony/shared/
└── cycleProcessor.ts                   # new building-progress step; imports from colonyCatalog

game/app/components/colony/
└── index.ts                            # no changes needed — meta/ has its own index

game/app/components/engine/
├── cockpit.ts                          # add "colonies" to CockpitScreen union + hotspot + nav graph
└── cockpitRenderer.ts                  # early-return on screen === "colonies"

game/app/components/
└── Game.tsx                            # mount <ColoniesScreen/>, wire advanceWorldCycle into nextLevel, block canvas keydown when colonies active
```

### Public API rule

Consumers outside `colony/` import only from `colony/index.ts` (functions/types) and `colony/meta/index.ts` (the `ColoniesScreen` component). Internal `meta/` components are not exposed. Matches the boundary convention established in Phase 0.

---

## State Flow

### Single source of truth: `SaveData` in Game.tsx

```
Game.tsx useState<SaveData>(loadSave())
        |
        |  props.save
        v
<ColoniesScreen/>
        |
        |  onDispatch(event)
        v
Game.tsx handleColonyDispatch(event)
        |
        |  colonyReducer(save, event)
        v
setSaveData(next) + saveSave(next)
        |
        |  React rerender
        v
<ColoniesScreen/> re-renders with new save
```

No context, no Redux, no Zustand. The existing `saveData` useState remains the single source of truth. The overlay dispatches via a callback prop that the parent wires to the reducer.

### handleColonyDispatch signature

```typescript
function handleColonyDispatch(event: ColonyEvent): void {
  setSaveData(prev => {
    const next = colonyReducer(prev, event);
    saveSave(next);
    return next;
  });
}
```

The `setSaveData` functional form guarantees we reduce against the latest state even if multiple dispatches fire in the same tick.

### Keyboard / focus handoff

When `currentScreen === "colonies"`, the canvas keydown handler (in Game.tsx) checks screen first:

```typescript
const handleKeyDown = (e: KeyboardEvent) => {
  if (currentScreen === "colonies") return;  // DOM handles its own keys
  // ...existing handler logic
};
```

The overlay handles its own keyboard:
- Tab / Shift+Tab for focus traversal (default DOM behavior)
- Escape for back-to-cockpit
- Enter on focused button to activate

On mount, `ColoniesScreen` uses a `useEffect` to call `.focus()` on the back button (or the "Found Colony" button in empty state) so keyboard navigation starts at a sensible anchor. No complex focus trap for Phase 1 — the DOM content is a single screen, not nested dialogs.

---

## User Flow

### Canonical journey

```
1. Player at cockpit hub (canvas).
2. Arrow keys move cockpit cursor onto COLONIES hotspot.
3. Press Z/Enter → canvas sets currentScreen = "colonies".
4. React re-renders <Game/>. <ColoniesScreen/> mounts.
5. Canvas blanks its sub-screen region (cockpitRenderer.ts returns early).
6. EMPTY PATH: save.colonies.length === 0
   → <ColonyEmptyState/> renders: headline + "Found Colony at Ashfall" button
   → Click dispatches 2 events:
       a) Events.founded({ colonyId: "ashfall_primary", ... })
       b) Events.resourceChanged({ delta: { metal: 500 }, reason: "starter_grant" })
   → Reducer processes both; React re-renders into populated path.
7. POPULATED PATH: save.colonies.length > 0
   → <ColoniesScreen/> shows:
       - Header: name + tier + cycle counter
       - ResourcePanel: food/water/metal/power with deltas
       - Metrics: population + happiness
       - BuildingsList: operational + constructing
       - CommissionMenu: 4 cards with BUILD buttons
8. Player commissions a building:
   → Click [BUILD] on a card
   → Client-side affordability check (disable if insufficient)
   → Dispatch Events.buildingCommissioned({ ... })
   → Reducer validates; if valid, deducts cost + adds to buildings list
   → Card stays (multi-buildable); BuildingsList shows new constructing entry
9. Player clicks "Return to Cockpit" (or presses Escape).
   → Calls onExit() which calls returnToCockpit()
   → currentScreen flips to "cockpit-hub"
   → React unmounts <ColoniesScreen/>; canvas resumes
10. Player selects a campaign mission from STAR MAP, plays it to completion.
11. On nextLevel() success path, BEFORE returnToCockpit():
    → advanceWorldCycle(save) runs
    → Every colony ticks one cycle (production, consumption, upkeep, build progress, happiness, finalize)
    → missionsSinceStart increments
    → Completed constructions auto-emit colony/buildingCompleted events (see Cycle Processor changes below)
12. Player returns to cockpit, reopens COLONIES.
    → Header shows cycle N+1
    → Resources reflect new totals
    → Any buildings whose buildProgressCycles reached 0 now show operational
```

### Founding details

Empty state has exactly one action: **Found Colony at Ashfall**. Clicking it dispatches the founded event plus the starter grant:

```typescript
const handleFound = () => {
  onDispatch(Events.founded({
    colonyId: "ashfall_primary",
    name: "Ashfall Primary",
    planetId: "ashfall",
    foundingType: "outpost",
    regionNodeId: "ashfall_starter_region",  // placeholder until region map lands in Phase 4
    missionCount: save.missionsSinceStart,
    layoutSeed: 42,
  }));
  onDispatch(Events.resourceChanged({
    colonyId: "ashfall_primary",
    delta: { metal: 500 },
    reason: "starter_grant",
  }));
};
```

Two separate events instead of baking the grant into the founded event. Rationale: `founded` stays pure (no implicit side effects); the starter grant is a gameplay decision visible in the event log.

---

## Screen Contents

### Resource panel math

The panel displays **four tiles**: Food, Water, Metal, and Power. **Credits are not displayed in Phase 1** (no source for them yet — Marketplace income lands in Phase 7a). **Power is a derived grid value** (capacity/demand from Phase 0's `derivePowerGrid`), NOT a stockpile; it has its own display format (`capacity/demand` + surplus indicator) and is computed separately from the stockpile resources.

Per-cycle deltas for the three stockpile resources (Food, Water, Metal) are computed inline by a pure helper. Credits are omitted from both the display and the helper since they stay at 0 throughout Phase 1.

```typescript
// predictedDeltas.ts
import { RESOURCE_PRODUCTION, RESOURCE_UPKEEP } from "../shared/colonyCatalog";
import type { ColonyState } from "../shared/colonyTypes";

type StockpileDelta = { food: number; water: number; metal: number };

export function predictedDeltas(colony: ColonyState): StockpileDelta {
  const delta: StockpileDelta = { food: 0, water: 0, metal: 0 };

  // Production from operational buildings
  for (const b of colony.buildings) {
    if (b.status !== "operational") continue;
    const prod = RESOURCE_PRODUCTION[b.type];
    if (prod?.food) delta.food += prod.food;
    if (prod?.water) delta.water += prod.water;
    if (prod?.metal) delta.metal += prod.metal;
  }

  // Upkeep from operational buildings
  for (const b of colony.buildings) {
    if (b.status !== "operational") continue;
    const up = RESOURCE_UPKEEP[b.type];
    if (up?.food) delta.food -= up.food;
    if (up?.water) delta.water -= up.water;
    if (up?.metal) delta.metal -= up.metal;
  }

  // Population consumption
  delta.food -= colony.population.total;
  delta.water -= Math.floor(colony.population.total * 0.5);

  return delta;
}
```

**Note on credits:** intentionally excluded. No building in Phase 1 produces credits, and population-driven Marketplace income lands in Phase 7a. Adding it to the Phase 1 helper would be noise that always returns 0.

This mirrors the cycle processor's step math. Shared constants via `colonyCatalog.ts` keep them authoritative in one place.

### Power display

Power is a derived grid quantity (from Phase 0). `ColonyResourcePanel` renders it as `capacity / demand` (e.g., `10/5`) with a surplus indicator:

```typescript
const grid = derivePowerGrid(colony);
const powerDisplay = `${grid.capacity}/${grid.demand}`;
const surplusLabel = grid.surplus >= 0 ? `+${grid.surplus}` : `${grid.surplus}`;
const surplusColor = grid.surplus >= 0 ? "hud-green" : "hud-danger";
```

### Commission flow

Click `[BUILD]` on a commission card:

1. **Affordability gate** (client-side): disable button if `colony.resources.metal < cost.metal`. Show helper text like "Need 20 more metal".
2. **On click**: dispatch `Events.buildingCommissioned({ colonyId, buildingId: genBuildingId(colony, buildingType), buildingType, costDeducted: cost, cyclesToBuild })`.
3. **Reducer validates** (Phase 0 logic) and updates state.
4. **React re-renders** — commission card stays (multi-buildable), new entry appears in BuildingsList.

No confirmation dialog. No undo. If a player misclicks, they lose the metal. Tight loop, no ceremony.

### Deterministic building IDs

`genBuildingId(colony)` uses a counter-based pattern matching the threat-ID convention from Phase 0:

```typescript
export function genBuildingId(colony: ColonyState, buildingType: BuildingType): BuildingInstanceId {
  return `b-${colony.id}-${colony.buildings.length}-${buildingType}`;
}
```

Stable across a given state; no `Math.random`, no `Date.now`.

### Phase 1 building catalog (4 types)

| Building | Cost | Build time | Production | Upkeep |
|---|---|---|---|---|
| Solar Array | 80 metal | 1 cycle | +10 power capacity | — |
| Farm | 100 metal | 2 cycles | +15 food | 5 water, 2 power |
| Water Purifier | 120 metal | 2 cycles | +12 water | 3 power |
| Habitat Module | 100 metal | 1 cycle | — (houses 10 colonists when population sim lands Phase 5a) | 2 power |

Tier, slot, and zone gating all deferred. These 4 can be placed without constraint in Phase 1.

---

## Cycle Processor Changes

### New step: Building progress

Phase 0 cycle processor has 10 steps. Step 3 currently handles building upkeep. Phase 1 adds a new sub-step for construction progress. Proposed placement: **immediately before step 5 (happiness recompute)**, so:

```
1. Resource production
2. Population consumption
3. Building upkeep (resources + brownout)
4. Population change
4.5. Building construction progress  ← NEW in Phase 1
5. Happiness recompute
6. Threat progression (stub)
7. Earth shipment tick (stub)
8. Quest tick (stub)
9. Bounty decay (stub)
10. Finalize
```

**Rationale for placement (between 4 and 5):**
- After population change, so a newly-finished Habitat can house immediately-arriving colonists (future-proof; Phase 5a population arrivals)
- Before happiness recompute, so newly-operational Med Bay / Marketplace / Barracks bonuses can factor into this cycle's happiness (future-proof)

### Implementation

```typescript
// cycleProcessor.ts — new step
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

Pure function. No event dispatch (state mutation happens directly; cycle is one atomic transition). The `colony/buildingCompleted` reducer event still exists as a public API for manual completion during dev/testing, but the normal completion path goes through this step.

### Tests for the new step

Added to `cycleProcessor.test.ts`:
- Constructing building with `buildProgressCycles: 2` → after one `processCycle` → `buildProgressCycles: 1`
- Constructing building with `buildProgressCycles: 1` → after one cycle → `status: "operational"`, `buildProgressCycles: 0`
- Operational buildings pass through unchanged
- `buildProgressCycles` never goes negative
- Integration test extended: 5-cycle sim auto-completes the 3 commissioned buildings without manual `buildingCompleted` dispatches

---

## Mission Completion Wiring

### Location

`game/app/components/Game.tsx`, existing `nextLevel` callback. Per Phase 0 exploration, the callback spans roughly lines 305-425 and fires on mission-success paths for shooter levels, planet missions, and special missions.

### Change

Insert `advanceWorldCycle` call **immediately after `saveSave(newSave)` and before `returnToCockpit()`** in every mission-success branch:

```typescript
// BEFORE (existing pattern)
saveSave(newSave);
setSaveData(newSave);
returnToCockpit();

// AFTER (Phase 1 addition)
const cycledSave = advanceWorldCycle(newSave);
saveSave(cycledSave);
setSaveData(cycledSave);
returnToCockpit();
```

### Critical edge cases

- **Mission failed / player died** → do NOT advance cycle. `nextLevel` is the success path only; the failure branch does not call it. Verified by inspection.
- **Mission abandoned mid-way** → no cycle advance. Exit-to-cockpit path bypasses `nextLevel`.
- **Retry** → no cycle advance until the retry succeeds.
- **Multi-phase levels** → cycle advances ONCE per mission, not per phase. `phases.ts` must NOT call `advanceWorldCycle` between phase transitions. Only the final phase's completion (which routes through `nextLevel`) fires the cycle. This needs a code comment in `phases.ts` + a playtest check.

### `advanceWorldCycle` import

```typescript
// Game.tsx top of file
import { advanceWorldCycle } from "./colony";
```

Already exported from the Phase 0 public API.

---

## Canvas Cockpit Changes

Minimal. Four small edits, all in `engine/cockpit.ts` and `engine/cockpitRenderer.ts`.

### 1. Extend `CockpitScreen` union

```typescript
// cockpit.ts, line ~15
type CockpitScreen =
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

### 2. Add COLONIES hotspot

```typescript
// cockpit.ts, COCKPIT_HOTSPOTS array (~line 52)
{ id: "colonies", label: "COLONIES", x: <tbd>, y: <tbd>, w: 120, h: 40 },
```

Exact x/y coordinates determined during implementation by finding a free position in the existing hub layout. Target: a spot visually equivalent to other secondary stations (CODEX, BESTIARY).

### 3. Update navigation graph

`NAV_GRAPH` maps `[up, down, left, right]` to hotspot indices. Add entries so arrow keys can navigate to/from COLONIES from at least 2 neighboring hotspots. Exact adjacencies determined by the chosen coordinates.

### 4. Skip rendering in cockpitRenderer.ts

```typescript
// cockpitRenderer.ts, existing dispatch
if (state.screen === "colonies") {
  return;  // DOM overlay handles rendering
}
// ... existing sub-screen dispatch
```

The COLONIES hotspot label still needs to render in the **hub view** (so the player can see it), but the sub-screen for COLONIES is a no-op (canvas blanks, DOM takes over).

---

## Data Model (unchanged)

Phase 1 adds no new types. All state changes use existing Phase 0 types:

- `SaveData.colonies: ColonyState[]` — founded colonies
- `SaveData.missionsSinceStart: number` — cycle counter
- `ColonyState.resources` — food/water/metal/credits
- `ColonyState.buildings: ColonyBuilding[]` — operational + constructing
- `ColonyState.happiness` — displayed but not managed in Phase 1
- `ColonyState.population` — displayed but not managed in Phase 1

Phase 1's building-progress cycle step mutates `ColonyBuilding.status` and `buildProgressCycles` — both existing fields.

---

## Testing Strategy

### Pure logic tests (extend `yarn colony:test`)

1. **Cycle processor — building progress step**
   - Constructing → decrement → still constructing
   - Constructing at 1 → decrement → operational
   - Operational → unchanged
   - `buildProgressCycles` never negative

2. **Integration test (extends existing 5-cycle sim)**
   - Commission 3 buildings at cycle 0
   - Advance 5 cycles without manual completion events
   - Assert all 3 buildings reach operational
   - Assert resources reflect operational production

3. **`predictedDeltas` helper**
   - Empty colony → zero deltas
   - Solar + Farm operational → matches cycle math
   - Population + operational farm → food delta is production minus consumption
   - Constructing buildings don't contribute to deltas

### React smoke test

```typescript
// coloniesScreenSmoke.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { ColoniesScreen } from "../../app/components/colony/meta";
// ... build synthetic SaveData with zero colonies AND one colony, render both
test("ColoniesScreen renders empty state without throwing", () => { ... });
test("ColoniesScreen renders populated state without throwing", () => { ... });
```

Catches accidental undefined-access crashes or missing imports. Low coverage, high-value.

### Manual playtest checklist (in plan doc)

Cannot be automated without a DOM test framework. Checklist items:
- [ ] Open game → cockpit hub visible → navigate to COLONIES hotspot
- [ ] Press Z → overlay appears fullscreen → canvas hidden behind
- [ ] Empty state shows with "Found Colony at Ashfall" button
- [ ] Click button → populated screen with 500 metal, 0 food/water, 0 pop
- [ ] Commission Solar Array → metal drops to 420, building appears in list as "constructing, 1 cycle"
- [ ] Press Escape → overlay unmounts → cockpit visible again
- [ ] Launch any campaign mission, complete it
- [ ] Return to cockpit, reopen COLONIES
- [ ] Cycle counter shows 1, Solar Array is operational
- [ ] No console errors
- [ ] Existing campaign flow (mission, armory, codex) unchanged

### CI coverage

- `Game · TypeScript` — must pass (React types must be complete)
- `Game · Colony tests` — must pass (new tests added above)
- `Game · Next build` — must pass (static export must complete with new component)
- `Site · Next build` — unchanged

---

## Success Criteria

Phase 1 ships successfully when:

- [ ] `yarn colony:test` green (expect ~55 tests: 47 from Phase 0 + ~8 new)
- [ ] `yarn build` green
- [ ] `npx tsc --noEmit` green
- [ ] All 4 CI jobs green on the Phase 1 PR
- [ ] Full manual playtest (above) passes
- [ ] No regressions in existing campaign flow
- [ ] All state changes flow through `colonyReducer` (grep confirms no direct `saveData.colonies[i] = ...` assignments)
- [ ] A returning player (pre-Phase-1 save) loads cleanly — colonies field is empty array, no errors, no data loss

---

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| `advanceWorldCycle` double-ticks if wired in wrong place | Colony state diverges from expected | Plan will specify exact file line ranges and edge-case audit (mission fail / retry / abandon / multi-phase) |
| Canvas/DOM focus handoff causes stuck input | Player can't type or exits don't work | Single-line early-return in canvas keydown + focus-on-mount useEffect; manual playtest confirms |
| React mount thrashing on every save update | UI jank at high save frequency | Gate mount on `currentScreen` only, NOT on saveData equality; React's internal diffing handles the rest |
| `buildProgressCycles` step placement wrong in pipeline | Construction stalls or double-completes | Unit tests in `cycleProcessor.test.ts` cover the boundaries; plan will specify step order and rationale |
| CSS HUD tokens don't match the existing site aesthetic | DOM overlay looks "off" compared to canvas | Import tokens from `site/app/globals.css` conceptually (copy the values into `coloniesScreen.module.css`); playtest with A/B comparison |
| Serverside rendering breaks on `react-dom/server` import in tests | Node test harness crashes | Use `renderToString` from `react-dom/server.node` variant; confirmed supported in React 19 |

---

## Implementation Micro-Phases

Phase 1 breaks into 5 sequential implementation chunks. Each chunk is independently testable and leaves the branch in a deployable state.

### Micro-phase 1.1 — Catalog extraction + cycle progress step
- Create `colony/shared/colonyCatalog.ts` with `RESOURCE_PRODUCTION` and `RESOURCE_UPKEEP` exported
- Refactor `cycleProcessor.ts` to import from catalog
- Add new step 4.5 (building progress)
- Add unit tests for the new step
- Extend integration test to auto-complete buildings over 5 cycles
- **Acceptance:** `yarn colony:test` shows ~52 tests green

### Micro-phase 1.2 — Mission completion wiring
- Add `import { advanceWorldCycle } from "./colony"` to Game.tsx
- Insert `advanceWorldCycle` call into `nextLevel` success path (all branches)
- Add code comment in `phases.ts` noting that mid-phase transitions must NOT call this
- Manual playtest: commission a building pre-mission, complete a mission, verify cycle advanced
- **Acceptance:** cycle counter increments on mission success; no double-ticks on multi-phase

### Micro-phase 1.3 — Canvas cockpit hotspot
- Add `"colonies"` to `CockpitScreen` union in `cockpit.ts`
- Add COLONIES hotspot to `COCKPIT_HOTSPOTS` with placeholder x/y
- Update `NAV_GRAPH` to route to/from COLONIES
- Add early-return in `cockpitRenderer.ts` when `state.screen === "colonies"`
- Add early-return in canvas keydown handler when `currentScreen === "colonies"`
- **Acceptance:** pressing Z on COLONIES hotspot transitions to blank screen (no overlay yet); pressing Escape returns to hub

### Micro-phase 1.4 — DOM overlay scaffold + empty state + founding
- Create `colony/meta/` directory with `ColoniesScreen.tsx`, `ColonyEmptyState.tsx`, `coloniesScreen.module.css`
- Mount `<ColoniesScreen/>` in Game.tsx (sibling of canvas)
- Implement `handleColonyDispatch` and `onExit` callbacks
- Wire founding button + starter grant
- Add React smoke test
- **Acceptance:** opening COLONIES shows empty state; clicking Found Colony transitions to a placeholder "Ashfall Primary" header

### Micro-phase 1.5 — Populated screen + commission flow
- Implement `ColonyHeader`, `ColonyResourcePanel`, `ColonyMetrics`, `ColonyBuildingsList`, `ColonyCommissionMenu`
- Implement `predictedDeltas.ts` helper
- Implement `buildingIdGen.ts` helper
- Wire commission dispatch + affordability gates
- Full playtest checklist
- **Acceptance:** all success criteria met; full manual playtest passes

---

## Open Questions

None blocking. The following are explicitly deferred but worth noting for plan author:

- **React version for test harness**: `react-dom/server.node` exists in React 19 but exact import path may vary. Plan will specify. Fallback: use `@testing-library/react` + `jsdom` as a devDep if smoke test doesn't work with `renderToString` alone. Scope creep risk — avoid if possible.
- **HUD token source**: copy values from `site/app/globals.css` into `coloniesScreen.module.css` or link them. Phase 1 copies (no shared-token package). Phase 12 polish pass may consolidate.
- **Keyboard navigation inside overlay**: Phase 1 uses default browser Tab order. Arrow-key navigation (matching cockpit convention) is deferred to a polish pass unless playtesting demands it.

---

## Relation to Master Spec

This Phase 1 spec implements Milestone A of the master colony system spec (`2026-04-20-colony-system-design.md`). Specifically, it ships the player-facing portion of Phase 1 as specified in Section J of that document. Phase 2 (FPS descent) and later phases build on the DOM overlay pattern, cycle-trigger wiring, and catalog extraction established here.

Carry-overs from Phase 0 still pending:
- `EngineKind` casing mismatch with `GameState.currentMode` — Phase 4
- `RegionNode["type"]` missing `"mine"` and `"siege_defense"` — Phase 4
- `CollapseState` field — Phase 5b/8
- `BuildingType` tightening to a union — candidate for Phase 1 cleanup pass if trivial; otherwise Phase 2+

None of these block Phase 1.

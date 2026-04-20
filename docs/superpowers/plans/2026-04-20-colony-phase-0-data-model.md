# Colony System — Phase 0: Data Model & Reducer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the complete colony system data layer — types, reducer, cycle processor, assertions, save migration, test harness — with zero UI and zero gameplay changes. First observable behavior: `yarn colony:test` passes and `yarn build` stays green.

**Architecture:** Pure functions only. Single reducer is the only writer. Cycle processor is a 10-step pipeline of pure functions operating on synthetic states. All state mutations flow through typed events. Invariants asserted after every event in dev builds.

**Tech Stack:** TypeScript 5 (strict), Node's built-in `node:test` runner via `tsx` (new devDep). No behavior changes to existing engines or UI. Targets spec `docs/superpowers/specs/2026-04-20-colony-system-design.md`, specifically Sections B (data model), D (cycle rules), and Appendix A (stub types).

**Spec reference (canonical):** `docs/superpowers/specs/2026-04-20-colony-system-design.md`

---

## Scope Contract

**In scope for Phase 0:**
- Complete TypeScript type surface for colony system (from spec Section B + Appendix A)
- `colonyReducer` handling ~10 core event types (listed below)
- `cycleProcessor` with all 10 pipeline steps (steps 6-9 as STUBS)
- `colonyAssert` invariant helpers
- `SaveData` extension in `game/app/components/engine/types.ts`
- `save.ts` migration (defaults + field-by-field load)
- Test harness (`tsx` + `node:test`) wired via `yarn colony:test`
- `colony/index.ts` public API surface (stubs that compile; real exports wired here)

**Out of scope for Phase 0 (later phases):**
- Any React/DOM UI (Phase 1)
- Any raycaster/FPS rendering (Phase 2)
- POI/region logic (Phase 4)
- NPC schedules, dialog, shops (Phase 3 / 5a)
- Consequence/witness/bounty runtime (Phase 5b)
- Threats/attacks/disasters runtime (Phase 8)
- Actual Earth shipment arrivals (Phase 7b)

The cycle processor has slots for all of these but implements them as pure pass-through stubs in Phase 0 — just enough to run the pipeline end-to-end against synthetic states.

---

## File Structure

**Create:**

```
game/app/components/colony/
├── shared/
│   ├── colonyTypes.ts                  # all TS interfaces from Section B + Appendix A
│   ├── colonyEvents.ts                 # event union type + constructors
│   ├── colonyReducer.ts                # single-writer reducer, ~10 event handlers
│   ├── cycleProcessor.ts               # 10-step pipeline + advanceWorldCycle orchestrator
│   ├── factionLedger.ts                # stub: rank lookup from number, no real math yet
│   ├── powerGrid.ts                    # derive PowerGrid from ColonyState
│   ├── colonyAssert.ts                 # invariant helpers with dev-only enforcement
│   └── catchUp.ts                      # catchUpColony (migration-only path)
└── index.ts                            # public API — the only thing outside colony/ imports

game/tests/colony/
├── runner.ts                           # tsx-invoked test entry; imports all *.test.ts
├── reducer.test.ts                     # reducer event handler tests
├── cycleProcessor.test.ts              # pipeline step tests
├── saveRoundtrip.test.ts               # SaveData extension + migration tests
├── invariants.test.ts                  # colonyAssert tests
└── fixtures.ts                         # synthetic ColonyState / SaveData builders
```

**Modify:**

```
game/app/components/engine/types.ts     # extend SaveData with new fields (types from colonyTypes.ts)
game/app/components/engine/save.ts      # defaultSave + migrateSave get new fields
game/package.json                       # add tsx devDep + colony:test script
```

**Not touched in Phase 0:** any engine files, any React components, any rendering code.

---

## Task Breakdown

### Task 1: Add test harness tooling

**Files:**
- Modify: `game/package.json`

Goal: add `tsx` as a devDep (for running TS files directly) and wire `colony:test` script using Node's built-in `node:test` module via `tsx`.

- [ ] **Step 1: Install tsx as devDep**

Run:
```bash
cd game && yarn add --dev tsx
```

Expected: `game/package.json` gains `"tsx": "^4.x"` in `devDependencies`, `game/yarn.lock` updated.

- [ ] **Step 2: Add colony:test script**

Modify `game/package.json` `scripts` block:

```json
"scripts": {
  "dev": "next dev --turbopack",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "colony:test": "tsx --test tests/colony/*.test.ts"
}
```

- [ ] **Step 3: Verify script exists and fails loudly before test files exist**

Run: `cd game && yarn colony:test`
Expected: fails with "no test files matched" — the wiring is correct, tests just don't exist yet. This is the expected starting state.

- [ ] **Step 4: Commit**

```bash
git add game/package.json game/yarn.lock
git commit -m "chore(colony): add tsx devDep and colony:test script for Phase 0 test harness"
```

---

### Task 2: Scaffold colony type surface

**Files:**
- Create: `game/app/components/colony/shared/colonyTypes.ts`

Goal: one file with every type from spec Section B and Appendix A. No behavior, just types. Must compile under TypeScript strict.

- [ ] **Step 1: Create the types file**

Create `game/app/components/colony/shared/colonyTypes.ts` containing every type verbatim from spec Section B (ColonyState, ColonyBuilding, PopulationState, ColonyResources, PowerGrid, Npc, ScheduleEntry, PlanetState, RegionMap, RegionNode, ElevationMeta, EarthShipment, ShipmentContents, FactionStanding, Bounty, GameClock, CollapseState) and all stubs from Appendix A (District, Threat, DeathRecord, Mood, Objective, QuestReward, GateCondition, PriceModifier, StockTable, NpcSlotDef, NpcWorldPosition, EnemySlotDef, LootSlotDef, PropDef, InteractionDef, EventHookDef, ClearCond, SlotHint, CommissionResult, ShipmentResult, PromotionResult, TransitionDirective, DialogSession, PoiOutcome, EntityKillRecord, LootDrop, QuestEvent, Quest) and the type aliases (ColonyId, PlanetId, BuildingInstanceId, BuildingType, DistrictId, NpcId, DialogTreeId, QuestId, RegionNodeId, TemplateId, InteriorTemplateId, FactionId, BountyId, ShipmentId, CombatMaterialId, EnemyClassId, PlanetBiome, PoiType, EngineKind).

Copy the shapes from the spec's TypeScript code blocks directly. Where the spec shows `...existing fields unchanged` for `SaveData`, DO NOT include that here — SaveData itself is modified in `types.ts` during Task 12.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd game && yarn build`
Expected: build succeeds. No references to these types exist yet so nothing else should break.

- [ ] **Step 3: Add a sanity test**

Create `game/tests/colony/fixtures.ts`:

```typescript
import type { ColonyState, ColonyId, PlanetId, PopulationState, ColonyResources } from "../../app/components/colony/shared/colonyTypes";

export function makeTestColony(overrides: Partial<ColonyState> = {}): ColonyState {
  return {
    id: "test-colony-1" as ColonyId,
    name: "Test Colony",
    planetId: "ashfall" as PlanetId,
    foundingType: "outpost",
    tier: 1,
    regionNodeId: "test-region-node-1",
    population: {
      total: 0,
      capacity: 0,
      namedCount: 0,
      growthRate: 0,
      recentDeaths: [],
    },
    resources: { food: 0, water: 0, metal: 0, credits: 0 },
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
    ...overrides,
  };
}
```

- [ ] **Step 4: Commit**

```bash
git add game/app/components/colony/shared/colonyTypes.ts game/tests/colony/fixtures.ts
git commit -m "feat(colony): scaffold type surface for Phase 0 data model"
```

---

### Task 3: Invariant assertion helpers

**Files:**
- Create: `game/app/components/colony/shared/colonyAssert.ts`
- Create: `game/tests/colony/invariants.test.ts`

Goal: `colonyAssert` helpers that enforce invariants in dev and no-op in prod. Matches the project's existing `console.assert` convention (see `game/app/components/engine/groundPhysics.ts` and similar files for style).

- [ ] **Step 1: Write the failing test**

Create `game/tests/colony/invariants.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { assertColonyInvariant, assertSaveInvariant } from "../../app/components/colony/shared/colonyAssert";
import { makeTestColony } from "./fixtures";

test("assertColonyInvariant throws in dev when condition false", () => {
  const origEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    const colony = makeTestColony({ population: { total: 100, capacity: 10, namedCount: 0, growthRate: 0, recentDeaths: [] } });
    assert.throws(
      () => assertColonyInvariant(colony, c => c.population.total <= c.population.capacity + 50, "pop sane"),
      /pop sane/,
    );
  } finally {
    process.env.NODE_ENV = origEnv;
  }
});

test("assertColonyInvariant no-op in production when condition false", () => {
  const origEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const colony = makeTestColony({ population: { total: 100, capacity: 10, namedCount: 0, growthRate: 0, recentDeaths: [] } });
    assert.doesNotThrow(() =>
      assertColonyInvariant(colony, c => c.population.total <= c.population.capacity + 50, "pop sane"),
    );
  } finally {
    process.env.NODE_ENV = origEnv;
  }
});

test("assertColonyInvariant passes silently when condition true", () => {
  const colony = makeTestColony();
  assert.doesNotThrow(() => assertColonyInvariant(colony, c => c.population.total >= 0, "non-negative"));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd game && yarn colony:test`
Expected: FAIL with module-not-found for `colonyAssert`.

- [ ] **Step 3: Implement colonyAssert**

Create `game/app/components/colony/shared/colonyAssert.ts`:

```typescript
import type { ColonyState } from "./colonyTypes";
import type { SaveData } from "../../engine/types";

const HABITAT_OVERFLOW = 20;
const isDev = () => process.env.NODE_ENV !== "production";

export function assertColonyInvariant(
  colony: ColonyState,
  predicate: (c: ColonyState) => boolean,
  message: string,
): void {
  if (!isDev()) return;
  if (!predicate(colony)) {
    throw new Error(`[ColonyInvariant] ${message} (colony=${colony.id})`);
  }
}

export function assertSaveInvariant(
  save: SaveData,
  predicate: (s: SaveData) => boolean,
  message: string,
): void {
  if (!isDev()) return;
  if (!predicate(save)) {
    throw new Error(`[SaveInvariant] ${message}`);
  }
}

/** Run the canonical invariant set against a colony. Throws on first violation. */
export function runStandardInvariants(colony: ColonyState): void {
  assertColonyInvariant(
    colony,
    c => c.population.total >= 0,
    "Population must be non-negative",
  );
  assertColonyInvariant(
    colony,
    c => c.resources.food >= 0 && c.resources.water >= 0 && c.resources.metal >= 0 && c.resources.credits >= 0,
    "Resources must be non-negative",
  );
  assertColonyInvariant(
    colony,
    c => c.happiness >= 0 && c.happiness <= 100,
    "Happiness must be 0-100",
  );
  assertColonyInvariant(
    colony,
    c => c.population.total <= c.population.capacity + HABITAT_OVERFLOW,
    "Population exceeded sane maximum",
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd game && yarn colony:test`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add game/app/components/colony/shared/colonyAssert.ts game/tests/colony/invariants.test.ts
git commit -m "feat(colony): add invariant assertion helpers (dev-only enforcement)"
```

---

### Task 4: PowerGrid derivation

**Files:**
- Create: `game/app/components/colony/shared/powerGrid.ts`
- Create: `game/tests/colony/powerGrid.test.ts`

Goal: pure function `derivePowerGrid(colony): PowerGrid`. Input: `ColonyState`. Output: `{ capacity, demand, surplus }`. Per spec Section B.

- [ ] **Step 1: Write the failing test**

Create `game/tests/colony/powerGrid.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { derivePowerGrid } from "../../app/components/colony/shared/powerGrid";
import { makeTestColony } from "./fixtures";

test("empty colony has zero capacity, zero demand, zero surplus", () => {
  const colony = makeTestColony();
  const grid = derivePowerGrid(colony);
  assert.equal(grid.capacity, 0);
  assert.equal(grid.demand, 0);
  assert.equal(grid.surplus, 0);
});

test("solar array operational adds capacity", () => {
  const colony = makeTestColony({
    buildings: [
      { id: "b1", type: "solar_array", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const grid = derivePowerGrid(colony);
  assert.equal(grid.capacity, 10); // 1 Solar Array = 10 capacity per spec building catalog
  assert.equal(grid.demand, 0);
  assert.equal(grid.surplus, 10);
});

test("solar array under construction contributes zero capacity", () => {
  const colony = makeTestColony({
    buildings: [
      { id: "b1", type: "solar_array", tier: 1, status: "constructing", buildProgressCycles: 1, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const grid = derivePowerGrid(colony);
  assert.equal(grid.capacity, 0);
  assert.equal(grid.surplus, 0);
});

test("farm operational demands power", () => {
  const colony = makeTestColony({
    buildings: [
      { id: "b1", type: "solar_array", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
      { id: "b2", type: "farm", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const grid = derivePowerGrid(colony);
  assert.equal(grid.capacity, 10);
  assert.equal(grid.demand, 2); // farm upkeep per spec
  assert.equal(grid.surplus, 8);
});

test("negative surplus indicates brownout", () => {
  const colony = makeTestColony({
    buildings: [
      { id: "b1", type: "farm", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const grid = derivePowerGrid(colony);
  assert.equal(grid.capacity, 0);
  assert.equal(grid.demand, 2);
  assert.equal(grid.surplus, -2);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd game && yarn colony:test`
Expected: FAIL with module-not-found for `powerGrid`.

- [ ] **Step 3: Implement derivePowerGrid**

Create `game/app/components/colony/shared/powerGrid.ts`:

```typescript
import type { ColonyState, ColonyBuilding, PowerGrid, BuildingType } from "./colonyTypes";

// Spec Section E: Survival & Infrastructure building catalog
// These are the ONLY numeric values authoritative for Phase 0.
// Later phases may add richer building catalog with variants; this is the baseline.
const POWER_CAPACITY: Partial<Record<BuildingType, number>> = {
  solar_array: 10,
  // Other capacity producers added in later phases (generator, atmosphere_processor contributions)
};

const POWER_DEMAND: Partial<Record<BuildingType, number>> = {
  farm: 2,
  water_purifier: 3,
  mine: 3,
  refinery: 10,
  habitat_module: 2,
  med_bay: 5,
  marketplace: 2,
  cantina: 2,
  town_hall: 4,
  barracks: 5,
  turret_defense: 4,
  shield_generator: 8,
  radar_array: 3,
  comms_tower: 3,
  research_lab: 8,
  spaceport: 10,
  atmosphere_processor: 15,
};

export function derivePowerGrid(colony: ColonyState): PowerGrid {
  let capacity = 0;
  let demand = 0;
  for (const building of colony.buildings) {
    if (building.status !== "operational") continue;
    capacity += POWER_CAPACITY[building.type] ?? 0;
    demand += POWER_DEMAND[building.type] ?? 0;
  }
  return { capacity, demand, surplus: capacity - demand };
}

export function powerCapacityOf(buildingType: BuildingType): number {
  return POWER_CAPACITY[buildingType] ?? 0;
}

export function powerDemandOf(buildingType: BuildingType): number {
  return POWER_DEMAND[buildingType] ?? 0;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd game && yarn colony:test`
Expected: 5 new tests pass (plus prior 3 invariant tests still pass).

- [ ] **Step 5: Commit**

```bash
git add game/app/components/colony/shared/powerGrid.ts game/tests/colony/powerGrid.test.ts
git commit -m "feat(colony): implement derivePowerGrid from ColonyState"
```

---

### Task 5: Faction ledger stub

**Files:**
- Create: `game/app/components/colony/shared/factionLedger.ts`
- Create: `game/tests/colony/factionLedger.test.ts`

Goal: minimal stub so Phase 5a has a landing zone. Rank lookup from numeric standing, pure function. Real faction math deferred to Phase 5a.

- [ ] **Step 1: Write the failing test**

Create `game/tests/colony/factionLedger.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { rankFromStanding } from "../../app/components/colony/shared/factionLedger";

test("rankFromStanding returns hostile for -100..-80", () => {
  assert.equal(rankFromStanding(-100), "hostile");
  assert.equal(rankFromStanding(-80), "hostile");
  assert.equal(rankFromStanding(-81), "hostile");
});

test("rankFromStanding returns hated for -79..-40", () => {
  assert.equal(rankFromStanding(-79), "hated");
  assert.equal(rankFromStanding(-40), "hated");
});

test("rankFromStanding returns neutral for -39..39", () => {
  assert.equal(rankFromStanding(-39), "neutral");
  assert.equal(rankFromStanding(0), "neutral");
  assert.equal(rankFromStanding(39), "neutral");
});

test("rankFromStanding returns liked for 40..79", () => {
  assert.equal(rankFromStanding(40), "liked");
  assert.equal(rankFromStanding(79), "liked");
});

test("rankFromStanding returns allied for 80..100", () => {
  assert.equal(rankFromStanding(80), "allied");
  assert.equal(rankFromStanding(100), "allied");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd game && yarn colony:test`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement factionLedger**

Create `game/app/components/colony/shared/factionLedger.ts`:

```typescript
import type { FactionStanding } from "./colonyTypes";

export type Rank = FactionStanding["rank"];

export function rankFromStanding(standing: number): Rank {
  if (standing <= -80) return "hostile";
  if (standing <= -40) return "hated";
  if (standing < 40) return "neutral";
  if (standing < 80) return "liked";
  return "allied";
}

/**
 * Phase 0 stub. Real faction math (reputation deltas by severity,
 * cross-faction propagation, permissions set generation) lands in Phase 5a.
 */
export function applyStandingDelta(current: FactionStanding, delta: number): FactionStanding {
  const nextStanding = Math.max(-100, Math.min(100, current.standing + delta));
  return {
    ...current,
    standing: nextStanding,
    rank: rankFromStanding(nextStanding),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd game && yarn colony:test`
Expected: 5 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add game/app/components/colony/shared/factionLedger.ts game/tests/colony/factionLedger.test.ts
git commit -m "feat(colony): add faction ledger stub (rank lookup + delta application)"
```

---

### Task 6: Event types

**Files:**
- Create: `game/app/components/colony/shared/colonyEvents.ts`

Goal: discriminated union of all ~10 core event types. Pure types + constructor helpers. No handlers yet.

- [ ] **Step 1: Create colonyEvents.ts**

```typescript
import type {
  ColonyId, BuildingInstanceId, BuildingType, NpcId, FactionId, ShipmentId,
  RegionNodeId, BountyId, ColonyResources, ShipmentContents,
} from "./colonyTypes";

export type ColonyEvent =
  | { type: "colony/founded"; payload: {
      colonyId: ColonyId;
      name: string;
      planetId: string;
      foundingType: "outpost" | "colony" | "stronghold";
      regionNodeId: RegionNodeId;
      missionCount: number;
      layoutSeed: number;
    } }
  | { type: "colony/buildingCommissioned"; payload: {
      colonyId: ColonyId;
      buildingId: BuildingInstanceId;
      buildingType: BuildingType;
      costDeducted: Partial<ColonyResources>;
      cyclesToBuild: number;
    } }
  | { type: "colony/buildingCompleted"; payload: {
      colonyId: ColonyId;
      buildingId: BuildingInstanceId;
    } }
  | { type: "colony/cycleAdvanced"; payload: {
      colonyId: ColonyId;
      toCycle: number;
      resourceDelta: Partial<ColonyResources>;
      populationDelta: number;
      happinessAfter: number;
    } }
  | { type: "colony/resourceChanged"; payload: {
      colonyId: ColonyId;
      delta: Partial<ColonyResources>;
      reason: string;
    } }
  | { type: "colony/npcKilled"; payload: {
      colonyId: ColonyId;
      npcId: NpcId;
      killedBy: "player" | "hollow" | "natural";
    } }
  | { type: "colony/witnessed"; payload: {
      colonyId: ColonyId;
      witnessNpcId: NpcId;
      severity: "assault" | "murder" | "mass_killing";
      bountyId: BountyId | null;
    } }
  | { type: "colony/standingChanged"; payload: {
      factionId: FactionId;
      delta: number;
      newStanding: number;
    } }
  | { type: "colony/attackIncoming"; payload: {
      colonyId: ColonyId;
      threatKind: "raid_incoming" | "siege_ongoing" | "disaster_active" | "supply_disruption";
      cyclesUntilResolve: number;
    } }
  | { type: "colony/poiCleared"; payload: {
      colonyId: ColonyId;
      regionNodeId: RegionNodeId;
    } }
  | { type: "colony/shipmentOrdered"; payload: {
      colonyId: ColonyId;
      shipmentId: ShipmentId;
      contents: ShipmentContents;
      etaCycles: number;
      costPaid: number;
    } }
  | { type: "colony/shipmentArrived"; payload: {
      colonyId: ColonyId;
      shipmentId: ShipmentId;
      delivered: ShipmentContents;
    } };

// Constructor helpers (prefer these over raw object literals for type inference)
export const Events = {
  founded: (payload: Extract<ColonyEvent, { type: "colony/founded" }>["payload"]):
    Extract<ColonyEvent, { type: "colony/founded" }> => ({ type: "colony/founded", payload }),
  buildingCommissioned: (payload: Extract<ColonyEvent, { type: "colony/buildingCommissioned" }>["payload"]):
    Extract<ColonyEvent, { type: "colony/buildingCommissioned" }> => ({ type: "colony/buildingCommissioned", payload }),
  buildingCompleted: (payload: Extract<ColonyEvent, { type: "colony/buildingCompleted" }>["payload"]):
    Extract<ColonyEvent, { type: "colony/buildingCompleted" }> => ({ type: "colony/buildingCompleted", payload }),
  cycleAdvanced: (payload: Extract<ColonyEvent, { type: "colony/cycleAdvanced" }>["payload"]):
    Extract<ColonyEvent, { type: "colony/cycleAdvanced" }> => ({ type: "colony/cycleAdvanced", payload }),
  resourceChanged: (payload: Extract<ColonyEvent, { type: "colony/resourceChanged" }>["payload"]):
    Extract<ColonyEvent, { type: "colony/resourceChanged" }> => ({ type: "colony/resourceChanged", payload }),
  npcKilled: (payload: Extract<ColonyEvent, { type: "colony/npcKilled" }>["payload"]):
    Extract<ColonyEvent, { type: "colony/npcKilled" }> => ({ type: "colony/npcKilled", payload }),
  witnessed: (payload: Extract<ColonyEvent, { type: "colony/witnessed" }>["payload"]):
    Extract<ColonyEvent, { type: "colony/witnessed" }> => ({ type: "colony/witnessed", payload }),
  standingChanged: (payload: Extract<ColonyEvent, { type: "colony/standingChanged" }>["payload"]):
    Extract<ColonyEvent, { type: "colony/standingChanged" }> => ({ type: "colony/standingChanged", payload }),
  attackIncoming: (payload: Extract<ColonyEvent, { type: "colony/attackIncoming" }>["payload"]):
    Extract<ColonyEvent, { type: "colony/attackIncoming" }> => ({ type: "colony/attackIncoming", payload }),
  poiCleared: (payload: Extract<ColonyEvent, { type: "colony/poiCleared" }>["payload"]):
    Extract<ColonyEvent, { type: "colony/poiCleared" }> => ({ type: "colony/poiCleared", payload }),
  shipmentOrdered: (payload: Extract<ColonyEvent, { type: "colony/shipmentOrdered" }>["payload"]):
    Extract<ColonyEvent, { type: "colony/shipmentOrdered" }> => ({ type: "colony/shipmentOrdered", payload }),
  shipmentArrived: (payload: Extract<ColonyEvent, { type: "colony/shipmentArrived" }>["payload"]):
    Extract<ColonyEvent, { type: "colony/shipmentArrived" }> => ({ type: "colony/shipmentArrived", payload }),
};
```

- [ ] **Step 2: Verify build**

Run: `cd game && yarn build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add game/app/components/colony/shared/colonyEvents.ts
git commit -m "feat(colony): add ColonyEvent discriminated union and constructors"
```

---

### Task 7: SaveData extension + defaults

**Files:**
- Modify: `game/app/components/engine/types.ts`
- Modify: `game/app/components/engine/save.ts`

Goal: add colony-system top-level fields to `SaveData` per spec Section B, with sensible defaults. Migration step comes next task.

- [ ] **Step 1: Find SaveData in types.ts**

Run: `cd game && grep -n "interface SaveData" app/components/engine/types.ts`
Note the line number.

- [ ] **Step 2: Extend SaveData**

Add these fields to the existing `SaveData` interface in `game/app/components/engine/types.ts`:

```typescript
// Colony system fields (Phase 0 of colony system implementation)
colonies: ColonyState[];
planets: PlanetState[];
earthShipments: EarthShipment[];
factionStandings: FactionStanding[];
bounties: Bounty[];
missionsSinceStart: number;
gameClock: GameClock;
```

Add imports at top of `types.ts`:

```typescript
import type {
  ColonyState,
  PlanetState,
  EarthShipment,
  FactionStanding,
  Bounty,
  GameClock,
} from "../colony/shared/colonyTypes";
```

- [ ] **Step 3: Extend defaultSave in save.ts**

In `game/app/components/engine/save.ts`, add to `defaultSave`:

```typescript
const defaultSave: SaveData = {
  // ...existing fields unchanged...
  colonies: [],
  planets: [],
  earthShipments: [],
  factionStandings: [],
  bounties: [],
  missionsSinceStart: 0,
  gameClock: {
    day: 0,
    hour: 7,
    minute: 0,
    realtimeMsPerGameMinute: 1000,
    season: "standard",
  },
};
```

- [ ] **Step 4: Verify build**

Run: `cd game && yarn build`
Expected: build succeeds. New fields exist on SaveData type.

- [ ] **Step 5: Commit**

```bash
git add game/app/components/engine/types.ts game/app/components/engine/save.ts
git commit -m "feat(colony): extend SaveData with colony system fields and defaults"
```

---

### Task 8: Save migration

**Files:**
- Modify: `game/app/components/engine/save.ts`
- Create: `game/tests/colony/saveRoundtrip.test.ts`

Goal: `migrateSave` gracefully handles old saves lacking colony fields. Pre-existing saves must load successfully with empty colony state.

- [ ] **Step 1: Write the failing test**

Create `game/tests/colony/saveRoundtrip.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";

// Import the migrate function — it's not currently exported, so we need to either
// (a) export it for testing, or (b) invoke via loadSave after injecting localStorage stub.
// This task uses (a): add `export` keyword to `function migrateSave`.
// Import path assumes the function is exported from save.ts.
import { migrateSave } from "../../app/components/engine/save";

test("migrateSave on empty object produces default colony fields", () => {
  const migrated = migrateSave({});
  assert.deepEqual(migrated.colonies, []);
  assert.deepEqual(migrated.planets, []);
  assert.deepEqual(migrated.earthShipments, []);
  assert.deepEqual(migrated.factionStandings, []);
  assert.deepEqual(migrated.bounties, []);
  assert.equal(migrated.missionsSinceStart, 0);
  assert.equal(migrated.gameClock.hour, 7);
});

test("migrateSave preserves pre-existing non-colony fields", () => {
  const oldSave = {
    currentWorld: 3,
    credits: 500,
    xp: 1200,
  };
  const migrated = migrateSave(oldSave);
  assert.equal(migrated.currentWorld, 3);
  assert.equal(migrated.credits, 500);
  assert.equal(migrated.xp, 1200);
});

test("migrateSave preserves colony fields if present", () => {
  const oldSave = {
    missionsSinceStart: 12,
    colonies: [],
    gameClock: { day: 5, hour: 14, minute: 30, realtimeMsPerGameMinute: 1000, season: "storm" },
  };
  const migrated = migrateSave(oldSave);
  assert.equal(migrated.missionsSinceStart, 12);
  assert.equal(migrated.gameClock.day, 5);
  assert.equal(migrated.gameClock.season, "storm");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd game && yarn colony:test`
Expected: FAIL — either `migrateSave` not exported, or the colony fields aren't included in the migrated result.

- [ ] **Step 3: Export migrateSave and add field migration**

In `game/app/components/engine/save.ts`:

(a) Change `function migrateSave(...)` to `export function migrateSave(...)`.

(b) Extend the returned object with:

```typescript
colonies: (raw.colonies as SaveData["colonies"]) ?? [],
planets: (raw.planets as SaveData["planets"]) ?? [],
earthShipments: (raw.earthShipments as SaveData["earthShipments"]) ?? [],
factionStandings: (raw.factionStandings as SaveData["factionStandings"]) ?? [],
bounties: (raw.bounties as SaveData["bounties"]) ?? [],
missionsSinceStart: (raw.missionsSinceStart as number) ?? 0,
gameClock: (raw.gameClock as SaveData["gameClock"]) ?? {
  day: 0,
  hour: 7,
  minute: 0,
  realtimeMsPerGameMinute: 1000,
  season: "standard",
},
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd game && yarn colony:test`
Expected: 3 new tests pass.

- [ ] **Step 5: Verify full build**

Run: `cd game && yarn build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add game/app/components/engine/save.ts game/tests/colony/saveRoundtrip.test.ts
git commit -m "feat(colony): migrate old saves to include colony fields"
```

---

### Task 9: Reducer skeleton + `colony/founded`

**Files:**
- Create: `game/app/components/colony/shared/colonyReducer.ts`
- Create: `game/tests/colony/reducer.test.ts`

Goal: single-writer reducer with dispatch table. Implement the first event: `colony/founded`.

- [ ] **Step 1: Write the failing test**

Create `game/tests/colony/reducer.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { colonyReducer } from "../../app/components/colony/shared/colonyReducer";
import { Events } from "../../app/components/colony/shared/colonyEvents";
import type { SaveData } from "../../app/components/engine/types";

function makeEmptySave(): SaveData {
  return {
    currentWorld: 1,
    levels: {},
    credits: 0,
    totalStars: 0,
    totalScore: 0,
    xp: 0,
    upgrades: {} as SaveData["upgrades"],
    unlockedCodex: [],
    viewedCodex: [],
    viewedConversations: [],
    completedQuests: [],
    activeQuests: [],
    completedPlanets: [],
    unlockedSpecialMissions: [],
    completedSpecialMissions: [],
    storyItems: [],
    materials: [],
    consumableInventory: {},
    equippedConsumables: [],
    unlockedEnhancements: [],
    bestiary: {},
    equippedWeaponType: "kinetic",
    pilotLevel: 1,
    skillPoints: 0,
    allocatedSkills: [],
    colonies: [],
    planets: [],
    earthShipments: [],
    factionStandings: [],
    bounties: [],
    missionsSinceStart: 0,
    gameClock: { day: 0, hour: 7, minute: 0, realtimeMsPerGameMinute: 1000, season: "standard" },
  };
}

test("colony/founded adds a new colony to save data", () => {
  const save = makeEmptySave();
  const next = colonyReducer(save, Events.founded({
    colonyId: "c1",
    name: "Test Colony",
    planetId: "ashfall",
    foundingType: "outpost",
    regionNodeId: "rn1",
    missionCount: 0,
    layoutSeed: 42,
  }));
  assert.equal(next.colonies.length, 1);
  assert.equal(next.colonies[0].id, "c1");
  assert.equal(next.colonies[0].name, "Test Colony");
  assert.equal(next.colonies[0].foundingType, "outpost");
  assert.equal(next.colonies[0].tier, 1);
  assert.equal(next.colonies[0].happiness, 50);
  assert.equal(next.colonies[0].lastCycleProcessed, 0);
});

test("colony/founded does not mutate input save", () => {
  const save = makeEmptySave();
  const before = save.colonies;
  colonyReducer(save, Events.founded({
    colonyId: "c1",
    name: "Test",
    planetId: "ashfall",
    foundingType: "outpost",
    regionNodeId: "rn1",
    missionCount: 0,
    layoutSeed: 42,
  }));
  assert.equal(save.colonies, before);
  assert.equal(save.colonies.length, 0);
});

test("colony/founded with duplicate colonyId throws", () => {
  let save = makeEmptySave();
  save = colonyReducer(save, Events.founded({
    colonyId: "c1", name: "First", planetId: "ashfall", foundingType: "outpost",
    regionNodeId: "rn1", missionCount: 0, layoutSeed: 42,
  }));
  assert.throws(
    () => colonyReducer(save, Events.founded({
      colonyId: "c1", name: "Dup", planetId: "ashfall", foundingType: "outpost",
      regionNodeId: "rn2", missionCount: 0, layoutSeed: 99,
    })),
    /already exists/,
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd game && yarn colony:test`
Expected: FAIL with module-not-found for `colonyReducer`.

- [ ] **Step 3: Implement reducer skeleton + founded handler**

Create `game/app/components/colony/shared/colonyReducer.ts`:

```typescript
import type { SaveData } from "../../engine/types";
import type { ColonyEvent } from "./colonyEvents";
import type { ColonyState } from "./colonyTypes";

export function colonyReducer(state: SaveData, event: ColonyEvent): SaveData {
  switch (event.type) {
    case "colony/founded":
      return handleFounded(state, event.payload);
    default:
      // Exhaustiveness check: compilation error if a new event type is added without a handler.
      // Phase 0 implements a subset; later tasks add the rest.
      return state;
  }
}

function handleFounded(state: SaveData, p: Extract<ColonyEvent, { type: "colony/founded" }>["payload"]): SaveData {
  if (state.colonies.some(c => c.id === p.colonyId)) {
    throw new Error(`[colonyReducer] colony/founded: colony ${p.colonyId} already exists`);
  }
  const newColony: ColonyState = {
    id: p.colonyId,
    name: p.name,
    planetId: p.planetId,
    foundingType: p.foundingType,
    tier: 1,
    regionNodeId: p.regionNodeId,
    population: { total: 0, capacity: 0, namedCount: 0, growthRate: 0, recentDeaths: [] },
    resources: { food: 0, water: 0, metal: 0, credits: 0 },
    buildings: [],
    districts: [],
    namedNpcs: [],
    backgroundColonistDensity: 0,
    happiness: 50,
    selfSufficient: false,
    lastCycleProcessed: p.missionCount,
    lastGameClock: { day: 0, hour: 7, minute: 0, realtimeMsPerGameMinute: 1000, season: "standard" },
    activeThreats: [],
    activeQuestlines: [],
    discoveredPoiIds: [],
    layoutSeed: p.layoutSeed,
    founded: { missionCount: p.missionCount, gameClockTick: 0 },
  };
  return { ...state, colonies: [...state.colonies, newColony] };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd game && yarn colony:test`
Expected: 3 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add game/app/components/colony/shared/colonyReducer.ts game/tests/colony/reducer.test.ts
git commit -m "feat(colony): reducer skeleton + colony/founded handler"
```

---

### Task 10: Reducer — building lifecycle events

**Files:**
- Modify: `game/app/components/colony/shared/colonyReducer.ts`
- Modify: `game/tests/colony/reducer.test.ts`

Goal: handle `colony/buildingCommissioned` and `colony/buildingCompleted`.

- [ ] **Step 1: Write failing tests**

Append to `game/tests/colony/reducer.test.ts`:

```typescript
test("colony/buildingCommissioned adds building with constructing status", () => {
  let save = makeEmptySave();
  save = colonyReducer(save, Events.founded({
    colonyId: "c1", name: "Test", planetId: "ashfall", foundingType: "outpost",
    regionNodeId: "rn1", missionCount: 0, layoutSeed: 42,
  }));
  save.colonies[0] = { ...save.colonies[0], resources: { food: 0, water: 0, metal: 500, credits: 0 } };
  save = colonyReducer(save, Events.buildingCommissioned({
    colonyId: "c1",
    buildingId: "b1",
    buildingType: "solar_array",
    costDeducted: { metal: 80 },
    cyclesToBuild: 1,
  }));
  const colony = save.colonies[0];
  assert.equal(colony.buildings.length, 1);
  assert.equal(colony.buildings[0].id, "b1");
  assert.equal(colony.buildings[0].status, "constructing");
  assert.equal(colony.buildings[0].buildProgressCycles, 1);
  assert.equal(colony.resources.metal, 420); // 500 - 80
});

test("colony/buildingCompleted flips status to operational", () => {
  let save = makeEmptySave();
  save = colonyReducer(save, Events.founded({
    colonyId: "c1", name: "Test", planetId: "ashfall", foundingType: "outpost",
    regionNodeId: "rn1", missionCount: 0, layoutSeed: 42,
  }));
  save.colonies[0] = { ...save.colonies[0], resources: { food: 0, water: 0, metal: 500, credits: 0 } };
  save = colonyReducer(save, Events.buildingCommissioned({
    colonyId: "c1",
    buildingId: "b1",
    buildingType: "solar_array",
    costDeducted: { metal: 80 },
    cyclesToBuild: 1,
  }));
  save = colonyReducer(save, Events.buildingCompleted({ colonyId: "c1", buildingId: "b1" }));
  const b = save.colonies[0].buildings[0];
  assert.equal(b.status, "operational");
  assert.equal(b.buildProgressCycles, 0);
});

test("colony/buildingCommissioned throws on unknown colonyId", () => {
  const save = makeEmptySave();
  assert.throws(
    () => colonyReducer(save, Events.buildingCommissioned({
      colonyId: "nonexistent", buildingId: "b1", buildingType: "solar_array",
      costDeducted: { metal: 80 }, cyclesToBuild: 1,
    })),
    /not found/,
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd game && yarn colony:test`
Expected: FAIL on new tests (events not handled).

- [ ] **Step 3: Implement handlers**

In `game/app/components/colony/shared/colonyReducer.ts`, add to the switch:

```typescript
    case "colony/buildingCommissioned":
      return handleBuildingCommissioned(state, event.payload);
    case "colony/buildingCompleted":
      return handleBuildingCompleted(state, event.payload);
```

And below:

```typescript
function handleBuildingCommissioned(
  state: SaveData,
  p: Extract<ColonyEvent, { type: "colony/buildingCommissioned" }>["payload"]
): SaveData {
  const idx = state.colonies.findIndex(c => c.id === p.colonyId);
  if (idx < 0) throw new Error(`[colonyReducer] buildingCommissioned: colony ${p.colonyId} not found`);
  const colony = state.colonies[idx];

  const nextResources = { ...colony.resources };
  for (const [k, v] of Object.entries(p.costDeducted)) {
    if (v === undefined) continue;
    nextResources[k as keyof typeof nextResources] -= v;
  }

  const nextColony: ColonyState = {
    ...colony,
    resources: nextResources,
    buildings: [
      ...colony.buildings,
      {
        id: p.buildingId,
        type: p.buildingType,
        tier: 1,
        status: "constructing",
        buildProgressCycles: p.cyclesToBuild,
        hp: 100,
        maxHp: 100,
        interiorTemplateId: null,
        assignedNpcIds: [],
        districtId: null,
      },
    ],
  };
  const nextColonies = [...state.colonies];
  nextColonies[idx] = nextColony;
  return { ...state, colonies: nextColonies };
}

function handleBuildingCompleted(
  state: SaveData,
  p: Extract<ColonyEvent, { type: "colony/buildingCompleted" }>["payload"]
): SaveData {
  const idx = state.colonies.findIndex(c => c.id === p.colonyId);
  if (idx < 0) throw new Error(`[colonyReducer] buildingCompleted: colony ${p.colonyId} not found`);
  const colony = state.colonies[idx];
  const bIdx = colony.buildings.findIndex(b => b.id === p.buildingId);
  if (bIdx < 0) throw new Error(`[colonyReducer] buildingCompleted: building ${p.buildingId} not found`);
  const nextBuildings = [...colony.buildings];
  nextBuildings[bIdx] = { ...nextBuildings[bIdx], status: "operational", buildProgressCycles: 0 };
  const nextColonies = [...state.colonies];
  nextColonies[idx] = { ...colony, buildings: nextBuildings };
  return { ...state, colonies: nextColonies };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd game && yarn colony:test`
Expected: all reducer tests pass.

- [ ] **Step 5: Commit**

```bash
git add game/app/components/colony/shared/colonyReducer.ts game/tests/colony/reducer.test.ts
git commit -m "feat(colony): reducer handles buildingCommissioned + buildingCompleted"
```

---

### Task 11: Reducer — remaining core events

**Files:**
- Modify: `game/app/components/colony/shared/colonyReducer.ts`
- Modify: `game/tests/colony/reducer.test.ts`

Goal: remaining events: `cycleAdvanced`, `resourceChanged`, `npcKilled`, `witnessed`, `standingChanged`, `attackIncoming`, `poiCleared`, `shipmentOrdered`, `shipmentArrived`. All as minimal but correct handlers — real semantics of the consequential events (witnessed, attackIncoming) arrive in later phases; for Phase 0 they just update state consistently.

- [ ] **Step 1: Write the failing tests**

Append to `game/tests/colony/reducer.test.ts`:

```typescript
test("colony/cycleAdvanced updates lastCycleProcessed and applies deltas", () => {
  let save = makeEmptySave();
  save = colonyReducer(save, Events.founded({
    colonyId: "c1", name: "Test", planetId: "ashfall", foundingType: "outpost",
    regionNodeId: "rn1", missionCount: 0, layoutSeed: 42,
  }));
  save.colonies[0] = {
    ...save.colonies[0],
    resources: { food: 100, water: 100, metal: 100, credits: 0 },
    population: { total: 10, capacity: 10, namedCount: 0, growthRate: 0, recentDeaths: [] },
  };
  save = colonyReducer(save, Events.cycleAdvanced({
    colonyId: "c1",
    toCycle: 1,
    resourceDelta: { food: -10, metal: 10 },
    populationDelta: 2,
    happinessAfter: 65,
  }));
  const c = save.colonies[0];
  assert.equal(c.lastCycleProcessed, 1);
  assert.equal(c.resources.food, 90);
  assert.equal(c.resources.metal, 110);
  assert.equal(c.population.total, 12);
  assert.equal(c.happiness, 65);
});

test("colony/resourceChanged applies delta without touching cycle", () => {
  let save = makeEmptySave();
  save = colonyReducer(save, Events.founded({
    colonyId: "c1", name: "T", planetId: "ashfall", foundingType: "outpost",
    regionNodeId: "rn1", missionCount: 0, layoutSeed: 42,
  }));
  save.colonies[0] = { ...save.colonies[0], resources: { food: 50, water: 0, metal: 0, credits: 0 } };
  save = colonyReducer(save, Events.resourceChanged({ colonyId: "c1", delta: { food: 20 }, reason: "mission_reward" }));
  assert.equal(save.colonies[0].resources.food, 70);
  assert.equal(save.colonies[0].lastCycleProcessed, 0);
});

test("colony/standingChanged updates factionStandings", () => {
  let save = makeEmptySave();
  save.factionStandings = [{ factionId: "ashfall_camp", standing: 10, rank: "neutral", permissions: [] }];
  save = colonyReducer(save, Events.standingChanged({
    factionId: "ashfall_camp", delta: 35, newStanding: 45,
  }));
  const fs = save.factionStandings.find(f => f.factionId === "ashfall_camp")!;
  assert.equal(fs.standing, 45);
  assert.equal(fs.rank, "liked");
});

test("colony/standingChanged creates faction entry if absent", () => {
  let save = makeEmptySave();
  save = colonyReducer(save, Events.standingChanged({
    factionId: "new_faction", delta: 50, newStanding: 50,
  }));
  const fs = save.factionStandings.find(f => f.factionId === "new_faction")!;
  assert.ok(fs);
  assert.equal(fs.standing, 50);
  assert.equal(fs.rank, "liked");
});

test("colony/poiCleared marks node cleared on matching planet", () => {
  let save = makeEmptySave();
  save = colonyReducer(save, Events.founded({
    colonyId: "c1", name: "T", planetId: "ashfall", foundingType: "outpost",
    regionNodeId: "rn1", missionCount: 0, layoutSeed: 42,
  }));
  save.planets = [{
    id: "ashfall",
    regionMap: {
      nodes: [{
        id: "rn_ruins", type: "ruins", discovered: true, authored: false,
        templateId: "t1", seed: 1, cleared: false, respawnMissions: null,
        coords: { x: 0, y: 0 }, elevationMetadata: null,
      }],
      edges: [],
    },
    biome: "desert",
    campaignUnlocked: true,
  }];
  save = colonyReducer(save, Events.poiCleared({ colonyId: "c1", regionNodeId: "rn_ruins" }));
  assert.equal(save.planets[0].regionMap.nodes[0].cleared, true);
});

test("colony/attackIncoming appends a threat to the colony", () => {
  let save = makeEmptySave();
  save = colonyReducer(save, Events.founded({
    colonyId: "c1", name: "T", planetId: "ashfall", foundingType: "outpost",
    regionNodeId: "rn1", missionCount: 0, layoutSeed: 42,
  }));
  save = colonyReducer(save, Events.attackIncoming({
    colonyId: "c1",
    threatKind: "raid_incoming",
    cyclesUntilResolve: 3,
  }));
  assert.equal(save.colonies[0].activeThreats.length, 1);
  assert.equal(save.colonies[0].activeThreats[0].kind, "raid_incoming");
  assert.equal(save.colonies[0].activeThreats[0].cyclesUntilResolve, 3);
});

test("colony/shipmentOrdered adds shipment to earthShipments queue", () => {
  let save = makeEmptySave();
  save = colonyReducer(save, Events.founded({
    colonyId: "c1", name: "T", planetId: "ashfall", foundingType: "outpost",
    regionNodeId: "rn1", missionCount: 0, layoutSeed: 42,
  }));
  save = colonyReducer(save, Events.shipmentOrdered({
    colonyId: "c1",
    shipmentId: "ship-1",
    contents: { food: 100, metal: 50 },
    etaCycles: 2,
    costPaid: 300,
  }));
  assert.equal(save.earthShipments.length, 1);
  assert.equal(save.earthShipments[0].id, "ship-1");
  assert.equal(save.earthShipments[0].eta.missionCount, 2); // missionsSinceStart (0) + etaCycles (2)
  assert.equal(save.earthShipments[0].contents.food, 100);
  assert.equal(save.earthShipments[0].destinationColonyId, "c1");
});

test("colony/shipmentArrived deposits contents and removes shipment from queue", () => {
  let save = makeEmptySave();
  save = colonyReducer(save, Events.founded({
    colonyId: "c1", name: "T", planetId: "ashfall", foundingType: "outpost",
    regionNodeId: "rn1", missionCount: 0, layoutSeed: 42,
  }));
  save.colonies[0] = { ...save.colonies[0], resources: { food: 10, water: 0, metal: 5, credits: 0 } };
  save = colonyReducer(save, Events.shipmentOrdered({
    colonyId: "c1",
    shipmentId: "ship-1",
    contents: { food: 100, metal: 50 },
    etaCycles: 0,
    costPaid: 300,
  }));
  save = colonyReducer(save, Events.shipmentArrived({
    colonyId: "c1",
    shipmentId: "ship-1",
    delivered: { food: 100, metal: 50 },
  }));
  assert.equal(save.colonies[0].resources.food, 110);  // 10 + 100
  assert.equal(save.colonies[0].resources.metal, 55);  // 5 + 50
  assert.equal(save.earthShipments.length, 0);          // queue drained
});

test("colony/shipmentArrived with unknown shipmentId is a no-op", () => {
  let save = makeEmptySave();
  save = colonyReducer(save, Events.founded({
    colonyId: "c1", name: "T", planetId: "ashfall", foundingType: "outpost",
    regionNodeId: "rn1", missionCount: 0, layoutSeed: 42,
  }));
  const before = save.colonies[0].resources.food;
  save = colonyReducer(save, Events.shipmentArrived({
    colonyId: "c1",
    shipmentId: "nonexistent",
    delivered: { food: 999 },
  }));
  assert.equal(save.colonies[0].resources.food, before);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd game && yarn colony:test`
Expected: FAIL on new tests.

- [ ] **Step 3: Implement handlers**

Append to the switch in `colonyReducer.ts`:

```typescript
    case "colony/cycleAdvanced":
      return handleCycleAdvanced(state, event.payload);
    case "colony/resourceChanged":
      return handleResourceChanged(state, event.payload);
    case "colony/npcKilled":
      return handleNpcKilled(state, event.payload);
    case "colony/witnessed":
      return handleWitnessed(state, event.payload);
    case "colony/standingChanged":
      return handleStandingChanged(state, event.payload);
    case "colony/attackIncoming":
      return handleAttackIncoming(state, event.payload);
    case "colony/poiCleared":
      return handlePoiCleared(state, event.payload);
    case "colony/shipmentOrdered":
      return handleShipmentOrdered(state, event.payload);
    case "colony/shipmentArrived":
      return handleShipmentArrived(state, event.payload);
```

Add handlers (append below the two existing ones):

```typescript
function handleCycleAdvanced(state: SaveData, p: Extract<ColonyEvent, { type: "colony/cycleAdvanced" }>["payload"]): SaveData {
  const idx = state.colonies.findIndex(c => c.id === p.colonyId);
  if (idx < 0) throw new Error(`[colonyReducer] cycleAdvanced: colony ${p.colonyId} not found`);
  const colony = state.colonies[idx];
  const nextResources = { ...colony.resources };
  for (const [k, v] of Object.entries(p.resourceDelta)) {
    if (v === undefined) continue;
    nextResources[k as keyof typeof nextResources] += v;
  }
  const nextColonies = [...state.colonies];
  nextColonies[idx] = {
    ...colony,
    lastCycleProcessed: p.toCycle,
    resources: nextResources,
    population: { ...colony.population, total: Math.max(0, colony.population.total + p.populationDelta) },
    happiness: Math.max(0, Math.min(100, p.happinessAfter)),
  };
  return { ...state, colonies: nextColonies };
}

function handleResourceChanged(state: SaveData, p: Extract<ColonyEvent, { type: "colony/resourceChanged" }>["payload"]): SaveData {
  const idx = state.colonies.findIndex(c => c.id === p.colonyId);
  if (idx < 0) throw new Error(`[colonyReducer] resourceChanged: colony ${p.colonyId} not found`);
  const colony = state.colonies[idx];
  const nextResources = { ...colony.resources };
  for (const [k, v] of Object.entries(p.delta)) {
    if (v === undefined) continue;
    nextResources[k as keyof typeof nextResources] += v;
  }
  const nextColonies = [...state.colonies];
  nextColonies[idx] = { ...colony, resources: nextResources };
  return { ...state, colonies: nextColonies };
}

function handleNpcKilled(state: SaveData, p: Extract<ColonyEvent, { type: "colony/npcKilled" }>["payload"]): SaveData {
  // Phase 0: no NPC registry exists yet. Record the death intent;
  // full NPC lifecycle lands in Phase 5a. For now: no-op state change.
  // Later phase will: flip npc.alive = false, record killedBy, decrement namedCount.
  void state; void p;
  return state;
}

function handleWitnessed(state: SaveData, p: Extract<ColonyEvent, { type: "colony/witnessed" }>["payload"]): SaveData {
  // Phase 0 stub — full bounty issuance in Phase 5b.
  void state; void p;
  return state;
}

function handleStandingChanged(state: SaveData, p: Extract<ColonyEvent, { type: "colony/standingChanged" }>["payload"]): SaveData {
  const idx = state.factionStandings.findIndex(f => f.factionId === p.factionId);
  const rank = rankFromStanding(p.newStanding);
  if (idx < 0) {
    return {
      ...state,
      factionStandings: [...state.factionStandings, { factionId: p.factionId, standing: p.newStanding, rank, permissions: [] }],
    };
  }
  const next = [...state.factionStandings];
  next[idx] = { ...next[idx], standing: p.newStanding, rank };
  return { ...state, factionStandings: next };
}

function handleAttackIncoming(state: SaveData, p: Extract<ColonyEvent, { type: "colony/attackIncoming" }>["payload"]): SaveData {
  const idx = state.colonies.findIndex(c => c.id === p.colonyId);
  if (idx < 0) throw new Error(`[colonyReducer] attackIncoming: colony ${p.colonyId} not found`);
  const colony = state.colonies[idx];
  const next = [...state.colonies];
  next[idx] = {
    ...colony,
    activeThreats: [...colony.activeThreats, {
      id: `threat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: p.threatKind,
      cyclesUntilResolve: p.cyclesUntilResolve,
      severity: "minor",
      targetBuildingId: null,
      payload: {},
    }],
  };
  return { ...state, colonies: next };
}

function handlePoiCleared(state: SaveData, p: Extract<ColonyEvent, { type: "colony/poiCleared" }>["payload"]): SaveData {
  const colony = state.colonies.find(c => c.id === p.colonyId);
  if (!colony) return state;
  const planet = state.planets.find(pl => pl.id === colony.planetId);
  if (!planet) return state;
  const nodeIdx = planet.regionMap.nodes.findIndex(n => n.id === p.regionNodeId);
  if (nodeIdx < 0) return state;
  const nextNodes = [...planet.regionMap.nodes];
  nextNodes[nodeIdx] = { ...nextNodes[nodeIdx], cleared: true };
  const nextPlanets = state.planets.map(pl =>
    pl.id === colony.planetId
      ? { ...pl, regionMap: { ...pl.regionMap, nodes: nextNodes } }
      : pl
  );
  return { ...state, planets: nextPlanets };
}

function handleShipmentOrdered(state: SaveData, p: Extract<ColonyEvent, { type: "colony/shipmentOrdered" }>["payload"]): SaveData {
  return {
    ...state,
    earthShipments: [...state.earthShipments, {
      id: p.shipmentId,
      contents: p.contents,
      eta: { missionCount: state.missionsSinceStart + p.etaCycles },
      interceptionChance: 0,
      interceptionTriggered: false,
      destinationColonyId: p.colonyId,
      costPaid: p.costPaid,
    }],
  };
}

function handleShipmentArrived(state: SaveData, p: Extract<ColonyEvent, { type: "colony/shipmentArrived" }>["payload"]): SaveData {
  const shipmentIdx = state.earthShipments.findIndex(s => s.id === p.shipmentId);
  if (shipmentIdx < 0) return state;
  const colonyIdx = state.colonies.findIndex(c => c.id === p.colonyId);
  if (colonyIdx < 0) return state;

  const colony = state.colonies[colonyIdx];
  const nextResources = { ...colony.resources };
  if (p.delivered.food !== undefined) nextResources.food += p.delivered.food;
  if (p.delivered.water !== undefined) nextResources.water += p.delivered.water;
  if (p.delivered.metal !== undefined) nextResources.metal += p.delivered.metal;
  if (p.delivered.credits !== undefined) nextResources.credits += p.delivered.credits;

  const nextColonies = [...state.colonies];
  nextColonies[colonyIdx] = { ...colony, resources: nextResources };

  const nextShipments = state.earthShipments.filter(s => s.id !== p.shipmentId);
  return { ...state, colonies: nextColonies, earthShipments: nextShipments };
}
```

Also add the import at the top:

```typescript
import { rankFromStanding } from "./factionLedger";
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd game && yarn colony:test`
Expected: all reducer tests pass.

- [ ] **Step 5: Verify build**

Run: `cd game && yarn build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add game/app/components/colony/shared/colonyReducer.ts game/tests/colony/reducer.test.ts
git commit -m "feat(colony): reducer handles all 12 core Phase 0 event types"
```

---

### Task 12: Cycle processor — steps 1-5 (resources, consumption, upkeep, population, happiness)

**Files:**
- Create: `game/app/components/colony/shared/cycleProcessor.ts`
- Create: `game/tests/colony/cycleProcessor.test.ts`

Goal: pure function `processCycle(colony, toCycle) → colony'`. Runs the first 5 pipeline steps per spec Section D. Steps 6-9 land in the next task as stubs.

- [ ] **Step 1: Write the failing test**

Create `game/tests/colony/cycleProcessor.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { processCycle } from "../../app/components/colony/shared/cycleProcessor";
import { makeTestColony } from "./fixtures";

test("processCycle step 1: operational farm produces food and water purifier produces water (net of farm upkeep)", () => {
  const before = makeTestColony({
    buildings: [
      { id: "f1", type: "farm", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
      { id: "s1", type: "solar_array", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
      { id: "w1", type: "water_purifier", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
    resources: { food: 0, water: 0, metal: 0, credits: 0 },
  });
  const after = processCycle(before, 1);
  // Step 1 production: farm +15 food, water_purifier +12 water.
  // Step 2 consumption: pop=0 → 0 food consumed, 0 water consumed.
  // Step 3 upkeep: farm needs 5 water upkeep (from spec catalog).
  // Net: food = 15, water = 12 - 5 = 7.
  assert.equal(after.resources.food, 15);
  assert.equal(after.resources.water, 7);
  assert.equal(after.lastCycleProcessed, 1);
});

test("processCycle step 2: population consumes food and water", () => {
  const before = makeTestColony({
    resources: { food: 100, water: 100, metal: 0, credits: 0 },
    population: { total: 10, capacity: 10, namedCount: 0, growthRate: 0, recentDeaths: [] },
  });
  const after = processCycle(before, 1);
  assert.equal(after.resources.food, 90);   // 100 - 10 population * 1
  assert.equal(after.resources.water, 95);  // 100 - 10 population * 0.5
});

test("processCycle step 5: happiness recomputed based on state", () => {
  const before = makeTestColony({
    resources: { food: 100, water: 100, metal: 0, credits: 0 },
    population: { total: 10, capacity: 10, namedCount: 0, growthRate: 0, recentDeaths: [] },
    happiness: 50,
    buildings: [
      { id: "f1", type: "farm", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
      { id: "s1", type: "solar_array", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
      { id: "w1", type: "water_purifier", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const after = processCycle(before, 1);
  // Fed + watered + powered → happiness should be above baseline
  assert.ok(after.happiness >= 50);
  assert.ok(after.happiness <= 100);
});

test("processCycle step 4: population grows when happiness > 60", () => {
  const before = makeTestColony({
    resources: { food: 100, water: 100, metal: 0, credits: 0 },
    population: { total: 10, capacity: 20, namedCount: 0, growthRate: 0, recentDeaths: [] },
    happiness: 80,
  });
  const after = processCycle(before, 1);
  assert.ok(after.population.total >= 10);
});

test("processCycle step 4: population departures when happiness < 40", () => {
  // Use a population large enough for the floor() formula to produce ≥1 departures.
  // formula: floor(total * 0.05 * ((40 - h) / 40))
  // With total=100, h=20: floor(100 * 0.05 * 20/40) = floor(2.5) = 2 departures.
  const before = makeTestColony({
    resources: { food: 1000, water: 1000, metal: 0, credits: 0 },  // well-fed so happiness recompute later doesn't bounce
    population: { total: 100, capacity: 100, namedCount: 0, growthRate: 0, recentDeaths: [] },
    happiness: 20,
  });
  const after = processCycle(before, 1);
  // Step 4 uses pre-recompute happiness (20), expect ≥2 departures.
  assert.ok(after.population.total < 100, `expected population < 100, got ${after.population.total}`);
  assert.ok(after.population.total >= 95, `expected not too many departures, got ${after.population.total}`);
});

test("processCycle step 3: building upkeep consumes resources", () => {
  const before = makeTestColony({
    resources: { food: 50, water: 50, metal: 0, credits: 0 },
    buildings: [
      { id: "f1", type: "farm", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
      { id: "s1", type: "solar_array", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const after = processCycle(before, 1);
  // Farm upkeep: 5 water per spec. After production (0 produced in 1 cycle) minus upkeep.
  // Farm: +15 food, needs 5 water upkeep; solar: no upkeep.
  assert.equal(after.resources.water, 45); // 50 - 5 water upkeep
});

test("processCycle advances lastCycleProcessed even with empty colony", () => {
  const before = makeTestColony();
  const after = processCycle(before, 1);
  assert.equal(after.lastCycleProcessed, 1);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd game && yarn colony:test`
Expected: FAIL with module-not-found for `cycleProcessor`.

- [ ] **Step 3: Implement cycleProcessor with first 5 steps + passthrough for 6-10**

Create `game/app/components/colony/shared/cycleProcessor.ts`:

```typescript
import type { ColonyState, ColonyBuilding, BuildingType, ColonyResources } from "./colonyTypes";
import { derivePowerGrid } from "./powerGrid";

// Spec Section E authoritative production/consumption values.
// Only operational buildings contribute.
const RESOURCE_PRODUCTION: Partial<Record<BuildingType, Partial<ColonyResources>>> = {
  farm: { food: 15 },
  water_purifier: { water: 12 },
  mine: { metal: 10 },
  // Marketplace income is population-driven; handled separately in Phase 7a.
};

const RESOURCE_UPKEEP: Partial<Record<BuildingType, Partial<ColonyResources>>> = {
  farm: { water: 5 },
  mine: {},
  refinery: { metal: 5 },
  barracks: { food: 3 },
  // Upkeep-in-power handled via powerGrid, not resource consumption.
};

export function processCycle(colony: ColonyState, toCycle: number): ColonyState {
  let state = colony;
  state = step1_production(state);
  state = step2_populationConsumption(state);
  state = step3_buildingUpkeep(state);
  state = step4_populationChange(state);
  state = step5_happinessRecompute(state);
  state = step6_threatProgression(state);
  state = step7_earthShipmentTick(state);
  state = step8_questTick(state);
  state = step9_bountyDecay(state);
  state = step10_finalize(state, toCycle);
  return state;
}

function step1_production(c: ColonyState): ColonyState {
  const delta: Partial<ColonyResources> = { food: 0, water: 0, metal: 0, credits: 0 };
  for (const b of c.buildings) {
    if (b.status !== "operational") continue;
    const prod = RESOURCE_PRODUCTION[b.type];
    if (!prod) continue;
    if (prod.food) delta.food! += prod.food;
    if (prod.water) delta.water! += prod.water;
    if (prod.metal) delta.metal! += prod.metal;
    if (prod.credits) delta.credits! += prod.credits;
  }
  return applyResourceDelta(c, delta);
}

function step2_populationConsumption(c: ColonyState): ColonyState {
  const pop = c.population.total;
  const foodNeed = pop;
  const waterNeed = Math.floor(pop * 0.5);
  return applyResourceDelta(c, { food: -foodNeed, water: -waterNeed });
}

function step3_buildingUpkeep(c: ColonyState): ColonyState {
  let state = c;
  const delta: Partial<ColonyResources> = { food: 0, water: 0, metal: 0 };
  for (const b of c.buildings) {
    if (b.status !== "operational") continue;
    const up = RESOURCE_UPKEEP[b.type];
    if (!up) continue;
    if (up.food) delta.food! -= up.food;
    if (up.water) delta.water! -= up.water;
    if (up.metal) delta.metal! -= up.metal;
  }
  state = applyResourceDelta(state, delta);

  // Power grid brownout: if surplus < 0, flip random operational buildings offline.
  const grid = derivePowerGrid(state);
  if (grid.surplus < 0) {
    const deficit = -grid.surplus;
    const operational = state.buildings.filter(b => b.status === "operational");
    let shed = 0;
    const nextBuildings = state.buildings.map(b => ({ ...b }));
    for (const b of operational) {
      if (shed >= deficit) break;
      // Deterministic shed: iterate in building.id order
      const i = nextBuildings.findIndex(nb => nb.id === b.id);
      nextBuildings[i].status = "offline";
      shed += 1; // for Phase 0, shed one-at-a-time per unit of deficit (simplification; Phase 8 refines)
    }
    state = { ...state, buildings: nextBuildings };
  }
  return state;
}

function step4_populationChange(c: ColonyState): ColonyState {
  const h = c.happiness;
  let newborns = 0;
  let departures = 0;
  if (h > 60) {
    newborns = Math.floor(c.population.total * 0.02 * (h / 100));
  }
  if (h < 40) {
    departures = Math.floor(c.population.total * 0.05 * ((40 - h) / 40));
  }
  const nextTotal = Math.max(0, Math.min(c.population.capacity, c.population.total + newborns - departures));
  return {
    ...c,
    population: { ...c.population, total: nextTotal, growthRate: newborns - departures },
  };
}

function step5_happinessRecompute(c: ColonyState): ColonyState {
  let h = 50; // baseline
  if (c.resources.food > c.population.total * 2) h += 15;
  if (c.resources.food < c.population.total) h -= 30;
  if (c.resources.water > c.population.total) h += 10;
  if (c.resources.water < c.population.total * 0.5) h -= 25;
  const grid = derivePowerGrid(c);
  if (grid.surplus >= 0 && grid.demand > 0) h += 5;
  if (grid.surplus < 0) h -= 20;
  if (c.population.total > c.population.capacity) h -= 20;
  const hasMedBay = c.buildings.some(b => b.type === "med_bay" && b.status === "operational");
  if (hasMedBay) h += 10;
  const hasMarketplace = c.buildings.some(b => b.type === "marketplace" && b.status === "operational");
  if (hasMarketplace) h += 10;
  const hasBarracks = c.buildings.some(b => b.type === "barracks" && b.status === "operational");
  if (hasBarracks) h += 5;
  const recentAttack = c.activeThreats.some(t => t.kind === "raid_incoming" || t.kind === "siege_ongoing");
  if (recentAttack) h -= 15;
  return { ...c, happiness: Math.max(0, Math.min(100, h)) };
}

function step6_threatProgression(c: ColonyState): ColonyState {
  // Phase 0 stub: tick down threat timers. Full resolution logic in Phase 8.
  if (c.activeThreats.length === 0) return c;
  const nextThreats = c.activeThreats
    .map(t => ({ ...t, cyclesUntilResolve: t.cyclesUntilResolve - 1 }))
    .filter(t => t.cyclesUntilResolve > 0);
  return { ...c, activeThreats: nextThreats };
}

function step7_earthShipmentTick(_c: ColonyState): ColonyState {
  // Phase 0 stub: shipment tick lives at the save level (advanceWorldCycle), not colony level.
  // Full interception rolls and arrival handling lands in Phase 7b.
  return _c;
}

function step8_questTick(_c: ColonyState): ColonyState {
  // Phase 0 stub: quest tick lives at the save level. Lands in Phase 10.
  return _c;
}

function step9_bountyDecay(_c: ColonyState): ColonyState {
  // Phase 0 stub: bounties are save-level. Decay logic lands in Phase 5b.
  return _c;
}

function step10_finalize(c: ColonyState, toCycle: number): ColonyState {
  const selfSufficient =
    c.resources.food >= c.population.total &&
    c.resources.water >= Math.floor(c.population.total * 0.5) &&
    c.happiness >= 50;
  return { ...c, lastCycleProcessed: toCycle, selfSufficient };
}

function applyResourceDelta(c: ColonyState, delta: Partial<ColonyResources>): ColonyState {
  const nextResources = { ...c.resources };
  if (delta.food !== undefined) nextResources.food = Math.max(0, nextResources.food + delta.food);
  if (delta.water !== undefined) nextResources.water = Math.max(0, nextResources.water + delta.water);
  if (delta.metal !== undefined) nextResources.metal = Math.max(0, nextResources.metal + delta.metal);
  if (delta.credits !== undefined) nextResources.credits = Math.max(0, nextResources.credits + delta.credits);
  return { ...c, resources: nextResources };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd game && yarn colony:test`
Expected: all 7 cycle processor tests pass.

- [ ] **Step 5: Commit**

```bash
git add game/app/components/colony/shared/cycleProcessor.ts game/tests/colony/cycleProcessor.test.ts
git commit -m "feat(colony): cycle processor with 5 live steps + stubs for 6-9"
```

---

### Task 13: `advanceWorldCycle` orchestrator + invariant integration

**Files:**
- Create: `game/app/components/colony/shared/cycleProcessor.ts` (extend)
- Create: `game/app/components/colony/shared/catchUp.ts`
- Create: `game/tests/colony/advanceWorldCycle.test.ts`
- Create: `game/tests/colony/catchUp.test.ts`

Goal: world-level cycle orchestrator (eager path). `catchUpColony` migration helper. Invariants checked after every cycle.

- [ ] **Step 1: Write the failing tests**

Create `game/tests/colony/advanceWorldCycle.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceWorldCycle } from "../../app/components/colony/shared/cycleProcessor";
import type { SaveData } from "../../app/components/engine/types";
import { makeTestColony } from "./fixtures";

function makeSaveWith(colonies: SaveData["colonies"]): SaveData {
  return {
    currentWorld: 1, levels: {}, credits: 0, totalStars: 0, totalScore: 0, xp: 0,
    upgrades: {} as SaveData["upgrades"], unlockedCodex: [], viewedCodex: [],
    viewedConversations: [], completedQuests: [], activeQuests: [],
    completedPlanets: [], unlockedSpecialMissions: [], completedSpecialMissions: [],
    storyItems: [], materials: [], consumableInventory: {}, equippedConsumables: [],
    unlockedEnhancements: [], bestiary: {}, equippedWeaponType: "kinetic",
    pilotLevel: 1, skillPoints: 0, allocatedSkills: [],
    colonies, planets: [], earthShipments: [], factionStandings: [], bounties: [],
    missionsSinceStart: 0,
    gameClock: { day: 0, hour: 7, minute: 0, realtimeMsPerGameMinute: 1000, season: "standard" },
  };
}

test("advanceWorldCycle increments missionsSinceStart and ticks every colony", () => {
  const save = makeSaveWith([
    makeTestColony({ id: "c1" }),
    makeTestColony({ id: "c2" }),
  ]);
  const next = advanceWorldCycle(save);
  assert.equal(next.missionsSinceStart, 1);
  assert.equal(next.colonies[0].lastCycleProcessed, 1);
  assert.equal(next.colonies[1].lastCycleProcessed, 1);
});

test("advanceWorldCycle maintains invariant: all colonies at missionsSinceStart", () => {
  const save = makeSaveWith([makeTestColony({ id: "c1" })]);
  const next = advanceWorldCycle(save);
  assert.equal(next.colonies[0].lastCycleProcessed, next.missionsSinceStart);
});

test("advanceWorldCycle does not mutate input", () => {
  const save = makeSaveWith([makeTestColony({ id: "c1" })]);
  advanceWorldCycle(save);
  assert.equal(save.missionsSinceStart, 0);
});

test("advanceWorldCycle handles empty colonies list", () => {
  const save = makeSaveWith([]);
  const next = advanceWorldCycle(save);
  assert.equal(next.missionsSinceStart, 1);
});
```

Create `game/tests/colony/catchUp.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { catchUpColony } from "../../app/components/colony/shared/catchUp";
import { makeTestColony } from "./fixtures";

test("catchUpColony with zero missed cycles returns identity", () => {
  const c = makeTestColony({ lastCycleProcessed: 5 });
  const next = catchUpColony(c, 5);
  assert.equal(next.lastCycleProcessed, 5);
});

test("catchUpColony with 3 missed cycles runs 3 times", () => {
  const c = makeTestColony({ lastCycleProcessed: 0 });
  const next = catchUpColony(c, 3);
  assert.equal(next.lastCycleProcessed, 3);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd game && yarn colony:test`
Expected: fail, `advanceWorldCycle` and `catchUpColony` not found.

- [ ] **Step 3: Implement advanceWorldCycle**

Append to `game/app/components/colony/shared/cycleProcessor.ts`:

```typescript
import type { SaveData } from "../../engine/types";
import { runStandardInvariants } from "./colonyAssert";

export function advanceWorldCycle(save: SaveData): SaveData {
  const newCycle = save.missionsSinceStart + 1;
  const nextColonies = save.colonies.map(c => {
    const next = processCycle(c, newCycle);
    runStandardInvariants(next);
    return next;
  });
  return { ...save, colonies: nextColonies, missionsSinceStart: newCycle };
}
```

Create `game/app/components/colony/shared/catchUp.ts`:

```typescript
import type { ColonyState } from "./colonyTypes";
import { processCycle } from "./cycleProcessor";

/**
 * Catch a colony up from its last-processed cycle to the given target.
 * Reserved for save migrations and dev/debug harnesses — during normal play,
 * every colony is always current (invariant: lastCycleProcessed === missionsSinceStart).
 */
export function catchUpColony(colony: ColonyState, targetCycle: number): ColonyState {
  let next = colony;
  while (next.lastCycleProcessed < targetCycle) {
    next = processCycle(next, next.lastCycleProcessed + 1);
  }
  return next;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd game && yarn colony:test`
Expected: all cycle/catchup tests pass.

- [ ] **Step 5: Commit**

```bash
git add game/app/components/colony/shared/cycleProcessor.ts game/app/components/colony/shared/catchUp.ts game/tests/colony/advanceWorldCycle.test.ts game/tests/colony/catchUp.test.ts
git commit -m "feat(colony): advanceWorldCycle orchestrator + catchUp migration path"
```

---

### Task 14: Public API — `colony/index.ts`

**Files:**
- Create: `game/app/components/colony/index.ts`
- Create: `game/tests/colony/publicApi.test.ts`

Goal: single import surface for the rest of the codebase. Everything else in `colony/` is considered internal.

- [ ] **Step 1: Write the failing test**

Create `game/tests/colony/publicApi.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ColonyApi from "../../app/components/colony";

test("public API exports core functions", () => {
  assert.equal(typeof ColonyApi.colonyReducer, "function");
  assert.equal(typeof ColonyApi.advanceWorldCycle, "function");
  assert.equal(typeof ColonyApi.processCycle, "function");
  assert.equal(typeof ColonyApi.rankFromStanding, "function");
  assert.equal(typeof ColonyApi.derivePowerGrid, "function");
  assert.equal(typeof ColonyApi.Events, "object");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd game && yarn colony:test`
Expected: module-not-found.

- [ ] **Step 3: Create index.ts**

Create `game/app/components/colony/index.ts`:

```typescript
// Public API for the colony subsystem.
// Consumers OUTSIDE game/app/components/colony/ must import only from this file.

export { colonyReducer } from "./shared/colonyReducer";
export { advanceWorldCycle, processCycle } from "./shared/cycleProcessor";
export { catchUpColony } from "./shared/catchUp";
export { rankFromStanding, applyStandingDelta } from "./shared/factionLedger";
export { derivePowerGrid, powerCapacityOf, powerDemandOf } from "./shared/powerGrid";
export {
  assertColonyInvariant,
  assertSaveInvariant,
  runStandardInvariants,
} from "./shared/colonyAssert";
export { Events } from "./shared/colonyEvents";
export type { ColonyEvent } from "./shared/colonyEvents";

// Re-export types
export type {
  ColonyState,
  ColonyBuilding,
  PopulationState,
  ColonyResources,
  PowerGrid,
  Npc,
  PlanetState,
  RegionMap,
  RegionNode,
  ElevationMeta,
  EarthShipment,
  ShipmentContents,
  FactionStanding,
  Bounty,
  GameClock,
  CollapseState,
  District,
  Threat,
  Mood,
  Quest,
  QuestReward,
  Objective,
  GateCondition,
  ColonyId,
  PlanetId,
  BuildingInstanceId,
  BuildingType,
  DistrictId,
  NpcId,
  QuestId,
  RegionNodeId,
  TemplateId,
  FactionId,
  PlanetBiome,
  PoiType,
} from "./shared/colonyTypes";
```

- [ ] **Step 4: Run tests**

Run: `cd game && yarn colony:test`
Expected: public API test passes. All prior tests still pass.

- [ ] **Step 5: Verify full build green**

Run: `cd game && yarn build`
Expected: build succeeds, static export completes.

- [ ] **Step 6: Commit**

```bash
git add game/app/components/colony/index.ts game/tests/colony/publicApi.test.ts
git commit -m "feat(colony): expose stable public API via colony/index.ts"
```

---

### Task 15: End-to-end synthetic simulation

**Files:**
- Create: `game/tests/colony/integration.test.ts`

Goal: a single test that simulates 5 mission cycles on a synthetic save with one founded colony and two commissioned buildings. Asserts the whole pipeline holds together.

- [ ] **Step 1: Write the test**

Create `game/tests/colony/integration.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { colonyReducer, advanceWorldCycle, Events } from "../../app/components/colony";
import type { SaveData } from "../../app/components/engine/types";

function makeEmpty(): SaveData {
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

test("5-cycle simulation: found colony, commission 2 buildings, run 5 cycles", () => {
  let save = makeEmpty();

  // 1. Found a colony
  save = colonyReducer(save, Events.founded({
    colonyId: "ashfall_primary",
    name: "Ashfall Primary",
    planetId: "ashfall",
    foundingType: "outpost",
    regionNodeId: "rn_ashfall_1",
    missionCount: 0,
    layoutSeed: 42,
  }));

  // 2. Seed with starting resources so we can commission
  const colony = save.colonies[0];
  save = {
    ...save,
    colonies: [{
      ...colony,
      resources: { food: 0, water: 50, metal: 500, credits: 0 },
      population: { ...colony.population, total: 5, capacity: 10 },
    }],
  };

  // 3. Commission Solar + Farm + Water Purifier
  save = colonyReducer(save, Events.buildingCommissioned({
    colonyId: "ashfall_primary", buildingId: "b_solar", buildingType: "solar_array",
    costDeducted: { metal: 80 }, cyclesToBuild: 1,
  }));
  save = colonyReducer(save, Events.buildingCommissioned({
    colonyId: "ashfall_primary", buildingId: "b_farm", buildingType: "farm",
    costDeducted: { metal: 100 }, cyclesToBuild: 2,
  }));
  save = colonyReducer(save, Events.buildingCommissioned({
    colonyId: "ashfall_primary", buildingId: "b_water", buildingType: "water_purifier",
    costDeducted: { metal: 120 }, cyclesToBuild: 2,
  }));

  // Sanity: 500 - 80 - 100 - 120 = 200 metal left
  assert.equal(save.colonies[0].resources.metal, 200);

  // 4. Run 5 cycles, completing buildings at appropriate times
  // Cycle 1: solar completes (after 1 cycle)
  save = advanceWorldCycle(save);
  save = colonyReducer(save, Events.buildingCompleted({ colonyId: "ashfall_primary", buildingId: "b_solar" }));
  assert.equal(save.missionsSinceStart, 1);

  // Cycle 2: farm + water purifier complete (after 2 cycles)
  save = advanceWorldCycle(save);
  save = colonyReducer(save, Events.buildingCompleted({ colonyId: "ashfall_primary", buildingId: "b_farm" }));
  save = colonyReducer(save, Events.buildingCompleted({ colonyId: "ashfall_primary", buildingId: "b_water" }));

  // Cycles 3-5: colony should produce resources
  save = advanceWorldCycle(save);
  save = advanceWorldCycle(save);
  save = advanceWorldCycle(save);

  const final = save.colonies[0];
  assert.equal(final.lastCycleProcessed, 5);
  assert.equal(save.missionsSinceStart, 5);
  // With operational farm + water purifier + solar, food and water should have grown net-positive over cycles 3-5
  assert.ok(final.resources.food > 0, "food should be positive after 3 productive cycles");
  assert.ok(final.resources.water > 0, "water should be positive after 3 productive cycles");
  // Buildings remained operational throughout
  assert.equal(final.buildings.filter(b => b.status === "operational").length, 3);
});
```

- [ ] **Step 2: Run the integration test**

Run: `cd game && yarn colony:test`
Expected: test passes, no invariant violations.

- [ ] **Step 3: Verify full build still green**

Run: `cd game && yarn build`
Expected: build + static export succeed.

- [ ] **Step 4: Commit**

```bash
git add game/tests/colony/integration.test.ts
git commit -m "test(colony): end-to-end 5-cycle synthetic simulation"
```

---

### Task 16: Final verification + gitignore check

**Files:**
- Modify: `.gitignore` (if needed)
- No new source files.

Goal: confirm `yarn colony:test` and `yarn build` are both green, nothing untracked that shouldn't be, and docs are in order.

- [ ] **Step 1: Run both acceptance commands**

Run:
```bash
cd game && yarn colony:test
```
Expected: **all tests pass, no failures, no unhandled promise rejections.**

Run:
```bash
cd game && yarn build
```
Expected: **build completes, static export succeeds.**

- [ ] **Step 2: Check for untracked files that shouldn't be committed**

Run: `cd .. && git status`

If anything unexpected shows up (e.g., `.next/`, `out/`, etc.), add to `.gitignore`. Do NOT commit build outputs.

- [ ] **Step 3: Final commit (if gitignore changed)**

If `.gitignore` was modified:

```bash
git add .gitignore
git commit -m "chore: update gitignore for Phase 0 colony system test outputs"
```

- [ ] **Step 4: Tag the phase completion**

Run:
```bash
git tag colony-phase-0-complete
```

(Tags are local; push if desired but not required.)

- [ ] **Step 5: Document what landed**

Update `docs/superpowers/plans/2026-04-20-colony-phase-0-data-model.md` — append a `## Completion Log` section at the bottom:

```markdown
## Completion Log

**Completed:** YYYY-MM-DD (fill in actual date)
**Commits:** List of SHAs from this phase
**Acceptance criteria met:**
- yarn colony:test: green (N tests passing)
- yarn build: green
- Save roundtrip: verified
- 5-cycle synthetic simulation: verified

**Deferred to later phases (per spec):**
- Step 6-9 of cycle pipeline are stubs — full logic lands in Phases 5b, 7b, 10.
- No NPC registry yet — `colony/npcKilled` and `colony/witnessed` are placeholder handlers.
- Power grid brownout shedding is deterministic one-at-a-time; Phase 8 refines under attack/damage conditions.
```

```bash
git add docs/superpowers/plans/2026-04-20-colony-phase-0-data-model.md
git commit -m "docs(colony): Phase 0 completion log"
```

---

## Acceptance Criteria (top-level)

Phase 0 is complete when ALL of the following are true:

- [ ] `cd game && yarn colony:test` runs green (20+ tests across 7+ test files)
- [ ] `cd game && yarn build` runs green (Next.js static export succeeds)
- [ ] `game/app/components/colony/` directory exists with all files listed in File Structure
- [ ] `SaveData` interface in `game/app/components/engine/types.ts` contains all 7 new colony fields
- [ ] `migrateSave` in `game/app/components/engine/save.ts` handles empty/old/new saves
- [ ] Public API (`game/app/components/colony/index.ts`) exports: `colonyReducer`, `advanceWorldCycle`, `processCycle`, `catchUpColony`, `rankFromStanding`, `applyStandingDelta`, `derivePowerGrid`, `Events`, invariant helpers, all public types
- [ ] No existing engine file modified (except `save.ts` and `types.ts` for SaveData extension)
- [ ] No UI changes visible to players
- [ ] End-to-end 5-cycle synthetic simulation passes with operational colony
- [ ] All commits small, incremental, and describe one behavioral change each

## Risk Mitigations

- **tsx version drift:** pin to a known version in `package.json` (`"tsx": "^4.19.0"` or similar recent).
- **TypeScript strict mode:** if strict mode surfaces issues in existing code, DO NOT fix them here — flag and defer to a separate TypeScript cleanup pass.
- **Node version:** `node:test` requires Node 18+. If developer machine has older Node, prompt them to upgrade (Node 20 LTS recommended, matches Next.js 15 requirement).
- **Save format breaking changes:** the migration is additive-only. If an existing player loads a save after Phase 0 deploys, they get empty colony fields and continue normally.

## Implementation Notes

- **Migration append convention:** Task 7 Step 3 and Task 8 Step 3 show only the new fields to add. These are **appends to existing structures**, not replacements. The existing fields in `defaultSave` and the existing `migrateSave` return object remain untouched.
- **`BuildingType` alias:** per spec Appendix A, `BuildingType` is a bare `string` alias (for Phase 0 flexibility — full union type is deferred to Phase 1 when the UI catalog lands). This means `Partial<Record<BuildingType, ...>>` silently accepts arbitrary strings — be careful with spelling in `RESOURCE_PRODUCTION`, `RESOURCE_UPKEEP`, `POWER_CAPACITY`, `POWER_DEMAND` tables. Phase 1 will tighten this to a union and surface any typos.
- **Collapse state deferral:** spec Section D references `CollapseState` as living on `ColonyState`, but the `ColonyState` interface in Section B (and the plan's fixture) does not currently include a `collapse` field. This is an intentional Phase 0/Phase 5b split — Phase 0 does not implement collapse runtime. A future phase (likely 5b or 8) will add the `collapse?: CollapseState` optional field and the associated state machine. Do not add it here.

## Next Phase

After Phase 0 completes and is committed/tagged: Phase 1 plan (`2026-04-NN-colony-phase-1-meta-single-colony.md`) — build the React meta UI for a single colony, wire the COLONIES cockpit hub station, auto-found the starter colony at Ashfall on first run, enable 4 building types.

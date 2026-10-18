# GC2-A Galaxy Colony Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** ACCEPTED by the Codex Manager (2026-10-18, with the review corrections in `6bf9f7f`);
IN PROGRESS on `feat/galaxy-colony`.

**Dry run (2026-10-18, RUNS):** the code in Tasks 1–6 was applied verbatim to a scratch copy of
`30b0726` outside git (not a worktree; nothing committed). `tsc --noEmit` was clean. The 14 new
unit tests passed. Of all 965 unit tests, 960 passed; the 5 failures were sprite tests that read
`../docs/assets/...`, a path missing from the scratch copy, and they pass in the repository.
Tasks 7–8 (`Game.tsx`, browser) were not dry-run.

**Manager review corrections (2026-10-18, confirmed in chat):** Task 3A adds the stored-save
persistence boundary and its store tests; Task 7 commits through it and extends both walk input
guards; Task 8 adds held-input scenarios. Task 3A was dry-run in the same scratch copy (14 tests
pass, `tsc` clean); the Task 7 and Task 8 corrections were not.

**Goal:** In a galaxy run, a vessel parked at Ashfall can open colony management, commission a
Solar Array through a validated command, finish it through an existing cycle-bearing action,
reload, and find the building in the colony walk. Legacy progression stays unchanged.

**Architecture:** A new pure module `engine/galaxy/galaxyColonyManagement.ts` quotes and commits
one command against the current canonical save (travel's `stale_plan` pattern), applies the
existing colony reducer to a disposable projection, checks the exact allowed change, and merges
only `colonies` through `mergeProjectionIntoGalaxy`. A thin galaxy management screen reuses the
existing colony panels. `Game.tsx` owns entry points and persistence. GC1's visit merge is not
touched.

**Tech stack:** Next.js 15 static export, React 19, TypeScript, Node test runner via `tsx`,
Playwright (static config).

**Spec:** `docs/superpowers/specs/2026-10-18-gc2a-galaxy-colony-management-design.md`.

**Shared-file rule:** one implementer owns `game/app/components/Game.tsx` for this slice. Do not
edit `docs/ROADMAP.md`, `docs/handoffs/`, `docs/ashfall/` or the designer worktree.

---

## File structure

| File | Change | Responsibility |
|---|---|---|
| `game/app/components/colony/shared/colonyCatalog.ts` | Modify | `BUILD_SPECS`: cost and build cycles per building type (single source) |
| `game/app/components/colony/meta/ColonyCommissionMenu.tsx` | Modify | Read `BUILD_SPECS`; optional `options` and `onCommission`; `onDispatch` optional |
| `game/app/components/colony/meta/ColonyHeader.tsx` | Modify | Optional `backLabel` (default unchanged) |
| `game/app/components/engine/galaxy/galaxyColony.ts` | Modify | Export the existing `samePlainData` helper (no behaviour change) |
| `game/app/components/engine/galaxy/galaxyColonyManagement.ts` | Create | Access wording, quote, commit, exact-change check, stored-save boundary |
| `game/app/components/colony/meta/GalaxyColonyManagementScreen.tsx` | Create | Galaxy management dialog over the existing panels |
| `game/app/components/colony/meta/index.ts` | Modify | Export the new screen |
| `game/app/components/colony/exploration/exitMenu.tsx` | Modify | Optional `onManageColony` → `COLONY MANAGEMENT` button |
| `game/app/components/galaxy/GalaxyAtlasScreen.tsx` | Modify | Optional `onManageColony` → `MANAGE COLONY` button |
| `game/app/components/Game.tsx` | Modify | Open state, quotes in render, commit + persist, entry wiring |
| `game/tests/colony/buildMenu.test.ts` | Modify | Pin `PHASE_1_BUILD_OPTIONS` to `BUILD_SPECS` |
| `game/tests/colony/galaxyColonyManagement.test.ts` | Create | Rule, quote, commit, refusals, legacy isolation, reload |
| `game/tests/colony/galaxyColonyManagementRoute.test.ts` | Create | Fresh-save route through shipped authorities |
| `game/tests/colony/galaxyColonyManagementScreen.test.ts` | Create | Static render of the screen and menu props |
| `game/tests/browser/galaxyColonyManagement.spec.ts` | Create | Keyboard route; pointer gating and refusal |

Commands (run from `game/`):

- Unit: `npx tsx --test tests/colony/*.test.ts tests/engine/*.test.ts tests/sprites/*.test.ts`
- One file: `npx tsx --test tests/colony/galaxyColonyManagement.test.ts`
- Types: `npx tsc --noEmit -p .`
- Build: `NEXT_PUBLIC_DEVTOOLS=1 yarn build`
- Browser (after build): `COREPACK_ENABLE_PROJECT_SPEC=0 PLAYWRIGHT_TEST_PORT=3107 ./node_modules/.bin/playwright test tests/browser/galaxyColonyManagement.spec.ts tests/browser/galaxyColony.spec.ts --config playwright.static.config.ts --workers=1 --retries=0 --reporter=line`

`playwright.static.config.ts` is an untracked local file in `game/`; if it is missing, copy the
`webServer` override described in the project memory or use `playwright.config.ts` with a
running static server.

---

### Task 1: One build catalogue for cost and build time

**Files:**
- Modify: `game/app/components/colony/shared/colonyCatalog.ts`
- Modify: `game/app/components/colony/meta/ColonyCommissionMenu.tsx`
- Test: `game/tests/colony/buildMenu.test.ts`

- [ ] **Step 1: Write the failing test** (append to `tests/colony/buildMenu.test.ts`; add
  `BUILD_SPECS` to the existing `colonyCatalog` import)

```ts
test("build menu: every option's cost and build time come from BUILD_SPECS", () => {
  for (const option of PHASE_1_BUILD_OPTIONS) {
    const spec = BUILD_SPECS[option.type];
    assert.ok(spec, `${option.type} needs a BUILD_SPECS entry`);
    assert.deepEqual(option.cost, spec.cost);
    assert.equal(option.cyclesToBuild, spec.cyclesToBuild);
  }
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx tsx --test tests/colony/buildMenu.test.ts`
Expected: FAIL — `BUILD_SPECS` is not exported.

- [ ] **Step 3: Add `BUILD_SPECS`** (append to `colonyCatalog.ts`; extend the type import with
  nothing new — `BuildingType` and `ColonyResources` are already imported)

```ts
/**
 * Commission cost and build time per building type. The legacy commission menu and the
 * galaxy command boundary (GC2-A) both read this table, so the UI never decides a cost.
 */
export const BUILD_SPECS: Readonly<Partial<Record<BuildingType, {
  readonly cost: Readonly<Partial<ColonyResources>>;
  readonly cyclesToBuild: number;
}>>> = Object.freeze({
  solar_array: Object.freeze({ cost: Object.freeze({ metal: 80 }), cyclesToBuild: 1 }),
  farm: Object.freeze({ cost: Object.freeze({ metal: 100 }), cyclesToBuild: 2 }),
  water_purifier: Object.freeze({ cost: Object.freeze({ metal: 120 }), cyclesToBuild: 2 }),
  habitat_module: Object.freeze({ cost: Object.freeze({ metal: 100 }), cyclesToBuild: 1 }),
  mine: Object.freeze({ cost: Object.freeze({ metal: 150 }), cyclesToBuild: 2 }),
  cantina: Object.freeze({ cost: Object.freeze({ metal: 200 }), cyclesToBuild: 3 }),
});
```

- [ ] **Step 4: Derive the menu options from it** (in `ColonyCommissionMenu.tsx`, import
  `BUILD_SPECS` beside `HABITAT_CAPACITY_PER_MODULE` and replace the literal table)

```ts
function buildOption(type: BuildingType, label: string, icon: string, shortDesc: string): BuildOption {
  const spec = BUILD_SPECS[type];
  if (!spec) throw new Error(`[ColonyCommissionMenu] no BUILD_SPECS entry for ${type}`);
  return { type, label, icon, cost: { ...spec.cost }, cyclesToBuild: spec.cyclesToBuild, shortDesc };
}

export const PHASE_1_BUILD_OPTIONS: BuildOption[] = [
  buildOption("solar_array", "Solar Array", "☀", "+10 power"),
  buildOption("farm", "Farm", "🌾", "+15 food, −5 water"),
  buildOption("water_purifier", "Water Purifier", "💧", "+12 water"),
  buildOption("habitat_module", "Habitat Module", "🏠", `Houses ${HABITAT_CAPACITY_PER_MODULE}`),
  buildOption("mine", "Mine", "⛏", "+10 metal/cycle"),
  buildOption("cantina", "Cantina", "🍺", "Social hub for drinks and rumors"),
];
```

- [ ] **Step 5: Run the colony suite**

Run: `npx tsx --test tests/colony/buildMenu.test.ts tests/colony/integration.test.ts`
Expected: PASS, including the existing "historical options stay unchanged" test (legacy costs
are pinned there).

- [ ] **Step 6: Commit**

```bash
git add game/app/components/colony/shared/colonyCatalog.ts game/app/components/colony/meta/ColonyCommissionMenu.tsx game/tests/colony/buildMenu.test.ts
git commit -m "refactor(colony): one build catalogue for commission cost and build time"
```

---

### Task 2: Management access and the commission quote

**Files:**
- Modify: `game/app/components/engine/galaxy/galaxyColony.ts` (export `samePlainData` only)
- Create: `game/app/components/engine/galaxy/galaxyColonyManagement.ts`
- Test: `game/tests/colony/galaxyColonyManagement.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GALAXY_COMMISSION_TYPES,
  galaxyColonyManagementAccess,
  quoteGalaxyColonyCommission,
} from "../../app/components/engine/galaxy/galaxyColonyManagement";
import { createFreshGalaxyRun, startFreshGalaxy } from "../../app/components/engine/galaxy/galaxyRun";
import type { GalaxyRunState } from "../../app/components/engine/galaxy/galaxyTypes";
import { planRoute } from "../../app/components/engine/galaxy/routePlanner";
import { commitTravel, finalizeTravel, resumeTravelToBoundary } from "../../app/components/engine/galaxy/travelResolver";
import { migrateSave } from "../../app/components/engine/save";
import type { SaveData } from "../../app/components/engine/types";

const COLONY = "galaxy:ashfall-primary";

function ok<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  assert.equal(result.ok, true, JSON.stringify(result));
  return result as Extract<T, { ok: true }>;
}

function atAshfall(): GalaxyRunState {
  const fresh = createFreshGalaxyRun();
  const preview = planRoute(fresh, { kind: "contact", contactId: "contact:ashfall" });
  if (!preview.ok) throw new Error(preview.reasons.join("; "));
  const committed = ok(commitTravel(fresh, preview.plan)).galaxyRun;
  const arrived = ok(resumeTravelToBoundary(committed)).galaxyRun;
  return ok(finalizeTravel(arrived)).galaxyRun;
}

function withMetal(run: GalaxyRunState, metal: number): GalaxyRunState {
  return {
    ...run,
    colonies: run.colonies.map(colony => colony.id === COLONY
      ? { ...colony, resources: { ...colony.resources, metal } }
      : colony),
  };
}

function parentFor(run: GalaxyRunState): SaveData {
  const legacy = startFreshGalaxy(migrateSave({
    currentWorld: 7, credits: 9876, completedQuests: ["legacy-quest"], completedPlanets: ["pyraxis"],
  }));
  return { ...legacy, galaxyRun: run };
}

test("management access follows the descent rule with MANAGE wording", () => {
  const fresh = createFreshGalaxyRun();
  assert.deepEqual(galaxyColonyManagementAccess(fresh, COLONY), { status: "unavailable", reason: "ARRIVE AT ASHFALL FIRST" });
  assert.deepEqual(galaxyColonyManagementAccess(atAshfall(), COLONY), { status: "full", colonyId: COLONY, contactId: "contact:ashfall" });
  assert.deepEqual(galaxyColonyManagementAccess(atAshfall(), "outpost:ashfall-basalt-basin"), { status: "unavailable", reason: "NO COLONY HERE" });
  const moving = { ...atAshfall(), vessel: { ...atAshfall().vessel, contactId: "contact:vanguard" } };
  assert.deepEqual(galaxyColonyManagementAccess(moving, COLONY), { status: "unavailable", reason: "PARK AT ASHFALL TO MANAGE" });
});

test("GC2-A supports exactly one building type", () => {
  assert.deepEqual([...GALAXY_COMMISSION_TYPES], ["solar_array"]);
});

test("a quote takes cost, build time and id from the catalogue and the canonical colony", () => {
  const quote = ok(quoteGalaxyColonyCommission(parentFor(withMetal(atAshfall(), 80)), COLONY, "solar_array")).quote;
  assert.deepEqual(quote, {
    colonyId: COLONY,
    buildingType: "solar_array",
    buildingId: `b-${COLONY}-0-solar_array`,
    cost: { metal: 80 },
    cyclesToBuild: 1,
    worldCycle: quote.worldCycle,
    buildingCount: 0,
    resources: { food: 0, water: 0, metal: 80, credits: 0 },
  });
  assert.equal(quote.worldCycle, atAshfall().worldCycle);
});

test("quotes refuse with a reason", () => {
  const away = parentFor(createFreshGalaxyRun());
  assert.equal(quoteGalaxyColonyCommission(away, COLONY, "solar_array").ok, false);
  const poor = quoteGalaxyColonyCommission(parentFor(withMetal(atAshfall(), 79)), COLONY, "solar_array");
  assert.deepEqual(poor, { ok: false, reason: "insufficient_resources", message: "NOT ENOUGH RESOURCES" });
  const mine = quoteGalaxyColonyCommission(parentFor(withMetal(atAshfall(), 500)), COLONY, "mine");
  assert.deepEqual(mine, { ok: false, reason: "unsupported_building", message: "NOT AVAILABLE IN THIS RUN YET" });
  const legacy = { ...parentFor(atAshfall()), activeExperience: "legacy" as const };
  assert.equal(quoteGalaxyColonyCommission(legacy, COLONY, "solar_array").ok, false);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx tsx --test tests/colony/galaxyColonyManagement.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Export the existing helper** — in `galaxyColony.ts` change
  `function samePlainData(` to `export function samePlainData(`. No other change.

- [ ] **Step 4: Create the module (quote half)**

```ts
import type { BuildingType, ColonyBuilding, ColonyResources, ColonyState } from "../../colony/shared/colonyTypes";
import { BUILD_SPECS } from "../../colony/shared/colonyCatalog";
import { colonyReducer } from "../../colony/shared/colonyReducer";
import { Events } from "../../colony/shared/colonyEvents";
import { genBuildingId } from "../../colony/meta/buildingIdGen";
import { hasBuildableSlot } from "../../colony/region/siteModifiers";
import type { SaveData } from "../types";
import { galaxyColonyAccess, samePlainData, type GalaxyColonyAccess } from "./galaxyColony";
import { mergeProjectionIntoGalaxy, projectGalaxyRunToLegacyState } from "./galaxyProjection";
import type { GalaxyRunState } from "./galaxyTypes";

/** Building types a galaxy colony may commission. GC2-A supports one (spec §4.3, decision D1). */
export const GALAXY_COMMISSION_TYPES: readonly BuildingType[] = Object.freeze(["solar_array"]);

const RESOURCE_KEYS = ["food", "water", "metal", "credits"] as const;
const QUOTE_KEYS = [
  "colonyId", "buildingType", "buildingId", "cost", "cyclesToBuild", "worldCycle", "buildingCount", "resources",
] as const;

/** What the player saw when they chose to build. Commit re-derives it; any difference is stale. */
export interface GalaxyCommissionQuote {
  colonyId: string;
  buildingType: BuildingType;
  buildingId: string;
  cost: Partial<ColonyResources>;
  cyclesToBuild: number;
  worldCycle: number;
  buildingCount: number;
  resources: ColonyResources;
}

export type GalaxyCommissionRefusal =
  | "no_galaxy_run"
  | "run_unreadable"
  | "access_unavailable"
  | "unsupported_building"
  | "no_buildable_slot"
  | "insufficient_resources"
  | "malformed_command"
  | "stale_command"
  | "unauthorized_change"
  | "merge_failed";

type Refusal = { ok: false; reason: GalaxyCommissionRefusal; message: string };
export type GalaxyCommissionQuoteResult = { ok: true; quote: GalaxyCommissionQuote } | Refusal;
export type GalaxyCommissionResult = { ok: true; save: SaveData; buildingId: string } | Refusal;

function refuse(reason: GalaxyCommissionRefusal, message: string): Refusal {
  return { ok: false, reason, message };
}

/** Management uses the descent rule (GC1); only the refusal wording changes. */
export function galaxyColonyManagementAccess(run: GalaxyRunState | null, colonyId: string | null): GalaxyColonyAccess {
  const access = galaxyColonyAccess(run, colonyId);
  return access.status === "unavailable"
    ? { status: "unavailable", reason: access.reason.replace(" TO DESCEND", " TO MANAGE") }
    : access;
}

function readRun(save: SaveData): { ok: true; parent: SaveData; run: GalaxyRunState } | Refusal {
  if (save.activeExperience !== "galaxy" || save.galaxyRun === null) {
    return refuse("no_galaxy_run", "NO ACTIVE GALAXY RUN");
  }
  const validated = mergeProjectionIntoGalaxy(save.galaxyRun, {});
  if (!validated.ok) return refuse("run_unreadable", "GALAXY RUN COULD NOT BE READ");
  return { ok: true, parent: { ...save, galaxyRun: validated.galaxyRun }, run: validated.galaxyRun };
}

function quoteFromRun(run: GalaxyRunState, colonyId: string, buildingType: BuildingType): GalaxyCommissionQuoteResult {
  const access = galaxyColonyManagementAccess(run, colonyId);
  if (access.status === "unavailable") return refuse("access_unavailable", access.reason);
  const colony = run.colonies.find(entry => entry.id === colonyId);
  if (colony === undefined) return refuse("access_unavailable", "NO COLONY HERE");
  const spec = GALAXY_COMMISSION_TYPES.includes(buildingType) ? BUILD_SPECS[buildingType] : undefined;
  if (spec === undefined) return refuse("unsupported_building", "NOT AVAILABLE IN THIS RUN YET");
  if (!hasBuildableSlot(colony)) return refuse("no_buildable_slot", "NO BUILDABLE SLOT");
  if (RESOURCE_KEYS.some(key => (spec.cost[key] ?? 0) > colony.resources[key])) {
    return refuse("insufficient_resources", "NOT ENOUGH RESOURCES");
  }
  return {
    ok: true,
    quote: {
      colonyId,
      buildingType,
      buildingId: genBuildingId(colony, buildingType),
      cost: { ...spec.cost },
      cyclesToBuild: spec.cyclesToBuild,
      worldCycle: run.worldCycle,
      buildingCount: colony.buildings.length,
      resources: { ...colony.resources },
    },
  };
}

/** Quote a commission from the current canonical save. Never trusts UI-supplied cost or time. */
export function quoteGalaxyColonyCommission(
  save: SaveData,
  colonyId: string,
  buildingType: BuildingType,
): GalaxyCommissionQuoteResult {
  try {
    const read = readRun(save);
    return read.ok ? quoteFromRun(read.run, colonyId, buildingType) : read;
  } catch {
    return refuse("run_unreadable", "GALAXY RUN COULD NOT BE READ");
  }
}
```

- [ ] **Step 5: Run the tests**

Run: `npx tsx --test tests/colony/galaxyColonyManagement.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add game/app/components/engine/galaxy/galaxyColony.ts game/app/components/engine/galaxy/galaxyColonyManagement.ts game/tests/colony/galaxyColonyManagement.test.ts
git commit -m "feat(galaxy): quote a colony commission from the canonical run (GC2-A)"
```

---

### Task 3: Commit the commission with stale and exact-change checks

**Files:**
- Modify: `game/app/components/engine/galaxy/galaxyColonyManagement.ts`
- Test: `game/tests/colony/galaxyColonyManagement.test.ts`

- [ ] **Step 1: Write the failing tests** (append; add imports for
  `commitGalaxyColonyCommission`, `isExactCommissionChange`, `advanceGalaxyWorldCycles` from
  `../../app/components/engine/galaxy/galaxyProjection`, `projectGalaxyRunToLegacyState` from
  the same module)

```ts
function legacyBytes(save: SaveData): string {
  const { galaxyRun: _run, ...legacy } = save;
  return JSON.stringify(legacy);
}

function commissioned(): { before: SaveData; after: SaveData } {
  const before = parentFor(withMetal(atAshfall(), 80));
  const quote = ok(quoteGalaxyColonyCommission(before, COLONY, "solar_array")).quote;
  return { before, after: ok(commitGalaxyColonyCommission(before, quote)).save };
}

test("commit appends one constructing building, spends the cost and changes nothing else", () => {
  const { before, after } = commissioned();
  const colony = after.galaxyRun!.colonies.find(entry => entry.id === COLONY)!;
  assert.equal(colony.resources.metal, 0);
  assert.deepEqual(colony.buildings, [{
    id: `b-${COLONY}-0-solar_array`, type: "solar_array", tier: 1, status: "constructing",
    buildProgressCycles: 1, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null,
  }]);
  assert.equal(legacyBytes(after), legacyBytes(before));
  const { colonies: _a, ...runAfter } = after.galaxyRun!;
  const { colonies: _b, ...runBefore } = before.galaxyRun!;
  assert.deepEqual(runAfter, runBefore, "no other galaxy field changes; worldCycle is unchanged (time-neutral)");
});

test("a second commit of the same quote is refused", () => {
  const before = parentFor(withMetal(atAshfall(), 160));
  const quote = ok(quoteGalaxyColonyCommission(before, COLONY, "solar_array")).quote;
  const first = ok(commitGalaxyColonyCommission(before, quote)).save;
  const second = commitGalaxyColonyCommission(first, quote);
  assert.deepEqual(second, { ok: false, reason: "stale_command", message: "COLONY CHANGED · REVIEW AND TRY AGAIN" });
});

test("a quote made before a cycle advance is stale", () => {
  const run = withMetal(atAshfall(), 80);
  const quote = ok(quoteGalaxyColonyCommission(parentFor(run), COLONY, "solar_array")).quote;
  const advanced = advanceGalaxyWorldCycles(run, 1);
  assert.equal(advanced.ok, true);
  if (!advanced.ok) return;
  const result = commitGalaxyColonyCommission(parentFor(advanced.galaxyRun), quote);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "stale_command");
});

test("forged or malformed quotes are refused", () => {
  const before = parentFor(withMetal(atAshfall(), 80));
  const quote = ok(quoteGalaxyColonyCommission(before, COLONY, "solar_array")).quote;
  const cheap = commitGalaxyColonyCommission(before, { ...quote, cost: { metal: 1 } });
  assert.equal(cheap.ok, false);
  if (!cheap.ok) assert.equal(cheap.reason, "stale_command");
  const extra = commitGalaxyColonyCommission(before, { ...quote, bonus: 1 } as never);
  assert.deepEqual(extra, { ok: false, reason: "malformed_command", message: "COMMAND REJECTED" });
  const negative = commitGalaxyColonyCommission(before, { ...quote, cyclesToBuild: -1 });
  assert.equal(negative.ok, false);
  const mine = commitGalaxyColonyCommission(before, { ...quote, buildingType: "mine" });
  assert.equal(mine.ok, false);
  if (!mine.ok) assert.equal(mine.reason, "unsupported_building");
});

test("the exact-change check rejects any other difference", () => {
  const before = parentFor(withMetal(atAshfall(), 80));
  const quote = ok(quoteGalaxyColonyCommission(before, COLONY, "solar_array")).quote;
  const projection = projectGalaxyRunToLegacyState(before.galaxyRun!);
  const good = ok(commitGalaxyColonyCommission(before, quote)).save.galaxyRun!.colonies;
  assert.equal(isExactCommissionChange(projection.colonies, good, quote), true);
  const happier = good.map(colony => ({ ...colony, happiness: colony.happiness + 1 }));
  assert.equal(isExactCommissionChange(projection.colonies, happier, quote), false);
  const richer = good.map(colony => ({ ...colony, resources: { ...colony.resources, food: 5 } }));
  assert.equal(isExactCommissionChange(projection.colonies, richer, quote), false);
  const finished = good.map(colony => ({
    ...colony, buildings: colony.buildings.map(b => ({ ...b, status: "operational" as const, buildProgressCycles: 0 })),
  }));
  assert.equal(isExactCommissionChange(projection.colonies, finished, quote), false);
});

test("the next cycle finishes the Solar Array, and a JSON reload keeps it", () => {
  const { after } = commissioned();
  const advanced = advanceGalaxyWorldCycles(after.galaxyRun!, 1);
  assert.equal(advanced.ok, true);
  if (!advanced.ok) return;
  const reloaded = migrateSave(JSON.parse(JSON.stringify({ ...after, galaxyRun: advanced.galaxyRun })));
  const colony = reloaded.galaxyRun!.colonies.find(entry => entry.id === COLONY)!;
  assert.deepEqual(colony.buildings.map(b => [b.type, b.status, b.buildProgressCycles]), [["solar_array", "operational", 0]]);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx tsx --test tests/colony/galaxyColonyManagement.test.ts`
Expected: FAIL — `commitGalaxyColonyCommission` / `isExactCommissionChange` not exported.

- [ ] **Step 3: Add the commit half** (append to `galaxyColonyManagement.ts`)

```ts
function plainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const own = Reflect.ownKeys(value);
  return own.length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
}

function count(value: unknown): boolean {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function amount(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** Copy a submitted quote as plain data, or null when its shape is wrong. */
function snapshotQuote(value: unknown): GalaxyCommissionQuote | null {
  if (!plainRecord(value) || !exactKeys(value, QUOTE_KEYS)) return null;
  const { colonyId, buildingType, buildingId, cost, cyclesToBuild, worldCycle, buildingCount, resources } = value;
  if (typeof colonyId !== "string" || typeof buildingType !== "string" || typeof buildingId !== "string") return null;
  if (!count(cyclesToBuild) || !count(worldCycle) || !count(buildingCount)) return null;
  if (!plainRecord(cost) || !plainRecord(resources) || !exactKeys(resources, RESOURCE_KEYS)) return null;
  const costKeys = Reflect.ownKeys(cost);
  if (!costKeys.every(key => typeof key === "string" &&
    (RESOURCE_KEYS as readonly string[]).includes(key) && amount(cost[key]))) return null;
  if (!RESOURCE_KEYS.every(key => amount(resources[key]))) return null;
  // Shape checked field by field above; the double cast only re-labels the checked copy.
  return structuredClone({
    colonyId, buildingType, buildingId, cost, cyclesToBuild, worldCycle, buildingCount, resources,
  }) as unknown as GalaxyCommissionQuote;
}

/**
 * True when `after` differs from `before` only by the quoted commission: the target colony
 * gains exactly the quoted building and loses exactly the quoted cost; nothing else moves.
 */
export function isExactCommissionChange(
  before: readonly ColonyState[],
  after: readonly ColonyState[],
  quote: GalaxyCommissionQuote,
): boolean {
  if (before.length !== after.length) return false;
  return before.every((colony, index) => {
    const next = after[index];
    if (next === undefined || next.id !== colony.id) return false;
    if (colony.id !== quote.colonyId) return samePlainData(colony, next);
    const { resources: oldResources, buildings: oldBuildings, ...oldRest } = colony;
    const { resources: newResources, buildings: newBuildings, ...newRest } = next;
    if (!samePlainData(oldRest, newRest)) return false;
    if (newBuildings.length !== oldBuildings.length + 1 ||
      !samePlainData(newBuildings.slice(0, oldBuildings.length), oldBuildings)) return false;
    const expected: ColonyBuilding = {
      id: quote.buildingId, type: quote.buildingType, tier: 1, status: "constructing",
      buildProgressCycles: quote.cyclesToBuild, hp: 100, maxHp: 100,
      interiorTemplateId: null, assignedNpcIds: [], districtId: null,
    };
    if (!samePlainData(newBuildings[oldBuildings.length], expected)) return false;
    return RESOURCE_KEYS.every(key => newResources[key] === oldResources[key] - (quote.cost[key] ?? 0));
  });
}

/**
 * Commission a building in a galaxy colony. Re-derives the quote from the current canonical
 * save; a different quote is stale. Writes only `galaxyRun.colonies`.
 */
export function commitGalaxyColonyCommission(save: SaveData, submitted: GalaxyCommissionQuote): GalaxyCommissionResult {
  try {
    const quote = snapshotQuote(submitted);
    if (quote === null) return refuse("malformed_command", "COMMAND REJECTED");
    const read = readRun(save);
    if (!read.ok) return read;
    const authoritative = quoteFromRun(read.run, quote.colonyId, quote.buildingType);
    if (!authoritative.ok) return authoritative;
    if (!samePlainData(authoritative.quote, quote)) {
      return refuse("stale_command", "COLONY CHANGED · REVIEW AND TRY AGAIN");
    }
    const before = projectGalaxyRunToLegacyState(read.run);
    const after = colonyReducer(before, Events.buildingCommissioned({
      colonyId: quote.colonyId,
      buildingId: quote.buildingId,
      buildingType: quote.buildingType,
      costDeducted: { ...quote.cost },
      cyclesToBuild: quote.cyclesToBuild,
    }));
    if (!isExactCommissionChange(before.colonies, after.colonies, quote)) {
      return refuse("unauthorized_change", "COLONY RECORD REJECTED THE CHANGE");
    }
    const merged = mergeProjectionIntoGalaxy(read.run, { colonies: after.colonies });
    if (!merged.ok) return refuse("merge_failed", "COLONY RECORD REJECTED THE CHANGE");
    return { ok: true, save: { ...read.parent, galaxyRun: merged.galaxyRun }, buildingId: quote.buildingId };
  } catch {
    return refuse("run_unreadable", "GALAXY RUN COULD NOT BE READ");
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `npx tsx --test tests/colony/galaxyColonyManagement.test.ts tests/colony/galaxyColony.test.ts`
Expected: PASS (10 new, 9 GC1).

- [ ] **Step 5: Commit**

```bash
git add game/app/components/engine/galaxy/galaxyColonyManagement.ts game/tests/colony/galaxyColonyManagement.test.ts
git commit -m "feat(galaxy): validated colony commission command with stale and exact-change checks (GC2-A)"
```

---

### Task 3A: Stored-save persistence boundary (manager review correction 1)

**Files:**
- Modify: `game/app/components/engine/galaxy/galaxyColonyManagement.ts`
- Test: `game/tests/colony/galaxyColonyManagement.test.ts`

- [ ] **Step 1: Write the failing tests** (append; import `commitGalaxyColonyCommissionToStore`)

```ts
function memoryStore(initial: SaveData, fail: { read?: boolean; write?: boolean } = {}) {
  let stored = structuredClone(initial);
  const writes: SaveData[] = [];
  return {
    writes,
    stored: () => stored,
    store: {
      read: () => { if (fail.read) throw new SyntaxError("Unexpected token"); return structuredClone(stored); },
      write: (next: SaveData) => { if (fail.write) throw new Error("QuotaExceededError"); writes.push(next); stored = structuredClone(next); },
    },
  };
}

function screenQuote(metal: number) {
  const screen = parentFor(withMetal(atAshfall(), metal));
  return { screen, quote: ok(quoteGalaxyColonyCommission(screen, COLONY, "solar_array")).quote };
}

test("store commit uses the newer stored save and keeps its unrelated fields", () => {
  const { screen, quote } = screenQuote(80);
  const newer: SaveData = { ...screen, credits: 1234,
    galaxyRun: { ...screen.galaxyRun!, resources: { ...screen.galaxyRun!.resources, credits: 50 } } };
  const memory = memoryStore(newer);
  assert.equal(commitGalaxyColonyCommissionToStore(memory.store, quote).ok, true);
  assert.equal(memory.writes.length, 1);
  assert.equal(memory.stored().credits, 1234);
  assert.equal(memory.stored().galaxyRun!.resources.credits, 50);
  assert.equal(memory.stored().galaxyRun!.colonies.find(c => c.id === COLONY)!.buildings.length, 1);
});

test("store commit refuses a stale quote, writes nothing and returns the stored save", () => {
  const { screen, quote } = screenQuote(160);
  const elsewhere = ok(commitGalaxyColonyCommission(screen, quote)).save; // another tab built first
  const memory = memoryStore(elsewhere);
  const result = commitGalaxyColonyCommissionToStore(memory.store, quote);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "stale_command");
  assert.deepEqual(result.reconcile, elsewhere);
  assert.equal(memory.writes.length, 0);
});

test("store commit blocks unreadable storage and a save without a galaxy run", () => {
  const { screen, quote } = screenQuote(80);
  const unreadable = memoryStore(screen, { read: true });
  assert.deepEqual(commitGalaxyColonyCommissionToStore(unreadable.store, quote),
    { ok: false, reason: "storage_unreadable", message: "SAVE COULD NOT BE READ · NOTHING CHANGED", reconcile: null });
  const defaulted = memoryStore(migrateSave({})); // what a missing save key reads as
  const refused = commitGalaxyColonyCommissionToStore(defaulted.store, quote);
  assert.equal(refused.ok, false);
  if (!refused.ok) { assert.equal(refused.reason, "no_galaxy_run"); assert.equal(refused.reconcile, null); }
  assert.equal(unreadable.writes.length + defaulted.writes.length, 0);
});

test("a failed write changes nothing and offers nothing to adopt", () => {
  const { screen, quote } = screenQuote(80);
  const failing = memoryStore(screen, { write: true });
  assert.deepEqual(commitGalaxyColonyCommissionToStore(failing.store, quote),
    { ok: false, reason: "write_failed", message: "MANAGEMENT SAVE FAILED · NOTHING CHANGED", reconcile: null });
  assert.deepEqual(failing.stored(), screen);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx tsx --test tests/colony/galaxyColonyManagement.test.ts`
Expected: FAIL — `commitGalaxyColonyCommissionToStore` not exported.

- [ ] **Step 3: Add the boundary** (append to `galaxyColonyManagement.ts`; add
  `import type { CanonicalSaveStore } from "../missionOutcome";`)

```ts
/** Refusals that come from a readable galaxy save; only these may reconcile the UI. */
const RECONCILABLE: ReadonlySet<GalaxyCommissionRefusal> = new Set([
  "stale_command", "insufficient_resources", "no_buildable_slot", "access_unavailable", "unsupported_building",
]);

export type GalaxyCommissionStoreResult =
  | { ok: true; save: SaveData; buildingId: string }
  | {
      ok: false;
      reason: GalaxyCommissionRefusal | "storage_unreadable" | "write_failed";
      message: string;
      /** A readable stored galaxy save to adopt so the screen shows current state; null = adopt nothing. */
      reconcile: SaveData | null;
    };

/**
 * GC2-A persistence boundary. The stored save, not the session copy, is the authority: read it,
 * commit against that fresh parent, write, and let the caller adopt only after the write.
 * Read and write run in one synchronous call like the other canonical writers; no cross-tab
 * atomicity is claimed.
 */
export function commitGalaxyColonyCommissionToStore(
  store: CanonicalSaveStore,
  quote: GalaxyCommissionQuote,
): GalaxyCommissionStoreResult {
  let stored: SaveData;
  try { stored = store.read(); }
  catch {
    return { ok: false, reason: "storage_unreadable", message: "SAVE COULD NOT BE READ · NOTHING CHANGED", reconcile: null };
  }
  const result = commitGalaxyColonyCommission(stored, quote);
  if (!result.ok) return { ...result, reconcile: RECONCILABLE.has(result.reason) ? stored : null };
  try { store.write(result.save); }
  catch {
    return { ok: false, reason: "write_failed", message: "MANAGEMENT SAVE FAILED · NOTHING CHANGED", reconcile: null };
  }
  return result;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx tsx --test tests/colony/galaxyColonyManagement.test.ts`
Expected: PASS (14 tests).

- [ ] **Step 5: Commit**

```bash
git add game/app/components/engine/galaxy/galaxyColonyManagement.ts game/tests/colony/galaxyColonyManagement.test.ts
git commit -m "feat(galaxy): commit colony commissions against the stored save (GC2-A)"
```

---

### Task 4: Fresh-save route test through shipped authorities

**Files:**
- Create: `game/tests/colony/galaxyColonyManagementRoute.test.ts`

This proves the spec §6.1 route without UI: fresh run → travel → arrival → real galaxy survey →
POI outcome committed through the shipped authority (the same construction as
`tests/engine/missionOutcome.test.ts` `galaxyStageFixture`) → commission → real galaxy survey →
JSON reload → exterior map shows the operational Solar Array.

- [ ] **Step 1: Write the test**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { commitGalaxyColonyCommission, quoteGalaxyColonyCommission } from "../../app/components/engine/galaxy/galaxyColonyManagement";
import { createFreshGalaxyRun, startFreshGalaxy } from "../../app/components/engine/galaxy/galaxyRun";
import { projectGalaxyRunToLegacyState } from "../../app/components/engine/galaxy/galaxyProjection";
import { planRoute } from "../../app/components/engine/galaxy/routePlanner";
import { commitTravel, finalizeTravel, resumeTravelToBoundary } from "../../app/components/engine/galaxy/travelResolver";
import { startGalaxyRegionExpedition, stageGalaxyPoiOutcomeAuthority } from "../../app/components/engine/operations/operationAdapters";
import { dispatchPoi } from "../../app/components/colony/region/poiDispatcher";
import { poiOutcomeMissionId } from "../../app/components/engine/missionContext";
import { commitOutcome, createOutcomeEnvelope } from "../../app/components/engine/missionOutcome";
import { generateExteriorState } from "../../app/components/colony/exploration/colonyLayout";
import { SPRITES } from "../../app/components/engine/sprites";
import { migrateSave } from "../../app/components/engine/save";
import { GameScreen, type OutcomeAttempt, type SaveData } from "../../app/components/engine/types";

const COLONY = "galaxy:ashfall-primary";

function ok<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  assert.equal(result.ok, true, JSON.stringify(result));
  return result as Extract<T, { ok: true }>;
}

function arrivedAtAshfall(): SaveData {
  const fresh = createFreshGalaxyRun();
  const preview = planRoute(fresh, { kind: "contact", contactId: "contact:ashfall" });
  if (!preview.ok) throw new Error(preview.reasons.join("; "));
  const committed = ok(commitTravel(fresh, preview.plan)).galaxyRun;
  const arrived = ok(finalizeTravel(ok(resumeTravelToBoundary(committed)).galaxyRun)).galaxyRun;
  return { ...startFreshGalaxy(migrateSave({ credits: 4321, completedPlanets: ["pyraxis"] })), galaxyRun: arrived };
}

function survey(save: SaveData, nodeId: string): SaveData {
  return ok(startGalaxyRegionExpedition(save, "contact:ashfall", { kind: "survey", originColonyId: COLONY, targetNodeId: nodeId }, null)).save;
}

function clearCinderRelay(save: SaveData): SaveData {
  const run = save.galaxyRun!;
  const dispatched = dispatchPoi(projectGalaxyRunToLegacyState(run), COLONY, "ashfall-cinder-relay");
  if (!dispatched.ok) throw new Error("POI dispatch failed");
  const routeIdentity = {
    kind: "poi" as const, originColonyId: COLONY, nodeId: "ashfall-cinder-relay",
    engine: "firstPerson" as const, templateId: "fp-ruin-cinder-relay", rewardEligible: true,
  };
  const attempt: OutcomeAttempt = {
    version: 1,
    routeKind: "poi",
    missionId: poiOutcomeMissionId("poi:20:fp-ruin-cinder-relay:20:ashfall-cinder-relay", COLONY),
    routeIdentity,
    launchId: "gc2a-route-poi",
    expectedRevision: save.saveRevision,
    persistenceAuthority: "galaxy",
    returnTarget: "galaxy-region",
    declaredFields: ["galaxyRun"],
    launchSnapshot: { galaxyRun: structuredClone(run) },
  };
  const staged = stageGalaxyPoiOutcomeAuthority(save, { originColonyId: COLONY, session: dispatched.session }, GameScreen.LEVEL_COMPLETE, attempt);
  if (!staged.ok) throw new Error(`POI staging failed: ${staged.reason}`);
  let canonical = staged.save;
  const committed = commitOutcome({ read: () => canonical, write: next => { canonical = next; } },
    createOutcomeEnvelope(staged.attempt, "success", { version: 2, kind: "poi_result_v2", destinationColonyId: COLONY }));
  if (committed.status !== "committed") throw new Error(`POI commit failed: ${committed.status}`);
  return committed.save;
}

test("fresh run: travel, earn POI metal, commission, survey, reload, see the Solar Array", () => {
  let save = arrivedAtAshfall();
  save = survey(save, "ashfall-cinder-relay");
  save = clearCinderRelay(save);
  const colonyAfterPoi = save.galaxyRun!.colonies.find(c => c.id === COLONY)!;
  assert.equal(colonyAfterPoi.resources.metal, 80);

  // Compare legacy fields after the same reload normalization on both sides.
  const legacyOf = (value: SaveData): string => {
    const { galaxyRun: _run, ...legacy } = migrateSave(JSON.parse(JSON.stringify(value)));
    return JSON.stringify(legacy);
  };
  const legacyBefore = legacyOf(save);
  const quote = ok(quoteGalaxyColonyCommission(save, COLONY, "solar_array")).quote;
  save = ok(commitGalaxyColonyCommission(save, quote)).save;
  const cycleAtCommission = save.galaxyRun!.worldCycle;
  save = survey(save, "ashfall-oathbreaker-wreck");
  assert.equal(save.galaxyRun!.worldCycle, cycleAtCommission + 1);

  const reloaded = migrateSave(JSON.parse(JSON.stringify(save)));
  const colony = reloaded.galaxyRun!.colonies.find(c => c.id === COLONY)!;
  assert.deepEqual(colony.buildings.map(b => [b.type, b.status]), [["solar_array", "operational"]]);
  assert.equal(legacyOf(save), legacyBefore, "management and the survey change no legacy field");
  const exterior = JSON.stringify(generateExteriorState(colony, reloaded.gameClock));
  assert.ok(exterior.includes(SPRITES.COLONY_WALL_SOLAR), "the walk draws the Solar Array walls");
  assert.ok(exterior.includes('"door"'), "the operational Solar Array has a door");
});
```

- [ ] **Step 2: Run it**

Run: `npx tsx --test tests/colony/galaxyColonyManagementRoute.test.ts`
Expected: PASS. Any legacy difference is a defect — stop and report it; do not loosen the
comparison.

- [ ] **Step 3: Commit**

```bash
git add game/tests/colony/galaxyColonyManagementRoute.test.ts
git commit -m "test(galaxy): fresh-save colony management route through shipped authorities"
```

---

### Task 5: The galaxy management screen

**Files:**
- Modify: `game/app/components/colony/meta/ColonyCommissionMenu.tsx`
- Modify: `game/app/components/colony/meta/ColonyHeader.tsx`
- Create: `game/app/components/colony/meta/GalaxyColonyManagementScreen.tsx`
- Modify: `game/app/components/colony/meta/index.ts`
- Test: `game/tests/colony/galaxyColonyManagementScreen.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GalaxyColonyManagementScreen } from "../../app/components/colony/meta/GalaxyColonyManagementScreen";
import { ColonyCommissionMenu } from "../../app/components/colony/meta/ColonyCommissionMenu";
import { makeTestColony } from "./fixtures";

test("galaxy management shows only supported options, the status line and BACK", () => {
  const colony = makeTestColony({ resources: { food: 0, water: 0, metal: 80, credits: 0 } });
  const html = renderToStaticMarkup(React.createElement(GalaxyColonyManagementScreen, {
    colony, worldCycle: 4, supportedTypes: ["solar_array"], status: "SOLAR ARRAY COMMISSIONED · READY IN 1 CYCLE",
    onCommission: () => {}, onExit: () => {},
  }));
  assert.match(html, /aria-label="Colony management"/);
  assert.match(html, /☀ Solar Array/);
  assert.doesNotMatch(html, /⛏ Mine|🍺 Cantina|🌾 Farm|💧 Water Purifier|🏠 Habitat Module/);
  assert.match(html, /role="status"[^>]*>SOLAR ARRAY COMMISSIONED · READY IN 1 CYCLE</);
  assert.match(html, /← BACK/);
  assert.doesNotMatch(html, /RETURN TO COCKPIT|REGION — VIEW ONLY|SYSTEM MAP/);
});

test("legacy commission menu still offers every Phase-1 option", () => {
  const colony = makeTestColony({ resources: { food: 0, water: 0, metal: 500, credits: 0 } });
  const html = renderToStaticMarkup(React.createElement(ColonyCommissionMenu, { colony, onDispatch: () => {} }));
  for (const label of ["Solar Array", "Farm", "Water Purifier", "Habitat Module", "Mine", "Cantina"]) {
    assert.match(html, new RegExp(label));
  }
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx tsx --test tests/colony/galaxyColonyManagementScreen.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Menu props** — in `ColonyCommissionMenu.tsx`:

```ts
export interface ColonyCommissionMenuProps {
  colony: ColonyState;
  /** Legacy path: Build dispatches a reducer event. */
  onDispatch?: (event: ColonyEvent) => void;
  /** Options to offer. Defaults to every Phase-1 option (legacy). */
  options?: readonly BuildOption[];
  /** Galaxy path (GC2-A): Build calls this; no reducer event is dispatched. */
  onCommission?: (option: BuildOption) => void;
}
```

Change the signature to
`export function ColonyCommissionMenu({ colony, onDispatch, options = PHASE_1_BUILD_OPTIONS, onCommission }: ColonyCommissionMenuProps)`,
start `handleBuild` with `if (onCommission) { onCommission(opt); return; }`, call
`onDispatch?.(Events.buildingCommissioned({ ... }))` for the legacy path, and map `options`
instead of `PHASE_1_BUILD_OPTIONS` in the grid. Nothing else changes.

- [ ] **Step 4: Header label** — in `ColonyHeader.tsx` add `backLabel?: string` to the props,
  default it to `"← RETURN TO COCKPIT"`, and render `{backLabel}` in the back button.

- [ ] **Step 5: Create the screen**

```tsx
import React, { useRef } from "react";
import { useModalFocus } from "../../ui/ModalFocus";
import type { BuildingType, ColonyState } from "../shared/colonyTypes";
import { hudColors, hudFonts, hudSpacing } from "./hudTokens";
import { ColonyHeader } from "./ColonyHeader";
import { ColonyResourcePanel } from "./ColonyResourcePanel";
import { ColonyMetrics } from "./ColonyMetrics";
import { ColonyBuildingsList } from "./ColonyBuildingsList";
import { ColonyCommissionMenu, PHASE_1_BUILD_OPTIONS, type BuildOption } from "./ColonyCommissionMenu";

export interface GalaxyColonyManagementScreenProps {
  colony: ColonyState;
  worldCycle: number;
  supportedTypes: readonly BuildingType[];
  status: string | null;
  onCommission: (option: BuildOption) => void;
  onExit: () => void;
  focusActive?: boolean;
  onRestoreFocus?: () => void;
}

/**
 * GC2-A: colony management in a galaxy run. Reuses the legacy panels; Build goes through the
 * galaxy command boundary in Game.tsx, never through a reducer event.
 */
export function GalaxyColonyManagementScreen({
  colony, worldCycle, supportedTypes, status, onCommission, onExit, focusActive = true, onRestoreFocus,
}: GalaxyColonyManagementScreenProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  useModalFocus({ active: focusActive, rootRef, onEscape: onExit, restoreFocus: onRestoreFocus,
    initialFocus: () => rootRef.current?.querySelector<HTMLElement>("button:not([disabled])") ?? null });
  const options = PHASE_1_BUILD_OPTIONS.filter(option => supportedTypes.includes(option.type));
  return (
    <div ref={rootRef} role="dialog" aria-modal="true" aria-label="Colony management" tabIndex={-1}
      data-galaxy-colony-management style={{
        position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
        background: hudColors.deep, color: hudColors.textPrimary, fontFamily: hudFonts.mono,
        zIndex: 1200, overflow: "auto",
      }}>
      <ColonyHeader colony={colony} missionsSinceStart={worldCycle} onBack={onExit} backLabel="← BACK" />
      <p role="status" aria-live="polite" style={{
        margin: 0, padding: `0 ${hudSpacing.md}`, minHeight: 18, fontSize: "11px",
        letterSpacing: "0.1em", color: hudColors.cyanAccent,
      }}>{status ?? ""}</p>
      <ColonyResourcePanel colony={colony} />
      <ColonyMetrics colony={colony} />
      <ColonyBuildingsList colony={colony} />
      <ColonyCommissionMenu colony={colony} options={options} onCommission={onCommission} />
    </div>
  );
}
```

Add `export { GalaxyColonyManagementScreen } from "./GalaxyColonyManagementScreen";` to
`colony/meta/index.ts`.

- [ ] **Step 6: Run the tests**

Run: `npx tsx --test tests/colony/galaxyColonyManagementScreen.test.ts tests/colony/buildMenu.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add game/app/components/colony/meta game/tests/colony/galaxyColonyManagementScreen.test.ts
git commit -m "feat(colony): galaxy colony management screen over the existing panels (GC2-A)"
```

---

### Task 6: Entry buttons on the landing pad and in the Atlas

**Files:**
- Modify: `game/app/components/colony/exploration/exitMenu.tsx`
- Modify: `game/app/components/galaxy/GalaxyAtlasScreen.tsx`

- [ ] **Step 1: Landing pad** — add `onManageColony?: () => void` to `ExitMenuProps`, accept it in
  `LandingPadExitMenu`, and render it after REGION MAP with the REGION MAP button's style:

```tsx
{onManageColony && <button onClick={onManageColony} style={{ padding: "12px 24px", background: "rgba(0,240,255,.08)", color: tokens.cyan, border: `1px solid ${tokens.cyan}`, fontFamily: tokens.mono }}>COLONY MANAGEMENT</button>}
```

- [ ] **Step 2: Atlas** — add `onManageColony?: (colonyId: string) => void` to the props
  interface beside `onDescendToColony`, destructure it, import
  `galaxyColonyManagementAccess`, and derive beside `descendAccess`:

```ts
const manageAccess = galaxyColonyManagementAccess(run, descendColonyId);
const manageable = manageAccess.status === "full" && onManageColony !== undefined;
```

Inside the existing `descendColonyId !== null` block, after the descend note:

```tsx
<Button
  disabled={!manageable}
  aria-describedby={manageAccess.status === "unavailable" ? "atlas-manage-note" : undefined}
  onClick={() => onManageColony?.(descendColonyId)}
>
  MANAGE COLONY
</Button>
{manageAccess.status === "unavailable" && (
  <p id="atlas-manage-note" className="sz-atlas-note">{manageAccess.reason}</p>
)}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no errors (the props are optional; no caller passes them yet).

- [ ] **Step 4: Commit**

```bash
git add game/app/components/colony/exploration/exitMenu.tsx game/app/components/galaxy/GalaxyAtlasScreen.tsx
git commit -m "feat(galaxy): colony management entry buttons on the landing pad and Atlas (GC2-A)"
```

---

### Task 7: Wire management in Game.tsx

**Files:**
- Modify: `game/app/components/Game.tsx`

Anchors below are code strings in the current file; line numbers move.

- [ ] **Step 1: Imports**

```ts
import { GalaxyColonyManagementScreen } from "./colony/meta/GalaxyColonyManagementScreen";
import type { BuildOption } from "./colony/meta/ColonyCommissionMenu";
import {
  GALAXY_COMMISSION_TYPES,
  commitGalaxyColonyCommissionToStore,
  galaxyColonyManagementAccess,
  quoteGalaxyColonyCommission,
  type GalaxyCommissionQuote,
} from "./engine/galaxy/galaxyColonyManagement";
```

- [ ] **Step 2: State** — next to the `regionMapSurface` state:

```ts
type GalaxyManagementSurface = { colonyId: string; source: "atlas" | "landing-pad"; status: string | null };
const [galaxyManagement, setGalaxyManagement] = useState<GalaxyManagementSurface | null>(null);
const galaxyManagementInvokerRef = useRef<HTMLElement | null>(null);
```

- [ ] **Step 3: Handlers** — after `handleGalaxyDescend`:

```ts
const handleOpenGalaxyManagement = useCallback((colonyId: string, source: "atlas" | "landing-pad") => {
  // Re-derive access: only a vessel parked at the colony's contact may manage it.
  const access = galaxyColonyManagementAccess(saveDataRef.current.galaxyRun, colonyId);
  if (access.status === "unavailable") {
    if (source === "atlas") setAtlasStatusMessage(`MANAGEMENT UNAVAILABLE · ${access.reason}`);
    return;
  }
  galaxyManagementInvokerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  clearHeldInput(); // management owns input from this frame; nothing held carries in or out
  if (source === "landing-pad") setExitMenuOpen(false);
  setGalaxyManagement({ colonyId, source, status: null });
}, [clearHeldInput]);

const handleCloseGalaxyManagement = useCallback(() => {
  const surface = galaxyManagement;
  clearHeldInput();
  setGalaxyManagement(null);
  if (surface?.source === "landing-pad") setExitMenuOpen(true);
}, [clearHeldInput, galaxyManagement]);

// The stored save is the authority, not the session ref (manager review, correction 1). Same
// store shape as `outcomeStore`, but the write does not adopt; the handler adopts after it.
const managementStore = useMemo<CanonicalSaveStore>(() => ({ read: readCanonicalSaveStrict, write: saveSave }), []);

const handleGalaxyCommission = useCallback((quote: GalaxyCommissionQuote) => {
  if (persistenceNavigationLocked) return;
  const result = commitGalaxyColonyCommissionToStore(managementStore, quote);
  if (!result.ok) {
    // Show the stored state and the reason. The click is never re-priced and retried.
    if (result.reconcile) adoptCanonicalSave(result.reconcile);
    setGalaxyManagement(current => current && { ...current, status: result.message });
    return;
  }
  adoptCanonicalSave(result.save); // already written
  const label = quote.buildingType.replaceAll("_", " ").toUpperCase();
  const cycles = `${quote.cyclesToBuild} CYCLE${quote.cyclesToBuild === 1 ? "" : "S"}`;
  setGalaxyManagement(current => current && { ...current, status: `${label} COMMISSIONED · READY IN ${cycles}` });
}, [adoptCanonicalSave, managementStore, persistenceNavigationLocked]);
```

`readCanonicalSaveStrict`, `saveSave` and `CanonicalSaveStore` are already imported in `Game.tsx`.

If `persistenceNavigationLocked` is declared below this point, move these handlers below its
declaration (it is a plain derived value; follow the placement of other handlers that read it).

- [ ] **Step 3A: Input ownership (manager review, correction 2)** — opening management closes
  `exitMenuOpen`, so both walk guards must name `galaxyManagement`:
  - `canvasInputBlocked`: change the last line to `!!pendingPoiResolution || exitMenuOpen || !!galaxyManagement;`
    so the input context is `blocked` while the dialog is open.
  - The colony loop: `(exitMenuOpen || regionMapSurface || galaxyManagement)` in the
    `effectiveKeys` condition.
  - Add `galaxyManagement` to both effect dependency lists that already hold
    `exitMenuOpen, regionMapSurface` (the keyboard effect and the frame-loop effect), so neither
    keeps a stale closure.
  - Backstop for every other open or close route (Step 7 clears, POI mounts):

```ts
const galaxyManagementOpen = galaxyManagement !== null;
useEffect(() => { clearHeldInput(); }, [galaxyManagementOpen, clearHeldInput]);
```

  The persistence lock and focus rules stay as they are: Step 6 keeps `focusActive` and `onExit`
  behind `persistenceNavigationLocked`.

- [ ] **Step 4: Quotes in render** — near `colonyEngineSave`:

```ts
// GC2-A: quotes come from the rendered canonical save; commit re-derives them, so a click on
// an outdated screen is refused as stale.
const galaxyManagementColony = galaxyManagement === null
  ? null
  : saveData.galaxyRun?.colonies.find(colony => colony.id === galaxyManagement.colonyId) ?? null;
const galaxyManagementQuotes = useMemo(() => {
  if (galaxyManagement === null) return new Map<string, ReturnType<typeof quoteGalaxyColonyCommission>>();
  return new Map(GALAXY_COMMISSION_TYPES.map(type =>
    [type, quoteGalaxyColonyCommission(saveData, galaxyManagement.colonyId, type)] as const));
}, [galaxyManagement, saveData]);
const handleGalaxyManagementBuild = useCallback((option: BuildOption) => {
  const quoted = galaxyManagementQuotes.get(option.type);
  if (!quoted) return;
  if (!quoted.ok) {
    setGalaxyManagement(current => current && { ...current, status: quoted.message });
    return;
  }
  handleGalaxyCommission(quoted.quote);
}, [galaxyManagementQuotes, handleGalaxyCommission]);
```

- [ ] **Step 5: Entry wiring**
  - `GalaxyAtlasScreen`: add `onManageColony={(colonyId) => handleOpenGalaxyManagement(colonyId, "atlas")}`
    beside `onDescendToColony`.
  - `LandingPadExitMenu`: add
    `onManageColony={galaxyColonyId !== null ? () => { if (!persistenceNavigationLocked) handleOpenGalaxyManagement(galaxyColonyId, "landing-pad"); } : undefined}`.
    Legacy walks keep `undefined`, so their menu is unchanged.
  - Add `!galaxyManagement` to the `focusActive` expression of `LandingPadExitMenu`.
  - Opening management from the Atlas must behave like opening the Region from the Atlas: the
    Atlas stays mounted, the new dialog owns focus and Escape, and Escape closes only the
    management dialog. Find how `GalaxyAtlasScreen` yields to `regionMapSurface` and treat
    `galaxyManagement` the same way.

- [ ] **Step 6: Mount** — after the `RegionMapScreen` block:

```tsx
{galaxyManagement && galaxyManagementColony && saveData.galaxyRun && (
  <GalaxyColonyManagementScreen
    colony={galaxyManagementColony}
    worldCycle={saveData.galaxyRun.worldCycle}
    supportedTypes={GALAXY_COMMISSION_TYPES}
    status={galaxyManagement.status}
    onCommission={handleGalaxyManagementBuild}
    onExit={() => { if (!persistenceNavigationLocked) handleCloseGalaxyManagement(); }}
    focusActive={!pendingPoiPresentation && !persistenceNavigationLocked}
    onRestoreFocus={() => {
      const invoker = galaxyManagementInvokerRef.current;
      if (invoker?.isConnected && invoker.getClientRects().length) invoker.focus();
    }}
  />
)}
```

- [ ] **Step 7: Clear on route change** — wherever `setRegionMapSurface(null)` runs because the
  player leaves the colony or Atlas (descend, take off, POI launch, outcome mounts), also call
  `setGalaxyManagement(null)`. Search: `setRegionMapSurface(null)`. The Step 3A effect clears
  held input on each of these closes.

- [ ] **Step 8: Type-check and run units**

Run: `npx tsc --noEmit -p . && npx tsx --test tests/colony/*.test.ts tests/engine/*.test.ts tests/sprites/*.test.ts`
Expected: no type errors; all unit tests pass (951 + new).

- [ ] **Step 9: Commit**

```bash
git add game/app/components/Game.tsx
git commit -m "feat(galaxy): open Ashfall management from the landing pad and Atlas (GC2-A)"
```

---

### Task 8: Browser acceptance

**Files:**
- Create: `game/tests/browser/galaxyColonyManagement.spec.ts`
- Modify: `game/tests/browser/touchGameplay.spec.ts` (held-input scenarios, Step 1A)

- [ ] **Step 1: Write the spec**

```ts
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import type { SaveData } from "../../app/components/engine/types";
import { freshGalaxy, galaxyAtAshfall, galaxyWithLegacyProgression, pendingGalaxyPoiReturn } from "./fixtures/routeFixtures";
import { attachBrowserReceipt } from "./helpers/receipt";
import { installSaveFixture, readInstalledSave, readInstalledSaveBytes, readLegacyDomainBytes } from "./helpers/saveFixture";

const COLONY = "galaxy:ashfall-primary";
type Method = "keyboard" | "pointer";

async function activate(page: Page, target: Locator, method: Method) {
  await expect(target).toBeEnabled();
  if (method === "pointer") { await target.click(); return; }
  await target.focus();
  await expect(target).toBeFocused();
  await page.keyboard.press("Enter");
}

async function openLandingPadMenu(page: Page) {
  const interact = page.getByRole("group", { name: "Colony controls", exact: true })
    .getByRole("button", { name: "Interact", exact: true });
  await interact.focus();
  await page.keyboard.down("Enter");
  await page.waitForTimeout(100); // A native hold spans the canvas input sampling frame.
  await page.keyboard.up("Enter");
  const menu = page.getByRole("dialog", { name: "Landing pad exit menu", exact: true });
  await expect(menu).toBeVisible();
  return menu;
}

function ashfall(save: SaveData) {
  const colony = save.galaxyRun?.colonies.find(entry => entry.id === COLONY);
  if (!colony) throw new Error("Ashfall Primary is missing");
  return colony;
}

async function evidence(page: Page, info: TestInfo, method: Method, fixture: string, route: string, observed: string) {
  const path = info.outputPath("galaxy-colony-management.png");
  await page.screenshot({ path });
  await info.attach("galaxy-colony-management", { path, contentType: "image/png" });
  await attachBrowserReceipt(info, {
    inputMethod: method, saveFixture: fixture, route,
    expectedOutcome: "A vessel parked at Ashfall commissions a Solar Array through the galaxy command boundary, a region survey finishes it, and it survives reload without touching Legacy progression.",
    observedOutcome: observed,
  });
}

test("@keyboard commission a Solar Array, finish it with a survey, and keep it through reload", async ({ page }, info) => {
  test.setTimeout(120_000);
  await installSaveFixture(page, galaxyWithLegacyProgression(pendingGalaxyPoiReturn()));
  await page.goto("/");
  const region = page.getByRole("dialog", { name: "Region map", exact: true });
  await expect(region).toBeVisible();
  await expect.poll(async () => (await readInstalledSave(page)).outcomeRecoveryRecords
    .some(record => record.kind === "applied_return" && record.returnPending)).toBe(false);
  const legacy = await readLegacyDomainBytes(page);
  const start = await readInstalledSave(page);
  expect(ashfall(start).resources.metal).toBe(80);
  expect(ashfall(start).buildings).toHaveLength(0);

  await region.getByRole("option").first().focus();
  await page.keyboard.press("Escape");
  const atlas = page.getByRole("dialog", { name: "Galaxy Atlas", exact: true });
  await expect(atlas).toBeVisible();
  await activate(page, atlas.getByRole("button", { name: "DESCEND TO COLONY", exact: true }), "keyboard");
  await expect(atlas).toBeHidden();

  let menu = await openLandingPadMenu(page);
  await activate(page, menu.getByRole("button", { name: "COLONY MANAGEMENT", exact: true }), "keyboard");
  const manage = page.getByRole("dialog", { name: "Colony management", exact: true });
  await expect(manage).toBeVisible();
  await activate(page, manage.getByRole("button", { name: "Build", exact: true }), "keyboard");
  await expect(manage.getByRole("status")).toHaveText("SOLAR ARRAY COMMISSIONED · READY IN 1 CYCLE");
  const commissioned = await readInstalledSave(page);
  expect(ashfall(commissioned).resources.metal).toBe(0);
  expect(ashfall(commissioned).buildings).toEqual([
    expect.objectContaining({ type: "solar_array", status: "constructing", buildProgressCycles: 1 }),
  ]);
  expect(commissioned.galaxyRun!.worldCycle).toBe(start.galaxyRun!.worldCycle);
  expect(await readLegacyDomainBytes(page)).toBe(legacy);

  await page.keyboard.press("Escape");
  await expect(manage).toBeHidden();
  menu = page.getByRole("dialog", { name: "Landing pad exit menu", exact: true });
  await expect(menu).toBeVisible();
  await activate(page, menu.getByRole("button", { name: "REGION MAP", exact: true }), "keyboard");
  await expect(region).toBeVisible();
  await activate(page, region.getByRole("option", { name: "Oathbreaker Wreck, rumored", exact: true }), "keyboard");
  await activate(page, region.getByRole("button", { name: "Survey Oathbreaker Wreck", exact: true }), "keyboard");
  await expect(region.getByRole("option", { name: "Oathbreaker Wreck, surveyed", exact: true })).toBeVisible();
  const surveyed = await readInstalledSave(page);
  expect(surveyed.galaxyRun!.worldCycle).toBe(start.galaxyRun!.worldCycle + 1);
  expect(ashfall(surveyed).buildings[0]).toMatchObject({ status: "operational", buildProgressCycles: 0 });

  await page.keyboard.press("Escape");
  await expect(menu).toBeVisible();
  await activate(page, menu.getByRole("button", { name: "Take Off", exact: true }), "keyboard");
  await expect(atlas).toBeVisible();

  await page.reload();
  await activate(page, page.getByRole("button", { name: "CONTINUE GALAXY", exact: true }), "keyboard");
  await expect(atlas).toBeVisible();
  expect(ashfall(await readInstalledSave(page)).buildings[0]).toMatchObject({ type: "solar_array", status: "operational" });
  await activate(page, atlas.getByRole("button", { name: "DESCEND TO COLONY", exact: true }), "keyboard");
  menu = await openLandingPadMenu(page);
  await activate(page, menu.getByRole("button", { name: "COLONY MANAGEMENT", exact: true }), "keyboard");
  await expect(manage.getByText("operational", { exact: true })).toBeVisible();
  expect(await readLegacyDomainBytes(page)).toBe(legacy);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await evidence(page, info, "keyboard", "pendingGalaxyPoiReturn (committed through shipped POI authority) + populated Legacy progression",
    "Region -> Atlas -> DESCEND -> landing pad -> COLONY MANAGEMENT -> Build -> REGION MAP -> Survey Oathbreaker Wreck -> Take Off -> reload -> CONTINUE GALAXY -> DESCEND -> COLONY MANAGEMENT",
    "Build spent 80 metal without a cycle, the survey advanced one cycle and finished the Solar Array, and reload kept it operational with Legacy bytes unchanged.");
});

test("@pointer MANAGE COLONY is disabled until the vessel parks at Ashfall", async ({ page }, info) => {
  await installSaveFixture(page, freshGalaxy);
  await page.goto("/");
  await page.getByRole("button", { name: "CONTINUE GALAXY", exact: true }).click();
  const atlas = page.getByRole("dialog", { name: "Galaxy Atlas", exact: true });
  const before = await readInstalledSaveBytes(page);
  await atlas.locator('[data-atlas-contact="contact:ashfall"]').click();
  await expect(atlas.getByRole("button", { name: "MANAGE COLONY", exact: true })).toBeDisabled();
  await expect(atlas.locator("#atlas-manage-note")).toHaveText("ARRIVE AT ASHFALL FIRST");
  expect(await readInstalledSaveBytes(page)).toBe(before);
  await evidence(page, info, "pointer", "freshGalaxy", "Atlas -> select Ashfall",
    "MANAGE COLONY is disabled with ARRIVE AT ASHFALL FIRST while the vessel is at Vanguard.");
});

test("@pointer a parked vessel opens management, and an unaffordable build writes nothing", async ({ page }, info) => {
  await installSaveFixture(page, galaxyAtAshfall);
  await page.goto("/");
  await page.getByRole("button", { name: "CONTINUE GALAXY", exact: true }).click();
  const atlas = page.getByRole("dialog", { name: "Galaxy Atlas", exact: true });
  const before = await readInstalledSaveBytes(page);
  const open = atlas.getByRole("button", { name: "MANAGE COLONY", exact: true });
  await open.click();
  const manage = page.getByRole("dialog", { name: "Colony management", exact: true });
  await expect(manage).toBeVisible();
  await expect(manage.getByRole("button", { name: "Need 80 more metal", exact: true })).toBeDisabled();
  expect(await readInstalledSaveBytes(page)).toBe(before);
  await page.keyboard.press("Escape");
  await expect(manage).toBeHidden();
  await expect(open).toBeFocused();
  await evidence(page, info, "pointer", "galaxyAtAshfall", "Atlas -> MANAGE COLONY -> Escape",
    "Management opened from the Atlas with 0 metal; Build stayed disabled with the shortfall, nothing was written, and focus returned to MANAGE COLONY.");
});
```

- [ ] **Step 1A: Held-input scenarios (manager review, correction 2)** — append to
  `touchGameplay.spec.ts`, which already owns the frame observation (`installObservation`,
  `frames`, `still`, `center`, `Fingers`, `withFingers`, `action`, `receipt`), so no helper moves.

```ts
// GC2-A: the management dialog owns input. Nothing held before, during or after it may move the
// walker, fire, open another menu or carry into the walk until a fresh input.
async function descendAtAshfall(page: Page, method: "keyboard" | "touch") {
  await installObservation(page);
  await installSaveFixture(page, galaxyAtAshfall);
  await page.goto("/");
  for (const label of ["CONTINUE GALAXY", "DESCEND TO COLONY"]) {
    if (method === "touch") await action(page, label).tap();
    else { await action(page, label).focus(); await page.keyboard.press("Enter"); }
  }
  return {
    controls: page.getByRole("group", { name: "Colony controls", exact: true }),
    menu: page.getByRole("dialog", { name: "Landing pad exit menu", exact: true }),
    manage: page.getByRole("dialog", { name: "Colony management", exact: true }),
  };
}

async function walkIsInert(page: Page, menu: Locator) {
  const observed = await frames(page, "fp", 30);
  still(observed, "fp");
  expect(observed.some(frame => frame.gun), "no fire").toBe(false);
  await expect(menu).toBeHidden();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test("@keyboard held movement and interact do not cross colony management", async ({ page }, testInfo) => {
  const { controls, menu, manage } = await descendAtAshfall(page, "keyboard");
  await controls.getByRole("button", { name: "Interact", exact: true }).focus();
  await page.keyboard.down("Enter"); await page.waitForTimeout(100); await page.keyboard.up("Enter");
  await menu.getByRole("button", { name: "COLONY MANAGEMENT", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(manage).toBeVisible();
  await page.keyboard.down("w"); // move-up, held through the dialog
  await page.keyboard.down("z"); // primary (interact), held through the dialog
  still(await frames(page, "fp", 30), "fp");
  await page.keyboard.press("Escape"); // management -> landing pad menu
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape"); // menu -> walk
  await walkIsInert(page, menu);
  await page.keyboard.up("z"); await page.keyboard.up("w");
  await page.keyboard.down("w"); // a fresh press moves
  const fresh = await frames(page, "fp", 30);
  await page.keyboard.up("w");
  expect(Math.hypot(fresh.at(-1)!.fp!.x - fresh[0].fp!.x, fresh.at(-1)!.fp!.y - fresh[0].fp!.y)).toBeGreaterThan(0.05);
  await receipt(page, testInfo, "Atlas -> DESCEND -> Interact -> COLONY MANAGEMENT -> hold W+Z -> Escape x2", "galaxyAtAshfall",
    "Keys held across management neither move, fire nor reopen a menu; a fresh W moves.", "keyboard");
});

test("@touch a held colony gesture does not cross colony management", async ({ page }, testInfo) => {
  const { controls, menu, manage } = await descendAtAshfall(page, "touch");
  const interact = controls.getByRole("button", { name: "Interact", exact: true });
  const forward = await center(controls.getByRole("button", { name: "Move forward", exact: true }));
  await withFingers(page, async (fingers) => {
    await fingers.down(1, interact); // held from before the menu to after the walk resumes
    await expect(menu).toBeVisible();
    await fingers.tap(2, menu.getByRole("button", { name: "COLONY MANAGEMENT", exact: true }));
    await expect(manage).toBeVisible();
    still(await frames(page, "fp", 30), "fp");
    await fingers.tap(2, manage.getByRole("button", { name: "← BACK", exact: true }));
    await expect(menu).toBeVisible();
    await fingers.tap(2, menu.getByRole("button", { name: "Resume", exact: true }));
    await fingers.move(1, forward); // the old finger slides onto movement
    await walkIsInert(page, menu);
    await fingers.up(1);
    await fingers.tap(1, interact); // a fresh tap still works
    await expect(menu).toBeVisible();
  });
  await receipt(page, testInfo, "Atlas -> DESCEND -> hold Interact -> COLONY MANAGEMENT -> BACK -> Resume -> slide to Move forward",
    "galaxyAtAshfall", "A finger held across management neither moves, fires nor reopens the menu; a fresh tap opens it.");
});
```

  `receipt` takes `"touch" | "pointer"` today; widen it to include `"keyboard"`.

- [ ] **Step 2: Build and run the galaxy specs**

Run: `NEXT_PUBLIC_DEVTOOLS=1 yarn build`, then the browser command from the top of this plan,
plus `touchGameplay.spec.ts`.
Expected: the 3 new tests, the 2 held-input tests and the 6 GC1 tests pass in their projects.
Prove the held-input tests can fail: locally remove the two Step 3A guard terms, see both tests
fail (the walk moves or acts behind the dialog), restore them, and record the red run in the
handback. Do not commit the removal. Where a locator does not
match the real markup (for example the Escape that closes the region), fix the test to the real
UI and record the change in the handback; do not change gameplay to fit a test.

- [ ] **Step 3: Commit**

```bash
git add game/tests/browser/galaxyColonyManagement.spec.ts game/tests/browser/touchGameplay.spec.ts
git commit -m "test(browser): galaxy colony management route, gating and refusal (GC2-A)"
```

---

### Task 9: Full verification and handback

- [ ] **Step 1:** `npx tsc --noEmit -p .` — no errors.
- [ ] **Step 2:** all three unit suites — 0 failures; note the new count.
- [ ] **Step 3:** `NEXT_PUBLIC_DEVTOOLS=1 yarn build` — static export succeeds.
- [ ] **Step 4:** full browser suite once (`--config playwright.static.config.ts --workers=1
  --retries=0`) — record passed/failed counts from the log.
- [ ] **Step 5:** add a "GC2-A as built" section to
  `docs/superpowers/specs/2026-10-18-gc2a-galaxy-colony-management-design.md` (what shipped,
  any test-to-markup adjustments, open defects).
- [ ] **Step 6:** commit the docs; do not push or merge.
- [ ] **Step 7:** hand back to the Codex Manager: commits, counts, screenshot path, and the
  §6.1 human route for acceptance.

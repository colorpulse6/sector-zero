# G0 Continuous Galaxy Atlas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a fresh, deterministic G0 galaxy run in which the captain can explore a continuous local sector, commit idempotent supply-and-time travel, and launch the existing hostile-picket shooter, Kepler, and Ashfall content as located operations without changing preserved legacy progression.

**Architecture:** Add a nullable `GalaxyRunState` namespace beside the legacy save, then keep coordinates, Atlas generation, route planning, travel mutation, operation adapters, and UI projection in separate pure modules. Existing engines receive a transient allowlisted `SaveData` projection built only from `GalaxyRunState`; their results merge back only into the galaxy namespace. `GalaxyAtlasScreen` owns a mount-time Canvas 2D field plus equivalent focusable DOM controls, while `Game.tsx` remains a thin surface/engine orchestrator.

**Tech Stack:** Next.js 15 static export, React 19, strict TypeScript, Canvas 2D, existing shooter/first-person/planet/colony engines, Node `tsx --test` flat test files.

---

## Authority and fixed decisions

- Implement only G0 from `docs/superpowers/specs/2026-07-16-continuous-galaxy-atlas-design.md`; generations, Houses, deep stasis, autonomous politics, full galaxy simulation, and final Atlas art remain deferred.
- Preserve the existing W1-W8 campaign and its save fields as a selectable legacy experience. No G0 screen presents W1-W8 as canonical progression.
- A fresh galaxy run never reads legacy credits, XP, upgrades, unlocks, completions, colonies, factions, or story state. `activeExperience` is a selector, not a migration of history.
- The deterministic post-prologue G0 factory owns a new Ashfall Primary at the existing `ashfall-forward-camp` anchor. This is a fresh galaxy asset, not an import; it is required to expose the already-approved M1 region/POI loop and route cargo through `missionDelivery.ts`.
- Travel uses one abstract supply pool. The preview is pure; the saved commitment is journaled and idempotent. Each leg advances its promised cycle once through the existing colony cycle boundary.
- Existing gameplay constructors and framebuffer behavior remain unchanged. Launch adapters provide context; renderers and engines do not learn Atlas rules.
- No module touches `window`, `document`, Canvas, WebGL, wall-clock time, or unseeded randomness at module scope.
- No new raster assets or sprite registrations are part of G0.
- Execute runtime work only after this docs branch lands on `main`, on a fresh
  `feat/g0-galaxy-atlas` branch in its own worktree. Do not implement G0 on the docs PR
  branch and do not merge the implementation PR without explicit approval.

## File structure

### New engine domain

| File | Responsibility |
|---|---|
| `game/app/components/engine/galaxy/galaxyTypes.ts` | Serializable galaxy, Atlas, knowledge, threat, route, vessel, and travel contracts. |
| `game/app/components/engine/galaxy/coordinates.ts` | Safe-integer validation, cell addressing, stable IDs, distance, and projection-neutral coordinate helpers. |
| `game/app/components/engine/galaxy/authoredAnchors.ts` | Versioned G0 anchor registry: Vanguard, Ashfall, Kepler, hostile picket, and unresolved signal. |
| `game/app/components/engine/galaxy/atlas.ts` | Pure cell seeding, latent facts, authored reservation, materialization, knowledge promotion, and blind survey results. |
| `game/app/components/engine/galaxy/galaxyRun.ts` | Fresh-run factory, field-by-field nested migration, experience selection, and deterministic transaction ordinals. |
| `game/app/components/engine/galaxy/galaxyProjection.ts` | Transient legacy-engine projection, allowlisted merge, and galaxy-only world-cycle advancement. |
| `game/app/components/engine/galaxy/routePlanner.ts` | Pure direct/relay route preview, supply/time cost, threat bands, confidence, and block reasons. |
| `game/app/components/engine/galaxy/travelResolver.ts` | Journaled commitment reducer, checkpoint replay protection, arrival/diversion/interruption, and resume. |
| `game/app/components/engine/galaxy/experienceFlow.ts` | Pure begin/resume, surface routing, and legacy-snapshot helpers used by `Game.tsx`. |

### New operation domain

| File | Responsibility |
|---|---|
| `game/app/components/engine/operations/operationTypes.ts` | Located operation, launch payload, modifier, typed engine result, normalized outcome, and validation contracts. |
| `game/app/components/engine/operations/operationCatalog.ts` | G0 operation definitions and availability from galaxy truth only. |
| `game/app/components/engine/operations/operationAdapters.ts` | Convert an authorized operation into an existing engine state; wrap Ashfall region/POI calls through the projection boundary. |
| `game/app/components/engine/operations/operationOutcome.ts` | Idempotently fold material, knowledge, access, pilot, cargo, and unique history facts into `GalaxyRunState`. |

### New React surface

| File | Responsibility |
|---|---|
| `game/app/components/galaxy/atlasViewport.ts` | Pure pan/zoom, world-to-screen projection, hit selection, coordinate normalization, and keyboard/touch control math. |
| `game/app/components/galaxy/GalaxyAtlasScreen.tsx` | Canvas field plus DOM contact list, coordinate form, route panel, warnings, commitment, operation, and Ashfall-region controls. |
| `game/app/components/galaxy/GalaxyExperienceGate.tsx` | Explicit `BEGIN/CONTINUE GALAXY` and `LEGACY CAMPAIGN` entry controls. |
| `game/app/components/galaxy/devFixtures.ts` | Fixed Atlas, safe route, hostile route, blind result, insufficient supply, and interrupted-reload fixtures. |
| `game/app/components/galaxy/index.ts` | Public UI exports only. |

### Existing integration files

| File | Change |
|---|---|
| `game/app/components/engine/types.ts:1066` | Add `ExperienceMode`, `activeExperience`, and nullable `galaxyRun`; do not move legacy fields. |
| `game/app/components/engine/save.ts:36-129` | Fresh defaults and explicit `??` migration calls for the two new fields. |
| `game/app/components/Game.tsx:88-2241` | Wire the experience gate, Atlas surface, travel/operation callbacks, galaxy completion path, and projected Ashfall region flow. |
| `game/app/components/DevPanel.tsx:1-260` | Add fixed `GALAXY SEEDS` buttons. |
| `game/app/components/colony/shared/missionDelivery.ts` | No behavior rewrite; call its existing explicit destination path from the galaxy adapter. |
| `game/tests/colony/fixtures.ts` and direct `SaveData` literals | Add `activeExperience: "legacy"` and `galaxyRun: null`. |

## Core contracts to implement

Use these shapes as the serialization boundary. Smaller helper types may be added, but fields must not be removed or replaced by legacy aliases.

```ts
export type ExperienceMode = "legacy" | "galaxy";
export type KnowledgeState = "unknown" | "signal" | "charted" | "visited" | "lost_contact";
export type AtlasViewLevel = "galaxy" | "sector" | "system" | "region";
export type ThreatDimension = "military" | "political" | "environmental" | "logistical" | "anomalous";
export type ThreatBand = "low" | "moderate" | "high" | "severe" | "unknown";

export interface GalaxyCoordinate {
  sectorX: number;
  sectorY: number;
  localX: number;
  localY: number;
}

export interface AtlasGenerationIdentity {
  galaxySeed: string;
  generationVersion: number;
  authoredAnchorRegistryVersion: number;
}

export type KnowledgeSource = "sensor" | "report" | "rumor" | "archive" | "ally" | "direct_visit" | "authored";
export type KnowledgeConfidence = "low" | "medium" | "high";

export interface AtlasCellFact {
  id: string;
  cellKey: string;
  coordinate: GalaxyCoordinate;
  kind: "empty" | "stellar_contact" | "hazard" | "ruin" | "anomaly" | "signal";
  contactId: string | null;
  stableSeed: number;
  authored: boolean;
}

export interface AtlasKnowledgeRecord {
  id: string;
  subjectId: string;
  state: KnowledgeState;
  observedProperties: Record<string, string | number | boolean | null>;
  confidence: KnowledgeConfidence;
  source: KnowledgeSource;
  observedCycle: number;
  expiresCycle: number | null;
}

export interface AccessFact {
  id: string;
  subjectId: string;
  assessment: "reachable" | "contested" | "secured" | "denied" | "disrupted";
  causeFactIds: string[];
  cycle: number;
}

export interface ThreatObservation {
  id: string;
  subjectId: string;
  dimension: ThreatDimension;
  band: ThreatBand;
  confidence: KnowledgeConfidence;
  source: KnowledgeSource;
  observedCycle: number;
}

export interface RouteLeg {
  id: string;
  from: GalaxyCoordinate;
  to: GalaxyCoordinate;
  distanceUnits: number;
  cycles: number;
  supplyCost: number;
  interruptionCauseId: string | null;
}

export interface GalaxyResources {
  supply: number;
  credits: number;
  materials: MaterialId[];
}

export interface GalaxyShipState {
  upgrades: ShipUpgrades;
  unlockedEnhancements: EnhancementId[];
  equippedWeaponType: WeaponType;
  consumableInventory: Partial<Record<ConsumableId, number>>;
  equippedConsumables: ConsumableId[];
}

export interface GalaxyPilotState {
  xp: number;
  level: number;
  skillPoints: number;
  allocatedSkills: SkillNodeId[];
  bestiary: Partial<Record<EnemyType, BestiaryEntry>>;
}

export interface GalaxyVesselState {
  status: "stationary" | "in_transit" | "stranded";
  coordinate: GalaxyCoordinate;
  contactId: string | null;
  transitTransactionId: string | null;
}

export interface GalaxyAtlasState {
  materializedFacts: Record<string, AtlasCellFact>;
  knowledge: Record<string, AtlasKnowledgeRecord>;
  mappedCellKeys: string[];
  accessFacts: AccessFact[];
  threatObservations: ThreatObservation[];
}

export interface GalaxyOperationRecord {
  state: "available" | "accepted" | "active" | "complete" | "failed" | "expired";
  acceptedCycle: number | null;
  resolvedCycle: number | null;
  completionIds: string[];
}

export interface GalaxyCodexState {
  unlocked: string[];
  viewed: string[];
}

export interface HistoricalFact {
  id: string;
  kind: string;
  subjectId: string;
  cycle: number;
  causeFactIds: string[];
}

export interface TravelCommitment {
  transactionId: string;
  state: "committed" | "advancing" | "interrupted" | "arrived" | "diverted" | "resolved";
  routePlanId: string;
  origin: GalaxyCoordinate;
  destination: GalaxyCoordinate;
  targetId: string | null;
  legs: RouteLeg[];
  nextLegIndex: number;
  appliedCheckpointIds: string[];
  supplyCost: number;
  elapsedCycles: number;
  interruptionOperationId: string | null;
}

export interface GalaxyRunState {
  identity: AtlasGenerationIdentity;
  worldCycle: number;
  nextTransactionOrdinal: number;
  resources: GalaxyResources;
  ship: GalaxyShipState;
  pilot: GalaxyPilotState;
  codex: GalaxyCodexState;
  storyItems: StoryItemId[];
  vessel: GalaxyVesselState;
  atlas: GalaxyAtlasState;
  operations: Record<string, GalaxyOperationRecord>;
  activeTravel: TravelCommitment | null;
  colonies: ColonyState[];
  planets: PlanetState[];
  factionStandings: FactionStanding[];
  historyFacts: HistoricalFact[];
  appliedOutcomeIds: string[];
}
```

All records above are serializable and contain no runtime object handles. Story items live only in `GalaxyRunState.storyItems`, Codex entries only
in `GalaxyRunState.codex`, Bestiary entries only in `GalaxyRunState.pilot.bestiary`, and
access/threat facts only in `GalaxyRunState.atlas`. Projection code may copy them into a
transient engine-shaped save but may never read or write their legacy counterparts.

The G0 constants live in data modules, not React:

```ts
export const G0_GENERATION_IDENTITY = {
  galaxySeed: "sector-zero-g0",
  generationVersion: 1,
  authoredAnchorRegistryVersion: 1,
} as const;

export const G0_SECTOR_BOUNDS = { min: 0, max: 4095, cellSize: 256 } as const;
```

## G0 content and economy table

These are version-1 data constants. Changing a coordinate, formula, anchor, cause,
operation payload, cost, or reward requires a generation/content version migration and
updated determinism tests; it is not an implementation-time balance choice.

### Anchors and starting capability

| ID | Coordinate `(sectorX, sectorY, localX, localY)` | Initial knowledge | Threat summary | Cause fact |
|---|---|---|---|---|
| `contact:vanguard` | `(0, 0, 512, 512)` | `visited`, high confidence | all dimensions `low` | `fact:vanguard-operational` |
| `contact:ashfall` | `(0, 0, 1024, 512)` | `charted`, high confidence | environmental `moderate`; others `low` | `fact:ashfall-distress` |
| `contact:hostile-picket` | `(0, 0, 1280, 1024)` | `charted`, medium confidence | military `high`, logistical `moderate`; others `low` | `fact:picket-patrol-active` |
| `contact:kepler` | `(0, 0, 2048, 1024)` | `charted`, medium confidence | environmental `moderate`, anomalous `moderate`; others `low` | `fact:kepler-recorder-signal` |
| `signal:unresolved-g0` | `(0, 0, 2816, 1792)` | `signal`, low confidence | anomalous `moderate`; every other dimension `unknown` | `fact:unresolved-signal` |

`BLIND_FIXTURE_COORDINATE` is `(0, 0, 1792, 1792)` and is not an authored anchor.
Registry version 1 contains no relay ID or coordinate reservation. Adding one later
requires an explicit authored-registry migration; G0 route planning considers direct
legs only.

The fresh run starts at Vanguard with:

```ts
export const G0_STARTING_SUPPLY = 12;
export const G0_MAX_LEG_DISTANCE = 2048;
export const G0_CYCLE_DISTANCE = 768;
export const G0_SUPPLY_DISTANCE = 384;
```

Ship upgrades are `DEFAULT_UPGRADES`; enhancements, consumables, materials, credits,
story items, Codex, Bestiary, and legacy completions start empty. Route math is exact:

The galaxy-owned bootstrap colony is exactly `id: "galaxy:ashfall-primary"`,
`name: "Ashfall Primary"`, at `ashfall-forward-camp`, with
`{ food: 0, water: 0, metal: 0, credits: 0 }`; its planet/region seed is 4107 and its
faction standings come from `defaultFactionStandings()`. No legacy colony is copied.

```ts
distanceUnits = Math.round(Math.hypot(deltaX, deltaY));
elapsedCycles = Math.max(1, Math.min(3, Math.ceil(distanceUnits / G0_CYCLE_DISTANCE)));
supplyCost = Math.ceil(distanceUnits / G0_SUPPLY_DISTANCE);
```

G0 version 1 plans direct legs only. A destination is blocked when its direct leg is
over `G0_MAX_LEG_DISTANCE` or current supply is below `supplyCost`. Therefore Vanguard
to Ashfall is 512 units / 1 cycle / 2 supply; Vanguard to hostile picket is 923 / 2 / 3;
Vanguard to Kepler is 1,619 / 3 / 5; the blind fixture is 1,810 / 3 / 5; and the
unresolved signal is initially out of range. Tests assert these exact values.

### Operations

| Operation | Existing engine payload | Operation cost | Success reward | Failure/retreat |
|---|---|---:|---|---|
| `op:hostile-picket` | `createGameState(1, 1, ...)` | 0 supply (travel already paid) | `+2 supply`, `+100 XP`, `access:picket-cleared`, knowledge/history; Quick Draw adds `+200 credits` only when met; resolves the interruption as `cleared` | no reward/access; `failed` strands at the picket with emergency retreat available; `retreated` returns to origin |
| `op:kepler-black-box` | `createSpecialMissionGameState("kepler-black-box", ...)` | 0 | `+200 credits`, `+100 XP`, one black-box story item/fact, upgraded Kepler knowledge | no unique reward; travel remains resolved at Kepler |
| `op:ashfall-sortie` | `createPlanetGameState("ashfall", ...)` | 0 | `+75 XP`, upgraded Ashfall knowledge, existing desert mission payload delivered to galaxy-owned Ashfall Primary through `mission_delivery` | no reward; travel remains resolved at Ashfall |

The hostile picket also carries Quick Draw (`q-reyes-1-1`) as a 3,600-frame optional
time-attack modifier with its existing 200-credit reward. Its old `unlockAfter` and
`targetLevel` are ignored as gates; its condition/reward presentation is adapted into the operation. Operation completion costs
one additional world cycle after travel. Unique rewards and access facts use the
operation completion ID and apply once.

Hostile interruption closure is exact:

- `cleared`: operation completion advances its one cycle, the commitment returns to
  `advancing`, and remaining route checkpoints resume without new supply cost;
- `failed`: operation completion advances its one cycle, the commitment becomes
  `diverted`, and the vessel becomes `stranded` at `(0, 0, 1280, 1024)` with the same
  transaction ID; no access/reward is granted;
- `retreated`: operation completion advances its one cycle, the commitment becomes
  `resolved`, and the vessel becomes `stationary` at the saved origin with null transit
  ID;
- from the `failed` stranded state, `emergencyRetreat` is always available even at zero
  supply. It advances exactly one additional galaxy cycle, returns to the saved origin,
  clears the transit ID, and journals `${transactionId}:emergency-retreat` so reload or
  double activation is a no-op.

---

### Task 1: Fixed-point coordinates and stable identity helpers

**Files:**
- Create: `game/app/components/engine/galaxy/galaxyTypes.ts`
- Create: `game/app/components/engine/galaxy/coordinates.ts`
- Create: `game/tests/engine/galaxyCoordinates.test.ts`

- [ ] **Step 1: Write the failing coordinate tests**

```ts
test("coordinates reject unsafe or fractional authority values", () => {
  assert.equal(validateCoordinate({ sectorX: 0, sectorY: 0, localX: 12.5, localY: 2 }).ok, false);
  assert.equal(validateCoordinate({ sectorX: 0, sectorY: 0, localX: Number.MAX_SAFE_INTEGER + 1, localY: 2 }).ok, false);
});

test("cell identity is stable within one cell", () => {
  assert.equal(cellKey(coord(0, 0, 513, 770)), "0:0:2:3");
  assert.equal(cellKey(coord(0, 0, 700, 900)), "0:0:2:3");
});
```

- [ ] **Step 2: Run `npx tsx --test tests/engine/galaxyCoordinates.test.ts` from `game/`**

Expected: FAIL because `engine/galaxy/coordinates` does not exist.

- [ ] **Step 3: Implement `coord`, `validateCoordinate`, `coordinateKey`, `cellAddress`, `cellKey`, `sameCoordinate`, `distanceUnits`, and `stableHash`**

Use only safe integers for saved coordinates. `stableHash` is an explicit unsigned FNV-1a-style hash using `Math.imul`; never use `Math.random` or object iteration order.

- [ ] **Step 4: Rerun the focused test**

Expected: PASS with both invalid-coordinate and same-cell assertions.

- [ ] **Step 5: Run `npx tsc --noEmit`**

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add game/app/components/engine/galaxy game/tests/engine/galaxyCoordinates.test.ts
git commit -m "feat(galaxy): add fixed-point coordinate contracts"
```

### Task 2: Versioned authored anchors and deterministic Atlas cells

**Files:**
- Create: `game/app/components/engine/galaxy/authoredAnchors.ts`
- Create: `game/app/components/engine/galaxy/atlas.ts`
- Create: `game/tests/engine/galaxyAtlas.test.ts`

- [ ] **Step 1: Write failing tests for the complete generation tuple**

```ts
test("same complete generation identity and coordinate produce identical facts", () => {
  assert.deepEqual(resolveCell(G0_GENERATION_IDENTITY, coord(0, 0, 1024, 768)),
    resolveCell(G0_GENERATION_IDENTITY, coord(0, 0, 1024, 768)));
});

test("saved registry version controls latent output", () => {
  const v1 = { ...G0_GENERATION_IDENTITY, authoredAnchorRegistryVersion: 1 };
  assert.deepEqual(resolveCell(v1, BLIND_FIXTURE_COORDINATE), resolveCell(v1, BLIND_FIXTURE_COORDINATE));
  assert.deepEqual(resolveCell({ ...v1, authoredAnchorRegistryVersion: 999 }, BLIND_FIXTURE_COORDINATE),
    { ok: false, reason: "unsupported_registry_version" });
});

test("unknown generation or registry versions remain unavailable", () => {
  assert.equal(getGenerationAvailability({ ...G0_GENERATION_IDENTITY, generationVersion: 999 }).status, "unavailable");
  assert.equal(getGenerationAvailability({ ...G0_GENERATION_IDENTITY, authoredAnchorRegistryVersion: 999 }).status, "unavailable");
});
```

- [ ] **Step 2: Add failing tests for anchor reservation, blind-cell stability, different seeds, and materialized-fact precedence**

Assert Vanguard, Ashfall, Kepler, picket, and unresolved-signal IDs never move between seeds; assert registry version 1 contains no relay; repeated plots in one cell return one fact ID; changing only `galaxySeed` changes a non-anchor cell; and `materializeCell(savedFact, regeneratedFact)` returns the saved fact.

- [ ] **Step 3: Run `npx tsx --test tests/engine/galaxyAtlas.test.ts`**

Expected: FAIL for missing anchor/Atlas modules.

- [ ] **Step 4: Implement registry version 1 and pure cell resolution**

Registry order is explicit. Dispatch both `generationVersion` and `authoredAnchorRegistryVersion` through supported-version tables before resolving anything. Public `resolveCell` returns `{ ok: false, reason: "unsupported_generation_version" | "unsupported_registry_version" }` after that check; it does not throw. Resolve an authored reservation before hashing a procedural cell. Procedural kinds are selected from a fixed table (`empty`, `stellar_contact`, `hazard`, `ruin`, `anomaly`, `signal`) and receive IDs from the complete generation tuple plus cell address. Unknown versions never fall through to current generation code.

- [ ] **Step 5: Implement knowledge promotion without rerolls**

`observeFact`, `chartFact`, `visitFact`, and `recordNegativeSurvey` return new `GalaxyAtlasState` values, preserve provenance/confidence/cycle, and reject backward promotion unless the explicit state is `lost_contact`.

- [ ] **Step 6: Rerun the focused test and `npx tsc --noEmit`**

Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add game/app/components/engine/galaxy game/tests/engine/galaxyAtlas.test.ts
git commit -m "feat(galaxy): generate stable Atlas cells and anchors"
```

### Task 3: Fresh galaxy namespace and field-by-field save migration

**Files:**
- Create: `game/app/components/engine/galaxy/galaxyRun.ts`
- Create: `game/tests/engine/galaxySave.test.ts`
- Modify: `game/app/components/engine/types.ts:1066-1107`
- Modify: `game/app/components/engine/save.ts:36-129`
- Modify: `game/tests/colony/fixtures.ts:5-25`
- Modify: `game/tests/colony/advanceWorldCycle.test.ts:6-22`
- Modify: all remaining direct `SaveData` literals reported by TypeScript

- [ ] **Step 1: Write the failing migration/default test**

```ts
test("legacy saves default to an isolated legacy experience", () => {
  const migrated = migrateSave({ credits: 999, colonies: [{ id: "legacy" }] });
  assert.equal(migrated.activeExperience, "legacy");
  assert.equal(migrated.galaxyRun, null);
});
```

- [ ] **Step 2: Write the failing fresh-run isolation test**

Create two migrated legacy saves with deliberately different credits, XP, upgrades, levels, completions, colonies, factions, and story items. Call `startFreshGalaxy` with the same identity and assert the two resulting `galaxyRun` objects are deeply equal while every legacy field in each parent save is unchanged.

- [ ] **Step 3: Run `npx tsx --test tests/engine/galaxySave.test.ts`**

Expected: FAIL for missing `galaxyRun` fields/factory.

- [ ] **Step 4: Implement the fresh factory**

The factory initializes supply, ship/pilot defaults, visited Vanguard knowledge, charted G0 contacts, operation states, no legacy completions, and a galaxy-owned Ashfall Primary created from `createPlanetRegionState("ashfall", ASHFALL_REGION_SEED)` plus the existing colony founding reducer. The initial vessel location is the Vanguard anchor.

- [ ] **Step 5: Implement nested migration field by field**

`migrateGalaxyRun` validates the complete identity, coordinate integers, enum members, arrays, maps, checkpoint IDs, colony/planet arrays, and every scalar with `??` fallbacks. It preserves unsupported saved generation and registry versions; `getGalaxyRunAvailability` checks both and returns a typed recoverable-unavailable result for the UI. It never drops the run or silently substitutes current generation code or the newest registry.

- [ ] **Step 6: Add `activeExperience` and `galaxyRun` to every test fixture**

Use `activeExperience: "legacy", galaxyRun: null`; do not use `as SaveData` to hide missing fields.

- [ ] **Step 7: Run the focused test, `yarn colony:test`, and `npx tsc --noEmit`**

Expected: all exit 0.

- [ ] **Step 8: Commit**

```bash
git add game/app/components/engine/types.ts game/app/components/engine/save.ts game/app/components/engine/galaxy/galaxyRun.ts game/tests
git commit -m "feat(save): add isolated galaxy run namespace"
```

### Task 4: Pure route previews with supply, time, threat, and confidence

**Files:**
- Create: `game/app/components/engine/galaxy/routePlanner.ts`
- Create: `game/tests/engine/galaxyRoutePlanner.test.ts`

- [ ] **Step 1: Write failing safe, hostile, blind, and blocked route tests**

```ts
test("preview exposes all five threat dimensions", () => {
  const plan = planRoute(runAtVanguard(), { kind: "contact", contactId: "contact:ashfall" });
  assert.equal(plan.ok, true);
  if (!plan.ok) return;
  assert.deepEqual(Object.keys(plan.plan.threat.dimensions).sort(),
    ["anomalous", "environmental", "logistical", "military", "political"]);
});

test("insufficient supply blocks without mutation", () => {
  const run = runAtVanguard({ supply: 0 });
  const before = structuredClone(run);
  const result = planRoute(run, { kind: "contact", contactId: "contact:kepler" });
  assert.equal(result.ok, false);
  assert.match(result.reasons.join(" "), /supply/i);
  assert.deepEqual(run, before);
});

test("G0 route economy matches the versioned content table", () => {
  assert.deepEqual(costTo("contact:ashfall"), { distanceUnits: 512, elapsedCycles: 1, supplyCost: 2 });
  assert.deepEqual(costTo("contact:hostile-picket"), { distanceUnits: 923, elapsedCycles: 2, supplyCost: 3 });
  assert.deepEqual(costTo("contact:kepler"), { distanceUnits: 1619, elapsedCycles: 3, supplyCost: 5 });
  assert.equal(planTo("signal:unresolved-g0").ok, false);
});
```

- [ ] **Step 2: Run `npx tsx --test tests/engine/galaxyRoutePlanner.test.ts`**

Expected: FAIL because `routePlanner` is missing.

- [ ] **Step 3: Implement route-plan identity and direct/relay legs**

The plan ID hashes immutable origin, destination, target, capability, policy, identity, ordered legs, cost, and cycle snapshot. Implement the exact version-1 direct-route range, cycle, and supply formulas from the G0 content/economy table; do not add a relay candidate in version 1. The preview also returns known ports/repair opportunities and forecasted world changes as explicit arrays, even when both are empty in G0.

- [ ] **Step 4: Implement qualitative threat aggregation**

Each dimension carries `band`, `confidence`, `sources`, and `unknownContributors`. Never emit a numeric success probability. Unknown blind targets state the uncertainty instead of becoming secretly lethal.

- [ ] **Step 5: Rerun focused tests and `npx tsc --noEmit`**

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add game/app/components/engine/galaxy/routePlanner.ts game/tests/engine/galaxyRoutePlanner.test.ts
git commit -m "feat(galaxy): preview supply-bound Atlas routes"
```

### Task 5: Allowlisted engine projection and galaxy-only cycle advancement

**Files:**
- Create: `game/app/components/engine/galaxy/galaxyProjection.ts`
- Create: `game/tests/engine/galaxyProjection.test.ts`

- [ ] **Step 1: Write the failing locked-projection test**

```ts
test("engine projection cannot inherit legacy availability", () => {
  const parent = legacyRichSaveWithFreshGalaxy();
  const projected = projectGalaxyRunToLegacySave(parent);
  assert.deepEqual(projected.levels, {});
  assert.deepEqual(projected.completedPlanets, []);
  assert.deepEqual(projected.unlockedSpecialMissions, []);
  assert.deepEqual(projected.activeQuests, []);
  assert.deepEqual(projected.colonies, parent.galaxyRun?.colonies);
});
```

- [ ] **Step 2: Write the failing no-leakage test**

Snapshot every legacy progression field, advance two galaxy cycles, and assert the snapshot is byte-for-byte equal afterward while `galaxyRun.worldCycle` and galaxy colony `lastCycleProcessed` advance exactly twice. The transient projection maps `worldCycle` to its `missionsSinceStart` field; no second galaxy counter is introduced.

- [ ] **Step 3: Run `npx tsx --test tests/engine/galaxyProjection.test.ts`**

Expected: FAIL for missing projection APIs.

- [ ] **Step 4: Implement `projectGalaxyRunToLegacySave`**

Construct every `SaveData` field explicitly. Source ship, pilot, story, Atlas-owned colonies/planets/factions, and world-cycle counters only from `GalaxyRunState`; hard-code legacy availability arrays/maps empty.

The transient object explicitly uses `activeExperience: "legacy"` and
`galaxyRun: null` so existing engine helpers see a non-recursive compatibility save. It
is never passed to `saveSave`; only the canonical parent save can be persisted.

- [ ] **Step 5: Implement `mergeProjectionIntoGalaxy` and `advanceGalaxyWorldCycles`**

Allow only colonies, planets, faction standings, pilot XP/level/skills, ship inventory/equipment, Bestiary/Codex entries explicitly earned by the operation, and the projected cycle counter. Reject an unknown delta key. Call existing `advanceWorldCycle` on the transient projection once per promised cycle.

- [ ] **Step 6: Rerun focused tests, `yarn colony:test`, and `npx tsc --noEmit`**

Expected: all exit 0.

- [ ] **Step 7: Commit**

```bash
git add game/app/components/engine/galaxy/galaxyProjection.ts game/tests/engine/galaxyProjection.test.ts
git commit -m "feat(galaxy): isolate legacy engine projections"
```

### Task 6: Idempotent journaled travel commitments

**Files:**
- Create: `game/app/components/engine/galaxy/travelResolver.ts`
- Create: `game/tests/engine/galaxyTravelResolver.test.ts`

- [ ] **Step 1: Write the failing initial-commit idempotency test**

Commit one preview twice with `travel:<planId>:<ordinal>` and assert one commitment, one supply deduction, one ordinal increment, and no duplicate checkpoint.

- [ ] **Step 2: Write the failing reload matrix**

For saved states `committed`, `advancing`, `interrupted`, `arrived`, `diverted`, and `resolved`, serialize through `migrateSave`, resume, and assert only missing checkpoint IDs apply. Supply, elapsed cycles, interruption ID, and arrival never reroll or duplicate.

- [ ] **Step 3: Write failing safe-arrival and hostile-interruption tests**

The Ashfall route reaches `arrived`; the picket route stops at `interrupted` with `op:hostile-picket`; both leave a playable `resolve`, `launch`, `retreat`, or `return` action.

- [ ] **Step 4: Write failing interruption-closure tests**

`resolveTravelInterruption` with `cleared` resumes the saved route and can arrive;
`failed` sets commitment `diverted` and vessel `stranded` at the exact hostile-picket
coordinate; `retreated` restores the origin and resolves the commitment. Assert
`emergencyRetreat` from `failed` costs zero supply, advances one cycle, restores the
origin, resolves the commitment, and no-ops on double activation/reload. Each outcome
updates vessel status/location once.

- [ ] **Step 5: Write the failing blind-arrival test**

Commit and resolve travel to `BLIND_FIXTURE_COORDINATE`. Assert arrival materializes the
stable cell fact and `mappedCellKeys`. `empty` persists a negative-survey record;
`stellar_contact` and `ruin` persist `visited` direct-visit knowledge; `hazard` and
`anomaly` persist `visited` direct-visit knowledge with their observed kind; `signal`
persists signal knowledge at the exact coordinate with direct-visit provenance. Table-
drive all six generator kinds. Reload and repeat without rerolling or adding a second
fact or knowledge record.

- [ ] **Step 6: Run `npx tsx --test tests/engine/galaxyTravelResolver.test.ts`**

Expected: FAIL because `travelResolver` is missing.

- [ ] **Step 7: Implement `commitTravel`**

Re-plan from current state and reject a stale plan before mutation. In one returned save value, record the commitment, deduct supply, set vessel `in_transit`, and increment the saved transaction ordinal. Reusing the same transaction ID returns the identical save object.

- [ ] **Step 8: Implement `advanceTravelCheckpoint` and `resumeTravelToBoundary`**

Checkpoint IDs are `${transactionId}:leg:${index}`. Before applying a leg, check `appliedCheckpointIds`; after applying its exact cycles through `advanceGalaxyWorldCycles`, journal the ID and either advance, interrupt for a recorded cause, or arrive. Arrival resolves/materializes the destination cell, records mapped coverage or observed contact/hazard knowledge, and never rerolls a saved fact.

Use the Task 6 blind-arrival mapping for every procedural kind: empty, stellar contact,
hazard, ruin, anomaly, and signal. No successful arrival may omit both a materialized
fact and a knowledge/negative-survey record.

- [ ] **Step 9: Implement `resolveTravelInterruption`**

Accept only the active interruption operation and a typed `cleared`, `failed`, or
`retreated` result. Journal `${transactionId}:interruption:<result>`, update vessel and
commitment atomically using the exact closure table above, and either resume, strand at
the picket, or return to origin. Implement `emergencyRetreat` as a separate zero-supply,
one-cycle, idempotent transition from the failed stranded state. Existing interruption
checkpoint IDs make repeated operation callbacks and reloads no-ops.

- [ ] **Step 10: Rerun focused tests and `npx tsc --noEmit`**

Expected: exit 0.

- [ ] **Step 11: Commit**

```bash
git add game/app/components/engine/galaxy/travelResolver.ts game/tests/engine/galaxyTravelResolver.test.ts
git commit -m "feat(galaxy): journal idempotent travel commitments"
```

### Task 7: Unified located operation catalog and engine launch adapters

**Files:**
- Create: `game/app/components/engine/operations/operationTypes.ts`
- Create: `game/app/components/engine/operations/operationCatalog.ts`
- Create: `game/app/components/engine/operations/operationAdapters.ts`
- Create: `game/tests/engine/galaxyOperations.test.ts`

- [ ] **Step 1: Write failing catalog tests**

Assert the fresh run contains stable located definitions for `op:hostile-picket`, `op:kepler-black-box`, and `op:ashfall-sortie`; each has source, coordinate, contact, cause facts, objective, modifiers, phases, threat, costs, rewards, availability, and state.

Assert the exact coordinates, cause IDs, `world 1 / level 1` shooter payload, zero
operation supply costs, success rewards, Quick Draw modifier, and failure/retreat
effects from the G0 content/economy table.

- [ ] **Step 2: Write the failing legacy-gate bypass test**

Use a projection with empty `levels`, `completedPlanets`, `unlockedSpecialMissions`, and quest arrays. Authorize each operation from its Atlas contact and assert the adapters still create shooter, first-person Kepler, and Ashfall planet `GameState` values.

- [ ] **Step 3: Write the failing modifier test**

Assert the hostile picket carries the existing Quick Draw time-attack condition by stable quest ID, but operation availability never calls `getAvailableQuests` or consults `unlockAfter`.

- [ ] **Step 4: Run `npx tsx --test tests/engine/galaxyOperations.test.ts`**

Expected: FAIL for missing operation modules.

- [ ] **Step 5: Implement the catalog and availability reducer**

Availability reads current vessel/contact location, operation state, access facts, active travel, and unique history only. A missing adapter returns `unavailable` with recoverable copy.

- [ ] **Step 6: Implement engine adapters without changing constructors**

`op:hostile-picket` calls `createGameState` with its internal legacy payload, Kepler calls `createSpecialMissionGameState`, and Ashfall calls `createPlanetGameState`. The returned `OperationLaunchContext` records operation ID and adapter kind; the payload's world/level fields are not availability authority.

Pass Kepler's `blackBoxRecovered` constructor argument only from
`GalaxyRunState.storyItems.includes("kepler-black-box")`; never read the legacy
projection's story/completion fields for this decision.

- [ ] **Step 7: Rerun focused tests, `yarn engine:test`, and `npx tsc --noEmit`**

Expected: all exit 0.

- [ ] **Step 8: Commit**

```bash
git add game/app/components/engine/operations game/tests/engine/galaxyOperations.test.ts
git commit -m "feat(operations): launch located G0 encounters"
```

### Task 8: Normalized, one-time operation outcomes

**Files:**
- Create: `game/app/components/engine/operations/operationOutcome.ts`
- Create: `game/tests/engine/galaxyOperationOutcome.test.ts`
- Modify: `game/app/components/colony/shared/missionDelivery.ts` only if a type export is required; preserve existing behavior

- [ ] **Step 1: Write the failing idempotent completion test**

Apply one `completionId` twice and assert operation state, supply/material, knowledge, access facts, history facts, pilot results, and cycles apply once.

- [ ] **Step 2: Write the failing Kepler uniqueness test**

Completing Kepler with the black box records one galaxy history fact and one story item. Replaying the engine may complete work but cannot duplicate the unique reward.

- [ ] **Step 3: Write the failing Ashfall cargo test**

Project the galaxy run, call the existing `applyMissionDelivery(..., "ashfall")` or `applyExplicitMissionDelivery`, merge through the allowlist, and assert the galaxy-owned Ashfall colony receives the payload while legacy colonies/resources remain unchanged. Assert the emitted event reason remains `mission_delivery`.

- [ ] **Step 4: Write the failing access consequence test**

Completing the picket records one access fact that lowers/removes its military route cause; failing or retreating records history without falsely securing the route.

For an operation launched by an active interruption, outcome folding must also call
`resolveTravelInterruption` with the typed result. Success resumes/arrives; failure
diverts/strands; retreat returns to the saved origin. The operation and travel outcome
share one completion ID so a repeated callback cannot resolve either side twice.

- [ ] **Step 5: Run `npx tsx --test tests/engine/galaxyOperationOutcome.test.ts`**

Expected: FAIL because outcome folding is missing.

- [ ] **Step 6: Implement validation and folding**

Reject unknown operation IDs, cause facts, contacts, reward fields, or duplicate unique facts before mutation. Tick one operation-completion world cycle separately from travel, then merge the normalized allowlist into `GalaxyRunState`.

- [ ] **Step 7: Rerun focused tests, `yarn colony:test`, `yarn engine:test`, and `npx tsc --noEmit`**

Expected: all exit 0.

- [ ] **Step 8: Commit**

```bash
git add game/app/components/engine/operations/operationOutcome.ts game/tests/engine/galaxyOperationOutcome.test.ts game/app/components/colony/shared/missionDelivery.ts
git commit -m "feat(operations): fold G0 outcomes into galaxy history"
```

### Task 9: Projected Ashfall region and POI adapters

**Files:**
- Modify: `game/app/components/engine/operations/operationAdapters.ts`
- Create: `game/tests/colony/galaxyRegionAdapter.test.ts`

- [ ] **Step 1: Write failing projected-region tests**

Assert `openGalaxyRegion(save, "contact:ashfall")` returns the galaxy-owned origin colony and a projected save accepted by `RegionMapScreen`; a non-Ashfall or non-visited contact is rejected.

- [ ] **Step 2: Write failing survey/found/POI tests**

Wrap `startRegionExpedition`, `foundOutpost`, `preparePoiCompletion`, and `resolvePoiCompletion`. Assert survey and POI travel cycles update only `galaxyRun`, found outposts deduct galaxy-colony resources, POI cargo uses `mission_delivery`, and legacy colony/planet arrays remain byte-for-byte unchanged.

- [ ] **Step 3: Run `npx tsx --test tests/colony/galaxyRegionAdapter.test.ts`**

Expected: FAIL for missing projected region APIs.

- [ ] **Step 4: Implement the wrappers**

Every call follows `canonical save -> project -> existing pure M1 function -> validate -> allowlisted merge -> canonical save`. Never persist a projected save. Preserve existing POI replay and one-time reward rules.

- [ ] **Step 5: Rerun focused tests, `yarn colony:test`, and `npx tsc --noEmit`**

Expected: all exit 0.

- [ ] **Step 6: Commit**

```bash
git add game/app/components/engine/operations/operationAdapters.ts game/tests/colony/galaxyRegionAdapter.test.ts
git commit -m "feat(galaxy): expose Ashfall through projected region adapters"
```

### Task 10: Pure Atlas viewport and input equivalence

**Files:**
- Create: `game/app/components/galaxy/atlasViewport.ts`
- Create: `game/tests/engine/galaxyAtlasViewport.test.ts`

- [ ] **Step 1: Write failing projection and clamp tests**

Assert world-to-screen and screen-to-world round-trip at multiple viewport sizes, pan clamps to G0 bounds, zoom clamps to named min/max, and no projection output changes cell identity. Assert the zoom/view reducer exposes the four conceptual levels, with galaxy as a non-interactive frame in G0, sector as the functional field, system as the selected-contact detail, and region as the explicit Ashfall handoff.

- [ ] **Step 2: Write failing input-equivalence tests**

Assert pointer hit, touch hit, DOM contact activation, keyboard contact navigation, and arbitrary-coordinate form normalization produce the same `AtlasTarget`. Assert arrow pan and labeled touch-pan controls call the same reducer.

- [ ] **Step 3: Run `npx tsx --test tests/engine/galaxyAtlasViewport.test.ts`**

Expected: FAIL because the viewport module is missing.

- [ ] **Step 4: Implement the pure viewport reducer**

State is `{ viewLevel, center, zoom, selectedTargetId }`. Actions are `set-view`, `pan`, `zoom`, `select-contact`, and `select-coordinate`; touch pinch is converted to the same `zoom` action and never commits a target. Generation APIs never receive display size, FPS, input method, pan, or zoom.

- [ ] **Step 5: Rerun focused tests and `npx tsc --noEmit`**

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add game/app/components/galaxy/atlasViewport.ts game/tests/engine/galaxyAtlasViewport.test.ts
git commit -m "feat(atlas): add input-neutral viewport controls"
```

### Task 11: Hybrid Canvas/DOM Galaxy Atlas screen

**Files:**
- Create: `game/app/components/galaxy/GalaxyAtlasScreen.tsx`
- Create: `game/app/components/galaxy/GalaxyExperienceGate.tsx`
- Create: `game/app/components/galaxy/index.ts`
- Create: `game/tests/engine/galaxyAtlasScreen.test.ts`

- [ ] **Step 1: Write the failing SSR surface test**

```ts
test("Atlas has a DOM-complete travel path", () => {
  const html = renderToStaticMarkup(React.createElement(GalaxyAtlasScreen, propsForKnownRoute()));
  assert.match(html, /role="listbox"/);
  assert.match(html, /ASHFALL/);
  assert.match(html, /DISTANCE[\s\S]*CYCLES[\s\S]*SUPPLY/);
  for (const label of ["MILITARY", "POLITICAL", "ENVIRONMENTAL", "LOGISTICAL", "ANOMALOUS"]) assert.match(html, new RegExp(label));
  assert.match(html, /PLOT COORDINATE/);
  assert.match(html, /COMMIT TRAVEL/);
  assert.doesNotMatch(html, /W1|WORLD 1|NEXT LEVEL/);
});
```

- [ ] **Step 2: Add failing SSR tests for entry, block, uncertainty, interruption, and no-run states**

Assert focusable `BEGIN GALAXY` and `LEGACY CAMPAIGN`; every contact has a DOM button; insufficient supply names the reason and disables commit; blind preview names unknown confidence; interrupted travel exposes launch/retreat; unsupported generation shows recoverable copy.

- [ ] **Step 3: Run `npx tsx --test tests/engine/galaxyAtlasScreen.test.ts`**

Expected: FAIL because the React components are missing.

- [ ] **Step 4: Implement the DOM surface first**

Use one selected target shared by the contact list, coordinate form, route panel, and callbacks. Provide focusable arrow-pan buttons, `+/-` zoom, coordinate number inputs, route warnings, status live region, and operation/Ashfall controls.

Render a DOM breadcrumb/control row for `GALAXY / SECTOR / SYSTEM / REGION`. Galaxy is a labeled non-interactive framing preview in G0; sector is the navigable field; system is the selected contact/operation panel; region invokes the existing Ashfall screen when available.

- [ ] **Step 5: Add Canvas 2D drawing inside `useEffect`**

Acquire `canvas.getContext("2d")` after mount. Render field, contacts, route, threat volumes, and selection from pure projection data. Pointer/touch handlers dispatch viewport actions; touch drag/pinch never triggers commit. No Canvas item is the sole selectable representation.

- [ ] **Step 6: Add focus restoration**

After pan/zoom keep focus on the initiating DOM control; after target changes focus its details heading; on close return focus to the invoking control.

- [ ] **Step 7: Rerun focused tests and `npx tsc --noEmit`**

Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add game/app/components/galaxy game/tests/engine/galaxyAtlasScreen.test.ts
git commit -m "feat(atlas): add accessible hybrid galaxy screen"
```

### Task 12: Deterministic DevPanel galaxy fixtures

**Files:**
- Create: `game/app/components/galaxy/devFixtures.ts`
- Create: `game/tests/engine/galaxyDevFixtures.test.ts`
- Modify: `game/app/components/DevPanel.tsx:1-260`

- [ ] **Step 1: Write failing fixture tests**

Assert six fixed fixtures exist: `atlas-start`, `known-route`, `hostile-route`, `blind-discovery`, `insufficient-supply`, and `in-transit-reload`. Applying the same fixture twice produces equal galaxy state and never mutates legacy fields.

- [ ] **Step 2: Run `npx tsx --test tests/engine/galaxyDevFixtures.test.ts`**

Expected: FAIL because `devFixtures` is missing.

- [ ] **Step 3: Implement fixtures from the public reducers**

Do not hand-edit internal checkpoint arrays except the explicit `in-transit-reload` snapshot, which must be produced by `commitTravel` plus exactly one checkpoint transition.

- [ ] **Step 4: Add `GALAXY SEEDS` buttons to DevPanel**

Buttons emit `seed-galaxy:<fixtureId>` and appear automatically in DevPanel-enabled builds.

- [ ] **Step 5: Rerun focused tests and `npx tsc --noEmit`**

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add game/app/components/galaxy/devFixtures.ts game/app/components/DevPanel.tsx game/tests/engine/galaxyDevFixtures.test.ts
git commit -m "feat(devtools): add deterministic Atlas fixtures"
```

### Task 13: Game orchestration and experience separation

**Files:**
- Modify: `game/app/components/Game.tsx:88-2241`
- Create: `game/app/components/engine/galaxy/experienceFlow.ts`
- Create: `game/tests/engine/galaxyExperienceFlow.test.ts`
- Modify: `game/app/components/engine/cockpit.ts:15-167` only if type/action naming is needed; do not rewrite cockpit rendering

- [ ] **Step 1: Write failing pure experience-flow tests**

Implement/test `beginGalaxyExperience`, `mapSurfaceForExperience`, `returnSurfaceForOperation`, and `legacyProgressionSnapshot` in `engine/galaxy/experienceFlow.ts`. Assert begin creates or resumes the galaxy, legacy opens the old star map, galaxy opens the Atlas, and an operation completion returns to Atlas without changing the legacy snapshot. Tests never import the full client `Game.tsx` component.

- [ ] **Step 2: Run `npx tsx --test tests/engine/galaxyExperienceFlow.test.ts`**

Expected: FAIL for missing flow helpers.

- [ ] **Step 3: Add explicit experience entry**

Mount `GalaxyExperienceGate` on the start screen. `LEGACY CAMPAIGN` preserves the current intro/cockpit flow. `BEGIN/CONTINUE GALAXY` persists the new selector/run and opens the Atlas directly; it never deletes legacy data.

- [ ] **Step 4: Route the cockpit STAR MAP hotspot by `activeExperience`**

Legacy keeps `showMap` and `drawStarMap`. Galaxy mounts `GalaxyAtlasScreen` and never starts the old star-map rAF loop.

- [ ] **Step 5: Wire Atlas selection and travel**

Preview remains derived. Confirm creates a deterministic transaction ID from the saved ordinal, commits, resumes to arrival/interruption, persists once per canonical returned state, and keeps the selected target on a block.

- [ ] **Step 6: Wire operation launch/restart/completion**

Track `activeOperationId` separately from legacy planet/special IDs. Launch the adapter state, restart through the same adapter, intercept `LEVEL_COMPLETE` before legacy `nextLevel`, fold one normalized outcome, and return to Atlas. GAME_OVER offers retry/retreat/Atlas and never fabricates completion.

When the active operation is the saved travel interruption, pass its completion,
failure, or retreat into `resolveTravelInterruption` before returning to the Atlas. A
cleared picket resumes/arrives, a failure exposes the deterministic diverted/stranded
state with an always-enabled `EMERGENCY RETREAT` DOM action, and retreat restores the
route origin; no path leaves an orphaned active travel. The emergency action calls only
the zero-supply, one-cycle `emergencyRetreat` reducer and remains safe after reload.

- [ ] **Step 7: Wire Ashfall region/POI projection**

Pass the projected save into `RegionMapScreen`/`PoiOutcomeScreen`; call only the Task 9 wrappers for mutations; persist only the returned canonical parent save. On galaxy POI completion, return to the Atlas or projected Ashfall region instead of writing top-level colony state.

- [ ] **Step 8: Wire DevPanel fixtures**

Handle `seed-galaxy:<id>` by applying the fixture, clearing active engine/POI UI, and opening the Atlas.

- [ ] **Step 9: Audit all surface guards**

Add `showGalaxyAtlas` to game-loop, non-playing draw-loop, grade-menu, keyboard Escape, mute-button, pointer/touch, pause, and cleanup conditions so no hidden rAF or canvas handler remains active behind the DOM Atlas.

- [ ] **Step 10: Run focused tests, `yarn colony:test`, `yarn engine:test`, and `npx tsc --noEmit`**

Expected: all exit 0.

- [ ] **Step 11: Commit**

```bash
git add game/app/components/Game.tsx game/app/components/engine/cockpit.ts game/app/components/engine/galaxy/experienceFlow.ts game/tests/engine/galaxyExperienceFlow.test.ts
git commit -m "feat(game): make the Atlas the galaxy-run mission surface"
```

### Task 14: Full gates, production playtest, review, and PR update

**Files:**
- Modify: `docs/ROADMAP.md` only after all G0 acceptance checks pass
- Create: `docs/playtests/2026-07-16-g0-atlas.md`
- Modify runtime files only through a failing regression test if verification exposes a defect

- [ ] **Step 1: Run static/type/test gates individually from `game/`**

```bash
npx tsc --noEmit
yarn colony:test
yarn engine:test
yarn sprites:test
yarn build
NEXT_PUBLIC_DEVTOOLS=1 yarn build
```

Record exact test counts and exit status. Any failure blocks completion.

- [ ] **Step 2: Prove static-export safety**

Search new modules for module-scope `window`, `document`, `performance`, `Date.now`, `Math.random`, WebGL, and Canvas context acquisition. Confirm the default and DevPanel builds both finish without module-evaluation errors.

- [ ] **Step 3: Start the production-like test environment**

From `game/`, run `NEXT_PUBLIC_DEVTOOLS=1 yarn build`, then from another shell run `npx serve out -l 3000`. Use a fresh browser storage profile at 480x854 and a desktop viewport.

- [ ] **Step 4: Playtest explicit entry and navigation**

Verify legacy campaign still opens W1-W8. Launch and complete one legacy mission through
the normal `nextLevel`/return-to-cockpit path, then reload and confirm its stars, score,
and unlock state persist. Begin a new galaxy; pointer, touch, DOM, and keyboard select
the same contacts; arrows/buttons pan; +/- and touch controls zoom; coordinate form
selects a blind target; focus remains meaningful.

- [ ] **Step 5: Playtest travel correctness**

Use `KNOWN ROUTE`, `HOSTILE ROUTE`, `BLIND DISCOVERY`, `INSUFFICIENT SUPPLY`, and
`IN-TRANSIT RELOAD`. Confirm full preview copy, exact supply/cycles, no double-confirm
charge, safe arrival, caused picket interruption, reload resume, and every interruption
closure: cleared resumes/arrives, failure diverts/strands playably, retreat returns to
origin. From the failed stranded screen, activate `EMERGENCY RETREAT` at zero supply and
confirm one cycle plus a return to the saved origin; repeat after reload and confirm no
second tick. Commit the blind route and confirm it persists one materialized fact plus mapped
coverage/negative survey or observed knowledge across reload without reroll.

- [ ] **Step 6: Playtest the three adapted contexts**

Complete the hostile shooter, Kepler retrieval, and Ashfall planet/region/POI path. Confirm material, knowledge, and access outputs; Kepler uniqueness; POI `mission_delivery`; colony result persistence; and no legacy completion/unlock/resource changes.

- [ ] **Step 7: Record browser evidence**

In `docs/playtests/2026-07-16-g0-atlas.md`, record build SHA, commands/counts, browser/viewport, fixture-by-fixture observations, reload/double-confirm evidence, console errors, and any deferred visual issues.

- [ ] **Step 8: Update the roadmap only if verified**

Change G0 from `NEXT SYSTEMIC SLICE` to `DONE` and list the verified runtime proof. If any acceptance path is missing, leave G0 in progress and state the exact gap.

- [ ] **Step 9: Run the final scope audit**

```bash
git diff --check origin/main...HEAD
git status --short --branch
git diff --name-status origin/main...HEAD
git log --oneline origin/main..HEAD
```

Confirm no sprite, sprite-registration, asset-script, WebGL renderer, or unrelated balance files changed.

- [ ] **Step 10: Commit verification documentation**

```bash
git add docs/ROADMAP.md docs/playtests/2026-07-16-g0-atlas.md
git commit -m "docs(galaxy): record G0 Atlas verification"
```

- [ ] **Step 11: Request independent code review and fix blockers test-first**

Use `superpowers:requesting-code-review` against the spec and this plan. Any real defect gets a failing regression test before the fix; rerun affected focused tests and every final gate.

- [ ] **Step 12: Push and update the draft PR**

Push the implementation branch and update the PR body with task commits, exact verification counts, playtest matrix, screenshots, legacy-isolation evidence, and residual risks. Do not merge without explicit user approval and green CI.

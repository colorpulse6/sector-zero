# Sector Zero — Colony System Design

**Date:** 2026-04-20
**Status:** Design approved, ready for implementation planning
**Supersedes:** `docs/game/colony-system-design.md` (2026-04-07)
**Scope:** Major expansion — colonies as full open-world explorable layer with FPS exploration, NPCs, dungeons, markets, RPG quests, consequence system, multi-tier growth from Outpost to Capital, and deep integration with the existing campaign.

---

## Design Philosophy

> "The graphics may not be modern, but our systems will be flawless, the logic impenetrable, the game should flow seamlessly inside itself."
>
> — Project vision, 2026-04-20

Every design decision in the Colony System serves this statement. Depth through **systemic rigor**, not content volume. Elegance through **layered boundaries**, not clever tricks. Craftsmanship through **patient, documented, tested** increments, not heroic rewrites. The graphical ceiling of Canvas 2D + HTML5 isn't a limit — it's the freedom to invest everything in logic depth.

### Core Principles

- **Missions are the heartbeat.** One cycle = one completed mission. No real-time decay. The world pauses with the player. Players cannot lose progress by not playing.
- **Ship missions are the origin and the spine.** The colony layer exists to amplify and be amplified by the ship-combat core the project was built on.
- **Colonies are living places, not menus.** You walk through them in first-person. You kill or help people inside them. You build them from Outpost to Capital over dozens of missions.
- **Every building is enterable** (Daggerfall-style breadth). Minimum stub interior even for utility buildings.
- **Consequences are systemic.** Faction standing, witnesses, bounties, reputation — actions ripple, not a UI lockout.
- **Systems flawless, logic impenetrable.** Every cycle pipeline step is pure-function-testable. Every invariant has an assertion. Every save shape is versioned and migrable.
- **Incremental, patient, documented.** Twelve phases. No phase begins until the previous is shipped, reviewed, and deployed.
- **Architecture future-proof for Deep Sim.** Entity IDs everywhere, even for things we don't simulate yet. The v1 code evolves toward Dwarf Fortress depth as AI/perf mature — without rewrites.

---

## Executive Summary

The Colony System transforms Sector Zero from a multi-mode shooter with narrative beats into a **space exploration + civilization-building + open-world RPG** layered on top of its shooter core. Players found settlements during first-person exploration, commission buildings through a strategic management UI, physically descend and walk through their colonies in FPS mode, interact with named NPCs and background crowds, shop at dynamically-priced markets, accept quests from authored characters and procgen bulletin boards, explore regional points of interest that dispatch to all existing gameplay engines, defend against Hollow raids, manage Earth supply lines, and watch their colonies grow from frontier Outposts to walkable Metropolitan Capitals across the 8-world campaign.

The system is built as a **three-layer architecture** with clean boundaries: a Meta Layer (React-based strategic UI, no canvas), an Exploration Layer (extends the existing first-person raycaster via an adapter pattern), and a POI/Dungeon Layer (dispatches to existing shooter/boarding/ground-run/turret engines for all outside-the-colony content). Every state change flows through a single reducer with asserted invariants, making the entire system auditable and testable.

The simulation model uses two clocks: a **cycle clock** (ticks only on mission completion — the game's heartbeat) and a **game clock** (advances in real-time only during colony visits, for NPC schedules and day/night lighting). Resources flow through three strictly-separated value types (credits, colony resources, combat materials) with one gated conversion point (the Refinery). Colonies generate emergent missions as a side effect of their state, solving the "we need more missions" problem — the more colonies you have, the more content the world offers.

Content is produced via a hybrid pipeline: **procedurally generated breadth with hand-authored landmarks**. Each planet hosts a node-graph region map of procgen points of interest assembled from ~33 hand-authored templates across 4 engine flavors. Eight story-critical authored landmarks anchor the campaign, one per world, and the elevation system allows any procgen POI to be upgraded to hand-authored content at any time without data refactoring.

Integration with the existing campaign is bidirectional: pre-mission buffs derive from colony state (Barracks grant wingmen, Research Labs unlock tech, Strongholds grant damage reduction), and every completed mission ticks the world (resources deliver, threats progress, shipments move, emergent quests spawn). Late-game campaign missions are soft-gated on colony milestones.

The architecture is designed for incremental delivery across twelve phases grouped into five shippable milestones, with a parallel asset generation workstream. First playable colony loop (Milestone A) targets the end of Phase 2.

---

## Table of Contents

- Section A — North Star & Architecture
- Section B — Data Model
- Section C — The Three Layers In Detail
- Section D — Simulation Rules
- Section E — Building Catalog & Interior Tiers
- Section F — Regions, POIs, and Quests
- Section G — Economy Wiring
- Section H — Strategic Campaign Integration
- Section I — UX Flow
- Section J — Implementation Phases
- Asset Pipeline Workstream
- Open Questions / Deferred Decisions
- Success Criteria

---

## Section A — North Star & Architecture

### The Three Layers

```
┌───────────────────────────────────────────────────┐
│  META LAYER  (React/DOM, no canvas)               │
│  ───────────                                       │
│  • Galaxy colony map                               │
│  • Colony grid planner (commissioning buildings)   │
│  • Earth shipments UI                              │
│  • Faction standing dashboard                      │
│                                                    │
│  Reads/writes: ColonyState[], ShipmentQueue,       │
│                FactionStanding, etc.               │
└──────────────────┬────────────────────────────────┘
                   │  state mutations via explicit API
┌──────────────────▼────────────────────────────────┐
│  EXPLORATION LAYER  (extends firstPersonEngine)    │
│  ─────────────────                                 │
│  • Walking the colony in FPS                       │
│  • Day/night lighting & NPC schedules              │
│  • Building entry, district transitions            │
│  • Consequence system (witness, reputation)        │
│  • Open-world level flavor                         │
│                                                    │
│  Uses: firstPersonEngine.ts via ColonyContext      │
│        adapter (no core pollution)                 │
└──────────────────┬────────────────────────────────┘
                   │  dispatches to inner engines
┌──────────────────▼────────────────────────────────┐
│  POI / DUNGEON LAYER  (dispatches to existing)    │
│  ───────────────────                               │
│  • Region node graph per planet                    │
│  • Procgen template instantiation                  │
│  • Dispatches to: firstPerson / boarding /         │
│    groundRun / turret engines by POI flavor        │
│  • Returns results (loot, kills, quest progress)   │
│                                                    │
│  Uses: all existing engines as render contexts     │
└───────────────────────────────────────────────────┘
```

### Rationale for Layering

- **Meta** uses DOM/React because strategic UI has nothing to do with canvas. Spreadsheets, maps, lists. Reuses existing site design tokens.
- **Exploration** is the open-world engine. `firstPersonEngine.ts` gets a `ColonyContext` pointer injected via adapter, not mixed into core. Campaign FPS levels and colony strolls use the same engine with different contexts.
- **POI/Dungeon** is a small dispatcher that reuses every existing engine. Zero new rendering code. Proven pattern from `phases.ts`.

### Boundaries Between Layers

- **Meta → Exploration**: player *descends* to a colony. State passed via `ColonyId`. Exploration layer pulls the full `ColonyState` fresh.
- **Exploration → POI**: player *fast-travels* or *walks-out* from a colony. `RegionMap` node selected → POI layer instantiates the inner engine.
- All layers write to one save-data root. Each owns its slice. No layer reads another layer's internals — only published state.

### What Doesn't Change

- Existing engines (shooter, boarding, ground-run, turret, first-person, phases) are unchanged except for the `ColonyContext` adapter plumbing in firstPerson.
- Existing save system, damage model, weapon affinity, pilot leveling — colony layer reads them but doesn't modify.

### Why Layered (Over Alternatives)

Two alternatives were considered and rejected:
- **Extend First-Person Engine**: colonies as special FP levels. Rejected — bloats the engine file (already 1575 lines), makes colony-specific features hard to add cleanly.
- **New Top-Level Colony Mode**: one giant colony engine. Rejected — couples management UI with game loop, harder to iterate each independently.

Layered architecture is the only approach where the NPC subsystem can be ripped out and upgraded toward Deep Sim without destabilizing building placement, and where the procgen template engine can be swapped without touching the management UI. It also matches existing codebase idioms (the mode-dispatch pattern in `gameEngine.ts` and `phases.ts`).

---

## Section B — Data Model

The entity shapes that persist to save data. Two principles: **extensible for future Deep Sim** (entity IDs everywhere) and **explicit ownership per layer** (each layer has a slice it's responsible for).

### Top-level save data extensions

```typescript
interface SaveData {
  // ... existing fields unchanged

  colonies: ColonyState[];             // all player-founded colonies
  planets: PlanetState[];              // per-planet context (region maps, unlocks)
  earthShipments: EarthShipment[];     // in-transit shipments
  factionStandings: FactionStanding[]; // reputation per faction
  bounties: Bounty[];                  // active warrants against the player
  missionsSinceStart: number;          // global cycle counter
  gameClock: GameClock;                // day/hour/season tracking
}
```

### ColonyState

```typescript
interface ColonyState {
  id: ColonyId;                        // stable UUID — never reused
  name: string;
  planetId: PlanetId;
  foundingType: "outpost" | "colony" | "stronghold";
  tier: 1 | 2 | 3 | 4;                 // growth ladder
  regionNodeId: RegionNodeId;          // location on planet's node graph

  population: PopulationState;
  resources: ColonyResources;          // local stockpile (separate from global)
  buildings: ColonyBuilding[];
  districts: District[];               // emerge at tier 3+

  namedNpcs: NpcId[];                  // references into global NPC registry
  backgroundColonistDensity: number;   // 0-1, drives ambient spawn count

  happiness: number;                   // 0-100
  selfSufficient: boolean;             // derived, cached for UI
  lastCycleProcessed: number;          // for offline catch-up
  lastGameClock: GameClock;            // time-of-day snapshot on last visit

  activeThreats: Threat[];
  activeQuestlines: QuestId[];
  discoveredPoiIds: RegionNodeId[];

  layoutSeed: number;                  // procgen seed for the FPS town layout
  founded: { missionCount: number; gameClockTick: number };
}
```

### ColonyBuilding

```typescript
interface ColonyBuilding {
  id: BuildingInstanceId;
  type: BuildingType;                  // "farm" | "marketplace" | ...
  tier: 1 | 2 | 3;                     // upgrade level (deferred to post-v1)
  status: "constructing" | "operational" | "damaged" | "offline" | "destroyed";
  buildProgressCycles: number;
  hp: number;
  maxHp: number;
  interiorTemplateId: InteriorTemplateId | null;
  assignedNpcIds: NpcId[];             // named NPCs that "live" here
  districtId: DistrictId | null;       // null at tier 1-2
}
```

### PopulationState

```typescript
interface PopulationState {
  total: number;                       // aggregate count, drives consumption
  capacity: number;                    // from Habitat Modules
  namedCount: number;                  // named NPCs currently alive
  growthRate: number;                  // per cycle, can be negative
  recentDeaths: DeathRecord[];         // last 10, for UI + quest hooks
}
```

### ColonyResources (local stockpile per colony)

```typescript
interface ColonyResources {
  food: number;
  water: number;
  metal: number;
  power: number;                       // realtime capacity — not a stockpile
  credits: number;                     // colony's treasury (separate from player wallet)
}
```

### Npc

```typescript
interface Npc {
  id: NpcId;
  name: string;
  portraitId: string;
  role: "colonist" | "merchant" | "quest_giver" | "governor" | "guard" | "story";
  colonyId: ColonyId | null;
  homeBuildingId: BuildingInstanceId | null;
  workBuildingId: BuildingInstanceId | null;
  schedule: ScheduleEntry[];
  dialogTreeId: DialogTreeId;
  questIds: QuestId[];
  mood: Mood;
  relationships: Record<NpcId, number>; // stub for Deep Sim
  alive: boolean;
  killedBy: "player" | "hollow" | "natural" | null;
}

interface ScheduleEntry {
  startHour: number;                   // 0-23
  endHour: number;
  locationType: "building" | "district" | "wandering";
  locationId: string;
  activity: "working" | "sleeping" | "socializing" | "traveling";
}
```

### RegionMap / POI

```typescript
interface PlanetState {
  id: PlanetId;
  regionMap: RegionMap;
  biome: PlanetBiome;
  campaignUnlocked: boolean;
}

interface RegionMap {
  nodes: RegionNode[];
  edges: [RegionNodeId, RegionNodeId][];
}

interface RegionNode {
  id: RegionNodeId;
  type: "colony_site" | "ruins" | "hollow_bunker" | "cave" | "crash_site" |
        "raider_outpost" | "neutral_village" | "wilderness" | "anomaly" |
        "abandoned_colony";
  discovered: boolean;
  authored: boolean;                   // true = hand-built landmark
  templateId: TemplateId | null;
  seed: number;                        // deterministic RNG
  cleared: boolean;
  respawnMissions: number | null;      // respawn interval in cycles
  coords: { x: number; y: number };
  elevationMetadata: ElevationMeta | null;
}

interface ElevationMeta {
  authoredTemplateId: TemplateId;
  overrideName: string;
  questlineId: QuestId;
  requiredCampaignState: string | null;
}
```

### EarthShipment

```typescript
interface EarthShipment {
  id: ShipmentId;
  contents: Partial<ColonyResources & PlayerMaterials>;
  eta: { missionCount: number };
  interceptionChance: number;
  interceptionTriggered: boolean;
  destinationColonyId: ColonyId;
  costPaid: number;
}
```

### FactionStanding & Bounty (consequence system)

```typescript
interface FactionStanding {
  factionId: FactionId;                // "earth_command" | "ashfall_camp" | ...
  standing: number;                    // -100 to +100
  rank: "hostile" | "hated" | "neutral" | "liked" | "allied";
  permissions: string[];
}

interface Bounty {
  id: BountyId;
  colonyId: ColonyId;
  amount: number;
  reason: "murder" | "theft" | "trespass" | "treason";
  witnesses: NpcId[];
  issued: { missionCount: number };
  expired: boolean;
}
```

### GameClock

```typescript
interface GameClock {
  totalMissions: number;
  day: number;
  hour: number;                        // 0-23
  minute: number;                      // 0-59
  realtimeMsPerGameMinute: number;     // tuning knob for day/night pace
  season: "standard" | "storm" | "bloom" | "deadzone";
}
```

### Data Model Design Rules

- Every NPC has a stable ID, even background-style ones that get promoted later.
- Colony resources / player inventory / combat materials stay separate — three distinct wallets.
- Procgen POIs store `seed` + `templateId` — deterministic, tiny save footprint, consistent across visits.
- Consequence data is first-class (`killedBy`, `witnesses`, `Bounty`, `FactionStanding`).
- GameClock is separate from `missionsSinceStart` — coarse (cycles) and fine (hours) clocks run independently.

---

## Section C — The Three Layers In Detail

### File layout

```
game/app/components/
├── engine/                              # existing, mostly unchanged
│   ├── gameEngine.ts
│   ├── groundEngine.ts
│   ├── boardingEngine.ts
│   ├── firstPersonEngine.ts             # extended via ColonyContext adapter
│   ├── turretEngine.ts
│   ├── phases.ts
│   └── ...
│
├── colony/                              # NEW — all three layers live here
│   ├── meta/                            # LAYER 1 (React, no canvas)
│   │   ├── ColonyGalaxyMap.tsx
│   │   ├── ColonyPlanner.tsx
│   │   ├── ColonyDetailsPanel.tsx
│   │   ├── EarthShipmentsPanel.tsx
│   │   ├── FactionDashboard.tsx
│   │   └── BountyBoard.tsx
│   │
│   ├── exploration/                     # LAYER 2 (extends firstPerson)
│   │   ├── colonyContext.ts
│   │   ├── colonyLayout.ts
│   │   ├── npcScheduler.ts
│   │   ├── dayNightRenderer.ts
│   │   ├── buildingEntry.ts
│   │   ├── consequenceTracker.ts
│   │   └── districtNavigator.ts
│   │
│   ├── poi/                             # LAYER 3 (dispatches to existing engines)
│   │   ├── regionMap.ts
│   │   ├── poiDispatcher.ts
│   │   ├── templates/
│   │   │   ├── firstPersonTemplates.ts
│   │   │   ├── boardingTemplates.ts
│   │   │   ├── groundRunTemplates.ts
│   │   │   ├── turretTemplates.ts
│   │   │   └── interiorTemplates.ts
│   │   └── poiOutcomes.ts
│   │
│   ├── shared/
│   │   ├── colonyReducer.ts             # all state mutations go through here
│   │   ├── colonyEvents.ts
│   │   ├── cycleProcessor.ts
│   │   ├── factionLedger.ts
│   │   ├── colonyTypes.ts               # all TS interfaces
│   │   └── colonyAssert.ts              # console.assert self-tests
│   │
│   └── index.ts                         # public API — only export point
```

**Public API rule:** anything outside `colony/` imports only from `colony/index.ts`. Internal layers import each other through `shared/`.

### Layer 1 — Meta

**Responsibility:** All strategic/planning UI. No game loop. No canvas. Pure React against the save-data store.

**Public API surface:**

```typescript
export function listColonies(): ColonyState[];
export function getColony(id: ColonyId): ColonyState;
export function commissionBuilding(
  colonyId: ColonyId, type: BuildingType, slotHint?: SlotHint
): CommissionResult;
export function cancelCommission(buildingId: BuildingInstanceId): void;
export function orderEarthShipment(
  colonyId: ColonyId, contents: ShipmentContents
): ShipmentResult;
export function promoteTier(colonyId: ColonyId): PromotionResult;
```

Every mutation goes through `colonyReducer` in `shared/` — the meta UI never mutates `ColonyState` directly. Reducer validates invariants (cost affordable, tier requirement met, no duplicate building types where disallowed) and either commits or returns a typed error.

**UI composition:**

```
ColonyGalaxyMap
  ├── PlanetMarkers (status dots, attack warnings, shipment ETAs)
  └── on click → planet detail panel
        └── ColonyList
              └── on click → ColonyPlanner
                    ├── ResourceBar
                    ├── GridView
                    ├── BuildingMenu
                    ├── NpcRoster
                    └── "Descend" button → triggers Layer 2
```

### Layer 2 — Exploration

**Responsibility:** Walking the colony in first-person. The open-world engine. Reuses `firstPersonEngine.ts` by passing it a `ColonyContext` — a parameter object the FP engine treats as optional.

**The adapter pattern (critical):**

```typescript
// firstPersonEngine.ts gets ONE new optional field on its state:
interface FirstPersonState {
  // ... existing fields
  colonyContext?: ColonyContext;   // optional, opaque to FP core
}

// colony/exploration/colonyContext.ts
interface ColonyContext {
  colonyId: ColonyId;
  getNpcPositions(hour: number): NpcWorldPosition[];
  onBuildingEntered(buildingId: BuildingInstanceId): TransitionDirective;
  onNpcInteracted(npcId: NpcId): DialogSession;
  onPlayerAttack(targetId: EntityId): void;
  onDistrictCrossed(from: DistrictId, to: DistrictId): void;
}
```

The FP engine only *calls* context methods — it doesn't know anything about colonies. Same engine runs campaign FPS levels (`colonyContext === undefined`) and open-world colony strolls (`colonyContext` populated). Zero branching in core code; all colony logic lives in the adapter.

**Entry flow (descend from meta):**

1. Meta UI dispatches `descendToColony(colonyId)`.
2. `Game.tsx` switches `currentMode` to `"colony-exploration"`.
3. `colonyLayout.ts` generates (or retrieves cached) raycaster tile map from `ColonyState.buildings` + `layoutSeed`.
4. `npcScheduler.ts` positions NPCs for current `GameClock.hour`.
5. `firstPersonEngine` starts with populated `ColonyContext`.
6. Player walks, interacts, leaves.

**Consequence tracking:**

- `consequenceTracker` subscribes to FP engine events (attack, kill, theft, trespass).
- On event: walks nearby NPC list, flags any with line-of-sight as witnesses.
- Issues a `Bounty` via `colonyReducer`, adjusts `FactionStanding`.

### Layer 3 — POI / Dungeon Dispatcher

**Responsibility:** When the player fast-travels to a region POI, pick the right engine and hand it the template-instantiated content.

**Dispatch table (lives in `poiDispatcher.ts`):**

```typescript
const POI_ENGINE_MAP: Record<PoiType, EngineKind> = {
  ruins:             "firstPerson",
  hollow_bunker:     "boarding",
  cave:              "groundRun",
  mine:              "groundRun",
  crash_site:        "firstPerson",
  raider_outpost:    "firstPerson",
  neutral_village:   "firstPerson",
  wilderness:        "firstPerson",
  anomaly:           "firstPerson",
  abandoned_colony:  "firstPerson",
  siege_defense:     "turret",
};
```

**Template instantiation:**

```typescript
function enterPoi(node: RegionNode): PoiSession {
  const engine = POI_ENGINE_MAP[node.type];
  const template = node.authored
    ? loadAuthoredLandmark(node.templateId)
    : loadProcgenTemplate(engine, node.type, node.seed);

  const instance = instantiate(template, { seed: node.seed, tier: currentColonyTier });

  return dispatchTo(engine, instance);
}
```

**Outcomes:** On POI completion, the inner engine returns a `PoiOutcome` (`{ killed: EntityKillRecord[], looted: LootDrop[], questProgress: QuestEvent[], playerDied: boolean }`). `poiOutcomes.ts` folds these into save data.

### Cross-Layer: the `colonyReducer`

All state changes — from all three layers — go through one function:

```typescript
function colonyReducer(state: SaveData, event: ColonyEvent): SaveData;

type ColonyEvent =
  | { type: "colony/founded"; payload: ... }
  | { type: "colony/buildingCommissioned"; payload: ... }
  | { type: "colony/cycleAdvanced"; payload: ... }
  | { type: "colony/npcKilled"; payload: ... }
  | { type: "colony/witnessed"; payload: ... }
  | { type: "colony/attackIncoming"; payload: ... }
  | { type: "colony/poiCleared"; payload: ... }
  | ... (~30 event types total)
```

**Why this matters:**
- Single place to audit state changes — debugging is trivial.
- Event log is automatically a replay — useful for tests, save migration.
- Each event has a console.assert invariant check.
- Matches existing Sector Zero `console.assert` convention.

### Boundary enforcement

| Layer | Writes to save data? | Reads from save data? | Talks to other layers? |
|---|---|---|---|
| Meta | Only via reducer events | Yes, freely | Dispatches "descend" to Exploration |
| Exploration | Only via reducer events | Yes, freely | Dispatches "enter POI" to POI layer |
| POI | Only via reducer events (outcomes) | Reads colony + region state | Returns results to Exploration |
| Reducer | **Only writer** | Reads prior state | N/A |

---

## Section D — Simulation Rules

### Two clocks, running together

| Clock | Unit | Advances when |
|---|---|---|
| **Cycle clock** (`missionsSinceStart`) | 1 cycle = 1 completed mission | Mission cleared (ONLY trigger) |
| **Game clock** (`day/hour/minute`) | real seconds while in colony | Only while `currentMode === "colony-exploration"`; frozen elsewhere |

The game clock is purely presentational — it never advances `missionsSinceStart` or drives cycle logic. Resource ticks, threat progression, shipments, population — all cycle-clock-driven.

When the player walks out of a colony, the game clock snapshot is stored in `ColonyState.lastGameClock`. On return, the clock resumes from snapshot unless ≥1 cycles have passed, in which case it jumps to a canonical morning time (7:00 AM).

### Cycle advancement — per-colony pipeline

When `missionsSinceStart` increments, `cycleProcessor.ts` runs this pipeline per colony, in order:

```
1. RESOURCE PRODUCTION
   For each operational building: apply output to colony.resources.
   Power is realtime capacity — recomputed, not stockpiled.

2. POPULATION CONSUMPTION
   food -= population.total * 1
   water -= population.total * 0.5
   Shortage → happiness hit.

3. BUILDING UPKEEP
   For each building: apply upkeep cost.
   If power demand > supply → random buildings go "offline" until fixed.

4. POPULATION CHANGE
   Apply growth rate (from happiness) → newborns / departures.
   If happiness < 25 → collapse countdown.

5. HAPPINESS RECOMPUTE
   Sum all modifiers. Clamp 0-100.

6. THREAT PROGRESSION
   For each activeThreat: advance timer.
   Uncleared bunkers can spawn new threats.

7. EARTH SHIPMENT TICK
   For each shipment: eta--. Interception rolls at eta=1. Arrivals at eta=0.

8. QUEST TICK
   Time-limited quests count down; expired → failed.

9. BOUNTY DECAY
   Bounties older than 20 cycles → 10% chance/cycle to expire.

10. EMIT "colony/cycleAdvanced"
    Invariant assertions fire in dev builds.
```

Each step is a pure function. Each is independently unit-testable. Whole pipeline is idempotent-per-cycle.

### Offline catch-up

Player ignores Colony X for 8 cycles while running campaign missions elsewhere. When they check it:

```typescript
function catchUpColony(colony: ColonyState, currentCycle: number): void {
  const missed = currentCycle - colony.lastCycleProcessed;
  for (let i = 0; i < missed; i++) {
    processCycle(colony, colony.lastCycleProcessed + i + 1);
  }
}
```

One cycle at a time. No shortcuts. Because cycles only fire from missions, and missions trigger simultaneously across all colonies, this function typically runs with `missed = 0` or `1` — the only case missed > 1 is on save load after a migration.

### NPC schedule system

Schedules evaluated lazily — not ticked every frame. When the player enters a colony OR an hour boundary crosses, `npcScheduler.ts` computes positions:

```typescript
function resolveNpcPosition(npc: Npc, clock: GameClock): NpcWorldPosition {
  const entry = npc.schedule.find(
    e => clock.hour >= e.startHour && clock.hour < e.endHour
  ) ?? defaultEntry(npc);

  switch (entry.locationType) {
    case "building":
      return interiorPointFor(entry.locationId);
    case "district":
      return wanderingPointIn(entry.locationId, seededFrom(npc.id, clock.day));
    case "wandering":
      return wanderingPointIn(npc.colonyId, seededFrom(npc.id, clock.day, clock.hour));
  }
}
```

- Seeded RNG on NPC + day/hour keeps wandering NPCs consistent within a timeframe.
- Default background-colonist schedule: residential 7-9am, work 9-5pm, market 5-7pm, residential 7-11pm, home 11pm-7am.
- Named NPCs get hand-authored schedules.

### Consequence propagation — witness to bounty

```
1. firstPersonEngine detects player hit on NPC entity
2. Calls colonyContext.onPlayerAttack(targetId, playerEntity)
3. consequenceTracker:
     a) finds all alive NPCs within WITNESS_RADIUS (8 tiles)
        AND with line-of-sight
     b) marks each as witness
     c) classifies severity: assault / murder / mass_killing
4. colonyReducer dispatches:
     - "colony/npcAttacked" / "colony/npcKilled"
     - "colony/witnessed" for each witness
5. factionLedger updates:
     - colony's primary faction: standing -= severity penalty
     - Earth-affiliated colonies: earth_command standing too
6. If witnesses > 0 AND victim non-hostile:
     - create Bounty { amount, witnesses, reason }
     - attach to colony's bounty list
7. Next time player enters colony or adjacent colony:
     - guards check bounties on entry
     - standing "hostile"/"hated" spawns hunters at wilderness POI
```

Silencing witnesses is a valid strategy. Witnesses flee toward Town Hall to report. Catch them before they arrive → testimony lost, bounty voided (after 2-cycle timeout).

### Faction standing ranks

| Standing | Rank | Effect |
|---|---|---|
| 80..100 | Allied | +10% prices, unique dialog, faction quests, armed backup |
| 40..79 | Liked | +5% prices, friendly dialog, personal quests |
| -39..39 | Neutral | Default |
| -79..-40 | Hated | Guards shadow you, merchants refuse, 2x essentials |
| -100..-80 | Hostile | Kill-on-sight, bounty hunters spawn, banned from colony |

Every delta fires `colony/standingChanged` event for dialog/quest triggers.

### Population dynamics

```
newborns_per_cycle = happiness > 60
                   ? floor(total * 0.02 * happinessFactor) : 0
departures = happiness < 40
           ? floor(total * 0.05 * (40-happiness)/40) : 0
deaths = baseDeathRate + disasterDeaths + raidDeaths - medBayReduction
```

Named NPCs have individual death rolls + vulnerability from attacks/raids. A named death emits `colony/namedNpcDied` → potential funeral event, quest chain from relatives. Background colonists aggregately tracked.

### Threat progression

- **RaidIncoming**: N cycles until Hollow raid; resolved by defense mission or auto-battle.
- **SiegeOngoing**: resource drain + damage each cycle until repelled.
- **DisasterActive**: biome-specific effect each cycle for N cycles.
- **SupplyDisruption**: Earth shipments delayed globally.

Threats emit warning events on awareness horizon (1 cycle early normally, 2 with Radar Array).

### Invariants — asserted every cycle in dev builds

```typescript
assertColonyInvariant(c,
  c.resources.food >= 0 || c.happiness < 100,
  "Starving colony cannot be fully happy"
);
assertColonyInvariant(c,
  c.population.total <= c.population.capacity + HABITAT_OVERFLOW,
  "Population exceeded sane maximum"
);
assertColonyInvariant(c,
  c.buildings.filter(b => b.status === "operational")
    .every(b => hasPower(b, c)),
  "Operational building without power"
);
```

Matches existing Sector Zero `console.assert` self-test convention. Every simulation bug has an invariant catching it.

---

## Section E — Building Catalog & Interior Tiers

Daggerfall enterability: **every building has at minimum a stub interior**.

### Interior tiers

| Tier | Name | What's inside | Authoring effort |
|---|---|---|---|
| **1** | Stub | Single small room, 1 functional prop, zero NPCs | Minutes per building |
| **2** | Panel | 1 room + 1 NPC OR 1 full-screen UI panel | Hours per building |
| **3** | Walkable | 2-3 rooms, 1-2 NPCs, usable facility | ~1 day per building |
| **4** | Hub | 4+ rooms, 3+ NPCs, quest hooks | ~3 days per building |

### Full catalog

#### Survival — core resource producers

| Building | Tier | Unlock | Role |
|---|---|---|---|
| Solar Array | 1 | Outpost | Power generation (stub: monitoring shack) |
| Farm | 1 | Colony | Food production (stub: foreman's shed) |
| Water Purifier | 1 | Any | Water production (stub: pump controls) |
| Mine | 2 | T2 tier | Metal production, single-panel + foreman NPC |
| Refinery | 3 | T3 city | Convert metal → rare combat materials; foreman + 2 workers + risk panel |

#### Civilian — population, growth, commerce

| Building | Tier | Unlock | Role |
|---|---|---|---|
| Habitat Module | 3 | Colony | Walkable living quarters; 1-2 named colonists + personal quest hooks |
| Med Bay | 3 | T2 tier | Doctor + heal station + consumables + surgery room |
| Marketplace | 4 | T2 tier | Bazaar: weapons dealer, consumables vendor, materials buyer, quest broker |
| Cantina | 4 | T2 tier | Drinks + rumors + regulars + rotating strangers with quests |
| Town Hall | 4 | T3 tier | Governor + petitioners + policy decisions + colony narrative events |

#### Military — defense

| Building | Tier | Unlock | Role |
|---|---|---|---|
| Barracks | 3 | Stronghold / T2 | Drill sergeant + militia roster + defense contracts + readiness |
| Turret Defense | 1 | Stronghold / T2 | Auto-defense — stub: control room |
| Shield Generator | 1 | T3 tier | First-wave absorber — stub: reactor control |
| Radar Array | 1 | T2 tier | Warning system — stub: operator's desk |

#### Infrastructure — enables advanced systems

| Building | Tier | Unlock | Role |
|---|---|---|---|
| Comms Tower | 2 | T2 tier | Earth shipment hub + long-range quests; single-panel "Earth Channel" |
| Spaceport | 1 | T3 tier | Colony-to-colony transfer — stub: dispatcher control |
| Research Lab | 2 | T3 tier | Tech tree + head scientist NPC; research panel |
| Atmosphere Processor | 1 | T4 tier | Late-game terraforming — stub: coolant room |

#### Civic — walkable environmental content (unlock at T3)

| Content | Role |
|---|---|
| Plaza | Event trigger space: festivals, executions, memorials |
| Park | Ambient walk space, benches, happiness buff, rumor overhears |
| Monument | Lore object; remembers fallen crew/ships |
| Promenade | Walkable path between districts; stall vendors, buskers |
| Landmark | Unique, one-per-capital; hand-authored story anchor |

**Total: 20 building types + 5 civic types = 25 placeable elements.**

### How commissioning works

```
1. Player in ColonyPlanner UI clicks "Build Marketplace"
2. Meta layer calls commissionBuilding(colonyId, "marketplace")
3. colonyReducer validates tier, resources, slot availability
4. On success: deducts resources, emits colony/buildingCommissioned
   Building added to colony.buildings, status="constructing", progress=3
5. Next cycle tick: buildProgressCycles--
6. When =0: status="operational"
     - emits colony/buildingCompleted
     - invalidates colony layout cache → next descent regenerates FPS town
     - assigns default NPCs
     - unlocks gated quests
```

Construction is visible in FPS — half-built structures render as scaffolding + progress indicator.

### Interior templates

Each building type has 1-5 interior templates (biome variants for flavor). Template chosen at construction time (seeded). Once chosen, locked.

```typescript
interface InteriorTemplate {
  id: InteriorTemplateId;
  buildingType: BuildingType;
  biomeFilter: PlanetBiome[] | "any";
  tileMap: number[][];
  npcSlots: NpcSlotDef[];
  propSlots: PropDef[];
  interactionPoints: InteractionDef[];
}
```

---

## Section F — Regions, POIs, and Quests

### Region map per planet

Each planet has a hand-authored region graph with procgen POIs slotted into it. Discrete nodes, fast-travel between them — not continuous outdoor terrain.

**POI count per colony tier:**
- T1 (newly founded): 2-3 POIs revealed
- T2: 4-6 POIs
- T3 city: 7-10 POIs across 2 rings
- T4 capital: 10-15 POIs, full planetary map

**Discovery triggers:**
- Campaign mission completion reveals 1-2 relevant POIs
- Radar Array building reveals distant POIs
- NPC dialog hints reveal specific POIs
- Random encounters during fast-travel reveal adjacent nodes

### POI types

| Type | Engine | v1 templates | Respawn |
|---|---|---|---|
| Ruins | firstPerson | 5 | Cleared once, stays cleared |
| Hollow Bunker | boarding | 5 | Regenerates every 10 cycles if not demolished |
| Cave / Mine | groundRun | 4 | Resource nodes respawn every 5 cycles |
| Crash Site | firstPerson | 3 | One-time; loot expires after 3 cycles |
| Raider Outpost | firstPerson | 4 | Regenerates 20 cycles after clearing |
| Neutral Village | firstPerson | 3 (persistent) | Never respawns |
| Wilderness Zone | firstPerson | 2 | Always available; seasonal variance |
| Anomaly | firstPerson | 3 (special) | One-time |
| Abandoned Colony | firstPerson | 2 (larger) | One-time; becomes refoundable |
| Siege Defense | turret | 2 | Triggered by attack event |

**Total v1 template burden: ~33 across 4 engines.**

### Template anatomy

```typescript
interface PoiTemplate {
  id: TemplateId;
  engineKind: "firstPerson" | "boarding" | "groundRun" | "turret";
  poiType: PoiType;
  biomeFilter: PlanetBiome[] | "any";
  difficultyRange: [number, number];
  tileMap: number[][];
  enemySlots: EnemySlotDef[];
  lootSlots: LootSlotDef[];
  npcSlots: NpcSlotDef[];
  eventHooks: EventHookDef[];
  requiredClearCondition: ClearCond;
  elevationMetadata: ElevationMeta | null;
}
```

**Procgen instantiation:** seeded by `RegionNode.seed`. Same seed → same result. Deterministic.

### Authored landmark elevation

Any procgen POI can be "elevated" to hand-authored content by adding `elevationMetadata`. Loading then ignores procgen and uses authored template. **The 8 launch-day landmarks (one per campaign world) have elevationMetadata baked in from start.**

### Quest system

Four quest sources:

| Source | Authoring | Length | Storage |
|---|---|---|---|
| **Main campaign** | Hand-authored | Multi-mission arcs | Global questlog |
| **Named NPC** | Hand-authored | 1-3 missions | Colony-scoped |
| **Bulletin Board** | Procgen | 1 mission | Colony-scoped, regenerates |
| **Emergent** | Reactive, event-triggered | 1 mission, urgent | Global, auto-cleanup |

**Bulletin board procgen templates:** "Clear Hollow Bunker at [POI]", "Escort Shipment from [Colony] to [Colony]", "Collect 10 [Resource]", "Bounty on [NPC]", "Rescue missing colonist from [POI]".

**Emergent examples:**
- Player kills merchant → merchant's brother posts revenge bounty
- Hollow raid damages Barracks → militia captain requests emergency defense contract
- Research Lab cycle complete → scientist invites player to test new tech
- Colony reaches T3 → governor requests attendance at promotion ceremony
- Supply line intercepted → recover-lost-shipment quest appears

**Quest structure:**

```typescript
interface Quest {
  id: QuestId;
  title: string;
  source: "campaign" | "npc" | "board" | "emergent";
  issuerNpcId: NpcId | null;
  colonyId: ColonyId | null;
  objectives: Objective[];
  rewards: QuestReward;
  deadlineCycles: number | null;
  state: "available" | "active" | "complete" | "failed" | "expired";
  prerequisiteQuestIds: QuestId[];
  gateConditions: GateCondition[];
  hiddenUntilTriggered: boolean;
}
```

Active quest cap: 12 simultaneous (soft, UX warning after).

### Random encounters during fast-travel

- 70% nothing
- 20% ambient encounter (merchant on road, Hollow patrol spotted)
- 8% combat encounter (brief skirmish in firstPerson or groundRun)
- 2% rare event (unique NPC, mystery → unlocks POI)

Encounters brief (~30 sec) — not friction.

### Biome flavor

Each of 8 planets has a biome that shapes:
- POI template filtering (no caves on gas planets)
- Enemy palette (Ice biome: frost-resistant Hollow variants)
- Disaster types
- Ambient colonist dialog
- Building visual variants

Biome is a data layer — a `PlanetBiome` enum with associated asset/dialog tables. Adding a 9th biome later = writing tables, not building systems.

---

## Section G — Economy Wiring

### Three value types

| Type | Examples | Holder | Spent on |
|---|---|---|---|
| **Credits** | — | Player wallet + each colony treasury | Markets, Earth shipments |
| **Colony Resources** | Food, Water, Metal, Power | Per-colony stockpile | Construction, upkeep, survival |
| **Combat Materials** | kinetic-core, energy-cell, incendiary-plasma, cryo-shard | Player inventory | Ship upgrades ONLY |

**Critical rule:** these three types never directly interchange except through named conversion buildings.

### Two credit wallets

| Wallet | Source | Spending |
|---|---|---|
| **Player Wallet** | Mission rewards, quest rewards, selling | Any shop anywhere, Earth shipments, bribes |
| **Colony Treasury** | Marketplace income, tax policy | Earth shipments initiated by colony, emergency hires, bribing attackers |

Player can deposit to treasury (reputation gain) and withdraw (governor's approval, standing-dependent). Treasuries are NOT fungible between colonies — local only. Moving credits requires Spaceport + shipment cycle.

### Mission reward structure (unified)

Every mission grants: **Pilot XP + Credits + Combat Materials + Colony Resources**.

Colony resource weighting by mission type:
- **Shooter** → Metal + Credits (salvage)
- **Ground Run** → Food + Water (scavenging)
- **Boarding** → Rare combat materials + tech blueprints
- **First-Person Exploration** → Mixed, often unique loot
- **Turret (escort)** → Credits + delivered resources

This unifies the mission → colony feedback loop.

### Refinery — sole converter

The Refinery (Tier 3 walkable) is the ONE place where colony resources bleed into combat materials:

```
20 Metal  → 1 Kinetic-Core        (safe, 2-cycle delay)
40 Metal + 5 Power  → 1 Energy-Cell      (10% failure)
50 Metal + 20 Food  → 1 Incendiary-Plasma (20% failure)
80 Metal + 30 Water → 1 Cryo-Shard       (30% failure)
```

Gated behind Tier 3 city. Higher-tier materials = higher failure chance.

### Markets — extending existing shops

The existing Ashfall shop system becomes the template for all Marketplace interiors. `firstPersonEngine` shop code is refactored (minimally) to accept a `marketContext` parameter:

```typescript
interface MarketContext {
  colonyId: ColonyId;
  merchantsPresent: NpcId[];
  priceModifiers: PriceModifier[];
  stockTables: StockTable[];
  buybackEnabled: boolean;
}
```

A Marketplace in T2 Colony has 2 merchants. In T4 Capital has 6, plus quest broker, plus stalls in adjacent Promenade. Same code, driven by data.

**Dynamic pricing:**
- Base price from item table
- × supply/demand modifier
- × faction standing modifier (-20% to +20%)
- × event modifier (post-raid: essentials +50%)

### Earth shipments — cycle-based

| Campaign Phase | Delivery | Cost | Interception |
|---|---|---|---|
| Early (W1-W3) | 2 missions | 100-300c | 0% |
| Mid (W4-W5) | 4 missions | 300-600c | 20% |
| Late (W6-W7) | 6 missions | 600-1000c | 40% |
| Endgame (W8) | 8+ missions | 1000+c | 60% |

**Interception choice (at ETA-1):**
1. Let it happen → shipment lost, credits forfeit
2. Escort (Turret defense) → success = shipment + bonus salvage
3. Bribe (late-game, requires faction intel) → 2× cost, shipment arrives

Escort missions are a generated content stream — always available.

### Comms Tower — critical unlocker

Without Comms Tower: colony cannot receive shipments. With: full access. Makes it a non-trivial early investment (150 Metal, 40 Power, 2 cycles) and a high-value infiltrator target.

### Colony income

```
credits_per_cycle = population * 2
                  * happinessMultiplier (0.3 to 1.5)
                  * factionStandingMultiplier (0.8 to 1.2)
```

T4 Capital, 1500 pop, thriving = ~4500 credits/cycle into treasury.

### Cross-colony transfers (Spaceport)

- Cost: 1 cycle delivery
- Max: 500 units resource OR 1000 credits per transfer
- Fee: 10%
- Risk: 0% (internal supply line)

### Mission reward → colony mapping

Player picks a "destination colony" pre-mission. Makes colony strategy immediate.

---

## Section H — Strategic Campaign Integration

### The bidirectional loop

```
SHIP MISSION  →  MISSION COMPLETE  →  BETWEEN MISSIONS  →  SHIP MISSION
     ↑                                                          ↓
     └──  buffs, tech, intel, loadout driven by colony state  ─┘
```

### Pre-mission buffs

Concrete, measurable:

- Operational Barracks → +1 AI wingman for 1 mission, 3-cycle cooldown
- Research Lab cycle complete → spend research points on tech tree
- Refinery operational → converts Metal → combat materials over cycles
- Allied Neutral Village (+40 standing) → free repair before mission + 5% credit reward bonus
- Stronghold on mission's planet → +15% damage reduction
- Med Bay on destination → +1 in-mission revive
- Town Hall T3+ → "Request Support": spend treasury for orbital strike mid-mission
- Comms Tower operational → real-time intel overlay (enemy count + affinity visible)
- 3+ colonies on same planet → "Planetary Sovereignty": +10% rewards from that planet's missions

### Emergent mission types — colony-generated content

8 templated types, procgen per colony per cycle:

| Trigger | Mission Type | Engine |
|---|---|---|
| Raid incoming | Defense | Turret OR ground-based |
| Shipment interception | Escort | Turret |
| Missing colonist at POI | Rescue | First-person OR ground-run |
| Shipment wreck | Recovery | First-person |
| Bounty (player crime OR NPC hire) | Bounty | First-person |
| Radar detects new POI | Scout | First-person |
| Uncleared Raider Outpost | Raid | First-person OR ground-run |
| Uncleared Hollow Bunker | Breach | Boarding |

Solves "we need more missions" — the more colonies you have, the more content the world offers.

### Campaign gates — soft-gated missions

- **W4+ missions** require any Tier-2+ Colony
- **W6+ missions** require any operational Refinery
- **W8 final assault** requires 2+ Tier-3+ cities

Gates soft — alternatives exist (buy via Earth, grind raids). But colony-building is intended path.

### Endgame — multi-ending placeholder (open question)

| Ending | Condition |
|---|---|
| **Humanity Endures** ⭐ canonical | Beat W8 boss + ≥1 Tier-4 Capital survives endgame assault |
| **Fortress Earth** (best) | Beat W8 boss + 3+ Tier-4 Capitals survive |
| **Lone Survivor** (dark) | Beat W8 boss, all colonies lost |
| **Hollow Victory** (failure) | W8 boss beaten, Capital fell |
| **Pyrrhic Victory** | W8 beaten, <50% colonies survive |

**Note:** per open questions, this is a placeholder. Post-v1 playtesting may redesign the endgame for an open-world model.

### Hollow attack scaling with campaign

| World | Frequency | Strength |
|---|---|---|
| W1-W2 | 1/10 cycles | Raid |
| W3-W4 | 1/6 cycles | Raid or Siege |
| W5-W6 | 1/4 cycles | Siege likely |
| W7-W8 | 1/2 cycles | Major assault; Capital siege possible |

Frontier colonies get hit more often than core-world colonies.

### Cross-system integrations

| Existing system | Extended by colony system |
|---|---|
| `save.ts` | New top-level fields (Section B) |
| `firstPersonEngine.ts` | `ColonyContext` adapter (optional) |
| `dialog.ts` / `crewDialog.ts` | Extended trees; reputation-aware branches |
| `enemyClasses.ts` | New enemy class: Raider (human faction) |
| Shops at Ashfall | Generalized into Marketplace interior template |
| Mission select UI | Gains "emergent" tab alongside "campaign" |
| Cockpit hub | New station: COLONIES |
| Multi-phase (`phases.ts`) | Unchanged; POI dispatcher uses same pattern |
| Pilot leveling | Research Lab → bonus XP per cycle |

No rewrites. Everything additive.

---

## Section I — UX Flow

### Navigation model

```
COCKPIT HUB (persistent)
  ├── MISSIONS → Mission Select
  ├── COLONIES → Galaxy Map → Planet View → Colony Detail
  │                                            ├── Planner (grid UI)
  │                                            └── Descend (FPS)
  │                                                  ├── Building Interior
  │                                                  └── POI (region node)
  │                                                        └── inner engine
  └── UPGRADES → Ship Lab
```

### Principles

- **One-click deep-dive.** ≤4 clicks from cockpit to walking inside a Marketplace.
- **Always-visible back-to-cockpit affordance.**
- **Cockpit hub never taken away.** All in-progress state surfaces via HUD badges.
- **Seamless engine transitions.** Building entry = fade-to-black cinematic (same as multi-phase). No clumsy loading screens.
- **HUD discipline.** Each layer has unified HUD style. Colony meta is DOM, colony FPS reuses firstPerson HUD + colony overlay.

### Canonical flow

```
1. Cockpit. COLONIES station badge pulses: "3 new events."
2. Click → Galaxy Map. Planet status dots, attack warnings.
3. Click planet → Planet view. Ashfall Capital shown.
4. Click Ashfall → Colony Detail: resources, pop, happiness, threats.
5. [PLAN] opens ColonyPlanner (grid UI); [DESCEND] transitions to FPS.
6. DESCEND → fade → "APPROACHING ASHFALL CAPITAL" cinematic.
7. Lands at pad. Time: 14:32. Weather: light dust.
8. Walk to Marketplace. Door prompt.
9. Press Z → fade → inside Marketplace. NPCs at counters.
10. Buy, sell, board quest accepted.
11. Leave → back in colony FPS. Real time advanced ~12 min.
12. Fast-travel to Ruins POI → inner firstPerson → combat → return.
13. Exit colony (TAKE OFF from pad) → fade → cockpit.
14. Cockpit COLONIES badge: "+40 metal, shipment ETA 2."
```

### Mission select flow — two tabs

```
┌─────────────────────────────────────┐
│  [CAMPAIGN]  [EMERGENT (3)]         │
│                                      │
│  World 2 · Level 3                  │
│  Approach Capital Ship [Multi-Phase]│
│  Rewards: ~500c, 30 metal, lv2 mats│
│  Destination colony: [Ashfall ▼]    │
│  [ LAUNCH ]                          │
└─────────────────────────────────────┘
```

### Colony Planner UX

```
ASHFALL CAPITAL · TIER 3 · POP 186/240
Food: 450 (+20/cycle)  Water: 300 (+15)
Metal: 120 (+8)        Power: 42/50
Happiness: 72 (Stable)  Faction: +34 (Liked)
─────────────────────────────────────
[PLANNED COMMISSIONS]     [BUILDING MENU]
 ▸ Barracks (2/3 cycles)   ▸ Survival  ▼
 ▸ Habitat Mod (1/1)       ▸ Civilian  ▼
                           ▸ Military  ▼
[OPERATIONAL BUILDINGS]    ▸ Advanced  ▼
 • Farm × 3                ▸ Civic     ▼
 • Marketplace
 • Med Bay ⚠ (damaged)
 • Solar Array × 2

[ THREATS ] 1 incoming raid in 4 missions
[ SHIPMENTS ] 1 en route from Earth (ETA 3)
[ DESCEND ]  [ BACK TO GALAXY ]
```

No canvas. React components. Tokens from `site/app/globals.css` reused.

### Colony FPS HUD

```
HP ██████░░    [day 12 · 14:32]      FAC:+34
                                              
            (FPS VIEW)                        
                                              
Nearby: Kadri (merchant) · Harlow (governor)
[Z] INTERACT    [M] MAP    [F] FAST TRAVEL
```

- Time-of-day top HUD
- Faction standing always visible (delta animation on events)
- Nearby-NPC hint shows named NPCs within ~8 tiles
- Quick keys: M = region map, F = fast-travel, Z = context interact

### First-time onboarding

1. Ashfall Forward Camp (existing content) becomes first "pseudo-colony" — already founded.
2. W1-L3 completion: Commander Voss dialog authorizes Colonies station.
3. Next FPS mission includes "Found Settlement Here" prompt at scenic location.
4. After founding: guided tour of ColonyPlanner.
5. Soft-unlock pacing: T2 around mission 15, T3 around World 4.

Progressive disclosure. Not a tutorial wall.

### Accessibility

- Tailwind tokens respected — high-contrast theming works.
- Keyboard-only navigable everywhere.
- Colony FPS controls identical to existing FPS mode.
- Fast-travel from anywhere in menu (not physical-gated).

---

## Section J — Implementation Phases

Twelve phases, five milestones. Each phase has acceptance criteria, verification method, written plan doc (`docs/superpowers/plans/YYYY-MM-DD-colony-phase-N-<topic>.md`), and code review checkpoint. No phase starts until previous is shipped + deployed.

### Asset Pipeline — parallel track

Runs alongside all phases. Prompts drafted before the phase needing them. Kanban: prompts → assets generated → reviewed → registered in `sprites.ts`. Never gates a code phase — phases use placeholder tiles until assets land.

---

### Milestone A — Foundation (Phases 0-2)

**Goal:** Playable single-colony loop. Found, manage, descend, walk. No POIs, threats, factions yet.

---

**Phase 0 — Data Model & Reducer**

- `game/app/components/colony/` scaffolded with all type files.
- `colonyReducer` with ~10 core events.
- `cycleProcessor` with 10-step pipeline (threats/shipments stubs).
- `save.ts` extended + migration.
- `colonyAssert.ts` initial invariants.
- **Acceptance:** Reducer + cycle pipeline runs correctly against synthetic states. Save/load roundtrip preserves fields.
- **Verification:** `yarn colony:test` pure-function harness.

**Phase 1 — Meta Layer: Single Colony**

- `ColonyPlanner.tsx` list-based UI first (grid later).
- `ColonyDetailsPanel.tsx` with resource bars.
- Cockpit hub: COLONIES station (opens planner).
- Starter colony auto-founded at Ashfall on first run.
- 4 buildings buildable: Solar, Farm, Water Purifier, Habitat.
- Cycle ticks on mission completion.
- **Acceptance:** Full commission → mission → completion → resource loop works.
- **Verification:** Manual playtest + self-test of 5 cycles.

**Phase 2 — FPS Descent**

- `colonyLayout.ts` generator (layoutSeed → raycaster tile map).
- `colonyContext.ts` adapter plugged into firstPerson.
- New mode: `"colony-exploration"`.
- Stub interiors for Phase 1 buildings.
- Day/night tint.
- Return from landing pad menu.
- **Acceptance:** DESCEND works, procgen town layout, enter stub interiors, exit.
- **Verification:** 3 different seeds manually tested.

---

### Milestone B — Content (Phases 3-4)

**Goal:** Rich hubs + region exploration.

---

**Phase 3 — Tier 3/4 Hubs**

- Hand-authored interior templates: Marketplace (refactor existing Ashfall shop), Cantina, Town Hall.
- NPC roster + schedules (stub 2-period).
- Dialog faction-aware branches.
- Asset pipeline ships: 6-8 portraits, 3 interior tile sets.
- Generalized `marketContext`.
- **Acceptance:** Full descend tour: shop at Marketplace, drink at Cantina, talk to Governor.
- **Verification:** Regression test — existing Ashfall shops work.

**Phase 4 — Region Map & POIs**

- `regionMap.ts` per-planet node graphs.
- `poiDispatcher.ts`.
- ~10 procgen templates (fp: 4, boarding: 3, groundRun: 3).
- Fast-travel menu from landing pad.
- POI outcome routing.
- **Acceptance:** Fast-travel to Ruins, Hollow Bunker, Mine POIs. Clear each, get loot, return.
- **Verification:** Seed determinism test (same seed → same POI).

---

### Milestone C — Systems (Phases 5-7)

**Goal:** World has memory. NPCs have schedules, actions have weight, economy moves.

---

**Phase 5 — Schedules + Consequences + Factions**

- Full schedule system (multi-period).
- `consequenceTracker.ts` + witness + bounty + flee-to-report.
- `factionLedger.ts` — 3-5 factions, standing math, rank thresholds.
- Faction-aware dialog across existing NPCs.
- Guards spawn on bounty.
- **Acceptance:** Crime → witness → bounty → decay. Silence witnesses → void. Hated merchants refuse.
- **Verification:** Crime-to-decay test script over 20 cycles.

**Phase 6 — Growth Ladder + Districts + Civic**

- Tier promotion logic + UI.
- District data model + generator.
- Parks, plazas, monuments placeable.
- Fast-travel anchors between districts.
- Ambient spawning scaled by population.
- Tier-distinct visuals.
- **Acceptance:** Grow T1 → T3 through play. Districts visible. Promenade merchants spawn.
- **Verification:** Full growth playthrough. Tier 1-2 no regressions.

**Phase 7 — Economy + Earth Shipments + Escort**

- Earth shipments UI + full functionality.
- Interception → Turret escort mission spawn.
- Refinery conversion functional.
- Spaceport transfers.
- Dynamic market pricing.
- Mission reward → destination colony.
- **Acceptance:** Full economic loop end-to-end tested.
- **Verification:** Balance sanity: T3 colony self-sustains 10 cycles.

---

### Milestone D — Strategic (Phases 8-10)

**Goal:** Colonies matter to campaign. Threats, multi-colony, buffs, emergent missions.

---

**Phase 8 — Threats + Defense + Disasters**

- Hollow raid/siege/infiltration events per progression table.
- Defense mission spawn on raid trigger.
- Biome-specific disasters per planet.
- Radar Array warning system.
- Damaged rendering + repair.
- **Acceptance:** Each threat type tested manually.
- **Verification:** Auto-resolve vs manual-defense balance.

**Phase 9 — Multi-Colony + Galaxy Map**

- Galaxy UI across 8 planets.
- Cross-colony economy.
- Per-colony tracking, combined alerts.
- Found-settlement prompt during FPS.
- Max 4 colonies concurrent (expand later).
- **Acceptance:** 3 colonies on different planets, managed together.
- **Verification:** 4-colony playthrough, 15 cycles. Save <50KB. Perf stable.

**Phase 10 — Campaign Integration**

- Pre-mission buff computation.
- Emergent mission spawn (all 8 templates).
- Mission select two-tab UI.
- Soft-gated campaign missions.
- Multi-ending structure (placeholder).
- **Acceptance:** Buffs affect mission difficulty. Emergent appear + resolve. W4 gate enforced.
- **Verification:** Campaign playthrough to W4 with colony-driven progression.

---

### Milestone E — Polish (Phases 11-12)

**Goal:** Launch-quality.

---

**Phase 11 — Authored Landmarks + Elevation**

- 8 hand-authored landmark POIs, one per world.
- Each with questline (multi-step, cycle-deadlined).
- Authored NPC dialog.
- Elevation metadata system end-to-end tested.
- **Acceptance:** All 8 landmarks playable. Feel distinct from procgen.
- **Verification:** Play each to completion.

**Phase 12 — Balance + QoL + Docs**

- Full balance pass.
- Onboarding polish.
- Accessibility polish.
- Documentation final pass.
- `yarn build` + Pages deploy.
- **Acceptance:** New player: launch → second-colony-founded in <30 min without manual.
- **Verification:** 2 external playtesters, 1h each, structured feedback.

---

### Risk callouts

- **Phase 5 (Consequences/Factions)** — biggest systemic risk. Longer review expected.
- **Phase 4 (POI templates)** — biggest content/asset risk. Front-load procgen test harness.
- **Phase 10 (Campaign Integration)** — regression risk on existing campaign. Pre/post-phase playthrough comparison.
- **Asset pipeline** — could bottleneck Phase 3. Mitigation: prompts drafted in this spec below.

### Parallelism

- Phases 0-2 strictly sequential.
- Starting Phase 3: asset pipeline parallel to code.
- Starting Phase 4: content (templates, dialog) parallel to code.
- Phases 5/6 can parallel (schedules independent of districts).

---

## Asset Pipeline Workstream

Parallel to code. Generates visual/dialog assets via AI prompt templates.

### Asset classes

| Class | Format | Used by | Prompt template location |
|---|---|---|---|
| Building exterior sprites | PNG, matches `sprites.ts` dimensions | Colony FPS town layout | `docs/assets/prompts/building-exterior.md` |
| Building interior tiles | PNG tilesets | Raycaster interior rendering | `docs/assets/prompts/interior-tile.md` |
| NPC portraits | PNG, fixed aspect | Dialog UI | `docs/assets/prompts/npc-portrait.md` |
| Enemy sprites (Raiders) | PNG sprite sheets | POI combat | `docs/assets/prompts/enemy-sprite.md` |
| POI environment tiles | PNG tilesets, biome variants | POI template rendering | `docs/assets/prompts/poi-tile.md` |
| UI iconography | SVG/PNG | Meta UI (building icons, resource icons) | `docs/assets/prompts/ui-icon.md` |

### Prompt template structure

Each prompt file specifies:
- Visual style (HUD aesthetic, Canvas 2D-friendly, retro-futuristic)
- Color palette (references `site/app/globals.css` tokens)
- Sprite dimensions (matches existing `sprites.ts` conventions)
- Biome variants where applicable
- Example reference images from existing project
- Quality gates for review (consistency checklist)

### Asset registry

Each building/NPC/POI type in the catalog gets a slot in a JSON manifest. Prompts generate assets; assets land in `game/public/sprites/colony/`; manifest updates register them in `sprites.ts` without engine code changes.

### Kanban state

```
PROMPTS DRAFTED → ASSETS GENERATING → REVIEW → REGISTERED → IN USE
```

Each asset class maintains its own kanban to avoid cross-class blocking.

### Quality gates

Each asset passes visual-consistency check before registration:
- Matches palette
- Matches sprite dimensions
- Matches thematic style
- Loads correctly in sprite loader test harness

---

## Open Questions / Deferred Decisions

### Deferred for post-v1

- **Deep Sim (Colonist individuality)** — RimWorld/Dwarf Fortress depth with per-colonist needs, relationships, moods, generational sagas. Data model is future-proof for this; no upfront implementation.
- **Procedural planet generation** — v1 uses hand-authored region maps per planet. Procgen architecture deferred to separate design doc.
- **Colony type conversion** — Outpost cannot become Stronghold in v1. Pick type at founding.
- **Building upgrade paths** — Farm Lv1 → Lv2 deferred. v1: build new, don't upgrade.
- **Multiplayer / shared colonies** — Data model is serializable for future multiplayer; no v1 implementation.
- **Colonist specializations** — Farmer/soldier/engineer skill roles for auto-assignment. Deferred.
- **Marriage / romance trees** — Deferred.

### Open questions requiring design revisit

- **Endgame model** — Current multi-ending structure assumes campaign-conclusion point. With open-world sim layer, consider: (1) Skyrim-model where W8 is "main quest" but world persists, (2) chapter structure with W8 as Act I, (3) infinite play with escalating endgame threats. Revisit post-v1 playtesting.
- **Mission cycle weighting** — Currently every mission = 1 cycle. Consider variable weighting (boss fight = 3 cycles, quick skirmish = 1) to give content pacing more flexibility. Balance-phase decision.
- **Colony destruction handling** — When a colony fully collapses, is the slot lost or refoundable? Narrative vs gameplay tradeoff. Playtesting decision.
- **Save data size limits** — Unlimited colonies could bloat localStorage. May need IndexedDB or compression at Phase 9 if perf degrades.
- **Colony naming** — Player-chosen vs auto-generated suggestions. Minor; UX polish in Phase 12.
- **Witness escape pathing complexity** — Current design uses simple flee-to-Town-Hall pathing. Edge cases (no Town Hall, multiple simultaneous witnesses) need handling pass in Phase 5.

### Balance targets requiring playtest

All numeric values in this spec (building costs, production rates, consumption, happiness modifiers, threat frequencies, shipment economics) are **initial targets**. Dedicated balance pass in Phase 12.

---

## Success Criteria

The Colony System is successful if:

1. **New player** can launch the game, complete the tutorial, found their first colony, and commission a building within 30 minutes without reading documentation.
2. **Returning player** who takes a 2-week break loses zero colony progress — the world pauses with them.
3. **Engaged player** can spend 90+ minutes inside a single Tier-4 Capital on dialog, quests, shopping, exploration without leaving for a mission.
4. **System-minded player** discovers the economy allows meaningful strategy (destination-targeting, Refinery optimization, faction-standing choices).
5. **Endgame player** has 2-4 colonies running with distinct roles (agricultural Colony, military Stronghold, research Capital) feeding into their campaign progression.
6. **Save data** stays under 500KB for a full endgame save, loads in <1 second.
7. **Build green** after every phase — `yarn build` + static export deploy succeeds.
8. **No regressions** in existing campaign feel — pre-colony playthroughs and post-colony playthroughs comparable.
9. **Code review passes** on every phase before merge; no phase ships with unresolved review comments.
10. **Architecture future-proof** — adding Deep Sim entity behaviors in a future release requires no changes to existing layer boundaries.

---

## Final Notes

This spec supersedes `docs/game/colony-system-design.md` (2026-04-07) while preserving its core design intent. Key evolutions:
- Meta-layer management → sim-layer with FPS exploration (Daggerfall-style).
- Cycle model clarified: missions are the sole cycle trigger; no real-time decay.
- Content model: procgen breadth + authored landmarks (hybrid with procgen-first pacing).
- Consequence system elevated to core subsystem (witnesses, bounties, factions).
- Architecture formalized into three layers.
- Implementation phased into 12 steps across 5 milestones.

The vision in one line: *systems-first craftsmanship that delivers Skyrim-grade depth through Canvas 2D, on the bones of an already-proven multi-mode shooter, built patiently and tested at every step.*

# Sector Zero — Colony Phase 5a: Living NPCs

**Date:** 2026-07-04
**Status:** Design approved in session, ready for spec review
**Predecessors:**
- `docs/superpowers/specs/2026-04-21-colony-phase-2-fps-descent-design.md` (Phase 2 — the walkable colony this populates)
- `docs/superpowers/specs/2026-07-02-fp-pixel-graphics-system-design.md` (graphics system — billboards render the NPCs)
**Scope:** Populate the walkable Phase-2 colony with NPCs — background colonists who wander on day/night schedules via A* pathing, a **governor** whose dialog reflects live `ColonyState`, and a **quartermaster** with a working shop. All generated deterministically from `ColonyState` each descent, reusing the engine's existing `FPNPC` + dialog/shop. The engine stays colony-agnostic; all new logic lives in the colony orchestrator layer.

---

## Goal

After Phase 2, the colony is a physical place you can walk — but empty. Phase 5a makes it **inhabited**. Descend and the plaza has people: colonists commuting between homes and workplaces as the day/night clock turns, a governor you can ask about the colony's state (and get a live answer), and a quartermaster who'll sell you supplies. The place stops feeling like a diorama and starts feeling lived-in.

This is the "colony is alive" beat. It adds content *inside* the Phase 2 frame without touching the engine, the save format, or the colony data model.

---

## Design philosophy (inherited)

- **Reuse before invent.** The FP engine already renders `fp.npcs` as billboards and runs a complete proximity + facing + interact → dialog → shop flow (proven on Ashfall Forward Camp). Phase 5a writes `FPNPC[]` onto the exterior state and reuses that flow unchanged. No engine changes.
- **Layered architecture honored.** The engine never learns about colonies. NPC generation, scheduling, pathfinding, and per-frame movement all live in a new `colony/exploration/npc/` folder, driven by the orchestrator (`stepColonyExploration`).
- **Deterministic generation.** Same `colony` + `layoutSeed` + `gameClock` → identical NPC set at identical schedule positions. A schedule is a pure function of the hour; nothing new persists. NPCs are ephemeral like the building layout.
- **Incremental, patient, documented.** Contained scope: no quests, no persistence, no interior NPCs, no waking of the deferred domain-`Npc` registry / dialog-tree / mood scaffolding.

---

## Scope contract

### In scope

- New folder `game/app/components/colony/exploration/npc/` (5 files, see File Layout)
- **Wandering background colonists** with day/night schedules, moving via deterministic grid A*
- **Governor** named NPC — dialog built from live `ColonyState` (population, tier, happiness, operational/total buildings, active threats)
- **Quartermaster** named NPC — working shop reusing the existing `FPShopItem` / shop-open flow, selling consumables/materials against the player wallet
- **Colonist barks** — 1–2 short contextual lines reflecting colony happiness
- Deterministic generation from `ColonyState` (`population`, `buildings`, `layoutSeed`) — zero net-new `ColonyState`/`SaveData` fields
- Schedule tie-in to the existing five day/night buckets (reused from `dayNightTint`)
- Per-frame NPC stepping in the orchestrator; movement pauses during dialog; delta-time scaled
- ~20–26 new tests (A* correctness/determinism, schedule resolution, generation determinism/cap/fallback, governor live-dialog, quartermaster inventory, path-follow stepping)

### Out of scope (deferred)

- Quests / objectives from NPCs (own later phase — opens quest tracking, rewards, persistence)
- NPC persistence or identity across visits (regenerated deterministically each descent)
- The domain `Npc` registry (`namedNpcs`), `DialogTreeId` branching trees, `ScheduleEntry` domain type, `Mood` — all stay untouched scaffold
- **NPCs inside interiors** — colonists path to building *doors*, never through them; interior population is a later phase
- Faction/standing effects, NPC combat, tier-3 district crowds
- Any engine (`firstPersonEngine.ts`), `SaveData`, or `ColonyState`-shape change

---

## Section A — File layout, boundaries, mode dispatch

### New files

```
game/app/components/colony/exploration/npc/
├── colonyNpcs.ts       # generateColonyNpcs(colony, gameClock) → ColonyNpc[]
├── npcSchedule.ts      # hour → day/night bucket → per-NPC target tile
├── npcPathfind.ts      # deterministic grid A* over walkable tiles
├── npcStep.ts          # per-frame path-follow + re-path; ColonyNpc[] → FPNPC[] sync
├── npcDialog.ts        # governor / quartermaster / colonist dialog + shop builders
└── index.ts            # public API: generateColonyNpcs, stepColonyNpcs

game/tests/colony/npc/
├── npcPathfind.test.ts
├── npcSchedule.test.ts
├── colonyNpcs.test.ts
└── npcDialog.test.ts
```

### Modified files

```
game/app/components/colony/exploration/
├── colonyLayout.ts     # generateExteriorState: populate fp.npcs from generateColonyNpcs
│                       #   (currently sets npcs: []); attach a ColonyNpc sidecar for stepping
└── index.ts            # stepColonyExploration: call stepColonyNpcs each frame before render
```

**No engine files, no types.ts change, no SaveData/ColonyState change.** `FPNPC`, `FPDialogState`, `FPShopItem` are used as-is.

### Boundary rules

1. **Orchestrator owns NPCs; engine consumes.** `generateColonyNpcs` builds the NPC set at descent; `stepColonyNpcs` advances them each frame and writes `FPNPC[]` onto the active exterior `FirstPersonState.npcs`. The engine renders/interacts with `fp.npcs` exactly as it does for Ashfall.
2. **The `ColonyNpc` sidecar.** The engine's `FPNPC` has no movement/schedule state. The orchestrator keeps a parallel `ColonyNpc[]` (position, path, schedule, home/work) alongside the scene; each frame it steps them and projects the render-relevant subset into `fp.npcs`. The sidecar lives on the exterior `SceneLayer` (or the `SceneStack`), not on `FirstPersonState`.
3. **Interior scenes have no NPCs** (Phase 5a). Entering a building swaps to an interior state with `npcs: []` (unchanged). The exterior sidecar is retained and resumes on pop.
4. **Determinism.** All generation and pathfinding are pure functions of `(colony, layoutSeed, gameClock)` — no `Date.now()`, no `Math.random()` (seeded RNG derived from `layoutSeed`).

---

## Section B — NPC model & schedule

### `ColonyNpc` (internal, orchestrator-only)

```typescript
// colony/exploration/npc/colonyNpcs.ts
type NpcKind = "governor" | "quartermaster" | "colonist";

interface ColonyNpc {
  id: number;                       // stable within a descent; maps to FPNPC.id
  kind: NpcKind;
  name: string;
  spriteKey: string;                // into SPRITES (reuse NPC_* keys)
  posX: number; posY: number;       // continuous tile coords
  homeTile: { x: number; y: number };
  workTile: { x: number; y: number };
  postTile: { x: number; y: number } | null;  // named NPCs' day/dusk station
  happinessTier: "content" | "strained" | "grim";  // drives colonist barks
  // movement state (mutated by npcStep)
  path: { x: number; y: number }[]; // remaining waypoint tiles to the current target
  pathTargetTile: { x: number; y: number } | null;  // what `path` was computed toward
}
```

`ColonyNpc` is distinct from the scaffold domain `Npc` (`colonyTypes.ts`), which stays untouched. The `FPNPC` projected each frame carries `{id, x, y, name, type, dialog, shopItems?, color, interacted}` — `dialog`/`shopItems` are built once at generation (Section E), `x/y` updated each frame from `ColonyNpc.posX/posY`.

### Schedule (`npcSchedule.ts`)

Reuses the five day/night buckets already defined by `dayNightTint.tintForHour` (night `<5 || ≥22`, dawn `5–6`, day `7–16`, dusk `17–19`, evening `20–21`):

| Bucket | Colonist target | Named-NPC target |
|---|---|---|
| night | homeTile | homeTile |
| dawn | workTile (commuting) | postTile |
| day | workTile | postTile |
| dusk | a plaza tile (social) | postTile |
| evening | homeTile (commuting) | homeTile |

```typescript
export function scheduleTargetTile(npc: ColonyNpc, hour: number, plazaTiles: Tile[]): Tile;
```

Named NPCs (governor, quartermaster) hold a fixed `postTile` through dawn/day/dusk so the player can reliably find them during active hours, but still commute home at night/evening so the colony visibly empties and refills. Which plaza tile a colonist targets at dusk is chosen deterministically from its id + seed (spreads them across the plaza, avoids clumping).

---

## Section C — A* pathfinding & movement

### `npcPathfind.ts` — deterministic grid A*

```typescript
export function findPath(
  map: BoardingMap,
  start: { x: number; y: number },
  goal: { x: number; y: number },
): { x: number; y: number }[];   // waypoint tiles start→goal, or [] if unreachable
```

- Walkable = `"floor" | "door"`; solid = `"wall" | "empty"` (matches the engine's `isWall`).
- 4-directional movement, **Manhattan heuristic**.
- **Fixed deterministic tie-break:** open-set ordering compares `f`, then `h`, then a fixed neighbor expansion order (N, E, S, W). Identical `(map, start, goal)` → identical path, every run. This is what keeps NPC positions deterministic and testable.
- Trivial cost: ≤576 nodes on a 24×24 grid; re-paths happen only on target change (a few times per in-colony session), not per frame.

### `npcStep.ts` — per-frame stepping

```typescript
export function stepColonyNpcs(
  npcs: ColonyNpc[],
  map: BoardingMap,
  gameClock: GameClock,
  plazaTiles: Tile[],
  dtMs: number,
  dialogActive: boolean,
): void;   // mutates npcs in place; caller syncs FPNPC[].x/y after
```

Each frame, per NPC: (1) resolve current `scheduleTargetTile`; if it differs from `pathTargetTile`, re-path (A*) and store; (2) advance `posX/posY` toward the next waypoint at a walk speed (`NPC_WALK_SPEED × dtF`, `dtF` = the same `min(dtMs/16.67, 3)` clamp as the movement system), snapping waypoints as reached; (3) idle when at target. **If `dialogActive`, skip all movement** (the whole plaza holds still while you talk — simplest, and avoids an NPC walking off mid-conversation). NPCs don't collide with each other (billboards overlap gracefully) but never enter solid tiles (A* only routes over walkable tiles; the step never overshoots into a wall).

The caller (`stepColonyExploration`) then syncs each `FPNPC.x/y` from its `ColonyNpc`, so the engine renders updated positions.

---

## Section D — Generation from ColonyState (`colonyNpcs.ts`)

```typescript
export function generateColonyNpcs(colony: ColonyState, gameClock: GameClock): ColonyNpc[];
```

Deterministic (seeded RNG from `layoutSeed`):

1. **Governor** — always spawned. `postTile` = plaza center. Name derived from colony (e.g., `"Overseer <colony.name>"` or a seeded name). Home = a Habitat tile if present, else plaza.
2. **Quartermaster** — always spawned. `postTile` = a landing-pad-adjacent tile (a stall by the pad). Home = a Habitat tile if present, else plaza.
3. **Colonists** — count = `min(populationScaled, CAP)` where `CAP = 10` and `populationScaled` derives from `colony.population.total` (e.g., `floor(total / K)`, tuned so a small Tier-1 colony shows a handful, a fuller one approaches the cap). Each colonist: `homeTile` = a Habitat Module tile (deterministic assignment), `workTile` = a tile of a random **operational** building (farm/solar/purifier), `happinessTier` bucketed from `colony.happiness`.
4. **Graceful degradation:** no Habitat → colonists "home" at a plaza tile; no operational building → colonists "work" by idling in the plaza. A colony with zero population still shows the governor + quartermaster (the place is staffed, just unpopulated).

Zero net-new persistent fields — everything reads existing `ColonyState`.

---

## Section E — Dialog & shop (`npcDialog.ts`, reuse)

All via existing `FPNPC.dialog: FPDialogLine[]`, `FPDialogState`, `FPShopItem`. Interaction is the engine's existing proximity (2.0 tiles) + facing (`dot > 0`) + interact key — no new input.

### Governor — live status readout

`buildGovernorDialog(colony)` composes `FPDialogLine[]` from live `ColonyState`:
- population (`population.total`, trend from `growthRate`), tier, happiness descriptor
- operational vs total buildings; names any `damaged`/`offline`/`destroyed` building
- any `activeThreats`
Example line text: *"Population's holding at 14. Tier one, and we'd climb to two if the purifier weren't offline."* Talking to the governor **is** the colony status screen, in character. Pure function of `ColonyState` → deterministic and unit-testable.

### Quartermaster — working shop

`buildQuartermasterShop(colony)` returns `FPShopItem[]`; the NPC is `type: "merchant"` so the engine's existing "end of dialog → open shop" path fires. Inventory derives from colony tier/resources (a small deterministic set of consumables/materials). Purchases use the existing shop-buy flow against the **player wallet** (same as Ashfall merchants) — no new economy code, no colony-treasury coupling in Phase 5a.

### Colonists — barks

`buildColonistBark(happinessTier, seed)` → 1–2 short `FPDialogLine`s. Content when `happiness` high ("Good to have boots on the ground out here."), grumbling when low ("Rations again. Tell the Overseer we noticed."). Adds texture; deterministic from tier + id.

---

## Section F — Testing

Pure-logic, deterministic, under the existing `tsx --test` (extends `yarn colony:test`):

1. **`npcPathfind.test.ts`** — A* finds a known-optimal path on a fixture; identical `(map,start,goal)` → identical path (determinism); returns `[]` for unreachable goal; never routes over a solid tile; handles start==goal.
2. **`npcSchedule.test.ts`** — every hour maps to the correct bucket; each bucket → correct target for colonist vs named NPC; plaza-tile selection deterministic and spread.
3. **`colonyNpcs.test.ts`** — same `(colony, clock)` → identical NPC set (determinism); colonist count scales with population and respects `CAP=10`; governor + quartermaster always present; degradation (no habitat / no operational building / zero population).
4. **`npcDialog.test.ts`** — governor dialog reflects given `ColonyState` (population number, named down building, threat present); quartermaster shop inventory rules by tier; colonist bark tier selection.
5. **Stepping** (in `colonyNpcs.test.ts` or a small `npcStep` test) — an NPC advances toward and reaches its target over N steps; movement pauses when `dialogActive`; never lands on a solid tile.

**Total new: ~20–26 tests.** Manual playtest (prod build): descend at different `gameClock` hours → colonists commute home↔work, gather in the plaza at dusk; talk to the governor (live stats match the meta screen), buy from the quartermaster; confirm no wall-clipping and smooth movement.

---

## Section G — Implementation phases (for the plan)

1. **A\* pathfinder** (`npcPathfind.ts` + tests) — pure, standalone, deterministic. No integration.
2. **Schedule + NPC model** (`npcSchedule.ts`, `ColonyNpc`, `colonyNpcs.ts` generation + tests) — pure generation, no rendering.
3. **Dialog/shop builders** (`npcDialog.ts` + tests) — governor live-dialog, quartermaster shop, colonist barks.
4. **Stepping + orchestrator integration** (`npcStep.ts`, wire `generateColonyNpcs` into `generateExteriorState`, `stepColonyNpcs` into `stepColonyExploration`) — the first commit where NPCs appear and move in-game.
5. **Playtest + polish** — tuning (walk speed, counts, plaza spread, dialog copy); manual checklist; completion log.

Each phase ships green (`yarn colony:test`, `yarn engine:test`, `npx tsc --noEmit`, `yarn build`) and, from phase 4 on, is playable.

### Success criteria

- [ ] `yarn colony:test` green (~20–26 new tests); `yarn engine:test` unaffected; `tsc` + `build` clean
- [ ] Colonists visibly commute by time-of-day; plaza fills at dusk, empties at night
- [ ] Governor dialog matches live `ColonyState`; quartermaster shop buys against wallet
- [ ] Deterministic: same colony + seed + hour → identical NPCs/positions (test-verified)
- [ ] No wall-clipping; movement smooth and frame-rate-independent
- [ ] Engine, `SaveData`, and `ColonyState` shape all unchanged (diff-audited)
- [ ] Interiors unaffected (still `npcs: []`)

### Risk callouts

| Risk | Mitigation |
|---|---|
| A* non-determinism (tie-breaks) | Fixed comparator (f, then h, then N/E/S/W); determinism test |
| NPC clips into a building | A* only routes walkable tiles; step never overshoots into solid; playtest |
| Perf from many moving billboards | Cap 10 colonists + 2 named; re-path only on target change; billboards measured cheap |
| NPC walks off mid-dialog | All movement pauses while `dialogState.active` |
| Sparse colony looks broken | Degradation: governor+quartermaster always present; plaza fallback for home/work |
| Scope creep into quests/persistence | Explicit deferred list; engine + data model untouched |
| Engine gains colony-awareness | All NPC logic in `colony/exploration/npc/`; engine renders generic `fp.npcs` only; diff audit |

---

## Relation to master spec

Implements the NPC-population portion of the colony roadmap's Phase 5a. Establishes the orchestrator-owned NPC pattern (generation + schedule + pathfinding + per-frame step) that later phases extend: interior NPCs, the persistent domain-`Npc` registry, dialog trees, and quest hooks all build on the `ColonyNpc` → `FPNPC` bridge introduced here.

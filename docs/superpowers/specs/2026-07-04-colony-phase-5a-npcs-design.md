# Sector Zero — Colony Phase 5a: Living NPCs

**Date:** 2026-07-04
**Status:** Design approved in session, ready for spec review
**Predecessors:**
- `docs/superpowers/specs/2026-04-21-colony-phase-2-fps-descent-design.md` (Phase 2 — the walkable colony this populates)
- `docs/superpowers/specs/2026-07-02-fp-pixel-graphics-system-design.md` (graphics system — billboards render the NPCs)
**Scope:** Populate the walkable Phase-2 colony with NPCs — background colonists who wander on day/night schedules via A* pathing, a **governor** whose dialog reflects live `ColonyState`, and a **quartermaster** with a working shop. All generated deterministically from `ColonyState` each descent, reusing the engine's existing `FPNPC` + dialog/shop. Nearly all new logic lives in the colony orchestrator layer; the engine gets **two small, contained, audited edits** (colony-mode NPC interaction + an additive `FPNPC.sprite` field) that the reuse genuinely requires — see Section H.

---

## Goal

After Phase 2, the colony is a physical place you can walk — but empty. Phase 5a makes it **inhabited**. Descend and the plaza has people: colonists commuting between homes and workplaces as the day/night clock turns, a governor you can ask about the colony's state (and get a live answer), and a quartermaster who'll sell you supplies. The place stops feeling like a diorama and starts feeling lived-in.

This is the "colony is alive" beat. It adds content *inside* the Phase 2 frame with two small, contained engine edits (Section H) and no change to the save format or the colony data model.

---

## Design philosophy (inherited)

- **Reuse before invent.** The FP engine already renders `fp.npcs` as billboards and runs a complete proximity + facing + interact → dialog → shop flow (proven on Ashfall Forward Camp). Phase 5a writes `FPNPC[]` onto the exterior state and reuses that flow. Two small engine edits are genuinely required to make it work in colony mode (Section H): the Phase-2 colony-interact hook currently early-returns *before* the NPC-dialog code, so without the edit colony NPCs render but cannot be talked to; and NPC billboard sprites resolve by name, so distinct governor/quartermaster/colonist sprites need an additive `FPNPC.sprite` field. Both are contained and diff-audited.
- **Layered architecture honored.** The engine stays colony-*agnostic*: the NPC-interaction edit reuses the engine's own generic `fp.npcs` dialog-open logic (extracted to a helper), invoked from inside the existing `if (fp.colonyContext)` guard — it does not teach the engine about colonies, buildings, or schedules. NPC generation, scheduling, pathfinding, and per-frame movement all live in a new `colony/exploration/npc/` folder, driven by the orchestrator (`stepColonyExploration`).
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
- **Two contained engine edits (Section H):** colony-mode NPC interaction (extract the existing NPC-dialog-open into a helper; call it inside the colony hook before door/pad, NPC-targeting takes priority) + additive `FPNPC.sprite?` field so colony NPCs get distinct sprites; plus a one-line `Game.tsx` fix to pass real `dtMs` to `stepColonyExploration`
- ~24–30 new tests (A* correctness/determinism, schedule resolution, generation determinism/cap/fallback, governor live-dialog, quartermaster inventory, path-follow stepping, **colony-mode NPC-interaction reachability + door/pad still work + anti-bounce preserved**)

### Out of scope (deferred)

- Quests / objectives from NPCs (own later phase — opens quest tracking, rewards, persistence)
- NPC persistence or identity across visits (regenerated deterministically each descent)
- The domain `Npc` registry (`namedNpcs`), `DialogTreeId` branching trees, `ScheduleEntry` domain type, `Mood` — all stay untouched scaffold
- **NPCs inside interiors** — colonists path to building *doors*, never through them; interior population is a later phase
- Faction/standing effects, NPC combat, tier-3 district crowds
- `SaveData` changes, `ColonyState`-shape changes, or any engine change beyond the two contained edits in Section H (NPC-interaction reachability + additive `FPNPC.sprite?`) and the one-line `Game.tsx` `dtMs` fix

---

## Section A — File layout, boundaries, mode dispatch

### New files

```
game/app/components/colony/exploration/npc/
├── colonyNpcs.ts       # generateColonyNpcs(colony, gameClock, map) → { fpNpcs: FPNPC[], sidecar: ColonyNpc[] }
├── npcSchedule.ts      # hour → day/night bucket → per-NPC target tile
├── npcPathfind.ts      # deterministic grid A* over walkable tiles
├── npcStep.ts          # per-frame path-follow + re-path; syncs ColonyNpc pos → FPNPC.x/y
├── npcDialog.ts        # governor / quartermaster / colonist dialog + shop builders (used by colonyNpcs)
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
├── index.ts            # enterColonyExploration: after generateExteriorState, call
│                       #   generateColonyNpcs(colony, clock, state.map), assign state.npcs =
│                       #   fpNpcs, store sidecar on the exterior SceneLayer. stepColonyExploration:
│                       #   call stepColonyNpcs BEFORE the no-transition early return, then sync
│                       #   FPNPC.x/y. (generateExteriorState signature/return UNCHANGED — it keeps
│                       #   returning FirstPersonState; the ~15 existing tests that deref .posX/.map
│                       #   stay green. NPC wiring lives entirely in enterColonyExploration.)
├── sceneStack.ts       # SceneLayer gains an optional `npcSidecar?: ColonyNpc[]` field (additive)
└── dayNightTint.ts     # extract shared `bucketForHour(hour)` (or a new small shared module) so
│                       #   the schedule and the tint derive the five buckets from one source

game/app/components/engine/          # the two contained edits (Section H) + additive field
├── firstPersonEngine.ts # extract tryOpenNpcDialog() helper; call it inside the
│                        #   if (fp.colonyContext) guard before door/pad resolution, with NPC
│                        #   targeting taking priority. ~15–20 lines, all reuse; diff-audited.
├── types.ts             # FPNPC gains optional `sprite?: string` (additive; existing NPCs
│                        #   unaffected — undefined falls back to name-map then NPC_SURVIVOR)
└── fpRender/sceneInput.ts # NPC sprite resolution: `n.sprite ?? NPC_SPRITE_MAP[n.name] ??
│                          #   SPRITES.NPC_SURVIVOR` (one-line change; name-map path preserved)

game/app/components/Game.tsx  # pass the real dtMs (already computed) to stepColonyExploration
                              # instead of the hardcoded 16 — so NPC movement is dt-scaled
```

**No `SaveData` change, no `ColonyState`-shape change.** `FPDialogState`, `FPShopItem` used as-is; `FPNPC` gains only the additive optional `sprite?`.

### Boundary rules

1. **Orchestrator owns NPCs; engine consumes.** `generateColonyNpcs` builds the NPC set at descent; `stepColonyNpcs` advances them each frame and writes `FPNPC[]` onto the active exterior `FirstPersonState.npcs`. The engine renders/interacts with `fp.npcs` exactly as it does for Ashfall.
2. **The `ColonyNpc` sidecar.** The engine's `FPNPC` has no movement/schedule state. The orchestrator keeps a parallel `ColonyNpc[]` (position, path, schedule, home/work) alongside the scene; each frame it steps them and syncs `x/y` into the render `fp.npcs`. **`generateColonyNpcs(colony, gameClock, map)` returns `{ fpNpcs: FPNPC[]; sidecar: ColonyNpc[] }`** — `fpNpcs[i]` and `sidecar[i]` share an `id` and are built together (the `FPNPC` is the render/interaction projection of the `ColonyNpc`, with `dialog`/`shopItems`/`sprite` from `npcDialog.ts`). **`generateExteriorState`'s signature and `FirstPersonState` return are unchanged** (no test breakage). `enterColonyExploration` (`index.ts`, which constructs the `SceneLayer`) calls `generateColonyNpcs` after building the exterior state, assigns `state.npcs = fpNpcs`, and stores `sidecar` on the **exterior `SceneLayer`** (new optional `npcSidecar?` field) — not on `FirstPersonState`. The exterior layer is preserved as `parent` across interior push/pop, so the sidecar survives and resumes on pop.
3. **Interior scenes have no NPCs** (Phase 5a). Entering a building swaps to an interior state with `npcs: []` (unchanged). The exterior sidecar is retained on the parent layer and resumes on pop.
4. **`stepColonyNpcs` runs before the orchestrator's early return.** `stepColonyExploration` returns early on the common no-scene-transition frame; NPC stepping must be inserted *before* that guard or NPCs never advance.
5. **Determinism.** All generation and pathfinding are pure functions of `(colony, layoutSeed, gameClock)` — no `Date.now()`, no `Math.random()` (seeded RNG derived from `layoutSeed`).

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
  sprite: string;                   // a SPRITES.NPC_* path, copied to FPNPC.sprite
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

`ColonyNpc` is distinct from the scaffold domain `Npc` (`colonyTypes.ts`), which stays untouched. The `FPNPC` built at generation carries `{id, x, y, name, type, dialog, shopItems?, color, interacted, sprite}` — `type` is `"merchant"` for the quartermaster (triggers the engine's shop-open) and **`"lore"`** for the governor and colonists (non-merchant, dialog-only); `dialog`/`shopItems`/`sprite` are set once at generation (Sections D/E); `x/y` are re-synced each frame from `ColonyNpc.posX/posY`. `sprite` uses existing `SPRITES.NPC_*` assets (e.g. governor and quartermaster each get a distinct one; colonists rotate over a small set) so the three kinds read as visually different via reuse — no new art.

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

Each frame, per NPC: (1) resolve current `scheduleTargetTile`; if it differs from `pathTargetTile`, re-path (A*) and store; (2) advance `posX/posY` toward the next waypoint at a walk speed (`NPC_WALK_SPEED × dtF`, `dtF` = the same `min(dtMs/16.67, 3)` clamp as the movement system), snapping waypoints as reached; (3) idle when at target. **If `dialogActive`, skip all movement** (the whole plaza holds still while you talk — simplest, and avoids an NPC walking off mid-conversation); `dialogActive` is read from `fp.dialogState?.active`. NPCs don't collide with each other (billboards overlap gracefully) but never enter solid tiles (A* only routes over walkable tiles; the step never overshoots into a wall).

**Exterior-only:** `stepColonyNpcs` runs only when the current scene is the exterior (the sidecar lives on the exterior layer); on an interior frame there is no sidecar and the step no-ops. The caller (`stepColonyExploration`) then syncs each `FPNPC.x/y` from its `ColonyNpc`, so the engine renders updated positions. **`dtMs` plumbing:** `stepColonyExploration` is currently called from `Game.tsx` with a hardcoded `16`; Phase 5a changes that call to pass the real per-frame `dtMs` (already computed one line above for the engine tick) so NPC movement is genuinely frame-rate-independent. One-line change; no other `Game.tsx` edit.

---

## Section D — Generation from ColonyState (`colonyNpcs.ts`)

```typescript
export function generateColonyNpcs(
  colony: ColonyState, gameClock: GameClock, map: BoardingMap,
): { fpNpcs: FPNPC[]; sidecar: ColonyNpc[] };
```

Builds each `ColonyNpc` (identity, home/work, sprite, initial position from its current schedule target) and its paired `FPNPC` projection (dialog/shop/sprite via `npcDialog.ts`, `x/y` from the `ColonyNpc`). `map` supplies walkable tiles for home/work/plaza assignment. Deterministic (seeded RNG from `layoutSeed`):

1. **Governor** — always spawned. `postTile` = plaza center. Name derived from colony (e.g., `"Overseer <colony.name>"` or a seeded name). Home = a Habitat tile if present, else plaza.
2. **Quartermaster** — always spawned. `postTile` = a landing-pad-adjacent tile (a stall by the pad). Home = a Habitat tile if present, else plaza.
3. **Colonists** — count = `min(populationScaled, CAP)` where `CAP = 10` and `populationScaled` derives from `colony.population.total` (e.g., `floor(total / K)`, tuned so a small Tier-1 colony shows a handful, a fuller one approaches the cap). Each colonist: `homeTile` = a Habitat Module tile (deterministic assignment), `workTile` = a tile of a random **operational** building (farm/solar/purifier), `happinessTier` bucketed from `colony.happiness`.
4. **Graceful degradation:** no Habitat → colonists "home" at a plaza tile; no operational building → colonists "work" by idling in the plaza. A colony with zero population still shows the governor + quartermaster (the place is staffed, just unpopulated).

Zero net-new persistent fields — everything reads existing `ColonyState`.

---

## Section E — Dialog & shop (`npcDialog.ts`, reuse)

All via existing `FPNPC.dialog: FPDialogLine[]`, `FPDialogState`, `FPShopItem`. Interaction reuses the engine's existing proximity (2.0 tiles) + facing (`dot > 0`) + interact key and its dialog-advance/shop-open flow — no new input. The one wrinkle (Section H): in colony mode the Phase-2 interact hook must be taught to fire NPC dialog-open before its door/pad handling, because it currently early-returns first. That is an engine edit, but it reuses the engine's own generic NPC logic — the engine still knows nothing about colonies.

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

## Section H — The two engine edits (contained, audited)

The reuse of the engine's NPC/dialog/shop flow requires two small edits to engine code, plus a one-line `Game.tsx` fix. All are diff-audited; none teaches the engine about colonies.

### H1 — Colony-mode NPC interaction (`firstPersonEngine.ts`)

**Why:** `updateFirstPerson` handles NPC dialog-open in a block that runs only when `fp.colonyContext` is *absent*. On the colony exterior `colonyContext` is always set, so the colony hook runs and hits `return;` **before** the NPC block — colony NPCs render but can never be talked to.

**Fix (reuse, not new logic):**
1. Extract the existing NPC-open logic (lines ~191–217: find an NPC within 2.0 tiles that the player faces, `dot > 0`; on interact with the debounce, set `fp.dialogState`) into a helper `tryOpenNpcDialog(gs, fp, keys, posX, posY, dirX, dirY): boolean` (returns whether a dialog opened). **The helper takes `gs`** because the extracted block also pushes an audio event (`gs.audioEvents.push(...)`) and clears `gs.player.bankDir` — both must move into the helper so the non-colony call site stays behavior-identical (pure refactor).
2. Inside the `if (fp.colonyContext)` guard, **before** the door/pad resolution, call `tryOpenNpcDialog(...)`. If it opens a dialog: **also set `fp.colonyInteractArmed = false`** (see below), skip door/pad this frame (NPC targeting takes priority when an NPC is in range and faced), and return through the normal path. Otherwise fall through to the existing door/pad anti-bounce logic unchanged.

**Interaction with the anti-bounce gate — the close-frame bounce (load-bearing):** while a dialog is open the colony guard is never reached (the dialog block returns early), so `colonyInteractArmed` stays frozen `true`. If NPC-open did *not* disarm it, then the frame the dialog **closes** with the interact key still held, the guard runs, `canFire` (armed && cooldown==0 && shoot) is immediately true, and door/pad resolves that frame — e.g. finishing the quartermaster shop *while standing on the landing pad* pops the exit-to-cockpit menu, or finishing a colonist's dialog *at a building door* enters the building. **Mitigation:** disarming (`colonyInteractArmed = false`) on NPC-open forces a key release before any door/pad fire, closing the bounce — the same disarm-on-transition discipline Phase 2 already uses. Dialog-advance is unaffected (it runs in its own pre-guard block with the existing `gunCooldown` debounce). Door/pad transitions otherwise retain their edge-trigger + cooldown gate exactly.

The plan must verify (tests below): colony NPC dialog opens; door/pad still work when no NPC is targeted; the anti-bounce gate still holds; **the close frame with held interact does NOT trigger door/pad** (quartermaster-on-pad and colonist-at-door cases); and an NPC near a door is reachable for talk without accidentally entering.

**Audit gate:** the `firstPersonEngine.ts` change is the helper extraction (a ~26-line verbatim move) + one call inside the colony guard + the disarm line — **net-new logic ~8–12 lines**, all reuse, zero change to non-colony behavior (the extracted helper is called identically from the old site). Note for the auditor: a raw `git diff --stat` will show ~50 lines because the moved block counts as delete+add; read it as "moved block + one new guarded call + one disarm line."

### H2 — `FPNPC.sprite?` additive field (`types.ts` + `fpRender/sceneInput.ts`)

**Why:** NPC billboards resolve their sprite via `NPC_SPRITE_MAP[n.name] ?? SPRITES.NPC_SURVIVOR`, keyed on the NPC's **name**. Colony NPC names are dynamic (`"Overseer <colony.name>"`) or absent from the map, so every colony NPC would fall back to `NPC_SURVIVOR` — all identical.

**Fix:** add optional `sprite?: string` to `FPNPC` (additive — existing Ashfall NPCs omit it, unaffected). In `sceneInput.ts`, NPC sprite resolution becomes `n.sprite ?? NPC_SPRITE_MAP[n.name] ?? SPRITES.NPC_SURVIVOR` (name-map path preserved for Ashfall). Colony NPCs set `sprite` to existing `SPRITES.NPC_*` assets. One-line resolution change; one additive field.

### H3 — `Game.tsx` real `dtMs` (one line)

`stepColonyExploration(stack, save, 16)` → pass the real `dtMs` already computed for the engine tick, so NPC movement is frame-rate-independent (Section C). No other `Game.tsx` change.

---

## Section F — Testing

Pure-logic, deterministic, under the existing `tsx --test` (extends `yarn colony:test`):

1. **`npcPathfind.test.ts`** — A* finds a known-optimal path on a fixture; identical `(map,start,goal)` → identical path (determinism); returns `[]` for unreachable goal; never routes over a solid tile; handles start==goal.
2. **`npcSchedule.test.ts`** — every hour maps to the correct bucket; each bucket → correct target for colonist vs named NPC; plaza-tile selection deterministic and spread.
3. **`colonyNpcs.test.ts`** — same `(colony, clock)` → identical NPC set (determinism); colonist count scales with population and respects `CAP=10`; governor + quartermaster always present; degradation (no habitat / no operational building / zero population).
4. **`npcDialog.test.ts`** — governor dialog reflects given `ColonyState` (population number, named down building, threat present); quartermaster shop inventory rules by tier; colonist bark tier selection.
5. **Stepping** (in `colonyNpcs.test.ts` or a small `npcStep` test) — an NPC advances toward and reaches its target over N steps; movement pauses when `dialogActive`; never lands on a solid tile.
6. **Engine interaction (H1)** (extend the FP engine tests) — with `fp.colonyContext` set and an NPC in range + faced, pressing interact opens `dialogState` (regression guard for the early-return bug); with no NPC targeted, door/pad interaction still fires and the anti-bounce gate still holds; **close-frame bounce guard** — after a colony NPC dialog opens (which disarms), closing it with interact still held does NOT fire door/pad that frame (covers quartermaster-on-pad and colonist-at-door); the extracted `tryOpenNpcDialog` behaves identically at the non-colony call site (audio event + `bankDir` clear preserved — no regression to Ashfall). H2 sprite resolution: `n.sprite` wins over the name map; a name-mapped NPC with no `sprite` still resolves via the map (Ashfall unaffected).

**Total new: ~24–30 tests.** Manual playtest (prod build): descend at different `gameClock` hours → colonists commute home↔work, gather in the plaza at dusk; talk to the governor (live stats match the meta screen), buy from the quartermaster; verify Ashfall NPC dialog/shop still works (H1/H2 regression); confirm no wall-clipping and smooth movement.

---

## Section G — Implementation phases (for the plan)

1. **A\* pathfinder** (`npcPathfind.ts` + tests) — pure, standalone, deterministic. No integration.
2. **Schedule + NPC model** (`npcSchedule.ts`, `ColonyNpc`, `colonyNpcs.ts` generation + tests) — pure generation, no rendering. Extract a shared `bucketForHour(hour)` (the schedule and `dayNightTint` currently re-derive the same five boundaries independently — one helper prevents drift).
3. **Dialog/shop builders** (`npcDialog.ts` + tests) — governor live-dialog, quartermaster shop, colonist barks.
4. **Engine edits H1/H2** (`firstPersonEngine.ts` `tryOpenNpcDialog` extraction + colony-hook call; `types.ts` `FPNPC.sprite?`; `sceneInput.ts` resolution) + tests — pure enabler, no colony NPCs placed yet; Ashfall regression-tested. Small, isolated, diff-audited commit.
5. **Stepping + orchestrator integration** (`npcStep.ts`; in `enterColonyExploration` call `generateColonyNpcs`, assign `state.npcs = fpNpcs`, store `sidecar` on the exterior `SceneLayer`; `stepColonyNpcs` into `stepColonyExploration` before its early return, exterior-only; `Game.tsx` real `dtMs`) — the first commit where NPCs appear and move in-game. `generateExteriorState` is not modified.
6. **Playtest + polish** — tuning (walk speed, counts, plaza spread, dialog copy); manual checklist; completion log.

Each phase ships green (`yarn colony:test`, `yarn engine:test`, `npx tsc --noEmit`, `yarn build`) and, from phase 5 on, is playable. Phase 4 (engine edits) lands before phase 5 so the interaction path exists when NPCs are first placed.

### Success criteria

- [ ] `yarn colony:test` + `yarn engine:test` green (~24–30 new tests total); `tsc` + `build` clean
- [ ] Colonists visibly commute by time-of-day; plaza fills at dusk, empties at night
- [ ] **Colony NPCs are talkable** (H1 regression: governor/quartermaster/colonist dialog opens in colony mode); door/pad interaction + anti-bounce still work
- [ ] Governor dialog matches live `ColonyState`; quartermaster shop buys against wallet
- [ ] Governor/quartermaster/colonists render as **visually distinct** sprites (H2)
- [ ] Ashfall NPC dialog/shop unaffected (H1/H2 regression)
- [ ] Deterministic: same colony + seed + hour → identical NPCs/positions (test-verified)
- [ ] No wall-clipping; movement smooth and frame-rate-independent
- [ ] `SaveData` and `ColonyState` shape unchanged; engine diff limited to H1 (helper move + ~8–12 net-new lines, reuse) + H2 additive `FPNPC.sprite?` + one-line sceneInput resolution (diff-audited); `generateExteriorState` return unchanged (existing colony tests stay green)
- [ ] Interiors unaffected (still `npcs: []`)

### Risk callouts

| Risk | Mitigation |
|---|---|
| A* non-determinism (tie-breaks) | Fixed comparator (f, then h, then N/E/S/W); determinism test |
| NPC clips into a building | A* only routes walkable tiles; step never overshoots into solid; playtest |
| Perf from many moving billboards | Cap 10 colonists + 2 named; re-path only on target change; billboards measured cheap |
| NPC walks off mid-dialog | All movement pauses while `dialogState.active` |
| Sparse colony looks broken | Degradation: governor+quartermaster always present; plaza fallback for home/work |
| Scope creep into quests/persistence | Explicit deferred list; data model + `SaveData` untouched |
| H1 edit breaks Phase-2 door/pad or anti-bounce | `tryOpenNpcDialog` is a pure extraction called identically at the old site (audio + `bankDir` side-effects lifted with it); colony-hook call is additive before door/pad; dedicated tests for door/pad + anti-bounce + NPC-priority; audited diff (~8–12 net-new lines) |
| **Close-frame bounce** (dialog closes with interact held → door/pad fires) | NPC-open disarms `colonyInteractArmed`, forcing a key release before any door/pad fire; explicit close-frame tests for quartermaster-on-pad + colonist-at-door |
| Engine gains colony-awareness | H1 reuses the engine's generic `fp.npcs` dialog logic inside the existing `colonyContext` guard — no colony/building/schedule concepts enter the engine; all NPC generation/movement stays in `colony/exploration/npc/`; diff audit |
| NPC near a door: talk vs enter ambiguity | NPC-in-range-and-faced takes priority over door enter that frame; tested |

---

## Relation to master spec

Implements the NPC-population portion of the colony roadmap's Phase 5a. Establishes the orchestrator-owned NPC pattern (generation + schedule + pathfinding + per-frame step) that later phases extend: interior NPCs, the persistent domain-`Npc` registry, dialog trees, and quest hooks all build on the `ColonyNpc` → `FPNPC` bridge introduced here.

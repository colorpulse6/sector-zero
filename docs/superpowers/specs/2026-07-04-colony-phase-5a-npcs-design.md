# Sector Zero — Colony Phase 5a: Living NPCs

**Date:** 2026-07-04
**Status:** Design approved in session, ready for spec review
**Predecessors:**
- `docs/superpowers/specs/2026-04-21-colony-phase-2-fps-descent-design.md` (Phase 2 — the walkable colony this populates)
- `docs/superpowers/specs/2026-07-02-fp-pixel-graphics-system-design.md` (graphics system — billboards render the NPCs)
**Scope:** Populate the walkable Phase-2 colony with NPCs — background colonists who wander on schedules via A* pathing, a **governor** whose dialog reflects live `ColonyState`, and a **quartermaster** with a working shop. All generated deterministically from `ColonyState` each descent, reusing the engine's existing `FPNPC` + dialog. Nearly all new logic lives in the colony orchestrator layer; the engine gets contained, audited edits (Sections H and I) where reuse hits real gaps — colony-mode NPC interaction, an additive `FPNPC.sprite`, and a real FP-shop purchase flow.

---

## Goal

After Phase 2, the colony is a physical place you can walk — but empty. Phase 5a makes it **inhabited**. Descend and the plaza has people: colonists arranged by the hour you arrive — busy in the plaza at dusk, mostly home at night — milling about their spots; a governor you can ask about the colony's state (and get a live answer); and a quartermaster who'll actually sell you supplies. The place stops feeling like a diorama and starts feeling lived-in.

This is the "colony is alive" beat. It adds content *inside* the Phase 2 frame with contained, audited engine edits (Sections H and I) and no change to the save *format* or the colony data model.

---

## Design philosophy (inherited)

- **Reuse before invent.** The FP engine already renders `fp.npcs` as billboards and runs a proximity + facing + interact → dialog flow (proven on Ashfall). Phase 5a reuses it. Contained, diff-audited engine edits are required where reuse hits real gaps: Section H (the Phase-2 colony-interact hook early-returns *before* the NPC-dialog code, so colony NPCs would be un-talkable; and sprites resolve by name, needing an additive `FPNPC.sprite`) and Section I (the existing FP shop is display-only, so the quartermaster's *working* shop needs a real selection + purchase-request flow — economy reused via `purchaseConsumable`).
- **Layered architecture honored.** The engine stays colony-*agnostic*: the NPC-interaction edit reuses the engine's own generic `fp.npcs` dialog-open logic (extracted to a helper), invoked from inside the existing `if (fp.colonyContext)` guard — it does not teach the engine about colonies, buildings, or schedules. NPC generation, scheduling, pathfinding, and per-frame movement all live in a new `colony/exploration/npc/` folder, driven by the orchestrator (`stepColonyExploration`).
- **Deterministic generation.** Same `colony` + `layoutSeed` + `gameClock` → identical NPC set at identical schedule positions. A schedule is a pure function of the hour; nothing new persists. NPCs are ephemeral like the building layout.
- **Incremental, patient, documented.** Contained scope: no quests, no persistence, no interior NPCs, no waking of the deferred domain-`Npc` registry / dialog-tree / mood scaffolding.

---

## Scope contract

### In scope

- New folder `game/app/components/colony/exploration/npc/` (5 files, see File Layout)
- **Wandering background colonists** with day/night schedules, moving via deterministic grid A*
- **Governor** named NPC — dialog built from live `ColonyState` (population, tier, happiness, operational/total buildings, active threats)
- **Quartermaster** named NPC — working shop selling **consumables** against the player wallet (upgrades + materials excluded — see Section I); buy-enabled only for the quartermaster, so Ashfall's shop is unaffected
- **Colonist barks** — 1–2 short contextual lines reflecting colony happiness
- Deterministic generation from `ColonyState` (`population`, `buildings`, `layoutSeed`) — zero net-new `ColonyState`/`SaveData` fields
- Schedule tie-in to the existing five day/night buckets (reused from `dayNightTint`)
- Per-frame NPC stepping in the orchestrator; movement pauses during dialog; delta-time scaled
- **Two contained engine edits (Section H):** colony-mode NPC interaction (extract the existing NPC-dialog-open into a helper; call it inside the colony hook before door/pad, NPC-targeting takes priority) + additive `FPNPC.sprite?` field so colony NPCs get distinct sprites; plus a one-line `Game.tsx` fix to pass real `dtMs` to `stepColonyExploration`
- ~30–38 new tests (A* correctness/determinism, schedule resolution, generation determinism + walkable-target + cap/fallback, governor live-dialog, quartermaster inventory, path-follow + idle-mill + FPNPC-identity stepping, colony-mode NPC-interaction reachability + close-frame anti-bounce, **shop purchase flow**)

### In scope — corrections from the Codex/self review (2026-07-04)

Two review findings changed the feature shape (user-decided):
- **Real shop purchase flow** (Section I): the existing FP shop is display-only (renders items, no buy). The quartermaster gets a genuine purchase flow — selection input, a typed purchase-request channel, `Game.tsx` applying `purchaseConsumable` to `SaveData`, reopenable shop, player frozen while shopping. **Consumables only** — upgrades are deferred (`purchaseUpgrade` bypasses the real `canPurchase`/max-level/XP/material gates), and materials have no reusable grant helper. Buy is **quartermaster-only** (explicit `shopCanBuy` flag); Ashfall's shop stays display-only. It touches `SaveData` (credits/consumables) via the existing purchase helper.
- **Entry-hour schedule snapshot** (not a live clock): the game clock is frozen during a colony visit (`gameClock` is read once at descent and never advanced), so schedules resolve **once from the entry hour**. Colonists path to their entry-hour target and settle into a gentle local idle-mill; different descent times show different arrangements. A live exploration-clock (time passing during a visit) is explicitly deferred.

### Out of scope (deferred)

- **Live exploration clock** — time does not pass during a visit; schedules are an entry-hour snapshot (above). A per-visit clock-advance loop (colonists commuting in real time, tint shifting) is a later add.
- Quests / objectives from NPCs (own later phase — opens quest tracking, rewards, persistence)
- NPC persistence or identity across visits (regenerated deterministically each descent)
- The domain `Npc` registry (`namedNpcs`), `DialogTreeId` branching trees, `ScheduleEntry` domain type, `Mood` — all stay untouched scaffold
- **NPCs inside interiors** — colonists path to building *doors*, never through them; interior population is a later phase
- Faction/standing effects, NPC combat, tier-3 district crowds
- `ColonyState`-shape changes; any engine change beyond Section H (NPC-interaction reachability + additive `FPNPC.sprite?`) and Section I (FP shop purchase flow). `SaveData` is written only via the existing purchase helpers on a buy (Section I) — no new `SaveData` fields.

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

game/app/components/engine/          # Section H (interaction/sprite) + Section I (shop)
├── firstPersonEngine.ts # H1: extract tryOpenNpcDialog(); call inside the if (fp.colonyContext)
│                        #   guard, canFire-gated, before door/pad, NPC priority + disarm.
│                        #   I: shop selection (up/down → selectedIndex), buy → shopPurchaseRequest,
│                        #   freeze movement while dialogState.active. Diff-audited.
├── types.ts             # FPNPC += `sprite?`; FPDialogState += `selectedIndex`, `shopCanBuy?`,
│                        #   `shopNavCooldown?`; FirstPersonState += `shopPurchaseRequest?:
│                        #   { kind: "consumable"; itemId: ConsumableId }` (all additive optional)
├── fpRender/sceneInput.ts   # NPC sprite resolution: `n.sprite ?? NPC_SPRITE_MAP[n.name] ?? …`
└── firstPersonRenderer.ts   # shop draw: highlight the selected row (drawDialogBox shop block)

game/app/components/engine/          # REUSED (not modified) by the shop drain:
#   consumables.ts::purchaseConsumable — economy core, unchanged

game/app/components/Game.tsx  # (a) pass real dtMs to stepColonyExploration (was 16);
                              # (b) drain fp.shopPurchaseRequest each frame → purchaseConsumable
                              #     → apply new SaveData (credits/consumable) via setSaveData/saveSave, or flash
```

**No new `SaveData` fields, no `ColonyState`-shape change.** `FPShopItem` used as-is; the additive optional fields are `FPNPC.sprite?`, `FPDialogState.selectedIndex`, `FirstPersonState.shopPurchaseRequest?`. A purchase writes `SaveData` only through the existing audited `purchaseConsumable` helpers, applied by `Game.tsx`.

### Boundary rules

1. **Orchestrator owns NPCs; engine consumes.** `generateColonyNpcs` builds the NPC set once at descent (assigned to `FirstPersonState.npcs`); `stepColonyNpcs` advances the sidecar each frame and mutates those same `FPNPC` objects' `x/y` in place (never rebuilds the array — see Section C identity rule). The engine renders/interacts with `fp.npcs` exactly as it does for Ashfall.
2. **The `ColonyNpc` sidecar.** The engine's `FPNPC` has no movement/schedule state. The orchestrator keeps a parallel `ColonyNpc[]` (position, path, schedule, home/work) alongside the scene; each frame it steps them and syncs `x/y` into the render `fp.npcs`. **`generateColonyNpcs(colony, gameClock, map)` returns `{ fpNpcs: FPNPC[]; sidecar: ColonyNpc[] }`** — `fpNpcs[i]` and `sidecar[i]` share an `id` and are built together (the `FPNPC` is the render/interaction projection of the `ColonyNpc`, with `dialog`/`shopItems`/`sprite` from `npcDialog.ts`). **`generateExteriorState`'s signature and `FirstPersonState` return are unchanged** (no test breakage). `enterColonyExploration` (`index.ts`, which constructs the `SceneLayer`) calls `generateColonyNpcs` after building the exterior state, assigns `state.npcs = fpNpcs`, and stores `sidecar` on the **exterior `SceneLayer`** (new optional `npcSidecar?` field) — not on `FirstPersonState`. The exterior layer is preserved as `parent` across interior push/pop, so the sidecar survives and resumes on pop.
3. **Interior scenes have no NPCs** (Phase 5a). Entering a building swaps to an interior state with `npcs: []` (unchanged). The exterior sidecar is retained on the parent layer and resumes on pop.
4. **`stepColonyNpcs` runs before the orchestrator's early return.** `stepColonyExploration` returns early on the common no-scene-transition frame; NPC stepping must be inserted *before* that guard or NPCs never advance.
5. **Determinism.** All generation and pathfinding are pure functions of `(colony, layoutSeed, gameClock)` — no `Date.now()`, no `Math.random()` (seeded RNG derived from `layoutSeed`).

---

## Section B — NPC model & schedule

### `ColonyNpc` (internal, orchestrator-only)

Throughout, `Tile` is a coordinate alias, distinct from the map's tile-*kind* strings (`"floor"`/`"wall"`): `type Tile = { x: number; y: number }` (defined once in the npc folder).

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

`ColonyNpc` is distinct from the scaffold domain `Npc` (`colonyTypes.ts`), which stays untouched. Its paired `FPNPC` (built once at generation, **never rebuilt** — see Section C identity rule) carries `{id, x, y, name, type, dialog, shopItems?, color, interacted, sprite}` — `type` is `"merchant"` for the quartermaster (triggers the engine's shop-open) and **`"lore"`** for the governor and colonists (non-merchant, dialog-only); `dialog`/`shopItems`/`sprite` are set once at generation (Sections D/E/I); only `x/y` are re-synced each frame from `ColonyNpc.posX/posY`. `sprite` uses existing `SPRITES.NPC_*` assets (e.g. governor and quartermaster each get a distinct one; colonists rotate over a small set) so the three kinds read as visually different via reuse — no new art.

### Schedule (`npcSchedule.ts`) — entry-hour snapshot

The game clock is **frozen during a colony visit** (`gameClock` is read once at descent, never advanced — verified). So the schedule is resolved **once at descent** from the entry hour: each NPC gets a single target tile for the visit; it does not change while you're there. (A live per-visit clock is deferred — see Scope.) The five day/night buckets (from a shared `bucketForHour`, matching `dayNightTint.tintForHour`: night `<5 || ≥22`, dawn `5–6`, day `7–16`, dusk `17–19`, evening `20–21`) select the entry-hour target:

| Entry bucket | Colonist target | Named-NPC target |
|---|---|---|
| night | homeTile | homeTile |
| dawn / day | workTile | postTile |
| dusk | a plaza tile (social) | postTile |
| evening | homeTile | homeTile |

```typescript
export function scheduleTargetTile(npc: ColonyNpc, hour: number, plazaTiles: Tile[]): Tile;  // called once at generation
```

So a **dusk** descent finds colonists gathering in the plaza; a **night** descent finds a near-empty plaza with people home; a **day** descent finds them at their work-doors. Within any one visit they path to that target and then **idle-mill** (Section C) rather than freezing — that's the "alive" feel without a live clock. Named NPCs (governor, quartermaster) get a fixed active-hours `postTile` (governor at plaza center; quartermaster at a pad-adjacent stall) so the player reliably finds them. Which plaza tile a colonist targets at dusk is chosen deterministically from its id + seed (spreads them, avoids clumping). `plazaTiles` derive deterministically from the fixed `OUTPOST_TEMPLATE` plaza region (`outpostTemplate.ts`), recomputed from the template (cheap, stateless).

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
  npcs: ColonyNpc[],           // the sidecar
  fpNpcs: FPNPC[],             // the SAME persistent FPNPC objects — only x/y are mutated
  map: BoardingMap,
  dtMs: number,
  dialogActive: boolean,
): void;
```

Each NPC's target is fixed for the visit (entry-hour snapshot), so its path is computed **once** on first step (A* home/work/plaza → target). Each frame, per NPC: (1) if not yet at target, advance `posX/posY` toward the next path waypoint at `NPC_WALK_SPEED × dtF` (`dtF = min(dtMs/16.67, 3)`, the shared clamp), snapping waypoints; (2) **on arrival, idle-mill** — a slow, bounded, deterministic drift within ~1 tile of the target (small sinusoidal/step offset keyed to id + an accumulated step counter) so the colony reads as alive rather than a frozen tableau, without needing a live clock. Colonists never enter solid tiles (A* routes only walkable tiles; the mill is clamped to the target's walkable neighborhood). **If `dialogActive`, skip all movement** (`dialogActive` from `fp.dialogState?.active`) — the plaza holds still while you talk. NPCs don't collide with each other (billboards overlap gracefully).

**FPNPC identity rule (load-bearing — Codex finding):** `stepColonyNpcs` **must mutate `fpNpcs[i].x/y` in place on the persistent objects created at generation** — it must NOT rebuild the `fp.npcs` array. An open dialog/shop is bound to a specific NPC by `fp.dialogState.npcId`, and merchant state lives on `FPNPC.interacted`; replacing the array mid-conversation would orphan the active dialog (its `npcId` no longer matches a live object) and reset per-NPC flags. Generate once; only `x/y` change thereafter.

**Exterior-only:** `stepColonyNpcs` runs only when the current scene is the exterior (the sidecar lives on the exterior layer); on an interior frame there is no sidecar and the step no-ops. **`dtMs` plumbing:** `stepColonyExploration` is currently called from `Game.tsx` with a hardcoded `16`; Phase 5a passes the real per-frame `dtMs` (already computed one line above for the engine tick). One-line change; no other `Game.tsx` edit for movement.

---

## Section D — Generation from ColonyState (`colonyNpcs.ts`)

```typescript
export function generateColonyNpcs(
  colony: ColonyState, gameClock: GameClock, map: BoardingMap,
): { fpNpcs: FPNPC[]; sidecar: ColonyNpc[] };
```

Builds each `ColonyNpc` (identity, home/work, sprite) and its paired `FPNPC` projection (dialog/shop/sprite via `npcDialog.ts`). **Spawn model (resolves the round-2 Codex spawn-vs-path contradiction):** a colonist spawns at its **home tile** and A*-paths to its **entry-hour target** (Section C), then idle-mills there — so A* is genuinely used (the descent commute) and the colony visibly stirs as you arrive, settling into the entry-hour arrangement. Named NPCs spawn at (or adjacent to) their `postTile` (short/no path). `map` supplies walkable tiles. Deterministic (seeded RNG from `layoutSeed`):

**Walkable-target rule (load-bearing — Codex finding):** building footprints are solid `"wall"` tiles with a single carved `"door"` (`writeBuildingAt`); the footprint interior is unreachable from the exterior. So home/work targets are **never footprint tiles** — a building's target is its **door tile** or an adjacent walkable **approach tile** (the open floor cell just outside the door). Only **placed** buildings count (slots 0–5; a 7th+ building isn't rendered). Every generated home/work/plaza/post tile MUST be walkable and A*-reachable from spawn — asserted in tests.

1. **Governor** — always spawned. `postTile` = plaza center (walkable). Name derived from colony (e.g., `"Overseer <colony.name>"` or a seeded name). Home = a Habitat door/approach tile if a Habitat is placed, else plaza.
2. **Quartermaster** — always spawned. `postTile` = a walkable landing-pad-adjacent tile (a stall by the pad). Home = a Habitat door/approach tile if present, else plaza.
3. **Colonists** — count = `min(floor(population.total / K), CAP)`, `CAP = 10` (`K` tuned so a small Tier-1 colony shows a handful, a fuller one approaches the cap). *(`ColonyState.backgroundColonistDensity` exists but is unpopulated scaffold — always `0` — so count derives from `population.total`, not density; noted so the field isn't mistaken for live data.)* Each colonist: `homeTile` = a placed Habitat's door/approach tile; `workTile` = a placed **operational** building's door/approach tile (deterministic assignment); `happinessTier` bucketed from `colony.happiness`.
4. **Graceful degradation:** no Habitat → colonists "home" at a plaza tile; no operational building → colonists "work" at a plaza tile. Zero population still shows the governor + quartermaster (staffed, unpopulated).

Zero net-new `ColonyState` fields — everything reads existing state.

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

`buildQuartermasterShop(colony)` returns `FPShopItem[]` whose `itemId`s are real **`ConsumableId`** catalog entries (`type: "consumable"` only); the NPC is `type: "merchant"` so the engine's "end of dialog → open shop" path fires, and the quartermaster's shop is opened with `shopCanBuy` (Section I). Inventory is a small deterministic set of generally-available consumables by tier. Unlike Ashfall's **display-only** shop, this is a **real purchase flow**: select → buy → `purchaseConsumable` deducts credits and grants against the **player wallet** (`save.credits`). No upgrades, no materials, no colony-treasury coupling in Phase 5a.

### Colonists — barks

`buildColonistBark(happinessTier, seed)` → 1–2 short `FPDialogLine`s. Content when `happiness` high ("Good to have boots on the ground out here."), grumbling when low ("Rations again. Tell the Overseer we noticed."). Adds texture; deterministic from tier + id.

---

## Section H — Engine edits for NPC interaction & sprites (contained, audited)

Reusing the engine's NPC/dialog flow requires two small edits (H1 interaction, H2 sprite) + a one-line `Game.tsx` dt fix. The shop purchase flow is a further engine edit, scoped separately in **Section I**. All are diff-audited; none teaches the engine about colonies.

### H1 — Colony-mode NPC interaction (`firstPersonEngine.ts`)

**Why:** `updateFirstPerson` handles NPC dialog-open in a block that runs only when `fp.colonyContext` is *absent*. On the colony exterior `colonyContext` is always set, so the colony hook runs and hits `return;` **before** the NPC block — colony NPCs render but can never be talked to.

**Fix (reuse, not new logic):**
1. Extract the existing NPC-open logic (lines ~191–217: find an NPC within 2.0 tiles that the player faces, `dot > 0`; on interact with the debounce, set `fp.dialogState`) into a helper `tryOpenNpcDialog(gs, fp, keys, posX, posY, dirX, dirY): boolean` (returns whether a dialog opened). **The helper takes `gs`** because the extracted block also pushes an audio event (`gs.audioEvents.push(...)`) and clears `gs.player.bankDir` — both must move into the helper so the non-colony call site stays behavior-identical (pure refactor).
2. Inside the `if (fp.colonyContext)` guard, compute the existing colony `canFire` (`colonyInteractArmed && colonyInteractCooldownFrames<=0 && keys.shoot`) **once**, and gate NPC-open by it — **not** by the NPC block's own `gunCooldown` (Codex finding: an ungated `tryOpenNpcDialog` would bypass the colony anti-bounce state). When `canFire`, call `tryOpenNpcDialog(...)` **before** door/pad resolution; if it opens a dialog, **set `fp.colonyInteractArmed = false`** (see below), skip door/pad this frame (NPC targeting takes priority when an NPC is in range and faced), and return. Otherwise fall through to the existing door/pad resolution (which consumes the same `canFire`) unchanged. So one `canFire` guards NPC-open and door/pad uniformly.

**Interaction with the anti-bounce gate — the close-frame bounce (load-bearing):** while a dialog is open the colony guard is never reached (the dialog block returns early), so `colonyInteractArmed` stays frozen `true`. If NPC-open did *not* disarm it, then the frame the dialog **closes** with the interact key still held, the guard runs, `canFire` (armed && cooldown==0 && shoot) is immediately true, and door/pad resolves that frame — e.g. finishing the quartermaster shop *while standing on the landing pad* pops the exit-to-cockpit menu, or finishing a colonist's dialog *at a building door* enters the building. **Mitigation:** disarming (`colonyInteractArmed = false`) on NPC-open forces a key release before any door/pad fire, closing the bounce — the same disarm-on-transition discipline Phase 2 already uses. Dialog-advance is unaffected (it runs in its own pre-guard block with the existing `gunCooldown` debounce). Door/pad transitions otherwise retain their edge-trigger + cooldown gate exactly.

The plan must verify (tests below): colony NPC dialog opens; door/pad still work when no NPC is targeted; the anti-bounce gate still holds; **the close frame with held interact does NOT trigger door/pad** (quartermaster-on-pad and colonist-at-door cases); and an NPC near a door is reachable for talk without accidentally entering.

**Audit gate:** the `firstPersonEngine.ts` change is the helper extraction (a ~26-line verbatim move) + one call inside the colony guard + the disarm line — **net-new logic ~8–12 lines**, all reuse, zero change to non-colony behavior (the extracted helper is called identically from the old site). Note for the auditor: a raw `git diff --stat` will show ~50 lines because the moved block counts as delete+add; read it as "moved block + one new guarded call + one disarm line."

### H2 — `FPNPC.sprite?` additive field (`types.ts` + `fpRender/sceneInput.ts`)

**Why:** NPC billboards resolve their sprite via `NPC_SPRITE_MAP[n.name] ?? SPRITES.NPC_SURVIVOR`, keyed on the NPC's **name**. Colony NPC names are dynamic (`"Overseer <colony.name>"`) or absent from the map, so every colony NPC would fall back to `NPC_SURVIVOR` — all identical.

**Fix:** add optional `sprite?: string` to `FPNPC` (additive — existing Ashfall NPCs omit it, unaffected). In `sceneInput.ts`, NPC sprite resolution becomes `n.sprite ?? NPC_SPRITE_MAP[n.name] ?? SPRITES.NPC_SURVIVOR` (name-map path preserved for Ashfall). Colony NPCs set `sprite` to existing `SPRITES.NPC_*` assets. One-line resolution change; one additive field.

### H3 — `Game.tsx` real `dtMs` (one line)

`stepColonyExploration(stack, save, 16)` → pass the real `dtMs` already computed for the engine tick, so NPC movement is frame-rate-independent (Section C). No other `Game.tsx` change *for movement* (Section I adds a separate purchase-drain).

---

## Section I — FP shop purchase flow (new; **consumables only**, quartermaster-only)

The existing FP shop is **display-only** (Codex finding, verified): `drawDialogBox` renders `shopItems` with costs, and interact merely *closes* it — no selection, no deduction, no grant. The quartermaster needs a real purchase flow. Scoped tightly per the round-2 Codex review:

- **Consumables only** (no upgrades, no materials). `purchaseUpgrade` skips the real upgrade rules (`getUpgradeCost`/`canPurchase` max-level/XP/material checks that the cockpit path enforces), so wiring the shop straight to it would let you buy upgrades that bypass those gates — deferred. Materials have no reusable grant helper. So the quartermaster sells **`ConsumableId`** items via `purchaseConsumable` only.
- **Buy-enable is explicit and quartermaster-only.** Ashfall's existing merchant has invalid/`material` shop rows (`ashfallForwardCamp.ts` — e.g. a non-catalog `itemId`) that were harmless while the shop was display-only; making buy "general" would break them. So buying is gated by an explicit flag (`FPDialogState.shopCanBuy`, set true only when the quartermaster opens its shop) — **Ashfall's shop stays browse-only, unchanged**, and is regression-tested.

### What's reuse vs new

- **Reuse (economy):** `purchaseConsumable(save, id)` (`engine/consumables.ts:6`) validates unlock + `credits >= cost` + max-carry, deducts, grants, returns a new `SaveData` or `null`. Wallet = `save.credits`. No new economy code.
- **New (FP-shop UI + channel):** selection in the shop-open state, a typed purchase-request signal, and `Game.tsx` applying the purchase.

### Design

1. **Selection + input** (`firstPersonEngine.ts` shop block + `firstPersonRenderer.ts` shop draw): while `dialogState.shopOpen && shopCanBuy`, add `selectedIndex` on `FPDialogState`; `up`/`down` move it, debounced via a small cooldown field (FP `Keys` are held-booleans with no edge state — reuse the `gunCooldown`-style debounce the dialog already uses, or add a `shopNavCooldown`). The item list includes a trailing **"LEAVE" row**; interact **buys** a real item or **closes** on LEAVE (so a single interact key covers both — no second key, and crucially **not `Esc`**, which already triggers pause in `Game.tsx`). The renderer highlights `selectedIndex` and updates the hint (`firstPersonRenderer.ts:332` "[Z] Close Shop" → "[Z] BUY / ↑↓ SELECT"). Ashfall shops (no `shopCanBuy`) keep the old close-on-interact behavior.
2. **Typed purchase-request channel** (no `SaveData` mutation in the engine): on buy, the engine sets a one-shot discriminated `fp.shopPurchaseRequest: { kind: "consumable"; itemId: ConsumableId }` (engine emits **nothing** for a row that isn't a valid consumable). Mirrors the Phase-2 `colonyTransitionRequest` seam. `Game.tsx` drains it each frame: calls `purchaseConsumable(save, itemId)`; if it returns a new save, applies it (credits down, consumable granted) via `setSaveData`/`saveSave` and clears; if `null`, sets a brief **generic "purchase unavailable"** flash (null can mean locked, unaffordable, or max-carry — not only "insufficient credits") and clears. The shop **stays open** for more purchases — `interacted` is **not** used to gate shop-open (the engine currently opens a merchant shop only when `!interacted` then sets it; Phase 5a removes `interacted` as that gate so the quartermaster reopens).
3. **Player frozen while shopping** (small engine fix): today rotation/movement (`firstPersonEngine.ts:99–130`) runs *before* the dialog-active early-return (`:158`), so the player can walk while shopping. Gate the movement block on `!fp.dialogState?.active` (or hoist the dialog-active return above movement). Also fixes "walk off mid-dialog" for all FP NPCs; Ashfall-regression-tested.
4. **Inventory** (`buildQuartermasterShop(colony)`): a small deterministic set of **generally-available** `ConsumableId`s (so unlock-gating rarely bites); the builder has no `SaveData`, so it doesn't filter by unlock/affordability — the generic-unavailable flash covers the rest.

### Boundaries

- `FPDialogState` gains `selectedIndex` and `FirstPersonState` gains `shopPurchaseRequest?` (additive optional fields; no new `SaveData` fields). Economy stays in `consumables.ts`/`save.ts`. The engine signals; `Game.tsx` applies — the same request/drain seam Phase 2 uses for scene transitions.
- Colony exploration was "no save write" in Phase 2; a **purchase is the one intentional `SaveData` write** during exploration, applied by `Game.tsx` via the audited purchase helpers (not by the engine, not by the orchestrator).

---

## Section F — Testing

Pure-logic, deterministic, under the existing `tsx --test` (extends `yarn colony:test`):

**Determinism scope (self-review):** determinism is pinned for **generation and pathfinding** — the initial NPC set, home/work/plaza/post tiles, and A* paths are pure functions of `(colony, layoutSeed, gameClock)`. Runtime *positions* after N steps depend on elapsed frame time and the idle-mill counter, so tests pin the generation/path outputs and the idle-mill's determinism *given a fixed step count*, not "positions after arbitrary play."

1. **`npcPathfind.test.ts`** — A* finds a known-optimal path on a fixture; identical `(map,start,goal)` → identical path (determinism); returns `[]` for unreachable goal; never routes over a solid tile; handles start==goal.
2. **`npcSchedule.test.ts`** — every hour maps to the correct bucket (shared `bucketForHour`); each entry bucket → correct target for colonist vs named NPC; plaza-tile selection deterministic and spread.
3. **`colonyNpcs.test.ts`** — same `(colony, clock, map)` → identical NPC set + tiles (determinism); count from `population.total`, respects `CAP=10`; governor + quartermaster always present; degradation (no habitat / no operational building / zero population); **every generated home/work/plaza/post tile is walkable AND A*-reachable from spawn** (guards the footprint-tile bug); only placed buildings (slots 0–5) targeted.
4. **`npcDialog.test.ts`** — governor dialog reflects given `ColonyState` (population number, named down building, threat present); quartermaster shop inventory (real `itemId`s) by tier; colonist bark tier selection.
5. **Stepping** (`npcStep` test) — an NPC advances toward and reaches its target over N steps; on arrival idle-mills within its clamp and never on a solid tile; movement pauses when `dialogActive`; **`stepColonyNpcs` mutates the same `FPNPC` objects (identity preserved) and does NOT reset `interacted`** (Codex identity trap).
6. **Engine interaction (H1)** (extend the FP engine tests) — with `fp.colonyContext` set and an NPC in range + faced, pressing interact opens `dialogState` (regression guard for the early-return bug); NPC-open is gated by the colony `canFire` (not `gunCooldown`); with no NPC targeted, door/pad still fires and the anti-bounce gate holds; **close-frame bounce guard** — after a colony NPC dialog opens (which disarms), closing it with interact still held does NOT fire door/pad that frame (quartermaster-on-pad, colonist-at-door); `tryOpenNpcDialog` behaves identically at the non-colony site (audio + `bankDir` preserved). H2: `n.sprite` wins over the name map; a name-mapped NPC with no `sprite` still resolves via the map (Ashfall unaffected).
7. **Shop purchase (Section I)** — `up`/`down` moves `selectedIndex` (debounced); interact on a consumable row sets `shopPurchaseRequest { kind:"consumable", itemId }`, on the **LEAVE row** closes the shop; `Game.tsx` drain applies `purchaseConsumable` → credits down + consumable granted (assert vs a fixture save); `null` (unaffordable/locked/max-carry) → no mutation + generic "unavailable" flash; shop stays open + reopenable (no `interacted` gate). **Ashfall regression**: its shop (no `shopCanBuy`) still just browses/closes — no accidental purchase, its invalid rows never fire a request. Player movement frozen while `dialogState.active` (Ashfall dialog unaffected).

**Total new: ~30–38 tests.** Manual playtest (prod build): descend at different hours → colonists arranged by the entry hour, milling (plaza busy at dusk, quiet at night); talk to the governor (live stats match the meta screen); **buy a consumable from the quartermaster and confirm credits/inventory update in the save**; verify Ashfall NPC dialog still works (H1/H2/I regression); confirm no wall-clipping.

---

## Section G — Implementation phases (for the plan)

1. **A\* pathfinder** (`npcPathfind.ts` + tests) — pure, standalone, deterministic. No integration.
2. **Schedule + NPC model** (`npcSchedule.ts`, `ColonyNpc`, `colonyNpcs.ts` generation + tests) — pure generation, no rendering; walkable door/approach targets, placed-buildings-only, `population.total` count. Extract a shared `bucketForHour(hour)` (`dayNightTint.ts`) so the schedule and tint share one source.
3. **Dialog/shop builders** (`npcDialog.ts` + tests) — governor live-dialog, quartermaster shop items (real `itemId`s), colonist barks.
4. **Engine edits H1/H2** (`firstPersonEngine.ts` `tryOpenNpcDialog` extraction + `canFire`-gated colony-hook call; `types.ts` `FPNPC.sprite?`; `sceneInput.ts` resolution) + tests — pure enabler, no colony NPCs placed yet; Ashfall regression-tested. Small, isolated, diff-audited.
5. **FP shop purchase flow (Section I)** (`firstPersonEngine.ts` selection + `shopPurchaseRequest`; `firstPersonRenderer.ts` selection highlight; `types.ts` `FPDialogState.selectedIndex` + `FirstPersonState.shopPurchaseRequest?`; `Game.tsx` purchase drain via `purchaseConsumable`; player-freeze-during-dialog) + tests — general FP-shop capability; economy reused. Ashfall regression-tested. Independently shippable.
6. **Stepping + orchestrator integration** (`npcStep.ts` — in-place `FPNPC.x/y` mutation + idle-mill; in `enterColonyExploration` call `generateColonyNpcs`, assign `state.npcs = fpNpcs`, store `sidecar` on the exterior `SceneLayer`; `stepColonyNpcs` into `stepColonyExploration` before its early return, exterior-only; `Game.tsx` real `dtMs`) — first commit where NPCs appear and move. `generateExteriorState` not modified.
7. **Playtest + polish** — tuning (walk speed, counts, mill radius, plaza spread, shop inventory, dialog copy); manual checklist; completion log.

Each phase ships green (`yarn colony:test`, `yarn engine:test`, `npx tsc --noEmit`, `yarn build`). Phases 4–5 (engine enablers) land before phase 6 so interaction + shop exist when NPCs are placed. Playable from phase 6 on.

### Success criteria

- [ ] `yarn colony:test` + `yarn engine:test` green (~30–38 new tests total); `tsc` + `build` clean
- [ ] Colonists arranged by the **entry hour** (plaza busy at dusk, quiet at night) and idle-mill; different descent times differ
- [ ] **Colony NPCs are talkable** (H1 regression: governor/quartermaster/colonist dialog opens in colony mode); door/pad interaction + anti-bounce still work
- [ ] Governor dialog matches live `ColonyState`; **quartermaster shop actually buys** — select item, credits deducted, item granted, save updated (Section I)
- [ ] Governor/quartermaster/colonists render as **visually distinct** sprites (H2)
- [ ] Ashfall NPC dialog/shop unaffected (H1/H2/I regression)
- [ ] Deterministic **generation + pathfinding**: same colony + seed + entry hour → identical NPC set, tiles, A* paths (test-verified); every target walkable + reachable
- [ ] No wall-clipping; movement smooth and frame-rate-independent; `FPNPC` identity preserved during stepping (`interacted` not reset)
- [ ] No new `SaveData`/`ColonyState` fields; engine diff limited to H1 + H2 + Section I (all additive/audited); a purchase writes save only via existing `purchaseConsumable`; `generateExteriorState` return unchanged (existing colony tests stay green)
- [ ] Interiors unaffected (still `npcs: []`)

### Risk callouts

| Risk | Mitigation |
|---|---|
| A* non-determinism (tie-breaks) | Fixed comparator (f, then h, then N/E/S/W); determinism test |
| Home/work target on a non-walkable footprint tile | Targets are door/approach tiles only, placed buildings only; test asserts every target walkable + A*-reachable |
| NPC clips into a building | A* routes only walkable tiles; idle-mill clamped to target neighborhood; playtest |
| Perf from moving billboards | Cap 10 colonists + 2 named; path computed once per visit (fixed target); billboards measured cheap |
| Stepping resets `interacted`/dialog | `stepColonyNpcs` mutates `FPNPC.x/y` in place on persistent objects; never rebuilds the array; identity test |
| Shop lets you buy what you can't afford / double-spend | `purchaseConsumable` already guard `credits >= cost` and return null; drain applies atomically per frame; test affordable + unaffordable |
| Save write during exploration (was "never" in Phase 2) | The single intentional write is a purchase, via audited helpers applied in `Game.tsx` — not the engine, not the orchestrator |
| Sparse colony looks broken | Degradation: governor+quartermaster always present; plaza fallback for home/work |
| Scope creep into quests/persistence/live-clock | Explicit deferred list; `ColonyState`/save-shape untouched; live exploration clock deferred |
| H1 edit breaks Phase-2 door/pad or anti-bounce | `tryOpenNpcDialog` is a pure extraction called identically at the old site (audio + `bankDir` side-effects lifted with it); colony-hook call is additive before door/pad; dedicated tests for door/pad + anti-bounce + NPC-priority; audited diff (~8–12 net-new lines) |
| **Close-frame bounce** (dialog closes with interact held → door/pad fires) | NPC-open disarms `colonyInteractArmed`, forcing a key release before any door/pad fire; explicit close-frame tests for quartermaster-on-pad + colonist-at-door |
| Engine gains colony-awareness | H1 reuses the engine's generic `fp.npcs` dialog logic inside the existing `colonyContext` guard — no colony/building/schedule concepts enter the engine; all NPC generation/movement stays in `colony/exploration/npc/`; diff audit |
| NPC near a door: talk vs enter ambiguity | NPC-in-range-and-faced takes priority over door enter that frame; tested |

---

## Relation to master spec

Implements the NPC-population portion of the colony roadmap's Phase 5a. Establishes the orchestrator-owned NPC pattern (generation + schedule + pathfinding + per-frame step) that later phases extend: interior NPCs, the persistent domain-`Npc` registry, dialog trees, and quest hooks all build on the `ColonyNpc` → `FPNPC` bridge introduced here.

# Colony Phase 5a — Living NPCs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate the walkable Phase-2 colony with NPCs — colonists that spawn at home, A*-walk to an entry-hour target, and idle-mill; a governor whose dialog reflects live `ColonyState`; and a quartermaster with a real (consumables-only) shop — all generated deterministically from `ColonyState`, reusing the engine's `FPNPC`/dialog.

**Architecture:** All NPC logic (generation, schedule, A*, per-frame stepping, dialog/shop builders) lives in a new `game/app/components/colony/exploration/npc/` folder driven by the orchestrator (`stepColonyExploration`). The engine stays colony-*agnostic*: it gets contained, audited edits only where reuse hits a real gap — H1 (colony-mode NPC interaction), H2 (additive `FPNPC.sprite`), and Section I (a real FP shop purchase flow, quartermaster-only). NPCs are ephemeral (regenerated deterministically each descent; nothing new persists). The one intentional `SaveData` write during exploration is a shop purchase, applied by `Game.tsx` via the existing `purchaseConsumable` helper.

**Tech Stack:** TypeScript, `tsx --test` (node:test). No new deps. Tests go in `game/tests/colony/*.test.ts` (run by `yarn colony:test`) and `game/tests/engine/*.test.ts` (run by `yarn engine:test`). **Both scripts glob one level only (`tests/<dir>/*.test.ts`) — new test files MUST be flat in those dirs, NOT in a subfolder, or they are silently skipped.** (Source files still live under `colony/exploration/npc/`; only the test files are flat.)

**Spec:** `docs/superpowers/specs/2026-07-04-colony-phase-5a-npcs-design.md` — READ IT FIRST. It records every decision and the review history (3 Claude + 2 Codex passes). The load-bearing details below trace to specific spec sections.

**Branch:** `colony/phase-5a` (already checked out; off `main`, which now contains the merged graphics work). One commit per task.

**Verification (every task):**
```bash
cd /Users/nichalasbarnes/Desktop/projects/sector-zero/game
yarn colony:test && yarn engine:test && npx tsc --noEmit && yarn build
```

---

## File map

| File | Responsibility |
|---|---|
| `colony/exploration/npc/types.ts` | `ColonyNpc`, `NpcKind`, `Tile`, internal shapes |
| `colony/exploration/npc/npcPathfind.ts` | deterministic grid A* over walkable tiles |
| `colony/exploration/npc/npcSchedule.ts` | `bucketForHour` (shared) + `scheduleTargetTile` |
| `colony/exploration/npc/colonyNpcs.ts` | `generateColonyNpcs(colony, gameClock, map) → { fpNpcs, sidecar }` |
| `colony/exploration/npc/npcDialog.ts` | governor / quartermaster / colonist dialog + shop builders |
| `colony/exploration/npc/npcStep.ts` | `stepColonyNpcs` — per-frame path-follow + idle-mill; in-place `FPNPC.x/y` |
| `colony/exploration/npc/index.ts` | public re-exports |
| `engine/dayNightTint.ts` (MODIFY — it lives in `colony/exploration/`) | export `bucketForHour` used by both tint + schedule |
| `engine/firstPersonEngine.ts` (MODIFY) | H1: `tryOpenNpcDialog` + colony-hook call; Section I: shop selection/buy/freeze |
| `engine/types.ts` (MODIFY) | additive: `FPNPC.sprite?`, `FPDialogState.selectedIndex/shopCanBuy?/shopNavCooldown?`, `FirstPersonState.shopPurchaseRequest?` |
| `engine/fpRender/sceneInput.ts` (MODIFY) | NPC sprite resolution `n.sprite ?? map ?? SURVIVOR` |
| `engine/firstPersonRenderer.ts` (MODIFY) | shop selection highlight + hint |
| `colony/exploration/sceneStack.ts` (MODIFY) | `SceneLayer.npcSidecar?` |
| `colony/exploration/index.ts` (MODIFY) | wire generate + step into enter/step |
| `Game.tsx` (MODIFY) | real `dtMs` to `stepColonyExploration`; drain `shopPurchaseRequest` |

REUSED unchanged: `engine/consumables.ts::purchaseConsumable`.

**`ConsumableId`** is `engine/types.ts:657`; `purchaseConsumable(save, id): SaveData | null` (`consumables.ts:6`) checks def/unlock/`credits>=cost`/maxCarry. `GameClock = { day, hour, minute, realtimeMsPerGameMinute, season }`. Colony test fixture: `makeTestColony(overrides)` in `tests/colony/fixtures.ts`.

---

### Task 1: Deterministic grid A* pathfinder

**Files:**
- Create: `game/app/components/colony/exploration/npc/types.ts`
- Create: `game/app/components/colony/exploration/npc/npcPathfind.ts`
- Test: `game/tests/colony/npcPathfind.test.ts`

- [ ] **Step 1.1: `types.ts` — the coordinate alias + kinds**

```typescript
import type { FPNPC } from "../../../engine/types";

export type Tile = { x: number; y: number };            // coord, NOT a tile-kind string
export type NpcKind = "governor" | "quartermaster" | "colonist";

export interface ColonyNpc {
  id: number;
  kind: NpcKind;
  name: string;
  sprite: string;                 // a SPRITES.NPC_* path; copied to FPNPC.sprite
  posX: number; posY: number;     // continuous tile coords (spawn = homeTile center)
  homeTile: Tile;
  workTile: Tile;                 // placed operational building's door/approach tile (home fallback)
  postTile: Tile | null;          // named NPCs' active-hours station; null for colonists
  targetTile: Tile;               // RESOLVED entry-hour target (scheduleTargetTile); fixed for the visit
  happinessTier: "content" | "strained" | "grim";
  path: Tile[];                   // remaining waypoints to targetTile ([] once arrived)
  pathComputed: boolean;          // A* run once on first step
  millSeed: number;               // deterministic idle-mill offset key
}

export interface GeneratedNpcs { fpNpcs: FPNPC[]; sidecar: ColonyNpc[]; }
```

- [ ] **Step 1.2: Write failing A* test**

`game/tests/colony/npcPathfind.test.ts`:
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { findPath } from "../../app/components/colony/exploration/npc/npcPathfind";
import type { BoardingMap } from "../../app/components/engine/types";

// 5x5: perimeter wall, open interior, one interior wall pillar at (2,2).
function tinyMap(): BoardingMap {
  const W = 5, H = 5;
  const tiles = Array.from({ length: H }, (_, y) =>
    Array.from({ length: W }, (_, x) =>
      (x === 0 || y === 0 || x === W - 1 || y === H - 1) ? "wall" : "floor"));
  tiles[2][2] = "wall";
  return { width: W, height: H, tileSize: 32, tiles: tiles as never };
}

test("findPath returns an optimal walkable path start→goal", () => {
  const path = findPath(tinyMap(), { x: 1, y: 1 }, { x: 3, y: 3 });
  assert.ok(path.length > 0, "path found");
  // Manhattan optimal from (1,1)→(3,3) around the (2,2) pillar = 4 steps.
  assert.equal(path.length, 4);
  // never steps on a solid tile
  for (const p of path) assert.notEqual(tinyMap().tiles[p.y][p.x], "wall");
  // ends at goal
  assert.deepEqual(path[path.length - 1], { x: 3, y: 3 });
});

test("findPath is deterministic (identical inputs → identical path)", () => {
  const a = findPath(tinyMap(), { x: 1, y: 1 }, { x: 3, y: 3 });
  const b = findPath(tinyMap(), { x: 1, y: 1 }, { x: 3, y: 3 });
  assert.deepEqual(a, b);
});

test("findPath returns [] for an unreachable goal", () => {
  assert.deepEqual(findPath(tinyMap(), { x: 1, y: 1 }, { x: 0, y: 0 }), []);
});

test("findPath handles start === goal", () => {
  assert.deepEqual(findPath(tinyMap(), { x: 1, y: 1 }, { x: 1, y: 1 }), []);
});
```

- [ ] **Step 1.3: Run — expect FAIL** (`cd game && npx tsx --test tests/colony/npcPathfind.test.ts` → module not found).

- [ ] **Step 1.4: Implement `npcPathfind.ts`**

Complete, deterministic A* (4-dir, Manhattan, fixed tie-break: lower f, then lower h, then a fixed N/E/S/W neighbor order). Walkable = `"floor" | "door"`.

```typescript
import type { BoardingMap } from "../../../engine/types";
import type { Tile } from "./types";

const NEIGHBORS: Tile[] = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }]; // N,E,S,W

function walkable(map: BoardingMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const t = map.tiles[y][x];
  return t === "floor" || t === "door";
}
const key = (x: number, y: number) => y * 1000 + x;

/** Deterministic 4-dir A*. Returns waypoint tiles AFTER start, ending at goal, or [] if
 *  unreachable or start===goal. Tie-break: lower f, then lower h, then insertion order
 *  (neighbors always expanded N,E,S,W) — so identical inputs yield identical paths. */
export function findPath(map: BoardingMap, start: Tile, goal: Tile): Tile[] {
  if (start.x === goal.x && start.y === goal.y) return [];
  if (!walkable(map, goal.x, goal.y)) return [];
  const h = (x: number, y: number) => Math.abs(x - goal.x) + Math.abs(y - goal.y);

  const gScore = new Map<number, number>();
  const cameFrom = new Map<number, number>();
  // open list as a plain array; we scan for the best node (grid ≤ ~576, trivial).
  const open: { x: number; y: number; g: number; f: number }[] = [];
  gScore.set(key(start.x, start.y), 0);
  open.push({ x: start.x, y: start.y, g: 0, f: h(start.x, start.y) });

  while (open.length) {
    // pick lowest f, then lowest h(=f-g), then earliest inserted (stable scan)
    let bi = 0;
    for (let i = 1; i < open.length; i++) {
      const o = open[i], b = open[bi];
      if (o.f < b.f || (o.f === b.f && (o.f - o.g) < (b.f - b.g))) bi = i;
    }
    const cur = open.splice(bi, 1)[0];
    if (cur.x === goal.x && cur.y === goal.y) {
      // reconstruct
      const out: Tile[] = [];
      let k = key(cur.x, cur.y);
      while (cameFrom.has(k)) {
        out.push({ x: k % 1000, y: Math.floor(k / 1000) });
        k = cameFrom.get(k)!;
      }
      out.reverse();
      return out;
    }
    const ck = key(cur.x, cur.y);
    if (cur.g > (gScore.get(ck) ?? Infinity)) continue; // stale
    for (const n of NEIGHBORS) {
      const nx = cur.x + n.x, ny = cur.y + n.y;
      if (!walkable(map, nx, ny)) continue;
      const nk = key(nx, ny), ng = cur.g + 1;
      if (ng < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, ng);
        cameFrom.set(nk, ck);
        open.push({ x: nx, y: ny, g: ng, f: ng + h(nx, ny) });
      }
    }
  }
  return [];
}
```

- [ ] **Step 1.5: Run — expect PASS.** Then full verification commands.

- [ ] **Step 1.6: Commit** — `feat(colony): deterministic grid A* for NPC pathing`

---

### Task 2: Schedule + NPC generation

**Files:**
- Create: `game/app/components/colony/exploration/npc/npcSchedule.ts`
- Create: `game/app/components/colony/exploration/npc/colonyNpcs.ts`
- Modify: `game/app/components/colony/exploration/dayNightTint.ts` (export `bucketForHour`)
- Test: `game/tests/colony/npcSchedule.test.ts`, `game/tests/colony/colonyNpcs.test.ts`

- [ ] **Step 2.1: Extract `bucketForHour` in `dayNightTint.ts`**

Read the current `tintForHour` boundaries and factor them out (do NOT change tint behavior):
```typescript
export type DayBucket = "night" | "dawn" | "day" | "dusk" | "evening";
export function bucketForHour(hour: number): DayBucket {
  if (hour < 5 || hour >= 22) return "night";
  if (hour < 7) return "dawn";
  if (hour < 17) return "day";
  if (hour < 20) return "dusk";
  return "evening";
}
```
Refactor `tintForHour` to call `bucketForHour` (behavior identical — the existing `dayNightTint.test.ts` must still pass unchanged).

- [ ] **Step 2.2: Failing schedule test** (`npcSchedule.test.ts`): every hour → correct bucket; colonist entry-bucket → target selection (night→home, dawn/day→work, dusk→plaza, evening→home); named NPC → post except night/evening→home. (Follow the spec's Section B table.) Signature:
```typescript
export function scheduleTargetTile(npc: ColonyNpc, hour: number, plazaTiles: Tile[]): Tile;
```

- [ ] **Step 2.3: Implement `npcSchedule.ts`** per the spec table, using `bucketForHour`. Plaza-tile pick is deterministic from `npc.id` (`plazaTiles[npc.id % plazaTiles.length]`).

- [ ] **Step 2.4: Failing generation test** (`colonyNpcs.test.ts`) — the load-bearing constraints:
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateColonyNpcs } from "../../app/components/colony/exploration/npc/colonyNpcs";
import { generateExteriorState } from "../../app/components/colony/exploration/colonyLayout";
import { findPath } from "../../app/components/colony/exploration/npc/npcPathfind";
import { makeTestColony } from "./fixtures";

const clock = { day: 0, hour: 12, minute: 0, realtimeMsPerGameMinute: 1000, season: "standard" as const };

test("generation is deterministic for identical inputs", () => {
  const c = makeTestColony({ population: { total: 40, capacity: 40, namedCount: 0, growthRate: 0, recentDeaths: [] } });
  const map = generateExteriorState(c, clock).map;
  const a = generateColonyNpcs(c, clock, map);
  const b = generateColonyNpcs(c, clock, map);
  assert.deepEqual(a.sidecar.map(n => [n.id, n.kind, n.homeTile, n.targetTile]),
                   b.sidecar.map(n => [n.id, n.kind, n.homeTile, n.targetTile]));
});

test("governor + quartermaster always present; colonists cap at 10", () => {
  const c = makeTestColony({ population: { total: 999, capacity: 999, namedCount: 0, growthRate: 0, recentDeaths: [] } });
  const map = generateExteriorState(c, clock).map;
  const { sidecar } = generateColonyNpcs(c, clock, map);
  assert.equal(sidecar.filter(n => n.kind === "governor").length, 1);
  assert.equal(sidecar.filter(n => n.kind === "quartermaster").length, 1);
  assert.ok(sidecar.filter(n => n.kind === "colonist").length <= 10);
});

test("every NPC home + target is walkable AND reachable from spawn (no footprint-wall targets)", () => {
  const c = makeTestColony({ population: { total: 40, capacity: 40, namedCount: 0, growthRate: 0, recentDeaths: [] } });
  const map = generateExteriorState(c, clock).map;
  const walk = (t: {x:number;y:number}) => ["floor","door"].includes(map.tiles[t.y][t.x] as string);
  for (const n of generateColonyNpcs(c, clock, map).sidecar) {
    assert.ok(walk(n.homeTile), `home ${JSON.stringify(n.homeTile)} walkable`);
    assert.ok(walk(n.targetTile), `target ${JSON.stringify(n.targetTile)} walkable`);
    // reachable: A* from home to target succeeds (or they're identical)
    const same = n.homeTile.x === n.targetTile.x && n.homeTile.y === n.targetTile.y;
    assert.ok(same || findPath(map, n.homeTile, n.targetTile).length > 0, "target reachable from home");
  }
});

test("zero population still yields governor + quartermaster", () => {
  const c = makeTestColony(); // population.total 0
  const map = generateExteriorState(c, clock).map;
  const kinds = generateColonyNpcs(c, clock, map).sidecar.map(n => n.kind);
  assert.ok(kinds.includes("governor") && kinds.includes("quartermaster"));
});
```

- [ ] **Step 2.5: Implement `colonyNpcs.ts`** — `generateColonyNpcs(colony, gameClock, map)`. Seeded RNG from `layoutSeed` (a small deterministic PRNG, e.g. mulberry32). Rules from spec Section D:
  - Governor + quartermaster always; `postTile` = plaza center / pad-adjacent walkable tile; `homeTile` = a placed Habitat's **door/approach** tile if present, else plaza. Spawn at `postTile` (or adjacent).
  - Colonists: `count = min(floor(population.total / K), 10)` (pick `K` ~ 4). `homeTile` = a placed Habitat door/approach tile (deterministic); `targetTile` = `scheduleTargetTile(entry-hour)` resolved to a walkable door/approach tile of a placed **operational** building (work), a plaza tile, or home; **spawn `posX/posY` = homeTile center**. `happinessTier` from `colony.happiness`.
  - **Walkable-target helper:** for a building, the target is its `door` tile OR the adjacent walkable floor cell (compute from the building's slot + `doorSide`; reuse `buildingTiles`/`outpostTemplate` geometry). Only slots 0–5 (placed). Never a footprint interior tile.
  - Each `ColonyNpc` gets a paired `FPNPC` (via `npcDialog.ts`, Task 3) with `id`, `x/y` = spawn, `sprite`, `type` (`"merchant"` quartermaster else `"lore"`). Until Task 3 lands, stub `dialog: []` — but sequence Task 3 first if cleaner. (Recommended order: do Task 3's builders before wiring them here; this task can import them.)

*(Note: Tasks 2 and 3 are interdependent — `colonyNpcs` calls the dialog builders. Implement `npcDialog.ts` (Task 3) first or in the same task if the subagent prefers; the plan keeps them separate for review clarity, but Task 2's generation test may stub dialog until Task 3.)*

- [ ] **Step 2.6: Run — expect PASS; full verification; Commit** — `feat(colony): NPC schedule + deterministic generation (walkable targets)`

---

### Task 3: Dialog + shop builders

**Files:**
- Create: `game/app/components/colony/exploration/npc/npcDialog.ts`
- Test: `game/tests/colony/npcDialog.test.ts`

- [ ] **Step 3.1: Failing test** — governor dialog reflects live `ColonyState` (a line contains `population.total`; names a non-operational building; mentions a threat when `activeThreats` non-empty); `buildQuartermasterShop` returns `FPShopItem[]` with real `ConsumableId` `itemId`s and `type: "consumable"`; `buildColonistBark` returns 1–2 lines varying by happiness tier.

- [ ] **Step 3.2: Implement `npcDialog.ts`:**
```typescript
import type { FPDialogLine, FPShopItem, ConsumableId } from "../../../engine/types";
import type { ColonyState } from "../../shared/colonyTypes";

export function buildGovernorDialog(colony: ColonyState): FPDialogLine[] { /* live-state lines */ }
export function buildQuartermasterShop(colony: ColonyState): FPShopItem[] {
  // small deterministic set of generally-available ConsumableIds by tier;
  // { id, name, description, cost, type: "consumable", itemId: <ConsumableId> }
}
export function buildColonistBark(tier: "content"|"strained"|"grim", seed: number): FPDialogLine[] { /* … */ }
```
Pick 2–3 real `ConsumableId`s from `types.ts:657` that are unlocked early (verify via `CONSUMABLE_DEFS`/`isConsumableUnlocked` semantics). Governor lines are a pure function of `ColonyState`.

- [ ] **Step 3.3: Run PASS; verification; Commit** — `feat(colony): governor/quartermaster/colonist dialog + shop builders`

---

### Task 4: Engine edits H1 (NPC interaction) + H2 (sprite)

**Files:**
- Modify: `game/app/components/engine/firstPersonEngine.ts` (H1)
- Modify: `game/app/components/engine/types.ts` (`FPNPC.sprite?`)
- Modify: `game/app/components/engine/fpRender/sceneInput.ts` (resolution)
- Test: `game/tests/engine/firstPersonEngine.test.ts` (extend)

Spec Section H1/H2. This lands the enabler with NO colony NPCs placed yet — pure engine change, Ashfall-regression-tested.

- [ ] **Step 4.1: Failing tests (extend `firstPersonEngine.test.ts`)** using the file's existing `makeFpGame` harness, adding a `colonyContext` stub:
  - With `fp.colonyContext` set + an NPC at (posX+1, posY) facing it, `keys.shoot` → `fp.dialogState` opens (regression guard for the early-return bug).
  - NPC-open is gated by the colony gate: with `colonyInteractArmed=false`, interact does NOT open (canFire false).
  - After NPC-open, `colonyInteractArmed === false` (disarmed) — so a held interact on the close frame can't fire door/pad (close-frame bounce guard).
  - With NO npc targeted, the door/pad path still runs (existing anti-bounce behavior intact).
  - Non-colony (`colonyContext` undefined) NPC-open still works identically (extract the helper — no Ashfall regression).

- [ ] **Step 4.2: Implement H1** in `updateFirstPerson`:
  1. Extract the current NPC-open block's **body** (`firstPersonEngine.ts:191-213`: the proximity/facing loop that finds a faced NPC and opens `fp.dialogState`, plus the `gs.audioEvents.push(...)` and `gs.player.bankDir = 0`) into `tryOpenNpcDialog(gs, fp, keys, posX, posY, dirX, dirY): boolean`. **Important:** leave the OUTER gate `if (fp.npcs && keys.shoot && fp.gunCooldown <= 0)` (line 192) at the **non-colony call site** — the helper itself does NOT re-check `gunCooldown` (in colony mode `gunCooldown` is only decremented inside the dialog block, so re-checking it in the helper would wrongly double-gate). So: non-colony site = `if (gunCooldown gate) tryOpenNpcDialog(...)`; helper = proximity/facing/open only.
  2. Inside `if (fp.colonyContext)` (line 162), compute the existing `canFire` once (already at 165-168). When `canFire`, call `tryOpenNpcDialog(...)` **before** the pad/door resolution (the colony gate replaces the gunCooldown gate here); if it returns true, set `fp.colonyInteractArmed = false` and `return`. Else fall through to the existing pad/door logic (which consumes the same `canFire`) unchanged.
  Audit: net-new logic ~8-12 lines; the moved block is a verbatim relocation.

- [ ] **Step 4.3: Implement H2:** add `sprite?: string` to `FPNPC` (types.ts:896); in `sceneInput.ts:143` change NPC sprite resolution to `n.sprite ?? NPC_SPRITE_MAP[n.name] ?? SPRITES.NPC_SURVIVOR`. Add a test: `n.sprite` wins; name-mapped NPC with no sprite still resolves.

- [ ] **Step 4.4: Run PASS (engine + colony green); verification; Commit** — `feat(engine): colony-mode NPC interaction (H1) + additive FPNPC.sprite (H2)`

---

### Task 5: FP shop purchase flow (Section I — consumables-only, quartermaster-only)

**Files:**
- Modify: `game/app/components/engine/types.ts` (`FPDialogState.selectedIndex/shopCanBuy?/shopNavCooldown?`, `FirstPersonState.shopPurchaseRequest?`)
- Modify: `game/app/components/engine/firstPersonEngine.ts` (selection/buy/close + freeze-movement)
- Modify: `game/app/components/engine/firstPersonRenderer.ts` (selection highlight + hint)
- Modify: `game/app/components/Game.tsx` (drain `shopPurchaseRequest` → `purchaseConsumable`)
- Test: `game/tests/engine/firstPersonEngine.test.ts` (extend)

- [ ] **Step 5.1: Types** — additive optional:
```typescript
// FPDialogState +=
selectedIndex?: number;
shopCanBuy?: boolean;       // true only when the quartermaster opens its shop
shopNavCooldown?: number;   // debounce for up/down/select
// FirstPersonState +=
shopPurchaseRequest?: { kind: "consumable"; itemId: ConsumableId };
```

- [ ] **Step 5.2: Failing tests (extend `firstPersonEngine.test.ts`):**
  - With `dialogState.shopOpen && shopCanBuy`, `up`/`down` moves `selectedIndex` (debounced by `shopNavCooldown`).
  - Interact on a consumable row sets `fp.shopPurchaseRequest = { kind:"consumable", itemId }`; interact on the trailing **LEAVE** row closes (`fp.dialogState = null`).
  - Without `shopCanBuy` (Ashfall), interact still just closes the shop (old behavior) and never sets `shopPurchaseRequest`.
  - Movement is frozen while `dialogState.active` (assert posX/posY unchanged when `keys.up` held during dialog).

- [ ] **Step 5.3: Implement engine shop selection** in the dialog/shop block (`firstPersonEngine.ts:133-158`): while `shopOpen && shopCanBuy`, handle `up`/`down` (debounced via `shopNavCooldown`), interact = buy selected consumable (emit request) or close on LEAVE. Add a trailing LEAVE row concept (index === shopItems.length). Do NOT reuse `Esc` (Game.tsx uses it for pause). **Freeze movement:** gate the rotation/movement block (`:99-130`) on `!fp.dialogState?.active`.

- [ ] **Step 5.4: Implement renderer** (`firstPersonRenderer.ts:322-360`): highlight `selectedIndex`, draw a LEAVE row, update the `:332` hint to "[Z] BUY / ↑↓ SELECT" (or "[Z] LEAVE" on the leave row).

- [ ] **Step 5.5: Implement Game.tsx drain** — near the existing `colonyTransitionRequest` drain (~1317): read `fp.shopPurchaseRequest`; if set, `const next = purchaseConsumable(saveData, req.itemId)`; if `next`, `setSaveData(next)` + `saveSave(next)` (credits down, consumable granted); else set a brief generic "purchase unavailable" flash; clear the request either way. Test (in a Game-level or extracted-helper test): affordable → save credits down + inventory up; unaffordable → unchanged + flash.

- [ ] **Step 5.6: Run PASS; verification; Commit** — `feat(engine): FP shop purchase flow (consumables, quartermaster-only) [Section I]`

---

### Task 6: Stepping + orchestrator integration (NPCs appear & move)

**Files:**
- Create: `game/app/components/colony/exploration/npc/npcStep.ts`, `game/app/components/colony/exploration/npc/index.ts`
- Modify: `game/app/components/colony/exploration/sceneStack.ts` (`SceneLayer.npcSidecar?`)
- Modify: `game/app/components/colony/exploration/index.ts` (enter + step wiring)
- Modify: `game/app/components/Game.tsx` (real `dtMs`)
- Test: `game/tests/colony/npcStep.test.ts`

- [ ] **Step 6.1: `SceneLayer.npcSidecar?: ColonyNpc[]`** (additive; `sceneStack.test.ts` stays green).

- [ ] **Step 6.2: Failing `npcStep.test.ts`:**
  - An NPC with a path advances toward and reaches its `targetTile` over N steps; on arrival, `path` is empty and it idle-mills within ~1 tile of target, never on a solid tile.
  - `stepColonyNpcs` **mutates the SAME `FPNPC` objects' x/y** (assert object identity: the `fpNpcs[i]` reference is unchanged and `interacted` is NOT reset across steps).
  - `dialogActive=true` → no movement.

- [ ] **Step 6.3: Implement `npcStep.ts`:**
```typescript
export function stepColonyNpcs(
  sidecar: ColonyNpc[], fpNpcs: FPNPC[], map: BoardingMap, dtMs: number, dialogActive: boolean,
): void;
```
Per NPC: if `dialogActive` return early (no movement). If `!pathComputed`, `path = findPath(map, {floor(posX),floor(posY)}, targetTile)`, `pathComputed = true`. Advance `posX/posY` toward `path[0]` at `NPC_WALK_SPEED * min(dtMs/16.67, 3)`, shifting waypoints as reached. When `path` empty, idle-mill: bounded deterministic drift within ~0.8 tile of `targetTile` (offset from `millSeed` + an accumulated step count), clamped to walkable tiles. **Then sync `fpNpcs[i].x = posX; fpNpcs[i].y = posY`** — mutate in place, never rebuild the array.

- [ ] **Step 6.4: Wire the orchestrator** (`colony/exploration/index.ts`):
  - `enterColonyExploration`: after `generateExteriorState`, call `generateColonyNpcs(colony, save.gameClock, firstPersonState.map)`; set `firstPersonState.npcs = fpNpcs`; store `sidecar` on the exterior `SceneLayer.npcSidecar`.
  - `stepColonyExploration`: BEFORE the `if (!request) return stack` early return, if `stack.current.kind === "exterior"` and `stack.current.npcSidecar`, call `stepColonyNpcs(sidecar, stack.current.state.npcs, stack.current.state.map, dtMs, !!stack.current.state.dialogState?.active)`. `generateExteriorState` is NOT modified.
  - Add `dtMs` param to `stepColonyExploration` if not already present.

- [ ] **Step 6.5: `Game.tsx` real dtMs** — change `stepColonyExploration(sceneStack, saveData, 16)` (~:1323) to pass the real `dtMs` computed for the engine tick.

- [ ] **Step 6.6: Run PASS; full verification; Commit** — `feat(colony): NPC stepping + orchestrator wiring (spawn→A*→idle-mill)`

---

### Task 7: Playtest + polish + completion log

**Files:** tuning constants across `npc/`; `docs/superpowers/plans/2026-07-04-colony-phase-5a-npcs.md` (completion log).

- [ ] **Step 7.1: Prod-build playtest** (`cd game && yarn build && npx serve out`): descend via DevPanel COLONY SEEDS at DAY/NIGHT/DAWN — colonists spawn home, walk to entry-hour spots, idle-mill; governor stats match the meta screen; **buy a consumable from the quartermaster → credits/inventory update**; Ashfall EXPLORE shop still just browses; no wall-clipping; turn/strafe correct.
- [ ] **Step 7.2: Tune** walk speed, `K` (colonist count divisor), mill radius, plaza spread, shop inventory, dialog copy.
- [ ] **Step 7.3: Append a completion log** to this plan (commits, test count, deferrals: live exploration clock, upgrades/materials in shop, interior NPCs, quests).
- [ ] **Step 7.4: Commit** — `docs(colony): Phase 5a completion log` and tag if desired.

---

## Final verification (before PR)
- [ ] `yarn colony:test` + `yarn engine:test` green (~30–38 new tests); `npx tsc --noEmit` + `yarn build` clean
- [ ] Grep audits: `generateExteriorState` return type unchanged; `firstPersonEngine.ts` H1 diff small + all inside the `if (fp.colonyContext)` guard; no new `SaveData`/`ColonyState` fields
- [ ] Manual playtest checklist (Step 7.1) 100%
- [ ] PR from `colony/phase-5a` → `main` (main already has the graphics work; this branch is 6 docs commits + the impl ahead)

## Execution notes
- Tasks 2 and 3 are interdependent (`colonyNpcs` uses the dialog builders) — a subagent may implement Task 3 first or fold them; keep the commits separate if possible.
- Each task ends green. Tasks 4–5 (engine enablers) MUST land before Task 6 (first NPC placement), or colony NPCs are un-talkable / the shop can't buy.
- Determinism is pinned for generation + A* only (not runtime positions, which depend on elapsed frames) — see spec Section F.
- If a golden/engine test in the graphics suite changes, STOP — this feature must not touch rendering (use superpowers:systematic-debugging).

---

## Completion Log (2026-07-04)

**Status: implementation complete + fully reviewed. Awaiting user prod-build playtest, then PR to `main`.**

Branch `colony/phase-5a` (off `main`, which contains the merged FP graphics work). 7 code commits:

| Commit | Task | What |
|---|---|---|
| `d1b45b4` | 1 | Deterministic grid A* pathfinder (fixed tie-break; 7 tests) |
| `df9650a` | 3 | Governor/quartermaster/colonist dialog + shop builders (real ConsumableIds) |
| `ededd78` | 4 | Engine H1 (colony-mode NPC interaction, canFire-gated + disarm-on-open) + H2 (additive `FPNPC.sprite`) |
| `5d5838e` | 2 | NPC schedule (entry-hour snapshot) + deterministic generation (walkable door/approach targets, reuses `assignSlots`) |
| `75d9b80` | 5 | FP shop purchase flow (Section I) — consumables-only, quartermaster-only via `canBuy`/`shopCanBuy`; per-conversation `shopSeen` gate (avoids Ashfall soft-lock); Game.tsx drain via `purchaseConsumable` |
| `b312092` | 6 | NPC stepping (spawn→A*→idle-mill, in-place `FPNPC.x/y`) + orchestrator wiring; Game.tsx real dtMs |
| `ae542ea` | 7 | Polish — spread named-NPC homes, comment + Ashfall shop-hint cleanup |

**Verification:** `yarn colony:test` 159/159, `yarn engine:test` 64/64 (12 render goldens unchanged), `npx tsc --noEmit` clean, `yarn build` clean. Engine stays colony-agnostic; no new `SaveData`/`ColonyState` fields; the one save-write during exploration is the shop purchase (via audited `purchaseConsumable` in Game.tsx).

**Review process:** each task got spec-compliance + code-quality review (pure-logic tasks combined), plus a whole-branch cross-cutting review — all green. The spec itself was hardened by 3 Claude rounds + **2 Codex second-opinions** (which caught: FP shop was display-only, gameClock frozen during a visit, footprint tiles are walls, upgrades bypass purchase rules, Ashfall shop has invalid data, interacted blocks reopen, FPNPC identity must be preserved).

**Playtest watch-list (user's prod-build pass — `cd game && yarn build && npx serve out`, DevPanel COLONY SEEDS):**
- Night/evening descent: NPC clumping on habitat door tiles (single-habitat Tier-1 still shares — accepted; note if it reads badly).
- Quartermaster-on-pad: face QM → talk; finish shop on the pad with interact held → must NOT pop the take-off menu (disarm path).
- Buy flow: credits down + consumable granted in save; unaffordable → "PURCHASE UNAVAILABLE" flash; shop reopens on fresh talk. (FP shop doesn't show the wallet — verify acceptable.)
- Ashfall regression in-game: dialog + display-only shop still browse/close (now re-shoppable on a 2nd talk — intended).
- Feel: NPC walk speed (0.03 tiles/frame ≈ 1.8/s); governor at plaza center vs. player spawn; no wall-clip during mill; dusk plaza gathering spreads.

**Deferred (documented, not blocking):** live exploration clock (time passing during a visit); shop upgrades/materials; interior NPCs; quests; NPC persistence; the door-geometry formula now duplicated a 4th time (extract a shared `doorTileFor(fp, slot)` helper — touches colonyLayout/index, out of Phase 5a scope); post-playtest feel-tuning (walk speed, counts, dialog copy, clump density).

# GC2-A — Manage Ashfall in the galaxy run

Date: 2026-10-18. Status: **ACCEPTED (Codex Manager, 2026-10-18) — runtime in progress on
`feat/galaxy-colony`.** Fixed: Solar Array only, Atlas and landing-pad entry, refresh on the next
descent, colony clock fixed at 07:00; no commerce, GC2-B or GC3 in this slice.
Owner: Colony systems lane (Claude Colony agent). Baseline: `feat/galaxy-colony` at `30b0726`.
Plan: `docs/superpowers/plans/2026-10-18-gc2a-galaxy-colony-management.md`.

Authority, in order:

- `docs/superpowers/specs/2026-10-18-galaxy-colony-integration-design.md` (GC1–GC5 roadmap).
- `docs/handoffs/2026-10-18-ashfall-parallel-brief.md` (lane ownership and GC2-A scope).
- `docs/handoffs/2026-10-18-consolidation-baseline.md` (increments, guardrails).
- `docs/superpowers/specs/2026-07-16-continuous-galaxy-atlas-design.md` (galaxy run, time, save boundary).

Evidence labels: **WRITTEN** = stated in code or docs; **RUNS** = I executed it on `30b0726`;
**VERIFIED** = covered by a passing test on `30b0726`.

## 1. Roadmap reconciliation

| Label | Scope | Status at `30b0726` | Baseline increment |
|---|---|---|---|
| GC1 | Descend from the star map; walk; landing-pad region; TAKE OFF to Atlas | Done (`1be567e`, click fix `d12c088`, merged with mode cleanup at `30b0726`). VERIFIED (110 browser tests, 951 unit tests) | Part of 1 |
| **GC2-A** | **This spec.** Reachable management, validated commission command, one supported building, progress through existing cycle-bearing actions, save/reload, visible building on re-entry | Proposed | 1 |
| GC2-B | Next slice: galaxy-native merchant unlock, honest shop display, repeatable resource path, resource-ownership rules, more building types, outpost access rule | Proposed in §8; needs the §9 decisions | 2 |
| GC3 | Galaxy hub (cockpit) | Unchanged; not started | 4 |
| GC4 | Campaign spine and travel battles (needs its own brainstorm with Nic) | Unchanged; not started | 5 |
| GC5 | Retire the legacy experience | Unchanged; not started | after parity |

The GC2/GC3 labels stay. GC2 is now two slices (GC2-A, GC2-B). Baseline increment 3
(Ashfall as a place) belongs to the designer lane; this lane supplies its capability
contract (§7).

Conflicts between the old roadmap text and the brief, and how this spec resolves them:

1. The integration spec said GC2 screens "run on the galaxy projection and merge back like
   GC1". The brief forbids a UI projection overwriting colony state and forbids widening the
   GC1 visit allowlist. **Resolution:** GC2 uses its own command boundary (§4.2). GC1's
   `mergeGalaxyColonyVisit` and its `VISIT_FIELDS` stay exactly as they are.
2. GC1's first reload bullet ("a save taken inside the galaxy colony remounts there") is
   superseded by its "as built" section: reload returns to the Atlas. **Resolution:** GC2-A
   keeps reload-to-Atlas. Exact-location reload is not in scope.
3. No other conflict. Already-approved next work was "GC2 management screens on the galaxy
   run"; GC2-A is its first bounded slice.

## 2. Player outcome

From a fresh galaxy run: travel to Ashfall, earn metal through an ordinary local action,
open colony management from a real entry point, commission a Solar Array, make it progress
through an existing cycle-bearing action, see it finish, reload, descend again and find the
building standing in the colony. Legacy progression does not change.

## 3. Scope

In scope:

- Management access rule and two entry points (landing-pad menu, Atlas target card).
- A galaxy management screen that reuses the existing colony panels.
- One validated command: commission a building. One supported type: `solar_array`.
- A shared build catalogue so cost and build time come from data, not from the UI.
- Unit and browser tests; a scripted fresh-save route test.

Not in scope (each needs its own approval):

- Merchant unlocks, prices, buy/sell, barter, credit or supply sources (GC2-B proposals, §8).
- Marketplace, Town Hall, cantina construction, upgrades, demolition, repair.
- Management of founded regional outposts (decision D7).
- Exact-location reload, a walk-map refresh during a walk, day/night changes.
- GC3 hub, GC4 campaign, any renderer change, any new world.
- Any change to legacy colony behaviour, the GC1 visit merge or `mergeProjectionIntoGalaxy`.

## 4. Rules

### 4.1 Access

Management access uses the GC1 descent rule (`galaxyColonyAccess`): the colony belongs to
the run, is linked to an atlas contact (only `galaxy:ashfall-primary` → `contact:ashfall`),
the contact is visited, the vessel is stationary there and no travel record is open.
Refusal copy says MANAGE instead of DESCEND: `PARK AT ASHFALL TO MANAGE`,
`ARRIVE AT ASHFALL FIRST`, `NO COLONY HERE`. Every command re-derives access from the current
canonical save; the screen's earlier check is never trusted.

A founded regional outpost (`outpost:<node>`) has no contact link, so it gets
`NO COLONY HERE`. It shares Ashfall's stellar contact, but GC2-A does not grant it access.
Its local access rule is decision D7.

### 4.2 Command boundary

New module `engine/galaxy/galaxyColonyManagement.ts`. It is separate from GC1's visit merge.

- `quoteGalaxyColonyCommission(save, colonyId, buildingType)` derives a quote from the
  current canonical save: colony, building type, deterministic building id
  (`genBuildingId`), cost and build cycles from the shared catalogue, the run's `worldCycle`,
  the colony's building count and its stockpile. It refuses with a reason and a short message.
- `commitGalaxyColonyCommission(save, quote)`:
  1. Rejects a malformed quote (exact own keys, plain data, safe integers).
  2. Re-quotes from the current canonical save. Any difference from the submitted quote is
     `stale_command`. This is the same pattern as travel's `stale_plan`. A double click, a
     cycle advance or any other write between display and click makes the old quote stale.
  3. Applies the existing `colonyReducer` `colony/buildingCommissioned` event to a disposable
     projection, with the cost and cycles from the authoritative quote.
  4. Checks the exact allowed change: only the target colony changed; only its `resources`
     and `buildings`; exactly one appended building equal to the quote; each resource reduced
     by exactly the quoted cost. Anything else is `unauthorized_change`.
  5. Merges only `{ colonies }` through `mergeProjectionIntoGalaxy`, which keeps its
     identity, monotonic and cycle-currency checks.
- Refusal reasons: `no_galaxy_run`, `run_unreadable`, `access_unavailable`,
  `unsupported_building`, `no_buildable_slot`, `insufficient_resources`, `malformed_command`,
  `stale_command`, `unauthorized_change`, `merge_failed`.

Nothing in the UI supplies cost, build time or building id to the canonical save.

### 4.3 Supported construction

`GALAXY_COMMISSION_TYPES = ["solar_array"]`: 80 metal, 1 cycle, +10 power, 3×3 footprint with
a door and an enterable stub interior. It is the cheapest Phase-1 building, it matches one
POI cargo (80 metal) and it creates no power demand, so it cannot cause a brownout.
Widening the list is decision D1 and slice GC2-B.

Cost and build cycles move from `ColonyCommissionMenu.tsx` (`PHASE_1_BUILD_OPTIONS`) into
`colony/shared/colonyCatalog.ts` (`BUILD_SPECS`). The legacy menu reads the same values, so
legacy costs do not change; a test pins them.

### 4.4 Time

- Opening management and commissioning are time-neutral. Walking and descending stay
  time-neutral. GC2-A adds no cycle anywhere.
- Construction advances only inside the existing galaxy cycle processor
  (`advanceGalaxyWorldCycles` / `advanceWorldCycle` → `processCycle` step 4.5). Existing
  cycle-bearing actions (WRITTEN): region survey (1), region POI expedition dispatch (1),
  galaxy POI outcome (1), located operations (`costs.worldCycles`), travel legs.

### 4.5 Legacy isolation

The command writes only `save.galaxyRun.colonies`. Legacy fields, `activeExperience`, outcome
metadata and other galaxy fields stay byte-identical. Tests compare legacy domain bytes
before and after (unit and browser).

### 4.6 Persistence and reload (corrected after manager review, 2026-10-18)

The persistence authority is the **stored** save, not the session copy (`saveDataRef`).
`commitGalaxyColonyCommissionToStore(store, quote)` with `store = { read: readCanonicalSaveStrict, write: saveSave }`:

1. Reads the stored save. A read that throws → `storage_unreadable`; nothing is written or adopted.
2. Commits against that fresh parent, so newer unrelated fields (legacy or galaxy) survive.
   A stored save without a galaxy run (what a missing key reads as) → `no_galaxy_run`;
   nothing is written or adopted. No default save is ever adopted.
3. On a refusal from a readable galaxy save (stale, unaffordable, no slot, access), returns
   that stored save as `reconcile`. The UI adopts it and shows the refusal. It never re-prices
   and retries a different intent.
4. Writes the result, then the caller adopts it. A write that throws → `write_failed`
   (`MANAGEMENT SAVE FAILED · NOTHING CHANGED`); nothing is adopted.

Read and write happen in one synchronous handler, as in the other canonical writers. No
cross-tab atomicity is claimed. Reload keeps the GC1 contract: the experience gate, then
CONTINUE GALAXY opens the Atlas. A new descent shows the building.

### 4.7 Visibility

The first-person exterior already draws `colony.buildings` (`colonyLayout.ts`): a constructing
building shows scaffolding on a foundation; an operational one shows walls and a door; the door
opens the stub interior. The walk builds its map on entry, so a change made during a walk
appears on the next descent. That is already true for surveys launched from the landing pad.

RUNS (throwaway probe on `30b0726`, deleted, not committed): a committed galaxy POI outcome
gives Ashfall Primary 80 metal at cycle 2; the reducer commission on a projection merges back
(`solar_array` constructing, metal 0); a galaxy region survey of the Oathbreaker wreck moves
the run to cycle 3 and the Solar Array to operational; `generateExteriorState` for that colony
contains the solar wall texture and a door tile.

### 4.8 Input ownership (added after manager review, 2026-10-18)

While management is open it owns input. Opening it from the pad closes `exitMenuOpen`, so
both walk guards in `Game.tsx` add `galaxyManagement`: `canvasInputBlocked` (input context
`blocked`) and the colony `effectiveKeys` zeroing. `clearHeldInput()` runs on open, on close
and on every navigation that clears the surface, so no held key or touch reaches the walk
until a fresh input. The persistence lock and modal focus behave as before.

## 5. Entry points and screen

- **Landing-pad exit menu:** a `COLONY MANAGEMENT` button in galaxy walks only (legacy menu
  unchanged). This is the primary entry: Nic's decision was "walk the colony in first person,
  with management screens".
- **Atlas target card:** `MANAGE COLONY` next to `DESCEND TO COLONY`, enabled with the same
  access rule; disabled with the reason otherwise.
- **Screen:** new `colony/meta/GalaxyColonyManagementScreen.tsx`, a modal dialog named
  "Colony management". It reuses `ColonyHeader` (cycle = run `worldCycle`),
  `ColonyResourcePanel`, `ColonyMetrics`, `ColonyBuildingsList` and `ColonyCommissionMenu`.
  The commission menu gets optional `options` and `onCommission` props; legacy callers pass
  neither and keep dispatching events. The galaxy screen shows only supported types, a status
  line (`role="status"`) and BACK. No tabs, no found-colony button, no legacy REGION/SYSTEM
  buttons. Focus follows `useModalFocus`; Escape closes; focus returns to the invoker.
- `Game.tsx` owns the open state, builds quotes in render from the canonical save, commits on
  click and shows the result. One implementer owns `Game.tsx` for this slice.

## 6. Acceptance

### 6.1 Human route (fresh save, no developer fixture)

1. Experience gate → `BEGIN GALAXY`. The Atlas opens at Vanguard.
2. Select Ashfall → `COMMIT TRAVEL`. Resolve the hostile-picket interruption if it occurs.
   `ACKNOWLEDGE ARRIVAL`.
3. `DESCEND TO COLONY` → walk to the landing pad → `REGION MAP` → select the Cinder Relay →
   `SURVEY · 1 CYCLE` → select it again → `TRAVEL · 1 CYCLE` → complete the relay → confirm
   the cargo for Ashfall Primary (+80 metal). The game returns to the Ashfall Region over the
   Atlas; close it. (Alternative: win the Ashfall sortie from the Atlas; one-shot; +80 metal.)
   `DESCEND TO COLONY` → walk to the landing pad.
4. `COLONY MANAGEMENT` → Solar Array shows `80 metal · 1 cycle` → `Build`. Status reads
   `SOLAR ARRAY COMMISSIONED · READY IN 1 CYCLE`. Metal shows 0. The list shows the building
   under construction. BACK.
5. `REGION MAP` → select the Oathbreaker wreck → `SURVEY · 1 CYCLE`.
6. `COLONY MANAGEMENT` → the Solar Array is operational. BACK → `Take Off` → the Atlas.
7. Reload the page → `CONTINUE GALAXY` → `DESCEND TO COLONY` → the Solar Array stands in the
   colony (walls and a door, no scaffolding); its door opens the solar interior.

Pass when steps 4–7 hold and legacy progression is unchanged.

### 6.2 Automated evidence (what the plan delivers)

- Unit: access copy, quote, every refusal, stale double commit, exact allowed change, legacy
  bytes unchanged, legacy menu costs unchanged, JSON round-trip reload.
- Unit route: `createFreshGalaxyRun` → travel → arrival → POI cargo through the shipped
  galaxy POI outcome authority → commission → galaxy survey → reload through `migrateSave` →
  exterior shows the operational Solar Array.
- Browser (`@keyboard`): boot a committed-POI fixture built through the shipped authorities
  (`pendingGalaxyPoiReturn`, not a hand-edited save) → descend → landing pad → COLONY
  MANAGEMENT → Build → REGION MAP → SURVEY (real UI cycle) → operational → Take Off → reload →
  CONTINUE GALAXY → descend → the management screen still shows the operational building;
  legacy bytes unchanged; screenshot attached.
- Unit (store boundary): newer unrelated stored fields survive; a stale quote writes nothing
  and returns the stored save to reconcile; unreadable storage and a save without a galaxy run
  are blocked; a failed write adopts nothing.
- Browser (`@pointer`): Atlas MANAGE COLONY disabled with the reason away from Ashfall;
  enabled when parked; Build with too little metal is impossible.
- Browser (`@keyboard`, `@touch`): movement and Interact held across opening and closing
  management do not move the player, fire, open another menu or carry into the walk.
- `tsc`, the three unit suites, `yarn build`, and the galaxy browser specs. The full browser
  suite runs once before handback.

The human route (§6.1) is the manager's acceptance check. Combat and POI completion are not
automated in the browser; the unit route covers the POI step through the same authority.

## 7. Capability contract for the Ashfall designer

Use this to decide what the place can show. "Supported" means reachable in an ordinary fresh
galaxy run at `30b0726`. Do not present anything in the "next" or "future" columns as working.

| Area | Supported now (`30b0726`) | After GC2-A | Proposed GC2-B (needs §9 decisions) | Future |
|---|---|---|---|---|
| Place | Ashfall Primary, an outpost (tier 1) on the Ashfall forward camp; first-person exterior from `OUTPOST_TEMPLATE`; landing pad; six building slots | Same, plus the Solar Array in one slot | More building types in slots | Districts at tier 3+, other colonies, renderer change (separate proposal) |
| Actors | Overseer (governor, lore dialog) and Quartermaster (merchant) only. Colonists appear at 1 per 4 population; a fresh colony has 0 population, so none | Same | Colonists only if housing, food and water rules make population grow | Named colonists, schedules per role, generational politics |
| Buildings reachable | None (empty outpost) | Solar Array: exterior, door, stub interior (no NPCs) | Mine (and others per D1); each with an existing stub interior | Marketplace, Town Hall, cantina in the galaxy run |
| Resource ownership | Ship/run: `supply`, `credits`, `materials`, consumable inventory. Colony stockpile: food, water, metal, colony credits (treasury) | Same; commissioning spends colony metal | Written ownership and transfer rules | Logistics between colonies and ship |
| Resource income | One-time: POI cargo 80 metal per surveyed POI next to the camp (Cinder Relay, Oathbreaker wreck; the Glassknife canyon is not next to the camp); Ashfall sortie 80 metal (one-shot); Kepler 200 credits (one-shot); picket +2 supply and a 200-credit time bonus (one-shot) | Same | Repeatable metal through an operational Mine (+10/cycle) using existing cycle rules, if blocker 3 (§8) is resolved | Trade income, contracts |
| Items | Ship consumable inventory exists | Same | — | — |
| Buy/sell/exchange | Quartermaster shop opens and lists 2 consumables (tier 1), but every galaxy purchase is refused: all consumables need legacy planet clears. Display ≠ purchasable today | Same | One galaxy-native unlock with matching display (D4). Buying only; no selling, no exchange, no negotiation | Selling, direct exchange, social negotiation (separate named slices) |
| Dialogue effects | None. Lines are read-only. The Overseer's lines read colony state (population, buildings, happiness, threats); greetings vary by faction rank | The Overseer's building line reflects the Solar Array | — | Choices with consequences, quests |
| Unlocks | None in the galaxy run | None | First merchant unlock (D4) | Story/operation unlock chains |
| Time of day | The galaxy walk opens at a fixed projection clock (day 0, 07:00); time of day is not saved | Same | — | Day/night as a decision (D8) |
| Persistence | Colony state and purchases persist; a walk is not a saved location (reload → Atlas) | Building state persists | — | Exact-location reload (separate scope) |

Designer-safe facts to write against: Ashfall Primary's name, its two NPC roles, the six slots,
the landing pad, the Cinder Relay / Oathbreaker wreck / Glassknife canyon / Basalt Basin /
Ironreach Shelf region sites, the Solar Array and its interior, and the colony numbers the
management screen shows.

## 8. Next slice (GC2-B): merchant unlock and blockers

**Smallest galaxy-native merchant unlock.** The tier-1 quartermaster stock is Hull Repair Kit
(300 cr) and Cryo Charge (350 cr). Both unlock on legacy planet clears (Verdania, Glaciem)
that do not exist in a galaxy run. The smallest rule: a galaxy predicate
`galaxyConsumableUnlocked(def, run)` opens **one** item, Hull Repair Kit, from one galaxy fact.
`buildQuartermasterShop` and `applyGalaxyColonyPurchase` both read that predicate so display
equals charge; locked rows are hidden or marked LOCKED in galaxy walks. No price, sell or
barter rule changes. Candidate facts (decision D4):

- (recommended) the first operational building at Ashfall Primary — always reachable through
  POIs, and it makes GC2-A's building a lasting consequence in the shop;
- the Ashfall sortie success fact (`ashfall_sortie_complete`) — mirrors the legacy
  planet-clear rule, but a failed sortie closes it forever.

**Blockers (each needs a product decision, not an invented rule):**

1. **Credits.** A fresh run starts with 0 credits. Only one-shot sources exist: Kepler (200),
   the picket time bonus (200). One Hull Repair Kit (300) is affordable once at most. Colony
   treasury credits are never produced (marketplace income is unimplemented). There is no
   repeatable credit source and no colony-to-wallet transfer. (D5)
2. **Supply.** Supply belongs to the ship (12 at start). Travel spends it; only the picket
   win adds 2. No colony resource converts to supply. Long play strands the vessel. (D6)
3. **Metal is finite until a Mine runs.** Ashfall Primary can reach two POIs (Cinder Relay,
   Oathbreaker wreck; 80 metal each) plus the one-shot sortie (80): 240 in total. A Mine needs
   3 power, so it needs the Solar Array first: 80 + 150 = 230. The repeatable path works only
   if the player wins the sortie. A failed sortie leaves 160 metal, and that colony can never
   run a Mine. A non-one-shot metal source, or another rule, is a product decision. (D1, D10)
4. **Shop honesty.** Today the galaxy quartermaster lists items it always refuses. GC2-B must
   fix the display with the unlock, or GC2-A can hide the rows first (D9).
5. **Outpost access.** Founding costs 300 metal, 50 food, 50 water. Food and water need a
   farm and a purifier, so outposts are not reachable early. Their access rule can wait. (D7)

**GC2-B requirement (manager review).** A sustainable earning, trade and resupply loop is
required. A failed unique operation must not remove every practical recovery route, and
cleared one-shot POI/history rewards must not reroll. The designer's metal-for-supply direct
exchange is a proposal; its rates and cap are **unapproved**. Colony and the designer
reconcile one small reliable-work/trade proposal before commerce is built.

## 9. Decisions for the manager

Manager review (`docs/handoffs/2026-10-18-gc2a-manager-review.md`, confirmed in chat): D1–D3
accepted; D7/D8 deferred; D9 not bundled — shop display and transaction share one galaxy rule
in the commerce slice. D4–D6 and D10 stay open for GC2-B.

| ID | Decision | Recommendation |
|---|---|---|
| D1 | GC2-A building set | **Accepted:** `solar_array` only. GC2-B adds `mine` for the repeatable metal path; cantina stays out until the hub and designer lanes agree |
| D2 | GC2-A entry points | **Accepted:** landing-pad `COLONY MANAGEMENT` (primary) and Atlas `MANAGE COLONY` (same access) |
| D3 | A change made during a walk | **Accepted:** shows on the next descent (no map refresh in GC2-A) |
| D4 | First galaxy merchant unlock (GC2-B) | Hull Repair Kit, opened by the first operational building at Ashfall Primary |
| D5 | Repeatable credit source (GC2-B) | Needs Nic or manager; options include colony treasury to wallet, selling to the quartermaster, contracts. Not invented here |
| D6 | Ship resupply (GC2-B or GC3) | Needs a rule; not invented here |
| D7 | Regional outpost access | Defer; GC2-A says `NO COLONY HERE` |
| D8 | Galaxy colony time of day | Keep the fixed 07:00 clock until the designer's day/night proposal |
| D9 | Hide locked galaxy shop rows in GC2-A | **Not bundled.** Display and transaction move to one galaxy rule in the commerce slice |
| D10 | Metal after a failed Ashfall sortie (GC2-B) | Needs a decision before GC2-B promises a repeatable path: for example a retryable local operation, or a repeatable POI yield. Not invented here |

## 10. Risks

- The commission path shares the projection and reducer with legacy; the exact-change check
  and the legacy-bytes tests guard it.
- `genBuildingId` uses the building count. Buildings are never removed today; if demolition
  arrives, ids need a counter.
- `Game.tsx` is a shared runtime file; GC2-A needs one implementer there and no parallel edits.
- The browser test cannot play combat or a POI; the POI step is covered in the unit route and
  the fixture is built through shipped authorities.

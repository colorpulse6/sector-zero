# Ashfall settlement loop: power, metal, housing, food, water, settlers

Date: 2026-10-18. Status: approved scope (Nic, via the Manager brief of 2026-10-18); bounded
design and plan before code. Builds on `2026-10-18-gc2a-galaxy-colony-management-design.md`
(the validated commission command and stored-save boundary) and the runtime milestone
`docs/handoffs/2026-10-18-ashfall-runtime-milestone.md`.

## 1. Scope

- The galaxy commission command supports five types: `solar_array`, `mine`, `habitat_module`,
  `farm`, `water_purifier`. No cantina, no marketplace, no commerce.
- Costs, build times, power, production, upkeep, growth and happiness stay the shared rules
  (`BUILD_SPECS`, `powerGrid.ts`, `cycleProcessor.ts`). No number changes.
- The command boundary, the stored-save commit and legacy isolation from GC2-A stay as they are.
- `Game.tsx` is not changed. It already quotes every entry of `GALAXY_COMMISSION_TYPES` and shows
  the refusal message.

## 2. Audit (shared rules, Ashfall Primary at Forward Camp)

Site: ore 50, water table 50, 6 build slots. So the mine makes 10 metal per cycle and the purifier
has no power penalty.

| Building | Cost | Cycles | Power | Per cycle |
|---|---|---|---|---|
| Solar Array | 80 metal | 1 | +10 | — |
| Mine | 150 metal | 2 | −3 | +10 metal |
| Habitat Module | 100 metal | 1 | −2 | houses 10 |
| Farm | 100 metal | 2 | −2 | +15 food, −5 water |
| Water Purifier | 120 metal | 2 | −3 | +12 water |

One solar covers the four consumers exactly (10/10). With all five built, settlers arrive one per
cycle (happiness 80 > 60) until 10/10. At 10 settlers: food +5, water +2, metal +10 per cycle.
Verified by a scratch probe on the real `processCycle`; the route test in §5 repeats it.

**Finding A — insufficient power is permanent.** `step3` sheds consumers to `offline` when demand
exceeds capacity, and nothing ever restores them. In legacy this is accepted. In the galaxy
command it would let one click strand a building for ever.

**Finding B — bootstrapping can soft-lock.** A fresh run earns at most 240 one-time metal
(Cinder Relay 80, Oathbreaker 80, Ashfall sortie 80). Solar + mine cost 230. Any other building
bought before the mine (habitat 100, farm 100, purifier 120, a second solar 80) leaves less than
the mine needs. With no repeatable metal before the mine, the colony could then never grow.
So the working order on a fresh run is **power → mine → housing/food/water → settlers**, not
"metal last".

**Finding C — settler conditions are hidden.** Growth needs happiness over 60 (from the previous
cycle) and free housing. Happiness needs food stock over 2× settlers, water stock over settlers
and a powered grid. The screen shows none of this.

## 3. Rules added at the galaxy command (pure, tested)

Both rules read the colony only. The quote, the commit's re-quote and the screen use the same
function, so the screen can never offer what the command refuses.

1. **Planned power.** Planned capacity counts operational and constructing solar arrays. Planned
   demand counts operational and constructing consumers. A consumer is refused when planned spare
   power is less than its demand: `NEEDS 3 POWER · 0 SPARE · BUILD A SOLAR ARRAY`. A constructing
   solar counts because it takes one cycle, the shortest build time, so it is never finished after
   a consumer ordered at the same time or later. Result: the command cannot cause a brownout.
2. **Mine first.** While no mine is operational or under construction, a commission other than
   the mine must leave enough metal and slots for a powered mine afterwards: 150 metal and 1 slot,
   plus 80 metal and 1 slot more if planned spare power would be under 3. The first solar that
   powers the mine is exempt from the metal part. Refusal:
   `MINE FIRST · KEEP 150 METAL AND 1 SLOT FOR IT`. A colony with enough metal builds in any order.

Check order: supported type, buildable slot, power, metal, mine first. A metal shortfall keeps the
existing `Need N more metal` button label and the `NOT ENOUGH RESOURCES` quote refusal. New
refusal reasons `insufficient_power` and `mine_first` come from a readable save, so they join the
reconcilable set.

## 4. Legibility (galaxy management screen only)

- Options in path order: Solar Array, Mine, Habitat Module, Farm, Water Purifier. A blocked
  button names its reason (power, mine first, slots) instead of only greying out.
- **Grid plan:** `POWER PLAN 10 / 7 · 3 SPARE` (operational + under construction) and
  `BUILD SLOTS 5 / 6`.
- **Settlers panel:** housing (settlers / capacity, free), happiness now and next cycle, each
  happiness factor with its value and whether it is met, and the next cycle's settler change with
  the reason when it is zero (`NO HOUSING · BUILD A HABITAT MODULE`, `HOUSING READY IN 1 CYCLE`,
  `HOUSING FULL`, `HAPPINESS 55 · SETTLERS NEED OVER 60`).
- The next-cycle values come from a preview run of the real `processCycle`, not a copy of its maths.
  `happinessFactors` is exported from `cycleProcessor.ts` and `step5` sums it (no behaviour change).
- **Time and the walk:** `TIME PASSES WITH SURVEYS, EXPEDITIONS, TRAVEL AND OPERATIONS · FINISHED
  BUILDINGS APPEAR IN THE WALK ON YOUR NEXT DESCENT`. All five types already have walk footprints.

## 5. Plan (tests first)

1. `tests/colony/galaxySettlement.test.ts` (new): planned power; power refusal and acceptance;
   mine-first cases (first solar at 80 allowed; habitat at 160 refused; at 400 allowed; after a
   planned mine allowed; second solar at 160 refused; slot reserve); outlook values from the
   preview; `happinessFactors` sum equals `processCycle` happiness.
2. `tests/colony/galaxyColonyManagement.test.ts`: five types in path order; quote/commit refusals
   for power and mine first; a forged quote for a refused type is refused; store refusals write
   nothing and reconcile; a seeded random sequence of commands and cycles never makes a building
   `offline`.
3. `tests/colony/galaxyColonyManagementRoute.test.ts`: from a fresh arrival with 240 earned metal,
   solar → mine → wait cycles → habitat → farm → purifier; settlers fill 0 → 10; food, water and
   metal rise per cycle at 10/10; power 10/10; JSON reload keeps it; legacy bytes unchanged;
   the walk draws all five.
4. `tests/colony/galaxyColonyManagementScreen.test.ts`: order, blocked reasons, grid plan, settlers
   panel and time note render; the legacy menu is unchanged.
5. Code: `engine/galaxy/galaxySettlement.ts` (rules + outlook), `galaxyColonyManagement.ts`
   (types, check, reconcilable set), `cycleProcessor.ts` (`happinessFactors`),
   `ColonyCommissionMenu.tsx` (optional `blockedReason`), `GalaxyColonyManagementScreen.tsx`.
6. Verify: tsc, colony/engine/sprites suites, `NEXT_PUBLIC_DEVTOOLS=1 yarn build`, the management,
   Overseer and held-input browser specs, and a browser pass over a seeded colony.

## 6. Out of scope and known residuals

- **Finite start.** A fresh run needs 230 of its 240 one-time metal for solar + mine. The Ashfall
  sortie's `failed` state is terminal, so a failed sortie leaves 160 and the loop cannot start on
  that run. Fixing this needs GC2-B (recoverable earning, trade or resupply).
- **Grind.** After the mine, the other three buildings cost 320; at 10 per cycle that is about
  31 cycles. Repeatable cycles come from surveys while unsurveyed nodes remain, travel legs and
  re-entering cleared region sites. This is pacing, not a block; GC2-B owns faster income.
- Legacy colonies keep the permanent brownout. The galaxy command prevents it instead of changing
  the shared rule.
- No cantina, marketplace, credits or new walk geometry.

## 7. As built (2026-10-18)

- `engine/galaxy/galaxySettlement.ts`: `plannedPower`, `settlementCommissionBlock` (slot, power,
  metal, mine first) and `settlementOutlook` (a `processCycle` preview: housing, happiness now and
  next, its terms, the next cycle's settlers and why none arrive).
- `galaxyColonyManagement.ts`: five types in path order; the quote calls the block rule; new
  refusals `insufficient_power` and `mine_first` are reconcilable. **One precedence change:** the
  commit now refuses a quote as stale when the world cycle, building count or resources differ,
  before any rule runs. Before, a changed colony could return a rule refusal instead; the player
  chose against other numbers, so "COLONY CHANGED" is the true reason.
- `cycleProcessor.ts`: `happinessFactors` is exported and `step5` sums it. Same terms, same order,
  same clamp; a test checks the sum against `processCycle` for five states.
- `ColonyCommissionMenu.tsx`: optional `blockedReason`; legacy callers do not pass it and see no
  change. `GalaxyColonyManagementScreen.tsx`: path order, blocked reasons, and the new
  `GalaxySettlementPanel.tsx` between the metrics and the buildings list.
- `Game.tsx`: not changed.
- Measured on the real route (unit test): one-time metal 240 → solar → mine (10 left) → the other
  three from mine output → 10/10 settlers **45 cycles after the mine order**. At 10/10: food +5,
  water +2, metal +10 per cycle, power 10/10, happiness over 60. The route passes its cycles by
  re-entering the cleared Cinder Relay: one cycle each, no reward, no run resource spent.
- The settlers panel always shows the food, water and power terms; other terms (med bay,
  marketplace, barracks, overcrowding, deficits, attacks) show only when they count, so the
  screen does not hint at buildings this run cannot build.

### Verification (2026-10-18, Node 20)

- `tsc --noEmit`: clean.
- `node --import tsx --test tests/colony/*.test.ts tests/engine/*.test.ts tests/sprites/*.test.ts`:
  1010/1010.
- `NEXT_PUBLIC_DEVTOOLS=1 yarn build`: static export succeeds.
- Playwright on the static export (local config, not committed): `galaxyColonyManagement.spec.ts`
  (6, including the new settlement route), `ashfallOverseer.spec.ts` (2) and the held-input and
  galaxy tests in `touchGameplay.spec.ts` (3): 11/11.
- Browser route checked: Atlas → MANAGE COLONY with 230 metal → consumers name the solar array →
  Solar Array → Habitat shows MINE FIRST → Mine → power plan 10 / 3 and NO HOUSING → (cycles and
  commands in Node) → reload → CONTINUE GALAXY → MANAGE COLONY → 3/10 settlers, +1 next cycle,
  five operational, legacy bytes unchanged.

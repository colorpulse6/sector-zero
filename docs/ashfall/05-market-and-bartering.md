# 05 — Market and bartering: three modes, kept apart

Vocabulary used throughout, so nobody ships one thing while calling it another:

| Mode | Meaning | Status on `30b0726` |
| --- | --- | --- |
| **A. Fixed-price trade** | credits for an item at a posted, faction-adjusted price; buy and (later) sell | buy RUNS and is blocked twice in the galaxy; sell does not exist |
| **B. Direct exchange** | goods for goods at a posted rate, no credits | does not exist |
| **C. Social negotiation** | the player asks for better terms; outcome keyed to standing and state | does not exist; the dialog has no choice primitive |

Only A has runtime. B is the recommended first new slice. C is a later named slice. Nothing here
is "bartering" in the loose sense until B ships; nothing is "negotiation" until C ships.

## What runs today (A, as built)

- The Quartermaster is the only `canBuy` merchant. Stock: `hull-repair`, `cryo-charge` at tier 1
  (`STOCK_COUNT_BY_TIER`), prices through `adjustedBuyPrice(def.cost, rank)`: neutral 300 / 350,
  liked −5 %, allied −10 %, hated 2×, hostile and hated refuse (shop never opens).
- Purchase path in the galaxy: engine emits `{ kind: "consumable", itemId }` → `Game.tsx` drains →
  `applyGalaxyColonyPurchase` re-opens the colony (re-derives parked access), applies
  `applyShopPurchase` on the projection, and merges back only `credits` and
  `consumableInventory`; any other difference is `unauthorized_change`.
- **Blocker 1:** `isConsumableUnlocked` requires the consumable's planet in `completedPlanets`,
  and the projection always provides `[]`. Every galaxy purchase returns null → PURCHASE UNAVAILABLE.
- **Blocker 2:** a fresh run has 0 credits. Located operations on the route pay: Ashfall sortie
  0, hostile picket 0 (a modifier can add a small bonus), Kepler black box 200. The cheapest kit is
  300. Even a perfect route cannot afford one kit. This is why B comes first.

Displayed facts and their sources in the existing panel:

| Shown | Source |
| --- | --- |
| Item name, description | `CONSUMABLE_DEFS` |
| ◆ price | `adjustedBuyPrice(def.cost, colonyMerchantRank(...))`, same helper that charges |
| Row count | colony tier |
| Refusal | `applyShopPurchase` null → generic flash; no reason distinguished |

## A1 — Fixed-price trade in the galaxy (proposal; Colony owns the rule)

**What changes hands.** Ship credits for ship consumables. Unchanged.

**Why useful.** Kits matter in travel battles and expeditions. It becomes useful only when both
blockers fall.

**Player steps.** Walk to the stall, interact, advance the opener, the shop opens, select a row,
interact to buy, LEAVE. Unchanged.

**Unlock options for the galaxy run** (recommend the first):

1. Stock is a property of the place: an operational outpost stocks `hull-repair` and
   `scanner-pulse`; tier 2 adds `cryo-charge`; `shield-charge` and `weapon-overcharge` stay gated
   on history facts. No planet-clear check in the galaxy.
2. Map history facts to unlocks (`ashfall_sortie_complete` → hull-repair, …).
3. Keep the legacy rule and seed `completedPlanets` into the projection. Not recommended: it
   fabricates legacy progression inside a canonical galaxy save.

**Credit source** is a Manager/Colony decision outside this packet; the exchange below does not
need one.

**Selling (A2)** is deferred. There is no sell request, no buyback, and combat materials are
unique-presence progression data the marketplace design already excluded from sale.

**Refusal states** (all exist as null today; copy proposed in 04): not enough credits, carry
limit, not stocked, hated/hostile, vessel no longer parked (`openGalaxyColony` fails), stale
projection (merge fails). A repeated interact after success must not double-charge: the drain is
one-shot and the merge re-derives from the canonical save, so it does not (RUNS).

## B1 — Direct exchange: the Supply Exchange (recommended first new slice)

**What changes hands.** Colony **metal** for ship **supply**, one direction, at a posted rate.
The camp cuts fuel and spares from salvage; the ship's supply is what travel burns
(`supplyCost = ceil(distance / 384)`; Vanguard↔Ashfall is 2 per leg).

**Why useful.** After one expedition the colony holds 80 metal and the ship has burned 2 supply
getting here. The player now chooses: spend the yard on an array or a roof, or buy the way home.
That choice is the loop the brief asks for, and it needs no credits.

**Placeholder rate (D5; Colony sets the number):** 20 metal → 1 supply. Rationale: one relay run
(80 metal) equals one round trip to Vanguard (4 supply). Cap ship supply at 12
(`G0_STARTING_SUPPLY`) unless Colony defines a hold size. One direction only in the first
slice: supply → metal would let a fresh ship strip itself to seed buildings, which the baseline
warns against.

**Where.** The SUPPLY STATION prop already stands behind the stall with that label. The exchange is
the Quartermaster's second panel; no new room.

**Player steps.**

1. Interact with the Quartermaster; the opener plays.
2. The panel opens with two sections: STOCK (A rows) and EXCHANGE (B rows). On a fresh run the
   stock section may be empty and says NOT STOCKED YET.
3. Select the exchange row; the row shows GIVE 20 METAL → +1 SUPPLY, with the yard and hold totals.
4. Interact to confirm. The flash reads SUPPLY +1 · METAL −20. Totals on the row update.
5. LEAVE or repeat. Each confirm is one transaction.

Panel sketch (reusing the existing 300 px shop box; rows are 46 px):

```text
┌ QUARTERMASTER — STATION ─────────────────────────────────┐
│ STOCK                                                    │
│  Hull Repair Kit    Restore 1 HP during a mission  ◆ 300 │
│ EXCHANGE                                                 │
│ ▸ Provision supply  GIVE 20 METAL · YARD 80 · HOLD 9/12  │
│                                              20 METAL →  │
│  LEAVE                                                   │
│                 SUPPLY +1 · METAL −20                     │
└──────────────────────────────────────────────────────────┘
```

**Displayed facts and sources.**

| Shown | Source | Note |
| --- | --- | --- |
| YARD n | `colony.resources.metal` from the canonical run's colony | not the legacy projection's player wallet |
| HOLD n/12 | `run.resources.supply`, cap constant | supply is not a `SaveData` field; read from the canonical save in `Game.tsx`, not the projection |
| rate 20 → 1 | one Colony-owned constant, same constant used to apply | display and charge share one source, as `adjustedBuyPrice` does for A |
| standing effect | none in the first slice | a rank modifier can come with C |

**Refusal and edge states.**

| State | Rule | Copy |
| --- | --- | --- |
| yard short | metal < 20 | YARD SHORT · 20 METAL NEEDED |
| hold full | supply ≥ cap | HOLD FULL · 12/12 |
| not parked | `galaxyColonyAccess` not full at confirm | VESSEL NOT PARKED |
| stale | canonical revision changed since the panel opened | STATION RESET · REOPEN |
| hated/hostile | same refusal as A; the panel never opens | existing cold line |
| repeat press | one request per interact; drain is one-shot | no double charge |

**Contract Colony must own** (designer does not edit these): a typed request
`{ kind: "exchange", offerId: "ashfall-provision-supply" }` beside the existing purchase kinds; a
pure `applyGalaxyColonyExchange(save, colonyId, offerId)` that re-opens the colony, validates the
rule and returns the next canonical save or a reason; the merge as an explicit validated delta
(`resources.supply`, the Ashfall colony's `resources.metal`) through `mergeProjectionIntoGalaxy`,
**not** by widening `VISIT_FIELDS`; a unit test that the same request applied twice from the same
canonical save yields the same result as once (no duplication); the rate and cap constants.

**Designer owns:** panel copy, row layout, refusal copy, the small renderer change below.

**Renderer change needed** (one line, additive): rows print `◆ ${cost}`; add an optional
`costLabel` on `FPShopItemBase` and print it when present, so an exchange row reads `20 METAL`
instead of a credit glyph. Everything else reuses the existing selection, LEAVE row and flash.

## C — Social negotiation (later named slice)

**What it is.** Before confirming an A or B transaction the player may ask for camp terms. The
outcome is a function of standing and state, never a roll.

**Why later.** The dialog state is linear lines plus a shop; there is no choice row. C needs a
small primitive: a two-option row in the dialog box ("Ask for camp terms" / "Pay posted rate")
that emits a typed request. That is a renderer and engine change with its own plan.

**Sketch of the rule** (for the later spec, not for now):

| Rank | Ask result | Copy |
| --- | --- | --- |
| neutral | refused once per visit | "Posted rate is the rate. Come back when the camp knows you." |
| liked | one exchange per visit at 15 → 1 | "For you, fifteen. Once." |
| allied | 15 → 1 on every exchange this visit | "Camp rate. Don't tell the traders." |
| hated/hostile | panel never opens | existing cold line |

Per-visit flags live in the dialog session, not the save; standing comes from
`factionStandings`; nothing random.

## Order of work

1. B1 Supply Exchange (Colony rule + merge; designer copy + panel).
2. A1 galaxy-native unlock (Colony), then the specific refusal copy.
3. Marketplace building as the second authored hub (salvage branch diff).
4. C negotiation with the choice primitive.

A trade counts as done only when stock, cost, result and persistence are real and a repeated
or stale action cannot duplicate (brief, merge gates). B1 meets that with the contract above.

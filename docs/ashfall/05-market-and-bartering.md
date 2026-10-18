# 05 — Market and bartering: three modes, kept apart

Vocabulary used throughout, so nobody ships one thing while calling it another:

| Mode | Meaning | Status on `30b0726` |
| --- | --- | --- |
| **A. Fixed-price trade** | credits for an item at a posted, faction-adjusted price; buy and (later) sell | buy is in source (SOURCE-REVIEWED) and blocked in the galaxy by the legacy unlock; credits are one-off; sell does not exist |
| **B. Direct exchange** | goods for goods at a posted rate, no credits | does not exist |
| **C. Social negotiation** | the player asks for better terms; outcome keyed to standing and state | does not exist; the dialog has no choice primitive |

Only A has runtime. B is a PROPOSED partial path with prerequisites it does not yet meet (see
B1). C is a later named slice. Nothing here is "bartering" in the loose sense until B ships;
nothing is "negotiation" until C ships. Labels follow the README scheme: SOURCE-REVIEWED,
PRIOR EVIDENCE, PROPOSED.

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
- **Blocker 2 (corrected):** a fresh run starts at 0 credits and has no repeatable income.
  Located operations on the route pay one-off credits: hostile picket 0 base and 200 with the
  Quick Draw modifier, Kepler black box 200, Ashfall sortie 0 (SOURCE-REVIEWED, `galaxyRun.ts`).
  A successful route can therefore reach 400 and afford one 300-credit kit once. The blocker is
  Blocker 1 plus the absence of repeatable income, not the price. An earlier draft said a perfect
  route could not afford a kit; that was wrong.

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

**Repeatable credit income** is a Manager/Colony decision outside this packet. The exchange
below avoids credits but has its own prerequisite (finite metal), so it is not a substitute.

**Selling (A2)** is deferred. There is no sell request, no buyback, and combat materials are
unique-presence progression data the marketplace design already excluded from sale.

**Refusal states** (all exist as null today; copy proposed in 04): not enough credits, carry
limit, not stocked, hated/hostile, vessel no longer parked (`openGalaxyColony` fails), stale
projection (merge fails).

**Retry rule (Colony owns the implementation).** A purchase is a unique intent. Retrying the
same intent (a repeated interact while the first request is in flight, or a resend after a stale
response) charges once. Two new valid intents (two deliberate buys) may charge twice. Determinism
is not retry deduplication: `applyGalaxyColonyPurchase` is pure and returns the same output for
the same canonical save and request (SOURCE-REVIEWED), which says nothing about whether a second
request is suppressed. The implementation must re-read the persisted canonical state, validate
the displayed quote against it, and preserve newer unrelated data in the merge. Whether a second
interact emits a new request is the engine's rule; I did not execute it.

## B1 — Direct exchange: the Supply Exchange (recommended first new slice)

**What changes hands.** Colony **metal** for ship **supply**, one direction, at a posted rate.
The camp cuts fuel and spares from salvage; the ship's supply is what travel burns
(`supplyCost = ceil(distance / 384)`; Vanguard↔Ashfall is 2 per leg).

**Status: PROPOSED partial path, not sustainable as written.** Colony metal is finite:
expeditions pay once per node, the sortie's repeatability is Colony's call, and the same metal
funds construction (the GC2-A Solar Array costs 80). Before B1 can be scheduled it needs, from
Colony and GC2-B: (1) a repeatable, causally justified earning or recovery path for metal;
(2) an explicit rule for which treasury pays and which inventory receives (colony treasury vs
ship resources); (3) approved rate and cap numbers. Unique cleared-POI rewards must not become
rerollable to feed the exchange.

**Why useful (once the prerequisites hold).** After one expedition the colony holds 80 metal and
the ship has burned 2 supply getting here. The player then chooses: spend the yard on the array
or buy the way home. That choice is the loop the brief asks for, and it needs no credits. Today
the choice is real only once; the yard empties and nothing refills it.

**UNAPPROVED placeholders (D5):** rate 20 metal → 1 supply; cap 12. Neither number is approved;
they exist so the panel copy can be reviewed and must not be implemented as constants until
Colony sets them. Rationale for the placeholder: one relay run (80 metal) equals one round trip
to Vanguard (4 supply). The cap mirrors `G0_STARTING_SUPPLY` only because no hold size exists.
One direction only in the first slice: supply → metal would let a fresh ship strip itself to seed
buildings, which the baseline warns against.

**Where.** The SUPPLY STATION prop already stands behind the stall with that label. The exchange is
the Quartermaster's second panel; no new room.

**Player steps.**

1. Interact with the Quartermaster; the opener plays.
2. The panel opens with two sections: STOCK (A rows) and EXCHANGE (B rows). On a fresh run the
   stock section may be empty and says NOT STOCKED YET.
3. Select the exchange row; the row shows GIVE 20 METAL → +1 SUPPLY (placeholder numbers), with
   the yard and hold totals.
4. Interact to confirm. The flash reads SUPPLY +1 · METAL −20. Totals on the row update.
5. LEAVE or repeat. Each confirm is one new intent and one transaction.

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
| HOLD n/cap | `run.resources.supply`, cap constant (unapproved) | supply is not a `SaveData` field; read from the canonical save in `Game.tsx`, not the projection |
| rate 20 → 1 (unapproved) | one Colony-owned constant, same constant used to apply | display and charge share one source, as `adjustedBuyPrice` does for A |
| standing effect | none in the first slice | a rank modifier can come with C |

**Refusal and edge states.**

| State | Rule | Copy |
| --- | --- | --- |
| yard short | metal < 20 | YARD SHORT · 20 METAL NEEDED |
| hold full | supply ≥ cap | HOLD FULL · n/cap |
| not parked | `galaxyColonyAccess` not full at confirm | VESSEL NOT PARKED |
| stale | canonical revision changed since the panel opened | STATION RESET · REOPEN |
| hated/hostile | same refusal as A; the panel never opens | existing cold line |
| retry | same intent charges once; a new confirmed intent is a new transaction | — |

**Contract Colony must own** (designer does not edit these): a typed request
`{ kind: "exchange", offerId: "ashfall-provision-supply" }` beside the existing purchase kinds; a
pure `applyGalaxyColonyExchange(save, colonyId, offerId)` that re-opens the colony, validates the
rule and returns the next canonical save or a reason; the merge as an explicit validated delta
(`resources.supply`, the Ashfall colony's `resources.metal`) through `mergeProjectionIntoGalaxy`,
**not** by widening `VISIT_FIELDS`; an intent id on each request, with tests that the same intent
applied twice charges once and that two distinct valid intents charge twice; the apply step
re-reads the persisted canonical save, validates the quoted rate and totals against it, and
preserves newer unrelated data; the rate and cap constants (unapproved placeholders until Colony
sets them); and the GC2-B metal recovery and treasury rule this slice depends on.

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

1. A1 galaxy-native unlock (Colony), then the specific refusal copy. Repeatable credit income
   is a separate Manager/Colony decision.
2. GC2-B: metal recovery path and the colony-treasury vs ship-resource rule (Colony). Then B1
   Supply Exchange (Colony rule + merge with intent ids; designer copy + panel).
3. Marketplace building as the second authored hub (salvage branch diff).
4. C negotiation with the choice primitive.

A trade counts as done only when stock, cost, result and persistence are real and a repeated
or stale action cannot duplicate (brief, merge gates). B1 can meet that only with the intent rule
above and after its prerequisites; it does not meet it today.

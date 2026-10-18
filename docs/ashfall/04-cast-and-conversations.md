# 04 — Cast and conversations

## Cast

Two roles exist in every fresh-run walk; colonists appear with population. Names, pronouns and
backstory are authored proposals, not recovered canon; the runtime shows role labels today
(`Overseer Ashfall Primary`, `Quartermaster`, `Colonist`). Labels: SOURCE-REVIEWED means read in
source on `30b0726`, not executed; PROPOSED means no runtime. Every proposed line is a separate
small runtime slice (builder changes at the end), not part of GC2-A.

| Role | Runtime today (SOURCE-REVIEWED) | Proposed identity (authored, not canon) | Assets | Conversational purpose | State it reads |
| --- | --- | --- | --- | --- | --- |
| Overseer | name `Overseer Ashfall Primary`, Voss billboard, type `lore`, post at plaza centre, dialog from `buildGovernorDialog` | **Overseer Idowu** (she/her), the survey camp's lead; portrait hub-governor | B1, B2 | arrival welcome; colony status; what the camp needs; acknowledges operation results; records the consequence on return | population, growth, tier, buildings and their status, happiness, threats, faction rank; proposed: resources, sortie fact, capacity |
| Quartermaster | name `Quartermaster`, pilot atlas, type `merchant`, stall by the pad, dialog from `buildQuartermasterDialog`, shop from `buildQuartermasterShop` | **Quartermaster Dace** (he/him); portrait from the pilot hero | Kit A + C3 | fixed-price trade; proposed exchange; the practical voice: costs, cycles, what metal buys | faction rank, colony tier (stock count); proposed: colony metal, ship supply |
| Colonists | one per 4 population, cap 10, survivor/scavenger billboards, barks by happiness tier | unchanged | Kit A | ambient mood; nothing transactional | happiness tier, deterministic seed |
| Relay Tech (later) | none | **Vale**, keeps the mast; the temporal-archaeology thread | Kit D | points at Cinder Relay and the wreck; "the relay answers itself" | region node intel; later facts |

## Writing rules (from the renderer)

- The dialog box is 448×140 px; with a portrait the text column is 324 px wide and 88 px tall at
  12 px monospace, about 45 characters per wrapped line and five lines. **Keep each entry under
  150 characters with a portrait, 200 without.**
- Entries are `{ speaker, text, portraitKey? }`; dialog is linear, one entry per advance, with a
  merchant's shop opening after the last entry. There are no choices today.
- Every line that states a number or a condition must be derivable from state the builder
  receives; flavour that is not derivable must be true in every state it can appear in.
- No randomness: variation keys off seeds and state (`mod(seed, n)`), never `Math.random`.
- Speaker labels are the builder constants. Proposed: rename `Governor` to `Overseer` so the
  label matches the NPC name above her head.
- Rank tone collapses to cold / neutral / warm (`greetingTone`). Every proposed opener needs the
  three.

## Conversation 1 — Arrival (first descent, fresh run)

State: `population.total 0, growthRate 0, tier 1, buildings [], happiness 50, activeThreats [],
rank neutral, op:ashfall-sortie available, resources.metal 0`.

**In source today (SOURCE-REVIEWED)** (`buildGovernorDialog`, neutral):

> Governor: Welcome to the colony, pilot. Here's where we stand.
> Governor: Population's holding steady. We're at 0 now.
> Governor: Tier one — we haven't broken ground on a single building yet.
> Governor: And the people? morale's steady, nothing to worry about.

**PROPOSED** (same facts, Ashfall voice, portrait `PORTRAIT_HUB_GOVERNOR`):

| Speaker | Line | Fact source |
| --- | --- | --- |
| Overseer | You answered the mast. Good. I'm Idowu. I run what's left of the Ashfall survey camp. | neutral greeting slot |
| Overseer | Two of us keep the pad. Nobody's on the books until there's a roof to put them under. | `population.total === 0`; two named NPCs in scene |
| Overseer | No buildings yet. Metal is the wall we keep hitting. The dunes eat hardware faster than we can dig it out. | `buildings.length === 0`; `resources.metal === 0` |
| Overseer | Morale's steady. People stop asking when the next ship comes once one actually lands. | `happiness` 50..74 band |
| Overseer | The mast stays lit until this zone is secured. You'll see it from the pad. | sortie not complete |

Cold variant of line 1 (hated/hostile): "You've got nerve landing here. Say it and lift off."
Warm variant (liked/allied): "Idowu. The camp owes you more than it can pay. Here's where we are."

## Conversation 2 — Colony need (at the stall, same visit)

**In source today (SOURCE-REVIEWED)**: "Supplies for the road, if you've got the credits." Then
the shop lists Hull Repair Kit ◆300 and Cryo Charge ◆350; any galaxy purchase flashes PURCHASE
UNAVAILABLE (legacy planet-clear unlock). The fresh run is at 0 credits at this point; its only
income is one-off (Quick Draw 200, Kepler 200), enough for one kit once the unlock is fixed.

**PROPOSED** (portrait `PORTRAIT_QUARTERMASTER`):

| Speaker | Line | Fact source |
| --- | --- | --- |
| Quartermaster | Dace. I keep the station. Credits buy kits. Metal buys everything else out here. | neutral opener |
| Quartermaster | Yard's at zero metal. An array is eighty, a roof is a hundred. | `colony.resources.metal`; `PHASE_1_BUILD_OPTIONS` solar 80, habitat 100 (GC2-A commissions the array only; the roof is a later slice) |
| Quartermaster | The relay ruins north of the camp are a cycle out and full of scrap. Survey first. You don't walk into a rumour. | node `ashfall-cinder-relay` intel `rumored`, adjacent; survey cost 1 cycle; travel requires surveyed |

Cold: "Shop's closed. To you, anyway. The camp doesn't forget. Move along." (SOURCE-REVIEWED, unchanged.)

## Conversation 3 — Operation result (after a Cinder Relay expedition delivered +80 metal)

State: node `ashfall-cinder-relay` intel `cleared`; `resources.metal 80`; world cycle +2.

| Speaker | Line | Fact source |
| --- | --- | --- |
| Overseer | Eighty metal in the yard off the relay run. First thing we've had worth guarding. | `resources.metal === 80` after a `mission_delivery`; "first" holds because the fresh colony starts at 0 and nothing else delivers before an expedition |
| Overseer | The relay ruins are cleared. Whatever was transmitting down there wasn't ours, and it wasn't old enough to be anyone else's. | node intel `cleared`; second sentence is state-neutral flavour aligned with §5.1.2 |
| Quartermaster | Eighty in the yard. That's one array, or most of a roof. Your call, not mine. | metal 80; costs 80 / 100 |

Sortie variant (after `ashfall_sortie_complete`, also +80 metal):

| Speaker | Line | Fact source |
| --- | --- | --- |
| Overseer | The mast's dark. Zone's secured. First night I've slept through since we grounded. | history fact present; mast prop in dark state |

The line must be generated from the fact, not from the visit count, so it is identical on reload.

## Conversation 4 — Trade

**A, fixed-price (SOURCE-REVIEWED: rows display; purchase blocked):** opener as above, then the shop panel. With
A1 in place and credits ≥ 300 the flash is silent on success (consumables flash nothing by design)
and the row count changes. Proposed specific refusal copy instead of the generic flash:

| Condition | Today | Proposed flash |
| --- | --- | --- |
| credits < price | PURCHASE UNAVAILABLE | NOT ENOUGH CREDITS · ◆0 |
| at max carry | PURCHASE UNAVAILABLE | CARRY LIMIT · 2/2 |
| locked | PURCHASE UNAVAILABLE | NOT STOCKED HERE |
| hated/hostile | shop never opens | unchanged |

**B, direct exchange (PROPOSED, see 05):**

| Speaker | Line | Fact source |
| --- | --- | --- |
| Quartermaster | Station's open. Twenty metal buys you one unit of supply. We cut it from salvage. | exchange rate constant (Colony-owned; 20 is an UNAPPROVED placeholder, the line changes with the number) |
| Quartermaster | Yard's at eighty. Ship's holding nine of twelve. | `colony.resources.metal`; `run.resources.supply`; cap (UNAPPROVED placeholder 12) |

Refusal lines for B are in 05 (yard short, hold full, not parked, stale). B is gated on GC2-B
metal recovery and the treasury rule; these lines are not scheduled until then.

## Conversation 5 — Return (leave, travel, come back; after GC2-A completes the Solar Array)

State: one `solar_array` operational; `population.total 0`; metal 80 (80 from the relay run,
−80 for the array, +80 from the second expedition or the sortie).

**In source today (SOURCE-REVIEWED)**: "Tier one — all 1 of our buildings are operational." (parked wording.)

**PROPOSED**:

| Speaker | Line | Fact source |
| --- | --- | --- |
| Overseer | You came back. The array's up. First thing on Ashfall that makes more than it burns. | building type `solar_array`, status `operational` |
| Overseer | Ten on the grid and nothing drawing on it yet. Next thing we raise plugs into that. | `derivePowerGrid`: capacity 10 (`solar_array`), demand 0 with no other operational building |
| Quartermaster | Yard's at eighty. Station's still open. | `resources.metal` |

If the building is still constructing on return: "Scaffold's up in the east slot. One more
cycle." (status `constructing`, `buildProgressCycles`, slot from `assignSlots`).

## Builder changes these conversations need (bounded; Colony/Manager to schedule)

1. `buildGovernorDialog(colony, rank, place?)`: optional third argument carrying `sortieComplete`
   and the delivery-aware resource line; rename speaker to `Overseer`; add `portraitKey`.
2. `buildQuartermasterDialog(rank, context?)`: optional `{ metal, supply, supplyCap }` for the
   yard/ship lines; add `portraitKey`.
3. Specific refusal flashes in `shopPurchaseFeedback` keyed on the failure reason (needs
   `applyShopPurchase` to return a reason instead of `null`; today it cannot distinguish).
4. No change to colonist barks.

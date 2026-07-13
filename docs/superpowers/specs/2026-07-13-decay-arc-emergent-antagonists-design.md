# The Decay Arc & Emergent Antagonists — Design Spec (M4)

**Date:** 2026-07-13 · **Status:** APPROVED DIRECTION (user decisions 2026-07-13); ready for
plan-writing. Authored decision-complete for subagent execution.
**Absorbs:** colony spec Phase 5b (crime/witness/bounty/guards), Phase 8 (threats/defense),
the interception half of 7b. **Depends on:** OW-0 (live), M1 region map (for syndicate bases
as POI nodes — a degraded fallback exists without it, §6).

## 1. Pillars

1. **Decay is slow and telegraphed.** No instant loss. Every stage is visible (Planner
   warnings, in-town signals) many cycles before the next, and every stage has counterplay.
2. **Antagonists emerge from the sim — both ways (user decision).** Syndicates are born
   (a) from YOUR neglected colonies (consequence) and (b) spontaneously on the frontier
   (event) — same entity either way, different origin story.
3. **The world acts without you.** Syndicates take actions on cycle ticks whether or not
   you look at them. Neglect compounds; attention pays.
4. **Reuse the engines.** Crime uses FP witnesses/pathfinding; infestation uses FP combat
   in colony; interception uses the turret/escort mode; raids use defense missions.

## 2. Colony condition ladder

Derived each cycle (new `step7_condition` in cycleProcessor) from existing sim signals —
no new resource types. `condition` stored on ColonyState.

| Stage | Trigger (sustained N cycles) | Visible signals | New effects |
|---|---|---|---|
| STABLE | default | — | — |
| RESTLESS | happiness < 55 ×3 | graffiti barks, governor warns | ambient petty-crime events (§3) |
| LAWLESS | happiness < 40 ×3 OR unresolved bounties ≥ 3 | guards overwhelmed bark, market fees | crime rate ×3, production −20%, syndicate-genesis roll begins |
| FAILING | food OR water deficit ×3 | starvation deaths (existing formula), fleeing colonists | population shrinks, mutation seed roll |
| INFESTED | mutation seed fired | sealed-building tiles, monster barks | FP monster spawns in-town (§4), production −50% |
| COLLAPSED | spec's happiness<25 entry, 8-cycle countdown (existing rules) | evacuation | at countdown end: colony removed → **decay-born syndicate genesis roll 60%** |

Recovery: any stage reverts after its trigger stays cleared ×3 cycles (hysteresis both ways;
constants in one tuning table, §8). First-colony protection (roadmap decision 4): the
player's first colony pauses at LAWLESS/FAILING with an explicit rescue quest instead of
advancing, until the player has founded a second colony.

## 3. Crime layer (5b core, staged)

- **Player crime** exactly per colony spec §723-746: attack detection → witness (8-tile LOS)
  → flee to Town Hall (existing A*) → bounty (existing Bounty type + `step9_bountyDecay`
  stub) → guards check on entry → standing penalties via `adjustStanding` (exported, waiting).
  Silencing witnesses voids testimony (spec rule).
- **Ambient crime** (new): at RESTLESS+ each cycle rolls NPC-on-NPC incidents (theft →
  stockpile −d10 metal/food; assault → colonist injured; at LAWLESS murder possible →
  population −1, happiness −5). Surfaces as Planner log lines + in-town barks; feeds the
  bounty board (M3 bulletin) as procgen "investigate/patrol" quests.
- **Guards:** new `barracks` building (cost 200 metal, upkeep 2 food/cycle, +N guard NPCs).
  Guards cut ambient-crime rolls (−50%/barracks, floor 10%), respond to player crime per
  spec, and are the INFESTED-stage defense force multiplier.

## 4. Mutation & infestation

FAILING colonies roll a mutation seed (5%/cycle, +5% per additional deficit resource).
INFESTED: 1-3 buildings become `sealed` (offline, capacity/production 0); FP spawns 2-5
monsters (reuse FP enemy machinery + biome-flavored reskins from the M2 pipeline) around
sealed buildings. Cleared by killing all monsters in FP (defense-mission framing, XP +
material reward) → buildings unseal over 2 cycles. Uncleared: spreads +1 building per
3 cycles until COLLAPSED-equivalent.

## 5. Syndicates — the entity

```ts
interface SyndicateState {
  id: SyndicateId;
  name: string;                       // procgen from seed ("Ashfall Vultures")
  origin: { kind: "decay"; colonyId: ColonyId } | { kind: "frontier"; planetId: string };
  planetId: string;
  baseNodeId: RegionNodeId | null;    // M1 POI node claimed as base; null pre-M1 (§6)
  strength: number;                   // 1..100; grows +2/cycle idle, +loot/10 on success
  hostility: "dormant" | "raiding" | "vendetta";  // vendetta after player attacks them
  stolen: ColonyResources;            // recoverable loot held at base
  lastActionCycle: number;
}
// SaveData.syndicates: SyndicateState[] (cap 3 active; new genesis suppressed at cap)
```

**Genesis** (both paths, per user decision):
- *Decay-born:* COLLAPSED colony → 60% roll; LAWLESS colony each cycle → 3% roll (the colony
  keeps existing but hosts the syndicate's recruiting — its crime events double).
- *Frontier-born:* each cycle per planet with ≥1 player colony: 1% base, +1% per 500 total
  player stockpile wealth on that planet (wealth attracts predators), ×0 while a syndicate
  already lives on that planet.

**Actions** (one roll per syndicate per cycle, weighted by strength):
| Action | Requires | Effect |
|---|---|---|
| Grow / recruit | — | +strength; barks/rumors in town |
| Claim POI | M1, strength ≥ 20 | base node flips hostile; its yields stop |
| Raid colony | strength ≥ 30 | steal 10-30% of one resource → `stolen`; happiness −10; guards reduce take 50% |
| Intercept mission | strength ≥ 40 | next planet-mission completion on that planet triggers an **escort/turret engagement**; lose → delivery payload goes to syndicate |
| Fleet attack (vendetta) | strength ≥ 60 | ambush phase injected before a campaign mission on that world (turret mode); lose → global credits −10% |

**Counterplay / ending a syndicate:** raid the base (M1 POI: FP/boarding assault; pre-M1
fallback §6). Victory: syndicate destroyed, `stolen` loot recovered, big XP, standing +.
Alternatives: pay-off (credits = strength×10, dormant 10 cycles, standing −), or attrition
(guards + high happiness on the planet: −2 strength/cycle; dissolves < 5).

## 6. Pre-M1 fallback (if built before region map)

Without POI nodes, `baseNodeId = null`: the base is a special boarding-mode mission on the
planet's mission select ("SYNDICATE HIDEOUT"), and Claim-POI is skipped. Everything else
works. (Preferred order remains M1 first.)

## 7. Surfacing (UX)

Planner (React, spec §I) gains a CONDITION row + THREATS list (syndicate name, strength,
last action). Cockpit gets a red alert badge when any colony ≥ LAWLESS or syndicate acts.
In-town: barks, graffiti props (M2 pipeline assets), sealed-building visuals. Completion
screen line for interceptions ("DELIVERY LOST — ASHFALL VULTURES"). Every state change also
lands in a per-colony event log (Planner) — the sandbox's story record.

## 8. Tuning table (single source: `colony/shared/decayTuning.ts`)

All §2-§5 constants (thresholds, cycle counts, roll %s, caps, floors) live in ONE exported
const object with the values above as defaults — balance passes touch one file.

## 9. Phasing (each ships green + playable)

- **D1 Crime:** condition ladder (STABLE→LAWLESS), player crime/witness/bounty/guards,
  barracks, ambient crime, first-colony protection. Tests: ladder hysteresis, witness LOS,
  bounty lifecycle, guard mitigation. (Dev seeds: LAWLESS fixture.)
- **D2 Failure:** FAILING + starvation wiring + COLLAPSED (spec rules) + recovery paths +
  Planner condition/log UI. (Fixture: FAILING.)
- **D3 Infestation:** mutation seeds, sealed buildings, FP monster clears. (Fixture: INFESTED.)
- **D4 Syndicates:** entity, both genesis paths, action loop, interception via escort/turret,
  base assault (or §6 fallback), pay-off/attrition. (Fixture: colony + active syndicate.)

Verification per phase: tsc + colony/engine/sprites suites + build + prod-build browser
smoke of the new fixture; scripted 30-cycle decay/recovery simulations as tests (the
cycleProcessor is pure enough — proven by the OW-0 test style).

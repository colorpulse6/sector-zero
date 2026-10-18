# 06 — Fresh-save acceptance route

Ordinary player path, no developer fixture, from NEW GALAXY to a lasting consequence and back.
Each step carries its own label from the README scheme. SOURCE-REVIEWED: read in source on
`30b0726`, not executed. PRIOR EVIDENCE: covered by the cited baseline tests, GC1 specs or
captures. PROPOSED: no runtime. I ran nothing this turn (no `node_modules` in this worktree).

## Route

| # | Player action | Surface | State after | Label | Capture |
| --- | --- | --- | --- | --- | --- |
| 0 | Start a new galaxy run | experience gate → Galaxy Atlas | vessel at Vanguard, supply 12, credits 0; Ashfall charted with distress | SOURCE-REVIEWED (`galaxyRun.ts`) | — |
| 1 | Select Ashfall; commit the known route; advance checkpoints; acknowledge arrival | Atlas | parked at Ashfall; supply 12 minus the route cost (2 on the direct leg); Ashfall visited | PRIOR EVIDENCE (route fixtures build exactly this through the shipped resolver) | C9: target card with DESCEND TO COLONY enabled |
| 2 | DESCEND TO COLONY | Atlas target card or SYSTEM view | first-person walk on the projection | PRIOR EVIDENCE (`galaxyColony.spec`, GC1 browser log) | C1: arrival frame from the spawn tile |
| 3 | Walk to the plaza centre; talk to the Overseer | walk, dialog | status lines from `buildGovernorDialog` | SOURCE-REVIEWED (copy and identity PROPOSED, separate small slice) | C2: Overseer dialog |
| 4 | Talk to the Quartermaster; open the shop; try to buy | walk, shop panel | PURCHASE UNAVAILABLE (legacy unlock; the fresh run is at 0 credits here) | SOURCE-REVIEWED, known gap | C3: refusal frame |
| 5 | Return to the pad; interact; REGION MAP; select Cinder Relay Ruins; SURVEY · 1 CYCLE | pad menu, region screen | node surveyed; world cycle +1 | PRIOR EVIDENCE per the GC1 statement ("region expeditions launched from the pad keep working") | — |
| 6 | REGION MAP; Cinder Relay Ruins; TRAVEL · 1 CYCLE; play the first-person ruin; recover CINDER RELAY CORE; confirm DELIVER TO Ashfall Primary | first-person mission, POI outcome screen | node cleared; +80 metal to the colony; history fact; cycle +1 | PRIOR EVIDENCE (`galaxyPoiOutcomeAuthority` tests in the baseline) | C4: outcome screen showing +80 METAL |
| 7 | Back in the walk, talk again | dialog | proposed yard lines | PROPOSED (04) | C5 |
| 8 | Open management from the pad; commission the Solar Array (the only GC2-A building; 80 metal, 1 cycle) | GC2-A entry (Colony lane) | array `constructing`; metal 80 → 0 | GC2-A | C6a: scaffolding in slot 3 (E-mid) |
| 9 | Earn the cycle: second expedition (Oathbreaker Wreck, +80) or the Ashfall sortie (+80, 1 cycle) | region or Atlas operation | array `operational`; metal 80 | SOURCE-REVIEWED for the actions; GC2-A for completion in the galaxy | C6b: solar facade with door |
| 10 | Take Off; travel to Vanguard and back (4 supply) or re-descend; walk | Atlas, walk | facade persists; Overseer names the array | GC2-A persistence | C7 |
| 11 | Only if B1 ships: exchange metal for supply at the station (placeholder 20 → 1, unapproved) | shop panel (B1) | metal −rate, supply +1, persisted | PROPOSED (05); gated on GC2-B metal recovery and the treasury rule | C8: exchange panel incl. one refusal |
| 12 | Reload inside the walk; CONTINUE GALAXY | gate → Atlas | save unchanged; Atlas reopens | PRIOR EVIDENCE (accepted GC1 reload contract) | — |

Walk controls as shipped: move with the arrow keys, interact with Z or Shift (the `shoot` key);
NPC interaction needs the NPC within two tiles and in front of the player; doors and the pad use
the same key with a release-then-press rule.

## Resource math for the loop

| Source | Cost | Colony gain | Note |
| --- | --- | --- | --- |
| Survey Cinder Relay Ruins | 1 cycle | intel surveyed | required before the expedition pays |
| Expedition Cinder Relay Ruins | 1 cycle | +80 metal (`POI_CARGO`) | pays once; the node becomes cleared and `createPoiOutcome` requires surveyed |
| Expedition Oathbreaker Wreck | 1 cycle (+1 survey) | +80 metal | same template family, pays once |
| Ashfall sortie (`op:ashfall-sortie`) | 1 cycle, 0 supply | +80 metal (60 base + 20 desert), +75 XP, zone secured | shooter mission on the planet adapter; repeatability is Colony's call |
| Travel Vanguard↔Ashfall | 2 supply per leg | — | `ceil(512 / 384)` |
| Credits (one-off) | — | ship credits: hostile picket 0 base, 200 with Quick Draw; Kepler black box 200; sortie 0 | a successful route reaches 400 once; one 300 kit is affordable once A1 unlocks the shop; no repeatable income |

Metal reachable from the fresh route: 240, all one-off (each node pays once; the sortie's
repeatability is Colony's call). Spends: solar array 80 (1 cycle), habitat 100 (1 cycle), mine
150 (2 cycles; +10 metal per cycle at ore 50), cantina 200 (3 cycles). The Manager resolved the
first management slice to the Solar Array only; the habitat and the mine are later slices. A
mine is the only repeatable metal path in the build table, which is why B1 waits for GC2-B.

## Captures (all at 480×854 in the real game, fresh save)

| ID | When | Must show | Pass if |
| --- | --- | --- | --- |
| C1 | step 2, no input after spawn | pad texture, Quartermaster, SUPPLY STATION label, Overseer at the plaza centre, mast (once landed), horizon band, HUD | all named elements visible in one frame; mast reads as a vertical at this size |
| C2 | step 3 | Overseer portrait, one line with a number from the save | number matches the save file |
| C3 | step 4 | shop rows with prices and the refusal flash | prices equal `adjustedBuyPrice` at neutral; refusal visible |
| C4 | step 6 | POI outcome with +80 METAL and the destination | delivered total equals the colony's metal afterwards |
| C5 | step 7 | yard line | number equals `resources.metal` |
| C6a / C6b | steps 8–9 | Solar Array in slot 3 (E-mid): scaffolding, then the solar facade and door | slot matches `assignSlots` for seed 4107 (rotation 3) |
| C7 | step 10 | same facade after take-off and return | identical building state; Overseer line names it |
| C8 | step 11 (only if B1 ships) | exchange row with YARD and HOLD totals; one refusal state (HOLD FULL or YARD SHORT) | totals equal the canonical save before and after; a retried intent charges once |
| C9 | step 1 | Atlas target card at Ashfall with DESCEND TO COLONY enabled | button enabled, no note |

Night versions of C1 and C6b belong to a later slice (D4). They are not required for the first
daylight acceptance; the 07:00 clock stays for GC2-A.

## Owned paths and handback

- Owned this turn: `docs/ashfall/**`. Editable sources: the markdown files and
  `boards/build-boards.sh`. Runtime assets: none added. Candidates: one portrait derivative.
- Integration order recommended to Manager: GC2-A Solar Array (Colony) → D1/D2/D7 asset
  registration (Kit B, C3) → Relay Mast art after direction acceptance, then its state binding as
  a small runtime slice → A1 unlock → copy changes in 04 as a small runtime slice → B1 exchange
  after GC2-B → captures C1–C9 from a fresh save → human aesthetic acceptance by Nic.
- Not done this turn and why: no test or build run (no `node_modules`, installs out of scope);
  no runtime captures (same reason; existing 2026-09-06 captures used as the visual baseline);
  no new environment art generated (brief: wait for direction acceptance and agreed slots).

## Lock exit criteria from the designer's side

Ashfall is accepted as a place when C1, C2, C6b, C7 and one of C3/C8 pass from a fresh save, the
Relay Mast shows both states in play, and the Overseer and Quartermaster carry their own faces.
Everything else in this packet can follow without reopening the lock.

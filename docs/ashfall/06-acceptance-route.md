# 06 — Fresh-save acceptance route

Ordinary player path, no developer fixture, from NEW GALAXY to a lasting consequence and back.
Each step carries its own label. "RUNS" means the step is in source on `30b0726` and covered by
the baseline evidence; I did not re-run it this turn (no `node_modules` in this worktree).

## Route

| # | Player action | Surface | State after | Label | Capture |
| --- | --- | --- | --- | --- | --- |
| 0 | Start a new galaxy run | experience gate → Galaxy Atlas | vessel at Vanguard, supply 12, credits 0; Ashfall charted with distress | RUNS | — |
| 1 | Select Ashfall; commit the known route; advance checkpoints; acknowledge arrival | Atlas | parked at Ashfall; supply 12 minus the route cost (2 on the direct leg); Ashfall visited | RUNS (route fixtures build exactly this through the shipped resolver) | C9: target card with DESCEND TO COLONY enabled |
| 2 | DESCEND TO COLONY | Atlas target card or SYSTEM view | first-person walk on the projection | RUNS (`galaxyColony.spec`) | C1: arrival frame from the spawn tile |
| 3 | Walk to the plaza centre; talk to the Overseer | walk, dialog | status lines from `buildGovernorDialog` | RUNS (copy and identity PROPOSED) | C2: Overseer dialog |
| 4 | Talk to the Quartermaster; open the shop; try to buy | walk, shop panel | PURCHASE UNAVAILABLE (legacy unlock, 0 credits) | RUNS, known gap | C3: refusal frame |
| 5 | Return to the pad; interact; REGION MAP; select Cinder Relay Ruins; SURVEY · 1 CYCLE | pad menu, region screen | node surveyed; world cycle +1 | RUNS per GC1 ("region expeditions launched from the pad keep working") | — |
| 6 | REGION MAP; Cinder Relay Ruins; TRAVEL · 1 CYCLE; play the first-person ruin; recover CINDER RELAY CORE; confirm DELIVER TO Ashfall Primary | first-person mission, POI outcome screen | node cleared; +80 metal to the colony; history fact; cycle +1 | RUNS per baseline (`galaxyPoiOutcomeAuthority`) | C4: outcome screen showing +80 METAL |
| 7 | Back in the walk, talk again | dialog | proposed yard lines | PROPOSED (04) | C5 |
| 8 | Open management from the pad; commission a building | GC2-A entry (Colony lane) | building `constructing`; metal −cost | GC2-A | C6a: scaffolding in slot 3 (E-mid) |
| 9 | Earn the cycles: second expedition (Oathbreaker Wreck, +80) or the Ashfall sortie (+80, 1 cycle) | region or Atlas operation | building `operational`; more metal | RUNS for the actions; GC2-A for completion in the galaxy | C6b: facade with door |
| 10 | Take Off; travel to Vanguard and back (4 supply) or re-descend; walk | Atlas, walk | facade persists; Overseer names the building | GC2-A persistence | C7 |
| 11 | Exchange 20 metal → +1 supply at the station | shop panel (B1) | metal −20, supply +1, persisted | PROPOSED (05) | C8: exchange panel incl. one refusal |
| 12 | Reload inside the walk; CONTINUE GALAXY | gate → Atlas | save unchanged; Atlas reopens | RUNS (accepted contract) | — |

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

Reachable from the fresh route without a mine: 240 metal. Spends: solar array 80 (1 cycle),
habitat 100 (1 cycle), mine 150 (2 cycles; +10 metal per cycle at ore 50), cantina 200 (3 cycles).
A mine plus an array (230) is the only sustainable path; a habitat plus an array (180) is the
most visible. The brief's "repeatable resource path without seeds" therefore points at the mine
as the first or second building; the Overseer's copy in 04 names the roof first because it is
what the player sees. Colony decides the recommended first commission.

## Captures (all at 480×854 in the real game, fresh save)

| ID | When | Must show | Pass if |
| --- | --- | --- | --- |
| C1 | step 2, no input after spawn | pad texture, Quartermaster, SUPPLY STATION label, Overseer at the plaza centre, mast (once landed), horizon band, HUD | all named elements visible in one frame; mast reads as a vertical at this size |
| C2 | step 3 | Overseer portrait, one line with a number from the save | number matches the save file |
| C3 | step 4 | shop rows with prices and the refusal flash | prices equal `adjustedBuyPrice` at neutral; refusal visible |
| C4 | step 6 | POI outcome with +80 METAL and the destination | delivered total equals the colony's metal afterwards |
| C5 | step 7 | yard line | number equals `resources.metal` |
| C6a / C6b | steps 8–9 | slot 3 (E-mid) with scaffolding; later the facade and door | slot matches `assignSlots` for seed 4107 (rotation 3) |
| C7 | step 10 | same facade after take-off and return | identical building state; Overseer line names it |
| C8 | step 11 | exchange row with YARD and HOLD totals; one refusal state (HOLD FULL or YARD SHORT) | totals equal the canonical save before and after |
| C9 | step 1 | Atlas target card at Ashfall with DESCEND TO COLONY enabled | button enabled, no note |

Night versions of C1 and C6b are required only if D4 lands.

## Owned paths and handback

- Owned this turn: `docs/ashfall/**`. Editable sources: the markdown files and
  `boards/build-boards.sh`. Runtime assets: none added. Candidates: one portrait derivative.
- Integration order recommended to Manager: D1/D2/D7 asset registration (Kit B, C3) → Relay Mast
  art after direction acceptance → B1 exchange after Colony's capability contract → A1 unlock →
  copy changes in 04 → captures C1–C9 from a fresh save → human aesthetic acceptance by Nic.
- Not done this turn and why: no test or build run (no `node_modules`, installs out of scope);
  no runtime captures (same reason; existing 2026-09-06 captures used as the visual baseline);
  no new environment art generated (brief: wait for direction acceptance and agreed slots).

## Lock exit criteria from the designer's side

Ashfall is accepted as a place when C1, C2, C6b, C7 and one of C3/C8 pass from a fresh save, the
Relay Mast shows both states in play, and the Overseer and Quartermaster carry their own faces.
Everything else in this packet can follow without reopening the lock.

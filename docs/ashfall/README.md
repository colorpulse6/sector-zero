# Ashfall production packet — first pass

Date: 2026-10-18. Lane: Claude Ashfall Designer. Branch `design/ashfall-lock`, baseline `30b0726`.
Manager: Codex Manager. Companion lane: Colony (GC2-A management slice).
Brief: `docs/handoffs/2026-10-18-ashfall-parallel-brief.md`. Baseline: `docs/handoffs/2026-10-18-consolidation-baseline.md`.

This is concrete preproduction for the first Ashfall lock. It names the place, fixes its visual
language, bounds the first asset kit against real runtime slots, writes state-aware
conversations, proposes a market/bartering interaction with the three modes kept apart, and
lays out the fresh-save acceptance route. It changes no runtime, saves, economy or shared
roadmap. Every proposal is labelled against what the source on `30b0726` actually does.

## Files

| File | Decides | Rung |
| --- | --- | --- |
| `01-place-brief.md` | Identity, player reason to visit, arrival landmark and sightline, 24×24 layout with named places, inhabited spaces, state changes the place must show | WRITTEN against VERIFIED source facts |
| `02-art-direction.md` | Ashfall register of the master style guide: measured palette, materials, light, colour rules, readability at 480×854, aesthetic acceptance conditions | WRITTEN; palette VERIFIED (measured) |
| `03-asset-manifest.md` | Runtime slot constraints; Kit A reuse as-is, Kit B register existing reviewed art, Kit C three first-slice assets, Kit D deferred; provenance and fallbacks | VERIFIED sizes/paths; Kit C WRITTEN |
| `04-cast-and-conversations.md` | Four-role cast, writing rules from the dialog renderer, five representative conversations (arrival, need, operation result, trade, return) with fact sources | RUNS lines quoted from builders; new copy WRITTEN |
| `05-market-and-bartering.md` | Fixed-price trade (A), direct exchange (B) and social negotiation (C) as separate slices: what changes hands, steps, refusal states, fact sources, contracts Colony must own | A RUNS with two blockers; B and C WRITTEN |
| `06-acceptance-route.md` | Fresh-save route, resource math, capture list C1–C9, owned paths, what was not run | WRITTEN; route steps labelled individually |
| `boards/reference-board.png` | Contact sheet of existing art plus measured palette (honest label on the image) | VERIFIED build from repo assets |
| `boards/baseline-annotated.png` | The 2026-09-06 baseline capture with proposal callouts | VERIFIED build; callouts WRITTEN |
| `boards/candidates/quartermaster-portrait-candidate.png` | 512² derivative of the approved pilot hero for review | VERIFIED build; not registered |
| `boards/build-boards.sh` | Reproducible board build (ImageMagick already installed; nothing downloaded) | RUNS locally |

## Evidence labels

- **RUNS** — present in source on `30b0726` and covered by the baseline evidence the manager
  recorded (951 unit tests, 110 browser tests). I did not re-run suites in this worktree: it has
  no `node_modules`, and installs were out of scope this turn.
- **VERIFIED** — I checked it directly this turn: source reads, pixel sizes (`sips`), mean
  colours and board output (`magick`).
- **WRITTEN** — authored proposal or copy. No runtime exists for it.

## Recommendation in one paragraph

Ashfall Primary is a grounded survey camp on a dust plain: a pad, a stall, a plaza and one
distress mast, lived in by two people who have been waiting for a ship. Keep the live sky,
ground, pad and quartermaster exactly as shipped; they already carry the look. Add one landmark
(the Relay Mast, lit while the distress is open, dark once the sortie secures the zone), give the
Overseer a face that is not Vanguard's commander (the reviewed hub-governor pair already on
disk), and make the first useful trade a direct exchange at the supply station (colony metal for
ship supply) because a fresh galaxy run has no credit source that reaches a posted consumable
price. Fixed-price buying follows once Colony sets a galaxy-native unlock; negotiation is a
later named slice that needs a dialog-choice primitive the engine does not have.

## Supported today vs proposed (short form)

| Mechanic | Today on `30b0726` | This packet proposes |
| --- | --- | --- |
| Descend, walk, pad menu, Take Off, Region map from pad | RUNS (GC1) | unchanged |
| Overseer status dialog from colony state | RUNS (`buildGovernorDialog`) | new identity + extra state lines (04) |
| Quartermaster fixed-price shop | RUNS display; every galaxy purchase refused (legacy planet-clear unlock; 0 credits) | A1 galaxy-native unlock (Colony owns) |
| Direct exchange (goods for goods) | none | B1 supply exchange at the station (Colony owns rule; designer owns UX/copy) |
| Social negotiation | none (dialog is linear lines + shop) | C later; needs choice rows |
| Visible state change in the place | scaffolding → facade (RUNS, legacy; galaxy after GC2) | Relay Mast lit/dark keyed to the sortie fact |
| Night lighting in the galaxy walk | never (projection clock fixed at 07:00) | decision D4 |

## Decisions returned to Manager (recommended option first)

| # | Decision | Options | Recommendation |
| --- | --- | --- | --- |
| D1 | Overseer identity | (a) register `npc-hub-governor` + `hub-governor` portrait as the Ashfall Overseer; (b) keep Voss sprite | (a). Voss is Vanguard crew; the governor pair is reviewed, on disk, unregistered, and reads as a frontier overseer |
| D2 | Arrival landmark | (a) new Relay Mast billboard, lit + dark variants; (b) no new art this slice; (c) lander hull prop | (a). The antenna prop has a white halo and the rig prop is defective, so there is no acceptable stand-in on disk |
| D3 | First commerce slice | (a) B1 supply exchange first, A1 unlock second; (b) A1 first; (c) Marketplace building | (a). No credit source on the fresh route reaches 300 credits; metal exists after one expedition |
| D4 | Galaxy walk hour | (a) derive hour from `worldCycle` so night exists; (b) keep 07:00 | (a), Colony-owned formula. Without it the night lighting pass cannot be accepted in the galaxy |
| D5 | Exchange rate placeholder | 20 metal → 1 supply, one direction, cap at 12 | Placeholder only; Colony sets the number. Rationale in 05 |
| D6 | Ashfall perimeter wall variant | (a) defer; (b) new 512² tile now | (a). Current frame wall passes the register; spend the first new asset on the mast |
| D7 | Quartermaster portrait | (a) accept the derivative candidate after edge cleanup; (b) none | (a). Free, from the approved pilot source |

## Parked problems (not fixed here, outside my files)

1. `game/public/sprites/explore/scrapyard-outpost-landmark-rig.png` contains baked, garbled text ("scrapyard outpost ground.png"); it is still referenced by the legacy forward camp.
2. `scrapyard-outpost-prop-antenna.png` has a white edge halo the master guide forbids.
3. `ashfallForwardCamp.ts` legacy shop item `hull-repair-kit` is not a `ConsumableId` (`hull-repair`); display-only today.
4. Governor copy prints "all 1 of our buildings are operational" at one building.
5. The galaxy projection fixes the walk at 07:00, so porch and scaffold lights never render in a galaxy visit.

## Handback manifest

Owned paths this turn: `docs/ashfall/**` only. No edits to `Game.tsx`, reducers, saves,
travel, sprites registry, `game/public`, roadmap or any other lane's files. Local commit scoped to
`docs/ashfall/`. Nothing pushed, deployed or merged.

Residual risk: route steps 5–6 (survey and expedition from the galaxy pad) are labelled RUNS on the
manager's GC1 statement and the baseline browser log, not on a run I performed this turn.

# Ashfall production packet — first pass

**Current scope:** [October 24 lock contract](08-lock-contract.md) and
[acceptance route](06-acceptance-route.md). The original design packet below remains
historical; its proposed prices, lore and landmarks are not automatically runtime commitments.

Date: 2026-10-18. Lane: Claude Ashfall Designer. Branch `design/ashfall-lock`, baseline `30b0726`.
Manager: Codex Manager. Companion lane: Colony (GC2-A management slice).
Brief: `docs/handoffs/2026-10-18-ashfall-parallel-brief.md`. Baseline: `docs/handoffs/2026-10-18-consolidation-baseline.md`.

This is concrete preproduction for the first Ashfall lock. It names the place, fixes its visual
language, bounds the first asset kit against real runtime slots, writes state-aware
conversations, proposes a market/bartering interaction with the three modes kept apart, and
lays out the fresh-save acceptance route. It changes no runtime, saves, economy or shared
roadmap. Every proposal is labelled against what the source on `30b0726` actually does.

## Files

| File | Decides | Evidence |
| --- | --- | --- |
| `01-place-brief.md` | Identity, player reason to visit, arrival landmark and sightline, 24×24 layout with named places, inhabited spaces, state changes the place must show | PROPOSED; backing facts SOURCE-REVIEWED |
| `02-art-direction.md` | Ashfall register of the master style guide: measured palette, materials, light, colour rules, readability at 480×854, aesthetic acceptance conditions | PROPOSED; palette values are direct file measurements (not gameplay evidence) |
| `03-asset-manifest.md` | Runtime slot constraints; Kit A reuse as-is, Kit B register existing reviewed art, Kit C three first-slice assets, Kit D deferred; provenance and fallbacks | sizes and paths are direct file checks; Kit C PROPOSED |
| `04-cast-and-conversations.md` | Four-role cast, writing rules from the dialog renderer, five representative conversations (arrival, need, operation result, trade, return) with fact sources | quoted lines SOURCE-REVIEWED; new copy PROPOSED; identities and backstory are authored proposals, not canon |
| `05-market-and-bartering.md` | Fixed-price trade (A), direct exchange (B) and social negotiation (C) as separate slices: what changes hands, steps, refusal states, fact sources, contracts Colony must own | A SOURCE-REVIEWED with two blockers; B PROPOSED partial path with prerequisites; C PROPOSED |
| `06-acceptance-route.md` | Fresh-save route, resource math, capture list C1–C9, owned paths, what was not run | PROPOSED route; each step labelled SOURCE-REVIEWED / PRIOR EVIDENCE / PROPOSED |
| `boards/reference-board.png` | Contact sheet of existing art plus measured palette (honest label on the image) | built and inspected this turn from repo assets (direct check) |
| `boards/baseline-annotated.png` | The 2026-09-06 baseline capture with proposal callouts | built this turn (direct check); callouts PROPOSED |
| `boards/candidates/quartermaster-portrait-candidate.png` | 512² derivative of the approved pilot hero for review | built this turn (direct check); not registered |
| `boards/build-boards.sh` | Reproducible board build (ImageMagick already installed; nothing downloaded) | executed this turn (direct check) |
| `07-runtime-slice-1-overseer.md` | Runtime slice 1: Ashfall Overseer presentation (reviewed hub-governor art under role keys) and factual lines from `ColonyState`; tests, browser evidence, integration notes | RAN (typecheck, unit suites, isolated browser spec); see the file |

## Evidence labels

Manager's scheme (2026-10-18 review). Nothing in this packet was executed as gameplay by me.

- **SOURCE-REVIEWED** — I read it in source on `30b0726`. It is an observation of code, not an
  executed result. This worktree has no `node_modules`; no test, build or game run happened here.
- **PRIOR EVIDENCE** — covered by evidence someone else recorded and I cite: the consolidation
  baseline (951 unit tests, 110 browser tests, exit 0, on `30b0726`), the GC1 specs it names
  (`galaxyColony.spec`, route fixtures, `galaxyPoiOutcomeAuthority`), and the 2026-09-06
  graphics-rollout captures. The citation says what the evidence covered; it does not extend it.
- **PROPOSED** — authored design, copy or fiction. No runtime exists for it. The lander-loss
  story and the named Overseer and Quartermaster are authored proposals, not recovered canon.
- **Direct checks** (kept apart from gameplay evidence): pixel sizes (`sips`), mean colours and
  board builds (`magick`). They verify files on disk, never behaviour in the game.

## Recommendation in one paragraph

Ashfall Primary is a grounded survey camp on a dust plain: a pad, a stall, a plaza and one
distress mast, lived in by two people who have been waiting for a ship. Keep the live sky,
ground, pad and quartermaster exactly as shipped; they already carry the look. Add one landmark
(the Relay Mast, lit while the distress is open, dark once the sortie secures the zone), give the
Overseer a face that is not Vanguard's commander (the reviewed hub-governor pair already on
disk), and open the first useful trade by letting the existing fixed-price shop sell in the
galaxy (A1, a Colony-owned unlock). A fresh run starts at 0 credits and its income is one-off:
the hostile picket pays 200 only with the Quick Draw modifier and the Kepler black box pays 200,
so a successful route can afford one 300-credit kit once. The blockers are the legacy-only unlock
and the absence of repeatable income, not the price. The supply exchange (B1, colony metal for
ship supply) stays a proposed partial path: colony metal is finite and also funds construction,
so B1 waits for GC2-B to define metal recovery and treasury ownership. Negotiation is a later
named slice that needs a dialog-choice primitive the engine does not have.

## Supported today vs proposed (short form)

| Mechanic | Today on `30b0726` | This packet proposes |
| --- | --- | --- |
| Descend, walk, pad menu, Take Off, Region map from pad | PRIOR EVIDENCE (GC1 specs and browser log) | unchanged |
| Overseer status dialog from colony state | SOURCE-REVIEWED (`buildGovernorDialog`) | new identity + extra state lines (04); a separate small runtime slice |
| Quartermaster fixed-price shop | SOURCE-REVIEWED: rows display; every galaxy purchase refused by the legacy planet-clear unlock; fresh run at 0 credits with one-off income (Quick Draw 200, Kepler 200) | A1 galaxy-native unlock (Colony owns); repeatable income is a Manager/Colony decision |
| Direct exchange (goods for goods) | none | B1 supply exchange at the station, a partial path gated on GC2-B metal recovery and a treasury rule (Colony owns rule; designer owns UX/copy); rate and cap UNAPPROVED |
| Social negotiation | none (dialog is linear lines + shop) | C later; needs choice rows |
| Visible state change in the place | scaffolding → facade (SOURCE-REVIEWED, legacy clock; galaxy after GC2-A, Solar Array only) | Relay Mast lit/dark keyed to the sortie fact; its state binding is a separate small runtime slice |
| Night lighting in the galaxy walk | never (projection clock fixed at 07:00; retained for GC2-A) | later slice (D4); not a prerequisite for the first daylight slice |

## Decisions returned to Manager (recommended option first)

| # | Decision | Options | Recommendation |
| --- | --- | --- | --- |
| D1 | Overseer identity | (a) register `npc-hub-governor` + `hub-governor` portrait as the Ashfall Overseer; (b) keep Voss sprite | (a). Voss is Vanguard crew; the governor pair is reviewed, on disk, unregistered, and reads as a frontier overseer |
| D2 | Arrival landmark | (a) new Relay Mast billboard, lit + dark variants; (b) no new art this slice; (c) lander hull prop | (a). The antenna prop has a white halo and the rig prop is defective, so there is no acceptable stand-in on disk |
| D3 | First commerce slice | (a) B1 supply exchange first, A1 unlock second; (b) A1 unlock first, B1 after GC2-B; (c) Marketplace building | (b), revised after the Manager review. The route can afford one 300-credit kit once (Quick Draw 200 + Kepler 200) and A1 is the smaller Colony change; B1 is not sustainable until finite-metal recovery and treasury ownership are solved |
| D4 | Galaxy walk hour | (a) derive hour from `worldCycle` so night exists; (b) keep 07:00 | (b) for GC2-A, as resolved by the Manager; (a) later as its own small slice. Night is not a prerequisite for the first daylight slice; night captures are optional until then |
| D5 | Exchange rate and cap | UNAPPROVED placeholders: 20 metal → 1 supply, one direction, cap 12 | Not approved and not sustainable as written; Colony sets both after GC2-B defines metal recovery and the colony-treasury vs ship-resource rule. Rationale and prerequisites in 05 |
| D6 | Ashfall perimeter wall variant | (a) defer; (b) new 512² tile now | (a). Current frame wall passes the register; spend the first new asset on the mast |
| D7 | Quartermaster portrait | (a) accept the derivative candidate after edge cleanup; (b) none | (a). Free, from the approved pilot source |

## Corrections applied from the Manager review (2026-10-18)

Source: `docs/handoffs/2026-10-18-ashfall-design-manager-review.md`.

1. Credits: Quick Draw 200 and Kepler 200 can afford one 300-credit kit; the blocker is the
   legacy-only unlock plus no repeatable income (README, 05, 06).
2. Barter: B1 is a proposed partial path, not sustainable; rate and cap are UNAPPROVED; B1 needs
   a repeatable metal path and a treasury rule from GC2-B; no rerollable POI rewards (05, 06, D5).
3. Transactions: determinism on the same input is not retry deduplication; same intent charges
   once, two new valid intents may charge twice; persisted canonical state and quote validation
   are Colony's (05).
4. Evidence labels: SOURCE-REVIEWED / PRIOR EVIDENCE / PROPOSED replace the earlier rungs; direct
   file checks are listed separately (all files).
5. Boards: short two-line display labels on a narrower sheet; the label → file table is in
   `boards/README.md`; rebuilt and inspected.

Scope resolutions carried into the packet: the first management slice commissions the Solar Array
only; richer conversations, the exchange and the mast state binding are separate small runtime
slices; the 07:00 clock stays for GC2-A and night is later; the lander-loss story and the
Overseer's identity are authored proposals, not recovered canon.

## Parked problems (not fixed here, outside my files)

1. `game/public/sprites/explore/scrapyard-outpost-landmark-rig.png` contains baked, garbled text ("scrapyard outpost ground.png"); it is still referenced by the legacy forward camp.
2. `scrapyard-outpost-prop-antenna.png` has a white edge halo the master guide forbids.
3. `ashfallForwardCamp.ts` legacy shop item `hull-repair-kit` is not a `ConsumableId` (`hull-repair`); display-only today.
4. Governor copy prints "all 1 of our buildings are operational" at one building.
5. The galaxy projection fixes the walk at 07:00, so porch and scaffold lights never render in a galaxy visit. Accepted for GC2-A; night is a later slice.

## Handback manifest

Owned paths this turn: `docs/ashfall/**` only. No edits to `Game.tsx`, reducers, saves,
travel, sprites registry, `game/public`, roadmap or any other lane's files. Local commit scoped to
`docs/ashfall/`. Nothing pushed, deployed or merged.

Residual risk: route steps 5–6 (survey and expedition from the galaxy pad) are labelled PRIOR
EVIDENCE on the manager's GC1 statement and the baseline browser log, not on a run I performed.

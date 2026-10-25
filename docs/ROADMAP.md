# Sector Zero — Master Roadmap

**Updated 2026-10-24.** PR #26 merged at `95add54` and deployment
[39730235392](https://github.com/colorpulse6/sector-zero/actions/runs/39730235392)
succeeded. Five-building settlement, salvage recovery and fighter polish are released.
The active `feat/ashfall-lock` increment adds the useful Quartermaster exchange and
complete reference-world acceptance route. It remains a **lock candidate** pending
normal review/release and Nic's final in-game visual acceptance.

This file owns direction, sequence and completion status. Detailed system specs own
their contracts; individual agents do not maintain competing master roadmaps.

## The current commitment: lock Ashfall

Nic selected **Ashfall as the first complete reference world**, with Colony systems
and Claude place design progressing in parallel. Aesthetic, assets, conversations,
market and bartering are part of that ambition. Each must have an explicit playable
scope and acceptance result.

The first finished experience is:

**Travel to Ashfall -> descend -> meet useful people -> improve the colony -> undertake
local work -> trade/use its rewards -> see a durable consequence -> leave and return.**

The manager owns integration and completion. A place is not finished because its art,
code or branch exists. The ordinary fresh-save route must work, preserve consequences
and meet the agreed visual standard.

- [Verified baseline and gap inventory](handoffs/2026-10-18-consolidation-baseline.md)
- [Parallel work ownership and acceptance brief](handoffs/2026-10-18-ashfall-parallel-brief.md)
- [Colony agent's GC1–GC5 integration design](superpowers/specs/2026-10-18-galaxy-colony-integration-design.md)
- [GC2-A accepted management design](superpowers/specs/2026-10-18-gc2a-galaxy-colony-management-design.md)
  and [implementation plan](superpowers/plans/2026-10-18-gc2a-galaxy-colony-management.md)
- [Manager's GC2-A review](handoffs/2026-10-18-gc2a-manager-review.md): design accepted after
  canonical-store and input-ownership corrections; implementation reviewed and integrated locally
- [Runtime milestone and verification](handoffs/2026-10-18-ashfall-runtime-milestone.md):
  GC2-A and the first Overseer slice complete locally; full Ashfall acceptance remains open
- [Ashfall production packet](ashfall/README.md), [reference board](ashfall/boards/reference-board.png)
  and [manager review](handoffs/2026-10-18-ashfall-design-manager-review.md): integrated
  preproduction; proposed art, fiction and trade mechanics still require runtime acceptance

## North star

**A frontier captain in a persistent systemic sandbox. The simulation creates
campaigns; campaigns reshape the simulation.** Command from the bridge, travel to
real places, walk among the people affected by decisions and personally resolve
important commitments. Depth over breadth. Authored content gives places, people,
mysteries and consequences their identity; systems connect them.

A typical session follows the Captain's Circuit: understand a situation, inspect a
place/person, choose a commitment, act, absorb the result and see the world respond.
Management must translate into people, visible changes or playable opportunities.

## Decisions of record

- **2026-10-18:** Nic approved all three enemy concepts in the HTML review. Ship their
  front-facing runtime integration with map completion fixes after verification. Directional
  animation production remains a separate art milestone; approval of a concept is not approval
  of unseen animation. Merge and deploy both game and companion site are authorized.

- **2026-10-18:** lock Ashfall first; Colony continues its GC roadmap alongside a
  scoped Claude designer, coordinated by Codex Manager. Art/content work can run in
  parallel with system integration. New mechanics still need explicit contracts.
- **2026-10-18:** the structure is cockpit -> Atlas -> consequential travel/battles ->
  colony and region. Ground run-and-gun and ship boarding are removed. Shooter,
  turret, first-person missions, first-person colony exploration and multi-phase remain.
- **2026-07-16:** continuous coordinates replace numbered-world progression. Existing
  W1–W8 content becomes named operations at physical locations. Arrival and accepting
  an operation are separate choices.
- **2026-07-16:** seed, generation version and authored-anchor registry version form
  one saved identity. Observed facts and reserved places never silently reroll.
- **2026-07-16:** travel commits time and abstract supply, previews threats/confidence,
  and resolves bounded interruptions with actual causes. Canonical galaxy starts fresh;
  old campaign state is not silently imported.
- **2026-07-13:** colonies decline through legible, counterable stages; eventual
  syndicates become world actors. Keep one pilot progression track, extending it with
  non-combat XP and Engineering/Piloting when those actions exist.
- **Long-horizon decisions preserved:** layered captain/galactic time, autonomous
  settlements, generational culture, political authority and a durable chronicle.
  Living civilization and the Long Search must be substantial play before the optional
  Fold Threshold. Completing the opening campaign does not end the save or force joining.

## Current state and evidence

The approved enemy family and map-completion release is recorded in
[the release handoff](handoffs/2026-10-18-approved-hostiles-release.md). The three
concepts are accepted; the initial front-facing runtime integration and reachable
mission routes are verified and released. PR #25 merged at `dc35da2`; deployment
[39163042227](https://github.com/colorpulse6/sector-zero/actions/runs/39163042227)
succeeded for that commit. Production game, approved assets and companion site were
checked after deployment. The final release passed 1,046 local unit/asset tests,
122 game browser tests and nine site browser tests.


The current delivery adds five-building management, planned-power and mine-first safeguards,
settler guidance, and explicit E/touch FPS pickup. The site and README follow the simplified
travel/settlement direction. See [settlement/FPS delivery](handoffs/2026-10-18-settlement-fps-delivery.md)
for integration checks and the enemy-art handback. The earlier evidence below remains historical.

The following records the earlier integration boundary. At runtime `44111cf`, Manager
verified **990/990 unit tests**, clean typechecking and successful static export. **Nine
focused integrated browser checks passed**: seven management/Overseer checks plus two
held-input regressions. Before the NPC integration, Colony's full browser run passed
**116/116**, followed by one fresh-profile route test. The full suite was not repeated
after the presentation integration; the affected routes were checked instead.

An ordinary save was played through travel, descent, survey, expedition entry/early
return, management refusal and Overseer conversation. Successful construction,
completion and reload have automated coverage using the shipped POI outcome authority;
the successful first-person expedition itself still needs ordinary playthrough proof.
This is a verified runtime increment, not the full Ashfall lock.

| Area | Current status | Remaining boundary |
| --- | --- | --- |
| G0 galaxy foundation | Implemented: fresh run, coordinates, seeded discovery, travel commitments, located operations and recovery | Bounded local-sector proof; not a whole simulated civilization |
| Region and Atlas presentation | Region chart plus Babylon sector/system scenes implemented | Procedural display planets are not all playable destinations |
| GC1 galaxy colony descent | Implemented: parked Ashfall -> walk -> region/Take Off -> Atlas | Only Ashfall Primary is mapped for descent; ordinary reload returns to Atlas |
| Colony economy/building/NPC foundation | Five basic buildings and repeatable salvage recovery released in PR #26 | Useful exchange implemented in the lock candidate; visual acceptance pending; geometry updates on next descent |
| Merchant services | Galaxy Quartermaster offers metal for travel supply in the lock candidate | Consumables need a Galaxy equip/use route before they can be useful stock |
| M3 hubs | Cantina runtime/assets exist; first-person utility interiors exist | Fresh Ashfall outpost has no cantina; Marketplace partial branch is not integrated; Town Hall remains future |
| Combat and outcomes | Retained modes and outcome/persistence machinery exist; ground/boarding cleanup merged locally | Broader located campaign and travel battle mapping remain GC4 |
| M2 visuals | Shooter/NPC/hub asset work and the existing first-person presentation are reusable | Asset acceptance is per runtime consumer; no blanket colony 3D migration is approved |
| Civilization layer | Strategic cycle and history foundations exist | Full decay, syndicates, generations, Houses, governance and long-interval catch-up remain future |

Remote `main` is now `95add54` (PR #26 merge); the PR #25 receipts above remain historical. Preserve the
partial Marketplace branch (`feat/m3-marketplace-runtime`, `289f4eb`) for a scoped reuse
review. Fourteen clean integrated worktrees were removed after merge/patch verification;
their branches remain. Ashfall design notes and unmatched mission-presentation work remain
preserved. Clean up completed task environments only after ownership and recovery checks.

## Active milestone: Ashfall lock candidate

The [lock contract](ashfall/08-lock-contract.md) fixes this milestone's scope.
The [delivery handoff](handoffs/2026-10-24-ashfall-lock-candidate.md) records checks,
screenshots and remaining acceptance gates.

| Lane | Owner | Current status | Finish condition |
| --- | --- | --- | --- |
| Settlement and recovery | Codex Manager | Released in PR #26: five buildings, mine income, growth, repeatable salvage and failure recovery | Preserve the zero-stock, 25-shift route to ten settlers |
| Useful commerce | Codex Manager | Implemented: Quartermaster exchanges 20 colony metal for one ship travel supply; fresh Galaxy needs no Legacy unlock | Exact costs/rewards, refusals, single-intent commits and reload verified in the real shop |
| Place and presentation | Existing designer baseline; Codex integrates | Existing Overseer, animated Quartermaster, work station and building silhouettes retained; balances and factual trade guidance added | Review captured desktop/mobile gameplay; Nic accepts the final feel |
| Integration and release | Codex Manager | Fresh new-game work/build/trade/departure/return route passes locally | Complete regressions, normal PR review, deployment and public checks |
| Final place acceptance | Nic | Pending in-game review | Accept the playable result; then mark the reference world locked |

**Economy:** Salvage still costs one world cycle and earns 40 colony metal plus one
travel supply, with no entry cost. Building prices, mine production and growth stay
unchanged. The new repeatable exchange spends 20 colony metal for one ship travel
supply, takes no cycle and has no artificial reserve cap. It is a fixed exchange,
not a negotiation or credits marketplace. This manager decision under Nic's October
24 lock instruction supersedes the older unapproved cap-twelve proposal. Galaxy
consumable sales stay deferred until normal equipping/use exists.

**Presentation:** preserve the accepted frontier-industrial direction. The Overseer
reports the current settlement; the Quartermaster explains work, cost and travel
supply. Finished buildings appear on the next descent. Fixed 07:00 remains the
current world-clock projection. Neither new lore nor a night renderer is required.

**Proof:** a fresh browser profile can BEGIN GALAXY, travel, receive an empty-stock
trade refusal, work/build to ten settlers, trade twice with held-input protection,
meet the Overseer, Take Off, travel to Vanguard and back, reload and descend.
The [acceptance route](ashfall/06-acceptance-route.md) separates this functional proof
from Nic's visual acceptance and from production deployment.

The Marketplace interior, negotiated prices, new destinations and extra asset passes
are optional later milestones. They do not move this finish line.

## What locking a world or system means

A lock has two parts:

1. **Accepted development baseline:** stable identity, geography, visual language,
   entry/exit rules, useful interactions, evidence and regression fixtures. Later
   improvements must deliberately preserve or revise that contract.
2. **Saved-world continuity:** coordinates, entity identity, known facts and causal
   history persist. Buildings, inhabitants, ownership and culture can still evolve.

Place states are **proposed -> brief accepted -> integrated -> verified -> accepted**.
“Accepted” requires ordinary player access, persistent consequences and aesthetic
approval. Release is tracked separately. Keep one new place in active production;
expand after it proves the pattern.

## After Ashfall

1. **GC3: galaxy cockpit.** Connect the proven loop to its ordinary home: Atlas,
   colonies, located work and only functioning galaxy-owned services. Preserve clear
   returns and current location.
2. **First GC4 destination.** Use one existing authored location/operation, preferably
   the already-adapted Kepler lead, to prove a reusable destination contract and
   consequential travel. Do not adapt all W1–W8 content at once.
3. **Living-world pressure.** Ship one causal need/crisis with warning, action,
   consequence and recovery. Grow it into M4's slow decay and emergent syndicates.
4. **Broaden the civilization loop.** Add remaining hub functions, non-combat RPG
   progression (M5), multi-colony logistics, and one absence/return story before M6's
   large-scale actors, layered time and chronicle.
5. **GC5: retire legacy at parity.** Remove the experience wrapper only when the agreed
   galaxy capabilities and explicit old-save policy are satisfied.
6. **Long horizon.** Generations, households, Great Houses, governance, long transit,
   cultural memory and eventually optional Fold systems remain preserved ambitions.
   Each gets a focused spec when the preceding playable foundations justify it.

## Design authority and historical references

- This roadmap owns sequence and status; the October parallel brief owns lane boundaries.
- [Galaxy-colony integration](superpowers/specs/2026-10-18-galaxy-colony-integration-design.md):
  GC1–GC5 components and precise as-built limitations.
- [Continuous Galaxy Atlas](superpowers/specs/2026-07-16-continuous-galaxy-atlas-design.md):
  canonical spatial identity, located operations, travel and save isolation.
- [Colony systems](superpowers/specs/2026-04-20-colony-system-design.md): data model,
  colony systems and UX reference. Its phase order is superseded here;
  `docs/game/colony-system-design.md` is an older superseded draft.
- [Open-world colony](superpowers/specs/2026-07-13-open-world-colony-design-draft.md):
  region/exploration foundations. Its old open questions do not reopen accepted decisions.
- [Living Galaxy](superpowers/specs/2026-07-14-living-galaxy-vision-design.md) and
  [Civilization Frontier](superpowers/specs/2026-07-15-civilization-frontier-design.md):
  approved long-horizon fiction, time, government and continuity. October's mode removal
  supersedes their boarding/ground-run examples.
- [Decay arc](superpowers/specs/2026-07-13-decay-arc-emergent-antagonists-design.md):
  M4 direction, requiring later focused implementation slices.
- Existing M2 art, M3 hub-production and Cantina plans, plus playtest/handoff records,
  remain reusable evidence and production references. Do not regenerate accepted assets
  without checking their intended consumer and current runtime quality.

## Completion discipline

Each slice has one accountable owner, owned files, a player-visible outcome, explicit
exclusions and a fresh-save acceptance route. Specs and plans precede implementation;
review combines correctness, requirements and maintainability at meaningful boundaries.
Verify appropriate tests, static export, actual browser behavior and gameplay-size art.

Distinguish **written**, **executed**, **verified**, **human accepted** and **released**.
Track blockers with an owner and a concrete closure condition. Codex Manager reconciles
this file after each accepted milestone; no agent declares the whole roadmap finished
from its own lane's success.

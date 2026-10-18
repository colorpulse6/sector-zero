# Sector Zero — Master Roadmap

**Updated 2026-10-18.** Current integration baseline: `feat/galaxy-colony` at
`30b0726`. This file owns direction, sequence and completion status. Detailed system
specs own their contracts; individual agents do not maintain competing master roadmaps.

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

These are local branch statements, not deployment claims. The Colony agent reported a
clean typecheck, **951 unit tests passing**, and a successful static export at `30b0726`.
The manager independently inspected the completed browser log: **110 passed (7.6m),
exit 0**. This validates the existing integration baseline, not the future Ashfall lock.

| Area | Current status | Remaining boundary |
| --- | --- | --- |
| G0 galaxy foundation | Implemented: fresh run, coordinates, seeded discovery, travel commitments, located operations and recovery | Bounded local-sector proof; not a whole simulated civilization |
| Region and Atlas presentation | Region chart plus Babylon sector/system scenes implemented | Procedural display planets are not all playable destinations |
| GC1 galaxy colony descent | Implemented: parked Ashfall -> walk -> region/Take Off -> Atlas | Only Ashfall Primary is mapped for descent; ordinary reload returns to Atlas |
| Colony economy/building/NPC foundation | Existing reducers, population, production, construction, schedules, dialogue and faction pricing | GC2 must connect management safely to the galaxy run |
| Merchant services | Quartermaster purchase path exists | Fresh galaxy consumables remain legacy-unlock-dependent |
| M3 hubs | Cantina runtime/assets exist; first-person utility interiors exist | Fresh Ashfall outpost has no cantina; Marketplace partial branch is not integrated; Town Hall remains future |
| Combat and outcomes | Retained modes and outcome/persistence machinery exist; ground/boarding cleanup merged locally | Broader located campaign and travel battle mapping remain GC4 |
| M2 visuals | Shooter/NPC/hub asset work and the existing first-person presentation are reusable | Asset acceptance is per runtime consumer; no blanket colony 3D migration is approved |
| Civilization layer | Strategic cycle and history foundations exist | Full decay, syndicates, generations, Houses, governance and long-interval catch-up remain future |

Local `origin/main` is `9bf52a2` (PR #24 merge), not refreshed remote evidence. Nothing
in this consolidation publishes or merges the integration branch to main. Preserve the
partial Marketplace branch (`feat/m3-marketplace-runtime`, `289f4eb`) for a scoped reuse
review. Do not clean up old branches/worktrees merely because they look stale.

## Active parallel milestone: Ashfall

| Lane | Owner | Current assignment | Finish condition |
| --- | --- | --- | --- |
| Systems (GC2-A) | Existing Colony agent | Reconcile its roadmap; specify the first galaxy management slice and capability contract | Fresh save can reach management, commission one supported improvement, advance it through existing actions, see it complete, reload and re-enter without lost/duplicated state or legacy mutations |
| Place, art and conversations | Claude Ashfall Designer | Isolated `design/ashfall-lock` worktree; bounded production packet under `docs/ashfall/` | Concrete identity/layout, asset slots, useful NPC conversations and an in-game acceptance route; then implement reviewed assets/interactions against real state |
| Market and bartering | Designer proposes experience; Colony owns rules; Manager reconciles | Define first useful trade and its dependencies | Stock, price/exchange, refusal, cost and result are real, persistent and safe under repeated/stale input; distinguish buying/selling, exchange and negotiation |
| Integration and lock | Codex Manager; Nic accepts the aesthetic | Review handoffs, freeze interfaces, issue bounded implementation slices and verify the complete route | Functional proof plus runtime visual acceptance and an ordinary playthrough; record remaining defects and compatibility obligations |

Design work starts alongside systems work, rather than waiting for all GC2–GC4
infrastructure. Runtime integration still follows the dependency contract. The exact
first barter mechanic, merchant unlock, sustainable supply path and visible colony
consequence remain decisions for the bounded designs, not silently committed features.

The active implementation boundary remains one useful Ashfall loop. Marketplace,
Town Hall, a full dialogue engine, procedural city generation, all campaign chapters
and a renderer replacement must not become hidden prerequisites.

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

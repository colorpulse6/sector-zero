# Sector Zero consolidation baseline

Date: 2026-10-18. Coordinator: Codex Manager.
Baseline: `feat/galaxy-colony` at `30b0726`.
Purpose: establish what exists, preserve accepted direction, and define finishable increments.
This is an assessment, not authorization to implement every proposed milestone or publish a release.

## What the game is becoming

The player is a frontier captain: command from the bridge, travel to a real location,
walk among the people affected by decisions, undertake an operation, and return to a
changed world. The simulation creates campaigns; campaigns reshape the simulation.

The near-term connected loop is:

```text
Cockpit -> Atlas -> committed travel -> arrival -> colony / region
   ^                       |                         |
   |                  caused battle                  |
   +--- return with lasting consequences <--- operation / construction
```

The intended long game includes autonomous settlements, slow decay, syndicates,
generations, Houses, delayed communications and consequential long absences. These
remain distinct later milestones. The opening campaign leads into an indefinitely
playable civilization era. Joining the Fold is a later voluntary threshold, not an
automatic consequence of completing the campaign.

## Accepted decisions to preserve

| Decision | Authority |
| --- | --- |
| Continuous coordinates; numbered worlds become content references, not progression gates | [Continuous Galaxy Atlas](../superpowers/specs/2026-07-16-continuous-galaxy-atlas-design.md), sections 2 and 4 |
| Stable generation identity, reserved authored locations, persistent discoveries; no rerolls on reload | Same, sections 4, 6 and 14 |
| Travel commits time and supply, previews risk, and may encounter a caused interruption | Same, section 7 |
| Arrival and accepting an operation are separate choices | Same, section 3 |
| Canonical galaxy starts fresh; legacy history is not silently imported | Same, section 12.3 |
| Hub -> Atlas -> travel battles -> colony; colony is central to the future | [Galaxy-colony integration](../superpowers/specs/2026-10-18-galaxy-colony-integration-design.md) |
| Keep shooter, turret, first-person missions, colony exploration and multi-phase chaining; remove ground-run and boarding | Same; cleanup merge `30b0726` |
| Walking a colony does not advance strategic cycles | Colony design and GC1 integration |
| Slow, legible decline with counterplay; no sudden arbitrary colony deletion | [Decay arc](../superpowers/specs/2026-07-13-decay-arc-emergent-antagonists-design.md) |
| Captain time and galactic time eventually diverge through long travel; no continuous offline simulation | [Living Galaxy](../superpowers/specs/2026-07-14-living-galaxy-vision-design.md), sections 8 and 14 |
| The opening frontier has no established living precursor empires or Great Houses; those societies emerge during play | Same, section 5.1.1 |
| AI can assist authoring; saved world truth remains authoritative | [Civilization Frontier](../superpowers/specs/2026-07-15-civilization-frontier-design.md), sections 4 and 20 |

## Current capability map

“Implemented” below means source exists on this baseline. Runtime evidence is recorded
separately; the existence of a test is not a passing result.

| Area | Current state | Boundary / remaining work |
| --- | --- | --- |
| Galaxy foundation | Fresh galaxy save, persistent vessel position, seeded discovery, route preview/commitment, history facts and operation outcomes exist | A bounded local-sector proof, not the complete living galaxy |
| Atlas presentation | Babylon sector/system scenes, region chart, contact selection and descent entry points exist | Displayed procedural worlds are not automatically authored playable destinations |
| Ashfall descent (GC1) | Park at visited Ashfall, descend, walk the first-person colony, open the region from the pad, take off to Atlas | Only Ashfall Primary is mapped for descent; it is not the complete management loop |
| Reload during a walk | Canonical save is preserved; Continue Galaxy returns to Atlas | Exact scene/position resumption is not implemented. Earlier GC1 prose promised more than the as-built behavior |
| Colony management | Existing colony planner/economy/reducer/building systems can be reused | Galaxy management entry and safe mutation routing remain GC2 |
| Colony people | Schedules, pathfinding, dialogue, faction pricing and quartermaster exist | Galaxy consumables still depend on legacy planet-clear unlocks, so the fresh galaxy shop is not useful |
| Hubs | Cantina runtime and assets exist | Fresh Ashfall is an outpost without a cantina; Marketplace work is incomplete on another branch; Town Hall remains later work |
| Region | Travel, POIs, survey, founding and economic effects exist, with a galaxy adapter | Newly founded colonies need a complete access/management/descent story |
| Cockpit | Existing legacy cockpit and panels | Galaxy opens into Atlas; galaxy cockpit and its services remain GC3 |
| Campaign | Existing missions, bosses and narrative; a small set of located galaxy operations | Full location-based campaign mapping and broader travel battles remain GC4 |
| Civilization simulation | Population/resources/construction cycles and historical foundations exist | Crime, complex threats, quests, generations, Houses and interval catch-up are not a finished living world |

### Load-bearing source references

- `game/app/components/engine/galaxy/galaxyColony.ts`: access and projection boundary;
  `COLONY_CONTACTS` maps only `galaxy:ashfall-primary`; visits allow only credit and
  consumable changes.
- `game/app/components/engine/galaxy/galaxyRun.ts`: fresh run, initial outpost,
  `supply: 12`, and initial Ashfall/Kepler/picket operations.
- `game/app/components/engine/galaxy/authoredAnchors.ts` and `atlas.ts`: versioned
  authored anchors and deterministic generation.
- `game/app/components/engine/galaxy/travelResolver.ts`: journaled travel and recovery.
- `game/app/components/Game.tsx`: galaxy descent/projection wiring and legacy management entry.
- `game/app/components/colony/shared/colonyReducer.ts` and `cycleProcessor.ts`:
  functioning economy/construction plus explicit unfinished threat/quest/bounty work.
- `game/tests/browser/galaxyColony.spec.ts`: descent, landing pad, Atlas return,
  reload-to-Atlas, access refusal and pending-return recovery scenarios.
- `game/tests/colony/contactSystems.test.ts`: procedural systems contain placeholder
  worlds; a rendered planet is not proof of playable content.

## Integration inventory

- `30b0726` combines GC1 (`1be567e`) and ground/boarding cleanup (`c2991b3`).
- `feat/galaxy-colony` also contains the recent region, system and sector presentation work.
- Local `origin/main` is `9bf52a2` (PR #24 merge); this is a local remote-tracking
  observation, not a refreshed GitHub/deployment claim. The local `main` checkout is older.
- `feat/m3-marketplace-runtime` has six commits absent from this baseline, ending at
  `289f4eb`: design/plan, sprite registration and prop-width work. Treat this as salvage
  to inspect before restarting Marketplace, not a completed feature to merge blindly.
- A patch-equivalence scan of all local branches also found unmatched commits in
  `codex/c1-mission-presentation`, `feat/game-engine-conductor` and
  `fix/sync-launch-integration`. These overlap historical integration work and may be
  superseded. They are review candidates, not proof of missing features; do not merge
  them wholesale, especially where they refer to now-removed modes.
- Other scanned local branches, including the quartermaster motion pilot and graphics
  rollout, had no unmatched commits after ancestry/patch-equivalence checks. Their
  work is not an additional unintegrated feature backlog on this baseline.
- Several old worktrees are marked prunable. Inventory does not authorize deleting them.
- Pre-existing dirty work: `site/tsconfig.tsbuildinfo` and untracked `docs/research/`.
  Preserve both.

## Verification ledger

At initial inspection, the Colony agent's 2026-10-18 transcript reported a clean typecheck,
951 passing unit tests and a successful static export on the merged branch. Its full
110-test browser run was active in `/tmp/sz-merge-browser.log`. This assessment did not
start a competing build or test run.

The manager inspected the current GC1 browser screenshot and the older checked-in
Cantina screenshot. The current colony is a sparse first-person outpost with a visible
quartermaster; the Cantina image demonstrates existing art/runtime work but does not
prove the fresh galaxy run can enter a cantina.

This is source and artifact review, not a fresh human playthrough or production acceptance.
The manager subsequently read the final browser log: **110 passed (7.6m), EXIT=0**.
This closes the automated browser regression run on the merged baseline; human acceptance
of the complete future colony loop remains separate.

## Documentation drift to resolve

1. `docs/ROADMAP.md` still has a July update heading, six-mode completion language,
   and old G0/M3 status. It should become the concise current execution order again.
2. Older vision docs mention boarding/ground-run. Their fiction and ambition remain
   useful, but the October mode decision supersedes those mode lists.
3. GC1's initial reload criterion differs from its precise as-built section. Preserve
   the actual reload-to-Atlas contract unless exact-location persistence is separately scoped.
4. The untracked graphics research proposes a Babylon colony proof. Babylon is now
   present for the Atlas, but the colony still uses the first-person renderer. Atlas
   adoption does not establish a colony renderer migration decision.

## Recommended operating model

Codex Manager owns the roadmap, acceptance conditions, state boundaries, integration,
regression evidence and the next bounded assignment. Claude designers own scoped place
and aesthetic briefs: visual identity, layout, environmental storytelling, characters
and assets. Each implementation assignment names its files and does not independently
change persistence, economy, navigation or campaign rules.

Each milestone must name:

- the player-visible outcome;
- one accountable owner;
- dependencies and explicit exclusions;
- the fresh-save path used to demonstrate it;
- automated, visual and human acceptance evidence;
- remaining defects and the exact reason for any deferral.

No feature is finished solely because its code, assets, screenshots or branch exist.
Closure means the ordinary player can reach it, use it and retain its consequences.

### Integration guardrails

- Keep GC1's narrow shop/visit merge. GC2 should expose validated management commands,
  with explicit allowed changes and the current canonical save, rather than simply
  allowing an entire UI projection to overwrite colony state.
- Local time already advances for region surveys and POI expeditions
  (`region/siteEconomy.ts`, `region/poiDispatcher.ts`), and located operations declare
  cycle costs. Do not add a second tick on descent, takeoff or outcome presentation.
- A new regional outpost needs a colony/planet/contact relationship and a local access
  rule. It does not need an invented new star coordinate. Avoid granting free local
  travel by treating every colony at one stellar contact as the same location.
- Define which resources belong to the ship and which belong to a colony. Test the
  cost/reward/transfer path; avoid using extra starting resources as a substitute for
  a sustainable loop.
- Development locks and generation compatibility are different mechanisms. A new
  authored destination cannot silently replace a discovered cell in an existing save.

## Proposed execution sequence

This sequence records the initial recommendation, not a detailed implementation
specification. Nic subsequently selected Ashfall and parallel systems/place design;
the master roadmap and parallel brief supersede the sequential art-start implication. The existing GC labels remain useful for
traceability; they describe components of the player outcomes below.

| Increment | Accountable owner | Completion condition |
| --- | --- | --- |
| 0. Consolidate the baseline | Codex Manager | Record merged head, passing regression evidence, remaining branches and document authority. No implicit release |
| 1. Manage Ashfall in the galaxy (GC2 first slice) | Codex systems implementer, accepted by Manager | From a fresh galaxy run, reach Ashfall, open management from a real entry point, commission one supported building, earn its progress through an existing cycle-bearing action, see it complete, reload and re-enter with the same state; legacy state remains unchanged |
| 2. Close the useful colony loop | Codex systems implementer | One ordinary local operation yields a meaningful colony benefit; one reachable merchant/service has a galaxy-native unlock; leave and return preserves consequences; demonstrate a repeatable resource/supply path without developer seeds or duplicated rewards |
| 3. Accept Ashfall as a place | Claude designer for art/content; Codex Manager for integration; Nic for aesthetic acceptance | A bounded brief fixes Ashfall's visual identity, arrival landmark, useful room, recognizable NPC roles and visible response to one state change. Runtime captures and an ordinary playthrough demonstrate them. No general renderer replacement is bundled in |
| 4. Connect the captain's cockpit (GC3) | Codex systems implementer | Galaxy hub opens Atlas, colony management and only genuinely working services; return routes, current location and one clear next commitment are coherent; no accidental legacy progression reads |
| 5. Prove reuse with one next destination (first GC4 content slice) | Codex Manager plus scoped Claude designer | Locate one existing authored operation, preferably the already-adapted Kepler lead, in a distinct accepted place; travel/interruption, arrival, operation, failure/retreat and return work; destination kit preserves Ashfall and existing saves |
| 6. Introduce one living-world pressure | Codex systems implementer plus Claude presentation | One resource/absence-driven problem has a cause, visible warning, bounded progression, playable countermeasure and persistent recovery/scar. Establish this before the full decay/syndicate stack |

Steps 1–3 form the proposed first Ashfall lock. The smallest working colony outcome
comes before a complete armory, a new campaign, Marketplace, Town Hall or advanced
governance. The cockpit then makes that proven loop the game's ordinary home.

The first brief and implementation spec must resolve the exact merchant unlock,
resource recovery path, local colony access and first visible consequence. These are
bounded design decisions, not reasons to reopen the whole galaxy vision.

### Claude place brief and handback

A place assignment should contain: the place ID and fiction, the player's reason to
visit, arrival and exit, interactable landmarks, NPC roles, the state changes it must
show, asset dimensions/format, runtime consumers, fallback behavior and owned paths.
The designer can explore the aesthetic inside that boundary. The manager integrates
against the canonical game state and checks that every prominent affordance does
something real.

Handback includes editable sources, runtime assets, provenance, a small manifest,
screenshots at gameplay size and the exact player route. Approval of concept art does
not accept the runtime. A good-looking empty room remains unfinished.

### Later horizons, preserved rather than silently dropped

- Complete remaining hub types and a small located story spine; adapt existing
  missions before manufacturing many new ones.
- Extend the first pressure into slow decay, counterplay and emergent syndicates.
- Add non-combat progression and the Engineering/Piloting paths when supported by
  repeated useful actions.
- Prove multi-colony logistics and one absence/return interval before generations,
  autonomous political actors and the larger chronicle.
- Develop substantial civilization and Legacy eras before optional Fold systems.
- Retire the legacy experience only after the agreed parity and old-save policy are met.

Optional improvements include a true 3D colony proof, richer animation and additional
world variants. Each needs its own bounded acceptance decision; none substitutes for
the first complete colony loop.

## Proposed lock policy

There are two different locks:

1. **Development acceptance:** identity, visual language, geography, entry/exit rules,
   first playable loop and regression fixtures form a baseline future changes preserve.
2. **World continuity:** the seed, coordinate, IDs, discovered facts and causal history
   remain stable in a save. Buildings, people, control and culture can evolve.

A lock is not an immutable political/economic state. Nor does it permanently freeze
every texture. A later deliberate revision records its compatibility and acceptance impact.

Start a place as proposed, approve its brief, integrate it, validate it in play, then
mark it accepted. Keep one place in active production. Use the next destination to
prove reuse rather than copying bespoke code and opening many unfinished worlds.

## Roadmap choice resolved

Nic selected Ashfall first and explicitly requested parallel work with the existing
Colony agent and additional agents coordinated by Manager. Aesthetic, assets,
conversations, market and bartering may progress alongside systems. The resulting
[parallel brief](2026-10-18-ashfall-parallel-brief.md) and refreshed [master roadmap](../ROADMAP.md)
own the current assignments. The earlier sequential recommendation above is historical
reasoning: design preparation now starts in parallel with GC2. Runtime integration
still follows explicit dependencies. A specific aesthetic, barter mechanic, renderer
change, exact-location reload and release are not implicitly approved.

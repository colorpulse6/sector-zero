# Galaxy run as the game: hub, star map, travel battles, colony

Date: 2026-10-18. Status: direction agreed with Nic in chat (2026-10-18); GC1 ready to build.
Builds on `2026-07-16-continuous-galaxy-atlas-design.md` (authoritative for the galaxy run,
travel, operations and the save boundary) and `2026-04-20-colony-system-design.md` §A, §C
and §I (colony layers and the descend flow).

## Decisions (Nic, 2026-10-18)

1. **One structure.** Hub (the cockpit) → star map (Galaxy Atlas) → travel that takes time
   and can be interrupted by space battles (vertical shooter, turret) → the colony on top:
   descend to a planet to walk the colony in first person and manage it.
2. **The colony system is the future of the game, not legacy.** It moves onto the galaxy run.
3. **Campaign and colony are intertwined.** The campaign tells the player where they are in
   the galaxy. The player can travel farther; it takes time and battles and can be
   interrupted. (This is the atlas design's "story operations at physical locations".)
4. **Descend = walk the colony in first person, plus the management screens.**
5. **Modes.** Ground run-and-gun and ship boarding are removed (Cleanup agent, branch
   `codex/remove-ground-boarding`, plan `docs/superpowers/plans/2026-10-18-remove-ground-boarding.md`).
   Shooter, turret, first-person missions, the first-person colony and multi-phase stay.

## What exists today (verified in code, 2026-10-18)

| Piece | State |
|---|---|
| Galaxy run state | `GalaxyRunState` owns its own `colonies` and `planets`; a fresh run starts with Ashfall Primary (`galaxyRun.ts` `startingColoniesAndPlanets`). |
| Star map | Galaxy Atlas: GALAXY / SECTOR / SYSTEM / REGION, travel commitment, hostile-picket shooter interruption. |
| Region in the galaxy run | `openGalaxyRegion` builds a throwaway legacy-shaped projection of the run, runs the M1 region reducers on it and merges an allowlisted delta back (`operationAdapters.ts` `openAshfallProjection` / `mergeProjectedRegion`, `galaxyProjection.ts` `mergeProjectionIntoGalaxy`). |
| Colony walk | Legacy only: cockpit COLONIES → DESCEND TO COLONY → `createColonyExteriorLaunchState` → `colony-exploration` mode on the first-person engine. |
| Galaxy colony surfaces | Typed but not wired: `missionContext.ts` accepts galaxy colony launches returning to `galaxy-atlas`, `galaxy-colony-exterior` or `galaxy-landing-pad`; `Game.tsx` mount fails with "GALAXY COLONY RETURN IS NOT AVAILABLE". |
| Hub | Legacy only. A galaxy run opens straight into the Atlas; closing the Atlas returns to the experience selector. |

## Target loop

```
HUB (cockpit) ──STAR MAP──▶ GALAXY ATLAS ──commit travel──▶ in transit ──interruption?──▶ SPACE BATTLE
   ▲                            │                                   │                    (shooter / turret)
   │                            │ parked at a colony star           ▼                         │
   │                            ▼                                arrive ◀────────────────────┘
   └──── TAKE OFF ◀── COLONY (first person) ◀── DESCEND
                        ├── COLONY MANAGEMENT (planner, roster, stockpile)
                        └── REGION (sites, surveys, expeditions)
```

## Milestones

Each milestone gets its own short plan; GC1 is first.

### GC1 — Descend from the star map (build now)

- **Rule (pure, tested):** `galaxyColonyAccess(run, colonyId)` returns `full` only when the
  colony belongs to the run, its contact is visited, the vessel is stationary at that contact
  and no travel record is open (same rule as the region's full access). Otherwise
  `unavailable` with a short reason ("PARK AT ASHFALL TO DESCEND", "ARRIVE AT ASHFALL FIRST").
- **Entry points:** DESCEND TO COLONY in the Atlas target card (selected colony contact) and in
  the SYSTEM view next to OPEN REGION CHART when a colony planet is selected. Disabled with the
  reason when unavailable.
- **Runtime:** reuse the region pattern. Build the legacy-shaped projection of the run, launch
  `colony-exploration` from it with a galaxy launch context (authority `galaxy`, provenance
  `atlas`), and fold the visit's result back through `mergeProjectionIntoGalaxy` with only the
  fields a colony visit may change. Legacy progression stays byte-for-byte unchanged.
- **Exit:** the landing-pad menu's TAKE OFF returns to the Atlas (to the hub once GC3 lands).
  Region expeditions launched from the pad keep working.
- **Reload:** a save taken inside the galaxy colony remounts there instead of failing.
- **No cycle cost.** Descending to a colony you are parked at is not travel; the colony's
  in-world clock is presentational (colony spec §D).
- **Verify:** unit tests for the rule, projection and merge (including "legacy fields
  unchanged" and "unknown delta rejected"); browser spec: galaxy run → Atlas → DESCEND →
  walk → TAKE OFF → Atlas, plus reload inside the colony; tsc, suites, static build.

#### GC1 as built (2026-10-18)

- `engine/galaxy/galaxyColony.ts`: `galaxyColonyAccess`, `galaxyColonyAtContact`,
  `openGalaxyColony` (validated parent + disposable projection), `mergeGalaxyColonyVisit`
  (only `credits` and `consumableInventory` may differ from a fresh projection; anything else is
  `unauthorized_change`) and `applyGalaxyColonyPurchase`.
- `Game.tsx`: `createGalaxyColonyLaunchState` (pilot loadout from the projection, outcome attempt
  from the canonical galaxy save, return `galaxy-atlas`), `handleGalaxyDescend`, the colony step
  and shop drain run on the projection when the attempt's authority is galaxy, the landing-pad
  REGION MAP opens the galaxy region with re-derived access, and the `galaxy-colony-exterior` /
  `galaxy-landing-pad` mounts remount the walk instead of failing.
- `missionContext.ts`: galaxy colony launches also accept the `atlas` entry provenance (legacy
  colony launches are unchanged).
- **Reload, precisely.** A colony walk is not a saved location, in legacy or galaxy. Reloading
  inside the galaxy colony returns to the experience gate; CONTINUE GALAXY opens the Atlas with
  the save unchanged. The galaxy colony mounts are only used by pending return records that target
  them; no GC1 flow writes one yet.
- **Known gap (parked for GC2/GC3).** Every consumable unlocks on a legacy planet clear, and the
  projection has no completed planets, so the quartermaster refuses all consumables in a galaxy
  run. Ashfall Primary is an outpost with no cantina, so no galaxy purchase is reachable today.
  The purchase path is wired and unit-tested for when the run gets its own unlock rule.

### GC2 — Colony management in the galaxy run

The COLONIES management screens (planner, roster, stockpile, region chart, system map) run on
the galaxy projection and merge back like GC1. Entry from the Atlas target card, from the
landing pad, and from the hub (GC3). Building, commissioning and dispatch follow the existing
colony reducers and cycle rules.

### GC3 — The hub for the galaxy run

A galaxy run opens into the cockpit. STAR MAP opens the Atlas; COLONIES opens GC2; the
mission board lists located operations near the vessel; armory, pilot, codex and bestiary read
the galaxy namespace. Closing the Atlas returns to the hub. Hub surfaces that only make sense
for numbered progression stay hidden in a galaxy run.

### GC4 — Campaign spine and travel battles (needs its own brainstorm)

The authored campaign becomes story operations at physical locations; the hub and Atlas show
the current chapter and where it points. Travel interruptions draw shooter and turret battles
from the existing level content by route threat. Which levels map to which operations, and how
far "farther" travel reaches, are open design questions for Nic.

### GC5 — Retire the legacy experience

After GC1–GC4 reach parity, remove the experience selector's LEGACY CAMPAIGN path and the
numbered-world wrappers. Old saves follow the atlas design §14 (offer a clean galaxy run; never
silently blend histories).

## Coordination

- Cleanup (Codex agent "Cleanup", `gpt-6-astra`, Cerebro project Sector Zero) works in its own
  worktree. Its branch is reviewed and merged into `feat/galaxy-colony` before GC1 is merged.
- `Game.tsx` is shared: Cleanup only deletes ground/boarding branches; GC1 adds galaxy colony
  wiring. Conflicts are resolved on `feat/galaxy-colony`.
- Nothing is pushed or merged to `main` without Nic's explicit OK.

## Non-goals for GC1

No hub, no management screens, no new colonies, no colony founding from the Atlas, no cycle
cost for descending, no change to legacy colony behaviour.

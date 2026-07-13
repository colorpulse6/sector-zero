# Sector Zero — Master Roadmap

**Updated 2026-07-13** (Fable planning session — decisions recorded with the user).
This is the single entry point. Every other doc is either DONE, absorbed here, or linked
below with its authority noted.

## North star (DECIDED 2026-07-13)

**Systemic sandbox — Dwarf-Fortress-ward.** Depth over breadth: the colony/region sim is
the game; the campaign is the on-ramp and the source of ticks/resources. The 2026-04-20
colony spec's "Deep Sim future-proofing" (entity IDs everywhere, serializable everything)
is now the point, not an insurance policy. Prefer systems that generate stories over
authored content; authored content exists to seed systems.

## Decisions of record (2026-07-13)

1. **Stakes — "slow decay, emergent antagonists":** colonies never pop instantly; neglect
   starts a long decay arc (crime → starvation → mutation → monster infestation), and
   decayed colonies can birth **crime syndicates that become world actors** — forming
   raiding hordes that attack the player's fleet/missions and steal resources. Loss is
   real but telegraphed over many cycles, and every stage is counterable. (Absorbs and
   reshapes spec Phase 5b crime + Phase 8 threats — see M4.)
2. **Progression — one track, new XP sources:** keep pilot levels + skill tree; surveying,
   founding, trading, and quests grant XP; build the already-typed Engineering + Piloting
   trees (types.ts SkillTreeId has them; only COMBAT_TREE exists) around non-combat play.
3. **Slice order after PR #7:** OW-1 region map → DOOM asset regen (parallel track) →
   Phase 3 hub interiors. Crime lands inside M4's decay arc, not as a standalone 5b.
4. Cargo v1 abstract (physical holds later); travel costs a cycle; first colony gets
   warnings/protection while learning (from the stakes discussion + OW draft Q1/Q2).

## What is DONE (verified in code, 2026-07-13)

| Area | State |
|---|---|
| 6 game modes, campaign W1-W8, bosses, multi-phase levels | Live |
| Pilot leveling 1-30, COMBAT skill tree, reward economy stage 1, bestiary | Live |
| Colony phases 0/1/2: found/build/descend, FP colony exteriors+interiors | Live |
| Phase 5a NPCs: schedules, A*, dialog, real quartermaster shop | Live |
| Faction standing: ledger, prices, refusal, greetings, mission standing | Live |
| **OW-0 economy**: real habitat capacity+growth, buildable mine, planet-mission resource deliveries, GROWN/STRAINED dev seeds | PR #7 (CI green) |
| DOOM overhaul Phase 0: WebGL grade+bloom+presets+auto-disable; 65 sprites de-haloed | Live (deployed) |
| Animated NPC billboards + quartermaster (own sprite + 2-frame walk) | Live (deployed) |
| Asset pipeline: Codex image_gen + BiRefNet + style guide — proven on character, poses, wall texture | Operational, $0 |
| Ashfall explore zone + Kepler black-box sidequest | Live — these are the POI/quest-reward pattern precursors for M1 |

## The course

### M1 — OW-1/2: The Region (leave the base) — NEXT
Per-planet region node graph (Ashfall vertical slice) + region-map screen (React/DOM per
spec §I) + pad-gated travel that **costs a cycle** + `poiDispatcher` with 3 procgen POI
templates (fp ruin / boarding wreck / groundRun canyon — build on `ashfallForwardCamp.ts`'s
explore-zone shape and Kepler's one-time-reward pattern) + POI cargo → colony routing
(missionDelivery.ts already does routing) + **survey → found**: site stats from seed,
founding costs real resources (retire the free 500-metal grant), site stats modulate
production. Spec source: colony spec §F (929-1028) + OW draft §2-3. **Spec status: ready.**

### M2 — The Look (parallel track, asset-lane)
DOOM Phase 1-2 regen at scale via the proven pipeline, in visibility order: 13 shooter
enemies → 8 bosses → FP/boarding billboards (8-yaw via TRELLIS.2→headless Blender + the
engine yaw-selector enabler, spec 2026-07-05 §5.4) → hub interior tilesets/props (feeds
M3) → backgrounds. Style LoRA once ~30 accepted. Runs alongside M1 — different lane,
no file conflicts. **Spec status: ready** (pipeline doc + style guide).

### M3 — Phase 3: Hubs (places worth entering)
Cantina, Marketplace, Town Hall hand-authored interiors + interior NPCs w/ schedules +
faction dialog depth + **bulletin board v1**: procgen quests from the spec's §F Quest
types (typed, unused, waiting in colonyTypes.ts 454-466; cycleProcessor step8 stub
exists). Marketplace generalizes `marketContext`. **Spec status: ready** (colony spec
Phase 3 + §F).

### M4 — The Decay Arc & Emergent Antagonists (NEEDS SPEC — biggest new design)
The user's stakes decision, formalized. Colony health drives a staged arc over many cycles:
1. **Crime** (absorbs old 5b: witnesses, bounties, guards, silencing) —
   reducer stubs exist (`npcKilled`/`witnessed`, step9_bountyDecay).
2. **Starvation/unrest** (consumption sim already runs as of OW-0).
3. **Mutation/infestation** — monsters seed in decayed districts; FP fights inside your
   own colony; biome-flavored.
4. **Syndicate genesis** — a collapsed/criminal colony births a syndicate ENTITY that
   acts on the world: claims POIs, raids other colonies, **intercepts your mission
   rewards/fleet (turret/escort engine reuse from spec Phase 7b), steals stockpiles**.
   Counterplay at every stage (guards/barracks, defense missions, raid their POI base).
Absorbs spec Phases 5b + 8 and the interception half of 7b. **Spec status: TO WRITE —
this is the first candidate for a dedicated design doc + plan.**

### M5 — RPG legs
Non-combat XP sources wired (survey/found/trade/quest); Engineering + Piloting skill
trees built (specced in 2026-04-05 plans, unbuilt); reward-economy Stage 2 (ships/Hangar)
when it earns its place; levels 31-50 later. **Spec status: ready** (2026-04-05 docs).

### M6 — Milestone D (galaxy scale) — horizon
Multi-colony (cap 4) + galaxy map, campaign buffs from colony roster, emergent missions,
Colony Planner React dashboard end-state (spec §I mockup), authored questlines. Sequenced
after the sandbox core proves fun. **Spec status: ready in colony spec, sequence later.**

## Doc authority map

- **This file** — course + decisions. Start here.
- `superpowers/specs/2026-04-20-colony-system-design.md` — authoritative colony systems
  reference (data model, §F quests, §I UX, phase details). Its phase *ordering* is
  superseded by this roadmap; `docs/game/colony-system-design.md` is an older draft it
  supersedes.
- `superpowers/specs/2026-07-13-open-world-colony-design-draft.md` — OW loop design; its
  5 open questions are ANSWERED (see Decisions above).
- `assets/2026-07-12-asset-pipeline-free-options.md` + `assets/prompts/doom/` — asset
  manufacturing. Supersedes the paid legs of the 2026-07-05 overhaul spec §5.4.
- `specs/2026-04-05-sector-zero-expansion-design.md` + 2026-04-05 plans — progression/
  economy reference; unbuilt remainders absorbed into M5.
- `audits/2026-07-12-full-game-audit.md` — deferred PERF/POLISH backlog (pull from it
  during any nearby work).

## Execution model

Specs written decision-complete while Fable access lasts (M4's decay-arc spec is the
priority); implementation runs subagent-driven per slice with independent gate
verification (`tsc` + colony/engine/sprites tests + build + prod-build browser smoke) —
the pattern that shipped everything above.

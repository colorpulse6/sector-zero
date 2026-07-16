# Sector Zero — Master Roadmap

**Updated 2026-07-16** (continuous-galaxy reframe and G0 Atlas inserted).
This is the single entry point. Every other doc is either DONE, absorbed here, or linked
below with its authority noted.

## North star (DECIDED 2026-07-13)

**Systemic sandbox — Dwarf-Fortress-ward.** Depth over breadth. The simulation creates
campaigns; playable campaigns reshape the simulation. Colony, region, travel, combat,
exploration, politics, and history are reciprocal layers rather than separate games.
The 2026-04-20 colony spec's "Deep Sim future-proofing" (entity IDs everywhere,
serializable everything) is now the point, not an insurance policy. Prefer systems that
generate stories; authored content seeds places, people, mysteries, and consequences.

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

## Decisions of record (2026-07-16 — continuous galaxy)

1. **Numbered worlds are retired from the new progression model.** Current W1–W8
   missions, bosses, side quests, planet sorties, and special missions remain valuable
   authored content, but migrate into named operations attached to physical locations.
2. **The galaxy is continuous projected space, not a node ladder.** The Atlas supports
   galaxy, sector, system, and planetary-region zoom. Players may follow known signals
   or plot blind expeditions to arbitrary coordinates.
3. **Generate detail through contact.** Seeded spatial cells make coordinates stable;
   distant space remains coarse until observation, travel, ownership, or causality
   requires deeper simulation.
4. **Progression comes from unified operations.** Story pressure, contracts, battles,
   colony needs, exploration, and reliable work use one located operation contract and
   can yield material, knowledge, access, power, or historical consequences.
5. **G0 Atlas moves ahead of M3–M5.** The minimal coordinate, signal, operation, route,
   and travel substrate lands before hubs and decay build more dependencies on numeric
   world IDs. M2 art continues in parallel.
6. **The canonical galaxy starts fresh.** Development-era numbered-progression saves do
   not fabricate galactic history. A later importer may preserve harmless Codex,
   Bestiary, or cosmetic accomplishments.

## What is DONE (verified in code, 2026-07-16)

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
| **M1 The Region**: Ashfall seeded graph, DOM map, intel, travel, POIs, cargo, survey/found, site economy | Live (PR #9) |
| **M2 first shooter tranche**: Swarm, Bomber, Gunner, Drone regeneration + matched review evidence | Live (PR #12) |

## The course

### M1 — OW-1/2: The Region (leave the base) — DONE
Ashfall proves the small-scale pattern the Atlas will extend: a seeded deterministic
graph, progressive intel, React/DOM selection, cycle-cost travel, multi-mode POIs,
cargo routing, surveying, resource-cost founding, and site-modulated economy.

### M2 — The Look (parallel track, asset-lane)
DOOM Phase 1-2 regen at scale via the proven pipeline, in visibility order: 13 shooter
enemies → 8 bosses → FP/boarding billboards (8-yaw via TRELLIS.2→headless Blender + the
engine yaw-selector enabler, spec 2026-07-05 §5.4) → hub interior tilesets/props (feeds
M3) → backgrounds. Style LoRA once ~30 accepted. Runs alongside systemic work —
different lane, no file conflicts. **Spec status: ready** (pipeline doc + style guide).

### G0 — The Atlas (continuous-galaxy substrate) — NEXT SYSTEMIC SLICE
Fresh canonical galaxy run + persistent vessel coordinate + continuous local-sector map
with galaxy/sector/system/region zoom model + seeded spatial cells + known signals and
blind-coordinate plotting + atlas knowledge/confidence + pure route preview + abstract
supply/time commitment + bounded caused interruption + unified located operations.
Prove the loop with Ashfall, Kepler, one shooter interception, one unresolved signal,
and one deterministic blind discovery. Hybrid UI: Canvas 2D spatial field with
focusable React/DOM controls and route panels. **Spec status: approved design in
`2026-07-16-continuous-galaxy-atlas-design.md`; implementation plan next after review.**

### M3 — Phase 3: Hubs (places worth entering, now located)
Cantina, Marketplace, Town Hall hand-authored interiors + interior NPCs w/ schedules +
faction dialog depth + **bulletin board v1**: operations from the spec's §F Quest
types (typed, unused, waiting in colonyTypes.ts 454-466; cycleProcessor step8 stub
exists). Marketplace generalizes `marketContext`. **Spec status: ready** (colony spec
Phase 3 + §F).

### M4 — The Decay Arc & Emergent Antagonists
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
Absorbs spec Phases 5b + 8 and the interception half of 7b. Syndicates and crises create
located Atlas operations rather than abstract mission-menu entries. **Spec status:
approved in `2026-07-13-decay-arc-emergent-antagonists-design.md`; plan after G0/M3
foundations are ready.**

### M5 — RPG legs
Non-combat XP sources wired (survey/found/trade/quest); Engineering + Piloting skill
trees built (specced in 2026-04-05 plans, unbuilt); reward-economy Stage 2 (ships/Hangar)
when it earns its place; levels 31-50 later. **Spec status: ready** (2026-04-05 docs).

### M6 — The Living Galaxy expands — horizon
Multi-colony comparison + coarse distant simulation + strategic actors + campaign
records + broader frontier reach + Colony Planner/governance dashboard. The Atlas and
persistent current location already exist from G0; M6 deepens their scale instead of
introducing the first galaxy map. **Spec status: skeleton approved; focused specs later.**

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
- `superpowers/specs/2026-07-14-living-galaxy-vision-design.md` — approved long-horizon
  direction for generations, Great Houses, galactic time, Fold eras, and world
  continuity.
- `superpowers/specs/2026-07-15-civilization-frontier-design.md` — approved skeleton for
  political authority, autonomous colonies, recontact/exile, bounded governor
  decisions, and the continuing logistics frontier.
- `superpowers/specs/2026-07-16-continuous-galaxy-atlas-design.md` — authoritative
  replacement for numbered world progression: continuous coordinates, hierarchical
  Atlas, unified operations, travel commitment, simulation fidelity, and G0 scope.

## Execution model

Specs are written and independently reviewed before implementation. Implementation runs
subagent-driven per slice with independent gate verification (`tsc` +
colony/engine/sprites tests + build + prod-build browser smoke) —
the pattern that shipped everything above.

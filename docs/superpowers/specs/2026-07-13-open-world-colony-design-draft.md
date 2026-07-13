# Open-World Colony Layer — Design Draft (FOR DISCUSSION)

**Date:** 2026-07-13 · **Status:** DRAFT — brainstorm-level, awaiting user reactions
**Prompt:** "Leaving colony bases to explore the planet? Choosing areas for new outposts
gated by appropriate resources? I'm open to ideas."

---

## 0. The ground truth this must build on (audited 2026-07-13)

A file-level trace of the missions↔colony wiring found that **the two economies are not
connected today**:

- Missions award **global** credits/XP/materials + faction standing. **No mission ever
  deposits anything into a colony.** Mission completions only serve as the "cycle tick"
  that advances construction and farm/water production.
- Colony resources come from exactly one place: a **free 500-metal founding grant**.
  Founding costs nothing. The four buildable buildings consume 400 of the 500.
- The sim is inert past that point: **habitat never raises population capacity** (it's a
  display string; capacity is permanently 0), so consumption/happiness never move; the
  **mine isn't in the build menu**, so metal is non-renewable; colony credits, shipments,
  POI rewards, and quest→colony routing are all typed but dead (Phase 7a unbuilt).

**Implication:** "outposts gated by resources" is meaningless until resources are actually
earned and scarce. The open world and the economy have to land together — the world is
*where* resources come from; the colony is *why* you want them. That's the design spine.

## 1. The fantasy (north star)

> You land at your colony, walk out the gate, and the planet is *there* — a region of
> named places: a canyon mine flagged by your survey drone, a derelict comms relay
> crawling with Hollow, a flat basin your quartermaster says could hold an outpost if you
> can feed it. You clear the relay (FP), strip its ore (loot → shipped to your colony),
> survey the basin (site stats: water table, ore veins, defensibility), and commission
> Outpost Bravo — which costs real metal your colony must produce or you must haul.
> Two missions later its habitat is up, colonists arrive, and the Ashfall Camp faction
> likes you a little more.

## 2. Structure: node-graph region, not seamless terrain (recommendation)

Two candidate shapes for "leaving the base":

- **(A) Seamless walkable planet** — continuous raycaster terrain between sites.
  Rejected: the raycaster is a grid-cell engine; kilometers of empty grid is dead air to
  author and dead time to play, and it fights the game's mission-loop DNA.
- **(B) Region node-graph with rich FP zones (RECOMMENDED)** — exactly the committed
  spec's Phase 4: `regionMap.ts` per-planet node graphs + `poiDispatcher.ts` + ~10 procgen
  POI templates (fp / boarding / groundRun). Each node is a *dense* explorable place
  (the Ashfall scrapyard EXPLORE zone is the existing proof); edges are travel. On-foot
  feel comes from making each zone worth walking, not from walking between zones.

Travel presentation: leaving the colony gate (or landing pad menu) opens the **region
map** — a planet-surface chart in the DOOM HUD style, nodes with intel states (unknown →
rumored → surveyed → cleared/claimed). Early game: pad-gated travel (spec). Later
(spec Phase 6): fast-travel anywhere via `[F]`.

## 3. The loop that ties it together (the new part)

**Explore → Extract → Ship → Build → Unlock deeper region.**

1. **POIs yield colony resources.** Clearing a mine POI yields metal *as cargo*; a
   ruined hydro plant yields water tech; wrecks yield salvage. Cargo must be **routed to
   a colony** (choose destination on the outcome screen — this is the missing
   missions→colony wire, a deliberately-small slice of spec Phase 7a).
2. **Survey before you build.** A `survey` action at candidate nodes reveals site stats
   (ore density, water table, buildable slots, threat level) — rolled from the planet
   seed, so sites are *different* and choosing matters.
3. **Founding costs resources** (replaces the free 500-metal grant): e.g. 300 metal +
   50 food + 50 water, drawn from a source colony or hauled cargo. Site stats modulate
   the colony: high ore density → mine slots produce more; low water table → purifier
   upkeep higher. **This is the "gated by appropriate resources" ask, made concrete.**
4. **Colonies become logistics nodes.** Outposts feed the mothership colony (or each
   other) — the spec's spaceport transfers land later (7b); v1 is manual haulage as cargo.
5. **Factions/threats give the region teeth**: standing gates certain nodes (Hostile =
   bounty hunters camp your pad — 5b), Hollow presence makes cheap sites dangerous.

## 4. Sequenced plan (each step ships playable)

| Step | Scope | Size |
|---|---|---|
| **OW-0: Make the economy real** | Habitat raises capacity; mine buildable; mission-complete screen gains a "deliver to colony" picker (metal/food/water payloads per mission type). Kills the dead-sim problems the audit found. | S–M |
| **OW-1: Region map v1** | `regionMap.ts` node graph per planet (seeded), region-map screen (canvas, HUD style), pad-gated travel, 3 POI templates (fp ruin, boarding wreck, groundRun canyon) via `poiDispatcher.ts`, POI outcome → cargo → destination colony. Acceptance = spec Phase 4's. | L |
| **OW-2: Survey & found** | Survey action + site stats from seed; founding UI at surveyed sites; founding costs resources; site stats modulate production/upkeep. Free-grant path removed. | M |
| **OW-3: Living region** | Standing-gated nodes, guard/bounty presence (5b tie-in), Hollow threat levels, node respawn/decay cycles, ambient region events. | M–L |

Animated NPCs (in flight) slot anywhere; 5b (crime) pairs naturally with OW-3.

## 5. Open questions for the user

1. **Travel cost:** should node travel consume a cycle (mission tick) — making distance a
   real economic choice — or be free early?
2. **Cargo model:** abstract ("+120 metal routed to Ashfall Prime") or physical (limited
   hold, choose what to leave behind)? Physical is more RPG, more UI.
3. **Failure states:** can an underfed outpost collapse (spec has full collapse rules) —
   roguelike stakes — or should v1 outposts only stagnate?
4. **How many planets** get regions in v1? (Recommend: Ashfall only, as the vertical slice.)
5. Does OW-0's "deliver to colony" picker appear on *every* mission completion, or only
   planet/POI missions? (Recommend: planet + POI only; campaign levels stay pure arcade.)

# Sector Zero Expansion: Multi-Mode Campaign & RPG Systems

**Date:** 2026-04-05
**Status:** Design approved, ready for planning
**Scope:** Major expansion across gameplay, economy, progression, and strategy systems

---

## Executive Summary

This spec designs a multi-system expansion of Sector Zero that transforms it from a single-mode vertical shooter into a multi-genre campaign with meaningful strategic depth. Five interlocking systems are introduced progressively:

1. **Multi-Phase Levels** — levels chain different gameplay modes via hard transitions
2. **Five New Gameplay Modes** — ground run-and-gun, boarding, turret, base defense, mech duel
3. **Progressive Reward Economy** — 4 staged layers (tiers → ships → loadouts → consumables)
4. **Pilot Leveling System** — RPG-style account-wide progression with stats + skill trees
5. **Weapon Affinity & Enemy Classes** — strategic loadout depth with visible feedback and a bestiary

All existing content (40 main-campaign levels, 10 planet missions) remains playable unchanged. New systems extend rather than replace.

---

## Design Philosophy

- **Preserve what exists.** Current levels and missions remain intact. New content extends outward.
- **Every material matters.** Loot that sits unused in inventory is failure. Every reward should inform strategy.
- **Modes are earned.** New modes unlock narratively through mission transitions or side quests, not as menu options.
- **Visible strategy.** Affinity system uses on-screen feedback (CRITICAL/RESISTED tags) so learning is never obscure.
- **Scalable complexity.** Delivered in phases. Each phase is independently playable and shippable.
- **Player power grows, difficulty stays fixed.** Enemies do not scale with pilot level — leveling should always *feel* good.

---

## System 1: Multi-Phase Level Architecture

### Concept

A level is no longer a single gameplay scene. It is a sequence of 1-N **phases**, each a distinct gameplay mode. Most existing levels remain single-phase. New content introduces multi-phase structure.

### HP & Loadout Translation Across Modes

Each mode has its own HP scale, but shares a **single normalized HP pool** expressed as a 0-1 fraction. When transitioning phases, HP is translated via fraction:

- Shooter mode: 3 HP baseline (matches existing)
- Ground Run-and-Gun: 3 HP baseline (infantry)
- Boarding: 3 HP baseline (infantry)
- Ship Turret: shared with dropship (3 HP baseline)
- Base Defense: shared with fortress core (separate large HP pool — see Mode 4)
- Mech Duel: 5 HP baseline (mech chassis is tankier)

Pilot HP bonuses (+1 per 10 levels) apply to whichever baseline is active.

**Loadout translation:** The player's equipped primary weapon *type* (Kinetic/Energy/Incendiary/Cryogenic) carries across modes. Mode-specific weapon sprites represent the same type (e.g., a Cryogenic ship cannon becomes a Cryogenic infantry rifle in Ground mode). Weapon level carries over as a damage multiplier. Secondary systems and consumables are mode-gated (some won't apply — e.g., no bombs in Boarding; the spec will define per-mode loadout compatibility during implementation planning).

### Phase Transitions

- Phase completes on win condition (clear waves, defeat boss, reach objective, survive timer)
- **Hard transition:** dialog line + fade-to-black + cinematic card ("DESCENDING TO SURFACE" / "BOARDING DERELICT VESSEL") → next phase loads fresh
- **Player state persists across phases:** HP carries over (not restored between phases), weapon level carries over, lives carry over without replenishment
- **On phase failure:** by default, retry restarts from the failed phase's entry state (HP, weapon level, lives snapshot taken at phase start — a mid-level checkpoint). Consumables used during the failed run are NOT refunded.
- **Mid-level checkpoints are IN MVP.** Each phase boundary is a checkpoint: if you die in Phase 3, you retry Phase 3 from its entry state (not restart the whole level).
- **Hard retry (restart from Phase 1)** is available as an optional menu action if the player wants to redo the whole level (e.g., for better rewards / combo runs).

### Data Model

```typescript
interface Level {
  id: string;
  name: string;
  briefing: string;
  phases: Phase[];
}

interface Phase {
  mode: GameMode;
  config: ModeConfig;           // mode-specific: waves, terrain, boss, etc.
  transitionIn?: TransitionSequence;  // dialog + card BEFORE this phase
  winCondition: WinCondition;
}

type GameMode =
  | "shooter"       // existing vertical shooter
  | "ground-run"    // new: Contra-style side-scroller
  | "boarding"      // new: top-down ship interior
  | "turret"        // new: Star Wars gunner
  | "base-defense"  // new: anti-aircraft fortress
  | "mech-duel";    // new: 1v1 heavy combat
```

### Where Phases Are Used

- **Main campaign levels:** Most stay single-phase. Select levels (boss levels + 1 mid-world level per world) gain optional Phase 2 unlocking rare loot.
- **Planet missions:** Existing 10 planets keep their Phase 1 (current shooter). Some gain Phase 2 additions over time.
- **New side quests:** Designed from scratch as multi-phase (e.g., "Raid the Havoc Dreadnought" = Shooter approach → Turret run → Boarding interior).
- **Optional branches:** Mid-phase dialog prompts ("Descend to surface? [Y/N]") offer skippable bonus phases with rare rewards.

---

## System 2: Five New Gameplay Modes

All modes share the same damage system, affinity system, and HP pool. Loadout strategy translates across modes.

### Mode 1: Ground Run-and-Gun

| Attribute | Value |
|-----------|-------|
| View | Side-scrolling, gravity |
| Controls | Left/right move, jump, 8-direction aim, shoot, crouch |
| Player | Infantry sprite (Vanguard crew member), 3 HP |
| Enemies | Ground infantry, turrets, drop-pods, crawlers |
| Terrain | Platforms, walls, cover, destructibles, vertical climbs |
| Win | Reach stage end OR defeat boss |
| Fail | HP depleted OR fall into pit |

**Feel:** Run forward, slide into cover, pop out, fire, leap platforms. High-kinetic but tactical.

### Mode 2: Ship Boarding

| Attribute | Value |
|-----------|-------|
| View | Top-down, tile-based rooms |
| Controls | 8-directional movement, aim, fire, roll/dash |
| Player | Same infantry sprite as Mode 1 |
| Enemies | Close-quarters infantry, doorway ambushers, turrets |
| Terrain | Corridors, rooms, locked doors, keys, vents |
| Win | Reach objective room (data core, hostage, self-destruct) |
| Fail | HP depleted |

**Feel:** Tense, methodical, corner-peeking. Darker, slower than run-and-gun.

### Mode 3: Ship Turret (Star Wars Gunner)

| Attribute | Value |
|-----------|-------|
| View | Pseudo-3D over-the-shoulder |
| Controls | 2D crosshair aim, fire, alt-fire |
| Player | Stationary gunner on racing dropship |
| Enemies | Swooping fighters in formations, kamikaze drones, gunships |
| Terrain | Auto-scrolling through canyons, cities, asteroid fields |
| Win | Survive run / meet kill-count target |
| Fail | Dropship HP depleted |

**Feel:** Fast, spectacular, cinematic. Low movement, high tracking.

### Mode 4: Ground Base Defense

| Attribute | Value |
|-----------|-------|
| View | 3rd-person fixed camera on fortress walls |
| Controls | Swivel turret, fire, switch weapon, call resupply |
| Player | Stationary AA battery |
| Enemies | Waves of aircraft, ground troops, siege mechs |
| Terrain | Fortress walls with HP (damageable, collapsible) |
| Win | Survive N waves / protect fortress core |
| Fail | Fortress core HP depleted |

**Feel:** Tactical, slower pacing, target prioritization, resource management.

### Mode 5: Mech Duel

| Attribute | Value |
|-----------|-------|
| View | Side-view or 3/4 arena |
| Controls | Slow heavy move, boost, light/heavy attack, shield, lock-on |
| Player | Mech chassis (unlocked at Pilot Lv 40) |
| Enemies | Single boss-tier mech, multi-phase pattern fight |
| Terrain | Arena with destructible cover |
| Win | Defeat opposing mech |
| Fail | Mech HP depleted |

**Feel:** Weighty, patient, pattern-learning. **Used very sparingly** — fewer than once per world. Likely 2-3 total appearances across the entire expansion (climactic story beats only).

### Rollout Phases

- **MVP:** Ground Run-and-Gun only (most distinct from existing)
- **Expansion 1:** +Ship Boarding, +Ship Turret
- **Expansion 2:** +Ground Base Defense, +Mech Duel

---

## System 3: Reward Economy (Progressive Staging)

Four stages, each independently shippable. Stages stack additively.

### Stage 1: Deeper Upgrade Tiers

Extend existing 6 upgrades with **2 additional prestige tiers (Levels 4-5)**.

- Existing max levels preserved (backward compatible)
- Tiers 4-5 gated by **multiple rare materials + high credit costs + high XP thresholds**
- Tiers 4-5 grant meaningful power spikes:
  - Weapon Core Lv 5: start missions at Weapon Lv 5
  - Hull Plating Lv 5: +4 Max HP
  - Fire Control Lv 5: -4 frame fire delay
- Rare materials for tiers 4-5 drop **only from multi-phase missions and optional side phases**

### Stage 2: New Ships

Add a **Hangar** screen in the cockpit hub. Multiple ships ownable; one selected per mission.

**Ship classes:**

| Ship | Role | Stats | Unlock |
|------|------|-------|--------|
| Vanguard (starter) | Balanced | Current stats | Default |
| Interceptor | Fast glass cannon | -1 HP, +50% speed, +30% fire rate, narrow spread | Pilot Lv 5 + credits + materials |
| Gunship | Slow tank | +2 HP, -25% speed, wide spread, +50% bomb damage | Pilot Lv 15 + credits + materials |
| Scout | Utility recon | Med stats, reveals enemy affinities, +100% magnet range | Pilot Lv 25 + credits + materials |

**Upgrades are per-ship** (not shared). Each ship has independent upgrade trees.

**Design intent:** Per-ship upgrades create an intentional "commitment cost" — switching ships is a real investment. This prevents trivial swapping and makes ship choice meaningful. Pilot-level HP bonuses and skill-tree passives apply universally across ships to soften the re-grind.

### Stage 3: Modular Loadouts

Pre-mission **Loadout** screen. Equip:

- **Primary weapon** (Kinetic / Energy / Incendiary / Cryogenic) — 4-6 per type
- **Secondary system** (missiles, drones, mines, EMP)
- **Hull mod** (armor / speed / shield — 1 slot)
- **Consumable slots** (2-3 slots per ship)

Slot counts vary by ship (Interceptor: 2 consumable slots, Gunship: 3). Loadouts savable as presets. **Unlocks at Pilot Lv 10.**

**Note:** Consumable slots appear empty / disabled on the Loadout screen until Workshop unlocks at Lv 20. Between Lv 10–20, players can only equip primary/secondary/hull mods.

### Stage 4: Consumables (Workshop)

**Workshop** screen crafts single-use items from materials.

| Item | Effect |
|------|--------|
| Nuke | Clear screen, massive boss damage |
| Invincibility Field | 5s invulnerability |
| Auto-Turret | Deploys temporary ally turret |
| Emergency Repair | Restores HP mid-mission |
| EMP Pulse | Disables enemies 3s |
| Resonance Beacon | Reveals all affinities for mission |

Consumables equipped via Loadout screen. Consumed on use. **Unlocks at Pilot Lv 20.**

### Material Flow

| Tier | Source | Uses |
|------|--------|------|
| Credits | Kills, completion | Base upgrades, ships, weapons |
| XP | Kills, completion | Pilot level, gates upgrade tiers |
| Common materials | Existing (bio-fiber, cryo-alloy, etc.) | Tier 2-3 upgrades, basic consumables |
| Rare materials (4 new types) | Multi-phase missions | Tier 4-5 upgrades, ships, advanced consumables |
| Legendary materials (2 new types) | Boss rare drops + optional phases | Prestige weapons, mech chassis, final-tier consumables |

**Rare materials:** 4 distinct types (names TBD — one per dominant weapon affinity, roughly: kinetic-core, energy-cell, ember-shard, cryo-essence).
**Legendary materials:** 2 distinct types (names TBD — one campaign-boss-themed, one optional-phase-themed).
Drop rates deferred to balance pass.

---

## System 4: Pilot Leveling System (RPG Layer)

Account-wide progression layer, above ships and upgrades.

### Core Numbers

- **Levels 1-50** (soft cap, extendable)
- **XP sources:** all existing + first-mode-completion bonuses + side-phase clears + perfect-run bonuses
- **XP curve:** exponential — early levels ~1 mission each, late levels 5-8 missions

### What Each Level Grants

**Every level (passive, stacking):**
- +1% material drop rate
- +0.5% credit bonus
- +1 HP per 10 levels (Lv 50 = +5 baseline HP across all ships)

**Every 3 levels:** 1 skill point

**Milestone unlocks (levels are INITIAL TARGETS — subject to XP-curve balance pass):**

| Level | Unlock |
|-------|--------|
| 5 | Interceptor ship |
| 10 | Modular Loadouts |
| 15 | Gunship |
| 20 | Workshop / Consumables |
| 25 | Scout ship |
| 30 | Prestige weapon tier |
| 40 | Mech chassis |
| 50 | NG+ / Prestige mode (TBD — see Deferred Decisions) |

**XP sources clarified:**
- **First-mode-completion bonus:** one-time XP grant the first time the player completes a mission of each new mode type (Ground Run-and-Gun, Boarding, Turret, Base Defense, Mech Duel). Does not repeat.

### Three Skill Trees

Each tree has 5 regular nodes + 1 capstone (6 total nodes). Regular nodes cost 1 point each (5 per tree). Capstone costs 2 points and requires all 5 regular nodes in that tree filled first.

**Cost math:** Full tree = 5 × 1 + 2 = **7 points**. 50 levels × (1 point per 3 levels) = **16 points**. 16 points = one full tree (7) + one full tree (7) + 2 points into a third tree. Players fill 2 of 3 trees by Lv 50.

**Combat Tree (offensive)**
- Sharpshooter — +X% damage to weak points
- Overcharge — weapon power-ups last longer
- Berserker — +damage as HP decreases
- Glass Cannon — +damage, -HP
- Capstone: **Signature Weapon** — second primary slot

**Engineering Tree (survival/economy)**
- Scavenger — +material drop rate, rare drops boosted
- Efficient — reduced consumable crafting costs
- Reinforced — shield power-ups last longer
- Repair Drones — slow HP regen between waves
- Capstone: **Fabricator** — craft consumables mid-mission

**Piloting Tree (mobility/control)**
- Evasive — invincibility frames on dash
- Magnetized — massively extended magnet range
- Quick Reflexes — +fire rate
- Ace Pilot — tighter turns, improved handling
- Capstone: **Time Dilation** — slow-mo trigger on near-miss

**Respec:** Free (encourages experimentation).

### Integration With Other Systems

- Ships: pilot level gates access; ship stats remain per-ship
- Upgrades: existing ship upgrades untouched, pilot stats stack on top
- Loadouts: some skill nodes unlock extra slots / reduce costs
- Missions: higher-level content accessible at higher pilot levels

---

## System 5: Weapon Affinity & Enemy Classes

Strategic depth layer — makes loadout choices matter.

### Four Weapon Types

| Type | Color | Feel | Base Effect |
|------|-------|------|-------------|
| Kinetic | White/silver | Fast, high rate-of-fire, low per-shot | Balanced baseline |
| Energy | Cyan/blue | Piercing beams | Pierces multiple enemies |
| Incendiary | Orange/red | Slow high-damage | DoT burn on hit |
| Cryogenic | Light blue/white | Slowing, crowd control | Slows movement + fire rate |

### Affinity Multipliers

- **Effective:** 1.5× damage
- **Neutral:** 1.0× damage
- **Resisted:** 0.5× damage

### Visual Feedback

**On hit:**
- Effective: bright flash + floating "CRITICAL" text + louder sound
- Neutral: standard flash, normal sound
- Resisted: dim flash + floating "RESISTED" text + muted sound

**Pre-mission:** loadout screen shows planet's enemy affinity icons (only for enemies the player has already discovered in Bestiary).
**Scout ship passive:** displays affinity icon above every enemy's HP bar at all times, for all enemies (including undiscovered).
**Resonance Beacon consumable:** same effect as Scout passive for mission duration when activated.
**Bestiary:** always displays affinity for discovered enemies regardless of ship.

### Existing Weapon Migration

The current single player weapon (bullets at weapon levels 1-5) is retroactively assigned to the **Kinetic** type on save-data upgrade. Existing saves retain all progress; the weapon is visually unchanged, just tagged as Kinetic for the affinity system.

New weapons of the other 3 types (Energy, Incendiary, Cryogenic) unlock via missions/rewards post-MVP.

### Enemy Classes (Full Stat Profiles)

Each class has stats varying on 5 dimensions relative to baseline:

| Dimension | Range |
|-----------|-------|
| HP | 0.5× – 2.0× |
| Speed | 0.5× – 1.8× |
| Damage | 0.5× – 1.5× |
| Fire Rate | 0.6× – 1.6× |
| Score Value | 0.8× – 2.0× |

**Class identities (INITIAL TARGET values — subject to balance pass):**

| Class | HP | Speed | Damage | Fire | Score | Role |
|-------|----|----|-------|-----|-------|------|
| Armored | 2.0× | 0.6× | 1.5× | 0.7× | 1.8× | Tank — prioritize hard |
| Swarm | 0.5× | 1.6× | 0.5× | 1.4× | 0.9× | Numbers — crowd control needed |
| Bio-organic | 1.0× | 1.0× | 1.2× (DoT) | 1.0× | 1.1× | Sustained damage threat |
| Tech-drone | 0.9× | 1.4× | 1.0× | 1.5× | 1.0× | Fast chipper |
| Heavy mech | 1.8× | 0.5× | 1.4× | 0.6× | 1.7× | Siege-level threat |
| Elemental-fire | 1.0× | 1.2× | 1.3× | 1.1× | 1.2× | Aggressive DoT |
| Elemental-ice | 1.3× | 0.8× | 0.9× (slow) | 0.9× | 1.1× | Zone control |
| Elemental-cinder | 0.8× | 1.3× | 1.0× | 1.3× | 1.0× | Erratic |

### Planet Enemy Assignments

| Planet | Dominant Class | Effective vs | Resists |
|--------|---------------|--------------|---------|
| Verdania | Bio-organic | Incendiary | Cryogenic |
| Glaciem | Elemental-ice | Incendiary | Cryogenic, Kinetic |
| Pyraxis | Elemental-fire | Cryogenic | Incendiary |
| Ossuary | Armored | Energy | Kinetic |
| Abyssia | Bio-organic | Energy | Incendiary |
| Ashfall | Elemental-cinder | Cryogenic | Energy |
| Prismara | Tech-drone (crystal) | Kinetic | Energy |
| Genesis | Swarm | Incendiary | Kinetic |
| Luminos | Tech-drone | Energy | Kinetic |
| Bastion | Heavy mech | Kinetic (AP) | Energy |

**Each planet has 20-30% off-type enemies** — enforced per-level (each level's enemy roster is 70-80% dominant class + 20-30% alternate classes). No single weapon is ever a trivial answer. Optimal loadouts use 2+ weapon types.

### Bestiary

New cockpit hub screen. For each discovered enemy:

- Sprite + name
- Home planet + class
- Full stat block (HP / speed / damage / fire rate / score)
- Affinity profile (Effective / Neutral / Resisted per weapon type)
- Lore entry (1-2 sentences)
- Times killed counter

Enemies discovered on first kill. Accessible from cockpit hub alongside Codex. **Persistence:** Bestiary is account-wide (saved alongside pilot level, not per-ship). "Times killed" counter persists across all sessions. Does NOT reset on NG+ — discovery is permanent.

### Visual Implementation (Phase 1)

- **Sprites kept as-is.** No redesign yet.
- **Class tint overlay:** subtle colored multiply blend per class (red=armored, green=bio, cyan=tech, etc.)
- **Affinity indicator:** weapon-type icon next to enemy HP bar when hit, visible 2s after each hit

Full sprite redesign deferred — evaluated after playtesting.

---

## Save Data Migration

Existing saves use localStorage with a versioned schema. The expansion introduces significant new fields (pilot level, skill trees, bestiary, hangar, loadout presets, rare/legendary materials).

**Strategy:**
- Increment save schema version on first expansion load
- Run a **migration function** that reads old save → produces new save with defaults:
  - Pilot level = 1 (existing XP rolled into pilot level via XP curve)
  - Skill points = 0
  - Bestiary empty (enemies discovered on next kill)
  - Default ship: Vanguard
  - Existing weapon assigned Kinetic type
  - Empty loadout presets
  - Rare/legendary material inventories = 0
- Old saves are never deleted; migration is one-way (no downgrade path)
- Version mismatch beyond supported range → show "save too old / too new" dialog

Schema migration functions live in `save.ts` and are tested against fixture saves from each prior version.

## Engine Architecture: Shared Systems & Per-Mode Modules

The existing game is a single vertical-shooter renderer on HTML5 Canvas. Five new modes require engine expansion. To avoid a monolith, modes will share a common framework and isolate mode-specific logic.

**Shared systems (used by ALL modes):**
- Damage model (HP, affinity multipliers, damage calculation)
- Weapon type system (Kinetic/Energy/Incendiary/Cryogenic classification)
- Enemy class stat profiles
- Loadout state
- Pilot stats & skill tree effects
- Particle/explosion rendering
- Audio events
- Sprite loading/caching

**Per-mode modules (one per game mode):**
- Mode-specific update loop (physics, collision, AI, terrain)
- Mode-specific renderer (view, camera, HUD layout)
- Mode-specific input handlers
- Mode-specific enemy behaviors
- Mode-specific win/fail conditions

**New engine infrastructure required:**
- **Ground Run-and-Gun:** 2D platformer physics (gravity, ground collision, jumping, 8-dir aim). New `physics.ts` module.
- **Boarding:** tile-based rooms, simple A* or grid pathfinding for enemy AI, line-of-sight checks. New `tiles.ts` and `pathfinding.ts` modules.
- **Turret:** pseudo-3D perspective projection, rail scrolling. New `rail.ts` module.
- **Base Defense:** aimable turret pivot math, multi-wave scheduler with distinct enemy waves. Reuses existing wave system.
- **Mech Duel:** arena bounds, weighty physics, lock-on targeting. New `mechPhysics.ts` module.

**Engine work as MVP prerequisite:** The Ground Run-and-Gun mode alone requires a platformer physics module and side-scrolling camera. This is substantial infrastructure. MVP scope acknowledges this as the primary non-content development cost.

## Implementation Phasing

### MVP (Phase 0)

- Affinity system (4 weapon types, 3-tier damage multipliers, visual CRITICAL/RESISTED feedback)
- Enemy class stat profiles applied to existing enemies (HP/speed/damage/fire rate/score variance)
- Class tint overlays on existing sprites
- Bestiary screen
- Pilot leveling system (levels 1-30 initially, passive stats, 1 skill tree unlocked)
- One new mode: **Ground Run-and-Gun**
- One multi-phase level (existing planet mission gains Phase 2)
- Stage 1 rewards: upgrade tiers 4-5

### Expansion 1

- Modes: Ship Boarding, Ship Turret
- Pilot levels 30-50, all 3 skill trees
- Stage 2 rewards: Interceptor + Gunship ships, Hangar screen
- Stage 3 rewards: Modular Loadouts (+Loadout screen)
- More multi-phase content

### Expansion 2

- Modes: Ground Base Defense, Mech Duel
- Stage 2 rewards: Scout ship
- Stage 4 rewards: Consumables (+Workshop screen)
- Mech chassis unlock at Lv 40
- Multi-phase content across remaining planets

### Expansion 3 (future)

- Full enemy sprite redesign (if needed from playtest)
- Additional weapons per type
- NG+ / Prestige mode at Lv 50
- New side quest planet missions using mode combinations

---

## Success Criteria

- **Variety:** Player encounters at least 2 different gameplay modes within first 5 hours
- **Strategy:** 80%+ of players engage with affinity system (measurable via loadout weapon type distribution)
- **Progression:** Pilot leveling feels constant — never more than 2 missions without a level/unlock milestone
- **Rewards:** Every collected material has at least one clear use-case the player can identify
- **Scope:** MVP ships independently and is enjoyable without Expansion 1+ content

---

## Open Questions / Deferred Decisions

- **Enemy sprite redesign:** Intentionally kept minimal — tint/overlay system only for foreseeable future. Full redesign only if playtest strongly demands.
- **NG+ design:** What changes on prestige — stats reset but skills retained? Different enemy classes? Skill-tree re-selection? Deferred until MVP ships.
- **Balance specifics:** Numeric values (XP curve, material drop rates, upgrade costs, damage numbers) marked as initial targets throughout. Dedicated balance pass follows MVP playtesting.
- **Mode-specific loadout compatibility:** Per-mode weapon/consumable applicability rules defined during implementation (e.g., bombs in Ground Run-and-Gun = grenades? N/A?).

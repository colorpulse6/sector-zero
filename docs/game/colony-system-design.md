# Sector Zero: Colony Management System Design

**Date:** 2026-04-07
**Status:** Design approved, ready for planning
**Scope:** Major expansion — colony building, resource economy, population management, defense, Earth supply lines

---

## Executive Summary

A colony management layer that transforms Sector Zero from a mission-based shooter into a space exploration + civilization-building game. Players discover locations during missions, found settlements (Outpost, Colony, or Stronghold), manage resources and population, defend against attacks, and build toward self-sufficiency — all while pushing through the campaign.

The system integrates with every existing gameplay mode: resources are earned from missions, colonies can be visited in first-person, defense missions use the turret/ground-run modes, and the colony economy feeds back into ship upgrades and campaign progression.

---

## Design Philosophy

- **Colonies are a reward, not a chore.** Setup requires thought, but once self-sufficient they mostly run themselves.
- **Disruption keeps you engaged.** Attacks and disasters periodically require attention, even for established colonies.
- **Neglect has consequences.** Extended absence degrades colonies, but not instantly — there's always time to recover.
- **Build big, manage big.** Small outposts are low-maintenance. Thriving cities demand attention. Complexity scales with ambition.
- **Extensible for the future.** Data model supports quests, NPC spawning, procedurally generated planets, story arcs, and emergent gameplay.

---

## System 1: Colony Resources

### New Resource Types

| Resource | Description | Sources | Consumption |
|----------|-------------|---------|-------------|
| **Food** | Feeds population | Farms, mission loot, Earth shipments | 1 per colonist per cycle |
| **Metal** | Construction material | Mines, mission loot, salvage | Building construction + repair |
| **Power** | Operates buildings | Solar arrays, generators | Each building requires power to function |
| **Water** | Basic survival need | Purifiers, wells, ice extraction | 0.5 per colonist per cycle |

### Existing Resources (unchanged)

| Resource | Use |
|----------|-----|
| Credits | Universal currency — buys colony resources, funds shipments, purchases upgrades |
| Combat materials (kinetic-core, etc.) | Ship upgrades only — NOT used for colony building |
| XP | Pilot leveling only |

### Resource Flow

- **Missions** award colony resources as loot (alongside credits/XP/materials)
- **Colony buildings** produce resources per cycle (1 cycle = 1 completed mission)
- **Colonies consume** resources per cycle (population eats, buildings use power)
- **Net positive** = colony grows and stockpiles surplus
- **Net negative** = colony degrades over time
- Player can **manually allocate** surplus between colonies (requires Spaceport buildings)
- Colonies can run in **passive/auto mode** — resources drain automatically — or **manual allocation** mode

---

## System 2: Colony Types & Buildings

### Three Founding Types

Each type determines starting buildings and a permanent passive bonus. After founding, you can build ANY building regardless of type.

| Type | Founding Cost | Starting Buildings | Passive Bonus | Best For |
|------|-------------|-------------------|---------------|----------|
| **Outpost** | 200 Metal, 50 Power | Landing Pad, Storage Depot | +20% resource extraction | Resource harvesting, forward supply |
| **Colony** | 300 Metal, 100 Food, 100 Water | Landing Pad, Habitat Module, Farm | +20% population growth | Civilian growth, self-sufficiency |
| **Stronghold** | 500 Metal, 100 Power | Landing Pad, Barracks, Turret Defense | +30% defense, mission bonuses nearby | Military defense, protecting other colonies |

### Building Categories

#### Survival (required for self-sufficiency)

| Building | Cost | Build Time | Upkeep/cycle | Output/cycle |
|----------|------|-----------|-------------|-------------|
| Farm | 100 Metal, 20 Power | 2 missions | 5 Water, 2 Power | 15 Food |
| Water Purifier | 120 Metal, 30 Power | 2 missions | 3 Power | 12 Water |
| Solar Array | 80 Metal | 1 mission | None | 10 Power |
| Mine | 150 Metal, 20 Power | 3 missions | 3 Power | 10 Metal |

#### Civilian (population & growth)

| Building | Cost | Build Time | Upkeep/cycle | Effect |
|----------|------|-----------|-------------|--------|
| Habitat Module | 100 Metal, 10 Power | 1 mission | 2 Power | Houses 10 colonists |
| Med Bay | 200 Metal, 50 Power | 3 missions | 5 Power | +10% happiness, reduces death rate |
| Comms Tower | 150 Metal, 40 Power | 2 missions | 3 Power | Enables Earth shipments, -1 mission delivery time |
| Marketplace | 180 Metal, 30 Power | 2 missions | 2 Power | Generates credits/cycle from population |

#### Military (defense)

| Building | Cost | Build Time | Upkeep/cycle | Effect |
|----------|------|-----------|-------------|--------|
| Barracks | 200 Metal, 40 Power | 2 missions | 5 Power, 3 Food | Trains militia, +15% defense, +5% happiness |
| Turret Defense | 250 Metal, 60 Power | 3 missions | 4 Power | Auto-defense during attacks, major damage reduction |
| Shield Generator | 400 Metal, 100 Power | 4 missions | 8 Power | Absorbs first wave of attack damage |
| Radar Array | 180 Metal, 50 Power | 2 missions | 3 Power | Warns of attacks 1 mission early |

#### Advanced (late-game)

| Building | Cost | Build Time | Upkeep/cycle | Effect |
|----------|------|-----------|-------------|--------|
| Refinery | 500 Metal, 80 Power | 5 missions | 10 Power, 5 Metal | Converts raw Metal into rare combat materials |
| Research Lab | 400 Metal, 100 Power | 4 missions | 8 Power | Generates XP bonus per cycle |
| Spaceport | 600 Metal, 120 Power | 6 missions | 10 Power | Enables colony-to-colony resource transfer |
| Atmosphere Processor | 800 Metal, 200 Power | 8 missions | 15 Power | Massive Water + habitability boost |

---

## System 3: Population & Happiness

### Population Mechanics

- Colonists arrive via **Earth shipments** or **natural growth** (if happiness > 60%)
- Each colonist consumes: **1 Food + 0.5 Water per cycle**
- Population capped by Habitat Module capacity (10 per module)
- Colonists work automatically based on available buildings — no direct assignment
- Natural growth rate: +1-2 colonists per cycle when happiness > 60%

### Happiness System (0-100%)

| Factor | Modifier |
|--------|----------|
| Food surplus (well-fed) | +15% |
| Food shortage (starving) | -30% |
| Water surplus | +10% |
| Water shortage | -25% |
| All buildings powered | +5% |
| Power blackouts | -20% |
| Overcrowded (pop > housing) | -20% |
| Med Bay exists | +10% |
| Marketplace exists | +10% |
| Barracks exists (safety) | +5% |
| Recent attack (3 cycles) | -15% |

### Happiness Consequences

| Range | Status | Effect |
|-------|--------|--------|
| **80-100%** | Thriving | Population grows fast. Bonus resource output (+10%). |
| **50-79%** | Stable | Normal operation. Slow growth. |
| **25-49%** | Declining | Growth stops. Some colonists leave each cycle. |
| **0-24%** | Collapsing | Colonists flee rapidly. Buildings decay. Colony dies within 5-8 cycles. |

### Self-Sufficiency

A colony is **self-sufficient** when:
- Food production > Food consumption
- Water production > Water consumption
- Power production > Power consumption
- Happiness > 50%

Self-sufficient colonies run indefinitely without player intervention — until disrupted.

---

## System 4: Threats & Disruptions

### Attack Events

Attacks target settlements. Frequency scales with proximity to Hollow territory.

| Attack Type | Warning | Damage | Counter |
|-------------|---------|--------|---------|
| **Hollow Raid** | 1 mission early (with Radar) | Destroys 1-2 buildings, kills colonists | Barracks + Turrets reduce damage. Player can run defense mission. |
| **Siege** | 2 missions early | Drains resources + damages buildings each cycle until repelled | Requires player defense mission or strong Stronghold |
| **Infiltration** | No warning | Sabotages 1 building (goes offline), reduces happiness | Med Bay + Barracks reduce chance |

### Natural Disasters (planet-biome-specific)

| Planet Biome | Disaster | Effect |
|-------------|----------|--------|
| Ice (Glaciem) | Blizzard | Power output halved for 2 cycles |
| Volcanic (Pyraxis) | Eruption | Destroys 1 building, contaminates Water 3 cycles |
| Ocean (Abyssia) | Flood | Farm output zero for 2 cycles |
| Desert (Ashfall) | Sandstorm | Solar arrays offline for 2 cycles |
| Jungle (Verdania) | Overgrowth | Buildings decay faster, requires clearing mission |
| Any | Supply line disruption | Earth shipments delayed +2 missions |

### Defense Missions

When attack is incoming:
1. **Ignore** — auto-resolve based on military buildings. Damage applied automatically.
2. **Defend manually** — launches Ground Base Defense or Turret mission at the colony location. Success = no damage. Partial = reduced damage.

---

## System 5: Earth Shipments & Supply Lines

### Progression Arc

| Game Phase | Worlds | Delivery Time | Cost | Interception Chance | Notes |
|-----------|--------|-------------|------|-------------------|-------|
| **Early** | W1-W3 | 2 missions | 100-300 credits | 0% | Earth is responsive, reliable |
| **Mid** | W4-W5 | 4 missions | 300-600 credits | 20% | Supply lines get risky |
| **Late** | W6-W7 | 6 missions | 600-1000 credits | 40% | Earth feels distant |
| **Endgame** | W8 | 8+ missions | 1000+ credits | 60% | Earth sends what THEY choose |

### Shipment Mechanics

- Request from cockpit hub → **SUPPLY** screen
- Choose resource type + quantity (within per-phase limits)
- Pay credits upfront
- Shipment enters transit queue with ETA
- Multiple shipments can be in transit simultaneously
- **Comms Tower** building reduces delivery time by 1 mission

### Interception Events

- Warning 1 mission before arrival (if interception triggered)
- Player can **escort** (Turret defense mission — protect convoy) or **risk it**
- Failed escort = shipment lost, credits NOT refunded
- Successful escort = shipment arrives + bonus salvage resources

### Colony-to-Colony Transfer

- Requires **Spaceport** at both colonies
- Transfer surplus resources between your own settlements
- Takes 1 mission cycle
- No interception risk (internal supply line)

---

## System 6: Colony Map & Interface

### Cockpit Hub: COLONIES Station

New station in the cockpit hub. Opens the **Galaxy Colony Map**.

### Galaxy Colony Map

- Shows all planets with your colonies
- Planet icons display: colony count, total population, overall status (green/yellow/red)
- Incoming shipment indicators
- Attack warning indicators
- Click/select a planet → zoom to that planet's colonies
- Click/select a colony → open Colony Management Screen

### Colony Management Screen (top-down grid)

- Grid size: 16×16 (Outpost), 20×20 (Stronghold), 24×24 (Colony)
- Each tile = one building slot or empty terrain
- Arrow keys navigate, Z/Enter places selected building
- **Top bar:** Food, Water, Metal, Power, Population, Happiness bars
- **Side panel:** Building menu categorized (Survival / Civilian / Military / Advanced)
- **Bottom bar:** Colony name, type, cycle income/expense summary
- Buildings display as icons with status colors (green/red/gray)
- Under-construction buildings show progress bar

### First-Person Colony Visit

- From management screen, press V to "visit"
- Enters first-person raycaster mode
- Colony buildings rendered as 3D structures
- Colonists rendered as NPC billboards walking around
- Colonists have flavor dialog reflecting happiness level
- Peaceful mode — no combat during visits
- Escape returns to management screen

### In-Mission Colony Founding

- During first-person or ground-run exploration on a planet
- Reach a suitable open area
- Prompt: "[Z] Found Settlement Here"
- Choose type (Outpost / Colony / Stronghold)
- Pay founding cost
- Colony appears on galaxy map
- Manageable from cockpit hub after mission ends

---

## System 7: Data Model

### ColonyState

```typescript
interface ColonyState {
  id: string;
  name: string;
  type: "outpost" | "colony" | "stronghold";
  planetId: PlanetId;
  position: { x: number; y: number };  // Location on planet (for procedural gen future)
  gridSize: number;
  buildings: ColonyBuilding[];
  population: number;
  maxPopulation: number;
  happiness: number;
  resources: ColonyResources;
  founded: number;          // Mission count when founded
  lastUpdated: number;      // Mission count of last cycle update
  underAttack: boolean;
  attackType?: "raid" | "siege" | "infiltration";
  attackTimer?: number;
  selfSufficient: boolean;
  // Future extensibility
  npcs: ColonyNPC[];
  activeQuests: string[];
  discoveredEvents: string[];
}

interface ColonyBuilding {
  id: string;
  type: BuildingType;
  gridX: number;
  gridY: number;
  status: "constructing" | "operational" | "damaged" | "offline" | "destroyed";
  buildProgress: number;    // Missions remaining until built
  hp: number;
  maxHp: number;
}

interface ColonyResources {
  food: number;
  water: number;
  metal: number;
  power: number;
}

interface ColonyNPC {
  id: string;
  name: string;
  type: "colonist" | "quest_giver" | "merchant" | "love_interest" | "story";
  dialog: FPDialogLine[];
  questId?: string;
  spawnCondition?: string;  // e.g., "population > 20" or "happiness > 80"
}
```

### SaveData Extensions

```typescript
// Added to SaveData
colonies: ColonyState[];
colonyResources: ColonyResources;  // Global stockpile (shared across colonies)
earthShipments: EarthShipment[];
missionsSinceStart: number;        // Total missions completed (for cycle tracking)
```

---

## System 8: Future Extensibility

The colony system is designed to support:

- **Procedurally generated planets** — `position` field on ColonyState allows placement on large generated terrain
- **Side quests from NPCs** — `ColonyNPC.questId` links to quest system; `spawnCondition` controls when NPCs appear
- **Story arcs** — colony growth triggers narrative events (e.g., at 50 population: "A mysterious stranger arrives...")
- **Love interests / character relationships** — `ColonyNPC.type` includes relationship types; dialog can branch
- **Colony-to-colony trade routes** — Spaceport building enables; future expansion could add trade AI
- **Colonist specialization** — future: colonists with skills (farmer, soldier, engineer) for optimal assignment
- **Planetary governance** — future: when multiple colonies exist on one planet, governance/politics emerge
- **Multiplayer colonies** — data model is serializable; future: shared colony management

---

## Implementation Phasing

### Phase 0: MVP

- Colony resources (Food, Metal, Power, Water) added to SaveData
- Resource loot from missions
- Colony founding during first-person exploration
- Single colony management screen (top-down grid)
- 4 survival buildings (Farm, Purifier, Solar, Mine)
- Basic population + happiness
- Resource production/consumption per cycle

### Phase 1: Growth

- All civilian + military buildings
- Happiness system fully functional
- Earth shipment system (early game simple timer)
- Attack events (Hollow raids)
- Defense missions

### Phase 2: Scale

- Galaxy colony map with multiple colonies
- Colony-to-colony transfer (Spaceport)
- Advanced buildings (Refinery, Research Lab, Atmosphere Processor)
- Natural disasters
- Supply line interception + escort missions
- Endgame Earth communication degradation

### Phase 3: Living World

- NPC spawning in colonies based on conditions
- Colony-specific side quests
- Story events triggered by colony milestones
- First-person colony visits with 3D rendered buildings
- Colonist dialog reflecting mood/happiness

### Phase 4: Procedural Planets (future)

- Procedurally generated planet surfaces
- Multiple colony sites per planet
- Terrain-specific bonuses/penalties
- Exploration missions to discover optimal sites

---

## Open Questions / Deferred Decisions

- **Building upgrade paths** — can buildings be upgraded (Farm Lv1 → Lv2) or only built new? Deferred to Phase 1.
- **Colony naming** — player-chosen or auto-generated? Likely player-chosen with suggestions.
- **Colony destruction** — when a colony fully collapses, is the slot lost or can you refound? Deferred.
- **Balance** — all numeric values (costs, production rates, consumption) are initial targets. Dedicated balance pass after Phase 0 playtest.
- **Procedural planet generation** — architecture for this is a separate design doc. Colony system just needs to store position coordinates.
- **Save data size** — unlimited colonies could bloat localStorage. May need IndexedDB or compression for Phase 4.

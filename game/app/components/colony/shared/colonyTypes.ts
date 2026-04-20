// Colony System — Phase 0 Type Surface
//
// This file is the authoritative TypeScript type surface for the Sector Zero
// Colony System. It is sourced verbatim from Section B (main entity shapes)
// and Appendix A (stub types) of:
//   docs/superpowers/specs/2026-04-20-colony-system-design.md
//
// Phase 0 contract: all stub types compile, all reducer events can be
// constructed and asserted against, no runtime behavior depends on fields
// marked "defined properly in Phase N." Subsequent phases flesh out these
// types without breaking Phase 0 tests.

// ---------------------------------------------------------------------------
// Type aliases — concrete values defined in respective phases
// ---------------------------------------------------------------------------

export type ColonyId = string;
export type PlanetId = string;
export type BuildingInstanceId = string;
export type BuildingType = string;              // "farm" | "marketplace" | ...
export type DistrictId = string;
export type NpcId = string;
export type DialogTreeId = string;
export type QuestId = string;
export type RegionNodeId = string;
export type TemplateId = string;
export type InteriorTemplateId = string;
export type FactionId = string;
export type BountyId = string;
export type ShipmentId = string;
export type CombatMaterialId = string;          // maps to existing weaponTypes.ts
export type EnemyClassId = string;              // maps to existing enemyClasses.ts
export type PlanetBiome =
  | "ice"
  | "volcanic"
  | "ocean"
  | "desert"
  | "jungle"
  | "urban"
  | "barren"
  | "toxic";
export type EngineKind =
  | "firstPerson"
  | "boarding"
  | "groundRun"
  | "turret"
  | "shooter";

// ---------------------------------------------------------------------------
// Section B — Data Model
// ---------------------------------------------------------------------------

// ColonyState
export interface ColonyState {
  id: ColonyId;                        // stable UUID — never reused
  name: string;
  planetId: PlanetId;
  foundingType: "outpost" | "colony" | "stronghold";
  tier: 1 | 2 | 3 | 4;                 // growth ladder
  regionNodeId: RegionNodeId;          // location on planet's node graph

  population: PopulationState;
  resources: ColonyResources;          // local stockpile (separate from global)
  buildings: ColonyBuilding[];
  districts: District[];               // emerge at tier 3+

  namedNpcs: NpcId[];                  // references into global NPC registry
  backgroundColonistDensity: number;   // 0-1, drives ambient spawn count

  happiness: number;                   // 0-100
  selfSufficient: boolean;             // derived, cached for UI
  lastCycleProcessed: number;          // for offline catch-up
  lastGameClock: GameClock;            // time-of-day snapshot on last visit

  activeThreats: Threat[];
  activeQuestlines: QuestId[];
  discoveredPoiIds: RegionNodeId[];

  layoutSeed: number;                  // procgen seed for the FPS town layout
  founded: { missionCount: number; gameClockTick: number };
}

// ColonyBuilding
export interface ColonyBuilding {
  id: BuildingInstanceId;
  type: BuildingType;                  // "farm" | "marketplace" | ...
  tier: 1 | 2 | 3;                     // upgrade level (deferred to post-v1)
  status: "constructing" | "operational" | "damaged" | "offline" | "destroyed";
  buildProgressCycles: number;
  hp: number;
  maxHp: number;
  interiorTemplateId: InteriorTemplateId | null;
  assignedNpcIds: NpcId[];             // named NPCs that "live" here
  districtId: DistrictId | null;       // null at tier 1-2
}

// PopulationState
export interface PopulationState {
  total: number;                       // aggregate count, drives consumption
  capacity: number;                    // from Habitat Modules
  namedCount: number;                  // named NPCs currently alive
  growthRate: number;                  // per cycle, can be negative
  recentDeaths: DeathRecord[];         // last 10, for UI + quest hooks
}

// ColonyResources (local stockpile per colony)
export interface ColonyResources {
  food: number;
  water: number;
  metal: number;
  credits: number;                     // colony's treasury (separate from player wallet)
}

// PowerGrid — derived capacity value, not a stockpile
export interface PowerGrid {
  capacity: number;                    // supply from producers this cycle
  demand: number;                      // sum of operational building upkeep
  surplus: number;                     // capacity - demand; negative = brownout
}

// Npc
export interface Npc {
  id: NpcId;
  name: string;
  portraitId: string;
  role: "colonist" | "merchant" | "quest_giver" | "governor" | "guard" | "story";
  colonyId: ColonyId | null;
  homeBuildingId: BuildingInstanceId | null;
  workBuildingId: BuildingInstanceId | null;
  schedule: ScheduleEntry[];
  dialogTreeId: DialogTreeId;
  questIds: QuestId[];
  mood: Mood;
  relationships: Record<NpcId, number>; // stub for Deep Sim
  alive: boolean;
  killedBy: "player" | "hollow" | "natural" | null;
}

export interface ScheduleEntry {
  startHour: number;                   // 0-23
  endHour: number;
  locationType: "building" | "district" | "wandering";
  locationId: string;
  activity: "working" | "sleeping" | "socializing" | "traveling";
}

// RegionMap / POI
export interface PlanetState {
  id: PlanetId;
  regionMap: RegionMap;
  biome: PlanetBiome;
  campaignUnlocked: boolean;
}

export interface RegionMap {
  nodes: RegionNode[];
  edges: [RegionNodeId, RegionNodeId][];
}

export interface RegionNode {
  id: RegionNodeId;
  type: "colony_site" | "ruins" | "hollow_bunker" | "cave" | "crash_site" |
        "raider_outpost" | "neutral_village" | "wilderness" | "anomaly" |
        "abandoned_colony";
  discovered: boolean;
  authored: boolean;                   // true = hand-built landmark
  templateId: TemplateId | null;
  seed: number;                        // deterministic RNG
  cleared: boolean;
  respawnMissions: number | null;      // respawn interval in cycles
  coords: { x: number; y: number };
  elevationMetadata: ElevationMeta | null;
}

export interface ElevationMeta {
  authoredTemplateId: TemplateId;
  overrideName: string;
  questlineId: QuestId;
  requiredCampaignState: string | null;
}

// PoiType depends on RegionNode["type"]
export type PoiType = RegionNode["type"];

// EarthShipment
export interface EarthShipment {
  id: ShipmentId;
  contents: ShipmentContents;          // food, water, metal, credits, player combat materials — NEVER power
  eta: { missionCount: number };
  interceptionChance: number;
  interceptionTriggered: boolean;
  destinationColonyId: ColonyId;
  costPaid: number;
}

export type ShipmentContents = {
  food?: number;
  water?: number;
  metal?: number;
  credits?: number;
  combatMaterials?: Partial<Record<CombatMaterialId, number>>;
};

// FactionStanding & Bounty (consequence system)
export interface FactionStanding {
  factionId: FactionId;                // "earth_command" | "ashfall_camp" | ...
  standing: number;                    // -100 to +100
  rank: "hostile" | "hated" | "neutral" | "liked" | "allied";
  permissions: string[];
}

export interface Bounty {
  id: BountyId;
  colonyId: ColonyId;
  amount: number;
  reason: "murder" | "theft" | "trespass" | "treason";
  witnesses: NpcId[];
  issued: { missionCount: number };
  expired: boolean;
}

// GameClock
export interface GameClock {
  day: number;
  hour: number;                        // 0-23
  minute: number;                      // 0-59
  realtimeMsPerGameMinute: number;     // tuning knob for day/night pace
  season: "standard" | "storm" | "bloom" | "deadzone";
}

// CollapseState — referenced in Section D collapse rules
export interface CollapseState {
  active: boolean;
  cyclesRemaining: number;             // starts at 8
  startedAt: number;                   // missionsSinceStart at entry
}

// ---------------------------------------------------------------------------
// Appendix A — Stub Type Definitions
// ---------------------------------------------------------------------------

// ---- Stubs for Phase 0: compile-clean, zero behavior ----

// Defined properly in Phase 6 (Districts)
export interface District {
  id: DistrictId;
  colonyId: ColonyId;
  kind: "residential" | "market" | "industrial" | "civic" | "military";
  tiles: Array<[number, number]>;       // grid cells owned
  travelAnchorId: string | null;         // fast-travel target ID, null until Phase 6
}

// Defined properly in Phase 8 (Threats)
export interface Threat {
  id: string;
  kind: "raid_incoming" | "siege_ongoing" | "disaster_active" | "supply_disruption";
  cyclesUntilResolve: number;
  severity: "minor" | "major" | "catastrophic";
  targetBuildingId: BuildingInstanceId | null;
  payload: unknown;                      // kind-specific metadata; refined in Phase 8
}

// Defined properly in Phase 5a (NPCs) / expanded in Phase 8 (threats)
export interface DeathRecord {
  npcId: NpcId | null;                  // null = background colonist
  cyclesAgo: number;
  cause: "hunger" | "disease" | "raid" | "siege" | "disaster" | "player" | "natural";
  colonyId: ColonyId;
}

// Defined properly in Phase 5a (schedules)
export interface Mood {
  valence: number;                      // -1 to 1
  dominant: "content" | "anxious" | "hopeful" | "angry" | "grieving" | "bored";
  since: { missionCount: number };
}

// Defined properly in Phase 5b/10-chunk-2 (Quests)
export interface Objective {
  id: string;
  text: string;
  kind: "kill" | "collect" | "escort" | "reach" | "survive" | "deliver" | "talk";
  target: string;                       // kind-specific target identifier
  count: number;                        // current progress
  required: number;
  complete: boolean;
}

export interface QuestReward {
  credits?: number;
  xp?: number;
  colonyResources?: Partial<ColonyResources>;
  combatMaterials?: Partial<Record<CombatMaterialId, number>>;
  factionStandingDeltas?: Array<{ factionId: FactionId; delta: number }>;
  unlockIds?: string[];                 // unlocks narrative content, NPC dialog, POIs
}

export interface GateCondition {
  kind: "tier_at_least" | "faction_standing_at_least" | "quest_complete" | "campaign_world_at_least" | "building_operational";
  value: number | string;
  colonyId?: ColonyId | null;
}

// Defined properly in Phase 7a
export interface PriceModifier {
  kind: "supply_demand" | "faction" | "event";
  value: number;                        // multiplier: 1.0 = neutral
  source: string;                       // human-readable reason
}

export interface StockTable {
  merchantId: NpcId;
  items: Array<{ itemId: string; quantity: number; basePrice: number }>;
}

// Defined properly in Phase 5a/b
export interface NpcSlotDef {
  npcId: NpcId;
  anchorTile: [number, number];
  facing: 0 | 1 | 2 | 3;                // N/E/S/W
  scheduleOverride: ScheduleEntry[] | null;
}

export interface NpcWorldPosition {
  npcId: NpcId;
  tileX: number;
  tileY: number;
  facing: number;
  animationState: "idle" | "walking" | "working" | "sitting";
}

// Defined properly in Phase 4 (POI templates)
export interface EnemySlotDef {
  anchorTile: [number, number];
  enemyPool: EnemyClassId[];             // weighted roll
  difficultyScale: number;
}

export interface LootSlotDef {
  anchorTile: [number, number];
  lootTable: string;                     // identifier into loot table registry
  rarityMin: number;
  rarityMax: number;
}

export interface PropDef {
  kind: string;                          // "counter" | "crate" | "lore_object" | ...
  tile: [number, number];
  interactionId: string | null;
}

export interface InteractionDef {
  id: string;
  kind: "dialog" | "shop" | "door" | "quest_hand_in" | "use_facility";
  target: string;                        // kind-specific target
  requiredStanding?: number;
}

export interface EventHookDef {
  triggerTile: [number, number];
  radius: number;
  event: string;                         // event ID fired on trigger
  once: boolean;
}

export interface ClearCond {
  kind: "all_enemies_dead" | "reach_exit" | "collect_item" | "defend_cycles" | "escort_to_exit";
  payload: unknown;
}

// Defined properly in Phase 4
export type SlotHint = { x: number; y: number } | { districtId: DistrictId } | null;

export type CommissionResult =
  | { ok: true; buildingId: BuildingInstanceId }
  | { ok: false; reason: "insufficient_resources" | "tier_requirement" | "slot_unavailable" | "duplicate_restricted" };

export type ShipmentResult =
  | { ok: true; shipmentId: ShipmentId; eta: number }
  | { ok: false; reason: "no_comms_tower" | "insufficient_credits" | "no_destination" };

export type PromotionResult =
  | { ok: true; newTier: 1 | 2 | 3 | 4 }
  | { ok: false; reason: "requirements_not_met"; missing: string[] };

// Transitions dispatched from adapter to FP engine
export interface TransitionDirective {
  kind: "enter_interior" | "deny" | "prompt_dialog";
  payload: unknown;
}

export interface DialogSession {
  id: string;
  treeId: DialogTreeId;
  npcId: NpcId;
  standingSnapshot: number;
}

// Defined properly in Phase 4
export interface PoiOutcome {
  killed: EntityKillRecord[];
  looted: LootDrop[];
  questProgress: QuestEvent[];
  playerDied: boolean;
  cleared: boolean;
}

export interface EntityKillRecord {
  entityId: string;
  kind: "enemy" | "npc" | "boss";
  factionId: FactionId | null;
}

export interface LootDrop {
  kind: "credits" | "colony_resource" | "combat_material" | "quest_item";
  itemId: string;
  quantity: number;
}

export interface QuestEvent {
  questId: QuestId;
  objectiveId: string;
  delta: number;                         // objective progress advanced by this amount
}

// Quest — Section F quest structure
export interface Quest {
  id: QuestId;
  title: string;
  source: "campaign" | "npc" | "board" | "emergent";
  issuerNpcId: NpcId | null;
  colonyId: ColonyId | null;
  objectives: Objective[];
  rewards: QuestReward;
  deadlineCycles: number | null;
  state: "available" | "active" | "complete" | "failed" | "expired";
  prerequisiteQuestIds: QuestId[];
  gateConditions: GateCondition[];
  hiddenUntilTriggered: boolean;
}

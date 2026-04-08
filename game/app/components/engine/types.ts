// ─── Canvas ──────────────────────────────────────────────────────────
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 854;
export const DASHBOARD_HEIGHT = 140;
export const GAME_AREA_HEIGHT = CANVAS_HEIGHT - DASHBOARD_HEIGHT; // 714
export const DASHBOARD_Y = GAME_AREA_HEIGHT;

// ─── Game States ─────────────────────────────────────────────────────
export enum GameScreen {
  LOADING = "LOADING",
  MENU = "MENU",
  MAP = "MAP",
  BRIEFING = "BRIEFING",
  PLAYING = "PLAYING",
  PAUSED = "PAUSED",
  BOSS_INTRO = "BOSS_INTRO",
  BOSS_FIGHT = "BOSS_FIGHT",
  PHASE_TRANSITION = "PHASE_TRANSITION",
  LEVEL_COMPLETE = "LEVEL_COMPLETE",
  GAME_OVER = "GAME_OVER",
  ENDING = "ENDING",
  CREDITS = "CREDITS",
}

// ─── Directions ──────────────────────────────────────────────────────
export type Direction = "up" | "down" | "left" | "right";

// ─── Player ──────────────────────────────────────────────────────────
export const PLAYER_WIDTH = 48;
export const PLAYER_HEIGHT = 48;
export const PLAYER_SPEED = 5;
export const PLAYER_MAX_HP = 3;
export const PLAYER_INVINCIBLE_FRAMES = 90; // 1.5s at 60fps
export const PLAYER_FIRE_RATE = 8; // frames between shots

export interface Player {
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  speed: number;
  weaponLevel: number;
  invincibleTimer: number;
  fireTimer: number;
  energy: number;
  maxEnergy: number;
  /** -1 = banking left, 0 = center, 1 = banking right */
  bankDir: number;
}

// ─── Weapon Affinity System ─────────────────────────────────────────
export type WeaponType = "kinetic" | "energy" | "incendiary" | "cryogenic";

export type AffinityResult = "effective" | "neutral" | "resisted";

// ─── Enemy Classes ──────────────────────────────────────────────────
export type EnemyClass =
  | "armored"
  | "swarm"
  | "bio-organic"
  | "tech-drone"
  | "heavy-mech"
  | "elemental-fire"
  | "elemental-ice"
  | "elemental-cinder";

// ─── Bullets ─────────────────────────────────────────────────────────
export const BULLET_SPEED = 10;
export const ENEMY_BULLET_SPEED = 4;

export type BulletVariant = "orb" | "bolt" | "fire" | "acid";

export interface Bullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  damage: number;
  isPlayer: boolean;
  piercing: boolean;
  variant?: BulletVariant;
  weaponType?: WeaponType;
}

// ─── Enemy Types ─────────────────────────────────────────────────────
export enum EnemyType {
  SCOUT = "SCOUT",
  DRONE = "DRONE",
  GUNNER = "GUNNER",
  SHIELDER = "SHIELDER",
  BOMBER = "BOMBER",
  SWARM = "SWARM",
  TURRET = "TURRET",
  CLOAKER = "CLOAKER",
  ELITE = "ELITE",
  MINE = "MINE",
  WRAITH = "WRAITH",
  ECHO = "ECHO",
  MIRROR = "MIRROR",
}

export interface EnemyDefinition {
  type: EnemyType;
  hp: number;
  speed: number;
  width: number;
  height: number;
  score: number;
  shoots: boolean;
  fireRate: number;
}

export const ENEMY_DEFS: Record<EnemyType, EnemyDefinition> = {
  [EnemyType.SCOUT]: {
    type: EnemyType.SCOUT,
    hp: 1, speed: 3, width: 40, height: 40, score: 100,
    shoots: false, fireRate: 0,
  },
  [EnemyType.DRONE]: {
    type: EnemyType.DRONE,
    hp: 1, speed: 4, width: 32, height: 32, score: 150,
    shoots: true, fireRate: 120,
  },
  [EnemyType.GUNNER]: {
    type: EnemyType.GUNNER,
    hp: 3, speed: 1.5, width: 48, height: 48, score: 250,
    shoots: true, fireRate: 60,
  },
  [EnemyType.SHIELDER]: {
    type: EnemyType.SHIELDER,
    hp: 5, speed: 1.5, width: 56, height: 48, score: 350,
    shoots: true, fireRate: 90,
  },
  [EnemyType.BOMBER]: {
    type: EnemyType.BOMBER,
    hp: 2, speed: 5, width: 36, height: 48, score: 200,
    shoots: false, fireRate: 0,
  },
  [EnemyType.SWARM]: {
    type: EnemyType.SWARM,
    hp: 1, speed: 4.5, width: 24, height: 24, score: 50,
    shoots: false, fireRate: 0,
  },
  [EnemyType.TURRET]: {
    type: EnemyType.TURRET,
    hp: 6, speed: 0, width: 48, height: 48, score: 400,
    shoots: true, fireRate: 45,
  },
  [EnemyType.CLOAKER]: {
    type: EnemyType.CLOAKER,
    hp: 3, speed: 3, width: 44, height: 44, score: 300,
    shoots: true, fireRate: 90,
  },
  [EnemyType.ELITE]: {
    type: EnemyType.ELITE,
    hp: 8, speed: 3, width: 48, height: 48, score: 1000,
    shoots: true, fireRate: 40,
  },
  [EnemyType.MINE]: {
    type: EnemyType.MINE,
    hp: 1, speed: 0.5, width: 32, height: 32, score: 75,
    shoots: false, fireRate: 0,
  },
  [EnemyType.WRAITH]: {
    type: EnemyType.WRAITH,
    hp: 4, speed: 2.5, width: 48, height: 44, score: 400,
    shoots: true, fireRate: 80,
  },
  [EnemyType.ECHO]: {
    type: EnemyType.ECHO,
    hp: 3, speed: 3, width: 36, height: 36, score: 300,
    shoots: true, fireRate: 90,
  },
  [EnemyType.MIRROR]: {
    type: EnemyType.MIRROR,
    hp: 3, speed: 4, width: 48, height: 48, score: 350,
    shoots: true, fireRate: 60,
  },
};

export interface Enemy {
  id: number;
  type: EnemyType;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  speed: number;
  vx: number;
  vy: number;
  score: number;
  fireTimer: number;
  fireRate: number;
  shoots: boolean;
  behavior: EnemyBehavior;
  behaviorTimer: number;
  cloaked: boolean;
  classId: EnemyClass;
  lastHitAffinity?: AffinityResult;
  lastHitTimer: number;
}

export type EnemyBehavior =
  | "formation"
  | "dive"
  | "zigzag"
  | "orbit"
  | "chase"
  | "static"
  | "cloak"
  | "kamikaze"
  | "drift"
  | "phase"
  | "mirror";

// ─── Formation Types ─────────────────────────────────────────────────
export type FormationType =
  | "v-shape"
  | "line"
  | "grid"
  | "circle"
  | "scatter"
  | "single-file";

// ─── Waves ───────────────────────────────────────────────────────────
export interface WaveDefinition {
  enemies: { type: EnemyType; count: number; formation: FormationType }[];
  delay: number;
  spawnPattern: "top" | "sides" | "formation" | "scatter";
}

export interface Wave {
  definition: WaveDefinition;
  spawned: boolean;
  enemiesRemaining: number;
}

// ─── Power-Ups ───────────────────────────────────────────────────────
export enum PowerUpType {
  SHIELD = "SHIELD",
  SPEED = "SPEED",
  BOMB = "BOMB",
  MAGNET = "MAGNET",
  SIDE_GUNNERS = "SIDE_GUNNERS",
  RAPID_FIRE = "RAPID_FIRE",
  WEAPON_UP = "WEAPON_UP",
}

export interface PowerUp {
  id: number;
  type: PowerUpType;
  x: number;
  y: number;
  width: number;
  height: number;
  vy: number;
}

export interface ActivePowerUp {
  type: PowerUpType;
  remainingFrames: number;
  totalFrames: number;
}

export const POWER_UP_COLORS: Record<PowerUpType, string> = {
  [PowerUpType.SHIELD]: "#4488ff",
  [PowerUpType.SPEED]: "#ffdd00",
  [PowerUpType.BOMB]: "#ff3333",
  [PowerUpType.MAGNET]: "#aa44ff",
  [PowerUpType.SIDE_GUNNERS]: "#44ff44",
  [PowerUpType.RAPID_FIRE]: "#ff8800",
  [PowerUpType.WEAPON_UP]: "#ffffff",
};

export const POWER_UP_SYMBOLS: Record<PowerUpType, string> = {
  [PowerUpType.SHIELD]: "S",
  [PowerUpType.SPEED]: ">>",
  [PowerUpType.BOMB]: "B",
  [PowerUpType.MAGNET]: "M",
  [PowerUpType.SIDE_GUNNERS]: "+",
  [PowerUpType.RAPID_FIRE]: "R",
  [PowerUpType.WEAPON_UP]: "W",
};

export const POWER_UP_DURATION: Record<PowerUpType, number> = {
  [PowerUpType.SHIELD]: 600,   // 10s
  [PowerUpType.SPEED]: 480,    // 8s
  [PowerUpType.BOMB]: 1,       // instant
  [PowerUpType.MAGNET]: 720,   // 12s
  [PowerUpType.SIDE_GUNNERS]: 900, // 15s
  [PowerUpType.RAPID_FIRE]: 600,   // 10s
  [PowerUpType.WEAPON_UP]: 1,      // permanent within level
};

// ─── Particles ───────────────────────────────────────────────────────
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: "spark" | "smoke" | "trail" | "explosion";
}

// ─── Sprite Explosions ──────────────────────────────────────────────
export interface SpriteExplosion {
  x: number;
  y: number;
  size: number;
  frame: number;
  totalFrames: number;
  frameTimer: number;
  frameDelay: number; // ticks per frame
}

// ─── Floating Labels (damage/affinity indicators) ───────────────────
export interface FloatingLabel {
  id: number;
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

// ─── Bosses ──────────────────────────────────────────────────────────
export interface BossPart {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  isWeakPoint: boolean;
  vulnerable: boolean;
}

export interface Boss {
  id: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  phase: number;
  maxPhases: number;
  parts: BossPart[];
  fireTimer: number;
  behaviorTimer: number;
  defeated: boolean;
  velocityX: number;
  velocityY: number;
  mouthOpen: boolean;
  mouthTimer: number;
  chargeState: "none" | "winding" | "charging" | "recovering";
  chargeTimer: number;
  spawnTimer: number;
}

// ─── Combo ───────────────────────────────────────────────────────────
export const COMBO_WINDOW = 90; // 1.5s at 60fps
export const COMBO_MAX = 10;

// ─── Scoring ─────────────────────────────────────────────────────────
export interface LevelResult {
  score: number;
  kills: number;
  totalEnemies: number;
  deaths: number;
  stars: number;
  xpEarned: number;
}

// ─── Star Map ────────────────────────────────────────────────────────
export interface WorldNode {
  id: number;
  name: string;
  theme: string;
  x: number;
  y: number;
  levels: number[];
  unlocked: boolean;
}

// ─── Background ──────────────────────────────────────────────────────
export interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  brightness: number;
}

export interface BackgroundLayer {
  stars: Star[];
  scrollY: number;
  speed: number;
}

// ─── Input ───────────────────────────────────────────────────────────
export interface Keys {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  strafeLeft: boolean;
  strafeRight: boolean;
  shoot: boolean;
  bomb: boolean;
  jump: boolean;  // Ground-run: Space=jump, Z/Shift=shoot
}

// ─── Audio Events ────────────────────────────────────────────────────
export enum AudioEvent {
  PLAYER_SHOOT = "PLAYER_SHOOT",
  PLAYER_HIT = "PLAYER_HIT",
  PLAYER_DEATH = "PLAYER_DEATH",
  ENEMY_HIT = "ENEMY_HIT",
  ENEMY_DESTROY = "ENEMY_DESTROY",
  ENEMY_SHOOT = "ENEMY_SHOOT",
  BOSS_HIT = "BOSS_HIT",
  BOSS_PHASE = "BOSS_PHASE",
  BOSS_DEFEAT = "BOSS_DEFEAT",
  POWER_UP_COLLECT = "POWER_UP_COLLECT",
  BOMB_ACTIVATE = "BOMB_ACTIVATE",
  COMBO = "COMBO",
  LEVEL_COMPLETE = "LEVEL_COMPLETE",
  GAME_OVER = "GAME_OVER",
  MENU_SELECT = "MENU_SELECT",
  SHIELD_HIT = "SHIELD_HIT",
  // Cockpit hub events
  COCKPIT_NAV = "COCKPIT_NAV",
  COCKPIT_OPEN = "COCKPIT_OPEN",
  COCKPIT_BACK = "COCKPIT_BACK",
  UPGRADE_PURCHASE = "UPGRADE_PURCHASE",
  UPGRADE_DENIED = "UPGRADE_DENIED",
  QUEST_ACCEPT = "QUEST_ACCEPT",
  QUEST_ABANDON = "QUEST_ABANDON",
  DIALOG_ADVANCE = "DIALOG_ADVANCE",
  DIALOG_CLOSE = "DIALOG_CLOSE",
}

// ─── Dialog System ──────────────────────────────────────────────────

export interface DialogLine {
  speaker: string;
  portraitKey: string;
  text: string;
  duration: number;
  color?: string;
}

export interface DialogState {
  queue: DialogLine[];
  currentLine: DialogLine | null;
  timer: number;
  fadeIn: number;
  fadeOut: number;
}

export type DialogTriggerEvent =
  | { type: "level_start" }
  | { type: "wave_start"; wave: number }
  | { type: "wave_clear"; wave: number }
  | { type: "boss_intro" }
  | { type: "boss_phase"; phase: number }
  | { type: "boss_defeat" }
  | { type: "level_complete" };

export interface DialogTrigger {
  event: DialogTriggerEvent;
  lines: DialogLine[];
  once: boolean;
  triggered?: boolean;
}

// ─── Full Game State ─────────────────────────────────────────────────
export interface GameState {
  screen: GameScreen;
  player: Player;
  playerBullets: Bullet[];
  enemyBullets: Bullet[];
  enemies: Enemy[];
  boss: Boss | null;
  powerUps: PowerUp[];
  activePowerUps: ActivePowerUp[];
  particles: Particle[];
  explosions: SpriteExplosion[];
  floatingLabels: FloatingLabel[];
  equippedWeaponType: WeaponType;
  pendingBestiaryKills: Array<{ type: EnemyType; classId: EnemyClass }>;
  pilotLevel: number;
  allocatedSkills: SkillNodeId[];
  // Multi-phase tracking
  currentPhase: number;
  currentMode: GameMode;
  totalPhases: number;
  phaseCheckpoint: CheckpointState | null;
  phaseTransitionTimer: number;
  phaseTransitionCard: string;
  phaseTransitionSubtext: string;
  /** Ground run-and-gun mode state (only populated when currentMode === "ground-run") */
  groundState?: GroundState;
  /** Ship boarding mode state (only populated when currentMode === "boarding") */
  boardingState?: BoardingState;
  /** First-person raycaster state (only populated when currentMode === "first-person") */
  firstPersonState?: FirstPersonState;
  /** Ship turret mode state (only populated when currentMode === "turret") */
  turretState?: TurretState;
  background: BackgroundLayer[];
  score: number;
  combo: number;
  comboTimer: number;
  maxCombo: number;
  lives: number;
  bombs: number;
  bombCooldown: number;
  currentWorld: number;
  currentLevel: number;
  currentWave: number;
  totalWaves: number;
  waves: Wave[];
  waveDelay: number;
  kills: number;
  totalEnemies: number;
  deaths: number;
  frameCount: number;
  screenShake: number;
  audioEvents: AudioEvent[];
  bossIntroTimer: number;
  briefingTimer: number;
  levelCompleteTimer: number;
  devInvincible: boolean;
  dialog: DialogState;
  dialogTriggers: DialogTrigger[];
  xp: number;
  hpWarningTriggered: boolean;
  // Planet mission state (optional — only set for planet side missions)
  planetId?: PlanetId;
  objective?: ObjectiveState;
  escort?: EscortEntity;
  defendStructure?: DefendStructure;
  /** Incendiary bomb enhancement: frames remaining */
  incendiaryTimer?: number;
  /** Survive missions: loop back to this wave index when exhausted */
  loopFromWave?: number;
}

// ─── Ship Upgrades ──────────────────────────────────────────────────
export interface ShipUpgrades {
  hullPlating: number;     // 0-3: +1 maxHp per level (3→6)
  engineBoost: number;     // 0-3: +0.5 speed per level (5→6.5)
  weaponCore: number;      // 0-2: +1 starting weapon level (1→3)
  munitionsBay: number;    // 0-3: +1 starting bomb (2→5)
  fireControl: number;     // 0-2: -1 fire rate frames (8→6)
  shieldGenerator: number; // 0-2: +200 shield duration frames per level
}

export const DEFAULT_UPGRADES: ShipUpgrades = {
  hullPlating: 0,
  engineBoost: 0,
  weaponCore: 0,
  munitionsBay: 0,
  fireControl: 0,
  shieldGenerator: 0,
};

// ─── Planet Missions ─────────────────────────────────────────────────

export type ObjectiveType = "collect" | "survive" | "escort" | "defend";

export interface ObjectiveState {
  type: ObjectiveType;
  /** Collect: items gathered / Survive: frames elapsed / Escort & Defend: unused */
  progress: number;
  /** Collect: target count / Survive: target frames / Escort & Defend: unused */
  target: number;
  /** Escort / Defend: HP of the protected entity */
  entityHp: number;
  entityMaxHp: number;
  /** Survive: current intensity tier (0-based) */
  intensityTier: number;
  /** Collect: collectible nodes on screen */
  collectibles: Collectible[];
  /** Whether objective has been completed */
  completed: boolean;
  /** Whether objective has been failed (escort/defend entity destroyed) */
  failed: boolean;
}

export interface Collectible {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  vy: number;
  lifetime: number;    // frames remaining before despawn
  maxLifetime: number;
}

export interface EscortEntity {
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  speed: number;
  /** Waypoint index for pathing */
  waypointIndex: number;
}

export interface DefendStructure {
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
}

export type MaterialId =
  | "bio-fiber" | "cryogenic-alloy" | "molten-core" | "ruin-shard"
  | "abyssal-plating" | "desert-glass" | "phase-crystal" | "genesis-seed"
  | "neon-circuitry" | "ferro-steel"
  // Rare materials (from multi-phase missions)
  | "kinetic-core" | "energy-cell" | "ember-shard" | "cryo-essence"
  // Legendary materials (from boss rare drops + optional phases)
  | "void-fragment" | "hollow-resonance";

export type ConsumableId =
  | "hull-repair"
  | "cryo-charge"
  | "shield-charge"
  | "weapon-overcharge"
  | "scanner-pulse";

export type EnhancementId =
  | "reinforced-shield"
  | "incendiary-bombs"
  | "extended-magnet"
  | "homing-gunners"
  | "resonance-field";

export type PlanetId =
  | "verdania"
  | "glaciem"
  | "pyraxis"
  | "ossuary"
  | "abyssia"
  | "ashfall"
  | "prismara"
  | "genesis"
  | "luminos"
  | "bastion";

export type SpecialMissionId = "kepler-black-box";

export type StoryItemId = "kepler-black-box";

// ─── Multi-Phase Levels ─────────────────────────────────────────────
export type GameMode = "shooter" | "ground-run" | "boarding" | "first-person" | "turret" | "base-defense" | "mech-duel";

export interface PhaseConfig {
  mode: GameMode;
  waves: WaveDefinition[];
  isBoss?: boolean;
  briefingText?: string;
  objectiveType?: ObjectiveType;
  objectiveTarget?: number;
}

export interface TransitionSequence {
  dialogLine?: string;
  dialogSpeaker?: string;
  cardText: string;
  cardSubtext?: string;
  duration: number;
}

export interface PhaseDefinition {
  config: PhaseConfig;
  transitionIn?: TransitionSequence;
}

export interface MultiPhaseLevelData {
  world: number;
  level: number;
  name: string;
  briefingText: string;
  worldIntroText?: string;
  phases: PhaseDefinition[];
  /** Materials awarded on completing ALL phases. Only awarded once per material. */
  completionRewards?: MaterialId[];
}

export interface CheckpointState {
  hp: number;
  maxHp: number;
  lives: number;
  weaponLevel: number;
  score: number;
  kills: number;
  deaths: number;
  maxCombo: number;
  activePowerUps: ActivePowerUp[];
}

// ─── Ground Run-and-Gun ─────────────────────────────────────────────

export type TileType = "empty" | "solid" | "platform" | "spawn" | "goal";

export interface TileMap {
  width: number;
  height: number;
  tileSize: number;
  tiles: TileType[][];
}

export interface GroundEntity {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  type: "patrol" | "turret" | "jumper" | "flyer";
  onGround: boolean;
  facingRight: boolean;
  fireTimer: number;
  classId: EnemyClass;
}

export interface GroundState {
  tileMap: TileMap;
  cameraX: number;
  groundEnemies: GroundEntity[];
  groundBullets: Bullet[];
  playerOnGround: boolean;
  playerVY: number;
  playerFacingRight: boolean;
  goalReached: boolean;
}

// ─── Ship Boarding (Top-Down) ───────────────────────────────────────

export type BoardingTileType = "floor" | "wall" | "door" | "spawn" | "goal" | "empty";

export type FacingDirection = "up" | "down" | "left" | "right";

export interface BoardingEntity {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  type: "grunt" | "charger" | "sentry";
  facing: FacingDirection;
  fireTimer: number;
  classId: EnemyClass;
  aggroRange: number;    // pixels — starts chasing when player is within range
  isAggro: boolean;
}

export interface BoardingMap {
  width: number;
  height: number;
  tileSize: number;
  tiles: BoardingTileType[][];
}

export interface BoardingState {
  map: BoardingMap;
  cameraX: number;
  cameraY: number;
  enemies: BoardingEntity[];
  bullets: Bullet[];
  playerFacing: FacingDirection;
  dashTimer: number;      // frames remaining on dash (0 = not dashing)
  dashCooldown: number;   // frames until dash available again
  goalReached: boolean;
}

// ─── Ship Turret (Star Wars Gunner) ─────────────────────────────────

export interface TurretEnemy {
  id: number;
  x: number;           // Screen-space X (0-1 normalized, 0.5 = center)
  y: number;           // Screen-space Y (0-1 normalized, 0.5 = center)
  z: number;           // Depth (1 = far, 0 = at camera). Determines apparent size.
  vx: number;          // Drift velocity X per frame
  vy: number;          // Drift velocity Y per frame
  speed: number;       // Approach speed (z decreases by this per frame)
  hp: number;
  maxHp: number;
  type: "fighter" | "bomber" | "drone";
  classId: EnemyClass;
  score: number;
}

export interface TurretBolt {
  id: number;
  x: number;           // Screen-space normalized (0-1)
  y: number;
  z: number;           // Depth — starts at 0 (camera), flies outward toward 1
  targetX: number;     // Where it's heading
  targetY: number;
  speed: number;
  life: number;        // Frames remaining
}

export interface TurretState {
  crosshairX: number;  // 0-1 normalized screen position
  crosshairY: number;
  enemies: TurretEnemy[];
  bolts: TurretBolt[];
  shipHp: number;      // Dropship HP (enemies reaching z=0 deal damage)
  shipMaxHp: number;
  wave: number;
  totalWaves: number;
  waveTimer: number;    // Frames until next wave spawns
  spawnTimer: number;   // Frames until next enemy in current wave
  enemiesRemaining: number; // In current wave
  killCount: number;
  targetKills: number;  // Win condition: total kills needed (0 = wave-based)
  completed: boolean;
  fireCooldown: number;
}

// ─── First-Person (Raycaster) ───────────────────────────────────────

// ─── First-Person NPCs ──────────────────────────────────────────────

export interface FPDialogLine {
  speaker: string;
  text: string;
  portraitKey?: string;
}

export interface FPShopItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  type: "consumable" | "material" | "upgrade";
  itemId?: string;  // ConsumableId or MaterialId
}

export interface FPNPC {
  id: number;
  x: number;           // Tile-unit position
  y: number;
  name: string;
  type: "quest" | "merchant" | "lore";
  dialog: FPDialogLine[];
  shopItems?: FPShopItem[];  // Only for merchants
  color: string;       // Fallback color for billboard
  interacted: boolean; // Has player talked to this NPC this session?
}

export interface FPDialogState {
  active: boolean;
  npcId: number;
  lines: FPDialogLine[];
  currentLine: number;
  shopOpen: boolean;
  shopItems?: FPShopItem[];
}

export interface FPEnemy {
  id: number;
  x: number;              // Tile-unit position
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  type: "grunt" | "charger" | "sentry";
  aggroRange: number;
  isAggro: boolean;
  deathTimer: number;     // > 0 means dying animation, 0 = alive, -1 = dead & removed
  fireTimer: number;
  classId: EnemyClass;
}

export interface FPEnvironmentArt {
  skySprite?: string;
  wallSprite?: string;
  floorSprite?: string;
  ceilingSprite?: string;
}

export interface FPProp {
  id: number;
  x: number;
  y: number;
  sprite: string;
  scale?: number;
  label?: string;
}

export interface FirstPersonState {
  map: BoardingMap;
  posX: number;
  posY: number;
  dirX: number;
  dirY: number;
  planeX: number;
  planeY: number;
  moveSpeed: number;
  rotSpeed: number;
  goalReached: boolean;
  objectivePickup?: {
    x: number;
    y: number;
    label: string;
  };
  objectiveCollected?: boolean;
  enemies: FPEnemy[];
  gunFireTimer: number;   // Frames since last shot (for muzzle flash)
  gunCooldown: number;    // Frames until can fire again
  // RPG layer
  npcs: FPNPC[];
  dialogState: FPDialogState | null;
  environmentArt?: FPEnvironmentArt;
  props?: FPProp[];
  missionLabel?: string;
}

// ─── Pilot Leveling ─────────────────────────────────────────────────
export type SkillTreeId = "combat" | "engineering" | "piloting";

export type SkillNodeId =
  | "sharpshooter"
  | "overcharge"
  | "berserker"
  | "glass-cannon"
  | "adrenaline"
  | "signature-weapon";

export interface PilotMilestone {
  level: number;
  label: string;
  unlocked: boolean;
}

// ─── Bestiary ───────────────────────────────────────────────────────
export interface BestiaryEntry {
  enemyType: EnemyType;
  classId: EnemyClass;
  killCount: number;
  firstSeenPlanet?: PlanetId;
  firstSeenWorld?: number;
}

// ─── Save Data ───────────────────────────────────────────────────────
export interface SaveData {
  currentWorld: number;
  levels: Record<string, { completed: boolean; stars: number; highScore: number }>;
  credits: number;
  totalStars: number;
  totalScore: number;
  xp: number;
  introSeen?: boolean;
  upgrades: ShipUpgrades;
  unlockedCodex: string[];
  viewedCodex: string[];
  viewedConversations: string[];
  completedQuests: string[];
  activeQuests: string[];
  // Planet mission data
  completedPlanets: PlanetId[];
  unlockedSpecialMissions: SpecialMissionId[];
  completedSpecialMissions: SpecialMissionId[];
  storyItems: StoryItemId[];
  materials: MaterialId[];
  consumableInventory: Partial<Record<ConsumableId, number>>;
  equippedConsumables: ConsumableId[];
  unlockedEnhancements: EnhancementId[];
  bestiary: Partial<Record<EnemyType, BestiaryEntry>>;
  equippedWeaponType: WeaponType;
  pilotLevel: number;
  skillPoints: number;
  allocatedSkills: SkillNodeId[];
}

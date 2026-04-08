import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GAME_AREA_HEIGHT,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  PLAYER_SPEED,
  PLAYER_MAX_HP,
  PLAYER_INVINCIBLE_FRAMES,
  PLAYER_FIRE_RATE,
  COMBO_WINDOW,
  COMBO_MAX,
  ENEMY_BULLET_SPEED,
  GameScreen,
  PowerUpType,
  AudioEvent,
  EnemyType,
  POWER_UP_DURATION,
  type EnemyClass,
  type GameState,
  type Player,
  type Keys,
  type ActivePowerUp,
  type Particle,
  type Wave,
  type PowerUp,
  type Bullet,
  type ShipUpgrades,
  type EnhancementId,
  type PlanetId,
  type SpecialMissionId,
  type ObjectiveState,
  type SpriteExplosion,
  type SkillNodeId,
  DEFAULT_UPGRADES,
} from "./types";
import { bonusHp } from "./pilotLevel";
import { hasSkill, getSkillEffect } from "./skillTree";
import { createBackground, updateBackground } from "./background";
import { updateParticles, createExplosion, createSparks, createEngineTrail, createSpriteExplosion, updateSpriteExplosions } from "./particles";
import { firePlayerWeapon, fireSideGunners, updateBullets } from "./weapons";
import {
  updateEnemy,
  enemyShouldFire,
  fireEnemyBullet,
  isEnemyOffscreen,
  spawnFormation,
  resetEnemyIds,
  setDifficultyForWorld,
  setPlanetClassOverride,
} from "./enemies";
import { PLANET_DOMINANT_CLASS, resolveAffinity } from "./enemyClasses";
import { AFFINITY_MULTIPLIER } from "./weaponTypes";
import { createAffinityLabel, updateFloatingLabels, resetFloatingLabelIds } from "./floatingLabels";
import { resetBulletIds } from "./weapons";
import { aabbOverlap, SpatialHash } from "./physics";
import { getLevelData, getWorldLevelCount, getMultiPhaseLevelData } from "./levels";
import { clamp } from "./physics";

const spatialHash = new SpatialHash();
import { createBossForWorld, updateBossForWorld, isBossDefeated, resetBossBulletIds } from "./bosses";
import { updateGroundEngine } from "./groundEngine";
import { createTestGroundState, getSpawnPosition as getGroundSpawn } from "./groundLevel";
import { updateBoardingEngine } from "./boardingEngine";
import { createBoardingState, getBoardingSpawn } from "./boardingLevel";
import { updateFirstPerson } from "./firstPersonEngine";
import { updateTurretEngine, createTurretState } from "./turretEngine";
import { createDialogState, updateDialog, checkDialogTriggers, getDialogTriggers } from "./dialog";
import { createObjectiveState, createEscortEntity, createDefendStructure, updateObjective } from "./objectives";
import { getPlanetDef } from "./planets";
import { getPlanetLevelData } from "./planetLevels";
import { getPlanetDialogTriggers } from "./planetDialog";
import { createHazardState, updateHazards, type HazardState } from "./hazards";
import { createCheckpoint, isLastPhase } from "./phases";
import { createKeplerBlackBoxFirstPersonState } from "./keplerBlackBoxMission";

// ─── Power-Up Spawning ──────────────────────────────────────────────

let powerUpIdCounter = 0;

export function resetPowerUpIds(): void {
  powerUpIdCounter = 0;
}

function createPowerUp(type: PowerUpType, x: number, y: number): PowerUp {
  return {
    id: ++powerUpIdCounter,
    type,
    x: x - 12,
    y,
    width: 24,
    height: 24,
    vy: 1.5,
  };
}

// Drop rate by enemy type (0 = never drops)
const DROP_RATES: Partial<Record<EnemyType, number>> = {
  [EnemyType.ELITE]: 0.6,
  [EnemyType.TURRET]: 0.35,
  [EnemyType.SHIELDER]: 0.35,
  [EnemyType.GUNNER]: 0.3,
  [EnemyType.BOMBER]: 0.25,
  [EnemyType.CLOAKER]: 0.25,
  [EnemyType.DRONE]: 0.2,
  [EnemyType.SCOUT]: 0.15,
  // SWARM and MINE: no entry → 0
};

// Weighted type selection
const POWER_UP_WEIGHTS: [PowerUpType, number][] = [
  [PowerUpType.WEAPON_UP, 25],
  [PowerUpType.SHIELD, 20],
  [PowerUpType.RAPID_FIRE, 18],
  [PowerUpType.SPEED, 12],
  [PowerUpType.SIDE_GUNNERS, 10],
  [PowerUpType.BOMB, 10],
  [PowerUpType.MAGNET, 5],
];

const TOTAL_WEIGHT = POWER_UP_WEIGHTS.reduce((sum, [, w]) => sum + w, 0);

function pickRandomPowerUpType(): PowerUpType {
  let roll = Math.random() * TOTAL_WEIGHT;
  for (const [type, weight] of POWER_UP_WEIGHTS) {
    roll -= weight;
    if (roll <= 0) return type;
  }
  return PowerUpType.WEAPON_UP;
}

const MAX_POWERUPS_ON_SCREEN = 6;

// ─── Create State ────────────────────────────────────────────────────

export function createPlayer(
  upgrades: ShipUpgrades = DEFAULT_UPGRADES,
  pilotLevel: number = 1,
  allocatedSkills: SkillNodeId[] = []
): Player {
  let maxHp = PLAYER_MAX_HP + upgrades.hullPlating + bonusHp(pilotLevel);

  // Glass Cannon: +30% damage (applied in collision), -1 max HP
  if (hasSkill(allocatedSkills, "glass-cannon")) {
    maxHp = Math.max(1, maxHp - 1);
  }

  return {
    x: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2,
    y: GAME_AREA_HEIGHT - 100,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    hp: maxHp,
    maxHp,
    speed: PLAYER_SPEED + upgrades.engineBoost * 0.5,
    weaponLevel: Math.min(5, 1 + upgrades.weaponCore),
    invincibleTimer: 0,
    fireTimer: 0,
    energy: 100,
    maxEnergy: 100,
    bankDir: 0,
  };
}

// Store current upgrades so handlePlayerShooting and updatePowerUps can reference them
let currentUpgrades: ShipUpgrades = { ...DEFAULT_UPGRADES };
let currentEnhancements: EnhancementId[] = [];
let currentAllocatedSkills: SkillNodeId[] = [];
let currentHazardState: HazardState | null = null;
let reflectedBulletId = 200000;

function hasEnhancement(id: EnhancementId): boolean {
  return currentEnhancements.includes(id);
}

export function getHazardState(): HazardState | null {
  return currentHazardState;
}

export function createGameState(world: number, level: number, upgrades: ShipUpgrades = DEFAULT_UPGRADES, enhancements: EnhancementId[] = [], pilotLevel: number = 1, allocatedSkills: SkillNodeId[] = []): GameState {
  setPlanetClassOverride(null);
  currentUpgrades = { ...upgrades };
  currentEnhancements = [...enhancements];
  currentAllocatedSkills = [...allocatedSkills];
  currentHazardState = null;
  setDifficultyForWorld(world);
  resetEnemyIds();
  resetFloatingLabelIds();
  resetBulletIds();
  resetBossBulletIds();
  resetPowerUpIds();

  const levelData = getLevelData(world, level);
  const multiPhaseData = getMultiPhaseLevelData(world, level);
  const waves: Wave[] = (levelData?.waves ?? []).map((def) => ({
    definition: def,
    spawned: false,
    enemiesRemaining: def.enemies.reduce((sum, e) => sum + e.count, 0),
  }));

  // Briefing duration: longer if world intro text exists
  const hasWorldIntro = !!levelData?.worldIntroText;
  const briefingTimer = hasWorldIntro ? 720 : 480;

  return {
    screen: GameScreen.BRIEFING,
    player: createPlayer(upgrades, pilotLevel, allocatedSkills),
    playerBullets: [],
    enemyBullets: [],
    enemies: [],
    boss: null,
    powerUps: [],
    activePowerUps: [],
    particles: [],
    explosions: [],
    floatingLabels: [],
    equippedWeaponType: "kinetic",
    pendingBestiaryKills: [],
    background: createBackground(),
    score: 0,
    combo: 0,
    comboTimer: 0,
    maxCombo: 0,
    lives: 3,
    bombs: 2 + upgrades.munitionsBay,
    bombCooldown: 0,
    currentWorld: world,
    currentLevel: level,
    currentWave: 0,
    totalWaves: waves.length,
    waves,
    waveDelay: 120,
    kills: 0,
    totalEnemies: waves.reduce((sum, w) => sum + w.enemiesRemaining, 0),
    deaths: 0,
    frameCount: 0,
    screenShake: 0,
    audioEvents: [],
    bossIntroTimer: 0,
    briefingTimer,
    levelCompleteTimer: 0,
    devInvincible: false,
    dialog: createDialogState(),
    dialogTriggers: getDialogTriggers(world, level),
    xp: 0,
    hpWarningTriggered: false,
    pilotLevel,
    allocatedSkills,
    currentPhase: 0,
    currentMode: "shooter",
    totalPhases: multiPhaseData?.phases.length ?? 1,
    phaseCheckpoint: null,
    phaseTransitionTimer: 0,
    phaseTransitionCard: "",
    phaseTransitionSubtext: "",
  };
}

export function createPlanetGameState(
  planetId: PlanetId,
  upgrades: ShipUpgrades = DEFAULT_UPGRADES,
  enhancements: EnhancementId[] = [],
  pilotLevel: number = 1,
  allocatedSkills: SkillNodeId[] = []
): GameState {
  setPlanetClassOverride(PLANET_DOMINANT_CLASS[planetId]);
  currentUpgrades = { ...upgrades };
  currentEnhancements = [...enhancements];

  const planet = getPlanetDef(planetId);
  setDifficultyForWorld(planet.pairedWorld);
  resetEnemyIds();
  resetFloatingLabelIds();
  resetBulletIds();
  resetBossBulletIds();
  resetPowerUpIds();

  const levelData = getPlanetLevelData(planetId);
  const waves: Wave[] = levelData.waves.map((def) => ({
    definition: def,
    spawned: false,
    enemiesRemaining: def.enemies.reduce((sum, e) => sum + e.count, 0),
  }));

  const objective = createObjectiveState(planet.objective, planet.objectiveValue);
  const escort = planet.objective === "escort" ? createEscortEntity(planet.objectiveValue) : undefined;
  const defendStructure = planet.objective === "defend" ? createDefendStructure(planet.objectiveValue) : undefined;
  currentHazardState = createHazardState(planetId);

  return {
    screen: GameScreen.BRIEFING,
    player: createPlayer(upgrades, pilotLevel, allocatedSkills),
    playerBullets: [],
    enemyBullets: [],
    enemies: [],
    boss: null,
    powerUps: [],
    activePowerUps: [],
    particles: [],
    explosions: [],
    floatingLabels: [],
    equippedWeaponType: "kinetic",
    pendingBestiaryKills: [],
    background: createBackground(),
    score: 0,
    combo: 0,
    comboTimer: 0,
    maxCombo: 0,
    lives: 3,
    bombs: 2 + upgrades.munitionsBay,
    bombCooldown: 0,
    currentWorld: planet.pairedWorld,
    currentLevel: 1,
    currentWave: 0,
    totalWaves: waves.length,
    waves,
    waveDelay: 120,
    kills: 0,
    totalEnemies: waves.reduce((sum, w) => sum + w.enemiesRemaining, 0),
    deaths: 0,
    frameCount: 0,
    screenShake: 0,
    audioEvents: [],
    bossIntroTimer: 0,
    briefingTimer: 480,
    levelCompleteTimer: 0,
    devInvincible: false,
    dialog: createDialogState(),
    dialogTriggers: getPlanetDialogTriggers(planetId),
    xp: 0,
    hpWarningTriggered: false,
    pilotLevel,
    allocatedSkills,
    currentPhase: 0,
    currentMode: "shooter",
    totalPhases: 1,
    phaseCheckpoint: null,
    phaseTransitionTimer: 0,
    phaseTransitionCard: "",
    phaseTransitionSubtext: "",
    planetId,
    objective,
    escort,
    defendStructure,
    loopFromWave: levelData.loopFromWave,
  };
}

export function createSpecialMissionGameState(
  missionId: SpecialMissionId,
  blackBoxRecovered: boolean,
  upgrades: ShipUpgrades = DEFAULT_UPGRADES,
  enhancements: EnhancementId[] = [],
  pilotLevel: number = 1,
  allocatedSkills: SkillNodeId[] = []
): GameState {
  currentUpgrades = { ...upgrades };
  currentEnhancements = [...enhancements];
  currentAllocatedSkills = [...allocatedSkills];
  currentHazardState = null;
  setPlanetClassOverride(null);
  setDifficultyForWorld(4);
  resetEnemyIds();
  resetFloatingLabelIds();
  resetBulletIds();
  resetBossBulletIds();
  resetPowerUpIds();

  const firstPersonState =
    missionId === "kepler-black-box"
      ? createKeplerBlackBoxFirstPersonState(blackBoxRecovered)
      : createKeplerBlackBoxFirstPersonState(blackBoxRecovered);

  return {
    screen: GameScreen.BRIEFING,
    player: createPlayer(upgrades, pilotLevel, allocatedSkills),
    playerBullets: [],
    enemyBullets: [],
    enemies: [],
    boss: null,
    powerUps: [],
    activePowerUps: [],
    particles: [],
    explosions: [],
    floatingLabels: [],
    equippedWeaponType: "kinetic",
    pendingBestiaryKills: [],
    background: createBackground(),
    score: 0,
    combo: 0,
    comboTimer: 0,
    maxCombo: 0,
    lives: 3,
    bombs: 2 + upgrades.munitionsBay,
    bombCooldown: 0,
    currentWorld: 4,
    currentLevel: 2,
    currentWave: 0,
    totalWaves: 0,
    waves: [],
    waveDelay: 0,
    kills: 0,
    totalEnemies: firstPersonState.enemies.length,
    deaths: 0,
    frameCount: 0,
    screenShake: 0,
    audioEvents: [],
    bossIntroTimer: 0,
    briefingTimer: 360,
    levelCompleteTimer: 0,
    devInvincible: false,
    dialog: createDialogState(),
    dialogTriggers: [],
    xp: 0,
    hpWarningTriggered: false,
    pilotLevel,
    allocatedSkills,
    currentPhase: 0,
    currentMode: "first-person",
    totalPhases: 1,
    phaseCheckpoint: null,
    phaseTransitionTimer: 0,
    phaseTransitionCard: "",
    phaseTransitionSubtext: "",
    firstPersonState,
  };
}

// ─── Update ──────────────────────────────────────────────────────────

export function updateGame(
  state: GameState,
  keys: Keys,
  touchX: number | null,
  touchY: number | null
): GameState {
  // Briefing screen: countdown + animate background
  if (state.screen === GameScreen.BRIEFING) {
    return updateBriefingScreen(state);
  }

  // Boss intro screen: countdown + dramatic effects
  if (state.screen === GameScreen.BOSS_INTRO) {
    return updateBossIntroScreen(state);
  }

  // Boss fight: full gameplay + boss logic
  if (state.screen === GameScreen.BOSS_FIGHT) {
    return updateBossFight(state, keys, touchX, touchY);
  }

  // Phase transition screen: countdown then go directly to PLAYING
  if (state.screen === GameScreen.PHASE_TRANSITION) {
    let s = { ...state, frameCount: state.frameCount + 1, audioEvents: [] as AudioEvent[] };
    s.phaseTransitionTimer -= 1;
    s.background = updateBackground(s.background);
    if (s.phaseTransitionTimer <= 0) {
      // Skip briefing for Phase 2+ — go directly to PLAYING
      s.screen = GameScreen.PLAYING;
      s.waveDelay = 120; // 2s pause before first wave spawns
    }
    return s;
  }

  if (state.screen !== GameScreen.PLAYING) return state;

  // ── Ground-run mode dispatch ──
  if (state.currentMode === "ground-run") {
    const s = { ...state, audioEvents: [] as AudioEvent[], frameCount: state.frameCount + 1 };
    updateGroundEngine(s, keys);
    s.particles = updateParticles(s.particles);
    s.explosions = updateSpriteExplosions(s.explosions);
    s.floatingLabels = updateFloatingLabels(s.floatingLabels);
    s.background = updateBackground(s.background);
    if (s.screenShake > 0) s.screenShake *= 0.9;
    return s;
  }

  // ── Ship boarding mode dispatch ──
  if (state.currentMode === "boarding") {
    const s = { ...state, audioEvents: [] as AudioEvent[], frameCount: state.frameCount + 1 };
    updateBoardingEngine(s, keys);
    s.particles = updateParticles(s.particles);
    s.explosions = updateSpriteExplosions(s.explosions);
    s.floatingLabels = updateFloatingLabels(s.floatingLabels);
    if (s.screenShake > 0) s.screenShake *= 0.9;
    return s;
  }

  // ── First-person raycaster mode dispatch ──
  if (state.currentMode === "first-person") {
    const s = { ...state, audioEvents: [] as AudioEvent[], frameCount: state.frameCount + 1 };
    updateFirstPerson(s, keys);
    if (s.screenShake > 0) s.screenShake *= 0.9;
    return s;
  }

  // ── Ship turret mode dispatch ──
  if (state.currentMode === "turret") {
    const s = { ...state, audioEvents: [] as AudioEvent[], frameCount: state.frameCount + 1 };
    updateTurretEngine(s, keys);
    s.particles = updateParticles(s.particles);
    s.explosions = updateSpriteExplosions(s.explosions);
    s.floatingLabels = updateFloatingLabels(s.floatingLabels);
    if (s.screenShake > 0) s.screenShake *= 0.9;
    return s;
  }

  let s = { ...state, audioEvents: [] as AudioEvent[], frameCount: state.frameCount + 1 };

  // Update background
  s.background = updateBackground(s.background);

  // Update player
  s = updatePlayer(s, keys, touchX, touchY);

  // Spawn waves (track previous wave for dialog triggers)
  const prevWave = s.currentWave;
  s = spawnWaves(s);

  // Update enemies
  s = updateEnemies(s);

  // Player shooting
  s = handlePlayerShooting(s, keys);

  // Bomb activation
  s = handleBomb(s, keys);

  // Update bullets
  s.playerBullets = updateBullets(s.playerBullets, GAME_AREA_HEIGHT);
  s.enemyBullets = updateBullets(s.enemyBullets, GAME_AREA_HEIGHT);

  // Collisions
  s = handleCollisions(s);

  // Planet objective update
  if (s.objective && !s.objective.completed && !s.objective.failed) {
    const objResult = updateObjective(
      s.objective, s.frameCount, s.player, s.enemyBullets, s.enemies,
      s.escort, s.defendStructure
    );
    s.objective = objResult.objective;
    if (objResult.escort) s.escort = objResult.escort;
    if (objResult.structure) s.defendStructure = objResult.structure;
    const hitBullets = (s.objective as ObjectiveState & { _hitBulletIds?: number[] })._hitBulletIds;
    const hitEnemies = (s.objective as ObjectiveState & { _hitEnemyIds?: number[] })._hitEnemyIds;
    if (hitBullets?.length) {
      const hitSet = new Set(hitBullets);
      s.enemyBullets = s.enemyBullets.filter(b => !hitSet.has(b.id));
    }
    if (hitEnemies?.length) {
      const hitSet = new Set(hitEnemies);
      s.enemies = s.enemies.filter(e => !hitSet.has(e.id));
    }
  }

  // Planet hazard update
  if (currentHazardState && s.planetId) {
    const { damage: hazardDmg } = updateHazards(currentHazardState, s.player, s.objective?.intensityTier ?? 0);
    if (hazardDmg > 0 && s.player.invincibleTimer <= 0 && !s.devInvincible) {
      s.player = { ...s.player, hp: s.player.hp - hazardDmg, invincibleTimer: 30 };
      s.screenShake = Math.max(s.screenShake, 3);
    }
  }

  // Incendiary bomb damage zone (enhancement)
  if ((s.incendiaryTimer ?? 0) > 0) {
    s.incendiaryTimer = (s.incendiaryTimer ?? 0) - 1;
    if (s.frameCount % 15 === 0) {
      const survived: typeof s.enemies = [];
      for (const e of s.enemies) {
        const damaged = { ...e, hp: e.hp - 1 };
        if (damaged.hp <= 0) {
          s.score += e.score;
          s.xp += e.score;
          s.kills++;
        } else {
          survived.push(damaged);
        }
      }
      s.enemies = survived;
    }
  }

  // Update power-ups
  s = updatePowerUps(s);

  // Update particles & explosions
  s.particles = updateParticles(s.particles);
  s.floatingLabels = updateFloatingLabels(s.floatingLabels);
  s.explosions = updateSpriteExplosions(s.explosions);

  // Engine trail
  if (s.frameCount % 2 === 0) {
    s.particles = [
      ...s.particles,
      createEngineTrail(
        s.player.x + s.player.width / 2,
        s.player.y + s.player.height
      ),
    ];
  }

  // Combo decay
  if (s.comboTimer > 0) {
    s.comboTimer -= 1;
    if (s.comboTimer <= 0) {
      s.combo = 0;
    }
  }

  // Screen shake decay
  if (s.screenShake > 0) {
    s.screenShake = Math.max(0, s.screenShake - 0.5);
  }

  // Dialog: wave_start trigger when wave advances
  if (s.currentWave !== prevWave) {
    const dr = checkDialogTriggers(s.dialogTriggers, { type: "wave_start", wave: s.currentWave }, s.dialog);
    s.dialog = dr.dialog;
    s.dialogTriggers = dr.triggers;
  }

  // Tick dialog
  s.dialog = updateDialog(s.dialog);

  // Planet mission completion
  if (s.planetId && s.objective) {
    if (s.objective.completed && s.levelCompleteTimer === 0) {
      s.levelCompleteTimer = 360;
      s.xp += 1000;
      s.audioEvents.push(AudioEvent.LEVEL_COMPLETE);
      const dr = checkDialogTriggers(s.dialogTriggers, { type: "level_complete" }, s.dialog);
      s.dialog = dr.dialog;
      s.dialogTriggers = dr.triggers;
    } else if (s.objective.failed) {
      s.screen = GameScreen.GAME_OVER;
      s.audioEvents.push(AudioEvent.GAME_OVER);
    }
  }

  // Check level complete or boss trigger (standard missions)
  if (!s.planetId && s.currentWave >= s.totalWaves && s.enemies.length === 0 && !s.boss) {
    if (s.waveDelay <= 0) {
      const levelData = getLevelData(s.currentWorld, s.currentLevel);
      if (levelData?.isBoss) {
        // Transition to boss intro
        s.screen = GameScreen.BOSS_INTRO;
        s.bossIntroTimer = 180;
      } else if (s.levelCompleteTimer === 0) {
        // Start the level-complete banner (stays in PLAYING)
        s.levelCompleteTimer = 360; // 6 seconds
        s.xp += 500; // XP for level completion
        s.audioEvents.push(AudioEvent.LEVEL_COMPLETE);
        // Fire level_complete dialog
        const dr = checkDialogTriggers(s.dialogTriggers, { type: "level_complete" }, s.dialog);
        s.dialog = dr.dialog;
        s.dialogTriggers = dr.triggers;
      }
    }
  }

  // Level complete timer countdown — show results screen
  if (s.levelCompleteTimer > 0) {
    s.levelCompleteTimer -= 1;
    if (s.levelCompleteTimer <= 0) {
      if (!isLastPhase(s)) {
        s.screen = GameScreen.PHASE_TRANSITION;
        s.phaseTransitionTimer = 180;
        s.currentPhase += 1;
        const multiPhase = getMultiPhaseLevelData(s.currentWorld, s.currentLevel);
        const nextPhaseData = multiPhase?.phases[s.currentPhase];
        const nextMode = nextPhaseData?.config.mode ?? "shooter";
        s.currentMode = nextMode;
        s.phaseCheckpoint = createCheckpoint(s);
        s.phaseTransitionCard = `PHASE ${s.currentPhase + 1}`;
        s.phaseTransitionSubtext = "Preparing next phase...";
        if (nextPhaseData?.transitionIn) {
          s.phaseTransitionCard = nextPhaseData.transitionIn.cardText;
          s.phaseTransitionSubtext = nextPhaseData.transitionIn.cardSubtext ?? "";
          s.phaseTransitionTimer = nextPhaseData.transitionIn.duration;
        }
        if (nextPhaseData?.config.waves) {
          const newWaves = nextPhaseData.config.waves.map((def) => ({
            definition: def,
            spawned: false,
            enemiesRemaining: def.enemies.reduce((sum, e) => sum + e.count, 0),
          }));
          s.waves = newWaves;
          s.currentWave = 0;
          s.totalWaves = newWaves.length;
          s.waveDelay = 120;
          s.totalEnemies += newWaves.reduce((sum, w) => sum + w.enemiesRemaining, 0);
          // Clear battlefield
          s.enemies = [];
          s.enemyBullets = [];
          s.playerBullets = [];
          s.particles = [];
          s.explosions = [];
          s.floatingLabels = [];
          s.boss = null;
        }
        // Initialize mode-specific state
        if (nextPhaseData?.config.mode === "ground-run") {
          const groundState = createTestGroundState();
          const spawn = getGroundSpawn(groundState.tileMap);
          s.groundState = groundState;
          s.boardingState = undefined;
          s.player = { ...s.player, x: spawn.x, y: spawn.y };
        } else if (nextPhaseData?.config.mode === "boarding") {
          const boardingState = createBoardingState();
          const spawn = getBoardingSpawn(boardingState.map);
          s.boardingState = boardingState;
          s.groundState = undefined;
          s.firstPersonState = undefined;
          s.player = { ...s.player, x: spawn.x, y: spawn.y };
        } else if (nextPhaseData?.config.mode === "first-person") {
          const boardingState = createBoardingState();
          s.firstPersonState = {
            map: boardingState.map,
            posX: 2.5, posY: 2.5,
            dirX: 1, dirY: 0,
            planeX: 0, planeY: 0.66,
            moveSpeed: 0.06,
            rotSpeed: 0.04,
            goalReached: false,
            enemies: boardingState.enemies.map((e, i) => ({
              id: i + 1,
              x: e.x / boardingState.map.tileSize + 0.5,
              y: e.y / boardingState.map.tileSize + 0.5,
              hp: e.hp, maxHp: e.maxHp,
              speed: e.type === "charger" ? 0.03 : 0.015,
              type: e.type as "grunt" | "charger" | "sentry",
              aggroRange: e.aggroRange / boardingState.map.tileSize,
              isAggro: false, deathTimer: 0,
              fireTimer: e.fireTimer, classId: e.classId,
            })),
            gunFireTimer: 0,
            gunCooldown: 0,
            npcs: [],
            dialogState: null,
          };
          s.groundState = undefined;
          s.boardingState = undefined;
        } else if (nextPhaseData?.config.mode === "turret") {
          s.turretState = createTurretState();
          s.groundState = undefined;
          s.boardingState = undefined;
          s.firstPersonState = undefined;
        } else {
          s.groundState = undefined;
          s.boardingState = undefined;
          s.firstPersonState = undefined;
          s.turretState = undefined;
        }
      } else {
        s.screen = GameScreen.LEVEL_COMPLETE;
      }
    }
  }

  // Check game over
  if (s.lives <= 0 && s.player.hp <= 0) {
    s.screen = GameScreen.GAME_OVER;
    s.audioEvents.push(AudioEvent.GAME_OVER);
  }

  return s;
}

// ─── Briefing Screen ────────────────────────────────────────────────

function updateBriefingScreen(state: GameState): GameState {
  let s = { ...state, frameCount: state.frameCount + 1, audioEvents: [] as AudioEvent[] };
  s.background = updateBackground(s.background);
  s.briefingTimer -= 1;

  if (s.briefingTimer <= 0) {
    s.screen = GameScreen.PLAYING;
    // Fire level_start dialog triggers
    const result = checkDialogTriggers(s.dialogTriggers, { type: "level_start" }, s.dialog);
    s.dialog = result.dialog;
    s.dialogTriggers = result.triggers;
  }
  return s;
}

// ─── Boss Intro Screen ──────────────────────────────────────────────

function updateBossIntroScreen(state: GameState): GameState {
  let s = { ...state, frameCount: state.frameCount + 1, audioEvents: [] as AudioEvent[] };
  s.background = updateBackground(s.background);
  s.particles = updateParticles(s.particles);
  s.floatingLabels = updateFloatingLabels(s.floatingLabels);
  s.bossIntroTimer -= 1;

  // Fire boss_intro dialog on first frame
  if (s.bossIntroTimer === 179) {
    const result = checkDialogTriggers(s.dialogTriggers, { type: "boss_intro" }, s.dialog);
    s.dialog = result.dialog;
    s.dialogTriggers = result.triggers;
  }

  // Periodic screen shake for drama
  if (s.bossIntroTimer > 60 && s.frameCount % 10 === 0) {
    s.screenShake = 2;
  }
  if (s.screenShake > 0) {
    s.screenShake = Math.max(0, s.screenShake - 0.5);
  }

  // Tick dialog during boss intro
  s.dialog = updateDialog(s.dialog);

  if (s.bossIntroTimer <= 0) {
    s.boss = createBossForWorld(s.currentWorld);
    s.screen = GameScreen.BOSS_FIGHT;
    // Fire level_start triggers for boss fight phase
    const result = checkDialogTriggers(s.dialogTriggers, { type: "level_start" }, s.dialog);
    s.dialog = result.dialog;
    s.dialogTriggers = result.triggers;
  }
  return s;
}

// ─── Boss Fight ─────────────────────────────────────────────────────

function updateBossFight(
  state: GameState,
  keys: Keys,
  touchX: number | null,
  touchY: number | null
): GameState {
  let s = { ...state, audioEvents: [] as AudioEvent[], frameCount: state.frameCount + 1 };
  const prevBossPhase = s.boss?.phase ?? 1;

  s.background = updateBackground(s.background);
  s = updatePlayer(s, keys, touchX, touchY);
  s = handlePlayerShooting(s, keys);
  s = handleBomb(s, keys);

  s.playerBullets = updateBullets(s.playerBullets, GAME_AREA_HEIGHT);
  s.enemyBullets = updateBullets(s.enemyBullets, GAME_AREA_HEIGHT);

  // Update boss
  if (s.boss && !s.boss.defeated) {
    const result = updateBossForWorld(s.currentWorld, s.boss, s.player, s.frameCount);
    s.boss = result.boss;
    // Cap enemy bullets to prevent lag from accumulation
    const combined = [...s.enemyBullets, ...result.bullets];
    s.enemyBullets = combined.length > 80 ? combined.slice(-80) : combined;
    s.enemies = [...s.enemies, ...result.spawnedEnemies];
    s.audioEvents = [...s.audioEvents, ...result.audioEvents];
  }

  // Update minion enemies
  s = updateEnemies(s);

  // Boss collisions
  s = handleBossCollisions(s);

  // Check boss phase change for dialog
  if (s.boss && s.boss.phase !== prevBossPhase) {
    const dr = checkDialogTriggers(s.dialogTriggers, { type: "boss_phase", phase: s.boss.phase }, s.dialog);
    s.dialog = dr.dialog;
    s.dialogTriggers = dr.triggers;
  }

  // Regular enemy/bullet collisions
  s = handleCollisions(s);

  s = updatePowerUps(s);
  s.particles = updateParticles(s.particles);
  s.floatingLabels = updateFloatingLabels(s.floatingLabels);

  if (s.frameCount % 2 === 0) {
    s.particles = [
      ...s.particles,
      createEngineTrail(s.player.x + s.player.width / 2, s.player.y + s.player.height),
    ];
  }

  if (s.comboTimer > 0) {
    s.comboTimer -= 1;
    if (s.comboTimer <= 0) s.combo = 0;
  }

  if (s.screenShake > 0) {
    s.screenShake = Math.max(0, s.screenShake - 0.5);
  }

  // Tick dialog
  s.dialog = updateDialog(s.dialog);

  // Check boss defeated
  if (s.boss && isBossDefeated(s.boss) && !s.boss.defeated) {
    s.boss = { ...s.boss, defeated: true };
    s.score += 5000;
    s.xp += 2000; // XP for boss defeat
    s.xp += 500;  // XP for level completion
    s.screenShake = 10;
    s.audioEvents.push(AudioEvent.BOSS_DEFEAT);

    const bcx = s.boss.x + s.boss.width / 2;
    const bcy = s.boss.y + s.boss.height / 2;
    s.particles = [
      ...s.particles,
      ...createExplosion(bcx, bcy, 30, "#ff8844"),
      ...createExplosion(bcx, bcy, 20, "#ffcc44"),
      ...createExplosion(bcx, bcy, 15, "#ffffff"),
    ];
    s.explosions = [
      ...s.explosions,
      createSpriteExplosion(bcx, bcy, 120),
      createSpriteExplosion(bcx - 40, bcy - 30, 80),
      createSpriteExplosion(bcx + 40, bcy + 20, 80),
    ];

    s.enemyBullets = [];
    s.enemies = [];
    // Stay in BOSS_FIGHT so game loop keeps running (dialog + particles render)
    s.levelCompleteTimer = 360;
    s.audioEvents.push(AudioEvent.LEVEL_COMPLETE);

    // Fire boss_defeat dialog
    const dr = checkDialogTriggers(s.dialogTriggers, { type: "boss_defeat" }, s.dialog);
    s.dialog = dr.dialog;
    s.dialogTriggers = dr.triggers;
  }

  // Boss level complete timer — let dialog play out, then transition
  if (s.levelCompleteTimer > 0) {
    s.levelCompleteTimer -= 1;
    if (s.levelCompleteTimer <= 0) {
      if (!isLastPhase(s)) {
        s.screen = GameScreen.PHASE_TRANSITION;
        s.phaseTransitionTimer = 180;
        s.currentPhase += 1;
        const multiPhase = getMultiPhaseLevelData(s.currentWorld, s.currentLevel);
        const nextPhaseData = multiPhase?.phases[s.currentPhase];
        const nextMode = nextPhaseData?.config.mode ?? "shooter";
        s.currentMode = nextMode;
        s.phaseCheckpoint = createCheckpoint(s);
        s.phaseTransitionCard = `PHASE ${s.currentPhase + 1}`;
        s.phaseTransitionSubtext = "Preparing next phase...";
        if (nextPhaseData?.transitionIn) {
          s.phaseTransitionCard = nextPhaseData.transitionIn.cardText;
          s.phaseTransitionSubtext = nextPhaseData.transitionIn.cardSubtext ?? "";
          s.phaseTransitionTimer = nextPhaseData.transitionIn.duration;
        }
        if (nextPhaseData?.config.waves) {
          const newWaves = nextPhaseData.config.waves.map((def) => ({
            definition: def,
            spawned: false,
            enemiesRemaining: def.enemies.reduce((sum, e) => sum + e.count, 0),
          }));
          s.waves = newWaves;
          s.currentWave = 0;
          s.totalWaves = newWaves.length;
          s.waveDelay = 120;
          s.totalEnemies += newWaves.reduce((sum, w) => sum + w.enemiesRemaining, 0);
          // Clear battlefield
          s.enemies = [];
          s.enemyBullets = [];
          s.playerBullets = [];
          s.particles = [];
          s.explosions = [];
          s.floatingLabels = [];
          s.boss = null;
        }
        // Initialize mode-specific state
        if (nextPhaseData?.config.mode === "ground-run") {
          const groundState = createTestGroundState();
          const spawn = getGroundSpawn(groundState.tileMap);
          s.groundState = groundState;
          s.boardingState = undefined;
          s.player = { ...s.player, x: spawn.x, y: spawn.y };
        } else if (nextPhaseData?.config.mode === "boarding") {
          const boardingState = createBoardingState();
          const spawn = getBoardingSpawn(boardingState.map);
          s.boardingState = boardingState;
          s.groundState = undefined;
          s.firstPersonState = undefined;
          s.player = { ...s.player, x: spawn.x, y: spawn.y };
        } else if (nextPhaseData?.config.mode === "first-person") {
          const boardingState = createBoardingState();
          s.firstPersonState = {
            map: boardingState.map,
            posX: 2.5, posY: 2.5,
            dirX: 1, dirY: 0,
            planeX: 0, planeY: 0.66,
            moveSpeed: 0.06,
            rotSpeed: 0.04,
            goalReached: false,
            enemies: boardingState.enemies.map((e, i) => ({
              id: i + 1,
              x: e.x / boardingState.map.tileSize + 0.5,
              y: e.y / boardingState.map.tileSize + 0.5,
              hp: e.hp, maxHp: e.maxHp,
              speed: e.type === "charger" ? 0.03 : 0.015,
              type: e.type as "grunt" | "charger" | "sentry",
              aggroRange: e.aggroRange / boardingState.map.tileSize,
              isAggro: false, deathTimer: 0,
              fireTimer: e.fireTimer, classId: e.classId,
            })),
            gunFireTimer: 0,
            gunCooldown: 0,
            npcs: [],
            dialogState: null,
          };
          s.groundState = undefined;
          s.boardingState = undefined;
        } else if (nextPhaseData?.config.mode === "turret") {
          s.turretState = createTurretState();
          s.groundState = undefined;
          s.boardingState = undefined;
          s.firstPersonState = undefined;
        } else {
          s.groundState = undefined;
          s.boardingState = undefined;
          s.firstPersonState = undefined;
          s.turretState = undefined;
        }
      } else {
        // Check if this is the final level in the game
        const maxLevels = getWorldLevelCount(s.currentWorld);
        const isLastLevelInWorld = s.currentLevel >= maxLevels;
        let isFinalLevel = false;
        if (isLastLevelInWorld) {
          let nw = s.currentWorld + 1;
          while (nw <= 8 && getWorldLevelCount(nw) === 0) nw++;
          isFinalLevel = nw > 8;
        }
        s.screen = isFinalLevel ? GameScreen.ENDING : GameScreen.LEVEL_COMPLETE;
      }
    }
  }

  // Check game over
  if (s.lives <= 0 && s.player.hp <= 0) {
    s.screen = GameScreen.GAME_OVER;
    s.audioEvents.push(AudioEvent.GAME_OVER);
  }

  return s;
}

// ─── Boss Collisions ────────────────────────────────────────────────

function handleBossCollisions(state: GameState): GameState {
  if (!state.boss || state.boss.defeated) return state;

  let s = { ...state };
  let newParticles = [...s.particles];
  const audioEvents = [...s.audioEvents];
  const destroyedBullets = new Set<number>();

  const boss = s.boss!;
  const weakPoint = boss.parts.find((p) => p.isWeakPoint);

  // Player bullets vs boss
  // Track cumulative damage so multiple bullets in one frame stack correctly
  let bossHp = boss.hp;

  for (const bullet of s.playerBullets) {
    if (destroyedBullets.has(bullet.id)) continue;

    if (aabbOverlap(bullet, boss)) {
      const isVulnerable = weakPoint?.vulnerable ?? false;

      if (isVulnerable) {
        // Mouth open — any hit on the boss deals damage
        if (!bullet.piercing) destroyedBullets.add(bullet.id);

        // TODO(affinity): bosses don't yet have classId — add boss class assignment in future plan
        bossHp = Math.max(0, bossHp - bullet.damage);
        audioEvents.push(AudioEvent.BOSS_HIT);
        newParticles = [
          ...newParticles,
          ...createSparks(bullet.x, bullet.y, 4, "#ff4444"),
        ];
        s.screenShake = Math.max(s.screenShake, 2);
      } else {
        // Mouth closed — deflect
        if (!bullet.piercing) destroyedBullets.add(bullet.id);
        newParticles = [
          ...newParticles,
          ...createSparks(bullet.x, bullet.y, 2, "#888888"),
        ];
      }
    }
  }

  // Apply accumulated damage
  if (bossHp !== boss.hp) {
    s.boss = { ...boss, hp: bossHp };

    // Phase transition
    if (bossHp <= 40 && boss.phase === 1) {
      s.boss = { ...s.boss!, phase: 2, mouthOpen: true, velocityX: boss.velocityX > 0 ? 2 : -2, chargeTimer: 480 };
      audioEvents.push(AudioEvent.BOSS_PHASE);
      s.screenShake = 8;
      newParticles = [
        ...newParticles,
        ...createExplosion(boss.x + boss.width / 2, boss.y + boss.height / 2, 20, "#ffaa00"),
      ];
      s.explosions = [...s.explosions, createSpriteExplosion(boss.x + boss.width / 2, boss.y + boss.height / 2, 90)];
    }
  }

  // Boss body contact damage
  if (s.player.invincibleTimer <= 0 && aabbOverlap(boss, s.player)) {
    const hasShield = s.activePowerUps.some((p) => p.type === PowerUpType.SHIELD);
    if (hasShield) {
      audioEvents.push(AudioEvent.SHIELD_HIT);
      newParticles = [
        ...newParticles,
        ...createSparks(s.player.x + s.player.width / 2, s.player.y, 4, "#4488ff"),
      ];
      s.activePowerUps = s.activePowerUps.map((p) =>
        p.type === PowerUpType.SHIELD
          ? { ...p, remainingFrames: p.remainingFrames - 200 }
          : p
      );
    } else {
      s = playerHit(s, audioEvents, newParticles);
      newParticles = s.particles;
    }
    s.screenShake = Math.max(s.screenShake, 5);
  }

  s.playerBullets = s.playerBullets.filter((b) => !destroyedBullets.has(b.id));
  s.particles = newParticles;
  s.audioEvents = audioEvents;

  return s;
}

// ─── Player Movement ─────────────────────────────────────────────────

function updatePlayer(
  state: GameState,
  keys: Keys,
  touchX: number | null,
  touchY: number | null
): GameState {
  const player = { ...state.player };

  // Speed boost from power-up
  const hasSpeedBoost = state.activePowerUps.some((p) => p.type === PowerUpType.SPEED);
  const speed = player.speed * (hasSpeedBoost ? 1.5 : 1);

  const prevX = player.x;

  if (touchX !== null && touchY !== null) {
    // Touch controls: move towards finger (with offset so ship visible above thumb)
    const targetX = touchX - player.width / 2;
    const targetY = touchY - player.height - 40; // offset above finger
    const dx = targetX - player.x;
    const dy = targetY - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 2) {
      player.x += (dx / dist) * Math.min(speed * 1.5, dist);
      player.y += (dy / dist) * Math.min(speed * 1.5, dist);
    }
  } else {
    // Keyboard controls
    if (keys.left) player.x -= speed;
    if (keys.right) player.x += speed;
    if (keys.up) player.y -= speed;
    if (keys.down) player.y += speed;
  }

  // Clamp to canvas
  player.x = clamp(player.x, 0, CANVAS_WIDTH - player.width);
  player.y = clamp(player.y, 0, GAME_AREA_HEIGHT - player.height);

  // Bank direction based on horizontal movement
  const moveX = player.x - prevX;
  if (moveX < -0.1) player.bankDir = -1;
  else if (moveX > 0.1) player.bankDir = 1;
  else player.bankDir = 0;

  // Invincibility timer
  if (state.devInvincible) {
    player.invincibleTimer = 90; // keep flicker active as visual indicator
  } else if (player.invincibleTimer > 0) {
    player.invincibleTimer -= 1;
  }

  // Fire timer
  if (player.fireTimer > 0) {
    player.fireTimer -= 1;
  }

  return { ...state, player };
}

// ─── Player Shooting ─────────────────────────────────────────────────

function handlePlayerShooting(state: GameState, keys: Keys): GameState {
  if (state.player.fireTimer > 0) return state;

  // Auto-fire when touching, or manual with key
  const shouldFire = keys.shoot;
  if (!shouldFire) return state;

  const hasRapidFire = state.activePowerUps.some((p) => p.type === PowerUpType.RAPID_FIRE);
  const baseRate = PLAYER_FIRE_RATE - currentUpgrades.fireControl;
  const rapidRate = hasRapidFire ? Math.floor(baseRate / 2) : baseRate;
  const fireRateMod = hasSkill(state.allocatedSkills, "adrenaline") ? (1 - getSkillEffect(state.allocatedSkills, "adrenaline")) : 1;
  const fireRate = Math.max(2, Math.floor(rapidRate * fireRateMod));

  const newBullets = firePlayerWeapon(
    state.player,
    state.player.weaponLevel,
    state.equippedWeaponType
  );

  // Side gunners
  const hasSideGunners = state.activePowerUps.some((p) => p.type === PowerUpType.SIDE_GUNNERS);
  if (hasSideGunners && state.frameCount % 3 === 0) {
    const gunnerBullets = fireSideGunners(state.player, state.equippedWeaponType);

    // Homing gunners enhancement: slightly track nearest enemy
    if (hasEnhancement("homing-gunners") && state.enemies.length > 0) {
      for (const gb of gunnerBullets) {
        const bCx = gb.x + gb.width / 2;
        const bCy = gb.y + gb.height / 2;
        let nearest = state.enemies[0];
        let nearDist = Infinity;
        for (const e of state.enemies) {
          const d = Math.abs(e.x + e.width / 2 - bCx) + Math.abs(e.y + e.height / 2 - bCy);
          if (d < nearDist) { nearDist = d; nearest = e; }
        }
        const eCx = nearest.x + nearest.width / 2;
        const dx = eCx - bCx;
        // Nudge horizontal velocity toward enemy (subtle tracking)
        gb.vx = (gb.vx ?? 0) + Math.sign(dx) * 0.8;
      }
    }

    newBullets.push(...gunnerBullets);
  }

  return {
    ...state,
    playerBullets: [...state.playerBullets, ...newBullets],
    player: { ...state.player, fireTimer: fireRate },
    audioEvents: [...state.audioEvents, AudioEvent.PLAYER_SHOOT],
  };
}

// ─── Wave Spawning ───────────────────────────────────────────────────

function spawnWaves(state: GameState): GameState {
  if (state.waveDelay > 0) {
    return { ...state, waveDelay: state.waveDelay - 1 };
  }

  if (state.currentWave >= state.totalWaves) {
    // Survive missions: loop waves back to keep enemies spawning
    if (state.loopFromWave != null && state.loopFromWave < state.totalWaves) {
      // Reset waves from loopFromWave onward so they can re-spawn
      const newWaves = state.waves.map((w, i) =>
        i >= state.loopFromWave! ? { ...w, spawned: false } : w
      );
      return { ...state, currentWave: state.loopFromWave, waves: newWaves };
    }
    return state;
  }

  // Only spawn next wave when current enemies are mostly cleared
  if (state.enemies.length > 3) return state;

  const wave = state.waves[state.currentWave];
  if (wave.spawned) {
    // Move to next wave
    return {
      ...state,
      currentWave: state.currentWave + 1,
      waveDelay: 180, // 3s pause between waves
    };
  }

  // Spawn enemies from wave definition
  let newEnemies = [...state.enemies];
  for (const group of wave.definition.enemies) {
    const spawned = spawnFormation(group.type, group.count, group.formation);
    newEnemies = [...newEnemies, ...spawned];
  }

  const newWaves = [...state.waves];
  newWaves[state.currentWave] = { ...wave, spawned: true };

  return {
    ...state,
    enemies: newEnemies,
    waves: newWaves,
  };
}

// ─── Update Enemies ──────────────────────────────────────────────────

function updateEnemies(state: GameState): GameState {
  let newEnemyBullets = [...state.enemyBullets];
  const audioEvents = [...state.audioEvents];

  const updatedEnemies = state.enemies
    .map((e) => {
      const updated = updateEnemy(e, state.player);

      // Enemy shooting
      if (enemyShouldFire(updated)) {
        const bullets = fireEnemyBullet(updated, state.player);
        newEnemyBullets = [...newEnemyBullets, ...bullets];
        audioEvents.push(AudioEvent.ENEMY_SHOOT);
        return { ...updated, fireTimer: updated.fireRate };
      }

      return { ...updated, fireTimer: updated.fireTimer - 1 };
    })
    .filter((e) => !isEnemyOffscreen(e));

  return {
    ...state,
    enemies: updatedEnemies,
    enemyBullets: newEnemyBullets,
    audioEvents,
  };
}

// ─── Collisions ──────────────────────────────────────────────────────

function handleCollisions(state: GameState): GameState {
  let s = { ...state };
  let newParticles = [...s.particles];
  const newExplosions: SpriteExplosion[] = [];
  const audioEvents = [...s.audioEvents];
  const destroyedBullets = new Set<number>();
  const destroyedEnemies = new Set<number>();

  // Build spatial hash of enemies for broad-phase collision
  spatialHash.clear();
  const enemyById = new Map<number, (typeof s.enemies)[0]>();
  for (const enemy of s.enemies) {
    if (!enemy.cloaked) {
      spatialHash.insert(enemy.id, enemy.x, enemy.y, enemy.width, enemy.height);
      enemyById.set(enemy.id, enemy);
    }
  }

  // Player bullets → Enemies (spatial hash narrows candidates)
  for (const bullet of s.playerBullets) {
    if (destroyedBullets.has(bullet.id)) continue;

    const candidates = spatialHash.query(bullet.x, bullet.y, bullet.width, bullet.height);
    for (const enemyId of candidates) {
      if (destroyedEnemies.has(enemyId)) continue;
      const enemy = enemyById.get(enemyId)!;

      if (aabbOverlap(bullet, enemy)) {
        if (!bullet.piercing) {
          destroyedBullets.add(bullet.id);
        }

        // Compute affinity-adjusted damage
        let finalDamage = bullet.damage;
        if (bullet.isPlayer && bullet.weaponType) {
          const affinity = resolveAffinity(bullet.weaponType, enemy.classId);
          finalDamage = bullet.damage * AFFINITY_MULTIPLIER[affinity];

          // Mark enemy for affinity indicator
          enemy.lastHitAffinity = affinity;
          enemy.lastHitTimer = 120;

          // Spawn floating label for non-neutral hits
          const label = createAffinityLabel(
            enemy.x + enemy.width / 2,
            enemy.y - 4,
            affinity
          );
          if (label) {
            s.floatingLabels = [...s.floatingLabels, label];
          }

          // Sharpshooter: +20% damage on Effective hits
          if (affinity === "effective" && hasSkill(s.allocatedSkills, "sharpshooter")) {
            finalDamage *= 1 + getSkillEffect(s.allocatedSkills, "sharpshooter");
          }

          // Berserker: +5% damage per missing HP
          if (hasSkill(s.allocatedSkills, "berserker")) {
            const missingHp = s.player.maxHp - s.player.hp;
            finalDamage *= 1 + getSkillEffect(s.allocatedSkills, "berserker") * missingHp;
          }

          // Glass Cannon: +30% damage (HP penalty already applied in createPlayer)
          if (hasSkill(s.allocatedSkills, "glass-cannon")) {
            finalDamage *= 1 + getSkillEffect(s.allocatedSkills, "glass-cannon");
          }
        }

        const newHp = enemy.hp - finalDamage;

        if (newHp <= 0) {
          destroyedEnemies.add(enemy.id);
          s.pendingBestiaryKills = [
            ...s.pendingBestiaryKills,
            { type: enemy.type, classId: enemy.classId },
          ];
          audioEvents.push(AudioEvent.ENEMY_DESTROY);

          // Explosion particles + sprite explosion
          const ecx = enemy.x + enemy.width / 2;
          const ecy = enemy.y + enemy.height / 2;
          newParticles = [
            ...newParticles,
            ...createExplosion(ecx, ecy, 12, "#ff8844"),
            ...createSparks(ecx, ecy, 6, "#ffcc44"),
          ];
          newExplosions.push(createSpriteExplosion(ecx, ecy, Math.max(enemy.width, enemy.height) + 16));

          // Score and XP with combo
          const comboMultiplier = Math.min(1 + s.combo * 0.5, COMBO_MAX);
          const earnedScore = Math.floor(enemy.score * comboMultiplier);
          s.score += earnedScore;
          s.xp += earnedScore;
          s.combo += 1;
          s.comboTimer = COMBO_WINDOW;
          s.maxCombo = Math.max(s.maxCombo, s.combo);
          s.kills += 1;

          if (s.combo >= 3) {
            audioEvents.push(AudioEvent.COMBO);
          }

          // Screen shake
          s.screenShake = Math.max(s.screenShake, 3);

          // Power-up drop
          const dropRate = DROP_RATES[enemy.type] ?? 0;
          if (dropRate > 0 && Math.random() < dropRate && s.powerUps.length < MAX_POWERUPS_ON_SCREEN) {
            const puType = pickRandomPowerUpType();
            s.powerUps = [...s.powerUps, createPowerUp(puType, ecx, ecy)];
          }
        } else {
          audioEvents.push(AudioEvent.ENEMY_HIT);
          newParticles = [
            ...newParticles,
            ...createSparks(bullet.x, bullet.y, 3, "#ffffff"),
          ];
        }

        // Update enemy hp in-place
        const eIdx = s.enemies.findIndex((e) => e.id === enemy.id);
        if (eIdx >= 0 && newHp > 0) {
          s.enemies = [...s.enemies];
          s.enemies[eIdx] = { ...s.enemies[eIdx], hp: newHp };
        }

        break; // bullet hits one enemy unless piercing
      }
    }
  }

  // Enemy bullets → Player
  const hasShield = s.activePowerUps.some((p) => p.type === PowerUpType.SHIELD);

  if (s.player.invincibleTimer <= 0) {
    for (const bullet of s.enemyBullets) {
      if (destroyedBullets.has(bullet.id)) continue;

      if (aabbOverlap(bullet, s.player)) {
        destroyedBullets.add(bullet.id);

        if (hasShield) {
          audioEvents.push(AudioEvent.SHIELD_HIT);
          newParticles = [
            ...newParticles,
            ...createSparks(bullet.x, bullet.y, 4, "#4488ff"),
          ];
          // Remove one hit from shield by reducing remaining frames
          s.activePowerUps = s.activePowerUps.map((p) =>
            p.type === PowerUpType.SHIELD
              ? { ...p, remainingFrames: p.remainingFrames - 200 }
              : p
          );
          // Reinforced shield enhancement: reflect 1 bullet back at enemies
          if (hasEnhancement("reinforced-shield")) {
            s.playerBullets = [
              ...s.playerBullets,
              {
                id: ++reflectedBulletId,
                x: bullet.x,
                y: bullet.y,
                width: bullet.width,
                height: bullet.height,
                vx: 0,
                vy: -ENEMY_BULLET_SPEED * 1.5,
                damage: 2,
                piercing: false,
                isPlayer: true,
              },
            ];
          }
        } else {
          s = playerHit(s, audioEvents, newParticles);
          newParticles = s.particles;
        }
        break;
      }
    }
  }

  // Enemies → Player (contact damage)
  if (s.player.invincibleTimer <= 0) {
    for (const enemy of s.enemies) {
      if (destroyedEnemies.has(enemy.id)) continue;
      if (enemy.cloaked) continue;

      if (aabbOverlap(enemy, s.player)) {
        destroyedEnemies.add(enemy.id);
        s.screenShake = Math.max(s.screenShake, 5);

        const ecx = enemy.x + enemy.width / 2;
        const ecy = enemy.y + enemy.height / 2;
        newParticles = [
          ...newParticles,
          ...createExplosion(ecx, ecy, 10, "#ff4444"),
        ];
        newExplosions.push(createSpriteExplosion(ecx, ecy, Math.max(enemy.width, enemy.height) + 16));

        if (hasShield) {
          audioEvents.push(AudioEvent.SHIELD_HIT);
        } else {
          s = playerHit(s, audioEvents, newParticles);
          newParticles = s.particles;
        }
      }
    }
  }

  // Remove destroyed
  s.playerBullets = s.playerBullets.filter((b) => !destroyedBullets.has(b.id));
  s.enemyBullets = s.enemyBullets.filter((b) => !destroyedBullets.has(b.id));
  s.enemies = s.enemies.filter((e) => !destroyedEnemies.has(e.id));
  s.particles = newParticles;
  s.explosions = [...s.explosions, ...newExplosions];
  s.audioEvents = audioEvents;

  return s;
}

function playerHit(
  state: GameState,
  audioEvents: AudioEvent[],
  particles: Particle[]
): GameState {
  // Dev invincibility: skip all damage
  if (state.devInvincible) {
    return { ...state, particles };
  }

  const player = { ...state.player };
  player.hp -= 1;

  const pcx = player.x + player.width / 2;
  const pcy = player.y + player.height / 2;

  if (player.hp <= 0) {
    // Death
    const newLives = state.lives - 1;
    audioEvents.push(AudioEvent.PLAYER_DEATH);

    particles = [
      ...particles,
      ...createExplosion(pcx, pcy, 20, "#ff6644"),
      ...createExplosion(pcx, pcy, 10, "#ffcc44"),
    ];
    const deathExplosions = [...state.explosions, createSpriteExplosion(pcx, pcy, 80)];

    if (newLives > 0) {
      // Respawn
      const newPlayer = createPlayer(currentUpgrades, state.pilotLevel, state.allocatedSkills);
      newPlayer.invincibleTimer = PLAYER_INVINCIBLE_FRAMES * 2;
      newPlayer.weaponLevel = Math.max(1, player.weaponLevel - 1);

      return {
        ...state,
        player: newPlayer,
        lives: newLives,
        deaths: state.deaths + 1,
        particles,
        explosions: deathExplosions,
        screenShake: 8,
      };
    } else {
      return {
        ...state,
        player,
        lives: 0,
        deaths: state.deaths + 1,
        particles,
        explosions: deathExplosions,
        screenShake: 10,
      };
    }
  } else {
    // Hit but survived
    audioEvents.push(AudioEvent.PLAYER_HIT);
    player.invincibleTimer = PLAYER_INVINCIBLE_FRAMES;

    particles = [
      ...particles,
      ...createSparks(pcx, pcy, 8, "#ff8844"),
    ];

    let dialog = state.dialog;
    let hpWarningTriggered = state.hpWarningTriggered;

    // HP warning at critical health (once per level)
    if (player.hp === 1 && player.maxHp > 1 && !hpWarningTriggered) {
      hpWarningTriggered = true;
      dialog = {
        ...dialog,
        queue: [
          ...dialog.queue,
          {
            speaker: "Voss",
            portraitKey: "PORTRAIT_VOSS",
            text: "Hull integrity critical! Get back to the armory for repairs.",
            duration: 180,
            color: "#ff4444",
          },
        ],
      };
    }

    return {
      ...state,
      player,
      particles,
      screenShake: 4,
      dialog,
      hpWarningTriggered,
    };
  }
}

// ─── Bomb Activation ─────────────────────────────────────────────────

const BOMB_COOLDOWN = 30; // half-second cooldown between bombs

function activateBomb(state: GameState): GameState {
  const audioEvents = [...state.audioEvents, AudioEvent.BOMB_ACTIVATE];
  let particles = [...state.particles];
  let enemies = [...state.enemies];
  let score = state.score;
  let xp = state.xp;
  let kills = state.kills;
  let combo = state.combo;
  let comboTimer = state.comboTimer;
  let maxCombo = state.maxCombo;

  // Destroy all non-boss enemies on screen
  const bombExplosions: SpriteExplosion[] = [];
  const bombKills: Array<{ type: EnemyType; classId: EnemyClass }> = [];
  for (const enemy of enemies) {
    const ecx = enemy.x + enemy.width / 2;
    const ecy = enemy.y + enemy.height / 2;
    particles = [
      ...particles,
      ...createExplosion(ecx, ecy, 12, "#ff4444"),
      ...createSparks(ecx, ecy, 6, "#ffcc44"),
    ];
    bombExplosions.push(createSpriteExplosion(ecx, ecy, Math.max(enemy.width, enemy.height) + 16));
    const comboMult = Math.min(1 + combo * 0.5, COMBO_MAX);
    const earnedScore = Math.floor(enemy.score * comboMult);
    score += earnedScore;
    xp += earnedScore;
    combo += 1;
    comboTimer = COMBO_WINDOW;
    maxCombo = Math.max(maxCombo, combo);
    kills += 1;
    bombKills.push({ type: enemy.type, classId: enemy.classId });
  }
  enemies = [];

  // Clear all enemy bullets
  const enemyBullets: Bullet[] = [];

  // Damage boss if present (25 damage)
  let boss = state.boss;
  if (boss && !boss.defeated) {
    boss = { ...boss, hp: Math.max(0, boss.hp - 25) };
    const bcx = boss.x + boss.width / 2;
    const bcy = boss.y + boss.height / 2;
    particles = [
      ...particles,
      ...createExplosion(bcx, bcy, 15, "#ff8844"),
    ];
    bombExplosions.push(createSpriteExplosion(bcx, bcy, 90));
    audioEvents.push(AudioEvent.BOSS_HIT);
  }

  // Big center explosion
  particles = [
    ...particles,
    ...createExplosion(CANVAS_WIDTH / 2, GAME_AREA_HEIGHT / 2, 25, "#ff3333"),
    ...createExplosion(CANVAS_WIDTH / 2, GAME_AREA_HEIGHT / 2, 15, "#ffaa00"),
  ];
  bombExplosions.push(createSpriteExplosion(CANVAS_WIDTH / 2, GAME_AREA_HEIGHT / 2, 100));

  return {
    ...state,
    enemies,
    enemyBullets,
    boss,
    particles,
    explosions: [...state.explosions, ...bombExplosions],
    score,
    xp,
    kills,
    combo,
    comboTimer,
    maxCombo,
    bombs: state.bombs - 1,
    bombCooldown: BOMB_COOLDOWN,
    screenShake: Math.max(state.screenShake, 10),
    audioEvents,
    pendingBestiaryKills: [...state.pendingBestiaryKills, ...bombKills],
    // Incendiary bombs enhancement: leave 3-second damage zone
    incendiaryTimer: hasEnhancement("incendiary-bombs") ? 180 : (state.incendiaryTimer ?? 0),
  };
}

function handleBomb(state: GameState, keys: Keys): GameState {
  // Tick down cooldown
  let s = state;
  if (s.bombCooldown > 0) {
    s = { ...s, bombCooldown: s.bombCooldown - 1 };
  }

  // Activate bomb on key press
  if (keys.bomb && s.bombs > 0 && s.bombCooldown <= 0 && s.player.hp > 0) {
    return activateBomb(s);
  }

  return s;
}

// ─── Power-Ups ───────────────────────────────────────────────────────

function updatePowerUps(state: GameState): GameState {
  const hasMagnet = state.activePowerUps.some((p) => p.type === PowerUpType.MAGNET);
  const pcx = state.player.x + state.player.width / 2;
  const pcy = state.player.y + state.player.height / 2;

  // Move power-ups down (with magnet attraction)
  const updatedPowerUps = state.powerUps
    .map((p) => {
      let { x, y, vy } = p;

      if (hasMagnet) {
        const magnetRange = hasEnhancement("extended-magnet") ? 300 : 150;
        const dx = pcx - (x + p.width / 2);
        const dy = pcy - (y + p.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < magnetRange && dist > 2) {
          const pull = Math.min(4, 150 / dist);
          x += (dx / dist) * pull;
          y += (dy / dist) * pull;
          return { ...p, x, y };
        }
      }

      return { ...p, y: y + vy };
    })
    .filter((p) => p.y < GAME_AREA_HEIGHT + 20);

  // Check collection
  const audioEvents = [...state.audioEvents];
  let activePowerUps = [...state.activePowerUps];
  let player = { ...state.player };
  let particles = [...state.particles];
  let enemies = [...state.enemies];
  let enemyBullets = [...state.enemyBullets];
  let score = state.score;
  let kills = state.kills;
  let combo = state.combo;
  let comboTimer = state.comboTimer;
  let maxCombo = state.maxCombo;
  let screenShake = state.screenShake;
  let bombs = state.bombs;
  let xp = state.xp;
  const collected = new Set<number>();

  for (const pu of updatedPowerUps) {
    if (aabbOverlap(pu, player)) {
      collected.add(pu.id);
      audioEvents.push(AudioEvent.POWER_UP_COLLECT);
      xp += 50; // XP for power-up collection

      if (pu.type === PowerUpType.WEAPON_UP) {
        player.weaponLevel = Math.min(5, player.weaponLevel + 1);
      } else if (pu.type === PowerUpType.BOMB) {
        // Add to bomb inventory (max 5)
        bombs = Math.min(5, bombs + 1);
      } else {
        let dur = POWER_UP_DURATION[pu.type] ?? 600;
        // Shield generator upgrade extends shield duration
        if (pu.type === PowerUpType.SHIELD) {
          dur += currentUpgrades.shieldGenerator * 200;
        }
        // Resonance field enhancement: +25% all power-up durations
        if (hasEnhancement("resonance-field")) {
          dur = Math.floor(dur * 1.25);
        }
        // Overcharge skill: weapon power-ups last 50% longer
        if (hasSkill(currentAllocatedSkills, "overcharge")) {
          dur = Math.floor(dur * (1 + getSkillEffect(currentAllocatedSkills, "overcharge")));
        }
        const existing = activePowerUps.findIndex((a) => a.type === pu.type);

        if (existing >= 0) {
          activePowerUps[existing] = {
            ...activePowerUps[existing],
            remainingFrames: dur,
            totalFrames: dur,
          };
        } else {
          activePowerUps.push({ type: pu.type, remainingFrames: dur, totalFrames: dur });
        }
      }
    }
  }

  // Tick down active power-ups
  activePowerUps = activePowerUps
    .map((a) => ({ ...a, remainingFrames: a.remainingFrames - 1 }))
    .filter((a) => a.remainingFrames > 0);

  return {
    ...state,
    powerUps: updatedPowerUps.filter((p) => !collected.has(p.id)),
    activePowerUps,
    player,
    enemies,
    enemyBullets,
    particles,
    score,
    kills,
    combo,
    comboTimer,
    maxCombo,
    screenShake,
    bombs,
    xp,
    audioEvents,
  };
}

// ─── Pause / State Transitions ───────────────────────────────────────

export function togglePause(state: GameState): GameState {
  if (state.screen === GameScreen.PLAYING) {
    return { ...state, screen: GameScreen.PAUSED };
  }
  if (state.screen === GameScreen.PAUSED) {
    return { ...state, screen: GameScreen.PLAYING };
  }
  return state;
}

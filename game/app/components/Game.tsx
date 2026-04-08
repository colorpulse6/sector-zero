"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GameScreen,
  PowerUpType,
  type GameState,
  type Keys,
  type SpecialMissionId,
} from "./engine/types";
import { createGameState, createPlanetGameState, createSpecialMissionGameState, updateGame, togglePause } from "./engine/gameEngine";
import { completePlanet, getPlanetDef } from "./engine/planets";
import type { PlanetId } from "./engine/types";
import { drawGame, drawStarMap, drawIntroCrawl, INTRO_TOTAL_FRAMES } from "./engine/renderer";
import { AudioEngine } from "./engine/audio";
import {
  addStoryItem,
  completeSpecialMission,
  loadSave,
  saveSave,
  unlockSpecialMission,
  updateLevelResult,
  recalcPilotLevel,
  calculateCreditsEarned,
  getPlayerName,
  updateSectorZeroProfile,
  type SaveData,
} from "./engine/save";
import { WORLD_NAMES, getWorldLevelCount, getMultiPhaseLevelData } from "./engine/levels";
import { preloadAll } from "./engine/sprites";
import {
  type StarMapState,
  createStarMapState,
  updateStarMap,
  resetStarMapKeys,
  getWorldNodes,
} from "./engine/starMap";
import {
  type CockpitHubState,
  createCockpitState,
  updateCockpit,
  resetCockpitKeys,
  getCockpitTouchHotspot,
  COCKPIT_HOTSPOTS,
} from "./engine/cockpit";
import { checkQuestCompletion, type QuestCheckData } from "./engine/sideQuests";
import { recordKill } from "./engine/bestiary";
import { allocateNode } from "./engine/skillTree";
import { drawCockpit } from "./engine/cockpitRenderer";
import { unlockCodexEntry } from "./engine/codex";
import {
  drawPreChoice, drawChoiceScreen, drawEnding, drawCredits,
  PRE_CHOICE_TOTAL_FRAMES, DESTROY_TOTAL_FRAMES, MERGE_TOTAL_FRAMES,
  getCreditsFrameCount,
  type EndingChoice,
} from "./engine/ending";
import { restoreCheckpoint } from "./engine/phases";
import { createTestGroundState, getSpawnPosition as getGroundSpawn } from "./engine/groundLevel";
import { createBoardingState, getBoardingSpawn } from "./engine/boardingLevel";
import { getSpecialMissionDef } from "./engine/specialMissions";
import DevPanel from "./DevPanel";

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showStartScreen, setShowStartScreen] = useState(true);
  const [showIntro, setShowIntro] = useState(false);
  const [showCockpit, setShowCockpit] = useState(false);
  const [cockpitState, setCockpitState] = useState<CockpitHubState>(createCockpitState());
  const [showMap, setShowMap] = useState(false);
  const [starMapState, setStarMapState] = useState<StarMapState>(createStarMapState());
  const [saveData, setSaveData] = useState<SaveData>(loadSave());
  const [endingPhase, setEndingPhase] = useState<"off" | "pre-choice" | "choice" | "ending" | "credits">("off");
  const [endingChoice, setEndingChoice] = useState<EndingChoice>(null);
  const [choiceHover, setChoiceHover] = useState(0);
  const [muted, setMuted] = useState(false);
  const [playerName, setPlayerName] = useState("Guest");
  const [activePlanetId, setActivePlanetId] = useState<PlanetId | null>(null);
  const [activeSpecialMissionId, setActiveSpecialMissionId] = useState<SpecialMissionId | null>(null);
  const [specialPromptChoice, setSpecialPromptChoice] = useState(0);

  const keysRef = useRef<Keys>({
    left: false,
    right: false,
    up: false,
    down: false,
    strafeLeft: false,
    strafeRight: false,
    shoot: false,
    bomb: false,
    jump: false,
  });
  const touchPosRef = useRef<{ x: number; y: number } | null>(null);
  const mouseRef = useRef<{ x: number; y: number; down: boolean }>({ x: 0.5, y: 0.5, down: false });
  const animationFrameRef = useRef<number | null>(null);
  const audioRef = useRef<AudioEngine | null>(null);
  const introFrameRef = useRef(0);
  const endingFrameRef = useRef(0);

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new AudioEngine();
    }
    audioRef.current.init();
    return audioRef.current;
  }, []);

  const finishIntro = useCallback(() => {
    setShowIntro(false);
    introFrameRef.current = 0;
    // If we came from the start screen (replay), return to it
    if (showStartScreen) {
      // Mark as seen but stay on start screen
      if (!saveData.introSeen) {
        const updated = { ...saveData, introSeen: true };
        saveSave(updated);
        setSaveData(updated);
      }
      return;
    }
    // First-time flow: advance into the cockpit
    setShowCockpit(true);
    setGameState(null);
    resetCockpitKeys();
    const updated = { ...saveData, introSeen: true };
    saveSave(updated);
    setSaveData(updated);
  }, [saveData, showStartScreen]);

  const replayIntro = useCallback(() => {
    introFrameRef.current = 0;
    setShowIntro(true);
  }, []);

  const openMap = useCallback(() => {
    const audio = ensureAudio();
    audio.switchMusic("menu");
    setShowStartScreen(false);
    if (!saveData.introSeen) {
      introFrameRef.current = 0;
      setShowIntro(true);
    } else {
      setShowCockpit(true);
      setGameState(null);
      resetCockpitKeys();
    }
  }, [ensureAudio, saveData.introSeen]);

  const shouldPromptKeplerMission =
    gameState?.screen === GameScreen.LEVEL_COMPLETE &&
    !activePlanetId &&
    !activeSpecialMissionId &&
    gameState.currentWorld === 4 &&
    gameState.currentLevel === 2 &&
    !saveData.unlockedSpecialMissions.includes("kepler-black-box");
  const activeSpecialMission = activeSpecialMissionId ? getSpecialMissionDef(activeSpecialMissionId) : null;

  const startLevel = useCallback(
    (world: number, level: number) => {
      const audio = ensureAudio();
      audio.switchMusic("game");
      setShowMap(false);
      setActivePlanetId(null);
      setActiveSpecialMissionId(null);
      setGameState(createGameState(world, level, saveData.upgrades, saveData.unlockedEnhancements));
    },
    [ensureAudio, saveData.upgrades, saveData.unlockedEnhancements]
  );

  const startPlanetMission = useCallback(
    (planetId: PlanetId) => {
      const audio = ensureAudio();
      audio.switchMusic("game");
      setActiveSpecialMissionId(null);
      setActivePlanetId(planetId);
      setGameState(createPlanetGameState(planetId, saveData.upgrades, saveData.unlockedEnhancements));
    },
    [ensureAudio, saveData.upgrades, saveData.unlockedEnhancements]
  );

  const startSpecialMission = useCallback(
    (missionId: SpecialMissionId, overrideSave?: SaveData) => {
      const audio = ensureAudio();
      const missionSave = overrideSave ?? saveData;
      audio.switchMusic("game");
      setShowMap(false);
      setShowCockpit(false);
      setActivePlanetId(null);
      setActiveSpecialMissionId(missionId);
      setGameState(
        createSpecialMissionGameState(
          missionId,
          missionSave.storyItems.includes("kepler-black-box"),
          missionSave.upgrades,
          missionSave.unlockedEnhancements,
          missionSave.pilotLevel,
          missionSave.allocatedSkills
        )
      );
    },
    [ensureAudio, saveData]
  );

  const returnToCockpit = useCallback(() => {
    setGameState(null);
    setActivePlanetId(null);
    setActiveSpecialMissionId(null);
    setEndingPhase("off");
    setEndingChoice(null);
    setShowCockpit(true);
    setSaveData(loadSave());
    resetCockpitKeys();
    audioRef.current?.switchMusic("menu");
  }, []);

  useEffect(() => {
    if (shouldPromptKeplerMission) {
      setSpecialPromptChoice(0);
    }
  }, [shouldPromptKeplerMission]);

  const startEnding = useCallback(() => {
    setGameState(null);
    setEndingPhase("pre-choice");
    setEndingChoice(null);
    setChoiceHover(0);
    endingFrameRef.current = 0;
  }, []);

  const advanceEnding = useCallback(() => {
    if (endingPhase === "pre-choice") {
      setEndingPhase("choice");
      setChoiceHover(0);
    } else if (endingPhase === "ending") {
      setEndingPhase("credits");
      endingFrameRef.current = 0;
    } else if (endingPhase === "credits") {
      returnToCockpit();
    }
  }, [endingPhase, returnToCockpit]);

  const confirmChoice = useCallback((choice: EndingChoice) => {
    setEndingChoice(choice);
    setEndingPhase("ending");
    endingFrameRef.current = 0;
  }, []);

  const restartGame = useCallback(() => {
    const audio = ensureAudio();
    audio.switchMusic("game");
    if (gameState) {
      updateSectorZeroProfile(gameState.score);
    }
    // If we have a checkpoint (multi-phase, not phase 1), restart from checkpoint
    if (gameState?.phaseCheckpoint && gameState.currentPhase > 0) {
      const restored = restoreCheckpoint(gameState, gameState.phaseCheckpoint);
      // For ground-run mode, re-initialize ground state and reset player spawn position
      const isGroundRun = gameState.currentMode === "ground-run";
      const freshGroundState = isGroundRun ? createTestGroundState() : undefined;
      const groundSpawn = isGroundRun && freshGroundState ? getGroundSpawn(freshGroundState.tileMap) : null;
      setGameState({
        ...gameState,
        ...restored,
        screen: GameScreen.PLAYING,
        enemies: [],
        boss: null,
        playerBullets: [],
        enemyBullets: [],
        particles: [],
        explosions: [],
        floatingLabels: [],
        pendingBestiaryKills: [],
        currentWave: 0,
        waveDelay: 120,
        levelCompleteTimer: 0,
        screenShake: 0,
        bombCooldown: 0,
        ...(isGroundRun && freshGroundState && groundSpawn ? {
          groundState: freshGroundState,
          player: { ...restored.player, x: groundSpawn.x, y: groundSpawn.y },
        } : {}),
      } as GameState);
      return;
    }
    if (activeSpecialMissionId) {
      setGameState(
        createSpecialMissionGameState(
          activeSpecialMissionId,
          saveData.storyItems.includes("kepler-black-box"),
          saveData.upgrades,
          saveData.unlockedEnhancements,
          saveData.pilotLevel,
          saveData.allocatedSkills
        )
      );
    } else if (activePlanetId) {
      setGameState(createPlanetGameState(activePlanetId, saveData.upgrades, saveData.unlockedEnhancements));
    } else {
      setGameState(createGameState(gameState?.currentWorld ?? 1, gameState?.currentLevel ?? 1, saveData.upgrades, saveData.unlockedEnhancements));
    }
  }, [gameState, activePlanetId, activeSpecialMissionId, ensureAudio, saveData]);

  const nextLevel = useCallback((options?: { unlockSpecialMission?: SpecialMissionId; launchSpecialMission?: boolean }) => {
    if (!gameState) return;

    if (activeSpecialMissionId) {
      let newSave = {
        ...saveData,
        credits: saveData.credits + calculateCreditsEarned(gameState.score, 1, gameState.currentWorld),
      };

      let updatedBestiary = newSave.bestiary;
      if (gameState.pendingBestiaryKills?.length) {
        for (const kill of gameState.pendingBestiaryKills) {
          updatedBestiary = recordKill(updatedBestiary, kill.type, kill.classId, {
            world: gameState.currentWorld,
          });
        }
      }
      newSave = { ...newSave, bestiary: updatedBestiary };
      newSave = completeSpecialMission(newSave, activeSpecialMissionId);

      if (activeSpecialMissionId === "kepler-black-box" && gameState.firstPersonState?.objectiveCollected) {
        const missionDef = getSpecialMissionDef(activeSpecialMissionId);
        newSave = addStoryItem(newSave, missionDef.storyItemId);
        newSave = unlockCodexEntry(newSave, missionDef.storyCodexId);
      }

      saveSave(newSave);
      setSaveData(newSave);
      returnToCockpit();
      return;
    }

    // Planet mission completion — award rewards and return to cockpit
    if (activePlanetId) {
      let newSave = completePlanet(saveData, activePlanetId);
      // Flush pending bestiary kills
      let updatedBestiary = newSave.bestiary;
      if (gameState?.pendingBestiaryKills?.length) {
        for (const kill of gameState.pendingBestiaryKills) {
          updatedBestiary = recordKill(updatedBestiary, kill.type, kill.classId, {
            world: gameState.currentWorld,
            planetId: gameState.planetId,
          });
        }
      }
      newSave = { ...newSave, bestiary: updatedBestiary };
      saveSave(newSave);
      setSaveData(newSave);
      returnToCockpit();
      return;
    }

    // Save level result
    const stars =
      gameState.deaths === 0 && gameState.kills / Math.max(1, gameState.totalEnemies) >= 0.8
        ? 3
        : gameState.deaths === 0
          ? 2
          : 1;
    let newSave = updateLevelResult(saveData, gameState.currentWorld, gameState.currentLevel, gameState.score, stars, gameState.xp);

    // Perfect clear bonus: 100% enemies killed
    const isPerfectClear = gameState.totalEnemies > 0 && gameState.kills >= gameState.totalEnemies;
    if (isPerfectClear) {
      newSave = { ...newSave, credits: newSave.credits + 500 };
    }

    const prevLevel = newSave.pilotLevel;
    newSave = recalcPilotLevel(newSave);
    if (newSave.pilotLevel > prevLevel) {
      console.log(`PILOT LEVEL UP! ${prevLevel} → ${newSave.pilotLevel}`);
    }

    // Check side quest completion
    const questData: QuestCheckData = {
      world: gameState.currentWorld,
      level: gameState.currentLevel,
      kills: gameState.kills,
      totalEnemies: gameState.totalEnemies,
      deaths: gameState.deaths,
      frameCount: gameState.frameCount,
      playerHp: gameState.player.hp,
      playerMaxHp: gameState.player.maxHp,
    };
    const questResult = checkQuestCompletion(newSave, questData);
    newSave = questResult.newSave;

    // Flush pending bestiary kills
    let updatedBestiary = newSave.bestiary;
    if (gameState?.pendingBestiaryKills?.length) {
      for (const kill of gameState.pendingBestiaryKills) {
        updatedBestiary = recordKill(updatedBestiary, kill.type, kill.classId, {
          world: gameState.currentWorld,
          planetId: gameState.planetId,
        });
      }
    }
    newSave = { ...newSave, bestiary: updatedBestiary };

    // Award multi-phase completion rewards (deduplicated per material)
    const multiPhaseData = getMultiPhaseLevelData(gameState.currentWorld, gameState.currentLevel);
    if (multiPhaseData?.completionRewards && gameState.currentPhase >= gameState.totalPhases - 1) {
      for (const matId of multiPhaseData.completionRewards) {
        if (!newSave.materials.includes(matId)) {
          newSave = { ...newSave, materials: [...newSave.materials, matId] };
        }
      }
    }

    if (options?.unlockSpecialMission) {
      newSave = unlockSpecialMission(newSave, options.unlockSpecialMission);
    }

    saveSave(newSave);
    setSaveData(newSave);

    if (options?.unlockSpecialMission && options.launchSpecialMission) {
      startSpecialMission(options.unlockSpecialMission, newSave);
      return;
    }

    const maxLevels = getWorldLevelCount(gameState.currentWorld);
    const nextLv = gameState.currentLevel + 1;

    // Carry forward state across levels in the same world
    const carryForward = (newState: GameState) => {
      setGameState({
        ...newState,
        score: gameState.score,
        lives: gameState.lives,
        kills: gameState.kills,
        deaths: gameState.deaths,
        maxCombo: gameState.maxCombo,
        devInvincible: gameState.devInvincible,
        activePowerUps: gameState.activePowerUps,
        player: { ...newState.player, weaponLevel: gameState.player.weaponLevel },
      });
    };

    if (nextLv <= maxLevels) {
      // Next level in same world
      carryForward(createGameState(gameState.currentWorld, nextLv, newSave.upgrades, newSave.unlockedEnhancements, newSave.pilotLevel, newSave.allocatedSkills));
    } else {
      // World complete — try advancing to next world
      let nextWorld = gameState.currentWorld + 1;
      while (nextWorld <= 8 && getWorldLevelCount(nextWorld) === 0) {
        nextWorld++;
      }
      if (nextWorld <= 8 && getWorldLevelCount(nextWorld) > 0) {
        carryForward(createGameState(nextWorld, 1, newSave.upgrades, newSave.unlockedEnhancements, newSave.pilotLevel, newSave.allocatedSkills));
      } else {
        startEnding();
      }
    }
  }, [gameState, activePlanetId, activeSpecialMissionId, saveData, returnToCockpit, startEnding, startSpecialMission]);

  const handleDevAction = useCallback(
    (action: string) => {
      if (action.startsWith("goto-level:")) {
        const [, w, l] = action.split(":");
        ensureAudio();
        setShowStartScreen(false);
        setShowMap(false);
        setShowCockpit(false);
        const newState = createGameState(Number(w), Number(l), saveData.upgrades, saveData.unlockedEnhancements);
        const wasInvincible = gameState?.devInvincible ?? false;
        setGameState({ ...newState, devInvincible: wasInvincible });
        return;
      }

      if (action.startsWith("goto-planet:")) {
        const planetId = action.split(":")[1] as PlanetId;
        ensureAudio();
        setShowStartScreen(false);
        setShowMap(false);
        setShowCockpit(false);
        startPlanetMission(planetId);
        return;
      }

      if (action === "goto-ground-run") {
        ensureAudio();
        setShowStartScreen(false);
        setShowMap(false);
        setShowCockpit(false);
        // Create a ground-run state directly (bypass phase system for quick testing)
        const gs = createTestGroundState();
        const spawn = getGroundSpawn(gs.tileMap);
        const baseState = createGameState(1, 3, saveData.upgrades, saveData.unlockedEnhancements, saveData.pilotLevel, saveData.allocatedSkills);
        setGameState({
          ...baseState,
          screen: GameScreen.PLAYING,
          currentMode: "ground-run",
          currentPhase: 1,
          totalPhases: 2,
          groundState: gs,
          player: { ...baseState.player, x: spawn.x, y: spawn.y },
          briefingTimer: 0,
          devInvincible: gameState?.devInvincible ?? false,
        });
        return;
      }

      if (action === "goto-exploration") {
        ensureAudio();
        setShowStartScreen(false);
        setShowMap(false);
        setShowCockpit(false);
        const { createAshfallForwardCampState } = require("./engine/ashfallForwardCamp");
        const fpState = createAshfallForwardCampState();
        console.assert(fpState.npcs.length > 0, "Ashfall camp should launch with NPCs");
        const baseState = createGameState(1, 1, saveData.upgrades, saveData.unlockedEnhancements, saveData.pilotLevel, saveData.allocatedSkills);
        setGameState({
          ...baseState,
          screen: GameScreen.PLAYING,
          currentMode: "first-person",
          currentPhase: 0,
          totalPhases: 1,
          firstPersonState: fpState,
          briefingTimer: 0,
          devInvincible: gameState?.devInvincible ?? false,
        });
        return;
      }

      if (action === "goto-turret") {
        ensureAudio();
        setShowStartScreen(false);
        setShowMap(false);
        setShowCockpit(false);
        const baseState = createGameState(1, 1, saveData.upgrades, saveData.unlockedEnhancements, saveData.pilotLevel, saveData.allocatedSkills);
        setGameState({
          ...baseState,
          screen: GameScreen.PLAYING,
          currentMode: "turret",
          currentPhase: 1,
          totalPhases: 2,
          turretState: {
            crosshairX: 0.5, crosshairY: 0.5,
            enemies: [], shipHp: 10, shipMaxHp: 10,
            wave: 0, totalWaves: 5, waveTimer: 120,
            spawnTimer: 0, enemiesRemaining: 0,
            killCount: 0, targetKills: 0,
            completed: false, fireCooldown: 0,
            bolts: [],
          },
          briefingTimer: 0,
          devInvincible: gameState?.devInvincible ?? false,
        });
        return;
      }

      if (action === "goto-first-person") {
        ensureAudio();
        setShowStartScreen(false);
        setShowMap(false);
        setShowCockpit(false);
        const bs = createBoardingState();
        const baseState = createGameState(1, 3, saveData.upgrades, saveData.unlockedEnhancements, saveData.pilotLevel, saveData.allocatedSkills);
        // Find spawn position in tile coordinates (not pixels)
        let spawnTileX = 2.5;
        let spawnTileY = 2.5;
        for (let r = 0; r < bs.map.height; r++) {
          for (let c = 0; c < bs.map.width; c++) {
            if (bs.map.tiles[r][c] === "spawn") {
              spawnTileX = c + 0.5;
              spawnTileY = r + 0.5;
            }
          }
        }
        // Create enemies from boarding state positions (convert pixel → tile coords)
        const fpEnemies = bs.enemies.map((e, i) => ({
          id: i + 1,
          x: e.x / bs.map.tileSize + 0.5,
          y: e.y / bs.map.tileSize + 0.5,
          hp: e.hp,
          maxHp: e.maxHp,
          speed: e.type === "charger" ? 0.03 : 0.015,
          type: e.type as "grunt" | "charger" | "sentry",
          aggroRange: e.aggroRange / bs.map.tileSize,
          isAggro: false,
          deathTimer: 0,
          fireTimer: e.fireTimer,
          classId: e.classId,
        }));

        setGameState({
          ...baseState,
          screen: GameScreen.PLAYING,
          currentMode: "first-person",
          currentPhase: 1,
          totalPhases: 2,
          firstPersonState: {
            map: bs.map,
            posX: spawnTileX,
            posY: spawnTileY,
            dirX: 1, dirY: 0,
            planeX: 0, planeY: 0.66,
            moveSpeed: 0.06,
            rotSpeed: 0.04,
            goalReached: false,
            enemies: fpEnemies,
            gunFireTimer: 0,
            gunCooldown: 0,
            npcs: [],
            dialogState: null,
          },
          briefingTimer: 0,
          devInvincible: gameState?.devInvincible ?? false,
        });
        return;
      }

      if (action === "goto-boarding") {
        ensureAudio();
        setShowStartScreen(false);
        setShowMap(false);
        setShowCockpit(false);
        const bs = createBoardingState();
        const spawn = getBoardingSpawn(bs.map);
        const baseState = createGameState(1, 3, saveData.upgrades, saveData.unlockedEnhancements, saveData.pilotLevel, saveData.allocatedSkills);
        setGameState({
          ...baseState,
          screen: GameScreen.PLAYING,
          currentMode: "boarding",
          currentPhase: 1,
          totalPhases: 2,
          boardingState: bs,
          player: { ...baseState.player, x: spawn.x, y: spawn.y },
          briefingTimer: 0,
          devInvincible: gameState?.devInvincible ?? false,
        });
        return;
      }

      setGameState((prev) => {
        if (!prev) return null;
        switch (action) {
          case "toggle-invincible":
            return { ...prev, devInvincible: !prev.devInvincible };
          case "max-weapon":
            return { ...prev, player: { ...prev.player, weaponLevel: 5 } };
          case "add-life":
            return { ...prev, lives: prev.lives + 1 };
          case "full-hp":
            return { ...prev, player: { ...prev.player, hp: prev.player.maxHp } };
          case "skip-wave":
            return {
              ...prev,
              enemies: [],
              enemyBullets: [],
              currentWave: Math.min(prev.currentWave + 1, prev.totalWaves),
              waveDelay: 10,
            };
          case "kill-enemies":
            return { ...prev, enemies: [], enemyBullets: [] };
          case "skip-briefing":
            return prev.screen === GameScreen.BRIEFING
              ? { ...prev, briefingTimer: 0 }
              : prev;
          case "spawn-boss": {
            if (prev.boss) return prev;
            return {
              ...prev,
              screen: GameScreen.BOSS_INTRO,
              bossIntroTimer: 180,
              enemies: [],
              enemyBullets: [],
              currentWave: prev.totalWaves,
            };
          }
          case "spawn-powerup": {
            const types = Object.values(PowerUpType);
            const type = types[Math.floor(Math.random() * types.length)];
            const pu = {
              id: Date.now(),
              type,
              x: prev.player.x + prev.player.width / 2 - 12,
              y: prev.player.y - 60,
              width: 24,
              height: 24,
              vy: 1.5,
            };
            return { ...prev, powerUps: [...prev.powerUps, pu] };
          }
          default:
            return prev;
        }
      });
    },
    [gameState?.devInvincible, ensureAudio, startPlanetMission]
  );

  // Keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isFirstPerson = gameState?.currentMode === "first-person";

      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
        e.preventDefault();
      }

      switch (e.key) {
        case "ArrowLeft":
          keysRef.current.left = true;
          if (shouldPromptKeplerMission) setSpecialPromptChoice(0);
          break;
        case "ArrowRight":
          keysRef.current.right = true;
          if (shouldPromptKeplerMission) setSpecialPromptChoice(1);
          break;
        case "a":
          if (isFirstPerson) {
            keysRef.current.strafeLeft = true;
          } else {
            keysRef.current.left = true;
          }
          break;
        case "d":
          if (isFirstPerson) {
            keysRef.current.strafeRight = true;
          } else {
            keysRef.current.right = true;
          }
          break;
        case "ArrowUp":
        case "w":
          keysRef.current.up = true;
          if (endingPhase === "choice") setChoiceHover(0);
          if (shouldPromptKeplerMission) setSpecialPromptChoice(0);
          break;
        case "ArrowDown":
        case "s":
          keysRef.current.down = true;
          if (endingPhase === "choice") setChoiceHover(1);
          if (shouldPromptKeplerMission) setSpecialPromptChoice(1);
          break;
        case " ":
          keysRef.current.shoot = true;
          keysRef.current.jump = true;
          break;
        case "z":
        case "Z":
        case "Shift":
          keysRef.current.shoot = true;
          break;
        case "b":
          keysRef.current.bomb = true;
          break;
        case "Enter":
          if (showStartScreen) {
            openMap();
          } else if (showIntro) {
            finishIntro();
          } else if (endingPhase === "pre-choice" || endingPhase === "ending" || endingPhase === "credits") {
            advanceEnding();
          } else if (endingPhase === "choice") {
            confirmChoice(choiceHover === 0 ? "destroy" : "merge");
          } else if (showCockpit) {
            keysRef.current.shoot = true;
          } else if (showMap) {
            keysRef.current.shoot = true;
          } else if (gameState?.screen === GameScreen.BRIEFING) {
            setGameState((prev) => prev ? { ...prev, briefingTimer: 0 } : null);
          } else if (gameState?.screen === GameScreen.PHASE_TRANSITION) {
            // Only allow skip after 1s minimum
            if (gameState.phaseTransitionTimer < 120) {
              setGameState((prev) => prev ? { ...prev, phaseTransitionTimer: 0 } : prev);
            }
          } else if (gameState?.screen === GameScreen.GAME_OVER) {
            returnToCockpit();
          } else if (gameState?.screen === GameScreen.LEVEL_COMPLETE) {
            if (shouldPromptKeplerMission) {
              if (specialPromptChoice === 0) {
                nextLevel({ unlockSpecialMission: "kepler-black-box", launchSpecialMission: true });
              } else {
                nextLevel({ unlockSpecialMission: "kepler-black-box" });
              }
            } else {
              nextLevel();
            }
          }
          break;
        case "Escape":
          if (showCockpit) {
            setShowCockpit(false);
            setShowStartScreen(true);
          } else if (showMap) {
            setShowMap(false);
            setShowCockpit(true);
            resetCockpitKeys();
          } else if (gameState?.screen === GameScreen.PAUSED) {
            returnToCockpit();
          } else if (gameState?.screen === GameScreen.GAME_OVER || gameState?.screen === GameScreen.LEVEL_COMPLETE) {
            returnToCockpit();
          } else if (gameState?.screen === GameScreen.PLAYING || gameState?.screen === GameScreen.BOSS_FIGHT) {
            setGameState((prev) => (prev ? togglePause(prev) : null));
          }
          break;
        case "p":
          if (gameState && gameState.screen === GameScreen.PLAYING) {
            setGameState((prev) => (prev ? togglePause(prev) : null));
          } else if (gameState?.screen === GameScreen.PAUSED) {
            setGameState((prev) => (prev ? togglePause(prev) : null));
          }
          break;
        case "m":
          if (audioRef.current) {
            const nowMuted = audioRef.current.toggleMute();
            setMuted(nowMuted);
          }
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          keysRef.current.left = false;
          break;
        case "ArrowRight":
          keysRef.current.right = false;
          break;
        case "a":
          keysRef.current.left = false;
          keysRef.current.strafeLeft = false;
          break;
        case "d":
          keysRef.current.right = false;
          keysRef.current.strafeRight = false;
          break;
        case "ArrowUp":
        case "w":
          keysRef.current.up = false;
          break;
        case "ArrowDown":
        case "s":
          keysRef.current.down = false;
          break;
        case " ":
          keysRef.current.shoot = false;
          keysRef.current.jump = false;
          break;
        case "z":
        case "Z":
        case "Shift":
          keysRef.current.shoot = false;
          break;
        case "b":
          keysRef.current.bomb = false;
          break;
        case "Enter":
          keysRef.current.shoot = false;
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [showStartScreen, showIntro, endingPhase, choiceHover, showCockpit, showMap, gameState, openMap, finishIntro, advanceEnding, confirmChoice, restartGame, nextLevel, returnToCockpit, shouldPromptKeplerMission, specialPromptChoice]);

  // Touch input
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getCanvasPos = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      touchPosRef.current = getCanvasPos(touch.clientX, touch.clientY);
      if (!showCockpit) {
        keysRef.current.shoot = true;
        // Two-finger tap activates bomb
        if (e.touches.length >= 2) {
          keysRef.current.bomb = true;
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      touchPosRef.current = getCanvasPos(touch.clientX, touch.clientY);
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      touchPosRef.current = null;
      keysRef.current.shoot = false;
      keysRef.current.bomb = false;

      if (showStartScreen) {
        openMap();
      } else if (showIntro) {
        finishIntro();
      } else if (endingPhase === "choice") {
        // Detect which choice was tapped
        const touch = e.changedTouches[0];
        if (touch) {
          const pos = getCanvasPos(touch.clientX, touch.clientY);
          if (pos.y >= 320 && pos.y < 420) {
            confirmChoice("destroy");
          } else if (pos.y >= 460 && pos.y < 560) {
            confirmChoice("merge");
          }
        }
      } else if (endingPhase === "pre-choice" || endingPhase === "ending" || endingPhase === "credits") {
        advanceEnding();
      } else if (showCockpit) {
        const touch = e.changedTouches[0];
        if (touch) {
          const pos = getCanvasPos(touch.clientX, touch.clientY);
          if (cockpitState.screen === "hub") {
            const hotspotIndex = getCockpitTouchHotspot(pos.x, pos.y);
            if (hotspotIndex >= 0) {
              const hotspot = COCKPIT_HOTSPOTS[hotspotIndex];
              if (hotspot.id === "starmap") {
                setShowCockpit(false);
                setShowMap(true);
                resetStarMapKeys();
              } else {
                setCockpitState(prev => ({ ...prev, screen: hotspot.id, selectedHotspot: hotspotIndex }));
              }
            }
          } else {
            // In sub-screen, tap to go back to hub
            setCockpitState(prev => ({ ...prev, screen: "hub" }));
          }
        }
      } else if (gameState?.screen === GameScreen.BRIEFING) {
        setGameState((prev) => prev ? { ...prev, briefingTimer: 0 } : null);
      } else if (gameState?.screen === GameScreen.PHASE_TRANSITION) {
        if (gameState.phaseTransitionTimer < 120) {
          setGameState((prev) => prev ? { ...prev, phaseTransitionTimer: 0 } : prev);
        }
      } else if (gameState?.screen === GameScreen.GAME_OVER) {
        returnToCockpit();
      } else if (gameState?.screen === GameScreen.LEVEL_COMPLETE) {
        if (shouldPromptKeplerMission) {
          if (specialPromptChoice === 0) {
            nextLevel({ unlockSpecialMission: "kepler-black-box", launchSpecialMission: true });
          } else {
            nextLevel({ unlockSpecialMission: "kepler-black-box" });
          }
        } else {
          nextLevel();
        }
      }
    };

    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
    };
  }, [showStartScreen, showIntro, endingPhase, showCockpit, cockpitState.screen, showMap, gameState, openMap, finishIntro, advanceEnding, confirmChoice, restartGame, nextLevel, returnToCockpit, shouldPromptKeplerMission, specialPromptChoice]);

  // Intro crawl loop
  useEffect(() => {
    if (!showIntro) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const introLoop = () => {
      introFrameRef.current += 1;
      drawIntroCrawl(ctx, introFrameRef.current);

      if (introFrameRef.current >= INTRO_TOTAL_FRAMES) {
        finishIntro();
        return;
      }

      animationFrameRef.current = requestAnimationFrame(introLoop);
    };

    animationFrameRef.current = requestAnimationFrame(introLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [showIntro, finishIntro]);

  // Ending sequence loop (pre-choice, choice, ending, credits)
  useEffect(() => {
    if (endingPhase === "off") return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const endingLoop = () => {
      endingFrameRef.current += 1;
      const frame = endingFrameRef.current;

      if (endingPhase === "pre-choice") {
        drawPreChoice(ctx, frame);
        if (frame >= PRE_CHOICE_TOTAL_FRAMES) {
          setEndingPhase("choice");
          setChoiceHover(0);
          return;
        }
      } else if (endingPhase === "choice") {
        drawChoiceScreen(ctx, frame, choiceHover);
      } else if (endingPhase === "ending") {
        drawEnding(ctx, frame, endingChoice);
        const totalFrames = endingChoice === "destroy" ? DESTROY_TOTAL_FRAMES : MERGE_TOTAL_FRAMES;
        if (frame >= totalFrames) {
          setEndingPhase("credits");
          endingFrameRef.current = 0;
          return;
        }
      } else if (endingPhase === "credits") {
        drawCredits(ctx, frame, endingChoice);
        if (frame >= getCreditsFrameCount(endingChoice)) {
          returnToCockpit();
          return;
        }
      }

      animationFrameRef.current = requestAnimationFrame(endingLoop);
    };

    animationFrameRef.current = requestAnimationFrame(endingLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [endingPhase, endingChoice, choiceHover, advanceEnding, returnToCockpit]);

  // Star map loop
  useEffect(() => {
    if (!showMap) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mapLoop = () => {
      const { newState, action } = updateStarMap(starMapState, keysRef.current, saveData);
      setStarMapState(newState);

      if (action.type === "select-level" && action.world && action.level) {
        startLevel(action.world, action.level);
        return;
      }
      if (action.type === "back") {
        setShowMap(false);
        setShowCockpit(true);
        resetCockpitKeys();
        return;
      }

      drawStarMap(ctx, newState, saveData);
      animationFrameRef.current = requestAnimationFrame(mapLoop);
    };

    animationFrameRef.current = requestAnimationFrame(mapLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [showMap, starMapState, saveData, startLevel]);

  // Cockpit hub loop
  useEffect(() => {
    if (!showCockpit) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cockpitLoop = () => {
      const { newState, action } = updateCockpit(cockpitState, keysRef.current, saveData);
      setCockpitState(newState);

      // Play cockpit audio events
      for (const event of newState.audioEvents) {
        audioRef.current?.play(event);
      }

      if (action.type === "open-starmap") {
        setShowCockpit(false);
        setShowMap(true);
        resetStarMapKeys();
        return;
      }

      if (action.type === "launch-planet" && action.planetId) {
        setShowCockpit(false);
        startPlanetMission(action.planetId);
        return;
      }

      if (action.type === "launch-special-mission" && action.missionId) {
        startSpecialMission(action.missionId);
        return;
      }

      if (action.type === "save-updated" && action.save) {
        saveSave(action.save);
        setSaveData(action.save);
      }

      if (action.type === "allocate-skill") {
        const result = allocateNode(action.nodeId, saveData.allocatedSkills, saveData.skillPoints);
        if (result) {
          const newSave = {
            ...saveData,
            allocatedSkills: result.allocated,
            skillPoints: result.pointsRemaining,
          };
          saveSave(newSave);
          setSaveData(newSave);
        }
      }

      drawCockpit(ctx, newState, action.type === "save-updated" && action.save ? action.save : saveData);
      animationFrameRef.current = requestAnimationFrame(cockpitLoop);
    };

    animationFrameRef.current = requestAnimationFrame(cockpitLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [showCockpit, cockpitState, saveData, startPlanetMission, startSpecialMission]);

  // Game loop
  useEffect(() => {
    if (!gameState || showStartScreen || showCockpit || showMap) return;
    const activeScreens = [GameScreen.PLAYING, GameScreen.BOSS_FIGHT, GameScreen.BOSS_INTRO, GameScreen.BRIEFING, GameScreen.PHASE_TRANSITION];
    if (!activeScreens.includes(gameState.screen)) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const gameLoop = () => {
      // Feed mouse position into turret crosshair + mouse-click as shoot
      if (gameState?.currentMode === "turret" && gameState.turretState) {
        const m = mouseRef.current;
        gameState.turretState.crosshairX = Math.max(0.05, Math.min(0.95, m.x));
        gameState.turretState.crosshairY = Math.max(0.05, Math.min(0.95, m.y));
        if (m.down) keysRef.current.shoot = true;
      }

      const newState = updateGame(
        gameState,
        keysRef.current,
        touchPosRef.current?.x ?? null,
        touchPosRef.current?.y ?? null
      );

      // Play audio events
      for (const event of newState.audioEvents) {
        audioRef.current?.play(event);
      }

      setGameState(newState);
      drawGame(ctx, newState);

      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameState, showStartScreen, showCockpit, showMap, saveData]);

  // Auto-trigger ending when game engine sets ENDING screen (final boss defeated)
  useEffect(() => {
    if (gameState?.screen === GameScreen.ENDING && endingPhase === "off") {
      // Save the final level result before transitioning
      const stars =
        gameState.deaths === 0 && gameState.kills / Math.max(1, gameState.totalEnemies) >= 0.8
          ? 3
          : gameState.deaths === 0
            ? 2
            : 1;
      let finalSave = updateLevelResult(saveData, gameState.currentWorld, gameState.currentLevel, gameState.score, stars, gameState.xp);
      const finalPrevLevel = finalSave.pilotLevel;
      finalSave = recalcPilotLevel(finalSave);
      if (finalSave.pilotLevel > finalPrevLevel) {
        console.log(`PILOT LEVEL UP! ${finalPrevLevel} → ${finalSave.pilotLevel}`);
      }
      const questData: QuestCheckData = {
        world: gameState.currentWorld,
        level: gameState.currentLevel,
        kills: gameState.kills,
        totalEnemies: gameState.totalEnemies,
        deaths: gameState.deaths,
        frameCount: gameState.frameCount,
        playerHp: gameState.player.hp,
        playerMaxHp: gameState.player.maxHp,
      };
      finalSave = checkQuestCompletion(finalSave, questData).newSave;
      // Flush pending bestiary kills
      let finalBestiary = finalSave.bestiary;
      if (gameState?.pendingBestiaryKills?.length) {
        for (const kill of gameState.pendingBestiaryKills) {
          finalBestiary = recordKill(finalBestiary, kill.type, kill.classId, {
            world: gameState.currentWorld,
            planetId: gameState.planetId,
          });
        }
      }
      finalSave = { ...finalSave, bestiary: finalBestiary };
      saveSave(finalSave);
      setSaveData(finalSave);
      startEnding();
    }
  }, [gameState?.screen, endingPhase, gameState, saveData, startEnding]);

  // Draw non-playing screens
  useEffect(() => {
    if (!gameState || showStartScreen || showCockpit || showMap) return;
    const loopScreens = [GameScreen.PLAYING, GameScreen.BOSS_FIGHT, GameScreen.BOSS_INTRO, GameScreen.BRIEFING];
    if (loopScreens.includes(gameState.screen)) return;
    // ENDING screen is handled by the ending sequence, not drawGame
    if (gameState.screen === GameScreen.ENDING) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    drawGame(ctx, gameState);
  }, [gameState, showStartScreen, showCockpit, showMap]);

  // Save on game over
  useEffect(() => {
    if (gameState?.screen === GameScreen.GAME_OVER) {
      updateSectorZeroProfile(gameState.score);
    }
  }, [gameState?.screen, gameState?.score]);

  // Load player name and preload sprites
  useEffect(() => {
    setPlayerName(getPlayerName());
    setSaveData(loadSave());
    preloadAll();
  }, []);

  return (
    <div className="relative w-full h-screen flex items-center justify-center bg-black">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="border border-white/10"
        style={{
          maxHeight: "100vh",
          maxWidth: "100vw",
          objectFit: "contain",
          cursor: gameState?.currentMode === "turret" ? "none" : "default",
        }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const scaleX = CANVAS_WIDTH / rect.width;
          const scaleY = CANVAS_HEIGHT / rect.height;
          mouseRef.current.x = (e.clientX - rect.left) * scaleX / CANVAS_WIDTH;
          mouseRef.current.y = (e.clientY - rect.top) * scaleY / CANVAS_HEIGHT;
        }}
        onMouseDown={(e) => {
          if (e.button === 0) mouseRef.current.down = true;
        }}
        onMouseUp={(e) => {
          if (e.button === 0) mouseRef.current.down = false;
        }}
        onMouseLeave={() => {
          mouseRef.current.down = false;
        }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const scaleX = CANVAS_WIDTH / rect.width;
          const scaleY = CANVAS_HEIGHT / rect.height;
          const cx = (e.clientX - rect.left) * scaleX;
          const cy = (e.clientY - rect.top) * scaleY;

          // Cockpit hub — click on hotspots
          if (showCockpit && cockpitState.screen === "hub") {
            for (let i = 0; i < COCKPIT_HOTSPOTS.length; i++) {
              const h = COCKPIT_HOTSPOTS[i];
              if (cx >= h.x && cx <= h.x + h.w && cy >= h.y && cy <= h.y + h.h) {
                setCockpitState((prev) => ({
                  ...prev,
                  screen: h.id,
                  selectedHotspot: i,
                }));
                break;
              }
            }
          }

          // Cockpit sub-screens — click near top-left to go back
          if (showCockpit && cockpitState.screen !== "hub") {
            if (cx < 60 && cy < 50) {
              setCockpitState((prev) => ({ ...prev, screen: "hub" }));
            }
          }

          // Star map — click on world nodes to select
          if (showMap && starMapState) {
            const worldNodes = getWorldNodes(saveData);
            for (const node of worldNodes) {
              if (!node.unlocked) continue;
              const dx = cx - node.x;
              const dy = cy - node.y;
              if (dx * dx + dy * dy < 30 * 30) {
                if (starMapState.selectedWorld === node.world && !starMapState.expanded) {
                  // Double-click to expand
                  setStarMapState((prev) => prev ? { ...prev, expanded: true, selectedLevel: 1 } : prev);
                } else {
                  setStarMapState((prev) => prev ? { ...prev, selectedWorld: node.world, expanded: false } : prev);
                }
                break;
              }
            }
          }
        }}
      />

      {/* Start Screen */}
      {showStartScreen && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 text-white">
          <h1
            className="text-5xl font-bold mb-2 tracking-[0.3em]"
            style={{
              background: "linear-gradient(135deg, #44ccff, #aa44ff, #ff4444)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            SECTOR ZERO
          </h1>
          <p className="text-gray-600 text-sm mb-1 tracking-wider">
            THE LAST PILOT OF SECTOR ZERO
          </p>
          <p className="text-gray-700 text-xs mb-4">{playerName}</p>

          {/* Scrolling story crawl */}
          <div
            className="relative overflow-hidden w-full max-w-lg mb-6"
            style={{ height: "180px", maskImage: "linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)" }}
          >
            <div className="sector-crawl absolute left-0 right-0 text-center text-gray-400 text-xs leading-relaxed space-y-3">
              <p className="text-cyan-400 font-bold tracking-[0.2em] text-sm">THE YEAR 2847</p>
              <p>Humanity has spread across the stars.<br/>Thousands of colony worlds.<br/>A golden age of expansion.</p>
              <p className="text-purple-400 italic">Then The Signal arrived.</p>
              <p>An electromagnetic whisper from the void.<br/>Coming from a region every star chart<br/>labeled FORBIDDEN.</p>
              <p className="text-cyan-400 font-bold tracking-[0.2em] text-sm">SECTOR ZERO</p>
              <p>The colonies closest to the source<br/>fell silent first. Then entire systems<br/>went dark.</p>
              <p>Survivors spoke of hostiles<br/>unlike anything in our records.</p>
              <p className="text-cyan-400 font-bold tracking-[0.2em] text-sm">THE HOLLOW</p>
              <p>An alien hivemind.<br/>Fast. Adaptive. Relentless.<br/>They consumed everything in their path.</p>
              <p>The United Earth Coalition<br/>has one option remaining.</p>
              <p>Send a strike team into Sector Zero.<br/>Find the source of The Signal.<br/>Destroy the Hollow Mind.<br/>End this war.</p>
              <p className="text-purple-400 italic">Whatever the cost.</p>
            </div>
          </div>
          <div className="text-center mb-6 text-gray-400 text-xs space-y-1">
            <p>Arrow Keys / WASD to move</p>
            <p>SPACE to shoot</p>
            <p>P to pause &middot; M to mute</p>
          </div>

          <button
            onClick={openMap}
            className="px-8 py-4 border-2 border-cyan-400 text-cyan-400 text-lg hover:bg-cyan-400 hover:text-black transition-colors tracking-wider"
          >
            START MISSION
          </button>
        </div>
      )}

      {/* Paused Overlay */}
      {gameState?.screen === GameScreen.PAUSED && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white">
          <div className="text-center">
            <h2 className="text-4xl font-bold mb-4 tracking-wider">PAUSED</h2>
            <p className="text-gray-500 text-sm mb-6">
              {WORLD_NAMES[gameState.currentWorld - 1]} &mdash; Level {gameState.currentLevel}
            </p>
            <div className="flex flex-col gap-3 items-center">
              <button
                onClick={() => setGameState((prev) => (prev ? togglePause(prev) : null))}
                className="px-8 py-3 border-2 border-cyan-400 text-cyan-400 text-lg hover:bg-cyan-400 hover:text-black transition-colors tracking-wider w-56"
              >
                RESUME
              </button>
              <button
                onClick={returnToCockpit}
                className="px-8 py-3 border-2 border-gray-600 text-gray-400 text-lg hover:bg-gray-600 hover:text-white transition-colors tracking-wider w-56"
              >
                RETURN TO HUB
              </button>
            </div>
            <p className="text-gray-600 text-xs mt-4">ESC to return to hub</p>
          </div>
        </div>
      )}

      {/* Level Complete Overlay (boss levels + planet missions) */}
      {gameState?.screen === GameScreen.LEVEL_COMPLETE && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white">
          <h2
            className="text-4xl font-bold mb-4 tracking-wider"
            style={{
              background: activePlanetId || activeSpecialMissionId
                ? "linear-gradient(135deg, #44ffaa, #44ccff)"
                : "linear-gradient(135deg, #FFD700, #FF6600)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {activePlanetId || activeSpecialMissionId ? "MISSION COMPLETE" : "LEVEL COMPLETE"}
          </h2>
          <div className="text-center mb-6 space-y-2">
            {activePlanetId && (
              <p className="text-cyan-300 text-lg mb-2">
                {getPlanetDef(activePlanetId).name}
              </p>
            )}
            {activeSpecialMission && (
              <p className="text-amber-300 text-lg mb-2">
                {activeSpecialMission.name}
              </p>
            )}
            <p className="text-2xl">
              Score: <span className="text-yellow-400 font-bold">{gameState.score}</span>
            </p>
            {(() => {
              const killPct = gameState.totalEnemies > 0
                ? Math.floor((gameState.kills / gameState.totalEnemies) * 100)
                : 0;
              const isPerfect = killPct === 100;
              return (
                <>
                  <div className="w-64 mx-auto mt-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className={isPerfect ? "text-yellow-300 font-bold" : "text-gray-400"}>
                        Enemies: {gameState.kills}/{gameState.totalEnemies}
                      </span>
                      <span className={isPerfect ? "text-yellow-300 font-bold" : "text-gray-500"}>
                        {killPct}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isPerfect ? "bg-yellow-400" : "bg-cyan-500"}`}
                        style={{ width: `${killPct}%` }}
                      />
                    </div>
                    {isPerfect && (
                      <p className="text-yellow-300 text-xs mt-1 font-bold tracking-wider animate-pulse">
                        PERFECT CLEAR! +500 BONUS CREDITS
                      </p>
                    )}
                  </div>
                  <p className="text-gray-500 text-sm">Deaths: {gameState.deaths}</p>
                </>
              );
            })()}
            {gameState.maxCombo >= 3 && (
              <p className="text-yellow-500">Max Combo: {gameState.maxCombo}x</p>
            )}
            {!activePlanetId && !activeSpecialMissionId && (
              <div className="flex justify-center gap-2 mt-2">
                {[1, 2, 3].map((star) => {
                  const earned =
                    star === 1 ? true :
                    star === 2 ? gameState.deaths === 0 :
                    gameState.deaths === 0 && gameState.kills / Math.max(1, gameState.totalEnemies) >= 0.8;
                  return (
                    <span
                      key={star}
                      className={`text-3xl ${earned ? "text-yellow-400" : "text-gray-700"}`}
                    >
                      &#9733;
                    </span>
                  );
                })}
              </div>
            )}
            {activePlanetId && !saveData.completedPlanets.includes(activePlanetId) && (
              <div className="mt-3 space-y-1">
                <p className="text-sm text-green-400">+ {getPlanetDef(activePlanetId).material.replace(/-/g, " ").toUpperCase()}</p>
                {getPlanetDef(activePlanetId).enhancementUnlock && (
                  <p className="text-sm text-purple-400">+ {getPlanetDef(activePlanetId).enhancementUnlock!.replace(/-/g, " ").toUpperCase()}</p>
                )}
              </div>
            )}
            {activeSpecialMissionId === "kepler-black-box" && gameState.firstPersonState?.objectiveCollected && !saveData.storyItems.includes("kepler-black-box") && (
              <div className="mt-3 space-y-1">
                <p className="text-sm text-amber-300 font-bold animate-pulse">+ KEPLER BLACK BOX</p>
                <p className="text-sm text-cyan-300">+ REYES RECORDER LOG</p>
              </div>
            )}
            <p className="text-lg mt-3" style={{ color: "#44ff88" }}>
              +{calculateCreditsEarned(
                gameState.score,
                activeSpecialMissionId
                  ? 1
                  : gameState.deaths === 0 && gameState.kills / Math.max(1, gameState.totalEnemies) >= 0.8 ? 3 :
                    gameState.deaths === 0 ? 2 : 1,
                gameState.currentWorld
              )} CREDITS
            </p>
            {shouldPromptKeplerMission && (
              <div className="mt-4 max-w-md space-y-3 border border-amber-500/40 bg-amber-950/20 px-4 py-4">
                <p className="text-sm text-amber-300 font-bold tracking-wider">REYES</p>
                <p className="text-sm text-gray-200">
                  I&apos;m reading a surviving recorder beacon inside one of the Kepler wrecks.
                  If that black box is still intact, it can tell us what happened to these ships.
                </p>
                <p className="text-xs text-gray-400">
                  Board now, or continue the campaign and recover it later from the Mission Board.
                </p>
              </div>
            )}
            {(() => {
              const mpData = getMultiPhaseLevelData(gameState.currentWorld, gameState.currentLevel);
              if (!mpData?.completionRewards?.length) return null;
              if (gameState.currentPhase < gameState.totalPhases - 1) return null;
              const newMats = mpData.completionRewards.filter(
                (m) => !saveData.materials.includes(m)
              );
              if (newMats.length === 0) return null;
              return (
                <div className="mt-2 space-y-1">
                  {newMats.map((matId) => (
                    <p key={matId} className="text-sm text-purple-400 font-bold animate-pulse">
                      + {matId.replace(/-/g, " ").toUpperCase()} (RARE)
                    </p>
                  ))}
                </div>
              );
            })()}
          </div>
          <div className="flex gap-4">
            {shouldPromptKeplerMission ? (
              <>
                <button
                  onClick={() => nextLevel({ unlockSpecialMission: "kepler-black-box", launchSpecialMission: true })}
                  className={`px-8 py-4 border-2 text-lg transition-colors tracking-wider ${
                    specialPromptChoice === 0
                      ? "border-amber-300 bg-amber-300 text-black"
                      : "border-amber-500 text-amber-300 hover:bg-amber-500 hover:text-black"
                  }`}
                >
                  BOARD THE WRECK
                </button>
                <button
                  onClick={() => nextLevel({ unlockSpecialMission: "kepler-black-box" })}
                  className={`px-6 py-4 border-2 text-lg transition-colors tracking-wider ${
                    specialPromptChoice === 1
                      ? "border-cyan-300 bg-cyan-300 text-black"
                      : "border-gray-600 text-gray-300 hover:bg-gray-600 hover:text-white"
                  }`}
                >
                  CONTINUE
                </button>
              </>
            ) : (
              <button
                onClick={() => nextLevel()}
                className="px-8 py-4 border-2 border-cyan-400 text-cyan-400 text-lg hover:bg-cyan-400 hover:text-black transition-colors tracking-wider"
              >
                {activePlanetId || activeSpecialMissionId ? "COMPLETE" : "NEXT LEVEL"}
              </button>
            )}
            <button
              onClick={returnToCockpit}
              className="px-6 py-4 border-2 border-gray-600 text-gray-400 text-lg hover:bg-gray-600 hover:text-white transition-colors tracking-wider"
            >
              HUB
            </button>
          </div>
        </div>
      )}

      {/* Game Over Overlay */}
      {gameState?.screen === GameScreen.GAME_OVER && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white">
          <h2 className="text-5xl font-bold mb-4 text-red-500 tracking-wider">GAME OVER</h2>
          <div className="text-center mb-8 space-y-2">
            <p className="text-2xl">
              Score: <span className="text-yellow-400 font-bold">{gameState.score}</span>
            </p>
            <p className="text-gray-400">
              {WORLD_NAMES[gameState.currentWorld - 1]} &mdash; Level {gameState.currentLevel}
            </p>
            <p className="text-gray-500 text-sm">
              Kills: {gameState.kills} &middot; Max Combo: {gameState.maxCombo}x
            </p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={restartGame}
              className="px-8 py-4 border-2 border-cyan-400 text-cyan-400 text-lg hover:bg-cyan-400 hover:text-black transition-colors tracking-wider"
            >
              TRY AGAIN
            </button>
            {gameState.currentPhase > 0 && (
              <button
                onClick={() => {
                  if (!gameState) return;
                  setGameState(createGameState(
                    gameState.currentWorld,
                    gameState.currentLevel,
                    saveData.upgrades,
                    saveData.unlockedEnhancements,
                    saveData.pilotLevel,
                    saveData.allocatedSkills
                  ));
                }}
                className="px-6 py-4 border-2 border-yellow-600 text-yellow-400 text-lg hover:bg-yellow-600 hover:text-black transition-colors tracking-wider"
              >
                RESTART LEVEL
              </button>
            )}
            <button
              onClick={returnToCockpit}
              className="px-6 py-4 border-2 border-gray-600 text-gray-400 text-lg hover:bg-gray-600 hover:text-white transition-colors tracking-wider"
            >
              HUB
            </button>
          </div>
        </div>
      )}

      {/* Pause button — visible during active gameplay for mobile access to hub */}
      {gameState && (gameState.screen === GameScreen.PLAYING || gameState.screen === GameScreen.BOSS_FIGHT || gameState.screen === GameScreen.BOSS_INTRO) && (
        <button
          onClick={() => setGameState((prev) => (prev ? togglePause(prev) : null))}
          className="absolute top-2 left-2 w-10 h-10 flex items-center justify-center bg-black/50 border border-white/20 text-white/60 hover:text-white hover:bg-black/70 transition-colors z-10 rounded"
          title="Pause (ESC)"
        >
          <span className="text-lg font-bold">⏸</span>
        </button>
      )}

      {/* Mute button */}
      {(gameState || showCockpit || showMap || endingPhase !== "off") && !showStartScreen && (
        <button
          onClick={() => {
            if (audioRef.current) {
              const nowMuted = audioRef.current.toggleMute();
              setMuted(nowMuted);
            }
          }}
          className="absolute top-2 right-2 text-gray-500 hover:text-white transition-colors text-sm z-10"
          title="Toggle sound (M)"
        >
          {muted ? "MUTE" : "SND"}
        </button>
      )}

      {/* Dev Panel — development only */}
      {process.env.NODE_ENV === "development" && (
        <DevPanel gameState={gameState} onAction={handleDevAction} />
      )}
    </div>
  );
}

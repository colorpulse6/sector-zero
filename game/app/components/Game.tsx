"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
  createHydrationSafeSave,
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
import { applyShopPurchase } from "./engine/consumables";
import {
  drainShopPurchaseRequest,
  setShopPurchaseFeedback,
  shopPurchaseFeedback,
} from "./engine/shopServices";
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
import { createTurretState } from "./engine/turretEngine";
import { createBoardingState, getBoardingSpawn } from "./engine/boardingLevel";
import { getSpecialMissionDef } from "./engine/specialMissions";
import {
  advanceWorldCycle,
  colonyReducer,
  colonyMerchantRank,
  enterColonyExploration,
  stepColonyExploration,
  exitColonyExploration,
  applyMissionDelivery,
  resolveMissionDelivery,
  deliveryPayloadLabel,
  LandingPadExitMenu,
} from "./colony";
import type { ColonyEvent, SceneStack } from "./colony";
import { ColoniesScreen } from "./colony/meta";
import { PoiOutcomeScreen, RegionMapScreen } from "./colony/meta";
import { foundOutpost } from "./colony/region/siteEconomy";
import { dispatchPoi, regionExpeditionRequestId, startRegionExpedition } from "./colony/region/poiDispatcher";
import { createPoiGameState, preparePoiCompletion, resolvePoiCompletion, type ActivePoiDescriptor, type PendingPoiResolution } from "./colony/region/poiRuntime";
import { applyColonyFixture, findFixture } from "./colony/dev/seedColony";
import DevPanel from "./DevPanel";
import { createGradePass } from "./engine/postFx";
import { selectPreset, type GradeScene } from "./engine/postFx/presets";
import { GalaxyAtlasScreen, GalaxyExperienceGate } from "./galaxy";
import {
  attemptCanonicalPersistence,
  beginGalaxyExperience,
  experienceReturnLabel,
  galaxyPoiRecoverySurface,
  isInteractiveKeyboardTarget,
  mapSurfaceForExperience,
  operationSurfaceLabel,
  returnSurfaceForOperation,
} from "./engine/galaxy/experienceFlow";
import type { ExperienceMode } from "./engine/galaxy/galaxyTypes";
import type { AtlasTarget, RoutePlan } from "./engine/galaxy/routePlanner";
import {
  commitTravel,
  emergencyRetreat,
  finalizeTravel,
  resumeTravelToBoundary,
} from "./engine/galaxy/travelResolver";
import { projectGalaxyRunToLegacySave } from "./engine/galaxy/galaxyProjection";
import { authorizeOperationLaunch } from "./engine/operations/operationCatalog";
import {
  applyOperationOutcome,
  normalizeOperationOutcome,
  type OperationResultKind,
} from "./engine/operations/operationOutcome";
import type {
  OperationId,
  OperationLaunchContext,
} from "./engine/operations/operationTypes";
import {
  foundGalaxyOutpost,
  isGalaxyPoiPreparationFact,
  launchOperation,
  openGalaxyRegion,
  prepareGalaxyPoiCompletion,
  recoverGalaxyPoiCompletion,
  resolveGalaxyPoiCompletion,
  startGalaxyRegionExpedition,
  type GalaxyPendingPoiResolution,
} from "./engine/operations/operationAdapters";
import { applyGalaxyFixture, findGalaxyFixture } from "./galaxy/devFixtures";

type RegionMapSurface = {
  mode: "pad" | "view";
  originColonyId: string;
  experience: ExperienceMode;
};

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // WebGL overlay canvas that presents the graded frame over the 2D game canvas.
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showStartScreen, setShowStartScreen] = useState(true);
  const [showIntro, setShowIntro] = useState(false);
  const [showCockpit, setShowCockpit] = useState(false);
  const [cockpitState, setCockpitState] = useState<CockpitHubState>(createCockpitState());
  const [showMap, setShowMap] = useState(false);
  const [showGalaxyAtlas, setShowGalaxyAtlas] = useState(false);
  const [atlasSelectedTarget, setAtlasSelectedTarget] = useState<AtlasTarget | undefined>();
  const [atlasStatusMessage, setAtlasStatusMessage] = useState<string | null>(null);
  const [starMapState, setStarMapState] = useState<StarMapState>(createStarMapState());
  const [saveData, setSaveData] = useState<SaveData>(createHydrationSafeSave);
  const [saveHydrated, setSaveHydrated] = useState(false);
  const [endingPhase, setEndingPhase] = useState<"off" | "pre-choice" | "choice" | "ending" | "credits">("off");
  const [endingChoice, setEndingChoice] = useState<EndingChoice>(null);
  const [choiceHover, setChoiceHover] = useState(0);
  const [muted, setMuted] = useState(false);
  const [playerName, setPlayerName] = useState("Guest");
  const [activePlanetId, setActivePlanetId] = useState<PlanetId | null>(null);
  const [activeSpecialMissionId, setActiveSpecialMissionId] = useState<SpecialMissionId | null>(null);
  const [activeOperationId, setActiveOperationId] = useState<OperationId | null>(null);
  const [activeOperationContext, setActiveOperationContext] = useState<OperationLaunchContext | null>(null);
  const [operationOutcomeError, setOperationOutcomeError] = useState<string | null>(null);
  const [galaxyRecoveryError, setGalaxyRecoveryError] = useState<string | null>(null);
  const [specialPromptChoice, setSpecialPromptChoice] = useState(0);
  const [sceneStack, setSceneStack] = useState<SceneStack | null>(null);
  const [exitMenuOpen, setExitMenuOpen] = useState(false);
  const [regionMapSurface, setRegionMapSurface] = useState<RegionMapSurface | null>(null);
  const [activePoi, setActivePoi] = useState<ActivePoiDescriptor | null>(null);
  const [activePoiExperience, setActivePoiExperience] = useState<ExperienceMode | null>(null);
  const [pendingPoiResolution, setPendingPoiResolution] = useState<PendingPoiResolution | GalaxyPendingPoiResolution | null>(null);
  const [poiOutcomeResolving, setPoiOutcomeResolving] = useState(false);
  const [poiOutcomeError, setPoiOutcomeError] = useState<string | null>(null);
  const saveDataRef = useRef(saveData);
  const expeditionRequestRef = useRef<string | null>(null);
  const poiCompletionHandledRef = useRef(false);
  const poiResolutionRef = useRef(false);
  const operationOutcomeHandledRef = useRef(false);
  const atlasReturnFocusIdRef = useRef("sector-zero-game-canvas");
  const atlasShouldRestoreFocusRef = useRef(true);

  useEffect(() => { saveDataRef.current = saveData; }, [saveData]);

  useEffect(() => {
    const loaded = loadSave();
    saveDataRef.current = loaded;
    setSaveData(loaded);
    setSaveHydrated(true);
  }, []);

  const persistCanonicalSave = useCallback((next: SaveData) => {
    saveSave(next);
    saveDataRef.current = next;
    setSaveData(next);
  }, []);

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
  // Last mouse position already applied to the turret crosshair — lets keyboard
  // aiming coexist with the mouse (an idle mouse must not stomp arrow-key aim
  // back to its own position every frame).
  const lastTurretMouseRef = useRef<{ x: number; y: number } | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  // Dedicated rAF handle for the grade-pass present loop. MUST stay separate from
  // animationFrameRef, which is shared/clobbered across the game/intro/ending loops.
  const presentRafRef = useRef<number | null>(null);
  // Scene key the present rAF reads for grade-preset selection (it can't read
  // React state). The game loop stamps the live mode each tick; the menu-
  // detection effect below flips it back to "menu" whenever gameplay isn't
  // the active surface — gameStateRef alone goes stale on those screens.
  const presetModeRef = useRef<GradeScene>("menu");
  const audioRef = useRef<AudioEngine | null>(null);
  const introFrameRef = useRef(0);
  const endingFrameRef = useRef(0);
  // Wall-clock timestamp of the previous simulated frame, for delta-time scaling.
  const lastFrameTsRef = useRef(0);
  // Unconsumed wall-clock time (ms) carried between rAF callbacks by the
  // fixed-timestep game loop — see the accumulator note inside gameLoop.
  const simAccumulatorRef = useRef(0);
  // Live mirror of gameState for the grade-pass present loop, whose raw rAF can't
  // read React state. Updated every game-loop tick (see below); the present loop
  // reads .currentMode to pick a grade preset. Starts null until the first tick.
  const gameStateRef = useRef(gameState);

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

  const openExperienceMap = useCallback(() => {
    const surface = mapSurfaceForExperience(saveDataRef.current.activeExperience);
    setShowCockpit(false);
    setGameState(null);
    if (surface === "galaxy_atlas") {
      setShowMap(false);
      setShowGalaxyAtlas(true);
      setAtlasStatusMessage(null);
      audioRef.current?.switchMusic("menu");
      return;
    }
    setShowGalaxyAtlas(false);
    setShowMap(true);
    resetStarMapKeys();
  }, []);

  const beginGalaxy = useCallback(() => {
    if (!saveHydrated) return;
    const begun = beginGalaxyExperience(saveDataRef.current);
    const recovered = begun.galaxyRun?.historyFacts.some(isGalaxyPoiPreparationFact)
      ? recoverGalaxyPoiCompletion(begun, "contact:ashfall")
      : { ok: true as const, save: begun, pending: null };
    const recoverySurface = galaxyPoiRecoverySurface(recovered);
    const canonical = recovered.ok ? recovered.save : begun;
    persistCanonicalSave(canonical);
    ensureAudio().switchMusic("menu");
    setShowStartScreen(false);
    setShowIntro(false);
    setShowCockpit(false);
    setShowMap(false);
    setGameState(null);
    setActivePlanetId(null);
    setActiveSpecialMissionId(null);
    setActiveOperationId(null);
    setActiveOperationContext(null);
    setOperationOutcomeError(null);
    setGalaxyRecoveryError(
      recoverySurface === "blocked"
        ? "ASHFALL OUTCOME JOURNAL COULD NOT BE VERIFIED. THE GALAXY RUN IS LOCKED TO PREVENT LOST CARGO OR DUPLICATE REWARDS."
        : null,
    );
    setActivePoi(null);
    setActivePoiExperience(recoverySurface === "poi_outcome" ? "galaxy" : null);
    setPendingPoiResolution(recovered.ok ? recovered.pending : null);
    setPoiOutcomeResolving(false);
    setPoiOutcomeError(null);
    setRegionMapSurface(null);
    setShowGalaxyAtlas(recoverySurface === "atlas");
    setAtlasStatusMessage(
      !recovered.ok
        ? "ASHFALL OUTCOME RECOVERY FAILED · JOURNAL REJECTED"
        : recovered.pending
          ? "ASHFALL OUTCOME RECOVERED · DELIVERY STILL PENDING"
          : null,
    );
  }, [ensureAudio, persistCanonicalSave, saveHydrated]);

  const beginLegacy = useCallback(() => {
    if (!saveHydrated) return;
    const legacy = { ...saveDataRef.current, activeExperience: "legacy" as const };
    persistCanonicalSave(legacy);
    setGalaxyRecoveryError(null);
    setShowGalaxyAtlas(false);
    openMap();
  }, [openMap, persistCanonicalSave, saveHydrated]);

  const restoreAtlasInvokerFocus = useCallback(() => {
    if (!atlasShouldRestoreFocusRef.current) {
      atlasShouldRestoreFocusRef.current = true;
      return;
    }
    requestAnimationFrame(() => {
      document.getElementById(atlasReturnFocusIdRef.current)?.focus();
    });
  }, []);

  const shouldPromptKeplerMission =
    gameState?.screen === GameScreen.LEVEL_COMPLETE &&
    !activePlanetId &&
    !activeSpecialMissionId &&
    !activeOperationId &&
    gameState.currentWorld === 4 &&
    gameState.currentLevel === 2 &&
    !saveData.unlockedSpecialMissions.includes("kepler-black-box");
  const activeSpecialMission = activeSpecialMissionId ? getSpecialMissionDef(activeSpecialMissionId) : null;

  const travelSave = useCallback((result: ReturnType<typeof commitTravel>) => {
    if (!result.ok) {
      setAtlasStatusMessage(result.errors.map((entry) => entry.message).join(" · "));
      return null;
    }
    const current = saveDataRef.current;
    const next = result.save ?? { ...current, galaxyRun: result.galaxyRun };
    if (result.changed) persistCanonicalSave(next);
    return next;
  }, [persistCanonicalSave]);

  const handleCommitTravel = useCallback((plan: RoutePlan) => {
    const committed = commitTravel(saveDataRef.current, plan);
    const committedSave = travelSave(committed);
    if (committedSave === null) return;
    const resumed = resumeTravelToBoundary(committedSave);
    const resumedSave = travelSave(resumed);
    if (resumedSave === null) return;
    const travel = resumedSave.galaxyRun?.activeTravel;
    setAtlasStatusMessage(
      travel?.state === "interrupted"
        ? "TRAVEL INTERRUPTED · HOSTILE PICKET OPERATION REQUIRED"
        : travel?.state === "arrived"
          ? "ARRIVAL JOURNALED · ACKNOWLEDGE TO PLOT ANOTHER ROUTE"
          : "TRAVEL STATE SAVED",
    );
  }, [travelSave]);

  const handleResumeTravel = useCallback(() => {
    const resumed = resumeTravelToBoundary(saveDataRef.current);
    if (travelSave(resumed) !== null) setAtlasStatusMessage("TRAVEL RESUMED");
  }, [travelSave]);

  const handleFinalizeTravel = useCallback(() => {
    const finalized = finalizeTravel(saveDataRef.current);
    if (travelSave(finalized) !== null) setAtlasStatusMessage("ARRIVAL ACKNOWLEDGED");
  }, [travelSave]);

  const handleEmergencyRetreat = useCallback(() => {
    const retreated = emergencyRetreat(saveDataRef.current);
    if (travelSave(retreated) !== null) setAtlasStatusMessage("EMERGENCY RETREAT COMPLETE · RETURNED TO ORIGIN");
  }, [travelSave]);

  const mountAuthorizedOperation = useCallback((context: OperationLaunchContext) => {
    const current = saveDataRef.current;
    if (current.galaxyRun === null) {
      setAtlasStatusMessage("NO ACTIVE GALAXY RUN");
      return false;
    }
    try {
      const projected = projectGalaxyRunToLegacySave(current);
      const launched = launchOperation(current.galaxyRun, projected, context);
      if (!launched.ok) {
        setAtlasStatusMessage(launched.availability.reasons.join(" · "));
        return false;
      }
      ensureAudio().switchMusic("game");
      operationOutcomeHandledRef.current = false;
      setActiveOperationId(launched.context.operationId);
      setActiveOperationContext(launched.context);
      setOperationOutcomeError(null);
      setActivePlanetId(null);
      setActiveSpecialMissionId(null);
      setActivePoi(null);
      setActivePoiExperience(null);
      setPendingPoiResolution(null);
      setRegionMapSurface(null);
      setShowStartScreen(false);
      setShowCockpit(false);
      setShowMap(false);
      atlasShouldRestoreFocusRef.current = true;
      setShowGalaxyAtlas(false);
      setGameState(launched.gameState);
      return true;
    } catch {
      setAtlasStatusMessage("OPERATION PROJECTION COULD NOT BE OPENED");
      return false;
    }
  }, [ensureAudio]);

  const handleLaunchOperation = useCallback((operationId: OperationId) => {
    const run = saveDataRef.current.galaxyRun;
    if (run === null) {
      setAtlasStatusMessage("NO ACTIVE GALAXY RUN");
      return;
    }
    const authorized = authorizeOperationLaunch(run, operationId);
    if (!authorized.ok) {
      setAtlasStatusMessage(authorized.availability.reasons.join(" · "));
      return;
    }
    mountAuthorizedOperation(authorized.context);
  }, [mountAuthorizedOperation]);

  const foldOperationResult = useCallback((
    context: OperationLaunchContext,
    result: OperationResultKind,
    state: GameState | null,
  ) => {
    if (operationOutcomeHandledRef.current) return false;
    const current = saveDataRef.current;
    if (current.galaxyRun === null) {
      const message = "OPERATION OUTCOME LOST ITS GALAXY RUN";
      setOperationOutcomeError(message);
      setAtlasStatusMessage(message);
      return false;
    }
    operationOutcomeHandledRef.current = true;
    const completionId = [
      "operation",
      context.operationId,
      context.authorizedCycle,
      context.travelTransactionId === null ? "standalone" : "travel",
      result,
    ].join(":");
    const normalized = normalizeOperationOutcome(current.galaxyRun, context, {
      completionId,
      result,
      metrics: context.operationId === "op:hostile-picket"
        ? { frameCount: state?.frameCount ?? 0 }
        : null,
    });
    if (!normalized.ok) {
      operationOutcomeHandledRef.current = false;
      const message = normalized.errors.map((entry) => entry.message).join(" · ");
      setOperationOutcomeError(message);
      setAtlasStatusMessage(message);
      return false;
    }
    const applied = applyOperationOutcome(current, normalized.outcome);
    if (!applied.ok) {
      operationOutcomeHandledRef.current = false;
      const message = applied.errors.map((entry) => entry.message).join(" · ");
      setOperationOutcomeError(message);
      setAtlasStatusMessage(message);
      return false;
    }
    if (applied.changed && !attemptCanonicalPersistence(applied.save, persistCanonicalSave).ok) {
      operationOutcomeHandledRef.current = false;
      const message = "OUTCOME SAVE FAILED · FREE SPACE AND RETRY";
      setOperationOutcomeError(message);
      setAtlasStatusMessage(message);
      return false;
    }
    setOperationOutcomeError(null);
    returnSurfaceForOperation(applied.save);
    setGameState(null);
    setActiveOperationId(null);
    setActiveOperationContext(null);
    setShowMap(false);
    setShowCockpit(false);
    setShowGalaxyAtlas(true);
    setAtlasStatusMessage(
      result === "success"
        ? "OPERATION COMPLETE · OUTCOME JOURNALED"
        : result === "retreat"
          ? "OPERATION RETREAT JOURNALED"
          : "OPERATION FAILED · VESSEL STATUS UPDATED",
    );
    audioRef.current?.switchMusic("menu");
    return true;
  }, [persistCanonicalSave]);

  const handleTravelRetreat = useCallback(() => {
    const run = saveDataRef.current.galaxyRun;
    if (run === null || run.activeTravel?.interruptionOperationId !== "op:hostile-picket") {
      setAtlasStatusMessage("NO RETREATABLE INTERRUPTION IS ACTIVE");
      return;
    }
    const authorized = authorizeOperationLaunch(run, "op:hostile-picket");
    if (!authorized.ok) {
      setAtlasStatusMessage(authorized.availability.reasons.join(" · "));
      return;
    }
    operationOutcomeHandledRef.current = false;
    foldOperationResult(authorized.context, "retreat", null);
  }, [foldOperationResult]);

  const abandonOperationToAtlas = useCallback(() => {
    setGameState(null);
    setActiveOperationId(null);
    setActiveOperationContext(null);
    setOperationOutcomeError(null);
    setShowCockpit(false);
    setShowMap(false);
    setShowGalaxyAtlas(true);
    setAtlasStatusMessage("OPERATION SUSPENDED · NO OUTCOME WAS JOURNALED");
    operationOutcomeHandledRef.current = false;
    audioRef.current?.switchMusic("menu");
  }, []);

  const returnGalaxyPoiToAtlas = useCallback(() => {
    if (activePoiExperience === "galaxy" && pendingPoiResolution !== null) {
      setPoiOutcomeError("DELIVERY MUST BE RESOLVED BEFORE RETURNING TO THE ATLAS");
      return;
    }
    setGameState(null);
    setActivePoi(null);
    setActivePoiExperience(null);
    setPendingPoiResolution(null);
    setPoiOutcomeResolving(false);
    setRegionMapSurface(null);
    setSceneStack(null);
    setExitMenuOpen(false);
    setShowCockpit(false);
    setShowMap(false);
    setShowGalaxyAtlas(true);
    setAtlasStatusMessage("RETURNED FROM ASHFALL REGION");
    poiCompletionHandledRef.current = false;
    poiResolutionRef.current = false;
    audioRef.current?.switchMusic("menu");
  }, [activePoiExperience, pendingPoiResolution]);

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
    setActiveOperationId(null);
    setActiveOperationContext(null);
    setEndingPhase("off");
    setEndingChoice(null);
    setShowCockpit(true);
    setShowGalaxyAtlas(false);
    setSaveData(loadSave());
    setSceneStack(null);
    setExitMenuOpen(false);
    expeditionRequestRef.current = null;
    setRegionMapSurface(null);
    setActivePoi(null);
    setActivePoiExperience(null);
    setPendingPoiResolution(null);
    setPoiOutcomeError(null);
    resetCockpitKeys();
    audioRef.current?.switchMusic("menu");
  }, []);

  const handleColonyDispatch = useCallback((event: ColonyEvent) => {
    // Read saveData at call time and persist synchronously. Matches the pattern
    // used by all other saveSave call-sites in this file. If two dispatches
    // ever fire in the same React batch (unreachable in Phase 1 — each is
    // triggered by a discrete user action), the second would reduce against
    // stale state; in that case, refactor to a separate save effect.
    const next = colonyReducer(saveData, event);
    saveSave(next);
    setSaveData(next);
  }, [saveData]);

  const handleColoniesExit = useCallback(() => {
    setCockpitState(prev => ({ ...prev, screen: "hub" }));
  }, []);

  const handleDescend = useCallback((colonyId: string) => {
    ensureAudio();
    const result = enterColonyExploration(saveData, colonyId);
    const baseState = createGameState(
      1, 1,
      saveData.upgrades,
      saveData.unlockedEnhancements,
      saveData.pilotLevel,
      saveData.allocatedSkills
    );
    setGameState({
      ...baseState,
      screen: GameScreen.PLAYING,
      currentMode: "colony-exploration",
      currentPhase: 0,
      totalPhases: 1,
      firstPersonState: result.firstPersonState,
      briefingTimer: 0,
      devInvincible: false,
    });
    setSceneStack(result.sceneStack);
    setShowCockpit(false);
    setCockpitState(prev => ({ ...prev, screen: "hub" }));
  }, [saveData, ensureAudio]);

  const handleRegionExpedition = useCallback((kind: "survey" | "poi", targetNodeId: string) => {
    const surface = regionMapSurface;
    if (!surface || surface.mode !== "pad" || expeditionRequestRef.current) return;
    const request = { kind, originColonyId: surface.originColonyId, targetNodeId } as const;
    expeditionRequestRef.current = regionExpeditionRequestId(request);
    const result = surface.experience === "galaxy"
      ? startGalaxyRegionExpedition(saveDataRef.current, "contact:ashfall", request, null)
      : startRegionExpedition(saveDataRef.current, request, null);
    if (!result.ok) { expeditionRequestRef.current = null; return; }
    let poiState: GameState | null = null;
    if (result.session) {
      try {
        const engineSave = surface.experience === "galaxy"
          ? (() => {
              const opened = openGalaxyRegion(result.save, "contact:ashfall");
              return opened.ok ? opened.projectedSave : null;
            })()
          : result.save;
        if (engineSave === null) throw new Error("Galaxy region projection unavailable");
        poiState = createPoiGameState(result.session, engineSave, surface.experience);
      }
      catch { expeditionRequestRef.current = null; return; }
    }
    try { persistCanonicalSave(result.save); } catch { expeditionRequestRef.current = null; return; }
    if (!result.session || !poiState) { expeditionRequestRef.current = null; return; }
    setActivePoi({ originColonyId: surface.originColonyId, session: result.session });
    setActivePoiExperience(surface.experience);
    poiCompletionHandledRef.current = false;
    poiResolutionRef.current = false;
    setPendingPoiResolution(null);
    setPoiOutcomeError(null);
    setRegionMapSurface(null);
    setExitMenuOpen(false);
    setSceneStack(null);
    setShowCockpit(false);
    setShowMap(false);
    setShowGalaxyAtlas(false);
    setActivePlanetId(null);
    setActiveSpecialMissionId(null);
    setGameState(poiState);
    expeditionRequestRef.current = null;
  }, [persistCanonicalSave, regionMapSurface]);

  const handleFoundRegionOutpost = useCallback((targetNodeId: string) => {
    const surface = regionMapSurface;
    if (!surface || surface.mode !== "pad" || expeditionRequestRef.current) return;
    expeditionRequestRef.current = `found:${surface.originColonyId}:${targetNodeId}`;
    const current = saveDataRef.current;
    const regionSave = surface.experience === "galaxy"
      ? (() => {
          const opened = openGalaxyRegion(current, "contact:ashfall");
          return opened.ok ? opened.projectedSave : null;
        })()
      : current;
    if (regionSave === null) { expeditionRequestRef.current = null; return; }
    const colony = regionSave.colonies.find(c => c.id === surface.originColonyId);
    const name = regionSave.planets.find(p => p.id === colony?.planetId)?.regionMap.nodes.find(n => n.id === targetNodeId)?.name ?? "Frontier Outpost";
    const result = surface.experience === "galaxy"
      ? foundGalaxyOutpost(current, "contact:ashfall", surface.originColonyId, targetNodeId, name)
      : foundOutpost(current, surface.originColonyId, targetNodeId, name);
    if (result.ok) {
      try { persistCanonicalSave(result.save); }
      catch { /* leave the current surface intact */ }
    }
    expeditionRequestRef.current = null;
  }, [persistCanonicalSave, regionMapSurface]);

  const handleOpenAshfallRegion = useCallback(() => {
    const opened = openGalaxyRegion(saveDataRef.current, "contact:ashfall");
    if (!opened.ok) {
      setAtlasStatusMessage(`ASHFALL REGION UNAVAILABLE · ${opened.reason.replaceAll("_", " ").toUpperCase()}`);
      return;
    }
    setRegionMapSurface({
      mode: "pad",
      originColonyId: opened.originColony.id,
      experience: "galaxy",
    });
    atlasShouldRestoreFocusRef.current = false;
    setShowGalaxyAtlas(false);
  }, []);

  const galaxyRegionView = useMemo(() => {
    if (regionMapSurface?.experience !== "galaxy") return null;
    const opened = openGalaxyRegion(saveData, "contact:ashfall");
    return opened.ok ? opened : null;
  }, [regionMapSurface?.experience, saveData]);

  const regionScreenSave = regionMapSurface?.experience === "galaxy"
    ? galaxyRegionView?.projectedSave ?? null
    : saveData;

  const galaxyOutcomeProjection = useMemo(() => {
    if (activePoiExperience !== "galaxy" || pendingPoiResolution === null) return null;
    const opened = openGalaxyRegion(saveData, "contact:ashfall");
    return opened.ok ? opened.projectedSave : null;
  }, [activePoiExperience, pendingPoiResolution, saveData]);

  useEffect(() => {
    if (!activePoi || !gameState || gameState.screen !== GameScreen.LEVEL_COMPLETE || poiCompletionHandledRef.current) return;
    poiCompletionHandledRef.current = true;
    if (activePoiExperience === "galaxy") {
      const prepared = prepareGalaxyPoiCompletion(saveDataRef.current, "contact:ashfall", activePoi, gameState.screen);
      if (!prepared.ok) { setPoiOutcomeError("COMPLETION COULD NOT BE VERIFIED — NO REWARD WAS SAVED"); return; }
      try { persistCanonicalSave(prepared.save); }
      catch { setPoiOutcomeError("COMPLETION SAVE FAILED — NO REWARD WAS SAVED"); return; }
      setPendingPoiResolution(prepared.pending);
      return;
    }
    const pending = preparePoiCompletion(saveDataRef.current, activePoi, gameState.screen);
    if (!pending) { setPoiOutcomeError("COMPLETION COULD NOT BE VERIFIED — NO REWARD WAS SAVED"); return; }
    setPendingPoiResolution(pending);
  }, [activePoi, activePoiExperience, gameState?.screen, persistCanonicalSave]);

  const handlePoiOutcomeConfirm = useCallback((destinationColonyId: string | null) => {
    const pending = pendingPoiResolution;
    if (!pending || poiResolutionRef.current) return;
    poiResolutionRef.current = true;
    setPoiOutcomeResolving(true);
    setPoiOutcomeError(null);
    const galaxyPending = activePoiExperience === "galaxy"
      ? pending as GalaxyPendingPoiResolution
      : null;
    const resolved = galaxyPending
      ? resolveGalaxyPoiCompletion(saveDataRef.current, "contact:ashfall", galaxyPending, destinationColonyId)
      : resolvePoiCompletion(pending, destinationColonyId);
    if (!resolved.ok) {
      setPoiOutcomeError(
        resolved.reason === "destination_missing"
          ? "DESTINATION UNAVAILABLE"
          : galaxyPending
            ? "OUTCOME VALIDATION FAILED — RETRY OR RELOAD"
            : "OUTCOME CHANGED — RETURN TO HUB",
      );
      poiResolutionRef.current = false; setPoiOutcomeResolving(false); return;
    }
    try {
      if (galaxyPending) {
        persistCanonicalSave(resolved.save);
        setGameState(null);
        setActivePoi(null);
        setActivePoiExperience(null);
        setPendingPoiResolution(null);
        setPoiOutcomeResolving(false);
        setExitMenuOpen(false);
        setSceneStack(null);
        setRegionMapSurface({
          mode: "pad",
          originColonyId: pending.originColonyId,
          experience: "galaxy",
        });
        setShowGalaxyAtlas(false);
        return;
      }
      const entered = enterColonyExploration(resolved.save, pending.originColonyId);
      const base = createGameState(1, 1, resolved.save.upgrades, resolved.save.unlockedEnhancements, resolved.save.pilotLevel, resolved.save.allocatedSkills);
      saveSave(resolved.save);
      saveDataRef.current = resolved.save; setSaveData(resolved.save);
      setSceneStack(entered.sceneStack);
      setGameState({ ...base, screen: GameScreen.PLAYING, currentMode: "colony-exploration", currentPhase: 0, totalPhases: 1, firstPersonState: entered.firstPersonState, briefingTimer: 0, devInvincible: false });
      setActivePoi(null); setPendingPoiResolution(null); setPoiOutcomeResolving(false); setExitMenuOpen(false);
    } catch {
      setPoiOutcomeError("SAVE FAILED — RETRY DELIVERY");
      poiResolutionRef.current = false; setPoiOutcomeResolving(false);
    }
  }, [activePoiExperience, pendingPoiResolution, persistCanonicalSave]);

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
    if (activeOperationId && activeOperationContext) {
      mountAuthorizedOperation(activeOperationContext);
      return;
    }
    if (gameState && activePoiExperience !== "galaxy") {
      updateSectorZeroProfile(gameState.score);
    }
    if (activePoi) {
      const poiSave = activePoiExperience === "galaxy"
        ? (() => {
            const opened = openGalaxyRegion(saveDataRef.current, "contact:ashfall");
            return opened.ok ? opened.projectedSave : null;
          })()
        : saveDataRef.current;
      if (poiSave === null) return;
      const dispatched = dispatchPoi(poiSave, activePoi.originColonyId, activePoi.session.nodeId);
      if (dispatched.ok) {
        setActivePoi({ originColonyId: activePoi.originColonyId, session: dispatched.session });
        poiCompletionHandledRef.current = false;
        setPendingPoiResolution(null);
        setGameState(createPoiGameState(dispatched.session, poiSave, activePoiExperience ?? "legacy"));
      }
      return;
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
  }, [gameState, activePlanetId, activeSpecialMissionId, activeOperationId, activeOperationContext, activePoi, activePoiExperience, ensureAudio, mountAuthorizedOperation, saveData]);

  const nextLevel = useCallback((options?: { unlockSpecialMission?: SpecialMissionId; launchSpecialMission?: boolean }) => {
    if (!gameState) return;

    if (activeOperationId && activeOperationContext) {
      foldOperationResult(activeOperationContext, "success", gameState);
      return;
    }

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

      const cycledSave = advanceWorldCycle(newSave);
      saveSave(cycledSave);
      setSaveData(cycledSave);
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
      // OW-0: planet missions deliver a resource payload to a colony
      // (the colony on this planet if any, else the player's first colony).
      newSave = applyMissionDelivery(newSave, activePlanetId).save;
      const cycledSave = advanceWorldCycle(newSave);
      saveSave(cycledSave);
      setSaveData(cycledSave);
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

    const cycledSave = advanceWorldCycle(newSave);
    saveSave(cycledSave);
    setSaveData(cycledSave);

    if (options?.unlockSpecialMission && options.launchSpecialMission) {
      startSpecialMission(options.unlockSpecialMission, cycledSave);
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
      carryForward(createGameState(gameState.currentWorld, nextLv, cycledSave.upgrades, cycledSave.unlockedEnhancements, cycledSave.pilotLevel, cycledSave.allocatedSkills));
    } else {
      // World complete — try advancing to next world
      let nextWorld = gameState.currentWorld + 1;
      while (nextWorld <= 8 && getWorldLevelCount(nextWorld) === 0) {
        nextWorld++;
      }
      if (nextWorld <= 8 && getWorldLevelCount(nextWorld) > 0) {
        carryForward(createGameState(nextWorld, 1, cycledSave.upgrades, cycledSave.unlockedEnhancements, cycledSave.pilotLevel, cycledSave.allocatedSkills));
      } else {
        startEnding();
      }
    }
  }, [gameState, activePlanetId, activeSpecialMissionId, activeOperationId, activeOperationContext, saveData, foldOperationResult, returnToCockpit, startEnding, startSpecialMission]);

  const handleDevAction = useCallback(
    (action: string) => {
      if (action.startsWith("seed-galaxy:")) {
        const fixture = findGalaxyFixture(action.slice("seed-galaxy:".length));
        if (!fixture) return;
        const seeded = applyGalaxyFixture(saveDataRef.current, fixture);
        persistCanonicalSave(seeded);
        ensureAudio().switchMusic("menu");
        setShowStartScreen(false);
        setShowIntro(false);
        setShowCockpit(false);
        setShowMap(false);
        setShowGalaxyAtlas(true);
        setGameState(null);
        setActivePlanetId(null);
        setActiveSpecialMissionId(null);
        setActiveOperationId(null);
        setActiveOperationContext(null);
        setGalaxyRecoveryError(null);
        setActivePoi(null);
        setActivePoiExperience(null);
        setPendingPoiResolution(null);
        setPoiOutcomeError(null);
        setPoiOutcomeResolving(false);
        setRegionMapSurface(null);
        setSceneStack(null);
        setExitMenuOpen(false);
        setAtlasSelectedTarget(undefined);
        setAtlasStatusMessage(`${fixture.label} FIXTURE LOADED`);
        operationOutcomeHandledRef.current = false;
        poiCompletionHandledRef.current = false;
        poiResolutionRef.current = false;
        expeditionRequestRef.current = null;
        return;
      }

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

      if (action.startsWith("seed-colony:")) {
        const fxId = action.split(":")[1];
        const fx = findFixture(fxId);
        if (!fx) return;
        const { save: seeded, colonyId } = applyColonyFixture(saveData, fx);
        saveSave(seeded);
        saveDataRef.current = seeded;
        setSaveData(seeded);
        setActivePoi(null);
        setPendingPoiResolution(null);
        setRegionMapSurface(null);
        setExitMenuOpen(false);
        ensureAudio();
        setShowStartScreen(false);
        setShowMap(false);
        setShowCockpit(false);
        const result = enterColonyExploration(seeded, colonyId);
        const baseState = createGameState(
          1, 1,
          seeded.upgrades,
          seeded.unlockedEnhancements,
          seeded.pilotLevel,
          seeded.allocatedSkills,
        );
        setGameState({
          ...baseState,
          screen: GameScreen.PLAYING,
          currentMode: "colony-exploration",
          currentPhase: 0,
          totalPhases: 1,
          firstPersonState: result.firstPersonState,
          briefingTimer: 0,
          devInvincible: false,
        });
        setSceneStack(result.sceneStack);
        setCockpitState(prev => ({ ...prev, screen: "hub" }));
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
          turretState: createTurretState(),
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
    [gameState?.devInvincible, ensureAudio, persistCanonicalSave, startPlanetMission]
  );

  // Keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInteractiveKeyboardTarget(e.target)) return;
      if (showGalaxyAtlas) return;
      // Colonies screen uses a DOM overlay for input — let the overlay handle keys.
      if (showCockpit && cockpitState.screen === "colonies") return;
      if (regionMapSurface || pendingPoiResolution) return;
      // Landing-pad exit menu is a DOM overlay on top of canvas — let DOM handle keys.
      if (exitMenuOpen) return;

      const isFirstPerson =
        gameState?.currentMode === "first-person" ||
        gameState?.currentMode === "colony-exploration";

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
            return;
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
            if (activeOperationContext) {
              foldOperationResult(activeOperationContext, "failure", gameState);
            } else if (activePoiExperience === "galaxy") {
              returnGalaxyPoiToAtlas();
            } else {
              returnToCockpit();
            }
          } else if (gameState?.screen === GameScreen.LEVEL_COMPLETE) {
            if (activePoi) return;
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
            if (activeOperationId) abandonOperationToAtlas();
            else if (activePoiExperience === "galaxy") returnGalaxyPoiToAtlas();
            else returnToCockpit();
          } else if (gameState?.screen === GameScreen.GAME_OVER || gameState?.screen === GameScreen.LEVEL_COMPLETE) {
            if (activePoi) {
              return;
            } else if (activeOperationContext) {
              foldOperationResult(
                activeOperationContext,
                gameState.screen === GameScreen.LEVEL_COMPLETE ? "success" : "failure",
                gameState,
              );
            } else if (activePoiExperience === "galaxy") {
              returnGalaxyPoiToAtlas();
            } else {
              returnToCockpit();
            }
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
  }, [showStartScreen, showIntro, endingPhase, choiceHover, showCockpit, cockpitState.screen, showMap, showGalaxyAtlas, gameState, activeOperationId, activeOperationContext, activePoiExperience, abandonOperationToAtlas, returnGalaxyPoiToAtlas, finishIntro, advanceEnding, confirmChoice, foldOperationResult, restartGame, nextLevel, returnToCockpit, shouldPromptKeplerMission, specialPromptChoice, exitMenuOpen, regionMapSurface, pendingPoiResolution, activePoi]);

  // Grade-scene menu detection: whenever gameplay isn't the active surface
  // (start screen, intro, cockpit, star map, ending) the grade preset eases
  // back to the menu DEFAULT. PAUSED/GAME_OVER keep the last mode's grade —
  // the frozen frame beneath their DOM overlays is still that mode's scene.
  useEffect(() => {
    const gameplayActive =
      !!gameState && !showStartScreen && !showCockpit && !showMap && !showGalaxyAtlas && !showIntro && endingPhase === "off";
    if (!gameplayActive) presetModeRef.current = "menu";
  }, [gameState, showStartScreen, showCockpit, showMap, showGalaxyAtlas, showIntro, endingPhase]);

  useEffect(() => {
    if (!showGalaxyAtlas) return;
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (presentRafRef.current !== null) {
      cancelAnimationFrame(presentRafRef.current);
      presentRafRef.current = null;
    }
    keysRef.current.left = false;
    keysRef.current.right = false;
    keysRef.current.up = false;
    keysRef.current.down = false;
    keysRef.current.strafeLeft = false;
    keysRef.current.strafeRight = false;
    keysRef.current.shoot = false;
    keysRef.current.bomb = false;
    keysRef.current.jump = false;
    mouseRef.current.down = false;
    touchPosRef.current = null;
  }, [showGalaxyAtlas]);

  // Held-input reset on focus loss. keyup/mouseup are delivered to whatever
  // surface has focus, so Alt-Tab / tab-switch / DevPanel clicks while holding a
  // key would otherwise leave keysRef stuck true (ship slides + auto-fires until
  // the key is pressed again). Mount-once: only refs are touched.
  useEffect(() => {
    const clearHeldInput = () => {
      const k = keysRef.current;
      k.left = k.right = k.up = k.down = false;
      k.strafeLeft = k.strafeRight = false;
      k.shoot = k.bomb = k.jump = false;
      mouseRef.current.down = false;
      touchPosRef.current = null;
    };
    const onVisibilityChange = () => {
      if (document.hidden) clearHeldInput();
    };
    window.addEventListener("blur", clearHeldInput);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("blur", clearHeldInput);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  // Touch input
  useEffect(() => {
    if (showGalaxyAtlas) return;
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
        return;
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
                openExperienceMap();
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
        if (activeOperationContext) foldOperationResult(activeOperationContext, "failure", gameState);
        else if (activePoiExperience === "galaxy") returnGalaxyPoiToAtlas();
        else returnToCockpit();
      } else if (gameState?.screen === GameScreen.LEVEL_COMPLETE) {
        if (activePoi) return;
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
  }, [showStartScreen, showIntro, endingPhase, showCockpit, cockpitState.screen, showMap, showGalaxyAtlas, gameState, activeOperationContext, activePoi, activePoiExperience, openExperienceMap, finishIntro, advanceEnding, confirmChoice, foldOperationResult, returnGalaxyPoiToAtlas, restartGame, nextLevel, returnToCockpit, shouldPromptKeplerMission, specialPromptChoice]);

  // Intro crawl loop
  useEffect(() => {
    if (!showIntro || showGalaxyAtlas) return;

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
  }, [showIntro, showGalaxyAtlas, finishIntro]);

  // Ending sequence loop (pre-choice, choice, ending, credits)
  useEffect(() => {
    if (endingPhase === "off" || showGalaxyAtlas) return;

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
  }, [endingPhase, endingChoice, choiceHover, showGalaxyAtlas, advanceEnding, returnToCockpit]);

  // Star map loop
  useEffect(() => {
    if (!showMap || showGalaxyAtlas) return;

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
  }, [showMap, showGalaxyAtlas, starMapState, saveData, startLevel]);

  // Cockpit hub loop
  useEffect(() => {
    if (!showCockpit || showGalaxyAtlas) return;

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
        openExperienceMap();
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
  }, [showCockpit, showGalaxyAtlas, cockpitState, saveData, openExperienceMap, startPlanetMission, startSpecialMission]);

  // Game loop
  useEffect(() => {
    if (!gameState || showStartScreen || showCockpit || showMap || showGalaxyAtlas) return;
    const activeScreens = [GameScreen.PLAYING, GameScreen.BOSS_FIGHT, GameScreen.BOSS_INTRO, GameScreen.BRIEFING, GameScreen.PHASE_TRANSITION];
    if (!activeScreens.includes(gameState.screen)) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const gameLoop = () => {
      // FIXED-TIMESTEP SIMULATION. rAF fires at the display's refresh rate
      // (120/144Hz on fast screens), but the shooter/turret engines and every
      // frameCount-driven animation assume one update = 16.67ms. So instead of
      // stepping once per rAF, wall-clock time accumulates and the sim steps in
      // fixed 16.67ms ticks: 120Hz → a tick every other callback; a slow frame
      // → up to 3 catch-up ticks (the 50ms clamp bounds stall recovery, same
      // budget as the engines' dtF<=3 clamp). At a steady 60fps this is
      // behavior-identical to the old once-per-rAF step.
      const STEP_MS = 1000 / 60;
      const now = performance.now();
      const last = lastFrameTsRef.current;
      const rawDt = last === 0 ? STEP_MS : Math.min(now - last, 50);
      lastFrameTsRef.current = now;
      simAccumulatorRef.current += rawDt;

      // Feed mouse position into turret crosshair — but only when the mouse
      // actually moved, so keyboard aim (arrow keys) isn't snapped back to an
      // idle mouse's position every frame.
      let turretMouseFire = false;
      if (gameState?.currentMode === "turret" && gameState.turretState) {
        const m = mouseRef.current;
        const last = lastTurretMouseRef.current;
        if (!last || last.x !== m.x || last.y !== m.y) {
          gameState.turretState.crosshairX = Math.max(0.05, Math.min(0.95, m.x));
          gameState.turretState.crosshairY = Math.max(0.05, Math.min(0.95, m.y));
          lastTurretMouseRef.current = { x: m.x, y: m.y };
        }
        // Held mouse button fires this frame only — never latch keysRef.shoot
        // (the old latch kept auto-firing after the button was released until
        // an unrelated Z/Shift keyup happened to clear it).
        turretMouseFire = m.down;
      }

      // In colony-exploration mode, suppress input when exit menu is open (DOM handles it)
      const effectiveKeys = (gameState.currentMode === "colony-exploration" && (exitMenuOpen || regionMapSurface))
        ? { left: false, right: false, up: false, down: false,
            strafeLeft: false, strafeRight: false,
            shoot: false, bomb: false, jump: false }
        : turretMouseFire && !keysRef.current.shoot
          ? { ...keysRef.current, shoot: true }
          : keysRef.current;

      // Consume whole fixed ticks. Zero ticks (fast display, no tick due yet)
      // → newState === gameState, setGameState bails on the identical
      // reference, and this same rAF loop just runs again next callback.
      let newState = gameState;
      let simMs = 0; // sim time consumed this callback (feeds the colony step)
      while (simAccumulatorRef.current >= STEP_MS) {
        simAccumulatorRef.current -= STEP_MS;
        simMs += STEP_MS;
        newState = updateGame(
          newState,
          effectiveKeys,
          touchPosRef.current?.x ?? null,
          touchPosRef.current?.y ?? null,
          STEP_MS
        );
        // Play audio per tick — catch-up ticks each carry their own events.
        for (const event of newState.audioEvents) {
          audioRef.current?.play(event);
        }
      }
      if (newState === gameState) {
        // No tick this callback: nothing changed, skip the React commit and
        // redraw entirely.
        animationFrameRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      // ── Colony exploration orchestrator step ──
      if (newState.currentMode === "colony-exploration" && sceneStack) {
        const fp = newState.firstPersonState;
        const req = fp?.colonyTransitionRequest as { kind?: string } | undefined;
        // Detect show_exit_menu request (LandingPadResult) before stepping
        if (req && req.kind === "show_exit_menu") {
          setExitMenuOpen(true);
          if (fp) fp.colonyTransitionRequest = undefined;
        } else {
          const nextStack = stepColonyExploration(sceneStack, saveData, simMs);
          if (nextStack !== sceneStack) {
            setSceneStack(nextStack);
            // When stack layer changes (interior enter/exit), propagate the new
            // firstPersonState to gameState so the renderer sees the new layer.
            if (nextStack.current.state !== newState.firstPersonState) {
              newState.firstPersonState = nextStack.current.state;
            }
          }
        }
      }

      // ── FP typed shop purchase drain (Phase 5a §I + M3 services) ──
      // A buyable shop emits a one-shot typed request. Apply it through the
      // audited purchase boundary, persist only successful SaveData results, and
      // keep purchase feedback transient on the current dialog.
      {
        const fpBuy = newState.firstPersonState;
        const buyReq = fpBuy && drainShopPurchaseRequest(fpBuy);
        if (fpBuy && buyReq) {
          // Colony merchants charge faction-adjusted prices (Phase 5a): derive
          // the buy rank from the explored colony's primary faction — the same
          // rank the shop's displayed costs were built with, so the charge
          // always equals the display for consumables. Services ignore rank.
          const buyRank = colonyMerchantRank(saveData.colonies, saveData.factionStandings, sceneStack?.colonyId);
          const nextSave = applyShopPurchase(saveData, buyReq, buyRank);
          if (nextSave) {
            saveSave(nextSave);
            setSaveData(nextSave);
          }
          const feedback = shopPurchaseFeedback(buyReq, nextSave !== null);
          if (fpBuy.dialogState) {
            setShopPurchaseFeedback(fpBuy.dialogState, feedback);
          }
        }
      }

      // Mirror the fully-computed state so the grade-pass present rAF (which can't
      // read React state) can select a preset by currentMode. Set after all
      // newState mutations above, alongside the React commit.
      gameStateRef.current = newState;
      presetModeRef.current = newState.currentMode;
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
  }, [gameState, showStartScreen, showCockpit, showMap, showGalaxyAtlas, saveData, sceneStack, exitMenuOpen, regionMapSurface]);

  // Auto-trigger ending when game engine sets ENDING screen (final boss defeated)
  useEffect(() => {
    if (gameState?.screen === GameScreen.ENDING && endingPhase === "off" && activeOperationId === null) {
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
  }, [gameState?.screen, endingPhase, activeOperationId, gameState, saveData, startEnding]);

  // Draw non-playing screens
  useEffect(() => {
    if (!gameState || showStartScreen || showCockpit || showMap || showGalaxyAtlas) return;
    const loopScreens = [GameScreen.PLAYING, GameScreen.BOSS_FIGHT, GameScreen.BOSS_INTRO, GameScreen.BRIEFING];
    if (loopScreens.includes(gameState.screen)) return;
    // ENDING screen is handled by the ending sequence, not drawGame
    if (gameState.screen === GameScreen.ENDING) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    drawGame(ctx, gameState);
  }, [gameState, showStartScreen, showCockpit, showMap, showGalaxyAtlas]);

  // Save on game over
  useEffect(() => {
    if (gameState?.screen === GameScreen.GAME_OVER && activeOperationId === null && activePoiExperience !== "galaxy") {
      updateSectorZeroProfile(gameState.score);
    }
  }, [gameState?.screen, gameState?.score, activeOperationId, activePoiExperience]);

  // Load player name and preload sprites
  useEffect(() => {
    setPlayerName(getPlayerName());
    setSaveData(loadSave());
    preloadAll();
  }, []);

  // Mount the WebGL color-grade pass over the game canvas (Layer A of the visual
  // overhaul). It presents the 2D canvas through the DOOM color grade, selecting
  // a preset per frame by the live gameStateRef.currentMode. It runs on its OWN
  // requestAnimationFrame loop stored in presentRafRef — deliberately NOT
  // animationFrameRef, which several other rAF loops in this component share and
  // reset. createGradePass yields a pass that is disabled by default (present()
  // no-ops until enabled), so we enable it here.
  // Cleanup cancels the loop and releases the GL resources. Runs once on mount —
  // the refs are attached before effects fire.
  useEffect(() => {
    if (showGalaxyAtlas) return;
    const glCanvas = glCanvasRef.current;
    if (!glCanvas) return;

    const pass = createGradePass(glCanvas);
    pass.setEnabled(true);

    const present = () => {
      const source = canvasRef.current;
      // gameStateRef is null before the first game-loop tick (start screen etc.);
      // selectPreset falls back to DEFAULT for an empty/unknown mode, so the whole
      // app — menus included — gets the same grade until a mode is active.
      if (source) pass.present(source, selectPreset(presetModeRef.current));
      presentRafRef.current = requestAnimationFrame(present);
    };
    presentRafRef.current = requestAnimationFrame(present);

    return () => {
      if (presentRafRef.current !== null) {
        cancelAnimationFrame(presentRafRef.current);
        presentRafRef.current = null;
      }
      pass.dispose();
    };
  }, [showGalaxyAtlas]);

  return (
    <div className="relative w-full h-screen flex items-center justify-center bg-black">
      {/* Grade-pass mount: this position:relative wrapper shrink-wraps the 2D
          canvas (it keeps its own maxHeight/maxWidth/objectFit sizing), giving the
          absolutely-positioned WebGL overlay below a definite box to fill. */}
      <div style={{ position: "relative", display: "inline-flex", lineHeight: 0 }}>
        <canvas
          id="sector-zero-game-canvas"
          tabIndex={-1}
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
            if (showGalaxyAtlas) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const scaleX = CANVAS_WIDTH / rect.width;
            const scaleY = CANVAS_HEIGHT / rect.height;
            mouseRef.current.x = (e.clientX - rect.left) * scaleX / CANVAS_WIDTH;
            mouseRef.current.y = (e.clientY - rect.top) * scaleY / CANVAS_HEIGHT;
          }}
          onMouseDown={(e) => {
            if (showGalaxyAtlas) return;
            if (e.button === 0) mouseRef.current.down = true;
          }}
          onMouseUp={(e) => {
            if (showGalaxyAtlas) return;
            if (e.button === 0) mouseRef.current.down = false;
          }}
          onMouseLeave={() => {
            if (showGalaxyAtlas) return;
            mouseRef.current.down = false;
          }}
          onClick={(e) => {
            if (showGalaxyAtlas) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const scaleX = CANVAS_WIDTH / rect.width;
            const scaleY = CANVAS_HEIGHT / rect.height;
            const cx = (e.clientX - rect.left) * scaleX;
            const cy = (e.clientY - rect.top) * scaleY;

            // Intro crawl / ending sequence — mirror the touch handlers so a
            // mouse-only desktop player isn't stuck on keyboard-only flows
            // (the DESTROY/MERGE boxes are drawn at y 320-420 / 460-560).
            if (showIntro) {
              finishIntro();
              return;
            }
            if (endingPhase === "choice") {
              if (cy >= 320 && cy < 420) confirmChoice("destroy");
              else if (cy >= 460 && cy < 560) confirmChoice("merge");
              return;
            }
            if (endingPhase === "pre-choice" || endingPhase === "ending" || endingPhase === "credits") {
              advanceEnding();
              return;
            }

            // Cockpit hub — click on hotspots
            if (showCockpit && cockpitState.screen === "hub") {
              for (let i = 0; i < COCKPIT_HOTSPOTS.length; i++) {
                const h = COCKPIT_HOTSPOTS[i];
                if (cx >= h.x && cx <= h.x + h.w && cy >= h.y && cy <= h.y + h.h) {
                  // "starmap" is not a cockpit sub-screen (drawCockpit has no
                  // branch for it — setting it freezes the hub frame): open the
                  // star map overlay instead, mirroring the touch path above.
                  if (h.id === "starmap") {
                    openExperienceMap();
                  } else {
                    setCockpitState((prev) => ({
                      ...prev,
                      screen: h.id,
                      selectedHotspot: i,
                    }));
                  }
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
        {/* WebGL color-grade overlay — a sibling of the 2D canvas, painted on its
            own rAF loop (presentRafRef). Fixed 480x854 backing store (no
            devicePixelRatio scaling — the 2D game canvas uses none, so matching it
            keeps the two layers pixel-aligned). pointerEvents:none so every
            mouse/touch still reaches the 2D canvas beneath; inset:0 + 100%/100%
            makes it track that canvas box exactly. The DOM UI overlays are
            later-in-source siblings of this wrapper, so they still paint above the
            overlay and stay ungraded. */}
        <canvas
          ref={glCanvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        />
      </div>

      {showGalaxyAtlas && (
        <GalaxyAtlasScreen
          run={saveData.galaxyRun}
          initialTarget={atlasSelectedTarget}
          statusMessage={atlasStatusMessage}
          onSelectTarget={setAtlasSelectedTarget}
          onCommitTravel={handleCommitTravel}
          onLaunchOperation={handleLaunchOperation}
          onRetreat={handleTravelRetreat}
          onEmergencyRetreat={handleEmergencyRetreat}
          onResumeTravel={handleResumeTravel}
          onFinalizeTravel={handleFinalizeTravel}
          onOpenAshfallRegion={handleOpenAshfallRegion}
          onRestoreFocus={restoreAtlasInvokerFocus}
          onClose={() => {
            setShowGalaxyAtlas(false);
            setShowCockpit(true);
            setCockpitState((previous) => ({ ...previous, screen: "hub" }));
            resetCockpitKeys();
          }}
        />
      )}

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

          <GalaxyExperienceGate
            hasGalaxyRun={saveData.galaxyRun !== null}
            ready={saveHydrated}
            onGalaxy={beginGalaxy}
            onLegacy={beginLegacy}
          />
        </div>
      )}

      {/* Paused Overlay */}
      {gameState?.screen === GameScreen.PAUSED && !showGalaxyAtlas && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white">
          <div className="text-center">
            <h2 className="text-4xl font-bold mb-4 tracking-wider">PAUSED</h2>
            <p className="text-gray-500 text-sm mb-6">
              {operationSurfaceLabel(
                gameState,
                `${WORLD_NAMES[gameState.currentWorld - 1]} — Level ${gameState.currentLevel}`,
              )}
            </p>
            <div className="flex flex-col gap-3 items-center">
              <button
                onClick={() => setGameState((prev) => (prev ? togglePause(prev) : null))}
                className="px-8 py-3 border-2 border-cyan-400 text-cyan-400 text-lg hover:bg-cyan-400 hover:text-black transition-colors tracking-wider w-56"
              >
                RESUME
              </button>
              <button
                onClick={activeOperationId
                  ? abandonOperationToAtlas
                  : activePoiExperience === "galaxy"
                    ? returnGalaxyPoiToAtlas
                    : returnToCockpit}
                className="px-8 py-3 border-2 border-gray-600 text-gray-400 text-lg hover:bg-gray-600 hover:text-white transition-colors tracking-wider w-56"
              >
                {experienceReturnLabel(Boolean(activeOperationId || activePoiExperience === "galaxy"))}
              </button>
            </div>
            <p className="text-gray-600 text-xs mt-4">
              ESC · {experienceReturnLabel(Boolean(activeOperationId || activePoiExperience === "galaxy"))}
            </p>
          </div>
        </div>
      )}

      {/* Level Complete Overlay (boss levels + planet missions) */}
      {gameState?.screen === GameScreen.LEVEL_COMPLETE && !activePoi && !showGalaxyAtlas && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white">
          <h2
            className="text-4xl font-bold mb-4 tracking-wider"
            style={{
              background: activePlanetId || activeSpecialMissionId || activeOperationId
                ? "linear-gradient(135deg, #44ffaa, #44ccff)"
                : "linear-gradient(135deg, #FFD700, #FF6600)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {activePlanetId || activeSpecialMissionId || activeOperationId ? "MISSION COMPLETE" : "LEVEL COMPLETE"}
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
            {activeOperationId && (
              <p className="text-cyan-300 text-lg mb-2">
                {operationSurfaceLabel(gameState, "GALAXY OPERATION")}
              </p>
            )}
            <p className="text-2xl">
              Score: <span className="text-yellow-400 font-bold">{gameState.score}</span>
            </p>
            {!activeOperationId && (() => {
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
            {!activePlanetId && !activeSpecialMissionId && !activeOperationId && (
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
            {activePlanetId && (() => {
              // OW-0: preview the colony delivery applied on COMPLETE (every run, not first-completion gated)
              const delivery = resolveMissionDelivery(activePlanetId, saveData.colonies);
              if (!delivery) return null;
              return (
                <p className="text-sm text-amber-300 mt-2">
                  {deliveryPayloadLabel(delivery.payload)} &rarr; {delivery.colonyName.toUpperCase()}
                </p>
              );
            })()}
            {activeSpecialMissionId === "kepler-black-box" && gameState.firstPersonState?.objectiveCollected && !saveData.storyItems.includes("kepler-black-box") && (
              <div className="mt-3 space-y-1">
                <p className="text-sm text-amber-300 font-bold animate-pulse">+ KEPLER BLACK BOX</p>
                <p className="text-sm text-cyan-300">+ REYES RECORDER LOG</p>
              </div>
            )}
            {activeOperationId ? (
              <p className="text-sm text-cyan-300 mt-3 tracking-wider">
                CATALOG REWARDS APPLY WHEN THE OUTCOME IS JOURNALED
              </p>
            ) : (
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
            )}
            {activeOperationId && operationOutcomeError && (
              <p role="alert" className="max-w-md text-sm text-red-400 mt-3">
                {operationOutcomeError}
              </p>
            )}
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
              if (activeOperationId) return null;
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
            {activeOperationId ? (
              <button
                onClick={() => nextLevel()}
                className="px-8 py-4 border-2 border-cyan-400 text-cyan-400 text-lg hover:bg-cyan-400 hover:text-black transition-colors tracking-wider"
              >
                JOURNAL OUTCOME
              </button>
            ) : shouldPromptKeplerMission ? (
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
            {!activeOperationId && (
              <button
                onClick={returnToCockpit}
                className="px-6 py-4 border-2 border-gray-600 text-gray-400 text-lg hover:bg-gray-600 hover:text-white transition-colors tracking-wider"
              >
                HUB
              </button>
            )}
          </div>
        </div>
      )}

      {/* Game Over Overlay */}
      {gameState?.screen === GameScreen.GAME_OVER && !showGalaxyAtlas && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white">
          <h2 className="text-5xl font-bold mb-4 text-red-500 tracking-wider">GAME OVER</h2>
          <div className="text-center mb-8 space-y-2">
            <p className="text-2xl">
              Score: <span className="text-yellow-400 font-bold">{gameState.score}</span>
            </p>
            <p className="text-gray-400">
              {operationSurfaceLabel(
                gameState,
                `${WORLD_NAMES[gameState.currentWorld - 1]} — Level ${gameState.currentLevel}`,
              )}
            </p>
            <p className="text-gray-500 text-sm">
              Kills: {gameState.kills} &middot; Max Combo: {gameState.maxCombo}x
            </p>
            {activeOperationId && operationOutcomeError && (
              <p role="alert" className="max-w-md text-sm text-red-400 mt-3">
                {operationOutcomeError}
              </p>
            )}
          </div>
          <div className="flex gap-4">
            <button
              onClick={restartGame}
              className="px-8 py-4 border-2 border-cyan-400 text-cyan-400 text-lg hover:bg-cyan-400 hover:text-black transition-colors tracking-wider"
            >
              TRY AGAIN
            </button>
            {gameState.currentPhase > 0 && !activeOperationId && (
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
            {activeOperationContext ? (
              <>
                <button
                  onClick={() => foldOperationResult(activeOperationContext, "retreat", gameState)}
                  className="px-6 py-4 border-2 border-yellow-600 text-yellow-400 text-lg hover:bg-yellow-600 hover:text-black transition-colors tracking-wider"
                >
                  RETREAT
                </button>
                <button
                  onClick={() => foldOperationResult(activeOperationContext, "failure", gameState)}
                  className="px-6 py-4 border-2 border-gray-600 text-gray-400 text-lg hover:bg-gray-600 hover:text-white transition-colors tracking-wider"
                >
                  ATLAS
                </button>
              </>
            ) : activePoiExperience === "galaxy" ? (
              <button
                onClick={returnGalaxyPoiToAtlas}
                className="px-6 py-4 border-2 border-gray-600 text-gray-400 text-lg hover:bg-gray-600 hover:text-white transition-colors tracking-wider"
              >
                ATLAS
              </button>
            ) : (
              <button
                onClick={returnToCockpit}
                className="px-6 py-4 border-2 border-gray-600 text-gray-400 text-lg hover:bg-gray-600 hover:text-white transition-colors tracking-wider"
              >
                HUB
              </button>
            )}
          </div>
        </div>
      )}

      {/* Pause button — visible during active gameplay for mobile access to hub */}
      {gameState && !showGalaxyAtlas && (gameState.screen === GameScreen.PLAYING || gameState.screen === GameScreen.BOSS_FIGHT || gameState.screen === GameScreen.BOSS_INTRO) && (
        <button
          onClick={() => setGameState((prev) => (prev ? togglePause(prev) : null))}
          className="absolute top-2 left-2 w-10 h-10 flex items-center justify-center bg-black/50 border border-white/20 text-white/60 hover:text-white hover:bg-black/70 transition-colors z-10 rounded"
          title="Pause (ESC)"
        >
          <span className="text-lg font-bold">⏸</span>
        </button>
      )}

      {/* Mute button */}
      {(gameState || showCockpit || showMap || endingPhase !== "off") && !showStartScreen && !showGalaxyAtlas && (
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

      {/* Dev Panel — dev mode, or a prod build explicitly opted in via
          NEXT_PUBLIC_DEVTOOLS=1 (for smooth prod-build playtesting). The CI
          deploy build never sets that flag, so production stays clean. */}
      {(process.env.NODE_ENV === "development" ||
        process.env.NEXT_PUBLIC_DEVTOOLS === "1") && (
        <DevPanel gameState={gameState} onAction={handleDevAction} />
      )}

      {/* Colonies DOM overlay — mounts over the canvas when cockpit screen is "colonies" */}
      {showCockpit && cockpitState.screen === "colonies" && (
        <ColoniesScreen
          save={saveData}
          onDispatch={handleColonyDispatch}
          onExit={handleColoniesExit}
          onDescend={handleDescend}
          onRegionMap={(colonyId) => setRegionMapSurface({ mode: "view", originColonyId: colonyId, experience: "legacy" })}
        />
      )}

      {/* Landing-pad exit menu — mounts over the canvas during colony-exploration */}
      {exitMenuOpen && sceneStack && (
        <LandingPadExitMenu
          onTakeOff={() => {
            setExitMenuOpen(false);
            exitColonyExploration(sceneStack);
            setSceneStack(null);
            returnToCockpit();
          }}
          onStay={() => setExitMenuOpen(false)}
          onRegionMap={() => {
            const originColonyId = sceneStack.current.state.colonyContext?.colonyId;
            if (!originColonyId) return;
            setExitMenuOpen(false);
            setRegionMapSurface({ mode: "pad", originColonyId, experience: "legacy" });
          }}
        />
      )}
      {regionMapSurface && regionScreenSave && (
        <RegionMapScreen
          save={regionScreenSave}
          originColonyId={regionMapSurface.originColonyId}
          mode={regionMapSurface.mode}
          onClose={() => {
            const wasPad = regionMapSurface.mode === "pad";
            const wasGalaxy = regionMapSurface.experience === "galaxy";
            setRegionMapSurface(null);
            if (wasGalaxy) setShowGalaxyAtlas(true);
            else if (wasPad) setExitMenuOpen(true);
          }}
          onSurvey={(id) => handleRegionExpedition("survey", id)}
          onTravel={(id) => handleRegionExpedition("poi", id)}
          onFound={handleFoundRegionOutpost}
        />
      )}
      {pendingPoiResolution && (
        <PoiOutcomeScreen
          pending={pendingPoiResolution}
          colonies={(galaxyOutcomeProjection ?? saveData).colonies}
          resolving={poiOutcomeResolving}
          error={poiOutcomeError}
          onConfirm={handlePoiOutcomeConfirm}
          onHub={activePoiExperience === "galaxy" ? undefined : returnToCockpit}
        />
      )}
      {activePoi && gameState?.screen === GameScreen.LEVEL_COMPLETE && !pendingPoiResolution && poiOutcomeError && (
        <div role="dialog" aria-modal="true" aria-label="POI completion error" className="absolute inset-0 z-[1300] flex items-center justify-center bg-black/95 text-white">
          <div className="max-w-md border border-red-500 p-8 text-center">
            <h2 className="mb-4 text-xl text-red-400">OUTCOME LOCKED</h2>
            <p className="mb-6 text-sm">{poiOutcomeError}</p>
            <button onClick={activePoiExperience === "galaxy" ? returnGalaxyPoiToAtlas : returnToCockpit} className="border border-cyan-400 px-6 py-3 text-cyan-300">
              {experienceReturnLabel(activePoiExperience === "galaxy")}
            </button>
          </div>
        </div>
      )}
      {galaxyRecoveryError && (
        <div role="dialog" aria-modal="true" aria-label="Galaxy recovery locked" className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/95 px-6 text-white">
          <div className="max-w-lg border border-red-500 bg-slate-950 p-8 text-center">
            <h2 className="mb-4 text-2xl tracking-wider text-red-400">GALAXY RUN LOCKED</h2>
            <p className="mb-3 text-sm text-gray-200">{galaxyRecoveryError}</p>
            <p className="mb-6 text-xs text-gray-500">Reload or restore a valid save before continuing this Galaxy run.</p>
            <button
              onClick={() => {
                setGalaxyRecoveryError(null);
                setShowGalaxyAtlas(false);
                setShowStartScreen(true);
              }}
              className="border border-cyan-400 px-6 py-3 text-cyan-300"
            >
              RETURN TO EXPERIENCE SELECTOR
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

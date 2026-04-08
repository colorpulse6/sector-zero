# Multi-Phase Level Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the infrastructure for multi-phase levels — a level can chain 1-N gameplay phases with hard transitions, checkpoint state, and optional branching. All existing levels are backward-compatible as single-phase. No new game modes are added; this is the scaffolding.

**Architecture:** Introduce a `Phase` data model alongside existing `LevelData`. Each phase specifies a game mode (currently only `"shooter"`) and a mode-specific config (waves, boss, etc.). A new `PhaseTransition` system handles dialog + fade + card between phases. The game engine's state machine gains a `PHASE_TRANSITION` screen. Checkpoint state is snapshotted at phase entry for retry-on-death. The existing `createGameState` becomes a thin wrapper that builds a single-phase level from legacy `LevelData`.

**Tech Stack:** TypeScript, Next.js 15, React 19, HTML5 Canvas 2D. No test framework — `yarn build` + manual playtest.

**Spec reference:** [2026-04-05-sector-zero-expansion-design.md](../specs/2026-04-05-sector-zero-expansion-design.md) — System 1

**Verified codebase facts:**
- `LevelData` has: `world, level, name, isBoss, waves, briefingText, worldIntroText?`
- `createGameState(world, level, upgrades, enhancements, pilotLevel, allocatedSkills)` creates initial GameState
- `GameScreen` enum: LOADING, MENU, MAP, BRIEFING, PLAYING, PAUSED, BOSS_INTRO, BOSS_FIGHT, LEVEL_COMPLETE, GAME_OVER, ENDING, CREDITS
- Level complete flow: all waves cleared → `levelCompleteTimer = 360` → countdown → LEVEL_COMPLETE screen → user chooses NEXT LEVEL or HUB
- Boss flow: PLAYING → BOSS_INTRO → BOSS_FIGHT → boss defeated → LEVEL_COMPLETE
- `nextLevel()` in Game.tsx handles save + advance, carries forward score/lives/weapon
- `PlanetLevelData` has: `planetId, waves, loopFromWave?`

---

## File Structure

### New files

| Path | Responsibility |
|------|----------------|
| `engine/phases.ts` | Phase/MultiPhaseLevel types, phase builder helpers, checkpoint state management |
| `engine/phaseTransition.ts` | Transition sequence renderer (dialog line + card text + fade) |

### Modified files

| Path | Changes |
|------|---------|
| `engine/types.ts` | Add `GameMode`, `PhaseConfig`, `PhaseState`, `CheckpointState` types; add `PHASE_TRANSITION` to `GameScreen` enum; extend `GameState` with phase tracking fields |
| `engine/gameEngine.ts` | Add phase-aware level completion (advance to next phase instead of LEVEL_COMPLETE); add `PHASE_TRANSITION` screen handler; add checkpoint snapshot/restore; wrap existing `createGameState` to build single-phase from LevelData |
| `engine/renderer.ts` | Add `drawPhaseTransition` call for new screen state |
| `engine/levels.ts` | Add `getMultiPhaseLevelData` helper + one test multi-phase level definition |
| `Game.tsx` | Add "RESTART FROM PHASE 1" option on game-over; handle phase-transition screen state |

---

## Task 1: Define phase types

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/types.ts`

- [ ] **Step 1: Find GameScreen enum**

```bash
cd games/sector-zero/web && grep -n "enum GameScreen" app/components/engine/types.ts
```

- [ ] **Step 2: Add PHASE_TRANSITION to GameScreen**

Find the enum and add `PHASE_TRANSITION = "PHASE_TRANSITION"` after `BOSS_FIGHT`:

```typescript
export enum GameScreen {
  LOADING = "LOADING",
  MENU = "MENU",
  MAP = "MAP",
  BRIEFING = "BRIEFING",
  PLAYING = "PLAYING",
  PAUSED = "PAUSED",
  BOSS_INTRO = "BOSS_INTRO",
  BOSS_FIGHT = "BOSS_FIGHT",
  PHASE_TRANSITION = "PHASE_TRANSITION",  // NEW
  LEVEL_COMPLETE = "LEVEL_COMPLETE",
  GAME_OVER = "GAME_OVER",
  ENDING = "ENDING",
  CREDITS = "CREDITS",
}
```

- [ ] **Step 3: Add phase-related types**

Find `// ─── Pilot Leveling ───` section. IMMEDIATELY BEFORE it, insert:

```typescript
// ─── Multi-Phase Levels ─────────────────────────────────────────────
export type GameMode = "shooter" | "ground-run" | "boarding" | "turret" | "base-defense" | "mech-duel";

export interface PhaseConfig {
  mode: GameMode;
  waves: WaveDefinition[];
  isBoss?: boolean;
  briefingText?: string;
  /** Objective for this phase (planet-style). Undefined = standard wave clear. */
  objectiveType?: ObjectiveType;
  objectiveTarget?: number;
}

export interface TransitionSequence {
  dialogLine?: string;
  dialogSpeaker?: string;
  cardText: string;         // e.g., "DESCENDING TO SURFACE"
  cardSubtext?: string;     // e.g., "Phase 2: Ground Assault"
  duration: number;         // frames (180 = 3s)
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
}

/** Snapshot of player state at phase entry — used for checkpoint restart */
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

```

- [ ] **Step 4: Extend GameState with phase tracking**

Find `export interface GameState {`. Add these fields (group them together, e.g., after `allocatedSkills`):

```typescript
  // Multi-phase tracking
  currentPhase: number;         // 0-indexed phase within level
  totalPhases: number;          // total phases in this level
  phaseCheckpoint: CheckpointState | null;  // snapshot at phase entry
  phaseTransitionTimer: number; // countdown for PHASE_TRANSITION screen
  phaseTransitionCard: string;  // text shown on transition card
  phaseTransitionSubtext: string;
```

- [ ] **Step 5: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

Expected: Build fails (new GameState fields not initialized). Expected.

- [ ] **Step 6: Commit**

```bash
cd /Users/nichalasbarnes/Desktop/projects/knicks-knacks
git add games/sector-zero/web/app/components/engine/types.ts
git commit -m "feat(sector-zero): add multi-phase level types and PHASE_TRANSITION screen"
```

---

## Task 2: Create phases.ts — phase builder and checkpoint helpers

**Files:**
- Create: `games/sector-zero/web/app/components/engine/phases.ts`

- [ ] **Step 1: Create the module**

```typescript
import type {
  CheckpointState,
  GameState,
  PhaseDefinition,
  MultiPhaseLevelData,
  LevelData,
  ActivePowerUp,
} from "./types";

// ─── Checkpoint Management ──────────────────────────────────────────

/** Snapshot player state at phase entry for checkpoint restart. */
export function createCheckpoint(state: GameState): CheckpointState {
  return {
    hp: state.player.hp,
    maxHp: state.player.maxHp,
    lives: state.lives,
    weaponLevel: state.player.weaponLevel,
    score: state.score,
    kills: state.kills,
    deaths: state.deaths,
    maxCombo: state.maxCombo,
    activePowerUps: [...state.activePowerUps],
  };
}

/** Restore player state from a checkpoint (on retry from phase start). */
export function restoreCheckpoint(
  state: GameState,
  checkpoint: CheckpointState
): Partial<GameState> {
  return {
    score: checkpoint.score,
    lives: checkpoint.lives,
    kills: checkpoint.kills,
    deaths: checkpoint.deaths,
    maxCombo: checkpoint.maxCombo,
    activePowerUps: [...checkpoint.activePowerUps],
    player: {
      ...state.player,
      hp: checkpoint.hp,
      maxHp: checkpoint.maxHp,
      weaponLevel: checkpoint.weaponLevel,
    },
  };
}

// ─── Legacy Compatibility ───────────────────────────────────────────

/** Wrap a single LevelData as a 1-phase MultiPhaseLevelData. */
export function wrapAsMultiPhase(levelData: LevelData): MultiPhaseLevelData {
  return {
    world: levelData.world,
    level: levelData.level,
    name: levelData.name,
    briefingText: levelData.briefingText,
    worldIntroText: levelData.worldIntroText,
    phases: [
      {
        config: {
          mode: "shooter",
          waves: levelData.waves,
          isBoss: levelData.isBoss,
        },
      },
    ],
  };
}

/** Check if current phase is the last phase. */
export function isLastPhase(state: GameState): boolean {
  return state.currentPhase >= state.totalPhases - 1;
}

/** Get the next phase definition from the multi-phase data. */
export function getNextPhaseTransition(
  phases: PhaseDefinition[],
  currentPhase: number
): PhaseDefinition | null {
  const nextIdx = currentPhase + 1;
  if (nextIdx >= phases.length) return null;
  return phases[nextIdx];
}
```

- [ ] **Step 2: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

Note: `LevelData` may need to be exported from types.ts — check if it's there. If `LevelData` is defined in `levels.ts`, import from there instead.

Actually, `LevelData` is defined in `levels.ts`, not `types.ts`. Fix the import:

```typescript
import type { LevelData } from "./levels";
```

And remove `LevelData` from the `./types` import.

Also verify `WaveDefinition` is in types — the `PhaseConfig` uses it via `types.ts`.

- [ ] **Step 3: Commit**

```bash
git add games/sector-zero/web/app/components/engine/phases.ts
git commit -m "feat(sector-zero): add phase checkpoint and legacy wrapper helpers"
```

---

## Task 3: Create phaseTransition.ts — transition screen renderer

**Files:**
- Create: `games/sector-zero/web/app/components/engine/phaseTransition.ts`

- [ ] **Step 1: Create the module**

```typescript
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "./types";

/**
 * Draw the phase transition screen — a cinematic card between phases.
 * Shows: card text (large), subtext (smaller), fade overlay.
 */
export function drawPhaseTransition(
  ctx: CanvasRenderingContext2D,
  cardText: string,
  subtext: string,
  timer: number,
  totalDuration: number
): void {
  ctx.save();

  // Full black background
  ctx.fillStyle = "#000005";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Fade in (first 30 frames) and out (last 30 frames)
  const elapsed = totalDuration - timer;
  const fadeIn = Math.min(1, elapsed / 30);
  const fadeOut = Math.min(1, timer / 30);
  const alpha = Math.min(fadeIn, fadeOut);

  ctx.globalAlpha = alpha;

  // Horizontal accent lines
  const centerY = CANVAS_HEIGHT / 2;
  ctx.fillStyle = "#44ccff22";
  ctx.fillRect(0, centerY - 60, CANVAS_WIDTH, 1);
  ctx.fillRect(0, centerY + 60, CANVAS_WIDTH, 1);

  // Scanning line animation
  const scanY = centerY - 50 + ((elapsed * 1.5) % 100);
  ctx.fillStyle = "#44ccff11";
  ctx.fillRect(0, scanY, CANVAS_WIDTH, 2);

  // Card text (main)
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowBlur = 12;
  ctx.shadowColor = "#44ccff";
  ctx.fillText(cardText.toUpperCase(), CANVAS_WIDTH / 2, centerY - 10);
  ctx.shadowBlur = 0;

  // Subtext
  if (subtext) {
    ctx.fillStyle = "#667788";
    ctx.font = "12px monospace";
    ctx.fillText(subtext, CANVAS_WIDTH / 2, centerY + 20);
  }

  // Loading dots animation
  const dots = ".".repeat((Math.floor(elapsed / 20) % 4));
  ctx.fillStyle = "#44ccff44";
  ctx.font = "14px monospace";
  ctx.fillText(`LOADING${dots}`, CANVAS_WIDTH / 2, centerY + 60);

  ctx.restore();
  ctx.globalAlpha = 1;
}
```

- [ ] **Step 2: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add games/sector-zero/web/app/components/engine/phaseTransition.ts
git commit -m "feat(sector-zero): add phase transition cinematic card renderer"
```

---

## Task 4: Initialize phase fields in GameState factories

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/gameEngine.ts`

- [ ] **Step 1: Find both state factories**

```bash
cd games/sector-zero/web && grep -n "allocatedSkills:" app/components/engine/gameEngine.ts | head -5
```

- [ ] **Step 2: Add phase fields at EACH factory**

After `allocatedSkills: ...` in both `createGameState` and `createPlanetGameState`, add:

```typescript
    currentPhase: 0,
    totalPhases: 1,
    phaseCheckpoint: null,
    phaseTransitionTimer: 0,
    phaseTransitionCard: "",
    phaseTransitionSubtext: "",
```

This initializes all levels as single-phase (totalPhases: 1). Multi-phase levels will override these later.

- [ ] **Step 3: Verify build is clean**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully`

- [ ] **Step 4: Commit**

```bash
git add games/sector-zero/web/app/components/engine/gameEngine.ts
git commit -m "feat(sector-zero): initialize phase tracking fields in game state factories"
```

---

## Task 5: Add PHASE_TRANSITION screen handler to game engine

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/gameEngine.ts`

- [ ] **Step 1: Find screen transition handlers**

```bash
cd games/sector-zero/web && grep -n "GameScreen.BRIEFING\|GameScreen.PLAYING\|GameScreen.BOSS_INTRO\|updateBriefing\|updateBossIntro" app/components/engine/gameEngine.ts | head -15
```

The main `updateGame` function dispatches based on `state.screen`. Find its structure.

- [ ] **Step 2: Add phase transition import**

```typescript
import { createCheckpoint, isLastPhase } from "./phases";
```

- [ ] **Step 3: Add PHASE_TRANSITION screen handler**

In the main `updateGame` function (or the appropriate screen-dispatch section), add handling for the new screen:

```bash
cd games/sector-zero/web && grep -n "function updateGame\|s.screen ===" app/components/engine/gameEngine.ts | head -20
```

Find where screens are dispatched. Add a handler for `PHASE_TRANSITION`:

```typescript
// Phase transition screen — countdown, then start next phase
if (s.screen === GameScreen.PHASE_TRANSITION) {
  s.phaseTransitionTimer -= 1;
  s.background = updateBackground(s.background);
  if (s.phaseTransitionTimer <= 0) {
    // Transition complete — this is handled by Game.tsx which loads the next phase
    s.screen = GameScreen.BRIEFING;
  }
  return s;
}
```

Note: The actual loading of the next phase's data (new waves, new config) is complex and mode-dependent. For MVP, Game.tsx will detect `phaseTransitionTimer <= 0` and call a phase-advance function. The engine just counts down.

Actually, simpler approach: when the timer hits 0, set a flag. Game.tsx watches for it like it watches for LEVEL_COMPLETE. Let me reconsider...

Simplest MVP: the `PHASE_TRANSITION` screen counts down in the engine. When it reaches 0, the screen transitions to `BRIEFING` (which already handles the countdown → PLAYING transition). Game.tsx is responsible for *populating* the next phase's data (waves, enemies) BEFORE the transition starts. This means the data swap happens when the transition is TRIGGERED, not when it ENDS.

```typescript
if (s.screen === GameScreen.PHASE_TRANSITION) {
  s.phaseTransitionTimer -= 1;
  s.background = updateBackground(s.background);
  if (s.phaseTransitionTimer <= 0) {
    // Skip briefing for Phase 2+ — go directly to PLAYING
    // (Briefing screen would show stale Phase 1 text; the transition card already served as the briefing)
    s.screen = GameScreen.PLAYING;
    s.waveDelay = 120;  // 2s pause before first wave spawns
  }
  return s;
}
```

- [ ] **Step 4: Trigger phase transition instead of LEVEL_COMPLETE when more phases remain**

Find where `levelCompleteTimer` expires and `LEVEL_COMPLETE` is set. This is now the simplified block we changed earlier:

```bash
cd games/sector-zero/web && grep -n "levelCompleteTimer.*<= 0\|s.screen = GameScreen.LEVEL_COMPLETE" app/components/engine/gameEngine.ts | head -5
```

There are **TWO** `levelCompleteTimer` countdown blocks in the game engine:
1. The normal level block (~line 506) — already simplified in the earlier "level complete between levels" commit
2. The boss defeat block (~line 684-697) — handles final-level-of-game detection (`GameScreen.ENDING`)

Find BOTH with:
```bash
cd games/sector-zero/web && grep -n "s.screen = GameScreen.LEVEL_COMPLETE\|s.screen = GameScreen.ENDING" app/components/engine/gameEngine.ts | head -10
```

Replace BOTH blocks with the same phase-aware logic:

```typescript
if (s.levelCompleteTimer > 0) {
  s.levelCompleteTimer -= 1;
  if (s.levelCompleteTimer <= 0) {
    if (!isLastPhase(s)) {
      // More phases — trigger transition
      s.screen = GameScreen.PHASE_TRANSITION;
      s.phaseTransitionTimer = 180;  // 3s transition
      s.currentPhase += 1;
      s.phaseCheckpoint = createCheckpoint(s);
      s.phaseTransitionCard = `PHASE ${s.currentPhase + 1}`;
      s.phaseTransitionSubtext = "Preparing next phase...";
    } else {
      // Final phase complete — show results (or ENDING if final boss)
      // Preserve existing final-level detection for boss levels
      s.screen = GameScreen.LEVEL_COMPLETE;
    }
  }
}
```

**For the boss block specifically:** the existing code checks whether this is the final level in the game and sets `GameScreen.ENDING`. Wrap that logic inside the `isLastPhase` else-branch. The `ENDING` check should ONLY run when we're on the last phase AND the last level. Read the existing boss block's final-level detection code and keep it inside the else branch.

- [ ] **Step 5: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

- [ ] **Step 6: Commit**

```bash
git add games/sector-zero/web/app/components/engine/gameEngine.ts
git commit -m "feat(sector-zero): add phase transition screen handler and phase-aware completion"
```

---

## Task 6: Render phase transition screen

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/renderer.ts`

- [ ] **Step 1: Add import**

```typescript
import { drawPhaseTransition } from "./phaseTransition";
```

- [ ] **Step 2: Add rendering for PHASE_TRANSITION screen**

Find where other screens are rendered in `drawGame`. The function currently dispatches for BRIEFING, BOSS_INTRO, and then falls through to gameplay rendering. Find:

```bash
cd games/sector-zero/web && grep -n "GameScreen.BRIEFING\|GameScreen.BOSS_INTRO\|GameScreen.PHASE_TRANSITION" app/components/engine/renderer.ts | head -10
```

Add PHASE_TRANSITION handling. Insert it BEFORE the BRIEFING check:

```typescript
  // Phase transition screen
  if (state.screen === GameScreen.PHASE_TRANSITION) {
    drawPhaseTransition(
      ctx,
      state.phaseTransitionCard,
      state.phaseTransitionSubtext,
      state.phaseTransitionTimer,
      180  // total duration matches the timer set in gameEngine
    );
    ctx.restore();
    return;
  }
```

- [ ] **Step 3: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add games/sector-zero/web/app/components/engine/renderer.ts
git commit -m "feat(sector-zero): render phase transition cinematic card"
```

---

## Task 7: Handle phase advance + checkpoint retry in Game.tsx

**Files:**
- Modify: `games/sector-zero/web/app/components/Game.tsx`

- [ ] **Step 1: Read the GAME_OVER overlay**

```bash
cd games/sector-zero/web && grep -n "GAME_OVER\|restartGame\|TRY AGAIN" app/components/Game.tsx | head -15
```

Read the game-over overlay to understand the retry button.

- [ ] **Step 2: Find restartGame callback**

```bash
cd games/sector-zero/web && grep -n "const restartGame\|restartGame =" app/components/Game.tsx
```

Read ~15 lines. This is where the player retries after death.

- [ ] **Step 3: Add checkpoint-aware restart**

Import checkpoint helpers:

```typescript
import { restoreCheckpoint } from "./engine/phases";
```

Update `restartGame` to use checkpoint if one exists:

Find the existing `restartGame` callback. It likely creates a fresh `createGameState`. Modify it to check for a checkpoint:

```typescript
const restartGame = useCallback(() => {
  if (!gameState) return;
  
  // If we have a checkpoint (multi-phase level, not phase 1), restart from checkpoint
  if (gameState.phaseCheckpoint && gameState.currentPhase > 0) {
    const restored = restoreCheckpoint(gameState, gameState.phaseCheckpoint);
    setGameState({
      ...gameState,
      ...restored,
      screen: GameScreen.BRIEFING,
      briefingTimer: 300,
      enemies: [],
      boss: null,
      playerBullets: [],
      enemyBullets: [],
      particles: [],
      explosions: [],
      floatingLabels: [],
      // Re-initialize waves for the current phase
      // For MVP, waves are already in state from phase setup
      currentWave: 0,
      waveDelay: 120,
      levelCompleteTimer: 0,
      screenShake: 0,
    });
    return;
  }
  
  // Normal restart (phase 1 or single-phase level)
  // ... existing restart logic ...
}, [gameState, /* existing deps */]);
```

IMPORTANT: Read the existing `restartGame` carefully to understand its current implementation. Prepend the checkpoint logic BEFORE the existing code, with an early return.

- [ ] **Step 4: Add "RESTART FROM PHASE 1" option to game-over screen (optional)**

In the GAME_OVER overlay, if `gameState.currentPhase > 0`, add a third button:

```typescript
{gameState.currentPhase > 0 && (
  <button
    onClick={() => {
      // Full restart from phase 1 — use existing restartGame without checkpoint
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
```

- [ ] **Step 5: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

- [ ] **Step 6: Commit**

```bash
git add games/sector-zero/web/app/components/Game.tsx
git commit -m "feat(sector-zero): add checkpoint restart and phase-1 restart on game over"
```

---

## Task 8: Add one test multi-phase level

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/levels.ts`
- Modify: `games/sector-zero/web/app/components/engine/gameEngine.ts`

- [ ] **Step 1: Read levels.ts structure**

```bash
cd games/sector-zero/web && grep -n "function getLevelData\|LEVEL_DATA\|World 1" app/components/engine/levels.ts | head -15
```

Understand how level data is stored and retrieved.

- [ ] **Step 2: Add a multi-phase level getter**

In `levels.ts`, add:

```typescript
import type { MultiPhaseLevelData, PhaseDefinition } from "./types";

/**
 * Get multi-phase level data. Returns null for standard single-phase levels.
 * This is the extension point for future multi-phase content.
 */
export function getMultiPhaseLevelData(
  world: number,
  level: number
): MultiPhaseLevelData | null {
  // For now, only one test level: World 1, Level 3
  // has a bonus Phase 2 (extra shooter waves)
  if (world === 1 && level === 3) {
    const baseLevel = getLevelData(world, level);
    if (!baseLevel) return null;
    return {
      world,
      level,
      name: baseLevel.name,
      briefingText: baseLevel.briefingText,
      worldIntroText: baseLevel.worldIntroText,
      phases: [
        {
          config: {
            mode: "shooter",
            waves: baseLevel.waves,
            isBoss: false,
          },
        },
        {
          config: {
            mode: "shooter",
            waves: baseLevel.waves.slice(0, 2),  // Shorter phase 2 for testing
            isBoss: false,
            briefingText: "Enemy reinforcements detected. Clear the second wave.",
          },
          transitionIn: {
            cardText: "REINFORCEMENTS INCOMING",
            cardSubtext: "Phase 2: Clear the second wave",
            duration: 180,
          },
        },
      ],
    };
  }
  return null;
}
```

- [ ] **Step 3: Use multi-phase data in createGameState**

In `gameEngine.ts`, at the TOP of `createGameState`, check for multi-phase data:

```typescript
import { getMultiPhaseLevelData } from "./levels";
```

At the start of `createGameState`:

```typescript
// Check for multi-phase level
const multiPhaseData = getMultiPhaseLevelData(world, level);
const phaseCount = multiPhaseData?.phases.length ?? 1;
```

Then in the returned GameState object, set:

```typescript
totalPhases: phaseCount,
```

(The `currentPhase` is already 0 and `phaseCheckpoint` is already null from Task 4.)

- [ ] **Step 4: Populate transition card text from phase data when transitioning**

In the phase transition trigger (from Task 5, where `!isLastPhase(s)` is checked), use phase data to populate the card:

```typescript
if (!isLastPhase(s)) {
  const multiPhase = getMultiPhaseLevelData(s.currentWorld, s.currentLevel);
  const nextPhase = multiPhase?.phases[s.currentPhase + 1];
  s.screen = GameScreen.PHASE_TRANSITION;
  s.phaseTransitionTimer = nextPhase?.transitionIn?.duration ?? 180;
  s.currentPhase += 1;
  s.phaseCheckpoint = createCheckpoint(s);
  s.phaseTransitionCard = nextPhase?.transitionIn?.cardText ?? `PHASE ${s.currentPhase + 1}`;
  s.phaseTransitionSubtext = nextPhase?.transitionIn?.cardSubtext ?? "";
  
  // Load next phase's waves
  if (nextPhase?.config.waves) {
    const newWaves: Wave[] = nextPhase.config.waves.map((def) => ({
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
} else {
  s.screen = GameScreen.LEVEL_COMPLETE;
}
```

Note: `Wave` type import — verify it's imported:

```bash
cd games/sector-zero/web && grep -n "type Wave\b" app/components/engine/gameEngine.ts | head -3
```

- [ ] **Step 5: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(sector-zero): add test multi-phase level (W1-L3) with phase transition"
```

---

## Task 9: Handle PHASE_TRANSITION in Game.tsx input + pause

**Files:**
- Modify: `games/sector-zero/web/app/components/Game.tsx`

- [ ] **Step 1: Find input handling for game screens**

```bash
cd games/sector-zero/web && grep -n "PHASE_TRANSITION\|GameScreen.PLAYING\|GameScreen.BRIEFING" app/components/Game.tsx | head -15
```

- [ ] **Step 2: Allow skip for phase transition**

In the keyboard handler, find where BRIEFING allows skip (Enter/tap). Add similar handling for PHASE_TRANSITION — pressing Enter skips the transition timer:

```typescript
if (gameState?.screen === GameScreen.PHASE_TRANSITION) {
  if (key === "Enter" || key === " ") {
    setGameState((prev) => prev ? {
      ...prev,
      phaseTransitionTimer: 0,
    } : prev);
  }
}
```

- [ ] **Step 3: Don't show pause button during PHASE_TRANSITION**

Find where the pause button is rendered. It likely checks for `GameScreen.PLAYING || GameScreen.BOSS_FIGHT`. Make sure `PHASE_TRANSITION` is NOT included (it shouldn't be pausable — it's a non-interactive cinematic).

- [ ] **Step 4: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add games/sector-zero/web/app/components/Game.tsx
git commit -m "feat(sector-zero): handle phase transition input (skip) and pause exclusion"
```

---

## Task 10: Final verification

**Files:** All

- [ ] **Step 1: Full build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -25
```

Expected: `✓ Compiled successfully`

- [ ] **Step 2: Playtest checklist**

```bash
cd games/sector-zero/web && yarn dev
```

- [ ] Play World 1, Level 1 (single phase) — normal behavior, LEVEL_COMPLETE at end
- [ ] Play World 1, Level 3 (test multi-phase) — after Phase 1 clears, transition card appears ("REINFORCEMENTS INCOMING"), then Phase 2 loads with new waves
- [ ] Die in Phase 2 → game over → TRY AGAIN restarts from Phase 2 checkpoint (not Phase 1)
- [ ] Die in Phase 2 → game over → RESTART LEVEL button appears (restarts from Phase 1)
- [ ] Phase transition can be skipped with Enter
- [ ] Score/kills carry forward across phases
- [ ] Level complete screen shows after Phase 2 clears (showing total stats from both phases)
- [ ] Planet missions still work (single phase)
- [ ] Boss levels still work (single phase)

- [ ] **Step 3: Final commit**

```bash
git status
git add -A
git commit -m "chore(sector-zero): multi-phase levels final polish" || echo "Nothing to commit"
```

---

## Summary

After Task 10, the game has:

- ✅ `Phase` data model with types for mode, config, transitions
- ✅ `PHASE_TRANSITION` GameScreen with cinematic card renderer
- ✅ Phase-aware level completion (advances to next phase before showing results)
- ✅ Checkpoint system (snapshot at phase entry, restore on retry)
- ✅ "RESTART LEVEL" option on game-over (restart from Phase 1)
- ✅ All existing levels backward-compatible as single-phase
- ✅ One test multi-phase level (World 1, Level 3) for verification
- ✅ Skip transition with Enter
- ✅ Score/kills/weapon level carry across phases

**Out of scope (future plans):**
- New game modes (ground-run, boarding, turret, base-defense, mech-duel) — each gets its own plan
- Optional phase branching (dialog prompt "Descend? Y/N") — future enhancement
- HP normalization across different mode baselines — deferred until modes with different HP exist
- Planet mission multi-phase content — deferred
- Phase-specific wave loading from external data — MVP uses inline phase definitions

**Extension point:** To add multi-phase content to any level, define it in `getMultiPhaseLevelData()` in levels.ts. To add new game modes, add mode-specific update/render functions and wire them into the phase system.

import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GAME_AREA_HEIGHT,
  GameScreen,
  PowerUpType,
  type GameState,
  type Boss,
  type SaveData,
} from "./types";
import { drawBackground } from "./background";
import { drawParticles, drawSpriteExplosions } from "./particles";
import { drawFloatingLabels } from "./floatingLabels";
import { drawPlayerBullets, drawEnemyBullets } from "./weapons";
import { drawEnemies } from "./enemies";
import { getSprite, SPRITES } from "./sprites";
import { getLevelData, WORLD_NAMES } from "./levels";
import { drawDashboard } from "./dashboard";
import {
  type StarMapState,
  getWorldNodes,
  getLevelNodes,
  getPlanetNodes,
  isLevelUnlocked,
} from "./starMap";
import { PLANET_DEFS } from "./planets";
import { drawPhaseTransition } from "./phaseTransition";
import { drawGroundGame } from "./groundRenderer";
import { drawBoardingGame } from "./boardingRenderer";
import { drawFirstPerson } from "./firstPersonRenderer";
import { drawTurretGame } from "./turretRenderer";

export function drawGame(
  ctx: CanvasRenderingContext2D,
  state: GameState
): void {
  ctx.save();

  // Screen shake
  if (state.screenShake > 0) {
    const sx = (Math.random() - 0.5) * state.screenShake * 2;
    const sy = (Math.random() - 0.5) * state.screenShake * 2;
    ctx.translate(sx, sy);
  }

  // Background
  drawBackground(ctx, state.background, state.currentWorld, state.planetId);

  // Phase transition screen
  if (state.screen === GameScreen.PHASE_TRANSITION) {
    drawPhaseTransition(
      ctx,
      state.phaseTransitionCard,
      state.phaseTransitionSubtext,
      state.phaseTransitionTimer,
      180
    );
    ctx.restore();
    return;
  }

  // Briefing screen (overlay on background)
  if (state.screen === GameScreen.BRIEFING) {
    drawBriefing(ctx, state);
    ctx.restore();
    return;
  }

  // Boss intro screen
  if (state.screen === GameScreen.BOSS_INTRO) {
    drawBossIntro(ctx, state);
    drawDashboard(ctx, state);
    ctx.restore();
    return;
  }

  // Ground-run mode has its own renderer
  if (state.currentMode === "ground-run") {
    drawGroundGame(ctx, state);
    ctx.restore();
    return;
  }

  // Ship boarding mode has its own renderer
  if (state.currentMode === "boarding") {
    drawBoardingGame(ctx, state);
    ctx.restore();
    return;
  }

  // First-person raycaster mode
  if (state.currentMode === "first-person") {
    drawFirstPerson(ctx, state);
    ctx.restore();
    return;
  }

  // Ship turret mode
  if (state.currentMode === "turret") {
    drawTurretGame(ctx, state);
    ctx.restore();
    return;
  }

  // Gameplay rendering (PLAYING and BOSS_FIGHT)
  drawPowerUps(ctx, state);
  drawEnemyBullets(ctx, state.enemyBullets);
  drawEnemies(ctx, state.enemies);

  // Boss
  if (state.boss && !state.boss.defeated) {
    drawBoss(ctx, state.boss, state.frameCount);
    drawBossHealthBar(ctx, state.boss);
  }

  const hasRapidFire = state.activePowerUps.some((p) => p.type === PowerUpType.RAPID_FIRE);
  drawPlayerBullets(ctx, state.playerBullets, state.player.weaponLevel, hasRapidFire);
  drawPlayer(ctx, state);
  drawSideGunners(ctx, state);
  drawParticles(ctx, state.particles);
  drawSpriteExplosions(ctx, state.explosions);
  drawFloatingLabels(ctx, state.floatingLabels);

  // Wave indicator (only during normal play, not boss)
  if (state.screen === GameScreen.PLAYING && state.waveDelay > 30 && state.currentWave > 0 && !state.boss) {
    drawWaveIndicator(ctx, state);
  }

  // Bomb flash overlay
  if (state.bombCooldown > 20) {
    const flashAlpha = (state.bombCooldown - 20) / 10; // fades from 1.0 to 0 over 10 frames
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, flashAlpha * 0.6)})`;
    ctx.fillRect(0, 0, CANVAS_WIDTH, GAME_AREA_HEIGHT);
  }

  // Level complete banner (game keeps running during countdown)
  if (state.levelCompleteTimer > 0) {
    drawLevelCompleteBanner(ctx, state);
  }

  // Dashboard (bottom panel — replaces old HUD + dialog overlay)
  drawDashboard(ctx, state);

  ctx.restore();
}

// ─── Player ──────────────────────────────────────────────────────────

function drawPlayer(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { player } = state;

  // Skip drawing during death
  if (player.hp <= 0 && state.lives <= 0) return;

  // Invincibility blink
  if (player.invincibleTimer > 0 && Math.floor(player.invincibleTimer / 4) % 2 === 0) {
    return;
  }

  const cx = player.x + player.width / 2;
  const cy = player.y + player.height / 2;

  // Magnet attraction field
  const hasMagnet = state.activePowerUps.some((p) => p.type === PowerUpType.MAGNET);
  if (hasMagnet) {
    const magnetPulse = state.frameCount * 0.04;
    for (let ring = 0; ring < 3; ring++) {
      const radius = 40 + ring * 18 + Math.sin(magnetPulse + ring * 2) * 5;
      const alpha = 0.12 - ring * 0.03;
      ctx.strokeStyle = `rgba(170, 68, 255, ${alpha})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(cx, cy, radius, magnetPulse + ring, magnetPulse + ring + Math.PI * 1.5);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  // Shield visual — layered energy bubble
  const hasShield = state.activePowerUps.some((p) => p.type === PowerUpType.SHIELD);
  if (hasShield) {
    const t = state.frameCount * 0.08;
    const r = player.width * 0.7;

    // Outer glow
    ctx.strokeStyle = `rgba(68, 136, 255, ${0.1 + 0.08 * Math.sin(t)})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
    ctx.stroke();

    // Main shield ring
    ctx.strokeStyle = `rgba(100, 180, 255, ${0.35 + 0.15 * Math.sin(t * 1.3)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Rotating arc segments
    for (let i = 0; i < 3; i++) {
      const angle = t + (i * Math.PI * 2) / 3;
      ctx.strokeStyle = `rgba(150, 220, 255, ${0.3 + 0.1 * Math.sin(t * 2 + i)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r - 1, angle, angle + 0.8);
      ctx.stroke();
    }
  }

  const sprite = getSprite(SPRITES.PLAYER);

  if (sprite) {
    // Player sheet: 3 ships side-by-side (bank-left, center, bank-right)
    const frameW = sprite.width / 3;
    const frameH = sprite.height;
    // 0 = bank-left, 1 = center, 2 = bank-right
    const frameIdx = player.bankDir === -1 ? 0 : player.bankDir === 1 ? 2 : 1;

    // Crop to ship content area — the ships sit in the center ~50% of each frame
    // with large transparent padding above and below
    const cropTop = Math.floor(frameH * 0.25);
    const cropH = Math.floor(frameH * 0.50);
    const sx = frameIdx * frameW;
    const drawSize = player.width + 12;
    const drawX = player.x - 6;
    const drawY = player.y - 6;

    ctx.drawImage(sprite, sx, cropTop, frameW, cropH, drawX, drawY, drawSize, drawSize);
  } else {
    // Fallback: placeholder ship
    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#44ccff";

    ctx.fillStyle = "#667788";
    ctx.beginPath();
    ctx.moveTo(cx, player.y);
    ctx.lineTo(player.x, player.y + player.height);
    ctx.lineTo(cx, player.y + player.height * 0.8);
    ctx.lineTo(player.x + player.width, player.y + player.height);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#44ccff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, player.y + 4);
    ctx.lineTo(cx - 8, player.y + player.height * 0.6);
    ctx.moveTo(cx, player.y + 4);
    ctx.lineTo(cx + 8, player.y + player.height * 0.6);
    ctx.stroke();

    ctx.fillStyle = "#44ccff";
    ctx.beginPath();
    ctx.arc(cx, player.y + player.height * 0.35, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Engine exhaust
  const hasSpeed = state.activePowerUps.some((p) => p.type === PowerUpType.SPEED);
  const exhaustFlicker = 0.5 + 0.5 * Math.sin(state.frameCount * 0.5);
  const exhaustBottom = player.y + player.height;

  if (hasSpeed) {
    // Speed boost — intense double exhaust with trail
    const len = 14 + exhaustFlicker * 10;
    // Outer glow
    ctx.fillStyle = `rgba(255, 220, 0, ${exhaustFlicker * 0.3})`;
    ctx.beginPath();
    ctx.moveTo(cx - 10, exhaustBottom - 2);
    ctx.lineTo(cx, exhaustBottom + len + 4);
    ctx.lineTo(cx + 10, exhaustBottom - 2);
    ctx.closePath();
    ctx.fill();
    // Left flame
    ctx.fillStyle = `rgba(255, 180, 0, ${exhaustFlicker * 0.8})`;
    ctx.beginPath();
    ctx.moveTo(cx - 8, exhaustBottom - 2);
    ctx.lineTo(cx - 4, exhaustBottom + len);
    ctx.lineTo(cx, exhaustBottom - 2);
    ctx.closePath();
    ctx.fill();
    // Right flame
    ctx.beginPath();
    ctx.moveTo(cx, exhaustBottom - 2);
    ctx.lineTo(cx + 4, exhaustBottom + len);
    ctx.lineTo(cx + 8, exhaustBottom - 2);
    ctx.closePath();
    ctx.fill();
    // Core white
    ctx.fillStyle = `rgba(255, 255, 220, ${exhaustFlicker * 0.9})`;
    ctx.beginPath();
    ctx.moveTo(cx - 3, exhaustBottom);
    ctx.lineTo(cx, exhaustBottom + len * 0.7);
    ctx.lineTo(cx + 3, exhaustBottom);
    ctx.closePath();
    ctx.fill();

    // Speed lines behind ship
    ctx.strokeStyle = `rgba(255, 220, 100, ${0.15 + exhaustFlicker * 0.1})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const lx = player.x - 6 + i * 18;
      const ly = exhaustBottom + 8 + ((state.frameCount * 3 + i * 40) % 30);
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx, ly + 12 + exhaustFlicker * 6);
      ctx.stroke();
    }
  } else {
    // Normal exhaust
    ctx.fillStyle = `rgba(68, 204, 255, ${exhaustFlicker * 0.7})`;
    ctx.beginPath();
    ctx.moveTo(cx - 5, exhaustBottom - 2);
    ctx.lineTo(cx, exhaustBottom + 6 + exhaustFlicker * 5);
    ctx.lineTo(cx + 5, exhaustBottom - 2);
    ctx.closePath();
    ctx.fill();
  }
}

// ─── Side Gunners ────────────────────────────────────────────────────

function drawSideGunners(ctx: CanvasRenderingContext2D, state: GameState): void {
  const hasSideGunners = state.activePowerUps.some((p) => p.type === PowerUpType.SIDE_GUNNERS);
  if (!hasSideGunners) return;

  const { player } = state;
  const sprite = getSprite(SPRITES.PLAYER);

  const leftX = player.x - 22;
  const rightX = player.x + player.width + 2;
  const gunY = player.y + 10;
  const size = 20;

  if (sprite) {
    const frameW = sprite.width / 3;
    const frameH = sprite.height;
    ctx.globalAlpha = 0.8;
    ctx.drawImage(sprite, frameW, 0, frameW, frameH,
      leftX, gunY, size, size);
    ctx.drawImage(sprite, frameW, 0, frameW, frameH,
      rightX, gunY, size, size);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = "#44cc44";
    ctx.beginPath();
    ctx.moveTo(leftX + 6, gunY);
    ctx.lineTo(leftX, gunY + 12);
    ctx.lineTo(leftX + 12, gunY + 12);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(rightX + 6, gunY);
    ctx.lineTo(rightX, gunY + 12);
    ctx.lineTo(rightX + 12, gunY + 12);
    ctx.closePath();
    ctx.fill();
  }

  // Side gunner exhaust trails
  const flicker = 0.5 + 0.5 * Math.sin(state.frameCount * 0.6);
  ctx.fillStyle = `rgba(68, 255, 100, ${flicker * 0.6})`;
  const exLen = 4 + flicker * 3;
  // Left exhaust
  ctx.beginPath();
  ctx.moveTo(leftX + size / 2 - 2, gunY + size);
  ctx.lineTo(leftX + size / 2, gunY + size + exLen);
  ctx.lineTo(leftX + size / 2 + 2, gunY + size);
  ctx.closePath();
  ctx.fill();
  // Right exhaust
  ctx.beginPath();
  ctx.moveTo(rightX + size / 2 - 2, gunY + size);
  ctx.lineTo(rightX + size / 2, gunY + size + exLen);
  ctx.lineTo(rightX + size / 2 + 2, gunY + size);
  ctx.closePath();
  ctx.fill();

  // Green glow on gunners
  ctx.shadowBlur = 8;
  ctx.shadowColor = "#44ff44";
  ctx.strokeStyle = `rgba(68, 255, 68, ${0.25 + flicker * 0.15})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(leftX + size / 2, gunY + size / 2, size / 2 + 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(rightX + size / 2, gunY + size / 2, size / 2 + 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

// ─── Power-Ups ───────────────────────────────────────────────────────

// Power-up order in the sprite sheet (6 icons left-to-right):
// Shield, Speed, Bomb, Magnet, Side Gunners, Rapid Fire
const POWERUP_FRAME_MAP: Record<string, number> = {
  [PowerUpType.SHIELD]: 0,
  [PowerUpType.SPEED]: 1,
  [PowerUpType.BOMB]: 2,
  [PowerUpType.MAGNET]: 3,
  [PowerUpType.SIDE_GUNNERS]: 4,
  [PowerUpType.RAPID_FIRE]: 5,
};

function drawPowerUps(ctx: CanvasRenderingContext2D, state: GameState): void {
  const sheet = getSprite(SPRITES.POWERUPS);

  for (const pu of state.powerUps) {
    if (sheet) {
      const frameIdx = POWERUP_FRAME_MAP[pu.type] ?? 0;
      const frameW = sheet.width / 6;
      const frameH = sheet.height;

      const pulse = 1 + 0.05 * Math.sin(state.frameCount * 0.1);
      const drawW = pu.width * pulse;
      const drawH = pu.height * pulse;
      const drawX = pu.x + (pu.width - drawW) / 2;
      const drawY = pu.y + (pu.height - drawH) / 2;

      ctx.drawImage(
        sheet,
        frameIdx * frameW, 0, frameW, frameH,
        drawX, drawY, drawW, drawH
      );
    } else {
      const pcx = pu.x + pu.width / 2;
      const pcy = pu.y + pu.height / 2;

      const colors: Record<string, string> = {
        SHIELD: "#4488ff", SPEED: "#ffdd00", BOMB: "#ff3333",
        MAGNET: "#aa44ff", SIDE_GUNNERS: "#44ff44",
        RAPID_FIRE: "#ff8800", WEAPON_UP: "#ffffff",
      };
      const symbols: Record<string, string> = {
        SHIELD: "S", SPEED: ">>", BOMB: "B",
        MAGNET: "M", SIDE_GUNNERS: "+",
        RAPID_FIRE: "R", WEAPON_UP: "W",
      };

      ctx.fillStyle = "#ffffff22";
      ctx.beginPath();
      ctx.roundRect(pu.x, pu.y, pu.width, pu.height, 6);
      ctx.fill();

      ctx.fillStyle = colors[pu.type] ?? "#ffffff";
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(symbols[pu.type] ?? "?", pcx, pcy);
    }
  }
}


// ─── Wave Indicator ──────────────────────────────────────────────────

function drawWaveIndicator(ctx: CanvasRenderingContext2D, state: GameState): void {
  const alpha = Math.min(1, state.waveDelay / 30);
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.font = "bold 24px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    `WAVE ${state.currentWave + 1}`,
    CANVAS_WIDTH / 2,
    GAME_AREA_HEIGHT / 2 - 40
  );
}

// ─── Boss ─────────────────────────────────────────────────────────────

const BOSS_SPRITE_MAP: Record<number, string> = {
  1: SPRITES.BOSS_ROCKJAW,
  2: SPRITES.BOSS_GLACIUS,
  3: SPRITES.BOSS_CINDERMAW,
  4: SPRITES.BOSS_NYXAR,
  5: SPRITES.BOSS_HOLLOW_MIND,
};

const BOSS_FALLBACK_COLORS: Record<number, { body: string; detail: string; core: string }> = {
  1: { body: "#665544", detail: "#443322", core: "#ff4400" },
  2: { body: "#4488cc", detail: "#226699", core: "#88ddff" },
  3: { body: "#884422", detail: "#663311", core: "#ff6600" },
  4: { body: "#332244", detail: "#221133", core: "#aa44ff" },
  5: { body: "#335533", detail: "#224422", core: "#44ff88" },
};

function drawBoss(
  ctx: CanvasRenderingContext2D,
  boss: Boss,
  frameCount: number
): void {
  ctx.save();

  const spritePath = BOSS_SPRITE_MAP[boss.id] || SPRITES.BOSS_ROCKJAW;
  const sprite = getSprite(spritePath);

  if (sprite) {
    ctx.drawImage(sprite, boss.x, boss.y, boss.width, boss.height);
  } else {
    // Fallback: procedural boss shape with themed colors
    const colors = BOSS_FALLBACK_COLORS[boss.id] || BOSS_FALLBACK_COLORS[1];
    ctx.fillStyle = colors.body;
    ctx.beginPath();
    ctx.arc(boss.x + boss.width / 2, boss.y + boss.height / 2, boss.width / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = colors.detail;
    ctx.beginPath();
    ctx.arc(boss.x + boss.width * 0.35, boss.y + boss.height * 0.3, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(boss.x + boss.width * 0.7, boss.y + boss.height * 0.4, 20, 0, Math.PI * 2);
    ctx.fill();
  }

  // Glowing core when weak point is vulnerable
  const wp = boss.parts.find((p) => p.isWeakPoint);
  if (wp && wp.vulnerable) {
    const coreX = boss.x + wp.x + wp.width / 2;
    const coreY = boss.y + wp.y + wp.height / 2;
    const pulse = 0.5 + 0.5 * Math.sin(frameCount * 0.15);
    const coreColor = BOSS_FALLBACK_COLORS[boss.id]?.core || "#ff4400";

    ctx.globalAlpha = 0.4 + pulse * 0.3;
    ctx.shadowBlur = 20;
    ctx.shadowColor = coreColor;
    ctx.fillStyle = coreColor;
    ctx.globalAlpha = 0.3 + pulse * 0.2;
    ctx.beginPath();
    ctx.ellipse(coreX, coreY, wp.width / 2, wp.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  // Enraged aura (phase 2+)
  if (boss.phase >= 2) {
    const coreColor = BOSS_FALLBACK_COLORS[boss.id]?.core || "#ff2200";
    const aura = 0.1 + 0.05 * Math.sin(frameCount * 0.2);
    ctx.globalAlpha = aura;
    ctx.strokeStyle = coreColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(boss.x + boss.width / 2, boss.y + boss.height / 2, boss.width / 2 + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function drawBossHealthBar(
  ctx: CanvasRenderingContext2D,
  boss: Boss
): void {
  ctx.save();

  const barW = CANVAS_WIDTH - 80;
  const barH = 10;
  const barX = 40;
  const barY = 50;

  // Boss name
  ctx.fillStyle = "#ff4444";
  ctx.font = "bold 14px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(boss.name.toUpperCase(), CANVAS_WIDTH / 2, barY - 4);

  // Background
  ctx.fillStyle = "#222222";
  ctx.fillRect(barX, barY, barW, barH);

  // HP fill
  const hpPct = boss.hp / boss.maxHp;
  const hpColor = boss.phase === 2 ? "#ff2200" : "#ff6600";
  ctx.fillStyle = hpColor;
  ctx.fillRect(barX, barY, barW * hpPct, barH);

  // Border
  ctx.strokeStyle = "#888888";
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, barH);

  // Phase marker at 50%
  ctx.fillStyle = "#ffffff44";
  ctx.fillRect(barX + barW * 0.5 - 1, barY, 2, barH);

  ctx.restore();
}

// ─── Briefing Screen ──────────────────────────────────────────────────

function drawBriefing(
  ctx: CanvasRenderingContext2D,
  state: GameState
): void {
  const levelData = getLevelData(state.currentWorld, state.currentLevel);
  if (!levelData) return;

  const hasWorldIntro = !!levelData.worldIntroText;
  const totalTime = hasWorldIntro ? 600 : 360;
  const elapsed = totalTime - state.briefingTimer;

  ctx.save();

  // Dim overlay
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Fade in/out
  const fadeIn = Math.min(1, elapsed / 30);
  const fadeOut = Math.min(1, state.briefingTimer / 30);
  ctx.globalAlpha = Math.min(fadeIn, fadeOut);

  if (hasWorldIntro && state.briefingTimer > 300) {
    // World intro phase
    const worldName = WORLD_NAMES[state.currentWorld - 1] || "Unknown Sector";

    ctx.fillStyle = "#44ccff";
    ctx.font = "bold 20px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`SECTOR: ${worldName.toUpperCase()}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60);

    ctx.fillStyle = "#aaaaaa";
    ctx.font = "14px monospace";
    wrapText(ctx, levelData.worldIntroText!, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH - 80, 20);
  } else {
    // Level briefing phase
    ctx.fillStyle = "#888888";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      `WORLD ${state.currentWorld} - LEVEL ${state.currentLevel}`,
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2 - 80
    );

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px monospace";
    ctx.fillText(levelData.name.toUpperCase(), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);

    ctx.fillStyle = "#aaaaaa";
    ctx.font = "14px monospace";
    wrapText(ctx, levelData.briefingText, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 10, CANVAS_WIDTH - 80, 20);

    ctx.fillStyle = "#555555";
    ctx.font = "11px monospace";
    ctx.fillText("PRESS ENTER OR TAP TO SKIP", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 100);

    // Controls hint
    ctx.fillStyle = "#44444488";
    ctx.font = "10px monospace";
    ctx.fillText("SPACE: FIRE   B: BOMB   \u2190\u2191\u2192\u2193: MOVE", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 130);
    ctx.fillText("MOBILE: TOUCH MOVE  2-FINGER TAP: BOMB", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 145);
  }

  ctx.restore();
}

// ─── Boss Intro Screen ────────────────────────────────────────────────

function drawBossIntro(
  ctx: CanvasRenderingContext2D,
  state: GameState
): void {
  ctx.save();

  // Dim overlay
  ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const timer = state.bossIntroTimer;

  // Flashing "WARNING" text
  const flash = Math.floor(timer / 8) % 2 === 0;
  if (flash) {
    ctx.fillStyle = "#ff0000";
    ctx.font = "bold 48px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("WARNING", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60);
  }

  // Horizontal warning stripes
  ctx.fillStyle = "rgba(255, 0, 0, 0.15)";
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(0, CANVAS_HEIGHT / 2 - 100 + i * 8, CANVAS_WIDTH, 4);
    ctx.fillRect(0, CANVAS_HEIGHT / 2 + 50 + i * 8, CANVAS_WIDTH, 4);
  }

  // Boss name (fades in during second half)
  if (timer < 120) {
    const alpha = Math.min(1, (120 - timer) / 30);
    ctx.globalAlpha = alpha;

    const levelData = getLevelData(state.currentWorld, state.currentLevel);
    const bossName = levelData?.name ?? "UNKNOWN";

    ctx.fillStyle = "#ff6600";
    ctx.font = "bold 32px monospace";
    ctx.textAlign = "center";
    ctx.fillText(bossName.toUpperCase(), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 10);

    const worldName = WORLD_NAMES[state.currentWorld - 1] || "Unknown Sector";
    ctx.fillStyle = "#888888";
    ctx.font = "14px monospace";
    ctx.fillText(`${worldName.toUpperCase()} COMMANDER`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);

    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

// ─── Level Complete Banner ────────────────────────────────────────────

function drawLevelCompleteBanner(
  ctx: CanvasRenderingContext2D,
  state: GameState
): void {
  const t = state.levelCompleteTimer;
  const total = 360;

  // Fade in (first 30 frames) and fade out (last 45 frames)
  const fadeIn = Math.min(1, (total - t) / 30);
  const fadeOut = Math.min(1, t / 45);
  const alpha = Math.min(fadeIn, fadeOut);

  ctx.save();
  ctx.globalAlpha = alpha;

  const centerY = GAME_AREA_HEIGHT / 2;

  // Semi-transparent banner strip
  const bannerY = centerY - 50;
  const bannerH = 100;
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, bannerY, CANVAS_WIDTH, bannerH);

  // Gold accent lines
  ctx.fillStyle = "#FFD700";
  ctx.fillRect(0, bannerY, CANVAS_WIDTH, 2);
  ctx.fillRect(0, bannerY + bannerH - 2, CANVAS_WIDTH, 2);

  // "LEVEL COMPLETE" text
  ctx.fillStyle = "#FFD700";
  ctx.font = "bold 28px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("LEVEL COMPLETE", CANVAS_WIDTH / 2, centerY - 12);

  // Score line
  ctx.fillStyle = "#aaaaaa";
  ctx.font = "14px monospace";
  ctx.fillText(
    `Score: ${state.score}  |  Kills: ${state.kills}`,
    CANVAS_WIDTH / 2,
    centerY + 18
  );

  ctx.restore();
}

// ─── Text Helpers ─────────────────────────────────────────────────────

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): void {
  const words = text.split(" ");
  let line = "";
  let lineY = y;

  for (const word of words) {
    const testLine = line + (line ? " " : "") + word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line) {
      ctx.fillText(line, x, lineY);
      line = word;
      lineY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, x, lineY);
  }
}

// ─── Intro Crawl ────────────────────────────────────────────────────

interface IntroPanel {
  text: string;
  style: "title" | "body" | "emphasis";
  startFrame: number;
  duration: number;
}

const FADE_FRAMES = 45;
const PANEL_GAP = 40; // breathing room between panels

const INTRO_PANELS: IntroPanel[] = (() => {
  const panels: Omit<IntroPanel, "startFrame">[] = [
    { text: "THE YEAR 2847", style: "title", duration: 270 },
    {
      text: "Humanity has spread across the stars.\nThousands of colony worlds.\nA golden age of expansion.",
      style: "body",
      duration: 420,
    },
    { text: "Then The Signal arrived.", style: "emphasis", duration: 300 },
    {
      text: "An electromagnetic whisper from the void.\nComing from a region every star chart\nlabeled FORBIDDEN.",
      style: "body",
      duration: 440,
    },
    { text: "Sector Zero.", style: "title", duration: 280 },
    {
      text: "The colonies closest to the source\nfell silent first. Then entire systems\nwent dark.",
      style: "body",
      duration: 400,
    },
    {
      text: "Survivors spoke of hostiles\nunlike anything in our records.",
      style: "body",
      duration: 360,
    },
    { text: "The Hollow.", style: "title", duration: 280 },
    {
      text: "An alien hivemind.\nFast. Adaptive. Relentless.\nThey consumed everything in their path.",
      style: "body",
      duration: 440,
    },
    {
      text: "The United Earth Coalition\nhas one option remaining.",
      style: "body",
      duration: 360,
    },
    {
      text: "Send a strike team into Sector Zero.\nFind the source of The Signal.\nDestroy the Hollow Mind.\nEnd this war.",
      style: "body",
      duration: 480,
    },
    { text: "Whatever the cost.", style: "emphasis", duration: 340 },
  ];
  let frame = 120; // initial delay before first panel
  return panels.map((p) => {
    const panel = { ...p, startFrame: frame };
    frame += p.duration + PANEL_GAP;
    return panel;
  });
})();

export const INTRO_TOTAL_FRAMES =
  INTRO_PANELS[INTRO_PANELS.length - 1].startFrame +
  INTRO_PANELS[INTRO_PANELS.length - 1].duration +
  60;

export function drawIntroCrawl(
  ctx: CanvasRenderingContext2D,
  frame: number
): void {
  ctx.save();

  // Black background
  ctx.fillStyle = "#000005";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Twinkling stars (reuse mapStars)
  const stars = getMapStars()!;
  for (const star of stars) {
    const alpha =
      0.2 + 0.5 * Math.abs(Math.sin(frame * 0.015 + star.twinkle));
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw active panels
  for (const panel of INTRO_PANELS) {
    const elapsed = frame - panel.startFrame;
    if (elapsed < 0 || elapsed > panel.duration) continue;

    // Fade in / out
    const fadeIn = Math.min(1, elapsed / FADE_FRAMES);
    const fadeOut = Math.min(1, (panel.duration - elapsed) / FADE_FRAMES);
    const alpha = Math.min(fadeIn, fadeOut);
    if (alpha <= 0) continue;

    ctx.globalAlpha = alpha;

    const lines = panel.text.split("\n");
    const centerY = CANVAS_HEIGHT / 2;

    switch (panel.style) {
      case "title":
        ctx.fillStyle = "#44ccff";
        ctx.font = "bold 32px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(lines[0], CANVAS_WIDTH / 2, centerY);
        break;
      case "emphasis":
        ctx.fillStyle = "#aa44ff";
        ctx.font = "bold 24px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(lines[0], CANVAS_WIDTH / 2, centerY);
        break;
      case "body": {
        ctx.fillStyle = "#cccccc";
        ctx.font = "15px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const lineH = 24;
        const startY = centerY - ((lines.length - 1) * lineH) / 2;
        for (let i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], CANVAS_WIDTH / 2, startY + i * lineH);
        }
        break;
      }
    }
  }

  // Skip hint (fade in after 120 frames)
  const hintAlpha = Math.min(0.5, Math.max(0, (frame - 120) / 60));
  ctx.globalAlpha = hintAlpha;
  ctx.fillStyle = "#555555";
  ctx.font = "11px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("PRESS ENTER OR TAP TO SKIP", CANVAS_WIDTH / 2, CANVAS_HEIGHT - 20);

  ctx.restore();
}

// ─── Star Map ───────────────────────────────────────────────────────

// Background stars for the map screen (cached)
let mapStars: { x: number; y: number; size: number; twinkle: number }[] | null = null;

function getMapStars(): typeof mapStars {
  if (!mapStars) {
    mapStars = [];
    for (let i = 0; i < 120; i++) {
      mapStars.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        size: 0.3 + Math.random() * 1.5,
        twinkle: Math.random() * Math.PI * 2,
      });
    }
  }
  return mapStars;
}

// World icon sprite keys indexed by world number (1-based)
const MAP_WORLD_SPRITES = [
  SPRITES.MAP_WORLD_1,
  SPRITES.MAP_WORLD_2,
  SPRITES.MAP_WORLD_3,
  SPRITES.MAP_WORLD_4,
  SPRITES.MAP_WORLD_5,
  SPRITES.MAP_WORLD_6,
  SPRITES.MAP_WORLD_7,
  SPRITES.MAP_WORLD_8,
];

export function drawStarMap(
  ctx: CanvasRenderingContext2D,
  mapState: StarMapState,
  save: SaveData
): void {
  ctx.save();

  // ── Background: art + twinkling stars ──
  const mapBg = getSprite(SPRITES.MAP_BG);
  if (mapBg) {
    ctx.drawImage(mapBg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  } else {
    ctx.fillStyle = "#000005";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  // Twinkling stars on top of background for depth
  const stars = getMapStars()!;
  for (const star of stars) {
    const alpha = 0.3 + 0.7 * Math.abs(Math.sin(mapState.animTimer * 0.02 + star.twinkle));
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Title ──
  ctx.shadowBlur = 12;
  ctx.shadowColor = "#44ccff";
  ctx.fillStyle = "#44ccff";
  ctx.font = "bold 22px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("SECTOR ZERO", CANVAS_WIDTH / 2, 20);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#667788";
  ctx.font = "11px monospace";
  ctx.fillText("SELECT SECTOR", CANVAS_WIDTH / 2, 48);

  // ── World nodes ──
  const worldNodes = getWorldNodes(save);

  // Determine revealed worlds: unlocked + the next one as a teaser
  const highestUnlocked = worldNodes.reduce(
    (max, n) => (n.unlocked ? Math.max(max, n.world) : max), 0
  );
  const revealedUpTo = Math.min(highestUnlocked + 1, 8);
  const visibleNodes = worldNodes.filter((n) => n.world <= revealedUpTo);

  // Connecting paths — only between visible nodes
  for (let i = 0; i < visibleNodes.length - 1; i++) {
    const from = visibleNodes[i];
    const to = visibleNodes[i + 1];
    if (to.unlocked) {
      // Glow layer
      ctx.strokeStyle = from.color + "33";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      // Core line
      ctx.strokeStyle = from.color + "88";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    } else {
      // Faint dashed path to the next locked teaser
      ctx.strokeStyle = "#222233";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Draw each visible world node
  for (const node of visibleNodes) {
    const isSelected = mapState.selectedWorld === node.world;
    const iconSize = isSelected ? 52 : 40;
    const iconX = node.x - iconSize / 2;
    const iconY = node.y - iconSize / 2;

    if (!node.unlocked) {
      // Locked teaser: dim, mysterious, just a hint
      ctx.globalAlpha = 0.15;
      const lockedIcon = getSprite(MAP_WORLD_SPRITES[node.world - 1]);
      if (lockedIcon) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(node.x, node.y, iconSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(lockedIcon, iconX, iconY, iconSize, iconSize);
        ctx.restore();
      } else {
        ctx.fillStyle = "#1a1a2a";
        ctx.beginPath();
        ctx.arc(node.x, node.y, iconSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      // Dim border
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = "#444455";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.arc(node.x, node.y, iconSize / 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // Question mark
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "#556666";
      ctx.font = "bold 16px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", node.x, node.y);
      ctx.globalAlpha = 1;
    } else {
      // Unlocked: world icon sprite
      const worldIcon = getSprite(MAP_WORLD_SPRITES[node.world - 1]);

      // Selection glow ring
      if (isSelected) {
        const pulse = 0.5 + 0.3 * Math.sin(mapState.animTimer * 0.06);
        ctx.shadowBlur = 20;
        ctx.shadowColor = node.color;
        ctx.strokeStyle = node.color;
        ctx.globalAlpha = pulse;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(node.x, node.y, iconSize / 2 + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }

      if (worldIcon) {
        // Clip icon to circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(node.x, node.y, iconSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(worldIcon, iconX, iconY, iconSize, iconSize);
        ctx.restore();
      } else {
        // Fallback colored circle
        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.arc(node.x, node.y, iconSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Border ring
      ctx.strokeStyle = isSelected ? "#ffffff" : node.color + "aa";
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.beginPath();
      ctx.arc(node.x, node.y, iconSize / 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // World name label below node
    if (isSelected) {
      ctx.shadowBlur = 6;
      ctx.shadowColor = node.color;
    }
    ctx.fillStyle = node.unlocked
      ? (isSelected ? "#ffffff" : "#aaaaaa")
      : "#444455";
    ctx.font = isSelected ? "bold 11px monospace" : "10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(node.unlocked ? node.name : "???", node.x, node.y + iconSize / 2 + 6);
    ctx.shadowBlur = 0;
  }

  // ── Ship cursor on selected world ──
  const selectedNode = visibleNodes.find((n) => n.world === mapState.selectedWorld);
  if (selectedNode && !mapState.expanded) {
    const shipSprite = getSprite(SPRITES.MAP_SHIP);
    if (shipSprite) {
      const bob = Math.sin(mapState.animTimer * 0.08) * 3;
      const shipSize = 28;
      const shipX = selectedNode.x - shipSize / 2;
      const shipY = selectedNode.y - (selectedNode.unlocked ? 52 : 40) / 2 - shipSize - 6 + bob;
      ctx.drawImage(shipSprite, shipX, shipY, shipSize, shipSize);
    }
  }

  // ── Level sub-nodes when expanded ──
  if (mapState.expanded) {
    const selectedWorldNode = visibleNodes.find((n) => n.world === mapState.selectedWorld);
    if (selectedWorldNode) {
      const levelNodes = getLevelNodes(mapState.selectedWorld, selectedWorldNode, save);

      // Semi-transparent panel behind level list
      if (levelNodes.length > 0) {
        const panelX = selectedWorldNode.x + 30;
        const panelY = levelNodes[0].y - 18;
        const panelW = CANVAS_WIDTH - panelX - 10;
        const panelH = (levelNodes.length - 1) * 35 + 36;
        ctx.fillStyle = "rgba(0, 0, 10, 0.7)";
        ctx.beginPath();
        ctx.roundRect(panelX - 8, panelY, panelW, panelH, 6);
        ctx.fill();
        ctx.strokeStyle = selectedWorldNode.color + "44";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(panelX - 8, panelY, panelW, panelH, 6);
        ctx.stroke();
      }

      // Connector line from world to level panel
      if (levelNodes.length > 0) {
        ctx.strokeStyle = selectedWorldNode.color + "55";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(selectedWorldNode.x + 26, selectedWorldNode.y);
        ctx.lineTo(levelNodes[0].x - 8, levelNodes[0].y);
        ctx.stroke();
      }

      // Draw level-to-level connectors
      for (let i = 0; i < levelNodes.length - 1; i++) {
        ctx.strokeStyle = levelNodes[i + 1].unlocked
          ? selectedWorldNode.color + "44"
          : "#1a1a2a";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(levelNodes[i].x, levelNodes[i].y);
        ctx.lineTo(levelNodes[i + 1].x, levelNodes[i + 1].y);
        ctx.stroke();
      }

      // Ship cursor on selected level
      const selectedLvl = levelNodes.find((l) => l.level === mapState.selectedLevel);
      if (selectedLvl) {
        const shipSprite = getSprite(SPRITES.MAP_SHIP);
        if (shipSprite) {
          const bob = Math.sin(mapState.animTimer * 0.08) * 2;
          const shipSize = 20;
          ctx.drawImage(
            shipSprite,
            selectedLvl.x - shipSize - 8,
            selectedLvl.y - shipSize / 2 + bob,
            shipSize,
            shipSize
          );
        }
      }

      for (const lvl of levelNodes) {
        const isSelected = mapState.selectedLevel === lvl.level;
        const nodeRadius = lvl.isBoss ? 12 : 9;

        if (!lvl.unlocked) {
          ctx.fillStyle = "#1a1a2a";
          ctx.strokeStyle = "#333344";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(lvl.x, lvl.y, nodeRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#444455";
          ctx.font = "8px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("?", lvl.x, lvl.y);
        } else {
          const color = lvl.isBoss ? "#ff4444" : selectedWorldNode.color;

          // Selection highlight
          if (isSelected) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = color;
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(lvl.x, lvl.y, nodeRadius + 3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
          }

          ctx.fillStyle = lvl.completed ? color : color + "55";
          ctx.beginPath();
          ctx.arc(lvl.x, lvl.y, nodeRadius, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(lvl.x, lvl.y, nodeRadius, 0, Math.PI * 2);
          ctx.stroke();

          // Level number
          ctx.fillStyle = lvl.completed ? "#000000" : "#ffffff";
          ctx.font = `bold ${lvl.isBoss ? 10 : 9}px monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(lvl.isBoss ? "B" : `${lvl.level}`, lvl.x, lvl.y);

          // Stars
          if (lvl.completed && lvl.stars > 0) {
            ctx.fillStyle = "#FFD700";
            ctx.font = "8px monospace";
            ctx.textAlign = "left";
            const starStr = "\u2605".repeat(lvl.stars) + "\u2606".repeat(3 - lvl.stars);
            ctx.fillText(starStr, lvl.x + nodeRadius + 4, lvl.y + 1);
          }
        }

        // Level name
        ctx.fillStyle = lvl.unlocked
          ? (isSelected ? "#ffffff" : "#889999")
          : "#333344";
        ctx.font = "9px monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        const nameX = lvl.x + nodeRadius + (lvl.completed && lvl.stars > 0 ? 36 : 6);
        ctx.fillText(lvl.name, nameX, lvl.y);
      }

      // ── Planet indicator dots below levels (visual only — launch from Mission Board) ──
      const planetNodesForWorld = getPlanetNodes(save).filter(
        (pn) => pn.pairedWorld === mapState.selectedWorld
      );
      const lastLvl = levelNodes[levelNodes.length - 1];
      if (planetNodesForWorld.length > 0 && lastLvl) {
        for (let pi = 0; pi < planetNodesForWorld.length; pi++) {
          const pn = planetNodesForWorld[pi];
          const planetY = lastLvl.y + 38 + pi * 28;
          const planetX = lastLvl.x;

          // Connector from last level (or previous planet)
          const fromY = pi === 0 ? lastLvl.y : lastLvl.y + 38 + (pi - 1) * 28;
          ctx.strokeStyle = (pn.unlocked ? pn.color : "#222233") + "44";
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 4]);
          ctx.beginPath();
          ctx.moveTo(planetX, fromY);
          ctx.lineTo(planetX, planetY);
          ctx.stroke();
          ctx.setLineDash([]);

          // Planet icon (sprite or fallback dot)
          const planetDef = PLANET_DEFS.find(pd => pd.id === pn.planetId);
          const iconKey = planetDef?.mapIcon as keyof typeof SPRITES | undefined;
          const iconImg = iconKey ? getSprite(SPRITES[iconKey]) : null;
          const pRadius = 8;

          if (iconImg && pn.unlocked) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(planetX, planetY, pRadius, 0, Math.PI * 2);
            ctx.clip();
            ctx.globalAlpha = pn.completed ? 1 : 0.7;
            ctx.drawImage(iconImg, planetX - pRadius, planetY - pRadius, pRadius * 2, pRadius * 2);
            ctx.globalAlpha = 1;
            ctx.restore();
            ctx.strokeStyle = pn.color + "88";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(planetX, planetY, pRadius, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            ctx.fillStyle = "#1a1a2a";
            ctx.beginPath();
            ctx.arc(planetX, planetY, pRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#333344";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(planetX, planetY, pRadius, 0, Math.PI * 2);
            ctx.stroke();
          }

          // Checkmark if completed
          if (pn.completed) {
            ctx.fillStyle = "#44ff88";
            ctx.font = "bold 8px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("\u2713", planetX, planetY);
          }

          // Planet name
          ctx.fillStyle = pn.unlocked ? "#667788" : "#333344";
          ctx.font = "8px monospace";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(pn.unlocked ? pn.name : "???", planetX + 12, planetY);
        }
      }
    }
  }

  // ── Controls hint ──
  ctx.fillStyle = "#556666";
  ctx.font = "10px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(
    mapState.expanded
      ? "\u2191\u2193 SELECT  ENTER PLAY  \u2190 BACK"
      : "\u2191\u2193 SELECT  ENTER/\u2192 EXPAND  \u2190 MENU",
    CANVAS_WIDTH / 2,
    CANVAS_HEIGHT - 16
  );

  // ── Total stars ──
  ctx.shadowBlur = 4;
  ctx.shadowColor = "#FFD700";
  ctx.fillStyle = "#FFD700";
  ctx.font = "12px monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillText(`\u2605 ${save.totalStars}`, CANVAS_WIDTH - 16, 20);
  ctx.shadowBlur = 0;

  ctx.restore();
}

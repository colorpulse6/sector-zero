import {
  CANVAS_WIDTH,
  GAME_AREA_HEIGHT,
  DASHBOARD_Y,
  DASHBOARD_HEIGHT,
  PowerUpType,
  POWER_UP_COLORS,
  POWER_UP_SYMBOLS,
  type GameState,
} from "./types";
import { getSprite, SPRITES } from "./sprites";

// ─── Power-up sprite frame indices ─────────────────────────────────
const POWERUP_FRAME_MAP: Record<string, number> = {
  [PowerUpType.SHIELD]: 0,
  [PowerUpType.SPEED]: 1,
  [PowerUpType.BOMB]: 2,
  [PowerUpType.MAGNET]: 3,
  [PowerUpType.SIDE_GUNNERS]: 4,
  [PowerUpType.RAPID_FIRE]: 5,
};

// ─── Layout constants ──────────────────────────────────────────────
const PAD_X = 10;
const HP_BAR_Y = DASHBOARD_Y + 4;
const HP_BAR_H = 6;
const ROW1_Y = DASHBOARD_Y + 18;
const ROW2_Y = DASHBOARD_Y + 36;
const DIALOG_Y = DASHBOARD_Y + 58;
const DIALOG_PORTRAIT_SIZE = 60;
const XP_BAR_Y = DASHBOARD_Y + DASHBOARD_HEIGHT - 14;
const XP_BAR_H = 4;

// ─── Main draw function ────────────────────────────────────────────

export function drawDashboard(
  ctx: CanvasRenderingContext2D,
  state: GameState
): void {
  ctx.save();

  const isCritical = state.player.hp === 1 && state.player.maxHp > 1;

  // ── Critical HP: red vignette on game area edges ──
  if (isCritical) {
    const pulse = 0.08 + 0.06 * Math.sin(state.frameCount * 0.12);
    // Left edge
    const leftGrad = ctx.createLinearGradient(0, 0, 40, 0);
    leftGrad.addColorStop(0, `rgba(255, 0, 0, ${pulse})`);
    leftGrad.addColorStop(1, "rgba(255, 0, 0, 0)");
    ctx.fillStyle = leftGrad;
    ctx.fillRect(0, 0, 40, GAME_AREA_HEIGHT);
    // Right edge
    const rightGrad = ctx.createLinearGradient(CANVAS_WIDTH - 40, 0, CANVAS_WIDTH, 0);
    rightGrad.addColorStop(0, "rgba(255, 0, 0, 0)");
    rightGrad.addColorStop(1, `rgba(255, 0, 0, ${pulse})`);
    ctx.fillStyle = rightGrad;
    ctx.fillRect(CANVAS_WIDTH - 40, 0, 40, GAME_AREA_HEIGHT);
    // Top edge
    const topGrad = ctx.createLinearGradient(0, 0, 0, 30);
    topGrad.addColorStop(0, `rgba(255, 0, 0, ${pulse})`);
    topGrad.addColorStop(1, "rgba(255, 0, 0, 0)");
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, 30);
  }

  // ── Background panel ──
  ctx.fillStyle = "rgba(0, 8, 16, 0.92)";
  ctx.fillRect(0, DASHBOARD_Y, CANVAS_WIDTH, DASHBOARD_HEIGHT);

  // Separator line (pulses red at critical HP)
  if (isCritical) {
    const sepPulse = 0.5 + 0.5 * Math.sin(state.frameCount * 0.15);
    ctx.fillStyle = `rgba(255, 68, 68, ${sepPulse})`;
  } else {
    ctx.fillStyle = "#334455";
  }
  ctx.fillRect(0, DASHBOARD_Y, CANVAS_WIDTH, 1);

  // Subtle top border accent
  ctx.fillStyle = isCritical ? "#ff444433" : "#44ccff22";
  ctx.fillRect(0, DASHBOARD_Y + 1, CANVAS_WIDTH, 1);

  // ── HP Bar (full-width) ──
  drawHpBar(ctx, state);

  // ── Row 1: Score, Combo, Wave ──
  drawStatsRow(ctx, state);

  // ── Row 2: Weapon Level, Power-ups, Bombs ──
  drawEquipmentRow(ctx, state);

  // ── Dialog Zone ──
  drawDialogZone(ctx, state);

  // ── XP Bar ──
  drawXpBar(ctx, state);

  ctx.restore();
}

// ─── HP Bar ────────────────────────────────────────────────────────

function drawHpBar(
  ctx: CanvasRenderingContext2D,
  state: GameState
): void {
  const { player } = state;
  const barX = PAD_X;
  const barW = CANVAS_WIDTH - PAD_X * 2;
  const hpPct = player.hp / player.maxHp;

  // Background
  ctx.fillStyle = "#1a1a2a";
  ctx.fillRect(barX, HP_BAR_Y, barW, HP_BAR_H);

  // HP fill with color coding
  const hpColor = hpPct > 0.5 ? "#44cc44" : hpPct > 0.25 ? "#ffaa00" : "#ff4444";

  // Pulsing at critical HP
  if (player.hp === 1 && player.maxHp > 1) {
    const pulse = 0.6 + 0.4 * Math.sin(state.frameCount * 0.15);
    ctx.fillStyle = hpColor;
    ctx.globalAlpha = pulse;
    ctx.fillRect(barX, HP_BAR_Y, barW * hpPct, HP_BAR_H);
    ctx.globalAlpha = 1;

    // Glow effect
    ctx.shadowBlur = 8;
    ctx.shadowColor = "#ff4444";
    ctx.fillStyle = "#ff444466";
    ctx.fillRect(barX, HP_BAR_Y, barW * hpPct, HP_BAR_H);
    ctx.shadowBlur = 0;
  } else {
    ctx.fillStyle = hpColor;
    ctx.fillRect(barX, HP_BAR_Y, barW * hpPct, HP_BAR_H);
  }

  // HP pips (segment markers)
  if (player.maxHp > 1) {
    ctx.fillStyle = "#00000044";
    for (let i = 1; i < player.maxHp; i++) {
      const pipX = barX + (barW * i) / player.maxHp;
      ctx.fillRect(pipX - 0.5, HP_BAR_Y, 1, HP_BAR_H);
    }
  }

  // Lives indicator (right side, above HP bar)
  ctx.fillStyle = "#44ccff";
  ctx.font = "9px monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  const livesText = "\u25B2".repeat(Math.max(0, state.lives));
  ctx.fillText(livesText, CANVAS_WIDTH - PAD_X, HP_BAR_Y - 1);
}

// ─── Stats Row ─────────────────────────────────────────────────────

function drawStatsRow(
  ctx: CanvasRenderingContext2D,
  state: GameState
): void {
  // Score (left)
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 12px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`SCORE ${state.score}`, PAD_X, ROW1_Y);

  // Combo (center)
  if (state.combo >= 2) {
    ctx.fillStyle = "#ffcc00";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`x${state.combo} COMBO`, CANVAS_WIDTH / 2, ROW1_Y);
  }

  // Wave counter (right)
  if (state.totalWaves > 0) {
    ctx.fillStyle = "#889999";
    ctx.font = "11px monospace";
    ctx.textAlign = "right";
    ctx.fillText(
      `WAVE ${Math.min(state.currentWave + 1, state.totalWaves)}/${state.totalWaves}`,
      CANVAS_WIDTH - PAD_X,
      ROW1_Y
    );
  }
}

// ─── Equipment Row ─────────────────────────────────────────────────

function drawEquipmentRow(
  ctx: CanvasRenderingContext2D,
  state: GameState
): void {
  // Weapon level (left)
  ctx.fillStyle = "#44ccff";
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`WPN LV${state.player.weaponLevel}`, PAD_X, ROW2_Y);

  // Active power-ups (center area)
  const puSheet = getSprite(SPRITES.POWERUPS);
  let puX = 90;

  for (const ap of state.activePowerUps) {
    const pct = ap.remainingFrames / ap.totalFrames;

    if (puSheet) {
      const frameIdx = POWERUP_FRAME_MAP[ap.type] ?? 0;
      const frameW = puSheet.width / 6;
      const frameH = puSheet.height;

      // Icon
      ctx.drawImage(
        puSheet,
        frameIdx * frameW, 0, frameW, frameH,
        puX, ROW2_Y - 2, 18, 18
      );

      // Duration bar below icon
      ctx.fillStyle = "#ffffff22";
      ctx.fillRect(puX, ROW2_Y + 17, 18, 2);
      const puColor = POWER_UP_COLORS[ap.type] || "#44ccff";
      ctx.fillStyle = puColor;
      ctx.fillRect(puX, ROW2_Y + 17, 18 * Math.min(1, pct), 2);
    } else {
      // Fallback: colored label
      const color = POWER_UP_COLORS[ap.type] || "#ffffff";
      const symbol = POWER_UP_SYMBOLS[ap.type] || "?";

      ctx.fillStyle = color;
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "left";
      ctx.fillText(symbol, puX + 2, ROW2_Y);

      // Duration bar
      ctx.fillStyle = color + "44";
      ctx.fillRect(puX, ROW2_Y + 12, 22, 2);
      ctx.fillStyle = color;
      ctx.fillRect(puX, ROW2_Y + 12, 22 * Math.min(1, pct), 2);
    }

    puX += 24;
  }

  // Bomb count (right)
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  if (state.bombs > 0) {
    ctx.shadowBlur = 4;
    ctx.shadowColor = "#ff3333";
    ctx.fillStyle = "#ff4444";
    ctx.font = "bold 11px monospace";
    ctx.fillText(`[B] \u25CF\u00D7${state.bombs}`, CANVAS_WIDTH - PAD_X, ROW2_Y);
    ctx.shadowBlur = 0;
  } else {
    ctx.fillStyle = "#444444";
    ctx.font = "11px monospace";
    ctx.fillText(`[B] \u25CB\u00D70`, CANVAS_WIDTH - PAD_X, ROW2_Y);
  }
}

// ─── Dialog Zone ───────────────────────────────────────────────────

function drawDialogZone(
  ctx: CanvasRenderingContext2D,
  state: GameState
): void {
  const { dialog } = state;

  if (!dialog.currentLine) {
    // No active dialog — show subtle world/level indicator
    ctx.fillStyle = "#334455";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(
      `SECTOR ${state.currentWorld}-${state.currentLevel}`,
      PAD_X,
      DIALOG_Y + 10
    );
    return;
  }

  const dl = dialog.currentLine;

  // Fade in/out
  const fadeInAlpha = Math.min(1, dialog.fadeIn / 10);
  const fadeOutAlpha = dialog.fadeOut > 0 ? dialog.fadeOut / 15 : 1;
  const alpha = Math.min(fadeInAlpha, fadeOutAlpha);
  if (alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;

  const accentColor = dl.color ?? "#44ccff";
  const portraitX = PAD_X;
  const portraitY = DIALOG_Y;
  const textX = portraitX + DIALOG_PORTRAIT_SIZE + 10;
  const textMaxW = CANVAS_WIDTH - textX - PAD_X;

  // Portrait
  const spritePath = (SPRITES as Record<string, string>)[dl.portraitKey];
  const portrait = spritePath ? getSprite(spritePath) : null;

  if (portrait) {
    ctx.drawImage(
      portrait,
      portraitX,
      portraitY,
      DIALOG_PORTRAIT_SIZE,
      DIALOG_PORTRAIT_SIZE
    );
  } else {
    // Fallback: colored rectangle with speaker initial
    ctx.fillStyle = accentColor;
    ctx.globalAlpha = alpha * 0.25;
    ctx.fillRect(portraitX, portraitY, DIALOG_PORTRAIT_SIZE, DIALOG_PORTRAIT_SIZE);
    ctx.globalAlpha = alpha;

    ctx.fillStyle = accentColor;
    ctx.font = "bold 24px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      dl.speaker[0],
      portraitX + DIALOG_PORTRAIT_SIZE / 2,
      portraitY + DIALOG_PORTRAIT_SIZE / 2
    );
  }

  // Portrait border
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(portraitX, portraitY, DIALOG_PORTRAIT_SIZE, DIALOG_PORTRAIT_SIZE);

  // Speaker name
  ctx.fillStyle = accentColor;
  ctx.font = "bold 10px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(dl.speaker, textX, DIALOG_Y + 2);

  // Dialog text (word-wrapped)
  ctx.fillStyle = "#cccccc";
  ctx.font = "11px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  wrapText(ctx, dl.text, textX, DIALOG_Y + 16, textMaxW, 14);

  ctx.restore();
}

// ─── XP Bar ────────────────────────────────────────────────────────

function drawXpBar(
  ctx: CanvasRenderingContext2D,
  state: GameState
): void {
  const barX = PAD_X;
  const barW = CANVAS_WIDTH - PAD_X * 2;
  const BADGE_WIDTH = 35;

  // Pilot level badge
  ctx.fillStyle = "#44ccff";
  ctx.font = "bold 9px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`Lv${state.pilotLevel}`, barX, XP_BAR_Y + XP_BAR_H / 2);

  // XP label
  ctx.fillStyle = "#556677";
  ctx.font = "9px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText("XP", barX + BADGE_WIDTH, XP_BAR_Y - 1);

  // Background
  ctx.fillStyle = "#1a1a2a";
  ctx.fillRect(barX + BADGE_WIDTH + 20, XP_BAR_Y, barW - BADGE_WIDTH - 20, XP_BAR_H);

  const xp = state.xp;
  // Simple threshold display: show progress to next milestone
  // Thresholds: 0, 5000, 8000, 15000, 25000, 40000
  const thresholds = [0, 5000, 8000, 15000, 25000, 40000];
  let currentThreshold = 0;
  let nextThreshold = thresholds[1] || 5000;

  for (let i = 0; i < thresholds.length - 1; i++) {
    if (xp >= thresholds[i]) {
      currentThreshold = thresholds[i];
      nextThreshold = thresholds[i + 1];
    }
  }

  const xpProgress = nextThreshold > currentThreshold
    ? (xp - currentThreshold) / (nextThreshold - currentThreshold)
    : 1;

  // XP bar fill with gradient feel
  ctx.fillStyle = "#6644aa";
  ctx.fillRect(barX + BADGE_WIDTH + 20, XP_BAR_Y, (barW - BADGE_WIDTH - 20) * Math.min(1, xpProgress), XP_BAR_H);

  // XP amount (right)
  ctx.fillStyle = "#7766aa";
  ctx.font = "9px monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText(`${xp.toLocaleString()}`, CANVAS_WIDTH - PAD_X, XP_BAR_Y - 1);
}

// ─── Text Helpers ──────────────────────────────────────────────────

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

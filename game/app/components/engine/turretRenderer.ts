import {
  CANVAS_WIDTH,
  GAME_AREA_HEIGHT,
  type GameState,
  type TurretState,
  type TurretEnemy,
} from "./types";
import { drawDashboard } from "./dashboard";
import { drawFloatingLabels } from "./floatingLabels";
import { drawSpriteExplosions } from "./particles";
import { getSprite, SPRITES } from "./sprites";

// ─── Star Field (background) ────────────────────────────────────────

const STARS: Array<{ x: number; y: number; size: number; speed: number }> = [];
for (let i = 0; i < 100; i++) {
  STARS.push({
    x: Math.random() * CANVAS_WIDTH,
    y: Math.random() * GAME_AREA_HEIGHT,
    size: 0.5 + Math.random() * 1.5,
    speed: 0.2 + Math.random() * 0.5,
  });
}

function drawStarField(ctx: CanvasRenderingContext2D, frameCount: number): void {
  // Dark space gradient
  const grad = ctx.createLinearGradient(0, 0, 0, GAME_AREA_HEIGHT);
  grad.addColorStop(0, "#020208");
  grad.addColorStop(0.7, "#060612");
  grad.addColorStop(1, "#0a0a1a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, GAME_AREA_HEIGHT);

  // Background sprite if available
  const bgSprite = getSprite(SPRITES.TURRET_BG);
  if (bgSprite) {
    ctx.globalAlpha = 0.6;
    ctx.drawImage(bgSprite, 0, 0, CANVAS_WIDTH, GAME_AREA_HEIGHT);
    ctx.globalAlpha = 1;
  }

  // Twinkling stars
  for (const star of STARS) {
    const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(frameCount * 0.02 + star.x));
    ctx.fillStyle = `rgba(200, 220, 255, ${twinkle})`;
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
}

// ─── Enemy Rendering ────────────────────────────────────────────────

const ENEMY_COLORS: Record<TurretEnemy["type"], string> = {
  drone: "#ff4444",
  fighter: "#cc8844",
  bomber: "#8844cc",
};

function drawEnemies(
  ctx: CanvasRenderingContext2D,
  enemies: TurretEnemy[],
  frameCount: number
): void {
  const fighterSprite = getSprite(SPRITES.TURRET_ENEMY_FIGHTER);
  const bomberSprite = getSprite(SPRITES.TURRET_ENEMY_BOMBER);
  const droneSprite = getSprite(SPRITES.TURRET_ENEMY_DRONE);

  // Sort by Z (farthest first) for proper overlap
  const sorted = [...enemies].sort((a, b) => b.z - a.z);

  for (const e of sorted) {
    if (e.z <= 0 || e.hp <= 0) continue;

    // Project to screen space — perspective projection
    const projX = 0.5 + (e.x - 0.5) / e.z;
    const projY = 0.5 + (e.y - 0.5) / e.z;
    const screenX = projX * CANVAS_WIDTH;
    const screenY = projY * GAME_AREA_HEIGHT;

    // Clip: skip enemies fully outside viewport
    const baseSize = e.type === "bomber" ? 60 : e.type === "fighter" ? 40 : 25;
    const size = baseSize / e.z;
    if (screenX + size / 2 < 0 || screenX - size / 2 > CANVAS_WIDTH) continue;
    if (screenY + size / 2 < 0 || screenY - size / 2 > GAME_AREA_HEIGHT) continue;

    // Pick sprite
    let sprite: HTMLImageElement | null = null;
    if (e.type === "fighter" && fighterSprite) {
      sprite = fighterSprite;
      // Fighter has 3 frames based on distance
      if (sprite) {
        const frameW = sprite.width / 3;
        const frameIdx = e.z > 0.7 ? 0 : e.z > 0.4 ? 1 : 2;
        ctx.drawImage(
          sprite,
          frameIdx * frameW, 0, frameW, sprite.height,
          screenX - size / 2, screenY - size / 2, size, size
        );
        // Continue to HP bar below
        sprite = null; // Don't draw again
      }
    } else if (e.type === "bomber") {
      sprite = bomberSprite;
    } else if (e.type === "drone") {
      sprite = droneSprite;
    }

    if (sprite) {
      ctx.drawImage(sprite, screenX - size / 2, screenY - size / 2, size, size);
    } else if (e.type !== "fighter" || !fighterSprite) {
      // Fallback: colored shape
      const color = ENEMY_COLORS[e.type];
      ctx.fillStyle = color;

      if (e.type === "drone") {
        // Small diamond
        ctx.beginPath();
        ctx.moveTo(screenX, screenY - size / 2);
        ctx.lineTo(screenX + size / 2, screenY);
        ctx.lineTo(screenX, screenY + size / 2);
        ctx.lineTo(screenX - size / 2, screenY);
        ctx.closePath();
        ctx.fill();
      } else if (e.type === "bomber") {
        // Large hexagon-ish
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
          const px = screenX + Math.cos(a) * size / 2;
          const py = screenY + Math.sin(a) * size / 2;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        // Fighter: triangle
        ctx.beginPath();
        ctx.moveTo(screenX, screenY - size / 2);
        ctx.lineTo(screenX + size / 2, screenY + size / 3);
        ctx.lineTo(screenX - size / 2, screenY + size / 3);
        ctx.closePath();
        ctx.fill();
      }

      // Engine glow
      ctx.fillStyle = e.type === "bomber" ? "#aa44ff66" : "#ff440066";
      ctx.beginPath();
      ctx.arc(screenX, screenY + size * 0.3, size * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // HP bar (only for damaged enemies)
    if (e.hp < e.maxHp && e.hp > 0) {
      const barW = size * 0.8;
      const barH = 3;
      const barX = screenX - barW / 2;
      const barY = screenY - size / 2 - 6;
      ctx.fillStyle = "#330000";
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = e.hp / e.maxHp > 0.5 ? "#44ff44" : "#ff4444";
      ctx.fillRect(barX, barY, barW * (e.hp / e.maxHp), barH);
    }
  }
}

// ─── Laser Bolts ────────────────────────────────────────────────────

function drawBolts(
  ctx: CanvasRenderingContext2D,
  ts: TurretState
): void {
  for (const b of ts.bolts) {
    // Project bolt position based on its depth
    const depth = Math.max(0.1, b.z);
    const screenX = (0.5 + (b.x - 0.5) / Math.max(0.3, depth)) * CANVAS_WIDTH;
    const screenY = (0.5 + (b.y - 0.5) / Math.max(0.3, depth)) * GAME_AREA_HEIGHT;

    // Bolt gets smaller as it flies away
    const boltSize = Math.max(2, 8 - b.z * 6);
    const alpha = Math.min(1, b.life / 10);

    ctx.save();
    ctx.globalAlpha = alpha;

    // Glow
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#44ffaa";

    // Bolt trail
    const trailLen = 12 - b.z * 8;
    const dx = b.targetX - 0.5;
    const dy = b.targetY - 0.5;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const trailX = screenX - (dx / len) * trailLen;
    const trailY = screenY - (dy / len) * trailLen;

    ctx.strokeStyle = "#44ffaa";
    ctx.lineWidth = boltSize;
    ctx.beginPath();
    ctx.moveTo(trailX, trailY);
    ctx.lineTo(screenX, screenY);
    ctx.stroke();

    // Bright head
    ctx.fillStyle = "#aaffdd";
    ctx.beginPath();
    ctx.arc(screenX, screenY, boltSize * 0.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// ─── Crosshair ──────────────────────────────────────────────────────

function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  ts: TurretState,
  frameCount: number
): void {
  const cx = ts.crosshairX * CANVAS_WIDTH;
  const cy = ts.crosshairY * GAME_AREA_HEIGHT;
  const pulse = 0.7 + 0.3 * Math.sin(frameCount * 0.1);

  const crosshairSprite = getSprite(SPRITES.TURRET_CROSSHAIR);
  if (crosshairSprite) {
    const size = 48;
    ctx.globalAlpha = pulse;
    ctx.drawImage(crosshairSprite, cx - size / 2, cy - size / 2, size, size);
    ctx.globalAlpha = 1;
  } else {
    // Fallback crosshair
    ctx.strokeStyle = `rgba(68, 204, 255, ${pulse})`;
    ctx.lineWidth = 2;

    // Outer circle
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.stroke();

    // Inner dot
    ctx.fillStyle = `rgba(68, 204, 255, ${pulse})`;
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();

    // Tick marks
    const ticks = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
    for (const a of ticks) {
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14);
      ctx.lineTo(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22);
      ctx.stroke();
    }
  }

  // Fire flash
  if (ts.fireCooldown > 4) {
    ctx.fillStyle = "rgba(255, 220, 100, 0.15)";
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Ship HP Bar ────────────────────────────────────────────────────

function drawShipHp(ctx: CanvasRenderingContext2D, ts: TurretState): void {
  const barW = 200;
  const barH = 8;
  const barX = CANVAS_WIDTH / 2 - barW / 2;
  const barY = GAME_AREA_HEIGHT - 20;

  ctx.fillStyle = "#222";
  ctx.fillRect(barX, barY, barW, barH);

  const ratio = ts.shipHp / ts.shipMaxHp;
  ctx.fillStyle = ratio > 0.5 ? "#44ff88" : ratio > 0.25 ? "#ffaa44" : "#ff4444";
  ctx.fillRect(barX, barY, barW * ratio, barH);

  ctx.strokeStyle = "#44668866";
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, barH);

  ctx.fillStyle = "#667788";
  ctx.font = "bold 9px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("DROPSHIP HULL", CANVAS_WIDTH / 2, barY - 2);
}

// ─── Wave Indicator ─────────────────────────────────────────────────

function drawWaveInfo(ctx: CanvasRenderingContext2D, ts: TurretState, frameCount: number): void {
  ctx.fillStyle = "#44ccff88";
  ctx.font = "10px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`WAVE ${ts.wave + 1} / ${ts.totalWaves}`, 12, 12);
  ctx.fillText(`KILLS: ${ts.killCount}`, 12, 26);

  // Wave incoming warning
  if (ts.waveTimer > 0 && ts.wave < ts.totalWaves) {
    const flash = Math.floor(frameCount / 15) % 2 === 0;
    if (flash) {
      ctx.fillStyle = "#ff444488";
      ctx.font = "bold 16px monospace";
      ctx.textAlign = "center";
      ctx.fillText("INCOMING", CANVAS_WIDTH / 2, 60);
    }
  }
}

// ─── Cockpit Frame Overlay ──────────────────────────────────────────

function drawCockpitFrame(ctx: CanvasRenderingContext2D): void {
  const frameSprite = getSprite(SPRITES.TURRET_COCKPIT_FRAME);
  if (frameSprite) {
    ctx.drawImage(frameSprite, 0, 0, CANVAS_WIDTH, GAME_AREA_HEIGHT);
  } else {
    // Fallback: dark vignette edges
    const vignetteGrad = ctx.createRadialGradient(
      CANVAS_WIDTH / 2, GAME_AREA_HEIGHT / 2, CANVAS_WIDTH * 0.3,
      CANVAS_WIDTH / 2, GAME_AREA_HEIGHT / 2, CANVAS_WIDTH * 0.6
    );
    vignetteGrad.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignetteGrad.addColorStop(1, "rgba(0, 0, 10, 0.5)");
    ctx.fillStyle = vignetteGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, GAME_AREA_HEIGHT);

    // Corner brackets
    ctx.strokeStyle = "#22446644";
    ctx.lineWidth = 2;
    const m = 20;
    const l = 40;
    // Top-left
    ctx.beginPath();
    ctx.moveTo(m, m + l);
    ctx.lineTo(m, m);
    ctx.lineTo(m + l, m);
    ctx.stroke();
    // Top-right
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH - m - l, m);
    ctx.lineTo(CANVAS_WIDTH - m, m);
    ctx.lineTo(CANVAS_WIDTH - m, m + l);
    ctx.stroke();
    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(m, GAME_AREA_HEIGHT - m - l);
    ctx.lineTo(m, GAME_AREA_HEIGHT - m);
    ctx.lineTo(m + l, GAME_AREA_HEIGHT - m);
    ctx.stroke();
    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH - m - l, GAME_AREA_HEIGHT - m);
    ctx.lineTo(CANVAS_WIDTH - m, GAME_AREA_HEIGHT - m);
    ctx.lineTo(CANVAS_WIDTH - m, GAME_AREA_HEIGHT - m - l);
    ctx.stroke();
  }
}

// ─── Level Complete ─────────────────────────────────────────────────

function drawCompleteBanner(ctx: CanvasRenderingContext2D, timer: number): void {
  const alpha = Math.min(1, timer / 30);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
  ctx.fillRect(0, GAME_AREA_HEIGHT / 2 - 44, CANVAS_WIDTH, 88);
  ctx.shadowColor = "#ffdd44";
  ctx.shadowBlur = 20;
  ctx.fillStyle = "#ffdd44";
  ctx.font = "bold 28px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ALL CLEAR", CANVAS_WIDTH / 2, GAME_AREA_HEIGHT / 2 - 10);
  ctx.font = "14px monospace";
  ctx.fillStyle = "#ffeeaa";
  ctx.shadowBlur = 8;
  ctx.fillText("TURRET DEFENSE COMPLETE", CANVAS_WIDTH / 2, GAME_AREA_HEIGHT / 2 + 20);
  ctx.restore();
}

// ─── Main Entry Point ───────────────────────────────────────────────

export function drawTurretGame(
  ctx: CanvasRenderingContext2D,
  state: GameState
): void {
  const ts = state.turretState;
  if (!ts) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, CANVAS_WIDTH, GAME_AREA_HEIGHT);
  ctx.clip();

  // Background
  drawStarField(ctx, state.frameCount);

  // Enemies
  drawEnemies(ctx, ts.enemies, state.frameCount);

  // Laser bolts
  drawBolts(ctx, ts);

  // Explosions + labels
  drawSpriteExplosions(ctx, state.explosions);
  drawFloatingLabels(ctx, state.floatingLabels);

  // Cockpit frame overlay
  drawCockpitFrame(ctx);

  // Crosshair
  drawCrosshair(ctx, ts, state.frameCount);

  // Ship HP
  drawShipHp(ctx, ts);

  // Wave info
  drawWaveInfo(ctx, ts, state.frameCount);

  // Damage flash
  if (state.screenShake > 3) {
    ctx.fillStyle = "rgba(255, 0, 0, 0.1)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, GAME_AREA_HEIGHT);
  }

  // Level complete
  if (state.levelCompleteTimer > 0) {
    drawCompleteBanner(ctx, state.levelCompleteTimer);
  }

  // Controls hint
  ctx.fillStyle = "#44668844";
  ctx.font = "9px monospace";
  ctx.textAlign = "center";
  ctx.fillText("← → ↑ ↓ AIM   Z/SHIFT FIRE", CANVAS_WIDTH / 2, GAME_AREA_HEIGHT - 6);

  ctx.restore();

  drawDashboard(ctx, state);
}

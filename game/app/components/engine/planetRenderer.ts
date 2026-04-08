import {
  CANVAS_WIDTH,
  GAME_AREA_HEIGHT,
  type ObjectiveState,
  type PlanetId,
  type EscortEntity,
  type DefendStructure,
  type Collectible,
} from "./types";
import type { HazardState } from "./hazards";
import type { ConsumableEffect } from "./consumables";
import { getObjectiveHudText, getObjectiveLabel } from "./objectives";
import { renderHazards } from "./hazards";
import { getSprite, SPRITES } from "./sprites";

// ─── Planet Background Colors ───────────────────────────────────────

interface PlanetPalette {
  bgGradient: [string, string];
  midColor: string;
  particleColor: string;
  particleCount: number;
}

const PALETTES: Record<PlanetId, PlanetPalette> = {
  verdania: {
    bgGradient: ["#0a1f0a", "#051505"],
    midColor: "rgba(30, 100, 40, 0.15)",
    particleColor: "#44cc66",
    particleCount: 25,
  },
  glaciem: {
    bgGradient: ["#0a1525", "#050a15"],
    midColor: "rgba(60, 120, 180, 0.12)",
    particleColor: "#aaddff",
    particleCount: 35,
  },
  pyraxis: {
    bgGradient: ["#1f0a05", "#150505"],
    midColor: "rgba(180, 60, 20, 0.15)",
    particleColor: "#ff8844",
    particleCount: 20,
  },
  ossuary: {
    bgGradient: ["#15120a", "#0a0905"],
    midColor: "rgba(100, 80, 50, 0.12)",
    particleColor: "#998866",
    particleCount: 15,
  },
  abyssia: {
    bgGradient: ["#050a20", "#020510"],
    midColor: "rgba(20, 60, 120, 0.15)",
    particleColor: "#44aaff",
    particleCount: 20,
  },
  ashfall: {
    bgGradient: ["#1f1508", "#150f05"],
    midColor: "rgba(150, 100, 40, 0.12)",
    particleColor: "#cc9944",
    particleCount: 30,
  },
  prismara: {
    bgGradient: ["#100520", "#080310"],
    midColor: "rgba(120, 50, 180, 0.15)",
    particleColor: "#cc88ff",
    particleCount: 25,
  },
  genesis: {
    bgGradient: ["#0f1f0a", "#081505"],
    midColor: "rgba(80, 150, 40, 0.12)",
    particleColor: "#aadd44",
    particleCount: 20,
  },
  luminos: {
    bgGradient: ["#0a0515", "#050210"],
    midColor: "rgba(180, 60, 255, 0.08)",
    particleColor: "#cc44ff",
    particleCount: 25,
  },
  bastion: {
    bgGradient: ["#1a0f08", "#0d0805"],
    midColor: "rgba(200, 100, 40, 0.10)",
    particleColor: "#ff8833",
    particleCount: 15,
  },
};

// ─── Particle State ─────────────────────────────────────────────────

interface BgParticle {
  x: number;
  y: number;
  size: number;
  speed: number;
  alpha: number;
  drift: number;
}

let particles: BgParticle[] = [];
let currentPlanetBg: PlanetId | null = null;

function initParticles(planetId: PlanetId): void {
  const palette = PALETTES[planetId];
  particles = [];
  for (let i = 0; i < palette.particleCount; i++) {
    particles.push({
      x: Math.random() * CANVAS_WIDTH,
      y: Math.random() * GAME_AREA_HEIGHT,
      size: 1 + Math.random() * 3,
      speed: 0.3 + Math.random() * 1.2,
      alpha: 0.2 + Math.random() * 0.6,
      drift: (Math.random() - 0.5) * 0.3,
    });
  }
}

// ─── Background Rendering ───────────────────────────────────────────

export function drawPlanetBackground(
  ctx: CanvasRenderingContext2D,
  planetId: PlanetId,
  frameCount: number
): void {
  if (currentPlanetBg !== planetId) {
    currentPlanetBg = planetId;
    initParticles(planetId);
  }

  const palette = PALETTES[planetId];

  // Try sprite-based backgrounds first
  const bgKeys = PALETTES[planetId] ? getBgSpriteKeys(planetId) : null;
  const farSprite = bgKeys ? getSprite(bgKeys[0]) : null;
  const midSprite = bgKeys ? getSprite(bgKeys[1]) : null;
  const nearSprite = bgKeys ? getSprite(bgKeys[2]) : null;

  if (farSprite) {
    // Sprite-based parallax (same as main campaign)
    const farY = (frameCount * 0.3) % farSprite.height;
    ctx.drawImage(farSprite, 0, farY - farSprite.height, CANVAS_WIDTH, GAME_AREA_HEIGHT);
    ctx.drawImage(farSprite, 0, farY, CANVAS_WIDTH, GAME_AREA_HEIGHT);
  } else {
    // Procedural fallback: gradient background
    const grd = ctx.createLinearGradient(0, 0, 0, GAME_AREA_HEIGHT);
    grd.addColorStop(0, palette.bgGradient[0]);
    grd.addColorStop(1, palette.bgGradient[1]);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, CANVAS_WIDTH, GAME_AREA_HEIGHT);
  }

  if (midSprite) {
    const midY = (frameCount * 0.6) % midSprite.height;
    ctx.globalAlpha = 0.5;
    ctx.drawImage(midSprite, 0, midY - midSprite.height, CANVAS_WIDTH, GAME_AREA_HEIGHT);
    ctx.drawImage(midSprite, 0, midY, CANVAS_WIDTH, GAME_AREA_HEIGHT);
    ctx.globalAlpha = 1;
  } else {
    // Procedural mid layer: subtle horizontal bands
    ctx.fillStyle = palette.midColor;
    for (let i = 0; i < 5; i++) {
      const y = ((frameCount * 0.5 + i * 160) % (GAME_AREA_HEIGHT + 80)) - 40;
      ctx.fillRect(0, y, CANVAS_WIDTH, 40);
    }
  }

  // Particles (always procedural, overlaid on sprites)
  ctx.fillStyle = palette.particleColor;
  for (const p of particles) {
    p.y += p.speed;
    p.x += p.drift + Math.sin(frameCount * 0.02 + p.y * 0.01) * 0.2;

    if (p.y > GAME_AREA_HEIGHT) {
      p.y = -p.size;
      p.x = Math.random() * CANVAS_WIDTH;
    }
    if (p.x < 0) p.x = CANVAS_WIDTH;
    if (p.x > CANVAS_WIDTH) p.x = 0;

    ctx.globalAlpha = p.alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function getBgSpriteKeys(planetId: PlanetId): [string, string, string] {
  const map: Record<PlanetId, [string, string, string]> = {
    verdania: [SPRITES.BG_VERDANIA_FAR, SPRITES.BG_VERDANIA_MID, SPRITES.BG_VERDANIA_NEAR],
    glaciem: [SPRITES.BG_GLACIEM_FAR, SPRITES.BG_GLACIEM_MID, SPRITES.BG_GLACIEM_NEAR],
    pyraxis: [SPRITES.BG_PYRAXIS_FAR, SPRITES.BG_PYRAXIS_MID, SPRITES.BG_PYRAXIS_NEAR],
    ossuary: [SPRITES.BG_OSSUARY_FAR, SPRITES.BG_OSSUARY_MID, SPRITES.BG_OSSUARY_NEAR],
    abyssia: [SPRITES.BG_ABYSSIA_FAR, SPRITES.BG_ABYSSIA_MID, SPRITES.BG_ABYSSIA_NEAR],
    ashfall: [SPRITES.BG_ASHFALL_FAR, SPRITES.BG_ASHFALL_MID, SPRITES.BG_ASHFALL_NEAR],
    prismara: [SPRITES.BG_PRISMARA_FAR, SPRITES.BG_PRISMARA_MID, SPRITES.BG_PRISMARA_NEAR],
    genesis: [SPRITES.BG_GENESIS_FAR, SPRITES.BG_GENESIS_MID, SPRITES.BG_GENESIS_NEAR],
    luminos: [SPRITES.BG_LUMINOS_FAR, SPRITES.BG_LUMINOS_MID, SPRITES.BG_LUMINOS_NEAR],
    bastion: [SPRITES.BG_BASTION_FAR, SPRITES.BG_BASTION_MID, SPRITES.BG_BASTION_NEAR],
  };
  return map[planetId];
}

// ─── Objective HUD ──────────────────────────────────────────────────

export function drawObjectiveHud(
  ctx: CanvasRenderingContext2D,
  objective: ObjectiveState,
  planetId: PlanetId,
  frameCount: number
): void {
  const palette = PALETTES[planetId];

  // Objective label + progress (top center)
  ctx.save();
  ctx.textAlign = "center";

  // Label background
  const label = getObjectiveLabel(objective.type);
  const text = getObjectiveHudText(objective);

  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(CANVAS_WIDTH / 2 - 90, 8, 180, 36);
  ctx.strokeStyle = palette.particleColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(CANVAS_WIDTH / 2 - 90, 8, 180, 36);

  // Label
  ctx.font = "bold 10px monospace";
  ctx.fillStyle = palette.particleColor;
  ctx.fillText(label, CANVAS_WIDTH / 2, 22);

  // Progress
  ctx.font = "bold 14px monospace";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, CANVAS_WIDTH / 2, 38);

  // Completion flash
  if (objective.completed) {
    const flash = Math.sin(frameCount * 0.15) * 0.3 + 0.7;
    ctx.font = "bold 20px monospace";
    ctx.fillStyle = `rgba(100, 255, 100, ${flash})`;
    ctx.fillText("OBJECTIVE COMPLETE", CANVAS_WIDTH / 2, GAME_AREA_HEIGHT / 2);
  }

  // Failure flash
  if (objective.failed) {
    const flash = Math.sin(frameCount * 0.15) * 0.3 + 0.7;
    ctx.font = "bold 20px monospace";
    ctx.fillStyle = `rgba(255, 80, 80, ${flash})`;
    ctx.fillText("MISSION FAILED", CANVAS_WIDTH / 2, GAME_AREA_HEIGHT / 2);
  }

  ctx.restore();
}

// ─── Entity Rendering ───────────────────────────────────────────────

export function drawEscortEntity(
  ctx: CanvasRenderingContext2D,
  escort: EscortEntity,
  frameCount: number
): void {
  const sprite = getSprite(SPRITES.ESCORT_SHIP);

  ctx.save();
  if (sprite) {
    ctx.drawImage(
      sprite,
      escort.x - escort.width / 2,
      escort.y - escort.height / 2,
      escort.width,
      escort.height
    );
  } else {
    // Fallback: simple triangle ship
    ctx.fillStyle = "#44ddff";
    ctx.beginPath();
    ctx.moveTo(escort.x, escort.y - escort.height / 2);
    ctx.lineTo(escort.x - escort.width / 2, escort.y + escort.height / 2);
    ctx.lineTo(escort.x + escort.width / 2, escort.y + escort.height / 2);
    ctx.closePath();
    ctx.fill();
  }

  // HP bar above escort
  const barWidth = 40;
  const barHeight = 4;
  const barX = escort.x - barWidth / 2;
  const barY = escort.y - escort.height / 2 - 10;
  const hpRatio = escort.hp / escort.maxHp;

  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
  ctx.fillStyle = hpRatio > 0.5 ? "#44ff88" : hpRatio > 0.25 ? "#ffaa44" : "#ff4444";
  ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);

  // Pulsing glow when damaged
  if (hpRatio < 0.5) {
    const glow = Math.sin(frameCount * 0.1) * 0.3 + 0.2;
    ctx.fillStyle = `rgba(255, 100, 50, ${glow})`;
    ctx.beginPath();
    ctx.arc(escort.x, escort.y, escort.width * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawDefendStructure(
  ctx: CanvasRenderingContext2D,
  structure: DefendStructure,
  frameCount: number
): void {
  const sprite = getSprite(SPRITES.DEFEND_STRUCTURE);
  const left = structure.x - structure.width / 2;
  const top = structure.y - structure.height / 2;

  ctx.save();
  if (sprite) {
    ctx.drawImage(sprite, left, top, structure.width, structure.height);
  } else {
    // Fallback: hexagonal structure
    ctx.fillStyle = "#334466";
    ctx.strokeStyle = "#44ccff";
    ctx.lineWidth = 2;
    const cx = structure.x;
    const cy = structure.y;
    const r = structure.width / 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      const px = cx + r * Math.cos(angle);
      const py = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner glow
    ctx.fillStyle = `rgba(68, 204, 255, ${0.2 + Math.sin(frameCount * 0.05) * 0.1})`;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // HP bar below structure
  const barWidth = 60;
  const barHeight = 5;
  const barX = structure.x - barWidth / 2;
  const barY = top + structure.height + 8;
  const hpRatio = structure.hp / structure.maxHp;

  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
  ctx.fillStyle = hpRatio > 0.5 ? "#44ff88" : hpRatio > 0.25 ? "#ffaa44" : "#ff4444";
  ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);

  // Damage pulsing
  if (hpRatio < 0.3) {
    const glow = Math.sin(frameCount * 0.12) * 0.3 + 0.2;
    ctx.fillStyle = `rgba(255, 60, 40, ${glow})`;
    ctx.beginPath();
    ctx.arc(structure.x, structure.y, structure.width * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawCollectibles(
  ctx: CanvasRenderingContext2D,
  collectibles: Collectible[],
  planetId: PlanetId,
  frameCount: number
): void {
  const palette = PALETTES[planetId];
  const sprite = getSprite(SPRITES.COLLECTIBLE_ORB);

  for (const c of collectibles) {
    const cx = c.x + c.width / 2;
    const cy = c.y + c.height / 2;
    const lifeRatio = c.lifetime / c.maxLifetime;

    ctx.save();

    if (sprite) {
      ctx.globalAlpha = lifeRatio < 0.3 ? lifeRatio / 0.3 : 1; // fade when expiring
      ctx.drawImage(sprite, c.x, c.y, c.width, c.height);
    } else {
      // Fallback: glowing orb
      const pulseSize = 1 + Math.sin(frameCount * 0.1 + c.id) * 0.2;
      const r = (c.width / 2) * pulseSize;

      // Outer glow
      ctx.globalAlpha = (lifeRatio < 0.3 ? lifeRatio / 0.3 : 1) * 0.4;
      ctx.fillStyle = palette.particleColor;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Inner orb
      ctx.globalAlpha = lifeRatio < 0.3 ? lifeRatio / 0.3 : 1;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

// ─── Consumable HUD ─────────────────────────────────────────────────

export function drawConsumableSlots(
  ctx: CanvasRenderingContext2D,
  equipped: { id: string; count: number; icon: string; color: string }[],
  activeEffects: ConsumableEffect[],
  frameCount: number
): void {
  // Draw in dashboard area (bottom-right of Row 2)
  const startX = CANVAS_WIDTH - 120;
  const y = GAME_AREA_HEIGHT + 50;

  ctx.save();
  ctx.font = "bold 10px monospace";
  ctx.textAlign = "center";

  for (let i = 0; i < 3; i++) {
    const x = startX + i * 36;
    const item = equipped[i];

    // Slot background
    ctx.fillStyle = item ? "rgba(20, 30, 50, 0.8)" : "rgba(10, 15, 25, 0.5)";
    ctx.beginPath();
    ctx.arc(x + 14, y + 14, 14, 0, Math.PI * 2);
    ctx.fill();

    // Slot border
    ctx.strokeStyle = item ? item.color : "rgba(60, 80, 100, 0.3)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (item) {
      // Check if this consumable has an active timed effect
      const active = activeEffects.find((e) => e.type === item.id);
      if (active) {
        // Duration arc
        const ratio = active.remainingFrames / active.totalFrames;
        ctx.strokeStyle = item.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x + 14, y + 14, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
        ctx.stroke();
      }

      // Icon
      ctx.fillStyle = item.color;
      ctx.fillText(item.icon, x + 14, y + 18);

      // Count badge
      if (item.count > 0) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(x + 20, y + 1, 12, 12);
        ctx.font = "bold 8px monospace";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(`${item.count}`, x + 26, y + 10);
        ctx.font = "bold 10px monospace";
      }

      // Key hint
      ctx.fillStyle = "rgba(150, 170, 190, 0.6)";
      ctx.font = "8px monospace";
      ctx.fillText(`${i + 1}`, x + 14, y + 32);
      ctx.font = "bold 10px monospace";
    } else {
      // Empty slot indicator
      ctx.fillStyle = "rgba(60, 80, 100, 0.3)";
      ctx.fillText("—", x + 14, y + 18);
    }
  }

  ctx.restore();
}

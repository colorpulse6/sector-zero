import type { Particle, SpriteExplosion } from "./types";
import { getSprite, SPRITES } from "./sprites";
import { drawGlow, drawPreparedFitted, drawStreak, preparedSprite } from "./fighterSprites";

export function createExplosion(
  x: number,
  y: number,
  count: number,
  color: string
): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const speed = 1 + Math.random() * 3;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 20 + Math.random() * 20,
      maxLife: 40,
      size: 1 + Math.random() * 3,
      color,
      type: "explosion",
    });
  }
  return particles;
}

export function createSparks(
  x: number,
  y: number,
  count: number,
  color: string
): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.5 + Math.random() * 2;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 10 + Math.random() * 15,
      maxLife: 25,
      size: 0.5 + Math.random() * 1.5,
      color,
      type: "spark",
    });
  }
  return particles;
}

export function createEngineTrail(
  x: number,
  y: number
): Particle {
  return {
    x: x + (Math.random() - 0.5) * 6,
    y,
    vx: (Math.random() - 0.5) * 0.3,
    vy: 1 + Math.random() * 2,
    life: 8 + Math.random() * 8,
    maxLife: 16,
    size: 1 + Math.random() * 2,
    color: "#44ccff",
    type: "trail",
  };
}

export function updateParticles(particles: Particle[]): Particle[] {
  return particles
    .map((p) => ({
      ...p,
      x: p.x + p.vx,
      y: p.y + p.vy,
      life: p.life - 1,
      vx: p.vx * 0.98,
      vy: p.vy * 0.98,
    }))
    .filter((p) => p.life > 0);
}

export function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[]
): void {
  if (particles.length === 0) return;
  ctx.save();
  // Additive light: overlapping embers and trails brighten instead of muddying.
  ctx.globalCompositeOperation = "lighter";
  for (const p of particles) {
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = 1;

    if (p.type === "explosion") {
      const r = p.size * (1 + (1 - alpha) * 1.5);
      drawGlow(ctx, p.x, p.y, r * 2.4, p.color, alpha * 0.85);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#fff4dc";
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.6, r * 0.5), 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === "trail") {
      drawGlow(ctx, p.x, p.y, 1.5 + p.size * 2.2 * alpha, p.color, alpha * 0.75);
    } else if (p.type === "smoke") {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = alpha * 0.5;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 + (1 - alpha)), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "lighter";
    } else {
      // Sparks: a hot pixel with a short streak back along its travel.
      drawStreak(ctx, p.x, p.y, p.vx, p.vy, 3 + Math.hypot(p.vx, p.vy) * 2.5, Math.max(1, p.size), p.color, alpha);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(p.x, p.y, Math.max(1, p.size * 0.8), Math.max(1, p.size * 0.8));
    }
  }
  ctx.restore();
}

// ─── Sprite Explosions ──────────────────────────────────────────────

const EXPLOSION_FRAMES = 7;

export function createSpriteExplosion(
  x: number,
  y: number,
  size: number = 64
): SpriteExplosion {
  return {
    x,
    y,
    size,
    frame: 0,
    totalFrames: EXPLOSION_FRAMES,
    frameTimer: 0,
    frameDelay: 4, // advance every 4 ticks (~15fps animation at 60fps game)
  };
}

export function updateSpriteExplosions(
  explosions: SpriteExplosion[]
): SpriteExplosion[] {
  return explosions
    .map((e) => ({
      ...e,
      frameTimer: e.frameTimer + 1,
      frame: e.frameTimer + 1 >= e.frameDelay
        ? e.frame + 1
        : e.frame,
      ...(e.frameTimer + 1 >= e.frameDelay ? { frameTimer: 0 } : {}),
    }))
    .filter((e) => e.frame < e.totalFrames);
}

/** Frames 0..FIRE_FRAMES-1 are the fireball (drawn additive); the rest is smoke. */
const FIRE_FRAMES = 3;

export function drawSpriteExplosions(
  ctx: CanvasRenderingContext2D,
  explosions: SpriteExplosion[]
): void {
  if (explosions.length === 0) return;
  const sheet = getSprite(SPRITES.EXPLOSION);
  if (!sheet) return;

  for (const e of explosions) {
    const frame = Math.max(0, Math.min(e.totalFrames - 1, e.frame));
    const progress = frame / e.totalFrames;
    const isFire = frame < FIRE_FRAMES;
    // The blast grows a little as it burns out; smoke thins away.
    const size = e.size * (1 + progress * 0.3);
    const alpha = isFire ? 1 : Math.max(0.25, 1 - (frame - FIRE_FRAMES + 1) / (e.totalFrames - FIRE_FRAMES + 1));

    ctx.save();
    if (isFire) {
      // Flash and shock ring are additive; the fireball art itself is composited
      // normally so it keeps its colour over bright plates (ice, lava).
      ctx.globalCompositeOperation = "lighter";
      drawGlow(ctx, e.x, e.y, size * (0.9 - frame * 0.2), "#ffd9a0", 0.6 - frame * 0.2);
      const ring = size * (0.25 + progress * 1.6);
      ctx.globalAlpha = 0.4 * (1 - frame / FIRE_FRAMES);
      ctx.strokeStyle = "#ffc078";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, ring, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    } else {
      ctx.globalAlpha = alpha;
    }

    const cell = preparedSprite(SPRITES.EXPLOSION, frame, EXPLOSION_FRAMES, undefined, 0, 160);
    if (cell) {
      drawPreparedFitted(ctx, cell, e.x, e.y, size, size);
    } else {
      // Sheet decoded but not yet sliced (first frame): equal-column crop.
      const frameW = sheet.width / EXPLOSION_FRAMES;
      const cropTop = Math.floor(sheet.height * 0.2);
      const cropH = Math.floor(sheet.height * 0.6);
      ctx.drawImage(sheet, frame * frameW, cropTop, frameW, cropH, e.x - size / 2, e.y - size / 2, size, size);
    }
    ctx.restore();
  }
}

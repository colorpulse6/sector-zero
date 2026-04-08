import type { Particle, SpriteExplosion } from "./types";
import { getSprite, SPRITES } from "./sprites";

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
  for (const p of particles) {
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;

    if (p.type === "explosion") {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 + (1 - alpha) * 1.5), 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === "trail") {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
  }
  ctx.globalAlpha = 1;
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

export function drawSpriteExplosions(
  ctx: CanvasRenderingContext2D,
  explosions: SpriteExplosion[]
): void {
  const sheet = getSprite(SPRITES.EXPLOSION);
  if (!sheet) return;

  const frameW = sheet.width / EXPLOSION_FRAMES;
  const frameH = sheet.height;
  // Crop vertically to content (similar to player ship — content is in center ~60%)
  const cropTop = Math.floor(frameH * 0.2);
  const cropH = Math.floor(frameH * 0.6);

  for (const e of explosions) {
    const sx = e.frame * frameW;
    const drawX = e.x - e.size / 2;
    const drawY = e.y - e.size / 2;
    ctx.drawImage(sheet, sx, cropTop, frameW, cropH, drawX, drawY, e.size, e.size);
  }
}

import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  type Star,
  type BackgroundLayer,
  type PlanetId,
} from "./types";
import { getSprite, SPRITES } from "./sprites";
import { getPlanetDef } from "./planets";

// ─── World-themed background sprite keys ────────────────────────────
const WORLD_BG_SPRITES: Record<number, { far: string; mid: string; near: string }> = {
  1: { far: SPRITES.BG_AURELIA_FAR, mid: SPRITES.BG_AURELIA_MID, near: SPRITES.BG_AURELIA_NEAR },
  2: { far: SPRITES.BG_CRYON_FAR, mid: SPRITES.BG_CRYON_MID, near: SPRITES.BG_CRYON_NEAR },
  3: { far: SPRITES.BG_IGNIS_FAR, mid: SPRITES.BG_IGNIS_MID, near: SPRITES.BG_IGNIS_NEAR },
  4: { far: SPRITES.BG_GRAVEYARD_FAR, mid: SPRITES.BG_GRAVEYARD_MID, near: SPRITES.BG_GRAVEYARD_NEAR },
  5: { far: SPRITES.BG_VOID_FAR, mid: SPRITES.BG_VOID_MID, near: SPRITES.BG_VOID_NEAR },
  6: { far: SPRITES.BG_SCAR_FAR, mid: SPRITES.BG_SCAR_MID, near: SPRITES.BG_SCAR_NEAR },
  7: { far: SPRITES.BG_FOLD_FAR, mid: SPRITES.BG_FOLD_MID, near: SPRITES.BG_FOLD_NEAR },
  8: { far: SPRITES.BG_HOLLOW_FAR, mid: SPRITES.BG_HOLLOW_MID, near: SPRITES.BG_HOLLOW_NEAR },
};

// Procedural fallback colors per world (also the tint of the live star overlay)
const WORLD_FALLBACK: Record<number, { bg: string; starColor: string; starCount: number }> = {
  1: { bg: "#000008", starColor: "255, 255, 255", starCount: 1 },   // dark blue-black
  2: { bg: "#000818", starColor: "180, 220, 255", starCount: 1 },   // deep blue + icy stars
  3: { bg: "#0a0200", starColor: "255, 160, 80", starCount: 1 },    // dark red-orange
  4: { bg: "#050608", starColor: "140, 160, 180", starCount: 0.5 }, // cold grey debris field
  5: { bg: "#000000", starColor: "140, 100, 200", starCount: 0.4 }, // pure black, sparse purple
  6: { bg: "#080200", starColor: "255, 120, 60", starCount: 0.7 },  // distorted orange-red
  7: { bg: "#000410", starColor: "100, 140, 255", starCount: 0.8 }, // temporal blue shimmer
  8: { bg: "#020804", starColor: "100, 220, 140", starCount: 0.6 }, // dark green
};

export function createBackground(): BackgroundLayer[] {
  return [
    {
      stars: createStarField(80, 0.3, 0.8, 0.3),
      scrollY: 0,
      speed: 0.3,
    },
    {
      stars: createStarField(40, 0.8, 1.5, 0.6),
      scrollY: 0,
      speed: 0.8,
    },
    {
      stars: createStarField(15, 1.5, 2.5, 1.0),
      scrollY: 0,
      speed: 1.5,
    },
  ];
}

function createStarField(
  count: number,
  minSize: number,
  maxSize: number,
  brightness: number
): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * CANVAS_WIDTH,
      y: Math.random() * CANVAS_HEIGHT,
      size: minSize + Math.random() * (maxSize - minSize),
      speed: 0.5 + Math.random() * 1.5,
      brightness: brightness * (0.5 + Math.random() * 0.5),
    });
  }
  return stars;
}

export function updateBackground(layers: BackgroundLayer[]): BackgroundLayer[] {
  return layers.map((layer) => {
    const newStars = layer.stars.map((star) => {
      let y = star.y + star.speed * layer.speed;
      if (y > CANVAS_HEIGHT) {
        y = -star.size;
        return {
          ...star,
          y,
          x: Math.random() * CANVAS_WIDTH,
        };
      }
      return { ...star, y };
    });

    return {
      ...layer,
      stars: newStars,
      scrollY: layer.scrollY + layer.speed,
    };
  });
}

// ─── Parallax plates ────────────────────────────────────────────────
//
// Every world ships one 1024×1536 plate per depth. Drawn at canvas width all
// three had the same 720px tile period, the mid/near asteroid plates were
// ghosted to 15% / 8% (reading as grey haze over the stars) and nothing else
// moved, so the loop was obvious within a screen height. Now:
//  • far: opaque star plate, mirror-tiled (seamless) at the slow layer speed;
//  • mid/near: scaled up (bigger rocks read as nearer, and the periods 864px /
//    1044px never line up with the far 720px), drawn at honest opacity with a
//    slow horizontal sway so the same rock never crosses at the same x;
//  • the live star field on top (three speeds; the fastest draws as streaks)
//    so there is always fine-grained motion between the big shapes.
// Plates are cached at draw size: a 1:1 blit per tile instead of scaling the
// source every frame.

interface DepthLayerSpec {
  scale: number;
  alpha: number;
  /** Shadow pulled over the plate once at cache time so light dust and ice read
   *  as bodies in deep space, not as fog over the stars (0 = untouched art). */
  shade: number;
  swayAmp: number;
  swayRate: number;
  speedMul: number;
}

const DEPTH_LAYERS: { mid: DepthLayerSpec; near: DepthLayerSpec } = {
  mid: { scale: 1.2, alpha: 0.34, shade: 0.45, swayAmp: 22, swayRate: 0.0021, speedMul: 2 },
  near: { scale: 1.45, alpha: 0.46, shade: 0.35, swayAmp: 34, swayRate: 0.0013, speedMul: 3 },
};

const PLATE_CACHE_LIMIT = 6;
const plateCache = new Map<string, HTMLCanvasElement>();
const brightnessCache = new Map<HTMLImageElement, number>();

/** Mean luma (0..1) of the plate's visible pixels, alpha-weighted, from a 64px thumbnail. */
function plateBrightness(img: HTMLImageElement): number {
  const cached = brightnessCache.get(img);
  if (cached !== undefined) return cached;
  let result = 0;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 96;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (ctx) {
    ctx.drawImage(img, 0, 0, 64, 96);
    try {
      const data = ctx.getImageData(0, 0, 64, 96).data;
      let sum = 0;
      let weight = 0;
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3] / 255;
        sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) * a;
        weight += a;
      }
      result = weight > 0 ? sum / weight / 255 : 0;
    } catch {
      result = 0;
    }
  }
  brightnessCache.set(img, result);
  return result;
}

function platePlan(img: HTMLImageElement, scale: number): { w: number; h: number } {
  const w = Math.round(CANVAS_WIDTH * scale);
  const h = Math.round(img.height * (w / img.width));
  return { w, h };
}

function getPlate(path: string, img: HTMLImageElement, scale: number, shade = 0): HTMLCanvasElement | HTMLImageElement {
  if (typeof document === "undefined" || img.width === 0) return img;
  const { w, h } = platePlan(img, scale);
  const key = `${path}|${w}|${shade}`;
  const cached = plateCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return img;
  ctx.drawImage(img, 0, 0, w, h);
  if (shade > 0) {
    // Bright plates (Cryon ice, Genesis bloom) get extra shade so every world
    // sits in the same dark-space value range and enemies stay readable.
    const extra = plateBrightness(img) > 0.45 ? Math.min(0.3, (plateBrightness(img) - 0.45) * 1.2) : 0;
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = `rgba(2, 4, 12, ${Math.min(0.8, shade + extra)})`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
  }
  if (plateCache.size >= PLATE_CACHE_LIMIT) {
    const oldest = plateCache.keys().next().value;
    if (oldest !== undefined) plateCache.delete(oldest);
  }
  plateCache.set(key, canvas);
  return canvas;
}

export interface TilePlacement {
  screenY: number;
  flipped: boolean;
}

/** Mirror-tile placements covering [0, viewH) for a tile of `tileH` scrolled by
 *  `scrollY`. Every other tile is vertically flipped so each seam meets its own
 *  mirror image — seamless for any art. Pure, so the layout is unit-testable. */
export function planMirrorTiles(scrollY: number, tileH: number, viewH: number): TilePlacement[] {
  const firstTile = Math.floor(scrollY / tileH);
  const yOffset = scrollY - firstTile * tileH;
  const placements: TilePlacement[] = [];
  const tilesNeeded = Math.ceil(viewH / tileH) + 1;
  for (let i = -1; i < tilesNeeded; i++) {
    const tileNum = firstTile + i;
    const screenY = i * tileH - yOffset;
    if (screenY >= viewH || screenY + tileH <= 0) continue;
    placements.push({ screenY, flipped: ((tileNum % 2) + 2) % 2 === 1 });
  }
  return placements;
}

/** Tile period in canvas pixels for a plate drawn at `scale` of canvas width. */
export function plateTilePeriod(imageW: number, imageH: number, scale: number): number {
  const w = Math.round(CANVAS_WIDTH * scale);
  return Math.round(imageH * (w / imageW));
}

function drawPlateTiles(
  ctx: CanvasRenderingContext2D,
  plate: HTMLCanvasElement | HTMLImageElement,
  drawW: number,
  drawH: number,
  scrollY: number,
  x: number,
  alpha: number,
): void {
  ctx.globalAlpha = alpha;
  for (const { screenY, flipped } of planMirrorTiles(scrollY, drawH, CANVAS_HEIGHT)) {
    if (flipped) {
      ctx.save();
      ctx.translate(0, screenY + drawH);
      ctx.scale(1, -1);
      ctx.drawImage(plate, x, 0, drawW, drawH);
      ctx.restore();
    } else {
      ctx.drawImage(plate, x, screenY, drawW, drawH);
    }
  }
  ctx.globalAlpha = 1;
}

function drawDepthLayer(
  ctx: CanvasRenderingContext2D,
  path: string,
  scrollY: number,
  spec: DepthLayerSpec,
): void {
  const img = getSprite(path);
  if (!img || img.width === 0) return;
  const plate = getPlate(path, img, spec.scale, spec.shade);
  const { w, h } = platePlan(img, spec.scale);
  const sway = Math.sin(scrollY * spec.swayRate) * spec.swayAmp;
  const x = -(w - CANVAS_WIDTH) / 2 + sway;
  drawPlateTiles(ctx, plate, w, h, scrollY * spec.speedMul, x, spec.alpha);
}

function drawStarField(
  ctx: CanvasRenderingContext2D,
  layers: BackgroundLayer[],
  starColor: string,
  density: number,
): void {
  layers.forEach((layer, depth) => {
    const clock = layer.scrollY;
    const stars = layer.stars;
    const count = Math.floor(stars.length * density);
    for (let i = 0; i < count; i++) {
      const star = stars[i];
      // Twinkle from a per-star phase; scrollY is the clock so pausing freezes it.
      const twinkle = 0.7 + 0.3 * Math.sin(star.x * 0.37 + clock * 0.06 * star.speed);
      const alpha = Math.min(1, star.brightness * twinkle * (depth === 0 ? 0.9 : 1));
      ctx.fillStyle = `rgba(${starColor}, ${alpha.toFixed(3)})`;
      if (depth === 2) {
        // Nearest layer streaks with the scroll — the "we are moving fast" cue.
        const len = 3 + star.speed * layer.speed * 2.2;
        ctx.fillRect(star.x - star.size * 0.35, star.y - len, star.size * 0.7, len);
      } else if (star.size > 1.1) {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size * 0.55, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(star.x, star.y, 1, 1);
      }
    }
  });
}

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  layers: BackgroundLayer[],
  currentWorld: number = 1,
  planetId?: PlanetId
): void {
  // Planet missions use their own background sprites
  let sprites = WORLD_BG_SPRITES[currentWorld] || WORLD_BG_SPRITES[1];
  if (planetId) {
    const planet = getPlanetDef(planetId);
    const [farKey, midKey, nearKey] = planet.bgKeys;
    const farPath = SPRITES[farKey as keyof typeof SPRITES];
    const midPath = SPRITES[midKey as keyof typeof SPRITES];
    const nearPath = SPRITES[nearKey as keyof typeof SPRITES];
    if (farPath) {
      sprites = { far: farPath, mid: midPath, near: nearPath };
    }
  }
  const palette = WORLD_FALLBACK[currentWorld] || WORLD_FALLBACK[1];
  const farImg = getSprite(sprites.far);

  if (farImg && farImg.width > 0) {
    const farPlate = getPlate(sprites.far, farImg, 1);
    const { w, h } = platePlan(farImg, 1);
    drawPlateTiles(ctx, farPlate, w, h, layers[0].scrollY, 0, 1);
    drawStarField(ctx, layers, palette.starColor, 0.75);
    drawDepthLayer(ctx, sprites.mid, layers[1].scrollY, DEPTH_LAYERS.mid);
    drawDepthLayer(ctx, sprites.near, layers[2].scrollY, DEPTH_LAYERS.near);
  } else {
    // Procedural fallback with world-themed colors
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawStarField(ctx, layers, palette.starColor, palette.starCount);
  }
}

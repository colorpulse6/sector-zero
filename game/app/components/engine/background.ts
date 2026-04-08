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

// Procedural fallback colors per world
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

function drawTiledImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  scrollY: number,
  alpha: number
): void {
  const scale = CANVAS_WIDTH / img.width;
  const drawH = img.height * scale;

  // Mirror-tile: every other copy is vertically flipped so edges always match
  const firstTile = Math.floor(scrollY / drawH);
  const yOffset = scrollY - firstTile * drawH;

  ctx.globalAlpha = alpha;

  const tilesNeeded = Math.ceil(CANVAS_HEIGHT / drawH) + 2;
  for (let i = -1; i < tilesNeeded; i++) {
    const tileNum = firstTile + i;
    const screenY = i * drawH - yOffset;
    const isFlipped = ((tileNum % 2) + 2) % 2 === 1;

    if (isFlipped) {
      ctx.save();
      ctx.translate(0, screenY + drawH);
      ctx.scale(1, -1);
      ctx.drawImage(img, 0, 0, CANVAS_WIDTH, drawH);
      ctx.restore();
    } else {
      ctx.drawImage(img, 0, screenY, CANVAS_WIDTH, drawH);
    }
  }

  ctx.globalAlpha = 1;
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
  const farImg = getSprite(sprites.far);

  if (farImg) {
    drawTiledImage(ctx, farImg, layers[0].scrollY, 1);

    const midImg = getSprite(sprites.mid);
    if (midImg) {
      drawTiledImage(ctx, midImg, layers[1].scrollY * 2, 0.15);
    }

    const nearImg = getSprite(sprites.near);
    if (nearImg) {
      drawTiledImage(ctx, nearImg, layers[2].scrollY * 3, 0.08);
    }
  } else {
    // Procedural fallback with world-themed colors
    const fallback = WORLD_FALLBACK[currentWorld] || WORLD_FALLBACK[1];
    ctx.fillStyle = fallback.bg;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    for (const layer of layers) {
      for (const star of layer.stars) {
        if (Math.random() > fallback.starCount) continue;
        const alpha = star.brightness * (0.6 + 0.4 * Math.sin(star.y * 0.02));
        ctx.fillStyle = `rgba(${fallback.starColor}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

/**
 * Procedural paint for the System Atlas: planet surfaces and the ecliptic dust disc. Pure
 * Canvas 2D drawing on a context the caller supplies, seeded so a planet always looks the same.
 * Nothing here touches Babylon, `window` or `document`.
 */
import type { PlanetBiome } from "../../colony/shared/colonyTypes";
import type { Random } from "../sector/sectorArt";

type Rgb = readonly [number, number, number];

/** The biome palette fields a surface needs (see `BIOME_PALETTES`). */
export interface SurfacePalette {
  deep: string;
  contour: string;
  ridge: string;
}

function hexRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.replace("#", "").slice(0, 6), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function mix(left: Rgb, right: Rgb, amount: number): Rgb {
  return [
    Math.round(left[0] + (right[0] - left[0]) * amount),
    Math.round(left[1] + (right[1] - left[1]) * amount),
    Math.round(left[2] + (right[2] - left[2]) * amount),
  ];
}

function rgba(color: Rgb, alpha: number): string {
  return `rgba(${color[0]},${color[1]},${color[2]},${alpha.toFixed(4)})`;
}

/** Soft blot, drawn twice across the seam so the equirectangular texture wraps cleanly. */
function blot(context: CanvasRenderingContext2D, width: number, x: number, y: number, radius: number, color: Rgb, alpha: number) {
  for (const offset of [0, x < width / 2 ? width : -width]) {
    const cx = x + offset;
    const gradient = context.createRadialGradient(cx, y, 0, cx, y, radius);
    gradient.addColorStop(0, rgba(color, alpha));
    gradient.addColorStop(0.6, rgba(color, alpha * 0.5));
    gradient.addColorStop(1, rgba(color, 0));
    context.fillStyle = gradient;
    context.fillRect(cx - radius, y - radius, radius * 2, radius * 2);
  }
}

/** Latitude bands: a few sine waves per row give an uneven, natural stripe pattern. */
function bands(context: CanvasRenderingContext2D, width: number, height: number, random: Random, light: Rgb, dark: Rgb, alpha: number) {
  const waves = Array.from({ length: 3 }, () => ({ frequency: 2 + random() * 9, phase: random() * Math.PI * 2, weight: 0.3 + random() * 0.7 }));
  for (let y = 0; y < height; y += 2) {
    const latitude = y / height;
    let value = 0;
    for (const wave of waves) value += Math.sin(latitude * wave.frequency * Math.PI + wave.phase) * wave.weight;
    const amount = 0.5 + value / 4;
    context.fillStyle = rgba(mix(dark, light, Math.min(1, Math.max(0, amount))), alpha);
    context.fillRect(0, y, width, 2);
  }
}

/**
 * Equirectangular surface for one planet, painted from its biome palette: a base tone, latitude
 * bands, blotches, and a biome detail (ice caps, land masses, lava cracks, city lights, craters,
 * cloud streaks). The texture wraps horizontally.
 */
export function paintPlanetSurface(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  random: Random,
  biome: PlanetBiome,
  palette: SurfacePalette,
) {
  const ridge = hexRgb(palette.ridge);
  const contour = hexRgb(palette.contour);
  const deep = hexRgb(palette.deep);
  const light = mix(contour, ridge, 0.55);
  const dark = mix(contour, deep, 0.45);
  const base = biome === "volcanic" || biome === "urban" ? mix(deep, contour, 0.35) : mix(dark, light, 0.5);

  context.globalCompositeOperation = "source-over";
  context.fillStyle = rgba(base, 1);
  context.fillRect(0, 0, width, height);
  bands(context, width, height, random, light, dark, biome === "volcanic" || biome === "urban" ? 0.18 : 0.42);

  const blots = biome === "ocean" ? 0 : 60;
  for (let index = 0; index < blots; index += 1) {
    const tone = random() < 0.5 ? dark : light;
    blot(context, width, random() * width, random() * height, 4 + random() * height * 0.16, tone, 0.18 + random() * 0.22);
  }

  if (biome === "ocean") {
    // Land masses on the water, then thin cloud.
    const land = mix(hexRgb("#8a8a5e"), contour, 0.35);
    for (let continent = 0; continent < 5; continent += 1) {
      const cx = random() * width;
      const cy = height * (0.2 + random() * 0.6);
      for (let index = 0; index < 22; index += 1) {
        blot(context, width, cx + (random() - 0.5) * width * 0.16, cy + (random() - 0.5) * height * 0.22, 3 + random() * 9, land, 0.5);
      }
    }
  }
  if (biome === "ice" || biome === "ocean" || biome === "jungle") {
    // Polar caps.
    const cap = biome === "ice" ? 0.24 : 0.12;
    for (const top of [true, false]) {
      const gradient = context.createLinearGradient(0, top ? 0 : height, 0, top ? height * cap : height * (1 - cap));
      gradient.addColorStop(0, "rgba(240,248,255,0.92)");
      gradient.addColorStop(1, "rgba(240,248,255,0)");
      context.fillStyle = gradient;
      context.fillRect(0, top ? 0 : height * (1 - cap), width, height * cap);
    }
  }
  if (biome === "volcanic") {
    // Glowing fissures: short random walks in the ridge colour.
    context.globalCompositeOperation = "lighter";
    context.lineCap = "round";
    for (let crack = 0; crack < 16; crack += 1) {
      let x = random() * width;
      let y = height * (0.15 + random() * 0.7);
      let heading = random() * Math.PI * 2;
      context.strokeStyle = rgba(ridge, 0.35 + random() * 0.35);
      context.lineWidth = 0.6 + random() * 1.2;
      context.beginPath();
      context.moveTo(x, y);
      for (let step = 0; step < 14; step += 1) {
        heading += (random() - 0.5) * 1.1;
        x += Math.cos(heading) * 4;
        y += Math.sin(heading) * 2.4;
        context.lineTo(x, y);
      }
      context.stroke();
    }
    context.globalCompositeOperation = "source-over";
  }
  if (biome === "urban") {
    // City lights: clustered warm and cool points.
    context.globalCompositeOperation = "lighter";
    for (let cluster = 0; cluster < 14; cluster += 1) {
      const cx = random() * width;
      const cy = height * (0.18 + random() * 0.64);
      for (let index = 0; index < 30; index += 1) {
        const tint = random() < 0.6 ? ridge : hexRgb("#ffd59a");
        context.fillStyle = rgba(tint, 0.3 + random() * 0.5);
        context.fillRect(cx + (random() - 0.5) * 26, cy + (random() - 0.5) * 12, 1, 1);
      }
    }
    context.globalCompositeOperation = "source-over";
  }
  if (biome === "barren" || biome === "desert") {
    // Craters: a dark bowl with a lit rim.
    const craters = biome === "barren" ? 26 : 10;
    for (let index = 0; index < craters; index += 1) {
      const x = random() * width;
      const y = height * (0.1 + random() * 0.8);
      const radius = 1.5 + random() * 6;
      context.fillStyle = rgba(dark, 0.55);
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = rgba(light, 0.4);
      context.lineWidth = 0.7;
      context.beginPath();
      context.arc(x - radius * 0.15, y - radius * 0.15, radius, Math.PI * 0.9, Math.PI * 1.8);
      context.stroke();
    }
  }
  if (biome === "jungle" || biome === "ocean" || biome === "toxic") {
    // Cloud streaks.
    const cloud: Rgb = biome === "toxic" ? mix(ridge, [255, 255, 220], 0.4) : [245, 248, 255];
    for (let index = 0; index < 34; index += 1) {
      const y = random() * height;
      const x = random() * width;
      const length = 18 + random() * 60;
      context.fillStyle = rgba(cloud, 0.08 + random() * 0.14);
      context.fillRect(x, y, length, 1 + random() * 2.5);
      if (x + length > width) context.fillRect(x - width, y, length, 1 + random() * 2.5);
    }
  }
}

/** Faint dust disc on the ecliptic: an uneven annulus around the star, transparent elsewhere. */
export function paintEclipticDust(context: CanvasRenderingContext2D, size: number, random: Random) {
  const half = size / 2;
  context.clearRect(0, 0, size, size);
  context.globalCompositeOperation = "lighter";
  const disc = context.createRadialGradient(half, half, size * 0.04, half, half, half);
  disc.addColorStop(0, "rgba(255,226,170,0.16)");
  disc.addColorStop(0.18, "rgba(150,140,170,0.10)");
  disc.addColorStop(0.55, "rgba(90,110,150,0.07)");
  disc.addColorStop(1, "rgba(40,50,80,0)");
  context.fillStyle = disc;
  context.fillRect(0, 0, size, size);
  const tints: Rgb[] = [[120, 140, 190], [170, 140, 120], [140, 120, 180]];
  for (let index = 0; index < 520; index += 1) {
    const angle = random() * Math.PI * 2;
    const radius = half * (0.12 + Math.sqrt(random()) * 0.8);
    const x = half + Math.cos(angle) * radius;
    const y = half + Math.sin(angle) * radius;
    const r = size * (0.006 + random() * 0.03);
    const gradient = context.createRadialGradient(x, y, 0, x, y, r);
    const tint = tints[Math.floor(random() * tints.length)];
    gradient.addColorStop(0, rgba(tint, 0.05 + random() * 0.06));
    gradient.addColorStop(1, rgba(tint, 0));
    context.fillStyle = gradient;
    context.fillRect(x - r, y - r, r * 2, r * 2);
  }
  context.globalCompositeOperation = "source-over";
}

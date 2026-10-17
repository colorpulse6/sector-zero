/**
 * Procedural paint for the Galaxy Atlas sector field: sky, dust plane, nebula layers and the
 * glow and flare sprites. Pure Canvas 2D drawing on a context the caller supplies, seeded so
 * every session paints the same sky. Nothing here touches Babylon, `window` or `document`.
 */

export type Random = () => number;

/** mulberry32: small, fast, good enough for decoration. */
export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Approximate standard normal from three uniforms; plenty for scattering splats. */
function gaussian(random: Random): number {
  return (random() + random() + random() - 1.5) * 1.15;
}

type Rgb = readonly [number, number, number];

export interface NebulaPalette {
  /** Bright gas colours, mixed per splat. */
  gas: readonly Rgb[];
  /** Hot core highlight. */
  core: Rgb;
}

export const NEBULA_PALETTES: readonly NebulaPalette[] = Object.freeze([
  { gas: [[120, 70, 190], [175, 80, 160], [80, 60, 170]], core: [235, 170, 230] },
  { gas: [[40, 140, 170], [60, 110, 190], [30, 170, 150]], core: [170, 240, 235] },
  { gas: [[200, 110, 60], [190, 70, 80], [160, 90, 140]], core: [255, 210, 160] },
  { gas: [[70, 90, 200], [130, 70, 190], [40, 140, 180]], core: [200, 210, 255] },
]);

const STAR_TINTS: readonly Rgb[] = [
  [255, 255, 255],
  [205, 220, 255],
  [255, 242, 220],
  [255, 214, 170],
  [175, 195, 255],
];

function rgba(color: Rgb, alpha: number): string {
  return `rgba(${color[0]},${color[1]},${color[2]},${alpha.toFixed(4)})`;
}

function mix(left: Rgb, right: Rgb, amount: number): Rgb {
  return [
    Math.round(left[0] + (right[0] - left[0]) * amount),
    Math.round(left[1] + (right[1] - left[1]) * amount),
    Math.round(left[2] + (right[2] - left[2]) * amount),
  ];
}

function splat(context: CanvasRenderingContext2D, x: number, y: number, radius: number, color: Rgb, alpha: number) {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, rgba(color, alpha));
  gradient.addColorStop(0.45, rgba(color, alpha * 0.45));
  gradient.addColorStop(1, rgba(color, 0));
  context.fillStyle = gradient;
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

/** Fades the painted alpha to nothing towards the edge so planes never show a border. */
function featherEdges(context: CanvasRenderingContext2D, size: number, inner: number) {
  context.globalCompositeOperation = "destination-in";
  const gradient = context.createRadialGradient(size / 2, size / 2, size * inner, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(0,0,0,1)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  context.globalCompositeOperation = "source-over";
}

/** Equirectangular deep-space sky: dark gradient, a faint galactic band and a few thousand stars. */
export function paintSky(context: CanvasRenderingContext2D, width: number, height: number, random: Random) {
  const base = context.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, "#010207");
  base.addColorStop(0.42, "#050815");
  base.addColorStop(0.5, "#08091a");
  base.addColorStop(0.58, "#050815");
  base.addColorStop(1, "#010207");
  context.fillStyle = base;
  context.fillRect(0, 0, width, height);

  const band = (x: number) => height * 0.5 + Math.sin((x / width) * Math.PI * 2 + 0.6) * height * 0.11;

  context.globalCompositeOperation = "lighter";
  for (let index = 0; index < 520; index += 1) {
    const x = random() * width;
    const y = band(x) + gaussian(random) * height * 0.055;
    const warm = random() < 0.35;
    const color: Rgb = warm ? [150, 110, 85] : [80, 100, 150];
    splat(context, x, y, 24 + random() * 80, color, 0.03 + random() * 0.035);
  }
  context.globalCompositeOperation = "source-over";
  for (let index = 0; index < 170; index += 1) {
    const x = random() * width;
    const y = band(x) + gaussian(random) * height * 0.02;
    splat(context, x, y, 12 + random() * 40, [2, 3, 8], 0.22 + random() * 0.2);
  }

  context.globalCompositeOperation = "lighter";
  for (let index = 0; index < 3400; index += 1) {
    const x = random() * width;
    const nearBand = random() < 0.55;
    const y = nearBand ? band(x) + gaussian(random) * height * 0.12 : random() * height;
    const tint = STAR_TINTS[Math.floor(random() * STAR_TINTS.length)];
    const bright = random();
    if (bright > 0.985) {
      splat(context, x, y, 3 + random() * 4, tint, 0.55);
      context.fillStyle = rgba(tint, 0.95);
      context.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
    } else {
      const size = bright > 0.85 ? 1.3 : 0.9;
      context.fillStyle = rgba(tint, 0.2 + bright * 0.6);
      context.fillRect(x, y, size, size);
    }
  }
  context.globalCompositeOperation = "source-over";
}

/** Patchy interstellar dust lying on the galactic plane, transparent where empty. */
export function paintDustField(context: CanvasRenderingContext2D, size: number, random: Random) {
  context.clearRect(0, 0, size, size);
  context.globalCompositeOperation = "lighter";
  const glow = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.5);
  glow.addColorStop(0, "rgba(40,70,100,0.30)");
  glow.addColorStop(0.6, "rgba(30,50,80,0.16)");
  glow.addColorStop(1, "rgba(20,30,60,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, size, size);

  const teal: Rgb = [70, 140, 165];
  const violet: Rgb = [115, 90, 175];
  const warm: Rgb = [170, 120, 95];
  for (let walk = 0; walk < 7; walk += 1) {
    let x = size * (0.15 + random() * 0.7);
    let y = size * (0.15 + random() * 0.7);
    let heading = random() * Math.PI * 2;
    const colour = mix(walk % 3 === 0 ? warm : teal, violet, random());
    for (let step = 0; step < 140; step += 1) {
      heading += gaussian(random) * 0.22;
      x += Math.cos(heading) * size * 0.006;
      y += Math.sin(heading) * size * 0.006;
      splat(context, x, y, size * (0.012 + random() * 0.04), colour, 0.035 + random() * 0.045);
    }
  }
  for (let index = 0; index < 420; index += 1) {
    const colour = mix(teal, violet, random());
    splat(context, random() * size, random() * size, size * (0.01 + random() * 0.05), colour, 0.02 + random() * 0.03);
  }

  context.globalCompositeOperation = "destination-out";
  for (let index = 0; index < 90; index += 1) {
    splat(context, random() * size, random() * size, size * (0.01 + random() * 0.035), [0, 0, 0], 0.35 + random() * 0.3);
  }
  context.globalCompositeOperation = "source-over";
  featherEdges(context, size, 0.3);
}

/** One soft nebula cloud: clustered gas splats, a hot core and dark lanes, feathered edges. */
export function paintNebula(context: CanvasRenderingContext2D, size: number, random: Random, palette: NebulaPalette) {
  context.clearRect(0, 0, size, size);
  context.globalCompositeOperation = "lighter";
  const clusters = Array.from({ length: 5 }, () => ({
    x: size * (0.3 + random() * 0.4),
    y: size * (0.3 + random() * 0.4),
    spread: size * (0.07 + random() * 0.09),
  }));
  for (let index = 0; index < 300; index += 1) {
    const cluster = clusters[Math.floor(random() * clusters.length)];
    const x = cluster.x + gaussian(random) * cluster.spread;
    const y = cluster.y + gaussian(random) * cluster.spread;
    const colour = palette.gas[Math.floor(random() * palette.gas.length)];
    splat(context, x, y, size * (0.03 + random() * 0.12), colour, 0.035 + random() * 0.05);
  }
  for (const cluster of clusters.slice(0, 2)) {
    splat(context, cluster.x, cluster.y, size * 0.06, palette.core, 0.16);
  }
  context.globalCompositeOperation = "destination-out";
  for (let index = 0; index < 45; index += 1) {
    const cluster = clusters[Math.floor(random() * clusters.length)];
    const x = cluster.x + gaussian(random) * cluster.spread * 1.4;
    const y = cluster.y + gaussian(random) * cluster.spread * 1.4;
    splat(context, x, y, size * (0.015 + random() * 0.05), [0, 0, 0], 0.3 + random() * 0.35);
  }
  context.globalCompositeOperation = "source-over";
  featherEdges(context, size, 0.18);
}

/** White radial glow for star halos, threat haze and route packets; tinted per sprite. */
export function paintGlow(context: CanvasRenderingContext2D, size: number) {
  context.clearRect(0, 0, size, size);
  const half = size / 2;
  const gradient = context.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.07, "rgba(255,255,255,0.92)");
  gradient.addColorStop(0.18, "rgba(255,255,255,0.42)");
  gradient.addColorStop(0.4, "rgba(255,255,255,0.12)");
  gradient.addColorStop(0.7, "rgba(255,255,255,0.03)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
}

/** Four-point diffraction flare; tinted per sprite. */
export function paintFlare(context: CanvasRenderingContext2D, size: number) {
  context.clearRect(0, 0, size, size);
  const half = size / 2;
  context.globalCompositeOperation = "lighter";
  for (const vertical of [false, true]) {
    for (const [thickness, alpha] of [[1, 0.9], [3, 0.35], [7, 0.12]] as const) {
      const gradient = vertical
        ? context.createLinearGradient(0, 0, 0, size)
        : context.createLinearGradient(0, 0, size, 0);
      gradient.addColorStop(0, "rgba(255,255,255,0)");
      gradient.addColorStop(0.5, `rgba(255,255,255,${alpha})`);
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = gradient;
      if (vertical) context.fillRect(half - thickness / 2, 0, thickness, size);
      else context.fillRect(0, half - thickness / 2, size, thickness);
    }
  }
  context.globalCompositeOperation = "source-over";
}

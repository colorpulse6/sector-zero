import type { FloatingLabel, AffinityResult } from "./types";

let labelIdCounter = 0;

export function resetFloatingLabelIds(): void {
  labelIdCounter = 0;
}

const AFFINITY_LABEL_TEXT: Record<AffinityResult, string> = {
  effective: "CRITICAL",
  neutral:   "",
  resisted:  "RESISTED",
};

const AFFINITY_LABEL_COLOR: Record<AffinityResult, string> = {
  effective: "#ffdd44",
  neutral:   "",
  resisted:  "#888899",
};

/** Returns null for neutral hits. */
export function createAffinityLabel(
  x: number,
  y: number,
  affinity: AffinityResult
): FloatingLabel | null {
  if (affinity === "neutral") return null;
  return {
    id: ++labelIdCounter,
    x,
    y,
    vy: -1.2,
    text: AFFINITY_LABEL_TEXT[affinity],
    color: AFFINITY_LABEL_COLOR[affinity],
    life: 40,
    maxLife: 40,
  };
}

export function updateFloatingLabels(labels: FloatingLabel[]): FloatingLabel[] {
  return labels
    .map((l) => ({
      ...l,
      y: l.y + l.vy,
      vy: l.vy * 0.97,
      life: l.life - 1,
    }))
    .filter((l) => l.life > 0);
}

export function drawFloatingLabels(
  ctx: CanvasRenderingContext2D,
  labels: FloatingLabel[]
): void {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 11px monospace";
  for (const l of labels) {
    const alpha = l.life / l.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = l.color;
    ctx.shadowBlur = 4;
    ctx.shadowColor = l.color;
    ctx.fillText(l.text, l.x, l.y);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

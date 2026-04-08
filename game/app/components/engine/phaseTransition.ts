import { CANVAS_WIDTH, CANVAS_HEIGHT } from "./types";

export function drawPhaseTransition(
  ctx: CanvasRenderingContext2D,
  cardText: string,
  subtext: string,
  timer: number,
  totalDuration: number
): void {
  ctx.save();

  ctx.fillStyle = "#000005";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const elapsed = totalDuration - timer;
  const fadeIn = Math.min(1, elapsed / 15);  // faster fade in (0.25s)
  const fadeOut = Math.min(1, timer / 15);
  const alpha = Math.min(fadeIn, fadeOut);

  ctx.globalAlpha = alpha;

  const centerY = CANVAS_HEIGHT / 2;

  // Horizontal accent lines
  ctx.fillStyle = "#44ccff22";
  ctx.fillRect(0, centerY - 60, CANVAS_WIDTH, 1);
  ctx.fillRect(0, centerY + 60, CANVAS_WIDTH, 1);

  // Scanning line animation
  const scanY = centerY - 50 + ((elapsed * 1.5) % 100);
  ctx.fillStyle = "#44ccff11";
  ctx.fillRect(0, scanY, CANVAS_WIDTH, 2);

  // Card text
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowBlur = 12;
  ctx.shadowColor = "#44ccff";
  ctx.fillText(cardText.toUpperCase(), CANVAS_WIDTH / 2, centerY - 10);
  ctx.shadowBlur = 0;

  // Subtext
  if (subtext) {
    ctx.fillStyle = "#667788";
    ctx.font = "12px monospace";
    ctx.fillText(subtext, CANVAS_WIDTH / 2, centerY + 20);
  }

  // Loading dots
  const dots = ".".repeat((Math.floor(elapsed / 20) % 4));
  ctx.fillStyle = "#44ccff44";
  ctx.font = "14px monospace";
  ctx.fillText(`LOADING${dots}`, CANVAS_WIDTH / 2, centerY + 60);

  ctx.restore();
}

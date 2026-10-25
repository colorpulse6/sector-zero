import { expect, type Page } from "@playwright/test";

/** Passive observations of rendered minimap/text, never game-state injection. */
export async function observeColonyWalk(page: Page) {
  await page.addInitScript(() => {
    const data = { seq: 0, x: 0, y: 0, texts: [] as string[] };
    (window as unknown as { colonyWalk: typeof data }).colonyWalk = data;
    let origin: { x: number; y: number } | undefined;
    const active = (ctx: CanvasRenderingContext2D) => ctx.canvas.id === "sector-zero-game-canvas";
    const rect = CanvasRenderingContext2D.prototype.fillRect;
    CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) {
      if (active(this) && y === 6 && x + w === 474 && this.fillStyle === "rgba(0, 0, 0, 0.7)") origin = { x: x + 2, y: y + 2 };
      rect.call(this, x, y, w, h);
    };
    const arc = CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.arc = function (x, y, radius, start, end, ccw) {
      if (active(this) && this.fillStyle === "#44ccff" && radius === 2 && origin) {
        data.seq++; data.x = (x - origin.x) / 3; data.y = (y - origin.y) / 3;
      }
      arc.call(this, x, y, radius, start, end, ccw);
    };
    const text = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (value, x, y, max) {
      if (active(this)) { data.texts.push(String(value)); if (data.texts.length > 4000) data.texts.splice(0, 2000); }
      if (max === undefined) text.call(this, value, x, y); else text.call(this, value, x, y, max);
    };
  });
}
declare global { interface Window { colonyWalk: { seq: number; x: number; y: number; texts: string[] } } }
export async function walkFrames(page: Page, count = 18) {
  const seq = await page.evaluate(() => window.colonyWalk.seq);
  await page.waitForFunction(({ seq, count }) => window.colonyWalk.seq >= seq + count, { seq, count });
}
export async function walkPress(page: Page, key = "z") {
  await page.keyboard.down(key);
  try { await walkFrames(page, 3); } finally { await page.keyboard.up(key); }
  await walkFrames(page);
}
export async function walkTo(page: Page, key: string, axis: "x" | "y", target: number) {
  const increasing = await page.evaluate(({ axis, target }) => target > window.colonyWalk[axis], { axis, target });
  await page.keyboard.down(key);
  try {
    await page.waitForFunction(({ axis, target, increasing }) => increasing ? window.colonyWalk[axis] >= target : window.colonyWalk[axis] <= target,
      { axis, target, increasing }, { timeout: 20_000 });
  } finally { await page.keyboard.up(key); }
  await walkFrames(page, 2);
}
export async function walkText(page: Page, text: string) {
  await expect.poll(() => page.evaluate(text => window.colonyWalk.texts.some(line => line.includes(text)), text)).toBe(true);
}
export async function clearWalkText(page: Page) { await page.evaluate(() => { window.colonyWalk.texts = []; }); }
export async function approachQuartermaster(page: Page) {
  await expect(page.locator("#sector-zero-game-canvas")).toBeFocused();
  await walkFrames(page, 3);
  await walkTo(page, "w", "y", 19.75);
  await walkTo(page, "a", "x", 10.0);
  await walkText(page, "[Z] Talk to Quartermaster");
  await walkPress(page); await walkPress(page);
  await walkText(page, "20 METAL");
}

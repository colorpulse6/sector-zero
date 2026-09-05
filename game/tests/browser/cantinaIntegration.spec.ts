import { expect, test, type Page } from "@playwright/test";

import { applyColonyFixture, findFixture } from "../../app/components/colony/dev/seedColony";
import { unlockCodexEntries } from "../../app/components/engine/codex";
import { migrateSave, recalcPilotLevel } from "../../app/components/engine/save";
import { freshLegacy } from "./fixtures/routeFixtures";
import { attachBrowserReceipt } from "./helpers/receipt";
import { installSaveFixture, readInstalledSave, readInstalledSaveBytes } from "./helpers/saveFixture";

const CANVAS = "#sector-zero-game-canvas";
type Point = { x: number; y: number };
type Observation = { seq: number; position: Point; mapSize: number; heading?: Point };
type CantinaEvidence = {
  frames: Observation[];
  texts: Array<{ text: string; color: string }>;
  portraits: Array<{ src: string; width: number; height: number }>;
  writes: string[];
};
declare global { interface Window { cantinaEvidence: CantinaEvidence } }

// Observe the rendered minimap, dialogue, and forwarded storage writes only.
// These wrappers do not change application state, camera, simulation, or time.
async function observeCantina(page: Page) {
  await page.addInitScript(() => {
    const evidence: CantinaEvidence = window.cantinaEvidence = { frames: [], texts: [], portraits: [], writes: [] };
    let origin: Point | undefined;
    let dot: Point | undefined;
    let mapSize = 0;
    let seq = 0;
    const active = (context: CanvasRenderingContext2D) => context.canvas.id === "sector-zero-game-canvas";
    const fillRect = CanvasRenderingContext2D.prototype.fillRect;
    CanvasRenderingContext2D.prototype.fillRect = function (x, y, width, height) {
      if (active(this) && y === 6 && x + width === 474 && this.fillStyle === "rgba(0, 0, 0, 0.7)") {
        origin = { x: x + 2, y: y + 2 };
        mapSize = width;
      }
      fillRect.call(this, x, y, width, height);
    };
    const arc = CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.arc = function (x, y, radius, start, end, counterclockwise) {
      if (active(this) && this.fillStyle === "#44ccff" && radius === 2 && origin) {
        dot = { x, y };
        evidence.frames.push({ seq: ++seq, position: { x: (x - origin.x) / 3, y: (y - origin.y) / 3 }, mapSize });
        if (evidence.frames.length > 3000) evidence.frames.splice(0, 1000);
      }
      arc.call(this, x, y, radius, start, end, counterclockwise);
    };
    const lineTo = CanvasRenderingContext2D.prototype.lineTo;
    CanvasRenderingContext2D.prototype.lineTo = function (x, y) {
      const frame = evidence.frames.at(-1);
      if (active(this) && this.strokeStyle === "#44ccff" && this.lineWidth === 1 && dot && frame) {
        frame.heading = { x: (x - dot.x) / 8, y: (y - dot.y) / 8 };
      }
      lineTo.call(this, x, y);
    };
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
      if (active(this)) {
        evidence.texts.push({ text: String(text), color: String(this.fillStyle) });
        if (evidence.texts.length > 4000) evidence.texts.splice(0, 2000);
      }
      if (maxWidth === undefined) fillText.call(this, text, x, y);
      else fillText.call(this, text, x, y, maxWidth);
    };
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (this: CanvasRenderingContext2D, source: CanvasImageSource, ...args: number[]) {
      if (active(this) && source instanceof HTMLImageElement && source.src.includes("/portraits/")) {
        const offset = args.length === 8 ? 4 : 0;
        evidence.portraits.push({ src: source.currentSrc || source.src, width: args[offset + 2], height: args[offset + 3] });
        if (evidence.portraits.length > 100) evidence.portraits.splice(0, 50);
      }
      Reflect.apply(drawImage, this, [source, ...args]);
    } as typeof CanvasRenderingContext2D.prototype.drawImage;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      setItem.call(this, key, value);
      if (this === localStorage && key === "sector-zero-save") evidence.writes.push(String(value));
    };
  });
}

async function freshFrames(page: Page, count: number) {
  const seq = await page.evaluate(() => window.cantinaEvidence.frames.at(-1)?.seq ?? 0);
  await page.waitForFunction(({ seq, count }) => (window.cantinaEvidence.frames.at(-1)?.seq ?? 0) >= seq + count, { seq, count });
}

async function interact(page: Page) {
  await page.keyboard.down("z");
  try { await freshFrames(page, 3); }
  finally { await page.keyboard.up("z"); }
  await freshFrames(page, 18); // Observe the real engine's interaction cooldown elapsing.
}

async function moveTo(page: Page, key: string, axis: "x" | "y", target: number, direction: -1 | 1) {
  await page.keyboard.down(key);
  try {
    await page.waitForFunction(({ axis, target, direction }) => {
      const value = window.cantinaEvidence.frames.at(-1)?.position[axis];
      return value !== undefined && (value - target) * direction >= 0;
    }, { axis, target, direction }, { timeout: 12_000 });
  } finally { await page.keyboard.up(key); }
  await freshFrames(page, 2);
}

async function expectText(page: Page, text: string, color?: string) {
  await expect.poll(() => page.evaluate(({ text, color }) => window.cantinaEvidence.texts.some(entry =>
    entry.text === text && (color === undefined || entry.color === color)), { text, color })).toBe(true);
}

test("@keyboard Cantina purchase survives its real doors, takeoff, and reload", async ({ page }, info) => {
  test.setTimeout(120_000);
  const fixture = findFixture("cantina");
  if (!fixture) throw new Error("Missing shipped Cantina fixture");
  const seeded = applyColonyFixture(freshLegacy, fixture);
  const save = recalcPilotLevel(unlockCodexEntries(migrateSave(JSON.parse(JSON.stringify({ ...seeded.save, introSeen: true })))));
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  let stage = "setup";
  let passed = false;
  try {
    await observeCantina(page);
    await installSaveFixture(page, save);
    await page.goto("/");
    await page.getByRole("button", { name: "LEGACY CAMPAIGN", exact: true }).click();
    await expectText(page, "UEC VANGUARD — BRIDGE");
    await page.getByRole("button", { name: "Colonies", exact: true }).click();
    await page.getByRole("button", { name: "DESCEND TO COLONY", exact: true }).click();
    await expect(page.locator(CANVAS)).toBeFocused();
    await freshFrames(page, 3);
    expect((await readInstalledSave(page)).credits).toBe(5);

    stage = "exterior door";
    // The shipped seed puts Cantina in the east-middle slot. Cross above the
    // southeast solar building, then approach its actual south-facing door.
    await moveTo(page, "w", "y", 12, -1);
    await moveTo(page, "d", "x", 20.45, 1);
    await moveTo(page, "w", "y", 11.55, -1);
    await interact(page);
    await expect.poll(() => page.evaluate(() => window.cantinaEvidence.frames.at(-1)?.mapSize)).toBe(40);

    stage = "bartender dialogue";
    await moveTo(page, "w", "y", 4.15, -1);
    await moveTo(page, "a", "x", 3.55, -1);
    await moveTo(page, "w", "y", 3.75, -1);
    await interact(page);
    await expectText(page, "BARTENDER");
    await expectText(page, "House pour is five credits. Rumors come");
    await expectText(page, "free.");
    await expect.poll(() => page.evaluate(() => window.cantinaEvidence.portraits.some(portrait =>
      portrait.src.includes("hub-bartender") && portrait.width === 88 && portrait.height === 88))).toBe(true);
    await info.attach("cantina-bartender-portrait", { body: await page.screenshot(), contentType: "image/png" });
    await interact(page);
    await expectText(page, "House Pour");

    stage = "purchase";
    const beforePurchase = await readInstalledSave(page);
    const writesBeforePurchase = await page.evaluate(() => window.cantinaEvidence.writes.length);
    await page.evaluate(() => { window.cantinaEvidence.texts = []; });
    await interact(page);
    await expect.poll(async () => (await readInstalledSave(page)).credits).toBe(0);
    await expectText(page, "HOUSE POUR SERVED", "#66ff99");
    const purchased = await readInstalledSave(page);
    expect(purchased).toEqual({ ...beforePurchase, credits: 0 });
    expect(await page.evaluate(() => window.cantinaEvidence.writes.length)).toBe(writesBeforePurchase + 1);
    await info.attach("cantina-purchase-success", { body: await page.screenshot(), contentType: "image/png" });

    stage = "rejected second purchase";
    const purchasedBytes = await readInstalledSaveBytes(page);
    const writesBeforeRejection = await page.evaluate(() => window.cantinaEvidence.writes.length);
    await page.evaluate(() => { window.cantinaEvidence.texts = []; });
    await interact(page);
    await expectText(page, "PURCHASE UNAVAILABLE", "#ff6666");
    expect(await readInstalledSaveBytes(page)).toBe(purchasedBytes);
    expect(await page.evaluate(() => window.cantinaEvidence.writes.length)).toBe(writesBeforeRejection);
    expect(purchasedBytes).not.toMatch(/shopFlash|HOUSE POUR SERVED|PURCHASE UNAVAILABLE/);

    stage = "interior exit";
    await page.keyboard.down("s");
    try { await freshFrames(page, 3); }
    finally { await page.keyboard.up("s"); }
    await interact(page); // LEAVE closes the shop before walking back to the exit.
    await moveTo(page, "d", "x", 5.45, 1);
    await moveTo(page, "s", "y", 9.15, 1);
    await interact(page);
    await expect.poll(() => page.evaluate(() => window.cantinaEvidence.frames.at(-1)?.mapSize)).toBe(76);
    expect((await readInstalledSave(page)).credits).toBe(0);

    stage = "landing pad takeoff";
    // Exterior return faces south. Strafe right moves west into the clear
    // central corridor before walking south to the landing pad.
    await moveTo(page, "d", "x", 11.55, -1);
    await moveTo(page, "w", "y", 20.5, 1);
    await interact(page);
    const menu = page.getByRole("dialog", { name: "Landing pad exit menu", exact: true });
    await expect(menu).toBeVisible();
    await menu.getByRole("button", { name: "Take Off", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(menu).toBeHidden();
    await page.evaluate(() => { window.cantinaEvidence.texts = []; });
    await expectText(page, "UEC VANGUARD — BRIDGE");
    expect((await readInstalledSave(page)).credits).toBe(0);

    await info.attach("cantina-route-before-reload", {
      body: Buffer.from(JSON.stringify(await page.evaluate(() => window.cantinaEvidence), null, 2)),
      contentType: "application/json",
    });
    stage = "reload";
    await page.reload();
    await expect(page.getByRole("button", { name: "LEGACY CAMPAIGN", exact: true })).toBeVisible();
    expect((await readInstalledSave(page)).credits).toBe(0);
    expect(await readInstalledSaveBytes(page)).not.toMatch(/shopFlash|HOUSE POUR SERVED|PURCHASE UNAVAILABLE/);
    expect(pageErrors).toEqual([]);
    passed = true;
  } finally {
    await info.attach("cantina-observations", {
      body: Buffer.from(JSON.stringify({ stage, pageErrors, evidence: await page.evaluate(() => window.cantinaEvidence).catch(() => null) }, null, 2)),
      contentType: "application/json",
    });
    await attachBrowserReceipt(info, {
      inputMethod: "keyboard",
      saveFixture: "freshLegacy + shipped CANTINA fixture before hydration + introSeen",
      route: "Legacy -> Colonies -> Cantina exterior door -> bartender -> House Pour -> reject second purchase -> interior exit -> Take Off -> reload",
      expectedOutcome: "Native navigation reaches the bartender and portrait; House Pour writes five credits to zero once, rejection writes nothing, and the real door/takeoff/reload route preserves zero without persisting feedback.",
      observedOutcome: passed ? "The authored Cantina door, portrait, purchase, rejection, exit, takeoff, and reload assertions passed with no page errors." : `Assertion failed during ${stage}; see observations and screenshot.`,
    });
  }
});

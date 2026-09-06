import { expect, test, type Page } from "@playwright/test";
import { applyColonyFixture, findFixture } from "../../app/components/colony/dev/seedColony";
import { unlockCodexEntries } from "../../app/components/engine/codex";
import { migrateSave, recalcPilotLevel } from "../../app/components/engine/save";
import { freshLegacy } from "./fixtures/routeFixtures";
import { attachBrowserReceipt } from "./helpers/receipt";
import { installSaveFixture, readInstalledSave, readInstalledSaveBytes } from "./helpers/saveFixture";

type Point = { x: number; y: number };
type Frame = {
  seq: number;
  player: Point;
  heading?: Point;
  actor?: Point & { pixels: number };
  gun?: Point;
};
type TradeEvidence = {
  frames: Frame[];
  texts: string[];
  crops: Array<{ source: string; x: number; y: number; width: number; height: number }>;
  writes: string[];
};
declare global { interface Window { quartermasterTradeEvidence: TradeEvidence } }

// Forward every original browser call. Only observe rendered output and save
// writes; the fixture below is the sole application-state input.
async function observeTrade(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const evidence: TradeEvidence = window.quartermasterTradeEvidence = { frames: [], texts: [], crops: [], writes: [] };
    let origin: Point | undefined, dot: Point | undefined, gun: Point | undefined;
    let actor: Frame["actor"];
    let scene: ImageData | undefined;
    let seq = 0;
    const active = (context: CanvasRenderingContext2D) => context.canvas.id === "sector-zero-game-canvas";
    const fillRect = CanvasRenderingContext2D.prototype.fillRect;
    CanvasRenderingContext2D.prototype.fillRect = function (x, y, width, height) {
      if (active(this) && y === 6 && x + width === 474 && this.fillStyle === "rgba(0, 0, 0, 0.7)") origin = { x: x + 2, y: y + 2 };
      fillRect.call(this, x, y, width, height);
    };
    const arc = CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.arc = function (x, y, radius, start, end, counterclockwise) {
      if (active(this) && this.fillStyle === "#44ccff" && radius === 2 && origin) {
        dot = { x, y };
        evidence.frames.push({ seq: ++seq, player: { x: (x - origin.x) / 3, y: (y - origin.y) / 3 }, actor, gun });
        if (evidence.frames.length > 2000) evidence.frames.splice(0, 1000);
      }
      arc.call(this, x, y, radius, start, end, counterclockwise);
    };
    const lineTo = CanvasRenderingContext2D.prototype.lineTo;
    CanvasRenderingContext2D.prototype.lineTo = function (x, y) {
      const frame = evidence.frames.at(-1);
      if (active(this) && this.strokeStyle === "#44ccff" && this.lineWidth === 1 && dot && frame) frame.heading = { x: (x - dot.x) / 8, y: (y - dot.y) / 8 };
      lineTo.call(this, x, y);
    };
    const putImageData = CanvasRenderingContext2D.prototype.putImageData;
    CanvasRenderingContext2D.prototype.putImageData = function (this: CanvasRenderingContext2D, data: ImageData, ...args: number[]) {
      if ((data.width === 480 && data.height === 714) || (data.width === 240 && data.height === 357)) {
        scene = data;
        actor = undefined;
      }
      Reflect.apply(putImageData, this, [data, ...args]);
    } as typeof putImageData;
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
      if (active(this)) {
        evidence.texts.push(String(text));
        if (evidence.texts.length > 4000) evidence.texts.splice(0, 2000);
        if (text === "Quartermaster" && this.fillStyle === "#5fd0c0" && scene) {
          // Hash the rendered NPC rectangle before HUD/dialogue overlays. Its
          // projected name tag supplies the same center and scale as the actor.
          const size = (357 - y - 4) * 3;
          const scale = scene.width / 480;
          const left = Math.max(0, Math.floor((x - size / 4) * scale));
          const right = Math.min(scene.width, Math.ceil((x + size / 4) * scale));
          const top = Math.max(0, Math.floor((y + 4) * scale));
          const bottom = Math.min(scene.height, Math.ceil((y + 4 + size) * scale));
          let hash = 2166136261;
          for (let row = top; row < bottom; row++) {
            for (let col = left; col < right; col++) {
              const offset = (row * scene.width + col) * 4;
              for (let channel = 0; channel < 3; channel++) hash = Math.imul(hash ^ scene.data[offset + channel], 16777619);
            }
          }
          actor = { x, y, pixels: hash >>> 0 };
        }
      }
      if (maxWidth === undefined) fillText.call(this, text, x, y);
      else fillText.call(this, text, x, y, maxWidth);
    };
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (this: CanvasRenderingContext2D, source: CanvasImageSource, ...args: number[]) {
      if (source instanceof HTMLImageElement && args.length === 8) {
        if (/\/pilot\/quartermaster\/(idle|walk|work)\.png/.test(source.src)) evidence.crops.push({ source: source.src, x: args[0], y: args[1], width: args[2], height: args[3] });
        if (active(this) && source.src.includes("/boarding/gun-sheet.png")) gun = { x: args[4], y: args[5] };
      }
      Reflect.apply(drawImage, this, [source, ...args]);
    } as typeof drawImage;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      setItem.call(this, key, value);
      if (this === localStorage && key === "sector-zero-save") evidence.writes.push(String(value));
    };
  });
}

async function freshFrames(page: Page, count: number): Promise<void> {
  const seq = await page.evaluate(() => window.quartermasterTradeEvidence.frames.at(-1)?.seq ?? 0);
  await page.waitForFunction(({ seq, count }) => (window.quartermasterTradeEvidence.frames.at(-1)?.seq ?? 0) >= seq + count, { seq, count });
}

async function interact(page: Page): Promise<void> {
  await page.keyboard.down("z");
  try { await freshFrames(page, 3); }
  finally { await page.keyboard.up("z"); }
  await freshFrames(page, 18);
}

async function moveTo(page: Page, key: string, axis: "x" | "y", target: number): Promise<void> {
  await page.keyboard.down(key);
  try {
    await page.waitForFunction(({ axis, target }) => {
      const value = window.quartermasterTradeEvidence.frames.at(-1)?.player[axis];
      return value !== undefined && value <= target;
    }, { axis, target }, { timeout: 12_000 });
  } finally { await page.keyboard.up(key); }
  await freshFrames(page, 2);
}

async function expectText(page: Page, text: string): Promise<void> {
  await expect.poll(() => page.evaluate(text => window.quartermasterTradeEvidence.texts.includes(text), text)).toBe(true);
}

test("@keyboard animated colony quartermaster freezes for dialogue and persists a real purchase", async ({ page }, info) => {
  test.setTimeout(90_000);
  const fixture = findFixture("day");
  if (!fixture) throw new Error("Missing shipped day fixture");
  const seeded = applyColonyFixture({ ...freshLegacy, credits: 300, completedPlanets: ["verdania"], introSeen: true }, fixture);
  const save = recalcPilotLevel(unlockCodexEntries(migrateSave(JSON.parse(JSON.stringify(seeded.save)))));
  const errors: string[] = [];
  const assetResponses: Array<{ url: string; status: number }> = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("response", response => {
    if (response.url().includes("/pilot/quartermaster/")) assetResponses.push({ url: response.url(), status: response.status() });
  });
  let stage = "colony entry", passed = false;
  try {
    await observeTrade(page);
    await installSaveFixture(page, save);
    await page.goto("/");
    await page.getByRole("button", { name: "LEGACY CAMPAIGN", exact: true }).click();
    await expectText(page, "UEC VANGUARD — BRIDGE");
    await page.getByRole("button", { name: "Colonies", exact: true }).click();
    await page.getByRole("button", { name: "DESCEND TO COLONY", exact: true }).click();
    await expect(page.locator("#sector-zero-game-canvas")).toBeFocused();
    await freshFrames(page, 3);
    expect((await readInstalledSave(page)).credits).toBe(300);
    const spawn = await page.evaluate(() => window.quartermasterTradeEvidence.frames.at(-1)!);
    expect(spawn.player).toEqual({ x: 11.5, y: 22.5 });

    stage = "quartermaster approach";
    await moveTo(page, "w", "y", 19.75);
    await moveTo(page, "a", "x", 10.0);
    await expectText(page, "[Z] Talk to Quartermaster");
    await expect.poll(() => page.evaluate(() => window.quartermasterTradeEvidence.crops.length), { timeout: 15_000 }).toBeGreaterThan(0);
    const crops = await page.evaluate(() => window.quartermasterTradeEvidence.crops);
    expect(crops.every(crop => crop.width === 128 && crop.height === 256 && crop.x % 128 === 0 && crop.y % 256 === 0)).toBe(true);
    await info.attach("quartermaster-colony-approach", { body: await page.screenshot(), contentType: "image/png" });

    stage = "dialogue freeze";
    await interact(page);
    await expectText(page, "Quartermaster");
    await expectText(page, "Supplies for the road, if you've got the credits.");
    const frozen = await page.evaluate(() => window.quartermasterTradeEvidence.frames.at(-1)!);
    expect(frozen.actor).toBeDefined();
    expect(frozen.gun).toBeDefined();
    await page.keyboard.down("w");
    await page.keyboard.down("ArrowLeft");
    try { await freshFrames(page, 30); }
    finally { await page.keyboard.up("w"); await page.keyboard.up("ArrowLeft"); }
    const held = await page.evaluate(seq => window.quartermasterTradeEvidence.frames.filter(frame => frame.seq > seq), frozen.seq);
    expect(held.length).toBeGreaterThanOrEqual(30);
    for (const frame of held) {
      expect(frame.player).toEqual(frozen.player);
      expect(frame.heading).toEqual(frozen.heading);
      expect(frame.actor).toEqual(frozen.actor);
      expect(frame.gun).toEqual(frozen.gun);
    }

    stage = "shop purchase";
    await interact(page);
    await expectText(page, "Hull Repair Kit");
    await expectText(page, "◆ 300");
    const before = await readInstalledSave(page);
    const writes = await page.evaluate(() => window.quartermasterTradeEvidence.writes.length);
    await interact(page);
    await expect.poll(async () => (await readInstalledSave(page)).credits).toBe(0);
    const purchased = await readInstalledSave(page);
    expect(purchased).toEqual({ ...before, credits: 0, consumableInventory: { ...before.consumableInventory, "hull-repair": (before.consumableInventory["hull-repair"] ?? 0) + 1 } });
    expect(await page.evaluate(() => window.quartermasterTradeEvidence.writes.length)).toBe(writes + 1);
    expect(await readInstalledSaveBytes(page)).not.toMatch(/weaponMotion|atlasAnimation|quartermasterMotion/);
    await info.attach("quartermaster-colony-purchase", { body: await page.screenshot(), contentType: "image/png" });
    await info.attach("quartermaster-trade-before-reload", { body: Buffer.from(JSON.stringify(await page.evaluate(() => window.quartermasterTradeEvidence), null, 2)), contentType: "application/json" });

    stage = "reload";
    await page.reload();
    await expect(page.getByRole("button", { name: "LEGACY CAMPAIGN", exact: true })).toBeVisible();
    expect((await readInstalledSave(page)).credits).toBe(0);
    expect((await readInstalledSave(page)).consumableInventory["hull-repair"]).toBe(1);
    expect(errors).toEqual([]);
    passed = true;
  } finally {
    await info.attach("quartermaster-trade-observations", { body: Buffer.from(JSON.stringify({ stage, errors, assetResponses, evidence: await page.evaluate(() => window.quartermasterTradeEvidence).catch(() => null) }, null, 2)), contentType: "application/json" });
    await attachBrowserReceipt(info, {
      inputMethod: "keyboard", saveFixture: "freshLegacy + shipped day fixture + 300 credits + Verdania completed + introSeen",
      route: "Legacy -> Colonies -> Descend -> walk to Quartermaster -> dialogue -> Hull Repair Kit -> reload",
      expectedOutcome: "Real colony rendering crops the animated atlas; dialogue freezes player, weapon, and visible actor pixels; one purchase persists 300 credits to zero and one Hull Repair Kit through reload.",
      observedOutcome: passed ? "Atlas, dialogue freeze, exact purchase write, and reload assertions passed without page errors." : `Failed during ${stage}; see observations and screenshot.`,
    });
  }
});

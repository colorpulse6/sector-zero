import { expect, test, type Page } from "@playwright/test";

import { freshLegacy } from "./fixtures/routeFixtures";
import { attachBrowserReceipt } from "./helpers/receipt";
import { installSaveFixture } from "./helpers/saveFixture";

type GroundObservation = { sprite: string; x: number; worldX: number; cameraX: number; y: number; bullets: number; time: number };
declare global {
  interface Window { inputObservations: GroundObservation[] }
}

// Read-only rendering observation: no game state access or test-only controls.
async function openGround(page: Page) {
  await installSaveFixture(page, freshLegacy);
  await page.addInitScript(() => {
    window.inputObservations = [];
    let bullets = 0;
    let cameraX = 0;
    const translate = CanvasRenderingContext2D.prototype.translate;
    CanvasRenderingContext2D.prototype.translate = function (x, y) {
      // The effects pass draws in world space immediately before the player.
      // Ignore the mirrored sprite transform; forward every draw unchanged.
      if (this.canvas.id === "sector-zero-game-canvas" && x <= 0 && y === 0 && this.getTransform().a === 1) cameraX = -x;
      return translate.call(this, x, y);
    };
    const fillRect = CanvasRenderingContext2D.prototype.fillRect;
    CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) {
      if (this.canvas.id === "sector-zero-game-canvas" && this.fillStyle === "#00ffff" && w === 10 && h === 6) bullets++;
      return fillRect.call(this, x, y, w, h);
    };
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (sprite: CanvasImageSource, x: number, y: number, ...dimensions: number[]) {
      if (this.canvas.id === "sector-zero-game-canvas" && sprite instanceof HTMLImageElement && sprite.src.includes("/ground/player-")) {
        window.inputObservations.push({ sprite: sprite.src, x, worldX: x + cameraX, cameraX, y, bullets, time: performance.now() });
        bullets = 0;
      }
      return Reflect.apply(drawImage, this, [sprite, x, y, ...dimensions]);
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "DEV", exact: true }).click();
  await page.getByRole("button", { name: "GROUND RUN", exact: true }).click();
  await page.getByRole("button", { name: "X", exact: true }).click();
  await page.locator("#sector-zero-game-canvas").focus();
  await page.waitForFunction(() => window.inputObservations.at(-1)?.sprite.endsWith("player-idle.png"));
}

async function observeFrames(page: Page, count = 25): Promise<GroundObservation[]> {
  const start = await page.evaluate(() => window.inputObservations.length);
  await page.waitForFunction(({ start, count }) => window.inputObservations.length >= start + count, { start, count });
  return page.evaluate(({ start, count }) => window.inputObservations.slice(start, start + count), { start, count });
}

test("@keyboard ground Space jumps without firing; fire aliases survive keyup", async ({ page }, testInfo) => {
  await openGround(page);
  await page.keyboard.down("Space");
  const jump = await observeFrames(page, 15);
  await page.keyboard.up("Space");
  expect(jump.some((frame) => frame.sprite.endsWith("player-jump.png"))).toBe(true);
  expect(jump.every((frame) => frame.bullets === 0), "Space must not also spawn player projectiles").toBe(true);
  await page.waitForFunction(() => window.inputObservations.at(-1)?.sprite.endsWith("player-idle.png"));

  await page.keyboard.down("z");
  await page.keyboard.down("Shift");
  await page.keyboard.up("z");
  const fire = await observeFrames(page, 35);
  expect(fire.some((frame) => frame.sprite.endsWith("player-shoot.png"))).toBe(true);
  expect(fire.some((frame) => frame.bullets > 0)).toBe(true);
  expect(fire.every((frame) => !frame.sprite.endsWith("player-jump.png"))).toBe(true);
  await page.keyboard.up("Shift");
  await observeFrames(page, 25);
  const released = await observeFrames(page, 25);
  expect(released.every((frame) => !frame.sprite.endsWith("player-shoot.png"))).toBe(true);
  await attachBrowserReceipt(testInfo, {
    route: "DevPanel -> ground-run -> jump/fire -> release", inputMethod: "keyboard", saveFixture: "freshLegacy",
    expectedOutcome: "Space only jumps; Z/Shift only fire; releasing one alias preserves the other; final release stops new shots.",
    observedOutcome: "Rendered jump had no player projectiles; Shift kept firing after Z release; final release stopped shooting animation.",
  });
});

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    await testInfo.attach("ground-render-observations", {
      contentType: "application/json",
      body: JSON.stringify(await page.evaluate(() => window.inputObservations?.slice(-300))),
    });
  }
});

test("@keyboard blur and pause clear held movement until a fresh press", async ({ page }, testInfo) => {
  await openGround(page);
  const movingStart = await page.evaluate(() => ({ index: window.inputObservations.length, worldX: window.inputObservations.at(-1)!.worldX }));
  await page.keyboard.down("ArrowRight");
  await page.waitForFunction(({ index, worldX }) => window.inputObservations.slice(index).some((frame) => frame.worldX > worldX + 1), movingStart);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  const blurred = await observeFrames(page, 12);
  expect(blurred.at(-1)!.worldX).toBeCloseTo(blurred[0].worldX, 3);
  expect(blurred.every((frame) => frame.sprite.endsWith("player-idle.png"))).toBe(true);
  await page.keyboard.up("ArrowRight");

  // Keep combat from interrupting the separate pause/old-hold observation.
  // Enter through the shipped controls and face the safe edge of the entrance.
  await page.getByRole("button", { name: "DEV", exact: true }).click();
  await page.getByRole("button", { name: "GROUND RUN", exact: true }).click();
  await page.getByRole("button", { name: "X", exact: true }).click();
  await page.locator("#sector-zero-game-canvas").focus();
  await page.waitForFunction(() => window.inputObservations.at(-1)?.sprite.endsWith("player-idle.png"));
  const leftStart = await page.evaluate(() => ({ index: window.inputObservations.length, worldX: window.inputObservations.at(-1)!.worldX }));
  await page.keyboard.down("ArrowLeft");
  await page.waitForFunction(({ index, worldX }) => window.inputObservations.slice(index).some((frame) => frame.worldX < worldX - 1), leftStart);
  await page.keyboard.press("p");
  await expect(page.getByRole("button", { name: "RESUME", exact: true })).toBeVisible();
  await page.keyboard.press("p");
  await expect(page.getByRole("button", { name: "RESUME", exact: true })).toBeHidden();
  const resumed = await observeFrames(page, 12);
  expect(resumed.at(-1)!.worldX).toBeCloseTo(resumed[0].worldX, 3);
  expect(resumed.every((frame) => frame.sprite.endsWith("player-idle.png"))).toBe(true);
  await page.keyboard.down("ArrowLeft"); // browser repeat of the old physical hold
  const repeated = await observeFrames(page, 8);
  expect(repeated.at(-1)!.worldX).toBeCloseTo(repeated[0].worldX, 3);
  expect(repeated.every((frame) => frame.sprite.endsWith("player-idle.png"))).toBe(true);
  await page.keyboard.up("ArrowLeft");
  const freshLeftStart = await page.evaluate(() => window.inputObservations.length);
  await page.keyboard.down("ArrowLeft");
  // A boundary can prevent displacement, but a running pose proves that this
  // same physical key re-armed only after release and a fresh press.
  await page.waitForFunction(index => window.inputObservations.slice(index).some(frame => frame.sprite.includes("/ground/player-run-")), freshLeftStart);
  await page.keyboard.up("ArrowLeft");
  const freshRightStart = await page.evaluate(() => ({ index: window.inputObservations.length, worldX: window.inputObservations.at(-1)!.worldX }));
  await page.keyboard.down("ArrowRight");
  await page.waitForFunction(({ index, worldX }) => window.inputObservations.slice(index).some((frame) => frame.worldX > worldX + 1), freshRightStart);
  await page.keyboard.up("ArrowRight");
  await attachBrowserReceipt(testInfo, {
    route: "ground-run -> blur -> native DevPanel Ground entry -> Left pause/resume -> repeated Left -> fresh Left/Right", inputMethod: "keyboard", saveFixture: "freshLegacy",
    expectedOutcome: "Blur and pause clear held movement; the old repeated key stays idle; release and a fresh physical press re-arm it.",
    observedOutcome: "World position and idle poses remained stable after blur/resume/repeat; fresh Left resumed running and fresh Right moved after the native Ground relaunch.",
  });
});

test("@keyboard visibility loss and mode transitions discard old physical holds", async ({ page }, testInfo) => {
  await openGround(page);
  await page.keyboard.down("ArrowRight");
  await observeFrames(page, 8);
  // Simulate the browser's hidden-document boundary without changing game state.
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
    Reflect.deleteProperty(document, "hidden");
  });
  const hidden = await observeFrames(page, 12);
  expect(hidden.at(-1)!.worldX).toBeCloseTo(hidden[0].worldX, 3);
  expect(hidden.every((frame) => frame.sprite.endsWith("player-idle.png"))).toBe(true);
  await page.keyboard.up("ArrowRight");
  await page.keyboard.down("ArrowRight");
  await page.getByRole("button", { name: "DEV", exact: true }).click();
  await page.getByRole("button", { name: "BOARDING", exact: true }).click();
  await page.getByRole("button", { name: "GROUND RUN", exact: true }).click();
  await page.getByRole("button", { name: "X", exact: true }).click();
  await page.locator("#sector-zero-game-canvas").focus();
  await page.waitForFunction(() => window.inputObservations.at(-1)?.sprite.endsWith("player-idle.png"));
  const returned = await observeFrames(page, 12);
  expect(returned.at(-1)!.worldX).toBeCloseTo(returned[0].worldX, 3);
  expect(returned.every((frame) => frame.sprite.endsWith("player-idle.png"))).toBe(true);
  await page.keyboard.up("ArrowRight");
  await attachBrowserReceipt(testInfo, {
    route: "ground-run -> simulated document hidden -> boarding -> ground-run", inputMethod: "keyboard", saveFixture: "freshLegacy",
    expectedOutcome: "Visibility loss and mode changes clear old held keys.",
    observedOutcome: "Player stayed stationary after both boundaries while the old key remained physically down.",
  });
});

test("@touch cancel releases the Fire control without cancelling a keyboard owner", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const events: unknown[] = [];
    Object.assign(window, { inputLifecycle: events });
    for (const type of ["pointerdown", "pointerup", "pointercancel", "lostpointercapture", "touchstart", "touchend", "touchcancel", "click", "keyup"]) {
      window.addEventListener(type, (event) => events.push({
        type, target: event.target instanceof Element ? event.target.getAttribute("aria-label") : null,
        pointerId: "pointerId" in event ? event.pointerId : null,
        key: "key" in event ? event.key : null,
      }), true);
    }
  });
  await openGround(page);
  const box = await page.getByRole("group", { name: "Ground controls" }).getByRole("button", { name: "Fire", exact: true }).boundingBox();
  expect(box).not.toBeNull();
  const session = await page.context().newCDPSession(page);
  const startTouch = () => session.send("Input.dispatchTouchEvent", {
    type: "touchStart", touchPoints: [{ x: box!.x + box!.width * 0.5, y: box!.y + box!.height * 0.5 }],
  });
  const cancelTouch = () => session.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  await page.keyboard.down("z");
  await startTouch();
  await observeFrames(page, 8);
  await cancelTouch();
  const keyboardOwned = await observeFrames(page, 30);
  expect(keyboardOwned.some((frame) => frame.sprite.endsWith("player-shoot.png"))).toBe(true);
  await page.keyboard.up("z");
  const afterKeyboardRelease = await observeFrames(page, 25);
  await startTouch();
  const touchOwned = await observeFrames(page, 25);
  expect(touchOwned.some((frame) => frame.bullets > 0)).toBe(true);
  await cancelTouch();
  await observeFrames(page, 25);
  const cancelled = await observeFrames(page, 25);
  const lifecycle = await page.evaluate(() => ({
    events: (window as unknown as { inputLifecycle: unknown[] }).inputLifecycle,
    pressed: [...document.querySelectorAll('[aria-pressed="true"]')].map((node) => node.getAttribute("aria-label")),
  }));
  await testInfo.attach("input-lifecycle", { body: JSON.stringify(lifecycle, null, 2), contentType: "application/json" });
  expect(cancelled.every((frame) => !frame.sprite.endsWith("player-shoot.png")), JSON.stringify({
    ...lifecycle,
    afterKeyboardRelease: afterKeyboardRelease.map(({ sprite, bullets, time }) => ({ sprite: sprite.split("/").at(-1), bullets, time })),
    cancelled: cancelled.map(({ sprite, bullets, time }) => ({ sprite: sprite.split("/").at(-1), bullets, time })),
  })).toBe(true);
  await session.detach();
  await attachBrowserReceipt(testInfo, {
    route: "ground-run -> keyboard + Fire control -> touchcancel -> Fire control only -> touchcancel", inputMethod: "touch", saveFixture: "freshLegacy",
    expectedOutcome: "A native touch cancellation releases touch fire, preserving any held keyboard fire.",
    observedOutcome: "Keyboard shooting survived the first cancellation; touch-only shooting stopped after cancellation at 480x854.",
  });
});

import { expect, test, type Page } from "@playwright/test";

import { freshLegacy } from "./fixtures/routeFixtures";
import { attachBrowserReceipt } from "./helpers/receipt";
import { installSaveFixture } from "./helpers/saveFixture";

type InputObservation = { sprite: string; x: number; worldX: number; cameraX: number; y: number; bullets: number; time: number };
declare global {
  interface Window { inputObservations: InputObservation[] }
}

// Read-only rendering observation: no game state access or test-only controls.
async function openFirstPerson(page: Page) {
  await installSaveFixture(page, freshLegacy);
  await page.addInitScript(() => {
    window.inputObservations = [];
    let gun = false;
    let map: { x: number; y: number } | null = null;
    let position = { x: 0, y: 0 };
    const active = (ctx: CanvasRenderingContext2D) => ctx.canvas.id === "sector-zero-game-canvas";
    const fillRect = CanvasRenderingContext2D.prototype.fillRect;
    CanvasRenderingContext2D.prototype.fillRect = function(x, y, w, h) {
      if (active(this) && y === 6 && w === h && this.fillStyle === "rgba(0, 0, 0, 0.7)") map = { x: x + 2, y: y + 2 };
      fillRect.call(this, x, y, w, h);
    };
    const arc = CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.arc = function(x, y, radius, start, end, counterclockwise) {
      if (active(this) && this.fillStyle === "#44ccff" && radius === 2 && map) position = { x: (x - map.x) / 3, y: (y - map.y) / 3 };
      arc.call(this, x, y, radius, start, end, counterclockwise);
    };
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function(this: CanvasRenderingContext2D, source: CanvasImageSource, ...args: number[]) {
      if (active(this) && source instanceof HTMLImageElement && source.src.endsWith("/boarding/gun-sheet.png")) gun ||= args[0] > 0;
      Reflect.apply(drawImage, this, [source, ...args]);
    } as typeof CanvasRenderingContext2D.prototype.drawImage;
    const sample = () => {
      if (map) window.inputObservations.push({ sprite: gun ? "firing" : "idle", x: position.x, worldX: position.x, cameraX: 0, y: position.y, bullets: Number(gun), time: performance.now() });
      gun = false;
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.goto("/");
  await page.getByRole("button", { name: "DEV", exact: true }).click();
  await expect(page.getByRole("button", { name: "GROUND RUN", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "BOARDING", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "FIRST PERSON", exact: true }).click();
  await page.getByRole("button", { name: "X", exact: true }).click();
  await page.locator("#sector-zero-game-canvas").focus();
  await page.waitForFunction(() => window.inputObservations.at(-1)?.sprite === "idle");
}

async function observeFrames(page: Page, count = 25): Promise<InputObservation[]> {
  const start = await page.evaluate(() => window.inputObservations.length);
  await page.waitForFunction(({ start, count }) => window.inputObservations.length >= start + count, { start, count });
  return page.evaluate(({ start, count }) => window.inputObservations.slice(start, start + count), { start, count });
}

test("@keyboard first-person fire aliases survive individual release", async ({ page }, testInfo) => {
  await openFirstPerson(page);
  await page.keyboard.down("z");
  await page.keyboard.down("Shift");
  await page.keyboard.up("z");
  expect((await observeFrames(page, 35)).some(frame => frame.bullets > 0)).toBe(true);
  await page.keyboard.up("Shift");
  await observeFrames(page, 25);
  expect((await observeFrames(page, 25)).every(frame => frame.bullets === 0)).toBe(true);
  await attachBrowserReceipt(testInfo, { route: "first person -> Z + Shift -> individual release", inputMethod: "keyboard", saveFixture: "freshLegacy",
    expectedOutcome: "Releasing one fire alias preserves the other; final release stops firing.", observedOutcome: "Gun animation continued with Shift and stopped after release." });
});

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    await testInfo.attach("input-render-observations", {
      contentType: "application/json",
      body: JSON.stringify(await page.evaluate(() => window.inputObservations?.slice(-300))),
    });
  }
});

test("@keyboard blur and pause clear held movement until a fresh press", async ({ page }, testInfo) => {
  await openFirstPerson(page);
  const movingStart = await page.evaluate(() => ({ index: window.inputObservations.length, worldX: window.inputObservations.at(-1)!.worldX }));
  await page.keyboard.down("ArrowUp");
  await page.waitForFunction(({ index, worldX }) => window.inputObservations.slice(index).some((frame) => frame.worldX > worldX + 0.05), movingStart);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  const blurred = await observeFrames(page, 12);
  expect(blurred.at(-1)!.worldX).toBeCloseTo(blurred[0].worldX, 3);
  expect(blurred.every((frame) => frame.sprite === "idle")).toBe(true);
  await page.keyboard.up("ArrowUp");

  const leftStart = await page.evaluate(() => ({ index: window.inputObservations.length, worldX: window.inputObservations.at(-1)!.worldX }));
  await page.keyboard.down("ArrowDown");
  await page.waitForFunction(({ index, worldX }) => window.inputObservations.slice(index).some((frame) => frame.worldX < worldX - 0.05), leftStart);
  await page.keyboard.press("p");
  await expect(page.getByRole("button", { name: "RESUME", exact: true })).toBeVisible();
  await page.keyboard.press("p");
  await expect(page.getByRole("button", { name: "RESUME", exact: true })).toBeHidden();
  const resumed = await observeFrames(page, 12);
  expect(resumed.at(-1)!.worldX).toBeCloseTo(resumed[0].worldX, 3);
  expect(resumed.every((frame) => frame.sprite === "idle")).toBe(true);
  await page.keyboard.down("ArrowDown"); // browser repeat of the old physical hold
  const repeated = await observeFrames(page, 8);
  expect(repeated.at(-1)!.worldX).toBeCloseTo(repeated[0].worldX, 3);
  expect(repeated.every((frame) => frame.sprite === "idle")).toBe(true);
  await page.keyboard.up("ArrowDown");
  const freshLeftStart = await page.evaluate(() => ({ index: window.inputObservations.length, worldX: window.inputObservations.at(-1)!.worldX }));
  await page.keyboard.down("ArrowDown");
  await page.waitForFunction(({ index, worldX }) => window.inputObservations.slice(index).some(frame => frame.worldX < worldX - 0.05), freshLeftStart);
  await page.keyboard.up("ArrowDown");
  const freshRightStart = await page.evaluate(() => ({ index: window.inputObservations.length, worldX: window.inputObservations.at(-1)!.worldX }));
  await page.keyboard.down("ArrowUp");
  await page.waitForFunction(({ index, worldX }) => window.inputObservations.slice(index).some((frame) => frame.worldX > worldX + 0.05), freshRightStart);
  await page.keyboard.up("ArrowUp");
  await attachBrowserReceipt(testInfo, {
    route: "first-person -> blur -> first-person -> Backward pause/resume -> repeated Backward -> fresh Backward/Forward", inputMethod: "keyboard", saveFixture: "freshLegacy",
    expectedOutcome: "Blur and pause clear held movement; the old repeated key stays idle; release and a fresh physical press re-arm it.",
    observedOutcome: "World position and idle poses remained stable after blur/resume/repeat; fresh Backward and Forward presses moved the player.",
  });
});

test("@keyboard visibility loss and mode transitions discard old physical holds", async ({ page }, testInfo) => {
  await openFirstPerson(page);
  await page.keyboard.down("ArrowUp");
  await observeFrames(page, 8);
  // Simulate the browser's hidden-document boundary without changing game state.
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
    Reflect.deleteProperty(document, "hidden");
  });
  const hidden = await observeFrames(page, 12);
  expect(hidden.at(-1)!.worldX).toBeCloseTo(hidden[0].worldX, 3);
  expect(hidden.every((frame) => frame.sprite === "idle")).toBe(true);
  await page.keyboard.up("ArrowUp");
  await page.keyboard.down("ArrowUp");
  await page.getByRole("button", { name: "DEV", exact: true }).click();
  await page.getByRole("button", { name: "TURRET", exact: true }).click();
  await page.getByRole("button", { name: "FIRST PERSON", exact: true }).click();
  await page.getByRole("button", { name: "X", exact: true }).click();
  await page.locator("#sector-zero-game-canvas").focus();
  await page.waitForFunction(() => window.inputObservations.at(-1)?.sprite === "idle");
  const returned = await observeFrames(page, 12);
  expect(returned.at(-1)!.worldX).toBeCloseTo(returned[0].worldX, 3);
  expect(returned.every((frame) => frame.sprite === "idle")).toBe(true);
  await page.keyboard.up("ArrowUp");
  await attachBrowserReceipt(testInfo, {
    route: "first-person -> simulated document hidden -> turret -> first-person", inputMethod: "keyboard", saveFixture: "freshLegacy",
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
  await openFirstPerson(page);
  const box = await page.getByRole("group", { name: "First-person controls" }).getByRole("button", { name: "Fire / interact", exact: true }).boundingBox();
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
  expect(keyboardOwned.some((frame) => frame.sprite === "firing")).toBe(true);
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
  expect(cancelled.every((frame) => frame.sprite !== "firing"), JSON.stringify({
    ...lifecycle,
    afterKeyboardRelease: afterKeyboardRelease.map(({ sprite, bullets, time }) => ({ sprite: sprite.split("/").at(-1), bullets, time })),
    cancelled: cancelled.map(({ sprite, bullets, time }) => ({ sprite: sprite.split("/").at(-1), bullets, time })),
  })).toBe(true);
  await session.detach();
  await attachBrowserReceipt(testInfo, {
    route: "first-person -> keyboard + Fire control -> touchcancel -> Fire control only -> touchcancel", inputMethod: "touch", saveFixture: "freshLegacy",
    expectedOutcome: "A native touch cancellation releases touch fire, preserving any held keyboard fire.",
    observedOutcome: "Keyboard shooting survived the first cancellation; touch-only shooting stopped after cancellation at 480x854.",
  });
});

import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { freshLegacy, keplerCleared, keplerUnlocked } from "./fixtures/routeFixtures";
import { attachBrowserReceipt } from "./helpers/receipt";
import { installSaveFixture } from "./helpers/saveFixture";
import type { SaveData } from "../../app/components/engine/types";

const CANVAS = "#sector-zero-game-canvas";
const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 854;

type InputMethod = "keyboard" | "pointer" | "touch";
type PolicyState = "locked" | "unlocked" | "first-clear" | "cleared";

const locked: SaveData = { ...freshLegacy, introSeen: true };
const unlocked: SaveData = { ...keplerUnlocked, introSeen: true };
const cleared: SaveData = { ...keplerCleared, introSeen: true };

async function observeCanvasText(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const texts: string[] = [];
    Object.defineProperty(window, "__sectorZeroLaunchTexts", {
      configurable: false,
      value: texts,
    });
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function observed(
      text: string,
      x: number,
      y: number,
      maxWidth?: number,
    ): void {
      texts.push(String(text));
      if (texts.length > 4_000) texts.splice(0, 2_000);
      if (maxWidth === undefined) original.call(this, text, x, y);
      else original.call(this, text, x, y, maxWidth);
    };
  });
}

async function readTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => [
    ...(window as typeof window & { __sectorZeroLaunchTexts: string[] }).__sectorZeroLaunchTexts,
  ]);
}

async function clearTexts(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as typeof window & { __sectorZeroLaunchTexts: string[] }).__sectorZeroLaunchTexts.length = 0;
  });
}

async function canvasPoint(page: Page, x: number, y: number) {
  const box = await page.locator(CANVAS).boundingBox();
  expect(box).not.toBeNull();
  return {
    localX: x / CANVAS_WIDTH * box!.width,
    localY: y / CANVAS_HEIGHT * box!.height,
    pageX: box!.x + x / CANVAS_WIDTH * box!.width,
    pageY: box!.y + y / CANVAS_HEIGHT * box!.height,
  };
}

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  // The shipped cockpit samples held keys on its animation tick; keep the
  // physical key down across several frames so this is a real edge, not a
  // test-runner tap that begins and ends between frames.
  await page.waitForTimeout(140);
  await page.keyboard.up(key);
  await page.waitForTimeout(100);
}

async function activateCanvasPoint(page: Page, method: InputMethod, x: number, y: number): Promise<void> {
  const point = await canvasPoint(page, x, y);
  if (method === "pointer") {
    await page.locator(CANVAS).click({ position: { x: point.localX, y: point.localY } });
  } else if (method === "touch") {
    await page.touchscreen.tap(point.pageX, point.pageY);
  } else {
    throw new Error("Keyboard activation does not use a point");
  }
  await page.waitForTimeout(80);
}

async function enterSpecialBoard(page: Page, fixture: SaveData, method: InputMethod): Promise<void> {
  await observeCanvasText(page);
  await installSaveFixture(page, fixture);
  await page.goto("/");
  await page.getByRole("button", { name: "LEGACY CAMPAIGN" }).click();
  await expect(page.getByRole("button", { name: "LEGACY CAMPAIGN" })).toBeHidden();
  await expect.poll(() => readTexts(page)).toEqual(expect.arrayContaining(["STAR MAP"]));

  if (method === "keyboard") {
    await tapKey(page, "ArrowRight");
    await tapKey(page, "Enter");
    await expect.poll(() => readTexts(page)).toEqual(expect.arrayContaining(["MISSION BOARD"]));
    await tapKey(page, "ArrowRight");
  } else {
    await activateCanvasPoint(page, method, 375, 320);
    await expect.poll(() => readTexts(page)).toEqual(expect.arrayContaining(["MISSION BOARD"]));
    await activateCanvasPoint(page, method, 240, 65);
  }
  await expect.poll(() => readTexts(page)).toEqual(expect.arrayContaining(["SPECIAL OPS"]));
}

async function activateKepler(page: Page, method: InputMethod): Promise<void> {
  await clearTexts(page);
  if (method === "keyboard") await tapKey(page, "Enter");
  else await activateCanvasPoint(page, method, 240, 120);
}

const fixtures: Record<PolicyState, SaveData> = {
  locked,
  unlocked,
  "first-clear": unlocked,
  cleared,
};

for (const method of ["keyboard", "pointer", "touch"] as const) {
  const tag = `@${method}`;
  for (const state of ["locked", "unlocked", "first-clear", "cleared"] as const) {
    test(`${tag} Kepler ${state} Mission Board policy`, async ({ page }, testInfo: TestInfo) => {
      await enterSpecialBoard(page, fixtures[state], method);

      if (state === "locked") {
        await expect.poll(() => readTexts(page)).toEqual(
          expect.arrayContaining(["No special missions unlocked."]),
        );
      } else if (state === "unlocked") {
        await expect.poll(() => readTexts(page)).toEqual(
          expect.arrayContaining(["Kepler Black Box", "[ENTER] LAUNCH"]),
        );
      } else if (state === "first-clear") {
        await activateKepler(page, method);
        await expect.poll(() => readTexts(page)).toEqual(
          expect.arrayContaining(["WORLD 4 - LEVEL 2"]),
        );
      } else {
        await expect.poll(() => readTexts(page)).toEqual(
          expect.arrayContaining(["Kepler Black Box", "✓ CLEARED"]),
        );
        await activateKepler(page, method);
        await expect.poll(() => readTexts(page)).toEqual(
          expect.arrayContaining(["MISSION BOARD", "✓ CLEARED"]),
        );
        expect(await readTexts(page)).not.toContain("WORLD 4 - LEVEL 2");
      }

      await attachBrowserReceipt(testInfo, {
        route: `experience-selector -> legacy-cockpit -> Mission Board -> Special Ops -> ${state}`,
        inputMethod: method,
        saveFixture: state === "locked" ? "freshLegacy" : state === "cleared" ? "keplerCleared" : "keplerUnlocked",
        expectedOutcome: state === "first-clear"
          ? "The enabled one-shot Kepler row launches its first-clear attempt."
          : state === "cleared"
            ? "Cleared Kepler remains visible and cannot create another attempt."
            : `The ${state} Kepler board state is presented without crossing policy.`,
        observedOutcome: state === "first-clear"
          ? "The real Mission Board activation entered the shipped World 4 Level 2 Kepler compatibility briefing."
          : state === "cleared"
            ? "The row remained CLEARED and activation stayed on the Mission Board."
            : `The real Mission Board rendered the ${state} policy state.`,
      });
    });
  }
}

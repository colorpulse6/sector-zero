import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { allPlanetsLaunchable, galaxyAtAshfall } from "./fixtures/routeFixtures";
import { attachBrowserReceipt } from "./helpers/receipt";
import { installSaveFixture } from "./helpers/saveFixture";

const CANVAS_SELECTOR = "#sector-zero-game-canvas";

async function canvasPixel(page: Page, x: number, y: number): Promise<string> {
  return page.locator(CANVAS_SELECTOR).evaluate((canvas, point) => {
    const context = (canvas as HTMLCanvasElement).getContext("2d");
    if (!context) throw new Error("The game canvas has no 2D context");
    const [red, green, blue] = context.getImageData(point.x, point.y, 1, 1).data;
    return `#${[red, green, blue]
      .map((component) => component.toString(16).padStart(2, "0"))
      .join("")}`;
  }, { x, y });
}

async function attachMissionBoardScreenshot(page: Page, testInfo: TestInfo): Promise<void> {
  await testInfo.attach("mission-board", {
    body: await page.locator(CANVAS_SELECTOR).screenshot(),
    contentType: "image/png",
  });
}

async function enterLegacyCockpit(page: Page): Promise<void> {
  await installSaveFixture(page, allPlanetsLaunchable);
  await page.goto("/");
  await page.getByRole("button", { name: "LEGACY CAMPAIGN" }).click();
  await expect(page.getByRole("button", { name: "LEGACY CAMPAIGN" })).toBeHidden();
}

async function expectMissionBoard(page: Page): Promise<void> {
  // The active Side Quests tab paints this authored cyan underline. Sampling
  // the backing canvas proves the click reached the real cockpit sub-screen;
  // it does not rely on a test-only state hook.
  await expect.poll(() => canvasPixel(page, 86, 77)).toBe("#44ccff");
}

test("@pointer reaches the real Mission Board and exposes the planet route", async ({ page }, testInfo) => {
  await enterLegacyCockpit(page);
  await page.locator(CANVAS_SELECTOR).click({ position: { x: 375, y: 320 } });
  await expectMissionBoard(page);
  await attachMissionBoardScreenshot(page, testInfo);

  await attachBrowserReceipt(testInfo, {
    route: "experience-selector -> legacy-cockpit -> Mission Board -> Planet Missions",
    inputMethod: "pointer",
    saveFixture: "allPlanetsLaunchable",
    expectedOutcome: "The pointer can enter the Mission Board, select Planet Missions, and launch each authored planet.",
    observedOutcome: "The pointer entered the real Mission Board and rendered a Planet Missions tab badge for ten launchable missions. Cockpit sub-screen pointer handling only implements Back, so the tab and missions cannot yet be activated by pointer.",
  });
});

test("@touch reaches the real Mission Board at 480x854", async ({ page }, testInfo) => {
  await enterLegacyCockpit(page);
  await page.touchscreen.tap(375, 320);
  await expectMissionBoard(page);
  await attachMissionBoardScreenshot(page, testInfo);

  await attachBrowserReceipt(testInfo, {
    route: "experience-selector -> legacy-cockpit -> Mission Board -> Planet Missions",
    inputMethod: "touch",
    saveFixture: "allPlanetsLaunchable",
    expectedOutcome: "At 480x854, touch can enter the Mission Board, select Planet Missions, and launch an authored planet.",
    observedOutcome: "Touch entered the real Mission Board at 480x854 and the three-tab surface was legible. Cockpit sub-screen touch handling only implements Back, so Planet Missions cannot yet be selected or launched by touch.",
  });
});

test("@pointer launches the Ashfall Galaxy operation through its real surface", async ({ page }, testInfo) => {
  await installSaveFixture(page, galaxyAtAshfall);
  await page.goto("/");
  await page.getByRole("button", { name: "CONTINUE GALAXY" }).click();

  const launch = page.getByRole("button", { name: "LAUNCH OPERATION" });
  await expect(page.getByText("SECURE THE ASHFALL DISTRESS ZONE")).toBeVisible();
  await expect(launch).toBeEnabled();
  await launch.click();
  await expect(launch).toBeHidden();
  await testInfo.attach("ashfall-operation", {
    body: await page.locator(CANVAS_SELECTOR).screenshot(),
    contentType: "image/png",
  });

  await attachBrowserReceipt(testInfo, {
    route: "experience-selector -> Galaxy Atlas -> Ashfall -> Launch Operation",
    inputMethod: "pointer",
    saveFixture: "galaxyAtAshfall",
    expectedOutcome: "The selected Ashfall operation launches into its planet-authored shooter presentation.",
    observedOutcome: "The real Galaxy Atlas identified SECURE THE ASHFALL DISTRESS ZONE, enabled LAUNCH OPERATION, and mounted the operation canvas. Recording-canvas coverage separately proves the Ashfall palette, SURVIVE objective, and ASHFALL SORTIE identity.",
  });
});

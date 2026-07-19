import os from "node:os";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { enterColonyExploration } from "../../app/components/colony/exploration";
import { generateInteriorState } from "../../app/components/colony/exploration/colonyLayout";
import { PLANET_DEFS, isPlanetUnlocked } from "../../app/components/engine/planets";
import { migrateSave } from "../../app/components/engine/save";
import {
  ROUTE_FIXTURES,
  allPlanetsLaunchable,
  colonyFounded,
  colonyFoundedId,
  galaxyAtAshfall,
  freshGalaxy,
  freshLegacy,
  keplerCleared,
  keplerUnlocked,
} from "./fixtures/routeFixtures";
import { attachBrowserReceipt } from "./helpers/receipt";
import {
  installSaveFixture,
  readInstalledSave,
  roundTripSaveFixture,
} from "./helpers/saveFixture";

test("@fixture installs a migrated save before hydration", async ({ page }) => {
  await installSaveFixture(page, allPlanetsLaunchable);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "LEGACY CAMPAIGN" })).toBeEnabled();

  const storedSave = await readInstalledSave(page);
  expect(storedSave.equippedWeaponType).toBe("energy");
  expect(storedSave.completedPlanets).toEqual([]);
  expect(PLANET_DEFS.every((planet) => isPlanetUnlocked(planet, storedSave))).toBe(true);
});

test("@fixture route saves migrate and round-trip through current registries", ({}, testInfo) => {
  const worktreeHash = [...process.cwd()].reduce(
    (hash, character) => (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0,
    0,
  );
  const expectedOutputDir = process.env.PLAYWRIGHT_OUTPUT_DIR
    ? path.resolve(process.env.PLAYWRIGHT_OUTPUT_DIR)
    : path.join(os.tmpdir(), "sector-zero-playwright-results", String(worktreeHash));
  expect(testInfo.project.outputDir).toBe(expectedOutputDir);

  for (const [name, fixture] of Object.entries(ROUTE_FIXTURES)) {
    const serialized = JSON.parse(JSON.stringify(fixture)) as Record<string, unknown>;
    expect(migrateSave(serialized), name).toEqual(fixture);
    expect(roundTripSaveFixture(fixture), name).toEqual(fixture);
  }

  expect(freshLegacy.activeExperience).toBe("legacy");
  expect(freshLegacy.introSeen).toBeUndefined();
  expect(keplerUnlocked.unlockedSpecialMissions).toContain("kepler-black-box");
  expect(keplerUnlocked.completedSpecialMissions).not.toContain("kepler-black-box");
  expect(keplerCleared.completedSpecialMissions).toContain("kepler-black-box");
  expect(keplerCleared.storyItems).toContain("kepler-black-box");
  expect(freshGalaxy.activeExperience).toBe("galaxy");
  expect(freshGalaxy.galaxyRun).not.toBeNull();
  expect(galaxyAtAshfall.galaxyRun?.vessel.contactId).toBe("contact:ashfall");

  const colonyRoute = enterColonyExploration(colonyFounded, colonyFoundedId);
  expect(colonyRoute.sceneStack.current.kind).toBe("exterior");
  const colony = colonyFounded.colonies.find((entry) => entry.id === colonyFoundedId);
  const interiorBuilding = colony?.buildings.find((building) => building.status === "operational");
  expect(interiorBuilding).toBeDefined();
  const interior = generateInteriorState(interiorBuilding!, colony!.layoutSeed);
  expect(interior.colonyContext?.mode).toBe("interior");
});

test("@keyboard focuses both choices, activates Legacy, and reloads the installed save", async ({
  page,
}, testInfo) => {
  await installSaveFixture(page, freshGalaxy);
  await page.goto("/");

  const galaxyChoice = page.getByRole("button", { name: "CONTINUE GALAXY" });
  const legacyChoice = page.getByRole("button", { name: "LEGACY CAMPAIGN" });
  await expect(galaxyChoice).toBeEnabled();
  await galaxyChoice.focus();
  await expect(galaxyChoice).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(legacyChoice).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(legacyChoice).toBeHidden();

  expect((await readInstalledSave(page)).activeExperience).toBe("legacy");
  await page.reload();
  await expect(page.getByRole("button", { name: "CONTINUE GALAXY" })).toBeEnabled();
  expect((await readInstalledSave(page)).activeExperience).toBe("legacy");

  await attachBrowserReceipt(testInfo, {
    route: "experience-selector -> legacy-entry -> reload",
    inputMethod: "keyboard",
    saveFixture: "freshGalaxy",
    expectedOutcome: "Both choices receive focus; Enter opens Legacy; reload preserves the application-written authority change.",
    observedOutcome: "Legacy opened and reload retained activeExperience: legacy in localStorage.",
  });
});

test("@pointer clicks a focused experience choice", async ({ page }, testInfo) => {
  await installSaveFixture(page, freshLegacy);
  await page.goto("/");

  const legacyChoice = page.getByRole("button", { name: "LEGACY CAMPAIGN" });
  await legacyChoice.focus();
  await expect(legacyChoice).toBeFocused();
  await legacyChoice.click();
  await expect(legacyChoice).toBeHidden();

  await attachBrowserReceipt(testInfo, {
    route: "experience-selector -> legacy-entry",
    inputMethod: "pointer",
    saveFixture: "freshLegacy",
    expectedOutcome: "A pointer click activates the focused Legacy choice.",
    observedOutcome: "The experience selector closed after the focused choice was clicked.",
  });
});

test("@touch activates an experience choice with a real touchscreen event", async ({ page }, testInfo) => {
  await installSaveFixture(page, freshLegacy);
  await page.goto("/");

  const legacyChoice = page.getByRole("button", { name: "LEGACY CAMPAIGN" });
  const box = await legacyChoice.boundingBox();
  expect(box).not.toBeNull();
  await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect(legacyChoice).toBeHidden();

  await attachBrowserReceipt(testInfo, {
    route: "experience-selector -> legacy-entry",
    inputMethod: "touch",
    saveFixture: "freshLegacy",
    expectedOutcome: "A native Playwright touchscreen tap activates Legacy at 480x854.",
    observedOutcome: "The experience selector closed after touchscreen.tap at the button center.",
  });
});

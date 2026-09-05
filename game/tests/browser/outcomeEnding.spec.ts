import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";

import { freshLegacy } from "./fixtures/routeFixtures";
import {
  installOutcomeWriteProbe,
  readOutcomeWriteObservations,
} from "./helpers/outcomeWriteProbe";
import { attachBrowserReceipt } from "./helpers/receipt";
import { installSaveFixture, readInstalledSave } from "./helpers/saveFixture";

const CANVAS = "#sector-zero-game-canvas";

declare global {
  interface Window {
    __sectorZeroEndingTexts?: string[];
  }
}

async function observeCanvasText(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const texts: string[] = [];
    Object.defineProperty(window, "__sectorZeroEndingTexts", { value: texts });
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function observed(text, x, y, maxWidth): void {
      texts.push(String(text));
      if (texts.length > 4_000) texts.splice(0, 2_000);
      if (maxWidth === undefined) original.call(this, text, x, y);
      else original.call(this, text, x, y, maxWidth);
    };
  });
}

async function readTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => [...(window.__sectorZeroEndingTexts ?? [])]);
}

async function clearTexts(page: Page): Promise<void> {
  await page.evaluate(() => { window.__sectorZeroEndingTexts!.length = 0; });
}

test("@pointer final campaign save retry preserves the ending until its return is acknowledged", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await observeCanvasText(page);
  await installSaveFixture(page, { ...freshLegacy, introSeen: true });
  await installOutcomeWriteProbe(page, { commit: 1 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "LEGACY CAMPAIGN", exact: true })).toBeEnabled();

  // These are the shipped developer controls; the terminal result still comes
  // from actual projectiles defeating the authored final boss.
  await page.getByRole("button", { name: "DEV", exact: true }).click();
  await page.getByRole("button", { name: "8-5", exact: true }).click();
  await page.getByRole("button", { name: "GOD ON", exact: true }).click();
  await page.getByRole("button", { name: "MAX WPN", exact: true }).click();
  await page.getByRole("button", { name: "SKIP BRIEF", exact: true }).click();
  await page.getByRole("button", { name: "SPAWN BOSS", exact: true }).click();
  await page.getByRole("button", { name: "X", exact: true }).click();
  await page.locator(CANVAS).focus();
  await page.keyboard.down("z");
  const status = page.getByRole("alert", { name: "Outcome persistence status" });
  try {
    await expect(status).toContainText("OUTCOME SAVE FAILED · RETRY", { timeout: 60_000 });
  } catch (error) {
    const diagnosticPath = testInfo.outputPath("ending-terminal-diagnostics.json");
    await writeFile(diagnosticPath, JSON.stringify({
      pageErrors,
      writes: await readOutcomeWriteObservations(page),
      save: await readInstalledSave(page),
      canvasTexts: await readTexts(page),
    }, null, 2));
    await testInfo.attach("ending-terminal-diagnostics", {
      path: diagnosticPath,
      contentType: "application/json",
    });
    throw error;
  } finally {
    await page.keyboard.up("z");
  }

  const failedCommit = (await readOutcomeWriteObservations(page)).find((entry) =>
    entry.kind === "commit" && entry.failed);
  expect(failedCommit?.outcomeId).toMatch(/:success$/);
  expect((await readInstalledSave(page)).appliedOutcomeIds).not.toContain(failedCommit?.outcomeId);

  await clearTexts(page);
  await status.getByRole("button", { name: "RETRY OUTCOME", exact: true }).click();
  await expect(status).toBeHidden();
  await expect.poll(() => readTexts(page)).toContain("The Hollow Mind convulsed.");

  const committed = await readInstalledSave(page);
  const receipt = committed.outcomeRecoveryRecords.find((record) =>
    record.kind === "applied_return" && record.outcomeId === failedCommit?.outcomeId);
  expect(receipt).toEqual(expect.objectContaining({
    kind: "applied_return",
    returnPending: true,
    routeIdentity: { kind: "campaign", world: 8, level: 5 },
  }));
  expect((await readOutcomeWriteObservations(page)).filter((entry) =>
    entry.kind === "acknowledgement")).toHaveLength(0);

  await page.locator(CANVAS).focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => readTexts(page)).toContain("DESTROY THE HOLLOW MIND");
  await page.keyboard.press("Enter");
  await expect.poll(() => readTexts(page)).toContain("The final volley tore through");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");

  await expect.poll(async () => {
    const returned = (await readInstalledSave(page)).outcomeRecoveryRecords.find((record) =>
      record.kind === "applied_return" && record.outcomeId === failedCommit?.outcomeId);
    return returned?.kind === "applied_return" ? returned.returnPending : null;
  }).toBe(false);
  const observations = await readOutcomeWriteObservations(page);
  expect(observations.filter((entry) => entry.kind === "commit").map((entry) => entry.outcomeId))
    .toEqual([failedCommit?.outcomeId, failedCommit?.outcomeId]);
  expect(observations.filter((entry) => entry.kind === "acknowledgement"))
    .toEqual([expect.objectContaining({ outcomeId: failedCommit?.outcomeId, failed: false })]);
  expect(pageErrors).toEqual([]);

  await attachBrowserReceipt(testInfo, {
    route: "Legacy 8-5 -> authored boss defeat -> failed outcome save -> retry -> ending -> owned return",
    inputMethod: "pointer",
    saveFixture: "freshLegacy + shipped final campaign launcher and combat controls",
    expectedOutcome: "Persistence retry preserves the ending and the same outcome ID; the return is acknowledged exactly once after the ending finishes.",
    observedOutcome: `The ending retained pending outcome ${failedCommit?.outcomeId} until its final return, then acknowledged it once.`,
  });
});

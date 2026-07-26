import { expect, test, type Page, type TestInfo } from "@playwright/test";

import {
  galaxyAtAshfall,
  pendingGalaxyPoiReturn,
} from "./fixtures/routeFixtures";
import {
  installOutcomeWriteProbe,
  readOutcomeWriteObservations,
} from "./helpers/outcomeWriteProbe";
import { attachBrowserReceipt } from "./helpers/receipt";
import {
  installSaveFixture,
  readInstalledSave,
  SAVE_STORAGE_KEY,
} from "./helpers/saveFixture";

const CANVAS = "#sector-zero-game-canvas";

declare global {
  interface Window {
    __sectorZeroOutcomeTexts?: string[];
  }
}

async function observeCanvasText(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const texts: string[] = [];
    Object.defineProperty(window, "__sectorZeroOutcomeTexts", {
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
      if (texts.length > 2_000) texts.splice(0, 1_000);
      if (maxWidth === undefined) original.call(this, text, x, y);
      else original.call(this, text, x, y, maxWidth);
    };
  });
}

async function readCanvasTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => [...(window.__sectorZeroOutcomeTexts ?? [])]);
}

async function launchAndPauseAshfallOperation(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "CONTINUE GALAXY" }).click();
  const launch = page.getByRole("button", { name: "LAUNCH OPERATION" });
  await expect(launch).toBeEnabled();
  await launch.click();
  await expect(launch).toBeHidden();
  await expect.poll(() => readCanvasTexts(page)).toContain("ASHFALL SORTIE");
  await page.keyboard.press("Enter");
  await expect.poll(() => readCanvasTexts(page)).toContain("SURVIVE");
  await page.keyboard.press("p");
  await expect(page.getByRole("heading", { name: "PAUSED" })).toBeVisible();
  await expect(page.getByRole("button", { name: "RETURN TO ATLAS" })).toBeVisible();
}

function pendingReceipt(save: Awaited<ReturnType<typeof readInstalledSave>>) {
  return save.outcomeRecoveryRecords.find((record) =>
    record.kind === "applied_return" && record.returnPending);
}

test("@pointer Galaxy operation retreat retries one outcome and acknowledges only after Atlas mount", async ({
  page,
}, testInfo: TestInfo) => {
  await observeCanvasText(page);
  await installSaveFixture(page, galaxyAtAshfall);
  await installOutcomeWriteProbe(page, { commit: 1, acknowledgement: 1 });
  await launchAndPauseAshfallOperation(page);

  await page.keyboard.press("Escape");
  const status = page.getByRole("alert", { name: "Outcome persistence status" });
  await expect(status).toContainText("OUTCOME SAVE FAILED · RETRY");
  const firstCommit = (await readOutcomeWriteObservations(page)).find((entry) =>
    entry.kind === "commit" && entry.failed);
  expect(firstCommit?.outcomeId).toMatch(/:retreat$/);
  expect(pendingReceipt(await readInstalledSave(page))).toBeUndefined();

  await status.getByRole("button", { name: "RETRY OUTCOME" }).click();
  await expect(status).toContainText("OUTCOME RETURN SAVE FAILED · RETRY");
  await expect(page.getByRole("dialog", { name: "Galaxy Atlas" })).toBeAttached();

  const pending = pendingReceipt(await readInstalledSave(page));
  expect(pending?.kind).toBe("applied_return");
  if (pending?.kind !== "applied_return") throw new Error("Retreat receipt was not persisted");
  expect(pending.returnTarget).toBe("galaxy-atlas");
  expect(pending.outcomeId).toBe(firstCommit?.outcomeId);

  const observations = await readOutcomeWriteObservations(page);
  const commitIds = observations
    .filter((entry) => entry.kind === "commit")
    .map((entry) => entry.outcomeId);
  expect(commitIds).toEqual([pending.outcomeId, pending.outcomeId]);
  expect(observations).toEqual(expect.arrayContaining([
    expect.objectContaining({
      kind: "acknowledgement",
      outcomeId: pending.outcomeId,
      failed: true,
      atlasMounted: true,
    }),
  ]));

  await status.getByRole("button", { name: "RETRY OUTCOME" }).click();
  await expect(status).toBeHidden();
  await expect(page.getByRole("dialog", { name: "Galaxy Atlas" })).toBeVisible();
  await expect.poll(async () => {
    const receipt = (await readInstalledSave(page)).outcomeRecoveryRecords.find((record) =>
      record.kind === "applied_return" && record.outcomeId === pending.outcomeId);
    return receipt?.kind === "applied_return" ? receipt.returnPending : null;
  }).toBe(false);

  await attachBrowserReceipt(testInfo, {
    route: "Galaxy Atlas -> Ashfall operation -> pause -> retreat -> retry -> Atlas acknowledgement",
    inputMethod: "pointer",
    saveFixture: "galaxyAtAshfall",
    expectedOutcome: "A failed retreat write retries the identical outcome, mounts the exact Atlas return, and keeps the receipt pending until acknowledgement succeeds.",
    observedOutcome: `Commit retry and mounted acknowledgement used ${pending.outcomeId}; the receipt closed only after RETRY OUTCOME.`,
  });
});

test("@pointer stale Galaxy operation retreat preserves the newer save and reloads it", async ({
  page,
}, testInfo: TestInfo) => {
  await observeCanvasText(page);
  await installSaveFixture(page, galaxyAtAshfall);
  await launchAndPauseAshfallOperation(page);

  const newer = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (raw === null) throw new Error("No installed save to advance");
    const save = JSON.parse(raw) as {
      saveRevision: number;
      credits: number;
      galaxyRun: { worldCycle: number } | null;
    };
    if (save.galaxyRun === null) throw new Error("Installed save has no Galaxy run");
    save.saveRevision += 1;
    save.credits += 431;
    save.galaxyRun.worldCycle += 1;
    localStorage.setItem(key, JSON.stringify(save));
    return {
      saveRevision: save.saveRevision,
      credits: save.credits,
      worldCycle: save.galaxyRun.worldCycle,
    };
  }, SAVE_STORAGE_KEY);

  await page.keyboard.press("Escape");
  const status = page.getByRole("alert", { name: "Outcome persistence status" });
  await expect(status).toContainText("OUTCOME CONFLICT · RELOAD TO RECONCILE");
  await expect(status.getByRole("button", { name: "RETRY OUTCOME" })).toHaveCount(0);

  const preserved = await readInstalledSave(page);
  expect(preserved.saveRevision).toBe(newer.saveRevision);
  expect(preserved.credits).toBe(newer.credits);
  expect(preserved.galaxyRun?.worldCycle).toBe(newer.worldCycle);
  expect(preserved.appliedOutcomeIds.some((id) => id.endsWith(":retreat"))).toBe(false);

  await status.getByRole("button", { name: "RELOAD TO RECONCILE" }).click();
  await expect(page.getByRole("button", { name: "CONTINUE GALAXY" })).toBeVisible();
  const reloaded = await readInstalledSave(page);
  expect(reloaded.saveRevision).toBe(newer.saveRevision);
  expect(reloaded.credits).toBe(newer.credits);
  expect(reloaded.galaxyRun?.worldCycle).toBe(newer.worldCycle);
  await page.getByRole("button", { name: "CONTINUE GALAXY" }).click();
  await expect(page.getByRole("dialog", { name: "Galaxy Atlas" })).toBeVisible();

  await attachBrowserReceipt(testInfo, {
    route: "Galaxy Atlas -> Ashfall operation -> stale pause retreat -> reload",
    inputMethod: "pointer",
    saveFixture: "galaxyAtAshfall + newer canonical revision",
    expectedOutcome: "A stale terminal callback cannot overwrite a newer Galaxy save; reload adopts the newer authority.",
    observedOutcome: `Conflict preserved revision ${newer.saveRevision}, credits ${newer.credits}, and Galaxy cycle ${newer.worldCycle}; reload returned to the same run.`,
  });
});

test("@pointer pending Galaxy POI return reloads the exact Ashfall Region before acknowledgement", async ({
  page,
}, testInfo: TestInfo) => {
  const fixture = pendingGalaxyPoiReturn();
  const expected = pendingReceipt(fixture);
  expect(expected?.kind).toBe("applied_return");
  if (expected?.kind !== "applied_return") throw new Error("POI fixture has no pending receipt");
  await installSaveFixture(page, fixture);
  await installOutcomeWriteProbe(page, { acknowledgement: 1 });

  await page.goto("/");
  const region = page.getByRole("dialog", { name: "Region map" });
  await expect(region).toBeAttached();
  await expect(region.getByRole("heading", { name: "ASHFALL REGION" })).toBeVisible();
  await expect(region.getByText(/PAD LINK —/)).toBeVisible();
  const status = page.getByRole("alert", { name: "Outcome persistence status" });
  await expect(status).toContainText("OUTCOME RETURN SAVE FAILED · RETRY");

  const stillPending = pendingReceipt(await readInstalledSave(page));
  expect(stillPending?.kind).toBe("applied_return");
  if (stillPending?.kind !== "applied_return") throw new Error("POI return was acknowledged too early");
  expect(stillPending.outcomeId).toBe(expected.outcomeId);
  expect(stillPending.returnTarget).toBe("galaxy-region");
  expect(stillPending.routeIdentity).toEqual(expect.objectContaining({
    kind: "poi",
    originColonyId: "galaxy:ashfall-primary",
    nodeId: "ashfall-cinder-relay",
  }));
  expect(await readOutcomeWriteObservations(page)).toEqual(expect.arrayContaining([
    expect.objectContaining({
      kind: "acknowledgement",
      outcomeId: expected.outcomeId,
      failed: true,
      regionMounted: true,
    }),
  ]));

  await status.getByRole("button", { name: "RETRY OUTCOME" }).click();
  await expect(status).toBeHidden();
  await expect(region).toBeVisible();
  await expect.poll(async () => {
    const receipt = (await readInstalledSave(page)).outcomeRecoveryRecords.find((record) =>
      record.kind === "applied_return" && record.outcomeId === expected.outcomeId);
    return receipt?.kind === "applied_return" ? receipt.returnPending : null;
  }).toBe(false);

  await attachBrowserReceipt(testInfo, {
    route: "reload pending Galaxy POI receipt -> Ashfall Region -> acknowledgement retry",
    inputMethod: "pointer",
    saveFixture: "pendingGalaxyPoiReturn",
    expectedOutcome: "Reload mounts the receipt's exact Galaxy Region before acknowledgement can close it.",
    observedOutcome: `Ashfall Region for galaxy:ashfall-primary mounted while ${expected.outcomeId} remained pending, then the acknowledgement retry closed it.`,
  });
});

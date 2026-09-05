import { expect, test, type Page, type TestInfo } from "@playwright/test";

import {
  allPlanetsLaunchable,
  galaxyAtAshfall,
  galaxyWithLegacyProgression,
  pendingGalaxyPoiReturn,
  pendingLegacyPlanetReturn,
} from "./fixtures/routeFixtures";
import {
  installOutcomeWriteProbe,
  readOutcomeWriteObservations,
} from "./helpers/outcomeWriteProbe";
import { attachBrowserReceipt } from "./helpers/receipt";
import {
  installSaveFixture,
  readInstalledSave,
  readLegacyDomainBytes,
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
  await page.getByRole("button", { name: "⏸" }).click();
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
  await installSaveFixture(page, galaxyWithLegacyProgression(galaxyAtAshfall));
  await installOutcomeWriteProbe(page, { commit: 1, acknowledgement: 1 });
  await launchAndPauseAshfallOperation(page);
  const legacyBytes = await readLegacyDomainBytes(page);

  await page.getByRole("button", { name: "RETURN TO ATLAS" }).click();
  const status = page.getByRole("alert", { name: "Outcome persistence status" });
  await expect(status).toContainText("OUTCOME SAVE FAILED · RETRY");
  const firstCommit = (await readOutcomeWriteObservations(page)).find((entry) =>
    entry.kind === "commit" && entry.failed);
  expect(firstCommit?.outcomeId).toMatch(/:retreat$/);
  expect(pendingReceipt(await readInstalledSave(page))).toBeUndefined();
  await page.getByRole("button", { name: "RESUME", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "PAUSED" })).toBeVisible();

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

  await page.reload();
  await expect(page.getByRole("dialog", { name: "Galaxy Atlas" })).toBeAttached();
  await expect(status).toContainText("OUTCOME RETURN SAVE FAILED · RETRY");
  expect(pendingReceipt(await readInstalledSave(page))).toMatchObject({
    outcomeId: pending.outcomeId,
    returnPending: true,
    routeIdentity: { kind: "operation", operationId: "op:ashfall-sortie" },
  });
  expect((await readOutcomeWriteObservations(page)).filter((entry) => entry.kind === "commit"))
    .toHaveLength(0);
  expect(await readLegacyDomainBytes(page)).toBe(legacyBytes);
  await status.getByRole("button", { name: "RETRY OUTCOME" }).click();
  await expect(status).toBeHidden();
  await expect(page.getByRole("dialog", { name: "Galaxy Atlas" })).toBeVisible();
  await expect.poll(async () => {
    const receipt = (await readInstalledSave(page)).outcomeRecoveryRecords.find((record) =>
      record.kind === "applied_return" && record.outcomeId === pending.outcomeId);
    return receipt?.kind === "applied_return" ? receipt.returnPending : null;
  }).toBe(false);
  expect(await readLegacyDomainBytes(page)).toBe(legacyBytes);
  await page.reload();
  await page.getByRole("button", { name: "CONTINUE GALAXY" }).click();
  await expect(page.getByRole("dialog", { name: "Galaxy Atlas" })).toBeVisible();
  expect(await readLegacyDomainBytes(page)).toBe(legacyBytes);

  await attachBrowserReceipt(testInfo, {
    route: "Galaxy Atlas -> Ashfall operation -> pause -> retreat -> retry -> Atlas acknowledgement",
    inputMethod: "pointer",
    saveFixture: "galaxyAtAshfall",
    expectedOutcome: "A failed retreat write retries the identical outcome, mounts the exact Atlas return, and keeps the receipt pending until acknowledgement succeeds.",
    observedOutcome: `Commit retry and mounted acknowledgement used ${pending.outcomeId}; the receipt closed only after RETRY OUTCOME. Legacy bytes were unchanged through retreat, retries, and reload.`,
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

  await page.getByRole("button", { name: "RETURN TO ATLAS" }).click();
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
  const fixture = galaxyWithLegacyProgression(pendingGalaxyPoiReturn());
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
  const legacyBytes = await readLegacyDomainBytes(page);

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

  await region.getByRole("option").first().focus();
  await page.keyboard.press("Escape");
  await status.getByRole("button", { name: "RETRY OUTCOME" }).click();
  await expect(status).toBeHidden();
  await expect(region).toBeVisible();
  await expect.poll(async () => {
    const receipt = (await readInstalledSave(page)).outcomeRecoveryRecords.find((record) =>
      record.kind === "applied_return" && record.outcomeId === expected.outcomeId);
    return receipt?.kind === "applied_return" ? receipt.returnPending : null;
  }).toBe(false);
  expect(await readLegacyDomainBytes(page)).toBe(legacyBytes);

  await attachBrowserReceipt(testInfo, {
    route: "reload pending Galaxy POI receipt -> Ashfall Region -> acknowledgement retry",
    inputMethod: "pointer",
    saveFixture: "pendingGalaxyPoiReturn",
    expectedOutcome: "Reload mounts the receipt's exact Galaxy Region before acknowledgement can close it.",
    observedOutcome: `Ashfall Region for galaxy:ashfall-primary mounted while ${expected.outcomeId} remained pending, then the acknowledgement retry closed it.`,
  });
});

test("@pointer Legacy planet TRY AGAIN remounts gameplay with a new owned terminal", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => { pageErrors.push(error.stack ?? error.message); });
  await observeCanvasText(page);
  await installSaveFixture(page, allPlanetsLaunchable);
  await installOutcomeWriteProbe(page, {});
  await page.goto("/");
  await page.getByRole("button", { name: "LEGACY CAMPAIGN" }).click();
  await page.locator(CANVAS).click({ position: { x: 375, y: 320 } });
  await expect.poll(() => readCanvasTexts(page)).toContain("MISSION BOARD");
  await page.locator(CANVAS).click({ position: { x: 400, y: 65 } });
  await expect.poll(() => readCanvasTexts(page)).toContain("Ossuary");
  await page.locator(CANVAS).click({ position: { x: 240, y: 290 } });
  await page.keyboard.press("Enter");
  await expect.poll(() => readCanvasTexts(page)).toContain("DEFEND");

  // Leave the authored defense objective unprotected; no test-only gameplay
  // mutation is needed to reach a genuine terminal failure.
  await expect(page.getByRole("heading", { name: "GAME OVER" })).toBeVisible({ timeout: 120_000 });
  await page.evaluate(() => { window.__sectorZeroOutcomeTexts!.length = 0; });
  await page.getByRole("button", { name: "TRY AGAIN" }).click();
  await expect(page.getByRole("heading", { name: "GAME OVER" })).toBeHidden();
  const failureSave = await readInstalledSave(page);
  const failure = failureSave.outcomeRecoveryRecords.find((record) =>
    record.kind === "applied_return" && record.outcomeId.endsWith(":failure"));
  expect(failure).toMatchObject({
    kind: "applied_return",
    returnPending: false,
    routeIdentity: { kind: "planet", planetId: "ossuary" },
  });
  await expect.poll(() => readCanvasTexts(page)).toContain("WORLD 4 - LEVEL 1").catch(async (error) => {
    await testInfo.attach("retry-mount-diagnostics", {
      body: JSON.stringify({ pageErrors, save: await readInstalledSave(page), texts: await readCanvasTexts(page) }, null, 2),
      contentType: "application/json",
    });
    throw error;
  });
  await page.keyboard.press("Enter");
  await expect.poll(() => readCanvasTexts(page)).toContain("DEFEND").catch(async (error) => {
    await testInfo.attach("retry-page-errors", {
      body: JSON.stringify(pageErrors, null, 2),
      contentType: "application/json",
    });
    throw error;
  });
  await page.getByRole("button", { name: "⏸" }).click();
  await expect(page.getByRole("heading", { name: "PAUSED" })).toBeVisible();
  await page.getByRole("button", { name: "RETURN TO HUB" }).click();
  await expect(page.getByRole("heading", { name: "PAUSED" })).toBeHidden();
  const retried = await readInstalledSave(page);
  const retreat = retried.outcomeRecoveryRecords.find((record) =>
    record.kind === "applied_return" && record.outcomeId.endsWith(":retreat"));
  expect(retreat).toMatchObject({
    kind: "applied_return",
    returnPending: false,
    routeIdentity: { kind: "planet", planetId: "ossuary" },
  });
  if (retreat?.kind !== "applied_return" || failure?.kind !== "applied_return") {
    throw new Error("Retry did not retain its terminal receipts");
  }
  expect(retreat.outcomeId.split(":").slice(0, -1).join(":")).not.toBe(
    failure.outcomeId.split(":").slice(0, -1).join(":"),
  );
  await attachBrowserReceipt(testInfo, {
    route: "Legacy Mission Board -> Ossuary defense failure -> TRY AGAIN -> pause retreat",
    inputMethod: "pointer",
    saveFixture: "allPlanetsLaunchable",
    expectedOutcome: "A saved failure mounts a new playable Ossuary attempt; its next terminal retains the planet identity and receives a distinct outcome ID.",
    observedOutcome: "The real defense objective failed, TRY AGAIN resumed its DEFEND presentation, and pause retreat journaled a new Ossuary outcome.",
  });
});

test("@keyboard pending Legacy return blocks Escape until acknowledgement retry succeeds", async ({ page }, testInfo) => {
  const fixture = pendingLegacyPlanetReturn();
  const receipt = pendingReceipt(fixture);
  if (receipt?.kind !== "applied_return") throw new Error("Legacy fixture has no pending receipt");
  await observeCanvasText(page);
  await installSaveFixture(page, fixture);
  await installOutcomeWriteProbe(page, { acknowledgement: 1 });
  await page.goto("/");
  const status = page.getByRole("alert", { name: "Outcome persistence status" });
  await expect(status).toContainText("OUTCOME RETURN SAVE FAILED · RETRY");
  await expect.poll(() => readCanvasTexts(page)).toContain("STAR MAP");

  // A browser-level key event on the body reproduces a global shortcut. It
  // bypasses neither the UI nor the persistence boundary.
  await page.locator("body").press("Escape");
  await expect(status).toBeVisible();
  await status.getByRole("button", { name: "RETRY OUTCOME" }).click();
  await expect(status).toBeHidden();
  await expect.poll(async () => {
    const stored = (await readInstalledSave(page)).outcomeRecoveryRecords.find((record) =>
      record.kind === "applied_return" && record.outcomeId === receipt.outcomeId);
    return stored?.kind === "applied_return" ? stored.returnPending : null;
  }).toBe(false);
  await expect(page.getByRole("button", { name: "LEGACY CAMPAIGN" })).toBeHidden();
  await page.evaluate(() => { window.__sectorZeroOutcomeTexts!.length = 0; });
  await expect.poll(() => readCanvasTexts(page)).toContain("STAR MAP");
  await attachBrowserReceipt(testInfo, {
    route: "reload pending Legacy planet return -> acknowledgement failure -> Escape -> retry",
    inputMethod: "keyboard",
    saveFixture: "pendingLegacyPlanetReturn",
    expectedOutcome: "Escape cannot dismiss a pending owned return; retry closes its receipt with the Legacy cockpit still mounted.",
    observedOutcome: "The acknowledgement retry closed the saved Ossuary receipt and retained the cockpit after a body-focused Escape.",
  });
});

test("@pointer failed Ashfall operation exposes only terminal actions and journals once", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await observeCanvasText(page);
  await installSaveFixture(page, galaxyWithLegacyProgression(galaxyAtAshfall));
  await installOutcomeWriteProbe(page, {});
  await launchAndPauseAshfallOperation(page);
  const legacyBytes = await readLegacyDomainBytes(page);
  await page.getByRole("button", { name: "RESUME", exact: true }).click();
  // Fly into the authored enemy approach without firing. Failure is produced
  // by ordinary combat; no runtime state or clock mutation is involved.
  await page.keyboard.down("ArrowUp");
  try {
    await expect(page.getByRole("heading", { name: "GAME OVER" })).toBeVisible({ timeout: 150_000 });
  } finally {
    await page.keyboard.up("ArrowUp");
  }
  await expect(page.getByText("ASHFALL SORTIE", { exact: true })).toBeVisible();
  expect.soft(await page.getByRole("button", { name: "TRY AGAIN", exact: true }).count()).toBe(0);
  await page.getByRole("button", { name: "ATLAS", exact: true }).click();
  const atlas = page.getByRole("dialog", { name: "Galaxy Atlas" });
  await expect(atlas).toBeVisible();
  await expect(atlas.getByRole("button", { name: "LAUNCH OPERATION" })).toBeDisabled();
  await expect.poll(async () => {
    const saved = await readInstalledSave(page);
    const receipt = saved.outcomeRecoveryRecords.find((record) =>
      record.kind === "applied_return" && record.terminalKind === "failure");
    return receipt?.kind === "applied_return" ? receipt.returnPending : null;
  }).toBe(false);
  const saved = await readInstalledSave(page);
  const receipt = saved.outcomeRecoveryRecords.find((record) =>
    record.kind === "applied_return" && record.terminalKind === "failure");
  if (receipt?.kind !== "applied_return") throw new Error("Failed operation has no durable receipt");
  expect(receipt.routeIdentity).toEqual({ kind: "operation", operationId: "op:ashfall-sortie" });
  expect(saved.appliedOutcomeIds.filter((id) => id === receipt.outcomeId)).toHaveLength(1);
  expect(saved.galaxyRun?.appliedOutcomeIds.filter((id) => id === receipt.outcomeId)).toHaveLength(1);
  expect(saved.galaxyRun?.operations["op:ashfall-sortie"]).toMatchObject({
    state: "failed",
    completionIds: [receipt.outcomeId],
  });
  expect((await readOutcomeWriteObservations(page)).filter((entry) => entry.kind === "commit"))
    .toEqual([expect.objectContaining({ outcomeId: receipt.outcomeId, failed: false })]);
  expect(await readLegacyDomainBytes(page)).toBe(legacyBytes);
  await page.reload();
  await page.getByRole("button", { name: "CONTINUE GALAXY" }).click();
  await expect(atlas).toBeVisible();
  await expect(atlas.getByRole("button", { name: "LAUNCH OPERATION" })).toBeDisabled();
  expect((await readInstalledSave(page)).galaxyRun?.operations["op:ashfall-sortie"].completionIds)
    .toEqual([receipt.outcomeId]);
  expect(await readLegacyDomainBytes(page)).toBe(legacyBytes);
  await attachBrowserReceipt(testInfo, {
    route: "Ashfall operation -> authored combat failure -> ATLAS -> acknowledgement -> reload",
    inputMethod: "pointer",
    saveFixture: "galaxyAtAshfall + populated canonical Legacy progression",
    expectedOutcome: "A one-shot operation offers terminal actions after failure; Atlas return persists failure once and does not permit relaunch.",
    observedOutcome: `Authored combat failed and ATLAS closed ${receipt.outcomeId}; the catalog kept Ashfall unavailable with one completion ID and unchanged Legacy bytes after reload.`,
  });
});

import { expect, test } from "@playwright/test";

import {
  freshGalaxy,
  galaxyAtAshfall,
  galaxyTravelFixture,
  galaxyWithLegacyProgression,
} from "./fixtures/routeFixtures";
import { attachBrowserReceipt } from "./helpers/receipt";
import {
  installSaveFixture,
  readInstalledSave,
  readInstalledSaveBytes,
  readLegacyDomainBytes,
  SAVE_STORAGE_KEY,
} from "./helpers/saveFixture";
import {
  installTravelWriteProbe,
  readTravelWriteObservations,
} from "./helpers/travelWriteProbe";

test("@pointer Galaxy Region back and Atlas close preserve Legacy bytes through reload", async ({ page }, testInfo) => {
  await installSaveFixture(page, galaxyWithLegacyProgression(galaxyAtAshfall));
  await page.goto("/");
  const legacyBytes = await readLegacyDomainBytes(page);
  await page.getByRole("button", { name: "CONTINUE GALAXY" }).click();
  const atlas = page.getByRole("dialog", { name: "Galaxy Atlas" });
  await expect(atlas).toBeVisible();
  await page.getByRole("button", { name: "OPEN ASHFALL REGION" }).click();
  const region = page.getByRole("dialog", { name: "Region map" });
  await expect(region).toBeVisible();
  await region.getByRole("button", { name: "← RETURN TO ATLAS" }).click();
  await expect(region).toBeHidden();
  await expect(atlas).toBeVisible();
  await atlas.getByRole("button", { name: "← CLOSE ATLAS" }).click();
  await expect(atlas).toBeHidden();
  await expect(page.getByRole("button", { name: "LEGACY CAMPAIGN" })).toBeVisible();
  await expect(page.getByRole("button", { name: "CONTINUE GALAXY" })).toBeVisible();
  expect((await readInstalledSave(page)).activeExperience).toBe("galaxy");
  expect(await readLegacyDomainBytes(page)).toBe(legacyBytes);
  await page.reload();
  await page.getByRole("button", { name: "CONTINUE GALAXY" }).click();
  await expect(atlas).toBeVisible();
  expect((await readInstalledSave(page)).galaxyRun?.vessel.contactId).toBe("contact:ashfall");
  expect(await readLegacyDomainBytes(page)).toBe(legacyBytes);
  await attachBrowserReceipt(testInfo, {
    route: "Galaxy Atlas -> Ashfall Region -> back -> Atlas close -> selector -> reload -> Galaxy",
    inputMethod: "pointer",
    saveFixture: "galaxyAtAshfall + populated Legacy progression",
    expectedOutcome: "Closing Galaxy returns to the experience selector and preserves every serialized Legacy domain field.",
    observedOutcome: "Region back, Atlas close, and reloaded Ashfall Atlas retained identical serialized Legacy fields and Galaxy authority.",
  });
});

const travelCases = [
  { kind: "commit", stage: null, action: "COMMIT TRAVEL", state: "committed" },
  { kind: "resume", stage: "committed", action: "RESUME TRAVEL", state: "arrived" },
  { kind: "finalize", stage: "arrived", action: "ACKNOWLEDGE ARRIVAL", state: null },
  { kind: "retreat", stage: "diverted", action: "EMERGENCY RETREAT", state: "resolved" },
] as const;

for (const scenario of travelCases) {
  test(`@pointer Galaxy travel ${scenario.kind} write failure retries the same transaction`, async ({ page }, testInfo) => {
    const fixture = scenario.stage === null
      ? galaxyWithLegacyProgression(freshGalaxy)
      : galaxyTravelFixture(scenario.stage);
    await installSaveFixture(page, fixture);
    await installTravelWriteProbe(page, { [scenario.kind]: 1 });
    await page.goto("/");
    await page.getByRole("button", { name: "CONTINUE GALAXY" }).click();
    const legacyBytes = await readLegacyDomainBytes(page);
    const beforeBytes = await readInstalledSaveBytes(page);
    const atlas = page.getByRole("dialog", { name: "Galaxy Atlas" });
    await atlas.getByRole("button", { name: scenario.action, exact: true }).click();
    const status = page.getByRole("alert", { name: "Travel persistence status" });
    await expect(status).toContainText("TRAVEL SAVE FAILED · RETRY");
    expect(await readInstalledSaveBytes(page)).toBe(beforeBytes);
    const failed = (await readTravelWriteObservations(page)).find((entry) => entry.failed);
    expect(failed?.kind).toBe(scenario.kind);
    expect(failed?.beforeBytes).toBe(beforeBytes);
    await page.locator("body").press("Escape");
    await expect(status).toBeVisible();
    await expect(atlas).toBeAttached();
    await status.getByRole("button", { name: "RETRY TRAVEL SAVE" }).click();
    await expect(status).toBeHidden();
    await expect(atlas).toBeVisible();
    const attempts = (await readTravelWriteObservations(page)).filter((entry) => entry.kind === scenario.kind);
    expect(attempts).toHaveLength(2);
    expect(attempts.map((entry) => entry.failed)).toEqual([true, false]);
    expect(attempts[1].transactionId).toBe(attempts[0].transactionId);
    expect(attempts[1].candidateBytes).toBe(attempts[0].candidateBytes);
    expect(await readInstalledSaveBytes(page)).toBe(attempts[1].candidateBytes);
    expect((await readInstalledSave(page)).galaxyRun?.activeTravel?.state ?? null).toBe(scenario.state);
    expect(await readLegacyDomainBytes(page)).toBe(legacyBytes);
    await page.reload();
    await page.getByRole("button", { name: "CONTINUE GALAXY" }).click();
    await expect(atlas).toBeVisible();
    expect((await readInstalledSave(page)).galaxyRun?.activeTravel?.state ?? null).toBe(scenario.state);
    expect(await readLegacyDomainBytes(page)).toBe(legacyBytes);
    await attachBrowserReceipt(testInfo, {
      route: `Galaxy travel ${scenario.kind} -> failed storage write -> retry -> reload`,
      inputMethod: "pointer",
      saveFixture: scenario.stage === null ? "freshGalaxy + populated Legacy progression" : `galaxyTravelFixture(${scenario.stage})`,
      expectedOutcome: "A failed travel write preserves the canonical save and retries the exact candidate without duplicating transaction effects or changing Legacy progression.",
      observedOutcome: `The failed ${scenario.kind} candidate was persisted byte-for-byte on retry; transaction ${attempts[1].transactionId} and Legacy bytes survived reload.`,
    });
  });
}

test("@pointer stale Galaxy travel retry preserves the newer canonical save and reloads it", async ({ page }, testInfo) => {
  await installSaveFixture(page, galaxyWithLegacyProgression(freshGalaxy));
  await installTravelWriteProbe(page, { commit: 1 });
  await page.goto("/");
  await page.getByRole("button", { name: "CONTINUE GALAXY" }).click();
  await page.getByRole("button", { name: "COMMIT TRAVEL", exact: true }).click();
  const status = page.getByRole("alert", { name: "Travel persistence status" });
  await expect(status).toContainText("TRAVEL SAVE FAILED · RETRY");
  const newerBytes = await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key)!) as { saveRevision: number; credits: number };
    save.saveRevision += 1;
    save.credits += 431;
    const bytes = JSON.stringify(save);
    localStorage.setItem(key, bytes);
    return bytes;
  }, SAVE_STORAGE_KEY);
  await status.getByRole("button", { name: "RETRY TRAVEL SAVE" }).click();
  await expect(status).toContainText("TRAVEL SAVE CONFLICT · RELOAD TO RECONCILE");
  await expect(status.getByRole("button", { name: "RETRY TRAVEL SAVE" })).toHaveCount(0);
  expect(await readInstalledSaveBytes(page)).toBe(newerBytes);
  expect((await readTravelWriteObservations(page)).filter((entry) => entry.kind === "commit")).toHaveLength(1);
  await status.getByRole("button", { name: "RELOAD TO RECONCILE" }).click();
  await page.getByRole("button", { name: "CONTINUE GALAXY" }).click();
  await expect(page.getByRole("dialog", { name: "Galaxy Atlas" })).toBeVisible();
  expect(await readInstalledSaveBytes(page)).toBe(newerBytes);
  expect((await readInstalledSave(page)).galaxyRun?.activeTravel).toBeNull();
  await attachBrowserReceipt(testInfo, {
    route: "Galaxy travel commit write failure -> newer canonical save -> retry conflict -> reload",
    inputMethod: "pointer",
    saveFixture: "freshGalaxy + populated Legacy progression + newer revision",
    expectedOutcome: "Retry cannot overwrite newer canonical authority; conflict requires reload and preserves the newer bytes.",
    observedOutcome: "Retry made no second travel write, retained the newer save byte-for-byte, and reload mounted its uncommitted Galaxy run.",
  });
});

import { expect, test, type Page } from "@playwright/test";

import { pendingLegacyClassReturn, type LegacyReloadClass } from "./fixtures/outcomeFixtures";
import { installOutcomeWriteProbe } from "./helpers/outcomeWriteProbe";
import { attachBrowserReceipt } from "./helpers/receipt";
import { installSaveFixture, readInstalledSave, readLegacyDomainBytes } from "./helpers/saveFixture";

declare global {
  interface Window { __sectorZeroReloadTexts?: string[] }
}

async function observeReturnText(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const texts: string[] = [];
    Object.defineProperty(window, "__sectorZeroReloadTexts", { value: texts });
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function observed(text, x, y, maxWidth): void {
      texts.push(String(text));
      if (texts.length > 2_000) texts.splice(0, 1_000);
      if (maxWidth === undefined) original.call(this, text, x, y);
      else original.call(this, text, x, y, maxWidth);
    };
  });
}

const routes: readonly LegacyReloadClass[] = ["campaign", "special", "colony", "poi"];
for (const route of routes) {
  test(`@pointer reload restores the owned Legacy ${route} return without replaying effects`, async ({ page }, testInfo) => {
    const fixture = pendingLegacyClassReturn(route);
    const receipt = fixture.outcomeRecoveryRecords.find((record) => record.kind === "applied_return" && record.returnPending);
    if (receipt?.kind !== "applied_return") throw new Error(`${route} fixture has no pending receipt`);
    await observeReturnText(page);
    await installSaveFixture(page, fixture);
    await installOutcomeWriteProbe(page, { acknowledgement: 1 });
    await page.goto("/");
    const status = page.getByRole("alert", { name: "Outcome persistence status" });
    await expect(status).toContainText("OUTCOME RETURN SAVE FAILED · RETRY");
    const visibleText = route === "campaign"
      ? "SELECT SECTOR"
      : route === "poi"
        ? "← → TURN   ↑ ↓ / W S MOVE   A D STRAFE   Z INTERACT"
        : "UEC VANGUARD — BRIDGE";
    await expect.poll(() => page.evaluate(() => window.__sectorZeroReloadTexts ?? [])).toContain(visibleText);
    await expect(page.getByRole("button", { name: "LEGACY CAMPAIGN" })).toBeHidden();
    const before = await readInstalledSave(page);
    const domainBytes = await readLegacyDomainBytes(page);
    expect(before).toEqual(fixture);
    expect(before.outcomeRecoveryRecords).toEqual(expect.arrayContaining([expect.objectContaining({
      outcomeId: receipt.outcomeId,
      routeIdentity: receipt.routeIdentity,
      returnPending: true,
    })]));
    await status.getByRole("button", { name: "RETRY OUTCOME" }).click();
    await expect(status).toBeHidden();
    await expect.poll(async () => {
      const stored = (await readInstalledSave(page)).outcomeRecoveryRecords.find((record) =>
        record.kind === "applied_return" && record.outcomeId === receipt.outcomeId);
      return stored?.kind === "applied_return" ? stored.returnPending : null;
    }).toBe(false);
    const acknowledged = await readInstalledSave(page);
    expect(acknowledged.appliedOutcomeIds).toEqual(before.appliedOutcomeIds);
    expect(await readLegacyDomainBytes(page)).toBe(domainBytes);
    await page.reload();
    await expect(page.getByRole("button", { name: "LEGACY CAMPAIGN" })).toBeVisible();
    const reloaded = await readInstalledSave(page);
    expect(reloaded.appliedOutcomeIds).toEqual(acknowledged.appliedOutcomeIds);
    expect(reloaded.saveRevision).toBe(acknowledged.saveRevision);
    expect(await readLegacyDomainBytes(page)).toBe(domainBytes);
    await attachBrowserReceipt(testInfo, {
      route: `reload Legacy ${route} receipt -> ${receipt.returnTarget} -> failed acknowledgement -> retry -> reload`,
      inputMethod: "pointer",
      saveFixture: `pendingLegacyClassReturn(${route})`,
      expectedOutcome: "Reload restores the receipt's owned return, acknowledges only after mount, and never reapplies its effects.",
      observedOutcome: `The ${route} return rendered before its acknowledgement; retry and a second reload preserved domain bytes and the single outcome journal ID.`,
    });
  });
}

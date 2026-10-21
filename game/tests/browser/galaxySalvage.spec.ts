import { expect, test, type Page } from "@playwright/test";
import { galaxyAtAshfall, galaxyWithLegacyProgression, freshGalaxy } from "./fixtures/routeFixtures";
import { installSaveFixture, readInstalledSave, readInstalledSaveBytes, readLegacyDomainBytes, SAVE_STORAGE_KEY } from "./helpers/saveFixture";
import { SALVAGE_SHIFT } from "../../app/components/engine/galaxy/galaxySalvage";

const COLONY = "galaxy:ashfall-primary";
function emptyArrival() {
  const save = galaxyWithLegacyProgression(structuredClone(galaxyAtAshfall));
  save.galaxyRun!.resources.supply = 0;
  return save;
}
async function openManagement(page: Page) {
  await installSaveFixture(page, emptyArrival());
  await page.goto("/");
  await page.getByRole("button", { name: "CONTINUE GALAXY", exact: true }).click();
  await page.getByRole("button", { name: "MANAGE COLONY", exact: true }).click();
  return page.getByRole("dialog", { name: "Colony management", exact: true });
}

test("@keyboard salvage works from empty stocks; held input cannot repeat it; buildings and rewards survive reload", async ({ page }) => {
  const management = await openManagement(page);
  const before = await readInstalledSave(page); const legacy = await readLegacyDomainBytes(page);
  const work = management.getByRole("button", { name: "WORK A SALVAGE SHIFT", exact: true });
  await expect(management.getByRole("region", { name: "Salvage work" })).toContainText("No combat or supplies required");
  await work.focus();
  await page.keyboard.down("Enter");
  await expect.poll(async () => (await readInstalledSave(page)).galaxyRun!.worldCycle).toBe(before.galaxyRun!.worldCycle + 1);
  // Playwright sends a second down on a held key as a native repeat=true event.
  await page.keyboard.down("Enter");
  await page.keyboard.down("Enter");
  await page.keyboard.up("Enter");
  expect((await readInstalledSave(page)).galaxyRun!.worldCycle).toBe(before.galaxyRun!.worldCycle + 1);
  while ((await readInstalledSave(page)).galaxyRun!.colonies.find(c => c.id === COLONY)!.resources.metal < 80) {
    await work.focus(); await page.keyboard.press("Enter");
  }
  await management.getByRole("button", { name: "Build", exact: true }).click();
  await work.focus(); await page.keyboard.press("Enter");
  const built = await readInstalledSave(page);
  expect(built.galaxyRun!.colonies.find(c => c.id === COLONY)!.buildings[0]).toMatchObject({ type: "solar_array", status: "operational" });
  expect(await readLegacyDomainBytes(page)).toBe(legacy);
  await page.reload();
  await page.getByRole("button", { name: "CONTINUE GALAXY", exact: true }).click();
  await page.getByRole("button", { name: "MANAGE COLONY", exact: true }).click();
  expect((await readInstalledSave(page)).galaxyRun).toEqual(built.galaxyRun);
  await expect(management.getByText("operational", { exact: true })).toBeVisible();
});

test("@pointer salvage refuses unreadable, unwritable and stale storage without losing another writer's work", async ({ page }) => {
  const management = await openManagement(page);
  const work = management.getByRole("button", { name: "WORK A SALVAGE SHIFT", exact: true });
  const status = management.getByRole("status"); const original = (await readInstalledSaveBytes(page))!;
  await page.evaluate(key => localStorage.setItem(key, "{bad"), SAVE_STORAGE_KEY);
  await work.click();
  await expect(status).toHaveText("SAVE COULD NOT BE READ · NOTHING CHANGED");
  expect(await readInstalledSaveBytes(page)).toBe("{bad");
  await page.evaluate(({ key, original }) => localStorage.setItem(key, original), { key: SAVE_STORAGE_KEY, original });
  await page.evaluate(() => {
    (window as unknown as { realSetItem: typeof Storage.prototype.setItem }).realSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new DOMException("Quota exceeded", "QuotaExceededError"); };
  });
  await work.click();
  await expect(status).toHaveText("WORK SAVE FAILED · NOTHING CHANGED");
  expect(await readInstalledSaveBytes(page)).toBe(original);
  await page.evaluate(() => { Storage.prototype.setItem = (window as unknown as { realSetItem: typeof Storage.prototype.setItem }).realSetItem; });
  const newer = JSON.parse(original); newer.galaxyRun.resources.supply = 9;
  const newerBytes = JSON.stringify(newer);
  await page.evaluate(({ key, newerBytes }) => localStorage.setItem(key, newerBytes), { key: SAVE_STORAGE_KEY, newerBytes });
  await work.click();
  await expect(status).toHaveText("COLONY CHANGED · REVIEW AND TRY AGAIN");
  expect(await readInstalledSaveBytes(page)).toBe(newerBytes);
  await expect(management.getByRole("region", { name: "Salvage work" })).toContainText("Travel supply: 9");
  await work.click();
  expect((await readInstalledSave(page)).galaxyRun!.resources.supply).toBe(10);
});

test("@touch one salvage tap advances one cycle and delivers the displayed reward", async ({ page }) => {
  const management = await openManagement(page);
  const before = await readInstalledSave(page);
  await management.getByRole("button", { name: "WORK A SALVAGE SHIFT", exact: true }).tap();
  await expect(management.getByRole("status")).toHaveText(`SALVAGE COMPLETE · +${SALVAGE_SHIFT.metal} METAL · +1 TRAVEL SUPPLY · 1 CYCLE PASSED`);
  const after = await readInstalledSave(page);
  expect(after.galaxyRun!.worldCycle).toBe(before.galaxyRun!.worldCycle + 1);
  expect(after.galaxyRun!.colonies.find(c => c.id === COLONY)!.resources.metal).toBe(SALVAGE_SHIFT.metal);
  expect(after.galaxyRun!.resources.supply).toBe(1);
});

test("@pointer fresh galaxy reaches ten settlers through actual work/build controls, then departs and returns", async ({ page }, info) => {
  // CI completed the 25-shift route and final return capture at the old 120s
  // deadline. Allow the full UI journey and capture to finish on software WebGL.
  test.setTimeout(180_000);
  await installSaveFixture(page, freshGalaxy);
  await page.goto("/");
  await page.getByRole("button", { name: "CONTINUE GALAXY", exact: true }).click();
  const atlas = page.getByRole("dialog", { name: "Galaxy Atlas", exact: true });
  await atlas.locator('[data-atlas-contact="contact:ashfall"]').click();
  await atlas.getByRole("button", { name: "COMMIT TRAVEL", exact: true }).click();
  await atlas.getByRole("button", { name: "ACKNOWLEDGE ARRIVAL", exact: true }).click();
  const arrival = await readInstalledSave(page);
  const colony = (s: typeof arrival) => s.galaxyRun!.colonies.find(c => c.id === COLONY)!;
  expect(colony(arrival).resources.metal).toBe(0);
  const legacy = await readLegacyDomainBytes(page);
  await atlas.getByRole("button", { name: "MANAGE COLONY", exact: true }).click();
  const management = page.getByRole("dialog", { name: "Colony management", exact: true });
  const work = management.getByRole("button", { name: "WORK A SALVAGE SHIFT", exact: true });
  const queue = ["Solar Array", "Mine", "Habitat Module", "Farm", "Water Purifier"];
  let shifts = 0;
  while (shifts < 25 && colony(await readInstalledSave(page)).population.total < 10) {
    while (queue.length) {
      // The title's direct parent is the existing commission card.
      const title = management.locator("div").filter({ hasText: new RegExp(`^[^\\w]*${queue[0]}$`) }).last();
      const build = title.locator("..").getByRole("button", { name: "Build", exact: true });
      if (await build.count() === 0 || !await build.isEnabled()) break;
      await build.click(); queue.shift();
    }
    await work.click(); shifts++;
    await expect.poll(async () => (await readInstalledSave(page)).galaxyRun!.worldCycle).toBe(arrival.galaxyRun!.worldCycle + shifts);
  }
  expect(queue).toEqual([]);
  const settled = await readInstalledSave(page);
  expect(colony(settled).population.total).toBe(10);
  expect(colony(settled).buildings).toHaveLength(5);
  expect(colony(settled).buildings.every(b => b.status === "operational")).toBe(true);
  expect(await readLegacyDomainBytes(page)).toBe(legacy);
  await page.screenshot({ path: info.outputPath("ashfall-salvage-settlement.png"), fullPage: true });
  await info.attach("settlement-receipt", { body: JSON.stringify({ shifts, colony: colony(settled), startingMetal: 0, source: "real UI work/build actions; no expedition reward fixture" }, null, 2), contentType: "application/json" });
  await page.keyboard.press("Escape");
  await atlas.locator('[data-atlas-contact="contact:vanguard"]').click();
  await atlas.getByRole("button", { name: "COMMIT TRAVEL", exact: true }).click();
  await atlas.getByRole("button", { name: "ACKNOWLEDGE ARRIVAL", exact: true }).click();
  expect((await readInstalledSave(page)).galaxyRun!.vessel.contactId).toBe("contact:vanguard");
  await atlas.locator('[data-atlas-contact="contact:ashfall"]').click();
  await atlas.getByRole("button", { name: "COMMIT TRAVEL", exact: true }).click();
  await atlas.getByRole("button", { name: "ACKNOWLEDGE ARRIVAL", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "CONTINUE GALAXY", exact: true }).click();
  expect((await readInstalledSave(page)).galaxyRun!.vessel.contactId).toBe("contact:ashfall");
  expect(colony(await readInstalledSave(page)).population.total).toBe(10);
  await atlas.getByRole("button", { name: "DESCEND TO COLONY", exact: true }).click();
  await expect(page.getByRole("group", { name: "Colony controls", exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("ashfall-return-after-salvage.png") });
});

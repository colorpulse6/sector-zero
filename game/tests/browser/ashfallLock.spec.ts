import { expect, test } from "@playwright/test";
import { galaxyAtAshfall } from "./fixtures/routeFixtures";
import { installSaveFixture, readInstalledSave, readInstalledSaveBytes, readLegacyDomainBytes, SAVE_STORAGE_KEY } from "./helpers/saveFixture";
import { observeColonyWalk, approachQuartermaster, walkPress, walkFrames, walkTo, walkText, clearWalkText } from "./helpers/colonyWalk";
import { attachBrowserReceipt } from "./helpers/receipt";
const COLONY = "galaxy:ashfall-primary";

test("@keyboard fresh Ashfall loop: work, five buildings, settlers, trade, take off, return and reload", async ({ page }, info) => {
  test.setTimeout(240_000);
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await observeColonyWalk(page);
  // No save fixture: this is the actual new-player entry point.
  await page.goto("/");
  await page.getByRole("button", { name: "BEGIN GALAXY", exact: true }).click();
  const atlas = page.getByRole("dialog", { name: "Galaxy Atlas", exact: true });
  await atlas.locator('[data-atlas-contact="contact:ashfall"]').click();
  await atlas.getByRole("button", { name: "COMMIT TRAVEL", exact: true }).click();
  await atlas.getByRole("button", { name: "ACKNOWLEDGE ARRIVAL", exact: true }).click();
  const legacy = await readLegacyDomainBytes(page);
  await atlas.getByRole("button", { name: "DESCEND TO COLONY", exact: true }).click();
  await approachQuartermaster(page);
  const empty = await readInstalledSaveBytes(page);
  await walkPress(page);
  await walkText(page, "NEED 20 COLONY METAL");
  expect(await readInstalledSaveBytes(page)).toBe(empty);
  await page.screenshot({ path: info.outputPath("quartermaster-empty-stock.png") });
  await page.reload();
  await page.getByRole("button", { name: "CONTINUE GALAXY", exact: true }).click();
  await atlas.getByRole("button", { name: "MANAGE COLONY", exact: true }).click();
  const management = page.getByRole("dialog", { name: "Colony management", exact: true });
  const work = management.getByRole("button", { name: "WORK A SALVAGE SHIFT", exact: true });
  const queue = ["Solar Array", "Mine", "Habitat Module", "Farm", "Water Purifier"];
  const colony = (s: Awaited<ReturnType<typeof readInstalledSave>>) => s.galaxyRun!.colonies.find(c => c.id === COLONY)!;
  let shifts = 0;
  while (shifts < 25 && colony(await readInstalledSave(page)).population.total < 10) {
    while (queue.length) {
      const title = management.locator("div").filter({ hasText: new RegExp(`^[^\\w]*${queue[0]}$`) }).last();
      const build = title.locator("..").getByRole("button", { name: "Build", exact: true });
      if (await build.count() === 0 || !await build.isEnabled()) break;
      await build.click(); queue.shift();
    }
    await work.click(); shifts++;
  }
  expect(queue).toEqual([]);
  const settled = await readInstalledSave(page);
  expect(colony(settled).population.total).toBe(10);
  expect(colony(settled).buildings.every(b => b.status === "operational")).toBe(true);
  await page.screenshot({ path: info.outputPath("ashfall-five-building-settlement.png") });
  await page.keyboard.press("Escape");
  await atlas.getByRole("button", { name: "DESCEND TO COLONY", exact: true }).click();
  await approachQuartermaster(page);
  const before = await readInstalledSave(page);
  await clearWalkText(page);
  await page.keyboard.down("z");
  try { await walkFrames(page, 75); } finally { await page.keyboard.up("z"); }
  const traded = await readInstalledSave(page);
  expect(colony(traded).resources.metal).toBe(colony(before).resources.metal - 20);
  expect(traded.galaxyRun!.resources.supply).toBe(before.galaxyRun!.resources.supply + 1);
  expect(traded.saveRevision).toBe(before.saveRevision + 1);
  expect(traded.galaxyRun!.worldCycle).toBe(before.galaxyRun!.worldCycle);
  await walkText(page, "TRADED 20 METAL");
  await page.screenshot({ path: info.outputPath("ashfall-quartermaster-trade.png") });
  // Fresh intent, same visit, same rate.
  await walkFrames(page); await walkPress(page);
  expect((await readInstalledSave(page)).galaxyRun!.resources.supply).toBe(traded.galaxyRun!.resources.supply + 1);
  // Leave the shop, walk to the Overseer and read the lasting settlement result.
  await walkPress(page, "ArrowDown"); await walkPress(page);
  await walkTo(page, "d", "x", 11.5);
  await walkTo(page, "w", "y", 13.2);
  await walkPress(page);
  await walkPress(page); await walkPress(page);
  await walkText(page, "5 buildings on the books: 5 operational.");
  await walkText(page, "at 10 now.");
  await page.screenshot({ path: info.outputPath("ashfall-settled-overseer.png") });
  // Close the remaining factual lines before returning to the pad.
  for (let n = 0; n < 8; n++) {
    await walkPress(page);
    if (await page.evaluate(() => window.colonyWalk.texts.slice(-40).some(t => t.includes("[Z] Talk")))) break;
  }
  await walkTo(page, "s", "y", 22.3);
  await walkPress(page);
  await page.getByRole("button", { name: "Take Off", exact: true }).click();
  for (const contact of ["contact:vanguard", "contact:ashfall"]) {
    await atlas.locator(`[data-atlas-contact="${contact}"]`).click();
    await atlas.getByRole("button", { name: "COMMIT TRAVEL", exact: true }).click();
    await atlas.getByRole("button", { name: "ACKNOWLEDGE ARRIVAL", exact: true }).click();
  }
  const returned = await readInstalledSave(page);
  expect(returned.galaxyRun!.vessel.contactId).toBe("contact:ashfall");
  expect(colony(returned).buildings).toHaveLength(5);
  expect(await readLegacyDomainBytes(page)).toBe(legacy);
  await page.reload();
  await page.getByRole("button", { name: "CONTINUE GALAXY", exact: true }).click();
  expect((await readInstalledSave(page)).galaxyRun).toEqual(returned.galaxyRun);
  await atlas.getByRole("button", { name: "DESCEND TO COLONY", exact: true }).click();
  await page.screenshot({ path: info.outputPath("ashfall-returned-yard.png") });
  expect(errors).toEqual([]);
  await attachBrowserReceipt(info, { inputMethod: "keyboard", saveFixture: "none; BEGIN GALAXY",
    route: "fresh -> travel -> empty trade refusal -> salvage/build -> ten settlers -> trade twice -> Overseer -> Take Off -> Vanguard -> Ashfall -> reload -> descend",
    expectedOutcome: "Complete noncombat settlement and repeatable trade with durable state and held-input protection.",
    observedOutcome: `Passed with ${shifts} shifts, five operational buildings, ten settlers and two distinct exchanges; Legacy unchanged.` });
});

test("@touch Quartermaster rejects stale and failed saves, then one touch trades once", async ({ page }, info) => {
  test.setTimeout(90_000);
  const save = structuredClone(galaxyAtAshfall);
  save.galaxyRun!.colonies.find(c => c.id === COLONY)!.resources.metal = 60;
  await observeColonyWalk(page); await installSaveFixture(page, save); await page.goto("/");
  await page.getByRole("button", { name: "CONTINUE GALAXY", exact: true }).tap();
  await page.getByRole("button", { name: "DESCEND TO COLONY", exact: true }).tap();
  await approachQuartermaster(page);
  const original = (await readInstalledSaveBytes(page))!;
  await page.evaluate(key => localStorage.setItem(key, "{bad"), SAVE_STORAGE_KEY);
  await walkPress(page); await walkText(page, "SAVE COULD NOT BE READ");
  expect(await readInstalledSaveBytes(page)).toBe("{bad");
  await page.evaluate(({ key, original }) => localStorage.setItem(key, original), { key: SAVE_STORAGE_KEY, original });
  await page.evaluate(() => {
    (window as unknown as { realSetItem: typeof Storage.prototype.setItem }).realSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new DOMException("Quota exceeded", "QuotaExceededError"); };
  });
  await walkPress(page); await walkText(page, "SAVE FAILED · NO TRADE");
  expect(await readInstalledSaveBytes(page)).toBe(original);
  await page.evaluate(() => { Storage.prototype.setItem = (window as unknown as { realSetItem: typeof Storage.prototype.setItem }).realSetItem; });
  const newer = JSON.parse(original); newer.galaxyRun.resources.supply += 3;
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: SAVE_STORAGE_KEY, value: JSON.stringify(newer) });
  await walkPress(page); await walkText(page, "STOCK CHANGED");
  expect(await readInstalledSave(page)).toEqual(newer);
  await page.getByRole("group", { name: "Colony controls", exact: true }).getByRole("button", { name: "Interact", exact: true }).tap();
  await expect.poll(async () => (await readInstalledSave(page)).galaxyRun!.resources.supply).toBe(newer.galaxyRun.resources.supply + 1);
  await walkFrames(page, 35);
  const after = await readInstalledSave(page);
  expect(after.saveRevision).toBe(newer.saveRevision + 1);
  expect(after.galaxyRun!.colonies.find(c => c.id === COLONY)!.resources.metal).toBe(40);
  await page.screenshot({ path: info.outputPath("ashfall-touch-trade.png") });
});

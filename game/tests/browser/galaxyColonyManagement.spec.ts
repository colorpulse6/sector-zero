import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import type { SaveData } from "../../app/components/engine/types";
import { freshGalaxy, galaxyAtAshfall, galaxyWithLegacyProgression, pendingGalaxyPoiReturn } from "./fixtures/routeFixtures";
import { attachBrowserReceipt } from "./helpers/receipt";
import { SAVE_STORAGE_KEY, installSaveFixture, readInstalledSave, readInstalledSaveBytes, readLegacyDomainBytes } from "./helpers/saveFixture";
import { commitGalaxyColonyCommission, quoteGalaxyColonyCommission } from "../../app/components/engine/galaxy/galaxyColonyManagement";
import { advanceGalaxyWorldCycles } from "../../app/components/engine/galaxy/galaxyProjection";
import { settlementOutlook } from "../../app/components/engine/galaxy/galaxySettlement";
import type { BuildingType } from "../../app/components/colony/shared/colonyTypes";

const COLONY = "galaxy:ashfall-primary";
type Method = "keyboard" | "pointer";

async function activate(page: Page, target: Locator, method: Method) {
  await expect(target).toBeEnabled();
  if (method === "pointer") { await target.click(); return; }
  await target.focus();
  await expect(target).toBeFocused();
  await page.keyboard.press("Enter");
}

async function openLandingPadMenu(page: Page) {
  const interact = page.getByRole("group", { name: "Colony controls", exact: true })
    .getByRole("button", { name: "Interact", exact: true });
  await interact.focus();
  await page.keyboard.down("Enter");
  await page.waitForTimeout(100); // A native hold spans the canvas input sampling frame.
  await page.keyboard.up("Enter");
  const menu = page.getByRole("dialog", { name: "Landing pad exit menu", exact: true });
  await expect(menu).toBeVisible();
  return menu;
}

/** Arrow keys move the region selection; Z moves focus to the selected site's action. */
async function chooseRegionAction(page: Page, region: Locator, name: string) {
  const selected = region.locator('[role="option"][aria-selected="true"]');
  await selected.focus();
  for (let step = 0; step < 8 && await selected.getAttribute("aria-label") !== name; step++) {
    await page.keyboard.press("ArrowDown");
  }
  await expect(selected).toHaveAccessibleName(name);
  await page.keyboard.press("z");
}

function ashfallWithMetal(metal: number): SaveData {
  const save = structuredClone(galaxyAtAshfall);
  save.galaxyRun!.colonies = save.galaxyRun!.colonies.map(colony => colony.id === COLONY
    ? { ...colony, resources: { ...colony.resources, metal } }
    : colony);
  return save;
}

/** Another tab or an external writer replaces the stored save. */
async function writeStoredBytes(page: Page, bytes: string) {
  await page.evaluate(({ key, bytes }) => localStorage.setItem(key, bytes), { key: SAVE_STORAGE_KEY, bytes });
}

function ashfall(save: SaveData) {
  const colony = save.galaxyRun?.colonies.find(entry => entry.id === COLONY);
  if (!colony) throw new Error("Ashfall Primary is missing");
  return colony;
}

async function evidence(page: Page, info: TestInfo, method: Method, fixture: string, route: string, observed: string) {
  const path = info.outputPath("galaxy-colony-management.png");
  await page.screenshot({ path });
  await info.attach("galaxy-colony-management", { path, contentType: "image/png" });
  await attachBrowserReceipt(info, {
    inputMethod: method, saveFixture: fixture, route,
    expectedOutcome: "A vessel parked at Ashfall commissions a Solar Array through the galaxy command boundary, a region survey finishes it, and it survives reload without touching Legacy progression.",
    observedOutcome: observed,
  });
}

test("@keyboard commission a Solar Array, finish it with a survey, and keep it through reload", async ({ page }, info) => {
  test.setTimeout(120_000);
  await installSaveFixture(page, galaxyWithLegacyProgression(pendingGalaxyPoiReturn()));
  await page.goto("/");
  const region = page.getByRole("dialog", { name: "Region map", exact: true });
  await expect(region).toBeVisible();
  await expect.poll(async () => (await readInstalledSave(page)).outcomeRecoveryRecords
    .some(record => record.kind === "applied_return" && record.returnPending)).toBe(false);
  const legacy = await readLegacyDomainBytes(page);
  const start = await readInstalledSave(page);
  expect(ashfall(start).resources.metal).toBe(80);
  expect(ashfall(start).buildings).toHaveLength(0);

  await region.getByRole("option").first().focus();
  await page.keyboard.press("Escape");
  const atlas = page.getByRole("dialog", { name: "Galaxy Atlas", exact: true });
  await expect(atlas).toBeVisible();
  await activate(page, atlas.getByRole("button", { name: "DESCEND TO COLONY", exact: true }), "keyboard");
  await expect(atlas).toBeHidden();

  let menu = await openLandingPadMenu(page);
  await activate(page, menu.getByRole("button", { name: "COLONY MANAGEMENT", exact: true }), "keyboard");
  const manage = page.getByRole("dialog", { name: "Colony management", exact: true });
  await expect(manage).toBeVisible();
  await activate(page, manage.getByRole("button", { name: "Build", exact: true }), "keyboard");
  await expect(manage.getByRole("status")).toHaveText("SOLAR ARRAY COMMISSIONED · READY IN 1 CYCLE");
  const commissioned = await readInstalledSave(page);
  expect(ashfall(commissioned).resources.metal).toBe(0);
  expect(ashfall(commissioned).buildings).toEqual([
    expect.objectContaining({ type: "solar_array", status: "constructing", buildProgressCycles: 1 }),
  ]);
  expect(commissioned.galaxyRun!.worldCycle).toBe(start.galaxyRun!.worldCycle);
  expect(await readLegacyDomainBytes(page)).toBe(legacy);

  await page.keyboard.press("Escape");
  await expect(manage).toBeHidden();
  menu = page.getByRole("dialog", { name: "Landing pad exit menu", exact: true });
  await expect(menu).toBeVisible();
  await activate(page, menu.getByRole("button", { name: "REGION MAP", exact: true }), "keyboard");
  await expect(region).toBeVisible();
  await chooseRegionAction(page, region, "Oathbreaker Wreck, rumored");
  const survey = region.getByRole("button", { name: "Survey Oathbreaker Wreck", exact: true });
  await expect(survey).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(region.getByRole("option", { name: "Oathbreaker Wreck, surveyed", exact: true })).toBeVisible();
  const surveyed = await readInstalledSave(page);
  expect(surveyed.galaxyRun!.worldCycle).toBe(start.galaxyRun!.worldCycle + 1);
  expect(ashfall(surveyed).buildings[0]).toMatchObject({ status: "operational", buildProgressCycles: 0 });

  await page.keyboard.press("Escape");
  await expect(menu).toBeVisible();
  await activate(page, menu.getByRole("button", { name: "Take Off", exact: true }), "keyboard");
  await expect(atlas).toBeVisible();

  await page.reload();
  await activate(page, page.getByRole("button", { name: "CONTINUE GALAXY", exact: true }), "keyboard");
  await expect(atlas).toBeVisible();
  expect(ashfall(await readInstalledSave(page)).buildings[0]).toMatchObject({ type: "solar_array", status: "operational" });
  await activate(page, atlas.getByRole("button", { name: "DESCEND TO COLONY", exact: true }), "keyboard");
  menu = await openLandingPadMenu(page);
  await activate(page, menu.getByRole("button", { name: "COLONY MANAGEMENT", exact: true }), "keyboard");
  await expect(manage.getByText("operational", { exact: true })).toBeVisible();
  expect(await readLegacyDomainBytes(page)).toBe(legacy);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await evidence(page, info, "keyboard", "pendingGalaxyPoiReturn (committed through shipped POI authority) + populated Legacy progression",
    "Region -> Atlas -> DESCEND -> landing pad -> COLONY MANAGEMENT -> Build -> REGION MAP -> Survey Oathbreaker Wreck -> Take Off -> reload -> CONTINUE GALAXY -> DESCEND -> COLONY MANAGEMENT",
    "Build spent 80 metal without a cycle, the survey advanced one cycle and finished the Solar Array, and reload kept it operational with Legacy bytes unchanged.");
});

test("@pointer MANAGE COLONY is disabled until the vessel parks at Ashfall", async ({ page }, info) => {
  await installSaveFixture(page, freshGalaxy);
  await page.goto("/");
  await page.getByRole("button", { name: "CONTINUE GALAXY", exact: true }).click();
  const atlas = page.getByRole("dialog", { name: "Galaxy Atlas", exact: true });
  const before = await readInstalledSaveBytes(page);
  await atlas.locator('[data-atlas-contact="contact:ashfall"]').click();
  await expect(atlas.getByRole("button", { name: "MANAGE COLONY", exact: true })).toBeDisabled();
  await expect(atlas.locator("#atlas-manage-note")).toHaveText("ARRIVE AT ASHFALL FIRST");
  expect(await readInstalledSaveBytes(page)).toBe(before);
  await evidence(page, info, "pointer", "freshGalaxy", "Atlas -> select Ashfall",
    "MANAGE COLONY is disabled with ARRIVE AT ASHFALL FIRST while the vessel is at Vanguard.");
});

test("@pointer a parked vessel opens management, and an unaffordable build writes nothing", async ({ page }, info) => {
  await installSaveFixture(page, galaxyAtAshfall);
  await page.goto("/");
  await page.getByRole("button", { name: "CONTINUE GALAXY", exact: true }).click();
  const atlas = page.getByRole("dialog", { name: "Galaxy Atlas", exact: true });
  const before = await readInstalledSaveBytes(page);
  const open = atlas.getByRole("button", { name: "MANAGE COLONY", exact: true });
  await open.click();
  const manage = page.getByRole("dialog", { name: "Colony management", exact: true });
  await expect(manage).toBeVisible();
  await expect(manage.getByRole("button", { name: "Need 80 more metal", exact: true })).toBeDisabled();
  expect(await readInstalledSaveBytes(page)).toBe(before);
  await page.keyboard.press("Escape");
  await expect(manage).toBeHidden();
  await expect(open).toBeFocused();
  await evidence(page, info, "pointer", "galaxyAtAshfall", "Atlas -> MANAGE COLONY -> Escape",
    "Management opened from the Atlas with 0 metal; Build stayed disabled with the shortfall, nothing was written, and focus returned to MANAGE COLONY.");
});

test("@pointer the stored save decides: unreadable, failed write, newer data and a stale screen", async ({ page }, info) => {
  // Canonical-reader normalized, with populated Legacy progression, like the stored save a
  // running game leaves behind.
  // 230 = solar + mine: after another tab's solar, the only buildable choice is the mine.
  const start = galaxyWithLegacyProgression(ashfallWithMetal(230));
  await installSaveFixture(page, start);
  await page.goto("/");
  await page.getByRole("button", { name: "CONTINUE GALAXY", exact: true }).click();
  const atlas = page.getByRole("dialog", { name: "Galaxy Atlas", exact: true });
  await atlas.getByRole("button", { name: "MANAGE COLONY", exact: true }).click();
  const manage = page.getByRole("dialog", { name: "Colony management", exact: true });
  const status = manage.getByRole("status");
  const build = manage.getByRole("button", { name: "Build", exact: true });
  const empty = manage.getByText("No buildings yet — commission your first below.", { exact: true });
  const original = (await readInstalledSaveBytes(page))!;

  // Unreadable storage blocks the command; no default save is made or written.
  await writeStoredBytes(page, "{not json");
  await build.click();
  await expect(status).toHaveText("SAVE COULD NOT BE READ · NOTHING CHANGED");
  expect(await readInstalledSaveBytes(page)).toBe("{not json");
  await expect(empty).toBeVisible();
  await writeStoredBytes(page, original);

  // A failed write changes nothing, in storage or on screen.
  await page.evaluate(() => {
    const real = Storage.prototype.setItem;
    (window as unknown as { realSetItem: typeof real }).realSetItem = real;
    Storage.prototype.setItem = () => { throw new DOMException("Quota exceeded", "QuotaExceededError"); };
  });
  await build.click();
  await expect(status).toHaveText("MANAGEMENT SAVE FAILED · NOTHING CHANGED");
  await page.evaluate(() => {
    Storage.prototype.setItem = (window as unknown as { realSetItem: typeof Storage.prototype.setItem }).realSetItem;
  });
  expect(await readInstalledSaveBytes(page)).toBe(original);
  await expect(empty).toBeVisible();

  // Another tab built first: the old screen is refused as stale, nothing is written, and the
  // screen reconciles to the stored state instead of re-pricing the click.
  const quote = quoteGalaxyColonyCommission(start, COLONY, "solar_array");
  if (!quote.ok) throw new Error(quote.message);
  const elsewhere = commitGalaxyColonyCommission(start, quote.quote);
  if (!elsewhere.ok) throw new Error(elsewhere.message);
  const elsewhereBytes = JSON.stringify(elsewhere.save);
  await writeStoredBytes(page, elsewhereBytes);
  await expect(empty).toBeVisible();
  await build.click();
  await expect(status).toHaveText("COLONY CHANGED · REVIEW AND TRY AGAIN");
  expect(await readInstalledSaveBytes(page)).toBe(elsewhereBytes);
  await expect(manage.getByText("constructing", { exact: true })).toHaveCount(1);

  // Newer unrelated data in storage survives the next commit.
  const newer = structuredClone(elsewhere.save);
  newer.credits += 1234;
  newer.galaxyRun!.resources.credits += 50;
  await writeStoredBytes(page, JSON.stringify(newer));
  const legacy = await readLegacyDomainBytes(page);
  await build.click();
  await expect(status).toHaveText("MINE COMMISSIONED · READY IN 2 CYCLES");
  const written = await readInstalledSave(page);
  expect(written.credits).toBe(newer.credits);
  expect(written.galaxyRun!.resources.credits).toBe(newer.galaxyRun!.resources.credits);
  expect(ashfall(written).buildings.map(building => [building.type, building.status]))
    .toEqual([["solar_array", "constructing"], ["mine", "constructing"]]);
  expect(ashfall(written).resources.metal).toBe(0);
  expect(await readLegacyDomainBytes(page)).toBe(legacy);
  await expect(manage.getByText("constructing", { exact: true })).toHaveCount(2);
  await evidence(page, info, "pointer", "galaxyAtAshfall + 230 metal + populated Legacy progression; storage rewritten in the page",
    "Atlas -> MANAGE COLONY -> Build x4 (unreadable, write failure, stale, newer data)",
    "Unreadable and failed writes changed nothing; a stale screen was refused and reconciled; the next Build kept newer stored credits and Legacy bytes.");
});

test("@pointer a fresh galaxy reaches management honestly and launches the metal POI from the pad", async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.goto("/"); // no fixture: a new browser profile
  await page.getByRole("button", { name: "BEGIN GALAXY", exact: true }).click();
  const atlas = page.getByRole("dialog", { name: "Galaxy Atlas", exact: true });
  await expect(atlas).toBeVisible();
  await atlas.locator('[data-atlas-contact="contact:ashfall"]').click();
  await expect(atlas.getByRole("button", { name: "MANAGE COLONY", exact: true })).toBeDisabled();
  await expect(atlas.locator("#atlas-manage-note")).toHaveText("ARRIVE AT ASHFALL FIRST");

  await atlas.getByRole("button", { name: "COMMIT TRAVEL", exact: true }).click();
  // The fresh route to Ashfall arrives in one leg; RESUME TRAVEL appears only on longer routes.
  const acknowledge = atlas.getByRole("button", { name: "ACKNOWLEDGE ARRIVAL", exact: true });
  const resume = atlas.getByRole("button", { name: "RESUME TRAVEL", exact: true });
  await expect(acknowledge.or(resume)).toBeVisible();
  if (await resume.isVisible()) await resume.click();
  await acknowledge.click();
  const arrived = await readInstalledSave(page);
  expect(arrived.galaxyRun!.vessel.contactId).toBe("contact:ashfall");
  expect(ashfall(arrived).resources.metal).toBe(0);
  const legacy = await readLegacyDomainBytes(page);

  await atlas.getByRole("button", { name: "MANAGE COLONY", exact: true }).click();
  const manage = page.getByRole("dialog", { name: "Colony management", exact: true });
  await expect(manage.getByRole("button", { name: "Need 80 more metal", exact: true })).toBeDisabled();
  await manage.getByRole("button", { name: "← BACK", exact: true }).click();
  await expect(manage).toBeHidden();

  await atlas.getByRole("button", { name: "DESCEND TO COLONY", exact: true }).click();
  const menu = await openLandingPadMenu(page);
  await menu.getByRole("button", { name: "COLONY MANAGEMENT", exact: true }).click();
  await expect(manage.getByRole("button", { name: "Need 80 more metal", exact: true })).toBeDisabled();
  await manage.getByRole("button", { name: "← BACK", exact: true }).click();
  await expect(menu).toBeVisible();
  expect(await readInstalledSave(page)).toEqual(arrived); // opening and closing management writes nothing

  await menu.getByRole("button", { name: "REGION MAP", exact: true }).click();
  const region = page.getByRole("dialog", { name: "Region map", exact: true });
  await region.getByRole("option", { name: "Cinder Relay Ruins, rumored", exact: true }).click();
  await region.getByRole("button", { name: "Survey Cinder Relay Ruins", exact: true }).click();
  await region.getByRole("option", { name: "Cinder Relay Ruins, surveyed", exact: true }).click();
  await region.getByRole("button", { name: "Travel to Cinder Relay Ruins", exact: true }).click();
  await expect(region).toBeHidden();
  await expect(page.getByRole("group", { name: "First-person controls", exact: true })).toBeVisible();
  const launched = await readInstalledSave(page);
  expect(launched.galaxyRun!.worldCycle).toBeGreaterThan(arrived.galaxyRun!.worldCycle);
  expect(await readLegacyDomainBytes(page)).toBe(legacy);
  await evidence(page, info, "pointer", "none (fresh browser profile)",
    "BEGIN GALAXY -> select Ashfall -> COMMIT TRAVEL -> ACKNOWLEDGE ARRIVAL -> MANAGE COLONY -> BACK -> DESCEND -> COLONY MANAGEMENT -> BACK -> REGION MAP -> Survey Cinder Relay -> Travel (first-person POI)",
    "A fresh run reached Ashfall, management showed 0 metal with Build disabled from both entries and wrote nothing, and the metal POI launched. Finishing the POI needs hand play; the fixture route covers the rest.");
});

/** Commission through the same command the screen uses. */
function commissionInNode(save: SaveData, type: BuildingType): SaveData {
  const quote = quoteGalaxyColonyCommission(save, COLONY, type);
  if (!quote.ok) throw new Error(quote.message);
  const committed = commitGalaxyColonyCommission(save, quote.quote);
  if (!committed.ok) throw new Error(committed.message);
  return committed.save;
}

test("@pointer settlement loop: power, then the mine, then housing, food and water, with settlers explained", async ({ page }, info) => {
  test.setTimeout(120_000);
  await installSaveFixture(page, galaxyWithLegacyProgression(ashfallWithMetal(230)));
  await page.goto("/");
  await page.getByRole("button", { name: "CONTINUE GALAXY", exact: true }).click();
  const atlas = page.getByRole("dialog", { name: "Galaxy Atlas", exact: true });
  const legacy = await readLegacyDomainBytes(page);
  await atlas.getByRole("button", { name: "MANAGE COLONY", exact: true }).click();
  const manage = page.getByRole("dialog", { name: "Colony management", exact: true });
  const status = manage.getByRole("status");
  const settlement = manage.getByRole("region", { name: "Settlement", exact: true });
  const choice = (label: string) => manage.getByText(label, { exact: true }).locator("..").getByRole("button");

  // Power first: every consumer names the solar array.
  for (const label of ["⛏ Mine", "🏠 Habitat Module", "🌾 Farm", "💧 Water Purifier"]) {
    await expect(choice(label)).toBeDisabled();
    await expect(choice(label)).toContainText("BUILD A SOLAR ARRAY");
  }
  await choice("☀ Solar Array").click();
  await expect(status).toHaveText("SOLAR ARRAY COMMISSIONED · READY IN 1 CYCLE");
  // Then the mine: scarce metal may not go anywhere else.
  await expect(choice("🏠 Habitat Module")).toHaveText("MINE FIRST · KEEP 150 METAL AND 1 SLOT FOR IT");
  await expect(choice("🏠 Habitat Module")).toBeDisabled();
  await choice("⛏ Mine").click();
  await expect(status).toHaveText("MINE COMMISSIONED · READY IN 2 CYCLES");
  await expect(settlement.getByText("10 / 3 · 7 SPARE (BUILT + UNDER CONSTRUCTION)", { exact: true })).toBeVisible();
  await expect(settlement.getByText("NO NEW SETTLERS · NO HOUSING · BUILD A HABITAT MODULE", { exact: true })).toBeVisible();
  let save = await readInstalledSave(page);
  expect(ashfall(save).buildings.map(building => [building.type, building.status]))
    .toEqual([["solar_array", "constructing"], ["mine", "constructing"]]);
  expect(ashfall(save).resources.metal).toBe(0);
  expect(await readLegacyDomainBytes(page)).toBe(legacy);

  // Time passes elsewhere (surveys, expeditions, travel). Run the same cycles and commands in
  // Node from mine output alone until three settlers live here, then reload.
  const queue: BuildingType[] = ["habitat_module", "farm", "water_purifier"];
  for (let cycle = 0; cycle < 80 && ashfall(save).population.total < 3; cycle += 1) {
    while (queue.length > 0 && quoteGalaxyColonyCommission(save, COLONY, queue[0]).ok) save = commissionInNode(save, queue.shift()!);
    const advanced = advanceGalaxyWorldCycles(save.galaxyRun!, 1);
    if (!advanced.ok) throw new Error("cycle advance failed");
    save = { ...save, galaxyRun: advanced.galaxyRun };
  }
  const colony = ashfall(save);
  expect(queue).toEqual([]);
  expect(colony.population.total).toBe(3);
  const outlook = settlementOutlook(colony, save.galaxyRun!.worldCycle);
  expect(outlook.settlerChange).toBe(1);
  await writeStoredBytes(page, JSON.stringify(save));
  await page.reload();
  await page.getByRole("button", { name: "CONTINUE GALAXY", exact: true }).click();
  await atlas.getByRole("button", { name: "MANAGE COLONY", exact: true }).click();
  await expect(settlement.getByText("3 / 10 · 7 FREE", { exact: true })).toBeVisible();
  await expect(settlement.getByText(`${colony.happiness} NOW · ${outlook.nextHappiness} NEXT CYCLE`, { exact: true })).toBeVisible();
  await expect(settlement.getByText("+1 SETTLER", { exact: true })).toBeVisible();
  await expect(settlement.getByText("10 / 10 · 0 SPARE (BUILT + UNDER CONSTRUCTION)", { exact: true })).toBeVisible();
  await expect(manage.getByText("operational", { exact: true })).toHaveCount(5);
  for (const label of ["⛏ Mine", "🏠 Habitat Module", "🌾 Farm", "💧 Water Purifier"]) {
    await expect(choice(label)).toContainText("NEEDS");
  }
  expect(await readLegacyDomainBytes(page)).toBe(legacy);

  const path = info.outputPath("galaxy-settlement-loop.png");
  await page.screenshot({ path, fullPage: true });
  await info.attach("galaxy-settlement-loop", { path, contentType: "image/png" });
  await attachBrowserReceipt(info, {
    inputMethod: "pointer",
    saveFixture: "galaxyAtAshfall + 230 metal + populated Legacy progression; later state from Node cycles and commands",
    route: "Atlas -> MANAGE COLONY -> Solar Array -> Mine -> (cycles in Node) -> reload -> CONTINUE GALAXY -> MANAGE COLONY",
    expectedOutcome: "Consumers wait for power, scarce metal goes to the mine, and the panel explains housing, happiness and the next settler; legacy bytes never move.",
    observedOutcome: `Power and mine-first reasons showed on the buttons; after reload 3/10 settlers, ${colony.happiness} happiness, +1 settler next cycle, five operational buildings and unchanged legacy bytes.`,
  });
});

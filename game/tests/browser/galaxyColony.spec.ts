import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { projectGalaxyRunToLegacySave } from "../../app/components/engine/galaxy/galaxyProjection";
import { colonyMissionDescriptor, launchContextFromSave } from "../../app/components/engine/missionContext";
import { commitOutcome, createOutcomeAttempt, createOutcomeEnvelope } from "../../app/components/engine/missionOutcome";
import type { SaveData } from "../../app/components/engine/types";
import { freshGalaxy, galaxyAtAshfall, galaxyWithLegacyProgression } from "./fixtures/routeFixtures";
import { attachBrowserReceipt } from "./helpers/receipt";
import {
  installSaveFixture,
  readInstalledSave,
  readInstalledSaveBytes,
  readLegacyDomainBytes,
  roundTripSaveFixture,
} from "./helpers/saveFixture";

const CANVAS = "#sector-zero-game-canvas";
type Method = "keyboard" | "pointer";

async function activate(page: Page, target: Locator, method: Method) {
  await expect(target).toBeEnabled();
  if (method === "pointer") { await target.click(); return; }
  await target.focus();
  await expect(target).toBeFocused();
  await page.keyboard.press("Enter");
}

async function openAtlas(page: Page, save: SaveData, method: Method) {
  await installSaveFixture(page, save);
  await page.goto("/");
  await activate(page, page.getByRole("button", { name: "CONTINUE GALAXY", exact: true }), method);
  const atlas = page.getByRole("dialog", { name: "Galaxy Atlas", exact: true });
  await expect(atlas).toBeVisible();
  return atlas;
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

// A committed galaxy colony attempt whose return targets a colony surface, built through the
// shipped outcome authorities. No GC1 flow writes one yet; this proves the remount path.
function pendingGalaxyColonyReturn(surface: "galaxy-colony-exterior" | "galaxy-landing-pad"): SaveData {
  const save = roundTripSaveFixture(galaxyAtAshfall);
  const context = launchContextFromSave(
    projectGalaxyRunToLegacySave(save),
    colonyMissionDescriptor("galaxy:ashfall-primary", "exterior"),
    "galaxy",
    "atlas",
    surface,
    () => `browser-${surface}-return`,
  );
  const attempt = createOutcomeAttempt(save, context, "colony");
  let canonical = save;
  const committed = commitOutcome({
    read: () => structuredClone(canonical),
    write: (next) => { canonical = structuredClone(next); },
  }, createOutcomeEnvelope(attempt, "success", { version: 1, kind: "terminal_noop_v1" }));
  if (committed.status !== "committed") throw new Error(`Colony return fixture failed: ${committed.status}`);
  return committed.save;
}

function returnPending(save: SaveData): boolean {
  return save.outcomeRecoveryRecords.some(record => record.kind === "applied_return" && record.returnPending);
}

function runWithoutJournal(save: SaveData) {
  const { appliedOutcomeIds: _ids, ...rest } = structuredClone(save.galaxyRun!);
  return rest;
}

async function evidence(page: Page, info: TestInfo, method: Method, fixture: string, route: string, observed: string) {
  const path = info.outputPath("galaxy-colony.png");
  await page.screenshot({ path });
  await info.attach("galaxy-colony", { path, contentType: "image/png" });
  await attachBrowserReceipt(info, {
    inputMethod: method, saveFixture: fixture, route,
    expectedOutcome: "A vessel parked at Ashfall descends to Ashfall Primary, walks it in first person, opens the galaxy region from the landing pad and takes off back to the Atlas without touching Legacy progression.",
    observedOutcome: observed,
  });
}

test("@keyboard galaxy descent walks Ashfall Primary and takes off back to the Atlas", async ({ page }, info) => {
  const atlas = await openAtlas(page, galaxyWithLegacyProgression(galaxyAtAshfall), "keyboard");
  const before = await readInstalledSave(page);
  const legacyBefore = await readLegacyDomainBytes(page);

  await activate(page, atlas.getByRole("button", { name: "DESCEND TO COLONY", exact: true }), "keyboard");
  await expect(atlas).toBeHidden();
  await expect(page.locator(CANVAS)).toBeFocused();

  const menu = await openLandingPadMenu(page);
  await activate(page, menu.getByRole("button", { name: "REGION MAP", exact: true }), "keyboard");
  const region = page.getByRole("dialog", { name: "Region map", exact: true });
  await expect(region).toContainText("LANDING PAD");
  await expect(region).toContainText("Ashfall Primary");
  await page.keyboard.press("Escape");
  await expect(region).toBeHidden();
  await expect(menu).toBeVisible();

  await activate(page, menu.getByRole("button", { name: "Take Off", exact: true }), "keyboard");
  await expect(menu).toBeHidden();
  await expect(page.getByRole("dialog", { name: "Galaxy Atlas", exact: true })).toBeVisible();

  const after = await readInstalledSave(page);
  expect(await readLegacyDomainBytes(page)).toBe(legacyBefore);
  expect(after.activeExperience).toBe("galaxy");
  expect(runWithoutJournal(after)).toEqual(runWithoutJournal(before));
  expect(after.galaxyRun?.appliedOutcomeIds).toHaveLength((before.galaxyRun?.appliedOutcomeIds.length ?? 0) + 1);
  expect(after.outcomeRecoveryRecords.some(record => record.kind === "applied_return" && record.returnPending)).toBe(false);
  await evidence(page, info, "keyboard", "galaxyAtAshfall + populated Legacy progression",
    "Atlas -> DESCEND TO COLONY -> landing pad -> REGION MAP -> back -> Take Off -> Atlas",
    "Descent mounted the colony walk, the landing-pad region opened on the galaxy colony, and Take Off returned to the Atlas with only the outcome journal changed.");
});

test("@keyboard reloading inside the galaxy colony keeps the run and reopens the Atlas", async ({ page }, info) => {
  const atlas = await openAtlas(page, galaxyAtAshfall, "keyboard");
  const before = await readInstalledSaveBytes(page);
  await activate(page, atlas.getByRole("button", { name: "DESCEND TO COLONY", exact: true }), "keyboard");
  await expect(atlas).toBeHidden();
  await page.reload();
  await activate(page, page.getByRole("button", { name: "CONTINUE GALAXY", exact: true }), "keyboard");
  await expect(page.getByRole("dialog", { name: "Galaxy Atlas", exact: true })).toBeVisible();
  await expect(page.locator("[data-persistence-recovery]")).toHaveCount(0);
  expect(await readInstalledSaveBytes(page)).toBe(before);
  await evidence(page, info, "keyboard", "galaxyAtAshfall", "Atlas -> DESCEND -> reload -> CONTINUE GALAXY",
    "The reload left the save byte-identical and CONTINUE GALAXY reopened the Atlas without a recovery prompt.");
});

test("@pointer SYSTEM view descends from the colony planet", async ({ page }, info) => {
  const atlas = await openAtlas(page, galaxyAtAshfall, "pointer");
  await atlas.getByRole("button", { name: "SYSTEM", exact: true }).click();
  const embedded = atlas.locator("[data-system-embedded]");
  await expect(embedded).toBeVisible();
  // Landmarks track the moving scene; click through the DOM so the target cannot drift.
  await embedded.getByRole("option", { name: "Ashfall, planet", exact: true }).evaluate(el => (el as HTMLElement).click());
  const descend = embedded.locator("[data-system-descend]");
  await expect(descend).toHaveText("DESCEND TO COLONY");
  await expect(descend).toBeEnabled();
  await descend.click();
  await expect(atlas).toBeHidden();
  await expect(page.locator(CANVAS)).toBeVisible();
  await evidence(page, info, "pointer", "galaxyAtAshfall", "Atlas -> SYSTEM -> Ashfall planet -> DESCEND TO COLONY",
    "The SYSTEM view offered DESCEND TO COLONY beside the region chart and launched the colony walk.");
});

test("@pointer DESCEND TO COLONY stays disabled until the vessel parks at Ashfall", async ({ page }, info) => {
  const atlas = await openAtlas(page, freshGalaxy, "pointer");
  const before = await readInstalledSaveBytes(page);
  await atlas.locator('[data-atlas-contact="contact:ashfall"]').click();
  await expect(atlas.locator("#atlas-target-heading")).toHaveText("ASHFALL");
  const descend = atlas.getByRole("button", { name: "DESCEND TO COLONY", exact: true });
  await expect(descend).toBeDisabled();
  await expect(atlas.locator("#atlas-descend-note")).toHaveText("ARRIVE AT ASHFALL FIRST");
  expect(await readInstalledSaveBytes(page)).toBe(before);
  await evidence(page, info, "pointer", "freshGalaxy", "Atlas -> select Ashfall",
    "DESCEND TO COLONY is disabled with ARRIVE AT ASHFALL FIRST while the vessel is still at Vanguard.");
});

test("@keyboard a pending galaxy landing-pad return remounts the colony walk and takes off to the Atlas", async ({ page }, info) => {
  const fixture = pendingGalaxyColonyReturn("galaxy-landing-pad");
  expect(returnPending(fixture)).toBe(true);
  await installSaveFixture(page, fixture);
  await page.goto("/");
  const menu = page.getByRole("dialog", { name: "Landing pad exit menu", exact: true });
  await expect(menu).toBeVisible();
  await expect(page.locator("[data-persistence-recovery]")).toHaveCount(0);
  await expect.poll(async () => returnPending(await readInstalledSave(page))).toBe(false);
  await activate(page, menu.getByRole("button", { name: "Take Off", exact: true }), "keyboard");
  await expect(page.getByRole("dialog", { name: "Galaxy Atlas", exact: true })).toBeVisible();
  await expect.poll(async () => returnPending(await readInstalledSave(page))).toBe(false);
  await evidence(page, info, "keyboard", "galaxyAtAshfall + pending galaxy-landing-pad return",
    "Boot -> remounted landing pad -> Take Off -> Atlas",
    "The pending return remounted the galaxy colony with the landing-pad menu open, acknowledged without a recovery prompt, and Take Off returned to the Atlas.");
});

test("@keyboard a pending galaxy colony-exterior return remounts the walk without the menu", async ({ page }, info) => {
  await installSaveFixture(page, pendingGalaxyColonyReturn("galaxy-colony-exterior"));
  await page.goto("/");
  await expect(page.getByRole("group", { name: "Colony controls", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Landing pad exit menu", exact: true })).toHaveCount(0);
  await expect(page.locator("[data-persistence-recovery]")).toHaveCount(0);
  await expect.poll(async () => returnPending(await readInstalledSave(page))).toBe(false);
  await evidence(page, info, "keyboard", "galaxyAtAshfall + pending galaxy-colony-exterior return",
    "Boot -> remounted colony exterior",
    "The pending return remounted the galaxy colony walk and acknowledged without a recovery prompt.");
});

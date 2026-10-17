import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { migrateSave, recalcPilotLevel } from "../../app/components/engine/save";
import type { SaveData } from "../../app/components/engine/types";
import { colonyFounded } from "./fixtures/routeFixtures";
import { attachBrowserReceipt } from "./helpers/receipt";
import { installSaveFixture, readInstalledSaveBytes } from "./helpers/saveFixture";

type Method = "keyboard" | "pointer" | "touch";

const CANVAS = "#sector-zero-game-canvas";
const colonyReady: SaveData = recalcPilotLevel(migrateSave({ ...colonyFounded, introSeen: true } as unknown as Record<string, unknown>));

async function activate(page: Page, target: Locator, method: Method) {
  if (method === "touch") await target.tap();
  else if (method === "pointer") await target.click();
  else { await target.focus(); await expect(target).toBeFocused(); await page.keyboard.press("Enter"); }
}

async function key(page: Page, name: string) {
  await page.keyboard.down(name);
  await page.waitForTimeout(100);
  await page.keyboard.up(name);
  await page.waitForTimeout(50);
}

async function openSystemMap(page: Page, method: Method) {
  await installSaveFixture(page, colonyReady);
  await page.goto("/");
  await activate(page, page.getByRole("button", { name: "LEGACY CAMPAIGN", exact: true }), method);
  const canvas = page.locator(CANVAS);
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(600);
  await canvas.focus();
  // Cockpit hotspot navigation: starmap -> colonies.
  await key(page, "ArrowLeft");
  await key(page, "Enter");
  const invoker = page.getByRole("button", { name: "SYSTEM MAP", exact: true });
  await expect(invoker).toBeVisible();
  await activate(page, invoker, method);
  const dialog = page.getByRole("dialog", { name: "System map", exact: true });
  await expect(dialog).toBeVisible();
  return { dialog, invoker };
}

async function evidence(page: Page, info: TestInfo, method: Method, observed: string) {
  const path = info.outputPath("system-map.png");
  await page.screenshot({ path });
  await info.attach("system-map", { path, contentType: "image/png" });
  await attachBrowserReceipt(info, {
    inputMethod: method, saveFixture: "colonyFounded + introSeen", route: "Legacy cockpit -> Colonies -> SYSTEM MAP",
    expectedOutcome: "System atlas lists planets and neighbours, selection is read-only, VIEW SYSTEM re-centres, region chart opens from a colony planet.",
    observedOutcome: observed,
  });
}

test("@pointer system map lists landmarks, keeps selection read-only and hands off to the region chart", async ({ page }, info) => {
  const { dialog } = await openSystemMap(page, "pointer");
  const before = await readInstalledSaveBytes(page);
  const options = dialog.getByRole("option");
  await expect(options).toHaveCount(7);
  await expect(dialog.getByRole("heading", { level: 1 })).toHaveText("Ashfall Reach");
  for (const option of await options.all()) {
    const box = (await option.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  // A pointer entering the chart holds the idle spin, so landmarks stay put for the click.
  const clickLandmark = async (name: string) => {
    await dialog.locator("[data-system-field]").hover({ position: { x: 8, y: 8 } });
    await dialog.getByRole("option", { name, exact: true }).click();
  };
  await clickLandmark("UNKNOWN SYSTEM, system");
  await expect(dialog.locator("[data-system-action]")).toHaveCount(0);
  await expect(dialog.locator("[data-system-detail-panel]")).not.toContainText(/Prismara/);

  await clickLandmark("Glaciem Drift, system");
  await activate(page, dialog.getByRole("button", { name: "View Glaciem Drift", exact: true }), "pointer");
  await expect(dialog.getByRole("heading", { level: 1 })).toHaveText("Glaciem Drift", { timeout: 5000 });
  await expect(dialog.getByRole("option", { name: "Glaciem, planet", exact: true })).toBeVisible();
  await expect(dialog.getByRole("option", { name: "Ashfall Reach, system", exact: true })).toBeVisible();
  expect(await readInstalledSaveBytes(page)).toBe(before);

  await clickLandmark("Ashfall Reach, system");
  await activate(page, dialog.getByRole("button", { name: "View Ashfall Reach", exact: true }), "pointer");
  await expect(dialog.getByRole("heading", { level: 1 })).toHaveText("Ashfall Reach", { timeout: 5000 });
  await clickLandmark("Ashfall, planet");
  await activate(page, dialog.getByRole("button", { name: "Open region chart for Ashfall", exact: true }), "pointer");
  const region = page.getByRole("dialog", { name: "Region map", exact: true });
  await expect(region).toBeVisible();
  await expect(region).toContainText("COCKPIT VIEW");
  await evidence(page, info, "pointer", "Seven landmarks with 44px targets; unknown system hides its identity; VIEW SYSTEM swaps the system without touching the save; the region chart opens read-only from Ashfall.");
  await page.keyboard.press("Escape");
  await expect(region).toBeHidden();
  await expect(dialog).toBeVisible();
  expect(await readInstalledSaveBytes(page)).toBe(before);
});

test("@keyboard system map keeps a roving selection, Enter prepares the action and Escape restores the invoker", async ({ page }, info) => {
  const { dialog, invoker } = await openSystemMap(page, "keyboard");
  const selected = dialog.locator('[role="option"][aria-selected="true"]');
  await expect(selected).toBeFocused();
  for (const direction of ["ArrowDown", "ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"]) {
    await page.keyboard.press(direction);
    await expect(selected).toBeFocused();
  }
  await dialog.getByRole("option", { name: "Verdant Chain, system", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(dialog.getByRole("button", { name: "View Verdant Chain", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("option", { name: "Verdant Chain, system", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "← RETURN TO COLONIES", exact: true })).toBeFocused();
  await evidence(page, info, "keyboard", "Arrows keep the selected option focused; Enter moves focus to the single action without activating; Tab wraps to the back control.");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(invoker).toBeFocused();
});

test("@touch 390px system map has no horizontal overflow and tappable landmarks", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const { dialog } = await openSystemMap(page, "touch");
  const overflow = await dialog.evaluate(root => root.scrollWidth > root.clientWidth);
  expect(overflow).toBe(false);
  for (const option of await dialog.getByRole("option").all()) {
    const box = (await option.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await dialog.getByRole("option", { name: "Luminos Core, system", exact: true }).tap();
  await expect(dialog.getByRole("button", { name: "View Luminos Core", exact: true })).toBeVisible();
  await evidence(page, info, "touch", "390px reduced-motion system map has no horizontal overflow, 44px landmarks and a single tappable view action.");
});

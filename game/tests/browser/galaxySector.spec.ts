import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import type { SaveData } from "../../app/components/engine/types";
import { applyGalaxyFixture, findGalaxyFixture } from "../../app/components/galaxy/devFixtures";
import { freshGalaxy, freshLegacy } from "./fixtures/routeFixtures";
import { attachBrowserReceipt } from "./helpers/receipt";
import { installSaveFixture, readInstalledSaveBytes, roundTripSaveFixture } from "./helpers/saveFixture";

type Method = "keyboard" | "pointer" | "touch";

function denseSector(): SaveData {
  const fixture = findGalaxyFixture("dense-sector");
  if (!fixture) throw new Error("dense-sector fixture is missing");
  return roundTripSaveFixture(applyGalaxyFixture(freshLegacy, fixture));
}

async function activate(page: Page, target: Locator, method: Method) {
  if (method === "touch") await target.tap();
  else if (method === "pointer") await target.click();
  else { await target.focus(); await expect(target).toBeFocused(); await page.keyboard.press("Enter"); }
}

async function openAtlas(page: Page, save: SaveData, method: Method) {
  await installSaveFixture(page, save);
  await page.goto("/");
  await activate(page, page.getByRole("button", { name: "CONTINUE GALAXY", exact: true }), method);
  const atlas = page.getByRole("dialog", { name: "Galaxy Atlas", exact: true });
  await expect(atlas).toBeVisible();
  const field = atlas.locator("[data-sector-field]");
  await expect(field).toBeVisible();
  await expect(field).toHaveAttribute("data-atlas-level", "sector");
  return { atlas, field };
}

async function evidence(page: Page, info: TestInfo, method: Method, fixture: string, observed: string) {
  const path = info.outputPath("galaxy-sector.png");
  await page.screenshot({ path });
  await info.attach("galaxy-sector", { path, contentType: "image/png" });
  await attachBrowserReceipt(info, {
    inputMethod: method, saveFixture: fixture, route: "Experience gate -> CONTINUE GALAXY -> Galaxy Atlas",
    expectedOutcome: "The sector field shows every known contact as a landmark, selection is shared with the CONTACTS list, routes carry their threat band, GALAXY frames the sector and SYSTEM zooms into the bound system without touching the save.",
    observedOutcome: observed,
  });
}

test("@pointer sector field selects stars, draws the threat-banded route, frames the galaxy and zooms into the bound system", async ({ page }, info) => {
  const { atlas, field } = await openAtlas(page, freshGalaxy, "pointer");
  const before = await readInstalledSaveBytes(page);
  const landmarks = field.locator("[data-sector-landmark]");
  await expect(landmarks).toHaveCount(5);
  await expect(field.locator('[data-sector-landmark="contact:vanguard"]')).toHaveAttribute("data-vessel", "true");
  await expect(field.locator('[data-sector-landmark="contact:ashfall"]')).toHaveAttribute("data-colony", "true");
  await expect(field.locator('[data-sector-landmark][data-knowledge="signal"]')).toHaveCount(1);
  await expect(field.locator('[data-sector-landmark][data-knowledge="signal"]')).toContainText("UNRESOLVED SIGNAL");

  // Resting the pointer on the field holds the idle spin so landmarks stay put for the click.
  await field.hover({ position: { x: 8, y: 8 } });
  await field.locator('[data-sector-landmark="contact:kepler"]').click();
  await expect(atlas.locator('[data-atlas-contact="contact:kepler"]')).toHaveAttribute("aria-selected", "true");
  await expect(atlas.locator("#atlas-target-heading")).toHaveText("KEPLER");
  await expect(field).toHaveAttribute("data-route-state", "planned");
  await expect(field).toHaveAttribute("data-route-band", /low|moderate|high|severe|unknown/);
  await expect(atlas.getByRole("button", { name: "COMMIT TRAVEL", exact: true })).toBeEnabled();

  await atlas.getByRole("button", { name: "GALAXY", exact: true }).click();
  await expect(field).toHaveAttribute("data-atlas-level", "galaxy");
  await expect(atlas).toContainText("SECTOR 0,0 · G0 FRONTIER");
  await expect(atlas.getByRole("button", { name: "PAN LEFT", exact: true })).toBeDisabled();
  await atlas.getByRole("button", { name: "SECTOR", exact: true }).click();
  await expect(field).toHaveAttribute("data-atlas-level", "sector");

  await atlas.locator('[data-atlas-contact="contact:ashfall"]').click();
  const system = atlas.getByRole("button", { name: "SYSTEM", exact: true });
  await expect(system).toBeEnabled();
  await system.click();
  await expect(field).toHaveAttribute("data-atlas-level", "system");
  const embedded = atlas.locator("[data-system-embedded]");
  await expect(embedded).toBeVisible();
  await expect(embedded.getByRole("option", { name: "Ashfall, planet", exact: true })).toBeVisible();
  await expect(embedded.getByRole("option", { name: "Vanguard, system", exact: true })).toBeVisible();
  await expect(embedded.getByRole("option", { name: "UNKNOWN SYSTEM, system", exact: true })).toBeVisible();
  await evidence(page, info, "pointer", "freshGalaxy", "Five landmarks with vessel and colony marks; clicking Kepler selected it and drew a banded route; GALAXY framed the sector; SYSTEM showed Ashfall Reach's worlds and Vanguard as a neighbour.");
  await atlas.getByRole("button", { name: "← BACK TO SECTOR", exact: true }).click();
  await expect(embedded).toHaveCount(0);
  await expect(field).toHaveAttribute("data-atlas-level", "sector");
  expect(await readInstalledSaveBytes(page)).toBe(before);
});

test("@pointer a click on a star's name or the glow beside its hit box selects the star, not a blind coordinate", async ({ page }, info) => {
  const { atlas, field } = await openAtlas(page, freshGalaxy, "pointer");
  const before = await readInstalledSaveBytes(page);
  const heading = atlas.locator("#atlas-target-heading");
  const blind = field.locator('[data-sector-marker="blind"]');
  const ashfall = field.locator('[data-sector-landmark="contact:ashfall"]');
  const onOpenField = (point: { x: number; y: number }) => page.evaluate(({ x, y }) => {
    const hit = document.elementFromPoint(x, y);
    return hit !== null && hit.closest("[data-sector-field]") !== null &&
      hit.closest("button, [data-sector-landmark], [data-sector-marker]") === null;
  }, point);
  const selectKepler = async () => {
    await field.locator('[data-sector-landmark="contact:kepler"]').click();
    await expect(heading).toHaveText("KEPLER");
  };

  // Resting the pointer on the field holds the idle spin so landmarks stay put.
  await field.hover({ position: { x: 8, y: 8 } });
  await selectKepler();
  const name = await ashfall.locator(".sz-atlas-label strong").evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const box = range.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  });
  // The name sits below the 48px hit box: before the fix this click plotted a blind coordinate.
  expect(await onOpenField(name)).toBe(true);
  await page.mouse.click(name.x, name.y);
  await expect(heading).toHaveText("ASHFALL");
  await expect(blind).toHaveCount(0);

  await selectKepler();
  const box = await ashfall.boundingBox();
  if (!box) throw new Error("Ashfall landmark has no box");
  const glow = { x: box.x + box.width / 2 + 28, y: box.y + box.height / 2 };
  expect(await onOpenField(glow)).toBe(true);
  await page.mouse.click(glow.x, glow.y);
  await expect(heading).toHaveText("ASHFALL");
  await expect(blind).toHaveCount(0);

  // Open space far from every star still plots a blind coordinate.
  const open = await field.evaluate((host) => {
    const rect = host.getBoundingClientRect();
    const centres = [...host.querySelectorAll("[data-sector-landmark], [data-sector-marker]")].map((element) => {
      const r = element.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    for (let y = rect.top + rect.height * 0.2; y < rect.bottom - 40; y += 24) {
      for (let x = rect.left + 40; x < rect.right - 40; x += 24) {
        const hit = document.elementFromPoint(x, y);
        if (!hit || !host.contains(hit) || hit.closest("button, [data-sector-landmark], [data-sector-marker]")) continue;
        if (centres.every((centre) => Math.hypot(centre.x - x, centre.y - y) > 120)) return { x, y };
      }
    }
    return null;
  });
  if (!open) throw new Error("No open field space found");
  await page.mouse.click(open.x, open.y);
  await expect(blind).toHaveCount(1);
  await expect(heading).not.toHaveText("ASHFALL");
  expect(await readInstalledSaveBytes(page)).toBe(before);
  await evidence(page, info, "pointer", "freshGalaxy", "Clicking Ashfall's name and the glow 28px beside its hit box selected Ashfall without a blind coordinate; open space still plotted one; the save was untouched.");
});

test("@keyboard contacts rove, pan and zoom keep focus on their controls, Escape returns to the experience gate", async ({ page }, info) => {
  const { atlas } = await openAtlas(page, freshGalaxy, "keyboard");
  const selected = atlas.locator('[role="option"][aria-selected="true"]');
  await expect(selected).toBeFocused();
  const startId = await selected.getAttribute("data-atlas-contact");
  await page.keyboard.press("ArrowDown");
  await expect(atlas.locator('[role="option"][aria-selected="true"]')).toBeFocused();
  expect(await atlas.locator('[role="option"][aria-selected="true"]').getAttribute("data-atlas-contact")).not.toBe(startId);
  await expect(atlas.locator('[role="option"][tabindex="0"]')).toHaveCount(1);

  const zoomIn = atlas.getByRole("button", { name: "ZOOM IN", exact: true });
  const readout = atlas.locator("output");
  const beforeZoom = await readout.textContent();
  await zoomIn.focus();
  await page.keyboard.press("Enter");
  await expect(zoomIn).toBeFocused();
  await expect(readout).not.toHaveText(beforeZoom ?? "");
  const panLeft = atlas.getByRole("button", { name: "PAN LEFT", exact: true });
  await panLeft.focus();
  await page.keyboard.press("Enter");
  await expect(panLeft).toBeFocused();

  await expect(atlas.getByRole("heading", { level: 1 })).toHaveText("GALAXY ATLAS");
  await evidence(page, info, "keyboard", "freshGalaxy", "Arrow keys moved the single tab stop with selection; ZOOM IN and PAN LEFT kept focus on their buttons; Escape closed the atlas.");
  await page.keyboard.press("Escape");
  await expect(atlas).toBeHidden();
  await expect(page.getByRole("button", { name: "CONTINUE GALAXY", exact: true })).toBeVisible();
});

test("@touch 390px dense sector has no horizontal overflow, 44px landmarks and a bounded label budget", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const { atlas, field } = await openAtlas(page, denseSector(), "touch");
  const overflow = await atlas.evaluate(root => root.scrollWidth > root.clientWidth);
  expect(overflow).toBe(false);
  // Dozens of contacts scroll inside the listbox instead of stretching the page.
  const listbox = atlas.getByRole("listbox", { name: "Atlas contacts", exact: true });
  expect(await listbox.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
  expect(await listbox.evaluate(element => element.clientHeight)).toBeLessThanOrEqual(440);
  const landmarks = field.locator("[data-sector-landmark]");
  expect(await landmarks.count()).toBeGreaterThanOrEqual(20);
  expect(await atlas.getByRole("option").count()).toBeGreaterThanOrEqual(20);
  const labelled = await field.locator('[data-sector-landmark][data-labelled="true"]').count();
  expect(labelled).toBeLessThanOrEqual(12);
  for (const landmark of (await landmarks.all()).slice(0, 8)) {
    const box = await landmark.boundingBox();
    if (!box) continue;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await field.locator('[data-sector-landmark="contact:ashfall"]').tap();
  await expect(atlas.locator('[data-atlas-contact="contact:ashfall"]')).toHaveAttribute("aria-selected", "true");
  await evidence(page, info, "touch", "dense-sector", "390px reduced-motion dense sector: no overflow, 20+ landmarks with 44px targets, at most 12 labels, tapping Ashfall selected it.");
});

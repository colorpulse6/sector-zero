import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { galaxyAtAshfall } from "./fixtures/routeFixtures";
import { attachBrowserReceipt } from "./helpers/receipt";
import { installSaveFixture, readInstalledSave, readInstalledSaveBytes, readLegacyDomainBytes } from "./helpers/saveFixture";

type Method = "keyboard" | "pointer" | "touch";

async function activate(page: Page, target: Locator, method: Method) {
  if (method === "touch") await target.tap();
  else if (method === "pointer") await target.click();
  else { await target.focus(); await page.keyboard.press("Enter"); }
}

async function openRegion(page: Page, method: Method) {
  await installSaveFixture(page, galaxyAtAshfall);
  await page.goto("/");
  await activate(page, page.getByRole("button", { name: "CONTINUE GALAXY", exact: true }), method);
  await activate(page, page.getByRole("button", { name: "OPEN ASHFALL REGION", exact: true }), method);
  const region = page.getByRole("dialog", { name: "Region map", exact: true });
  await expect(region).toBeVisible();
  return region;
}

async function captureMap(page: Page, info: TestInfo) {
  const path = info.outputPath("region-map.png");
  await page.screenshot({ path });
  await info.attach("region-map", { path, contentType: "image/png" });
}

async function evidence(page: Page, info: TestInfo, method: Method, observed: string, screenshot = true) {
  if (screenshot) await captureMap(page, info);
  await attachBrowserReceipt(info, {
    inputMethod: method, saveFixture: "galaxyAtAshfall", route: "Atlas -> Ashfall Region -> native destination selection/action",
    expectedOutcome: "Spatial landmarks preserve fog, separate selection/action and authoritative expedition effects.",
    observedOutcome: observed,
  });
}

async function expectRouteGeometry(region: Locator) {
  const geometry = await region.evaluate(root => {
    const field = root.querySelector<HTMLElement>("[data-region-map-field]")!;
    const bounds = field.getBoundingClientRect();
    const markers = [...field.querySelectorAll<HTMLElement>('[role="option"]')].map(node => {
      const box = node.querySelector(".sz-region-marker")!.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2,
        expectedX: bounds.x + parseFloat(node.style.left) / 100 * bounds.width,
        expectedY: bounds.y + parseFloat(node.style.top) / 100 * bounds.height,
        width: box.width, height: box.height };
    });
    const endpoints = [...field.querySelectorAll<SVGLineElement>("line")].flatMap(line => {
      const matrix = line.getScreenCTM()!;
      return [new DOMPoint(line.x1.baseVal.value, line.y1.baseVal.value).matrixTransform(matrix),
        new DOMPoint(line.x2.baseVal.value, line.y2.baseVal.value).matrixTransform(matrix)]
        .map(point => ({ x: point.x, y: point.y }));
    });
    const boxes = [...field.querySelectorAll<HTMLElement>('[role="option"], .sz-region-landmark-label')]
      .map(node => { const box = node.getBoundingClientRect(); return { x: box.x, y: box.y, right: box.right, bottom: box.bottom }; });
    const collisions = boxes.flatMap((left, index) => boxes.slice(index + 1).filter(right =>
      Math.min(left.right, right.right) - Math.max(left.x, right.x) > 1
      && Math.min(left.bottom, right.bottom) - Math.max(left.y, right.y) > 1));
    return { markers, endpoints, collisions, overflow: root.scrollWidth > root.clientWidth };
  });
  expect(geometry.overflow).toBe(false);
  expect(geometry.collisions).toHaveLength(0);
  for (const marker of geometry.markers) {
    expect(marker.width).toBeGreaterThanOrEqual(44);
    expect(marker.height).toBeGreaterThanOrEqual(44);
    expect(Math.hypot(marker.x - marker.expectedX, marker.y - marker.expectedY)).toBeLessThan(1);
  }
  expect(geometry.endpoints.length).toBeGreaterThan(0);
  for (const point of geometry.endpoints) {
    expect(Math.min(...geometry.markers.map(marker => Math.hypot(marker.x - point.x, marker.y - point.y)))).toBeLessThan(1);
  }
}

test("@pointer region landmarks align with real routes and selection does not spend a cycle", async ({ page }, info) => {
  const region = await openRegion(page, "pointer");
  const before = await readInstalledSaveBytes(page);
  await expectRouteGeometry(region);
  await region.getByRole("option", { name: "Cinder Relay Ruins, rumored", exact: true }).click();
  await expect(region.locator('[data-route-state="selected"]')).toHaveCount(1);
  await expect(region.getByRole("button", { name: "Survey Cinder Relay Ruins", exact: true })).toBeVisible();
  expect(await readInstalledSaveBytes(page)).toBe(before);
  await expect(region.locator("details")).not.toHaveAttribute("open", "");
  await evidence(page, info, "pointer", "Every route endpoint meets a real landmark; selection is read-only and exposes the separate survey action.");

  await region.getByRole("option", { name: "UNKNOWN SIGNAL, unknown", exact: true }).first().click();
  await expect(region.locator('[data-route-state="selected"]')).toHaveCount(0);
  await expect(region.locator("[data-region-action]")).toHaveCount(0);
  await expect(region.locator("[data-region-detail-panel]")).not.toContainText(/Glassknife|GROUND-RUN|ORE DENSITY/);
  expect(await readInstalledSaveBytes(page)).toBe(before);
});

test("@keyboard region disclosure participates in the focus trap and Enter/Z only prepares the action", async ({ page }, info) => {
  const region = await openRegion(page, "keyboard");
  const before = await readInstalledSaveBytes(page);
  const selected = region.locator('[role="option"][aria-selected="true"]');
  await expect(selected).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(selected).toHaveAccessibleName("Cinder Relay Ruins, rumored");
  await page.keyboard.press("z");
  const survey = region.getByRole("button", { name: "Survey Cinder Relay Ruins", exact: true });
  await expect(survey).toBeFocused();
  expect(await readInstalledSaveBytes(page)).toBe(before);
  await selected.focus();
  await page.keyboard.press("Enter");
  await expect(survey).toBeFocused();
  expect(await readInstalledSaveBytes(page)).toBe(before);
  await page.keyboard.press("Tab");
  const details = region.locator("summary");
  await expect(details).toBeFocused();
  await page.keyboard.press("Space");
  await expect(region.locator("details")).toHaveAttribute("open", "");
  await page.keyboard.press("Tab");
  const back = region.getByRole("button", { name: "← RETURN TO ATLAS", exact: true });
  await expect(back).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(details).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(survey).toBeFocused();
  await page.keyboard.press("Space");
  await expect(region.getByRole("button", { name: "Travel to Cinder Relay Ruins", exact: true })).toBeVisible();
  expect((await readInstalledSave(page)).galaxyRun!.worldCycle).toBe(galaxyAtAshfall.galaxyRun!.worldCycle + 1);
  await evidence(page, info, "keyboard", "Enter/Z move focus without mutation; disclosure supports both Tab directions; native Space surveys exactly once.");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "OPEN ASHFALL REGION", exact: true })).toBeFocused();
});

for (const width of [390, 480]) {
  test(`@touch region ${width}px map keeps landmarks separate and reveals surveyed site details`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const region = await openRegion(page, "touch");
    await expectRouteGeometry(region);
    const before = await readInstalledSaveBytes(page);
    await region.getByRole("option", { name: "Basalt Basin, rumored", exact: true }).tap();
    expect(await readInstalledSaveBytes(page)).toBe(before);
    await region.locator("summary").tap();
    await expect(region.locator("details")).not.toContainText("ORE DENSITY");
    await region.getByRole("button", { name: "Survey Basalt Basin", exact: true }).tap();
    await expect(region.getByRole("option", { name: "Basalt Basin, surveyed", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(region.locator("details")).toContainText("ORE DENSITY");
    await region.getByRole("option", { name: "Oathbreaker Wreck, rumored", exact: true }).tap();
    await region.getByRole("button", { name: "Survey Oathbreaker Wreck", exact: true }).tap();
    await expect(region.getByRole("option", { name: "Glassknife Canyon, rumored", exact: true })).toBeVisible();
    await expect(region.getByRole("option", { name: "Ironreach Shelf, rumored", exact: true })).toBeVisible();
    await expectRouteGeometry(region);
    await region.locator("[data-region-map-field]").scrollIntoViewIfNeeded();
    await evidence(page, info, "touch", `${width}px reduced-motion map has separate 44px landmarks, aligned routes, no overflow; site statistics appear only after survey.`);
  });
}

for (const method of ["pointer", "touch"] as const) {
  const destination = method === "pointer" ? "Cinder Relay Ruins" : "Oathbreaker Wreck";
  const controls = method === "pointer" ? "First-person controls" : "Boarding controls";
  test(`@${method} region survey survives reload and explicitly launches ${destination}`, async ({ page }, info) => {
    let region = await openRegion(page, method);
    const legacy = await readLegacyDomainBytes(page);
    const cycle = (await readInstalledSave(page)).galaxyRun!.worldCycle;
    await activate(page, region.getByRole("option", { name: `${destination}, rumored`, exact: true }), method);
    await activate(page, region.getByRole("button", { name: `Survey ${destination}`, exact: true }), method);
    await expect(region.getByRole("option", { name: `${destination}, surveyed`, exact: true })).toBeVisible();
    expect((await readInstalledSave(page)).galaxyRun!.worldCycle).toBe(cycle + 1);
    expect(await readLegacyDomainBytes(page)).toBe(legacy);
    await page.reload();
    await activate(page, page.getByRole("button", { name: "CONTINUE GALAXY", exact: true }), method);
    await activate(page, page.getByRole("button", { name: "OPEN ASHFALL REGION", exact: true }), method);
    region = page.getByRole("dialog", { name: "Region map", exact: true });
    const beforeSelection = await readInstalledSaveBytes(page);
    await activate(page, region.getByRole("option", { name: `${destination}, surveyed`, exact: true }), method);
    expect(await readInstalledSaveBytes(page)).toBe(beforeSelection);
    await expect(region).toBeVisible();
    await captureMap(page, info);
    await activate(page, region.getByRole("button", { name: `Travel to ${destination}`, exact: true }), method);
    await expect(region).toBeHidden();
    await expect(page.getByRole("group", { name: controls, exact: true })).toBeVisible();
    expect((await readInstalledSave(page)).galaxyRun!.worldCycle).toBe(cycle + 2);
    expect(await readLegacyDomainBytes(page)).toBe(legacy);
    await evidence(page, info, method, `${destination} survey persisted one cycle across reload, preserving Legacy bytes; the separate travel action launched ${controls} and spent exactly one more cycle.`, false);
  });
}

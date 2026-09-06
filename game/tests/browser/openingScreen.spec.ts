import { expect, test, type Page } from "@playwright/test";

import { freshGalaxy, freshLegacy } from "./fixtures/routeFixtures";
import { installSaveFixture, readInstalledSave, readInstalledSaveBytes } from "./helpers/saveFixture";

async function observeAudio(page: Page) {
  await page.addInitScript(() => {
    const observations = { contexts: 0, tracks: [] as HTMLAudioElement[] };
    Object.assign(window, { openingAudio: observations });
    window.AudioContext = new Proxy(window.AudioContext, {
      construct(target, args) {
        observations.contexts += 1;
        return Reflect.construct(target, args);
      },
    });
    window.Audio = new Proxy(window.Audio, {
      construct(target, args) {
        const track = Reflect.construct(target, args) as HTMLAudioElement;
        observations.tracks.push(track);
        return track;
      },
    });
  });
}

function readAudio(page: Page) {
  return page.evaluate(() => {
    const observations = (window as unknown as {
      openingAudio: { contexts: number; tracks: HTMLAudioElement[] };
    }).openingAudio;
    return { contexts: observations.contexts, volumes: observations.tracks.map(track => track.volume) };
  });
}

test("@keyboard one title and optional help keep focus and launch authority", async ({ page }) => {
  await installSaveFixture(page, freshLegacy);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "SECTOR ZERO" })).toHaveCount(1);
  const before = await readInstalledSaveBytes(page);
  const controls = page.getByRole("button", { name: "CONTROLS", exact: true });
  await controls.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Controls", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Active-mode controls appear during play");
  const close = dialog.getByRole("button", { name: "CLOSE", exact: true });
  await expect(close).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("region", { name: "Controls content", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("region", { name: "Controls content", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(controls).toBeFocused();

  const story = page.getByRole("button", { name: "THE STORY SO FAR", exact: true });
  await page.setViewportSize({ width: 740, height: 360 });
  await story.focus();
  await page.keyboard.press("Space");
  const storyDialog = page.getByRole("dialog", { name: "The story so far", exact: true });
  await expect(storyDialog).toBeVisible();
  await expect(storyDialog).toContainText("Whatever the cost.");
  await page.keyboard.press("Tab");
  const storyContent = storyDialog.getByRole("region", { name: "Story content", exact: true });
  await expect(storyContent).toBeFocused();
  await page.keyboard.press("End");
  await expect.poll(() => storyContent.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(storyDialog).toBeHidden();
  await expect(story).toBeFocused();
  expect(await readInstalledSaveBytes(page)).toBe(before);
  await expect(page.getByRole("button", { name: "BEGIN GALAXY", exact: true })).toBeEnabled();
});

test("@pointer sound works before first launch and shares gameplay mute state", async ({ page }) => {
  await observeAudio(page);
  await installSaveFixture(page, { ...freshLegacy, introSeen: true });
  await page.goto("/");
  const sound = page.getByRole("button", { name: "SOUND ON", exact: true });
  await expect(sound).toBeVisible();
  expect(await readAudio(page)).toEqual({ contexts: 0, volumes: [] });
  await sound.click();
  await expect(page.getByRole("button", { name: "SOUND OFF", exact: true })).toBeVisible();
  expect(await readAudio(page)).toEqual({ contexts: 1, volumes: [] });
  await page.getByRole("button", { name: "LEGACY CAMPAIGN", exact: true }).click();
  const gameplaySound = page.getByRole("button", { name: "MUTE", exact: true });
  await expect(gameplaySound).toBeVisible();
  expect(await readAudio(page)).toEqual({ contexts: 1, volumes: [0] });
  await gameplaySound.click();
  await expect(page.getByRole("button", { name: "SND", exact: true })).toBeVisible();
  expect(await readAudio(page)).toEqual({ contexts: 1, volumes: [0.35] });
  await page.locator("#sector-zero-game-canvas").focus();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "SOUND ON", exact: true })).toBeVisible();
});

test("@touch story closes by touch without launching behind the panel", async ({ page }) => {
  await installSaveFixture(page, freshLegacy);
  await page.goto("/");
  const story = page.getByRole("button", { name: "THE STORY SO FAR", exact: true });
  await story.tap();
  const dialog = page.getByRole("dialog", { name: "The story so far", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "CLOSE", exact: true }).tap();
  await expect(dialog).toBeHidden();
  await expect(story).toBeFocused();
  expect((await readInstalledSave(page)).galaxyRun).toBeNull();
  await page.getByRole("button", { name: "BEGIN GALAXY", exact: true }).tap();
  await expect(page.getByRole("dialog", { name: "Galaxy Atlas", exact: true })).toBeVisible();
});

test("@keyboard launch choices wait for hydration and retain returning-save authority", async ({ page }) => {
  await installSaveFixture(page, freshGalaxy);
  let releaseScripts!: () => void;
  const scriptsReleased = new Promise<void>(resolve => { releaseScripts = resolve; });
  await page.route(/\/_next\/.*\.js(?:\?|$)/, async route => {
    await scriptsReleased;
    await route.continue();
  });
  try {
    await page.goto("/", { waitUntil: "commit" });
    await expect(page.getByRole("button", { name: "LOADING SAVE", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "LEGACY CAMPAIGN", exact: true })).toBeDisabled();
    await expect(page.getByRole("status")).toContainText("Reading your saved progress");
  } finally {
    releaseScripts();
  }
  const galaxy = page.getByRole("button", { name: "CONTINUE GALAXY", exact: true });
  await expect(galaxy).toBeEnabled();
  const before = await readInstalledSaveBytes(page);
  await galaxy.focus();
  await page.keyboard.press("Tab");
  const legacy = page.getByRole("button", { name: "LEGACY CAMPAIGN", exact: true });
  await expect(legacy).toBeFocused();
  expect(await readInstalledSaveBytes(page)).toBe(before);
  await page.keyboard.press("Space");
  await expect(legacy).toBeHidden();
  expect((await readInstalledSave(page)).activeExperience).toBe("legacy");
  await page.reload();
  await expect(galaxy).toBeEnabled();
  expect((await readInstalledSave(page)).activeExperience).toBe("legacy");
});

test("@pointer fresh Galaxy survives close and reload with native focus return", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installSaveFixture(page, freshLegacy);
  await page.goto("/");
  const opening = page.getByRole("main", { name: "Sector Zero opening screen" });
  const galaxy = page.getByRole("button", { name: "BEGIN GALAXY", exact: true });
  await expect(galaxy).toBeEnabled();
  await expect(opening.locator("img")).toHaveJSProperty("naturalWidth", 1672);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: testInfo.outputPath("game-ui-desktop-1440x900.png") });
  await galaxy.click();
  const atlas = page.getByRole("dialog", { name: "Galaxy Atlas", exact: true });
  await expect(atlas).toBeVisible();
  const begun = await readInstalledSave(page);
  expect(begun.activeExperience).toBe("galaxy");
  expect(begun.galaxyRun).not.toBeNull();
  await atlas.getByRole("button", { name: "← CLOSE ATLAS", exact: true }).click();
  const continued = page.getByRole("button", { name: "CONTINUE GALAXY", exact: true });
  await expect(continued).toBeFocused();
  await page.reload();
  await expect(continued).toBeEnabled();
  expect((await readInstalledSave(page)).galaxyRun).toEqual(begun.galaxyRun);
  await continued.click();
  await expect(atlas).toBeVisible();
});

test("@keyboard Galaxy begins with Enter and sound keyboard shortcut shares the same state", async ({ page }) => {
  await observeAudio(page);
  await installSaveFixture(page, freshLegacy);
  await page.goto("/");
  const opening = page.getByRole("main", { name: "Sector Zero opening screen" });
  await expect(page.getByRole("button", { name: "BEGIN GALAXY", exact: true })).toBeEnabled();
  await opening.click({ position: { x: 4, y: 4 } });
  await page.keyboard.press("m");
  await expect(page.getByRole("button", { name: "SOUND OFF", exact: true })).toBeVisible();
  expect(await readAudio(page)).toEqual({ contexts: 1, volumes: [] });
  await page.getByRole("button", { name: "BEGIN GALAXY", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Galaxy Atlas", exact: true })).toBeVisible();
  expect((await readInstalledSave(page)).activeExperience).toBe("galaxy");
  expect(await readAudio(page)).toEqual({ contexts: 1, volumes: [0] });
});

test("@touch narrow and short screens scroll, retain readable actions and reduce motion", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installSaveFixture(page, freshLegacy);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "BEGIN GALAXY", exact: true })).toBeEnabled();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: testInfo.outputPath("game-ui-mobile-480x854.png") });
  for (const viewport of [{ width: 320, height: 568 }, { width: 740, height: 360 }]) {
    await page.setViewportSize(viewport);
    await page.reload();
    await expect(page.getByRole("button", { name: "BEGIN GALAXY", exact: true })).toBeEnabled();
    await page.evaluate(() => document.fonts.ready);
    const opening = page.getByRole("main", { name: "Sector Zero opening screen" });
    await opening.evaluate(element => element.scrollTo(0, 0));
    expect(await opening.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await opening.evaluate(element => getComputedStyle(element).touchAction)).toBe("pan-y");
    expect(await page.locator("body").evaluate(element => getComputedStyle(element).touchAction)).toBe("pan-y");
    for (const name of ["BEGIN GALAXY", "LEGACY CAMPAIGN"]) {
      const button = page.getByRole("button", { name, exact: true });
      await expect(button).toBeInViewport({ ratio: 1 });
      const bounds = (await button.boundingBox())!;
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
    }
    await page.screenshot({ path: testInfo.outputPath(`game-ui-opening-${viewport.width}x${viewport.height}.png`) });
    const controls = page.getByRole("button", { name: "CONTROLS", exact: true });
    await controls.tap();
    const dialog = page.getByRole("dialog", { name: "Controls", exact: true });
    await expect(dialog).toBeVisible();
    const close = dialog.getByRole("button", { name: "CLOSE", exact: true });
    await expect(close).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath(`game-ui-controls-${viewport.width}x${viewport.height}.png`) });
    await close.tap();
    await opening.evaluate(element => element.scrollTo(0, 0));
    const session = await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 1, x: viewport.width - 10, y: viewport.height - 20 }] });
    for (const offset of [50, 100, 150, 200]) {
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ id: 1, x: viewport.width - 10, y: viewport.height - 20 - offset }] });
    }
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await session.detach();
    await expect.poll(() => opening.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    const galaxy = page.getByRole("button", { name: "BEGIN GALAXY", exact: true });
    expect(await galaxy.evaluate(element => getComputedStyle(element).transitionDuration)).toBe("0s");
  }
  await page.getByRole("button", { name: "LEGACY CAMPAIGN", exact: true }).tap();
  await expect(page.getByRole("main", { name: "Sector Zero opening screen" })).toBeHidden();
  expect(await page.locator("body").evaluate(element => getComputedStyle(element).touchAction)).toBe("none");
  expect((await readInstalledSave(page)).activeExperience).toBe("legacy");
});

import { expect, test, type Page } from "@playwright/test";

const basePath = "/sector-zero/site";
const gameURL = "https://colorpulse6.github.io/sector-zero/";
const slugs = [
  "vertical-shooter",
  "ground-run-and-gun",
  "ship-boarding",
  "first-person-raycaster",
  "ship-turret",
  "multi-phase-levels",
  "rpg-systems",
  "rpg-exploration",
];

async function expectImagesLoaded(page: Page) {
  for (const image of await page.locator("img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveJSProperty("complete", true);
    await expect
      .poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth))
      .toBeGreaterThan(0);
    expect(await image.getAttribute("src")).toMatch(
      new RegExp(`^${basePath}/`),
    );
  }
}

test("maker mark loads under the deployed site path", async ({ page }) => {
  await page.goto("./");
  const mark = page
    .getByRole("contentinfo")
    .getByRole("link", { name: "Built by Nic Barnes" })
    .locator("img");
  await mark.scrollIntoViewIfNeeded();
  await expect(mark).toHaveAttribute("src", `${basePath}/nb-mark.png`);
  await expect
    .poll(() => mark.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);
});

test("keyboard users can skip navigation and activate the game link", async ({
  page,
}) => {
  await page.goto("./");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  const play = page
    .getByRole("region", { name: "Answer the signal." })
    .getByRole("link", { name: "Play in browser", exact: true });
  await expect(play).toHaveAttribute("href", gameURL);
  await expect(play).toBeVisible();
  await page.route(gameURL, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<h1>Game destination</h1>",
    }),
  );
  await page.keyboard.press("Tab");
  await expect(play).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(gameURL);
});

test.describe("touch navigation", () => {
  test.use({ hasTouch: true });
  for (const viewport of [
    { width: 320, height: 740 },
    { width: 480, height: 854 },
    { width: 844, height: 390 },
  ]) {
    test(`navigation is reachable without overflow at ${viewport.width}×${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("./");
      const nav = page.getByRole("navigation", { name: "Main navigation" });
      for (const name of ["About", "Updates", "Colony", "Play now"]) {
        const link = nav.getByRole("link", { name, exact: true });
        await expect(link).toBeVisible();
        await expect(link).toBeInViewport();
        const box = await link.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);
      }
      await nav.getByRole("link", { name: "Colony", exact: true }).tap();
      await expect(page).toHaveURL(new RegExp(`${basePath}/coming-soon/`));
      await expect(
        nav.getByRole("link", { name: "Colony", exact: true }),
      ).toHaveAttribute("aria-current", "page");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    });
  }
});

test("all six gameplay previews link to preserved mode articles", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Answer the signal.",
  );
  const modes = page.getByRole("region", {
    name: "One universe. Six ways to fight.",
  });
  for (const slug of slugs.slice(0, 6)) {
    const link = modes.locator(`a[href='${basePath}/news/${slug}/']`);
    await expect(link).toHaveCount(1);
    await expect(link.locator("img")).toHaveAttribute("alt", /gameplay/i);
  }
  await expectImagesLoaded(page);
});

test("all secondary pages and eight articles keep headings and working images", async ({
  page,
}) => {
  test.setTimeout(90_000);
  for (const route of [
    "about/",
    "coming-soon/",
    "news/",
    ...slugs.map((slug) => `news/${slug}/`),
  ]) {
    const response = await page.goto(`./${route}`);
    expect(response?.ok(), route).toBe(true);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expectImagesLoaded(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      route,
    ).toBe(true);
  }
  await page.goto("./news/");
  await expect(page.locator("main .news-item")).toHaveCount(8);
});

test("story endings are optional and accessible by keyboard", async ({
  page,
}) => {
  await page.goto("./about/");
  const spoiler = page.getByText("Destroy the Hollow Mind", { exact: false });
  await expect(spoiler).toBeHidden();
  const disclosure = page.getByText("Reveal story spoilers", { exact: true });
  await disclosure.focus();
  await page.keyboard.press("Enter");
  await expect(spoiler).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(spoiler).toBeHidden();
});

test("reduced motion keeps the homepage and full article immediately usable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const route of ["./", "./news/rpg-exploration/"]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("link", { name: "Play now", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document
            .getAnimations()
            .filter((animation) => animation.playState === "running").length,
      ),
    ).toBe(0);
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Skip to content" }),
    ).toBeFocused();
  }
});

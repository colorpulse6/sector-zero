import { expect, test } from "@playwright/test";

test("@keyboard quartermaster preview loads directional cells and leaves the player save alone", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("sector-zero-save", "quartermaster-preview-sentinel");
    const evidence: Array<{ source: string; x: number; y: number; w: number; h: number }> = [];
    Object.assign(window, { pilotCrops: evidence });
    const original = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (this: CanvasRenderingContext2D, source: CanvasImageSource, ...args: number[]) {
      if (source instanceof HTMLImageElement && source.src.includes("/pilot/quartermaster/") && args.length === 8) {
        evidence.push({ source: source.src, x: args[0], y: args[1], w: args[2], h: args[3] });
      }
      Reflect.apply(original, this, [source, ...args]);
    } as typeof original;
  });
  await page.goto("/quartermaster-pilot/");
  await expect(page.getByRole("heading", { name: "The quartermaster" })).toBeVisible();
  await expect(page.getByText("Animation assets ready", { exact: true })).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: "Pause character", exact: true }).click();
  for (const [index, view] of ["Front", "Right side", "Back", "Left side"].entries()) {
    await page.getByRole("button", { name: view, exact: true }).click();
    await expect.poll(() => page.evaluate(row => (window as unknown as { pilotCrops: { source: string; y: number }[] }).pilotCrops.some(c => !c.source.includes("workstation") && c.y === row * 256), index * 2)).toBe(true);
  }
  const rows = await page.evaluate(() => [...new Set((window as unknown as { pilotCrops: { source: string; y: number }[] }).pilotCrops.filter(c => !c.source.includes("workstation")).map(c => c.y / 256))]);
  expect(rows).toEqual(expect.arrayContaining([0, 2, 4, 6]));
  await page.getByRole("button", { name: "Front", exact: true }).click();
  await info.attach("quartermaster-front", { body: await page.screenshot(), contentType: "image/png" });
  await page.getByRole("button", { name: "Resume character", exact: true }).click();
  await expect(page.getByTestId("pilot-action")).toHaveText("Walking", { timeout: 15000 });
  await expect(page.getByTestId("pilot-action")).toHaveText("Checking inventory", { timeout: 15000 });
  expect(await page.evaluate(() => localStorage.getItem("sector-zero-save"))).toBe("quartermaster-preview-sentinel");
  expect(errors).toEqual([]);
});

test("@keyboard unavailable pilot images retain the original character", async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { legacyQuartermasterDecoded: false });
    const original = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (this: CanvasRenderingContext2D, source: CanvasImageSource, ...args: number[]) {
      Reflect.apply(original, this, [source, ...args]);
      if (source instanceof HTMLImageElement && /npc-quartermaster(?:-[^/]*)?\.png/.test(source.src)) {
        const pixels = this.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
        if (pixels.some((value, index) => index % 4 === 3 && value > 200)) {
          Object.assign(window, { legacyQuartermasterDecoded: true });
        }
      }
    } as typeof original;
  });
  await page.route("**/sprites/pilot/quartermaster/**", route => route.abort());
  await page.goto("/quartermaster-pilot/");
  await expect(page.getByText("Original art fallback", { exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.locator("canvas").first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { legacyQuartermasterDecoded: boolean }).legacyQuartermasterDecoded)).toBe(true);
});

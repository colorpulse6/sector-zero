import { expect, test, type Page } from "@playwright/test";
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
type Snapshot = {
  scene: string; paused: boolean; credits: number; dialogue: boolean; shopOpen: boolean; x: number; y: number; heading: number;
  actors: { id: string; name: string; set: string; action: string; clock: number; x: number; y: number }[];
  sources: { paths: number; loaded: number; reservedBytes: number; residentBytes: number };
  frames: { bytes: number; slots: number; budget: number };
  render: { p50: number; p95: number; res: string; mode: string };
};
async function snapshot(page: Page): Promise<Snapshot> {
  return JSON.parse(await page.getByTestId("graphics-state").textContent() ?? "{}");
}
async function interact(page: Page) {
  await page.keyboard.down("z"); await page.waitForTimeout(80); await page.keyboard.up("z");
}
async function scene(page: Page, id: string) {
  await page.getByLabel("Scene", { exact: true }).selectOption(id);
  await expect.poll(async () => (await snapshot(page)).scene).toBe(id);
}

test("@keyboard graphics inspection uses every live scene and bounded caches across returns", async ({ page }, info) => {
  test.setTimeout(90000);
  const errors: string[] = [], failedImages: string[] = [];
  const measured = new Set<string>(), receipts: Snapshot[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("response", response => { if (response.url().includes("/sprites/") && response.status() >= 400) failedImages.push(response.url()); });
  await page.addInitScript(() => { localStorage.setItem("sector-zero-save", "graphics-inspection-sentinel"); localStorage.setItem("szFpResolution", "full"); });
  await page.goto(`${base}/graphics-preview/`);
  await expect(page.getByRole("heading", { name: "Graphics inspection" })).toBeVisible();
  for (const id of ["ashfall", "colony", "solar_array", "farm", "water_purifier", "habitat_module", "mine", "cantina", "station", "kepler", "cinder", "colony", "cantina", "station", "ashfall"]) {
    await scene(page, id);
    await expect.poll(async () => { const s = (await snapshot(page)).sources; return s.loaded === s.paths; }, { timeout: 30000 }).toBe(true);
    const current = await snapshot(page);
    expect(current.sources.reservedBytes).toBeLessThanOrEqual(80 * 1024 * 1024);
    expect(current.sources.residentBytes).toBeLessThanOrEqual(80 * 1024 * 1024);
    expect(current.frames.bytes).toBeLessThanOrEqual(40 * 1024 * 1024);
    expect(current.frames.slots).toBeLessThanOrEqual(320);
    if (!measured.has(id)) {
      measured.add(id);
      // Fill the actual renderer's 120-frame timing window after each scene load.
      await page.waitForTimeout(3000);
      receipts.push(await snapshot(page));
      await info.attach(`scene-${id}`, { body: await page.getByTestId("graphics-canvas").screenshot(), contentType: "image/png" });
    }
  }
  await page.getByRole("button", { name: "Pause simulation", exact: true }).click();
  const heading = (await snapshot(page)).heading;
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: "Turn 90°", exact: true }).click();
    const expected = Math.atan2(Math.sin(heading + (i + 1) * Math.PI / 2), Math.cos(heading + (i + 1) * Math.PI / 2));
    await expect.poll(async () => { const delta = (await snapshot(page)).heading - expected; return Math.abs(Math.atan2(Math.sin(delta), Math.cos(delta))); }).toBeLessThan(.001);
    await info.attach(`ashfall-turn-${i}`, { body: await page.getByTestId("graphics-canvas").screenshot(), contentType: "image/png" });
  }
  await expect.poll(async () => Math.abs((await snapshot(page)).heading - heading)).toBeLessThan(.001);
  expect(await page.evaluate(() => localStorage.getItem("sector-zero-save"))).toBe("graphics-inspection-sentinel");
  expect(errors).toEqual([]);
  expect(failedImages).toEqual([]);
  await info.attach("scene-render-receipts", { body: JSON.stringify(receipts, null, 2), contentType: "application/json" });
});

test("@keyboard graphics inspection keeps actor motion frozen while talking and purchases stay local", async ({ page }) => {
  await page.goto(`${base}/graphics-preview/`);
  await scene(page, "colony");
  await page.getByLabel("Actor", { exact: true }).selectOption({ label: "Quartermaster" });
  await page.getByRole("button", { name: "Front", exact: true }).click();
  const canvas = page.getByTestId("graphics-canvas");
  await canvas.focus();
  await interact(page);
  await expect.poll(async () => (await snapshot(page)).dialogue).toBe(true);
  const before = (await snapshot(page)).actors;
  await page.waitForTimeout(350);
  expect((await snapshot(page)).actors).toEqual(before);
  // Advance the actual merchant dialog until the normal shop opens. The canvas
  // renderer is unchanged; purchases go through the real in-memory save helper.
  for (let i = 0; i < 12 && !(await snapshot(page)).shopOpen; i++) { await page.waitForTimeout(300); await interact(page); await page.waitForTimeout(220); }
  await expect.poll(async () => (await snapshot(page)).shopOpen).toBe(true);
  const credits = (await snapshot(page)).credits;
  await page.waitForTimeout(300); await interact(page);
  await expect.poll(async () => (await snapshot(page)).credits).toBeLessThan(credits);
});

test("@keyboard missing rollout images keep legacy actors and recover after a scene return", async ({ page }) => {
  let blocked = true;
  await page.addInitScript(() => {
    Object.assign(window, { graphicsLegacyDecoded: false });
    const original = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (this: CanvasRenderingContext2D, source: CanvasImageSource, ...args: number[]) {
      Reflect.apply(original, this, [source, ...args]);
      if (source instanceof HTMLImageElement && /\/boarding\/npc-(voss|kael|reyes)\.png/.test(source.src)) {
        const pixels = this.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
        if (pixels.some((value, index) => index % 4 === 3 && value > 200)) Object.assign(window, { graphicsLegacyDecoded: true });
      }
    } as typeof original;
  });
  await page.route("**/sprites/actors/**", route => blocked ? route.abort() : route.continue());
  await page.goto(`${base}/graphics-preview/`);
  await expect.poll(async () => ((await snapshot(page)).actors?.length ?? 0)).toBeGreaterThan(0);
  await expect.poll(async () => (await snapshot(page)).sources.loaded).toBe(0);
  await expect(page.getByTestId("graphics-canvas")).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { graphicsLegacyDecoded: boolean }).graphicsLegacyDecoded)).toBe(true);
  blocked = false;
  await scene(page, "solar_array");
  await scene(page, "ashfall");
  await expect.poll(async () => { const s = (await snapshot(page)).sources; return s.paths > 0 && s.loaded === s.paths; }, { timeout: 30000 }).toBe(true);
});

test("@keyboard approved hostile designs render and combat keeps attack hurt and death feedback", async ({ page }, info) => {
  test.setTimeout(60000);
  await page.addInitScript(() => {
    const decoded = new Set<string>(); Object.assign(window, { approvedHostilesDecoded: decoded });
    const original = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (this: CanvasRenderingContext2D, source: CanvasImageSource, ...args: number[]) {
      Reflect.apply(original, this, [source, ...args]);
      if (source instanceof HTMLImageElement) {
        const match = source.src.match(/\/actors\/approved\/(grunt|charger|sentry)\.png/);
        if (match) {
          const pixels = this.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
          if (pixels.some((value, index) => index % 4 === 3 && value > 200)) decoded.add(match[1]);
        }
      }
    } as typeof original;
  });
  await page.goto(`${base}/graphics-preview/`);
  await scene(page, "station");
  await expect.poll(async () => (await snapshot(page)).sources.loaded).toBe(3);
  await page.getByRole("button", { name: "Pause simulation", exact: true }).click();
  for (const type of ["grunt", "charger", "sentry"]) {
    const actor = (await snapshot(page)).actors.find(a => a.name.endsWith(`· ${type}`))!;
    await page.getByLabel("Actor", { exact: true }).selectOption(actor.id);
    for (const view of ["Front", "Right side", "Back", "Left side"]) {
      await page.getByRole("button", { name: view, exact: true }).click();
      if (!await page.getByText("That side is blocked by the scene geometry.", { exact: true }).isVisible()) break;
    }
    await expect(page.getByText("That side is blocked by the scene geometry.", { exact: true })).not.toBeVisible();
    await expect.poll(() => page.evaluate(() => [...(window as unknown as { approvedHostilesDecoded: Set<string> }).approvedHostilesDecoded])).toContain(type);
    await info.attach(`${type}-in-map`, { body: await page.getByTestId("graphics-canvas").screenshot(), contentType: "image/png" });
  }
  const actor = (await snapshot(page)).actors.find(a => a.name.endsWith("· grunt"))!;
  await page.getByLabel("Actor", { exact: true }).selectOption(actor.id);
  await page.getByRole("button", { name: "Front", exact: true }).click();
  await page.getByRole("button", { name: "Resume simulation", exact: true }).click();
  await page.getByTestId("graphics-canvas").focus();
  const action = async () => (await snapshot(page)).actors.find(a => a.id === actor.id)?.action;
  await expect.poll(action, { timeout: 15000, intervals: [50] }).toBe("attack");
  await info.attach("attack-in-map", { body: await page.getByTestId("graphics-canvas").screenshot(), contentType: "image/png" });
  await page.keyboard.down("z");
  await expect.poll(action, { timeout: 10000, intervals: [50] }).toBe("hurt");
  await expect.poll(action, { timeout: 15000, intervals: [50] }).toBe("death");
  await page.keyboard.up("z");
  await info.attach("death-in-map", { body: await page.getByTestId("graphics-canvas").screenshot(), contentType: "image/png" });
  await expect.poll(async () => (await snapshot(page)).actors.some(a => a.id === actor.id)).toBe(false);
});

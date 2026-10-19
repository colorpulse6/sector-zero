import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
/** Set FIGHTER_CAPTURE_DIR to also save the frames as review artifacts (docs/assets/fighter-polish/<tag>). */
const captureDir = process.env.FIGHTER_CAPTURE_DIR;

type Snapshot = {
  scene: string; world: number; frame: number; loaded: boolean; graded: boolean; screen: string;
  enemies: { type: string; x: number; y: number; w: number; h: number; hp: number; cloaked: boolean }[];
  boss: { x: number; y: number; w: number; h: number; hp: number } | null;
  playerBullets: number; enemyBullets: number; particles: number; explosions: number; scrollY: number[];
  render: { p50: number; p95: number };
};
const snapshot = async (page: Page): Promise<Snapshot> => JSON.parse(await page.getByTestId("fighter-state").textContent() ?? "{}");
const api = (page: Page, call: string) => page.evaluate(`window.__fighterPreview.${call}`);
async function scene(page: Page, id: string) {
  await page.getByLabel("Scene", { exact: true }).selectOption(id);
  await expect.poll(async () => (await snapshot(page)).scene).toBe(id);
  await expect.poll(async () => (await snapshot(page)).loaded, { timeout: 30000 }).toBe(true);
  await api(page, "pause(true)");
}
async function capture(page: Page, info: { attach: (name: string, options: { body: Buffer; contentType: string }) => Promise<void> }, name: string) {
  const body = await page.getByTestId("fighter-frame").screenshot();
  await info.attach(name, { body, contentType: "image/png" });
  if (captureDir) { mkdirSync(captureDir, { recursive: true }); writeFileSync(path.join(captureDir, `${name}.png`), body); }
}
/** Raw (ungraded) 2D canvas pixel at x,y as [r,g,b,a]. */
const pixel = (page: Page, x: number, y: number) => page.evaluate(([px, py]) => {
  const canvas = document.querySelector('[data-testid="fighter-canvas"]') as HTMLCanvasElement;
  return [...canvas.getContext("2d")!.getImageData(px, py, 1, 1).data];
}, [x, y]);

test("@keyboard fighter scenes render, scroll and capture", async ({ page }, info) => {
  test.setTimeout(120000);
  const errors: string[] = [], failedImages: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => { if (response.url().includes("/sprites/") && response.status() >= 400) failedImages.push(response.url()); });
  await page.goto(`${base}/fighter-preview/`);
  await expect(page.getByRole("heading", { name: "Fighter inspection" })).toBeVisible();

  await scene(page, "showcase");
  await api(page, "step(1)");
  await capture(page, info, "showcase-graded");
  await api(page, "setGrade(false)");
  await capture(page, info, "showcase-raw");
  // Background travel: one far-layer tile period is 720px / 0.3px per frame = 2400 frames.
  await api(page, "step(1200)");
  await capture(page, info, "showcase-raw-scroll-1200");
  await api(page, "step(1200)");
  await capture(page, info, "showcase-raw-scroll-2400");
  await api(page, "setGrade(true)");
  await capture(page, info, "showcase-graded-scroll-2400");
  for (const world of [2, 3, 5]) {
    await page.getByLabel("World", { exact: true }).selectOption(String(world));
    await expect.poll(async () => (await snapshot(page)).world).toBe(world);
    await expect.poll(async () => (await snapshot(page)).loaded, { timeout: 30000 }).toBe(true);
    await api(page, "pause(true)");
    await api(page, "step(90)");
    await capture(page, info, `showcase-world${world}-graded`);
  }
  await page.getByLabel("World", { exact: true }).selectOption("1");

  await scene(page, "live");
  await api(page, "step(420)");
  await capture(page, info, "live-w1l1-f420");
  await api(page, "step(240)");
  await capture(page, info, "live-w1l1-f660");
  const live = await snapshot(page);
  expect(live.playerBullets + live.enemyBullets + live.particles + live.explosions).toBeGreaterThan(0);

  await scene(page, "boss");
  await api(page, "step(360)");
  await capture(page, info, "boss-rockjaw-f360");
  await api(page, "step(300)");
  await capture(page, info, "boss-rockjaw-f660");
  const boss = await snapshot(page);
  expect(boss.boss).not.toBeNull();
  // Free-running timing: the stepped captures above render once per batch, so
  // their window is dominated by first-use sprite preparation.
  await api(page, "pause(false)");
  await page.waitForTimeout(2500);
  await api(page, "pause(true)");
  const bossFree = (await snapshot(page)).render;
  await scene(page, "live");
  await api(page, "step(600)");
  await api(page, "pause(false)");
  await page.waitForTimeout(2500);
  await api(page, "pause(true)");
  const liveFree = (await snapshot(page)).render;
  const timing = JSON.stringify({ steppedLive: live.render, steppedBoss: boss.render, freeRunningLive: liveFree, freeRunningBoss: bossFree }, null, 2);
  await info.attach("render-timing", { body: timing, contentType: "application/json" });
  if (captureDir) writeFileSync(path.join(captureDir, "render-timing.json"), timing);

  expect(errors).toEqual([]);
  expect(failedImages).toEqual([]);
});

test("@keyboard enemy sprites leave no tinted rectangle around their silhouette", async ({ page }) => {
  await page.goto(`${base}/fighter-preview/`);
  await scene(page, "showcase");
  await api(page, "setGrade(false)");
  await api(page, "step(1)");
  const withEnemies = await snapshot(page);
  // The sprite box corners are outside every silhouette (the art is centred in
  // its frame); the old multiply overlay painted a 35% tint there.
  const probes = withEnemies.enemies.filter((e) => !e.cloaked).map((e) => [Math.round(e.x) + 1, Math.round(e.y) + 1] as const);
  const before = await Promise.all(probes.map(([x, y]) => pixel(page, x, y)));
  await api(page, "hideEnemies(true)");
  const after = await Promise.all(probes.map(([x, y]) => pixel(page, x, y)));
  const diffs = before.map((px, i) => Math.max(...px.map((v, c) => Math.abs(v - after[i][c]))));
  expect(diffs.every((d) => d <= 2), `corner tint deltas ${diffs.join(",")}`).toBe(true);
});

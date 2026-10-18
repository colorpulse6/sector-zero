import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/**
 * FPS enemy capture harness (@visual). It is not in any default project: it
 * exists to produce comparable viewport captures of the shared hostile through
 * the real renderer on the graphics-preview route, at near and mid range and
 * during attack, hurt and death. Run it against a static export with a config
 * whose project greps /@visual/ (see docs/assets/fps-enemy/README.md).
 *
 *   FPS_CAPTURE_SCENE  preview scene id (default "kepler")
 *   FPS_CAPTURE_ACTOR  index into the scene's hostiles (default 0)
 *   FPS_CAPTURE_TAG    file prefix, e.g. "before" / "after"
 */
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const SCENE = process.env.FPS_CAPTURE_SCENE ?? "kepler";
const ACTOR = Number(process.env.FPS_CAPTURE_ACTOR ?? 0);
const TAG = process.env.FPS_CAPTURE_TAG ?? "capture";

type Actor = { id: string; name: string; set?: string; action?: string; clock: number; x: number; y: number; facing: number };
type Snapshot = { scene: string; paused: boolean; x: number; y: number; heading: number; actors: Actor[]; sources: { paths: number; loaded: number } };

async function snapshot(page: Page): Promise<Snapshot> {
  return JSON.parse(await page.getByTestId("graphics-state").textContent() ?? "{}");
}
const distance = (s: Snapshot, a: Actor) => Math.hypot(a.x - s.x, a.y - s.y);
async function hold(page: Page, key: string, ms: number) {
  await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key);
}

test(`@visual fps enemy captures (${SCENE} #${ACTOR})`, async ({ page }, info) => {
  test.setTimeout(150000);
  const log: Record<string, unknown>[] = [];
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const canvas = page.getByTestId("graphics-canvas");
  let actorId = "";
  const shot = async (label: string) => {
    const s = await snapshot(page);
    const a = s.actors.find(x => x.id === actorId);
    const body = await canvas.screenshot();
    fs.writeFileSync(info.outputPath(`${TAG}-${label}.png`), body);
    await info.attach(`${TAG}-${label}`, { body, contentType: "image/png" });
    log.push({ label, paused: s.paused, distance: a ? Number(distance(s, a).toFixed(2)) : null, action: a?.action ?? null,
      clock: a?.clock ?? null, facing: a?.facing ?? null, player: [s.x, s.y, s.heading], enemy: a ? [a.x, a.y] : null });
  };
  const pause = async (on: boolean) => {
    const name = on ? "Pause simulation" : "Resume simulation";
    await page.getByRole("button", { name, exact: true }).click();
    await expect.poll(async () => (await snapshot(page)).paused).toBe(on);
  };
  const waitAction = async (want: string, timeout: number) => {
    try {
      await expect.poll(async () => (await snapshot(page)).actors.find(x => x.id === actorId)?.action, { timeout }).toBe(want);
      return true;
    } catch { return false; }
  };

  await page.addInitScript(() => {
    localStorage.setItem("sector-zero-save", "fps-enemy-capture-sentinel");
    localStorage.setItem("szFpResolution", "full");
  });
  await page.goto(`${base}/graphics-preview/`);
  await expect(page.getByRole("heading", { name: "Graphics inspection" })).toBeVisible();
  await page.getByLabel("Scene", { exact: true }).selectOption(SCENE);
  await expect.poll(async () => (await snapshot(page)).scene).toBe(SCENE);
  await expect.poll(async () => { const s = (await snapshot(page)).sources; return s.paths > 0 && s.loaded === s.paths; }, { timeout: 30000 }).toBe(true);
  await pause(true);
  const hostiles = (await snapshot(page)).actors.filter(a => a.id.startsWith("enemy:"));
  expect(hostiles.length).toBeGreaterThan(ACTOR);
  actorId = hostiles[ACTOR].id;
  await page.getByLabel("Actor", { exact: true }).selectOption(actorId);

  // Near range, paused: front and side rows as placed by the preview's view helper.
  await page.getByRole("button", { name: "Front", exact: true }).click();
  await page.waitForTimeout(400);
  await shot("near-front");
  await page.getByRole("button", { name: "Right side", exact: true }).click();
  await page.waitForTimeout(300);
  await shot("near-side");
  await page.getByRole("button", { name: "Front", exact: true }).click();
  await page.waitForTimeout(300);

  // Mid and far range: face away, walk off with the simulation running, turn
  // back and freeze. Focus the canvas after every button click; the preview only
  // reads keys while the canvas is the active element.
  for (const [label, ms] of [["mid", 450], ["far", 700]] as const) {
    await page.getByRole("button", { name: "Turn 90°", exact: true }).click();
    await page.getByRole("button", { name: "Turn 90°", exact: true }).click();
    await pause(false);
    await canvas.focus();
    await hold(page, "w", ms);
    await pause(true);
    await page.getByRole("button", { name: "Turn 90°", exact: true }).click();
    await page.getByRole("button", { name: "Turn 90°", exact: true }).click();
    await page.waitForTimeout(250);
    await shot(label);
  }

  // Approach and attack: let the hostile come to the player.
  await pause(false);
  await canvas.focus();
  const t0 = Date.now();
  let walkShots = 0;
  while (Date.now() - t0 < 12000 && walkShots < 3) {
    const s = await snapshot(page); const a = s.actors.find(x => x.id === actorId);
    if (a?.action === "attack") break;
    if (a?.action === "walk") { await shot(`approach-${walkShots++}`); }
    await page.waitForTimeout(350);
  }
  if (await waitAction("attack", 15000)) {
    await shot("attack-0");
    await page.waitForTimeout(150);
    await shot("attack-1");
  }

  // Hurt and death: fire at the hostile in front of the camera.
  await canvas.focus();
  let hurt = false, dead = false;
  for (let i = 0; i < 16 && !dead; i++) {
    await hold(page, "z", 90);
    const a = (await snapshot(page)).actors.find(x => x.id === actorId);
    if (!hurt && a?.action === "hurt") { hurt = true; await shot("hurt"); }
    if (a?.action === "death") { dead = true; await shot("death-0"); await page.waitForTimeout(200); await shot("death-1"); }
    await page.waitForTimeout(160);
  }
  if (!dead && await waitAction("death", 1500)) { await shot("death-0"); await page.waitForTimeout(200); await shot("death-1"); }

  fs.writeFileSync(info.outputPath(`${TAG}-log.json`), JSON.stringify({ scene: SCENE, actor: actorId, errors, captures: log }, null, 2));
  await info.attach(`${TAG}-log`, { body: JSON.stringify(log, null, 2), contentType: "application/json" });
  expect(errors).toEqual([]);
  expect(log.some(entry => entry.label === "near-front")).toBe(true);
});

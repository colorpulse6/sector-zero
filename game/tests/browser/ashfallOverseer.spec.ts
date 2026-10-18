/** Ashfall Primary's Overseer presentation (design/ashfall-lock, runtime slice 1).
 *  Isolated spec: reuses the shipped galaxyAtAshfall fixture and save helpers, changes none of them.
 *  Observes only rendered canvas output (text, decoded images) and the installed save. */
import { expect, test, type Page } from "@playwright/test";
import { galaxyAtAshfall } from "./fixtures/routeFixtures";
import { attachBrowserReceipt } from "./helpers/receipt";
import { installSaveFixture, readInstalledSave, readInstalledSaveBytes, readLegacyDomainBytes } from "./helpers/saveFixture";

type Point = { x: number; y: number };
type Frame = { seq: number; player: Point };
type OverseerEvidence = { frames: Frame[]; texts: string[]; images: string[] };
declare global { interface Window { ashfallOverseerEvidence: OverseerEvidence } }

const CANVAS = "#sector-zero-game-canvas";

// Forward every original canvas call; record the minimap player dot (position), every
// fillText on the game canvas, and the src of every HTMLImageElement handed to drawImage.
async function observe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const evidence: OverseerEvidence = window.ashfallOverseerEvidence = { frames: [], texts: [], images: [] };
    let origin: Point | undefined;
    let seq = 0;
    const active = (context: CanvasRenderingContext2D) => context.canvas.id === "sector-zero-game-canvas";
    const fillRect = CanvasRenderingContext2D.prototype.fillRect;
    CanvasRenderingContext2D.prototype.fillRect = function (x, y, width, height) {
      if (active(this) && y === 6 && x + width === 474 && this.fillStyle === "rgba(0, 0, 0, 0.7)") origin = { x: x + 2, y: y + 2 };
      fillRect.call(this, x, y, width, height);
    };
    const arc = CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.arc = function (x, y, radius, start, end, counterclockwise) {
      if (active(this) && this.fillStyle === "#44ccff" && radius === 2 && origin) {
        evidence.frames.push({ seq: ++seq, player: { x: (x - origin.x) / 3, y: (y - origin.y) / 3 } });
        if (evidence.frames.length > 2000) evidence.frames.splice(0, 1000);
      }
      arc.call(this, x, y, radius, start, end, counterclockwise);
    };
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
      if (active(this)) {
        evidence.texts.push(String(text));
        if (evidence.texts.length > 4000) evidence.texts.splice(0, 2000);
      }
      if (maxWidth === undefined) fillText.call(this, text, x, y);
      else fillText.call(this, text, x, y, maxWidth);
    };
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (this: CanvasRenderingContext2D, source: CanvasImageSource, ...args: number[]) {
      if (source instanceof HTMLImageElement && !evidence.images.includes(source.src)) evidence.images.push(source.src);
      Reflect.apply(drawImage, this, [source, ...args]);
    } as typeof drawImage;
  });
}

async function freshFrames(page: Page, count: number): Promise<void> {
  const seq = await page.evaluate(() => window.ashfallOverseerEvidence.frames.at(-1)?.seq ?? 0);
  await page.waitForFunction(({ seq, count }) => (window.ashfallOverseerEvidence.frames.at(-1)?.seq ?? 0) >= seq + count, { seq, count });
}

async function interact(page: Page): Promise<void> {
  await page.keyboard.down("z");
  try { await freshFrames(page, 3); }
  finally { await page.keyboard.up("z"); }
  await freshFrames(page, 18);
}

async function moveUntil(page: Page, key: string, axis: "x" | "y", target: number): Promise<void> {
  await page.keyboard.down(key);
  try {
    await page.waitForFunction(({ axis, target }) => {
      const value = window.ashfallOverseerEvidence.frames.at(-1)?.player[axis];
      return value !== undefined && value <= target;
    }, { axis, target }, { timeout: 20_000 });
  } finally { await page.keyboard.up(key); }
  await freshFrames(page, 2);
}

async function expectText(page: Page, text: string): Promise<void> {
  await expect.poll(() => page.evaluate(text => window.ashfallOverseerEvidence.texts.includes(text), text)).toBe(true);
}

async function renderedText(page: Page): Promise<string> {
  return page.evaluate(() => window.ashfallOverseerEvidence.texts.join(" "));
}

test("@keyboard Ashfall Primary's Overseer stands at the plaza as the reviewed static billboard and reads the yard", async ({ page }, info) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  let stage = "descent", passed = false;
  try {
    await observe(page);
    await installSaveFixture(page, galaxyAtAshfall);
    await page.goto("/");
    await page.getByRole("button", { name: "CONTINUE GALAXY", exact: true }).click();
    const atlas = page.getByRole("dialog", { name: "Galaxy Atlas", exact: true });
    await expect(atlas).toBeVisible();
    // Baseline after the app's own load normalisation (as galaxyColony.spec does), so the
    // byte checks isolate what the Overseer visit writes: nothing.
    const saveBefore = await readInstalledSaveBytes(page);
    const legacyBefore = await readLegacyDomainBytes(page);
    await atlas.getByRole("button", { name: "DESCEND TO COLONY", exact: true }).click();
    await expect(atlas).toBeHidden();
    await expect(page.locator(CANVAS)).toBeFocused();
    await freshFrames(page, 3);
    const spawn = await page.evaluate(() => window.ashfallOverseerEvidence.frames.at(-1)!);
    expect(spawn.player).toEqual({ x: 11.5, y: 22.5 });
    await info.attach("ashfall-overseer-arrival", { body: await page.screenshot(), contentType: "image/png" });

    stage = "plaza approach";
    await moveUntil(page, "w", "y", 13.2);
    await expectText(page, "[Z] Talk to Overseer Ashfall Primary");
    const images = await page.evaluate(() => window.ashfallOverseerEvidence.images);
    expect(images.some(src => src.includes("/sprites/boarding/npc-hub-governor.png"))).toBe(true);
    expect(images.some(src => src.includes("/sprites/actors/voss/"))).toBe(false);
    await info.attach("ashfall-overseer-approach", { body: await page.screenshot(), contentType: "image/png" });

    stage = "dialogue";
    await interact(page);
    await expectText(page, "Overseer");
    await expect.poll(() => renderedText(page)).toContain("Welcome to the colony, pilot. Here's where we stand.");
    await expect.poll(() => page.evaluate(() => window.ashfallOverseerEvidence.images.some(src => src.includes("/sprites/portraits/hub-governor.png")))).toBe(true);
    await info.attach("ashfall-overseer-dialog-greeting", { body: await page.screenshot(), contentType: "image/png" });
    await interact(page); // population line
    await interact(page); // yard line
    await expect.poll(() => renderedText(page)).toContain("No buildings yet. The yard's empty.");
    const rendered = await renderedText(page);
    expect(rendered).not.toMatch(/Governor:|Idowu|Dace/);
    await info.attach("ashfall-overseer-dialog-yard", { body: await page.screenshot(), contentType: "image/png" });

    stage = "isolation";
    expect(await readLegacyDomainBytes(page)).toBe(legacyBefore);
    expect(await readInstalledSaveBytes(page)).toBe(saveBefore);
    expect(errors).toEqual([]);
    passed = true;
  } finally {
    await info.attach("ashfall-overseer-observations", {
      body: Buffer.from(JSON.stringify({ stage, errors, evidence: await page.evaluate(() => ({
        ...window.ashfallOverseerEvidence, frames: window.ashfallOverseerEvidence.frames.slice(-5),
      })).catch(() => null) }, null, 2)),
      contentType: "application/json",
    });
    await attachBrowserReceipt(info, {
      inputMethod: "keyboard", saveFixture: "galaxyAtAshfall (shipped route fixture, unchanged)",
      route: "CONTINUE GALAXY -> DESCEND TO COLONY -> walk north to the plaza -> talk to the Overseer -> three lines",
      expectedOutcome: "The Overseer renders from the reviewed hub-governor billboard (no Voss atlas), speaks as 'Overseer' with the hub-governor portrait, and reports no buildings and an empty yard; the save and Legacy bytes are unchanged.",
      observedOutcome: passed ? "Static hub-governor billboard decoded, Overseer portrait drawn, greeting and yard lines rendered, save bytes unchanged, no page errors." : `Failed during ${stage}; see observations and screenshots.`,
    });
  }
});


test("@keyboard Ashfall Overseer describes a pad commission without another descent", async ({ page }, info) => {
  const funded = structuredClone(galaxyAtAshfall);
  funded.galaxyRun!.colonies.find(colony => colony.id === "galaxy:ashfall-primary")!.resources.metal = 80;
  await observe(page);
  await installSaveFixture(page, funded);
  await page.goto("/");
  await page.getByRole("button", { name: "CONTINUE GALAXY", exact: true }).click();
  const legacyBefore = await readLegacyDomainBytes(page);
  await page.getByRole("button", { name: "DESCEND TO COLONY", exact: true }).click();
  await freshFrames(page, 3);
  await interact(page);
  const pad = page.getByRole("dialog", { name: "Landing pad exit menu", exact: true });
  await pad.getByRole("button", { name: "COLONY MANAGEMENT", exact: true }).click();
  const management = page.getByRole("dialog", { name: "Colony management", exact: true });
  await management.getByRole("button", { name: "Build", exact: true }).click();
  await expect(management.getByRole("status")).toHaveText("SOLAR ARRAY COMMISSIONED · READY IN 1 CYCLE");
  await management.getByRole("button", { name: "← BACK", exact: true }).click();
  await pad.getByRole("button", { name: "Resume", exact: true }).click();
  await moveUntil(page, "w", "y", 13.2);
  await interact(page); // greeting
  await interact(page); // population
  await interact(page); // current construction
  await expect.poll(() => renderedText(page)).toContain("The solar array's going up.");
  await interact(page); // current yard
  await expect.poll(() => renderedText(page)).toContain("The yard's empty.");
  expect(await readLegacyDomainBytes(page)).toBe(legacyBefore);
  const colony = (await readInstalledSave(page)).galaxyRun!.colonies.find(entry => entry.id === "galaxy:ashfall-primary")!;
  expect(colony.resources.metal).toBe(0);
  expect(colony.buildings.map(building => building.status)).toEqual(["constructing"]);
  const capture = info.outputPath("ashfall-overseer-after-build.png");
  await page.screenshot({ path: capture });
  await info.attach("ashfall-overseer-after-build", { path: capture, contentType: "image/png" });
  await attachBrowserReceipt(info, {
    inputMethod: "keyboard", saveFixture: "galaxyAtAshfall + 80 metal",
    route: "DESCEND -> pad management -> Build -> Back -> Resume -> walk to Overseer -> talk",
    expectedOutcome: "The existing walk's Overseer describes the just-commissioned Solar Array and spent metal without another descent; legacy bytes stay unchanged.",
    observedOutcome: "Constructing and empty-yard lines rendered after a real pad commission; one saved building, zero metal and unchanged legacy bytes.",
  });
});

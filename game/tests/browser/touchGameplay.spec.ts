import { expect, test, type CDPSession, type Locator, type Page, type TestInfo } from "@playwright/test";
import { allPlanetsLaunchable, freshLegacy, galaxyAtAshfall } from "./fixtures/routeFixtures";
import { installSaveFixture } from "./helpers/saveFixture";
import { attachBrowserReceipt } from "./helpers/receipt";

const CANVAS = "#sector-zero-game-canvas";
type Point = { x: number; y: number };
type Motion = "ship" | "fp" | "turret";
type Frame = {
  seq: number; ship?: Point;
  fp?: Point; heading?: Point; turret?: Point; mapSize?: number;
  shipShots: Point[];
  gun: boolean; turretFire: boolean; bombs: number | null;
};
type NativeEvidence = {
  type: string; target: string; trusted?: boolean; pointerId?: number; primary?: boolean;
  x?: number; y?: number; pressed?: string | null; connected?: boolean;
  touches?: number[]; changed?: number[]; seq: number; fp?: Point; heading?: Point; mapSize?: number;
};
declare global { interface Window { touchEvidence: { frames: Frame[]; texts: string[]; events: NativeEvidence[]; pointerCancels: number } } }
declare global { interface Window { touchGradeContextRequests?: string[] } }

// Observe only pixels' drawing arguments. No application state, clock, or
// simulation function is replaced. Every intercepted draw is forwarded intact.
async function installObservation(page: Page) {
  await page.addInitScript(() => {
    const evidence = window.touchEvidence = { frames: [] as Frame[], texts: [] as string[], events: [] as NativeEvidence[], pointerCancels: 0 };
    window.addEventListener("pointercancel", () => { evidence.pointerCancels++; });
    const record = (entry: Omit<NativeEvidence, "seq">) => {
      const frame = evidence.frames.at(-1);
      evidence.events.push({ ...entry, seq: frame?.seq ?? 0, fp: frame?.fp, heading: frame?.heading, mapSize: frame?.mapSize });
      if (evidence.events.length > 1_000) evidence.events.splice(0, 500);
    };
    for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel", "gotpointercapture", "lostpointercapture", "touchstart", "touchend", "touchcancel", "blur"]) {
      window.addEventListener(type, (event) => {
        const target = event.target instanceof Element ? event.target : null;
        record({ type, target: target?.getAttribute("aria-label") ?? target?.id ?? "window", trusted: event.isTrusted,
          pressed: target?.getAttribute("aria-pressed"), connected: target?.isConnected,
          ...(event instanceof PointerEvent ? { pointerId: event.pointerId, primary: event.isPrimary, x: event.clientX, y: event.clientY } : {}),
          ...(event instanceof TouchEvent ? { touches: [...event.touches].map((touch) => touch.identifier), changed: [...event.changedTouches].map((touch) => touch.identifier) } : {}),
        });
      }, { capture: true, passive: true });
    }
    window.addEventListener("DOMContentLoaded", () => {
      new MutationObserver((records) => {
        for (const mutation of records) {
          for (const [type, nodes] of [["controls-added", mutation.addedNodes], ["controls-removed", mutation.removedNodes]] as const) {
            for (const node of nodes) {
              if (!(node instanceof Element)) continue;
              for (const element of [node, ...node.querySelectorAll('[role="group"]')]) {
                const label = element.getAttribute("aria-label");
                if (element.getAttribute("role") === "group" && label?.endsWith(" controls")) record({ type, target: label, connected: element.isConnected });
              }
            }
          }
        }
      }).observe(document.documentElement, { childList: true, subtree: true });
    });
    let seq = 0;
    let bombs: number | null = null;
    const empty = (): Frame => ({ seq: 0, shipShots: [], gun: false, turretFire: false, bombs });
    let pending = empty();
    let miniMap: Point | undefined;
    let fpDot: Point | undefined;
    const active = (ctx: CanvasRenderingContext2D) => ctx.canvas.id === "sector-zero-game-canvas";
    // Follow image provenance through prepared sprite canvases. This observes
    // real draws only; it does not read or replace simulation state.
    const spriteSources = new WeakMap<HTMLCanvasElement, string>();
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (this: CanvasRenderingContext2D, source: CanvasImageSource, ...args: number[]) {
      const src = source instanceof HTMLImageElement ? source.currentSrc || source.src
        : source instanceof HTMLCanvasElement ? spriteSources.get(source) ?? "" : "";
      if (!active(this) && /\/(ships\/player|bullets\/player-bullets)\.png$/.test(src)) {
        spriteSources.set(this.canvas, src);
      }
      if (active(this) && src) {
        const offset = args.length === 8 ? 4 : 0;
        const point = { x: args[offset], y: args[offset + 1] };
        const width = args[offset + 2] ?? (source as HTMLImageElement | HTMLCanvasElement).width;
        const height = args[offset + 3] ?? (source as HTMLImageElement | HTMLCanvasElement).height;
        const center = { x: point.x + width / 2, y: point.y + height / 2 };
        // A banked hull changes its drawn bounds, but its center remains the
        // movement anchor. Bullets now draw around a translated/rotated origin.
        if (src.endsWith("/ships/player.png")) pending.ship = center;
        else if (src.endsWith("/bullets/player-bullets.png")) {
          const transformed = this.getTransform().transformPoint(center);
          pending.shipShots.push({ x: transformed.x, y: transformed.y });
        }
        else if (src.endsWith("/boarding/gun-sheet.png")) pending.gun ||= args[0] > 0;
        else if (src.endsWith("/turret/crosshair.png")) pending.turret = { x: point.x + 24, y: point.y + 24 };
      }
      Reflect.apply(drawImage, this, [source, ...args]);
    } as typeof CanvasRenderingContext2D.prototype.drawImage;
    const fillRect = CanvasRenderingContext2D.prototype.fillRect;
    CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) {
      if (active(this)) {
        if (y === 6 && w === h && this.fillStyle === "rgba(0, 0, 0, 0.7)") {
          miniMap = { x: x + 2, y: y + 2 };
          pending.mapSize = w;
        }
      }
      fillRect.call(this, x, y, w, h);
    };
    const arc = CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.arc = function (x, y, radius, start, end, counterclockwise) {
      if (active(this)) {
        if (this.fillStyle === "#44ccff" && radius === 2 && miniMap) {
          fpDot = { x, y };
          pending.fp = { x: (x - miniMap.x) / 3, y: (y - miniMap.y) / 3 };
        }
        if (radius === 30 && this.fillStyle === "rgba(255, 220, 100, 0.15)") pending.turretFire = true;
      }
      arc.call(this, x, y, radius, start, end, counterclockwise);
    };
    const lineTo = CanvasRenderingContext2D.prototype.lineTo;
    CanvasRenderingContext2D.prototype.lineTo = function (x, y) {
      if (active(this) && this.strokeStyle === "#44ccff" && this.lineWidth === 1 && fpDot) {
        pending.heading = { x: (x - fpDot.x) / 8, y: (y - fpDot.y) / 8 };
      }
      lineTo.call(this, x, y);
    };
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (value, x, y, maxWidth) {
      if (active(this)) {
        evidence.texts.push(String(value));
        if (evidence.texts.length > 2_000) evidence.texts.splice(0, 1_000);
        const match = String(value).match(/^\[B\] ●×(\d+)$/);
        if (match) pending.bombs = bombs = Number(match[1]);
      }
      if (maxWidth === undefined) fillText.call(this, value, x, y);
      else fillText.call(this, value, x, y, maxWidth);
    };
    const sample = () => {
      if (pending.ship || pending.fp || pending.turret) {
        pending.seq = ++seq;
        evidence.frames.push(pending);
        if (evidence.frames.length > 3_000) evidence.frames.splice(0, 1_000);
      }
      pending = empty();
      fpDot = undefined;
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

async function center(target: Locator, x = 0.5, y = 0.5): Promise<Point> {
  const box = await target.boundingBox();
  expect(box, "The visible input target must have bounds").not.toBeNull();
  return { x: box!.x + box!.width * x, y: box!.y + box!.height * y };
}

class Fingers {
  private points = new Map<number, Point>();
  constructor(private session: CDPSession) {}
  private async send(type: "touchStart" | "touchMove" | "touchEnd" | "touchCancel") {
    await this.session.send("Input.dispatchTouchEvent", {
      type, touchPoints: [...this.points].map(([id, point]) => ({ id, ...point, radiusX: 2, radiusY: 2, force: 1 })),
    });
  }
  async down(id: number, target: Locator | Point) {
    this.points.set(id, "boundingBox" in target ? await center(target) : target);
    await this.send("touchStart");
  }
  async move(id: number, target: Locator | Point) {
    if (!this.points.has(id)) throw new Error(`Finger ${id} is not down`);
    this.points.set(id, "boundingBox" in target ? await center(target) : target);
    await this.send("touchMove");
  }
  async up(id: number) {
    const point = this.points.get(id);
    if (!point) throw new Error(`Finger ${id} is not down`);
    this.points.delete(id);
    // Chromium releases the supplied IDs on touchEnd. A touchMove containing
    // only the remaining IDs does not release anything (verified on a blank page).
    await this.session.send("Input.dispatchTouchEvent", {
      type: "touchEnd", touchPoints: this.points.size ? [{ id, ...point }] : [],
    });
  }
  async tap(id: number, target: Locator) { await this.down(id, target); await this.up(id); }
  async cancel() { this.points.clear(); await this.send("touchCancel"); }
  async close() { await this.cancel().catch(() => {}); await this.session.detach().catch(() => {}); }
}

const action = (page: Page, label: string) => page.getByRole("button", { name: label, exact: true });
async function frames(page: Page, kind: Motion, count = 10, afterSeq?: number): Promise<Frame[]> {
  const seq = afterSeq ?? await page.evaluate(() => window.touchEvidence.frames.at(-1)?.seq ?? 0);
  await page.waitForFunction(({ seq, kind, count }) => window.touchEvidence.frames.filter((f) => f.seq > seq && f[kind]).length >= count, { seq, kind, count });
  return page.evaluate(({ seq, kind }) => window.touchEvidence.frames.filter((f) => f.seq > seq && f[kind]), { seq, kind });
}
function displacement(observed: Frame[], kind: Motion): Point {
  const first = observed[0][kind]!;
  const last = observed.at(-1)![kind]!;
  const x = last.x - first.x;
  return { x, y: last.y - first.y };
}
function still(observed: Frame[], kind: Motion, tolerance = 0.001) {
  const delta = displacement(observed, kind);
  expect(Math.abs(delta.x), `${kind} horizontal position`).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(delta.y), `${kind} vertical position`).toBeLessThanOrEqual(tolerance);
}
// An old projectile cannot re-enter the muzzle region once it has left it.
// Requiring an empty -> occupied transition at a stationary player proves a
// fresh shot. FP/turret similarly require a fresh off -> on firing animation.
function freshFireCycleObserved({ seq, kind, observed = window.touchEvidence.frames }: { seq: number; kind: Motion; observed?: Frame[] }): boolean {
  let cleared = false;
  for (const frame of observed) {
    if (frame.seq <= seq || !frame[kind]) continue;
    const active = kind === "fp" ? frame.gun : kind === "turret" ? frame.turretFire
      : frame.shipShots.some((shot) => shot.y > frame.ship!.y - 40 && shot.y < frame.ship!.y + 10);
    if (!active) cleared = true;
    else if (cleared) return true;
  }
  return false;
}
async function freshFireCycle(page: Page, kind: Motion): Promise<Frame[]> {
  const seq = await page.evaluate(() => window.touchEvidence.frames.at(-1)?.seq ?? 0);
  await page.waitForFunction(freshFireCycleObserved, { seq, kind }, { timeout: 5_000 });
  return page.evaluate(({ seq, kind }) => window.touchEvidence.frames.filter((frame) => frame.seq > seq && frame[kind]), { seq, kind });
}

async function receipt(page: Page, testInfo: TestInfo, route: string, fixture: string, outcome: string, inputMethod: "touch" | "pointer" | "keyboard" = "touch") {
  const screenshotPath = testInfo.outputPath("gameplay-controls.png");
  await page.screenshot({ path: screenshotPath });
  await testInfo.attach("gameplay-controls", { path: screenshotPath, contentType: "image/png" });
  await attachBrowserReceipt(testInfo, { route, saveFixture: fixture, inputMethod, expectedOutcome: outcome, observedOutcome: outcome });
}
async function withFingers(page: Page, run: (fingers: Fingers) => Promise<void>) {
  const fingers = new Fingers(await page.context().newCDPSession(page));
  try { await run(fingers); } finally { await fingers.close(); }
}
async function switchMode(page: Page, launch: string) {
  await action(page, "DEV").click();
  await action(page, launch).click();
  await action(page, "X").click();
}

async function openMode(page: Page, launch: string, skipBriefing = true) {
  await installSaveFixture(page, freshLegacy);
  await page.goto("/");
  await page.getByRole("button", { name: "DEV", exact: true }).tap();
  await page.getByRole("button", { name: launch, exact: true }).tap();
  await page.getByRole("button", { name: "X", exact: true }).tap();
  if (launch === "1-1" && skipBriefing) await page.locator("#sector-zero-game-canvas").tap();
}

const profiles = [
  { launch: "1-1", name: "Shooter", actions: ["Move left", "Move right", "Move up", "Move down", "Fire", "Bomb"] },
  { launch: "FIRST PERSON", name: "First-person", actions: ["Move forward", "Move backward", "Strafe left", "Strafe right", "Look left", "Look right", "Interact", "Fire"] },
  { launch: "TURRET", name: "Turret", actions: ["Fire"] },
  { launch: "DAY", name: "Colony", actions: ["Move forward", "Move backward", "Strafe left", "Strafe right", "Look left", "Look right", "Interact"] },
] as const;

const controlProfileCases = [
  ...profiles.map((profile) => ({ ...profile, withoutWebGL: false })),
  { ...profiles[2], withoutWebGL: true },
];

for (const profile of controlProfileCases) {
  test(`@touch ${profile.name} exposes its visible control profile at 480x854${profile.withoutWebGL ? " without WebGL" : ""}`, async ({ page }, testInfo) => {
    if (profile.withoutWebGL) {
      // Environmental fault injection only: unavailable GL contexts exercise
      // the shipped grade fallback. The 2D renderer and game state are intact.
      await page.addInitScript(() => {
        window.touchGradeContextRequests = [];
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string, ...args: unknown[]) {
          if (["webgl", "webgl2", "experimental-webgl"].includes(contextId)) {
            window.touchGradeContextRequests!.push(contextId);
            return null;
          }
          return Reflect.apply(getContext, this, [contextId, ...args]);
        } as typeof HTMLCanvasElement.prototype.getContext;
      });
    }
    await openMode(page, profile.launch);
    if (profile.withoutWebGL) {
      expect(await page.evaluate(() => window.touchGradeContextRequests)).toContain("webgl");
      await expect(page.locator(CANVAS).locator("..").locator("canvas").nth(1)).toHaveCSS("display", "none");
    }
    const controls = page.getByRole("group", { name: `${profile.name} controls`, exact: true });
    await expect(controls).toBeVisible();
    for (const label of profile.actions) {
      const button = controls.getByRole("button", { name: label, exact: true });
      await expect(button).toBeVisible();
      const bounds = await button.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.width).toBeGreaterThanOrEqual(44);
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(480);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(854);
    }
    const targets = await controls.getByRole("button").all();
    const boxes = await Promise.all(targets.map((target) => target.boundingBox()));
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!; const b = boxes[j]!;
        const overlap = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 0.5 &&
          Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 0.5;
        expect(overlap, `Control targets ${i} and ${j} overlap`).toBe(false);
      }
    }
    const gradeObservations: Array<{ viewport: string; presentation: "graded" | "raw-2d" }> = [];
    const assertClearGameImage = async () => {
      const gameCanvas = page.locator(CANVAS);
      await expect(gameCanvas).toBeVisible();
      const canvas = (await gameCanvas.boundingBox())!;
      expect(canvas).not.toBeNull();
      expect(canvas.width).toBeGreaterThan(0);
      expect(canvas.height).toBeGreaterThan(0);
      const gradeOverlay = gameCanvas.locator("..").locator("canvas").nth(1);
      await expect(gradeOverlay).toHaveCount(1);
      const grade = await gradeOverlay.boundingBox();
      const viewport = page.viewportSize()!;
      if (grade === null) {
        // createGradePass deliberately hides this overlay when GL is unavailable,
        // lost, disabled, or over budget. Require that exact runtime-owned
        // fallback, rather than accepting a missing canvas or arbitrary hiding.
        expect(await gradeOverlay.evaluate((node) => (node as HTMLCanvasElement).style.display)).toBe("none");
        await expect(gradeOverlay).toHaveCSS("display", "none");
        await expect(gradeOverlay).toHaveCSS("pointer-events", "none");
      } else {
        for (const axis of ["x", "y", "width", "height"] as const) {
          expect(Math.abs(grade[axis] - canvas[axis]), `Color-grade ${axis} must match the game image`).toBeLessThanOrEqual(0.5);
        }
      }
      gradeObservations.push({ viewport: `${viewport.width}x${viewport.height}`, presentation: grade === null ? "raw-2d" : "graded" });
      const layout = await Promise.all(targets.map(async (target) => ({
        label: await target.getAttribute("aria-label"), box: (await target.boundingBox())!,
      })));
      for (const { label, box } of layout) {
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
        if (label === "Aim turret") {
          expect(Math.abs(box.x - canvas.x)).toBeLessThanOrEqual(0.5);
          expect(Math.abs(box.width - canvas.width)).toBeLessThanOrEqual(0.5);
          expect(Math.abs(box.height - canvas.height * 714 / 854)).toBeLessThanOrEqual(0.5);
        } else {
          expect(box.y, `${label} must not obscure the game image or dashboard`).toBeGreaterThanOrEqual(canvas.y + canvas.height);
        }
      }
      for (let i = 0; i < layout.length; i++) for (let j = i + 1; j < layout.length; j++) {
        const a = layout[i].box; const b = layout[j].box;
        expect(Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 0.5 &&
          Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 0.5,
        `${layout[i].label} overlaps ${layout[j].label} at ${viewport.width}x${viewport.height}`).toBe(false);
      }
      if (profile.name === "Turret") {
        const hint = controls.getByText("DRAG TO AIM · ARROW KEYS", { exact: true });
        await expect(hint).toBeVisible();
        const box = (await hint.boundingBox())!;
        expect(box.y, "Visible turret aim instructions must not cover wave/kill counters or gameplay").toBeGreaterThanOrEqual(canvas.y + canvas.height);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
        const fire = layout.find((item) => item.label === "Fire")!.box;
        expect(box.x + box.width, "Turret instructions must leave Fire unobstructed").toBeLessThanOrEqual(fire.x);
      }
    };
    await assertClearGameImage();
    await page.setViewportSize({ width: 375, height: 667 });
    await assertClearGameImage();
    await page.setViewportSize({ width: 480, height: 854 });
    await assertClearGameImage();
    const screenshotPath = testInfo.outputPath(`${profile.name}-controls-480x854.png`);
    await page.screenshot({ path: screenshotPath });
    await testInfo.attach(`${profile.name}-controls-480x854`, { path: screenshotPath, contentType: "image/png" });
    await testInfo.attach("grade-layout-observations", {
      body: Buffer.from(JSON.stringify({
        forcedWebGLUnavailable: profile.withoutWebGL,
        contextRequests: await page.evaluate(() => window.touchGradeContextRequests ?? []),
        gradeObservations,
      }, null, 2)),
      contentType: "application/json",
    });
    await attachBrowserReceipt(testInfo, {
      route: `DevPanel -> ${profile.launch} -> visible ${profile.name} controls${profile.withoutWebGL ? " with WebGL context creation unavailable" : ""}`,
      inputMethod: "touch", saveFixture: "freshLegacy",
      expectedOutcome: "The active profile exposes labeled, non-overlapping 44px controls without obscuring gameplay, dashboard or dialogue; turret aim aligns with the visible base canvas, and the grade overlay is aligned when visible or explicitly hidden by the supported raw-2D fallback.",
      observedOutcome: `${profile.name} controls and all ${profile.actions.length} required action targets remain visible, unobstructed and aligned at 480x854 and 375x667; grade presentation: ${gradeObservations.map((entry) => `${entry.viewport} ${entry.presentation}`).join(", ")}; screenshot restored to 480x854.`,
    });
  });
}

test("@touch shooter briefing describes visible controls before skipping", async ({ page }, testInfo) => {
  await installObservation(page);
  await openMode(page, "1-1", false);
  await page.waitForFunction(() => window.touchEvidence.texts.includes("PRESS ENTER OR TAP TO SKIP"));
  const texts = await page.evaluate(() => window.touchEvidence.texts);
  expect(texts).not.toContain("MOBILE: TOUCH MOVE  2-FINGER TAP: BOMB");
  expect(texts).toContain("Shooter: Move pad · Fire · Bomb");
  await receipt(page, testInfo, "DevPanel -> campaign briefing before tap to skip", "freshLegacy", "The rendered briefing describes the visible move, Fire and Bomb controls and does not advertise the removed two-finger bomb gesture.");
});

for (const route of ["campaign", "planet", "Galaxy operation"] as const) {
  test(`@touch ${route} shooter separates movement fire and bomb with retained finger ownership`, async ({ page }, testInfo) => {
    test.setTimeout(60_000); // Native launch plus the full multi-finger frame sequence can exceed 30s.
    await installObservation(page);
    if (route === "campaign") await openMode(page, "1-1");
    else {
      await installSaveFixture(page, route === "planet" ? allPlanetsLaunchable : galaxyAtAshfall);
      await page.goto("/");
      if (route === "planet") {
        await action(page, "DEV").tap();
        await action(page, "Ashfall").tap();
        await action(page, "X").tap();
      }
      else {
        await action(page, "CONTINUE GALAXY").tap();
        await expect(page.getByText("SECURE THE ASHFALL DISTRESS ZONE")).toBeVisible();
        await action(page, "LAUNCH OPERATION").tap();
      }
      await page.locator(CANVAS).tap();
    }
    await expect(page.getByRole("group", { name: "Shooter controls", exact: true })).toBeVisible();
    const baseline = await frames(page, "ship");
    const initialBombs = baseline.at(-1)!.bombs;
    expect(initialBombs).toBeGreaterThan(1);
    await withFingers(page, async (fingers) => {
      for (const [label, sign] of [["Move up", -1], ["Move down", 1]] as const) {
        await fingers.down(1, action(page, label));
        const vertical = await frames(page, "ship", 8);
        expect(displacement(vertical, "ship").y * sign).toBeGreaterThan(1);
        expect(Math.abs(displacement(vertical, "ship").x)).toBeLessThan(0.001);
        expect(vertical.every((frame) => frame.shipShots.length === 0 && frame.bombs === initialBombs)).toBe(true);
        await fingers.up(1);
      }
      await fingers.down(1, action(page, "Move left"));
      const left = await frames(page, "ship", 8);
      expect(displacement(left, "ship").x).toBeLessThan(-1);
      expect(left.every((f) => f.shipShots.length === 0 && f.bombs === initialBombs)).toBe(true);
      await fingers.move(1, action(page, "Move right"));
      const right = await frames(page, "ship", 8);
      expect(displacement(right, "ship").x).toBeGreaterThan(1);
      await fingers.down(2, action(page, "Fire"));
      const together = await frames(page, "ship", 16);
      expect(displacement(together, "ship").x).toBeGreaterThan(1);
      expect(together.some((f) => f.shipShots.length > 0)).toBe(true);
      expect(together.every((f) => f.bombs === initialBombs)).toBe(true);
      await fingers.up(1);
      const fireOnly = await freshFireCycle(page, "ship");
      still(fireOnly, "ship");
      await fingers.up(2);
      await page.waitForFunction(() => {
        const latest = window.touchEvidence.frames.at(-1);
        return latest?.ship && latest.shipShots.length === 0;
      });
      const released = await frames(page, "ship", 8);
      expect(released.every((f) => f.shipShots.length === 0)).toBe(true);
      await fingers.down(3, action(page, "Bomb"));
      const bomb = await frames(page, "ship", 8);
      await fingers.up(3);
      still(bomb, "ship");
      expect(bomb.at(-1)!.bombs).toBe(initialBombs! - 1);
      expect(bomb.every((f) => f.shipShots.length === 0)).toBe(true);
    });
    await receipt(page, testInfo, `${route === "campaign" ? "DevPanel -> 1-1" : route === "planet" ? "DevPanel -> Ashfall" : "CONTINUE GALAXY -> LAUNCH OPERATION"} -> shooter -> move/fire/bomb`, route === "campaign" ? "freshLegacy" : route === "planet" ? "allPlanetsLaunchable" : "galaxyAtAshfall", "All four movement directions work without firing or bombing; movement and fire coexist; lifting movement preserves fresh muzzle emissions; bomb alone spends exactly one bomb without shooting.");
  });
}

test("@touch shooter canvas drag owns position without firing and releases back to the pad", async ({ page }, testInfo) => {
  await installObservation(page);
  await openMode(page, "1-1");
  await withFingers(page, async (fingers) => {
    await fingers.down(1, await center(page.locator(CANVAS), 0.8, 0.4));
    // The rendered hull center follows the finger with a 64px vertical offset.
    await page.waitForFunction((target) => {
      const ship = window.touchEvidence.frames.at(-1)?.ship;
      return ship && Math.hypot(ship.x - target.x, ship.y - target.y) <= 2.1;
    }, { x: 480 * 0.8, y: 854 * 0.4 - 64 });
    await fingers.down(2, action(page, "Move left"));
    const owned = await frames(page, "ship", 10);
    still(owned, "ship", 2);
    expect(owned.every((f) => f.shipShots.length === 0 && f.bombs === 2)).toBe(true);
    await fingers.move(1, await center(page.locator(CANVAS), 0.65, 0.4));
    expect(displacement(await frames(page, "ship", 10), "ship").x).toBeLessThan(-1);
    await fingers.up(1);
    expect(displacement(await frames(page, "ship", 8), "ship").x).toBeLessThan(-1);
    await fingers.move(2, await center(page.locator(CANVAS), 0.5, 0.8));
    still(await frames(page, "ship", 10), "ship");
  });
  await receipt(page, testInfo, "campaign -> canvas drag + pad -> drag release -> pad exit", "freshLegacy", "Canvas drag controls position without shooting or bombing; releasing it restores the still-held pad; dragging out of the pad stops movement.");
});

test("@touch first person separates forward strafe look and fire with simultaneous input", async ({ page }, testInfo) => {
  await installObservation(page);
  await openMode(page, "FIRST PERSON");
  await withFingers(page, async (fingers) => {
    for (const [label, axis, sign] of [["Move forward", "x", 1], ["Move backward", "x", -1], ["Strafe left", "y", -1], ["Strafe right", "y", 1]] as const) {
      await fingers.down(1, action(page, label));
      const movement = await frames(page, "fp", 7);
      expect(displacement(movement, "fp")[axis] * sign).toBeGreaterThan(0.1);
      expect(movement.every((f) => !f.gun && Math.abs(f.heading!.y) < 0.001)).toBe(true);
      await fingers.up(1);
    }
    for (const [label, sign] of [["Look left", -1], ["Look right", 1]] as const) {
      await fingers.down(1, action(page, label));
      const looking = await frames(page, "fp", 7);
      still(looking, "fp");
      expect((looking.at(-1)!.heading!.y - looking[0].heading!.y) * sign).toBeGreaterThan(0.05);
      expect(looking.every((f) => !f.gun)).toBe(true);
      await fingers.up(1);
    }
    await fingers.down(3, action(page, "Fire"));
    const fire = await frames(page, "fp", 20);
    still(fire, "fp");
    expect(fire.some((f) => f.gun)).toBe(true);
    await fingers.down(1, action(page, "Move forward"));
    await fingers.down(2, action(page, "Look right"));
    const combined = await frames(page, "fp", 12);
    expect(displacement(combined, "fp").x).toBeGreaterThan(0.1);
    expect(combined.at(-1)!.heading!.y).toBeGreaterThan(combined[0].heading!.y);
    expect(combined.some((f) => f.gun)).toBe(true);
    await fingers.up(1);
    await fingers.up(2);
    const fireRemains = await freshFireCycle(page, "fp");
    still(fireRemains, "fp");
    await fingers.cancel();
    await frames(page, "fp", 15);
    expect((await frames(page, "fp", 15)).every((f) => !f.gun)).toBe(true);
  });
  await receipt(page, testInfo, "DevPanel -> first person -> move/strafe/look/fire -> multitouch", "freshLegacy", "Movement and strafe translate without turning or firing; look rotates in place; fire is independent and remains held after the movement/look fingers lift.");
});

test("@touch Colony DAY enters and exits the solar interior without firing or held-input bounce", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await installObservation(page);
  await openMode(page, "DAY");
  await withFingers(page, async (fingers) => {
    expect((await frames(page, "fp", 5)).at(-1)!.mapSize).toBe(76);
    await fingers.down(1, action(page, "Strafe right"));
    await page.waitForFunction(() => (window.touchEvidence.frames.at(-1)?.fp?.x ?? 0) >= 19.35);
    await fingers.up(1);
    await fingers.down(1, action(page, "Move forward"));
    await page.waitForFunction(() => (window.touchEvidence.frames.at(-1)?.fp?.y ?? 30) <= 18.65);
    await fingers.up(1);
    const exterior = await frames(page, "fp", 5);
    expect(exterior.at(-1)!.fp!.x).toBeGreaterThan(19);
    expect(exterior.at(-1)!.fp!.x).toBeLessThan(20);
    expect(exterior.every((f) => !f.gun)).toBe(true);
    await fingers.down(2, action(page, "Interact"));
    try {
      await page.waitForFunction(() => window.touchEvidence.frames.at(-1)?.mapSize === 22, undefined, { timeout: 10_000 });
    } catch (error) {
      const observed = await page.evaluate(() => window.touchEvidence.frames.slice(-30).map((frame) => ({
        seq: frame.seq, fp: frame.fp, heading: frame.heading, mapSize: frame.mapSize, gun: frame.gun,
      })));
      const buttons = await page.getByRole("group", { name: "Colony controls", exact: true }).getByRole("button").evaluateAll((nodes) => nodes.map((node) => ({
        label: node.getAttribute("aria-label"), pressed: node.getAttribute("aria-pressed"),
      })));
      const events = await page.evaluate(() => window.touchEvidence.events.slice(-100));
      await testInfo.attach("colony-door-observations", {
        body: Buffer.from(JSON.stringify({ frames: observed, buttons, events }, null, 2)), contentType: "application/json",
      });
      throw new Error(`Solar door did not enter: ${JSON.stringify({ latest: observed.at(-1), buttons, events: events.slice(-16) })}`, { cause: error });
    }
    const entered = await frames(page, "fp", 25);
    expect(entered.every((f) => f.mapSize === 22 && !f.gun)).toBe(true);
    still(entered, "fp");
    await fingers.move(2, action(page, "Interact"));
    expect((await frames(page, "fp", 10)).every((f) => f.mapSize === 22)).toBe(true);
    await fingers.up(2);
    await fingers.down(1, action(page, "Move forward"));
    const insideMove = await frames(page, "fp", 8);
    expect(displacement(insideMove, "fp").y).toBeLessThan(-0.1);
    await fingers.up(1);
    await fingers.down(1, action(page, "Move backward"));
    await page.waitForFunction(() => (window.touchEvidence.frames.at(-1)?.fp?.y ?? 0) >= 5.1);
    await fingers.up(1);
    await fingers.down(2, action(page, "Interact"));
    await page.waitForFunction(() => window.touchEvidence.frames.at(-1)?.mapSize === 76);
    const outside = await frames(page, "fp", 25);
    expect(outside.every((f) => f.mapSize === 76 && !f.gun)).toBe(true);
    still(outside, "fp");
    expect(outside.at(-1)!.heading!.y).toBeGreaterThan(0.99);
  });
  await receipt(page, testInfo, "DevPanel DAY -> exterior -> solar door -> interior movement -> exterior", "freshLegacy + shipped DAY seed", "Real touch navigation reaches the solar door, Interact enters the interior, held interaction does not bounce, interior movement works, and a fresh interaction returns to the exterior without firing.");
});

test("@touch turret position owns aim independently of fire and releases each finger", async ({ page }, testInfo) => {
  await installObservation(page);
  await openMode(page, "TURRET");
  await withFingers(page, async (fingers) => {
    const aim = action(page, "Aim turret");
    await fingers.down(1, await center(aim, 0.75, 0.25));
    const positioned = await frames(page, "turret", 8);
    expect(positioned.at(-1)!.turret!.x).toBeCloseTo(360, 0);
    expect(positioned.at(-1)!.turret!.y).toBeCloseTo(714 * 0.25, 0);
    expect(positioned.every((f) => !f.turretFire)).toBe(true);
    await fingers.down(2, action(page, "Fire"));
    const firing = await frames(page, "turret", 15);
    still(firing, "turret");
    expect(firing.some((f) => f.turretFire)).toBe(true);
    await fingers.move(1, await center(aim, 0.35, 0.65));
    const dragged = await frames(page, "turret", 8);
    expect(dragged.at(-1)!.turret!.x).toBeCloseTo(168, 0);
    expect(dragged.at(-1)!.turret!.y).toBeCloseTo(714 * 0.65, 0);
    await fingers.up(1);
    const retainedFire = await freshFireCycle(page, "turret");
    still(retainedFire, "turret");
    await fingers.cancel();
    await frames(page, "turret", 15);
    expect((await frames(page, "turret", 10)).every((f) => !f.turretFire)).toBe(true);
  });
  await receipt(page, testInfo, "DevPanel -> turret aim/fire -> drag -> partial release -> cancel", "freshLegacy", "The aim area uses the 714px gameplay height; aiming never fires, fire never moves aim, and fire survives aim-finger release then stops on cancellation.");
});

test("@touch cancel blur pause and mode changes discard old control holds until a fresh touch", async ({ page }, testInfo) => {
  await installObservation(page);
  await openMode(page, "FIRST PERSON");
  await withFingers(page, async (fingers) => {
    await fingers.down(1, action(page, "Move forward"));
    expect(displacement(await frames(page, "fp", 6), "fp").x).toBeGreaterThan(0.1);
    await fingers.cancel();
    still(await frames(page, "fp", 8), "fp");
    expect(await page.evaluate(() => window.touchEvidence.pointerCancels)).toBeGreaterThan(0);
    await fingers.down(1, action(page, "Move backward"));
    await frames(page, "fp", 5);
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await fingers.move(1, action(page, "Move forward"));
    still(await frames(page, "fp", 8), "fp");
    await fingers.up(1);
    await fingers.down(1, action(page, "Move forward"));
    await fingers.down(2, action(page, "Fire"));
    await frames(page, "fp", 6);
    await fingers.tap(9, page.getByTitle("Pause (ESC)", { exact: true }));
    await expect(action(page, "RESUME")).toBeVisible();
    await fingers.tap(9, action(page, "RESUME"));
    await expect(action(page, "RESUME")).toBeHidden();
    await fingers.move(1, action(page, "Move backward"));
    await fingers.move(2, action(page, "Fire"));
    await frames(page, "fp", 18);
    const resumed = await frames(page, "fp", 8);
    still(resumed, "fp");
    expect(resumed.every((f) => !f.gun)).toBe(true);
    await fingers.up(1); await fingers.up(2);
    await fingers.down(1, action(page, "Move backward"));
    expect(displacement(await frames(page, "fp", 6), "fp").x).toBeLessThan(-0.1);
    await switchMode(page, "TURRET");
    await fingers.move(1, action(page, "Aim turret"));
    still(await frames(page, "turret", 10), "turret");
    await fingers.up(1);
    await fingers.down(1, action(page, "Fire"));
    await freshFireCycle(page, "turret");
  });
  await receipt(page, testInfo, "first person -> touchcancel -> blur -> pause/resume -> turret", "freshLegacy", "Cancellation, blur, pause and transitions clear owners; old fingers cannot re-arm controls; a fresh touch works.");
});

test("@pointer visible action buttons support held keyboard and mouse activation and turret keyboard aim", async ({ page }, testInfo) => {
  await installObservation(page);
  await installSaveFixture(page, freshLegacy);
  await page.goto("/");
  await switchMode(page, "FIRST PERSON");
  await action(page, "Fire").focus();
  await page.keyboard.down("Space");
  expect((await frames(page, "fp", 18)).some((f) => f.gun)).toBe(true);
  await page.keyboard.up("Space");
  await frames(page, "fp", 20);
  expect((await frames(page, "fp", 8)).every((f) => !f.gun)).toBe(true);
  const fire = await center(action(page, "Fire"));
  await page.mouse.move(fire.x, fire.y); await page.mouse.down();
  expect((await frames(page, "fp", 18)).some((f) => f.gun)).toBe(true);
  await page.mouse.up();
  await frames(page, "fp", 20);
  expect((await frames(page, "fp", 8)).every((f) => !f.gun)).toBe(true);
  await switchMode(page, "TURRET");
  await action(page, "Aim turret").focus();
  const before = (await frames(page, "turret", 4)).at(-1)!.turret!;
  await page.keyboard.down("ArrowRight");
  const after = await frames(page, "turret", 5);
  await page.keyboard.up("ArrowRight");
  expect(after.at(-1)!.turret!.x).toBeGreaterThan(before.x);
  expect(after.every((f) => !f.turretFire)).toBe(true);
  await receipt(page, testInfo, "first-person buttons -> keyboard/mouse -> turret keyboard aim", "freshLegacy", "Visible Fire buttons retain their named behavior under keyboard/mouse activation; focusing turret aim allows arrow-key positioning without firing.", "pointer");
});

test("@pointer focused turret arrows continue from keyboard aim and release on blur", async ({ page }, testInfo) => {
  await installObservation(page);
  await installSaveFixture(page, freshLegacy);
  await page.goto("/");
  await switchMode(page, "TURRET");
  await page.locator(CANVAS).focus();
  await page.keyboard.down("ArrowRight");
  await page.waitForFunction(() => (window.touchEvidence.frames.at(-1)?.turret?.x ?? 0) > 330);
  await page.keyboard.up("ArrowRight");
  const before = (await frames(page, "turret", 3)).at(-1)!.turret!;
  expect(before.x).toBeGreaterThan(320);
  await action(page, "Aim turret").focus();
  await page.keyboard.down("ArrowLeft");
  const moving = await frames(page, "turret", 6);
  expect(moving[0].turret!.x).toBeGreaterThan(before.x - 30);
  expect(displacement(moving, "turret").x).toBeLessThan(-5);
  expect(moving.every((f) => !f.turretFire)).toBe(true);
  await action(page, "Fire").focus();
  still(await frames(page, "turret", 8), "turret");
  await page.keyboard.up("ArrowLeft");
  await receipt(page, testInfo, "turret keyboard aim -> focused aim arrows -> focus away", "freshLegacy", "Focused arrows continue from the existing crosshair, move while held without firing, and release when focus leaves the aim control.", "pointer");
});

// GC2-A: colony management owns input. Nothing held before, during or after it may move the
// walker, fire, open another menu or carry into the walk until a fresh input.
async function descendAtAshfall(page: Page, method: "keyboard" | "touch") {
  await installObservation(page);
  await installSaveFixture(page, galaxyAtAshfall);
  await page.goto("/");
  for (const label of ["CONTINUE GALAXY", "DESCEND TO COLONY"]) {
    if (method === "touch") await action(page, label).tap();
    else { await action(page, label).focus(); await page.keyboard.press("Enter"); }
  }
  const controls = page.getByRole("group", { name: "Colony controls", exact: true });
  await expect(controls).toBeVisible();
  return {
    controls,
    menu: page.getByRole("dialog", { name: "Landing pad exit menu", exact: true }),
    manage: page.getByRole("dialog", { name: "Colony management", exact: true }),
  };
}

async function walkIsInert(page: Page, menu: Locator) {
  const observed = await frames(page, "fp", 30);
  still(observed, "fp");
  expect(observed.some((frame) => frame.gun), "no fire").toBe(false);
  await expect(menu).toBeHidden();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test("@keyboard held movement and interact do not cross colony management", async ({ page }, testInfo) => {
  const { controls, menu, manage } = await descendAtAshfall(page, "keyboard");
  await controls.getByRole("button", { name: "Interact", exact: true }).focus();
  await page.keyboard.down("Enter");
  await page.waitForTimeout(100); // A native hold spans the canvas input sampling frame.
  await page.keyboard.up("Enter");
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: "COLONY MANAGEMENT", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(manage).toBeVisible();
  // Focus the dialog body, as a click on the panel background does. Keys pressed on a focused
  // button never reach the walk, so this is the case the input guards must cover.
  await manage.focus();
  await page.keyboard.down("w"); // move, held through the dialog
  await page.keyboard.down("z"); // primary (interact), held through the dialog
  const behind = await frames(page, "fp", 30);
  still(behind, "fp");
  expect(behind.some((frame) => frame.gun), "no fire behind the dialog").toBe(false);
  await expect(menu).toBeHidden();
  await page.keyboard.press("Escape"); // management -> landing pad menu
  await expect(manage).toBeHidden();
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape"); // menu -> walk
  await walkIsInert(page, menu);
  await page.keyboard.up("z");
  await page.keyboard.up("w");
  await page.keyboard.down("w"); // a fresh press moves
  const fresh = await frames(page, "fp", 30);
  await page.keyboard.up("w");
  const moved = displacement(fresh, "fp");
  expect(Math.hypot(moved.x, moved.y)).toBeGreaterThan(0.05);
  await receipt(page, testInfo, "Atlas -> DESCEND -> Interact -> COLONY MANAGEMENT -> hold W+Z on the dialog -> Escape x2 -> fresh W",
    "galaxyAtAshfall", "Keys held across management neither moved, fired nor opened a menu; a fresh W moved the walker.", "keyboard");
});

test("@touch a held colony gesture does not cross colony management", async ({ page }, testInfo) => {
  const { controls, menu, manage } = await descendAtAshfall(page, "touch");
  const interact = controls.getByRole("button", { name: "Interact", exact: true });
  const forward = await center(controls.getByRole("button", { name: "Move forward", exact: true }));
  await withFingers(page, async (fingers) => {
    await fingers.down(1, interact); // held from before the menu until the walk resumes
    await expect(menu).toBeVisible();
    // Chromium sends no compatibility click for a second finger while one is held, so the
    // dialog buttons are activated with the pointer; finger 1 stays down throughout.
    await menu.getByRole("button", { name: "COLONY MANAGEMENT", exact: true }).click();
    await expect(manage).toBeVisible();
    await expect(controls).toBeHidden(); // no gameplay controls behind the dialog
    still(await frames(page, "fp", 30), "fp");
    await manage.getByRole("button", { name: "← BACK", exact: true }).click();
    await expect(menu).toBeVisible();
    await menu.getByRole("button", { name: "Resume", exact: true }).click();
    await expect(controls).toBeVisible();
    await fingers.move(1, forward); // the old finger slides onto movement
    await walkIsInert(page, menu);
    await fingers.up(1);
    await fingers.down(1, interact); // a fresh press still works
    await expect(menu).toBeVisible();
    await fingers.up(1);
  });
  await receipt(page, testInfo, "Atlas -> DESCEND -> hold Interact -> COLONY MANAGEMENT -> BACK -> Resume -> slide to Move forward -> fresh Interact",
    "galaxyAtAshfall", "A finger held across management neither moved, fired nor reopened the menu; controls were hidden behind the dialog; a fresh press opened the menu.");
});

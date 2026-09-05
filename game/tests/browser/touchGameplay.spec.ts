import { expect, test, type CDPSession, type Locator, type Page, type TestInfo } from "@playwright/test";
import { allPlanetsLaunchable, freshLegacy, galaxyAtAshfall } from "./fixtures/routeFixtures";
import { installSaveFixture } from "./helpers/saveFixture";
import { attachBrowserReceipt } from "./helpers/receipt";

const CANVAS = "#sector-zero-game-canvas";
type Point = { x: number; y: number };
type Motion = "ship" | "ground" | "board" | "fp" | "turret";
type Frame = {
  seq: number; ship?: Point; ground?: Point & { sprite: string }; board?: Point;
  fp?: Point; heading?: Point; turret?: Point; mapSize?: number; boardPlayer?: Point;
  shipShots: Point[]; groundShots: Point[]; boardShots: Point[];
  dash: boolean; gun: boolean; turretFire: boolean; bombs: number | null;
};
type NativeEvidence = {
  type: string; target: string; trusted?: boolean; pointerId?: number; primary?: boolean;
  x?: number; y?: number; pressed?: string | null; connected?: boolean;
  touches?: number[]; changed?: number[]; seq: number; fp?: Point; heading?: Point; mapSize?: number;
};
declare global { interface Window { touchEvidence: { frames: Frame[]; texts: string[]; events: NativeEvidence[]; pointerCancels: number } } }

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
    const empty = (): Frame => ({ seq: 0, shipShots: [], groundShots: [], boardShots: [], dash: false, gun: false, turretFire: false, bombs });
    let pending = empty();
    let miniMap: Point | undefined;
    let fpDot: Point | undefined;
    const active = (ctx: CanvasRenderingContext2D) => ctx.canvas.id === "sector-zero-game-canvas";
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (this: CanvasRenderingContext2D, source: CanvasImageSource, ...args: number[]) {
      if (active(this) && source instanceof HTMLImageElement) {
        const src = source.currentSrc || source.src;
        const offset = args.length === 8 ? 4 : 0;
        const point = { x: args[offset], y: args[offset + 1] };
        if (src.endsWith("/ships/player.png")) pending.ship = point;
        else if (src.endsWith("/bullets/player-bullets.png")) pending.shipShots.push(point);
        else if (src.includes("/ground/player-")) pending.ground = { ...point, sprite: src };
        else if (src.includes("/boarding/player-")) {
          if (this.globalAlpha < 0.4) pending.dash = true;
          else pending.boardPlayer = point;
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
        if (this.fillStyle === "#00ffff" && w === 10 && h === 6) pending.groundShots.push({ x, y });
        if (this.fillStyle === "#44ccff" && w === 3 && h === 3 && miniMap) {
          pending.board = { x: (x + 1 - miniMap.x) / 3, y: (y + 1 - miniMap.y) / 3 };
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
        if (this.fillStyle === "#44ccff" && radius === 3) pending.boardShots.push({ x, y });
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
      if (pending.ship || pending.ground || pending.board || pending.fp || pending.turret) {
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
async function frames(page: Page, kind: Motion, count = 10): Promise<Frame[]> {
  const seq = await page.evaluate(() => window.touchEvidence.frames.at(-1)?.seq ?? 0);
  await page.waitForFunction(({ seq, kind, count }) => window.touchEvidence.frames.filter((f) => f.seq > seq && f[kind]).length >= count, { seq, kind, count });
  return page.evaluate(({ seq, kind }) => window.touchEvidence.frames.filter((f) => f.seq > seq && f[kind]), { seq, kind });
}
function displacement(observed: Frame[], kind: Motion): Point {
  const first = observed[0][kind]!;
  const last = observed.at(-1)![kind]!;
  return { x: last.x - first.x, y: last.y - first.y };
}
function still(observed: Frame[], kind: Motion, tolerance = 0.001) {
  const delta = displacement(observed, kind);
  expect(Math.abs(delta.x), `${kind} horizontal position`).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(delta.y), `${kind} vertical position`).toBeLessThanOrEqual(tolerance);
}
// An old projectile cannot re-enter the muzzle region once it has left it.
// Requiring an empty -> occupied transition at a stationary player proves a
// fresh shot. FP/turret similarly require a fresh off -> on firing animation.
async function freshFireCycle(page: Page, kind: Motion): Promise<Frame[]> {
  const seq = await page.evaluate(() => window.touchEvidence.frames.at(-1)?.seq ?? 0);
  await page.waitForFunction(({ seq, kind }) => {
    let cleared = false;
    for (const frame of window.touchEvidence.frames) {
      if (frame.seq <= seq || !frame[kind]) continue;
      const active = kind === "fp" ? frame.gun : kind === "turret" ? frame.turretFire
        : kind === "ship" ? frame.shipShots.some((shot) => shot.y > frame.ship!.y - 40 && shot.y < frame.ship!.y + 10)
          : kind === "ground" ? frame.groundShots.some((shot) => Math.abs(shot.x - frame.ground!.x) < 60 && Math.abs(shot.y - frame.ground!.y) < 55)
            : frame.boardPlayer && frame.boardShots.some((shot) => Math.hypot(shot.x - frame.boardPlayer!.x - 18, shot.y - frame.boardPlayer!.y - 18) < 34);
      if (!active) cleared = true;
      else if (cleared) return true;
    }
    return false;
  }, { seq, kind }, { timeout: 5_000 });
  return page.evaluate(({ seq, kind }) => window.touchEvidence.frames.filter((frame) => frame.seq > seq && frame[kind]), { seq, kind });
}

// Follow the same visible point through three consecutive frames with a stable
// velocity. This measures projectile motion, independently of player animation.
function hasProjectileTrajectory(observed: Frame[], field: "groundShots" | "boardShots", xSign: -1 | 0 | 1, ySign: -1 | 1): boolean {
  for (let i = 0; i < observed.length - 2; i++) {
    for (const first of observed[i][field]) for (const second of observed[i + 1][field]) {
      const dx = second.x - first.x; const dy = second.y - first.y;
      if (xSign === 0 ? Math.abs(dx) > 0.1 : dx * xSign <= 0.5) continue;
      if (dy * ySign <= 0.5 || Math.hypot(dx, dy) > 25) continue;
      if (observed[i + 2][field].some((third) => Math.hypot(third.x - second.x - dx, third.y - second.y - dy) < 0.2)) return true;
    }
  }
  return false;
}
async function receipt(page: Page, testInfo: TestInfo, route: string, fixture: string, outcome: string, inputMethod: "touch" | "pointer" = "touch") {
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
  { launch: "GROUND RUN", name: "Ground", actions: ["Move left", "Move right", "Aim up", "Aim down", "Fire", "Jump"] },
  { launch: "BOARDING", name: "Boarding", actions: ["Move left", "Move right", "Move up left", "Move down right", "Fire", "Dash"] },
  { launch: "FIRST PERSON", name: "First-person", actions: ["Move forward", "Move backward", "Strafe left", "Strafe right", "Look left", "Look right", "Fire / interact"] },
  { launch: "TURRET", name: "Turret", actions: ["Fire"] },
  { launch: "DAY", name: "Colony", actions: ["Move forward", "Move backward", "Strafe left", "Strafe right", "Look left", "Look right", "Interact"] },
] as const;

for (const profile of profiles) {
  test(`@touch ${profile.name} exposes its visible control profile at 480x854`, async ({ page }, testInfo) => {
    await openMode(page, profile.launch);
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
    const screenshotPath = testInfo.outputPath(`${profile.name}-controls-480x854.png`);
    await page.screenshot({ path: screenshotPath });
    await testInfo.attach(`${profile.name}-controls-480x854`, { path: screenshotPath, contentType: "image/png" });
    await attachBrowserReceipt(testInfo, {
      route: `DevPanel -> ${profile.launch} -> visible ${profile.name} controls`,
      inputMethod: "touch", saveFixture: "freshLegacy",
      expectedOutcome: "The active profile exposes labeled, visible controls with at least 44px targets inside the touch viewport.",
      observedOutcome: `${profile.name} controls and all ${profile.actions.length} required action targets are visible and inside 480x854.`,
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
    // Follow the observed ship to the actual canvas-touch destination. The
    // 48px ship is offset above the finger, and its draw origin adds another 6px.
    await page.waitForFunction((target) => {
      const ship = window.touchEvidence.frames.at(-1)?.ship;
      return ship && Math.hypot(ship.x - target.x, ship.y - target.y) <= 2.1;
    }, { x: 480 * 0.8 - 30, y: 854 * 0.4 - 94 });
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

test("@touch ground move aim fire and jump stay distinct and support three fingers", async ({ page }, testInfo) => {
  await installObservation(page);
  await openMode(page, "GROUND RUN");
  await page.waitForFunction(() => window.touchEvidence.frames.at(-1)?.ground?.sprite.endsWith("player-idle.png"));
  await withFingers(page, async (fingers) => {
    for (const [label, sign] of [["Move right", 1], ["Move left", -1]] as const) {
      await fingers.down(1, action(page, label));
      const moving = await frames(page, "ground", 8);
      expect(displacement(moving, "ground").x * sign).toBeGreaterThan(1);
      expect(moving.every((f) => f.groundShots.length === 0 && !f.ground!.sprite.endsWith("player-jump.png"))).toBe(true);
      await fingers.up(1);
    }
    for (const label of ["Aim up", "Aim down"]) {
      await fingers.down(1, action(page, label));
      const aiming = await frames(page, "ground", 8);
      still(aiming, "ground");
      expect(aiming.every((f) => f.groundShots.length === 0 && !f.ground!.sprite.endsWith("player-jump.png"))).toBe(true);
      await fingers.up(1);
    }
    await fingers.down(1, action(page, "Jump"));
    const jump = await frames(page, "ground", 10);
    await fingers.up(1);
    expect(jump.some((f) => f.ground!.sprite.endsWith("player-jump.png"))).toBe(true);
    expect(jump.every((f) => f.groundShots.length === 0)).toBe(true);
    await page.waitForFunction(() => window.touchEvidence.frames.at(-1)?.ground?.sprite.endsWith("player-idle.png"));
    await fingers.down(2, action(page, "Fire"));
    const firing = await frames(page, "ground", 18);
    still(firing, "ground");
    expect(firing.some((f) => f.groundShots.length > 0)).toBe(true);
    expect(firing.every((f) => !f.ground!.sprite.endsWith("player-jump.png"))).toBe(true);
    await fingers.down(1, action(page, "Aim up"));
    const up = await frames(page, "ground", 20);
    expect(up.some((f) => f.groundShots.some((shot) => shot.y < f.ground!.y - 15))).toBe(true);
    expect(up.every((f) => !f.ground!.sprite.endsWith("player-jump.png"))).toBe(true);
    await fingers.move(1, action(page, "Aim down"));
    await fingers.down(3, action(page, "Jump"));
    const down = await frames(page, "ground", 15);
    expect(down.some((f) => f.ground!.sprite.endsWith("player-jump.png") && f.groundShots.some((shot) => shot.y > f.ground!.y + 50))).toBe(true);
    expect(hasProjectileTrajectory(down, "groundShots", 0, 1), "Downward projectile must advance in positive canvas Y through three frames").toBe(true);
    await fingers.up(3);
    await fingers.up(1);
    await page.waitForFunction(() => {
      const ground = window.touchEvidence.frames.at(-1)?.ground;
      return ground && !ground.sprite.endsWith("player-jump.png");
    });
    still(await freshFireCycle(page, "ground"), "ground");
    await fingers.cancel();
    await frames(page, "ground", 30);
    const ended = await frames(page, "ground", 12);
    expect(ended.every((f) => !f.ground!.sprite.endsWith("player-shoot.png"))).toBe(true);
  });
  await receipt(page, testInfo, "DevPanel -> ground -> movement/aim/jump/fire -> three fingers -> cancel", "freshLegacy", "Movement and aiming do not shoot or jump; Jump does not shoot; Fire does not jump; up/down aim changes real projectile direction; firing survives release of the other fingers and stops on cancellation.");
});

test("@touch boarding covers eight directions retained facing fire and dash", async ({ page }, testInfo) => {
  await installObservation(page);
  await openMode(page, "BOARDING");
  await withFingers(page, async (fingers) => {
    const directions = [["up", 0, -1], ["down", 0, 1], ["left", -1, 0], ["right", 1, 0], ["up left", -1, -1], ["down right", 1, 1], ["down left", -1, 1], ["up right", 1, -1]] as const;
    for (const [direction, x, y] of directions) {
      await fingers.down(1, action(page, `Move ${direction}`));
      const movement = await frames(page, "board", 5);
      const delta = displacement(movement, "board");
      if (x) expect(delta.x * x, direction).toBeGreaterThan(0.05);
      else expect(Math.abs(delta.x)).toBeLessThan(0.001);
      if (y) expect(delta.y * y, direction).toBeGreaterThan(0.05);
      else expect(Math.abs(delta.y)).toBeLessThan(0.001);
      expect(movement.every((f) => !f.dash && f.boardShots.length === 0)).toBe(true);
      await fingers.up(1);
    }
    await fingers.down(2, action(page, "Fire"));
    const fire = await frames(page, "board", 18);
    still(fire, "board");
    expect(fire.some((f) => f.boardShots.length > 0)).toBe(true);
    expect(fire.every((f) => !f.dash)).toBe(true);
    expect(hasProjectileTrajectory(fire, "boardShots", 1, -1), "Released up-right movement must retain positive-X, negative-Y projectile aim").toBe(true);
    await fingers.up(2);
    // The direction tour can end against an entry-bay wall. Relaunch through
    // the real menu so the separate dash/fire leg uses row 2's eastward doorway.
    await fingers.tap(9, action(page, "DEV"));
    await fingers.tap(9, action(page, "BOARDING"));
    await fingers.tap(9, action(page, "X"));
    const respawn = (await frames(page, "board", 3)).at(-1)!.board!;
    expect(respawn.x).toBeCloseTo(68 / 32, 3);
    expect(respawn.y).toBeCloseTo(68 / 32, 3);
    await fingers.down(1, action(page, "Move right"));
    await fingers.down(3, action(page, "Dash"));
    const dash = await frames(page, "board", 6);
    expect(dash.some((f) => f.dash)).toBe(true);
    expect(displacement(dash, "board").x).toBeGreaterThan(0.4);
    await fingers.down(2, action(page, "Fire"));
    expect((await frames(page, "board", 8)).some((f) => f.boardShots.length > 0)).toBe(true);
    await fingers.up(1);
    await fingers.up(3);
    still(await freshFireCycle(page, "board"), "board");
    // A separate fresh entry keeps enemy aggro/death from changing position
    // during the cancellation observation. All actions below are real touches.
    await fingers.up(2);
    await fingers.tap(9, action(page, "DEV"));
    await fingers.tap(9, action(page, "BOARDING"));
    await fingers.tap(9, action(page, "X"));
    await fingers.down(1, action(page, "Move up"));
    await fingers.down(2, action(page, "Fire"));
    await fingers.down(3, action(page, "Dash"));
    await page.waitForFunction(() => window.touchEvidence.frames.at(-1)?.dash === true);
    await fingers.cancel();
    await page.waitForFunction(() => {
      const frame = window.touchEvidence.frames.at(-1);
      return frame?.board && frame.boardShots.length === 0 && !frame.dash;
    });
    // Cover the 40-frame dash cooldown after all existing effects have ended.
    const cancelled = await frames(page, "board", 48);
    try { still(cancelled, "board"); } catch (error) {
      const events = await page.evaluate(() => window.touchEvidence.events.slice(-45));
      const pressed = await page.locator('[aria-pressed="true"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label")));
      throw new Error(JSON.stringify({ events, pressed, first: cancelled[0], last: cancelled.at(-1) }), { cause: error });
    }
    expect(cancelled.every((frame) => frame.boardShots.length === 0 && !frame.dash)).toBe(true);
  });
  await receipt(page, testInfo, "DevPanel -> boarding -> eight directions -> retained facing -> DevPanel BOARDING relaunch -> fire/dash", "freshLegacy", "All eight directions move correctly without firing or dashing; stationary fire retains diagonal aim; moving dash and three-finger fire work in the entry corridor; cancelling all three held actions stops movement and fresh firing/dashing.");
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
    await fingers.down(3, action(page, "Fire / interact"));
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
  await openMode(page, "GROUND RUN");
  await page.waitForFunction(() => window.touchEvidence.frames.at(-1)?.ground?.sprite.endsWith("player-idle.png"));
  await withFingers(page, async (fingers) => {
    await fingers.down(1, action(page, "Move right"));
    expect(displacement(await frames(page, "ground", 6), "ground").x).toBeGreaterThan(1);
    await fingers.cancel();
    still(await frames(page, "ground", 8), "ground");
    expect(await page.evaluate(() => window.touchEvidence.pointerCancels)).toBeGreaterThan(0);
    await fingers.down(1, action(page, "Move right"));
    await frames(page, "ground", 5);
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await fingers.move(1, action(page, "Move left"));
    still(await frames(page, "ground", 8), "ground");
    await fingers.up(1);
    // Start the pause leg at the entrance so earlier movement and combat cannot
    // produce a death/respawn inside the held-input observation window.
    await fingers.tap(9, action(page, "DEV"));
    await fingers.tap(9, action(page, "GROUND RUN"));
    await fingers.tap(9, action(page, "X"));
    await page.waitForFunction(() => window.touchEvidence.frames.at(-1)?.ground?.sprite.endsWith("player-idle.png"));
    await fingers.down(1, action(page, "Move left"));
    await fingers.down(2, action(page, "Fire"));
    await frames(page, "ground", 6);
    await fingers.tap(9, page.getByTitle("Pause (ESC)", { exact: true }));
    await expect(action(page, "RESUME")).toBeVisible();
    await fingers.tap(9, action(page, "RESUME"));
    await expect(action(page, "RESUME")).toBeHidden();
    await fingers.move(1, action(page, "Move right"));
    await fingers.move(2, action(page, "Fire"));
    await frames(page, "ground", 18);
    const resumed = await frames(page, "ground", 8);
    // The rendered coordinate includes the camera's easing toward its target
    // after world movement stops; allow less than one pixel of residual easing.
    try {
      still(resumed, "ground", 1);
      expect(resumed.every((f) => !f.ground!.sprite.endsWith("player-shoot.png"))).toBe(true);
      // A wall can hide displacement from leaked Left input, but its running
      // animation still exposes that input before collision resolution.
      expect(resumed.every((f) => f.ground!.sprite.endsWith("player-idle.png"))).toBe(true);
    } catch (error) {
      const observed = await page.evaluate(() => ({
        frames: window.touchEvidence.frames.slice(-250),
        events: window.touchEvidence.events.slice(-150),
        texts: window.touchEvidence.texts,
        controls: [...document.querySelectorAll('[role="group"][aria-label="Ground controls"] button')].map((node) => ({
          label: node.getAttribute("aria-label"), pressed: node.getAttribute("aria-pressed"),
        })),
      }));
      await testInfo.attach("ground-resume-observations", {
        body: Buffer.from(JSON.stringify({ resumed, ...observed }, null, 2)), contentType: "application/json",
      });
      throw error;
    }
    await fingers.up(1); await fingers.up(2);
    await fingers.down(1, action(page, "Move right"));
    expect(displacement(await frames(page, "ground", 6), "ground").x).toBeGreaterThan(1);
    await switchMode(page, "FIRST PERSON");
    await expect(page.getByRole("group", { name: "First-person controls", exact: true })).toBeVisible();
    await fingers.move(1, action(page, "Strafe left"));
    const transitioned = await frames(page, "fp", 10);
    still(transitioned, "fp");
    expect(transitioned.every((f) => Math.abs(f.heading!.y) < 0.001 && !f.gun)).toBe(true);
    await fingers.up(1);
    await fingers.down(1, action(page, "Strafe left"));
    expect(displacement(await frames(page, "fp", 6), "fp").y).toBeLessThan(-0.1);
  });
  await receipt(page, testInfo, "ground -> touchcancel -> blur -> pause/resume -> first person", "freshLegacy", "Native cancellation produces pointercancel; blur, pause and route transitions clear owners; moving old fingers cannot re-arm controls; a fresh touch works.");
});

test("@pointer visible action buttons support held keyboard and mouse activation and turret keyboard aim", async ({ page }, testInfo) => {
  await installObservation(page);
  await installSaveFixture(page, freshLegacy);
  await page.goto("/");
  await switchMode(page, "GROUND RUN");
  await page.waitForFunction(() => window.touchEvidence.frames.at(-1)?.ground?.sprite.endsWith("player-idle.png"));
  await action(page, "Jump").focus();
  await page.keyboard.down("Enter");
  const jump = await frames(page, "ground", 10);
  await page.keyboard.up("Enter");
  expect(jump.some((f) => f.ground!.sprite.endsWith("player-jump.png"))).toBe(true);
  expect(jump.every((f) => f.groundShots.length === 0)).toBe(true);
  await page.waitForFunction(() => window.touchEvidence.frames.at(-1)?.ground?.sprite.endsWith("player-idle.png"));
  await action(page, "Fire").focus();
  await page.keyboard.down("Space");
  const keyFire = await frames(page, "ground", 18);
  await page.keyboard.up("Space");
  expect(keyFire.some((f) => f.groundShots.length > 0)).toBe(true);
  expect(keyFire.every((f) => !f.ground!.sprite.endsWith("player-jump.png"))).toBe(true);
  const target = await center(action(page, "Fire"));
  await page.mouse.move(target.x, target.y); await page.mouse.down();
  expect((await frames(page, "ground", 18)).some((f) => f.ground!.sprite.endsWith("player-shoot.png"))).toBe(true);
  await page.mouse.up();
  await frames(page, "ground", 20);
  expect((await frames(page, "ground", 8)).every((f) => !f.ground!.sprite.endsWith("player-shoot.png"))).toBe(true);
  await switchMode(page, "TURRET");
  await action(page, "Aim turret").focus();
  const before = (await frames(page, "turret", 4)).at(-1)!.turret!;
  await page.keyboard.down("ArrowRight");
  const after = await frames(page, "turret", 5);
  await page.keyboard.up("ArrowRight");
  expect(after.at(-1)!.turret!.x).toBeGreaterThan(before.x);
  expect(after.every((f) => !f.turretFire)).toBe(true);
  await receipt(page, testInfo, "ground buttons -> keyboard/mouse -> turret keyboard aim", "freshLegacy", "Visible Jump and Fire buttons retain their named behavior under keyboard/mouse activation; focusing turret aim allows arrow-key positioning without firing.", "pointer");
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

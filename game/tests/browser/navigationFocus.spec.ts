import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

import { applyColonyFixture, findFixture } from "../../app/components/colony/dev/seedColony";
import { dispatchPoi } from "../../app/components/colony/region/poiDispatcher";
import { createPoiGameState, preparePoiCompletion } from "../../app/components/colony/region/poiRuntime";
import { ALL_LEVELS } from "../../app/components/engine/levels";
import { migrateSave, recalcPilotLevel } from "../../app/components/engine/save";
import { CODEX_ENTRIES, CODEX_CATEGORIES, getEntriesForCategory, unlockCodexEntries } from "../../app/components/engine/codex";
import { EnemyType, GameScreen, type SaveData } from "../../app/components/engine/types";
import { colonyFounded, freshLegacy, galaxyAtAshfall, pendingGalaxyPoiReturn } from "./fixtures/routeFixtures";
import { attachBrowserReceipt } from "./helpers/receipt";
import { installOutcomeWriteProbe } from "./helpers/outcomeWriteProbe";
import { installSaveFixture, readInstalledSave } from "./helpers/saveFixture";

import { CREW, getAvailableConversations } from "../../app/components/engine/crewDialog";
import { UPGRADE_DEFS } from "../../app/components/engine/upgrades";
import { recordKill } from "../../app/components/engine/bestiary";

const CANVAS = "#sector-zero-game-canvas";
type Method = "keyboard" | "pointer" | "touch";
type DrawText = { text: string; x: number; y: number; color: string };
declare global { interface Window { navigationDraws: DrawText[] } }

function canonical(save: SaveData): SaveData {
  return recalcPilotLevel(unlockCodexEntries(migrateSave(JSON.parse(JSON.stringify(save)))));
}
const colonyReady = canonical({ ...colonyFounded, introSeen: true });
const campaignReady = canonical({
  ...freshLegacy, introSeen: true,
  levels: Object.fromEntries(ALL_LEVELS.map(level => [`${level.world}-${level.level}`, { completed: true, stars: 3, highScore: 1000 }])),
});

// This is a persisted pending-delivery route, built through the shipped save
// authorities before browser hydration. It does not claim a gameplay clear.
function preparedPoiFixture(): SaveData {
  const fixture = findFixture("region");
  if (!fixture) throw new Error("Missing Region fixture");
  const seeded = applyColonyFixture(freshLegacy, fixture);
  const save = canonical({ ...seeded.save, introSeen: true });
  const dispatched = dispatchPoi(save, seeded.colonyId, "ashfall-cinder-relay");
  if (!dispatched.ok) throw new Error(`POI fixture dispatch: ${dispatched.reason}`);
  const state = createPoiGameState(dispatched.session, save, "legacy", () => "browser-b3-prepared-poi", save, seeded.colonyId);
  if (!state.outcomeAttempt) throw new Error("POI fixture has no authority");
  const prepared = preparePoiCompletion(save, { originColonyId: seeded.colonyId, session: dispatched.session }, GameScreen.LEVEL_COMPLETE, state.outcomeAttempt);
  if (!prepared) throw new Error("POI fixture preparation failed");
  return canonical(prepared.preparedSave);
}

async function observeDraws(page: Page) {
  await page.addInitScript(() => {
    window.navigationDraws = [];
    const originalFill = CanvasRenderingContext2D.prototype.fillRect;
    CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) {
      if (this.canvas.id === "sector-zero-game-canvas" && x === 0 && y === 0 && w === 480 && h === 854) window.navigationDraws = [];
      return originalFill.call(this, x, y, w, h);
    };
    const originalImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (image: CanvasImageSource, ...args: number[]) {
      if (this.canvas.id === "sector-zero-game-canvas" && args.length === 4 && args[0] === 0 && args[1] === 0 && args[2] === 480 && args[3] === 854) window.navigationDraws = [];
      return Reflect.apply(originalImage, this, [image, ...args]);
    };
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
      if (this.canvas.id === "sector-zero-game-canvas") {
        window.navigationDraws.push({ text: String(text), x, y, color: String(this.fillStyle) });
        if (window.navigationDraws.length > 4000) window.navigationDraws.splice(0, 2000);
      }
      if (maxWidth === undefined) original.call(this, text, x, y);
      else original.call(this, text, x, y, maxWidth);
    };
  });
}
async function expectDraw(page: Page, text: string) {
  await expect.poll(() => page.evaluate(text => window.navigationDraws.some(draw => draw.text === text), text)).toBe(true);
}
async function clearDraws(page: Page) { await page.evaluate(() => { window.navigationDraws.length = 0; }); }
async function key(page: Page, key: string) {
  await page.keyboard.down(key);
  await page.waitForTimeout(100); // A native hold spans the canvas input sampling frame.
  await page.keyboard.up(key);
  await page.waitForTimeout(50);
}
async function activate(page: Page, target: Locator, method: Method) {
  if (method === "keyboard") { await target.focus(); await page.keyboard.press("Enter"); }
  else if (method === "pointer") await target.click();
  else await target.tap();
}
async function holdControl(page: Page, target: Locator, method: "pointer" | "touch") {
  if (method === "pointer") { await target.click({ delay: 140 }); return; }
  const box = (await target.boundingBox())!;
  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 1, x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
  await page.waitForTimeout(140);
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await session.detach();
}
async function point(page: Page, method: Exclude<Method, "keyboard">, x: number, y: number) {
  const canvas = page.locator(CANVAS);
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas has no bounds");
  const local = { x: x / 480 * box.width, y: y / 854 * box.height };
  if (method === "pointer") await page.mouse.click(box.x + local.x, box.y + local.y);
  else await page.touchscreen.tap(box.x + local.x, box.y + local.y);
}
async function openLegacy(page: Page, save = colonyReady, method: Method = "keyboard") {
  await observeDraws(page);
  await installSaveFixture(page, save);
  await page.goto("/");
  await activate(page, page.getByRole("button", { name: "LEGACY CAMPAIGN", exact: true }), method);
  await expectDraw(page, "UEC VANGUARD — BRIDGE");
  await page.locator(CANVAS).focus();
}
async function openColonies(page: Page) {
  await openLegacy(page);
  await key(page, "ArrowLeft");
  await key(page, "Enter");
  await expect(page.getByRole("button", { name: "DESCEND TO COLONY", exact: true })).toBeVisible();
}
async function openAtlas(page: Page) {
  await installSaveFixture(page, galaxyAtAshfall);
  await page.goto("/");
  await activate(page, page.getByRole("button", { name: "CONTINUE GALAXY", exact: true }), "keyboard");
  return page.getByRole("dialog", { name: "Galaxy Atlas", exact: true });
}
async function expectInside(dialog: Locator) {
  await expect.poll(() => dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
}
async function proveTrap(page: Page, dialog: Locator) {
  const controls = dialog.locator('button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex="0"]');
  const candidates = await controls.all();
  const tabbable: Locator[] = [];
  for (const candidate of candidates) {
    if (await candidate.isVisible() && await candidate.evaluate(node => (node as HTMLElement).tabIndex >= 0)) tabbable.push(candidate);
  }
  expect(tabbable.length).toBeGreaterThan(0);
  await tabbable[0].focus();
  await page.keyboard.press("Shift+Tab");
  await expect(tabbable.at(-1)!).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(tabbable[0]).toBeFocused();
  for (let i = 0; i < tabbable.length + 1; i++) {
    await page.keyboard.press("Tab");
    await expectInside(dialog);
  }
}
async function receipt(info: TestInfo, method: Method, fixture: string, route: string, expected: string, run: () => Promise<void>) {
  let passed = false;
  try { await run(); passed = true; }
  finally {
    await attachBrowserReceipt(info, { inputMethod: method, saveFixture: fixture, route, expectedOutcome: expected,
      observedOutcome: passed ? expected : "The browser assertion failed; see this test's assertion, screenshot, and trace evidence." });
  }
}

test("@keyboard Atlas repeated arrows retain selected-contact focus and trap Tab", async ({ page }, info) => {
  await receipt(info, "keyboard", "galaxyAtAshfall", "Continue Galaxy -> Atlas contacts -> arrows -> Tab trap -> Escape", "Selected Atlas contact receives initial focus; consecutive arrows move focus with selection; Tab stays inside; Escape restores Continue Galaxy.", async () => {
    const atlas = await openAtlas(page);
    await expect(atlas.locator('[role="option"][aria-selected="true"]')).toBeFocused();
    const visited: string[] = [];
    for (const direction of ["ArrowDown", "ArrowDown", "ArrowUp"]) {
      await page.keyboard.press(direction);
      const selected = atlas.locator('[role="option"][aria-selected="true"]');
      await expect(selected).toBeFocused();
      visited.push((await selected.getAttribute("data-atlas-contact"))!);
    }
    expect(visited[0]).not.toBe(visited[1]);
    expect(visited[2]).toBe(visited[0]);
    await proveTrap(page, atlas);
    await page.keyboard.press("Escape");
    await expect(atlas).toBeHidden();
    await expect(page.getByRole("button", { name: "CONTINUE GALAXY", exact: true })).toBeFocused();
  });
});

test("@keyboard Colonies initial focus trap and Escape restore cockpit invoker", async ({ page }, info) => {
  await receipt(info, "keyboard", "colonyFounded + introSeen", "Legacy cockpit -> Colonies -> Tab trap -> Escape", "Colonies owns initial focus and traps both Tab directions; Escape restores the cockpit Colonies button.", async () => {
    await openColonies(page);
    const colonies = page.getByRole("dialog", { name: "Colonies", exact: true });
    await expect(colonies.getByRole("button", { name: "DESCEND TO COLONY", exact: true })).toBeFocused();
    await proveTrap(page, colonies);
    await page.keyboard.press("Escape");
    await expect(colonies).toBeHidden();
    await expect(page.locator("#cockpit-colonies-invoker")).toBeFocused();
    await expectDraw(page, "UEC VANGUARD — BRIDGE");
  });
});

test("@keyboard founding the first colony retains primary focus and the cockpit invoker", async ({ page }, info) => {
  await receipt(info, "keyboard", "freshLegacy + introSeen", "Legacy cockpit -> empty Colonies -> Enter to Found -> Descend focus -> Tab trap -> Escape", "Found Colony initially owns focus; native Enter creates the colony and moves focus to Descend; Tab stays contained and Escape restores the cockpit Colonies invoker.", async () => {
    await openLegacy(page, canonical({ ...freshLegacy, introSeen: true }));
    await key(page, "ArrowLeft");
    await key(page, "Enter");
    const colonies = page.getByRole("dialog", { name: "Colonies", exact: true });
    await expect(colonies.getByRole("button", { name: "Found Colony at Ashfall", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    const descend = colonies.getByRole("button", { name: "DESCEND TO COLONY", exact: true });
    await expect(descend).toBeVisible();
    await expect(descend).toBeFocused();
    expect((await readInstalledSave(page)).colonies).toHaveLength(1);
    await proveTrap(page, colonies);
    await page.keyboard.press("Escape");
    await expect(colonies).toBeHidden();
    await expect(page.locator("#cockpit-colonies-invoker")).toBeFocused();
    await expectDraw(page, "UEC VANGUARD — BRIDGE");
  });
});

test("@keyboard cockpit Region has honest source and restores its exact nested invoker", async ({ page }, info) => {
  await receipt(info, "keyboard", "colonyFounded + introSeen", "Colonies -> view-only Region -> repeated arrows -> Tab trap -> Escape", "Region identifies Cockpit, keeps actions unavailable, tracks repeated-arrow focus, and restores REGION — VIEW ONLY without closing Colonies.", async () => {
    await openColonies(page);
    const invoker = page.getByRole("button", { name: "REGION — VIEW ONLY", exact: true });
    await activate(page, invoker, "keyboard");
    const region = page.getByRole("dialog", { name: "Region map", exact: true });
    await expect(region).toContainText("COCKPIT");
    await expect(region.locator('[role="option"][aria-selected="true"]')).toBeFocused();
    for (const direction of ["ArrowDown", "ArrowDown", "ArrowUp"]) {
      await page.keyboard.press(direction);
      await expect(region.locator('[role="option"][aria-selected="true"]')).toBeFocused();
    }
    await expect(region.locator("[data-region-action]")).toHaveCount(0);
    await proveTrap(page, region);
    await page.keyboard.press("Escape");
    await expect(region).toBeHidden();
    await expect(invoker).toBeFocused();
    await expect(page.getByRole("dialog", { name: "Colonies", exact: true })).toBeVisible();
  });
});

test("@keyboard landing pad Resume trap and nested Region preserve landing-pad provenance", async ({ page }, info) => {
  await receipt(info, "keyboard", "colonyFounded + introSeen", "Colonies -> Descend -> Interact -> Exit Menu -> Region -> Resume", "Exit Menu initially focuses Resume; Region returns to the exact REGION MAP button; Escape resumes to the exploration canvas.", async () => {
    await openColonies(page);
    await activate(page, page.getByRole("button", { name: "DESCEND TO COLONY", exact: true }), "keyboard");
    const interact = page.getByRole("group", { name: "Colony controls", exact: true }).getByRole("button", { name: "Interact", exact: true });
    await interact.focus();
    await key(page, "Enter");
    const menu = page.getByRole("dialog", { name: "Landing pad exit menu", exact: true });
    await expect(menu.getByRole("button", { name: "Resume", exact: true })).toBeFocused();
    await proveTrap(page, menu);
    const regionInvoker = menu.getByRole("button", { name: "REGION MAP", exact: true });
    await activate(page, regionInvoker, "keyboard");
    const region = page.getByRole("dialog", { name: "Region map", exact: true });
    await expect(region).toContainText("LANDING PAD");
    await page.keyboard.press("Escape");
    await expect(region).toBeHidden();
    await expect(regionInvoker).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(page.locator(CANVAS)).toBeFocused();
  });
});

test("@keyboard restored POI delivery owns focus and cannot be dismissed by Escape", async ({ page }, info) => {
  await receipt(info, "keyboard", "prepared Legacy Cinder Relay delivery", "Saved POI preparation -> Legacy -> delivery dialog -> Tab trap -> Escape -> confirm", "The restored POI dialog initially focuses Confirm Delivery, traps Tab, preserves pending cargo on Escape, and confirms into Colony exploration.", async () => {
    await installSaveFixture(page, preparedPoiFixture());
    await page.goto("/");
    await activate(page, page.getByRole("button", { name: "LEGACY CAMPAIGN", exact: true }), "keyboard");
    const outcome = page.getByRole("dialog", { name: "POI outcome", exact: true });
    const confirm = outcome.getByRole("button", { name: "CONFIRM DELIVERY", exact: true });
    await expect(confirm).toBeFocused();
    await proveTrap(page, outcome);
    await page.keyboard.press("Escape");
    await expect(outcome).toBeVisible();
    await expect(outcome.getByRole("status")).toContainText("Resolve this expedition");
    await expectInside(outcome);
    await activate(page, confirm, "keyboard");
    await expect(outcome).toBeHidden();
    await expect(page.getByRole("group", { name: "Colony controls", exact: true })).toBeVisible();
    await expect(page.locator(CANVAS)).toBeFocused();
  });
});

for (const method of ["pointer", "touch"] as const) {
  test(`@${method} Star Map activates the world and level under the actual contact`, async ({ page }, info) => {
    await receipt(info, method, "all authored campaign levels completed", "Legacy -> Star Map -> World 2 -> Level 2", "A nonselected World 2 contact expands that world; contacting its second level launches World 2 Level 2.", async () => {
      await openLegacy(page, campaignReady, method);
      await point(page, method, 240, 500);
      await expectDraw(page, "SELECT SECTOR");
      await expect(page.getByRole("button", { name: "RETURN TO COCKPIT", exact: true })).toBeVisible();
      await activate(page, page.getByRole("button", { name: "RETURN TO COCKPIT", exact: true }), method);
      await expectDraw(page, "UEC VANGUARD — BRIDGE");
      await expect(page.locator(CANVAS)).toBeFocused();
      await point(page, method, 240, 500);
      await expectDraw(page, "SELECT SECTOR");
      await point(page, method, 110, 620);
      await clearDraws(page);
      await point(page, method, 170, 595);
      await expectDraw(page, "WORLD 2 - LEVEL 2");
    });
  });
}

test("@keyboard outcome recovery owns initial focus and Tab above a mounted Region", async ({ page }, info) => {
  await receipt(info, "keyboard", "pendingGalaxyPoiReturn + one failed acknowledgement", "Persisted POI return -> Region mount -> acknowledgement failure -> recovery -> native retry", "The recovery overlay takes initial focus, traps both Tab directions above Region, and native retry returns focus to the selected Region destination.", async () => {
    await installSaveFixture(page, pendingGalaxyPoiReturn());
    await installOutcomeWriteProbe(page, { acknowledgement: 1 });
    await page.goto("/");
    const recovery = page.getByRole("alert", { name: "Outcome persistence status", exact: true });
    await expect(recovery).toContainText("OUTCOME RETURN SAVE FAILED");
    const retry = recovery.getByRole("button", { name: "RETRY OUTCOME", exact: true });
    await expect(retry).toBeFocused();
    await proveTrap(page, recovery);
    await activate(page, retry, "keyboard");
    await expect(recovery).toBeHidden();
    const region = page.getByRole("dialog", { name: "Region map", exact: true });
    await expect(region.locator('[role="option"][aria-selected="true"]')).toBeFocused();
  });
});


const cockpitReady = canonical({
  ...campaignReady, credits: 100000, xp: 100000,
  unlockedCodex: CODEX_ENTRIES.map(entry => entry.id),
  bestiary: recordKill(recordKill({}, EnemyType.SCOUT, "swarm", { world: 1 }), EnemyType.DRONE, "tech-drone", { world: 1 }),
});

for (const method of ["pointer", "touch"] as const) {
  test(`@${method} cockpit menus activate hit rows tabs and actions independently of keyboard selection`, async ({ page }, info) => {
    await receipt(info, method, "canonical completed campaign with credits codex and two bestiary entries", "Armory -> Crew -> Codex -> Bestiary -> Pilot", "Actual menu targets buy Engine Boost, read the chosen crew conversation and codex entry, show Drone, and allocate Overcharge.", async () => {
      await openLegacy(page, cockpitReady, method);
      await point(page, method, 240, 645);
      await expectDraw(page, "ARMORY");
      await key(page, "ArrowDown");
      await key(page, "ArrowDown");
      const detailY = 70 + UPGRADE_DEFS.length * 56 + 22;
      const selectedDetail = () => page.evaluate(y => window.navigationDraws.find(draw => draw.y === y && draw.x === 28)?.text, detailY);
      await expect.poll(selectedDetail).toBe(UPGRADE_DEFS[2].name);
      const box = (await page.locator(CANVAS).boundingBox())!;
      await page.mouse.move(box.x + 100 / 480 * box.width, box.y + 95 / 854 * box.height);
      await expect.poll(selectedDetail).toBe(UPGRADE_DEFS[2].name);
      await point(page, method, 100, 150);
      await expect.poll(async () => (await readInstalledSave(page)).upgrades.engineBoost).toBe(1);
      expect((await readInstalledSave(page)).upgrades.hullPlating).toBe(0);
      expect((await readInstalledSave(page)).upgrades[UPGRADE_DEFS[2].id]).toBe(0);
      await point(page, method, 35, 25);
      await point(page, method, 105, 320);
      await expectDraw(page, "CREW QUARTERS");
      await point(page, method, 400, 120);
      const conversation = getAvailableConversations(CREW[2].id, cockpitReady)[1];
      expect(conversation).toBeTruthy();
      await point(page, method, 100, 320);
      await expectDraw(page, conversation.title);
      await point(page, method, 35, 22);
      await expect.poll(async () => (await readInstalledSave(page)).viewedConversations.includes(conversation.id)).toBe(true);
      await point(page, method, 35, 25);
      await point(page, method, 100, 145);
      await expectDraw(page, "SHIP'S LOG");
      await point(page, method, 180, 70);
      const entry = getEntriesForCategory(CODEX_CATEGORIES[1].id, cockpitReady)[1];
      await point(page, method, 100, 150);
      await expectDraw(page, entry.title);
      await point(page, method, 240, 814);
      await expect.poll(async () => (await readInstalledSave(page)).viewedCodex.includes(entry.id)).toBe(true);
      await point(page, method, 35, 25);
      await point(page, method, 370, 145);
      await expectDraw(page, "BESTIARY");
      await point(page, method, 100, 125);
      await expect.poll(() => page.evaluate(() => window.navigationDraws.some(draw => draw.text.includes("TYPE: Drone")))).toBe(true);
      await point(page, method, 240, 829);
      await point(page, method, 35, 25);
      await point(page, method, 240, 750);
      await expectDraw(page, "COMBAT");
      await point(page, method, 100, 270);
      await expect.poll(async () => (await readInstalledSave(page)).allocatedSkills).toEqual(["overcharge"]);
      await info.attach("pilot-hit-target", { body: await page.screenshot(), contentType: "image/png" });
    });
  });

  test(`@${method} Atlas and Region activate actual contacts and restore the Atlas invoker`, async ({ page }, info) => {
    await receipt(info, method, "galaxyAtAshfall", "Atlas contact -> Ashfall -> Region node -> back -> close", "Pointer hover leaves Atlas keyboard selection unchanged; actual contacts update details; Region returns to its exact Atlas button; Close restores the Galaxy choice.", async () => {
      await installSaveFixture(page, galaxyAtAshfall);
      await page.goto("/");
      await activate(page, page.getByRole("button", { name: "CONTINUE GALAXY", exact: true }), method);
      const atlas = page.getByRole("dialog", { name: "Galaxy Atlas", exact: true });
      const selected = atlas.locator('[role="option"][aria-selected="true"]');
      const original = await selected.getAttribute("data-atlas-contact");
      const target = atlas.locator('[role="option"][aria-selected="false"]').first();
      const targetId = await target.getAttribute("data-atlas-contact");
      await target.hover();
      await expect(selected).toHaveAttribute("data-atlas-contact", original!);
      await activate(page, target, method);
      await expect(selected).toHaveAttribute("data-atlas-contact", targetId!);
      await activate(page, atlas.locator('[data-atlas-contact="contact:ashfall"]'), method);
      const invoker = atlas.getByRole("button", { name: "OPEN ASHFALL REGION", exact: true });
      await activate(page, invoker, method);
      const region = page.getByRole("dialog", { name: "Region map", exact: true });
      await expect(region).toContainText("ATLAS LINK");
      const node = region.getByRole("option", { name: "Cinder Relay Ruins, rumored", exact: true });
      await activate(page, node, method);
      await expect(node).toHaveAttribute("aria-selected", "true");
      await expect(region.locator("[data-region-detail-panel]")).toContainText("Cinder Relay Ruins");
      await info.attach("region-atlas-provenance", { body: await page.screenshot(), contentType: "image/png" });
      await activate(page, region.getByRole("button", { name: "← RETURN TO ATLAS", exact: true }), method);
      await expect(invoker).toBeFocused();
      await activate(page, atlas.getByRole("button", { name: "← CLOSE ATLAS", exact: true }), method);
      await expect(page.getByRole("button", { name: "CONTINUE GALAXY", exact: true })).toBeFocused();
    });
  });

  test(`@${method} Colony descent Resume and Take Off follow actual controls`, async ({ page }, info) => {
    await receipt(info, method, "colonyFounded + introSeen", "Cockpit Colonies -> Descend -> Interact -> Resume -> Interact -> Take Off", "Actual Colony actions open exploration, Resume closes the pad menu, and Take Off returns through the saved cockpit route.", async () => {
      await openLegacy(page, colonyReady, method);
      await activate(page, page.getByRole("button", { name: "Colonies", exact: true }), method);
      await activate(page, page.getByRole("button", { name: "DESCEND TO COLONY", exact: true }), method);
      const interact = page.getByRole("group", { name: "Colony controls", exact: true }).getByRole("button", { name: "Interact", exact: true });
      await holdControl(page, interact, method);
      const menu = page.getByRole("dialog", { name: "Landing pad exit menu", exact: true });
      await expect(menu.getByRole("button", { name: "Resume", exact: true })).toBeFocused();
      await activate(page, menu.getByRole("button", { name: "Resume", exact: true }), method);
      await expect(menu).toBeHidden();
      await expect(page.locator(CANVAS)).toBeFocused();
      await holdControl(page, interact, method);
      await activate(page, menu.getByRole("button", { name: "Take Off", exact: true }), method);
      await expect(menu).toBeHidden();
      await expectDraw(page, "UEC VANGUARD — BRIDGE");
    });
  });

  test(`@${method} restored POI cargo resolves through its actual delivery button`, async ({ page }, info) => {
    await receipt(info, method, "prepared Legacy Cinder Relay delivery", "Prepared save -> Legacy -> Confirm Delivery -> Colony", "The actual delivery button consumes the prepared cargo once and returns to Colony exploration.", async () => {
      await installSaveFixture(page, preparedPoiFixture());
      await page.goto("/");
      await activate(page, page.getByRole("button", { name: "LEGACY CAMPAIGN", exact: true }), method);
      const outcome = page.getByRole("dialog", { name: "POI outcome", exact: true });
      await activate(page, outcome.getByRole("button", { name: "CONFIRM DELIVERY", exact: true }), method);
      await expect(outcome).toBeHidden();
      await expect(page.getByRole("group", { name: "Colony controls", exact: true })).toBeVisible();
      expect((await readInstalledSave(page)).outcomeRecoveryRecords.filter(record => record.kind === "legacy_poi_prepared")).toEqual([]);
    });
  });
}

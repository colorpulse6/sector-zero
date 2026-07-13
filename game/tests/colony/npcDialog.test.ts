import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildGovernorDialog,
  buildQuartermasterDialog,
  buildQuartermasterShop,
  buildColonistBark,
} from "../../app/components/colony/exploration/npc/npcDialog";
import { adjustedBuyPrice } from "../../app/components/colony/shared/factionLedger";
import { getConsumableDef } from "../../app/components/engine/planets";
import { makeTestColony } from "./fixtures";

// ─── buildGovernorDialog ────────────────────────────────────────────────────

test("buildGovernorDialog: mentions population.total in the dialog text", () => {
  const colony = makeTestColony({
    population: { total: 14, capacity: 20, namedCount: 2, growthRate: 0.5, recentDeaths: [] },
  });
  const lines = buildGovernorDialog(colony);
  const joined = lines.map((l) => l.text).join(" ");
  assert.ok(joined.includes("14"), `expected population total "14" somewhere in dialog: ${joined}`);
});

test("buildGovernorDialog: names a non-operational building by type and status", () => {
  const colony = makeTestColony({
    buildings: [
      { id: "wp1", type: "water_purifier", tier: 1, status: "offline", buildProgressCycles: 0, hp: 0, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
      { id: "farm1", type: "farm", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const lines = buildGovernorDialog(colony);
  const joined = lines.map((l) => l.text).join(" ").toLowerCase();
  assert.ok(joined.includes("purifier"), `expected offline building named in dialog: ${joined}`);
  assert.ok(joined.includes("offline"), `expected offline status called out in dialog: ${joined}`);
});

test("buildGovernorDialog: all-operational colony uses the 'all operational' phrasing with no fault callout", () => {
  const colony = makeTestColony({
    buildings: [
      { id: "farm1", type: "farm", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
      { id: "solar1", type: "solar_array", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const lines = buildGovernorDialog(colony);
  const joined = lines.map((l) => l.text).join(" ").toLowerCase();
  // Must use the all-operational phrasing — NOT the "N of M operational" broken/constructing branch.
  assert.ok(joined.includes("all 2 of our buildings are operational"), `expected all-operational phrasing: ${joined}`);
  assert.ok(!/\d of \d/.test(joined), `unexpected "N of M" count on an all-operational colony: ${joined}`);
  assert.ok(
    !joined.includes("further along") && !joined.includes("still going up"),
    `unexpected non-operational callout: ${joined}`,
  );
});

test("buildGovernorDialog: constructing buildings are not counted as operational", () => {
  const colony = makeTestColony({
    buildings: [
      { id: "farm1", type: "farm", tier: 1, status: "operational", buildProgressCycles: 0, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
      { id: "farm2", type: "farm", tier: 1, status: "constructing", buildProgressCycles: 2, hp: 40, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null },
    ],
  });
  const lines = buildGovernorDialog(colony);
  const joined = lines.map((l) => l.text).join(" ").toLowerCase();
  // 1 of 2 operational — a mid-build colony must NOT be told all its buildings are operational.
  assert.ok(joined.includes("1 of 2"), `expected accurate "1 of 2 operational" count: ${joined}`);
  assert.ok(!joined.includes("all 2"), `constructing building must not be counted operational: ${joined}`);
});

test("buildGovernorDialog: mentions an active threat when present", () => {
  const colony = makeTestColony({
    activeThreats: [
      { id: "t1", kind: "raid_incoming", cyclesUntilResolve: 3, severity: "major", targetBuildingId: null, payload: null },
    ],
  });
  const lines = buildGovernorDialog(colony);
  const joined = lines.map((l) => l.text).join(" ").toLowerCase();
  assert.ok(joined.includes("raid"), `expected threat mention in dialog: ${joined}`);
});

test("buildGovernorDialog: no threat language when activeThreats is empty", () => {
  const colony = makeTestColony({ activeThreats: [] });
  const lines = buildGovernorDialog(colony);
  const joined = lines.map((l) => l.text).join(" ").toLowerCase();
  assert.ok(
    !joined.includes("raid") && !joined.includes("siege") && !joined.includes("disaster") && !joined.includes("supply"),
    `expected no threat language for empty activeThreats: ${joined}`,
  );
});

test("buildGovernorDialog: deterministic for the same colony", () => {
  const colony = makeTestColony({
    population: { total: 22, capacity: 30, namedCount: 3, growthRate: -0.2, recentDeaths: [] },
  });
  const a = buildGovernorDialog(colony);
  const b = buildGovernorDialog(colony);
  assert.deepEqual(a, b);
});

test("buildGovernorDialog: every line has a non-empty speaker and text", () => {
  const colony = makeTestColony();
  const lines = buildGovernorDialog(colony);
  assert.ok(lines.length > 0);
  for (const l of lines) {
    assert.equal(typeof l.speaker, "string");
    assert.ok(l.speaker.length > 0);
    assert.equal(typeof l.text, "string");
    assert.ok(l.text.length > 0);
  }
});

// ─── Faction-aware greetings (Phase 5a) ─────────────────────────────────────

test("buildGovernorDialog: greeting varies across the three rank bands", () => {
  const colony = makeTestColony();
  const cold = buildGovernorDialog(colony, "hostile")[0].text;
  const neutral = buildGovernorDialog(colony, "neutral")[0].text;
  const warm = buildGovernorDialog(colony, "allied")[0].text;
  assert.notEqual(cold, neutral);
  assert.notEqual(neutral, warm);
  assert.notEqual(cold, warm);
});

test("buildGovernorDialog: ranks within a band share a greeting; default rank is neutral", () => {
  const colony = makeTestColony();
  assert.equal(buildGovernorDialog(colony, "hostile")[0].text, buildGovernorDialog(colony, "hated")[0].text);
  assert.equal(buildGovernorDialog(colony, "liked")[0].text, buildGovernorDialog(colony, "allied")[0].text);
  assert.deepEqual(buildGovernorDialog(colony), buildGovernorDialog(colony, "neutral"));
});

test("buildGovernorDialog: greeting is prepended — status readout survives at every rank", () => {
  const colony = makeTestColony({
    population: { total: 14, capacity: 20, namedCount: 2, growthRate: 0.5, recentDeaths: [] },
  });
  for (const rank of ["hostile", "neutral", "allied"] as const) {
    const joined = buildGovernorDialog(colony, rank).map((l) => l.text).join(" ");
    assert.ok(joined.includes("14"), `population readout missing at ${rank}: ${joined}`);
  }
});

test("buildQuartermasterDialog: refusal at hated/hostile, greeting warmth tracks the band", () => {
  const cold = buildQuartermasterDialog("hated");
  assert.equal(cold.length, 1, "refusal is a single curt line");
  assert.deepEqual(cold, buildQuartermasterDialog("hostile"), "hated and hostile share the refusal");
  const neutral = buildQuartermasterDialog("neutral");
  const warm = buildQuartermasterDialog("allied");
  assert.notEqual(cold[0].text, neutral[0].text);
  assert.notEqual(neutral[0].text, warm[0].text);
  assert.deepEqual(buildQuartermasterDialog(), neutral, "default rank is neutral");
  for (const lines of [cold, neutral, warm]) {
    assert.equal(lines[0].speaker, "Quartermaster");
    assert.ok(lines[0].text.length > 0);
  }
});

// ─── buildQuartermasterShop ─────────────────────────────────────────────────

test("buildQuartermasterShop: every item is type consumable with a real itemId", () => {
  const colony = makeTestColony({ tier: 3 });
  const items = buildQuartermasterShop(colony);
  assert.ok(items.length >= 2 && items.length <= 4, `expected 2-4 items, got ${items.length}`);
  for (const item of items) {
    assert.equal(item.type, "consumable");
    assert.ok(item.itemId, "itemId must be set");
    const def = getConsumableDef(item.itemId as never);
    assert.ok(def, `itemId ${item.itemId} does not resolve via getConsumableDef`);
    assert.equal(def.id, item.itemId);
    assert.equal(typeof item.cost, "number");
  }
});

test("buildQuartermasterShop: item count stays within [2,4] and varies across tiers", () => {
  const byTier = ([1, 2, 3, 4] as const).map((tier) => buildQuartermasterShop(makeTestColony({ tier })));
  for (const items of byTier) {
    assert.ok(items.length >= 2 && items.length <= 4, `count ${items.length} out of [2,4] range`);
  }
  const serialized = byTier.map((items) => items.map((i) => i.itemId).join(","));
  const allIdentical = serialized.every((s) => s === serialized[0]);
  assert.ok(!allIdentical, "expected shop contents to vary across at least one pair of tiers");
});

test("buildQuartermasterShop: deterministic for the same colony", () => {
  const colony = makeTestColony({ tier: 2 });
  const a = buildQuartermasterShop(colony);
  const b = buildQuartermasterShop(colony);
  assert.deepEqual(a, b);
});

test("buildQuartermasterShop: costs are faction-adjusted via adjustedBuyPrice per rank", () => {
  const colony = makeTestColony({ tier: 4 });
  for (const rank of ["allied", "liked", "neutral", "hated"] as const) {
    const items = buildQuartermasterShop(colony, rank);
    for (const item of items) {
      const def = getConsumableDef(item.itemId as never);
      assert.equal(
        item.cost,
        adjustedBuyPrice(def.cost, rank),
        `${item.itemId} cost at ${rank} must come from adjustedBuyPrice`,
      );
    }
  }
  // Default rank is neutral — identical to the pre-faction base cost.
  for (const item of buildQuartermasterShop(colony)) {
    assert.equal(item.cost, getConsumableDef(item.itemId as never).cost);
  }
});

// ─── buildColonistBark ──────────────────────────────────────────────────────

test("buildColonistBark: returns 1 or 2 lines", () => {
  for (const tier of ["content", "strained", "grim"] as const) {
    for (const seed of [0, 1, 2, 3, 4, 5]) {
      const lines = buildColonistBark(tier, seed);
      assert.ok(lines.length === 1 || lines.length === 2, `tier ${tier} seed ${seed} returned ${lines.length} lines`);
    }
  }
});

test("buildColonistBark: content tier text differs from grim tier text", () => {
  const content = buildColonistBark("content", 5).map((l) => l.text).join(" ");
  const grim = buildColonistBark("grim", 5).map((l) => l.text).join(" ");
  assert.notEqual(content, grim);
});

test("buildColonistBark: deterministic for the same (tier, seed)", () => {
  const a = buildColonistBark("strained", 7);
  const b = buildColonistBark("strained", 7);
  assert.deepEqual(a, b);
});

test("buildColonistBark: every line has a speaker and non-empty text across all tiers", () => {
  for (const tier of ["content", "strained", "grim"] as const) {
    const lines = buildColonistBark(tier, 3);
    for (const l of lines) {
      assert.equal(typeof l.speaker, "string");
      assert.ok(l.speaker.length > 0);
      assert.ok(l.text.length > 0);
    }
  }
});

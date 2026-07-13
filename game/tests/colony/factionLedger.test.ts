import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FACTIONS,
  adjustStanding,
  adjustedBuyPrice,
  buyPriceMultiplier,
  clampStanding,
  defaultFactionStandings,
  merchantRefusesTrade,
  primaryFactionForPlanet,
  colonyMerchantRank,
  rankFor,
  rankFromStanding,
  sellPriceMultiplier,
  standingFor,
} from "../../app/components/colony/shared/factionLedger";
import type { FactionStanding } from "../../app/components/colony/shared/colonyTypes";
import { buildQuartermasterShop } from "../../app/components/colony/exploration/npc/npcDialog";
import { applyShopPurchase } from "../../app/components/engine/consumables";
import { loadSave, migrateSave } from "../../app/components/engine/save";
import { completePlanet } from "../../app/components/engine/planets";
import type { ConsumableId, PlanetId } from "../../app/components/engine/types";
import { makeTestColony } from "./fixtures";

// ─── Rank thresholds ─────────────────────────────────────────────────────────

test("rankFromStanding: all five bands with exact boundary values", () => {
  assert.equal(rankFromStanding(-100), "hostile");
  assert.equal(rankFromStanding(-80), "hostile");
  assert.equal(rankFromStanding(-79), "hated");
  assert.equal(rankFromStanding(-40), "hated");
  assert.equal(rankFromStanding(-39), "neutral");
  assert.equal(rankFromStanding(0), "neutral");
  assert.equal(rankFromStanding(39), "neutral");
  assert.equal(rankFromStanding(40), "liked");
  assert.equal(rankFromStanding(79), "liked");
  assert.equal(rankFromStanding(80), "allied");
  assert.equal(rankFromStanding(100), "allied");
});

test("rankFromStanding clamps out-of-range input; clampStanding pins to [-100,100]", () => {
  assert.equal(rankFromStanding(999), "allied");
  assert.equal(rankFromStanding(-999), "hostile");
  assert.equal(clampStanding(150), 100);
  assert.equal(clampStanding(-150), -100);
  assert.equal(clampStanding(7), 7);
});

// ─── Price multipliers ───────────────────────────────────────────────────────

test("buy/sell price multipliers follow the spec table for every rank", () => {
  assert.equal(buyPriceMultiplier("allied"), 0.9);
  assert.equal(buyPriceMultiplier("liked"), 0.95);
  assert.equal(buyPriceMultiplier("neutral"), 1);
  assert.equal(buyPriceMultiplier("hated"), 2);
  assert.equal(buyPriceMultiplier("hostile"), 2);
  assert.equal(sellPriceMultiplier("allied"), 1.1);
  assert.equal(sellPriceMultiplier("liked"), 1.05);
  assert.equal(sellPriceMultiplier("neutral"), 1);
  assert.equal(sellPriceMultiplier("hated"), 0.5);
  assert.equal(sellPriceMultiplier("hostile"), 0.5);
});

test("adjustedBuyPrice rounds up with Math.ceil and is the identity at neutral", () => {
  assert.equal(adjustedBuyPrice(101, "liked"), 96);   // ceil(95.95)
  assert.equal(adjustedBuyPrice(100, "allied"), 90);  // exact
  assert.equal(adjustedBuyPrice(7, "hated"), 14);     // 2×
  assert.equal(adjustedBuyPrice(333, "neutral"), 333);
});

test("merchantRefusesTrade: true only at hated and hostile", () => {
  assert.equal(merchantRefusesTrade("hostile"), true);
  assert.equal(merchantRefusesTrade("hated"), true);
  assert.equal(merchantRefusesTrade("neutral"), false);
  assert.equal(merchantRefusesTrade("liked"), false);
  assert.equal(merchantRefusesTrade("allied"), false);
});

// ─── adjustStanding ──────────────────────────────────────────────────────────

test("adjustStanding never mutates its input array or entries", () => {
  const original: FactionStanding[] = [
    { factionId: "ashfall_camp", standing: 10, rank: "neutral", permissions: [] },
  ];
  const snapshot = JSON.parse(JSON.stringify(original));
  const next = adjustStanding(original, "ashfall_camp", 35);
  assert.notEqual(next, original, "must return a new array");
  assert.deepEqual(original, snapshot, "input must be unchanged");
  assert.equal(next[0].standing, 45);
  assert.equal(next[0].rank, "liked");
});

test("adjustStanding creates a missing entry at 0 + delta", () => {
  const next = adjustStanding([], "free_traders", 50);
  assert.equal(next.length, 1);
  assert.deepEqual(next[0], { factionId: "free_traders", standing: 50, rank: "liked", permissions: [] });
});

test("adjustStanding clamps at both ends of the scale", () => {
  const high = adjustStanding(
    [{ factionId: "ashfall_camp", standing: 95, rank: "allied", permissions: [] }],
    "ashfall_camp", 20,
  );
  assert.equal(high[0].standing, 100);
  const low = adjustStanding(
    [{ factionId: "ashfall_camp", standing: -95, rank: "hostile", permissions: [] }],
    "ashfall_camp", -20,
  );
  assert.equal(low[0].standing, -100);
  const created = adjustStanding([], "earth_command", -500);
  assert.equal(created[0].standing, -100);
  assert.equal(created[0].rank, "hostile");
});

// ─── Lookups & defaults ──────────────────────────────────────────────────────

test("standingFor/rankFor treat a missing ledger row as 0 / neutral", () => {
  assert.equal(standingFor([], "ashfall_camp"), 0);
  assert.equal(rankFor([], "ashfall_camp"), "neutral");
});

test("defaultFactionStandings: every known faction at 0 / neutral", () => {
  const defaults = defaultFactionStandings();
  assert.equal(defaults.length, FACTIONS.length);
  assert.deepEqual(defaults.map((f) => f.factionId), ["earth_command", "ashfall_camp", "free_traders"]);
  for (const f of defaults) {
    assert.equal(f.standing, 0);
    assert.equal(f.rank, "neutral");
    assert.deepEqual(f.permissions, []);
  }
});

test("primaryFactionForPlanet: ashfall → ashfall_camp; unmapped planets → free_traders", () => {
  assert.equal(primaryFactionForPlanet("ashfall"), "ashfall_camp");
  assert.equal(primaryFactionForPlanet("verdania"), "free_traders");
});

test("colonyMerchantRank resolves the colony's planet faction; unknown colony → neutral", () => {
  const colony = makeTestColony();
  const colonies = [{ id: colony.id, planetId: colony.planetId }];
  const standings: FactionStanding[] = [
    { factionId: "ashfall_camp", standing: 85, rank: "allied", permissions: [] },
  ];
  assert.equal(colonyMerchantRank(colonies, standings, colony.id), "allied");
  assert.equal(colonyMerchantRank(colonies, standings, "no-such-colony"), "neutral");
  assert.equal(colonyMerchantRank(colonies, standings, undefined), "neutral");
});

// ─── Save migration ──────────────────────────────────────────────────────────

test("migrateSave: a save missing factionStandings gets all factions at neutral", () => {
  const migrated = migrateSave({});
  assert.deepEqual(migrated.factionStandings, defaultFactionStandings());
});

test("migrateSave preserves an existing standings array untouched", () => {
  const existing: FactionStanding[] = [
    { factionId: "ashfall_camp", standing: 64, rank: "liked", permissions: [] },
  ];
  const migrated = migrateSave({ factionStandings: existing });
  assert.deepEqual(migrated.factionStandings, existing);
});

test("loadSave (no window): the fresh default save carries default standings", () => {
  assert.deepEqual(loadSave().factionStandings, defaultFactionStandings());
});

// ─── Display price === charged price ─────────────────────────────────────────

test("quartermaster display cost equals the charged amount at every trading rank", () => {
  const colony = makeTestColony({ tier: 4 });
  // Tier-4 stock needs the verdania/glaciem/ossuary unlocks + 4 completed planets.
  const raw = { credits: 100_000, completedPlanets: ["verdania", "glaciem", "ossuary", "ashfall"] };
  for (const rank of ["allied", "liked", "neutral"] as const) {
    const items = buildQuartermasterShop(colony, rank);
    assert.equal(items.length, 4, "tier-4 colony stocks the full shelf");
    for (const item of items) {
      const save = migrateSave(raw);
      const next = applyShopPurchase(save, { kind: "consumable", itemId: item.itemId as ConsumableId }, rank);
      assert.ok(next, `purchase of ${item.itemId} at ${rank} should succeed`);
      assert.equal(
        save.credits - next!.credits,
        item.cost,
        `charged amount must equal the displayed cost for ${item.itemId} at ${rank}`,
      );
    }
  }
});

// ─── Organic standing source: planet mission completion ──────────────────────

test("completePlanet on ashfall grants ashfall_camp +8, and stacks on repeat completion", () => {
  let save = migrateSave({});
  save = completePlanet(save, "ashfall" as PlanetId);
  assert.equal(standingFor(save.factionStandings, "ashfall_camp"), 8);
  save = completePlanet(save, "ashfall" as PlanetId);
  assert.equal(standingFor(save.factionStandings, "ashfall_camp"), 16);
  assert.equal(rankFor(save.factionStandings, "ashfall_camp"), "neutral");
});

test("completePlanet on a planet with no native faction leaves standings unchanged", () => {
  const save = migrateSave({});
  const next = completePlanet(save, "verdania" as PlanetId);
  assert.deepEqual(next.factionStandings, save.factionStandings);
});

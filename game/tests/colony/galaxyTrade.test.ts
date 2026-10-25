import { test } from "node:test";
import assert from "node:assert/strict";
import { quoteGalaxyTrade, commitGalaxyTradeToStore, galaxyQuartermasterView } from "../../app/components/engine/galaxy/galaxyTrade";
import { commitGalaxySalvageToStore, quoteGalaxySalvage } from "../../app/components/engine/galaxy/galaxySalvage";
import { galaxyAtAshfall, galaxyWithLegacyProgression } from "../browser/fixtures/routeFixtures";
import { migrateSave } from "../../app/components/engine/save";
import { applyShopPurchase } from "../../app/components/engine/consumables";
import { primaryFactionForPlanet } from "../../app/components/colony/shared/factionLedger";
import type { SaveData } from "../../app/components/engine/types";
const COLONY = "galaxy:ashfall-primary";
function ok<T extends { ok: boolean }>(value: T): Extract<T, { ok: true }> {
  assert.equal(value.ok, true, JSON.stringify(value)); return value as Extract<T, { ok: true }>;
}
function colony(save: SaveData) { return save.galaxyRun!.colonies.find(c => c.id === COLONY)!; }
function arrived() { return galaxyWithLegacyProgression(structuredClone(galaxyAtAshfall)); }
function storeFor(save: SaveData) {
  let value = structuredClone(save), writes = 0;
  return { read: () => structuredClone(value), write: (next: SaveData) => { value = structuredClone(next); writes++; }, count: () => writes };
}
function worked() {
  const save = arrived();
  return ok(commitGalaxySalvageToStore(storeFor(save), ok(quoteGalaxySalvage(save, COLONY)).quote)).save;
}
function key(save: SaveData) { return ok(quoteGalaxyTrade(save, COLONY)).key; }

test("earned salvage trades only colony metal for ship supply; all other state survives reload", () => {
  const save = worked(), before = structuredClone(save), store = storeFor(save);
  const result = ok(commitGalaxyTradeToStore(store, COLONY, key(save)));
  const expected = structuredClone(save);
  colony(expected).resources.metal -= 20;
  expected.galaxyRun!.resources.supply++;
  expected.saveRevision++;
  assert.deepEqual(result.save, expected);
  assert.deepEqual(migrateSave(JSON.parse(JSON.stringify(result.save))), expected);
  assert.deepEqual(save, before);
  assert.equal(store.count(), 1);
  assert.equal(applyShopPurchase(save, { kind: "galaxy-trade", quoteKey: key(save) }), null, "Legacy cannot execute Galaxy trade");
});

test("one quote applies once; a fresh intent can trade again without an artificial supply cap", () => {
  const save = worked(); save.galaxyRun!.resources.supply = 30;
  const store = storeFor(save), intent = key(save);
  ok(commitGalaxyTradeToStore(store, COLONY, intent));
  assert.equal(commitGalaxyTradeToStore(store, COLONY, intent).ok, false);
  ok(commitGalaxyTradeToStore(store, COLONY, key(store.read())));
  assert.equal(colony(store.read()).resources.metal, 0);
  assert.equal(store.read().galaxyRun!.resources.supply, 32);
  assert.equal(store.count(), 2);
  assert.equal(commitGalaxyTradeToStore(store, COLONY, key(store.read())).ok, false);
  assert.equal(store.count(), 2);
});

test("insufficient colony metal cannot spend Legacy or ship credits and clearly explains recovery", () => {
  const save = arrived(), store = storeFor(save);
  const result = commitGalaxyTradeToStore(store, COLONY, key(save));
  assert.equal(result.ok, false); assert.match(result.message, /WORK SALVAGE/);
  assert.equal(store.count(), 0); assert.deepEqual(store.read(), save);
  const view = galaxyQuartermasterView(save, COLONY);
  assert.equal(view.items.length, 1); assert.equal(view.items[0].costLabel, "20 METAL");
  assert.match(view.balance, /COLONY METAL 0/);
});

test("stale metal, supply, cycle, revision, faction and run quotes never overwrite newer state", () => {
  const save = worked(), intent = key(save);
  for (const change of [(s: SaveData) => { colony(s).resources.metal++; },
    (s: SaveData) => { s.galaxyRun!.resources.supply++; },
    (s: SaveData) => { s.galaxyRun!.worldCycle++; },
    (s: SaveData) => { s.saveRevision++; },
    (s: SaveData) => { s.galaxyRun!.identity.galaxySeed = "new-run"; },
    (s: SaveData) => { s.galaxyRun!.factionStandings = [{ factionId: primaryFactionForPlanet(colony(s).planetId), standing: 40, rank: "liked", permissions: [] }]; }]) {
    const newer = structuredClone(save); change(newer); const store = storeFor(newer);
    assert.equal(commitGalaxyTradeToStore(store, COLONY, intent).ok, false);
    assert.equal(store.count(), 0); assert.deepEqual(store.read(), newer);
  }
});

test("unrelated new canonical work is preserved when applying a current quote", () => {
  const save = worked(), intent = key(save), newer = structuredClone(save);
  newer.credits += 123; // Legacy is not the trade treasury.
  const result = ok(commitGalaxyTradeToStore(storeFor(newer), COLONY, intent));
  assert.equal(result.save.credits, newer.credits);
});

test("unparked, unowned, hostile and unresolved saves cannot trade", () => {
  const save = worked(), intent = key(save);
  for (const change of [(s: SaveData) => { s.activeExperience = "legacy"; },
    (s: SaveData) => { s.galaxyRun!.vessel.contactId = "contact:vanguard"; },
    (s: SaveData) => { s.galaxyRun!.colonies = []; },
    (s: SaveData) => { s.galaxyRun!.operations["op:ashfall-sortie"].state = "active"; },
    (s: SaveData) => { s.outcomeRecoveryRecords = [{ version: 2, kind: "reconciliation_required", reason: "prepared_outcome_invalid", protectedOutcomeIds: [], quarantinedOutcomeCount: 1 }]; },
    (s: SaveData) => { s.galaxyRun!.factionStandings = [{ factionId: primaryFactionForPlanet(colony(s).planetId), standing: -80, rank: "hostile", permissions: [] }]; }]) {
    const changed = structuredClone(save); change(changed); const store = storeFor(changed);
    assert.equal(commitGalaxyTradeToStore(store, COLONY, intent).ok, false);
    assert.equal(store.count(), 0);
  }
});

test("tampered quotes, unreadable saves and failed writes cannot claim a trade", () => {
  const save = worked(), before = structuredClone(save), intent = key(save);
  for (const bad of [null, {}, intent + "tampered", "x".repeat(5000)]) {
    const store = storeFor(save); assert.equal(commitGalaxyTradeToStore(store, COLONY, bad).ok, false); assert.equal(store.count(), 0);
  }
  const unreadable = commitGalaxyTradeToStore({ read: () => { throw Error("read"); }, write: () => assert.fail() }, COLONY, intent);
  assert.equal(unreadable.ok, false); assert.match(unreadable.message, /COULD NOT BE READ/);
  const failed = commitGalaxyTradeToStore({ read: () => save, write: () => { throw Error("quota"); } }, COLONY, intent);
  assert.equal(failed.ok, false); if (!failed.ok) assert.equal(failed.reconcile, null);
  assert.deepEqual(save, before);
});

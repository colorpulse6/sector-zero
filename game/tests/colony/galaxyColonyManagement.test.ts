import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GALAXY_COMMISSION_TYPES,
  commitGalaxyColonyCommission,
  commitGalaxyColonyCommissionToStore,
  isExactCommissionChange,
  galaxyColonyManagementAccess,
  quoteGalaxyColonyCommission,
} from "../../app/components/engine/galaxy/galaxyColonyManagement";
import { advanceGalaxyWorldCycles, projectGalaxyRunToLegacyState } from "../../app/components/engine/galaxy/galaxyProjection";
import { createFreshGalaxyRun, startFreshGalaxy } from "../../app/components/engine/galaxy/galaxyRun";
import type { GalaxyRunState } from "../../app/components/engine/galaxy/galaxyTypes";
import { planRoute } from "../../app/components/engine/galaxy/routePlanner";
import { commitTravel, finalizeTravel, resumeTravelToBoundary } from "../../app/components/engine/galaxy/travelResolver";
import { migrateSave } from "../../app/components/engine/save";
import type { SaveData } from "../../app/components/engine/types";

const COLONY = "galaxy:ashfall-primary";

function ok<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  assert.equal(result.ok, true, JSON.stringify(result));
  return result as Extract<T, { ok: true }>;
}

function atAshfall(): GalaxyRunState {
  const fresh = createFreshGalaxyRun();
  const preview = planRoute(fresh, { kind: "contact", contactId: "contact:ashfall" });
  if (!preview.ok) throw new Error(preview.reasons.join("; "));
  const committed = ok(commitTravel(fresh, preview.plan)).galaxyRun;
  const arrived = ok(resumeTravelToBoundary(committed)).galaxyRun;
  return ok(finalizeTravel(arrived)).galaxyRun;
}

function withMetal(run: GalaxyRunState, metal: number): GalaxyRunState {
  return {
    ...run,
    colonies: run.colonies.map(colony => colony.id === COLONY
      ? { ...colony, resources: { ...colony.resources, metal } }
      : colony),
  };
}

function parentFor(run: GalaxyRunState): SaveData {
  const legacy = startFreshGalaxy(migrateSave({
    currentWorld: 7, credits: 9876, completedQuests: ["legacy-quest"], completedPlanets: ["pyraxis"],
  }));
  return { ...legacy, galaxyRun: run };
}

test("management access follows the descent rule with MANAGE wording", () => {
  const fresh = createFreshGalaxyRun();
  assert.deepEqual(galaxyColonyManagementAccess(fresh, COLONY), { status: "unavailable", reason: "ARRIVE AT ASHFALL FIRST" });
  assert.deepEqual(galaxyColonyManagementAccess(atAshfall(), COLONY), { status: "full", colonyId: COLONY, contactId: "contact:ashfall" });
  assert.deepEqual(galaxyColonyManagementAccess(atAshfall(), "outpost:ashfall-basalt-basin"), { status: "unavailable", reason: "NO COLONY HERE" });
  const moving = { ...atAshfall(), vessel: { ...atAshfall().vessel, contactId: "contact:vanguard" } };
  assert.deepEqual(galaxyColonyManagementAccess(moving, COLONY), { status: "unavailable", reason: "PARK AT ASHFALL TO MANAGE" });
});

test("GC2-A supports exactly one building type", () => {
  assert.deepEqual([...GALAXY_COMMISSION_TYPES], ["solar_array"]);
});

test("a quote takes cost, build time and id from the catalogue and the canonical colony", () => {
  const quote = ok(quoteGalaxyColonyCommission(parentFor(withMetal(atAshfall(), 80)), COLONY, "solar_array")).quote;
  assert.deepEqual(quote, {
    colonyId: COLONY,
    buildingType: "solar_array",
    buildingId: `b-${COLONY}-0-solar_array`,
    cost: { metal: 80 },
    cyclesToBuild: 1,
    worldCycle: quote.worldCycle,
    buildingCount: 0,
    resources: { food: 0, water: 0, metal: 80, credits: 0 },
  });
  assert.equal(quote.worldCycle, atAshfall().worldCycle);
});

test("quotes refuse with a reason", () => {
  const away = parentFor(createFreshGalaxyRun());
  assert.equal(quoteGalaxyColonyCommission(away, COLONY, "solar_array").ok, false);
  const poor = quoteGalaxyColonyCommission(parentFor(withMetal(atAshfall(), 79)), COLONY, "solar_array");
  assert.deepEqual(poor, { ok: false, reason: "insufficient_resources", message: "NOT ENOUGH RESOURCES" });
  const mine = quoteGalaxyColonyCommission(parentFor(withMetal(atAshfall(), 500)), COLONY, "mine");
  assert.deepEqual(mine, { ok: false, reason: "unsupported_building", message: "NOT AVAILABLE IN THIS RUN YET" });
  const legacy = { ...parentFor(atAshfall()), activeExperience: "legacy" as const };
  assert.equal(quoteGalaxyColonyCommission(legacy, COLONY, "solar_array").ok, false);
});

function legacyBytes(save: SaveData): string {
  const { galaxyRun: _run, ...legacy } = save;
  return JSON.stringify(legacy);
}

function commissioned(): { before: SaveData; after: SaveData } {
  const before = parentFor(withMetal(atAshfall(), 80));
  const quote = ok(quoteGalaxyColonyCommission(before, COLONY, "solar_array")).quote;
  return { before, after: ok(commitGalaxyColonyCommission(before, quote)).save };
}

test("commit appends one constructing building, spends the cost and changes nothing else", () => {
  const { before, after } = commissioned();
  const colony = after.galaxyRun!.colonies.find(entry => entry.id === COLONY)!;
  assert.equal(colony.resources.metal, 0);
  assert.deepEqual(colony.buildings, [{
    id: `b-${COLONY}-0-solar_array`, type: "solar_array", tier: 1, status: "constructing",
    buildProgressCycles: 1, hp: 100, maxHp: 100, interiorTemplateId: null, assignedNpcIds: [], districtId: null,
  }]);
  assert.equal(legacyBytes(after), legacyBytes(before));
  const { colonies: _a, ...runAfter } = after.galaxyRun!;
  const { colonies: _b, ...runBefore } = before.galaxyRun!;
  assert.deepEqual(runAfter, runBefore, "no other galaxy field changes; worldCycle is unchanged (time-neutral)");
});

test("a second commit of the same quote is refused", () => {
  const before = parentFor(withMetal(atAshfall(), 160));
  const quote = ok(quoteGalaxyColonyCommission(before, COLONY, "solar_array")).quote;
  const first = ok(commitGalaxyColonyCommission(before, quote)).save;
  const second = commitGalaxyColonyCommission(first, quote);
  assert.deepEqual(second, { ok: false, reason: "stale_command", message: "COLONY CHANGED · REVIEW AND TRY AGAIN" });
});

test("a quote made before a cycle advance is stale", () => {
  const run = withMetal(atAshfall(), 80);
  const quote = ok(quoteGalaxyColonyCommission(parentFor(run), COLONY, "solar_array")).quote;
  const advanced = advanceGalaxyWorldCycles(run, 1);
  assert.equal(advanced.ok, true);
  if (!advanced.ok) return;
  const result = commitGalaxyColonyCommission(parentFor(advanced.galaxyRun), quote);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "stale_command");
});

test("forged or malformed quotes are refused", () => {
  const before = parentFor(withMetal(atAshfall(), 80));
  const quote = ok(quoteGalaxyColonyCommission(before, COLONY, "solar_array")).quote;
  const cheap = commitGalaxyColonyCommission(before, { ...quote, cost: { metal: 1 } });
  assert.equal(cheap.ok, false);
  if (!cheap.ok) assert.equal(cheap.reason, "stale_command");
  const extra = commitGalaxyColonyCommission(before, { ...quote, bonus: 1 } as never);
  assert.deepEqual(extra, { ok: false, reason: "malformed_command", message: "COMMAND REJECTED" });
  const negative = commitGalaxyColonyCommission(before, { ...quote, cyclesToBuild: -1 });
  assert.equal(negative.ok, false);
  const mine = commitGalaxyColonyCommission(before, { ...quote, buildingType: "mine" });
  assert.equal(mine.ok, false);
  if (!mine.ok) assert.equal(mine.reason, "unsupported_building");
});

test("the exact-change check rejects any other difference", () => {
  const before = parentFor(withMetal(atAshfall(), 80));
  const quote = ok(quoteGalaxyColonyCommission(before, COLONY, "solar_array")).quote;
  const projection = projectGalaxyRunToLegacyState(before.galaxyRun!);
  const good = ok(commitGalaxyColonyCommission(before, quote)).save.galaxyRun!.colonies;
  assert.equal(isExactCommissionChange(projection.colonies, good, quote), true);
  const happier = good.map(colony => ({ ...colony, happiness: colony.happiness + 1 }));
  assert.equal(isExactCommissionChange(projection.colonies, happier, quote), false);
  const richer = good.map(colony => ({ ...colony, resources: { ...colony.resources, food: 5 } }));
  assert.equal(isExactCommissionChange(projection.colonies, richer, quote), false);
  const finished = good.map(colony => ({
    ...colony, buildings: colony.buildings.map(b => ({ ...b, status: "operational" as const, buildProgressCycles: 0 })),
  }));
  assert.equal(isExactCommissionChange(projection.colonies, finished, quote), false);
});

test("the next cycle finishes the Solar Array, and a JSON reload keeps it", () => {
  const { after } = commissioned();
  const advanced = advanceGalaxyWorldCycles(after.galaxyRun!, 1);
  assert.equal(advanced.ok, true);
  if (!advanced.ok) return;
  const reloaded = migrateSave(JSON.parse(JSON.stringify({ ...after, galaxyRun: advanced.galaxyRun })));
  const colony = reloaded.galaxyRun!.colonies.find(entry => entry.id === COLONY)!;
  assert.deepEqual(colony.buildings.map(b => [b.type, b.status, b.buildProgressCycles]), [["solar_array", "operational", 0]]);
});

function memoryStore(initial: SaveData, fail: { read?: boolean; write?: boolean } = {}) {
  let stored = structuredClone(initial);
  const writes: SaveData[] = [];
  return {
    writes,
    stored: () => stored,
    store: {
      read: () => { if (fail.read) throw new SyntaxError("Unexpected token"); return structuredClone(stored); },
      write: (next: SaveData) => { if (fail.write) throw new Error("QuotaExceededError"); writes.push(next); stored = structuredClone(next); },
    },
  };
}

function screenQuote(metal: number) {
  const screen = parentFor(withMetal(atAshfall(), metal));
  return { screen, quote: ok(quoteGalaxyColonyCommission(screen, COLONY, "solar_array")).quote };
}

test("store commit uses the newer stored save and keeps its unrelated fields", () => {
  const { screen, quote } = screenQuote(80);
  const newer: SaveData = { ...screen, credits: 1234,
    galaxyRun: { ...screen.galaxyRun!, resources: { ...screen.galaxyRun!.resources, credits: 50 } } };
  const memory = memoryStore(newer);
  assert.equal(commitGalaxyColonyCommissionToStore(memory.store, quote).ok, true);
  assert.equal(memory.writes.length, 1);
  assert.equal(memory.stored().credits, 1234);
  assert.equal(legacyBytes(memory.stored()), legacyBytes(newer), "no Legacy field moves");
  assert.equal(memory.stored().galaxyRun!.resources.credits, 50);
  assert.equal(memory.stored().galaxyRun!.colonies.find(c => c.id === COLONY)!.buildings.length, 1);
});

test("store commit refuses a stale quote, writes nothing and returns the stored save", () => {
  const { screen, quote } = screenQuote(160);
  const elsewhere = ok(commitGalaxyColonyCommission(screen, quote)).save; // another tab built first
  const memory = memoryStore(elsewhere);
  const result = commitGalaxyColonyCommissionToStore(memory.store, quote);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "stale_command");
  assert.deepEqual(result.reconcile, elsewhere);
  assert.equal(memory.writes.length, 0);
});

test("store commit blocks unreadable storage and a save without a galaxy run", () => {
  const { screen, quote } = screenQuote(80);
  const unreadable = memoryStore(screen, { read: true });
  assert.deepEqual(commitGalaxyColonyCommissionToStore(unreadable.store, quote),
    { ok: false, reason: "storage_unreadable", message: "SAVE COULD NOT BE READ · NOTHING CHANGED", reconcile: null });
  const defaulted = memoryStore(migrateSave({})); // what a missing save key reads as
  const refused = commitGalaxyColonyCommissionToStore(defaulted.store, quote);
  assert.equal(refused.ok, false);
  if (!refused.ok) { assert.equal(refused.reason, "no_galaxy_run"); assert.equal(refused.reconcile, null); }
  assert.equal(unreadable.writes.length + defaulted.writes.length, 0);
});

test("a failed write changes nothing and offers nothing to adopt", () => {
  const { screen, quote } = screenQuote(80);
  const failing = memoryStore(screen, { write: true });
  assert.deepEqual(commitGalaxyColonyCommissionToStore(failing.store, quote),
    { ok: false, reason: "write_failed", message: "MANAGEMENT SAVE FAILED · NOTHING CHANGED", reconcile: null });
  assert.deepEqual(failing.stored(), screen);
});

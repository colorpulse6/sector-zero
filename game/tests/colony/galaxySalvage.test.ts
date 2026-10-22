import { test } from "node:test";
import assert from "node:assert/strict";
import { quoteGalaxySalvage, commitGalaxySalvageToStore } from "../../app/components/engine/galaxy/galaxySalvage";
import { commitGalaxyColonyCommission, quoteGalaxyColonyCommission } from "../../app/components/engine/galaxy/galaxyColonyManagement";
import { advanceGalaxyWorldCycles } from "../../app/components/engine/galaxy/galaxyProjection";
import { createFreshGalaxyRun, startFreshGalaxy } from "../../app/components/engine/galaxy/galaxyRun";
import { planRoute } from "../../app/components/engine/galaxy/routePlanner";
import { commitTravel, finalizeTravel, resumeTravelToBoundary } from "../../app/components/engine/galaxy/travelResolver";
import { migrateSave } from "../../app/components/engine/save";
import type { SaveData } from "../../app/components/engine/types";
import type { BuildingType } from "../../app/components/colony/shared/colonyTypes";
import { authorizeOperationLaunch } from "../../app/components/engine/operations/operationCatalog";
import { normalizeOperationOutcome, applyOperationOutcome } from "../../app/components/engine/operations/operationOutcome";

const COLONY = "galaxy:ashfall-primary";
function ok<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  assert.equal(result.ok, true, JSON.stringify(result));
  return result as Extract<T, { ok: true }>;
}
function arrived(): SaveData {
  const fresh = createFreshGalaxyRun();
  const route = planRoute(fresh, { kind: "contact", contactId: "contact:ashfall" });
  assert.ok(route.ok);
  const committed = ok(commitTravel(fresh, route.plan)).galaxyRun;
  const run = ok(finalizeTravel(ok(resumeTravelToBoundary(committed)).galaxyRun)).galaxyRun;
  run.resources.supply = 0;
  return { ...startFreshGalaxy(migrateSave({ credits: 2345, completedPlanets: ["pyraxis"] })), galaxyRun: run };
}
function colony(save: SaveData) { return save.galaxyRun!.colonies.find(c => c.id === COLONY)!; }
function storeFor(save: SaveData) {
  let stored = structuredClone(save); let writes = 0;
  return { read: () => structuredClone(stored), write: (next: SaveData) => { stored = structuredClone(next); writes++; }, count: () => writes };
}
function shift(save: SaveData): SaveData {
  return ok(commitGalaxySalvageToStore(storeFor(save), ok(quoteGalaxySalvage(save, COLONY)).quote)).save;
}
function legacy(save: SaveData) { const { galaxyRun: _, ...rest } = save; return rest; }

test("empty colony and empty fuel reserve can earn metal and supply with exactly one normal cycle", () => {
  const save = arrived(); const before = structuredClone(save);
  const cycle = ok(advanceGalaxyWorldCycles(save, 1)).save;
  const next = shift(save);
  assert.equal(next.galaxyRun!.worldCycle, save.galaxyRun!.worldCycle + 1);
  assert.equal(colony(next).resources.metal, colony(cycle).resources.metal + 40);
  assert.equal(next.galaxyRun!.resources.supply, 1);
  assert.deepEqual(legacy(next), legacy(save));
  assert.deepEqual(next.galaxyRun!.operations, save.galaxyRun!.operations);
  assert.deepEqual(save, before, "input is not mutated");
  assert.deepEqual(migrateSave(JSON.parse(JSON.stringify(next))), next, "canonical save survives reload");
});

test("a repeated quote awards once, and a new deliberate shift awards again", () => {
  const save = arrived(); const store = storeFor(save);
  const quote = ok(quoteGalaxySalvage(save, COLONY)).quote;
  ok(commitGalaxySalvageToStore(store, quote));
  const duplicate = commitGalaxySalvageToStore(store, quote);
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) assert.equal(duplicate.reason, "stale_command");
  assert.equal(store.count(), 1);
  ok(commitGalaxySalvageToStore(store, ok(quoteGalaxySalvage(store.read(), COLONY)).quote));
  assert.equal(colony(store.read()).resources.metal, 80);
  assert.equal(store.read().galaxyRun!.resources.supply, 2);
});

test("a stale colony/supply quote reconciles without overwriting another writer", () => {
  const save = arrived(); const quote = ok(quoteGalaxySalvage(save, COLONY)).quote;
  for (const change of [(s: SaveData) => { colony(s).resources.metal = 70; },
    (s: SaveData) => { s.galaxyRun!.resources.supply = 4; },
    (s: SaveData) => { s.galaxyRun!.identity.galaxySeed = "new-run"; }]) {
    const newer = structuredClone(save); change(newer); const store = storeFor(newer);
    const result = commitGalaxySalvageToStore(store, quote);
    assert.equal(result.ok, false);
    assert.equal(store.count(), 0);
    assert.deepEqual(store.read(), newer);
  }
});

test("malformed or tampered requests cannot choose the reward", () => {
  const save = arrived(); const quote = ok(quoteGalaxySalvage(save, COLONY)).quote;
  for (const bad of [null, {}, { ...quote, metal: 99999 }, { ...quote, worldCycle: -1 },
    { ...quote, colonyId: "outpost:elsewhere" }]) {
    const store = storeFor(save);
    assert.equal(commitGalaxySalvageToStore(store, bad as typeof quote).ok, false);
    assert.equal(store.count(), 0);
  }
});

test("unreadable and unwritable stores do not report success or mutate the shown state", () => {
  const save = arrived(); const before = structuredClone(save); const quote = ok(quoteGalaxySalvage(save, COLONY)).quote;
  const unreadable = commitGalaxySalvageToStore({ read: () => { throw new Error("read"); }, write: () => { assert.fail(); } }, quote);
  assert.equal(unreadable.ok, false);
  if (!unreadable.ok) assert.equal(unreadable.reason, "storage_unreadable");
  const unwritable = commitGalaxySalvageToStore({ read: () => save, write: () => { throw new Error("quota"); } }, quote);
  assert.equal(unwritable.ok, false);
  if (!unwritable.ok) { assert.equal(unwritable.reason, "write_failed"); assert.equal(unwritable.reconcile, null); }
  assert.deepEqual(save, before);
});

test("work requires parked Ashfall access and no unresolved operation", () => {
  const save = arrived();
  assert.equal(quoteGalaxySalvage({ ...save, activeExperience: "legacy" }, COLONY).ok, false);
  assert.equal(quoteGalaxySalvage({ ...save, galaxyRun: createFreshGalaxyRun() }, COLONY).ok, false);
  assert.equal(quoteGalaxySalvage(save, "elsewhere").ok, false);
  const active = structuredClone(save);
  active.galaxyRun!.operations["op:ashfall-sortie"].state = "active";
  assert.equal(quoteGalaxySalvage(active, COLONY).ok, false);
  active.galaxyRun!.operations["op:ashfall-sortie"].state = "failed";
  assert.equal(quoteGalaxySalvage(active, COLONY).ok, true, "failed sorties do not block recovery");
  const pending = structuredClone(save);
  pending.outcomeRecoveryRecords = [{ version: 2, kind: "reconciliation_required", reason: "prepared_outcome_invalid", protectedOutcomeIds: [], quarantinedOutcomeCount: 1 }];
  assert.equal(quoteGalaxySalvage(pending, COLONY).ok, false);
});

test("zero stock reaches ten settlers within twenty-five shifts with no mission reward fixture", () => {
  let save = arrived(); const before = legacy(save);
  const queue: BuildingType[] = ["solar_array", "mine", "habitat_module", "farm", "water_purifier"];
  let shifts = 0;
  while (shifts < 25 && colony(save).population.total < 10) {
    while (queue.length) {
      const quoted = quoteGalaxyColonyCommission(save, COLONY, queue[0]);
      if (!quoted.ok) break;
      save = ok(commitGalaxyColonyCommission(save, quoted.quote)).save; queue.shift();
    }
    save = shift(save); shifts++;
  }
  assert.deepEqual(queue, []);
  assert.equal(colony(save).population.total, 10, `after ${shifts} shifts`);
  assert.ok(colony(save).buildings.every(b => b.status === "operational"));
  assert.deepEqual(legacy(save), before);
  assert.equal(planRoute(save.galaxyRun!, { kind: "contact", contactId: "contact:vanguard" }).ok, true, "earned supply enables departure");
});

test("a real failed-sortie outcome leaves a recoverable colony and preserves the failure history", () => {
  const save = arrived();
  const authorization = ok(authorizeOperationLaunch(save.galaxyRun!, "op:ashfall-sortie"));
  const normalized = ok(normalizeOperationOutcome(save.galaxyRun!, authorization.context,
    { completionId: "test:failed-before-mine", result: "failure", metrics: null }));
  let failed = ok(applyOperationOutcome(save, normalized.outcome)).save;
  assert.equal(failed.galaxyRun!.operations["op:ashfall-sortie"].state, "failed");
  const history = structuredClone(failed.galaxyRun!.historyFacts);
  const operations = structuredClone(failed.galaxyRun!.operations);
  assert.equal(colony(failed).resources.metal, 0);
  for (let n = 0; n < 6; n++) failed = shift(failed);
  failed = ok(commitGalaxyColonyCommission(failed, ok(quoteGalaxyColonyCommission(failed, COLONY, "solar_array")).quote)).save;
  failed = ok(commitGalaxyColonyCommission(failed, ok(quoteGalaxyColonyCommission(failed, COLONY, "mine")).quote)).save;
  failed = shift(shift(failed));
  assert.equal(colony(failed).buildings.find(b => b.type === "mine")!.status, "operational");
  assert.deepEqual(failed.galaxyRun!.historyFacts, history);
  assert.deepEqual(failed.galaxyRun!.operations, operations);
});

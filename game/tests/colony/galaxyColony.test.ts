import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyGalaxyColonyPurchase,
  galaxyColonyAccess,
  galaxyColonyAtContact,
  galaxyColonyContactId,
  mergeGalaxyColonyVisit,
  openGalaxyColony,
} from "../../app/components/engine/galaxy/galaxyColony";
import { createFreshGalaxyRun, startFreshGalaxy } from "../../app/components/engine/galaxy/galaxyRun";
import type { GalaxyRunState } from "../../app/components/engine/galaxy/galaxyTypes";
import { planRoute } from "../../app/components/engine/galaxy/routePlanner";
import {
  commitTravel,
  finalizeTravel,
  resumeTravelToBoundary,
} from "../../app/components/engine/galaxy/travelResolver";
import {
  commitOutcome,
  createGameStateOutcomeEnvelope,
  resolveOutcomeReturnMount,
  type CanonicalSaveStore,
} from "../../app/components/engine/missionOutcome";
import { migrateSave } from "../../app/components/engine/save";
import type { GameState, SaveData } from "../../app/components/engine/types";

const COLONY = "galaxy:ashfall-primary";

function requireTravel<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  assert.equal(result.ok, true, "errors" in result ? JSON.stringify(result.errors) : undefined);
  if (!result.ok) throw new Error("travel transition failed");
  return result as Extract<T, { ok: true }>;
}

function travelTo(run: GalaxyRunState, contactId: string): GalaxyRunState {
  const preview = planRoute(run, { kind: "contact", contactId });
  assert.equal(preview.ok, true, preview.ok ? undefined : preview.reasons.join("; "));
  if (!preview.ok) throw new Error("route preview failed");
  return requireTravel(commitTravel(run, preview.plan)).galaxyRun;
}

function atAshfall(): GalaxyRunState {
  const committed = travelTo(createFreshGalaxyRun(), "contact:ashfall");
  const arrived = requireTravel(resumeTravelToBoundary(committed));
  return requireTravel(finalizeTravel(arrived.galaxyRun)).galaxyRun;
}

function parentFor(run: GalaxyRunState = atAshfall(), credits = 120): SaveData {
  const legacy = startFreshGalaxy(migrateSave({
    currentWorld: 7,
    credits: 9876,
    completedQuests: ["legacy-quest"],
    completedPlanets: ["pyraxis"],
  }));
  return { ...legacy, galaxyRun: { ...run, resources: { ...run.resources, credits } } };
}

function legacySnapshot(save: SaveData): Omit<SaveData, "galaxyRun"> {
  const { galaxyRun: _galaxyRun, ...legacy } = structuredClone(save);
  return legacy;
}

function requireOpen(save: SaveData) {
  const opened = openGalaxyColony(save, COLONY);
  assert.equal(opened.ok, true, opened.ok ? undefined : opened.reason);
  if (!opened.ok) throw new Error("galaxy colony did not open");
  return opened;
}

test("colony access needs a visited contact and a vessel parked there", () => {
  assert.deepEqual(galaxyColonyAccess(null, COLONY), { status: "unavailable", reason: "SELECT A COLONY STAR" });
  const fresh = createFreshGalaxyRun();
  assert.deepEqual(galaxyColonyAccess(fresh, "galaxy:nowhere"), { status: "unavailable", reason: "NO COLONY HERE" });
  assert.deepEqual(galaxyColonyAccess(fresh, COLONY), { status: "unavailable", reason: "ARRIVE AT ASHFALL FIRST" });
  const parked = atAshfall();
  assert.deepEqual(galaxyColonyAccess(parked, COLONY), {
    status: "full",
    colonyId: COLONY,
    contactId: "contact:ashfall",
  });
  const leaving = travelTo(parked, "contact:vanguard");
  assert.notEqual(leaving.activeTravel, null);
  assert.deepEqual(galaxyColonyAccess(leaving, COLONY), {
    status: "unavailable",
    reason: "PARK AT ASHFALL TO DESCEND",
  });
});

test("colonies map to their atlas contact", () => {
  const run = createFreshGalaxyRun();
  assert.equal(galaxyColonyContactId(COLONY), "contact:ashfall");
  assert.equal(galaxyColonyContactId("toString"), null);
  assert.equal(galaxyColonyAtContact(run, "contact:ashfall"), COLONY);
  assert.equal(galaxyColonyAtContact(run, "contact:vanguard"), null);
  assert.equal(galaxyColonyAtContact(null, "contact:ashfall"), null);
});

test("opening a galaxy colony projects the run and leaves legacy fields alone", () => {
  const parent = parentFor();
  const before = structuredClone(parent);
  const opened = requireOpen(parent);
  assert.equal(opened.colony.id, COLONY);
  assert.equal(opened.projectedSave.credits, 120);
  assert.ok(opened.projectedSave.colonies.some(colony => colony.id === COLONY));
  assert.equal(opened.projectedSave.colonies.some(colony => colony.id.startsWith("legacy")), false);
  assert.equal(opened.projectedSave.galaxyRun, null);
  assert.deepEqual(parent, before);

  const legacyExperience = { ...parent, activeExperience: "legacy" as const };
  assert.deepEqual(openGalaxyColony(legacyExperience, COLONY), { ok: false, reason: "NO ACTIVE GALAXY RUN" });
  const notParked = parentFor(createFreshGalaxyRun());
  assert.deepEqual(openGalaxyColony(notParked, COLONY), { ok: false, reason: "ARRIVE AT ASHFALL FIRST" });
});

test("a cantina purchase spends galaxy credits only", () => {
  const parent = parentFor();
  const next = applyGalaxyColonyPurchase(parent, COLONY, { kind: "service", serviceId: "cantina-house-pour" });
  assert.ok(next);
  assert.equal(next.galaxyRun?.resources.credits, 115);
  assert.deepEqual(legacySnapshot(next), legacySnapshot(parent));
  const { resources: nextResources, ...nextRest } = next.galaxyRun!;
  const { resources: parentResources, ...parentRest } = parent.galaxyRun!;
  assert.deepEqual(nextRest, parentRest);
  assert.deepEqual({ ...nextResources, credits: 0 }, { ...parentResources, credits: 0 });
});

test("a refused purchase returns null", () => {
  const broke = parentFor(atAshfall(), 2);
  assert.equal(applyGalaxyColonyPurchase(broke, COLONY, { kind: "service", serviceId: "cantina-house-pour" }), null);
  // Consumables stay locked in a galaxy run until it records planet unlocks.
  assert.equal(applyGalaxyColonyPurchase(parentFor(atAshfall(), 5000), COLONY, {
    kind: "consumable",
    itemId: "weapon-overcharge",
  }), null);
  const notParked = parentFor(createFreshGalaxyRun(), 500);
  assert.equal(applyGalaxyColonyPurchase(notParked, COLONY, { kind: "service", serviceId: "cantina-house-pour" }), null);
});

test("a visit merge folds credits and consumable stock back", () => {
  const opened = requireOpen(parentFor());
  const projected = {
    ...opened.projectedSave,
    credits: 60,
    consumableInventory: { ...opened.projectedSave.consumableInventory, "cryo-charge": 1 },
  };
  const merged = mergeGalaxyColonyVisit(opened, projected);
  assert.equal(merged.ok, true);
  if (!merged.ok) return;
  assert.equal(merged.save.galaxyRun?.resources.credits, 60);
  assert.equal(merged.save.galaxyRun?.ship.consumableInventory["cryo-charge"], 1);
  assert.equal(merged.save.credits, 9876);
});

test("a visit merge rejects any other projected change", () => {
  const opened = requireOpen(parentFor());
  const changedXp = { ...opened.projectedSave, xp: opened.projectedSave.xp + 10 };
  assert.deepEqual(mergeGalaxyColonyVisit(opened, changedXp), { ok: false, reason: "unauthorized_change" });
  const changedColonies = { ...opened.projectedSave, colonies: [] };
  assert.deepEqual(mergeGalaxyColonyVisit(opened, changedColonies), { ok: false, reason: "unauthorized_change" });
  const extraField = { ...opened.projectedSave, smuggled: true } as unknown as SaveData;
  assert.deepEqual(mergeGalaxyColonyVisit(opened, extraField), { ok: false, reason: "unauthorized_change" });
  const negativeCredits = { ...opened.projectedSave, credits: -1 };
  assert.equal(mergeGalaxyColonyVisit(opened, negativeCredits).ok, false);
});

type GameModule = {
  createGalaxyColonyLaunchState: (
    save: SaveData,
    colonyId: string,
    provenance?: "atlas" | "continue",
  ) => { gameState: GameState; sceneStack: { colonyId: string; current: { kind: string } } };
};

async function shell(): Promise<GameModule> {
  return await import("../../app/components/Game") as unknown as GameModule;
}

test("descending launches a galaxy colony walk that takes off back to the Atlas", async () => {
  const game = await shell();
  const parent = parentFor();
  const launched = game.createGalaxyColonyLaunchState(parent, COLONY);
  const state = launched.gameState;
  assert.equal(state.currentMode, "colony-exploration");
  assert.equal(launched.sceneStack.colonyId, COLONY);
  assert.equal(launched.sceneStack.current.kind, "exterior");
  assert.equal(state.launchContext?.persistenceAuthority, "galaxy");
  assert.equal(state.launchContext?.entryProvenance, "atlas");
  assert.equal(state.outcomeAttempt?.routeKind, "colony");
  assert.equal(state.outcomeAttempt?.returnTarget, "galaxy-atlas");
  assert.deepEqual(state.outcomeAttempt?.declaredFields, []);

  let current = structuredClone(parent);
  const store: CanonicalSaveStore = {
    read: () => structuredClone(current),
    write: (save) => { current = structuredClone(save); },
  };
  const result = commitOutcome(store, createGameStateOutcomeEnvelope(state, "success"));
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  const receipt = result.save.outcomeRecoveryRecords.at(-1);
  assert.deepEqual(resolveOutcomeReturnMount(receipt), { surface: "galaxy-atlas" });
  // Taking off folds nothing: only the outcome journal and revision move.
  const journalFields = {
    saveRevision: parent.saveRevision,
    appliedOutcomeIds: parent.appliedOutcomeIds,
    outcomeRecoveryRecords: parent.outcomeRecoveryRecords,
  };
  assert.deepEqual(legacySnapshot({ ...result.save, ...journalFields }), legacySnapshot(parent));
  const { appliedOutcomeIds: nextIds, ...nextRun } = result.save.galaxyRun!;
  const { appliedOutcomeIds: parentIds, ...parentRun } = parent.galaxyRun!;
  assert.deepEqual(nextRun, parentRun);
  assert.equal(nextIds.length, parentIds.length + 1);
});

test("descending is refused unless the vessel is parked at the colony", async () => {
  const game = await shell();
  assert.throws(
    () => game.createGalaxyColonyLaunchState(parentFor(createFreshGalaxyRun()), COLONY),
    /ARRIVE AT ASHFALL FIRST/,
  );
  const continued = game.createGalaxyColonyLaunchState(parentFor(), COLONY, "continue");
  assert.equal(continued.gameState.launchContext?.entryProvenance, "continue");
});

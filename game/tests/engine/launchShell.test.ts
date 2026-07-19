import assert from "node:assert/strict";
import test from "node:test";

import { createHydrationSafeSave } from "../../app/components/engine/save";
import type { GameState, PlanetId, SaveData, SpecialMissionId } from "../../app/components/engine/types";
import type { LaunchContext } from "../../app/components/engine/missionContext";
import { applyColonyFixture, findFixture } from "../../app/components/colony/dev/seedColony";

type GameModule = {
  createCampaignLaunchState?: (
    save: SaveData,
    world: number,
    level: number,
    provenance?: "star-map" | "continue",
    returnTarget?: "legacy-star-map" | "legacy-cockpit",
  ) => GameState;
  createPlanetLaunchState?: (save: SaveData, planetId: PlanetId) => GameState;
  createSpecialLaunchState?: (
    save: SaveData,
    missionId: SpecialMissionId,
    provenance?: "cockpit" | "continue",
  ) => GameState;
  createColonyExteriorLaunchState?: (
    save: SaveData,
    colonyId: string,
    provenance?: "cockpit" | "continue",
  ) => { gameState: GameState; sceneStack: { colonyId: string; current: { kind: string } } };
  createRetryLaunchContext?: (state: GameState) => LaunchContext | undefined;
};

async function shell(): Promise<GameModule> {
  return await import("../../app/components/Game") as unknown as GameModule;
}

function nonDefaultSave(): SaveData {
  const save = createHydrationSafeSave();
  save.introSeen = true;
  save.upgrades = { ...save.upgrades, hullPlating: 2, engineBoost: 1, weaponCore: 3 };
  save.unlockedEnhancements = ["reinforced-shield"];
  save.pilotLevel = 8;
  save.allocatedSkills = ["sharpshooter", "overcharge"];
  save.equippedWeaponType = "energy";
  save.equippedConsumables = ["cryo-charge"];
  save.consumableInventory = { "cryo-charge": 2 };
  return save;
}

test("shell exposes context-owned campaign, planet, special, and Colony launchers", async () => {
  const game = await shell();
  assert.equal(typeof game.createCampaignLaunchState, "function");
  assert.equal(typeof game.createPlanetLaunchState, "function");
  assert.equal(typeof game.createSpecialLaunchState, "function");
  assert.equal(typeof game.createColonyExteriorLaunchState, "function");
  assert.equal(typeof game.createRetryLaunchContext, "function");
});

test("retry helper preserves owned mission/loadout/return and mints a retry attempt", async () => {
  const game = await shell();
  const original = game.createCampaignLaunchState!(nonDefaultSave(), 2, 1);

  const retried = game.createRetryLaunchContext!(original)!;

  assert.equal(retried.entryProvenance, "retry");
  assert.equal(retried.mission.id, original.launchContext?.mission.id);
  assert.deepEqual(retried.pilot, original.launchContext?.pilot);
  assert.equal(retried.persistenceAuthority, original.launchContext?.persistenceAuthority);
  assert.equal(retried.returnTarget, original.launchContext?.returnTarget);
  assert.notEqual(retried.launchId, original.launchContext?.launchId);
});

test("direct and continued campaign launchers own complete route context", async () => {
  const game = await shell();
  const save = nonDefaultSave();

  const direct = game.createCampaignLaunchState!(save, 1, 1);
  const continued = game.createCampaignLaunchState!(
    save,
    1,
    2,
    "continue",
    direct.launchContext!.returnTarget as "legacy-star-map",
  );

  assert.equal(direct.launchContext?.mission.id, "campaign:1-1");
  assert.equal(direct.launchContext?.entryProvenance, "star-map");
  assert.equal(direct.launchContext?.returnTarget, "legacy-star-map");
  assert.equal(direct.equippedWeaponType, "energy");
  assert.deepEqual(direct.pilotLoadout.equippedConsumables, ["cryo-charge"]);
  assert.equal(continued.launchContext?.mission.id, "campaign:1-2");
  assert.equal(continued.launchContext?.entryProvenance, "continue");
  assert.notEqual(continued.launchContext?.launchId, direct.launchContext?.launchId);
});

test("planet and first-clear Kepler launchers inherit canonical cockpit authority", async () => {
  const game = await shell();
  const save = nonDefaultSave();
  save.unlockedSpecialMissions = ["kepler-black-box"];

  const planet = game.createPlanetLaunchState!(save, "glaciem");
  const special = game.createSpecialLaunchState!(save, "kepler-black-box", "continue");

  assert.equal(planet.launchContext?.mission.id, "planet:glaciem");
  assert.equal(planet.launchContext?.entryProvenance, "cockpit");
  assert.equal(planet.launchContext?.returnTarget, "legacy-cockpit");
  assert.equal(special.launchContext?.mission.id, "special:kepler-black-box");
  assert.equal(special.launchContext?.entryProvenance, "continue");
  assert.equal(special.launchContext?.returnTarget, "legacy-cockpit");

  save.completedSpecialMissions = ["kepler-black-box"];
  assert.throws(
    () => game.createSpecialLaunchState!(save, "kepler-black-box"),
    /already cleared/i,
  );
});

test("direct and continued Colony exterior launches own one attempt across the scene stack", async () => {
  const game = await shell();
  const fixture = findFixture("day");
  assert.ok(fixture);
  const seeded = applyColonyFixture(nonDefaultSave(), fixture);

  const direct = game.createColonyExteriorLaunchState!(seeded.save, seeded.colonyId);
  const continued = game.createColonyExteriorLaunchState!(seeded.save, seeded.colonyId, "continue");

  assert.equal(direct.gameState.launchContext?.mission.id, `colony:${seeded.colonyId}:exterior`);
  assert.equal(direct.gameState.launchContext?.entryProvenance, "cockpit");
  assert.equal(direct.gameState.launchContext?.returnTarget, "legacy-cockpit");
  assert.equal(direct.sceneStack.colonyId, seeded.colonyId);
  assert.equal(direct.sceneStack.current.kind, "exterior");
  assert.equal(continued.gameState.launchContext?.entryProvenance, "continue");
  assert.notEqual(
    continued.gameState.launchContext?.launchId,
    direct.gameState.launchContext?.launchId,
  );
});

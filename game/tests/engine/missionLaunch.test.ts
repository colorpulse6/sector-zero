import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createGameState,
  createPlanetGameState,
  createSpecialMissionGameState,
  updateGame,
} from "../../app/components/engine/gameEngine";
import { createHydrationSafeSave } from "../../app/components/engine/save";
import { GameScreen, PowerUpType } from "../../app/components/engine/types";
import {
  campaignMissionDescriptor,
  colonyMissionDescriptor,
  continueLaunchContext,
  launchContextFromSave,
  operationMissionDescriptor,
  planetMissionDescriptor,
  poiMissionDescriptor,
  retryLaunchContext,
  specialMissionDescriptor,
  type LaunchContext,
  type MissionDescriptor,
} from "../../app/components/engine/missionContext";
import { ALL_LEVELS } from "../../app/components/engine/levels";
import { PLANET_DEFS } from "../../app/components/engine/planets";
import { G0_OPERATION_IDS } from "../../app/components/engine/operations/operationCatalog";
import { POI_TEMPLATE_IDS } from "../../app/components/colony/region/poiCatalog";
import { createFreshGalaxyRun, startFreshGalaxy } from "../../app/components/engine/galaxy/galaxyRun";
import { planRoute } from "../../app/components/engine/galaxy/routePlanner";
import { commitTravel, resumeTravelToBoundary } from "../../app/components/engine/galaxy/travelResolver";
import { projectGalaxyRunToLegacySave } from "../../app/components/engine/galaxy/galaxyProjection";
import { authorizeOperationLaunch } from "../../app/components/engine/operations/operationCatalog";
import { launchOperation } from "../../app/components/engine/operations/operationAdapters";
import { createPoiGameState } from "../../app/components/colony/region/poiRuntime";
import { createFirstPersonRuinTemplate } from "../../app/components/colony/region/poiTemplates";

test("campaign construction consumes and owns a complete non-default launch loadout", () => {
  const save = createHydrationSafeSave();
  save.upgrades = {
    hullPlating: 2,
    engineBoost: 3,
    weaponCore: 1,
    munitionsBay: 2,
    fireControl: 1,
    shieldGenerator: 2,
  };
  save.unlockedEnhancements = ["reinforced-shield", "resonance-field"];
  save.pilotLevel = 5;
  save.allocatedSkills = ["sharpshooter", "overcharge"];
  save.equippedWeaponType = "cryogenic";
  save.equippedConsumables = ["shield-charge", "scanner-pulse"];
  save.consumableInventory = { "shield-charge": 3, "scanner-pulse": 2 };
  const launch: LaunchContext = {
    launchId: "launch:test:campaign",
    mission: {
      id: "campaign:2:3",
      kind: "campaign",
      title: "Frozen Siege",
      locationLabel: "Cryon Nebula",
      objectiveLabel: "Complete the campaign level",
      controlsProfile: "shooter",
      replayPolicy: "repeatable",
    },
    pilot: {
      upgrades: structuredClone(save.upgrades),
      unlockedEnhancements: [...save.unlockedEnhancements],
      pilotLevel: save.pilotLevel,
      allocatedSkills: [...save.allocatedSkills],
      equippedWeaponType: save.equippedWeaponType,
      equippedConsumables: [...save.equippedConsumables],
      consumableInventory: structuredClone(save.consumableInventory),
    },
    persistenceAuthority: "legacy",
    entryProvenance: "star-map",
    returnTarget: "legacy-star-map",
  };

  const state = createGameState(2, 3, launch);
  save.upgrades.hullPlating = 0;
  save.unlockedEnhancements.length = 0;
  save.allocatedSkills.length = 0;
  save.equippedConsumables.length = 0;
  save.consumableInventory["shield-charge"] = 0;

  assert.deepEqual(state.launchContext, launch);
  assert.notEqual(state.launchContext, launch);
  assert.notEqual(state.launchContext?.pilot, launch.pilot);
  assert.equal(state.player.maxHp, 5);
  assert.equal(state.player.speed, 6.5);
  assert.equal(state.player.weaponLevel, 2);
  assert.equal(state.bombs, 4);
  assert.equal(state.equippedWeaponType, "cryogenic");
  assert.deepEqual(state.allocatedSkills, ["sharpshooter", "overcharge"]);
});

test("a planet attempt cannot inherit allocated-skill caches from an earlier campaign", () => {
  const save = createHydrationSafeSave();
  save.allocatedSkills = ["overcharge"];
  const campaignLaunch: LaunchContext = {
    launchId: "launch:test:cache-source",
    mission: {
      id: "campaign:1:1",
      kind: "campaign",
      title: "First Contact",
      objectiveLabel: "Complete the campaign level",
      controlsProfile: "shooter",
      replayPolicy: "repeatable",
    },
    pilot: {
      upgrades: structuredClone(save.upgrades),
      unlockedEnhancements: [],
      pilotLevel: 1,
      allocatedSkills: ["overcharge"],
      equippedWeaponType: "kinetic",
      equippedConsumables: [],
      consumableInventory: {},
    },
    persistenceAuthority: "legacy",
    entryProvenance: "star-map",
    returnTarget: "legacy-star-map",
  };
  createGameState(1, 1, campaignLaunch);
  const planet = createPlanetGameState("verdania");
  planet.screen = GameScreen.PLAYING;
  planet.waveDelay = 60;
  planet.powerUps = [{
    id: 1,
    type: PowerUpType.RAPID_FIRE,
    x: planet.player.x,
    y: planet.player.y - 1.5,
    width: 24,
    height: 24,
    vy: 1.5,
  }];

  const updated = updateGame(
    planet,
    { left: false, right: false, up: false, down: false, strafeLeft: false, strafeRight: false, shoot: false, bomb: false, jump: false },
    null,
    null,
  );

  assert.equal(updated.activePowerUps[0]?.remainingFrames, 599);
});

test("a later special constructor cannot replace an earlier attempt's build effects", () => {
  const save = createHydrationSafeSave();
  const campaignLaunch: LaunchContext = {
    launchId: "launch:test:owned-build",
    mission: {
      id: "campaign:1:1",
      kind: "campaign",
      title: "First Contact",
      objectiveLabel: "Complete the campaign level",
      controlsProfile: "shooter",
      replayPolicy: "repeatable",
    },
    pilot: {
      upgrades: { ...save.upgrades },
      unlockedEnhancements: ["resonance-field"],
      pilotLevel: 1,
      allocatedSkills: ["overcharge"],
      equippedWeaponType: "energy",
      equippedConsumables: ["weapon-overcharge"],
      consumableInventory: { "weapon-overcharge": 2 },
    },
    persistenceAuthority: "legacy",
    entryProvenance: "star-map",
    returnTarget: "legacy-star-map",
  };
  const campaign = createGameState(1, 1, campaignLaunch);
  campaign.screen = GameScreen.PLAYING;
  campaign.waveDelay = 60;
  campaign.powerUps = [{
    id: 2,
    type: PowerUpType.RAPID_FIRE,
    x: campaign.player.x,
    y: campaign.player.y - 1.5,
    width: 24,
    height: 24,
    vy: 1.5,
  }];
  createSpecialMissionGameState("kepler-black-box", false);

  const updated = updateGame(
    campaign,
    { left: false, right: false, up: false, down: false, strafeLeft: false, strafeRight: false, shoot: false, bomb: false, jump: false },
    null,
    null,
  );

  assert.equal(updated.activePowerUps[0]?.remainingFrames, 1124);
});

test("launchContextFromSave deep-copies all seven loadout fields and obeys explicit authority", () => {
  const save = createHydrationSafeSave();
  save.upgrades = { ...save.upgrades, hullPlating: 3, fireControl: 2 };
  save.unlockedEnhancements = ["incendiary-bombs"];
  save.pilotLevel = 12;
  save.allocatedSkills = ["sharpshooter", "adrenaline"];
  save.equippedWeaponType = "incendiary";
  save.equippedConsumables = ["hull-repair"];
  save.consumableInventory = { "hull-repair": 4 };
  const descriptor: MissionDescriptor = {
    id: "operation:op:hostile-picket",
    kind: "operation",
    title: "Hostile Picket",
    objectiveLabel: "Break the hostile picket",
    controlsProfile: "shooter",
    replayPolicy: "one-shot",
  };

  const launch = launchContextFromSave(
    save,
    descriptor,
    "galaxy",
    "atlas",
    "galaxy-atlas",
    () => "launch:test:explicit-galaxy",
  );
  descriptor.title = "mutated";
  save.upgrades.hullPlating = 0;
  save.unlockedEnhancements.length = 0;
  save.allocatedSkills.length = 0;
  save.equippedWeaponType = "kinetic";
  save.equippedConsumables.length = 0;
  save.consumableInventory["hull-repair"] = 0;

  assert.equal(launch.launchId, "launch:test:explicit-galaxy");
  assert.equal(launch.persistenceAuthority, "galaxy");
  assert.equal(launch.entryProvenance, "atlas");
  assert.equal(launch.returnTarget, "galaxy-atlas");
  assert.deepEqual(launch.pilot, {
    upgrades: { hullPlating: 3, engineBoost: 0, weaponCore: 0, munitionsBay: 0, fireControl: 2, shieldGenerator: 0 },
    unlockedEnhancements: ["incendiary-bombs"],
    pilotLevel: 12,
    allocatedSkills: ["sharpshooter", "adrenaline"],
    equippedWeaponType: "incendiary",
    equippedConsumables: ["hull-repair"],
    consumableInventory: { "hull-repair": 4 },
  });
  assert.equal(launch.mission.title, "Hostile Picket");
});

test("gameplay retry preserves its owned context but receives a new launch ID", () => {
  const save = createHydrationSafeSave();
  save.equippedWeaponType = "energy";
  save.equippedConsumables = ["scanner-pulse"];
  save.consumableInventory = { "scanner-pulse": 2 };
  const original = launchContextFromSave(
    save,
    {
      id: "campaign:3:2",
      kind: "campaign",
      title: "Ignis Rift 3-2",
      objectiveLabel: "Complete the campaign level",
      controlsProfile: "shooter",
      replayPolicy: "repeatable",
    },
    "legacy",
    "star-map",
    "legacy-star-map",
    () => "launch:test:original",
  );

  const retried = retryLaunchContext(original, () => "launch:test:retry");

  assert.equal(retried.launchId, "launch:test:retry");
  assert.equal(retried.entryProvenance, "retry");
  assert.deepEqual(retried.mission, original.mission);
  assert.deepEqual(retried.pilot, original.pilot);
  assert.equal(retried.persistenceAuthority, original.persistenceAuthority);
  assert.equal(retried.returnTarget, original.returnTarget);
  assert.notEqual(retried.mission, original.mission);
  assert.notEqual(retried.pilot, original.pilot);
});

test("gameplay continue preserves context, records provenance, and receives a new launch ID", () => {
  const original = launchContextFromSave(
    createHydrationSafeSave(),
    {
      id: "campaign:4-5",
      kind: "campaign",
      title: "The Graveyard 4-5",
      objectiveLabel: "Complete the campaign level",
      controlsProfile: "shooter",
      replayPolicy: "repeatable",
    },
    "legacy",
    "cockpit",
    "legacy-cockpit",
    () => "launch:test:continue-source",
  );

  const continued = continueLaunchContext(original, () => "launch:test:continue-next");

  assert.equal(continued.launchId, "launch:test:continue-next");
  assert.equal(continued.entryProvenance, "continue");
  assert.deepEqual(continued.mission, original.mission);
  assert.deepEqual(continued.pilot, original.pilot);
  assert.equal(continued.persistenceAuthority, original.persistenceAuthority);
  assert.equal(continued.returnTarget, original.returnTarget);
});

test("mission descriptor factories cover every shipped core route with unique identity", () => {
  const campaign = ALL_LEVELS.map((level) => campaignMissionDescriptor(level.world, level.level));
  const planets = PLANET_DEFS.map((planet) => planetMissionDescriptor(planet.id));
  const special = [specialMissionDescriptor("kepler-black-box")];
  const operations = G0_OPERATION_IDS.map((operationId) => operationMissionDescriptor(operationId));
  const colonies = [
    colonyMissionDescriptor("colony:test", "exterior"),
    colonyMissionDescriptor("colony:test", "interior", "building:habitat"),
  ];
  const poiAdapters = ["firstPerson", "boarding", "groundRun"] as const;
  const pois = POI_TEMPLATE_IDS.map((templateId, index) =>
    poiMissionDescriptor(`node:${templateId}`, poiAdapters[index]),
  );
  const all = [...campaign, ...planets, ...special, ...operations, ...colonies, ...pois];

  assert.equal(campaign.length, 40);
  assert.equal(planets.length, 10);
  assert.equal(operations.length, 3);
  assert.equal(pois.length, 3);
  assert.equal(all.length, 59);
  assert.equal(new Set(all.map((descriptor) => descriptor.id)).size, all.length);
  assert.deepEqual(
    campaign.map((descriptor) => descriptor.id),
    ALL_LEVELS.map((level) => `campaign:${level.world}-${level.level}`),
  );
  assert.ok(all.every((descriptor) => descriptor.title.length > 0));
  assert.ok(all.every((descriptor) => descriptor.objectiveLabel.length > 0));
  assert.ok(all.every((descriptor) => descriptor.controlsProfile.length > 0));
  assert.ok(all.every((descriptor) => descriptor.replayPolicy.length > 0));
  assert.ok(campaign.every((descriptor) => descriptor.kind === "campaign" && descriptor.controlsProfile === "shooter"));
  assert.ok(planets.every((descriptor) =>
    descriptor.kind === "planet" &&
    descriptor.controlsProfile === "shooter" &&
    descriptor.replayPolicy === "one-shot"
  ));
  assert.equal(special[0].replayPolicy, "one-shot");
  assert.deepEqual(operations.map((descriptor) => descriptor.controlsProfile), ["shooter", "first-person", "shooter"]);
  assert.ok(colonies.every((descriptor) => descriptor.kind === "colony" && descriptor.controlsProfile === "colony-exploration"));
  assert.deepEqual(pois.map((descriptor) => descriptor.controlsProfile), ["first-person", "boarding", "ground-run"]);
  assert.ok(pois.every((descriptor) => descriptor.replayPolicy === "replay-variant"));
  assert.deepEqual(
    pois.map((descriptor) => descriptor.id),
    POI_TEMPLATE_IDS.map((templateId) => `poi:${templateId}:node:${templateId}`),
  );
});

test("descriptor factories reject invalid registry identity and launch authority cannot cross experiences", () => {
  assert.throws(() => campaignMissionDescriptor(0, 1), /Unknown campaign coordinates/);
  assert.throws(() => campaignMissionDescriptor(1, 99), /Unknown campaign coordinates/);
  assert.throws(() => Reflect.apply(planetMissionDescriptor, undefined, ["unknown"]), /Unknown planet mission/);
  assert.throws(() => Reflect.apply(specialMissionDescriptor, undefined, ["unknown"]), /Unknown special mission/);
  assert.throws(() => Reflect.apply(operationMissionDescriptor, undefined, ["op:unknown"]), /Unknown Galaxy operation/);
  assert.throws(() => colonyMissionDescriptor("", "exterior"), /Colony ID/);
  assert.throws(() => colonyMissionDescriptor("colony:test", "interior"), /Interior building ID/);
  assert.throws(() => poiMissionDescriptor("", "boarding"), /POI node ID/);
  assert.throws(
    () => launchContextFromSave(
      createHydrationSafeSave(),
      campaignMissionDescriptor(1, 1),
      "galaxy",
      "atlas",
      "legacy-cockpit",
      () => "launch:test:mismatch",
    ),
    /galaxy launch authority cannot return through legacy-cockpit/,
  );
});

test("Colony surface contexts inherit legacy or Galaxy authority instead of creating a third namespace", () => {
  const save = createHydrationSafeSave();
  const legacyExterior = launchContextFromSave(
    save,
    colonyMissionDescriptor("colony:legacy", "exterior"),
    "legacy",
    "landing-pad",
    "legacy-cockpit",
    () => "launch:test:legacy-colony",
  );
  const galaxyInterior = launchContextFromSave(
    save,
    colonyMissionDescriptor("colony:galaxy", "interior", "building:mine"),
    "galaxy",
    "landing-pad",
    "galaxy-colony-exterior",
    () => "launch:test:galaxy-colony",
  );

  assert.equal(legacyExterior.persistenceAuthority, "legacy");
  assert.equal(legacyExterior.returnTarget, "legacy-cockpit");
  assert.equal(galaxyInterior.persistenceAuthority, "galaxy");
  assert.equal(galaxyInterior.returnTarget, "galaxy-colony-exterior");
  assert.ok([legacyExterior, galaxyInterior].every((context) => context.mission.kind === "colony"));
});

test("planet and special constructors consume the same complete launch boundary", () => {
  const save = createHydrationSafeSave();
  save.upgrades = { ...save.upgrades, engineBoost: 2, weaponCore: 2 };
  save.unlockedEnhancements = ["homing-gunners"];
  save.pilotLevel = 9;
  save.allocatedSkills = ["sharpshooter"];
  save.equippedWeaponType = "energy";
  save.equippedConsumables = ["cryo-charge"];
  save.consumableInventory = { "cryo-charge": 5 };
  const planetLaunch = launchContextFromSave(
    save,
    planetMissionDescriptor("glaciem"),
    "legacy",
    "star-map",
    "legacy-star-map",
    () => "launch:test:planet",
  );
  const specialLaunch = launchContextFromSave(
    save,
    specialMissionDescriptor("kepler-black-box"),
    "legacy",
    "cockpit",
    "legacy-cockpit",
    () => "launch:test:special",
  );

  const planet = createPlanetGameState("glaciem", planetLaunch);
  const special = createSpecialMissionGameState("kepler-black-box", false, specialLaunch);

  for (const [state, launch] of [[planet, planetLaunch], [special, specialLaunch]] as const) {
    assert.deepEqual(state.launchContext, launch);
    assert.deepEqual(state.pilotLoadout, launch.pilot);
    assert.equal(state.equippedWeaponType, "energy");
    assert.equal(state.player.speed, 6);
    assert.equal(state.player.weaponLevel, 3);
    assert.equal(state.pilotLevel, 9);
    assert.deepEqual(state.allocatedSkills, ["sharpshooter"]);
  }
});

test("Galaxy operation adapters attach explicit Galaxy launch authority and all loadout fields", () => {
  const fresh = createFreshGalaxyRun();
  fresh.ship.upgrades = { ...fresh.ship.upgrades, hullPlating: 2, fireControl: 1 };
  fresh.ship.unlockedEnhancements = ["reinforced-shield"];
  fresh.ship.equippedWeaponType = "cryogenic";
  fresh.ship.equippedConsumables = ["shield-charge"];
  fresh.ship.consumableInventory = { "shield-charge": 3 };
  fresh.pilot.level = 11;
  fresh.pilot.allocatedSkills = ["sharpshooter"];
  const preview = planRoute(fresh, { kind: "contact", contactId: "contact:hostile-picket" });
  assert.equal(preview.ok, true);
  if (!preview.ok) return;
  const committed = commitTravel(fresh, preview.plan);
  assert.equal(committed.ok, true);
  if (!committed.ok) return;
  const interrupted = resumeTravelToBoundary(committed.galaxyRun);
  assert.equal(interrupted.ok, true);
  if (!interrupted.ok) return;
  const run = interrupted.galaxyRun;
  const parent = startFreshGalaxy(createHydrationSafeSave());
  const projection = projectGalaxyRunToLegacySave({ ...parent, galaxyRun: run });
  const authorization = authorizeOperationLaunch(run, "op:hostile-picket");
  assert.equal(authorization.ok, true);
  if (!authorization.ok) return;

  const launched = launchOperation(
    run,
    projection,
    authorization.context,
    () => "launch:test:operation",
  );

  assert.equal(launched.ok, true, launched.ok ? undefined : launched.availability.reasons.join(","));
  if (!launched.ok) return;
  assert.equal(launched.context.operationId, "op:hostile-picket");
  assert.equal(launched.gameState.launchContext?.launchId, "launch:test:operation");
  assert.equal(launched.gameState.launchContext?.persistenceAuthority, "galaxy");
  assert.equal(launched.gameState.launchContext?.entryProvenance, "atlas");
  assert.equal(launched.gameState.launchContext?.returnTarget, "galaxy-atlas");
  assert.deepEqual(launched.gameState.pilotLoadout, {
    upgrades: { hullPlating: 2, engineBoost: 0, weaponCore: 0, munitionsBay: 0, fireControl: 1, shieldGenerator: 0 },
    unlockedEnhancements: ["reinforced-shield"],
    pilotLevel: 11,
    allocatedSkills: ["sharpshooter"],
    equippedWeaponType: "cryogenic",
    equippedConsumables: ["shield-charge"],
    consumableInventory: { "shield-charge": 3 },
  });
  assert.equal(launched.gameState.equippedWeaponType, "cryogenic");
});

test("POI runtime inherits explicit experience authority and the complete pilot loadout", () => {
  const save = createHydrationSafeSave();
  save.upgrades = { ...save.upgrades, munitionsBay: 2 };
  save.unlockedEnhancements = ["extended-magnet"];
  save.pilotLevel = 7;
  save.allocatedSkills = ["adrenaline"];
  save.equippedWeaponType = "incendiary";
  save.equippedConsumables = ["weapon-overcharge"];
  save.consumableInventory = { "weapon-overcharge": 2 };
  const session = {
    nodeId: "node:cinder-relay",
    engine: "firstPerson" as const,
    state: createFirstPersonRuinTemplate(17),
    rewardEligible: true,
  };

  const state = createPoiGameState(
    session,
    save,
    "galaxy",
    () => "launch:test:poi",
  );

  assert.equal(state.launchContext?.launchId, "launch:test:poi");
  assert.equal(state.launchContext?.mission.id, "poi:fp-ruin-cinder-relay:node:cinder-relay");
  assert.equal(state.launchContext?.persistenceAuthority, "galaxy");
  assert.equal(state.launchContext?.entryProvenance, "region");
  assert.equal(state.launchContext?.returnTarget, "galaxy-region");
  assert.deepEqual(state.pilotLoadout, {
    upgrades: { hullPlating: 0, engineBoost: 0, weaponCore: 0, munitionsBay: 2, fireControl: 0, shieldGenerator: 0 },
    unlockedEnhancements: ["extended-magnet"],
    pilotLevel: 7,
    allocatedSkills: ["adrenaline"],
    equippedWeaponType: "incendiary",
    equippedConsumables: ["weapon-overcharge"],
    consumableInventory: { "weapon-overcharge": 2 },
  });
  assert.equal(state.equippedWeaponType, "incendiary");
});

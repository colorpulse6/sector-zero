import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createGameState,
  createPlanetGameState,
  createSpecialMissionGameState,
  updateGame,
} from "../../app/components/engine/gameEngine";
import { createHydrationSafeSave } from "../../app/components/engine/save";
import { EnemyType, GameScreen, PowerUpType, type SaveData } from "../../app/components/engine/types";
import {
  campaignMissionDescriptor,
  colonyMissionDescriptor,
  continueLaunchContext,
  launchContextFromSave,
  operationMissionDescriptor,
  planetMissionDescriptor,
  poiMissionDescriptor,
  poiOutcomeMissionId,
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
import { createAffinityLabel } from "../../app/components/engine/floatingLabels";

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
    mission: campaignMissionDescriptor(2, 3),
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

test("all engine constructors derive gameplay only from one cloned launch snapshot", () => {
  const save = createHydrationSafeSave();
  const fixtures: Array<{
    launch: LaunchContext;
    construct: (launch: LaunchContext) => ReturnType<typeof createGameState>;
  }> = [
    {
      launch: launchContextFromSave(
        save,
        campaignMissionDescriptor(1, 1),
        "legacy",
        "star-map",
        "legacy-star-map",
        () => "launch:test:snapshot-campaign",
      ),
      construct: (launch) => createGameState(1, 1, launch),
    },
    {
      launch: launchContextFromSave(
        save,
        planetMissionDescriptor("verdania"),
        "legacy",
        "cockpit",
        "legacy-cockpit",
        () => "launch:test:snapshot-planet",
      ),
      construct: (launch) => createPlanetGameState("verdania", launch),
    },
    {
      launch: launchContextFromSave(
        save,
        specialMissionDescriptor("kepler-black-box"),
        "legacy",
        "cockpit",
        "legacy-cockpit",
        () => "launch:test:snapshot-special",
      ),
      construct: (launch) => createSpecialMissionGameState("kepler-black-box", false, launch),
    },
  ];

  for (const { launch, construct } of fixtures) {
    let pilotReads = 0;
    const drifting = new Proxy(launch, {
      get(target, property, receiver) {
        if (property !== "pilot") return Reflect.get(target, property, receiver);
        pilotReads += 1;
        if (pilotReads === 1) return target.pilot;
        return {
          ...target.pilot,
          upgrades: {
            hullPlating: 100,
            engineBoost: 100,
            weaponCore: 100,
            munitionsBay: 100,
            fireControl: 100,
            shieldGenerator: 100,
          },
        };
      },
    });

    const state = construct(drifting);
    assert.equal(pilotReads, 1);
    assert.equal(state.launchContext?.pilot.upgrades.hullPlating, 0);
    assert.equal(state.player.maxHp, 3);
    assert.equal(state.bombs, 2);
  }
});

test("a planet attempt cannot inherit allocated-skill caches from an earlier campaign", () => {
  const save = createHydrationSafeSave();
  save.allocatedSkills = ["overcharge"];
  const campaignLaunch: LaunchContext = {
    launchId: "launch:test:cache-source",
    mission: campaignMissionDescriptor(1, 1),
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
    mission: campaignMissionDescriptor(1, 1),
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
    campaignMissionDescriptor(3, 2),
    "legacy",
    "star-map",
    "legacy-star-map",
    () => "launch:test:original",
  );
  const mounted = createGameState(3, 2, original).launchContext!;

  const retried = retryLaunchContext(mounted, () => "launch:test:retry");

  assert.equal(retried.launchId, "launch:test:retry");
  assert.equal(retried.entryProvenance, "retry");
  assert.deepEqual(retried.mission, mounted.mission);
  assert.deepEqual(retried.pilot, mounted.pilot);
  assert.equal(retried.persistenceAuthority, mounted.persistenceAuthority);
  assert.equal(retried.returnTarget, mounted.returnTarget);
  assert.notEqual(retried.mission, mounted.mission);
  assert.notEqual(retried.pilot, mounted.pilot);
});

test("gameplay continue preserves context, records provenance, and receives a new launch ID", () => {
  const original = launchContextFromSave(
    createHydrationSafeSave(),
    campaignMissionDescriptor(4, 5),
    "legacy",
    "cockpit",
    "legacy-cockpit",
    () => "launch:test:continue-source",
  );
  const mounted = createGameState(4, 5, original).launchContext!;

  const continued = continueLaunchContext(mounted, () => "launch:test:continue-next");

  assert.equal(continued.launchId, "launch:test:continue-next");
  assert.equal(continued.entryProvenance, "continue");
  assert.deepEqual(continued.mission, mounted.mission);
  assert.deepEqual(continued.pilot, mounted.pilot);
  assert.equal(continued.persistenceAuthority, mounted.persistenceAuthority);
  assert.equal(continued.returnTarget, mounted.returnTarget);
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
    POI_TEMPLATE_IDS.map((templateId) =>
      `poi:${templateId.length}:${templateId}:${`node:${templateId}`.length}:node:${templateId}`
    ),
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
    "cockpit",
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
    "cockpit",
    "legacy-cockpit",
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
    nodeId: "ashfall-cinder-relay",
    engine: "firstPerson" as const,
    state: createFirstPersonRuinTemplate(17),
    rewardEligible: true,
  };
  const galaxyParent = { ...startFreshGalaxy(save), saveRevision: 7 };
  galaxyParent.galaxyRun = structuredClone(galaxyParent.galaxyRun);
  galaxyParent.galaxyRun!.planets = galaxyParent.galaxyRun!.planets.map((planet) => ({
    ...planet,
    regionMap: {
      ...planet.regionMap,
      nodes: planet.regionMap.nodes.map((node) => node.id === session.nodeId
        ? { ...node, intel: "surveyed" as const }
        : node),
    },
  }));
  const galaxyProjection = projectGalaxyRunToLegacySave(galaxyParent);
  const legacyPoiSave: SaveData = {
    ...galaxyProjection,
    upgrades: structuredClone(save.upgrades),
    unlockedEnhancements: structuredClone(save.unlockedEnhancements),
    pilotLevel: save.pilotLevel,
    allocatedSkills: structuredClone(save.allocatedSkills),
    equippedWeaponType: save.equippedWeaponType,
    equippedConsumables: structuredClone(save.equippedConsumables),
    consumableInventory: structuredClone(save.consumableInventory),
  };

  const state = createPoiGameState(
    session,
    legacyPoiSave,
    "galaxy",
    () => "launch:test:poi",
    galaxyParent,
    "galaxy:ashfall-primary",
  );
  const legacyState = createPoiGameState(
    session,
    legacyPoiSave,
    "legacy",
    () => "launch:test:legacy-poi-return",
    legacyPoiSave,
    "galaxy:ashfall-primary",
  );

  assert.equal(state.launchContext?.launchId, "launch:test:poi");
  assert.equal(state.launchContext?.mission.id, "poi:20:fp-ruin-cinder-relay:20:ashfall-cinder-relay");
  assert.equal(state.launchContext?.persistenceAuthority, "galaxy");
  assert.equal(state.launchContext?.entryProvenance, "region");
  assert.equal(state.launchContext?.returnTarget, "galaxy-region");
  assert.deepEqual(state.outcomeAttempt, {
    version: 1,
    routeKind: "poi",
    missionId: poiOutcomeMissionId(
      "poi:20:fp-ruin-cinder-relay:20:ashfall-cinder-relay",
      "galaxy:ashfall-primary",
    ),
    routeIdentity: {
      kind: "poi",
      originColonyId: "galaxy:ashfall-primary",
      nodeId: "ashfall-cinder-relay",
      engine: "firstPerson",
      templateId: "fp-ruin-cinder-relay",
      rewardEligible: true,
    },
    launchId: "launch:test:poi",
    expectedRevision: 7,
    persistenceAuthority: "galaxy",
    returnTarget: "galaxy-region",
    declaredFields: ["galaxyRun"],
    launchSnapshot: { galaxyRun: galaxyParent.galaxyRun },
  });
  assert.equal(legacyState.outcomeAttempt?.launchId, "launch:test:legacy-poi-return");
  assert.equal(legacyState.outcomeAttempt?.persistenceAuthority, "legacy");
  assert.deepEqual(legacyState.outcomeAttempt?.declaredFields, [
    "colonies", "planets", "missionsSinceStart",
  ]);
  assert.equal(legacyState.launchContext?.entryProvenance, "region");
  assert.equal(legacyState.launchContext?.returnTarget, "legacy-colony-exterior");
  const legacyRetry = retryLaunchContext(
    legacyState.launchContext!,
    () => "launch:test:legacy-poi-retry",
  );
  const changedSave = structuredClone(legacyPoiSave);
  changedSave.equippedWeaponType = "kinetic";
  changedSave.equippedConsumables = [];
  changedSave.consumableInventory = {};
  const retriedState = createPoiGameState(
    session,
    changedSave,
    "legacy",
    legacyRetry,
  );
  assert.equal(legacyRetry.entryProvenance, "retry");
  assert.equal(legacyRetry.returnTarget, "legacy-colony-exterior");
  assert.equal(retriedState.launchContext?.launchId, legacyRetry.launchId);
  assert.equal(retriedState.launchContext?.entryProvenance, "retry");
  assert.equal(retriedState.equippedWeaponType, "incendiary");
  assert.deepEqual(retriedState.pilotLoadout.equippedConsumables, ["weapon-overcharge"]);
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

test("POI retry contexts must be issued and exactly match the session and experience", () => {
  const save = createHydrationSafeSave();
  const session = {
    nodeId: "node:retry-authority",
    engine: "firstPerson" as const,
    state: createFirstPersonRuinTemplate(19),
    rewardEligible: true,
  };
  const source = createPoiGameState(
    session,
    save,
    "legacy",
    () => "launch:test:poi-retry-authority-source",
  ).launchContext!;
  const retry = retryLaunchContext(
    source,
    () => "launch:test:poi-retry-authority-child",
  );

  const injected = structuredClone(retry);
  injected.pilot.equippedWeaponType = "energy";
  injected.pilot.equippedConsumables = ["scanner-pulse"];
  injected.pilot.consumableInventory = { "scanner-pulse": 99 };
  assert.throws(
    () => createPoiGameState(session, save, "legacy", injected),
    /issued|retry|context|match/i,
  );

  assert.throws(
    () => createPoiGameState({ ...session, nodeId: "node:other" }, save, "legacy", retry),
    /retry|context/i,
  );
  assert.throws(
    () => createPoiGameState(session, save, "galaxy", retry),
    /retry|context/i,
  );
  assert.throws(
    () => createPoiGameState(session, save, "legacy", source),
    /retry|context/i,
  );
  assert.throws(
    () => createPoiGameState(
      session,
      save,
      "legacy",
      { ...retry, launchId: "launch:test:poi-retry-unissued" },
    ),
    /retry|context/i,
  );
});

test("an earlier planet attempt rebinds its own enemy spawn policy after another constructor", () => {
  const planet = createPlanetGameState("verdania");
  planet.screen = GameScreen.PLAYING;
  planet.waveDelay = 0;
  createGameState(8, 1);
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    const updated = updateGame(
      planet,
      { left: false, right: false, up: false, down: false, strafeLeft: false, strafeRight: false, shoot: false, bomb: false, jump: false },
      null,
      null,
    );
    assert.ok(updated.enemies.length > 0);
    assert.ok(updated.enemies.every((enemy) => enemy.classId === "bio-organic"));
  } finally {
    Math.random = originalRandom;
  }
});

test("constructing a second live attempt cannot recycle shared gameplay identities", () => {
  const keys = { left: false, right: false, up: false, down: false, strafeLeft: false, strafeRight: false, shoot: true, bomb: false, jump: false };
  const first = createGameState(1, 1);
  first.screen = GameScreen.PLAYING;
  first.waveDelay = 0;
  const firstUpdated = updateGame(first, keys, null, null);
  const firstLabel = createAffinityLabel(0, 0, "effective")!;

  const second = createGameState(2, 1);
  second.screen = GameScreen.PLAYING;
  second.waveDelay = 0;
  const secondUpdated = updateGame(second, keys, null, null);
  const secondLabel = createAffinityLabel(0, 0, "effective")!;

  assert.equal(
    firstUpdated.enemies.some((left) => secondUpdated.enemies.some((right) => right.id === left.id)),
    false,
    "live attempts must not reuse enemy IDs",
  );
  assert.equal(
    firstUpdated.playerBullets.some((left) => secondUpdated.playerBullets.some((right) => right.id === left.id)),
    false,
    "live attempts must not reuse player-bullet IDs",
  );
  assert.notEqual(firstLabel.id, secondLabel.id, "live attempts must not reuse floating-label IDs");
});

test("constructing another attempt cannot recycle boss-bullet identities", () => {
  const bossBulletsForAttempt = (state: ReturnType<typeof createGameState>): number[] => {
    state.screen = GameScreen.BOSS_INTRO;
    state.bossIntroTimer = 0;
    const introduced = updateGame(
      state,
      { left: false, right: false, up: false, down: false, strafeLeft: false, strafeRight: false, shoot: false, bomb: false, jump: false },
      null,
      null,
    );
    assert.ok(introduced.boss);
    introduced.boss.y = 40;
    introduced.boss.fireTimer = 0;
    const fired = updateGame(
      introduced,
      { left: false, right: false, up: false, down: false, strafeLeft: false, strafeRight: false, shoot: false, bomb: false, jump: false },
      null,
      null,
    );
    return fired.enemyBullets.map((bullet) => bullet.id);
  };

  const firstBullets = bossBulletsForAttempt(createGameState(1, 1));
  const secondBullets = bossBulletsForAttempt(createGameState(2, 1));

  assert.ok(firstBullets.length > 0);
  assert.ok(secondBullets.length > 0);
  assert.equal(
    firstBullets.some((left) => secondBullets.includes(left)),
    false,
    "live attempts must not reuse boss-bullet IDs",
  );
});

test("constructing another attempt cannot recycle dropped power-up identities", () => {
  const guaranteedDrop = (world: number, bulletId: number): number => {
    const state = createGameState(world, 1);
    state.screen = GameScreen.PLAYING;
    state.waveDelay = 60;
    state.enemies = [{
      id: bulletId + 1,
      type: EnemyType.TURRET,
      x: 120,
      y: 120,
      width: 48,
      height: 48,
      hp: 1,
      maxHp: 1,
      speed: 0,
      vx: 0,
      vy: 0,
      score: 100,
      fireTimer: 999,
      fireRate: 90,
      shoots: false,
      behavior: "static",
      behaviorTimer: 0,
      cloaked: false,
      classId: "armored",
      lastHitTimer: 0,
    }];
    state.playerBullets = [{
      id: bulletId,
      x: 120,
      y: 120,
      vx: 0,
      vy: 0,
      width: 12,
      height: 12,
      damage: 10,
      isPlayer: true,
      piercing: false,
    }];
    const updated = updateGame(
      state,
      { left: false, right: false, up: false, down: false, strafeLeft: false, strafeRight: false, shoot: false, bomb: false, jump: false },
      null,
      null,
    );
    assert.equal(updated.powerUps.length, 1);
    return updated.powerUps[0].id;
  };

  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    const firstPowerUpId = guaranteedDrop(1, 910001);
    const secondPowerUpId = guaranteedDrop(2, 910002);
    assert.notEqual(firstPowerUpId, secondPowerUpId, "live attempts must not reuse power-up IDs");
  } finally {
    Math.random = originalRandom;
  }
});

test("public engine constructors reject unknown campaign and special registry identity", () => {
  assert.throws(() => createGameState(99, 99), /Unknown campaign coordinates/);
  assert.throws(
    () => Reflect.apply(createSpecialMissionGameState, undefined, ["unknown-special", false]),
    /Unknown special mission/,
  );
});

test("public engine constructors reject descriptor-to-route mismatches", () => {
  const save = createHydrationSafeSave();
  const glaciem = launchContextFromSave(
    save,
    planetMissionDescriptor("glaciem"),
    "legacy",
    "cockpit",
    "legacy-cockpit",
    () => "launch:test:mismatched-planet",
  );
  const wrongOperationShell = launchContextFromSave(
    save,
    operationMissionDescriptor("op:ashfall-sortie"),
    "galaxy",
    "atlas",
    "galaxy-atlas",
    () => "launch:test:wrong-operation-shell",
  );

  assert.throws(() => createPlanetGameState("verdania", glaciem), /descriptor/i);
  assert.throws(() => createGameState(1, 1, wrongOperationShell), /descriptor|shell/i);
});

test("public engine constructors reject coherent-looking but unauthorized route policy", () => {
  const unauthorized = launchContextFromSave(
    createHydrationSafeSave(),
    campaignMissionDescriptor(1, 1),
    "galaxy",
    "atlas",
    "galaxy-atlas",
    () => "launch:test:unauthorized-campaign",
  );

  assert.throws(() => createGameState(1, 1, unauthorized), /authority|provenance|return/i);
});

test("dynamic descriptor components are encoded without delimiter collisions", () => {
  const first = colonyMissionDescriptor("a:interior:b", "interior", "c");
  const second = colonyMissionDescriptor("a", "interior", "b:interior:c");
  const poi = poiMissionDescriptor("node:with:delimiters", "firstPerson");

  assert.notEqual(first.id, second.id);
  assert.match(first.id, /^colony:\d+:/);
  assert.match(second.id, /^colony:\d+:/);
  assert.match(poi.id, /^poi:\d+:/);
  assert.ok(poi.id.includes("fp-ruin-cinder-relay"));
  assert.ok(poi.id.includes("node:with:delimiters"));
});

test("compatibility shells reject malformed or forged dynamic descriptors", () => {
  const save = createHydrationSafeSave();
  const poi = launchContextFromSave(
    save,
    poiMissionDescriptor("node:canonical", "firstPerson"),
    "legacy",
    "region",
    "legacy-colony-exterior",
    () => "launch:test:dynamic-poi-base",
  );
  const colony = launchContextFromSave(
    save,
    colonyMissionDescriptor("colony:canonical", "interior", "building:canonical"),
    "legacy",
    "landing-pad",
    "legacy-colony-exterior",
    () => "launch:test:dynamic-colony-base",
  );
  const cases: Array<[string, LaunchContext, MissionDescriptor]> = [
    ["forged POI prefix", poi, { ...poi.mission, id: "poi:forged-prefix" }],
    ["malformed POI length", poi, { ...poi.mission, id: poi.mission.id.replace("poi:20:", "poi:020:") }],
    ["POI title", poi, { ...poi.mission, title: "Forged Expedition" }],
    ["POI location", poi, { ...poi.mission, locationLabel: "node:forged" }],
    ["POI objective", poi, { ...poi.mission, objectiveLabel: "Collect forged cargo" }],
    ["POI profile", poi, { ...poi.mission, controlsProfile: "boarding" }],
    ["POI replay", poi, { ...poi.mission, replayPolicy: "repeatable" }],
    ["forged Colony prefix", colony, { ...colony.mission, id: "colony:forged-prefix" }],
    ["malformed Colony length", colony, { ...colony.mission, id: colony.mission.id.replace("colony:16:", "colony:016:") }],
    ["Colony title", colony, { ...colony.mission, title: "Forged Colony" }],
    ["Colony location", colony, { ...colony.mission, locationLabel: "colony:forged" }],
    ["Colony objective", colony, { ...colony.mission, objectiveLabel: "Forge the Colony" }],
    ["Colony profile", colony, { ...colony.mission, controlsProfile: "first-person" }],
    ["Colony replay", colony, { ...colony.mission, replayPolicy: "replay-variant" }],
  ];

  for (const [label, base, mission] of cases) {
    const context: LaunchContext = {
      ...base,
      launchId: `launch:test:dynamic-forgery:${label.replaceAll(" ", "-")}`,
      mission,
    };
    assert.throws(() => createGameState(1, 1, context), /descriptor|shell/i, label);
  }
});

test("launch ID issuance rejects blank and process-wide duplicate factory output", () => {
  const save = createHydrationSafeSave();
  const descriptor = campaignMissionDescriptor(1, 1);
  assert.throws(
    () => launchContextFromSave(
      save,
      descriptor,
      "legacy",
      "star-map",
      "legacy-star-map",
      () => "   ",
    ),
    /non-empty|blank/i,
  );

  const factory = () => "launch:test:process-duplicate";
  launchContextFromSave(save, descriptor, "legacy", "star-map", "legacy-star-map", factory);
  assert.throws(
    () => launchContextFromSave(save, descriptor, "legacy", "star-map", "legacy-star-map", factory),
    /duplicate/i,
  );

  const trimmed = launchContextFromSave(
    save,
    descriptor,
    "legacy",
    "star-map",
    "legacy-star-map",
    () => "  launch:test:trimmed  ",
  );
  assert.equal(trimmed.launchId, "launch:test:trimmed");
  assert.throws(
    () => launchContextFromSave(
      save,
      descriptor,
      "legacy",
      "star-map",
      "legacy-star-map",
      () => "launch:test:trimmed",
    ),
    /duplicate/i,
  );
});

test("retry and continue reject an ID already issued to another attempt", () => {
  const original = launchContextFromSave(
    createHydrationSafeSave(),
    campaignMissionDescriptor(1, 1),
    "legacy",
    "star-map",
    "legacy-star-map",
    () => "launch:test:lineage-original",
  );
  const mounted = createGameState(1, 1, original).launchContext!;
  retryLaunchContext(mounted, () => "launch:test:lineage-child");

  assert.throws(
    () => continueLaunchContext(mounted, () => "launch:test:lineage-child"),
    /duplicate/i,
  );
  assert.throws(
    () => retryLaunchContext(mounted, () => mounted.launchId),
    /duplicate|new/i,
  );
});

test("retry and continue require an exact claimed parent attempt", () => {
  const unmounted = launchContextFromSave(
    createHydrationSafeSave(),
    campaignMissionDescriptor(2, 1),
    "legacy",
    "star-map",
    "legacy-star-map",
    () => "launch:test:unmounted-lineage-source",
  );
  assert.throws(
    () => retryLaunchContext(unmounted, () => "launch:test:unmounted-retry"),
    /claimed|mounted/i,
  );
  assert.throws(
    () => continueLaunchContext(unmounted, () => "launch:test:unmounted-continue"),
    /claimed|mounted/i,
  );

  const mounted = createGameState(2, 1, unmounted).launchContext!;
  const forgedParent = structuredClone(mounted);
  forgedParent.pilot.upgrades.hullPlating = 5;
  forgedParent.pilot.equippedWeaponType = "energy";
  assert.throws(
    () => retryLaunchContext(forgedParent, () => "launch:test:forged-parent-child"),
    /claimed|mounted|match/i,
  );
});

test("an issued retry child cannot be mutated before it is mounted", () => {
  const source = launchContextFromSave(
    createHydrationSafeSave(),
    campaignMissionDescriptor(2, 2),
    "legacy",
    "star-map",
    "legacy-star-map",
    () => "launch:test:immutable-child-source",
  );
  const mounted = createGameState(2, 2, source).launchContext!;
  const retry = retryLaunchContext(
    mounted,
    () => "launch:test:immutable-child",
  );
  retry.pilot.upgrades.hullPlating = 5;
  retry.pilot.equippedWeaponType = "energy";

  assert.throws(
    () => createGameState(2, 2, retry),
    /issued|changed|match/i,
  );
});

test("engine constructors reject mounting the same launch attempt twice", () => {
  const launch = launchContextFromSave(
    createHydrationSafeSave(),
    campaignMissionDescriptor(1, 1),
    "legacy",
    "star-map",
    "legacy-star-map",
    () => "launch:test:double-mount",
  );

  createGameState(1, 1, launch);
  assert.throws(() => createGameState(1, 1, launch), /duplicate|mounted/i);
});

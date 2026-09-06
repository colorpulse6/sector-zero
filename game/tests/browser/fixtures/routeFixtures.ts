import {
  applyColonyFixture,
  findFixture as findColonyFixture,
} from "../../../app/components/colony/dev/seedColony";
import {
  applyGalaxyFixture,
  findGalaxyFixture,
} from "../../../app/components/galaxy/devFixtures";
import { PLANET_DEFS } from "../../../app/components/engine/planets";
import { migrateSave, recalcPilotLevel } from "../../../app/components/engine/save";
import { unlockCodexEntries } from "../../../app/components/engine/codex";
import { SPECIAL_MISSIONS } from "../../../app/components/engine/specialMissions";
import {
  DEFAULT_UPGRADES,
  GameScreen,
  type OutcomeAttempt,
  type SaveData,
} from "../../../app/components/engine/types";
import {
  commitOutcome,
  createOutcomeAttempt,
  createOutcomeEnvelope,
} from "../../../app/components/engine/missionOutcome";
import {
  launchContextFromSave,
  planetMissionDescriptor,
  poiOutcomeMissionId,
} from "../../../app/components/engine/missionContext";
import {
  stageGalaxyPoiOutcomeAuthority,
} from "../../../app/components/engine/operations/operationAdapters";
import { projectGalaxyRunToLegacyState } from "../../../app/components/engine/galaxy/galaxyProjection";
import { dispatchPoi } from "../../../app/components/colony/region/poiDispatcher";
import {
  advanceTravelCheckpoint,
  finalizeTravel,
  resolveTravelInterruption,
  resumeTravelToBoundary,
  type TravelTransitionResult,
} from "../../../app/components/engine/galaxy/travelResolver";

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function canonical(raw: Record<string, unknown>): SaveData {
  return migrateSave(jsonClone(raw));
}

function requireColonyFixture(id: string) {
  const fixture = findColonyFixture(id);
  if (!fixture) throw new Error(`Missing Colony fixture: ${id}`);
  return fixture;
}

function requireGalaxyFixture(id: string) {
  const fixture = findGalaxyFixture(id);
  if (!fixture) throw new Error(`Missing Galaxy fixture: ${id}`);
  return fixture;
}

function requireTravel(result: TravelTransitionResult) {
  if (!result.ok) {
    throw new Error(
      `Galaxy fixture transition failed: ${result.errors.map((entry) => entry.message).join("; ")}`,
    );
  }
  return result.galaxyRun;
}

export const freshLegacy = canonical({});

const planetUnlockLevels = Object.fromEntries(
  PLANET_DEFS.map((planet) => [
    planet.unlockAfterLevel,
    { completed: true, stars: 3, highScore: 1000 },
  ]),
) as SaveData["levels"];

export const allPlanetsLaunchable = canonical({
  ...freshLegacy,
  introSeen: true,
  levels: planetUnlockLevels,
  totalStars: Math.max(...PLANET_DEFS.map((planet) => planet.unlockStars)),
  completedPlanets: [],
  xp: 7200,
  upgrades: {
    ...DEFAULT_UPGRADES,
    hullPlating: 2,
    engineBoost: 1,
    weaponCore: 2,
  },
  unlockedEnhancements: ["reinforced-shield", "incendiary-bombs"],
  equippedWeaponType: "energy",
  consumableInventory: { "hull-repair": 2, "cryo-charge": 1 },
  equippedConsumables: ["cryo-charge"],
  pilotLevel: 8,
  skillPoints: 2,
  allocatedSkills: ["sharpshooter", "overcharge"],
});

const kepler = SPECIAL_MISSIONS.find((mission) => mission.id === "kepler-black-box");
if (!kepler) throw new Error("Kepler mission is missing from SPECIAL_MISSIONS");

export const keplerUnlocked = canonical({
  ...freshLegacy,
  levels: {
    ...freshLegacy.levels,
    [kepler.unlockAfterLevel]: { completed: true, stars: 3, highScore: 1000 },
  },
  unlockedSpecialMissions: [kepler.id],
});

export const keplerCleared = canonical({
  ...keplerUnlocked,
  completedSpecialMissions: [kepler.id],
  storyItems: [kepler.storyItemId],
});

export const freshGalaxy = canonical(
  applyGalaxyFixture(freshLegacy, requireGalaxyFixture("atlas-start")) as unknown as Record<string, unknown>,
);

function buildGalaxyAtAshfall(): SaveData {
  const committed = applyGalaxyFixture(freshLegacy, requireGalaxyFixture("known-route"));
  if (!committed.galaxyRun) throw new Error("Known-route fixture did not start a Galaxy run");
  const arrived = requireTravel(advanceTravelCheckpoint(committed.galaxyRun));
  const finalized = requireTravel(finalizeTravel(arrived));
  return canonical({ ...committed, galaxyRun: finalized });
}

export const galaxyAtAshfall = buildGalaxyAtAshfall();

export function galaxyWithLegacyProgression(source: SaveData): SaveData {
  // Match the canonical reader's derived Legacy fields before the browser
  // starts, so byte checks isolate Galaxy writes from fixture normalization.
  return recalcPilotLevel(unlockCodexEntries(canonical({
    ...allPlanetsLaunchable,
    activeExperience: source.activeExperience,
    galaxyRun: source.galaxyRun,
    saveRevision: source.saveRevision,
    appliedOutcomeIds: source.appliedOutcomeIds,
    outcomeRecoveryRecords: source.outcomeRecoveryRecords,
  })));
}

export function galaxyTravelFixture(stage: "committed" | "arrived" | "diverted"): SaveData {
  const committed = applyGalaxyFixture(
    allPlanetsLaunchable,
    requireGalaxyFixture(stage === "diverted" ? "hostile-route" : "known-route"),
  );
  if (committed.galaxyRun === null) throw new Error("Travel fixture has no Galaxy run");
  if (stage === "committed") return canonical(committed as unknown as Record<string, unknown>);
  const resumed = requireTravel(resumeTravelToBoundary(committed.galaxyRun));
  const run = stage === "arrived" ? resumed : requireTravel(
    resolveTravelInterruption(resumed, "op:hostile-picket", "failed"),
  );
  return canonical({ ...committed, galaxyRun: run });
}

export function pendingLegacyPlanetReturn(): SaveData {
  const save = structuredClone(allPlanetsLaunchable);
  const context = launchContextFromSave(
    save,
    planetMissionDescriptor("ossuary"),
    "legacy",
    "cockpit",
    "legacy-cockpit",
    () => "browser-legacy-planet-return",
  );
  const terminal = createOutcomeEnvelope(createOutcomeAttempt(save, context, "planet"), "failure", {
    version: 1,
    kind: "terminal_noop_v1",
  });
  let canonicalSave = save;
  const committed = commitOutcome({
    read: () => canonicalSave,
    write: (next) => { canonicalSave = next; },
  }, terminal);
  if (committed.status !== "committed") {
    throw new Error(`Legacy planet fixture could not be committed: ${committed.status}`);
  }
  return canonical(committed.save as unknown as Record<string, unknown>);
}

export function pendingGalaxyPoiReturn(): SaveData {
  if (!galaxyAtAshfall.galaxyRun) throw new Error("Ashfall fixture has no Galaxy run");
  const run = structuredClone(galaxyAtAshfall.galaxyRun);
  run.planets = run.planets.map((planet) => ({
    ...planet,
    regionMap: {
      ...planet.regionMap,
      nodes: planet.regionMap.nodes.map((node) => node.id === "ashfall-cinder-relay"
        ? { ...node, intel: "surveyed" as const }
        : node),
    },
  }));
  const save = canonical({ ...galaxyAtAshfall, galaxyRun: run });
  const projected = projectGalaxyRunToLegacyState(run);
  const dispatched = dispatchPoi(projected, "galaxy:ashfall-primary", "ashfall-cinder-relay");
  if (!dispatched.ok) throw new Error("Ashfall POI fixture could not be dispatched");
  const routeIdentity = {
    kind: "poi" as const,
    originColonyId: "galaxy:ashfall-primary",
    nodeId: "ashfall-cinder-relay",
    engine: "firstPerson" as const,
    templateId: "fp-ruin-cinder-relay",
    rewardEligible: true,
  };
  const attempt: OutcomeAttempt = {
    version: 1,
    routeKind: "poi",
    missionId: poiOutcomeMissionId(
      "poi:20:fp-ruin-cinder-relay:20:ashfall-cinder-relay",
      routeIdentity.originColonyId,
    ),
    routeIdentity,
    launchId: "browser-galaxy-poi-return",
    expectedRevision: save.saveRevision,
    persistenceAuthority: "galaxy",
    returnTarget: "galaxy-region",
    declaredFields: ["galaxyRun"],
    launchSnapshot: { galaxyRun: structuredClone(run) },
  };
  const staged = stageGalaxyPoiOutcomeAuthority(
    save,
    { originColonyId: routeIdentity.originColonyId, session: dispatched.session },
    GameScreen.LEVEL_COMPLETE,
    attempt,
  );
  if (!staged.ok) throw new Error(`Ashfall POI fixture could not be staged: ${staged.reason}`);
  const terminal = createOutcomeEnvelope(staged.attempt, "success", {
    version: 2,
    kind: "poi_result_v2",
    destinationColonyId: routeIdentity.originColonyId,
  });
  let canonicalSave = staged.save;
  const committed = commitOutcome({
    read: () => canonicalSave,
    write: (next) => { canonicalSave = next; },
  }, terminal);
  if (committed.status !== "committed") {
    throw new Error(`Ashfall POI fixture could not be committed: ${committed.status}`);
  }
  return canonical(committed.save as unknown as Record<string, unknown>);
}

const founded = applyColonyFixture(freshLegacy, requireColonyFixture("grown"));
export const colonyFounded = canonical(founded.save as unknown as Record<string, unknown>);
export const colonyFoundedId = founded.colonyId;

export const ROUTE_FIXTURES = Object.freeze({
  freshLegacy,
  allPlanetsLaunchable,
  keplerUnlocked,
  keplerCleared,
  freshGalaxy,
  galaxyAtAshfall,
  colonyFounded,
});

export type RouteFixtureName = keyof typeof ROUTE_FIXTURES;

export function cloneRouteFixture(name: RouteFixtureName): SaveData {
  return jsonClone(ROUTE_FIXTURES[name]);
}

import {
  applyColonyFixture,
  findFixture as findColonyFixture,
} from "../../../app/components/colony/dev/seedColony";
import {
  applyGalaxyFixture,
  findGalaxyFixture,
} from "../../../app/components/galaxy/devFixtures";
import { PLANET_DEFS } from "../../../app/components/engine/planets";
import { migrateSave } from "../../../app/components/engine/save";
import { SPECIAL_MISSIONS } from "../../../app/components/engine/specialMissions";
import {
  DEFAULT_UPGRADES,
  type SaveData,
} from "../../../app/components/engine/types";
import {
  advanceTravelCheckpoint,
  finalizeTravel,
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

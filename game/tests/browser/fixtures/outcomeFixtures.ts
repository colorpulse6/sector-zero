import { Events } from "../../../app/components/colony/shared/colonyEvents";
import { colonyReducer } from "../../../app/components/colony/shared/colonyReducer";
import { dispatchPoi } from "../../../app/components/colony/region/poiDispatcher";
import { unlockCodexEntries } from "../../../app/components/engine/codex";
import {
  campaignMissionDescriptor,
  colonyMissionDescriptor,
  launchContextFromSave,
  poiMissionDescriptor,
  specialMissionDescriptor,
} from "../../../app/components/engine/missionContext";
import {
  commitOutcome,
  createOutcomeAttempt,
  createOutcomeEnvelope,
} from "../../../app/components/engine/missionOutcome";
import { migrateSave, recalcPilotLevel } from "../../../app/components/engine/save";
import type { OutcomeAttempt, SaveData, SerializedOutcomeEnvelope } from "../../../app/components/engine/types";

import { allPlanetsLaunchable, colonyFounded, colonyFoundedId, keplerUnlocked } from "./routeFixtures";

export type LegacyReloadClass = "campaign" | "special" | "colony" | "poi";

function canonical(save: SaveData): SaveData {
  return recalcPilotLevel(unlockCodexEntries(migrateSave(JSON.parse(JSON.stringify(save)))));
}

export function pendingLegacyClassReturn(route: LegacyReloadClass): SaveData {
  let save = canonical({
    ...(route === "special" ? keplerUnlocked : route === "colony" ? colonyFounded : allPlanetsLaunchable),
    introSeen: true,
  });
  let attempt: OutcomeAttempt;
  let terminal: SerializedOutcomeEnvelope;
  const launchId = () => `browser-reload-${route}`;
  if (route === "campaign") {
    const context = launchContextFromSave(save, campaignMissionDescriptor(3, 2), "legacy", "star-map", "legacy-star-map", launchId);
    attempt = createOutcomeAttempt(save, context, route);
    terminal = createOutcomeEnvelope(attempt, "success", {
      version: 1,
      kind: "campaign_result_v1",
      score: 1250,
      xpEarned: 50,
      killCount: 1,
      bestiaryKills: [],
      totalEnemies: 1,
      deaths: 0,
      frameCount: 120,
      playerHp: 3,
      playerMaxHp: 3,
    });
  } else if (route === "special") {
    const context = launchContextFromSave(save, specialMissionDescriptor("kepler-black-box"), "legacy", "cockpit", "legacy-cockpit", launchId);
    attempt = createOutcomeAttempt(save, context, route);
    terminal = createOutcomeEnvelope(attempt, "success", {
      version: 1,
      kind: "special_result_v1",
      score: 1250,
      objectiveCollected: true,
      bestiaryKills: [],
    });
  } else if (route === "colony") {
    const context = launchContextFromSave(save, colonyMissionDescriptor(colonyFoundedId, "exterior"), "legacy", "cockpit", "legacy-cockpit", launchId);
    attempt = createOutcomeAttempt(save, context, route);
    terminal = createOutcomeEnvelope(attempt, "success", { version: 1, kind: "terminal_noop_v1" });
  } else {
    save = colonyReducer(save, Events.founded({
      colonyId: "browser-poi-home",
      name: "Browser POI Home",
      planetId: "ashfall",
      foundingType: "outpost",
      regionNodeId: "ashfall-forward-camp",
      missionCount: 0,
      layoutSeed: 1,
    }));
    save = canonical({
      ...save,
      planets: save.planets.map((planet) => ({
        ...planet,
        regionMap: {
          ...planet.regionMap,
          nodes: planet.regionMap.nodes.map((node) => node.id === "ashfall-cinder-relay"
            ? { ...node, intel: "surveyed" as const }
            : node),
        },
      })),
    });
    const dispatched = dispatchPoi(save, "browser-poi-home", "ashfall-cinder-relay");
    if (!dispatched.ok) throw new Error("Legacy POI fixture could not dispatch its route");
    const context = launchContextFromSave(save, poiMissionDescriptor("ashfall-cinder-relay", "firstPerson"), "legacy", "region", "legacy-colony-exterior", launchId);
    attempt = createOutcomeAttempt(save, context, route, {
      originColonyId: "browser-poi-home",
      rewardEligible: dispatched.session.rewardEligible,
    });
    terminal = createOutcomeEnvelope(attempt, "failure", { version: 1, kind: "terminal_noop_v1" });
  }
  let stored = save;
  const result = commitOutcome({ read: () => stored, write: (next) => { stored = next; } }, terminal);
  if (result.status !== "committed") throw new Error(`${route} reload fixture failed: ${result.status}`);
  return canonical(result.save);
}

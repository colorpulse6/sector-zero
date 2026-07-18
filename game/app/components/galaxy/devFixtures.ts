// Deterministic G0 playtest states for the DevPanel. Fixtures rebuild only the
// isolated galaxy namespace and use the same public planning/travel reducers as
// player actions, so legacy campaign progress remains an inert sibling.

import { BLIND_FIXTURE_COORDINATE } from "../engine/galaxy/authoredAnchors";
import { createFreshGalaxyRun, startFreshGalaxy } from "../engine/galaxy/galaxyRun";
import type { GalaxyRunState } from "../engine/galaxy/galaxyTypes";
import {
  planRoute,
  type AtlasTarget,
  type RoutePlan,
} from "../engine/galaxy/routePlanner";
import {
  advanceTravelCheckpoint,
  commitTravel,
  finalizeTravel,
  type TravelTransitionResult,
} from "../engine/galaxy/travelResolver";
import type { SaveData } from "../engine/types";

export type GalaxyFixtureId =
  | "atlas-start"
  | "known-route"
  | "hostile-route"
  | "blind-discovery"
  | "insufficient-supply"
  | "in-transit-reload";

export interface GalaxyFixture {
  id: GalaxyFixtureId;
  label: string;
  description: string;
}

export const GALAXY_FIXTURES: readonly GalaxyFixture[] = Object.freeze([
  {
    id: "atlas-start",
    label: "ATLAS START",
    description: "Fresh post-prologue G0 run at Vanguard.",
  },
  {
    id: "known-route",
    label: "KNOWN ROUTE",
    description: "Committed safe route from Vanguard to Ashfall.",
  },
  {
    id: "hostile-route",
    label: "HOSTILE ROUTE",
    description: "Committed caused route from Vanguard to the hostile picket.",
  },
  {
    id: "blind-discovery",
    label: "BLIND DISCOVERY",
    description: "Completed blind-coordinate travel with persistent direct-visit intel.",
  },
  {
    id: "insufficient-supply",
    label: "LOW SUPPLY",
    description: "Returned to Vanguard with too little supply for the hostile route.",
  },
  {
    id: "in-transit-reload",
    label: "RELOAD INTERRUPT",
    description: "Reload-safe hostile interruption after exactly one checkpoint.",
  },
]);

function contact(contactId: string): AtlasTarget {
  return { kind: "contact", contactId };
}

function requirePlan(run: GalaxyRunState, target: AtlasTarget): RoutePlan {
  const result = planRoute(run, target);
  if (!result.ok) {
    throw new Error(`Galaxy fixture route was blocked: ${result.reasons.join("; ")}`);
  }
  return result.plan;
}

function requireTravel(result: TravelTransitionResult): GalaxyRunState {
  if (!result.ok) {
    throw new Error(
      `Galaxy fixture transition failed: ${result.errors.map((entry) => entry.message).join("; ")}`,
    );
  }
  return result.galaxyRun;
}

function commitTo(run: GalaxyRunState, target: AtlasTarget): GalaxyRunState {
  return requireTravel(commitTravel(run, requirePlan(run, target)));
}

function advanceOnce(run: GalaxyRunState): GalaxyRunState {
  return requireTravel(advanceTravelCheckpoint(run));
}

function closeTravel(run: GalaxyRunState): GalaxyRunState {
  return requireTravel(finalizeTravel(run));
}

function buildFixtureRun(id: GalaxyFixtureId): GalaxyRunState {
  const fresh = createFreshGalaxyRun();

  switch (id) {
    case "atlas-start":
      return fresh;
    case "known-route":
      return commitTo(fresh, contact("contact:ashfall"));
    case "hostile-route":
      return commitTo(fresh, contact("contact:hostile-picket"));
    case "blind-discovery":
      return advanceOnce(commitTo(fresh, {
        kind: "coordinate",
        coordinate: BLIND_FIXTURE_COORDINATE,
      }));
    case "insufficient-supply": {
      const atKepler = closeTravel(
        advanceOnce(commitTo(fresh, contact("contact:kepler"))),
      );
      return closeTravel(
        advanceOnce(commitTo(atKepler, contact("contact:vanguard"))),
      );
    }
    case "in-transit-reload":
      return advanceOnce(commitTo(fresh, contact("contact:hostile-picket")));
  }
}

export function findGalaxyFixture(id: string): GalaxyFixture | undefined {
  return GALAXY_FIXTURES.find((fixture) => fixture.id === id);
}

export function applyGalaxyFixture(
  save: SaveData,
  fixture: GalaxyFixture,
): SaveData {
  const started = startFreshGalaxy(save);
  return {
    ...started,
    galaxyRun: buildFixtureRun(fixture.id),
  };
}

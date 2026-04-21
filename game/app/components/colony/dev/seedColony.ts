// Dev-only colony seed helpers.
// Used by DevPanel to bypass the commission-resource grind while playtesting
// Phase 2 (FPS descent). Not shipped behind a flag because the DevPanel itself
// is only exposed in local/dev builds via the backtick toggle.

import type { SaveData } from "../../engine/types";
import { colonyReducer } from "../shared/colonyReducer";
import { Events } from "../shared/colonyEvents";
import type { BuildingType } from "../shared/colonyTypes";

type BuildingSeed = { type: BuildingType; operational: boolean };

export interface ColonyFixture {
  id: string;
  label: string;
  buildings: BuildingSeed[];
  hour: number;
  layoutSeed: number;
}

export const COLONY_FIXTURES: ColonyFixture[] = [
  {
    id: "day",
    label: "SEED DAY",
    buildings: [
      { type: "solar_array", operational: true },
      { type: "farm", operational: true },
      { type: "water_purifier", operational: true },
      { type: "habitat_module", operational: true },
    ],
    hour: 12,
    layoutSeed: 1337,
  },
  {
    id: "night",
    label: "SEED NIGHT",
    buildings: [
      { type: "solar_array", operational: true },
      { type: "farm", operational: true },
      { type: "water_purifier", operational: true },
      { type: "habitat_module", operational: true },
    ],
    hour: 22,
    layoutSeed: 1337,
  },
  {
    id: "build",
    label: "SEED BUILD",
    buildings: [
      { type: "solar_array", operational: true },
      { type: "farm", operational: true },
      { type: "water_purifier", operational: false },
      { type: "habitat_module", operational: false },
    ],
    hour: 8,
    layoutSeed: 7,
  },
];

const fixtureColonyId = (fx: ColonyFixture): string => `fx_${fx.id}`;

export function findFixture(id: string): ColonyFixture | undefined {
  return COLONY_FIXTURES.find(f => f.id === id);
}

/**
 * Apply a dev fixture to saveData. Idempotent: reseeding the same fixture
 * clears the prior colony first so the flow is deterministic across clicks.
 * Threads the reducer output through each event — the closure-captured saveData
 * from a single setState would otherwise go stale between dispatches.
 */
export function applyColonyFixture(
  save: SaveData,
  fx: ColonyFixture,
): { save: SaveData; colonyId: string } {
  const colonyId = fixtureColonyId(fx);

  let s: SaveData = {
    ...save,
    colonies: save.colonies.filter(c => c.id !== colonyId),
  };

  s = colonyReducer(s, Events.founded({
    colonyId,
    name: `Seed ${fx.label}`,
    planetId: "ashfall",
    foundingType: "outpost",
    regionNodeId: "dev_seed_region",
    missionCount: s.missionsSinceStart,
    layoutSeed: fx.layoutSeed,
  }));

  fx.buildings.forEach((b, i) => {
    const buildingId = `${colonyId}_b${i}`;
    s = colonyReducer(s, Events.buildingCommissioned({
      colonyId,
      buildingId,
      buildingType: b.type,
      costDeducted: {},
      cyclesToBuild: 2,
    }));
    if (b.operational) {
      s = colonyReducer(s, Events.buildingCompleted({ colonyId, buildingId }));
    }
  });

  s = { ...s, gameClock: { ...s.gameClock, hour: fx.hour, minute: 0 } };

  return { save: s, colonyId };
}

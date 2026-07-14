// Dev-only colony seed helpers.
// Used by DevPanel to bypass the commission-resource grind while playtesting
// Phase 2 (FPS descent). Not shipped behind a flag because the DevPanel itself
// is only exposed in local/dev builds via the backtick toggle.

import type { SaveData } from "../../engine/types";
import { colonyReducer } from "../shared/colonyReducer";
import { Events } from "../shared/colonyEvents";
import type { BuildingType, ColonyResources } from "../shared/colonyTypes";
import { ASHFALL_REGION_SEED, generateRegionMap } from "../region/regionMap";

type BuildingSeed = { type: BuildingType; operational: boolean };

export interface ColonyFixture {
  id: string;
  label: string;
  buildings: BuildingSeed[];
  hour: number;
  layoutSeed: number;
  /** OW-0 stage fields — optional so the original time-of-day fixtures stay untouched. */
  population?: number;
  resources?: Partial<ColonyResources>;
  happiness?: number;
  regionIntel?: Record<string, "unknown" | "rumored" | "surveyed" | "cleared" | "claimed">;
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
    label: "SEED DAWN",
    buildings: [
      { type: "solar_array", operational: true },
      { type: "farm", operational: true },
      { type: "water_purifier", operational: false },
      { type: "habitat_module", operational: false },
    ],
    hour: 6,
    layoutSeed: 7,
  },
  {
    // OW-0 stage seed: a mature, healthy colony — all 5 build-menu types
    // operational (incl. mine), population at habitat capacity, fat stockpiles.
    // The 7th building (second solar) keeps the power grid in surplus; the FP
    // exterior renders the first 6 buildings (assignSlots slices to 6 slots),
    // so ordering puts the duplicate solar last — every TYPE is still visible.
    id: "grown",
    label: "SEED GROWN",
    buildings: [
      { type: "solar_array", operational: true },
      { type: "farm", operational: true },
      { type: "water_purifier", operational: true },
      { type: "habitat_module", operational: true },
      { type: "habitat_module", operational: true },
      { type: "mine", operational: true },
      { type: "solar_array", operational: true },
    ],
    hour: 12,
    layoutSeed: 2024,
    population: 20,   // = 2 habitats × 10 capacity
    resources: { food: 300, water: 200, metal: 150 },
    happiness: 85,
  },
  {
    // OW-0 stage seed: everything built and running, but the larders are
    // nearly empty — the next cycles will tank happiness and shed colonists.
    id: "strained",
    label: "SEED STRAINED",
    buildings: [
      { type: "solar_array", operational: true },
      { type: "farm", operational: true },
      { type: "water_purifier", operational: true },
      { type: "habitat_module", operational: true },
      { type: "habitat_module", operational: true },
    ],
    hour: 12,
    layoutSeed: 13,
    population: 12,
    resources: { food: 5, water: 3, metal: 40 },
    happiness: 30,
  },
  {
    id: "region",
    label: "SEED REGION",
    buildings: [],
    hour: 12,
    layoutSeed: ASHFALL_REGION_SEED,
    resources: { food: 250, water: 250, metal: 600 },
    regionIntel: {
      "ashfall-cinder-relay": "surveyed",
      "ashfall-oathbreaker-wreck": "surveyed",
      "ashfall-glassknife-canyon": "rumored",
      "ashfall-basalt-basin": "surveyed",
      "ashfall-ironreach-shelf": "unknown",
    },
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
    colonies: save.colonies.filter(c => c.id !== colonyId && c.regionNodeId !== "ashfall-forward-camp" && (!fx.regionIntel || c.planetId !== "ashfall")),
    planets: save.planets.map(planet => planet.id !== "ashfall" ? planet : {
      ...planet,
      regionMap: {
        ...planet.regionMap,
        nodes: planet.regionMap.nodes.map(node => node.id === "ashfall-forward-camp"
          ? { ...node, intel: "surveyed" as const, discovered: true, cleared: false }
          : node),
      },
    }),
  };

  if (fx.regionIntel) {
    s = {
      ...s,
      planets: s.planets.map(planet => planet.id !== "ashfall" ? planet : {
        ...planet,
        regionMap: {
          ...generateRegionMap("ashfall", ASHFALL_REGION_SEED),
          nodes: generateRegionMap("ashfall", ASHFALL_REGION_SEED).nodes.map(node => {
            const intel = fx.regionIntel?.[node.id] ?? node.intel;
            return { ...node, intel, discovered: intel !== "unknown", cleared: intel === "cleared" || intel === "claimed" };
          }),
        },
      }),
    };
  }

  s = colonyReducer(s, Events.founded({
    colonyId,
    name: `Seed ${fx.label}`,
    planetId: "ashfall",
    foundingType: "outpost",
    regionNodeId: "ashfall-forward-camp",
    missionCount: s.missionsSinceStart,
    layoutSeed: fx.layoutSeed,
  }));

  // Dev fixtures may deliberately overfill the normal six-slot layout (the
  // GROWN seed carries a second solar array for a healthy power surplus).
  // Raise only the fixture snapshot cap so the production fixture remains
  // valid while real colonies continue to enforce their surveyed site cap.
  s = {
    ...s,
    colonies: s.colonies.map(colony => colony.id === colonyId
      ? { ...colony, siteStats: { ...colony.siteStats, buildableSlots: Math.max(colony.siteStats.buildableSlots, fx.buildings.length) } }
      : colony),
  };

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
      // buildingCompleted also recomputes population.capacity (OW-0), so
      // habitat seeds set real housing without any extra fixture plumbing.
      s = colonyReducer(s, Events.buildingCompleted({ colonyId, buildingId }));
    }
  });

  // OW-0 stage fields — applied through the reducer like everything else.
  if (fx.resources) {
    s = colonyReducer(s, Events.resourceChanged({
      colonyId,
      delta: fx.resources,
      reason: "dev_seed",
    }));
  }
  if (fx.population !== undefined || fx.happiness !== undefined) {
    const seeded = s.colonies.find(c => c.id === colonyId)!;
    s = colonyReducer(s, Events.cycleAdvanced({
      colonyId,
      toCycle: seeded.lastCycleProcessed,  // stage seeds don't advance the clock
      resourceDelta: {},
      populationDelta: fx.population ?? 0,
      happinessAfter: fx.happiness ?? seeded.happiness,
    }));
  }

  s = { ...s, gameClock: { ...s.gameClock, hour: fx.hour, minute: 0 } };

  return { save: s, colonyId };
}

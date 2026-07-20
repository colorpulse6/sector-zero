import type { BuildingType, InteriorTemplateId } from "../shared/colonyTypes";
import { SPRITES } from "../../engine/sprites";

export interface FootprintSpec {
  w: number;
  h: number;
  doorSide: "north" | "south" | "east" | "west";
  interiorTemplateId: InteriorTemplateId;
  wallSpriteId: string;  // resolved sprite path (loaded by preloadAll, fetched via getSprite)
}

export interface PropSlot {
  x: number;
  y: number;
  spriteId: string;
  scale: number;
}

export interface InteriorEnvironmentArt {
  wallSpriteId: string;
  floorSpriteId: string;
  ceilingSpriteId?: string;
  skySpriteId?: string;
}

export type InteriorNpcContentId =
  | "hub-bartender"
  | "hub-regular"
  | "hub-signal-chaser";

export interface InteriorNpcSchedulePeriod {
  startHour: number;
  anchor: { x: number; y: number } | null;
}

export interface InteriorNpcSlot {
  contentId: InteriorNpcContentId;
  schedule: readonly [InteriorNpcSchedulePeriod, InteriorNpcSchedulePeriod];
}

export interface InteriorTemplate {
  width: number;
  height: number;
  /** Each string is one row. '#' wall, '.' floor, 'D' exit door, other chars are prop placeholders. */
  tiles: string[];
  propSlots: PropSlot[];
  spawn: { x: number; y: number; facing: "north" | "south" | "east" | "west" };
  environmentArt?: InteriorEnvironmentArt;
  npcSlots?: InteriorNpcSlot[];
}

/**
 * Building exterior footprint registry.
 * Phase 2: 4 entries (Phase 1 building types).
 * Phase 3+: this registry grows as Marketplace/Cantina/Town Hall land.
 */
export const BUILDING_FOOTPRINTS: Partial<Record<BuildingType, FootprintSpec>> = {
  solar_array: {
    w: 3, h: 3,
    doorSide: "south",
    interiorTemplateId: "solar_array_stub",
    wallSpriteId: SPRITES.COLONY_WALL_SOLAR,
  },
  farm: {
    w: 4, h: 3,
    doorSide: "south",
    interiorTemplateId: "farm_stub",
    wallSpriteId: SPRITES.COLONY_WALL_FARM,
  },
  water_purifier: {
    w: 3, h: 3,
    doorSide: "south",
    interiorTemplateId: "purifier_stub",
    wallSpriteId: SPRITES.COLONY_WALL_PURIFIER,
  },
  habitat_module: {
    w: 4, h: 4,
    doorSide: "south",
    interiorTemplateId: "habitat_stub",
    wallSpriteId: SPRITES.COLONY_WALL_HABITAT,
  },
  mine: {
    w: 3, h: 3,
    doorSide: "south",
    interiorTemplateId: "mine_stub",
    // Dedicated mine wall (blasted rock in a bolted steel frame, dim orange
    // work-lamp strip) — generated 2026-07-13 via the pilot pipeline, 512²
    // pow2 per the texture registry's mask requirement.
    wallSpriteId: SPRITES.COLONY_WALL_MINE,
  },
  cantina: {
    w: 4, h: 4,
    doorSide: "south",
    interiorTemplateId: "cantina",
    wallSpriteId: SPRITES.COLONY_WALL_CANTINA,
  },
};

/**
 * Stub interior templates, one per Phase 1 building type.
 * Each ~6×6 tiles, 1 thematic prop, exit door at south edge.
 * Player spawns ON the exit door facing north (into the room) so
 * immediate re-press of interact would exit.
 */
export const INTERIOR_TEMPLATES: Record<InteriorTemplateId, InteriorTemplate> = {
  solar_array_stub: {
    width: 6, height: 6,
    tiles: [
      "######",
      "#....#",
      "#....#",
      "#.C..#",   // C = control panel prop (see propSlots)
      "#....#",
      "##D###",   // D = exit door
    ],
    propSlots: [{ x: 2, y: 3, spriteId: SPRITES.INTERIOR_SOLAR_PANEL, scale: 1.0 }],
    spawn: { x: 2, y: 5, facing: "north" },
  },
  farm_stub: {
    width: 6, height: 6,
    tiles: [
      "######",
      "#....#",
      "#.E..#",   // E = equipment crate
      "#....#",
      "#....#",
      "##D###",
    ],
    propSlots: [{ x: 2, y: 2, spriteId: SPRITES.INTERIOR_FARM_CRATE, scale: 1.0 }],
    spawn: { x: 2, y: 5, facing: "north" },
  },
  purifier_stub: {
    width: 6, height: 6,
    tiles: [
      "######",
      "#....#",
      "#..P.#",
      "#..P.#",   // P = pump machinery (single prop, occupies visual space)
      "#....#",
      "##D###",
    ],
    propSlots: [{ x: 3, y: 2, spriteId: SPRITES.INTERIOR_PURIFIER_PUMP, scale: 1.2 }],
    spawn: { x: 2, y: 5, facing: "north" },
  },
  habitat_stub: {
    width: 6, height: 6,
    tiles: [
      "######",
      "#B..B#",
      "#....#",
      "#....#",
      "#B..B#",
      "##D###",
    ],
    propSlots: [
      { x: 1, y: 1, spriteId: SPRITES.INTERIOR_BUNK, scale: 1.0 },
      { x: 4, y: 1, spriteId: SPRITES.INTERIOR_BUNK, scale: 1.0 },
      { x: 1, y: 4, spriteId: SPRITES.INTERIOR_BUNK, scale: 1.0 },
      { x: 4, y: 4, spriteId: SPRITES.INTERIOR_BUNK, scale: 1.0 },
    ],
    spawn: { x: 2, y: 5, facing: "north" },
  },
  mine_stub: {
    width: 6, height: 6,
    tiles: [
      "######",
      "#....#",
      "#.R..#",   // R = extraction rig (reuses the purifier pump sprite — no new PNG)
      "#....#",
      "#....#",
      "##D###",
    ],
    propSlots: [{ x: 2, y: 2, spriteId: SPRITES.INTERIOR_PURIFIER_PUMP, scale: 1.2 }],
    spawn: { x: 2, y: 5, facing: "north" },
  },
  cantina: {
    width: 12, height: 10,
    tiles: [
      "############",
      "#.B..#.....#",
      "#....#.....#",
      "#...C......#",
      "#..........#",
      "#..T....R..#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#####D######",
    ],
    propSlots: [
      { x: 2, y: 1, spriteId: SPRITES.HUB_CANTINA_PROP_BOTTLE_RACK, scale: 1.0 },
      { x: 4, y: 3, spriteId: SPRITES.HUB_CANTINA_PROP_BAR_COUNTER, scale: 1.4 },
      { x: 3, y: 5, spriteId: SPRITES.HUB_CANTINA_PROP_TABLE_CLUSTER, scale: 1.2 },
      { x: 8, y: 5, spriteId: SPRITES.HUB_CANTINA_PROP_RUMOR_TERMINAL, scale: 1.0 },
    ],
    spawn: { x: 5, y: 9, facing: "north" },
    environmentArt: {
      wallSpriteId: SPRITES.HUB_CANTINA_WALL,
      floorSpriteId: SPRITES.HUB_CANTINA_FLOOR,
      ceilingSpriteId: SPRITES.HUB_CANTINA_CEILING,
    },
    npcSlots: [
      {
        contentId: "hub-bartender",
        schedule: [
          { startHour: 6, anchor: { x: 3, y: 2 } },
          { startHour: 18, anchor: { x: 3, y: 1 } },
        ],
      },
      {
        contentId: "hub-regular",
        schedule: [
          { startHour: 6, anchor: { x: 4, y: 6 } },
          { startHour: 18, anchor: { x: 6, y: 4 } },
        ],
      },
      {
        contentId: "hub-signal-chaser",
        schedule: [
          { startHour: 6, anchor: { x: 9, y: 5 } },
          { startHour: 18, anchor: null },
        ],
      },
    ],
  },
};

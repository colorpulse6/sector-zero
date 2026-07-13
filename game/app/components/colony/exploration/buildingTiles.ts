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

export interface InteriorTemplate {
  width: number;
  height: number;
  /** Each string is one row. '#' wall, '.' floor, 'D' exit door, other chars are prop placeholders. */
  tiles: string[];
  propSlots: PropSlot[];
  spawn: { x: number; y: number; facing: "north" | "south" | "east" | "west" };
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
};

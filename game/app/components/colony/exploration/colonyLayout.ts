import type {
  ColonyState,
  ColonyBuilding,
  BuildingInstanceId,
  BuildingType,
  GameClock,
  ColonyId,
} from "../shared/colonyTypes";
import type { FirstPersonState, BoardingTileType, BoardingMap } from "../../engine/types";
import { SPRITES } from "../../engine/sprites";
import { OUTPOST_TEMPLATE, type Slot, type SlotId } from "./outpostTemplate";
import { BUILDING_FOOTPRINTS, INTERIOR_TEMPLATES } from "./buildingTiles";
import { tintForHour } from "./dayNightTint";
import type { ColonyContext, DoorInteractResult, LandingPadResult } from "./colonyContext";

// ─── Slot assignment ───────────────────────────────────────────────────

/**
 * Deterministic mapping: buildingId → slotId.
 * Uses colony.buildings insertion order (stable per reducer invariant),
 * rotated by layoutSeed % 6. Buildings past index 5 are silently skipped.
 */
export function assignSlots(colony: ColonyState): Map<BuildingInstanceId, SlotId> {
  const rotation = colony.layoutSeed % 6;
  const map = new Map<BuildingInstanceId, SlotId>();
  colony.buildings.slice(0, 6).forEach((b, i) => {
    map.set(b.id, ((rotation + i) % 6) as SlotId);
  });
  return map;
}

// ─── Tile writing helpers ──────────────────────────────────────────────

function blankMap(width: number, height: number): BoardingTileType[][] {
  const rows: BoardingTileType[][] = [];
  for (let y = 0; y < height; y++) {
    rows.push(new Array(width).fill("empty" as BoardingTileType));
  }
  return rows;
}

function fillFrame(tiles: BoardingTileType[][]): void {
  const h = tiles.length;
  const w = tiles[0].length;
  // Perimeter walls
  for (let x = 0; x < w; x++) {
    tiles[0][x] = "wall";
    tiles[h - 1][x] = "wall";
  }
  for (let y = 0; y < h; y++) {
    tiles[y][0] = "wall";
    tiles[y][w - 1] = "wall";
  }
  // Fill interior with floor (leave existing perimeter walls)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      tiles[y][x] = "floor";
    }
  }
}

function writeLandingPad(tiles: BoardingTileType[][]): void {
  const pad = OUTPOST_TEMPLATE.landingPad;
  for (let y = pad.y; y < pad.y + pad.h; y++) {
    for (let x = pad.x; x < pad.x + pad.w; x++) {
      // Pad is still walkable floor; rendering variation is via floor sprite override (Phase 2 deferred).
      tiles[y][x] = "floor";
    }
  }
}

function writeBuildingAt(
  tiles: BoardingTileType[][],
  building: ColonyBuilding,
  slot: Slot,
): void {
  const fp = BUILDING_FOOTPRINTS[building.type];
  if (!fp) return;  // unsupported building type — silently skip

  // For Phase 2: constructing → no tiles written (foundation rendered via floor-tile sprite variant, deferred).
  // Only operational/damaged/offline render walls. Destroyed renders rubble (no walls).
  if (building.status === "constructing" || building.status === "destroyed") {
    return;
  }

  // Write perimeter walls with a door on `fp.doorSide`
  const { w, h, doorSide } = fp;
  const x0 = slot.anchorX;
  const y0 = slot.anchorY;

  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const isPerimeter = dx === 0 || dx === w - 1 || dy === 0 || dy === h - 1;
      if (!isPerimeter) continue;
      tiles[y0 + dy][x0 + dx] = "wall";
    }
  }

  // Carve door (centered on the chosen side, at the perimeter)
  const doorX = doorSide === "east" ? x0 + w - 1
              : doorSide === "west" ? x0
              : x0 + Math.floor(w / 2);
  const doorY = doorSide === "south" ? y0 + h - 1
              : doorSide === "north" ? y0
              : y0 + Math.floor(h / 2);
  tiles[doorY][doorX] = "door";
}

// ─── Hook resolvers ────────────────────────────────────────────────────

export function findBuildingDoorAt(
  colony: ColonyState,
  slotMap: Map<BuildingInstanceId, SlotId>,
  tile: { x: number; y: number },
): ColonyBuilding | null {
  for (const [bid, sid] of slotMap) {
    const slot = OUTPOST_TEMPLATE.slots[sid];
    const building = colony.buildings.find(b => b.id === bid);
    if (!building) continue;
    const fp = BUILDING_FOOTPRINTS[building.type];
    if (!fp) continue;
    const doorX = fp.doorSide === "east" ? slot.anchorX + fp.w - 1
                : fp.doorSide === "west" ? slot.anchorX
                : slot.anchorX + Math.floor(fp.w / 2);
    const doorY = fp.doorSide === "south" ? slot.anchorY + fp.h - 1
                : fp.doorSide === "north" ? slot.anchorY
                : slot.anchorY + Math.floor(fp.h / 2);
    if (tile.x === doorX && tile.y === doorY) return building;
  }
  return null;
}

export function inPadRegion(tile: { x: number; y: number }): boolean {
  const p = OUTPOST_TEMPLATE.landingPad;
  return tile.x >= p.x && tile.x < p.x + p.w && tile.y >= p.y && tile.y < p.y + p.h;
}

// ─── Public API ────────────────────────────────────────────────────────

export function generateExteriorState(colony: ColonyState, gameClock: GameClock): FirstPersonState {
  const tiles = blankMap(OUTPOST_TEMPLATE.width, OUTPOST_TEMPLATE.height);
  fillFrame(tiles);
  writeLandingPad(tiles);

  const slotMap = assignSlots(colony);
  for (const [bid, sid] of slotMap) {
    const building = colony.buildings.find(b => b.id === bid);
    if (!building) continue;
    writeBuildingAt(tiles, building, OUTPOST_TEMPLATE.slots[sid]);
  }

  const colonyContext: ColonyContext = {
    colonyId: colony.id as ColonyId,
    mode: "exterior",
    interiorBuildingId: null,
    onDoorInteract: (standingOn, facingTile) => {
      const hit = findBuildingDoorAt(colony, slotMap, facingTile);
      if (!hit) return { kind: "no_door" };
      if (hit.status !== "operational") {
        return { kind: "locked", reason: `${hit.type} — ${hit.status}` };
      }
      return { kind: "enter_interior", buildingId: hit.id };
    },
    onLandingPadInteract: (standingOn) => {
      return inPadRegion(standingOn)
        ? { kind: "show_exit_menu" }
        : { kind: "not_on_pad" };
    },
  };

  const map: BoardingMap = {
    width: OUTPOST_TEMPLATE.width,
    height: OUTPOST_TEMPLATE.height,
    tileSize: 64,
    tiles,
  };

  const { spawn } = OUTPOST_TEMPLATE;
  return {
    map,
    posX: spawn.x + 0.5,
    posY: spawn.y + 0.5,
    dirX: 0,
    dirY: -1,
    planeX: 0.66,
    planeY: 0,
    moveSpeed: 0.06,
    rotSpeed: 0.04,
    goalReached: false,
    enemies: [],
    gunFireTimer: 0,
    gunCooldown: 0,
    npcs: [],
    dialogState: null,
    environmentArt: {
      // Reuse Ashfall sprites for Phase 2 (colony is on Ashfall).
      // getSprite prepends NEXT_PUBLIC_BASE_PATH — never hardcode /sector-zero/.
      skySprite: SPRITES.EXPLORE_OUTPOST_SKY,
      wallSprite: SPRITES.EXPLORE_OUTPOST_WALL_EXTERIOR,
      floorSprite: SPRITES.EXPLORE_OUTPOST_GROUND,
      environmentTint: tintForHour(gameClock.hour),
    },
    props: [],  // Phase 2 exterior props (plaza decor, scaffolding on constructing slots) — stub for now
    colonyContext,
    colonyInteractArmed: true,
    colonyInteractCooldownFrames: 0,
  };
}

export function generateInteriorState(building: ColonyBuilding, seed: number): FirstPersonState {
  const fp = BUILDING_FOOTPRINTS[building.type];
  if (!fp) throw new Error(`[colonyLayout] no footprint for building type ${building.type}`);
  const template = INTERIOR_TEMPLATES[fp.interiorTemplateId];
  if (!template) throw new Error(`[colonyLayout] no interior template ${fp.interiorTemplateId}`);

  // Convert template.tiles (string rows) into BoardingTileType[][]
  // '#' wall, '.' floor, 'D' door (exit), other chars (prop placeholders) = floor.
  const tiles: BoardingTileType[][] = template.tiles.map(row =>
    [...row].map(c =>
      c === "#" ? ("wall" as BoardingTileType)
      : c === "D" ? ("door" as BoardingTileType)
      : ("floor" as BoardingTileType)
    )
  );

  // Find exit door coord (the single 'D' in the template)
  let exitX = 0, exitY = 0;
  for (let y = 0; y < template.height; y++) {
    for (let x = 0; x < template.width; x++) {
      if (template.tiles[y][x] === "D") { exitX = x; exitY = y; }
    }
  }

  const colonyContext: ColonyContext = {
    colonyId: "" as ColonyId,  // orchestrator fills from SceneStack context
    mode: "interior",
    interiorBuildingId: building.id,
    onDoorInteract: (standingOn, _facingTile) => {
      if (standingOn.x === exitX && standingOn.y === exitY) {
        return { kind: "exit_interior" };
      }
      return { kind: "no_door" };
    },
    onLandingPadInteract: (_standingOn) => ({ kind: "not_on_pad" }),
  };

  // Convert propSlots to engine FPProp billboards
  const props = template.propSlots.map((p, i) => ({
    id: i,
    x: p.x + 0.5,
    y: p.y + 0.5,
    sprite: p.spriteId,
    scale: p.scale,
  }));

  return {
    map: {
      width: template.width,
      height: template.height,
      tileSize: 64,
      tiles,
    },
    posX: template.spawn.x + 0.5,
    posY: template.spawn.y + 0.5,
    dirX: 0, dirY: -1,  // facing north per spec
    planeX: 0.66, planeY: 0,
    moveSpeed: 0.06,
    rotSpeed: 0.04,
    goalReached: false,
    enemies: [],
    gunFireTimer: 0,
    gunCooldown: 0,
    npcs: [],
    dialogState: null,
    environmentArt: {
      // Interior: neutral lighting, no tint (Phase 2 decision)
      skySprite: SPRITES.EXPLORE_OUTPOST_SKY,
      wallSprite: SPRITES.EXPLORE_OUTPOST_WALL_INTERIOR,
      floorSprite: SPRITES.EXPLORE_OUTPOST_FLOOR_METAL,
    },
    props,
    colonyContext,
    colonyInteractArmed: false,   // orchestrator just swapped in; require key release before fire
    colonyInteractCooldownFrames: 15,  // 250ms cooldown
  };
}

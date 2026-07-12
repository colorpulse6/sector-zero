import type { TileMap, TileType } from "./types";

export const GRAVITY = 0.5;
export const JUMP_VELOCITY = -10;
export const MAX_FALL_SPEED = 12;
export const GROUND_TILE_SIZE = 32;

export function getTileAt(map: TileMap, worldX: number, worldY: number): TileType {
  const col = Math.floor(worldX / map.tileSize);
  const row = Math.floor(worldY / map.tileSize);
  if (row < 0 || row >= map.height || col < 0 || col >= map.width) return "empty";
  return map.tiles[row][col];
}

/** Check if a rectangle collides with any solid tile (NOT platforms — they are one-way). */
export function collidesWithSolid(
  map: TileMap,
  x: number,
  y: number,
  width: number,
  height: number
): boolean {
  const left = Math.floor(x / map.tileSize);
  const right = Math.floor((x + width - 1) / map.tileSize);
  const top = Math.floor(y / map.tileSize);
  const bottom = Math.floor((y + height - 1) / map.tileSize);

  for (let row = top; row <= bottom; row++) {
    for (let col = left; col <= right; col++) {
      if (row < 0 || row >= map.height || col < 0 || col >= map.width) continue;
      if (map.tiles[row][col] === "solid") return true;
    }
  }
  return false;
}

/** Apply gravity and resolve vertical collision. Platforms only block from above.
 *
 *  Semi-implicit (symplectic) Euler with delta-time scaling: accelerate by
 *  GRAVITY*dtF, then integrate position by newVY*dtF. MAX_FALL_SPEED is a
 *  terminal-velocity cap in px per 16.67ms and is deliberately NOT scaled by
 *  dtF (it bounds velocity, not the per-frame step). At dtF=1 this is
 *  bit-identical to the original (GRAVITY*1, newVY*1), so 60fps behavior,
 *  golden frames, and colony tests are all unchanged.
 *
 *  TUNNELING: at the dtF=3 clamp (<=20fps) the fall step reaches
 *  MAX_FALL_SPEED*3 = 36px, larger than the 32px tile, so a destination-only
 *  check could skip an entire tile row in one step. The falling branch
 *  therefore SWEEPS every row the feet crossed this step (old feet row → new
 *  feet row) and lands on the first solid/platform row found. This is not a
 *  position clamp (which would reintroduce frame-rate dependence in the fall
 *  distance) — it just makes the collision test cover the whole travel path,
 *  so one-tile-thick floors (incl. the world floor with void below — falling
 *  past it was an unrecoverable soft-lock) catch at any frame rate.
 */
export function applyGravity(
  map: TileMap,
  x: number,
  y: number,
  vy: number,
  width: number,
  height: number,
  dtF: number = 1
): { y: number; vy: number; onGround: boolean } {
  let newVY = Math.min(vy + GRAVITY * dtF, MAX_FALL_SPEED);
  let newY = y + newVY * dtF;
  let onGround = false;

  if (newVY > 0) {
    // Falling — sweep every tile row the feet crossed this step (see TUNNELING
    // note above); land on the first solid/platform row.
    const left = Math.floor(x / map.tileSize);
    const right = Math.floor((x + width - 1) / map.tileSize);
    const startRow = Math.max(0, Math.floor((y + height) / map.tileSize));
    const endRow = Math.floor((newY + height) / map.tileSize);

    for (let tileRow = startRow; tileRow <= endRow && !onGround; tileRow++) {
      if (tileRow >= map.height) break;
      for (let col = left; col <= right; col++) {
        if (col < 0 || col >= map.width) continue;
        const tile = map.tiles[tileRow][col];
        if (tile === "solid" || tile === "platform") {
          newY = tileRow * map.tileSize - height;
          newVY = 0;
          onGround = true;
          break;
        }
      }
    }
  } else if (newVY < 0) {
    // Rising — only solid tiles block (platforms are one-way, can jump through)
    const headY = newY;
    const left = Math.floor(x / map.tileSize);
    const right = Math.floor((x + width - 1) / map.tileSize);
    const tileRow = Math.floor(headY / map.tileSize);

    for (let col = left; col <= right; col++) {
      if (col < 0 || col >= map.width || tileRow < 0 || tileRow >= map.height) continue;
      if (map.tiles[tileRow][col] === "solid") {
        newY = (tileRow + 1) * map.tileSize;
        newVY = 0;
        break;
      }
    }
  }

  return { y: newY, vy: newVY, onGround };
}

/** Resolve horizontal collision (only solid tiles block). */
export function resolveHorizontal(
  map: TileMap,
  x: number,
  y: number,
  vx: number,
  width: number,
  height: number
): number {
  const newX = x + vx;
  const checkX = vx > 0 ? newX + width - 1 : newX;
  const top = Math.floor(y / map.tileSize);
  const bottom = Math.floor((y + height - 1) / map.tileSize);

  for (let row = top; row <= bottom; row++) {
    const col = Math.floor(checkX / map.tileSize);
    if (row < 0 || row >= map.height || col < 0 || col >= map.width) continue;
    if (map.tiles[row][col] === "solid") {
      if (vx > 0) {
        return col * map.tileSize - width;
      } else {
        return (col + 1) * map.tileSize;
      }
    }
  }

  return Math.max(0, Math.min(newX, map.width * map.tileSize - width));
}

export function __runGroundPhysicsSelfTests(): void {
  const testMap: TileMap = {
    width: 5,
    height: 5,
    tileSize: 32,
    tiles: [
      ["empty", "empty", "empty", "empty", "empty"],
      ["empty", "empty", "empty", "empty", "empty"],
      ["empty", "empty", "solid", "empty", "empty"],
      ["empty", "empty", "empty", "empty", "empty"],
      ["solid", "solid", "solid", "solid", "solid"],
    ],
  };

  console.assert(getTileAt(testMap, 0, 128) === "solid", "Bottom-left is solid");
  console.assert(getTileAt(testMap, 0, 0) === "empty", "Top-left is empty");
  console.assert(getTileAt(testMap, 64, 64) === "solid", "Middle tile is solid");
  console.assert(getTileAt(testMap, -10, 0) === "empty", "Out of bounds is empty");
  console.assert(collidesWithSolid(testMap, 0, 120, 16, 16), "Should collide with bottom row");
  console.assert(!collidesWithSolid(testMap, 0, 0, 16, 16), "Should not collide at top-left");
}

if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
  __runGroundPhysicsSelfTests();
}

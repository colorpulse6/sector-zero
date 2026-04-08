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

/** Apply gravity and resolve vertical collision. Platforms only block from above. */
export function applyGravity(
  map: TileMap,
  x: number,
  y: number,
  vy: number,
  width: number,
  height: number
): { y: number; vy: number; onGround: boolean } {
  let newVY = Math.min(vy + GRAVITY, MAX_FALL_SPEED);
  let newY = y + newVY;
  let onGround = false;

  if (newVY > 0) {
    // Falling — check ground collision (solid AND platform block from above)
    const feetY = newY + height;
    const left = Math.floor(x / map.tileSize);
    const right = Math.floor((x + width - 1) / map.tileSize);
    const tileRow = Math.floor(feetY / map.tileSize);

    for (let col = left; col <= right; col++) {
      if (col < 0 || col >= map.width || tileRow < 0 || tileRow >= map.height) continue;
      const tile = map.tiles[tileRow][col];
      if (tile === "solid" || tile === "platform") {
        newY = tileRow * map.tileSize - height;
        newVY = 0;
        onGround = true;
        break;
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

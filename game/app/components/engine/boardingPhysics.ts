import type { BoardingMap, BoardingTileType } from "./types";

export const BOARDING_TILE_SIZE = 32;

/** Get the tile at a world-pixel position. */
export function getTile(map: BoardingMap, worldX: number, worldY: number): BoardingTileType {
  const col = Math.floor(worldX / map.tileSize);
  const row = Math.floor(worldY / map.tileSize);
  if (row < 0 || row >= map.height || col < 0 || col >= map.width) return "wall";
  return map.tiles[row][col];
}

/** Check if a tile blocks movement. */
function isSolid(tile: BoardingTileType): boolean {
  return tile === "wall" || tile === "empty";
}

/** Resolve movement with wall collision. Returns clamped position. */
export function resolveMovement(
  map: BoardingMap,
  x: number,
  y: number,
  vx: number,
  vy: number,
  width: number,
  height: number
): { x: number; y: number } {
  // Resolve X first, then Y (avoids corner-sticking)
  let newX = x + vx;
  let newY = y + vy;

  // Horizontal check
  if (vx !== 0) {
    const checkX = vx > 0 ? newX + width - 1 : newX;
    const topRow = Math.floor(y / map.tileSize);
    const botRow = Math.floor((y + height - 1) / map.tileSize);
    const col = Math.floor(checkX / map.tileSize);

    for (let row = topRow; row <= botRow; row++) {
      if (row < 0 || row >= map.height || col < 0 || col >= map.width) continue;
      if (isSolid(map.tiles[row][col])) {
        newX = vx > 0
          ? col * map.tileSize - width
          : (col + 1) * map.tileSize;
        break;
      }
    }
  }

  // Vertical check
  if (vy !== 0) {
    const checkY = vy > 0 ? newY + height - 1 : newY;
    const leftCol = Math.floor(newX / map.tileSize);
    const rightCol = Math.floor((newX + width - 1) / map.tileSize);
    const row = Math.floor(checkY / map.tileSize);

    for (let col = leftCol; col <= rightCol; col++) {
      if (row < 0 || row >= map.height || col < 0 || col >= map.width) continue;
      if (isSolid(map.tiles[row][col])) {
        newY = vy > 0
          ? row * map.tileSize - height
          : (row + 1) * map.tileSize;
        break;
      }
    }
  }

  // Clamp to map bounds
  newX = Math.max(0, Math.min(newX, map.width * map.tileSize - width));
  newY = Math.max(0, Math.min(newY, map.height * map.tileSize - height));

  return { x: newX, y: newY };
}

/** Check line-of-sight between two points (for enemy aggro). */
export function hasLineOfSight(
  map: BoardingMap,
  x1: number, y1: number,
  x2: number, y2: number
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.ceil(dist / (map.tileSize / 2));

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = x1 + dx * t;
    const py = y1 + dy * t;
    if (isSolid(getTile(map, px, py))) return false;
  }
  return true;
}

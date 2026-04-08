import type { BoardingMap, BoardingTileType } from "./types";

/**
 * DDA Raycaster — casts a single ray through the tile map.
 * Returns the distance to the first wall hit, which side was hit,
 * and the exact position on the wall (for texture mapping).
 *
 * Based on the classic Wolfenstein 3D / lodev raycasting tutorial.
 */

export interface RayHit {
  distance: number;      // Perpendicular distance (avoids fisheye)
  side: 0 | 1;          // 0 = vertical wall (N/S), 1 = horizontal wall (E/W)
  wallX: number;         // Exact hit position on the wall (0-1, for texture U coord)
  tileType: BoardingTileType;
  mapX: number;
  mapY: number;
}

function isWall(tile: BoardingTileType): boolean {
  return tile === "wall" || tile === "empty";
}

/**
 * Cast a single ray from position (posX, posY) in direction (rayDirX, rayDirY).
 * Uses DDA (Digital Differential Analyzer) algorithm for fast grid traversal.
 */
export function castRay(
  map: BoardingMap,
  posX: number,
  posY: number,
  rayDirX: number,
  rayDirY: number
): RayHit | null {
  // Which grid cell we're in
  let mapX = Math.floor(posX);
  let mapY = Math.floor(posY);

  // Length of ray from one x/y side to next
  const deltaDistX = Math.abs(rayDirX) < 1e-10 ? 1e10 : Math.abs(1 / rayDirX);
  const deltaDistY = Math.abs(rayDirY) < 1e-10 ? 1e10 : Math.abs(1 / rayDirY);

  // Step direction and initial side distance
  let stepX: number;
  let stepY: number;
  let sideDistX: number;
  let sideDistY: number;

  if (rayDirX < 0) {
    stepX = -1;
    sideDistX = (posX - mapX) * deltaDistX;
  } else {
    stepX = 1;
    sideDistX = (mapX + 1 - posX) * deltaDistX;
  }

  if (rayDirY < 0) {
    stepY = -1;
    sideDistY = (posY - mapY) * deltaDistY;
  } else {
    stepY = 1;
    sideDistY = (mapY + 1 - posY) * deltaDistY;
  }

  // DDA loop
  let side: 0 | 1 = 0;
  const maxSteps = 64; // prevent infinite loop

  for (let i = 0; i < maxSteps; i++) {
    // Jump to next map square
    if (sideDistX < sideDistY) {
      sideDistX += deltaDistX;
      mapX += stepX;
      side = 0;
    } else {
      sideDistY += deltaDistY;
      mapY += stepY;
      side = 1;
    }

    // Check bounds
    if (mapX < 0 || mapX >= map.width || mapY < 0 || mapY >= map.height) {
      return null; // Ray went out of map
    }

    // Check if ray hit a wall
    const tile = map.tiles[mapY][mapX];
    if (isWall(tile)) {
      // Calculate perpendicular distance (avoids fisheye effect)
      let perpDist: number;
      if (side === 0) {
        perpDist = (mapX - posX + (1 - stepX) / 2) / rayDirX;
      } else {
        perpDist = (mapY - posY + (1 - stepY) / 2) / rayDirY;
      }

      // Calculate where exactly the wall was hit (for texturing)
      let wallX: number;
      if (side === 0) {
        wallX = posY + perpDist * rayDirY;
      } else {
        wallX = posX + perpDist * rayDirX;
      }
      wallX -= Math.floor(wallX); // Get fractional part (0-1)

      return {
        distance: Math.max(0.01, perpDist), // Clamp to avoid division by zero
        side,
        wallX,
        tileType: tile,
        mapX,
        mapY,
      };
    }
  }

  return null; // No wall hit within max distance
}

/**
 * Cast all rays for the screen.
 * Returns an array of RayHit (one per screen column).
 */
export function castAllRays(
  map: BoardingMap,
  posX: number,
  posY: number,
  dirX: number,
  dirY: number,
  planeX: number,
  planeY: number,
  screenWidth: number
): (RayHit | null)[] {
  const hits: (RayHit | null)[] = new Array(screenWidth);

  for (let x = 0; x < screenWidth; x++) {
    // Calculate ray direction for this column
    const cameraX = 2 * x / screenWidth - 1; // -1 (left) to +1 (right)
    const rayDirX = dirX + planeX * cameraX;
    const rayDirY = dirY + planeY * cameraX;

    hits[x] = castRay(map, posX, posY, rayDirX, rayDirY);
  }

  return hits;
}

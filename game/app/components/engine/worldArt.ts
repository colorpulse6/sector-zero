import type { BoardingMap, FPEnvironmentArt, FPProp } from "./types";
import { SPRITES } from "./sprites";

/** Decorative dressing shares the live map; it never changes collision or objectives. */
export function createCombatDressing(map: BoardingMap, theme: "station" | "ruin"):
  { environmentArt: FPEnvironmentArt; props: FPProp[] } {
  const ruin = theme === "ruin";
  const environmentArt: FPEnvironmentArt = ruin ? {
    wallSprite: SPRITES.WORLD_RUIN_WALL,
    floorSprite: SPRITES.WORLD_RUIN_FLOOR,
    ceilingSprite: SPRITES.WORLD_RUIN_CEILING,
  } : {
    wallSprite: SPRITES.WORLD_STATION_WALL,
    floorSprite: SPRITES.WORLD_STATION_FLOOR,
    ceilingSprite: SPRITES.WORLD_STATION_CEILING,
  };
  const props: FPProp[] = [];
  for (let y = 2; y < map.height - 2 && props.length < 4; y++) {
    for (let x = 2; x < map.width - 2 && props.length < 4; x++) {
      if (map.tiles[y][x] !== "floor") continue;
      const neighbors = [map.tiles[y - 1][x], map.tiles[y + 1][x], map.tiles[y][x - 1], map.tiles[y][x + 1]];
      // Keep door approaches and single-tile corridors visually clear.
      if (neighbors.some(tile => tile === "door" || tile === "spawn" || tile === "goal")) continue;
      const northWall = neighbors[0] === "wall", westWall = neighbors[2] === "wall";
      if (!northWall || !westWall || neighbors[1] === "wall" || neighbors[3] === "wall") continue;
      if (props.some(prop => Math.hypot(prop.x - x, prop.y - y) < 4)) continue;
      const primary = props.length % 2 === 0;
      props.push({ id: -200 - props.length, x: x + 0.3, y: y + 0.3,
        sprite: primary ? (ruin ? SPRITES.WORLD_RUIN_COLUMN : SPRITES.WORLD_STATION_CONSOLE) : SPRITES.WORLD_SUPPLY_CANISTERS,
        scale: primary ? 0.85 : 0.55, label: primary ? (ruin ? "RELAY REMNANT" : "STATION CONTROL") : "SUPPLIES" });
    }
  }
  return { environmentArt, props };
}

import type { FirstPersonState } from "./types";

/** Shared by the prompt and action: near, in front and unobstructed. */
export function getObjectiveInteraction(fp: FirstPersonState): FirstPersonState["objectivePickup"] | null {
  const target = fp.objectivePickup;
  if (!target || fp.objectiveCollected || fp.dialogState?.active || fp.colonyContext) return null;
  const dx = target.x - fp.posX, dy = target.y - fp.posY;
  const distance = Math.hypot(dx, dy);
  if (distance > 1.25 || (distance > 0.25 && dx * fp.dirX + dy * fp.dirY <= 0)) return null;
  // Segment/solid-tile intersection also blocks narrow corner crossings.
  for (let y = Math.floor(Math.min(fp.posY, target.y)); y <= Math.floor(Math.max(fp.posY, target.y)); y++) {
    for (let x = Math.floor(Math.min(fp.posX, target.x)); x <= Math.floor(Math.max(fp.posX, target.x)); x++) {
      const tile = fp.map.tiles[y]?.[x];
      if (tile !== undefined && tile !== "wall" && tile !== "empty") continue;
      let near = 0, far = 1;
      for (const [origin, delta, min] of [[fp.posX, dx, x], [fp.posY, dy, y]]) {
        if (delta === 0) { if (origin < min || origin > min + 1) { near = 2; break; } }
        else {
          const a = (min - origin) / delta, b = (min + 1 - origin) / delta;
          near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
        }
      }
      if (near <= far) return null;
    }
  }
  return target;
}

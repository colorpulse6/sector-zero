// The colony sidecar owns movement and animation time. Entry-hour paths remain
// fixed for the visit; after arrival actors pause and make a short local walk.
// Both sidecar and persistent FPNPC objects freeze during dialogue/shop.

import type { BoardingMap, FPNPC } from "../../../engine/types";
import type { ColonyNpc } from "./types";
import { findPath } from "./npcPathfind";
import { stepQuartermasterMotion } from "./quartermasterMotion";
import { initializeNpcPresentation, stepNpcPresentation } from "../../../engine/actorPresentation";

const NPC_WALK_SPEED = 0.03;   // tiles per frame at 60fps (dtF = 1)
const ARRIVE_EPSILON = 0.02;   // snap distance to a waypoint center
const LOCAL_RADIUS = 0.3;

function isWalkable(map: BoardingMap, x: number, y: number): boolean {
  const tx = Math.floor(x), ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return false;
  const t = map.tiles[ty][tx];
  return t === "floor" || t === "door";
}

function stepLocalMotion(npc: ColonyNpc, map: BoardingMap, dtMs: number, dtF: number): void {
  if (!npc.localMotion) {
    const angle = (npc.millSeed % 8) * Math.PI / 4;
    let awayX = npc.posX, awayY = npc.posY;
    for (let i = 0; i < 8; i++) {
      const heading = angle + i * Math.PI / 4;
      const x = npc.posX + Math.cos(heading) * LOCAL_RADIUS;
      const y = npc.posY + Math.sin(heading) * LOCAL_RADIUS;
      if (isWalkable(map, x, y) && !map.landingPadTiles?.has(`${Math.floor(x)},${Math.floor(y)}`)) { awayX = x; awayY = y; break; }
    }
    npc.localMotion = { phase: "pause", remainingMs: 1800 + Math.abs(npc.millSeed % 900), anchorX: npc.posX, anchorY: npc.posY, awayX, awayY };
  }
  const motion = npc.localMotion;
  if (motion.phase === "pause" || motion.phase === "awayPause") {
    motion.remainingMs -= dtMs;
    if (motion.remainingMs <= 0) motion.phase = motion.phase === "pause" ? "outbound" : "return";
    return;
  }
  const targetX = motion.phase === "outbound" ? motion.awayX : motion.anchorX;
  const targetY = motion.phase === "outbound" ? motion.awayY : motion.anchorY;
  const dx = targetX - npc.posX, dy = targetY - npc.posY, distance = Math.hypot(dx, dy);
  const step = Math.min(distance, NPC_WALK_SPEED * dtF);
  const x = distance > 1e-8 ? npc.posX + dx / distance * step : npc.posX;
  const y = distance > 1e-8 ? npc.posY + dy / distance * step : npc.posY;
  const canMove = isWalkable(map, x, y);
  if (canMove) { npc.posX = x; npc.posY = y; }
  if (distance <= step + 1e-8 || !canMove) {
    motion.phase = motion.phase === "outbound" ? "awayPause" : "pause";
    motion.remainingMs = motion.phase === "pause" ? 1800 + Math.abs(npc.millSeed % 900) : 1400;
  }
}

/**
 * Step every NPC one frame in place. `sidecar[i]` and `fpNpcs[i]` are index-paired
 * (built together in generateColonyNpcs, sharing an id); the engine never reorders
 * fp.npcs, so index pairing stays valid for the visit.
 */
export function stepColonyNpcs(
  sidecar: ColonyNpc[],
  fpNpcs: FPNPC[],            // the SAME persistent FPNPC objects generation created
  map: BoardingMap,
  dtMs: number,
  dialogActive: boolean,
): void {
  // Freeze the whole plaza while the player is in dialog/shop.
  if (dialogActive) return;

  const dt = Number.isFinite(dtMs) ? Math.max(0, Math.min(dtMs, 50.01)) : 0;
  if (dt === 0) return;
  const dtF = dt / 16.67;

  for (let i = 0; i < sidecar.length; i++) {
    const npc = sidecar[i];
    const fp = fpNpcs[i];
    if (fp) { initializeNpcPresentation(fp); fp.atlasClockOwner = "colony"; }
    const beforeX = npc.posX, beforeY = npc.posY;
    if (npc.kind === "quartermaster" && fpNpcs[i]?.atlasAnimation) {
      stepQuartermasterMotion(npc, fpNpcs[i], map, dtMs);
      continue;
    }

    // 1. Compute the path once (fixed entry-hour target).
    if (!npc.pathComputed) {
      npc.path = findPath(
        map,
        { x: Math.floor(npc.posX), y: Math.floor(npc.posY) },
        npc.targetTile,
      );
      npc.pathComputed = true;
    }

    if (npc.path.length > 0) {
      // 2. Advance toward the next waypoint's center.
      const wp = npc.path[0];
      const cx = wp.x + 0.5, cy = wp.y + 0.5;
      const dx = cx - npc.posX, dy = cy - npc.posY;
      const dist = Math.hypot(dx, dy);
      const step = NPC_WALK_SPEED * dtF;
      if (dist <= step + ARRIVE_EPSILON) {
        // Snap onto the waypoint and consume it.
        npc.posX = cx;
        npc.posY = cy;
        npc.path.shift();
      } else {
        npc.posX += (dx / dist) * step;
        npc.posY += (dy / dist) * step;
      }
    } else {
      stepLocalMotion(npc, map, dt, dtF);
    }

    // Mutate the paired persistent object; dialogue binds to this identity.
    if (fp) {
      fp.x = npc.posX;
      fp.y = npc.posY;
      const dx = npc.posX - beforeX, dy = npc.posY - beforeY;
      fp.isMoving = Math.hypot(dx, dy) > 1e-8;
      stepNpcPresentation(fp, dx, dy, dt);
      fp.animClockMs = (fp.animClockMs ?? 0) + dtMs;
    }
  }
}

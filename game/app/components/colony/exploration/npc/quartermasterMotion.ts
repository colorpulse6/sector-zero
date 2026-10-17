import type { BoardingMap, FPNPC } from "../../../engine/types";
import type { NpcAction } from "../../../engine/fpRender/npcAtlas";
import type { ColonyNpc, Tile } from "./types";
import { findPath } from "./npcPathfind";

export interface QuartermasterMotion {
  phase: "work" | "idle" | "outbound" | "pause" | "return";
  remainingMs: number;
  anchor: { x: number; y: number };
  away: { x: number; y: number } | null;
  canWork: boolean;
}

function walkable(map: BoardingMap, x: number, y: number): boolean {
  const tile = map.tiles[Math.floor(y)]?.[Math.floor(x)];
  return tile === "floor" || tile === "door";
}

// A short inspection walk stays adjacent to the station and off the pad.
function nearbyStationTile(map: BoardingMap, x: number, y: number) {
  for (const [dx, dy] of [[-1, 0], [0, -1], [1, 0], [0, 1]]) {
    const tx = Math.floor(x) + dx, ty = Math.floor(y) + dy;
    if (map.tiles[ty]?.[tx] === "floor" && !map.landingPadTiles?.has(`${tx},${ty}`)) {
      return { x: tx + 0.5, y: ty + 0.5 };
    }
  }
  return null;
}

function approach(npc: ColonyNpc, fp: FPNPC, map: BoardingMap, target: { x: number; y: number }, dt: number): boolean {
  const dx = target.x - npc.posX, dy = target.y - npc.posY;
  const distance = Math.hypot(dx, dy);
  if (distance < 1e-6) return true;
  const animation = fp.atlasAnimation!;
  const desired = Math.atan2(dy, dx);
  const delta = Math.atan2(Math.sin(desired - animation.facingAngle), Math.cos(desired - animation.facingAngle));
  const turn = Math.min(Math.abs(delta), dt * 0.004);
  animation.facingAngle += Math.sign(delta) * turn;
  if (Math.abs(delta) - turn > 0.08) return false;
  const step = Math.min(distance, dt * 0.0015);
  const x = npc.posX + dx / distance * step, y = npc.posY + dy / distance * step;
  if (!walkable(map, x, y)) return false;
  npc.posX = x; npc.posY = y;
  return distance <= step + 1e-6;
}

function atTile(npc: ColonyNpc, tile: Tile): boolean {
  return Math.hypot(npc.posX - tile.x - 0.5, npc.posY - tile.y - 0.5) < 0.05;
}

function simulateStep(npc: ColonyNpc, fp: FPNPC, map: BoardingMap, dt: number): void {
  const beforeX = npc.posX, beforeY = npc.posY;
  if (!npc.pathComputed) {
    npc.path = findPath(map, { x: Math.floor(npc.posX), y: Math.floor(npc.posY) }, npc.targetTile);
    npc.pathComputed = true;
  }
  if (npc.path.length > 0) {
    const waypoint = npc.path[0];
    if (approach(npc, fp, map, { x: waypoint.x + 0.5, y: waypoint.y + 0.5 }, dt)) npc.path.shift();
  } else {
    if (!npc.quartermasterMotion) {
      const canWork = !!npc.postTile && atTile(npc, npc.postTile) && atTile(npc, npc.targetTile);
      npc.quartermasterMotion = {
        phase: "work", remainingMs: 2600, anchor: { x: npc.posX, y: npc.posY },
        away: canWork ? nearbyStationTile(map, npc.posX, npc.posY) : null, canWork,
      };
    }
    const motion = npc.quartermasterMotion;
    if (motion.phase === "outbound" || motion.phase === "return") {
      const target = motion.phase === "outbound" ? motion.away! : motion.anchor;
      if (approach(npc, fp, map, target, dt)) {
        const wasReturning = motion.phase === "return";
        motion.phase = wasReturning ? "work" : "pause";
        motion.remainingMs = wasReturning ? 2600 : 1600;
      }
    } else {
      motion.remainingMs -= dt;
      if (motion.remainingMs <= 0) {
        if (motion.phase === "work") { motion.phase = "idle"; motion.remainingMs += 900; }
        else if (motion.phase === "idle") {
          motion.phase = motion.away ? "outbound" : "work";
          motion.remainingMs += 2600;
        } else motion.phase = "return";
      }
    }
  }
  const distance = Math.hypot(npc.posX - beforeX, npc.posY - beforeY);
  const animation = fp.atlasAnimation!;
  const action: NpcAction = distance > 1e-8 ? "walk"
    : npc.quartermasterMotion?.phase === "work" && npc.quartermasterMotion.canWork ? "work" : "idle";
  animation.clockMs = action === animation.action ? animation.clockMs + dt : dt;
  animation.action = action;
  animation.walkDistance += distance;
  fp.x = npc.posX; fp.y = npc.posY;
  fp.isMoving = distance > 1e-8;
  fp.animClockMs = (fp.animClockMs ?? 0) + dt;
}

/** Fixed, bounded substeps keep turns and state transitions identical across
 * display rates. The caller's dialogue freeze also preserves the remainder. */
export function stepQuartermasterMotion(npc: ColonyNpc, fp: FPNPC, map: BoardingMap, dtMs: number): void {
  const dt = Number.isFinite(dtMs) ? Math.max(0, Math.min(dtMs, 50)) : 0;
  if (!fp.atlasAnimation || dt === 0) return;
  const stepMs = 1000 / 120;
  const total = (npc.quartermasterStepRemainderMs ?? 0) + dt;
  const steps = Math.floor((total + 1e-7) / stepMs);
  npc.quartermasterStepRemainderMs = Math.max(0, total - steps * stepMs);
  for (let i = 0; i < steps; i++) simulateStep(npc, fp, map, stepMs);
}

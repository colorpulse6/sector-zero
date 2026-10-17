import { resolveNpcActorSet } from "./actorAssets";
import type { FirstPersonState, FPEnemy, FPNPC } from "./types";
import type { NpcAction } from "./fpRender/npcAtlas";

export interface EnemyPresentationState { previousX: number; previousY: number }
const elapsed = (dtMs: number) => Number.isFinite(dtMs) ? Math.max(0, Math.min(dtMs, 50.01)) : 0;
export function initializeNpcPresentation(npc: FPNPC, facingAngle = Math.PI / 2): void {
  if (npc.atlasAnimation) return;
  const set = resolveNpcActorSet(npc);
  if (set) npc.atlasAnimation = { set, facingAngle, action: "idle", clockMs: 0, walkDistance: 0 };
}
/** Idempotent entry hook. Also called by the universal FP updater so campaign,
 * developer conversion, colony, fixed NPCs and ruin constructors share it. */
export function initializeActorPresentation(fp: FirstPersonState): void {
  for (const npc of fp.npcs ?? []) initializeNpcPresentation(npc, Math.atan2(fp.posY - npc.y, fp.posX - npc.x));
  for (const enemy of fp.enemies) {
    enemy.atlasAnimation ??= {
      set: "hostile", facingAngle: Math.atan2(fp.posY - enemy.y, fp.posX - enemy.x),
      action: enemy.deathTimer > 0 ? "death" : "idle", clockMs: 0, walkDistance: 0,
    };
    enemy.actorPresentation ??= { previousX: enemy.x, previousY: enemy.y };
  }
}

export function stepNpcPresentation(npc: FPNPC, deltaX: number, deltaY: number, dtMs: number): void {
  const animation = npc.atlasAnimation;
  if (!animation) return;
  const distance = Math.hypot(deltaX, deltaY);
  const action = distance > 1e-8 ? "walk" : "idle";
  if (distance > 1e-8) animation.facingAngle = Math.atan2(deltaY, deltaX);
  animation.walkDistance += distance;
  animation.clockMs = action === animation.action ? animation.clockMs + elapsed(dtMs) : elapsed(dtMs);
  animation.action = action;
}
export function stepStationaryNpcPresentation(fp: FirstPersonState, dtMs: number): void {
  for (const npc of fp.npcs ?? []) if (npc.atlasClockOwner !== "colony") stepNpcPresentation(npc, 0, 0, dtMs);
}

/** Presentation events only: callers retain all hit, cooldown and reward logic. */
export function playEnemyAction(enemy: FPEnemy, action: "attack" | "hurt" | "death"): void {
  const animation = enemy.atlasAnimation;
  if (!animation || animation.action === "death") return;
  if (action === "attack" && animation.action === "hurt") return;
  animation.action = action;
  animation.clockMs = 0;
}
export function stepEnemyPresentation(enemy: FPEnemy, dtMs: number): void {
  const animation = enemy.atlasAnimation, previous = enemy.actorPresentation;
  if (!animation || !previous) return;
  const dx = enemy.x - previous.previousX, dy = enemy.y - previous.previousY;
  const distance = Math.hypot(dx, dy);
  previous.previousX = enemy.x; previous.previousY = enemy.y;
  if (distance > 1e-8) animation.facingAngle = Math.atan2(dy, dx);
  animation.walkDistance += distance;
  animation.clockMs += elapsed(dtMs);
  let action: NpcAction = animation.action;
  if (enemy.deathTimer !== 0) action = "death";
  else if (!(action === "hurt" && animation.clockMs < 180) && !(action === "attack" && animation.clockMs < 400)) action = distance > 1e-8 ? "walk" : "idle";
  if (action !== animation.action) { animation.action = action; animation.clockMs = 0; }
}

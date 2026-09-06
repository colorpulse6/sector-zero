import { ACTOR_CATALOG, QUARTERMASTER_ATLASES, type ActorAction, type ActorSetId } from "../actorAssets";
import { loadSprite } from "../sprites";
export { QUARTERMASTER_ATLASES } from "../actorAssets";
export type NpcAction = ActorAction;
export interface NpcAtlasAnimation {
  set: ActorSetId;
  facingAngle: number;
  action: NpcAction;
  clockMs: number;
  walkDistance: number;
}
export interface AtlasFrame { path: string; x: number; y: number; width: number; height: number }
export const QUARTERMASTER_WORKSTATION = "/sprites/pilot/quartermaster/workstation.png";
export const WALK_CYCLE_DISTANCE = 1.2;
// Metadata only: no image decode or extracted texel allocation. Every authored
// cell has one stable object, so render calls cannot advance an actor's clock.
const FRAMES = new Map<string, AtlasFrame[]>();
for (const asset of Object.values(ACTOR_CATALOG)) for (const clip of Object.values(asset.clips)) {
  FRAMES.set(clip.path, Array.from({ length: clip.columns * clip.rows }, (_, i) => ({
    path: clip.path, x: (i % clip.columns) * asset.width, y: Math.floor(i / clip.columns) * asset.height,
    width: asset.width, height: asset.height,
  })));
}
const nonnegative = (n: number) => Number.isFinite(n) ? Math.max(0, n) : 0;

/** Row zero faces the viewer; +Y map angles orbit toward the actor's right. */
export function selectNpcAtlasFrame(
  npc: { x: number; y: number; atlasAnimation?: NpcAtlasAnimation }, camX: number, camY: number,
): AtlasFrame | null {
  const animation = npc.atlasAnimation;
  if (!animation) return null;
  const asset = ACTOR_CATALOG[animation.set];
  const clip = asset?.clips[animation.action];
  if (!clip) return null;
  const relative = Math.atan2(camY - npc.y, camX - npc.x) - animation.facingAngle;
  const row = clip.rows === 1 ? 0 : ((Math.round(relative / (Math.PI / 4)) % 8) + 8) % 8;
  const phase = animation.action === "walk"
    ? nonnegative(animation.walkDistance) / WALK_CYCLE_DISTANCE * clip.columns
    : nonnegative(animation.clockMs) / clip.frameMs;
  const tick = Math.floor(phase + 1e-9);
  const column = clip.loop === false ? Math.min(tick, clip.columns - 1) : tick % clip.columns;
  return FRAMES.get(clip.path)![row * clip.columns + column];
}

/** Legacy pilot preview loader. Live scenes use actorAssets scene retention. */
export async function preloadQuartermasterAssets(): Promise<boolean> {
  if (typeof Image === "undefined") return false;
  const results = await Promise.allSettled(
    [...Object.values(QUARTERMASTER_ATLASES), QUARTERMASTER_WORKSTATION].map(loadSprite),
  );
  return results.every(result => result.status === "fulfilled");
}

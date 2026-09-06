export type NpcAction = "idle" | "walk" | "work";
export interface NpcAtlasAnimation {
  set: "quartermaster";
  facingAngle: number;
  action: NpcAction;
  clockMs: number;
  walkDistance: number;
}
export interface AtlasFrame { path: string; x: number; y: number; width: number; height: number }
export const QUARTERMASTER_ATLASES = {
  idle: "/sprites/pilot/quartermaster/idle.png",
  walk: "/sprites/pilot/quartermaster/walk.png",
  work: "/sprites/pilot/quartermaster/work.png",
};
export const QUARTERMASTER_WORKSTATION = "/sprites/pilot/quartermaster/workstation.png";
export const WALK_CYCLE_DISTANCE = 1.2;

const CLIPS = {
  idle: { columns: 4, frameMs: 300 },
  walk: { columns: 8, frameMs: 100 },
  work: { columns: 8, frameMs: 125 },
};
// These immutable selections are reused by the render path; the cache is
// bounded to the authored 160 cells, regardless of how long a visit lasts.
const FRAMES = Object.fromEntries(Object.entries(CLIPS).map(([clip, { columns }]) => [clip,
  Array.from({ length: columns * 8 }, (_, i) => ({
    path: QUARTERMASTER_ATLASES[clip as NpcAction],
    x: (i % columns) * 128, y: Math.floor(i / columns) * 256, width: 128, height: 256,
  })),
])) as Record<NpcAction, AtlasFrame[]>;

const nonnegative = (n: number) => Number.isFinite(n) ? Math.max(0, n) : 0;

/** Row zero looks at the actor's face. Positive map angles turn toward the
 * actor's right (map +Y is down), matching the Blender camera orbit. */
export function selectNpcAtlasFrame(
  npc: { x: number; y: number; atlasAnimation?: NpcAtlasAnimation }, camX: number, camY: number,
): AtlasFrame | null {
  const animation = npc.atlasAnimation;
  if (!animation || animation.set !== "quartermaster") return null;
  const clip = CLIPS[animation.action];
  const relative = Math.atan2(camY - npc.y, camX - npc.x) - animation.facingAngle;
  const row = ((Math.round(relative / (Math.PI / 4)) % 8) + 8) % 8;
  const phase = animation.action === "walk"
    ? nonnegative(animation.walkDistance) / WALK_CYCLE_DISTANCE * clip.columns
    : nonnegative(animation.clockMs) / clip.frameMs;
  return FRAMES[animation.action][row * clip.columns + Math.floor(phase + 1e-9) % clip.columns];
}

/** Called only on colony/preview entry. Failures keep the existing static
 * sprite; another entry can retry. Never starts an image request in Node. */
export async function preloadQuartermasterAssets(): Promise<boolean> {
  if (typeof Image === "undefined") return false;
  const results = await Promise.allSettled(
    [...Object.values(QUARTERMASTER_ATLASES), QUARTERMASTER_WORKSTATION].map(loadSprite),
  );
  return results.every(result => result.status === "fulfilled");
}
import { loadSprite } from "../sprites";

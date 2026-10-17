import { loadSprite, releaseSprite, SPRITES } from "./sprites";
import type { FirstPersonState } from "./types";

export type ActorAction = "idle" | "walk" | "work" | "attack" | "hurt" | "death";
export interface ActorClip { path: string; columns: number; rows: number; frameMs: number; loop?: boolean }
export interface ActorSet { width: number; height: number; clips: Partial<Record<ActorAction, ActorClip>> }
export const QUARTERMASTER_ATLASES = {
  idle: "/sprites/pilot/quartermaster/idle.png",
  walk: "/sprites/pilot/quartermaster/walk.png",
  work: "/sprites/pilot/quartermaster/work.png",
};
function humanoid(set: string): ActorSet {
  return { width: 128, height: 256, clips: {
    idle: { path: `/sprites/actors/${set}/idle.png`, columns: 4, rows: 8, frameMs: 300 },
    walk: { path: `/sprites/actors/${set}/walk.png`, columns: 8, rows: 8, frameMs: 100 },
  } };
}
export const ACTOR_CATALOG = {
  quartermaster: { width: 128, height: 256, clips: {
    idle: { path: QUARTERMASTER_ATLASES.idle, columns: 4, rows: 8, frameMs: 300 },
    walk: { path: QUARTERMASTER_ATLASES.walk, columns: 8, rows: 8, frameMs: 100 },
    work: { path: QUARTERMASTER_ATLASES.work, columns: 8, rows: 8, frameMs: 125 },
  } } as ActorSet,
  voss: humanoid("voss"), kael: humanoid("kael"), reyes: humanoid("reyes"),
  survivor: humanoid("survivor"), scavenger: humanoid("scavenger"),
  "hub-bartender": humanoid("hub-bartender"), "hub-regular": humanoid("hub-regular"),
  "hub-signal-chaser": humanoid("hub-signal-chaser"),
  hostile: { width: 256, height: 256, clips: {
    idle: { path: "/sprites/actors/hostile/idle.png", columns: 4, rows: 8, frameMs: 300 },
    walk: { path: "/sprites/actors/hostile/walk.png", columns: 8, rows: 8, frameMs: 100 },
    attack: { path: "/sprites/actors/hostile/attack.png", columns: 4, rows: 8, frameMs: 100, loop: false },
    hurt: { path: "/sprites/actors/hostile/hurt.png", columns: 1, rows: 8, frameMs: 180, loop: false },
    death: { path: "/sprites/actors/hostile/death.png", columns: 6, rows: 1, frameMs: 80, loop: false },
  } } as ActorSet,
};
export type ActorSetId = keyof typeof ACTOR_CATALOG;
const NPC_NAMES: Record<string, ActorSetId> = {
  "Commander Voss": "voss", "Doc Kael": "kael", "Lt. Reyes": "reyes", Survivor: "survivor", Scavenger: "scavenger",
};
const NPC_PATHS: Record<string, ActorSetId> = {
  [SPRITES.NPC_VOSS]: "voss", [SPRITES.NPC_KAEL]: "kael", [SPRITES.NPC_REYES]: "reyes",
  [SPRITES.NPC_SURVIVOR]: "survivor", [SPRITES.NPC_SCAVENGER]: "scavenger", [SPRITES.NPC_QUARTERMASTER]: "quartermaster",
  [SPRITES.NPC_HUB_BARTENDER]: "hub-bartender", [SPRITES.NPC_HUB_REGULAR]: "hub-regular", [SPRITES.NPC_HUB_SIGNAL_CHASER]: "hub-signal-chaser",
};
export function resolveNpcActorSet(npc: { name: string; sprite?: string }): ActorSetId | undefined {
  return npc.sprite ? NPC_PATHS[npc.sprite] : NPC_NAMES[npc.name];
}

export const ACTOR_SOURCE_BUDGET_BYTES = 80 * 1024 * 1024;
interface AssetLoader { load(path: string): Promise<HTMLImageElement>; release(path: string): void }
/** Reservations include pending decodes. Whole actor bundles either fit or use
 * legacy sprites. Pending requests cannot be canceled by sprites.ts, so every
 * completion checks current membership before it may remain in the cache. */
export class ActorAssetResidency {
  readonly retainedSets = new Set<ActorSetId>();
  readonly retainedPaths = new Set<string>();
  retainedBytes = 0;
  private scene: object | null = null;
  private key = "";
  private pending = new Map<string, Promise<void>>();
  constructor(private loader: AssetLoader, private budget = ACTOR_SOURCE_BUDGET_BYTES) {}

  sync(scene: object, sets: readonly ActorSetId[]): void {
    const ordered = [...new Set(sets)].sort((a, b) => this.priority(a) - this.priority(b) || a.localeCompare(b));
    const key = ordered.join(",");
    if (scene === this.scene && key === this.key) return;
    this.scene = scene; this.key = key;
    const previous = new Set(this.retainedPaths);
    this.retainedPaths.clear(); this.retainedSets.clear(); this.retainedBytes = 0;
    for (const set of ordered) {
      const asset = ACTOR_CATALOG[set];
      const clips = Object.values(asset.clips);
      const bytes = clips.reduce((sum, clip) => sum + clip.columns * clip.rows * asset.width * asset.height * 4, 0);
      if (this.retainedBytes + bytes > this.budget) continue;
      this.retainedBytes += bytes;
      this.retainedSets.add(set);
      for (const clip of clips) this.retainedPaths.add(clip.path);
    }
    for (const path of previous) if (!this.retainedPaths.has(path)) this.loader.release(path);
    for (const path of this.retainedPaths) {
      if (this.pending.has(path)) continue;
      const request = this.loader.load(path).then(() => {
        if (!this.retainedPaths.has(path)) this.loader.release(path);
      }, () => { /* A later scene entry retries; failed images keep the legacy billboard. */ });
      this.pending.set(path, request);
      void request.then(() => { if (this.pending.get(path) === request) this.pending.delete(path); });
    }
  }
  clear(): void {
    for (const path of this.retainedPaths) this.loader.release(path);
    this.retainedSets.clear(); this.retainedPaths.clear(); this.retainedBytes = 0;
    this.scene = null; this.key = "";
  }
  private priority(set: ActorSetId): number { return set === "quartermaster" ? 0 : set === "hostile" ? 1 : 2; }
}
const activeAssets = new ActorAssetResidency({ load: loadSprite, release: releaseSprite });
export function syncActorAssets(fp: FirstPersonState): void {
  if (typeof Image === "undefined") return;
  const sets: ActorSetId[] = fp.enemies.length ? ["hostile"] : [];
  for (const npc of fp.npcs ?? []) {
    const set = npc.atlasAnimation?.set ?? resolveNpcActorSet(npc);
    if (set) sets.push(set);
  }
  activeAssets.sync(fp.map, sets);
}
/** Call when leaving first-person play, including unmounting an inspection route. */
export function releaseActorAssets(): void { activeAssets.clear(); }

export function retainedActorSpritePaths(): ReadonlySet<string> { return activeAssets.retainedPaths; }

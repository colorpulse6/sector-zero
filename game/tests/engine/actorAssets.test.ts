import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTOR_CATALOG, ActorAssetResidency, ACTOR_SOURCE_BUDGET_BYTES, resolveNpcActorSet } from "../../app/components/engine/actorAssets";
import { SPRITES } from "../../app/components/engine/sprites";

function harness() {
  const resident = new Set<string>(), loads: string[] = [], releases: string[] = [];
  const pending = new Map<string, { resolve: (image: HTMLImageElement) => void; reject: (error: Error) => void }>();
  const cache = new ActorAssetResidency({
    load: path => { loads.push(path); return new Promise((resolve, reject) => pending.set(path, { resolve, reject })); },
    release: path => { resident.delete(path); releases.push(path); },
  });
  const finish = async (path: string) => { resident.add(path); pending.get(path)!.resolve({} as HTMLImageElement); await Promise.resolve(); await Promise.resolve(); };
  return { cache, loads, releases, resident, pending, finish };
}

test("identity resolution honors explicit sprites, names, governor Voss and pilot", () => {
  for (const [name, set] of [["Commander Voss", "voss"], ["Doc Kael", "kael"], ["Lt. Reyes", "reyes"], ["Survivor", "survivor"], ["Scavenger", "scavenger"]]) assert.equal(resolveNpcActorSet({ name }), set);
  assert.equal(resolveNpcActorSet({ name: "Overseer Test", sprite: SPRITES.NPC_VOSS }), "voss");
  assert.equal(resolveNpcActorSet({ name: "Commander Voss", sprite: SPRITES.NPC_KAEL }), "kael");
  assert.equal(resolveNpcActorSet({ name: "Unknown", sprite: "/custom.png" }), undefined);
  for (const set of ["hub-bartender", "hub-regular", "hub-signal-chaser", "quartermaster"] as const) assert.equal(resolveNpcActorSet({ name: "ignored", sprite: `/sprites/boarding/npc-${set}.png` }), set);
});

test("complete catalog bundles stay within 80 MiB with pilot and hostile prioritized", () => {
  const h = ACTOR_CATALOG.hostile;
  assert.deepEqual([h.clips.walk!.columns, h.clips.walk!.rows, h.width, h.height], [8, 8, 256, 256]);
  assert.deepEqual([h.clips.death!.columns, h.clips.death!.rows], [6, 1]);
  const { cache, loads } = harness();
  cache.sync({}, Object.keys(ACTOR_CATALOG) as (keyof typeof ACTOR_CATALOG)[]);
  assert.ok(cache.retainedBytes <= ACTOR_SOURCE_BUDGET_BYTES);
  assert.ok(cache.retainedSets.has("quartermaster"));
  assert.ok(cache.retainedSets.has("hostile"));
  assert.ok(cache.retainedSets.size < Object.keys(ACTOR_CATALOG).length);
  assert.equal(new Set(loads).size, loads.length);
});

test("departed completed and late atlases release on scene change", async () => {
  const h = harness();
  h.cache.sync({}, ["voss"]);
  const old = [...h.loads];
  await h.finish(old[0]);
  h.cache.sync({}, ["hostile"]);
  assert.ok(h.releases.includes(old[0]));
  await h.finish(old[1]);
  assert.equal(h.resident.has(old[1]), false);
  assert.equal(h.cache.retainedBytes, 35.5 * 1024 * 1024);
  for (const path of h.loads.filter(p => p.includes("hostile"))) await h.finish(path);
  h.cache.clear();
  assert.equal(h.cache.retainedBytes, 0);
  assert.equal(h.resident.size, 0);
});

test("failed loads retry on reentry, never every tick", async () => {
  const h = harness(), scene = {};
  h.cache.sync(scene, ["voss"]);
  for (const path of h.loads) h.pending.get(path)!.reject(new Error("offline"));
  await Promise.resolve(); await Promise.resolve();
  const count = h.loads.length;
  h.cache.sync(scene, ["voss"]);
  assert.equal(h.loads.length, count);
  h.cache.sync({}, []);
  h.cache.sync({}, ["voss"]);
  assert.equal(h.loads.length, count * 2);
});

test("repeated exterior interior combat return transitions retain only active sources", async () => {
  const h = harness();
  for (let i = 0; i < 4; i++) for (const sets of [["quartermaster", "voss", "kael", "reyes"], ["hub-bartender", "hub-regular", "hub-signal-chaser"], ["hostile"]] as const) {
    const scene = {};
    h.cache.sync(scene, [...sets]);
    const count = h.loads.length;
    h.cache.sync(scene, [...sets]);
    assert.equal(h.loads.length, count);
    assert.ok(h.cache.retainedBytes <= ACTOR_SOURCE_BUDGET_BYTES);
    for (const path of h.cache.retainedPaths) await h.finish(path);
    assert.deepEqual([...h.resident].sort(), [...h.cache.retainedPaths].sort());
  }
});

test("a pending atlas requested again after a rapid return remains owned by the current scene", async () => {
  const h = harness();
  h.cache.sync({}, ["voss"]);
  const paths = [...h.loads];
  h.cache.sync({}, ["hostile"]);
  h.cache.sync({}, ["voss"]);
  assert.equal(h.loads.filter(path => paths.includes(path)).length, 2, "reuse the original pending pair");
  for (const path of paths) await h.finish(path);
  assert.deepEqual([...h.resident].sort(), [...h.cache.retainedPaths].sort());
  for (const path of h.loads.filter(path => path.includes("hostile"))) await h.finish(path);
  assert.deepEqual([...h.resident].sort(), paths.sort());
});

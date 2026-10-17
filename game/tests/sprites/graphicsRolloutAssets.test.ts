import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { ACTOR_CATALOG } from "../../app/components/engine/actorAssets";
import { SPRITES } from "../../app/components/engine/sprites";

function png(path: string) {
  const bytes = readFileSync(new URL(`../../public${path}`, import.meta.url));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", path);
  return { bytes, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), bitDepth: bytes[24], colorType: bytes[25] };
}

test("every live actor clip matches the runtime cell contract and stays within transfer budget", () => {
  const unique = new Set<string>(); let total = 0, clips = 0;
  for (const [name, set] of Object.entries(ACTOR_CATALOG)) {
    for (const [action, clip] of Object.entries(set.clips)) {
      const image = png(clip.path);
      assert.equal(image.width, set.width * clip.columns, `${name}/${action} width`);
      assert.equal(image.height, set.height * clip.rows, `${name}/${action} rows`);
      assert.equal(image.bitDepth, 8); assert.equal(image.colorType, 6, "actors need real RGBA alpha");
      unique.add(createHash("sha256").update(image.bytes).digest("hex"));
      total += image.bytes.length; clips++;
    }
  }
  assert.equal(clips, 24);
  assert.equal(unique.size, clips, "identities/actions cannot be duplicate sheets");
  assert.ok(total < 32 * 1024 * 1024, `actor transfer bytes ${total}`);
});

test("all 32 world derivatives match the reviewed manifest and are registered for loading", () => {
  const manifest = JSON.parse(readFileSync(new URL("../../../docs/assets/graphics-rollout/world/manifest.json", import.meta.url), "utf8"));
  const paths = new Set(Object.values(SPRITES));
  assert.equal(manifest.assets.length, 32);
  for (const asset of manifest.assets) {
    assert.ok(paths.has(asset.runtimePath), `${asset.id} missing from preload registry`);
    const image = png(asset.runtimePath);
    assert.equal(image.width, 512); assert.equal(image.height, 512);
    assert.equal(createHash("sha256").update(image.bytes).digest("hex"), asset.sha256, asset.id);
  }
  for (const path of [SPRITES.EXPLORE_OUTPOST_SKY, SPRITES.EXPLORE_OUTPOST_GROUND]) {
    const image = png(path);
    assert.ok(image.width >= 1024 && image.height >= 512, "background source detail");
  }
});

/** Ashfall Primary's Overseer reuses the production-reviewed hub-governor billboard and
 *  portrait from the M3 town-hall bundle under Ashfall role keys (design/ashfall-lock).
 *  Pins the registry to the reviewed files, their runtime slot contracts, and the fact
 *  that no actor atlas claims them. Run: `yarn sprites:test`. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { SPRITES } from "../../app/components/engine/sprites";
import { ACTOR_CATALOG, resolveNpcActorSet } from "../../app/components/engine/actorAssets";

const BILLBOARD = SPRITES.NPC_ASHFALL_OVERSEER;
const PORTRAIT = SPRITES.PORTRAIT_ASHFALL_OVERSEER;

function png(path: string) {
  const bytes = readFileSync(new URL(`../../public${path}`, import.meta.url));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", path);
  return { bytes, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), bitDepth: bytes[24], colorType: bytes[25] };
}

function reviewedNpc(roleId: string) {
  const manifest = JSON.parse(readFileSync(new URL("../../../docs/assets/prompts/m3-hubs/manifest.json", import.meta.url), "utf8"));
  for (const bundle of Object.values(manifest.bundles) as Array<{ status: string; npcs?: Array<{ roleId: string; portrait: Record<string, string | number>; billboard: Record<string, string | number> }> }>) {
    const npc = bundle.npcs?.find((n) => n.roleId === roleId);
    if (npc) return { status: bundle.status, ...npc };
  }
  throw new Error(`${roleId} not in the M3 manifest`);
}

test("the Overseer keys point at the reviewed hub-governor files, not at new art", () => {
  const reviewed = reviewedNpc("hub-governor");
  assert.equal(reviewed.status, "production-reviewed");
  assert.equal(BILLBOARD, `/${String(reviewed.billboard.path).replace(/^game\/public\//, "")}`);
  assert.equal(PORTRAIT, `/${String(reviewed.portrait.path).replace(/^game\/public\//, "")}`);
  // The bundle's own constants stay unregistered (m3HubAssets gate); only the Ashfall role keys exist.
  assert.equal("NPC_HUB_GOVERNOR" in SPRITES, false);
  assert.equal("PORTRAIT_HUB_GOVERNOR" in SPRITES, false);
});

test("the billboard meets the NPC slot contract and the portrait meets the dialog slot contract", () => {
  const billboard = png(BILLBOARD);
  assert.equal(billboard.width, 128);
  assert.equal(billboard.height, 256);
  assert.equal(billboard.bitDepth, 8);
  assert.equal(billboard.colorType, 6, "NPC billboards need real RGBA alpha");
  const portrait = png(PORTRAIT);
  assert.equal(portrait.width, 512);
  assert.equal(portrait.height, 512);
  assert.ok(PORTRAIT.startsWith("/sprites/portraits/"), "dialog portraits resolve under /sprites/portraits/");
  assert.notEqual(
    createHash("sha256").update(billboard.bytes).digest("hex"),
    createHash("sha256").update(png(SPRITES.NPC_VOSS).bytes).digest("hex"),
    "the Overseer is not Voss",
  );
});

test("no actor atlas claims the Overseer billboard, so the scene draws the static sprite", () => {
  assert.equal(resolveNpcActorSet({ name: "Overseer Ashfall Primary", sprite: BILLBOARD }), undefined);
  for (const [name, set] of Object.entries(ACTOR_CATALOG)) {
    for (const clip of Object.values(set.clips)) assert.notEqual(clip.path, BILLBOARD, `${name} must not alias the Overseer billboard`);
  }
});

/** Locks the M3 hub asset manifest and its production-review status gate.
 * Run: `yarn sprites:test`. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  flattenManifestAssets,
  loadM3HubManifest,
  readPngHeader,
  validateManifestSchema,
  type M3HubManifest,
} from "../../scripts/sprites/validateM3HubAssets";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

test("M3 hub manifest has unique, valid asset contracts", () => {
  const manifest = loadM3HubManifest(REPO_ROOT);

  assert.doesNotThrow(() => validateManifestSchema(manifest));
  assert.equal(Object.keys(manifest.bundles).length, 3);
  assert.equal(flattenManifestAssets(manifest).length, 42);
});

test("M3 hub manifest rejects unknown bundle statuses", () => {
  const manifest = structuredClone(loadM3HubManifest(REPO_ROOT)) as M3HubManifest;
  const invalid = manifest as unknown as { bundles: { cantina: { status: string } } };
  invalid.bundles.cantina.status = "typo-status";

  assert.throws(
    () => validateManifestSchema(manifest),
    /cantina: status must be planned or production-reviewed/,
  );
});

test("production-reviewed M3 bundles have readable sources and exact production PNGs", () => {
  const manifest = loadM3HubManifest(REPO_ROOT);

  for (const [hubId, bundle] of Object.entries(manifest.bundles)) {
    if (bundle.status !== "production-reviewed") continue;
    for (const asset of flattenManifestAssets(manifest, hubId)) {
      const source = readPngHeader(join(REPO_ROOT, asset.sourcePath));
      assert.ok(source.width > 0 && source.height > 0, `${asset.sourcePath}: readable PNG`);

      const production = readPngHeader(join(REPO_ROOT, asset.path));
      assert.equal(production.width, asset.width, `${asset.path}: width`);
      assert.equal(production.height, asset.height, `${asset.path}: height`);
      assert.equal(production.bitDepth, 8, `${asset.path}: bit depth`);
      assert.equal(production.colorType, asset.alpha === "opaque" ? 2 : 6, `${asset.path}: color type`);
    }
  }
});

/** Validates M3 hub production assets against the docs-owned manifest.
 *
 * Examples:
 *   npx tsx scripts/sprites/validateM3HubAssets.ts --hub cantina
 *   npx tsx scripts/sprites/validateM3HubAssets.ts --hub cantina --category props
 */

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type M3HubStatus = "planned" | "production-reviewed";
export type M3HubCategory = "environment" | "props" | "npcs";

export interface M3HubAsset {
  constant: string;
  path: string;
  sourcePath: string;
  width: number;
  height: number;
  alpha: "opaque" | "transparent";
  kind: string;
  bottomContact?: true;
}

export interface M3HubNpc {
  roleId: string;
  portrait: M3HubAsset;
  billboard: M3HubAsset;
}

export interface M3HubBundle {
  status: M3HubStatus;
  environment: M3HubAsset[];
  props: M3HubAsset[];
  npcs: M3HubNpc[];
}

export interface M3HubManifest {
  schemaVersion: number;
  scope: string;
  bundles: Record<string, M3HubBundle>;
}

export interface PngHeader {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
}

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = join(MODULE_DIR, "..", "..", "..");
const MANIFEST_PATH = join("docs", "assets", "prompts", "m3-hubs", "manifest.json");
const ALLOWED_STATUSES = new Set<M3HubStatus>(["planned", "production-reviewed"]);
const ALLOWED_CATEGORIES = new Set<M3HubCategory>(["environment", "props", "npcs"]);

export function loadM3HubManifest(repoRoot = DEFAULT_REPO_ROOT): M3HubManifest {
  const path = join(repoRoot, MANIFEST_PATH);
  return JSON.parse(readFileSync(path, "utf8")) as M3HubManifest;
}

export function flattenBundleAssets(
  bundle: M3HubBundle,
  category?: M3HubCategory,
): M3HubAsset[] {
  const assets: M3HubAsset[] = [];
  if (category === undefined || category === "environment") assets.push(...bundle.environment);
  if (category === undefined || category === "props") assets.push(...bundle.props);
  if (category === undefined || category === "npcs") {
    for (const npc of bundle.npcs) assets.push(npc.portrait, npc.billboard);
  }
  return assets;
}

export function flattenManifestAssets(
  manifest: M3HubManifest,
  hubId?: string,
): M3HubAsset[] {
  if (hubId !== undefined) {
    const bundle = manifest.bundles[hubId];
    if (!bundle) throw new Error(`unknown hub: ${hubId}`);
    return flattenBundleAssets(bundle);
  }
  return Object.values(manifest.bundles).flatMap((bundle) => flattenBundleAssets(bundle));
}

function requireUnique(assets: M3HubAsset[], key: "constant" | "path" | "sourcePath"): void {
  const seen = new Set<string>();
  for (const asset of assets) {
    const value = asset[key];
    if (seen.has(value)) throw new Error(`duplicate ${key}: ${value}`);
    seen.add(value);
  }
}

export function validateManifestSchema(manifest: M3HubManifest): void {
  if (manifest.schemaVersion !== 1) throw new Error("schemaVersion must be 1");
  if (manifest.scope !== "m3-ashfall-base") throw new Error("scope must be m3-ashfall-base");
  if (!manifest.bundles || Object.keys(manifest.bundles).length === 0) {
    throw new Error("manifest must contain bundles");
  }

  const roleIds = new Set<string>();
  for (const [hubId, bundle] of Object.entries(manifest.bundles)) {
    if (!ALLOWED_STATUSES.has(bundle.status)) {
      throw new Error(`${hubId}: status must be planned or production-reviewed`);
    }
    if (!Array.isArray(bundle.environment) || !Array.isArray(bundle.props) || !Array.isArray(bundle.npcs)) {
      throw new Error(`${hubId}: environment, props, and npcs must be arrays`);
    }
    for (const npc of bundle.npcs) {
      if (!npc.roleId) throw new Error(`${hubId}: NPC roleId is required`);
      if (roleIds.has(npc.roleId)) throw new Error(`duplicate roleId: ${npc.roleId}`);
      roleIds.add(npc.roleId);
    }
  }

  const assets = flattenManifestAssets(manifest);
  for (const asset of assets) {
    if (!asset.constant || !asset.path || !asset.sourcePath || !asset.kind) {
      throw new Error("every asset requires constant, path, sourcePath, and kind");
    }
    if (!Number.isInteger(asset.width) || asset.width <= 0 || !Number.isInteger(asset.height) || asset.height <= 0) {
      throw new Error(`${asset.constant}: dimensions must be positive integers`);
    }
    if (asset.alpha !== "opaque" && asset.alpha !== "transparent") {
      throw new Error(`${asset.constant}: alpha must be opaque or transparent`);
    }
  }
  requireUnique(assets, "constant");
  requireUnique(assets, "path");
  requireUnique(assets, "sourcePath");
}

export function readPngHeader(path: string): PngHeader {
  if (!existsSync(path)) throw new Error(`missing PNG: ${path}`);
  const buffer = readFileSync(path);
  if (
    buffer.length < 26 ||
    buffer.readUInt32BE(0) !== 0x89504e47 ||
    buffer.readUInt32BE(4) !== 0x0d0a1a0a ||
    buffer.toString("ascii", 12, 16) !== "IHDR"
  ) {
    throw new Error(`not a readable PNG: ${path}`);
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bitDepth: buffer[24],
    colorType: buffer[25],
  };
}

function runMagick(args: string[]): string {
  const result = spawnSync("magick", args, { encoding: "utf8", shell: false });
  if (result.error) throw new Error(`ImageMagick failed to start: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`ImageMagick failed (${args.join(" ")}): ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

function validateTransparentPixels(path: string, asset: M3HubAsset): void {
  const corners = runMagick([
    path,
    "-format",
    "%[fx:p{0,0}.a],%[fx:p{w-1,0}.a],%[fx:p{0,h-1}.a],%[fx:p{w-1,h-1}.a]",
    "info:",
  ]).split(",").map(Number);
  if (corners.length !== 4 || corners.some((alpha) => !Number.isFinite(alpha) || alpha > 0.05)) {
    throw new Error(`${asset.path}: corners must be transparent (alpha <= 0.05), got ${corners.join(",")}`);
  }

  if (asset.bottomContact) {
    const bandHeight = Math.min(8, asset.height);
    const maxAlpha = Number(runMagick([
      path,
      "-alpha",
      "extract",
      "-crop",
      `${asset.width}x${bandHeight}+0+${asset.height - bandHeight}`,
      "+repage",
      "-format",
      "%[fx:maxima]",
      "info:",
    ]));
    if (!Number.isFinite(maxAlpha) || maxAlpha <= 0.05) {
      throw new Error(`${asset.path}: bottom contact band is empty`);
    }
  }
}

function validateEvidence(repoRoot: string, hubId: string, category?: M3HubCategory): void {
  const reviewDir = join(repoRoot, "docs", "assets", "reviews", "m3-hubs", hubId);
  const required = category === "environment"
    ? ["textures-2x2.png"]
    : category === "props"
      ? ["props-actual-size.png", "billboards-dark-bright.png"]
      : category === "npcs"
        ? ["npc-identity-pairs.png", "billboards-dark-bright.png"]
        : [
            "provenance.md",
            "textures-2x2.png",
            "props-actual-size.png",
            "npc-identity-pairs.png",
            "billboards-dark-bright.png",
          ];

  for (const name of required) {
    const path = join(reviewDir, name);
    if (!existsSync(path)) throw new Error(`${hubId}: missing review evidence ${name}`);
    if (name.endsWith(".png")) readPngHeader(path);
  }
}

export function validateHubBundle(
  manifest: M3HubManifest,
  repoRoot: string,
  hubId: string,
  category?: M3HubCategory,
): void {
  validateManifestSchema(manifest);
  const bundle = manifest.bundles[hubId];
  if (!bundle) throw new Error(`unknown hub: ${hubId}`);

  for (const asset of flattenBundleAssets(bundle, category)) {
    const productionPath = join(repoRoot, asset.path);
    if (!existsSync(productionPath)) throw new Error(`${hubId}: missing production asset ${asset.path}`);
    const header = readPngHeader(productionPath);
    if (header.width !== asset.width || header.height !== asset.height) {
      throw new Error(`${asset.path}: expected ${asset.width}x${asset.height}, got ${header.width}x${header.height}`);
    }
    if (header.bitDepth !== 8) throw new Error(`${asset.path}: expected 8-bit PNG`);
    const expectedColorType = asset.alpha === "opaque" ? 2 : 6;
    if (header.colorType !== expectedColorType) {
      throw new Error(`${asset.path}: expected PNG color type ${expectedColorType}, got ${header.colorType}`);
    }
    if (asset.alpha === "transparent") validateTransparentPixels(productionPath, asset);
    const sourcePath = join(repoRoot, asset.sourcePath);
    if (!existsSync(sourcePath)) throw new Error(`${hubId}: missing selected source ${asset.sourcePath}`);
    readPngHeader(sourcePath);
  }
  validateEvidence(repoRoot, hubId, category);
}

function parseCliArgs(args: string[]): { hubId: string; category?: M3HubCategory } {
  let hubId: string | undefined;
  let category: M3HubCategory | undefined;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--hub") hubId = args[index + 1];
    if (args[index] === "--category") {
      const value = args[index + 1] as M3HubCategory | undefined;
      if (!value || !ALLOWED_CATEGORIES.has(value)) {
        throw new Error("--category must be environment, props, or npcs");
      }
      category = value;
    }
  }
  if (!hubId) throw new Error("usage: validateM3HubAssets.ts --hub <hub> [--category environment|props|npcs]");
  return { hubId, category };
}

function main(): void {
  try {
    const { hubId, category } = parseCliArgs(process.argv.slice(2));
    const manifest = loadM3HubManifest(DEFAULT_REPO_ROOT);
    validateHubBundle(manifest, DEFAULT_REPO_ROOT, hubId, category);
    console.log(`${hubId}${category ? `/${category}` : ""}: M3 asset contract valid`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

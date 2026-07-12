/** Sprite inventory + classification manifest (Phase 0 Task 8).
 *
 *  Walks game/public/sprites/**, reads each PNG's dimensions straight from the
 *  IHDR chunk (no image library needed), classifies it against the sheets.ts
 *  safety model, and writes a manifest OUTSIDE public/ so the export never
 *  ships it: game/scripts/sprites/_manifest.json.
 *
 *  Run: `yarn sprites:classify` (from game/). Node script via tsx — excluded
 *  from the Next type-check graph by tsconfig's "scripts/**" exclude. */

import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { classifyPath, SHEETS, type SpriteClass } from "./sheets";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const GAME_DIR = join(SCRIPT_DIR, "..", "..");
const SPRITES_DIR = join(GAME_DIR, "public", "sprites");
const MANIFEST_PATH = join(SCRIPT_DIR, "_manifest.json");

interface ManifestEntry {
  path: string; // relative to public/sprites/
  width: number;
  height: number;
  class: SpriteClass;
  /** Frame count + per-frame width for sheets (width-division model). */
  frames?: number;
  frameWidth?: number;
}

/** PNG dimensions from the IHDR chunk (bytes 16-23 after the 8-byte sig +
 *  8-byte chunk header). Throws on non-PNG input. */
function pngSize(file: string): { width: number; height: number } {
  const buf = readFileSync(file);
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) {
    throw new Error(`not a PNG: ${file}`);
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.toLowerCase().endsWith(".png")) out.push(full);
  }
  return out;
}

const frameCountByPath = new Map(SHEETS.map((s) => [s.path, s.frames]));

const entries: ManifestEntry[] = walk(SPRITES_DIR)
  .map((file) => {
    const rel = relative(SPRITES_DIR, file).split("\\").join("/");
    const { width, height } = pngSize(file);
    const cls = classifyPath(rel);
    const entry: ManifestEntry = { path: rel, width, height, class: cls };
    const frames = frameCountByPath.get(rel);
    if (frames) {
      entry.frames = frames;
      entry.frameWidth = width / frames;
      if (!Number.isInteger(entry.frameWidth)) {
        // Loud, not fatal: a non-integer frame width means the sheet's frame
        // math is already fractional in the engine — worth knowing either way.
        console.warn(`WARNING: ${rel} width ${width} not divisible by ${frames} frames`);
      }
    }
    return entry;
  })
  .sort((a, b) => a.path.localeCompare(b.path));

const counts = entries.reduce<Record<string, number>>((acc, e) => {
  acc[e.class] = (acc[e.class] ?? 0) + 1;
  return acc;
}, {});

writeFileSync(MANIFEST_PATH, JSON.stringify({ generated: "sprites:classify", counts, entries }, null, 2));
console.log(`wrote ${MANIFEST_PATH}`);
console.log(counts);

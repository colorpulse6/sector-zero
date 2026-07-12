/** Pins the sprite-safety model (Phase 0 Task 8):
 *   - every SHEETS atlas is classified "sheet" and is NOT remat-allowlisted
 *   - every allowlisted billboard exists on disk (no dangling entries)
 *   - every sheet exists on disk and its width divides by its frame count
 *  Run: `yarn sprites:test`. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SHEETS, MAT_ALLOWLIST, classifyPath } from "../../scripts/sprites/sheets";

const SPRITES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "public", "sprites");

function pngWidth(file: string): number {
  return readFileSync(file).readUInt32BE(16);
}

test("every sheet is classified 'sheet' and absent from the mat allowlist", () => {
  const allow = new Set(MAT_ALLOWLIST);
  for (const sheet of SHEETS) {
    assert.equal(classifyPath(sheet.path), "sheet", sheet.path);
    assert.ok(!allow.has(sheet.path), `${sheet.path} must not be remat-allowlisted`);
  }
});

test("every sheet exists and its width divides by its frame count", () => {
  for (const sheet of SHEETS) {
    const full = join(SPRITES_DIR, sheet.path);
    assert.ok(existsSync(full), `missing sheet: ${sheet.path}`);
    if (sheet.allowFractional) continue; // declared exception (see sheets.ts)
    const w = pngWidth(full);
    assert.equal(w % sheet.frames, 0, `${sheet.path}: width ${w} % ${sheet.frames} !== 0`);
  }
});

test("mat allowlist entries all exist and classify as allowlisted billboards", () => {
  for (const rel of MAT_ALLOWLIST) {
    assert.ok(existsSync(join(SPRITES_DIR, rel)), `missing allowlisted file: ${rel}`);
    assert.equal(classifyPath(rel), "allowlisted-billboard", rel);
  }
});

test("allowlist has no duplicates", () => {
  assert.equal(new Set(MAT_ALLOWLIST).size, MAT_ALLOWLIST.length);
});

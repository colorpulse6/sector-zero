/** Allowlist-only alpha remediation (Phase 0 Task 9).
 *
 *  Re-mats ONLY the billboards in sheets.ts MAT_ALLOWLIST through BiRefNet
 *  (`rembg -m birefnet-general`, local + free), killing the semi-transparent
 *  AI-residue halos. Nothing else is ever touched.
 *
 *  Guards (both mandatory — goldens do NOT decode PNGs, so they can't catch
 *  sprite corruption):
 *   1. Dimension guard: output W×H must equal input W×H or the original is
 *      restored (frame/draw math depends on exact geometry).
 *   2. Changed-file guard: after the run, `git status` over public/sprites
 *      must show changes ⊆ MAT_ALLOWLIST; any violation is restored via git
 *      and reported loudly.
 *
 *  Requires local rembg: `pipx install "rembg[cli]"` (first run downloads the
 *  BiRefNet weights, ~1GB). Usage:
 *    yarn sprites:remat [--dry-run] [--only <path-prefix>] [--rembg <bin>]
 */

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { MAT_ALLOWLIST } from "./sheets";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const GAME_DIR = join(SCRIPT_DIR, "..", "..");
const REPO_DIR = join(GAME_DIR, "..");
const SPRITES_DIR = join(GAME_DIR, "public", "sprites");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const onlyIdx = args.indexOf("--only");
const ONLY_PREFIX = onlyIdx >= 0 ? args[onlyIdx + 1] : null;
const rembgIdx = args.indexOf("--rembg");
const REMBG_BIN = rembgIdx >= 0 ? args[rembgIdx + 1] : "rembg";

function pngSize(file: string): { w: number; h: number } {
  const buf = readFileSync(file);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function gitChangedSpritePaths(): string[] {
  const out = execFileSync("git", ["status", "--porcelain", "--", "game/public/sprites"], {
    cwd: REPO_DIR,
    encoding: "utf8",
  });
  return out
    .split("\n")
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
    .filter((p) => p.endsWith(".png"))
    .map((p) => p.replace(/^game\/public\/sprites\//, ""));
}

const targets = MAT_ALLOWLIST.filter((rel) => !ONLY_PREFIX || rel.startsWith(ONLY_PREFIX));
console.log(`${targets.length} allowlisted billboard(s)${ONLY_PREFIX ? ` (filter: ${ONLY_PREFIX})` : ""}${DRY_RUN ? " [dry run]" : ""}`);

const preChanged = new Set(gitChangedSpritePaths());
const tmp = mkdtempSync(join(tmpdir(), "remat-"));
let ok = 0;
let restored = 0;

try {
  for (const rel of targets) {
    const src = join(SPRITES_DIR, rel);
    if (DRY_RUN) {
      console.log(`would remat: ${rel}`);
      continue;
    }
    const before = pngSize(src);
    const out = join(tmp, "out.png");
    try {
      execFileSync(REMBG_BIN, ["i", "-m", "birefnet-general", src, out], { stdio: "pipe" });
    } catch (err) {
      console.error(`FAILED (rembg): ${rel} — left untouched`, err instanceof Error ? err.message : err);
      continue;
    }
    const after = pngSize(out);
    if (after.w !== before.w || after.h !== before.h) {
      console.error(`DIMENSION GUARD: ${rel} ${before.w}x${before.h} -> ${after.w}x${after.h} — restored`);
      restored++;
      continue; // src never overwritten
    }
    copyFileSync(out, src);
    ok++;
    console.log(`rematted: ${rel}`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// Changed-file guard: everything newly changed must be allowlisted.
if (!DRY_RUN) {
  const allow = new Set(MAT_ALLOWLIST);
  const violations = gitChangedSpritePaths().filter((p) => !allow.has(p) && !preChanged.has(p));
  if (violations.length > 0) {
    console.error(`CHANGED-FILE GUARD VIOLATION — restoring: ${violations.join(", ")}`);
    execFileSync(
      "git",
      ["checkout", "--", ...violations.map((p) => `game/public/sprites/${p}`)],
      { cwd: REPO_DIR },
    );
    process.exitCode = 1;
  }
  console.log(`done: ${ok} rematted, ${restored} dimension-restored, ${violations.length} guard-restored`);
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { ACTOR_CATALOG } from "../../app/components/engine/actorAssets";
import { SPRITES } from "../../app/components/engine/sprites";

const publicRoot = new URL("../../public/", import.meta.url);

// Decode the authored RGBA PNGs without introducing a native test dependency
// (same approach as quartermasterAssets.test.ts).
function png(runtimePath: string) {
  const bytes = readFileSync(fileURLToPath(new URL(`.${runtimePath}`, publicRoot)));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", runtimePath);
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  assert.equal(bytes[24], 8, `${runtimePath}: 8-bit pixels`);
  assert.equal(bytes[25], 6, `${runtimePath}: RGBA transparency`);
  assert.equal(bytes[28], 0, `${runtimePath}: non-interlaced`);
  const chunks: Buffer[] = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    if (bytes.toString("ascii", offset + 4, offset + 8) === "IDAT") chunks.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * 4, pixels = Buffer.alloc(stride * height);
  assert.equal(raw.length, (stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    assert.ok(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x;
      const a = x >= 4 ? pixels[i - 4] : 0;
      const b = y > 0 ? pixels[i - stride] : 0;
      const c = x >= 4 && y > 0 ? pixels[i - stride - 4] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const prediction = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? Math.floor((a + b) / 2) : pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      pixels[i] = raw[y * (stride + 1) + 1 + x] + prediction;
    }
  }
  return { width, height, pixels, bytes: bytes.length };
}

function cell(image: ReturnType<typeof png>, column: number, row: number, size: number): Buffer {
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    const src = ((row * size + y) * image.width + column * size) * 4;
    image.pixels.copy(out, y * size * 4, src, src + size * 4);
  }
  return out;
}

const hostile = ACTOR_CATALOG.hostile;
// Static fallback → the atlas cell it must reproduce (clip, column, row).
const FALLBACKS = [
  { key: "FP_ENEMY_FRONT", clip: "idle", column: 0, row: 0 },
  { key: "FP_ENEMY_FLINCH", clip: "hurt", column: 0, row: 0 },
  { key: "FP_ENEMY_DEATH", clip: "death", column: 5, row: 0 },
] as const;

test("first-person hostile fallbacks are exact cells of the shipped hostile atlas", () => {
  for (const { key, clip, column, row } of FALLBACKS) {
    const runtimePath = SPRITES[key];
    assert.match(runtimePath, /^\/sprites\/actors\/hostile\/fallback-[a-z]+\.png$/, `${key} lives beside the atlas it mirrors`);
    const still = png(runtimePath);
    assert.deepEqual([still.width, still.height], [hostile.width, hostile.height], `${key} is one hostile cell`);
    const atlas = png(hostile.clips[clip]!.path);
    assert.ok(column < hostile.clips[clip]!.columns && row < hostile.clips[clip]!.rows);
    assert.ok(still.pixels.equals(cell(atlas, column, row, hostile.width)), `${key} must equal ${clip} cell (${column},${row}) pixel for pixel`);
    assert.ok(still.bytes < 128 * 1024, `${key} stays a small preload (${still.bytes} bytes)`);
  }
});

test("fallback stills carry real transparency and the three poses are distinct", () => {
  const seen = new Set<string>();
  for (const { key } of FALLBACKS) {
    const still = png(SPRITES[key]);
    let opaque = 0;
    for (let i = 3; i < still.pixels.length; i += 4) if (still.pixels[i] > 0) opaque++;
    const coverage = opaque / (still.width * still.height);
    assert.ok(coverage > 0.1 && coverage < 0.7, `${key} coverage ${coverage.toFixed(2)} (transparent backdrop, visible creature)`);
    const signature = createHash("sha256").update(still.pixels).digest("hex");
    assert.ok(!seen.has(signature), `${key} duplicates another fallback`);
    seen.add(signature);
  }
});

test("the retired boarding billboards are no longer registered as first-person hostiles", () => {
  for (const path of Object.values(SPRITES)) assert.doesNotMatch(path, /\/boarding\/enemy-fp-/);
});

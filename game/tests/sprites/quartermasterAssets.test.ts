import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = new URL("../../public/sprites/pilot/quartermaster/", import.meta.url);

// Decode the authored RGBA PNGs without introducing a native test dependency.
function png(name: string) {
  const bytes = readFileSync(fileURLToPath(new URL(name, root)));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  assert.equal(bytes[24], 8, "8-bit pixels");
  assert.equal(bytes[25], 6, "RGBA transparency");
  assert.equal(bytes[28], 0, "non-interlaced atlas");
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

test("quartermaster's 160 directional cells are transparent, distinct and consistently framed", () => {
  let totalBytes = 0;
  for (const [clip, columns] of [["idle", 4], ["walk", 8], ["work", 8]] as const) {
    const atlas = png(`${clip}.png`);
    totalBytes += atlas.bytes;
    assert.equal(atlas.width, columns * 128);
    assert.equal(atlas.height, 8 * 256);
    for (let row = 0; row < 8; row++) {
      const hashes = new Set<string>();
      for (let col = 0; col < columns; col++) {
        let visible = 0, top = 256, bottom = -1;
        const hash = createHash("sha256");
        for (let y = 0; y < 256; y++) {
          const start = ((row * 256 + y) * atlas.width + col * 128) * 4;
          const scanline = atlas.pixels.subarray(start, start + 128 * 4);
          hash.update(scanline);
          for (let x = 0; x < 128; x++) {
            if (scanline[x * 4 + 3] <= 16) continue;
            visible++; top = Math.min(top, y); bottom = Math.max(bottom, y);
            assert.ok(x > 0 && x < 127 && y > 0 && y < 255, `${clip}/${row}/${col}: silhouette must not clip`);
          }
        }
        assert.ok(visible > 1000 && visible < 22000, `${clip}/${row}/${col}: nonempty transparent silhouette`);
        assert.ok(top < 35 && bottom > 225, `${clip}/${row}/${col}: stable actor scale and ground baseline`);
        hashes.add(hash.digest("hex"));
      }
      assert.equal(hashes.size, columns, `${clip}/${row}: every animation frame changes`);
    }
  }
  const station = png("workstation.png");
  assert.ok(station.width <= 512 && station.height <= 512);
  const alpha = station.pixels.filter((_, i) => i % 4 === 3);
  assert.ok(alpha.some(a => a === 0) && alpha.some(a => a > 200), "station has an opaque subject and transparent surround");
  totalBytes += station.bytes;
  assert.ok(totalBytes < 4 * 1024 * 1024, `pilot transfer budget: ${totalBytes} bytes`);
});

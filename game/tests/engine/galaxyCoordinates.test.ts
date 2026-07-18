import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cellAddress,
  cellKey,
  coord,
  coordinateKey,
  distanceUnits,
  sameCoordinate,
  stableHash,
  validateCoordinate,
} from "../../app/components/engine/galaxy/coordinates";

test("coord constructs a fixed-point coordinate", () => {
  assert.deepEqual(coord(-2, 4, 1024, -512), {
    sectorX: -2,
    sectorY: 4,
    localX: 1024,
    localY: -512,
  });
});

test("coord rejects values that cannot be authority coordinates", () => {
  assert.throws(() => coord(0, 0, 1.5, 2), RangeError);
  assert.throws(
    () => coord(Number.MAX_SAFE_INTEGER + 1, 0, 1, 2),
    RangeError,
  );
});

test("coordinate validation accepts safe integers at signed boundaries", () => {
  assert.deepEqual(
    validateCoordinate({
      sectorX: Number.MIN_SAFE_INTEGER,
      sectorY: Number.MAX_SAFE_INTEGER,
      localX: -256,
      localY: 0,
    }),
    { ok: true },
  );
});

test("coordinates reject unsafe or fractional authority values", () => {
  assert.equal(
    validateCoordinate({ sectorX: 0, sectorY: 0, localX: 12.5, localY: 2 }).ok,
    false,
  );
  assert.equal(
    validateCoordinate({
      sectorX: 0,
      sectorY: 0,
      localX: Number.MAX_SAFE_INTEGER + 1,
      localY: 2,
    }).ok,
    false,
  );
});

test("coordinate validation reports every invalid field deterministically", () => {
  const invalidValues = [
    1.25,
    Number.MAX_SAFE_INTEGER + 1,
    Number.POSITIVE_INFINITY,
    Number.NaN,
    "2",
    null,
  ];
  const fields = ["sectorX", "sectorY", "localX", "localY"] as const;

  for (const field of fields) {
    for (const value of invalidValues) {
      const candidate: Record<string, unknown> = {
        sectorX: 1,
        sectorY: 2,
        localX: 3,
        localY: 4,
      };
      candidate[field] = value;

      assert.deepEqual(validateCoordinate(candidate), {
        ok: false,
        error: `${field} must be a safe integer`,
      });
    }
  }

  assert.deepEqual(validateCoordinate(null), {
    ok: false,
    error: "coordinate must be an object",
  });
});

test("coordinate identity includes every fixed-point component", () => {
  const base = coord(-1, 2, -3, 4);
  assert.equal(coordinateKey(base), "-1:2:-3:4");
  assert.equal(sameCoordinate(base, coord(-1, 2, -3, 4)), true);
  assert.equal(sameCoordinate(base, coord(-1, 2, -3, 5)), false);
  assert.equal(sameCoordinate(base, coord(-1, 3, -3, 4)), false);
});

test("cell addresses use 256-unit floor buckets at boundaries", () => {
  assert.deepEqual(cellAddress(coord(7, -8, 255, 256)), {
    sectorX: 7,
    sectorY: -8,
    cellX: 0,
    cellY: 1,
  });
  assert.deepEqual(cellAddress(coord(7, -8, -1, -257)), {
    sectorX: 7,
    sectorY: -8,
    cellX: -1,
    cellY: -2,
  });
  assert.equal(cellKey(coord(7, -8, -256, 511)), "7:-8:-1:1");
});

test("cell identity is stable within one cell", () => {
  assert.equal(cellKey(coord(0, 0, 513, 770)), "0:0:2:3");
  assert.equal(cellKey(coord(0, 0, 700, 900)), "0:0:2:3");
});

test("distance uses Euclidean fixed-point units within a sector", () => {
  assert.equal(distanceUnits(coord(3, -4, -1, -1), coord(3, -4, 2, 3)), 5);
  assert.equal(distanceUnits(coord(3, -4, 9, 9), coord(3, -4, 9, 9)), 0);
  assert.equal(
    distanceUnits(coord(3, -4, -1, -1), coord(3, -4, 2, 3)),
    distanceUnits(coord(3, -4, 2, 3), coord(3, -4, -1, -1)),
  );
});

test("distance rejects cross-sector comparisons without a unit conversion", () => {
  assert.throws(
    () => distanceUnits(coord(0, 0, 0, 0), coord(1, 0, 0, 0)),
    /different sectors/,
  );
});

test("stableHash is unsigned FNV-1a over UTF-16 code units", () => {
  assert.equal(stableHash(""), 2166136261);
  assert.equal(stableHash("a"), 3826002220);
  assert.equal(stableHash("hello"), 1335831723);
  assert.equal(stableHash("😀"), 3409036472);
  assert.equal(stableHash("e\u0301"), 2484688179);
  assert.equal(stableHash("é"), 1812687940);
  assert.ok(stableHash("hello") >= 0);
});

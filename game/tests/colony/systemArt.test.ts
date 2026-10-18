import { test } from "node:test";
import assert from "node:assert/strict";
import { paintEclipticDust, paintPlanetSurface } from "../../app/components/galaxy/system/systemArt";
import { createRandom } from "../../app/components/galaxy/sector/sectorArt";
import { BIOME_PALETTES } from "../../app/components/colony/meta/regionMapTerrain";
import type { PlanetBiome } from "../../app/components/colony/shared/colonyTypes";

/** Records every draw call and style change so two paints can be compared. */
function recordingContext() {
  const calls: string[] = [];
  const gradient = () => ({ addColorStop: (offset: number, color: string) => calls.push(`stop ${offset} ${color}`) });
  const target: Record<string, unknown> = {
    createRadialGradient: (...args: number[]) => (calls.push(`radial ${args.map(value => value.toFixed(3)).join(",")}`), gradient()),
    createLinearGradient: (...args: number[]) => (calls.push(`linear ${args.map(value => value.toFixed(3)).join(",")}`), gradient()),
  };
  const context = new Proxy(target, {
    get(object, key: string) {
      if (key in object) return object[key];
      return (...args: unknown[]) => calls.push(`${key}(${args.map(value => (typeof value === "number" ? value.toFixed(3) : String(value))).join(",")})`);
    },
    set(object, key: string, value) {
      calls.push(`${key}=${typeof value === "object" ? "gradient" : String(value)}`);
      object[`_${key}`] = value;
      return true;
    },
  });
  return { context: context as unknown as CanvasRenderingContext2D, calls };
}

const BIOMES = Object.keys(BIOME_PALETTES) as PlanetBiome[];

test("planet surfaces are deterministic per seed and differ between seeds", () => {
  for (const biome of BIOMES) {
    const first = recordingContext();
    const second = recordingContext();
    const other = recordingContext();
    paintPlanetSurface(first.context, 256, 128, createRandom(42), biome, BIOME_PALETTES[biome]);
    paintPlanetSurface(second.context, 256, 128, createRandom(42), biome, BIOME_PALETTES[biome]);
    paintPlanetSurface(other.context, 256, 128, createRandom(43), biome, BIOME_PALETTES[biome]);
    assert.ok(first.calls.length > 50, `${biome} paints detail`);
    assert.deepEqual(first.calls, second.calls, `${biome} repeats`);
    assert.notDeepEqual(first.calls, other.calls, `${biome} varies by seed`);
    const blending = first.calls.filter(call => call.startsWith("globalCompositeOperation="));
    assert.equal(blending[blending.length - 1], "globalCompositeOperation=source-over", `${biome} restores blending`);
  }
});

test("planet surfaces start opaque and use only finite colours", () => {
  for (const biome of BIOMES) {
    const { context, calls } = recordingContext();
    paintPlanetSurface(context, 128, 64, createRandom(7), biome, BIOME_PALETTES[biome]);
    assert.ok(calls.includes("fillRect(0.000,0.000,128.000,64.000)"), `${biome} fills the base`);
    for (const call of calls) assert.ok(!/NaN|undefined|Infinity/.test(call), `${biome}: ${call}`);
  }
});

test("biome details are distinct", () => {
  const signature = (biome: PlanetBiome) => {
    const { context, calls } = recordingContext();
    paintPlanetSurface(context, 128, 64, createRandom(1), biome, BIOME_PALETTES[biome]);
    return { lighter: calls.includes("globalCompositeOperation=lighter"), arcs: calls.filter(call => call.startsWith("arc(")).length, linear: calls.filter(call => call.startsWith("linear")).length };
  };
  assert.equal(signature("volcanic").lighter, true);
  assert.equal(signature("urban").lighter, true);
  assert.ok(signature("barren").arcs > signature("desert").arcs);
  assert.equal(signature("ice").linear, 2);
  assert.equal(signature("toxic").linear, 0);
});

test("ecliptic dust clears the canvas and is deterministic", () => {
  const first = recordingContext();
  const second = recordingContext();
  paintEclipticDust(first.context, 512, createRandom(9));
  paintEclipticDust(second.context, 512, createRandom(9));
  assert.equal(first.calls[0], "clearRect(0.000,0.000,512.000,512.000)");
  assert.deepEqual(first.calls, second.calls);
  assert.equal(first.calls[first.calls.length - 1], "globalCompositeOperation=source-over");
});

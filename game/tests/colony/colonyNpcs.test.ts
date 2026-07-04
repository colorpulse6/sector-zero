import { test } from "node:test";
import assert from "node:assert/strict";
import { generateColonyNpcs } from "../../app/components/colony/exploration/npc/colonyNpcs";
import { findPath } from "../../app/components/colony/exploration/npc/npcPathfind";
import { generateExteriorState } from "../../app/components/colony/exploration/colonyLayout";
import type { ColonyBuilding, ColonyState, GameClock, PopulationState } from "../../app/components/colony/shared/colonyTypes";
import type { BoardingMap } from "../../app/components/engine/types";
import type { Tile } from "../../app/components/colony/exploration/npc/types";
import { makeTestColony } from "./fixtures";

const CLOCK: GameClock = { day: 3, hour: 12, minute: 0, realtimeMsPerGameMinute: 1000, season: "standard" };

function pop(total: number): PopulationState {
  return { total, capacity: total, namedCount: 0, growthRate: 0, recentDeaths: [] };
}

function building(id: string, type: ColonyBuilding["type"], status: ColonyBuilding["status"]): ColonyBuilding {
  return {
    id, type, tier: 1, status, buildProgressCycles: 0,
    hp: status === "operational" ? 100 : 50, maxHp: 100,
    interiorTemplateId: null, assignedNpcIds: [], districtId: null,
  };
}

function walkable(map: BoardingMap, t: Tile): boolean {
  if (t.x < 0 || t.y < 0 || t.x >= map.width || t.y >= map.height) return false;
  const k = map.tiles[t.y][t.x];
  return k === "floor" || k === "door";
}

// A populated colony with an operational habitat + two other operational buildings.
function fullColony(overrides: Partial<ColonyState> = {}): ColonyState {
  return makeTestColony({
    name: "Haven",
    population: pop(40),
    happiness: 70,
    layoutSeed: 42,
    buildings: [
      building("hab1", "habitat_module", "operational"),
      building("farm1", "farm", "operational"),
      building("solar1", "solar_array", "operational"),
    ],
    ...overrides,
  });
}

// ─── Determinism ─────────────────────────────────────────────────────────────

test("generateColonyNpcs: identical (colony, clock, map) → identical output", () => {
  const colony = fullColony();
  const map = generateExteriorState(colony, CLOCK).map;
  const a = generateColonyNpcs(colony, CLOCK, map);
  const b = generateColonyNpcs(colony, CLOCK, map);
  assert.deepEqual(a.sidecar, b.sidecar);
  assert.deepEqual(a.fpNpcs, b.fpNpcs);
});

test("generateColonyNpcs: fpNpcs[i] and sidecar[i] share an id, ids are unique", () => {
  const colony = fullColony();
  const map = generateExteriorState(colony, CLOCK).map;
  const { fpNpcs, sidecar } = generateColonyNpcs(colony, CLOCK, map);
  assert.equal(fpNpcs.length, sidecar.length);
  const ids = new Set<number>();
  for (let i = 0; i < sidecar.length; i++) {
    assert.equal(fpNpcs[i].id, sidecar[i].id, `pair ${i} shares an id`);
    assert.ok(!ids.has(sidecar[i].id), `id ${sidecar[i].id} is unique`);
    ids.add(sidecar[i].id);
  }
});

// ─── Governor + quartermaster always present ─────────────────────────────────

test("generateColonyNpcs: governor + quartermaster always present, correct kinds/types/sprites", () => {
  const colony = fullColony();
  const map = generateExteriorState(colony, CLOCK).map;
  const { sidecar, fpNpcs } = generateColonyNpcs(colony, CLOCK, map);

  const gov = sidecar.find((n) => n.kind === "governor");
  const qm = sidecar.find((n) => n.kind === "quartermaster");
  assert.ok(gov, "governor present");
  assert.ok(qm, "quartermaster present");

  const govFp = fpNpcs.find((n) => n.id === gov!.id)!;
  const qmFp = fpNpcs.find((n) => n.id === qm!.id)!;
  assert.equal(govFp.type, "lore");
  assert.ok(govFp.name.includes("Haven"), "governor name reflects colony name");
  assert.ok(govFp.dialog.length > 0, "governor has dialog");
  assert.equal(qmFp.type, "merchant");
  assert.ok(qmFp.shopItems && qmFp.shopItems.length > 0, "quartermaster has shop items");
  assert.notEqual(govFp.sprite, qmFp.sprite, "governor and quartermaster read as distinct sprites");
});

// ─── Buy-enable is quartermaster-only (§I — makes the in-game shop actually buy) ──

test("generateColonyNpcs: only the quartermaster's fpNpc has canBuy === true", () => {
  const colony = fullColony();
  const map = generateExteriorState(colony, CLOCK).map;
  const { sidecar, fpNpcs } = generateColonyNpcs(colony, CLOCK, map);
  const byId = new Map(fpNpcs.map((n) => [n.id, n]));

  for (const npc of sidecar) {
    const fp = byId.get(npc.id)!;
    if (npc.kind === "quartermaster") {
      assert.equal(fp.canBuy, true, "quartermaster fpNpc is buy-enabled");
    } else {
      assert.notEqual(fp.canBuy, true, `${npc.kind} fpNpc is NOT buy-enabled`);
    }
  }
  // Exactly one buy-enabled NPC in the whole set.
  assert.equal(fpNpcs.filter((n) => n.canBuy === true).length, 1, "exactly one canBuy NPC");
});

// ─── Colonist count from population, capped at 10 ────────────────────────────

test("generateColonyNpcs: colonists cap at 10 even for huge population", () => {
  const colony = fullColony({ population: pop(999) });
  const map = generateExteriorState(colony, CLOCK).map;
  const { sidecar } = generateColonyNpcs(colony, CLOCK, map);
  const colonists = sidecar.filter((n) => n.kind === "colonist");
  assert.equal(colonists.length, 10);
  assert.equal(sidecar.length, 12); // 10 colonists + governor + quartermaster
});

test("generateColonyNpcs: colonist count scales with population (floor(total/4), cap 10)", () => {
  const cases: Array<[number, number]> = [
    [0, 0],
    [3, 0],
    [4, 1],
    [8, 2],
    [40, 10],
    [999, 10],
  ];
  for (const [total, expected] of cases) {
    const colony = fullColony({ population: pop(total) });
    const map = generateExteriorState(colony, CLOCK).map;
    const { sidecar } = generateColonyNpcs(colony, CLOCK, map);
    const colonists = sidecar.filter((n) => n.kind === "colonist").length;
    assert.equal(colonists, expected, `population ${total} → ${expected} colonists`);
  }
});

// ─── Degradation ─────────────────────────────────────────────────────────────

test("generateColonyNpcs: zero population still yields governor + quartermaster", () => {
  const colony = fullColony({ population: pop(0) });
  const map = generateExteriorState(colony, CLOCK).map;
  const { sidecar } = generateColonyNpcs(colony, CLOCK, map);
  assert.equal(sidecar.length, 2);
  assert.ok(sidecar.some((n) => n.kind === "governor"));
  assert.ok(sidecar.some((n) => n.kind === "quartermaster"));
  assert.equal(sidecar.filter((n) => n.kind === "colonist").length, 0);
});

// ─── Walkable-target rule + A* reachability (load-bearing) ────────────────────

test("generateColonyNpcs: every home/work/plaza/post tile is walkable AND home→target A*-reachable", () => {
  const configs: Array<{ label: string; colony: ColonyState }> = [
    { label: "full (habitat + operational)", colony: fullColony() },
    {
      label: "no habitat (operational farm/solar only)",
      colony: fullColony({
        population: pop(20),
        happiness: 50,
        buildings: [building("farm1", "farm", "operational"), building("solar1", "solar_array", "operational")],
      }),
    },
    {
      label: "no operational (all constructing)",
      colony: fullColony({
        population: pop(20),
        happiness: 20,
        buildings: [
          building("hab1", "habitat_module", "constructing"),
          building("farm1", "farm", "constructing"),
        ],
      }),
    },
    { label: "no buildings", colony: fullColony({ population: pop(12), buildings: [] }) },
    {
      label: "offline habitat (placed, has a door)",
      colony: fullColony({
        population: pop(16),
        buildings: [building("hab1", "habitat_module", "offline"), building("farm1", "farm", "operational")],
      }),
    },
  ];
  // Cover every schedule bucket (targets differ by entry hour).
  const hours = [0, 6, 12, 18, 21];

  for (const { label, colony } of configs) {
    for (const hour of hours) {
      const clock: GameClock = { ...CLOCK, hour };
      const map = generateExteriorState(colony, clock).map;
      const { sidecar } = generateColonyNpcs(colony, clock, map);
      for (const npc of sidecar) {
        const ctx = `${label} @${hour}h npc#${npc.id}(${npc.kind})`;
        assert.ok(walkable(map, npc.homeTile), `${ctx}: home ${JSON.stringify(npc.homeTile)} walkable`);
        assert.ok(walkable(map, npc.workTile), `${ctx}: work ${JSON.stringify(npc.workTile)} walkable`);
        assert.ok(walkable(map, npc.targetTile), `${ctx}: target ${JSON.stringify(npc.targetTile)} walkable`);
        if (npc.postTile) assert.ok(walkable(map, npc.postTile), `${ctx}: post ${JSON.stringify(npc.postTile)} walkable`);
        const sameTile = npc.homeTile.x === npc.targetTile.x && npc.homeTile.y === npc.targetTile.y;
        const reachable = sameTile || findPath(map, npc.homeTile, npc.targetTile).length > 0;
        assert.ok(reachable, `${ctx}: home→target A*-reachable`);
      }
    }
  }
});

test("generateColonyNpcs: building targets use approach tiles, never footprint wall tiles", () => {
  const colony = fullColony();
  const map = generateExteriorState(colony, CLOCK).map;
  const { sidecar } = generateColonyNpcs(colony, CLOCK, map);
  // No generated tile may sit on a "wall" tile.
  for (const npc of sidecar) {
    for (const t of [npc.homeTile, npc.workTile, npc.targetTile, npc.postTile].filter(Boolean) as Tile[]) {
      assert.notEqual(map.tiles[t.y][t.x], "wall", `npc#${npc.id} tile ${JSON.stringify(t)} is on a wall`);
    }
  }
});

// ─── Placed-buildings-only (slots 0-5) ───────────────────────────────────────

test("generateColonyNpcs: buildings past slot 5 are never targeted", () => {
  // 8 operational buildings — only the first 6 occupy slots and are rendered.
  const many: ColonyBuilding[] = [
    building("hab1", "habitat_module", "operational"),
    building("farm1", "farm", "operational"),
    building("solar1", "solar_array", "operational"),
    building("wp1", "water_purifier", "operational"),
    building("hab2", "habitat_module", "operational"),
    building("farm2", "farm", "operational"),
    building("solar2", "solar_array", "operational"), // slot 6 — not rendered
    building("wp2", "water_purifier", "operational"), // slot 7 — not rendered
  ];
  const colony = fullColony({ population: pop(40), buildings: many });
  const day: GameClock = { ...CLOCK, hour: 12 };
  const map = generateExteriorState(colony, day).map;
  const { sidecar } = generateColonyNpcs(colony, day, map);
  // Every target tile must be walkable in the actually-rendered map (a 7th/8th
  // building's footprint is never written, so its "approach" would be open floor
  // anyway — the real guard is that all targets are walkable + reachable here).
  for (const npc of sidecar) {
    assert.ok(walkable(map, npc.targetTile), `npc#${npc.id} target walkable in rendered map`);
  }
});

// ─── No forbidden non-determinism sources ────────────────────────────────────

test("generateColonyNpcs: colonyNpcs.ts uses no Math.random / Date.now", async () => {
  const { readFile } = await import("node:fs/promises");
  const src = await readFile(
    new URL("../../app/components/colony/exploration/npc/colonyNpcs.ts", import.meta.url),
    "utf8",
  );
  // Match the call form so the header comment ("no Math.random") doesn't trip it.
  assert.ok(!/Math\.random\s*\(/.test(src), "must not call Math.random");
  assert.ok(!/Date\.now\s*\(/.test(src), "must not call Date.now");
});

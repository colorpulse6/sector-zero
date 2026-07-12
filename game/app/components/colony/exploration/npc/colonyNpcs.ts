// Deterministic colony NPC generation (Phase 5a, Task 2).
//
// Pure function of (colony, gameClock, map, factionStandings) — no Date.now,
// no Math.random. All procedural choices come from a mulberry32 PRNG seeded off
// colony.layoutSeed, so the same inputs always produce an identical NPC set at
// identical tiles. Standings feed greeting tone, quartermaster prices, and the
// hated/hostile trade refusal.
//
// Builds each ColonyNpc (identity, home/work/post, resolved entry-hour target,
// spawn position) and its paired FPNPC render/interaction projection (dialog,
// shop, sprite from npcDialog.ts). generateExteriorState's own signature is
// untouched — NPC wiring happens in a later orchestrator task.
//
// Walkable-target rule (load-bearing): building footprints are solid "wall"
// tiles with a single carved "door"; the interior is unreachable. So every
// home/work/plaza/post tile is a walkable "floor"/"door" tile — a building's
// target is the APPROACH tile (the open cell just outside its door), never a
// footprint wall. Only placed buildings (slots 0-5) are targeted; if a computed
// approach tile isn't walkable, we fall back to a plaza tile.

import type { FPNPC, FPDialogLine, FPShopItem, BoardingMap } from "../../../engine/types";
import type { ColonyState, ColonyBuilding, FactionStanding, GameClock } from "../../shared/colonyTypes";
import { SPRITES } from "../../../engine/sprites";
import { OUTPOST_TEMPLATE, type Slot } from "../outpostTemplate";
import { BUILDING_FOOTPRINTS } from "../buildingTiles";
import { assignSlots } from "../colonyLayout";
import { merchantRefusesTrade, primaryFactionForPlanet, rankFor } from "../../shared/factionLedger";
import { buildGovernorDialog, buildQuartermasterDialog, buildQuartermasterShop, buildColonistBark } from "./npcDialog";
import { scheduleTargetTile } from "./npcSchedule";
import type { ColonyNpc, Tile, GeneratedNpcs, NpcKind } from "./types";

const COLONIST_K = 4;           // one colonist per K population
const COLONIST_CAP = 10;        // hard cap on colonists
const COLONIST_SPRITES = [SPRITES.NPC_SURVIVOR, SPRITES.NPC_SCAVENGER];

// Billboard fallback colors (only used if the sprite fails to load).
const GOVERNOR_COLOR = "#e8c060";
const QUARTERMASTER_COLOR = "#5fd0c0";
const COLONIST_COLOR = "#a0a0b0";

// Statuses that write walls + carve a door (writeBuildingAt) — i.e. a building
// physically present enough to be a home. constructing/destroyed have no door.
const PLACED_STATUSES = new Set<ColonyBuilding["status"]>(["operational", "damaged", "offline"]);

function isWalkable(map: BoardingMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const t = map.tiles[y][x];
  return t === "floor" || t === "door";
}

// mulberry32 — tiny deterministic PRNG. Seeded from layoutSeed; no global state.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The walkable approach tile just outside a building's door, or null if that
 *  cell is somehow not walkable. Door geometry matches writeBuildingAt /
 *  findBuildingDoorAt exactly (all Phase-1 buildings are south-door). */
function approachTile(building: ColonyBuilding, slot: Slot, map: BoardingMap): Tile | null {
  const fp = BUILDING_FOOTPRINTS[building.type];
  if (!fp) return null;
  const doorX =
    fp.doorSide === "east" ? slot.anchorX + fp.w - 1
    : fp.doorSide === "west" ? slot.anchorX
    : slot.anchorX + Math.floor(fp.w / 2);
  const doorY =
    fp.doorSide === "south" ? slot.anchorY + fp.h - 1
    : fp.doorSide === "north" ? slot.anchorY
    : slot.anchorY + Math.floor(fp.h / 2);
  const dx = fp.doorSide === "east" ? 1 : fp.doorSide === "west" ? -1 : 0;
  const dy = fp.doorSide === "south" ? 1 : fp.doorSide === "north" ? -1 : 0;
  const ax = doorX + dx;
  const ay = doorY + dy;
  return isWalkable(map, ax, ay) ? { x: ax, y: ay } : null;
}

function happinessTierFor(happiness: number): ColonyNpc["happinessTier"] {
  if (happiness >= 66) return "content";
  if (happiness >= 33) return "strained";
  return "grim";
}

/**
 * Deterministically generate the colony's NPC set — governor + quartermaster
 * (always) plus up to COLONIST_CAP background colonists sized by population —
 * as a paired { fpNpcs, sidecar } (fpNpcs[i] and sidecar[i] share an id).
 */
export function generateColonyNpcs(
  colony: ColonyState,
  gameClock: GameClock,
  map: BoardingMap,
  factionStandings: readonly FactionStanding[] = [],
): GeneratedNpcs {
  const rng = mulberry32(colony.layoutSeed);
  const { plaza, landingPad, spawn } = OUTPOST_TEMPLATE;

  // Faction context (Phase 5a): the colony answers to its planet's primary
  // faction — greeting tone, quartermaster prices, and the trade refusal all
  // key off this rank. A missing ledger row reads as neutral.
  const factionRank = rankFor(factionStandings, primaryFactionForPlanet(colony.planetId));
  const tradeRefused = merchantRefusesTrade(factionRank);

  // Walkable plaza tiles (social space + the universal fallback for any target).
  const plazaTiles: Tile[] = [];
  for (let y = plaza.y; y < plaza.y + plaza.h; y++) {
    for (let x = plaza.x; x < plaza.x + plaza.w; x++) {
      if (isWalkable(map, x, y)) plazaTiles.push({ x, y });
    }
  }
  const fallbackPlaza = (i: number): Tile =>
    plazaTiles.length > 0 ? plazaTiles[((i % plazaTiles.length) + plazaTiles.length) % plazaTiles.length]
                          : { x: spawn.x, y: spawn.y };

  // Plaza center (governor's post) — walkable by construction; guarded anyway.
  const pcx = plaza.x + Math.floor(plaza.w / 2);
  const pcy = plaza.y + Math.floor(plaza.h / 2);
  const plazaCenter: Tile = isWalkable(map, pcx, pcy) ? { x: pcx, y: pcy } : fallbackPlaza(0);

  // Quartermaster's stall — a walkable tile just north of the landing pad, so
  // the NPC never sits ON a pad-interact tile.
  let padStall: Tile = plazaCenter;
  const stallY = landingPad.y - 1;
  for (let x = landingPad.x; x < landingPad.x + landingPad.w; x++) {
    if (isWalkable(map, x, stallY)) { padStall = { x, y: stallY }; break; }
  }

  // Placed-building approach-tile pools (insertion order → deterministic).
  const slotMap = assignSlots(colony);
  const habitatApproaches: Tile[] = [];
  const operationalApproaches: Tile[] = [];
  for (const b of colony.buildings.slice(0, 6)) {
    const slotId = slotMap.get(b.id);
    if (slotId === undefined) continue;
    const ap = approachTile(b, OUTPOST_TEMPLATE.slots[slotId], map);
    if (!ap) continue;
    if (b.type === "habitat_module" && PLACED_STATUSES.has(b.status)) habitatApproaches.push(ap);
    if (b.status === "operational") operationalApproaches.push(ap);
  }
  // Round-robin the named NPCs' homes across the habitat approach pool so the
  // governor and quartermaster don't spawn stacked on the same tile at night
  // when ≥2 approaches exist. With exactly one (typical Tier-1, single
  // Habitat) they still share it — accepted limitation, not worth chasing.
  const namedHomeFor = (i: number): Tile =>
    habitatApproaches.length > 0 ? habitatApproaches[i % habitatApproaches.length] : plazaCenter;

  const tier = happinessTierFor(colony.happiness);
  const sidecar: ColonyNpc[] = [];
  const fpNpcs: FPNPC[] = [];

  const finalize = (spec: {
    id: number;
    kind: NpcKind;
    name: string;
    sprite: string;
    color: string;
    homeTile: Tile;
    workTile: Tile;
    postTile: Tile | null;
    dialog: FPDialogLine[];
    shopItems?: FPShopItem[];
    fpType: FPNPC["type"];
    canBuy?: boolean;   // §I: enables the REAL FP purchase flow — quartermaster only
  }): void => {
    const millSeed = Math.floor(rng() * 0x7fffffff);
    const npc: ColonyNpc = {
      id: spec.id,
      kind: spec.kind,
      name: spec.name,
      sprite: spec.sprite,
      posX: 0,
      posY: 0,
      homeTile: spec.homeTile,
      workTile: spec.workTile,
      postTile: spec.postTile,
      targetTile: { x: 0, y: 0 },
      happinessTier: tier,
      path: [],
      pathComputed: false,
      millSeed,
      millCounter: 0,
    };
    npc.targetTile = scheduleTargetTile(npc, gameClock.hour, plazaTiles);
    // Colonists spawn home and walk to their target (a later stepping task);
    // named NPCs spawn at their entry-hour target (post, or home off-hours).
    const spawnTile = spec.kind === "colonist" ? spec.homeTile : npc.targetTile;
    npc.posX = spawnTile.x + 0.5;
    npc.posY = spawnTile.y + 0.5;
    sidecar.push(npc);
    fpNpcs.push({
      id: spec.id,
      x: npc.posX,
      y: npc.posY,
      name: spec.name,
      type: spec.fpType,
      dialog: spec.dialog,
      shopItems: spec.shopItems,
      color: spec.color,
      interacted: false,
      sprite: spec.sprite,
      canBuy: spec.canBuy,
    });
  };

  let id = 0;

  // ─── Governor (always) — lore NPC, live status readout, plaza-center post ──
  finalize({
    id: id++,
    kind: "governor",
    name: `Overseer ${colony.name}`,
    sprite: SPRITES.NPC_VOSS,
    color: GOVERNOR_COLOR,
    homeTile: namedHomeFor(0),
    workTile: plazaCenter,
    postTile: plazaCenter,
    dialog: buildGovernorDialog(colony, factionRank),
    fpType: "lore",
  });

  // ─── Quartermaster (always) — merchant, working shop, stall by the pad ─────
  // At hated/hostile rank the merchant refuses trade: curt refusal dialog and
  // NO shopItems/canBuy — the FP engine only opens a shop when shopItems exist,
  // so the shop simply never opens.
  finalize({
    id: id++,
    kind: "quartermaster",
    name: "Quartermaster",
    sprite: SPRITES.NPC_KAEL,
    color: QUARTERMASTER_COLOR,
    homeTile: namedHomeFor(1),
    workTile: padStall,
    postTile: padStall,
    dialog: buildQuartermasterDialog(factionRank),
    shopItems: tradeRefused ? undefined : buildQuartermasterShop(colony, factionRank),
    fpType: "merchant",
    canBuy: tradeRefused ? undefined : true,   // the ONLY NPC with a real (buy-enabled) shop — see §I
  });

  // ─── Colonists — count from population, capped; home/work deterministic ────
  const colonistCount = Math.min(Math.floor(colony.population.total / COLONIST_K), COLONIST_CAP);
  const halfPlaza = Math.max(1, Math.floor(plazaTiles.length / 2));
  for (let i = 0; i < colonistCount; i++) {
    const cid = id++;
    const home =
      habitatApproaches.length > 0
        ? habitatApproaches[Math.floor(rng() * habitatApproaches.length)]
        : fallbackPlaza(cid);
    const work =
      operationalApproaches.length > 0
        ? operationalApproaches[Math.floor(rng() * operationalApproaches.length)]
        : fallbackPlaza(cid + halfPlaza);
    finalize({
      id: cid,
      kind: "colonist",
      name: "Colonist",
      sprite: COLONIST_SPRITES[i % COLONIST_SPRITES.length],
      color: COLONIST_COLOR,
      homeTile: home,
      workTile: work,
      postTile: null,
      dialog: buildColonistBark(tier, cid),
      fpType: "lore",
    });
  }

  return { fpNpcs, sidecar };
}

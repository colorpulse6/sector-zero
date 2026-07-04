// Governor / Quartermaster / Colonist dialog + shop builders (Phase 2, Task 3).
//
// Pure functions only — no rendering, no engine mutation, no Date.now/Math.random.
// buildGovernorDialog is a pure function of ColonyState; buildQuartermasterShop
// is a pure function of colony.tier; buildColonistBark is a pure function of
// (happinessTier, seed). Output feeds FPNPC construction in a later task (see
// ../npc/types.ts — ColonyNpc.happinessTier, millSeed).

import type { FPDialogLine, FPShopItem, ConsumableId } from "../../../engine/types";
import type { ColonyState, ColonyBuilding, BuildingType, Threat } from "../../shared/colonyTypes";
import { getConsumableDef } from "../../../engine/planets";

const GOVERNOR = "Governor";
const COLONIST = "Colonist";

// ─── buildGovernorDialog ────────────────────────────────────────────────────

const TIER_WORDS: Record<ColonyState["tier"], string> = {
  1: "one",
  2: "two",
  3: "three",
  4: "four",
};

// Buildings worth calling out by name as *problems*. `constructing` is NOT here:
// it's non-operational but in-progress, not broken — we exclude it from the
// operational count without naming it as a fault.
const BROKEN_STATUSES = new Set<ColonyBuilding["status"]>(["damaged", "offline", "destroyed"]);

/** "water_purifier" -> "water purifier" */
function buildingLabel(type: BuildingType): string {
  return type.replace(/_/g, " ");
}

function populationLine(colony: ColonyState): FPDialogLine {
  const { total, growthRate } = colony.population;
  const trend =
    growthRate > 0 ? "climbing — more hands arriving every cycle"
    : growthRate < 0 ? "slipping, and we're losing ground"
    : "holding steady";
  return { speaker: GOVERNOR, text: `Population's ${trend}. We're at ${total} now.` };
}

function buildingsLine(colony: ColonyState): FPDialogLine {
  const tierWord = TIER_WORDS[colony.tier];
  const total = colony.buildings.length;

  if (total === 0) {
    return { speaker: GOVERNOR, text: `Tier ${tierWord} — we haven't broken ground on a single building yet.` };
  }

  const operational = colony.buildings.filter((b) => b.status === "operational").length;
  if (operational === total) {
    return { speaker: GOVERNOR, text: `Tier ${tierWord} — all ${total} of our buildings are operational.` };
  }

  const base = `Tier ${tierWord} — ${operational} of ${total} buildings operational.`;
  const broken = colony.buildings.filter((b) => BROKEN_STATUSES.has(b.status));
  if (broken.length === 0) {
    // The shortfall is all in-progress construction — nothing broken to name.
    return { speaker: GOVERNOR, text: `${base} The rest are still going up.` };
  }
  const names = broken.map((b) => `the ${buildingLabel(b.type)} (${b.status})`).join(", ");
  return {
    speaker: GOVERNOR,
    text: `${base} We'd be further along if not for ${names}.`,
  };
}

// Ordered highest-threshold first so `.find` picks the tightest match.
const HAPPINESS_DESCRIPTORS: ReadonlyArray<readonly [min: number, text: string]> = [
  [75, "morale's high — folks are in good spirits"],
  [50, "morale's steady, nothing to worry about"],
  [25, "morale's uneasy — people are on edge"],
  [0, "morale's grim — this colony is barely holding together"],
];

function happinessLine(colony: ColonyState): FPDialogLine {
  const entry =
    HAPPINESS_DESCRIPTORS.find(([min]) => colony.happiness >= min) ??
    HAPPINESS_DESCRIPTORS[HAPPINESS_DESCRIPTORS.length - 1];
  return { speaker: GOVERNOR, text: `And the people? ${entry[1]}.` };
}

const THREAT_KIND_LABELS: Record<Threat["kind"], string> = {
  raid_incoming: "raid inbound",
  siege_ongoing: "siege underway",
  disaster_active: "disaster in progress",
  supply_disruption: "supply lines disrupted",
};

function threatsLine(colony: ColonyState): FPDialogLine | null {
  if (colony.activeThreats.length === 0) return null;
  const [first, ...rest] = colony.activeThreats;
  const label = THREAT_KIND_LABELS[first.kind] ?? first.kind;
  const extra = rest.length > 0 ? ` — ${rest.length} more besides.` : ".";
  return { speaker: GOVERNOR, text: `Keep your guard up: ${first.severity} ${label}${extra}` };
}

/**
 * A pure status readout in the Governor's voice, composed from live
 * ColonyState: population + growth trend, tier + operational-vs-total
 * buildings (naming any damaged/offline/destroyed one), a happiness
 * descriptor, and any active threats.
 */
export function buildGovernorDialog(colony: ColonyState): FPDialogLine[] {
  const lines: FPDialogLine[] = [populationLine(colony), buildingsLine(colony), happinessLine(colony)];
  const threat = threatsLine(colony);
  if (threat) lines.push(threat);
  return lines;
}

// ─── buildQuartermasterShop ─────────────────────────────────────────────────

// Ordered earliest-unlocking first (see CONSUMABLE_DEFS in engine/planets.ts):
//   hull-repair     — unlocks after Verdania   (world 1, 0 stars)  — earliest possible
//   cryo-charge     — unlocks after Glaciem    (world 2, 8 stars)
//   shield-charge   — unlocks after Ossuary    (world 4, 20 stars)
//   scanner-pulse   — unlocks after any 4 planets completed
// weapon-overcharge (Ashfall, world 6, 36 stars) is deliberately excluded —
// it's the one consumable that isn't "generally/early available".
const QUARTERMASTER_STOCK_ORDER: ConsumableId[] = ["hull-repair", "cryo-charge", "shield-charge", "scanner-pulse"];

// Bigger, more-established colonies carry more stock. Deterministic in
// colony.tier alone; capped at the length of QUARTERMASTER_STOCK_ORDER.
const STOCK_COUNT_BY_TIER: Record<ColonyState["tier"], number> = { 1: 2, 2: 3, 3: 4, 4: 4 };

/**
 * A small, deterministic set of real, early-available consumables sized by
 * colony tier. Every item's `itemId` is round-tripped through
 * `getConsumableDef`, so it always resolves to a real ConsumableId.
 */
export function buildQuartermasterShop(colony: ColonyState): FPShopItem[] {
  const count = STOCK_COUNT_BY_TIER[colony.tier];
  return QUARTERMASTER_STOCK_ORDER.slice(0, count).map((id): FPShopItem => {
    const def = getConsumableDef(id);
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      cost: def.cost,
      type: "consumable",
      itemId: def.id,
    };
  });
}

// ─── buildColonistBark ──────────────────────────────────────────────────────

const COLONIST_BARKS: Record<"content" | "strained" | "grim", string[]> = {
  content: [
    "Good harvest this cycle. Can't complain.",
    "Sun's out, bellies are full, nobody's shooting at us. I'll take it.",
    "Heard the Governor's pleased with how things are going. Feels good to hear.",
    "Kids are laughing in the plaza again. That's how you know it's a good stretch.",
  ],
  strained: [
    "Rations are stretched thin. Hoping the next shipment's on time.",
    "Nobody's said it's bad. Nobody's said it's good, either.",
    "We're holding on, but it's starting to feel like just holding on.",
    "Water's rationed again this week. Third time this month.",
  ],
  grim: [
    "I don't know how much longer we can hold this place together.",
    "Lost another one last cycle. Keep looking over your shoulder out there.",
    "Nobody sleeps easy anymore. Not since the last raid.",
    "Some days I wonder if we should've stayed on the ship.",
  ],
};

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/**
 * 1-2 short, in-character colonist barks, deterministic from
 * (happinessTier, seed) — same inputs always produce the same lines.
 */
export function buildColonistBark(tier: "content" | "strained" | "grim", seed: number): FPDialogLine[] {
  const pool = COLONIST_BARKS[tier];
  const firstIndex = mod(seed, pool.length);
  const first = pool[firstIndex];
  const lines: FPDialogLine[] = [{ speaker: COLONIST, text: first }];

  // Deterministically add a second bark for roughly half of seeds — gives
  // idle colonists some variety without needing true randomness.
  if (mod(seed, 2) === 0 && pool.length > 1) {
    const second = pool[mod(firstIndex + 1, pool.length)];
    lines.push({ speaker: COLONIST, text: second });
  }

  return lines;
}

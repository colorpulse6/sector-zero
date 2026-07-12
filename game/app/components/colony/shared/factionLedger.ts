// Faction standing ledger (Phase 5a).
//
// Pure module — no engine imports at runtime, no window/document, no
// Date.now/Math.random. Owns the rank thresholds, the price-multiplier table,
// and the immutable standing math that everything else builds on: save
// migration defaults, quartermaster pricing/refusal, greeting tone, planet
// mission rewards, and (Phase 5b) crime/bounty deltas.

import type { ColonyId, ColonyState, FactionId, FactionStanding } from "./colonyTypes";

export type FactionRank = FactionStanding["rank"];
/** @deprecated Alias for FactionRank — prefer the explicit name. */
export type Rank = FactionRank;

// ─── Factions ───────────────────────────────────────────────────────────────

/** The compile-time set of known faction ids. colonyTypes.FactionId stays
 *  `string` (the save-file wire type — Phase 5b may mint ids dynamically);
 *  code that hands out standing should use this union. */
export type KnownFactionId = "earth_command" | "ashfall_camp" | "free_traders";

export interface FactionDef {
  id: KnownFactionId;
  name: string;
  description: string;
}

export const FACTIONS: readonly FactionDef[] = [
  { id: "earth_command", name: "Earth Command", description: "The homeworld authority that commissions the campaign's missions." },
  { id: "ashfall_camp", name: "Ashfall Camp", description: "Hardscrabble survivors of the Ashfall dust — the frontier's oldest settlement." },
  { id: "free_traders", name: "Free Traders", description: "The loose merchant compact that keeps frontier colonies supplied." },
];

/** A planet's native faction — the one its colony merchants and greetings
 *  answer to. Unmapped planets fall back to the Free Traders (generic
 *  frontier commerce). */
const PLANET_PRIMARY_FACTION: Readonly<Record<string, KnownFactionId>> = {
  ashfall: "ashfall_camp",
};

export function primaryFactionForPlanet(planetId: string): KnownFactionId {
  return PLANET_PRIMARY_FACTION[planetId] ?? "free_traders";
}

/** Standing earned with a planet's native faction each time the player
 *  completes a planet mission there (repeatable, not first-completion gated).
 *  Only Ashfall has a native camp today; consumed by engine/planets.ts. */
export const PLANET_MISSION_STANDING: Readonly<Record<string, { factionId: KnownFactionId; delta: number }>> = {
  ashfall: { factionId: "ashfall_camp", delta: 8 },
};

// ─── Rank thresholds ────────────────────────────────────────────────────────

export function clampStanding(standing: number): number {
  return Math.max(-100, Math.min(100, standing));
}

/** Spec bands: -100..-80 hostile / -79..-40 hated / -39..39 neutral /
 *  40..79 liked / 80..100 allied. Out-of-range input clamps first. */
export function rankFromStanding(standing: number): FactionRank {
  const s = clampStanding(standing);
  if (s <= -80) return "hostile";
  if (s <= -40) return "hated";
  if (s < 40) return "neutral";
  if (s < 80) return "liked";
  return "allied";
}

// ─── Price modifiers ────────────────────────────────────────────────────────

// Spec effects table. A hostile faction bans the player from its shops
// outright — merchantRefusesTrade gates before any price math — so the
// hostile rows are defensive fallbacks matching hated, kept only so both
// lookups stay total over FactionRank.
const BUY_MULTIPLIER: Record<FactionRank, number> = {
  allied: 0.9,   // buy -10%
  liked: 0.95,   // buy -5%
  neutral: 1,
  hated: 2,      // buy 2×
  hostile: 2,
};

const SELL_MULTIPLIER: Record<FactionRank, number> = {
  allied: 1.1,   // sell +10%
  liked: 1.05,   // sell +5%
  neutral: 1,
  hated: 0.5,    // sell -50%
  hostile: 0.5,
};

export function buyPriceMultiplier(rank: FactionRank): number {
  return BUY_MULTIPLIER[rank];
}

export function sellPriceMultiplier(rank: FactionRank): number {
  return SELL_MULTIPLIER[rank];
}

/** THE buy-price helper. Every site that shows OR charges a faction-adjusted
 *  price must go through this one function so display and charge can never
 *  disagree. Neutral is the identity (returns baseCost unchanged). */
export function adjustedBuyPrice(baseCost: number, rank: FactionRank): number {
  return Math.ceil(baseCost * buyPriceMultiplier(rank));
}

/** A canBuy merchant turns the player away entirely at hated or worse
 *  (hated: "some merchants refuse trade"; hostile: banned from the colony). */
export function merchantRefusesTrade(rank: FactionRank): boolean {
  return rank === "hated" || rank === "hostile";
}

// ─── Standing math ──────────────────────────────────────────────────────────

/** Clamped delta against a single entry; rank recomputed from the result. */
export function applyStandingDelta(current: FactionStanding, delta: number): FactionStanding {
  const nextStanding = clampStanding(current.standing + delta);
  return {
    ...current,
    standing: nextStanding,
    rank: rankFromStanding(nextStanding),
  };
}

/** Immutable standings update — clamps, recomputes rank, and creates the entry
 *  at 0 + delta when the faction has no ledger row yet. The shared delta path
 *  for every standing source (planet mission rewards now; Phase 5b
 *  crime/bounty/quest deltas reuse this). */
export function adjustStanding(standings: FactionStanding[], factionId: FactionId, delta: number): FactionStanding[] {
  const idx = standings.findIndex((f) => f.factionId === factionId);
  if (idx < 0) {
    const standing = clampStanding(delta);
    return [...standings, { factionId, standing, rank: rankFromStanding(standing), permissions: [] }];
  }
  const next = [...standings];
  next[idx] = applyStandingDelta(next[idx], delta);
  return next;
}

export function standingFor(standings: readonly FactionStanding[], factionId: FactionId): number {
  return standings.find((f) => f.factionId === factionId)?.standing ?? 0;
}

/** Rank lookup that treats a missing ledger row as 0 (neutral). */
export function rankFor(standings: readonly FactionStanding[], factionId: FactionId): FactionRank {
  return rankFromStanding(standingFor(standings, factionId));
}

/** All known factions at 0 / neutral — the fresh-save + migration default. */
export function defaultFactionStandings(): FactionStanding[] {
  return FACTIONS.map((f) => ({ factionId: f.id, standing: 0, rank: "neutral" as const, permissions: [] }));
}

/** The rank a colony's merchants trade at — the player's rank with the
 *  colony planet's primary faction. Neutral when the colony can't be
 *  resolved (defensive: only colony shops route purchases today). */
export function colonyMerchantRank(
  colonies: ReadonlyArray<Pick<ColonyState, "id" | "planetId">>,
  standings: readonly FactionStanding[],
  colonyId: ColonyId | null | undefined,
): FactionRank {
  const colony = colonyId != null ? colonies.find((c) => c.id === colonyId) : undefined;
  if (!colony) return "neutral";
  return rankFor(standings, primaryFactionForPlanet(colony.planetId));
}

import type { FactionStanding } from "./colonyTypes";

export type Rank = FactionStanding["rank"];

export function rankFromStanding(standing: number): Rank {
  if (standing <= -80) return "hostile";
  if (standing <= -40) return "hated";
  if (standing < 40) return "neutral";
  if (standing < 80) return "liked";
  return "allied";
}

/**
 * Phase 0 stub. Real faction math (reputation deltas by severity,
 * cross-faction propagation, permissions set generation) lands in Phase 5a.
 */
export function applyStandingDelta(current: FactionStanding, delta: number): FactionStanding {
  const nextStanding = Math.max(-100, Math.min(100, current.standing + delta));
  return {
    ...current,
    standing: nextStanding,
    rank: rankFromStanding(nextStanding),
  };
}

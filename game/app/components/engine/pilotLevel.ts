import type { PilotMilestone } from "./types";

/** Max pilot level in this MVP phase */
export const MAX_PILOT_LEVEL = 30;

/**
 * CUMULATIVE XP required to reach each level (1-indexed: XP_CURVE[1] = 0 for level 1).
 * Each entry is the TOTAL XP needed, not the increment for that level.
 * Exponential curve: early levels ~1 mission (500-2000 XP), later levels 5-8 missions.
 * NOTE: When extending past MAX_PILOT_LEVEL, re-validate the curve produces reasonable values.
 */
const XP_CURVE: number[] = [0]; // index 0 unused
XP_CURVE.push(0); // Level 1 is free (0 cumulative XP)
for (let lv = 2; lv <= MAX_PILOT_LEVEL; lv++) {
  const increment = 800 * (lv - 1) + Math.floor(50 * Math.pow(lv, 1.8));
  XP_CURVE.push(XP_CURVE[lv - 1] + increment);
}

/** Get the cumulative XP required to reach a given level. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level > MAX_PILOT_LEVEL) return XP_CURVE[MAX_PILOT_LEVEL];
  return XP_CURVE[level];
}

/** Calculate pilot level from total cumulative XP. */
export function calcPilotLevel(totalXp: number): number {
  for (let lv = MAX_PILOT_LEVEL; lv >= 1; lv--) {
    if (totalXp >= XP_CURVE[lv]) return lv;
  }
  return 1;
}

/** XP progress fraction toward next level (0.0 - 1.0). */
export function xpProgress(totalXp: number, currentLevel: number): number {
  if (currentLevel >= MAX_PILOT_LEVEL) return 1;
  const currentReq = xpForLevel(currentLevel);
  const nextReq = xpForLevel(currentLevel + 1);
  const range = nextReq - currentReq;
  if (range <= 0) return 1;
  return Math.min(1, (totalXp - currentReq) / range);
}

/** Total skill points earned at a given level (1 per 3 levels). */
export function skillPointsAtLevel(level: number): number {
  return Math.floor(level / 3);
}

// ─── Passive Bonuses ────────────────────────────────────────────────

/** +1% material drop rate per level */
export function materialDropBonus(level: number): number {
  return level * 0.01;
}

/** +0.5% credit bonus per level */
export function creditBonus(level: number): number {
  return level * 0.005;
}

/** +1 HP per 10 levels */
export function bonusHp(level: number): number {
  return Math.floor(level / 10);
}

// ─── Milestones ─────────────────────────────────────────────────────

const MILESTONE_DEFS: { level: number; label: string }[] = [
  { level: 5, label: "Interceptor Ship" },
  { level: 10, label: "Modular Loadouts" },
  { level: 15, label: "Gunship" },
  { level: 20, label: "Workshop" },
  { level: 25, label: "Scout Ship" },
  { level: 30, label: "Prestige Weapons" },
];

export function getMilestones(currentLevel: number): PilotMilestone[] {
  return MILESTONE_DEFS.map((m) => ({
    level: m.level,
    label: m.label,
    unlocked: currentLevel >= m.level,
  }));
}

// ─── Dev self-tests ─────────────────────────────────────────────────

export function __runPilotLevelSelfTests(): void {
  console.assert(xpForLevel(1) === 0, "Level 1 requires 0 XP");
  console.assert(calcPilotLevel(0) === 1, "0 XP = level 1");
  console.assert(calcPilotLevel(999999999) === MAX_PILOT_LEVEL, "Huge XP = max level");
  console.assert(skillPointsAtLevel(3) === 1, "Level 3 = 1 skill point");
  console.assert(skillPointsAtLevel(6) === 2, "Level 6 = 2 skill points");
  console.assert(skillPointsAtLevel(30) === 10, "Level 30 = 10 skill points");
  console.assert(bonusHp(10) === 1, "Level 10 = +1 HP");
  console.assert(bonusHp(20) === 2, "Level 20 = +2 HP");
  console.assert(bonusHp(7) === 0, "Level 7 = +0 HP");
  for (let i = 2; i <= MAX_PILOT_LEVEL; i++) {
    console.assert(XP_CURVE[i] > XP_CURVE[i - 1], `XP curve not increasing at level ${i}`);
  }
}

if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
  __runPilotLevelSelfTests();
}

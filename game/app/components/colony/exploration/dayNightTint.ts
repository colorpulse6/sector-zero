export interface HslShift {
  hueShift: number;
  saturationMul: number;
  lightnessMul: number;
}

/** The five day/night buckets, keyed by in-game hour (0-23). Shared source of
 *  truth for both the cosmetic tint (tintForHour) and the NPC schedule
 *  (npcSchedule.ts) so they can never drift apart. */
export type DayBucket = "night" | "dawn" | "day" | "dusk" | "evening";

/**
 * Map an in-game hour (0-23) to its day/night bucket.
 * Boundaries: night <5 || >=22, dawn 5-6, day 7-16, dusk 17-19, evening 20-21.
 */
export function bucketForHour(hour: number): DayBucket {
  if (hour < 5 || hour >= 22) return "night";
  if (hour < 7) return "dawn";
  if (hour < 17) return "day";
  if (hour < 20) return "dusk";
  return "evening";
}

/**
 * Cosmetic HSL shift applied to environment art based on in-game hour (0-23).
 * Day/night has no gameplay effect in Phase 2. Derives from bucketForHour so
 * the tint and the NPC schedule share one set of boundaries.
 */
export function tintForHour(hour: number): HslShift {
  const bucket = bucketForHour(hour);
  if (bucket === "night") return { hueShift: -20, saturationMul: 0.7, lightnessMul: 0.55 };
  if (bucket === "dawn") return { hueShift: 15, saturationMul: 0.9, lightnessMul: 0.7 };
  if (bucket === "day") return { hueShift: 0, saturationMul: 1.0, lightnessMul: 1.0 };
  if (bucket === "dusk") return { hueShift: 20, saturationMul: 1.05, lightnessMul: 0.85 };
  return { hueShift: -10, saturationMul: 0.8, lightnessMul: 0.7 }; // evening
}

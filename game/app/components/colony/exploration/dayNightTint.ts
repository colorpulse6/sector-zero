export interface HslShift {
  hueShift: number;
  saturationMul: number;
  lightnessMul: number;
}

/**
 * Cosmetic HSL shift applied to environment art based on in-game hour (0-23).
 * Day/night has no gameplay effect in Phase 2.
 */
export function tintForHour(hour: number): HslShift {
  // Night: 22-05
  if (hour >= 22 || hour < 5) return { hueShift: -20, saturationMul: 0.7, lightnessMul: 0.55 };
  // Dawn: 5-7
  if (hour < 7) return { hueShift: 15, saturationMul: 0.9, lightnessMul: 0.7 };
  // Day: 7-17
  if (hour < 17) return { hueShift: 0, saturationMul: 1.0, lightnessMul: 1.0 };
  // Dusk: 17-20
  if (hour < 20) return { hueShift: 20, saturationMul: 1.05, lightnessMul: 0.85 };
  // Evening: 20-22
  return { hueShift: -10, saturationMul: 0.8, lightnessMul: 0.7 };
}

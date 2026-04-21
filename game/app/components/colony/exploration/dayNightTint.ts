export interface HslShift {
  hueShift: number;
  saturationMul: number;
  lightnessMul: number;
}

// Stub — final hour-based logic lands in Task 6
export function tintForHour(hour: number): HslShift {
  return { hueShift: 0, saturationMul: 1, lightnessMul: 1 };
}

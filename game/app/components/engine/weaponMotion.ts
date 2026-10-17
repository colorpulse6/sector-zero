export interface WeaponMotion {
  /** Distance-driven gait angle, in radians. */
  phase: number;
  /** Walking envelope, easing back to zero at rest. */
  amplitude: number;
  /** Existing muzzle-flash timer normalized to 0..1. */
  recoil: number;
}

interface WeaponMotionStep {
  deltaX: number;
  deltaY: number;
  dtMs: number;
  gunFireTimer: number;
  dialogueActive: boolean;
}

const TAU = Math.PI * 2;
const STRIDE_TILES = 2.4;
const MAX_DT_MS = 16.67 * 3;
const SETTLE_MS = 120;
const FIRE_FRAMES = 6;

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function unit(value: number): number {
  return Math.max(0, Math.min(1, finite(value)));
}

function phaseAngle(value: number): number {
  const phase = finite(value) % TAU;
  return phase < 0 ? phase + TAU : phase;
}

function normalized(motion?: WeaponMotion): WeaponMotion {
  return {
    phase: phaseAngle(motion?.phase ?? 0),
    amplitude: unit(motion?.amplitude ?? 0),
    recoil: unit(motion?.recoil ?? 0),
  };
}

/** Pure simulation step. Deltas must come from collision-resolved movement. */
export function stepWeaponMotion(previous: WeaponMotion | undefined, step: WeaponMotionStep): WeaponMotion {
  if (step.dialogueActive) return previous ?? normalized();
  const motion = normalized(previous);
  const dtMs = Math.max(0, Math.min(MAX_DT_MS, finite(step.dtMs)));
  if (dtMs === 0) return motion;

  const distance = finite(Math.hypot(finite(step.deltaX), finite(step.deltaY)));
  return {
    phase: phaseAngle(motion.phase + (distance % STRIDE_TILES) / STRIDE_TILES * TAU),
    // Distance drives both gait and its attack envelope, so splitting the same
    // travel into different simulation steps produces the same moving pose.
    amplitude: distance > 0
      ? 1 - (1 - motion.amplitude) * Math.exp(-distance / 0.2)
      : motion.amplitude * Math.exp(-dtMs / SETTLE_MS),
    recoil: unit(step.gunFireTimer / FIRE_FRAMES),
  };
}

/** Read-only HUD offsets in canvas pixels; safe before the first update. */
export function weaponOffsets(motion?: WeaponMotion): { x: number; y: number } {
  const { phase, amplitude, recoil } = normalized(motion);
  return {
    x: Math.sin(phase) * 3 * amplitude,
    y: (1 - Math.cos(phase * 2)) * amplitude + recoil * 5,
  };
}

import type { WeaponType, AffinityResult } from "./types";

export const WEAPON_TYPES: WeaponType[] = ["kinetic", "energy", "incendiary", "cryogenic"];

export interface WeaponTypeMeta {
  id: WeaponType;
  name: string;
  color: string;
  glowColor: string;
  icon: string;
}

export const WEAPON_TYPE_META: Record<WeaponType, WeaponTypeMeta> = {
  kinetic:    { id: "kinetic",    name: "Kinetic",    color: "#e8e8ee", glowColor: "#ffffff", icon: "K" },
  energy:     { id: "energy",     name: "Energy",     color: "#44ccff", glowColor: "#88eeff", icon: "E" },
  incendiary: { id: "incendiary", name: "Incendiary", color: "#ff6a1a", glowColor: "#ffaa44", icon: "I" },
  cryogenic:  { id: "cryogenic",  name: "Cryogenic",  color: "#aaddff", glowColor: "#ddf2ff", icon: "C" },
};

export const AFFINITY_MULTIPLIER: Record<AffinityResult, number> = {
  effective: 1.5,
  neutral:   1.0,
  resisted:  0.5,
};

export function __runWeaponTypeSelfTests(): void {
  console.assert(WEAPON_TYPES.length === 4, "WEAPON_TYPES must have exactly 4 entries");
  console.assert(AFFINITY_MULTIPLIER.effective === 1.5, "Effective must be 1.5x");
  console.assert(AFFINITY_MULTIPLIER.neutral === 1.0, "Neutral must be 1.0x");
  console.assert(AFFINITY_MULTIPLIER.resisted === 0.5, "Resisted must be 0.5x");
  for (const t of WEAPON_TYPES) {
    console.assert(WEAPON_TYPE_META[t] !== undefined, `Missing meta for weapon type ${t}`);
    console.assert(WEAPON_TYPE_META[t].id === t, `Meta id mismatch for ${t}`);
  }
}

if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
  __runWeaponTypeSelfTests();
}

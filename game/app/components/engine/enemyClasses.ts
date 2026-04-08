import { EnemyType, type PlanetId, type EnemyClass, type WeaponType, type AffinityResult } from "./types";

export interface EnemyClassProfile {
  id: EnemyClass;
  name: string;
  tint: string;
  hpMult: number;
  speedMult: number;
  damageMult: number;
  fireRateMult: number;
  scoreMult: number;
  effectiveVs: WeaponType[];
  resistedVs: WeaponType[];
}

export const ENEMY_CLASS_PROFILES: Record<EnemyClass, EnemyClassProfile> = {
  armored: {
    id: "armored", name: "Armored", tint: "#cc4444",
    hpMult: 2.0, speedMult: 0.6, damageMult: 1.5, fireRateMult: 1.4, scoreMult: 1.8,
    effectiveVs: ["energy"], resistedVs: ["kinetic"],
  },
  swarm: {
    id: "swarm", name: "Swarm", tint: "#ffaa44",
    hpMult: 0.5, speedMult: 1.6, damageMult: 0.5, fireRateMult: 0.7, scoreMult: 0.9,
    effectiveVs: ["incendiary"], resistedVs: ["kinetic"],
  },
  "bio-organic": {
    id: "bio-organic", name: "Bio-organic", tint: "#44ff66",
    hpMult: 1.0, speedMult: 1.0, damageMult: 1.2, fireRateMult: 1.0, scoreMult: 1.1,
    effectiveVs: ["incendiary", "energy"], resistedVs: ["cryogenic"],
  },
  "tech-drone": {
    id: "tech-drone", name: "Tech Drone", tint: "#44ddff",
    hpMult: 0.9, speedMult: 1.4, damageMult: 1.0, fireRateMult: 0.65, scoreMult: 1.0,
    effectiveVs: ["energy"], resistedVs: ["kinetic"],
  },
  "heavy-mech": {
    id: "heavy-mech", name: "Heavy Mech", tint: "#996644",
    hpMult: 1.8, speedMult: 0.5, damageMult: 1.4, fireRateMult: 1.6, scoreMult: 1.7,
    effectiveVs: ["kinetic"], resistedVs: ["energy"],
  },
  "elemental-fire": {
    id: "elemental-fire", name: "Fire Elemental", tint: "#ff4422",
    hpMult: 1.0, speedMult: 1.2, damageMult: 1.3, fireRateMult: 0.9, scoreMult: 1.2,
    effectiveVs: ["cryogenic"], resistedVs: ["incendiary"],
  },
  "elemental-ice": {
    id: "elemental-ice", name: "Ice Elemental", tint: "#88ccff",
    hpMult: 1.3, speedMult: 0.8, damageMult: 0.9, fireRateMult: 1.1, scoreMult: 1.1,
    effectiveVs: ["incendiary"], resistedVs: ["cryogenic", "kinetic"],
  },
  "elemental-cinder": {
    id: "elemental-cinder", name: "Cinder Wraith", tint: "#cc6644",
    hpMult: 0.8, speedMult: 1.3, damageMult: 1.0, fireRateMult: 0.8, scoreMult: 1.0,
    effectiveVs: ["cryogenic"], resistedVs: ["energy"],
  },
};

export const DEFAULT_ENEMY_CLASS: Record<EnemyType, EnemyClass> = {
  [EnemyType.SCOUT]:    "swarm",
  [EnemyType.DRONE]:    "tech-drone",
  [EnemyType.GUNNER]:   "armored",
  [EnemyType.SHIELDER]: "armored",
  [EnemyType.BOMBER]:   "bio-organic",
  [EnemyType.SWARM]:    "swarm",
  [EnemyType.TURRET]:   "heavy-mech",
  [EnemyType.CLOAKER]:  "tech-drone",
  [EnemyType.ELITE]:    "heavy-mech",
  [EnemyType.MINE]:     "bio-organic",
  [EnemyType.WRAITH]:   "elemental-cinder",
  [EnemyType.ECHO]:     "tech-drone",
  [EnemyType.MIRROR]:   "tech-drone",
};

export const PLANET_DOMINANT_CLASS: Record<PlanetId, EnemyClass> = {
  verdania: "bio-organic",
  glaciem:  "elemental-ice",
  pyraxis:  "elemental-fire",
  ossuary:  "armored",
  abyssia:  "bio-organic",
  ashfall:  "elemental-cinder",
  prismara: "tech-drone",
  genesis:  "swarm",
  luminos:  "tech-drone",
  bastion:  "heavy-mech",
};

export function resolveAffinity(
  weaponType: WeaponType,
  classId: EnemyClass
): AffinityResult {
  const profile = ENEMY_CLASS_PROFILES[classId];
  if (profile.effectiveVs.includes(weaponType)) return "effective";
  if (profile.resistedVs.includes(weaponType)) return "resisted";
  return "neutral";
}

export function __runEnemyClassSelfTests(): void {
  const expectedClasses: EnemyClass[] = [
    "armored", "swarm", "bio-organic", "tech-drone",
    "heavy-mech", "elemental-fire", "elemental-ice", "elemental-cinder",
  ];
  for (const c of expectedClasses) {
    console.assert(ENEMY_CLASS_PROFILES[c] !== undefined, `Missing profile: ${c}`);
    console.assert(ENEMY_CLASS_PROFILES[c].id === c, `Profile id mismatch: ${c}`);
  }
  const enemyTypes = Object.values(EnemyType);
  for (const t of enemyTypes) {
    console.assert(DEFAULT_ENEMY_CLASS[t] !== undefined, `Missing class for EnemyType.${t}`);
  }
  console.assert(resolveAffinity("energy", "armored") === "effective", "Energy vs Armored = effective");
  console.assert(resolveAffinity("kinetic", "armored") === "resisted", "Kinetic vs Armored = resisted");
  console.assert(resolveAffinity("cryogenic", "armored") === "neutral", "Cryogenic vs Armored = neutral");
  for (const profile of Object.values(ENEMY_CLASS_PROFILES)) {
    for (const w of profile.effectiveVs) {
      console.assert(!profile.resistedVs.includes(w), `Class ${profile.id} has overlap on ${w}`);
    }
  }
  for (const p of Object.values(ENEMY_CLASS_PROFILES)) {
    console.assert(p.hpMult >= 0.5 && p.hpMult <= 2.0, `${p.id} hpMult out of range`);
    console.assert(p.speedMult >= 0.5 && p.speedMult <= 1.8, `${p.id} speedMult out of range`);
    console.assert(p.damageMult >= 0.5 && p.damageMult <= 1.5, `${p.id} damageMult out of range`);
    console.assert(p.fireRateMult >= 0.6 && p.fireRateMult <= 1.6, `${p.id} fireRateMult out of range`);
    console.assert(p.scoreMult >= 0.8 && p.scoreMult <= 2.0, `${p.id} scoreMult out of range`);
  }
}

if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
  __runEnemyClassSelfTests();
}

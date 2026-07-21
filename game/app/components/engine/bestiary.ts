import { EnemyType, ENEMY_DEFS, type BestiaryEntry, type EnemyClass, type PlanetId, type SaveData } from "./types";

/** Record a kill — returns updated bestiary (immutably). */
export function recordKill(
  bestiary: SaveData["bestiary"],
  enemyType: EnemyType,
  classId: EnemyClass,
  context: { planetId?: PlanetId; world?: number }
): SaveData["bestiary"] {
  const existing = bestiary[enemyType];
  if (existing) {
    return {
      ...bestiary,
      [enemyType]: { ...existing, killCount: existing.killCount + 1 },
    };
  }
  return {
    ...bestiary,
    [enemyType]: {
      enemyType,
      classId,
      killCount: 1,
      firstSeenPlanet: context.planetId,
      firstSeenWorld: context.world,
    },
  };
}

/** Return entries in EnemyType enum order, only for discovered enemies. */
export function getBestiaryList(bestiary: SaveData["bestiary"]): BestiaryEntry[] {
  const allTypes = Object.values(EnemyType);
  return allTypes
    .map((t) => bestiary[t])
    .filter((e): e is BestiaryEntry => e !== undefined);
}

export function getDiscoveredCount(bestiary: SaveData["bestiary"]): number {
  return Object.keys(bestiary).length;
}

export function getTotalEnemyCount(): number {
  return Object.keys(ENEMY_DEFS).length;
}

export const ENEMY_LORE: Record<EnemyType, string> = {
  [EnemyType.SCOUT]:    "TYPE: Scout\nTHREAT: Low\nBEHAVIOR: Fast approach, no weapons\n\nLightly armored reconnaissance units. They move in formation patterns and rely on speed over firepower. Often serve as the first wave of engagement, probing defenses before heavier units advance.\n\nNotable: Their flight patterns show evidence of coordinated intelligence. These are not autonomous drones — something is directing them.",
  [EnemyType.DRONE]:    "TYPE: Drone\nTHREAT: Low-Medium\nBEHAVIOR: Strafing fire\n\nAutomated attack drones that fire while strafing. Tech-class units vulnerable to energy weapons. They operate in zigzag patterns designed to evade return fire while maintaining suppressive output.",
  [EnemyType.GUNNER]:   "TYPE: Gunner\nTHREAT: Medium\nBEHAVIOR: Slow, sustained fire\n\nHeavily armed units that anchor defensive formations. Their weapons fire at a consistent rate, creating suppression zones.\n\nThe firing patterns show adaptive behavior — they adjust aim based on pilot evasion tendencies. This suggests real-time tactical processing, not pre-programmed routines.",
  [EnemyType.SHIELDER]: "TYPE: Shielder\nTHREAT: Medium-High\nBEHAVIOR: Damage absorption, formation support\n\nShielded units that protect formations. Their energy barriers show remarkable efficiency — almost identical to UEC shield harmonics.\n\nDoc Kael notes the shield frequency is within 0.3% of our own military specifications. This cannot be coincidence.",
  [EnemyType.BOMBER]:   "TYPE: Bomber\nTHREAT: Medium\nBEHAVIOR: Kamikaze approach\n\nKamikaze units that detonate on contact with the player ship. They leak biological spores on destruction. Bio-organic class — their hull composition suggests they were once living organisms, reshaped into weapons.",
  [EnemyType.SWARM]:    "TYPE: Swarm\nTHREAT: Low (individually)\nBEHAVIOR: Chase, overwhelm\n\nSmall, fast, numerous. Individually weak but terrifying in formation. They pursue the player aggressively, relying on numbers to overwhelm defenses. Incendiary weapons are most effective at clearing clusters.",
  [EnemyType.TURRET]:   "TYPE: Turret\nTHREAT: High\nBEHAVIOR: Stationary emplacement\n\nFixed-position heavy weapons platforms. High fire rate when the player enters their engagement range. Their armored chassis classifies them as heavy-mech class — kinetic rounds penetrate their plating most effectively.",
  [EnemyType.CLOAKER]:  "TYPE: Cloaker\nTHREAT: High\nBEHAVIOR: Phase-shift ambush\n\nUnits capable of rendering themselves invisible to standard sensors. They phase in and out of detection, striking from unexpected angles.\n\nThe cloaking technology is organic in nature — a biological process, not a mechanical one. These creatures evolved stealth as a survival mechanism.",
  [EnemyType.ELITE]:    "TYPE: Elite\nTHREAT: Very High\nBEHAVIOR: Multi-weapon assault\n\nHeavy assault units combining multiple weapon systems into a single platform. Priority targets in any engagement. Their heavy-mech classification means kinetic weapons deal increased damage.",
  [EnemyType.MINE]:     "TYPE: Mine\nTHREAT: Medium\nBEHAVIOR: Passive drift, proximity detonation\n\nDrifting explosive devices attracted to player ship mass. Bio-organic in composition — they pulse with a faint bioluminescence before detonation. Do not approach.",
  [EnemyType.WRAITH]:   "TYPE: Wraith\nTHREAT: Very High\nBEHAVIOR: Pursuit, phasing\n\nThe most disturbing hostile classification. Wraiths display unmistakably human movement patterns — banking turns, evasive jinks, attack runs that mirror academy flight training.\n\nBiometric scans reveal human-scale signatures within the organic hulls. These aren't ships being piloted. The pilots ARE the ships.\n\n312 years of evolution. 312 years of becoming something else.",
  [EnemyType.ECHO]:     "TYPE: Echo\nTHREAT: High\nBEHAVIOR: Pattern mimicry\n\nEchoes copy the player's movement patterns with a slight delay. They learn from engagement to engagement, becoming more effective over time.\n\nDoc Kael theorizes they are fragments of the collective consciousness — echoes of individual human pilots, repeating their final flight patterns for eternity.",
  [EnemyType.MIRROR]:   "TYPE: Mirror\nTHREAT: Extreme\nBEHAVIOR: Perfect reflection\n\nMirrors are the most evolved hostile form. They mirror your ship's exact capabilities — matching speed, fire rate, and tactical decisions in real-time.\n\nVoss believes they are the Hollow's attempt at communication. Not enemies, but reflections — the collective trying to show us what we will become.",
};

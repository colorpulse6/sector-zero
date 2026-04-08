# Weapon Affinity & Enemy Classes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 4-type weapon affinity system (Kinetic / Energy / Incendiary / Cryogenic) with per-class enemy stat profiles, visible damage feedback, class tint overlays, and a Bestiary screen — all of this applied to the existing 40 levels and 10 planets without breaking current gameplay.

**Architecture:** Declare shared types (`WeaponType`, `EnemyClass`, `AffinityResult`, `FloatingLabel`, `BestiaryEntry`) in `types.ts`. Create pure-data modules (`weaponTypes.ts`, `enemyClasses.ts`) that provide lookup tables + multipliers. Extend the damage-application path in `gameEngine.ts` to apply the affinity multiplier using the player's equipped weapon type (default: Kinetic). Add a floating damage-label system. Render class tint overlays in `drawEnemies`. Add a new Bestiary screen on the cockpit hub that reads kill counters from an extended `SaveData`.

**Tech Stack:** TypeScript, Next.js 15, React 19, HTML5 Canvas 2D. No test framework exists — verification is via `yarn build` (type check) + `yarn lint` + manual playtest. Pure data/logic modules include assertion-based dev checks that run on module import in development.

**Spec reference:** [2026-04-05-sector-zero-expansion-design.md](/Users/nichalasbarnes/Desktop/projects/knicks-knacks/docs/superpowers/specs/2026-04-05-sector-zero-expansion-design.md)

**Verified codebase facts (as of plan writing):**
- `enemies.ts` uses `currentDifficultyScale` (line 20) for world difficulty multipliers
- `gameEngine.ts` calls `firePlayerWeapon(state.player, state.player.weaponLevel)` — `weaponLevel` lives on `player`
- `save.ts` has **no** schema version field — migration relies on field-by-field fallback
- `cockpitRenderer.ts` already imports `CANVAS_WIDTH`/`CANVAS_HEIGHT`, uses `drawSubScreenFrame`, and uses `ctx.roundRect` extensively
- `cockpitRenderer.ts` has a `wrapText(ctx, text, maxWidth): string[]` helper returning string array (does NOT draw)

---

## File Structure

### New files

| Path | Responsibility |
|------|----------------|
| `games/sector-zero/web/app/components/engine/weaponTypes.ts` | Weapon-type metadata, affinity multiplier lookup |
| `games/sector-zero/web/app/components/engine/enemyClasses.ts` | Class stat profiles, enemy-to-class default mapping, planet-to-dominant-class mapping, affinity resolver |
| `games/sector-zero/web/app/components/engine/bestiary.ts` | Bestiary entry helpers, enemy lore strings |
| `games/sector-zero/web/app/components/engine/floatingLabels.ts` | Floating damage/tag labels (CRITICAL, RESISTED) |

### Modified files

| Path | Changes |
|------|---------|
| `games/sector-zero/web/app/components/engine/types.ts` | Declare `WeaponType`, `EnemyClass`, `AffinityResult`, `FloatingLabel`, `BestiaryEntry`; extend `Bullet`, `Enemy`, `GameState`, `SaveData` |
| `games/sector-zero/web/app/components/engine/enemies.ts` | Set `classId` in `createEnemy`, apply class stat multipliers, draw tint overlay, affinity indicator above HP bar |
| `games/sector-zero/web/app/components/engine/weapons.ts` | Tag player bullets with `weaponType` on creation |
| `games/sector-zero/web/app/components/engine/gameEngine.ts` | Initialize new state fields, compute affinity damage in collisions, spawn floating labels, record kills to bestiary |
| `games/sector-zero/web/app/components/engine/renderer.ts` | Draw floating labels |
| `games/sector-zero/web/app/components/engine/save.ts` | Extend defaults + migrateSave with new fields |
| `games/sector-zero/web/app/components/engine/cockpit.ts` | Add `bestiary` screen type + `bestiarySelected` state + hotspot |
| `games/sector-zero/web/app/components/engine/cockpitRenderer.ts` | Add `drawBestiaryScreen`, wire into screen dispatch |
| `games/sector-zero/web/app/components/Game.tsx` | Add bestiary sub-screen input routing; flush `pendingBestiaryKills` on mission complete |

### Verification strategy

No test framework. Per-task verification loop:

1. **Type check:** `cd games/sector-zero/web && yarn build` → must exit 0
2. **Lint:** `cd games/sector-zero/web && yarn lint` → no new warnings
3. **Dev-mode self-tests:** pure-logic modules call `console.assert` on import. Failures log to browser console when running `yarn dev`.
4. **Manual playtest checklist:** each task has observable in-game behaviors to verify.

Most tasks will have intermediate build failures because types are added before their consumers are updated. This is acknowledged and expected — final clean build happens at Task 9.

---

## Commit strategy

One commit per task. Conventional commits: `feat(sector-zero):` prefix. Commit even if the build is transitively broken mid-stream — each task should leave the plan in a forward-progressing state.

---

## Task 1: Declare shared types in types.ts

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/types.ts`

- [ ] **Step 1: Read types.ts to locate insertion points**

Run: `cd games/sector-zero/web && grep -n "export interface Bullet\|export interface Enemy\|export interface GameState\|export interface SaveData" app/components/engine/types.ts`

Expected: line numbers for each interface. Note them for Step 2.

- [ ] **Step 2: Add new type declarations before the `Bullet` interface**

Find the comment line `// ─── Bullets ─────────────────────────────────────────────────────────` (around line 52). **Immediately before that comment**, insert:

```typescript
// ─── Weapon Affinity System ─────────────────────────────────────────
export type WeaponType = "kinetic" | "energy" | "incendiary" | "cryogenic";

export type AffinityResult = "effective" | "neutral" | "resisted";

// ─── Enemy Classes ──────────────────────────────────────────────────
export type EnemyClass =
  | "armored"
  | "swarm"
  | "bio-organic"
  | "tech-drone"
  | "heavy-mech"
  | "elemental-fire"
  | "elemental-ice"
  | "elemental-cinder";

```

- [ ] **Step 3: Extend `Bullet` interface**

Find `export interface Bullet {` and add `weaponType?: WeaponType;` as the last field:

```typescript
export interface Bullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  damage: number;
  isPlayer: boolean;
  piercing: boolean;
  variant?: BulletVariant;
  weaponType?: WeaponType;  // NEW
}
```

- [ ] **Step 4: Extend `Enemy` interface**

Find `export interface Enemy {` and add 3 new fields at the end:

```typescript
export interface Enemy {
  // ... existing fields kept as-is ...
  cloaked: boolean;
  classId: EnemyClass;              // NEW
  lastHitAffinity?: AffinityResult;  // NEW
  lastHitTimer: number;              // NEW
}
```

- [ ] **Step 5: Add `FloatingLabel` interface**

Find the `// ─── Bosses ─────────────────────` comment (just after the Particle interface). **Immediately before that comment**, insert:

```typescript
// ─── Floating Labels (damage/affinity indicators) ───────────────────
export interface FloatingLabel {
  id: number;
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

```

- [ ] **Step 6: Extend `GameState` interface**

Find `export interface GameState {` and add three fields right after `explosions: SpriteExplosion[];`:

```typescript
export interface GameState {
  // ... existing ...
  particles: Particle[];
  explosions: SpriteExplosion[];
  floatingLabels: FloatingLabel[];                                       // NEW
  equippedWeaponType: WeaponType;                                        // NEW — copied from SaveData at mission start; read-only during run in MVP
  pendingBestiaryKills: Array<{ type: EnemyType; classId: EnemyClass }>; // NEW
  // ... rest kept as-is ...
}
```

- [ ] **Step 7: Add `BestiaryEntry` interface**

Find `export interface SaveData {` — **immediately before it**, insert:

```typescript
// ─── Bestiary ───────────────────────────────────────────────────────
export interface BestiaryEntry {
  enemyType: EnemyType;
  classId: EnemyClass;
  killCount: number;
  firstSeenPlanet?: PlanetId;
  firstSeenWorld?: number;
}

```

- [ ] **Step 8: Extend `SaveData` interface**

In `SaveData`, add two new fields at the end (before closing brace):

```typescript
export interface SaveData {
  // ... existing ...
  unlockedEnhancements: EnhancementId[];
  bestiary: Partial<Record<EnemyType, BestiaryEntry>>;  // NEW
  equippedWeaponType: WeaponType;                        // NEW — default "kinetic"
}
```

- [ ] **Step 9: Verify types.ts compiles in isolation**

Run: `cd games/sector-zero/web && yarn build 2>&1 | tail -30`

Expected: Build FAILS with errors in consumer files (enemies.ts, gameEngine.ts, save.ts) that don't yet set the new fields. Acceptable errors: "Property 'classId' is missing", "Property 'bestiary' is missing", "Property 'floatingLabels' is missing", etc.

**Unacceptable:** syntax errors inside types.ts itself. If any appear, fix them before proceeding.

- [ ] **Step 10: Commit**

```bash
cd /Users/nichalasbarnes/Desktop/projects/knicks-knacks
git add games/sector-zero/web/app/components/engine/types.ts
git commit -m "feat(sector-zero): declare weapon affinity and bestiary types"
```

---

## Task 2: Create weaponTypes.ts with affinity multipliers

**Files:**
- Create: `games/sector-zero/web/app/components/engine/weaponTypes.ts`

- [ ] **Step 1: Create the module**

```typescript
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
  console.assert(AFFINITY_MULTIPLIER.effective === 1.5, "Effective must be 1.5×");
  console.assert(AFFINITY_MULTIPLIER.neutral === 1.0, "Neutral must be 1.0×");
  console.assert(AFFINITY_MULTIPLIER.resisted === 0.5, "Resisted must be 0.5×");
  for (const t of WEAPON_TYPES) {
    console.assert(WEAPON_TYPE_META[t] !== undefined, `Missing meta for weapon type ${t}`);
    console.assert(WEAPON_TYPE_META[t].id === t, `Meta id mismatch for ${t}`);
  }
}

if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
  __runWeaponTypeSelfTests();
}
```

- [ ] **Step 2: Verify + lint**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
cd games/sector-zero/web && yarn lint 2>&1 | grep weaponTypes
```

Expected: weaponTypes.ts itself has no errors (errors in consumers still present).

- [ ] **Step 3: Commit**

```bash
git add games/sector-zero/web/app/components/engine/weaponTypes.ts
git commit -m "feat(sector-zero): add weapon type metadata and affinity multipliers"
```

---

## Task 3: Create enemyClasses.ts with stat profiles and resolver

**Files:**
- Create: `games/sector-zero/web/app/components/engine/enemyClasses.ts`

- [ ] **Step 1: Verify enum values**

```bash
cd games/sector-zero/web && grep -n "SCOUT\|DRONE\|GUNNER\|SHIELDER\|BOMBER\|SWARM\|TURRET\|CLOAKER\|ELITE\|MINE\|WRAITH\|ECHO\|MIRROR" app/components/engine/types.ts | head -20
cd games/sector-zero/web && grep -n "PlanetId" app/components/engine/types.ts | head -5
```

Confirm EnemyType has 13 values and note PlanetId string union members.

- [ ] **Step 2: Create the module**

```typescript
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

/** Default class for each EnemyType (can be overridden at spawn) */
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

/** Dominant class per planet (for planet-mission overrides) */
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
```

- [ ] **Step 3: Verify**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

If `PLANET_DOMINANT_CLASS` has missing keys, fix based on actual PlanetId values from Step 1.

- [ ] **Step 4: Commit**

```bash
git add games/sector-zero/web/app/components/engine/enemyClasses.ts
git commit -m "feat(sector-zero): add enemy class profiles and affinity resolver"
```

---

## Task 4: Update save.ts defaults + migration

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/save.ts`

- [ ] **Step 1: Read save.ts**

```bash
cd games/sector-zero/web && head -70 app/components/engine/save.ts
```

Identify `defaultSave` (lines ~15-33) and `migrateSave` (lines ~36-57).

- [ ] **Step 2: Add `WeaponType` to imports**

```typescript
import {
  DEFAULT_UPGRADES,
  type ConsumableId,
  type EnhancementId,
  type MaterialId,
  type PlanetId,
  type SaveData,
  type ShipUpgrades,
  type WeaponType,  // NEW
} from "./types";
```

- [ ] **Step 3: Extend `defaultSave`**

Add two fields before the closing brace:

```typescript
const defaultSave: SaveData = {
  // ... all existing fields ...
  unlockedEnhancements: [],
  bestiary: {},                    // NEW
  equippedWeaponType: "kinetic",   // NEW
};
```

- [ ] **Step 4: Extend `migrateSave` return**

Add two migrations before the closing brace of the return object:

```typescript
return {
  // ... all existing field migrations ...
  unlockedEnhancements: (raw.unlockedEnhancements as EnhancementId[]) ?? [],
  bestiary: (raw.bestiary as SaveData["bestiary"]) ?? {},                              // NEW
  equippedWeaponType: (raw.equippedWeaponType as WeaponType | undefined) ?? "kinetic", // NEW
};
```

> **Note on schema versioning:** `save.ts` does not use a schema version number — migration is field-by-field fallback. We follow existing convention. Version-based migration deferred to future plan.

- [ ] **Step 5: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

- [ ] **Step 6: Commit**

```bash
git add games/sector-zero/web/app/components/engine/save.ts
git commit -m "feat(sector-zero): extend save data for bestiary and equipped weapon"
```

---

## Task 5: Apply classId and class stats in createEnemy

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/enemies.ts`

- [ ] **Step 1: Confirm `currentDifficultyScale` variable name**

```bash
cd games/sector-zero/web && grep -n "currentDifficultyScale\|difficultyScale" app/components/engine/enemies.ts | head -5
```

Expected: `currentDifficultyScale` on line 20. If different name appears, adjust Step 3 accordingly.

- [ ] **Step 2: Add imports**

At the top of `enemies.ts`, add:

```typescript
import { DEFAULT_ENEMY_CLASS, ENEMY_CLASS_PROFILES } from "./enemyClasses";
```

Extend the `./types` import to include `EnemyClass`:

```typescript
import {
  CANVAS_WIDTH,
  GAME_AREA_HEIGHT,
  ENEMY_BULLET_SPEED,
  ENEMY_DEFS,
  EnemyType,
  type Enemy,
  type EnemyBehavior,
  type Bullet,
  type BulletVariant,
  type Player,
  type FormationType,
  type EnemyClass,  // NEW
} from "./types";
```

- [ ] **Step 3: Replace `createEnemy`**

```typescript
export function createEnemy(
  type: EnemyType,
  x: number,
  y: number,
  behavior?: EnemyBehavior,
  classOverride?: EnemyClass
): Enemy {
  const def = ENEMY_DEFS[type];
  const defaultBehavior = getDefaultBehavior(type);

  const classId = classOverride ?? DEFAULT_ENEMY_CLASS[type];
  const classProfile = ENEMY_CLASS_PROFILES[classId];

  const scaledHp = Math.max(1, Math.ceil(
    def.hp * currentDifficultyScale.hp * classProfile.hpMult
  ));
  const scaledSpeed = def.speed * currentDifficultyScale.speed * classProfile.speedMult;
  const scaledFireRate = Math.max(10, Math.floor(
    def.fireRate * currentDifficultyScale.fireRate * classProfile.fireRateMult
  ));
  const scaledScore = Math.floor(def.score * classProfile.scoreMult);

  return {
    id: ++enemyIdCounter,
    type,
    x,
    y,
    width: def.width,
    height: def.height,
    hp: scaledHp,
    maxHp: scaledHp,
    speed: scaledSpeed,
    vx: 0,
    vy: scaledSpeed,
    score: scaledScore,
    fireTimer: Math.floor(Math.random() * scaledFireRate),
    fireRate: scaledFireRate,
    shoots: def.shoots,
    behavior: behavior ?? defaultBehavior,
    behaviorTimer: 0,
    cloaked: type === EnemyType.CLOAKER || type === EnemyType.ECHO,
    classId,
    lastHitAffinity: undefined,
    lastHitTimer: 0,
  };
}
```

- [ ] **Step 4: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

Expected: enemies.ts compiles. Errors remain in gameEngine.ts.

- [ ] **Step 5: Commit**

```bash
git add games/sector-zero/web/app/components/engine/enemies.ts
git commit -m "feat(sector-zero): apply enemy class stat multipliers in createEnemy"
```

---

## Task 6: Planet dominant class override

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/enemies.ts`
- Modify: `games/sector-zero/web/app/components/engine/gameEngine.ts`

- [ ] **Step 1: Find spawn sites**

```bash
cd games/sector-zero/web && grep -rn "createEnemy(" app/components/engine/ 2>&1
cd games/sector-zero/web && grep -n "createPlanetGameState\|createGameState" app/components/engine/gameEngine.ts | head -10
```

- [ ] **Step 2: Add planet class override to enemies.ts**

Near line 20 in enemies.ts (next to `currentDifficultyScale`):

```typescript
/** Planet-mission class override. When set, 70% of spawns use this class. */
let currentPlanetClass: EnemyClass | null = null;

export function setPlanetClassOverride(classId: EnemyClass | null): void {
  currentPlanetClass = classId;
}
```

Update `createEnemy`'s class resolution to honor the override:

```typescript
const classId = classOverride
  ?? (currentPlanetClass && Math.random() < 0.7
    ? currentPlanetClass
    : DEFAULT_ENEMY_CLASS[type]);
```

- [ ] **Step 3: Wire override from gameEngine.ts**

At the top of `gameEngine.ts`:

```typescript
import { PLANET_DOMINANT_CLASS } from "./enemyClasses";
import { setPlanetClassOverride } from "./enemies";
```

At the very top of `createPlanetGameState` function body (before state construction):

```typescript
setPlanetClassOverride(PLANET_DOMINANT_CLASS[planetId]);
```

At the very top of `createGameState` function body:

```typescript
setPlanetClassOverride(null);  // clear override for campaign missions
```

- [ ] **Step 4: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(sector-zero): apply planet dominant class to 70% of planet-mission spawns"
```

---

## Task 7: Tag player bullets with weaponType

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/weapons.ts`
- Modify: `games/sector-zero/web/app/components/engine/gameEngine.ts`

- [ ] **Step 1: Verify call signatures**

```bash
cd games/sector-zero/web && grep -n "firePlayerWeapon\|fireSideGunners" app/components/engine/gameEngine.ts
```

Confirm: `firePlayerWeapon(state.player, state.player.weaponLevel)` on ~line 867.

- [ ] **Step 2: Add `WeaponType` import in weapons.ts**

```typescript
import {
  CANVAS_WIDTH,
  BULLET_SPEED,
  type Bullet,
  type Player,
  type WeaponType,  // NEW
} from "./types";
```

- [ ] **Step 3: Update `createBullet` signature**

```typescript
function createBullet(
  x: number,
  y: number,
  vx: number,
  vy: number,
  isPlayer: boolean,
  damage: number = 1,
  piercing: boolean = false,
  weaponType?: WeaponType  // NEW
): Bullet {
  return {
    id: ++bulletIdCounter,
    x, y, vx, vy,
    width: isPlayer ? 4 : 6,
    height: isPlayer ? 12 : 8,
    damage,
    isPlayer,
    piercing,
    weaponType,  // NEW
  };
}
```

- [ ] **Step 4: Add optional `weaponType` param to `firePlayerWeapon` + `fireSideGunners`**

```typescript
export function firePlayerWeapon(
  player: Player,
  weaponLevel: number,
  weaponType: WeaponType = "kinetic"
): Bullet[] {
  // ... existing body; update every createBullet call to pass `weaponType` as 8th arg
  // Example: bullets.push(createBullet(cx - 2, top, 0, -BULLET_SPEED, true, damage, false, weaponType));
}

export function fireSideGunners(player: Player, weaponType: WeaponType = "kinetic"): Bullet[] {
  const leftX = player.x - 16;
  const rightX = player.x + player.width + 8;
  const y = player.y + 8;
  return [
    createBullet(leftX, y, 0, -BULLET_SPEED * 0.8, true, 1, false, weaponType),
    createBullet(rightX, y, 0, -BULLET_SPEED * 0.8, true, 1, false, weaponType),
  ];
}
```

Add `weaponType` as the 8th arg to every `createBullet` call inside `firePlayerWeapon` (all 5 weapon levels).

- [ ] **Step 5: Update call sites in gameEngine.ts**

```typescript
const newBullets = firePlayerWeapon(
  state.player,
  state.player.weaponLevel,
  state.equippedWeaponType  // NEW
);
```

And any `fireSideGunners(` calls — add `state.equippedWeaponType` as 2nd arg.

- [ ] **Step 6: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

Expected: weapons.ts compiles. gameEngine.ts still errors because `state.equippedWeaponType` isn't initialized yet.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(sector-zero): tag player bullets with equipped weapon type"
```

---

## Task 8: Create floatingLabels.ts

**Files:**
- Create: `games/sector-zero/web/app/components/engine/floatingLabels.ts`

- [ ] **Step 1: Create the module**

```typescript
import type { FloatingLabel, AffinityResult } from "./types";

let labelIdCounter = 0;

export function resetFloatingLabelIds(): void {
  labelIdCounter = 0;
}

const AFFINITY_LABEL_TEXT: Record<AffinityResult, string> = {
  effective: "CRITICAL",
  neutral:   "",
  resisted:  "RESISTED",
};

const AFFINITY_LABEL_COLOR: Record<AffinityResult, string> = {
  effective: "#ffdd44",
  neutral:   "",
  resisted:  "#888899",
};

/** Returns null for neutral hits. */
export function createAffinityLabel(
  x: number,
  y: number,
  affinity: AffinityResult
): FloatingLabel | null {
  if (affinity === "neutral") return null;
  return {
    id: ++labelIdCounter,
    x,
    y,
    vy: -1.2,
    text: AFFINITY_LABEL_TEXT[affinity],
    color: AFFINITY_LABEL_COLOR[affinity],
    life: 40,
    maxLife: 40,
  };
}

export function updateFloatingLabels(labels: FloatingLabel[]): FloatingLabel[] {
  return labels
    .map((l) => ({
      ...l,
      y: l.y + l.vy,
      vy: l.vy * 0.97,
      life: l.life - 1,
    }))
    .filter((l) => l.life > 0);
}

export function drawFloatingLabels(
  ctx: CanvasRenderingContext2D,
  labels: FloatingLabel[]
): void {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 11px monospace";
  for (const l of labels) {
    const alpha = l.life / l.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = l.color;
    ctx.shadowBlur = 4;
    ctx.shadowColor = l.color;
    ctx.fillText(l.text, l.x, l.y);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}
```

- [ ] **Step 2: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add games/sector-zero/web/app/components/engine/floatingLabels.ts
git commit -m "feat(sector-zero): add floating affinity-label system"
```

---

## Task 9: Initialize new GameState fields (build becomes clean here)

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/gameEngine.ts`

- [ ] **Step 1: Find factory locations**

```bash
cd games/sector-zero/web && grep -n "particles: \[\]," app/components/engine/gameEngine.ts
```

Expected: 2 hits (createGameState + createPlanetGameState).

- [ ] **Step 2: Initialize new fields at both sites**

Add at each location, right after `explosions: [],`:

```typescript
particles: [],
explosions: [],
floatingLabels: [],                                       // NEW
equippedWeaponType: save.equippedWeaponType ?? "kinetic", // NEW
pendingBestiaryKills: [],                                 // NEW
```

Confirm the save parameter name in each factory (should be `save: SaveData`).

- [ ] **Step 3: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

Expected: **`✓ Compiled successfully`** — first clean build since Task 1.

- [ ] **Step 4: Lint**

```bash
cd games/sector-zero/web && yarn lint 2>&1 | tail -10
```

Fix any unused-import warnings.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(sector-zero): initialize floatingLabels and bestiary fields in game state"
```

---

## Task 10: Apply affinity multiplier in collisions

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/gameEngine.ts`

- [ ] **Step 1: Locate damage calc**

```bash
cd games/sector-zero/web && grep -n "enemy.hp - bullet.damage\|bossHp - bullet.damage" app/components/engine/gameEngine.ts
```

Expected: line ~1019 (enemy) and line ~730 (boss).

- [ ] **Step 2: Add imports**

```typescript
import { resolveAffinity } from "./enemyClasses";
import { AFFINITY_MULTIPLIER } from "./weaponTypes";
import { createAffinityLabel, updateFloatingLabels, resetFloatingLabelIds } from "./floatingLabels";
```

- [ ] **Step 3: Replace enemy damage calc**

Find `const newHp = enemy.hp - bullet.damage;` (line ~1019). Replace:

```typescript
// Compute affinity-adjusted damage
let finalDamage = bullet.damage;
if (bullet.isPlayer && bullet.weaponType) {
  const affinity = resolveAffinity(bullet.weaponType, enemy.classId);
  finalDamage = bullet.damage * AFFINITY_MULTIPLIER[affinity];

  enemy.lastHitAffinity = affinity;
  enemy.lastHitTimer = 120;

  const label = createAffinityLabel(
    enemy.x + enemy.width / 2,
    enemy.y - 4,
    affinity
  );
  if (label) {
    s.floatingLabels = [...s.floatingLabels, label];
  }
}

const newHp = enemy.hp - finalDamage;
```

- [ ] **Step 4: Add TODO on boss damage**

At line ~730, add a comment:

```typescript
// TODO(affinity): bosses don't yet have classId — add boss class assignment in future plan
bossHp = Math.max(0, bossHp - bullet.damage);
```

- [ ] **Step 5: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

- [ ] **Step 6: Commit**

```bash
git add games/sector-zero/web/app/components/engine/gameEngine.ts
git commit -m "feat(sector-zero): apply affinity multiplier to player-to-enemy damage"
```

---

## Task 11: Update floatingLabels + lastHitTimer each frame, render labels

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/gameEngine.ts`
- Modify: `games/sector-zero/web/app/components/engine/renderer.ts`
- Potentially Modify: `games/sector-zero/web/app/components/engine/enemies.ts`

- [ ] **Step 1: Find particle update sites**

```bash
cd games/sector-zero/web && grep -n "updateParticles(s.particles)" app/components/engine/gameEngine.ts
```

Expected: 3 call sites.

- [ ] **Step 2: Add floating label updates**

After each `s.particles = updateParticles(s.particles);`, add:

```typescript
s.floatingLabels = updateFloatingLabels(s.floatingLabels);
```

- [ ] **Step 3: Decrement `lastHitTimer` in enemy update**

```bash
cd games/sector-zero/web && grep -n "export function updateEnemy\b\|updated.behaviorTimer" app/components/engine/enemies.ts
```

If `updateEnemy` exists in enemies.ts, at the end of the function (before `return updated;`), add:

```typescript
if (updated.lastHitTimer > 0) {
  updated.lastHitTimer -= 1;
  if (updated.lastHitTimer === 0) {
    updated.lastHitAffinity = undefined;
  }
}
```

If updates happen in gameEngine instead, add it inside the enemy update loop there.

- [ ] **Step 4: Add reset call**

```bash
cd games/sector-zero/web && grep -n "resetEnemyIds()" app/components/engine/gameEngine.ts
```

After each `resetEnemyIds();` call, add `resetFloatingLabelIds();`.

- [ ] **Step 5: Render labels in renderer.ts**

In `renderer.ts` imports:

```typescript
import { drawFloatingLabels } from "./floatingLabels";
```

Find `drawSpriteExplosions(ctx, state.explosions);` (line ~72). **After it**, add:

```typescript
drawFloatingLabels(ctx, state.floatingLabels);
```

- [ ] **Step 6: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

- [ ] **Step 7: Playtest**

```bash
cd games/sector-zero/web && yarn dev
```

Open http://localhost:3000. Start a mission, shoot enemies.

- [ ] Shoot GUNNER/SHIELDER: see **RESISTED** label drift up
- [ ] Shoot TURRET/ELITE: see **CRITICAL** label (kinetic vs heavy-mech is effective)
- [ ] No label for neutral hits (e.g., Kinetic vs bio-organic)
- [ ] Labels fade out over ~40 frames

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(sector-zero): render floating labels and decrement hit timers"
```

---

## Task 12: Draw class tint overlay + affinity indicator

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/enemies.ts`

- [ ] **Step 1: Replace `drawEnemies`**

Find `export function drawEnemies(` (line ~322). Replace body:

```typescript
export function drawEnemies(
  ctx: CanvasRenderingContext2D,
  enemies: Enemy[]
): void {
  for (const enemy of enemies) {
    if (enemy.cloaked) {
      ctx.globalAlpha = 0.15;
    }

    ctx.save();

    const spritePath = ENEMY_SPRITE_MAP[enemy.type];
    const sprite = spritePath ? getSprite(spritePath) : null;

    const pad = 4;
    const dx = enemy.x - pad;
    const dy = enemy.y - pad;
    const dw = enemy.width + pad * 2;
    const dh = enemy.height + pad * 2;

    if (sprite) {
      ctx.drawImage(sprite, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = "#aa44ff";
      ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
    }

    // Class tint overlay (subtle multiply blend)
    const classProfile = ENEMY_CLASS_PROFILES[enemy.classId];
    if (classProfile) {
      const baseAlpha = enemy.cloaked ? 0.15 : 1;
      ctx.globalCompositeOperation = "multiply";
      ctx.globalAlpha = baseAlpha * 0.35;
      ctx.fillStyle = classProfile.tint;
      ctx.fillRect(dx, dy, dw, dh);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = baseAlpha;
    }

    ctx.restore();

    // HP bar
    if (enemy.maxHp > 1 && enemy.hp < enemy.maxHp) {
      const barW = enemy.width;
      const barH = 3;
      const barX = enemy.x;
      const barY = enemy.y - 6;
      ctx.fillStyle = "#333";
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = "#ff3333";
      ctx.fillRect(barX, barY, barW * (enemy.hp / enemy.maxHp), barH);
    }

    // Affinity indicator (arrow above enemy after hit)
    if (enemy.lastHitAffinity && enemy.lastHitTimer > 0 && enemy.lastHitAffinity !== "neutral") {
      const arrow = enemy.lastHitAffinity === "effective" ? "\u2B06" : "\u2B07";
      const color = enemy.lastHitAffinity === "effective" ? "#ffdd44" : "#888899";
      const alpha = Math.min(1, enemy.lastHitTimer / 60);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(arrow, enemy.x + enemy.width / 2, enemy.y - 10);
      ctx.restore();
    }

    ctx.globalAlpha = 1;
  }
}
```

- [ ] **Step 2: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

- [ ] **Step 3: Playtest**

```bash
yarn dev
```

- [ ] All enemies show subtle color tint (red armored, orange swarm, green bio, cyan tech, brown mech, amber cinder)
- [ ] Cloaked enemies keep low-alpha with tint applied
- [ ] Shooting armored: ⬇ arrow briefly appears
- [ ] Shooting heavy-mech: ⬆ arrow briefly appears

- [ ] **Step 4: Commit**

```bash
git add games/sector-zero/web/app/components/engine/enemies.ts
git commit -m "feat(sector-zero): draw class tint overlay and affinity arrow on enemies"
```

---

## Task 13: Record kills to pendingBestiaryKills

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/gameEngine.ts`

- [ ] **Step 1: Find destruction sites**

```bash
cd games/sector-zero/web && grep -n "destroyedEnemies.add(enemy.id)" app/components/engine/gameEngine.ts
```

- [ ] **Step 2: Record kills at main collision site**

After `destroyedEnemies.add(enemy.id);` (around line 1020):

```typescript
s.pendingBestiaryKills = [
  ...s.pendingBestiaryKills,
  { type: enemy.type, classId: enemy.classId },
];
```

- [ ] **Step 3: Handle bomb-kill site**

Read around the second hit site:

```bash
cd games/sector-zero/web && sed -n '1255,1315p' app/components/engine/gameEngine.ts
```

Determine if the bomb handler mutates `s` or builds a new state object.

**If bomb handler builds a new state object:**

```typescript
// Near top of bomb handler:
const bombKills: Array<{ type: EnemyType; classId: EnemyClass }> = [];

// Inside enemy loop:
bombKills.push({ type: enemy.type, classId: enemy.classId });

// In final return:
pendingBestiaryKills: [...state.pendingBestiaryKills, ...bombKills],
```

**If bomb handler mutates `s`:**

```typescript
s.pendingBestiaryKills = [
  ...s.pendingBestiaryKills,
  { type: enemy.type, classId: enemy.classId },
];
```

Add `type EnemyClass` to gameEngine's types import if not already present.

- [ ] **Step 4: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add games/sector-zero/web/app/components/engine/gameEngine.ts
git commit -m "feat(sector-zero): track enemy kills for bestiary"
```

---

## Task 14: Create bestiary.ts

**Files:**
- Create: `games/sector-zero/web/app/components/engine/bestiary.ts`

- [ ] **Step 1: Create the module**

```typescript
import { EnemyType, type BestiaryEntry, type EnemyClass, type PlanetId, type SaveData } from "./types";
import { ENEMY_DEFS } from "./types";

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
  [EnemyType.SCOUT]:    "Fast reconnaissance unit. Dies easily but attacks in swarms.",
  [EnemyType.DRONE]:    "Automated attack drone. Fires while strafing. Vulnerable to energy weapons.",
  [EnemyType.GUNNER]:   "Armored heavy-weapons platform. Slow but devastating sustained fire.",
  [EnemyType.SHIELDER]: "Front-line bulwark with frontal barrier. Difficult to damage head-on.",
  [EnemyType.BOMBER]:   "Kamikaze unit that detonates on contact. Leaks biological spores.",
  [EnemyType.SWARM]:    "Small, fast, numerous. Individually weak, terrifying in formation.",
  [EnemyType.TURRET]:   "Stationary emplacement. High fire rate when player is in range.",
  [EnemyType.CLOAKER]:  "Phase-shift enemy. Invisible at rest, briefly visible when firing.",
  [EnemyType.ELITE]:    "Heavy assault unit combining multiple weapon systems. Priority target.",
  [EnemyType.MINE]:     "Drifting explosive. Attracted to player ship mass. Do not touch.",
  [EnemyType.WRAITH]:   "Ghost-class entity from deeper sectors. Phases through projectiles.",
  [EnemyType.ECHO]:     "Temporal anomaly. Flickers between existence states every 1.5s.",
  [EnemyType.MIRROR]:   "Adaptive reflection enemy. Copies player movement with jitter.",
};
```

- [ ] **Step 2: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add games/sector-zero/web/app/components/engine/bestiary.ts
git commit -m "feat(sector-zero): add bestiary helpers and enemy lore"
```

---

## Task 15: Flush pendingBestiaryKills on mission complete

**Files:**
- Modify: `games/sector-zero/web/app/components/Game.tsx`

- [ ] **Step 1: Find mission-complete save sites**

```bash
cd games/sector-zero/web && grep -n "saveSave\|LEVEL_COMPLETE\|levelComplete" app/components/Game.tsx | head -20
```

- [ ] **Step 2: Add import**

```typescript
import { recordKill } from "./engine/bestiary";
```

- [ ] **Step 3: Flush kills before save write**

At each site where `saveSave(newSave)` is called after level/mission completion, BEFORE the save call:

```typescript
let updatedBestiary = save.bestiary;
for (const kill of gameState.pendingBestiaryKills) {
  updatedBestiary = recordKill(updatedBestiary, kill.type, kill.classId, {
    world: gameState.currentWorld,
    planetId: gameState.planetId,
  });
}

const newSave = {
  ...save,
  bestiary: updatedBestiary,
  // ... other existing fields for this save write ...
};
```

Apply at each relevant save site (regular level complete, boss defeat, planet mission complete).

- [ ] **Step 4: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

- [ ] **Step 5: Playtest**

```bash
yarn dev
```

- [ ] Complete a level with varied enemies killed
- [ ] In browser devtools console: `JSON.parse(localStorage.getItem("sector-zero-save")).bestiary`
- [ ] Verify entries populated with `killCount`, `classId`, `firstSeenWorld`

- [ ] **Step 6: Commit**

```bash
git add games/sector-zero/web/app/components/Game.tsx
git commit -m "feat(sector-zero): flush kill counters to bestiary on mission complete"
```

---

## Task 16: Bestiary cockpit screen

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/cockpit.ts`
- Modify: `games/sector-zero/web/app/components/engine/cockpitRenderer.ts`
- Modify: `games/sector-zero/web/app/components/Game.tsx`

- [ ] **Step 1: Read cockpit.ts**

```bash
cd games/sector-zero/web && cat app/components/engine/cockpit.ts | head -80
```

Identify `CockpitScreen` union, `CockpitHubState`, `COCKPIT_HOTSPOTS` array.

- [ ] **Step 2: Extend types and hotspots**

Add `"bestiary"` to `CockpitScreen` union. Add `bestiarySelected: number` to `CockpitHubState` (default 0 in initialization).

Read the shape of existing hotspots, then add a new one after the codex hotspot. **Coordinates are designer-choice for MVP** — pick any non-overlapping location (suggestion: below or beside codex):

```typescript
// Example (adjust coords to your existing hotspot layout):
{ id: "bestiary", x: 330, y: 560, w: 120, h: 42, label: "BESTIARY", targetScreen: "bestiary" }
```

- [ ] **Step 3: Add drawBestiaryScreen**

In `cockpitRenderer.ts`, add imports at top:

```typescript
import { getBestiaryList, getDiscoveredCount, getTotalEnemyCount, ENEMY_LORE } from "./bestiary";
import { ENEMY_CLASS_PROFILES } from "./enemyClasses";
import { WEAPON_TYPE_META } from "./weaponTypes";
```

Append the function near `drawCodexScreen`:

```typescript
function drawBestiaryScreen(
  ctx: CanvasRenderingContext2D,
  state: CockpitHubState,
  save: SaveData
): void {
  drawSubScreenFrame(ctx, "BESTIARY", SPRITES.CODEX_BG);

  const entries = getBestiaryList(save.bestiary);
  const total = getTotalEnemyCount();
  const discovered = getDiscoveredCount(save.bestiary);

  ctx.fillStyle = "#667788";
  ctx.font = "10px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`DISCOVERED ${discovered} / ${total}`, 20, 52);

  if (entries.length === 0) {
    ctx.fillStyle = "#556666";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("No enemies discovered yet.", CANVAS_WIDTH / 2, 200);
    ctx.fillText("Engage hostiles to populate bestiary.", CANVAS_WIDTH / 2, 220);
    return;
  }

  const listX = 16;
  const listW = 160;
  const startY = 70;
  const rowH = 42;
  const selected = Math.min(state.bestiarySelected, entries.length - 1);

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const y = startY + i * rowH;
    const isSelected = i === selected;

    if (isSelected) {
      ctx.fillStyle = "rgba(68, 204, 255, 0.15)";
      ctx.beginPath();
      ctx.roundRect(listX, y, listW, rowH - 4, 4);
      ctx.fill();
    }

    const profile = ENEMY_CLASS_PROFILES[entry.classId];
    ctx.fillStyle = profile.tint;
    ctx.fillRect(listX + 8, y + 12, 8, 14);

    ctx.fillStyle = isSelected ? "#ffffff" : "#889999";
    ctx.font = isSelected ? "bold 11px monospace" : "11px monospace";
    ctx.textAlign = "left";
    ctx.fillText(entry.enemyType, listX + 24, y + 14);
    ctx.fillStyle = "#667788";
    ctx.font = "9px monospace";
    ctx.fillText(`x${entry.killCount} kills`, listX + 24, y + 28);
  }

  const entry = entries[selected];
  const profile = ENEMY_CLASS_PROFILES[entry.classId];
  const detailX = listX + listW + 16;
  const detailW = CANVAS_WIDTH - detailX - 16;

  ctx.shadowBlur = 4;
  ctx.shadowColor = profile.tint;
  ctx.fillStyle = profile.tint;
  ctx.font = "bold 14px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(entry.enemyType, detailX, startY);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#667788";
  ctx.font = "9px monospace";
  ctx.fillText(`CLASS: ${profile.name.toUpperCase()}`, detailX, startY + 18);

  let ay = startY + 40;
  ctx.fillStyle = "#ffdd44";
  ctx.font = "bold 9px monospace";
  ctx.fillText("EFFECTIVE VS", detailX, ay);
  ay += 12;
  ctx.font = "9px monospace";
  ctx.fillStyle = "#aaaaaa";
  const effStr = profile.effectiveVs.map((w) => WEAPON_TYPE_META[w].name).join(", ") || "—";
  ctx.fillText(effStr, detailX, ay);
  ay += 18;
  ctx.fillStyle = "#888899";
  ctx.font = "bold 9px monospace";
  ctx.fillText("RESISTS", detailX, ay);
  ay += 12;
  ctx.font = "9px monospace";
  ctx.fillStyle = "#aaaaaa";
  const resStr = profile.resistedVs.map((w) => WEAPON_TYPE_META[w].name).join(", ") || "—";
  ctx.fillText(resStr, detailX, ay);
  ay += 20;

  ctx.fillStyle = "#667788";
  ctx.font = "bold 9px monospace";
  ctx.fillText("STAT PROFILE", detailX, ay);
  ay += 12;
  ctx.font = "9px monospace";
  ctx.fillStyle = "#aaaaaa";
  ctx.fillText(`HP: ${profile.hpMult.toFixed(1)}x`, detailX, ay);
  ctx.fillText(`SPD: ${profile.speedMult.toFixed(1)}x`, detailX + 90, ay);
  ay += 12;
  ctx.fillText(`DMG: ${profile.damageMult.toFixed(1)}x`, detailX, ay);
  ctx.fillText(`RATE: ${profile.fireRateMult.toFixed(1)}x`, detailX + 90, ay);
  ay += 20;

  ctx.fillStyle = "#667788";
  ctx.font = "bold 9px monospace";
  ctx.fillText("INTEL", detailX, ay);
  ay += 12;
  ctx.fillStyle = "#aaaaaa";
  ctx.font = "10px monospace";
  // wrapText returns string[] in cockpitRenderer.ts — does not draw, just wraps
  const loreLines = wrapText(ctx, ENEMY_LORE[entry.enemyType], detailW);
  for (const line of loreLines) {
    ctx.fillText(line, detailX, ay);
    ay += 14;
  }
}
```

- [ ] **Step 4: Wire screen dispatch**

In the main cockpit render function (around line 20), add to the if/else chain:

```typescript
} else if (state.screen === "bestiary") {
  drawBestiaryScreen(ctx, state, save);
```

- [ ] **Step 5: Add input handling in Game.tsx**

```typescript
import { getBestiaryList } from "./engine/bestiary";

// In cockpit input handler:
if (cockpitState.screen === "bestiary") {
  const entries = getBestiaryList(save.bestiary);
  if (key === "ArrowUp") {
    setCockpitState((s) => ({
      ...s,
      bestiarySelected: Math.max(0, s.bestiarySelected - 1),
    }));
  } else if (key === "ArrowDown") {
    setCockpitState((s) => ({
      ...s,
      bestiarySelected: Math.min(entries.length - 1, s.bestiarySelected + 1),
    }));
  }
}
```

- [ ] **Step 6: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

- [ ] **Step 7: Playtest**

```bash
yarn dev
```

- [ ] Complete a mission with killed enemies
- [ ] Open cockpit hub → see BESTIARY hotspot
- [ ] Click → Bestiary screen opens
- [ ] List shows discovered enemies with tint swatches + kill counts
- [ ] Arrow keys navigate entries
- [ ] Detail panel shows name, class, effective/resists, stat multipliers, lore

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(sector-zero): add Bestiary screen to cockpit hub"
```

---

## Task 17: Final verification

**Files:** All

- [ ] **Step 1: Full build + lint**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -25
cd games/sector-zero/web && yarn lint 2>&1 | tail -20
```

Expected: `✓ Compiled successfully`, no new errors/warnings.

- [ ] **Step 2: Console self-tests**

```bash
yarn dev
```

Open devtools console — verify:
- [ ] No errors on page load
- [ ] No `console.assert` failures

- [ ] **Step 3: Campaign regression playtest**

- [ ] Game starts, player shoots, enemies die
- [ ] Enemies show class tints
- [ ] CRITICAL / RESISTED labels appear on non-neutral hits
- [ ] ⬆/⬇ arrow indicators show after hits
- [ ] Enemy HP varies by class (armored = ~2× hits, swarm = ~1 hit)
- [ ] Level completes, save persists
- [ ] Bestiary populates with kills

- [ ] **Step 4: Fresh-save regression**

- [ ] Clear localStorage, reload, start mission
- [ ] No errors
- [ ] Bestiary empty → "No enemies discovered yet" message
- [ ] After playing, bestiary populates

- [ ] **Step 5: Planet mission regression**

- [ ] Start planet mission from dev panel
- [ ] Enemies spawn with planet dominant class (visible tint distribution skewed)
- [ ] Affinity damage works
- [ ] Bestiary updates with `firstSeenPlanet` populated

- [ ] **Step 6: Final polish commit (if any)**

```bash
git status
git add -A
git commit -m "chore(sector-zero): affinity system final polish" || echo "Nothing to commit"
```

---

## Summary

After Task 17, the game has:

- ✅ 4 weapon types (Kinetic / Energy / Incendiary / Cryogenic)
- ✅ 8 enemy classes with distinct stat profiles and affinity profiles
- ✅ All existing enemies auto-tagged with a default class
- ✅ Planet missions apply dominant class to 70% of spawns
- ✅ Affinity damage multipliers applied to player→enemy damage
- ✅ Floating CRITICAL / RESISTED labels
- ✅ Class tint overlays on all enemies
- ✅ Up/down affinity arrow after each hit
- ✅ Bestiary screen in cockpit hub
- ✅ Save data migrated (field-fallback) with new fields
- ✅ Player weapon tagged Kinetic by default

**Out of scope (future plans):** Pilot leveling, multi-phase levels, ground run-and-gun, reward economy tiers 4-5, Scout ship reveal, Resonance Beacon, boss class assignments, full sprite redesign.

---

## Open Implementation Notes

- **Bosses:** MVP leaves bosses unaffected by affinity (TODO comment placed).
- **Weapon type switching:** Player always uses Kinetic in MVP. Future Loadout screen will let players equip other types.
- **Hotspot coordinates:** Bestiary hotspot position in Task 16 is designer-choice. Adjust after playtest.
- **Schema versioning:** save.ts uses field-fallback migration (existing convention). Version-based migration deferred.
- **Weapon-type icons in detail view:** MVP shows weapon type names. Icons in detail panel a future polish pass.

# Reward Economy Stage 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the 6 ship upgrades to prestige tiers 4-5, introduce 4 rare + 2 legendary material types, gate prestige tiers behind rare materials, and award rare materials from multi-phase mission completions.

**Architecture:** Extend existing `UPGRADE_DEFS` arrays (costs, effects, xpRequired, materialRequired) from max 2-3 levels to 5 levels. Add new `MaterialId` values for rare/legendary types. Award rare materials via a new `phaseRewards` field on `MultiPhaseLevelData`. The armory UI already supports locked/unlocked/purchasable states — it just needs to handle the larger level range and new material requirements.

**Tech Stack:** TypeScript, Next.js 15, React 19, HTML5 Canvas 2D. No test framework — `yarn build` + manual playtest.

**Spec reference:** [2026-04-05-sector-zero-expansion-design.md](../specs/2026-04-05-sector-zero-expansion-design.md) — Stage 1: Deeper Upgrade Tiers + Material Flow

**Verified codebase facts:**
- `UPGRADE_DEFS` in upgrades.ts has 6 entries with maxLevel 2-3, costs[], effects[], xpRequired[], materialRequired[]
- `ShipUpgrades` interface has 6 fields typed as `number` (no max enforcement in the type — max is in UPGRADE_DEFS.maxLevel)
- `MaterialId` type in types.ts is a string union with 10 values (bio-fiber through ferro-steel)
- `SaveData.materials: MaterialId[]` — list of collected materials
- `hasMaterial(id, save)` checks `save.materials.includes(id)`
- `canPurchase` checks credits, XP, and material requirements per tier
- `purchaseUpgrade` deducts credits and increments the upgrade level
- Armory renderer iterates UPGRADE_DEFS and shows up to maxLevel pips per upgrade
- Multi-phase level data exists in levels.ts (`getMultiPhaseLevelData`)
- The level-complete screen in Game.tsx shows material rewards for planet completions

---

## File Structure

### Modified files

| Path | Changes |
|------|---------|
| `engine/types.ts` | Extend `MaterialId` union with 6 new values (4 rare + 2 legendary) |
| `engine/upgrades.ts` | Extend all 6 UPGRADE_DEFS to maxLevel 5 with new costs, effects, xpRequired, materialRequired |
| `engine/planets.ts` | Add rare/legendary material definitions to MATERIAL_DEFS |
| `engine/levels.ts` | Add `phaseRewards` to the test multi-phase level (W1-L3 Phase 2 awards a rare material) |
| `engine/save.ts` | No changes needed — materials field is already `MaterialId[]` and migration handles missing fields |
| `engine/gameEngine.ts` | Apply prestige upgrade effects (Lv 4-5 bonuses) in createPlayer |
| `engine/cockpitRenderer.ts` | Armory already handles variable maxLevel — verify it renders 5 pips correctly |
| `Game.tsx` | Award phase rewards (rare materials) on multi-phase level completion; show on level-complete screen |

---

## Task 1: Extend MaterialId with rare + legendary types

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/types.ts`

- [ ] **Step 1: Find MaterialId type**

```bash
cd games/sector-zero/web && grep -n "type MaterialId" app/components/engine/types.ts
```

- [ ] **Step 2: Add 6 new material IDs to the union**

Find the `MaterialId` type definition. Add after the existing values:

```typescript
export type MaterialId =
  | "bio-fiber" | "cryogenic-alloy" | "molten-core" | "ruin-shard"
  | "abyssal-plating" | "desert-glass" | "phase-crystal" | "genesis-seed"
  | "neon-circuitry" | "ferro-steel"
  // Rare materials (from multi-phase missions)
  | "kinetic-core" | "energy-cell" | "ember-shard" | "cryo-essence"
  // Legendary materials (from boss rare drops + optional phases)
  | "void-fragment" | "hollow-resonance";
```

- [ ] **Step 3: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -15
```

Expected: `✓ Compiled successfully` (the MaterialId union is just a type — no consumers break).

- [ ] **Step 4: Commit**

```bash
cd /Users/nichalasbarnes/Desktop/projects/knicks-knacks
git add games/sector-zero/web/app/components/engine/types.ts
git commit -m "feat(sector-zero): add rare and legendary material types"
```

---

## Task 2: Add rare/legendary material definitions

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/planets.ts`

- [ ] **Step 1: Find MATERIAL_DEFS**

```bash
cd games/sector-zero/web && grep -n "MATERIAL_DEFS\|MaterialDef" app/components/engine/planets.ts | head -10
```

Read the existing material definitions to understand the shape.

- [ ] **Step 2: Add rare + legendary materials to MATERIAL_DEFS**

After the last existing material definition, add:

```typescript
  // ── Rare Materials ──
  {
    id: "kinetic-core",
    name: "Kinetic Core",
    icon: "◆",
    color: "#e8e8ee",
    sourcePlanet: undefined,
    description: "Dense projectile matrix. Required for prestige weapon upgrades.",
  },
  {
    id: "energy-cell",
    name: "Energy Cell",
    icon: "◆",
    color: "#44ccff",
    sourcePlanet: undefined,
    description: "Concentrated energy lattice. Powers prestige shield and engine systems.",
  },
  {
    id: "ember-shard",
    name: "Ember Shard",
    icon: "◆",
    color: "#ff6a1a",
    sourcePlanet: undefined,
    description: "Volatile incendiary fragment. Fuels prestige munitions upgrades.",
  },
  {
    id: "cryo-essence",
    name: "Cryo Essence",
    icon: "◆",
    color: "#aaddff",
    sourcePlanet: undefined,
    description: "Supercooled crystalline extract. Required for prestige hull reinforcement.",
  },
  // ── Legendary Materials ──
  {
    id: "void-fragment",
    name: "Void Fragment",
    icon: "★",
    color: "#aa44ff",
    sourcePlanet: undefined,
    description: "A shard of compressed spacetime from the Void Abyss. Unimaginably dense.",
  },
  {
    id: "hollow-resonance",
    name: "Hollow Resonance",
    icon: "★",
    color: "#ff4444",
    sourcePlanet: undefined,
    description: "A crystallized echo of the Hollow Mind's signal. Pulses with alien consciousness.",
  },
```

**IMPORTANT:** `MaterialDef.sourcePlanet` is typed as required `PlanetId` (not optional). Before adding the new entries, make the field optional in the `MaterialDef` interface in planets.ts:

```typescript
export interface MaterialDef {
  id: MaterialId;
  name: string;
  icon: string;
  color: string;
  sourcePlanet?: PlanetId;  // Changed from required to optional
  description: string;
}
```

This is safe — existing entries all have `sourcePlanet` set. The new rare/legendary materials omit it because they come from multi-phase missions, not a specific planet.

- [ ] **Step 3: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -15
```

- [ ] **Step 4: Commit**

```bash
git add games/sector-zero/web/app/components/engine/planets.ts
git commit -m "feat(sector-zero): add rare and legendary material definitions"
```

---

## Task 3: Extend UPGRADE_DEFS to max level 5

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/upgrades.ts`

- [ ] **Step 1: Read current upgrade defs**

```bash
cd games/sector-zero/web && cat app/components/engine/upgrades.ts
```

- [ ] **Step 2: Extend all 6 upgrades to maxLevel 5**

For each upgrade, extend `maxLevel`, `costs`, `effects`, `xpRequired`, `materialRequired` arrays. Replace each def's values:

**Hull Plating** (was maxLevel 3):
```typescript
{
  id: "hullPlating",
  name: "HULL PLATING",
  description: "Reinforced hull absorbs more damage",
  maxLevel: 5,
  costs: [200, 500, 1000, 2500, 5000],
  effects: [
    "+1 Max HP (4 total)",
    "+2 Max HP (5 total)",
    "+3 Max HP (6 total)",
    "+3 Max HP + regen between waves",
    "+4 Max HP (7 total)",
  ],
  icon: "\u2666",
  color: "#44aaff",
  xpRequired: [0, 8000, 25000, 50000, 100000],
  materialRequired: [undefined, "bio-fiber", "abyssal-plating", "cryo-essence", "void-fragment"],
},
```

**Engine Boost** (was maxLevel 3):
```typescript
{
  id: "engineBoost",
  name: "ENGINE BOOST",
  description: "Overclocked thrusters for faster movement",
  maxLevel: 5,
  costs: [150, 400, 800, 2000, 4000],
  effects: [
    "+0.5 Speed",
    "+1.0 Speed",
    "+1.5 Speed",
    "+2.0 Speed",
    "+2.5 Speed",
  ],
  icon: "\u25B2",
  color: "#ffaa44",
  xpRequired: [0, 8000, 20000, 45000, 90000],
  materialRequired: [undefined, "cryogenic-alloy", undefined, "energy-cell", "void-fragment"],
},
```

**Weapon Core** (was maxLevel 2):
```typescript
{
  id: "weaponCore",
  name: "WEAPON CORE",
  description: "Start missions with stronger weapons",
  maxLevel: 5,
  costs: [300, 800, 1500, 3000, 6000],
  effects: [
    "Start at Weapon Lv 2",
    "Start at Weapon Lv 3",
    "Start at Weapon Lv 4",
    "Start at Weapon Lv 4",
    "Start at Weapon Lv 5",
  ],
  icon: "\u2726",
  color: "#ff4444",
  xpRequired: [5000, 25000, 40000, 60000, 120000],
  materialRequired: [undefined, "molten-core", "kinetic-core", "ember-shard", "hollow-resonance"],
},
```

**Munitions Bay** (was maxLevel 3):
```typescript
{
  id: "munitionsBay",
  name: "MUNITIONS BAY",
  description: "Expanded storage for additional bombs",
  maxLevel: 5,
  costs: [200, 500, 1000, 2000, 4500],
  effects: [
    "+1 Starting Bomb (3)",
    "+2 Starting Bombs (4)",
    "+3 Starting Bombs (5)",
    "+4 Starting Bombs (6)",
    "+5 Starting Bombs (7)",
  ],
  icon: "\u25CF",
  color: "#ff3333",
  xpRequired: [0, 8000, 20000, 45000, 90000],
  materialRequired: [undefined, "ruin-shard", undefined, "ember-shard", "hollow-resonance"],
},
```

**Fire Control** (was maxLevel 2):
```typescript
{
  id: "fireControl",
  name: "FIRE CONTROL",
  description: "Targeting computer increases fire rate",
  maxLevel: 5,
  costs: [250, 600, 1200, 2500, 5000],
  effects: [
    "-1 Frame Fire Delay",
    "-2 Frame Fire Delay",
    "-3 Frame Fire Delay",
    "-3 Frame Fire Delay + tracking",
    "-4 Frame Fire Delay",
  ],
  icon: "\u2694",
  color: "#44ff88",
  xpRequired: [15000, 40000, 55000, 75000, 130000],
  materialRequired: [undefined, "desert-glass", "kinetic-core", "energy-cell", "void-fragment"],
},
```

**Shield Generator** (was maxLevel 2):
```typescript
{
  id: "shieldGenerator",
  name: "SHIELD GEN",
  description: "Shield power-ups last longer",
  maxLevel: 5,
  costs: [300, 700, 1400, 3000, 5500],
  effects: [
    "+200 Shield Duration",
    "+400 Shield Duration",
    "+600 Shield Duration",
    "+800 Shield Duration",
    "+1000 Shield Duration",
  ],
  icon: "\u2B21",
  color: "#4488ff",
  xpRequired: [5000, 25000, 40000, 60000, 110000],
  materialRequired: [undefined, "phase-crystal", "cryo-essence", "energy-cell", "hollow-resonance"],
},
```

- [ ] **Step 3: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -15
```

Expected: `✓ Compiled successfully`. The existing `canPurchase`, `getUpgradeCost`, and armory renderer already use array indexing from the def — extending the arrays is backward compatible.

- [ ] **Step 4: Commit**

```bash
git add games/sector-zero/web/app/components/engine/upgrades.ts
git commit -m "feat(sector-zero): extend all upgrades to prestige tiers 4-5"
```

---

## Task 4: Apply prestige upgrade effects in gameplay

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/gameEngine.ts`

- [ ] **Step 1: Find createPlayer**

```bash
cd games/sector-zero/web && grep -n "function createPlayer" app/components/engine/gameEngine.ts
```

Read ~20 lines to see how upgrades apply.

- [ ] **Step 2: Verify hull plating is additive**

The existing code should have something like:
```typescript
let maxHp = PLAYER_MAX_HP + upgrades.hullPlating + bonusHp(pilotLevel);
```

Since `upgrades.hullPlating` is now 0-5 (was 0-3), and it's used additively, **levels 4-5 automatically work** — +4 and +5 HP. No change needed for hull plating.

- [ ] **Step 3: Verify weapon core is additive**

Find where `weaponLevel` is set from `weaponCore`:

```bash
cd games/sector-zero/web && grep -n "weaponCore\|weaponLevel.*upgrade" app/components/engine/gameEngine.ts | head -5
```

It should be something like `weaponLevel: 1 + upgrades.weaponCore`. Since weaponCore goes up to 5, this gives starting weapon level 6... but max weapon level is 5. Add a clamp:

```typescript
weaponLevel: Math.min(5, 1 + upgrades.weaponCore),
```

- [ ] **Step 4: Verify other upgrades**

Check each upgrade's application:

```bash
cd games/sector-zero/web && grep -n "engineBoost\|munitionsBay\|fireControl\|shieldGenerator" app/components/engine/gameEngine.ts | head -15
```

- `engineBoost`: likely `speed: PLAYER_SPEED + upgrades.engineBoost * 0.5` — levels 4-5 give +2.0 and +2.5 speed. Works automatically.
- `munitionsBay`: likely `bombs: 2 + upgrades.munitionsBay` — levels 4-5 give 6 and 7 bombs. Works automatically.
- `fireControl`: likely applied as `PLAYER_FIRE_RATE - upgrades.fireControl` — levels 4-5 give -4 and -5 delay. Add a clamp to prevent going below 2:

```typescript
const fireRate = Math.max(2, PLAYER_FIRE_RATE - upgrades.fireControl);
```

- `shieldGenerator`: likely applied in power-up duration code — check where shield duration is computed.

```bash
cd games/sector-zero/web && grep -n "shieldGenerator\|shield.*duration\|SHIELD.*dur" app/components/engine/gameEngine.ts | head -10
```

It should multiply or add to shield duration. Levels 4-5 give +800 and +1000 frames. Verify the formula scales correctly.

- [ ] **Step 5: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -15
```

- [ ] **Step 6: Commit**

```bash
git add games/sector-zero/web/app/components/engine/gameEngine.ts
git commit -m "feat(sector-zero): apply prestige tier 4-5 upgrade effects with safety clamps"
```

---

## Task 5: Award rare materials from multi-phase completions

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/types.ts`
- Modify: `games/sector-zero/web/app/components/engine/levels.ts`
- Modify: `games/sector-zero/web/app/components/Game.tsx`

- [ ] **Step 1: Add phaseRewards to MultiPhaseLevelData**

In types.ts, find `MultiPhaseLevelData`. Add a rewards field:

```typescript
export interface MultiPhaseLevelData {
  world: number;
  level: number;
  name: string;
  briefingText: string;
  worldIntroText?: string;
  phases: PhaseDefinition[];
  /** Materials awarded on completing ALL phases. Only awarded once (first completion). */
  completionRewards?: MaterialId[];
}
```

- [ ] **Step 2: Add rewards to the test multi-phase level**

In levels.ts, find `getMultiPhaseLevelData`. In the W1-L3 definition, add:

```typescript
return {
  world,
  level,
  name: baseLevel.name,
  // ... existing ...
  completionRewards: ["kinetic-core"],  // NEW — award a rare material
};
```

- [ ] **Step 3: Award materials on multi-phase level completion in Game.tsx**

In Game.tsx, find the `nextLevel` function. After the save/bestiary flush, check for multi-phase rewards:

```typescript
import { getMultiPhaseLevelData } from "./engine/levels";
```

After `newSave = recalcPilotLevel(newSave);` and before `saveSave(newSave)`:

```typescript
// Award multi-phase completion rewards (deduplicated per material — each rare material can only be obtained once)
const multiPhaseData = getMultiPhaseLevelData(gameState.currentWorld, gameState.currentLevel);
if (multiPhaseData?.completionRewards && gameState.currentPhase >= gameState.totalPhases - 1) {
  for (const matId of multiPhaseData.completionRewards) {
    if (!newSave.materials.includes(matId)) {
      newSave = { ...newSave, materials: [...newSave.materials, matId] };
    }
  }
}
```

Note: `getMultiPhaseLevelData` may already be imported. Check:
```bash
cd games/sector-zero/web && grep -n "getMultiPhaseLevelData" app/components/Game.tsx | head -3
```

If not imported, add it.

- [ ] **Step 4: Show rare material reward on level-complete screen**

In Game.tsx, find the LEVEL_COMPLETE overlay. After the credits display, add a material reward section:

```bash
cd games/sector-zero/web && grep -n "CREDITS\|completionRewards\|material.*reward" app/components/Game.tsx | head -10
```

**Timing note:** The overlay renders while `screen === LEVEL_COMPLETE`, BEFORE the player clicks "NEXT LEVEL" (which triggers `nextLevel`). So `saveData` still reflects pre-completion state. The `!saveData.materials.includes(m)` check correctly identifies new materials because they haven't been awarded yet.

After the credits `<p>` tag, add:

```typescript
{(() => {
  const mpData = getMultiPhaseLevelData(gameState.currentWorld, gameState.currentLevel);
  if (!mpData?.completionRewards?.length) return null;
  if (gameState.currentPhase < gameState.totalPhases - 1) return null;
  const newMaterials = mpData.completionRewards.filter(
    (m) => !saveData.materials.includes(m)
  );
  if (newMaterials.length === 0) return null;
  return (
    <div className="mt-2 space-y-1">
      {newMaterials.map((matId) => (
        <p key={matId} className="text-sm text-purple-400 font-bold animate-pulse">
          + {matId.replace(/-/g, " ").toUpperCase()} (RARE)
        </p>
      ))}
    </div>
  );
})()}
```

- [ ] **Step 5: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -15
```

- [ ] **Step 6: Commit**

```bash
git add games/sector-zero/web/app/components/engine/types.ts games/sector-zero/web/app/components/engine/levels.ts games/sector-zero/web/app/components/Game.tsx
git commit -m "feat(sector-zero): award rare materials from multi-phase level completions"
```

---

## Task 6: Verify armory renders prestige tiers correctly

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/cockpitRenderer.ts` (only if needed)

- [ ] **Step 1: Check pip rendering**

The armory renders level pips in a loop: `for (let lv = 0; lv < def.maxLevel; lv++)`. With maxLevel now 5, this should render 5 pips automatically. But check if the pips overflow horizontally.

```bash
cd games/sector-zero/web && grep -n "pipX\|pip.*lv\|def.maxLevel" app/components/engine/cockpitRenderer.ts | head -10
```

Read ~10 lines around the pip rendering. The current code uses `pipX + lv * 28` for each pip. With 5 pips: 0, 28, 56, 84, 112 — that's ~140px total. The list area is `CANVAS_WIDTH - 32 = 448px`. Plenty of room. No change needed.

- [ ] **Step 2: Check "MAX" label positioning**

The "MAX" label appears after the last pip: `pipX + def.maxLevel * 28 + 4`. With 5 pips: `pipX + 144`. Should be fine.

- [ ] **Step 3: Check material display in upgrade detail panel**

The detail panel shows material requirements via `getUnlockRequirement()`. This function already reads `def.materialRequired[targetLevel - 1]`, which now includes the rare material names. Verify the rare material names display correctly by reading the `getUnlockRequirement` function:

```bash
cd games/sector-zero/web && grep -n "function getUnlockRequirement" app/components/engine/upgrades.ts
```

Read ~20 lines. It should format the material name. If it uses `hasMaterial()` which checks `save.materials.includes(id)`, the new rare materials will work automatically since they use the same `MaterialId` type.

- [ ] **Step 4: Playtest check**

```bash
cd games/sector-zero/web && yarn dev
```

Open cockpit → Armory. Verify:
- [ ] All 6 upgrades show 5 level pips (instead of 2-3)
- [ ] Tiers 4-5 show as LOCKED with XP + material requirements
- [ ] Material names display correctly (e.g., "REQUIRES: Cryo Essence")
- [ ] Existing tiers 1-3 still purchasable normally

- [ ] **Step 5: If any rendering issues, fix them**

If pips overlap or text overflows, adjust spacing. If no issues, no commit needed.

- [ ] **Step 6: Commit (only if changes made)**

```bash
git add -A
git commit -m "fix(sector-zero): adjust armory rendering for 5-tier upgrades" || echo "No changes needed"
```

---

## Task 7: Final verification

**Files:** All

- [ ] **Step 1: Full build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

- [ ] **Step 2: Playtest checklist**

```bash
cd games/sector-zero/web && yarn dev
```

- [ ] Armory shows all 6 upgrades with 5 tiers
- [ ] Existing purchased tiers still display correctly
- [ ] Tiers 4-5 locked behind high XP + rare materials
- [ ] Rare material names show in lock requirements
- [ ] Play W1-L3 (multi-phase) — complete both phases
- [ ] Level-complete screen shows "+ KINETIC CORE (RARE)" on first completion
- [ ] Check localStorage — `materials` array includes "kinetic-core"
- [ ] Return to armory — "kinetic-core" satisfies requirements that need it
- [ ] Normal levels still complete normally (no rare material rewards shown)
- [ ] Planet missions still award their common materials
- [ ] No console errors

- [ ] **Step 3: Fresh save regression**

- [ ] Clear localStorage, reload
- [ ] All upgrades start at level 0, 5 tiers shown
- [ ] No rare materials in inventory

- [ ] **Step 4: Final commit**

```bash
git status
git add -A
git commit -m "chore(sector-zero): reward economy stage 1 final verification" || echo "Nothing to commit"
```

---

## Summary

After Task 7, the game has:

- ✅ All 6 upgrades extended to 5 tiers (was 2-3)
- ✅ Prestige tiers 4-5 with high credit costs (2000-6000), high XP thresholds (45k-130k), and rare/legendary material requirements
- ✅ 4 rare materials: Kinetic Core, Energy Cell, Ember Shard, Cryo Essence
- ✅ 2 legendary materials: Void Fragment, Hollow Resonance
- ✅ Rare materials awarded from multi-phase mission completions (first-time only)
- ✅ Level-complete screen shows rare material rewards
- ✅ Armory UI renders 5-tier pips and prestige lock requirements
- ✅ Upgrade effects scale to level 5 with safety clamps
- ✅ Backward compatible — existing saves and purchases preserved

**Out of scope (future plans):**
- More multi-phase levels awarding different rare materials
- Legendary material drop from boss rare-drops
- Stage 2 (ships/hangar), Stage 3 (loadouts), Stage 4 (workshop/consumables)
- Material drop rate bonuses from pilot level (display only in MVP)

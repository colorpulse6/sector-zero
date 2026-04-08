# Pilot Leveling System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an RPG-style pilot leveling system (levels 1-30) with passive stat bonuses, a Combat skill tree (5 nodes + capstone), skill point allocation, and level-up display — all layered on top of the existing ship-upgrade and XP systems.

**Architecture:** Create a `pilotLevel.ts` module that converts cumulative XP (already tracked in `SaveData.xp`) into a pilot level via an exponential XP curve. Extend `SaveData` with `pilotLevel`, `skillPoints`, and `allocatedSkills`. The skill tree is pure data — a `skillTree.ts` module defines nodes, costs, prerequisites, and effect lookups. Skill effects are applied at relevant code points (damage calc, power-up duration, credit earn, material drops). A new "PILOT" cockpit screen shows level progress and the skill tree allocation UI.

**Tech Stack:** TypeScript, Next.js 15, React 19, HTML5 Canvas 2D. No test framework — verification via `yarn build` + manual playtest. Dev-mode `console.assert` self-tests for pure logic.

**Spec reference:** [2026-04-05-sector-zero-expansion-design.md](../specs/2026-04-05-sector-zero-expansion-design.md) — System 4

**MVP scope (this plan):** Levels 1-30, passive bonuses, Combat tree only. Engineering and Piloting trees are future plans. Milestone unlock gates are data-only markers (ships/loadouts don't exist yet).

**Verified codebase facts:**
- `SaveData.xp` accumulates total XP across all missions (save.ts line 132)
- XP is awarded in gameEngine.ts: enemy kills (combo-scaled), power-ups (+50), level bonuses (+500/+1000/+2000)
- The armory screen shows `XP ${save.xp.toLocaleString()}` at top-right (cockpitRenderer.ts line 372)
- Dashboard has an XP bar at bottom (dashboard.ts line 31)
- `createPlayer(upgrades)` in gameEngine.ts applies ship upgrades to initial player stats (line ~120)
- Cockpit hub has hotspots navigable via NAV_GRAPH in cockpit.ts

---

## File Structure

### New files

| Path | Responsibility |
|------|----------------|
| `engine/pilotLevel.ts` | XP curve, level calculation, passive bonus formulas, milestone definitions |
| `engine/skillTree.ts` | Skill node definitions (Combat tree), allocation logic, effect lookups |

### Modified files

| Path | Changes |
|------|---------|
| `engine/types.ts` | Add `SkillNodeId`, `SkillTreeId`, `PilotMilestone` types; extend `SaveData` with `pilotLevel`, `skillPoints`, `allocatedSkills` |
| `engine/save.ts` | Extend defaults + migration; add `recalcPilotLevel` on load |
| `engine/gameEngine.ts` | Apply passive bonuses in `createPlayer`; apply skill effects to damage, power-up duration; level-up check after XP award |
| `engine/cockpit.ts` | Add `"pilot"` screen + `pilotTreeScroll` state + hotspot + input handler |
| `engine/cockpitRenderer.ts` | Add `drawPilotScreen` — level bar, stat bonuses, skill tree with allocatable nodes |
| `engine/dashboard.ts` | Show pilot level badge next to XP bar |
| `Game.tsx` | Recalc pilot level + award skill points on mission-complete save |

---

## Task 1: Define pilot level types in types.ts

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/types.ts`

- [ ] **Step 1: Find insertion points**

```bash
cd games/sector-zero/web && grep -n "export interface SaveData\|BestiaryEntry\|// ─── Bestiary" app/components/engine/types.ts
```

- [ ] **Step 2: Add types before the Bestiary section**

Find `// ─── Bestiary ───────────────────────────────────────────────────────`. IMMEDIATELY BEFORE it, insert:

```typescript
// ─── Pilot Leveling ─────────────────────────────────────────────────
export type SkillTreeId = "combat" | "engineering" | "piloting";

export type SkillNodeId =
  // Combat tree
  | "sharpshooter"
  | "overcharge"
  | "berserker"
  | "glass-cannon"
  | "adrenaline"
  | "signature-weapon"
  // Future: engineering + piloting nodes added in later plans
  ;

export interface PilotMilestone {
  level: number;
  label: string;
  unlocked: boolean;
}

```

- [ ] **Step 3: Extend SaveData**

In `SaveData`, add after `equippedWeaponType`:

```typescript
  // Pilot leveling
  pilotLevel: number;
  skillPoints: number;
  allocatedSkills: SkillNodeId[];
```

- [ ] **Step 4: Verify**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

Expected: Build fails in save.ts (missing new SaveData fields). This is expected.

- [ ] **Step 5: Commit**

```bash
cd /Users/nichalasbarnes/Desktop/projects/knicks-knacks
git add games/sector-zero/web/app/components/engine/types.ts
git commit -m "feat(sector-zero): add pilot leveling types"
```

---

## Task 2: Create pilotLevel.ts — XP curve and passive bonuses

**Files:**
- Create: `games/sector-zero/web/app/components/engine/pilotLevel.ts`

- [ ] **Step 1: Create the module**

```typescript
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
  // Per-level increment grows with level
  const increment = 800 * (lv - 1) + Math.floor(50 * Math.pow(lv, 1.8));
  // Cumulative: add to previous level's total
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
  console.assert(calcPilotLevel(999999) === MAX_PILOT_LEVEL, "Huge XP = max level");
  console.assert(skillPointsAtLevel(3) === 1, "Level 3 = 1 skill point");
  console.assert(skillPointsAtLevel(6) === 2, "Level 6 = 2 skill points");
  console.assert(skillPointsAtLevel(30) === 10, "Level 30 = 10 skill points");
  console.assert(bonusHp(10) === 1, "Level 10 = +1 HP");
  console.assert(bonusHp(20) === 2, "Level 20 = +2 HP");
  console.assert(bonusHp(7) === 0, "Level 7 = +0 HP");
  // XP curve is monotonically increasing
  for (let i = 2; i <= MAX_PILOT_LEVEL; i++) {
    console.assert(XP_CURVE[i] > XP_CURVE[i - 1], `XP curve not increasing at level ${i}`);
  }
}

if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
  __runPilotLevelSelfTests();
}
```

- [ ] **Step 2: Verify**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add games/sector-zero/web/app/components/engine/pilotLevel.ts
git commit -m "feat(sector-zero): add pilot level XP curve and passive bonuses"
```

---

## Task 3: Create skillTree.ts — Combat tree definitions

**Files:**
- Create: `games/sector-zero/web/app/components/engine/skillTree.ts`

- [ ] **Step 1: Create the module**

```typescript
import type { SkillNodeId, SkillTreeId } from "./types";

export interface SkillNode {
  id: SkillNodeId;
  tree: SkillTreeId;
  name: string;
  description: string;
  cost: number;              // skill points to allocate (1 for regular, 2 for capstone)
  isCapstone: boolean;
  prerequisites: SkillNodeId[];  // must be allocated before this node
  icon: string;              // single char for UI
  color: string;
  /** Numeric effect value (interpretation depends on node) */
  effectValue: number;
}

// ─── Combat Tree ────────────────────────────────────────────────────

export const COMBAT_TREE: SkillNode[] = [
  {
    id: "sharpshooter",
    tree: "combat",
    name: "Sharpshooter",
    description: "+20% damage to enemies at Effective affinity",
    cost: 1,
    isCapstone: false,
    prerequisites: [],
    icon: "\u2316",  // crosshair
    color: "#ff4444",
    effectValue: 0.2,
  },
  {
    id: "overcharge",
    tree: "combat",
    name: "Overcharge",
    description: "Weapon power-ups last 50% longer",
    cost: 1,
    isCapstone: false,
    prerequisites: [],
    icon: "\u26A1",  // lightning
    color: "#ffaa44",
    effectValue: 0.5,
  },
  {
    id: "berserker",
    tree: "combat",
    name: "Berserker",
    description: "+5% damage per missing HP",
    cost: 1,
    isCapstone: false,
    prerequisites: ["sharpshooter"],
    icon: "\u2694",  // swords
    color: "#ff2222",
    effectValue: 0.05,
  },
  {
    id: "glass-cannon",
    tree: "combat",
    name: "Glass Cannon",
    description: "+30% damage, -1 max HP",
    cost: 1,
    isCapstone: false,
    prerequisites: ["berserker"],
    icon: "\u2622",  // warning
    color: "#ff6600",
    effectValue: 0.3,
  },
  {
    id: "adrenaline",
    tree: "combat",
    name: "Adrenaline Rush",
    description: "+10% fire rate (permanent)",
    cost: 1,
    isCapstone: false,
    prerequisites: ["overcharge"],
    icon: "\u2764",  // heart
    color: "#ff4488",
    effectValue: 0.1,
  },
  {
    id: "signature-weapon",
    tree: "combat",
    name: "Signature Weapon",
    description: "Equip a second primary weapon type",
    cost: 2,
    isCapstone: true,
    prerequisites: ["sharpshooter", "overcharge", "berserker", "glass-cannon", "adrenaline"],
    icon: "\u2726",  // star
    color: "#ffdd00",
    effectValue: 1,
  },
];

// ─── All Trees (expandable) ─────────────────────────────────────────

export const ALL_SKILL_NODES: SkillNode[] = [...COMBAT_TREE];

export function getNode(id: SkillNodeId): SkillNode | undefined {
  return ALL_SKILL_NODES.find((n) => n.id === id);
}

export function getTreeNodes(tree: SkillTreeId): SkillNode[] {
  return ALL_SKILL_NODES.filter((n) => n.tree === tree);
}

/** Check if a node can be allocated given current allocations and available points. */
export function canAllocate(
  nodeId: SkillNodeId,
  allocated: SkillNodeId[],
  availablePoints: number
): boolean {
  if (allocated.includes(nodeId)) return false;
  const node = getNode(nodeId);
  if (!node) return false;
  if (node.cost > availablePoints) return false;
  return node.prerequisites.every((pre) => allocated.includes(pre));
}

/** Allocate a node. Returns new allocated array + remaining points, or null if invalid. */
export function allocateNode(
  nodeId: SkillNodeId,
  allocated: SkillNodeId[],
  availablePoints: number
): { allocated: SkillNodeId[]; pointsRemaining: number } | null {
  if (!canAllocate(nodeId, allocated, availablePoints)) return null;
  const node = getNode(nodeId)!;
  return {
    allocated: [...allocated, nodeId],
    pointsRemaining: availablePoints - node.cost,
  };
}

/** Respec: clear all allocations, return total points. */
export function respecAll(
  allocated: SkillNodeId[]
): { allocated: SkillNodeId[]; pointsReturned: number } {
  let returned = 0;
  for (const id of allocated) {
    const node = getNode(id);
    if (node) returned += node.cost;
  }
  return { allocated: [], pointsReturned: returned };
}

/** Check if a specific skill effect is active. */
export function hasSkill(allocated: SkillNodeId[], id: SkillNodeId): boolean {
  return allocated.includes(id);
}

/** Get the effect value of a skill (0 if not allocated). */
export function getSkillEffect(allocated: SkillNodeId[], id: SkillNodeId): number {
  if (!allocated.includes(id)) return 0;
  const node = getNode(id);
  return node?.effectValue ?? 0;
}

// ─── Dev self-tests ─────────────────────────────────────────────────

export function __runSkillTreeSelfTests(): void {
  // Combat tree has 6 nodes (5 regular + 1 capstone)
  console.assert(COMBAT_TREE.length === 6, `Combat tree has ${COMBAT_TREE.length} nodes, expected 6`);

  // Capstone requires all 5 regular nodes
  const capstone = COMBAT_TREE.find((n) => n.isCapstone);
  console.assert(capstone !== undefined, "Combat tree missing capstone");
  console.assert(capstone!.cost === 2, "Capstone should cost 2 points");
  console.assert(capstone!.prerequisites.length === 5, "Capstone should require all 5 regular nodes");

  // Total cost of full tree = 5*1 + 2 = 7
  const totalCost = COMBAT_TREE.reduce((sum, n) => sum + n.cost, 0);
  console.assert(totalCost === 7, `Full combat tree costs ${totalCost}, expected 7`);

  // canAllocate: root nodes can be allocated with enough points
  console.assert(canAllocate("sharpshooter", [], 1), "Should allocate sharpshooter with 1 point");
  console.assert(!canAllocate("sharpshooter", [], 0), "Can't allocate with 0 points");
  console.assert(!canAllocate("berserker", [], 1), "Berserker requires sharpshooter first");
  console.assert(canAllocate("berserker", ["sharpshooter"], 1), "Berserker allowed after sharpshooter");
  console.assert(!canAllocate("sharpshooter", ["sharpshooter"], 1), "Can't double-allocate");

  // allocateNode returns correct state
  const result = allocateNode("sharpshooter", [], 3);
  console.assert(result !== null, "Should succeed");
  console.assert(result!.allocated.includes("sharpshooter"), "Should include sharpshooter");
  console.assert(result!.pointsRemaining === 2, "Should have 2 points remaining");

  // Respec returns correct total
  const respec = respecAll(["sharpshooter", "overcharge", "berserker"]);
  console.assert(respec.allocated.length === 0, "Respec clears all");
  console.assert(respec.pointsReturned === 3, "Respec returns 3 points");
}

if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
  __runSkillTreeSelfTests();
}
```

- [ ] **Step 2: Verify**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add games/sector-zero/web/app/components/engine/skillTree.ts
git commit -m "feat(sector-zero): add combat skill tree definitions and allocation logic"
```

---

## Task 4: Update save.ts — defaults, migration, pilot level recalc

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/save.ts`

- [ ] **Step 1: Read save.ts**

```bash
cd games/sector-zero/web && head -70 app/components/engine/save.ts
```

- [ ] **Step 2: Add imports**

```typescript
import type { SkillNodeId } from "./types";
import { calcPilotLevel, skillPointsAtLevel } from "./pilotLevel";
```

- [ ] **Step 3: Extend defaultSave**

Add after `equippedWeaponType`:

```typescript
  pilotLevel: 1,
  skillPoints: 0,
  allocatedSkills: [],
```

- [ ] **Step 4: Extend migrateSave**

Add to the return object:

```typescript
  pilotLevel: (raw.pilotLevel as number) ?? 1,
  skillPoints: (raw.skillPoints as number) ?? 0,
  allocatedSkills: (raw.allocatedSkills as SkillNodeId[]) ?? [],
```

- [ ] **Step 5: Add recalcPilotLevel function**

Add `import { getNode } from "./skillTree";` to the imports at the top of save.ts.

After `migrateSave`, add:

```typescript
/** Recalculate pilot level and available skill points from total XP.
 *  Called on load to ensure save data is consistent. */
export function recalcPilotLevel(save: SaveData): SaveData {
  const level = calcPilotLevel(save.xp);
  const totalPoints = skillPointsAtLevel(level);
  let spentPoints = 0;
  for (const id of save.allocatedSkills) {
    const node = getNode(id);
    spentPoints += node?.cost ?? 1;
  }
  return {
    ...save,
    pilotLevel: level,
    skillPoints: Math.max(0, totalPoints - spentPoints),
  };
}
```

- [ ] **Step 6: Call recalcPilotLevel in loadSave**

Find `loadSave()`. Before the return, wrap with recalc:

```typescript
export function loadSave(): SaveData {
  if (typeof window === "undefined") return { ...defaultSave };
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return unlockCodexEntries({ ...defaultSave });
    const parsed = JSON.parse(raw);
    return recalcPilotLevel(unlockCodexEntries(migrateSave(parsed)));
  } catch {
    return unlockCodexEntries({ ...defaultSave });
  }
}
```

- [ ] **Step 7: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully`

- [ ] **Step 8: Commit**

```bash
git add games/sector-zero/web/app/components/engine/save.ts
git commit -m "feat(sector-zero): extend save for pilot level, skill points, skill allocation"
```

---

## Task 5: Apply passive bonuses in createPlayer

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/gameEngine.ts`

- [ ] **Step 1: Find createPlayer**

```bash
cd games/sector-zero/web && grep -n "function createPlayer" app/components/engine/gameEngine.ts
```

Read ~30 lines from that point.

- [ ] **Step 2: Add import**

```typescript
import { bonusHp } from "./pilotLevel";
import { hasSkill, getSkillEffect } from "./skillTree";
```

- [ ] **Step 3: Apply bonus HP from pilot level**

The `createPlayer` function takes `upgrades: ShipUpgrades`. It needs the pilot level too. But pilot level isn't passed in currently.

**Approach:** Add a second optional parameter for pilot level:

```typescript
function createPlayer(upgrades: ShipUpgrades, pilotLevel: number = 1): Player {
```

Find where `maxHp` is set (something like `PLAYER_MAX_HP + upgrades.hullPlating`). Add `bonusHp(pilotLevel)`:

```typescript
const maxHp = PLAYER_MAX_HP + upgrades.hullPlating + bonusHp(pilotLevel);
```

- [ ] **Step 4: Thread pilot level through call sites**

Find ALL calls to `createPlayer(`:

```bash
cd games/sector-zero/web && grep -n "createPlayer(" app/components/engine/gameEngine.ts
```

Expected call sites (3-4 hits):
1. Inside `createGameState` — use `save.pilotLevel` and `save.allocatedSkills`
2. Inside `createPlanetGameState` — use `save.pilotLevel` and `save.allocatedSkills`  
3. Inside `playerHit` (respawn path, ~line 1195) — use `s.pilotLevel` and `s.allocatedSkills`
4. Possibly a wave-transition respawn — same as #3

Read each hit's surrounding 5 lines to confirm which save/state variable to use. Factory functions have a `save` param; the respawn path uses `s` (the current GameState).

**Simplest approach:** Store `pilotLevel` in GameState (it's already there implicitly via the save data). But GameState doesn't have it yet. Add it:

In types.ts, in `GameState`, add:

```typescript
  pilotLevel: number;
  allocatedSkills: SkillNodeId[];
```

Initialize in both state factories:

```typescript
  pilotLevel: save.pilotLevel ?? 1,
  allocatedSkills: save.allocatedSkills ?? [],
```

Then pass `state.pilotLevel` (or `s.pilotLevel`) to `createPlayer` everywhere.

- [ ] **Step 5: Apply Glass Cannon skill effect**

In `createPlayer`, after computing maxHp:

```typescript
  // Glass Cannon: +30% damage, -1 max HP
  const glassCannonActive = hasSkill(allocatedSkills, "glass-cannon");
  if (glassCannonActive) {
    maxHp = Math.max(1, maxHp - 1);
  }
```

Pass `allocatedSkills` to `createPlayer` as a 3rd parameter:

```typescript
function createPlayer(
  upgrades: ShipUpgrades,
  pilotLevel: number = 1,
  allocatedSkills: SkillNodeId[] = []
): Player {
```

- [ ] **Step 6: Apply Adrenaline Rush fire rate bonus**

In `createPlayer`, find where `fireTimer` or fire rate is initialized. The player has a `fireTimer` field set to 0 and uses `PLAYER_FIRE_RATE` as the cooldown. Apply a reduction:

```bash
cd games/sector-zero/web && grep -n "PLAYER_FIRE_RATE\|fireTimer" app/components/engine/gameEngine.ts | head -10
```

The fire rate is likely applied in the game loop's fire check (not in createPlayer). Find where `fireTimer` is compared against `PLAYER_FIRE_RATE`:

```bash
cd games/sector-zero/web && grep -n "fireTimer.*PLAYER_FIRE_RATE\|PLAYER_FIRE_RATE.*fireTimer" app/components/engine/gameEngine.ts | head -5
```

At that comparison, apply the Adrenaline modifier:

```typescript
const fireRateMod = hasSkill(s.allocatedSkills, "adrenaline") ? (1 - getSkillEffect(s.allocatedSkills, "adrenaline")) : 1;
const effectiveFireRate = Math.max(2, Math.floor(PLAYER_FIRE_RATE * fireRateMod));
// Then compare: if (player.fireTimer >= effectiveFireRate)
```

- [ ] **Step 7: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully`

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(sector-zero): apply pilot level HP bonus, glass cannon, and adrenaline in gameplay"
```

---

## Task 6: Apply skill effects to damage calculation

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/gameEngine.ts`

- [ ] **Step 1: Find the affinity damage block**

```bash
cd games/sector-zero/web && grep -n "finalDamage = bullet.damage \* AFFINITY_MULTIPLIER" app/components/engine/gameEngine.ts
```

- [ ] **Step 2: Apply Sharpshooter bonus**

After `finalDamage = bullet.damage * AFFINITY_MULTIPLIER[affinity];`, add:

```typescript
          // Sharpshooter: +20% damage on Effective hits
          if (affinity === "effective" && hasSkill(s.allocatedSkills, "sharpshooter")) {
            finalDamage *= 1 + getSkillEffect(s.allocatedSkills, "sharpshooter");
          }
```

- [ ] **Step 3: Apply Berserker bonus**

After the Sharpshooter block:

```typescript
          // Berserker: +5% damage per missing HP
          if (hasSkill(s.allocatedSkills, "berserker")) {
            const missingHp = s.player.maxHp - s.player.hp;
            finalDamage *= 1 + getSkillEffect(s.allocatedSkills, "berserker") * missingHp;
          }
```

- [ ] **Step 4: Apply Glass Cannon damage bonus**

After Berserker:

```typescript
          // Glass Cannon: +30% damage (HP penalty applied in createPlayer)
          if (hasSkill(s.allocatedSkills, "glass-cannon")) {
            finalDamage *= 1 + getSkillEffect(s.allocatedSkills, "glass-cannon");
          }
```

- [ ] **Step 5: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

- [ ] **Step 6: Commit**

```bash
git add games/sector-zero/web/app/components/engine/gameEngine.ts
git commit -m "feat(sector-zero): apply combat skill damage bonuses in collision"
```

---

## Task 7: Apply Overcharge (power-up duration) skill effect

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/gameEngine.ts`

- [ ] **Step 1: Find power-up activation**

```bash
cd games/sector-zero/web && grep -n "POWER_UP_DURATION\|activePowerUps.*push\|type.*RAPID_FIRE\|type.*SHIELD" app/components/engine/gameEngine.ts | head -15
```

Look for where power-ups are added to `activePowerUps` with a duration.

- [ ] **Step 2: Find the duration assignment**

There should be a line like:
```typescript
duration: POWER_UP_DURATION
```

or similar when a power-up is activated.

- [ ] **Step 3: Apply Overcharge modifier**

Replace the duration assignment with:

```typescript
const overchargeBonus = hasSkill(s.allocatedSkills, "overcharge")
  ? 1 + getSkillEffect(s.allocatedSkills, "overcharge")
  : 1;
// Then: duration: Math.floor(POWER_UP_DURATION * overchargeBonus)
```

Apply this ONLY to weapon-related power-ups (RAPID_FIRE, SPEED, SHIELD). Or apply to all for simplicity — spec says "weapon power-ups last longer" but doesn't exclude any type. Apply to all for MVP.

- [ ] **Step 4: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add games/sector-zero/web/app/components/engine/gameEngine.ts
git commit -m "feat(sector-zero): apply overcharge skill to power-up duration"
```

---

## Task 8: Apply credit bonus on mission complete

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/save.ts`

- [ ] **Step 1: Find calculateCreditsEarned**

```bash
cd games/sector-zero/web && grep -n "calculateCreditsEarned" app/components/engine/save.ts
```

- [ ] **Step 2: Add pilot level credit bonus**

Update the function signature to accept pilot level:

```typescript
export function calculateCreditsEarned(
  score: number,
  stars: number,
  world: number,
  pilotLevel: number = 1
): number {
  const baseCredits = Math.floor(score / 10);
  const starBonus = stars * 50;
  const worldMultiplier = 1 + (world - 1) * 0.2;
  const pilotMultiplier = 1 + creditBonus(pilotLevel);
  return Math.floor((baseCredits + starBonus) * worldMultiplier * pilotMultiplier);
}
```

Import `creditBonus` from `./pilotLevel`.

- [ ] **Step 3: Update call sites**

```bash
cd games/sector-zero/web && grep -rn "calculateCreditsEarned(" app/components/engine/ 2>&1
```

At each call site, pass the pilot level (from save data):

```typescript
calculateCreditsEarned(score, stars, world, save.pilotLevel)
```

- [ ] **Step 4: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(sector-zero): apply pilot level credit bonus to mission rewards"
```

---

## Task 9: Recalc pilot level on mission complete + level-up detection

**Files:**
- Modify: `games/sector-zero/web/app/components/Game.tsx`

- [ ] **Step 1: Find mission-complete save sites**

```bash
cd games/sector-zero/web && grep -n "updateLevelResult\|saveSave" app/components/Game.tsx | head -20
```

- [ ] **Step 2: Add import**

```typescript
import { recalcPilotLevel } from "./engine/save";
```

- [ ] **Step 3: After each `updateLevelResult` call, recalc pilot level**

Find each site where `newSave = updateLevelResult(...)` is called. AFTER it (before saveSave), add:

```typescript
const prevLevel = newSave.pilotLevel;
newSave = recalcPilotLevel(newSave);
const leveledUp = newSave.pilotLevel > prevLevel;
if (leveledUp) {
  console.log(`PILOT LEVEL UP! ${prevLevel} → ${newSave.pilotLevel}`);
  // TODO: show level-up notification UI (future polish)
}
```

Note: `recalcPilotLevel` is imported from save.ts (already written in Task 4).

- [ ] **Step 4: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add games/sector-zero/web/app/components/Game.tsx
git commit -m "feat(sector-zero): recalc pilot level on mission complete with level-up detection"
```

---

## Task 10: Show pilot level in dashboard XP bar

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/dashboard.ts`

- [ ] **Step 1: Read dashboard.ts XP section**

```bash
cd games/sector-zero/web && grep -n "XP\|xp" app/components/engine/dashboard.ts
```

- [ ] **Step 2: Add pilot level badge next to XP bar**

The dashboard currently shows an XP bar at the bottom. Add the pilot level as a small badge.

Find where the XP bar is drawn. Read ~15 lines around it to understand the layout.

Add a pilot level badge to the left of the XP bar:

```typescript
// Pilot level badge
ctx.fillStyle = "#44ccff";
ctx.font = "bold 9px monospace";
ctx.textAlign = "left";
ctx.textBaseline = "middle";
ctx.fillText(`Lv${state.pilotLevel}`, PAD_X, XP_BAR_Y + XP_BAR_H / 2);
```

This requires `pilotLevel` to be accessible. Since `drawDashboard` takes `state: GameState`, and we added `pilotLevel` to GameState in Task 5, this should work directly as `state.pilotLevel`.

- [ ] **Step 3: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add games/sector-zero/web/app/components/engine/dashboard.ts
git commit -m "feat(sector-zero): show pilot level badge on dashboard XP bar"
```

---

## Task 11: Add Pilot cockpit screen — level + skill tree UI

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/cockpit.ts`
- Modify: `games/sector-zero/web/app/components/engine/cockpitRenderer.ts`

- [ ] **Step 1: Read cockpit.ts structure**

```bash
cd games/sector-zero/web && head -100 app/components/engine/cockpit.ts
cd games/sector-zero/web && grep -n "CockpitScreen\|NAV_GRAPH\|COCKPIT_HOTSPOTS\|selectedHotspot" app/components/engine/cockpit.ts | head -20
```

- [ ] **Step 2: Add "pilot" screen to CockpitScreen**

Find the `CockpitScreen` type and add `"pilot"`:

```typescript
export type CockpitScreen = "hub" | "starmap" | "armory" | "crew" | "missions" | "codex" | "bestiary" | "pilot";
```

- [ ] **Step 3: Add pilot state fields to CockpitHubState**

```typescript
  pilotTreeSelected: number;  // selected skill node index (0-5 for combat tree)
```

Initialize to 0 in the default state.

- [ ] **Step 4: Add hotspot for PILOT**

Add a hotspot entry. Read existing hotspot positions first:

```bash
cd games/sector-zero/web && grep -A3 "id:" app/components/engine/cockpit.ts | head -40
```

Add the new hotspot as index 6. Position it below the armory (both relate to upgrades):

```typescript
{ id: "pilot", name: "PILOT", x: 190, y: 720, w: 100, h: 60, description: "Level & skills" },
```

Update `NAV_GRAPH` — add the new index 6 and update armory (1) to navigate down to it:

```typescript
const NAV_GRAPH: Record<number, [number, number, number, number]> = {
  0: [2, 1, 2, 3],    // starmap: up→crew, down→armory, left→crew, right→missions
  1: [0, 6, -1, -1],  // armory: up→starmap, down→PILOT (was -1)
  2: [4, 0, -1, 3],   // crew: up→codex, down→starmap, right→missions
  3: [5, 0, 2, -1],   // missions: up→bestiary, down→starmap, left→crew
  4: [-1, 2, -1, 5],  // codex: down→crew, right→bestiary
  5: [-1, 3, 4, -1],  // bestiary: down→missions, left→codex
  6: [1, -1, -1, -1],  // pilot: up→armory
};
```

- [ ] **Step 5: Add updatePilot input handler**

```typescript
function updatePilot(
  s: CockpitHubState,
  justPressed: Record<string, boolean>,
  save: SaveData
): { newState: CockpitHubState; action: CockpitAction } {
  const nodes = getTreeNodes("combat");

  // Navigate nodes
  if (justPressed.up && s.pilotTreeSelected > 0) {
    s.pilotTreeSelected -= 1;
    s.audioEvents.push(AudioEvent.COCKPIT_NAV);
  }
  if (justPressed.down && s.pilotTreeSelected < nodes.length - 1) {
    s.pilotTreeSelected += 1;
    s.audioEvents.push(AudioEvent.COCKPIT_NAV);
  }

  // Allocate skill point
  if (justPressed.shoot && nodes.length > 0) {
    const node = nodes[s.pilotTreeSelected];
    if (canAllocate(node.id, save.allocatedSkills, save.skillPoints)) {
      s.audioEvents.push(AudioEvent.UPGRADE_PURCHASE);
      return {
        newState: s,
        action: {
          type: "allocate-skill",
          nodeId: node.id,
        } as CockpitAction,
      };
    } else {
      s.audioEvents.push(AudioEvent.UPGRADE_DENIED);
    }
  }

  // Respec (hold left+right? Or a dedicated key — use 'bomb' / 'b' key)
  // For MVP: no respec key — can add later. Free respec from a menu.

  // Back to hub
  if (justPressed.left) {
    s.screen = "hub";
    s.transitionTimer = TRANSITION_FRAMES;
    s.audioEvents.push(AudioEvent.COCKPIT_BACK);
    return { newState: s, action: { type: "none" } };
  }

  return { newState: s, action: { type: "none" } };
}
```

Wire `updatePilot` into the main `updateCockpit` dispatch (find the switch/if-else on `s.screen`).

Add the required `CockpitAction` type for `"allocate-skill"`. Find `CockpitAction` type:

```bash
cd games/sector-zero/web && grep -n "CockpitAction\|type.*none\|type.*launch" app/components/engine/cockpit.ts | head -10
```

Add `| { type: "allocate-skill"; nodeId: SkillNodeId }` to the union.

Import at top of cockpit.ts:

```typescript
import { getTreeNodes, canAllocate } from "./skillTree";
import type { SkillNodeId } from "./types";
```

- [ ] **Step 6: Handle "allocate-skill" action in Game.tsx**

Find where cockpit actions are handled in Game.tsx:

```bash
cd games/sector-zero/web && grep -n "cockpitAction\|action.*type\|allocate\|purchase\|UPGRADE_PURCHASE" app/components/Game.tsx | head -20
```

Add a handler for the new action type:

```typescript
if (action.type === "allocate-skill") {
  const result = allocateNode(action.nodeId, save.allocatedSkills, save.skillPoints);
  if (result) {
    const newSave = {
      ...save,
      allocatedSkills: result.allocated,
      skillPoints: result.pointsRemaining,
    };
    saveSave(newSave);
    setSave(newSave);
  }
}
```

Import `allocateNode` from `./engine/skillTree`.

- [ ] **Step 7: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(sector-zero): add Pilot cockpit screen with skill allocation logic"
```

---

## Task 12: Render the Pilot screen

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/cockpitRenderer.ts`

- [ ] **Step 1: Add imports**

```typescript
import { xpForLevel, xpProgress, getMilestones, MAX_PILOT_LEVEL, bonusHp, creditBonus, materialDropBonus, skillPointsAtLevel } from "./pilotLevel";
import { COMBAT_TREE, getTreeNodes, canAllocate } from "./skillTree";
```

- [ ] **Step 2: Wire screen dispatch**

Find the screen dispatch if/else chain. Add:

```typescript
} else if (state.screen === "pilot") {
  drawPilotScreen(ctx, state, save);
```

- [ ] **Step 3: Add drawPilotScreen function**

This is the largest rendering function. Place it near the other cockpit sub-screens.

```typescript
function drawPilotScreen(
  ctx: CanvasRenderingContext2D,
  state: CockpitHubState,
  save: SaveData
): void {
  drawSubScreenFrame(ctx, "PILOT", SPRITES.ARMORY_BG);

  const level = save.pilotLevel;
  const progress = xpProgress(save.xp, level);
  const nextLevelXp = xpForLevel(level + 1);

  // ── Level display ──
  ctx.shadowBlur = 10;
  ctx.shadowColor = "#44ccff";
  ctx.fillStyle = "#44ccff";
  ctx.font = "bold 36px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(`${level}`, CANVAS_WIDTH / 2, 48);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#667788";
  ctx.font = "10px monospace";
  ctx.fillText("PILOT LEVEL", CANVAS_WIDTH / 2, 42);

  // XP progress bar
  const barX = 40;
  const barY = 92;
  const barW = CANVAS_WIDTH - 80;
  const barH = 10;

  ctx.fillStyle = "#1a1a2a";
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 3);
  ctx.fill();

  if (level < MAX_PILOT_LEVEL) {
    ctx.fillStyle = "#44ccff";
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * progress, barH, 3);
    ctx.fill();

    ctx.fillStyle = "#667788";
    ctx.font = "8px monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      `${save.xp.toLocaleString()} / ${nextLevelXp.toLocaleString()} XP`,
      CANVAS_WIDTH / 2, barY + barH + 6
    );
  } else {
    ctx.fillStyle = "#44ff88";
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 3);
    ctx.fill();

    ctx.fillStyle = "#44ff88";
    ctx.font = "bold 8px monospace";
    ctx.textAlign = "center";
    ctx.fillText("MAX LEVEL", CANVAS_WIDTH / 2, barY + barH + 6);
  }

  // ── Passive bonuses ──
  const bonusY = barY + barH + 22;
  ctx.fillStyle = "#445566";
  ctx.font = "bold 9px monospace";
  ctx.textAlign = "left";
  ctx.fillText("PASSIVE BONUSES", 20, bonusY);

  ctx.font = "9px monospace";
  ctx.fillStyle = "#aaaaaa";
  ctx.fillText(`+${bonusHp(level)} Max HP`, 20, bonusY + 14);
  ctx.fillText(`+${(creditBonus(level) * 100).toFixed(1)}% Credits`, 160, bonusY + 14);
  ctx.fillText(`+${(materialDropBonus(level) * 100).toFixed(0)}% Drops`, 310, bonusY + 14);

  // ── Skill points ──
  const spY = bonusY + 34;
  ctx.fillStyle = "#ffdd44";
  ctx.font = "bold 10px monospace";
  ctx.textAlign = "left";
  ctx.fillText(`SKILL POINTS: ${save.skillPoints}`, 20, spY);
  ctx.fillStyle = "#667788";
  ctx.font = "9px monospace";
  ctx.fillText(`(${skillPointsAtLevel(level)} total earned)`, 200, spY);

  // ── Combat Skill Tree ──
  const treeY = spY + 24;
  ctx.fillStyle = "#ff4444";
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "left";
  ctx.fillText("COMBAT", 20, treeY);

  const nodes = getTreeNodes("combat");
  const nodeStartY = treeY + 18;
  const nodeH = 52;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const y = nodeStartY + i * nodeH;
    const isSelected = state.pilotTreeSelected === i;
    const isAllocated = save.allocatedSkills.includes(node.id);
    const canAlloc = canAllocate(node.id, save.allocatedSkills, save.skillPoints);

    // Row background
    if (isSelected) {
      const pulse = 0.06 + 0.03 * Math.sin(state.animTimer * 0.06);
      ctx.fillStyle = `rgba(68, 204, 255, ${pulse})`;
      ctx.beginPath();
      ctx.roundRect(16, y, CANVAS_WIDTH - 32, nodeH - 4, 4);
      ctx.fill();
      ctx.strokeStyle = "#44ccff44";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(16, y, CANVAS_WIDTH - 32, nodeH - 4, 4);
      ctx.stroke();
    }

    // Connection line from previous node (if prerequisite)
    if (i > 0) {
      ctx.strokeStyle = isAllocated ? node.color + "88" : "#222233";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(36, y - 4);
      ctx.lineTo(36, y + 4);
      ctx.stroke();
    }

    // Icon
    ctx.fillStyle = isAllocated ? node.color : (canAlloc ? "#667788" : "#333344");
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(node.icon, 36, y + nodeH / 2 - 2);

    // Name
    ctx.fillStyle = isAllocated ? "#ffffff" : (isSelected ? "#cccccc" : "#889999");
    ctx.font = isAllocated ? "bold 11px monospace" : "11px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(node.name, 56, y + 6);

    // Description
    ctx.fillStyle = "#667788";
    ctx.font = "9px monospace";
    ctx.fillText(node.description, 56, y + 22);

    // Status badge (right side)
    ctx.textAlign = "right";
    ctx.font = "bold 9px monospace";
    if (isAllocated) {
      ctx.fillStyle = "#44ff88";
      ctx.fillText("ACTIVE", CANVAS_WIDTH - 24, y + 10);
    } else if (node.isCapstone) {
      ctx.fillStyle = "#ffdd44";
      ctx.fillText(`${node.cost} PTS`, CANVAS_WIDTH - 24, y + 10);
      if (!canAlloc && save.skillPoints >= node.cost) {
        ctx.fillStyle = "#554422";
        ctx.font = "8px monospace";
        ctx.fillText("REQUIRES ALL NODES", CANVAS_WIDTH - 24, y + 24);
      }
    } else if (canAlloc) {
      ctx.fillStyle = "#44ccff";
      ctx.fillText(`${node.cost} PT`, CANVAS_WIDTH - 24, y + 10);
    } else {
      ctx.fillStyle = "#333344";
      ctx.fillText("LOCKED", CANVAS_WIDTH - 24, y + 10);
    }
  }

  // ── Milestones (below tree) ──
  const milestonesY = nodeStartY + nodes.length * nodeH + 10;
  ctx.fillStyle = "#445566";
  ctx.font = "bold 9px monospace";
  ctx.textAlign = "left";
  ctx.fillText("MILESTONES", 20, milestonesY);

  const milestones = getMilestones(level);
  for (let i = 0; i < milestones.length; i++) {
    const m = milestones[i];
    const my = milestonesY + 14 + i * 14;
    ctx.fillStyle = m.unlocked ? "#44ff88" : "#334455";
    ctx.font = "9px monospace";
    ctx.textAlign = "left";
    const check = m.unlocked ? "\u2713" : "\u2022";
    ctx.fillText(`${check} Lv ${m.level}: ${m.label}`, 28, my);
  }

  // ── Bottom bar ──
  const barBottomY = CANVAS_HEIGHT - 50;
  ctx.fillStyle = "rgba(0, 0, 10, 0.7)";
  ctx.fillRect(0, barBottomY, CANVAS_WIDTH, 50);
  ctx.strokeStyle = "#22334488";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, barBottomY);
  ctx.lineTo(CANVAS_WIDTH, barBottomY);
  ctx.stroke();
  ctx.fillStyle = "#445566";
  ctx.font = "9px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("\u2191\u2193 SELECT   ENTER ALLOCATE   \u2190 BACK", CANVAS_WIDTH / 2, barBottomY + 25);
}
```

- [ ] **Step 4: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add games/sector-zero/web/app/components/engine/cockpitRenderer.ts
git commit -m "feat(sector-zero): render Pilot screen with level progress and skill tree"
```

---

## Task 13: Show pilot level on cockpit hub

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/cockpitRenderer.ts`

- [ ] **Step 1: Find the hub screen drawing**

```bash
cd games/sector-zero/web && grep -n "function drawCockpitHub\|PILOT LEVEL\|pilotLevel\|UEC VANGUARD" app/components/engine/cockpitRenderer.ts | head -10
```

- [ ] **Step 2: Add pilot level display on the hub**

Find where the hub screen draws the title or header (near "UEC VANGUARD — BRIDGE"). Add below it:

```typescript
// Pilot level badge
ctx.fillStyle = "#44ccff";
ctx.font = "bold 11px monospace";
ctx.textAlign = "center";
ctx.fillText(`PILOT Lv ${save.pilotLevel}`, CANVAS_WIDTH / 2, 238);
```

Adjust y-coordinate to fit below the existing title text.

- [ ] **Step 3: Verify build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add games/sector-zero/web/app/components/engine/cockpitRenderer.ts
git commit -m "feat(sector-zero): show pilot level on cockpit hub"
```

---

## Task 14: Final verification

**Files:** All

- [ ] **Step 1: Full build**

```bash
cd games/sector-zero/web && yarn build 2>&1 | tail -25
```

Expected: `✓ Compiled successfully`

- [ ] **Step 2: Console self-tests**

```bash
cd games/sector-zero/web && yarn dev
```

Open browser console — verify no `console.assert` failures from `pilotLevel.ts` or `skillTree.ts`.

- [ ] **Step 3: Regression playtest**

- [ ] Game starts, enemies have class tints (affinity system from Plan 1 still works)
- [ ] Dashboard shows pilot level badge next to XP bar
- [ ] Cockpit hub shows "PILOT Lv X"
- [ ] Navigate to PILOT screen — see level progress bar, passive bonuses, Combat skill tree, milestones
- [ ] Skill nodes show LOCKED/available/ACTIVE states correctly
- [ ] Allocate a skill point (if available) — it updates immediately, persists across screen transitions
- [ ] Complete a mission — XP awards, pilot level recalcs, skill points may be awarded
- [ ] If a Glass Cannon node is active, HP is 1 less than normal
- [ ] If Sharpshooter is active, effective hits do extra damage
- [ ] Credits earned show pilot bonus (+0.5% per level)
- [ ] Fresh save (clear localStorage) works: starts at Lv 1, 0 skill points

- [ ] **Step 4: Final commit (if polish needed)**

```bash
git status
git add -A
git commit -m "chore(sector-zero): pilot leveling final polish" || echo "Nothing to commit"
```

---

## Summary

After Task 14, the game has:

- ✅ Pilot levels 1-30 calculated from existing cumulative XP
- ✅ Exponential XP curve (early levels fast, late levels 5-8 missions)
- ✅ Passive bonuses: +1% material drops/level, +0.5% credits/level, +1 HP per 10 levels
- ✅ Combat skill tree: 5 regular nodes + capstone (7 total points)
- ✅ Skill effects applied: Sharpshooter (effective damage), Berserker (missing HP), Glass Cannon (+dmg/-HP), Overcharge (power-up duration)
- ✅ Skill allocation UI in cockpit PILOT screen
- ✅ Level-up detection on mission complete
- ✅ Pilot level badge on dashboard + cockpit hub
- ✅ Milestone markers (data-only — ship/loadout systems not yet built)
- ✅ Free respec (data supports it, UI is future polish)
- ✅ Save migration with recalc on load

**Out of scope (future plans):** Engineering tree, Piloting tree, levels 31-50, respec UI button, level-up animation/notification overlay.

**Note on material drop bonus:** The `+1% material drops/level` passive is displayed on the Pilot screen but NOT wired to gameplay in MVP. Materials are currently awarded as fixed rewards on planet completion (not random drops), so there's no drop-rate system to modify yet. The bonus will be applied when a material-drop system is introduced in Reward Economy Stage 1.

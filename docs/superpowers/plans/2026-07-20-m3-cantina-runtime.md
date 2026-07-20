# M3 Cantina Runtime Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the production-reviewed Cantina bundle as a playable, data-driven colony interior with normal commissioning/access, scheduled NPCs, portrait dialogue, deterministic rumors, and a fixed-price House Pour service while preserving existing Ashfall and Phase-1 behavior.

**Architecture:** Extend the existing `InteriorTemplate` and first-person shop/dialog seams additively. Keep hand-authored Cantina data in colony exploration modules, keep schedule projection and portrait layout generic, and keep `Game.tsx` as the sole owner of player-credit persistence. Resolve schedules once from entry hour, derive rumors from stable inputs, and leave Marketplace, Town Hall, bulletin-board quests, Atlas routing, colony tiers, and politics outside this slice.

**Tech Stack:** TypeScript, React 19, Next.js 15 static export, Canvas 2D first-person raycaster, Node `tsx --test`, existing colony reducer/scene stack, sprite manifest validation, Chrome production-export playtesting.

---

## Authority, branch, and invariants

Read before executing:

1. `CLAUDE.md`
2. `game/CLAUDE.md`
3. `docs/ROADMAP.md`
4. `docs/superpowers/specs/2026-04-20-colony-system-design.md` — Phase 3
5. `docs/superpowers/specs/2026-07-20-m3-cantina-runtime-design.md` — approved authority
6. `docs/assets/prompts/m3-hubs/README.md`
7. `docs/assets/prompts/m3-hubs/manifest.json`
8. `docs/assets/reviews/m3-hubs/cantina/provenance.md`

The isolated implementation worktree already exists at `/private/tmp/sector-zero-m3-cantina-runtime` on `feat/m3-cantina-runtime`, based on merged `main` commit `ce264f4`. The reviewed design is commit `fa559d2`. Do not develop in the primary checkout. Reconfirm these facts before implementation because branch state can drift.

Hard invariants:

- Red-green-refactor for every runtime behavior; never weaken a failing test to make it green.
- `Game.tsx` remains the only owner that applies and persists exploration-time shop requests.
- Existing Phase-1 interiors retain 6×6 geometry, Ashfall sky/wall/floor art, and no ceiling.
- Ashfall's merchant remains display-only; the colony quartermaster remains a faction-priced consumable shop.
- Service requests carry only `serviceId`; the authoritative catalog owns displayed and charged cost.
- NPC placement resolves at entry and does not tick while the player remains inside.
- No save migration: use existing `ColonyBuilding` and `SaveData.credits`; all other state is derived or transient.
- Do not register or consume Marketplace/Town Hall assets.
- Do not touch Atlas projection, operation catalog, quest processing, colony tiers, districts, or politics.
- New modules remain static-export safe: no browser globals, image construction, clocks, randomness, or network access at module scope.

## Target module layout

```text
game/app/components/colony/exploration/
  buildingTiles.ts       # generic contracts + authored Cantina geometry
  cantinaContent.ts      # role definitions and deterministic rumors
  colonyLayout.ts        # template -> FirstPersonState projection
  index.ts               # entry-hour handoff
  interiorNpcs.ts        # generic two-period schedule projection
game/app/components/engine/
  fpDialogLayout.ts      # pure portrait resolution/layout
  shopServices.ts        # service catalog, drain, feedback policy
```

### Task 1: Register only the Cantina runtime asset bundle

**Files:**

- Modify: `game/app/components/engine/sprites.ts`
- Modify: `game/tests/sprites/m3HubAssets.test.ts`
- Read only: `docs/assets/prompts/m3-hubs/manifest.json`
- Read only: `game/scripts/sprites/sheets.ts`

- [ ] **Step 1: Add the failing manifest-to-runtime test**

Import `SPRITES`, `SHEETS`, and `MAT_ALLOWLIST`. Flatten the `cantina` manifest bundle and assert each asset maps exactly:

```typescript
const expectedPath = `/${asset.path.replace(/^game\/public\//, "")}`;
const spriteRelativePath = expectedPath.replace(/^\/sprites\//, "");
assert.equal(SPRITES[asset.constant as keyof typeof SPRITES], expectedPath);
assert.equal(SHEETS.some((sheet) => sheet.path === spriteRelativePath), false,
  `${asset.constant}: not a sheet`);
assert.equal(MAT_ALLOWLIST.includes(spriteRelativePath), false,
  `${asset.constant}: not a material`);
```

Also assert every Marketplace and Town Hall constant is absent from `SPRITES`.

- [ ] **Step 2: Verify RED**

```bash
cd /private/tmp/sector-zero-m3-cantina-runtime/game
yarn sprites:test
```

Expected: missing Cantina constants fail; the existing seven sprite tests are otherwise healthy.

- [ ] **Step 3: Register the 14 manifest-exact entries**

```typescript
HUB_CANTINA_WALL: "/sprites/interiors/m3/cantina/wall.png",
HUB_CANTINA_FLOOR: "/sprites/interiors/m3/cantina/floor.png",
HUB_CANTINA_CEILING: "/sprites/interiors/m3/cantina/ceiling.png",
COLONY_WALL_CANTINA: "/sprites/walls/cantina.png",
HUB_CANTINA_PROP_BAR_COUNTER: "/sprites/interiors/m3/cantina/bar-counter.png",
HUB_CANTINA_PROP_BOTTLE_RACK: "/sprites/interiors/m3/cantina/bottle-rack.png",
HUB_CANTINA_PROP_TABLE_CLUSTER: "/sprites/interiors/m3/cantina/table-cluster.png",
HUB_CANTINA_PROP_RUMOR_TERMINAL: "/sprites/interiors/m3/cantina/rumor-terminal.png",
NPC_HUB_BARTENDER: "/sprites/boarding/npc-hub-bartender.png",
NPC_HUB_REGULAR: "/sprites/boarding/npc-hub-regular.png",
NPC_HUB_SIGNAL_CHASER: "/sprites/boarding/npc-hub-signal-chaser.png",
PORTRAIT_HUB_BARTENDER: "/sprites/portraits/hub-bartender.png",
PORTRAIT_HUB_REGULAR: "/sprites/portraits/hub-regular.png",
PORTRAIT_HUB_SIGNAL_CHASER: "/sprites/portraits/hub-signal-chaser.png",
```

Do not edit `SHEETS` or `MAT_ALLOWLIST`.

- [ ] **Step 4: Verify GREEN and commit**

```bash
yarn sprites:test
npx tsc --noEmit
git diff --check
git add game/app/components/engine/sprites.ts game/tests/sprites/m3HubAssets.test.ts
git commit -m "feat(cantina): register runtime sprite bundle"
```

### Task 2: Add the typed House Pour service foundation

**Files:**

- Create: `game/app/components/engine/shopServices.ts`
- Modify: `game/app/components/engine/types.ts`
- Modify: `game/app/components/engine/firstPersonEngine.ts`
- Modify: `game/app/components/engine/consumables.ts`
- Modify: `game/tests/engine/firstPersonEngine.test.ts`
- Regression read: `game/tests/colony/factionLedger.test.ts`

- [ ] **Step 1: Write failing service tests**

Add cases proving: a service row emits exactly `{ kind: "service", serviceId: "cantina-house-pour" }`; after the test clears that property to simulate the later Game drain, a second frame without another accepted interact leaves it undefined; the catalog row costs 5; credits change `5 -> 0` without inventory changes; every faction rank still charges 5; credits below 5 and an unknown runtime ID return `null` without mutation; existing consumable faction pricing still works. Use a cast only for the defensive unknown-ID test.

Import `createAshfallForwardCampState` and add a real-data regression: locate Lt. Reyes,
assert `canBuy !== true` and the three legacy rows remain present, open that NPC's shop state,
interact, and assert the display-only shop closes without emitting any purchase request. Keep
the existing synthetic close/reopen tests too.

- [ ] **Step 2: Verify RED**

```bash
npx tsx --test tests/engine/firstPersonEngine.test.ts
```

Expected: compile/assertion failure because the service type/catalog do not exist.

- [ ] **Step 3: Add discriminated types**

```typescript
export type FPServiceId = "cantina-house-pour";

export interface FPShopItemBase {
  id: string;
  name: string;
  description: string;
  cost: number;
}

export type FPShopItem =
  | (FPShopItemBase & {
      type: "consumable" | "material" | "upgrade";
      itemId?: string;
      serviceId?: never;
    })
  | (FPShopItemBase & {
      type: "service";
      serviceId: FPServiceId;
      itemId?: never;
    });

export type FPShopPurchaseRequest =
  | { kind: "consumable"; itemId: ConsumableId }
  | { kind: "service"; serviceId: FPServiceId };
```

Update comments that incorrectly claim `canBuy` or the request channel is quartermaster/consumable-only.

- [ ] **Step 4: Add the catalog and purchase helper**

Create `shopServices.ts`:

```typescript
export const CANTINA_SERVICE_DEFS: Record<FPServiceId, {
  name: string;
  description: string;
  cost: number;
}> = {
  "cantina-house-pour": {
    name: "House Pour",
    description: "A local drink and a place at the bar.",
    cost: 5,
  },
};

export function buildServiceShopItem(serviceId: FPServiceId): FPShopItem {
  const def = CANTINA_SERVICE_DEFS[serviceId];
  return { id: serviceId, type: "service", serviceId, ...def };
}

export function purchaseService(save: SaveData, serviceId: FPServiceId): SaveData | null {
  const def = CANTINA_SERVICE_DEFS[serviceId];
  if (!def || save.credits < def.cost) return null;
  return { ...save, credits: save.credits - def.cost };
}
```

Implement lookup so a cast unknown key returns `null`. Never read a price from the request or apply faction multipliers to services.

- [ ] **Step 5: Emit and apply service requests**

In `firstPersonEngine.ts`:

```typescript
if (item?.type === "consumable" && item.itemId) {
  fp.shopPurchaseRequest = { kind: "consumable", itemId: item.itemId as ConsumableId };
} else if (item?.type === "service") {
  fp.shopPurchaseRequest = { kind: "service", serviceId: item.serviceId };
}
```

In `applyShopPurchase`, retain the consumable branch and delegate the service branch to `purchaseService`. Legacy material/upgrade rows remain display-only.

- [ ] **Step 6: Verify and commit**

```bash
npx tsx --test tests/engine/firstPersonEngine.test.ts
npx tsx --test tests/colony/factionLedger.test.ts
npx tsc --noEmit
git diff --check
git add game/app/components/engine/types.ts game/app/components/engine/shopServices.ts game/app/components/engine/firstPersonEngine.ts game/app/components/engine/consumables.ts game/tests/engine/firstPersonEngine.test.ts
git commit -m "feat(cantina): add typed house pour service"
```

### Task 3: Add the generic interior contract and authored Cantina

**Files:**

- Create: `game/app/components/colony/exploration/cantinaContent.ts`
- Create: `game/app/components/colony/exploration/interiorNpcs.ts`
- Create: `game/tests/colony/cantinaInterior.test.ts`
- Modify: `game/app/components/colony/exploration/buildingTiles.ts`
- Modify: `game/app/components/colony/exploration/colonyLayout.ts`
- Modify: `game/app/components/colony/exploration/index.ts`
- Modify: `game/tests/colony/buildingTilesRegistry.test.ts`
- Modify: `game/tests/colony/colonyLayoutInterior.test.ts`

- [ ] **Step 1: Write failing footprint/template tests**

Assert Cantina is 4×4, south-doored, uses `COLONY_WALL_CANTINA`, and fits every Outpost slot. Assert a 12×10 template, one `D` at `(5,9)`, spawn there facing north, in-bounds props/anchors on non-wall tiles, Cantina wall/floor/ceiling with no sky, and these prop scales: bottle rack 1.0, bar counter 1.4, table cluster 1.2, rumor terminal 1.0.

```typescript
[
  "############",
  "#.B..#.....#",
  "#....#.....#",
  "#...C......#",
  "#..........#",
  "#..T....R..#",
  "#..........#",
  "#..........#",
  "#..........#",
  "#####D######",
]
```

- [ ] **Step 2: Write failing schedule/content tests**

At hours 05, 06, 17, and 18, prove bartender anchors `(3,2)/(3,1)`, regular `(4,6)/(6,4)`, and signal-chaser `(9,5)/absent` for periods 06–18/18–06. Assert boundaries, original-slot-derived stable numeric IDs before absence filtering, role labels/types/sprites/colors/portraits, portraits on every line, one catalog House Pour row, deterministic authored rumors for identical `(seed, roleId, periodIndex)`, and no save input/mutation.

- [ ] **Step 3: Verify RED**

```bash
npx tsx --test tests/colony/cantinaInterior.test.ts
```

- [ ] **Step 4: Extend template contracts and add exact data**

Add `InteriorEnvironmentArt`, `InteriorNpcContentId`, `InteriorNpcSchedulePeriod`, and `InteriorNpcSlot`, then optional `environmentArt` and `npcSlots` on `InteriorTemplate`, matching the approved spec. Add the footprint, exact rows, props, spawn, art, and two-period slots. Do not alter stub templates.

- [ ] **Step 5: Implement exhaustive content**

In `cantinaContent.ts`, export `InteriorNpcContext`, `InteriorNpcDefinition`, and:

```typescript
export const INTERIOR_NPC_DEFINITIONS:
  Record<InteriorNpcContentId, InteriorNpcDefinition> = {
    "hub-bartender": {
      roleId: "hub-bartender",
      name: "BARTENDER",
      type: "merchant",
      spriteId: SPRITES.NPC_HUB_BARTENDER,
      portraitKey: "PORTRAIT_HUB_BARTENDER",
      color: "#ffaa44",
      buildDialog: () => [{
        speaker: "BARTENDER",
        text: "House pour is five credits. Rumors come free.",
      }],
      buildShopItems: () => [buildServiceShopItem("cantina-house-pour")],
      canBuy: true,
    },
    "hub-regular": {
      roleId: "hub-regular",
      name: "REGULAR",
      type: "lore",
      spriteId: SPRITES.NPC_HUB_REGULAR,
      portraitKey: "PORTRAIT_HUB_REGULAR",
      color: "#66ccff",
      buildDialog: (context) => [{
        speaker: "REGULAR",
        text: selectCantinaRumor("hub-regular", context),
      }],
    },
    "hub-signal-chaser": {
      roleId: "hub-signal-chaser",
      name: "SIGNAL CHASER",
      type: "lore",
      spriteId: SPRITES.NPC_HUB_SIGNAL_CHASER,
      portraitKey: "PORTRAIT_HUB_SIGNAL_CHASER",
      color: "#cc88ff",
      buildDialog: (context) => [{
        speaker: "SIGNAL CHASER",
        text: selectCantinaRumor("hub-signal-chaser", context),
      }],
    },
  };
```

Define these exact flavor-only pools:

```typescript
const CANTINA_RUMORS = {
  "hub-regular": [
    "A convoy saw lights moving under the western glass.",
    "The old relay wakes just before the dust turns.",
    "Long-range static has been spelling out colony call signs.",
  ],
  "hub-signal-chaser": [
    "I caught our colony beacon echoing from below the ridge.",
    "Someone is stepping on the emergency band every sixth pulse.",
    "The rumor terminal logs a carrier wave no relay admits sending.",
  ],
} as const;
```

Select with a 32-bit FNV-1a-style hash of `${seed}:${roleId}:${periodIndex}` modulo the role's pool. Decorate every returned line with the definition's portrait key in the projection step, including the bartender line. Add no quests, faction branches, or stranger rotation.

- [ ] **Step 6: Implement generic scheduling/projection**

```typescript
export function resolveInteriorSchedule(
  schedule: InteriorNpcSlot["schedule"],
  hour: number,
): { periodIndex: 0 | 1; anchor: { x: number; y: number } | null };

export function generateInteriorNpcs(
  slots: readonly InteriorNpcSlot[],
  entryHour: number,
  seed: number,
): FPNPC[];
```

Normalize hour to `[0,24)`, honor inclusive starts and midnight wrap, map with original slot index, set `FPNPC.id = slotIndex + 1`, then filter absent anchors. Project tile centers and every required `FPNPC` field from the exhaustive record.

- [ ] **Step 7: Project art, props, and NPCs generically**

Change `generateInteriorState` to `(building, seed, entryHour)`. If template art exists, project its wall/floor/ceiling/sky; otherwise preserve Ashfall sky/interior-wall/metal-floor/no-ceiling. Fill `floorTextureMap` from the selected floor, preserve prop scales, and use `generateInteriorNpcs(template.npcSlots ?? [], entryHour, seed)`. Pass `save.gameClock.hour` from `stepColonyExploration`. Add no Cantina conditional.

- [ ] **Step 8: Lock Phase-1 regressions**

Update all direct calls with an hour. Prove the five existing stub types remain 6×6 with shared Ashfall art, no ceiling, existing prop counts/scales, and zero interior NPCs.

- [ ] **Step 9: Verify and commit**

```bash
npx tsx --test tests/colony/cantinaInterior.test.ts tests/colony/buildingTilesRegistry.test.ts tests/colony/colonyLayoutInterior.test.ts
npx tsc --noEmit
git diff --check
git add game/app/components/colony/exploration/buildingTiles.ts game/app/components/colony/exploration/cantinaContent.ts game/app/components/colony/exploration/interiorNpcs.ts game/app/components/colony/exploration/colonyLayout.ts game/app/components/colony/exploration/index.ts game/tests/colony/cantinaInterior.test.ts game/tests/colony/buildingTilesRegistry.test.ts game/tests/colony/colonyLayoutInterior.test.ts
git commit -m "feat(cantina): add authored scheduled interior"
```

### Task 4: Wire commissioning, construction, door access, and fixture

**Files:**

- Modify: `game/app/components/colony/meta/ColonyCommissionMenu.tsx`
- Modify: `game/app/components/colony/dev/seedColony.ts`
- Modify: `game/tests/colony/buildMenu.test.ts`
- Modify: `game/tests/colony/seedFixtures.test.ts`
- Modify: `game/tests/colony/integration.test.ts`
- Modify: `game/tests/colony/sceneStack.test.ts`

- [ ] **Step 1: Write failing normal-path tests**

Test a Cantina option with `{ metal: 200 }`, three cycles, and `Social hub for drinks and rumors`. Keep exported `PHASE_1_BUILD_OPTIONS` for compatibility. Add an integration test that founds a funded colony, commissions Cantina, advances three cycles (constructing after 1/2, operational after 3), enters exploration, locates the real assigned exterior door, feeds `enter_interior` through `stepColonyExploration`, sees 12×10 Cantina state, triggers the real exit callback, and verifies exterior restoration one tile south of the door.

- [ ] **Step 2: Write the failing fixture test**

Add optional `playerCredits?: number` and this fixture:

```typescript
{
  id: "cantina",
  label: "SEED CANTINA",
  buildings: [
    { type: "solar_array", operational: true },
    { type: "farm", operational: true },
    { type: "water_purifier", operational: true },
    { type: "habitat_module", operational: true },
    { type: "cantina", operational: true },
  ],
  hour: 17,
  layoutSeed: 1337,
  playerCredits: 5,
}
```

Assert exactly 5 player credits, Cantina in the first six exterior slots, operational state, and all three period-0 interior roles. This is a deterministic dev-only setup for first-success/second-failure drink proof and uses an existing save field; no migration or `DevPanel.tsx` edit.

- [ ] **Step 3: Verify RED**

```bash
npx tsx --test tests/colony/buildMenu.test.ts tests/colony/seedFixtures.test.ts tests/colony/integration.test.ts tests/colony/sceneStack.test.ts
```

- [ ] **Step 4: Implement option and fixture**

Append Cantina to the menu data. Apply `playerCredits` immutably alongside the fixture clock override. Do not add a direct-interior teleport; the generic DevPanel fixture list must enter the real exterior.

- [ ] **Step 5: Verify and commit**

```bash
npx tsx --test tests/colony/buildMenu.test.ts tests/colony/seedFixtures.test.ts tests/colony/integration.test.ts tests/colony/sceneStack.test.ts
npx tsc --noEmit
git diff --check
git add game/app/components/colony/meta/ColonyCommissionMenu.tsx game/app/components/colony/dev/seedColony.ts game/tests/colony/buildMenu.test.ts game/tests/colony/seedFixtures.test.ts game/tests/colony/integration.test.ts game/tests/colony/sceneStack.test.ts
git commit -m "feat(cantina): add colony access and dev fixture"
```

### Task 5: Add generic portrait layout and rendering

**Files:**

- Create: `game/app/components/engine/fpDialogLayout.ts`
- Create: `game/tests/engine/firstPersonRenderer.test.ts`
- Modify: `game/app/components/engine/firstPersonRenderer.ts`

- [ ] **Step 1: Write failing pure layout tests**

For dialog panel `{x:16,y:564,width:448,height:140}`, loaded portrait layout is portrait `{x:28,y:576,width:88,height:88}` and text `{x:128,y:576,width:324,height:88}`. Text-only is `{x:28,y:576,width:424,height:88}`. Test known portrait, no key, unknown key, wrong-category key, unloaded image, and prototype-like keys `toString`/`__proto__`. Accept only own `SPRITES` keys whose path starts `/sprites/portraits/`.

- [ ] **Step 2: Write failing recording-canvas tests**

Use the proxy pattern in `game/tests/engine/galaxyOperationPresentation.test.ts`. Export:

```typescript
export function drawFPDialogBox(
  ctx: CanvasRenderingContext2D,
  fp: FirstPersonState,
  frameCount: number,
  spriteLookup: typeof getSprite = getSprite,
): void;
```

Prove a loaded portrait draws once at 88×88 and moves text to x=128; absent/unknown/unloaded cases retain x=28 and no image; shop-open state performs no portrait lookup/draw and remains a 300px panel.

- [ ] **Step 3: Verify RED**

```bash
npx tsx --test tests/engine/firstPersonRenderer.test.ts
```

- [ ] **Step 4: Implement safe pure layout**

Create rectangle types and a resolver using `Object.prototype.hasOwnProperty.call(SPRITES, key)`. Reject non-portrait paths. Use 12px inset/gap and 88px portrait. The helper returns portrait/text rectangles only when lookup returns an image; otherwise the legacy text rectangle.

- [ ] **Step 5: Render without changing shops/prompts**

Rename/export the dialog seam, inject lookup, and use the helper only in the non-shop branch. Draw portrait before text and wrap to computed width. Preserve panel height, border, prompt, page indicator, pulse, and fallback. Add no Cantina conditional.

- [ ] **Step 6: Verify and commit**

```bash
npx tsx --test tests/engine/firstPersonRenderer.test.ts tests/engine/firstPersonEngine.test.ts
npx tsc --noEmit
git diff --check
git add game/app/components/engine/fpDialogLayout.ts game/app/components/engine/firstPersonRenderer.ts game/tests/engine/firstPersonRenderer.test.ts
git commit -m "feat(engine): render optional dialogue portraits"
```

### Task 6: Wire one-shot Game ownership and service feedback

**Files:**

- Modify: `game/app/components/engine/shopServices.ts`
- Modify: `game/app/components/engine/types.ts`
- Modify: `game/app/components/engine/firstPersonRenderer.ts`
- Modify: `game/app/components/Game.tsx`
- Modify: `game/tests/engine/firstPersonEngine.test.ts`
- Modify: `game/tests/engine/firstPersonRenderer.test.ts`

- [ ] **Step 1: Write failing drain/policy tests**

Specify `drainShopPurchaseRequest(fp)` and `shopPurchaseFeedback(request, applied)`. Assert read-before-clear and second-drain `undefined` for both variants. Assert: successful service => `HOUSE POUR SERVED`/success/90; rejected service or consumable => `PURCHASE UNAVAILABLE`/error/90; successful consumable => `null`. Add renderer cases for green success, red failure, and legacy red unavailable when only frames exist.

- [ ] **Step 2: Verify RED**

```bash
npx tsx --test tests/engine/firstPersonEngine.test.ts tests/engine/firstPersonRenderer.test.ts
```

- [ ] **Step 3: Add transient types/helpers**

Add `shopFlashText?: string` and `shopFlashTone?: "success" | "error"` to `FPDialogState`. Implement both pure helpers in `shopServices.ts`; feedback remains transient.

- [ ] **Step 4: Keep `Game.tsx` as the sole owner**

Use the drain helper, derive rank as today, call `applyShopPurchase`, persist only a returned save, and attach policy feedback to an active dialog. The service catalog, not `Game.tsx`, supplies price. Unknown/unaffordable requests are cleared once and never persisted.

```typescript
const request = fpBuy && drainShopPurchaseRequest(fpBuy);
if (fpBuy && request) {
  const nextSave = applyShopPurchase(saveData, request, buyRank);
  if (nextSave) {
    saveSave(nextSave);
    setSaveData(nextSave);
  }
  const feedback = shopPurchaseFeedback(request, nextSave !== null);
  if (feedback && fpBuy.dialogState) {
    fpBuy.dialogState.shopFlashText = feedback.text;
    fpBuy.dialogState.shopFlashTone = feedback.tone;
    fpBuy.dialogState.shopFlashFrames = feedback.frames;
  }
}
```

- [ ] **Step 5: Generalize rendering**

Render `shopFlashText ?? "PURCHASE UNAVAILABLE"`; green for success, current red for error/absent tone. Preserve countdown in `firstPersonEngine.ts`. Successful consumables remain message-free.

- [ ] **Step 6: Verify and commit**

```bash
npx tsx --test tests/engine/firstPersonEngine.test.ts tests/engine/firstPersonRenderer.test.ts
npx tsx --test tests/colony/factionLedger.test.ts
npx tsc --noEmit
git diff --check
git add game/app/components/engine/shopServices.ts game/app/components/engine/types.ts game/app/components/engine/firstPersonRenderer.ts game/app/components/Game.tsx game/tests/engine/firstPersonEngine.test.ts game/tests/engine/firstPersonRenderer.test.ts
git commit -m "feat(cantina): persist drinks with transient feedback"
```

### Task 7: Run the complete automated verification ladder

- [ ] **Step 1: Inspect scope**

```bash
cd /private/tmp/sector-zero-m3-cantina-runtime
git status --short
git diff --check
git diff --stat origin/main...HEAD
git diff --name-only origin/main...HEAD
rg -n "Math\.random|Date\.now|performance\.now|window\.|document\." game/app/components/colony/exploration/cantinaContent.ts game/app/components/colony/exploration/interiorNpcs.ts game/app/components/engine/shopServices.ts game/app/components/engine/fpDialogLayout.ts
```

Expected: only intended files; inspect any `rg` result in context rather than blindly deleting function-body browser work.

- [ ] **Step 2: Run every game gate**

```bash
cd /private/tmp/sector-zero-m3-cantina-runtime/game
npx tsc --noEmit
yarn colony:test
yarn engine:test
yarn sprites:test
yarn build
NEXT_PUBLIC_DEVTOOLS=1 yarn build
```

All commands must exit 0. Record actual totals; the 284/282/7 baseline is not the expected final count because this slice adds tests. Both builds must static-export.

- [ ] **Step 3: Restore only Corepack metadata if generated**

Inspect any root `package.json` diff. If and only if it is Corepack's generated edit:

```bash
cd /private/tmp/sector-zero-m3-cantina-runtime
git restore package.json
git status --short
git diff --check
```

- [ ] **Step 4: Debug failures systematically**

Use `superpowers:systematic-debugging`; retain a focused reproducer, make the smallest in-scope fix, rerun focused then affected broad gates, and commit by responsibility.

### Task 8: Production playtest at 480×854 and evidence

**Files:**

- Create: `docs/assets/reviews/m3-hubs/cantina/gameplay-480x854.png`
- Create: `docs/playtests/2026-07-20-m3-cantina.md`
- Modify prop scales/tests only if actual-size evidence requires it

- [ ] **Step 1: Serve the verified DevTools export**

```bash
cd /private/tmp/sector-zero-m3-cantina-runtime/game
npx serve out -l 3000
```

Verify port 3000 is this worktree's `game/out`, not another app. Retain the process/session ID.

- [ ] **Step 2: Open a fresh browser at exact 480×854**

Hard reload the production export. Record browser/version and DPR; keep console visible. Do not substitute a dev server or an approximate responsive screenshot.

- [ ] **Step 3: Prove normal access**

Through the UI, commission Cantina for 200 metal, advance three real mission cycles, follow Cockpit → Colonies → Colony Detail → Descend, walk to the real facade/door, enter, and exit through the south door. Do not claim Atlas-to-colony travel.

- [ ] **Step 4: Prove the deterministic fixture**

Use `SEED CANTINA`, descend, and enter the real door. At 17:00 verify facade/wall/floor/ceiling, all four unstretched props, all three period-0 NPCs, correct portraits, visual-only rumor terminal, and repeat-entry rumor identity. Buy House Pour twice: record `5 -> 0` with green `HOUSE POUR SERVED`, then `0 -> 0` with red `PURCHASE UNAVAILABLE`; confirm no item, buff, or quest.

- [ ] **Step 5: Tune only evidence-backed scale defects**

If a prop blocks the aisle, reads implausibly tiny, or clips badly, first update the scale assertion and observe RED, adjust only its template `scale`, rerun the focused test, rebuild, and repeat. Keep engine `widthFactor: 1`.

- [ ] **Step 6: Capture the screenshot**

Save `docs/assets/reviews/m3-hubs/cantina/gameplay-480x854.png`, showing environment, at least one prop, and one NPC where practical. Verify exact 480×854 pixels, or document DPR-scaled pixels with exact 480×854 CSS viewport.

- [ ] **Step 7: Write the playtest receipt**

Create `docs/playtests/2026-07-20-m3-cantina.md` with tested HEAD/branch; commands/results; browser/version, CSS viewport, pixels, DPR; screenshot path; normal path; ceiling; prop scale table; role/anchor/billboard/portrait table; exact credit transitions/feedback; repeated rumors; exit; errors separate from warnings; residual gaps or `None`. `preloadAll()` uses `Promise.allSettled`, so this browser run is the decode/draw proof.

- [ ] **Step 8: Commit evidence**

Stop the server, inspect status/diff, then:

```bash
git add docs/assets/reviews/m3-hubs/cantina/gameplay-480x854.png docs/playtests/2026-07-20-m3-cantina.md
git commit -m "test(cantina): record production gameplay playtest"
```

Commit any evidence-backed code tuning separately first, rerun Task 7, rebuild, and only then commit the receipt.

### Task 9: Independent review, push, and PR

- [ ] **Step 1: Fresh final verification**

```bash
cd /private/tmp/sector-zero-m3-cantina-runtime
git status --short
git diff --check
git log --oneline origin/main..HEAD
git diff --name-status origin/main...HEAD
cd game
npx tsc --noEmit
yarn colony:test
yarn engine:test
yarn sprites:test
yarn build
NEXT_PUBLIC_DEVTOOLS=1 yarn build
```

Require clean status and fresh passing output. Restore only a verified Corepack-generated root metadata edit if it recurs.

- [ ] **Step 2: Request independent code/spec review**

Use `superpowers:requesting-code-review`. Give the reviewer the approved spec, plan, full diff, verification results, screenshot, and receipt. Require ranked file/line findings for fallback/schedule boundaries, stable IDs/rumors, catalog/display/charge agreement, one-shot clearing, Game ownership/no migration, portrait fallback, Ashfall/quartermaster regressions, non-goal leakage, and static export. Address findings using `superpowers:receiving-code-review`, focused RED/GREEN coverage, broad gates, and dedicated commits; re-review until no blocker.

- [ ] **Step 3: Push**

```bash
cd /private/tmp/sector-zero-m3-cantina-runtime
git push -u origin feat/m3-cantina-runtime
git status --short
```

- [ ] **Step 4: Open one draft PR against `main`**

Summarize design boundary, commits, actual gate totals, normal access proof, screenshot/receipt, and explicit non-goals. Link spec and plan. Keep draft until the full main-base workflow completes.

- [ ] **Step 5: Wait for all checks**

Require Game TypeScript, Game Tests, Game Next build, Site Next build, and GitGuardian. Inspect real logs for failures and debug; never waive an unverified check.

- [ ] **Step 6: Stop before merge**

Report PR URL, head SHA, checks, evidence links, and advisories. Do not merge the Cantina PR without fresh user approval. Retain the feature worktree and keep primary `main` clean.

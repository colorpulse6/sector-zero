# Sector Zero — Colony System Phase 2: FPS Descent

**Date:** 2026-04-21
**Status:** Design approved, ready for implementation planning
**Predecessors:**
- `docs/superpowers/specs/2026-04-20-colony-system-design.md` (master spec)
- `docs/superpowers/specs/2026-04-20-colony-phase-1-meta-single-colony-design.md` (Phase 1 shipped)
**Scope:** First first-person-rendered colony. Player descends from the DOM overlay into a walkable 24×24 raycaster map generated from their `ColonyState`. Enters stub interiors for each Phase 1 building. Takes off via landing-pad menu. No NPCs, no interactions beyond walking.

---

## Goal

Deliver the first **physical** colony experience. After Phase 2 ships, a player can:

1. Open COLONIES station in the cockpit hub
2. Click "Descend to Colony" (new button)
3. Spawn at the landing pad in first-person perspective, facing north into the colony
4. Walk around a central plaza with up to 6 building footprints around it
5. Approach a building's door and enter its stub interior
6. See one thematic prop per interior (solar panel, farm crate, pump, bunks)
7. Exit interior → re-spawn outside the door
8. Walk onto the landing pad → press Z → choose TAKE OFF → return to cockpit

This is the "proof of physical presence" phase. The colony becomes real, not a spreadsheet. Every subsequent phase adds content *inside* this frame; Phase 2 establishes the frame itself.

---

## Design Philosophy (Inherited)

From the master spec:

> "The graphics may not be modern, but our systems will be flawless, the logic impenetrable, the game should flow seamlessly inside itself."

Phase 2 specifically applies this principle via:
- **Reuse before invent.** The FPS engine (`firstPersonEngine.ts`, 1575 lines, proven on Ashfall Forward Camp) renders Phase 2's colonies unchanged. Phase 2 adds a template-based layout generator that produces a `FirstPersonState` from a `ColonyState`.
- **Layered architecture honored.** The engine stays ignorant of colonies. A new orchestrator layer (`colony/exploration/`) owns all colony-specific logic. The engine consults the orchestrator via 2 hook points only.
- **Deterministic generation.** Same colony + seed → identical tile map. Different `layoutSeed` → rotated slot assignment for cross-colony variety.
- **Incremental, patient, documented.** 7 micro-phases in the plan, each independently testable. No scope creep into NPC schedules, faction systems, or hub interiors — all deferred per master spec phase ordering.

---

## Scope Contract

### In scope for Phase 2

- New `GameMode` value: `"colony-exploration"`
- New folder `game/app/components/colony/exploration/` with 7 files (see File Layout)
- Template-based 24×24 Outpost layout (central plaza, 6 slots, south-center landing pad)
- Deterministic slot assignment from `layoutSeed` + `buildingId` sort order
- Multi-tile building footprints for the 4 Phase 1 building types (Solar Array, Farm, Water Purifier, Habitat Module)
- 4 stub interior templates (one per Phase 1 building type, ~6×6 tiles, one prop, no NPCs)
- Scene stack for exterior ↔ interior transitions (max depth 2)
- Day/night tint (cosmetic, hour-driven)
- "Descend to Colony" button added to Phase 1's `ColoniesScreen`
- Landing-pad "TAKE OFF / STAY" menu
- `ColonyContext` adapter field + `colonyTransitionRequest` message field on `FirstPersonState`
- Engine audit: exactly 2 hook calls to `colonyContext` (door + landing-pad interact)
- ~15 new tests: layout determinism, slot geometry, scene stack, interior template registry, day/night tint math
- Asset prompt documents in `docs/assets/prompts/colony-phase-2/` (11 assets catalogued + placeholder-prompt structure; images themselves ship later, independent track)

### Out of scope for Phase 2 (deferred)

- NPCs in colonies (Phase 3 named hub NPCs; Phase 5a background colonists + schedules)
- Interior content beyond 1 prop (Phase 3 for hubs; Phase 5a for richer stubs)
- Biome-aware sprite selection (Phase 4+)
- Day/night gameplay effects — merchant hours, NPC schedules (Phase 5a)
- Interior-based interactions beyond walking (Phase 3)
- District layouts for Tier 3+ (Phase 6)
- POI region graph / fast-travel to points outside colony (Phase 4)
- Combat inside colonies (Phase 8)
- Faction standing display on descent (Phase 5a)
- Resource pickups during exploration (never — resources flow via missions only)
- Tier promotion visual feedback (Phase 6)
- Actual final art assets (parallel workstream — Phase 2 ships with placeholder color-tints)

---

## Section A — File Layout, Mode Dispatch, Boundaries

### New files

```
game/app/components/colony/
├── exploration/
│   ├── colonyContext.ts              # adapter type passed to FP engine
│   ├── colonyLayout.ts               # generator: ColonyState + seed → FirstPersonState
│   ├── sceneStack.ts                 # exterior ↔ interior state machine
│   ├── outpostTemplate.ts            # Tier-1 24×24 frame + 6 slots + landing pad coords
│   ├── buildingTiles.ts              # per-type footprint defs + interior template registry
│   ├── dayNightTint.ts               # hour → HSL shift for environment art
│   ├── exitMenu.ts                   # landing-pad TAKE OFF / STAY DOM overlay
│   └── index.ts                      # public API

game/tests/colony/
├── colonyLayout.test.ts              # deterministic generation
├── sceneStack.test.ts                # push/pop invariants
├── outpostTemplate.test.ts           # slot geometry: no overlaps, pad reachability
└── buildingTilesRegistry.test.ts     # Phase 1 building → footprint + interior template coverage

docs/assets/prompts/
├── README.md                         # global pipeline explainer
└── colony-phase-2/
    ├── 00-shared-style-guide.md
    ├── 01-walls.md
    ├── 02-environment.md
    ├── 03-construction.md
    └── 04-interiors.md
```

### Modified files

```
game/app/components/Game.tsx          # currentMode === "colony-exploration" branch,
                                      # descend/exit wiring, keydown routing
game/app/components/engine/
├── firstPersonEngine.ts              # add optional colonyContext + colonyTransitionRequest
│                                     # to FirstPersonState; 2 hook-call edits total
└── types.ts                          # GameMode union gains "colony-exploration"
game/app/components/colony/
├── index.ts                          # re-export enterColonyExploration / exitColonyExploration
└── meta/
    └── ColoniesScreen.tsx            # "Descend to Colony" button next to "Return to Cockpit"
game/app/components/engine/
└── sprites.ts                        # 11 new sprite path constants (follow-up PR may register
                                      # actual image files once generated)
```

### Mode dispatch

```
GameMode =
  | "shooter"
  | "ground-run"
  | "boarding"
  | "first-person"          // existing — Ashfall Camp + campaign FPS
  | "turret"
  | "colony-exploration"    // NEW
```

`Game.tsx` dispatches `"colony-exploration"` to the same `updateFirstPerson` function but with a `FirstPersonState` whose `colonyContext` field is populated. Renderer is identical. The mode value's distinctness is purely for:

1. **Mission-complete routing** — `nextLevel` success paths don't fire during exploration; defensive check can also early-return if mode is `colony-exploration`.
2. **Audio / music switching** — potentially different track inside a colony (deferred to Phase 3+).
3. **Save semantics** — exploration state is ephemeral; only the underlying `SaveData` persists, and Phase 2 emits zero reducer events from exploration.

### Boundaries

- **Orchestrator writes FirstPersonState; engine consumes.** `colonyLayout.generateExteriorState` produces the state, `updateFirstPerson` steps it frame-by-frame. All colony-specific logic runs before/after the engine tick, never inside.
- **Engine's `colonyContext` is consulted in exactly 2 places.** The shoot/interact handler calls `colonyContext?.onDoorInteract(tileX, tileY)` and `colonyContext?.onLandingPadInteract()`. Nothing else. Diff audit verifies this at Task 6 commit.
- **No reads from `SaveData` inside the engine.** The orchestrator reads SaveData to build the FirstPersonState; the engine never sees SaveData directly.

---

## Section B — Data Types & Orchestrator API

### `ColonyContext` — the adapter surface

```typescript
// colony/exploration/colonyContext.ts
export interface ColonyContext {
  colonyId: ColonyId;
  mode: "exterior" | "interior";
  interiorBuildingId: BuildingInstanceId | null;

  /** Invoked when player presses Z on a door tile. */
  onDoorInteract(tileX: number, tileY: number): DoorInteractResult;

  /** Invoked when player presses Z on a landing-pad tile. */
  onLandingPadInteract(): LandingPadResult;
}

export type DoorInteractResult =
  | { kind: "enter_interior"; buildingId: BuildingInstanceId }
  | { kind: "exit_interior" }
  | { kind: "locked"; reason: string }     // constructing, damaged, destroyed
  | { kind: "no_door" };

export type LandingPadResult =
  | { kind: "show_exit_menu" }
  | { kind: "not_on_pad" };
```

### Engine → Orchestrator message channel

Single optional field added to `FirstPersonState`:

```typescript
interface FirstPersonState {
  // ... existing fields unchanged
  colonyContext?: ColonyContext;
  colonyTransitionRequest?: DoorInteractResult | LandingPadResult;
}
```

Each frame, the orchestrator (`stepColonyExploration`):
1. Reads `colonyTransitionRequest` if set
2. Performs the transition (push/pop scene stack, swap `FirstPersonState`, fade overlay)
3. Clears `colonyTransitionRequest`
4. Hands control back to the engine

One-shot message pattern; no race conditions; pure-function composable.

### Scene stack

```typescript
// colony/exploration/sceneStack.ts
export interface SceneStack {
  colonyId: ColonyId;
  current: SceneLayer;
  parent: SceneLayer | null;
}

export interface SceneLayer {
  kind: "exterior" | "interior";
  buildingId: BuildingInstanceId | null;
  state: FirstPersonState;
  /** Tile coord on the parent exterior where this interior "lives".
   *  Used to spawn the player at the door on pop. */
  returnToTile: { x: number; y: number } | null;
}

export function pushInterior(
  stack: SceneStack,
  building: ColonyBuilding,
  seed: number,
  doorTile: { x: number; y: number }
): SceneStack;

export function popToExterior(stack: SceneStack): SceneStack;

export function isInInterior(stack: SceneStack): boolean;
```

Phase 2 never exceeds depth 2. An invariant test enforces this.

### Orchestrator public API

```typescript
// colony/exploration/index.ts
export function enterColonyExploration(
  save: SaveData,
  colonyId: ColonyId
): {
  mode: GameMode;                     // always "colony-exploration"
  firstPersonState: FirstPersonState;
  sceneStack: SceneStack;
};

export function stepColonyExploration(
  stack: SceneStack,
  save: SaveData,
  deltaMs: number
): SceneStack;
/** Called every frame. Reads colonyTransitionRequest, performs push/pop,
 *  advances dayNightTint, returns new stack. Pure function. */

export function exitColonyExploration(
  stack: SceneStack
): { returnToCockpit: true };
/** Called when landing-pad TAKE OFF confirmed. */
```

Only 3 exported functions. All layout / template / tint logic is internal to `exploration/`.

### Layout generator signatures

```typescript
// colony/exploration/colonyLayout.ts
export function generateExteriorState(
  colony: ColonyState,
  gameClock: GameClock
): FirstPersonState;

export function generateInteriorState(
  building: ColonyBuilding,
  seed: number
): FirstPersonState;
```

Both pure functions. Deterministic: same inputs → identical outputs.

### Type additions

| Type | File | Scope |
|---|---|---|
| `ColonyContext` | `colony/exploration/colonyContext.ts` | Public (via `colony/index.ts` re-export if needed) |
| `DoorInteractResult`, `LandingPadResult` | `colony/exploration/colonyContext.ts` | Public |
| `SceneStack`, `SceneLayer` | `colony/exploration/sceneStack.ts` | Internal to `exploration/` |
| `FirstPersonState.colonyContext?` | `engine/types.ts` | Engine extension |
| `FirstPersonState.colonyTransitionRequest?` | `engine/types.ts` | Engine extension |
| `GameMode = ... \| "colony-exploration"` | `engine/types.ts` | Union extension |

---

## Section C — Layout Generator Internals

### Tier-1 Outpost template

A 24×24 tile grid with perimeter walls, a 6×6 central plaza, 6 building slots, and a landing pad south-center.

```
 0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23
# # # # # # # # # # # # # # # # # # # # # # # #    0
# . . . . . . . . . . . . . . . . . . . . . . #    1
# . [SLOT 0]  . . . . . [SLOT 1]  . . . . . . #    2
# . . . . . . . . . . . . . . . . . . . . . . #    3
# . . . . . . . . . . . . . . . . . . . . . . #    4
# . . . . . . . . . . . . . . . . . . . . . . #    5
# . . . . . . . . . . . . . . . . . . . . . . #    6
# . [SLOT 2]  . . . . . . . . . . [SLOT 3]  . #    7
# . . . . . . ▓ ▓ ▓ ▓ ▓ ▓ ▓ ▓ . . . . . . . . #    8
# . . . . . . ▓ . . . . . . ▓ . . . . . . . . #    9
# . . . . . . ▓ . . . . . . ▓ . . . . . . . . #   10
# . . . . . . ▓ . . . . . . ▓ . . . . . . . . #   11
# . . . . . . ▓ . . . . . . ▓ . . . . . . . . #   12
# . . . . . . ▓ . . . . . . ▓ . . . . . . . . #   13
# . . . . . . ▓ ▓ ▓ ▓ ▓ ▓ ▓ ▓ . . . . . . . . #   14
# . [SLOT 4]  . . . . . . . . . . [SLOT 5]  . #   15
# . . . . . . . . . . . . . . . . . . . . . . #   16
# . . . . . . . . . . . . . . . . . . . . . . #   17
# . . . . . . . . . . . . . . . . . . . . . . #   18
# . . . . . . . . . . P P P P . . . . . . . . #   19
# . . . . . . . . . . P P P P . . . . . . . . #   20
# . . . . . . . . . . P P P P . . . . . . . . #   21
# . . . . . . . . . . P S P P . . . . . . . . #   22
# # # # # # # # # # # # # # # # # # # # # # # #   23
```

Legend: `#` perimeter wall, `.` open floor, `▓` plaza decorative wall (walkable), `P` landing pad floor, `S` player spawn tile.

**Plaza note:** the 6×6 central area is walkable. The surrounding `▓` tiles are a visual border — floor tiles with a plaza-edge sprite variant. Phase 3+ adds NPCs and event triggers here.

### Slot definitions

```typescript
// colony/exploration/outpostTemplate.ts
export const OUTPOST_TEMPLATE = {
  width: 24,
  height: 24,
  spawn: { x: 11, y: 22, facing: "north" as const },
  landingPad: { x: 10, y: 19, w: 4, h: 4 },
  plaza: { x: 6, y: 8, w: 8, h: 7 },
  slots: [
    { id: 0, anchorX:  2, anchorY:  2, maxFootprint: { w: 4, h: 4 } },
    { id: 1, anchorX: 18, anchorY:  2, maxFootprint: { w: 4, h: 4 } },
    { id: 2, anchorX:  2, anchorY:  7, maxFootprint: { w: 4, h: 4 } },
    { id: 3, anchorX: 18, anchorY:  7, maxFootprint: { w: 4, h: 4 } },
    { id: 4, anchorX:  2, anchorY: 15, maxFootprint: { w: 4, h: 4 } },
    { id: 5, anchorX: 18, anchorY: 15, maxFootprint: { w: 4, h: 4 } },
  ],
};
```

6 slots max. Beyond 6 operational buildings, extras exist in `ColonyState` but don't render in FPS. Phase 6's grid planner replaces this template.

### Slot-filling algorithm

```typescript
function assignSlots(colony: ColonyState): Map<BuildingInstanceId, SlotId> {
  const sorted = [...colony.buildings].sort((a, b) => a.id.localeCompare(b.id));
  const rotation = colony.layoutSeed % 6;
  const map = new Map<BuildingInstanceId, SlotId>();
  sorted.slice(0, 6).forEach((b, i) => {
    map.set(b.id, ((rotation + i) % 6) as SlotId);
  });
  return map;
}
```

Properties:
- Deterministic — same colony always looks the same
- Different `layoutSeed` → rotated slot assignment → cross-colony variety
- Commissioning a new building fills the next slot; prior buildings don't shuffle
- Buildings past slot 6 are silently skipped in Phase 2

### Building footprint registry

```typescript
// colony/exploration/buildingTiles.ts
export const BUILDING_FOOTPRINTS: Record<BuildingType, FootprintSpec> = {
  solar_array:    { w: 3, h: 3, doorSide: "south", interiorTemplateId: "solar_array_stub" },
  farm:           { w: 4, h: 3, doorSide: "south", interiorTemplateId: "farm_stub" },
  water_purifier: { w: 3, h: 3, doorSide: "south", interiorTemplateId: "purifier_stub" },
  habitat_module: { w: 4, h: 4, doorSide: "south", interiorTemplateId: "habitat_stub" },
};

interface FootprintSpec {
  w: number;
  h: number;
  doorSide: "north" | "south" | "east" | "west";
  interiorTemplateId: InteriorTemplateId;
}
```

### Construction state rendering

```typescript
function renderBuildingTiles(building: ColonyBuilding, slot: Slot): TileWrite[] {
  const footprint = BUILDING_FOOTPRINTS[building.type];

  if (building.status === "constructing") {
    return foundationOutlineTiles(slot, footprint);
    // 1-tile-thick foundation perimeter, no walls, no door.
    // Scaffolding billboard prop rises at slot center.
  }

  if (building.status === "operational") {
    return perimeterWallsAndDoor(slot, footprint);
    // Full walls enclosing footprint + door tile on doorSide.
  }

  if (building.status === "damaged" || building.status === "offline") {
    return perimeterWallsAndDoor(slot, footprint, { decal: "damaged" });
    // Same as operational + damage decal sprite (deferred asset; placeholder tint).
  }

  // destroyed
  return rubbleTiles(slot, footprint);
  // No walls; rubble prop at slot center.
}
```

A floating label billboard above each slot displays the building's name + status text (canvas-rendered over the billboard; no new asset).

### Interior templates

Each Phase 1 building gets a single ~6×6 stub interior. Same `BoardingMap` format as existing FPS engine expects.

```typescript
export const INTERIOR_TEMPLATES: Record<InteriorTemplateId, InteriorTemplate> = {
  solar_array_stub: {
    width: 6, height: 6,
    tiles: `######
            #....#
            #....#
            #.C..#
            #....#
            ##D###`,
    propSlots: [{ x: 2, y: 3, sprite: "INTERIOR_SOLAR_PANEL", scale: 1.0 }],
    spawn: { x: 2, y: 5, facing: "north" },
  },
  farm_stub: {
    width: 6, height: 6,
    tiles: `######
            #....#
            #.E..#
            #....#
            #....#
            ##D###`,
    propSlots: [{ x: 2, y: 2, sprite: "INTERIOR_FARM_CRATE", scale: 1.0 }],
    spawn: { x: 2, y: 5, facing: "north" },
  },
  purifier_stub: {
    width: 6, height: 6,
    tiles: `######
            #....#
            #..P.#
            #..P.#
            #....#
            ##D###`,
    propSlots: [{ x: 3, y: 2, sprite: "INTERIOR_PURIFIER_PUMP", scale: 1.2 }],
    spawn: { x: 2, y: 5, facing: "north" },
  },
  habitat_stub: {
    width: 6, height: 6,
    tiles: `######
            #B..B#
            #....#
            #....#
            #B..B#
            ##D###`,
    propSlots: [
      { x: 1, y: 1, sprite: "INTERIOR_BUNK", scale: 1.0 },
      { x: 4, y: 1, sprite: "INTERIOR_BUNK", scale: 1.0 },
      { x: 1, y: 4, sprite: "INTERIOR_BUNK", scale: 1.0 },
      { x: 4, y: 4, sprite: "INTERIOR_BUNK", scale: 1.0 },
    ],
    spawn: { x: 2, y: 5, facing: "north" },
  },
};
```

`#` wall, `.` floor, `D` exit door, `C`/`E`/`P`/`B` are prop-slot placeholder characters for readability — actual rendering uses `propSlots` list.

### Day/night tint

```typescript
// colony/exploration/dayNightTint.ts
export interface HslShift {
  hueShift: number;        // degrees, -30..+30
  saturationMul: number;   // 0.7..1.1
  lightnessMul: number;    // 0.5..1.05
}

export function tintForHour(hour: number): HslShift {
  if (hour < 5 || hour >= 22)  return { hueShift: -20, saturationMul: 0.7, lightnessMul: 0.55 };  // night
  if (hour < 7)                return { hueShift: +15, saturationMul: 0.9, lightnessMul: 0.7 };   // dawn
  if (hour < 17)               return { hueShift: 0, saturationMul: 1.0, lightnessMul: 1.0 };     // day
  if (hour < 20)               return { hueShift: +20, saturationMul: 1.05, lightnessMul: 0.85 }; // dusk
  return { hueShift: -10, saturationMul: 0.8, lightnessMul: 0.7 };                                 // evening
}
```

Applied as a render-time post-process on sky/ground/wall sprites via a new optional `environmentTint` field on `environmentArt`. Interior rendering uses a fixed neutral tint (exteriors only cycle in Phase 2).

### Generator call sequence

```
enterColonyExploration(save, colonyId):
  colony = save.colonies.find(c => c.id === colonyId)
  gameClock = save.gameClock
  firstPersonState = generateExteriorState(colony, gameClock)
  sceneStack = {
    colonyId,
    current: { kind: "exterior", state: firstPersonState, buildingId: null, returnToTile: null },
    parent: null,
  }
  return { mode: "colony-exploration", firstPersonState, sceneStack }

generateExteriorState(colony, gameClock):
  1. Load OUTPOST_TEMPLATE
  2. tileMap = blankMap(24, 24) + frame walls + plaza + landing pad
  3. slotAssignment = assignSlots(colony)
  4. For each building in colony.buildings (up to 6):
       slot = slots[slotAssignment.get(building.id)]
       writeTiles(tileMap, renderBuildingTiles(building, slot))
  5. propSlots = [scaffolding billboards on constructing slots, plaza-edge props]
  6. environmentArt = {
       skySprite: ASHFALL_SKY,
       wallSprite: ASHFALL_WALL_EXTERIOR,
       floorSprite: ASHFALL_GROUND,
       environmentTint: tintForHour(gameClock.hour),
     }
  7. colonyContext = {
       colonyId: colony.id,
       mode: "exterior",
       interiorBuildingId: null,
       onDoorInteract: (x, y) => resolveDoor(colony, x, y, slotAssignment),
       onLandingPadInteract: () => OUTPOST_TEMPLATE contains (x,y)? show_exit_menu : not_on_pad,
     }
  8. return FirstPersonState {
       map: tileMap,
       posX: 11.5, posY: 22.5,           // spawn on pad center
       dirX: 0, dirY: -1,                 // facing north
       planeX: 0.66, planeY: 0,
       ...defaults,
       environmentArt,
       colonyContext,
       propSlots,
     }
```

### Interior transition (handled by orchestrator)

```
onDoorInteract(tileX, tileY):
  building = find operational building whose door tile is at (tileX, tileY)
  if building.status !== "operational":
    return { kind: "locked", reason: "building under construction" } // or damaged/destroyed reason
  return { kind: "enter_interior", buildingId: building.id }

stepColonyExploration reads colonyTransitionRequest:
  on { kind: "enter_interior", buildingId }:
    building = colony.buildings.find(id=buildingId)
    interiorState = generateInteriorState(building, colony.layoutSeed + buildingId hash)
    sceneStack = pushInterior(sceneStack, building, seed, doorTile)
    // fade-to-black 300ms overlay (DOM, not engine)
    // engine next frame runs against interiorState
```

---

## Section D — Flow, Testing, Implementation Phases

### Canonical user flow

```
1. Player at cockpit. COLONIES highlighted. Press Z.
2. DOM overlay mounts (Phase 1 behavior). Populated view: header, resources, metrics, buildings, commission.
3. [DESCEND TO COLONY] button visible next to [RETURN TO COCKPIT].
4. Click [DESCEND TO COLONY].
5. DOM overlay unmounts.
6. Game.tsx sets currentMode = "colony-exploration".
7. enterColonyExploration(save, colonyId) runs. Returns FirstPersonState + SceneStack.
8. Canvas takes over. Player spawns at (11.5, 22.5) facing north.
9. Walking north: player sees the plaza and (up to 6) buildings around it.
10. Approach a building's door tile. HUD hint (canvas-drawn): "[Z] ENTER <BUILDING NAME>"
      - operational → prompt shows, press Z enters
      - constructing → prompt: "N cycles remaining"
      - damaged → prompt: "damaged — cannot enter"
11. Press Z on operational door:
      - Engine writes colonyTransitionRequest
      - Orchestrator swaps scene: fade-to-black 300ms, interior state active
      - Player spawns on interior exit door, facing north (into room)
12. Walk around ~6×6 interior. See the one prop. No NPCs.
13. Walk onto exit door, press Z:
      - Engine writes transition request
      - Orchestrator pops scene, restores exterior, spawns player at outer door coord facing away from building
14. Walk to landing pad. Step onto it. Press Z:
      - exitMenu DOM overlay appears: [TAKE OFF] / [STAY]
      - STAY: menu dismisses, player remains on pad
      - TAKE OFF: exitColonyExploration runs → Game.tsx calls returnToCockpit()
15. Back at cockpit hub.
```

**What doesn't happen:**
- No cycle tick on descent or exit.
- No save write during exploration (state is ephemeral).
- No NPC interactions (no NPCs exist in Phase 2).
- No resource pickups.

### Testing strategy

**Pure-logic tests (extend `yarn colony:test`):**

1. **`colonyLayout.test.ts`** (~6 tests)
   - Same colony + same clock → identical tile maps (deep-equal)
   - Different `layoutSeed` → slot assignment rotation observable
   - Constructing buildings render foundation-only (no walls)
   - Operational buildings render full walls + door tile on `doorSide`
   - Empty slots render no tiles (open ground remains)
   - Player spawn always at (11.5, 22.5) facing north

2. **`sceneStack.test.ts`** (~4 tests)
   - Fresh stack: current=exterior, parent=null
   - `pushInterior`: current becomes parent, new current set, parent non-null
   - `popToExterior`: parent restored to current, parent cleared
   - Depth invariant: stack never exceeds 2 layers

3. **`outpostTemplate.test.ts`** (~3 tests)
   - All 6 slots fit within 24×24 bounds with max footprint
   - No slot overlaps plaza region (6,8)-(13,14)
   - All slots reachable from landing pad via floor tiles (BFS walk)

4. **`buildingTilesRegistry.test.ts`** (~2 tests)
   - Every Phase 1 building type has an entry in `BUILDING_FOOTPRINTS`
   - Every referenced `interiorTemplateId` exists in `INTERIOR_TEMPLATES` with exactly one door

5. **`dayNightTint.test.ts`** (~3 tests)
   - `tintForHour(12)` is neutral (no shift)
   - `tintForHour(0)` is night (low lightness)
   - Tint is monotonic in each quadrant

**Total new tests: ~18.** Cumulative after Phase 2: **~75 tests.**

**Manual playtest (Task 7 deliverable):**
Full checklist — descend, walk, enter each building type interior, verify transition fade, exit via pad menu, confirm cycle counter unchanged, confirm no save-data mutation during exploration, confirm existing campaign missions still work.

### Implementation micro-phases (7 tasks)

1. **Task 1 — GameMode extension + FirstPersonState field plumbing**
   Add `"colony-exploration"` to GameMode union. Add optional `colonyContext?: ColonyContext` and `colonyTransitionRequest?` fields to FirstPersonState. No behavior — types only. Build green, colony tests still 57/57.

2. **Task 1.5 — Asset prompt drafts (parallel, non-blocking)**
   Create `docs/assets/prompts/colony-phase-2/` with 5 files (shared style guide + 4 class files). Each asset has a prompt block, dimensions, placeholder status. Commit separately from code. Non-blocking for Tasks 2-7 since code uses placeholder tints.

3. **Task 2 — Template + slot geometry + registry tests**
   `outpostTemplate.ts`, `buildingTiles.ts` (footprints + interior template literals), `outpostTemplate.test.ts`, `buildingTilesRegistry.test.ts`. Pure types + constants. No rendering. +5 tests.

4. **Task 3 — Exterior layout generator + determinism tests**
   `colonyLayout.ts::generateExteriorState`, `colonyLayout.test.ts`. Tile-map output verified deterministic. +6 tests.

5. **Task 4 — Scene stack + transition pipe**
   `sceneStack.ts`, `sceneStack.test.ts`. `stepColonyExploration` orchestrator function. +4 tests.

6. **Task 5 — Interior templates + interior generator**
   Implementation of `generateInteriorState`, 4 interior template literals, exit-door spawn logic. +3 tests (via existing registry test).

7. **Task 6 — Engine hook points (`colonyContext` + transition-request channel)**
   Edit `firstPersonEngine.ts` at exactly 2 lines: interact-handler consults `colonyContext?.onDoorInteract` / `.onLandingPadInteract` and writes `colonyTransitionRequest`. Audit diff → should be ≤10 lines of changes in the engine. +2 tests (day/night tint math + integration smoke).

8. **Task 7 — Game.tsx wiring + Phase 1 DOM button + exit menu + playtest + completion**
   - Add "Descend to Colony" button to `ColoniesScreen`
   - Wire `enterColonyExploration` / `exitColonyExploration` dispatch in Game.tsx
   - `exitMenu.ts` DOM overlay (TAKE OFF / STAY)
   - Full manual playtest checklist
   - Tag `colony-phase-2-complete`; append completion log to plan

Each task ships in a single commit; plan includes exact acceptance criteria + verification steps.

### Success criteria

- [ ] `yarn colony:test` green — ~75 tests passing (57 prior + ~18 new)
- [ ] `yarn build` green
- [ ] `npx tsc --noEmit` green
- [ ] All 4 CI jobs + GitGuardian pass on the Phase 2 PR
- [ ] Manual playtest checklist 100%
- [ ] No regressions in existing campaign, Ashfall Camp FPS, or Phase 1 flow
- [ ] `firstPersonEngine.ts` diff ≤ 10 lines (audit verified)
- [ ] `generateExteriorState` deterministic (test verified)
- [ ] `SceneStack` depth invariant holds (test verified)
- [ ] Old saves (pre-Phase-2) load cleanly — Phase 2 adds no new `SaveData` fields
- [ ] Placeholder sprites render as color-tints without errors

### Risk callouts

| Risk | Mitigation |
|---|---|
| Engine gains colony-awareness by accident | Spec reviewer checks engine diff in Task 6; ≤10-line audit gate |
| Scene stack mis-manages state references | Test asserts depth ≤ 2; explicit `parent = null` on pop |
| Interior transition causes raycaster desync | 300ms fade-to-black DOM overlay hides swap; engine sees only the new state |
| Placeholder sprites look broken | Acceptable — renderer already falls back to color-tint on missing sprite. Asset pipeline is independent track |
| Cycle-tick fires on descent by accident | `nextLevel` is the sole cycle trigger (Phase 1); exploration never routes through it. Manual playtest verifies counter |
| Commissioning a 7th building (Tier 2+) causes overflow | Slot assignment silently skips past 6. Future Phase 6 replaces the template |
| Day/night tint affects interiors | Interiors explicitly ignore tint in Phase 2 (fixed neutral lighting) |
| GameClock.hour stale after mission | `generateExteriorState` reads fresh `gameClock` every entry; no stale data |

### Open questions (deferred, non-blocking)

- **STAY timeout on landing pad menu?** — Phase 2: no, explicit dismissal only. Playtest may reveal friction.
- **Zero operational buildings visible — what to show?** — Empty plaza + slots + pad. Maybe an HUD hint: "Commission a building to see it here." Minor polish.
- **7th+ building commissioned** — silently skipped in Phase 2. Phase 6's grid planner replaces this.
- **Save mid-exploration?** — Implicit: no. Reload lands the player in cockpit. Not a regression.
- **Audio change in colony** — deferred to Phase 3+ (music cue for ambience).

### What ships at Phase 2 completion

The full emotional arc: **Found colony → commission buildings → fly mission → see cycle tick → return to cockpit → DESCEND → walk your colony in first-person → enter a Farm you built → walk out → take off.** That's the entire colony ownership loop made physical. Every subsequent phase adds depth inside this frame.

---

## Section E — Asset Pipeline (Phase 2)

### Phase 2 new-asset catalog

**Reusing from existing Ashfall** (no new work): sky, exterior wall fallback, ground/floor (`SPRITES.EXPLORE_OUTPOST_SKY`, `..._WALL_EXTERIOR`, `..._GROUND`).

**New Phase 2 assets — 11 images total:**

| Sprite ID | Asset | Use | Dim |
|---|---|---|---|
| `COLONY_WALL_SOLAR` | Solar Array exterior wall | Walls around Solar Array footprint | 64×64 tile |
| `COLONY_WALL_FARM` | Farm exterior wall | Farm footprint | 64×64 tile |
| `COLONY_WALL_PURIFIER` | Water Purifier exterior wall | Purifier footprint | 64×64 tile |
| `COLONY_WALL_HABITAT` | Habitat Module exterior wall | Habitat footprint | 64×64 tile |
| `COLONY_LANDING_PAD` | Landing pad floor tile | 4×4 pad area | 64×64 tile |
| `COLONY_FOUNDATION` | Foundation outline tile | Constructing buildings | 64×64 tile |
| `COLONY_SCAFFOLDING` | Scaffolding billboard | Vertical prop on constructing slots | 64×96 sprite |
| `INTERIOR_SOLAR_PANEL` | Control panel billboard | Solar Array interior prop | 48×48 |
| `INTERIOR_FARM_CRATE` | Equipment crate billboard | Farm interior prop | 48×48 |
| `INTERIOR_PURIFIER_PUMP` | Pump machinery billboard | Purifier interior prop | 48×64 |
| `INTERIOR_BUNK` | Bunk-bed billboard | Habitat interior prop (used 4×) | 48×48 |

All render as color-tint placeholders in the interim — FP renderer handles missing sprites gracefully.

### Folder structure

```
game/public/sprites/colony/
├── environment/
│   ├── landing-pad.png              # COLONY_LANDING_PAD
│   └── foundation.png               # COLONY_FOUNDATION
├── walls/
│   ├── solar.png                    # COLONY_WALL_SOLAR
│   ├── farm.png                     # COLONY_WALL_FARM
│   ├── purifier.png                 # COLONY_WALL_PURIFIER
│   └── habitat.png                  # COLONY_WALL_HABITAT
├── props/
│   └── scaffolding.png              # COLONY_SCAFFOLDING
└── interiors/
    ├── solar-panel.png              # INTERIOR_SOLAR_PANEL
    ├── farm-crate.png               # INTERIOR_FARM_CRATE
    ├── purifier-pump.png            # INTERIOR_PURIFIER_PUMP
    └── bunk.png                     # INTERIOR_BUNK
```

### Prompt template structure

```
docs/assets/prompts/
├── README.md                         # global pipeline explainer
└── colony-phase-2/
    ├── 00-shared-style-guide.md     # palette, perspective, resolution, negative-prompt defaults
    ├── 01-walls.md                  # 4 wall-texture prompts
    ├── 02-environment.md            # landing pad + foundation
    ├── 03-construction.md           # scaffolding billboard
    └── 04-interiors.md              # 4 interior prop prompts
```

**Each prompt file anatomy** (per asset):

```markdown
## Asset: [Sprite ID]

- **Filename:** `game/public/sprites/colony/<path>.png`
- **Dimensions:** WxH pixels
- **Perspective:** top-down tile / front-facing billboard / etc.
- **Alpha:** transparent PNG / opaque tile
- **Prompt:**
  > [GPT prompt text — copy-paste ready]
- **Negative prompt:**
  > [what to avoid: NPCs, text, antialiasing, gradients inconsistent with raycaster]
- **Iteration notes:**
  > (filled during generation — seed/attempt that worked)
```

The `00-shared-style-guide.md` file is the cross-asset consistency layer: palette tied to the site's `globals.css` tokens, retro-futuristic pixel-art-adjacent aesthetic, no antialiasing that clashes with the raycaster rendering, opaque backgrounds for tile textures / transparent for billboards.

### Manifest wiring (`engine/sprites.ts`)

```typescript
COLONY_WALL_SOLAR:       "/sector-zero/sprites/colony/walls/solar.png",
COLONY_WALL_FARM:        "/sector-zero/sprites/colony/walls/farm.png",
COLONY_WALL_PURIFIER:    "/sector-zero/sprites/colony/walls/purifier.png",
COLONY_WALL_HABITAT:     "/sector-zero/sprites/colony/walls/habitat.png",
COLONY_LANDING_PAD:      "/sector-zero/sprites/colony/environment/landing-pad.png",
COLONY_FOUNDATION:       "/sector-zero/sprites/colony/environment/foundation.png",
COLONY_SCAFFOLDING:      "/sector-zero/sprites/colony/props/scaffolding.png",
INTERIOR_SOLAR_PANEL:    "/sector-zero/sprites/colony/interiors/solar-panel.png",
INTERIOR_FARM_CRATE:     "/sector-zero/sprites/colony/interiors/farm-crate.png",
INTERIOR_PURIFIER_PUMP:  "/sector-zero/sprites/colony/interiors/purifier-pump.png",
INTERIOR_BUNK:           "/sector-zero/sprites/colony/interiors/bunk.png",
```

Existing sprite loader picks them up automatically. No engine changes.

### Workstream ordering

```
Task 1  ─ GameMode + types                     (code, non-asset)
Task 1.5 ─ Asset prompts drafted               (prompts, non-blocking)
Task 2  ─ Template + registry                  (code)
Task 3  ─ Layout generator + tests             (code)
Task 4  ─ Scene stack + orchestrator           (code)
Task 5  ─ Interior generator                   (code)
Task 6  ─ Engine hook points                   (code)
Task 7  ─ Game.tsx + DOM + playtest + tag      (code, closes Phase 2)

Parallel (independent PR, any time): asset image generation & registration
  User generates via GPT sessions using prompt files
  Images drop into game/public/sprites/colony/<class>/
  Small PR adds 11 lines to sprites.ts manifest
  No code changes needed — renderer picks them up automatically
```

### Future phases

This asset-pipeline structure repeats for every future phase:
- Phase 3: hub interiors (Marketplace, Cantina, Town Hall walls + furniture + NPC portraits) — ~20-30 assets
- Phase 4: POI / dungeon tiles (ruins, Hollow bunker, cave) — 30+ assets
- Phase 5a: named NPC portraits, background colonist sprite sheet — 15-20 assets

Each phase gets a `docs/assets/prompts/colony-phase-N/` folder with the same anatomy. Folders accumulate into a full art-direction document for the game over time.

---

## Relation to Master Spec

This Phase 2 spec implements the player-facing portion of Milestone A Phase 2 of the master colony system spec (`2026-04-20-colony-system-design.md` Section J). Specifically:

- "Stub interiors for Phase 1 buildings" — delivered via `buildingTiles.ts::INTERIOR_TEMPLATES`
- "Procgen town layout" — delivered via `colonyLayout.ts::generateExteriorState` (template + seed-rotated slot assignment; not a full procgen algorithm, but "procedural" in that it's generated from data, not hand-authored-per-colony)
- "Day/night tint" — delivered via `dayNightTint.ts`
- "Return from landing pad menu" — delivered via `exitMenu.ts`

Phase 3 (hub interiors) and later phases build on the `ColonyContext` adapter pattern, the scene stack, and the template system established here.

### Carry-overs from Phase 0/1

Tracked follow-ups not addressed by Phase 2 (stay open for Phase 3+):
- `EngineKind` casing mismatch with `GameState.currentMode` — Phase 4 POI dispatcher
- `RegionNode["type"]` missing `"mine"` and `"siege_defense"` — Phase 4
- `CollapseState` field on `ColonyState` — Phase 5b/8
- `BuildingType` tightening from `string` to union — Phase 2 adds 4 concrete types to footprint registry; union tightening still Phase 3+ scope
- Phase 1 StrictMode-unfriendly `saveSave` pattern — Phase 2 introduces no new `setSaveData` call sites; existing pattern stays as-is
- `tsconfig.tsbuildinfo` untracking — housekeeping
- Final-boss ENDING cycle-tick — Phase 10

None of these block Phase 2.

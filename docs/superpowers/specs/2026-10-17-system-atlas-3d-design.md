# System Atlas — 3D star-system map (Babylon.js)

**Date:** 2026-10-17
**Status:** APPROVED IN CONVERSATION (engine and vision chosen by the user; staged scope chosen by Claude)
**Builds on:** `2026-09-06-region-map-presentation-design.md` (region chart), `2026-07-16-continuous-galaxy-atlas-design.md` (atlas model), `docs/research/2026-09-06-graphics-engine-and-asset-pipeline.md` (Babylon.js recommended engine).

## 1. Problem and vision

The region chart now shows one planet's surface. The user's colony ambitions are much larger:
many systems, many planets. The user's words: *"rotating the current system and then on the
edges are other systems it zooms to. seed the game with some planets and systems to test it."*

This spec adds the game's first WebGL surface: a rotating 3D view of the current star
system, with neighbouring systems visible at the edges, a view transition to any of them,
and a hand-off into the existing region chart for planets that have a colony.

## 2. Decisions of record

1. **Engine: Babylon.js** (`@babylonjs/core` 9.x, ES modules, tree-shaken, loaded lazily with
   a dynamic import inside an effect). Matches the research doc so later 3D work (first-person,
   colonies) reuses one engine. Nothing Babylon-related may execute during server rendering or
   Node unit tests.
2. **Presentation only in Stage A.** No save schema changes. No travel commitments, cycle
   costs or world mutation. Selecting a neighbouring system is a *view* change ("VIEW SYSTEM"),
   never a journey. Travel stays in the Galaxy Atlas and region flows.
3. **Seeded system catalogue.** A pure, deterministic catalogue assigns the ten existing
   catalogue planets to five star systems. It lives beside the galaxy engine code and reads
   only the planet catalogue and a seed constant. Later stages may derive systems from atlas
   cells; the catalogue is the test seed the user asked for.
4. **DOM landmarks over the canvas.** Planets and neighbouring systems are focusable DOM
   `option` elements positioned by projecting their 3D positions to the screen every frame.
   Keyboard, screen readers, focus trapping and the browser-test style used by the region
   chart keep working. The canvas is decorative and `aria-hidden`.
5. **Graceful fallback.** A pure 2D plan layout (0–100 % coordinates) positions the landmarks
   before Babylon is ready, when WebGL is unavailable, when the module fails to load, and in
   server rendering. The screen is fully usable without WebGL; it is simply flat.
6. **Fog language is consistent with the region chart.** A system with `knowledge: "signal"`
   renders as `UNKNOWN SYSTEM` with a generic marker and no planet names, star class or
   planet count anywhere in the markup.
7. **Motion respects `prefers-reduced-motion`.** Auto-rotation and orbital drift stop under
   reduce; camera glides become instant cuts.

## 3. Player experience

From the cockpit Colonies screen (and a DevPanel shortcut), **SYSTEM MAP** opens a full-screen
dialog "System map":

- A dark holographic field: a lit star at the centre, faint orbit rings, planets at their
  orbital positions, a subtle ground grid disc, slow auto-rotation. Dragging orbits the
  camera; the wheel or pinch zooms within fixed limits.
- At the edges of the field sit the neighbouring systems as small distant stars, each with a
  label and distance tag, joined to the home star by faint lanes. Unknown systems are dim
  dashed markers labelled `UNKNOWN SYSTEM`.
- Clicking or arrowing selects a planet or a system. Selection never changes world state.
- The detail panel shows: for a planet — name, biome, system, whether a colony exists there,
  region intel tally if a region map exists, and one action **OPEN REGION CHART** (enabled
  only when a colony exists on that planet; otherwise copy explains that landing authority is
  needed). For a system — name, star class, distance, known planet count, and one action
  **VIEW SYSTEM · N UNITS** that glides the camera out and re-centres on that system.
  Unknown systems show "Signal only. Chart it from the Galaxy Atlas." and no action.
- Header: back control (**← RETURN TO COLONIES**), title `{SYSTEM NAME}`, eyebrow
  `SYSTEM ATLAS`, chips: `HOME {home system}`, `CYCLE n`, `{known} CHARTED · {unknown} SIGNALS`.
- Legend: star, planet, colony planet, unknown system, lane. Key hints as on the region chart.
- Escape or the back control returns focus to the invoking control.

## 4. Data model (pure)

`game/app/components/galaxy/system/starSystems.ts`

```ts
export const SYSTEM_ATLAS_SEED = 7331;
export type StarClass = "O" | "B" | "A" | "F" | "G" | "K" | "M";
export interface SystemPlanet {
  planetId: PlanetId;
  orbitRadius: number;   // 1.0 … 4.5 scene units
  orbitPhase: number;    // radians at cycle 0
  orbitPeriod: number;   // cycles per revolution (decorative drift only)
  radius: number;        // 0.12 … 0.32 scene units
}
export interface StarSystem {
  id: string;            // "system:ashfall-reach"
  name: string;
  starClass: StarClass;
  starColor: string;     // hex
  position: { x: number; y: number }; // sector-plane units, home at (0, 0)
  knowledge: "home" | "charted" | "signal";
  planets: SystemPlanet[];
}
export const STAR_SYSTEMS: readonly StarSystem[];
export function homeSystem(): StarSystem;
export function findSystem(id: string): StarSystem | undefined;
export function systemForPlanet(planetId: PlanetId): StarSystem;
export function neighboursOf(systemId: string): Array<{ system: StarSystem; distanceUnits: number; bearing: number }>;
export function planetScenePosition(planet: SystemPlanet, cycle: number, driftSeconds: number): { x: number; z: number };
```

Five systems (names are placeholders the user may rename):

| System | Star | Planets | Knowledge |
|---|---|---|---|
| Ashfall Reach | G, warm white | ashfall, ossuary, pyraxis | home |
| Verdant Chain | K, orange | verdania, genesis | charted |
| Glaciem Drift | A, blue-white | glaciem, abyssia | charted |
| Luminos Core | B, blue | luminos, bastion | charted |
| Prismara Veil | M, red | prismara | signal |

Orbit radius, phase, period and planet radius derive from `SYSTEM_ATLAS_SEED` with the same
hash style as `regionMap.ts`. Every `PlanetId` appears exactly once. Positions are fixed
integers in sector-plane units with the home at the origin and neighbours 180–420 units out.

`game/app/components/galaxy/system/systemLayout.ts`

```ts
export interface LandmarkPlan { id: string; kind: "planet" | "system"; x: number; y: number } // 0–100 %
export function planSystemLayout(system: StarSystem, neighbours: ReturnType<typeof neighboursOf>, cycle: number): LandmarkPlan[];
export function clampToEdgeRing(bearing: number, radiusPercent: number): { x: number; y: number };
```

`planSystemLayout` is the no-WebGL/initial layout: planets on concentric ellipses around the
centre (`x = 50 + r·cos`, `y = 50 + 0.62·r·sin`), neighbours clamped to a ring at 44 % radius
by bearing. Both functions are pure and unit-tested for bounds (4–96 %) and determinism.

## 5. Scene architecture

`game/app/components/galaxy/system/SystemScene.ts` — a plain TypeScript module, Babylon only:

```ts
export interface SceneLandmark { id: string; position: Vector3 }
export interface SystemSceneHandle {
  setSystem(system: StarSystem, neighbours: Neighbour[], cycle: number): void;
  focusLandmark(id: string | null): void;           // selection glow
  glideToSystem(systemId: string): Promise<void>;    // camera out → re-centre, resolves when settled
  onFrame(cb: (projected: Array<{ id: string; x: number; y: number; visible: boolean }>) => void): () => void;
  setReducedMotion(reduced: boolean): void;
  setSpinPaused(paused: boolean): void;              // pointer over the chart holds the idle spin
  resize(): void;
  dispose(): void;
}
export async function createSystemScene(canvas: HTMLCanvasElement): Promise<SystemSceneHandle>;
```

- Imports from `@babylonjs/core/...` sub-paths only (Engine, Scene, ArcRotateCamera,
  HemisphericLight, PointLight, MeshBuilder, StandardMaterial, GlowLayer, Color3/Color4,
  Vector3, Matrix, Viewport). No full-package import.
- `createSystemScene` throws when `canvas.getContext("webgl2") ?? getContext("webgl")` is
  null; the screen catches and stays on the 2D plan.
- Star: emissive sphere, GlowLayer intensity ~0.6. Orbits: thin tubes or line systems.
  Planets: spheres, biome-tinted `StandardMaterial` from a biome→colour table shared with the
  region chart palette (`BIOME_PALETTES[biome].ridge`). Colony planets get a thin ring.
  Neighbours: small emissive spheres at `clampedPosition(bearing) · 7.5` units with faint
  lanes to the origin. Ground: 20-unit disc with a grid texture at 8 % alpha.
- Camera: `ArcRotateCamera`, radius limits 6–16, beta limits 0.9–1.35 rad, `useAutoRotationBehavior`
  slow (0.08 rad/s) unless reduced motion. Pointer drag/wheel/pinch via Babylon's inputs; the
  canvas has `tabIndex={-1}` so it never joins the Tab order.
- Projection every render: `Vector3.Project(pos, Matrix.Identity(), scene.getTransformMatrix(),
  camera.viewport.toGlobal(w, h))`; `visible = z within [0,1] and inside the canvas`.
- Neighbour landmarks are *pinned*: their 7.5-unit dots sit past the frustum at radius 9, so the
  projected point is clamped onto an ellipse inset from the field edge (84 px / 78 px) in the
  direction it lies, mirrored when it falls behind the camera, and always `visible`. Pinned
  landmarks closer than 120 px are spread apart along the ring so labels never collide.
- The screen writes whole-pixel `left`/`top` and only when they change; a pointer resting on the
  field calls `setSpinPaused(true)` so landmarks stop sliding while the player aims.
- `glideToSystem`: animate radius to 16 and target to the neighbour's scene position over
  600 ms, call `setSystem`, animate back to radius 9. Instant under reduced motion.
- Device pixel ratio capped at 2. Engine resized on `ResizeObserver` of the field.

## 6. Screen

`game/app/components/galaxy/system/SystemAtlasScreen.tsx` (React, scoped CSS
`SystemAtlasScreen.css` imported from `game/app/layout.tsx` like the region chart).

Props:

```ts
export interface SystemAtlasScreenProps {
  save: SaveData;
  focusActive?: boolean;
  onClose: () => void;
  onRestoreFocus?: () => void;
  onOpenRegion?: (colonyId: string) => void;
  initialSystemId?: string;
  initialSelectedId?: string;
}
```

Behaviour:

- State: `systemId` (default home), `selectedId` (default the first planet of the system),
  `sceneReady`, `gliding`.
- Landmarks render as `role="option"` divs inside `role="listbox"` (`data-system-node-list`),
  positioned by `planSystemLayout` until the first projected frame arrives, then by projected
  pixels written to refs (not React state). `aria-label` is `${label}, planet` or
  `${label}, system`; unknown systems use `UNKNOWN SYSTEM`.
- Up/Down move selection in listbox order; Left/Right move spatially using
  `moveRegionSelectionSpatial` on the current (plan or projected) coordinates. Enter/Z focus
  the action button. Escape closes via `useModalFocus`.
- Detail panel (`data-system-detail-panel`) and single action button (`data-system-action`),
  disabled when its callback is missing. Unavailable copy in player language.
- The 2D plan also renders an SVG of orbit ellipses and lanes under the landmarks when the
  scene is not ready so the fallback still reads as a map.
- Colony lookup: `save.colonies.find(c => c.planetId === planetId)`. Region intel tally from
  `save.planets.find(p => p.id === planetId)?.regionMap.nodes`.

## 7. Integration

- `Game.tsx`: new `systemAtlasOpen` state. ColoniesScreen gains `onSystemMap` → opens it with
  `source: "cockpit"`. From the system screen, `onOpenRegion(colonyId)` sets
  `regionMapSurface({ source: "cockpit", actionsEnabled: false, originColonyId: colonyId, experience: "legacy" })`
  on top (region z-index 1200 > system 1150) and passes `focusActive={false}` to the system
  screen while the region chart is mounted. Closing the region chart with source `cockpit`
  returns to whichever screen is beneath (unchanged behaviour).
- `ColoniesScreen.tsx`: a **SYSTEM MAP** button beside **REGION — VIEW ONLY**.
- `DevPanel.tsx`: **SYSTEM MAP** under a new `ATLAS` row → `onAction("goto-system-map")`.
- `layout.tsx`: import the new CSS.

## 8. Boundaries

No save schema, reducer, travel, cycle, founding, POI or Galaxy Atlas behaviour changes.
No new assets. No globe rendering of planet surfaces (Stage B). No keyboard camera control
(Stage B). The region chart is untouched except for nothing — it is opened, not modified.

## 9. Verification

- Unit: catalogue determinism, every planet exactly once, home contains ashfall, neighbour
  distances positive and sorted; layout bounds and determinism; SSR render of the screen
  produces a listbox with one option per planet and neighbour, `UNKNOWN SYSTEM` hides the
  signal system's name and planet count, action count is 0 or 1, no Babylon import occurs
  (the test environment has no `window`).
- TypeScript, colony/engine suites, static export.
- Browser (new `tests/browser/systemAtlas.spec.ts`): `@pointer` opens SYSTEM MAP from
  Colonies, sees one option per landmark, selects a neighbour, VIEW SYSTEM changes the title
  and listbox contents, OPEN REGION CHART on Ashfall opens the region dialog and Escape
  returns to the system map; `@keyboard` Up/Down/Left/Right keep the selected option
  focused, Enter focuses the action, Escape restores the **SYSTEM MAP** invoker; `@touch` at
  390 px has no horizontal overflow and tappable 44 px landmarks. Rows pass with or without
  WebGL in headless Chromium.
- Manual: prod build, DevPanel → SYSTEM MAP, drag to orbit, wheel to zoom, select each
  neighbour, verify reduced-motion stops rotation (OS setting), no console errors.

## 10. Later stages

- **B:** keyboard camera, planet globes with the region chart's terrain seed as a heightmap,
  camera flight to a planet before the region chart opens.
- **C:** systems derived from atlas cells and knowledge records; the Galaxy Atlas gets a
  SYSTEM VIEW entry; VIEW SYSTEM becomes a priced travel preview.
- **D:** colony and fleet markers in orbit, House borders as volumes, Fold pressure.

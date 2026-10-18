# Galaxy Atlas — 3D Sector Field

**Date:** 2026-10-17
**Status:** APPROVED DIRECTION (user chose "3D Babylon star map driven by the real galaxy run"
and "bind the system atlas as the SYSTEM level"). Ready for implementation.
**Extends:** `2026-07-16-continuous-galaxy-atlas-design.md` (G0, authoritative for data, travel,
operations, save boundary) and `2026-10-17-system-atlas-3d-design.md` (scene tech).
**Replaces:** the Canvas 2D field inside `GalaxyAtlasScreen` and its inline-styled chrome.
It does not change any pure galaxy module, route maths, travel, operations or saves.

## 1. Purpose

The Galaxy Atlas is the star map: every system the captain knows, the colonies spread across
them, the vessel, the planned route and the travel in progress. Today it is a flat grid of
dots next to a transaction dump. This slice turns the field into a Babylon.js scene fed by the
real `GalaxyRunState`, restyles the chrome in the HUD language used by the region chart and the
system atlas, and makes the SYSTEM breadcrumb zoom into the bound 3D system view.

Scale is a design input: the sector will eventually hold many systems and colonies, so the
model, culling and labelling are written for N, not for five.

## 2. Decisions of record

1. **The run is the only source of truth.** Stars, knowledge, threat, colonies, vessel, route
   and travel all come from `GalaxyRunState` through pure view-model functions. The screen
   never invents a system the run does not know about.
2. **Field = Babylon scene; everything else stays DOM.** The spec §12.2 contract holds: every
   selectable contact has a focusable DOM equivalent, coordinate entry has a form, selection
   is shared. The `<canvas aria-hidden="true">` remains; a 2D SVG plan renders until WebGL is
   ready or when it is unavailable (same pattern as the system atlas).
3. **`atlasViewport` stays authoritative for pan, zoom and selection.** The scene camera is a
   projection of `AtlasViewportState` (center → camera target, zoom → radius). Pointer and
   touch gestures on the field dispatch the same reducer actions as today; a field click
   picks the nearest contact or an integer coordinate exactly as `targetFromPointer` does.
4. **Knowledge and fog rules.** `signal` contacts show a dim dashed marker and generic label
   ("UNRESOLVED SIGNAL" or the observed label), no star class, no worlds. `charted` and
   `visited` show their star; `visited` is brighter and keeps a halo. `unknown` and
   `lost_contact` render nothing (unchanged from today's `contactViews`).
5. **Threat is drawn where it applies.** The route preview is coloured by the plan's overall
   band using the existing `bandColor` palette; each leg is its own segment. The destination
   gets a threat volume disc sized by band. Travel in progress draws completed legs solid,
   the active leg animated, remaining legs faint.
6. **Colonies are first-class marks.** A contact with a colony (bound through
   `contactSystems`) wears a colony ring and shows "N COLONIES" in its label; the sidebar
   lists colonies under their system.
7. **The vessel is always visible**: a distinct marker at `run.vessel.coordinate` (stationary:
   steady; in_transit: on the active leg; stranded: warning tone).
8. **Four breadcrumb levels, as G0 defines them.** GALAXY is a non-interactive framing shot
   (camera pulled back to the whole sector, cell grid visible, no picking). SECTOR is the
   functional field. SYSTEM mounts the bound system scene for the selected stellar contact.
   REGION remains the Ashfall hand-off.
9. **Many systems.** Extra systems come from procedural cells promoted through the existing
   `resolveCell` + `chartFact` path, never from new authored anchors (G0 §4.3 forbids that
   without a generation migration). A DevPanel fixture "DENSE SECTOR" charts a deterministic
   set of cells so the field has dozens of contacts to test with. Labels are budgeted: the
   selected, visited and colony contacts always label; the rest label only when the camera is
   close enough and no label collides.
10. **No save writes from presentation.** View, camera, hover, breadcrumb and labels never
    touch the run. Commit/launch/retreat still go through the existing callbacks.
11. **Reduced motion** disables camera glides, star twinkle and the travel-leg animation.

## 3. Player experience

- Opening the atlas lands in SECTOR: a dark sector plane with a faint 256-unit cell grid, the
  vessel glowing at Vanguard, known stars with labels, the signal as a dashed ghost. The camera
  drifts very slowly unless the pointer rests on the field.
- Click or tap a star, or pick it in the CONTACTS list: it brightens, a bracket appears, the
  selected target panel shows the route preview, and a threat-coloured route line runs from the
  vessel to it with a disc at the destination.
- COMMIT TRAVEL (unchanged callback). The route becomes travel: the vessel marker slides along
  the active leg; the panel shows cycles and supply in player language, with the transaction id
  moved into a collapsible "JOURNAL" disclosure.
- Press SYSTEM with a charted or visited stellar contact selected: the camera glides into the
  star and the bound system view takes over (the one from `SystemAtlasScreen`, fed by
  `contactSystems`). Its neighbours are the other known contacts; VIEW SYSTEM there glides
  between them. ← BACK TO SECTOR returns.
- Press GALAXY: the camera pulls back to frame the whole sector; picking is disabled; a caption
  reads "SECTOR 0,0 · G0 FRONTIER". Press SECTOR to return.
- Plot a coordinate: the form remains; a plotted blind target shows a crosshair marker and the
  blind-coordinate warning.
- 390px: the layout stacks; the field keeps 44px targets; touch drag pans, pinch zooms, the
  pan/zoom buttons remain.

## 4. Data model (pure, tested)

```ts
// galaxy/sector/sectorSpace.ts
export const SECTOR_SCENE_SIZE = 40;              // scene units across the 4096-unit sector
export function toScene(c: GalaxyCoordinate): { x: number; z: number };
export function fromScene(x: number, z: number, sector = { sectorX: 0, sectorY: 0 }): GalaxyCoordinate; // rounded + clamped
export function cellSceneSize(): number;          // 256 units → scene units

// galaxy/sector/sectorModel.ts
export interface SectorStar {
  targetId: string; contactId: string | null; factId: string;
  label: string; kind: AtlasCellFact["kind"];
  knowledge: KnowledgeState; confidence: KnowledgeConfidence;
  coordinate: GalaxyCoordinate; threat: ThreatBand;           // highest observed band for the subject
  colonies: number; vessel: boolean;
}
export interface SectorRouteLeg { from: GalaxyCoordinate; to: GalaxyCoordinate; band: ThreatBand; state: "planned" | "done" | "active" | "pending" }
export interface SectorModel {
  stars: SectorStar[];                                           // same order as contactViews
  vessel: { coordinate: GalaxyCoordinate; status: GalaxyVesselState["status"]; contactId: string | null };
  route: { legs: SectorRouteLeg[]; band: ThreatBand; destination: GalaxyCoordinate } | null;   // from a RoutePlan
  travel: { legs: SectorRouteLeg[]; nextLegIndex: number; state: TravelCommitment["state"] } | null;
  blindTarget: GalaxyCoordinate | null;
}
export function buildSectorModel(run: GalaxyRunState, selectedTarget: AtlasTarget | null, plan: RoutePlan | null): SectorModel;

// galaxy/system/contactSystems.ts
export function starSystemForContact(run: GalaxyRunState, contactId: string): StarSystem | null;
export function systemCatalogueForRun(run: GalaxyRunState): SystemCatalogue;   // all known stellar contacts as StarSystems
export function contactIdForPlanet(planetId: PlanetId): string | null;         // authored binding (ashfall → contact:ashfall …)
```

`starSystems.ts` gains a `SystemCatalogue { systems: StarSystem[]; homeId: string }` and every
lookup (`findSystem`, `homeSystem`, `neighboursOf`, `systemForPlanet`) accepts an optional
catalogue, defaulting to the seeded `STAR_SYSTEMS`. `SystemAtlasScreen` accepts
`catalogue?: SystemCatalogue`. Authored binding for the five anchors:

| contact | system name | star | worlds |
|---|---|---|---|
| contact:vanguard | Vanguard | F | bastion, luminos |
| contact:ashfall | Ashfall Reach | G | ashfall, pyraxis, ossuary |
| contact:hostile-picket | Hostile Picket | M | glaciem |
| contact:kepler | Kepler | K | verdania, genesis |
| procedural stellar contact | observed label | seeded from `stableSeed` | 1–2 of abyssia, prismara (seeded) |

System knowledge maps from contact knowledge: `visited` → `home` when the vessel is there,
else `charted`; `charted` → `charted`; `signal` → `signal`. Positions are the contact
coordinates scaled to the catalogue's sector-plane units.

## 5. Scene (`galaxy/sector/SectorScene.ts`)

Same construction rules as `SystemScene.ts`: every `@babylonjs` import is a dynamic sub-path
import inside `createSectorScene(canvas)`; throws when WebGL is unavailable.

```ts
export interface SectorSceneHandle {
  setModel(model: SectorModel): void;                       // no-op when the model key is unchanged
  setViewport(center: GalaxyCoordinate, zoom: number): void; // camera target/radius follow the reducer
  setLevel(level: "galaxy" | "sector"): Promise<void>;      // framing glide; instant under reduced motion
  focusTarget(targetId: string | null): void;
  pick(clientX: number, clientY: number): { x: number; z: number } | null; // ground-plane hit in scene units
  onFrame(cb: (projected: ProjectedLandmark[]) => void): () => void;
  setReducedMotion(reduced: boolean): void;
  setSpinPaused(paused: boolean): void;
  resize(): void;
  dispose(): void;
}
```

- Ground: a flat disc covering the sector with a 256-unit cell grid at low alpha; a brighter
  sector border.
- Stars: one `StandardMaterial` per knowledge tone; spheres sized by knowledge (signal 0.14,
  charted 0.22, visited 0.28); emissive by band tint for threat-observed subjects; thin colony
  ring; vessel marker as a small bright diamond with a soft point light.
- Route/travel: `CreateLines`/`CreateDashedLines` per leg, coloured by band, with a threat disc
  at the destination. Active travel leg pulses unless reduced motion.
- Camera: `ArcRotateCamera`, beta 0.8–1.3, radius 8–60 mapped from zoom (zoom 4 → 8,
  zoom 0.1 → 60), target from `toScene(center)`. Drag orbits only in SECTOR; wheel/pinch change
  zoom through the reducer (the scene never owns zoom).
- Projection: `Vector3.Project` of every star to CSS pixels each frame, whole-pixel writes,
  label budget applied in the screen. Visible flag = inside frustum.

## 6. Screen (`galaxy/GalaxyAtlasScreen.tsx` + `GalaxyAtlasScreen.css`)

Keep the component name, file, props and exports. Keep these DOM contracts, pinned by tests:
`role="dialog" aria-label="Galaxy Atlas"`, `← CLOSE ATLAS`, `nav aria-label="Atlas levels"`,
`role="listbox" aria-label="Atlas contacts"` with `role="option"` buttons carrying
`data-atlas-contact`, `data-target-kind`, `data-selected-target`, one `tabindex="0"`,
`<canvas aria-hidden="true">`, pan buttons `PAN LEFT/RIGHT/UP/DOWN`, `ZOOM IN/OUT`,
`PLOT COORDINATE` form with spinbuttons `SECTOR X/Y`, `LOCAL X/Y`, `PLOT`, selected target
`h2#atlas-target-heading`, `COMMIT TRAVEL`, `RESUME TRAVEL`, `ACKNOWLEDGE ARRIVAL`,
`LAUNCH OPERATION`, `LAUNCH INTERCEPTION`, `RETREAT TO ORIGIN`, `EMERGENCY RETREAT`,
`OPEN ASHFALL REGION`, `role="status"` line, `role="alert"` for route blocks and form errors,
`data-atlas-layout="responsive"`, `data-coordinate-layout="wrapping"`.

Changes:
- Field: scene canvas + SVG fallback + DOM landmark layer (`role="presentation"`, landmarks
  are `aria-hidden` because the CONTACTS listbox is the accessible equivalent) with brackets,
  labels and the label budget. Pointer: drag orbits, click picks via `pick()` →
  `fromScene` → `targetFromPointer` logic (contact within hit radius else coordinate).
- Chrome: `sz-atlas-*` classes, HUD palette, eyebrow "VANGUARD NAVIGATION", h1 "GALAXY ATLAS",
  chips `CYCLE n`, `SUPPLY n`, `{known} KNOWN · {colonies} COLONIES`.
- Panel copy in player language; the transaction id and raw route plan move into a
  `<details><summary>JOURNAL</summary>` block.
- SYSTEM level renders `<SystemAtlasScreen catalogue={systemCatalogueForRun(run)}
  initialSystemId={selectedContactId} embedded />` inside the field area with the breadcrumb
  still visible; `embedded` suppresses its own header/back button and dialog role.
- `z-index` stays 1150; `useModalFocus` unchanged.

## 7. Dev fixture

`devFixtures.ts` adds `dense-sector` ("DENSE SECTOR"): fresh run, then chart every cell whose
`resolveCell` fact is `stellar_contact` within a deterministic 12×12 cell window, observe the
`signal` ones, and found no colonies. Pure, deterministic, tested (count stable).

## 8. Verification

- Unit: `sectorSpace` round-trips and clamps; `sectorModel` (stars match `contactViews` order,
  colony counts, route legs and bands, travel leg states, vessel); `contactSystems` (authored
  table, fog mapping, procedural seeding stable); `starSystems` catalogue param keeps the old
  tests green; SSR render of `GalaxyAtlasScreen` keeps the pinned contract (existing
  `galaxyAtlasScreen.test.ts` must pass unchanged) plus: no Babylon import at module load,
  signal contact leaks no star class.
- Browser: `tests/browser/galaxySector.spec.ts` — pointer (select star via field click, route
  line appears with `data-route-band`, SYSTEM glides into the bound system and shows its
  worlds, BACK returns), keyboard (contacts roving, PAN/ZOOM keep focus, Escape restores),
  touch 390px (no overflow, 44px targets, DENSE SECTOR shows ≥ 20 contacts with ≤ budget
  labels). Existing `galaxyPersistence`, `navigationFocus`, `outcomeAuthority`,
  `openingScreen`, `planetRoutes` specs stay green.
- Manual Chrome: orbit, zoom, select, commit travel on KNOWN ROUTE, SYSTEM glide, DENSE SECTOR,
  reduced motion, console clean.

## 9. Out of scope

Macro galaxy simulation, multi-sector coordinates, founding colonies from the atlas, charting
signal systems from the system view, new authored anchors, any change to route or travel maths.

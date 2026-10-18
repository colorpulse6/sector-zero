# Galaxy Atlas — full-screen map, slim overlay panel, region access

Date: 2026-10-17. Builds on `2026-10-17-galaxy-atlas-cinematic-design.md` and
`2026-10-17-galaxy-sector-3d-design.md` (levels, reducer authority, picking, label budget and
save rules there are unchanged).

## Decision

The user found the right-hand text panel "too present". At 1440×900 the map and the panel split
the width 50/50 and the panel ran about 1120 px tall. The user chose (ask_user, 2026-10-17):

- **Panel:** full-screen map with a slim translucent overlay panel that collapses to a tab.
- **Region:** wire SYSTEM → REGION. The full region (with actions) still needs the ship parked at
  a visited Ashfall. From anywhere else the region opens view-only. The greyed REGION level says
  why it is unavailable.

## Layout (desktop, wider than 900 px)

1. **Stage.** The atlas fills the viewport with no page scroll. The 3D field covers the whole
   stage behind every HUD element.
2. **Top bar.** One translucent row over the map: CLOSE ATLAS, a smaller GALAXY ATLAS title with
   the status chips, the GALAXY / SECTOR / SYSTEM / REGION levels with a short reason note on a
   second line under them, and the panel toggle on the right. Below 1180 px the KNOWN/COLONIES
   chip hides so the bar stays one row; below about 960 px the toggle wraps to a second row.
3. **Bottom-left HUD.** Pan and zoom buttons, the centre and zoom readout, legend, key hints, the
   status line and a PLOT COORDINATE disclosure (closed by default).
4. **Overlay panel.** About 300 px wide, top-right under the top bar, translucent with a blur. It
   scrolls inside itself. Contact rows are one line (name plus state tag). The selected target is
   a compact card: contact meta line, route facts, threat line, COMMIT TRAVEL, journal, operation
   and region actions. The four threat dimensions move into a THREAT BREAKDOWN disclosure.
5. **Collapse.** The toggle hides the panel. While hidden, the toggle shows the selected target's
   name so one click brings the card back. Default is open.
6. **Map centring.** While the panel covers the field, the 3D camera shifts its target left by
   half the covered width (the first measurement applies at once; later changes ease) (`ArcRotateCamera.targetScreenOffset`, recomputed per frame from the
   camera radius and field height). Picking and landmark projection use the same view matrix, so
   they stay exact.
7. **Plan fallback (no WebGL).** The flat plan stays square and sits centred in the area the
   panel does not cover, so plan percentages and plan picking keep their meaning.
8. **SYSTEM level.** The panel's contacts and target card hide; the embedded system view fills
   the stage with its own detail column styled like the overlay panel.

Narrow screens (900 px and below) keep the stacked flow: top bar, field, HUD, then the panel as a
normal block. No overlay and no camera shift.

## Region access (pure, tested)

`atlasRegionAccess(run, contactId)` returns one of:

- `full`: the contact is Ashfall, Ashfall is visited, the vessel is stationary there and no travel
  record is open (an arrival or retreat must be acknowledged first).
- `view`: the contact is Ashfall and Ashfall is visited, but the vessel is elsewhere, moving, or
  its arrival is not yet acknowledged.
- `unavailable` with a reason: no colony star selected, or Ashfall not yet visited.

Only Ashfall has a region projection today (`openGalaxyRegion` supports `contact:ashfall` only).

- The REGION level and the panel button use it. The panel button reads OPEN ASHFALL REGION for
  `full` and VIEW ASHFALL REGION for `view`.
- The embedded SYSTEM view's OPEN REGION CHART uses it too (VIEW REGION CHART when view-only) and
  shows the reason when unavailable.
- `Game` re-derives the access itself when opening; it never trusts the caller. `view` opens the
  region with `actionsEnabled: false`, and the region explains that the ship must be parked at
  Ashfall to survey or travel.

## Unchanged

Reducer authority, landmarks and their attributes, label budget, picking contract, save safety
(view-only never writes), SSR safety, tab order (plot form before contacts), button names used by
the browser specs, one `<output>` readout.

## Verification

Unit tests for `atlasRegionAccess`; SSR screen tests for the toggle and region labels; tsc; colony
and engine suites; static build; galaxy browser specs (desktop 1280×900, mobile 480 and 390 px);
manual look at 1440×900 and 1280×720 in 3D, panel open and collapsed, SYSTEM level and region
view-only; one combined reviewer.

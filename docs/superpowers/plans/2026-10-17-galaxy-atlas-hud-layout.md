# Plan — Galaxy Atlas HUD layout and region access

Spec: `docs/superpowers/specs/2026-10-17-galaxy-atlas-hud-layout-design.md`.
Routing: direct. Layout tuning needs a tight build-and-look loop in the coordinator's browser.
One combined reviewer at the end (economy mode).

## Tasks

- [x] **T1** Region access: `galaxy/regionAccess.ts` with `atlasRegionAccess`; unit tests;
  `Game` derives full vs view-only; region view-only copy for the atlas source.
- [x] **T2** Atlas markup: top bar with levels, reason note and panel toggle; field section; HUD
  with controls, legend, keys, status and PLOT disclosure; overlay aside with one-line contacts and
  a compact target card (threat breakdown disclosure); region button labels.
- [x] **T3** CSS: desktop stage and overlay, translucent panel, collapsed state, plan fallback
  square in the free area, narrow-screen stacked flow, SYSTEM level embedding.
- [x] **T4** Scene: `setViewInset(rightPx)` on the sector scene drives `targetScreenOffset`; the
  atlas measures the panel overlap and feeds it.
- [x] **T5** SYSTEM view: `regionAccess` prop drives OPEN or VIEW REGION CHART and the reason.
- [x] **T6** Verify: tsc, unit suites, build, galaxy browser specs, Chrome or SwiftShader look at
  1440×900 and 1280×720, collapsed panel, SYSTEM, region view-only.
- [x] **T7** One combined reviewer; fix material findings; commit; memory.

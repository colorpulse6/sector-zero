# Plan — Galaxy Atlas cinematic look

Spec: `docs/superpowers/specs/2026-10-17-galaxy-atlas-cinematic-design.md`.
Routing: direct. Visual tuning needs a tight build-and-look loop in the coordinator's browser.
One combined reviewer at the end (economy mode).

## Tasks

- [x] **T1** Model: `starClassForFact` in `contactSystems.ts`; `starClass` and `elevation` on
  `SectorStar`; tests in `galaxySectorModel.test.ts` (authored class, signal null, elevation range
  and determinism).
- [x] **T2** Scene: sky dome, dust points, dust plane, faint grid and frame, nebula layers,
  class-coloured stars with glow and flare, elevation with drop lines and feet, threat haze,
  tube route arcs with flowing packets, colony beacon, vessel height, image processing; landmark
  projection from real 3D position. All new Babylon imports dynamic.
- [x] **T3** DOM/CSS: `data-scene="3d"` on the field when live; invisible rings in 3D mode;
  scanlines off in 3D mode.
- [x] **T4** Verify: tsc, unit suites, build, galaxy browser specs, Chrome look on three seeds,
  GALAXY level, reduced motion, frame rate.
- [x] **T5** One combined reviewer; fix material findings; commit; memory.

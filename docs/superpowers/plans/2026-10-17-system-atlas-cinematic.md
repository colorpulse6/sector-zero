# Plan — System Atlas cinematic look

Spec: `docs/superpowers/specs/2026-10-17-system-atlas-cinematic-design.md`.
Routing: direct. Visual tuning needs a tight build-and-look loop in the coordinator's browser.
One combined reviewer at the end (economy mode).

## Tasks

- [x] **T1** Model: `NEIGHBOUR_LIMIT` and `nearestNeighbours` in `starSystems.ts`; tests.
- [x] **T2** Art: shared atlas palette (star glow colours, sky seed, colony gold) exported from
  `sectorArt.ts`; new `systemArt.ts` with the planet surface and ecliptic dust painters; tests.
- [x] **T3** Scene: rewrite `SystemScene.ts` look (sky, dust, ecliptic, star, planets, orbits,
  colony beacon, neighbour glows and lanes, grade); `glideToSystem(next, neighbours)`.
- [x] **T4** Screen and CSS: nearest neighbours for landmarks, caption count, `data-scene`, 3D
  landmark styling.
- [x] **T5** Verify: tsc, suites, build, browser specs, SwiftShader looks, glide.
- [x] **T6** One combined reviewer; fix material findings; commit; memory.

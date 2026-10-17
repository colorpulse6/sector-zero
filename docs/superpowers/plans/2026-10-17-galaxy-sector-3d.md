# Galaxy Atlas 3D Sector Field — Implementation Plan

Spec: `docs/superpowers/specs/2026-10-17-galaxy-sector-3d-design.md`. Economy mode: one
builder and one combined reviewer; the coordinator owns pure modules, tests, integration and
browser verification.

**Goal:** Replace the Galaxy Atlas Canvas 2D field with a Babylon.js sector scene driven by the
real galaxy run, restyle the chrome, bind the system atlas as the SYSTEM level, and seed a
dense sector fixture — without changing any pure galaxy module or the pinned DOM contract.

## Tasks

- [x] **T1 (coordinator)** Pure layer: `galaxy/sector/sectorSpace.ts`, `galaxy/sector/sectorModel.ts`,
  `galaxy/system/contactSystems.ts`, `starSystems.ts` catalogue parameter, `devFixtures.ts`
  `dense-sector`. Tests in `tests/engine/galaxySectorModel.test.ts`,
  `tests/colony/contactSystems.test.ts`; existing `starSystems`, `systemLayout`,
  `galaxyDevFixtures` tests stay green.
- [x] **T2 (builder)** `galaxy/sector/SectorScene.ts`; rewrite of `GalaxyAtlasScreen.tsx` field +
  chrome per spec §5–§6 with `GalaxyAtlasScreen.css`; `SystemAtlasScreen` `catalogue` +
  `embedded` props. SSR-safe; pinned DOM contract preserved; `tests/engine/galaxyAtlasScreen.test.ts`
  must pass unchanged.
- [x] **T3 (coordinator)** `layout.tsx` CSS import; DevPanel DENSE SECTOR; SSR additions to
  `galaxyAtlasScreen.test.ts`; browser spec `tests/browser/galaxySector.spec.ts`; run tsc, engine,
  colony, build, and the galaxy browser specs against the static export.
- [x] **T4 (reviewer)** One combined review (correctness, SSR, fog, a11y contract, save safety,
  scale/culling). Coordinator fixes material findings.
- [x] **T5 (coordinator)** Manual Chrome playtest, screenshots, commit, memory, report.

Failures in browser rows need diagnosis and a new evidenced run, not retries.

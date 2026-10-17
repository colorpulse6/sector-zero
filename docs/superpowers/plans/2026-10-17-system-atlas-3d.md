# System Atlas (3D) Implementation Plan

Spec: `docs/superpowers/specs/2026-10-17-system-atlas-3d-design.md`. Economy mode: one
implementer and one combined reviewer for the whole milestone; the coordinator owns tests
and the browser verification.

**Goal:** A Babylon.js system map opened from Colonies, seeded with five systems and the ten
catalogue planets, with DOM landmarks, a 2D fallback and a hand-off into the region chart.

## Tasks

- [x] **T1 (coordinator)** Pure catalogue + layout: `galaxy/system/starSystems.ts`,
  `galaxy/system/systemLayout.ts`, tests `tests/colony/starSystems.test.ts`,
  `tests/colony/systemLayout.test.ts`. Dependency `@babylonjs/core` added.
- [x] **T2 (builder)** `galaxy/system/SystemScene.ts` (Babylon, lazy sub-path imports) and
  `galaxy/system/SystemAtlasScreen.tsx` + `SystemAtlasScreen.css` per spec §5–§6, using the
  region chart's CSS vocabulary (`sz-*` prefix, Space Mono/Orbitron variables, palette).
  SSR-safe: no `window`, `document`, or Babylon import at module scope or during render.
- [x] **T3 (coordinator)** Integration: `Game.tsx` state + handlers, `ColoniesScreen` button,
  `DevPanel` shortcut, `layout.tsx` CSS import. Unit test
  `tests/colony/systemAtlasScreen.test.ts` (SSR contract from spec §9).
- [x] **T4 (coordinator)** Browser spec `tests/browser/systemAtlas.spec.ts`; run with the
  static-export Playwright override; TypeScript; colony + engine suites; build.
- [x] **T5 (reviewer)** One combined review of T1–T4 (spec compliance, correctness,
  accessibility contract, fog leaks, SSR safety). Coordinator fixes material findings.
- [x] **T6 (coordinator)** Manual playtest in Chrome (prod build), screenshots, commit,
  update project memory, report.

Failures in browser rows need diagnosis and a new evidenced run, not retries.

# Colony Region Map Presentation Implementation Plan

Use the executing-plans workflow in this task. Scope is the local map and destinations,
as clarified by the user, not colony management or FPS graphics.

**Goal:** Replace the text-card region map with a playable spatial map while preserving
discovery, route eligibility, costs, selection and launch authority.

**Architecture:** Keep RegionMapScreen as the state/callback boundary. A small presentational
RegionMapArtwork component provides SVG contours and landmark icons. DOM options and SVG
edges use the saved region coordinates. RegionMapScreen.css is scoped and imported by
the root layout only. No Game.tsx changes are expected.

**Tech stack:** React 19, TypeScript, SVG, CSS; Node test runner and Playwright.

## Tasks

- [x] Verify isolated worktree and refresh origin/main (b9618d9); audit Atlas, legacy map
  and colony Region screens. Apply the user's local-map scope correction.
- [x] Extend `game/tests/colony/regionMapScreen.test.ts` to reject the old mismatched
  geometry, missing origin/route states, disclosed unknown landmark types, and verbose
  default details. Retain existing authority checks. Observe expected failures.
- [x] Add `game/app/components/colony/meta/RegionMapArtwork.tsx` and scoped
  `RegionMapScreen.css`; update `RegionMapScreen.tsx` and `game/app/layout.tsx`.
  Preserve the existing selection helpers and `checkRegionAction` boundary.
- [x] Run `tsx --test tests/colony/regionMap*.test.ts` and TypeScript from `game`.
  Fix failures before browser testing.
- [x] Add `game/tests/browser/regionMapPresentation.spec.ts`: actual landmark centers
  align with SVG endpoints; selection leaves saves unchanged; survey spends one cycle
  and persists; unknown details stay hidden; mobile targets do not overlap/overflow;
  Enter/Z focus the separate action without mutation; native Enter/Space and
  pointer/touch action activation launch only the selected encounter. Rows use
  the configured keyboard/pointer/touch project tags.
- [x] Visually inspect desktop and 390/480px mobile routes. Use the existing dev seed
  and canonical browser fixtures. Keep before/after screenshots outside the repository.
- [x] Run all engine/colony/sprite suites, TypeScript, relevant navigationFocus and
  galaxyPersistence browser rows with `--workers=1 --retries=0`, and both empty/base-path
  production exports. Avoid a simultaneous full browser matrix alongside other work.
- [x] Request an independent code review, address findings, record final verification
  and limitations in a dated playtest note, and commit the focused files.

Deliver as a focused pull request after committing the verification receipt.

Browser acceptance failures require diagnosis and a new evidenced run; retries and
arbitrary timeout increases do not count as acceptance.

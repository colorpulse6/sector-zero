# Browser Harness Receipt — 2026-07-19

## Candidate

- Package: H0 — browser harness and deterministic route fixtures
- Branch: `test/sync-browser-harness`
- Planning base: `6744a494eaffd156317d434fd1e8eed46e3c4c52`
- Tested code SHA: `f35fae82b36bd1813abf3e769e1c912b94004140`
- Scope: Playwright test infrastructure, route fixtures, PR checks, and this receipt only; no game runtime source changed

Playwright Chromium is locked through `@playwright/test` 1.61.1 in
`game/yarn.lock`. A new machine installs the pinned browser once from `game/`:

```bash
yarn playwright install chromium
```

CI uses `yarn playwright install --with-deps chromium` before
`yarn browser:test`.

## TDD evidence

### Missing harness red

The first raw baseline invocation could not reach script resolution because the
fresh worktree had no Yarn install state. That invocation was not accepted as
the H0 red. After the unchanged baseline dependencies were installed, the
baseline command exited 1 for the required reason:

```text
$ COREPACK_ENABLE_PROJECT_SPEC=0 yarn browser:test
Usage Error: Couldn't find a script named "browser:test".
```

Corepack briefly annotated the repository-root `package.json` while discovering
the project during the first invocation. That incidental change was reverted
before implementation; it is absent from both the code commit and final scope.

### Save installation red

With the harness configured but before `installSaveFixture` existed, the focused
fixture test ran in Chromium and failed its assertion on both the first attempt
and retry:

```text
@fixture installs a migrated save before hydration
Expected: not null
Received: null
```

The retry produced the configured screenshot and trace in the temporary
Playwright artifact directory. After `page.addInitScript` installed the migrated
save under `sector-zero-save`, the focused fixture run passed 2/2.

### Canonical fresh-save red

A follow-up contract assertion pinned `freshLegacy` to the real migrated new-save
state. It initially failed with `Expected: undefined; Received: true` for
`introSeen`, then passed after the pre-dismissed intro state moved to the
route-ready `allPlanetsLaunchable` fixture.

## Persisted route fixtures

Every fixture is built through `migrateSave` plus current registries/reducers and
is asserted equal after JSON serialization and migration.

| Fixture | Contract observed |
| --- | --- |
| `freshLegacy` | Canonical new legacy save; no pre-dismissed intro or progression |
| `allPlanetsLaunchable` | Every `PLANET_DEFS[].unlockAfterLevel` completed, 52 stars, no completed planets, energy weapon, non-default upgrades and skills |
| `keplerUnlocked` | Current Kepler registry entry unlocked and uncleared |
| `keplerCleared` | Kepler completion and its current story item persisted |
| `freshGalaxy` | Current `atlas-start` Galaxy registry fixture under Galaxy authority |
| `galaxyAtAshfall` | Current public travel reducers advance and finalize at `contact:ashfall` |
| `colonyFounded` | Current grown Colony reducer fixture enters an exterior and generates a registered building interior |

## Browser event matrix

Console evidence below comes from the focused and full browser runs on the tested
code SHA. Passing-test receipt attachments record the same commit, project,
viewport, route, input method, fixture, expected result, and observed result as
JSON in the temporary Playwright artifact directory.

| Project / viewport | Route and fixture | Input | Expected | Observed / console evidence |
| --- | --- | --- | --- | --- |
| `desktop-keyboard` / 1280x900 | Experience selector → Legacy cockpit → reload; `allPlanetsLaunchable` | Keyboard | Both choices focus; Enter activates Legacy; reload retains the non-default build | Both buttons focused in sequence, Legacy opened, and the reloaded save retained `equippedWeaponType: "energy"`; `✓ @keyboard focuses both choices, activates Legacy, and reloads the installed save` |
| `desktop-pointer` / 1280x900 | Experience selector → Legacy entry; `freshLegacy` | Pointer | A focused choice activates on click | Selector closed after clicking the focused Legacy button; `✓ @pointer clicks a focused experience choice` |
| `mobile-touch` / 480x854, `hasTouch: true`, `isMobile: true` | Experience selector → Legacy entry; `freshLegacy` | Real Playwright touchscreen | A native touchscreen event activates Legacy | `page.touchscreen.tap` at the button center closed the selector; `✓ @touch activates an experience choice with a real touchscreen event` |

## Exact-code-SHA automated gates

All commands ran from `game/` on a clean checkout of the tested code SHA.

| Gate | Result |
| --- | --- |
| `TESTED_CODE_SHA=f35fae82… yarn playwright test tests/browser/smoke.spec.ts` | 5/5 passed across all three projects |
| `TESTED_CODE_SHA=f35fae82… yarn browser:test` | 5/5 passed across all three projects |
| `npx tsc --noEmit` | Passed, exit 0 |
| `yarn engine:test` | 282/282 passed |
| `yarn colony:test` | 284/284 passed |
| `yarn sprites:test` | 4/4 passed |
| `COREPACK_ENABLE_PROJECT_SPEC=0 yarn build` | Passed; compiled, generated 6/6 static pages, exported 3/3 |
| `NODE_ENV=production NEXT_PUBLIC_BASE_PATH=/sector-zero COREPACK_ENABLE_PROJECT_SPEC=0 yarn build` | Passed; compiled, generated 6/6 static pages, exported 3/3 |
| `git diff --check` and `git status --short` | Passed; no diff errors and clean worktree |

## CI and residual boundary

`.github/workflows/pr-checks.yml` now has an independent Game browser-tests job
that installs dependencies, installs Playwright Chromium with operating-system
dependencies, and runs `yarn browser:test`. Its commands passed locally, but the
remote GitHub Actions job is not claimed as executed because this branch was not
pushed. No product bug or H0 blocker remained during the local run.

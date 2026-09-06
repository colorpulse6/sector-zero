# Browser Harness Receipt — 2026-07-19

## Candidate

- Package: H0 — browser harness and deterministic route fixtures
- Branch: `test/sync-browser-harness`
- Planning base: `6744a494eaffd156317d434fd1e8eed46e3c4c52`
- Tested code SHA: `7fbc4d1629872e60c48b3b7461262900adf027f0`
- Scope: Playwright test infrastructure, route fixtures, game-local Yarn runtime pin, PR checks, and this receipt only; no game runtime source changed

Playwright Chromium is locked through `@playwright/test` 1.61.1 in
`game/yarn.lock`. A new machine installs the pinned browser once from `game/`:

```bash
yarn playwright install chromium
```

CI uses `yarn playwright install --with-deps chromium` before
`yarn browser:test`. `game/package.json` pins Yarn 4.9.2 so raw outer Yarn
commands resolve the same runtime locally and in CI without annotating either
manifest.

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
before implementation; the final game-local runtime pin prevents it recurring.

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

### Reload persistence red

Cold quality review found that the original `page.addInitScript` rewrote the
fixture on every reload. A focused regression started from `freshGalaxy`, chose
Legacy, and then reloaded. Before the fix it failed twice for the intended reason:

```text
Expected activeExperience: "legacy"
Received activeExperience: "galaxy"
```

The initializer now uses a session-scoped installation marker. It writes the
fixture once before initial hydration and leaves application-written localStorage
untouched on reload. The same focused test then passed and observed
`activeExperience: "legacy"` after reload.

### Current-worktree server proof

Cold quality review also found an older static server from
`/private/tmp/sector-zero-g0-atlas/game` already listening on port 3000. The
original local `reuseExistingServer` setting could accept it, so all browser
results before tested code SHA `fdf980674af008bd5ac2fdf6e5010c6a69c754e9`
are invalidated.

The corrected config derives a port from the current worktree path, passes that
same port to Next and Playwright, and sets `reuseExistingServer: false`. The
exact-code-SHA debug run first received `ECONNREFUSED` on worktree port 36882,
then launched `yarn dev --hostname 127.0.0.1`, observed Next.js 15.3.1 compile
`/`, ran all five tests, terminated that server, and left the unrelated port-3000
process untouched.

### Corepack cleanliness red

Before the game-local pin, raw `yarn playwright test --list` warned that no
`packageManager` existed and modified the repository-root manifest. After adding
`packageManager: "yarn@4.9.2"` to the owned game manifest, the raw command reports
Yarn 4.9.2, lists the intended five tests, leaves both manifest checksums
unchanged, and leaves `git status --short` empty.

### Parallel artifact-isolation red

The final quality re-review found that otherwise independent worktrees still
shared the default `/tmp/.../sector-zero-playwright-results` directory. A
focused config assertion first failed on both attempts for the intended reason:

```text
Expected: "/tmp/.../sector-zero-playwright-results/2493704882"
Received: "/tmp/.../sector-zero-playwright-results"
```

The default output directory now appends the same stable current-worktree hash
used for port isolation. The focused default-path proof then passed 1/1. A
second focused run with
`PLAYWRIGHT_OUTPUT_DIR=/private/tmp/sector-zero-h0-output-override-proof`
also passed 1/1, proving the explicit override remains authoritative.

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
code SHA. Each event test also supplies its commit, project, viewport, route,
input method, fixture, expected result, and observed result as a structured JSON
`TestInfo` attachment to the active Playwright reporter.

| Project / viewport | Route and fixture | Input | Expected | Observed / console evidence |
| --- | --- | --- | --- | --- |
| `desktop-keyboard` / 1280x900 | Experience selector → Legacy entry → reload; `freshGalaxy` | Keyboard | Both choices focus; Enter activates Legacy; application-written authority survives reload | Both buttons focused in sequence, Legacy opened, and the reloaded save retained `activeExperience: "legacy"`; `✓ @keyboard focuses both choices, activates Legacy, and reloads the installed save` |
| `desktop-pointer` / 1280x900 | Experience selector → Legacy entry; `freshLegacy` | Pointer | A focused choice activates on click | Selector closed after clicking the focused Legacy button; `✓ @pointer clicks a focused experience choice` |
| `mobile-touch` / 480x854, `hasTouch: true`, `isMobile: true` | Experience selector → Legacy entry; `freshLegacy` | Real Playwright touchscreen | A native touchscreen event activates Legacy | `page.touchscreen.tap` at the button center closed the selector; `✓ @touch activates an experience choice with a real touchscreen event` |

## Exact-code-SHA automated gates

All commands ran from `game/` on a clean checkout of the tested code SHA.

| Gate | Result |
| --- | --- |
| `DEBUG=pw:webserver TESTED_CODE_SHA=7fbc4d16… yarn playwright test tests/browser/smoke.spec.ts` | Current worktree server launched on port 36882; 5/5 passed across all three projects; server terminated |
| `TESTED_CODE_SHA=7fbc4d16… yarn browser:test` | 5/5 passed across all three projects |
| Default and overridden output-directory focused assertions | 1/1 passed in each run; the default included worktree hash `2493704882`, and the explicit `PLAYWRIGHT_OUTPUT_DIR` remained authoritative |
| `yarn --version && yarn playwright test --list` followed by `git status --short` | Yarn 4.9.2; 5 tests listed; worktree remained clean |
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

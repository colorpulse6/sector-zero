# A3 outcome shell resume — 2026-07-23

## Resume location

- Code worktree: `/private/tmp/sector-zero-sync-outcome-2`
- Branch: `fix/sync-outcome-ownership`
- Accepted A3.1 base: `8ccfa3d345fbb330cac7c9185fc7e6507a72d519`
- Conductor docs worktree: `/private/tmp/sector-zero-engine-conductor-2`
- Conductor docs head: `21c9d679932d64cccbbe0d501c9a8fd2245b142f`
- Current `main`: `ccb8917592c2b2d565628a3b9856ccd2b1802aad`
- Do not rebase, merge, push, or touch the asset lane yet. `ASSET_ACCEPTED_REF` remains unset in the conductor plan.

## Current package state

A3.2 and the coupled A3.3 escape/persistence boundary are implemented but uncommitted. The code worktree is intentionally dirty:

- `game/app/components/Game.tsx`
- `game/app/components/engine/galaxy/experienceFlow.ts`
- `game/app/components/engine/missionOutcome.ts`
- `game/app/components/engine/operations/operationAdapters.ts`
- `game/app/components/engine/save.ts`
- `game/tests/browser/fixtures/routeFixtures.ts`
- `game/tests/browser/helpers/outcomeWriteProbe.ts` (new)
- `game/tests/browser/outcomeAuthority.spec.ts` (new)
- `game/tests/engine/galaxyExperienceFlow.test.ts`
- `game/tests/engine/missionLaunch.test.ts`
- `game/tests/engine/missionOutcome.test.ts`

The shell now:

- attaches outcome attempts to campaign, planet, special, operation, Colony, and POI attempts;
- routes success, failure, retreat, retry, HUB, Escape, Colony takeoff, and final `ENDING` through the accepted coordinator;
- restores exact durable return targets and acknowledges only after the target mounts;
- exposes write retry versus conflict/reload states without borrowing another pending receipt;
- recovers Legacy and Galaxy prepared POI authority;
- closes the Atlas to the experience selector instead of exposing the Legacy cockpit;
- retains retryable travel writes;
- blocks completed POI delivery from escaping after a preparation write failure.

## Verification already run

On the dirty code state:

- `npx tsc --noEmit` — PASS
- `git diff --check` — PASS
- `yarn engine:test` — PASS, 410 tests
- `yarn colony:test` — PASS, 288 tests
- `yarn sprites:test` — PASS, 4 tests
- `yarn build` — PASS
- `NEXT_PUBLIC_BASE_PATH=/sector-zero yarn build` — PASS after allowing the configured Google font fetch

The new browser tests compile, but their live run is the current boundary:

1. An initial command used the wrong project name (`pointer`); valid project is `desktop-pointer`.
2. The corrected sandboxed run failed before tests with:
   `listen EPERM: operation not permitted 127.0.0.1:36411`
3. The escalated rerun was interrupted before execution.

Do not describe the three new browser scenarios as passing yet.

## Exact next action

From `/private/tmp/sector-zero-sync-outcome-2/game`, run outside the restricted listener sandbox:

```bash
npx playwright test tests/browser/outcomeAuthority.spec.ts --project=desktop-pointer
```

The three required scenarios are:

1. operation retreat commit failure, same-ID retry, Atlas mount, acknowledgement failure, acknowledgement retry;
2. stale operation retreat conflict preserving the newer canonical save through reload;
3. pending Galaxy POI receipt restoring the exact Ashfall Region before acknowledgement.

If they fail, use systematic debugging and preserve the assertions. The likely first places to inspect are the write classifier in `tests/browser/helpers/outcomeWriteProbe.ts`, init-script ordering relative to `installSaveFixture`, and mounted-surface timing in the acknowledgement effect.

After those three pass:

1. add/finish the optional Atlas-close legacy-byte and travel-write retry browser assertions if they are not already present;
2. run the entire browser matrix;
3. rerun TypeScript, 410+ engine, 288 Colony, 4 sprite, normal build, and `/sector-zero` build;
4. request independent specification and quality/integration reviews;
5. fix all findings, rerun exact-revision gates, then commit code;
6. only then update the A3 checklist/playtest receipt in the conductor docs and commit that evidence separately.

## Review cautions

- `Game.tsx` is a large orchestration diff; review terminal call sites, hook dependencies, retry callbacks, and pending-return dismissal paths line by line.
- A pending outcome/travel receipt must not be dismissible through Atlas close.
- Operation `TRY AGAIN` must journal the failed attempt before mounting a fresh retry authority.
- A duplicate callback after an acknowledged receipt must be a no-op and must clear its continuation callback.
- A completed POI with a failed preparation write must offer retry/reload, not a generic route escape.
- Preserve every unrelated Legacy field byte-for-byte across Galaxy close, travel, operation, and POI routes.

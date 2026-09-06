# A3 outcome checkpoint — 2026-09-05

## Resume here

- Branch: `codex/a3-resume`
- Worktree: `/Users/nichalasbarnes/.config/superpowers/worktrees/sector-zero/a3-resume`
- Tested code: `b85fb3d381ae28f00c2559f351c0979129c655e6`
- Accepted pure A3.1 base: `8ccfa3d345fbb330cac7c9185fc7e6507a72d519`
- Recovered shell base: `bde0587012698cb02643417f3e9f3373481858f6`
- Restored conductor documents: `059b967`
- Next package: **B1 — Pure semantic input mapping**, after verifying the evidence record below.

A3.2 and A3.3 are implemented and the clean code commit passes the complete standard gate set. This is a local package checkpoint, not an integrated or deployed release. Keep this branch/worktree as the continuation base.

The evidence commit is the commit containing this handoff. Its post-commit gate and review verdict is recorded in [gate-manifest.json](/Users/nichalasbarnes/.codex/visualizations/2026/09/05/01a07127-3e6a-7ae1-b54b-436d683ef1c1/sector-zero-a3-evidence/gate-manifest.json). Before continuing, require `status: PASS`, `code_sha` equal to the tested code above, and `evidence_sha` equal to the evidence commit. Do not infer that verdict from this document alone.

## What changed

- A gameplay retry now replaces the mounted return screen and restores the captured planet/special/POI identity before starting its new attempt. The real Ossuary failure → retry → retreat sequence proves distinct attempt ownership.
- Travel commit/resume/finalize/emergency-retreat and POI preparation compare the latest canonical save with their exact saved base before writing. Failed writes retain the original candidate; intervening changes require reconciliation. An exact candidate already saved is recognized without another write, including a write that persisted before throwing.
- Final campaign persistence retry preserves the ending continuation. A failed initial write blocks automatic resubmission; the receipt stays pending through the ending and is acknowledged after the owned return mounts.
- Save locks block global shortcuts, Region/Atlas/landing-pad callbacks, and native clicks from buttons still focused behind the recovery overlay. Retry/reload controls remain usable.
- Galaxy operation GAME_OVER no longer offers an unavailable gameplay retry. Failure-to-Atlas and retreat still journal their catalog-owned outcomes.

## Important correction to the recovered handoff

The July handoff requested that operation TRY AGAIN journal failure before launching a new attempt. That promise cannot coexist with the accepted operation lifecycle: failure resolves the operation and appends its completion ID; either condition prevents relaunch. A new launch ID does not grant new catalog authorization.

The conductor correction is to remove that unavailable operation control, retaining the existing terminal actions and all catalog/journal guards. Legacy mission and POI gameplay retries remain. Supporting retries after a saved operation failure would require a separate operation lifecycle decision; do not reset completion IDs or bypass the catalog. The old operation-retry promise is not claimed as verified.

## Verified on the clean code SHA

| Gate | Result |
| --- | --- |
| TypeScript, without incremental output | PASS |
| Engine | 425 passed |
| Colony + sprite suites | 288 + 4 passed |
| Full Chromium browser matrix | 37 passed; 0 failed, skipped, or flaky |
| Browser projects | 8 keyboard, 23 pointer, 6 real touch at 480×854 |
| Production export, empty base path | PASS |
| Production export, `/sector-zero` base path | PASS |
| Diff/working-tree check | PASS; clean code commit |

Independent specification and quality reviews passed on the final runtime before committing. Fresh reviews of the separate evidence commit and its repeated gates are recorded in the manifest. The [playtest receipt](../playtests/2026-09-05-outcome-ownership.md) maps the browser proof and its limits.

## Scope and remaining proof

- Full authored POI success → preparation → cargo delivery remains a **F1 live-integration proof row**. Current proof covers pure preparation/authority behavior and mounted receipt recovery; it does not claim that full playthrough.
- The all-ten planet live matrix, complete route/device coverage, input packages B1–B3, and later presentation/rendering/performance packages remain in the conductor plan.
- The M3 asset lane remains reserved on this recovery stack; `ASSET_ACCEPTED_REF` is unset here. Marketplace work was not started.
- At this checkpoint, root `main` is `2f4d28ad51137eba199ec55b72b8beffad42fdaa`; the code commit has 38 branch-only commits versus 28 main-only commits. Root's pre-existing `site/tsconfig.tsbuildinfo` modification was preserved. Reconcile this history deliberately at integration; do not merge or rebase the recovered stack casually.

## Next session

Read this handoff, the manifest, and Package B1 in [the conductor plan](../superpowers/plans/2026-07-19-game-engine-synchronization.md). Verify the accepted evidence SHA and clean worktree, then create an isolated `codex/` branch from this checkpoint for **B1 only**.

Start with pure tests exposing the Space shoot/jump overlap. Implement the approved mode-specific mapping and clear held input on cancel, blur, visibility loss, pause, and route changes. Verify keydown/keyup/blur in the browser. Leave visible touch controls to B2 and general focus/navigation to B3. Preserve the A3 persistence locks and ending behavior.

No push, merge, deployment, root-checkout implementation, or knowledge-base write was performed in this recovery continuation.

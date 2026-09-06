# B1 input checkpoint — 2026-09-05

## Resume here

- Branch: `codex/b1-input-mapping`
- Worktree: `/Users/nichalasbarnes/.config/superpowers/worktrees/sector-zero/b1-input-mapping`
- Accepted A3 base: `e5495fe770adfd33c3cb7978ae4e3656eb3a2394`
- Tested code: `2bf65f253a6bef845199f493b3211de3049810df`
- Game tree: `c803ad3ee983e37800c0db80a4fcd9cd1ca296aa`
- Next package: **B2 — Pointer and visible touch gameplay controls**, after verifying the evidence record below.

B1 is implemented and its exact clean code commit passes the complete gate set. This is a local checkpoint. The evidence commit is the commit containing this handoff; its separate post-commit gates and fresh specification/quality reviews are recorded in [gate-manifest.json](/Users/nichalasbarnes/.codex/visualizations/2026/09/05/01a07127-3e6a-7ae1-b54b-436d683ef1c1/sector-zero-b1-evidence/gate-manifest.json). Require `status: PASS`, the tested code SHA above, and an `evidence_sha` matching this evidence commit before proceeding. This document alone does not establish that verdict.

## What changed

- A pure mapper translates each keyboard event into one semantic intent. Space fires/interacts in shooter, turret, first-person and Colony; jumps in ground mode; and dashes in boarding. Z/Shift remains primary. B retains the existing secondary assignment. The two fallback modes retain shooter bindings.
- Physical sources own held intents independently. Releasing Z cannot cancel a held Shift or touch, and keyup releases its original source even after focus or mode changes. Codes take precedence over layout-dependent key text; fallback keys are case-normalized. Modified shortcuts and repeated keydowns do not create intents.
- Mounted UI takes precedence over retained gameplay state. Canvas UI supports navigation/activation/back; Enter resumes paused canvas play but remains unbound during gameplay. Native interactive elements retain their keyboard ownership. Boss introductions do not carry an early fire press into combat.
- Pause, route/phase/surface changes, blur and hidden-document events clear held keys, mouse fire and active touch. Touch cancellation releases touch owners without activating navigation or cancelling keyboard owners. Existing touch gestures remain; B2 owns visible controls.
- Catch-up stops immediately when a simulation tick changes screen, mode or phase. It clears held input before the next tick can consume it, keeps that tick's audio, and preserves unconsumed time for the next frame. Primitive snapshots also detect engines that mutate the same state object.
- A3 save/recovery locks remain enforced. The ending exception for a pending durable return is preserved.

## Clean-code verification

| Gate | Result |
| --- | --- |
| TypeScript, without incremental output | PASS |
| Engine tests | 448 passed, including 23 new mapping/catch-up tests |
| Colony and sprite tests | 288 + 4 passed |
| Full Chromium browser matrix | 41 passed; zero failed, skipped or flaky; retries disabled |
| Browser projects | 11 keyboard/fixture, 23 pointer, 7 touch at 480×854 |
| Browser receipts | 39 tagged with the exact tested code SHA; two fixture checks do not emit receipts |
| Production exports | Empty base path and `/sector-zero` both PASS |
| Diff and worktree checks | PASS; clean before and after every gate |

The exact-code gate record is [catchup-code-gates.json](/Users/nichalasbarnes/.codex/visualizations/2026/09/05/01a07127-3e6a-7ae1-b54b-436d683ef1c1/sector-zero-b1-evidence/catchup-code-gates.json). The [playtest receipt](../playtests/2026-07-19-input-intents.md) describes the new browser checks and their limits. Final evidence-SHA acceptance is recorded separately in the manifest.

## Failures retained in the evidence

- The initial browser regression reproduced Space firing during a ground jump and movement continuing after pause/resume. Both pass with the mapper/reset integration.
- Evidence `c0636592a05927a13f7922e2125574add7eef7cf` passed automated gates and specification review but failed quality review: catch-up reused a held UI key after the first tick entered gameplay. The real engine moved x=216→221→226; activation could fire a bullet. `catchup-mapper-red.log` records six expected failures, including movement/fire and same-object boundary mutation. The corrected helper passes all 23 focused tests, and its three-file integration passed a separate precommit review. That rejected checkpoint is superseded by the tested code above; final acceptance still requires the matching manifest and fresh evidence reviews.
- The older ending test pressed Z during BOSS_INTRO. It now waits for the shipped DevPanel to show BOSS_FIGHT before pressing fire. Its terminal, save-retry and acknowledgement assertions are unchanged.
- One pre-commit planet retry stopped at the cockpit. It passed unchanged on the diagnostic rerun, the next full matrix and the clean-code matrix. The cause remains unconfirmed; diagnostics now cover the first retry-mount assertion as well as the later gameplay assertion. No retry runtime fix is claimed by B1.
- Ashfall combat failure timed out once after its simulation advanced only 1:21, then passed unchanged in 40.0s, 36.5s and 28.9s. The corrected-code run also passed, in 138.5s. Random encounters, slow mines that gate later waves, and headless rendering can stretch this test. No combat rule, timeout or terminal assertion was changed.
- An initial exact-code unit run stalled in a Node sprite-test process. A process sample showed V8 waiting; the four sprite tests passed separately. The stalled run remains recorded as FAIL. A fresh complete run using repository-relative test paths passed all gates; no production or test logic was changed to resolve the stall.

## Next session

Read this handoff, its matching PASS manifest and Package B2 in [the conductor plan](../superpowers/plans/2026-07-19-game-engine-synchronization.md). Start an isolated `codex/` worktree from this evidence checkpoint for **B2 only**. Reuse semantic intents/source ownership for visible, accessible controls in the five required profiles, and prove actual touch actions and cancellation. B3 still owns general focus/navigation; F1 still owns the complete route/device matrix and authored POI delivery proof.

Root `main` remains `2f4d28ad51137eba199ec55b72b8beffad42fdaa` with its pre-existing `site/tsconfig.tsbuildinfo` modification. At the tested code SHA, this recovery branch has 43 branch-only commits versus 28 main-only commits. Reconcile that history deliberately at integration. The M3 asset lane remains reserved and `ASSET_ACCEPTED_REF` is unset. No push, merge, deployment, root implementation or knowledge-base write was performed.

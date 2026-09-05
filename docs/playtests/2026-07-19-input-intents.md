# B1 input intents — verified 2026-09-05

The filename follows the conductor plan; this receipt was produced on September 5. Tested code: `e9d4cf261c2b3445a0f4cadda7588dd3dbb6f1d1`. Worktree: `/Users/nichalasbarnes/.config/superpowers/worktrees/sector-zero/b1-input-mapping`.

## Proof

| Route | Device and fixture | Expected and observed outcome |
| --- | --- | --- |
| DevPanel → ground → Space → Z/Shift → keyup | Chromium 1280×900, keyboard, `freshLegacy` | Space renders a jump with no player projectiles. Shift continues firing after Z releases; final release stops new shooting animation. Fire does not jump. |
| Ground → blur → pause/resume → fresh press | Chromium 1280×900, keyboard, `freshLegacy` | Player stops after a dispatched window blur and after pause/resume despite the old key staying down. A repeated keydown does not rearm movement; a fresh release/press does. |
| Ground → hidden-document boundary → boarding → ground | Chromium 1280×900, keyboard, `freshLegacy` | A simulated `document.hidden`/visibility event clears movement. Switching modes through shipped DevPanel controls also discards the old hold. |
| Ground → keyboard + touch → touchcancel → touch only → touchcancel | Chromium 480×854 with touch enabled, `freshLegacy` | Native Chromium touch cancellation preserves keyboard-owned fire. Touch-only fire stops after cancellation. |

The browser probe only observes existing canvas drawing calls: ground-player sprite position/animation and cyan player-projectile rectangles. Gameplay comes from shipped DevPanel launches, keyboard events and native Chromium touch input. There is no game-state injection, runtime mutation API or clock acceleration. Blur and visibility are explicitly simulated browser-event boundaries; this does not claim a live operating-system app switch.

Four new browser tests pass. The full matrix has 41 passing tests with retries disabled: 11 keyboard/fixture, 23 pointer and 7 touch. Its 39 application-route receipts carry the exact code SHA; the two fixture checks have no route receipt. The full matrix also rechecks the A3 outcomes, save locks, planet retry and ending continuation.

Pure tests cover every `GameMode`, UI, pause, blocked input, physical codes/fallback casing, modifier/repeat suppression, one projected engine flag per event, alias ownership, context changes, reset/rearm and detached projections. Totals: 439 engine, 288 Colony and 4 sprite tests. TypeScript and both production exports pass on the clean code SHA.

## Failure evidence and limits

- [browser-red.log](/Users/nichalasbarnes/.codex/visualizations/2026/09/05/01a07127-3e6a-7ae1-b54b-436d683ef1c1/sector-zero-b1-evidence/browser-red.log) records the two expected original failures: Space also spawned projectiles, and pause/resume retained movement. Its screenshot visibly shows a jumping player and cyan projectile.
- `mapper-red.log` records 12 assertion failures against the initial mapper scaffold; `mapper-green.log` records 14 passes. `browser-green.log` records the four new checks passing after integration.
- `precommit-browser.log` preserves the broader initial failures. `retry-diagnosis.log`, `combat-recheck.log`, `precommit-final-browser.log` and `code-final-browser.log` preserve the follow-up evidence. The [handoff](../handoffs/2026-09-05-b1-input-checkpoint.md) distinguishes the corrected ending test from unconfirmed/transient failures and the interrupted Node run.
- Actual new gameplay observation is ground-focused. All mode bindings are table-tested, but this does not claim full live gameplay on every mode/device. B2 owns visible touch controls; B3 owns general focus; F1 owns full route/device acceptance.
- B1 retains the explicit existing two-finger primary/secondary touch gesture. Its keyboard one-event/one-intent rule does not claim that this existing gesture was removed.

Evidence-SHA gates and independent reviews are accepted only through the matching PASS [gate manifest](/Users/nichalasbarnes/.codex/visualizations/2026/09/05/01a07127-3e6a-7ae1-b54b-436d683ef1c1/sector-zero-b1-evidence/gate-manifest.json).

# Fighter polish integration review

Owner: Codex Manager. Integrated Fable commit `be645ff` as `2e1a75f` on
`codex/ashfall-recovery`, above salvage recovery `2a2473c`. PR #26 is prepared for review;
this is local integration, not a main merge or deployment.

## Review result

The manager inspected the full presentation diff and representative before/after
captures, then inspected fresh captures from the combined static export. Enemy
sprites preserve aspect and fill their intended size; tint is clipped to alpha;
shots, exhaust, explosions and Rockjaw are readable. Distinct layer sizes and sway
reduce the obvious repeating backdrop. This remains scrolling raster scenery,
not procedurally unique terrain.

The out-of-ownership `postFx/presets.ts` change is accepted into integration: only
`shooter` switches to the new SPACE preset. The previous combat filter crushed
starfield shadows. Other mode presets retain their previous mapping. Rendering
changes do not modify combat update rules, hit boxes, rewards, saves or colony
commands. Shared particle rendering is exercised by the engine suite.

## Manager verification

Resumed on 2026-10-21. The prior temporary test log and fighter worktree directory
were cleared outside this task; both implementation commits remain in retained Git
branches. The interrupted browser result was not treated as a pass.

- 1,061 engine, colony and sprite tests pass together, zero failures.
- Production static export succeeds, including type checking and `/fighter-preview/`.
- Both fighter browser tests pass: scenes render and scroll without page errors or
  missing sprite responses; enemy corner pixels show no rectangular tint.
- All 45 targeted browser cases pass across focused runs, with zero retries on the
  corrected tests: 27 fighter/salvage/graphics/launch/smoke cases plus all 18 input
  cases. The first run exposed an observer mismatch; it was stopped after 36 passes
  and two completed shooter timeouts. No interrupted result was counted as a pass.
- The input observer previously recognized only HTML image draws. Prepared sprites
  now use cached canvases, so the test lost its ship samples. The observer follows
  source provenance through those real canvas draws and uses stable hull centers
  and transformed bullet positions. It does not read or replace game state. All
  movement, firing, bomb and finger-ownership assertions remain.
- TypeScript was rerun after both test corrections and passes.
- The 2026-10-19 temporary manager captures are no longer available. Representative
  original before/after JPGs remain in `docs/assets/fighter-polish/`.
- Measured free-running CPU time inside `drawGame`: p50 0.7 ms, p95 1.0 ms for live
  combat and Rockjaw on this machine's headless Chromium. This excludes the grading
  pass and is not a mobile frame-rate guarantee. A stepped first-use boss sample
  reached 30.3 ms; cached steady-state rendering is substantially cheaper.
- Local static preview `http://127.0.0.1:3198/fighter-preview/` was restarted on
  2026-10-21 and responds HTTP 200.

The inspection harness uses seeded randomness, but animation begins before the
browser test pauses it and rendering also consumes random values. Capture labels
are stepped scene checkpoints, not proof of bit-exact cross-build replay.

## Earlier CI failure and correction

Run `39279229121` at salvage-only head `2a2473c` passed 125 browser tests and timed
out only the complete fresh-save salvage route at 120 seconds. Its retained
`settlement-receipt` proves 25 shifts, five operational buildings and ten settlers;
the final returned-colony screenshot and error snapshot show the route reached
colony controls after reload. The end-to-end test now allows 180 seconds for the
whole journey and final capture on software WebGL. Assertions and gameplay are
unchanged. The new combined-head CI result must be checked separately.

## Remaining gates and ownership

- Independent review: not run. Automatic approval review rejected sending this
  private game diff to the additional external reviewer. No reviewer was launched.
  A specific source-sharing authorization is needed before retrying; normal tool
  approval still applies. The manager's local source review and tests are complete
  evidence in their own right, not an independent review.
- Codex Manager: wait for current-head PR checks and obtain the required approving
  review before merge, then verify the deployed game and site. The prior release's
  one-time administrator override does not apply here.
- Nic: inspect the fighter preview in motion before treating the aesthetic as
  locked. Cryon's bright backdrop and stacked RESISTED labels remain optional
  polish; they do not change the accepted Ashfall recovery contract.
- Keep the primary preview while review/playtest are pending. The temporary Fable
  worktree directory is already absent, with a stale Git registration; its original
  commit remains recoverable from `design/fighter-battle-polish`. No task-owned
  worktree was removed during this continuation. Unrelated site build metadata and
  research remain outside PR26.

# B3 navigation checkpoint — 2026-09-05

## Resume here

- Branch: `codex/b3-navigation-focus`
- Worktree: `/Users/nichalasbarnes/.config/superpowers/worktrees/sector-zero/b3-navigation-focus`
- Accepted B2 base: `fdb0334836aeb863becab6b6e37adb40a4bb4f41`
- Code checkpoint: `e6e394663d07ad9e57911bdcb57fcc265c1c1dc1`
- Game tree: `1c20ca03d54287143ed50beb6e1f058aca66c5b8`
- Receipt: `docs/playtests/2026-07-19-navigation-focus.md`
- Next package after accepted B3 closure: **C1 — Mission presentation and dialogue lifecycle**.

This is a local implementation checkpoint. Acceptance requires the matching post-evidence **PASS** [gate-manifest.json](/Users/nichalasbarnes/.codex/visualizations/2026/09/05/01a07127-3e6a-7ae1-b54b-436d683ef1c1/sector-zero-b3-evidence/gate-manifest.json). Its code/game-tree identities must match above, and `evidence_sha` must identify the commit containing this handoff. It must record exact clean-evidence gates and a fresh specification review followed by a separate quality/integration review. This document alone does not establish acceptance. A pending review verdict means resume B3 closure before C1.

## What changed

- Cockpit Armory, Crew, Codex, Bestiary and Pilot now hit-test the displayed rows, tabs and explicit actions. They reuse keyboard purchase/read/conversation/skill rules. Renderer and hit testing share geometry; pointer hover does not change keyboard selection. Mission Board keeps its existing canonical activation path.
- Mouse and native touch share shell point activation. An arbitrary tap inside a subscreen no longer returns to the hub. Star Map contacts expand the actual world and launch the actual unlocked level; a visible cockpit-return button completes the pointer/touch round trip. Its frame loop uses current state and its own cancellation generation so a stale frame cannot overwrite a point selection.
- A shared focus lifecycle captures the invoker before initial focus, contains both Tab directions and outside focus, consumes each screen's Escape policy, and restores connected invokers. StrictMode effect replay does not simulate a close. Covered surfaces suspend containment while retaining their controls.
- Atlas initially focuses its selected contact; repeated arrows move selection and focus together without the detail heading taking focus. Close/Escape restores the Galaxy selector choice.
- Region keeps source (`atlas`, `landing-pad`, `cockpit`) independent of action permission. Its labels and back controls identify the actual source. Atlas and Exit Menu stay mounted underneath Region so the true Region invoker survives.
- Colonies has dialog semantics, primary-action initial focus and restoration to a real focusable cockpit Colonies hotspot. Exit Menu focuses Resume and returns to the exploration canvas. POI Outcome focuses its resolution button and explains why Escape cannot dismiss pending cargo.
- Outcome/travel recovery owns focus above the other screens. The existing recovery regression now proves that a covered Resume is rejected as a focus target and leaves save/write observations unchanged before a deliberate Retry. Save, outcome, reward and return authority are unchanged.

## Verification

Exact clean-code gates for the code identity above: **PASS**, Node **20.20.1**.

| Gate | Result |
| --- | --- |
| TypeScript | PASS |
| Engine | 486 passed |
| Colony / sprites | 290 / 4 passed |
| Complete Chromium matrix | 80 passed, zero retries: 20 keyboard/fixture, 30 pointer, 30 touch |
| Exact-SHA browser receipts | 76 verified; four fixture rows correctly emit none |
| Production exports | Empty base path and `/sector-zero` both PASS |
| Ownership and cleanliness | 23 cumulative code files within conductor allocation; clean before/after exact gates |

The 17 B3 browser rows cover all five canvas subscreens, Star Map launch/return, the five focus policies, all three Region sources, Colony descent/Resume/takeoff, restored POI delivery and recovery above Region. Existing A3/B1/B2 routes remain in the complete matrix.

Evidence root: `/Users/nichalasbarnes/.codex/visualizations/2026/09/05/01a07127-3e6a-7ae1-b54b-436d683ef1c1/sector-zero-b3-evidence`. Exact gates and receipt identities are in `entry-code-gates.json`, `entry-code-receipt-verification.json`, followed by `final-evidence-gates.json` and `final-evidence-receipt-verification.json`. The final manifest owns the evidence-SHA and sequential-review verdict.

## Retained development history

- The accepted B2 baseline passed TypeScript and 765 units.
- Cockpit activation produced assertion RED then 12 focused GREEN tests. Five-screen static focus/source checks produced 10 expected failures before implementation.
- Initial browser RED reproduced the missing focus contracts and actual-target Star Map failure; recovery separately reproduced missing Retry focus. The first RED receipt used the B2 SHA while an uncommitted Region caller/source change was present. `browser-red-context.md` and `browser-red-runtime-diff.patch` disclose this; it is not an exact clean-B2 run.
- The first aggregate passed 77 browser rows and failed one older assertion that tried to focus a covered Resume and press Enter. The focus trap had correctly redirected to Retry. The corrected test proves rejected focus and unchanged save/write observations before retrying; it passes. The original failure is preserved in `precommit-gates.json` and `precommit-browser.log`.
- Star Map return additionally produced two visible-control assertion failures, then pointer/touch return-and-launch GREEN; the Colonies invoker regression also passed.
- Initial code `6206698` passed TypeScript, 780 units and all 16 B3 browser rows, but its full browser gate failed 75/78: inherited keyboard pause, Boarding direction/aim and Ground touch blur observations. `code-gates.json` remains FAIL and its builds were not reached. All three route tests also failed on clean accepted B2 in `b2-comparison.log`; prior B2 acceptance is a historical record, not proof of repeatability.
- `camera-red.log`/JSON reproduced screen drift; `camera-diagnosis.json` shows idle sprites, zero world displacement and equal/opposite camera and screen movement. Ground observers now recover world displacement from forwarded camera drawing arguments, preserving screen coordinates for projectile checks and requiring idle poses at input boundaries. Requested keyboard frame samples are bounded, and fresh-key movement is captured from before keydown. The interim `camera-green.log` passed the lifecycle assertions but its prolonged fresh-Right endpoint moved from 326.95 to 98.99, consistent with a respawn; no complete frame trace was retained for that interim run, so the cause remains an inference. The corrected first-movement observation and the full four-row input file pass in `camera-corrected.log`.
- Boarding directions now start independently through native DEV → BOARDING → X, capture before touchStart, and release before assertions. Retained diagonal aim has a separate native positioning leg and safe firing-space assertion. The observer fixture produced meaningful RED for valid uneven ticks and invalid angle/speed; its correction requires signed 7px/tick projectile travel over three rendered frames with one to three ticks per interval. No gameplay runtime, health, simulation clock or movement threshold changed for the movement-observer correction. The original failing Boarding wall position was not captured; collision is a source-supported route hazard rather than direct telemetry from that failure.
- Intermediate code `14b212c` passed TypeScript, 780 units and 79/80 browser rows; `corrected-code-gates.json` remains FAIL and builds were not reached. Its keyboard repeat observation was interrupted by death: `keyboard-entry-diagnosis.json` captures eight idle frames at world anchor 356.9406 followed by spawn anchor 60 and the airborne spawn animation. The corrected route uses a fresh native Ground entry and short Left hold; strict idle/world checks still detect a leaked hold at the boundary, fresh same-key Left must resume its running pose, and fresh Right must move more than one world pixel. No forced travel into combat remains. This is route isolation, with the shipped simulation, health and collision rules unchanged.
- A bounded focus audit found that founding the first Colony removed the focused Found button without focusing Descend. The added native Enter route reproduced the missing Descend focus before correction; the shared hook now keeps focus contained across that content replacement. The exact correction and focused evidence are recorded in `founding-focus-*` artifacts.
- Evidence `66d71b0` was superseded during verification after the specification reviewer found two newly committed EOF blank lines. Its interrupted `evidence-gates.json` is retained as FAIL; it is not an accepted gate. The replacement evidence removes the whitespace and the external runner now checks the cumulative base-to-evidence diff as well as worktree cleanliness. `superseded-66d71b0-spec-note.md` records that preliminary finding; fresh final reviews must identify the replacement evidence SHA.
- Three implementation workers stopped at the account usage limit. The conductor completed and verified the saved work. This history does not substitute for the required fresh final reviews.

## Scope and proof limits

Work stayed in the isolated B3 worktree. Main remains `2f4d28ad51137eba199ec55b72b8beffad42fdaa`; its preexisting `site/tsconfig.tsbuildinfo` change was preserved. No push, merge, deployment, KB write, C1 implementation or M3 asset work occurred.

Browser evidence uses Chromium desktop and mobile emulation, not physical devices. The isolated keyboard lifecycle route uses mouse activation of the shipped DevPanel for setup. B3 touch activation tests deliberately use keyboard preselection and a mouse-hover observation where needed to prove independence; they are not all touch-only setup routes. Prepared POI fixtures exercise a real restored pending-delivery screen and canonical confirmation, not an authored combat clear. Full authored POI playthroughs, Galaxy physical Colony returns, the complete F1 route/device matrix and M3 acceptance remain later work. Existing canvas-menu visual polish is not a new art acceptance.

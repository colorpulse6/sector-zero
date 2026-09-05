# B2 touch checkpoint — 2026-09-05

## Resume here

- Branch: `codex/b2-touch-gameplay`
- Worktree: `/Users/nichalasbarnes/.config/superpowers/worktrees/sector-zero/b2-touch-gameplay`
- Accepted B1 base: `1b87545a6cdb0bb3991c27de8cc606fe707d448d`
- Code checkpoint: `9268bfe7f72da557bcbd725a0d4489af9bb8f653`
- Game tree: `622d82f57ee775b3fb960bea8d24af0a2795f32e`
- Receipt: `docs/playtests/2026-07-19-touch-gameplay.md`
- Next package: **B3 — Navigation activation, modal focus, and provenance**, after accepted B2 closure.

This is a local implementation checkpoint. Require the post-evidence [gate-manifest.json](/Users/nichalasbarnes/.codex/visualizations/2026/09/05/01a07127-3e6a-7ae1-b54b-436d683ef1c1/sector-zero-b2-evidence/gate-manifest.json) to have `status: PASS`, the code/game-tree identities above, and an `evidence_sha` matching the commit containing this handoff. It must record exact clean-evidence gates plus a fresh specification review followed by a separate quality/integration review. This document alone does not establish acceptance.

## Implementation

- `TouchControls` provides named DOM controls, held-state feedback, safe-area offsets and targets of at least 44×44. Five profiles have six mounted presentations because First-person and Colony label their primary action differently. All visible `TouchControls` content, including the turret aim hint, occupies a reserved footer below the entire game image, dashboard and dialogue; only the transparent aim target overlays gameplay.
- The footer is normally 176px high (164px plus max(12px, bottom safe area)) and keeps independent width up to 480px, preserving room at 375px. The canvas scales proportionally into the remaining height. Game/grade layers share aligned bounds; transparent turret aim retains the 714/854 gameplay-height ratio above its footer Fire button.
- Controls reuse B1 semantic intents and independent sources. Pointer capture tracks each finger; partial release preserves other holds. Cancellation, blur, visibility loss and route/scene changes clear ownership. Keyboard and virtual activation use their own sources.
- Shooter retains drag-to-position without automatic canvas fire. Bomb is explicit; the second-finger gesture is removed. A DOM-control finger cannot steal the canvas drag.
- Ground stationary Down aim mirrors Up, and opposed vertical input retains horizontal facing. Boarding retains diagonal aim after movement stops; the aim dot and dash trail follow it while existing cardinal sprites remain.
- Turret aim is normalized to the gameplay area and passed to the engine. Held pointer aim owns the crosshair; hover applies once. Focused arrows continue from the current crosshair and release on blur. Fire remains separate.
- Briefings describe the active profile. Pause has an accessible name and 44×44 target. Native Pause/Resume release handles a third finger while movement and Fire remain down.
- Native Pause/Resume release enforces the same save/recovery lock as click capture, including the existing ending exception. A contact begun before a failed-save overlay cannot resume through it.
- Global keyup release now has a stable listener. A frame-dependent effect could replace that listener during dispatch and miss a keyboard release.
- After a state commit, the new frame effect owns scheduling. Removing the old callback's extra scheduling prevents stale exterior state overwriting a Colony interior; zero-tick callbacks still reschedule themselves.
- The framework development badge is disabled after native touch exposed lower-left pad interception. Consistent border properties remove a React warning overlay. The shipped game DevPanel remains available.

These are the bounded B2 decisions in [the conductor plan](../superpowers/plans/2026-07-19-game-engine-synchronization.md). B3 focus/navigation and M3 content remain outside this checkpoint.

## Verification

| Evidence / gate | Result |
| --- | --- |
| Development focused engine suite | 48 passed in `engine-green.log` |
| Development aggregate | 765 passed: 473 engine + 288 Colony + 4 sprite, in `precommit-unit.log` |
| B1 input regression rerun | Four browser tests passed in `cancel-stable-release.log` |
| Held-Resume lock regression | Expected RED reproduced; GREEN passed in 2.3s with unchanged save bytes, pending receipt and write observations |
| Isolated ground lifecycle | Passed in 8.9s; three preceding unchanged diagnostic reruns also passed |
| Corrected B2 browser file | 20 passed in `footer-gameplay-green.log`: one observer fixture, two pointer and 17 touch, including Ground, Colony and lifecycle |
| Footer geometry / interim visual review | Six profiles pass at 480×854 and 375×667; the prior interim images established bottom-dashboard/hull and Ground-avatar clearance, not top-left turret-counter clearance |
| Visible turret hint correction | Four targeted tests and TypeScript pass; the hint is below the canvas and separate from Fire at both required sizes, and the conductor-inspected PNG shows WAVE/KILLS |
| Explicit Node 20.20.1 sprite check | Four passed; this is not the complete exact-code gate |
| Exact clean-code TypeScript and suites | PASS under Node 20.20.1: TypeScript and 765 units (473 engine + 288 Colony + 4 sprite) |
| Exact clean-code complete Chromium matrix | PASS: 62 tests, zero retries; 12 keyboard/fixture, 25 pointer and 25 touch; all 59 exact-SHA receipts and three fixture rows verified |
| Both exact-code production exports | PASS: empty base path and `/sector-zero` |
| Exact-code ownership/diff and clean-state checks | PASS: 19 owned cumulative files; clean before/after every gate |
| Separate evidence commit, exact gates and sequential fresh reviews | Matching external PASS manifest required |

Development results do not substitute for exact-checkpoint gates. Browser receipt identities must match the tested checkpoint, not `working-tree`.
The current exact-code PASS is recorded in `aim-hint-code-gates.json`, with receipt identities in `aim-hint-code-receipt-verification.json`; post-evidence gates use `aim-hint-evidence-gates.json`, using Node 20.20.1 (CI specifies Node 20). Preserve the prior `node20-*` automated PASS records, the rejected evidence review/manifest, and both `code-gates.json` and `footer-code-gates.json` FAIL records.
Reproduce the environment by prefixing gate commands with `PATH=/Users/nichalasbarnes/.nvm/versions/node/v20.20.1/bin:$PATH COREPACK_ENABLE_AUTO_PIN=0 COREPACK_ENABLE_PROJECT_SPEC=0`.
Commit code first, run the complete clean-code gates, then reconcile and commit the receipt/handoff separately as evidence.
Rerun required automated gates on the exact clean evidence SHA and obtain both fresh reviews in order.
Any review fix requires a new code/evidence cycle and both reviews again. Do not start B3 until the matching manifest passes.

## Failures and corrections retained

**Control and engine RED.** All six presentation tests initially lacked controls. Separate RED logs reproduced turret aim forwarding, asymmetric ground aim and lost boarding diagonal aim; the focused green run passed 48 tests. Briefing RED also exposed obsolete gesture copy.

**Release ownership.** Native cancellation diagnosis identified the missed keyboard release rather than a touch-cancel failure. Stable keyup handling passes the four B1 regressions. Temporary runtime tracing was removed.

**Native driver.** Removing a point from `touchMove` does not release it. Isolated Chromium probes established partial `touchEnd` semantics; corrected tests supply the removed ID and use native three-contact cancellation without injecting game state.

**Focused turret aim.** An interim review found stale component coordinates jumping the crosshair after focus. `turret-focus-red.log` preserves the failure; focused arrows now hold semantic directions and the browser row checks continuity and blur release.

**Proof corrections.** Test review found old projectiles counted as continued fire, unsigned boarding aim, ground aim measured against a jumping player, missing shooter vertical actions, incomplete cancellation and a mouse setup mislabeled as touch. Current tests use fresh firing cycles, signed trajectories, complete directions and native principal route entry; remaining hybrid boundaries are disclosed.

**Colony stale frames.** `colony-scene-trace.log` showed a width-6 interior scene paired with the former width-24 game state and duplicate stale frames. Scheduling changed as above. Colony traversal passed in `scene-loop-green.log`, which still contains an older boarding failure; it is not an all-green suite. An interim engine review found no issue with the correction.

**Boarding isolation.** Earlier legs hit an entry wall or encountered normal death/respawn. Real DevPanel relaunches separate direction, combat and entry-bay cancellation. `boarding-final-green.log` passes without combat changes or invincibility.

**First full matrix.** `precommit-browser.log` finished 55 passed / five failed. Four outcome-authority rows awaited the former Pause symbol; two accessible-name selector corrections preserve every terminal/save assertion. The fifth was the ground lifecycle jump below.

**Held Resume.** `resume-lock-red.log` lost PAUSED after a native Resume contact, begun before a failed retreat-save overlay, released through it. The native handler now checks the existing recovery lock and ending exception. `resume-lock-green.log` passes with PAUSED/error preserved and canonical save bytes, pending receipt and write observations unchanged.

**Ground lifecycle.** The original 196.8px jump screenshot shows two lives and full HP, consistent with respawn from the initial three-life attempt. Three unchanged diagnostic reruns passed in `lifecycle-trace.log`; exact timing remains unproven because the failure had no frame attachment.
The pause leg now relaunches via native DevPanel taps, holds Left+Fire at the entrance and moves the old finger Right after resume. Strict idle-sprite checks catch held Left even at a wall; the original ≤1px position/no-fire checks and a fresh-Right proof remain. Failure-only frame/event/control diagnostics are retained. `lifecycle-isolated-green.log` passes in 8.9s; no runtime, combat, health, camera or invincibility behavior changed for isolation.

**First code gate.** Code `6440acc4c087dbc47dce2efe79b7493d9e5d4979` passed exact TypeScript and 765 units; its browser matrix finished 60 passed / one ground-trajectory failure. The runner stopped before builds. `code-gates.json` remains **FAIL**; earlier passing precommit builds do not close that checkpoint.

**Node 23 worker stall.** On prior code `9822d726c6fa556d3fb2fa55ba9f2de7c1c8f45a`, TypeScript and engine tests passed, but the Node 23 sprite worker stalled. `footer-node23-sprite-hang.sample.txt` shows a V8 task-queue drain wait; the conductor terminated that owned worker. No assertion failure was observed, and `footer-code-gates.json` remains **FAIL**, with later browser/build gates unreached. Four sprite tests passed under explicit Node 20.20.1. That result supports using the CI Node major for the complete rerun; it does not prove the stall's root cause.

**Footer correction.** Visual review found a P2 introduced obstruction of weapon/bomb status and dialogue. The conductor updated the spec/plan for the reserved footer. `footer-red.log` fails all six separation/alignment rows; the corrected rows pass at 480×854 and 375×667 with 44px non-overlapping targets below the whole canvas and aligned grade/turret geometry. [footer-visual-review.md](/Users/nichalasbarnes/.codex/visualizations/2026/09/05/01a07127-3e6a-7ae1-b54b-436d683ef1c1/sector-zero-b2-evidence/footer-visual-review.md) establishes bottom-dashboard/hull and Ground-avatar clearance in four inspected 480×854 images; it did not establish top-left turret-counter clearance. The 375×667 result is geometry evidence, not an inspected screenshot.

**Rejected evidence and visible aim hint.** Prior code `9822d726c6fa556d3fb2fa55ba9f2de7c1c8f45a` and evidence `c024680f185a0e0a1383009552a3bcf1ea0fc13f` both passed their `node20-*` automated gates and receipt checks. Fresh specification review then returned FAIL/P2 because the opaque turret aim hint covered KILLS; quality review was not started. Retain `superseded-c024680-spec-review.md` and `superseded-c024680-manifest.json`; those automated passes did not accept the evidence.
`aim-hint-red.log` fails the new visible-hint assertion at y12.796875 against canvas end y677.203125. The two-file correction moves only the visible hint to the unused left turret footer, retaining aim geometry and handlers. The existing profile test now checks hint bounds, canvas separation and Fire separation at 480×854 and 375×667. `aim-hint-green.log` passes four targeted cases and TypeScript passes; the conductor-inspected PNG shows WAVE/KILLS unobstructed. Current exact-code results appear above; the new evidence SHA still requires its own gates and both fresh sequential reviews.

**Projectile observer correction.** `projectile-observer-red.log` rejects valid unequal 10/20/30px steps and accepts invalid 11px movement. The corrected Ground branch accepts only signed integer 10px advances of one to three ticks per interval, independently. Sampling retains scenery/bullet frames through player blinking. The live Down test polls an actual three-frame trajectory after a native Ground relaunch of the compound leg; no engine, clock or health state is mutated. The added pure fixture validates the observer, not injected game state. The exact failed sequence was not retained, so its timing remains unproven. `footer-gameplay-green.log` passes all 20 B2 cases.

All failed and diagnostic runs remain in the external evidence directory. [review-history.md](/Users/nichalasbarnes/.codex/visualizations/2026/09/05/01a07127-3e6a-7ae1-b54b-436d683ef1c1/sector-zero-b2-evidence/review-history.md) holds the fuller history. Interim reviews never replace fresh exact-evidence reviews.

## Proof limits

Touch gameplay uses Chromium emulation at 480×854, including native multi-touch; six geometry rows also pass at 375×667. No physical-device acceptance is claimed.
Visual inspection includes the four prior 480×854 footer screenshots and the conductor-inspected corrected Turret PNG. Narrower-phone screenshots, real safe areas, browser chrome and sustained legibility remain unproven; the smaller canvas also reduces existing low-contrast copy.
Drawing observations forward calls unchanged, without game-state injection, simulation replacement or clock acceleration. Blur/visibility boundaries are simulated; the Resume test deliberately induces a failed storage write.
Campaign, planet, alternate-mode and Colony DAY routes enter through the shipped DevPanel. Galaxy operation entry uses Continue Galaxy → Launch Operation.
The lifecycle mode switch uses mouse DevPanel activation. The Resume regression uses pointer/Enter setup, native held Resume, mouse retreat and native release; it is explicitly hybrid input.
These are sampled gameplay actions and transitions, not completed playthroughs of all routes. Galaxy physical Colony return remains unavailable.
All-ten planet launch/live play, full authored POI delivery and whole-game route/device acceptance remain F1.

## Repository placement

At receipt creation the main checkout remains at `2f4d28ad51137eba199ec55b72b8beffad42fdaa`, with its pre-existing `site/tsconfig.tsbuildinfo` change preserved. The B2 branch and main have diverged; this local checkpoint is not merged or deployed. Use the isolated B2 evidence checkpoint for continuation, not the main checkout.

## Continue with B3

After matching B2 PASS evidence, start **B3 only** from the accepted evidence checkpoint in an isolated worktree.
Read this handoff, its manifest, the [touch receipt](../playtests/2026-07-19-touch-gameplay.md) and Package B3 before editing shared shell files.
Preserve B1 input ownership and A3 save locks while implementing navigation activation, modal focus and provenance.
M3 assets remain reserved and untouched; `ASSET_ACCEPTED_REF` is unset. No push, merge, deployment, main-checkout implementation or knowledge-base write is authorized by this checkpoint.
Residual risk: the original ground failures' timing and physical-device legibility remain unresolved; acceptance depends on the final matching gate/review manifest.

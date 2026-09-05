# B2 touch gameplay — 2026-09-05

The filename `docs/playtests/2026-07-19-touch-gameplay.md` follows the conductor plan; this receipt records September 5 work.
Code checkpoint: `9268bfe7f72da557bcbd725a0d4489af9bb8f653`. Game tree: `622d82f57ee775b3fb960bea8d24af0a2795f32e`.
Worktree: `/Users/nichalasbarnes/.config/superpowers/worktrees/sector-zero/b2-touch-gameplay`.
Accepted B1 base: `1b87545a6cdb0bb3991c27de8cc606fe707d448d`.

This is a local implementation receipt. Acceptance requires the matching post-evidence **PASS** [gate-manifest.json](/Users/nichalasbarnes/.codex/visualizations/2026/09/05/01a07127-3e6a-7ae1-b54b-436d683ef1c1/sector-zero-b2-evidence/gate-manifest.json): its code/game-tree identities must match above, and `evidence_sha` must match the commit containing this receipt. The manifest must include exact clean-evidence gates and fresh sequential specification and quality/integration reviews. This document alone does not establish that verdict.

## Controls

| Profile | Visible controls and behavior |
| --- | --- |
| Shooter | Movement pad, Fire and Bomb. Canvas drag positions the ship without automatic fire; releasing it restores an independently held pad direction. The implicit second-finger bomb is removed. |
| Ground | Left/right movement, Up/Down aim, Fire and Jump. Stationary Down now mirrors Up; opposed vertical input retains horizontal facing. |
| Boarding | Eight-way movement, Fire and Dash. Normalized diagonal aim survives movement release; the aim dot and dash trail follow it while existing cardinal sprites remain. |
| First-person / Colony | Forward/back, strafe and separate Look controls. Primary is Fire / interact in first-person and Interact in Colony. |
| Turret | Position-sensitive aim area and separate Fire. Aim is normalized to the gameplay area; held pointers own the crosshair, hover applies once, and focused arrows continue from the current crosshair. |

Five profiles produce six mounted presentations because First-person and Colony have distinct action labels.
Named DOM buttons provide held-state feedback, safe-area placement and targets of at least 44×44 in a reserved footer below the entire canvas, including its dashboard and dialogue.
The footer reserves 164px plus the greater of 12px or the bottom safe-area inset: normally 176px. Its independent width, capped at 480px, preserves button space on a 375px viewport while the canvas scales proportionally to the remaining height.
The game and color-grade canvases share one aligned box. All visible `TouchControls` content, including the aim hint in the left turret footer, remains below the canvas and separate from Fire. Only the transparent turret aim target overlays gameplay, retaining the 714/854 height ratio and its handlers.
Briefing copy names the active profile. Pause has a 44×44 target and accessible name.
Pause/Resume accept a released third finger while movement and Fire remain held, and enforce existing save/recovery locks.

## Browser action matrix

Touch gameplay runs in Chromium mobile/touch emulation at **480×854**; six layout cases also check **375×667**. Pointer rows run at **1280×900**.
The final complete result is **62 passed**, with retries disabled: 12 keyboard/fixture, 25 pointer and 25 touch. All 59 route receipts match the code SHA; three fixture rows correctly have no receipt.

| Route / entry | Fixture and input | Proof |
| --- | --- | --- |
| DevPanel → six profile screens | `freshLegacy`; native touch | At 480×854 and 375×667, targets are visible, at least 44×44, in bounds and non-overlapping; action buttons and the visible turret hint sit below the whole canvas. The hint is in bounds and separate from Fire; game/grade boxes and turret aim dimensions align. Screenshots attach at 480×854. |
| DevPanel → campaign briefing | `freshLegacy`; touch | Move/Fire/Bomb copy appears before skip; the removed two-finger bomb instruction is absent. |
| Campaign, planet and Galaxy operation → shooter | Campaign: DevPanel 1-1 / `freshLegacy`; planet: DevPanel Ashfall / `allPlanetsLaunchable`; Galaxy: Continue Galaxy → Launch Operation / `galaxyAtAshfall` | Four movement directions do not fire/bomb. Move+Fire coexist; releasing movement preserves fresh fire. Bomb alone spends exactly one bomb without firing. |
| Campaign → canvas drag + pad | `freshLegacy`; simultaneous native touches | Drag controls position without fire/bomb; releasing drag restores the held pad. Moving outside the pad releases its movement. |
| DevPanel → ground | `freshLegacy`; native touches | Move, aim, Jump and Fire stay distinct. Up sends shots above the player; signed tick-consistent three-frame trajectories prove Down. A native relaunch isolates the compound aiming leg. Three fingers coexist; partial release preserves fresh fire and cancellation stops it. |
| DevPanel → boarding, with relaunches between legs | `freshLegacy`; native touches | All eight directions move without fire/dash. Stationary fire retains diagonal aim. Moving dash and Fire coexist; cancelling all three controls stops movement and fresh firing/dashing. |
| DevPanel → first-person | `freshLegacy`; native touches | Forward/back and strafe translate without looking/firing. Look rotates in place. Fire remains active through a fresh firing cycle after movement/look fingers lift. |
| DevPanel DAY → exterior → solar interior → exterior | `freshLegacy` plus shipped DAY seed; native touches | Touch movement reaches the real door; Interact enters without firing or bouncing. Interior movement works, and fresh interaction returns to the exterior. |
| DevPanel → turret | `freshLegacy`; native touches | Aim uses the 714px gameplay height and never fires. Fire does not reposition aim. Aim drags while Fire remains held; partial release preserves fresh fire, then cancellation stops it. |
| Ground → cancel/blur → Pause/Resume → first-person | `freshLegacy`; native touches, simulated blur, mouse DevPanel mode switch | Native cancellation produces pointercancel. Blur/pause/mode changes clear owners; moving old fingers cannot rearm them. A fresh touch works. |
| Ground buttons → turret focus | `freshLegacy`; pointer/keyboard | Jump/Fire retain their named action under held keyboard/mouse activation. Focused turret arrows continue from the current crosshair without firing and release on blur. |
| B1 input regressions | `freshLegacy`; keyboard/native touch | Space remains ground Jump; fire aliases survive partial release. Touch cancellation preserves independent keyboard fire; final keyboard release stops it. |
| Galaxy operation → paused Resume hold → failed retreat → Resume release | `galaxyWithLegacyProgression(galaxyAtAshfall)`; hybrid input | Native Resume release cannot bypass the failed-save lock. PAUSED/error remain visible; canonical save bytes, pending receipt and write observations remain unchanged. |
| Projectile observer contract | Pure `@fixture` harness row; no application launch | Valid unequal 10/20/30px steps are accepted; stationary, wrong-direction, lateral, non-tick and over-three-tick sequences are rejected. This row emits no route receipt. |

The Resume row uses pointer navigation and Enter to establish the paused operation, native touchStart on Resume, a mouse retreat click and native touchEnd on the original Resume target. It is a hybrid boundary regression, not touch-only navigation.

## How the observations work

The probe records canvas drawing arguments for player positions, projectiles, firing animation, crosshair and minimap, forwarding every draw unchanged.
It records native events and visible control state without injecting game state, replacing simulation functions or accelerating the clock.
Persisted-save fixtures and shipped DevPanel entries establish routes. The Resume regression additionally uses the existing write-failure probe to induce a failed commit.

Chromium input dispatch uses stable finger IDs. Partial release sends `touchEnd` for the removed ID; omitting it from `touchMove` does not release it.
Three-contact `touchCancel` checks simultaneous cancellation. Fresh-fire proof requires an empty-to-occupied muzzle region or off-to-on firing animation; old projectiles do not count.
Ground sampling retains scenery and projectile frames through player blinking, including empty projectile frames. The Down observer polls for an actual signed three-frame trajectory; each interval must independently advance by one to three integer 10px engine steps.
Blur/visibility are simulated event boundaries, not a live operating-system app switch.

The ground pause leg relaunches through native DevPanel taps, holds Left+Fire near the entrance, then moves the old finger Right after resume.
It requires idle sprites, no new fire and at most one pixel of existing camera easing; idle-sprite checks expose leaked Left even if wall collision hides displacement.
After the old contacts release, a fresh Right touch must move. Failure-only frame/event/control attachments preserve future diagnostics.

## Development evidence and retained failures

| Evidence | Result / interpretation |
| --- | --- |
| `profile-red.log`; three `engine-red-*.log` files | Missing controls on all six presentations; turret forwarding, ground aim and boarding diagonal failures reproduced. |
| `engine-green.log`; `precommit-unit.log` | 48 focused tests passed; 765 aggregate passed: 473 engine + 288 Colony + 4 sprite. |
| `cancel-stable-release.log` | Four B1 browser regressions passed after making global keyup release stable across frame renders. |
| `briefing-red.log`; `turret-focus-red.log` | Stale gesture copy and focused-crosshair jump reproduced; copy and directional-source ownership corrected. |
| `gameplay-strengthened.log` | 16 passed, three failed. Later individual reruns resolve the identified rows; this file remains a failed suite. |
| `colony-scene-trace.log`; `scene-loop-green.log` | An old exterior frame overwrote the live interior. State commits now leave scheduling to the new effect; zero-tick callbacks self-schedule. Colony/lifecycle passed in the rerun, which still contains an older boarding failure. |
| `boarding-final-green.log` | Boarding passed after real relaunches isolated the direction, combat and entry-bay cancellation legs from walls and normal death/respawn. |
| `precommit-browser.log` | First full matrix: 55 passed, five failed. Four outcome tests used the former Pause symbol; two selector changes preserve all terminal/save assertions. The fifth was the ground lifecycle position jump. |
| `resume-lock-red.log`; `resume-lock-green.log` | RED lost PAUSED after the old Resume contact released through a failed-save overlay. The touch-end guard now matches click capture, including the ending exception; GREEN passed in 2.3s with save/pending/write checks. |
| `lifecycle-trace.log`; `lifecycle-isolated-green.log` | Three unchanged diagnostic reruns passed. The isolated, stronger lifecycle test then passed in 8.9s. |
| `code-gates.json` / code `6440acc4c087dbc47dce2efe79b7493d9e5d4979` | Exact TypeScript and 765 units passed; browser finished 60 passed / one ground-trajectory failure. The runner stopped before both builds. This code gate remains **FAIL**. |
| `footer-code-gates.json` / prior code `9822d726c6fa556d3fb2fa55ba9f2de7c1c8f45a` | TypeScript/engine passed; the Node 23 sprite worker stalled and was terminated by the conductor. No assertion failure was observed. The record remains **FAIL**; later browser/build gates were not reached. |
| `footer-red.log`; `footer-gameplay-green.log` | New separation/alignment assertions failed on all six profiles, then passed at 480×854 and 375×667. The corrected B2 file passed all 20 cases: one fixture, two pointer and 17 touch, including Ground, Colony and lifecycle. |
| `projectile-observer-red.log` | Reproduced rejected valid unequal steps and wrongly accepted 11px motion. The corrected pure fixture passes with the B2 file. This repairs observation, without engine/clock/health changes. |
| Prior code `9822d726c6fa556d3fb2fa55ba9f2de7c1c8f45a` / evidence `c024680f185a0e0a1383009552a3bcf1ea0fc13f` | Both `node20-*` automated gate and receipt records PASS. Fresh specification review nevertheless returned FAIL/P2: the opaque turret hint covered KILLS. Quality review was not started. `superseded-c024680-spec-review.md` and `superseded-c024680-manifest.json` retain that rejection. |
| `aim-hint-red.log`; `aim-hint-green.log` | RED: hint y12.796875 was above canvas end y677.203125. Moving only the visible hint to the left turret footer passes four targeted tests plus TypeScript; existing profile assertions now check hint bounds and separation from canvas/Fire at both required sizes. Aim geometry/handlers are unchanged. |

The ground failure was a 196.8px jump; its screenshot showed two lives and full HP, consistent with a respawn from the initial three-life attempt. Exact timing remains unproven because that run lacked frame attachments. Test isolation changes no runtime, combat, health, camera or invincibility behavior.
Early React border warnings and the framework development badge intercepted controls; consistent border properties and disabling that badge resolve those obstructions while retaining the game's DevPanel.
Interim test review strengthened fresh-fire checks, signed aim, all movement directions, cancellation and native route entry. Interim review verdicts do not replace final evidence-SHA reviews.
Visual review found a P2 obstruction of HUD/dialogue by the original overlays. The reconciled footer separates controls from the whole canvas; [footer-visual-review.md](/Users/nichalasbarnes/.codex/visualizations/2026/09/05/01a07127-3e6a-7ae1-b54b-436d683ef1c1/sector-zero-b2-evidence/footer-visual-review.md) confirmed bottom-dashboard/hull and Ground-avatar clearance in four inspected 480×854 screenshots; it did not cover the later top-left KILLS obstruction. The conductor-inspected corrected Turret PNG now shows WAVE/KILLS and the hint at bottom-left, separate from Fire. At 375×667, geometry passed but screenshots were not independently inspected.
The exact ground-trajectory failure sequence was not retained. Unsupported equal-step/maximum-distance assumptions and dropped blink frames were reproduced separately; the receipt does not claim they establish that failure's exact timing. The live compound leg now polls actual trajectories after a native Ground relaunch, with no runtime or health mutation.
`footer-node23-sprite-hang.sample.txt` shows the stalled worker waiting in a V8 task-queue drain. Four sprite tests pass under explicit Node 20.20.1, matching CI's Node 20 major. The observed wait and successful alternate-runtime check do not establish the stall's root cause.
Full diagnosis history is retained in [review-history.md](/Users/nichalasbarnes/.codex/visualizations/2026/09/05/01a07127-3e6a-7ae1-b54b-436d683ef1c1/sector-zero-b2-evidence/review-history.md).

## Exact-checkpoint results

The current Node 20.20.1 code PASS is `aim-hint-code-gates.json`, with `aim-hint-code-receipt-verification.json` proving all receipt identities. Post-evidence gates use `aim-hint-evidence-gates.json`. Preserve the prior `node20-*` automated PASS records and rejected evidence review/manifest, plus both earlier `code-gates.json` and `footer-code-gates.json` FAIL records.
Prefix gate commands with `PATH=/Users/nichalasbarnes/.nvm/versions/node/v20.20.1/bin:$PATH COREPACK_ENABLE_AUTO_PIN=0 COREPACK_ENABLE_PROJECT_SPEC=0` to reproduce the environment.

| Required gate | Exact clean-code result |
| --- | --- |
| Clean-code TypeScript and unit suites under Node 20.20.1 | PASS: TypeScript and 765 units (473 engine + 288 Colony + 4 sprite) |
| Complete Chromium matrix, retries disabled; exact receipt identities | PASS: 62, with 59 exact-SHA route receipts and three fixture rows; zero retries |
| Empty-base and `/sector-zero` production exports | PASS |
| Ownership/diff checks and clean state before/after gates | PASS: 19 owned cumulative files; clean before/after every gate |
| Separate evidence commit, its exact gates and sequential fresh reviews | External matching PASS manifest required |

## Limits

These are Chromium emulated-touch samples, not physical-device acceptance or completed playthroughs of every route.
The 375×667 proof is geometry-only. A smaller canvas also makes existing low-contrast copy smaller; physical safe areas, browser chrome and sustained legibility remain unproven.
Several routes use the shipped DevPanel; the lifecycle switch and Resume regression disclose hybrid input.
Galaxy physical Colony return is still unavailable; exterior/interior traversal does not establish it.
All-ten planet launch/live play, full authored POI delivery and whole-game device acceptance remain F1.
B3 owns general modal focus/navigation provenance. M3 assets remain untouched and `ASSET_ACCEPTED_REF` unset.
Residual risk: the original ground failures' exact timing and physical-device legibility remain unproven; acceptance still depends on the matching exact-checkpoint gate/review manifest.

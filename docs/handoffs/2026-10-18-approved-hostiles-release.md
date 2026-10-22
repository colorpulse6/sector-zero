# Approved enemy family and mission completion release

Owner: Codex. Design decision: Nic approved all three HTML concepts on 2026-10-18.
User authorized merging to main and deploying game and companion site after verification.

## Delivered scope

- Approved grunt, charger and sentry PNGs are used by live first-person encounters. Their original aspect ratios and alpha-measured contact lines drive floor-anchored billboards. Existing map depth and lighting apply. Health bars use the exact rendered pose, including fallbacks, to stay above the head. The first runtime version is front-facing, with deterministic movement, attack, recoil and death deformation; directional animation sheets remain unfinished.
- Scene residency requests only the three required type images (about 18 MiB decoded for the full family) rather than the old 35.5 MiB shared atlas bundle. Old static fallback art remains available while loading or after a source failure.
- Kepler and Cinder Relay inherited an unreachable lower objective loop. A door at (12,14) connects it to the main route. The guard at (14,14), inside a wall, now occupies floor at (14,15). Another guard was on disconnected floor; connecting the route fixes its access too.
- The objective tile remains a goal on Kepler replay, when the already-collected black box is absent. First clears still require Interact; walking onto that tile cannot bypass a live pickup.
- The review dashboard records approval, preserving its visual design. README, roadmap, enemy production notes and the site FPS article reflect the integration boundary. The site includes a real station capture.

## Verification before push

- TypeScript passed. Game and companion-site static exports passed.
- 1,045 unit/asset tests passed before the health-overlay follow-up; its focused regression also passes. The initial audit failed 17 of 18 mission cases before the map fix; all 18 pass afterward.
- Completion cases cover Kepler first clear/replay, Cinder Relay, Oathbreaker and Glassknife across five seeds, and the campaign station. Tests walk the computed route through real movement/collision updates, use Interact, and execute the completion-screen transition. Invincibility isolates navigation from combat difficulty; this is not a balance claim.
- Four graphics browser acceptance tests passed, covering all inspection scenes, bounded image residency, fallback recovery, dialogue freeze, and actual combat states. The tightened clear-view combat test passed again.
- Nine site browser checks passed with Node 20 and polling. The initial local site attempt hit macOS file-watcher exhaustion and timed out before running tests.
- Full-resolution map captures are in `docs/assets/fps-enemy/captures/approved/`. Inspected grunt, charger and sentry. Cinder renderer sample: approximately 4.6 ms median / 4.7 ms p95 on this Mac at full resolution; this is a local renderer sample, not a cross-device performance guarantee.

## Release gate and remaining work

Release completed after the original handoff: PR #25 merged to main at `dc35da283c7dc9873b37ecab0903582ffcc04c26`. All seven checks passed on feature head `a7142c4714576a182b3558d88ea2a9d8d2d5d7c6`, including 122 game browser tests and nine site browser tests. Final local unit/asset count: 1,046 passing. Deployment [39163042227](https://github.com/colorpulse6/sector-zero/actions/runs/39163042227) succeeded for the main merge commit. Live game canvas, all three approved PNG hashes, the graphics preview, site homepage and updated article were verified with no observed page errors or failed HTTP responses. Nic authorized the one-release admin merge after all checks passed; branch protection was unchanged. This does not authorize future review overrides.

Next art owner: designer, coordinated by Codex. Finish consistent directional views and real animation frames without changing the approved family identity. Codex verifies one complete enemy in maps before extending that animation production pass.

Next gameplay milestone remains the already-recorded Ashfall recovery/pacing work. This release fixes unreachable mission objectives; it does not claim to resolve all settlement economy failure recovery or finish Ashfall.

Automatic approval review blocked an auto-routed map worker because repository sharing to the router's possible providers exceeded the approved Claude designer scope. No worker ran; Codex implemented and checked the bounded changes locally.

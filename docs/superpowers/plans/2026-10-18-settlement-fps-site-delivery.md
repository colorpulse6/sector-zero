# Settlement, FPS interaction and site delivery plan

User authorization: implement/delegate the basic settlement loop, improve FPS enemy assets,
add pickup interaction controls, update the site/README for the simplified direction and
push promptly. Manager integrates on feat/galaxy-colony; no main merge or deploy.

## Independent deliverables

- Colony Claude: isolated feat/ashfall-settlement-loop. Expose the five basic buildings,
  prove growth from zero and resource/power/construction/persistence behavior. Own colony
  systems and tests. Full commerce and broad civilization are later work.
- Ashfall Designer Claude: isolated design/fps-enemy-refresh. Inspect actual runtime,
  improve enemy assets/presentation using existing gritty sci-fi direction. Own sprite and
  actor files, not firstPersonEngine/Renderer or input/UI. Compare actual gameplay captures.
- Manager: site/README copy preserves design and historical URLs, focuses on travel,
  settlements and retained combat modes, clearly distinguishes playable foundations from
  unfinished systems. Build and existing site browser suite before first push.
- Manager: E/Interact is a distinct FPS action, with a touch button and a nearby pickup
  prompt. No walk-over auto-collection. A fresh press, range, facing and line of sight are
  required; shared target logic drives prompt and pickup. Z/Space remain fire and retain
  legacy dialogue compatibility. Colony controls unchanged. Existing outcome authority
  continues to award rewards; interaction must not bypass or duplicate it.

## Execution and verification

1. Update site current-mode cards, home/about/colony copy, metadata and README. Keep
   historical development articles reachable and label removed-mode articles historical.
   Run static build and existing site browser checks; push this coherent first increment.
2. Add failing engine/input tests for explicit pickup, LOS, held-input and single claim.
   Implement in inputIntents/types, firstPersonInteraction helper, engine/renderer,
   TouchControls and control hints. Update affected browser expectations and verify
   keyboard/touch pickup in browser.
3. Review worker handbacks and integrate exact commits without unrelated work. Use one
   combined independent source review for the meaningful gameplay milestone; Manager
   handles focused fixes and verifies resulting behavior.
4. Run affected tests, final broad unit/type/build checks and browser routes. Update the
   roadmap and evidence handoff, push, create/update the PR and inspect CI. Retain local
   test-save supplies; do not overwrite the user's save or rebuild an active preview
   until the new export is ready.

Success is the scoped working increment, not an Ashfall world lock. Human aesthetic
acceptance and the full ordinary recovery/trade/return route remain explicit gates.

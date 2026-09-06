# A3 outcome ownership receipt — 2026-09-05

Tested code: `b85fb3d381ae28f00c2559f351c0979129c655e6` on `codex/a3-resume`.

Evidence directory: `/Users/nichalasbarnes/.codex/visualizations/2026/09/05/01a07127-3e6a-7ae1-b54b-436d683ef1c1/sector-zero-a3-evidence`.

The clean code run passed 425 engine, 288 Colony, 4 sprite, and 37 browser tests, TypeScript, and both production exports. Browser results include zero failures, skips, or flaky retries. `code-browser.json` retains 35 route receipts tagged with the tested code SHA; the two other tests are fixture checks. `gate-manifest.json` records the separate evidence commit's final gate/review verdict.

## Browser proof

| Scenario | Input/fixture | Observed result |
| --- | --- | --- |
| Galaxy operation retreat save and acknowledgement failures | Pointer, real Ashfall launch, canonical Galaxy + populated Legacy save | Same outcome ID through commit retry; Atlas mounted before acknowledgement; hidden RESUME blocked; pending receipt restored across reload; acknowledgement retry closes it once. |
| Stale operation outcome | Pointer, real launched operation; another canonical write before retreat | Conflict preserves the newer revision, Legacy credits, and Galaxy cycle through reload; no failed outcome is inserted. |
| Galaxy POI pending return | Pointer, durable coordinator receipt for Ashfall relay | Exact Ashfall Region/origin mounts before acknowledgement; focused Region Escape cannot dismiss it; retry closes the same receipt and preserves Legacy bytes. |
| Legacy planet gameplay retry | Pointer/keyboard, real Ossuary defense failure | TRY AGAIN mounts the briefing and actual mission; a later retreat has a new outcome ID and the same planet identity. |
| Pending Legacy planet return | Keyboard, valid planet receipt | Cockpit mounts; Escape cannot leave while acknowledgement fails; retry closes the receipt. |
| Campaign, special, Colony, Legacy POI pending returns | Pointer, valid receipts built through public coordinator APIs | Each owned surface mounts before failed acknowledgement; retry and a second reload preserve domain bytes and journal identity without replaying effects. |
| Final campaign success | Shipped developer launch/combat controls, actual final boss defeated by projectiles | Initial injected write failure stays visible until explicit retry; same outcome ID; ending remains pending through choice/credits, then acknowledges exactly once. No browser errors. |
| Failed Galaxy operation | Pointer/keyboard, real Ashfall combat failure | No unavailable TRY AGAIN action; ATLAS journals one root/nested/operation ID, acknowledges after mount, and remains unavailable after reload. Legacy bytes are unchanged. |
| Galaxy Region back and Atlas close | Pointer, populated canonical Legacy progression | Returns through Atlas to the experience selector; retains Galaxy authority and identical serialized Legacy fields across reload. |
| Travel commit, resume, finalize, emergency retreat | Pointer, deterministic valid travel fixtures and one failed storage write per boundary | Canonical bytes unchanged on failure; Escape blocked; exact candidate/transaction reused on retry; correct state and Legacy bytes survive reload. |
| Stale travel retry | Pointer, failed candidate followed by another canonical write | Reload-only conflict preserves the newer complete save; no overwrite or duplicate transaction. |
| Existing H0/A1/A2 route matrix | Keyboard, pointer, real touchscreen | Existing selector, Mission Board, Kepler policy, and operation launch checks remain green. |

Pending return recovery covers campaign, planet, special, operation, Colony, and POI classes. Fixtures install serializable saves before hydration; they do not mutate runtime game state. Combat samples use authored simulation and ordinary input; the ending sample also uses the shipped developer controls to reach the final encounter.

## Regression evidence

The `development/` subtree retains baseline/focused logs and expected assertion failures. Meaningful RED observations included: retry leaving the cockpit mounted, global and Region Escape dismissing pending returns, focused RESUME bypassing an overlay, and the unavailable operation retry control. The ending diagnostic under `sector-zero-a3-ending-repeat-submit-red/` recorded two writes for one outcome before any manual retry (first failed, second successful). The final guarded ending test passes.

The 15 added canonical-transition tests cover exact base/candidate equality, property order, detached snapshots, unreadable/throwing stores, same-ID drift, post-write throws, and Galaxy travel and Legacy POI preparation candidates. Focused green coverage is retained in `development/updated-focused-node.log`; the full current coverage is in `code-engine.log`.

Early runs with invalid fixture-derived pilot/codex fields, a wrong failure envelope, or an assertion made before dismissing the retry briefing were corrected at the fixture/input boundary. Those failures are not reported as product defects. The raw byte-preservation assertions remain intact.

## Reproduce

Run from `game/` with the installed immutable lockfile. Use `COREPACK_ENABLE_AUTO_PIN=0 COREPACK_ENABLE_PROJECT_SPEC=0` with Yarn so Corepack does not alter the root package manifest.

```sh
./node_modules/.bin/tsc --noEmit --incremental false
node --import tsx --test tests/engine/*.test.ts
node --import tsx --test tests/colony/*.test.ts tests/sprites/*.test.ts
COREPACK_ENABLE_AUTO_PIN=0 COREPACK_ENABLE_PROJECT_SPEC=0 yarn playwright test --workers=1 --retries=0
NODE_ENV=production NEXT_PUBLIC_BASE_PATH='' COREPACK_ENABLE_AUTO_PIN=0 COREPACK_ENABLE_PROJECT_SPEC=0 yarn build
NODE_ENV=production NEXT_PUBLIC_BASE_PATH=/sector-zero COREPACK_ENABLE_AUTO_PIN=0 COREPACK_ENABLE_PROJECT_SPEC=0 yarn build
```

For durable browser receipts, set `TESTED_CODE_SHA`, `PLAYWRIGHT_OUTPUT_DIR`, and `PLAYWRIGHT_JSON_OUTPUT_NAME`, and use `--reporter=list,json`. Serialize browser runs and builds because they share `.next`.

## Limits

This receipt proves A3 persistence, reconciliation, return mounting, and reload behavior on the recovered stack. It does not prove a complete live POI success/preparation/delivery playthrough or the full all-route/device matrix; those remain F1 rows. It does not establish compatibility with newer `main`, M3 asset acceptance, a site build, or a deployed release. See the [continuation handoff](../handoffs/2026-09-05-a3-outcome-checkpoint.md).

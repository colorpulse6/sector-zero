# Colony region map presentation — 2026-09-06

Tested code: `24a7f8afa94a2aecd0f08a533f9a64b4f375777e` on
`codex/explorable-region-map`, based on `4512f64`.
Game tree: `4983aaa2baa3a9fb3c79977a6ea1324b3ed26733`.
This receipt is a documentation-only follow-up to the tested code.

Evidence directory:
`/Users/nichalasbarnes/.codex/visualizations/2026/09/06/01a075b8-22ab-7c20-bd72-90cae409a084/region-map-evidence`.

## Result

The colony's local destinations now occupy the same coordinate space as their real
routes. An abstract contour backdrop, distinct landmark symbols, an origin marker,
and a compact selected-destination card replace the vertical text-card presentation.
Detailed site statistics and connections are optional. Galaxy Atlas, the legacy
level map, colony rendering, save schemas, and expedition reducers are unchanged.

| Gate | Result | Evidence |
| --- | --- | --- |
| Region unit coverage | 23 passed | Focused region suites; includes dynamic founded origin, fog and disabled callbacks. |
| All engine, colony and sprite units | 834 passed, zero failures | `committed-units.log`, run on the tested commit. |
| Region, navigation focus and Galaxy persistence browser rows | 30 passed, zero retries | `browser-final.log`; 18 navigation, 6 persistence and 6 region checks. |
| Region browser receipt rerun | 6 passed, zero failures, skips or flaky retries | `committed-browser-report.json`, tagged with the tested code SHA. |
| TypeScript | Passed | Standalone check and both Next production build checks. |
| Root-path static export | Passed | `build-root.log`. |
| `/sector-zero` static export | Passed | `build-pages.log`. |
| Independent source review | No remaining findings | Final review of `24a7f8a`; reviewer did not launch concurrent browsers or builds. |

The 30-row browser run used the final production code. After that run, only screenshot
retention and receipt placement changed in the new browser spec; its six rows were
rerun on the committed code. Receipts for encounter launches are attached only after
the launch assertions pass.

## Browser and visual coverage

- DOM landmark centers and transformed SVG route endpoints match within one pixel.
  Landmark targets are at least 44px, with no label/target collisions or horizontal
  overflow at 390px and 480px after longer destination names are discovered.
- Pointer/touch selection preserves serialized saves. Unknown signals do not expose
  names, types, encounter details or site statistics. Rumored site statistics remain
  absent even when details are expanded; non-frontier unknown nodes and edges are
  omitted.
- Up/Down navigation keeps a roving option tab stop. Enter/Z focuses the separate
  action without spending a cycle. Native Space confirms survey; disclosure summaries
  participate in forward and reverse Tab order. Escape restores the correct invoker.
- Survey spends one cycle and persists across reload. Explicit Cinder Relay travel
  opens first-person controls; Oathbreaker travel opens boarding controls. Legacy
  save bytes remain unchanged in the Galaxy route tests.
- Existing navigation/persistence rows retain cockpit, landing-pad and Atlas return
  provenance, legacy level-map input behavior, and failed-save retry/conflict checks.
- Desktop and mobile screenshots were visually inspected. `region-desktop.png` and
  `region-mobile.png` are retained beside the logs; original images and six receipts
  are under `committed-browser/` and the JSON report.
- The built `/sector-zero/` export was also opened through the in-app browser using
  the existing local development-seeded save. The colony view-only map rendered its
  scoped styles, selected Cinder Relay correctly, and expanded connected-site intel.

## Failure evidence and correction

The new unit assertions initially produced eight expected failures against the old
presentation. The first six-row browser run then found a real 390px collision: a fixed
105px Basalt label box overlapped the Cinder marker. Using intrinsic label width with
a maximum width removed the invisible overlap without changing saved coordinates.
The failing screenshot remains in `browser/`; the corrected mobile row and the
complete 30-row run both passed with zero retries.

## Reproduce

Use Node 20 from `game/`. Serialize browser runs and builds because they share `.next`.
For retained receipts, set `TESTED_CODE_SHA`, `PLAYWRIGHT_OUTPUT_DIR`, and
`PLAYWRIGHT_JSON_OUTPUT_NAME`, adding `--reporter=list,json`.

```sh
./node_modules/.bin/tsx --test tests/colony/regionMap*.test.ts
./node_modules/.bin/tsx --test tests/engine/*.test.ts tests/colony/*.test.ts tests/sprites/*.test.ts
./node_modules/.bin/tsc --noEmit
COREPACK_ENABLE_PROJECT_SPEC=0 PLAYWRIGHT_TEST_PORT=3107 ./node_modules/.bin/playwright test tests/browser/regionMapPresentation.spec.ts tests/browser/navigationFocus.spec.ts tests/browser/galaxyPersistence.spec.ts --workers=1 --retries=0 --trace=retain-on-failure
NEXT_PUBLIC_BASE_PATH='' ./node_modules/.bin/next build
NEXT_PUBLIC_BASE_PATH=/sector-zero ./node_modules/.bin/next build
```

## Limits

Mobile evidence uses Chromium touch emulation and reduced-motion settings, not a
physical device. Encounter checks establish correct launch, not full combat completion.
The entire game/site browser matrix was not repeated locally; PR CI owns that broader
run. These results do not claim a merged or deployed release.

# Planet Integrity Receipt — 2026-07-19

## Candidate

- Package: A1 — planet mission terminal and render integrity
- Branch: `fix/sync-planet-integrity`
- Accepted harness base: `4422be8b3d014baa6a7038fe0b8ec0ab94095b7e`
- Tested code SHA: `eb7926e566e921bd79f7ede499238ba3770f1ca3`
- Asset boundary: no M3 asset, asset-validation, roadmap, prompt, or active asset-worktree file changed

## Test-first evidence

### Defend terminal red

The first focused test described the selected terminal rule: after the final
authored wave, no remaining enemy or boss, and a living protected structure,
the objective completes. Against the accepted harness base the test ran 0/1
and failed because `completed` remained `false`.

The implementation adds a named `ObjectiveEncounterContext` rather than a
positional flag. `gameEngine.ts` supplies whether every authored wave has
spawned and whether a live boss remains. The defend objective resolves ramming
damage first, fails at zero HP, and completes only when the living structure has
no threats after that same update.

The green table covers:

- final wave + no enemy/boss + living structure -> complete;
- earlier wave, remaining enemy, or live boss -> still active;
- zero HP -> failed, never completed;
- last ramming enemy at two HP -> one HP and complete;
- last ramming enemy at one HP -> zero HP and failed;
- all ten authored planet definitions and all four objective kinds reach the
  engine's level-complete transition;
- survive missions continue looping their authored combat waves until the timer
  expires.

### Planet composition reds

Recording-canvas tests were added one layer at a time and failed against the
base because the active renderer did not dispatch `planetRenderer.ts`:

1. the planet objective HUD was absent;
2. collect, escort, and defend actors were absent;
3. live damaging hazard geometry was absent for every planet;
4. the active frame had no planet-background composition stage.

The connected composition is now:

```text
planet palette/background
  -> common combat and player
  -> objective actor
  -> live planet hazard
  -> common particles/explosions/labels
  -> near parallax and atmosphere
  -> objective and operation identity
  -> dashboard
```

The recording canvas asserts that exact order, every objective actor, every
planet's live hazard geometry, the generic non-planet fallback, and Ashfall's
planet palette plus `SURVIVE` and `ASHFALL SORTIE` identity.

### Loaded-sprite tiling red

Cold review exercised the authored background path rather than the procedural
fallback and found that 1024x1536 source sprites were scaled to the playfield
but positioned and wrapped using the 1536-pixel source height. The added fake-
image recording test failed with the intended live defect:

```text
far layer leaves a gap before y=714
```

Planet layers now compute their destination height from the canvas-width scale
and repeat in that same destination coordinate space. The green test loads far,
mid, and near layers, advances to a frame that previously left the canvas
unpainted, and proves contiguous coverage through the full 854-pixel canvas.
The procedural fallback also fills the full canvas, so the briefing's bottom
band is painted before its early return.

## Real-surface browser proof

The tests install only migrated persisted saves before hydration. They use the
shipped experience choices, cockpit canvas hotspot, Galaxy Atlas controls, and
native Playwright pointer/touch events. No browser test-only state mutation API
was added.

| Project / viewport | Route | Observed |
| --- | --- | --- |
| `desktop-pointer` / 1280x900 | Legacy -> cockpit -> Mission Board | Real hotspot opened the Mission Board; backing-canvas sampling confirmed the active Side Quests tab; screenshot shows the Planet Missions tab and badge for ten launchable missions |
| `mobile-touch` / 480x854 | Legacy -> cockpit -> Mission Board | Native touchscreen tap opened the same legible three-tab surface |
| `desktop-pointer` / 1280x900 | Galaxy Atlas -> Ashfall -> Launch Operation -> Enter skip | Atlas identified `SECURE THE ASHFALL DISTRESS ZONE`; read-only canvas instrumentation then observed `ASHFALL SORTIE`, the shipped Enter transition to `SURVIVE`, and the authored `ashfall-far.png` layer |

Each row emits a structured JSON Playwright receipt and a canvas screenshot.

## Browser acceptance boundary

A1 does **not** claim all ten planets were launched or live-played through every
input method. The real route exposed a pre-existing cockpit input-authority
defect outside this package's owned files:

- held keyboard input can visibly advance Mission Board tabs, then the cockpit
  requestAnimationFrame loop can restore stale tab state on key release;
- pointer and touch handling inside cockpit sub-screens only implements the
  top-left Back action, so it cannot activate tabs or mission rows.

Repeated real-input attempts could not produce a deterministic Planet Missions
launch without changing `Game.tsx` or adding a test-only hook. That limitation
is preserved for the later semantic input/navigation package. The exhaustive
10/10 terminal proof is therefore at the engine boundary, while current browser
proof is honest route entry, legibility, and Ashfall operation launch. This is a
remaining release gap, not accepted interaction behavior.

The renderer still consumes the engine's existing module-global hazard state.
The planet ID guard prevents a mismatched singleton from drawing, but constructing
multiple states back-to-back can leave the earlier state without its hazards.
Moving hazards into `GameState` or an explicit render input requires the shared
state ownership used by the next launch-context package; it remains a recorded
architecture risk and is not claimed fixed here.

## Exact-code-SHA gates

All commands ran from `game/` at tested code SHA
`eb7926e566e921bd79f7ede499238ba3770f1ca3`.

| Gate | Result |
| --- | --- |
| `node --import tsx --test tests/engine/planetMissions.test.ts tests/engine/planetRendering.test.ts` | 13/13 passed |
| `yarn playwright test tests/browser/planetRoutes.spec.ts` | 3/3 passed across desktop pointer and mobile touch |
| `TESTED_CODE_SHA=eb7926e5... yarn browser:test` | 8/8 passed across desktop keyboard, desktop pointer, and mobile touch; structured receipts name the tested code SHA |
| `npx tsc --noEmit` | Passed, exit 0 |
| `yarn engine:test` | 295/295 passed |
| `yarn colony:test` | 284/284 passed |
| `yarn sprites:test` | 4/4 passed |
| `COREPACK_ENABLE_PROJECT_SPEC=0 yarn build` | Compiled; generated 6/6 static pages; exported 3/3 |
| `NODE_ENV=production NEXT_PUBLIC_BASE_PATH=/sector-zero COREPACK_ENABLE_PROJECT_SPEC=0 yarn build` | Compiled; generated 6/6 static pages; exported 3/3 |

Final clean-tree checks are recorded on the evidence commit after this receipt
is added. Remote GitHub Actions are not claimed because this isolated branch
has not been pushed.

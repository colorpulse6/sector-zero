# M1 The Region Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for every behavior slice and superpowers:verification-before-completion before each commit and handoff. Execute inline in the isolated `feat/m1-region` worktree.

**Goal:** Ship the Ashfall region loop: leave a colony pad, survey a deterministic node graph, clear one POI in each reused engine, route one-time cargo home, and found resource-gated outposts whose site stats matter to the simulation.

**Architecture:** Persist compact deterministic region state (`seed`, node intel, site stats, claimed/cleared state) in `SaveData.planets`; reconstruct engine sessions from the node seed. When a colony is founded, copy the node's immutable `siteStats` onto `ColonyState` as the simulation snapshot; node stats never mutate, and an invariant/test guarantees the claimed colony snapshot matches its source node. A React/DOM `RegionMapScreen` owns presentation, while pure region/POI modules own generation, navigation, survey/founding rules, dispatch, and outcome folding. `Game.tsx` remains the orchestration seam for switching React/canvas surfaces and advancing world cycles.

**Tech Stack:** Next.js 15 static export, React 19, strict TypeScript, Canvas 2D engine sessions, Node `tsx --test` flat test files.

**Decisions carried from the accepted specs:**

- Every region expedition starts with travel from a claimed colony node to an eligible adjacent node and advances one world cycle. Surveying on arrival is part of that expedition, not a second tick. Completing a POI remains a mission completion and advances one additional cycle.
- The initial Ashfall operation is a bootstrap colony with no free stockpile; every later outpost costs `300 metal + 50 food + 50 water` from its origin colony.
- Cockpit access is view-only. Travel, survey, and founding remain landing-pad-gated.
- POI completion opens an outcome screen where the player chooses a valid destination colony; confirmation routes cargo through the existing `mission_delivery` event path. A cleared POI remains replayable but pays its resource reward once.
- Existing sprites/environment art and tint fallbacks are sufficient; M1 adds no PNGs and does not touch sprite registration or asset scripts.

---

### Task 1: Deterministic region model and save migration

**Files:**
- Create: `game/app/components/colony/region/regionMap.ts`
- Create: `game/tests/colony/regionMap.test.ts`
- Modify: `game/app/components/colony/shared/colonyTypes.ts`
- Modify: `game/app/components/engine/save.ts`
- Modify: `game/tests/colony/saveRoundtrip.test.ts`
- Modify: `game/app/components/colony/index.ts`

- [ ] Write failing tests proving same planet+seed produces the same graph/site stats, different seeds vary generated values, intel ordering is stable, every edge references a real node, and the newer roadmap's typed `wreck` node migrates safely alongside older POI types.
- [ ] Run `npx tsx --test tests/colony/regionMap.test.ts` and confirm failures are for missing region APIs.
- [ ] Implement a pure seeded generator with no `Math.random`, `Date`, `window`, or `document`; Ashfall contains a claimed/bootstrappable anchor, three engine POIs, two candidate sites, and connected edges.
- [ ] Write failing migration tests for legacy nodes (`discovered`/`cleared`) and legacy colonies without site stats.
- [ ] Run `npx tsx --test tests/colony/saveRoundtrip.test.ts` and confirm the new assertions fail.
- [ ] Add field-by-field nested migration defaults and ensure fresh/legacy saves receive the Ashfall region without overwriting current node progress.
- [ ] Run both focused tests, then `npx tsc --noEmit`.
- [ ] Commit: `feat(region): add deterministic Ashfall graph and migration`

### Task 2: Graph-constrained survey expeditions

**Files:**
- Create: `game/app/components/colony/region/siteEconomy.ts`
- Create: `game/tests/colony/siteEconomy.test.ts`
- Modify: `game/app/components/colony/shared/colonyEvents.ts`
- Modify: `game/app/components/colony/shared/colonyReducer.ts`
- Modify: `game/tests/colony/reducer.test.ts`
- Modify: `game/tests/colony/fixtures.ts`

- [ ] Write failing tests for action-specific graph eligibility: actions must originate at a claimed colony node; only adjacent non-unknown nodes are reachable; unknown/non-adjacent/originless requests are rejected; cleared POIs remain travelable for replay but cannot be surveyed or founded.
- [ ] Write failing tests for a survey expedition advancing exactly one cycle while rumored→surveyed and adjacent unknown→rumored; prove survey itself never adds a second tick.
- [ ] Run the focused tests and confirm expected failures.
- [ ] Implement pure navigation/survey helpers and reducer events; keep travel validation outside React so UI and runtime share one authority.
- [ ] Run focused tests plus `yarn colony:test` and `npx tsc --noEmit`.
- [ ] Commit: `feat(region): add graph-constrained survey expeditions`

### Task 3: Resource-gated founding

**Files:**
- Modify: `game/app/components/colony/region/siteEconomy.ts`
- Modify: `game/tests/colony/siteEconomy.test.ts`
- Modify: `game/app/components/colony/shared/colonyEvents.ts`
- Modify: `game/app/components/colony/shared/colonyReducer.ts`
- Modify: `game/app/components/colony/shared/colonyAssert.ts`
- Modify: `game/tests/colony/invariants.test.ts`

- [ ] Write failing tests for surveyed-candidate-only founding, exact affordability, atomic source deduction + target creation + claimed intel, stable node-derived IDs/seeds, and immutable node→colony site-stat snapshotting.
- [ ] Implement atomic pure founding through reducer events; bootstrap remains a separate no-cost operation and can never be used for later sites. Legacy colonies migrate to neutral site stats.
- [ ] Add an invariant/test that every claimed colony's site-stat snapshot equals the deterministic source node; neither copy has a mutation event.
- [ ] Run focused tests plus `yarn colony:test` and `npx tsc --noEmit`.
- [ ] Commit: `feat(colony): found outposts from surveyed sites`

### Task 4: Site-driven production, upkeep, and build slots

**Files:**
- Modify: `game/app/components/colony/region/siteEconomy.ts`
- Modify: `game/tests/colony/siteEconomy.test.ts`
- Modify: `game/app/components/colony/shared/cycleProcessor.ts`
- Modify: `game/app/components/colony/shared/powerGrid.ts`
- Modify: `game/app/components/colony/meta/ColonyCommissionMenu.tsx`
- Modify: `game/app/components/colony/meta/predictedDeltas.ts`
- Modify: `game/tests/colony/cycleProcessor.test.ts`
- Modify: `game/tests/colony/buildMenu.test.ts`
- Modify: `game/tests/colony/predictedDeltas.test.ts`

- [ ] Write failing tests proving ore density scales mine output, low water table raises purifier power demand/upkeep, buildable slots are enforced in reducer and UI helpers, and predicted deltas exactly match `processCycle` modifiers.
- [ ] Implement pure site-stat modifier helpers that read only the immutable `ColonyState.siteStats` snapshot; thread them through production, power demand/brownout, predicted deltas, and building slot limits.
- [ ] Run focused tests plus `yarn colony:test` and `npx tsc --noEmit`.
- [ ] Commit: `feat(colony): apply site stats to outpost economics`

### Task 5: Seeded POI templates and dispatcher

**Files:**
- Create: `game/app/components/colony/region/poiTemplates.ts`
- Create: `game/app/components/colony/region/poiDispatcher.ts`
- Create: `game/tests/colony/poiTemplates.test.ts`
- Create: `game/tests/colony/poiDispatcher.test.ts`
- Modify: `game/app/components/colony/index.ts`

- [ ] Write failing template tests for valid spawn/goal geometry, reachable objectives, and same-seed deep determinism in first-person ruin, boarding wreck, and ground-run canyon instances.
- [ ] Implement and verify each engine template separately, committing only after all three focused tests are green: `feat(region): add deterministic three-engine POI templates`.
- [ ] Write failing dispatcher tests for `ruins→first-person`, `wreck→boarding`, and `cave→ground-run`, plus rejection of colony sites/unknown nodes, enforcement of origin adjacency/intel eligibility, and successful launch of a cleared POI replay.
- [ ] Run `npx tsx --test tests/colony/poiDispatcher.test.ts` and confirm the missing dispatcher failure.
- [ ] Implement the pure dispatcher using the three templates and existing art/tint fallbacks; do not alter engine or renderer defaults.
- [ ] Run focused tests, `yarn engine:test`, and `npx tsc --noEmit`.
- [ ] Commit: `feat(region): dispatch eligible region encounters`

### Task 6: One-time outcomes and destination-selected cargo

**Files:**
- Create: `game/app/components/colony/region/poiOutcomes.ts`
- Create: `game/tests/colony/poiOutcomes.test.ts`
- Modify: `game/app/components/colony/shared/missionDelivery.ts`
- Modify: `game/tests/colony/missionDelivery.test.ts`

- [ ] Write failing tests that first clear marks the node cleared, reveals adjacent unknown nodes, and creates a pending one-time cargo outcome without applying it yet.
- [ ] Write failing tests for destination validation (existing colony required), `mission_delivery` reason, idempotent confirmation, cleared-node replay paying no cargo, and invalid/stale destination rejection.
- [ ] Implement pure outcome creation/folding and generalize `missionDelivery.ts` for an explicit POI payload/destination while retaining planet-mission behavior.
- [ ] Run focused tests plus `yarn colony:test` and `npx tsc --noEmit`.
- [ ] Commit: `feat(region): route one-time POI cargo by destination`

### Task 7: DOM region map and pad/cockpit entry points

**Files:**
- Create: `game/app/components/colony/meta/RegionMapScreen.tsx`
- Create: `game/tests/colony/regionMapScreen.test.ts`
- Modify: `game/app/components/colony/exploration/exitMenu.tsx`
- Modify: `game/app/components/colony/meta/ColoniesScreen.tsx`
- Modify: `game/app/components/colony/meta/index.ts`
- Modify: `game/tests/colony/coloniesScreenSmoke.test.ts`

- [ ] Write SSR smoke tests for unknown/rumored/surveyed/cleared/claimed presentation, hidden unrevealed stats, visible surveyed stats, view-only cockpit mode, and pad-gated graph-eligible action controls.
- [ ] Run the focused tests and confirm failures for the missing DOM screen/actions.
- [ ] Implement the accessible HUD-style node graph with DOM buttons and an SVG edge layer (no canvas); keep `window` access inside effects only.
- [ ] Add `REGION MAP` to the landing-pad menu and a view-only `REGION` affordance to the colony meta screen.
- [ ] Run focused tests and `npx tsc --noEmit`.
- [ ] Commit: `feat(region): add pad-gated DOM region map`

### Task 8: Runtime expedition launch and travel tick

**Files:**
- Modify: `game/app/components/Game.tsx`
- Create: `game/tests/colony/regionFlow.test.ts`
- Modify: `game/app/components/colony/region/poiDispatcher.ts`

- [ ] Write pure orchestration tests proving an eligible survey or POI expedition advances exactly one travel cycle, a cleared replay launches and advances travel normally, double-click/re-render duplicates are rejected, and rejected travel leaves the save unchanged.
- [ ] Run the focused test and confirm expected failures.
- [ ] Add React state for map surface/origin/active POI; launch the selected engine from a seeded session, preserve static-export safety, and guard expedition initiation with a synchronous in-flight ref.
- [ ] Run `yarn colony:test`, `yarn engine:test`, and `npx tsc --noEmit`.
- [ ] Commit: `feat(region): launch expeditions with one travel cycle`

### Task 9: Runtime completion, destination outcome, and return/failure flows

**Files:**
- Create: `game/app/components/colony/meta/PoiOutcomeScreen.tsx`
- Create: `game/tests/colony/poiOutcomeScreen.test.ts`
- Modify: `game/app/components/Game.tsx`
- Modify: `game/tests/colony/regionFlow.test.ts`

- [ ] Write tests proving only active-POI `LEVEL_COMPLETE` creates the pending outcome and one completion cycle; `GAME_OVER`, pause/Escape, generic campaign completion, and early HUB return never clear/reward the POI.
- [ ] Write SSR tests for destination selection, replay/no-cargo copy, save-error retry copy, and disabled double-confirm.
- [ ] Intercept active POI completion before generic campaign handling, create an outcome once, and mount the DOM destination screen before mutating cargo.
- [ ] Confirm atomically: fold node/cargo, persist, then re-enter the origin colony. If persistence throws, keep the pending outcome on screen and allow a safe retry; a synchronous resolution ref prevents double apply.
- [ ] Add explicit GAME_OVER restart and return-to-cockpit paths; replay returns without duplicate cargo. Test reload-safe persisted node/cargo state.
- [ ] Run focused tests, `yarn colony:test`, `yarn engine:test`, and `npx tsc --noEmit`.
- [ ] Commit: `feat(region): resolve POIs without duplicate rewards`

### Task 10: Bootstrap and M1 dev fixture

**Files:**
- Modify: `game/app/components/colony/meta/ColoniesScreen.tsx`
- Modify: `game/app/components/colony/meta/ColonyEmptyState.tsx`
- Modify: `game/app/components/colony/dev/seedColony.ts`
- Modify: `game/tests/colony/seedFixtures.test.ts`
- Modify: `game/tests/colony/coloniesScreenSmoke.test.ts`

- [ ] Write failing tests proving bootstrap grants zero resources and the new `REGION` fixture contains an affordable source colony plus deterministic surveyed/rumored nodes.
- [ ] Remove the 500-metal grant, rename the bootstrap copy so it does not imply resource-free later founding, and add the M1 fixture visible automatically in DevPanel.
- [ ] Run focused tests and the full colony suite.
- [ ] Commit: `feat(region): add no-grant bootstrap and playtest fixture`

### Task 11: Full verification, playtest, review, and PR

**Files:**
- Modify only if verification exposes an M1 defect.

- [ ] Run `npx tsc --noEmit && yarn colony:test && yarn engine:test && yarn sprites:test && yarn build` from `game/` and record exact counts.
- [ ] Run `NEXT_PUBLIC_DEVTOOLS=1 yarn build`, serve `game/out`, and browser-playtest: REGION fixture → pad → map → survey → each of three POIs → cargo/return → found outpost → reload persistence.
- [ ] Confirm the canvas framebuffer/goldens remain unchanged and no new asset or sprite-script changes exist.
- [ ] Review `git diff main...HEAD`, run `git diff --check`, and check `git status --short`.
- [ ] Fix any review defects through a failing regression test first, then rerun the affected and full gates.
- [ ] Push `feat/m1-region` and open a draft PR to `main` with commits, verification counts, and manual playtest notes. Do not merge.

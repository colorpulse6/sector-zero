# Game Engine Synchronization Implementation Plan

> **Execution contract:** Work only in isolated worktrees, preserve package and checkbox order, and prove every behavior test fails for the expected reason before production code changes. The M3 asset lane is reserved and untouched.

**Goal:** Make every shipped route coherent across declaration, launch, input, simulation, rendering, dialogue, terminal outcome, persistence, return navigation, and repository truth.

**Design:** `docs/superpowers/specs/2026-07-19-game-engine-conductor-design.md`
**Audit:** `docs/audits/2026-07-19-game-engine-synchronization-audit.md`
**Planning baseline:** `main` at `6744a49`; each package records its actual base SHA.

## Execution status — 2026-09-05

- H0 accepted: code `7fbc4d1629872e60c48b3b7461262900adf027f0`, evidence `4422be8b3d014baa6a7038fe0b8ec0ab94095b7e`.
- A1 accepted: code `eb7926e566e921bd79f7ede499238ba3770f1ca3`, evidence `72b46743afd9bd0184fd2531ecd2a0b838e5bf7e`.
- A2 accepted: code `ec524822f7bd60d5a2842e187fb6d714e912d9b9`, evidence `cc9a4dd7aaa5b61a8e678057bcedd6d80de325db`.
- A2 passed 70 focused, 343 engine, 284 Colony, 4 sprite, and 20 browser tests; TypeScript and both production exports passed; separate specification and quality/integration reviews returned PASS.
- A2 closed the Mission Board activation defect and moved planet hazards, spawn policy, build caches, IDs, route identity, and retry lineage into attempt-owned contracts. B1-B3 still own general gameplay input, visible touch controls, modal focus, and navigation provenance.
- A3.1 accepted: the pure durable outcome coordinator, save migration, journal/recovery validation, route folds, and Legacy/Galaxy POI preparation are accepted at code `8ccfa3d345fbb330cac7c9185fc7e6507a72d519`.
- A3.1 passed 81 focused reviewer tests, 404 engine, 288 Colony, 4 sprite, and 20 browser tests; TypeScript, the empty-base production export, and the `/sector-zero` deployment-parity export passed; independent specification and quality/integration reviews returned PASS with no findings.
- A3.2 and A3.3 are implemented at code `b85fb3d381ae28f00c2559f351c0979129c655e6` on `codex/a3-resume`. Exact clean-code gates passed: TypeScript, 425 engine, 288 Colony, 4 sprite, 37 browser, and both production exports. Independent final-runtime specification and quality reviews passed.
- The current continuation is `docs/handoffs/2026-09-05-a3-outcome-checkpoint.md`; its manifest records the separate evidence commit's repeated gates and fresh reviews. Require its matching evidence SHA and PASS verdict before treating A3 as a package candidate or starting B1.
- Conductor correction: a saved Galaxy operation failure resolves that catalog operation. Remove the unavailable operation TRY AGAIN promise from the old shell handoff; retain failure-to-Atlas and retreat without changing lifecycle/journal policy. Legacy and POI gameplay retries remain available.
- Full authored POI success/preparation/delivery is a disclosed F1 live-integration row, not an additional A3 gate. A3 proves preparation authority and exact mounted receipt recovery; fixtures do not prove the full authored playthrough.
- A1's all-ten real-surface launch/live-play row remains open because A2's accepted browser matrix is intentionally Kepler-focused. F1 must launch all ten through the repaired board and live-play the required objective sample without test-only runtime mutation.
- `ASSET_ACCEPTED_REF` remains unset. The M3 lane remains reserved and unintegrated.

## Non-negotiable boundaries

- Never edit `/private/tmp/sector-zero-m3-hub-assets`, rebase its branch, or use its uncommitted files.
- `ASSET_ACCEPTED_REF` is unset. Until the asset owner publishes it, reserve:
  - `docs/assets/**/m3-hubs/**`
  - `docs/assets/2026-07-12-asset-pipeline-free-options.md`
  - `docs/assets/prompts/README.md`
  - `game/public/sprites/interiors/m3/**`
  - `game/public/sprites/walls/cantina.png`
  - `game/public/sprites/boarding/npc-hub-*.png`
  - `game/public/sprites/portraits/hub-*.png`
  - `game/scripts/sprites/validateM3HubAssets.ts`
  - `game/tests/sprites/m3HubAssets.test.ts`
  - `docs/superpowers/plans/2026-07-18-m3-hub-asset-production.md`
  - the M3-specific section of `docs/ROADMAP.md`
- Asset acceptance, runtime registration, and playtest proof are separate gates.
- Never implement on the main checkout. Default worktree: `/private/tmp/sector-zero-sync-<package>`; default branch: `fix/sync-<package>`.
- Use `apply_patch` for source and documentation edits. Preserve unrelated/user changes.
- A package may edit only its exact owned files. If a required edit is outside ownership, stop that package and return to the conductor for resequencing.
- Packages below are sequential unless explicitly marked disjoint. A prepared worktree is not authorization to skip dependencies.
- Do not push, merge, deploy, or modify the local knowledge base unless explicitly assigned.

## TDD and closure protocol for every package

Each behavior slice follows this order:

1. Add one focused test for one behavior.
2. Run it and record the expected assertion failure—not a syntax/import error.
3. Implement the smallest production change.
4. Run the focused test green.
5. Refactor only while green, then repeat for the next behavior.

Each package then uses this closure protocol:

- [ ] Run focused tests, TypeScript, relevant full suites, both production builds, and any required browser project.
- [ ] Run `git diff --check`; confirm the diff contains only owned files.
- [ ] Commit runtime/test code first and record the code SHA.
- [ ] Run required automated and live gates on that exact clean code SHA; generated/uncommitted changes fail the gate.
- [ ] Write the dated receipt/handoff referencing the tested code SHA, then commit the receipt as a separate evidence commit.
- [ ] Rerun required automated gates on the exact clean evidence SHA.
- [ ] Obtain a fresh specification-compliance review of the evidence SHA.
- [ ] Obtain a separate code-quality/integration review of the evidence SHA.
- [ ] Fix findings with tests first in a new code commit, retest that code SHA, update the receipt in a new evidence commit, and rerun both reviews.
- [ ] Mark the package `candidate` only after both reviews pass and the live receipt is accepted.

## Standard gates

Run from `game/` unless noted:

```bash
npx tsc --noEmit
yarn engine:test
yarn colony:test
yarn sprites:test
yarn browser:test
COREPACK_ENABLE_PROJECT_SPEC=0 yarn build
NODE_ENV=production NEXT_PUBLIC_BASE_PATH=/sector-zero COREPACK_ENABLE_PROJECT_SPEC=0 yarn build
```

Focused Node test:

```bash
node --import tsx --test tests/engine/<name>.test.ts
```

Focused browser test after Package H0:

```bash
yarn playwright test tests/browser/<name>.spec.ts --project=<project>
```

The deployment-parity build matches `.github/workflows/deploy.yml`. The empty-base build remains a distinct local/export gate.

## Dependency and shared-file order

```text
H0 browser harness + fixtures
 -> A1 planet integrity
 -> A2 launch/loadout + core route descriptor
 -> A3 idempotent outcome/persistence + experience return
 -> B1 pure input mapping
 -> B2 pointer/touch gameplay controls
 -> B3 modal focus + navigation provenance
 -> C1 mission presentation + dialogue lifecycle
 -> D1 sprite geometry + turret collision
 -> D2 combat defeat accounting
 -> D3 threat presentation fallbacks
 -> E1 measurement-only performance receipt
 -> E2 conditional performance fixes (only breached gates)
 -> F1 whole-game acceptance + docs
```

`Game.tsx`, `gameEngine.ts`, `types.ts`, and alternate-mode engines are shared-file serialization points. No packages that own one of those files run concurrently.

## Package H0 — Browser harness and deterministic route fixtures

**Branch/worktree:** `test/sync-browser-harness` in `/private/tmp/sector-zero-sync-harness`
**Owned files:**

- `game/package.json`
- `game/yarn.lock`
- `game/playwright.config.ts` (new)
- `game/tests/browser/smoke.spec.ts` (new)
- `game/tests/browser/helpers/saveFixture.ts` (new)
- `game/tests/browser/helpers/receipt.ts` (new)
- `game/tests/browser/fixtures/routeFixtures.ts` (new)
- `.github/workflows/pr-checks.yml`
- `docs/playtests/2026-07-19-browser-harness.md` (new)

### H0.1 — Prove the harness is absent

- [ ] From the clean baseline run `yarn browser:test` and record the expected missing-script failure.
- [ ] Do not edit runtime source.

### H0.2 — Add a production-relevant Chromium harness

- [ ] Add `@playwright/test` as a dev dependency and `browser:test: "playwright test"`; pin the game package to the repository's Yarn 4.9.2 runtime so raw local/CI commands cannot annotate a parent manifest.
- [ ] Configure `playwright.config.ts` with a `webServer` that runs the current worktree's `yarn dev --hostname 127.0.0.1` on a process/worktree-specific port, never reuses an existing server, and records trace/screenshot on first retry. Default artifact output must also be worktree/run-specific so parallel agents cannot erase one another's traces or receipt attachments; retain an explicit environment override.
- [ ] Define three projects:
  - `desktop-keyboard`: Chromium, 1280×900.
  - `desktop-pointer`: Chromium, 1280×900.
  - `mobile-touch`: Chromium, viewport 480×854, `hasTouch: true`, `isMobile: true`.
- [ ] Pin Chromium through the Playwright lockfile version. Document one-time `yarn playwright install chromium`.
- [ ] Extend the existing `pr-checks.yml` with a browser job that installs Playwright Chromium and runs `yarn browser:test`; do not alter deploy behavior.

### H0.3 — Add real persisted-save fixtures

- [ ] Write a focused fixture test inside `smoke.spec.ts` that fails until a save is installed under `sector-zero-save` before hydration.
- [ ] Build fixtures through `migrateSave` and current data registries rather than hand-maintaining a full JSON schema.
- [ ] Install the fixture once before first hydration. The init hook must not overwrite application-persisted state on navigation/reload; prove a runtime save mutation survives reload.
- [ ] Provide named fixtures:
  - `freshLegacy`.
  - `allPlanetsLaunchable`: completes every `PLANET_DEFS[].unlockAfterLevel`, supplies sufficient `totalStars`, leaves `completedPlanets` empty, and retains a non-default pilot build.
  - `keplerUnlocked` and `keplerCleared`.
  - `freshGalaxy` and `galaxyAtAshfall`.
  - `colonyFounded` with exterior/interior access.
- [ ] Record fixture migration/round-trip checks with Node assertions or a browser smoke.

### H0.4 — Prove browser event capability

- [ ] Add a smoke that enters the experience selector, focuses both choices, activates Legacy by keyboard, and reloads the installed save.
- [ ] Assert the reload consumes the application-written save rather than reinstalling the original fixture.
- [ ] Add a pointer smoke that clicks a focusable choice.
- [ ] Add a mobile smoke that uses a real Playwright touchscreen event.
- [ ] Run the three projects green and the standard gates.
- [ ] Complete the closure protocol; candidate message: `test(game): add route-level browser harness`.

## Package A1 — Planet mission terminal and render integrity

**Branch/worktree:** `fix/sync-planet-integrity` in `/private/tmp/sector-zero-sync-planet`
**Depends on:** H0 candidate integrated into its base.
**Owned files:**

- `game/app/components/engine/objectives.ts`
- `game/app/components/engine/gameEngine.ts`
- `game/app/components/engine/planetRenderer.ts`
- `game/app/components/engine/renderer.ts`
- `game/tests/engine/planetMissions.test.ts` (new)
- `game/tests/engine/planetRendering.test.ts` (new)
- `game/tests/browser/planetRoutes.spec.ts` (new)
- `docs/playtests/2026-07-19-planet-integrity.md` (new)

### A1.1 — Define defend terminal behavior test-first

- [ ] Add a table test over all ten planet definitions and objective types.
- [ ] Add focused defend tests for:
  - final authored wave spawned + no enemies/boss + living structure → complete;
  - earlier wave or remaining threat → incomplete;
  - zero-HP structure → failed and not completed;
  - last threat and final structure damage in one update follows the selected alive/zero-HP rule.
- [ ] Run the focused test and record the baseline failure because defend never completes.
- [ ] Add a named objective encounter context to `updateObjective`; do not append an unexplained positional boolean.
- [ ] Compute terminality after the current encounter update from waves exhausted, enemies empty, and no live boss.
- [ ] Preserve looping survive behavior and rerun focused tests green.

### A1.2 — Define render composition test-first

- [ ] Add a recording-canvas or pure render-plan test that fails because `planetRenderer.ts` is not dispatched.
- [ ] Assert order: planet background → common combat layer → gameplay-significant planet actor/hazard → particles/foreground → objective HUD/dashboard.
- [ ] Assert collect draws collectibles, escort draws escort, defend draws structure, and every planet draws the hazard state that can damage the player.
- [ ] Assert non-planet shooter behavior remains on the generic path.
- [ ] Connect the existing planet renderer through small composition helpers; keep procedural fallbacks.
- [ ] Rerun focused tests green.

### A1.3 — Verify all real routes

- [ ] Use `allPlanetsLaunchable` to enter cockpit Missions and launch each planet through the real control surface; DevPanel is not accepted as route proof.
- [ ] Launch all ten through the real browser surface. Prove terminal reachability for all ten through the Node engine table; do not add a test-only browser runtime API.
- [ ] Fully live-play one collect, one survive, one escort, and all three defend planets. The remaining browser routes require launch/presentation proof, not artificial terminal mutation.
- [ ] Verify Ashfall operation inherits the planet presentation using a Galaxy fixture.
- [ ] Capture desktop and 480×854 legibility. Touch combat acceptance waits for B2, but route launch and presentation are required here.
- [ ] Complete the closure protocol; candidate message: `fix(engine): restore planet mission integrity`.

## Package A2 — Full launch/loadout and core route descriptor

**Final branch/worktree:** `fix/sync-launch-final` in `/private/tmp/sector-zero-sync-launch-final`
**Depends on:** A1.
**Owned files:**

- `game/app/components/Game.tsx`
- `game/app/components/engine/types.ts`
- `game/app/components/engine/gameEngine.ts`
- `game/app/components/engine/renderer.ts`
- `game/app/components/engine/missionContext.ts` (new)
- `game/app/components/engine/operations/operationAdapters.ts`
- `game/app/components/colony/region/poiRuntime.ts`
- `game/app/components/engine/specialMissions.ts`
- `game/app/components/engine/cockpit.ts`
- `game/app/components/engine/cockpitRenderer.ts`
- `game/tests/engine/missionLaunch.test.ts` (new)
- `game/tests/engine/specialMissionPolicy.test.ts` (new)
- `game/tests/engine/galaxyOperations.test.ts`
- `game/tests/engine/planetRendering.test.ts`
- `game/tests/browser/launchRoutes.spec.ts` (new)
- `docs/playtests/2026-07-19-launch-context.md` (new)

### A2.1 — Specify complete non-default loadout

- [x] Add a back-to-back planet-state render test that fails because a later constructor replaces the earlier state's module-global hazards; move hazard authority into explicit attempt state before normalizing other launch fields.
- [x] Add back-to-back spawn tests that fail when a later constructor replaces an earlier attempt's enemy difficulty/class or resets shared enemy/bullet/power-up ID allocators. Keep spawn policy attempt-owned and prevent constructor resets from issuing duplicate live IDs.
- [x] Add a table test over direct campaign, retry, continue, next level/world, planet, special, Galaxy operation, Colony exploration, and POI launch adapters.
- [x] Use a non-default loadout: upgraded ship, enhancement, pilot level >1, allocated skill, non-kinetic weapon, equipped consumable, and inventory count.
- [x] Assert each resulting state/consumed engine context agrees.
- [x] Add back-to-back campaign → planet → special tests that expose stale module-global allocated skills.
- [x] Assert a gameplay retry preserves normalized fields but generates a new `launchId`; no two attempts share terminal identity.
- [x] Assert continue preserves mission, loadout, authority, and return target, records `entryProvenance: "continue"`, and generates a new `launchId` just like any new gameplay attempt.
- [x] Record baseline failures for direct/planet/retry omissions, hardcoded kinetic weapon, operation omission, and planet global reset.
- [x] Define `PilotLoadout` exactly as in the design and make constructors reset every consumed module-global build cache.
- [x] Keep Galaxy `OperationLaunchContext` as the separate authorization proof. Attach the normalized gameplay `LaunchContext` through `GameState`/`missionContext.ts`; do not replace, widen, or conflate the operation authorization type.
- [x] Snapshot the locked Galaxy projection once and construct gameplay loadout only from that sanitized snapshot. A Proxy/accessor must not change weapon, consumables, skills, or upgrades after validation.
- [x] Validate only the locked projection fields this adapter consumes while rejecting accessors/functions; unrelated future canonical save fields such as A3 revision/journal data must not make all operations unavailable.
- [x] Route all launchers through one `launchContextFromSave` boundary and rerun green.

### A2.2 — Define core route identity

- [x] Add descriptor tests covering 40 campaign levels, ten planets, Kepler, three Galaxy operations, Colony exterior/interior, and each POI adapter.
- [x] Assert unique ID, mission kind, controls profile, replay policy, persistence authority, entry provenance, and owned return target.
- [x] Make dynamic Colony/POI route components collision-safe; distinct colony, building, template, and node identities must never serialize to the same descriptor ID.
- [x] Defensively reject unknown campaign coordinates, planet/special IDs, descriptor-to-constructor mismatches, invalid route authority/provenance/return combinations, blank launch IDs, and duplicate issued attempt IDs before a `GameState` is created.
- [x] Keep content title/objective population minimal here; C1 owns final briefing presentation.
- [x] Assert Colony routes inherit `legacy` or `galaxy` authority and are never a third persistence authority.
- [x] Pin POI return ownership to the real terminal surface: Legacy POIs return to the origin Colony exterior; Galaxy POIs return to Galaxy Region. Retry preserves that target.
- [x] Implement the typed descriptor/context registry and rerun green.

### A2.3 — Enforce Kepler one-shot policy

- [x] Add locked/unlocked/first-clear/cleared tests that fail on the current cleared launch action.
- [x] Keep cleared Kepler visible as `CLEARED`, disable selection/activation, and defensively reject stale direct launch.
- [x] Do not change the first-clear map or invent replay content.
- [x] Define one Mission Board tab/row geometry and activation helper in `cockpit.ts`; derive renderer geometry and shell mouse/touch dispatch from the same contract.
- [x] Stop the cockpit requestAnimationFrame loop from restoring stale state after a keyboard edge. Limit this carve-out to Mission Board activation; B1-B3 retain general gameplay input, modal focus, and navigation provenance.
- [x] Update the existing Galaxy operation regression that currently expects a cleared Kepler replay; it must assert the defensive one-shot rejection instead.
- [x] Browser-test all four states with keyboard, pointer, and touch selection.
- [x] Complete the closure protocol; accepted code `ec524822f7bd60d5a2842e187fb6d714e912d9b9`, evidence `cc9a4dd7aaa5b61a8e678057bcedd6d80de325db`.

## Package A3 — Idempotent outcome persistence and experience-owned return

**Branch/worktree:** `codex/a3-resume` in `/Users/nichalasbarnes/.config/superpowers/worktrees/sector-zero/a3-resume` (recovered from the historical `fix/sync-outcome-ownership` stack)
**Depends on:** A2.
**Owned files:**

- `game/app/components/Game.tsx`
- `game/app/components/engine/types.ts`
- `game/app/components/engine/save.ts`
- `game/app/components/engine/missionContext.ts` (A3 canonical route-identity codec/binding only; preserve accepted A2 launch policy)
- `game/app/components/engine/missionOutcome.ts` (new)
- `game/app/components/engine/outcomeJournalAuthority.ts` (new pure root/nested/operation journal validator shared by save migration and the coordinator; keep the runtime graph acyclic)
- `game/app/components/engine/missionOutcomeFolds.ts` (new, code-owned route fold registry if needed to avoid dependency cycles)
- `game/app/components/engine/operations/operationAdapters.ts`
- `game/app/components/engine/operations/operationOutcome.ts`
- `game/app/components/colony/region/poiRuntime.ts`
- `game/app/components/colony/region/poiOutcomes.ts`
- `game/app/components/engine/galaxy/experienceFlow.ts`
- `game/app/components/engine/galaxy/galaxyPoiOutcomeAuthority.ts` (new pure prepared-fact codec/run-only fold, if needed to keep the coordinator graph acyclic)
- `game/app/components/engine/galaxy/galaxyProjection.ts` (root outcome metadata propagation only)
- `game/app/components/engine/galaxy/galaxyRun.ts` (root outcome metadata propagation only)
- `game/tests/engine/missionOutcome.test.ts` (new)
- `game/tests/engine/missionLaunch.test.ts` (A3 attempt-sidecar assertions only)
- `game/tests/engine/galaxyOperations.test.ts`
- `game/tests/engine/galaxyExperienceFlow.test.ts`
- `game/tests/engine/galaxyProjection.test.ts` (exhaustive root-key contract only)
- `game/tests/colony/advanceWorldCycle.test.ts` (root outcome metadata fixture only)
- `game/tests/colony/coloniesScreenSmoke.test.ts` (root outcome metadata fixture only)
- `game/tests/colony/fixtures.ts` (root outcome metadata fixture only)
- `game/tests/colony/integration.test.ts` (root outcome metadata fixture only)
- `game/tests/colony/reducer.test.ts` (root outcome metadata fixture only)
- `game/tests/colony/reducerInsertionOrder.test.ts` (root outcome metadata fixture only)
- `game/tests/colony/poiOutcomes.test.ts`
- `game/tests/colony/regionFlow.test.ts`
- `game/tests/browser/outcomeAuthority.spec.ts`
- `game/tests/browser/outcomeEnding.spec.ts`
- `game/tests/browser/outcomeReload.spec.ts`
- `game/tests/browser/galaxyPersistence.spec.ts`
- `game/tests/browser/fixtures/routeFixtures.ts`
- `game/tests/browser/fixtures/outcomeFixtures.ts`
- `game/tests/browser/helpers/saveFixture.ts`
- `game/tests/browser/helpers/outcomeWriteProbe.ts`
- `game/tests/browser/helpers/travelWriteProbe.ts`
- `docs/playtests/2026-09-05-outcome-ownership.md`

The conductor keeps the original browser ownership role but splits its single planned outcome test file into focused route, ending, reload, and travel files plus shared fixtures/probes. The dated handoff, plan, and design checkpoint are conductor-owned evidence updates.

### A3.1 — Add save migration and pure coordinator tests

- [x] Write failing migration tests for default `saveRevision`, bounded `appliedOutcomeIds`, and bounded/versioned `outcomeRecoveryRecords`.
- [x] Write a route-class table for campaign, planet, special, operation, Colony exploration, and POI terminal outcomes.
- [x] For each class assert launch → success/failure → commit → authority-owned return.
- [x] Add explicit cases: duplicate callback, write failure then retry, write success/UI loss then reload, stale revision with valid rebase, stale revision conflict, and no double rewards/progression.
- [x] On post-write throw, require exact unlocked candidate proof: one matching receipt/revision, declared effects, and root+nested/operation-owner parity. A journal-only or newly locked reread is not `already_applied`.
- [x] Assert persistence retry keeps the original `outcomeId`; only a new gameplay attempt receives a new `launchId`.
- [x] Version durable Galaxy and Legacy POI preparation payloads with the original `launchId`, derived `outcomeId`, inherited persistence authority, and declared-field snapshot; reload must reconstruct the same pending outcome identity. Applied return receipts must retain the validated `missionId`, route kind, and route identity required to mount the exact owned target after the preparation is consumed; a generic return enum alone is insufficient for POI/Colony origins.
- [x] Add explicit old prepared-payload migration/recovery tests. A payload without enough authority or identity to migrate must fail closed into recoverable reconciliation rather than minting a new outcome.
- [x] Pin stale-revision behavior: each outcome declares exact authority fields it reads/writes and snapshots them at launch; rebase only when all declared fields remain deep-equal. Any changed or undeclared dependency conflicts. Already-applied outcome IDs remain idempotent success.
- [x] Capture a canonical serializable route identity at launch (campaign coordinates, planet/special/operation ID, Colony location, or POI origin/node/adapter/reward eligibility). Registry handlers—not callers—own the exact ordered declared-field tuple. Reject cross-planet, cross-operation, cross-Colony, and cross-POI substitution even when the forged payload is otherwise valid.
- [x] Prove every public commit, preparation, recovery, and acknowledgement API is total over hostile serialized/store inputs: accessors, sparse/proxy arrays, malformed records, delayed reads, and clone traps must return conflict/null/failure without throwing or gaining replay authority.
- [x] Treat non-operation failure/retreat and Colony takeoff as explicit journal-only terminals with zero declared domain fields. Every Galaxy-authority terminal still appends coordinator-owned root+nested journal metadata with the same outcome ID. Galaxy operation success, failure, and retreat all re-authorize and fold catalog-owned effects; serialized payloads may carry only engine metrics/result, never normalized rewards or final save fields.
- [x] Revalidate every new dynamic POI/Colony route identity against the latest inherited authority before journaling, but only after already-applied reconciliation; ghost/cross-origin receipts and forged building identity must conflict while legitimate post-clear retries remain idempotent.
- [x] Bind POI outcome mission identity to its explicit origin as well as node/template/adapter; prove a second otherwise-valid adjacent Colony cannot substitute for the launched origin without changing the code-owned binding.
- [x] Reject incoherent pending return authority at runtime as well as migration: a pending receipt missing its root journal ID or naming a future applied revision must block new commits rather than being preserved.
- [x] Enforce historical Galaxy parity globally before any new mutation: every nested ID has a root ID, every pending Galaxy receipt has a nested ID, and each pending operation receipt has one exact operation owner.
- [x] Distinguish absent pre-A3 metadata from present malformed metadata during migration: only an absent own property defaults empty; present `null`, `undefined`, accessor, malformed/proxy/revoked journal or recovery containers produce a bounded reconciliation lock without invoking getters and cannot reset idempotency history.
- [x] Reject duplicate recovery identities and more than one total Legacy preparation in migration/runtime validation; acknowledgement and post-write reread require one exact matching receipt, never first-match partial success.
- [x] Convert syntactically valid but unrecoverable Legacy preparations (future revision or current declared-field drift) into explicit reconciliation instead of retaining a permanent invisible staging lock.
- [x] Gate Galaxy POI staging on one exact own-data/versioned attempt snapshot, active Galaxy experience, coherent root revision/journals/reconciliation, nested authority, and canonical mission/origin binding. Every successful staged write must immediately round-trip as the same returned attempt; old/malformed/ambiguous reserved facts produce explicit reconciliation.
- [x] Record baseline failures before adding production fields/coordinator.
- [x] Implement the serializable outcome envelope, route fold registry, canonical-store read/write boundary, and `commitOutcome` result union from the design; arbitrary function-valued folds are not durable authority.
- [x] Bound journal pruning without removing an ID referenced by an active/checkpointed launch.

**A3.1 acceptance:** code `8ccfa3d345fbb330cac7c9185fc7e6507a72d519`; exact-revision automated gates and independent reviews passed on 2026-07-21. This accepts the pure authority layer only. A3.2 and A3.3 remain required before the package closure protocol and live receipt can complete.

### A3.2 — Route shell outcomes through the coordinator

- [x] Replace route-specific durable application in `Game.tsx` with adapters into the coordinator; retain route-specific pure effect calculation.
- [x] Do not show completion/navigation until write succeeds.
- [x] Show recoverable retry on `write_failed`; show reload/reconcile action on `conflict`.
- [x] If outcome is `already_applied`, restore the exact return surface from the durable receipt's validated route identity without re-awarding; acknowledge the receipt only after that surface mounts.
- [x] Ensure Galaxy paths mutate only Galaxy authority and legacy/Colony paths only their inherited authority.
- [x] Route the final `ENDING` campaign result through the same coordinator; remove the reduced duplicate save sequence.
- [x] Prevent HUB/Escape from leaving a campaign, planet, or special `LEVEL_COMPLETE` surface before its outcome is durably committed. POI failure returns to the inherited A2 surface (Legacy Colony exterior or Galaxy Region), not the generic cockpit/Atlas fallback.

### A3.3 — Close Galaxy escape and persistence failure paths

- [x] Add a transition table that fails for Atlas close exposing Legacy cockpit under Galaxy authority.
- [x] Selected close behavior: return to the experience selector and clear Galaxy-owned overlays; changing to Legacy requires the explicit selector action.
- [x] Cover travel commit/resume/finalize/retreat write failure and retry through the same result presentation.
- [x] Browser-test byte-for-byte legacy fields across Galaxy close/back and outcome routes.
- [x] Reload after each durable outcome class.
- [x] Keep Galaxy prepared POI identity in its canonical Galaxy history record. Because staging mutates `galaxyRun`, validate the unique versioned prepared fact and its exact prepared revision before rebinding the staged snapshot; any intervening write or one-sided root/nested journal evidence conflicts instead of replaying.
- [x] Commit the code and pass its exact clean-code gates at `b85fb3d381ae28f00c2559f351c0979129c655e6`. Complete evidence-SHA closure only with the matching PASS gate/review manifest linked by the dated handoff; the general closure protocol remains mandatory.

## Package B1 — Pure semantic input mapping

**Branch/worktree:** `codex/b1-input-mapping` in `/Users/nichalasbarnes/.config/superpowers/worktrees/sector-zero/b1-input-mapping`, from accepted A3 evidence `e5495fe770adfd33c3cb7978ae4e3656eb3a2394`.
**Depends on:** A3.
**Owned files:**

- `game/app/components/Game.tsx`
- `game/app/components/engine/types.ts`
- `game/app/components/engine/inputIntents.ts` (new)
- `game/tests/engine/inputIntents.test.ts` (new)
- `game/tests/browser/inputIntents.spec.ts` (new; conductor ownership reconciliation for B1's required browser proof)
- `game/tests/browser/outcomeEnding.spec.ts` (conductor reconciliation: start firing after the boss introduction, because B1 clears input at that transition)
- `game/tests/browser/outcomeAuthority.spec.ts` (conductor reconciliation: retain diagnostics at the first retry-mount assertion)
- `docs/playtests/2026-07-19-input-intents.md` (new)
- `docs/handoffs/2026-09-05-b1-input-checkpoint.md` (new; dated continuation evidence)

### B1.1 — Map physical input by active mode

- [ ] Add pure table tests for keyboard mapping in shooter, ground, boarding, first-person/Colony, turret, UI surfaces, and pause.
- [ ] Assert one physical event maps to at most one gameplay intent unless an explicit chord is declared.
- [ ] Record the current Space shoot+jump failure.
- [ ] Implement pure mapping helpers and adapt shell key handlers.
- [ ] Selected Space policy: shooter/turret primary; ground jump; boarding dash; first-person/Colony primary interaction. Z/Shift remains primary fire where applicable.
- [ ] Clear held intents on key/touch cancel, blur, visibility loss, pause, and route transition.
- [ ] Browser-test keydown/keyup/blur without changing touch UI yet.
- [ ] Complete the closure protocol; candidate message: `fix(input): map physical controls to semantic intents`.

## Package B2 — Pointer and visible touch gameplay controls

**Branch/worktree:** `fix/sync-touch-gameplay` in `/private/tmp/sector-zero-sync-touch`
**Depends on:** B1.
**Owned files:**

- `game/app/components/Game.tsx`
- `game/app/components/TouchControls.tsx` (new)
- `game/app/components/engine/types.ts`
- `game/app/components/engine/inputIntents.ts`
- `game/app/components/engine/gameEngine.ts`
- `game/app/components/engine/turretEngine.ts`
- `game/tests/engine/inputIntents.test.ts`
- `game/tests/browser/touchGameplay.spec.ts` (new)
- `docs/playtests/2026-07-19-touch-gameplay.md` (new)

### B2.1 — Render the selected control profiles

- [ ] Add browser tests that fail because visible accessible controls are absent for each gameplay mode.
- [ ] Implement `TouchControls` using named DOM buttons/pads over the canvas, respecting safe-area insets and 44px minimum targets.
- [ ] Implement exactly the design table: shooter move/fire/bomb; ground move+aim/fire/jump; boarding 8-way/fire/dash; FP/Colony move+strafe/look/fire-interact; turret position/fire.
- [ ] Keep drag-to-position for shooter and set turret crosshair from explicit normalized aim input.
- [ ] Briefing/control copy identifies the active profile; no required action is gesture-only.

### B2.2 — Prove real touch play

- [ ] With Playwright touchscreen events, move and perform each action in all five mode profiles.
- [ ] Assert unrelated action counters/state do not change.
- [ ] Verify multi-touch, `touchcancel`, pointer cancel, pause, and surface transition release all held controls.
- [ ] At 480×854, traverse one campaign, planet, Galaxy operation, Colony exterior/interior, ground, boarding, first-person, and turret route.
- [ ] Complete the closure protocol; candidate message: `fix(input): add accessible touch gameplay controls`.

## Package B3 — Navigation activation, modal focus, and provenance

**Branch/worktree:** `fix/sync-navigation-focus` in `/private/tmp/sector-zero-sync-navigation`
**Depends on:** B2.
**Owned files:**

- `game/app/components/Game.tsx`
- `game/app/components/galaxy/GalaxyAtlasScreen.tsx`
- `game/app/components/colony/meta/RegionMapScreen.tsx`
- `game/app/components/colony/meta/ColoniesScreen.tsx`
- `game/app/components/colony/meta/PoiOutcomeScreen.tsx`
- `game/app/components/colony/exploration/exitMenu.tsx`
- `game/app/components/ui/ModalFocus.tsx` (new if shared behavior is needed)
- `game/tests/browser/navigationFocus.spec.ts` (new)
- existing static screen tests only when markup contracts change
- `docs/playtests/2026-07-19-navigation-focus.md` (new)

### B3.1 — Complete click/touch navigation

- [ ] Add failing browser routes for cockpit subscreens, Star Map world+level activation, Atlas contacts, Region POIs, Colony descent/return, and outcome actions.
- [ ] Activate the hit target under the pointer/touch rather than the preselected item.
- [ ] Keep keyboard selection and pointer hover independent until activation.

### B3.2 — Apply one modal focus contract

- [ ] Add failing browser tests for initial focus, repeated Arrow Up/Down, Tab/Shift-Tab containment, Escape policy, close, and true-invoker restoration.
- [ ] Test the pinned policy:
  - Atlas: full-screen contained navigation, selected contact focus, Escape/Close → selector, focus Galaxy choice.
  - Region: modal/trapped, selected option focus, Escape → actual Atlas/landing-pad/cockpit invoker.
  - Colonies: modal/trapped, selected action focus, Escape → cockpit Colonies invoker.
  - POI Outcome: mandatory modal/trapped, primary resolution focus, Escape blocked with status; resolved return follows inherited authority.
  - Exit Menu: modal/trapped, Resume focus, Escape → focusable exploration canvas.
- [ ] Keep Atlas list focus during selection changes; update details without stealing it.
- [ ] Capture Region invoker before moving focus and restore only if connected.
- [ ] Apply dialog semantics and focus containment exactly as pinned in the surface policy above.
- [ ] Split source (`atlas`, `landing-pad`, `cockpit`) from `actionsEnabled`; render accurate labels/back targets.
- [ ] Complete the closure protocol; candidate message: `fix(navigation): unify activation and focus ownership`.

## Package C1 — Mission presentation and dialogue lifecycle

**Branch/worktree:** `fix/sync-mission-dialogue` in `/private/tmp/sector-zero-sync-dialogue`
**Depends on:** B3.
**Owned files:**

- `game/app/components/engine/missionContext.ts`
- `game/app/components/engine/gameEngine.ts`
- `game/app/components/engine/renderer.ts`
- `game/app/components/engine/dialog.ts`
- `game/app/components/engine/planetDialog.ts`
- `game/app/components/engine/specialMissions.ts`
- `game/app/components/engine/levels.ts`
- `game/tests/engine/missionPresentation.test.ts` (new)
- `game/tests/engine/dialogLifecycle.test.ts` (new)
- `game/tests/browser/dialogLifecycle.spec.ts` (new)
- `docs/playtests/2026-07-19-mission-dialogue.md` (new)

### C1.1 — Populate presentation descriptors test-first

- [ ] Add failing snapshots/table assertions for campaign, every planet, Kepler, operations, Colony exterior/interior, and every POI adapter.
- [ ] Assert title, location, objective, controls profile, replay state, and absence/presence of campaign numbering by kind.
- [ ] Populate current authoritative data and render briefings from it; never infer non-campaign identity from world/level coordinates.

### C1.2 — Normalize dialogue lifecycle test-first

- [ ] Add failing tests for mission start, `wave_start: 0`, later waves, alternate-mode tick, level-complete trigger, a 660-frame completion queue, skip, retry, and checkpoint restore.
- [ ] Add an exact-once profile-result test proving Game Over, retry, return, and reload cannot record the same stable launch attempt twice; retry owns only its newly issued launch identity.
- [ ] Fire mission/wave-zero exactly once after briefing acceptance/first playable tick.
- [ ] Tick shared dialogue in shooter, ground, boarding, first-person, Colony, and turret branches.
- [ ] Hold phase/outcome transition until completion dialogue is drained or explicitly skipped.
- [ ] Prevent unintended replay after retry/checkpoint restoration.

### C1.3 — Validate authored content before editing copy

- [ ] Add a failing validation assertion for unreachable dialogue triggers, unsupported mode dispatch, and the World 5 false-finality phrase.
- [ ] Then rewrite World 5 as a local climax without contradicting Worlds 6–8.
- [ ] Fail explicitly for unimplemented `base-defense`/`mech-duel`; do not fall through to shooter.
- [ ] Mark reused alternate-mode fixtures explicitly shared; do not invent maps/art in this package.
- [ ] Browser-test campaign/planet/Kepler briefings and long dialogue with keyboard, pointer, and touch skip.
- [ ] Complete the closure protocol; candidate message: `fix(content): synchronize mission identity and dialogue`.

## Package D1 — Sprite frame authority and turret collision

**Branch/worktree:** `fix/sync-sprite-geometry` in `/private/tmp/sector-zero-sync-geometry`
**Depends on:** C1; M3 accepted ref is not required because reserved files are excluded.
**Owned files:**

- `game/scripts/sprites/sheets.ts`
- `game/scripts/sprites/classify.ts`
- `game/app/components/engine/sprites.ts`
- `game/app/components/engine/turretRenderer.ts`
- `game/app/components/engine/turretEngine.ts`
- `game/app/components/engine/groundRenderer.ts`
- `game/tests/sprites/classify.test.ts`
- `game/tests/engine/turretGeometry.test.ts` (new)
- `game/tests/browser/turretGeometry.spec.ts` (new)
- `docs/playtests/2026-07-19-sprite-geometry.md` (new)

### D1.1 — Make divided assets manifest-owned

- [ ] Add failing tests for every renderer-divided ground/turret image omitted from `SHEETS`.
- [ ] Declare source rect, logical anchor, and display aspect once; validation and renderer both consume it.
- [ ] For current `enemy-fighter.png`, use verified alpha-separated padded source rects without changing the asset:
  - small: `x=72, y=410, width=369, height=124`;
  - medium: `x=482, y=361, width=589, height=241`;
  - large: `x=1078, y=367, width=419, height=250`.
- [ ] Assert rects are in bounds, non-overlapping, and contain opaque pixels without neighboring fighter content.
- [ ] Draw each at its logical aspect rather than as a square.

### D1.2 — Align visible and hit geometry

- [ ] Add failing projected-envelope tests for fighter/bomber at far, mid, and near depth, including visible edge hits.
- [ ] Derive turret hit bounds from the same projected logical dimensions plus one documented fairness margin.
- [ ] Keep simple projected geometry; do not add per-pixel collision.
- [ ] Capture three fighter depths and a center/edge aim grid in Chromium.
- [ ] Complete the closure protocol; candidate message: `fix(render): align sprite and turret geometry`.

## Package D2 — Canonical combat defeat accounting

**Branch/worktree:** `fix/sync-combat-events` in `/private/tmp/sector-zero-sync-combat`
**Depends on:** D1.
**Owned files:**

- `game/app/components/engine/types.ts`
- `game/app/components/engine/combatEvents.ts` (new)
- `game/app/components/engine/gameEngine.ts`
- `game/app/components/engine/enemies.ts`
- `game/app/components/engine/groundEngine.ts`
- `game/app/components/engine/boardingEngine.ts`
- `game/app/components/engine/firstPersonEngine.ts`
- `game/app/components/engine/turretEngine.ts`
- `game/app/components/engine/bestiary.ts`
- `game/app/components/engine/cockpitRenderer.ts` only for lore-only copy
- `game/tests/engine/combatEvents.test.ts` (new)
- `game/tests/browser/bestiaryProgress.spec.ts` (new)
- `docs/playtests/2026-07-19-combat-events.md` (new)

### D2.1 — Define defeat event in failing tests

- [ ] Add one failing test per mode for canonical enemy identity, class, mode, cause, exactly-once event, outcome fold, save, and reload.
- [ ] Only after red, define the event type and route each kill path through it.
- [ ] Ensure bombs, hazards, multi-hit frames, and already-dead actors cannot emit twice.

### D2.2 — Resolve displayed multiplier without balance changes

- [ ] Add a failing presentation test showing numeric `damageMult` is presented as an active stat despite inconsistent mechanics.
- [ ] Keep current combat math unchanged in this synchronization program.
- [ ] Remove or relabel numeric class multiplier claims as descriptive/lore-only.
- [ ] Do not alter affinity/damage balance without a separate approved balance spec.
- [ ] Browser-record one kill per mode and verify bestiary/reload.
- [ ] Complete the closure protocol; candidate message: `fix(combat): unify defeat accounting`.

## Package D3 — Threat presentation fallbacks

**Branch/worktree:** `fix/sync-threat-presentation` in `/private/tmp/sector-zero-sync-threats`
**Depends on:** D2 and `ASSET_ACCEPTED_REF` only if consuming M3 output; otherwise baseline assets/fallbacks only.
**Owned files:**

- `game/app/components/engine/enemies.ts`
- `game/app/components/engine/boardingRenderer.ts`
- `game/app/components/engine/firstPersonRenderer.ts`
- `game/app/components/engine/fpRender/sceneInput.ts`
- `game/tests/engine/threatPresentation.test.ts` (new)
- `game/tests/browser/threatPresentation.spec.ts` (new)
- `docs/playtests/2026-07-19-threat-presentation.md` (new)

### D3.1 — Make fallbacks explicit test-first

- [ ] Add failing tests that every behavior type resolves to a visual identity or named fallback.
- [ ] Remove rectangular class tint; tint only sprite pixels or use a non-rectangular cue.
- [ ] Keep boarding/FP types explicitly distinct in metadata even when current accepted art is shared.
- [ ] Do not generate, replace, or register assets here.
- [ ] Browser-check type cues at native/scaled presentation.
- [ ] Complete the closure protocol; candidate message: `fix(render): make threat fallbacks explicit`.

## Package E1 — Reproducible runtime measurement only

**Branch/worktree:** `perf/sync-runtime-measurement` in `/private/tmp/sector-zero-sync-perf-measure`
**Depends on:** D3.
**Owned files:**

- `game/scripts/perf/measureRuntime.mts` (new)
- `game/scripts/perf/serveExport.mts` (new)
- `game/playwright.performance.config.ts` (new)
- `game/package.json`
- `game/tests/browser/runtimePerformance.spec.ts` (new)
- `game/tests/engine/presentationCadence.test.ts` (new)
- `game/tests/perf/renderBench.ts`
- `docs/audits/2026-07-19-runtime-performance.md` (new)

### E1.1 — Pin protocol and thresholds

- [ ] Record commit, OS, architecture, CPU, RAM, Node, Playwright, and Chromium versions.
- [ ] Build with `NODE_ENV=production NEXT_PUBLIC_BASE_PATH=/sector-zero`, then use `serveExport.mts` to serve `game/out` while stripping the `/sector-zero` URL prefix. Performance tests must not use the H0 development server.
- [ ] Add `playwright.performance.config.ts` with base URL `http://127.0.0.1:4173/sector-zero` and a web server command that performs the deployment-parity build then starts `serveExport.mts` on port 4173.
- [ ] Use Playwright Chromium via CDP with Fast 4G (`1.6 Mbps down`, `750 Kbps up`, `150 ms RTT`) and `4×` CPU throttling.
- [ ] For each of fresh selector, Legacy cockpit, one planet, Colony interior, and Galaxy operation: run twenty new-context cold-cache samples and ten warm-cache samples.
- [ ] Compute p95 by nearest rank: sort ascending and select index `ceil(0.95 × N) - 1`; report medians as the middle value or mean of the two middle values.
- [ ] Report median and p95 for navigation-to-interactive, request count, transfer bytes, failed required assets, and decoded RGBA estimate (`naturalWidth × naturalHeight × 4` for loaded images).
- [ ] Use synthetic 60/120/144 Hz timestamp tests for presentation cadence; do not require a physical high-refresh display.
- [ ] Thresholds:
  - fresh selector/cockpit transfer ≤16 MiB and decoded estimate ≤192 MiB;
  - incremental route bundle decoded estimate ≤128 MiB;
  - median interactive ≤5.0 s and p95 ≤7.5 s under the pinned throttle;
  - zero required-asset failures;
  - post-FX presentations over ten simulated seconds ≤ fresh simulation frames + 2.
- [ ] Measurement scripts/tests may observe/instrument but must not change runtime behavior.

### E1.2 — Publish the decision receipt

- [ ] Run the protocol twice from a clean worktree to prove repeatability; explain any >10% median variance.
- [ ] Mark each threshold pass/breach with raw sample data.
- [ ] Complete the closure protocol; candidate message: `perf(engine): establish runtime budgets`.

## Package E2 — Conditional loading/cadence fixes

**Authorization:** Create only for thresholds breached in the accepted E1 receipt. A passing threshold forbids churn in that area.
**Branch/worktree:** `perf/sync-runtime-fixes` in `/private/tmp/sector-zero-sync-perf-fix`
**Owned files when authorized:**

- `game/app/components/engine/sprites.ts`
- `game/app/components/Game.tsx` preload/presentation loops only
- `game/app/components/engine/postFx/gradeGL.ts`
- `game/app/components/engine/postFx/index.ts`
- `game/tests/engine/runtimeLoading.test.ts` (new if loading breached)
- `game/tests/engine/presentationCadence.test.ts`
- `game/tests/browser/runtimePerformance.spec.ts`
- E1 audit follow-up section

### E2.1 — Fix only recorded breaches

- [ ] For loading breach, first add failing common+active-route bundle, required-failure, idempotency, and `/sector-zero` base-path tests; then replace global eager preload with demand bundles and visible required-asset errors.
- [ ] For cadence breach, first add failing synthetic frame-token tests; then skip upload/post-FX when no new simulation frame exists.
- [ ] Preserve resize, visibility, WebGL fallback, route transition, and optional-asset fallbacks.
- [ ] Repeat the identical E1 protocol and report before/after raw samples.
- [ ] Complete the closure protocol; candidate message: `perf(engine): enforce measured runtime budgets`.

## Package F1 — Whole-game acceptance and repository truth

**Branch/worktree:** `docs/sync-release-truth` in `/private/tmp/sector-zero-sync-release`
**Depends on:** H0–E1, accepted E2 if authorized, and either published `ASSET_ACCEPTED_REF` merged first or an explicit reservation leaving every M3 file/roadmap line unchanged.
**Owned files:**

- `docs/playtests/2026-07-19-game-engine-acceptance.md` (new)
- `README.md`
- `CLAUDE.md`
- `game/CLAUDE.md`
- non-M3 sections of `docs/ROADMAP.md` only after asset-lane coordination

### F1.1 — Verify automated lifecycle exhaustiveness

- [ ] Run the route-class automated table proving launch → terminal result → idempotent commit → authority-owned return for campaign, planet, special, operation, Colony exploration, and POI.
- [ ] Validate all 40 campaign descriptors and every authored phase/mode dispatch.
- [ ] Run all standard gates from a clean install on the candidate integration history.

### F1.2 — Complete route × device acceptance

- [ ] Fill every design matrix cell with commit, fixture, expected/observed outcome, and screenshot/trace reference.
- [ ] Live-play representative first/middle/final campaign missions and every distinct boss/multi-phase transition; use the automated engine/outcome table—not a test-only browser mutation API—for remaining terminal exhaustiveness.
- [ ] Browser-launch all ten planet missions, prove all ten terminal paths in Node, and fully live-play each objective kind plus all defend routes.
- [ ] Verify Kepler locked/first-clear/cleared policy.
- [ ] Verify all Galaxy anchors, three operations, Region/POI outcomes, travel interruption/resume/finalize/retreat, and write/conflict retry.
- [ ] Verify Colony planner/governance, exterior/interior exploration, and Atlas/landing-pad/cockpit provenance.
- [ ] Repeat required routes for keyboard, pointer, and real touch at 480×854.
- [ ] Reload after every durable outcome class and compare expected save revision/journal/effects.
- [ ] A cell may be `unavailable` only if the design excludes it, the UI prevents it, and the conductor records the reason; “not tested” is failure.

### F1.3 — Reconcile docs test-first

- [ ] Add an `rg`-based truth checklist that fails on stale “no test framework,” Colony “coming soon,” and Atlas feature-branch wording.
- [ ] Update root/game guidance with actual Node, browser, and deployment-parity commands and their proof boundaries.
- [ ] Update README Colony status without overstating completeness.
- [ ] Update Atlas roadmap status and link the acceptance receipt.
- [ ] If `ASSET_ACCEPTED_REF` is unset, do not edit the M3 roadmap section. If set and integrated, cite only its accepted handoff.

### F1.4 — Close with tested code and evidence SHAs

- [ ] Commit runtime/docs changes that do not depend on a receipt and record the code SHA.
- [ ] Run all standard gates and the full live matrix on that exact clean code SHA.
- [ ] Write/update the handoff receipt referencing the tested code SHA; commit it separately and record the evidence SHA.
- [ ] Rerun standard automated gates on the exact evidence SHA and obtain cold design-compliance and quality/integration reviews.
- [ ] Fix findings in a new code commit, retest that SHA, then update the receipt in a new evidence commit and repeat reviews.
- [ ] Hand off tested code SHA, final evidence SHA, test totals, browser traces, build results, asset accepted ref or reservation, open proof gaps, and recommended merge order.
- [ ] Final candidate message: `docs(release): reconcile game engine acceptance truth`.

## Conductor dashboard

Track each package with:

| Field | Allowed values |
|---|---|
| Contract | reviewed / accepted |
| Base SHA | exact commit |
| File ownership | confirmed / conflict |
| Red proof | missing / recorded |
| Implementation | not started / active / code complete |
| Focused tests | pending / pass / fail |
| Standard gates | pending / pass / fail |
| Browser/live receipt | pending / partial / accepted |
| Spec review | pending / pass / findings |
| Quality review | pending / pass / findings |
| Integration | blocked / candidate / merged |

No package becomes `candidate` while a field is `missing`, `conflict`, `fail`, `partial`, or `findings`.

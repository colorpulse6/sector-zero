# Game Engine Conductor Design

**Date:** 2026-07-19
**Status:** Approved for autonomous planning and execution by the project owner
**Authority:** The live repository and dated acceptance receipts; this document governs synchronization sequencing, not game vision
**Companion audit:** `docs/audits/2026-07-19-game-engine-synchronization-audit.md`

**Execution checkpoint — 2026-09-05:** H0 through A3 are accepted; A3 evidence `e5495fe770adfd33c3cb7978ae4e3656eb3a2394` is the B1 base. B1 implementation and exact clean-code gates pass at `2bf65f253a6bef845199f493b3211de3049810df`, including the catch-up input-boundary correction found in quality review; the dated B1 handoff identifies the matching evidence-commit gate/review verdict required before B2. Resolved Galaxy operations do not offer gameplay retry; failure/retreat retain their accepted catalog folds. Visible touch controls remain B2, general focus/navigation B3, and full authored POI delivery plus the complete route/device matrix F1. Exact SHAs, gate totals, proof limits and asset reservations are recorded in the implementation plan and handoffs.

## Purpose

Sector Zero has many individually functional systems, but its release risk now lives between them: launchers construct different state, input devices express different capabilities, alternate modes bypass shared lifecycle rules, assets and renderers disagree about geometry, and documentation can lag the shipped game.

The conductor program makes those seams a first-class product surface. Its goal is not to redesign the game or centralize every engine. Its goal is to establish one acceptance spine from content declaration through launch, play, completion, persistence, presentation, and documentation.

## Outcome

At the end of this program:

1. Every shipped mission route can launch, render its meaningful state, complete or fail deterministically, commit its terminal outcome idempotently, and return to a surface owned by the active persistence authority.
2. Keyboard, pointer, and touch produce the same semantic navigation and gameplay intentions where the mode supports them.
3. Dialogue, briefings, mission identity, enemy identity, and campaign chronology agree with actual gameplay.
4. Renderer geometry, asset validation, and runtime loading use the same declarations.
5. Colony, Galaxy, campaign, planet, and special-mission state cross boundaries only through named projections/adapters.
6. Tests, live-play receipts, and evergreen docs all describe the same release state.

## Non-goals

- Rewriting `Game.tsx` or every engine into a new framework solely for stylistic consistency.
- Registering unfinished M3 assets or changing files in the active asset-agent worktree.
- Adding new missions, modes, progression systems, or visual variants before current routes satisfy release gates.
- Treating all engines as identical. Each mode may retain specialized simulation and rendering behind shared boundary contracts.
- Merging or publishing work without a bounded implementation, review, and verification record.

## Operating model

The conductor owns:

- severity and release gates;
- dependency order and file-ownership boundaries;
- cross-system contracts;
- delegation briefs and acceptance criteria;
- independent specification and code review;
- repository truth, proof receipts, and final integration recommendation.

Execution agents own bounded work packages. They may make local decisions inside the written contract, but must escalate scope changes that alter another lane, save compatibility, content policy, or asset requirements. A fresh reviewer checks specification compliance before a separate quality review.

The conductor does not count activity as progress. A work package is complete only when its behavior and integration proof are both accepted.

## Approaches considered

### A. Contract-led conductor program — selected

Create a small set of cross-system contracts, then close ranked defects in dependency-ordered work packages. Keep specialized engines, use narrow adapters, and require the same acceptance chain for each route.

**Why:** It attacks integration risk directly, allows safe delegation, and minimizes broad file conflicts while preserving the game’s existing architecture.

### B. Monolithic stabilization branch — rejected

Fix every issue in one long-lived branch and perform a large final integration.

**Why not:** `Game.tsx`, shared engine state, and renderer registries would become conflict magnets. Review would conflate behavioral changes, content corrections, performance work, and docs.

### C. Independent issue queue — rejected

Hand each visible defect to an agent with no shared contracts or dependency plan.

**Why not:** This reproduces the current failure mode: local fixes can pass while launch, input, save, presentation, or documentation remains inconsistent elsewhere.

## Protected boundaries

1. `/private/tmp/sector-zero-m3-hub-assets` remains asset-agent-owned. No conductor package edits it, rebases it, or uses it as a scratch dependency.
2. Until the asset lane publishes `ASSET_ACCEPTED_REF`, the following are reserved: `docs/assets/**/m3-hubs/**`, `game/public/sprites/interiors/m3/**`, `game/public/sprites/walls/cantina.png`, `game/public/sprites/boarding/npc-hub-*.png`, `game/public/sprites/portraits/hub-*.png`, `game/scripts/sprites/validateM3HubAssets.ts`, `game/tests/sprites/m3HubAssets.test.ts`, its M3 plan, and the M3-specific roadmap section. `ASSET_ACCEPTED_REF` is currently unset; active HEAD or uncommitted files are not acceptance.
   The reservation also includes `docs/assets/2026-07-12-asset-pipeline-free-options.md` and `docs/assets/prompts/README.md`, which the active asset branch already owns.
3. Asset-only acceptance remains separate from runtime registration and live-play proof. The asset lane lands or is explicitly parked before any conductor package edits its reserved families. An unrelated fighter-atlas correction uses a separate artifact/branch.
4. Canonical save changes require explicit migration/default behavior and round-trip tests.
5. Galaxy simulation remains projected and merged through its adapters; legacy mutable save state must not leak into an active Galaxy experience.
6. Colony slices remain state-owned by Colony services and adapters; shell work may navigate them but must not duplicate their progression logic.
7. Shared shell changes must be surgical. Extract a seam only when it reduces repeated contract violations in the package at hand.
8. Each implementation branch declares exact files before work starts. Packages with overlapping ownership execute sequentially.

## Core contracts

### Mission descriptor

Every launchable route exposes a normalized descriptor:

```ts
interface MissionDescriptor {
  id: string;
  kind: "campaign" | "planet" | "special" | "operation" | "colony";
  title: string;
  locationLabel?: string;
  objectiveLabel: string;
  controlsProfile: ControlsProfileId;
  replayPolicy: "repeatable" | "one-shot" | "replay-variant";
}
```

The renderer does not infer mission identity from `world` and `level`. Those coordinates may remain simulation inputs but are not presentation authority.

### Launch context

All entry, retry, continue, and operation adapters construct one launch context:

```ts
interface LaunchContext {
  launchId: string;
  mission: MissionDescriptor;
  pilot: PilotLoadout;
  persistenceAuthority: "legacy" | "galaxy";
  entryProvenance: "selector" | "cockpit" | "star-map" | "atlas" | "region" | "landing-pad" | "retry" | "continue";
  returnTarget: ExperienceRoute;
}

interface PilotLoadout {
  upgrades: ShipUpgrades;
  unlockedEnhancements: EnhancementId[];
  pilotLevel: number;
  allocatedSkills: SkillNodeId[];
  equippedWeaponType: WeaponType;
  equippedConsumables: ConsumableId[];
  consumableInventory: Partial<Record<ConsumableId, number>>;
}
```

Mission kind describes content. Persistence authority describes which canonical namespace may change. Entry provenance describes the invoker/surface and never grants capability. Return target is an owned navigation destination. Colony is a mission/surface kind that inherits either legacy or Galaxy authority; it is not a third top-level authority. Galaxy's existing `OperationLaunchContext` remains a separate authorization proof; the generic `LaunchContext` is attached to the resulting gameplay state and never replaces or widens that operation type.

Every constructor resets its module-global build caches from `PilotLoadout`. Non-default weapon and skill tests run back-to-back across route types to expose stale global state.

Mutable attempt state is never authoritative only in a module singleton. Planet hazards live on the active `GameState` (or an explicit state-owned render input), and enemy spawn difficulty/class are rebound from attempt-owned state before any spawn. Constructing a later attempt cannot replace the hazards or spawn policy belonging to an earlier state object. Constructors also cannot reset shared ID allocators in a way that lets two live attempts issue the same enemy, bullet, label, or power-up identity.

Every dynamic descriptor component is encoded collision-safely. Descriptor factories and constructors both reject unknown/mismatched registry identity and invalid authority/provenance/return combinations; a factory-only check does not secure a public constructor.

Galaxy projection validation is single-snapshot: it records the exact consumed fields once, builds gameplay loadout from those captured values, and never re-reads the caller object. The validator permits unrelated future canonical save fields while still rejecting accessors, functions, malformed consumed fields, and projection/run disagreement.

### Mission lifecycle

Every engine participates in explicit lifecycle events:

```text
launch -> mission_start -> phase/wave events -> objective terminal
       -> completion dialogue policy -> outcome -> persist -> owned return
```

- A mission must have a reachable success or failure condition.
- Shared dialogue ticks in every mode.
- Terminal effects commit through the idempotent outcome contract below before success UI claims durable completion.
- Gameplay retry preserves mission, loadout, authority, and return target, records `entryProvenance: "retry"`, and creates a new `launchId`, because it is a new attempt with a legitimate independent outcome. Continue preserves the same fields, records `entryProvenance: "continue"`, and also creates a new `launchId`. Persistence retry reuses the same `outcomeId`, because it is retrying one terminal commit rather than replaying the mission.
- Return navigation cannot expose a different experience’s mutable launchers.

Selected mission policies:

- Defend completes only after the final authored wave has spawned, no active enemies/boss remain, and the structure is alive. Zero structure HP fails.
- Kepler is one-shot. A cleared Kepler remains visible as `CLEARED`, cannot be activated, and is rejected by the launch guard.

### Outcome commit

Every attempt receives a stable `launchId`. A terminal result derives `outcomeId = launchId + terminalKind`. Save migration adds a monotonic `saveRevision`, a bounded journal of applied outcome IDs, and bounded versioned `outcomeRecoveryRecords`. Recovery records are canonical data, not React/session state: they retain applied-but-unacknowledged return ownership, the validated `missionId`, route kind, and route identity needed to reconstruct the exact destination surface, and Legacy prepared-outcome identity. A generic return enum is not sufficient for a POI origin, Colony interior, or other parameterized route. Galaxy prepared POI identity remains in its canonical Galaxy history record and is not copied into Legacy authority.

The durable outcome envelope is serializable. It names a route kind, canonical route identity, versioned route payload, launch/outcome/terminal identity, persistence authority, owned return target, expected revision, exact declared fields, and their launch snapshot. It does not serialize or accept an arbitrary fold function, normalized catalog reward, cargo definition, or final save patch. Route-specific pure fold implementations live in a registry and receive only their registry-owned declared field projection; runtime validation rejects caller-chosen field tuples, undeclared reads/writes, cross-route substitution, and authority-incompatible declarations.

The coordinator contract is:

```ts
commitOutcome(canonicalStore, outcomeEnvelope):
  | { status: "committed"; save: SaveData }
  | { status: "already_applied"; save: SaveData }
  | { status: "conflict"; latest: SaveData }
  | { status: "write_failed"; error: Error }
```

1. The coordinator reads the latest canonical root from the store immediately before validation. If `outcomeId` is journaled, return `already_applied` without rewards or progression changes.
2. Each outcome declares the exact authority fields its registry fold reads or writes and snapshots those fields at launch. If the revision is stale, rebase is allowed only when the outcome is already applied or every declared field is deep-equal to its launch snapshot; any changed or undeclared dependency returns `conflict`. The default is conflict, never silent overwrite.
3. For a new valid outcome, pure-fold against the latest declared projection, merge only declared output, append the outcome ID plus an owned return recovery record, increment revision, and write the whole save.
4. Do not advance UI until the write returns. A failed write retries the same outcome ID. If a write throws, reread before reporting failure: `already_applied` requires an unlocked root, the exact unique versioned return receipt and revision, required root/nested/operation-owner journal parity, and the committed declared effects. A journal ID alone is not proof of the whole-save write. Write-success followed by UI loss is recovered from the canonical return record after reload. That receipt carries the immutable validated route identity required to mount the owned target; the shell must not infer an origin from current UI or a mutable run cursor. Acknowledging that return is a separate revisioned mutation performed only after the exact target surface mounts.
5. The bounded journal retains enough history to cover every ID named by a valid durable recovery/preparation record. Pruning drops only the oldest unprotected IDs; if protected records alone exceed capacity, commit fails closed instead of dropping reachable proof.
6. Any durable prepared outcome carries its original `launchId`, derived `outcomeId`, persistence authority, return target, declared-field snapshot, and payload version. Reload recovery reconstructs that same outcome identity; it never invents a replacement from the current UI session. Existing prepared Galaxy POI payloads migrate explicitly or fail closed with a recoverable reconciliation state.
7. Galaxy operation failure and retreat are real catalog-owned folds, not generic no-ops. Non-operation failure/retreat and Colony takeoff are explicit domain-noop, journal-only terminals. Every Galaxy-authority terminal, including a domain-noop POI or Colony terminal, writes the same outcome ID to root and nested Galaxy journals as coordinator-owned metadata; one-sided evidence is a reconciliation conflict.
8. Legacy prepared POI data stores a command and immutable route identity, never caller-provided cargo or cycle patches. Galaxy preparation remains a unique versioned Galaxy history fact. Its final fold may rebind the staged snapshot only when the prepared revision and fact are exact and no intervening canonical write occurred.
9. Prepared POI codecs and run-only Galaxy folds remain in a pure lower layer. The coordinator registry must not import a shell adapter that imports POI runtime back into the coordinator graph.
10. Every public commit, preparation, recovery, and acknowledgement entry point is total over hostile serialized/store input. Accessors, sparse or proxy-backed arrays, malformed records, and clone traps return the API's `conflict`/`null`/failure result without escaping an exception or being reread after validation. Constructors may throw for invalid programmer-supplied launch requests, but durable reload/retry APIs fail closed.
11. Before a new dynamic POI or Colony outcome is journaled, the coordinator revalidates its origin, node/template/adapter/reward eligibility, Colony mode, and building identity against one descriptor-safe snapshot of the latest inherited authority. This check occurs after exact already-applied journal/receipt reconciliation so a legitimate retry remains idempotent after success changes node state. POI durable route binding includes the explicit origin, so substituting a second otherwise-valid Colony cannot reuse the launched mission binding. Accessors or changing proxies are rejected without invocation or preservation.
12. Root validation treats pending return receipts as authority: every pending receipt must name an outcome present exactly once in the root journal and have `appliedRevision <= saveRevision`. Every nested Galaxy journal ID must exist in the root journal; every pending Galaxy receipt must exist in the nested journal, and operation receipts require one exact operation owner. Incoherent historical authority conflicts before any new commit and is never copied forward. Only truly absent fields in a genuinely pre-A3 save may migrate to empty defaults; a present `null`, `undefined`, accessor, malformed journal, or recovery container becomes an explicit reconciliation lock. Migration never invokes outcome-container getters or silently converts corrupted authority to an empty history.
13. Recovery identities are unique, and at most one Legacy prepared outcome may exist at all. Duplicate pending/prepared outcome identities or two distinct preparations fail closed during migration and runtime validation; acknowledgement never updates only one of several matching records or treats a first-match reread as proof.
14. Migration may retain a prepared outcome only when that exact preparation is recoverable against the migrated canonical revision and declared-field snapshot. A syntactically valid but future-revision or drifted preparation becomes an explicit reconciliation record rather than an invisible permanent staging lock.
15. Galaxy preparation is a canonical transaction in the active Galaxy namespace. It consumes one exact own-data snapshot of a versioned attempt, including canonical mission/origin binding, root revision/journals/reconciliation state, active experience, nested run authority, and absence of conflicting prepared facts before incrementing revision. It never rereads the caller attempt while constructing the fact or return value; any preparation it writes must be recoverable as the same returned attempt by the paired recovery API. Old, malformed, or ambiguous reserved preparation facts become explicit reconciliation state rather than an unrecoverable permanent staging lock.

### Semantic input

Physical inputs translate at the shell boundary into semantic intents:

```ts
type UiIntent =
  | { type: "move-selection"; direction: Direction }
  | { type: "activate" }
  | { type: "back" }
  | { type: "point"; x: number; y: number };

type GameplayIntent =
  | { type: "move"; vector: Vector2 }
  | { type: "primary" }
  | { type: "secondary" }
  | { type: "jump" }
  | { type: "dash" }
  | { type: "pause" };
```

Active surfaces decide what intents they support. A physical key or gesture does not directly set multiple engine booleans. Focus follows the interaction model: navigation retains its control loop; activation may move focus to newly opened content; closing restores the actual invoker.

The selected touch contract uses visible, accessible DOM controls paired with the canvas. Movement and action clusters occupy a reserved footer so they do not obscure the dashboard, dialogue or player; turret aiming remains an overlay aligned to the actual gameplay image. The footer keeps its own width while the canvas scales to the available height, including on narrower phones.

| Mode | Movement/aim | Primary | Secondary |
|---|---|---|---|
| Shooter/planet | left pad moves; drag-to-position remains supported | hold fire | bomb |
| Ground | left/right move; up/down aim | hold fire | jump |
| Boarding | 8-way left pad moves/faces | hold fire | dash |
| First-person/Colony | left pad moves forward/back and strafes; right look pad turns | fire/interact/advance | none |
| Turret | pointer/touch position owns crosshair | fire | none |

Touch controls clear on touch cancel, blur, pause, and surface transition. Briefings label the active profile. Keyboard and pointer remain fully supported; touch is not a hidden gesture-only route.

Navigation focus policy is also explicit:

| Surface | Modal/containment | Initial focus | Escape/close | Return focus |
|---|---|---|---|---|
| Atlas | full-screen owned surface; contain Tab | selected contact | exit to experience selector | `CONTINUE GALAXY`/Galaxy choice |
| Region | modal; trap Tab | selected region option | close to invoking surface | actual Atlas, landing-pad, or cockpit invoker |
| Colonies | modal; trap Tab | selected Colony action | close to cockpit | `COLONIES` hotspot/button |
| POI Outcome | mandatory modal; trap Tab | primary resolution action | Escape blocked with resolution-required status | Region for Galaxy; exploration/landing pad for Legacy after resolution |
| Exit Menu | modal; trap Tab | Resume | close/resume exploration | focusable game canvas |

### Render and asset geometry

Multi-frame and aspect-sensitive assets have one manifest declaration containing source path, frame count/rects, logical anchor, and display aspect. Runtime renderers and validation consume the declaration. Mission render composition explicitly layers common engine visuals with mode- or planet-specific visuals.

### Combat event

Every enemy defeat emits a canonical event containing enemy identity, class, mode, and cause. Bestiary progression consumes that event. For this synchronization program, class `damageMult` remains lore-only: numeric combat-effect claims are removed or relabeled rather than changing balance across all modes without a balance specification.

### Experience projection and persistence

Galaxy and Colony state are not alternate names for the legacy save object. The shell calls named projection/merge adapters, commits through the outcome contract, and only then navigates. Persistence authority, surface kind, action capability, entry provenance, and return target are separate values.

## Work lanes

### Lane A — release liveness and state integrity

- Complete defend-objective semantics for Ossuary, Genesis, and Bastion.
- Connect planet rendering to the active composition.
- Enforce the selected Kepler one-shot policy across list, launch guard, and completion history.
- Normalize descriptor route identity and full pilot/loadout across direct launch, planet launch, retry, continue, special, operation, and Colony/POI routes.
- Repair only the Mission Board activation path needed to prove Kepler policy across keyboard, pointer, and touch; general semantic input and modal focus remain Lane B.
- Close the Galaxy-to-legacy cockpit escape and prove canonical projection/merge boundaries.
- Commit terminal outcomes idempotently and surface write/conflict failure before navigation confirms success.

### Lane B — input and navigation

- Introduce semantic input adapters for keyboard, pointer, and touch.
- Remove Space double-actions by active-mode mapping.
- Make map/cockpit/Atlas/Region/Colony navigation reachable at 480×854.
- Apply one modal focus/restore contract.
- Separate capability from entry provenance.

### Lane C — content and lifecycle coherence

- Populate mission presentation descriptors and briefing identity from the Wave 0/1 route contract.
- Define mission-start, wave-start, alternate-mode tick, and completion-dialogue behavior.
- Correct campaign chronology copy.
- Make phase payloads explicit where alternate modes currently fall back to default fixtures.

### Lane D — rendering and combat coherence

- Correct turret fighter frame geometry and aspect through shared manifest data.
- Align sheet validation with renderer assumptions.
- Unify bestiary defeat accounting and mark class multipliers lore-only.
- Align hit geometry with visible geometry.
- Preserve enemy identity across boarding/first-person/turret variants.
- Measure sprite loading and post-processing before optimizing them.

### Lane E — proof and repository truth

- Add integration-level contract tests around launch, completion, save, return, and input dispatch.
- Maintain a route-by-device acceptance matrix.
- Capture live-play receipts at desktop and 480×854.
- Reconcile README, roadmap, root/game guidance, and dated playtest status.
- Keep evergreen docs factual; keep temporary measurements in dated audit/playtest artifacts.

## Execution waves and dependencies

### Wave 0 — executable contract net

Add the browser harness and deterministic save fixtures. Define the core mission descriptor, complete pilot loadout, persistence authority/provenance/return route, stable launch/outcome identity, and route-by-device matrix schema. Build test helpers that enumerate launch routes, mission terminal behavior, semantic input dispatch, experience ownership, persistence results, and renderer dispatch. Behavior tests must be shown failing against the baseline before implementation.

### Wave 1 — release blockers

Close Lane A in small sequential packages because its work overlaps `Game.tsx` and shared engine state. Planet liveness/render composition may proceed independently of shell launch/outcome normalization only if file ownership is disjoint. Core descriptor/route ownership and persistence-result contracts are Wave 1 work; briefing prose may wait for Wave 3.

Exit condition: every currently launchable mission class has an automated launch → terminal outcome → idempotent commit → authority-owned return test, plus correct pilot build and deterministic write/conflict behavior.

### Wave 2 — interaction shell

Implement Lane B after launch ownership is stable. Input adapters must target the normalized routes and must not encode obsolete shell states.

Exit condition: keyboard, pointer, and touch can traverse every required matrix cell; no key produces accidental double action; touch uses the selected visible controls; modal focus behavior has browser receipts.

### Wave 3 — content and render coherence

Lane C presentation work and Lane D geometry work may run in parallel only with exact disjoint files. Dialogue lifecycle, alternate-mode input, and combat-event plumbing all touch shared update paths and therefore execute sequentially. Shared `Game.tsx` integration occurs through sequenced conductor-owned commits.

Exit condition: mission identity, dialogue, enemy visuals, hit behavior, and bestiary state agree with play and save state.

### Wave 4 — measured performance and truth pass

Run a measurement-only package with a pinned browser/profile protocol and thresholds. Optimization packages are authorized only for breached thresholds. Then run the full acceptance matrix and reconcile documentation after the asset lane has landed or its roadmap section is reserved unchanged.

Exit condition: production build, automated suites, live route/device matrix, reload checks, and docs all agree. Any waived route is explicitly marked unavailable rather than silently broken.

## Delegation protocol

Each work package brief includes:

1. branch/worktree and exact file ownership;
2. user-visible defect and contract being enforced;
3. test that must fail first;
4. implementation constraints and protected boundaries;
5. focused and broader verification commands;
6. live receipt requirements;
7. explicit non-goals;
8. handoff format: commit, files, tests, remaining risks, and screenshots/receipts.

The conductor reviews every package in this order:

```text
scope/contract -> failing-test proof -> implementation -> focused tests
-> broader suites/build -> live integration -> docs truth -> merge recommendation
```

Specification compliance and code quality are separate reviews. A package that passes tests but violates ownership, persistence, presentation, or input contracts is rejected.

## Acceptance matrix

### Automated gates

- TypeScript compile.
- Focused engine/component tests with a recorded red-to-green transition.
- Full engine suite.
- Full Colony suite.
- Sprite/asset validation suite.
- Local production static export/build.
- Deployment-parity build with `NODE_ENV=production NEXT_PUBLIC_BASE_PATH=/sector-zero`.
- Playwright Chromium desktop and 480×854 touch projects.
- Save serialize/deserialize and legacy-default coverage for any state change.

### Route × device gates

Every cell is tracked as `required`, `pass`, `fail`, or `unavailable`. `Unavailable` requires a design-level exclusion, user-visible prevention of that input route, and conductor approval; it cannot mean “not tested.” The release target makes all cells below required.

| Route/surface | Keyboard desktop | Pointer desktop | Touch 480×854 |
|---|---:|---:|---:|
| Selector, cockpit, Star Map, briefings | required | required | required |
| Campaign shooter: launch/retry/next/complete | required | required | required |
| Planet objectives, including all defend routes | required | required | required |
| Kepler locked/first-clear/cleared | required | required | required |
| Galaxy Atlas/travel/close/operation outcome | required | required | required |
| Region/POI/outcome and Colony planner | required | required | required |
| Colony exterior/interior exploration and return | required | required | required |
| Ground | required | required | required |
| Boarding | required | required | required |
| First-person | required | required | required |
| Turret | required | required | required |
| Boss and multi-phase transitions | required | required | required |

Presentation overlays also require repeated arrow navigation/focus restoration, relevant enemy sprites at native and scaled presentation, dialogue start/long completion/skip/mode transitions, and reload after every durable outcome class.

### Receipt requirements

Each live receipt records commit, viewport/device, route, input method, save fixture, expected outcome, observed outcome, and any screenshot or console evidence. “Looks good” is not a receipt.

## Documentation model

- This design defines conductor authority and system contracts.
- The companion audit records ranked observations and proof gaps.
- The implementation plan defines exact work packages and commands.
- Per-package handoffs record branch/commit and verification evidence.
- Dated playtest receipts record live behavior.
- README/roadmap/guidance describe only current, durable truth.

One document has one job. Asset-only acceptance remains separate from runtime and playtest proof.

## Stop conditions

The conductor pauses a package—not the whole program—when:

- it would overwrite the protected asset lane;
- it discovers a materially different replay, narrative, progression, control, balance, or persistence choice not pinned here;
- it requires an incompatible save migration;
- live proof contradicts the written contract;
- three consecutive attempts hit the same external blocker.

Otherwise, work continues autonomously through the next safe package.

## First release decision

The first executor package is the Wave 0 browser/fixture/contract harness because later live and focus claims are otherwise untestable. The first behavioral package is planet mission integrity: implement the selected defend completion rule, connect planet render composition, and prove all current planet objectives can reach a terminal state without touching the M3 asset lane. Launch/outcome integrity follows before interaction work.

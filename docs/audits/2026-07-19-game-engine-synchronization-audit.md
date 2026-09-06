# Game Engine Synchronization Audit

**Date:** 2026-07-19
**Baseline:** `main` at `6744a49` (`Merge pull request #16 from colorpulse6/feat/g0-galaxy-atlas`)
**Status:** Historical baseline audit; H0, A1, A2, and the A3.1 pure authority layer are accepted, while shell integration, later findings, and whole-game live-play rows remain open
**Scope:** Campaign, planet missions, special missions, Colony/Atlas integration, dialogue, input/navigation, rendering, combat semantics, tests, and documentation

**Execution note:** Package A2 is accepted at code `ec524822f7bd60d5a2842e187fb6d714e912d9b9` and evidence `cc9a4dd7aaa5b61a8e678057bcedd6d80de325db`. A3.1 is accepted at code `8ccfa3d345fbb330cac7c9185fc7e6507a72d519`; its 81 focused reviewer tests, 404 engine tests, 288 Colony tests, 4 sprite tests, 20 browser tests, TypeScript, and both production exports passed, and independent specification and quality reviews returned PASS. A3.1 closes the pure coordinator, migration, journal/recovery, and POI preparation foundation, but not the shell-level outcome finding. The ranked observations below remain the baseline record; current checkbox truth and residual proof gaps live in the implementation plan.

## Boundary

The active M3 asset lane in `/private/tmp/sector-zero-m3-hub-assets` is protected. This audit does not change its files, register its assets at runtime, or make claims about its unfinished deliverables. Runtime integration must consume that work only after its own asset acceptance gate passes.

## Method and baseline evidence

The audit traced launch, update, render, completion, persistence, and navigation paths across the game shell and mode engines. Three independent passes covered campaign/dialogue, navigation/Colony, and rendering/combat. Findings below distinguish source-observed defects from hypotheses that still need live confirmation.

Baseline verification in a clean worktree:

- `npx tsc --noEmit`: passed.
- `node --import tsx --test tests/engine/*.test.ts`: 282/282 passed.
- Colony tests: 284/284 passed.
- Sprite tests: 4/4 passed.
- `COREPACK_ENABLE_PROJECT_SPEC=0 yarn build`: passed, including static export.
- The live-play matrix must still be run before release; it is not implied by the checks above.

## Severity model

- **S0 — release blocker:** a shipped route is unwinnable, critical content is disconnected, or canonical state can be mutated through the wrong experience boundary.
- **S1 — major:** a supported input, presentation, progression, persistence, or combat contract is materially wrong.
- **S2 — coherence/debt:** content or architecture is inconsistent and likely to become a release defect, but does not yet block the main route.
- **Proof gap:** plausible risk requiring measurement or a live receipt before severity is final.

## Ranked findings

### S0 — planet mission liveness is broken

**Observed:** Ossuary, Genesis, and Bastion declare `objective: "defend"` in `game/app/components/engine/planets.ts:108`, `:184`, and `:221`. The defend branch in `objectives.ts:306` applies damage and failure, but does not set `objective.completed`. Planet mission completion in `gameEngine.ts:760` waits for that flag.

**Impact:** Three authored planet missions can survive forever without reaching the completion transition.

**Selected contract:** A defend objective completes after the final authored wave has spawned and the encounter has no active enemies or boss, provided the structure is still alive. It fails only when the structure reaches zero HP. Completion wins if both terminal checks would otherwise occur in the same update after the last threat is removed, because the structure necessarily survived that encounter update. Each defend planet needs a deterministic engine test and a live completion receipt.

### S0 — authored planet presentation is not connected to the active renderer

**Observed:** `planetRenderer.ts` exports planet background, structure, objective, and civilian drawing functions, but no runtime file imports them. The active engine still advances planet-specific objectives and hazards.

**Impact:** Planet-only authored state does not have a complete presentation path. This is particularly dangerous where visible structures or objective state teach the player what to protect or reach.

**Required contract:** Planet missions use one explicit render composition that draws their authored background and gameplay-significant state without suppressing the common shooter layer. Tests must prove dispatch; live receipts must prove correct layering and legibility.

### S0 — cleared Kepler replay remains launchable but has no completion target

**Observed:** Special-mission availability is based on unlock state rather than completion state in `specialMissions.ts`. The replay form intentionally suppresses the black-box pickup in `keplerBlackBoxMission.ts`, while first-person completion in `firstPersonEngine.ts:489-511` requires either an objective pickup or a goal tile.

**Impact:** A cleared mission can be launched again into an unwinnable state.

**Selected contract:** Kepler is a one-shot story mission. After clear it remains visible as `CLEARED`, is not selectable as a launch action, and is rejected by a defensive launch guard. The first-clear fixture remains unchanged; no replay variant is invented.

### S0 — Galaxy close can escape into mutable legacy cockpit state

**Observed:** The Atlas close callback in `Game.tsx:2399` opens the normal cockpit while the active experience remains Galaxy. That cockpit can launch legacy levels and planet missions, which mutate top-level campaign save paths. The canonical Galaxy operation projection and outcome adapters are otherwise isolated.

**Impact:** A user can leave the Atlas surface without actually leaving the Galaxy experience, then trigger mutation paths outside the Galaxy projection/merge contract.

**Required contract:** Experience ownership is explicit. Closing or backing out of Galaxy must either remain inside Galaxy-owned navigation or perform a single tested experience exit before any legacy launcher becomes reachable.

### S1 — launch and retry paths do not preserve pilot build consistently

**Observed:** `createGameState` and `createPlanetGameState` accept `pilotLevel` and `allocatedSkills`. Direct `startLevel` and `startPlanetMission` paths beginning at `Game.tsx:583` omit them, as do some retry paths near `Game.tsx:936`; other special, auto-next, and operation paths pass them. All three constructors hardcode `equippedWeaponType: "kinetic"` even though it is saved player-selected state, and operation adapters omit it. Planet creation also does not reset module-global `currentAllocatedSkills`, while power-up behavior reads that global.

**Impact:** Player power can differ depending on how the same content is launched or retried. A non-default weapon silently reverts, and a planet launched after another mission can inherit stale module-global skill behavior even when its visible state says otherwise.

**Required contract:** All launch/retry/continue adapters construct an identical `PilotLoadout` containing upgrades, unlocked enhancements, pilot level, allocated skills, equipped weapon type, and any equipped/owned consumable state actually consumed during play. Constructors reset every module-global build cache from that value. Contract tests enumerate every supported launcher and include non-default, back-to-back launches that would expose stale globals.

### S1 — terminal outcomes lack one shared idempotent commit contract

**Observed:** Campaign, planet, special, Galaxy operation, and Colony/POI terminal handling is orchestrated through separate shell branches. Some paths have duplicate-application guards, but there is no one launch identity/outcome identity contract spanning write success, retry, reload, and UI transition.

**Impact:** A write failure, repeated callback, or write-success/UI-failure can be handled differently by route. Green engine tests do not prove rewards and progression apply once.

**Required contract:** Each attempt has a stable launch ID; each terminal result has a stable outcome ID. A testable commit coordinator loads the latest authority-owned state, returns `already_applied` for a journaled outcome, applies and journals a new outcome atomically, increments a save revision, and confirms UI transition only after persistence succeeds. Tests cover duplicate callbacks, write failure then retry, write success followed by UI loss/reload, and stale revision conflict handling.

**Current execution status (2026-07-21):** A3.1 accepts the pure coordinator and durable authority foundation at `8ccfa3d345fbb330cac7c9185fc7e6507a72d519`. Shell route integration, durable return-surface restoration, and live reload receipts remain open under A3.2/A3.3, so this finding is not yet closed.

### S1 — mobile and pointer navigation do not cover the shipped game surface

**Observed:** Canvas touch handlers beginning at `Game.tsx:1713` primarily synthesize shoot/bomb state. Cockpit subscreen taps can back out instead of activate, the Star Map has no equivalent touch route, and mouse Star Map selection does not complete level selection. Alternate engines receive keyboard keys and do not share a complete touch intent model.

**Impact:** A normal 480×854 touch viewport cannot reliably navigate and play major portions of the game. Pointer users also hit partial navigation contracts.

**Required contract:** Keyboard, pointer, and touch translate into semantic actions owned by the active surface. The same focus/selection/action model drives all three, with device-specific gestures only at the adapter edge.

### S1 — Space is bound to conflicting semantic actions

**Observed:** The shell maps Space to both shoot and jump. Ground and boarding engines consume those actions independently, producing simultaneous fire/jump or fire/dash behavior.

**Impact:** One key can trigger an unintended second action in modes where both actions are valid.

**Required contract:** Bind physical inputs by active mode to named intents. No physical input may activate two gameplay intents unless that combination is explicitly authored and tested.

### S1 — Galaxy travel persistence can fail silently

**Observed:** The Galaxy travel persistence path around `Game.tsx:370` does not surface failure as the operation and Region paths do.

**Impact:** The UI can advance while durable state does not, undermining the projection/merge contract.

**Required contract:** Every canonical save mutation reports success or a user-visible recoverable failure before the UI confirms travel.

### S1 — dialogue lifecycle is incomplete across phase and mode boundaries

**Observed:** Authored `wave_start: 0` triggers exist, but shared dialogue checks `wave_start` only when `currentWave` changes in `gameEngine.ts:749`. Alternate mode update branches do not consistently advance the shared dialogue lifecycle. Level completion can transition on its timer while a longer completion dialogue is still active.

**Impact:** Opening lines can be skipped, dialogue can freeze in alternate modes, and the game can transition away before authored completion text finishes.

**Required contract:** Dialogue has explicit mission-start, wave-start, mode-tick, and completion-hold events. Completion waits on both gameplay and dialogue policy, with skip behavior defined.

### S1 — generic briefing identity leaks into planet and special missions

**Observed:** The generic briefing renderer derives numbered campaign identity and controls from `currentWorld/currentLevel`; planet constructors and Kepler encode those fields for engine reuse.

**Impact:** Non-campaign missions can be mislabeled as numbered campaign levels and receive irrelevant control copy.

**Required contract:** Briefing presentation consumes a mission descriptor with kind, title, location, objective, controls, and replay state instead of inferring identity from engine coordinates.

### S1 — turret fighter atlas geometry is wrong

**Observed:** `/sprites/turret/enemy-fighter.png` is 1536×1024. `turretRenderer.ts:93` treats it as three equal 512×1024 frames and then draws a square. Pixel-bound inspection shows frame content spilling into the assumed boundaries: frame 1 touches both horizontal edges and frame 2 touches the left edge.

**Impact:** Enemy fighters can render cropped, stretched, or with neighboring-frame contamination.

**Required contract:** The asset manifest declares exact frame geometry and display aspect ratio. Validation and renderer use that same metadata. The fix must coordinate with the asset lane without rewriting its source files.

### S1 — sprite geometry validation disagrees with renderer assumptions

**Observed:** Ground and turret renderers divide some atlases into frames, while sprite validation classifies those files with billboard-style allowances rather than the sheet manifest.

**Impact:** Validation can approve assets that the renderer will crop incorrectly.

**Required contract:** Every multi-frame image is declared once in a typed sheet registry; renderer, validator, and asset acceptance derive from it.

### S1 — combat taxonomy and bestiary accounting diverge by mode

**Observed:** Vertical shooter kills populate `pendingBestiaryKills`; ground, boarding, first-person, and turret paths do not consistently share that accounting. Bestiary class multipliers are displayed but are not applied uniformly by enemy creation/damage code.

**Impact:** The bestiary can lie about encounter history and combat modifiers, and mode-specific enemies do not participate in one coherent combat model.

**Required contract:** A shared defeat event records canonical enemy identity, mode, class, and source. Displayed modifiers either affect damage through one tested function or are clearly marked as lore-only.

### S2 — threat identity collapses in alternate modes

**Observed:** Boarding types share one grunt presentation; first-person enemy types share the same set; later multi-phase levels often reuse default/test map fixtures while labels change.

**Impact:** Later-world encounters can read as relabeled early content and make combat semantics harder to learn.

**Required contract:** Mission payloads select mode fixtures and threat presentation explicitly. Missing variants fall back visibly in development and fail asset/content acceptance before release.

### S2 — campaign copy contradicts campaign chronology

**Observed:** World 5 level 5 dialogue calls itself the final mission, while `levels.ts` contains campaign worlds 6 through 8.

**Impact:** Narrative stakes contradict the playable sequence.

**Required contract:** Rewrite the line as a local climax or move finality to the actual ending. Add a content lint/assertion for reserved chronology language where practical.

### Proof gap — eager sprite loading is a major performance risk

**Observed:** `Game.tsx:2211` calls `preloadAll()` on mount, and `sprites.ts` loads the full registry while swallowing individual failures. The public sprite set is large enough that decoded memory and startup contention require measurement.

**Risk:** Startup, memory pressure, and low-end mobile stability may be dominated by content the current route never uses.

**Required proof:** Instrument requested/decoded asset counts, time to interactive, and peak memory on desktop plus a mobile-class profile. Replace eager global loading with route/mission manifests if the measurement confirms the risk.

### S2 — focus and provenance semantics are inconsistent

**Observed:** Repeated Atlas Arrow Up/Down can lose the control because selection moves focus to the details heading. Region focus restoration can capture the selected option rather than the invoker. `"pad"` is overloaded as both permission and provenance, and several overlays do not share one modal/focus contract.

**Impact:** Keyboard and assistive navigation are brittle; labels can claim PAD provenance where the actual entry path differs.

**Required contract:** Separate capability from source, store the true invoker, and apply a shared modal focus contract to Atlas, Region, Colony, outcome, and exit surfaces.

### S2 — documentation understates shipped systems and tests

**Observed:** `CLAUDE.md:56` and `game/CLAUDE.md:12` say there is no test framework despite the active Node test suite. `README.md:24` calls Colony “coming soon” while roadmap status marks Colony phases live. The Atlas roadmap status still needs reconciliation with merged PR #16 and its remaining live-play gaps.

**Impact:** New agents and maintainers begin from false project state and may repeat or bypass existing verification.

**Required contract:** Repository docs describe the actual test commands, shipped surfaces, merge state, and remaining proof gaps. Dated playtest receipts remain separate from evergreen guidance.

### S2 — retry can double-count the same game in profile statistics

**Observed:** The profile-statistics write is invoked by the Game Over effect and again from the retry path. A retry can therefore record the completed attempt twice even though it launches only one new attempt. This profile store is separate from canonical campaign/Galaxy outcome persistence, so the A3 outcome journal does not protect it.

**Impact:** Lifetime game counts, scores, and derived profile statistics can drift upward specifically for players who retry, making progression telemetry depend on navigation choice.

**Required contract:** One attempt produces at most one profile result keyed by its stable launch identity. Retry starts a new attempt but never re-records the terminal attempt it replaces. Cover Game Over, retry, return, and reload with an exact-once lifecycle test.

### Coordination risk — M3 assets overlap validation and roadmap file families

**Observed:** The active `feat/m3-hub-assets` worktree owns M3 prompt/source/review files, accepted sprite destinations, an M3 validator and sprite test, and an M3 section of `docs/ROADMAP.md`. It also contains active uncommitted work.

**Impact:** A conductor change can avoid the worktree path yet still conflict when the asset branch lands, especially in sprite tests/validators and roadmap truth.

**Required contract:** The asset lane publishes an accepted commit SHA before integration. Until then, its exact file families and M3 roadmap section are reserved. Runtime registration is a later dependency. Conductor geometry work uses current baseline assets or a separate correction artifact; it does not route unrelated fighter fixes through the M3 branch.

## What is already structurally sound

- Galaxy projection and operation outcome adapters define a strong canonical merge boundary.
- Existing engine and Colony suites give useful deterministic coverage.
- Planet, dialogue, mission, and mode data are substantially data-driven; synchronization can improve contracts without a wholesale rewrite.
- Asset manifests and validators provide a foundation for one geometry source of truth, though classification needs correction.

## Release recommendation

Do not expand playable scope until the S0 tranche is closed. Run the synchronization program in ordered, reviewable work packages: contracts first, release blockers second, interaction shell third, content/render coherence fourth, and measured performance plus documentation last. No package is accepted on unit tests alone.

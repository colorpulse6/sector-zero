# Launch Context and Mission Policy Receipt — 2026-07-19

## Candidate

- Package: A2 — full launch/loadout ownership and core route identity
- Final branch: `fix/sync-launch-final`
- Accepted planet evidence base: `72b46743afd9bd0184fd2531ecd2a0b838e5bf7e`
- Tested code SHA: `ec524822f7bd60d5a2842e187fb6d714e912d9b9`
- Core source commits: `62d0f298c7577ae72bdc5ec51b3f2eddb3c12d1e`, `c1fb7e532cffc0af08fe55f343a8f52dd53f480b`, `2de82f60da95e4aa79e5d95183e286f036c7ff8c`, and `23a407ba684efc66cf39cb4b2bb0ccf49e629c3f`
- Shell source commit: `ad37cabe9cfaefcf383832e18eac4be5ea6b22b1`
- Asset boundary: no M3 asset, validation, roadmap, prompt, or active asset-worktree file changed; `ASSET_ACCEPTED_REF` remains unset

## Test-first evidence

### Complete attempt ownership

The first core table exposed route-specific loadout omissions, stale allocated-
skill caches, module-global planet hazards, and later constructors replacing an
earlier attempt's enemy class. The normalized `LaunchContext` now owns all seven
pilot fields, mission identity, persistence authority, entry provenance, and
return target. Campaign, planet, special, Galaxy operation, Colony, and POI
constructors consume the owned snapshot. Retry and continue mint new attempt
IDs while preserving their owned mission/loadout/authority/return contract.

Back-to-back tests prove that:

- hazards and enemy spawn policy belong to the attempt being updated/rendered;
- enemy, player-bullet, boss-bullet, power-up, and label identities are not
  recycled across simultaneously live states;
- a drifting constructor input cannot make the simulation consume values that
  differ from the cloned context;
- Galaxy operation projection is captured once and rejects invalid upgrade,
  pilot, skill, enhancement, weapon, and consumable domains;
- unrelated future save-root data is preserved without executing nested
  accessors or weakening the fields the adapter consumes.

### Route, launch, and lineage identity

The descriptor table covers 40 campaign levels, ten planets, Kepler, three
Galaxy operations, Colony exterior/interior factories, and all three POI engine
adapters. Dynamic Colony and POI components use length-prefixed identity
encoding. Constructors parse those IDs, reconstruct the canonical descriptor,
and reject malformed IDs or changed title, location, objective, controls, and
replay policy.

Launch factories reject blank and duplicate process IDs. Engine constructors
also reject mounting the same attempt twice. Unknown campaign/special routes,
descriptor-to-route mismatches, and invalid authority/provenance/return
combinations fail before a playable state is created.

Retry and continue lineage is bound to exact process-local snapshots. A child
can be minted only from the exact context of a claimed mounted attempt. The
issued child is fingerprinted, and a later mission, pilot, authority,
provenance, or return-target mutation is rejected before an adapter or engine
can mount it. Regression probes cover unmounted parents, same-ID forged
parents, mutated children, POI retries, and Galaxy operation retries.

Galaxy's `OperationLaunchContext` remains a separate authorization proof. A
Galaxy retry re-authorizes that proof and separately consumes an issued generic
retry context, preserving the original pilot snapshot. POI retries validate the
exact session, experience, descriptor, lineage, and owned return target. Legacy
POIs return to the origin Colony exterior; Galaxy POIs return to Galaxy Region.

### Kepler one-shot policy

Legacy Kepler remains visible as `CLEARED` but is disabled by one launch guard
and the constructor-facing shell boundary. Galaxy's adapter also rejects a
stale authorization if canonical Galaxy story state already contains the black
box, returning `operation_resolved` before gameplay construction. The two
experience paths therefore agree on one-shot completion without conflating
their persistence authority.

### Real shell and Mission Board

Initial shell contract tests failed because campaign, planet, special, and
Colony launchers still used legacy constructor overloads. The production shell
now snapshots `saveDataRef.current` at new-launch boundaries, creates fresh
continued contexts for next campaign/special routes, and passes owned retry
contexts through ordinary, full-level, checkpoint, POI, and Galaxy operation
retry paths. Colony interior/exterior scene transitions retain their visit's
attempt identity.

Mission Board policy began with three intended unit failures: cleared Kepler
could launch, Left from Planet skipped Special Ops, and pointer/touch geometry
was duplicated outside the keyboard action path. One layout/hit/action contract
in `cockpit.ts` now drives renderer geometry and keyboard, pointer, and touch
activation. The clicked/tapped row is the row activated. A dedicated cockpit
state ref, requestAnimationFrame handle, and loop generation prevent a queued
frame from restoring stale selection after an input edge.

The first-clear browser proof launches the real shipped compatibility briefing;
it does not claim the mission was played to its terminal outcome.

## Real-surface browser proof

Browser tests install only migrated persisted saves before hydration, then use
the shipped experience selector, cockpit canvas, native keyboard events, mouse
clicks, and Playwright touchscreen taps. Canvas text observation is read-only;
no test-only state mutation API was added.

| Project | Kepler states | Observed |
| --- | --- | --- |
| `desktop-keyboard` / 1280x900 | locked, unlocked, first-clear launch, cleared | Arrow/Enter navigation reaches Special Ops; enabled Kepler launches; cleared activation stays on the board |
| `desktop-pointer` / 1280x900 | locked, unlocked, first-clear launch, cleared | Shared tab/row hit geometry activates the pointed row; cleared activation is denied |
| `mobile-touch` / 480x854 | locked, unlocked, first-clear launch, cleared | Native touch reaches the same states and policy at the release viewport |

The full browser run also retains the accepted experience-selector fixtures,
real Mission Board entry, and Ashfall Galaxy operation launch/presentation.

## Exact-code-SHA gates

All commands ran from `game/` at clean tested code SHA
`ec524822f7bd60d5a2842e187fb6d714e912d9b9`.

| Gate | Result |
| --- | --- |
| `yarn exec tsx --test tests/engine/missionLaunch.test.ts tests/engine/galaxyOperations.test.ts tests/engine/launchShell.test.ts tests/engine/specialMissionPolicy.test.ts tests/engine/planetRendering.test.ts` | 70/70 passed |
| `yarn exec tsc --noEmit` | Passed, exit 0 |
| `yarn engine:test` | 343/343 passed |
| `yarn colony:test` | 284/284 passed |
| `yarn sprites:test` | 4/4 passed |
| `yarn browser:test` | 20/20 passed; Kepler policy is 12/12 across keyboard, pointer, and touch |
| `COREPACK_ENABLE_PROJECT_SPEC=0 yarn build` | Compiled; generated 6/6 static pages; exported 3/3 |
| `NODE_ENV=production NEXT_PUBLIC_BASE_PATH=/sector-zero COREPACK_ENABLE_PROJECT_SPEC=0 yarn build` | Compiled; generated 6/6 static pages; exported 3/3 |

Final clean-tree checks and cold reviews are recorded on the evidence commit
that adds this receipt. Remote GitHub Actions are not claimed because this
isolated branch has not been pushed.

## Review-findings closure

The earlier combined candidate `baf7d3082da2ff37372cb525e99d0f1fbe13e271`
was rejected by both cold reviewers. It permitted retry children from unmounted
or forged parents, and its Galaxy Kepler regression still expected recovered
content to launch. `ec524822f7bd60d5a2842e187fb6d714e912d9b9` adds the
exact mounted/issued lineage registry and the recovered-Kepler adapter guard.
The complete gate table above was rerun on that replacement candidate.

## Acceptance boundary

A2 does not claim idempotent durable outcome commits, conflict/write-failure
recovery, or the Galaxy-to-Legacy close correction; those are Package A3. It
does not claim the general gameplay input, visible touch-control, or modal-focus
contracts owned by B1-B3. The browser matrix proves Kepler launch policy and the
narrow Mission Board carve-out, not every later input surface.

The earlier A1 receipt's all-ten-planet real-surface/live-play gap is not
silently upgraded by this package. Mission Board pointer/touch activation is now
available, but exhaustive planet route/live-play proof remains a release-matrix
item and must be recorded by the later whole-game acceptance pass.

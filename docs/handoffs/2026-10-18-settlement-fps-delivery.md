# Settlement and FPS delivery — 2026-10-18

Status: locally verified integration on `feat/galaxy-colony`, [PR #25](https://github.com/colorpulse6/sector-zero/pull/25).
Remote CI is tracked on the PR; local evidence below is not a CI, merge or deployment claim.
User authorized delegation, enemy asset improvement, explicit pickup controls, site/README
alignment and prompt push. No main merge or production deployment is included.

## Delivered increments

- `03f54af`: site/README simplified around persistent travel and Ashfall; four retained
  gameplay categories, archived removed-mode articles preserved. Site build and 9 browser checks.
- `0488435`: E / touch Interact picks up nearby, visible objective supplies, with a shared
  targeting prompt. Walking over supplies no longer claims them; Fire is separate. Quick taps
  are retained until a simulation tick and cleared at input boundaries. NPC E support retains
  Z compatibility, colony Z remains unchanged. 995 units, build and 24 control browser checks.
- `55f38ee`, `8800518`: Colony Claude's five-building settlement loop. Power + Mine bootstrap,
  housing/food/water and settlers; explicit restrictions and next-cycle guidance. Shared cost,
  production and growth numbers unchanged. Manager corrected the expiring-threat happiness
  explanation with a failing-then-passing regression test.

- `3adf04c`, `fe3a525`, `cb56280`: Designer's hostile presentation refresh using the existing
  animated atlas: floor anchoring, larger readable silhouettes, per-type size, matching fallback
  stills and opaque death frames before the final fade. Manager then clamped melee approach
  at 0.45 tiles and corrected stationary attack facing. [Art diagnosis and comparison captures](../assets/fps-enemy/README.md).
- Manager integration: expiring-threat guidance regression, legacy colony controls text retained,
  Atlas focus test budget adjusted to 60 seconds with all assertions preserved, and current docs.

## Evidence boundary

The final integrated code passes **1025 unit tests**, TypeScript and static export. The final
site build and **9 site browser tests** pass. The earlier full game browser run passed 119/122;
its three failures were a temporary output-directory configuration mismatch, a slow Atlas focus
traversal and changed Legacy controls copy. All three pass in the final **32-check browser run**,
along with keyboard/touch pickup, outcome reload, graphics and navigation checks. This is targeted
final coverage, not a new full-suite run after the art integration.

The independent source review of settlement and pickup found no important defects (Gemini
completed after a Grok tool-turn limit). It did not execute tests and predates the art/contact
integration. Manager reviewed the renderer diff, before/after sheets and integrated attack capture;
the isolated visual harness passed without page errors. Grunt attack remains visible at 0.45 tiles.
The later preview death capture resets the player position and is not proof of normal-distance
death readability; the sentry comparison demonstrates the opacity change. Distinct monster types
still share the existing art, and outdoor aesthetic acceptance is open.

Runtime previews return HTTP 200: game `http://127.0.0.1:3198/` and site
`http://127.0.0.1:3200/sector-zero/site/`. Refresh the game to load this export. Browser checks
used isolated profiles; the user's seeded save was not changed.

The settlement route test starts from canonical fresh arrival and uses the real POI outcome,
commission and cycle machinery; the sortie's 80 metal is granted in that test. The long-cycle
browser segment computes cycles outside the browser and reloads the resulting save. These
prove simulation/persistence, not a complete ordinary fresh-save playthrough.

## Required next milestone

Manager owns the recovery/pacing contract; Colony implements it. Done when failure cannot
strand the player before a Mine, ordinary repeatable work supplies the colony, and reaching
a useful settlement takes an agreed reasonable number of actions. Current successful route
needs 230 of 240 one-time metal to start Solar + Mine, then about 45 cycles to ten settlers.
After that: useful Quartermaster trade/resupply, ordinary work/trade/departure/return proof,
and Nic's aesthetic acceptance. Only then can Ashfall be locked and the next world opened.

Finished building geometry appears on the next descent. Construction and arrivals advance
with world-cycle actions, not real-time waiting. The user's seeded local save is preserved.

## Browser CI runner correction

The superseded run at `0488435` retained 3,944,079,850 bytes of browser artifacts. Its saved
error contexts show mostly 30-second test deadlines (including moving Atlas-label clicks),
plus a pickup-completion timeout. Local static-export routes pass; that alone does not prove
hosted-runner success. CI now builds the export with `NEXT_PUBLIC_DEVTOOLS=1` for the existing
DEV-entry tests and serves it with Python, matching the deployment format. Normal production
builds do not enable that flag.

Continuous full tracing imposed substantial overhead even locally: the same Overseer route
ran in 13.7 seconds with full tracing, 11.3 without trace screenshots/source copies, and 7.5
without DOM/network snapshots. The ordinary no-trace run was 7.3 seconds. An Atlas keyboard
route fell from 10.2 to 0.9 seconds. CI retains JSON results, error contexts, failure screenshots
and explicit gameplay receipts. Full traces are opt-in for an individual failing route; all
122 tests and their assertions remain enabled, with one worker and no retries.

Reproduce from `game/` with Node 20 and Python 3 installed:

```sh
NEXT_PUBLIC_DEVTOOLS=1 yarn build
PLAYWRIGHT_STATIC_EXPORT=1 yarn browser:test --workers=1 --retries=0
# For one failing route, add its spec/grep and --trace=on.
```

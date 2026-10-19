# Ashfall salvage recovery

Owner: Codex Manager. Branch: `codex/ashfall-recovery`, based on deployed main `dc35da2`.

## Approved behavior

Cerebro decisions `ashfall-recovery-contract-20261019` and `ashfall-tested-pacing-20261019` authorize a repeatable non-combat Salvage Shift: one world cycle, 40 colony metal, one galaxy travel supply, no entry cost. Nic chose to retain 40 metal after the real simulation disproved the initial 20-shift estimate. The accepted standard build path reaches ten settlers in 25 shifts. These are work actions; the five building orders and navigation are additional clicks.

The work panel is available from existing Atlas/landing-pad colony management. It shows the reward, duration and vessel's travel supply. Existing construction, production, consumption and settler growth advance. Held Enter cannot repeat work. Rewards arrive after the cycle, and mission outcomes, shared building costs and Legacy progression remain unchanged.

The command reads the canonical stored save, validates parked Ashfall access and unresolved outcome/operation guards, then compares the rendered quote. It computes the entire next state and writes once. Old quotes cannot replay after a cycle. Malformed input, changed colony/supply state, unreadable storage and failed writes do not award resources. Like existing management commands, this is a synchronous localStorage boundary, not a multi-tab transaction lock.

## Evidence

- Eight new command/route tests pass, including zero metal and zero travel supply, one-cycle rewards, duplicate/stale rejection, write failures and real failed-sortie outcome recovery to an operational Mine.
- All 1,054 unit/engine/colony/asset tests pass. TypeScript and static game export pass.
- All 16 affected colony/management/salvage browser checks pass together with zero retries. Four new browser cases cover: keyboard plus held-key handling and reload; stale/unreadable/unwritable storage; touch; and the complete fresh-galaxy route.
- The fresh route uses normal UI actions for travel to Ashfall, salvage, five building orders, growth to ten settlers, departure to Vanguard, return to Ashfall, reload and descent. It uses a canonical fresh-game starting save; it injects no expedition rewards or extra colony resources. It takes exactly 25 shifts with the standard order: Solar, Mine, Habitat, Farm, Purifier. At the acceptance point: 10/10 settlers, happiness 80, all five buildings operational, power 10/10.
- Unit recovery also proves the route when starting vessel supply is zero. Normal fresh arrival has the game's ordinary remaining travel supply.
- Captures: `docs/ashfall/captures/2026-10-19-ashfall-salvage-settlement.png` and `2026-10-19-ashfall-return-after-salvage.png`.
- The first full-route browser script incorrectly expected RESUME TRAVEL after committing a short normal journey. Actual gameplay automatically reached arrival. The test was corrected to acknowledge arrival, and passed; no product travel behavior changed.

## Remaining boundary

This increment is locally verified, not yet merged or deployed. Quartermaster commerce and its earning/cost rules remain the next Ashfall systems milestone. The complete work/build/departure/return route is verified; useful trade and Nic's final place acceptance still prevent an Ashfall lock. Geometry still updates on the next descent.

The independently requested Fable fighter presentation pass is in `/private/tmp/sector-zero-fighter-polish-20261019`, agent `A7B1A6E9-2AB9-49ED-8D47-E3EACA4314FF`, branch `design/fighter-battle-polish`. Its before/after preview and regression checks must be reviewed separately. Do not claim it is integrated from agent activity alone.

The primary checkout preserves unrelated `site/tsconfig.tsbuildinfo` and `docs/research/` changes. Local playtest server at `http://127.0.0.1:3198/` serves `game/out`; ownership PID is in `/tmp/sector-zero-recovery-preview.pid`. Retain it while Nic's playtest is pending. Test-owned servers and isolated browsers exit with Playwright.

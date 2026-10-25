# Ashfall lock candidate

Status: locally verified; PR review, CI, release and Nic's final visual acceptance
are separate gates. Baseline `95add54` is already deployed. Work branch:
`feat/ashfall-lock`. Contract: [Ashfall lock](../ashfall/08-lock-contract.md).

## Delivered

- Galaxy Quartermaster stock is one useful exchange: 20 colony metal for one ship
  travel supply. It needs no Legacy unlock, credits or combat reward.
- Shop shows cost, reward, colony metal, ship supply, salvage guidance and refusal
  or success. Existing actor/art direction remains unchanged.
- Commit reads the current canonical save, revalidates access/faction/outcomes,
  compares the displayed intent and writes once. Only colony metal, ship supply
  and shared revision change. Replayed/stale intents cannot spend again.
- A short colony Interact tap now survives between simulation frames. Holding Z
  in this shop performs one exchange; a new press can trade again.
- README, site and roadmap now describe the work/build/trade/return loop.

## Verification

- **1,068 unit/asset tests passed** (colony, engine, sprites), including seven new
  canonical trade tests. Final trade boundary rerun: seven passed.
- Game and site production builds passed, including typechecking.
- **21 targeted game browser tests passed** against the static export: full new
  lock route, Overseer, management, salvage, Galaxy colony return/reload and Legacy
  Quartermaster regression. All nine companion-site browser tests passed.
- New fresh-profile route uses **BEGIN GALAXY**, no save or reward fixture. It
  proves empty-stock refusal, 25 actual salvage shifts, five operational buildings,
  ten settlers, two trades, held-key protection, factual Overseer readout, Take Off,
  travel to Vanguard and back, reload and descent. Legacy fields remain unchanged.
- Mobile failure tests deliberately corrupt storage, fail writes and introduce a
  newer save. No stale write occurs; one subsequent touch exchange persists once.
- Initial mobile test exposed dropped short taps. Fixed the colony input handoff
  and reran successfully; the test was not weakened or retried to hide failure.

Screenshots were visually inspected for shop text fit, balances/feedback, retained
NPC presentation and settled Overseer readout:
[desktop trade](../ashfall/verification-2026-10-24/quartermaster-desktop.png),
[touch trade](../ashfall/verification-2026-10-24/quartermaster-touch.png),
[settled Overseer](../ashfall/verification-2026-10-24/settled-overseer.png),
[returned yard](../ashfall/verification-2026-10-24/returned-yard.png).
These are runtime evidence, not Nic's aesthetic approval.

Detailed local logs: `/tmp/ashfall-lock-unit.log`,
`/tmp/ashfall-lock-browser-fixed.log`, `/tmp/ashfall-lock-site-browser.log`.
Additional test artifacts remain under `/tmp/ashfall-lock-browser-fixed`.

## Remaining and ownership

- Codex: watch CI, fix any failures, complete normal PR review/release flow and
  verify the deployed game/site. Main currently requires one approving review.
  Prior one-off bypasses are not reused. Local verification is not deployment.
- Nic: play the [ordinary route](../ashfall/06-acceptance-route.md) and accept the
  final visual/playfeel baseline. Then change the world status from verified lock
  candidate to accepted reference world; next roadmap work is GC3 Galaxy cockpit.
- Optional later: consumable equip/use and credits commerce, negotiated prices,
  extra landmarks, richer clock presentation, more worlds. None blocks this scope.

## Preview and closeout

The old task-owned server on port 3198 was accepting sockets but not answering.
Its PID and command were checked, then it was replaced. The preview returns HTTP
200 at http://127.0.0.1:3198/; PID is recorded in
`/tmp/sector-zero-ashfall-preview.pid`, log in
`/tmp/sector-zero-ashfall-preview.log`. It serves the primary checkout's game/out.
Keep it available for Nic's pending review. No new worktree or dependency tree was
created. The primary checkout, unrelated `docs/research/` and existing dirty
`site/tsconfig.tsbuildinfo` are preserved and excluded from the commit.

Residual limits: fixed 07:00 projection; building geometry updates on descent;
browser-local saves; synchronous store commits do not claim cross-tab atomicity.

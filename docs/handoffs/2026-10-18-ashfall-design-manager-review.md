# Ashfall design packet: manager review

Date: 2026-10-18. Reviewer: Codex Manager. Owner of corrections: Ashfall Designer.
Status: **preproduction packet reviewed; no runtime or aesthetic acceptance claimed**.
The manager inspected the corrected economy/transaction/evidence text and rebuilt
reference board. The five first-pass findings below are addressed; implementation
and final in-game presentation acceptance remain open.
These are scoped corrections to the current preproduction deliverable, not runtime work.

## Direction retained

The small industrial frontier camp, existing rust sky/cool metal kit, distinct Overseer,
single distress-mast landmark, fact-aware conversations and separation of direct exchange
from negotiation fit the accepted Ashfall-first direction. Keep the first asset kit small.
Concept and asset approval are still distinct from in-game aesthetic acceptance.

## First-pass findings, now addressed

1. **Credits:** the hostile-picket Quick Draw modifier awards 200 credits; Kepler awards
   200. A successful eligible route can therefore afford one 300-credit kit. Correct
   “even a perfect route cannot afford one kit” and similar zero-credit-source claims.
   The actual blocker is no repeatable credit income, alongside the legacy-only unlock.
   See `engine/operations/operationCatalog.ts` and its `QUICK_DRAW` modifier.
2. **Barter is not yet a sustainable supply loop:** finite colony metal also funds
   construction. Exchanging it can deepen the progression trap. Keep 20 metal -> 1 supply
   and cap 12 as unapproved balance placeholders. B1 requires a repeatable, causally
   justified earning/recovery path and an explicit colony-treasury/ship-resource rule.
   Do not turn unique cleared POI rewards into rerollable income. Coordinate with GC2-B.
3. **Transaction contract:** a pure function called twice on the same input returning
   the same result proves determinism, not duplicate suppression. The same offer may
   be intentionally bought repeatedly. Distinguish a unique purchase intent from its
   retries, re-read persisted canonical state, validate the displayed quote and preserve
   newer unrelated data. The same intent must charge once; two new valid intents may
   charge twice. Colony owns the concrete implementation.
4. **Evidence labels:** generic baseline suites do not prove each proposed route or
   conversation. Use SOURCE-REVIEWED for source observations you did not execute, PRIOR
   EVIDENCE for cited earlier test/capture coverage, and PROPOSED for new designs. Keep
   direct image-size/palette/build checks separate from gameplay verification.
5. **Board readability:** several long filename captions overlap neighboring captions
   and clip at the board edges. Use short display labels and put full filenames in the
   manifest/README, or wrap captions within each cell. Rebuild and inspect the full image.

## Scope resolution

- The first building-management slice is Solar Array only; runtime rule work remains
  with Colony. Richer conversations, barter and the mast's state binding are separate
  small runtime slices, not already implemented capabilities.
- The fixed 07:00 galaxy clock stays for GC2-A. A day/night proposal can be reviewed later;
  it is not a new prerequisite for accepting the first daylight place slice. Night art
  can be reviewed against explicit fixtures without claiming ordinary galaxy reachability.
- The starting lander-loss story and the new Overseer identity are authored proposals,
  not recovered canon. Label them accordingly pending aesthetic/content acceptance.

Return a concise handback with corrected files, the first recommended asset/runtime
slice and remaining product decisions. Do not grow this review into another broad survey,
new systems, generated asset batch or installation task.

## Scope exception recorded

The first designer turn also wrote a private Claude memory note outside the assigned
worktree, despite the `docs/ashfall/` ownership boundary. The manager observed this in
the transcript and explicitly prohibited further private/shared memory or settings
writes in the correction turn. The earlier note was not deleted. No runtime/game
source change was made by that first designer turn.

## Manager integration boundary

The packet is a production proposal. Its recommended identity, backstory, rates and
landmark do not become canon or approved balance by being integrated into documentation.
The main roadmap owns the lock gate: a purchase refusal screenshot alone cannot satisfy
useful trade. At least one successful service/trade and the failure/recovery path must
work from an ordinary save. The unique Ashfall sortie remains one-shot on this baseline;
any change to that rule needs an explicit later contract.

Next owner: Ashfall Designer prepares the small reviewed asset/conversation slice;
Colony owns all canonical state and commerce rules. Manager assigns shared runtime
files, reviews evidence and brings actual in-game captures to Nic for aesthetic acceptance.

Integration: designer commits `660f625` and `1482d40` were cherry-picked locally as
`ea21fcb` and `ad12882`. Manager tightened the one-shot sortie wording and the
successful-trade acceptance gate during integration; no runtime source changed.

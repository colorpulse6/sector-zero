# GC2-A manager review

Date: 2026-10-18. Reviewer: Codex Manager. Reviewed the proposed GC2-A spec and plan.
Status: **GC2-A design accepted for its bounded runtime assignment.** Colony addressed
the two required corrections in `6bf9f7f`; the manager inspected the revised spec,
store-boundary code, UI handlers and test scenarios. Runtime implementation is still pending.

## Scope decisions

- D1 accepted: Solar Array only for the first construction slice.
- D2 accepted: landing-pad management and Atlas management entry points.
- D3 accepted for GC2-A: physical building refresh on the next descent, stated honestly.
- Keep walking/descending time-neutral, the existing legacy behavior and GC1's narrow
  shop merge. No additional merchant, barter or resupply mechanics inside GC2-A.
- D7/D8 remain deferred: regional outpost access and the presentational colony clock.
- D9 is not bundled as a cosmetic one-line change. Merchant availability must eventually
  use the same galaxy rule for its display and transaction; handle both in the commerce slice.

## Review findings, now addressed (owner: Colony)

### 1. Re-read persisted canonical state on commit

The Task 7 sample calls `commitGalaxyColonyCommission(saveDataRef.current, quote)`.
That ref is current for this React session, not necessarily the stored save. An
external write or second tab can update unrelated galaxy/legacy fields without changing
the quoted colony resources. Persisting a result derived from the old ref would erase
that newer state despite the pure quote check.

At the persistence boundary, read through the existing `readCanonicalSaveStrict`,
validate access and apply the command to that fresh parent. Block on unreadable state;
do not manufacture a default save. Preserve newer unrelated fields. Reconcile the UI
after a stale refusal; do not silently re-price and execute a different displayed intent.
Persist before adopting. Add tests for newer unrelated persisted data, a stale quoted
colony, unreadable storage and failed writes. Reuse the project's existing storage
consistency approach; do not invent a new cross-tab transaction guarantee.

### 2. Suppress gameplay input while management owns the surface

The plan closes `exitMenuOpen` when opening management. The existing colony loop only
zeros input for `exitMenuOpen || regionMapSurface`, so management would leave the
walk active behind a DOM dialog. Include management in the input-ownership guards and
clear held keyboard/touch input on opening, closing and navigation changes. Preserve
the existing persistence lock and modal-focus behavior.

Add a browser scenario holding movement/interact across opening and closing management.
The player must not move, fire, open another menu or carry a held gesture into the
underlying scene until a fresh input. Check both keyboard and representative touch.

## Acceptance boundary

Update the spec and the actual Task 7/test snippets, not only a disclaimer beside unsafe
sample code. The manager can then accept the first runtime assignment without another
product discussion. Automated fixture-based acceptance remains distinct from the final
fresh-save human Ashfall playthrough.

## Verification and remaining work

- Manager verified the revised plan reads `readCanonicalSaveStrict`, writes before
  adoption, refuses stale/unreadable state and names the storage-failure tests.
- Manager verified management is included in both gameplay input guards, held input
  is cleared on transitions, and keyboard/touch acceptance scenarios are specified.
- Colony reported 14 scratch-copy tests and a clean typecheck for the planned command
  code. This is prototype evidence, not integrated runtime acceptance.
- Next owner: Colony. Implement the accepted GC2-A slice, run its meaningful tests,
  prove the input regressions fail without the guards, and hand back the ordinary
  fresh-save route with browser evidence. Manager reviews before calling it verified.

## Full Ashfall lock requirements beyond GC2-A

The reported finite metal/credits/supply paths make a sustainable earning, trade and
resupply loop a required later slice. A failed unique operation must not permanently
remove every practical recovery route. Preserve unique POI/history rewards; do not
quietly make a cleared one-shot wreck reroll. Colony and the Ashfall Designer should
reconcile a small reliable-work/trade proposal before implementing commerce.

## Scope exception

The Colony transcript also records updates to its private Claude memory files during
this documentation pass. These were outside the assigned project files. No deletion or
follow-on memory write is authorized; the shared project documents remain the handoff.
Future lane assignments explicitly exclude private memory/settings writes.

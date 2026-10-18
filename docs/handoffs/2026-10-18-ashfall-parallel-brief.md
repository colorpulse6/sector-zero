# Ashfall lock: coordinated parallel work

Date: 2026-10-18. Manager: Codex, Cerebro agent `5125AA93-CC0C-4603-80E4-873586DAD011`.
Starting integration head: `30b0726`, `feat/galaxy-colony`.

## User direction

Nic selected Ashfall as the first place to lock. He explicitly wants the existing
Colony agent to continue its roadmap alongside additional agents guided by the manager.
Ashfall's aesthetic, assets, conversations, market and bartering can progress in parallel.

“Lock” means an accepted, playable baseline with stable identity and continuity. It
does not stop the world's population, buildings, economy or politics from evolving.
No new world production begins until this reference experience has a clear acceptance result.

## Shared player outcome

From a fresh galaxy run, travel to Ashfall, descend, recognize a coherent place, talk
to someone with a useful role, manage one colony improvement, undertake a local
operation, use a meaningful service or trade, see a lasting consequence, leave and
return. No developer fixture is required for the acceptance route.

## Work ownership

| Lane | Owner | Owns | Does not own |
| --- | --- | --- | --- |
| Colony systems | Existing Colony agent, `734C958C-8EFA-44CA-8ADA-2F23FE3E41DE` | Its GC1–GC5 integration roadmap; first GC2 management slice and tests; canonical colony/resource rules; proposed commerce capability contract | Master roadmap, new broad aesthetics, designer files, changes to another worktree |
| Ashfall place and interaction design | New Claude Ashfall Designer | Isolated `design/ashfall-lock` worktree; `docs/ashfall/` place brief, art direction, asset manifest, conversations, market/bartering interaction proposal and handback | `Game.tsx`, reducers, save/travel schemas, economy balance changes, renderer migration, deployment |
| Direction and acceptance | Codex Manager | `docs/ROADMAP.md`, consolidation baseline, this coordination brief, task scope, cross-lane contracts, integration/review evidence and next milestone | Quietly replacing Colony's roadmap or declaring concepts/runtime complete without evidence |
| Aesthetic acceptance | Nic | Final choice among concrete in-game proposals | Routine coordination, testing or merge-conflict repair |

All agents are working alongside others. Preserve unrelated changes. Do not reset,
revert, switch the shared checkout, or edit another lane's files. No pushes, deployment,
main merges, agent configuration changes or paid asset generation under this brief.
Private/shared memory files and provider settings are outside every lane's write scope;
use the owned project documents for handoff and continuity.

## First bounded deliverables

### Colony: reconcile and specify GC2-A

First return the current roadmap, already-approved next work and any conflict with this
brief. Write a concise GC2-A plan/spec in your own named document. Scope one complete
management outcome: reachable management, validated build command, one supported
construction, progress through existing cycle-bearing actions, durable save/reload,
and visible finished building on re-entry. Keep the existing GC2/GC3 labels.

Propose the smallest capability interface the designer may depend on: which actors
are present, which building/service can actually be reached, resource ownership,
item inventory, buy/sell or exchange possibilities, dialogue effects and unlocks.
Mark supported, next-slice and future capabilities distinctly. Do not tell the designer
that a mocked price, trade, quest or conversation consequence is already functional.

Management needs its own validated command boundary. Do not simply widen the GC1
visit/shop allowlist. Use current canonical state, reject stale/invalid commands and
preserve legacy isolation. Survey and POI actions already advance cycles; walking and
descending remain time-neutral. A newly founded regional colony shares its parent's
stellar contact but still needs a deliberate local access rule.

Return the plan and required product decisions to Manager before expanding beyond the
already-approved integration work. Do not start Marketplace/Town Hall, full barter,
GC3/GC4, a renderer rewrite or new worlds as incidental GC2 work.

### Designer: Ashfall production packet

Produce a concrete, reviewable packet in `docs/ashfall/`, including:

1. The place's identity: industrial frontier on Ashfall, distinct arrival landmark,
   layout, material/light/color language, and a few recognizable inhabited spaces.
2. A bounded first asset kit with exact runtime consumer, size/format, source,
   fallback and state variants. Reuse approved art before proposing replacement.
3. A small cast with conversational purpose. Write representative conversations tied
   to actual facts: arrival, colony need, operation result, trade and return.
4. A market/bartering proposal: what changes hands, why it is useful, the player's
   steps, refusal/insufficient-stock states and source of every displayed fact. Separate
   price-based buying/selling, direct exchange and social negotiation; do not quietly
   invent all three as one committed feature.
5. A first playable Ashfall route, acceptance captures, owned paths and handback manifest.

Keep authored starting characters distinct from future generational politics. Do not
populate the opening frontier with ancient living empires or established Great Houses.
World truth, NPC schedules and outcomes come from the game, not the designer's UI.

For this first packet, use existing assets and lightweight local mockups/reference
boards where useful. Label mockups honestly. Do not install tools or generate a large
asset batch before visual direction and actual runtime slots are agreed. The current
colony is a first-person raycaster; Babylon Atlas scenes do not imply a colony 3D
migration. Propose any renderer requirement separately.

## Merge and acceptance gates

- One implementer per shared runtime file. Designer changes remain isolated until the
  manager agrees the contract and integrates a bounded slice.
- A documented plan and reviewed interface precede cross-lane runtime work.
- Each slice proves its ordinary fresh-save route, persistence, appropriate unit/browser
  behavior and static-export compatibility. Reuse the baseline evidence where unchanged.
- Aesthetic acceptance uses the actual gameplay viewport, readable interactions and
  day/night conditions where applicable. Concept images alone do not close the gate.
- A trade is complete only when stock/cost/result/persistence are real and stale or
  repeated actions cannot duplicate items. Bartering balance/negotiation stays a named
  separate slice if the first market only supports buying/selling.
- Final Ashfall lock requires both functional and aesthetic acceptance; implementation
  complete, locally verified, human accepted and released are separate statuses.

## Current evidence and limits

Baseline `30b0726`: Colony reported 951 unit tests, a clean typecheck and static export.
Manager read the completed browser log: 110 passed, exit 0. This verifies the existing
baseline, not the proposed Ashfall loop. Exact location reload currently returns to
Atlas; fresh galaxy consumables are legacy-locked; management remains to be wired.

The partial Marketplace branch is `feat/m3-marketplace-runtime` at `289f4eb`.
Inspect its reusable work before starting that feature, but do not merge it wholesale.

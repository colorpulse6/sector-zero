# Ashfall runtime milestone

Manager: Codex. Start: `ef551b3` on `feat/galaxy-colony`. Status: implemented and verified locally at runtime `44111cf`; Ashfall lock remains open.

Nic requested continuation after the consolidated roadmap. This milestone implements
one management outcome and a small parallel presentation improvement; it does not
close the complete Ashfall lock.

## Ownership and finish conditions

- **Colony:** accepted GC2-A plan, including stored-save command, Atlas/pad entry,
  Solar Array construction and held-input guards. Owns management runtime and tests.
  Done when meaningful unit/browser checks and the ordinary construction/progress/
  reload/re-entry route pass with evidence. Fixed 07:00 clock and next-descent geometry
  refresh remain explicit. Commerce stays outside this slice.
- **Ashfall Designer:** isolated `design/ashfall-lock` worktree. Existing Overseer
  billboard/portrait and short Ashfall-only lines from actual colony state. Owns
  sprites registry, NPC builder/dialogue and focused tests. Keeps role labels and
  legacy/non-Ashfall behavior; does not add proposed names, mast, exchange or backstory.
  Done when integrated behavior and actual viewport captures are verified. Nic's
  aesthetic acceptance remains a separate gate.
- **Manager:** review and integrate the disjoint changes, inspect meaningful evidence,
  fix material findings with the owners, run integrated validation as needed and
  update the master roadmap. One combined independent review covers the milestone.

Workers must preserve unrelated work, avoid other lanes' files and make no private
memory/settings writes. Local scoped commits are authorized; pushing, main merges,
deployment, installs and new agent fan-out are outside this assignment.

## Required later work

A sustainable earning/trade/resupply path, practical failure recovery, visible mission
consequences and the complete fresh-save visit/work/trade/return playthrough remain
required for Ashfall. A shop refusal is not a successful trade. A design board is not
in-game aesthetic acceptance.

## Evidence

Integrated commits: Colony runtime through `cfdfed6`, browser tests `bd57c1f`, as-built
notes `a895f5f`; Designer `bd07594` (from `12f7dd8`); Manager correction `44111cf`
(from `87024da`). The finishing commit adds the combined regression and this evidence.

| Check | Result and boundary |
| --- | --- |
| Integrated unit suites | 990/990 passed; `/tmp/ashfall-integrated-unit.log` |
| Integrated typecheck | `tsc --noEmit --incremental false`, exit 0; checked again after the new browser regression |
| Integrated static export | Successful with Node 20 and `NEXT_PUBLIC_DEVTOOLS=1`; `/tmp/ashfall-integrated-build.log` |
| Integrated management + Overseer browser checks | 7/7 passed, 54.3s; `/tmp/ashfall-integrated-browser.log` |
| Integrated held-input checks | Keyboard and touch 2/2 passed, 16.9s; `/tmp/ashfall-integrated-input.log` |
| Colony full browser run before NPC integration | 116/116 passed, 13.1m; `/tmp/gc2a-logs/browser-full.log`; later fresh-profile test passed separately |
| Tests demonstrated to fail | Colony removed both guards temporarily and saw both input checks fail. Manager reproduced missing cost wiring and stale post-build dialogue before correcting them. All temporary removals restored. |

The new combined browser test commissions the Solar Array from the landing pad, resumes
the same walk and speaks to the Overseer. It verifies the constructing line, empty yard,
one saved building, zero metal and unchanged legacy bytes. Its initial 80 metal is an
explicit fixture, not proof of earned rewards. [Integrated capture](../ashfall/captures/2026-10-18-integrated-overseer-after-build.png)
and [receipt](../ashfall/captures/2026-10-18-integrated-runtime-receipt.json) are retained.

The broader management route covers completion, reload and next-descent building
geometry. Its reward segment uses the shipped POI outcome authority. Completing the
first-person expedition through ordinary controls is still an acceptance gap, not a
passing claim. The full 116-test suite was not repeated after NPC integration; its
affected management, dialogue and input routes were checked on the combined build.

### Review and integration correction

One combined router review was attempted on an immutable source snapshot. Grok reached
its turn limit; the permitted Gemini fallback completed. Its no-findings report had
invalid line references, missed the staged spec and overstated acceptance, so Manager
recorded **rework**, not independent approval (group `f272c83b18e2498e9656ca825b42f7d9`).

Manager separately reproduced a real integration defect: after commissioning, the
cached Overseer report still said there were no buildings and 80 metal. `44111cf` wires
the shared build catalog into entry and refreshes the next Ashfall conversation from
current colony state, preserving actors and geometry. The failing checks now pass,
and the new integrated browser regression verifies the same-visit behavior. An already
open conversation retains its current line snapshot. No other material issue remains
open within this bounded implementation; human gameplay/aesthetic gates remain below.

### Manager ordinary-UI baseline check

On an isolated origin (`http://127.0.0.1:3197`, Chrome), Manager used BEGIN GALAXY,
COMMIT TRAVEL to Ashfall, ACKNOWLEDGE ARRIVAL and DESCEND TO COLONY without a save
fixture. The view showed the landing pad and Quartermaster. From the pad, REGION MAP
opened Cinder Relay: survey advanced cycle 1 to 2; expedition entry advanced it to 3.
Returning early through the pause menu reopened the region, leaving Cinder Relay
surveyed. No successful expedition or reward delivery was demonstrated by this check.
This was the starting static build, before the new management/presentation integration.

### Manager management-entry check

After reloading the new static build on the same naturally progressed save (cycle 3,
10 supply, 0 metal), both Atlas MANAGE COLONY and landing-pad COLONY MANAGEMENT
opened the new screen. It displayed Solar Array, 80 metal, 1 cycle and a disabled
NEED 80 MORE METAL action. Atlas Back restored focus to MANAGE COLONY. Pad Back
returned to the landing-pad menu; Resume returned to the unchanged pad view after
holding W in management. This checks entry/refusal/navigation visually; successful
construction and held-across-close regressions still require the separate test evidence.


### Manager integrated visual check

The same ordinary Chrome save was reloaded against the integrated static export. Manager
walked from the pad to the Overseer and visually checked the existing billboard, portrait,
role label and factual empty-yard line at gameplay size. The temporary viewport override
was reset. No fixture was installed in this manual save. The automated capture separately
shows the funded-fixture post-build report. The NPC label can clip at the canvas edge;
this pre-existing presentation issue remains for the place acceptance pass.

## Next required milestone and ownership

1. **Colony + Manager:** define and then implement a bounded recoverable earning/trade/
   resupply loop (GC2-B). Complete when an ordinary galaxy save can earn, make a useful
   trade, recover from failure and continue, with persistent costs/results and no duplicate
   claim. Resolve finite starting resources and the unique metal-reward dependency.
2. **Designer + Manager:** finish the bounded Quartermaster/arrival/consequence slice
   against those accepted rules. Complete when both roles and a durable consequence are
   legible in the actual viewport, with no promised but unavailable service. The existing
   design packet is input, not permission to add the full Marketplace or new fiction.
3. **Manager:** play and record the full ordinary fresh-save expedition, improvement,
   trade, departure and return. Complete when earned rewards and consequences survive
   reload and failure recovery works without fixture assistance.
4. **Nic:** accept the integrated place aesthetic after the required slice is reviewable.
   Until then Ashfall is integrated/partly verified, not locked or released.

Optional later work: larger Marketplace interior, bargaining, extra worlds, night
simulation and renderer replacement. They are not requirements for this bounded slice.

All changes remain local on `feat/galaxy-colony`. Designer and integration worktrees
remain available. No push, main merge or deployment was performed. Unrelated
`site/tsconfig.tsbuildinfo` and `docs/research/` are preserved.

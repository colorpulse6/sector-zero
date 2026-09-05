# B3 navigation and focus — 2026-09-05

The July filename follows the conductor plan; this receipt records September 5 work.
Code: `09180a921d0ced3f462da2933e136842cde37ec7`. Game tree: `5147ef832ae9823d077f392b1c376270a0ca1f58`.
Worktree: `/Users/nichalasbarnes/.config/superpowers/worktrees/sector-zero/b3-navigation-focus`.
Accepted B2 base: `fdb0334836aeb863becab6b6e37adb40a4bb4f41`.

This local receipt requires the matching post-evidence **PASS** [gate-manifest.json](/Users/nichalasbarnes/.codex/visualizations/2026/09/05/01a07127-3e6a-7ae1-b54b-436d683ef1c1/sector-zero-b3-evidence/gate-manifest.json), including exact clean-evidence gates and fresh sequential specification and quality reviews. Its `evidence_sha` must identify the commit containing this receipt. Until then B3 remains a checkpoint pending closure.

## Routes observed

The complete exact-code Chromium matrix passes **81 tests** without retries: **77 exact-SHA route receipts** and four fixture rows. B3 contributes 18 rows. Desktop uses 1280×900; mobile touch uses 480×854. Existing B2 checks also retain 375×667 control geometry coverage.

| Route | Input and fixture | Observed result |
| --- | --- | --- |
| Atlas contacts → arrows → Tab → Escape | Keyboard; `galaxyAtAshfall` | Selected contact receives initial focus; repeated Down/Down/Up keeps focus with selection; Tab and Shift+Tab wrap; Escape restores Continue Galaxy. |
| Atlas → Plot custom coordinate → Tab → arrows → Escape | Keyboard; `galaxyAtAshfall`, native LOCAL X/Y inputs | Plot keeps the custom target selected and no contact selected; Tab reaches the first contact without changing the plotted target; Down selects/focuses the second contact, Up the first, and Escape restores Continue Galaxy. |
| Empty Colonies → Found → Descend focus → Escape | Keyboard; fresh Legacy save | Native Enter founds the first colony; Descend receives focus immediately; the populated dialog traps Tab and Escape restores the cockpit invoker. |
| Cockpit → Colonies → Escape | Keyboard; founded Colony | Descend receives initial focus; Tab stays inside; Escape restores the actual Colonies cockpit button. |
| Colonies → view-only Region → Escape | Keyboard; founded Colony | Cockpit provenance and no Region actions; repeated arrows retain selected-option focus; Tab is contained; exact Region button restored. |
| Descend → Interact → Exit → Region → Exit → Escape | Keyboard; founded Colony | Resume initially focused; landing-pad provenance; Region restores its exact REGION MAP invoker; Exit Escape restores exploration canvas. |
| Prepared POI → delivery → Escape → confirm | Keyboard; canonical prepared Legacy POI | Confirm initially focused; Tab contained; Escape leaves pending cargo and visible explanation; confirmation returns to Colony. |
| Applied Galaxy POI return → failed acknowledgement → Retry | Keyboard; existing pending-return fixture and write-failure probe | Recovery owns initial focus and Tab above Region; Retry returns focus to Region's selected destination. |
| Cockpit → Star Map → cockpit → Star Map → World 2 Level 2 | Pointer and touch | Visible return works and focuses canvas; one world contact expands the actual world; its second level launches World 2 Level 2. |
| Armory → Crew → Codex → Bestiary → Pilot | Pointer and touch; canonical completed campaign with credits, codex and recorded kills | Hit row buys only Engine Boost despite other keyboard selection; hover leaves selection unchanged; actual crew/tab/entry opens and records the chosen read; Drone detail opens; actual Overcharge node allocates without allocating another node. |
| Atlas contact → Ashfall → Region node → back → close | Pointer and touch; `galaxyAtAshfall` | Hover leaves selection; activation selects the hit contact/node; ATLAS LINK is accurate; Region restores its actual Atlas button; Close restores Galaxy choice. |
| Colonies → Descend → Interact → Resume → Interact → Take Off | Pointer and touch; founded Colony | Actual actions enter exploration, resume to canvas and take off through the saved cockpit return. |
| Prepared POI → Confirm Delivery → Colony | Pointer and touch; canonical prepared Legacy POI | Actual button consumes the prepared record and returns to Colony exploration. |

The inherited keyboard lifecycle route uses native mouse DevPanel activation for its fresh Ground setup. Pointer/touch menu rows intentionally establish a different keyboard selection and inspect mouse hover before activation. Gameplay Interact is held across native sampling frames, using mouse-down delay or Chromium touch dispatch with a stable finger ID. No live game-state injection or time acceleration is used.

## Observation and retained failures

Canvas text observation forwards native drawing calls unchanged, resets on a complete frame background and keeps a bounded buffer. Save fixtures are canonicalized and installed before hydration. The prepared POI fixture uses shipped dispatch, launch and preparation authorities; it proves recovery and delivery, not an authored combat playthrough. The existing storage probe supplies acknowledgement failures.

`browser-red-context.md` discloses that the initial RED had a working-tree Region caller change and an imprecise B2 receipt identity. Treat that as development RED only. `cockpit-navigation-red.log`, `browser-red.log`, `browser-recovery-red.log` and `star-map-return-assertion-red.log` retain expected failures. Initial full regression `precommit-browser.log` retains 77 passes and the old covered-Resume focus assumption; `precommit-correction-recovery.log` proves its corrected lock assertion. Initial exact code `6206698` then failed three inherited movement observations (75/78); `code-gates.json` remains FAIL. The same route tests also failed on clean accepted B2 (`b2-comparison.log`). Camera drawing captures established idle, stationary world position despite screen easing. Ground now measures world movement and retains idle-pose checks. Boarding uses independent native entries and a separate retained-aim positioning leg. Its new observer fixture proves signed 7px/tick trajectories over uneven one-to-three-tick rendered intervals, rejecting wrong angle/speed. Thresholds and gameplay runtime are unchanged. The handoff retains the interim fresh-key endpoint anomaly and its proof limit. Intermediate code `14b212c` passed 79/80 browser rows but failed the keyboard repeat check during a captured idle-to-spawn transition. `keyboard-entry-diagnosis.json` retains that trace; a fresh native Ground entry now keeps the pause/old-hold observation bounded near the entrance, while requiring strict idle/world position, fresh same-key running and fresh Right displacement. Its failed exact gate remains `corrected-code-gates.json`. `camera-corrected.log` and `boarding-trajectory-red.log`/`boarding-trajectory-green.log` record focused evidence. Evidence `66d71b0` was superseded after a cumulative diff check found two EOF blank lines in the new documents. Its evidence verification was interrupted and remains FAIL. The replacement evidence removes those lines and requires a passing cumulative diff check. Evidence `8b5adac` then passed its automated gates and specification review, but quality review rejected the introduced loss of contact Tab access after plotting an arbitrary coordinate. Its native production-export reproduction and rejected review records are retained. The replacement produced separate assertion RED for missing Tab entry (`coordinate-tab-red.log`) and the wrong arrow origin after restoring that entry (`coordinate-arrow-red.log`), then all 18 focused navigation rows passed in `coordinate-green.log`. Only the new `coordinate-code-*` and `coordinate-evidence-*` gates, with fresh sequential review verdicts for the replacement evidence SHA, can establish acceptance.

The conductor inspected mobile Region and Pilot screenshots. Region shows the selected contact, accurate Atlas provenance and an unobstructed return control; Pilot shows the allocated target. This is not physical-device or art-polish acceptance.

## Gates and continuation

Exact code gates pass under Node 20.20.1: TypeScript, 486 engine, 290 Colony, four sprite, 81 browser tests and both production exports (empty path and `/sector-zero`). All 77 browser receipts match the code identity. The separate evidence commit must pass the same gates and both fresh reviews.

[The dated handoff](../handoffs/2026-09-05-b3-navigation-checkpoint.md) records ownership, commit identity, retained failures and continuation. Do not start C1 until the matching external manifest is PASS. M3 remains reserved, and F1 still owns physical-device coverage, complete authored POI completion and the complete live route matrix.

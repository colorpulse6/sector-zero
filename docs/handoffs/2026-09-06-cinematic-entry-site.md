# Cinematic opening screen and companion site

Date: 2026-09-06
Implementation/test candidate: `9a152482c6189f6a9f485e253ff3a78a82402878`.
Base: main `ab9ed799d806ab6b380ac2c0ccfa83218448e915` (PR #20, already deployed).
Status at checkpoint: implemented and independently reviewed; publish as a draft while the full game browser matrix runs in GitHub CI.

## Delivered

The game has one cinematic title, prioritized Galaxy/Legacy native launch buttons, optional keyboard-accessible Story/Controls panels, and a first-launch sound toggle using the existing audio state. Loading/save recovery and in-game narrative behavior remain under their existing owners. Portrait layouts stack; short landscape uses two columns to keep both launch actions visible. The layout imports a fully namespaced stylesheet so the existing Node component tests remain usable.

The companion site uses coordinated key art and typography, responsive navigation, a keyboard skip link, larger real gameplay captures, consistent secondary/article layouts, optional ending spoilers, and accurate playable/planned colony copy. All eight MDX article bodies, six mode links, creator identity and deployment configuration remain intact. The footer maker mark now resolves under the deployed site base path.

Artwork is 103,554 bytes per hero; the local display font includes its original OFL license. Provenance is in `docs/art/2026-09-06-cinematic-key-art.md`. Only the upstream license copies retain original trailing whitespace at line 21; their exact SHA256 is verified, and application diff checks exclude only those two unchanged vendor texts.

## Verification identities

On exact candidate `9a15248`, both TypeScript checks, 513 engine tests, 315 Colony/sprite tests and all nine site browser tests passed. Each app exported successfully with an empty base path and its GitHub Pages base path. A static HTML/CSS reference audit found no missing local targets in any of the four exports.

The production exports were also inspected in an independent browser: game desktop 1440×900, portrait 480×854 and short landscape 740×360; site and a full article at 320×740. Help focus return, native Galaxy launch/reload, skip-link navigation and footer image loading passed, without browser errors. Browser viewport overrides were reset and owned preview tabs/server stopped.

The complete game browser run at `616075f` had 89 passes and one 30-second aggregate timeout. Its captured shooter gesture flow eventually passed every input assertion and attached its receipt at about 36.44 seconds. Candidate `9a15248` raises only that combined test's aggregate budget to 60 seconds, consistent with existing long gesture tests; assertions, frame observations and zero-retry policy are unchanged. The opening lookup delay's underlying cause is not established. A second full local run was stopped while the host had concurrent graphics/rendering workloads; it is not reported as a passing matrix. GitHub CI is the final full-browser acceptance gate.

Independent specification and quality reviews passed at `616075f`, with narrow PASS addenda for `9a15248`. The later commit only adjusts the justified test deadline and design/plan wording; `game/app`, `game/public` and all of `site` remain identical. These local reviews do not replace GitHub's required approving review.

Evidence directory on this workstation:
`/Users/nichalasbarnes/.codex/visualizations/2026/09/05/01a07127-3e6a-7ae1-b54b-436d683ef1c1/sector-zero-ui-design/implementation-evidence/`

Key records:
- `final-ui-9a15248-gates.json`: exact local type/unit/site/export outcomes; local full game run interrupted.
- `production-export-browser-check.json`: independent production-export inspection.
- `cinematic-final-spec-review.md`, `cinematic-final-quality-review.md`: independent reviews and addenda.
- `ui-touch-failure-diagnosis.md`: retained timeout trace analysis; no gameplay assertion failure.
- `final-ui-616075f-game-browser.json`: original 89-pass/one-timeout evidence, retained unchanged.
- `c1-merge-compatibility.json`, `preserved-root-state-final.json`: integration and preservation checks.
- Final screenshots: `game-ui-stylesheet-browser-green-artifacts/`, `site-ui-desktop-home-viewport.png`, mobile/narrow/article variants. Development captures include the existing DEV control; production inspection confirmed it absent.

## Integration and continuation

Future integration with C1 `274082d03094fbd8ffc4fd6d1b5d6c9e62cb3588` is conflict-free by `git merge-tree --write-tree` (tree `40b57eb5cbeeec79bb0ff46bfc0872b542c30a04`). This proves mergeability, not combined runtime acceptance. C1 stays separate and unmodified.

The root checkout's preexisting modified `site/tsconfig.tsbuildinfo` and untracked graphics research document retain their original hashes. The quartermaster/graphics worktrees were not changed.

Next: require green GitHub game/site browser and build checks, mark the UI PR ready, then obtain the required GitHub approving review before normal merge. The previous PR #20 admin-override approval does not carry over. This slice stops at the opening/site work; C1.2 dialogue/results and the separate graphics investigation remain distinct next tasks.

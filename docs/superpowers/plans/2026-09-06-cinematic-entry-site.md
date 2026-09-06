# Cinematic Entry and Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox syntax for tracking. User approved the visual concept and scope on 2026-09-06; implementation and parallel workers are authorized.

**Goal:** Implement the approved cinematic opening screen and companion site without changing gameplay or save authority.

**Architecture:** Keep launch callbacks and state ownership in the game shell; extract the opening presentation and local help panels. Apply the same visual language independently to the site's existing static routes. Game and site workers have disjoint ownership; the conductor provides shared artwork, integrates, verifies and commits.

**Tech Stack:** Existing Next.js 15, React 19, TypeScript, CSS and Playwright. No dependency or renderer upgrade.

---

Worktree: `/Users/nichalasbarnes/.config/superpowers/worktrees/sector-zero/cinematic-entry-site`, branch `codex/cinematic-entry-site`, starting main `ab9ed799d806ab6b380ac2c0ccfa83218448e915`.

Spec: `docs/superpowers/specs/2026-09-06-cinematic-entry-site-design.md`.

Evidence: `/Users/nichalasbarnes/.codex/visualizations/2026/09/05/01a07127-3e6a-7ae1-b54b-436d683ef1c1/sector-zero-ui-design/implementation-evidence/`.

All commands use Node 20.20.1 and `COREPACK_ENABLE_AUTO_PIN=0 COREPACK_ENABLE_PROJECT_SPEC=0`. Run app commands in the named app directory. Never run a development server and build concurrently for the same app. Workers do not commit while another worker is editing; the conductor commits the complete scoped result.

## Task 1 — baseline, approved spec and art contract (conductor)

**Files:** approved spec/this plan; `game/public/images/ui/sector-zero-key-art.webp`, `site/public/images/backgrounds/sector-zero-key-art.webp`, `docs/art/2026-09-06-cinematic-key-art.md`. If needed, local display-font files and their license/provenance under each app's `public/fonts/`; font usage belongs to the corresponding worker's layout/styles.

- [x] Install each app with `yarn install --immutable`; confirm unchanged package/lock files.
- [x] Run game TypeScript and the existing engine/Colony/sprite tests on the baseline; retain logs. Verify site TypeScript. Record known baseline failures distinctly rather than silently attributing them to UI work.
- [x] Save approved spec and this reviewed plan in the branch; record the user's approval and independent design review.
- [x] Generate a clean space key-art backdrop derived from the approved concept: planet limb and small fighter to the right, calm dark negative space to the left, no baked-in UI/text. Inspect it, encode to WebP and verify dimensions/size. Use the same image bytes at the two contract paths above; target under 500KB per hero.
- [x] Document generator/source, visual-only purpose, encoding and final hashes. Existing real gameplay screenshots remain the only images presented as gameplay captures.

## Task 2 — game opening UI (game worker)

**Owned files:** `game/app/components/Game.tsx`, `game/app/components/galaxy/GalaxyExperienceGate.tsx`, new `game/app/components/OpeningScreen.tsx`, new `game/app/components/OpeningScreen.css`, narrow additions to `game/app/globals.css` and `game/app/layout.tsx` if required for scoped fonts, new `game/tests/browser/openingScreen.spec.ts`. Do not edit engine/save/mission files, other browser suites, site files, artifacts owned by the conductor, or dependency files.

- [x] Tag every new game browser row with the existing project filters (`@keyboard`, `@pointer`, `@touch`). Write focused browser tests first for one heading, Controls/Story panels, Escape and focus return, and first-launch sound control. Run with `yarn playwright test tests/browser/openingScreen.spec.ts --workers=1 --retries=0 --reporter=list,json`; retain expected RED caused by missing UI.
- [x] Extract the old inline start markup into `OpeningScreen`, with props for `ready`, `hasGalaxyRun`, `onGalaxy`, `onLegacy`, `muted`, `onToggleMute` and optional player name. The component owns only local help-panel state. No localStorage calls or launch decisions belong in it.
- [x] Reuse `GalaxyExperienceGate` for native launch actions without the duplicate title/panel. Keep exact accessible launch names `BEGIN GALAXY`, `CONTINUE GALAXY`, `LEGACY CAMPAIGN`; buttons remain disabled until hydration. Provide context text without altering accessible names expected by the existing suite.
- [x] Match the approved concept with a large warm-white wordmark, constrained readable content, cyan primary action, understated secondary action, and the contract artwork URL resolved with the existing game base path. Main choices must remain reachable at 320px width and short landscape height.
- [x] Move existing pre-launch story text into the optional Story panel; provide accurate Controls help. Use a native dialog or existing focus utility, with visible Close, Escape, focus return, and no launch through the modal. Preserve the actual in-game intro, briefing and ending flows.
- [x] Add one shell-owned mute toggle that calls `ensureAudio()` only inside a user gesture, then updates existing `muted`. Use it for the opening control and existing mute actions so labels cannot diverge. Preserve audio behavior after leaving the opening screen; do not start audio on mount.
- [x] Scope scrolling/touch/reduced-motion styles to the opening UI. Preserve game canvas IDs, gameplay layout, pointer/touch ownership and recovery-overlay ordering. Hide duplicate global sound affordance only while the opening screen provides it.
- [x] Extend focused coverage for fresh and returning Galaxy, Legacy activation and reload persistence, keyboard/pointer/touch, hydration readiness, short-view scrollability and reduced motion. Use real interactions and the current pre-hydration fixture helper; do not mutate active game state or add test hooks to production.
- [x] Run focused tests to GREEN and `yarn tsc --noEmit --incremental false`. Report exact tests, RED/GREEN artifacts, changed files and any concerns; leave changes unstaged for conductor review.

## Task 3 — companion site (site worker)

**Owned files:** `site/app/layout.tsx`, `site/app/globals.css`, `site/app/page.tsx`, `site/app/about/page.tsx`, `site/app/coming-soon/page.tsx`, `site/app/news/page.tsx`, `site/app/news/[slug]/page.tsx`; `site/components/{Nav,Footer,HudSection,CtaButton,ModeCard,NewsItem}.tsx`; `site/data/modes.ts`; optional new small presentation component/styles under `site/components/`; focused `game/tests/site/cinematicSite.spec.ts` and `game/playwright.site.config.ts`. These site-owned harness files live beside the already installed game Playwright dependency so site-only builds never import a game-only test dependency. No new dependency or lockfile changes.

- [x] Add a focused site browser check for the broken maker-mark deployed URL and key presentation/accessibility behavior (page heading, skip link, narrow navigation, image load). Configure the existing Playwright runner to start this site's dev server on a distinct port, default 43192, with `/sector-zero/site` base path. From `game`, use `yarn playwright test --config playwright.site.config.ts --workers=1 --retries=0`; retain RED before fixing functional defects.
- [x] Define the visual system: readable Inter body via its existing variable, warm-white display text, charcoal/navy surfaces, restrained cyan, consistent centered grid, large controls, focus-visible states and reduced-motion styles. Prefer CSS and existing components over new infrastructure.
- [x] Rebuild the homepage around the contract key art, a strong player-facing premise, a prominent Play action, properly framed authentic mode screenshots, exploration content and updates. Avoid tiny square crops of portrait gameplay. Preserve the six mode links and explicit gameplay availability boundaries.
- [x] Update Nav with responsive keyboard/touch behavior and current-page indication. Preserve About, Updates, Colony and Play destinations. If using a mobile menu, define toggle/close/Escape/focus behavior and test it.
- [x] Update shared section/card/news/footer components; fix maker's-mark URL with `withBasePath`. Keep creator identity and attribution.
- [x] Bring About, Colony, News and article layouts into the same system. Preserve all route URLs and eight existing MDX article bodies. Use an optional disclosure for About's existing ending spoilers. Describe verified colony features separately from future plans, without promising seamless planets or a new 3D engine.
- [x] Make title hierarchy, skip link, image descriptions and mobile contrast usable. All internal and image URLs must work under both the empty and deployed site base paths; Play continues to target the game root.
- [x] Run focused tests to GREEN and site TypeScript. Report exact RED/GREEN results, paths and risks; do not run full builds while a site dev server is active and leave changes unstaged.

## Task 4 — integration and visual acceptance (conductor)

**Owned files:** `game/tests/browser/touchGameplay.spec.ts` only for the evidence-backed aggregate timeout of the three-route shooter gesture test; `.github/workflows/pr-checks.yml` only to run the new site browser harness with both app dependencies installed; final review/handoff records under `docs/handoffs/`, plan checkboxes, integration fixes within the lanes' allocated UI files after workers release ownership. Do not change unrelated source, root dirty files, C1 branch or quartermaster worktree.

- [ ] Read both worker diffs; verify no launch/save/mission authority changes and no unallocated files. Test adding this UI change to C1 in a temporary merge index or throwaway branch without altering the accepted C1 worktree. Resolve only actual UI overlap, retaining distinct acceptance identities.
- [ ] Inspect the running UI in the browser at 1440×900, 480×854 and a short landscape size; inspect site navigation at 320px. Compare to the approved mockup. Check dialogs, native launches, sound, mobile scrolling, image aspect ratios, loading fallback and reduced motion. Fix visual defects before broad final gates.
- [ ] Run focused game/site UI browser suites once more after integration changes. Check all site routes, maker mark and resource responses under the production base path.
- [ ] Extend PR browser verification to run the focused site harness with both app dependencies installed; preserve existing game checks and artifact retention. This necessary test-workflow allocation does not change the Pages deployment workflow.
- [ ] Stop app dev servers and commit the complete UI candidate. Record exact SHA and run game TypeScript, all engine/Colony/sprite tests, full game browser matrix with one worker/zero retries, and site focused browser tests. Verify exit codes and preserve failure evidence if a gate fails.
- [ ] Run production exports sequentially for each app with `NEXT_PUBLIC_BASE_PATH=''`, then `/sector-zero` (game) or `/sector-zero/site` (site). Confirm resulting key art, fonts, maker mark and links resolve. No broad gate repetition is needed after docs-only changes; record tree equivalence rather than relabeling test SHAs.
- [ ] Request an independent spec review followed by a separate code-quality review of the integrated result. Fix confirmed findings and rerun only affected checks, broadening when justified.
- [ ] Save a concise checkpoint with exact code/verification/review identities, screenshots, known limits and open C1/graphics work. Keep generated metadata changes out of commits. Preserve the root's original build-info bytes and research file.
- [ ] Push the focused UI branch and create a non-duplicate PR against main after checks pass. Original user authorization covers continuing and publishing reviewed work; GitHub's approving-review rule still applies. Monitor actual CI and report publication accurately. Do not assume the previous PR #20 admin-override authorization automatically covers this new PR.

### Integration finding — browser deadline

The full run at `616075f` passed 89/90 browser rows; the Galaxy shooter gesture row crossed its 30-second aggregate deadline. Its trace retained every successful gameplay assertion and completed receipt at about 36.44 seconds. The native opening-button lookup consumed 9.813 seconds, with a 7.573-second screencast gap; this does not establish a styling, network, or input defect. Allocate the same 60-second deadline already used by other long gesture tests to the three-route shooter callback. Keep all input assertions, frame observations, and zero-retry policy unchanged. Retain the failed evidence and run the complete matrix on the corrected candidate.

## Done contract

Both apps visibly follow the approved cinematic concept, native launch/reload/recovery behavior is preserved, help and sound controls work before launch, site routes/assets work on the deployed base path, desktop/mobile screenshots have been inspected, appropriate checks and production exports pass, and a reviewed commit/PR is available. This closes the opening/site slice; it does not claim C1.2 dialogue, new 3D rendering, or full-game physical-device acceptance.

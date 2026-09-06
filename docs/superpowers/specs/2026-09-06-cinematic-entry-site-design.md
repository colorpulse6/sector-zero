# Sector Zero — cinematic opening screen and site

Date: 2026-09-06
Status: approved by the user on 2026-09-06 after visual concept and independent scope review. Implementation proceeds in the isolated cinematic-entry-site worktree.

## Outcome

Give the game opening screen and companion site one recognizable visual identity: dark navy/charcoal, warm white type, restrained cyan accents, atmospheric space artwork and quiet motion. Make the next action obvious and the content readable on phones and laptops.

The selected concept is `/Users/nichalasbarnes/.codex/generated_images/01a07127-3e6a-7ae1-b54b-436d683ef1c1/exec-822f0cd0-134b-40dc-99fc-5a41be657374.png`. This is a visual mockup, not an implemented screen. Its planet/ship art is illustrative key art; its lower website images are not screenshots of shipped gameplay. Actual gameplay previews in the implementation must use verified game captures.

## Current evidence

The deployed base is main `ab9ed799d806ab6b380ac2c0ccfa83218448e915`, which merged PR #20. The user's linked failed run `33986876684` tested an earlier commit, `5e4460f`. Its browser job had five failures and four flaky cases; units, TypeScript and both builds passed. Later fixes at `87fd176` and `9f173bf` passed all 83 browser checks with zero retries in run `33989223952`. Deployment `34010714898` passed for the main merge. These are historical versus current results, not an instruction to rerun or erase the old failure.

The live opening screen repeats SECTOR ZERO in its parent and experience panel, spends 180px on an automatic story crawl, and gives both launch options the same visual emphasis. Its surrounding control hints assume the shooter control scheme. The live site has small, dim type, tightly cropped portrait screenshots and navigation with no dedicated narrow-screen layout. The footer's `/nb-mark.png` image fails to load because it omits the site's deployed base path; its natural image dimensions were zero in the live DOM while the other site images loaded.

## Selected approach and alternatives

Use a coherent cinematic presentation across both apps. A modest cleanup would preserve too much of the crowded opening hierarchy; a brighter arcade treatment would compete with the chosen restrained style. Keep the six game modes and the gameplay renderer intact while upgrading their introduction and public presentation.

## Game opening screen

- Replace the duplicate heading and looping pre-launch crawl with one responsive opening composition. Extract the existing start-screen markup from `Game.tsx` into a small presentation component; keep launch and persistence decisions in the existing shell.
- Show the SECTOR ZERO title, the existing last-pilot subtitle, a short premise, and two real native buttons. `BEGIN GALAXY` becomes `CONTINUE GALAXY` only when the existing `hasGalaxyRun` value says so. `LEGACY CAMPAIGN` remains available with concise campaign context. Preserve both paths and their existing callback semantics.
- Make Galaxy the visually prominent first action, matching the current choice order. Do not automatically launch, create a new run, reset progress, or change the selected experience until the user activates a button.
- Keep both launch actions disabled until the save finishes hydrating. Use an honest loading state; preserve existing recovery behavior after activation. The redesign must not hide pending outcome or travel recovery overlays.
- Move the existing story text into an optional, scrollable “The story so far” panel. This only changes how the existing pre-launch text is presented. The in-game intro sequence, skip behavior, narrative timing and `introSeen` semantics remain unchanged.
- Provide an optional Controls panel with introductory guidance and an explanation that active-mode controls appear during play. Use current control definitions; do not repeat a universal Space-to-shoot claim across all modes.
- Give panels a visible close action, Escape dismissal and focus return. Native buttons must retain Enter/Space activation without duplicate global input handling. No background launch may happen while a help panel is open.
- Consolidate the opening screen's sound control with the existing mute state and handler; do not add a second audio state or force the mockup's example `SOUND OFF` value. Audio still obeys user-gesture requirements. The opening control must work before the first launch: initialize the existing audio engine through `ensureAudio` inside the button gesture if necessary, then update the same authoritative mute state. Do not initialize or start audio merely by rendering the screen.
- On narrow or short viewports, use a single column with the primary actions immediately reachable and a scrollable start-screen container. Scope any overflow/touch changes to the opening UI so gameplay canvas controls retain their current ownership.

## Companion site

- Use the same title treatment, palette and art family. Wire the existing body font correctly, improve contrast, and use a consistent centered page grid. Keep small monospace labels as accents rather than body typography.
- Homepage: compact navigation, a clear player-facing premise, a prominent Play in Browser action, and larger previews of the actual game. Rework mode descriptions around what the player does. Preserve all six mode links and all existing news routes.
- Add a stronger exploration/colony section using existing verified features. Clearly distinguish currently playable settlement/NPC/shop features from later colony ambitions. Preserve `/coming-soon/` as a working route even if its heading/navigation label changes; it may become the colony overview without changing its URL in this pass.
- Carry the shared layout, heading hierarchy and typography through About, News, individual articles and the colony page. Present existing ending spoilers behind a clear optional disclosure on About. Keep article bodies and their meaning intact.
- Make navigation usable at 320px and wider. Preserve About, Updates, Colony and Play destinations even if the concept's compact mockup did not show every link. Use generous touch targets and a visible current-page state.
- Fix the footer maker's-mark URL through the existing base-path helper. Preserve the creator mark, attribution, GitHub/creator links, metadata and structured-data identity.
- Add a skip link, deliberate keyboard focus treatment, meaningful headings and readable text. Reduce or remove decorative motion under `prefers-reduced-motion`; motion never delays access to Play.

## Artwork and technical boundaries

Use optimized local artwork, with separate deliberate crops for desktop and mobile. Prefer the current art library and genuine gameplay captures for content previews. If the selected planet/starfighter direction needs a new background asset, generate a clean key-art asset without baked-in buttons or text; retain its provenance and label any concept-only imagery appropriately. Never use the mockup bitmap itself as the working UI.

Both apps remain independently exportable Next.js applications. No new renderer, backend, account system, third-party analytics, animation framework or package upgrade is required. Shared visual values may be mirrored explicitly in the two apps; do not introduce a monorepo package migration solely to share a few style tokens. Use CSS for restrained presentation motion and retain a static fallback.

Keep empty-base and deployed-base asset paths working. Lazy-load below-fold images, prioritize the small hero asset deliberately, avoid autoplay video and preserve useful fallback backgrounds. Proposed asset budget: no single opening hero download above 500KB without measured justification; correctness and visual quality are both checked after optimization.

## Ownership and work allocation

Start a fresh UI worktree from current main. Preserve root's modified `site/tsconfig.tsbuildinfo` and untracked `docs/research/`; preserve the separate quartermaster and unfinished asset worktrees. The accepted C1 briefing continuation at local `274082d` stays separate; limit the UI `Game.tsx` edit to start-screen composition and required input/audio wiring, then check future integration against C1.

Game lane: `game/app/components/Game.tsx`, `game/app/components/galaxy/GalaxyExperienceGate.tsx`, a new opening-screen presentation component and scoped stylesheet, approved local UI artwork, and focused opening-screen browser coverage. Global CSS changes must be narrowly scoped. No engine, save schema, mission outcome, combat or briefing-renderer edits.

Site lane: the homepage, root layout/global styles, About, Colony/coming-soon, News index/article layout, `Nav`, `Footer`, `HudSection`, `CtaButton`, `ModeCard`, `NewsItem`, `data/modes.ts`, approved local artwork and focused route/asset checks. Keep MDX bodies, content loading, structured-data identity and deployment configuration outside scope unless a demonstrated presentation requirement is explicitly allocated.

The game and site lanes can run in parallel after the design is accepted. Each lane owns its files. Integrate them before the final visual and browser review.

## Acceptance and stopping point

1. Show final opening screen and homepage at desktop and mobile sizes against the chosen concept. Check a short landscape viewport and 320px navigation. No clipped launch actions, horizontal overflow, unreadable labels or motion-dependent content.
2. Exercise fresh and returning Galaxy saves, Legacy activation, keyboard/pointer/touch input, loading readiness, help-panel focus/close behavior, sound state before the first launch and after entry, and persistence after reload. Existing launch/recovery authority remains intact.
3. Verify every preserved site route and primary link, article images, maker mark and base-path asset loading. Check both the homepage and one full article with keyboard navigation and reduced motion.
4. Run the relevant TypeScript/unit/browser regression checks and both applications' production exports. Record which commit was tested. Do not relabel C1's old test results as UI validation.
5. Review the integrated diff and final screenshots independently. Publish a focused UI PR only after acceptance evidence is complete. Keep actual CI, merge and deployment status explicit; approval of this visual design does not waive GitHub's review rule.

Stop after this opening-screen/site pass. The C1.2 dialogue/result work and the separate 3D graphics/asset investigation remain distinct next tasks.

## Design-stage checklist

- [x] Verify the linked failing run against current CI and deployment.
- [x] Inspect the live game opening screen and companion site, plus their source.
- [x] Gather the user's visual direction: cinematic sci-fi.
- [x] Present a coordinated visual concept and concrete implementation scope.
- [x] Independent review of this proposed scope: Approved; first-launch sound-control clarification incorporated.
- [x] User accepts the concrete design before implementation: “yeah that looks awesome”.
- [x] Save accepted spec in the isolated branch and write the implementation plan.

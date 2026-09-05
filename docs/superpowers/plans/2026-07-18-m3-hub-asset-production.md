# M3 Hub Asset Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce and verify the reusable Ashfall Cantina, Marketplace, and Town Hall environment kits plus eight NPC portrait/billboard identities that M3 code can consume without runtime AI or renderer-specific hacks.

**Architecture:** Treat art as three independent hub bundles, completed in the order Cantina → Marketplace → Town Hall. Rejected generations remain temporary; selected full-resolution sources, production derivatives, and evidence are committed. This plan ends at `PRODUCTION-REVIEWED`; runtime registration and `INTEGRATED` status belong to a separate M3 code plan with a real hub consumer, preserving fallbacks and keeping asset work independent from unresolved tier, district, and bulletin-board decisions.

**Tech Stack:** Codex `image_gen`, Sector Zero master prompt guide, ImageMagick, BiRefNet/chroma-key alpha, PNG/sRGB, Next.js 15 static export, Canvas 2D raycaster, `sprites.ts`, `tsx --test` sprite/colony/engine gates.

---

## Authority and scope

Read in order:

1. `docs/ROADMAP.md` — milestone order and G0/M3 status.
2. `docs/assets/prompts/doom/00-master-style-guide.md` — authoritative aesthetic.
3. `docs/assets/2026-07-12-asset-pipeline-free-options.md` — accepted production pipeline.
4. `docs/assets/prompts/m3-hubs/README.md` — exact paths, dimensions, and manifest.
5. `docs/assets/prompts/m3-hubs/01-environments.md`.
6. `docs/assets/prompts/m3-hubs/02-npcs.md`.
7. `docs/assets/prompts/m3-hubs/03-review-and-integration.md`.
8. `game/CLAUDE.md` — static-export and engine constraints.

This plan does **not** implement M3 hub gameplay. Do not decide colony tier promotion,
district layout, bulletin-board persistence, market economy, policy systems, or deep NPC
schedules while executing it. Those require their own reviewed systemic plan. M3 art may
land before its consumer and retain a tint/legacy fallback.

At plan authoring, `origin/main` is merge commit `6744a49` with G0 Atlas merged. The last
verified gates were TypeScript clean, colony 284/284, engine 282/282, sprites 4/4, and a
successful static export. Re-verify live state before execution; these counts are evidence,
not permanent expectations.

## File structure

Generated production files:

```text
game/public/sprites/interiors/m3/cantina/
game/public/sprites/interiors/m3/marketplace/
game/public/sprites/interiors/m3/town-hall/
game/public/sprites/walls/{cantina,marketplace,town-hall}.png
game/public/sprites/boarding/npc-hub-*.png
game/public/sprites/portraits/hub-*.png
```

Review evidence:

```text
docs/assets/reviews/m3-hubs/cantina/
docs/assets/reviews/m3-hubs/marketplace/
docs/assets/reviews/m3-hubs/town-hall/
```

Reproducible selected sources and asset validation:

```text
docs/assets/source/m3-hubs/{cantina,marketplace,town-hall}/
docs/assets/prompts/m3-hubs/manifest.json
game/scripts/sprites/validateM3HubAssets.ts
game/tests/sprites/m3HubAssets.test.ts
```

Do not modify `sprites.ts`, `buildingTiles.ts`, `colonyLayout.ts`, renderers, or
`game/scripts/sprites/sheets.ts` in this asset-production plan. A later M3 integration plan
owns those seams and must test the real runtime consumer.

### Task 1: Establish a clean asset branch and baseline

**Files:**
- Read: authority files above
- Do not modify: the user's existing checkout

- [ ] **Step 1: Record the primary checkout and create an isolated worktree**

Run exactly:

```bash
cd /Users/nichalasbarnes/Desktop/projects/sector-zero
git status -sb
git fetch origin main
git worktree add /private/tmp/sector-zero-m3-hub-assets -b feat/m3-hub-assets origin/main
cd /private/tmp/sector-zero-m3-hub-assets
git status -sb
```

Expected: the primary checkout's pre-existing dirty files are recorded and unchanged; the
new worktree is clean on `feat/m3-hub-assets` based on current `origin/main`.

- [ ] **Step 2: Install the locked game dependencies without repository drift**

From the new worktree:

```bash
cd game
yarn install --immutable
git diff --exit-code -- ../package.json package.json ../yarn.lock yarn.lock
```

Expected: install exits 0 and the package/lock files are unchanged. If Corepack adds a local
`packageManager` field, remove only that generated line, rerun the diff check, and do not
commit it.

- [ ] **Step 3: Record live baseline identity**

Run:

```bash
git status -sb
git rev-parse HEAD
git log -5 --oneline
```

Expected: clean feature worktree based on the current merged `main`.

- [ ] **Step 4: Verify the relevant baseline**

From `game/` run:

```bash
npx tsc --noEmit
yarn sprites:test
```

Expected: both exit 0. Also run `magick -version`; asset production requires ImageMagick.
If `tsx` cannot create its local IPC pipe in a managed sandbox, rerun the identical command
outside that restriction before treating it as a product bug.

- [ ] **Step 5: Add the manifest regression test and local visual validator**

Create `game/tests/sprites/m3HubAssets.test.ts`. It reads
`docs/assets/prompts/m3-hubs/manifest.json`, always asserts unique constants/paths/source
paths, positive integer production dimensions, and a status of exactly `planned` or
`production-reviewed` for every bundle. For each production-reviewed bundle, it asserts each
selected source exists and is a readable PNG, without applying derivative dimensions or alpha
rules to that source. It separately reads every production PNG's IHDR: width at byte 16,
height at byte 20, bit depth at byte 24, and color type at byte 25. Production files must
match manifest dimensions and use 8-bit RGB (`2`) when opaque or 8-bit RGBA (`6`) when
transparent.

Create `game/scripts/sprites/validateM3HubAssets.ts`. Its CLI is:

```bash
npx tsx scripts/sprites/validateM3HubAssets.ts --hub cantina
```

It reads the same manifest, invokes ImageMagick with `spawnSync` argument arrays (no shell),
and fails on a missing file, wrong dimensions/channels, non-transparent corners, empty bottom
contact band for `bottomContact: true`, or missing required review evidence. Seam quality
remains a visual-review decision recorded in the required 2×2 panel. The validator supports an
optional `--category environment|props|npcs` during partial production; without that flag it
validates the complete hub bundle. Category mode requires only that category's files and
evidence (`textures-2x2.png` for environment; `props-actual-size.png` and the current
`billboards-dark-bright.png` for props; `npc-identity-pairs.png` and the completed dark/bright
panel for NPCs). Full mode also requires `provenance.md` and all four panels. With all bundles
still `planned`, `yarn sprites:test` passes; the direct Cantina CLI fails with
`missing production asset` until Tasks 2 and 3 supply the complete bundle.

- [ ] **Step 6: Create temporary attempt directories**

Use `/private/tmp/sector-zero-m3-cantina/{raw,processed,evidence}`. Do not commit rejected
sources or tool caches.

### Task 2: Produce the Cantina environment kit

**Files:**
- Create: `game/public/sprites/interiors/m3/cantina/wall.png`
- Create: `game/public/sprites/interiors/m3/cantina/floor.png`
- Create: `game/public/sprites/interiors/m3/cantina/ceiling.png`
- Create: `game/public/sprites/interiors/m3/cantina/{bar-counter,bottle-rack,table-cluster,rumor-terminal}.png`
- Create: `game/public/sprites/walls/cantina.png`
- Create: `docs/assets/source/m3-hubs/cantina/*-source.png`
- Create: `docs/assets/reviews/m3-hubs/cantina/provenance.md`
- Create: Cantina review panels listed in the review contract

- [ ] **Step 1: Generate wall, floor, ceiling, and facade separately**

Use the exact Cantina prompts in `01-environments.md` and the master suffixes. Generate one
texture per request at 1024×1024; the facade is its own exterior-modified request, not a crop
of the interior wall. Keep at least one rejected candidate with its rejection reason in
`provenance.md`, but do not commit the rejected PNG. Copy all four selected sources to the
manifest's `docs/assets/source/m3-hubs/cantina/` paths.

- [ ] **Step 2: Prove every texture tiles**

For each candidate, create offset and 2×2 previews. Expected: no central cross, exposure
checkerboard, hard material discontinuity, room perspective, or readable marks.

- [ ] **Step 3: Derive exact opaque production textures**

Downscale selected interior sources to 512×512 and the selected facade source to 64×64. Run `magick identify`.
Expected: exact sizes, PNG, sRGB, no alpha channel required.

- [ ] **Step 4: Generate and matte four props separately**

Use the flat-green directive. Every production prop is a 256×256 RGBA canvas; preserve wide
or tall visible-subject proportions with transparent padding. Copy every selected raw source
to its manifest source path. Expected: transparent corners, non-empty bottom contact, no
green spill, no fog rectangle, and a readable small-size silhouette.

- [ ] **Step 5: Build Cantina review evidence**

Create `textures-2x2.png`, `props-actual-size.png`, and the prop portion of
`billboards-dark-bright.png`. Enlarge actual-size props with nearest neighbor only for the
labeled inspection panel.

- [ ] **Step 6: Prove the component validators pass while the bundle remains planned**

Keep Cantina `planned` because its NPC contract does not exist yet. Run:

```bash
npx tsx scripts/sprites/validateM3HubAssets.ts --hub cantina --category environment
npx tsx scripts/sprites/validateM3HubAssets.ts --hub cantina --category props
yarn sprites:test
```

Expected: all exit 0. This proves the two completed component contracts; the manifest test
does not treat the incomplete Cantina bundle as production-reviewed.

- [ ] **Step 7: Commit the reviewed environment component**

```bash
git add game/public/sprites/interiors/m3/cantina game/public/sprites/walls/cantina.png docs/assets/source/m3-hubs/cantina docs/assets/reviews/m3-hubs/cantina game/scripts/sprites/validateM3HubAssets.ts game/tests/sprites/m3HubAssets.test.ts
git commit -m "art(hubs): add Cantina environment kit"
```

Do not register unused paths merely to make this commit look integrated.

### Task 3: Produce the Cantina NPC identities

**Files:**
- Create: `game/public/sprites/portraits/hub-{bartender,regular,signal-chaser}.png`
- Create: `game/public/sprites/boarding/npc-hub-{bartender,regular,signal-chaser}.png`
- Create: `docs/assets/source/m3-hubs/cantina/hub-*-source.png`
- Modify: `docs/assets/reviews/m3-hubs/cantina/provenance.md`
- Create/modify: `docs/assets/reviews/m3-hubs/cantina/npc-identity-pairs.png`

- [ ] **Step 1: Generate and select one portrait at a time**

Order: bartender, regular, signal-chaser. Use the role brief plus shared portrait prompt.
Expected: square single-subject identity, no late-game mutation or readable marks.

- [ ] **Step 2: Generate each idle billboard from its selected portrait**

Attach the portrait as the identity reference. Do not proceed when face, build, clothing, or
equipment drifts. The production derivative is 128×256 RGBA. Commit selected full-resolution
portrait and billboard sources at the exact manifest source paths.

- [ ] **Step 3: Matte and inspect identity pairs**

Complete `billboards-dark-bright.png` with the NPCs and create the side-by-side identity
panel. Inspect at 48px character height as well as 128×256.

- [ ] **Step 4: Record walk frames as deferred, not missing**

Do not generate walk frames in this plan: they have no M3 manifest or runtime consumer.
Record the bartender as the first future candidate without adding files or weakening the
idle-pair gate.

- [ ] **Step 5: Promote the complete Cantina bundle and commit**

Change only Cantina's manifest status from `planned` to `production-reviewed`, then run:

```bash
npx tsx scripts/sprites/validateM3HubAssets.ts --hub cantina
yarn sprites:test
```

Expected: both exit 0 and the complete hub contract—including all required review panels—is
present. Then commit:

```bash
git add game/public/sprites/portraits/hub-bartender.png game/public/sprites/portraits/hub-regular.png game/public/sprites/portraits/hub-signal-chaser.png game/public/sprites/boarding/npc-hub-bartender.png game/public/sprites/boarding/npc-hub-regular.png game/public/sprites/boarding/npc-hub-signal-chaser.png docs/assets/source/m3-hubs/cantina docs/assets/reviews/m3-hubs/cantina docs/assets/prompts/m3-hubs/manifest.json
git commit -m "art(hubs): add Cantina NPC identities"
```

Stop here for review if the first complete bundle does not meet the actual-size gate. Do not
multiply an unresolved style or alpha problem across two more hubs.

### Task 4: Produce the Marketplace bundle

**Files:**
- Create: `game/public/sprites/interiors/m3/marketplace/*`
- Create: `game/public/sprites/walls/marketplace.png`
- Create: `game/public/sprites/portraits/hub-{arms-dealer,provisioner,contract-broker}.png`
- Create: `game/public/sprites/boarding/npc-hub-{arms-dealer,provisioner,contract-broker}.png`
- Create: `docs/assets/source/m3-hubs/marketplace/*-source.png`
- Create: `docs/assets/reviews/m3-hubs/marketplace/*`

- [ ] **Step 1: Repeat the production-reviewed Cantina workflow using Marketplace prompts**

Expected: a colder, denser trade floor that is structurally distinct from the Cantina, not
a cyan palette swap.

- [ ] **Step 2: Generate the five manifest props separately**

Every prop uses a 256×256 RGBA canvas with its natural visible-subject proportions preserved
inside transparent padding. Generate the exterior facade separately from the interior wall.

- [ ] **Step 3: Produce the three identity pairs**

Generate portrait first, then reference-locked 128×256 billboard. Contract broker is the
first walk-frame candidate after all idle pairs pass.

- [ ] **Step 4: Verify and commit**

Run `magick identify` over every production file and complete the Marketplace review panels.

```bash
git add game/public/sprites/interiors/m3/marketplace game/public/sprites/walls/marketplace.png game/public/sprites/portraits/hub-arms-dealer.png game/public/sprites/portraits/hub-provisioner.png game/public/sprites/portraits/hub-contract-broker.png game/public/sprites/boarding/npc-hub-arms-dealer.png game/public/sprites/boarding/npc-hub-provisioner.png game/public/sprites/boarding/npc-hub-contract-broker.png docs/assets/source/m3-hubs/marketplace docs/assets/reviews/m3-hubs/marketplace docs/assets/prompts/m3-hubs/manifest.json
git commit -m "art(hubs): add Marketplace asset bundle"
```

Before this commit, mark only Marketplace `production-reviewed` and pass its direct validator
plus `yarn sprites:test`:

```bash
npx tsx scripts/sprites/validateM3HubAssets.ts --hub marketplace
yarn sprites:test
```

Stage explicit paths; do not restage Cantina or unrelated art.

### Task 5: Produce the Town Hall bundle

**Files:**
- Create: `game/public/sprites/interiors/m3/town-hall/*`
- Create: `game/public/sprites/walls/town-hall.png`
- Create: `game/public/sprites/portraits/hub-{governor,civic-clerk}.png`
- Create: `game/public/sprites/boarding/npc-hub-{governor,civic-clerk}.png`
- Create: `docs/assets/source/m3-hubs/town-hall/*-source.png`
- Create: `docs/assets/reviews/m3-hubs/town-hall/*`

- [ ] **Step 1: Produce and tile-check the severe civic environment kit**

Expected: more ordered and permanent than the other hubs, but made from the same frontier
materials. Reject flags, heraldry, polished luxury, and readable seals. Generate the exterior
facade separately from the interior wall and copy every selected source to its manifest path.

- [ ] **Step 2: Produce five props and two identity pairs**

Use the exact manifest dimensions. The governor is the first walk-frame candidate after both
idle pairs pass.

- [ ] **Step 3: Build the complete review evidence and commit**

Before committing, change only Town Hall's manifest status to `production-reviewed`, then run
its complete direct validator and `yarn sprites:test`:

```bash
npx tsx scripts/sprites/validateM3HubAssets.ts --hub town-hall
yarn sprites:test
```

Both must exit 0.

```bash
git add game/public/sprites/interiors/m3/town-hall game/public/sprites/walls/town-hall.png game/public/sprites/portraits/hub-governor.png game/public/sprites/portraits/hub-civic-clerk.png game/public/sprites/boarding/npc-hub-governor.png game/public/sprites/boarding/npc-hub-civic-clerk.png docs/assets/source/m3-hubs/town-hall docs/assets/reviews/m3-hubs/town-hall docs/assets/prompts/m3-hubs/manifest.json
git commit -m "art(hubs): add Town Hall asset bundle"
```

### Task 6: Prepare the systemic integration handoff

**Files:**
- Modify: each hub's `provenance.md`
- Do not modify: game runtime source

- [ ] **Step 1: Record exact claim status**

For every manifest entry record `PRODUCTION-REVIEWED, NOT REGISTERED, NOT INTEGRATED`.
List any optional walk frame separately; its absence does not block the initial bundle.

- [ ] **Step 2: Record the live integration gaps**

The handoff must state that current `InteriorTemplate` has no environment-art or NPC-placement
fields, `generateInteriorState` hardcodes its default wall/floor and no ceiling, FP props use
a square plane, and the FP dialog renderer does not draw `portraitKey`. Do not propose an
unreviewed patch in this asset branch.

- [ ] **Step 3: Name the next required document**

The next systemic artifact is an M3 Cantina code design/plan defining layout, interior asset
fields, interior NPC placement/schedules, interaction, DevPanel fixture, normal player access,
and Atlas/bulletin-board boundaries. Runtime registration belongs there.

### Task 7: Full verification and publication

**Files:**
- Modify: each hub's `provenance.md` with final results

- [ ] **Step 1: Validate production files**

Run:

```bash
npx tsx scripts/sprites/validateM3HubAssets.ts --hub cantina
npx tsx scripts/sprites/validateM3HubAssets.ts --hub marketplace
npx tsx scripts/sprites/validateM3HubAssets.ts --hub town-hall
yarn sprites:test
```

Expected: no missing production or source files, wrong production dimensions/color type,
accidental non-PNG sources, opaque corners, empty contact bands, duplicate manifest
identifiers, unknown bundle statuses, or missing review panels.

- [ ] **Step 2: Run repository gates from `game/`**

```bash
npx tsc --noEmit
yarn colony:test
yarn engine:test
yarn sprites:test
yarn build
NEXT_PUBLIC_DEVTOOLS=1 yarn build
```

Expected: all exit 0. Record current counts rather than copying the counts in this plan.

- [ ] **Step 3: Confirm the honest visual boundary**

Inspect the committed 2×2, dark/bright, actual-size, and identity-pair evidence. Do not create
a fake hub screenshot or claim a production-export playtest: these assets have no runtime
consumer in this plan. The later integration PR owns the 480×854 gameplay evidence.

- [ ] **Step 4: Inspect scope**

```bash
git diff --check origin/main...HEAD
git diff --stat origin/main...HEAD
git status -sb
git -C /Users/nichalasbarnes/Desktop/projects/sector-zero status -sb
```

Expected: no unrelated runtime source, balance, renderer, generated cache, `.DS_Store`, lockfile, or
Corepack `packageManager` changes. Compare the primary-checkout output with Task 1 and confirm
the user's pre-existing files and branch are unchanged.

- [ ] **Step 5: Request independent visual/code review**

The reviewer compares the contract, exact production/source files, review panels, validators,
and claim levels. Fix blocking findings before publication.

- [ ] **Step 6: Commit the final claim-status and verification handoff**

```bash
git add docs/assets/reviews/m3-hubs/cantina/provenance.md docs/assets/reviews/m3-hubs/marketplace/provenance.md docs/assets/reviews/m3-hubs/town-hall/provenance.md
git commit -m "docs(hubs): record asset integration handoff"
```

Expected: all Task 6/7 provenance updates are tracked and `git status -sb` is clean.

- [ ] **Step 7: Push and open a draft PR**

The PR body lists generated assets, processing/provenance, exact gates, visual evidence, and
states every file is `PRODUCTION-REVIEWED, NOT INTEGRATED`. Do not merge without explicit
user approval.

## Handoff rule

If the work stops mid-bundle, leave a dated `provenance.md` with selected/rejected state,
raw temporary directory, exact next asset, and commands already run. A later agent should
resume the next unchecked step rather than regenerate accepted work.

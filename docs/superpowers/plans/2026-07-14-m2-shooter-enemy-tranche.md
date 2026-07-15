# M2 Shooter Enemy Tranche Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the four most frequently authored vertical-shooter enemies with distinct, readable, provenance-documented single-frame art while preserving every runtime and gameplay contract.

**Architecture:** Keep the existing `SPRITES` paths, `ENEMY_SPRITE_MAP`, 1536x1024 source canvases, single-frame layout, entity dimensions, renderer padding, and gameplay behavior unchanged. Generate each subject independently on flat chroma green, matte it outside the production tree, fit it without distortion into the original alpha-footprint envelope, then accept it only after actual-size, Bestiary, and real-level browser checks.

**Tech Stack:** Built-in Codex image generation, local chroma-key helper/BiRefNet fallback, ImageMagick, Next.js 15 static export, Canvas 2D, Playwright CLI, TypeScript/Node test suites.

---

## Fixed contracts

- Branch: `feat/m2-shooter-enemy-tranche`
- Worktree: `/private/tmp/sector-zero-m2-shooter`
- Base: current `origin/main` at `d052814` after the final docs-only rebase
- Production paths remain `game/public/sprites/enemies/{swarm,bomber,gunner,drone}.png`.
- Every production source remains 1536x1024 RGBA with one frame.

| Enemy | Original max 5%-alpha envelope | Entity/hitbox | Gameplay render | Bestiary |
|---|---:|---:|---:|---:|
| Swarm | 559x594 | 24x24 | 32x32 | 96x96 |
| Bomber | 414x829 | 36x48 | 44x56 | 96x96 |
| Gunner | 668x548 | 48x48 | 56x56 | 96x96 |
| Drone | 420x413 | 32x32 | 40x40 | 96x96 |

Every generation uses the flat `#00ff00` removal-background block and the exact positive and negative suffixes from `docs/assets/prompts/doom/00-master-style-guide.md` section 8. Asset-specific text explicitly says top-down shooter readability and Sector Zero identity outrank literal FPS/DOOM fidelity.

---

### Task 1: Establish the baseline and preserve originals

**Files:**
- Create: `docs/assets/prompts/shooter/01-m2-first-tranche.md`
- Create: `docs/assets/reviews/m2-shooter-enemies/before-world-1-4.png`
- Create: `docs/assets/reviews/m2-shooter-enemies/before-world-3-3.png`
- Create: `docs/assets/reviews/m2-shooter-enemies/before-world-8-3.png`
- Create: `docs/assets/reviews/m2-shooter-enemies/before-world-5-4.png`
- Create: `docs/assets/reviews/m2-shooter-enemies/before-bestiary.png`
- Preserve outside repository: `/private/tmp/sector-zero-m2-originals/*.png`

- [ ] **Step 1: Verify the isolated base and install exact dependencies**

Run from the worktree root:

```bash
git status --short --branch
git rev-parse HEAD
git rev-parse origin/main
```

Run `yarn install --immutable` from `game/`. Expected: exit 0 and no lockfile change.

- [ ] **Step 2: Run and record the pre-change baseline**

Run individually from `game/`:

```bash
npx tsc --noEmit
yarn colony:test
yarn engine:test
yarn sprites:test
yarn build
NEXT_PUBLIC_DEVTOOLS=1 yarn build
```

Record exact counts/results. If any command fails, stop before changing sprites.

- [ ] **Step 3: Preserve and inspect the originals**

Create `/private/tmp/sector-zero-m2-originals`, copy the four production PNGs there, and run:

```bash
magick identify -format '%f %wx%h %[channels] opaque=%[opaque]\n' /private/tmp/sector-zero-m2-originals/*.png
magick FILE -alpha extract -threshold 5% -trim -format '%@\n' info:
```

Expected: the dimensions, alpha, and envelopes in the fixed-contract table.

- [ ] **Step 4: Create the provenance document**

Use `apply_patch` to record frequency evidence, registrations, source/frame geometry, entity and rendered dimensions, representative levels, the exact authoritative prompt blocks, tool/seed policy, reference roles, baseline results, and per-enemy accepted/rejected attempt tables. A built-in generation with no exposed seed is recorded as `not exposed by built-in tool`.

- [ ] **Step 5: Capture the five baseline views**

Serve the DevPanel-enabled `game/out` on port 3000. With a named Playwright session resized to 480x854, enable invincibility and capture named-enemy frames in World 1-4, 3-3, 8-3, and 5-4. Seed only this browser's `sector-zero-save.bestiary` with the four discovered entries, navigate through the cockpit to Bestiary detail, and capture the 96x96 use. Run `playwright-cli -s=m2-before console error` and require no new errors.

- [ ] **Step 6: Commit the baseline evidence**

```bash
git add docs/assets/prompts/shooter/01-m2-first-tranche.md docs/assets/reviews/m2-shooter-enemies
git diff --cached --check
git commit -m "docs(assets): record shooter enemy baseline"
```

---

### Task 2: Replace Swarm with a readable bio-organic cluster

**Files:**
- Modify: `game/public/sprites/enemies/swarm.png`
- Modify: `docs/assets/prompts/shooter/01-m2-first-tranche.md`

- [ ] **Step 1: Generate one canonical candidate with the built-in image tool**

Use the shared prompt blocks plus:

```text
Single-frame top-down vertical-shooter enemy: the Swarm, three small hooked bio-organic attack organisms packed into one compact serrated hunting cluster; asymmetric three-lobed black silhouette; leathery chitin and scorched bone; tiny ember-red sensory pits; no machinery or humanoid anatomy. Strict top-down/front-down view, cluster points toward the bottom, chunky connected mass, no thin antennae. It must read as a three-body swarm when the complete source is drawn at 32x32 and must not resemble a narrow red arrowhead or the Bomber.
```

Copy the tool's exact returned output to `/private/tmp/sector-zero-m2-sources/swarm-source.png`. Self-rejected outputs go under `/private/tmp/sector-zero-m2-rejected/` and are documented by identifier and concrete reason. Make only targeted retries.

- [ ] **Step 2: Matte and fit outside production**

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --input /private/tmp/sector-zero-m2-sources/swarm-source.png --out /private/tmp/sector-zero-m2-sources/swarm-alpha.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
magick /private/tmp/sector-zero-m2-sources/swarm-alpha.png -trim +repage -resize '559x594>' -gravity center -background none -extent 1536x1024 /private/tmp/sector-zero-m2-sources/swarm-production.png
```

Retry once with `--edge-contract 1` for fringe; use `rembg i -m birefnet-general` only if chroma removal still fails.

- [ ] **Step 3: Validate and compare**

Require 1536x1024 sRGBA, transparent corners, plausible 5%-alpha coverage, no chroma/white fringe, a legible 32x32 dark/bright view, and a coherent 96x96 view. Reject if the cluster becomes noise or another arrowhead.

- [ ] **Step 4: Replace, document, guard, and commit**

```bash
cp /private/tmp/sector-zero-m2-sources/swarm-production.png public/sprites/enemies/swarm.png
yarn sprites:test
git diff --check
git add public/sprites/enemies/swarm.png ../docs/assets/prompts/shooter/01-m2-first-tranche.md
git commit -m "feat(assets): give Swarm a readable clustered silhouette"
```

---

### Task 3: Replace Bomber with a breaching torpedo

**Files:**
- Modify: `game/public/sprites/enemies/bomber.png`
- Modify: `docs/assets/prompts/shooter/01-m2-first-tranche.md`

- [ ] **Step 1: Generate with the shared blocks and this subject**

```text
Single-frame top-down vertical-shooter enemy: the Bomber, one heavy bulbous bio-organic breaching torpedo grown around a blunt armored ram; swollen furnace-like abdomen; scorched chitin and bone armor; one compact hellfire-orange internal sac; no wings or humanoid anatomy. Strict top-down/front-down view, ram points toward the bottom, tall weighty mass with a broad rear abdomen. It must read as one large kamikaze organism at 44x56, not a Swarm or narrow red arrowhead.
```

- [ ] **Step 2: Matte, fit, and validate**

Use the Task 2 flow, fitting without distortion inside `414x829` before extending to 1536x1024. Require clean alpha, 44x56 dark/bright readability, and a coherent 96x96 Bestiary view. Reject if the hot sac consumes the silhouette or the result resembles Swarm.

- [ ] **Step 3: Replace, document, guard, and commit**

```bash
cp /private/tmp/sector-zero-m2-sources/bomber-production.png public/sprites/enemies/bomber.png
yarn sprites:test
git diff --check
git add public/sprites/enemies/bomber.png ../docs/assets/prompts/shooter/01-m2-first-tranche.md
git commit -m "feat(assets): make Bomber read as a breaching threat"
```

---

### Task 4: Replace Gunner with an industrial weapons barge

**Files:**
- Modify: `game/public/sprites/enemies/gunner.png`
- Modify: `docs/assets/prompts/shooter/01-m2-first-tranche.md`

- [ ] **Step 1: Generate with the shared blocks and this subject**

```text
Single-frame top-down vertical-shooter enemy: the Gunner, a broad square industrial weapons barge with twin oversized cannon shoulders, a dense central armored block, worn gunmetal plates, recessed mechanisms, and restrained amber muzzle/vent emissives; no bright painted armor or humanoid anatomy. Strict top-down/front-down view, cannons point toward the bottom, wide stable rectangular silhouette, no fragile antennae. Its heavy fire-support role must read at 56x56 and remain much wider and more mechanical than the other three.
```

- [ ] **Step 2: Matte, fit, and validate**

Fit without distortion inside `668x548`, then extend to 1536x1024. Require clean alpha, visible cannons at 56x56, restrained emissives, and a coherent 96x96 view. Reject triangular silhouettes or painted-looking glow.

- [ ] **Step 3: Replace, document, guard, and commit**

```bash
cp /private/tmp/sector-zero-m2-sources/gunner-production.png public/sprites/enemies/gunner.png
yarn sprites:test
git diff --check
git add public/sprites/enemies/gunner.png ../docs/assets/prompts/shooter/01-m2-first-tranche.md
git commit -m "feat(assets): broaden Gunner into a weapons barge"
```

---

### Task 5: Replace Drone with a compact three-vane machine

**Files:**
- Modify: `game/public/sprites/enemies/drone.png`
- Modify: `docs/assets/prompts/shooter/01-m2-first-tranche.md`

- [ ] **Step 1: Generate with the shared blocks and this subject**

```text
Single-frame top-down vertical-shooter enemy: the Drone, a compact spherical autonomous attack machine with three thick stabilizer vanes, one cold tech-cyan central sensor, worn dark steel shell, recessed seams, and small mechanical thrusters; no humanoid anatomy. Strict top-down/front-down view, one vane points toward the bottom, compact circular three-point silhouette, no thin antennae. It must remain readable at 40x40 and distinct from Gunner and the Mine.
```

- [ ] **Step 2: Matte, fit, and validate**

Fit without distortion inside `420x413`, then extend to 1536x1024. Require clean alpha, visible vanes at 40x40, a restrained sensor, and a coherent 96x96 view. Reject if it resembles a mine or the sensor consumes the sprite.

- [ ] **Step 3: Replace, document, guard, and commit**

```bash
cp /private/tmp/sector-zero-m2-sources/drone-production.png public/sprites/enemies/drone.png
yarn sprites:test
git diff --check
git add public/sprites/enemies/drone.png ../docs/assets/prompts/shooter/01-m2-first-tranche.md
git commit -m "feat(assets): distinguish Drone with a compact tech profile"
```

---

### Task 6: Build comparison evidence and playtest all consumers

**Files:**
- Create: `docs/assets/reviews/m2-shooter-enemies/actual-size-comparison.png`
- Create: `docs/assets/reviews/m2-shooter-enemies/source-scale-comparison.png`
- Create: matching `after-world-*.png` and `after-bestiary.png` files
- Modify: `docs/assets/prompts/shooter/01-m2-first-tranche.md`

- [ ] **Step 1: Create reproducible comparison sheets**

Use ImageMagick with the saved originals and production files. The actual-size sheet draws the complete source canvases at 32x32, 44x56, 56x56, and 40x40 on both `#05070b` and a bright neutral field. The source-scale sheet exposes matte edges and internal detail. Record the exact commands in provenance.

- [ ] **Step 2: Rebuild and serve the DevPanel export**

Run `NEXT_PUBLIC_DEVTOOLS=1 yarn build`, serve `out/` on port 3000, and open a fresh `m2-after` Playwright session at 480x854.

- [ ] **Step 3: Playtest and capture matching after views**

Use the same level, viewport, framing, and Bestiary state as the baseline:

- World 1-4: Drone/Gunner movement, overlap, class tint, and fire;
- World 3-3: Bomber kamikaze motion against the hot bright scene;
- World 8-3: dense Swarm overlap and recognition;
- World 5-4: dark-scene halos and crushed detail;
- Bestiary: all four at the shared 96x96 turntable size.

Exercise collisions and overlapping formations without changing behavior. Capture matching after images.

- [ ] **Step 4: Inspect browser/runtime failures**

Run `playwright-cli -s=m2-after console error` and inspect network requests for failed sprite loads. Compare every view for halos, crushed detail, unreadable emissives, role confusion, and silhouette collisions. If any asset is not clearly better, restore only that original, document the rejection, and return to its generation task.

- [ ] **Step 5: Commit visual evidence**

```bash
git add docs/assets/prompts/shooter/01-m2-first-tranche.md docs/assets/reviews/m2-shooter-enemies
git diff --cached --check
git commit -m "docs(assets): record shooter tranche visual verification"
```

---

### Task 7: Verify, audit, push, and open the draft PR

**Files:**
- Modify only if verification exposes an in-scope asset/provenance defect.

- [ ] **Step 1: Run every final gate from `game/`**

```bash
npx tsc --noEmit
yarn colony:test
yarn engine:test
yarn sprites:test
yarn build
NEXT_PUBLIC_DEVTOOLS=1 yarn build
```

Record fresh exact counts/results.

- [ ] **Step 2: Audit scope from the worktree root**

```bash
git diff --check origin/main...HEAD
git status --short --branch
git diff --name-status origin/main...HEAD
git diff --stat origin/main...HEAD
git log --oneline origin/main..HEAD
```

Expected production changes: exactly four existing enemy PNGs. Other changes are only approved design/plan and prompt/review provenance. No registrations, scripts, stats, levels, renderer, collision, save, boss, FP, background, or hub files change.

- [ ] **Step 3: Confirm the primary checkout is untouched**

Run `git -C /Users/nichalasbarnes/Desktop/projects/sector-zero status --short --branch` and verify its pre-existing `.DS_Store` and `yarn.lock` changes remain untouched.

- [ ] **Step 4: Push and create a draft PR**

Push `feat/m2-shooter-enemy-tranche`. The draft PR body lists frequency evidence; each enemy's path, original/output dimensions, frame count, entity and rendered size, Bestiary use, playtested levels, exact baseline/final verification, screenshots, and every rejected candidate reason (`none` where applicable). State that registration, stats, spawning, collision, renderer defaults, layout, and balance are unchanged. Add `Do not merge: visual approval pending.`

- [ ] **Step 5: Wait for CI and hand off the local review**

Wait for every PR check to reach a successful terminal state. Keep `http://127.0.0.1:3000` available and give the user this checklist:

1. World 1-4: Drone is compact/round; Gunner is broad/square.
2. World 3-3: Bomber reads as one heavy breaching organism.
3. World 8-3: Swarm stays readable in dense overlap.
4. World 5-4: no green/white halos or lost shadow detail.
5. Bestiary: all four remain coherent at 96x96.

Do not merge without explicit user approval.

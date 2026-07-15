# M2 Shooter Enemy Tranche 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce and quality-gate a second four-enemy shooter art tranche for Cloaker, Scout, Wraith, and Echo, accepting a replacement only when it is clearly better at actual gameplay size while preserving every existing runtime contract.

**Architecture:** Treat each enemy as an independent, single-frame billboard replacement at its existing path. Generate on flat chroma green, matte and fit outside the production tree, preserve the original source canvas and alpha-envelope center, then promote a candidate only after exact-size, ghost-state, Bestiary, and representative live-level checks. No source code, registrations, renderer behavior, gameplay data, or pipeline scripts change.

**Tech Stack:** Built-in Codex image generation, installed chroma-key helper with Pillow from the existing rembg virtualenv, ImageMagick, Next.js 15 static export, React 19, Canvas 2D, Playwright CLI, TypeScript/Node test suites.

---

## Fixed contracts and working rules

- Branch: `feat/m2-shooter-enemy-tranche-2`
- Worktree: `/private/tmp/sector-zero-m2-shooter-2`
- Base: `origin/main` at `a110cd3bc6a18e3275c389d0bed42ef4912bb958`, after PR #12 merged
- Design authority: `docs/superpowers/specs/2026-07-15-m2-shooter-enemy-tranche-2-design.md`
- Prompt/provenance record: `docs/assets/prompts/shooter/02-m2-second-tranche.md`
- Review evidence: `docs/assets/reviews/m2-shooter-enemies-2/`
- Preserved originals: `/private/tmp/sector-zero-m2-tranche2-originals/`
- Generated sources: `/private/tmp/sector-zero-m2-tranche2-sources/`
- Rejected candidates: `/private/tmp/sector-zero-m2-tranche2-rejected/`

| Enemy | Production path | Source canvas | Frames | Original max 5%-alpha bounds | Entity / hitbox | Gameplay draw | Bestiary |
|---|---|---:|---:|---:|---:|---:|---:|
| Cloaker | `game/public/sprites/enemies/cloaker.png` | 1536x1024 | 1 | `633x596+452+147` | 44x44 | 52x52 | 96x96 |
| Scout | `game/public/sprites/enemies/scout.png` | 1536x1024 | 1 | `602x476+465+240` | 40x40 | 48x48 | 96x96 |
| Wraith | `game/public/sprites/enemies/wraith.png` | 1024x1536 | 1 | `968x1284+28+97` | 48x44 | 56x52 | 96x96 |
| Echo | `game/public/sprites/enemies/echo.png` | 1536x1024 | 1 | `1037x895+258+49` | 36x36 | 44x44 | 96x96 |

The bounds offsets are part of the runtime contract. Fit a candidate proportionally inside the recorded width and height, extend it to that exact transparent subcanvas, and composite at the recorded `+X+Y`. Never recenter a candidate on the full source canvas. Wraith deliberately retains its portrait 1024x1536 canvas.

Generate and review in exactly this order: Cloaker, Scout, Wraith, Echo. Use one strong candidate first, then at most a targeted retry for a concrete failed gate. Keep every rejected source outside `game/public/sprites/`. If a candidate is not clearly better, retain the production original and document why.

Load the `imagegen` skill before the first generation and follow it for every candidate. Every request uses the exact flat-background block and exact authoritative positive and negative suffixes from `docs/assets/prompts/doom/00-master-style-guide.md` section 8. The shared framing is an orthographic or near-orthographic top-down/front-down spacecraft billboard, forward axis down-screen, with no horizon, floor, environmental scene, cast shadow, contact shadow, reflection, or green in the subject.

Use the 5%-alpha geometry, not plain nonzero-alpha trim, to establish scale and placement. For each matted candidate, measure and record the meaningful bounds:

```bash
magick CANDIDATE_ALPHA.png -alpha extract -threshold 5% -trim -format '%w %h %X %Y\n' info:
```

Substitute the reported `W H X Y` into `-crop WxH+X+Y +repage`, then proportionally resize that crop inside the enemy's approved bounds. This deliberately discards only the sub-5% exterior residue before fitting, while preserving non-binary alpha inside the meaningful envelope. After composition, run the same measurement against the production candidate and require:

- final width and height no greater than the approved maximum;
- `abs((2 * X + W) - approvedCenter2X) <= 2`;
- `abs((2 * Y + H) - approvedCenter2Y) <= 2`.

| Enemy | Maximum bounds | Approved center2 X | Approved center2 Y |
|---|---:|---:|---:|
| Cloaker | 633x596 | 1537 | 890 |
| Scout | 602x476 | 1532 | 956 |
| Wraith | 968x1284 | 1024 | 1478 |
| Echo | 1037x895 | 1553 | 993 |

For example, measured values `731 620 118 93` become `-crop '731x620+118+93'`. Use this shell check after composition so envelope size and twice-center alignment fail closed:

```bash
check_alpha_geometry () {
  file=$1
  max_w=$2
  max_h=$3
  center2_x=$4
  center2_y=$5
  set -- $(magick "$file" -alpha extract -threshold 5% -trim -format '%w %h %X %Y' info:)
  w=$1
  h=$2
  x=$3
  y=$4
  dx=$((2 * x + w - center2_x))
  dy=$((2 * y + h - center2_y))
  [ "$dx" -lt 0 ] && dx=$((-dx))
  [ "$dy" -lt 0 ] && dy=$((-dy))
  [ "$w" -le "$max_w" ] && [ "$h" -le "$max_h" ] && [ "$dx" -le 2 ] && [ "$dy" -le 2 ]
}

check_alpha_geometry /private/tmp/sector-zero-m2-tranche2-sources/cloaker-production.png 633 596 1537 890
check_alpha_geometry /private/tmp/sector-zero-m2-tranche2-sources/scout-production.png 602 476 1532 956
check_alpha_geometry /private/tmp/sector-zero-m2-tranche2-sources/wraith-production.png 968 1284 1024 1478
check_alpha_geometry /private/tmp/sector-zero-m2-tranche2-sources/echo-production.png 1037 895 1553 993
```

Run only the line for the candidate currently under review; run all accepted lines again in the final audit.

If a chroma fringe remains, write a distinct retry matte rather than overwriting the first result:

```bash
/Users/nichalasbarnes/.local/pipx/venvs/rembg/bin/python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --input SOURCE.png --out NAME-alpha-edge1.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill --edge-contract 1
```

Record which matte is selected and use that file for the 5%-alpha crop. Do not invoke BiRefNet unless the chroma-key workflow demonstrably fails, and do not hand-paint corrections.

Run `yarn` commands sequentially. On this machine Corepack may add a root `packageManager` field, and dependency tooling may normalize `game/package.json`; these are tool-only changes and must be restored after each command if they appear:

```bash
git restore -- package.json game/package.json
```

Do not restore any other file. In particular, do not touch the primary checkout's unrelated `game/public/sprites/.DS_Store` or `yarn.lock` changes.

---

### Task 1: Record the audited baseline and matched before evidence

**Files:**
- Create: `docs/assets/prompts/shooter/02-m2-second-tranche.md`
- Create: `docs/assets/reviews/m2-shooter-enemies-2/actual-size/before-cloaker.png`
- Create: `docs/assets/reviews/m2-shooter-enemies-2/actual-size/before-scout.png`
- Create: `docs/assets/reviews/m2-shooter-enemies-2/actual-size/before-wraith.png`
- Create: `docs/assets/reviews/m2-shooter-enemies-2/actual-size/before-echo.png`
- Create: `docs/assets/reviews/m2-shooter-enemies-2/gameplay/before-cloaker-w5-3-visible.png`
- Create: `docs/assets/reviews/m2-shooter-enemies-2/gameplay/before-cloaker-w5-3-ghosted.png`
- Create: `docs/assets/reviews/m2-shooter-enemies-2/gameplay/before-scout-w1-1.png`
- Create: `docs/assets/reviews/m2-shooter-enemies-2/gameplay/before-wraith-w4-2.png`
- Create: `docs/assets/reviews/m2-shooter-enemies-2/gameplay/before-echo-w6-2-visible.png`
- Create: `docs/assets/reviews/m2-shooter-enemies-2/gameplay/before-echo-w6-2-ghosted.png`
- Create: `docs/assets/reviews/m2-shooter-enemies-2/bestiary/before-cloaker.png`
- Create: `docs/assets/reviews/m2-shooter-enemies-2/bestiary/before-scout.png`
- Create: `docs/assets/reviews/m2-shooter-enemies-2/bestiary/before-wraith.png`
- Create: `docs/assets/reviews/m2-shooter-enemies-2/bestiary/before-echo.png`

- [ ] **Step 1: Confirm the isolated worktree and protected primary checkout**

Run from the worktree root:

```bash
git status --short --branch
git rev-parse HEAD
git merge-base HEAD origin/main
git -C /Users/nichalasbarnes/Desktop/projects/sector-zero status --short --branch
```

Expected: the feature worktree contains only the approved design/plan history; the merge base is `a110cd3`; the primary checkout still owns its unrelated `.DS_Store` and `yarn.lock` changes.

- [ ] **Step 2: Confirm the preserved originals byte-for-byte**

```bash
shasum -a 256 /private/tmp/sector-zero-m2-tranche2-originals/*.png game/public/sprites/enemies/{cloaker,scout,wraith,echo}.png
magick identify -format '%f %wx%h %[channels] opaque=%[opaque]\n' /private/tmp/sector-zero-m2-tranche2-originals/*.png
```

Expected: each saved original matches its production counterpart before art changes, all four have alpha, and dimensions match the fixed-contract table.

- [ ] **Step 3: Create the provenance ledger**

Use `apply_patch` to record:

- the independently verified spawn audit: Cloaker 369+34=403, Scout 319+77=396, Wraith 296+44=340, Echo 296+44=340;
- the registration, single-frame, source-canvas, alpha-bounds, hitbox, draw-size, class-tint, Bestiary, mechanic, and representative-level contracts;
- the approved one-sentence visual-role briefs;
- the exact flat-background block and authoritative positive/negative suffixes;
- a per-attempt ledger with output identifier/path, seed policy, reference role, generated source dimensions, matte settings, sampled key, fitted bounds, decision, and rejection reason;
- the already-discovered baseline: TypeScript pass, colony 268/268, engine 66/66, sprites 4/4, normal static build pass, DevPanel static build pass.

Record a built-in generation seed as `not exposed by built-in tool` unless the returned result exposes one. Record `no image reference input` for the initial attempt; originals are semantic, contract, and comparison references only.

- [ ] **Step 4: Build exact-size dark/bright original panels**

For each saved original, resize the complete source canvas exactly as the renderer does, composite once on `#05070b` and once on a bright neutral `#b8b8b0` field, and enlarge only the final review panels with point filtering. The following is the exact Cloaker flow:

```bash
magick /private/tmp/sector-zero-m2-tranche2-originals/cloaker.png -resize '52x52!' /private/tmp/sector-zero-m2-tranche2-audit/cloaker-before-actual.png
magick -size 52x52 xc:'#05070b' /private/tmp/sector-zero-m2-tranche2-audit/cloaker-before-actual.png -gravity center -composite /private/tmp/sector-zero-m2-tranche2-audit/cloaker-before-dark.png
magick -size 52x52 xc:'#b8b8b0' /private/tmp/sector-zero-m2-tranche2-audit/cloaker-before-actual.png -gravity center -composite /private/tmp/sector-zero-m2-tranche2-audit/cloaker-before-bright.png
magick /private/tmp/sector-zero-m2-tranche2-audit/cloaker-before-dark.png -filter point -resize '416x416!' -set label 'DARK — exact 52x52 shown 8x' /private/tmp/sector-zero-m2-tranche2-audit/cloaker-before-dark-review.png
magick /private/tmp/sector-zero-m2-tranche2-audit/cloaker-before-bright.png -filter point -resize '416x416!' -set label 'BRIGHT — exact 52x52 shown 8x' /private/tmp/sector-zero-m2-tranche2-audit/cloaker-before-bright-review.png
magick montage /private/tmp/sector-zero-m2-tranche2-audit/cloaker-before-dark-review.png /private/tmp/sector-zero-m2-tranche2-audit/cloaker-before-bright-review.png -tile 2x1 -geometry +16+16 -background '#202020' -fill white -pointsize 20 docs/assets/reviews/m2-shooter-enemies-2/actual-size/before-cloaker.png
```

Repeat the same commands with Scout `48x48` and `384x384`, Wraith `56x52` and `448x416`, and Echo `44x44` and `352x352`, writing the declared `before-*.png` files. Record every expanded command in provenance. The committed result for each enemy must show the exact-size sprite on both fields with a labeled nearest-neighbor enlargement. Use the same procedure and dimensions for every accepted `after-*.png`.

- [ ] **Step 5: Capture matched baseline gameplay and Bestiary views**

Build the unchanged DevPanel export from `game/`, restore any package metadata drift, serve `game/out` on port 3000, and use a named browser session at exactly 480x854. Capture:

- Cloaker: World 5-3 Phantom Fleet, HUD Wave 1, a visible state and a 15%-alpha hidden state;
- Scout: World 1-1 First Contact, HUD Wave 1, five-Scout line;
- Wraith: World 4-2 The Kepler Graveyard, HUD Wave 1, four-Wraith V under cinder tint;
- Echo: World 6-2 Distortion Field, HUD Wave 1, a visible state and a 15%-alpha hidden state;
- each enemy in the 96x96 Bestiary detail at a full-scale turntable angle, not edge-on.

Record viewport, level/wave, timing/state, and browser-console output. Require zero new errors; list unchanged framework warnings separately.

- [ ] **Step 6: Commit the baseline evidence**

```bash
git add docs/assets/prompts/shooter/02-m2-second-tranche.md docs/assets/reviews/m2-shooter-enemies-2
git diff --cached --check
git commit -m "docs(assets): record second enemy tranche baseline"
```

---

### Task 2: Quality-gate Cloaker as an organic stealth hunter

**Files:**
- Modify only if accepted: `game/public/sprites/enemies/cloaker.png`
- Modify: `docs/assets/prompts/shooter/02-m2-second-tranche.md`
- Create if accepted: `docs/assets/reviews/m2-shooter-enemies-2/actual-size/after-cloaker.png`
- Create if accepted: `docs/assets/reviews/m2-shooter-enemies-2/gameplay/after-cloaker-w5-3-visible.png`
- Create if accepted: `docs/assets/reviews/m2-shooter-enemies-2/gameplay/after-cloaker-w5-3-ghosted.png`
- Create if accepted: `docs/assets/reviews/m2-shooter-enemies-2/bestiary/after-cloaker.png`
- Create if accepted: `docs/assets/reviews/m2-shooter-enemies-2/matched/cloaker-visible.png`
- Create if accepted: `docs/assets/reviews/m2-shooter-enemies-2/matched/cloaker-ghosted.png`

- [ ] **Step 1: Generate one canonical candidate**

Use the shared prompt blocks plus this subject block:

```text
Subject: CLOAKER enemy, an organic stealth hunter built around one large broken-ring or crescent silhouette. Strict orthographic or near-orthographic top-down/front-down spacecraft view, descending toward the bottom of the image. A dense dark predatory core is partly enclosed by two chunky shutter-like chitin arcs, leaving one dominant open negative-space cutout that survives reduction to a 52 by 52 gameplay draw and remains recognizable at 15 percent opacity. Add worn black membrane, scarred desaturated shell, and only a few restrained cold tech-cyan seams that suggest an invasive cloaking mechanism. One connected enemy, broad solid shape breaks, strong rim separation, no thin wisps. It must read as hollow and evasive, never as Wraith's solid reliquary or Echo's repeated plates. Centered with generous padding and no cropping.
```

Add role-specific negatives: `thin wisps, smoke body, loose particles, solid coffin, repeated afterimages, humanoid, side view, three-quarter perspective, floor, contact shadow`.

Copy the returned image to `/private/tmp/sector-zero-m2-tranche2-sources/cloaker-source.png`. Record its exact generation identifier and dimensions. Put any self-rejected source under `/private/tmp/sector-zero-m2-tranche2-rejected/` with a concrete reason.

- [ ] **Step 2: Matte and place without changing source-space alignment**

Use the Pillow-equipped interpreter already installed with rembg:

```bash
/Users/nichalasbarnes/.local/pipx/venvs/rembg/bin/python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --input /private/tmp/sector-zero-m2-tranche2-sources/cloaker-source.png --out /private/tmp/sector-zero-m2-tranche2-sources/cloaker-alpha.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
magick /private/tmp/sector-zero-m2-tranche2-sources/cloaker-alpha.png -alpha extract -threshold 5% -trim -format '%w %h %X %Y\n' info:
magick /private/tmp/sector-zero-m2-tranche2-sources/cloaker-alpha.png -crop 'CANDIDATE_WxCANDIDATE_H+CANDIDATE_X+CANDIDATE_Y' +repage -resize '633x596' -gravity center -background none -extent 633x596 /private/tmp/sector-zero-m2-tranche2-sources/cloaker-fit.png
magick -size 1536x1024 xc:none /private/tmp/sector-zero-m2-tranche2-sources/cloaker-fit.png -geometry +452+147 -composite /private/tmp/sector-zero-m2-tranche2-sources/cloaker-production.png
```

Replace `CANDIDATE_*` with the four values printed by the preceding command. Use the shared distinct-output edge-contraction retry only if a chroma fringe remains.

- [ ] **Step 3: Run the asset contract and visual gates**

Require:

- 1536x1024 sRGBA, one frame, transparent corners, meaningful soft edge alpha;
- maximum 5%-alpha bounds no larger than 633x596 and centered on the original `633x596+452+147` envelope;
- no stretch, crop, green fringe, white halo, floor, or contact shadow;
- dominant negative-space read at 52x52 on dark and bright fields and at 96x96;
- recognizable crescent/shutter silhouette after applying 15% opacity;
- clear distinction from the current Wraith and Echo.

Use the Task 1 ImageMagick procedure to write `actual-size/after-cloaker.png`, adding a second labeled dark/bright row with the exact 52x52 candidate flattened to 15% opacity.

Only after the static gates pass, temporarily install the candidate in the worktree, run the sprite contract, rebuild the DevPanel export, restore package metadata drift, restart the port-3000 server, and open a fresh browser session so no original sprite survives in the static export or browser cache:

```bash
cp /private/tmp/sector-zero-m2-tranche2-sources/cloaker-production.png game/public/sprites/enemies/cloaker.png
cd game
yarn sprites:test
git restore -- ../package.json package.json
NEXT_PUBLIC_DEVTOOLS=1 yarn build
git restore -- ../package.json package.json
```

- [ ] **Step 4: Playtest, decide, document, and commit**

After restarting the static server and using a new/cache-bypassed browser session, play the candidate in W5-3 Wave 1 at 480x854, capturing matched visible and hidden states plus Bestiary. Compare directly against the original evidence. If it is not clearly better, restore the original, verify the two SHA-256 values match, rebuild the DevPanel export, and only then continue:

```bash
cp /private/tmp/sector-zero-m2-tranche2-originals/cloaker.png game/public/sprites/enemies/cloaker.png
shasum -a 256 /private/tmp/sector-zero-m2-tranche2-originals/cloaker.png game/public/sprites/enemies/cloaker.png
cd game
NEXT_PUBLIC_DEVTOOLS=1 yarn build
git restore -- ../package.json package.json
```

Keep the rejection outside production and commit provenance only. If accepted, leave the already-installed candidate in place and commit:

```bash
git add game/public/sprites/enemies/cloaker.png docs/assets/prompts/shooter/02-m2-second-tranche.md docs/assets/reviews/m2-shooter-enemies-2
git diff --cached --check
git commit -m "feat(assets): sharpen Cloaker's stealth silhouette"
```

For a retained original, use `docs(assets): record rejected Cloaker candidate` and do not stage the production PNG.

---

### Task 3: Quality-gate Scout as the baseline fast interceptor

**Files:**
- Modify only if accepted: `game/public/sprites/enemies/scout.png`
- Modify: `docs/assets/prompts/shooter/02-m2-second-tranche.md`
- Create if accepted: `docs/assets/reviews/m2-shooter-enemies-2/{actual-size/after-scout.png,gameplay/after-scout-w1-1.png,bestiary/after-scout.png,matched/scout.png}`

- [ ] **Step 1: Generate one canonical candidate**

Use the shared blocks plus:

```text
Subject: SCOUT enemy, the first and simplest fast attacker: a lean compact forward interceptor with a narrow dart-like body, two short swept structural fins, and one unmistakable down-screen attack axis. Strict orthographic or near-orthographic top-down/front-down spacecraft view, descending toward the bottom of the image. Worn desaturated industrial metal, crushed dark recesses, a restrained warm swarm-class drive seam, and only a few large panel breaks. The silhouette must remain uncomplicated and immediately legible at a 48 by 48 gameplay draw: lighter and simpler than Cloaker, Wraith, Echo, Gunner, and Drone, but not a generic glowing triangle. One connected craft, no humanoid anatomy, no guns as the code-defined Scout is unarmed. Centered with generous padding and no cropping.
```

Add role-specific negatives: `generic glowing triangle, large central orb, broad weapons barge, hollow crescent, coffin silhouette, repeated afterimage plates, gun barrels, humanoid, side view, three-quarter perspective`.

- [ ] **Step 2: Matte and place inside the original envelope**

```bash
/Users/nichalasbarnes/.local/pipx/venvs/rembg/bin/python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --input /private/tmp/sector-zero-m2-tranche2-sources/scout-source.png --out /private/tmp/sector-zero-m2-tranche2-sources/scout-alpha.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
magick /private/tmp/sector-zero-m2-tranche2-sources/scout-alpha.png -alpha extract -threshold 5% -trim -format '%w %h %X %Y\n' info:
magick /private/tmp/sector-zero-m2-tranche2-sources/scout-alpha.png -crop 'CANDIDATE_WxCANDIDATE_H+CANDIDATE_X+CANDIDATE_Y' +repage -resize '602x476' -gravity center -background none -extent 602x476 /private/tmp/sector-zero-m2-tranche2-sources/scout-fit.png
magick -size 1536x1024 xc:none /private/tmp/sector-zero-m2-tranche2-sources/scout-fit.png -geometry +465+240 -composite /private/tmp/sector-zero-m2-tranche2-sources/scout-production.png
```

Replace `CANDIDATE_*` with the measured values and use the shared distinct-output matte retry if needed.

- [ ] **Step 3: Run the exact-size, Bestiary, and distinctness gates**

Require 1536x1024 sRGBA, one frame, transparent corners, bounds within and centered on `602x476+465+240`, clean alpha, and immediate readability at 48x48 and 96x96. Compare against the accepted Drone from PR #12 and the other three tranche candidates. Reject if it becomes a triangle, loses its forward axis, looks armed/heavy, or resembles Echo. Use the Task 1 procedure to write `actual-size/after-scout.png` before live promotion.

- [ ] **Step 4: Playtest, decide, document, and commit**

After the static gates pass, temporarily install the candidate, run the sprite contract, rebuild the DevPanel export, restore package metadata, restart the server, and use a new/cache-bypassed browser session:

```bash
cp /private/tmp/sector-zero-m2-tranche2-sources/scout-production.png game/public/sprites/enemies/scout.png
cd game
yarn sprites:test
git restore -- ../package.json package.json
NEXT_PUBLIC_DEVTOOLS=1 yarn build
git restore -- ../package.json package.json
```

Play W1-1 Wave 1 and the later dense Scout formation at 480x854. Confirm speed, overlap, class tint, collisions, and first-contact readability are unchanged. Capture the matched gameplay and Bestiary evidence. If rejected, restore and verify the original, rebuild the export, and commit provenance only:

```bash
cp /private/tmp/sector-zero-m2-tranche2-originals/scout.png game/public/sprites/enemies/scout.png
shasum -a 256 /private/tmp/sector-zero-m2-tranche2-originals/scout.png game/public/sprites/enemies/scout.png
cd game
NEXT_PUBLIC_DEVTOOLS=1 yarn build
git restore -- ../package.json package.json
```

If accepted, leave the already-installed candidate in place and commit:

```bash
git add game/public/sprites/enemies/scout.png docs/assets/prompts/shooter/02-m2-second-tranche.md docs/assets/reviews/m2-shooter-enemies-2
git diff --cached --check
git commit -m "feat(assets): clarify Scout's baseline interceptor role"
```

Otherwise retain the original and commit only the documented rejection.

---

### Task 4: Quality-gate Wraith as a heavy corrupted reliquary

**Files:**
- Modify only if accepted: `game/public/sprites/enemies/wraith.png`
- Modify: `docs/assets/prompts/shooter/02-m2-second-tranche.md`
- Create if accepted: `docs/assets/reviews/m2-shooter-enemies-2/{actual-size/after-wraith.png,gameplay/after-wraith-w4-2.png,bestiary/after-wraith.png,matched/wraith.png}`

- [ ] **Step 1: Generate one canonical candidate**

Use the shared blocks plus:

```text
Subject: WRAITH enemy, a broad heavy corrupted sarcophagus-ship containing a trapped human pilot presence. Strict orthographic or near-orthographic top-down/front-down spacecraft view, descending toward the bottom of the image. Build one wide solid cruciform or armored reliquary silhouette with a dense central coffin chamber and broad weighted side masses. Show the human-scale containment cue only as a recessed shape behind cracked dark material, never as a portrait or exposed humanoid. Scorched desaturated armor, organic hull intrusion, crushed near-black recesses, and restrained cinder-orange light leaking through a few cracks and vents. It must remain a broad solid threat at a 56 by 52 gameplay draw, clearly heavier than Scout and Echo and never hollow like Cloaker. Centered with generous padding and no cropping.
```

Add role-specific negatives: `wispy ghost, smoke body, hollow crescent, repeated afterimages, exposed human portrait, bright orange painted armor, sleek fighter, side view, three-quarter perspective`.

- [ ] **Step 2: Matte and preserve the portrait canvas exactly**

```bash
/Users/nichalasbarnes/.local/pipx/venvs/rembg/bin/python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --input /private/tmp/sector-zero-m2-tranche2-sources/wraith-source.png --out /private/tmp/sector-zero-m2-tranche2-sources/wraith-alpha.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
magick /private/tmp/sector-zero-m2-tranche2-sources/wraith-alpha.png -alpha extract -threshold 5% -trim -format '%w %h %X %Y\n' info:
magick /private/tmp/sector-zero-m2-tranche2-sources/wraith-alpha.png -crop 'CANDIDATE_WxCANDIDATE_H+CANDIDATE_X+CANDIDATE_Y' +repage -resize '968x1284' -gravity center -background none -extent 968x1284 /private/tmp/sector-zero-m2-tranche2-sources/wraith-fit.png
magick -size 1024x1536 xc:none /private/tmp/sector-zero-m2-tranche2-sources/wraith-fit.png -geometry +28+97 -composite /private/tmp/sector-zero-m2-tranche2-sources/wraith-production.png
```

Replace `CANDIDATE_*` with the measured values and use the shared distinct-output matte retry if needed. Expected output is 1024x1536, never 1536x1024.

- [ ] **Step 3: Run the exact-size, tint, and lore gates**

Require one-frame 1024x1536 sRGBA, transparent corners, bounds within and centered on `968x1284+28+97`, no fringe or source-space shift, and a solid heavy read at 56x52 and 96x96. Apply the unchanged cinder-class multiply tint in the live check. Reject smoke/wisp anatomy, a hollow silhouette, or anything that visually claims runtime cloaking/chasing that the code does not implement. Use the Task 1 procedure to write `actual-size/after-wraith.png` before live promotion.

- [ ] **Step 4: Playtest, decide, document, and commit**

After the static gates pass, temporarily install the candidate, run the sprite contract, rebuild the DevPanel export, restore package metadata, restart the server, and use a new/cache-bypassed browser session:

```bash
cp /private/tmp/sector-zero-m2-tranche2-sources/wraith-production.png game/public/sprites/enemies/wraith.png
cd game
yarn sprites:test
git restore -- ../package.json package.json
NEXT_PUBLIC_DEVTOOLS=1 yarn build
git restore -- ../package.json package.json
```

Play W4-2 Wave 1 at 480x854. Capture the four-unit V, movement, shooting, overlaps, tint, and Bestiary presentation. If rejected, restore and verify the original, rebuild the export, and commit provenance only:

```bash
cp /private/tmp/sector-zero-m2-tranche2-originals/wraith.png game/public/sprites/enemies/wraith.png
shasum -a 256 /private/tmp/sector-zero-m2-tranche2-originals/wraith.png game/public/sprites/enemies/wraith.png
cd game
NEXT_PUBLIC_DEVTOOLS=1 yarn build
git restore -- ../package.json package.json
```

If accepted, leave the already-installed candidate in place and commit:

```bash
git add game/public/sprites/enemies/wraith.png docs/assets/prompts/shooter/02-m2-second-tranche.md docs/assets/reviews/m2-shooter-enemies-2
git diff --cached --check
git commit -m "feat(assets): give Wraith a corrupted reliquary profile"
```

Otherwise retain the original and commit only the documented rejection.

---

### Task 5: Quality-gate Echo as a displaced repeating craft

**Files:**
- Modify only if accepted: `game/public/sprites/enemies/echo.png`
- Modify: `docs/assets/prompts/shooter/02-m2-second-tranche.md`
- Create if accepted: `docs/assets/reviews/m2-shooter-enemies-2/actual-size/after-echo.png`
- Create if accepted: `docs/assets/reviews/m2-shooter-enemies-2/gameplay/after-echo-w6-2-visible.png`
- Create if accepted: `docs/assets/reviews/m2-shooter-enemies-2/gameplay/after-echo-w6-2-ghosted.png`
- Create if accepted: `docs/assets/reviews/m2-shooter-enemies-2/bestiary/after-echo.png`
- Create if accepted: `docs/assets/reviews/m2-shooter-enemies-2/matched/echo-visible.png`
- Create if accepted: `docs/assets/reviews/m2-shooter-enemies-2/matched/echo-ghosted.png`

- [ ] **Step 1: Generate one canonical candidate**

Use the shared blocks plus:

```text
Subject: ECHO enemy, a compact phase craft assembled from one stable dark core and two or three visibly displaced repeating armor masses. Strict orthographic or near-orthographic top-down/front-down spacecraft view, descending toward the bottom of the image. The repeated plates overlap and remain physically connected, forming a chunky offset silhouette that communicates delayed pattern mimicry without loose particles or scanline effects. Use worn desaturated tech surfaces, crushed dark gaps, restrained cold tech-cyan seams with a few muted warm phase seams, and large simple value breaks. It must read as one compact connected enemy at a 44 by 44 gameplay draw and remain recognizable at 15 percent opacity. Avoid Scout's clean dart, Cloaker's hollow crescent, and Wraith's solid coffin mass. Centered with generous padding and no cropping.
```

Add role-specific negatives: `loose particles, disconnected copies, thin scanlines, motion blur, transparent smoke, simple triangular fighter, hollow crescent, solid coffin, humanoid, side view, three-quarter perspective`.

- [ ] **Step 2: Matte and place inside the original envelope**

```bash
/Users/nichalasbarnes/.local/pipx/venvs/rembg/bin/python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --input /private/tmp/sector-zero-m2-tranche2-sources/echo-source.png --out /private/tmp/sector-zero-m2-tranche2-sources/echo-alpha.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
magick /private/tmp/sector-zero-m2-tranche2-sources/echo-alpha.png -alpha extract -threshold 5% -trim -format '%w %h %X %Y\n' info:
magick /private/tmp/sector-zero-m2-tranche2-sources/echo-alpha.png -crop 'CANDIDATE_WxCANDIDATE_H+CANDIDATE_X+CANDIDATE_Y' +repage -resize '1037x895' -gravity center -background none -extent 1037x895 /private/tmp/sector-zero-m2-tranche2-sources/echo-fit.png
magick -size 1536x1024 xc:none /private/tmp/sector-zero-m2-tranche2-sources/echo-fit.png -geometry +258+49 -composite /private/tmp/sector-zero-m2-tranche2-sources/echo-production.png
```

Replace `CANDIDATE_*` with the measured values and use the shared distinct-output matte retry if needed.

- [ ] **Step 3: Run the exact-size, ghost-state, and distinctness gates**

Require one-frame 1536x1024 sRGBA, transparent corners, bounds within and centered on `1037x895+258+49`, connected repeated masses at 44x44, a coherent 96x96 Bestiary view, and a meaningful 15%-opacity silhouette. Reject loose effect debris, unreadable phase detail, a generic triangle, or visual confusion with Scout. Use the Task 1 procedure to write `actual-size/after-echo.png`, adding a second labeled dark/bright row with the exact 44x44 candidate flattened to 15% opacity.

- [ ] **Step 4: Playtest, decide, document, and commit**

After the static gates pass, temporarily install the candidate, run the sprite contract, rebuild the DevPanel export, restore package metadata, restart the server, and use a new/cache-bypassed browser session:

```bash
cp /private/tmp/sector-zero-m2-tranche2-sources/echo-production.png game/public/sprites/enemies/echo.png
cd game
yarn sprites:test
git restore -- ../package.json package.json
NEXT_PUBLIC_DEVTOOLS=1 yarn build
git restore -- ../package.json package.json
```

Play W6-2 Wave 1 at 480x854, capturing matched visible and hidden states, lateral phase sway, overlap, shooting, class tint, and Bestiary. If rejected, restore and verify the original, rebuild the export, and commit provenance only:

```bash
cp /private/tmp/sector-zero-m2-tranche2-originals/echo.png game/public/sprites/enemies/echo.png
shasum -a 256 /private/tmp/sector-zero-m2-tranche2-originals/echo.png game/public/sprites/enemies/echo.png
cd game
NEXT_PUBLIC_DEVTOOLS=1 yarn build
git restore -- ../package.json package.json
```

If accepted, leave the already-installed candidate in place and commit:

```bash
git add game/public/sprites/enemies/echo.png docs/assets/prompts/shooter/02-m2-second-tranche.md docs/assets/reviews/m2-shooter-enemies-2
git diff --cached --check
git commit -m "feat(assets): distinguish Echo through displaced repetition"
```

Otherwise retain the original and commit only the documented rejection.

---

### Task 6: Assemble matched review evidence and perform the cross-tranche visual gate

**Files:**
- Modify: `docs/assets/prompts/shooter/02-m2-second-tranche.md`
- Create or finalize for accepted replacements only: `docs/assets/reviews/m2-shooter-enemies-2/matched/scout.png`
- Create or finalize for accepted replacements only: `docs/assets/reviews/m2-shooter-enemies-2/matched/wraith.png`
- Create or finalize for accepted replacements only: `docs/assets/reviews/m2-shooter-enemies-2/matched/cloaker-visible.png`
- Create or finalize for accepted replacements only: `docs/assets/reviews/m2-shooter-enemies-2/matched/cloaker-ghosted.png`
- Create or finalize for accepted replacements only: `docs/assets/reviews/m2-shooter-enemies-2/matched/echo-visible.png`
- Create or finalize for accepted replacements only: `docs/assets/reviews/m2-shooter-enemies-2/matched/echo-ghosted.png`
- Create: `docs/assets/reviews/m2-shooter-enemies-2/tranche-silhouette-comparison.png`

- [ ] **Step 1: Build one four-panel sheet per accepted replacement**

Scout and Wraith each use one four-panel matched sheet with the same layout and labels:

1. original and candidate at exact gameplay draw size on `#05070b`;
2. original and candidate at exact gameplay draw size on `#b8b8b0`;
3. matched 480x854 before/after frames from the representative level;
4. matched full-scale-turntable 96x96 Bestiary before/after.

Cloaker and Echo each use two such sheets: one with the visible gameplay pair and one with the 15%-alpha ghosted gameplay pair. The exact-size and Bestiary panels may repeat between the two sheets, but the gameplay-state label and source files must be explicit.

Use the complete source canvas for every resize. Do not crop to visible alpha before simulating gameplay or Bestiary rendering. If an original was retained, document the rejection without creating an `after` or misleading accepted-replacement sheet.

- [ ] **Step 2: Compare the entire eight-enemy M2 silhouette system**

At actual draw size, compare Cloaker, Scout, Wraith, and Echo against one another and against the merged Swarm, Bomber, Gunner, and Drone. Require the intended reads: open crescent, simple dart, broad reliquary, connected repeated mass. Reject an otherwise polished candidate if it duplicates a first-tranche silhouette.

- [ ] **Step 3: Re-run all four live consumers in one fresh browser session**

Rebuild `NEXT_PUBLIC_DEVTOOLS=1 yarn build`, restore package metadata drift, restart the static server on port 3000, and use a fresh 480x854 session. Exercise all representative waves and Bestiary details. Deliberately inspect Cloaker and Echo both visible and ghosted, Wraith on both dark and brighter scene areas under class tint, and Scout in both sparse and dense formations.

Check browser console errors and failed sprite requests. Require zero new errors and record unchanged framework warnings separately. Confirm there are no changes to movement, damage, shooting, visibility timing, collision, wave composition, or draw size.

- [ ] **Step 4: Finalize provenance and commit the review evidence**

For each accepted or rejected attempt, record exact prompt, generation ID, seed/reference status, source/output dimensions, alpha settings, sampled key, final 5%-alpha bounds, iteration decision, actual-size verdict, Bestiary verdict, live-level verdict, and console result.

```bash
git add docs/assets/prompts/shooter/02-m2-second-tranche.md docs/assets/reviews/m2-shooter-enemies-2
git diff --cached --check
git commit -m "docs(assets): record second tranche visual verification"
```

---

### Task 7: Run final verification, review scope, and open the draft PR

**Files:**
- Modify only if a verification failure exposes an in-scope asset or provenance defect.

- [ ] **Step 1: Run the complete final gate sequentially from `game/`**

```bash
npx tsc --noEmit
yarn colony:test
git restore -- ../package.json package.json
yarn engine:test
git restore -- ../package.json package.json
yarn sprites:test
git restore -- ../package.json package.json
yarn build
git restore -- ../package.json package.json
NEXT_PUBLIC_DEVTOOLS=1 yarn build
git restore -- ../package.json package.json
```

Expected baseline: TypeScript pass, colony 268/268, engine 66/66, sprites 4/4, both static exports pass. If counts legitimately change on fresh `origin/main`, record the new clean baseline and investigate any failure before proceeding. Engine/sprite `tsx` IPC `EPERM` under a restricted sandbox is environmental; rerun with the approved execution permission rather than modifying code. Google Font fetch failures under restricted network are also environmental; rerun builds with approved network access.

- [ ] **Step 2: Prove geometry, alpha, and production scope**

Run `magick identify` and 5%-alpha bounds checks on every changed production PNG. Require exact source dimensions, sRGBA, transparent corners, one frame, non-binary edge alpha, and placement within the original envelope center.

From the worktree root:

```bash
git diff --check origin/main...HEAD
git status --short --branch
git diff --name-status origin/main...HEAD
git diff --stat origin/main...HEAD
git log --oneline origin/main..HEAD
```

Expected production changes: zero to four of the four approved enemy PNGs, depending on quality decisions. All other changes are the approved design, this plan, provenance, and review evidence. There must be no TypeScript, renderer, registration, sheet, stats, levels, spawn, collision, save, boss, first-person, background, hub, lockfile, or package metadata changes.

- [ ] **Step 3: Request independent pre-PR review**

Use `superpowers:requesting-code-review` with the design, this plan, `origin/main...HEAD`, provenance, and review sheets. Resolve every Critical or Important finding, rerun the affected gate, and request re-review until approved.

- [ ] **Step 4: Confirm the primary checkout remains untouched**

```bash
git -C /Users/nichalasbarnes/Desktop/projects/sector-zero status --short --branch
```

Expected: the unrelated `game/public/sprites/.DS_Store` and `yarn.lock` changes remain exactly where the user left them.

- [ ] **Step 5: Push and open a draft PR**

Push `feat/m2-shooter-enemy-tranche-2` and open a draft PR against `main`. The body must include:

- the 403/396/340/340 frequency audit;
- a role-read table for all four;
- original/output dimensions, frames, alpha bounds, entity size, actual draw size, and Bestiary size;
- representative levels and visible/ghost-state coverage;
- accepted and retained-original decisions with every rejected-candidate reason;
- exact test/build results and browser-console result;
- links to each matched review sheet;
- an explicit statement that code, registrations, renderer defaults, gameplay, stats, spawning, collision, balance, and saves are unchanged;
- `Do not merge: visual approval pending.`

- [ ] **Step 6: Wait for CI and hand off the local visual review**

Wait for all PR checks to reach successful terminal states. Keep the DevPanel export served at `http://127.0.0.1:3000` and give the user this concise checklist:

1. W5-3 Wave 1: Cloaker reads as a hollow stealth hunter both visible and ghosted.
2. W1-1 Wave 1: Scout is the simple fast baseline and does not resemble Drone or Echo.
3. W4-2 Wave 1: Wraith is broad, heavy, corrupted, and readable under cinder tint.
4. W6-2 Wave 1: Echo reads as one connected displaced/repeating craft both visible and ghosted.
5. Bestiary: each remains distinct and clean at 96x96 with no green/white halo.
6. Across all four: movement, fire, cloak/phase timing, collisions, and draw size feel unchanged.

Do not merge without explicit user approval.

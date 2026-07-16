# M2 Wraith and Echo Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover the already-generated Wraith attempt 2 and Echo attempt 1 candidates, then accept either replacement independently only after exact-size, Bestiary, and representative live-level review.

**Architecture:** Reuse the immutable built-in generation sources and the matte/fit parameters recorded in the second-tranche provenance ledger. Reconstruct each single-frame sRGBA production derivative outside the sprite tree, prove its hash and geometry match the previously reviewed candidate, then temporarily install it for evidence and live review. No TypeScript, registrations, renderer behavior, gameplay data, saves, or pipeline scripts change.

**Tech Stack:** Existing Codex image-generation outputs, installed chroma-key helper with Pillow, ImageMagick, Next.js 15 static export, Canvas 2D, Playwright CLI, TypeScript/Node verification suites.

---

## Fixed contracts

| Enemy | Generated source | Production canvas | Maximum 5%-alpha bounds | Gameplay draw | Bestiary |
|---|---|---:|---:|---:|---:|
| Wraith | `exec-f8531636-6934-4e1d-ac24-3224300278f7.png` | `1024x1536` | `968x1284`, center2 `1024,1478` | `56x52` | `96x96` |
| Echo | `exec-7ca19769-a7b4-4cc7-b175-487443e7e27c.png` | `1536x1024` | `1037x895`, center2 `1553,993` | `44x44` | `96x96` |

The production originals remain the rollback source. Candidates are accepted independently. A failed review restores the corresponding original byte-for-byte and removes candidate-only acceptance evidence.

## Reproduction and review gates

The worktree was observed clean immediately after creation. Baseline Yarn commands then added only Corepack's root `packageManager` line; that exact tool-created diff was restored before this plan review. Before any further command that can mutate the worktree, fail fast unless `git status --short` shows only this untracked plan, then save `git status --short` and `git diff --binary` outside the repository. After that snapshot, restore only a newly reappearing byte-identical Corepack insertion; never restore an unrelated path or any path present in the snapshot.

Back up and pin the production originals before temporary installation:

```bash
mkdir -p /private/tmp/sector-zero-m2-wraith-echo-recovery/{originals,sources,audit}
cp game/public/sprites/enemies/wraith.png /private/tmp/sector-zero-m2-wraith-echo-recovery/originals/wraith.png
cp game/public/sprites/enemies/echo.png /private/tmp/sector-zero-m2-wraith-echo-recovery/originals/echo.png
shasum -a 256 /private/tmp/sector-zero-m2-wraith-echo-recovery/originals/{wraith,echo}.png
```

Require Wraith original SHA-256 `b0c3198822dae2410922b4e59f52c8c1fa404081bc8a52c900a863f45331c241` and Echo original SHA-256 `dc4a2532e68ef83225b9f30b5c32bb054f339796b06e8942ccdd4c5a5bf3cf4d`.

Pin and fail closed on this recovery toolchain before processing:

- `remove_chroma_key.py` SHA-256 `3f7b9b14ad5c90f37618bc1c16a039a2076abca12ddc41b3ae470e2b1cad6c0e`;
- `/Users/nichalasbarnes/.local/pipx/venvs/rembg/bin/python` reports `Python 3.14.4`;
- that interpreter reports Pillow `12.3.0`;
- ImageMagick reports `7.1.1-43 Q16-HDRI aarch64 22550`, features `Cipher DPC HDRI Modules OpenMP`, compiler `clang (16.0.0)`.

Record the complete command outputs in provenance. Any mismatch means the previously pinned candidate hashes are not a valid deterministic gate until the difference is understood. Use these exact commands and no implicit replacement tool:

```bash
# Wraith
/Users/nichalasbarnes/.local/pipx/venvs/rembg/bin/python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --input /private/tmp/sector-zero-m2-wraith-echo-recovery/sources/wraith-source.png --out /private/tmp/sector-zero-m2-wraith-echo-recovery/sources/wraith-alpha.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
magick /private/tmp/sector-zero-m2-wraith-echo-recovery/sources/wraith-alpha.png -crop '993x1129+127+64' +repage -resize '968x1284' -gravity center -background none -extent 968x1284 /private/tmp/sector-zero-m2-wraith-echo-recovery/sources/wraith-fit.png
magick -size 1024x1536 xc:none /private/tmp/sector-zero-m2-wraith-echo-recovery/sources/wraith-fit.png -geometry +28+97 -composite /private/tmp/sector-zero-m2-wraith-echo-recovery/sources/wraith-production.png

# Echo
/Users/nichalasbarnes/.local/pipx/venvs/rembg/bin/python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --input /private/tmp/sector-zero-m2-wraith-echo-recovery/sources/echo-source.png --out /private/tmp/sector-zero-m2-wraith-echo-recovery/sources/echo-alpha.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
magick /private/tmp/sector-zero-m2-wraith-echo-recovery/sources/echo-alpha.png -crop '956x1079+149+82' +repage -resize '1037x895' -gravity center -background none -extent 1037x895 /private/tmp/sector-zero-m2-wraith-echo-recovery/sources/echo-fit.png
magick -size 1536x1024 xc:none /private/tmp/sector-zero-m2-wraith-echo-recovery/sources/echo-fit.png -geometry +258+49 -composite /private/tmp/sector-zero-m2-wraith-echo-recovery/sources/echo-production.png
```

Expected intermediate hashes are Wraith matte `535792477f4e9d3e8efe65f568b4214713035ae5eb40b87b0bbd16ece212ff76`, fit `453f3f73feca9e17ace9a3f090dc6f6fe51321ea52e2cd3ae829216e696be78e`, derivative `0d57dde688e04dda4f703941b703be9e04cfdafccdad32216166a7734d8fd378`; Echo matte `77d031b4e3daaf62484de7811ea6386d9d9cab4be7440d9fba46168b05729786` and derivative `7792dd06f55d200df43084d7acd06b487e16058a3b1b350318967100701b276e`. Record the Echo fit hash after deterministic reproduction.

All acceptance decisions remain **provisional** until the user reviews the final exact-size sheet, angle-matched original/candidate Bestiary pair, matched `480x854` gameplay pair, and four-panel review sheet and explicitly approves that enemy. The PR may contain only user-approved production replacements. If candidate Bestiary detail cannot be observed at a full-horizontal-magnitude turntable frame, the candidate fails closed.

### Task 1: Establish the fresh-main baseline

**Files:**
- Inspect: `game/public/sprites/enemies/wraith.png`
- Inspect: `game/public/sprites/enemies/echo.png`
- Inspect: `game/app/components/engine/{sprites.ts,enemies.ts,cockpitRenderer.ts}`
- Inspect: `game/scripts/sprites/sheets.ts`

- [ ] **Step 1: Record branch, original hashes, dimensions, alpha bounds, registrations, and single-frame contracts.**
- [ ] **Step 1a: Verify the only dirty path is this plan, snapshot the worktree status/diff outside the repository, and back up both originals with the pinned hashes above.**
- [ ] **Step 2: Run `npx tsc --noEmit`, `yarn colony:test`, `yarn engine:test`, and `yarn sprites:test` sequentially from `game/`.**
- [ ] **Step 3: Run `yarn build` and `NEXT_PUBLIC_DEVTOOLS=1 yarn build`; restore only tool-created package metadata drift if present.**
- [ ] **Step 4: Commit the recovery plan with `docs(assets): plan Wraith and Echo recovery` only after independent plan approval.**

### Task 2: Reconstruct and quality-gate Wraith

**Files:**
- Modify if accepted: `game/public/sprites/enemies/wraith.png`
- Create if accepted: `docs/assets/reviews/m2-wraith-echo-recovery/actual-size/after-wraith.png`
- Create if accepted: `docs/assets/reviews/m2-wraith-echo-recovery/bestiary/after-wraith.png`
- Create if accepted: `docs/assets/reviews/m2-wraith-echo-recovery/gameplay/after-wraith-w4-2.png`
- Create if accepted: `docs/assets/reviews/m2-wraith-echo-recovery/matched/wraith.png`
- Create: `docs/assets/prompts/shooter/03-m2-wraith-echo-recovery.md`

- [ ] **Step 1: Copy the recorded Wraith source to a recovery workspace and verify SHA-256 `ec33e8ee82c17e77bf8dea106b6fe962be6e21e0d3fbcffb8bed9920314cf42c`.**
- [ ] **Step 2: Matte with border auto-key, soft matte, thresholds 12/220, and despill; require source-matte SHA-256 `535792477f4e9d3e8efe65f568b4214713035ae5eb40b87b0bbd16ece212ff76`.**
- [ ] **Step 3: Crop the 5%-alpha bounds, fit proportionally inside `968x1284`, align to `+28+97`, and require production derivative SHA-256 `0d57dde688e04dda4f703941b703be9e04cfdafccdad32216166a7734d8fd378`.**
- [ ] **Step 4: Verify `1024x1536` sRGBA, one frame, transparent corners, bounds `968x1101+28+188`, center2 `1024,1477`, and clean edges. Treat the one-unit center2-Y difference from the original (`1478`) as a visible collision-alignment review item requiring explicit user approval; otherwise produce a separately hashed exact-center derivative or reject.**
- [ ] **Step 5: Generate exact `56x52` dark/bright evidence and an angle-matched original/candidate `96x96` Bestiary pair at a full-horizontal-magnitude turntable frame. Build a four-panel sheet using identical fields, scaling, labels, and crop rules. Add an exact-size entity-rectangle overlay comparing each complete-canvas sprite inside the unchanged `48x44` hitbox plus four-pixel renderer padding, with the alpha centerline and half-pixel Wraith Y shift visibly annotated.**
- [ ] **Step 6: Temporarily install, run sprite tests and DevPanel build, then capture an angle/state/timing-matched `480x854` W4-2 Wave 1 original/candidate pair. Observe the candidate in live Bestiary detail at the same turntable angle; remaining on the list is a failed gate.**
- [ ] **Step 7: Compare Wraith against all eight existing production enemies at actual draw size. Present all matched evidence and the half-pixel alignment note to the user. Keep the replacement only after explicit user approval; otherwise restore and hash-check the original. Record and commit the independent Wraith decision.**

### Task 3: Reconstruct and quality-gate Echo

**Files:**
- Modify if accepted: `game/public/sprites/enemies/echo.png`
- Create if accepted: `docs/assets/reviews/m2-wraith-echo-recovery/actual-size/after-echo.png`
- Create if accepted: `docs/assets/reviews/m2-wraith-echo-recovery/bestiary/after-echo.png`
- Create if accepted: `docs/assets/reviews/m2-wraith-echo-recovery/gameplay/after-echo-w6-2-visible.png`
- Create if accepted: `docs/assets/reviews/m2-wraith-echo-recovery/gameplay/after-echo-w6-2-ghosted.png`
- Create if accepted: `docs/assets/reviews/m2-wraith-echo-recovery/matched/echo-visible.png`
- Create if accepted: `docs/assets/reviews/m2-wraith-echo-recovery/matched/echo-ghosted.png`
- Modify: `docs/assets/prompts/shooter/03-m2-wraith-echo-recovery.md`

- [ ] **Step 1: Copy the recorded Echo source and verify SHA-256 `07c4fe09c4330dd696ecbb131a06480fe653fb04787d12c2d68d457a5998f43d`.**
- [ ] **Step 2: Matte with the recorded settings; require source-matte SHA-256 `77d031b4e3daaf62484de7811ea6386d9d9cab4be7440d9fba46168b05729786`.**
- [ ] **Step 3: Crop the 5%-alpha bounds, fit proportionally inside `1037x895`, align to `+258+49`, and require production derivative SHA-256 `7792dd06f55d200df43084d7acd06b487e16058a3b1b350318967100701b276e`.**
- [ ] **Step 4: Verify `1536x1024` sRGBA, one frame, transparent corners, bounds `793x895+380+49`, exact center2, and clean edges.**
- [ ] **Step 5: Generate exact `44x44` visible/15%-alpha dark/bright evidence and an angle-matched original/candidate `96x96` Bestiary pair at a full-horizontal-magnitude turntable frame. Build visible and ghosted four-panel sheets using identical fields, scaling, labels, and crop rules.**
- [ ] **Step 6: Temporarily install, run sprite tests and DevPanel build, then capture angle/state/timing-matched `480x854` W6-2 Wave 1 original/candidate pairs in visible and hidden states. Observe the candidate in live Bestiary detail at the same turntable angle; remaining on the list is a failed gate.**
- [ ] **Step 7: Compare Echo against all eight existing production enemies at actual draw size. Present all matched evidence to the user. Keep the replacement only after explicit user approval; otherwise restore and hash-check the original. Record and commit the independent Echo decision.**

### Task 4: Final verification and delivery

**Files:**
- Modify: `docs/assets/prompts/shooter/03-m2-wraith-echo-recovery.md`
- Create if any replacement is accepted: `docs/assets/reviews/m2-wraith-echo-recovery/tranche-comparison.png`

- [ ] **Step 1: Re-audit accepted PNG dimensions, color type, frame layout, alpha values, alpha bounds, corner transparency, and production paths.**
- [ ] **Step 2: Run sequentially from `game/`: `npx tsc --noEmit`, `yarn colony:test`, `yarn engine:test`, `yarn sprites:test`, `yarn build`, and `NEXT_PUBLIC_DEVTOOLS=1 yarn build`.**
- [ ] **Step 3: Serve the fresh DevPanel export, repeat all user-approved live checks at `480x854`, observe the accepted sprites in Bestiary detail, and record console errors and unchanged warnings separately.**
- [ ] **Step 4: Run `git diff --check origin/main...HEAD` and independently review the complete diff against this plan and the tranche-two design.**
- [ ] **Step 5: Push `feat/m2-wraith-echo-recovery` and open a draft PR listing accepted/rejected decisions, exact contracts, evidence, and verification. Do not merge.**

# M2 Shooter Enemy Tranche — Prompts and Provenance

**Date:** 2026-07-14
**Branch:** `feat/m2-shooter-enemy-tranche`
**Pipeline:** built-in Codex image generation → local chroma-key matte → exact-canvas PNG

## Selection evidence

Counts are explicit authored spawns in campaign `ALL_LEVELS` plus
`PLANET_LEVELS`.

| Enemy | Campaign | Planet | Total | Representative verification |
|---|---:|---:|---:|---|
| Swarm | 549 | 38 | 587 | World 8-3 Spawning Chamber; World 5-4 Event Horizon |
| Bomber | 447 | 51 | 498 | World 3-3 Solar Storm; World 5-4 Event Horizon |
| Gunner | 397 | 67 | 464 | World 1-4 The Gauntlet; World 5-4 Event Horizon |
| Drone | 374 | 76 | 450 | World 1-4 The Gauntlet; World 5-4 Event Horizon |

The next-highest authored total is Cloaker at 403.

## Preserved runtime contracts

All four assets are single-frame sRGBA billboards registered at their existing
paths by `SPRITES` and `ENEMY_SPRITE_MAP`. The renderer draws four pixels beyond
each side of the entity rectangle. Bestiary detail reuses each path at 96x96.

| Enemy | Path | Source | Frames | 5%-alpha envelope | Entity | Gameplay render | Bestiary |
|---|---|---:|---:|---:|---:|---:|---:|
| Swarm | `enemies/swarm.png` | 1536x1024 | 1 | 559x594 | 24x24 | 32x32 | 96x96 |
| Bomber | `enemies/bomber.png` | 1536x1024 | 1 | 414x829 | 36x48 | 44x56 | 96x96 |
| Gunner | `enemies/gunner.png` | 1536x1024 | 1 | 668x548 | 48x48 | 56x56 | 96x96 |
| Drone | `enemies/drone.png` | 1536x1024 | 1 | 420x413 | 32x32 | 40x40 | 96x96 |

## Shared generation prompt

### Flat-background block

```text
Create one top-down vertical-shooter enemy sprite on a perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Keep the subject fully separated from the background with crisp edges and generous padding. Do not use #00ff00 anywhere in the subject. No cast shadow, no contact shadow, no reflection, no watermark, and no text.
```

### Authoritative positive suffix

```text
modern DOOM (2016 / Eternal) aesthetic, gritty industrial sci-fi, heavy worn scarred
gunmetal and cracked concrete, crushed near-black shadows, very high contrast, low ambient
saturation, single hot directional key light, emissive glow accents only (hellfire orange
#ff5a1e, demon red #ff3366, toxic green #44ff99, tech cyan #00f0ff, portal purple #7800ff),
strong readable silhouette, chunky weighted forms, painterly realistic detail, game asset,
dark background separation, dramatic rim lighting
```

### Authoritative negative suffix

```text
pixel art, 8-bit, 16-bit, dithering, visible pixels, cartoon, cel shading, anime, flat
colors, outline style, pastel, bright cheerful colors, saturated painted surfaces, clean new
pristine surfaces, chrome, gloss plastic, soft even lighting, washed out, low contrast, text,
letters, numbers, logos, watermark, signature, jpeg artifacts, blurry, white background halo
```

For shooter assets, role and actual-size silhouette outrank literal FPS/DOOM
fidelity. Originals are semantic references only, not silhouettes to copy.

## Pre-change baseline

Run from `game/` on `c2642d1` before production sprite changes:

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | pass, exit 0 |
| `yarn colony:test` | 268/268 pass |
| `yarn engine:test` | 66/66 pass |
| `yarn sprites:test` | 4/4 pass |
| `yarn build` | static export pass; restricted-network attempt could not fetch Google Fonts, approved network rerun passed |
| `NEXT_PUBLIC_DEVTOOLS=1 yarn build` | static export pass |

## Generation ledger

The built-in image tool does not currently expose a numeric seed. Record that
as `not exposed by built-in tool` unless an individual result provides one.
Generated and rejected source images stay under `/private/tmp`, outside the
production sprite tree.

### Swarm

- **Sprite ID:** `SPRITES.ENEMY_SWARM`
- **Accepted output identifier/path:** pending
- **Seed:** pending
- **Reference role:** original sprite inspected for semantics and scale only
- **Generated source dimensions:** pending
- **Matte:** pending
- **Iteration notes:** pending
- **Actual-size verdict:** pending
- **Rejected candidates:** pending

### Bomber

- **Sprite ID:** `SPRITES.ENEMY_BOMBER`
- **Accepted output identifier/path:** pending
- **Seed:** pending
- **Reference role:** original sprite inspected for semantics and scale only
- **Generated source dimensions:** pending
- **Matte:** pending
- **Iteration notes:** pending
- **Actual-size verdict:** pending
- **Rejected candidates:** pending

### Gunner

- **Sprite ID:** `SPRITES.ENEMY_GUNNER`
- **Accepted output identifier/path:** pending
- **Seed:** pending
- **Reference role:** original sprite inspected for semantics and scale only
- **Generated source dimensions:** pending
- **Matte:** pending
- **Iteration notes:** pending
- **Actual-size verdict:** pending
- **Rejected candidates:** pending

### Drone

- **Sprite ID:** `SPRITES.ENEMY_DRONE`
- **Accepted output identifier/path:** pending
- **Seed:** pending
- **Reference role:** original sprite inspected for semantics and scale only
- **Generated source dimensions:** pending
- **Matte:** pending
- **Iteration notes:** pending
- **Actual-size verdict:** pending
- **Rejected candidates:** pending

## Browser verification

Before and after captures use the DevPanel-enabled production static export at
480x854. Final results, console evidence, exact comparison commands, and visual
verdicts are recorded here after all four replacements pass.

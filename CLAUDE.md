# Sector Zero — Developer Guide

## Repo Structure

```
sector-zero/
├── game/          # Next.js 15 game app (static export)
├── site/          # Next.js 15 companion site (static export)
├── docs/          # Design specs and implementation plans
└── package.json   # Root workspace scripts
```

`game/` and `site/` are independent Next.js 15 applications. They share no code and each have their own `package.json`, `node_modules`, and build output. `docs/` contains planning documents — not served.

## Quick Start

From the repo root:

```bash
yarn game:dev   # Game at http://localhost:3000
yarn site:dev   # Site at http://localhost:3001
```

Or cd into each app directly:

```bash
cd game && yarn install && yarn dev
cd site && yarn install && yarn dev
```

## Game Architecture

### Modes

| Mode | Engine Files |
|---|---|
| Vertical Shooter | `gameEngine.ts` + `renderer.ts` |
| Ground Run & Gun | `groundEngine.ts` + `groundRenderer.ts` |
| Ship Boarding | `boardingEngine.ts` + `boardingRenderer.ts` |
| First-Person Raycaster | `firstPersonEngine.ts` + `firstPersonRenderer.ts` |
| Ship Turret | `turretEngine.ts` + `turretRenderer.ts` |
| Multi-Phase | `phases.ts` + `phaseTransition.ts` |

All engine code lives in `game/app/components/engine/`. The game loop dispatches by `currentMode` on `GameState` — `updateGame()` calls the appropriate engine update, `drawGame()` calls the appropriate renderer.

### Canvas

Renders at **480×854** via HTML5 Canvas 2D at 60fps. Game area is 714px tall; dashboard occupies the bottom 140px.

### Sprites

Static sprite assets are in `game/public/sprites/`, organized by type: `enemies/`, `bosses/`, `bullets/`, `effects/`, `backgrounds/`, etc.

### Verification

No test framework. Verify changes with `yarn build` (static export must succeed) + manual playtest in the browser.

## Site Architecture

### Content

News posts are MDX files in `site/content/posts/`. Each file requires frontmatter:

```mdx
---
title: "Post Title"
date: "2026-01-15"
summary: "One-sentence summary shown in previews."
image: "/sector-zero/site/images/modes/shooter.png"
tags: ["NEW MODE", "UPDATE"]
---

Post body in MDX here.
```

### Custom MDX Components

| Component | Usage |
|---|---|
| `<GameImage>` | Captioned screenshot — `src`, `alt`, optional `caption` |
| `<ModeTag>` | Colored pill label — e.g. `<ModeTag label="NEW MODE" />` |
| `<Callout>` | Highlighted info box — `type` can be `info`, `warning`, `tip` |

### Styling

Tailwind CSS 4 with a HUD-themed design system. Custom tokens are defined via `@theme` in `site/app/globals.css` — colors like `--color-hud-cyan`, `--color-hud-amber`, etc.

## Adding a News Post

1. Create `site/content/posts/my-post-slug.mdx` with the frontmatter above
2. Add any images to `site/public/images/`
3. Run `yarn site:dev` to preview
4. Run `cd site && yarn build` to confirm the static export succeeds

## Deployment

Pushing to `main` triggers the GitHub Actions workflow at `.github/workflows/deploy.yml`, which:

1. Builds the game with `NEXT_PUBLIC_BASE_PATH=/sector-zero`
2. Builds the site with `NEXT_PUBLIC_BASE_PATH=/sector-zero/site`
3. Merges outputs into a single `deploy/` directory
4. Deploys to GitHub Pages

Live URLs:
- Game: `https://colorpulse6.github.io/sector-zero/`
- Site: `https://colorpulse6.github.io/sector-zero/site/`

## Static Export

Both apps use `output: 'export'` in `next.config.ts`. The `basePath` and `assetPrefix` are controlled by the `NEXT_PUBLIC_BASE_PATH` environment variable set during CI builds. Locally, no base path is set and apps run at `/`.

All internal links and image `src` values should use the `getBasePath()` utility (or equivalent) to remain correct in both environments.

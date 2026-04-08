# Sector Zero Game Website — Design Spec

**Date:** 2026-04-07
**Status:** Approved
**Location:** `sites/sector-zero-site/web/`

## Overview

A static website for Sector Zero — a browser-based multi-genre space shooter — serving as a public-facing hub for news, updates, lore, and feature showcases. Deployed to GitHub Pages at `/knicks-knacks/sector-zero-site/`.

The site evolves beyond a changelog into a living hub for the Sector Zero universe. Future iterations will add playable game embeds, community comments, and email subscriptions (documented here, not built in v1).

## Tech Stack

- **Framework:** Next.js 15 with App Router, static export (`output: 'export'`)
- **Styling:** Tailwind CSS
- **Content:** MDX files with frontmatter, parsed at build time via `gray-matter` + `next-mdx-remote/rsc` (RSC-compatible variant for App Router)
- **Deployment:** GitHub Pages via existing `deploy-games.yml` workflow
- **Base path:** `/knicks-knacks/sector-zero-site/`

## Monorepo Integration

### Workspace

Add `"sites/*/web"` to root `package.json` workspaces. Package named `@knicks-knacks/sector-zero-site`. Note: `sites/` is a new top-level directory category for static marketing/companion sites, distinct from `games/` (playable games) and `apps/` (full-stack applications).

### Scripts

Root `package.json`:
```json
"sector-zero-site:dev": "cd sites/sector-zero-site/web && yarn dev"
```

### Next.js Config

Same pattern as all games:
```ts
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || '',
}
```

### GitHub Actions

In `deploy-games.yml`:
- Add trigger path: `sites/**`
- Add build step with `NEXT_PUBLIC_BASE_PATH=/knicks-knacks/sector-zero-site`
- Copy output: `cp -r sites/sector-zero-site/web/out ./deploy/sector-zero-site`
- Optionally add to arcade hub index page

## Directory Structure

```
sites/sector-zero-site/web/
├── app/
│   ├── layout.tsx              # Root layout (nav, footer, fonts, metadata)
│   ├── page.tsx                # Landing page
│   ├── globals.css             # Tailwind + custom HUD styles
│   ├── news/
│   │   ├── page.tsx            # News feed (lists all posts)
│   │   └── [slug]/
│   │       └── page.tsx        # Individual post (MDX rendered)
│   ├── about/
│   │   └── page.tsx            # Story, modes, tech stack
│   └── coming-soon/
│       └── page.tsx            # Colony management teaser
├── components/
│   ├── Nav.tsx                 # Top navigation bar
│   ├── Footer.tsx              # Site footer
│   ├── ModeCard.tsx            # Game mode display card
│   ├── NewsItem.tsx            # News feed entry
│   ├── GameImage.tsx           # MDX: styled image with caption
│   ├── ModeTag.tsx             # MDX: inline colored tag
│   └── Callout.tsx             # MDX: in-universe info box
├── lib/
│   └── posts.ts                # Post utilities (getAllPosts, getPostBySlug)
├── content/
│   └── posts/
│       ├── vertical-shooter.mdx
│       ├── ground-run-and-gun.mdx
│       ├── ship-boarding.mdx
│       ├── first-person-raycaster.mdx
│       ├── ship-turret.mdx
│       ├── multi-phase-levels.mdx
│       ├── rpg-systems.mdx
│       └── rpg-exploration.mdx
├── public/
│   └── images/
│       ├── modes/              # Hero images per mode (curated from games/sector-zero/web/public/sprites/)
│       ├── enemies/            # Enemy sprites for posts (copied from game assets, resized for web)
│       ├── bosses/             # Boss sprites (copied from game assets)
│       ├── ui/                 # HUD elements, cockpit frames (from game cockpit/ sprites)
│       ├── colony/             # Colony teaser imagery (placeholder until colony mode built)
│       └── hero.png            # Landing page hero composite (assembled from game backgrounds + ship sprites)
├── CLAUDE.md                   # Site development guide
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
└── tsconfig.json
```

## Visual Design System

### Layout

Full-Width Cinematic: vertical scroll with big hero section, horizontal mode cards, and news feed below.

### Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `bg-deep` | `#0a0e17` | Page background |
| `accent-cyan` | `#00f0ff` | HUD text, borders, CTAs |
| `accent-purple` | `#7800ff` | Highlights, tags, gradients |
| `text-primary` | `#e0e6ed` | Body text |
| `text-muted` | `rgba(0,240,255,0.4-0.6)` | Secondary text |
| `accent-danger` | `#ff3366` | Warnings, enemy references (sparingly) |

### Typography

- **Headings:** `'Courier New', monospace` — uppercase, wide letter-spacing (HUD/terminal feel)
- **Body:** Clean sans-serif (`Inter` or `system-ui`) — readable for longer content
- **Labels/tags:** Monospace, small caps, wide tracking

### HUD Flourishes

- Thin `1px solid rgba(0,240,255,0.15)` borders as section dividers
- `// SECTION NAME` monospace labels above content blocks
- Subtle purple-to-transparent gradients on hero sections
- Purple left-border accent bars on news feed items
- No scanline overlays or animated effects

### Components

- **CTA buttons:** Bordered (no fill), cyan, monospace text, subtle hover glow
- **Mode cards:** Border frame, thumbnail left, text right, purple category tag
- **News items:** Date + title + summary, purple left-border accent
- **Navigation:** Minimal top bar — logo left, links right, monospace

## Pages

### Landing Page (`/`)

1. **Nav bar** — "SECTOR ZERO" logo left, NEWS / ABOUT / COLONY links right
2. **Hero section** — Full-width, purple gradient background. Title, tagline ("8 Sectors. 6 Modes. One Hivemind."), "PLAY NOW" CTA linking to `https://colorpulse6.github.io/knicks-knacks/sector-zero/`
3. **Mode cards** — 3x2 grid on desktop, stacked on mobile. Each: sprite thumbnail, mode name, one-line description. Links to that mode's news post
4. **Latest transmissions** — 3 most recent news posts with date, title, summary. "View all" link to `/news`
5. **Footer** — GitHub link, credits

### News Page (`/news`)

- `// TRANSMISSIONS` header
- Reverse-chronological feed of all posts
- Each entry: date, title, hero image thumbnail, summary, tag (e.g. "NEW MODE", "RPG SYSTEMS")
- Click through to `/news/[slug]`

### News Post (`/news/[slug]`)

- Hero image at top
- MDX-rendered content with custom components (GameImage, ModeTag, Callout)
- Back link to `/news`
- Tags displayed
- Space reserved for future comment section

### About Page (`/about`)

- **The Story** — Kepler Exodus / Hollow lore summary (2-3 paragraphs)
- **Gameplay Modes** — 6 mode cards with descriptions and sprites (richer than landing page)
- **Tech Stack** — "Built with" section (Canvas 2D, Next.js, TypeScript)
- **The Two Endings** — Teaser about the destroy vs. merge choice

### Coming Soon Page (`/coming-soon`)

- Colony Management teaser with in-universe framing ("CLASSIFIED // COLONY PROTOCOL")
- Key features: resources, buildings, population, attacks, Earth shipments
- Content pulled from colony system design doc
- Placeholder for future colony screenshots

## Content System

### Post Frontmatter

```yaml
---
title: "Ship Turret — Star Wars Gunner Mode"
slug: ship-turret
date: 2026-04-05
tag: NEW MODE
summary: "Mouse-aim crosshair combat with 3 enemy types swooping from all angles across 5 waves."
heroImage: /images/modes/turret-hero.png
---
```

### Post Utilities (`lib/posts.ts`)

- `getAllPosts()` — reads all MDX files, parses frontmatter, returns sorted by date descending
- `getPostBySlug(slug)` — returns single post with parsed MDX content
- Used by `generateStaticParams()` for static route generation

### Custom MDX Components

- `<GameImage src="" caption="" />` — styled image with HUD-style border and caption
- `<ModeTag>SHOOTER</ModeTag>` — inline colored tag
- `<Callout>` — in-universe styled info box ("// COMMANDER'S NOTE")

### Initial Posts (8 total)

| Post | Tag | Content |
|------|-----|---------|
| `vertical-shooter.mdx` | NEW MODE | Original 8-world campaign, 40 levels, bosses |
| `ground-run-and-gun.mdx` | NEW MODE | Contra-style platformer, gravity, 4+ enemy types |
| `ship-boarding.mdx` | NEW MODE | Top-down dungeon crawler, corridors, line-of-sight AI |
| `first-person-raycaster.mdx` | NEW MODE | Wolfenstein-style 3D, textured walls, billboard enemies |
| `ship-turret.mdx` | NEW MODE | Star Wars gunner mode, mouse-aim, 5 waves |
| `multi-phase-levels.mdx` | NEW MODE | Cinematic transitions chaining modes together |
| `rpg-systems.mdx` | RPG SYSTEMS | Weapon affinity, pilot leveling, bestiary, rewards |
| `rpg-exploration.mdx` | RPG SYSTEMS | NPC interaction, dialog, shops, Ashfall camp |

**Post tone & length:** 2-4 paragraphs per post, written in an in-universe mission briefing style. Mix gameplay description with lore flavor. Each post should include at least one GameImage showcasing the feature.

## Future Features (Not Built in v1)

These are documented for architectural awareness. The site structure accommodates them without premature implementation.

### Playable Embeds
Game canvas components embedded directly on the site for mode demos/testing. Could use iframes pointing to the game build or imported React components rendering to canvas.

### Comments
Community discussion on news posts and feature pages. Options include Giscus (GitHub Discussions-based, works with static sites) or a third-party service. Client-side integration compatible with static export.

### Email Subscriptions
Update notifications via email. Requires an external service (Buttondown, Resend, etc.) with a client-side signup form. No backend needed — the form posts directly to the service API.

## Documentation Deliverables

### `sites/sector-zero-site/web/CLAUDE.md`
Development guide covering: site structure, how to add new posts, styling conventions, component usage, build/deploy process, future features roadmap.

### `docs/sector-zero-site/`
Full vision document including future feature plans (playable embeds, comments, email) and architectural decisions.

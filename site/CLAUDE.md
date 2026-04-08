# Sector Zero Site — Development Guide

## Purpose

Static companion website for the Sector Zero game. Deployed to GitHub Pages at:

- **Site**: `https://colorpulse6.github.io/knicks-knacks/sector-zero-site/`
- **Live game**: `https://colorpulse6.github.io/knicks-knacks/sector-zero/`

## Tech Stack

| Technology | Version |
|---|---|
| Next.js | 15 (static export) |
| React | 19 |
| TypeScript | 5.x |
| Tailwind CSS | 4 |
| gray-matter | 4 (MDX frontmatter parsing) |
| next-mdx-remote/rsc | 5 (MDX rendering in RSC) |

## Directory Structure

```
web/
├── app/                     # Next.js App Router pages
│   ├── about/               # About the game
│   ├── coming-soon/         # Upcoming features page
│   ├── news/                # News index + [slug] dynamic route
│   ├── superpowers/         # Superpowers/modes listing page
│   ├── globals.css          # Global styles + @theme tokens
│   ├── layout.tsx           # Root layout (Nav, Footer)
│   └── page.tsx             # Homepage (hero, modes, news preview)
├── components/              # Reusable UI components
│   ├── mdx/                 # MDX-specific components
│   │   ├── Callout.tsx      # Highlighted callout box
│   │   ├── GameImage.tsx    # Captioned image for posts
│   │   └── ModeTag.tsx      # Colored tag pill (NEW MODE, etc.)
│   ├── mdx-components.tsx   # MDX component registry
│   ├── CtaButton.tsx        # Call-to-action link button
│   ├── Footer.tsx           # Site footer
│   ├── HudSection.tsx       # Section wrapper with HUD label
│   ├── ModeCard.tsx         # Card for game mode display
│   ├── Nav.tsx              # Top navigation
│   └── NewsItem.tsx         # News post preview card
├── lib/
│   └── posts.ts             # MDX post loading utilities (gray-matter)
├── data/
│   ├── modes.ts             # Game mode definitions
│   └── posts.ts             # Re-exports or post metadata (if used)
├── content/
│   └── posts/               # MDX news/update posts
│       └── *.mdx
└── public/
    └── images/              # Static image assets
        ├── modes/           # Mode hero images
        ├── bosses/          # Boss screenshots
        ├── colony/          # Colony system screenshots
        ├── enemies/         # Enemy screenshots
        └── ui/              # UI screenshots
```

## Adding a New News Post

1. Create a `.mdx` file in `content/posts/` with frontmatter:

   ```mdx
   ---
   title: "Your Post Title"
   slug: your-post-slug
   date: 2026-04-07
   tag: NEW MODE
   summary: "One-sentence summary shown on the news index."
   heroImage: /images/modes/your-image.png
   ---

   Post body here. Use MDX components as needed.

   <GameImage src="/images/modes/your-image.png" caption="Caption text" />
   ```

2. Add hero image to `public/images/modes/` (or the appropriate subdirectory under `public/images/`).

3. Use MDX components in the post body:
   - `<GameImage src="..." caption="..." />` — captioned screenshot
   - `<ModeTag label="NEW MODE" />` — colored tag pill
   - `<Callout>Important note here.</Callout>` — highlighted callout box

4. Run `yarn build` and verify the post renders at `/news/your-post-slug`.

## Styling Conventions

All design tokens are defined in the `@theme` block in `app/globals.css`.

### Color Tokens

| Token | Value | Use |
|---|---|---|
| `--color-deep` | `#0a0e17` | Page background |
| `--color-deep-lighter` | `#0f1520` | Card backgrounds |
| `--color-cyan-accent` | `#00f0ff` | Primary accent, borders |
| `--color-purple-accent` | `#7800ff` | Secondary accent |
| `--color-text-primary` | `#e0e6ed` | Body text |
| `--color-text-muted` | `rgba(0,240,255,0.5)` | Labels, secondary text |
| `--color-danger-accent` | `#ff3366` | Warnings, alerts |
| `--color-border-hud` | `rgba(0,240,255,0.15)` | Subtle HUD borders |
| `--color-border-purple` | `rgba(120,0,255,0.4)` | News/content borders |

### Utility Classes

| Class | Use |
|---|---|
| `.hud-label` | Section labels in monospace uppercase (e.g. `// MODES`) |
| `.mode-card` | Game mode card with HUD border and hover glow |
| `.news-accent` | Purple left-border accent for news items |
| `.cta-button` | Monospace uppercase link button with cyan border |

## Available Components

| Component | Location | Description |
|---|---|---|
| `Nav` | `components/Nav.tsx` | Top navigation bar |
| `Footer` | `components/Footer.tsx` | Site footer |
| `HudSection` | `components/HudSection.tsx` | Section wrapper with HUD label |
| `CtaButton` | `components/CtaButton.tsx` | CTA link button |
| `ModeCard` | `components/ModeCard.tsx` | Game mode display card |
| `NewsItem` | `components/NewsItem.tsx` | News post preview |
| `GameImage` | `components/mdx/GameImage.tsx` | Captioned image (MDX only) |
| `ModeTag` | `components/mdx/ModeTag.tsx` | Tag pill (MDX only) |
| `Callout` | `components/mdx/Callout.tsx` | Highlighted callout (MDX only) |

## Build Commands

```bash
yarn dev        # Start dev server (Turbopack)
yarn build      # Production build (static export)
yarn lint       # Run ESLint
```

## Deployment

Deployment is automatic via GitHub Actions. Pushing to `main` with changes under `sites/**` triggers a build and deploys to the `gh-pages` branch.

The static export is configured in `next.config.ts` with `output: 'export'` and `basePath: '/knicks-knacks/sector-zero-site'`.

## Future Features

- **Playable embeds**: iframe or React canvas components embedding the game build directly on the site
- **Comments**: Giscus (GitHub Discussions-based, zero backend required) on news posts
- **Email subscriptions**: client-side form wired to Buttondown or Resend for update announcements

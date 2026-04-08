# Sector Zero Game Website — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static companion website for Sector Zero deployed to GitHub Pages at `/knicks-knacks/sector-zero-site/`.

**Architecture:** Next.js 15 App Router with static export. MDX content parsed at build time via `gray-matter` + `next-mdx-remote/rsc`. Tailwind CSS for styling with a custom dark sci-fi HUD theme. Deployed alongside existing games via the `deploy-games.yml` GitHub Actions workflow.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 4, gray-matter, next-mdx-remote, PostCSS

**Spec:** `docs/superpowers/specs/2026-04-07-sector-zero-site-design.md`

---

## File Structure Overview

```
sites/sector-zero-site/web/
├── app/
│   ├── layout.tsx              # Root layout with Nav, Footer, fonts, metadata
│   ├── page.tsx                # Landing page
│   ├── globals.css             # Tailwind imports + custom HUD theme
│   ├── news/
│   │   ├── page.tsx            # News feed listing
│   │   └── [slug]/
│   │       └── page.tsx        # Individual post (MDX rendered)
│   ├── about/
│   │   └── page.tsx            # Story, modes, tech
│   └── coming-soon/
│       └── page.tsx            # Colony teaser
├── components/
│   ├── Nav.tsx
│   ├── Footer.tsx
│   ├── HudSection.tsx          # Reusable "// LABEL" section wrapper
│   ├── ModeCard.tsx
│   ├── NewsItem.tsx
│   ├── CtaButton.tsx
│   ├── mdx/
│   │   ├── GameImage.tsx
│   │   ├── ModeTag.tsx
│   │   └── Callout.tsx
│   └── mdx-components.tsx      # MDX component map
├── lib/
│   └── posts.ts                # getAllPosts, getPostBySlug
├── data/
│   └── modes.ts                # Mode metadata (name, description, slug, image)
├── content/
│   └── posts/                  # 8 MDX files
├── public/
│   └── images/                 # Curated game sprites
├── CLAUDE.md
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
└── tsconfig.json
```

---

### Task 1: Scaffold Next.js Project & Monorepo Integration

**Files:**
- Create: `sites/sector-zero-site/web/package.json`
- Create: `sites/sector-zero-site/web/next.config.ts`
- Create: `sites/sector-zero-site/web/tsconfig.json`
- Create: `sites/sector-zero-site/web/tailwind.config.ts`
- Create: `sites/sector-zero-site/web/postcss.config.mjs`
- Modify: `package.json` (root — workspaces + script)

- [ ] **Step 1: Create `sites/sector-zero-site/web/package.json`**

```json
{
  "name": "@knicks-knacks/sector-zero-site",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "gray-matter": "^4.0.3",
    "next": "15.3.1",
    "next-mdx-remote": "^5.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.0.5",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "autoprefixer": "^10.4.21",
    "postcss": "^8.5.3",
    "tailwindcss": "^4.0.5",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Create `sites/sector-zero-site/web/next.config.ts`**

```typescript
import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
};

export default nextConfig;
```

- [ ] **Step 3: Create `sites/sector-zero-site/web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `sites/sector-zero-site/web/tailwind.config.ts`**

Tailwind v4 handles theming via `@theme` in CSS (see Task 2 globals.css). This config is minimal — it follows the existing game pattern for compatibility but all color/font tokens are defined in `globals.css`.

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;

export default config;
```

- [ ] **Step 5: Create `sites/sector-zero-site/web/postcss.config.mjs`**

```javascript
/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

- [ ] **Step 6: Update root `package.json`**

Add `"sites/*/web"` to the workspaces array and add the dev script:

```json
"workspaces": [
  "apps/*/*",
  "games/*/web",
  "sites/*/web",
  "packages/*"
]
```

Add to scripts:
```json
"sector-zero-site:dev": "cd sites/sector-zero-site/web && yarn dev"
```

- [ ] **Step 7: Install dependencies**

Run from repo root:
```bash
yarn install
```

Expected: Resolves all dependencies including `gray-matter` and `next-mdx-remote`.

- [ ] **Step 8: Commit**

```bash
git add sites/sector-zero-site/web/package.json sites/sector-zero-site/web/next.config.ts sites/sector-zero-site/web/tsconfig.json sites/sector-zero-site/web/tailwind.config.ts sites/sector-zero-site/web/postcss.config.mjs package.json yarn.lock
git commit -m "feat(sector-zero-site): scaffold Next.js project with monorepo integration"
```

---

### Task 2: Global Styles, Layout & Shared Components

**Files:**
- Create: `sites/sector-zero-site/web/app/globals.css`
- Create: `sites/sector-zero-site/web/app/layout.tsx`
- Create: `sites/sector-zero-site/web/components/Nav.tsx`
- Create: `sites/sector-zero-site/web/components/Footer.tsx`
- Create: `sites/sector-zero-site/web/components/HudSection.tsx`
- Create: `sites/sector-zero-site/web/components/CtaButton.tsx`
- Create: `sites/sector-zero-site/web/app/page.tsx` (minimal placeholder)

- [ ] **Step 1: Create `app/globals.css`**

```css
@import "tailwindcss";

@theme {
  --color-deep: #0a0e17;
  --color-deep-lighter: #0f1520;
  --color-cyan-accent: #00f0ff;
  --color-purple-accent: #7800ff;
  --color-text-primary: #e0e6ed;
  --color-text-muted: rgba(0, 240, 255, 0.5);
  --color-danger-accent: #ff3366;
  --color-border-hud: rgba(0, 240, 255, 0.15);
  --color-border-purple: rgba(120, 0, 255, 0.4);

  --font-mono: "Courier New", monospace;
  --font-sans: "Inter", system-ui, sans-serif;
}

body {
  background-color: var(--color-deep);
  color: var(--color-text-primary);
  font-family: var(--font-sans);
}

/* HUD section label: "// SECTION NAME" */
.hud-label {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

/* CTA button base */
.cta-button {
  display: inline-block;
  padding: 0.5rem 1.5rem;
  border: 1px solid var(--color-cyan-accent);
  color: var(--color-cyan-accent);
  font-family: var(--font-mono);
  font-size: 0.8rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  transition: box-shadow 0.2s, background-color 0.2s;
}

.cta-button:hover {
  box-shadow: 0 0 12px rgba(0, 240, 255, 0.3);
  background-color: rgba(0, 240, 255, 0.05);
}

/* Purple left-border accent for news items */
.news-accent {
  border-left: 2px solid var(--color-border-purple);
  padding-left: 0.75rem;
}

/* Mode card border */
.mode-card {
  border: 1px solid var(--color-border-hud);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.mode-card:hover {
  border-color: var(--color-cyan-accent);
  box-shadow: 0 0 8px rgba(0, 240, 255, 0.15);
}
```

- [ ] **Step 2: Create `components/Nav.tsx`**

```tsx
import Link from "next/link";

const navLinks = [
  { href: "/news", label: "NEWS" },
  { href: "/about", label: "ABOUT" },
  { href: "/coming-soon", label: "COLONY" },
];

export default function Nav() {
  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-border-hud bg-deep-lighter/50">
      <Link
        href="/"
        className="font-mono text-sm font-bold tracking-[0.2em] text-cyan-accent"
      >
        SECTOR ZERO
      </Link>
      <div className="flex gap-6">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="font-mono text-xs tracking-wider text-text-muted hover:text-cyan-accent transition-colors"
          >
            {link.label}
          </Link>
        ))}
        <a
          href="https://colorpulse6.github.io/knicks-knacks/sector-zero/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs tracking-wider text-cyan-accent hover:text-white transition-colors"
        >
          PLAY
        </a>
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: Create `components/Footer.tsx`**

```tsx
export default function Footer() {
  return (
    <footer className="border-t border-border-hud px-6 py-6 text-center">
      <p className="font-mono text-xs text-text-muted tracking-wider">
        SECTOR ZERO &mdash; Built with Next.js &amp; HTML5 Canvas
      </p>
      <p className="font-mono text-xs text-text-muted/50 mt-1">
        <a
          href="https://github.com/colorpulse6/knicks-knacks"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-cyan-accent transition-colors"
        >
          GitHub
        </a>
      </p>
    </footer>
  );
}
```

- [ ] **Step 4: Create `components/HudSection.tsx`**

```tsx
interface HudSectionProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export default function HudSection({ label, children, className = "" }: HudSectionProps) {
  return (
    <section className={`py-12 px-6 ${className}`}>
      <p className="hud-label mb-6">// {label}</p>
      {children}
    </section>
  );
}
```

- [ ] **Step 5: Create `components/CtaButton.tsx`**

```tsx
import Link from "next/link";

interface CtaButtonProps {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}

export default function CtaButton({ href, children, external = false }: CtaButtonProps) {
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="cta-button">
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className="cta-button">
      {children}
    </Link>
  );
}
```

- [ ] **Step 6: Create `app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sector Zero — Space Shooter Hub",
  description:
    "Pilot a strike fighter through 8 sectors of hostile space. 6 gameplay modes, RPG progression, and the Hollow awaits.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} antialiased`}>
        <div className="min-h-screen flex flex-col">
          <Nav />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Create minimal `app/page.tsx` placeholder**

```tsx
export default function Home() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <h1 className="font-mono text-2xl tracking-[0.3em] text-cyan-accent">
        SECTOR ZERO
      </h1>
    </div>
  );
}
```

- [ ] **Step 8: Verify dev server starts**

```bash
cd sites/sector-zero-site/web && yarn dev
```

Expected: Dev server starts on `localhost:3000`. Page shows "SECTOR ZERO" centered text with nav bar and footer. Dark background, cyan text, HUD-style navigation.

- [ ] **Step 9: Commit**

```bash
git add sites/sector-zero-site/web/app/ sites/sector-zero-site/web/components/
git commit -m "feat(sector-zero-site): add layout, nav, footer, and HUD design system"
```

---

### Task 3: Mode Data & ModeCard Component

**Files:**
- Create: `sites/sector-zero-site/web/data/modes.ts`
- Create: `sites/sector-zero-site/web/components/ModeCard.tsx`

- [ ] **Step 1: Create `data/modes.ts`**

```typescript
export interface GameMode {
  id: string;
  name: string;
  tagline: string;
  description: string;
  slug: string;
  image: string;
}

export const GAME_MODES: GameMode[] = [
  {
    id: "shooter",
    name: "Vertical Shooter",
    tagline: "MODE 01",
    description: "8 worlds, 40 levels, multi-phase bosses. The original campaign.",
    slug: "vertical-shooter",
    image: "/images/modes/shooter.png",
  },
  {
    id: "ground",
    name: "Ground Run & Gun",
    tagline: "MODE 02",
    description: "Contra-style side-scrolling with gravity, jumping, and 4+ enemy types.",
    slug: "ground-run-and-gun",
    image: "/images/modes/ground.png",
  },
  {
    id: "boarding",
    name: "Ship Boarding",
    tagline: "MODE 03",
    description: "Top-down dungeon crawler with corridors and line-of-sight AI.",
    slug: "ship-boarding",
    image: "/images/modes/boarding.png",
  },
  {
    id: "raycaster",
    name: "First-Person Raycaster",
    tagline: "MODE 04",
    description: "Wolfenstein-style 3D with textured walls, billboard enemies, and hitscan combat.",
    slug: "first-person-raycaster",
    image: "/images/modes/raycaster.png",
  },
  {
    id: "turret",
    name: "Ship Turret",
    tagline: "MODE 05",
    description: "Star Wars gunner mode with mouse-aim crosshair and 5 waves of enemies.",
    slug: "ship-turret",
    image: "/images/modes/turret.png",
  },
  {
    id: "multiphase",
    name: "Multi-Phase Levels",
    tagline: "MODE 06",
    description: "Cinematic transitions chain different modes into epic multi-part missions.",
    slug: "multi-phase-levels",
    image: "/images/modes/multiphase.png",
  },
];
```

- [ ] **Step 2: Create `components/ModeCard.tsx`**

```tsx
import Link from "next/link";
import Image from "next/image";
import type { GameMode } from "@/data/modes";

interface ModeCardProps {
  mode: GameMode;
}

export default function ModeCard({ mode }: ModeCardProps) {
  return (
    <Link href={`/news/${mode.slug}`} className="mode-card block">
      <div className="flex items-stretch">
        <div className="w-24 h-24 relative bg-gradient-to-br from-purple-accent/20 to-cyan-accent/10 flex-shrink-0">
          <Image
            src={mode.image}
            alt={mode.name}
            fill
            className="object-cover"
          />
        </div>
        <div className="p-3 flex-1 min-w-0">
          <p className="font-mono text-[0.6rem] tracking-wider text-purple-accent/80">
            {mode.tagline}
          </p>
          <h3 className="font-mono text-sm text-cyan-accent mt-0.5 truncate">
            {mode.name}
          </h3>
          <p className="text-xs text-text-muted mt-1 line-clamp-2">
            {mode.description}
          </p>
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add sites/sector-zero-site/web/data/ sites/sector-zero-site/web/components/ModeCard.tsx
git commit -m "feat(sector-zero-site): add game mode data and ModeCard component"
```

---

### Task 4: MDX Content Pipeline

**Files:**
- Create: `sites/sector-zero-site/web/lib/posts.ts`
- Create: `sites/sector-zero-site/web/components/mdx/GameImage.tsx`
- Create: `sites/sector-zero-site/web/components/mdx/ModeTag.tsx`
- Create: `sites/sector-zero-site/web/components/mdx/Callout.tsx`
- Create: `sites/sector-zero-site/web/components/mdx-components.tsx`

- [ ] **Step 1: Create `lib/posts.ts`**

```typescript
import fs from "fs";
import path from "path";
import matter from "gray-matter";

const postsDirectory = path.join(process.cwd(), "content", "posts");

export interface PostFrontmatter {
  title: string;
  slug: string;
  date: string;
  tag: string;
  summary: string;
  heroImage: string;
}

export interface PostMeta extends PostFrontmatter {
  content: string;
}

export function getAllPosts(): PostMeta[] {
  const filenames = fs.readdirSync(postsDirectory).filter((f) => f.endsWith(".mdx"));

  const posts = filenames.map((filename) => {
    const filePath = path.join(postsDirectory, filename);
    const fileContents = fs.readFileSync(filePath, "utf-8");
    const { data, content } = matter(fileContents);

    return {
      ...(data as PostFrontmatter),
      content,
    };
  });

  return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getPostBySlug(slug: string): PostMeta | undefined {
  const posts = getAllPosts();
  return posts.find((post) => post.slug === slug);
}

export function getAllSlugs(): string[] {
  return getAllPosts().map((post) => post.slug);
}
```

- [ ] **Step 2: Create `components/mdx/GameImage.tsx`**

```tsx
import Image from "next/image";

interface GameImageProps {
  src: string;
  caption?: string;
  alt?: string;
}

export default function GameImage({ src, caption, alt }: GameImageProps) {
  return (
    <figure className="my-6 border border-border-hud overflow-hidden">
      <div className="relative w-full h-64">
        <Image
          src={src}
          alt={alt || caption || "Game screenshot"}
          fill
          className="object-contain bg-deep-lighter"
        />
      </div>
      {caption && (
        <figcaption className="px-3 py-2 font-mono text-xs text-text-muted border-t border-border-hud">
          // {caption}
        </figcaption>
      )}
    </figure>
  );
}
```

- [ ] **Step 3: Create `components/mdx/ModeTag.tsx`**

```tsx
interface ModeTagProps {
  children: React.ReactNode;
}

export default function ModeTag({ children }: ModeTagProps) {
  return (
    <span className="inline-block px-2 py-0.5 border border-purple-accent/30 text-purple-accent/80 font-mono text-[0.65rem] tracking-wider uppercase">
      {children}
    </span>
  );
}
```

- [ ] **Step 4: Create `components/mdx/Callout.tsx`**

```tsx
interface CalloutProps {
  children: React.ReactNode;
  label?: string;
}

export default function Callout({ children, label = "COMMANDER'S NOTE" }: CalloutProps) {
  return (
    <div className="my-6 border border-cyan-accent/20 bg-cyan-accent/5 px-4 py-3">
      <p className="font-mono text-[0.65rem] tracking-wider text-cyan-accent/60 mb-2">
        // {label}
      </p>
      <div className="text-sm text-text-primary">{children}</div>
    </div>
  );
}
```

- [ ] **Step 5: Create `components/mdx-components.tsx`**

```tsx
import GameImage from "@/components/mdx/GameImage";
import ModeTag from "@/components/mdx/ModeTag";
import Callout from "@/components/mdx/Callout";

export const mdxComponents = {
  GameImage,
  ModeTag,
  Callout,
};
```

- [ ] **Step 6: Commit**

```bash
git add sites/sector-zero-site/web/lib/ sites/sector-zero-site/web/components/mdx/ sites/sector-zero-site/web/components/mdx-components.tsx
git commit -m "feat(sector-zero-site): add MDX content pipeline with custom components"
```

---

### Task 5: Write 8 MDX Posts

**Files:**
- Create: `sites/sector-zero-site/web/content/posts/vertical-shooter.mdx`
- Create: `sites/sector-zero-site/web/content/posts/ground-run-and-gun.mdx`
- Create: `sites/sector-zero-site/web/content/posts/ship-boarding.mdx`
- Create: `sites/sector-zero-site/web/content/posts/first-person-raycaster.mdx`
- Create: `sites/sector-zero-site/web/content/posts/ship-turret.mdx`
- Create: `sites/sector-zero-site/web/content/posts/multi-phase-levels.mdx`
- Create: `sites/sector-zero-site/web/content/posts/rpg-systems.mdx`
- Create: `sites/sector-zero-site/web/content/posts/rpg-exploration.mdx`

**Reference:** Read the game's engine files for accurate details:
- `games/sector-zero/web/app/components/engine/gameEngine.ts` — vertical shooter
- `games/sector-zero/web/app/components/engine/groundEngine.ts` — ground run-and-gun
- `games/sector-zero/web/app/components/engine/boardingEngine.ts` — ship boarding
- `games/sector-zero/web/app/components/engine/firstPersonEngine.ts` — raycaster
- `games/sector-zero/web/app/components/engine/turretEngine.ts` — turret mode
- `games/sector-zero/web/app/components/engine/phaseTransition.ts` — multi-phase
- `games/sector-zero/web/app/components/engine/weapons.ts` — weapon affinity system
- `games/sector-zero/web/app/components/engine/bestiary.ts` — enemy database
- `games/sector-zero/web/app/components/engine/dialog.ts` — NPC dialog
- `games/sector-zero/web/app/components/engine/crewDialog.ts` — crew conversations
- `games/sector-zero/web/app/components/engine/cockpit.ts` — cockpit hub

**Tone:** 2-4 paragraphs per post, in-universe mission briefing style. Mix gameplay description with lore flavor. Include at least one `<GameImage>` per post.

- [ ] **Step 1: Create `content/posts/vertical-shooter.mdx`**

```mdx
---
title: "Vertical Shooter — The Original Campaign"
slug: vertical-shooter
date: 2026-03-15
tag: NEW MODE
summary: "8 worlds, 40 levels, and multi-phase bosses. The core Sector Zero experience."
heroImage: /images/modes/shooter.png
---

The UEC Vanguard's primary combat mode. Navigate through 8 hostile sectors in a vertical-scrolling assault, clearing 40 levels of enemy formations, asteroid fields, and environmental hazards. Each world introduces new enemy types with distinct attack patterns — from swarming drones to shielded cruisers.

<GameImage src="/images/modes/shooter.png" caption="Sector 3 — Navigating the Nebula Gauntlet" />

Every fifth level pits you against a multi-phase boss. These encounters escalate through distinct attack patterns — phase one might be a barrage of homing missiles, while phase three deploys shielded turrets and environmental traps. Defeating a world boss unlocks the next sector and rewards rare upgrade materials.

Between missions, return to the cockpit hub to spend credits on ship upgrades, equip consumables, and review intel in the codex. The vertical shooter is the backbone of Sector Zero — every other mode connects back to this campaign.
```

- [ ] **Step 2: Create `content/posts/ground-run-and-gun.mdx`**

```mdx
---
title: "Ground Run & Gun — Contra-Style Action"
slug: ground-run-and-gun
date: 2026-03-22
tag: NEW MODE
summary: "Boots on the ground. Contra-style side-scrolling with gravity, jumping, and hostile alien terrain."
heroImage: /images/modes/ground.png
---

Some missions require boots on the ground. Ground Run & Gun drops your pilot onto hostile planet surfaces in a Contra-style side-scrolling platformer. Full gravity physics, jumping, and directional shooting replace the zero-G freedom of space combat.

<GameImage src="/images/modes/ground.png" caption="Surface Assault — Ashfall Plateau" />

Four enemy types patrol the terrain: infantry patrols, armored jumpers, flying drones, and stationary turrets. Each demands a different approach — you can't just hold fire and push forward. Platforms crumble, hazards line the floor, and ammunition management matters more than in the cockpit.

Ground missions appear as planet-side objectives on the campaign map. Complete them to earn materials unavailable in space — surface minerals, salvaged alien tech, and intel fragments that unlock codex entries about the Kepler colonists' fate.
```

- [ ] **Step 3: Create `content/posts/ship-boarding.mdx`**

```mdx
---
title: "Ship Boarding — Top-Down Dungeon Crawler"
slug: ship-boarding
date: 2026-03-29
tag: NEW MODE
summary: "Breach enemy vessels. Navigate corridors, hack doors, and fight through line-of-sight AI defenders."
heroImage: /images/modes/boarding.png
---

When a crippled enemy capital ship drifts into range, the Vanguard docks and your pilot boards on foot. Ship Boarding is a top-down dungeon crawler — tight corridors, locked doors, and enemies with line-of-sight AI that hunt you through the ship's interior.

<GameImage src="/images/modes/boarding.png" caption="Boarding a Hollow Carrier — Deck 3" />

Three enemy types defend boarded vessels: patrol guards that follow fixed routes, alert responders that chase on sight, and heavy sentinels that anchor chokepoints. The AI uses line-of-sight detection — break line of sight around a corner and enemies lose track, creating opportunities for ambush or retreat.

Boarding missions reward rare salvage components and crew intel. Some ships contain encrypted data terminals that unlock bestiary entries or hint at the Hollow's origins. The deeper you push into Sector Zero, the more dangerous — and rewarding — these boardings become.
```

- [ ] **Step 4: Create `content/posts/first-person-raycaster.mdx`**

```mdx
---
title: "First-Person Raycaster — Wolfenstein Meets Space"
slug: first-person-raycaster
date: 2026-04-01
tag: NEW MODE
summary: "Wolfenstein-style 3D exploration with textured walls, billboard enemies, and hitscan combat."
heroImage: /images/modes/raycaster.png
---

Step into first-person view. The raycaster engine renders Wolfenstein-style 3D environments — textured walls, floor casting, and billboard sprite enemies — all running in the browser at 60fps via HTML5 Canvas.

<GameImage src="/images/modes/raycaster.png" caption="First-person exploration — Abandoned Station" />

Exploration missions use the raycaster for navigating alien structures, abandoned stations, and colony ruins. A gun HUD with hitscan combat handles close encounters. Billboard enemies face the camera at all times, scaling with distance for that authentic retro-FPS feel.

This mode also drives NPC interaction. Walk through settlements like Ashfall Forward Camp in first person, approach characters, and press Z to open dialog. The raycaster transforms Sector Zero from a pure shooter into something with real depth — you're not just flying through space, you're walking through the world the Kepler colonists left behind.
```

- [ ] **Step 5: Create `content/posts/ship-turret.mdx`**

```mdx
---
title: "Ship Turret — Star Wars Gunner Mode"
slug: ship-turret
date: 2026-04-03
tag: NEW MODE
summary: "Man the Vanguard's turret. Mouse-aim crosshair combat as enemies swoop from every direction."
heroImage: /images/modes/turret.png
---

Incoming hostiles on all vectors. Ship Turret mode puts you behind the Vanguard's main gun in a Star Wars-inspired gunner sequence. A cockpit frame surrounds your viewport while enemies — fighters, drones, and bombers — swoop in from every angle.

<GameImage src="/images/modes/turret.png" caption="Turret Defense — Wave 3 Incoming" />

Mouse-aim controls a precision crosshair against three enemy types across 5 escalating waves. Fighters make fast strafing runs, drones swarm in numbers, and bombers lumber in with devastating payload. Each wave ramps the pressure — miss too many bombers and hull integrity drops fast.

Turret sequences trigger during multi-phase missions when the Vanguard takes fire mid-transit. Survive all 5 waves and you earn bonus materials plus a hull integrity bonus that carries into the next mission phase.
```

- [ ] **Step 6: Create `content/posts/multi-phase-levels.mdx`**

```mdx
---
title: "Multi-Phase Levels — Modes That Chain Together"
slug: multi-phase-levels
date: 2026-04-05
tag: NEW MODE
summary: "Cinematic transitions chain different gameplay modes into epic multi-part missions."
heroImage: /images/modes/multiphase.png
---

The most ambitious missions don't stay in one mode. Multi-Phase Levels chain different gameplay modes via cinematic transitions — a vertical shooter assault might transition into a ship boarding sequence, then finish with a turret defense as you escape.

<GameImage src="/images/modes/multiphase.png" caption="Phase Transition — Shooter to Ground Assault" />

HP and loadout translate between phases. Take damage in the shooter phase and you start the boarding phase weakened. Consumables used in phase one are gone in phase two. This creates real tension — do you burn your shield boost early or save it for what's ahead?

Multi-phase missions reward the rarest materials in the game, including legendary-tier components needed for the highest prestige upgrades. They're the endgame challenge — where every mode you've mastered gets tested in sequence.
```

- [ ] **Step 7: Create `content/posts/rpg-systems.mdx`**

```mdx
---
title: "RPG Systems — Affinities, Leveling & Bestiary"
slug: rpg-systems
date: 2026-04-06
tag: RPG SYSTEMS
summary: "Weapon affinities, pilot leveling to 30, a combat skill tree, and a full enemy bestiary."
heroImage: /images/modes/shooter.png
---

Sector Zero isn't just about reflexes. Four weapon affinities — Kinetic, Energy, Incendiary, and Cryogenic — each deal amplified or reduced damage against 8 enemy classes. Equipping the right loadout for a mission means studying the bestiary and matching affinities to the enemies you'll face.

<GameImage src="/images/modes/shooter.png" caption="Weapon Affinity Matrix — Know Your Enemy" />

Your pilot levels from 1 to 30, earning passive stat bonuses and unlocking nodes in the Combat skill tree. Six skill nodes offer meaningful choices: faster fire rate vs. increased shield regen, wider spread vs. focused damage. Every level-up makes the next sector slightly more survivable.

The Bestiary catalogs every enemy encountered — complete with a rotating 3D sprite display, combat stats, affinity weaknesses, and lore entries. Some entries stay locked until you defeat an enemy a certain number of times or discover intel during boarding missions. It's an encyclopedia of the Hollow threat, built through gameplay.
```

- [ ] **Step 8: Create `content/posts/rpg-exploration.mdx`**

```mdx
---
title: "RPG Exploration — NPCs, Shops & Ashfall Camp"
slug: rpg-exploration
date: 2026-04-07
tag: RPG SYSTEMS
summary: "Walk through settlements in first person, talk to NPCs, trade at shops, and uncover the story."
heroImage: /images/modes/raycaster.png
---

Between combat missions, Sector Zero opens up. First-person exploration lets you walk through settlements, approach NPCs, and press Z to open multi-page dialog conversations. Each character has a name, a role, and something to say about the state of the sector.

<GameImage src="/images/modes/raycaster.png" caption="Ashfall Forward Camp — Commander Voss" />

Ashfall Forward Camp is the first explorable settlement — a forward operating base on a volcanic world. Five NPCs staff the camp: Commander Voss issues mission briefings, Doc Kael patches you up, Lt. Reyes handles logistics, a Survivor shares fragmented memories, and a Scavenger sells salvage at markup.

Merchant NPCs open shop interfaces where you can buy consumables and materials with credits earned in combat. Prices vary — some items are cheaper at outposts closer to the front line, while rare components only appear in deep-sector settlements. The exploration layer transforms Sector Zero from a pure action game into something with characters, economy, and a story worth following.
```

- [ ] **Step 9: Commit**

```bash
git add sites/sector-zero-site/web/content/
git commit -m "feat(sector-zero-site): add 8 initial MDX news posts"
```

---

### Task 6: News Feed & Post Pages

**Files:**
- Create: `sites/sector-zero-site/web/components/NewsItem.tsx`
- Create: `sites/sector-zero-site/web/app/news/page.tsx`
- Create: `sites/sector-zero-site/web/app/news/[slug]/page.tsx`

- [ ] **Step 1: Create `components/NewsItem.tsx`**

```tsx
import Link from "next/link";
import Image from "next/image";
import type { PostFrontmatter } from "@/lib/posts";

interface NewsItemProps {
  post: PostFrontmatter;
}

export default function NewsItem({ post }: NewsItemProps) {
  return (
    <Link href={`/news/${post.slug}`} className="block news-accent group">
      <div className="flex gap-4 items-start">
        <div className="w-20 h-20 relative flex-shrink-0 border border-border-hud overflow-hidden">
          <Image
            src={post.heroImage}
            alt={post.title}
            fill
            className="object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="font-mono text-[0.6rem] tracking-wider text-purple-accent/80 border border-purple-accent/30 px-1.5 py-0.5">
              {post.tag}
            </span>
            <span className="font-mono text-[0.6rem] text-text-muted">
              {post.date}
            </span>
          </div>
          <h3 className="font-mono text-sm text-cyan-accent group-hover:text-white transition-colors truncate">
            {post.title}
          </h3>
          <p className="text-xs text-text-muted mt-1 line-clamp-2">
            {post.summary}
          </p>
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Create `app/news/page.tsx`**

```tsx
import { getAllPosts } from "@/lib/posts";
import HudSection from "@/components/HudSection";
import NewsItem from "@/components/NewsItem";

export default function NewsPage() {
  const posts = getAllPosts();

  return (
    <HudSection label="TRANSMISSIONS">
      <h2 className="font-mono text-xl tracking-[0.2em] text-cyan-accent mb-8">
        NEWS & UPDATES
      </h2>
      <div className="space-y-6 max-w-3xl">
        {posts.map((post) => (
          <NewsItem key={post.slug} post={post} />
        ))}
      </div>
    </HudSection>
  );
}
```

- [ ] **Step 3: Create `app/news/[slug]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import Image from "next/image";
import Link from "next/link";
import { getPostBySlug, getAllSlugs } from "@/lib/posts";
import { mdxComponents } from "@/components/mdx-components";

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

interface PostPageProps {
  params: Promise<{ slug: string }>;
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <article className="py-12 px-6 max-w-3xl mx-auto">
      <Link
        href="/news"
        className="font-mono text-xs text-text-muted hover:text-cyan-accent transition-colors tracking-wider"
      >
        &larr; BACK TO TRANSMISSIONS
      </Link>

      <div className="mt-6 mb-4 flex items-center gap-3">
        <span className="font-mono text-[0.6rem] tracking-wider text-purple-accent/80 border border-purple-accent/30 px-1.5 py-0.5">
          {post.tag}
        </span>
        <span className="font-mono text-[0.6rem] text-text-muted">
          {post.date}
        </span>
      </div>

      <h1 className="font-mono text-2xl tracking-wider text-cyan-accent mb-6">
        {post.title}
      </h1>

      {post.heroImage && (
        <div className="relative w-full h-64 mb-8 border border-border-hud overflow-hidden">
          <Image
            src={post.heroImage}
            alt={post.title}
            fill
            className="object-contain bg-deep-lighter"
          />
        </div>
      )}

      <div className="prose prose-invert prose-sm max-w-none [&>p]:text-text-primary [&>p]:text-sm [&>p]:leading-relaxed [&>p]:mb-4">
        <MDXRemote source={post.content} components={mdxComponents} />
      </div>
    </article>
  );
}
```

- [ ] **Step 4: Verify news pages render**

```bash
cd sites/sector-zero-site/web && yarn dev
```

Visit `localhost:3000/news/` — should show all 8 posts in reverse chronological order.
Visit `localhost:3000/news/ship-turret/` — should show the full MDX-rendered post with hero image.

- [ ] **Step 5: Commit**

```bash
git add sites/sector-zero-site/web/components/NewsItem.tsx sites/sector-zero-site/web/app/news/
git commit -m "feat(sector-zero-site): add news feed and individual post pages"
```

---

### Task 7: Landing Page

**Files:**
- Modify: `sites/sector-zero-site/web/app/page.tsx`

- [ ] **Step 1: Build the full landing page**

Replace the placeholder `app/page.tsx`:

```tsx
import { getAllPosts } from "@/lib/posts";
import { GAME_MODES } from "@/data/modes";
import HudSection from "@/components/HudSection";
import ModeCard from "@/components/ModeCard";
import NewsItem from "@/components/NewsItem";
import CtaButton from "@/components/CtaButton";

export default function Home() {
  const recentPosts = getAllPosts().slice(0, 3);

  return (
    <>
      {/* Hero Section */}
      <section className="text-center py-20 px-6 bg-gradient-to-b from-purple-accent/10 to-transparent">
        <p className="hud-label mb-4">
          UEC VANGUARD // MISSION BRIEFING
        </p>
        <h1 className="font-mono text-4xl md:text-5xl font-bold tracking-[0.3em] text-cyan-accent mb-3">
          SECTOR ZERO
        </h1>
        <p className="font-mono text-sm text-text-muted mb-8 tracking-wider">
          8 Sectors. 6 Modes. One Hivemind.
        </p>
        <CtaButton
          href="https://colorpulse6.github.io/knicks-knacks/sector-zero/"
          external
        >
          PLAY NOW
        </CtaButton>
      </section>

      {/* Mode Cards */}
      <HudSection label="GAMEPLAY MODES">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl">
          {GAME_MODES.map((mode) => (
            <ModeCard key={mode.id} mode={mode} />
          ))}
        </div>
      </HudSection>

      {/* Latest Transmissions */}
      <HudSection label="LATEST TRANSMISSIONS" className="border-t border-border-hud">
        <div className="space-y-6 max-w-3xl mb-8">
          {recentPosts.map((post) => (
            <NewsItem key={post.slug} post={post} />
          ))}
        </div>
        <CtaButton href="/news">VIEW ALL UPDATES</CtaButton>
      </HudSection>
    </>
  );
}
```

- [ ] **Step 2: Verify landing page renders**

```bash
cd sites/sector-zero-site/web && yarn dev
```

Visit `localhost:3000/` — should show hero with "PLAY NOW" CTA, 6 mode cards in a 3-column grid, and 3 latest news items.

- [ ] **Step 3: Commit**

```bash
git add sites/sector-zero-site/web/app/page.tsx
git commit -m "feat(sector-zero-site): build full landing page with hero, modes, and news"
```

---

### Task 8: About Page

**Files:**
- Create: `sites/sector-zero-site/web/app/about/page.tsx`

- [ ] **Step 1: Create `app/about/page.tsx`**

```tsx
import { GAME_MODES } from "@/data/modes";
import HudSection from "@/components/HudSection";
import ModeCard from "@/components/ModeCard";

export default function AboutPage() {
  return (
    <>
      {/* The Story */}
      <HudSection label="THE STORY">
        <div className="max-w-3xl">
          <h2 className="font-mono text-xl tracking-[0.2em] text-cyan-accent mb-6">
            THE KEPLER EXODUS
          </h2>
          <div className="space-y-4 text-sm text-text-primary leading-relaxed">
            <p>
              In 2535, forty-seven colony ships launched toward the edge of known
              space. The Kepler Exodus — humanity&apos;s boldest leap. Two million
              souls chasing a new home. They never arrived. The region was sealed
              off and renamed: Sector Zero. For 312 years, no one went in.
            </p>
            <p>
              Then a signal started broadcasting from inside.
            </p>
            <p>
              Commander Voss, Lieutenant Reyes, and Doc Kael are the crew of the
              UEC Vanguard — sent to silence it. What they find is far worse than
              aliens: the Hollow are evolved humans, descendants of the Kepler
              colonists, merged into a collective consciousness over centuries of
              isolation.
            </p>
            <p className="text-text-muted italic">
              Two endings await. Destroy the Hollow Mind and restart the cycle.
              Or merge with it — breaking the cycle, but losing your humanity.
            </p>
          </div>
        </div>
      </HudSection>

      {/* Gameplay Modes */}
      <HudSection label="GAMEPLAY MODES" className="border-t border-border-hud">
        <h2 className="font-mono text-xl tracking-[0.2em] text-cyan-accent mb-6">
          6 WAYS TO FIGHT
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
          {GAME_MODES.map((mode) => (
            <ModeCard key={mode.id} mode={mode} />
          ))}
        </div>
      </HudSection>

      {/* Tech Stack */}
      <HudSection label="BUILT WITH" className="border-t border-border-hud">
        <div className="max-w-3xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: "HTML5 Canvas", detail: "2D rendering at 60fps" },
              { name: "Next.js 15", detail: "Static export for GitHub Pages" },
              { name: "TypeScript", detail: "30+ interfaces, strict mode" },
              { name: "React 19", detail: "UI layer and state management" },
            ].map((tech) => (
              <div key={tech.name} className="border border-border-hud p-3">
                <p className="font-mono text-xs text-cyan-accent">{tech.name}</p>
                <p className="text-[0.65rem] text-text-muted mt-1">{tech.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </HudSection>
    </>
  );
}
```

- [ ] **Step 2: Verify about page renders**

Visit `localhost:3000/about/` — should show story, 6 mode cards, and tech stack grid.

- [ ] **Step 3: Commit**

```bash
git add sites/sector-zero-site/web/app/about/
git commit -m "feat(sector-zero-site): add About page with story, modes, and tech stack"
```

---

### Task 9: Coming Soon Page

**Files:**
- Create: `sites/sector-zero-site/web/app/coming-soon/page.tsx`

**Reference:** Read `games/sector-zero/web/docs/colony-system-design.md` for accurate colony feature details.

- [ ] **Step 1: Create `app/coming-soon/page.tsx`**

```tsx
import HudSection from "@/components/HudSection";

const colonyFeatures = [
  {
    name: "Found Settlements",
    description: "Establish Outposts, grow them into Colonies, and fortify Strongholds on planet surfaces.",
  },
  {
    name: "Manage Resources",
    description: "Balance Food, Metal, Power, and Water to keep your colony alive and growing.",
  },
  {
    name: "Build & Expand",
    description: "16+ building types across Survival, Civilian, Military, and Advanced categories.",
  },
  {
    name: "Population & Happiness",
    description: "Colonists arrive, grow, and leave based on happiness. Keep them fed, safe, and housed.",
  },
  {
    name: "Defend Against Attacks",
    description: "Hollow raids and natural disasters threaten your colonies. Build defenses or lose everything.",
  },
  {
    name: "Earth Supply Lines",
    description: "Resupply shipments from Earth degrade the deeper you push into Sector Zero.",
  },
];

export default function ComingSoonPage() {
  return (
    <>
      <section className="text-center py-16 px-6 bg-gradient-to-b from-purple-accent/10 to-transparent">
        <p className="hud-label mb-4">
          CLASSIFIED // COLONY PROTOCOL
        </p>
        <h1 className="font-mono text-3xl md:text-4xl font-bold tracking-[0.3em] text-cyan-accent mb-3">
          COLONY MANAGEMENT
        </h1>
        <p className="font-mono text-sm text-text-muted tracking-wider">
          Coming Soon to Sector Zero
        </p>
      </section>

      <HudSection label="COLONY FEATURES">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
          {colonyFeatures.map((feature) => (
            <div key={feature.name} className="border border-border-hud p-4">
              <h3 className="font-mono text-sm text-cyan-accent mb-2">
                {feature.name}
              </h3>
              <p className="text-xs text-text-muted leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </HudSection>

      <HudSection label="INTEL PREVIEW" className="border-t border-border-hud">
        <div className="max-w-3xl">
          <div className="border border-cyan-accent/20 bg-cyan-accent/5 px-4 py-3">
            <p className="font-mono text-[0.65rem] tracking-wider text-cyan-accent/60 mb-2">
              // COMMANDER&apos;S NOTE
            </p>
            <p className="text-sm text-text-primary leading-relaxed">
              The Kepler colonists didn&apos;t just survive — they built. Ruins of
              their settlements dot every planet in Sector Zero. Now it&apos;s your
              turn. Found colonies, manage resources, and hold the line against
              the Hollow. But be warned: the further you push from Earth, the
              less help arrives.
            </p>
          </div>
        </div>
      </HudSection>
    </>
  );
}
```

- [ ] **Step 2: Verify coming soon page renders**

Visit `localhost:3000/coming-soon/` — should show classified header, 6 feature cards, and commander's note callout.

- [ ] **Step 3: Commit**

```bash
git add sites/sector-zero-site/web/app/coming-soon/
git commit -m "feat(sector-zero-site): add Coming Soon page with colony management teaser"
```

---

### Task 10: Curate Image Assets

**Files:**
- Create: `sites/sector-zero-site/web/public/images/modes/` (6 images)
- Create: `sites/sector-zero-site/web/public/images/` (placeholder structure)

**Source:** `games/sector-zero/web/public/sprites/`

- [ ] **Step 1: Create image directory structure**

```bash
mkdir -p sites/sector-zero-site/web/public/images/{modes,enemies,bosses,ui,colony}
```

- [ ] **Step 2: Copy and curate mode hero images**

Select representative sprites from the game assets. For each mode, pick the most visually distinctive asset:

```bash
# Shooter — use a background from a mid-game world
cp games/sector-zero/web/public/sprites/backgrounds/world3-bg.png sites/sector-zero-site/web/public/images/modes/shooter.png

# Ground — use the ground player idle or a surface background
cp games/sector-zero/web/public/sprites/ground/bg-surface-1.png sites/sector-zero-site/web/public/images/modes/ground.png

# Boarding — use a boarding texture or interior shot
cp games/sector-zero/web/public/sprites/boarding/wall-metal.png sites/sector-zero-site/web/public/images/modes/boarding.png

# Raycaster — use an explore texture
cp games/sector-zero/web/public/sprites/explore/wall-1.png sites/sector-zero-site/web/public/images/modes/raycaster.png

# Turret — use the space background or cockpit frame
cp games/sector-zero/web/public/sprites/turret/bg-space.png sites/sector-zero-site/web/public/images/modes/turret.png

# Multi-phase — use a boss or transition-related asset
cp games/sector-zero/web/public/sprites/backgrounds/world5-bg.png sites/sector-zero-site/web/public/images/modes/multiphase.png
```

**Note:** The exact filenames in `sprites/` may differ. The implementer should `ls` each sprite directory and pick the most visually representative image. The filenames above are best guesses — adjust based on what actually exists.

- [ ] **Step 3: Copy supporting assets**

```bash
# A few enemy sprites for post illustrations
cp games/sector-zero/web/public/sprites/enemies/drone*.png sites/sector-zero-site/web/public/images/enemies/ 2>/dev/null
cp games/sector-zero/web/public/sprites/enemies/fighter*.png sites/sector-zero-site/web/public/images/enemies/ 2>/dev/null

# A boss sprite
cp games/sector-zero/web/public/sprites/bosses/boss1*.png sites/sector-zero-site/web/public/images/bosses/ 2>/dev/null

# Cockpit UI elements
cp games/sector-zero/web/public/sprites/cockpit/cockpit-bg.png sites/sector-zero-site/web/public/images/ui/ 2>/dev/null
```

- [ ] **Step 4: Commit**

```bash
git add sites/sector-zero-site/web/public/images/
git commit -m "feat(sector-zero-site): curate game sprite assets for website imagery"
```

---

### Task 11: GitHub Actions Deployment

**Files:**
- Modify: `.github/workflows/deploy-games.yml`

- [ ] **Step 1: Read the current workflow**

```bash
cat .github/workflows/deploy-games.yml
```

Understand the exact structure before modifying.

- [ ] **Step 2: Add `sites/**` to trigger paths**

In the `on.push.paths` array, add `- 'sites/**'` alongside `- 'games/**'`.

- [ ] **Step 3: Add build step for sector-zero-site**

After the last game build step (Sector Zero), add:

```yaml
      - name: Build Sector Zero Site
        run: |
          cd sites/sector-zero-site/web
          yarn build
        env:
          NODE_ENV: production
          NEXT_PUBLIC_BASE_PATH: /knicks-knacks/sector-zero-site
```

- [ ] **Step 4: Add deploy copy step**

In the "Prepare deployment" step, add alongside the existing game copies:

```yaml
          cp -r sites/sector-zero-site/web/out ./deploy/sector-zero-site
```

- [ ] **Step 5: Verify build locally**

```bash
cd sites/sector-zero-site/web && NEXT_PUBLIC_BASE_PATH=/knicks-knacks/sector-zero-site yarn build
```

Expected: Build completes. `out/` directory created with static HTML files for all pages including `/news/[slug]/` routes.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/deploy-games.yml
git commit -m "ci: add sector-zero-site to GitHub Pages deployment workflow"
```

---

### Task 12: Documentation

**Files:**
- Create: `sites/sector-zero-site/web/CLAUDE.md`
- Create: `docs/sector-zero-site/README.md`

- [ ] **Step 1: Create `sites/sector-zero-site/web/CLAUDE.md`**

Write a development guide covering:
- Site purpose and URL
- Directory structure overview
- How to add a new news post (create MDX file with frontmatter, add image to `public/images/`)
- Styling conventions (color tokens, HUD label pattern, component usage)
- Available components (Nav, Footer, HudSection, ModeCard, NewsItem, CtaButton, MDX components)
- Build and deploy process
- Future features roadmap (playable embeds, comments, email)

- [ ] **Step 2: Create `docs/sector-zero-site/README.md`**

Write a vision document covering:
- Current state (v1 features)
- Future features with architectural notes:
  - Playable embeds: iframe or React canvas components
  - Comments: Giscus (GitHub Discussions) or third-party, client-side compatible
  - Email subscriptions: external service (Buttondown/Resend) with client-side form
- Design decisions and rationale

- [ ] **Step 3: Commit**

```bash
git add sites/sector-zero-site/web/CLAUDE.md docs/sector-zero-site/
git commit -m "docs(sector-zero-site): add CLAUDE.md dev guide and vision document"
```

---

### Task 13: Final Verification

- [ ] **Step 1: Clean build from scratch**

```bash
cd sites/sector-zero-site/web && rm -rf .next out && yarn build
```

Expected: Build succeeds with no errors. All pages generated.

- [ ] **Step 2: Verify all static routes generated**

```bash
ls -R sites/sector-zero-site/web/out/
```

Expected output should include:
- `index.html` (landing page)
- `news/index.html` (news feed)
- `news/vertical-shooter/index.html` (and all 7 other post slugs)
- `about/index.html`
- `coming-soon/index.html`

- [ ] **Step 3: Test with base path**

```bash
NEXT_PUBLIC_BASE_PATH=/knicks-knacks/sector-zero-site yarn build
```

Expected: Build succeeds. Check that `out/index.html` contains references to `/knicks-knacks/sector-zero-site/_next/` for assets.

- [ ] **Step 4: Run lint**

```bash
cd sites/sector-zero-site/web && yarn lint
```

Expected: No lint errors.

- [ ] **Step 5: Commit any final fixes**

If lint or build surfaced issues, fix and commit:

```bash
git add -A sites/sector-zero-site/web/
git commit -m "fix(sector-zero-site): address lint and build issues"
```

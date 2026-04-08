# Sector Zero Site — Vision Document

## What It Is

A static companion website for the Sector Zero game, serving as the public-facing home for news, mode documentation, and lore. Deployed to GitHub Pages alongside the game itself.

- **Site**: `https://colorpulse6.github.io/knicks-knacks/sector-zero-site/`
- **Game**: `https://colorpulse6.github.io/knicks-knacks/sector-zero/`

---

## Current State (v1)

The initial release ships four pages with a dark HUD aesthetic — deep navy backgrounds, cyan and purple accents, monospace labels — designed to feel like the game's own UI.

| Page | Content |
|---|---|
| Landing (`/`) | Hero section, game modes grid, news preview, play CTA |
| News (`/news`) | MDX-powered post index with tag filtering and hero images |
| About (`/about`) | Game overview, story premise, feature highlights |
| Coming Soon (`/coming-soon`) | Roadmap for future site features |

Posts are authored as `.mdx` files in `content/posts/` with frontmatter (title, date, tag, summary, heroImage) parsed by `gray-matter`. Custom MDX components (`GameImage`, `ModeTag`, `Callout`) make posts richer without raw HTML.

---

## Future Features

### Playable Embeds

Embed the game directly on the site via an iframe pointing at the GitHub Pages game URL, or by extracting the game's canvas component and importing it as a React dependency. The iframe approach ships faster; the React canvas approach allows deeper integration (e.g., launching into a specific mode from a news post about that mode).

### Comments (Giscus)

[Giscus](https://giscus.app/) maps GitHub Discussions to page URLs, giving each news post a comment thread backed by GitHub. No backend, no database — readers authenticate with GitHub. Drop the `<Giscus />` component into the post layout and configure the repo/category IDs.

This is the right fit for a static site with a developer audience. If broader reach matters later, a third-party embed (Disqus, Utterances) is a fallback.

### Email Subscriptions

A client-side subscription form (email input + submit) that POSTs to [Buttondown](https://buttondown.email/) or [Resend](https://resend.com/). No backend required — both services accept direct API calls from the browser with a public key. Display a success/error state in the component.

Subscribers receive an email when a new post goes live, triggered manually or via a webhook from the GitHub Actions deploy pipeline.

---

## Design Decisions

### Why Next.js?

The monorepo already uses Next.js for all web projects (BotBattle, RegExplain, games). Using it here keeps the toolchain consistent — same TypeScript config, same Tailwind setup, same deployment pattern. The static export (`output: 'export'`) makes GitHub Pages deployment straightforward.

### Why `sites/` Directory?

Sector Zero is a game (`games/sector-zero/`) — a self-contained Next.js app with its own game logic. The companion site is a different concern: marketing, news, documentation. Putting it in `sites/` makes that separation clear and avoids coupling the game build to the content site.

### Why MDX?

Plain Markdown would handle prose, but news posts need custom components: captioned screenshots (`GameImage`), tag pills (`ModeTag`), and callout boxes (`Callout`). MDX lets post authors use these components inline without touching layout code. `next-mdx-remote/rsc` handles rendering server-side with no client bundle cost.

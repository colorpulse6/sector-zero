# Contributing to Sector Zero

Thanks for your interest in contributing. Sector Zero is an open-source vertical space shooter — [play it here](https://colorpulse6.github.io/sector-zero/).

## Development Setup

```bash
git clone https://github.com/colorpulse6/sector-zero.git
cd sector-zero

# Game (runs on port 3000)
cd game && yarn install && yarn dev

# Companion site (runs on port 3001)
cd ../site && yarn install && yarn dev
```

Both apps are independent Next.js 15 projects. You don't need to run both unless you're working on the site.

## What We Accept (No Issue Required)

Go ahead and open a PR directly for:

- Bug fixes
- Performance improvements
- Code quality and refactoring
- Accessibility improvements
- Documentation updates

## What Needs an Issue First

Open an issue and discuss before submitting a PR for:

- New gameplay mechanics or modes
- Story, lore, or dialog changes
- Balance changes (HP, damage, drop rates, etc.)
- UI/UX redesigns
- New features (colony system, multiplayer, etc.)

This keeps effort from going to waste if the direction doesn't fit.

## Pull Request Process

1. Fork the repo and create a feature branch (`git checkout -b fix/my-fix`)
2. Make your changes
3. In the PR description, include:
   - What you changed and why
   - How you tested it
4. Submit the PR against `main`

Keep PRs focused — one logical change per PR is easier to review.

## Labels

| Label | Meaning |
|---|---|
| `good-first-issue` | Good entry point for new contributors |
| `help-wanted` | We'd welcome outside help on this |
| `needs-design-approval` | Needs discussion before implementation |
| `bug` | Something is broken |
| `enhancement` | New feature or improvement |

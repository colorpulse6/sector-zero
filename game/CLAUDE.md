# Sector Zero — Game Development Guide

## Overview

Sector Zero is a multi-genre space shooter built as a static Next.js web application. What started as a vertical-scrolling shooter has evolved into a multi-mode campaign with three combat modes plus first-person colony exploration and multi-phase chaining, RPG progression, and narrative depth.

## Tech Stack

- **Framework:** Next.js 15, React 19, TypeScript
- **Rendering:** HTML5 Canvas 2D (480×854, 60fps)
- **Export:** Static HTML for GitHub Pages (`output: 'export'`)
- **Tests:** Node test runner via tsx, Playwright browser specs, and `yarn build` static export

## Game Modes

| Mode | File | Description |
|------|------|-------------|
| Vertical Shooter | `gameEngine.ts` + `renderer.ts` | Original mode — 8 worlds, 40 levels, bosses |
| First-Person | `firstPersonEngine.ts` + `firstPersonRenderer.ts` | Raycaster (Wolfenstein/Doom-style) with NPCs |
| Ship Turret | `turretEngine.ts` + `turretRenderer.ts` | Star Wars gunner — crosshair aiming |
| Multi-Phase | `phases.ts` + `phaseTransition.ts` | Chains modes via transitions |

## Architecture

All engine code lives in `app/components/engine/`. The game loop dispatches by `currentMode` field on `GameState`:

```
updateGame() → if "first-person" → updateFirstPerson()
             → if "turret" → updateTurretEngine()
             → else → standard shooter update
```

Same pattern for rendering in `drawGame()`.

## Key Systems

- **Weapon Affinity:** 4 types (Kinetic/Energy/Incendiary/Cryogenic) × 8 enemy classes with damage multipliers
- **Pilot Leveling:** Levels 1-30, passive bonuses, Combat skill tree
- **Reward Economy:** 6 upgrades at 5 tiers, rare/legendary materials
- **Bestiary:** Enemy database with stats, affinities, lore
- **RPG Exploration:** NPCs in first-person mode with dialog and shops
- **Multi-Phase Levels:** Campaign levels chain different modes

## Canvas Constants

```
CANVAS_WIDTH = 480
CANVAS_HEIGHT = 854
GAME_AREA_HEIGHT = 714
DASHBOARD_HEIGHT = 140
```

## Input

```typescript
interface Keys {
  left, right, up, down, strafeLeft, strafeRight: boolean;
  shoot: boolean;  // Space (shooter) / Z,Shift (other modes)
  bomb: boolean;   // B key
  jump: boolean;   // Reserved legacy field, no active binding
}
```

Mouse tracking available via `mouseRef` for turret mode crosshair.

## Sprites

All sprites in `public/sprites/`. Registered in `sprites.ts` as path constants. Loaded via `getSprite(SPRITES.KEY)`. Sprite sheets use `ctx.drawImage()` 9-arg form for frame extraction.

## Save System

`save.ts` — localStorage with field-by-field migration (no schema version). `recalcPilotLevel()` called on every load.

## Development

```bash
yarn dev          # Dev server on localhost:3000
yarn build        # TypeScript compile + static export
```

Dev panel (`DevPanel.tsx`) has shortcuts for all modes: FIRST PERSON, TURRET, EXPLORE.

## Design Docs

- `docs/superpowers/specs/` — design specifications
- `docs/superpowers/plans/` — implementation plans
- `docs/superpowers/backlog/` — feature backlogs
- `docs/` — game design documents

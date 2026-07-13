# Playtest Checklist — post-audit + DOOM Phase 0 (for 2026-07-13)

## Launch

```bash
cd ~/Desktop/projects/sector-zero/game
NEXT_PUBLIC_DEVTOOLS=1 yarn build && npx serve@latest out
```

Open http://localhost:3000 (or the port serve prints). Hard-reload (⌘⇧R) to bust the
sprite cache — **65 sprites changed** this session. Backtick opens the DevPanel.

## 1. The look (the main event — your judgment call)

- Play 2–3 modes and toggle **DevPanel → POST FX → GRADE ON/OFF** repeatedly. The graded
  version should feel warmer, punchier, more oppressive — never illegible.
- **FIRST PERSON** (DevPanel): darkest scene in the game, HELL preset. Walls should be dim
  but readable. If it's too dark/too tame, note by how much — the knobs are in
  `game/app/components/engine/postFx/presets.ts` (blackPoint, contrast, tintStrength,
  bloomStrength, vignetteStrength per preset), hot-tunable with `yarn dev`.
- **Emissives** (plasma shots, explosions, the FP gun's cyan, lava sky) should visibly
  bloom; HUD text and the dashboard should NOT.
- **Sprites:** enemies/NPCs should no longer carry a white fringe or boxy gray fog
  (65 billboards were re-matted). Check a boss (its fire aura should survive) and the
  colony Quartermaster up close in FP.
- POST FX p50/p95 in the DevPanel should sit well under 6ms and stay ON.

## 2. Bug-fix verification (each was broken before)

- **Boarding (DevPanel → BOARDING):** walk into the reactor room via the new west-corridor
  door and finish the level; stand still next to a grunt — it must damage you now.
- **Turret (DevPanel → TURRET):** aim with ARROW KEYS only (mouse untouched) — must work;
  click-fire then release — firing must stop; clear all 5 waves — it must NOT freeze at
  "ALL CLEAR" (it should advance/complete); then launch TURRET again — waves must spawn
  on the second run.
- **Cockpit:** mouse-click STAR MAP — must open the star map (used to freeze).
- **Colony (DevPanel → COLONY SEEDS → DAY):** enter a building, exit — the exterior must
  NOT be mirror-flipped; compass must agree with the minimap.
- **Stuck keys:** hold an arrow key, ⌘Tab away and back — the ship must not keep drifting.
- **Pause during a boss fight** (ESC) — must pause and resume into the fight.
- **Ending choice screens accept mouse clicks** (if you reach them — keyboard also works).

## 3. Colony faction slice (new)

- COLONY SEEDS → DAY → walk to the **Quartermaster** → greeting should be neutral-toned;
  shop prices are the neutral baseline. (Allied discounts / hated refusal are covered by
  unit tests; an in-game standing editor is a future DevPanel nicety.)

## If something's off

`docs/audits/2026-07-12-full-game-audit.md` lists everything that changed + the deferred
backlog. Presets: `postFx/presets.ts`. Grade kill-switch: DevPanel A/B toggle.

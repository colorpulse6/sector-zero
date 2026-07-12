# Full-Game Audit — Findings & Fixes (2026-07-12)

**Method:** five parallel read-only audit agents (vertical shooter + turret · ground + boarding ·
FP raycaster + colony · HUD/UI/transitions · postFx layer), every finding re-verified at the
source before fixing. Gates per fix batch: `npx tsc --noEmit` + `yarn engine:test` (64/64) +
`yarn colony:test` (159/159) + `yarn build`, plus a prod-build Chrome playtest for the postFx
work. Baseline before any change: all green.

## Fixed this session (commits on `graphics/doom-overhaul`)

| Severity | Bug | Fix commit |
|---|---|---|
| HIGH | **Boarding level unwinnable** — reactor-core room (goal `G`) sealed by walls on all 4 sides, no door; its 2 guard enemies unreachable | `fix(boarding)` |
| HIGH | **Melee enemies dealt zero damage** unless a bullet was in flight — contact-damage loop was nested inside the bullet loop | `fix(boarding)` |
| HIGH | **Every alt-mode phase soft-locked on completion** — all four engines set `levelCompleteTimer=360` then freeze on it, but only shooter/boss paths decremented it. Extracted shared `tickLevelComplete()` called from all dispatches | `fix(engine)` |
| HIGH | **Turret unplayable on 2nd run per session** — wave defs were a mutated module singleton; counts hit 0 permanently. Moved to per-run `TurretState.waveQueue` | `fix(engine)` |
| HIGH | **Colony exterior mirror-flipped after leaving a building** — `exit_interior` reset dir but not the camera plane → projection determinant sign flip. Plane now resets with dir | `fix(engine)` |
| HIGH | **Shooter/turret ran ~2× speed on 120/144Hz displays** (raw per-rAF stepping, no dt scaling) — game loop now steps fixed 16.67ms ticks from an accumulator; also fixes all frameCount-driven animation rates | `fix(loop)` |
| HIGH | **Stuck keys after Alt-Tab/tab-switch** (keyup delivered elsewhere) — blur/visibilitychange now clears all held-input refs | `fix(input)` |
| HIGH | **Mouse-clicking STAR MAP in the cockpit froze the screen** — mouse path lacked the starmap special-case touch/keyboard had | `fix(input)` |
| LOW | Boarding: sentry fired at 2× rate (double fireTimer decrement); death-by-contact never respawned the player | `fix(boarding)` |
| LOW | Shooter: multi-bullet same-frame damage under-count (stale hp via enemyById); contact loop could cost a life + 2 HP in one frame (i-frames not re-checked) | `fix(engine)` |
| LOW | Ground: non-piercing bullet damaged every overlapping enemy (no break); fast-fall could tunnel through the 1-tile world floor at dtF=3 → infinite-fall soft-lock (falling collision now sweeps crossed rows) | `fix(engine)` |
| LOW | Diagonal movement +41% fast in shooter, FP walk, turret crosshair — normalized | `fix(engine)` |
| LOW | FP compass showed the OPPOSITE heading (formula shifted 4 of 8 slots); disagreed with minimap by 180° | `fix(engine)` |
| LOW | Turret HUD: dashboard HP bar read `player.hp` (always full) while damage hit `shipHp`; stale WAVE strip drawn in non-shooter modes | `fix(engine)` |
| LOW | Pause dead during boss fights (togglePause only mapped PLAYING) | `fix(engine)` |
| LOW | Turret keyboard aim dead (idle mouse stomped the crosshair every frame); mouse-fire latched on forever; ending DESTROY/MERGE + intro ignored mouse clicks | `fix(loop)` |
| LOW | `prismara-mid..png` double-dot filename — sprites.ts 404'd, Prismara's mid parallax layer never drew | `fix(sprites)` |

PostFx-layer findings (context loss, premultiplied-alpha violation, stale preset ref, GL state
hoisting, vignette clamp, untyped preset seam) were folded into the Tasks 5–7 build —
see `feat(postfx)`.

## Deferred backlog (verified real, not yet fixed — PERF/POLISH)

1. **PERF, sizeable:** keyboard + touch listeners re-subscribe 60×/s (`Game.tsx` effects depend
   on `gameState`, which changes every tick). Fix: read state via `gameStateRef` inside
   handlers, drop it from the dep arrays.
2. **PERF:** boarding per-frame allocations (`bullets.map` clone, per-frame radial gradient);
   turret renderer per-frame gradients + array sort; collision reclones `s.enemies` per hit.
3. **PERF:** fpRender inner loops re-read `tex.texels/w/hMask` per pixel — hoist to locals
   (matches the module's own convention; hottest loops in the game).
4. **POLISH:** ground player sprite offset ~8px from its 32×40 hitbox (visual only); all
   boarding enemy types render the grunt sprite; camera smoothing frame-rate dependent
   (`*0.1` unscaled — now moot at fixed 60 ticks, but still worth scaling);
   ESC from a cockpit sub-screen jumps to title instead of back to hub; held key leaks one
   phantom menu action on cockpit entry; ram-kills award no score and skip the bestiary;
   dormant piercing break in shooter collision (breaks piercing if ever enabled there).
5. **POLISH:** colony NPCs can stack on one tile (dusk plaza targets collide by
   `id % plazaTiles.length`); FP body radius not enforced perpendicular to motion (cosmetic
   corner clip, no tunneling — verified).
6. **CONTENT:** FP outdoor sky texture has a visible center seam (two mismatched halves) —
   pre-existing, unrelated to the grade; candidate for Layer B regen.
7. **DEVICE:** no devicePixelRatio handling — canvas soft on Retina (image quality only;
   pointer math correct). Deliberate for now: the postFx overlay assumes the fixed 480×854
   backing store; a DPR change must update both together.

## Sprite alpha census (drove the Task 8 allowlist)

Every billboard category has fully transparent corners but **5–41% semi-transparent
"wash" pixels** (AI-generation residue) — the boxy fog/halo seen in-game. Extremes:
scaffolding 41%, interiors/bunk 38% (+ a dirty corner alpha=112), bosses up to 36%,
boarding NPCs 26–33%. `effects/`, `bullets/`, `powerups/` glow is intentional — excluded
from remediation. Portraits are RGB PNGs (no alpha at all). Census script:
stdlib PNG decoder, scratchpad `png_alpha_stats.py` (not committed).

## Verification evidence (postFx playtest, prod build + Chrome)

- Grade + bloom render in FP; HUD legible; compass reads E at east-facing spawn.
- A/B toggle works both directions; auto-disable verified LIVE (3ms budget false-tripped at
  measured ~2.2ms p50 → budget raised to 6ms; after the fix: p50 0.10ms / p95 0.20ms, stays ON).
- First-cut HELL/TECHBASE presets crushed the raycaster's dark scenes → curves softened
  (register now comes from tint + bloom, not blackPoint/contrast).
- DevPanel requires `NEXT_PUBLIC_DEVTOOLS=1` at build time (plain `yarn build` excludes it —
  correct for deploys, remember it for local prod playtests).

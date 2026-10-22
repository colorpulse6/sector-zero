# Fighter polish captures

Frames from `/fighter-preview/` (real renderer, seeded random). `before/` is base
`dc35da2`; `after/` is `design/fighter-battle-polish`. Same scene and frame index
in both. `render-timing.json` holds `drawGame` p50/p95 (ms) from the after run.
Regenerate: `FIGHTER_CAPTURE_DIR=../docs/assets/fighter-polish/after yarn browser:test tests/browser/fighterPolish.spec.ts --project desktop-keyboard`.

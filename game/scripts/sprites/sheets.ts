/** Authoritative sprite-safety model for the asset pipeline (Phase 0 Task 8).
 *
 *  TWO LISTS, ALLOWLIST SEMANTICS:
 *   - SHEETS: every multi-frame atlas the engine slices by width division.
 *     These must NEVER be run through whole-image alpha matting or blind
 *     regeneration — frame math depends on exact pixel geometry.
 *   - MAT_ALLOWLIST: the explicit, inspected set of single-frame transparent
 *     billboards that alpha remediation (remat.ts) is allowed to touch.
 *     Anything not listed here is untouchable by the remat script. Built by
 *     inspection + a full alpha census (2026-07-12): every entry has fully
 *     transparent corners but 5–40% semi-transparent "wash" pixels — the
 *     AI-generation residue that reads as a boxy fog/halo in-game.
 *
 *  Paths are relative to game/public/sprites/. */

/** Width-divided atlases with their frame counts and the consuming code.
 *  `allowFractional` marks sheets whose width does not divide evenly by the
 *  frame count — the engine's subpixel drawImage tolerates it, but any
 *  REGENERATED replacement must land on an exact grid. */
export const SHEETS: ReadonlyArray<{
  path: string;
  frames: number;
  consumer: string;
  allowFractional?: true;
}> = [
  // NOTE: renderer.ts drawSideGunners (~:347) also slices SPRITES.PLAYER /3 —
  // the Phase 0 plan mis-attributed that site to escort-ship.png, which is
  // actually a single-frame billboard drawn whole by planetRenderer.ts:267
  // (verified 2026-07-12; the classify width-division gate caught it).
  { path: "ships/player.png", frames: 3, consumer: "renderer.ts drawPlayer (~:222) + drawSideGunners (~:347) + turretRenderer.ts (~:91)" },
  { path: "powerups/powerups.png", frames: 6, consumer: "renderer.ts (~:424) + dashboard.ts (~:213)" },
  { path: "boarding/tiles.png", frames: 3, consumer: "boardingRenderer.ts (~:38) + fpRender/textures.ts (~:106)" },
  { path: "ground/tiles.png", frames: 3, consumer: "groundRenderer.ts (~:67)" },
  { path: "boarding/gun-sheet.png", frames: 2, consumer: "firstPersonRenderer.ts FP gun (~:254)" },
  { path: "bullets/player-bullets.png", frames: 4, consumer: "weapons.ts (~:141)" },
  { path: "bullets/enemy-bullet.png", frames: 4, consumer: "weapons.ts (~:233)" },
  // 1536 / 7 = 219.43 — verified visually: really 7 frames on a fractional
  // grid (AI-gen). Works via subpixel sampling; regenerate at e.g. 1540 wide.
  { path: "effects/explosion.png", frames: 7, consumer: "particles.ts (~:152)", allowFractional: true },
];

/** Single-frame transparent billboards approved for BiRefNet remat.
 *
 *  Excluded on purpose (do NOT add without re-inspection):
 *   - effects/* — the glow IS the asset; matting would delete it
 *   - turret/crosshair.png — thin lines, matting destroys them
 *   - turret/bg-space.png, turret/cockpit-frame.png — full-screen overlays
 *     with intentional semi-transparent regions
 *   - ground/bg-*.png — parallax layers with intentional alpha gradients
 *   - walls/, environment/, explore floors/walls/sky — opaque tiles
 *   - portraits/ — no alpha channel at all (RGB PNGs)
 *   - backgrounds/, map/, cockpit/, ending/ — opaque or UI art
 *   - everything in SHEETS above */
export const MAT_ALLOWLIST: ReadonlyArray<string> = [
  // Vertical-shooter enemies (5–18% semi-transparent wash)
  "enemies/bomber.png",
  "enemies/cloaker.png",
  "enemies/drone.png",
  "enemies/echo.png",
  "enemies/elite.png",
  "enemies/gunner.png",
  "enemies/mine.png",
  "enemies/mirror.png",
  "enemies/scout.png",
  "enemies/shielder.png",
  "enemies/swarm.png",
  "enemies/turret.png",
  "enemies/wraith.png",
  // Bosses (up to 36% semi) — spot-check after remat: auras may be intentional
  "bosses/beacon.png",
  "bosses/cindermaw.png",
  "bosses/glacius.png",
  "bosses/hollow-mind.png",
  "bosses/nyxar.png",
  "bosses/reflection.png",
  "bosses/revenant.png",
  "bosses/rockjaw.png",
  // Boarding/FP billboards (the halo problem is most visible here — drawn
  // large by the raycaster; kael/reyes/scavenger/survivor are 26–33% semi)
  "boarding/npc-kael.png",
  "boarding/npc-reyes.png",
  "boarding/npc-scavenger.png",
  "boarding/npc-survivor.png",
  "boarding/npc-voss.png",
  "boarding/enemy-fp-death.png",
  "boarding/enemy-fp-flinch.png",
  "boarding/enemy-fp-front.png",
  "boarding/enemy-grunt-attack.png",
  "boarding/enemy-grunt-idle.png",
  "boarding/player-down.png",
  "boarding/player-left.png",
  "boarding/player-right.png",
  "boarding/player-up.png",
  // Turret-mode enemies
  "turret/enemy-bomber.png",
  "turret/enemy-drone.png",
  "turret/enemy-fighter.png",
  // Explore (Ashfall camp) FP props
  "explore/scrapyard-outpost-landmark-rig.png",
  "explore/scrapyard-outpost-prop-antenna.png",
  "explore/scrapyard-outpost-prop-barrel.png",
  "explore/scrapyard-outpost-prop-cable-spool.png",
  "explore/scrapyard-outpost-prop-crates.png",
  "explore/scrapyard-outpost-prop-lamp.png",
  "explore/scrapyard-outpost-prop-signpost.png",
  "explore/scrapyard-outpost-prop-terminal.png",
  // Colony interiors (48px — TINY; BiRefNet is least reliable here, dimension
  // guard + spot-check mandatory; bunk.png has a dirty corner alpha=112)
  "interiors/bunk.png",
  "interiors/farm-crate.png",
  "interiors/purifier-pump.png",
  "interiors/solar-panel.png",
  // Props
  "props/scaffolding.png",
  // Escort mission ship — single-frame billboard (planetRenderer.ts:267),
  // 8% semi-transparent wash
  "ships/escort-ship.png",
  // Ground run-and-gun (single-frame player poses + enemies)
  "ground/enemy-flyer.png",
  "ground/enemy-jumper.png",
  "ground/enemy-patrol.png",
  "ground/enemy-turret.png",
  "ground/player-hurt.png",
  "ground/player-idle.png",
  "ground/player-infantry.png",
  "ground/player-jump.png",
  "ground/player-run-1.png",
  "ground/player-run-2.png",
  "ground/player-run-3.png",
  "ground/player-run-4.png",
  "ground/player-shoot.png",
];

export type SpriteClass = "sheet" | "allowlisted-billboard" | "other";

const SHEET_PATHS = new Set(SHEETS.map((s) => s.path));
const ALLOW_SET = new Set(MAT_ALLOWLIST);

/** Classify a sprite path (relative to public/sprites/). Pure — unit-tested. */
export function classifyPath(relPath: string): SpriteClass {
  if (SHEET_PATHS.has(relPath)) return "sheet";
  if (ALLOW_SET.has(relPath)) return "allowlisted-billboard";
  return "other";
}

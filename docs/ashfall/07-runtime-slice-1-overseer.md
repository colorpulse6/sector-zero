# 07 — Runtime slice 1: the Ashfall Overseer (presentation + factual lines)

Date: 2026-10-18. Lane: Claude Ashfall Designer, worktree `design/ashfall-lock`, runtime
baseline `30b0726`. Manager brief: `docs/handoffs/2026-10-18-ashfall-runtime-milestone.md`
(on `feat/galaxy-colony`). Labels: SOURCE-REVIEWED / PRIOR EVIDENCE / PROPOSED as in the
README, plus **RAN** for commands I executed in this worktree with the output recorded below.

## What changed (smallest cohesive change)

| File | Change |
| --- | --- |
| `game/app/components/engine/sprites.ts` | Two keys: `NPC_ASHFALL_OVERSEER` → `/sprites/boarding/npc-hub-governor.png`, `PORTRAIT_ASHFALL_OVERSEER` → `/sprites/portraits/hub-governor.png`. Existing, production-reviewed files; no pixels added or edited. |
| `game/app/components/colony/exploration/npc/colonyNpcs.ts` | `ASHFALL_PRIMARY_COLONY_ID` + `isAshfallPrimary`; the governor NPC at Ashfall Primary uses the Overseer billboard and the Overseer dialog; optional `options.buildSpecs` seam. Name stays the role label `Overseer Ashfall Primary`. Every other colony is byte-identical (Voss billboard, Voss atlas, Governor lines). |
| `game/app/components/colony/exploration/npc/npcDialog.ts` | `buildGovernorDialog(colony, rank, context?)`. With `{ place: "ashfall-primary" }` it returns the Overseer lines (speaker `Overseer`, portrait key on every line). Without a context the legacy readout is unchanged. |
| `game/tests/colony/npcDialog.test.ts`, `game/tests/colony/colonyNpcs.test.ts` | 10 + 5 focused tests: Ashfall lines, singular/plural, cold/neutral/warm, threats, build-spec seam, id pin, static actor, determinism, legacy isolation. |
| `game/tests/sprites/ashfallOverseerAssets.test.ts` | Registry pinned to the M3 manifest's reviewed hub-governor files; 128×256 RGBA billboard, 512² portrait under `/sprites/portraits/`; no actor atlas claims the billboard. |
| `game/tests/browser/ashfallOverseer.spec.ts` | Isolated keyboard spec on the shipped `galaxyAtAshfall` fixture: descend, walk to the plaza, talk; asserts the decoded billboard, the drawn portrait, the rendered lines and unchanged save bytes. No shared fixture or spec edited. |

## Why the registry keys are not the manifest's constants

`tests/sprites/m3HubAssets.test.ts` (not mine) asserts that the marketplace and town-hall
bundle constants (`NPC_HUB_GOVERNOR`, `PORTRAIT_HUB_GOVERNOR`) are **not** registered in
`SPRITES` until those hubs ship. The brief asks for exactly these two files as the Ashfall
Overseer now. I registered the same files under Ashfall role keys, which keeps that gate
green and makes the reuse explicit. `ashfallOverseerAssets.test.ts` pins both keys to the
manifest's `hub-governor` paths and status `production-reviewed`, so the provenance is
checked rather than implied. **Manager decision:** keep the role keys (recommended; the
Town Hall slice can alias or rename later) or relax the manifest gate in its own files.

## Why the actor is static, and how that is proven

`resolveNpcActorSet` (actorAssets.ts, not edited) maps billboard paths to actor atlases;
`NPC_VOSS` → the Voss humanoid atlas. The new path has no entry, so `initializeNpcPresentation`
sets no `atlasAnimation`, `syncActorAssets` never requests `/sprites/actors/voss/` for the
Overseer, and `SceneBuilder` draws `resolveNpcSprite(n)` = the static hub-governor billboard
(SOURCE-REVIEWED in `sceneInput.ts`). Unit tests assert `atlasAnimation === undefined` and
`resolveNpcActorSet(...) === undefined` at Ashfall and `"voss"` everywhere else; the browser
spec asserts the hub-governor PNG was decoded for the scene and no Voss atlas image was drawn.

## The Overseer's lines (all from `ColonyState`; portrait on every line)

| Line | Source | When |
| --- | --- | --- |
| greeting (cold / neutral / warm) | `GOVERNOR_GREETINGS[greetingTone(rank)]`, unchanged words | always |
| population trend | `populationLine`, unchanged | always |
| `No buildings yet. The yard's empty.` / `… The yard's holding N metal.` | `buildings.length === 0`, `resources.metal` | zero buildings |
| `A solar array takes 80 metal and 1 cycle to raise.` | `buildSpecs.solar_array` (`BUILD_SPECS` shape) | zero buildings **and** a catalogue was passed |
| `The solar array's going up. One more cycle and it's live.` / `… N cycles to go.` | `status === "constructing"`, `buildProgressCycles` (counts down in `cycleProcessor`) | an array exists |
| `The solar array's online. 10 power on the grid, nothing drawing on it yet.` / `…, N drawn.` | `derivePowerGrid(colony)` | array operational |
| `One building on the books, and it's still going up.` / `N buildings on the books: a operational, b going up, c down.` | status counts | roster without a lone array |
| `The yard's empty.` / `The yard's holding N metal.` | `resources.metal` | roster non-empty |
| happiness; threats | unchanged builders | always; when present |

Nothing says where the metal came from, and nothing promises trade, a mast, housing or
resupply. No personal names. Lines stay under 150 characters (portrait layout budget).

## BUILD_SPECS compatibility

Colony's `colony/shared/colonyCatalog.ts` (`BUILD_SPECS`, on `feat/galaxy-colony` since
`9deebc5`) does not exist on this branch. `npcDialog.ts` therefore declares a structural
twin (`BuildSpecLike`: `{ cost?: { metal? }, cyclesToBuild }`) and takes it as an optional
input; nothing on this branch duplicates the numbers. **Integration (one line, Colony's
file):** in `colony/exploration/index.ts` pass `{ buildSpecs: BUILD_SPECS }` as the fifth
argument of `generateColonyNpcs`. Until then the cost line is simply absent.

## Verification

- **RAN** `tsc --noEmit -p tsconfig.json`: clean, before and after the change.
- **RAN** `tsx --test tests/colony/*.test.ts`: 384 pass. `tests/engine/*.test.ts`: 571 pass.
  `tests/sprites/*.test.ts`: 14 pass (baseline 951 total; now 969).
- Dependencies: no install. `game/node_modules` is an untracked, git-ignored symlink to the
  main checkout's existing `node_modules` (same lockfile).
- **RAN** `next build` static export: exit 0 (details in the next section).
- Browser: see the next section.

## Browser evidence

**RAN** on 2026-10-18 in this worktree, all three with exit 0 and no page errors:

| Step | Result |
| --- | --- |
| `next build` (Node 20.20.1, existing dependencies, no install) | static export to `game/out`, 8 pages, exit 0, 1 min 40 s |
| `playwright test ashfallOverseer --project desktop-keyboard` against `game/out` served by `python3 -m http.server` on a loopback port, through a `/tmp` override of the repo config (no `next dev`, no watcher; the repo config is untouched) | 1 passed (14.6 s and 18.1 s on two runs) |
| First run of the same spec | failed on my own byte baseline, read before the app's load normalisation (`unlockedCodex: ["intel-briefing"]`); the spec now reads the baseline after CONTINUE GALAXY, as `galaxyColony.spec` does. Test-only fix, no runtime change. |

What the spec asserted (see `captures/2026-10-18-overseer-observations.json`):

- spawn at (11.5, 22.5); walk north to y ≈ 13.1; prompt `[Z] Talk to Overseer Ashfall Primary` rendered;
- `/sprites/boarding/npc-hub-governor.png` decoded for the scene; no `/sprites/actors/voss/` image drawn;
- dialog speaker `Overseer`, greeting line, then `No buildings yet. The yard's empty.`; `/sprites/portraits/hub-governor.png` drawn; no `Governor:` label, no proposed names;
- Legacy-domain bytes and the whole installed save byte-identical before and after the visit.

Viewport captures (1280×900 page, game canvas 480×854 inside), stored under `captures/`:

| File | Shows |
| --- | --- |
| `2026-10-18-overseer-arrival.png` | arrival frame from the pad: Quartermaster and SUPPLY STATION ahead; the Overseer is not in this frame (plaza centre is eleven tiles north and one tile left of the pad axis) |
| `2026-10-18-overseer-approach.png` | the Overseer at the plaza as the static hub-governor billboard, `?` marker, the interact prompt with the full role label |
| `2026-10-18-overseer-dialog-yard.png` | the dialog box: hub-governor portrait, speaker `Overseer`, `No buildings yet. The yard's empty.`, page 3 / 4 |

Observation, pre-existing and not changed here: the floating name tag is centred on the
billboard, so with the Overseer at the left screen edge the tag reads `…Ashfall Primary` with
`Overseer` clipped off-canvas; the prompt and the dialog speaker carry the full role label.

Reproduce (any machine with the repo's dependencies; replace the port):

```bash
cd game && ./node_modules/.bin/next build
cat > /tmp/pw-ashfall-static.config.ts <<'EOF'
import baseConfig from "<abs>/game/playwright.config";
import { defineConfig } from "<abs>/game/node_modules/@playwright/test";
const port = 58420; const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({ ...baseConfig, testDir: "<abs>/game/tests/browser", use: { ...baseConfig.use, baseURL },
  webServer: { command: `python3 -m http.server ${port} --bind 127.0.0.1 --directory <abs>/game/out`, url: baseURL, reuseExistingServer: false, timeout: 60_000 } });
EOF
./node_modules/.bin/playwright test --config /tmp/pw-ashfall-static.config.ts ashfallOverseer --project desktop-keyboard --workers=1 --retries=0
```

## Not in this slice (by brief)

Quartermaster portrait, Relay Mast art or state, exchange/market, clock change, personal
names or backstory, save schema or balance changes, Town Hall registration. Next small asset
slice: the Quartermaster portrait derivative (03 Kit C3, candidate already on the board) as a
`portraitKey` on `buildQuartermasterDialog` lines, same pattern as this slice.

## Handback

Owned paths touched: the six files above plus this document and the README index row.
Nothing in `Game.tsx`, `galaxyColony.ts`, projection/run, management UI, shared fixtures or
specs, `docs/ROADMAP.md` or handoffs. Local commit only; nothing pushed or merged. No memory
or settings writes.

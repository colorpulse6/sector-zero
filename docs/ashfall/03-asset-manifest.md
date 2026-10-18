# 03 — Asset manifest: bounded first kit

Every entry names its exact runtime consumer on `30b0726` (SOURCE-REVIEWED). Sizes are direct
file measurements made this turn (`sips`, `magick`); that is a file check, not gameplay evidence.
No file was added under `game/public` and `sprites.ts` was not edited; registration is the
Manager's integration step. The reference board uses short two-line display labels; the label →
file table is in `boards/README.md`.

## Runtime slot constraints (from source)

| Slot kind | Constraint | Fallback when missing | Source |
| --- | --- | --- | --- |
| Tile (wall, floor, ceiling, facade) | square, power of two; decoded to 256² with mips | flat blue-grey `#3a4a5a` tile until load | `fpRender/textures.ts` TILE_SIZE, FALLBACK |
| Sky | panorama up to 2048×512 at decode; current 1774×887 accepted | dark navy | same, SKY_W/H |
| Prop billboard | ≤ 512 native, RGBA, square canvas, subject on the bottom edge | transparent (prop not drawn) | same, BILLBOARD_MAX; m3-hubs contract |
| Actor atlas cell | 128×256 humanoid; idle 4×8, walk 8×8 columns×rows | static `sprite` path | `actorAssets.ts` ACTOR_CATALOG |
| Static NPC billboard | 128×256 RGBA (Voss legacy 1024×1536 also works) | colour billboard | `FPNPC.sprite`, `color` |
| Portrait | square; path must begin `/sprites/portraits/` and be a `SPRITES` key | text-only dialog layout | `fpDialogLayout.ts` |
| Point light | `{x, y, color, power}`; inverse-square; emitted only 20:00–06:00 | none | `colonyLayout.ts`, `lighting.ts` |
| Facade wall | 64² (cantina, marketplace, town-hall) or 512² (five utilities) | tile fallback | `BUILDING_FOOTPRINTS` |

## Kit A — reuse as-is (no change, no review needed)

| `SPRITES` key | Path | Size | Consumer |
| --- | --- | --- | --- |
| `EXPLORE_OUTPOST_SKY` | `/sprites/explore/scrapyard-outpost-sky.png` | 1774×887 | `generateExteriorState` `environmentArt.skySprite` |
| `EXPLORE_OUTPOST_GROUND` | `/sprites/explore/scrapyard-outpost-ground.png` | 1254² | `environmentArt.floorSprite` |
| `EXPLORE_OUTPOST_WALL_EXTERIOR` | `/sprites/explore/scrapyard-outpost-wall-exterior.png` | 1024² | `environmentArt.wallSprite` (perimeter) |
| `COLONY_LANDING_PAD` | `/sprites/environment/landing-pad.png` | 512² | `floorTextureMap` pad tiles |
| `COLONY_FOUNDATION` | `/sprites/environment/foundation.png` | 512² | `floorTextureMap` constructing footprints |
| `COLONY_SCAFFOLDING` | `/sprites/props/scaffolding.png` | 512² RGBA | `props` while constructing |
| `COLONY_WALL_SOLAR/FARM/PURIFIER/HABITAT/MINE` | `/sprites/walls/*.png` | 512² | `BUILDING_FOOTPRINTS[type].wallSpriteId` |
| `COLONY_WALL_CANTINA` | `/sprites/walls/cantina.png` | 64² | same |
| `QUARTERMASTER_WORKSTATION` | `/sprites/pilot/quartermaster/workstation.png` | 512² | `enterColonyExploration` prop id −100, label SUPPLY STATION |
| quartermaster `idle/walk/work` | `/sprites/pilot/quartermaster/*.png` | 512×2048, 1024×2048 ×2 | `ACTOR_CATALOG.quartermaster` |
| `NPC_QUARTERMASTER` (+ walk 1/2) | `/sprites/boarding/npc-quartermaster*.png` | 128×256 | static fallback for the atlas |
| `NPC_SURVIVOR`, `NPC_SCAVENGER` + atlases | `/sprites/boarding/`, `/sprites/actors/` | 128×256 | colonists |
| `NPC_VOSS` + atlas | `/sprites/boarding/npc-voss.png`, `/sprites/actors/voss/` | 1024×1536 | Overseer today (replaced by Kit B1 if D1 = a) |
| `WORLD_*` utility interiors, `INTERIOR_*` props, `HUB_CANTINA_*` bundle, `NPC_HUB_*` ×3, `PORTRAIT_HUB_*` ×3 | as registered | 512² / 256² / 128×256 | interiors and cantina |

## Kit B — register existing reviewed art (no new pixels)

| # | Proposed key | Path (exists) | Size | Consumer | State variants | Fallback |
| --- | --- | --- | --- | --- | --- | --- |
| B1 | `NPC_HUB_GOVERNOR` | `/sprites/boarding/npc-hub-governor.png` | 128×256 RGBA | `colonyNpcs.ts` governor `sprite` (replaces `NPC_VOSS`) | none; static billboard (no atlas on disk, so no walk clip; acceptable because the galaxy walk pins the Overseer at her post) | colour billboard `#e8c060` |
| B2 | `PORTRAIT_HUB_GOVERNOR` | `/sprites/portraits/hub-governor.png` | 512² | `buildGovernorDialog` lines `portraitKey` | none | text-only layout |

Later slices (not in this kit): the marketplace bundle (wall/floor/ceiling 512², five 256² props,
64² facade, three billboards, three portraits) and the town-hall bundle are on disk, reviewed and
unregistered. The salvage branch `feat/m3-marketplace-runtime` at `289f4eb` already holds the
registration diff for the marketplace keys and the `widthFactor` prop change; reuse that diff
when the Marketplace slice is scheduled rather than retyping it.

## Kit C — first-slice new or derivative assets (three files)

| # | Proposed key | Path | Spec | Consumer | State | Source and method | Fallback | Acceptance check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C1 | `ASHFALL_RELAY_MAST_LIT` | `/sprites/props/ashfall-relay-mast-lit.png` | 512² RGBA, subject on bottom edge, vertical mast with lamp head and two guy-lines, gunmetal + rust, ember lamp with painted halo | `generateExteriorState` new prop at (10.5, 6.5), scale ≈ 1.8, label RELAY MAST | shown while `op:ashfall-sortie` is not complete | to be produced through the approved pipeline (Blender world kit under `docs/assets/graphics-rollout/world/` or the image pipeline) after direction acceptance; **not generated this turn** | prop absent | reads as a vertical at 48 px; mean colour within the cool surface band; lamp is the only warm pixel cluster |
| C2 | `ASHFALL_RELAY_MAST_DARK` | `/sprites/props/ashfall-relay-mast-dark.png` | identical silhouette, lamp unlit | same slot | shown once `ashfall_sortie_complete` exists | derived from C1 by painting out the lamp | prop absent | pixel-identical silhouette to C1 |
| C3 | `PORTRAIT_QUARTERMASTER` | `/sprites/portraits/quartermaster.png` | 512² opaque, dark backdrop | `buildQuartermasterDialog` lines `portraitKey` | none | derivative of `docs/assets/pilot/quartermaster-hero-v1.png` (approved pilot source); candidate at `boards/candidates/quartermaster-portrait-candidate.png`; needs green-fringe cleanup at hair and shoulder | text-only layout | face matches the atlas identity side by side at 88 px |

Provenance: C1/C2 are new assets and need the pipeline's source, review sheet and manifest
entry as the m3-hubs contract requires. C3 reuses an approved source under its existing record in
`docs/assets/pilot/README.md`.

## Kit D — deferred, with reasons

| Asset | Why not now |
| --- | --- |
| Grounded lander hull prop (wide 512² RGBA at tiles 2..3 × 12..13) | second landmark competes with the mast; wait until the mast is accepted in play |
| Ashfall perimeter wall variant (512² tile) | current frame passes the register (D6) |
| Plaza paving tile (512²) | the pixel-graphics spec left it pending; plaza reads fine as ground |
| Relay Tech NPC identity (billboard + portrait) | a third named NPC needs a runtime slot the generator does not have |
| Marketplace / Town Hall registration | separate slices; salvage diff exists |
| Night variants of any facade | the galaxy walk stays at 07:00 through GC2-A; night is a later slice (D4) |

## What changes in code for Kit B and C (for Manager; not edited here)

- `sprites.ts`: five keys (B1, B2, C1, C2, C3).
- `colonyNpcs.ts`: governor `sprite` → `NPC_HUB_GOVERNOR`; `npcDialog.ts`: `portraitKey` on
  Overseer and Quartermaster lines.
- `colonyLayout.ts` `generateExteriorState`: one prop keyed on an input the orchestrator derives
  from the run (sortie complete or not). The function today takes `(colony, gameClock)`; the
  cleanest additive shape is an optional third argument `{ relayMast: "lit" | "dark" | "none" }`
  so legacy callers are unchanged.
- No save, reducer, travel or economy change for any Kit B/C item.

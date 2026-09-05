# M3 Hubs — Asset Production Contract

**Date:** 2026-07-18
**Status:** Approved execution contract for the M3 asset lane
**Order:** Cantina → Marketplace → Town Hall

This pack turns M3 art into a repeatable production lane rather than a late polish pass.
It governs static assets only. It does not decide colony tier promotion, district growth,
hub gameplay rules, bulletin-board state, interior layouts, or NPC simulation depth.

Read before generating:

1. `../doom/00-master-style-guide.md` — authoritative visual language.
2. `../../2026-07-12-asset-pipeline-free-options.md` — generation, alpha, and style-lock pipeline.
3. `01-environments.md` — copy-ready environment prompts.
4. `02-npcs.md` — identity-pair prompts and role briefs.
5. `03-review-and-integration.md` — acceptance and runtime registration gates.

## Non-negotiable runtime facts

- The game is a static export. No model or asset-generation service runs in the browser.
- Hub art lands as reviewed PNG derivatives under `game/public/sprites/`.
- `game/app/components/engine/sprites.ts` is the runtime path registry.
- Opaque raycaster textures must be square and power-of-two.
- Most Phase-1 exterior building walls are 64×64; the generated mine is a valid 512×512
  exception. M3 facade derivatives deliberately standardize on 64×64, while hub interior
  textures use 512×512.
- Existing FP NPC billboards are 128×256. Dialog portraits are square.
- Current FP props render on a square billboard plane. Every M3 prop therefore uses a
  square 256×256 transparent canvas; wide/tall silhouettes live inside that square with
  transparent padding. Non-square prop planes require a separate renderer/data design.
- Atlas sheets are width-divided; M3 hub assets are single-frame files. Do not add them to
  `SHEETS` unless a later consumer truly slices them by width.
- `MAT_ALLOWLIST` in `game/scripts/sprites/sheets.ts` is a remediation allowlist, not a
  general sprite registry. A clean new billboard does not belong there automatically.
- All new art keeps the existing color-tint fallback until an accepted derivative is
  present and registered.

## Prompt precedence for transparent billboards

For M3 props and NPC billboards, the flat-green and no-cast-shadow instructions in this
pack override the master guide's generic `dark background separation` and painted contact-
shadow language. Preserve believable ground contact by placing the subject at the bottom
edge; do not paint a shadow into the alpha derivative. All other master-guide direction
remains authoritative.

## Visual chronology

M3 is the Settlement Era, not the Fold era. The hubs should show difficult human survival:
worn industrial construction, repaired technology, ash, scarcity, and small signs of social
life. Do not introduce bodily mutation, organic Fold growth, Great-House heraldry, ancient
galactic empires, or late-game religious iconography. Those assets must emerge from later
world state rather than appear at the frontier's beginning.

## Reuse strategy for an effectively infinite world

The game does not need a unique painting for every colony. M3 creates a reusable Ashfall
base library. Later systems combine:

- hub kind: Cantina, Marketplace, Town Hall;
- biome material pack;
- settlement tier and maintenance state;
- faction/culture accent set;
- deterministic prop layout and wear decals;
- authored hero assets for exceptional people and places.

Variation will come from deterministic composition of reviewed assets. Runtime generative
AI is not part of the design. M3 defines only the Ashfall base library; it does not add a
composition key/schema, biome variants, faction accents, or wear decals. Those require a
later systemic design before anyone generates the variant library.

## Environment manifest

Each hub kit has three interior textures, one exterior facade tile, and a small prop family.
Rejected attempts stay in `/private/tmp`. Every accepted full-resolution source used to
derive production art is committed under `docs/assets/source/m3-hubs/<hub>/` together with
its production derivative and review evidence, so a later agent can reproduce the crop,
matte, and scale without relying on an ephemeral tool result.

| Hub | Sprite constant | Production path | Size | Alpha | Contract |
|---|---|---|---:|---|---|
| Cantina | `HUB_CANTINA_WALL` | `game/public/sprites/interiors/m3/cantina/wall.png` | 512×512 | opaque | seamless square-on wall |
| Cantina | `HUB_CANTINA_FLOOR` | `game/public/sprites/interiors/m3/cantina/floor.png` | 512×512 | opaque | seamless top-down floor |
| Cantina | `HUB_CANTINA_CEILING` | `game/public/sprites/interiors/m3/cantina/ceiling.png` | 512×512 | opaque | seamless overhead ceiling |
| Cantina | `COLONY_WALL_CANTINA` | `game/public/sprites/walls/cantina.png` | 64×64 | opaque | exterior facade wall tile |
| Marketplace | `HUB_MARKET_WALL` | `game/public/sprites/interiors/m3/marketplace/wall.png` | 512×512 | opaque | seamless square-on wall |
| Marketplace | `HUB_MARKET_FLOOR` | `game/public/sprites/interiors/m3/marketplace/floor.png` | 512×512 | opaque | seamless top-down floor |
| Marketplace | `HUB_MARKET_CEILING` | `game/public/sprites/interiors/m3/marketplace/ceiling.png` | 512×512 | opaque | seamless overhead ceiling |
| Marketplace | `COLONY_WALL_MARKETPLACE` | `game/public/sprites/walls/marketplace.png` | 64×64 | opaque | exterior facade wall tile |
| Town Hall | `HUB_TOWN_HALL_WALL` | `game/public/sprites/interiors/m3/town-hall/wall.png` | 512×512 | opaque | seamless square-on wall |
| Town Hall | `HUB_TOWN_HALL_FLOOR` | `game/public/sprites/interiors/m3/town-hall/floor.png` | 512×512 | opaque | seamless top-down floor |
| Town Hall | `HUB_TOWN_HALL_CEILING` | `game/public/sprites/interiors/m3/town-hall/ceiling.png` | 512×512 | opaque | seamless overhead ceiling |
| Town Hall | `COLONY_WALL_TOWN_HALL` | `game/public/sprites/walls/town-hall.png` | 64×64 | opaque | exterior facade wall tile |

Prop paths follow `game/public/sprites/interiors/m3/<hub>/<name>.png`. Every prop uses a
256×256 transparent canvas because the current renderer uses a square prop plane. The visible
subject keeps its natural proportions inside that canvas: wide counters may occupy roughly
230×110 pixels and tall terminals roughly 110×230. Every billboard touches the bottom edge
with a believable contact point and contains no cast-shadow rectangle.

| Hub | Filename | Sprite constant |
|---|---|---|
| Cantina | `bar-counter.png` | `HUB_CANTINA_PROP_BAR_COUNTER` |
| Cantina | `bottle-rack.png` | `HUB_CANTINA_PROP_BOTTLE_RACK` |
| Cantina | `table-cluster.png` | `HUB_CANTINA_PROP_TABLE_CLUSTER` |
| Cantina | `rumor-terminal.png` | `HUB_CANTINA_PROP_RUMOR_TERMINAL` |
| Marketplace | `vendor-counter.png` | `HUB_MARKET_PROP_VENDOR_COUNTER` |
| Marketplace | `weapon-rack.png` | `HUB_MARKET_PROP_WEAPON_RACK` |
| Marketplace | `supply-crates.png` | `HUB_MARKET_PROP_SUPPLY_CRATES` |
| Marketplace | `trade-terminal.png` | `HUB_MARKET_PROP_TRADE_TERMINAL` |
| Marketplace | `cable-bundle.png` | `HUB_MARKET_PROP_CABLE_BUNDLE` |
| Town Hall | `governor-desk.png` | `HUB_TOWN_HALL_PROP_GOVERNOR_DESK` |
| Town Hall | `petition-terminal.png` | `HUB_TOWN_HALL_PROP_PETITION_TERMINAL` |
| Town Hall | `holo-atlas.png` | `HUB_TOWN_HALL_PROP_HOLO_ATLAS` |
| Town Hall | `bench.png` | `HUB_TOWN_HALL_PROP_BENCH` |
| Town Hall | `archive-cabinet.png` | `HUB_TOWN_HALL_PROP_ARCHIVE_CABINET` |

`manifest.json` is the machine-readable authority for all filenames, constants, dimensions,
alpha classes, full-resolution source paths, and bundle status. Each bundle begins as
`planned` and changes to `production-reviewed` only when its complete environment, prop, and
NPC contract passes review. The tables in this README explain the manifest; they do not
replace it.

## NPC identity manifest

The M3 asset lane targets eight role identities. Each role begins with one 512×512 opaque
portrait and one 128×256 transparent idle billboard. Walk frames are a second pass after the
idle identity is production-reviewed. Walk frames are optional enhancements and never block
the initial hub bundle; recurring NPCs may later receive two 128×256 frames generated
separately against the locked reference.

| Hub | Role ID | Portrait constant | Billboard constant | Initial walk priority |
|---|---|---|---|---|
| Cantina | `hub-bartender` | `PORTRAIT_HUB_BARTENDER` | `NPC_HUB_BARTENDER` | high |
| Cantina | `hub-regular` | `PORTRAIT_HUB_REGULAR` | `NPC_HUB_REGULAR` | low |
| Cantina | `hub-signal-chaser` | `PORTRAIT_HUB_SIGNAL_CHASER` | `NPC_HUB_SIGNAL_CHASER` | medium |
| Marketplace | `hub-arms-dealer` | `PORTRAIT_HUB_ARMS_DEALER` | `NPC_HUB_ARMS_DEALER` | medium |
| Marketplace | `hub-provisioner` | `PORTRAIT_HUB_PROVISIONER` | `NPC_HUB_PROVISIONER` | low |
| Marketplace | `hub-contract-broker` | `PORTRAIT_HUB_CONTRACT_BROKER` | `NPC_HUB_CONTRACT_BROKER` | high |
| Town Hall | `hub-governor` | `PORTRAIT_HUB_GOVERNOR` | `NPC_HUB_GOVERNOR` | high |
| Town Hall | `hub-civic-clerk` | `PORTRAIT_HUB_CIVIC_CLERK` | `NPC_HUB_CIVIC_CLERK` | medium |

Portrait paths use `game/public/sprites/portraits/<role-id>.png`. Billboard paths use
`game/public/sprites/boarding/npc-<role-id>.png`. Optional walk frames append
`-walk-1.png` and `-walk-2.png`.

Role IDs are stable content identities, not guaranteed story names. Dialog may assign a
save-specific name later without changing the asset path.

## Claim ladder and bundle completion

A hub bundle is `PRODUCTION-REVIEWED` when:

- every required file has exact dimensions and expected alpha semantics;
- wall/floor/ceiling textures tile without a visible seam;
- NPC portrait and billboard unmistakably depict the same person;
- every billboard reads at the renderer's actual small size on dark and bright fields;
- accepted full-resolution sources, derivative commands, comparison evidence, and generation
  provenance are committed under `docs/assets/source/m3-hubs/` and
  `docs/assets/reviews/m3-hubs/<hub>/`.

It becomes `INTEGRATED` only after a separately approved M3 code slice supplies a real hub
template/consumer, registers the files, passes the relevant tests/static exports, and records
a 480×854 production-export playtest showing the textures, prop, and NPC together. Only then
may roadmap/PR copy call the bundle `ACCEPTED` or `IN USE`.

This asset plan is independently complete at `PRODUCTION-REVIEWED`; it must not invent hub
layouts or NPC wiring to reach `INTEGRATED`. An attractive 1024px source image that fails any
production-review gate is rejected.

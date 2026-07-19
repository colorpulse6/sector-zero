# M3 Hubs — Review and Integration Gates

This checklist distinguishes `PRODUCTION-REVIEWED` static art from `INTEGRATED` runtime art.
Generation is only the first step; neither label may be inferred from a pretty source image.

## 1. Work in one hub bundle

Do not generate all three hubs and review them at the end. Complete Cantina through the
production-review gate, then Marketplace, then Town Hall. Keep rejected attempts under a
named `/private/tmp/sector-zero-m3-<hub>/` directory. Copy every accepted full-resolution
source into `docs/assets/source/m3-hubs/<hub>/` before deleting temporary work.

For each asset, record:

- output identifier and raw path;
- whether a reference image was attached and what identity it controlled;
- exposed seed, or `not exposed`;
- raw dimensions/channels and committed accepted-source path;
- crop, scale, matte, despill, and edge treatment;
- production dimensions/channels and 5%-alpha bounds for billboards;
- accepted/rejected decision with a concrete reason.

## 2. Texture processing

For each wall, floor, ceiling, and facade source:

1. Inspect all four borders at full size.
2. Create an offset preview that moves the original borders to the center.
3. Create a 2×2 tiling preview.
4. Reject visible seams; do not hide them with aggressive blur.
5. Downscale with a high-quality filter to the exact production size.
6. Confirm the derivative is opaque sRGB PNG and power-of-two.

Example inspection commands, replacing paths as needed:

```bash
magick source.png -roll +512+512 /private/tmp/source-offset.png
magick montage source.png source.png source.png source.png -tile 2x2 -geometry +0+0 /private/tmp/source-tile-2x2.png
magick source.png -filter Lanczos -resize 512x512! production.png
magick identify production.png
```

Facade derivatives are reviewed as a 2×2 64px tile on neutral dark and bright panels. A good
512px source can still become unreadable noise at 64px. The later integration slice performs
the colony-raycaster review.

## 3. Billboard processing

Generate billboards on flat `#00ff00`. Use the established chroma-key/BiRefNet workflow,
then inspect dark and bright composites. Preserve intentional small emissive halos; remove
green spill and opaque fog boxes.

Required checks:

- exact 128×256 production canvas for NPCs;
- exact manifest canvas for props;
- transparent corners;
- feet/base touch the intended ground line;
- no meaningful alpha clipped by the canvas;
- face and gear remain legible at expected draw size;
- identity pair matches side by side.

Do not put clean new assets in `MAT_ALLOWLIST`. That list authorizes the destructive
`remat.ts` pass for known dirty legacy files. Add a new path only if inspection proves it
needs that remediation and the change is reviewed separately.

## 4. Required production-review evidence

Commit evidence under:

```text
docs/assets/reviews/m3-hubs/<hub>/
  provenance.md
  textures-2x2.png
  props-actual-size.png
  npc-identity-pairs.png
  billboards-dark-bright.png
```

`provenance.md` records attempts and commands. Comparison panels must label the real
production size; enlarged panels use nearest-neighbor scaling only for inspection.

`billboards-dark-bright.png` contains every required prop and NPC billboard composited at
actual intended draw size on labeled dark and bright fields; this evidence is required
because a halo can disappear against the game's usual dark background. The file may begin
with props during environment production, but it is incomplete until the hub's NPCs are
added. `gameplay-480x854.png` is added only by the later integration slice, after an approved
M3 hub template can display wall/floor/ceiling, a prop, and an NPC together. The asset agent
must not invent that consumer merely to manufacture a screenshot.

## 5. Runtime integration boundary

Registration happens in a separately approved M3 code slice after the PNG is
`PRODUCTION-REVIEWED` at the exact contract path.

1. Add the path constant to `game/app/components/engine/sprites.ts`.
2. Keep the asset single-frame; do not add it to `SHEETS`.
3. Wire the constant through the hub data contract defined by that systemic plan; current
   `InteriorTemplate` does not yet own environment-art or NPC-placement fields.
4. Preserve the fallback until the asset resolves successfully.
5. If the consumer needs new data fields, add them to the smallest hub/template data type;
   do not add hub-specific conditionals to `firstPersonRenderer.ts`.
6. Keep `window`, `document`, Canvas context creation, and image loading out of module scope.

The current engine already supports default wall/floor/ceiling textures and FP billboard
paths. It does not yet consume M3 portrait art in the FP dialog box; portrait registration
must not be represented as completed integration until the dialog renderer actually uses
`FPDialogLine.portraitKey`.

## 6. Verification commands

For a `PRODUCTION-REVIEWED` asset bundle, run the manifest/schema test and local ImageMagick
audit specified by `2026-07-18-m3-hub-asset-production.md`. They verify every required path,
dimension, PNG color type, transparent corner, and bottom-contact band.

For an `INTEGRATED` bundle, also run from `game/`:

```bash
npx tsc --noEmit
yarn colony:test
yarn engine:test
yarn sprites:test
yarn build
NEXT_PUBLIC_DEVTOOLS=1 yarn build
```

Then serve the DevPanel export and exercise the real hub at 480×854. Static build success
alone does not prove tiling, scale, identity, interaction visibility, or halo quality.

## 7. Scope guards

An asset bundle must not silently:

- add colony tier promotion or district rules;
- change building costs, power, production, upkeep, or operation rewards;
- redesign first-person rendering;
- alter enemy hitboxes, AI, or balance;
- introduce runtime model calls or network requirements;
- replace unrelated sprites;
- add speculative biome variants before the Ashfall base set is production-reviewed.

If code integration reaches one of these boundaries, stop the asset slice, commit the
reviewed art/provenance, and hand the remaining decision to the relevant systemic plan.

## 8. PR shape

Prefer one small PR per production-reviewed hub bundle. Each PR description names:

- exact assets added/replaced;
- preserved runtime contracts;
- generation and alpha method;
- actual-size production-review evidence;
- verification commands and results;
- any asset that remains generated but not runtime-consumed.

The later integration PR adds the 480×854 gameplay evidence; an asset-only PR must state
that this screenshot is intentionally absent.

Never claim `IN USE` for a file that is merely present or registered. The claim ladder is:

```text
PROMPTED → GENERATED → PROCESSED → PRODUCTION-REVIEWED → REGISTERED → INTEGRATED/EXERCISED IN GAME
```

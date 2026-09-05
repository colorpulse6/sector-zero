# Town Hall Asset Production Provenance

**Started:** 2026-07-19
**Bundle status:** PRODUCTION-REVIEWED — NOT REGISTERED — NOT INTEGRATED
**Temporary workspace:** `/private/tmp/sector-zero-m3-town-hall/`
**Generation surface:** Codex built-in `image_gen`; seeds were `not exposed` for every output
**Original path rule:** every recorded output ID maps to
`/Users/nichalasbarnes/.codex/generated_images/019f77e5-af49-73c2-837b-35b0d828f346/<output-id>`

## Environment sources — SELECTED AFTER SEAM REVIEW

Wall, floor, ceiling, and exterior facade were generated as four separate requests. The
matching Cantina and Marketplace sources informed the first-pass shared-world material
language. The corrective seam pass then used only the corresponding first-pass Town Hall raw
candidate as a material, rendering, palette, and proportion reference. Each corrective
prompt required new organic border continuity while explicitly rejecting whole-half
reflection, mirrored halves, mirror tiling, bilateral palindromes, aggressive blur, and
concealment bands.

Every first raw candidate had the intended civic structure but failed the +627/+627 and raw
2×2 source gate at its horizontal boundary. Commit `271f635` attempted to make those sources
periodic by appending a central half to its vertical reflection. Review rejected that method:
each committed source had an exact top-half versus flipped-bottom-half absolute error of `0`,
and the 2×2 evidence exposed an obvious palindromic band. The four corrective built-in
`image_gen` outputs are new 1254×1254 RGB sources, copied byte-for-byte from their recorded
output paths with no post-generation seam normalization. Lanczos resizing is the only source
to production transformation.

The corrective sources passed the mechanical non-mirror gate with top-half versus
flipped-bottom-half AE values of wall `784403`, floor `785458`, ceiling `785104`, and facade
`786017`. Each also passed visual review of the original borders, a +627/+627 offset, a source
2×2 montage, a production 2×2 montage, and, for the facade, the exact 64×64 derivative.

| Asset | Output ID and original | References | Accepted source / production | Decision |
|---|---|---|---|---|
| Interior wall | `exec-ba3644c2-1ebb-41f9-89e3-417c88f14bfe.png`; 1254×1254 RGB | First-pass Town Hall wall `exec-3f15f96a-ed27-49e8-b1e2-d55bcd47cb1a.png`; material direction only | `wall-source.png`, 1254×1254 RGB → `game/public/sprites/interiors/m3/town-hall/wall.png`, 512×512 RGB | Selected. Broad vertical concrete and gunmetal bays join without the former mirrored center band; staggered repairs and sparse cyan/warm lights remain non-palindromic while preserving severe civic order. |
| Interior floor | `exec-3bd91cca-be6f-4888-bf1e-315ce45c95d9.png`; 1254×1254 RGB | First-pass Town Hall floor `exec-70f520ce-460f-4c5b-9734-a909c42acbf6.png`; material direction only | `floor-source.png`, 1254×1254 RGB → `game/public/sprites/interiors/m3/town-hall/floor.png`, 512×512 RGB | Selected. Broad worn slabs and low-density steel insets cross the joins without a hard boundary; irregular repairs remain distinct from Cantina chair wear and Marketplace cargo tracks. |
| Interior ceiling | `exec-df55e82f-b5a3-4f8a-8475-275bb07415d4.png`; 1254×1254 RGB | First-pass Town Hall ceiling `exec-18db6f6d-1cfe-4fd1-9976-231c528f8edf.png`; material direction only | `ceiling-source.png`, 1254×1254 RGB → `game/public/sprites/interiors/m3/town-hall/ceiling.png`, 512×512 RGB | Selected. Ribs, hatches, conduit runs, and cyan-white wells continue through the joins without a lamp cutoff or reflected band; staggered repair fields keep the overhead grid calm but not palindromic. |
| Exterior facade | `exec-7e27c630-a698-40ac-a37f-2d34632b53c2.png`; 1254×1254 RGB | First-pass Town Hall facade `exec-afd6cb85-9cf1-4912-b540-6d8d12debeff.png`; material direction only | `facade-source.png`, 1254×1254 RGB → `game/public/sprites/walls/town-hall.png`, 64×64 RGB | Selected. Wind-scoured concrete and ordered reinforcement join without a reflected belt; asymmetrical wear remains readable at 64px without a sign, seal, flag, or heraldry. |

All four originals are under
`/Users/nichalasbarnes/.codex/generated_images/019f77e5-af49-73c2-837b-35b0d828f346/`.
The selected outputs had seed `not exposed`.

### Rejected environment candidates

- The four initial raw border states are retained as
  `/private/tmp/sector-zero-m3-town-hall/raw/{wall,floor,ceiling,facade}-source.png`.
  Their material and structural direction was accepted, but their direct top/bottom joins
  were rejected after +627/+627 and raw 2×2 inspection exposed horizontal discontinuities.
- `exec-25f85c6d-b82c-4245-982e-fa16e0106d52.png` is retained as
  `/private/tmp/sector-zero-m3-town-hall/raw/wall-seam-refinement-rejected.png`. The targeted
  model refinement altered the wall rhythm but still did not make the top and bottom edges
  periodic, so it was rejected rather than committed.
- The four half-plus-flip sources in commit `271f635` were rejected after the mechanical
  non-mirror check returned AE `0` for every source and visual review confirmed the repeated
  palindromic band. They remain available only through review history; the working bundle
  contains none of those binaries or that construction method.

## Prop billboards — SELECTED

All five props were generated separately on flat `#00ff00`. Committed Cantina and Marketplace
props were attached only to preserve shared Ashfall material weight and rendering quality,
never as shape or palette-swap templates. Every raw selected source is 8-bit sRGB RGB; every
production derivative is exact 256×256 8-bit sRGB RGBA with transparent corners and occupied
bottom contact. Seeds were `not exposed`.

| Asset | Output ID / original contract | Reference role | 5%-alpha bounds | Decision |
|---|---|---|---:|---|
| Governor desk | `exec-4f2af579-2578-4d4f-a64c-5cdea60ace4f.png`; 1774×887 RGB | Cantina bar counter and Marketplace vendor counter; materials only | 232×88+12+168 | Selected. Wide armored privacy plates, thick base, and abstract cyan inset read at actual size without papers, seals, or readable UI. |
| Petition terminal | `exec-e8e37ebc-9821-497f-9def-217819cc7725.png`; 1024×1536 RGB | Cantina rumor terminal and Marketplace trade terminal; materials only | 101×230+77+26 | Selected. Tall public kiosk, scarred hand rests, and abstract queue blocks form a clear civic-terminal silhouette without words or numbers. |
| Holo atlas | `exec-f5912b7f-5138-473d-99b0-69630830c115.png`; 1254×1254 RGB | Marketplace trade terminal and cable bundle; materials only | 232×210+12+46 | Selected. The cyan point-field stays attached to a compact grounded pedestal and does not resolve into a real map or detached fragments. |
| Bench | `exec-b5b78b45-3008-42cf-b18c-15b801007bdf.png`; 1536×1024 RGB | Cantina table cluster and Marketplace vendor counter; materials only | 232×116+12+140 | Selected. A wide uncomfortable steel/composite bench reads as one repaired grounded silhouette, without ceremonial or luxury treatment. |
| Archive cabinet | `exec-e4e7547c-e3cf-440d-924b-3b66f10e91de.png`; 1024×1536 RGB | Marketplace weapon rack and supply crates; materials only | 109×230+73+26 | Selected. Two sealed doors, large latches, and simple rectangular color tabs remain readable without letters, loose files, or office-furniture styling. |

The original prop outputs are under
`/Users/nichalasbarnes/.codex/generated_images/019f77e5-af49-73c2-837b-35b0d828f346/`
and were copied to the exact Town Hall manifest `sourcePath`s.

### Prop processing and review

- **Matte command:**
  `/private/tmp/sector-zero-m3-imagegen-venv/bin/python /Users/nichalasbarnes/.codex/skills/.system/imagegen/scripts/remove_chroma_key.py --input <source> --out <alpha> --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill --force`
- **Sampled keys:** governor desk `#06ec05`; petition terminal `#0ce80f`; holo atlas
  `#07eb16`; bench `#03ed04`; archive cabinet `#03f303`
- **Dependency isolation:** the helper environment remains only under
  `/private/tmp/sector-zero-m3-imagegen-venv`; no Python dependency entered the repository
- **Scale/canvas:** alpha trim, Lanczos fit inside 232×230, south gravity on exact 256×256
  transparent canvas, forced PNG color type 6
- **Edge treatment:** helper soft matte and despill only; no edge contraction or feather pass
  was required
- **Review:** each exact 256×256 production prop was composited without rescaling on its own
  true checkerboard cell; the five cells were labeled and joined into an opaque
  1280×288, 8-bit sRGB evidence panel with metadata stripped and page geometry reset. The
  separate dark/bright composites remain unchanged. All corners are transparent in the
  production assets, all bottom bands are occupied, natural wide/tall proportions are
  preserved, and no green fringe or fog rectangle was observed.
- **Evidence:** `props-actual-size.png` and the prop rows of
  `billboards-dark-bright.png`

## NPC identity pairs — SELECTED

Each portrait was generated first. Its accepted full-resolution source was then attached as
the only identity reference for the matching billboard. Billboard sources use the same flat
green override and matte path as props. No walk frames were generated. Seeds were
`not exposed`.

### `hub-governor`

- **Portrait output:** `exec-54739486-19a4-4f3a-a3fb-9339ea669542.png`; original
  `/Users/nichalasbarnes/.codex/generated_images/019f77e5-af49-73c2-837b-35b0d828f346/exec-54739486-19a4-4f3a-a3fb-9339ea669542.png`; 1254×1254 RGB
- **Portrait style references:** Cantina bartender and Marketplace contract-broker portraits;
  rendering/framing only, not identity
- **Portrait source/production:** `hub-governor-portrait-source.png`, 1254×1254 RGB →
  `game/public/sprites/portraits/hub-governor.png`, 512×512 RGB
- **Billboard output:** `exec-53384bbc-279f-4ee1-a75e-3cb50c930c4d.png`; original
  `/Users/nichalasbarnes/.codex/generated_images/019f77e5-af49-73c2-837b-35b0d828f346/exec-53384bbc-279f-4ee1-a75e-3cb50c930c4d.png`; 941×1672 RGB
- **Billboard reference lock:** accepted governor portrait; same mature Black woman, short
  salt-and-pepper curls, left-brow scar, strong build, repaired command coat, compact chest
  respirator, and tiny abstract service pin
- **Billboard source/production:** `hub-governor-billboard-source.png`, 941×1672 RGB →
  `game/public/sprites/boarding/npc-hub-governor.png`, 128×256 RGBA; 5%-alpha bounds
  79×250+24+6
- **Decision:** selected. Face, age, build, coat, respirator, and burdened stance remain
  unmistakably stable at portrait, actual billboard, dark/bright, and 48px checks without
  royal, ceremonial, or military pageantry.

### `hub-civic-clerk`

- **Portrait output:** `exec-620e5478-39f4-4099-832c-bd0a6028bf3e.png`; original
  `/Users/nichalasbarnes/.codex/generated_images/019f77e5-af49-73c2-837b-35b0d828f346/exec-620e5478-39f4-4099-832c-bd0a6028bf3e.png`; 1254×1254 RGB
- **Portrait style references:** Marketplace provisioner and Cantina regular portraits;
  rendering/framing only, not identity
- **Portrait source/production:** `hub-civic-clerk-portrait-source.png`, 1254×1254 RGB →
  `game/public/sprites/portraits/hub-civic-clerk.png`, 512×512 RGB
- **Billboard output:** `exec-252a9d0d-5743-4205-ab36-78717a70e594.png`; original
  `/Users/nichalasbarnes/.codex/generated_images/019f77e5-af49-73c2-837b-35b0d828f346/exec-252a9d0d-5743-4205-ab36-78717a70e594.png`; 941×1672 RGB
- **Billboard reference lock:** accepted civic-clerk portrait; same younger South Asian woman,
  tired focused face, low hair knot, lean build, repaired layered uniform, reinforced gloves,
  shoulder harness, and cyan-lit portable archive module
- **Billboard source/production:** `hub-civic-clerk-billboard-source.png`, 941×1672 RGB →
  `game/public/sprites/boarding/npc-hub-civic-clerk.png`, 128×256 RGBA; 5%-alpha bounds
  88×250+20+6
- **Decision:** selected. The archive case stays large and side-mounted, giving the same
  identity a clear asymmetrical role silhouette at 48px without an office suit, paper stack,
  badge, or comedy bureaucracy.

### NPC processing and deferred motion

- **Portrait processing:** Lanczos resize to exact 512×512, alpha removed, forced PNG color
  type 2
- **Billboard matte:** border auto-key, soft matte, transparent threshold 12, opaque
  threshold 220, despill, force; sampled keys governor `#09f910`, civic clerk `#03f802`
- **Billboard scale/canvas:** alpha trim, Lanczos fit inside 118×250, south gravity on exact
  128×256 transparent canvas, forced PNG color type 6
- **Edge treatment:** no contraction or feather pass was required
- **Review:** side-by-side identity panel, actual 128×256 checkerboard, 48px character check,
  and dark/bright composites
- **Evidence:** `npc-identity-pairs.png` and the complete
  `billboards-dark-bright.png`
- **Walk frames:** intentionally deferred because the M3 manifest and current asset contract
  require idle pairs only. The governor is the first future candidate after a real
  integration consumer exists.

## Recorded commands

```bash
magick source.png -write mpr:src +delete \( mpr:src -crop 1254x627+0+0 +repage \) \( mpr:src -crop 1254x627+0+627 +repage -flip \) -metric AE -compare -format '%[distortion]\n' info:
magick source.png -roll +627+627 source-offset.png
magick montage source.png source.png source.png source.png -tile 2x2 -geometry 627x627+0+0 -filter Lanczos source-2x2.png
magick source.png -filter Lanczos -resize 512x512! -alpha off -type TrueColor -depth 8 -strip +repage -define png:color-type=2 texture.png
magick facade-source.png -filter Lanczos -resize 64x64! -alpha off -type TrueColor -depth 8 -strip +repage -define png:color-type=2 town-hall.png
/private/tmp/sector-zero-m3-imagegen-venv/bin/python /Users/nichalasbarnes/.codex/skills/.system/imagegen/scripts/remove_chroma_key.py --input billboard-source.png --out billboard-alpha.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill --force
magick prop-alpha.png -trim +repage -filter Lanczos -resize "232x230>" -gravity south -background none -extent 256x256 -define png:color-type=6 prop.png
magick npc-alpha.png -trim +repage -filter Lanczos -resize "118x250>" -gravity south -background none -extent 128x256 -define png:color-type=6 npc.png
magick -size 256x256 pattern:checkerboard prop.png -compose over -composite -depth 8 -alpha off -type TrueColor -strip +repage prop-checker-actual.png
magick -size 256x32 xc:'#08111c' -font DejaVu-Sans -fill '#dbe9f4' -gravity center -pointsize 16 -annotate +0+0 'PROP LABEL' prop-header.png
magick prop-header.png prop-checker-actual.png -append -depth 8 -alpha off -type TrueColor -strip +repage prop-cell.png
magick governor-desk-cell.png petition-terminal-cell.png holo-atlas-cell.png bench-cell.png archive-cabinet-cell.png +append -depth 8 -alpha off -type TrueColor -strip +repage props-actual-size.png
```

The complete bundle remains unregistered and unintegrated. Runtime constants, sprite sheets,
renderers, gameplay consumers, optional walk frames, and gameplay screenshots are outside
this production-art slice.

## Production-art handoff

- **Manifest state:** every Town Hall entry is exactly `PRODUCTION-REVIEWED, NOT REGISTERED,
  NOT INTEGRATED`.
- **Final verification (2026-07-19):** the Cantina, Marketplace, and Town Hall direct
  validators all passed; TypeScript was clean; colony tests passed 284/284; engine tests
  passed 282/282; sprite tests passed 7/7; and both the standard and DevTools static exports
  compiled successfully, generated 6/6 static pages, and exported 3/3 routes.
- **Visual boundary:** the committed source/production comparisons, scale checks, seam checks,
  and composites were inspected. There is intentionally no gameplay screenshot because these
  assets have no runtime consumer yet.
- **Runtime integration audit (2026-07-19):** `InteriorTemplate` has no environment-art or
  interior NPC placement/schedule fields. `generateInteriorState` supplies shared Ashfall sky,
  wall, and floor and no `ceilingSprite`. FP props are square projected billboards
  (`widthFactor: 1`), and the FP dialog renderer consumes speaker/text but does not render
  `FPDialogLine.portraitKey`. No M3 hub asset paths are registered in `SPRITES` or referenced by
  a runtime hub consumer.
- **Required next artifact:** an M3 Cantina code design/plan defining the layout, interior asset
  fields, NPC placement and schedules, interaction, DevPanel fixture, normal player access,
  Atlas and bulletin-board boundaries, and runtime registration before implementation begins.

# Town Hall Asset Production Provenance

**Started:** 2026-07-19
**Bundle status:** PRODUCTION-REVIEWED — NOT REGISTERED — NOT INTEGRATED
**Temporary workspace:** `/private/tmp/sector-zero-m3-town-hall/`
**Generation surface:** Codex built-in `image_gen`; seeds were `not exposed` for every output
**Original path rule:** every recorded output ID maps to
`/Users/nichalasbarnes/.codex/generated_images/019f77e5-af49-73c2-837b-35b0d828f346/<output-id>`

## Environment sources — SELECTED AFTER SEAM REVIEW

Wall, floor, ceiling, and exterior facade were generated as four separate requests. The
matching Cantina and Marketplace sources were attached only as shared-world material and
rendering references: Town Hall composition was required to remain calmer, broader, more
vertical, and more permanent rather than becoming a palette swap.

Every first raw candidate had the intended civic structure but failed the +627/+627 and raw
2×2 source gate at its horizontal boundary. Those originals remain in the temporary
workspace. The accepted 1254×1254 full-resolution sources were rebuilt reproducibly from the
central 1254×627 band of each selected generation and its vertical mirror. This preserves the
generated material and layout while making the top/bottom boundary periodic without blur.
The already-periodic left/right authored structure was unchanged. Accepted sources passed
new +627/+627 offsets, source 2×2 montages, production 2×2 montages, and the exact 64px facade
review.

| Asset | Output ID and original | References | Accepted source / production | Decision |
|---|---|---|---|---|
| Interior wall | `exec-3f15f96a-ed27-49e8-b1e2-d55bcd47cb1a.png`; 1254×1254 RGB | Cantina and Marketplace wall sources; material language only | `wall-source.png`, 1254×1254 RGB → `game/public/sprites/interiors/m3/town-hall/wall.png`, 512×512 RGB | Selected after periodic seam normalization. Broad vertical concrete bays, gunmetal pilasters, careful repairs, restrained cyan channels, and rare warm task lights read as severe civic order. |
| Interior floor | `exec-70f520ce-460f-4c5b-9734-a909c42acbf6.png`; 1254×1254 RGB | Cantina and Marketplace floor sources; material language only | `floor-source.png`, 1254×1254 RGB → `game/public/sprites/interiors/m3/town-hall/floor.png`, 512×512 RGB | Selected after periodic seam normalization. Broad worn fields and orderly low-density steel insets remain distinct from chair-scuffed Cantina plates and Marketplace cargo tracks. |
| Interior ceiling | `exec-18db6f6d-1cfe-4fd1-9976-231c528f8edf.png`; 1254×1254 RGB | Cantina and Marketplace ceiling sources; material language only | `ceiling-source.png`, 1254×1254 RGB → `game/public/sprites/interiors/m3/town-hall/ceiling.png`, 512×512 RGB | Selected after periodic seam normalization. Symmetrical ribs, square hatches, and cyan-white wells form a calm oppressive overhead grid. |
| Exterior facade | `exec-afd6cb85-9cf1-4912-b540-6d8d12debeff.png`; 1254×1254 RGB | Cantina and Marketplace facade sources; exterior material language only | `facade-source.png`, 1254×1254 RGB → `game/public/sprites/walls/town-hall.png`, 64×64 RGB | Selected after periodic seam normalization. Wind-scoured concrete bays and thick vertical reinforcement survive the exact 64px derivative without a sign, seal, flag, or heraldry. |

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
- **Review:** actual-size checkerboard and dark/bright composites; all corners transparent,
  all bottom bands occupied, natural wide/tall proportions preserved, no green fringe or fog
  rectangle observed
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
- **Walk frames:** intentionally deferred because the M3 manifest and current runtime
  consumer require idle pairs only. The governor is the first future candidate after a real
  integration consumer exists.

## Recorded commands

```bash
magick raw-source.png -crop 1254x627+0+313 +repage \( +clone -flip \) -append accepted-seamless-source.png
magick accepted-seamless-source.png -roll +627+627 source-offset.png
magick montage accepted-seamless-source.png accepted-seamless-source.png accepted-seamless-source.png accepted-seamless-source.png -tile 2x2 -geometry +0+0 source-2x2.png
magick accepted-seamless-source.png -filter Lanczos -resize 512x512! -alpha off -type TrueColor -define png:color-type=2 texture.png
magick facade-source.png -filter Lanczos -resize 64x64! -alpha off -type TrueColor -define png:color-type=2 town-hall.png
/private/tmp/sector-zero-m3-imagegen-venv/bin/python /Users/nichalasbarnes/.codex/skills/.system/imagegen/scripts/remove_chroma_key.py --input billboard-source.png --out billboard-alpha.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill --force
magick prop-alpha.png -trim +repage -filter Lanczos -resize "232x230>" -gravity south -background none -extent 256x256 -define png:color-type=6 prop.png
magick npc-alpha.png -trim +repage -filter Lanczos -resize "118x250>" -gravity south -background none -extent 128x256 -define png:color-type=6 npc.png
```

The complete bundle remains unregistered and unintegrated. Runtime constants, sprite sheets,
renderers, gameplay consumers, optional walk frames, and gameplay screenshots are outside
this production-art slice.

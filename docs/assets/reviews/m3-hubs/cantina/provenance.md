# Cantina Asset Production Provenance

**Started:** 2026-07-18
**Bundle status:** PRODUCTION-REVIEWED — NOT REGISTERED — NOT INTEGRATED
**Temporary workspace:** `/private/tmp/sector-zero-m3-cantina/`

## Environment attempts

### Interior wall — attempt 1 — REJECTED

- **Generator:** Codex built-in `image_gen` (`gpt-image-2` path)
- **Output ID:** `exec-2fc49358-c799-4e1f-9422-63385a957ade.png`
- **Original output:** `/Users/nichalasbarnes/.codex/generated_images/019f5d85-985f-7d93-a56c-e9a171e6c280/exec-2fc49358-c799-4e1f-9422-63385a957ade.png`
- **Reference image:** none
- **Seed:** not exposed
- **Raw contract:** 1254×1254, 8-bit sRGB RGB PNG
- **Prompt:** Cantina interior-wall prompt plus the M3 seamless-texture rules and master DOOM style/negative suffixes.
- **Inspection:** copied to the temporary workspace; created a +627/+627 offset preview and a 2×2 montage with ImageMagick.
- **Decision:** rejected. Art direction, material weight, panel rhythm, and emissive restraint are strong, but the offset preview exposes a hard horizontal discontinuity through the center. It would create visible stripes when tiled in the raycaster.
- **Next action:** use this candidate only as a style/material reference for a corrected single seamless tile. Do not commit it as `wall-source.png`.

### Interior wall — attempt 2 — SELECTED

- **Generator:** Codex built-in `image_gen` (`gpt-image-2` path), reference-guided edit
- **Output ID:** `exec-03a2d708-b650-4f23-ac53-11791a9dff3b.png`
- **Original output:** `/Users/nichalasbarnes/.codex/generated_images/019f5d85-985f-7d93-a56c-e9a171e6c280/exec-03a2d708-b650-4f23-ac53-11791a9dff3b.png`
- **Reference image:** rejected wall attempt 1, used only to lock materials, palette, lighting, and panel weight
- **Seed:** not exposed
- **Committed source:** `docs/assets/source/m3-hubs/cantina/wall-source.png`
- **Raw contract:** 1254×1254, 8-bit sRGB RGB PNG
- **Processing:** Lanczos resize to 512×512, alpha removed, forced true-color RGB
- **Production path:** `game/public/sprites/interiors/m3/cantina/wall.png`
- **Production contract:** 512×512, 8-bit sRGB RGB PNG
- **Inspection:** +627/+627 offset and 2×2 montage show continuous exposure and material flow without the first attempt's hard center band. Repetition remains visible through authored panel/light landmarks, but the tile boundary itself does not create a discontinuity.
- **Decision:** selected for the Cantina environment component. Final bundle status remains in production until floor, ceiling, facade, props, NPCs, and evidence pass.

### Interior floor — attempt 1 — REJECTED

- **Generator:** Codex built-in `image_gen` (`gpt-image-2` path), wall-reference style lock
- **Output ID:** `exec-85c8e5a1-9b35-4c75-ab78-0931138c91e6.png`
- **Original output:** `/Users/nichalasbarnes/.codex/generated_images/019f5d85-985f-7d93-a56c-e9a171e6c280/exec-85c8e5a1-9b35-4c75-ab78-0931138c91e6.png`
- **Reference image:** selected Cantina wall, used only for palette, material weight, and chronology
- **Seed:** not exposed
- **Raw contract:** 1254×1254, 8-bit sRGB RGB PNG
- **Prompt:** Cantina interior-floor prompt plus the M3 seamless-texture rules and master style/negative suffixes.
- **Inspection:** +627/+627 offset and 2×2 montage.
- **Decision:** rejected because the offset inspection exposed a stronger horizontal boundary band than the surrounding authored plate seams.

### Interior floor — attempt 2 — SELECTED

- **Generator:** Codex built-in `image_gen` (`gpt-image-2` path), reference-guided correction
- **Output ID:** `exec-e46a752f-73ac-4bb7-a540-41dcd9322a63.png`
- **Original output:** `/Users/nichalasbarnes/.codex/generated_images/019f5d85-985f-7d93-a56c-e9a171e6c280/exec-e46a752f-73ac-4bb7-a540-41dcd9322a63.png`
- **Reference image:** floor attempt 1, used to preserve material, palette, plate scale, and wear
- **Seed:** not exposed
- **Committed source:** `docs/assets/source/m3-hubs/cantina/floor-source.png`
- **Raw contract:** 1254×1254, 8-bit sRGB RGB PNG
- **Processing:** Lanczos resize to 512×512, alpha removed, forced true-color RGB
- **Production path:** `game/public/sprites/interiors/m3/cantina/floor.png`
- **Production contract:** 512×512, 8-bit sRGB RGB PNG
- **Inspection:** +627/+627 offset, source 2×2 montage, production 2×2 comparison, and actual production-size review. Boundary transitions read as ordinary repaired deck seams without the first attempt's hard band.
- **Decision:** selected.

### Interior ceiling — attempt 1 — REJECTED

- **Generator:** Codex built-in `image_gen` (`gpt-image-2` path), wall-reference style lock
- **Output ID:** `exec-6d40494c-7350-44a5-9580-4e5ff8fb2792.png`
- **Original output:** `/Users/nichalasbarnes/.codex/generated_images/019f5d85-985f-7d93-a56c-e9a171e6c280/exec-6d40494c-7350-44a5-9580-4e5ff8fb2792.png`
- **Reference image:** selected Cantina wall, used only for palette, material weight, and chronology
- **Seed:** not exposed
- **Raw contract:** 1254×1254, 8-bit sRGB RGB PNG
- **Prompt:** Cantina ceiling prompt plus the M3 seamless-texture rules and master style/negative suffixes.
- **Inspection:** +627/+627 offset and 2×2 montage.
- **Decision:** rejected because pipe and panel routes created a visible boundary join in the offset inspection.

### Interior ceiling — attempt 2 — SELECTED

- **Generator:** Codex built-in `image_gen` (`gpt-image-2` path), reference-guided correction
- **Output ID:** `exec-114cdb7a-08be-4e9c-8dd2-c4dacf14a95b.png`
- **Original output:** `/Users/nichalasbarnes/.codex/generated_images/019f5d85-985f-7d93-a56c-e9a171e6c280/exec-114cdb7a-08be-4e9c-8dd2-c4dacf14a95b.png`
- **Reference image:** ceiling attempt 1, used to preserve construction density, embedded lighting, palette, and pipe weight
- **Seed:** not exposed
- **Committed source:** `docs/assets/source/m3-hubs/cantina/ceiling-source.png`
- **Raw contract:** 1254×1254, 8-bit sRGB RGB PNG
- **Processing:** Lanczos resize to 512×512, alpha removed, forced true-color RGB
- **Production path:** `game/public/sprites/interiors/m3/cantina/ceiling.png`
- **Production contract:** 512×512, 8-bit sRGB RGB PNG
- **Inspection:** +627/+627 offset, source 2×2 montage, production 2×2 comparison, and actual production-size review. The corrected boundary reads as part of the dense utility-panel rhythm.
- **Decision:** selected.

### Exterior facade — attempt 1 — REJECTED

- **Generator:** Codex built-in `image_gen` (`gpt-image-2` path), wall-reference style lock
- **Output ID:** `exec-e919b8e3-6925-483c-a471-45501a9b8f26.png`
- **Original output:** `/Users/nichalasbarnes/.codex/generated_images/019f5d85-985f-7d93-a56c-e9a171e6c280/exec-e919b8e3-6925-483c-a471-45501a9b8f26.png`
- **Reference image:** selected Cantina wall, used only for palette, material weight, and chronology
- **Seed:** not exposed
- **Raw contract:** 1254×1254, 8-bit sRGB RGB PNG
- **Prompt:** Cantina exterior-facade prompt plus the M3 seamless-texture rules and master style/negative suffixes.
- **Inspection:** +627/+627 offset, 2×2 montage, and 64×64 derivative.
- **Decision:** rejected because the source boundary was more prominent than its interior panel rhythm after offsetting.

### Exterior facade — attempt 2 — SELECTED

- **Generator:** Codex built-in `image_gen` (`gpt-image-2` path), reference-guided correction
- **Output ID:** `exec-aaa5dd13-e2ab-4cc2-87a3-a03886cd2c81.png`
- **Original output:** `/Users/nichalasbarnes/.codex/generated_images/019f5d85-985f-7d93-a56c-e9a171e6c280/exec-aaa5dd13-e2ab-4cc2-87a3-a03886cd2c81.png`
- **Reference image:** facade attempt 1, used to preserve exterior wear, dust, panel scale, and restrained amber beacon
- **Seed:** not exposed
- **Committed source:** `docs/assets/source/m3-hubs/cantina/facade-source.png`
- **Raw contract:** 1254×1254, 8-bit sRGB RGB PNG
- **Processing:** Lanczos resize to 64×64, alpha removed, forced true-color RGB
- **Production path:** `game/public/sprites/walls/cantina.png`
- **Production contract:** 64×64, 8-bit sRGB RGB PNG
- **Inspection:** +627/+627 offset, source 2×2 montage, production 2×2 comparison, and exact 64×64 review. The facade remains legible as large exterior plates with one restrained amber beacon.
- **Decision:** selected.

### Seam-repair experiments — NOT SELECTED

Mirror-tile crops and masked patch/feather variants were created under the temporary
workspace to test deterministic seam correction. The mirror variants were pixel-continuous
but introduced obvious bilateral repetition; the patch variants damaged authored plate
geometry. Neither experiment entered the committed source or production paths.

## Prop billboards — SELECTED

All four props were generated separately with the Codex built-in `image_gen` path. The
selected Cantina wall was attached as a style/material reference only. Each prompt used the
role brief from `01-environments.md`, a front-facing slight three-quarter billboard view,
and the M3 flat `#00ff00` override: uniform key field, no floor plane, no cast/contact
shadow, no green in the subject, and no text. Seeds were not exposed.

### Bar counter

- **Output ID:** `exec-d82d138f-874d-4bec-810f-2b5b6d9daee7.png`
- **Original output:** `/Users/nichalasbarnes/.codex/generated_images/019f5d85-985f-7d93-a56c-e9a171e6c280/exec-d82d138f-874d-4bec-810f-2b5b6d9daee7.png`
- **Committed source:** `docs/assets/source/m3-hubs/cantina/bar-counter-source.png`
- **Raw contract:** 1774×887, 8-bit sRGB RGB PNG; sampled key `#03f902`
- **Production path:** `game/public/sprites/interiors/m3/cantina/bar-counter.png`
- **Production contract:** 256×256, 8-bit sRGB RGBA PNG
- **5%-alpha bounds:** 232×87+12+169; bottom contact present
- **Decision:** selected. The broad waist-high silhouette and storage recesses remain clear at actual size.

### Bottle rack

- **Output ID:** `exec-e66fedc5-a4f1-4381-b4de-4040ae417eba.png`
- **Original output:** `/Users/nichalasbarnes/.codex/generated_images/019f5d85-985f-7d93-a56c-e9a171e6c280/exec-e66fedc5-a4f1-4381-b4de-4040ae417eba.png`
- **Committed source:** `docs/assets/source/m3-hubs/cantina/bottle-rack-source.png`
- **Raw contract:** 1254×1254, 8-bit sRGB RGB PNG; sampled key `#03f907`
- **Production path:** `game/public/sprites/interiors/m3/cantina/bottle-rack.png`
- **Production contract:** 256×256, 8-bit sRGB RGBA PNG
- **5%-alpha bounds:** 232×204+12+52; bottom contact present
- **Decision:** selected. Containers remain distinct without labels or detached pieces.

### Table cluster

- **Output ID:** `exec-39fd89cc-22a3-47dc-a8c5-49b43e013713.png`
- **Original output:** `/Users/nichalasbarnes/.codex/generated_images/019f5d85-985f-7d93-a56c-e9a171e6c280/exec-39fd89cc-22a3-47dc-a8c5-49b43e013713.png`
- **Committed source:** `docs/assets/source/m3-hubs/cantina/table-cluster-source.png`
- **Raw contract:** 1254×1254, 8-bit sRGB RGB PNG; sampled key `#02f903`
- **Production path:** `game/public/sprites/interiors/m3/cantina/table-cluster.png`
- **Production contract:** 256×256, 8-bit sRGB RGBA PNG
- **5%-alpha bounds:** 232×188+12+68; bottom contact present
- **Decision:** selected. The table and exactly two fixed stools read as one grounded cluster.

### Rumor terminal

- **Output ID:** `exec-32fa0721-f706-4b19-851f-7a6ad6ec8bd7.png`
- **Original output:** `/Users/nichalasbarnes/.codex/generated_images/019f5d85-985f-7d93-a56c-e9a171e6c280/exec-32fa0721-f706-4b19-851f-7a6ad6ec8bd7.png`
- **Committed source:** `docs/assets/source/m3-hubs/cantina/rumor-terminal-source.png`
- **Raw contract:** 1254×1254, 8-bit sRGB RGB PNG; sampled key `#04f907`
- **Production path:** `game/public/sprites/interiors/m3/cantina/rumor-terminal.png`
- **Production contract:** 256×256, 8-bit sRGB RGBA PNG
- **5%-alpha bounds:** 146×230+55+26; bottom contact present
- **Decision:** selected. The cyan display contains abstract blocks only and remains readable on dark and bright fields.

### Prop processing and review

- **Matte:** installed `remove_chroma_key.py`, border auto-key, soft matte, transparent threshold 12, opaque threshold 220, despill
- **Dependency isolation:** Pillow 12.3.0 was installed only in `/private/tmp/sector-zero-m3-imagegen-venv`; no Python dependency or environment file entered the repo
- **Scale/canvas:** alpha trim, Lanczos fit inside 232×230, south gravity on exact 256×256 transparent canvas, forced PNG color type 6
- **Review:** transparent checkerboard, actual-size dark and bright composites, transparent corners, bottom band, and green-fringe inspection
- **Evidence:** `props-actual-size.png` and `billboards-dark-bright.png`; the latter began as a props-only panel and is now complete with the Cantina NPC billboards

## NPC identity pairs — SELECTED

Portraits were generated first as distinct single-subject identities. Each accepted portrait
was then attached as the only identity reference for its full-body billboard generation.
Billboards used the flat-green override and the same local chroma-key helper as the props.
Seeds were not exposed.

### `hub-bartender`

- **Portrait output ID:** `exec-fbb0bbf4-c6b9-4b85-b0fe-01a67156c483.png`
- **Portrait original:** `/Users/nichalasbarnes/.codex/generated_images/019f5d85-985f-7d93-a56c-e9a171e6c280/exec-fbb0bbf4-c6b9-4b85-b0fe-01a67156c483.png`
- **Portrait source:** `docs/assets/source/m3-hubs/cantina/hub-bartender-portrait-source.png`
- **Portrait production:** `game/public/sprites/portraits/hub-bartender.png`, 512×512 8-bit RGB
- **Billboard output ID:** `exec-5f4a404b-78bd-46c0-8d2b-eb2fcf66b31a.png`
- **Billboard original:** `/Users/nichalasbarnes/.codex/generated_images/019f5d85-985f-7d93-a56c-e9a171e6c280/exec-5f4a404b-78bd-46c0-8d2b-eb2fcf66b31a.png`
- **Billboard reference:** accepted bartender portrait; face, age, build, apron, tool gear, and prosthetic forearm locked
- **Billboard source:** `docs/assets/source/m3-hubs/cantina/hub-bartender-billboard-source.png`, 887×1774 RGB
- **Billboard production:** `game/public/sprites/boarding/npc-hub-bartender.png`, 128×256 8-bit RGBA
- **5%-alpha bounds:** 95×250+16+6; transparent corners and bottom contact present
- **Decision:** selected. The portrait and billboard retain the same face, broad build, square shoulder line, apron, and reinforced prosthetic.

### `hub-regular`

- **Portrait output ID:** `exec-38c2a34a-b2fd-4823-b050-cba87d4f33fa.png`
- **Portrait original:** `/Users/nichalasbarnes/.codex/generated_images/019f5d85-985f-7d93-a56c-e9a171e6c280/exec-38c2a34a-b2fd-4823-b050-cba87d4f33fa.png`
- **Portrait source:** `docs/assets/source/m3-hubs/cantina/hub-regular-portrait-source.png`
- **Portrait production:** `game/public/sprites/portraits/hub-regular.png`, 512×512 8-bit RGB
- **Billboard output ID:** `exec-4b73d4ec-1a45-4eca-b911-c7a402af1db6.png`
- **Billboard original:** `/Users/nichalasbarnes/.codex/generated_images/019f5d85-985f-7d93-a56c-e9a171e6c280/exec-4b73d4ec-1a45-4eca-b911-c7a402af1db6.png`
- **Billboard reference:** accepted regular portrait; face, age, compact build, respiratory collar, keepsake, and patched jacket locked
- **Billboard source:** `docs/assets/source/m3-hubs/cantina/hub-regular-billboard-source.png`, 887×1774 RGB
- **Billboard production:** `game/public/sprites/boarding/npc-hub-regular.png`, 128×256 8-bit RGBA
- **5%-alpha bounds:** 88×250+20+6; transparent corners and bottom contact present
- **Decision:** selected. The same maintenance veteran reads at portrait, actual billboard, and 48px checks without becoming a soldier caricature.

### `hub-signal-chaser`

- **Portrait output ID:** `exec-cd6cd0de-bd95-4724-8c08-962536c2300e.png`
- **Portrait original:** `/Users/nichalasbarnes/.codex/generated_images/019f5d85-985f-7d93-a56c-e9a171e6c280/exec-cd6cd0de-bd95-4724-8c08-962536c2300e.png`
- **Portrait source:** `docs/assets/source/m3-hubs/cantina/hub-signal-chaser-portrait-source.png`
- **Portrait production:** `game/public/sprites/portraits/hub-signal-chaser.png`, 512×512 8-bit RGB
- **Billboard output ID:** `exec-d0b33430-c01e-464c-9e8e-30c12052708a.png`
- **Billboard original:** `/Users/nichalasbarnes/.codex/generated_images/019f5d85-985f-7d93-a56c-e9a171e6c280/exec-d0b33430-c01e-464c-9e8e-30c12052708a.png`
- **Billboard reference:** accepted signal-chaser portrait; face, build, sensor headset, cloak, antenna pack, shoulder instrument, and cyan glow locked
- **Billboard source:** `docs/assets/source/m3-hubs/cantina/hub-signal-chaser-billboard-source.png`, 887×1774 RGB
- **Billboard production:** `game/public/sprites/boarding/npc-hub-signal-chaser.png`, 128×256 8-bit RGBA
- **5%-alpha bounds:** 72×250+28+6; transparent corners and bottom contact present
- **Decision:** selected. The narrow silhouette, headset, pack, cloak, and restrained cyan instrument remain recognizable at 48px.

### NPC processing and deferred motion

- **Portrait processing:** Lanczos resize to exact 512×512, alpha removed, forced PNG color type 2
- **Billboard matte:** border auto-key, soft matte, transparent threshold 12, opaque threshold 220, despill
- **Billboard scale/canvas:** alpha trim, Lanczos fit inside 118×250, south gravity on exact 128×256 transparent canvas, forced PNG color type 6
- **Review:** identity-pair panel, actual 128×256 checkerboard, 48px silhouette check, and dark/bright composites
- **Evidence:** `npc-identity-pairs.png` and the completed `billboards-dark-bright.png`
- **Walk frames:** intentionally deferred because the M3 manifest and current asset contract specify idle pairs only. The bartender is the first future walk-frame candidate after integration establishes a real consumer.

## Commands recorded

```bash
magick wall-source.png -roll +627+627 wall-offset.png
magick montage wall-source.png wall-source.png wall-source.png wall-source.png -tile 2x2 -geometry +0+0 wall-2x2.png
magick wall-source.png -filter Lanczos -resize 512x512! -alpha off -type TrueColor wall.png
magick floor-source.png -filter Lanczos -resize 512x512! -alpha off -type TrueColor floor.png
magick ceiling-source.png -filter Lanczos -resize 512x512! -alpha off -type TrueColor ceiling.png
magick facade-source.png -filter Lanczos -resize 64x64! -alpha off -type TrueColor cantina.png
remove_chroma_key.py --input prop-source.png --out prop-alpha.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
magick prop-alpha.png -trim +repage -filter Lanczos -resize "232x230>" -gravity south -background none -extent 256x256 -colorspace sRGB -define png:color-type=6 prop.png
magick portrait-source.png -filter Lanczos -resize 512x512! -alpha off -type TrueColor -define png:color-type=2 portrait.png
magick npc-alpha.png -trim +repage -filter Lanczos -resize "118x250>" -gravity south -background none -extent 128x256 -colorspace sRGB -define png:color-type=6 npc.png
```

The first derivative was inspection-only and was removed from the production path after the
seam rejection.

## Production-art handoff

- **Manifest state:** every Cantina entry is exactly `PRODUCTION-REVIEWED, NOT REGISTERED,
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

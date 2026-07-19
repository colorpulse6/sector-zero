# Marketplace Asset Production Provenance

**Started:** 2026-07-19
**Bundle status:** PRODUCTION-REVIEWED — NOT REGISTERED — NOT INTEGRATED
**Temporary workspace:** `/private/tmp/sector-zero-m3-marketplace/`

## Environment sources — SELECTED

All four textures were generated separately with the Codex built-in `image_gen`
(`gpt-image-2` path). The selected Cantina wall was attached only to preserve the shared
Ashfall material language and visual chronology. Marketplace composition remained colder,
denser, and cargo-oriented rather than becoming a cyan palette swap. Seeds were not exposed.

Each source was copied to its manifest `sourcePath`, inspected with a +627/+627 offset and
2×2 montage, and downscaled with Lanczos to an opaque 8-bit sRGB RGB PNG. An independent
visual review accepted all four joins as authored panel/rail structure rather than
boundary-only seams or exposure bands.

| Asset | Output ID | Raw/source contract | Production path and contract | Decision |
|---|---|---|---|---|
| Interior wall | `exec-56eb860b-c20a-4562-a677-6ff96090a21c.png` | `wall-source.png`, 1254×1254 RGB | `game/public/sprites/interiors/m3/marketplace/wall.png`, 512×512 RGB | Selected. Dense vents, stall rails, repair plates, and sensors create a busier exchange-floor rhythm than the Cantina. |
| Interior floor | `exec-9238df15-1101-461c-bfda-39cca2dac029.png` | `floor-source.png`, 1254×1254 RGB | `game/public/sprites/interiors/m3/marketplace/floor.png`, 512×512 RGB | Selected. Cargo plates, tread sections, wheel wear, and geometric hazard insets retain continuous joins. |
| Interior ceiling | `exec-54ccf443-b7dc-4e7e-a796-08cd8ac020ff.png` | `ceiling-source.png`, 1254×1254 RGB | `game/public/sprites/interiors/m3/marketplace/ceiling.png`, 512×512 RGB | Selected. Heavy cargo rails, cable runs, and cold work lights read as an overhead utility grid. |
| Exterior facade | `exec-7a722bba-e398-4320-b0e6-e97e06fc7bc6.png` | `facade-source.png`, 1254×1254 RGB | `game/public/sprites/walls/marketplace.png`, 64×64 RGB | Selected. Blast-shutter bands and the single recessed cyan beacon remain legible in the exact 64px derivative. |

Original outputs live under
`/Users/nichalasbarnes/.codex/generated_images/019f5d85-985f-7d93-a56c-e9a171e6c280/`.
No environment retry was required: every first candidate passed the offset, 2×2, chronology,
and hub-distinction gates. Temporary previews remain outside the repository.

## Prop billboards — SELECTED

All five props were generated separately on a flat `#00ff00` field, using the selected
Marketplace wall only as a material/style reference. No floor plane, cast shadow, readable
text, or extra subject was accepted. Sources are 8-bit sRGB RGB; productions are exact
256×256 8-bit sRGB RGBA canvases.

| Asset | Output ID | Raw contract | 5%-alpha bounds | Decision |
|---|---|---:|---:|---|
| Vendor counter | `exec-58dc06ca-0c14-42fb-9e2e-eea1854206a2.png` | 1254×1254 RGB | 232×127+12+129 | Selected. Wide locked cargo-counter silhouette and abstract transaction pad remain clear at actual size. |
| Weapon rack | `exec-503721c2-55c3-4135-a5c7-8788152cf82f.png` | 1254×1254 RGB | 174×230+41+26 | Selected. Secured chunky tool/weapon forms read as one tall rack without brand or label shapes. |
| Supply crates | `exec-0523785a-7ecf-4a56-b8f3-976de37a8404.png` | 1254×1254 RGB | 209×230+23+26 | Selected. Exactly three reinforced containers form one stable, asymmetrical stack. |
| Trade terminal | `exec-fa827672-ac90-4cb0-8a4f-1bcd7fe31043.png` | 1024×1536 RGB | 134×230+61+26 | Selected. The tall kiosk and abstract cyan graph remain legible without prices, symbols, or readable UI. |
| Cable bundle | `exec-37b5fc7d-1f05-47ac-b310-f6ce243cf49c.png` | 1254×1254 RGB | 232×227+12+29 | Selected. Thick hoses, couplers, and junction block survive downscaling as one grounded silhouette. |

### Prop processing and review

- **Matte:** installed `remove_chroma_key.py`, border auto-key, soft matte, transparent
  threshold 12, opaque threshold 220, despill
- **Dependency isolation:** Pillow 12.3.0 exists only in
  `/private/tmp/sector-zero-m3-imagegen-venv`; no Python dependency entered the repository
- **Scale/canvas:** alpha trim, Lanczos fit inside 232×230, south gravity on exact 256×256
  transparent canvas, forced PNG color type 6
- **Review:** actual-size checkerboard plus dark/bright composites; all corners transparent,
  all bottom bands occupied, no green fringe or fog rectangle observed
- **Evidence:** `props-actual-size.png` and the prop rows of
  `billboards-dark-bright.png`

## NPC identity pairs — SELECTED

Portraits were generated first. Each accepted portrait was then attached as the only
identity reference for its full-body billboard. Billboard sources use the flat-green
override and the same local matte path as the props. Seeds were not exposed.

### `hub-arms-dealer`

- **Portrait output:** `exec-52cbe1a5-7e5c-415f-8afe-72079f552d7f.png`; 1254×1254 RGB
- **Portrait production:** `game/public/sprites/portraits/hub-arms-dealer.png`, 512×512 RGB
- **Billboard output:** `exec-53ce3fc4-29ae-4d07-9b5a-f20a4806710e.png`; 887×1774 RGB
- **Billboard reference lock:** scarred bearded face, stocky build, reinforced vest, heavy
  shoulder brace, utility gear, and locked sample case
- **Billboard production:** `game/public/sprites/boarding/npc-hub-arms-dealer.png`,
  128×256 RGBA; 5%-alpha bounds 111×250+8+6
- **Decision:** selected. The broad security silhouette and sample case survive the 48px
  check without turning the role into a gun pose.

### `hub-provisioner`

- **Portrait output:** `exec-7f49084f-525b-48e8-b598-e2f514c2315a.png`; 1254×1254 RGB
- **Portrait production:** `game/public/sprites/portraits/hub-provisioner.png`, 512×512 RGB
- **Billboard output:** `exec-3849a0ad-5d8d-46c4-bb57-267a4b2843f7.png`; 887×1774 RGB
- **Billboard reference lock:** younger weathered face, short dark hair and beard, layered
  dust scarf, cargo suit, thick gloves, modular pouches, and inventory scanner
- **Billboard production:** `game/public/sprites/boarding/npc-hub-provisioner.png`,
  128×256 RGBA; 5%-alpha bounds 87×250+20+6
- **Decision:** selected. The scanner, scarf, and balanced load-bearing silhouette remain
  identifiable at portrait, actual billboard, and 48px scales.

### `hub-contract-broker`

- **Portrait output:** `exec-86d5f997-8793-48dc-bc33-eb756e974cb9.png`; 1254×1254 RGB
- **Portrait production:** `game/public/sprites/portraits/hub-contract-broker.png`, 512×512 RGB
- **Billboard output:** `exec-5765334f-31ff-4ae2-b524-2ccdaa4f659c.png`; 887×1774 RGB
- **Billboard reference lock:** mature angular face, gray-templed dark hair, damaged optical
  implant on the same eye, long armored coat, gloves, and cyan data slate
- **Billboard production:** `game/public/sprites/boarding/npc-hub-contract-broker.png`,
  128×256 RGBA; 5%-alpha bounds 88×250+20+6
- **Decision:** selected. The administrative coat/slate silhouette remains dangerous but
  avoids sunglasses, a briefcase, or readable contract text.

### NPC processing and deferred motion

- **Portrait processing:** Lanczos resize to exact 512×512, alpha removed, forced PNG color
  type 2
- **Billboard matte:** border auto-key, soft matte, transparent threshold 12, opaque
  threshold 220, despill
- **Billboard scale/canvas:** alpha trim, Lanczos fit inside 118×250, south gravity on exact
  128×256 transparent canvas, forced PNG color type 6
- **Review:** side-by-side identity panel, actual 128×256 checkerboard, 48px character check,
  and dark/bright composites
- **Evidence:** `npc-identity-pairs.png` and the complete
  `billboards-dark-bright.png`
- **Walk frames:** intentionally deferred. They have no M3 manifest or runtime consumer; the
  contract broker is the first future walk-frame candidate after integration.

## Recorded commands

```bash
magick source.png -roll +627+627 source-offset.png
magick montage source.png source.png source.png source.png -tile 2x2 -geometry +0+0 source-2x2.png
magick source.png -filter Lanczos -resize 512x512! -alpha off -type TrueColor -define png:color-type=2 texture.png
magick facade-source.png -filter Lanczos -resize 64x64! -alpha off -type TrueColor -define png:color-type=2 marketplace.png
/private/tmp/sector-zero-m3-imagegen-venv/bin/python /Users/nichalasbarnes/.codex/skills/.system/imagegen/scripts/remove_chroma_key.py --input billboard-source.png --out billboard-alpha.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill --force
magick prop-alpha.png -trim +repage -filter Lanczos -resize "232x230>" -gravity south -background none -extent 256x256 -define png:color-type=6 prop.png
magick npc-alpha.png -trim +repage -filter Lanczos -resize "118x250>" -gravity south -background none -extent 128x256 -define png:color-type=6 npc.png
```

The complete Marketplace bundle passed its category-level production contract and is promoted
only to `PRODUCTION-REVIEWED`. Presence in the repository does not register or integrate any
asset at runtime.

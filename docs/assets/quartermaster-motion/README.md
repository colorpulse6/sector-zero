# Quartermaster motion asset pilot

The editable source is `quartermaster-pilot.blend`. It contains the real Quaternius humanoid mesh and skeleton, weighted canvas garment mesh, layered rigid accessories, three authored joint-animation clips, a separate workstation, an orthographic camera and a repeatable three-light setup. The unmodified imported base is packed into `source/quartermaster-base.blend`. No image generation service or paid model API was used.

## Recreate

From the repository root, with Blender 4.4.3 and Python with Pillow:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python game/scripts/quartermaster/render_pilot.py
python3 game/scripts/quartermaster/pack_atlases.py
```

On this machine the bundled Pillow interpreter is `/Users/nichalasbarnes/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3`. Rendering needs no Blender add-on, MCP server or external Python package. `-- --sample` renders a smaller review selection and two 256x512 inspection images. A full render regenerates the source `.blend`, every cell, and the workstation; the packer verifies and assembles the cells without resampling or alpha compositing. Raw cells live only in the system temporary directory `sector-zero-quartermaster-frames`. Cycles uses 24 samples, denoising, CPU, AgX medium-high contrast, and a fixed procedural seed of 20260906.

## Clip and camera contract

| Clip | Timeline frames | Atlas columns | Atlas size |
|---|---:|---:|---:|
| idle | 1–4 | 4 | 512x2048 |
| walk | 11–18 | 8 | 1024x2048 |
| work | 21–28 | 8 | 1024x2048 |

All clips use eight rows and 128x256 transparent RGBA cells. Row 0 is the front. The camera then orbits toward the actor's right at 45-degree steps: front-right, right, back-right, back, back-left, left, front-left. In Blender, the character faces -Y and the character's right is -X. Framing and scale remain fixed; the nominal projected floor is at y=244. Two-bone anatomical poses move arms, thighs, calves, feet and hands; the handheld scanner follows the left hand. The work clip's right hand performs a small inventory interaction. The actor root remains stationary for all clips; runtime supplies travel.

`direction-contact-sheet.png`, `walk-inspection.gif` and `work-inspection.gif` are inspection artifacts. `asset-verification.json` records dimensions, bytes, SHA-256 hashes and per-cell alpha bounds. The workstation is a separate 512x512 RGBA render; it does not require synchronized hand contact.

## Sources and authorship

The free Standard version of [Quaternius Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) was downloaded from the [author's itch.io page](https://quaternius.itch.io/universal-base-characters) on 2026-09-06 without an account or payment. Its bundled license is `source/License_Standard.txt`: CC0 1.0. Only the male humanoid, buzzed hair, beard and their referenced textures are retained, packed in the imported base `.blend`. The free glTF rig was imported and edited; the paid source `.blend` was not obtained. The source pack's two missing `*_png.png` normal-map URI names were satisfied by byte-identical copies of the corresponding pack textures. `source-manifest.json` records exact source filenames and hashes. The downloaded ZIP and loose vendor files are not repository artifacts. To repeat this import from a fresh official Standard ZIP, use `Blender --background --factory-startup --python game/scripts/quartermaster/prepare_source.py -- --archive /path/to/archive.zip`; ordinary regeneration uses the retained base and does not need that ZIP.

The existing approved hero `../pilot/quartermaster-hero-v1-alpha.png` is used as a rest-space UV projection on the front face and canvas mesh. This restores some original identity and surface detail while the actual 3D geometry supplies silhouette, sides, back, lighting and limb motion. Its pixels remain unmodified. Skin outside the front projection retains the sourced humanoid materials; side/back clothing uses procedural materials. The workstation, garment shell, rig poses, armor, harness, pouches, scanner and wear geometry are authored by the regeneration script for this pilot.

## Art limits

This is a consistent 3D pilot, not a sculpted reconstruction of the high-resolution original hero. The sourced head topology, broad accessory shapes and procedural side/back surfaces are visibly simpler, especially in enlarged inspection renders. Front-projected image detail also contains some baked illumination from the original. At runtime the asset receives the existing scene shading on top of modest baked key/fill/rim lighting. Final in-scene approval and renderer-performance evidence belong to the runtime integration; PNG validation alone does not establish visual equivalence to the original art.

# First-person actor motion sources

Nine new live identities extend the approved quartermaster pipeline: Voss, Kael,
Reyes, survivor, scavenger, bartender, regular, signal chaser, and the shared hostile.
The quartermaster source, assets, and animations remain in their original directory.

## Regeneration

From the repository root, with Blender 4.4.3 and Python with Pillow:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python game/scripts/actors/render_actors.py -- --engine cycles
python3 game/scripts/actors/pack_atlases.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python game/scripts/actors/verify_sources.py
```

On this machine Pillow is available through
`/Users/nichalasbarnes/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3`.
Use `--actors voss,reyes` to render selected identities. `--sample` renders front and
right-profile clip samples; pack these with `pack_atlases.py --sample --actors voss,reyes`.
Use `--actors hostile --clips attack,hurt` to rebuild only those clips after a pose
correction; the previous complete clip receipts and other cells are retained.
Raw native cells are temporary files under `sector-zero-actor-frames` in the OS temporary
directory. The packer copies straight-alpha cells without compositing or resampling.

## Cell contract

| Family | Clips | Cell | Rows |
|---|---|---|---|
| Eight humanoids | idle 4 columns; walk 8 columns | 128×256 RGBA | 8 |
| Hostile | idle 4; walk 8; attack 4; hurt 1 | 256×256 RGBA | 8 |
| Hostile death | 6 columns | 256×256 RGBA | 1, front |

Row order is front, front-right, right, back-right, back, back-left, left, front-left.
The Blender actor faces -Y; the camera orbits toward -X (the actor's right). The
orthographic camera and framing stay fixed between all cells of a given family.
Root travel belongs to runtime; the walk geometry is an in-place joint animation.

## Actual source geometry

The generator reads the packed Quaternius humanoid base by relative repository path:
`../quartermaster-motion/source/quartermaster-base.blend`. It reuses the anatomical
65-bone rig and two-bone pose solver from the quartermaster script. Distinct meshes,
body proportions, hair, clothing, and role equipment are authored for each profile.
Weighted garment meshes follow the same joints as the body. Rigid accessories follow
their relevant bones. Voss' split coat, Kael's lab coat, Reyes' flight harness and
goggles, scavenger hood, bartender apron/prosthesis, regular's respiratory collar,
and signal chaser's cowl/antenna are actual three-dimensional geometry.

`voss-editable.blend` is the representative human source; the script and profile
table reconstruct the other seven without seven additional packed vendor copies.
`hostile-editable.blend` contains a separately authored articulated sculpture:
tapered skull and torso, overlapping fractured carapace, swept horns, recessed ember
eyes/core, clawed fingers and feet. Its idle, walk, attack, hurt, and death are keyed
joint poses. No third-party monster mesh is used.

## References and licensing

The shared humanoid is Quaternius Universal Base Characters Standard, CC0 1.0.
Its retained license is `source/License_Standard.txt`; the original archive/source
hashes and official URLs are in `../quartermaster-motion/source-manifest.json`.
This directory does not duplicate the downloaded archive or packed base.

Voss, Reyes, Kael, survivor, and scavenger have detailed front reference images
restored with the built-in image generation tool from their existing billboards.
The selected outputs and exact prompts are recorded in `source-provenance.json`.
Bartender, regular, and signal chaser use the already retained high-resolution M3
billboard sources; their original identity/production review is under
`../reviews/m3-hubs/cantina/`. The hostile uses the existing `enemy-fp-front.png`.

These images supply a masked rest-space **material color projection onto real
meshes**, not billboard geometry or animation frames. The source images are
unmodified. Some generated sources returned an opaque checker backdrop despite a
transparent request; pale backdrop pixels are excluded in the Blender material.
Green M3 backdrop pixels are similarly excluded by a material mask. All runtime
transparency comes from Blender's transparent-film render, not source-image mattes.
Side/back surfaces use modeled detail and procedural worn materials.

## Verification and limits

`asset-manifest.json` records every final atlas and cell, dimensions, bounds, bytes,
and SHA-256. The packer rejects missing/clipped/empty/non-RGBA cells. Each identity's
source-verification file records its real rig/mesh/action census. Reopening both
retained editable sources verifies packed image dependencies, genuine 3D bounds,
and distinct keyed walk, attack, hurt, and death poses. Fresh front renders from
both retained sources must match the shipped atlas cells pixel for pixel (Voss idle,
hostile peak attack). Hostile source checks also require every talon to advance
toward -Y during the strike and the skull to recoil toward +Y on a hit.
Cycles uses 20 samples, seed 0, and no animated seed. Direction sheets and walk/
attack/death GIFs support visual inspection.

These are runtime-scale interpretations on a shared humanoid foundation, not exact
sculpted facial likenesses. Side/back costume surfaces are simpler than the detailed
front references. Front reference color contains some baked light in addition to
the consistent Blender key/fill/rim setup and runtime scene lighting. Gameplay-size
identity review and real-scene framing remain the final art acceptance criteria.

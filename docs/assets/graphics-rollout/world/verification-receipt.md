# World-kit verification — 2026-09-06

The parent reviewed the purifier facade, purifier pump and mine extractor samples and authorized the full batch. Final steel materials use restrained tonal noise and fine surface bump, with modeled seams, hex bolts, abrasion, pipe flanges and machined parts. The extractor includes a continuous helical cutting flight. All 32 catalog entries are rendered and staged at their declared production paths.

| Check | Observed result |
|---|---|
| Blender render | Blender 4.4.3, CPU Cycles, 24 samples, fixed seed 20260906; exit 0 |
| Runtime PNG census | 32 files: 23 opaque tiles and 9 transparent props; every file 512×512 |
| Source PNG census | 23 tiles at 512×512; 9 props at 1024×1024 |
| Alpha/framing | All opaque tiles fully opaque; every prop has transparent background, an unclipped source silhouette and bottom contact in its runtime canvas |
| Runtime bytes | 9,509,544 |
| Source PNG bytes | 18,955,672 |
| Compressed editable source | 1,496,481 bytes; 32 asset collections, 6,531 mesh objects, 57,481 mesh vertices |
| External source dependencies | None: original geometry and procedural node materials, no external image files |
| Tiling checks | All 23 raw tiles flagged for visual seam review; no raster seam correction applied |
| Largest measured edge differences | Ruin wall: mean RGB delta 33.626 horizontally, 24.201 vertically, on the 0–255 scale |

The generator, runtime verifier and independent Blender-source inspector completed successfully. The manifest records each source/output SHA-256, dimension, byte count and alpha bounds; the source receipt records saved-file geometry and camera metadata. Tile derivative pixels remain identical to their raw Blender renders. Prop processing is limited to transparent framing and production-size resampling. Contact sheets and all 23 two-by-two material previews were generated; the complete material/prop sheets were visually inspected.

The 32 outputs consist of 11 replacements and 21 new world assets. Existing approved mine facade, all M3 assets and quartermaster assets were preserved. Only the environment-art lane's script, source, review and assigned PNG paths were edited; no TypeScript, browser run, game build or commit was performed in this lane.

Remaining visual risk is raw tile repetition: matching modular forms do not guarantee seamless baked lighting or procedural surface noise. Most opposite-edge mean RGB differences are approximately 11–17 levels, while the fractured mine/ruin surfaces are larger. The parent explicitly accepted raw derivatives with measured seam differences for runtime inspection. No seamlessness or gameplay-performance claim is made by this receipt.

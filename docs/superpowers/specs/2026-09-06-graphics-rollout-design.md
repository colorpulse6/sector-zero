# DOOM graphics rollout

The user approved the playable quartermaster at `a334698` and requested the same treatment across the game, more detailed static assets, adjusted backgrounds and new assets where needed. Keep browser play and the existing DOOM/raycaster presentation. This rollout extends that approved design; it does not introduce an engine migration.

Working scope is every currently playable first-person environment and actor: Ashfall camp, colony exteriors, five utility interiors, Cantina, generic station combat, Kepler and Cinder ruins. An optional scope question distinguishes these from the separate 2D combat/portrait/menu library. Work common to both choices proceeds immediately.

## Renderer and backgrounds

The current sky samples one image texel per output pixel from a 512-wide panorama, showing roughly 338 degrees in a 480-pixel view. Replace this with camera-ray angular sampling, correct wraparound and a reusable per-column lookup. Decode panorama art at up to 2048 pixels wide. New seamless Ashfall panorama retains the worn desert/industrial mood and horizon alignment. Keep close world geometry out of the sky image.

Static materials should retain more source detail: 256-pixel tiles, up to 512-pixel props, existing 128x256 actor cells. Texture mip levels reduce distance shimmer in floors/ceilings; preserve crisp nearby detail. Texture dimensions and cache limits remain explicit. Renderer behavior must be verified with analytical direction tests, wrap tests and the existing golden corpus; update only goldens justified by intentional projection changes.

## Environment assets and scene dressing

Replace low-resolution utility facades, pad/foundation, scaffolding and room props with detailed worn industrial assets from editable Blender sources. The existing 512-pixel mine wall and production-reviewed M3 Cantina library are reusable. Do not regenerate a complete approved asset only because its renderer previously discarded detail.

Give solar, farm, purifier, habitat and mine rooms distinct material/dressing sets and ceilings. Mine receives an actual extraction rig. Preserve footprint, map solidity, spawn/exit tiles and purchase logic. Add restrained equipment/props only on safe decorative positions. Give station combat and Kepler/Cinder ruins proper wall/floor/ceiling art and distinctive dressing without changing the combat map or enemy roster.

## Actors and animation

Live identities are Voss, Kael, Reyes, survivor, scavenger, quartermaster, bartender, regular and signal chaser, plus one shared hostile creature. Use one editable rig/camera convention with distinct identity-aware costumes, head shapes and role equipment. Preserve approved quartermaster art and behavior. Do not give everyone his scanner or inventory gesture.

New humanoids use 8 directions, 4 idle columns and 8 walk columns, 128x256 RGBA cells. Stationary named NPCs get breathing/role gestures and may turn toward the player in dialogue only if that does not violate the established freeze contract. Colony walkers derive facing and gait from actual movement; replace perpetual idle drift with stationary pauses and bounded purposeful movement. Existing entry-hour schedules remain authoritative.

The shared hostile creature gains directional locomotion, attack, transient hurt and death presentation from a faithful Blender source. Maintain AI speeds, damage, affinity, LOS, hit cooldowns and rewards. Generic campaign/dev FP conversion routes, Kepler and Cinder must all use the presentation. Frame selection cannot advance from render calls.

Generalize atlas metadata into a small catalog; load only sets required by the active scene. Missing new images use existing static sprites. Cap extracted atlas texels at 40 MiB, using a separate reusable frame-slot pool so map texture IDs are never evicted or changed. Retain only active-scene source atlases, with an 80 MiB decoded-image ceiling; omit lower-priority new sets and retain legacy sprites if a scene exceeds that ceiling. Release unneeded source images on scene change; late completions for departed scenes must not become resident. Repeated exterior/interior/combat/return transitions verify these bounds and image-load recovery. Reference roles, body silhouettes, frame counts, source/license information and regeneration commands belong in an asset manifest.

## Verification and delivery

Maintain a coverage inventory recording every live family as upgraded, reused-with-improved-rendering, or awaiting work. The final first-person coverage must have no awaiting entries. Preserve original quest/shop/saves. No dormant Marketplace/Town Hall gameplay is added merely to consume stored art.

Run engine, colony and sprite suites; targeted browser scenarios cover the complete Ashfall camera turn, exterior/utility room/Cantina/station/ruins, animated NPCs and enemy presentation, failed-image fallback, normal purchases and dialogue freeze. Build with `/sector-zero` base path and inspect the production build in the browser. Retain actual screenshots, source contact sheets and local renderer/per-scene transfer measurements. No broad device-performance claim from one machine.

Deliver an isolated, committed rollout branch and playable inspection route using real scene constructors. Keep the approved pilot available for comparison. User approval of the visual direction is already explicit; only a changed scope or costly external service needs additional input.

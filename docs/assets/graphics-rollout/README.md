# First-person graphics rollout — 2026-09-06

Browser play remains the priority. This pass extends the approved DOOM-style quartermaster pilot in the existing raycaster: Blender-authored characters become directional animation atlases, static models become detailed billboards and material tiles, and generated background art supplies the Ashfall sky and ground. There is no graphics-engine migration or new paid runtime dependency.

## Live coverage

| Family | Treatment |
|---|---|
| Ashfall camp and colony exterior | New continuous panorama and calmer ground; camera-correct sky projection; higher-detail decoded surfaces and props |
| Solar, farm, purifier and habitat facades | New 512px Blender renders with seams, vents, hardware and wear |
| Mine and Cantina facades | Existing reviewed art retained, displayed through the higher-detail decoder |
| Landing pad, foundation, scaffolding | New 512px tiles/billboard |
| Five utility interiors | Distinct walls/floors, enclosed ceilings, rebuilt equipment and bunks; dedicated mine extractor |
| Cantina | Existing reviewed materials and four props retained; bartender, regular and signal chaser receive directional animation |
| Generic station combat and Kepler | Shared station walls/floor/ceiling and decorative machinery, wired through real campaign, dev and mission constructors |
| Cinder ruins | Separate fractured ruin kit and remnants, retaining its real map/objective |
| Voss, Kael, Reyes, survivor, scavenger | Individual costume/appearance, 8 directions, idle and walk clips |
| Quartermaster | Approved pilot source and animation unchanged; existing inventory/walk/work routine retained |
| Three Cantina identities | Individual 8-direction idle/walk sheets; existing authored schedules and dialogue remain authoritative |
| Shared hostile creature | Angular original-design model, 8-direction idle/walk/attack/hurt plus a six-frame death; actual combat events select the action |

The gallery at `/graphics-preview/` uses 11 actual scene factories with controls for scene, actor, viewpoint, lighting and resolution. Its save is an in-memory fixture. Main-game campaign, colony and mission routes consume the same assets. Dormant shops and the separate 2D combat/menu/portrait libraries are outside this first-person rollout.

## Rendering and resource boundaries

- Tiles decode to 256px with mip levels, skies up to 2048×512, static billboards up to 512px. Humanoid cells stay 128×256; hostile cells are 256×256.
- Sky columns follow camera ray angles rather than one source texel per screen pixel. Wrap is independent of viewport resolution.
- Floor/ceiling filtering includes lateral and forward pixel footprints; walls select a level by projected height. Near surfaces keep source detail.
- Static props and their labels use the projected floor plane, so machinery rests on the floor at every size and distance.
- Active actor source images reserve at most 80MiB. Whole character sets that do not fit retain the original static fallback. Departed-scene and late image arrivals are released.
- Decoded actor frames use a separate 40MiB / 320-slot LRU pool. Scene changes cannot recycle cached static map texture IDs.
- Walk phases follow actual travel; fixed characters breathe in place. Dialogue freezes presentation, and hostile hurt is transient rather than permanently selected by low health.

## Sources and receipts

- `world/manifest.json`, `world/world-kit.blend` and `game/scripts/world-assets/` record all 32 Blender-derived environment outputs (11 replacements, 21 new files).
- `world/ashfall-generated.json` records two unchanged native-generated background sources and their runtime copies.
- `docs/assets/actor-motion/` and `game/scripts/actors/` retain actor references, representative editable source, identity profiles, atlas/frame manifests and review sheets. The accepted quartermaster source remains the shared humanoid base.
- `verification.md` contains final command results, browser observations, local timings and integration state.

Raw Blender material tiles have measurable edge differences; panel repetition remains visible by design, and fractured ruin tiles are less seamless than uniform metal. The full-turn sky and repeated surfaces were reviewed in the actual renderer. This is an authored first-person art pass, with the raycaster's existing flat-floor and billboard geometry limits.

# Quartermaster motion pilot

Approved direction: user accepted the proposed pilot on 2026-09-06. Preserve the existing DOOM presentation and browser runtime. Produce a playable upgrade of the quartermaster and immediate surroundings, not an engine migration.

## Deliverable

- One consistent Blender-authored humanoid quartermaster with worn brown/gunmetal workwear, equipment and restrained cyan emissives, rendered as eight directional views with idle, walk and work animation.
- A detailed workstation near the existing quartermaster post, without blocking navigation, doors or the landing pad. Keep shop behavior, faction permission and saves unchanged.
- Distance-driven walk animation and purposeful quartermaster stops/turns/work instead of the existing perpetual idle drift. Other NPC behavior stays unchanged. Existing dialogue freeze remains authoritative.
- First-person weapon bob follows actual collision-resolved player travel, settles while stationary, and freezes during dialogue. Subtle recoil uses the existing firing state. No camera shake or movement-speed changes.
- A deterministic preview route using the real colony renderer and NPC logic, plus verification of actual colony integration. Keep original static sprites as asset-loading fallbacks.

## Asset contract

Source and regeneration scripts: `docs/assets/quartermaster-motion/` and `game/scripts/quartermaster/`. Runtime assets: `game/public/sprites/pilot/quartermaster/`.

Three transparent PNG atlases: `idle.png` (4 columns, 8 rows), `walk.png` (8 columns, 8 rows), `work.png` (8 columns, 8 rows). Each cell is 128x256. Row 0 shows the character from the front; row increments follow a viewer orbit in 45-degree steps toward the character's right side, then back, then left. All frames share framing, scale and floor baseline. Work motion must be self-contained (handheld inventory scanner/tablet), so it reads from every side and avoids requiring exact hand contact with a billboard table. A separate `workstation.png` is at most 512x512, transparent. Preserve editable Blender source and source/license manifest. No paid model APIs or downloads.

## Runtime contract

Add opt-in directional atlas metadata/state to FPNPC. Keep old sprite resolution for all existing actors. A pure selector chooses clip/frame and viewer-relative facing row. Walk phase advances from traveled distance, stationary clips from clamped simulation delta. TextureRegistry crops atlas cells, caches bounded decoded frames and uses existing static fallback while loading or on failure. Load only this pilot's three atlases and workstation on colony/preview entry, not global startup. Asset loading remains base-path safe and browser-only.

Quartermaster motion is state-owned and deterministic: follow existing schedule target; on arrival alternate work/idle with a short walk to a nearby walkable tile and return. Do not cross blocked cells, drift while working, teleport to unreachable targets or turn backwards across angle wrap. Freeze movement and animation with dialogue. The workstation remains at the daytime post.

The preview uses a local fixture and does not write to player saves. It provides an immediate way to walk around the actor and see automatic motion, with normal DOOM rendering and optional view controls for inspection. Any inspection controls remain on this preview route only.

## Validation

Test direction wrap/cardinal sides, distance-based gait, clip timing, no-motion/boundary collision behavior, dialogue freeze, fallback behavior and atlas crops. Verify PNG dimensions, transparency, frame bounds and source manifest. Run existing engine, colony and sprite suites, static build, a browser test covering the preview and actual colony entry/shop contract, then visually inspect front/back/side and movement evidence. Measure warm renderer cost and asset transfer size; do not claim broad device performance from one machine.

The principal risk is art quality: passing code tests cannot establish that a procedural or sourced base matches the existing detailed hero. Inspect a rendered character sample before committing to the full batch; report any remaining identity/style difference explicitly.

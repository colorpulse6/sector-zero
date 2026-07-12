# Sector Zero — Master Style Guide (Modern DOOM)

**This is the authoritative art direction for ALL Sector Zero assets.** It supersedes the
aesthetic section of `../colony-phase-2/00-shared-style-guide.md` (whose biome, perspective,
and process conventions still apply). Every asset prompt in every subfolder inherits this
guide; per-asset prompts add subject and framing, never a different aesthetic.

Source of truth: `docs/superpowers/specs/2026-07-05-visual-overhaul-doom-design.md` §2, §5.1.

---

## 1. North star

> Sector Zero looks like **DOOM (2016) / DOOM Eternal rendered as 2.5D billboards**:
> high-fidelity, visceral, grounded industrial sci-fi colliding with hell. Every surface is
> heavy, worn, scarred metal and cracked concrete under crushed near-black shadow — then torn
> open by intense emissive hellfire, lava, plasma, and tech-screen glow. Two registers fight
> each other: cold dead UAC-style tech-base and hot demonic-organic corruption bleeding
> through. The **Ashfall outpost is the tech-base; the FP descent drops into the corruption.**
> Feeling: dread + power fantasy — oppressive, metal, kinetic.

Global look: **low ambient saturation + very high contrast.** Color belongs to *light
sources*, not surfaces.

## 2. Palette

### Surface tier (desaturated — what things are MADE of)

| Name | Hex | Use |
|---|---|---|
| Void | `#05070b` | Deep space, pit shadows, occluded interiors |
| Base-black | `#0a0e17` | *(existing token)* backgrounds, panel gaps |
| Gunmetal | `#2b2f36` | Primary metal — hulls, walls, machines |
| Steel | `#565e68` | Lit metal faces, worn edges, catwalks |
| Rust | `#8a4b2d` | Corrosion, old blood, oxidized plating |
| Concrete | `#4a4744` | Poured floors, bunker walls, debris |
| Ashfall dust | `#8a7a5c` | Ashfall biome ground, dust film on everything outdoors |

### Emissive tier (HDR hot-spots — what things EMIT)

| Name | Hex | Use |
|---|---|---|
| Hellfire | `#ff5a1e` | Fire, muzzle flash, furnace glow — the signature warm |
| Ember | `#d1341a` | Cooling fire, warning strips, hot vents |
| Lava | `#ffcf6e` → `#ffe9b0` | Molten cores, the hottest pixels on screen |
| Demon-red | `#ff3366` | *(existing token)* enemy eyes/cores, danger UI |
| Toxic-green | `#44ff99` | *(existing token)* plasma, toxic pools, pickups |
| Tech-cyan | `#00f0ff` | *(existing token)* screens, holograms, shields, friendly UI |
| Portal-purple | `#7800ff` | *(existing token)* portals, void energy, rare/arcane |

### THE RULE: emissive-only accents

**Cyan, purple, green, and red are LIGHT, never paint.** No cyan-painted armor, no purple
walls, no green fabric. If a surface shows these hues it is because something is *glowing* —
a screen, a core, a vent, a portal. Surfaces stay in the desaturated tier; the emissive tier
appears as small, intense, bloom-worthy hot-spots. This is what lets the runtime grade
(Layer A) and future bloom pass make them burn without nuking legibility.

## 3. Materials

- **Metal is heavy and worn:** brushed/gouged gunmetal, chipped edge highlights on steel,
  panel seams, rivets, kick-scuffs at floor height. Nothing factory-fresh.
- **Concrete is cracked and stained:** water streaks, soot shadows above vents, rebar showing
  at broken corners.
- **Organic corruption (hell register):** wet, sinewy, bone-and-cartilage growth that *invades*
  tech surfaces — always reads as intrusion, never decoration.
- **Glass/screens:** dark until lit; emissive tier only; scanline or hex-grid texture at close range.
- **No clean plastic, no chrome, no bright painted panels.**

## 4. Lighting

- **One key light per asset, hot and directional** — default: warm (hellfire `#ff5a1e`)
  key from upper-front-left, cool void fill. Tech-base interiors may swap to a cold
  steel/cyan key with warm accent spill.
- **Crushed shadows:** shadow terminator drops fast to near-black (`#05070b`–`#0a0e17`);
  no soft ambient gray mush.
- **Rim light** on silhouette edges (pick from the emissive tier appropriate to the subject)
  so sprites separate from dark backgrounds at small draw sizes.
- **Emissives bloom in-fiction:** paint a slight halo/gradient falloff around light sources —
  the runtime bloom will amplify exactly these pixels.

## 5. Form & silhouette

- **Silhouette first:** every enemy/NPC/prop must read as a unique black shape at **48 px**
  tall. Test by squinting. Bulky, asymmetric, weighted shapes over slender ones.
- **Chunky over fine:** heavy forms, thick limbs, oversized weapons/tools. Fine detail lives
  *inside* the silhouette as texture, never as thin protrusions that alias away.
- **Grounded:** billboards stand on their bottom edge with contact shadow; nothing floats.
- **Kinetic posing:** action-ready stances — coiled, mid-stride, braced. No T-poses, no
  neutral standing unless the asset is explicitly an idle frame.

## 6. Mood

Oppressive, metal, kinetic. Every scene answers: *what died here, and what is hunting you
now?* Ashfall (tech-base register) is cold, dusty, under-lit, functional. The descent (hell
register) is hot, wet, breathing. Neither is ever cheerful, pastel, cartoon, or clean.

## 7. Do / Don't

**DO**
- Desaturated surfaces + saturated emissive hot-spots
- Near-black crushed shadows; hot rim lights
- Wear: scratches, soot, rust, dents, dust on every surface
- Strong 48 px-readable silhouettes; chunky proportions
- Slight painted glow falloff around every light source
- Front-facing billboard framing, feet/base at bottom edge, transparent background

**DON'T**
- Pixel-art, 8/16-bit, dithering, visible pixel grid *(the old guide — now the opposite of the goal)*
- Cartoon/cel/anime shading, flat colors, outlines
- Saturated painted surfaces (no purple walls, no cyan armor)
- Soft even lighting, gray ambient, washed-out midtones
- Clean/new/showroom surfaces, chrome, gloss plastic
- Thin wispy silhouettes that vanish at raycaster draw sizes
- Text, letters, numbers, logos, watermarks, JPEG artifacts

## 8. Copy-paste prompt suffixes

Append to every generation prompt (after the asset-specific subject/framing):

**Positive suffix:**
```
modern DOOM (2016 / Eternal) aesthetic, gritty industrial sci-fi, heavy worn scarred
gunmetal and cracked concrete, crushed near-black shadows, very high contrast, low ambient
saturation, single hot directional key light, emissive glow accents only (hellfire orange
#ff5a1e, demon red #ff3366, toxic green #44ff99, tech cyan #00f0ff, portal purple #7800ff),
strong readable silhouette, chunky weighted forms, painterly realistic detail, game asset,
dark background separation, dramatic rim lighting
```

**Negative suffix:**
```
pixel art, 8-bit, 16-bit, dithering, visible pixels, cartoon, cel shading, anime, flat
colors, outline style, pastel, bright cheerful colors, saturated painted surfaces, clean new
pristine surfaces, chrome, gloss plastic, soft even lighting, washed out, low contrast, text,
letters, numbers, logos, watermark, signature, jpeg artifacts, blurry, white background halo
```

## 9. Per-asset spec template

Every asset prompt file uses this header (one block per asset):

```markdown
### <ASSET NAME>
- **Sprite ID:** SPRITES.<CONSTANT>            # matches sprites.ts
- **Path:** game/public/sprites/<class>/<file>.png
- **Resolution:** <W>×<H> px                   # EXACT — atlas frame math depends on it
- **Frames:** <n> (atlas, horizontal strip) | 1 (single billboard)
- **Framing:** <front-facing billboard | 64×64 tileable wall | top-down tile | ...>
- **Alpha:** <transparent bg | opaque tile>
- **Register:** <tech-base | hell | shared>
- **Key light:** <warm hellfire default | cold tech variant>
- **Seed:** <fixed integer — pin after first accepted result>
- **Prompt:** <subject + framing> + positive suffix
- **Negative:** negative suffix
- **Iteration notes:** <filled during generation>
```

**Seed discipline:** first accepted generation pins the seed; regenerating variants of the
same asset reuses the same seed + edited prompt. Style consistency across the library comes
from (in order): this guide's suffixes → a shared style-reference image → a trained style
LoRA once ~30 assets are accepted (spec §5.6).

## 10. Sprite-sheet / atlas warning

Several sprites are **width-divided atlases** — the engine slices frames by
`image.width / N`. Regenerated atlases MUST keep exact dimensions and frame layout
(see `game/scripts/sprites/sheets.ts` allowlist once it lands). Never run alpha matting or
regeneration on an atlas as a single image; process frame-by-frame preserving geometry.

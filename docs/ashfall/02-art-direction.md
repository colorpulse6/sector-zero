# 02 — Art direction: the Ashfall register

Authority above this document: `docs/assets/prompts/doom/00-master-style-guide.md` (modern DOOM,
2.5D billboards; emissive-only accents). Ashfall is that guide's **tech-base register**: cold,
dusty, under-lit, functional. This document tunes it to one place and says what a capture must
show to pass aesthetic acceptance.

## The sentence

**Rust sky, cold steel, warm lamps.** The planet is warm and the people are cold-coloured; the
only colour that belongs to the camp is the light it makes.

## Measured palette

Surface values are the mean colour of the live asset (`magick -resize 1x1`). They are facts about
the art already shipping, not aspirations.

| Role | Hex | Source | Rule |
| --- | --- | --- | --- |
| Sky, overall | `#503021` | `scrapyard-outpost-sky.png` mean | keep |
| Sky zenith | `#2D1F19` | top 200 px band | keep |
| Sky horizon | `#7B472C` | bottom 200 px band; the brightest band on screen | keep; it is where the eye lands |
| Ground | `#553C2D` | `scrapyard-outpost-ground.png` | keep |
| Perimeter frame | `#795E4B` | `scrapyard-outpost-wall-exterior.png` | keep (D6 defers a variant) |
| Landing pad | `#4F5358` | `landing-pad.png` | keep; the coolest large surface |
| Foundation | `#615E5C` | `foundation.png` | keep |
| Habitat facade | `#4A4743` | `walls/habitat.png` | keep; facades sit between pad and ground |
| Porch light | `#ffb066`, power 2 | `colonyLayout.ts` night lights | keep |
| Scaffold light | `#9fd0ff`, power 1.5 | same | keep |
| Ember (mast lamp) | `#d1341a` | master guide "Ember: warning strips" | new use |
| Tech cyan | `#00f0ff` | existing token | screens only: the supply station, terminals, HUD |

The master guide's `#8a7a5c` "Ashfall dust" is the painted dust film on props; the measured ground
is darker and redder because the sky light is baked into it. New props should take their dust tone
from the ground, not from the guide swatch.

## Materials (what things are made of)

| Material | Where | Look |
| --- | --- | --- |
| Packed ash | ground, every bottom edge | matte, no specular, reddish-brown; nothing clean touches it |
| Hull plate | facades, station, mast, lander (later) | gunmetal, riveted, kick-scuffed, dust settling on horizontals |
| Cast foundation | pad, foundations | pale concrete with expansion seams; the one surface that reads "built to last" |
| Canvas and cable | stall, mast guy-lines, scaffolding | sun-bleached, frayed, held with clips |

No chrome, no glass that is not a screen, no painted colour on any surface.

## Light

- **Day (the only galaxy condition today).** The projection clock pins the walk at 07:00, which
  `bucketForHour` classifies as day: identity tint, no point lights. The sky panorama carries a low
  sun on the horizon band; surfaces are lit flat. This is acceptable and is what the baseline
  captures show.
- **Night (legacy clock; galaxy after D4).** Tint `hueShift -20, saturation 0.7, lightness 0.55`;
  porch lights at operational doors; cool lights at scaffolds. Proposed addition: the Relay Mast
  carries an ember point light (`#d1341a`, power 1.2) while lit, so the camp has one red source
  visible from the pad at night. Lights are inverse-square in tile units (`lighting.ts`).
- **Interiors.** Neutral tint, template `baseLight`. Unchanged.

## Colour rules for anything new at Ashfall

1. Cyan is a screen, never paint. The supply station's monitor and any terminal glow cyan; nothing
   else does.
2. Ember and amber are lamps. The mast lamp, porch lamps, work lamps.
3. Green appears only in HUD success states (`#44ff99`). No toxic-green on the plain.
4. Purple does not appear at Ashfall. It belongs to the Fold register.
5. Surfaces live between `#2D1F19` and `#795E4B` (warm) or `#4A4743` and `#615E5C` (cool). If a
   new tile's mean colour falls outside, it is wrong for this place.

## Form and readability at gameplay size

The viewport is 480×854 with a 714 px game area. Rules the first kit must meet:

- A prop must read as a unique black shape at 48 px tall. The mast is a vertical line with a
  head; the station is a low block with a screen; scaffolding is an open frame.
- Billboards stand on their bottom edge; the renderer projects them onto the floor plane, so a
  floating subject will visibly hover.
- Facade textures tile across 3–4 wall units; a facade must survive repetition without a
  readable "logo" every tile (the habitat and solar facades already pass this).
- Labels (`FPProp.label`, NPC names) are 9–11 px monospace; keep prop labels to one or two words.

## HUD, dialog and type

Unchanged. The dialog box is 448×140 px, dark with the NPC's colour as a border; portraits are
88×88. Speaker colours in code: Overseer amber `#e8c060`, Quartermaster teal `#5fd0c0`,
colonist grey `#a0a0b0`. Keep them; they already follow "colour is light".

## Do and don't, Ashfall-specific

**Do:** dust on every horizontal; one hot lamp per structure; wide, low silhouettes with one
vertical (the mast); worn canvas; cables on the ground; a camp that looks packed to leave.
**Don't:** banners, heraldry, statues, anything ceremonial; clean concrete; neon strips; green
or purple light; a second mast or tower that competes with the landmark; interiors brighter than
the exterior.

## Proposed vs current, visual

| Element | Current (RUNS) | Proposed | New art needed |
| --- | --- | --- | --- |
| Sky, ground, pad, foundation, scaffolding, six facades | live | keep | none |
| Perimeter frame | live (stone-plate look) | keep for the lock; variant later (D6) | none now |
| Quartermaster + station | live, approved pilot | keep; add portrait | derivative only |
| Overseer | Voss billboard, no portrait | hub-governor pair (D1) | none (register existing) |
| Landmark | none | Relay Mast, lit/dark | 2 billboards (Kit C) |
| Night at Ashfall in the galaxy | never | depends on D4 | none |

## Aesthetic acceptance conditions (what a capture must show)

Taken in the actual game at 480×854 from a fresh galaxy save, no dev fixture:

1. Arrival frame from the spawn tile: pad texture, Quartermaster, SUPPLY STATION label, Overseer,
   and (once landed) the mast on one axis; horizon band readable; HUD legible.
2. A dialog frame with the Overseer portrait and one state line that matches the save.
3. The pad menu over the scene (contrast of the cyan panel against the rust sky).
4. If D4 lands: the same arrival frame at night with porch/ember lights.
5. One frame of the first building in each of its two states (scaffolding, facade).

Concept images, boards and this document do not close the gate; the captures do.

# M3 Hubs — Environment Prompts

For opaque textures, use the positive and negative suffixes from
`../doom/00-master-style-guide.md` verbatim. For transparent props, remove the suffix's
`dark background separation` and painted contact-shadow clauses and use the flat-green,
no-cast-shadow override in `README.md`. Generate at 1024×1024, then derive the exact
production sizes in `README.md`. Never ask an image model to produce several texture views
or props in one sheet.

## Shared texture rules

Append this block before the master positive suffix:

```text
single game texture only, orthographic square-on material view, perfectly seamless on all
four edges, uniform scale and exposure across the entire image, no perspective convergence,
no room corners, no horizon, no vignette, no border, no isolated hero object, no writing,
no letters, no numbers, no symbols that resemble readable language
```

Append this block before the master negative suffix:

```text
room scene, corridor scene, perspective, vanishing point, corner, horizon, frame, border,
vignette, centered object, readable sign, words, logo, watermark, non-tileable edge, lighting
gradient across the whole texture
```

The model's claim that a result is seamless is not evidence. Verify with a 2×2 montage and
an offset inspection before accepting it.

## Cantina kit

**Role:** A hard-used social refuge assembled from freight modules. It is warmer than the
other frontier interiors without becoming cheerful, clean, or Western-saloon cosplay.

### Interior wall

```text
Seamless interior wall texture for an Ashfall frontier cantina: patched gunmetal freight
panels, heat-darkened rivets, shallow dents, soot above recessed vents, old adhesive scars,
small protected amber practical-light housings and a few restrained cyan status diodes.
Human hands have repaired it repeatedly with mismatched plates. No bottles, furniture,
posters, logos, or readable signs.
```

### Interior floor

```text
Seamless top-down floor texture for an Ashfall frontier cantina: worn steel deck plates with
embedded anti-slip strips, chair scuffs, boot wear, tracked ash, old dark spill stains, and
repaired seams. Mostly desaturated gunmetal and concrete; tiny warm reflections only where a
practical light would catch worn edges. No objects, footprints, text, or strong directional
shadow.
```

### Interior ceiling

```text
Seamless overhead ceiling texture for an Ashfall frontier cantina: low armored utility
panels, exposed pipe channels, cable trays, smoke-darkened ventilation grilles, and inset
warm work lights. Dense industrial construction with clear large forms that survive
downscaling. No hanging objects, room perspective, text, or open sky.
```

### Exterior facade tile

Use the wall prompt, remove most interior light housings, add wind-scoured Ashfall dust,
sand abrasion, heat cycling, exterior sealant, and a recessed amber entry beacon. Derive a
64×64 tile from an accepted seamless source; inspect it at exactly 64×64.

### Props

Generate each prop separately on a perfectly flat `#00ff00` background with generous
padding, no cast shadow, and no green in the subject.

- **bar-counter:** wide, waist-high counter welded from cargo plating; thick readable
  silhouette, impact scars, dark bottle-storage recesses, one amber edge light.
- **bottle-rack:** compact rack of mismatched sealed canisters and cups; no labels or text;
  restrained warm glass highlights.
- **table-cluster:** one heavy bolted table with two fixed stools, asymmetrically repaired;
  a single readable ground-level silhouette.
- **rumor-terminal:** person-height battered comms terminal with abstract waveform blocks,
  one cyan screen and a tiny amber service light; no readable UI.

## Marketplace kit

**Role:** A dense, pragmatic exchange floor. Colder and busier than the Cantina, with modular
stalls and cargo-handling wear rather than luxury retail.

### Interior wall

```text
Seamless interior wall texture for an Ashfall frontier marketplace: modular gunmetal stall
panels, sliding cargo rails, bolted repair plates, conduit channels, recessed inventory
sensors, chalky ash in seams, and sparse cyan transaction lights. Dense but readable
industrial rhythm, visibly maintained under scarcity. No goods, posters, prices, lettering,
logos, or readable screens.
```

### Interior floor

```text
Seamless top-down floor texture for an Ashfall frontier marketplace: reinforced cargo deck,
interlocking steel plates, pallet drag scratches, wheel tracks, repair welds, dust gathered
at seams, and small hazard insets expressed only through geometry and wear, not painted text.
No loose objects, arrows, numbers, logos, or directional shadow.
```

### Interior ceiling

```text
Seamless overhead ceiling texture for an Ashfall frontier marketplace: suspended cargo
rails, armored cable runs, rectangular cold work lights, maintenance hatches, patched steel,
and soot-dark ventilation. Strong large-scale structure, cool task-light register with very
small amber accents. No hanging merchandise, text, room perspective, or sky.
```

### Exterior facade tile

Use the wall prompt with exterior blast shutters, cargo-impact wear, Ashfall dust, and a
recessed cyan trade beacon. No readable shop sign. Derive and review at 64×64.

### Props

- **vendor-counter:** wide modular cargo counter with locked drawers and one abstract cyan
  transaction pad; no text or products fused into the counter.
- **weapon-rack:** tall secured rack holding chunky abstract tool/weapon silhouettes; no
  recognizable modern firearm branding or readable labels.
- **supply-crates:** compact stack of three mismatched reinforced containers with broken
  stencil shapes that cannot be read as letters or numbers.
- **trade-terminal:** tall armored kiosk with a cyan abstract market graph and physical
  controls; no prices, currency symbols, or text.
- **cable-bundle:** thick grounded power/data cables around a rugged junction block; avoid
  thin strands that disappear at small size.

## Town Hall kit

**Role:** The frontier's first attempt at civic permanence. Severe, repaired, and slightly
more orderly than the other hubs, but still built from survival materials rather than marble.

### Interior wall

```text
Seamless interior wall texture for an Ashfall frontier town hall: disciplined vertical
gunmetal panels over cracked structural concrete, reinforced seams, archive access plates,
careful repairs, restrained cyan civic-system light channels, and a small amount of warm
human task light. Imposing through proportion and order, never polished or luxurious. No
flags, heraldry, Earth logo, text, seals, or readable displays.
```

### Interior floor

```text
Seamless top-down floor texture for an Ashfall frontier town hall: broad worn concrete and
steel insets, repaired fractures, orderly plate grid, tracked ash near traffic lanes, and
subtle edge polish from years of petitioners. Severe desaturated palette, no ceremonial
emblem, words, arrows, objects, or directional shadow.
```

### Interior ceiling

```text
Seamless overhead ceiling texture for an Ashfall frontier town hall: armored civic utility
ceiling, symmetrical structural ribs, recessed cyan-white light wells, archive conduits,
maintenance hatches, and visible repair patches. Strong calm geometry that still feels
oppressive and frontier-built. No flags, text, room perspective, or open sky.
```

### Exterior facade tile

Use the wall prompt with heavier wind-scoured reinforcement, a recessed cyan approach light,
and a more ordered panel rhythm than the other hubs. Do not introduce faction heraldry.
Derive and review at 64×64.

### Props

- **governor-desk:** wide armored work desk with inset cyan console and thick privacy plates;
  no readable papers or UI.
- **petition-terminal:** tall public terminal with abstract queue blocks, scarred hand rests,
  and a restrained cyan screen; no numbers or words.
- **holo-atlas:** compact projection pedestal emitting a simple cyan volumetric point-field;
  no recognizable real map, text, or free-floating detached fragments.
- **bench:** wide heavy civic bench repaired from steel and dark composite, grounded and
  uncomfortable, with a strong single silhouette.
- **archive-cabinet:** tall sealed record cabinet with physical latches and abstract color
  tabs that do not resemble letters.

## Texture rejection rules

Reject and retry when any of these is visible:

- a room or corridor instead of a flat material;
- a lighting gradient that repeats as a checkerboard;
- seams in a 2×2 tiling preview;
- readable or pseudo-readable text;
- high-frequency detail that becomes noise at 64×64 or 512×512;
- saturated paint rather than emissive light;
- late-game Fold corruption or mutation;
- three hubs that look like palette swaps of one texture.

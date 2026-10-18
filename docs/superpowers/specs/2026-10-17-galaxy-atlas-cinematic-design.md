# Galaxy Atlas — cinematic deep-space look

Date: 2026-10-17. Builds on `2026-10-17-galaxy-sector-3d-design.md` (behaviour, levels, a11y and
save rules there are unchanged).

## Decision

The user found the 3D sector field "bland, like Tron" and chose (ask_user, 2026-10-17):

- **Style:** cinematic deep-space atlas (Elite Dangerous / Mass Effect galaxy map), not a
  holographic table and not a zoom-dependent hybrid.
- **Depth:** stars float at seeded heights with drop lines to the galactic plane.

## What changes (presentation only)

1. **Backdrop.** A seeded starfield sky dome (painted once onto a dynamic texture: deep gradient,
   faint galactic band, ~2.5k tiny stars) plus a 3D dust-star point cloud around the sector for
   parallax when orbiting.
2. **Galactic plane.** The wireframe grid and solid disc go. A soft dust disc (painted texture,
   additive) marks the plane; a very faint reference grid and thin sector frame with corner ticks
   remain for orientation.
3. **Nebulae.** Three or four horizontal nebula layers at different heights (painted soft-splat
   textures in violet, teal and amber), additive, so the tilted camera sees volume and parallax.
4. **Stars.** Colour comes from star class (`STAR_COLORS`), not threat. Each star is a small hot
   core plus an additive glow billboard and, for charted or visited stars, a four-point flare.
   Visited stars are brighter; signals stay a dim grey-violet flicker with no class colour (fog).
   Subtle twinkle unless reduced motion.
5. **Height.** Each star has a deterministic elevation in [-1, 1] from its fact id, mapped to
   about ±3.4 scene units. The camera aims at a star's height when the view is centred on it. A thin drop line runs to a small foot ring on the plane. The foot is the
   true map coordinate: picking an empty spot still resolves on the plane, and landmarks project
   from the star's real 3D position.
6. **Threat.** Shown as a band-coloured haze around stars with moderate or worse observed threat,
   not as a star tint. `data-threat` on landmarks is unchanged.
7. **Routes.** Glowing tube arcs between 3D endpoints, lifted by distance, coloured by band.
   Small light packets flow along planned and active legs (static under reduced motion). Pending
   legs are dimmer; done legs are solid and faint.
8. **Colony and vessel.** Gold orbit ring with a slowly orbiting beacon; the vessel rides at its
   star's height, or interpolated along the active leg in transit.
9. **Grade.** Scene image processing: ACES tone mapping, slight contrast, vignette. Glow layer
   stays for bloom.
10. **DOM layer.** When the 3D scene is live, landmark rings become invisible hit targets (faint
    ring on hover and focus, bracket on selection); the SVG plan fallback keeps visible dots.
    Field scanlines are removed in 3D mode.

## Model changes (pure, tested)

`SectorStar` gains `starClass: StarClass | null` (null for signal knowledge, so no class leaks)
and `elevation: number` in [-1, 1], deterministic per fact id. `contactSystems` exports
`starClassForFact` so the sector field and the SYSTEM view agree.

## Unchanged

Reducer authority, levels, landmarks and their attributes, label budget, picking contract, save
safety, SSR safety (all `@babylonjs` imports stay dynamic inside `createSectorScene`), browser
specs.

## Verification

Unit tests for the model fields; tsc; colony + engine suites; static build; galaxy browser specs;
manual Chrome look-and-feel on ATLAS START, KNOWN ROUTE and DENSE SECTOR including GALAXY level,
reduced motion and frame rate; one combined reviewer.

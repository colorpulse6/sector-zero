# System Atlas — cinematic look and nearest neighbours

Date: 2026-10-17. Builds on `2026-10-17-system-atlas-3d-design.md` (behaviour, landmarks, a11y,
region hand-off and save rules there are unchanged) and matches
`2026-10-17-galaxy-atlas-cinematic-design.md`.

## Why

After the sector field went cinematic, the SYSTEM level still used the old cyan wireframe grid
("Tron"). In a dense sector it also showed every other known system as a neighbour: 93 landmarks
piled on the edge ring and their labels overlapped. The user asked to keep building; this is the
next parked item.

## What changes

1. **Backdrop.** The same seeded sky dome as the sector field (shared seed), a thin shell of
   dust stars for parallax, and a soft ecliptic dust disc instead of the grid and solid disc.
2. **Star.** Class-coloured hot core, a large additive glow, a four-point flare and a faint outer
   halo. The star's point light takes its class colour; the fill light is low so planets show a
   day and night side.
3. **Planets.** A seeded surface texture per planet painted from its biome palette (bands,
   blotches, craters; ice caps, ocean land masses, volcanic cracks, city lights per biome), a thin
   atmosphere rim, and a slow axial spin (still under reduced motion).
4. **Orbits.** Faint lines in one line system; the colony planet's orbit is gold. The colony keeps
   a flat gold ring with a small orbiting beacon.
5. **Neighbours.** Only the nearest six systems are shown (`NEIGHBOUR_LIMIT`), as class-coloured
   glows (grey-violet for signals) with faint lanes (dashed for signals). The caption says
   "6 OF 93 NEIGHBOURS" when capped; the status chips still count every neighbour.
6. **Grade.** ACES tone mapping, slight contrast, vignette, glow layer — as the sector field.
7. **DOM.** The field gets `data-scene="3d"` when the scene is live. Planet rings become quiet hit
   targets (faint ring on hover, focus and selection bracket); neighbour landmarks keep a small
   visible mark because their pinned edge position is not where the 3D glow sits. Scanlines and the
   teal gradient go in 3D mode; the flat plan fallback keeps its look.
8. **Glide fix.** `glideToSystem` looked systems up in the built-in five-system catalogue, so
   inside the Galaxy Atlas the glide silently did nothing. It now takes the destination system and
   its neighbours from the caller.
9. **Edge ring always.** Neighbour landmarks now always sit on the edge ring, in the direction they
   lie. Before, a far-side neighbour projected inside the ring and its label landed among the
   planets. The plan fallback already puts neighbours on the same ring.
10. **Narrow charts.** When the chart is narrower than 1.8:1 (phones, squeezed columns), the camera
    holds the horizontal coverage of a wide chart, so the outer orbit stays in frame.
11. **Narrow-screen embed (found during verification).** At 900 px and below, the SYSTEM level inside
    the Galaxy Atlas squeezed the chart into a narrow column beside the detail panel (from
    `a845079`). It now stacks chart and detail like the cockpit dialog.

## Unchanged

Landmark ids and options, keyboard model, detail panel, region access, plan fallback, SSR safety
(every `@babylonjs` import stays dynamic inside `createSystemScene`), save safety.

## Verification

Unit tests for `nearestNeighbours` and the planet painter's determinism; tsc; colony and engine
suites; static build; system and galaxy browser specs; SwiftShader look at the cockpit SYSTEM MAP,
the Galaxy Atlas SYSTEM level (ATLAS START and DENSE SECTOR) and a neighbour glide; one combined
reviewer.

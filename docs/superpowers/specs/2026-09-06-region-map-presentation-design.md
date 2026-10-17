# Explorable colony region map

Date: 2026-09-06. Scope clarified by the user: **local map and destinations**.

The existing RegionMapScreen positions route lines using saved coordinates but renders
destinations in a separate vertical list. The result reads like documentation and its
lines do not connect the visible destinations. Replace this presentation with a spatial
map using the existing coordinates and graph. The user authorized implementation and
reasonable design decisions in this isolated task; this continues the approved dark,
restrained cinematic direction.

## Design

- A large, atmospheric surface map occupies the primary area. Abstract contour artwork
  is a visual backdrop, not new terrain or traversal authority. No asset generation or
  colony/first-person rendering work is involved.
- Focusable DOM landmarks and SVG routes share a percentage coordinate space. Known
  ruins, wrecks and colony sites have recognizable symbols. Unknown signals share a
  generic symbol and never expose their real name, type, encounter or site statistics.
  Non-frontier unknown nodes and their edges are omitted entirely; rumored site
  statistics are omitted even inside collapsed details. SVG routes explicitly use
  `preserveAspectRatio="none"` so rectangular layouts cannot letterbox endpoints.
- Distinguish the expedition's origin camp from the selected destination. Highlight
  only a real direct route between them; indirect connections never imply permission.
- A compact selected-destination panel contains its intel, encounter, concise context,
  and at most one explicit survey/travel/founding action with the authoritative cost.
  Site statistics and named connections sit in optional details.
- Preserve source-specific return controls and cockpit view-only behavior. Describe
  blocked destinations in player language. The map never claims a cockpit viewer is
  physically at the camp; it labels the expedition origin.
- Keep one roving option Tab stop and existing Up/Down selection. Enter/Z focuses the
  separate action; native Enter/Space commits. Pointer/touch landmark selection cannot
  launch. Escape and nested focus restoration remain under useModalFocus.
  Native disclosure summaries use `tabIndex={0}` to participate in its focus trap.
- Mobile keeps spatial landmarks, with the destination panel below the map. All
  landmarks have at least 44px targets, visible focus, readable names and no horizontal
  page overflow. Decorative motion is omitted, respecting reduced motion by default.

## Boundaries

No changes to save schemas, intel promotion, adjacency, survey/travel cycles, founding
costs, POI engine dispatch, outcomes, or colony graphics. Galaxy Atlas and legacy level
maps remain unchanged after the user's clarification. Root layout imports scoped CSS
so direct Node SSR component tests do not import stylesheets.

## Acceptance

Verify fog rules, real route geometry, origin/selection distinction, separate actions,
keyboard focus, pointer/touch selection, mobile layout, survey persistence and intended
engine launch. Run relevant region/navigation/persistence browser rows with zero
retries, all existing unit suites, TypeScript and static export. Finish with independent
review and a focused PR; no merge or deployment is required by this task.

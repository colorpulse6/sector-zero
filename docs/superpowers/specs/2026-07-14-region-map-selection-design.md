# Region Map Selection UX

**Date:** 2026-07-14
**Status:** Approved in conversation

## Problem

The M1 region map renders every eligible action as an immediate button inside a
stacked node card. It has no selected-node state, and its keyboard trap supports
only Tab and Escape. As a result, arrow keys do nothing and clicking a travel
control launches a first-person, boarding, or ground-run encounter before the
destination and engine type feel clearly confirmed.

## Approaches considered

1. **Selected node plus explicit action panel (chosen).** Clicking a node or
   pressing Up/Down changes selection only. A separate detail panel identifies
   the destination, intel state, encounter type, cycle cost, and available
   action. Launching requires a second explicit activation.
2. **Confirmation modal after every existing button.** This prevents accidental
   launches but adds modal churn and leaves keyboard navigation and map
   readability unresolved.
3. **Replace the whole cockpit and region flow with a new DOM navigation shell.**
   This could unify all menus, but it is larger than the reported M1 usability
   problem and risks unrelated cockpit behavior.

## Interaction design

- The visible node cards become selection controls, not action controls.
- One node is always selected. The origin colony node is preferred initially;
  otherwise the first visible node is selected. When a save update changes the
  visible set, keep the current selection if it remains visible; otherwise
  reconcile to the origin or first visible node.
- Mouse click selects a node and never performs a survey, founding, or travel
  action on that same click.
- The node collection is a `listbox` with roving-focus `option` elements.
  Initial focus lands on the selected option. Up/Down moves selection and focus
  through visible nodes and keeps the selected card in view.
- Enter or Z on a selected node moves focus to its explicit action button; it
  does not launch. Native Enter/Space activates that focused button. Bare Shift
  retains its browser meaning, including Shift+Tab, and never launches.
- Z activation calls `preventDefault` and is handled only once; a focused
  native button continues to use its native Enter/Space behavior so custom
  handling cannot double-fire.
- No keypress may launch an unselected node.
- The selected card has a strong border/fill treatment and
  `aria-selected=true`.
- The detail panel names the destination and labels POIs as FIRST-PERSON,
  BOARDING, or GROUND-RUN before travel. It also shows the one-cycle cost.
- An adjacent unknown node remains `UNKNOWN SIGNAL`: its true name, template,
  engine, stats, and actions stay hidden until its intel permits disclosure.
- The detail panel renders zero or one eligible action according to
  `checkRegionAction`; origin, unknown, unavailable, and cockpit-view
  selections show explicit read-only/unavailable copy instead.
- Survey, travel, and found-outpost remain governed by the existing
  `checkRegionAction` rules. Cockpit view mode remains read-only.
- Escape and the Back control retain their current behavior. On close, focus
  returns to the still-mounted invoking control when possible; when the landing
  menu remounts, its existing autofocus provides the predictable fallback.

## Implementation boundaries

- Keep the screen React/DOM and static-export safe.
- Add selected-node state and keyboard handling in `RegionMapScreen.tsx`.
- Extract pure selection initialization, reconciliation, and movement helpers
  so the state rules remain testable without a browser DOM shim.
- Reuse a pure POI catalog helper to map supported template IDs to displayable
  engine labels; mission dispatch remains unchanged.
- Do not alter world-cycle costs, graph eligibility, rewards, save shape, or
  canvas engine behavior.

## Verification

- Static render tests prove node controls contain no direct action and zero or
  one selected-node action is rendered outside the listbox according to
  `checkRegionAction`, with clear copy for zero-action states.
- Pure state tests prove initialization/reconciliation and Up/Down selection.
- Render tests prove the selected destination, encounter type, and explicit
  action copy are visible.
- Existing region, colony, engine, sprite, typecheck, and static-build gates
  remain green.
- Browser playtest covers focus entry/restoration, Shift+Tab, Up/Down, Enter/Z,
  callback counts/no double activation, and selecting Oathbreaker and Cinder
  Relay deliberately. Each must launch the labeled engine only after the second
  action.

# 01 — Ashfall Primary: place brief

Place id: `galaxy:ashfall-primary` (colony), at atlas contact `contact:ashfall`, planet `ashfall`,
region node `ashfall-forward-camp` ("Forward Camp"). Names, ids and coordinates are the ones the
fresh galaxy run already creates (`galaxyRun.ts` `startingColoniesAndPlanets`, `regionMap.ts`).
Nothing here renames or re-seeds anything.

## Identity

**One line.** A survey camp that lost its lander and kept its mast lit: two people on a dust plain
who have been calling for a ship, and yours is the one that answered.

**Canon note.** The run carries only these facts: a charted contact with `distressSignal: true`,
`fact:ashfall-distress`, and a founded colony with no buildings, no stockpile and population 0
(SOURCE-REVIEWED). The lander loss, the "waiting for a ship" framing and the named Overseer are
authored proposals for Nic's acceptance, not recovered canon.

**What it is.** Ashfall Primary is a tier-1 outpost on a desert world under a permanent rust
overcast. It was founded at cycle 0 of the run by the colony reducer, which is why it has an
overseer and a quartermaster but no buildings, no stockpile and a population of zero on the
books. Proposed fiction (PROPOSED, not canon): the camp's survey lander came down hard, the crew
have lived out of its hull since, and the distress mast has been transmitting the whole time.
The facts behind it are `fact:ashfall-distress` and the Atlas contact charted with
`distressSignal: true` (SOURCE-REVIEWED). The environmental threat band
is moderate; military, political, logistical and anomalous bands are low. It is dangerous because
of dust and distance, not because of an enemy.

**What it is not.** Not a city, not a faction capital, not an alien site. No empire, no House, no
priesthood. The only non-human note is the one the region already carries: the ruins and wreck
on the plain (Cinder Relay Ruins, Oathbreaker Wreck) transmit things nobody here sent. The camp
treats that as a surveying problem, not a mystery cult. This keeps to the decided opening
frontier (Living Galaxy §5.1.1) and the temporal-archaeology direction (§5.1.2) without putting
either on screen in the first slice.

**Faction.** Ashfall Camp (`ashfall_camp`), "hardscrabble survivors of the Ashfall dust". The
player starts neutral. Rank drives greeting tone, quartermaster prices and the trade refusal
(`factionLedger.ts`). The only standing source today is a completed planet mission at Ashfall
(+8 per completion).

## Why the player comes here

| Reason | Backing fact (SOURCE-REVIEWED) |
| --- | --- |
| It is the only colony in the run and the only place with a region chart | `COLONY_CONTACTS` maps one colony; `REGION_CONTACT_ID` is `contact:ashfall` |
| The distress signal is the first charted lead from Vanguard | starting knowledge `knowledge:ashfall-distress`; operation `op:ashfall-sortie` available at cycle 0 |
| Surface expeditions pay metal to the colony | POI expeditions deliver 80 metal; the sortie delivers 80 metal to `galaxy:ashfall-primary` |
| It is where management, trade and the first visible consequence will live | GC2-A (Colony), this packet's 05 and 06 |

## Arrival and exit

- **Arrive.** DESCEND TO COLONY from the Atlas target card or the SYSTEM view, only when parked
  at Ashfall after arrival (`galaxyColonyAccess`). The walk spawns on the landing pad at tile
  (11, 22) facing north (`OUTPOST_TEMPLATE.spawn`).
- **Leave.** Stand on the pad, interact, choose Take Off (returns to the Atlas) or REGION MAP
  (survey, expedition, found). Resume closes the menu.
- **Reload during a walk** returns to the Atlas with the run unchanged. The place must therefore
  read fully on every arrival; it cannot rely on the player having stayed.
- **Cost.** Descending and walking cost no cycles. Surveys, expeditions and the sortie cost one
  cycle each.

## The arrival sightline and landmark

From the spawn tile facing north the player sees, in order along one axis: the pad under their
feet, the Quartermaster at the pad stall four tiles ahead with the SUPPLY STATION behind him, the
Overseer at the plaza centre eleven tiles ahead, and the north perimeter wall. The baseline
capture (`boards/baseline-annotated.png`) shows this axis as shipped; it already works because
the sky band sits exactly where the eye lands.

**Landmark (proposed): the Relay Mast.** One tall billboard at tile (10, 6), just north of the
plaza, on that same axis. It is the camp's distress transmitter and the only vertical in a
horizontal composition. It has two states:

| State | Visual | Fact source |
| --- | --- | --- |
| Lit | ember lamp at the mast head, slight painted halo | `op:ashfall-sortie` not complete |
| Dark | lamp off, same silhouette | history fact `ashfall_sortie_complete` present (or operation state `complete`) |

This is the one "visible response to one state change" the brief asks for that does not depend
on GC2. It is a prop swap keyed to run state; the sprite pair is the only new environment art in
the first kit (03, Kit C). No acceptable stand-in exists on disk: the legacy antenna prop has a
white halo and the rig prop has baked text (see README parked problems).

## Layout

The exterior is the fixed 24×24 outpost template (`outpostTemplate.ts`): perimeter walls, six
building slots around a central plaza, landing pad south-centre. This packet does not change the
template; it names what goes where inside it.

```text
   x: 0123456789012345678901 23
y0    ########################
y1    #......................#
y2    #.AAAA............BBBB.#   A..F  building slots (max 4×4 footprint, south doors)
y3    #.AAAA............BBBB.#         empty floor on a fresh save; facades appear as commissioned
y4    #.AAAA............BBBB.#
y5    #.AAAA............BBBB.#
y6    #.........M............#   M  Relay Mast, tile (10,6)            PROPOSED prop
y7    #.CCCC............DDDD.#
y8    #.CCCCoooooooo....DDDD.#   o  plaza (x 6..13, y 8..14)          template
y9    #.CCCCoooooooo....DDDD.#
y10   #.CCCCoooooooo....DDDD.#
y11   #.....ooooOooo.........#   O  Overseer post, plaza centre (10,11) SOURCE-REVIEWED
y12   #.LL..oooooooo.........#   L  grounded lander hull, x 2..3, y 12..13  DEFERRED prop
y13   #.LL..oooooooo.........#
y14   #.....oooooooo.........#
y15   #.EEEE............FFFF.#
y16   #.EEEE............FFFF.#
y17   #.EEEE....W.......FFFF.#   W  SUPPLY STATION prop (10,17)         SOURCE-REVIEWED
y18   #.EEEE....Q.......FFFF.#   Q  Quartermaster stall (10,18)         SOURCE-REVIEWED
y19   #.........PPPP.........#   P  landing pad (x 10..13, y 19..22)    template, textured
y20   #.........PPPP.........#
y21   #.........PPPP.........#
y22   #.........PSPP.........#   S  spawn (11,22), facing north         template
y23   ########################
```

Slot order is seed-rotated (`assignSlots`, `layoutSeed % 6`, seed 4107 → rotation 3), so the first
commissioned building (the GC2-A Solar Array) lands in slot 3 (E-mid, x 18..21 × y 7..10), the second in slot 4 (SW), the third in slot 5 (SE), and so on. The designer
does not choose slots; the layout rule does. The plaza stays clear of buildings by construction.

### Named places

| Place | Tiles | What the player can do | Status |
| --- | --- | --- | --- |
| The Pad | 10..13 × 19..22 | spawn; interact for Take Off / Region map | SOURCE-REVIEWED; PRIOR EVIDENCE (GC1) |
| The Stall and Station | Q (10,18), W (10,17) | talk, shop (A), exchange (B proposed, gated) | SOURCE-REVIEWED / PROPOSED |
| The Plaza | 6..13 × 8..14 | meet the Overseer; colonists gather at dusk (legacy clock) | SOURCE-REVIEWED |
| The Mast | (10,6) | read the camp's state at a glance | PROPOSED |
| Slot 3 (E-mid) | 18..21 × 7..10 | first building (GC2-A: Solar Array): scaffolding, then facade and door | SOURCE-REVIEWED layout; GC2-A for galaxy commissioning |
| Cantina | any slot, 4×4 | drink, rumours, three scheduled NPCs | SOURCE-REVIEWED interior; needs commissioning (200 metal, 3 cycles; not in GC2-A) |
| Off-site: Cinder Relay Ruins | region node | survey, then a first-person expedition; +80 metal, once | PRIOR EVIDENCE (GC1, from the pad) |

## Material, light and colour (summary; full rules in 02)

Rust sky, cold steel, warm lamps. The overcast is the only warm surface; everything made by
people is cool grey, dusted brown at ground contact. Colour is light: ember on the mast and
porch lamps, cyan only on screens. Full palette, measured from the live assets, in 02.

## State changes the place must show

| Change in state | Visible in the place | Mechanism | Status |
| --- | --- | --- | --- |
| Building commissioned | foundation tile + scaffolding billboard in its slot | `generateExteriorState` | SOURCE-REVIEWED (legacy); galaxy after GC2-A |
| Building completes | facade walls with a south door; door lit at night | same; night window 20:00–06:00 | SOURCE-REVIEWED (legacy clock only; the galaxy walk stays at 07:00 for GC2-A; night is a later slice, D4) |
| Population grows | one colonist billboard per 4 population, up to 10; barks by happiness tier | `generateColonyNpcs` | SOURCE-REVIEWED |
| Happiness band | Overseer's morale line; colonist bark pool | `buildGovernorDialog`, `buildColonistBark` | SOURCE-REVIEWED |
| Faction rank | greeting tone; prices; refusal at hated/hostile | `factionLedger` | SOURCE-REVIEWED |
| Sortie secures the zone | Relay Mast goes dark; Overseer line changes | prop swap on run state | PROPOSED; separate small runtime slice |
| Metal delivered | Quartermaster and Overseer name the yard total | new dialog lines from `colony.resources` | PROPOSED; separate small runtime slice |

## Explicit non-goals for the first lock

No lander hull prop, no Marketplace or Town Hall interior, no rubble for destroyed buildings (the
layout skips them), no renderer change, no plaza paving tile, no new NPC beyond the two the run
already creates. Each is listed in 03 Kit D with the reason for deferral.

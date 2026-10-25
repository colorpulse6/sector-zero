# Ashfall reference-world lock contract

Manager scope, 2026-10-24, under Nic's instruction to lock Ashfall.

## Playable baseline

Travel to Ashfall, descend, meet the Overseer and Quartermaster, work salvage,
commission Solar Array, Mine, Habitat Module, Farm and Water Purifier, reach ten
settlers, trade surplus metal for travel supply, depart, return and reload.
The current frontier-industrial art direction stays in place.

## First trade

The Quartermaster exchanges **20 colony metal for 1 ship travel supply**.
This is a repeatable fixed exchange, not negotiation or a credits marketplace.
There is no supply cap: salvage already permits reserves above twelve. The old
20-to-1/cap-twelve proposal was not an approved contract; this document records
the manager's bounded implementation decision. It does not change building costs,
40-metal/one-supply salvage rewards, growth, or travel costs.

The player sees both treasuries, the exact cost and reward, and how to earn metal.
The exchange takes no world cycle. It competes with construction for metal, so
work and the mine remain useful. Fresh Galaxy never needs Legacy unlocks. Legacy
Quartermaster shops keep their existing catalog. Galaxy consumable commerce is
deferred until the player can equip/use those purchases through an ordinary route.

Commit re-reads canonical storage, validates location, ownership, faction and
pending outcomes, and compares the displayed quote. Only the selected colony's
metal, ship supply and shared save revision change. A repeated quote applies once;
a fresh press can trade again. Held confirmation cannot spend repeatedly. Failure
or a stale quote cannot overwrite a newer save or claim success. This is the
existing synchronous local-save boundary, not a cross-tab atomic transaction.

## Required proof and lock boundary

- Unit proof: exact transfer, repeat intent, stale/new run/faction/access refusal,
  insufficient metal, save failures, Legacy isolation and reload.
- Browser proof: ordinary work/build controls, both NPCs, real shop interaction,
  held input, transaction persistence and departure/return with durable buildings.
- Runtime screenshots at gameplay size; review the existing art in context.
- Green build, typecheck and affected regressions; normal PR review and deployment.

Codex owns implementation, validation, release evidence and compatibility notes.
Nic owns final visual/playfeel acceptance; sleeping is not acceptance of unseen work.
Until that check and release finish, status is **lock candidate**, not final lock.
New worlds, full marketplaces, negotiated prices, a day/night pass and extra lore
are optional later work and do not move this milestone's finish line.

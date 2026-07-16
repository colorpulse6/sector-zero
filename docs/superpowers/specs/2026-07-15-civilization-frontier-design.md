# Sector Zero — Civilization Frontier Skeleton

**Date:** 2026-07-15
**Status:** APPROVED DIRECTION — records the long-horizon skeleton; exact systems remain
separately specced before implementation
**Planning horizon:** G0 Atlas foundation, M3–M6 systemic growth, then continuing
civilization and frontier eras
**Authority:** Extends `docs/ROADMAP.md` and
`2026-07-14-living-galaxy-vision-design.md`. The approved
`2026-07-16-continuous-galaxy-atlas-design.md` supersedes this document's original
navigation model and moves the minimal galaxy substrate forward as G0.

## 1. Purpose

Sector Zero needs one connected structure for the systems discussed after the Living
Galaxy vision:

- the captain can acquire and lose real political power;
- colonies, towns, Houses, and fleets continue acting while the captain travels;
- absence may produce prosperity, rebellion, forgotten history, extinction, or exile;
- the existing mission content migrates from a numbered campaign wrapper into a
  continuous, coordinate-based traversable galaxy;
- colonies, outposts, relays, allies, and fleets create the logistics needed to push
  that frontier;
- battles and multi-mode campaigns remain the player's primary means of changing
  history;
- simulated decisions are causal, irreversible, and specific to the save rather than
  repeated event cards;
- bounded game intelligence may select from authored outcomes, while language models
  remain optional and subordinate to saved world truth.

This is a skeleton for future focused specs. It defines boundaries, relationships, and
invariants so later work does not accidentally produce a detached grand-strategy game,
an infinite menu simulator, or a generic procedural mission board.

## 2. Revised north-star relationship — DECIDED

> **The simulation creates campaigns. Campaigns reshape the simulation.**

The systemic sandbox and the playable campaign are reciprocal layers:

1. People, settlements, Houses, fleets, hazards, and enemies create needs and conflict.
2. Significant conflict becomes a campaign, expedition, crisis, or political decision.
3. The captain commits through an existing mode or a bounded command decision.
4. Success, failure, compromise, and absence create durable historical facts.
5. Those facts change the world actors, routes, threats, beliefs, and later campaigns.

The simulation is the source of context and consequence. Space combat, boarding,
first-person exploration, ground-run, turret combat, negotiation, and multi-phase
missions are how the player enters that context. Neither layer is a disposable wrapper
for the other.

The current roadmap statement that “the colony/region sim is the game; the campaign is
the on-ramp” remains useful for protecting systemic depth, but it must not be
interpreted to mean that late Sector Zero becomes primarily dashboard management. A
future roadmap refresh should use the reciprocal wording once the implementation order
is ready to change.

## 3. Political authority and the captain — DECIDED

### 3.1 Hybrid control

The captain can gain substantial authority without receiving permanent remote-control
ownership of a society.

Possible sources include:

- founding or patronizing a settlement or House;
- election to a town, planetary, House, fleet, or interstellar office;
- appointment, treaty, emergency mandate, inheritance, or acclamation;
- conquest, coercion, coup, or control of strategically necessary infrastructure;
- personal followings, military loyalty, religious significance, or historical myth.

Each authority grant has a source, scope, jurisdiction, powers, limits, supporters,
opponents, start date, review or succession rules, and legitimacy. “The captain owns
this colony” is not a sufficient long-term political model.

### 3.2 Layers of agency

The captain may act through several layers:

1. **Influence:** suggest, persuade, mediate, gather a bloc, endorse, condemn, or trade
   support.
2. **Office:** vote, appoint, negotiate policy, allocate authorized resources, resolve
   disputes, and issue decisions within a charter.
3. **Command:** give lawful military, emergency, or executive orders within the granted
   mandate.
4. **Coercion:** force a decision through political pressure, emergency powers,
   violence, seizure, or conquest.

The interface must show which layer authorizes an action. Coercion is playable, not
forbidden, but it creates fear, precedent, resistance, defections, rivals, and possible
rebellion.

### 3.3 The captain's House

The captain may become a founder, patron, regent, elected leader, military protector,
or sacred ancestor of a House. The House remains an autonomous institution:

- successors and councils interpret the captain's original purpose;
- members form factions and competing interests;
- cadet branches may split, reconcile, or fight;
- followers may remove the captain from formal leadership while retaining the name;
- a House may honor the captain symbolically while rejecting their current orders.

This hybrid grants meaningful influence without reducing every House to a player-owned
faction.

## 4. Delegated rule and bounded governor intelligence — DECIDED

### 4.1 Departure guidance

Before leaving, the captain can set:

- leadership and succession arrangements;
- high-level doctrine and resource priorities;
- construction, defense, diplomacy, exploration, and trade goals;
- reserve thresholds and acceptable risk;
- emergency authority and communication rules;
- protected people, relationships, institutions, or populations;
- preferences, standing orders, and constitutional red lines.

The three directive strengths are:

1. **Preference:** guidance a leader weighs against local priorities.
2. **Standing order:** binding within the captain's current legal authority.
3. **Constitutional red line:** a foundational prohibition or protected right.

No directive is a metaphysical lock. A governor may violate even a red line during a
crisis, coup, ideological break, or act of desperation. The violation is recorded as an
illegal and consequential choice, not silently accepted as compliance.

### 4.2 Authored choice space, simulated choice

Colonies never ask an unconstrained model to invent what happens. The system follows a
bounded decision contract:

1. Detect a situation from saved facts: famine, election, raid, succession, strike,
   migration, epidemic, technological dispute, or another authored situation family.
2. Produce only authored actions whose preconditions are currently true.
3. Score those actions from the leader's personality, doctrine, loyalties, ambitions,
   fears, corruption, relationships, knowledge, authority, and the captain's orders.
4. Select one action through deterministic game intelligence and a saved seed.
5. Resolve it through authored mechanical outcomes and persist the decision, causes,
   participants, consequences, and provenance.
6. Add the significant result to reports, local memory, and the historical chronicle.

A food crisis might permit rationing, imports, seizure of a House reserve, evacuation,
concealment, price controls, or a request for fleet aid. Which actions exist depends on
the world. Which action is chosen depends on the actual leader and institutions.

### 4.3 Language-model boundary

The baseline system does not require a hosted or downloaded language model. Utility
scoring, authored actions, and deterministic resolution must produce a complete game.

An optional local model may later:

- summarize the facts considered by a governor;
- draft speeches, petitions, reports, propaganda, and competing interpretations;
- rank an already valid action set for non-authoritative evaluation or player-facing
  advice;
- give different actors distinct ways to explain the same saved decision.

It may not invent an action ID, create or delete a person, transfer resources, declare
a death, change territory, fabricate evidence, or write directly to authoritative
state. Structured output is validated and failure falls back to authored text. The
deterministic game selector alone chooses authoritative mechanical actions; model
ranking cannot alter that result. A future experimental branch may evaluate model
recommendations, but it must not write them into canonical saves unless a later focused
spec replaces this rule with an equally reproducible, crash-safe contract.

## 5. Absence, neglect, and loss of power — DECIDED

### 5.1 Drift before rupture

Control is never lost through one hidden roll. Absence produces a visible causal chain:

1. delayed decisions, policy reinterpretation, and local improvisation;
2. declining legitimacy, missed obligations, or conflict between captain and leader;
3. organized opposition, election challenges, disobedience, or a succession dispute;
4. removal, secession, coup, rebellion, House fracture, or total loss of authority.

A competent delegated government may maintain or improve a colony. Neglect is not an
automatic punishment meter; it creates room for other people to govern.

### 5.2 Total rebellion is a valid world state

Every colony, House, fleet, and former follower may eventually reject the captain.
Possible causes include tyranny, abandonment, incompatible ideology, propaganda,
religious change, perceived immortality, military failure, technological disaster, or
the belief that the captain is an existential threat.

The captain may lose offices, property, treasury access, relay access, fleet command,
crew loyalty, legal identity, historical legitimacy, and every major ally. This is not
a conventional game-over.

### 5.3 Minimum-agency invariant

The game does not guarantee restoration, ownership, or friendship. It guarantees a
playable next action.

An exiled captain can attempt to:

- escape, hide, salvage, steal, trade, or surrender;
- contact isolated loyalists or create a new following;
- ally with outsiders, dissidents, rival Houses, or former enemies;
- negotiate recognition or accept a colony's independence;
- expose evidence, support a claimant, or repair severed infrastructure;
- build a mobile force, insurgency, or new settlement;
- wage reconquest and accept the permanent consequences;
- enter deep stasis if a secure refuge can be obtained.

The captain may lose the Vanguard or normal fleet access, but the resulting capture,
escape, wreck, or exile path must preserve agency rather than trapping the save in a
non-interactive screen.

## 6. Irreversible evolution and historical truth — DECIDED

### 6.1 No return to a prior state

Things only evolve. Recovery, reconciliation, reconstruction, and restoration are new
historical states, not rollback operations.

- A rebuilt town contains survivors, successors, memorials, scars, and new ownership.
- A restored House has changed claims, leaders, debts, and internal factions.
- A re-elected captain returns under a new mandate and after a remembered absence.
- A reopened route inherits the war, disaster, or expedition that closed it.

The save may reconstruct similar capabilities, but it never deletes the causal chain
that led there.

### 6.2 Objective history and local knowledge

The simulation retains immutable historical facts needed for causal consistency. Each
society separately holds fallible knowledge of those facts.

Local knowledge can be:

- recorded, taught, mythologized, censored, forged, fragmented, or destroyed;
- preserved by a family, archive, monument, ritual, machine, or oral tradition;
- lost through relay failure, archive destruction, regression, war, migration, or
  centuries of isolation;
- rejected even when the captain presents evidence.

Some historical knowledge is permanently unrecoverable to the local society. The
player's chronicle may know that something happened without providing a universally
accepted proof item. Artifacts can become sacred relics, suspected forgeries, weapons,
or evidence that the captain should be feared.

### 6.3 Causal uniqueness

The same authored situation family may occur in several places, but it must instantiate
from different causes, actors, beliefs, geography, assets, and history.

Each significant situation receives a causal signature containing at least:

- situation family and triggering fact;
- originating actors, relationships, and location;
- era, local culture, authority structure, and known history;
- contested resource, goal, route, person, or institution;
- related prior event or explicit absence of one.

The presentation system tracks recent motifs and resolved signatures to suppress
accidental near-duplicates. Repetition remains valid when it is itself causal: an
inherited feud, copied doctrine, recurring disaster, ideological movement, or enemy
deliberately repeating a known tactic.

The requirement is not that two famines can never happen. It is that two famines do not
produce interchangeable people, choices, quests, and consequences.

## 7. Recontact arcs — DECIDED

Returning after long absence may reveal a colony that is:

- loyal but desperate, with only a small group preserving the captain's claim;
- independent and demonstrably better governed;
- divided between restorationists, separatists, opportunists, and neutral civilians;
- hostile because the captain is remembered as a conqueror or existential threat;
- disconnected after a relay, archive, environmental, or technological disaster;
- culturally transformed and uncertain whether the captain ever existed;
- extinct, ruined, evacuated, or continued through descendants elsewhere.

Recontact generates a bounded campaign from actual history. Possible responses include
diplomacy, elections, archaeology, relay repair, aid, recognition of independence,
support for a faction, evacuation, infiltration, coercion, or war. Reclamation is one
option, never the assumed objective.

Quest generation must identify why this colony reached its state, who currently has
stakes in it, what evidence and infrastructure survived, and which responses remain
possible. A generic “restore control” chain is insufficient.

## 8. Captain myth and cultural interpretation — DECIDED DIRECTION

There is no universal captain-reputation score. Different cultures and actors may
simultaneously understand the same captain as:

- founder, liberator, patron, or guardian;
- absentee ruler, tyrant, invader, or destroyer;
- deathless wanderer, sleeping king, abandoned god, demon, or prophecy;
- fabricated ancestor, disputed historical figure, or irrelevant footnote.

Interpretation derives from experienced events, local knowledge, education,
propaganda, religion, generational identity, and current political need. A culture may
change its interpretation without changing the objective facts that inspired it.

The captain can influence a myth through deeds, institutions, testimony, monuments,
and force, but cannot set a galaxy-wide narrative from a menu.

## 9. Stasis and galactic time — DECIDED DIRECTION

### 9.1 Transit stasis

Transit stasis supports ordinary long-distance travel:

- it is bound to a destination and route;
- expected captain and galactic elapsed time are previewed;
- route threats and forecast confidence are visible;
- the ship may wake the captain for a significant interruption;
- arrival is expected unless a telegraphed travel failure changes the journey.

### 9.2 Deep stasis

Deep stasis is a strategic disappearance:

- it requires a secure ship, hidden facility, ancient installation, or allied refuge;
- it may last decades, centuries, or millennia;
- the player cannot precisely select the future political state;
- risk, likely duration range, refuge security, and forecast confidence are shown;
- waking produces a full historical catch-up and possible recontact campaign.

Deep stasis cannot be a universal “skip until the problem goes away” button. Securing
the refuge, surviving discovery, maintaining the system, and accepting irreversibility
are part of the commitment.

Both forms use the same deterministic interval-advancement foundation described in the
Living Galaxy vision, with different commitment and interruption rules.

## 10. The star map becomes the galaxy — SUPERSEDED AND REVISED 2026-07-16

### 10.1 Migration from the current campaign map

The current star map is a fixed arc of eight world nodes with fixed level lists. That
wrapper is an implementation artifact and does not remain the structure of the new
galaxy.

- the Vanguard or current vessel has a persistent coordinate or in-transit position;
- the player navigates continuous projected galactic space through galaxy, sector,
  system, and planetary-region zoom levels;
- seeded spatial cells create stable systems, belts, nebulae, worlds, stations,
  anomalies, threat volumes, and signals on contact;
- important authored locations coexist with discovered and systemic contacts;
- existing levels, bosses, side quests, planet missions, and special missions survive
  as named operations attached to physical locations, not as W1–W8 gates;
- choosing a coordinate commits time, logistics, and risk rather than selecting a
  disconnected level.

A short authored prologue may introduce the Vanguard, crew, apparent alien threat, and
first Tear event. After it, the numbered ladder disappears. The canonical design and G0
vertical slice are specified in `2026-07-16-continuous-galaxy-atlas-design.md`.

### 10.2 Galaxy intel states

The M1 region-map knowledge pattern repeats at galactic scale:

1. **Unknown:** no actionable knowledge.
2. **Signal:** a rumor, trace, coordinate fragment, distress call, or anomalous reading.
3. **Charted:** position and partial route information are known.
4. **Visited:** the captain or a trusted source has directly resolved the contact.
5. **Lost contact:** a formerly observed subject has become stale or unreachable enough
   that its current condition is unknown.

Reachable, contested, secured, and disrupted are separate current access assessments.
A charted coordinate can move between them without being forgotten.

Knowledge and access are separate. Discovering a planet does not make it reachable;
securing a route does not make it permanently safe.

## 11. Logistics frontier — DECIDED

### 11.1 Resources enable expeditions, not map purchases

Players do not spend a resource bar to reveal a planet. Expansion requires three
conditions:

1. **Knowledge:** a signal or charted destination exists.
2. **Reach:** current ships, fuel, supply, repair, communication, and navigation can
   attempt the route.
3. **Commitment:** the captain launches or delegates an expedition and accepts its
   travel campaign.

### 11.2 Sources of frontier reach

Permanent colonies provide the deepest and most stable reach, but they are not the only
source.

- **Colonies:** sensors, research, fuel, shipyards, supplies, population, defenses,
  diplomacy, and durable communications.
- **Outposts and relays:** narrower sensing, refueling, repair, warning, staging, and
  communication coverage.
- **Mobile fleets:** temporary fuel, repair, escort, scouting, and force projection at
  higher upkeep and risk.
- **Allies and treaties:** borrowed ports, charts, escorts, markets, and passage rights
  that can be revoked.
- **Captured or ancient infrastructure:** powerful but uncertain capabilities requiring
  exploration, repair, occupation, or defense.
- **Salvage and hidden depots:** weak but essential paths for fugitives and exiled
  captains.

This prevents total rebellion from becoming a galaxy-exploration softlock while still
making civilization building the strongest expansion engine.

### 11.3 Building-to-frontier effects

Later structures may contribute:

- observatories and sensor arrays: discover or clarify signals;
- navigation archives and research institutions: decode anomalous routes;
- refineries and supply infrastructure: increase practical range and endurance;
- shipyards and fleet yards: repair, refit, and support escorts;
- relay stations: improve communication, reports, forecasts, and interruption warning;
- military installations: challenge blockades and keep routes secured;
- trade and diplomatic institutions: establish access without conquest.

Exact buildings and balance belong in later milestone specs.

## 12. Threat and hostile travel — DECIDED DIRECTION

Threat is not a single enemy-level number. Every node and route may expose several
dimensions:

- **military:** patrols, fleets, blockades, raiders, fortresses, and bosses;
- **political:** denied passage, sanctions, disputed claims, arrest risk, and hostile
  populations;
- **environmental:** storms, radiation, gravity, debris, heat, cold, and supply loss;
- **logistical:** distance, fuel, repair scarcity, crew endurance, and communication
  gaps;
- **anomalous:** temporal instability, false signals, mutation, Fold effects, and
  uncertain physics.

The map presents an overall threat band plus known contributors and confidence. Unknown
does not mean randomly lethal; it means the player is shown the limits of current
knowledge.

Travel responses may include fighting through, scouting, escorting, negotiating,
paying, repairing, researching, waiting, detouring, infiltrating, or abandoning the
attempt. Bosses and major fleets can guard routes or objectives, but not every system
requires a mandatory boss.

Routes evolve through control and history. A cleared boss remains dead. A successor,
House, syndicate, fleet, disaster, or new culture may later make the corridor dangerous
for a different recorded reason.

## 13. Travel campaigns and existing game modes — DECIDED

A significant journey may be a multi-mission campaign rather than one loading screen.
Its phases are selected from actual route threats:

- vertical shooter or turret defense against fleets and interceptions;
- boarding to capture a relay, rescue a navigator, or disable a blockade;
- first-person investigation, diplomacy, sabotage, or exploration;
- ground-run traversal across a hostile world or damaged installation;
- command decisions about formation, retreat, priorities, and acceptable losses;
- a multi-phase boss or decisive battle at the chokepoint.

A strategic campaign record needs:

- stable ID, origin, participants, theater, and cause;
- competing objectives, stakes, allies, enemies, and neutral populations;
- controlled nodes, routes, assets, supply, and time pressure;
- current phase, available interventions, delegated actions, and offscreen plans;
- completed missions, losses, compromises, and resulting historical facts.

Not every travel commitment becomes a long chain. Routine travel on a secured corridor
may resolve cleanly. Interruptions are significant consequences of actual threat, not
constant random content.

## 14. Dashboard and communication — DECIDED DIRECTION

The existing React Colony Planner is the foundation for a later governance dashboard.
It should report and forecast, not provide instantaneous omnipotence.

Long-horizon surfaces may include:

- **Overview:** resources, construction, population, threats, and shipments;
- **Government:** captain's offices, authority, mandate, leaders, succession, elections,
  policies, directives, and emergency powers;
- **People and Houses:** followers, rivals, blocs, Houses, standing, loyalty, and current
  disputes;
- **Campaigns:** wars, expeditions, crises, route threats, fronts, and available
  interventions;
- **Communications:** relay path, message delay, order arrival, stale instructions, and
  missing contact;
- **Chronicle:** ranked changes since the captain's last reliable report or visit.

The dashboard distinguishes current knowledge, forecast, delayed report, rumor, and
confirmed historical fact. A remote order may arrive after circumstances change and be
interpreted by local leadership under its granted authority.

## 15. Data and determinism skeleton — APPROVED ARCHITECTURAL DIRECTION

Future focused specs should preserve boundaries between:

- `AuthorityGrant`: who can do what, where, why, and until when;
- `Directive`: preference, standing order, or red line with issuer and scope;
- `GovernanceDecision`: situation, valid candidates, selector, chosen action, and
  result;
- `HistoricalFact`: immutable causal event required for world consistency;
- `BeliefRecord`: an actor or culture's fallible knowledge and interpretation;
- `StrategicActor`: House, faction, syndicate, government, fleet, or polity;
- `GalaxyNode` and `Route`: knowledge, location, capabilities, control, threat, and
  history;
- `TravelCommitment`: route, clocks, logistics, risks, interruptions, and outcome;
- `Campaign`: theater, participants, objectives, phases, interventions, and history.

The same saved state, elapsed interval, selector policy, and seed must produce the same
authoritative result. Decisions are committed once and never rerolled on reload. Local
belief may change; objective event provenance does not.

## 16. Fairness and continuity invariants — DECIDED

- Every loss of authority follows a visible causal chain.
- Total rebellion and exile preserve at least one playable next action.
- No colony, ally, or permanent base is absolutely required for galaxy continuation.
- Recovery creates a new state and never erases prior consequences.
- Historical knowledge can be lost without corrupting authoritative simulation facts.
- Critical continuation does not depend on one NPC, one archive, or one friendly polity.
- A threat preview states known risk and uncertainty before commitment.
- Secured routes may change, but not through an unexplained offscreen rewrite.
- A governor may violate the captain's orders, and that violation is recorded and
  contestable.
- Optional model failure cannot block, corrupt, or reroll world progression.
- Significant campaigns resolve through playable or explicitly delegated actions, not
  a hidden instant galaxy roll.

## 17. Relationship to the active roadmap

This skeleton now relies on an early minimal galaxy substrate while keeping the deep
civilization systems incremental:

- **M1 Region:** proves seeded graphs, intel progression, route costs, survey, travel,
  POIs, founding, and explicit threat/mode presentation at planetary scale.
- **M2 Look:** improves the assets used when systemic conflicts become playable
  missions; it remains an independent art lane.
- **G0 Atlas:** introduces continuous coordinates, seeded spatial cells, persistent
  vessel location, signals, unified operations, route commitment, and a small local
  sector before later systems depend on numbered world IDs.
- **M3 Hubs:** establishes named leaders, Town Hall decisions, relationships, roles,
  institutions, and the first expanded Planner information architecture at persistent
  galactic locations.
- **M4 Decay:** proves telegraphed drift, autonomous local decisions, causal crisis
  chains, irreversible scars, and syndicates as world actors.
- **M5 RPG legs:** adds delegation, diplomacy, governance, navigation, engineering, and
  command capabilities where consistent with the approved skill trees.
- **M6 Living Galaxy:** expands the atlas into multi-colony comparison, coarse distant
  simulation, strategic actors, campaign records, and broader frontier reach. It no
  longer introduces the first galaxy map.
- **Post-M6:** expands frontier reach, generations, Great Houses, recontact, political
  loss, exile, deep stasis, cultural myth, and dynamic interstellar campaigns in proven
  slices.

## 18. Future spec decomposition

Do not implement this document as one monolith. Expected focused designs include:

1. governance, authority grants, directives, and bounded governor decisions;
2. immutable history, local belief, causal uniqueness, and recontact generation;
3. continuous galaxy coordinates, atlas intel, threat, and frontier reach — G0 design
   now recorded in `2026-07-16-continuous-galaxy-atlas-design.md`;
4. travel commitments, transit stasis, interruptions, and deep stasis;
5. strategic campaign records and multi-mode mission generation;
6. expanded Planner/governance/campaign dashboard;
7. optional local-language-model evaluation after the deterministic system is fun.

Each slice requires its own implementation plan, migration design, deterministic tests,
DevPanel fixtures, and player-facing acceptance criteria.

## 19. Open-decision ledger

1. What exact authority types, election terms, succession rules, and jurisdictions ship
   in the first governance slice?
2. Which leader traits and utility weights are legible to the player, and which remain
   inferred through behavior?
3. What exact causal-signature and motif rules suppress accidental repetition without
   suppressing legitimate recurring crises?
4. What conditions permit the captain to lose the Vanguard, and what minimum-agency
   escape states replace it?
5. How are deep-stasis duration, discovery risk, equipment failure, and wake conditions
   selected and previewed?
6. What are the exact post-G0 threat and route-capability calculations?
7. Which colony, outpost, relay, fleet, ally, and salvage capabilities expand frontier
   reach after G0?
8. How much fleet command occurs before a battle, and which role does the captain
   personally play during the battle?
9. How are long campaigns compressed, delegated, paused, lost, or resumed without
   becoming mission spam?
10. What is the first post-M6 vertical slice that proves one absence-and-recontact arc
    feels unique and consequential?

## 20. Explicit non-goals

- Do not expose numbered worlds as the canonical structure of the new galaxy.
- Do not discard proven missions, modes, bosses, or story material merely because their
  old progression wrapper is retired; adapt them into located operations.
- Do not turn Sector Zero into a dashboard-first grand-strategy game.
- Do not require a hosted API, paid service, WebGPU device, or downloaded language model
  for authoritative simulation.
- Do not allow an unconstrained model to invent or mutate saved world facts.
- Do not make colonies the only possible source of frontier reach.
- Do not make resources directly purchase planet discovery.
- Do not make every route interruption a random battle or every system end in a boss.
- Do not restore a polity, person, route, House, or reputation by deleting its history.
- Do not guarantee that the captain can reclaim lost authority.
- Do not reduce all cultural interpretations to one captain-reputation number.
- Do not replicate an event package elsewhere with interchangeable names and outcomes.
- Do not make governor disobedience an unexplained random betrayal.
- Do not trigger total rebellion, capture, permanent exile, or loss of the Vanguard
  through one hidden offscreen roll.
- Do not simulate the entire galaxy at frame-level or individual daily fidelity.
- Do not make G0 implement generations, Houses, deep stasis, or the complete living
  galaxy before its local exploration loop is fun.

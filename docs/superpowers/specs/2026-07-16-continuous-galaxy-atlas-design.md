# Sector Zero — Continuous Galaxy Atlas

**Date:** 2026-07-16
**Status:** APPROVED DESIGN — ready for implementation planning after user review
**Milestone:** G0 — The Atlas
**Authority:** Extends `docs/ROADMAP.md` and supersedes the numbered-corridor and seeded
node-graph assumptions in §10–§13 of
`2026-07-15-civilization-frontier-design.md`. The Living Galaxy and Civilization
Frontier documents remain authoritative for long-horizon time, government, history,
and continuity.

## 1. Purpose

Sector Zero's current star map is a fixed canvas arc of eight numbered worlds. Levels,
bosses, planets, side quests, and one special mission are unlocked through that ladder.
This structure shipped useful content, but it cannot support the approved game:

- exploration across a galaxy large enough to outgrow authored bounds;
- a captain with a persistent physical location;
- colonies, fleets, Houses, and enemies acting across distance and generations;
- travel whose time, supply, intelligence, and threats matter;
- missions created by world state and returning consequences to it;
- free discovery rather than choosing the next numbered encounter.

G0 replaces the progression wrapper, not the playable work. Existing modes, missions,
bosses, side objectives, planets, regions, art, and story material become operations at
physical locations in a continuous Atlas.

G0 is a small systemic proof. It does not build the entire simulated galaxy.

## 2. Decisions of record

1. **Numbered worlds are legacy content identifiers, not the new progression model.**
   W1–W8 do not appear as the canonical structure of a new galaxy run.
2. **The Atlas represents continuous projected galactic space.** The player may follow
   a known contact or select an arbitrary coordinate.
3. **Navigation is two-dimensional for gameplay.** Depth, elevation, and unusual
   topology are route or anomaly properties, not a third free-navigation axis.
4. **Coordinates are deterministic and stable.** The same galaxy seed and coordinate
   always identify the same latent space. Viewport, visit order, reload, and frame timing
   cannot change generation.
5. **Detail is promoted through contact and causality.** Distant space remains cheap and
   coarse until observation, travel, ownership, or an active relationship requires more
   detail.
6. **All playable work uses a unified operation contract.** Story missions, side quests,
   battles, planet sorties, POIs, contracts, and crises differ by cause and consequence,
   not by living in separate progression systems.
7. **Travel commits time and abstract supply.** G0 uses one `supply` pool; fuel, food,
   parts, and fleet logistics remain later decompositions.
8. **Threat is multidimensional and knowledge-limited.** The five dimensions are
   military, political, environmental, logistical, and anomalous. Each uses `low`,
   `moderate`, `high`, `severe`, or `unknown`, plus intelligence confidence of `low`,
   `medium`, or `high`.
9. **The canonical galaxy starts fresh.** Existing numbered-progression saves do not
   become fabricated history. Optional legacy import may later preserve Codex,
   Bestiary, and cosmetic accomplishments only.
10. **M2 art continues in parallel.** G0 is the next systemic milestone before M3 hubs
    and M4 decay add more dependencies on numeric world IDs.

## 3. Player experience

After a short authored prologue, the captain opens a local Atlas rather than a world
ladder. The prologue establishes the Vanguard, core crew, apparent alien enemy, and
first Tear event. It contains two required operations and one optional lead. After the
player completes it once, later fresh runs may skip it from the start screen.

The local Atlas initially shows:

- the Vanguard's current coordinate;
- Ashfall as a charted planetary contact with its existing region layer;
- the Kepler wreck as a known special-operation contact;
- a hostile picket producing a shooter interception;
- one unresolved signal with incomplete intelligence;
- uncharted coordinate space inside current sensor and travel range.

The player can:

1. inspect a known contact or select any coordinate;
2. compare distance, elapsed cycles, supply cost, threats, and confidence;
3. commit the expedition;
4. advance world time and resolve any caused interruption;
5. arrive at a persistent contact or mapped empty region;
6. launch a located operation where one exists;
7. receive material, knowledge, access, power, or historical consequences;
8. return to the Atlas and choose again.

The player is never required to complete an operation merely because they reached its
location. Arrival and mission acceptance are distinct commitments.

## 4. Spatial model

### 4.1 Hierarchical Atlas

The long-term interface supports four conceptual zoom levels:

1. **Galaxy:** macro regions, civilization scale, long-range expeditions, Fold pressure,
   migration, and large strategic changes.
2. **Sector:** continuous coordinates, signals, system contacts, range, borders, threat
   volumes, and route plotting.
3. **System:** stars, worlds, stations, fleets, anomalies, orbital positions, and local
   operations.
4. **Region:** the existing M1 pattern for landing sites, POIs, surveys, colonies, and
   ground travel.

G0 implements a functional sector view and the transitions into existing system/contact
content and the Ashfall region screen. Galaxy view may be a non-interactive framing
preview in G0. A complete macro simulation is deferred.

### 4.2 Coordinate representation

Authoritative positions use integer fixed-point values, not binary floating-point
world coordinates:

```ts
interface GalaxyCoordinate {
  sectorX: number;
  sectorY: number;
  localX: number; // integer units within sector
  localY: number;
}
```

G0 defines one bounded local sector. Later sectors extend the same address space without
changing saved coordinates. Screen pixels, pan, and zoom are projections of
`GalaxyCoordinate`; they are never authoritative positions.

"Arbitrary coordinate" does not mean infinite floating-point rerolls. Pointer and form
input normalize to integer local units, and latent content belongs to a fixed spatial
cell. Repeated plots inside the same cell resolve the same underlying facts and expand
the same mapped envelope. Coordinates must be validated as safe integers before use.

### 4.3 Seeded spatial cells

Every galaxy run persists one complete generation identity:

```ts
interface AtlasGenerationIdentity {
  galaxySeed: string;
  generationVersion: number;
  authoredAnchorRegistryVersion: number;
}
```

Pure generation derives a cell seed from:

- galaxy seed and generation-version identifier;
- sector and cell coordinates;
- authored-anchor registry version.

The three values above are an indivisible input tuple. A saved run always reloads its
persisted tuple; it never substitutes the application's newest anchor registry version.
If the application cannot load that registry version, it must require an explicit
migration or keep the run unavailable with a recoverable explanation.

Cells begin as latent deterministic facts. They may contain empty space, a stellar or
planetary contact, a hazard field, a ruin, an anomaly, a signal source, or an authored
anchor. Generated content receives stable IDs derived from seed and coordinate.

An authored anchor reserves a coordinate before procedural generation. A generator may
not overwrite or relocate it. Adding a future authored anchor requires an explicit
generation-identity migration or a previously reserved coordinate.

### 4.4 Detail promotion

The save stores materialized facts, discoveries, player-caused changes, and generation
version. It does not store every possible star.

Detail promotes through these steps:

1. **Latent:** seed and coordinate only.
2. **Observed:** signal type, approximate coordinate, and low-confidence traits.
3. **Charted:** stable contact identity and resolved coordinate.
4. **Visited:** local data and operation sources materialize.
5. **Causally active:** people, assets, history, and simulation records persist as
   required by actual relationships.

Promotion never rerolls or contradicts previously saved facts.

## 5. Atlas knowledge

Authoritative reality and captain knowledge are separate.

Each signal, contact, route sample, and threat observation records:

- subject ID or coordinate envelope;
- knowledge state: `unknown`, `signal`, `charted`, `visited`, or `lost_contact`;
- observed properties and confidence;
- source: sensor, report, rumor, archive, ally, direct visit, or other authored source;
- observation time and optional expiry/staleness rule;
- provenance needed to reproduce or dispute the information.

`Reachable`, `contested`, and `secured` are current access assessments, not knowledge
states. The same charted coordinate may become unreachable, politically denied,
contested, secured, or disrupted without being forgotten.

The UI distinguishes:

- confirmed direct knowledge;
- delayed reports;
- forecasts;
- rumors or disputed claims;
- unknown contributors.

Unknown does not silently mean lethal. The commitment screen must state that confidence
is insufficient and show the scope of uncertainty.

## 6. Exploration loop

### 6.1 Lead-driven exploration

Signals arise from sensors, rumors, archives, characters, distress calls, Fold echoes,
colonies, and operation outcomes. The captain may improve them through scanning,
research, questioning, triangulation, probes, or direct travel.

Better intelligence may improve coordinate precision, reveal threats, expose a time
window, identify an issuer, or show that a lead is false or displaced.

### 6.2 Blind-coordinate exploration

The player may plot to any coordinate inside current travel capability even without a
signal. Blind expeditions have poor confidence and may reach space without a major
contact. They still produce at least one durable gain:

- mapped coordinate coverage;
- route and hazard knowledge;
- improved nearby sensor leads;
- a stable negative survey fact;
- salvage or minor material only when causally present.

Blind travel does not guarantee a theme-park encounter. It also does not erase the
player's time with a completely unrecorded null result.

### 6.3 Discovery persistence

A discovered empty location remains mapped empty until a later historical cause changes
it. A found wreck remains the same wreck. A destroyed fleet remains destroyed. New
danger may enter later only through a recorded actor, event, migration, disaster, or
anomaly.

## 7. Route planning and travel

### 7.1 Route preview

The route planner is pure. Given saved world state, starting coordinate, destination,
ship capability, and policy, it returns:

- stable route-plan ID and ordered legs;
- distance and elapsed world cycles;
- abstract supply cost and projected reserve;
- known threat bands per dimension;
- overall risk presentation and confidence;
- known ports, relays, allies, or repair opportunities;
- forecasted changes likely to occur before return;
- reasons the route is blocked or unsupported.

G0 offers direct travel and any clearly available authored relay path. Later search may
consider fleets, treaties, infrastructure, and dynamic detours.

### 7.2 Commitment

`TravelCommitment` is a journaled state machine with states `committed`, `advancing`,
`interrupted`, `arrived`, `diverted`, and `resolved`. Each record contains its stable
transaction ID, immutable route inputs, next leg index, applied checkpoint IDs, and the
authoritative cost/time snapshot.

Committing a route:

1. revalidates the preview against current authoritative state;
2. blocks with an updated explanation if the preview is stale or resources changed;
3. uses one pure reducer transition to atomically create the commitment, deduct supply,
   record the elapsed-time obligation, and update the vessel to `in_transit` in the same
   returned save value;
4. advances world cycles through the existing cycle-advancement boundary;
5. records every completed leg or interruption under a deterministic checkpoint ID;
6. resolves scheduled route legs and caused interruptions;
7. records arrival or a consequential diverted state.

Repeating the initial transition with the same transaction ID is a no-op. Resuming from
any later state applies only missing checkpoint IDs. Reloading, double-confirming, or
replaying a partially advanced commitment cannot duplicate cost, skip time, or reroll a
committed interruption.

### 7.3 Threat

Every route and destination can contribute:

- **military:** patrols, raiders, fleets, blockades, fortresses;
- **political:** denied passage, sanctions, warrants, disputed claims;
- **environmental:** storms, radiation, debris, gravity, temperature;
- **logistical:** range, supply, repair scarcity, endurance, communication gaps;
- **anomalous:** temporal instability, false signals, mutation, Fold effects.

G0 uses qualitative bands and confidence, not precise success percentages. A band is an
assessment of exposure, not a predetermined outcome.

### 7.4 Interruptions and retreat

Routine travel through known safe space resolves cleanly. An interruption requires an
actual saved or generated cause along the route. It may launch an existing mode, offer
a command decision, divert the route, impose loss, or allow retreat.

Failure may damage, strand, capture, or displace the captain, but must leave a playable
next action. G0 implements one military interruption path and one safe arrival path.
Generational stasis, deep stasis, and exile continuations remain later slices.

## 8. Unified operations

### 8.1 Operation contract

Every operation has:

```ts
interface Operation {
  id: string;
  source: "story" | "character" | "board" | "systemic" | "exploration" | "reliable_work";
  location: GalaxyCoordinate;
  contactId: string | null;
  issuerId: string | null;
  causeFactIds: string[];
  objective: OperationObjective;
  modifiers: OperationModifier[];
  phases: OperationPhase[];
  knownThreat: ThreatAssessment;
  costs: OperationCosts;
  rewards: OperationRewards;
  availability: OperationAvailability;
  state: "available" | "accepted" | "active" | "complete" | "failed" | "expired";
}
```

The exact TypeScript decomposition may use smaller referenced records, but these facts
and boundaries must remain explicit.

An operation has a stable place, cause, participants, constraints, costs, and outcome.
Mode is selected by what physically happens.

### 8.2 Existing content adapters

G0 adapts without rewriting gameplay engines:

- a vertical-shooter level becomes a patrol or interception phase;
- Kepler Black Box becomes a located named wreck operation;
- Ashfall exposes its planet mission, region map, and POIs from its system contact;
- an existing side-quest condition becomes an optional operation modifier;
- existing one-time rewards remain one-time facts;
- mission delivery continues routing cargo through `missionDelivery.ts`.

Legacy `world` and `level` fields may remain inside adapter payloads until engines are
refactored. An `OperationLaunchContext` authorizes launch from the canonical operation
state. Adapters may not consult legacy `levels`, `currentWorld`, planet-completion,
special-mission unlock, or side-quest unlock fields as availability gates.

### 8.3 Repeatable work and unique history

Reliable ports and settlements may offer modest recovery work so poverty or exile does
not soft-lock play. Reward scale derives from actual distance, demand, danger, and
relationships, not world number.

Named discoveries, deaths, political decisions, boss defeats, evidence, and story
revelations resolve once. Replaying an engine scenario may instantiate new work, but it
cannot repeat or erase the original historical fact.

## 9. Progression outputs

Operations and exploration may advance five positions:

1. **Material:** supply, credits, cargo, repairs, salvage, rare components.
2. **Knowledge:** coordinates, threat confidence, history, evidence, navigation data.
3. **Access:** safe passage, allies, relays, ports, political permission, secured space.
4. **Power:** XP, crew growth, ship capability, institutions, fleets, authority.
5. **History:** consequences, relationships, claims, enemies, obligations, cultural
   interpretation.

G0 implements material, knowledge, and one access effect. Existing pilot XP and standing
may pass through adapters where already supported. Deep political and generational
outputs remain later.

Resources never directly purchase planet revelation. Knowledge identifies a
possibility, capability makes travel possible, and commitment attempts it.

## 10. Living simulation fidelity

The Atlas must scale without pretending to run every person at frame fidelity:

1. **Active scene:** current gameplay engine.
2. **Current theater:** local vessels, operations, tactical clocks, and nearby actors.
3. **Connected actors:** colonies, fleets, leaders, relationships, directives, and
   active crises processed at event boundaries.
4. **Distant known:** coarse population, power, economy, war, migration, and major event
   summaries.
5. **Latent space:** seed, coordinates, and macro fields only.

Relevance may outrank distance. A distant colony in civil war can receive more detail
than a quiet neighboring system.

G0 implements active scene, current theater, and latent/observed Atlas facts. It must
define serializable seams for later layers but does not simulate generations or distant
civilizations.

## 11. G0 vertical slice

### 11.1 Included content

One deterministic local sector contains:

- one Vanguard starting coordinate;
- Ashfall as one authored planet/system contact;
- Kepler as one authored wreck contact;
- one authored hostile-picket contact;
- one unresolved signal;
- one deterministic blind-coordinate result;
- one optional relay route if the chosen starting layout can support it clearly.

The slice reuses at least three playable contexts: shooter interception, Kepler
first-person retrieval, and Ashfall region/POI or planet play.

### 11.2 Included systems

- fresh galaxy-run creation and explicit entry;
- stable galaxy seed and generation version;
- persistent current or in-transit vessel location;
- sector pan, zoom, pointer, touch, and keyboard navigation;
- focusable contact list and coordinate selection outside the canvas;
- known contact and blind-coordinate selection;
- signal/contact intel and confidence;
- pure route preview;
- one abstract supply pool;
- one-to-three-cycle local travel commitments;
- one safe travel resolution and one caused military interruption;
- operation adapters for the selected existing content;
- material, knowledge, and one route/access consequence;
- SaveData defaults, field-by-field migration, and DevPanel fixtures.

### 11.3 Explicitly deferred

- whole-galaxy generation and a fully interactive galaxy-scale view;
- authored prologue implementation, completion tracking, and skip flow; G0 begins from
  a deterministic post-prologue fixture while preserving the approved opening design;
- three-dimensional free navigation;
- generations, Great Houses, religions, cultural captain myths, and succession;
- distant political simulation and autonomous governors;
- fleet organizations and mass battles;
- fuel/food/parts decomposition;
- transit-stasis subjective-time simulation and deep stasis;
- procedural civilizations;
- complete conversion of every legacy level, boss, planet, and quest;
- final art pass for the Atlas.

## 12. Architecture

### 12.1 Pure modules

Recommended boundaries:

- `engine/galaxy/coordinates.ts`: fixed-point coordinate helpers and projection-neutral
  distance;
- `engine/galaxy/atlas.ts`: cell seeds, authored anchors, materialization, knowledge;
- `engine/galaxy/routePlanner.ts`: pure route preview and block reasons;
- `engine/galaxy/travelResolver.ts`: idempotent commitments and travel outcomes;
- `engine/operations/operationCatalog.ts`: located operation definitions and legacy
  adapters;
- `engine/operations/operationOutcome.ts`: normalized rewards and historical facts.

Names may change during planning, but coordinate generation, route calculation, travel
mutation, operation definition, and UI must remain separate responsibilities.

No pure module touches `window`, `document`, Canvas, WebGL, wall-clock time, or
unseeded randomness.

### 12.2 UI

`GalaxyAtlasScreen` is a hybrid React surface:

- Canvas 2D renders the spatial field, stars, contacts, threat volumes, routes, and
  large-scale pan/zoom affordances;
- React/DOM renders the contact list, filters, selected-coordinate details, route
  comparison, commitment controls, warnings, and accessible status;
- Canvas is initialized only inside a component effect or event after mount;
- every selectable contact has a focusable DOM equivalent;
- arbitrary-coordinate selection has keyboard and form controls, not pointer-only input;
- selection state is shared, so Canvas click, touch, keyboard focus, and DOM activation
  all update the same target.

The current gameplay canvas remains the mission renderer. The Atlas screen may own its
own mounted Canvas 2D element while gameplay is inactive.

### 12.3 Save boundary

The existing save adds a nullable, field-migrated `galaxyRun` domain and an explicit
active-experience selector. Old saves migrate `galaxyRun` to `null` with `??` fallback.
Legacy top-level progression remains preserved for the legacy experience but is not
authoritative while a galaxy run is active.

`GalaxyRunState` owns its own progression namespace: supply, resources, pilot state,
operation states, Atlas knowledge, current location, contacts, and historical facts.
Starting the canonical galaxy constructs that entire namespace from one explicit
factory using only generation identity and an allowlisted import payload. It never
reads legacy resources, upgrades, world unlocks, completion arrays, colonies, factions,
or story decisions.

Existing engines receive a transient compatibility projection created from
`GalaxyRunState`, not the preserved legacy progression fields. After play, the operation
adapter merges only allowlisted result deltas back into `GalaxyRunState`. It may not
write legacy history while the galaxy experience is active.

Any future legacy import is opt-in, allowlisted, and copy-only. It may include Codex,
Bestiary, and cosmetics. It may not import resources, upgrades, world unlocks, mission
completion, colony state, factions, or story decisions.

## 13. Data flow

### 13.1 Atlas selection

1. UI requests visible cell facts from the pure Atlas using seed, version, and viewport
   cell coordinates.
2. Atlas combines authored anchors, saved materializations, and latent generation.
3. UI projects returned coordinates to pixels.
4. Selecting Canvas or DOM content produces the same `AtlasTarget`.
5. Route planner previews from saved vessel state without mutation.

### 13.2 Travel

1. Player confirms a displayed route plan.
2. Resolver re-plans from current state and compares the plan identity and inputs.
3. If valid, one reducer transition journals the transaction, supply deduction,
   elapsed-time obligation, and in-transit location atomically.
4. Later resolver transitions advance only unapplied leg checkpoint IDs.
5. A caused interruption launches an operation phase; otherwise arrival materializes
   and records the destination knowledge.
6. Completion or retreat resolves through normalized operation outcome handling.

### 13.3 Operation outcome

1. Existing engine reports its typed result.
2. Adapter translates it into material, knowledge, access, XP/standing, and fact deltas.
3. Validator rejects unknown IDs or impossible duplicate unique rewards.
4. Reducers commit the outcome once.
5. Atlas knowledge, world history, and available operations refresh from saved truth.

## 14. Error and continuity handling

- **Stale preview:** do not commit; show exactly which cost, route, threat, or capability
  changed and present the refreshed preview.
- **Insufficient supply:** block before mutation and keep the selected target.
- **Missing authored adapter:** keep the contact visible, mark the operation unavailable,
  and return safely to the Atlas; never crash the save.
- **Generation mismatch:** saved materialized facts outrank regenerated latent output.
  Unknown future versions require an explicit migration, not silent reroll.
- **Interrupted reload:** resume the saved `TravelCommitment` by transaction ID.
- **Double confirmation or partial travel replay:** the commitment reducer and leg
  checkpoint IDs no-op already applied work.
- **Duplicate completion:** unique rewards and facts no-op with a recorded validation
  result; costs and rewards are never applied twice.
- **Unknown threat:** communicate uncertainty and allow the player to reconsider; do not
  substitute an undisclosed fatal roll.
- **No major blind discovery:** persist mapped coverage and a negative survey fact.
- **Unreachable destination:** explain range, supply, political, or route cause and show
  currently known ways to improve reach.
- **Legacy save:** offer a clearly labeled new galaxy run; do not auto-delete the old
  save or silently blend histories.
- **Compatibility projection:** reject any adapter result outside its allowlisted galaxy
  outcome fields rather than leaking it into preserved legacy progression.

## 15. Acceptance criteria

### 15.1 Determinism

- Same complete generation identity and coordinate produce identical latent
  cell/contact facts across reload and visit order.
- Updating the application's default anchor registry cannot change an unmigrated saved
  run's latent results.
- Repeated blind plots inside one spatial cell cannot farm new procedural contacts.
- Different seeds produce meaningfully different uncharted results without moving
  authored anchors.
- Pan, zoom, display size, FPS, and input method cannot affect generation.
- A materialized discovery survives generator changes and reload.

### 15.2 Navigation and travel

- Player can select every authored contact through pointer, touch, keyboard, and DOM.
- Player can enter and select an arbitrary in-range coordinate without a signal.
- Keyboard arrows pan, keyboard zoom controls change scale, and focus remains on a
  meaningful DOM control after either action.
- Touch drag and pinch, or equivalently labeled touch controls, pan and zoom without
  requiring mouse emulation or accidentally committing a selection.
- A player can select a contact, inspect the full route preview, commit travel, and
  reach arrival using focusable DOM controls without interacting with Canvas.
- Route preview names distance, cycles, supply, five threat dimensions, confidence, and
  every block reason.
- Committing deducts supply and advances time exactly once.
- Double-confirming one transaction deducts and journals it once.
- Simulated reload from every commitment state resumes only unapplied checkpoints and
  never rerolls or duplicates cost, time, interruption, or arrival.
- Safe route arrives; hostile route launches the caused shooter interruption.

### 15.3 Operations and progression

- Ashfall, Kepler, and hostile picket launch from physical Atlas contacts.
- Ashfall, Kepler, and hostile picket launch from a fresh galaxy run while the engine
  compatibility projection's legacy `levels`, planet completion, special-mission
  unlocks, and side-quest unlocks are empty or locked, regardless of preserved legacy
  save values.
- At least one existing side-quest condition functions as an operation modifier without
  depending on its old world-level availability gate.
- POI/planet cargo still routes through `missionDelivery.ts`.
- Unique Kepler story reward remains one-time.
- One operation produces material, one produces knowledge, and one changes an access or
  route fact.
- No G0 UI presents W1–W8 as progression.

### 15.4 Save, static export, and regression

- `galaxyRun` has a field-by-field migration default and migration tests.
- A legacy save remains readable and can start a clean galaxy run explicitly.
- With import disabled, two legacy saves containing different resources, upgrades,
  unlocks, completions, colonies, factions, and story choices produce identical galaxy
  defaults for the same generation identity.
- Galaxy operation play mutates only the galaxy namespace; preserved legacy progression
  is byte-for-byte unchanged.
- New modules are safe during `next build` evaluation with no browser global access at
  module scope.
- Existing gameplay render output remains unchanged until launched through an adapter.
- DevPanel provides fixed seeds for starting Atlas, known route, hostile route, blind
  discovery, insufficient supply, and in-transit reload.
- TypeScript, colony tests, engine tests, sprite tests, static build, DevPanel build, and
  browser playtests pass before merge.

## 16. Roadmap effect

- **M1** is complete and proves the region-scale knowledge/travel pattern.
- **M2** continues as an independent art lane.
- **G0** becomes the next systemic implementation slice.
- **M3** hubs attach operations, people, markets, and government to Atlas contacts.
- **M4** decay emits located crises, raiders, syndicates, and interventions.
- **M5** navigation, engineering, command, and diplomacy gain real route contexts.
- **M6** expands coarse distant simulation, multi-colony comparison, strategic actors,
  campaigns, and frontier reach rather than introducing the first galaxy map.

## 17. Non-goals and guardrails

- Do not recreate W1–W8 with different labels or eight sector gates.
- Do not discard proven content solely because its wrapper changes.
- Do not require a colony to continue exploring; fleets, allies, relays, salvage, and
  hidden infrastructure remain future alternate reach sources.
- Do not make blind travel secretly guarantee a bespoke encounter.
- Do not make arbitrary coordinates pointer-only.
- Do not render every possible star as a DOM node.
- Do not use unseeded `Math.random`, `Date.now`, or module-scope browser objects.
- Do not charge a route before revalidation or resolve a commitment twice.
- Do not expose precise threat probabilities when the captain has qualitative or stale
  intelligence.
- Do not turn every journey into a battle.
- Do not implement generations, Houses, deep stasis, or full galactic politics in G0.
- Do not translate legacy level completion into invented canonical history.
- Do not make the Atlas a dashboard replacement for playable operations.

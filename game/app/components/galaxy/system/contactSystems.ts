import type { PlanetId } from "../../engine/types";
import type {
  AtlasCellFact,
  AtlasKnowledgeRecord,
  GalaxyRunState,
  KnowledgeState,
} from "../../engine/galaxy/galaxyTypes";
import {
  buildPlanets,
  STAR_COLORS,
  SYSTEM_ATLAS_SEED,
  type StarClass,
  type StarSystem,
  type SystemCatalogue,
  type SystemKnowledge,
} from "./starSystems";

/**
 * Binds galaxy-run contacts to System Atlas star systems.
 *
 * The run is the only source of truth for which systems exist and what the captain knows
 * about them. This module only decides how a known contact is *presented* as a system: its
 * star class, which catalogue worlds orbit it, and the fog level. Nothing here writes state.
 */

interface AuthoredSystem {
  name: string;
  starClass: StarClass;
  planetIds: PlanetId[];
}

/** Authored presentation for the five G0 anchors. Order of worlds = orbit order. */
export const AUTHORED_CONTACT_SYSTEMS: Readonly<Record<string, AuthoredSystem>> = Object.freeze({
  "contact:vanguard": { name: "Vanguard", starClass: "F", planetIds: ["bastion", "luminos"] },
  "contact:ashfall": { name: "Ashfall Reach", starClass: "G", planetIds: ["ashfall", "pyraxis", "ossuary"] },
  "contact:hostile-picket": { name: "Hostile Picket", starClass: "M", planetIds: ["glaciem"] },
  "contact:kepler": { name: "Kepler", starClass: "K", planetIds: ["verdania", "genesis"] },
});

const PROCEDURAL_PLANET_POOL: readonly PlanetId[] = Object.freeze(["abyssia", "prismara"]);
const STAR_CLASSES: readonly StarClass[] = Object.freeze(["O", "B", "A", "F", "G", "K", "M"]);

/** Sector-plane units per coordinate unit, so the catalogue spans roughly ±410 like the seed. */
const POSITION_SCALE = 0.2;
const SECTOR_CENTRE = 2048;

/** Which contact a catalogue planet belongs to; null for worlds only procedural systems carry. */
export function contactIdForPlanet(planetId: PlanetId): string | null {
  for (const [contactId, system] of Object.entries(AUTHORED_CONTACT_SYSTEMS)) {
    if (system.planetIds.includes(planetId)) return contactId;
  }
  return null;
}

function safeValues<T>(record: Record<string, T>): T[] {
  return Object.keys(record)
    .filter(key => Object.prototype.hasOwnProperty.call(record, key))
    .map(key => record[key]);
}

export function latestKnowledge(run: GalaxyRunState, subjectId: string): AtlasKnowledgeRecord | null {
  return safeValues(run.atlas.knowledge)
    .filter(entry => entry.subjectId === subjectId)
    .sort((left, right) => right.observedCycle - left.observedCycle || left.id.localeCompare(right.id))[0] ?? null;
}

export function fallbackContactLabel(subjectId: string): string {
  const body = subjectId.replace(/^(?:(?:contact|signal|procedural):)+/, "");
  // Procedural ids are JSON identity keys; present them as a sector designation instead.
  if (body.startsWith("[")) {
    try {
      const parts = JSON.parse(body) as unknown[];
      const cellX = parts[5];
      const cellY = parts[6];
      if (typeof cellX === "number" && typeof cellY === "number") {
        return `CONTACT ${String(cellX).padStart(2, "0")}-${String(cellY).padStart(2, "0")}`;
      }
    } catch {
      // fall through to the generic cleanup
    }
  }
  return body.replace(/[-_:]+/g, " ").trim().toUpperCase();
}

export function contactLabel(fact: AtlasCellFact, knowledge: AtlasKnowledgeRecord | null): string {
  const observed = knowledge?.observedProperties.label;
  if (typeof observed === "string" && observed.trim().length > 0) return observed.toUpperCase();
  return fallbackContactLabel(fact.id);
}

/** Contact knowledge → system fog. `visited` becomes `home` only where the vessel sits. */
export function systemKnowledgeFor(state: KnowledgeState, vesselHere: boolean): SystemKnowledge | null {
  switch (state) {
    case "visited":
      return vesselHere ? "home" : "charted";
    case "charted":
      return "charted";
    case "signal":
      return "signal";
    default:
      return null;
  }
}

function systemPosition(fact: AtlasCellFact): { x: number; y: number } {
  return {
    x: Number(((fact.coordinate.localX - SECTOR_CENTRE) * POSITION_SCALE).toFixed(1)),
    y: Number(((fact.coordinate.localY - SECTOR_CENTRE) * POSITION_SCALE).toFixed(1)),
  };
}

function proceduralPlanetIds(stableSeed: number): PlanetId[] {
  const count = 1 + (stableSeed % 2);
  const start = (stableSeed >>> 3) % PROCEDURAL_PLANET_POOL.length;
  return Array.from({ length: count }, (_, index) => PROCEDURAL_PLANET_POOL[(start + index) % PROCEDURAL_PLANET_POOL.length]);
}

function titleCase(label: string): string {
  return label.toLowerCase().replace(/(^|\s)\S/g, letter => letter.toUpperCase());
}

/** Star class for a fact: authored anchors keep theirs, procedural contacts are seeded. */
export function starClassForFact(fact: AtlasCellFact): StarClass {
  const authored = fact.contactId ? AUTHORED_CONTACT_SYSTEMS[fact.contactId] : undefined;
  return authored?.starClass ?? STAR_CLASSES[fact.stableSeed % STAR_CLASSES.length];
}

/** Build the presented system for one stellar or signal fact, or null when fog hides it entirely. */
export function starSystemForFact(run: GalaxyRunState, fact: AtlasCellFact): StarSystem | null {
  if (fact.kind !== "stellar_contact" && fact.kind !== "signal") return null;
  const knowledge = latestKnowledge(run, fact.id);
  if (!knowledge) return null;
  const id = fact.contactId ?? fact.id;
  const vesselHere = run.vessel.contactId === id
    || (run.vessel.coordinate.localX === fact.coordinate.localX && run.vessel.coordinate.localY === fact.coordinate.localY);
  const systemKnowledge = systemKnowledgeFor(knowledge.state, vesselHere);
  if (!systemKnowledge) return null;

  const authored = fact.contactId ? AUTHORED_CONTACT_SYSTEMS[fact.contactId] : undefined;
  const starClass: StarClass = starClassForFact(fact);
  // Fog: anything known only as a signal carries no worlds, whatever the underlying fact is.
  const planetIds: PlanetId[] = fact.kind === "signal" || systemKnowledge === "signal"
    ? []
    : authored?.planetIds ?? proceduralPlanetIds(fact.stableSeed);
  const label = contactLabel(fact, knowledge);
  return {
    id,
    name: authored?.name ?? titleCase(label),
    starClass,
    starColor: STAR_COLORS[starClass],
    position: systemPosition(fact),
    knowledge: systemKnowledge,
    planets: buildPlanets(SYSTEM_ATLAS_SEED, id, planetIds),
  };
}

export function starSystemForContact(run: GalaxyRunState, contactId: string): StarSystem | null {
  const fact = safeValues(run.atlas.materializedFacts).find(entry => (entry.contactId ?? entry.id) === contactId);
  return fact ? starSystemForFact(run, fact) : null;
}

/**
 * Every known stellar contact and signal as a catalogue. Home is the vessel's contact when it
 * is a stellar contact, else the nearest visited system, else the first system.
 */
export function systemCatalogueForRun(run: GalaxyRunState): SystemCatalogue {
  const systems = safeValues(run.atlas.materializedFacts)
    .map(fact => starSystemForFact(run, fact))
    .filter((system): system is StarSystem => system !== null)
    .sort((left, right) => left.position.x - right.position.x || left.position.y - right.position.y || left.id.localeCompare(right.id));
  const atVessel = systems.find(system => system.knowledge === "home");
  const home = atVessel
    ?? systems.find(system => system.id === run.vessel.contactId)
    ?? systems.find(system => system.knowledge === "charted")
    ?? systems[0];
  return { systems, homeId: home?.id ?? "" };
}

import type { ColonyState } from "./colonyTypes";
import type { SaveData } from "../../engine/types";

const HABITAT_OVERFLOW = 20;
const isDev = () => process.env.NODE_ENV !== "production";

export function assertColonyInvariant(
  colony: ColonyState,
  predicate: (c: ColonyState) => boolean,
  message: string,
): void {
  if (!isDev()) return;
  if (!predicate(colony)) {
    throw new Error(`[ColonyInvariant] ${message} (colony=${colony.id})`);
  }
}

export function assertSaveInvariant(
  save: SaveData,
  predicate: (s: SaveData) => boolean,
  message: string,
): void {
  if (!isDev()) return;
  if (!predicate(save)) {
    throw new Error(`[SaveInvariant] ${message}`);
  }
}

/** Run the canonical invariant set against a colony. Throws on first violation. */
export function runStandardInvariants(colony: ColonyState): void {
  assertColonyInvariant(
    colony,
    c => c.population.total >= 0,
    "Population must be non-negative",
  );
  assertColonyInvariant(
    colony,
    c => c.resources.food >= 0 && c.resources.water >= 0 && c.resources.metal >= 0 && c.resources.credits >= 0,
    "Resources must be non-negative",
  );
  assertColonyInvariant(
    colony,
    c => c.happiness >= 0 && c.happiness <= 100,
    "Happiness must be 0-100",
  );
  assertColonyInvariant(
    colony,
    c => c.population.total <= c.population.capacity + HABITAT_OVERFLOW,
    "Population exceeded sane maximum",
  );
  assertColonyInvariant(
    colony,
    c => c.population.recentDeaths.length <= 10,
    "recentDeaths ring buffer cannot exceed 10 entries",
  );
}

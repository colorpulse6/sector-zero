import type { SaveData } from "../types";
import { createFreshGalaxyRun } from "./galaxyRun";
import type { ExperienceMode } from "./galaxyTypes";

export type ExperienceMapSurface = "legacy_star_map" | "galaxy_atlas";

export type LegacyProgressionSnapshot = Omit<
  SaveData,
  "activeExperience" | "galaxyRun"
>;

/** Select or resume the isolated galaxy namespace without rewriting legacy data. */
export function beginGalaxyExperience(save: SaveData): SaveData {
  return {
    ...save,
    activeExperience: "galaxy",
    galaxyRun: save.galaxyRun ?? createFreshGalaxyRun(),
  };
}

/** The cockpit's STAR MAP control resolves to one exclusive map surface. */
export function mapSurfaceForExperience(
  experience: ExperienceMode,
): ExperienceMapSurface {
  return experience === "galaxy" ? "galaxy_atlas" : "legacy_star_map";
}

/** Completed galaxy operations always return to the Atlas mission surface. */
export function returnSurfaceForOperation(save: SaveData): ExperienceMapSurface {
  if (save.activeExperience !== "galaxy" || save.galaxyRun === null) {
    throw new Error("A galaxy operation cannot return without an active galaxy run.");
  }
  return "galaxy_atlas";
}

/** Serializable proof that galaxy transitions leave legacy progression inert. */
export function legacyProgressionSnapshot(
  save: SaveData,
): LegacyProgressionSnapshot {
  const {
    activeExperience: _activeExperience,
    galaxyRun: _galaxyRun,
    ...legacy
  } = save;
  return structuredClone(legacy);
}

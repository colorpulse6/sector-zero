import type { SaveData } from "../types";
import type { CanonicalSaveStore } from "../missionOutcome";
import { createFreshGalaxyRun } from "./galaxyRun";
import type { ExperienceMode } from "./galaxyTypes";

export type ExperienceMapSurface = "legacy_star_map" | "galaxy_atlas";

export interface GalaxyCloseTransition {
  surface: "experience_selector";
  clearGalaxyOverlays: true;
  legacyLaunchersReachable: false;
}

/** Atlas close is an experience boundary, never an implicit Legacy-mode switch. */
export function galaxyCloseTransition(): GalaxyCloseTransition {
  return {
    surface: "experience_selector",
    clearGalaxyOverlays: true,
    legacyLaunchersReachable: false,
  };
}

interface KeyboardTargetLike {
  tagName?: unknown;
  isContentEditable?: unknown;
  getAttribute?: (name: string) => unknown;
  closest?: (selector: string) => unknown;
}

interface OperationSurfaceState {
  galaxyOperation?: { id: string; label: string };
}

const INTERACTIVE_SELECTOR = [
  "button",
  "input",
  "select",
  "textarea",
  "a[href]",
  "[contenteditable]",
  "[role='button']",
  "[role='link']",
  "[role='checkbox']",
  "[role='radio']",
  "[role='menuitem']",
  "[role='option']",
  "[role='switch']",
  "[role='tab']",
  "[role='textbox']",
  "[role='combobox']",
  "[role='listbox']",
  "[role='slider']",
  "[role='spinbutton']",
].join(",");

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

/** Global shortcuts must not preempt native actions owned by focused controls. */
export function isInteractiveKeyboardTarget(target: unknown): boolean {
  if (typeof target !== "object" || target === null) return false;
  try {
    const candidate = target as KeyboardTargetLike;
    const tagName = typeof candidate.tagName === "string"
      ? candidate.tagName.toUpperCase()
      : "";
    if (["BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(tagName)) return true;
    const href = candidate.getAttribute?.("href");
    if (tagName === "A" && href !== null && href !== undefined) return true;
    const contentEditable = candidate.getAttribute?.("contenteditable");
    if (candidate.isContentEditable === true || contentEditable === "true") return true;
    const role = candidate.getAttribute?.("role");
    if (typeof role === "string" && [
      "button", "link", "checkbox", "radio", "menuitem", "option", "switch",
      "tab", "textbox", "combobox", "listbox", "slider", "spinbutton",
    ].includes(role.toLowerCase())) return true;
    return typeof candidate.closest === "function" && candidate.closest(INTERACTIVE_SELECTOR) !== null;
  } catch {
    return false;
  }
}

/** Atlas operations replace compatibility coordinates with canonical identity. */
export function operationSurfaceLabel(
  state: OperationSurfaceState,
  legacyLabel: string,
): string {
  return state.galaxyOperation?.label.toUpperCase() ?? legacyLabel;
}

export function experienceReturnLabel(galaxyExperience: boolean): "RETURN TO ATLAS" | "RETURN TO HUB" {
  return galaxyExperience ? "RETURN TO ATLAS" : "RETURN TO HUB";
}

/** One persistence attempt is isolated so a caller can safely offer a retry. */
export function attemptCanonicalPersistence<T>(
  value: T,
  persist: (value: T) => void,
): { ok: true } | { ok: false } {
  try {
    persist(value);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export type CanonicalTransitionPersistenceResult =
  | { status: "saved"; save: SaveData }
  | { status: "conflict"; latest: SaveData }
  | { status: "write_failed"; error: Error };

/** SaveData is app-owned JSON; object key order is not persistence authority. */
function canonicalSaveJson(save: SaveData): string {
  return JSON.stringify(save, (_key, value: unknown) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0));
  });
}

/** A retained whole-save transition may write only against its exact saved base. */
export function attemptCanonicalTransitionPersistence(
  store: CanonicalSaveStore,
  expectedBase: SaveData,
  candidate: SaveData,
): CanonicalTransitionPersistenceResult {
  try {
    const retainedCandidate = structuredClone(candidate);
    const expectedJson = canonicalSaveJson(expectedBase);
    const candidateJson = canonicalSaveJson(retainedCandidate);
    const latest = structuredClone(store.read());
    const latestJson = canonicalSaveJson(latest);
    if (latestJson === candidateJson) return { status: "saved", save: latest };
    if (latestJson !== expectedJson) return { status: "conflict", latest };

    try {
      store.write(structuredClone(retainedCandidate));
    } catch (error) {
      // Storage can succeed before a later subscriber throws. Never replay it.
      try {
        const persisted = structuredClone(store.read());
        if (canonicalSaveJson(persisted) === candidateJson) {
          return { status: "saved", save: persisted };
        }
      } catch {
        // An unreadable store cannot establish that the write succeeded.
      }
      throw error;
    }
    return { status: "saved", save: retainedCandidate };
  } catch (error) {
    return {
      status: "write_failed",
      error: error instanceof Error ? error : new Error("Canonical transition persistence failed."),
    };
  }
}

export type GalaxyPoiRecoverySurface = "atlas" | "poi_outcome" | "blocked";

/** Rejected or unresolved delivery authority must never expose an actionable Atlas. */
export function galaxyPoiRecoverySurface(
  recovery: { ok: true; pending: unknown | null } | { ok: false },
): GalaxyPoiRecoverySurface {
  if (!recovery.ok) return "blocked";
  return recovery.pending === null ? "atlas" : "poi_outcome";
}

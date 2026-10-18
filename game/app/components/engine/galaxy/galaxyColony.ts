import type { ColonyState } from "../../colony/shared/colonyTypes";
import { colonyMerchantRank } from "../../colony/shared/factionLedger";
import { applyShopPurchase } from "../consumables";
import type { FPShopPurchaseRequest, SaveData } from "../types";
import {
  mergeProjectionIntoGalaxy,
  projectGalaxyRunToLegacySave,
  projectGalaxyRunToLegacyState,
} from "./galaxyProjection";
import type { GalaxyRunState } from "./galaxyTypes";

/**
 * Galaxy colonies the vessel can descend to, keyed by colony id. Each names the atlas
 * contact the vessel must park at. Ashfall Primary is the only galaxy colony today.
 */
const COLONY_CONTACTS: Readonly<Record<string, { contactId: string; label: string }>> = Object.freeze({
  "galaxy:ashfall-primary": Object.freeze({ contactId: "contact:ashfall", label: "ASHFALL" }),
});

/**
 * Projection fields a colony visit may change. Shop purchases spend credits and stock
 * consumables; every other field must come back exactly as it was projected.
 */
const VISIT_FIELDS: ReadonlySet<string> = new Set(["credits", "consumableInventory"]);

export type GalaxyColonyAccess =
  | { status: "full"; colonyId: string; contactId: string }
  | { status: "unavailable"; reason: string };

export type OpenGalaxyColony =
  | { ok: true; parent: SaveData; run: GalaxyRunState; colony: ColonyState; projectedSave: SaveData }
  | { ok: false; reason: string };

export type GalaxyColonyVisitMerge =
  | { ok: true; save: SaveData }
  | { ok: false; reason: "unauthorized_change" | "projection_merge_failed" };

function ownLink(colonyId: string): { contactId: string; label: string } | null {
  return Object.prototype.hasOwnProperty.call(COLONY_CONTACTS, colonyId) ? COLONY_CONTACTS[colonyId] : null;
}

function visited(run: GalaxyRunState, contactId: string): boolean {
  return Object.keys(run.atlas.knowledge).some(key => {
    const record = run.atlas.knowledge[key];
    return record.subjectId === contactId && record.state === "visited";
  });
}

function samePlainData(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== "object" || typeof right !== "object" || left === null || right === null) return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) =>
    key === rightKeys[index] && samePlainData(leftRecord[key], rightRecord[key]));
}

/** The atlas contact a galaxy colony sits at, or null for a colony with no contact. */
export function galaxyColonyContactId(colonyId: string): string | null {
  return ownLink(colonyId)?.contactId ?? null;
}

/** The run's colony at an atlas contact, if the vessel could descend to one there. */
export function galaxyColonyAtContact(run: GalaxyRunState | null, contactId: string | null): string | null {
  if (run === null || contactId === null) return null;
  return run.colonies.find(colony => ownLink(colony.id)?.contactId === contactId)?.id ?? null;
}

/**
 * Whether the vessel may descend to a galaxy colony. Same rule as the region's full access:
 * the colony belongs to the run, its contact is visited, the vessel is stationary there and
 * no travel record is open. Callers that launch must re-derive this.
 */
export function galaxyColonyAccess(run: GalaxyRunState | null, colonyId: string | null): GalaxyColonyAccess {
  if (run === null || colonyId === null) return { status: "unavailable", reason: "SELECT A COLONY STAR" };
  const link = ownLink(colonyId);
  if (link === null || !run.colonies.some(colony => colony.id === colonyId)) {
    return { status: "unavailable", reason: "NO COLONY HERE" };
  }
  if (!visited(run, link.contactId)) return { status: "unavailable", reason: `ARRIVE AT ${link.label} FIRST` };
  const parked = run.activeTravel === null
    && run.vessel.status === "stationary"
    && run.vessel.contactId === link.contactId;
  return parked
    ? { status: "full", colonyId, contactId: link.contactId }
    : { status: "unavailable", reason: `PARK AT ${link.label} TO DESCEND` };
}

/**
 * Open a galaxy colony for the first-person walk. Returns the validated canonical parent and a
 * disposable legacy-shaped projection of the run for the colony engine. Never persist the
 * projection; fold changes back with `mergeGalaxyColonyVisit`.
 */
export function openGalaxyColony(save: SaveData, colonyId: string): OpenGalaxyColony {
  try {
    if (save.activeExperience !== "galaxy" || save.galaxyRun === null) {
      return { ok: false, reason: "NO ACTIVE GALAXY RUN" };
    }
    const validated = mergeProjectionIntoGalaxy(save.galaxyRun, {});
    if (!validated.ok) return { ok: false, reason: "GALAXY RUN COULD NOT BE READ" };
    const run = validated.galaxyRun;
    const access = galaxyColonyAccess(run, colonyId);
    if (access.status === "unavailable") return { ok: false, reason: access.reason };
    const colony = run.colonies.find(entry => entry.id === colonyId);
    if (colony === undefined) return { ok: false, reason: "NO COLONY HERE" };
    const parent = { ...save, galaxyRun: run };
    return { ok: true, parent, run, colony, projectedSave: projectGalaxyRunToLegacySave(parent) };
  } catch {
    return { ok: false, reason: "GALAXY RUN COULD NOT BE READ" };
  }
}

/**
 * Fold a colony visit's projection back into the run. Only credits and the consumable
 * inventory may differ from a fresh projection of the run; any other change is rejected.
 */
export function mergeGalaxyColonyVisit(
  opened: Extract<OpenGalaxyColony, { ok: true }>,
  projected: SaveData,
): GalaxyColonyVisitMerge {
  try {
    const before = projectGalaxyRunToLegacyState(opened.run) as unknown as Record<string, unknown>;
    const after = projected as unknown as Record<string, unknown>;
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      if (!VISIT_FIELDS.has(key) && !samePlainData(before[key], after[key])) {
        return { ok: false, reason: "unauthorized_change" };
      }
    }
    const merged = mergeProjectionIntoGalaxy(opened.run, {
      resources: { credits: projected.credits },
      ship: { consumableInventory: structuredClone(projected.consumableInventory) },
    });
    if (!merged.ok) return { ok: false, reason: "projection_merge_failed" };
    return { ok: true, save: { ...opened.parent, galaxyRun: merged.galaxyRun } };
  } catch {
    return { ok: false, reason: "projection_merge_failed" };
  }
}

/**
 * Apply a colony shop purchase to a galaxy run. Prices use the colony merchant's faction rank
 * from the run's own standings. Returns the next canonical save, or null when the purchase is
 * refused (locked, unaffordable, full, or the vessel is no longer parked).
 */
export function applyGalaxyColonyPurchase(
  save: SaveData,
  colonyId: string,
  request: FPShopPurchaseRequest,
): SaveData | null {
  const opened = openGalaxyColony(save, colonyId);
  if (!opened.ok) return null;
  const projection = opened.projectedSave;
  const rank = colonyMerchantRank(projection.colonies, projection.factionStandings, colonyId);
  const bought = applyShopPurchase(projection, request, rank);
  if (bought === null) return null;
  const merged = mergeGalaxyColonyVisit(opened, bought);
  return merged.ok ? merged.save : null;
}

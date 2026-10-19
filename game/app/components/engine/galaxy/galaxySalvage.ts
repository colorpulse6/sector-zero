import type { CanonicalSaveStore } from "../missionOutcome";
import type { SaveData } from "../types";
import { galaxyColonyManagementAccess } from "./galaxyColonyManagement";
import { samePlainData } from "./galaxyColony";
import { isGalaxyPoiPreparedAuthorityFact } from "./galaxyPoiOutcomeAuthority";
import { advanceGalaxyWorldCycles, mergeProjectionIntoGalaxy } from "./galaxyProjection";

export const SALVAGE_SHIFT = Object.freeze({ cycles: 1, metal: 40, supply: 1 });

/** Binds one intent to what was displayed. Rewards are never taken from the command. */
export interface GalaxySalvageQuote {
  colonyId: string;
  worldCycle: number;
  saveRevision: number;
  stateKey: string;
}

type Reason = "no_galaxy_run" | "run_unreadable" | "access_unavailable" | "outcome_pending" |
  "malformed_command" | "stale_command" | "cycle_failed" | "merge_failed" | "storage_unreadable" | "write_failed";
type Refusal = { ok: false; reason: Reason; message: string };
export type GalaxySalvageQuoteResult = { ok: true; quote: GalaxySalvageQuote } | Refusal;
export type GalaxySalvageStoreResult = { ok: true; save: SaveData } | (Refusal & { reconcile: SaveData | null });

function refuse(reason: Reason, message: string): Refusal { return { ok: false, reason, message }; }

export function quoteGalaxySalvage(save: SaveData, colonyId: string): GalaxySalvageQuoteResult {
  try {
    if (save.activeExperience !== "galaxy" || save.galaxyRun === null) return refuse("no_galaxy_run", "NO ACTIVE GALAXY RUN");
    const validated = mergeProjectionIntoGalaxy(save.galaxyRun, {});
    if (!validated.ok) return refuse("run_unreadable", "GALAXY RUN COULD NOT BE READ");
    const run = validated.galaxyRun;
    const access = galaxyColonyManagementAccess(run, colonyId);
    if (access.status === "unavailable") return refuse("access_unavailable", access.reason);
    if (Object.values(run.operations).some(op => op.state === "active" || op.state === "accepted") ||
      run.historyFacts.some(isGalaxyPoiPreparedAuthorityFact) ||
      save.outcomeRecoveryRecords.some(record => record.kind !== "applied_return" || record.returnPending)) {
      return refuse("outcome_pending", "FINISH THE CURRENT MISSION RETURN BEFORE WORKING");
    }
    const colony = run.colonies.find(entry => entry.id === colonyId)!;
    return { ok: true, quote: {
      colonyId, worldCycle: run.worldCycle, saveRevision: save.saveRevision,
      stateKey: JSON.stringify({ identity: run.identity, colony, supply: run.resources.supply }),
    } };
  } catch { return refuse("run_unreadable", "GALAXY RUN COULD NOT BE READ"); }
}

function snapshotQuote(value: unknown): GalaxySalvageQuote | null {
  try {
    if (typeof value !== "object" || value === null || Object.getPrototypeOf(value) !== Object.prototype) return null;
    const keys = ["colonyId", "worldCycle", "saveRevision", "stateKey"] as const;
    if (Reflect.ownKeys(value).length !== keys.length) return null;
    const copy: Record<string, unknown> = {};
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor)) return null;
      copy[key] = descriptor.value;
    }
    if (typeof copy.colonyId !== "string" || typeof copy.stateKey !== "string" ||
      !Number.isSafeInteger(copy.worldCycle) || (copy.worldCycle as number) < 0 ||
      !Number.isSafeInteger(copy.saveRevision) || (copy.saveRevision as number) < 0) return null;
    return copy as unknown as GalaxySalvageQuote;
  } catch { return null; }
}

/** Read, calculate and write synchronously, as for colony commissions. No cross-tab CAS claim. */
export function commitGalaxySalvageToStore(store: CanonicalSaveStore, submitted: GalaxySalvageQuote): GalaxySalvageStoreResult {
  const quote = snapshotQuote(submitted);
  if (quote === null) return { ...refuse("malformed_command", "WORK REQUEST REJECTED"), reconcile: null };
  let stored: SaveData;
  try { stored = store.read(); }
  catch { return { ...refuse("storage_unreadable", "SAVE COULD NOT BE READ · NOTHING CHANGED"), reconcile: null }; }
  const authoritative = quoteGalaxySalvage(stored, quote.colonyId);
  if (!authoritative.ok) return { ...authoritative, reconcile: authoritative.reason === "run_unreadable" ? null : stored };
  if (!samePlainData(quote, authoritative.quote)) {
    return { ...refuse("stale_command", "COLONY CHANGED · REVIEW AND TRY AGAIN"), reconcile: stored };
  }
  // Advance all world systems before delivering this shift's cargo. Never mutate the stored parent.
  const advanced = advanceGalaxyWorldCycles(stored, SALVAGE_SHIFT.cycles);
  if (!advanced.ok) return { ...refuse("cycle_failed", "WORK COULD NOT ADVANCE · NOTHING CHANGED"), reconcile: null };
  const colonies = advanced.galaxyRun.colonies.map(colony => colony.id === quote.colonyId
    ? { ...colony, resources: { ...colony.resources, metal: colony.resources.metal + SALVAGE_SHIFT.metal } }
    : colony);
  const merged = mergeProjectionIntoGalaxy(advanced.galaxyRun, {
    colonies, resources: { supply: advanced.galaxyRun.resources.supply + SALVAGE_SHIFT.supply },
  });
  if (!merged.ok) return { ...refuse("merge_failed", "WORK REWARD COULD NOT BE SAVED · NOTHING CHANGED"), reconcile: null };
  const save = { ...stored, galaxyRun: merged.galaxyRun };
  try { store.write(save); }
  catch { return { ...refuse("write_failed", "WORK SAVE FAILED · NOTHING CHANGED"), reconcile: null }; }
  return { ok: true, save };
}

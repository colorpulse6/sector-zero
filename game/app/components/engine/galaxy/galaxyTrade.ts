import { colonyMerchantRank, merchantRefusesTrade } from "../../colony/shared/factionLedger";
import type { CanonicalSaveStore } from "../missionOutcome";
import type { FPDialogLine, FPShopItem, SaveData } from "../types";
import { openGalaxyColony } from "./galaxyColony";
import { isGalaxyPoiPreparedAuthorityFact } from "./galaxyPoiOutcomeAuthority";
import { mergeProjectionIntoGalaxy } from "./galaxyProjection";

export const ASHFALL_EXCHANGE = Object.freeze({ metal: 20, supply: 1 });
type Refusal = { ok: false; message: string };
export type GalaxyTradeResult = { ok: true; save: SaveData; message: string } |
  (Refusal & { reconcile: SaveData | null });

/** Display intent, never a client-supplied price. No save or clock mutation. */
export function quoteGalaxyTrade(save: SaveData, colonyId: string):
  { ok: true; key: string; metal: number; supply: number } | Refusal {
  try {
    const opened = openGalaxyColony(save, colonyId);
    if (!opened.ok) return { ok: false, message: opened.reason };
    const { run, colony, projectedSave } = opened;
    const rank = colonyMerchantRank(projectedSave.colonies, projectedSave.factionStandings, colonyId);
    if (merchantRefusesTrade(rank)) return { ok: false, message: "QUARTERMASTER REFUSES TRADE" };
    if (Object.values(run.operations).some(op => op.state === "active" || op.state === "accepted") ||
      run.historyFacts.some(isGalaxyPoiPreparedAuthorityFact) ||
      save.outcomeRecoveryRecords.some(record => record.kind !== "applied_return" || record.returnPending)) {
      return { ok: false, message: "FINISH THE MISSION RETURN FIRST" };
    }
    if (!Number.isSafeInteger(save.saveRevision) || save.saveRevision < 0 || save.saveRevision >= Number.MAX_SAFE_INTEGER) {
      return { ok: false, message: "SAVE REVISION COULD NOT BE READ" };
    }
    return { ok: true, metal: colony.resources.metal, supply: run.resources.supply,
      key: JSON.stringify({ colonyId, revision: save.saveRevision, identity: run.identity,
        cycle: run.worldCycle, metal: colony.resources.metal, supply: run.resources.supply, rank }) };
  } catch { return { ok: false, message: "GALAXY RUN COULD NOT BE READ" }; }
}

/** Re-read and commit once. A new revision invalidates an already-consumed intent. */
export function commitGalaxyTradeToStore(store: CanonicalSaveStore, colonyId: string, key: unknown): GalaxyTradeResult {
  if (typeof key !== "string" || key.length > 4096) {
    return { ok: false, message: "TRADE REQUEST REJECTED", reconcile: null };
  }
  let stored: SaveData;
  try { stored = store.read(); }
  catch { return { ok: false, message: "SAVE COULD NOT BE READ · NO TRADE", reconcile: null }; }
  const quote = quoteGalaxyTrade(stored, colonyId);
  if (!quote.ok) return { ...quote, reconcile: null };
  if (key !== quote.key) return { ok: false, message: "STOCK CHANGED · REVIEW AND TRY AGAIN", reconcile: stored };
  if (quote.metal < ASHFALL_EXCHANGE.metal) return { ok: false, message: "NEED 20 COLONY METAL · WORK SALVAGE", reconcile: stored };
  const run = stored.galaxyRun!;
  const merged = mergeProjectionIntoGalaxy(run, {
    colonies: run.colonies.map(colony => colony.id === colonyId
      ? { ...colony, resources: { ...colony.resources, metal: colony.resources.metal - ASHFALL_EXCHANGE.metal } }
      : colony),
    resources: { supply: run.resources.supply + ASHFALL_EXCHANGE.supply },
  });
  if (!merged.ok) return { ok: false, message: "TRADE COULD NOT BE SAVED", reconcile: null };
  const save = { ...stored, galaxyRun: merged.galaxyRun, saveRevision: stored.saveRevision + 1 };
  try { store.write(save); }
  catch { return { ok: false, message: "SAVE FAILED · NO TRADE", reconcile: null }; }
  return { ok: true, save, message: "TRADED 20 METAL · +1 TRAVEL SUPPLY" };
}

export function galaxyQuartermasterView(save: SaveData, colonyId: string): {
  items: FPShopItem[]; dialog: FPDialogLine[]; balance: string;
} {
  const quote = quoteGalaxyTrade(save, colonyId);
  const balance = quote.ok ? `COLONY METAL ${quote.metal}    SHIP SUPPLY ${quote.supply}` : quote.message;
  return {
    balance,
    dialog: [{ speaker: "Quartermaster", text: quote.ok
      ? "Twenty colony metal buys one travel supply. Work salvage in Manage Colony, or bring the mine's surplus. Keep enough metal for your next building."
      : quote.message }],
    items: [{ id: "ashfall-supply", type: "galaxy-trade", name: "Travel Supply", cost: ASHFALL_EXCHANGE.metal,
      description: "+1 ship supply · spend colony metal", costLabel: "20 METAL", quoteKey: quote.ok ? quote.key : "unavailable" }],
  };
}

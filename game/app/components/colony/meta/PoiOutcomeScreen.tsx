import React, { useState } from "react";
import type { ColonyState } from "../shared/colonyTypes";
import type { PendingPoiResolution } from "../region/poiRuntime";
import { deliveryPayloadLabel } from "../shared/missionDelivery";

export function PoiOutcomeScreen({ pending, colonies, resolving, error, onConfirm, onHub }: { pending: PendingPoiResolution; colonies: ColonyState[]; resolving: boolean; error: string | null; onConfirm: (id: string | null) => void; onHub?: () => void }) {
  const [destination, setDestination] = useState(colonies.some(c => c.id === pending.originColonyId) ? pending.originColonyId : colonies[0]?.id ?? "");
  return <div role="dialog" aria-modal="true" aria-label="POI outcome" style={{ position: "fixed", inset: 0, zIndex: 1300, background: "rgba(0,0,0,.92)", color: "white", display: "grid", placeItems: "center", fontFamily: "ui-monospace, Menlo, monospace" }}>
    <div style={{ border: "1px solid #00f0ff", padding: 28, width: "min(90vw, 520px)" }}>
      <h2>{pending.outcome ? "SITE CLEARED" : "EXPEDITION COMPLETE"}</h2>
      {pending.outcome ? <><p>{deliveryPayloadLabel(pending.outcome.payload)}</p><label>DELIVER TO <select value={destination} onChange={e => setDestination(e.target.value)}>{colonies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label></> : <p>REPLAY COMPLETE — CARGO WAS ALREADY RECOVERED.</p>}
      {error && <p role="alert" style={{ color: "#ff7777" }}>{error}</p>}
      <button disabled={resolving || (!!pending.outcome && !destination)} onClick={() => onConfirm(pending.outcome ? destination : null)}>{resolving ? "SAVING…" : pending.outcome ? "CONFIRM DELIVERY" : "RETURN TO COLONY"}</button>
      {error && onHub && <button onClick={onHub}>RETURN TO HUB</button>}
    </div>
  </div>;
}

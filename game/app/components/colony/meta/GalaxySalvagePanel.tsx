import React from "react";
import { SALVAGE_SHIFT } from "../../engine/galaxy/galaxySalvage";
import { hudColors, hudSpacing } from "./hudTokens";

/** Work advances the colony through its ordinary cycle, even with empty starting stores. */
export function GalaxySalvagePanel({ supply, blocked, onWork }: {
  supply: number; blocked: string | null; onWork: () => void;
}) {
  return (
    <section aria-label="Salvage work" style={{ padding: hudSpacing.md, borderBottom: `1px solid ${hudColors.borderHud}` }}>
      <h2 style={{ margin: "0 0 8px", fontSize: "14px", color: hudColors.cyanAccent }}>SALVAGE SHIFT</h2>
      <p style={{ margin: "0 0 6px", fontSize: "12px" }}>
        Recover scrap near the landing pad. No combat or supplies required.
      </p>
      <p style={{ margin: "0 0 6px", fontSize: "12px" }}>
        +{SALVAGE_SHIFT.metal} colony metal · +{SALVAGE_SHIFT.supply} travel supply · {SALVAGE_SHIFT.cycles} world cycle
      </p>
      <p style={{ margin: "0 0 12px", fontSize: "11px", color: hudColors.textMuted }}>
        Travel supply: {supply}. Construction, production and settler arrivals advance with each shift.
      </p>
      <button type="button" disabled={blocked !== null} onClick={onWork}
        onKeyDown={event => { if (event.repeat && (event.key === "Enter" || event.key === " ")) event.preventDefault(); }}
        style={{ padding: "10px 16px", background: hudColors.deep, color: hudColors.cyanAccent,
          border: `1px solid ${hudColors.borderActive}`, cursor: blocked ? "not-allowed" : "pointer", opacity: blocked ? 0.5 : 1 }}>
        WORK A SALVAGE SHIFT
      </button>
      {blocked && <p style={{ fontSize: "11px", color: hudColors.textMuted }}>{blocked}</p>}
    </section>
  );
}

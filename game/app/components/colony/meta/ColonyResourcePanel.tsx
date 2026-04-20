import React from "react";
import type { ColonyState } from "../shared/colonyTypes";
import { derivePowerGrid } from "../shared/powerGrid";
import { predictedDeltas } from "./predictedDeltas";
import { hudColors, hudFonts, hudSpacing } from "./hudTokens";

export interface ColonyResourcePanelProps {
  colony: ColonyState;
}

function formatDelta(n: number): string {
  if (n > 0) return `+${n}`;
  return `${n}`;
}

export function ColonyResourcePanel({ colony }: ColonyResourcePanelProps) {
  const deltas = predictedDeltas(colony);
  const grid = derivePowerGrid(colony);

  const tile = (label: string, value: string | number, deltaLabel: string, deltaColor: string) => (
    <div style={{
      border: `1px solid ${hudColors.borderHud}`,
      padding: hudSpacing.md,
      minWidth: "120px",
    }}>
      <div style={{ fontSize: "10px", color: hudColors.textMuted, letterSpacing: "0.1em" }}>
        {label}
      </div>
      <div style={{ fontSize: "24px", color: hudColors.textPrimary, marginTop: "4px" }}>
        {value}
      </div>
      <div style={{ fontSize: "11px", color: deltaColor, marginTop: "2px" }}>
        {deltaLabel}
      </div>
    </div>
  );

  const deltaColor = (n: number) =>
    n > 0 ? hudColors.success : n < 0 ? hudColors.dangerAccent : hudColors.textMuted;

  const powerDelta = grid.surplus;
  const powerLabel = grid.demand === 0 && grid.capacity === 0
    ? "idle"
    : powerDelta >= 0 ? `surplus ${powerDelta}` : `deficit ${Math.abs(powerDelta)}`;

  return (
    <div style={{
      display: "flex",
      gap: hudSpacing.md,
      padding: hudSpacing.md,
      fontFamily: hudFonts.mono,
    }}>
      {tile("FOOD", colony.resources.food, `${formatDelta(deltas.food)}/cycle`, deltaColor(deltas.food))}
      {tile("WATER", colony.resources.water, `${formatDelta(deltas.water)}/cycle`, deltaColor(deltas.water))}
      {tile("METAL", colony.resources.metal, `${formatDelta(deltas.metal)}/cycle`, deltaColor(deltas.metal))}
      {tile("POWER", `${grid.capacity}/${grid.demand}`, powerLabel, powerDelta >= 0 ? hudColors.success : hudColors.dangerAccent)}
    </div>
  );
}

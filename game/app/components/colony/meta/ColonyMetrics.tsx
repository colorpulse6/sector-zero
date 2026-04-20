import React from "react";
import type { ColonyState } from "../shared/colonyTypes";
import { hudColors, hudFonts, hudSpacing } from "./hudTokens";

export interface ColonyMetricsProps {
  colony: ColonyState;
}

function happinessLabel(h: number): string {
  if (h >= 80) return "Thriving";
  if (h >= 50) return "Stable";
  if (h >= 25) return "Declining";
  return "Collapsing";
}

export function ColonyMetrics({ colony }: ColonyMetricsProps) {
  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display: "flex", gap: hudSpacing.md, marginBottom: "4px" }}>
      <span style={{
        color: hudColors.textMuted,
        minWidth: "120px",
        fontSize: "11px",
        letterSpacing: "0.08em",
      }}>
        {label}
      </span>
      <span style={{ color: hudColors.textPrimary, fontSize: "13px" }}>
        {value}
      </span>
    </div>
  );

  return (
    <div style={{
      padding: hudSpacing.md,
      fontFamily: hudFonts.mono,
      borderBottom: `1px solid ${hudColors.borderHud}`,
    }}>
      {row("POPULATION", `${colony.population.total} / ${colony.population.capacity}`)}
      {row("HAPPINESS", `${colony.happiness} · ${happinessLabel(colony.happiness)}`)}
      {row("SELF-SUFFICIENT", colony.selfSufficient ? "✓ Yes" : "— No")}
    </div>
  );
}

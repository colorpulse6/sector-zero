import React from "react";
import type { ColonyState } from "../shared/colonyTypes";
import { hudColors, hudFonts, hudSpacing } from "./hudTokens";

export interface ColonyHeaderProps {
  colony: ColonyState;
  missionsSinceStart: number;
  onBack: () => void;
}

export function ColonyHeader({ colony, missionsSinceStart, onBack }: ColonyHeaderProps) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      padding: hudSpacing.md,
      borderBottom: `1px solid ${hudColors.borderHud}`,
    }}>
      <button
        onClick={onBack}
        style={{
          background: "transparent",
          border: "none",
          color: hudColors.cyanAccent,
          fontFamily: hudFonts.mono,
          fontSize: "14px",
          cursor: "pointer",
          padding: 0,
          marginRight: hudSpacing.lg,
        }}
      >
        ← RETURN TO COCKPIT
      </button>
      <div style={{ flex: 1 }}>
        <h1 style={{
          fontSize: "18px",
          color: hudColors.cyanAccent,
          margin: 0,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}>
          {colony.name}
        </h1>
        <div style={{
          fontSize: "11px",
          color: hudColors.textMuted,
          marginTop: "2px",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}>
          TIER {colony.tier} · {colony.foundingType}
        </div>
      </div>
      <div style={{
        fontSize: "11px",
        color: hudColors.textMuted,
        letterSpacing: "0.08em",
      }}>
        CYCLE {missionsSinceStart}
      </div>
    </div>
  );
}

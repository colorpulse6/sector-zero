import React from "react";
import type { ColonyState, ColonyBuilding } from "../shared/colonyTypes";
import { hudColors, hudFonts, hudSpacing } from "./hudTokens";

export interface ColonyBuildingsListProps {
  colony: ColonyState;
}

function statusIcon(status: ColonyBuilding["status"]): string {
  switch (status) {
    case "operational": return "●";
    case "constructing": return "○";
    case "damaged": return "!";
    case "offline": return "×";
    case "destroyed": return "✗";
  }
}

function statusColor(status: ColonyBuilding["status"]): string {
  switch (status) {
    case "operational": return hudColors.success;
    case "constructing": return hudColors.cyanAccent;
    case "damaged": return hudColors.dangerAccent;
    case "offline": return hudColors.textMuted;
    case "destroyed": return hudColors.dangerAccent;
  }
}

function prettyType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export function ColonyBuildingsList({ colony }: ColonyBuildingsListProps) {
  return (
    <div style={{
      padding: hudSpacing.md,
      fontFamily: hudFonts.mono,
      borderBottom: `1px solid ${hudColors.borderHud}`,
    }}>
      <div style={{
        fontSize: "10px",
        color: hudColors.textMuted,
        letterSpacing: "0.1em",
        marginBottom: hudSpacing.sm,
      }}>
        BUILDINGS
      </div>
      {colony.buildings.length === 0 ? (
        <div style={{
          padding: hudSpacing.sm,
          border: `1px dashed ${hudColors.borderHud}`,
          color: hudColors.textMuted,
          fontSize: "12px",
        }}>
          No buildings yet — commission your first below.
        </div>
      ) : (
        <div>
          {colony.buildings.map(b => (
            <div key={b.id} style={{
              display: "flex",
              gap: hudSpacing.md,
              padding: "4px 0",
              fontSize: "12px",
            }}>
              <span style={{ color: statusColor(b.status), minWidth: "16px" }}>
                {statusIcon(b.status)}
              </span>
              <span style={{ color: hudColors.textPrimary, minWidth: "140px" }}>
                {prettyType(b.type)}
              </span>
              <span style={{ color: hudColors.textMuted, minWidth: "100px" }}>
                {b.status}
              </span>
              <span style={{ color: hudColors.textMuted }}>
                {b.status === "constructing"
                  ? `${b.buildProgressCycles} cycle${b.buildProgressCycles === 1 ? "" : "s"} remaining`
                  : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

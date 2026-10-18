import React from "react";
import type { ColonyState } from "../shared/colonyTypes";
import { plannedPower, settlementOutlook } from "../../engine/galaxy/galaxySettlement";
import { hudColors, hudFonts, hudSpacing } from "./hudTokens";

export interface GalaxySettlementPanelProps {
  colony: ColonyState;
  worldCycle: number;
}

const LOOP_FACTORS: ReadonlySet<string> = new Set(["food_stock", "water_stock", "power_ok"]);

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

function settlerLine(change: number, waiting: string | null): string {
  if (change > 0) return `+${change} SETTLER${change === 1 ? "" : "S"}`;
  const head = change < 0 ? `${change} SETTLERS` : "NO NEW SETTLERS";
  return waiting === null ? head : `${head} · ${waiting}`;
}

/**
 * Settlement-loop legibility: planned power, slots, housing, the happiness terms and the next
 * cycle's settlers, all from the same rules the command and the cycle processor use.
 */
export function GalaxySettlementPanel({ colony, worldCycle }: GalaxySettlementPanelProps) {
  const power = plannedPower(colony);
  const outlook = settlementOutlook(colony, worldCycle);
  // The terms this loop can act on always show; any other term shows only when it counts.
  const factors = outlook.factors.filter(factor => factor.met || LOOP_FACTORS.has(factor.id));
  const row = (label: string, value: string) => (
    <div style={{ display: "flex", gap: hudSpacing.md, marginBottom: "4px" }}>
      <span style={{ color: hudColors.textMuted, minWidth: "120px", fontSize: "11px", letterSpacing: "0.08em" }}>{label}</span>
      <span style={{ color: hudColors.textPrimary, fontSize: "12px" }}>{value}</span>
    </div>
  );
  const note = (text: string) => (
    <div style={{ color: hudColors.textMuted, fontSize: "10px", letterSpacing: "0.08em", marginTop: hudSpacing.sm }}>{text}</div>
  );
  return (
    <section aria-label="Settlement" style={{
      padding: hudSpacing.md, fontFamily: hudFonts.mono, borderBottom: `1px solid ${hudColors.borderHud}`,
    }}>
      <div style={{ fontSize: "10px", color: hudColors.textMuted, letterSpacing: "0.1em", marginBottom: hudSpacing.sm }}>
        SETTLEMENT
      </div>
      {row("POWER PLAN", `${power.capacity} / ${power.demand} · ${power.spare} SPARE (BUILT + UNDER CONSTRUCTION)`)}
      {row("BUILD SLOTS", `${colony.buildings.length} / ${colony.siteStats.buildableSlots} USED`)}
      {row("HOUSING", `${outlook.housing.settlers} / ${outlook.housing.capacity} · ${outlook.housing.free} FREE`)}
      {row("HAPPINESS", `${outlook.happiness} NOW · ${outlook.nextHappiness} NEXT CYCLE`)}
      <ul style={{ listStyle: "none", margin: `0 0 4px 0`, padding: `0 0 0 136px`, fontSize: "11px" }}>
        {factors.map(factor => (
          <li key={factor.id} style={{ color: factor.met ? hudColors.success : hudColors.textMuted }}>
            {`${factor.met ? "✓" : "✗"} ${factor.label} ${signed(factor.delta)}`}
          </li>
        ))}
      </ul>
      {row("NEXT CYCLE", settlerLine(outlook.settlerChange, outlook.waiting))}
      {note("SETTLERS ARRIVE ONE PER CYCLE WHILE HAPPINESS IS OVER 60 AND HOUSING IS FREE")}
      {note("TIME PASSES WITH SURVEYS, EXPEDITIONS, TRAVEL AND OPERATIONS · FINISHED BUILDINGS APPEAR IN THE WALK ON YOUR NEXT DESCENT")}
    </section>
  );
}

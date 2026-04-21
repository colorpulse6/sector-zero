import React from "react";
import type { ColonyState, BuildingType, ColonyResources } from "../shared/colonyTypes";
import type { ColonyEvent } from "../shared/colonyEvents";
import { Events } from "../shared/colonyEvents";
import { genBuildingId } from "./buildingIdGen";
import { hudColors, hudFonts, hudSpacing } from "./hudTokens";

export interface ColonyCommissionMenuProps {
  colony: ColonyState;
  onDispatch: (event: ColonyEvent) => void;
}

interface BuildOption {
  type: BuildingType;
  label: string;
  icon: string;
  cost: Partial<ColonyResources>;
  cyclesToBuild: number;
  shortDesc: string;
}

const PHASE_1_BUILD_OPTIONS: BuildOption[] = [
  { type: "solar_array", label: "Solar Array", icon: "☀", cost: { metal: 80 }, cyclesToBuild: 1, shortDesc: "+10 power" },
  { type: "farm", label: "Farm", icon: "🌾", cost: { metal: 100 }, cyclesToBuild: 2, shortDesc: "+15 food, −5 water" },
  { type: "water_purifier", label: "Water Purifier", icon: "💧", cost: { metal: 120 }, cyclesToBuild: 2, shortDesc: "+12 water" },
  { type: "habitat_module", label: "Habitat Module", icon: "🏠", cost: { metal: 100 }, cyclesToBuild: 1, shortDesc: "Houses 10" },
];

function canAfford(colony: ColonyState, cost: Partial<ColonyResources>): boolean {
  return (cost.food ?? 0) <= colony.resources.food
    && (cost.water ?? 0) <= colony.resources.water
    && (cost.metal ?? 0) <= colony.resources.metal
    && (cost.credits ?? 0) <= colony.resources.credits;
}

function costLabel(cost: Partial<ColonyResources>): string {
  const parts: string[] = [];
  if (cost.metal) parts.push(`${cost.metal} metal`);
  if (cost.food) parts.push(`${cost.food} food`);
  if (cost.water) parts.push(`${cost.water} water`);
  return parts.join(" · ");
}

/**
 * Compute a human-readable message describing what the colony is missing
 * to afford a given cost. Returns empty string if affordable.
 *
 * Exported for testing; the UI consumes it directly via the BUILD button
 * label. Handles all 4 ColonyResources fields uniformly — future building
 * types with food/water/credit costs work without code changes.
 */
export function shortfallMessage(
  have: ColonyResources,
  cost: Partial<ColonyResources>
): string {
  const missing: string[] = [];
  const keys: (keyof ColonyResources)[] = ["metal", "food", "water", "credits"];
  for (const key of keys) {
    const need = cost[key] ?? 0;
    if (need <= 0) continue;
    const shortfall = need - have[key];
    if (shortfall > 0) {
      missing.push(`${shortfall} more ${key}`);
    }
  }
  if (missing.length === 0) return "";
  return `Need ${missing.join(", ")}`;
}

export function ColonyCommissionMenu({ colony, onDispatch }: ColonyCommissionMenuProps) {
  const handleBuild = (opt: BuildOption) => {
    onDispatch(Events.buildingCommissioned({
      colonyId: colony.id,
      buildingId: genBuildingId(colony, opt.type),
      buildingType: opt.type,
      costDeducted: opt.cost,
      cyclesToBuild: opt.cyclesToBuild,
    }));
  };

  return (
    <div style={{
      padding: hudSpacing.md,
      fontFamily: hudFonts.mono,
    }}>
      <div style={{
        fontSize: "10px",
        color: hudColors.textMuted,
        letterSpacing: "0.1em",
        marginBottom: hudSpacing.sm,
      }}>
        COMMISSION NEW BUILDING
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: hudSpacing.md,
      }}>
        {PHASE_1_BUILD_OPTIONS.map(opt => {
          const affordable = canAfford(colony, opt.cost);
          return (
            <div
              key={opt.type}
              style={{
                border: `1px solid ${affordable ? hudColors.borderActive : hudColors.borderHud}`,
                padding: hudSpacing.md,
                opacity: affordable ? 1 : 0.5,
              }}
            >
              <div style={{
                fontSize: "14px",
                color: hudColors.textPrimary,
                marginBottom: "4px",
              }}>
                {opt.icon} {opt.label}
              </div>
              <div style={{
                fontSize: "10px",
                color: hudColors.textMuted,
                marginBottom: "2px",
              }}>
                {costLabel(opt.cost)} · {opt.cyclesToBuild} cycle{opt.cyclesToBuild === 1 ? "" : "s"}
              </div>
              <div style={{
                fontSize: "10px",
                color: hudColors.textMuted,
                marginBottom: hudSpacing.sm,
              }}>
                {opt.shortDesc}
              </div>
              <button
                onClick={() => handleBuild(opt)}
                disabled={!affordable}
                style={{
                  width: "100%",
                  padding: `${hudSpacing.sm} ${hudSpacing.md}`,
                  background: affordable ? "rgba(0, 240, 255, 0.08)" : "transparent",
                  color: affordable ? hudColors.cyanAccent : hudColors.textMuted,
                  border: `1px solid ${affordable ? hudColors.cyanAccent : hudColors.borderHud}`,
                  fontFamily: hudFonts.mono,
                  fontSize: "12px",
                  letterSpacing: "0.1em",
                  cursor: affordable ? "pointer" : "not-allowed",
                  textTransform: "uppercase",
                }}
              >
                {affordable ? "Build" : shortfallMessage(colony.resources, opt.cost)}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

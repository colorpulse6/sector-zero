import React, { useRef } from "react";
import { useModalFocus } from "../../ui/ModalFocus";
import type { BuildingType, ColonyState } from "../shared/colonyTypes";
import { hudColors, hudFonts, hudSpacing } from "./hudTokens";
import { ColonyHeader } from "./ColonyHeader";
import { ColonyResourcePanel } from "./ColonyResourcePanel";
import { ColonyMetrics } from "./ColonyMetrics";
import { ColonyBuildingsList } from "./ColonyBuildingsList";
import { ColonyCommissionMenu, PHASE_1_BUILD_OPTIONS, type BuildOption } from "./ColonyCommissionMenu";
import { GalaxySettlementPanel } from "./GalaxySettlementPanel";
import { settlementCommissionBlock } from "../../engine/galaxy/galaxySettlement";

export interface GalaxyColonyManagementScreenProps {
  colony: ColonyState;
  worldCycle: number;
  supportedTypes: readonly BuildingType[];
  status: string | null;
  onCommission: (option: BuildOption) => void;
  onExit: () => void;
  focusActive?: boolean;
  onRestoreFocus?: () => void;
}

/**
 * GC2-A: colony management in a galaxy run. Reuses the legacy panels; Build goes through the
 * galaxy command boundary in Game.tsx, never through a reducer event. Options follow
 * `supportedTypes` order, and a button names the same settlement rule the command applies.
 */
export function GalaxyColonyManagementScreen({
  colony, worldCycle, supportedTypes, status, onCommission, onExit, focusActive = true, onRestoreFocus,
}: GalaxyColonyManagementScreenProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  useModalFocus({ active: focusActive, rootRef, onEscape: onExit, restoreFocus: onRestoreFocus,
    initialFocus: () => rootRef.current?.querySelector<HTMLElement>("button:not([disabled])") ?? null });
  const options = supportedTypes.flatMap(type => PHASE_1_BUILD_OPTIONS.filter(option => option.type === type));
  const blockedReason = (option: BuildOption): string | null => {
    const block = settlementCommissionBlock(colony, option.type);
    // A metal shortfall keeps the menu's own "Need N more metal" label.
    return block === null || block.reason === "insufficient_resources" ? null : block.message;
  };
  return (
    <div ref={rootRef} role="dialog" aria-modal="true" aria-label="Colony management" tabIndex={-1}
      data-galaxy-colony-management style={{
        position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
        background: hudColors.deep, color: hudColors.textPrimary, fontFamily: hudFonts.mono,
        zIndex: 1200, overflow: "auto",
      }}>
      <ColonyHeader colony={colony} missionsSinceStart={worldCycle} onBack={onExit} backLabel="← BACK" />
      <p role="status" aria-live="polite" style={{
        margin: 0, padding: `0 ${hudSpacing.md}`, minHeight: 18, fontSize: "11px",
        letterSpacing: "0.1em", color: hudColors.cyanAccent,
      }}>{status ?? ""}</p>
      <ColonyResourcePanel colony={colony} />
      <ColonyMetrics colony={colony} />
      <GalaxySettlementPanel colony={colony} worldCycle={worldCycle} />
      <ColonyBuildingsList colony={colony} />
      <ColonyCommissionMenu colony={colony} options={options} onCommission={onCommission} blockedReason={blockedReason} />
    </div>
  );
}

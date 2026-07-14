import React, { useEffect, useState } from "react";
import type { SaveData } from "../../engine/types";
import type { ColonyEvent } from "../shared/colonyEvents";
import { Events } from "../shared/colonyEvents";
import { hudColors, hudFonts } from "./hudTokens";
import { ColonyEmptyState } from "./ColonyEmptyState";
import { ColonyHeader } from "./ColonyHeader";
import { ColonyResourcePanel } from "./ColonyResourcePanel";
import { ColonyMetrics } from "./ColonyMetrics";
import { ColonyBuildingsList } from "./ColonyBuildingsList";
import { ColonyCommissionMenu } from "./ColonyCommissionMenu";

export interface ColoniesScreenProps {
  save: SaveData;
  onDispatch: (event: ColonyEvent) => void;
  onExit: () => void;
  onDescend?: (colonyId: string) => void;
  onRegionMap?: (colonyId: string) => void;
}

export function bootstrapColonyEvent(save: SaveData): ColonyEvent {
  return Events.founded({
    colonyId: "ashfall_primary",
    name: "Ashfall Primary",
    planetId: "ashfall",
    foundingType: "outpost",
    regionNodeId: "ashfall-forward-camp",
    missionCount: save.missionsSinceStart,
    layoutSeed: 42,
  });
}

export function ColoniesScreen({ save, onDispatch, onExit, onDescend, onRegionMap }: ColoniesScreenProps) {
  // Escape key to exit
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onExit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onExit]);

  const handleFound = () => {
    onDispatch(bootstrapColonyEvent(save));
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      background: hudColors.deep,
      color: hudColors.textPrimary,
      fontFamily: hudFonts.mono,
      zIndex: 1000,
      overflow: "auto",
    }}>
      {save.colonies.length === 0 ? (
        <ColonyEmptyState onFound={handleFound} />
      ) : (
        <PopulatedView save={save} onDispatch={onDispatch} onExit={onExit} onDescend={onDescend} onRegionMap={onRegionMap} />
      )}
    </div>
  );
}

function PopulatedView({
  save,
  onDispatch,
  onExit,
  onDescend,
  onRegionMap,
}: {
  save: SaveData;
  onDispatch: (event: ColonyEvent) => void;
  onExit: () => void;
  onDescend?: (colonyId: string) => void;
  onRegionMap?: (colonyId: string) => void;
}) {
  const [selectedColonyId, setSelectedColonyId] = useState(save.colonies[0]?.id ?? "");
  const colony = save.colonies.find(entry => entry.id === selectedColonyId) ?? save.colonies[0];
  if (!colony) return null;
  return (
    <>
      {save.colonies.length > 1 && (
        <div
          role="tablist"
          aria-label="Colonies"
          style={{ display: "flex", gap: 8, padding: "12px 16px", overflowX: "auto", borderBottom: `1px solid ${hudColors.borderHud}` }}
        >
          {save.colonies.map(entry => {
            const selected = entry.id === colony.id;
            return (
              <button
                key={entry.id}
                role="tab"
                aria-selected={selected}
                onClick={() => setSelectedColonyId(entry.id)}
                style={{
                  flex: "0 0 auto",
                  padding: "8px 12px",
                  border: `1px solid ${selected ? hudColors.cyanAccent : hudColors.borderHud}`,
                  background: selected ? "rgba(0, 240, 255, 0.08)" : "transparent",
                  color: selected ? hudColors.cyanAccent : hudColors.textMuted,
                  fontFamily: hudFonts.mono,
                  cursor: "pointer",
                }}
              >
                {entry.name}
              </button>
            );
          })}
        </div>
      )}
      <ColonyHeader
        colony={colony}
        missionsSinceStart={save.missionsSinceStart}
        onBack={onExit}
        onDescend={onDescend ? () => onDescend(colony.id) : undefined}
      />
      {onRegionMap && <div style={{ padding: 16 }}><button onClick={() => onRegionMap(colony.id)}>REGION — VIEW ONLY</button></div>}
      <ColonyResourcePanel colony={colony} />
      <ColonyMetrics colony={colony} />
      <ColonyBuildingsList colony={colony} />
      <ColonyCommissionMenu colony={colony} onDispatch={onDispatch} />
    </>
  );
}

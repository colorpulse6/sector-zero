import React, { useEffect } from "react";
import type { SaveData } from "../../engine/types";
import type { ColonyEvent } from "../shared/colonyEvents";
import { Events } from "../shared/colonyEvents";
import { hudColors, hudFonts } from "./hudTokens";
import { ColonyEmptyState } from "./ColonyEmptyState";
import { ColonyHeader } from "./ColonyHeader";
import { ColonyResourcePanel } from "./ColonyResourcePanel";

export interface ColoniesScreenProps {
  save: SaveData;
  onDispatch: (event: ColonyEvent) => void;
  onExit: () => void;
}

export function ColoniesScreen({ save, onDispatch, onExit }: ColoniesScreenProps) {
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
    onDispatch(Events.founded({
      colonyId: "ashfall_primary",
      name: "Ashfall Primary",
      planetId: "ashfall",
      foundingType: "outpost",
      regionNodeId: "ashfall_starter_region",
      missionCount: save.missionsSinceStart,
      layoutSeed: 42,
    }));
    onDispatch(Events.resourceChanged({
      colonyId: "ashfall_primary",
      delta: { metal: 500 },
      reason: "starter_grant",
    }));
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
        <PopulatedView save={save} onExit={onExit} />
      )}
    </div>
  );
}

function PopulatedView({ save, onExit }: { save: SaveData; onExit: () => void }) {
  const colony = save.colonies[0];
  return (
    <>
      <ColonyHeader
        colony={colony}
        missionsSinceStart={save.missionsSinceStart}
        onBack={onExit}
      />
      <ColonyResourcePanel colony={colony} />
      <div style={{ padding: "32px", opacity: 0.6 }}>
        [ColonyMetrics / BuildingsList / CommissionMenu land in Tasks 7-8]
      </div>
    </>
  );
}

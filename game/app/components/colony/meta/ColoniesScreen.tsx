import React, { useEffect } from "react";
import type { SaveData } from "../../engine/types";
import type { ColonyEvent } from "../shared/colonyEvents";
import { Events } from "../shared/colonyEvents";
import { hudColors, hudFonts } from "./hudTokens";
import { ColonyEmptyState } from "./ColonyEmptyState";

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
        <PopulatedPlaceholder save={save} onExit={onExit} />
      )}
    </div>
  );
}

// Placeholder until Tasks 6-8 replace it with the real components.
function PopulatedPlaceholder({ save, onExit }: { save: SaveData; onExit: () => void }) {
  const colony = save.colonies[0];
  return (
    <div style={{ padding: "32px" }}>
      <button onClick={onExit} style={{
        background: "transparent",
        border: "none",
        color: hudColors.cyanAccent,
        fontFamily: hudFonts.mono,
        cursor: "pointer",
        fontSize: "14px",
      }}>
        ← RETURN TO COCKPIT
      </button>
      <h1 style={{ color: hudColors.cyanAccent, marginTop: "16px" }}>
        {colony.name}
      </h1>
      <p style={{ color: hudColors.textMuted, marginTop: "8px" }}>
        Tier {colony.tier} · {colony.foundingType} · Cycle {save.missionsSinceStart}
      </p>
      <p style={{ marginTop: "24px", color: hudColors.textMuted }}>
        [Populated screen lands in Tasks 6-8]
      </p>
      <p style={{ marginTop: "16px" }}>
        Resources: food {colony.resources.food}, water {colony.resources.water}, metal {colony.resources.metal}
      </p>
    </div>
  );
}

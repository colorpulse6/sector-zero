import React, { useEffect } from "react";
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
}

export function ColoniesScreen({ save, onDispatch, onExit, onDescend }: ColoniesScreenProps) {
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
        <PopulatedView save={save} onDispatch={onDispatch} onExit={onExit} onDescend={onDescend} />
      )}
    </div>
  );
}

function PopulatedView({
  save,
  onDispatch,
  onExit,
  onDescend,
}: {
  save: SaveData;
  onDispatch: (event: ColonyEvent) => void;
  onExit: () => void;
  onDescend?: (colonyId: string) => void;
}) {
  const colony = save.colonies[0];
  return (
    <>
      <ColonyHeader
        colony={colony}
        missionsSinceStart={save.missionsSinceStart}
        onBack={onExit}
        onDescend={onDescend ? () => onDescend(colony.id) : undefined}
      />
      <ColonyResourcePanel colony={colony} />
      <ColonyMetrics colony={colony} />
      <ColonyBuildingsList colony={colony} />
      <ColonyCommissionMenu colony={colony} onDispatch={onDispatch} />
    </>
  );
}

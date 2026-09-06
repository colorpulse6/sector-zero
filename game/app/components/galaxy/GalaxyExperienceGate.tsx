"use client";

import React from "react";

export interface GalaxyExperienceGateProps {
  hasGalaxyRun: boolean;
  ready: boolean;
  onGalaxy: () => void;
  onLegacy: () => void;
  className?: string;
}

export function GalaxyExperienceGate({
  hasGalaxyRun,
  ready,
  onGalaxy,
  onLegacy,
  className,
}: GalaxyExperienceGateProps) {
  return (
    <section
      aria-labelledby="experience-gate-title"
      aria-busy={!ready}
      className={className}
    >
      <div>
        <button type="button" disabled={!ready} onClick={onGalaxy} aria-describedby="galaxy-choice-context">
          {ready ? (hasGalaxyRun ? "CONTINUE GALAXY" : "BEGIN GALAXY") : "LOADING SAVE"}
        </button>
        <p id="galaxy-choice-context">Explore a persistent galaxy.</p>
      </div>
      <div>
        <button type="button" disabled={!ready} onClick={onLegacy} aria-describedby="legacy-choice-context">
          LEGACY CAMPAIGN
        </button>
        <p id="legacy-choice-context">40 missions across eight sectors.</p>
      </div>
      {!ready && <p role="status">Reading your saved progress…</p>}
    </section>
  );
}

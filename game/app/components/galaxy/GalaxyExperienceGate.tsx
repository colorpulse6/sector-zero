"use client";

import React from "react";

export interface GalaxyExperienceGateProps {
  hasGalaxyRun: boolean;
  onGalaxy: () => void;
  onLegacy: () => void;
}

const BUTTON_STYLE: React.CSSProperties = {
  minHeight: 48,
  padding: "12px 18px",
  border: "1px solid #00e7f0",
  background: "rgba(0, 92, 110, .25)",
  color: "#e8fdff",
  font: "inherit",
  letterSpacing: ".08em",
  cursor: "pointer",
};

export function GalaxyExperienceGate({
  hasGalaxyRun,
  onGalaxy,
  onLegacy,
}: GalaxyExperienceGateProps) {
  return (
    <section
      aria-labelledby="experience-gate-title"
      style={{
        width: "min(560px, calc(100% - 32px))",
        margin: "24px auto",
        padding: 24,
        border: "1px solid #1c5363",
        background: "rgba(5, 13, 22, .96)",
        color: "#c9e8ee",
        fontFamily: "ui-monospace, Menlo, monospace",
      }}
    >
      <p style={{ margin: 0, color: "#70aebc", letterSpacing: ".12em" }}>
        SELECT EXPERIENCE
      </p>
      <h1 id="experience-gate-title" style={{ margin: "8px 0", color: "#00f0ff" }}>
        SECTOR ZERO
      </h1>
      <p style={{ margin: "0 0 20px" }}>
        Begin a fresh continuous-galaxy expedition or preserve the numbered legacy campaign.
      </p>
      <div style={{ display: "grid", gap: 12 }}>
        <button type="button" onClick={onGalaxy} style={BUTTON_STYLE}>
          {hasGalaxyRun ? "CONTINUE GALAXY" : "BEGIN GALAXY"}
        </button>
        <button type="button" onClick={onLegacy} style={BUTTON_STYLE}>
          LEGACY CAMPAIGN
        </button>
      </div>
    </section>
  );
}


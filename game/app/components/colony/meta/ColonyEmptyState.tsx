import React, { useRef, useEffect } from "react";
import { hudColors, hudFonts, hudSpacing } from "./hudTokens";

export interface ColonyEmptyStateProps {
  onFound: () => void;
}

export function ColonyEmptyState({ onFound }: ColonyEmptyStateProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
      padding: hudSpacing.xl,
      fontFamily: hudFonts.mono,
      color: hudColors.textPrimary,
    }}>
      <h2 style={{
        fontSize: "24px",
        color: hudColors.cyanAccent,
        marginBottom: hudSpacing.md,
        fontWeight: "bold",
        letterSpacing: "0.1em",
      }}>
        NO COLONIES FOUNDED
      </h2>
      <p style={{
        maxWidth: "480px",
        textAlign: "center",
        color: hudColors.textMuted,
        marginBottom: hudSpacing.xl,
        lineHeight: 1.6,
      }}>
        Earth has authorized founding protocols. Your first settlement can
        anchor on Ashfall — a desert world already mapped by forward scouts.
      </p>
      <button
        ref={buttonRef}
        onClick={onFound}
        style={{
          padding: `${hudSpacing.md} ${hudSpacing.xl}`,
          background: "transparent",
          color: hudColors.cyanAccent,
          border: `1px solid ${hudColors.cyanAccent}`,
          fontFamily: hudFonts.mono,
          fontSize: "14px",
          letterSpacing: "0.1em",
          cursor: "pointer",
          textTransform: "uppercase",
        }}
      >
        Found Colony at Ashfall
      </button>
    </div>
  );
}

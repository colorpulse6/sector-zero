import React, { useEffect, useRef } from "react";

export interface ExitMenuProps {
  onTakeOff: () => void;
  onStay: () => void;
  onRegionMap?: () => void;
}

export function LandingPadExitMenu({ onTakeOff, onStay, onRegionMap }: ExitMenuProps) {
  const takeOffRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { takeOffRef.current?.focus(); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onStay(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onStay]);

  const tokens = {
    deep: "#0a0e17",
    cyan: "#00f0ff",
    text: "#e0e6ed",
    mono: "ui-monospace, 'Menlo', 'Consolas', monospace",
  };

  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, width: "100%", height: "100%",
      background: "rgba(0, 0, 0, 0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1100,
      fontFamily: tokens.mono,
    }}>
      <div style={{
        background: tokens.deep,
        border: `1px solid ${tokens.cyan}`,
        padding: "32px 48px",
        display: "flex", flexDirection: "column", gap: "16px",
      }}>
        <div style={{ color: tokens.cyan, fontSize: "14px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Landing Pad
        </div>
        <div style={{ color: tokens.text, fontSize: "12px", opacity: 0.7 }}>
          Leave the colony?
        </div>
        <button
          ref={takeOffRef}
          onClick={onTakeOff}
          style={{
            padding: "12px 24px",
            background: "transparent",
            color: tokens.cyan,
            border: `1px solid ${tokens.cyan}`,
            fontFamily: tokens.mono,
            fontSize: "13px",
            letterSpacing: "0.1em",
            cursor: "pointer",
            textTransform: "uppercase",
          }}
        >
          Take Off
        </button>
        {onRegionMap && <button onClick={onRegionMap} style={{ padding: "12px 24px", background: "rgba(0,240,255,.08)", color: tokens.cyan, border: `1px solid ${tokens.cyan}`, fontFamily: tokens.mono }}>REGION MAP</button>}
        <button
          onClick={onStay}
          style={{
            padding: "12px 24px",
            background: "transparent",
            color: "rgba(0, 240, 255, 0.5)",
            border: "1px solid rgba(0, 240, 255, 0.3)",
            fontFamily: tokens.mono,
            fontSize: "13px",
            letterSpacing: "0.1em",
            cursor: "pointer",
            textTransform: "uppercase",
          }}
        >
          Stay
        </button>
      </div>
    </div>
  );
}

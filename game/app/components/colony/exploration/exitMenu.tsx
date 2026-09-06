import React, { useRef } from "react";
import { useModalFocus } from "../../ui/ModalFocus";

export interface ExitMenuProps {
  onTakeOff: () => void;
  onStay: () => void;
  onRegionMap?: () => void;
  focusActive?: boolean;
  onRestoreFocus?: () => void;
}

export function LandingPadExitMenu({ onTakeOff, onStay, onRegionMap, focusActive = true, onRestoreFocus }: ExitMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const resumeRef = useRef<HTMLButtonElement>(null);
  useModalFocus({ active: focusActive, rootRef, initialFocus: () => resumeRef.current,
    onEscape: onStay, restoreFocus: onRestoreFocus });

  const tokens = {
    deep: "#0a0e17",
    cyan: "#00f0ff",
    text: "#e0e6ed",
    mono: "ui-monospace, 'Menlo', 'Consolas', monospace",
  };

  return (
    <div ref={rootRef} role="dialog" aria-modal="true" aria-label="Landing pad exit menu" tabIndex={-1} style={{
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
          ref={resumeRef}
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
          Resume
        </button>
      </div>
    </div>
  );
}

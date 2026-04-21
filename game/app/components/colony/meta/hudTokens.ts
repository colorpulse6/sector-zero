/**
 * Shared style constants for the colony DOM overlay.
 * Mirrors the HUD aesthetic from the existing canvas cockpit.
 * Colors match the companion site's @theme tokens in site/app/globals.css
 * so both apps feel consistent.
 */

export const hudColors = {
  deep: "#0a0e17",
  deepLighter: "#0f1520",
  cyanAccent: "#00f0ff",
  purpleAccent: "#7800ff",
  textPrimary: "#e0e6ed",
  textMuted: "rgba(0, 240, 255, 0.5)",
  dangerAccent: "#ff3366",
  success: "#44ff99",
  borderHud: "rgba(0, 240, 255, 0.15)",
  borderActive: "rgba(0, 240, 255, 0.4)",
  dimOverlay: "rgba(0, 0, 0, 0.85)",
};

export const hudFonts = {
  mono: "ui-monospace, 'Menlo', 'Consolas', monospace",
  heading: "ui-monospace, 'Menlo', 'Consolas', monospace",
};

export const hudSpacing = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
};
